# RFC-0002：投影一致性 —— 证明买到什么，以及四投影一致性定理

| 字段 | 值 |
|---|---|
| 状态 | **Draft**（pre-FCP） |
| 类型 | 架构 / 形式 |
| 风险 | S2 |
| 提案人 / 决策负责人 | Joker-of-Gotham（DRI） |
| 必需评审人 | 架构（第二读者 —— **TBD，缺口**）、形式数学评审人（§4 证明所需 —— **TBD，缺口**） |
| 创建日期 | 2026-07-23 |
| 更新日期 | 2026-07-27（理论/产品边界修正） |
| 相关 | RFC-0001、ADR-0001、`docs/spec/formal-semantics.md`、`docs/research/0001-p1b-pi-bridge-audit.md`、`docs/research/0006-theory-closure-iteration.md`、`docs/research/0018-theory-product-boundary-clarification-2026-07-27.md` |

> **治理说明：** 本 RFC 是 ADR-0001 所指的**生死线（project life-line）**。它*主要不是*一份证明文档 —— 证明在 `docs/spec/formal-semantics.md`。它在主线中的职责是陈述**若四投影一致，cantilune 运行时获得什么能力**、为何该能力才是统一结构的全部意义，以及为挣得它而须证的定理与分期证明。依 DRI 决策，π 投影一致性**非按构造**，按**分期计划**（§4）证明；所有 π 侧主张在证明存在之前均为**待证 / unverified**。

> **2026-07-27 边界修正：** 本 RFC 原先混淆了**核心理论 FCP**（证明通用证书接口可满足）与**产品符合性**（具体包实例化）。已在 §3.1、§4、§7.1、§9、§11 中修正：理论通过参考见证（60/60 P1c 矩阵）证明接口可行。产品在 FCP 后为其特定规则实例化。**八个产品包（Cantilune、Libretto、Cast、Baton、Cue、Chorus、Reprise、Cantilune Notation）不阻断核心理论 FCP**——它们尚不存在，其缺席符合预期。详见 `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md` 完整分析。

---

## 1. 摘要（能力优先）

RFC-0001 的统一结构说：`CantiluneGraph` 是一个对象 $(C, R)$，DAG / Petri / π / 态射是它的四种*读法*。这一主张只有当四种读法彼此一致时才值得成立——否则"一个对象"只是"四个被希望粘在一起的互不相连模型"的客气说法，而这正是 OpenClaw 失败模式。**本 RFC 是使"一个对象"成真的工作**（或在 π 线上，诚实报告能使其多真）。

但本 RFC 的要点不是证明本身。要点是**若证明成功，cantilune 运行时得到什么**：

- **可重放的多视角执行（有条件）。** 若每个投影 $P_i$ 把每个具体源事件 $g\xrightarrow{e}h$（含规则、匹配与推导见证）映为保留同一事件身份的指定合法目标推导，则一个执行事件可分别读成数据流推进（DAG）、token 触发（Petri）、通道交互（π）与复合（态射）。仅有"存在某个目标步"的前向保持不足以建立此性质。
- **不会漂移的可观测性（有条件）。** 完整源事件及其投影映射定义完成、且保持/反射均证明后，DAG、Petri、π 与态射 trace 才是同一记录运行的各个投影。这是 RFC-0001 §6.3"可观测性即结构"的预期形式内容；§3.1 的当前证明状态尚未买到该能力。
- **可证伪主张变得可测。** C1（表达力）、C2（步数有界可预知）、C3（控制面精简）都*从*这些一致 trace 上测得。无一致性，指标测的是四个分叉的故事；有之，测的是一个。

故 §3 的定理不是数学装饰——它是 cantilune 三个最大卖点之下的承重墙。若它在四条线中的三条失败，项目如所框定则不能成立；若仅 π 线失败，π 投影缩减为已证子语言（§6），其余成立。

## 2. 这如何推进 cantilune（是逻辑，不是证明）

本 RFC 所处的推进序列是：

1. **RFC-0001 §6.1** 将编排等同为 $(C, R)$，并声称四投影是一个对象。
2. **该声称有隐藏代价**："一个对象的四投影"要么是定理，要么是谎话。ADR-0001 把它定为关卡（生死线），而非假设。
3. **本 RFC** 付该代价——陈述定理、按投影拆分、给出分期证明计划与绑定回退。来源审计修正了原"三者按构造"假设：只有态射同一性情形完整；DAG/Petri 的重写保持仍开放。
4. **所买之物**即 §1 的运行时能力：多视角执行、不漂移可观测性、可测主张。

证明按投影拆分、且此拆分对*项目*（不只对数学）重要的原因，是每条线买不同能力、且各有不同失败方式：

| 投影 | 若一致，cantilune 获得…… | 状态 | 若失败…… |
|---|---|---|---|
| DAG | 数据依赖视角 $=$ 执行视角；可追踪工作流 | 静态读法有条件；重写映射 unverified | 定义目标并映射每条源规则 |
| Petri | 并发/资源视角 $=$ 执行视角；有界运行，以及相对于已固定成功谓词的死锁分类（C2） | 静态 pre-net 读法有条件；重写映射与成功谓词 unverified | 定义使能/标记、成功谓词，并把每条源规则映为 firing |
| 态射 | 复合/重构视角 $=$ 执行视角；可复用、可换的件 | by construction | （不会失败） |
| π | 通信视角 $=$ 执行视角；agent 间运行可跨通信镜头重放（邻近 C3） | **待证** | 缩减 π 至已证子语言；自由对话延后 |

这样读此表：**数学不是产品之外的另一回事——每一行数学买一行具体能力，每一种失败花一行具体能力。** 这就是本 RFC 存在于主线、而非仅存于 spec 的原因：能力表*就是*"证明为 cantilune 做了什么"的答案。

## 3. 定理（陈述；证明在 spec）

**定理（四投影一致性，v0.1）。** 令 $\text{CantiluneGraph} = (C, R)$ 如 `docs/spec/formal-semantics.md` 所定义。对每个投影 $P_i \in \{P_{DAG}, P_{Petri}, P_\pi, P_{Mor}\}$：

下列条款要成为良构命题，须先独立给出源商/可观察 LTS
$\mathcal L_R=(S_R/{\equiv_R},\operatorname{App}(R),\to,\mathcal T_{\mathrm{ok}})$，
以及每个目标的可观察商 LTS
$\mathcal L_i^{\mathrm{obs}}=(S_i/{\equiv_i},\mathcal D_i^{\mathrm{obs}},
\Rightarrow_i,\mathcal T_{i,\mathrm{ok}})$。目标原生语义必须独立于投影像定义
$\mathcal D_i^{\mathrm{obs}}$、状态同余及明确的行政步隐藏/粒度策略；否则反射会循环成立。

1. $P_i$ 是从 $C$ 到目标范畴 $T_i$ 的 SMC-函子（保持 $\otimes$、$\circ$、$\sigma$、$I$）。
2. $P_i$ 是**具体事件上的重写函子**：独立定义提升关系 $\operatorname{Lift}_i\subseteq\operatorname{App}(R)\times\mathcal D_i^{\mathrm{obs}}$，并选择映射 $\Phi_i$，使每个源事件 $g\xrightarrow{e}h$（其中 $e=(\rho,m,\delta)$ 记录规则、匹配及所需推导数据）都有指定的合法可观察目标推导 $\Phi_i(e):P_i(g)\Rightarrow_i P_i(h)$，且 $\operatorname{Lift}_i(e,\Phi_i(e))$。
3. **跨投影事件一致性与穷尽性**：从投影源状态可达的每条可观察目标推导，都经 $\operatorname{Lift}_i$ 关联到至少一个端点匹配的源事件。记录的投影 occurrence 是带标签对 $\widehat d_i=(e,d_i)$，擦除标签后的 $d_i$ 是原生合法目标推导。因此族 $\{(e,\Phi_i(e))\}_i$ 保留同一源事件身份，不捏造或漏失可观察事件。从 raw 推导 $d_i$ 唯一恢复 $e$ 是另行证明的单射/唯一性性质，本定理不预设。
4. **终态观察一致性**：$\mathcal T_{\mathrm{ok}}([g])$ 当且仅当 $\mathcal T_{i,\mathrm{ok}}([P_i(g)])$。结合条款 (2)–(3)，这才在所选可观察商 LTS 上保持 normal form、成功终止与死锁。

条款 (1)–(2) 使每个视角成为**保持结构的读法**；它们本身不蕴含范畴忠实性或操作反射。条款 (3)–(4) 是另需满足的事件/终态观察义务，满足后才可能给出 §1 的收获。

$\Phi_i$ 与 $\operatorname{Lift}_i$ 是额外的重写/操作数据，不是 SMC-函子 $P_i$ 自动具有的事件作用。

**审计限定（2026-07-23）：** 条款 (3) 不会仅由四个前向模拟推出。"同一事件"还需要共享的源事件/重写标识与推导见证；尤其 π 侧的 `res(com)`、`close` 与 `com` 等不同推导形状都只暴露 $\tau$。

### 3.1 各投影证明状态

| 投影 | 条款 (1) SMC-函子 | 条款 (2) 事件映射 | 条款 (3) provenance/穷尽性 | 条款 (4) 终态观察 | 理论状态 | 产品义务 |
|---|---|---|---|---|---|---|
| DAG | FreeSMC 等式商存在；通用 rankable-graph 投影完整 | 给定 LTS 同构的通用操作 family；参考见证完整 | 对给定数据有通用反射定理；参考实例完整 | 参考 fixture 完整 | **理论：通用构造完整** | **产品符合性：** 各包为其允许规则提供 rank 函数与 rank 保持证明 |
| Petri | FreeSMC 商与声明顺序 pre-net 构造存在；通用 pre-net/SSMC 语义完整 | 通用操作 family；参考 firing 见证完整 | 对给定数据有通用反射定理；参考实例完整 | 参考 fixture 完整 | **理论：通用构造完整** | **产品符合性：** 各包为其允许规则提供 enabling 谓词、token 语义与 firing 映射 |
| 态射 | by construction（同一性视图） | by construction | by construction | 使用同一成功谓词时 by construction | **按构造一致** | （同一性；无额外产品工作） |
| π（half-π II） | typed open-process presentation 与 mathlib SMC 实例存在；非恒定 `Set^I`/`Cpo^I` 支撑对象、离散-CPO 有限幂、分配、连续支撑 hiding/retraction 等式与有限 `P_f(H-)` approximant 存在；完整 FMS powerdomain/domain/full-abstraction 实例不存在 | 有限 P1c 参考矩阵有 60/60 原生格与四份仅在各自声明的受限目标关系内精确的按事件索引证书 | 全部 15 个 π 事件擦除为独立 alpha/结构 late-π 推导；mismatch、reconnect-as-delegation、quiescent shutdown 均为原生一步见证，但开放 reconnect/delete 编码还有额外 raw late-LTS 转移 | 仅对受限有限参考关系完整，不是整个 standard late LTS | **理论：受限参考 P1c 操作层闭合；完整 reflection/general/static/FMS 层开放** | **产品符合性：** 各包使用参考模板为其允许规则提供原生 π 推导 |

**理论与产品边界说明：** 理论通过参考见证（60/60 P1c 矩阵，异构运行时）证明通用证书接口*可满足*。产品用具体操作事实（rank 函数、pre-net 语义、资源策略、授权谓词）实例化这些接口。理论 FCP 不阻断于产品包存在。

## 4. 分期证明计划（DRI 决策：明示分期）

证明分期不是为了数学方便，而是因为**每期解锁不同能力**，故项目可在已证者上推进，而不必等最难的那条线。

### 4.1 P1a —— 修正后的三投影一致性工作

**理论义务（核心理论 FCP 门槛）：**

- 显式陈述 $P_{DAG}$、$P_{Petri}$、$P_{Mor}$ 为 SMC-函子。
- 证明各自保持 $\otimes$、$\circ$、$\sigma$、$I$。
- 从提供的 LTS 同构证明通用操作 family 构造器。
- **Petri 选择：** 为 individual-token provenance 采用声明顺序 pre-net/自由 SSMC。原始来源审计拒绝早前全局 Eckmann–Hilton 理由；设计选择以修正后的理由保留。
- **重写限定：** 早前 F2（"每个强幺单函子保持 DPO 重写"）为假。强幺单性不蕴含保持推出。DAG 与 Petri 通用构造确立投影存在；产品规则映射另行进行。
- **机械化边界：** 生成 FreeSMC 相容等价/商及其实际 mathlib
  category/monoidal/symmetric 结构已通过 kernel 构建。Typed open
  hypergraph 现为内生有限依赖 node/edge fibre，并把有序 incidence
  position 编入类型。其编码采用每个 typed presheaf 态射，因而
  full 且 faithful，并与 typed incidence-presheaf slice 中的范畴本质像
  等价。Active-support normalization 现保持具体 morphism 的
  identity/composition，并把全局单射的具体 match 映为
  typed-slice monomorphism，因此此 transport 不再依赖早期
  `InterfaceLocal` 固定宿主桥。对每个 monic match，Lean
  证明 incidence gluing 条件等价于 pushout complement 的存在性，
  构造 canonical complement，并证明其兼容唯一同构。对任意 canonical
  合法有限位置化步骤，Lean 现显式构造内生范畴中的第二个 pushout，
  并证明结果仍在本质像中。对两条 parallel-independent canonical
  步骤，它构造 joint finite pullback、两个 residual context、两个
  顺序结果及内生 residual DPO witness。这在显式 gluing 与固定边界
  保留下闭合了所需有限位置化 concurrency diamond。它不把内生
  范畴等同于整个 unrestricted slice：无限 slice 对象与有限
  incidence-incomplete 对象均在位置化像之外。抽象内生
  M-adhesive/van-Kampen 类定理仍待证。
- **操作 family：** 独立给出的 observable-LTS 同构现产生完整操作投影证书，三个这样的证书可组合为 P1a family。该通用定理证明接口可满足；它不构造产品特定的 DAG/Petri 语义。
- **五层 family：** 第二个多态构造器组合三份已经给出的
  static/operational/admission/resource/terminal 证书，并同时证明原生
  重写、admission、资源与终态结果。这是通用证书接口。
- **参考见证（反空洞）：** 60/60 P1c 矩阵展示通用接口可用具体 DAG/Petri/π/morphism 实例实现。
- **理论状态：** 通用 rankable-graph → DAG 投影完整。通用 pre-net/SSMC 构造完整。态射同一性情形完整。

**产品义务（包符合性门槛，FCP 后）：**

各产品包（Cantilune、Libretto、Cast、Baton、Cue、Chorus、Reprise、Cantilune Notation）提供：
- 包清单（`package.yaml`）与可枚举规则清单
- 每条规则的 `ProductRuleProofBundle` 实例化通用接口：
  - **DAG：** 每条规则的 rank 函数与 rank 保持证明
  - **Petri：** enabling 谓词、token 语义与每条规则的 firing 推导
  - **π：** 以理论 P1c 参考为模板的原生推导
  - **态射：** 通常为同一性或直接复合
- 运行时操作事实（不能从理论推出）：
  - 资源/会话策略（如"context window ≤ 200k tokens"）
  - 删除/静止谓词
  - 授权谓词（如"部署需人工批准"）
- 随机证据：
  - 公平性/稳定窗口定义
  - 每包正-ε 进展界

**解锁能力：** 仅在理论 FCP（通用构造已证）与产品符合性（包提供具体实例化）两者之后挣得三视图不漂移执行。

**产出/状态：** 理论——通用构造 kernel-built；参考见证完整。产品——八个包尚无源树、清单或规则清单；符合性是 FCP 后工作。

### 4.2 P1b —— π 对 request/accept 通道创建子语言的一致性

- 定义 request/accept 源 $C_{\mathrm{RA}}$，并**同时**构造两条类型正确
  路线：以 typed open-process SMC 承担原生操作，以逐点笛卡尔 FMS
  模型承担指称。两者须由显式交换/观测相容定理连接。
- 构造并证明静态 SMC-函子，再对该子语言独立证明原生单步保持、
  反射与穷尽性。
- **解锁能力：** agent 间通信可跨通信镜头重放——使用 request/accept
  寻址的运行，与数据流运行一样可追踪、可重放。这使多 agent 执行成为
  一等公民，而非不透明的旁路通道。
- **产出：** 子语言的证明。**状态：待证。** 可能需加条件或粒度对齐。
  若失败，启用 §6 回退。
- **独立核验（2026-07-23）：** 步骤 A–B 已核实，方差修正为协变
  $\mathbf{Set}^{\mathbb I}$。交接的步骤 C 张量因类型不成立被拒：
  $\mathrm{par}:A\times A\to A$ 是 agent 对象内部运算，不是
  $\mathrm{Mod}$ 上的张量双函子；双模拟商既非必要也非充分。逐点笛卡尔
  环境 SMC 只在给出对象与生成元自然变换后产生条件性静态定理。步骤 E
  因 request/accept BNF 与具体 $R_{\mathrm{RA}}$ 缺失而尚未良构。
  **状态：C0 目标/类型重设计；迭代，不晋级。** 见 spec §13 与研究日志。
- **实施决策（2026-07-23，晚于上述核验）：** 目标/类型重设计选择上述
  双路线。并行组合在 typed open-process 范畴中作为张量；在 FMS 路线中
  仍是 agent 对象上的内部自然变换。两条路线不得相互冒充；若要改成
  弱步替代，必须重新进入 RFC 决策。机械核验状态由
  `formal/proof-obligations.json` 跟踪。**在全部证书、交换定理及独立
  评审完成前，状态仍为 Pre-FCP/M1。**
- **当前有限控制支撑：** alpha 等价、结构同余、避免捕获替换、带
  freshness 前提的强 late 步及结构闭包已机械化。真正非恒定的协变
  `World ⥤ Type` 与 `World ⥤ ωCPO` 支撑函子、局部无名
  supported-process 函子、自然支撑指称、真正逐点有限幂集 monad 与
  对象级有限 `P_f(H-)` 阶段也已存在。具体支撑模型与参考
  `OpenInterpretation` 证明逐点交换，而 swap 反例同时揭示固定名义
  语法不是自然全局元。allocation 后接支撑 hiding 也已作为连续自然
  变换满足已证的支撑层 retraction 等式。这不是 FMS agent restriction
  运算或 FMS powerdomain/domain 解；完整 world action、阶段
  colimit/initiality、adequate hiding、quotient descent 与
  full abstraction 仍开放。

### 4.3 P1c（延后）—— π 对自由对话 / 无限制移动性的一致性

**理论义务（核心理论 FCP 门槛）：**

- **参考矩阵完整：** 60/60 原生格，含受限目标关系内的四份按事件索引 `ProjectionCertificate`。
- **参考见证（反空洞）：** DAG 使用 rank 证明的无环图重写，Petri 使用带身份的 individual-token firing，态射为同一性视图，π 保留原生类型推导。
- **通用接口已证可满足：** 有限参考演算展示 `ProductRuleProofBundle` 接口可用具体 DAG/Petri/π/morphism 证书实例化。
- **能力（理论）：** 通过参考见证证明 π 通信视角的四投影一致性是*可能的*。
- **2026-07-23 请求者授权修订：** 加入标准有限控制 mismatch guard `[a≠b]P`，其原生步要求真实不等式证明。reconnect 由普通通道 delegation 表示，quiescent delete 由双方 continuation 均为 `0` 的 shutdown 通信表示。三者都是原生一步 π 推导，不是 no-op、元数据 witness 或 $\tau^*$ 闭包。Lean 证明 `pi_column_complete`。另一个封闭编码还为 communication、open/close、reconnect 与 quiescent delete 给出真正的强原生 $\tau$ 步；该编码的精确转移分类及由此得到的完整十五事件 reflection 证书尚未证明。
- **三项关键操作的非 fixture 桥：** admitted occurrence 现从具体 `Config` 计算目标。Lean 从同一 occurrence 推出有限支撑 node/edge DPO 更新、基于 marking 差的 Petri firing、一个原生 standard-late π 步、morphism 更新与 endpoint-free recipe replay。Replay 会先核验签名、规则、匹配基数与 embedding 指纹、complement、freshness、policy、外部证据及事件类型，再重新计算目标。这展示通用模板可执行。
- **这些 occurrence 的具体事件/epoch 概率桥：** 每个 occurrence 现生成一个 `ExecutionPackage`，其正质量业务转移携带同一个可 replay 的 `DPOEvent`，之后只有显式 external completed hold。每个业务标签轨迹点都有同一 DAG/Petri/native-late-π/morphism 推导及两端 epoch；每个有限子段都有精确存储事件端点、整段 endpoint-free replay 与固定运行时签名对齐；almost-sure 共同轨迹定理已实例化。这是固定签名参考包，展示随机接口。
- **理论状态：** 参考矩阵 60/60 完整。通用 `ProductRuleProofBundle` 接口已证可实现。四个分别命名的受限目标关系有 soundness、reflection、terminal 与签名版本证书。

**产品义务（包符合性门槛，FCP 后）：**

各产品包把参考证书扩展到其允许规则集：
- **每规则实例化：** 以理论 P1c 参考矩阵为模板，为每条包特定规则构造 `ProductRuleProofBundle`。
- **运行时事实（包提供，不能推出）：**
  - 资源/静止谓词（如"context 空时删除"）
  - Admission 策略（如"工具注册时签名扩展"）
  - 连接包规则到 SMC 结构的静态层
- **与理论分离：** 理论证明接口可满足（通过参考）。产品证明其对特定规则已满足。

**剩余理论工作（仍为 Pre-FCP）：**
- 超越受限关系的完整 standard-late reflection
- 完整 FMS powerdomain/domain/full-abstraction 或被接受范围回退（§16）
- 独立进程语义评审

**说明：** "推广到每个 admitted 源规则"已拆分：
- **理论门槛：** 参考矩阵证明 60 个格 → 通用接口可满足 ✓
- **产品门槛：** 包为其规则实例化 → 具体证书（FCP 后，每包）

**状态：受限参考关系之外理论完成仍待证。** 参考覆盖闭合；完整 reflection 与 FMS 范围仍是开放理论门槛。产品规则实例化是包符合性工作，非理论 FCP 阻断。

## 5. Petri 网级性质检查器（声明性义务）

依 spec §6.2 / §7，有界性 / 活性 / 可达性**非**裸 SMC 给出；它们**在 Petri 投影上**检查。这是从"数学一致"到"C2 可预知性主张可测"的桥梁：一致性说 Petri 视角*即*执行；检查器再从该视角读性质。

- **有界性检查器**（标记可达性有限性）—— RFC-0001 C2"可预知性"（步数有界）所需。
- **活性检查器**（workflow-net soundness 变体）—— 死锁主张所需。
- **可达性检查器** —— trace 完整性所需。

这些是**未来工具**（formal simulator，FCP 后），非本 RFC 证明的一部分。simulator 存在并通过前标记 **unverified**。

## 6. 回退（依 ADR-0001）

若 P1b 无法证明（即便对 request/accept 子语言）：

1. **缩减** π 投影到**能被证明**重写函子桥接的最大子语言。
2. 在本 RFC 中**记录**缩减（哪些 π 构造被弃、哪些保留）。
3. 将所有被弃构造标记为 **P1 不支持**，所有保留但未证构造标记 **unverified**。
4. **不得**声称完整 half-π (II) 的四投影一致性；仅对已证子集声称。

此回退是 ADR-0001"缩减至一致子集"条款在 half-π (II) 决策下的诚实表达。其产品含义，依 §2 之表：若 P1b 失败，未被全买走的是**agent 间可重放性**能力，项目不假装地交付、舍此能力上线。

## 7. 安全 / 正确性含义

- 本 RFC 范围内无运行时、无 I/O；尚未触发威胁建模关卡。
- **正确性风险：** 若定理（尤其 §4.2/4.3）失败且回退未诚实执行，项目核心主张（"统一结构"）为假 —— 此即 ADR-0001 所标战略风险。本 RFC 的纪律（分期证明、回退、unverified 标记）即缓解。具体而言：风险不是"证明难"，而是"我们交付一个多视角运行时、其视角静默地不一致"，这会复现 §1 所说一致性旨在防止的"可观测性与真相分叉"失败。

## 7.1 核心理论 FCP 与产品符合性边界（2026-07-27 澄清）

**已识别问题：** 原 RFC-0002 与 ADR-0001 接受标准错误地混淆抽象理论完成与具体产品实例化，制造一个虚假依赖：核心理论 FCP 须等到全部八个产品包及其运行时证据存在才能关闭。

**修正边界：**

### 核心理论 FCP 范围（独立关闭）

核心理论证明投影一致性的**抽象条件**与**通用接口**：

1. **元定理**（对满足输入的全称量化）：
   - "对每个 rankable typed graph G，存在严格 DAG 投影"
   - "对每个带公平性证据的执行包，期望 hitting ≤ H/ε"
   - "对每个共享一个源的四投影 family，跨视图事件一致"

2. **通用证书接口**（具良定义语义的类型）：
   - `ProjectionCertificate`：soundness、reflection、terminal 保持
   - `ProductRuleProofBundle`：static/operational/resource/admission 层
   - `ExecutionPackage`：原生步、replay、epoch、概率 kernel

3. **参考见证**（非空洞证明）：
   - 60/60 P1c 参考矩阵，含全部四个投影
   - Mismatch/reconnect/delete，带可执行图更新
   - 有限异构运行时，含 admission 穿越

4. **反例**（边界澄清）：
   - 无限制 slice ≠ 位置化 DPOI（有限 boundary-duplicate 反例）
   - 离散有限幂 ≠ FMS powerdomain（无连续 singleton unit）
   - 两态协议 ≠ 完整 late reflection（环境转移存在）

**理论 FCP 门槛（阻断理论者）：**
- ✓ 通用 SMC 函子与操作 family 构造器（kernel-built）
- ✓ 参考见证证明接口可满足（60/60 矩阵完整）
- ⚠ P1b 操作证书（implemented_unverified；需不可变 commit + 评审）
- ✗ 完整 FMS 或被接受范围回退（§16 提议有限控制边界）
- ✗ 独立评审（category/DPO、进程语义、Lean 假设评审人未指派）

**明确非理论门槛：**
- ❌ 产品包存在（八个计划包尚不存在）
- ❌ 产品特定 rank 函数、pre-net 语义、资源策略
- ❌ 产品授权谓词、公平性定义、ε 界
- ❌ "全部 admitted 规则覆盖"（理论覆盖参考；产品覆盖其规则）

### 产品符合性范围（独立门槛，FCP 后，每包）

各产品包（Cantilune、Cantilune Notation、Libretto、Cast、Baton、Cue、Chorus、Reprise）提供通用接口的**具体实例化**：

1. **包清单与规则清单**：
   - `packages/cantilune/cantilune.yaml`（包元数据）
   - `packages/cantilune/rules/`（可枚举规则集）
   - 包所有者与符合性联系人

2. **每规则证书**（实例化通用接口）：
   - `dag_certificate: ProductRuleProofBundle`，每条规则
   - Rank 函数与 rank 保持证明
   - Pre-net token 语义与 firing 推导
   - π 原生推导（以理论 P1c 参考为模板）
   - 态射视图（通常为同一性或直接复合）

3. **运行时操作事实**（不能从规则名推出）：
   - 资源/会话策略（如"context window ≤ 200k tokens"）
   - 删除/静止谓词
   - 授权谓词（如"部署需人工批准"）
   - 冲突解决策略

4. **随机证据**（每包执行特征）：
   - 公平性/稳定窗口定义
   - 正-ε 进展界
   - Opportunity-epoch 对齐策略
   - 生产 Markov kernel 构造

**分离的意义：**
- 理论可在包开发时关闭并评审
- 包团队可并行实例化证书
- 可加入新包而不重开理论 FCP
- 参考见证展示接口可实现

**当前状态：**
- **理论：** 通用构造 kernel-built；参考见证完整；P1b 需不可变 commit + 评审；FMS 范围决策待定
- **产品：** 八个计划包尚无源树、清单或规则清单；符合性工作始于 FCP 后

## 8. 开放问题

1. ~~索引范畴 $\mathbb{I}$ 与目标方差~~ **2026-07-23 已解决**：有限序数 + 单射，含 $up$/$swap$；目标为协变 $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$。非恒定支撑函子与逐点支撑模型交换实例已存在。余：构造实际 FMS agent/powerdomain 模型、adequate 的 plug/hide 解释，以及为真正自然名义指称所需的 supported-process 重命名。
2. 粒度对齐：一次 π 交互步对应一个源事件，还是多个？（影响 π 的条款 2/3，进而影响"同一事件"在何种粒度上被声称）。
3. P1b 子语言是否足够表达以有用？（若否，重评 half-π (II) vs session-typed —— §1 能力表是裁决者：若子语言买不到有用的 agent 间可重放性，须重审该选择，而非静默缩水）。
4. 第二评审人 / 形式数学评审人指派（治理缺口）。
5. ~~**DAG/Petri 重写映射：**~~ **2026-07-27 已澄清：** 通用 rankable-graph → DAG 投影已证。通用 pre-net/SSMC 构造已证。**移至产品符合性：** 各包定义其规则并为其证明 rank/firing 映射。
6. **P1b 形式对象：** 定义 request/accept BNF、配置、$R_{\mathrm{RA}}$、freshness、substitution，以及 $E_{\mathrm{stat}}$ 与操作编码的分工。
7. ~~**可观察 LTS 与终态谓词：**~~ **2026-07-27 已澄清：** 理论定义通用 terminal 保持接口。**移至产品符合性：** 各包独立定义其状态同余、可观察推导域、administrative-step 策略与成功谓词。
8. ~~**P1c 一般化：**~~ **2026-07-27 已拆分：** **理论门槛：** 60 格参考矩阵完整（✓）。**产品门槛（FCP 后）：** 各包以理论参考构造为模板为其 admitted 规则提供 ProductRuleProofBundle。
9. **随机执行集成：** 真正 Markov kernel 现可生成
   Ionescu--Tulcea trajectory measure 与可测 hitting bridge。
   对有限离散包，miss 递推现已由矩阵行和与给定的逐点正
   $\varepsilon$ 进展推出。一般有限柱归纳已对每个有限原生 kernel
   证明 killed-chain/not-hit 等价，无须调用方另行提供
   state-trajectory agreement 前提。具体 Boolean 执行包选择
   原生事件标签、重放 `DPOEvent` 并以一个稳定/公平 epoch 窗口对齐
   端点。进一步的 seed 随机化耦合允许同一端点对具有不同原生
   事件身份，并证明遗忘事件随机性后恰好返回原状态律。有限
   子段也已有精确存储事件端点、endpoint-free replay 与固定
   运行时签名对齐。**移至产品符合性：** 跨 certified admission 边界的异构签名依赖联合转移核、真实 general-presheaf DPO match/complement/policy 重执行，以及为每个预期产品包导出 stable region、stable-window、fairness 与正 $\varepsilon$ witness。

## 9. FCP 摘要（尚未进入）

**Pre-FCP/M1。** 

**核心理论 FCP 进入要求（仅理论义务）：**

进入 FCP 要求完成理论义务，而非产品包实例化：

1. ✓ **FreeSMC 泛性质** — 任意目标幺半单比较（kernel-built）
2. ✓ **位置化 DPOI 范畴闭包** — 有限良构本质像等价（kernel-built）
3. ✓ **P1a 通用操作 family** — 从 LTS 同构可复用的证书构造器（kernel-built）
4. ⚠ **P1b request/accept 操作** — 未过滤结构 strong-late 证书（implemented_unverified；需不可变 commit + 独立评审）
5. ✓ **P1c 参考矩阵** — 60/60 原生格，四份按事件索引证书（kernel-built）
6. ✓ **异构轨迹** — 有限 `EpochChain`，含 admission、replay、epoch（kernel-built）
7. ✗ **完整 FMS 或被接受回退** — §16 提议有限控制边界；需 FCP 决策
8. ✗ **独立评审** — category/DPO、进程语义、Lean 假设评审人未指派

**明确从理论 FCP 门槛移除（移至产品符合性）：**
- ❌ "任意 typed-DPO 映射" → 产品：各包为其规则提供 rank 函数
- ❌ "一般规则→firing 映射" → 产品：各包为其规则提供 pre-net 语义
- ❌ "产品资源、静止、admission 层" → 产品：包提供运行时事实
- ❌ "八个包证书" → 产品：包尚不存在；其缺席不阻断理论

**理论 FCP 证明什么：** 通用证书接口*可满足*（通过参考见证）。理论可在产品包开发时关闭并评审。

**产品符合性门槛（独立，FCP 后，每包）：**

理论 FCP 后，各产品包（Cantilune、Libretto、Cast、Baton、Cue、Chorus、Reprise、Cantilune Notation）独立提供：
1. 包清单与规则清单
2. 每规则证书，实例化通用接口（DAG rank、Petri firing、π 推导、态射视图）
3. 运行时操作事实（资源策略、授权谓词、公平性/ε 证据）
4. 无"全部八个同时"门槛——包在准备好时逐步实例化

## 10. 决策记录

- **采纳分期证明**（DRI 决策 2026-07-23）：P1a（三个非 π 投影）+ P1b（π 子语言）+ P1c（延后 π 完整）。本轮核验把 P1a 从"三者按构造"修正为 §3.1 的状态。
- **π 投影按设计为待证**（half-π (II) 决策）；π 无按构造主张。
- **回退纪律绑定**：未证 ⇒ 缩减子集 + unverified 标记。
- **RFC 重构（本次修订）：** 从证明文档改为"证明买到什么"文档；证明留于 spec，每期加能力映射（§1、§2、§4）。
- **独立核验处置（2026-07-23，历史）：** 拒绝非标准 `|` 张量与"双模拟商是必需设定"的结论；P1b 回到 C0 目标/类型重设计。后续 §4.2 实施决策现已选择替代双路线架构，但不改变"尚未证明"的状态。
- **来源核验修正：** 为 individual-token/order provenance 保留 pre-net 语义，而非因所称全局 Eckmann–Hilton 坍缩；拒绝通用 F2，因为强幺单性不蕴含保推出。
- **P1c 原生规则修订已提出（2026-07-23）：** π 语法现加入
  带证明的 mismatch 构造子；reconnect 为原生 delegation，quiescent
  delete 为原生 shutdown 握手。有限参考矩阵现有 60/60 原生格与
  受限目标关系内的四视角按事件索引操作证书。这不建立整个 raw
  standard-late LTS 的完整 reflection。未授权任何弱步替代。
- **理论/产品边界修正（2026-07-27）：** 核心理论 FCP 与产品符合性是独立门槛。理论通过参考见证（60/60 P1c 矩阵，异构运行时）证明通用证书接口可满足。产品用具体操作事实（rank 函数、pre-net 语义、资源策略、授权谓词）实例化这些接口。**从理论 FCP 门槛移除：** "任意 typed-DPO 映射"、"一般规则→firing 映射"、"产品资源/静止/admission 层"、"八个包证书"。这些是产品符合性义务（FCP 后，每包）。八个计划包（Cantilune、Cantilune Notation、Libretto、Cast、Baton、Cue、Chorus、Reprise）尚无源树、清单或规则清单；其缺席不阻断核心理论 FCP。关于修正门槛结构见 §3.1、§4、§7.1、§9、§11 及详细分析见 `docs/research/0018-theory-product-boundary-clarification-2026-07-27.md`。

## 11. 跟踪

| 产物 | 状态 |
|---|---|
| `docs/spec/formal-semantics.md`（定义 + 证明） | Draft 经独立核验修正；§12 与 §13 不再过度声称 |
| FreeSMC / DPOI 基础 | 生成 FreeSMC quotient、实际 mathlib category/monoidal/symmetric 实例及任意目标 monoidal natural-isomorphism 比较与唯一性定理已通过 kernel 构建。完整 typed-presheaf slice 是 adhesive；任意 monic incidence 匹配恰在显式 gluing 条件下有 complement，witnessed complement 兼容唯一同构，固定开放边界可显式提升，标准 parallel-independent 推导有一般 residual 与 canonical concurrency 同构。Active-support normalization 保持具体 morphism identity/composition 并把全局单射的具体 match 映为 typed-slice monomorphism。`ExactPositionalObject` 以有限 carrier、唯一 typed incidence 描述、固定有序边界 typing 与无 boundary duplicate 独立刻画良构本质像，重建证明 `essImage X ↔ ExactPositionalObject X`。原始 match 与两条 residual 经 finite-image/preimage 同构传回，两个 DPO 方形在 ambient slice 中均为 Van Kampen。有限 boundary-duplicate 反例证明"有限 + incidence-complete + 固定边界"仍不足。这不是无条件的 whole-slice 等价 |
| Open π SMC | 所给 quotient 已有实际 mathlib Category/Monoidal/Symmetric 实例。`OpenSMCNominalAtomBoundary` 加入互异 typed name port 与精确擦除自由支撑，接纳真实具名 output atom，并在空具名边界拒绝它。组合式具名接口范畴与原生 plug/hide/restriction 操作充分性仍开放 |
| P1a 证明 | 可复用操作证书 family 与非空有限 DAG/pre-net/morphism 值已通过 kernel 构建。`P1cProductRuleProofBundle` 现给出一个实质非同一性 reconnect 实例：图增加 `(0, 1)`，四个不同 wrapper 携带原生 DAG/Petri/standard-late-pi/morphism 业务推导，四事件映射为双射，全部目标步反射，并含精确 replay 加 rank/quiescence/authorization/ε=1 调度证据。typed self-loop 反例仍排除 unrestricted typed open hypergraph 上的总严格 DAG 投影，product-rule 实例仍开放 |
| P1b 证明（或回退） | **有限 request/accept 操作定理为 implemented_unverified。** kernel-built 链覆盖 alpha/结构有限控制 late-π、原生单步擦除、全部四种真实 sync/close nominal-incidence 情形、精确 requesting residual reflection、complete/established 分类，以及无过滤 structural strong-late LTS 上的无条件 `pi_ra_certificate`。新一轮完整本地 CI/axiom 审计与对抗性实现复核通过；不可变 provenance 与独立评审仍为强制。独立 FMS 指称路线仍不完整：存在带连续 Kleisli 律的真实有限非空 Hoare Monad，但无 empty deadlock 或独立 divergence；exact 与 complete availability 均无 inhabitant，全 ωCPO Abramsky powerdomain、domain 解、source-identified Table-2 restriction map、all-world action bridge、adequate hiding 与 full abstraction 仍开放 |
| P1c 证明 | 显式有限 60 格参考矩阵为 60/60 原生。后续多状态 `P1cFullNativeRefinement` 对全部 15 个 family-tagged raw 源进程分类每个 native transition，保持原生 terminality 与签名版本，并给出一份完整有限参考 `ProjectionCertificate`，含 mismatch、reconnect 与 quiescent delete。每个 refined 步也映为实际未过滤 α/结构 strong-late 步。Lean 证明 canonical pure-process 映射不能满足当前 complete 证书，因为 runtime admission 改变签名版本而纯 π 状态版本为零；delegation/reconnect 作为 raw transition triple 也冲突。这仅闭合有限参考协议并使所需元数据层决策显式。Product-wide admitted `Config`、static/resource/admission 层与一个共享 coherent 源仍开放 |
| 随机反馈桥 | 真正 Markov kernel、Ionescu--Tulcea trajectory law、可测 not-hit 事件与条件 almost-sure 桥已通过 kernel 构建。确定性与 seed 随机化事件路径耦合都精确遗忘至状态律。每个有限异构 `EpochChain` 现携带有序原生事件身份、精确端点、可执行 `DPOEvent` 或 signature-admission replay 与 runtime execution-epoch 对齐；marked kernel 把依赖 native mark 放在被采样的正边本身。`FiniteBranchingReplayKernel` 进一步对显式业务 choice 分配概率，使同端点事件成为不同随机后继，并几乎必然返回其依赖 replay witness。有限高度期望界由具体 kernel phase tails 推出为 `H/ε`。跨 runtime admission 的 product 实例化、general-presheaf-DPO replay 执行、`opportunityEpoch` 对齐与为每个包导出 stable-window/fairness/正-$\varepsilon$ 前提仍开放 |
| 研究/证据日志 | 来源核验完成；历史本地构建证据记录于 `formal/build-evidence/`；QA-L4 门槛包为 `docs/qa/0001-theory-closure-qa-l4-readiness.md`；人工评审待定 |
| 引文核验（spec §11） | 原始来源已核实；全局 Petri 坍缩与通用 F2 被拒；"Gadducci–Montanari, Functorial Semantics…"修正为 Meseguer (2005) |
| 形式数学评审人 | 待指派 |
| Formal simulator（§5 检查器） | FCP 后 |
| **八个产品包** | **Cantilune、Cantilune Notation、Libretto、Cast、Baton、Cue、Chorus、Reprise：尚无包源树、清单或规则清单存在。产品符合性是 FCP 后工作；包在准备好时独立实例化证书。包缺席不阻断核心理论 FCP。** |

## 下一步

| 行动 | 负责人 | 到期/评审 | 权威链接 |
|---|---|---|---|
| **核心理论 FCP 门槛** | | | |
| 决定规范图层采用 adhesive typed-presheaf slice 加有限良构位置化本质像（而非已反驳的 whole-slice 等价） | DRI + 形式数学评审人 | Pre-FCP | 本 RFC §4.1 |
| 构造完整锁定 FMS 验收接口的真实 inhabitant 或接受 §16 有限控制边界回退；接口本身现已显式，不得以有限离散片段直接替代 | DRI + 进程语义评审人 | Pre-FCP | spec §13.9，本 RFC §16 |
| 把 P1b implemented_unverified 结果绑定不可变 commit 并取得独立进程语义 + Lean 评审人批准 | DRI + 进程语义评审人 + Lean 评审人 | Pre-FCP | 本 RFC §4.2 |
| 指派 category/DPO、进程语义、Lean 假设独立评审人 | DRI | Pre-FCP | 本 RFC 元数据 / 治理说明 |
| 理论门槛满足后进入 FCP（§9 标准） | DRI | 评审后 | 本 RFC §9 |
| **产品符合性（FCP 后，每包）** | | | |
| 创建包边界与符合性规约模板 | DRI | FCP 后 | `packages/` 结构，`docs/conformance/product-certificate-requirements.md` |
| 各包：提供清单、规则清单及每规则 ProductRuleProofBundle（DAG rank、Petri firing、π 推导、态射视图） | 包所有者 | FCP 后，逐步 | 每包符合性门槛 |
| 各包：提供运行时操作事实（资源策略、授权谓词、删除/静止、公平性/ε 界） | 包所有者 | FCP 后，逐步 | 每包符合性门槛 |
| **已从门槛移除（错误地阻断理论）** | | | |
| ~~把封闭有限多状态 P1c 参考协议提升到全部 15 个 admitted 非 fixture `Config` occurrence~~ | ~~DRI~~ | ~~Pre-FCP~~ | **已拆分：** 理论有 60/60 参考（✓）。产品包为其规则实例化（FCP 后每包） |
| ~~把通用分支事件 kernel 实例化到 certified 异构 runtime admission，跨全部包~~ | ~~DRI~~ | ~~Pre-FCP~~ | **移至产品：** 通用框架完整（✓）。各包提供公平性/ε/稳定窗口前提（FCP 后每包） |
| ~~完成 DAG/Petri 直接规则映射证明~~ | ~~DRI~~ | ~~Pre-FCP~~ | **移至产品：** 通用 rankable-DAG 与 pre-net 构造完整（✓）。各包为其规则提供 rank/firing 映射（FCP 后每包） |

## 12. 2026-07-24 证明范围校正

本节在与 §8、§11 的较早"仍开放"描述冲突时取代后者。本节只记录本地
Lean 实施证据。RFC 仍为 **Draft / pre-FCP**。

1. **一般有限 DPOI。**
   `GeneralFiniteOpenDPOI` 现证明：有限、incidence-complete 的 typed
   open hypergraph 与 adhesive typed-presheaf slice 中 full replete
   本质像等价。对任意范畴匹配，只要编码后的规则腿与 occurrence 均
   monic，普通合法性加固定边界保留即可得到内生两次 pushout DPO
   witness。对两个这样的 parallel-independent 匹配，两条 residual
   均留内生，标准 concurrency diamond 以保持右侧像的 canonical
   同构交换。两个 canonical DPO 方形在 ambient adhesive slice 中还均
   为 Van Kampen。这在该精确的有限良构范围内消除了 fixed-host、
   thin-inclusion 与 `InterfaceLocal` 限制；它不恢复已反驳的
   unrestricted slice 等价。
2. **P1c 有限原生闭包。**
   `P1cFullNativeRefinement` 使用显式中间协议状态，并对全部 15 个
   参考 family、相对于完整 family-tagged `Late.NativeStep` 关系
   证明一份完整 `ProjectionCertificate`。open/close 与 restriction
   保留真实第二 payload 步；mismatch decision、reconnect 与
   quiescent delete 均为原生。精确分类、soundness、reflection、
   terminal 等价与签名版本均已 kernel-built。这闭合的是有限多状态
   参考协议，不是共享 product-wide admitted 规则 family 或全部
   五层证书。
3. **FMS 接口校正，而非 FMS 实例。**
   Lean 证明旧分离式 legacy powerdomain/coherence API 不一致。校正
   后的接口要求 divergence 与 deadlock 不同，并在同一自由泛性质中
   要求 unit/divergence/deadlock/choice 保持，同时要求强交换
   Fubini、局部连续 action、精确 parallel/action coherence、
   canonical hiding 与 operational/world-indexed full abstraction。
   本仓库无 `CompleteFMSAvailable` 的 inhabitant，因此真实
   $\mathbf{Cpo}^{\mathbb I}$ domain-equation/full-abstraction 义务
   仍开放。Binder 级 abstraction/substitution 与 canonical
   restriction 现满足精确往返等式，含嵌套 binder。
   `FMSExactAcceptance` 还把 stage transition 固定为 unroll 加
   powerdomain 观察，restriction 固定为四个 action case，同步固定为
   Fubini/map/multiplication，parallel 固定为精确四路 choice。其
   Table-2 case map 仍是提供的数据，exact 与 complete FMS
   availability 命题均无 inhabitant。
4. **有限异构概率桥。**
   每个有限 `EpochChain` 现有依赖的 `ChainTraceAgreement`，覆盖其
   有序原生事件、`DPOEvent` replay、signature-admission replay 与
   runtime execution-epoch 对齐。定义在 `Fin (事件数 + 1)` 上的
   真实 Ionescu--Tulcea 律几乎必然遵循该完整日程。末端自环只是行政
   stutter，绝不报告为业务事件或 admission。反馈
   observation-opportunity 对齐仍是独立 scheduler 义务；执行 epoch
   不静默等同于 `opportunityEpoch`。调用方给出且满足 almost-sure
   successor phase 与终端吸收的 Markov kernel 现可继承同一完整
   共同轨迹。另一个有限分支构造直接对业务 choice 分配概率，把
   采样 choice 存入后继，区分 unmarked 端点相同的事件，并几乎必然
   携带相应依赖 replay witness。具体异构 runtime scheduler 尚未
   实例化该通用构造。
5. **静态/操作反空洞关卡。**
   新的 coherent certificate 用精确 Arrow 范畴交换方形把静态 SMC
   函子与操作状态/重写映射联系起来。coherent 四投影定理要求四份
   这样的记录。范畴 realization 对 quotient 敏感：state setoid
   等价恰对应 represented-arrow 同构，所选同构 coherent，step cell
   与代表元无关。`FMSGatedFourProjection` 还要求具体
   `ExactFMSAcceptancePackage` 与 `OperationalFMSPiCoherence` 记录，
   后者把映射 π 状态/action/step 等同于该 package 的 denotation 与
   transition 关系。无共享 product 执行包、exact FMS inhabitant 或
   该 π/FMS bridge 目前提供该 bundle，因此这是加强验收边界，而非
   闭合总定理。
6. **证据与治理。**
   `formal/` 不再被顶层 ignore 规则隐藏，但当前 worktree 中仍未
   跟踪，且 `.gitignore` 已修改。这些结果不是 commit 绑定证据，
   也未经独立 QA-L4 评审。FCP 尚未开始，ADR-0001 仍为 Proposed。

因此进入 FCP 前的证明工作更窄但仍承重：构造或独立导入真实完整 FMS
inhabitant；决定 runtime signature 元数据是与纯结构 π 状态分离还是
由 enriched target 表示；把一般 DPOI 与有限 P1c 结果连接到一个共享
admitted 源执行包，并补齐实质性 rankable DAG/Petri/static/resource
与跨层 coherent 证书；实例化分支事件核并证明 scheduler 级
opportunity/fairness 对齐；取得所需独立评审。

## 13. 2026-07-25 extension-family 与执行校正

以下本地 Lean 结果在不改变本 RFC 的 Draft/pre-FCP 状态下细化 §12。

1. `ProjectionFamily` 现对每个有限签名索引实际源与目标
   `ExecutionPackage`。Reindexing 满足状态/事件身份与复合，且
   verified 事件记录相等使 replay 与签名扩展交换。
   `FourProjectionFamily` 强制四目标共享一个源 family，证明逐签名
   操作一致性、两次 admission 自然性与四目标 replay 交换。无
   production family inhabitant 该接口。
2. `FourProjectionSampledTrajectory` 从一条采样分支边导出源事件、
   原生步、verified DPO replay、精确端点、opportunity/runtime epoch
   相等、singleton epoch chain 与全部四个原生目标步。这是完整
   固定签名共同轨迹。跨签名 admission 仍是独立、正确的
   `AdmissionReplays` 情形。
3. request/accept 桥现有真实未过滤 structural strong-late 单步
   soundness 与精确 success/wait/version 等式。完整
   `StandardLateReflection` 仍需任意 alpha/structural 代表下的
   derivative 唯一性。Lean 也证明 S4 choice 幂等不是当前结构同余的
   规则，因此须由预期等式/双模拟层提供。
4. 严格 DAG 范围现双向有界：任意 typed open hypergraph 不能全部带
   rank，而每个携带显式严格 incidence rank 的图都有具体
   incidence-complete、boundary-preserving、无环 DAG 视图。Production
   DPO 规则仍需 rank 保持。
5. 授权投票、去重、顺序无关、全部四种 quorum 结果与被观察方自治
   已 kernel-checked。admitted P1c 正支撑有具体单调反馈桥；零质量
   reset 被形式化排除于任何路径单调 0/1 证据映射之外。Product 冲突
   与调度策略仍是 RFC 决策。
6. 等式序有限集端函子在 ωCPO 上存在，但 Lean 证明它与其
   `World ⥤ ωCPO` 逐点提升都不能在一般有序对象上携带所需连续
   singleton unit。这排除离散片段作为 FMS powerdomain；它不提供
   Abramsky 构造或 domain/full-abstraction inhabitant。外部 FMS
   来源在 Proposition 2.2 中陈述：合适的 base-Cpo Abramsky
   powerdomain 逐点提升到 `Cpo^I`，再用
   `A = μX. P(H X)`，其中
   `H X = N × (N ⇒ X) + N × N × X + N × δX + X`；Theorems 3.2 与
   3.3 陈述有限与完整闭 strong-late full-abstraction 结果。这些
   论文定理是来源义务，不是 Lean-kernel 证明或本地验收结构的
   axiom-free inhabitant。
7. `ExactPositionalDPOI` 把 exact-positional 对象刻画升级为与
   adhesive typed-presheaf slice 中 full 子范畴的显式等价。它
   包含 exact 对象间的每个 typed natural transformation，并保持
   与反射 monomorphism，因此 fixed-host、thin-inclusion 与
   `InterfaceLocal` 限制在此范围内不存在。它不声称与
   unrestricted slice 等价，后者仍含 malformed、无限、
   incidence-incomplete 与 duplicate-boundary 对象。
8. `FiniteHeterogeneousFourProjection` 把 sampled 共同证据扩展到
   对齐的有限 `EpochChain`。几乎每个非终端 phase 都有一个采样
   依赖 mark、replay、execution-epoch 对齐，以及带四个原生目标推导
   的可 replay 业务 `DPOOccurrence` 或独立
   `AdmissionOccurrence`。`SourceFamilyAlignment` 显式给出，因为
   chain 保存任意存在量化执行包。纯 reindexing 不能提供四目标
   admission replay：已核验 no-go 定理利用 `Config.reindex` 保持
   `signatureVersion` 而 replayed admission 严格推进它这一事实。需要
   独立异构目标 admission transition 与证据。

因此剩余承重工作是 production inhabitation 而非再增加通用
wrapper：精确 P1b 结构 reflection、每个 admitted 规则的
rank-preserving DAG 与声明顺序 Petri 映射、全部非 fixture P1c
occurrence 与资源、异构目标 admission transition 与 replay 证据、
异构授权/公平随机 scheduler、真实完整 FMS 模型与操作桥，以及
commit 绑定的独立评审。

## 14. 2026-07-25 原生规则与生成运行时更新

本更新取代 §12–13 中较窄的实施陈述，但不改变 RFC 的 Draft/pre-FCP
状态。

1. 合法 typed π transition 现用 `Step.StandardNativeStep`；所有
   标准 freshness 与 capture 前提属于关系成员。每个这样的
   transition 擦除为一步原生 standard-late 步。全部十五个 P1c
   参考 family，含 mismatch decision、reconnect 与 quiescent
   delete，都有此证明。
2. 全部十四个固定签名 P1c family 共享一个参考
   `ExecutionPackage`，带精确 verified 事件 replay 与四个原生目标
   推导。三项 admitted 图操作还重新执行其具体 enabling 与 match
   fingerprint。动态 admission 仍是异构 `AdmissionReplays` 边。
3. admitted-operation 概率桥现构造具体
   `TrajectoryAgreement`，含被选事件 mark、精确相邻 `Config`
   replay 与 epoch 对齐。另一个有限可执行异构 runtime 构造其
   scheduler 与 Markov kernel，穿过一次真实 admission，并在每条
   边几乎必然保留两个业务 DPO occurrence、admission occurrence、
   唯一依赖 mark 与四个原生目标推导。这闭合了有限参考 scheduler
   的非空洞，而非 product authorization/fairness/epsilon。
4. 有限位置化 DPOI 范围已实现：与 full exact-positional 子范畴的
   显式等价、任意合法 monic complement 与 Van Kampen 方形，以及
   parallel-independent concurrency。形式反例排除用
   unrestricted presheaf slice 替代该目标。
5. CPO 层现含真实非离散有限严格计算对象，带独立 divergence 与
   deadlock。它不提供全 omega-CPO Abramsky powerdomain、omega-ideal
   自由泛性质、递归 domain 解、hiding/action coherence 或 full
   abstraction。
6. 精确结构 P1b reflection 仅在通过任意 alpha/ACU/scope-extrusion
   链的 residual coherence 处开放。complete 状态已证明不能步进，
   且从 established 状态的每个结构步现精确为 `tau`，目标与
   complete 同余。Requesting 仍需 binder-substitution 与
   `res(com)`/`open+close` residual 定理。
7. 十四个固定签名业务 family 现共享可 replay 的 DAG、Petri 与
   morphism 证书。每个目标 transition 含其独立原生矩阵推导并保留
   源事件 provenance；soundness、精确 reflection、路径覆盖、
   terminal 保持与 verified 源 replay 因此指向同一 occurrence。
   参考 graph/resource carrier 为空，因此任意 product rank、
   pre-net、resource、static-SMC 与异构 admission 义务仍开放。
8. 每个具体 admitted mismatch/reconnect/quiescent-delete
   occurrence 现有四路 post-business 分类：成功、外部等待、
   真正 deadlock，或显式 productive 无限 external-hold trace。
   类两两互斥，每个端点表示同一计算 `Config`、replay 记录、
   四视图推导与 admitted ownership 证据。该分支是一次重写后的
   外部 disposition，而非四次不同重写。
9. 完整本地 evidence gate 对 234 个 Lean 源与 8889 个 build job
   通过，零禁止证明占位符，487 份 kernel-dependency 报告限于已记录
   allowlist。这是未提交本地证据，而非不可变 provenance 或独立
   评审。

因此剩余 stop condition 在种类上不变但范围更窄：真实 FMS
构造/导入、精确 P1b residual reflection、production
rule-family/static/resource inhabitant、authorization/fairness/
stable-window/正-epsilon 前提的推导、不可变 commit 证据，以及
独立 QA-L4/FCP 评审。新的参考见证不会静默解除这些。

## 15. 2026-07-25 P1b reflection 分解 helper 与构建恢复

本更新为开放 P1b `StandardLateReflection` 义务增加 kernel-checked
脚手架，并修正未跟踪 `formal/` worktree 中的两处构建缺陷。它**不**
晋级任何义务，也不改变 RFC 的 Draft/pre-FCP 状态。

1. **P1b reflection 分解。** `P1bStructuralLateBridge.step_decompose`
   现 kernel-checked：每个
   `Late.structuralLateLTS.ObservableStep (mapState state) action
   target` 分解为结构同余 `Struct (mapState state) source'`、原生步
   `NativeStep source' action target'` 与目标同余
   `Struct target' target`。这正是 `Step.congr` 构造子的形状，其中
   `Step.native` 同一性情形被折叠，且它是完整
   `StandardLateReflection` 证明必须驱动的已核验子结构。
2. **complete-态反演。**
   `P1bStructuralLateBridge.complete_reflect` kernel-checked：没有
   `Late.Step` 能通过任何结构同余代表离开 complete request/accept
   状态，因为结构同余保持 prefix count 而原生 strong-late 步要求
   正 prefix count。这解除了 `StandardLateReflection` 的
   `complete` 情形。后续精确 free-subject/prefix-partition 定理也在
   不使用弱步或过滤的情况下解除 `established` 情形；只剩
   `requesting` 开放。
3. **构建恢复。** 未跟踪 worktree 中两处缺陷曾阻止 clean full
   build：`P1cAdmittedP1aCertificates.lean` 引用 `Core.Package`
   类型却未导入 `Cantilune.Core.Package`，其回归测试使用未加限定的
   `P1cAdmittedOperations.DAG.Step` 标识。两处均已修正。完整
   `lake build` 现成功完成（8894 job），零禁止证明占位符。这是
   worktree build，不是不可变 commit-bound 证据。
4. **已实现范围限定重申。** 本仓库无
   `CompleteFMSAvailable` 的 inhabitant。因此 worktree 中当前实现
   的定理仅限于已证子语言（DAG/Petri/morphism 参考视图；π 对有限
   request/accept 与 P1c 参考 family，模开放的
   `StandardLateReflection` residual）。这是证据边界，非已采纳的
   规范性 fallback。在当前有效 draft 下，完整 half-π (II) FMS
   domain-equation/full-abstraction 义务仍强制且显式 unverified；
   仅 FCP 接受 §16 能把它移出 P1 完成关卡。

剩余承重工作取决于下文提出的范围裁决。无论如何仍含 `requesting`
结构 residual transport、production
rule-family/static/resource 证书、scheduler 前提、不可变 commit
证据与独立 QA-L4 评审。在当前有效 draft 边界下，完整 FMS
inhabitant 仍强制；仅当 FCP 接受 §16 提出的有限控制边界后，它才
不再是 P1 关卡。

## 16. 2026-07-25 提交 FCP 的 FMS 范围收敛提案

**决策状态：Proposed，尚未生效。** 本节消除 draft 内部歧义，但不
记录共识、评审或接受。Decision Owner 与必需的
process-semantics/formal-math 评审人必须在 FCP 中裁决。

### 16.1 拟议的规范性 P1 边界

1. P1 的规范性 π 投影是 typed、有限控制 open-process presentation
   连同原生 standard structural late-π LTS。递归与 replication 仍
   在 P1 外，如 §4.3 所述。
2. 四投影定理要求精确原生操作 π 证书，含 provenance、reflection、
   replay、资源与终态观察。它**不**要求指称
   `Cpo^I` full-abstraction 定理。
3. `FMSGatedFourProjection` 仍为独立可选 conformance gate。调用方
   仅在提供具体 `ExactFMSAcceptancePackage` 与 operational/FMS
   coherence 后才可宣称 FMS 指称扩展。无当前支撑对象、有限幂集或
   非离散有限 CPO 片段 inhabitant 该 gate。
4. `Set^I` 支撑自然性与有限 `P_f(H-)` approximant 仍是有用的机械化
   组件，但在 normal-form 双射与操作等价本身形式化之前，不得称为
   有限 FMS universality/full-abstraction 定理。

### 16.2 这为何是范围边界而非证明捷径

源模型区分两个结果。其集合论解释对有限 agent 是 universal 的，
而整体演算 domain 模型使用 Abramsky 的 powerdomain、递归方程
`A = μX. P(HX)` 与外部递归 domain-equation 技术。该 extended
abstract 明确把 powerdomain 描述为 CPO 上的自由严格半格构造，并
调用标准 domain-equation 结果获得初始解；它不提供可直接移植到
Lean 的基础构造。见
Fiore--Moggi--Sangiorgi，
[A Fully-Abstract Model for the π-calculus，§§2.1–2.3 与 §3](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)。

Cantilune 的 admitted P1 演算刻意排除需要整体演算 CPO 完成的递归
与 guarded replication。把 CPO 定理设为独立、可选的 gate 因此把
对外宣称的定理缩小到实际选择的 runtime 语言；它不从有限支撑
片段外推 full abstraction。

### 16.3 后果与所需裁决

- 若 FCP 接受该边界，`CENTRAL-12` 须拆分为规范性有限控制
  operational/open-SMC 义务与可选外部 FMS conformance 义务。后者
  可保持无 inhabitant 而不阻断 P1，且任何文档不得宣称 FMS full
  abstraction。
- 若 FCP 拒绝该边界，当前 stop condition 保持：在全 ωCPO
  powerdomain、递归自然初始 domain 解、hiding/coherence、
  adequacy 与针对所选 source-calculus 范围的 process-pair
  full-abstraction 定理 kernel-checked 或经批准的 source-pinned
  trusted theorem policy 导入之前，P1 不得称为理论完成。一般
  algebraic compactness 是可能的构造路线，非 FMS 所述定理或强制
  方法。单独的 domain-element definability 要求须先由 RFC 定义其
  carrier 与量词；它不属于所引 full-abstraction 定理。
- 无论哪一分支，本 worktree 都不能自行把 RFC-0002 推入 FCP 或把
  ADR-0001 改为 Accepted。独立评审、不可变构建 provenance 与
  Decision Owner 裁决仍为强制。

## 17. 当前证明证据修正（2026-07-26）

**决策状态仍为 Proposed。** 第一份
`ProductRuleAdmission.Certificate` 对每个参数选择均无 inhabitant：
其内嵌源 admission 是一个固定签名 `ExecutionPackage` 的一步，其
replay 保持签名版本，而同一组字段又要求 admission 严格推进该版本。
源级定理 `certificate_uninhabited_fixed_signature_admission` 现
kernel-check 该矛盾。因此该 legacy 记录是负面回归，而非 product
完成接口。

`Core/EpochSeparatedProjection.lean` 与
`Theorems/HeterogeneousProductRuleAdmission.lean` 现提供
root-imported、kernel-built 的固定签名业务 coherence、异构源
admission 与四个独立类型化目标 admission 之间的分离。
`P1cAdmittedFourOccurrence.fixedOccurrence` 还为每个具体 admitted
P1c 操作构造一个实质固定 epoch DAG/Petri/native-late-pi/morphism
occurrence，含精确源与四目标 replay。
`FiniteExecutableEpochProjectionReference.fourTypedViews` 另外构造
一个非空跨 epoch 参考 bundle：独立 old/new target package、四份
固定 epoch projection、四个独立类型化原生 admission、严格版本
推进、精确 replay 与真实可见 pi registration 输入。其余
DAG/Petri/morphism 目标是有限参考语义，而非 production 模型。尚无
product 提供跨 epoch coherent projection family、实质 production
target admission 关系，或完整
rank/resource/authorization/fairness/正-epsilon bundle。

对 P1b，七个聚合 requesting 指标已证明不足。加入精确 free-name
与 free-subject 集排除已知反例并给出九字段必要候选。root-built
算术与语法层现导出两个长度为二的活动线程、精确原生
`4 -> 2` 消耗、residual send/receive polarity 与外层
restriction/parallel normal form。nominal-orbit 模块还证明唯一
自由 payload 未被捕获并位于活动 output-value 位置，且在完整
alpha/structural 关系下不变。native-constructor 反演模块还排除单
顺序两前缀线程的静默步，覆盖 slow capture-avoiding freshening，并
按结构同余提取两个 residual 单前缀通信线程。linked-core 与
endpoint 模块证明全部四个 direct/crossed sync/close 原生情形，并
通过 alpha 转换、restriction permutation 与 scope extrusion
归一化端点。native parallel-zero 反例固定定理强度：实际目标只需
与某个存在性 linked endpoint 结构相关，而非语法相等。
`StandardLateReflection` 仍在
public/session/input-binder incidence 定位与任意 source-side
`Struct`/native 反演桥处开放。

固定 Lean 4.32.0 evidence gate 现本地通过 283 个 Lean 文件、
root 8938-job 构建，与 667 份限于
`propext`、`Classical.choice`、`Quot.sound` 的依赖报告。这是
dirty-worktree 证据，而非不可变 commit provenance。依赖核验也未
发现现成 Lean 包提供完整 all-omega-CPO FMS 栈；因此 powerdomain、
递归自然初始 domain 解、hiding/coherence、adequacy 与 process-pair
full abstraction 在当前有效 RFC 边界下仍缺失。仓库也缺少
Cantilune 附加验收所需的精确 per-label 原生单步对应、强
powerdomain-observation inverse-image 律与
divergence/deadlock 不等性证明。

无中央义务 `proved` 或 `reviewed`。不可变构建 provenance、
product-rule inhabitant、独立 QA-L4 评审、FCP 与 ADR 接受仍缺失，
本节不记录任何审批或范围变更。

## 18. 2026-07-26 标记 residual 与操作闭包检查点

P1b 剩余义务不再是原生规则选择、context 对齐、restriction 垃圾
或线程 polarity。kernel-built 模块现反演全部四个 sync/close 原生
构造子，在完整 alpha/structural 轨道保持 guarded polarity pair，
并提取一个共享 restriction context，其中恰含一条 send/send 与
一条 receive/receive 线程。独立 envelope 定理归一化两个 essential
outer binder 或 scope-extruded 单 outer binder close 情形，同时仅
移除 fresh 垃圾 restriction。完整 reflection 定理已证等价于单一
target-up-to-structure linked-endpoint classifier。

`P1bNominalIncidenceBoundary` 将其打包为单一非循环
`RequestingPolarizedNominalIncidence` 命题，基于真实 split。
kernel-checked 定理从中导出 up-to-structure endpoint classifier、
requesting reflection 与证书。
`P1bNominalIncidenceProof` 把其构造归约为
`RequestingSplitSupportTransfer`，而
`P1bNominalIncidenceClosure` 分别对 `syncLeft`、`syncRight`、
`closeLeft`、`closeRight` 证明该 transfer。所得
`requestingPolarizedNominalIncidence`、精确
`requestingNativeResidual`、`standardLateReflection` 与无条件
`pi_ra_certificate` 现 kernel-built。精确 target 语法、固定双
binder 外层列表与聚合 prefix/polarity 计数仍被其 checked 反例正确
排除。

这完成的是工作树中的 P1b request/accept 操作定理，而非 RFC 或
整体四投影计划。CENTRAL-13 仅
`implemented_unverified`；集成的 dirty working tree 虽通过新一轮
完整 CI 与 axiom 审计，仍须绑定不可变 commit 并由独立
process-semantics/Lean 评审人批准。完整 FMS package 或被接受的 FMS
范围决策、production product-rule 证书、FCP 与 ADR 接受仍待完成。

修正后的异构 product-rule 接口现也已被证可居。一个有限参考在
严格 epoch admission 两侧提供 coherent static/operational
projection family、四个目标 admission、一个独立 ranked 业务步、
resource/session policy、authorization、fairness 与正-epsilon
bridge，其概率一边是从 unstable ready 到 stable done 的真实业务
步。这仅是通用接口的反空洞 witness：四个目标 family 均为同一性
参考语义。它不解除任何 production 规则的 DAG、pre-net、π、
morphism、authorization、fairness 或 convergence 证书。该参考还
检查业务规则在 admission 前不可用、之后可用，并证明 replay 拒绝
错误规则或错误源。这些加强接口非空洞而不提供任何 production
projection family。
RFC 仍为 Pre-FCP，本节不记录范围决策。

## 19. 2026-07-26 FMS 定理范围校正

本节校正来源归属，不改变 Proposed、Pre-FCP 决策状态或任何 stop
condition。

1. **递归解。** 已核验 FMS 来源把
   `A = μX. P(H X)` 表述为由标准递归 domain-equation 技术取得的
   初始解。Cantilune 因此要求连续自然初始解及其 roll/unroll
   coherence。除非后续 RFC 明确选择更强本地构造路线，否则不要求
   一般 algebraic-compactness 定理。
2. **Full abstraction。** 源定理对进程项对量化：denotational
   相等等价于 strong late bisimilarity（含相应 open-congruence
   结果）。它未声称递归 domain 的每个元素都可语法定义。任何独立
   definability 定理都是 Cantilune 的附加提案，其 carrier、
   approximation class 与量词须显式裁决。
3. **Source-calculus 边界。** FMS 演算含 guarded replication
   `!α.P`。Cantilune 当前 Lean `Raw.Proc` 是有限控制的，既无
   replication 也无 recursion。因此关于该 Lean 语法的定理是片段
   定理，而非 FMS 任意进程定理的实现。加入
   replication/recursion 仍触发既有范围 stop，并要求 RFC/ADR
   决策。
4. **附加 Cantilune 条件。** 精确 per-label 原生单步
   soundness/completeness、强
   `PowerdomainObservation.map_iff`/`multiplication_iff`
   inverse-image 律（含 divergence-observation 策略），以及指定
   divergence 与 deadlock 不同的证明，是本地验收条件。它们不是
   所引 FMS full-abstraction 定理的直接陈述。

本校正不 inhabit 完整或精确 FMS acceptance package。完整 FMS gate
在当前有效 draft 下仍强制，除非 FCP 接受 §16，且 RFC 仍为
Pre-FCP。

## 20. 精确 action 与有限链收敛更新（2026-07-26）

本更新不改变规范性范围或 Pre-FCP 状态。

精确 FMS action 端函子 `H` 及其有限世界单射作用现已在
`World ⥤ ωCPO` 上构造，且 `H` 与实际未分离复合 `P ∘ H` 均局部
连续。未分离 lower/Hoare monad 在 chosen-product 上有
strong/commutative coherence。它对任意 sup-preserving 映射到
complete-lattice 目标是自由的。该 universal 定理刻意不与所需自由
pointed continuous semilattice 等同：bottom 与 empty deadlock 仍
重合。

有限初始近似塔是真实的，但首条 connector 无 retraction，stage
零不是 fixed point。新的条件边界接纳外部构造的连续自然
`A ≅ P(H A)` 连同 initial-algebra 与 terminal-coalgebra 证据，并
可 transport 到现有 `AgentDomainSolution` 接口。本仓库未构造该
witness、分离的 `CpoPowerdomainPackage` 或完整 FMS package。

对 product，任意有限跨 epoch chain 现保持全部五个 replay、精确
rule 与 admission 标签、严格签名版本与 execution epoch。其 canonical
源概率空间携带五视图共同轨迹，保留每个依赖 `DPOEvent` 与全部四个
原生目标推导。直接 FMS adapter 仅对一行保留真实 rule 与 admission
transition。它不直接组合：该行的 eventful after epoch 不能等于下一
adapter 的 empty before epoch，且记录既不固定一个共同 FMS
package，也不存储 denotational 端点连续性。

任意有限操作定理以已提供的精确五视图边界为条件；FMS-gated 直接
定理仅一行。八个计划 production package 仍无 package 源树或规则
清单，因此其证书前提不能在无 product-owner 输入下填充。具名
Open-pi 工作也仍部分：构造了 alpha-safe bound-output 标签、
contextual category 与 disjoint partial tensor，而 checked no-go
定理排除仅由 bound-name alpha 重命名得到非空 identity，并排除
unrestricted name-fusion interchange。

可变 working tree 通过普通本地 gate：343 个 Lean 文件、8997 个
build job 与 987 个核验声明。完成 gate 仍拒绝 11 个
`implemented_unverified` 与 7 个 `partial_scaffold`。本节不记录
FCP 决策或范围放松。

## 21. NDωCPO/AFT 与精确边界更新（2026-07-26）

> 历史检查点：§22 取代本节关于全源 solution set 与 enriched
> adjunction 仍缺失的陈述。

本更新不改变规范性完整 FMS 范围或 Pre-FCP 决策状态。

仓库现含真实普通范畴 `NDωCPO`：omega-CPO 携带最小 divergence、
独立 deadlock 与连续 semilattice choice，态射为保持三者的严格连续
同态。小积与 equalizer 给出 `HasLimits.{0}`，carrier 函子保持所
构造极限。其 hom 集携带逐点 omega-CPO 结构，forgetful action
局部连续，复合联合 omega-连续。

在该历史检查点，general-adjoint-functor 路线仍条件性。§22 取代
该状态：全源 cardinal closure、solution-set condition、普通
adjunction 与 enriched hom adjunction 现已构造。早前本地
empty-source universal arrow 与有限 strict-powerset 反例仍为有效
支撑结果，但不再描述最强 adjunction 结果。

具名边界核验也更锐利。构造了一般 input 与 bound-output action
标签及其 derivative alpha quotient，有限 hiding 加 sync/close 传播
为原生单步 transition。然而在当前 concrete-name 边界表示下，
checked 障碍排除总 occurrence-preserving tensor 与非空边界上的
exact-name plug。总具名 Open-π SMC 需要研究记录中已列出的公开
重命名/fresh-supply/wire 表示变更与 coherence 证明；它不能由
alpha 转换推出。

两行共同 FMS 定理把第一 eventful 端点带入第二次 admission，按类型
索引固定一个共同 FMS package，并为四个原生
admission/rule/admission/rule 边存储操作与指称 seam。后续定理现
分别耦合两个调用方提供的真实 production Ionescu--Tulcea 律，并
通过一个共同 exact-FMS seam 导出 almost-sure 原生标签、精确 DPO
replay、epoch/签名对齐、共同 action 与连续 denotational 端点。它
不构造两个 production kernel、其 semantic coupling，或仍无
inhabitant 的 exact FMS package。

八个计划 distribution 仍无 package 源树、manifest、规则清单，或
package-owned rank、pre-net、resource/session、authorization、
fairness、stable-window 与正-epsilon 事实。通用证书 gate 不能
制造这些操作输入。

精确可变源状态通过普通本地 gate：359 个 Lean 文件、9013 个
build job 与 1043 个核验声明，零
`sorry`/`admit`/`axiom`/`unsafe`，axiom 审计仅
`propext`、`Classical.choice`、`Quot.sound`。`-RequireComplete`
仍精确拒绝 11 个 `implemented_unverified` 与 7 个
`partial_scaffold`。这不是不可变或人类评审证据，也不记录 FCP
决策。

## 22. 全源 adjunction 与分离交换性冲突（2026-07-26）

本更新记录新证决策边界；它不作该决策。

可变 Lean 树现对严格 pointed continuous-semilattice carrier
functor 构造真实全源 `SolutionSetCondition.{0}`。因此得到普通自由
functor/adjunction，并利用逐点 hom omega-CPO 得到真实 enriched
hom 等价，含连续自由扩张与两参数自然性。

由该 enriched 自由扩张导出的 canonical 顺序 Fubini map 联合连续。
其 pure-unit、双变量自然性、两个 unitor、reassociation、
左 multiplication 与 pure-left 右 multiplication 律均已
kernel-checked。它在其第一计算参数上对 divergence 与 deadlock
均严格。kernel-checked 定理
`no_commutative_first_strict_pairing` 证明加入 swap 交换性使两个
常量相等。因此当前组合：

1. `divergence_ne_empty`；
2. divergence 与 deadlock 的严格保持；以及
3. canonical 交换 Fubini

不一致。已证的顺序 coherence 律无法修复失败的对称方程，且不声称
任意双 effect multiplication 或 interchange 律。

FMS 来源指定交换 sequencing 与严格 semilattice homomorphism，但
未声明附加 Cantilune 不等式。它也未把无限原生 tau 运行等同为
powerdomain 的序论 bottom。因此 source-compatible 路线可保留交换性
而不要求 effect 层 `bottom != zero`，仅通过递归 agent 与 full
abstraction 恢复进程区分。FCP 因此必须选择：在该 effect 层放弃
分离、保留分离并使用非交换/求值有序 effect，还是更改
代数/同态理论并重证其语义后果。任何实现不得静默在这些可观察
不同的路线间选择。

canonical 位置化具名边界实验与稀疏事件核 trajectory 定理缩小了
另两个缺口，但不消除治理或 product 前提。独立评审发现任一操作数
到 realized middle 的端点重命名，以及 quotient-Hom-to-raw adequacy
bridge。有限控制 no-go 仅排除显式假设的任意长运行 realization，
而非结构或生成的 wire。八个计划 package 均不提供其规则或 runtime
事实集。

本 RFC 仍为 Pre-FCP。

## 22.1 与来源一致的 effect 范围与真实 kernel 更新（2026-07-26）

FMS 来源核验校正一项验收前提。来源要求交换 monad、semilattice
zero/choice 与严格 semilattice homomorphism，但不要求 powerdomain
序 bottom 与 semilattice zero 不同。它也未把无限原生 tau 运行等同
为 carrier bottom。因此 kernel 定理
`no_commutative_first_strict_pairing` 揭示的是 Cantilune 附加的
effect 层不等式、全对对称性、两常量严格保持这一组合内的不一致；
它不反驳原 FMS 路线。

canonical 顺序 Fubini 构造现有双变量自然性、两个 unitor、
reassociation、左 multiplication 与 pure-left 右 multiplication 的
kernel 证明。其对称性仍被反驳，且不声称任意双 effect
interchange。仅支撑分离在两个 distinguished 常量均带空支撑时并不
消除冲突，因为该对仍相容。

guarded-replication 扩展现有精确 free-name substitution 公式、
self-substitution、支撑组合、精确 replicated-input freshening
方程，以及显式 whole-syntax freshness 下的进程组合。kernel 反例
排除更强无条件律。严格确定性 freshening equivariance 仍为假；
完整通信闭包须按 alpha 表述。

概率桥现作用于两个调用方提供的真实 Ionescu--Tulcea kernel。在
精确 coupling 与共同 exact-FMS seam 下，它导出 almost-sure 原生
标签、精确 DPO replay、共同 action、epoch/签名对齐、链式
denotational 端点，以及相关状态 denotation 相等。它不构造
kernel、coupling、exact FMS package，或八个缺失 product 事实集。

不选择架构方案，不晋级任何完成状态。本 RFC 仍为 Pre-FCP。

## 23. 实验性分离支撑与 guarded-replication 路线（2026-07-26）

本节记录一个架构选项的 kernel-built 证据。它不选择该选项、不放松
完整 FMS gate，也不记录 FCP 决策。

可变 Lean 树现含有限支撑 partial commutative separation
algebra、support-preserving map，以及带显式 braiding、
associator、unitor、penta­gon、triangle 与 hexagon 方程的分离
tensor presentation。其 operational frame 定理仅在 frame 支撑互
不相交时适用。相应地，原生 late-pi action 仅在其完整 name 支撑
互不相交时可交换。两个顺序保留为精确带标签两步 trace，有相同
raw 端点，且仅在由显式 witnessed 原生 commuting square 生成的
replay quotient 中相等。仅标签支撑不相交不是 quotient 规则。同
通道 input/output 对仍相关并执行其原生 tau 同步；它不被交换。

该支撑构造现也提升到真实 omega-CPO 范畴。每个对象显式提供单调
支撑与 `support_omegaSup_bounded` witness；连续态射精确保支撑。
disjoint-pair carrier 有 kernel-built omega-CPO、连续 tensor
map、自然 braiding/associator/unitor，以及对应
penta­gon/triangle/hexagon 方程，含非空有限支撑实例。这是
omega-CPO tensor presentation，尚非 bundled monoidal category、
powerdomain functor、monad、free adjunction 或递归 FMS agent。

支撑分离改变了交换的量化，但其本身不避免双严格常量矛盾。既有
定理 `no_commutative_first_strict_pairing` 不是有限 powerset
no-go：对全对对称 pairing，两个 distinguished 第一参数常量处的
严格性把它们等同。若两常量均带空支撑，它们在 disjoint-support
tensor 中也相容，故同一论证在该对处适用。分离的 Cantilune
effect 必须显式更改支撑赋值、严格性律或代数/同态理论。任何此类
更改改变可观察交换律并要求 FCP。

有限支撑分配现按函子化在有限世界单射上。任两个 fresh 代表由
固定旧像的有限 swap 联系。非恒定世界索引 omega-CPO 支撑模型
提供连续 renaming/permutation、allocation，以及自然
allocation/hiding retraction。这是 nominal 基础设施，而非 FMS
递归 agent 或每个元素都有最小有限支撑的证明。

对仓库已有的实际未分离 omega-Scott world monad，shift 与逐点
power 函子交换，且 unit、multiplication component、allocation 与
逐点 Fubini 方程 kernel-built。这些 delta 方程不分离 divergence
与 deadlock。具体 EP-bilimit 构造现还为该未分离 functor 生成连续
自然 `A ≅ P(H A)` fixed point。这些结果不构造所需 Abramsky
powerdomain、algebraic compactness、adequacy 或 full abstraction。

独立 `RecursiveProc` 候选扩展现仅加入按语法 guarded 单前缀
replication（`repTau`、`repSend`、`repRecv`）。它定义确定性
alpha-freshening substitution 算法并证明其在嵌入 `Raw.Proc` 项
上的兼容性。它还在嵌入有限控制像上证明精确单步保持与 reflection，
并证明不在任何语法 name 位置的替换无捕获风险，含 replicated
input 下。它构造原生 open/close/synchronization/replication 规则
与任意有限长度 trace。独立定理为 replicated tau 给出实际
自然数索引的强原生无限 tau 运行，证明 raw zero 无原生步，并分离
这两个操作谓词。这不是 powerdomain 层的
divergence/deadlock 分离。精确 free-name 公式、self-substitution、
支撑组合、replicated-input 冲突方程，以及显式 whole-syntax
freshness 下的进程组合现 kernel-checked。反例排除无条件语法
no-op 与 unrestricted 组合。严格 permutation equivariance 仍为
假，因此剩余操作闭包须按 alpha。嵌入旧语法上的单步保守性已闭合。
它不改变有限控制 `Raw.Proc` 定理。它不是一般递归方程、guarded
sum、FMS 源语言所需的结构/alpha quotient、总具名 Open-pi category，
或 denotational/full-abstraction 结果。

递归语法现还有覆盖 `recv`、`new` 与 `repRecv` binder 的生成
alpha 等价、一个 quotient，以及作用于进程与 late 标签含 bound
output 的有限 permutation action。prefix、guard、choice、
parallel、restriction、open 与全部三个 replication 规则已证明
精确原生 permutation equivariance。尚未对每个数值 freshening 代表
逐字证明。新的 action-and-derivative alpha quotient 仍通过
derivative-alpha 与 target-alpha witness bridge 接纳 embedded、
synchronization 与 close transition，并在 substitution 不 freshen
时证明严格 equivariance。kernel 反例仍说明为何字面相等不能陈述
一般结果：基于 sup 的确定性 freshening 不与任意有限 swap 逐字
交换。common-fresh-name 构造与 fuel 归纳现证明总 executable
substitution 在所有数值 freshening 分支上按 `RecursiveAlpha`
permutation-equivariant。`recv`、`new` 与 `repRecv` 的
common-fresh 归一化，加上外层 syntax-depth 与内层
alpha-derivation 归纳，现构造
`RecursiveAlpha.substitutionCongruent`。因此完整 sync/close 与
其余每个递归 `NativeStep` 构造子均按 alpha-related target
equivariant，而无弱步闭包。

递归 domain 路线现构造连续 embedding-projection 对、其在实际
agent functor 下的 singleton-seeded 迭代、每个世界的
coherent-thread inverse limit、带联合 monic projection 的自然
world-model limit，以及 canonical 连续 fold `F L -> L`。
`FMSCpoConcreteBilimitExhaustivity` 现证明有限 approximant
单调、逐坐标 exhaustive，且 unfold approximant 单调。因此它构造
连续双侧 inverse 与未分离 omega-Scott `P ∘ H` 上的无条件
`ActualFixedPointWitness`。它不构造
`ActualAlgebraicCompactnessWitness` 的
initial-algebra 与 terminal-coalgebra 字段，也不把该 `P` 转为
source-compatible Abramsky powerdomain。

具名边界元数据路线现有可组合的 sort-preserving renaming、精确
unit/associativity/support-congruence 律、顺序 freshening，以及
avoidance-preserving 的 sorted fresh supply。它还 kernel-reject
当前证书下的非空 same-name atom wire，因为 public 支撑擦除
polarity 而 input 与 output 支撑须互不相交。这不选择新的公开
边界表示，也不构造进程重命名、原生 wire、plug/hide adequacy 或
总 SMC。这些选择仍属本 RFC/FCP。

仍缺失：source-compatible Abramsky powerdomain 与递归 FMS 解（若
FCP 保留附加 effect 层不等式，则还需修改的分离代数/同态理论）、
algebraic compactness、完整 agent restriction/hiding、
adequacy、process-scope definability、full abstraction、带原生
wire adequacy 的总非空具名边界 Open-pi SMC、通用真实 kernel
定理的实际 production-kernel/coupling/FMS inhabitant，以及全部
八个 package-owned 操作事实集。package 名与通用接口不能提供
rank、pre-net、resource、authorization、fairness、stable-window
或正-epsilon 证据。

主要语义参考仍为
[Fiore–Moggi–Sangiorgi LICS 论文](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
与
[Abramsky–Jung domain-theory 章节](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)。
本 RFC 仍为 Pre-FCP。

## 23. Bilimit、递归 alpha 与 monadic hiding 检查点（2026-07-27）

本检查点取代本 RFC 早前把 `ConcreteBilimitExhaustivity` 或
`RecursiveAlpha.SubstitutionCongruent` 描述为 uninhabited 前提的
陈述。

可变 Lean 树现不增加 postulate 地证明以下额外闭包：

- `concreteBilimitExhaustivity` inhabitant approximation 记录并给
  出两个 canonical fold inverse 律、shifted-cone projection-limit
  保持，以及未分离 omega-Scott functor 上的无条件连续自然
  `concreteActualFixedPointWitness`；
- `RecursiveAlpha.substitutionCongruent` 已 inhabitant，且每个
  递归原生 transition 构造子无条件 equivariant 至
  alpha-related residual；
- 实际未分离 omega-Scott world monad 携带 `powerHiding`，含
  allocation、unit、multiplication 与 chosen-Fubini coherence，
  包括具体 effectful support-denotation retraction。

前两个 inhabitant 现已构造。它们刻意保持狭窄：fixed point 针对未
分离 lower/Hoare monad，并非 algebraic compactness，而
alpha/substitution 闭包不选择总具名边界范畴。Monadic support
hiding 仍不是 `AgentDomainSolution.res`、操作 adequacy、
definability 或 full abstraction 证明。公开具名边界表示仍为
RFC/FCP 决策。最后，仓库仍无 package-owned 规则或 runtime 事实，
无从构造八个 production 证书或两个 production Markov kernel。

包级定理 `no_distinguishedFubiniStrictness` 也锐化 FMS 决策边界：
独立于任何有限 powerset 表示，分离 divergence/deadlock、交换
Fubini，与两个常量上的 first-input 严格性不能共存。这不反驳
缺少该附加不等式的 Abramsky 构造；它证明 Cantilune 加强验收
目标不经 RFC/FCP 变更无法完成。推论
`no_strengthenedExactFMSAcceptancePackage` 在完整
`ExactFMSAcceptancePackage` 边界闭合同一矛盾。

因此无中央义务晋级为 `proved` 或 `reviewed`，本 RFC 仍为
Pre-FCP。

## 24. 名义分离与标记 occurrence 检查点（2026-07-27）

可变 Lean 树现含两个进一步、范围严格受限的闭包。

第一，每个有限世界单射保持并反射 disjoint 有限支撑。结果对
permutation 与 allocation map 实例化，提升为实际连续 renaming map
的相等，并用于 transport 具体 finite-support PCM 中的
compatibility 与 partial composition。这是已有分离谓词的 nominal
transport 定理。它不是分离 Abramsky powerdomain、交换
powerdomain monad，也不修复加强的双 distinguished-constant
Fubini 矛盾。

第二，递归 strong-late 操作层现有 provenance-bearing 原生事件与
marked 单步推导。Mark 保留 choice/parallel 路径、隐藏的
synchronization 与 close 通道、open 与 restriction provenance，
以及每个 replication 步的来源。每个原生 raw 或递归单步推导都有
mark，擦除该 mark 恢复原 native 推导。parallel residual square
只能由每个 parallel 分量中的一个 occurrence、完整事件支撑独立
性，以及显式 source/residual freshness 构造。它给出两个精确
顺序为 marked 原生 trace，带共同目标。因此，两个同通道
synchronization 不会假独立，且 `(a.b) + (b.a)` 的反序分支不能构成
residual square。

旧的 label-only replay quotient 并不因此升级：承重独立性结果必须
迁移到 marked residual 关系。由支撑演化自动导出 residual
freshness、alpha-freshened `DerivativeAlpha` residual square，
以及一般递归结构同余 diamond，仍是独立义务。

这些结果不提供本 RFC 仍需的决策或外部事实：

- 已发表 FMS 构造未声明 Cantilune 加强 package 所用的附加
  divergence/deadlock 不等式；保留该不等式连同交换 Fubini 与两个
  distinguished 常量处的严格性已被 kernel 反驳，要求 FCP 变更；
- 总非空具名边界 Open-pi SMC 仍需 FCP 选择公开边界表示、
  polarity/usage、原生 wire realization、进程重命名，以及 Hom
  相等/观察；以及
- 无 production package 提供其规则清单、rank、pre-net、
  resource、authorization、fairness/stable-window、正-epsilon
  事实、production kernel 或 coupling。通用接口不能合成这些
  事实。

无中央状态晋级。RFC-0002 仍为 Pre-FCP，ADR-0001 仍为 Proposed。
