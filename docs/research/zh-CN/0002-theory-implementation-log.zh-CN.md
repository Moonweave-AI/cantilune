# 理论实现证据日志

状态：历史性、未经审查的实现快照；当前的证明范围已被
`docs/research/0006-theory-closure-iteration.md` 取代  
捕获时间：2026-07-23（Asia/Shanghai）
最后对账时间：2026-07-23（基础扩展之后）

> **阅读规则：** 下文中使用"current"的陈述，包括旧的
> 12/60 P1c 矩阵停止点、随机轨迹核的缺失、以及一般任意 monic 预层 DPO 并发的缺失，
> 仅描述本捕获快照。它们不得被用作 2026-07-24 树的状态。研究日志 0006 记录了之后的 60/60 事件索引
> 矩阵（及其独立的完整后期反射障碍）、一般任意 monic 胶合/补集/并发定理、实际事件标注的
> 轨迹桥，以及仍然存在的边界。

## 治理与基线

- 工作对象：形式化研究项目与证明证据加固。
- 风险：S2。
- 要求的质量门：QA-L4。
- 生命周期与成熟度：Pre-FCP / M1。
- 基线 HEAD：`a592d868f19556361cb52aa03772912af4e8bed4`。
- 工作分支：`codex/theory-foundation`。
- 捕获时跟踪的补丁哈希：`dc7be8d20661b3ebef205adf6a893cf2f9deb733`。
  这是捕获时对 `git diff --binary` 进行哈希的结果；它不
  包含未跟踪文件，也不是提交或审查产物。
- 本实现开始时工作树已是 dirty 状态。本次证据基础设施任务未对任何文件进行
  stage 或提交。
- 人类 Owner/DRI 与三位独立的范畴论审查者仍
  未被记录。不声称任何 QA、FCP 或 ADR 批准。

本地锁定为 Lean `v4.32.0` 与 mathlib `v4.32.0`。
`formal/lake-manifest.json` 将 mathlib 及每个传递依赖解析到
确切的 commit。`formal/build-evidence/2026-07-23-local.md` 记录了
对账后树的完整本地证据门：63 个项目 Lean 文件、
8,718 个构建任务，以及 76 个维护中的 axiom-audit 声明。该树仍
未提交，因此这是本地构建证据，而非 commit 绑定的证明或
独立审查。
由于源状态没有不可变 commit，且完整的中心
陈述尚未构造完成，全部 18 个 manifest 条目均为
`partial_scaffold`。中心的
`four_projection_consistency` 符号现在组合了四个已提供的
五层证书；不存在 intended-calculus 的四证书实例。没有任何条目是 `proved` 或 `reviewed`。

## 已实现的草案表面

当前 `formal/` 树包含以下实现草案：

- 有限签名、单调签名扩展数据、显式结构
  copy/drop 语法、原始 FreeSMC 项、原始项的初始性，以及连贯的
  extension/reindex 组合；
- 一个生成的 FreeSMC 同余，包含 category、tensor、
  associator/unitor/symmetry naturality、inverse、pentagon、triangle 和
  hexagon 等式；hom-wise 商；一个 all-carrier `LawfulAlgebra`；
  quotient-fold 分解；对严格
  identity-on-object 解释的精确唯一性；以及相应的 unit/tensor/
  naturality-preserving `CoherentMonoidalIso` 唯一性定理；
- 有限类型化开放有向超图，带有有序类型化端口和嵌入
  边界；一个可执行的 inclusion-match DPOI 片段，包含 complement/
  result 构造、dangling 拒绝、边界保持、
  subject reduction、fixed-match 唯一性，以及有限 carrier 并发；
- 类型化超图被实例化为一个实际预层范畴的 slice，
  使用 mathlib 的 `Adhesive` 结构，带有 monic 开放边界、witnessed
  DPO 方、Van Kampen/pullback 后果，以及
  固定第二个 pushout result 的规范唯一性；
- 一个 node-only quiescent-deletion 义务，绑定到一个 observable package
  步和确定性 replay，带有显式的 dangling、resource、session、
  endpoint 和 tombstone 条件，以及 positive/negative fixtures；
- 运行时配置、endpoint-free replay recipes、确定性 replay
  核、核验证的事件记录、observable LTS 定义、
  terminal-state 分类，以及通用操作投影
  证书；
- 四视图签名准入数据，要求 total DAG、Petri、π 和
  morphism 解释，连同跨 epoch 边界的保持和传递性
  证明；
- 一个分层投影接口，将 mathlib symmetric-monoidal
  functor 证书与 operational LTS 证书分开，然后
  打包一个显式 admission 步、resource 保持，以及完整的
  success/wait/deadlock 分类，而不合并这些层；
- 一个有限、非空的参考执行，带有独立命名的 DAG、
  declaration-order individual-token pre-net，以及 morphism 视图，加上
  可复用的 `ObservableLTSIso`-到-`ProjectionCertificate` 构造，以及
  基于所提供证书的通用三视图操作 P1a 族；第二个多态族组合三个所提供的五层证书，
  并同时暴露 native rewrite、admission、resource 和 terminal
  定理，而不制造任何缺失层；
- finite-control typed 和 raw pi 语法、native transitions、one-step
  erasure，以及一个 presented typed open-process SMC；
- 一个 finite-control late-pi 层，带有 free/all-name 分析、确定性
  freshening、capture-avoiding substitution、alpha 等价、结构
  同余、freshness-guarded native strong late steps，以及结构
  闭包；
- 有限 closed request/accept 和 single-delegation 投影证书，
  其反射覆盖每个 native target action，加上
  机械可枚举的 15-event × four-projection P1c 矩阵；
- 一个外部 FMS 接口和条件语法层交换定理，
  连同一个实际 finite-injection mathlib 范畴、`World ⥤ Type` 和 `World ⥤ ωCPO` 中的非恒定
  协变 support 对象、natural
  inactive/parallel 操作、allocation，以及 omega-continuous direct image；
  一个具体 support 模型、桥义务，以及参考 open
  interpretation 逐点释放交换定理，而一个 checked
  swap 反例暴露了缺失的 supported-process renaming 层；
- 通用 finite-height join 证据、upward-closed stable regions、
  identity-aware aggregation、显式 external acceptance/rejection、有限
  strict-progress 界、对无限 internal oscillation 的排除、
  条件 geometric-tail 收敛、一个测度论的
  almost-sure-hitting 桥、`H/ε` opportunity-count 界，以及
  一个带有精确 finite-path
  replay 的确定性 `ExecutionPackage`-到-feedback 桥；
- 一个真正的 homogeneous mathlib Markov 核、Ionescu--Tulcea 对
  infinite trajectory 测度的构造、measurable decreasing not-hit 事件、
  native execution 后继上的 probability-one support，以及 tail/hitting
  桥的条件构造，加上一个将 killed-chain miss mass 与
  not-hit cylinder 概率等同的通用 finite-native-kernel
  证明；
- 通用四证书操作组合，以及一个跨越 DAG、pre-net、native π 和 morphism
  目标的非空
  shared-source 有限实例，加上一个独立的中心构造器，接受四个所提供的
  共享一个 source/admission 的五层完整证书，并暴露
  它们组合后的 consistency package。

这些产物建立了一个有用的可执行证明骨架。它们本身并不
释放完整的理论计划。其确切构建状态在
`formal/proof-obligations.json` 中跟踪。`partial_scaffold` 意味着一个 kernel-buildable
supporting 声明存在，但中心定理的陈述范围或退出
条件仍未满足；它不能仅通过提交而被提升。

## 显式理论缺口

以下义务仍然开放，不得从草案
表面推断：

1. 生成的 FreeSMC 等式商、其内部 SMC 定律，以及精确的
   strict identity-on-object universal property 现已存在。一个机械化的
   `CoherentMonoidalIso` 表述在同一解释类内提供了相应的较弱的
   up-to-isomorphism 陈述。维护中的 witness 不是 mathlib `MonoidalCategory` instance，且
   arbitrary object-mapping strong monoidal 目标仍处于该
   定理之外。此静态商不蕴含任何投影的 DPO
   保持。
2. Typed-open DPOI 现在有两个真实但独立的层。可执行的有限
   inclusion-match 片段在显式
   gluing 条件下构造 complement/result。范畴层是一个实际的 adhesive presheaf
   slice，并对 witnessed 方证明 Van Kampen/pullback 性质。一个
   fixed-host finite active-support views 范畴现在有一个 faithful
   inclusion functor 到该 slice。对于每个满足
   `InterfaceLocal` 的 executable inclusion event，显式 intersection/union 等式证明
   两个 DPO 方都是该 slice 中的 pushout。这是一个 scoped 桥，而非
   equivalence：有序端口位置被保留在具体 incidence
   carrier 中，但从 type graph 中省略，source 范畴仅
   包含一个 host 的视图，且 faithfulness 作用于一个 thin inclusion 范畴。
   Arbitrary legal monic matches、其 general complement theorem，以及
   categorical critical-pair/concurrency 仍然缺失。Adhesivity 本身不
   提供 complement 存在性。
3. Four-view admission 使所有四个 total 解释和 old-view
   preservation 显式化，并记录一个 epoch-boundary tombstone 标识符。
   一个分层证书将一个非空参考事件绑定到一个 source step
   和一个 unfiltered native π input step。对每个
   admitted extension 的一般量化、DAG/Petri/
   Morphism 的具体 target admission 语义、permanent tombstone replay，以及
   cross-projection quiescent deletion 仍然缺失。
4. P1a 现在有一个可复用的通用**操作**族：所提供的独立
   observable-LTS isomorphism 产生 sound/reflecting 证书和
   simultaneous path/terminal/version 定理。一个独立的多态
   五层族组合已提供的 static、operational、
   admission、resource 和 terminal 证书。两个定理都不构造
   intended DAG/Petri LTSs 或其 DPO rule maps；具体的 DAG 和
   pre-net 值仍然是有限 fixtures。
5. pi 工作现在包括 finite-control alpha 等价、结构
   同余、capture-avoiding substitution、freshness-guarded late native
   steps，以及结构闭包，此外还有有限 closed
   request/accept/delegation 证书。现有的 typed erasure 定理
   针对一个带有较弱 freshness 前提的 raw kernel；它并未表明
   每个 typed step 都是 `Late.NativeStep`。

   P1c 审查表面有
   `15 events × 4 projections = 60` 个 typed cells。恰好 12 个单元带有 native
   strong 推导，48 个仍为 indexed pending obligations，因此当前
   `RuleMatrix.Complete` 为 false。当前 π 关系没有 native
   mismatch-decision、instance-reconnect 或 quiescent-delete constructor；
   三个对应的 event-indexed `NativeDerivation` 类型被证明为
   uninhabited。这是一个 RFC/ADR 停止条件。它不能通过
   metadata、reflexive step 或对 `τ*` 的 silent weakening 来释放。
6. 真正的非恒定 functor 现在存在于 mathlib functor 范畴
   `World ⥤ Type` 和 `World ⥤ ωCPO` 中；world action、natural support-level
   inactive/parallel、allocation，以及 omega-continuity 已被检查。一个具体
   support `ExternalFMS` 和参考 `OpenInterpretation` 证明逐点
   commutation；其 plug/hide 操作仅是 boundary-agnostic union。
   这些是 support 模型，而非 FMS powerdomain/domain-equation agent
   模型。一个 checked swap 反例表明 fixed nominal syntax 不是
   natural global element，因此 supported-process contexts 和 process
   renaming 仍然是必需的。Adequate hiding、quotient descent，以及 full
   abstraction 仍然缺失。
7. feedback 层现在从一个真正的 Markov kernel 开始，使用
   Ionescu--Tulcea 构造一个 infinite-path probability law，定义
   measurable decreasing not-hit 事件，并在
   `KernelProgressAssumption` 被提供时构造 tail/hitting
   桥。对于有限离散
   packages，一个 stochastic matrix 现在要求每个
   positive off-diagonal transition 有 native support，且 geometric miss recurrence
   由 row sums 加上所提供的逐点 positive-epsilon progress
   推导。一个 finite-cylinder 归纳在实际 Ionescu--Tulcea `trajMeasure`
   上证明，对于每个 finite native kernel，endpoint-cylinder mass 等于
   killed-chain survivor mass，因此 not-hit 概率等于 finite
   miss 概率。不再保留任何 package-specific state-trajectory-agreement 前提。一次独立审查确认了 indexing 和 measurability
   边界。然而，matrix support field 仅提供
   positive off-diagonal mass 的 native step 的存在性；它不选择 event
   labels、不 replay `DPOEvent`、不将 diagonal holding 视为一个 event，也不将
   kernel time 与 package epochs 等同。Stable-region alignment、stable-window、
   fairness，以及 positive-epsilon progress witness 仍未从
   每个 shared package 推导。
8. 中心四投影定理仅从四个已提供的
   完整证书中组合 static SMC、operational、一个
   admission、resource 和 terminal 层。不存在 intended-calculus 四证书实例。
   48 个 P1c 单元、executable/categorical DPOI 桥、OpenPi-to-FMS
   commuting instance、all-admission/resource 语义，以及 package-specific
   stable-window/fairness/positive-epsilon 实例化都仍然开放。

全部 18 个中心定理义务的权威列表是
`formal/proof-obligations.json`。

## 独立 Agent 只读审查

一次独立 Agent 审查在初始实现之后针对完整的本地证明树运行。这是第二作者的技术检查，而非
人类 QA-L4 审查。它在其检查的 Lean 声明中未发现本地 unchecked axiom、proof placeholder 或
逻辑 self-reference。它确实发现
原始 `implemented_unverified` 分类夸大了
全部 17 个现有 central-name 声明的范围。因此 manifest 被
降级为 `partial_scaffold`。

审查的实质性发现是：

- `ProjectionCertificate` 从所提供的 single-step soundness 和
  reflection 字段闭合路径，但没有 static SMC、DPO、resource、signature-admission
  或 extension-coherence 成分。
- request/accept 和 mobility 证书选择了一个 τ-only observation policy。
  Native visible input/output 行为被过滤掉，因此 reflection、
  normality 和 terminality 不是关于每个 native π step 的陈述。
- `open_pi_smc` 是一个 freely presented quotient，其生成的关系
  包含 SMC 定律。它尚未证明边界匹配 free
  names，或其操作实现标准 π plugging、hiding
  和 parallel 语义。
- FMS 定理以一个基于 raw terms 的抽象桥为条件。不存在
  finite-injection world action、naturality、实际 `Set^I`/`Cpo^I` instance、
  quotient descent、dynamic allocation 或 full-abstraction witness。
- 概率定理证明一个抽象 tail 序列的收敛。
  它没有概率测度、stochastic execution kernel、hitting event
  或 almost-everywhere 桥；`H/ε` 定理是一个抽象 tail-sum 界。
- DPO 唯一性固定一个已 witnessed 的 complement，且 DPO concurrency 是
  一个 finite-support executable 片段，而非一般的 typed-open
  M-adhesive DPOI 结果。

这些发现按义务编码在 manifest 中，并且是
最终定理的阻塞项，而非可选清理。

### 在该审查之后完成的整改

上述审查发现作为历史记录保留。以下
具体弱点已被消除：

- replay 不再通过与其存储的 target 相等来定义成功。一个
  `ReplayKernel` 接收一个 endpoint-free recipe 和一个 claimed source，一个
  `Verified` 事件证明确定性执行重算出记录的
  target；
- 有限 request/accept 和 delegation 证书现在使用完全
  restricted closed target processes，观察每个 native π action，并
  直接在每个 mapped state 上证明 transition 唯一性或缺失。因此
  τ-only policy 问题对这些有限 witness 已关闭；
- 硬 feedback 层由一个 finite-height join semilattice
  和一个 upward-closed stable region 参数化，而非仅
  原始 numeric threshold 模型；
- `feedback_almost_sure_hitting` 现在对一个显式概率
  测度量化，并从一个 decreasing
  measurable-event 桥证明一个 almost-everywhere hitting 陈述；且
- signature admission 现在要求所有四个 target 解释，并证明
  其保持证据跨 epoch 边界组合。
- 一个独立的分层证书现在记录一个真正的 mathlib braided/strong
  monoidal functor、operational reflection、一个 native admission step、
  resource preservation，以及 terminal classification；且
- 一个确定性 execution/feedback 桥现在证明对任何具体桥
  instance 的精确 finite-path
  replay 和 threshold stability 的保持。
- 原始 FreeSMC 现在有一个生成的 SMC-equation congruence、hom-wise
  quotient、all-carrier lawful target interface、coherence 证明，以及 strict
  quotient universal property；
- 有限 typed-open DPOI 已从一个实际 adhesive presheaf-slice ambient 中分离并被其补充，带有 witnessed Van Kampen DPO
  方；
- 一个可复用的通用 operational P1a 定理现在从
  独立提供的 observable-LTS isomorphism 构造证书；
- finite-control alpha 等价、结构同余、capture-avoiding
  substitution，以及 freshness-guarded strong late 关系现已存在；
- 实际非恒定协变 support functor 现在栖息于 set 和
  omega-CPO functor 范畴中；且
- 概率层现在从一个真正的 Markov kernel 和
  Ionescu--Tulcea trajectory 测度开始，而非一个外部假设的
  序列。

这些整改关闭了历史陈述"no quotient"、"no
adhesive ambient"、"no nominal late layer"、"only constant/abstract functor
objects"和"no stochastic kernel"。它们**并未**关闭当时记录的更强的
中心义务。本段本身被
研究日志 0006 取代：arbitrary-target FreeSMC comparison、
arbitrary-monic presheaf complement/concurrency，以及全部 60 个 event-indexed P1c
单元已被机械化的，而 whole-slice equivalence 已被
反驳，完整 raw late-LTS reflection 仍受阻。FMS
powerdomain/domain/full-abstraction instance、intended static/resource/
admission P1a instances、package-specific stable-window/fairness/
positive-epsilon witness、all-admission 量化，以及共享的四个
完整证书仍然开放。

### 历史 RFC/ADR 停止条件（已被取代）

在此快照时，P1c 矩阵不仅仅是未文档化的工作。其当时的 total-completion
命题被反驳，且该反驳在完成所有
非 π 列后保持稳定：

- 矩阵规模：60 个单元；
- native strong 单元：12；
- typed pending 单元：48；
- 被证明为 uninhabited 的 native π 推导：
  `mismatchGuard`、`instanceReconnect` 和 `instanceDeleteQuiescent`。
- `no_complete_extension_preserving_pi` 证明任何具有相同
  π 列的矩阵都是 incomplete 的，独立于其他三列如何
  填充。

固定计划仍要求每个 source event 有一个 native target 推导，并
禁止用弱 `τ*` 静默替换。因此实现者不得
将这些单元标记为 complete，或悄悄更改其 observation policy。
后来的授权 native extension 提供了全部 15 个 π witness 和全部 60 个
event-indexed 单元，因此上述 missing-witness 陈述不再阻塞
有限参考矩阵。它并未建立整个 raw
standard-late LTS 的反射：open reconnect/delete 源有额外的 environmental
转换。解决该更强的障碍仍是
一个 RFC/ADR 决策，
且 intended `four_projection_consistency` instance 仍然缺失。

## 证据与 CI 策略

`formal/scripts/ci.ps1` 是本地和 CI 的入口点。它：

1. 要求已提交的 Lean 工具链、Lake 依赖 manifest、proof
   manifest，以及 audit-target 列表；
2. 验证可执行的 source-integrity 记录；
3. 验证 18 条目的 proof manifest，并拒绝不支持的 evidence
   状态；
4. 将任何未来的 `proved/reviewed` 条目绑定到一个现有 commit，其
   proof-sensitive tree 未更改，且绑定到同时包含
   commit 和声明的 evidence 文件；
5. 拒绝项目拥有的 Lean 源中的整词 proof placeholder；
6. 运行 `lake build`；且
7. 导入项目，解析每个维护中的 kernel 依赖报告，并
   拒绝 `propext`、`Classical.choice` 和 `Quot.sound` 之外的 axiom。

audit-target 文件在 proof-surface 层是故意只追加的：
当一个中心结果成为维护中的证据时，应将其添加。allowlist
门是确定性的，但接受或移除一个基础
原则仍是一个经审查的策略决策。

默认命令是一个开发证据门，并故意允许
`partial_scaffold` 和 `missing`。提升命令
`formal/scripts/ci.ps1 -RequireComplete` 拒绝 `reviewed` 之外的每个状态；
预期它会失败，直到所有中心工作和独立
审查真正完成。

GitHub Actions 工作流运行相同的脚本，并拒绝缺失或
漂移的依赖锁。其 runner 固定为 `ubuntu-24.04`；checkout
固定为 `34e114876b0b11c390a56381ad16ebd13914f8d5`，lean-action 固定
为 `38fbc41a8c28c4cbaec22d7f7de508ec2e7c0dd9`。该 action 的 repository cache
被禁用，因为其内置的 root-relative lock hash 不遵循本
项目的 `formal/` 布局；mathlib cache 保持启用。该 action
自身的构建被禁用，因此 evidence script 是唯一的构建权威。
该工作流未针对此未提交的树远程运行，因此不声称任何 CI
服务结果。

## 提升条件

在将任何 manifest 条目更改为 `proved` 之前，记录：

- 完全限定的 Lean 声明；
- 使用已提交的 `lean-toolchain` 和
  `lake-manifest.json` 的成功构建；
- 确切的 40 字符 source commit；且
- 一个持久的 build-evidence 引用。

在将条目更改为 `reviewed` 之前，还要记录独立审查证据。
QA-L4 完成、RFC FCP 通过，以及 ADR 接受是独立的人类
治理事件，必须记录在其权威来源中；本
日志不能授予它们。
