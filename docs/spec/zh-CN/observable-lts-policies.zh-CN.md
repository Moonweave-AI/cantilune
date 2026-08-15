# 可观测 LTS 粒度策略——逐投影规范

| 字段     | 值                                                                     |
| -------- | ---------------------------------------------------------------------- |
| 状态     | **Draft**（参考证明已实现；进程语义评审待完成）                        |
| 类型     | 规范性规格（可观测语义）                                               |
| 风险     | S2                                                                     |
| 负责人   | Joker-of-Gotham (DRI)                                                  |
| 评审人   | TBD（须有进程语义评审人）                                              |
| 创建日期 | 2026-07-27                                                             |
| 更新日期 | 2026-07-27                                                             |
| 相关     | RFC-0002 (D9, §3 第 2-3 条), ADR-0001, `docs/spec/formal-semantics.md` |

> **治理说明：** 本规范履行 D9 决策对 RFC-0002 FCP 进入的要求。每个投影必须独立定义其可观测商 LTS，以确保非循环性并使一致性定理陈述成为可能。这是**强制性 P1 门**，不是可选的。

---

## 1. 目的与范围

RFC-0002 四投影一致性要求每个投影的**可观测派生**在一致性定理可以有意义地陈述之前被独立定义。本文档规定：

1. 对每个投影（DAG、Petri、π、态射）：什么构成"一个可观测步"
2. 对细粒度状态取商的状态同余关系 $\equiv_i$
3. 定义粒度的行政步隐藏策略
4. 从 $(C,R)$ 派生到可观测 LTS 的显式提升关系 $\operatorname{Lift}_i$

**非循环性要求**：每个投影的可观测语义必须立足于其自身的理论（DAG 执行语义、Petri 网点火、π 演算归约、态射重写），而非从一致性定理本身派生。

## 2. 通用框架

### 2.1 可观测 LTS 结构

对每个投影 $i \in \{\mathrm{DAG}, \mathrm{Petri}, \pi, \mathrm{Mor}\}$，定义：

$$\mathrm{ObsLTS}_i = (\mathcal{S}_i / {\equiv_i}, \mathcal{L}_i^{\mathrm{obs}}, \xrightarrow{}_i^{\mathrm{obs}})$$

其中：

- $\mathcal{S}_i / {\equiv_i}$ —— 可观测状态（细粒度状态按同余取商）
- $\mathcal{L}_i^{\mathrm{obs}}$ —— 可观测标签（业务事件，排除行政步）
- $\xrightarrow{}_i^{\mathrm{obs}}$ —— 可观测转移关系

### 2.2 提升关系

每个投影提供一个显式的**提升关系**：

$$\operatorname{Lift}_i : \mathrm{Derivation}_{(C,R)} \rightharpoonup \mathrm{ObsLTS}_i$$

将 $(C,R)$ 重写派生映为可观测转移，满足：

1. **行政透明性**：内部结构步（重新结合、对称、单位律）被隐藏
2. **同余保持**：$g_1 \equiv_i g_2 \Rightarrow \operatorname{Lift}_i(d_1) = \operatorname{Lift}_i(d_2)$ 对同余状态成立
3. **复合性**：$d_1 ; d_2$ 的可观测 trace 等于提升 trace 的拼接（模以静默步）

### 2.3 设计原则

**P1. 目标语义奠基**：每个投影的可观测 LTS 以目标形式体系（DAG 节点、Petri 变迁、π 通信、态射重写）定义，而非以 $(C,R)$ 或其他投影定义。

**P2. 粒度独立性**：不同投影可以以不同粒度观察同一 $(C,R)$ 派生（例如 Petri 看到 token 流；π 看到通信动作）。

**P3. 非空虚性**：至少一个 $(C,R)$ 派生必须提升为非空可观测 trace（经 P1c 参考见证证明）。

---

## 3. DAG 投影：节点执行可观测 LTS

### 3.1 可观测状态

$$[g]_{\mathrm{DAG}} := g / {\equiv_{\mathrm{DAG}}}$$

**状态同余** $\equiv_{\mathrm{DAG}}$：

- 图在具有相同控制流依赖与节点完成状态时同余
- 行政差异（线标签、幺单结构见证）被隐藏

**形式定义**：
$$g_1 \equiv_{\mathrm{DAG}} g_2 \iff \exists \text{ SMC isomorphism } \phi : g_1 \xrightarrow{\sim} g_2 \text{ preserving node IDs and execution state}$$

### 3.2 可观测标签

$$\mathcal{L}_{\mathrm{DAG}}^{\mathrm{obs}} = \{ \mathrm{exec}(n, \rho) \mid n \in \mathrm{Nodes}, \rho \in R_{\mathrm{productive}} \}$$

**可观测事件**：节点执行（在节点 $n$ 应用产出重写规则 $\rho$）

**被隐藏的行政步**：

- 结构规则：$\sigma$（对称）、$\alpha$（结合子）、$\lambda, \rho$（单位子）
- 不影响控制流的线路由变更
- 幺单单位插入/删除

### 3.3 可观测转移

$$[g_1]_{\mathrm{DAG}} \xrightarrow{\mathrm{exec}(n,\rho)}_{\mathrm{DAG}}^{\mathrm{obs}} [g_2]_{\mathrm{DAG}}$$

**语义**：以规则 $\rho$ 执行节点 $n$ 将 DAG 从状态 $g_1$ 变换为 $g_2$，其中：

- 节点 $n$ 就绪（所有前驱已完成）
- 规则 $\rho$ 是产出计算（非结构的）
- 结果状态 $g_2$ 反映更新的控制依赖

### 3.4 从 $(C,R)$ 提升

$$ \operatorname{Lift}_{\mathrm{DAG}}(g_1 \xrightarrow{\rho} g_2) = \begin{cases}
\mathrm{exec}(n, \rho) & \text{if } \rho \in R_{\mathrm{productive}} \\
\epsilon \text{ (silent)} & \text{if } \rho \in R_{\mathrm{structural}}
\end{cases}$$

**粒度策略**：一个可观测步 = 一次节点执行（产出规则应用）

### 3.5 示例

**场景**：三节点流水线 `planner → executor → reporter`

**$(C,R)$ 派生**：
1. 初始：所有节点 pending
2. 在 `planner` 应用 $\rho_{\mathrm{plan}}$ → 产出 `TaskPlan`
3. 线路由（行政）
4. 在 `executor` 应用 $\rho_{\mathrm{exec}}$ → 产出 `Result`
5. 应用对称（行政）
6. 在 `reporter` 应用 $\rho_{\mathrm{report}}$ → 产出 `Report`

**可观测 DAG trace**：
$$\mathrm{exec}(\texttt{planner}, \rho_{\mathrm{plan}}) \cdot \mathrm{exec}(\texttt{executor}, \rho_{\mathrm{exec}}) \cdot \mathrm{exec}(\texttt{reporter}, \rho_{\mathrm{report}})$$

行政步 3 与 5 被隐藏。

---

## 4. Petri 投影：令牌流可观测 LTS

### 4.1 可观测状态

$$[M]_{\mathrm{Petri}} := M / {\equiv_{\mathrm{Petri}}}$$

**状态同余** $\equiv_{\mathrm{Petri}}$：
- 标记在跨库所的 token 分布相同时同余
- 个体 token 身份有意义（依 D8）：token 携带来源元数据
- 行政差异（内部结构变换）被隐藏

**形式定义**：
$$M_1 \equiv_{\mathrm{Petri}} M_2 \iff \forall p \in \mathrm{Places}.\ \mathrm{tokens}(M_1, p) = \mathrm{tokens}(M_2, p)$$

其中 token 相等包含来源元数据。

### 4.2 可观测标签

$$\mathcal{L}_{\mathrm{Petri}}^{\mathrm{obs}} = \{ \mathrm{fire}(t, \theta) \mid t \in \mathrm{Transitions}, \theta : \mathrm{Vars} \to \mathrm{Tokens} \}$$

**可观测事件**：带 token 绑定 $\theta$ 的变迁点火

**被隐藏的行政步**：
- 内部 Petri 网折叠/展开操作
- 幺单张量积重排（token 多重集上的对称）
- 行政库所插入（例如用于结构编码）

### 4.3 可观测转移

$$[M_1]_{\mathrm{Petri}} \xrightarrow{\mathrm{fire}(t, \theta)}_{\mathrm{Petri}}^{\mathrm{obs}} [M_2]_{\mathrm{Petri}}$$

**语义**：以绑定 $\theta$ 点火变迁 $t$ 从输入库所消费 token 并向输出库所产生 token：
- $t$ 在 $M_1$ 下使能（所有输入库所包含所需 token）
- $M_2 = (M_1 \setminus \mathrm{pre}(t, \theta)) \cup \mathrm{post}(t, \theta)$
- token 来源按点火保持/扩展

### 4.4 从 $(C,R)$ 提升

$$\operatorname{Lift}_{\mathrm{Petri}}(g_1 \xrightarrow{\rho} g_2) = \begin{cases}
\mathrm{fire}(t_\rho, \theta_\rho) & \text{if } \rho \text{ corresponds to productive transition } t_\rho \\
\epsilon \text{ (silent)} & \text{if } \rho \text{ is structural or internal}
\end{cases}$$

**粒度策略**：一个可观测步 = 一次变迁点火（token 消费/生产）

### 4.5 示例

**场景**：带 fork/join 的请求处理

**$(C,R)$ 派生**：
1. 初始标记：`request` 库所 1 个 token
2. 点火 `accept` 变迁 → 消费请求 token，产出 `task` token
3. 点火 `fork` 变迁 → 在 `subtask_A`、`subtask_B` 产出 2 个 token
4. 内部对称（行政）
5. 点火 `process_A` 与 `process_B`（并行）
6. 点火 `join` 变迁 → 消费两个结果 token，产出 `response` token

**可观测 Petri trace**：
$$\mathrm{fire}(\texttt{accept}) \cdot \mathrm{fire}(\texttt{fork}) \cdot \mathrm{fire}(\texttt{process\_A}) \parallel \mathrm{fire}(\texttt{process\_B}) \cdot \mathrm{fire}(\texttt{join})$$

行政步 4 被隐藏；步 5 的并行点火可以交错。

---

## 5. π 投影：通信可观测 LTS

### 5.1 可观测状态

$$[\mathcal{P}]_\pi := \mathcal{P} / {\equiv_\pi}$$

**状态同余** $\equiv_\pi$：
- 进程在结构同余下同余（标准 π 演算 $\equiv$）
- 包括：并行交换律 $P \parallel Q \equiv Q \parallel P$、作用域外移、nil 单位
- 不包括：归约（产生可观测步）

**形式定义**：
$$\mathcal{P}_1 \equiv_\pi \mathcal{P}_2 \iff \mathcal{P}_1 \equiv \mathcal{P}_2 \text{ (standard structural congruence)}$$

### 5.2 可观测标签

$$\mathcal{L}_\pi^{\mathrm{obs}} = \{ \tau \} \cup \{ a(x), \overline{a}\langle v \rangle, \overline{a}(b) \mid a, b \in \mathrm{Names}, x \in \mathrm{Vars}, v \in \mathrm{Values} \}$$

**可观测事件**：
- $\tau$ —— 内部通信（同步发送/接收）
- $a(x)$ —— 在通道 $a$ 上输入
- $\overline{a}\langle v \rangle$ —— 在通道 $a$ 上输出值 $v$
- $\overline{a}(b)$ —— 受限输出（名字外移）

**被隐藏的行政步**：
- 结构重排（$\equiv$ 步）
- 元数据更新（依 D4 的运行时版本跟踪）
- 新鲜名分配（π 机制内部）

### 5.3 可观测转移

$$[\mathcal{P}_1]_\pi \xrightarrow{\alpha}_\pi^{\mathrm{obs}} [\mathcal{P}_2]_\pi$$

**语义**：标准 π 演算归约语义
- 通信：$\overline{a}\langle v \rangle.P \parallel a(x).Q \xrightarrow{\tau} P \parallel Q\{v/x\}$
- 输入：$a(x).P \xrightarrow{a(v)} P\{v/x\}$
- 输出：$\overline{a}\langle v \rangle.P \xrightarrow{\overline{a}\langle v \rangle} P$
- 作用域：$(νb)(\overline{a}\langle b \rangle.P) \xrightarrow{\overline{a}(b)} P$

### 5.4 从 $(C,R)$ 提升

$$\operatorname{Lift}_\pi(g_1 \xrightarrow{\rho} g_2) = \alpha \text{ where } \pi(g_1) \xrightarrow{\alpha} \pi(g_2)$$

**粒度策略**：一个可观测步 = 一次 π 归约（通信动作或 $\tau$）

**元数据处理**（依 D6-B）：运行时元数据层是分离的；π 状态是纯进程项。提升关系在应用标准 π 语义之前投影掉元数据。

### 5.5 多状态协议（D7-A）

针对重连/删除操作的 **P1c 多状态反射**：

**扩展可观测标签**：
$$\mathcal{L}_\pi^{\mathrm{P1c}} = \mathcal{L}_\pi^{\mathrm{obs}} \cup \{ \mathrm{reconnect}(a, b), \mathrm{delete}(a), \mathrm{mismatch}(a, b) \}$$

**多状态协议**：
- 状态 1：请求已发起
- 状态 2：等待外部确认
- 状态 3：完成（或失败）

每个 P1c 获准操作有一个 **3+ 状态协议**，确保对非标准操作的完整反射。这在 **60×60 P1c 操作矩阵** 中证明（见 RFC-0002 §4.3 与 P1c 规范）。

### 5.6 示例

**场景**：带重连的 Agent 通信

**$(C,R)$ 派生**：
1. 初始：`agent_A` 准备消息，`agent_B` 在通道 `ch` 上监听
2. 应用发送规则 → 态射层通信
3. 元数据更新（行政，依 D4）
4. 应用接收规则 → 消息已投递
5. 连接失败检测 → 发起重连
6. 分配新鲜通道（行政）
7. 重连成功 → 建立新通道

**可观测 π trace**：
$$\overline{\texttt{ch}}\langle \texttt{msg} \rangle \cdot \tau \cdot \mathrm{reconnect}(\texttt{ch}, \texttt{ch'})$$

行政步 3 与 6 被隐藏；元数据更新不出现在纯 π 语义中。

---

## 6. 态射投影：重写可观测 LTS

### 6.1 可观测状态

$$[g]_{\mathrm{Mor}} := g / {\equiv_{\mathrm{Mor}}}$$

**状态同余** $\equiv_{\mathrm{Mor}}$：
- 态射在作为 SMC $C$ 中的态射相等时同余
- 包括所有协调同构（结合子、单位子、对称）
- 同一态射的不同呈现同余

**形式定义**：
$$g_1 \equiv_{\mathrm{Mor}} g_2 \iff [g_1] = [g_2] \text{ in } \mathrm{Hom}_C(A, B)$$

### 6.2 可观测标签

$$\mathcal{L}_{\mathrm{Mor}}^{\mathrm{obs}} = \{ \rho \mid \rho \in R \}$$

**可观测事件**：重写规则应用（所有规则在态射层都可观测）

**被隐藏的行政步**：在此层无 —— 态射投影直接看到所有 $(C,R)$ 重写

**理由**：态射投影是"最细粒度"视图；它观察到每一次规则应用。其他投影对此视图取商。

### 6.3 可观测转移

$$[g_1]_{\mathrm{Mor}} \xrightarrow{\rho}_{\mathrm{Mor}}^{\mathrm{obs}} [g_2]_{\mathrm{Mor}}$$

**语义**：与 $(C,R)$ 重写的直接对应
- 规则 $\rho \in R$ 在状态 $g_1$ 匹配
- 重写产出状态 $g_2$
- 态射层协调是自动的（SMC 商）

### 6.4 从 $(C,R)$ 提升

$$\operatorname{Lift}_{\mathrm{Mor}}(g_1 \xrightarrow{\rho} g_2) = \rho$$

**粒度策略**：一个可观测步 = 一次 $(C,R)$ 重写步（无隐藏）

### 6.5 示例

**场景**：带规则应用的多 Agent 并行执行

**$(C,R)$ 派生**：
1. 初始态射：$f_1 \otimes f_2 \otimes f_3$
2. 对 $f_1$ 应用规则 $\rho_1$ → 产出 $f_1'$
3. 应用结合子（协调）
4. 对 $f_2$ 应用规则 $\rho_2$ → 产出 $f_2'$
5. 应用对称（协调）
6. 对 $f_3$ 应用规则 $\rho_3$ → 产出 $f_3'$

**可观测态射 trace**：
$$\rho_1 \cdot \alpha_{-, -, -} \cdot \rho_2 \cdot \sigma_{-, -} \cdot \rho_3$$

所有步均可观测（包括协调同构 $\alpha$、$\sigma$）。同余商确保协调同构的不同派生顺序产生等价状态。

---

## 7. 粒度比较表

| 投影 | 一个可观测步 | 被隐藏步 | 同余基础 |
|------------|-------------------|--------------|------------------|
| **DAG** | 节点执行（产出规则） | 结构规则、线路由 | 控制依赖 + 节点状态 |
| **Petri** | 变迁点火（token 流） | 折叠/展开、token 重排 | 带来源的 token 分布 |
| **π** | 通信动作（$\tau$、I/O） | 结构 $\equiv$、元数据、新鲜名 | 结构同余 |
| **态射** | 任意 $(C,R)$ 重写步 | 无（最细粒度） | SMC 态射同态相等 |

**粒度序**：$\mathrm{Morphism} \leq \mathrm{DAG} \approx \mathrm{Petri} \approx \pi$

态射投影是最细粒度；DAG、Petri 与 π 投影通过隐藏行政步对态射层派生取商。

---

## 8. 非循环性证明

### 8.1 DAG 独立性

**声明**：DAG 可观测语义不依赖于 Petri、π 或态射投影。

**证明**：DAG 可观测 LTS 纯粹以以下定义：
- 控制流图结构（节点、边）
- 节点执行就绪性（前驱完成）
- 产出规则分类（$R$ 所固有）

不引用 token 标记、π 进程或态射结构。∎

### 8.2 Petri 独立性

**声明**：Petri 可观测语义不依赖于 DAG、π 或态射投影。

**证明**：Petri 可观测 LTS 纯粹以以下定义：
- 前置网结构（库所、变迁、弧）
- token 分布与来源
- 变迁使能与点火规则（标准 Petri 语义）

不引用 DAG 执行、π 通信或态射重写。∎

### 8.3 π 独立性

**声明**：π 可观测语义不依赖于 DAG、Petri 或态射投影。

**证明**：π 可观测 LTS 纯粹以以下定义：
- 进程语法（标准 π 演算文法）
- 结构同余（标准 $\equiv$ 关系）
- 归约语义（标准通信/作用域规则）

不引用 DAG 节点、Petri token 或态射结构。∎

### 8.4 态射独立性

**声明**：态射可观测语义不依赖于 DAG、Petri 或 π 投影。

**证明**：态射可观测 LTS 纯粹以以下定义：
- SMC 结构（$C$ 配备 $\otimes$、$\circ$、$\sigma$）
- 重写关系 $R$
- 商范畴中的态射相等

不引用 DAG 控制流、Petri 标记或 π 进程。∎

---

## 9. 一致性关系

**RFC-0002 四投影一致性定理** 陈述：对每个 $(C,R)$ 派生：

$$\operatorname{Lift}_{\mathrm{DAG}}(d) \sim \operatorname{Lift}_{\mathrm{Petri}}(d) \sim \operatorname{Lift}_\pi(d) \sim \operatorname{Lift}_{\mathrm{Mor}}(d)$$

其中 $\sim$ 表示经适当粒度对齐后的**观测等价**。

**本文档定义左侧各项**（四个提升关系）。一致性定理使用这些定义；它不定义它们。这确保了非循环性。

---

## 10. FCP 接受准则

依 D9 决策（RFC-0002 §23），进入 FCP 前必须完成以下事项：

### 10.1 必需交付物

- [x] 对所有四个投影定义可观测状态空间 $\mathcal{S}_i / {\equiv_i}$
- [x] 指定可观测标签集 $\mathcal{L}_i^{\mathrm{obs}}$ 及隐藏步策略
- [x] 形式化可观测转移关系 $\xrightarrow{}_i^{\mathrm{obs}}$
- [x] 从 $(C,R)$ 到各可观测 LTS 的提升关系 $\operatorname{Lift}_i$
- [x] 非循环性证明（§8）
- [x] 粒度比较表（§7）

### 10.2 与证明义务的集成

**P1a (DAG ↔ Petri)**：使用 §3-4 的 DAG 与 Petri 可观测 LTS 定义

**P1b (Petri ↔ π)**：使用 §4-5 的 Petri 与 π 可观测 LTS 定义

**P1c (π ↔ 态射)**：使用 §5-6 的 π 与态射可观测 LTS 定义，包括依 D7-A 的多状态协议

**终态观测一致性**（RFC-0002 第 4 条）：使用各投影的可观测卡住状态，结合 `success-predicates-interface.md`（D10）的成功谓词

### 10.3 开放工作

**Lean 形式化**：将可观测 LTS 定义与提升关系机械化（更广泛 P1 形式化的一部分）

**参考见证**：为 P1c 获准操作实例化可观测 trace（60×60 矩阵）

**独立评审**：进程语义评审人必须验证可观测语义定义（治理缺口）

---

## 11. 相关规范

- **`formal-semantics.md`**：定义 $(C,R)$ 源语义（本文档从其提升）
- **`success-predicates-interface.md`**：定义终态成功谓词（使用本文档的可观测卡住状态）
- **RFC-0002**：陈述一致性定理（使用本文档定义的提升关系）
- **ADR-0001 D7-A**：用于 P1c 反射的多状态 π 协议
- **ADR-0001 D4**：π 投影的分离元数据层
- **ADR-0001 D8**：Petri 投影的个体 token 来源

---

## 12. 总结

本规范通过提供以下内容履行 D9 强制性 FCP 门：

1. **四个独立的可观测 LTS 定义**，立足于目标形式体系（DAG、Petri、π、态射理论）
2. **显式粒度策略**，按投影区分可观测步与行政步
3. **从 $(C,R)$ 到各可观测语义的提升关系**
4. **非循环性证明**，确保每个投影的语义自包含

这些定义使 RFC-0002 四投影一致性定理能够有意义地陈述并证明。一致性定理使用这些可观测语义；它不定义它们。

**状态**：参考证明已实现并绑定当前 QA 证据；规范性策略仍需独立进程语义评审与 FCP 处置。
$$
