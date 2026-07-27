# Abramsky 幂域构造路线 — 2026-07-26

## 结论

剩余的全 `ωCPO` 构造必须通过对一个*合并的*非确定计算理论取自由代数伴随来获得。它不能通过在当前的下界/Hoare 幂对象上添加 `WithBot` 得到，而具体的 SFP Plotkin 幂域表示本身并不是一个全 `ωCPO` 构造。

承载分类学任务的对象具有：

- 一个用于发散的序论最小元 `⊥`；
- 一个独立的用于死锁的半群单位元 `0`；以及
- 一个连续的、结合的、交换的、幂等的二元选择运算。

态射是保持这三种运算的连续同态。所需的幂域是由载体/遗忘函子的一个 `Cpo`-充实左伴随所诱导的单子。一个普通的、未核验的 `IsRightAdjoint` 参数只会给缺失的定理换个名字，而并不构成一个可接受的构造。

处置：**iterate**。本记录固定了构造路线；它不是 Lean 证明，也不栖居于 `CpoPowerdomainPackage`。

> **取代说明（2026-07-26）：** 下方将 Step C、全源解集或充实伴随称为“missing”的状态陈述属于历史检查点。它们已被本记录末尾的修正部分所取代。全源条件与充实伴随现在是可变树核构造；分离的交换 Fubini 包、递归域与语义定理仍然缺失。

## 当前内核检查点

路线步骤 A/B 以及以下辅助分类学检查点现已用 Lean 实现：

- `Cantilune.Pi.FMSCpoNondeterministicCategory` 定义了实际的 `NDωCPO` 范畴、其忠实的载体函子，并证明了任何*已经提供的* `CpoPowerdomainPackage` 都会诱导出预期的普通自由/遗忘同态等价与伴随。后一条定理是对包接口的验证，而不是对该包的构造。
- `Cantilune.Pi.FMSCpoNondeterministicLimits` 按分量构造了任意小乘积与等化子，导出了 `HasLimits.{0} NDωCPO`，并证明了载体函子保持这些乘积、等化子，从而在已实现的宇宙层级上保持所有小极限。
- `Cantilune.Pi.FMSCpoNondeterministicEnrichment` 在每个 strict hom 集上构造了逐点的 omega-CPO，并证明了范畴复合是联合 omega-连续的。这提供了充实范畴的 hom-对象一侧；它并不构造充实左伴随。
- `Cantilune.Pi.FMSCpoNondeterministicNullary` 将零生成元上的自由代数构造为带序的 `Bool`，其中 `false` 为发散、`true` 为死锁、合取为选择，并附有内核核验的初始性证明。因此发散/死锁分离由一个真实的代数来见证，而不是对每个对象都被设定。
- `Cantilune.Pi.FMSCpoNondeterministicSolutionSet` 证明了 AFT 的精确边界

  ```text
  SolutionSetCondition U ↔ U.IsRightAdjoint
  ```

  并从左侧构造了普通自由函子、伴随、单子、strict algebraic multiplication 以及完整的自由扩张 universal property。它还为空 omega-CPO 构造了单元素局部解集，并将 `OrdinaryFubiniWitness` 隔离为一个独立的、无 inhabitant 的输入。
- `Cantilune.Pi.FMSCpoFiniteStrictFreeBoundary` 证明了诱人的有限分离载体并不能扩展该结果。对每个非空有限等式源，其单元素结构箭头都不是初始的，并且不存在适用于所有 `NDωCPO` 目标的扩张运算。带序的布尔 meet 目标给出矛盾：`deadlock < singleton a` 但 `true ≰ false`。空源仍然是唯一真正的局部解集情形。

因此步骤 A 与 B、hom-对象充实、nullary 自由情形以及精确的 AFT 归约都已内核构建。Step C——真正的全源解集栖居者——现在是第一个未闭合的存在性义务。nullary 初始对象并不提供任意 `ωCPO` 源上的自由代数，而新的有限 no-go 排除了将原始的 strict finite-powerset 载体外推到非空有限源。即使在有了全局解集之后，交换 Fubini witness 与充实/强相干仍是分离的。递归域、隐藏、adequacy、definability 或 full-abstraction 的结论都不能由局部空源结果推出。

## 治理

- 工作对象：承载性的形式语义研究与实现。
- 风险：S2；错误的幂域会改变发散、死锁以及 full-abstraction 主张。
- 质量目标：QA-L4。
- 成熟度：Pre-FCP/M1。
- DRI：Joker-of-Gotham。
- 规范决策产物：RFC-0002 与 ADR-0001，两者仍待接受。

未发现 Stop-Ship 条件。仓库与源文本被作为不受信任数据处理，仅用作数学证据。

## 原始来源发现

作者托管的 Fiore–Moggi–Sangiorgi LICS 论文将 `ND(D)` 对象定义为 `(D, ⊥, 0, ∪)`，其中 `⊥` 是最小元，`(D, 0, ∪)` 是一个半群；其箭头是 strict semilattice 同态。它将 Abramsky 的幂域单子定义为相应充实伴随所诱导的 `Cpo`-单子，并声明对 `D = Cpo` 它存在。随后它将构造逐点提升到 `Cpo^W`，并使用

```text
X = P(H X)
```

在 `Cpo^I` 中的初始解。

来源：
[Fiore–Moggi–Sangiorgi, LICS 1996, §§2.1 and 3](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)。

Abramsky 与 Jung 给出了自由 dcpo-代数的一般存在路线：一个有穷等式理论的 dcpo-代数范畴是完备的，遗忘函子保持极限，而基数解集论证允许使用一般伴随函子定理。他们另外描述了自由 strict 代数与局部连续自由构造。

来源：
[Abramsky–Jung, *Domain Theory*, §§6.1–6.2](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)。

Abramsky 的同步树构造在 SFP/代数域上给出了一个有用的具体表示。Plotkin 载体使用 Lawson/凸闭包与 Egli–Milner 序。其空集扩张 `P₀[D]` 将一个计算排在所有其他计算之下当且仅当它是 `{⊥}`；这就将发散的 `{⊥}` 与收敛的空死锁分离开来。该表示是预期区分的来源证据，但其 SFP 假设并不确立当前 RFC 所需的全 `ωCPO` 伴随。

来源：
[Abramsky, *Domain Theory and the Logic of Observable Properties*,
Chapter 5 §3](https://www.cs.ox.ac.uk/people/samson.abramsky/thesis.pdf)。

## 精确 Lean 构造序列

### A. 捆绑代数范畴 — implemented

定义范畴 `NDωCPO`，其对象包含：

1. `carrier : ωCPO`；
2. `divergence : carrier` 及其为最小元的证明；
3. `deadlock : carrier`；
4. 连续的 `choice : carrier × carrier →𝒄 carrier`；
5. 结合律、交换律、幂等性，以及 `deadlock` 单位元。

态射必须是保持 `divergence`、`deadlock` 与 `choice` 的连续映射。单位律与复合律必须是底层连续映射的外延相等。

`FMSCpoNondeterministicCategory` 实现了该范畴。它还从一个被提供的 `CpoPowerdomainPackage` 导出普通自由/遗忘伴随；它并不把该条件方向当作存在性证明使用。

`FMSCpoNondeterministicEnrichment` 额外证明了每个 hom 集在逐点序下是一个 omega-CPO，并且复合是一个联合连续映射

```text
(A ⟶ B) × (B ⟶ C) →𝒄 (A ⟶ C).
```

`FMSCpoNondeterministicNullary` 构造并证明了分离的两点代数的初始性。这是空生成元源上的自由对象，而不是缺失的一般自由函子。

### B. 证明完备性与极限保持 — implemented

按分量构造乘积与等化子并证明其 universal property。利用乘积加等化子导出 `NDωCPO` 的所有小极限。定义载体函子

```text
U : NDωCPO ⥤ ωCPO
```

并证明它保持一般伴随函子定理所用到的极限。仅添加一个声称这些极限存在的字段是不够的。

`FMSCpoNondeterministicLimits` 完成了这些构造，并从其 universal property 导出完备性与保持性。该实现目前在宇宙层级 `HasLimits.{0}` / `PreservesLimitsOfSize.{0,0}` 上陈述小极限结果。

### C. 证明解集条件

对每个源 `X : ωCPO`，证明映射 `X ⟶ U A` 可分解通过一个生成的子代数，其载体有一个仅依赖于 `X` 与有限签名 的基数界。该闭包必须包含：

- 有穷代数项；
- 所有所需的 omega-链上确界；以及
- 反复闭包直到两种运算与 omega 上确界都稳定。

该证明必须产生一个真实的小代表族与一个分解，其形状恰如 mathlib 的 `CategoryTheory.SolutionSetCondition U`。散文式的基数论证或由调用方提供的解集并不构成一个栖居者。

`FMSCpoNondeterministicSolutionSet` 证明了在已构造的完备性与极限保持 instance 下，该条件恰好等价于 `U.IsRightAdjoint`。它还为 `EmptyCpo` 提供了真正的单元素解集。仓库中没有任何定理将该单元素构造扩展到任意源 `X`；上述基数闭包与小代表族仍是缺失的证明。

### D. 应用一般伴随函子定理

Mathlib 已包含：

- `ωCPO` 的所有小极限；
- 一般伴随函子定理；以及
- 由伴随构造单子。

在 A–C 之后，应用该定理构造真实的左伴随 `F ⊣ U`。从该伴随导出 `ωCPO` 上的单子、其 unit、multiplication 与 universal `freeLift`。

该蕴含现已内核构建为 `freeAdjunctionOfSolutionSet`、`ordinaryMonadOfSolutionSet` 与 `ordinaryFreeLift`。它之所以仍然是有条件的，恰好因为 Step C 没有全局栖居者。

### E. 恢复所需的代数定律

需证明而非设定：

- 函子式地保持发散、死锁与选择；
- multiplication 的 strictness；
- multiplication 保持死锁与选择；
- 完整的自由扩张存在性与唯一性性质；
- `divergence ≠ deadlock`。

最后一个性质只有在构造出一个具体的目标非确定计算（其两个常量不同）并利用唯一扩张的保持性之后，才能由自由性导出。

### F. 证明充实与交换性

普通的范畴伴随并不能自动消解 FMS 的充实字段。需证明：

- 对连续 hom-对象的作用是 omega-连续的；
- `generator ↦ freeLift(generator)` 是 omega-连续的；
- tensor/Fubini 映射是连续的且自然的；
- unit、对称、结合与 multiplication/Fubini 定律成立；以及
- 剩余的 pure/effectful 与 deadlock/choice strength 定律成立。

只有在此之后，构造才可栖居于 `CpoPowerdomainPackage`、`CpoEnrichedPowerdomainCoherence`、`StrongCommutativePowerdomainCoherence` 与 `KleisliPowerdomainCoherence`。

### G. 逐点提升并求解域方程

将构造出的单子逐点提升到 `World ⥤ ωCPO`，与已构造的精确局部连续作用函子 `H` 结合，并构造 `A ≅ P(H A)` 的一个初始解。

当前的有穷近似塔与 `ActualFixedPointWitness` 接口本身并不构造该解。`FMSCpoEmbeddingProjectionBilimit` 现在构建了具体的 EP 迭代塔、其在 omega-CPO 与 world-model 范畴中的 coherent-thread 投影极限，以及典范连续 fold `F L -> L`。它还证明了对平移投影锥的保持性既等价于一个显式双侧逆，也等价于该 fold 的 `IsIso`。下一步证明必须导出该保持性（它不是当前 hom-local-continuity 记录的字段），然后证明所需的 initial/terminal universal property。

## 被拒绝的捷径

- `WithBot (OmegaScottPower X)`：被已核验的 multiplication unit/order 障碍所反驳。
- `WithBot (LowerSet X)`：principal return 与 strict flattening 在一般 omega 极限上失效。
- 单独的 SFP `P₀` 表示：它是一个有用的受限构造，而不是全 `ωCPO` 伴随。
- 字段设定了左伴随、不动点、adequacy 或 full abstraction 的结构：这是接受边界，不是实现。
- 将调用方提供存在性证明的 `Classical.choice` 当作局部构造：缺失的存在性定理仍将是一个前提。

## 退出准则

该幂域阶段仅在以下全部在仓库中被内核核验时才关闭：

1. 一个有栖居者的 `NDωCPO` 范畴与载体函子 — **kernel-built**；
2. 完备性、极限保持，以及一个真正的全源解集证明 — **kernel-built**；
3. 一个构造出的普通与充实左伴随及诱导单子 — **kernel-built**；
4. 每个所需的 base-powerdomain 相干记录的栖居者；
5. 发散与死锁不同的证明；
6. 逐点提升到实际的非恒定 world model；以及
7. 没有 `sorry`、`admit`、`axiom` 或未记录的定理导入。

## 2026-07-26 修正：全源 AFT 与剩余的语义分叉

上方较早的 Step C/D 状态已过时。可变树现在构造了一个全源 `SolutionSetCondition.{0}`，因而构造了普通自由函子、伴随、单子与自由扩张。它还构造了 omega-CPO-充实的同态等价，包括自由扩张的连续性与自然性。这些是真实的内核构造，不再是调用方前提。

剩余的不是“找到任意一个 Fubini 映射”。典范的顺序映射是连续的且 pure-unit 相干的，并具有第一参数发散/死锁/选择定律，但它不是对称的。对该分离候选的结合律与 multiplication 相干仍未构造，且无法修复失败的对称性。一般定理 `no_commutative_first_strict_pairing` 表明：一个对所有对的、对两个被区分的第一参数常量都 strict 的对称 pairing 会把发散与死锁等同起来。该定理独立于载体的有穷性，因此不能被当作早先的有限 strict-powerset 捷径障碍而加以排除。

与来源对齐的选择现在是：

1. 在 FMS 层使用未分离的交换幂域；
2. 保留分离的常量与一个有序/非交换的 effect；或
3. 用一个 support 分离的 tensor 替换所有对的笛卡尔 pairing，并证明一个新的 support-indexed 语义定理。

仓库仅作为实验开始了选项 3：它有一个 finite-support 分离代数、分离 tensor 相干、直到有限置换的 nominal allocation，以及独立的原生动作菱形。另外，具体的现有 agent endofunctor 现在有一个 EP 迭代塔、逐点/world-natural 的投影极限、jointly monic 的有穷观察，以及典范 fold。它尚未构造充实的分离幂域伴随或证明该 fold 是同构的 inverse/unfold。

因此 Step G 与语义定理仍然 open：不存在真实的连续自然 `A ≅ P(H A)`、完整的 agent hiding/相干、operational adequacy、process-scope definability 或 full abstraction 包。[FMS 论文](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf) 提供了逐点幂域/动作/域方程的语义路线与进程级 full-abstraction 结果；[Abramsky–Jung 章节](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf) 提供了域论不动点与幂域背景。两个来源都没有使 Cantilune 额外的分离双常量、exact-event 或生产包接受义务成为自动成立。

## 2026-07-27 内核收敛检查点

本检查点取代本笔记中较早的历史陈述，即具体 bilimit 或递归替换记录没有栖居者。

首先，`FMSCpoConcreteBilimitExhaustivity` 现在证明了三个具体 bilimit 义务，而非设定它们：有穷阶段自同态近似的单调性、恒等式的逐点 omega-exhaustion，以及 unfold 近似的单调性。它无条件地栖居于 `ConcreteBilimitExhaustivity` 并构造了 `concreteActualFixedPointWitness`，即针对实际的**未分离 omega-Scott** 函子的一个连续自然同构 `A ≅ P(H A)`。局部连续性并未被用作坐标计算的替代。然而这仅仅是一个不动点：它既不证明 initial algebra/terminal coalgebra，也不证明代数紧性 (algebraic compactness)，并且它不是一个 Abramsky 分离幂域构造。

其次，实际的未分离 omega-Scott world 单子现在有一个一般的 `powerHiding` 变换。allocation/hiding、unit、multiplication 与所选的 Fubini 可交换，并且具体的 support denotation 满足一个 effectful 的 allocate/denote/hide 收缩。这是真实的单子 hiding 相干，但它尚不是 agent restriction：仍然没有构造出的递归 agent、`AgentDomainSolution.res`、operational denotation、adequacy、process-scope definability 或 full-abstraction 栖居者。

第三，`LateGuardedReplicationAlphaSubstitutionCongruence` 及其闭包模块证明了 `recv`、`new` 与 `repRecv` 的 common-fresh 归一化，以及组合的 depth/alpha 归纳。它们无条件地栖居于 `RecursiveAlpha.SubstitutionCongruent`。因此每个递归 native-step 构造子对一个 alpha-related 目标都是置换等变的，包括嵌入通信、sync、close、open、restriction 与 replication，并具有真正的一步目标而非 tau-star。

最后，`FMSCpoPowerdomainPackageCoherenceNoGo.no_distinguishedFubiniStrictness` 证明了一个与表示无关的障碍：分离的发散/死锁、交换 Fubini，以及在两个被区分常量处的 first-input strictness 不能共存。这不仅仅是一个有穷 powerset 反例。它也不反驳一个省略了该强化组合的真正 Abramsky 构造。

这些结果收窄了实现前沿，但未满足退出准则。CENTRAL-12 仍为 `partial_scaffold`：尚未构造出任何与来源兼容的分离 Abramsky 包、代数紧性 (algebraic compactness)、完整的 agent restriction、adequacy、definability 或 full abstraction。此外，对八个计划包中的任何一个，都不存在产品拥有的规则清单、生产内核、耦合、rank、pre-net、authorization、fairness/stable-window 或 positive-epsilon 事实。
