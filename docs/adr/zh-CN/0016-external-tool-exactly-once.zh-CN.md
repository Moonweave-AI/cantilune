# ADR-0016：经由分层调用日志的外部工具 exactly-once

| 字段       | 值                                                                                                                                                                    |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态       | **Proposed**（已请求 Owner 审查；解除 SS-03 of QA-0012）                                                                                                              |
| 创建时间   | 2026-08-14                                                                                                                                                            |
| 更新时间   | 2026-08-14（§4 更正：移除 `completed`-reuse 路径——见下文"设计更正"）                                                                                                  |
| 决策 Owner | Joker-of-Gotham                                                                                                                                                       |
| 实现 DRI   | Codex 实现团队                                                                                                                                                        |
| 审查人     | 独立架构与安全审查待进行（QA-L5 出口门禁）                                                                                                                            |
| 摘要       | 增加一个持久 pre-invocation 日志与一个稳定幂等键，使外部工具副作用能在四个边界任一处崩溃后存活，再经由一个永不对已落地副作用重新执行的分层 outcome-query 契约进行对账 |
| 权威来源   | 本 ADR；RFC-0001 仍是架构权威                                                                                                                                         |
| 相关       | ADR-0012、ADR-0003、`@cantilune/syscall`、`@cantilune/tools`、`@cantilune/runtime`、`@cantilune/boot`                                                                 |
| 取代       | 无（扩展 ADR-0012 §observation-only recovery）                                                                                                                        |
| 被取代     | 无                                                                                                                                                                    |

## 背景

`docs/qa/0012-agent-execution-continuity-qa.md`（SS-03）记录了 exactly-once 缺口。对 `useTool`（`src/packages/syscall/src/act.ts:458`）的精确阅读确认了四个边界与未闭合窗口：

```
line 499:  toolExecutor.execute(toolName, args)     ← 副作用在此落地
            ═══ 边界 2：post-side-effect / pre-output ═══  （未闭合）
line 521:  contentStore.put(execResult.output)       ← 输出变为持久
            ═══ 边界 3：post-output / pre-receipt ═══      （未闭合）
line 525:  createObservationRecovery(...)            ← 回执变为持久（contentStore.put）
            ═══ 边界 4：post-receipt / pre-observation ═══ （部分闭合：retryToolObservation）
line 537:  runtime.observe(...)                      ← observation 持久
```

现有恢复路径（`retryToolObservation`，`act.ts:570`）从**边界 4** 开始：`validateObservationRecovery`（`:606`）将 content-addressed 回执对照 caller、tool、arguments digest 与 output ref 校验，然后重新 observe 而不重新执行。这在输出**与**其回执都持久之后就其可靠性而言是健全的。它不覆盖：

- **边界 1（pre-dispatch）**：在 `toolExecutor.execute` 之前没有日志条目，故崩溃后没有记录表明一个副作用曾被 _尝试_——run 无法区分"从未 dispatch"与"已 dispatch、副作用已落地、输出丢失"。
- **边界 2（post-side-effect/pre-output）**：executor 已返回，副作用已进入世界，但 `contentStore.put` 尚未发生。重启时 run 重新 dispatch，副作用再次触发。
- **边界 3（post-output/pre-receipt）**：输出持久但回执不持久。`retryToolObservation` 无法对账，因为没有回执可校验，故 run 重新 dispatch。

`AbortSignal` 与 `maxTimeMs`（依 QA 包）无法安全地抢占一个已在运行的调用——抢占会留下一个未 observe 的迟到副作用。故预算不是在飞工具的硬墙上时钟上限；正确的闭合是幂等 outcome 对账，而非取消。

Owner 之前的决定（本对话）将方法设为 **"分层契约" (tiered contract)**：不同工具类（只读 vs. 有副作用）获得不同对账义务，而非一种统一机制。一个在边界 2 崩溃的只读工具可直接重新 dispatch（无副作用可加倍）；有副作用工具必须在重新 dispatch 前经由 outcome-query 对账。

## 决策

以一个持久 pre-invocation 日志、一个稳定 executor 幂等键与一个分层 outcome-query 契约闭合 exactly-once 缺口。四个边界各有定义的恢复。当副作用已落地且可观察时，不重新执行任何工具。

### 1. 稳定幂等键

工具调用的幂等键是元组 `(principal, toolName, argumentsDigest, originalToolCallId)`，这恰好是 `validateObservationRecovery` 已校验的身份（`act.ts:652-659`）。该键跨崩溃稳定，因为：

- `principal` 是绑定 actor（在 durable world 中存活）。
- `toolName` 与 `argumentsDigest` 来自规范化 args（`canonicalToolArguments`，`act.ts:260`），是确定性的。
- `originalToolCallId` 是 LLM 提供的 call id，持久化在 group 边界处的私有 history checkpoint 中（ADR-0012）。

该键在 dispatch **之前**计算并写入 pre-invocation 日志，故即使 executor 永不返回它也存在。

### 2. 持久 pre-invocation 日志（闭合边界 1）

在 `toolExecutor.execute` 运行前，`useTool` 写入一个 **pre-invocation 日志条目**，记录幂等键与 dispatch 意图，持久地。日志位于 content store（输出与回执已使用的同一 content-addressed 权威），作为一种新回执类型：`tool-invocation-intent@1`。

- 条目携带：principal、toolName、originalToolCallId、argumentsDigest、`dispatchedAt`（提交时间戳）与状态 `dispatched`。
- 它经由 `contentStore.put` 写入，使用专用 MIME 类型与 creator tag，与现有 observation 回执完全一致（`createObservationRecovery`，`act.ts:346`）。
- 在新的 `useTool` 调用上、dispatch 之前，run **查询日志**以寻找该幂等键。若存在 `dispatched` 或 `completed` 条目，run 不盲目 dispatch——它转入 outcome-query（§4）。这是"永不重新执行已落地副作用"守卫。

这使得边界 1 可恢复：pre-dispatch 崩溃后，日志无条目（dispatch 从未发生）且 run 安全重新 dispatch；post-dispatch/pre-return 崩溃后，日志有 `dispatched` 条目且 run 对账而非重新 dispatch。

### 3. 分层 executor 契约（"分层契约"）

并非所有工具需要相同的对账。executor 声明其层级，`useTool` 据此对账。以可选 `reconcile` 与 `tier` 声明扩展 `ToolExecutor`（`syscall.ts:166`）：

- **Tier 0 —— 只读**（`tier: "read"`）：工具无副作用（如 `read_content`、纯 MCP 查询）。任一边界崩溃由重新 dispatch 闭合——无副作用可加倍。日志条目仍写入以提供可观察性并抑制重复 audit observation，但 run 可安全地再次调用 `execute`。
- **Tier 1 —— 幂等副作用**（`tier: "idempotent"`，带 `reconcile`）：工具有副作用但支持 outcome-query（如按 args digest 键的文件写、带 request id 的 MCP 调用）。崩溃后 run 调用 `reconcile(key)` _而非_ `execute`。若 reconcile 返回先前输出，run 复用它（与成功 execute 相同）；若 reconcile 返回 "unknown"，run 在知道先前副作用未落地（或 executor 确认幂等性使重新 dispatch 安全）的情况下重新 dispatch。这是文件/shell/带-request-id MCP 层。
- **Tier 2 —— 非幂等副作用**（`tier: "non-idempotent"`）：工具有副作用且无 outcome-query。run 在输出不可持久恢复的 `dispatched` 日志条目后**不得**重新 dispatch。重启时，run 将该调用报告为 `ambiguous`——副作用可能已落地——并将其作为类型化失败呈现，要求操作者决定，而非静默重新执行。这是无幂等性的 shell 命令、任意会 mutate 的 MCP 工具等的层级。操作者 runbook（而非代码）解决歧义。

现有 executor 被分类：`read`/`list` 风格工具 → Tier 0；`write`/`shell` 带稳定路径 → Tier 1；未知 MCP 工具 → 默认 Tier 2（fail safe）。未声明 tier 的工具默认 Tier 2（最小权限：假设其非幂等）。

`ToolExecutor` 接口声明单一 `tier`（executor 的 fail-safe 默认）加上可选 `tierFor(toolName)`，使服务混合层级工具的 executor——filesystem executor 同时服务 `read_file`（Tier 0）与 `write_file`/`edit_file`（Tier 1/2）——可按工具分类。syscall run 在按层级分支之前解析 `tierFor(toolName) ?? tier ?? "non-idempotent"`。

内置 executor 如下声明（`@cantilune/tools`）：

| Executor / tool                                                                                             | Tier             | `reconcile`                   |
| ----------------------------------------------------------------------------------------------------------- | ---------------- | ----------------------------- |
| `filesystem_read_file`、`filesystem_list_directory`、`filesystem_search_files`、`filesystem_search_content` | `read`           | 不适用（重新 dispatch）       |
| `filesystem_write_file`                                                                                     | `idempotent`     | `reconcile → unknown`（见注） |
| `filesystem_edit_file`                                                                                      | `non-idempotent` | 无（重新 dispatch 不安全）    |
| `shell_run_command`                                                                                         | `non-idempotent` | 无                            |
| `web_search`、`web_fetch`                                                                                   | `read`           | 不适用（重新 dispatch）       |
| 任意 `mcp_*` 工具                                                                                           | `non-idempotent` | 无（未知远端副作用）          |

`filesystem_write_file` 按内容幂等（向同一路径写同一内容是 no-op），故崩溃后重新 dispatch 安全。ADR-0016 幂等键只携带 args 的 digest，不携带 args 本身，故 `reconcile` 无法从键重新推导目标路径/内容以确认"已写入"；因此它报告 `unknown` 且 run 重新 dispatch，这是一个 no-op 覆盖。Tier 1 声明仍重要：它记录重新 dispatch 安全，与 `filesystem_edit_file`（Tier 2）形成对比，后者的重新 dispatch 不安全（第二次 edit 因 `oldString` 已不存在而失败）。`filesystem_edit_file` 无 outcome query 且不得重新 dispatch。

### 4. Outcome-query / reconcile 协议（闭合边界 2 与 3）

`useTool` 获得崩溃后的 reconcile-first 路径：

1. 计算幂等键。
2. 查询日志以寻找该键的 `dispatched` 条目。无条目 → 安全 dispatch（边界 1 干净侧）。
3. 存在 `dispatched` 条目 → 调用 `executor.reconcile(key)`（或按层级分支）：
   - Tier 0：重新 dispatch（无副作用可加倍）。
   - Tier 1：若 reconcile 返回先前输出，复用它；若 "unknown"，重新 dispatch（executor 确认幂等性使重新 dispatch 安全）。
   - Tier 2：不重新 dispatch；报告 `ambiguous`，要求操作者解决。
4. 在成功 dispatch（或已对账输出）后，写入输出 + observation 回执（现有边界 4 路径）并为可观察性写入 `completed` 日志条目。

这闭合边界 2（post-side-effect/pre-output）：reconcile 查询询问 executor 副作用是否已落地并在已落地时返回输出。它闭合边界 3（post-output/pre-receipt）：可发现的 `dispatched` 条目驱动 reconcile，后者返回先前输出；回执从已对账输出重建。边界 4（post-receipt/pre-observation）仍由现有 `retryToolObservation` 路径闭合，该路径由 `useTool` 返回的 observation-recovery handle 驱动。

#### 设计更正（2026-08-14）：移除 `completed`-reuse 路径

§4 步骤 3 的原始草稿写道"状态为 `completed` 且输出持久的条目 → 复用输出，重新 observe。"该路径在 content-addressed store 上**不可实现**，已被移除；`dispatched` 条目是唯一可发现的恢复 artifact。推理在此记录以免缺口被重新引入：

- `dispatched` 日志条目携带**无** `outputRef`（写入时输出尚不存在），故其 content-addressed ref 仅为 `(key, "dispatched")` 的函数，崩溃后**可从幂等键发现**。这是 `useTool` 执行的恢复查找。
- `completed` 日志条目**确实**携带 `outputRef`（它记录哪个输出被产生），故其 content-addressed ref 为 `(key, "completed", outputRef)` 的函数，**不能**仅从键发现——崩溃后 caller 不知道 `outputRef`。
- content-addressed store 将每个 blob 放在 `sha256(blob bytes)`；不存在"将此 blob 存于任意地址"的操作，且未引入新 API。因此携带 `outputRef` 的 blob 不能被排除 `outputRef` 的 ref 寻址。任何"按键查找 completed 条目"的路径因此是无法匹配的死代码：它已从 `useTool`（`reuseCompletedOutput`）中移除。
- 恢复在没有它的情况下仍正确收敛：
  - **Tier 0（read）**：发现 `dispatched` 条目，工具无副作用，run 重新 dispatch。
  - **Tier 1（idempotent）**：发现 `dispatched` 条目，`reconcile(key)` 返回先前输出，run 复用它而不重新执行。一次干净的已完成重启以同样方式恢复。
  - **Tier 2（non-idempotent）**：发现 `dispatched` 条目，run 无法仅从键证明副作用是否落地，故它报告 `ambiguous` 且不重新 dispatch。对于一次*确实*完成的调用，这是 fail-safe hold：操作者经由 `retryToolObservation`（从 audit-tail observation-recovery handle 驱动，而非从键查找）或带外解决持久输出。这是诚实的——runtime 不能安全地自动复用一个它无法证明已完成的非幂等副作用。
- `completed` 日志条目仍被**写入**（在输出持久后）以提供可观察性与审计；它只是不是恢复查找目标。

### 5. AbortSignal 穿线（"无法安全抢占"的承认）

`AbortSignal` 与 `maxTimeMs` 继续约束 LLM 等待并防止 _迟到 dispatch_（在预算过期后调度的工具调用）。本 ADR **不**声称它们抢占在飞 executor。executor 可接受 `AbortSignal` 以停止等待结果，但停止等待不撤销副作用。abort 后，日志条目保持 `dispatched`，且该键的下一次 `useTool` 调用对账而非重新 dispatch。这是诚实模型：预算约束等待，不约束副作用；副作用由对账约束。

## 考虑过的备选方案

- **统一重新 dispatch 并按幂等键去重**：否决。它对 Tier 0 正确，且仅当 executor 真正幂等时对 Tier 1 安全；对 Tier 2 它加倍非幂等副作用。Owner 选择分层契约正是因为统一规则对触发 SS-03 的有副作用工具不安全。
- **content store 之外的独立持久调用日志**（专用日志文件）：否决。它会在 content-addressed 回执旁引入第二工具调用身份权威，分裂完整性模型。content store 已是输出与回执的权威；日志也位于其中，故一个 content-addressed 完整性校验覆盖全部三者。
- **取消作为闭合**：否决。`AbortSignal` 不能撤销副作用；将取消视为 exactly-once 闭合是 SS-03 指出的错误前提。闭合是对账，不是抢占。
- **崩溃时总是重新 dispatch，让 executor 去重**：否决。它将一个正确性不变量（永不加倍副作用）卸载到每个 executor，包括不受信 MCP 工具，且无强制。Tier 2 的 fail-safe `ambiguous` 报告将不变量保持在 runtime 中。

## 迁移与验证

本 ADR 增加一个新 content 回执类型（`tool-invocation-intent@1`）与 `ToolExecutor` 上的可选 `tier`/`reconcile`。它不改变现有 observation 回执类型或现有 `retryToolObservation` 契约；它扩展它们。未声明 tier 的现有 executor 默认 Tier 2（fail safe），故现有接线在 executor 选择加入 tier 前行为不变。

### 四个边界处的崩溃测试（解除门禁）

在四个边界的每一个处进行真实崩溃测试（跨进程，如同 SS-02 epoch 崩溃测试），使用一个带记录副作用的 Tier-1 executor：

1. **Pre-dispatch 崩溃**：在日志查询后但在 `execute` 前 kill 进程。重启时无 `dispatched` 条目；run dispatch；副作用恰好落地一次。
2. **Post-side-effect/pre-output 崩溃**：executor 应用副作用并返回，但在 `contentStore.put` 输出前进程被 kill。重启时日志有 `dispatched`；`reconcile(key)` 返回先前输出（executor 按幂等键记录了它）；run 复用它；副作用不重复。
3. **Post-output/pre-receipt 崩溃**：输出持久但 observation 回执不持久。重启时可发现的 `dispatched` 日志条目存在；Tier-1 executor 的 `reconcile(key)` 返回先前（持久）输出，run 复用它并重建回执；不重新 dispatch。（`completed` 条目不能从键发现——见"设计更正"；`dispatched` 条目驱动恢复。）
4. **Post-receipt/pre-observation 崩溃**：回执持久但 observation 不持久。重启时 `retryToolObservation` 校验回执并重新 observe；不重新 dispatch。（此边界已闭合；测试证明它在新流程中存活。）

加一个 Tier-2 测试：非幂等 executor 在 post-side-effect/pre-output 崩溃报告 `ambiguous` 且不重新 dispatch。

### 覆盖率门禁

新单元测试：日志写/查询、每层 reconcile-first 路径、Tier-2 `ambiguous` 报告、日志抑制重复 observation 路径。覆盖率须达到仓库 L2–L7 阈值（语句/函数/行 ≥90%，分支 ≥88%），针对 `@cantilune/syscall` 与 `@cantilune/tools`。

## 解除映射

| SS-03 解除条件                        | 闭合方式                                                                      | 节   |
| ------------------------------------- | ----------------------------------------------------------------------------- | ---- |
| 持久 pre-invocation 日志              | `execute` 前写入 `tool-invocation-intent@1` 条目                              | 2    |
| 稳定 executor 幂等键                  | `(principal, toolName, argumentsDigest, originalToolCallId)`，dispatch 前计算 | 1    |
| Outcome-query 契约                    | 从 `dispatched` 日志条目到达 `executor.reconcile(key)`                        | 4    |
| pre-dispatch 崩溃测试                 | 边界 1 测试                                                                   | 验证 |
| post-side-effect/pre-output 崩溃测试  | 边界 2 测试（Tier-1 reconcile）                                               | 验证 |
| post-output/pre-receipt 崩溃测试      | 边界 3 测试（`dispatched` 条目 + Tier-1 reconcile(known) 复用输出）           | 验证 |
| post-receipt/pre-observation 崩溃测试 | 边界 4 测试（现有 retry，在新流程中证明）                                     | 验证 |
| 取消不是闭合                          | AbortSignal 仅约束等待；对账约束副作用                                        | 5    |

全部解除条件均已涉及，并将在本 ADR 从 Proposed 转为 Accepted 之前由四个边界崩溃测试提供证据。

## 批准

**Owner 设计批准**：Joker-of-Gotham —— 2026-08-14（设计已批准；实现已落地并变绿 —— 四边界跨进程崩溃测试通过，覆盖率门禁 EXIT=0）
**状态**：Proposed。Acceptance 另需独立架构 + 安全评审人签署（QA-L5 出口语门禁）。Owner 即 DRI（COI）；独立评审须由非 DRI 外部评审人签署。
