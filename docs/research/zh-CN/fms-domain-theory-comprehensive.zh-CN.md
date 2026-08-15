# FMS 领域理论——综合参考

**状态：** 合并的背景参考；当前证明状态见 0021–0027
**日期：** 2026-07-27（合并 2026-07-26 的研究）
**风险：** S2 / **质量：** QA-L4 目标 / **成熟度：** Pre-FCP M1
**Owner/DRI：** Joker-of-Gotham
**治理：** RFC-0002（Pre-FCP）、ADR-0001（Proposed）

> **阅读规则（2026-07-28）：** 本文档合并了 2026-07-26 完成的来源、依赖与构造
> 路线研究。其"当前状态"与"开放问题"章节是标注日期的快照，而非
> 控驭性实现状态。如需被接受的最大相容边界与不可变证明结果，
> 请阅读记录 0021–0027、QA-L4 包与理论交付。以下列出的六个来源日志
> 在其持久内容被合并至此后已移除。

**合并范围：** 已退役研究日志 0007、0009–0012 与 0014（依赖
审计、来源定理范围、构造路线、Open-π/common-FMS 接缝、
分离交换性与 bottom/zero 范围）。

---

## 执行摘要

本文档将六份 FMS 领域理论研究日志合并为 Cantilune 形式语义基础的单一综合参考。研究确立：

1. **来源对齐：** FMS 构造有来源支撑但需要本地实现；不存在完整的外部 Lean 依赖。
2. **构造路线：** Abramsky powerdomain 必须通过 enriched free-algebra 伴随为一个组合的非确定性计算理论来构建。
3. **语义分叉：** 分离的 divergence/deadlock 常量不能与对两个常量皆严格的对称全对配对共存——需要一项 RFC 决策。
4. **当前内核状态：** 全源普通解集、enriched 伴随与顺序 Fubini 已内核构建；针对分离常量的对称交换 Fubini 仍被一个根本不相容性阻塞。

**决策边界：** RFC-0002 必须在以下之间选择：(1) 非分离交换 FMS，(2) 分离有序/非交换效应，或 (3) 支撑分离张量加新语义定理。

---

## 1. 来源对齐

### 1.1 一手来源（来自 0009）

语义基础取自：

1. **Fiore、Moggi 与 Sangiorgi** — [_A Fully Abstract Model for the π-calculus_, LICS 1996](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf) 与[期刊版本](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf)
2. **Abramsky** — _A Domain Equation for Bisimulation_, Information and Computation 92(2), 1991
3. **Abramsky & Jung** — [_Domain Theory_ 手册章节](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

### 1.2 来源支撑的定理矩阵（来自 0009）

| 主题        | 来源陈述                                                              | Cantilune 接口                                         | 当前状态                                   |
| ----------- | --------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------ |
| 基范畴      | `Cpo`：带 omega 链上界的偏序集、连续映射；基对象可无底                | `ωCPO`、`ContinuousHom`                                | **基础存在**                               |
| 非确定性    | `ND(Cpo)` 对象带最小 `⊥`、半格单位 `0`、幂等选择；箭射为严格半格同态  | `NondeterministicComputation`、`CpoPowerdomainPackage` | 仅接口                                     |
| Powerdomain | 遗忘函子有 `Cpo`-enriched 左伴随，诱导 Abramsky 交换 powerdomain 单子 | `CpoPowerdomainPackage` 及相干记录                     | **普通伴随已内核构建**；对称 Fubini 被阻塞 |
| 函子世界    | 逐点提升至 `Cpo^I`                                                    | `FMSPointwiseCpoMonad`                                 | 以基 powerdomain 为条件                    |
| 域方程      | `A = μX.P(HX)` 初始解                                                 | `AgentDomainSolution`                                  | 仅接口；无递归解                           |
| 分配/限制   | 名字分配、动作定义的限制及相干性                                      | `CoherentHiding`、`AdequateHiding`                     | 接口与片段；无 FMS 居留项                  |
| 全抽象      | 指称相等 ⟺ 强迟双模拟（定理 3.2、3.3）                                | `StrongLateFullAbstraction`                            | 仅定理字段                                 |

### 1.3 来源范围澄清（来自 0009）

**FMS 所要求的：**

- 初始解 `A = μX.P(HX)`，使用"标准递归域方程技术"
- 进程对全抽象：两个进程双模拟 ⟺ 其指称相等
- powerdomain 的交换单子律

**FMS 不要求的（Cantilune 附加条件）：**

- 源中显式陈述的 `⊥ ≠ 0`（Cantilune 附加此项）
- 一般"代数紧致性"作为具名定理（构造方法灵活性存在）
- 全域元素可定义性（源证明进程对等价，而非穷尽可定义性）
- 精确的每标号原生步可靠性/完备性（Cantilune 强化）
- `PowerdomainObservation` 逆像律（Cantilune 强化）

---

## 2. 依赖全景

### 2.1 钉定的本地基线（来自 0007）

**当前基础：**

- Lean：`leanprover/lean4:v4.32.0`
- mathlib：commit `81a5d257c8e410db227a6665ed08f64fea08e997`（v4.32.0）
- 许可证：Apache-2.0

**Mathlib 提供：**

- `OmegaCompletePartialOrder`、`ωScottContinuous`、`ContinuousHom`
- 范畴 `ωCPO`，带积、等子、普通极限
- 合法不动点基础

**Mathlib 不提供：**

- Abramsky/Plotkin/Hoare/Smyth powerdomain
- Egli–Milner 序
- 域论双极限或一般自函子的代数紧致性
- FMS 域方程或 π 演算全抽象

### 2.2 外部候选评估（来自 0007）

| 候选                          | 版本              | 声明                                       | Cantilune 状态       | FMS 覆盖                               |
| ----------------------------- | ----------------- | ------------------------------------------ | -------------------- | -------------------------------------- |
| **已钉定的 mathlib**          | Lean 4.32.0       | omega-CPO、连续映射、极限                  | **已导入**           | 仅基础                                 |
| **iris-lean**                 | v4.32.0           | `COFE`、`COFESolver.Fix`、步索引等价       | 版本兼容；导入未验证 | 不同语义（guarded/步索引，非 FMS CPO） |
| **scott1972**                 | Lean 4.30.0       | 逆极限、`theorem_4_4` for `D∞ ≅ [D∞ → D∞]` | 仅条件性来源移植     | 对一个逆极限构造有用；不通用           |
| **zilberstein/domain-theory** | Lean 4.31.0       | DCPO、Scott 连续性、way-below/紧致性       | 条件性移植           | 仅基本 DCPO；无 powerdomain            |
| **jonsterling/lean4-sgdt**    | Lean nightly 2021 | Guarded synthetic domain theory（公理化）  | 不可采纳             | 错误语义、无许可证、公理               |

### 2.3 依赖决策（来自 0007）

**未找到外部 FMS 包。** 最低可信依赖仍为已钉定的 mathlib。部分 Scott 逆极限证明可从 `scott1972` 移植，但这是来源移植工作，而非一个能闭合 FMS 栈的导入。

**iris-lean** 有一个真正的 COFE 不动点求解器，但用 guarded 步索引 OFE 语义替换 FMS CPO 语义需要 RFC 架构变更。

---

## 3. 构造路线

### 3.1 非分离 Omega-Scott 路线（来自 0010、0014）

**状态：** 普通伴随与顺序 Fubini 已内核构建；递归域不动点已实现。

#### 3.1.1 已完成步骤（来自 0010 §2026-07-26 更正、0014 §2026-07-27 精化）

**A. NDωCPO 范畴 — 已实现**

`FMSCpoNondeterministicCategory` 定义对象为：

- `carrier : ωCPO`
- `divergence : carrier`（最小元素）
- `deadlock : carrier`
- 连续 `choice : carrier × carrier →𝒄 carrier`
- 结合性、交换性、幂等性、`deadlock` 单位

态射：保持全部三个常量的连续映射。

`FMSCpoNondeterministicEnrichment` 证明 hom 集是 omega-CPO 且复合为联合连续。

`FMSCpoNondeterministicNullary` 构造初始二点代数（在空生成元上自由）。

**B. 完备性与极限保持 — 已实现**

`FMSCpoNondeterministicLimits` 构造逐分量积与等子，导出 `HasLimits.{0} NDωCPO`，并证明载函子 `U : NDωCPO ⥤ ωCPO` 保持极限。

**C. 全源解集 — 已实现（来自 0012）**

`FMSCpoNondeterministicGlobalSolutionSet` 对每个源 `X : ωCPO` 证明真正的 `SolutionSetCondition.{0}`，具有：

- 生成的 omega 闭子代数分解
- 良基语法用于基数界
- 小呈现重新索引至固定 `Type 0`

这不再是调用者前提或空源特殊情形。

**D. 普通伴随与单子 — 已实现**

从解集：

- `freeAdjunctionOfSolutionSet` 构造 `F ⊣ U`
- `ordinaryMonadOfSolutionSet` 导出 `ωCPO` 上的单子
- `ordinaryFreeLift` 提供自由扩展泛性质

**E. 顺序 Fubini — 已实现（来自 0012）**

典范顺序 Fubini 映射：

- 联合连续
- 满足 pure-unit 律
- 在第一参数中保持 divergence、deadlock、choice
- **非对称**（见 §3.2）

**F. 递归域不动点 — 已实现（来自 0010 §2026-07-27）**

`FMSCpoConcreteBilimitExhaustivity` 证明：

- 有限阶段逼近元的单调性
- 恒等的逐点 omega 穷尽
- 展开单调性

这无条件居留 `ConcreteBilimitExhaustivity` 并构造 `concreteActualFixedPointWitness`：**非分离 omega-Scott** 函子的一个连续自然同构 `A ≅ P(H A)`。

**这是一个不动点，不是初始代数/终余代数或代数紧致性。**

**G. 单子 hiding — 已实现（来自 0010 §2026-07-27、0014 §2026-07-27）**

非分离 omega-Scott world 单子现有 `powerHiding`，具有：

- 分配/hiding、unit、乘法、所选 Fubini 交换
- 支撑指称中的有效 allocate/denote/hide 收缩

这是真正的单子 hiding 相干，但不是 agent 限制（无递归 agent、`AgentDomainSolution.res`、操作指称、充分性、可定义性或全抽象）。

#### 3.1.2 非分离路线缺失项

- 代数紧致性或初始/终泛性质
- 带 `⊥ ≠ 0` 的分离 Abramsky powerdomain
- 带操作充分性的递归 agent
- 进程域可定义性
- 全抽象

### 3.2 分离 Powerdomain 路线 — 被阻塞

**状态：** 发现根本不相容性。

#### 3.2.1 不相容性（来自 0012、0014）

`no_commutative_first_strict_pairing`（一般代数定理）证明：

> 若一个配对：
>
> 1. 在每对上可用
> 2. 对称
> 3. 在第一参数处对序 bottom 严格
> 4. 在第一参数处保持半格零
>
> 则 bottom = zero。

当前 Cantilune 组合无法完成：

- `divergence_ne_empty`（内核证明的分离）
- 自由扩展对两个常量的严格保持
- 典范交换 Fubini

**在 `(divergence, deadlock)` 处的 swap 交换性将识别二者，与分离矛盾。**

#### 3.2.2 来源调和（来自 0012、0014）

FMS 源陈述：

- 交换单子 interchange 律
- 吸收律 `let(f, 0) = 0`
- 箭射为严格半格同态
- **源不陈述 `⊥ ≠ 0`** — 这是 Cantilune 的附加条件

**结论：** 本地规约冲突，而非 FMS 反驳。普通自由伴随是有效的；失败的是将分离加到典范交换顺序化上。

#### 3.2.3 范围精化（来自 0014）

`FMSCpoFiniteSupportStrictConstantsNoGo` 证明该障碍延伸至支撑 omega-CPO：空支撑常量在分离单位支撑处复合，而一个连续对称 first-strict 配对将它们坍缩。

**对于所述的相容性、交换、严格性与区分性组合，这是表示无关的。**

### 3.3 精确构造序列（来自 0010）

对任何完整路线：

**A.** Bundle 代数范畴 — **完成**
**B.** 证明完备性与极限保持 — **完成**
**C.** 证明解集条件 — **完成**
**D.** 应用一般伴随函子定理 — **完成（普通）**
**E.** 恢复代数律 — **部分**（divergence ≠ deadlock 来自 nullary 初始对象）
**F.** 证明 enriched 交换性 — **被阻塞**（对称 Fubini 对分离常量失败）
**G.** 逐点提升并求解域方程 — **部分**（非分离不动点存在；分离初始解缺失）

### 3.4 被否决的捷径（来自 0010）

- `WithBot (OmegaScottPower X)` — 乘法 unit/序障碍
- `WithBot (LowerSet X)` — principal 返回与严格扁平化在一般 omega 极限上失败
- 单独的 SFP `P₀` 表示 — 有用的受限构造，非全 `ωCPO` 伴随
- 将左伴随、不动点、充分性或全抽象假定为字段的结构 — 接受边界，非实现
- 调用者提供存在性证明的 `Classical.choice` — 缺失定理仍为前提

### 3.5 退出标准（来自 0010）

理论闭包要求以下全部经内核检查：

1. 居留的 `NDωCPO` 范畴与载函子 — ✓ **已内核构建**
2. 完备性、极限保持、全源解集 — ✓ **已内核构建**
3. 普通与 enriched 左伴随及单子 — ✓ **已内核构建（普通）**
4. 每个所需基 powerdomain 相干记录的居留项 — ✗ **对称 Fubini 被阻塞**
5. divergence ≠ deadlock 的证明 — ✓ **已内核构建（nullary 初始）**
6. 到非常量 world 模型的逐点提升 — ✓ **已内核构建（非分离）**
7. 无 `sorry`、`admit`、`axiom` 或未记录导入 — ✓ **已完成部分已验证**

---

## 4. 开放问题

### 4.1 具名 Open-Pi SMC 总性（来自 0011）

#### 4.1.1 具体名表示 no-go（不可行）

`OpenSMCTotalNamedBoundary` 证明：

- `no_totalOccurrenceTensor_of_nonempty`：当非空边界存在时，不存在能在置换下保持所有具体端口出现并返回有效 `NamedInterface` 的全张量（自张量复制具体名，违反 `Nodup`）
- `no_totalExactNamePlug_of_nonempty`：exact-name `PlugCertificate` 在非空 identity 上不能为全

**这是一个表示 no-go（不可行），不是范畴 no-go（不可行）。**

#### 4.1.2 已内核构建的（来自 0011）

- `SortedFreshBoundarySupply.tensorObject_sorts`：带显式新鲜供给，全对象级张量存在且具有预期排序形状
- `hideMany_native`、`plugHide_syncLeft_native` 等：真正的单步原生 late-pi 迁移经有限限制保持
- 动作标号 alpha 商：`OpenSMCActionAlpha` 按新鲜性安全的 binder 重命名对输入/bound-output 标号作商，带原生传输

#### 4.1.3 全 Open-Pi SMC 缺失项（来自 0011）

未来构造必须添加：

1. 每个排序的无限新鲜名供给
2. 相干的保排序公共边界重命名
3. 针对非空 identity 的极化线性 alias/wire 进程
4. 原始进程、alpha 类、动作、迁移沿公共重命名的传输
5. 独立于新鲜代表的复合与张量
6. 所选商中的范畴、interchange、五边形、三角形、六边形律
7. plug、hide、限制、通信、bound-output 的操作充分性/反射

**这需要按 RFC-0002 停止条件的 RFC/ADR 决策。**

### 4.2 Common-FMS 双行跨 Epoch 链（来自 0011）

#### 4.2.1 已证明的

`FMSCommonTwoRowCrossEpochChain` 构造：

- 非擦除双行跨 epoch 链，带四条精确原生 FMS 边（两次准入、两次规则）
- 精确指称路径：`admission₁ ; rule₁ ; admission₂ ; rule₂`
- 将操作链耦合到事件标号随机轨迹
- `canonical_marked_replay_positioned_fms_actions_almost_sure`：在 `FourPositionFMSActionAgreement` 下，典范重放中的每个标记与同一位置处的 FMS 动作识别

#### 4.2.2 所要求的（来自 0011）

该定理刻意要求：

- 具体的 `ExactFMSAcceptancePackage`
- 两条完整的产品行
- 相邻操作源端点相等
- 指称端点相等
- 事件/动作同一性的显式位置动作解释

**无一者从包名或证明无关性中导出。**

#### 4.2.3 未构造的（来自 0011）

- 全 omega-CPO powerdomain
- 递归 FMS 域
- 八个生产包证书
- 生产 kernel 的 `TrajectoryAgreement`
- 真实规则清单、rank、pre-net、授权、公平性、稳定窗口、正-epsilon 事实

### 4.3 递归 Agent Alpha 替换（来自 0010 §2026-07-27）

`LateGuardedReplicationAlphaSubstitutionCongruence` 证明：

- `recv`、`new`、`repRecv` 的 common-fresh 归一化
- 组合的深度/alpha 归纳
- 无条件居留 `RecursiveAlpha.SubstitutionCongruent`
- 每个递归 native-step 构造子在 alpha 相关目标上置换等变

**这是真正的一步 alpha 同余，但不是：**

- 递归 agent 域解
- 操作充分性
- 全抽象

### 4.4 操作 Divergence 与 Deadlock（来自 0014）

`LateGuardedReplicationDivergence` 分别证明：

- 复制的 tau 有真正的无限原生运行
- 原始零为死锁

**此操作区分不证明这些进程指称 powerdomain 的两个区分常量。** 该指称映射需要缺失的递归 agent、hiding 与充分性。

---

## 5. RFC 决策点

### 5.1 核心语义分叉（来自 0012、0014）

RFC-0002 与 ADR-0001 必须选择一条相干路线：

#### 选项 1：非分离交换 FMS（来源对齐）

- 保留交换 powerdomain 律
- 不要求 `⊥ ≠ 0` 的效应层证明
- 通过递归 agent 与源钉定全抽象定理证明进程层区分
- **状态：** 普通伴随与顺序操作已内核构建；缺对称 Fubini 与分离常量

#### 选项 2：分离有序/非交换效应

- 保留分离常量 `⊥ ≠ 0`
- 使用其顺序化记录求值顺序的有序/非交换效应
- 接受效应复合不交换
- **状态：** 需要新语义定理；当前顺序 Fubini 非对称

#### 选项 3：支撑分离张量

- 变更代数/态射范畴
- 用支撑分离张量替换全对笛卡尔配对
- 证明新的支撑索引语义定理
- **状态：** 实验性片段存在（有限支撑分离代数、nominal 分配）；无完整构造

**关键：** 支撑分离张量是可能的已变更语义，不是自动逃生。若两个常量皆有空支撑，它们是相容的，且双常量交换论证仍在该对上适用（在 `FMSCpoFiniteSupportStrictConstantsNoGo` 中证明）。

### 5.2 Open-Pi SMC 表示（来自 0011）

需要 RFC 决策在全 Open-Pi SMC 之间选择：

1. guarded 复制/递归（跨越 RFC 停止条件）
2. 带已证明操作商的独立 wire 语义
3. 刻意线性单次接口
4. 显式新鲜供给 + 重命名传输（规范性语法变更）

**当前状态：** alpha 转换已闭合；全张量表示与完整范畴相干缺失。

### 5.3 依赖准入策略（来自 0007）

若使用 `scott1972`：

- 钉定至确切已审计 commit `36bf01f99f00fcb78b999052212372ba026521ba`
- 要么：移植上游至 Lean/mathlib 4.32 并发布，要么以 RFC 决策 vendor
- 移植验收测试必须：在 Cantilune 中构建、枚举内核假设、将定理映射到 FMS 义务、复现许可证/修订

**停止条件（来自 0007）：**

- 将 `ωCPO.HasLimits` 视为代数紧致性
- 将 `scott1972.theorem_4_4` 视为 `A ≅ P(H A)` 的解
- 将 `iris-lean` OFE 等价视为 `Cpo^I` 中的连续自然同构
- 将离散 CPO 上的有限幂集称为 Abramsky powerdomain
- 从 fold/unfold、可靠性或有限片段单独声明全抽象

### 5.4 FMS 演算范围（来自 0009）

FMS 源包含 guarded 复制 `!α.P`。Cantilune 的有限控制 `Raw.Proc` 刻意排除复制/递归。

**需要决策：**

- 当前有限控制定理是有效片段，不是任意进程 FMS 定理 3.3 的实现
- 添加完整 FMS 复制/递归跨越 RFC 停止条件
- 需要显式范围决策，而非隐藏的证明假设

---

## 6. 当前内核状态总结

### 6.1 已内核构建的

**基础（来自 0007、0010）：**

- 来自 mathlib 的 `ωCPO` 范畴，带积、等子、极限
- `NDωCPO` 非确定性计算范畴
- 逐分量极限与保持
- Enriched hom-对象 omega-CPO 及联合连续复合
- Nullary 初始二点代数

**自由构造（来自 0010、0012）：**

- 全源 `SolutionSetCondition.{0}`，带真正的小呈现
- 普通自由/遗忘伴随 `F ⊣ U`
- 诱导单子，带 unit、乘法、泛 `freeLift`
- Enriched hom 等价，带连续性与自然性
- 典范顺序 Fubini（连续、pure-unit 相干、第一参数严格）

**递归域（来自 0010 §2026-07-27）：**

- 非分离 omega-Scott 函子的具体双极限穷尽性
- 连续自然同构 `A ≅ P(H A)`（不动点，非初始代数）
- 单子 `powerHiding`，带分配、unit、乘法、所选 Fubini 相干
- 支撑模型中的有效 allocate/denote/hide 收缩

**Alpha 与替换（来自 0010 §2026-07-27）：**

- 动作标号 alpha 商，带原生传输
- `recv`、`new`、`repRecv` 的递归 alpha 替换同余
- 组合的深度/alpha 归纳
- `RecursiveAlpha.SubstitutionCongruent` 已居留

**Open-Pi 片段（来自 0011）：**

- 具体名表示 no-go（不可行）定理
- 带显式新鲜供给的对象级张量
- 经有限 hiding 保持的原生迁移
- Plug/hide sync/close 原生引理

**跨 Epoch 组合（来自 0011）：**

- 双行 common-FMS 跨 epoch 链（以所供包与行为条件）
- 四事件精确原生路径，带指称接缝
- 带位置动作协议的典范标记重放

### 6.2 缺失的

**基 Powerdomain：**

- 针对分离常量的对称交换 Fubini（被不相容性阻塞）
- 带全部相干记录的完整 `CpoPowerdomainPackage`
- 带 `⊥ ≠ 0` 的分离 Abramsky 构造

**递归域：**

- 初始代数 / 终余代数泛性质
- 一般局部连续自函子的代数紧致性
- 带操作语义的递归 agent

**操作语义：**

- Agent 级限制（`AgentDomainSolution.res`）
- 递归 agent 的操作指称
- 充分性（语法可靠性/完备性）
- 进程域可定义性
- 全抽象（定理 3.2、3.3）

**Open-Pi SMC：**

- 态射上的全张量，带完整范畴相干
- 恒等 wire 与结构商
- 全 SMC 的操作 plug/hide 充分性

**生产包：**

- 八个计划包的真实规则清单
- Rank、声明顺序 pre-net
- 资源/会话策略、授权
- 公平性、稳定窗口、正-epsilon 事实

### 6.3 治理处置

- RFC-0002：**Pre-FCP**（被语义分叉阻塞）
- ADR-0001：**Proposed**（被缺失构造阻塞）
- QA-L4 评审：**未记录**（仅可变树证据）
- 证明清单：**`implemented_unverified`** 或 **`partial_scaffold`**
- Stop-Ship 条件：**未发现**

**不要在当前结果上晋级 CENTRAL-12、进入 FCP 或接受 ADR-0001。**

---

## 7. 参考文献

### 7.1 一手来源

1. Fiore, M., Moggi, E., & Sangiorgi, D. (1996). [A Fully-Abstract Model for the π-calculus](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf). LICS 1996.
2. Fiore, M., Moggi, E., & Sangiorgi, D. (2002). A fully abstract model for the π-calculus. _Information and Computation_, 179(1). [Author manuscript](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf).
3. Abramsky, S. (1991). A Domain Equation for Bisimulation. _Information and Computation_, 92(2). [Author PostScript](https://www.cs.ox.ac.uk/people/samson.abramsky/bisim.ps.gz).
4. Abramsky, S., & Jung, A. [Domain Theory](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf). Handbook chapter.
5. Abramsky, S. [Domain Theory and the Logic of Observable Properties](https://www.cs.ox.ac.uk/people/samson.abramsky/thesis.pdf). PhD thesis, Chapter 5 §3.

### 7.2 外部候选

- **mathlib4：** [commit 81a5d257](https://github.com/leanprover-community/mathlib4/tree/81a5d257c8e410db227a6665ed08f64fea08e997)、[omega-CPO 文档](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Category/OmegaCompletePartialOrder.html)
- **iris-lean：** [v4.32.0 release](https://github.com/leanprover-community/iris-lean/tree/v4.32.0)、[COFESolver.lean](https://github.com/leanprover-community/iris-lean/blob/v4.32.0/Iris/Iris/Algebra/COFESolver.lean)
- **scott1972：** [commit 36bf01f9](https://github.com/catskillsresearch/scott1972/tree/36bf01f99f00fcb78b999052212372ba026521ba)
- **Reservoir：** [Lean 包索引](https://reservoir.lean-lang.org/packages)

### 7.3 关键 Lean 模块

- `Cantilune.Pi.FMSCpoNondeterministicCategory`
- `Cantilune.Pi.FMSCpoNondeterministicLimits`
- `Cantilune.Pi.FMSCpoNondeterministicEnrichment`
- `Cantilune.Pi.FMSCpoNondeterministicNullary`
- `Cantilune.Pi.FMSCpoNondeterministicSolutionSet`
- `Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet`
- `Cantilune.Pi.FMSCpoConcreteBilimitExhaustivity`
- `Cantilune.Pi.FMSCpoPowerdomainPackageCoherenceNoGo`
- `Cantilune.Pi.OpenSMCTotalNamedBoundary`
- `Cantilune.Pi.OpenSMCActionAlpha`
- `Cantilune.Theorems.FMSCommonTwoRowCrossEpochChain`

---

**综合参考结束**
