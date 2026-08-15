# ADR-0017：Petri 网点火引擎与可达性/不变量分析

| 字段       | 值                                                                                     |
| ---------- | -------------------------------------------------------------------------------------- |
| 状态       | **Proposed**（待 Owner 审查；解除 QA-0012 CLI #4 中 petri 子项）                       |
| 创建时间   | 2026-08-14                                                                             |
| 决策 Owner | Joker-of-Gotham                                                                        |
| 实现 DRI   | Codex 实现团队                                                                         |
| 审查人     | 独立架构与安全审查待进行（QA-L5 出口门禁）                                             |
| 摘要       | 在 `@cantilune/petri` 新增一个无依赖的 Petri 网点火引擎，使 `/petri fire               | reach | invariants`执行真正的 token 游戏语义，而非装饰性的前后对比；复用 PNML 导出器已有的`PetriNet` 结构类型 |
| 权威来源   | 本 ADR；RFC-0001 仍是架构权威                                                          |
| 相关       | ADR-0001、ADR-0011、`@cantilune/conformance`（Petri 语义摘要验证器）、`@cantilune/cli` |
| 取代       | 无（本 ADR 取代的是 PetriView 的装饰性 dry-run，而非某个 ADR）                         |
| 被取代     | 无                                                                                     |

## 背景

CLI 的 `/petri` 族（`src/packages/cli/src/views/PetriView.tsx`、`petriCommands.ts`）当前将运行时快照投影为一个**结构性** Petri 网——库所取自 artifact/capability，变迁取自观测到的 `operationTypeId`，弧按索引编织——然后渲染一个**装饰性**"点火"：总是消费第一个 marking，以及一个**静态**可达性表，仅回显 `enabled: markings.length > 0`。`/petri fire` 输出标注为"After (simulated)"，可达性/不变量视图伪造 token 移动而非执行 token 游戏语义。这违反了禁止伪造/禁止装饰性桩的原则：不按弧结构消费并产出 token 的 Petri"点火"不是点火。

PNML 导出器（`src/packages/cli/src/render/pnmlExporter.ts`）已承载一个最小 `PetriNet` 结构类型（`{ places, transitions, arcs }`），`/export petri` 在用。conformance 包（`@cantilune/conformance`、`petriVerifier.ts`）承载**语义** Petri 证据族（`PetriSemanticEvidence = { declarationDigest, markingDigest, firingDigest, registryDigest }`）以及一个摘要验证器，它从这四个摘要重算投影摘要。但整个 monorepo 中**不存在点火引擎**：没有任何东西消费一个 `PetriNet` + 一个 `Marking` 并产出下一个 marking、使能集、可达性轨迹或库所不变量。ADR-0017 闭合这个缺口。

Petri 网是协调图之上的**只读分析透镜**（依 ADR-0001 §formal structure）：它从不变更运行时世界，也不是控制面。点火是 CLI 自身内存中的 token 游戏仿真；运行时对状态的权威不受影响。这使得执行器落在 CLI 的只显示安全边界内，同时让它成为**真实**而非装饰性的。

## 决策

### 1. 新增 `@cantilune/petri` 包，无依赖

新增工作区包 `src/packages/petri` 容纳点火引擎与分析。它仅依赖 `@cantilune/core`（取 monorepo 已在用的 `Brand`/`ContentDigest` 原语）。它**不**依赖 `@cantilune/cli`、`@cantilune/runtime` 或 `@cantilune/conformance`，因此引擎可独立测试，且可被 conformance 摘要路径复用（该路径需要基于真实点火序列的 `firingDigest`，而非装饰性序列）。

结构性 `PetriNet` 类型（`{ places, transitions, arcs }`）被**复用**——从 PNML 导出器再导出，使 `/export petri` 与 `/petri fire` 共用同一定义。引擎新增导出器从未需要的动态类型：

| 类型                | 角色                                                          |
| ------------------- | ------------------------------------------------------------- |
| `Marking`           | `ReadonlyMap<PlaceId, number>`——token 分配                    |
| `ArcDirection`      | `"in"                                                         | "out"`——由 `arc.source`/`arc.target` 归属派生 |
| `EnabledTransition` | `{ transition, consumes, produces }`——输入弧皆有 token 的变迁 |
| `FireResult`        | `{ ok, nextMarking, firedTransition }`——一次点火的产出        |

### 2. 点火语义（token 游戏）

`fire(net, marking, transitionId, binding?)`：

1. 按 id 解析变迁。缺失则拒绝。
2. 将弧划分为输入弧（target = transition）与输出弧（source = transition）。source 与 target 同为该 transition 的弧作为自环被拒绝——会消费并产出同一库所；带抑制/重置弧的网超出范围（见 §6）。
3. **消费**：对每条输入弧，该库所须持 `≥ 1` token；按输入弧减 1。若任一输入库所 token 不足，则该次点火**禁用**——返回 `ok: false`，不产生部分变更。
4. **产出**：对每条输出弧，目标库所加 1 token。
5. 以新 `Marking`（不可变副本）返回**下一 marking**。输入 marking 永不被变更。

`enabledTransitions(net, marking)` 返回其输入弧皆可满足的每个变迁——`/petri transitions` 视图列出、`/petri reach` 展开的集合。无输入弧的变迁恒使能（源变迁），符合标准 Petri 语义。

可选的 `binding`（`Record<string, string>`）为参数化变迁的前向兼容而接受，但当前为透传空操作：引擎点火的是库所/变迁（PT）网，非着色网。CLI 接受该参数以保持命令面稳定；引擎记录该空操作以免其成为静默伪造。

### 3. 可达性（有界 BFS）

`reachable(net, initialMarking, goal, { maxSteps })` 自初始 marking 执行有界广度优先搜索：在每个深度点火所有使能变迁，直至 goal 谓词匹配或 `maxSteps` 耗尽。可达则返回点火轨迹（`{ marking, firedTransition }[]`），否则返回 `undefined`。该上界为必填（默认 50），使分析成为全函数——CLI 永不进入无界循环。`goal` 为 `Marking` 之上的谓词，故 `/petri reach` 可指向"某库所持 token ≥ N"，而非仅精确 marking。

由于给定变迁选择下点火是确定性的，且投影出的运行时网状态空间很小（少量 artifact/capability 库所），BFS 开销低，在上界内良好终止。可达轨迹渲染为步骤表；死 marking（无使能变迁、goal 未达）被显式报告，让用户看到真实裁决而非静默空表。

### 4. 库所不变量（S-不变量）

`placeInvariants(net)` 从网的结构关联矩阵计算库所不变量（S-不变量）候选。PT 网的关联矩阵为 `A = (a_ij)`，其中 `a_ij = (#从 t_j 到 p_i 的出弧) − (#从 t_i 到 p_j 的入弧)`。库所不变量是满足 `xᵀA = 0` 的向量 `x ≥ 0`——保 token 的加权和。引擎通过对整数关联矩阵的标准零空间归约计算非负整数库所不变量的**基**，将每个不变量报告为 `{ places, weights }`。当网全局保 token 时报告平凡的"每库所权重 1"不变量；当锁库所在所有变迁上出入度相等时，`write_lock ≤ 1` 类不变量自然得出。

这是基于网结构的真线性代数，非旧视图的 `place.includes("write_lock")` 子串检查。T-不变量（使网回到同一 marking 的变迁序列）仅在 BFS 发现回归环时报告为"变迁链非空"，否则为 `pending`。

### 5. CLI 接线——真实而非装饰

`/petri fire <op> [--bindings ...]` 成为**操作**：从运行时快照构建网（复用 PNML 导出器的投影），从当前 token 构建初始 marking，调用 `fire()`，将 before-marking 与真实 after-marking 一起 stash 到 `viewArgs`。视图渲染两个真实 marking 的 `DiffView`。点火成功时标签由"After (simulated)"变为**"After (fired)"**；不成功时变为**"After (disabled)"**并点名 token 不足的库所。`/petri transitions` 列出真实 `enabledTransitions` 集。`/petri reach <goal>` 运行有界 BFS，渲染真实轨迹或死 marking 裁决。`/petri invariants` 渲染计算出的 S-不变量基。

一个 `petriControl.ts` 接线模块（镜像 `clusterControl.ts`/`evalControl.ts`）从运行时构建网 + marking，向命令处理器暴露 `fire`/`enabledTransitions`/`reachable`/`placeInvariants`。运行时权威不受影响——网是只读投影；点火仅变更 CLI 内存中的 marking。

### 6. 超出范围

- **着色/时间/随机 Petri 网**：引擎点火的是普通库所/变迁网。着色绑定、时间与点火率语义为未来工作；`binding` 参数为稳定空操作。
- **抑制弧与重置弧**：引擎拒绝 source 与 target 同为该 transition 的弧（自环）。抑制弧（库所为空时点火）与重置弧（排空库所）会改变不变量代数，不纳入。
- **控制面集成**：点火永不提交到世界。未来某 ADR 可将点火衍生的 `firingDigest` 提升至 `PetriSemanticEvidence` 用于 conformance，但那是一个独立的、经审查的决策——本 ADR 交付引擎，不交付信任绑定。
- **无界可达性**：BFS 以 `maxSteps` 为上界。在无界网上真正判定可达性一般是不可判定的；上界是诚实的答案。

## 后果

- **正面**：`/petri` 为真——点火消费/产出 token，可达性是有界搜索，不变量由关联矩阵计算。CLI 不再伪造 token 移动。引擎可被 `@cantilune/conformance` 复用，若日后需要可计算真实 `firingDigest`。
- **负面**：新包增加构建/测试目标与覆盖率门禁（L2–L7 阈值适用）。可达性上界意味着某些 goal 被报告为"N 步内不可达"而非"不可达"——该裁决是有界可达性，这是诚实结果。
- **风险**：低。引擎为纯、无依赖、对运行时只读。唯一外部可观测变化是 `/petri fire` 现在诚实报告禁用变迁，而非总是消费第一个 marking。

## 批准

**Owner 设计批准**：Joker-of-Gotham —— 2026-08-14（设计已批准；实现已落地并变绿 —— petri 包 53 测试，覆盖率门禁 EXIT=0）
**状态**：Proposed。Acceptance 另需独立架构评审人签署（QA-L5 出口语门禁）。Owner 即 DRI（COI）；独立评审须由非 DRI 外部评审人签署。
