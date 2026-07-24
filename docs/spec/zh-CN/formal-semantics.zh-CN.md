# CantiluneGraph v0.1 —— 形式语义规范

| 字段 | 值 |
|---|---|
| 状态 | **草案**（等待 RFC-0002 一致性证明 + 第二评审人） |
| 类型 | 规范性规格（形式语义） |
| 风险 | S2 |
| 负责人 | Joker-of-Gotham（DRI） |
| 评审人 | 待定（治理缺口 —— 见 RFC-0001 元数据 / 治理说明） |
| 创建日期 | 2026-07-23 |
| 更新日期 | 2026-07-23（机械化边界对账） |
| 相关 | RFC-0001、ADR-0001、RFC-0002、`docs/research/zh-CN/0001-p1b-pi-bridge-audit.zh-CN.md` |

> **治理说明：** 本规范定义 RFC-0002 必须证明其一致性的那个形式对象。标记为**待证 / 未经验证**的主张尚未证明；标记为**按构造**的主张直接得自本规范的定义。π 投影因设计决策（half-π (II)）而**待证** —— 见 §6.4 与 RFC-0002。

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
分量下的唯一性。因此相对于选定生成元解释的任意目标泛比较已通过内核。
它仍为 `implemented_unverified`：尚无绑定不可变 commit 的完整构建记录
或独立 QA-L4 复核。投影重写保持是另一项仍开放的义务。

## 3. 语法层（具体形式）

### 3.1 节点（类型化计算 actor）

节点不是"图中的一个节点"；它是类型化生成元：

```yaml
node:
  id: planner
  type: AgentOperation          # Agent | Tool | Human | Environment | ...
  in:  [Goal]
  out: [TaskPlan]
  contract:
    pre:  [goal.exists]
    post: [plan.valid]
```

### 3.2 边（类型化契约边）

边是携带契约的类型化数据依赖：

```yaml
edge:
  source: planner
  target: executor
  artifact: TaskPlan
  schema:   TaskPlan/v1
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

| 性质 | 形式表达 |
|---|---|
| Trace | 具体事件序列 $g_0 \xrightarrow{e_1} g_1 \xrightarrow{e_2}\cdots\xrightarrow{e_n}g_n$ |
| 重放 | 给定 $g_0$ 与完整事件/推导序列，在明确选定的等式/同构意义下重新导出 $g_n$；仅有规则名不足够 |
| 终止 | 无无穷归约（一个**需检查**的性质，非自动） |
| Normal form / 卡住 | 等价类 $[g]_{\equiv_R}$ 没有出向具体事件 |
| 成功终止 | $[g]_{\equiv_R}$ 是 normal form 且 $\mathcal T_{\mathrm{ok}}([g])$ |
| 死锁 | $[g]_{\equiv_R}$ 是 normal form 且 $\neg\mathcal T_{\mathrm{ok}}([g])$ |

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
- 每个投影保持并反射独立提供的成功终态谓词，使 normal form、成功终止与死锁不漂移。这三项义务对每个非同一性投影仍开放；π 另有目标/类型阻塞。

### 6.3 分期证明（依 DRI 决策）

| 阶段 | 证明 | 状态 |
|---|---|---|
| P1a | DAG/Petri/态射一致性 | **可复用操作证书 family 与有限 fixture 已通过 kernel；预期静态/DPO/resource/admission 实例仍不完整** |
| P1b | π 投影对 **request/accept 通道创建子语言**的一致性 | **有限封闭证书与 late-π 基础已通过 kernel；一般证书及 FMS 桥仍不完整** |
| P1c（延后） | π 投影对**自由对话 / 无限制移动性**的一致性 | **有限 60 格参考矩阵已是 60/60 native，并有四份只在各自声明的受限目标关系内成立的按事件索引操作证书；但这尚不等于完整标准 late-LTS reflection：当前开放 reconnect/delete 编码存在额外环境转移，一般 admitted-rule/static/resource 层也未完成** |

### 6.4 回退（依 ADR-0001）

若 P1b/P1c 无法证明，退到 π 的最大一致子语言并在 RFC-0002 中**记录缩减**。依据治理，π 的任何"一致"主张不得超过实际已证；未证部分标记**未经验证**。

## 7. 本规范保证与不保证之物

| 保证 | 来源 | 范围 |
|---|---|---|
| 合法复合 / 并行 | SMC $C$ | 静态，按构造 |
| 统一执行步 = 重写 | $R$ | 按定义 |
| trace / normal-form 定义（离散） | $R$ + 状态同余 $\equiv_R$ | 以两者均固定为条件 |
| 成功终止 / 死锁分类 | 独立提供且对同余饱和的 $\mathcal T_{\mathrm{ok}}$ | **有条件/开放** |
| 确定性重放 | 完整事件/推导记录 + 规范化策略 | **有条件；不能由规则名推出** |
| 跨投影一致性（3 投影） | SMC-函子 + 独立可观察 LTS + 事件提升/穷尽性 + 终态谓词 | **除同一性视图外未经验证** |
| 跨投影一致性（π） | 类型正确的静态目标 + 独立指定的操作/终态桥定理 | **待证** |
| 有界性 / 活性 | Petri 网级检查器 | **检查而非给定** |
| 时间界 | —— | **不提供**（仅步数有界） |

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

参考：nLab，*monoidal category*（[ncatlab.org/nlab/show/monoidal+category](https://ncatlab.org/nlab/show/monoidal+category)）。

### 10.2 对称幺单范畴（SMC）

**对称幺单范畴（SMC）**是幺单范畴额外配备一个**对称**（平方为恒等的辫子）自然同构

$$\sigma_{x,y} : x \otimes y \xrightarrow{\sim} y \otimes x$$

满足**六边形**公理（对称与结合子协调）与对称公理 $\sigma_{y,x} \circ \sigma_{x,y} = \mathrm{id}_{x \otimes y}$。在 `cantilune` 中，$\sigma$ 建模并行资源/通道的重排（token 互换、通道改路）。

参考：nLab，*symmetric monoidal category*（[ncatlab.org/nlab/show/symmetric+monoidal+category](https://ncatlab.org/nlab/show/symmetric+monoidal+category)）。

### 10.3 自由对称幺单范畴

类型化图 $G_0 = (N, E, \tau)$ 上的**自由对称幺单范畴**，是将 $G_0$ 的节点（生成元）作为生成态射，并对 $\otimes$（并置）、$\circ$（沿匹配类型复合）、$\sigma$（置换）、$I$（空张量）自由封闭，仅模以 SMC 公理（结合、单位、对称、函子性）取商 —— 即除 SMC 公理与生成元所声明的输入/输出类型外**无**任何额外等式。

以 PRO/PROP 术语：签名上的**自由对称**幺单范畴即对应的 **PROP**（一个严格的 SMC，其对象在张量下由单一对象生成）。此处所用 SMC presentation（类型化多种类）是多种类 PROP 推广。

参考：nLab，*PRO* 与 *PROP*（[ncatlab.org/nlab/show/PRO](https://ncatlab.org/nlab/show/PRO), [ncatlab.org/nlab/show/PROP](https://ncatlab.org/nlab/show/PROP)）。

### 10.4 幺单积（$\otimes$）

**幺单积**（张量）$\otimes$ 是幺单范畴的双函子。在 `cantilune` 中，$\otimes$ 即**并行复合** —— 将两个操作并排放置、无串行依赖。其单位 $I$ 即空并行复合。

### 10.5 弦图

**弦图**是幺单范畴中态射的图形语法：**线**表示对象（类型）；**盒子**表示态射（操作）；**并置**线表示 $\otimes$（并行复合）；将一盒的输出线**接入**另一盒的输入线表示 $\circ$（串行复合）；**交叉**线表示对称 $\sigma$；**无线**表示 $I$。

依协调定理（Joyal–Street，《The geometry of tensor calculus I》），图形演算是**可靠且完备**的：两张弦图表示同一态射，当且仅当其一可经平面/拓扑同伦（在尊重对称的前提下）形变为另一。这正是弦图作为 `CantiluneGraph` 规范 *presentation*、且允许四种读法（DAG/Petri/π/态射）的原因：每种读法是同一图形语法的不同解释。

参考：nLab，*string diagram*（[ncatlab.org/nlab/show/string+diagram](https://ncatlab.org/nlab/show/string+diagram)）；Selinger，《A survey of graphical languages for monoidal categories》(2009)；Joyal–Street，《The geometry of tensor calculus I》(1991)。

### 10.6 动力学 $R$ —— 弦图重写

**弦图重写**是弦图的代数方法重写。一条**重写规则** $\rho$ 是一个 span

$$L \xleftarrow{l} K \xrightarrow{r} R$$

其中 $L$ 为**左部**（待匹配模式），$K$ 为**不变接口**（保留的子图），$R$ 为**右部**（替换）。一个具体**重写事件** $e=(\rho,m,\delta)$ 及步骤 $g\xrightarrow{e}h$ 通过：
1. **匹配**：经匹配 $f : L \to g$，将 $L$ 作为 $g$ 的子图定位；
2. **删除**：删除所匹配的 $L \setminus K$（构造推出补）；
3. **添加**：沿 $r$ 取推出，加入 $R \setminus K$，

得到导出图 $h$。其中 $m$ 记录具体匹配，$\delta$ 记录所选重写体系要求的其他见证/选择数据。执行即重写；**trace** 为事件序列 $g_0\xrightarrow{e_1}g_1\xrightarrow{e_2}\cdots\xrightarrow{e_n}g_n$；**重放**先从完整事件记录中去掉已存端点，再以声明的源状态为输入，用确定性内核重新执行所得 recipe；已验证记录必须证明该计算恢复其记录目标，直接读取已存目标不算重放。Normal form 在所选商 LTS 上定义：$[g]_{\equiv_R}$ 无出向具体事件；**成功终止**另满足独立提供、对 $\equiv_R$ 饱和的 $\mathcal T_{\mathrm{ok}}$，**死锁**则不满足。后二者并非由 $(C,R)$ 单独推出。当一条规则有多个匹配时，只有规则名的序列不是确定性重放日志。

参考：nLab，*graph rewriting* / DPO（[ncatlab.org/nlab/show/graph+rewriting](https://ncatlab.org/nlab/show/graph+rewriting)）；Ehrig–Pfender–Schneider (1973)；Lack–Sobociński，《Adhesive Categories》(2004)；nLab，*labelled transition system*（[ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)）。**修正：**早前 “Gadducci–Montanari, functorial semantics of rewriting” 属误述；见 §10.10/§11。

### 10.7 标号转移系统（LTS）

**LTS** 是一个结构 $T = (S, i, E, \mathrm{Tran})$，含状态集 $S$、初始状态 $i \in S$、事件（标号）集 $E$、与**转移关系** $\mathrm{Tran} \subseteq S \times E \times S$；$s \to_a s'$ 表示 $(s, a, s') \in \mathrm{Tran}$。重写体系固定后，`cantilune` 的动力学 $R$ 诱导一个 LTS，其中 $S=$ 弦图，$E=\operatorname{App}(R)$ 为完整规则应用/推导记录 $e=(\rho,m,\delta)$。把 $e$ 投影为规则名 $\rho$ 可得更粗的 trace，但会丢失重放身份。

参考：nLab，*labelled transition system*（[ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)）。

### 10.8 Petri 投影 —— 集体与个体 token 语义

Meseguer–Montanari 对 Petri 网计算给出范畴语义；Bruni–Meseguer–Montanari–Sassone 区分集体 token 与个体 token 解释。在所引函子模型中，复合连接计算，张量表示并行。原始来源因此不支持早前“交换性全局强制 $\circ=\otimes$”的陈述。

Pre-net 用有序列表替代变迁边界上的多重集，并生成自由严格对称幺单范畴。cantilune 选择该语义，是为保留声明顺序、token 历史与因果来源。它是设计选择，不是 Eckmann–Hilton 的必然结论，也不是源重写自动成为 Petri 触发的证明。

参考：Meseguer–Montanari，《Petri Nets Are Monoids》，Information and Computation 88(2):105–155 (1990)，doi:10.1016/0890-5401(90)90013-8；Bruni–Meseguer–Montanari–Sassone，《Functorial Models for Petri Nets》，Information and Computation 170(2):207–236 (2001)，doi:10.1006/inco.2001.3050。

### 10.9 π 投影 —— 函子范畴语义（2026-07-23 经来源核实）

Fiore–Moggi–Sangiorgi 使用**协变**函子范畴

$$\mathrm{Mod}=\mathbf{Set}^{\mathbb I}=[\mathbb I,\mathbf{Set}]
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

### 13.8 P1b 状态小结

| 项 | 状态 |
|---|---|
| 步骤 A：$\mathbb I$ | **已核实** |
| 步骤 B：函子范畴模型 | **已核实；方差已修正** |
| 交接的步骤 C 张量 | **被拒：不是双函子，生成元映射也类型不成立** |
| “裸进程 vs 商”选择 | **两者均非缺失范畴结构的必要/充分条件** |
| 正确环境 SMC | **已识别逐点笛卡尔结构** |
| 步骤 D | **FreeSMC 任意目标泛比较与实际 mathlib 对称幺单结构、`Type` 上真正的有限幂集 monad 及其 `Type^I` 逐点 monad、局部无名 supported-process 函子、非恒定 `Set^I`/`Cpo^I` 支撑模型、CPO 世界 shift/allocation、连续支撑 hiding 与支撑层回缩等式、离散 CPO 有限幂 monad 与有限 `P_f(H-)` 逼近均已存在。`CompleteExternalFMSTheoremPackage` 已写出精确的 world/action、强交换 powerdomain、协调 restriction、域方程与全抽象验收接口，但 `CompleteFMSAvailable` 没有 inhabitant；这些支撑等式不居留该 package，真实 Abramsky/富集模型仍未证** |
| 步骤 E | **有限 P1c 参考面现为 60/60 native，并有四份按事件索引的操作证书；这些证书只在各自声明的受限目标关系内是精确的。每个 π 见证均擦除为独立标准 late 推导，但这不是整个 raw 标准 late LTS 的 reflection：当前开放 reconnect/delete 编码还有额外环境转移。一般 DPO/Petri 派生 admission 规则与五层证书仍开放** |
| P1b 总体 | **双路线架构已选；证明未完成；Pre-FCP/M1；迭代，不晋级** |

不声称已证明 C′、D 或 E。该负面结果有实际价值：它排除了错误的张量/商路线，并精确列出重新开始证明前必须补齐的定义。

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
