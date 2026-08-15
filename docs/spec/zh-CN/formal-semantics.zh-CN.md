# CantiluneGraph v0.1 —— 形式语义规范

| 字段     | 值                                                                                                                                                              |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态     | **草案**（核心理论已证明；独立评审与治理接受待完成）                                                                                                            |
| 类型     | 规范性规格（形式语义）                                                                                                                                          |
| 风险     | S2                                                                                                                                                              |
| 负责人   | Joker-of-Gotham（DRI）                                                                                                                                          |
| 评审人   | 范畴/DPO/Petri、π/域论、Lean/溯源三类独立评审待签署；DRI/Agent 自审不构成独立 QA-L4 证据                                                                        |
| 创建日期 | 2026-07-23                                                                                                                                                      |
| 更新日期 | 2026-07-28（最大相容 D1-A/Open-π/P1a/admission/common-trajectory 最终边界）                                                                                     |
| 相关     | RFC-0001、ADR-0001、RFC-0002、`docs/research/zh-CN/0001-p1b-pi-bridge-audit.zh-CN.md`、`docs/research/0021-fms-primary-source-boundary-2026-07-27.md` 至 `0027` |

> **治理说明：** 本规范定义 RFC-0002 必须证明其一致性的形式对象。历史
> **待证 / 未经验证**与局部构建记录只保留为时间线；当前实现边界由 §21、
> RFC-0002 §25–§28 与 proof manifest 控制。CENTRAL-12 是最大相容命题
> `MaximumCompatibleD1AFMSClosure`：其 separated enriched-adjunction
> 分支与非分离 D1-A monad/domain 分支不是一个模型。actual-Agent 全抽象
> 仅覆盖确定性的 typed tau/free-output prefix trie；guarded 结果使用
> native-trace/contextual-Hoare 观察。八个生产包尚未实例化。中央义务现已
> 绑定不可变 source/build evidence 并标为 `proved`，证据入口见
> `docs/README.md`。任何构建均不能自行产生 reviewed、FCP Passed、ADR
> Accepted 或产品符合性状态。

---

## 1. 目的与范围

本文档定义 `CantiluneGraph` v0.1：作为 cantilune 形式化编排基础层的**单一形式对象**。它规定：

- 静态结构 $C$（一个对称幺单范畴）。
- 动力学 $R$（弦图重写）。
- 四个投影（DAG、Petri、π、态射）及其与 $(C, R)$ 的关系。
- 哪些由**按构造**保证，哪些是**待证**（尤其 π 投影）。

**非目标：** 本规范不含运行时、无 LLM、无 I/O、无工具/网络集成。这是纯形式核心。

## 2. 核心定义

$$\text{CantiluneGraph} := (C, R)$$

其中：

- **$C$** —— 一个**对称幺单范畴（SMC）**，由一个类型化图作为 presentation 生成。$C$ 是*静态结构*：何为合法的串行复合（$\circ$）与并行复合（$\otimes$）。
- **$R$** —— $C$ 上的一组**弦图重写规则**。$R$ 是*动力学*：执行即重写；一步即一次具体规则应用；trace 记录这些应用事件；重放重新应用所记录的事件。Normal form 由 $R$ 决定，但成功终止与死锁的区分另需独立提供的成功谓词。

### 2.1 $C$ 的对象与态射

- **对象** = 类型 / 状态。每个对象由基础类型经幺单积 $\otimes$ 与单位 $I$ 构造。
- **态射** = 操作 / 转移。态射 $f : A \to B$ 是一个类型化操作，输入类型 $A$，输出类型 $B$。
- **复合 $\circ$** = 串行依赖（DAG 侧面的"边"）。
- **张量 $\otimes$** = 并行复合（Petri 侧面的并发；态射侧面的并行 agent）。
- **对称 $\sigma_{A,B} : A \otimes B \to B \otimes A$** = 重排（token 互换 / 通道改路）。

### 2.2 由类型化图作为 presentation

$C$ 由类型化图 $G_0 = (N, E, \tau)$ **presentation** 生成：

- $N$ —— 节点（生成元）：每个是带声明 `in`/`out` 类型的类型化态射。
- $E$ —— 类型化契约边（见 §3.2）：类型化数据依赖，非无类型箭头。
- $\tau$ —— 类型指派。

$C$ 是 $G_0$ 上的**自由 SMC**（模以定义 $\otimes$、$\circ$、$\sigma$ 的等式）。这使得**静态 DAG 呈现**按构造成立；重写提升仍须满足 §6.1 的同一性/直接规则映射条件。

**当前机械化边界。** `FreeSMCQuotient.lean` 已定义由范畴律、张量
双函子律、associator/unitor/symmetry 自然性、逆律、pentagon、
triangle 与 hexagon 生成的相容等价并构造逐 hom 商。
`FreeSMCUniversal.lean` 为该商给出真实 mathlib `Category`、
`MonoidalCategory` 与 `SymmetricCategory` 实例，并从任意目标对象、
生成元、显式 copy、显式 discard 数据构造解释。
`FreeSMCStrongUniversal.lean` 又把该解释打包为真实 mathlib
`Monoidal` 与 `Braided` 函子。`FreeSMCArbitraryUniversal.lean` 现从
原子对象同构递归构造逐 word 比较，由生成元/copy/discard 相容性推出
商态射自然性，证明所得自然同构及其逆均为幺单，并证明在给定 singleton
分量下的唯一性。因此相对于选定生成元解释的任意目标泛比较已通过内核并
绑定不可变证据，现行状态为 `proved / review-pending`。投影重写保持已在
通用核心理论与实质参考边界内证明；每个生产包仍须提供自己的符合性数据。

## 3. 语法层（具体形式）

### 3.1 节点（类型化计算 actor）

节点不是"图中的一个节点"；它是类型化生成元：

```yaml
node:
  id: planner
  type: AgentOperation # Agent | Tool | Human | Environment | ...
  in: [Goal]
  out: [TaskPlan]
  contract:
    pre: [goal.exists]
    post: [plan.valid]
```

### 3.2 边（类型化契约边）

边是携带契约的类型化数据依赖：

```yaml
edge:
  source: planner
  target: executor
  artifact: TaskPlan
  schema: TaskPlan/v1
  guarantees: [complete, validated]
```

边把生成操作节点的输出端口接到类型相容的输入端口，从而呈现 $C$ 中的复合；边本身不另行生成态射。线上的契约成为类型义务。

### 3.3 弦图（presentation 形式）

`CantiluneGraph` 的规范 **presentation** 是**弦图**：盒子（态射）由线（对象/类型）连接。同一张弦图允许四种读法（DAG / Petri / π / 态射）——这是"四理论是四个观察维度，而非四个模块"（RFC-0001 §5.1）的形式内容。

## 4. 动力学：弦图重写 $R$

### 4.1 重写规则

规则 $\rho\in R$ 采用 §10.6 的 DPO 风格形状：

$$\rho=\left(L\xleftarrow{l}K\xrightarrow{r}R,\ \mathrm{cond}_\rho\right),$$

其中 $K$ 是保留接口，$\mathrm{cond}_\rho$ 包含匹配/应用条件。实施现
明确分为两层：带 inclusion match、dangling/边界检查的可执行有限类型化
开放超图 DPOI 片段，以及作为真正 adhesive presheaf slice 的范畴 DPO
层。在 slice 中，推导仍须携带 pushout complement 见证；adhesivity
不蕴含每个候选 match 都存在 complement。现已为固定宿主 inclusion
片段建立经过检查的桥：有限 active-support view 构成 thin inclusion
范畴并忠实映入 typed slice；每个满足 `InterfaceLocal` 的可执行事件都在
其中给出两个真正的交/并 pushout 方块。固定宿主桥已不再是唯一 transport
结果：active-support normalization 会把每个具体保结构超图 morphism
映为内生 typed-slice morphism，保持恒等与复合，并把全局单射的具体
match 映为内生范畴和环境 slice 中的 monomorphism。规范化 occurrence
现已包装为一般 `AdhesiveDPOI.Match`，普通 presheaf gluing 条件可据此
构造完整 DPO 推导。因此该 transport 无须 `InterfaceLocal`；但这仍不是
与所有 slice 对象的等价。另有
内生有限位置化范畴记录有序 `Fin` incidence；它满且忠实地嵌入 typed
slice，并与其精确本质像等价。
对任意单态 incidence-presheaf match，显式 gluing 条件现已证明等价于
pushout complement 的存在；典范 retained-subpresheaf complement 在与
结构映射相容的同构意义下唯一，随后由第二个 adhesive pushout 得到完整
DPO 推导。标准的因子分解式 parallel independence 现可构造两个 residual
推导及典范 concurrency 同构。固定边界的 open-cospan 范畴还证明：若输入
与输出边界都因子分解经过 joint retained context，则该 concurrency 同构
保持两条边界腿。此外，只要一个 ambient DPO witness 的 interface、left、
right、host、complement 与 result 六个对象全都属于位置化本质像，现可将
整个 witness 提升到该满子范畴，再经既有等价传回内生有限位置化范畴。
对内生有限位置图之间的 span，gluing 加上所有指定输入/输出端口均被保留，
现可构造一个有限位置化 retained graph，并证明其编码与逐分量典范
complement 在 typed slice 中自然同构。因此 complement 的本质像成员资格
在这两个条件下自动成立；边界保留本身仍不能从 gluing 推出。对这些内生、
ambient-monic 的合法 match，第二个 pushout 的 result 现也已证明留在位置化
本质像中。对给定的两个 parallel-independent 典范推导，joint pullback、
两个 residual context、两个顺序结果及两个 residual DPO witness 也都已在
有限位置化 presentation 内闭合。仍开放的是内生范畴的无条件
M-adhesive/Van-Kampen 转移、该转移所需全部范畴构造的封闭性、
critical-pair 完备性及全局合流性。内核检查的反例同时排除了用
whole-slice 等价替代这些义务：unrestricted typed slice 同时包含无限
carrier 对象及有限但 incidence 不完整的对象，二者均不可能同构于位置化
编码。早前简写“$L\to R$”不是另一种
规则类型。**执行步骤** = 对当前图中的某个具体 redex 应用一条规则。一个具体应用事件

$$e=(\rho,m,\delta)$$

至少记录规则 $\rho$、所选匹配/redex $m$，以及在选定重写体系下标识结果所需的推导、代表元、新鲜名字或分配数据 $\delta$。记作 $g\xrightarrow{e}h$。当一条规则有多个匹配时，只有规则名 $\rho$ 不能标识一步。

### 4.2 衍生性质

令 $\equiv_R$ 为选定的重写状态等式/同余，并令 $\mathcal T_{\mathrm{ok}}$ 为对 $\equiv_R$ 饱和、独立提供的成功谓词。二者都不能由 $(C,R)$ 单独确定；在 §8 固定前仍属开放操作配置。下表的状态空间取 $\equiv_R$ 商，故“无出事件”与代表元无关。

| 性质               | 形式表达                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------- |
| Trace              | 具体事件序列 $g_0 \xrightarrow{e_1} g_1 \xrightarrow{e_2}\cdots\xrightarrow{e_n}g_n$        |
| 重放               | 给定 $g_0$ 与完整事件/推导序列，在明确选定的等式/同构意义下重新导出 $g_n$；仅有规则名不足够 |
| 终止               | 无无穷归约（一个**需检查**的性质，非自动）                                                  |
| Normal form / 卡住 | 等价类 $[g]_{\equiv_R}$ 没有出向具体事件                                                    |
| 成功终止           | $[g]_{\equiv_R}$ 是 normal form 且 $\mathcal T_{\mathrm{ok}}([g])$                          |
| 死锁               | $[g]_{\equiv_R}$ 是 normal form 且 $\neg\mathcal T_{\mathrm{ok}}([g])$                      |

### 4.3 重写**不给**的东西

- **墙钟时间界**：重写是离散的；时间界需*带代价标注*的重写或时间扩展（v0.1 范围外）。
- **数值资源上界**：$\text{token} \le 3$ 是 Petri 投影上的**标记不变量**（§6.2），非裸范畴性质。

这些限制显式声明，使 RFC-0001 §8 的 C2（可预知性）表述为**步数有界**，而非时间有界。

## 5. 四个投影

每个投影 $P_i : (C, R) \to \text{Target}_i$ 将统一对象映到一个目标形式体系。**一致性**指每个 $P_i$ 是**保持结构的函子，且提升到重写**（重写函子 / simulation）：它把 $C$ 中的重写步映为目标中的重写步。

### 5.1 DAG 投影 $P_{DAG}$

$P_{DAG}$ = 底层 presentation 图 / 自由范畴生成元。

- **按构造**：$C$ 在 $G_0$ 上自由，故 $P_{DAG}(C)$ 即 $G_0$ 的数据依赖视图。
- **重写提升：** 仅当 DAG 目标与规则推导被正式定义为源呈现本身时才平凡；对仍开放的规则 schema $R$，该同一性尚未定义。
- **状态：** 已有可复用操作构造把独立给出的 `ObservableLTSIso`
  转为带 soundness/reflection 的 `ProjectionCertificate`，并组合成
  三视图 P1a family。它是“给定 LTS 同构”的一般定理，不会从任意
  类型化 DPOI 规则自动构造预期 DAG 规则映射；静态与具体重写条款仍
  未完成。

### 5.2 Petri 投影 $P_{Petri}$

$P_{Petri}$ = 库所/变迁读法。cantilune 为保留有序接口与个体 token 来源，选择 Bruni–Meseguer–Montanari–Sassone 的 **pre-net / 自由 SSMC 语义**。

- 库所 = 生成对象；变迁 = 态射 $\text{in} \otimes \cdots \otimes \text{in} \to \text{out} \otimes \cdots \otimes \text{out}$；标记 = 对象。
- **条款 (1)，有条件：** 选定 §5.2.1 的 pre-net 后，若生成元映射类型正确，自由 SSMC 泛性质给出静态 SMC 解释。
- **条款 (2)，未经验证：** Petri 触发不由 SMC-函子性自动推出。须给出具体规则集 $R$ 与逐规则映射，或证明函子保持 DPO 构造；二者当前均未定义。
- **注意：** 有界性 / 活性 / 可达性是投影上的网级性质，不是裸 SMC 的推论。
- **机械化操作 family：** 同一个 P1a 层接收独立定义的 Petri
  observable-LTS 同构，并给出原生单步 soundness/reflection、路径覆盖、
  终态分类与签名版本保持；它不从一般源 DPO 规则凭空制造使能条件、
  marking 或 Petri 推导。

### 5.2.1 个体 token 语义的 pre-net 选择（承重）

源文献核验修正了早前理由。Meseguer–Montanari 的集体 token 语义是对称幺单范畴语义，其中态射是触发计算，复合为计算串接、张量为并行。所引来源**不**支持全局 Eckmann–Hilton 坍缩 $\circ=\otimes$。该坍缩需要额外的单对象/共享单位等假设，不能作为集体 Petri 语义的一般反例。

**pre-net** 构造（Bruni–Meseguer–Montanari–Sassone，《Functorial Models for Petri Nets》）仍是有效设计选择，但理由不同：

- pre-net 以自由字幺半群替代自由交换幺半群，给每个变迁的输入/输出配备一个序；
- 伴随 **PreNet ⇄ SSMC** 生成**自由严格对称幺单范畴**；置换由非平凡 symmetry morphisms 表示，而不是对象的严格相等（个体 token 哲学）；
- 对称在第二步加（将 PreNet⇄SMC 伴随与"自由加对称"伴随复合），恢复 token 置换而不坍缩 $\circ$ 与 $\otimes$；
- 普通 Petri 网经 **abelianization**（忘序）恢复；反之，对 Petri 网 $P$，选一个 abelianize 到 $P$ 的 pre-net $Q$，取自由 SSMC $L(Q)$ 为语义。

**声明的设计决策（2026-07-23 钉定）：** pre-net 选择 $Q$ 是额外结构。cantilune 固定每个变迁输入/输出序为图定义 API（RFC-0001 §6.4）中节点 `in`/`out` 列表的声明顺序。对 $\mathrm{in}(n)=[t_1,\ldots,t_k]$、$\mathrm{out}(n)=[u_1,\ldots,u_m]$，变迁源为 $t_1\otimes\cdots\otimes t_k$，目标为 $u_1\otimes\cdots\otimes u_m$。此约定使选择可复现，但不自动证明重写保持。

该选择为条款 (1) 提供自由 SSMC 目标，并保留个体 token/序信息。条款 (2) 仍是独立证明义务（§12）。

### 5.3 态射投影 $P_{Mor}$

$P_{Mor}$ = $C$ 本身。

- 复合 = $\circ$；并行 = $\otimes$；对称 = $\sigma$。编排 = 态射复合（RFC-0001 §6 态射侧面）。
- **按构造**（即同一性视图）。
- **状态：按构造一致。**

### 5.4 π 投影 $P_\pi$ —— **待证**

依据 half-π (II) 决策：通道经 **request/accept** 动态创建（动态寻址，运行时决定），且**握手后对话无类型/自由**（完整 π 移动性，无 session types）。

- **已选操作/指称架构：** 有限控制的类型化开进程 π SMC（request/accept 作为结构化通道创建的 presentation）加 Fiore–Moggi–Sangiorgi 的**协变函子范畴语义**。两条路线须有显式交换定理；见 §13.9。
- **已机械化的支撑而非完成：** 有限控制 late-π 模块现含自由/全部名字
  分析、确定性 freshening、避免捕获替换、alpha 等价、结构同余、带
  freshness 前提的原生强 late 单步及结构闭包。另有真正非恒定的
  `World ⥤ Type` 与 `World ⥤ ωCPO` 协变对象、自然 inactive/parallel
  支撑运算及沿 $n\to n+1$ 的 allocation。一个具体支撑
  `ExternalFMS`、非空桥义务与边界无关的 `OpenInterpretation` 现给出
  无额外前提的逐世界交换定理；但它不是 FMS powerdomain/domain
  equation，也不是充分的 hiding 语义。已核验的 swap 反例表明，严格
  自然指称下一步至少需要 supported-process context 与进程重命名。
- **一致性非按构造：** 静态桥与操作桥均须在 RFC-0002 中先良构再证明，并按分期计划推进（见 §6.4 / RFC-0002 §4）。
- **状态：待证。** 此处任何未证主张标记为**未经验证**。

## 6. 状态小结与证明义务

### 6.1 按构造或有条件

- 态射投影是同一性 SMC-函子，并同一地保持 $R$。
- DAG 静态视图本质上是呈现的同一性；仍须精确定义目标。
- Petri 静态 SMC-函子以所选 pre-net/自由 SSMC 目标中的类型正确生成元映射为条件。
- 非同一性投影不会仅因强幺单而自动提升 $R$。

### 6.2 RFC-0002 中待证

- 每个投影都有独立指定的可观察商 LTS、事件提升关系 $\operatorname{Lift}_i$ 与前向/穷尽性证明；这些操作数据不由 SMC-函子自动推出。
- **跨投影事件一致性**：一个源事件在四投影中都有带同一事件标签的合法目标推导，且每条相关可观察目标推导都有来源。
- 每个投影保持并反射独立提供的成功终态谓词，使 normal form、成功终止与死锁不漂移。这些义务已在通用核心理论与实质参考包内证明；生产包实例仍属于独立 Product Conformance 工作。

### 6.3 分期证明（依 DRI 决策）

| 阶段 | 证明                                             | 状态                                                                                                                                                                                                   |
| ---- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P1a  | DAG/Petri/态射一致性                             | **通用证书 family 与实质参考已 proved / review-pending；产品规则/resource/admission 实例仍是逐包符合性工作**                                                                                           |
| P1b  | 声明的最大相容 Open-π/D1-A 边界内的 π 投影一致性 | **无过滤 structural strong-late 证书、精确 requesting reflection、D1-A 范围语义与最终 common chain 已 proved / review-pending；不声称 unrestricted actual-Agent strong-bisimulation full abstraction** |
| P1c  | 多状态/native π 参考一致性                       | **60/60 参考面、十五 family commutation、metadata/admission 接缝与实质 reconnect 链已 proved / review-pending；生产包须为自己的规则实例化通用接口**                                                    |

### 6.4 回退（依 ADR-0001）

若 P1b/P1c 无法证明，退到 π 的最大一致子语言并在 RFC-0002 中**记录缩减**。依据治理，π 的任何"一致"主张不得超过实际已证；未证部分标记**未经验证**。

## 7. 本规范保证与不保证之物

| 保证                             | 来源                                                   | 范围                         |
| -------------------------------- | ------------------------------------------------------ | ---------------------------- |
| 合法复合 / 并行                  | SMC $C$                                                | 静态，按构造                 |
| 统一执行步 = 重写                | $R$                                                    | 按定义                       |
| trace / normal-form 定义（离散） | $R$ + 状态同余 $\equiv_R$                              | 以两者均固定为条件           |
| 成功终止 / 死锁分类              | 独立提供且对同余饱和的 $\mathcal T_{\mathrm{ok}}$      | **有条件/开放**              |
| 确定性重放                       | 完整事件/推导记录 + 规范化策略                         | **有条件；不能由规则名推出** |
| 跨投影一致性（3 投影）           | SMC-函子 + 独立可观察 LTS + 事件提升/穷尽性 + 终态谓词 | **除同一性视图外未经验证**   |
| 跨投影一致性（π）                | 类型正确的静态目标 + 独立指定的操作/终态桥定理         | **待证**                     |
| 有界性 / 活性                    | Petri 网级检查器                                       | **检查而非给定**             |
| 时间界                           | ——                                                     | **不提供**（仅步数有界）     |

## 8. v0.1 开放问题

1. 将有限签名/类型语法与 FreeSMC 商提升到预期投影范畴；内部商已存在，
   完整静态函子尚无。
2. 包装正确的 well-formed active-support 源范畴，并通过 normalization
   桥运输任意 parallel-independence/concurrency 见证。一般 presheaf 侧
   的 mono/gluing/complement 与 concurrency 定理已经存在；与不受限
   slice 的等价已由反例否定。同时固定完整规则 schema
   $R$、状态同余 $\equiv_R$ 与成功谓词 $\mathcal T_{\mathrm{ok}}$。
3. **π 架构已定、集成证明开放。** 把有限控制 late-π 与非恒定
   `Set^I`/`Cpo^I` 支撑对象接到类型化开进程/FMS 交换定理，并在不改成
   弱步的前提下补全原生规则矩阵。
4. Petri 投影上的标记不变量 / 资源上界形式化。
5. 代价标注扩展（若 C2 步数有界对可预知性主张不足）。
6. **Petri 投影目标。** **已由设计决定：** 采用声明顺序的 pre-net/自由 SSMC 目标，以保留有序接口与个体 token 来源。**修正：** 早前全局 Eckmann–Hilton 坍缩理由不受原始来源支持。**仍开放：** 具体的 $R$ 到触发规则映射及评审。见 §5.2.1、§10.8、§12。
7. **π 桥。** Fiore–Moggi–Sangiorgi 的模型材料与 $\mathbb I$ 已经源
   核实。原步骤 C 张量仍因类型错误被拒：$|$ 是 agent 对象上的内部
   运算，不是 $\mathrm{Mod}$ 上的双函子。替代架构现已固定：张量位于
   类型化开进程 SMC，FMS 范畴保留逐点笛卡尔张量与内部 `par`。当前
   开放义务是显式交换定理及完整 P1b/P1c 证书，而非目标选择。见
   §10.9、§13。

## 9. 参考

- RFC-0001（`docs/rfc/0001-cantilune-architecture.md`）
- ADR-0001（`docs/adr/0001-unified-formal-structure.md`）
- RFC-0002（`docs/rfc/0002-projection-consistency.md`）—— 与本规范同步撰写
- Meseguer–Montanari，《Petri Nets Are Monoids》(1990)，doi:10.1016/0890-5401(90)90013-8
- Bruni–Meseguer–Montanari–Sassone，《Functorial Models for Petri Nets》(2001)，doi:10.1006/inco.2001.3050
- Fiore–Moggi–Sangiorgi，《A Fully Abstract Model for the π-calculus》(2002)，doi:10.1006/inco.2002.2968
- Lack–Sobociński，《Adhesive Categories》(2004)，doi:10.1007/978-3-540-24727-2_20
- Meseguer，《Functorial Semantics of Rewrite Theories》(2005)，doi:10.1007/978-3-540-31847-7_13
- Selinger（SMC 弦图综述）

## 10. 概念术语表（规范性定义，附引文）

本节给出上文所用核心概念的严格定义，附权威参考。定义系据引文来源转述（来源视为不可信输入 —— 仅取其内容）；引文须由评审人在进入 FCP 前核实。**以下概念归属在所引文献被对照本规范用法核查之前，均属未经验证。**

### 10.1 幺单范畴

**幺单范畴** $(\mathcal{C}, \otimes, I, \alpha, \lambda, \rho)$ 是一个范畴 $\mathcal{C}$，配备：

- **张量积**函子 $\otimes : \mathcal{C} \times \mathcal{C} \to \mathcal{C}$；
- **单位对象** $I \in \mathcal{C}$（张量单位）；
- **结合子**自然同构 $\alpha_{x,y,z} : (x \otimes y) \otimes z \xrightarrow{\sim} x \otimes (y \otimes z)$；
- **左/右单位子** $\lambda_x : I \otimes x \xrightarrow{\sim} x$ 与 $\rho_x : x \otimes I \xrightarrow{\sim} x$；

满足**三角形**与**五边形**协调公理（保证结合子与单位子彼此协调）。若 $\alpha, \lambda, \rho$ 均为恒等，则称**严格幺单范畴**。依 Mac Lane 协调定理，每个幺单范畴都幺单等价于某个严格幺单范畴。

参考：nLab，_monoidal category_（[ncatlab.org/nlab/show/monoidal+category](https://ncatlab.org/nlab/show/monoidal+category)）。

### 10.2 对称幺单范畴（SMC）

**对称幺单范畴（SMC）**是幺单范畴额外配备一个**对称**（平方为恒等的辫子）自然同构

$$\sigma_{x,y} : x \otimes y \xrightarrow{\sim} y \otimes x$$

满足**六边形**公理（对称与结合子协调）与对称公理 $\sigma_{y,x} \circ \sigma_{x,y} = \mathrm{id}_{x \otimes y}$。在 `cantilune` 中，$\sigma$ 建模并行资源/通道的重排（token 互换、通道改路）。

参考：nLab，_symmetric monoidal category_（[ncatlab.org/nlab/show/symmetric+monoidal+category](https://ncatlab.org/nlab/show/symmetric+monoidal+category)）。

### 10.3 自由对称幺单范畴

类型化图 $G_0 = (N, E, \tau)$ 上的**自由对称幺单范畴**，是将 $G_0$ 的节点（生成元）作为生成态射，并对 $\otimes$（并置）、$\circ$（沿匹配类型复合）、$\sigma$（置换）、$I$（空张量）自由封闭，仅模以 SMC 公理（结合、单位、对称、函子性）取商 —— 即除 SMC 公理与生成元所声明的输入/输出类型外**无**任何额外等式。

以 PRO/PROP 术语：签名上的**自由对称**幺单范畴即对应的 **PROP**（一个严格的 SMC，其对象在张量下由单一对象生成）。此处所用 SMC presentation（类型化多种类）是多种类 PROP 推广。

参考：nLab，_PRO_ 与 _PROP_（[ncatlab.org/nlab/show/PRO](https://ncatlab.org/nlab/show/PRO), [ncatlab.org/nlab/show/PROP](https://ncatlab.org/nlab/show/PROP)）。

### 10.4 幺单积（$\otimes$）

**幺单积**（张量）$\otimes$ 是幺单范畴的双函子。在 `cantilune` 中，$\otimes$ 即**并行复合** —— 将两个操作并排放置、无串行依赖。其单位 $I$ 即空并行复合。

### 10.5 弦图

**弦图**是幺单范畴中态射的图形语法：**线**表示对象（类型）；**盒子**表示态射（操作）；**并置**线表示 $\otimes$（并行复合）；将一盒的输出线**接入**另一盒的输入线表示 $\circ$（串行复合）；**交叉**线表示对称 $\sigma$；**无线**表示 $I$。

依协调定理（Joyal–Street，《The geometry of tensor calculus I》），图形演算是**可靠且完备**的：两张弦图表示同一态射，当且仅当其一可经平面/拓扑同伦（在尊重对称的前提下）形变为另一。这正是弦图作为 `CantiluneGraph` 规范 _presentation_、且允许四种读法（DAG/Petri/π/态射）的原因：每种读法是同一图形语法的不同解释。

参考：nLab，_string diagram_（[ncatlab.org/nlab/show/string+diagram](https://ncatlab.org/nlab/show/string+diagram)）；Selinger，《A survey of graphical languages for monoidal categories》(2009)；Joyal–Street，《The geometry of tensor calculus I》(1991)。

### 10.6 动力学 $R$ —— 弦图重写

**弦图重写**是弦图的代数方法重写。一条**重写规则** $\rho$ 是一个 span

$$L \xleftarrow{l} K \xrightarrow{r} R$$

其中 $L$ 为**左部**（待匹配模式），$K$ 为**不变接口**（保留的子图），$R$ 为**右部**（替换）。一个具体**重写事件** $e=(\rho,m,\delta)$ 及步骤 $g\xrightarrow{e}h$ 通过：

1. **匹配**：经匹配 $f : L \to g$，将 $L$ 作为 $g$ 的子图定位；
2. **删除**：删除所匹配的 $L \setminus K$（构造推出补）；
3. **添加**：沿 $r$ 取推出，加入 $R \setminus K$，

得到导出图 $h$。其中 $m$ 记录具体匹配，$\delta$ 记录所选重写体系要求的其他见证/选择数据。执行即重写；**trace** 为事件序列 $g_0\xrightarrow{e_1}g_1\xrightarrow{e_2}\cdots\xrightarrow{e_n}g_n$；**重放**先从完整事件记录中去掉已存端点，再以声明的源状态为输入，用确定性内核重新执行所得 recipe；已验证记录必须证明该计算恢复其记录目标，直接读取已存目标不算重放。Normal form 在所选商 LTS 上定义：$[g]_{\equiv_R}$ 无出向具体事件；**成功终止**另满足独立提供、对 $\equiv_R$ 饱和的 $\mathcal T_{\mathrm{ok}}$，**死锁**则不满足。后二者并非由 $(C,R)$ 单独推出。当一条规则有多个匹配时，只有规则名的序列不是确定性重放日志。

参考：nLab，_graph rewriting_ / DPO（[ncatlab.org/nlab/show/graph+rewriting](https://ncatlab.org/nlab/show/graph+rewriting)）；Ehrig–Pfender–Schneider (1973)；Lack–Sobociński，《Adhesive Categories》(2004)；nLab，_labelled transition system_（[ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)）。**修正：**早前 “Gadducci–Montanari, functorial semantics of rewriting” 属误述；见 §10.10/§11。

### 10.7 标号转移系统（LTS）

**LTS** 是一个结构 $T = (S, i, E, \mathrm{Tran})$，含状态集 $S$、初始状态 $i \in S$、事件（标号）集 $E$、与**转移关系** $\mathrm{Tran} \subseteq S \times E \times S$；$s \to_a s'$ 表示 $(s, a, s') \in \mathrm{Tran}$。重写体系固定后，`cantilune` 的动力学 $R$ 诱导一个 LTS，其中 $S=$ 弦图，$E=\operatorname{App}(R)$ 为完整规则应用/推导记录 $e=(\rho,m,\delta)$。把 $e$ 投影为规则名 $\rho$ 可得更粗的 trace，但会丢失重放身份。

参考：nLab，_labelled transition system_（[ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)）。

### 10.8 Petri 投影 —— 集体与个体 token 语义

Meseguer–Montanari 对 Petri 网计算给出范畴语义；Bruni–Meseguer–Montanari–Sassone 区分集体 token 与个体 token 解释。在所引函子模型中，复合连接计算，张量表示并行。原始来源因此不支持早前“交换性全局强制 $\circ=\otimes$”的陈述。

Pre-net 用有序列表替代变迁边界上的多重集，并生成自由严格对称幺单范畴。cantilune 选择该语义，是为保留声明顺序、token 历史与因果来源。它是设计选择，不是 Eckmann–Hilton 的必然结论，也不是源重写自动成为 Petri 触发的证明。

参考：Meseguer–Montanari，《Petri Nets Are Monoids》，Information and Computation 88(2):105–155 (1990)，doi:10.1016/0890-5401(90)90013-8；Bruni–Meseguer–Montanari–Sassone，《Functorial Models for Petri Nets》，Information and Computation 170(2):207–236 (2001)，doi:10.1006/inco.2001.3050。

### 10.9 π 投影 —— 函子范畴语义（2026-07-23 经来源核实）

Fiore–Moggi–Sangiorgi 使用**协变**函子范畴

$$ \mathrm{Mod}=\mathbf{Set}^{\mathbb I}=[\mathbb I,\mathbf{Set}]
\quad\text{或}\quad
\mathbf{Cpo}^{\mathbb I}.$$

对象是函子，箭头是自然变换；该范畴有逐点有限积。agent 语义是一个特定对象 $A\in\mathrm{Mod}$。在 closed interpretation 中，枚举了 $n$ 个名字上下文的进程解释为 $A(n)$ 的元素；真正无名字的情形是 $A(0)$ 的元素，又因 $0$ 是 $\mathbb I$ 的初对象而等价于全局元素 $1\to A$。$k$ 个名字变量的 open interpretation 是如 $N^k\to A$ 的自然变换。运算

$$\mathrm{sum}:A\times A\to A,\qquad
\mathrm{par}:A\times A\to A,\qquad
\mathrm{nil}:1\to A$$

是 $A$ 上的内部运算。由自由半格/幂域结构给出的是 `sum`，不是 `par`；`par` 经 left-merge 与同步构造。因此 $\mathrm{par}$ 不是整个 $\mathrm{Mod}$ 上的张量双函子。

$\mathbb I$ 是有限序数与单射的范畴，由 $1$、$up:0\to1$、$swap:2\to2$ 及所述关系幺单生成。协变性是承重事实：$up_n:n\to n+1$ 诱导 $X(n)\to X(n+1)$，与动态分配方向一致。论文证明全抽象/等式结果，不提供 DPO 桥。论文还区分强迟双模拟与保持输入前缀的迟同余；request/accept 含输入，故该区别不可省略。

参考：Fiore–Moggi–Sangiorgi，《A Fully Abstract Model for the π-calculus》，Information and Computation 179(1):76–117 (2002)，doi:10.1006/inco.2002.2968。

### 10.10 重写函子 / 函子一致性

只有在定义规则/推导的像并证明其为目标合法推导后，投影才是重写函子。**强幺单性本身不足。** 对 DPO 构造，须另证保持相关推出、推出补、匹配与应用条件，或给出逐规则推导映射。

早前 F2 有具体反例：笛卡尔强幺单函子 $F:\mathbf{Set}\to\mathbf{Set}$、$F(X)=X^2$ 不保持 $1\leftarrow0\rightarrow1$ 的推出。先推出再取 $F$ 得 $F(2)=4$；先取 $F$ 再推出仍只有两个元素。Lack–Sobociński 证明粘合范畴中 DPO 重写行为良好，并未断言每个强幺单函子保持 DPO 步。

早前引用的题名《Functorial Semantics of Rewrite Theories》是 **José Meseguer** 2005 年的工作，并非 Gadducci–Montanari。Gadducci–Montanari 的确有《Comparing logics for rewriting: rewriting logic, action calculi and tile logic》(2002)，但两者均不提供本 RFC 缺失的保持假设。

## 11. 引文核实记录（2026-07-23）

| 引文 | 与本规范相关的结论 |
|---|---|
| Fiore–Moggi–Sangiorgi (2002)，doi:10.1006/inco.2002.2968 | **已核实。** 支持 $\mathbb I$、协变 $\mathbf{Set}^{\mathbb I}/\mathbf{Cpo}^{\mathbb I}$、agent 对象、分配与 π 运算；不提供 C–E。 |
| Meseguer–Montanari (1990)，doi:10.1016/0890-5401(90)90013-8 | **已核实。** 支持 Petri 计算的范畴语义；不支持规范早前全局 $\circ=\otimes$ 主张。 |
| Bruni–Meseguer–Montanari–Sassone (2001)，doi:10.1006/inco.2001.3050 | **已核实。** 支持 pre-net 与个体 token 选择所用自由严格 SMC/函子语义。 |
| Lack–Sobociński (2004)，doi:10.1007/978-3-540-24727-2_20 | **已核实。** 支持粘合范畴 DPO 基础；不推出早前 F2。 |
| “Gadducci–Montanari, Functorial Semantics of Rewriting” | **误归属，拒绝。** 精确题名《Functorial Semantics of Rewrite Theories》属于 Meseguer (2005)，doi:10.1007/978-3-540-31847-7_13。 |

详细来源轨迹与负面结果见 `docs/research/zh-CN/0001-p1b-pi-bridge-audit.zh-CN.md`。

## 12. P1a —— 来源审计后的修正状态

### 12.1 静态分解

**(F1) 自由 SMC 分解仍成立：** 从 $G_0$ 生成元到某 SMC 的类型正确
映射存在强对称幺单扩张，并在相干幺单自然同构意义下唯一。当前 Lean
构造已实现生成 SMC 等式商与任意目标比较：原子对象同构加上生成元、
显式 copy 与显式 discard 的相容性，确定从 canonical 解释出发的幺单
自然同构；给定 singleton 分量后其 hom 唯一。这是所需的“选定生成元”
泛性质，但尚无绑定不可变 commit 的验证记录或独立 QA-L4 复核。它只确立
静态自由结构，不提供投影规则映射。

**早前 (F2) 被拒绝：** 强幺单函子不必保持推出。DPO 提升须有额外保持假设，或直接给出推导映射。§4.1 仍把精确规则 schema $R$ 留作开放问题，故当前无法核查这些条件。

### 12.2 各投影状态

| 投影 | 静态条款 (1) | 重写条款 (2) |
|---|---|---|
| 态射 | **已确立：** 同一性 SMC-函子 | **已确立：** 同一规则推导上的同一性 |
| DAG | 内部 FreeSMC 商已存在；预期 DAG 静态函子尚未包装成完整证书 | 已有一般 LTS 同构→证书定理与有限 fixture。经内核核验的 self-loop 反例证明：保持 incidence 的严格 DAG 映射不可能覆盖所有类型开放超图；产品源必须携带无环/rankability 证书。该受限源上的类型化 DPO 规则映射仍**未经验证** |
| Petri | 内部 FreeSMC 商与声明顺序有限 pre-net fixture 已存在；一般静态目标仍有条件 | 已有一般操作 family 与有限 firing fixture；每条一般源规则到 enabled firing 的映射仍**未经验证** |

对 Petri，自由 SSMC 中的变迁态射描述计算，但“源重写 = 合法触发”不自动成立。证明须定义标记、使能条件、LHS/RHS、匹配，以及每个 $\rho\in R$ 如何成为 Petri 推导。

### 12.3 后果

P1a 不是已完成的三投影重写证明。它现在有一个以独立 LTS 同构为输入的
可复用一般**操作** family，以及非空有限 DAG/pre-net/态射 fixture；
但仍缺预期演算的具体静态 SMC/resource/admission package 与类型化开放
DPOI 推导映射。不能从 family 反推这些输入存在。在条款 (3) “所有视图
中的同一事件”成立前，这一边界仍是承重条件。

## 13. P1b —— π 投影桥：独立核验（2026-07-23）

本节是对步骤 C–E 交接项的权威独立核验结果。治理分类：形式研究任务，**S2**、**QA-L4**、**Pre-FCP/M1**；Owner 为 Joker-of-Gotham（DRI），形式数学/范畴/进程语义评审人仍待定。处置为**迭代，不晋级**。详细证据见 `docs/research/zh-CN/0001-p1b-pi-bridge-audit.zh-CN.md`。

### 13.1 已核实基线：步骤 A–B

**步骤 A 已核实。** $\mathbb I$ 是有限序数与单射的范畴；等价地，由 $1$、$up:0\to1$、$swap:2\to2$ 及来源中的三条关系幺单生成。

**步骤 B 已核实，并修正方差。**

$$\mathrm{Mod}=\mathbf{Set}^{\mathbb I}=[\mathbb I,\mathbf{Set}]
\quad\text{或}\quad
\mathbf{Cpo}^{\mathbb I},$$

不是 $[\mathbb I^{op},\mathbf{Set}]$。$\mathrm{Mod}$ 的对象是函子、箭头是自然变换；它有逐点笛卡尔 SMC 结构，并含承载 π 运算的特定 agent 对象 $A$。

### 13.2 对交接中两项倾向的独立判定

| 倾向 | 判定 |
|---|---|
| “裸进程并行不是 SMC 张量。” | **过强；给出的理由无效。** 裸语法树不以字面语法等式结合，但 SMC 可使用协调结合子、结构同余或自由对称幺单完备化。定律是导出而非原始，不能排除 SMC。 |
| “双模拟商必要且充分。” | **必要性与充分性均不成立。** 协调不必经该商；而商类自身也不给出范畴、态射、复合或张量双函子。 |

若取商后结合/单位/对称成为字面等式，相应协调图自动交换，C′ 便不是缺失的难定理。反之，所引模型中强迟双模拟不被输入前缀保持；request/accept 含输入，故未指定的“双模拟商”甚至不是可组合目标，除非明确选择并证明适当同余。

### 13.3 类型审计：步骤 C 候选为何被拒

在来源模型中：

- $A$ 是 $\mathrm{Mod}$ 的一个对象；
- $n$ 名字 closed interpretation 是 $A(n)$ 的元素；只有零名字情形等价于全局元素 $1\to A$，而 open interpretation 是 $N^k\to A$；
- $\mathrm{nil}:1\to A$、$\mathrm{par}:A\times A\to A$ 是内部态射；
- 范畴复合是自然变换复合，不是 π 前缀。

因此

$$X\otimes_{\mathrm{Mod}}Y
=\{P\mid Q\mid P\in X(n),Q\in Y(n)\}$$

并未对任意函子 $X,Y$ 定义，也没有在自然变换上的作用，故不是 $\mathrm{Mod}\times\mathrm{Mod}\to\mathrm{Mod}$ 的双函子。对进程元素取双模拟商不能修复此点。

生成元映射也不完整。对 $g:U\to V$，函子要求自然变换 $E(g):E(U)\to E(V)$。“把 $g$ 映为进程”仅给出一个项或指向 $A$ 的映射，未定义 $E(U)$、$E(V)$ 或图态射，故不能应用 F1。**步骤 C 在类型层被拒，步骤 D 尚未开始。**

### 13.4 正确的环境 SMC 与条件性步骤 D

来源支持的 $\mathrm{Mod}$ 上 SMC 是逐点笛卡尔：

$$(X\boxtimes Y)(n)=X(n)\times Y(n),\qquad
\mathbf1(n)=\{*\}.$$

π 并行留作 $A$ 上的内部运算。对 $p,q:\Gamma\to A$：

$$\Gamma\xrightarrow{\Delta}\Gamma\times\Gamma
\xrightarrow{p\times q}A\times A
\xrightarrow{\mathrm{par}}A$$

解释 $P\mid Q$。

存在一个有效的**条件性** SMC 构造：为每个基类型选择 $E_0(t)\in\mathrm{Mod}$，并为每个生成元

$$g:\bigotimes_i t_i\longrightarrow\bigotimes_j u_j$$

给出自然变换

$$E_g:\prod_iE_0(t_i)\longrightarrow\prod_jE_0(u_j).$$

自由 SMC 泛性质随后给出强对称幺单扩张，并在协调幺单自然同构意义下唯一：

$$E_{\mathrm{stat}}:C\longrightarrow(\mathrm{Mod},\times,\mathbf1).$$

tensorator 在协调意义下关联 $E(f\otimes g)$ 与 $E(f)\times E(g)$；除非先选择严格化和括号约定，两者不必字面相等。这只是条件定理：$C$ 的张量被解释为积/配对，**不是**字面 π `|`。若要求张量直接成为并行，目标须重设计为类型化开进程 SMC（接口为对象、进程为箭头、plugging/hiding 为复合、并行为张量），或把定理弱化为另行证明的 lax 语义。$\mathrm{par}:A\times A\to A$ 通常不可逆，不能直接充当强 tensorator。

本轮不晋级任何目标选择。须先定义其对象、箭头、复合、张量和操作关系，再由 RFC/ADR 决策。

### 13.5 步骤 E 审计：有限规则面已存在；总定理仍不完整

历史审计时没有可枚举的 request/accept 或 P1c 规则面。仓库现在已有有限
类型化/raw 进程语法、原生转移、freshness 更严格的 late-π 关系、有限
封闭 request/accept 与 delegation 证书，以及显式十五事件 P1c 审计词汇。
因此所选规则现在可枚举、可类型检查。

这并未完成步骤 E。类型擦除定理仍以现有 raw 原生 kernel 为目标，其
freshness 前提弱于新的 `Late.NativeStep`；尚无定理把每个 typed step
识别为该更严格 late 关系。P1c 矩阵为每个事件列出四个目标列，但大多数
格只是类型化 pending obligation，并非推导；它也尚未从类型化开放 DPOI
执行包或 FMS 解释导出。

FMS 的 LTS 还排除三种捷径：单独输出前缀是可见输出转移，不是内部归约；限制 $\nu$ 自身不归约；重新括号化/`compose` 是结构同余或上下文闭包，不必是一条归约。

### 13.6 最小操作见证，并非项目定义

下列两条规则展示可行粒度，但只是**候选见证**，并非已完成的 $R$ 定义：

$$

(\nu s)(\operatorname{req}_a(s).P\mid\operatorname{acc}_a(x).Q)
\to_{\mathrm{hs}}
(\nu s)(P\mid Q\{s/x\}),

$$
$$

\operatorname{out}_s(v).P\mid\operatorname{in}_s(x).Q
\to_{\mathrm{msg}}
P\mid Q\{v/x\}.

$$

其中 $s$ 对接收方及外围上下文必须新鲜，替换须避免捕获。标准无类型 π 只传名字，因此源 sort `Value` 要么须单射地编码为名字，要么须改用明确的类型化/值传递 π 变体；仓库当前尚未选择该层。

直接展开为 π 宏后，分别有合法 $\tau$ 见证：

$$

(\nu s)(\overline a\,s.\llbracket P\rrbracket\mid
a(x).\llbracket Q\rrbracket)
\xrightarrow{\tau}_{\mathrm{res}\circ\mathrm{com}}
(\nu s)(\llbracket P\rrbracket\mid
\llbracket Q\rrbracket\{s/x\}),

$$

对上面展示的作用域，直接的 FMS 推导先由 `com` 同步 free-output 与 input
前提，再由 `res` 把该 $\tau$ 提升到外层 restriction。若选定的结构同余包含
scope extrusion，且 $s$ 对接收方新鲜，则源项还同余于
$$

((\nu s)\overline a\,s.\llbracket P\rrbracket)\mid
a(x).\llbracket Q\rrbracket.

$$
后一形状改由 `open` 给出 bound-output 前提，再由 `close` 得出结论。这是同一条
合法 $\tau$ 的两种推导形状，不是两个运行步骤；项目必须先固定作用域/结构同余
策略，才能把其中一种声明为规范形状。

$$

\overline s\,v.\llbracket P\rrbracket\mid
s(x).\llbracket Q\rrbracket
\xrightarrow{\tau}_{com}
\llbracket P\rrbracket\mid
\llbracket Q\rrbracket\{v/x\}.

$$

除非目标定理明确允许零步结构同余，否则 `compose` 不应列为原子源规则。静态映射与操作映射应分开：

$$E_{\mathrm{stat}}:C_{\mathrm{RA}}\to\mathcal D,\qquad
\llbracket-\rrbracket_{\mathrm{op}}:\mathrm{Conf}_{\mathrm{RA}}\to Proc_\pi.$$

陈述健全性/反射前，须先从原生 π LTS 中独立定义 raw 可观察推导域 $\mathcal D_\pi^{\mathrm{obs}}$、行政步策略，以及一个使所选可观察商 LTS 良定义且与代表元无关的目标状态同余 $\equiv_\pi^{\mathrm{obs}}$；该域不得定义成前向像。再定义关系

$$\operatorname{Lift}_\pi\subseteq
\operatorname{App}(R_{\mathrm{RA}})\times\mathcal D_\pi^{\mathrm{obs}}.$$

对具体源事件 $e=(\rho,m,\delta)$，健全性要求：

$$g\xrightarrow{e}h\Longrightarrow
\exists P,d\in\mathcal D_\pi^{\mathrm{obs}}.\
d:\llbracket g\rrbracket_{\mathrm{op}}\xrightarrow{\tau}_\pi P
\land P\equiv_\pi^{\mathrm{obs}}\llbracket h\rrbracket_{\mathrm{op}}
\land\operatorname{Lift}_\pi(e,d).$$

要支撑“不捏造、不漏步”与“同一运行”，仅有前向模拟不够；还需反射/完备方向：

$$d\in\mathcal D_\pi^{\mathrm{obs}},\
d:\llbracket g\rrbracket_{\mathrm{op}}\xrightarrow{\tau}_\pi P
\Longrightarrow
\exists e,h.\ g\xrightarrow{e}h
\land P\equiv_\pi^{\mathrm{obs}}\llbracket h\rrbracket_{\mathrm{op}}
\land\operatorname{Lift}_\pi(e,d).$$

记录的投影 occurrence 可带标签 $\widehat d=(e,d)$；擦除标签后仍是原生合法 π 推导 $d$。除非另证单射/唯一性，否则该关系不要求从 raw $d$ 唯一恢复 $e$。因 `res(com)`、`close` 与 `com` 对外都标为 $\tau$，标准 trace 标号本身无法区分这些推导。

### 13.7 后续必需工作

1. 完成 typed kernel 关系到类型化开进程边界组合的桥。有限 P1c 见证现
   已擦除到独立定义的 alpha/结构标准 late 关系，但一般 plug/hide 的
   操作充分性仍是独立定理。
2. 将具体非恒定 `Set^I`/`Cpo^I` 支撑函子连接到
   `OpenInterpretation`；补 FMS powerdomain/domain equation、商下降与
   观测桥，但不重新声称一般 FMS 全抽象。
3. 把有限参考矩阵推广到每个获准源规则。参考演算现已有原生 mismatch
   decision、普通 delegation reconnect、quiescent shutdown 及全部 60 个
   四投影格；这本身不构造产品范围的一般规则 family。
4. 使用内生位置化超图与类型 slice 本质像的等价，以及现已显式构造的
   canonical complement、第二个 pushout、joint context、两个 residual
   context 与两个 parallel-independent 顺序结果的有限位置化闭包，为同一
   源包装静态 SMC、资源、admission、终态分类与操作反射。与整个无限制
   （含无限 carrier）slice 等价是错误目标；内生范畴的抽象
   M-adhesive/van-Kampen 类定理仍是独立义务。
5. 按 QA-L4 取得独立形式数学/范畴/进程语义评审。

### 13.8 P1b 历史审计小结（已由 §21 取代）

下表记录 2026-07-23 的审计检查点，仅用于溯源，不覆盖 §21 的现行状态。

| 项 | 状态 |
|---|---|
| 步骤 A：$\mathbb I$ | **已核实** |
| 步骤 B：函子范畴模型 | **已核实；方差已修正** |
| 交接的步骤 C 张量 | **被拒：不是双函子，生成元映射也类型不成立** |
| “裸进程 vs 商”选择 | **两者均非缺失范畴结构的必要/充分条件** |
| 正确环境 SMC | **已识别逐点笛卡尔结构** |
| 步骤 D | **FreeSMC 任意目标泛比较与实际 mathlib 对称幺单结构、`Type` 上真正的有限幂集 monad 及其 `Type^I` 逐点 monad、局部无名 supported-process 函子、非恒定 `Set^I`/`Cpo^I` 支撑模型、CPO 世界 shift/allocation、连续支撑 hiding 与支撑层回缩等式、离散 CPO 有限幂 monad 与有限 `P_f(H-)` 逼近均已存在。`CompleteExternalFMSTheoremPackage` 已写出精确的 world/action、强交换 powerdomain、协调 restriction、域方程与全抽象验收接口，但 `CompleteFMSAvailable` 没有 inhabitant；这些支撑等式不居留该 package，真实 Abramsky/富集模型仍未证** |
| 步骤 E | **有限 P1c 参考面现为 60/60 native，并有四份按事件索引的操作证书；这些证书只在各自声明的受限目标关系内是精确的。每个 π 见证均擦除为独立标准 late 推导，但这不是整个 raw 标准 late LTS 的 reflection：当前开放 reconnect/delete 编码还有额外环境转移。一般 DPO/Petri 派生 admission 规则与五层证书仍开放** |
| P1b 总体 | **操作 residual 已 implemented_unverified；完整 FMS 路线或经接受的范围裁决仍未完成；Pre-FCP/M1；迭代，不晋级** |

在该检查点不声称已证明 C′、D 或 E。该负面结果排除了错误的张量/商路线；
后续已证明范围见 §21。

### 13.9 已选择的实施架构（2026-07-23）

后续实施决策关闭了早前的目标选择分支，但不改变证明状态。P1b/P1c 必须同时构造：

1. 类型化开进程 SMC：接口为对象，plug/hide 为复合，原生 π 并行为张量；
2. 协变 FMS 路线：环境采用逐点笛卡尔张量，并保留 $\mathrm{par}:A\times A\to A$ 作为内部运算。

两条路线必须经类型擦除与锁定的原生 late-π 语义形成交换定理。每个源事件须映成一个原生目标推导；若改用弱 $\tau^*$，必须重新进入 RFC/ADR。有限控制范围包括 request/accept、有限消息传递、自由/束缚输出、delegation、choice/match、动态伙伴与 epoch 边界 admission，但排除内部递归和 replication。

该架构现已有通过 kernel 构建的有限见证：生成 FreeSMC 等式商、该商与
所呈现开进程范畴的实际 mathlib 对称幺单结构、类型化原生单步擦除、
有限控制 alpha/结构 late-π 基础、在
映射状态上反射全部原生目标动作的有限封闭 request/accept 与 delegation
`ProjectionCertificate`、一个连接未过滤原生 π input 的四视图签名扩展、
真正非恒定的协变 `Set^I`/`Cpo^I` 支撑函子，以及条件式 FMS 交换定理。
具体支撑实例现已逐世界消解该交换定理，并把参考 plug/hide 解释为支撑
并集；它不是 FMS powerdomain/domain 解。仓库另已构造实际 `Finset`
自由半格 monad 及其逐点 `Type^I` monad、带自然支撑的局部无名进程函子、
ACUI 有限 agent 商，以及精确有限阶段 $A_0=0$、
$A_{d+1}=P_f(H A_d)$。这些阶段尚无完整 world-injection action、连接
映射、colimit 或初始性。强化后的 `CompleteExternalFMSTheoremPackage`
现为验收证书：它要求 strong-commutative powerdomain 协调、精确的 model/
world-natural action shape、协调的名字抽象 restriction、富集 agent 域解，
以及绑定 journal 来源的操作 strong-late 全抽象。
`CompleteFMSAvailable` 只是该结构可居留的命题；仓库未定义 inhabitant。
因此消费者定理仍为条件式，不能把 `mechanizedCpoFragment` 当成 FMS 模型。

CPO 路线另构造了真实的有限单射世界 shift 与 allocation 自然变换、连续
支撑 hiding，以及连续自然变换等式层面的支撑 allocation/hiding 回缩律；
另有等式序离散 CPO 子范畴上的有限幂集 monad 与 Fubini 律，以及有限递归
agent fold/unfold 同构。这些正是 `mechanizedCpoFragment` 的内容；它们不
居留完整外部 FMS 定理 package。特别是，支撑删除及其回缩律并不是 FMS
agent restriction 运算，也不具备完整 alpha/substitution/scope/action
协调。

P1c 审计矩阵机械固定为
$15\text{ events}\times4\text{ projections}=60$ 格。修订后的有限参考
演算现有 60 个原生、非自反推导。标准带证明 mismatch 会传播真实 body
transition；reconnect 是普通 delegation 通信；quiescent delete 是双方
continuation 均为零的 shutdown 通信。DAG 列使用严格 rank 无环重写，
Petri 使用带身份的 individual-token firing，morphism 为总恒等视图。
四份按事件索引的操作证书相对于各自声明的受限目标关系证明 soundness、
reflection、终态分类及签名版本保持。每个 π 推导另擦除到独立定义的
alpha/结构 late 语义；但这不提供整个 raw 标准 late LTS 的完整 reflection：
开放 reconnect 与 quiescent-delete handshake 还暴露额外可见环境转移。
另一个封闭协议重设计现已为 communication、open/close、reconnect 与
quiescent delete 分别给出真正的强原生 $\tau$ 步，并已精确分类这四个源的
全部 native 转移。但 open/close 的封闭终点仍有后续 payload $\tau$ 步，
Lean 已证明当前每事件两状态的源 LTS 仍不能完整 reflection；完整十五事件
证书需要经评审的多状态协议或不同的一步终态设计。这是非空参考定理，不是任意
admission 产品规则已有四投影推导的声明；仍禁止弱化为 $\tau^*$。

对 mismatch、reconnect 与 quiescent delete，较强的
`P1cAdmittedOperations` 桥已不再使用 ready/completed 夹具。一个具体
admitted `Occurrence` 会计算其目标 `Config`；有限支撑 DPO 节点/边更新、
Petri enabling/firing、原生标准 late 步、morphism 更新与 endpoint-free
replay 都从同一 occurrence 导出。Replay 解释器会在重算前检查有限 recipe
与匹配 embedding。这是 `Config` 普通节点/边的可执行片段，尚非一般类型
开放超图 DPOI 桥；其余十二类事件尚未由这一较强构造覆盖。

`P1cAdmittedTrajectory` 已为每个此类 occurrence 实例化事件/epoch 概率层。
其确定性核把 pending 到 completed 的概率一转移赋给 admitted 业务事件，
之后使用显式 external hold。对每个业务标签轨迹点，Lean 会恢复精确事件
记录、端点 replay、两端 epoch 与同一四投影 `CommonDerivation`，并实例化
几乎必然共同轨迹定理。`EventTrajectorySupport` 还从实际
Ionescu--Tulcea 律证明：采样到的每条边几乎必然具有严格正的矩阵质量，
因此仅为补全零质量状态对而引入的标签几乎必然不会出现。

运行时 execution epoch 由 `ExecutionEpochTrace` 单独定义：一个 epoch 是
处于同一 `Config.signatureVersion` 的任意有限 verified package event
列表，并对整个列表证明 endpoint-free replay。异构 epoch 只能通过可重放的
四视图 `SignatureAdmissionEvent` 连接，且该边界严格推进版本。
`P1cExecutionEpoch` 实例化了包含业务事件与 completed-state external hold
的两事件 epoch，以及参考 admission 边界。`ExecutionEpochTrajectory` 及
其随机化版本现已在同一确定性或 state/seed 概率空间上证明：每个有限前缀
都是精确的原生 `ObservableLTS.Path`。它们还识别每条事件真实存储的
source/target，并对任意有限子段（不只整个前缀）证明 endpoint-free
replay 与固定运行时签名对齐。具体 P1c 包已实例化这一固定签名
event/epoch/replay 定理。概率层的 `opportunityEpoch` 仍只是观察/公平性
时间表，不是运行时签名 epoch。固定签名样本尚未跨异构 admission 边界
提升为随机 `EpochChain`，故这仍是单 occurrence 执行包，而非一般随机
多签名调度器。

反馈概率层从真正 mathlib Markov kernel 出发，借 Ionescu--Tulcea 构造
路径测度、可测递减 not-hit 事件及 almost-sure hitting 桥。对有限离散
执行包，非对角正质量必须对应原生可观察步；几何 miss 递推由行和与点态
$\varepsilon$ 稳定质量下界推出，有限柱事件归纳把 killed-chain miss
质量与 not-hit 柱事件概率等同。具体 Bool 执行包另构造事件标记路径概率
空间：每一步有原生标签、可重放 `DPOEvent`、精确 source/target 配置端点，
并与同一稳定/公平 observation-opportunity 窗口对齐。忘却事件后严格恢复
原状态轨迹律。新增的 seed 随机化耦合允许事件身份依赖源、目标与辅助随机
流，其状态边缘仍严格等于 Ionescu–Tulcea 律，almost-sure hitting 也在联合
事件空间成立。两种耦合现还同时携带有限前缀的事件身份、原生步、
endpoint-free replay、opportunity 窗口与运行时签名 epoch 一致性。
这闭合了抽象的“同一端点多个标签”耦合与固定签名共同轨迹问题；其本身
尚未构造异构签名的运行时联合转移核。三项 admitted P1c 操作现已有一个
具体确定性核及可执行 request 级 replay，但仍未使 replay 真正重执行任意
presheaf-DPO match、
complement、freshness、policy 与 evidence 检查；stable-window、公平性与正
$\varepsilon$ 前提也尚不能从每个共享产品 `ExecutionPackage` 自动推出。

精确范围以 `formal/proof-obligations.json` 为准；P1b/P1c/四投影总定理
仍未完成，项目仍为 Pre-FCP/M1。

## 14. 2026-07-24 覆盖性闭合边界

本节在与上文较早的“仍缺失”描述冲突时取代后者。

有限类型开放超图结果现已是内生的范畴结果。`ExactPositionalObject` 以
有限 carrier、唯一 typed incidence descriptor、规定的有序边界 typing
及无 boundary duplicate，独立刻画 full replete 本质像；重建定理证明
`essImage X ↔ ExactPositionalObject X`。任意编码后为单态、合法且保留
边界的匹配、并行独立对的两条 residual 及 concurrency 结果，都经
finite-image/preimage 同构传回内生见证；两个 DPO 方形在 ambient adhesive
slice 中为 Van Kampen。有限 boundary-duplicate 反例证明 unrestricted
finite slice 不与 positional 图等价。

`P1cFullNativeRefinement` 现对全部 15 个事件 family 及两个 payload 后继给出
所需的多状态、family-tagged 完整 native 证书。`P1cStructuralLateBridge`
还把每个源步映为未过滤 alpha/结构 strong-late LTS 的真实一步。同时 Lean
证明，按当前元数据合同，规范映射到纯 `Raw.Proc` 的完整证书不可能存在：
dynamic admission 改变 runtime signature version，而
`structuralLateLTS` 对所有进程的版本均为零；delegation 与 reconnect 也有
相同 pure raw transition triple，故该 triple 不能恢复源事件 provenance。
RFC 必须把 admission/version provenance 与纯 π 分层，或选择显式 enriched
target；不得以弱步规避。

有限异构概率结果现有两种加强。`FiniteHeterogeneousMarkedKernel` 把真实
依赖 `ChainStepMark`、native step、replay 与 execution-epoch 证据放在采样
到的正概率边上；末端 stutter 是不同的行政 constructor。
`FiniteBranchingReplayKernel` 直接对业务 choice 分配概率，并把 sampled
choice 存入后继，所以同端点事件仍是不同随机状态。几乎每条
Ionescu--Tulcea 路径都有有序 choice，且 replay 见证定义性来自其 sampled
edge。具体产品 scheduler 仍须跨 runtime admission 实例化这些 choice，并
导出 opportunity 对齐、公平性、稳定签名窗口与正 epsilon 下界。

静态/操作门禁现对 quotient 敏感。`CategoricalLTSRealization` 必须使所选
state setoid 恰对应 represented arrow 的范畴同构，提供满足反身/对称/传递
协调的同构，并证明 rewrite cell 与代表元无关。最强 FMS-gated 组合定理
要求具体 `ExactFMSAcceptancePackage`、四份 coherent 投影证书及
`OperationalFMSPiCoherence`：映射源状态由闭 π 进程表示；目标 state/event
具有 FMS denotation/action；从映射源出发的目标原生步恰等价于所提供的 FMS
transition。本仓库没有构造这样的 FMS package 或产品 bridge。

因此，剩余阻断不是隐藏的 Lean hole，而是：

1. 为严格 DAG 视图选择 rankable/acyclic 源定义域的 RFC 决策；
2. 为 π provenance/version 分层作 RFC 决策；
3. 真实 all-ωCPO powerdomain、连续 agent 域方程解、来源锁定的
   restriction/action 构造、全 world 操作桥及 strong-late 全抽象证明；
4. 同一共享执行包上的生产 DAG/Petri/static/resource/admission 映射及全部
   non-fixture 产品 occurrence；
5. 带 feedback authorization、quorum、公平性、stable-window 与 epsilon
   证明的具体异构分支 scheduler；以及
6. 绑定 commit 的独立 QA-L4 评审、FCP 与 ADR 接受。

## 15. 签名索引与采样语义边界（2026-07-25）

对每个有限签名 `σ`，`ReindexableExecutionFamily` 都给出真实
`ExecutionPackage σ`。对每个单调扩展 `ι : σ ↪ τ`，状态/事件映射保持原生
步骤，配置按扩展重索引，目标已验证事件记录等于源记录的重索引；恒等与复合是
这些实际映射上的等式。`ProjectionFamily` 是关于该重索引自然的投影证书。

`FourProjectionFamilies` 强制 DAG、Petri、π 和 morphism 共享同一个源族。
因此每个签名点上的路径、反射、终态和版本定理都针对同一源语义；两次可复合
admission 的四个状态方块交换；每个源原生步骤在四个重索引目标中都有执行精确
mapped configuration 的事件记录。这仍是接收已供应 family 的接口定理。

固定签名 epoch 中，完整采样轨迹只保存 branching kernel 产生的依赖轨迹。
事件标签、源原生步骤、`DPOEvent`、端点配置、观察/运行时 epoch、replay epoch
及四个目标步骤均由同一条 sampled edge 导出。签名 admission 不是
`DPOEvent`；异构执行继续使用 `AdmissionReplays`。

对有限异构 `EpochChain`，`FiniteHeterogeneousFourProjection` 从 marked
kernel 自身为每个非终端 sampled phase 导出共同证据。固定签名业务 phase
保留精确 `DPOOccurrence` 与四个原生目标推导；边界 phase 则以独立构造保留
`AdmissionOccurrence` 和 `AdmissionReplays`。采样源唯一决定依赖 mark、
replay 分支和 execution epoch。若要从同一个 `FourProjectionFamilies`
选择逐 epoch 证书，还必须显式提供 `SourceFamilyAlignment`，因为任意 chain
中的存在打包执行包并不定义等于该 family 的源执行包。纯
`Reindexing.mapState` 不可能成为目标 admission transition：kernel 检查的
no-go 定理利用 `Config.reindex` 保持 `signatureVersion`、而
`AdmissionReplays` 必须严格推进版本这一事实。因此四目标 admission replay
须另行提供异构目标 transition 与证据，而不是补充一个状态等式。

内在有限类型开放超图范畴现与 adhesive typed-presheaf slice 中满足
`ExactPositionalObject` 的 full 子范畴显式等价。该函子覆盖 exact 对象间全部
typed natural transformation，full、faithful 且 essentially surjective，
并保持和反射单态。这是在 exact positional 范围内的一般范畴桥；它不固定
宿主，也不假定 `InterfaceLocal`。unrestricted slice 仍不等价，因为其中确有
无限、incidence 不完备或边界非单射的反例对象。

严格 DAG 仅对携带下述证书的源图规范化：

```text
source ∈ inputs(e) ∧ target ∈ outputs(e)
  ⇒ rank(source) < rank(target).
```

在该范围内，投影包含全部 active 二元 incidence、保留输入/输出接口、受类型
开放超图同态保持并且无环。DPO 保持还要求重写目标携带相容 rank。

request/accept 映射已有未过滤的标准结构 strong-late 单步正向证明。
`P1bNominalIncidenceClosure` 现已反演全部结构同余 requesting 代表并证明
精确反射。该检查点的结果为 `implemented_unverified`；现已按 §21 与不可变
QA 证据晋级为 `proved / review-pending`。choice 幂等不属于当前结构同余；使用 S4 时必须明确引用另设的
等式/双模拟理论。

反馈存储只允许经授权 ballot，按 observer 身份去重，并把同时 approval/rejection
quorum 暴露为 `conflict`。聚合只产生单调证据，不能替被观察方作接受决定。
P1c 只有正支撑进入单调反馈桥；零质量行政 reset 已被证明与 pending/completed
证据序不相容。

最后，等式序有限集端函子及 `World ⥤ ωCPO` 逐点版本不能在一般 ωCPO 上拥有
所需连续 singleton unit。它们是有限支撑测试，不是 FMS powerdomain。
Abramsky powerdomain、连续自然初始 agent 域解、完整 hiding/action
coherence，以及针对已选择源演算范围的进程对 strong-late 全抽象实例，仍是
强制的外部或后续形式化义务。构造必须给出初始解及其 roll/unroll coherence；
本规范并未把一般 algebraic compactness 选为唯一允许的方法。

外部来源边界是精确的：FMS Proposition 2.2 把基础 Cpo 范畴上已供应的
Abramsky powerdomain 逐点提升到 `Cpo^I`；agent 方程为
`A = μX. P(H X)`，其中
`H X = N × (N ⇒ X) + N × N × X + N × δX + X`；Theorem 3.2/3.3
分别陈述按进程项对量化的有限进程与任意进程 strong-late 全抽象结果
（[作者托管 PDF](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)）。
这些是被引用的外部数学结果，不是 Lean kernel 证明；仅凭引文不能构造
`CompleteFMSAvailable` 或本地操作 coherence 接口的无公理 inhabitant。
源演算包含 guarded replication `!α.P`，而当前 Lean 有限控制语法既无
replication 也无 recursion。因此当前定理至多是片段定理，不能冒充任意进程
结果。所引全抽象定理也没有断言递归域中的每个元素都能由语法定义。

## 16. 原生 P1c 与生成式运行时边界（2026-07-25）

本节取代前文中“只有状态轨迹”或
“mismatch/reconnect/delete 仅有 fixture 推导”的旧表述。

合法的类型化标准 late 关系现在是 `Step.StandardNativeStep`：其成员同时
携带类型化推导以及标准演算要求的全部 freshness/capture 前提。每个成员
精确擦除为一条独立定义的 `Late.NativeStep`。P1c 的十五个参考事件族全部
居留该关系；mismatch decision、reconnect 与 quiescent delete 因而是原生
一步推导，不是人为添加的行政标签。

对十四个固定签名事件族，`P1cBusinessReplayMatrix` 从同一 occurrence
构造确定性的 `Config` 端点、无端点依赖的 verified `DPOEvent`、四份独立
原生目标推导以及一条标准 late 推导。其 audit-cursor 配置只是参考执行
载体，不冒充最终产品图语义。对 mismatch、reconnect 与 quiescent delete，
`P1cAdmittedOperations` 进一步给出真实的图/资源/名字更新，并在 replay
时重新检查 enabling 和具体 match fingerprint。dynamic partner admission
仍是跨不同签名的 `AdmissionReplays`，不会被伪造成同签名 `DPOEvent`。

对上述三种 admitted-operation 执行包，`concreteTrajectoryAgreement`
由实际 total native labelling 直接构造，并证明精确的状态投影、选中事件
标记、verified event 在相邻配置间的 replay，以及 opportunity/runtime
epoch 对齐。`FiniteExecutableHeterogeneousRuntime` 还构造了一个真正跨越
admission 的有限调度器与 Markov kernel。其几乎每条生成路径都保留两侧
business `DPOOccurrence`、admission occurrence、唯一的 dependent phase
mark，以及每条边上的四份原生目标推导；四个目标中的 admission 都严格
推进 epoch。这是非空参考调度器。产品级授权、quorum/conflict 策略、
稳定窗口公平性与正 `ε` 进展仍须由规则包提供。

有限类型开放超图的 DPOI 桥在数学上正确的作用域内已经闭合：内在有限
位置化开放超图与 adhesive slice 的完整 `ExactPositionalObject` 子范畴
显式等价；每个合法单态匹配都有规范的两个 pushout 与 Van Kampen 方块；
每对 parallel-independent 匹配都有内在 residual 和规范 concurrency
同构。kernel 已检查的 malformed/boundary-duplicate 反例排除了与整个
无限制 presheaf slice 等价的错误主张。

CPO 层现在包含真实的非离散有限严格片段
`P_s α = (Set α)⊥`：divergence 与 deadlock 分离，strict choice 和直接像
连续，并且 `PUnit` 上存在三段严格链。它是真实的
`NondeterministicComputation`，但不是作用于所有 omega-CPO 的
`CpoPowerdomainPackage`。尚缺的 FMS 层被精确定位为：
Abramsky/omega-ideal completion 及其自由泛性质、strong/Kleisli coherence、
连续自然初始递归域解、协调的 hiding/action 映射，以及针对已选择演算范围、
由来源版本锁定的进程对全抽象证明。Cantilune 还附加要求逐标签原生一步精确
对应、强 powerdomain-observation 逆像律（含 divergence observation 策略），
以及指定 divergence/deadlock 不等性。这三项是本地验收条件，不是 FMS
full-abstraction 定理的直接陈述。论文引文仍是外部证据，不是 Lean inhabitant。

P1b 的结构反射现已对有限 request/accept 演算完成 kernel 构建。
prefix-count 不变量证明 complete 不可发生一步；free-subject 与
communication/unary-prefix 不变量分类 established；nominal-incidence
closure 则经 alpha/ACU/scope extrusion、capture-avoiding substitution
及四种 `res(com)` / `open+close` split presentation 分类全部 requesting
代表元。它导出精确 native residual reflection 与无条件
`pi_ra_certificate`，未采用弱步或观测过滤。集成 dirty worktree 已完成
新一轮完整 CI/公理审计；在绑定不可变 commit 并经独立评审前，这仍只是实现证据。

### 16.1 共享 P1a 业务视图与终态/生产性状态

十四个固定签名 P1c 业务事件现组成三个 P1a 视图的同一个真实源执行包。
DAG、Petri 或态射目标的每一步都保留源 family 标签，并包含相应的独立
native matrix 推导。因此 soundness、精确 reflection、path coverage、
终态保持和精确源 `DPOEvent` replay 指向同一个 occurrence。该参考 carrier
的图与资源 fibre 为空；任意产品规则的 rank 保持、pre-net 重构、资源
语义、静态 SMC realization 与异构 admission 仍是独立证书输入。

对每个具体 admitted mismatch、reconnect 或 quiescent-delete occurrence，
一次可 replay 的业务转换会到达且仅到达以下四类控制状态之一：成功、外部
等待、真正死锁，或带有显式可观察 external-hold 无限轨迹的 productive
状态。四类两两互斥；每个已分类控制终点都表示同一个计算得到的目标
`Config`、同一 verified replay 记录、同一四视图推导，以及 admitted
资源/会话证据。该 disposition 是图重写之后的外部策略决定，不是第二次
重写，也不冻结产品策略。

### 16.2 闭合修正与当前验证边界

第一版 `ProductRuleAdmission.Certificate` 不能作为合法的完成见证。它的
`FourCoherentProjectionCertificates` 字段把签名 admission 内嵌为同一个
固定签名 source `ExecutionPackage` 的一步，因此原生 replay 保持版本；
同一证书又把这些端点等同于一个由 `advancesEpoch` 要求严格增加版本的
admission。因此该 record 对所有参数都不可居住。source 声明
`certificate_uninhabited_fixed_signature_admission` 现已由 kernel 检查该
矛盾。修正后的 root-built `HeterogeneousProductRuleAdmission` 接口分离
固定签名业务证书与异构 source/four-target admission bundle。
`P1cAdmittedFourOccurrence.fixedOccurrence` 为每个具体 admitted 参考
occurrence 提供实质固定 epoch DAG/Petri/native-late-pi/态射记录，以及精确
source 与四目标 replay。`FiniteExecutableEpochProjectionReference.fourTypedViews`
现还提供一个非空跨 epoch 参考 bundle：独立 old/new target package、两侧
固定 epoch projection certificate、四个独立类型化原生 admission、严格版本
推进与精确 replay；其中 pi 构造子保留真正可见的 registration input，其余
三视图仍是有限可执行参考语义而非生产模型。尚无产品 inhabitant 把跨 epoch
admission 连接到
全部静态、Petri、资源、授权、公平性、概率与调度层。

七个数值 requesting fingerprint 是必要条件而非充分条件：
`badRequesting` 具有全部七个值及原生 `tau` 导数，但该导数的 free-name 集
使它不可能与 established 目标结构同余。增强 bundle 再固定 free names 与
free subjects，能排除这一已知反例；其 root-built 算术与语法引理还导出
两个长度为二的活动线程、精确原生 `4 -> 2` 消耗、残余 send/receive 极性
及外层 restriction/parallel 正常形。root-built nominal-orbit 层进一步证明：
唯一自由 payload 未被外层 binder 捕获，并位于两个活动线程之一的 output-value
位置；该接口经全部 alpha/structural 构造保持。原生构造反演进一步证明单个
顺序两前缀线程不能自行做静默步，覆盖 capture-avoiding slow freshening
分支，并按结构同余提取两个 residual 单前缀通信线程。linked endpoint
normalization 覆盖四种 direct/crossed sync/close presentation。一个 kernel-checked
parallel-zero 反例证明不能要求原生目标语法精确属于 linked endpoint；最终
定理必须存在性地产生 linked endpoint，并以结构同余关联实际目标。下述
nominal-incidence closure 现已对每个真实 split 构造该分类。

在该历史检查点，固定 Lean 4.32.0 普通 evidence gate 在 dirty worktree 上
通过：283 个 Lean 文件、root build 8,938 jobs，以及 667 份只含
`propext`、`Classical.choice` 与 `Quot.sound` 的依赖报告。该可变树状态与
manifest 计数已由 §21 和不可变 QA 证据取代；独立评审、FCP、ADR 接受及
生产包符合性仍是外部事项。

### 16.3 P1b 标记化 split 与非空的修正产品证书

requesting 证明现又越过两层语义边界。`P1bLabelledThreadInversion`
精确反演真实的 `syncLeft`、`syncRight`、`closeLeft` 与 `closeRight`
构造，并覆盖 capture-avoiding slow freshening。随后
`P1bRequestingPolarityOrbit`、`P1bRequestingThreadPolarityClassifier`
与 `P1bNativeSplitContext` 在完整 alpha/structural 轨道上证明：
每个真实 requesting 原生步都有一个共享 restriction context、一条
send/send 线程、一条 receive/receive 线程，以及四种精确 split 推导之一。
因此原生规则选择、context 对齐与 polarity 已不再属于剩余义务。

`P1bRestrictionEnvelope` 独立证明双 essential binder、单 essential binder、
垃圾 restriction 消去及 up-to-`Late.Struct` 正规化。其经内核检查的
scope-extrusion 例子还否定了“每个代表元的外层 restriction list 必须同时
暴露 public 与 session”的更强命题。`P1bRequestingReflectionClosure`
证明完整 `StandardLateReflection` 等价于 target-up-to-structure
linked-endpoint classifier，并能从该 classifier 构造最终投影证书；它也证明
精确 target 语法与纯聚合 residual shape 都不充分。

`P1bNominalIncidenceBoundary` 现把该步骤记录为一个以真实
`SplitCommunication` 为索引的非循环命题。它只要求包装后的精确 residual
正规化为某个存在性受限通道上的 output/input pair，并携带固定自由 payload；
命题本身不提 canonical established endpoint。Lean kernel 已证明由该命题可
完成未知通道与 binder 正规化、完整 requesting reflection 及投影证书构造。
`P1bNominalIncidenceProof` 把 source-side 工作归约为
`RequestingSplitSupportTransfer`；`P1bNominalIncidenceClosure` 随后分别对
`syncLeft`、`syncRight`、`closeLeft` 与 `closeRight` 构造该 transfer。
因此 `requestingPolarizedNominalIncidence`、`requestingNativeResidual`、
`standardLateReflection` 及无条件 `pi_ra_certificate` 均已 kernel-build。
该检查点的 CENTRAL-13 为 `implemented_unverified`；现已绑定不可变证据，
状态为 `proved / review-pending`。

`HeterogeneousProductRuleAdmissionReference` 现已实例化整个修正后的通用
产品证书，而不只是 four-target admission 子记录。该见证含严格异构
`0 -> 1` admission、四个 extension-indexed projection family、忠实 Arrow
realization、static/operational 交换 cell、独立内部业务重写、rank、
资源/会话策略、qualification、authorization、稳定公平窗口、正概率桥与
scheduling 证据；原生可推导性与 replay 仍是独立字段。这证明接口可构造且
不循环：参考 kernel 从非稳定 ready 到稳定 done 的真实业务边赋概率一。
但四个目标是 identity 参考语义，不是生产 DAG、pre-net、π 与态射
模型；每个真实产品规则仍须提供实质四视图 family 及自己的策略/概率证书。

该参考业务关系现对签名敏感：Lean kernel 已证明它在旧签名下不可用，并在
admission 后可用。Replay 会校验记录的 recipe 与 source configuration，
且回归定理拒绝错误规则与错误源。这消除了有限见证中的两个反空洞缺陷，但
不会把 identity 视图变成生产模型。

`P1cProductRuleProofBundle` 现又给出更强的固定 epoch 见证。其 reconnect
occurrence 会真实地向源图增加 `(0, 1)`；四个目标 wrapper 使用不同的状态/
事件类型，并携带独立 DAG、individual-token Petri、原生 standard-late-π
及态射业务推导。事件映射是双射，四个源事件均有原生目标步，且每个目标步
都反射到源步。该 bundle 还包含精确 `DPOEvent` replay、rank、quiescence、
authorization、外部 scheduler、稳定/公平窗口与概率一业务进展。这闭合一个
实质非恒等参考规则，不代表生产产品包已经实例化。

Open-process presentation 也新增了原子支撑 gate。
`OpenSMCNominalAtomBoundary` 用互异的类型化具名端口与精确擦除自由支撑等式，
替代不可检查的 sort-only atom admission。已有非闭 output 例子可在其真实
具名边界通过，并在空具名边界被 kernel 拒绝。组合层具名接口以及原生
plug/hide/restriction 保持仍开放。

最后，`FMSCpoFiniteHoareMonad` 已把有限非空 Hoare 构造提升为有限 ωCPO 与
连续映射全子范畴上的真实 categorical Monad，含连续 Kleisli extension、
两条单位律、结合律与 choice 分配律。它仍无 empty deadlock 和独立 divergence，
因此既不是全 ωCPO Abramsky powerdomain，也不是所需 FMS 域解。

## 17. FMS 定理边界与本地验收条件（2026-07-26）

本节是来源范围校正；它不改变当前 Pre-FCP/M1 证明状态，不采纳 RFC-0002
第 16 节，也不解除任何证明义务。

由来源支持的 FMS 义务包括：

1. 基础 `Cpo` 范畴上的 enriched free pointed-semilattice/Abramsky
   powerdomain，以及它到 `Cpo^I` 的逐点提升；
2. `A = P(H A)` 的连续自然**初始**解及其协调 roll/unroll 映射；
3. 指称所需的 allocation/restriction、action、parallel 与 hiding coherence；
4. 针对显式选定源演算范围、按进程项对量化的 adequacy 与 full abstraction。

“证明一般 algebraic compactness”只是可选的更强构造路线，不是来源定理，
也不是本规范固定的方法。同样，FMS full abstraction 并非“递归域中每个元素
均可定义”的定理。任何独立 definability 定理都必须先经 RFC/ADR 明确其
语义 carrier、逼近类与量词。

FMS 源演算含 guarded replication `!α.P`；当前 Lean `Raw.Proc` 是有限控制
语法，既无 replication 也无 recursion。因此，任何针对当前语法的定理都
不得宣称为 FMS 任意进程定理；加入该语法仍受既有 stop condition 约束。

最后，Cantilune 的逐标签原生一步 soundness/completeness、强
`PowerdomainObservation.map_iff`/`multiplication_iff` 逆像律，以及指定
divergence/deadlock 不等性，都是显式附加验收条件。任何 exact package 都
必须证明它们，但不得把它们归因于所引 FMS 定理。本次澄清没有居留 complete
或 exact FMS package。

## 18. 精确 action、递归域边界与有限产品链

当前 Lean 构造固定了实际世界索引 action 端函子

`H X(n) = N(n) × B X(n) + (N(n) × N(n)) × X(n)
          + N(n) × X(n+1) + X(n)`。

它对任意有限世界单射及模型自然变换的作用连续且满足函子律，`H` 已证明局部
连续。未分离 omega-Scott lower/Hoare 幂端函子 `P` 同样局部连续，因此实际
递归端函子 `P ∘ H` 局部连续。选定积上的 Fubini 与 strength 满足自然性、
单位、对称、结合及 multiplication 协调图。

对完整格目标，

`S ↦ sSup (g '' carrier(S))`

是 `g` 从 principal computation 出发的唯一任意上确界保持扩张。该定理不是
Abramsky 验收定理：`sSupHom` 是承重前提，源对象仍是 bottom 与 empty
deadlock 重合的未分离 lower/Hoare computation。

除原有有限初始塔外，Lean 现已构造连续 embedding-projection 对、
singleton-seeded EP 迭代塔、任意连续投影链的 coherent-thread 逆极限、
其逐 world 自然模型提升、联合单态有限投影，以及规范连续 fold
`F L → L`。缺失的承重步骤精确为 shifted cone 的投影极限保持 witness；
Lean 已证明它等价于连续 inverse `L → F L`，也等价于规范 fold 的 `IsIso`，
并可由 witness 构造 fixed-point witness。现有 hom-local-continuity 不产生
该 inhabitant；运输到 `AgentDomainSolution` 前仍需 initial-algebra 与
terminal-coalgebra 证据。

操作层的一般 bound-output action/derivative α 类保留真实 standard late-π
一步。递归扩展还构造了 action/derivative 联合 α 商、existentially
saturated 强原生一步，以及 embedded、sync、close 的精确
derivative-alpha/target-alpha bridge；不触发数值 freshening 时严格等变，
总 executable substitution 也已证明在所有 freshening 分支按
`RecursiveAlpha` 等变。完整 sync/close `NativeStep` 仍需 substitution
对 alpha-related source body 的 congruence。contextual 具名边界 category 与
proof-carrying 不交叠 partial tensor 已构造，但二者都不是所需 total
operational SMC。边界元数据 renaming 另有精确恒等/组合、单位/结合、
source-support congruence 与顺序 freshening 律；当前 atom certificate
仍排除非空同名 wire，bound-name α 不能修复非空 plug identity，非单射
fusion 会改变 mismatch 行为，任意 contextual tensor interchange 也为假。

对任意有限的 supplied 跨 epoch 产品行序列，Lean 现可构造同步的 source、
DAG、Petri、π 与 morphism 链，并保持：

- 精确 endpoint-free replay；
- 精确 rule-event 与 typed admission-event 标记；
- 严格签名版本边界；
- 精确 execution-epoch 对齐；
- 在源概率空间上保留每个依赖事件与四个原生投影推导的共同轨迹。

直接单行 FMS adapter 本身仍不充分。独立的共同 package 链层现已固定同一个
`ExactFMSAcceptancePackage`，在相邻行传递 eventful endpoint，并给出条件化
任意有限共同 FMS path 接口。真实 kernel 定理还能耦合两个调用方提供的
Ionescu--Tulcea law，并几乎必然保留原生事件标签、精确 DPO replay、
epoch/签名对齐和连续共同 FMS 指称端点。这些仍是参数化定理：仓库没有构造
exact FMS package、生产 kernel/coupling，也没有构造八个产品 Owner 的运行
事实集。
## 19. 分离交换非决定性的相容性边界

严格 pointed continuous-semilattice carrier functor 现在具有全源普通
SolutionSet、普通自由伴随和 CPO-富集 hom 等价；这些是实际构造，不是
验收前提。

对该自由扩张，规范顺序 Fubini 联合连续，把两个 pure value 映射为 pure
pair，并在第一计算参数上保持 divergence、deadlock 与 choice。下述三项
联合不相容：

1. divergence 与 deadlock 不同；
2. sequencing 在第一计算参数上对两个常量都严格；
3. Fubini 在交换两个计算后保持不变。

在 `(divergence, deadlock)` 上，第 2 项使一种顺序得到 deadlock、交换后
得到 divergence，而第 3 项要求二者相等。Lean 以与具体表示无关的
package 级定理 `no_distinguishedFubiniStrictness` 检查了这个论证。

因此，后续定义不得在保留三项要求的同时声称闭合分离式 FMS package。
在递归 `A ≅ P(H A)`、hiding、adequacy 或 full abstraction inhabitant
能够通过完整门槛之前，规范语义必须先由 RFC/ADR 修改。

## 20. 精确剩余语义见证

内核现已构造前两项承重见证，并显式保留第三项区分：

1. `concreteBilimitExhaustivity`：有限 approximant 单调并逐点以 omega-sup
   穷尽恒等映射，由此构造递归 fold 的双侧 inverse 与未分离 omega-Scott
   `concreteActualFixedPointWitness`；
2. `RecursiveAlpha.substitutionCongruent`：把总 fresh-choice α 等变提升为
   全构造原生一步等变；
3. monadic `powerHiding` 协调与真实递归 agent restriction/指称定理之间的
   明确区分。

第 1 项的 fixed point 不是初始代数、终结余代数、代数紧致性定理或 Abramsky
powerdomain。任何定理也不得在没有构造来源相容的递归域、语法指称、
restriction 自然变换与所声明操作等价之前，把第 3 项报告为 adequacy、
definability 或 full abstraction。

产品级四投影与概率定理仍对真实 rule bundle、原生 kernel、coupling 和运行
事实全称量化。八个计划产品包不存在这些 inhabitant，所以通用定理不会自动
实例化出生产一致性总定理。

## 21. 最终承重接缝的实现语义（2026-07-27）

本节取代先前关于完整 common-chain inhabitant 尚未进入可变实现的陈述。
Proof status 仍只由不可变 source commit、proof manifest 与带哈希的 strict
build evidence 决定。

### 21.1 P1a 语义绑定

对同一选定 source `candidate`，完整包同时携带：

```text
DAGSemanticCertificate source dag projection candidate
PetriSemanticCertificate source petri projection candidate
```

二者选择同一个 candidate 及其 replayed `DPOEvent`。DAG graph 不是调用方
自由填写的证书字段，而是事件 source/target configuration 的
`configDependencyGraph`。总 DAG observation 是其 canonical SCC
condensation。对两个 endpoint，每条原始边要么在同一 SCC 内，要么在
condensation 中有对应边；每条 condensation edge 严格增加 canonical rank；
condensation 本身无环。

Petri 的 selected declaration 是同一事件的 `declarationOfEvent`，位于其有序
singleton pre-net。Before/after marking 是所有有限 runtime component 的
canonical `provenanceMarking`，包括 node、edge、data/resource token、name、
observation、policy、live session 与 tombstone。Selected transition 是两者的
精确 `endpointDelta`；它在 before marking 上 enabled，精确 firing 到 after
marking，并保持全部 retained token 的 identity 与 provenance。

这些字段已嵌入 `CoreConformancePackage`，所以通用总定理不再接受仅有任意
命名 projected step 的 DAG/Petri 证明。

固定 epoch 的产品级结论是 `CompleteProductP1aProjectionScope`。它显式
暴露合规产品所提供的完整 DAG、Petri 与 morphism
`ProjectionCertificate`，以及全路径提升/反射和
success/wait/deadlock 保持。Canonical SCC DAG 与可重构 individual-token
Petri 记录仍只是所选 occurrence 的语义 sidecar，不能冒充整个目标 LTS 的
投影证书。框架的非空性由另一个固定签名十四事件 business reference 独立
证明；其 DAG、Petri、morphism 目标使用分别声明的状态与转移类型。该参考
不会与 reconnect candidate 或任意产品包强行等同。

### 21.2 显式 dynamic-admission phase

P1c 源协议保留十五个 `SourceEvent` family，同时新增：

```text
State.admissionEstablished
Event.admissionReconnect
```

精确强序列为：

```text
ready dynamicPartnerAdmission
  -- input(delegationBus, delegatedBinder) -->
admissionEstablished
  -- tau -->
completed dynamicPartnerAdmission
```

第一个 derivative 是 `closedReconnectSource.erase`，即 genuine
`.instanceReconnect` τ step 的 canonical source；terminal derivative 是
`closedReconnectTarget.erase`。FMS compilation 使用同样两阶段。Admission
first target 的指称与 `.instanceReconnect` 的 normative source Agent 字面相等，
而非只在 observation 下等价。异构 alignment 也保留 version pair 与稳定的
rule/session/correlation/occurrence identifier。该路线是 kernel-refuted
terminal-admission shortcut 的规范替代；源证书中没有 `τ*`。

### 21.3 完整 selected-row trajectory 绑定

`CompleteProductCommonTrajectoryCertificate` 接收
`CoreConformancePackage`、positive labelling、FMS labelling、positive state
path、`TrajectoryAgreement` 与 selected index，并要求：

- selected event/source/target 等于包的精确 `candidate`；
- selected mark 是 normative；
- selected operation 等于包的 `ProductPiOperationalSemantics` 对同一事件
  解码的 operation；
- selected metadata 等于包的 canonical `StableMetadata`；
- selected FMS endpoint 等于包所选 family 的 normative actual-Agent
  source/target。

由此派生同一 projected native step、精确 `DPOEvent` replay、
metadata-from-replay 方程、genuine raw late-π step、registry realization、
raw structural source、joint action/derivative alpha 与 actual-FMS
commutation，不能用互不相关的 witness 填充。

`generic_technical_closure_with_common_trajectory` 是任意携带完整 inhabitant
产品的参数化最终组合。无参数 `reference_technical_closure` 用实质 reconnect
core 与 canonical 概率一 selected row 居留它。独立的异构
admission/reconnect alignment 给出跨签名 literal actual-Agent seam。该结论
属于 Core Theory/reference，不实例化八个生产包。

### 21.4 具名 wire freshness

Singleton presented identity 的 operational realization 要求
`WireNamesFresh sourceName targetName binder`，即三个名字 pairwise distinct。
Canonical named tensor 把右块的每个名字 freshen 到完整左支撑之外。因此
operational example 不能依赖 endpoint alias 或 binder capture；这仍不把
presented identity 等同于 raw structural identity。

### 21.5 当前验证边界

### 21.6 跨 epoch Petri 注册表闭环

Petri 部分现在严格区分纯签名搬运与异构 admission 转换。
`PreNetExtension` 证明旧声明列表是新列表的字面前缀，每条旧 incidence
都沿同一个 `SignatureExtension` 重索引，且选定新声明以 admission
目标版本 fresh append。`ReconfigurablePetriCertificate` 再把该注册表扩展
绑定到同一个 Petri admission occurrence、其原生推导与 replay、
admission tombstone/version、相连的 admission 后 candidate，以及该
candidate 在所选 occurrence 上的 enabled firing。

通用证书允许第一次 admission 从空注册表开始。无参数实质参考包更强：
`LegacyPetriAntiVacuity` 证明旧注册表含有一个具体非空 endpoint-delta
incidence，并证明该精确 incidence 在重索引后仍被保留。这是参考见证的
反空洞性质，而不是“每个初始注册表非空”的错误全局假设。

本节不声称整个目标 LTS 上的全局 `step iff firing`；结论始终以选定、
可 replay 的 occurrence 为索引。

中央义务已绑定 source commit
`59a1a6885ef6a2774b2731f487f83228e67d15dc` 与 QA 构建/审计记录。该记录覆盖
commit-bound 构建续跑、source integrity、placeholder/axiom audit、proved
manifest 与 strict proved/tree gate。现行技术状态为 `proved / review-pending`；
独立评审与治理接受仍是外部行为。
$$
