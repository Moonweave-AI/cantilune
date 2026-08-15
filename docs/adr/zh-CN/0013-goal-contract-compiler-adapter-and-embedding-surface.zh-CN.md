# ADR-0013：目标契约编译器适配器分离与嵌入接口

| 字段       | 值                                                                                  |
| ---------- | ----------------------------------------------------------------------------------- |
| 状态       | **Proposed**（已请求 Owner 审查）                                                   |
| 创建时间   | 2026-08-14                                                                          |
| 更新时间   | 2026-08-14                                                                          |
| 最后审查   | 2026-08-14                                                                          |
| 决策负责人 | Joker-of-Gotham                                                                     |
| 实现 DRI   | Codex 实现团队                                                                      |
| 评审人     | Joker-of-Gotham（DRI 临时架构）；安全审查待进行                                     |
| 摘要       | 为目标契约编译提供一个专用 LLM 适配器；将嵌入适配器设为可选的、可降级的传感器       |
| 权威来源   | 本 ADR；RFC-0001 仍是架构权威                                                       |
| 相关       | RFC-0001、ADR-0002、ADR-0012、`@cantilune/boot`（终止控制器）、`@cantilune/adapter` |
| 取代       | 无                                                                                  |
| 被取代     | 无                                                                                  |

## 背景

Goal Contract Math Termination Controller（P0）的 Phase B 落地了一个零训练、数学优先的控制器，替代 LLM 拥有的终止。该控制器评估完整状态 $x_t = (S_t, A_t, E_t, T_{\le t}, R_t)$ 并通过六状态机（DONE / CONTINUE / VERIFY / ASK_USER / REPLAN / STALLED）以词典序优先级驱动 agent 循环。LLM 被降级为三个非权威角色：目标分解、候选动作生成与决策解释。它从不拥有"我们完成了吗？"的裁决。

该控制器中有两个接口接缝需要显式架构记录，因为各自有一个非显然的正确性或计费后果，未来维护者可能悄然回退：

1. **目标契约编译复用一次 LLM 调用。** `GoalContractCompiler.compileContract` 每次运行通过向 LLM 发送一个结构化提示来起草一次验收准则。第一个实现将编译器接到驱动 agent 循环的同一 `LlmAdapter`。该共享有两种失败模式：
   - 在**测试**中，每个脚本化的 LLM 响应是一个按位置索引的序列。编译器在循环第一轮之前消费第一个响应，将每个后续响应移位一个。断言"第 N 轮看到响应 N"的测试悄然失效，而该失效看起来像是控制器逻辑失败而非适配器共享失败。
   - 在**生产**中，编译器每次运行增加一次计费 LLM 调用*到循环自身的延迟预算*，因为它复用循环的适配器及其连接/速率限制/计费封套。契约草案与 agent 轮是具有不同成本/延迟特征的不同工作；耦合它们使契约草案不可替代（你无法在同时降级循环的情况下将它指向更小/更快的模型）。

2. **语义残差引擎需要嵌入，但绝不依赖它们。** 该引擎在目标准则与证据/artifact 文本之间求解一个受约束的最优传输匹配。有 `EmbeddingAdapter` 时使用余弦相似度；无则降级为 Jaccard 回退。控制器的终止安全不得依赖于嵌入往返成功，故嵌入器是一个*可选语义传感器*，且适配器包必须暴露一种方法来构建一个干净降级（`undefined` → Jaccard）而非在提供商无嵌入接口时抛出的嵌入器。

设计契约中的硬性规则——**无指令类型预设 / 无硬编码**——同时治理两者：编译器不得依据指令文本来分支选择契约，嵌入器不得依据指令文本来分支选择模型。两个接缝都是类型驱动的，而非内容驱动的。

## 决策

### 1. 契约编译器获得一个专用适配器（`BootConfig.contractLlm`）

- `BootConfig` 增加一个可选的 `contractLlm?: LlmAdapter`，**仅**由 `GoalContractCompiler.compileContract` 使用。它从不转发给 agent 循环。
- 当 `contractLlm` **缺失**时，控制器**不进行任何 LLM 调用**即编译默认系统契约——它从不回退到循环的适配器。默认系统契约是每条指令的单一 `no_infinite_loop` 硬准则，由 `defaultSystemContract(instruction, frozenAt)` 以 `compiledBy: "system"` 编译。无指令类型预设：每条指令同一路径。
- `AgentInstanceConfig` 增加相同的 `contractLlm` 字段用于集群拥有的实例，使集群可将契约起草指向与循环不同的模型，而循环适配器无需知晓。
- 循环适配器与契约适配器是刻意分离的对象。将同一对象传给两者是合法的，但重新引入测试移位与计费耦合失败模式；契约不阻止它，文档不鼓励它。

### 2. 嵌入适配器是可选的、可降级的传感器（`createEmbedder`）

- `@cantilune/adapter` 导出 `createEmbedder(config, options?): EmbeddingAdapter | undefined`。
- 对于 `openai-compatible` 提供商（及任何自定义 `baseUrl` 回退），它返回一个针对 `POST {baseUrl}/embeddings`（`{ model, input }` → `{ data: [{ embedding }] }`）的真实嵌入器，复用聊天适配器的密钥解析与 `fetchWithRetry` 管道。
- 对于**无统一嵌入接口的原生**提供商（anthropic、google、bedrock），它返回 **`undefined`**——不抛出，也不选择某个厂商特定的嵌入路径。启动运行时将 `undefined` 透传给语义残差引擎，后者降级为 Jaccard。故终止安全从不以嵌入往返为条件。
- 嵌入器复用与聊天适配器相同的 `LlmConfig`（apiKey、baseUrl）；它**不**消费循环的聊天适配器，也不消费 `contractLlm`。
- 维度从第一个成功响应中惰性发现并通过 getter 暴露；在此之前报告 `0`。残差引擎容忍近似/零维度，因为它仅用于容量簿记，而非正确性。

### 3. `EmbeddingAdapter` 接口（boot）——不变

```ts
export interface EmbeddingAdapter {
  embed(texts: readonly string[]): Promise<readonly number[][]>;
  readonly dimensions: number;
}
```

`computeResidual(contract, state, embedder)` 将嵌入调用包裹于 `try/catch` 中；任何抛出回退至 Jaccard。这使嵌入器成为一个纯优化：可用时改善语义匹配，不可用时不可见。

## 结果

- **测试**：契约适配器在每个 boot 测试中为 `undefined`，故编译器不发出 LLM 调用，脚本化响应序列从循环第一轮开始。重复回复 / `stop != done` 回归测试可断言*数学结果*（一个单一且独特的纯文本回复满足默认契约 → `VOC* = -λ·cost_text - μ·risk_text ≤ ε` → DONE）而非硬编码停止启发式。
- **生产**：部署可将 `contractLlm` 指向更小/更快的模型以低成本起草契约，而不影响循环的模型或延迟。省略它是零配置默认值，仍产生一个安全（虽最小）的契约。
- **安全**：嵌入器复用聊天适配器的密钥解析——同一密钥、同一头路径，无新凭据面。`/embeddings` 携带与 `/chat/completions` 相同的 `Authorization` 头；无新密钥引入。
- **离线 / 原生提供商**：anthropic/google/bedrock 运行使用 Jaccard 残差，对于直接消除重复回复失败的 `no_infinite_loop` / `duplicate_reply` 验证器已足够。嵌入是对开放文本准则的精度改进，而非门禁。

## 考虑过的备选方案

- **为编译共享循环适配器（否决）。** 原始实现。它在测试中移位每个脚本化响应序列，并将契约草案计费耦合到循环延迟。失败模式是静默的且看起来像控制器 bug。分离严格更优。
- **`contractLlm` 缺失时回退到循环适配器（否决）。** 这在默认配置下保留了测试移位与计费耦合失败——恰是大多数用户运行的情形。默认必须是安全的、无 LLM 调用路径。
- **对无嵌入接口的原生提供商抛出（否决）。** 终止安全将取决于调用者捕获。契约要求嵌入器是一个可降级传感器；`undefined` → Jaccard 就是契约。抛出将使缺失嵌入接口成为 anthropic/google/bedrock 的硬运行时失败，这不可接受。
- **`createEmbedder` 内部的每厂商嵌入路径（否决）。** 会将适配器包耦合到每个原生厂商的嵌入 API，并要求每个厂商的指令无关模型选择。统一 `/embeddings` 接口是 OpenAI 兼容属性；原生厂商在单独 ADR 提出共享接口之前超出范围。

## 开放问题

- 是否稍后允许一个不同于聊天模型的专用嵌入提供商/模型（例如 anthropic 上聊天，openai-compatible 端点上嵌入）。今天即可行——手动构造 `EmbeddingAdapter` 并传给 `BootConfig.embedder`；在用户提出之前无需配置管道变更。
- `contractLlm` 是否应在 CLI 配置中默认为一个小型固定模型而非保持可选。推迟到 Phase 5 CLI 集成验证接线后。

## 合规性

本决策已实现并验证：

- `@cantilune/boot`：添加了 `BootConfig.contractLlm` 与 `AgentInstanceConfig.contractLlm`；`bootCantilune` 与 `AgentInstance.executeLoop` 将 `contractLlm`（而非循环适配器）传给 `createTerminationController`；缺失 → 无 LLM 调用 → 默认系统契约。
- `@cantilune/adapter`：添加了 `createEmbedder` + `createOpenAiEmbedder`；12 个单元测试通过；原生提供商返回 `undefined`。
- `@cantilune/boot` 测试：契约适配器分离后 341/341 通过。
- 无指令硬编码已验证：`decide()`、验证器与 VOC 估计器从不依据指令文本分支；"纯文本 → DONE"是一个代数结果，而非规则。
