# FMS 源定理范围审计 — 2026-07-26

## 结论

Fiore–Moggi–Sangiorgi（FMS）的源文献支持 Cantilune 所采用的语义架构，但其本身并不能解除本地 Lean 构造的义务。具体而言：

- FMS 使用由 omega-链上确界与连续映射构成的偏序范畴 `Cpo`；基础对象不必拥有最小元素。
- Abramsky 的 powerdomain 通过一个 `Cpo`-enriched 的自由 pointed-semilattice 伴随引入。其代数指定了最小 divergence 元 `⊥`、半群单位元 `0` 与幂等选择。已核查的源定义本身并未声明不相等关系 `⊥ ≠ 0`；Cantilune 将该分离性作为额外的验收条件加以施加。
- 该构造逐点提升到协变函子范畴 `Cpo^I`（FMS Proposition 2.2）；
- agent 域被呈现为初始解 `A = μX. P(HX)`，并通过调用标准的递归域方程技术获得；
- 该源通过在进程项上做量化来证明 full abstraction：Theorem 3.2 覆盖有限进程，Theorem 3.3 覆盖任意进程，Corollary 3.4 给出相应的 open-congruence 表述。三者均未断言递归域的每个元素都被语法指派。

“general algebraic compactness”与“all domain elements are definable”这些表述并非 FMS 所陈述的结论。它们可被选作更强的本地证明路线，但不得归因于所引用的 FMS 定理，也不得在缺乏 RFC 决策的情况下作为唯一可接受的表述。

本源审计的任何结果都不是 Lean 证明。`CompleteFMSAvailable` 与 `ExactFMSAvailable` 仍然无 inhabitant。

## 治理分类

- 工作对象：source/theorem-scope 研究审计。
- 风险：S2；一处被夸大的引用会改变承载验收条件。
- 质量目标：QA-L4。
- 成熟度：Pre-FCP/M1。
- DRI：Joker-of-Gotham。
- 处置：迭代；不得推进 CENTRAL-12、RFC-0002 或 ADR-0001。

## 已核查的主要源文献

1. Fiore, Moggi, and Sangiorgi,
   [A Fully-Abstract Model for the π-calculus (author-hosted LICS version)](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf).
2. Fiore, Moggi, and Sangiorgi,
   [A fully abstract model for the π-calculus (author-hosted journal manuscript)](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf);
   出版元数据亦列于
   [Eugenio Moggi's publication page](https://person.dibris.unige.it/moggi-eugenio/publications.html)。
3. Abramsky,
   *A Domain Equation for Bisimulation*, Information and Computation 92(2),
   1991，列于
   [作者出版物页面](https://www.cs.ox.ac.uk/people/samson.abramsky/pubs.html)，
   并附有 [author-hosted PostScript manuscript](https://www.cs.ox.ac.uk/people/samson.abramsky/bisim.ps.gz)。
   这是已核查 FMS 参考文献所标识的递归域源文献。其他 SFP/algebraic-domain 文献可作为有用背景，但其本身不能解除 Cantilune 的全 `Cpo` powerdomain 义务。

仓库页面、提取的 PDF 文本与源代码注释被视为不可信输入，仅用于定位与比较数学陈述。

## 源文献支撑的定理矩阵

| 主题 | 源文献支撑的陈述 | Cantilune 对应物 | 当前 Lean 状态 |
|---|---|---|---|
| 基础范畴 | `Cpo` 由在 omega-链上确界下封闭且含连续映射的偏序集构成；基础对象可以无最小元 | `ωCPO`、`ContinuousHom` | 基础已存在 |
| 非确定性 | `ND(Cpo)` 对象携带最小 `⊥`、半群单位元 `0` 与幂等选择；态射为严格半群同态 | `NondeterministicComputation`、`CpoPowerdomainPackage` | 仅为验收接口 |
| Powerdomain | 来自非确定性计算的遗忘函子具有 `Cpo`-enriched 的左伴随，诱导出 Abramsky 的交换 powerdomain 单子 | `CpoPowerdomainPackage`、strong/Kleisli/enriched coherence 记录 | 无 inhabitant |
| 函子世界 | powerdomain 构造逐点提升到 `Cpo^I` | `FMSPointwiseCpoMonad`、`FMSPointwisePowerdomain` | 以提供基础 powerdomain 为前提 |
| Action/域方程 | `H` 是 FMS 的 action 函子，`A = μX.P(HX)` 是其初始解 | `AgentDomainSolution`、精确的 action/world coherence | 仅为接口；无递归解 |
| Allocation/restriction | 模型提供名字分配与由 action 定义的 restriction 操作，并附带自然性/coherence 方程 | `CoherentHiding`、`AdequateHiding`、`HidingDenotationCoherence` | 接口与支撑片段；无 FMS inhabitant |
| 操作语义 | 语义操作与递归 action 形状解释源演算 | `FMSExactAcceptance`、`OperationalDenotationCoherence` 另外要求精确的逐标签 native-step soundness/completeness 以及强 `PowerdomainObservation` 逆象定律 | 有条件，且在此操作粒度上强于所引用源文献 |
| Full abstraction | 指称相等等价于有限进程（Theorem 3.2）与任意进程（Theorem 3.3）的 strong late bisimilarity；open congruence 为 Corollary 3.4 | `StrongLateFullAbstraction`、`WorldIndexedFullAbstraction` | 仅为定理字段；无 inhabitant |

## 源演算范围

FMS 源演算包含 guarded replication `!α.P`，因此允许超出 Cantilune 当前 finite-control `Raw.Proc` 及所支持语法的行为——后者刻意既不含 replication 也不含 recursion。由此：

- 关于当前 finite-control 语法的定理可以是有效的片段定理，但并非任意进程 FMS Theorem 3.3 的实现；
- `WorldIndexedFullAbstraction` 目前是按源文献塑形的验收数据，而非本地 inhabited 的整演算定理；并且
- 添加完整的 FMS replication/recursion 将越过 RFC 停止条件，需要显式范围决策，而非隐含的证明假设。

## 初始解与代数紧性

FMS 论文称 `A = μX.P(HX)` 为 **initial solution**，并称标准的递归域方程技术提供了它。已核查的源文献并未陈述名为“algebraic compactness”的一般定理，也未将该措辞纳入 Theorem 3.2 或 Theorem 3.3。

对 Cantilune 的后果：

- `AgentDomainSolution.initial` 与连续自然 roll/unroll 同构是按源文献对齐的验收数据。
- 代数紧性、bilimit、inverse limit 或其他不动点定理可用于构造这些数据。
- 被接受的定理应要求所得的初始解及其 coherence，而非某一种特定构造方法，除非 RFC-0002 显式选择该方法。
- 因此，“prove general algebraic compactness”目前是一条强于源文献的本地路线，而非有引用支撑的 FMS 定理。

## Full abstraction 与可定义性

域论 full-abstraction 定理比较的是 **两个进程**：其操作等价当且仅当其指称相等。证明使用有限近似与语法正规形式论证，但已核查的源文献并未陈述完整递归 agent 域的每个元素都是可指派的。

集合论有限模型有独立的 universality/normal-form 结果。该有限结果不得被静默推广到 omega-CPO 解的所有元素。

对 Cantilune 的后果：

- `StrongLateFullAbstraction.full_abstraction` 与 `WorldIndexedFullAbstraction.closed_full_abstraction` 具有正确的进程对量化。
- `StrongLateFullAbstraction.native_step_complete` 是从源进程的指称出发的迁移 completeness；它不是域元素可定义性。
- 若 RFC-0002 继续要求一条独立的可定义性定理，则必须定义其 carrier、compactness/approximation 范围与量词。该定理是所引用 FMS full-abstraction 陈述之外附加的内容。

## Lean 构造边界

当前仓库提供有用但不可替代的片段：

- 有限 Hoare 构造与一个有限范畴单子；
- 分离的 finite/lower-set 候选与精确的 no-go 定理；
- Scott-closed 的对象层 principal、choice 与 flattening 结果；
- 非常值的 `Set^I`/`Cpo^I` 支撑函子与支撑层 hiding；
- 关于 powerdomain、action 函子、递归解、hiding、操作 coherence 与 full abstraction 的精确记录。

无一构造出所需的按源文献对齐的 inhabitant。剩余的构造义务除显式标注为额外 Cantilune 条件者外，均有源文献支撑：

1. 一个真正的基础 `Cpo` enriched 自由 pointed-semilattice powerdomain，附带所需的 commutative/strength coherence，以及 Cantilune 额外证明：被指定的 divergence 元素与 deadlock 元素互不相同；
2. 其到 `Cpo^I` 的逐点提升；
3. `P ∘ H` 的一个连续自然初始解；
4. FMS 的 allocation/restriction 与 parallel-operation coherence；
5. 针对所选源演算范围的进程指称与进程对 full abstraction 定理；
6. 一项已核查的导入策略，或一份带许可核假设的完整本地机械化。

Cantilune 的额外验收条件（并非直接的 FMS 定理陈述）包括：精确的逐标签 native-step soundness/completeness、`PowerdomainObservation.map_iff`/`multiplication_iff` 逆象定律（含关于 divergence 观测的显式策略），以及 divergence/deadlock 不相等关系。

## 所需的文档更正

未来的 spec/RFC/ADR 更新应采用以下区分：

- **源文献支撑的缺失项：** powerdomain、逐点提升、递归初始解、restriction/action coherence、指称，以及针对所选源演算范围的进程对 full abstraction；
- **Cantilune 的额外条件：** divergence/deadlock 不相等、精确的逐标签单步 soundness/completeness，以及强 powerdomain-observation 逆象定律；
- **可选的更强本地路线：** general algebraic compactness；
- **欠定的更强本地定理：** all-domain-element definability。

本更正不会削弱当前有效的草案门。RFC-0002 仍要求要么是一份经过 reviewed 的真正 FMS 包，要么是一项显式的 FCP 范围决策。
