# FMS bottom/zero 与交换性范围校正

日期：2026-07-26  
状态：已核对原始来源并有内核定理支持；架构决策待定  
治理：RFC-0002 Pre-FCP；ADR-0001 Proposed  
风险 / 质量 / 成熟度：S2 / QA-L4 / M1

## 问题

Fiore--Moggi--Sangiorgi 构造是否同时要求 powerdomain 的序论最小元、
非决定性零元可观察地区分，并要求 monad 交换？

## 原始来源结论

已核对的来源没有提出该不等式。

[FMS LICS 扩展摘要](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)
第 2.1 节要求：

- `P` 满足交换 monad 律；
- `(P X, 0, union)` 是半格；
- Kleisli 扩张保持 `0` 与二元并；
- `ND(D)` 对象同时携带最小元与半格结构；
- `ND(D)` 态射是 strict semilattice homomorphism。

随后由富集自由/遗忘伴随得到 powerdomain monad，并逐点提升到有限世界
函子范畴。来源没有陈述 `bottom != 0`。

来源演算包含 guarded replication；全抽象定理比较进程项指称与 strong
late bisimilarity。它没有把无限原生 tau 运行的指称规定为 powerdomain
载体的序论 bottom。

## 内核结论

当前 Lean 定理 `no_commutative_first_strict_pairing` 已证明一般代数结果：
若 pairing 对所有参数定义、满足对称交换，并在第一参数同时严格保持
序论 bottom 与半格 zero，则二者必相等。

因此下列 Cantilune 附加验收目标不相容：

```text
bottom != zero
  + 全参数交换 sequencing
  + 同时严格保持两个常量
```

这不是有限 powerset 捷径的反例，也不否定原始 FMS 构造；它否定的是
Cantilune 额外加强后的组合目标。

操作层面，`LateGuardedReplicationDivergence` 已分别证明复制 tau 具有
真实无限原生运行，而 raw zero 为死锁。该定理既不需要也没有证明这两个
进程分别指称为 powerdomain 的两个指定常量。

## 决策边界

与来源一致的路线是：

- 保留交换 powerdomain；
- 不要求 effect 层证明序论 bottom 与半格 zero 不同；
- 通过递归 agent 与 source-pinned 全抽象定理证明进程层区分。

若坚持 effect 层不等式，则必须改变全参数交换性、双常量严格性或
代数/态射范畴中的至少一项。支持分离 tensor 也不是自动逃逸：若两个常量
都具有空支撑，它们仍相容，同一交换论证仍适用于该 pair。

## 当前边界

可变 Lean 树已构造全源普通与富集自由/遗忘伴随，以及规范的顺序 Fubini。
自然性、左右 unitor、重结合、左乘法和 pure-left 条件下的右乘法已经
内核检查；在双常量分离解释下，对称性已被内核否证，任意双 effect 的
乘法/interchange 未被声称。

本次校正没有构造递归域解、FMS hiding、adequacy、definability、full
abstraction、总具名 Open-pi SMC 或任何生产包。RFC-0002 仍为 Pre-FCP，
ADR-0001 仍为 Proposed。

`FMSCpoFiniteSupportStrictConstantsNoGo` 现已在 supported ωCPO 上内核检查
空支撑特例：两个常量仍可组合，而满足双严格性、交换方块及常量交换不变性的
连续 pairing 会使二者相等。它不量化、识别或否定一般 Abramsky
powerdomain，只排除这一组额外假设。

## 2026-07-27 协调性细化

上文“尚未构造 FMS hiding”现需作更精确的分层表述。对已经构造的
**未分离** omega-Scott world monad，Lean 现已构造 `powerHiding`，并证明
allocation、unit、multiplication 与 chosen-Fubini 交换图；具体 support
模型还具有 effectful allocate/denote/hide 回缩。

这并未解决语义分叉。未分离 monad 仍不具备 Cantilune 加强包要求的分离式
自由非决定性泛性质；分离自由构造仍没有对全部 effect 对称的 Fubini。两条
路线当前都没有给出递归 agent、agent 级 restriction、adequacy、
definability 或 full abstraction。因此来源范围校正与 RFC/FCP 决策要求
保持不变。
