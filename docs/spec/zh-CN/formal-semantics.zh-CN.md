# CantiluneGraph v0.1 —— 形式语义规范

| 字段 | 值 |
|---|---|
| 状态 | **草案**（等待 RFC-0002 一致性证明 + 第二评审人） |
| 类型 | 规范性规格（形式语义） |
| 风险 | S2 |
| 负责人 | Joker-of-Gotham（DRI） |
| 评审人 | 待定（治理缺口 —— 见 RFC-0001 §0） |
| 创建日期 | 2026-07-23 |
| 相关 | RFC-0001、ADR-0001、RFC-0002（投影一致性） |

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
- **$R$** —— $C$ 上的一组**弦图重写规则**。$R$ 是*动力学*：执行即重写；一步即一次重写；trace 即归约序列；重放即重跑序列；死锁即"无 redex 但未达 normal form"。

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

$C$ 是 $G_0$ 上的**自由 SMC**（模以定义 $\otimes$、$\circ$、$\sigma$ 的等式）。这使得 **DAG 投影按构造成立**（§6.1）。

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

边生成 $C$ 中的态射；契约成为类型义务。

### 3.3 弦图（presentation 形式）

`CantiluneGraph` 的规范 **presentation** 是**弦图**：盒子（态射）由线（对象/类型）连接。同一张弦图允许四种读法（DAG / Petri / π / 态射）——这是"四理论是四个观察维度，而非四个模块"（RFC-0001 §5.1）的形式内容。

## 4. 动力学：弦图重写 $R$

### 4.1 重写规则

规则 $\rho \in R$ 是一对弦图 $\rho : L \to R$（LHS 模式 → RHS 模式），含匹配条件。**执行步骤** = 对当前图中的一个 redex 应用一条规则。

### 4.2 衍生性质

| 性质 | 形式表达 |
|---|---|
| Trace | 归约序列 $g_0 \to_\rho g_1 \to_{\rho'} \cdots \to g_n$ |
| 重放 | 给定 $g_0$ 与规则序列，确定性地重新导出 $g_n$ |
| 终止 | 无无穷归约（一个**需检查**的性质，非自动） |
| 死锁 | 无 redex 匹配，但 $g$ 非 normal form |
| Normal form | 无 redex 匹配且 $g$ 是（预期的）终态图 |

### 4.3 重写**不给**的东西

- **墙钟时间界**：重写是离散的；时间界需*带代价标注*的重写或时间扩展（v0.1 范围外）。
- **数值资源上界**：$\text{token} \le 3$ 是 Petri 投影上的**标记不变量**（§6.2），非裸范畴性质。

这些限制显式声明，使 RFC-0001 §8 的 C2（可预知性）表述为**步数有界**，而非时间有界。

## 5. 四个投影

每个投影 $P_i : (C, R) \to \text{Target}_i$ 将统一对象映到一个目标形式体系。**一致性**指每个 $P_i$ 是**保持结构的函子，且提升到重写**（重写函子 / simulation）：它把 $C$ 中的重写步映为目标中的重写步。

### 5.1 DAG 投影 $P_{DAG}$

$P_{DAG}$ = 底层 presentation 图 / 自由范畴生成元。

- **按构造**：$C$ 在 $G_0$ 上自由，故 $P_{DAG}(C)$ 即 $G_0$ 的数据依赖视图。
- **重写提升**：节点推进 = 局部重写；平凡地为重写函子。
- **状态：按构造一致。**

### 5.2 Petri 投影 $P_{Petri}$

$P_{Petri}$ = 库所/变迁读法，取**pre-net / 自由 SSMC 语义**（Bruni–Meseguer–Montanari–Sassone），**非**朴素的交换幺单读法（为何此解决承重，见 §5.2.1）。

- 库所 = 生成对象；变迁 = 态射 $\text{in} \otimes \cdots \otimes \text{in} \to \text{out} \otimes \cdots \otimes \text{out}$；标记 = 对象；触发 = 重写。
- **按构造**（§5.2.1 解决后）：Petri 网经 pre-net 有自由严格**对称**幺单范畴语义，保 $\circ$/$\otimes$ 之别。
- **声明性注意事项（非缺陷）**：有界性 / 活性 / 可达性是**在此投影上检查的网级性质**，非裸 SMC 给出。RFC-0002 列出检查器义务。
- **状态：按构造一致（模以网级性质检查器与 §5.2.1 pre-net 解决）。**

### 5.2.1 Eckmann–Hilton 坍缩的 pre-net 解决（承重）

经典对应"Petri 网即交换幺单范畴"（Meseguer–Montanari, 1990）把库所置于*自由交换幺半群*，生成**交换**幺单范畴。在交换幺单范畴中，Eckmann–Hilton 论证使 $g \circ f + 1_a = g + f$，即**串行复合 $\circ$ 与并行复合 $\otimes$ 一致**——"集体 token 哲学"，token 无个体身份。这对 cantilune 不可接受：DAG/Petri 之别的全部意义就是 $\circ$（数据依赖）与 $\otimes$（并行性）*不同*，坍缩会抹掉依赖于此区别的 C2（可预知）与 C3（控制面）故事。

解决是 **pre-net** 构造（Bruni–Meseguer–Montanari–Sassone，《Functorial Models for Petri Nets》）：
- pre-net 以自由（非交换）幺半群替代交换幺半群，给每个变迁的输入/输出配备一个序；
- 伴随 **PreNet ⇄ SSMC** 生成**自由严格对称幺单范畴**（非交换、有非平凡对称态射），保 $\circ$/$\otimes$ 之别（个体 token 哲学）；
- 对称在第二步加（将 PreNet⇄SMC 伴随与"自由加对称"伴随复合），恢复 token 置换而不坍缩 $\circ$ 与 $\otimes$；
- 普通 Petri 网经 **abelianization**（忘序）恢复；反之，对 Petri 网 $P$，选一个 abelianize 到 $P$ 的 pre-net $Q$，取自由 SSMC $L(Q)$ 为语义。

**声明的设计决策（不隐藏）：** pre-net 选择 $Q$ 是*额外结构*——同一多重集变迁的不同序可给不同语义。故 cantilune 承诺一个**规范 pre-net 选择约定**（在 P1a 撰写中具体化：大概率为节点在 RFC-0001 §6.4 图定义 API 中声明输入/输出的顺序）。此约定是设计输入，非定理；须记录在案使 Petri 语义可复现。**归属除 nLab 陈述外未经验证 —— Bruni–Meseguer–Montanari–Sassone 引文须对照源文献在 FCP 前确认（见 §11）。**

此解决正是"$P_{Petri}$ 按构造为 SMC-函子"可辩护的原因：无之，Petri 投影落入*交换*幺单范畴，那甚至不在一个须保持 $\circ \ne \otimes$ 的 SMC-函子的正确家族里。§8.6 记此为"已决策解决、待撰写"。

### 5.3 态射投影 $P_{Mor}$

$P_{Mor}$ = $C$ 本身。

- 复合 = $\circ$；并行 = $\otimes$；对称 = $\sigma$。编排 = 态射复合（RFC-0001 §6 态射侧面）。
- **按构造**（即同一性视图）。
- **状态：按构造一致。**

### 5.4 π 投影 $P_\pi$ —— **待证**

依据 half-π (II) 决策：通道经 **request/accept** 动态创建（动态寻址，运行时决定），且**握手后对话无类型/自由**（完整 π 移动性，无 session types）。

- **目标**：完整 π 演算（request/accept 作为结构化通道创建的 presentation），配**预层 / 函子范畴语义**（Fiore–Moggi–Sangiorgi 风格）——非裸 SMC。
- **一致性非按构造**：将 SMC+重写桥接到 π 预层语义是 RFC-0002 中**待证的定理**，配分期计划（见 §6.4 / RFC-0002 §4）。
- **状态：待证。** 此处任何未证主张标记为**未经验证**。

## 6. 状态小结与证明义务

### 6.1 按构造（在 RFC-0002 形式化函子前属未经验证，但得自定义）

- DAG、Petri、态射投影作为保持 $\otimes$ 且提升 $R$ 的 SMC-函子。

### 6.2 RFC-0002 中待证

- 每个投影函子 $P_i$ 是**重写函子**（保持重写步）。
- **跨投影步一致性**：$C$ 中一次重写步在四个投影中的像彼此一致。（三投影：预期干净。π：难点所在。）

### 6.3 分期证明（依 DRI 决策）

| 阶段 | 证明 | 状态 |
|---|---|---|
| P1a | DAG/Petri/态射按构造一致性 + 重写函子性 | **按构造（待撰写）** |
| P1b | π 投影对 **request/accept 通道创建子语言**的一致性 | **待证** |
| P1c（延后） | π 投影对**自由对话 / 无限制移动性**的一致性 | **待证，可能出 P1** |

### 6.4 回退（依 ADR-0001）

若 P1b/P1c 无法证明，退到 π 的最大一致子语言并在 RFC-0002 中**记录缩减**。依据治理，π 的任何"一致"主张不得超过实际已证；未证部分标记**未经验证**。

## 7. 本规范保证与不保证之物

| 保证 | 来源 | 范围 |
|---|---|---|
| 合法复合 / 并行 | SMC $C$ | 静态，按构造 |
| 统一执行步 = 重写 | $R$ | 按定义 |
| trace / 重放 / 死锁（离散） | 重写 | 按构造 |
| 跨投影一致性（3 投影） | SMC-函子 | 按构造（撰写待完成） |
| 跨投影一致性（π） | 预层桥接定理 | **待证** |
| 有界性 / 活性 | Petri 网级检查器 | **检查而非给定** |
| 时间界 | —— | **不提供**（仅步数有界） |

## 8. v0.1 开放问题

1. $G_0$ 的具体类型系统语法（节点/边/契约）。
2. 精确的重写规则 schema $R$（哪些规则族：节点推进、token 触发、通道通信、复合）。
3. π 预层桥接构造及其重写函子证明（RFC-0002 §4）。
4. Petri 投影上的标记不变量 / 资源上界形式化。
5. 代价标注扩展（若 C2 步数有界对可预知性主张不足）。
6. **Petri 投影：交换幺单 vs pre-net/SSMC 语义。** 朴素的"Petri 网即交换幺单范畴"读法经 Eckmann–Hilton 使 $\circ$ 与 $\otimes$ 坍缩（集体 token 哲学），与 cantilune 需保持串行依赖与并行性之别相冲突。P1a 必须采用 pre-net / 自由 SSMC 语义（Bruni–Meseguer–Montanari–Sassone），或论证该坍缩无害。见 §10.8。

## 9. 参考

- RFC-0001（`docs/rfc/0001-cantilune-architecture.md`）
- ADR-0001（`docs/adr/0001-unified-formal-structure.md`）
- RFC-0002（`docs/rfc/0002-projection-consistency.md`）—— 与本规范同步撰写
- Meseguer–Montanari（Petri 网即交换幺单范畴）
- Fiore–Moggi–Sangiorgi（π 演算预层语义）
- Gadducci–Montanari（函子重写语义）
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

其中 $L$ 为**左部**（待匹配模式），$K$ 为**不变接口**（保留的子图），$R$ 为**右部**（替换）。一次**重写步** $g \to_\rho h$ 通过：
1. **匹配**：经匹配 $f : L \to g$，将 $L$ 作为 $g$ 的子图定位；
2. **删除**：删除所匹配的 $L \setminus K$（构造推出补）；
3. **添加**：沿 $r$ 取推出，加入 $R \setminus K$，

得到导出图 $h$。执行即重写；**trace** 为归约序列 $g_0 \to_\rho g_1 \to_{\rho'} \cdots \to g_n$；**重放**即重跑该序列；**死锁**即"无规则匹配但 $g$ 非 normal form"。这诱导一个**标号转移系统**（LTS），其状态为弦图、标号转移为规则应用。

参考：nLab，*graph rewriting* / DPO（[ncatlab.org/nlab/show/graph+rewriting](https://ncatlab.org/nlab/show/graph+rewriting)）；Ehrig–Pfender–Schneider (1973)；Lack–Sobocinski，《Adhesive categories》；Gadducci–Montanari，《functorial semantics of rewriting》；nLab，*labelled transition system*（[ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)）。

### 10.7 标号转移系统（LTS）

**LTS** 是一个结构 $T = (S, i, E, \mathrm{Tran})$，含状态集 $S$、初始状态 $i \in S$、事件（标号）集 $E$、与**转移关系** $\mathrm{Tran} \subseteq S \times E \times S$；$s \to_a s'$ 表示 $(s, a, s') \in \mathrm{Tran}$。`cantilune` 的动力学 $R$ 诱导一个 LTS，$S = $ 弦图，$E = R$（规则），使 trace 良定义。

参考：nLab，*labelled transition system*（[ncatlab.org/nlab/show/labelled+transition+system](https://ncatlab.org/nlab/show/labelled+transition+system)）。

### 10.8 Petri 投影 —— 范畴语义（含一个真实微妙之处）

经典地，（库所/变迁）**Petri 网**被建模为**交换幺单范畴**：库所为生成对象；变迁为态射 $\mathrm{in} \otimes \cdots \otimes \mathrm{in} \to \mathrm{out} \otimes \cdots \otimes \mathrm{out}$；标记为对象；触发变迁即应用态射。此即"Petri nets are monoids"对应（Meseguer–Montanari, 1990）。

⚠️ **影响本规范的微妙之处（已声明，须在 P1a 中解决）：**在*交换*幺单范畴中，Eckmann–Hilton 论证使**串行**与**并行**复合坍缩（$g \circ f$ 与 $g \otimes f$ 一致），即**集体 token 哲学**（token 不具个体身份）。这与 `cantilune` 需保持 $\circ$（DAG 依赖）和 $\otimes$（并行性）*相区别*相冲突。标准解决是经 **pre-nets**（Bruni–Meseguer–Montanari–Sassone）的**个体 token 哲学**：pre-nets 生成**自由严格对称幺单范畴**（非交换），保 $\circ$/$\otimes$ 之别；再加对称以恢复 token 置换。**RFC-0002 P1a 必须采用 pre-net / SSMC 语义，而非朴素的交换幺单读法**，或论证该坍缩对 `cantilune` 用法无害。此记为开放问题 §8.6。

参考：nLab，*Petri net*（[ncatlab.org/nlab/show/Petri+net](https://ncatlab.org/nlab/show/Petri+net)）；Meseguer–Montanari，《Petri nets are monoids》(1990)；Bruni–Meseguer–Montanari–Sassone，*pre-nets*。

### 10.9 π 投影 —— 预层语义（待证）

π 演算（此处为 half-π (II)：request/accept + 自由无类型对话）的范畴语义在**预层 / 函子范畴**（建立在名字生成上下文范畴之上，Fiore–Moggi–Sangiorgi）中，不在裸 SMC 中。从 `cantilune` 的 $(C, R)$ 到此预层模型的桥接 —— 以及证明其为重写函子 —— 是 RFC-0002 §4.2/§4.3 的**待证**工作。

参考：Fiore–Moggi–Sangiorgi，《A fully abstract model for the π-calculus》(LICS 1996 及后续)。**归属未经验证 —— 评审人须确认确切引文及其支持本规范用法。**

### 10.10 重写函子 / 函子一致性

**重写函子**（重写的函子语义）是重写装备范畴间的一个（强）幺单函子 $F : C \to D$，且**提升到重写**：对 $C$ 中每个重写步 $g \to_\rho h$，$D$ 中存在重写步 $F(g) \to_{F(\rho)} F(h)$。**四投影一致性定理**（RFC-0002）断言每个投影 $P_i$ 都是从 $(C, R)$ 到其目标的此类重写函子，使一次步在四投影中被一致读出。

参考：Gadducci–Montanari，《functorial semantics of rewriting》（**归属未经验证**）；nLab，*graph rewriting*（[ncatlab.org/nlab/show/graph+rewriting](https://ncatlab.org/nlab/show/graph+rewriting)）。

## 11. 引文核实义务（治理）

§10 中所有概念引文均为**未经验证的归属**，取自视为不可信输入的网络来源。进入 FCP 前，评审人须确认每篇所引文献确实存在、确述 §10 所称内容、并支持本规范用法。三处归属尤为承重，须优先核查：(i) Meseguer–Montanari "Petri nets are monoids" + pre-net 解决；(ii) Fiore–Moggi–Sangiorgi π 预层语义；(iii) Gadducci–Montanari 函子重写。任何无法核实的引文标记**未经验证**，其对应主张不得进入 FCP。

