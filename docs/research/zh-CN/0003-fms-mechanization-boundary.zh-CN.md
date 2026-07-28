# FMS 机械化边界与已实现的 Set/离散 CPO 片段

状态：实现研究日志
日期：2026-07-23
Owner/DRI：未指派；仓库维护者必须在晋升前指派
风险 / 质量 / 成熟度：S2 / QA-L4 目标 / Pre-FCP-M1
决策权限：RFC-0002 与 ADR-0001；本日志不授予任何批准

> **当前范围说明（2026-07-24）：** 本日志记录了最初的对外接口。此后
> `CompleteExternalFMSTheoremPackage` 强化了接受边界，补齐了完整的
> world/action、powerdomain、restriction、domain-solution，以及 pinned
> strong-late full-abstraction 字段，且已实现的支持模型现在将
> allocation/hiding retraction 等式证明为连续自然变换。该完整 package
> 不存在任何 inhabitant。因此这些补充不改变本日志的核心结论：真正的
> FMS CPO 模型、充分的 agent hiding 以及 full abstraction 仍未机械化。当前
> 边界见研究日志 0006。

## 问题

在当前 Lean/mathlib 环境中，能在不把抽象 record 当作真实 FMS 模型呈现的前提下，
检查 Fiore--Moggi--Sangiorgi（FMS）路线的多少内容？

审计聚焦于：

1. supported process 与 finite-world renaming；
2. 自由 finite-semilattice monad 及其在 `Set^I` 上的逐点提升；
3. 有限 Set 侧的 agent 等式；
4. Abramsky CPO powerdomain、`A ≅ P(H A)` 的初始解、restriction/hiding、
   operational adequacy 以及 full abstraction。

## 主要来源与本地依赖审计

主要来源：

- M. Fiore、E. Moggi 与 D. Sangiorgi，“A fully abstract model for the
  pi-calculus，” LICS 1996，DOI `10.1109/LICS.1996.561302`，
  [作者托管 PDF](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)。
- M. Fiore、E. Moggi 与 D. Sangiorgi，“A Fully Abstract Model for the
  pi-calculus，”*Information and Computation* 179(1)，2002，pp. 76–117，
  DOI `10.1006/inco.2002.2968`。这一完整的期刊修订版，而非单独的 LICS
  扩展摘要，才是任何所提供 `ExternalFMSTheoremPackage` 的接受锚点。

已检查的来源陈述了协变 finite-injection 范畴、nondeterminism monad 的逐点
提升、有限 Set 的 free-semilattice 实例、dynamic allocation 偏移，以及 action
等式

```text
H X = N × (N ⇒ X) + N × N × X + N × δX + X
A   = μX. P(H X).
```

对于有限 Set，free-semilattice monad 即有限 powerset。对于 domain 模型，该
论文依赖一个 Abramsky powerdomain/free-nondeterminism 构造，以及一个
domain-equation/full-abstraction 展开。

本地 mathlib 树中检索了 omega-CPO、continuous map、powerdomain、monad、
endofunctor initial algebra，以及 FMS 专用展开。Mathlib 提供 `ωCPO`、
continuous map、limit、范畴论 monad 与 endofunctor algebra。未找到任何
Abramsky powerdomain、FMS domain-equation 解，或 late-pi full-abstraction
定理。QPF initial fix 本身并不提供所需的 CPO-enriched 偏映射/powerdomain
构造。

## 内核检查的实现

以下各部分是内部 Lean 构造，而非外部断言：

- `FMSFinitePower.lean` 在 `Type` 上构造实际的 `Finset` monad，证明其
  free join-semilattice-with-bottom 的泛性质，并将其逐点提升为每个函子范畴
  `Type^I` 上的真正 monad。
- `FMSContext.lean` 使用 locally nameless process。自由名为 `Fin world`；
  约束名为独立的 `Fin bound` 索引。自由名 renaming 证明了恒等与复合，产生
  一个真正的 `processModel : I ⥤ Type`，并使 finite support 与 set support
  成为自然变换。
- `FMSFiniteAgent.lean` 构造有限递归 prefix/choice 树、一个结构性
  fold/unfold、一个针对 choice 的 ACUI 同余商，以及精确的有限 approximants
  `A_0 = 0`、`A_(d+1)(n) = P_f(ActionShape(A_d,n))`。

这些结果建立了真实的 Set 侧代数与有限阶段。它们尚未构造指数 `N ⇒ X` 的
完整 finite-injection action、各阶段之间的连接映射、colimit，或该 colimit
在 `Set^I` 中的 initiality。

续作还构造了一个真实的 CPO 值片段：

- `FMSCpoWorld.lean` 给出协变 finite-injection world 偏移、allocation
  自然变换，以及连续 support hiding；
- `FMSCpoFinitePower.lean` 给出基于等序离散 CPO 子范畴的 `Finset` monad、
  其 Fubini/coherence 律、逐点 world 提升，以及 shift 兼容性；
- `FMSCpoFiniteAgent.lean` 给出连续的有限递归 fold/unfold 同构，以及一个
  有限高度 cocone 泛性质；并
- `FMSCpoContext.lean` 给出一个非常值的 CPO 值 supported-syntax 函子与自然
  support 指称。

`FMSExternalPackage.mechanizedCpoFragment` 是一个真实的 inhabitant，精确
聚合了这些结果。它在 `CpoPowerdomainPackage` 之前停止：等序离散 CPO 上的
有限 powerset 并非所有 `ωCPO` 上的 Abramsky powerdomain，且该有限
fold/unfold/height 结果并非 FMS 递归 domain 等式的 enriched initial 解。

## 显式外部定理边界

`FMSExternalPackage.lean` 定义但未 inhabit：

- `CpoPowerdomainPackage`，包括连续 ACUI choice、free 泛性质，以及
  natural/unit/symmetric Fubini 义务；
- `AgentDomainSolution`，包括精确的四个 action summand、一个同构
  `P(H A) ≅ A`、范畴 initiality，以及一个连续的 `res`；
- `AdequateHiding`，将 capture-avoiding 语法 restriction 连接到 `res`；并
- `StrongLateFullAbstraction`，限定于闭合 raw process，并绑定到一个独立
  定义的 operational strong late bisimilarity。后者现在要求 fresh bound
  action，并且对于输入，要求在 capture-avoiding 替换每个接收名之后对两个
  求导项的关系。

聚合 `ExternalFMSTheoremPackage` 具有固定的期刊修订来源锚点与证明字段。
仓库中不存在任何 axiom、default instance、opaque witness 或 constructor
调用。其消费者定理以显式 package 参数为条件。

若干重要义务仍被有意暴露：

- `actionShape` 在每个 world 提供一个 carrier 等价，并在模型参数中提供
  naturality，但不提供与 finite-world injection 的兼容性，也不提供 `ωCPO`
  中的序/连续性同构；
- `res` 仅仅是一族连续映射，没有 world naturality、alpha/substitution/
  scope-extrusion coherence，也没有将 `restrictSyntax` 与仓库中已有的
  restriction 相等同；
- Fubini 字段尚未编码所需强交换 monad 的每一条 associativity 与
  multiplication coherence；并
- full abstraction 仅仅是一个 closed-world-zero 特化，而非一个开放的
  `A(n)` 解释定理。

因此该 record 是一个未 inhabited 的、枚举证明输入的聚合，尚不是完整 FMS
构造的接受证书。

## 结论与停止条件

已验证：

- supported renaming 与自然 support 指称；
- `Type` 上的真正 finite-powerset/free-semilattice monad，并逐点作用于
  `Type^I`；
- 有限递归 Set agent 语法、choice 商律，以及有限 `P_f(H-)` approximants；
- 外部 CPO 义务的一个 typechecked、有版本、非 vacuous 的形状。

未验证且未提供：

- 包含 `N ⇒ X` injection action 的完整 world-natural `H`；
- Set initial-chain colimit 与 `Set^I` 中的 initiality；
- `ωCPO` 中的 Abramsky powerdomain 实例；
- `A ≅ P(H A)` 的已构造 CPO 解；
- 充分的 FMS restriction/hiding；
- strong-late operational adequacy 与 full abstraction；
- 预期的 OpenPi-to-FMS 交换定理。

不得仅凭此工作将任何核心证明状态晋升。晋升必须停止，直到 package 接口本身
补齐缺失的 world/action、hiding 与 monad coherence；随后必须构建一个具体的
inhabitant（或完全内部的机械化），证明其 world naturality，独立审查 pinned
来源与假设，并记录 QA-L4 证据。
