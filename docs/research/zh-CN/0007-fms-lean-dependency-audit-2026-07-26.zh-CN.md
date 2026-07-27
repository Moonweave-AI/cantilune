# 完整 FMS 模型的 Lean 依赖审计

Status: dependency research log; no dependency admitted  
Date: 2026-07-26  
Owner/DRI: Joker-of-Gotham / project DRI  
Risk / quality / maturity: S2 / QA-L4 target / Pre-FCP-M1  
Decision authority: RFC-0002 and ADR-0001; this log grants no approval

## 决策

本次审计未发现任何公开索引的 Lean 4 包能够提供完整的
Fiore--Moggi--Sangiorgi (FMS) 依赖栈：

1. 所需 CPO 范畴上的 Abramsky/自由非确定性 powerdomain；
2. 适用于 `Cpo^I` 中 `A ≅ P (H A)` 的域方程定理；
3. 具备所需协同的连续、世界自然（world-natural）分配与隐藏；以及
4. 强 late pi 互模拟的操作充分性与完全抽象。

因此，最低可信的**直接依赖**仍然是仓库已锁定的 mathlib 修订版。部分 Scott 逆极限证明可以从 `catskillsresearch/scott1972` 移植，但这是一个源码移植项目，并非能闭合 FMS 定理包的导入。`iris-lean` 在 Lean 4.32 上可机械使用，并具备真正的 COFE 不动点求解器，但将 FMS 的 CPO 语义替换为受守护的、步进索引的 OFE 语义将是一项架构变更，需要新的 RFC 决策。它不是当前 FMS 声明的实现捷径。

因此 `CompleteExternalFMSTheoremPackage` 必须保持无居民，所有关于完全隐藏、FMS 域方程已解或完全抽象的声明都必须保持被阻断/未验证状态。

## 问题与验收标准

本次审计询问的是能够证明仓库预期完整 FMS 实例的最低可机械导入 Lean 4 依赖。仅当满足以下条件时，候选才算可直接可导入：

- 存在确切的修订版或发布版、许可证、Lean 版本及依赖版本；
- 相关声明存在于源码中，而不仅在 README 中；
- 该包能以不静默替换语义范畴的方式面向锁定的 Lean 4.32 线；以及
- 其定理能解除一项已识别的 FMS 义务。

这是一次只读源码审计。没有安装任何候选包，也没有针对 Cantilune 构建任何候选包。因此下文的兼容性陈述将区分上游构建证据与未验证的 Cantilune 集成。

## 锁定的本地基线

当前形式化项目锁定：

- Lean `leanprover/lean4:v4.32.0`；
- mathlib commit
  `81a5d257c8e410db227a6665ed08f64fea08e997`，请求为 `v4.32.0`；以及
- mathlib 的 Apache-2.0 许可证。

在该确切源码修订版下，mathlib 提供了以下基础（及其他）内容：

- `OmegaCompletePartialOrder`, `ωScottContinuous`, `ContinuousHom`；
- 依值函数与积的 omega-CPO 实例；
- 具体范畴 `ωCPO`、积、等化子与一般极限；
- 带底元的完备偏序；
- 部分计算的合法不动点事实；以及
- 序理想，包括在合适半格假设下的完备格实例。

该确切的代码树不包含以下声明：Abramsky、Plotkin、Hoare 或 Smyth 的 powerdomain；Egli--Milner 序；域论双极限或代数紧性；FMS 域方程；或 pi 演算完全抽象。mathlib 中名为 `IsBilimit` 的声明涉及加法范畴中的双积图，而非此处所需的嵌入--投影链双极限。

主要链接：

- [exact mathlib tree](https://github.com/leanprover-community/mathlib4/tree/81a5d257c8e410db227a6665ed08f64fea08e997)
- [omega-CPO category documentation](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Category/OmegaCompletePartialOrder.html)
- [Scott continuity documentation](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/ScottContinuity.html)
- [lawful fixed-point documentation](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Control/LawfulFix.html)

## 可导入性与定理覆盖矩阵

| 候选 | 版本 / 许可证证据 | 实际相关声明 | 对 Cantilune 的机械状态 | FMS 覆盖 |
|---|---|---|---|---|
| 锁定的 mathlib | Lean 4.32.0；上述确切 commit；Apache-2.0 | omega-CPO、连续映射、积、等化子、极限、合法不动点基础 | **已导入** | 仅基础；无 powerdomain、通用域求解器、FMS 语义或完全抽象 |
| [`leanprover-community/iris-lean`](https://github.com/leanprover-community/iris-lean) | 发布 `v4.32.0`，commit `3e2b759dd3e928f4a31535afd07ea571325f0b8a`；Lean/Qq/Batteries 4.32.0；Apache-2.0 | `OFE`, `COFE`，非扩张/收缩映射；`COFESolver.Fix`；针对局部收缩 OFunctor 的 `Fix.fold_unfold` 与 `Fix.unfold_fold` | **原则上版本兼容；Cantilune 导入未验证** | 不建模 FMS 无底元 CPO 范畴或 powerdomain。其受守护、步进索引的等价不是所需的连续自然同构。若无 RFC 级别的语义变更则不构成 FMS 依赖 |
| [`catskillsresearch/scott1972`](https://github.com/catskillsresearch/scott1972) | commit `36bf01f99f00fcb78b999052212372ba026521ba`；Lean/mathlib 4.30.0；Apache-2.0；无发布/包 | 连续格投影系统的逆极限；`proposition_4_1`；`inverseLimit_eq_iSup`；`corollary_4_3`；特定函数空间塔；`theorem_4_4` 与 `theorem_4_4_orderIso` 给出 Scott 映射同构 `D∞ ≅ [D∞ → D∞]` | **仅条件性源码移植**。上游 CI 在其自身 4.30 锁文件上于该确切 commit 成功；未运行 4.32/Cantilune 构建 | 对一种逆极限构造有用。它既不是局部连续混合方差自函子的通用代数紧性，也不是 `A ≅ P(H A)` 的解 |
| [`catskillsresearch/scott_models`](https://github.com/catskillsresearch/scott_models) | Lean/mathlib 4.30.0；Apache-2.0；无发布/包 | 作者各 Scott 形式化包之间的等价 | **非独立依赖**：其 lakefile 对 `scott1972`、`scott1980`、`scott1982` 使用兄弟路径依赖 | 未发现 powerdomain 或 FMS pi 模型；不闭合缺失的链条 |
| [`zilberstein/domain-theory`](https://github.com/zilberstein/domain-theory) | commit `7f3b7547510931118ffe22631410fcd5f4556360`；Lean/mathlib 4.31.0；Apache-2.0；无发布/包 | `DCPO`、有向集 Scott 连续性、函数空间、way-below/紧性，以及 Markowsky 链完备/DCPO 桥接 | **条件性移植，在锁定版本上不直接可用** | 仅基础 DCPO；无 powerdomain、Egli--Milner 构造或域方程求解器 |
| [`jonsterling/lean4-sgdt`](https://github.com/jonsterling/lean4-sgdt) | Lean nightly `2021-05-28`；未发现仓库许可证 | 受守护的合成域论原语，许多被声明为公理；观察到至少一处源码 `sorry` | **不可接纳/不可导入** | 不同的受守护语义，且不满足仓库的证明与许可证关卡 |
| [`joewatt95/DomainTheory`](https://github.com/joewatt95/DomainTheory) | Lean 4.17.0；未发现仓库许可证；源码树很小 | 针对现有 mathlib 概念的不动点比较与 Kleene 不动点定理 | **不可接纳/不可导入** | 无 powerdomain 或域方程构造 |
| 本审计中定位到的公开 pi 演算 Lean 代码 | 未发现已发布的 FMS 包 | 小型操作语法/互模拟开发，包括一个非官方 `cslib` 分支 | **非完整依赖** | 未发现任何将 late pi 操作语义连接到 FMS 指称或证明完全抽象的实现 |

2026-07-26 对 `scott1972` 源码搜索 `sorry`、`admit`、`axiom` 与 `unsafe` 在已索引 Lean 文件中返回零结果。两个直接相关的文件也被检查，且不含上述任何标记。这是关于已检查源码的证据，不能替代移植后在 Cantilune 侧进行的内核假设审计。

## 精确定理证据

### `scott1972`

当前拆分仓库处于活跃状态而非归档。在 commit `36bf01f99f00fcb78b999052212372ba026521ba` 处，其上游 GitHub Actions 构建在 Lean/mathlib 4.30.0 下成功完成。

[`InverseLimits.lean`](https://github.com/catskillsresearch/scott1972/blob/36bf01f99f00fcb78b999052212372ba026521ba/Scott1972/ContinuousLattice/InverseLimits.lean)
构造了连续格投影的可数系统的逆极限，并证明了连续投影/嵌入事实、有向逼近恒等式 `inverseLimit_eq_iSup`，以及余锥通用性质 `corollary_4_3`。

[`FunctionSpaceTower.lean`](https://github.com/catskillsresearch/scott1972/blob/36bf01f99f00fcb78b999052212372ba026521ba/Scott1972/ContinuousLattice/FunctionSpaceTower.lean)
构造了一个特定的函数空间塔。其 `theorem_4_4` 证明了两条 Scott 映射逆方程，`theorem_4_4_orderIso` 将所得同构打包为序同构。

这些是实质性的证明，但其结论是一个特定的自反域。FMS 需要的是不同方程的初始解，该方程的自函子包含非确定性 powerdomain、名字索引的续延、分配偏移以及世界动作。此处检查的任何定理都不会自动将 Scott 构造转化为该解。

### `iris-lean`

[`COFESolver.lean`](https://github.com/leanprover-community/iris-lean/blob/v4.32.0/Iris/Iris/Algebra/COFESolver.lean)
为局部收缩 OFunctor 定义了塔、`Fix`、`Fix.fold`、`Fix.unfold`，并证明了 `Fix.fold_unfold` 与 `Fix.unfold_fold` 在 OFE 等价下成立。本次审计中该文件不含 `sorry`、`admit`、`axiom` 或 `unsafe` 标记。

这是一个真实且当前有版本的固定点库。然而它并非关于 FMS 范畴的定理。具体而言：

- COFE 等价是步进索引的；它不是 FMS `Cpo^I` 中的相等或连续同构；
- 该求解器假设局部收缩性，而 FMS 构造使用的是丰富 CPO 的 powerdomain/域方程论证；
- 仓库中未发现 Abramsky powerdomain、Egli--Milner 序、FMS 世界函子或 late-pi 完全抽象定理。

仅当项目明确选择受守护的 Iris 风格语义并重述投影与完全抽象目标时，使用该包才是合理的。该选择不能证明当前所述的 FMS 义务。

## 否定搜索证据与局限

已通过认证的 GitHub 代码搜索对公开已索引 Lean 文件执行了标识符与短语变体搜索。在审计时：

- `powerdomain`、`Plotkin powerdomain`、`Smyth powerdomain`、`Hoare powerdomain`、`PowerDomain`、`EgliMilner` 与 `Egli-Milner` 未产生任何 Lean 代码结果；
- `algebraic compactness`、`AlgebraicallyCompact` 与 `recursive domain equations` 未产生相关 Lean 代码结果；
- `Fiore Moggi Sangiorgi`、`late bisimulation` 以及组合的 pi 演算/完全抽象短语未产生 FMS 形式化；以及
- 对 powerdomain、CPO/域论、pi 演算与 FMS 的 Reservoir 包元数据搜索未发现提供缺失栈的包。

搜索引擎的无结果并非证明私有、未索引或命名不同的代码不存在。因此本审计支持以下有界陈述：在这些查询变体与候选源码检查之后，未发现公开可索引、可识别、有版本的 Lean 包。

官方包索引：

- [Reservoir packages](https://reservoir.lean-lang.org/packages)

## 主要 FMS 义务

语义验收的源码锁定仍然是：

- M. Fiore, E. Moggi, and D. Sangiorgi, “A Fully Abstract Model for the
  Pi-Calculus,” *Information and Computation* 179(1), 2002,
  DOI [`10.1006/inco.2002.2968`](https://www.sciencedirect.com/science/article/pii/S0890540102929688);
  另见
  [作者托管的 LICS 论文](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).

该论文的域侧路线在 world-indexed CPO 设定下使用：

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X)
```

该论文的完全抽象定理还依赖于操作逼近、展开律、范式、失配、连续性以及 finite-to-domain 的嵌入/投影论证。仅靠折叠/展开等价（即便是内核检查的）不等同于完整定理。

## 最小可信依赖链

### 推荐的当前路线

1. 保持确切的 Lean 4.32/mathlib 锁定作为唯一被接纳的外部基础。
2. 定义 mathlib 缺失的 FMS 兼容 CPO/丰富层：所选的无底元 CPO 范畴、连续同态序、所需的积/余积/指数，以及逐点的函子范畴结构。
3. 构造带底元的自由连续半格/Abramsky 非确定性 powerdomain，及其丰富伴随、单子、严格半格通用性质与交换/Fubini 协同。
4. 证明足以覆盖确切局部连续函子 `P ∘ H` 的嵌入--投影链定理，或更一般的代数紧性定理。经审查的 `scott1972` 逆极限模块向 Lean 4.32 的移植可降低此步骤工作量，但不能替代步骤 2--3。
5. 将构造逐点提升至 `Cpo^I`；证明有限注入动作、分配 `δ`、名字对象、指数，以及全部四个 `H` 求和项的自然性。
6. 构造 `A`、其连续自然折叠/展开同构与范畴初始性；随后构造带偏投影的有限代理嵌入。
7. 定义充分的捕获避免隐藏/限制，并证明 alpha、代入、作用域外延、分配与世界变更协同。
8. 完成标准 strong-late 操作开发，包括失配、逼近、展开/范式引理、充分性，以及完全抽象的两个方向。
9. 证明 OpenPi 到无类型到 FMS 的交换结果，然后才可让 `CompleteExternalFMSTheoremPackage` 有居民。

### 可选的源端口决策

若使用 `scott1972`，该依赖必须锁定到确切被审计的 commit，并且要么：

- 上游移植到 Lean/mathlib 4.32 并发布适合作为 Lake git 依赖的版本；或
- 在明确的 RFC 决策与独立证明/假设审查下，作为经挑选、保留署名的模块内嵌。

移植验收测试必须在 Cantilune 中构建、枚举内核假设、将每条导入定理映射到一项 FMS 义务，并复现源许可证与修订版。在 Lean 4.30 上的上游 CI 并不构成该集成的证据。

## RFC 与 ADR 影响

RFC-0002 不能以完整 FMS 依赖已可用为由推进。该架构有三个诚实的选择：

1. **内部完成 FMS：** 保留当前语义，并资助缺失的 powerdomain、域方程、隐藏与完全抽象证明。
2. **经审查的 Scott 源码移植加内部完成：** 仅复用实际匹配某项义务的逆极限/函数空间材料；仍在内部构建 powerdomain 与 FMS 专属层。
3. **语义替换：** 采用受守护的 COFE/Iris 模型。这会改变目标范畴、相等/等价、不动点假设，以及投影/完全抽象定理的陈述，因此需要新的 RFC/ADR 决策而非一份实现说明。

以下为停止条件：

- 将 `ωCPO.HasLimits` 视为代数紧性；
- 将 `scott1972.theorem_4_4` 视为 `A ≅ P(H A)` 的解；
- 将 `iris-lean` 的 OFE 等价视为 `Cpo^I` 中的连续自然同构；
- 将离散 CPO 上的有限幂集称为所有所需 CPO 上的 Abramsky powerdomain；或
- 仅凭折叠/展开、操作可靠性或封闭的有限片段即宣告完全抽象。

在接纳任何依赖之前，QA-L4 必须独立审查确切的修订版与许可证出处、Lean 4.32 集成构建、内核假设、语义范畴对齐，以及按义务映射的定理对照。

## 研究处置

Disposition: **Iterate; do not promote the complete-FMS claim.**

本审计缩小了实现选择，但未闭合理论义务。它识别了一层可能可复用的 Scott 源码，以及一个机械上成熟但语义不同的 COFE 求解器。两者均不提供完整的 FMS 模型、隐藏定理或 strong-late 完全抽象实例。
