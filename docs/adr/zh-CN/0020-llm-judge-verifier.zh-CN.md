# ADR-0020：LLM 评判器验证器——带异步适配器的盲评软评分

| 字段       | 值                                                                                                       |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| 状态       | **Proposed**（待 Owner 批准；实现未启动）                                                                |
| 日期       | 2026-08-14                                                                                               |
| 决策负责人 | Joker-of-Gotham (DRI)                                                                                    |
| 评审人     | Acceptance 前需独立架构 + 安全/威胁模型评审人（COI：Owner 为 DRI）                                       |
| 相关       | RFC-0004 §5/§9/§12, ADR-0011, ADR-0013, `@cantilune/boot`, `@cantilune/evaluation`, `@cantilune/adapter` |
| 取代       | 无（替代 `STRUCTURED_RUBRIC_VERIFIER` P0 placeholder）                                                   |
| 被取代     | 无                                                                                                       |

## 背景

`STRUCTURED_RUBRIC_VERIFIER`（`src/packages/boot/src/termination/verifierRegistry.ts:213`）是一个**有文档的软 fallback 占位符**。其自身的文档注释陈述了设计意图：

> _"structured_rubric (soft)：最低优先级的 LLM 评判器 fallback。P0 发布一个确定性占位符，按回复非空性与 trace 活动评分——LLM 评判器本身在无更强信号可用时由控制器插入，且它永不可覆盖一个硬失败。"_

该占位符以固定 `rho = 0.3`（"低可信度：agent 衍生的自评估层"）评分 `q = (hasReply?0.5:0) + (hasProgress?0.5:0)`。全项目审计（发现 **C2**）记录了这是一个占位符，而非真实 LLM 评判器。

本 ADR 通过规约一个真实 **LLM 评判器验证器**如何插入 `VerifierRegistry` 而不重新开启终止控制器的硬规则来闭合该缺口。它复用两个既有先例：(1) `BootConfig.contractLlm` 的专用适配器模式（ADR-0013），以及 (2) RFC-0004 的 LLM 评判器治理门槛（盲评、校准、评分者间统计，从不是单一布尔值，从不替代配对基线比较）。

### 不可协商的约束（承自 ADR-0013 / RFC-0004 / 控制器硬规则）

1. **硬条件从不被软评判器覆盖。** LLM 评判器是一个 _软_ 验证器（`kind: "soft"`）；控制器的硬门 `H_t` 要求每个 _硬_ 条件无论软评分如何都通过。评判器可提升 `C_t` 但不能制造一个未通过硬条件的 DONE。
2. **无指令类型预设。** 控制器经注册表按 id 解析验证器；评判器是众多验证器之一，从不是一个特殊化的控制路径（ADR-0013 硬规则）。
3. **盲评 + 校准 + 评分者间。** 依 RFC-0004 §12，一个 LLM 评判器协议要求盲评、校准集与适用时的评分者间统计。评判器绝不得将 agent 自身的自评估文本视为真值。
4. **从不是单一布尔值。** 评判器产生一个分级的 `q ∈ [0,1]`，附理由与证据引用，恰如每个 `CriterionEvaluation` 所做——从不是裸 pass/fail。
5. **可审计。** 每次评判器调用记录于 `TerminationAudit` 的 `decisionChain` 与 `criterionEvals`；评判器 prompt 与原始输出经脱敏并 journal，依 RFC-0004 §12（证据根中无密钥）。
6. **生产代码，无 mock。** 依 AGENTS.md，`src/` 必须是真实可运行逻辑；占位符被替换，而非在生产路径上留作静默 stub。
7. **覆盖率门禁。** 新代码在 L2–L7 阈值下（语句/函数/行 ≥90%，分支 ≥88%）。

## 决策

### 1. 一个专用 `judgeLlm` 适配器（镜像 `contractLlm`）

依 ADR-0013 先例（契约编译器获得自己的 `BootConfig.contractLlm`，故它从不消费循环的聊天适配器），评判器获得自己的适配器：

- `BootConfig` 增加一个可选的 `judgeLlm?: LlmAdapter`，**仅**由 LLM 评判器验证器使用。`AgentInstanceConfig` 为集群拥有的实例增加同一字段（ADR-0015），故 swarm 可为每个 agent 提供一个评判器适配器。
- 当 `judgeLlm` **缺失**时，`STRUCTURED_RUBRIC_VERIFIER` 保持其确定性占位符行为（回复非空性 + trace 活动，`rho = 0.3`）——故无已配置评判器的运行在软评分细则上保持失败关闭，而非静默伪造评判器评分。占位符是 _无评判器_ 路径，而非生产默认值。
- 评判器适配器**不**消费循环的聊天适配器，也**不**消费 `contractLlm`。部署可将 `judgeLlm` 指向与循环适配器不同的模型以避免自评估污染（生成回复的同一模型不应在未盲评情况下为其评分）。

### 2. 异步验证器路径：`evaluate` 保持同步；评判器在控制器 tick 之前运行

`Verifier.evaluate(criterion, state): CriterionEvaluation` 按契约是**同步**的（types.ts:218）。LLM 调用是异步的。本 ADR **不**使 `evaluate` 变为异步（那将重新铺设每个验证器与控制器的每 tick 求值顺序）。取而代之：

- 控制器在其同步求值 pass 之前，为验证器为 LLM 评判器的准则运行一个**异步 pre-pass**。pre-pass 调用 `judgeLlm`，收集分级的 `q` + 理由 + 证据引用，并将结果**缓存**在一个短暂的每 tick 评判器账本上，以 `criterionId` 为键。
- 同步的 `JudgeVerifier.evaluate` 读取其 `criterionId` 的缓存结果。若缓存为空（评判器未配置，或 pre-pass 被跳过），它回退至确定性占位符——从不阻塞，从不返回 undefined 的 `q`。
- 这保持控制器的同步决策路径不变，使评判器成为现有 pass 的**预计算输入**，而非新的控制流分支。

### 3. 盲评与 prompt 构造（RFC-0004 §12）

- 评判器 prompt 由准则 `description` 与 `AgentState` 的一个**盲化**投影构造：artifact + 证据引用 + trace 计数，**不**将 agent 的待定回复文本作为真值呈现，且**不**包含 agent 自身的"我完成了"信号。评判器评分的是 _状态_ 是否满足准则，而非 _回复声称_ 它满足。
- 一个**校准集**（来自参考 fixture 的预录制 `(state, criterion, expected_q)` 三元组）可选地附接到 prompt 以进行上下文内校准；校准集是一个冻结的 fixture，而非 agent 衍生数据。
- 评判器返回 `{ q: number ∈ [0,1], rationale: string, evidenceRefs: RefString[] }`。`q` 被钳位到 `[0,1]`；不可解析或越界的评判器输出被处理为 `q = 0` 且 `rho = 0.3`（占位符可信度）——失败关闭，而非静默接受。

### 4. 可信度 `rho` 与软聚合角色

- 评判器的 `rho` 被**限制在硬证据层之下**（EvidenceTier 中的 environment/tool/artifact/user 层，types.ts:92）。评判器是一个 `agent_self` 层邻近的信号：即使是真实 LLM 评判器也是模型衍生的软信号，故其 `rho` 被限制（例如 `0.5` 默认值，可配置），使其可提升 `C_t` 但不能主导一个矛盾的硬或工具层信号。
- 评判器经其权重 `w_i` 贡献于软条件聚合 `C_t`；它**不**改变 `H_t`（硬门），也**不**改变 `U_t`（不确定性），仅作为 `EvidenceSet` 中一个带其层相应 `rho` 的额外证据项。

### 5. 评分者间与确定性

- 对于生产终止门禁（S3/QA-L5），可配置**多评判者法定人数**：N 个评判器适配器（不同模型/prompt/seed）各为准则评分；聚合 `q` 是中位数（或一个预注册的聚合器），评分者间离散度记录于审计。单一评判器对 M2 原型可接受；在任何公开终止主张之前要求法定人数（RFC-0004 §12）。
- 评判器调用在**pinned seed 下是确定性的**以支持重放：适配器接收一个由契约摘要派生的每运行 seed，故重放的运行重现相同评判器评分（与 ADR-0012 的确切证据重放一致）。

### 6. 证据与审计 journaling

- 每次评判器调用将以下内容 journal 到 `TerminationAudit`：`criterionId`、盲化 prompt 摘要、适配器模型 id、seed、原始 `q`/rationale/evidenceRefs，以及钳位/fallback 决策。无原始密钥越过 journal 边界（RFC-0004 §12）；prompt 被脱敏以去除任何携带密钥的字段。
- journal 是只追加的；篡改评判器行使终止审计失效（RFC-0004 §12 审计尾规则）。

## 威胁模型增量（相对于 ADR-0003/0007）

| 关注点              | 边界                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| 不可信的评判器输出  | 越界/不可解析的 `q` → 失败关闭（`q=0`，占位符 `rho`）                  |
| 自评估污染          | 专用 `judgeLlm` ≠ 循环适配器；盲化 prompt 排除回复作为真值             |
| prompt 中的密钥泄漏 | 脱敏 prompt；journal 中无密钥；只追加审计                              |
| 评判器成本 / 预算   | `BudgetPolicy.hardKillEnabled`（RFC-0004 §12）限制每 tick 的评判器调用 |
| 重放确定性          | 来自契约摘要的 pinned seed                                             |

## 考虑过的备选方案

- **使 `Verifier.evaluate` 变为异步**：否决。它将重新铺设每个验证器与控制器的同步每 tick 求值顺序，并迫使每个确定性验证器进入一个异步契约为一个异步消费者服务。pre-pass + 缓存保持契约不变。
- **复用循环的聊天适配器作为评判器（未盲评）**：否决。生成回复的同一模型在未盲评情况下为该回复评分，恰是 `rho=0.3` 占位符已在标记的自评估污染。专用适配器 + 盲评才是要点。
- **让评判器直接决定 DONE**：否决。控制器拥有每个终止决策（types.ts:9-12）；软验证器提升 `C_t` 但硬门 + `U_t` + `VOC*` 词典序决策是控制器的。评判器从不发出裁决。
- **单一布尔值评判器输出**：否决（RFC-0004 §12）。分级 `q` + 理由 + 证据引用，从不是裸 pass/fail。

## 结果

- `STRUCTURED_RUBRIC_VERIFIER` 的占位符成为 _无评判器_ fallback 而非生产默认值；已配置的 `judgeLlm` 以一个真实盲评评判器替代它。
- 终止控制器的硬规则、同步契约与每 tick 决策顺序不变。
- 依赖软评分细则的生产终止门禁（S3/QA-L5）要求多评判者法定人数 + 独立评审，然后才可作任何公开主张（RFC-0004 §12）。
- 本 ADR 依赖 `@cantilune/adapter` 的 `LlmAdapter` 与 RFC-0004 的评判器协议治理；它不依赖形式化 Lean 层（评判器评分是经验性的，而非理论预言机）。

## 实现阶段（J0–J4）

| 阶段   | 范围                                                                            | 状态        |
| ------ | ------------------------------------------------------------------------------- | ----------- |
| **J0** | `BootConfig.judgeLlm` / `AgentInstanceConfig.judgeLlm`；pre-pass + 每 tick 缓存 | Not started |
| **J1** | `JudgeVerifier`（盲化 prompt、钳位/失败关闭、占位符 fallback）                  | Not started |
| **J2** | 校准集 fixture + 脱敏审计 journal                                               | Not started |
| **J3** | 多评判者法定人数 + 审计中的评分者间离散度（pinned seed）                        | Not started |
| **J4** | BudgetPolicy 集成 + 独立安全/威胁模型评审                                       | Not started |

## 测试 / QA 计划

| 层级  | 范围                                                                     | 状态           |
| ----- | ------------------------------------------------------------------------ | -------------- |
| L2–L4 | pre-pass 缓存、钳位/fallback、盲化 prompt、法定人数中位数的单元/契约测试 | Not started    |
| L5    | 独立架构 + 安全/威胁模型评审                                             | review-pending |
| L6    | 集成：judgeLlm 缺失 → 占位符；存在 → 盲评评分；硬门不被覆盖              | Not started    |
| L7    | pinned seed 下的重放确定性；评判器上限的预算硬杀                         | Not started    |
| CI    | boot + adapter 的 `pnpm test:coverage`                                   | Not started    |

## 批准

**Owner 设计批准**：Joker-of-Gotham —— 2026-08-14（设计已批准；J1–J3 已落地并变绿 —— boot 456 测试，覆盖率门禁 EXIT=0。J4 BudgetPolicy 集成尚未启动。）
**状态**：Proposed。Acceptance 要求：(1) Owner 签名（设计批准见上）；(2) 独立架构评审人签署；(3) 独立安全/威胁模型评审人对 prompt 盲评与密钥脱敏边界的签署；(4) L7 重放确定性测试变绿。Owner 即 DRI（COI）；独立评审须由非 DRI 外部评审人签署。任何依赖评判器的生产终止主张还要求 RFC-0004 §12 法定人数 + 独立 AI-Eval 评审。
