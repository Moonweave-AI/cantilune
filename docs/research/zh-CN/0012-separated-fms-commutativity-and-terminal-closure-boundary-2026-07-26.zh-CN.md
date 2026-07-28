---
title: 分离式 FMS 交换性与终极闭合边界
status: Implemented-unverified 研究记录
date: 2026-07-26
risk: S2
quality_target: QA-L4
maturity: Pre-FCP/M1
owner: Joker-of-Gotham
---

# 结论

当前可变 Lean 工作树已经闭合全源普通 SolutionSet 构造和
CPO-富集自由扩张层，同时揭示了当前 Cantilune FMS 验收目标中的
一个承重不相容：

> 若 divergence 与 deadlock 被要求分离，则不存在一个在第一计算
> 参数上同时严格保持这两个常量、又满足交换对称性的 pairing。

从富集自由伴随导出的规范顺序 Fubini 是联合连续的，满足 pure-unit，
并在第一计算参数上保持 divergence、deadlock 和 choice。若再要求
swap 交换性，在 `(divergence, deadlock)` 处就会推出两者相等，与
内核证明的分离相矛盾。

这个结果**不否证**不要求 divergence/deadlock 分离的 FMS/Abramsky
构造，也不否证改用不同代数同态或效应理论的路线。它精确证明当前
Cantilune 的下述组合无法同时完成：

1. `divergence_ne_empty`；
2. 自由扩张同时严格保持 divergence 与 deadlock；
3. 规范交换 Fubini。

结合律或乘法协调无法修复已经矛盾的对称性门槛。因此，本轮不能诚实地
构造当前完整 FMS 验收包，也不能宣布全部理论闭合。RFC-0002 必须先
决定改变哪一项前提，递归域、hiding、adequacy 和 full abstraction
才有一致的证明目标。

# 本轮已完成的内核构造

## 全源普通 SolutionSet

它已不再是调用方前提或空源特例：

- 显式构造由生成元产生且对 omega 链闭合的子代数；
- 用良基语法证明依赖源的基数界；
- 把每个生成子代数重索引到一个固定 `Type 0` 的 support；
- 用小表示编码 omega-CPO、两个常量、choice 与生成元；
- 对每个源对象实际构造 mathlib 的
  `SolutionSetCondition.{0}`。

主要声明位于：

- `FMSCpoNondeterministicGeneratedSubalgebra`；
- `FMSCpoNondeterministicGeneratedCardinality`；
- `FMSCpoNondeterministicBoundedRepresentatives`；
- `FMSCpoNondeterministicGlobalSolutionSet`。

定向可变工作树构建已经成功；这属于内核证据，不是绑定不可变 commit
的 QA-L4 证据。

## 富集伴随与规范 Fubini

Lean 已从真实 SolutionSet 构造：

- 自由扩张关于生成元的连续性；
- 函子在 hom omega-CPO 上作用的连续性；
- 富集自由/遗忘 hom 等价及四个自然性定理；
- 联合连续的规范顺序 Fubini 候选；
- pure-unit；
- 第一参数的 divergence/deadlock/choice 严格律。

`no_commutative_first_strict_pairing` 不依赖 pairing 的具体实现：只要
给出分离、两个严格常量律和 swap 交换性，就可推出 `False`。

# 与原始文献的范围协调

FMS 作者托管的扩展摘要给出 `let` 的交换 monad 互换律、吸收律
`let(f, 0) = 0`，并把 `ND(Cpo)` 箭头描述为 strict semilattice
homomorphisms。原始定义没有声明 `bottom != 0`；这个不等式是
Cantilune 的附加验收条件。

一手来源：

- [Fiore--Moggi--Sangiorgi，*A Fully-Abstract Model for the
  pi-calculus*](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
- [Abramsky--Jung，*Domain
  Theory*](https://www.cs.ox.ac.uk/people/samson.abramsky/handbook.pdf)

因此正确结论是本地规格冲突，而不是声称 FMS 定理错误。全源普通自由
伴随仍是有效构造；失败的是把当前分离要求继续叠加到规范交换 sequencing
律上。

# 必须进入 RFC/ADR 的选择

RFC-0002 与 ADR-0001 必须选择一条一致路线：

1. 与非分离的交换 FMS 效应对齐，在该层取消附加的
   divergence/deadlock 不等式；
2. 保留分离，但采用记录求值顺序的有序/非交换效应；
3. 改变代数对象/同态，并为新理论重证自由构造、操作观测与
   full abstraction。

每条路线都会改变可观察语义，实施者不得在证明中静默选择。

# 具名 Open-pi 边界

`OpenSMCCanonicalPositional` 给出实验性的“类型×位置”规范公开名表示、
fresh realization 和真实的代数呈示 SMC。独立审查确认了这些代数方程，
但否定了操作性 plug 的解读：`freshPlugProcess` 限制的名字按构造与两边
操作数都不相交，没有把任一端口重命名到 middle；sync 引理也不要求通信
通道属于 realized port。当前也没有从 quotient Hom 到 raw process 的良定义
realization，或 identity/tensor/composition 的 adequacy bridge。

有限控制 no-go 同样是条件性的：它只证明一个固定 raw process 无法满足
显式假设的任意长原生轨迹条件；它没有从范畴 identity 推出该条件，也不
排除零步结构 wire、按需生成/预算索引 wire、contextual wiring 或
replication/recursion。

因此，总的操作性具名 Open-pi SMC 仍需先构造端口 realization/adequacy，
并通过 RFC 选择 guarded
replication/recursion、带已证明操作商的独立 wire 语义，或明确的线性
一次性接口。仅靠 alpha 转换不充分。

# 生产概率与产品包边界

当前树包含两层概率结果：

- 两个给定有限原生状态核加 total event labelling 的 coupling 定理；
- 稀疏 event-payload 核：真实 Ionescu--Tulcea 路径在每个节点保存进入
  事件，仅对正概率 event mass 要求原生/replay 证据，并允许无标签的
  对角 hold。

二者仍以两个调用方给定的 kernel 和显式语义 coupling/seam 为前提，
都没有构造八个生产包。

产品包审计仍是决定性证据：仓库中不存在任一计划包的真实规则清单、
rank、按声明顺序 pre-net、资源/会话策略、授权、公平性、稳定窗口或
正 epsilon 事实。这些属于运行时/产品事实，不能从包名或通用定理中
推出。

# 治理处置

- RFC-0002 仍为 Pre-FCP。
- ADR-0001 仍为 Proposed。
- 尚无人工 QA-L4 复核或验收签名。
- 在不可变 commit 与独立复核出现前，proof manifest 只能保持
  `implemented_unverified` 或 `partial_scaffold`。
- 当前“全部理论完成”被真实规格冲突、待决具名边界和缺失产品输入阻断，
  并非少调用了某个 tactic。
