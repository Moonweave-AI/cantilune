# 承重理论闭包审计 — 2026-07-27

状态：可变工作树内核证据；不是不可变证明发布  
治理：S2 / QA-L4 / M1，RFC-0002 Pre-FCP，ADR-0001 Proposed  
DRI：Joker-of-Gotham

## 执行结论

本轮显著扩展了形式理论，但**没有**建立用户要求的终极总定理。剩余缺口不是
一团模糊的“代码工作量”，而是三类不同对象：

1. Lean 树中仍无 inhabitant 的精确数学见证；
2. 必须由 RFC/FCP 选择的公开语义；
3. 仓库中不存在的生产事实与执行核。

任何定理、包名或通用接口都不能制造第 2、3 类输入。

## 内核构造矩阵

| 请求层 | 内核状态 | 精确证据或边界 |
|---|---|---|
| 全源 `SolutionSetCondition` | 已构造 | `Global.carrier_solutionSetCondition` |
| 普通自由/遗忘伴随与 monad | 已构造 | `Global.freeAdjunction` 及诱导 monad/free lift |
| CPO-富集 hom 伴随 | 已构造 | `cpoEnrichedFreeForgetAdjunction` |
| 实际未分离 omega-Scott monad 的完整交换 Fubini | 已构造 | `FMSCpoOmegaScottChosenCoherence` 中的自然性、unitors、结合、braiding、乘法与 strengths |
| 分离 divergence/deadlock 加对两个常量均严格的对称 Fubini | 对加强律集合已否证 | `no_distinguishedFubiniStrictness` 与具体表示无关，也不使用有限 powerset |
| 具体 EP 塔与投影极限 | 已构造 | `FMSCpoEmbeddingProjectionBilimit` |
| 未分离 omega-Scott 函子上的实际 `A ≅ P(H A)` | 已构造 | `concreteBilimitExhaustivity` 与 `concreteActualFixedPointWitness` |
| monadic world hiding | 对未分离 monad 已构造 | `powerHiding` 及 allocation/unit/μ/Fubini 协调 |
| agent restriction、adequacy、definability、full abstraction | 不存在 | 仍需递归 agent、restriction 变换、语法指称及来源范围内操作等价 |
| 任意置换下的递归 late-π 替换 | 已按 α 构造 | `substituteCaptureAvoiding_permute_alpha` |
| 全构造递归原生一步置换 | 已无条件构造 | `substitutionCongruent`、`native_permute_up_to_alpha_unconditional` 及 quotient 提升 |
| 非空具名边界上的总操作 Open-π SMC | 不存在且受决策阻塞 | 当前 certificate 否定同名非空 wire；边界/polarity/usage/wire/equality 须经 RFC/FCP |
| 两个真实生产 kernel 的共同轨迹 | 只有通用定理 | `complete_common_fms_production_agreement_almost_sure` 消耗真实 kernel、coupling 与 exact FMS package |
| 八个生产包证书 | 输入不存在 | 包审计未发现包目录、规则清单或运行事实集 |

## 已闭合见证与精确剩余边界

### Bilimit（双极限）

`ConcreteBilimitExhaustivity` 现已有 inhabitant。内核构造定义 canonical
有限阶段映射并证明：

- `pₙ ≫ eₙ` 的单调性；
- 恒等映射逐点等于这些 approximant 的 omega-sup；
- unfold approximant 的单调性。

逐坐标桥包括投影相容、对角恒等、successor embedding 相容以及
`εₙ ≫ πₖ = s n k`。随后由 EP deflation 与坐标最终恒等得到连续自然双侧
逆和无条件 fixed-point witness。

这只闭合了**未分离 omega-Scott** 函子上的 fixed point；它没有证明 fold
代数初始、unfold 余代数终结，也没有证明外围范畴代数紧致。

### 递归 α/替换

可执行 fresh-name 算法已经对任意置换按 `RecursiveAlpha` 等变。
`recv`、`new` 与 `repRecv` 的 common-fresh normalizer 均已构造。外层
syntax-depth 归纳与内层 α-推导归纳给出
`RecursiveAlpha.substitutionCongruent`，并无条件闭合全构造原生一步及
action/derivative 联合 quotient 的置换定理；没有使用弱步闭包。

这消除了 α/替换 residual，但没有选择或构造公开具名边界表示、可复用恒等
wire、总 plug/hide 或操作 Open-π SMC 所使用的相等关系。

### 完整 FMS 语义

实际未分离 monad 与分离自由非决定性仍是两条不同构造线：

- 前者具有完整交换 Fubini 与 monadic hiding 图，但没有分离双常量/自由
  pointed-semilattice 验收；它现在还有实际连续自然 fixed point，但仍无
  代数紧致、agent restriction、adequacy、definability 或 full abstraction；
- 后者具有全源自由/富集构造，但在加强双常量律下，规范顺序 Fubini 不对称。

新的 package 级定理 `no_distinguishedFubiniStrictness` 不是有限 powerset
捷径的反例。对任意候选 package，交换 Fubini、对 divergence 与 deadlock
均 first-input 严格，以及 divergence 的自然保持，会在 self-product 上迫使
两个常量相等，从而与 package 的分离字段矛盾。它不否定未承诺这组加强律的
Abramsky 构造。

所引 FMS 接口要求交换 monadic sequencing 与严格半格同态，但没有陈述
divergence/deadlock 不等。因此当前加强验收目标不能原样完成。必须先由
RFC/FCP 删除或重新解释分离性、交换性或两类严格律中的至少一项，之后才能
构造统一递归 agent、restriction/hiding、adequacy、definability 与
full-abstraction package。

## 不可由理论推出的外部输入

仓库没有两套生产 Markov kernel、它们的 coupling 或 exact FMS acceptance
package。八个计划产品包也没有自有规则、rank、pre-net、资源/会话策略、
授权谓词、公平/稳定窗口或正 epsilon 进展证据。

这些是运行/产品事实，不是通用 certificate 接口的数学推论。创建占位
inhabitant 会伪造定理范围，因此禁止。

## 治理处置

- proof manifest：不晋级任何 `proved` 或 `reviewed`；
- QA-L4：尚无独立人类评审；
- RFC-0002：保持 Pre-FCP；
- ADR-0001：保持 Proposed；
- 处置：**继续迭代，不晋级**。

主要语义来源：

- [Fiore–Moggi–Sangiorgi LICS 扩展摘要](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Abramsky–Jung《Domain Theory》](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

本轮再次核对了主源边界。FMS §2 为每个非决定性 domain 对象同时配置最小元
与半格零，但没有要求二者不相等；其交换 monad 假设也没有加入 Cantilune
要求的两条同时成立的第一输入 Fubini 吸收律。`A = μX.P(HX)` 是该来源特定
的 agent-domain 构造，而不是仅由 Abramsky–Jung 的一般 powerdomain 章节
自动推出的定理。FMS 的 restriction 是 Table 2 中按 action 逐项定义的
agent 操作，不是任意 monadic support hiding。FMS §3 的 full-abstraction
定理量化于其完整进程模型与 strong late bisimilarity，不蕴含 Cantilune
加强的 separated-effects 验收 package。

## 名义分离与事件来源增量

2026-07-27 的可变工作树又闭合了一条支撑传输接缝：

- `disjoint_mapSupport_iff` 证明每个有限世界单射都保持并反射有限支撑分离；
- 置换和标准 allocation 继承精确的 `iff`；
- `rename_freshChoiceAlpha` 把 fresh-choice 的置换等式提升为
  `World ⥤ ωCPO` 中真实连续映射的等式；
- `FMSNominalSeparationTransport.compose_rename_iff` 证明具体
  `FinsetPCM` 部分合成在恒等与顺序重命名下被忠实传输。

这只是分离谓词的名义传输，不是 separated powerdomain 或 separated
Fubini 定理。

操作独立性审计还发现，旧的仅标签 replay-square 接口过弱：
`(a.b) + (b.a)` 的两个互斥分支可以产生同终点的反序 trace，却不是同一对
occurrence 的 residual；`tau` 标签也没有保留同步通道。因此
`LateMarkedIndependentExchange` 新增了数据型 raw/guarded-recursive
事件、完整 mark/erase 对应，以及只能由左右并行分量各一个 marked
occurrence 构造的 `ParallelResidualSquare`。同通道静默同步会保留隐藏
subject，因而不独立；choice 反例不能构造 residual square。

更强的 nominal residual 定理仍未闭合：当前方块显式携带四项
source/residual freshness 前提，尚未从一步 support 演化自动推出
residual freshness，也未对冲突 bound action 做 α-freshening、提升到
recursive structural congruence，或全局替换旧的 label-only replay quotient。
