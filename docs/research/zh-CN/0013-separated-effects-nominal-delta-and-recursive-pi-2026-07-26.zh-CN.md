# 分离效应、nominal delta 与递归 pi 证据

日期：2026-07-26  
状态：在可变工作树中实现；未经独立 QA-L4 验证  
治理：RFC-0002 Pre-FCP；ADR-0001 Proposed  
风险 / 质量 / 成熟度：S2 / QA-L4 / M1

## 问题

能否通过保留 divergence/deadlock 分离、增加 nominal 支持，并用受守卫的复制（guarded replication）扩展有限控制 late-pi 内核，来填补剩余的 FMS 与具名 Open-pi 缺口？

## 主要来源

- [Fiore–Moggi–Sangiorgi, LICS 1996](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)：
  该模型使用一个交换 powerdomain 单子，逐点提升到 finite-world 函子范畴，通过 `A = μX.P(HX)` 定义递归 agent，并对包含受守卫复制的演算陈述了进程级普遍性/全抽象（full-abstraction）结果。
- [Abramsky–Jung, Domain Theory](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)：
  局部连续函子与 bilimit 提供了一条标准的不动点路径，而连续域 powerdomain 通过自由连续域代数产生。

这些文献并未直接证明 Cantilune 的附加要求：两个可观察地不同的 strict 常量、每个源事件恰好一个带标签的目标事件、整体具名边界接线充分性，或生产级运行时事实。

## 内核构造证据

以下新模块由 root-imported：

- `FMSFiniteSupportSeparation`：在不相交有限支撑（disjoint finite support）上恰好定义的关系式偏交换复合，一个通用框架定理，一个具体的有限集资源模型，保支撑映射，以及分离张量协调方程。
- `FMSCpoFiniteSupportTensor`：一个带支撑的 omega-CPO 范畴，具有显式支撑单调性与 omega-sup 有界性、连续的支撑精确态射、不相交对的 omega-CPO、连续张量映射、自然的 braiding/associator/unitors，以及 pentagon/triangle/hexagon 方程。它不是 powerdomain、单子或递归域解。
- `FMSCpoFiniteSupportStrictConstantsNoGo`：空支撑情形现在在连续分离张量层面上被检查。两个空支撑常量是兼容的，任何对两者都 first-strict 且在交换下固定这些常量的对称配对都会将它们合并。这仅对该增强组合构成 no-go；它对 Abramsky 构造不构成 no-go。
- `NominalFiniteSupport`：在有限注入上的函子式有限支撑、新鲜分配，以及新鲜代表元通过固定旧像的 swap 而相异的证明。
- `NominalCpo`：一个非恒定世界索引 omega-CPO 支撑模型，具有连续的 renaming/permutation、分配，以及自然的 allocation/hiding 收缩。
- `OpenSMCBoundaryRenamingCalculus`：对既有边界元数据 renaming 的恒等、复合、单位、结合性与支撑同余律；顺序 freshening 与避免保持的 refresh；以及在当前不相交支撑证书下，对非空同名原子接线的精确 no-go。它不对进程进行重命名，也不构造原生 identity 接线、范畴或 SMC。
- `LateIndependentExchange`：对不相交动作支撑的精确两步原生菱形，以及仅由显式见证的原生交换方生成的 replay 商。同信道同步是显式依赖的，并仍然是原生 tau。
- `FMSCpoOmegaScottDeltaCoherence`：对实际未分离 omega-Scott 世界单子的 shift/power 同构与单位、multiplication-component、分配，以及 pointwise-Fubini delta 方程。
- `FMSCpoOmegaScottChosenCoherence`：实际未分离 all-omega-CPO 单子具有完整的 chosen-product Fubini 矩阵：自然性、主单位、braiding、结合性、multiplication、两个 unitors 与两个 strength。这闭合了该单子的 Fubini/multiplication 协调；它并未添加不同的 divergence/deadlock，也未添加更强局部接受包所要求的自由 pointed-semilattice 普遍性质。
- `FMSCpoNondeterministicSequentialCoherence`：对于 all-source enriched 的 free/forgetful 伴随，规范左到右 Fubini 映射现在具有两变量自然性、两个 unitors、reassociation、左 multiplication，以及右 multiplication 的 pure-left 实例的内核证明。其对称性仍被内核反例驳斥，且不主张任何任意两效应交换律。
- `LateGuardedReplication`：一个独立的 `RecursiveProc` 语法，具有单前缀受守卫复制、一个被证明在嵌入旧项上兼容的确定性 alpha-freshening 替换算法、在旧像上对原生 transition 的精确保持/反射，以及一个针对全局新鲜替换（包括复制输入）的 no-capture-risk 定理。它还构造了原生的 replication/open/close/synchronization 规则以及任意有限长度的 run。
- `LateGuardedReplicationSubstitution`：一个 capture-avoiding substitution 的精确自由名公式、复制输入冲突方程、自替换、支撑层面的复合，以及在显式整语法新鲜性下的进程层面复合。内核反例同时排除了无条件的 syntactic no-op 定理与无限制的替换复合。确定性新鲜名选择的严格置换等变（permutation equivariance）仍然为假；剩余的操作性陈述必须以 alpha 为模来表述。
- `LateGuardedReplicationDivergence`：一个真正的 Nat-索引无穷强原生 tau run、作为缺失每一步原生步的操作性 deadlock，以及零 deadlock 与复制 tau divergence 不相交的证明。这是操作性的，不是 powerdomain 指称或全抽象。
- `LateGuardedReplicationAlpha`：为所有构造子以及 `recv`/`new`/`repRecv` 绑定符生成的 alpha 等价、一个商、进程/动作的有限置换，以及每个非通信构造子的精确原生等变。一个具体的 swap 反例证明数值确定性 freshening 并不字面等变。
- `LateGuardedReplicationAlphaOperational`：一个动作与导数的 alpha 商、存在饱和的强原生步、可采纳的一般有界输出标签、不发生 freshening 时的严格等变，以及针对 embedded、sync 与 close 的 derivative-alpha/target-alpha 桥。这闭合了操作性商路径，而无需伪称数值新鲜选择器字面等变。
- `LateGuardedReplicationAlphaFreshChoice`：一个公共新鲜名构造与 fuel 归纳证明了任意 fuel 与整体可执行的 capture-avoiding substitution 在 `RecursiveAlpha` 模下是置换等变的，包括 `recv`/`new`/`repRecv` 的每个数值 freshening 分支。完整的 sync/close `NativeStep` 同余还要求替换尊重 alpha 相关的源体。
- `FMSCpoEmbeddingProjectionBilimit`：连续的 embedding-projection 对、它们在实际 agent endofunctor 下的具体单子种子迭代、omega-CPO 与世界模型范畴中的 coherent-thread 逆极限、jointly monic 投影，以及规范连续 fold `F L -> L`。它证明了对移位投影锥的保持、连续双侧逆的存在，以及该 fold 的 `IsIso` 三者等价；任何这样的保持见证都可构造一个 `ActualFixedPointWitness`。该保持见证本身并非从当前 hom-omega-sup 局部连续性记录导出。
- `FMSProductionKernelTrajectoryAgreement`：一个跨两个调用方提供的真实 Ionescu--Tulcea 生产内核的公共 strict FMS 缝。在精确耦合与所提供的操作性/FMS 等价下，它证明了几乎必然的原生事件、精确 DPO replay、epoch/signature 对齐、公共动作、字面相继的指称端点，以及相关状态的相等指称。它既不构造内核，也不构造仍然未被 inhabited 的精确 FMS 包。

集成 root 构建成功完成。此证据仍为 mutable-tree 结果，尚未被提升为 `proved` 或 `reviewed`。

## 精确否定边界

定理 `no_commutative_first_strict_pairing` 与载体无关。若一个所有配对的配对是对称的，并且将两个被区分的 first-argument 常量都严格映射，则对称性迫使这两个常量相等。因此它驳斥了该组合目标：

```text
distinct divergence/deadlock
  + all-pairs symmetric pairing
  + strictness for both constants.
```

它并不驳斥一个未分离的 FMS powerdomain。支撑分离的张量改变了 exchange 的量化方式，但它并不自动获得豁免：若两个被区分的常量都带空支撑，则它们是兼容的，并且同一对常量论证在该对上仍然适用。要避免矛盾，需要一个显式的支撑/严格性/代数变更，而不仅仅是把整体积替换为偏积。

## 剩余承重义务

1. 在所要求的 enriched omega-CPO 范畴层面打包支撑分离构造，并证明相关的 free 伴随与单子律，或获得一个选择另一效应路径的 FCP 决定。
2. 证明具体 agent 函子保持所构造的移位投影极限。Lean 现已证明这恰好等价于 `concreteIterationFold` 的一个连续逆，并据此构造实际的自然不动点见证；仅 hom omega-sup 的局部连续性无法提供该保持定理。
3. 定义 FMS agent hiding 操作，并证明分配、strength、替换、作用域与递归协调。
4. 证明操作性充分性、被精确量化的进程作用域可定义性定理（若保留），以及源钉定的全抽象。
5. 更改公共具名边界表示，然后构造接线 identity 并证明整体 plug/hide/restriction SMC 与原生操作性充分性。元数据 renaming 演算可用，但位置名-具体名、polarity/线性使用、identity-wire 语义、新鲜环境、进程/动作重命名、商相等，以及精确操作性观察仍是 RFC/FCP 的选择。
6. 用实际生产内核、其耦合、公共精确 FMS 包、事件/动作缝，以及产品拥有的进度事实，实例化现已内核构建的真实双内核轨迹定理。该通用定理不再使用规范确定性 replay，但不存在生产 inhabitant。
7. 从八个包 owner 处获取真实的规则清单、DAG/Petri/morphism/pi 准入、rank、resource/session、authorization、fairness、stable-window，以及 positive-epsilon 事实。仓库审计确认这些输入并不存在。

## 结论

新工作闭合了具体支撑、nominal 分配、delta 协调、其非交换边界内的 sequential-Fubini 协调、独立交换、精确受守卫复制的支撑/替换律、一个强动作与导数 alpha 商、递归域构造的投影极限部分，以及通用真实内核/公共 FMS 轨迹定理。它尚未构造递归 fold 的逆、完整 FMS 模型、整体具名 Open-pi 范畴、实际生产内核/耦合，或产品实例。RFC/FCP 与包 owner 事实仍然必要；任何完成性主张都不具备正当理由。
