# 世界支撑、EP 余极限与 FMS 定律边界 — 2026-07-27

状态：可变工作树中的 Lean 内核证据；不是不可变证明发布  
治理：S2 / QA-L4 / M1，RFC-0002 为 Pre-FCP，ADR-0001 为 Proposed  
DRI：Joker-of-Gotham

## 结论

本轮增加四项构造性结果和一项与表示无关的阻断定理：

1. 精确有限支撑可沿任意有限世界单射运输，并已打包为真正的世界索引
   monad；同时存在到实际世界函子范畴的忠实遗忘函子和幂函子比较自然
   同构；
2. 把“精确保持支撑”放宽为“支撑只可缩小”后，可得到总的笛卡尔
   Fubini、实际对称幺单范畴，以及 lax-braided 幺单 monad 打包，并证明
   自然性、对称、结合、单位和乘法协调；
3. 具体 embedding-projection 塔具有对任意目标余锥显式构造的余极限
   泛性质、真正的 mathlib `Cocone`/`IsColimit` 表示，并且当前未分离
   endofunctor 已具有实际初代数和终余代数；
4. 共同 FMS 分段路径现已依赖索引到真实 `EpochChain`，并且合成时不会
   重复共享 epoch；
5. 源式严格 `let`、zero-preserving `let` 和交换律在任意 carrier 上都会
   推出 divergence 与 deadlock 相等。

第 5 项不是有限 powerset 反例。它对任意计算类型量化，不使用序、
拓扑、基数或具体幂域表示。

## 内核构造

### 世界索引的精确支撑

`FMSCpoOmegaScottWorldSupportTransport` 构造了：

- 每个单射 `Fin m → Fin n` 上的 reindexing morphism；
- 支撑的精确直接像运输；
- 恒等与复合定律；
- supported world model 范畴；
- 逐点 lower omega-Scott power functor、unit、multiplication 与 `Monad`
  实例；
- return、choice、flattening 关于世界变换的自然性和精确支撑公式。

这闭合了当前未分离 lower omega-Scott 构造的有限世界支撑运输，但没有
把它认定为完整 FMS/Abramsky 幂域。

`FMSCpoOmegaScottWorldSupportForgetful` 还构造了忠实函子

```text
SupportedWorldModel ⥤ (World ⥤ ωCPO)
```

以及比较“先取 supported power 再遗忘”和“先遗忘再取实际逐点
omega-Scott power”的自然同构；该比较也与 map、unit 和 multiplication
相容。忠实性说明遗忘后仍能区分支撑细化箭头；full、essentially
surjective 和范畴等价均未假设，也未证明；该比较也尚未进一步打包成
monad morphism 或 monad equivalence。

### support-lax 总 Fubini

`FMSCpoOmegaScottSupportLaxMonad` 把
`support (f x) = support x` 放宽为可靠的 frame 条件
`support (f x) ⊆ support x`。在该范畴中，笛卡尔 Fubini 是总函数，
其自然性、principal/unit、对称、结合和乘法 interchange 均已由内核
检查。

`FMSCpoOmegaScottSupportLaxMonoidal` 使用笛卡尔积和支撑并集安装了实际
mathlib `MonoidalCategory` 与 `SymmetricCategory` 实例，把 power functor
打包为 `LaxMonoidal` 与 `LaxBraided`，并证明 monad 的两个自然变换都是
monoidal。因此，当前 support-lax power 构造在这一精确范畴内已经是由
内核检查的交换幺单 monad。

该范畴针对每个固定的有限资源类型建立，而不是跨世界的 exact-support
范畴。虽然张量由底层笛卡尔积构成，本模块没有另行安装或声称 mathlib
有限积的泛性质 package。

这形成一个必须显式决策的分叉：

- 精确支撑适合 separation-aware partial tensor，但拒绝不受限的空分支
  Fubini；
- support-lax morphism 可容纳总笛卡尔 Fubini，但它不是强化目标所需的
  精确 separated tensor。

规范不得静默混同这两个范畴。

### EP embedding 余极限

`FMSCpoConcreteEmbeddingColimit` 为具体有限近似塔定义任意目标的
embedding cocone。其 mediator 是“projection 后接 cocone leg”近似序列
的逐点上确界。所有 leg 都经该 mediator 分解，任何满足 cocone 方程的
候选 mediator 都等于它。

这给出该具体塔的显式泛性质；它不声称所有 ωCPO 上的所有局部连续
endofunctor 都代数紧致。

`FMSCpoConcreteEmbeddingCategoricalColimit` 将这一显式泛性质桥接为真正
的 mathlib diagram、cocone 和 `IsColimit`。其 `desc`、`fac` 与 `uniq`
字段对普通函子范畴 `World ⥤ ωCPO` 中的每个余锥及每个候选 mediator
量化，从而消除了此前“仅有自定义泛性质”的缺口。它不提供富集余极限、
对每个源对象的 `SolutionSetCondition`，也不证明任意局部连续
endofunctor 的一般代数紧致性。

### 具体初代数、终余代数与紧致性见证

`FMSCpoConcreteInitialAlgebra` 对每个 `Algebra ActualAgentFunctor` 构造
递归余锥、mediator、原生 algebra square 与唯一性证明。
`FMSCpoConcreteTerminalCoalgebra` 对偶地为每个 coalgebra 构造
final-sequence 观察、projection-limit lift、coalgebra square，并由所有
有限投影的联合单态性取得唯一性。

`concreteActualAlgebraicCompactnessWitness` 将这两个泛性质与已有连续自然
fixed-point 同构组合起来。它是对当前这个未分离 `ActualAgentFunctor`
的真实代数紧致性证据；不是一般代数紧致性，也没有把该 endofunctor
认定为强化目标所需的 separated Abramsky/FMS 幂域。

### Epoch 索引的共同 FMS 路径

`FMSCommonEpochSegmentedCrossEpochChain` 将每个精确操作/FMS 段索引到
真实 `EpochChain`。事件段携带精确 native path，admission 边界携带独立
native registration step。flatten positions、action、prefix、endpoint
和三段结合律均已证明，并且不会复制非空共享 epoch。

该构造仍消费调用方提供的 `ExactFMSAcceptancePackage`；它不制造生产
FMS package、产品 Markov kernel 或包自有运行事实。

依赖索引是真实的，但语义证据仍由调用方提供：`eventAction` 并非由
`ProjectionCertificate.mapEvent` 推导，`admissionAction` 并非由
`AdjacentAdmission` 推导，所有 FMS 状态目前都固定在 `agent.obj 0`。
append 刻意采用 half-open 语义：丢弃 head 的终端 epoch 段，保留 tail
中的共享段；seam 只令 head 的终端段入口等于 tail source，不比较两份
共享 epoch 的完成执行。结合律证明也只是 flatten action list 相等，
不是依赖证明对象相等或随机轨迹定律。

## 直接 FMS `let` 阻断

`FMSCpoFMSLetNoGo` 只假设：

```text
bind divergence k = divergence
bind deadlock   k = deadlock
bind x (λ _. bind y (λ _. r))
  = bind y (λ _. bind x (λ _. r))
```

代入 `x = divergence`、`y = deadlock` 后，左边化为 `divergence`，
右边化为 `deadlock`，所以：

```text
divergence = deadlock
```

因此 `no_separated_commutative_let` 证明：不存在还能同时提供
`divergence ≠ deadlock` 的 carrier。

`FMSCpoFMSLetPackageNoGo` 将该阻断连接到真实
`CpoPowerdomainPackage` 字段，证明强制具有
`divergence_ne_empty` 的 package 即使在单点测试对象上也不能再扩展
全部三条源式 `let` 定律。该桥显式存储这些定律，因为当前 package
record 既没有 bind，也没有可从中推导全部定律的
multiplication-at-empty 字段。

Fiore–Moggi–Sangiorgi 使用交换 monad、严格 morphism，以及满足
`let(f, 0) = 0` 的半格零元；其源模型不要求 bottom 与 zero 不等。
Cantilune 的强化目标额外加入了该分离要求。因此，若不修改下列至少
一项，就不可能同时构造完整源兼容 package 与当前强化接口：

- divergence/deadlock 分离；
- divergence 处严格性；
- deadlock 处 zero preservation；
- 交换 `let`；
- 或这些等式所作用的观察/张量解释。

这是 RFC/FCP 决策，不是实现细节。

## 一般 bound-output α 商

`OpenSMCActionAlpha.ActionAlpha.iff_orbit_eq_and_boundOutputAdmissible`
完整刻画 action label 的 α 等价；`alphaAction_boundOutput_eq_iff`
进一步证明：

- 同一可观察 subject 上的所有合法 binder 拼写属于同一类；
- 语法上可写但操作上非法的 self-bound label 不与真实 `open` label
  混同；
- channel subject 仍保持可观察。

结合已有的 action/derivative 联合商与真实 native fresh-representative
一步推导，这闭合了一般 bound-output label 的 α 转换，但仍未选择公开
边界 identity、wire 语义、plug/hide 相等性或总具名 Open-π SMC。

主要来源：

- [Fiore–Moggi–Sangiorgi，*A Fully Abstract Model for the π-Calculus*](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Fiore–Moggi–Sangiorgi 扩展版本](https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf)
- [Abramsky–Jung，*Domain Theory*](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

## 仍不可由通用理论推导的输入与决策

仓库中仍不存在：

- 经 RFC 选择的总具名边界 Open-π 表示，以及可复用 wire、freshening、
  plug/hide/restriction 和全部协调图采用的相等性；
- 精确 FMS package 的生产 inhabitant；
- 两个具体生产 Markov kernel 及其 coupling；
- 八个包中任一包自有的规则清单、四视图 admission、rank、pre-net、
  资源/会话/删除策略、授权谓词、stable/fair window 或正 ε 进展证书；
- 独立 QA-L4 批准、FCP 批准和 ADR 接受。

通用投影与轨迹定理会正确消费这些输入，但不能从包名制造经验性运行
事实，也不能替治理流程选择公开语义。

## 处置

CENTRAL-12 与 CENTRAL-18 保持 `partial_scaffold`。新增声明是可由内核
检查的证据，但工作树仍可变，且尚无独立复核。严格完成门必须继续失败，
直到 RFC 矛盾被解决、缺失产品事实被提供，并完成治理批准。

本轮可变工作树的构建、完整性、依赖审计和严格门结果详见
`formal/build-evidence/2026-07-27-world-support-ep-compactness-source-let-root.md`。
