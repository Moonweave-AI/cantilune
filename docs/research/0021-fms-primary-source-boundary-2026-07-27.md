# FMS 原始资料核对与 D1-A 适用边界（2026-07-27）

状态：`verified-source-reading / proof-work-in-progress`

Owner / DRI：Joker-of-Gotham

风险 / QA：S2 / QA-L4

## 固定资料

1. Marcelo Fiore, Eugenio Moggi, Davide Sangiorgi, *A Fully Abstract
   Model for the π-calculus*, Information and Computation 179(1),
   76–117, 2002。
   - 作者托管 PDF：
     `https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf`
   - 本次只读副本 SHA-256：
     `9BAF819DC20A58C9C1765E41E0E463661020437355037FAB343BC21D4A7164EB`
2. Samson Abramsky, Achim Jung, *Domain Theory*, Handbook of Logic in
   Computer Science, 1994。
   - Oxford Research Archive：
     `https://ora.ox.ac.uk/objects/uuid:447e1def-cc66-4d2b-b4f2-b6ddc5f0ca02`
   - 本次只读副本 SHA-256：
     `907CE0F866520F95B793CA09C49C08CF1D61800E3D8DB98276EA3FF697D0AA24`

PDF 只作为定理设计与陈述核对依据；它们不是 Lean 证明证据。Lean
义务只能由仓库源码和 kernel audit 晋级。

## 已逐页核实的承重事实

- FMS PDF 物理页 21，§4.2：
  - 原文分别给出 free-semilattice monad 与 Abramsky powerdomain monad。
  - Abramsky 的 nondeterministic computation 对象同时具有最小元
    `⊥` 和半格零元 `0`；箭头是 strict semilattice homomorphism。
  - 因而原文 powerdomain 并不是当前 D1-A 的单一空 lower-set
    effect。
- 物理页 22，Proposition 4.1：
  powerdomain 在函子范畴中逐点提升。
- 物理页 24，§4.4：
  agent equation 是
  `A = μX. P(H X)`，其中
  `H X = N × (N ⇒ X) + N × N × X + N × δX + X`。
- 物理页 28–30，§4.6、Tables 4–5：
  - restriction 是递归 action fold `R : δA ⇒ A`；
  - 当被隐藏名成为 output object 时，free output 转成 bound output；
  - bound output 分支必须跳过自己新分配的最后一名并隐藏倒数第二名；
  - `par` 由 left-merge 与 synchronization 的四路有限和构成；
  - replication 由递归方程给出。
- 物理页 31，Lemma 4.1：
  closed interpretation 的 quasi-compositional equations逐项覆盖
  input、free/bound output、tau、sum、parallel、restriction、
  left-merge、synchronization 与 match/mismatch。
- 物理页 32–35，§5：
  denotational validity 依赖 restriction、left-merge、synchronization
  的具体方程以及 ω-birule；不是由 domain equation 本身自动推出。
- 物理页 36–42，§6：
  - 全抽象先归约到 finite full abstraction；
  - finite 层使用 Set/Cpo 之间的 canonical interpretation；
  - 关键是从 free-semilattice initial algebra `A₀` 到 powerdomain
    initial algebra `A` 的 `(M,H)`-homomorphism 为 monic；
  - 该 monicity 证明使用 lifting monad、分配律和
    Abramsky powerdomain 的 `(L,M)`-algebra 表示。

## D1-A 的精确定位

人类 DRI 已选择 D1-A：

- effect 层使用单一底元，`divergence = deadlock = ⊥`；
- 保留对称交换 Fubini；
- 原生 late-π LTS、终态分类和产品层仍严格区分运行时 divergence
  与 deadlock。

这是一条经批准的最大相容路线，但不是对原文 separated Abramsky
powerdomain 的同义重述。仓库中必须保持以下三种陈述分离：

1. **已经内核构造：** all-ωCPO lower omega-Scott closed-set monad、
   其对称 Fubini/monad coherence，以及该具体 endofunctor 的
   `A ≅ P(H A)`、initial algebra 和 terminal coalgebra。
2. **尚须单独证明：**普通 π 进程在该非分离模型中的 restriction、
   finite canonical embedding、adequacy、definability 和 full
   abstraction。
3. **不得声称：**lower omega-Scott closed-set 的
   CompleteLattice/sSupHom 泛性质就是原文 free pointed continuous
   semilattice 泛性质。

## 已形式化的边界 no-go

`Cantilune.Pi.FMSUnseparatedExplicitBottomNoGo.not_fullAbstract` 证明：
如果把辅助 `⊥` 和 `0` 同时暴露为两个可观察、彼此不等价的源语言
常量，而指称端仍使用 D1-A 单一底元，则 full abstraction 不可能。

这不否证普通有限 π 或 guarded replication 的 full abstraction：
原文最终定理量化的是普通进程，辅助 `⊥` 属于近似证明扩展；guarded
replication 也有真实 action structure，不必指称为 nullary bottom。

## 后续证明顺序

1. 在具体 fixed point 上完成 Table 4 的 action restriction fold；
2. 完成 finite agent 的 canonical Set-side 解释和到 D1-A domain 的
   monic embedding；
3. 以 finite transition normal forms 证明 finite adequacy/full
   abstraction；
4. 以 guarded approximants/terminal coalgebra 扩展到源论文范围；
5. 对“所有 domain 元素均可定义”的额外目标只在得到独立
   cardinality/definability 证明时晋级，不将其作为隐藏前提。

## 2026-07-27 后续精确状态（覆盖“尚须证明”列表）

上述第 78–80 行记录的是读取原始资料时的阶段状态。后续可变证明树已
在 D1-A 的精确、非分离范围内构造 recursive restriction/hiding、
finite Hoare adequacy/full abstraction/finitely-generated
definability，以及 `RecursiveProc` 的 finite-action-trace
guarded/contextual-Hoare 定理。

这些结果不把 D1-A 改写成 FMS 原文的 separated powerdomain，也不把
guarded trace carrier 与 actual recursive `Agent` 混同。actual-Agent
上的正面 equality/native-path full abstraction 仅覆盖 deterministic
typed tau/free-output prefix trie 与显式 `CompactPrefixPoint`
realization。另有 total supported finite-control coalgebra和十五个
normative family 的 actual-Agent commutation；它们不是更宽的
actual-Agent strong-bisimulation full abstraction。

Separated source-oriented branch 的 all-source solution-set/enriched
adjunction与 D1-A branch 的 symmetric Fubini/recursive solution 仍是
不同构造。最终 CENTRAL-18 还必须把 product operation/`refinesTo`、
metadata/payload、admission 与 `TrajectoryAgreement` 连接在同一证书
中。不可变 commit/build 证据和独立评审仍待完成。
