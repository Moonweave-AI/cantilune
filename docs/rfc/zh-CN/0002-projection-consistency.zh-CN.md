# RFC-0002：投影一致性 —— 证明买到什么，以及四投影一致性定理

| 字段 | 值 |
|---|---|
| 状态 | **草案**（pre-FCP） |
| 类型 | 架构 / 形式 |
| 风险 | S2 |
| 提案人 / 决策负责人 | Joker-of-Gotham（DRI） |
| 必需评审人 | 架构（第二读者 —— **待定，缺口**）、形式数学评审人（§4 证明所需 —— **待定，缺口**） |
| 创建日期 | 2026-07-23 |
| 更新日期 | 2026-07-24（证明范围对账） |
| 相关 | RFC-0001、ADR-0001、`docs/spec/formal-semantics.md`、`docs/research/zh-CN/0001-p1b-pi-bridge-audit.zh-CN.md`、`docs/research/0006-theory-closure-iteration.md` |

> **治理说明：** 本 RFC 是 ADR-0001 所指的**生死线**。它*主要不是*一份证明文档 —— 证明在 `docs/spec/formal-semantics.md`。它在主线中的职责是陈述**若四投影一致，cantilune 运行时获得什么能力**、为何该能力才是统一结构的全部意义、以及为挣得它而须证的定理与分期证明。依 DRI 决策，π 投影一致性**非按构造**，按**分期计划**（§4）证明；所有 π 侧主张在证明存在之前为**待证 / 未经验证**。

---

## 1. 摘要（能力优先）

RFC-0001 的统一结构说：`CantiluneGraph` 是一个对象 $(C, R)$，DAG / Petri / π / 态射是它的四种*读法*。这一主张只有当四种读法彼此一致时才值得成立——否则"一个对象"只是"四个被希望粘在一起的互不相连模型"的客气说法，而这正是 OpenClaw 失败模式。**本 RFC 是使"一个对象"成真的工作**（或在 π 线上，诚实报告能使其多真）。

但本 RFC 的要点不是证明本身。要点是**若证明成功，cantilune 运行时得到什么**：

- **可重放的多视角执行（有条件）。** 若每个投影 $P_i$ 把每个具体源事件 $g\xrightarrow{e}h$（含规则、匹配与推导见证）映为保留同一事件身份的指定合法目标推导，则一个执行事件可分别读成数据流推进（DAG）、token 触发（Petri）、通道交互（π）与复合（态射）。仅有“存在某个目标步”的前向保持不足以建立此性质。
- **不会漂移的可观测性（有条件）。** 完整源事件及其投影映射定义完成、且保持/反射均证明后，DAG、Petri、π 与态射 trace 才是同一记录运行的各个投影。这是 RFC-0001 §6.3“可观测性即结构”的预期形式内容；§3.1 的当前证明状态尚未买到该能力。
- **可证伪主张变得可测。** C1（表达力）、C2（步数有界可预知）、C3（控制面精简）都*从*这些一致 trace 上测得。无一致性，指标测的是四个分叉的故事；有之，测的是一个。

故 §3 的定理不是数学装饰——它是 cantilune 三个最大卖点之下的承重墙。若它在四条线中的三条失败，项目如所框定则不能成立；若仅 π 线失败，π 投影缩减为已证子语言（§6），其余成立。

## 2. 这如何推进 cantilune（是逻辑，不是证明）

本 RFC 所处的推进序列是：

1. **RFC-0001 §6.1** 将编排等同为 $(C, R)$，并声称四投影是一个对象。
2. **该声称有隐藏代价**："一个对象的四投影"要么是定理，要么是谎话。ADR-0001 把它定为关卡（生死线），而非假设。
3. **本 RFC** 付该代价——陈述定理、按投影拆分、给出分期证明计划与绑定回退。来源审计修正了原“三者按构造”假设：只有态射同一性情形完整；DAG/Petri 的重写保持仍开放。
4. **所买之物**即 §1 的运行时能力：多视角执行、不漂移可观测性、可测主张。

证明按投影拆分、且此拆分对*项目*（不只对数学）重要的原因，是每条线买不同能力、且各有不同失败方式：

| 投影 | 若一致，cantilune 获得…… | 状态 | 若失败…… |
|---|---|---|---|
| DAG | 数据依赖视角 $=$ 执行视角；可追踪工作流 | 静态读法有条件；重写映射未经验证 | 定义目标并映射每条源规则 |
| Petri | 并发/资源视角 $=$ 执行视角；有界运行，以及相对于已固定成功谓词的死锁分类（C2） | 静态 pre-net 读法有条件；重写映射与成功谓词未经验证 | 定义使能/标记、成功谓词，并把每条源规则映为 firing |
| 态射 | 复合/重构视角 $=$ 执行视角；可复用、可换的件 | 按构造 | （不会失败） |
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
3. **跨投影事件一致性与穷尽性**：从投影源状态可达的每条可观察目标推导，都经 $\operatorname{Lift}_i$ 关联到至少一个端点匹配的源事件。记录的投影事件 occurrence 是带标签对 $\widehat d_i=(e,d_i)$，擦除标签后的 $d_i$ 是原生合法目标推导。因此推导族 $\{(e,\Phi_i(e))\}_i$ 保留同一源事件身份，不捏造或漏失可观察事件。从 raw 推导 $d_i$ 唯一恢复 $e$ 是另行证明的单射/唯一性性质，本定理不预设。
4. **终态观察一致性**：$\mathcal T_{\mathrm{ok}}([g])$ 当且仅当 $\mathcal T_{i,\mathrm{ok}}([P_i(g)])$。结合条款 (2)–(3)，这才在所选可观察商 LTS 上保持 normal form、成功终止与死锁。

条款 (1)–(2) 使每个视角成为**保持结构的读法**；它们本身不蕴含范畴忠实性或操作反射。条款 (3)–(4) 是另需满足的事件/终态观察义务，满足后才可能给出 §1 的收获。

$\Phi_i$ 与 $\operatorname{Lift}_i$ 是额外的重写/操作数据，不是 SMC-函子 $P_i$ 自动具有的事件作用。

**审计限定（2026-07-23）：** 条款 (3) 不会仅由四个前向模拟推出。“同一事件”还需要共享的源事件/重写 ID 与推导见证；尤其 π 侧的 `res(com)`、`close` 与 `com` 等不同推导形状都只暴露 $\tau$。

### 3.1 各投影证明状态

| 投影 | 条款 (1) SMC-函子 | 条款 (2) 事件映射 | 条款 (3) 来源/穷尽性 | 条款 (4) 终态观察 | 总体 |
|---|---|---|---|---|---|
| DAG | FreeSMC 等式商已存在；预期静态目标证书不完整 | 给定 LTS 同构的一般操作 family + 有限 fixture；任意类型化 DPO 映射缺失 | 对给定数据有一般反射定理；预期实例缺失 | 仅有限 fixture | **开放** |
| Petri | FreeSMC 商与声明顺序有限 fixture 已存在；预期静态目标不完整 | 一般操作 family + 有限 firing fixture；一般规则→firing 映射缺失 | 对给定数据有一般反射定理；预期实例缺失 | 仅有限 fixture | **开放** |
| 态射 | 按构造（同一性视图） | 按构造 | 按构造 | 使用同一成功谓词时按构造 | **按构造一致** |
| π（half-π II） | 类型化开进程 presentation 与 mathlib SMC 实例已存在；非恒定 `Set^I`/`Cpo^I` 支撑对象、离散 CPO 有限幂、分配、连续支撑 hiding/回缩等式与有限 `P_f(H-)` 逼近已存在；完整 FMS 幂域/域方程/全抽象实例仍不存在 | 有限 P1c 参考矩阵 60/60 格均为原生推导，并有四份只在各自声明的受限目标关系内精确的按事件索引证书 | 15 个 π 事件均擦除为独立 α/结构 late-π 推导；mismatch、delegation reconnect、quiescent shutdown 均为原生一步，但开放 reconnect/delete 编码还有额外 raw late-LTS 转移 | 仅受限有限参考关系完整，不是整个标准 late LTS | **受限参考 P1c 操作层闭合；完整 reflection、一般/静态/FMS 层开放** |

## 4. 分期证明计划（DRI 决策：明示分期）

证明分期不是为了数学方便，而是因为**每期解锁不同能力**，故项目可在已证者上推进，而不必等最难的那条线。

### 4.1 P1a —— 修正后的三投影一致性工作

- 显式陈述 $P_{DAG}$、$P_{Petri}$、$P_{Mor}$ 为 SMC-函子。
- 证明各自保持 $\otimes$、$\circ$、$\sigma$、$I$。
- 证明各自将 $R$ 提升到目标重写（节点推进 / 触发 / 同一性 redex）。
- **Petri 选择：** 为个体 token 来源采用声明顺序 pre-net/自由 SSMC。原始来源审计拒绝早前全局 Eckmann–Hilton 理由；设计选择以修正后的理由保留。
- **重写限定：** 早前 F2（“每个强幺单函子保持 DPO 重写”）为假。强幺单性不蕴含保推出；DAG 与 Petri 在 $R$ 定义后仍需显式规则/推导映射。
- **机械化边界：** 生成 FreeSMC 相容等价/商及实际 mathlib
  category/monoidal/symmetric 结构已通过 kernel。类型开放超图现为内生
  有限依赖 node/edge fibre，并把有序 incidence position 编入类型。其
  编码采用全部类型 presheaf 态射，因而 full/faithful，并与类型
  incidence-presheaf slice 中的本质像等价。active-support normalization
  现保持具体 morphism 的恒等/复合，并把全局单射的具体 match 映为
  typed-slice monomorphism，因此此 transport 不再依赖早期
  `InterfaceLocal` 固定宿主桥。对每个单态匹配，Lean 已证
  incidence gluing 条件当且仅当 pushout complement 存在，构造 canonical
  complement 并证兼容唯一同构。对任意 canonical 合法有限位置化步骤，
  Lean 现显式构造内生范畴中的第二个 pushout，并证明结果仍在本质像。
  对两条 parallel-independent canonical 步骤，还构造 finite joint
  pullback、两个 residual context、两个顺序结果及内生 residual DPO
  witness。这在显式 gluing 与固定边界保留下闭合了所需有限位置化
  concurrency diamond。尚未把内生范畴等同于整个无限制 slice：无限
  carrier 对象与有限但 incidence 不完整的对象均在位置化本质像之外；
  抽象内生 M-adhesive/van-Kampen 类定理仍待证。
- **操作 family：** 独立给出的 observable-LTS 同构可生成完整操作投影
  证书，三个证书可组合为 P1a family。该定理不会构造预期 DAG/Petri
  语义或其 static/resource/admission 层。
- **五层 family：** 第二个多态构造器可组合三份已经给出的
  static/operational/admission/resource/terminal 证书，并同时推出原生
  重写、admission、资源与终态结果；它不会制造预期 DAG/Petri 值或任意
  DPO 规则映射。
- **能力仅在这些证明之后解锁：** 三视图不漂移执行尚未挣得。
- **产出/状态：** 静态构造已有部分草稿；态射同一性情形完整；DAG/Petri 重写条款开放。

### 4.2 P1b —— π 对 request/accept 通道创建子语言的一致性

- 定义 request/accept 源 $C_{\mathrm{RA}}$，并**同时**构造两条类型正确路线：以类型化开进程 SMC 承担原生操作语义，以逐点笛卡尔 FMS 模型承担指称语义；两者须由显式交换/观测相容定理连接。
- 构造并证明静态 SMC-函子，再对该子语言独立证明原生单步保持、反射与穷尽性。
- **解锁能力：** agent 间通信可跨通信镜头重放——使用 request/accept 寻址的运行，与数据流运行一样可追踪、可重放。这使多 agent 执行成为一等公民，而非不透明的旁路通道。
- **产出：** 子语言的证明。**状态：待证。** 可能需加条件或粒度对齐。若失败，启用 §6 回退。
- **独立核验（2026-07-23）：** 步骤 A–B 已核实，方差修正为协变 $\mathbf{Set}^{\mathbb I}$。交接的步骤 C 张量因类型不成立被拒：$\mathrm{par}:A\times A\to A$ 是 agent 对象内部运算，不是 $\mathrm{Mod}$ 上的张量双函子；双模拟商既非必要也非充分。逐点笛卡尔环境 SMC 只在给出对象像与生成元自然变换后产生条件性静态定理。步骤 E 因 request/accept BNF 与具体 $R_{\mathrm{RA}}$ 缺失而尚未良构。**状态：C0 目标/类型重设计；迭代，不晋级。** 见 spec §13 与研究日志。
- **实施决策（2026-07-23，晚于上述审计）：** 目标/类型重设计选择上述双路线。并行组合在类型化开进程范畴中作为张量；在 FMS 路线中仍是 agent 对象上的内部自然变换。两条路线不得相互冒充；若要改成弱步，必须重新进入 RFC。机械证明状态由 `formal/proof-obligations.json` 跟踪。**在全部证书、交换定理及独立复核完成前，状态仍为 Pre-FCP/M1。**
- **当前有限控制支撑：** alpha 等价、结构同余、避免捕获替换、带
  freshness 前提的强 late 单步及结构闭包已机械化；真正非恒定的协变
  `World ⥤ Type` 与 `World ⥤ ωCPO` 支撑函子、局部无名 supported-process
  函子、自然支撑指称、真正逐点有限幂集 monad 与对象级有限
  `P_f(H-)` 阶段也已存在。具体支撑模型与参考 `OpenInterpretation` 现
  证明逐世界交换；swap 反例同时揭示固定名义语法不是自然全局元。
  allocation 后接支撑 hiding 也已在连续自然变换层证明回缩
  等式；但这不是 FMS agent restriction 运算或 FMS powerdomain/domain
  解。完整 world action、阶段 colimit/初始性、
  充分 hiding、商下降与全抽象仍开放。

### 4.3 P1c（延后）—— π 对自由对话 / 无限制移动性的一致性

- 将 P1b 桥接扩展到有限 epoch 的 half-π (II)：握手后对话、epoch 内无限制名字移动、delegation、自由/束缚输出、choice/match、动态伙伴与签名 admission；内部递归与 replication 不在本 RFC 范围。
- **（若证出）能力：** 开放生态情形——agent 运行时与创作时未知的伙伴对话——也变得完全一致。
- **当前矩阵：** 审计词汇含 15 个源事件、4 个投影列，共 60 个类型化
  格。有限参考演算现有 60/60 个非自反原生格：DAG 使用带 rank 证明的
  无环图重写，Petri 使用带身份的 individual-token firing，morphism 为
  总恒等视图，π 保留其原生类型推导。四个分别命名的受限目标关系均在其
  关系内部有 soundness、reflection、terminal、签名版本
  `ProjectionCertificate`。这不是整个 raw 标准 late LTS 的完整
  reflection：开放 reconnect 与 quiescent-delete 编码还允许额外可见环境
  转移。其有限步形状仍共享同一个 ready-event/completed-event 夹具。DAG 步
  尚未从任意 DPO 匹配导出，Petri 步也尚未从一般 enabling 方程导出。
  因而这里闭合的是参考覆盖，不是一般 DPOI/Petri/FMS 产品规则定理。
- **2026-07-23 请求者授权的修订：** 为有限控制 π 加入标准 mismatch
  guard `[a≠b]P`，其原生一步必须携带真实不等式证明；reconnect 解释为
  普通通道 delegation；quiescent delete 解释为双方 continuation 均为
  `0` 的 shutdown 通信。三者都是原生一步 π 推导，不是 no-op、元数据
  witness 或 $\tau^*$。Lean 已证明 `pi_column_complete`。
  另一个封闭编码还为 communication、open/close、reconnect 与
  quiescent delete 给出真正的强原生 $\tau$ 步，并已精确分类这四个源的
  全部 native 转移。但 open/close 的封闭终点仍有后续 payload $\tau$
  步；Lean 已证明当前每事件两状态的源 LTS 仍不能完整 reflection。完整
  十五事件证书需要经评审的多状态协议或不同的一步终态设计。
- **三项关键操作的非夹具桥：** admitted occurrence 现从具体 `Config`
  计算目标；Lean 从同一 occurrence 推出有限支撑节点/边 DPO 更新、基于
  marking 差的 Petri firing、一个原生标准 late-π 步、morphism 更新与
  endpoint-free recipe replay。Replay 会先核验签名、规则、匹配基数与
  embedding 指纹、complement、freshness、policy、外部证据及事件类型，
  再重新计算目标。这是普通节点/边的可执行片段，尚非一般类型开放超图
  DPOI 语义。
- **这些 occurrence 的具体事件/epoch 概率桥：** 每个 occurrence 现生成
  一个 `ExecutionPackage`；其唯一正质量业务转移携带同一个可 replay
  `DPOEvent`，之后只有显式 completed external hold。每个业务标签轨迹点
  都带同一 DAG/Petri/原生 late-π/morphism 推导及两端 epoch，并已实例化
  几乎必然共同轨迹定理；每个有限子段另有事件真实存储端点、整段
  endpoint-free replay 及固定运行时签名对齐。这仍是固定签名的单
  occurrence 执行包，不是异构签名的一般多事件 epoch 调度器。
- **剩余绑定条件：** 把 60 个参考见证推广到每个获准源规则，并把四份
  操作证书连接到同一静态 SMC、资源、admission 与 replay 语义。本修订
  在 Owner/DRI 与进程语义评审人接受前仍为 Proposed；实现证据本身不会
  接受 RFC。
- **状态：受限参考关系之外仍待证。** 早前缺少原生见证的阻断已解除，但
  完整标准 late reflection 的阻断并未解除。完整 P1c 仍需获接受的
  封闭/受限编码具有精确转移分类，并由一般五层证书共享一个执行包。

## 5. Petri 网级性质检查器（声明性义务）

依 spec §6.2 / §7，有界性 / 活性 / 可达性**非**裸 SMC 给出；它们**在 Petri 投影上**检查。这是从"数学一致"到"C2 可预知性主张可测"的桥梁：一致性说 Petri 视角*即*执行；检查器再从该视角读性质。

- **有界性检查器**（标记可达性有限性）—— RFC-0001 C2"可预知性"（步数有界）所需。
- **活性检查器**（workflow-net soundness 变体）—— 死锁主张所需。
- **可达性检查器** —— trace 完整性所需。

这些是**未来工具**（formal simulator，FCP 后），非本 RFC 证明的一部分。simulator 存在并通过前标记**未经验证**。

## 6. 回退（依 ADR-0001）

若 P1b 无法证明（即便对 request/accept 子语言）：

1. **缩减** π 投影到**能被证明**重写函子桥接的最大子语言。
2. 在本 RFC 中**记录**缩减（哪些 π 构造被弃、哪些保留）。
3. 将所有被弃构造标记为 **P1 不支持**，所有保留但未证构造标记**未经验证**。
4. **不得**声称完整 half-π (II) 的四投影一致性；仅对已证子集声称。

此回退是 ADR-0001"缩减至一致子集"条款在 half-π (II) 决策下的诚实表达。其产品含义，依 §2 之表：若 P1b 失败，未被全买走的是**agent 间可重放性**能力，项目不假装地交付、舍此能力上线。

## 7. 安全 / 正确性含义

- 本 RFC 范围内无运行时、无 I/O；尚未触发威胁建模关卡。
- **正确性风险：** 若定理（尤其 §4.2/4.3）失败且回退未诚实执行，项目核心主张（"统一结构"）为假 —— 此即 ADR-0001 所标战略风险。本 RFC 的纪律（分期证明、回退、未经验证标记）即缓解。具体而言：风险不是"证明难"，而是"我们交付一个多视角运行时、其视角静默地不一致"，这会复现 §1 所说一致性旨在防止的"可观测性与真相分叉"失败。

## 8. 开放问题

1. ~~索引范畴 $\mathbb{I}$ 与目标方差~~ **2026-07-23 已解决**：有限序数 + 单射，含 $up$/$swap$；目标为协变 $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$。非恒定支撑函子与逐世界支撑模型交换实例已存在；余：构造实际 FMS agent/powerdomain 模型、充分 plug/hide 解释，以及严格自然名义指称所需的 supported-process 重命名层。
2. 粒度对齐：一次 π 交互步对应一个源事件，还是多个？（影响 π 的条款 2/3，进而影响“同一事件”在何种粒度上被声称）
3. P1b 子语言是否足够表达以有用？（若否，重评 half-π (II) vs session-typed —— §1 能力表是裁决者：若子语言买不到有用的 agent 间可重放性，须重审该选择，而非静默缩水）
4. 第二评审人 / 形式数学评审人指派（治理缺口）。
5. **DAG/Petri 重写映射：** 定义精确 $R$，证明每个非同一性投影把每条规则映为合法目标推导。pre-net 目标选择已定；重写保持未定。
6. **P1b 形式对象：** 定义 request/accept BNF、配置、$R_{\mathrm{RA}}$、新鲜性、替换，以及 $E_{\mathrm{stat}}$ 与操作编码的分工。
7. **可观察 LTS 与终态谓词：** 独立定义各状态同余、可观察推导域、行政步策略和成功谓词，并证明条款 (4)。$(C,R)$ 本身不能把卡住状态分类为成功或死锁。
8. **P1c 一般化：** 有限参考演算只在各自声明的受限目标关系内闭合
   60/60 个按事件索引格与四份操作证书；须先闭合所选协议相对于整个标准
   late LTS 的转移分类，再为每个获准的一般 DAG、可重构 Petri、π 与
   morphism 规则构造同一来源
   的原生推导，并连接五层证书。
9. **随机执行集成：** 真正 Markov kernel 现可生成 Ionescu–Tulcea
   trajectory measure 与可测 hitting bridge。对有限离散执行包，miss
   递推现已由矩阵行和与给定的点态正 $\varepsilon$ 进展推出。一般有限
   柱事件归纳已经对每个有限原生 kernel 证明 killed-chain/not-hit
   状态轨迹一致性，无须调用方另行提供该前提。具体 Bool 执行包现已选择
   事件标签、重放 `DPOEvent` 并证明固定签名 epoch 对齐；seed 随机化耦合
   已能在同一端点保留不同事件身份，任意有限子段也有真实端点与整段
   replay。仍需跨 certified admission 的异构签名依赖联合核、一般
   presheaf-DPO match/complement/policy 重执行。每个预期产品执行包还须
   导出并对齐 stable region、stable-window、fairness 与正
   $\varepsilon$ 进展见证。

## 9. FCP 摘要（尚未进入）

Pre-FCP/M1。进入 FCP 需：修正后的 P1a 静态与重写证明、P1b 目标重设计并完成证明或诚实回退、指派形式数学评审人、关闭 Q1–Q7。

## 10. 决策记录

- **采纳分期证明**（DRI 决策 2026-07-23）：P1a（三个非 π 投影）+ P1b（π 子语言）+ P1c（延后 π 完整）。本轮审计把 P1a 从“三者按构造”修正为 §3.1 的状态。
- **π 投影按设计为待证**（half-π (II) 决策）；π 无按构造主张。
- **回退纪律绑定**：未证 ⇒ 缩减子集 + 未经验证标记。
- **RFC 重构（本次修订）：** 从证明文档改为"证明买到什么"文档；证明留于 spec，每期加能力映射（§1、§2、§4）。
- **独立核验处置（2026-07-23，历史）：** 拒绝非标准 `|` 张量与“双模拟商是必需设定”的结论；P1b 回到 C0 目标/类型重设计。后续 §4.2 实施决策现已选择替代双路线架构，但不改变“尚未证明”的状态。
- **来源审计修正：** 为个体 token/序来源保留 pre-net 语义，而非因所称全局 Eckmann–Hilton 坍缩；拒绝通用 F2，因为强幺单性不蕴含保推出。
- **已提出 P1c 原生规则修订（2026-07-23）：** π 语法加入带证明的
  mismatch；reconnect 使用原生 delegation；quiescent delete 使用原生
  shutdown handshake。有限参考矩阵已有 60/60 个 native 格与四份仅在
  受限目标关系内成立的按事件索引操作证书；这不建立整个 raw 标准 late
  LTS 的完整 reflection。仍未授权任何弱步替代。

## 11. 跟踪

| 产物 | 状态 |
|---|---|
| `docs/spec/formal-semantics.md`（定义 + 证明） | 草案经独立核验修正；§12、§13 不再过度声称 |
| FreeSMC / DPOI 基础 | 生成 FreeSMC 商、实际 mathlib category/monoidal/symmetric 实例，以及任意目标幺单自然同构比较与唯一性定理已通过 kernel。完整 typed-presheaf slice 是 adhesive；任意单态 incidence 匹配恰在显式 gluing 条件下有 complement，已有 complement 到兼容同构唯一，固定开放边界可显式提升，标准 parallel-independent 推导有一般 residual 与 canonical concurrency 同构。active-support normalization 保持具体 morphism 的恒等/复合，并把全局单射具体 match 映为 typed-slice monomorphism。内生有限位置化超图 full/faithful 嵌入其良构本质像，且已证明所构造的 complement、第二 pushout 与 residual 闭包。这不是无条件 M-adhesive 等价或 whole-slice 等价；后者即使限制到有限对象也为假，Lean 已给出 malformed-incidence 反例。剩余决策是选择哪个正确受限范畴为规范 |
| P1a 证明 | 可复用操作证书 family 与非空有限 DAG/pre-net/态射值已通过 kernel。类型化 self-loop 反例证明，不可能在全部类型开放超图上建立保持 incidence 的总严格 DAG 投影；产品源必须受无环/rankability 限制（或改变目标）。预期受限源的具体 static/resource/admission/DPO 映射仍开放 |
| P1b 证明（或回退） | **有限参考演算已实现，总定理未完成。** alpha/结构有限控制 late-π、原生单步擦除、有限封闭 request/accept 反射、真正逐点有限幂集 monad、局部无名 supported-process 函子、有限 `P_f(H-)` 阶段及具体支撑层 OpenPi 交换实例已通过 kernel。`CompleteExternalFMSTheoremPackage` 现记录完整的 powerdomain 协调、精确 world/action shape、协调 restriction、域解与 strong-late 全抽象验收边界；`CompleteFMSAvailable` 没有 inhabitant，Set/CPO 初始解、Abramsky powerdomain/domain 模型、充分 hiding 与全抽象仍开放 |
| P1c 证明 | 显式有限 60 格参考矩阵现为 60/60 native；四份按事件索引的操作证书在各自声明的受限目标关系内证明 soundness/reflection，每个 π 格另有独立标准 late-π 推导。但这不是整个标准 late LTS 的完整反射：当前开放 reconnect 与 quiescent-delete 源进程还允许可见环境输出，Lean 已证明实际进程映射不存在所要求的完整投影证书。另一个封闭重设计已为四类内部事件给出真正的强原生 $\tau$ 步，并精确分类了这四个源的全部 native 转移；但封闭 open/close 终点仍有后续 payload $\tau$ 步，Lean 进一步证明当前每事件两状态的源 LTS 仍不能完整反射。mismatch、reconnect、quiescent delete 另有 computed-Config 的 DPO/Petri/late-π/morphism/replay 共同推导。仍需经评审的多状态/终态协议选择、其余十二项 admitted occurrence，以及一般 static/resource/admission 层 |
| 随机反馈桥 | 真正 Markov kernel、Ionescu–Tulcea trajectory law、可测 not-hit 事件及条件式 almost-sure 桥已通过 kernel。确定性与 seed 随机化的事件路径耦合在忘却后均严格恢复状态律；后者可为同一端点保留不同原生事件身份。在同一概率空间上，每个有限子段现携带有序原生事件身份、精确 `ObservableLTS.Path`、整段 endpoint-free `DPOEvent` replay、每个事件真实存储的 source/target、opportunity 对齐与固定运行时签名 epoch。有限高度期望界已从具体 kernel phase tails 推出为 `H/ε`，admitted P1c 单阶段实例证明期望次数不超过 1。`opportunityEpoch` 不是运行时 epoch，尚无跨 certified admission 的异构签名随机 `EpochChain` 位于同一概率空间。一般 presheaf-DPO 可执行 replay，以及从每个产品包构造 stable-window/fairness/正 $\varepsilon$ 前提仍开放 |
| 研究/证据日志 | 来源审计已完成；本地构建证据见 `formal/build-evidence/2026-07-23-local.md`；待人工 QA-L4 评审 |
| 引文核实（spec §11） | 原始来源已核实；全局 Petri 坍缩与通用 F2 被拒；“Gadducci–Montanari, Functorial Semantics…”修正为 Meseguer (2005) |
| 形式数学评审人 | 待指派 |
| Formal simulator（§5 检查器） | FCP 后 |

## 下一步

| 行动 | 负责人 | 到期/评审 | 权威链接 |
|---|---|---|---|
| 决定规范图层采用 adhesive typed-presheaf slice 加有限良构 positional 本质像（而非已反驳的 whole-slice 等价），再把已闭合的 DPO 推导连接到受限 DAG/Petri 静态及规则映射 | DRI + 形式数学评审人 | 进入 FCP 前 | 本 RFC §4.1 |
| 构造完整锁定 FMS 验收接口的真实 inhabitant 并实例化 OpenPi 交换桥；接口本身现已明确，不得以有限离散片段替代 | DRI + 进程语义评审人 | 进入 FCP 前 | spec §13.9 |
| 选择并评审封闭/受限的 P1c 协议编码（或在 RFC 中明确修改观察/源 LTS），证明该选择对完整标准 late LTS 的 reflection，再把全部 15 事件提升为 admitted 非 fixture occurrence，且不得使用弱步 | DRI + 进程语义评审人 | 进入 FCP 前 | 本 RFC §4.3 |
| 在一个依赖概率空间上把事件标签耦合扩展过 certified 异构签名 admission；令 replay 执行一般 presheaf-DPO match/complement/policy 证据，并为各具体执行包证明 stable-region/window、fairness 与正 $\varepsilon$ 进展 | DRI + 概率评审人 | 进入 FCP 前 | 研究日志 / feedback 形式化 |
| 构造同一个共享源执行包并证明 `four_projection_consistency` | DRI + 三类评审人 | 进入 FCP 前 | formal proof manifest |
| 指派形式数学评审人 | DRI | 进入 FCP 前 | 本 RFC 元数据 / 治理说明 |
| §9 关卡满足后进入 FCP | DRI | 评审后 | 本 RFC §9 |
