---
title: 已被取代的 Cantilune 理论闭合 QA-L4 就绪快照
status: Superseded
risk: S2
quality_target: QA-L4
maturity: Pre-FCP/M1
owner: Joker-of-Gotham
---

> **已被取代的快照（2026-07-28）：**本文记录的是当前最大相容 D1-A
> 闭合之前的历史状态，不能作为现行 QA 评审包。其中的 job 数、obligation
> 数、缺口清单和 FMS 备选项只保留为时间线。现行替代文件是
> `../0002-theory-closure-proved-review-pending-2026-07-27.md`。替代文件仍将
> QA-L4、FCP 和 ADR 接受保持为待完成人工治理事项；严格区分 separated
> enriched-adjunction 分支与非分离 D1-A monad/domain 分支；actual-Agent
> 全抽象仅覆盖确定性的 typed tau/free-output prefix trie；更宽的 guarded
> 结果是 native-trace/contextual-Hoare；八个生产包均未实例化。

# 结论

Cantilune **尚未达到 QA-L4 完成**。本文是评审材料与门槛定义，不是评审
签字。有限控制操作理论已有较强的 kernel-checked 实现证据；但当前 RFC
仍把完整 FMS inhabitant 设为强制项。当前工作树已在所有 ωCPO 及连续
映射上构造真实的非分离 Hoare/lower Monad，并补齐 freshness-safe 的 input
与 bound-output action 商；但仍没有分离的 Abramsky free
pointed-semilattice powerdomain、递归 agent 域解、hiding/coherence 或按
进程对量化的全抽象。当前有限控制操作路线下，exact-name plug/hide 还存在
kernel-checked 的非空单位障碍。产品包尚未逐规则提供证书，也不存在不可变
commit 及三类独立评审。第一版 `ProductRuleAdmission.Certificate` 还不可居住：它要求同一
固定签名 `ExecutionPackage` 的一步既保持、又严格推进签名版本。因此它是
legacy 负面回归，不是当前可用于宣称产品闭合的通用接口。修正后的异构接口
、一个实质性固定 epoch P1c occurrence，以及通用
`CrossEpochProductFamily` 组合定理均已通过 kernel。但八个计划发行包均无
包源码树、规则清单或包所有的 rank/pre-net/resource/authorization/fairness/
正 ε 输入，因此目前没有任何生产产品包证书可实例化。

# 分类与理由

- 工作对象：形式理论实现与研究收敛。
- 风险：S2。错误的投影/反射、replay 或收敛结论会破坏核心架构，但本项
  工作不直接控制生产或具身系统。
- 目标：QA-L4。该结果是跨模型承重定理，包含机械数学、外部语义依赖与
  治理裁决。
- 成熟度：Pre-FCP/M1；RFC-0002 为 Draft，ADR-0001 为 Proposed。
- DRI：Joker-of-Gotham。
- 必须由三类非作者独立评审：
  1. 范畴论 / DPO / Petri；
  2. π 演算 / 域论；
  3. Lean kernel assumptions 与证据 provenance。

# 质量证据矩阵

| 领域 | QA-L4 必需证据 | 当前处置 |
|---|---|---|
| 范围与设计 | 英中 spec、RFC、ADR 对精确定理边界和假设一致 | 草案；FMS 边界仅 Proposed，未生效 |
| Free SMC | 等式商、范畴/SMC 律、泛比较与唯一性 | implemented_unverified |
| DPOI | exact-positional 等价、合法单态 complement、Van Kampen、concurrency | 在已刻画有限范围内 implemented_unverified |
| P1a | 每条 admitted 产品规则都有实质 DAG/Petri/态射证书 | legacy admission record 已由 kernel 证明不可居住，修正后的异构接口已 root-build；首个非恒等固定 epoch 产品 bundle 使用真实增加 `(0, 1)` 的 reconnect occurrence，携带独立 DAG/Petri/native-late-pi/态射业务推导、四源事件双射映射、全部目标步反射及精确 replay；生产产品包 inhabitant 仍缺失 |
| Open π SMC | 具名边界纪律、SMC 协调与 plug/hide 操作充分性 | presentation quotient 已有真实 mathlib Category/Monoidal/Symmetric 实例；原子 gate 携带互异类型化具名端口与精确擦除自由支撑；部分具名组合层检查 restriction、隐藏中间接口与 parallel 不相交。exact-name hiding 在非空边界拒绝左右单位复合，而 presentation identity 擦除为 raw zero 且无原生步。每个固定有限控制进程的 strong/native 运行长度还被初始 prefix count 所界定；若每次复用至少消耗一步，它不能成为任意次复用的操作 identity，但真实两步 one-shot relay 仍存在。仍需 RFC 选择 α-fresh 线性或可复制 wiring 语义并证明原生充分性 |
| π 操作层 | α、捕获避免、结构 late LTS、精确 soundness/reflection | P1b request/accept 操作链已在无过滤 structural strong-late LTS 上 kernel-build。`OpenSMCActionAlpha` 另把一般 input/bound-output label 与 derivative 按 freshness-safe renaming 取商，并保持真实原生一步；binder 等于 channel 的非法 bound-output 不会被并入合法 open label。仍缺不可变 provenance 与独立 QA-L4 评审 |
| FMS | 全 ωCPO powerdomain、递归域解、hiding/coherence、adequacy、另行明确范围的 definability、full abstraction | `FMSCpoOmegaScottPower` 在所有 ωCPO 与 `ContinuousHom` 上构造真实非分离 Hoare/lower 端函子及 Monad。连续 Fubini/候选 strength component 已满足 map naturality、pure-unit、swap、乘积结合与精确 multiplication/Fubini 交换式，并构造 chosen-product morphism components。该 Monad 还在真实非恒定 `World ⥤ ωCPO` 支撑模型上逐点实例化，证明 unit/μ world naturality 及 pointwise Fubini。`FMSCpoConcreteBilimitExhaustivity` 现已为该非分离 omega-Scott lower/Hoare 模型构造 canonical exhaustive approximation 与连续自然的实际不动点见证 `A ≅ P(H A)`；对应的非分离 `powerHiding` 也已通过 kernel 构建。这不是 initial algebra/terminal coalgebra 结果，不是 algebraic compactness witness、分离的 Abramsky free pointed-semilattice powerdomain、完整 hiding/coherence、adequacy、definability 或 full abstraction。package 级 no-go 也不再只针对有限 powerset：交换 Fubini、映射 divergence、divergence/deadlock 分离，以及第一输入在 divergence 和 deadlock 两点都严格，合在一起会强迫两个 distinguished constant 相等。该结果否证的是这组强化要求，并不否证省去其中某项要求的 Abramsky 构造 |
| Replay 与概率 | 事件身份、精确 DPOEvent replay、epoch 对齐、稳定/公平窗口、正 ε | 五状态授权反馈参考 kernel 已 root-build 正概率共同轨迹，保留事件身份、replay 与 epoch 对齐；非恒等 reconnect bundle 另携 ε=1、稳定/公平窗口和外部调度证据。`CrossEpochProductFamily` 把任意已供应的四视图 admission 与新 epoch 规则 bundle 组合成四条 replay 对齐的 dependent chain；任意生产前提仍须另行提供 |
| 终态语义 | success、wait、deadlock、productive infinity 两两区分 | 参考 admitted occurrence 已 implemented_unverified |
| 静态保障 | 零证明占位符、完整 import 图、manifest 与 integrity 检查 | dirty worktree 本地 gate 对 305 个 Lean 文件通过，聚合为 `5cfe4d74d579ed94bcc2d2c7eb3dc2584972e0c7026ec161154be77c986b0b3b`；root build 完成 8960 jobs |
| Kernel 假设 | 每个中央声明只依赖获准 Lean 基础原则 | 本地 804 个声明审计通过；只出现 `propext`、`Classical.choice` 与 `Quot.sound` |
| Provenance | 精确 commit、toolchain、依赖锁、源聚合、构建日志 | 已有固定工具链本地构建记录，但证明树仍 dirty/uncommitted，不是不可变 commit-bound 证据 |
| 独立评审 | 三类非作者评审绑定精确 commit 与声明 | 缺失 |
| 治理 | RFC-0002 FCP 结论与 ADR-0001 Accepted | 缺失 |

# Q0–Q5 门槛

## Q0 —— 范围与追溯

仅在下列条件全部满足时通过：

- `formal/proof-obligations.json` 恰含获准的 18 项中央义务，且每个非
  missing 条目指向真实 Lean 声明；
- 英中 spec/RFC/ADR 的证明边界一致；
- 每个外部 theorem package 记录来源、版本、假设与适用范围；
- 定理范围内不存在 TBD 或未记录的二选一。

Owner：DRI；三类评审人共同复核。

## Q1 —— 确定性源码与 kernel 门槛

仅在精确候选 commit 上满足下列条件时通过：

- `formal/scripts/ci.ps1` 成功；
- `lake build` clean；
- 项目 Lean 源码中 whole-word
  `sorry` / `admit` / `axiom` / `unsafe` 均为零；
- 源文件数、聚合 hash、pinned input hash 与构建证据一致；
- 每个配置声明恰产生一份公理审计报告。

Owner：Lean 评审人。dirty worktree 上的本地构建不足以通过。

## Q2 —— 语义回归门槛

仅在可执行或 kernel-checked 回归覆盖下列项目时通过：

- 非法接线与隐式复制线性资源；
- DPO dangling、活动会话删除、签名重定义；
- 多 redex 下的 replay 身份；
- 声明顺序 pre-net 与 individual-token provenance；
- α 转换、捕获避免、freshness、scope extrusion、`res(com)`、
  `open+close` 与普通 `com`；
- mismatch、reconnect、delegation、admission 与 quiescent deletion；
- 重复/冲突投票、缺 quorum、显式 accept/reject 自治；
- 正 ε 收敛，以及缺失 ε/公平性/稳定窗口时的反例；
- success、external wait、deadlock 与 productive infinity；
- 排除“π parallel 是模型 tensor”“强幺单自动保持 DPO”“仅凭 τ 恢复
  事件”“boundedness 推出 termination”的负面结果。

Owner：Lean 评审人，范畴与 π 评审人共同参与。

## Q3 —— 独立数学评审

仅在非实现作者的评审人完成下列工作时通过：

- 核对命题强度、量词范围与代表元独立性；
- 审查 FreeSMC coherence/universality；
- 审查 exact-positional DPOI 的 legality 与 concurrency 前提；
- 审查 P1b residual 经 α/ACU/restriction/scope extrusion 的证明；
- 审查全部 FMS 假设，或已接受的有限控制范围裁决；
- 审查概率/事件/replay 耦合及终态分类；
- 签署绑定精确 commit 与中央声明的 review evidence。

Owner：三类非作者评审人（尚待具名指派并确认接受）。Agent 自审不能满足
本门槛。

## Q4 —— 完成范围门槛

必须通过 RFC 明确选择下列一条路径：

1. FCP 保留完整 FMS 为规范要求，并构造来源锁定、经评审的
   `CompleteFMSAvailable` inhabitant 与 operational/FMS coherence；或
2. FCP 接受 RFC-0002 §16，把可选 FMS conformance gate 与有限控制 P1
   分离，并完成所有规范性有限控制义务的评审。

此外，必须先分离并构建固定签名业务证书与异构 source/four-target admission
接口。之后每个生产规则包才可通过修正后的接口提供 rank、pre-net、资源/
会话/删除、授权、admission、公平性、稳定窗口与正 ε 证据。

Owner：Decision Owner 与各产品规则 Owner。

## Q5 —— 治理接受

仅在下列条件全部满足时通过：

- 已接受范围内所有中央义务都有绑定 commit 的 `reviewed` 证据；
- RFC-0002 完成 FCP；
- ADR-0001 记录 Accepted 决策；
- 例外与质量债均有 Owner 及到期/复核日期。

Owner：Decision Owner。本地代码变更不能自行批准本门槛。

# 当前阻断与质量债

| 阻断 | 解除条件 | Owner |
|---|---|---|
| P1b 实现验证 | 把已集成 closure 绑定到不可变 commit，在该精确 commit 上重跑完整 gate，并完成独立进程语义/Lean 评审；操作证明与 dirty-worktree 完整 CI/公理审计现已完成 | π/Lean 证明 Owner 与独立评审人 |
| 当前 RFC 下的完整 FMS | 构造/导入并评审完整 package，或接受 RFC-0002 §16 | 域论评审人 / Decision Owner |
| 产品级证书 | 为每条产品规则实例化已通过 kernel 的 `ProductRuleProofBundle` gate，并提供实质跨 epoch 四视图 admission 及具体 rank/resource/authorization/fairness/正 ε 证据 | 产品规则 Owner |
| 不可变证明 provenance | 稳定源码、提交、重算 integrity、运行完整 gate | DRI / Lean 评审人 |
| 独立 QA-L4 | 三类非作者评审绑定候选 commit | 评审人待指派 |
| FCP / ADR | 记录人工治理决策 | Decision Owner |

# 当前验证环境说明

固定 Lean 4.32.0 工具链已可在本地使用。普通 evidence gate 已在当前 dirty
worktree 上通过：305 个 Lean 文件，聚合
`5cfe4d74d579ed94bcc2d2c7eb3dc2584972e0c7026ec161154be77c986b0b3b`，
零禁止占位符，root `lake build` 以 8960 jobs 成功，804 份依赖报告只含
`propext`、`Classical.choice` 与 `Quot.sound`。普通 gate 成功退出；单独的
`-RequireComplete` 回归以退出码 1 拒绝，并逐项列出 11 个
`implemented_unverified` 与 7 个 `partial_scaffold`。记录位于
`formal/build-evidence/2026-07-26-fms-openpi-crossepoch-root.md`。

这是较强的本地 kernel 证据，但不是不可变 commit-bound provenance 或独立
评审。`ci.ps1 -RequireComplete` 按设计拒绝全部 18 项。因此 manifest 中
所有条目仍只能是 `partial_scaffold` 或 `implemented_unverified`；没有任何
条目达到 `proved` 或 `reviewed`。

# Release Quality 输入

处置：**继续迭代，不晋级**。只有在不可变 commit 上通过 Q0–Q2，并把
FMS 范围问题正式提交 FCP 后，候选结果才适合进入 QA-L4 评审。当前
证据不支持宣称“全部理论完成”、FMS full abstraction、RFC 通过或 ADR
接受。

## 最新可变工作树门禁（2026-07-26）

精确 action / 域方程边界 / 有限跨 epoch 链增量已通过完整普通本地门禁：
343 个 Lean 源文件，源码聚合哈希
`8b08b6c0215d4b6430083d14b477febe65f4df4adf7b0ee6a75f27df73d1163b`，
`lake build` 8997 个 job 成功，四类禁止占位符零命中；987 个声明完成公理
审计，依赖仅为 `propext`、`Classical.choice` 与 `Quot.sound`。

精确记录见
`formal/build-evidence/2026-07-26-fms-action-finitechain-root.md`。
`ci.ps1 -RequireComplete` 仍按设计以 1 退出，并列出 11 个
`implemented_unverified` 与 7 个 `partial_scaffold`。

当前实现已覆盖精确局部连续 action、未分离 `P ∘ H`、选定积强交换协调、
完整格自由扩张、诚实的条件化递归域边界、任意有限五视图事件/replay/epoch
共同轨迹与精确的一行 FMS gate。对抗复核已否决直接多行 FMS 声明：含业务
事件的 after epoch 不可能等于空 before epoch，且记录中没有固定共同 FMS
package 或指称端点连续性。它们没有构造分离 Abramsky 幂域、实际
递归域解、完整 hiding/adequacy/full abstraction、总具名 Open-π 操作 SMC，
也没有生成八个缺失生产产品包实例。

处置仍为：**继续迭代，不晋级**。该结果不是不可变候选提交、独立 QA-L4
评审、FCP 决策或 ADR 接受。

## 最终可变工作树证据 — 2026-07-26

NDωCPO/AFT、具名边界、共同 FMS 与有限严格幂域 no-go 增量，已在精确
记录的源码状态上通过完整普通本地证据门槛：

- 359 个 Lean 源文件；
- 聚合哈希
  `7bf56b13ed7075f476b9ba71c00c840b904678a42d2f3d1df734af57a9162eb4`；
- 公理审计目标清单哈希
  `7471e603f5b060b0afbd1037b8f9a7b07698184cee4a49b44789c300b3fb30c7`；
- 根构建 9013 个 jobs 成功；
- `sorry`、`admit`、`axiom`、`unsafe` 整词命中为零；
- 1043 个声明完成内核依赖审计，仅依赖 `propext`、
  `Classical.choice` 与 `Quot.sound`。

精确记录位于
`formal/build-evidence/2026-07-26-ndcpo-openpi-commonfms-root.md`。
`ci.ps1 -RequireComplete` 仍按设计以 1 退出，准确列出 11 个
`implemented_unverified` 与 7 个 `partial_scaffold`。

两次代理级对抗复核接受了严格限定后的内核结论：条件化 AFT 构造没有隐藏
inhabitant；有限严格 powerset 候选对每个非空有限 equality source 确实不具
初性。这些只是实现级复核证据，不是独立人类 QA-L4 签字。全源
solution-set、富集/强交换幂域、递归 FMS 域、完整
hiding/adequacy/definability/full abstraction、总具名 Open-π SMC、真实
生产执行核共同轨迹，以及八个包自有证书仍然缺失。

处置保持为：**继续迭代，不晋级**。
## 全源/Fubini 与生产事件增量（2026-07-26）

在前述不可变证据快照之后，可变工作树新增：

- 真实的全源 `SolutionSetCondition.{0}` 与普通自由/遗忘伴随；
- 无条件 CPO-富集 hom 伴随；
- 联合连续的规范顺序 Fubini；
- 分离 divergence/deadlock、双常量严格保持和 swap 交换性不相容的
  内核 no-go；
- 具有真实 Ionescu--Tulcea 事件路径、正支撑原生步骤和精确 DPO replay
  的稀疏 event-payload Markov kernel；
- 对 positional 具名边界实验的独立对抗审查。

root 集成后的 `lake build Cantilune.Tests.All` 以 9036 个 jobs 成功。
所选新增声明只依赖 `propext`、`Classical.choice`、`Quot.sound`，新增模块
没有禁用的 proof placeholder。

审查否决了把 positional 实验晋级为总操作性具名 Open-pi SMC：raw
操作数没有重命名到 realized middle，fresh middle 名按构造与两边都不相交，
也不存在 quotient-Hom-to-raw adequacy bridge。有限控制 identity no-go
以显式的任意长轨迹 realization 为条件。

Fubini no-go 把质量处置从“尚未构造”推进为“当前加强目标本身不相容”。
FCP 必须在非分离交换效应、分离非交换效应或新的代数/同态理论之间作出
选择，完整 FMS 工作才可继续。

稀疏概率定理消除了 total self-event 人工前提，但仍消费调用方给定的有限
事件 kernel 和语义 coupling/seam；它没有提供 epoch/signature/progress/
epsilon 事实或任何生产包实例。

这些仍是可变工作树和 Agent 复核证据，不是人工 QA-L4 签字或已接受的
架构决定。处置保持为：**继续迭代，不晋级**。

## 最终集成可变工作树门槛（2026-07-26）

复核后的精确源码状态通过了
`formal/build-evidence/2026-07-26-global-ssc-fubini-sparse-event-root.md`
记录的普通门槛：

- 384 个 Lean 源文件；
- 聚合哈希
  `e14b886283e3efa46b555ea6d272020476f40a4b5eae52871a4e770e29566990`；
- root build 以 9038 个 jobs 成功；
- 禁用 proof placeholder 为零；
- 1076 个审计声明仅依赖 `propext`、`Classical.choice`、
  `Quot.sound`。

完成门槛按设计以 1 退出：11 项为 `implemented_unverified`，7 项为
`partial_scaffold`，没有任何项是 `proved` 或 `reviewed`。本次最终本地
运行不改变 QA-L4、FCP 或 ADR 状态。

## bilimit/alpha/hiding 集成状态 — 2026-07-27

本次可变工作树增量消除了两个此前显式保留的前提：

- `concreteActualFixedPointWitness` 使用现已构造的 concrete bilimit
  exhaustivity witness，为非分离 omega-Scott lower/Hoare 模型给出实际的
  连续自然不动点 `A ≅ P(H A)`；
- 递归捕获避免替换现已证明在 `RecursiveAlpha` 下保持 congruence，原生
  transition 也有无条件的全构造子 alpha 意义下一步置换定理，没有用弱步或
  τ-star 替代。

因此，已有的非分离 `powerHiding` 可在这一受限模型中与实际不动点组合。
这**没有**证明 initiality、terminality、algebraic compactness、分离的
Abramsky powerdomain、源码层完整 hiding/coherence、adequacy、
definability 或 full abstraction。一般 package no-go 也已收紧为精确边界：
交换 Fubini、映射 divergence、divergence/deadlock 分离，以及第一输入在
两个 distinguished constant 上都严格，四者联合不一致。该证明与表示无关，
不依赖有限 powerset；它不否证不要求这组完整强化条件的 Abramsky 构造。
内核推论 `no_strengthenedExactFMSAcceptancePackage` 已直接在完整
exact-acceptance 边界给出相应不可居住性。

根任务现已在
`formal/build-evidence/2026-07-27-bilimit-alpha-hiding-root.md` 记录新的
完整普通门：427 个 Lean 文件，源码聚合哈希
`039c48d0c5a946fbf5f02cb0ee67c81ff73a428fe49291ddda92a8fe61ea7064`；
根构建完成 9081 jobs，whole-word placeholder 扫描为零，1232 个审计声明
只依赖 `propext`、`Classical.choice` 与 `Quot.sound`。proof obligation
分类仍为 11 项
`implemented_unverified`、7 项 `partial_scaffold`，没有任何项达到
`proved` 或 `reviewed`。递归 agent/完整 FMS 语义、总具名 Open-π SMC、
真实生产 kernel 及八个包自有的事实集仍不存在。Agent 级复核不等于独立人类
QA-L4 签字。处置继续为：**继续迭代，不晋级**。

## 名义分离与 occurrence 标记 QA 增量 — 2026-07-27

当前可变树新增了 world 单射、permutation 与 allocation 下经内核检查的
有限支撑搬运，并在具体有限支撑 PCM 中保持和反射 compatibility 与部分
复合。递归 strong-late LTS 还新增了保留 provenance 的原生事件。每个原生
一步均可被标记并可擦除回原推导；新的 parallel residual square 给出两个
精确 marked 顺序，且无法从已知 choice 反例构造。隐藏同步通道保留在事件
支撑中，所以擦除为 `tau` 不再生成虚假的独立性证书。

这没有闭合完整 FMS 门槛或总具名 Open-pi 门槛。前者仍需一个经 FCP 确认
一致的目标，以及源码层递归 agent、restriction、adequacy、definability
与 full abstraction；后者仍需 RFC 选择公开边界表示、wire realization、
进程重命名与 Hom equality。在承重消费者迁移到 marked residual 关系前，
旧的 label-only replay quotient 也仍不适用于承重独立性证明。

本增量没有加入生产 kernel 或任何产品自有规则/运行事实。产品包审计仍记录：
八个规划包均没有规则清单、rank、pre-net、资源、授权、公平性/稳定窗口或
正 epsilon 输入。这些缺失不能由通用定理消除。

这些只是可变工作树实现证据，不构成不可变候选提交、独立人类 QA-L4 签字、
FCP 决策或 ADR 接受。处置继续为：**继续迭代，不晋级**。
