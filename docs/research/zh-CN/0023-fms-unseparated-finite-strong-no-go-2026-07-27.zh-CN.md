# D1-A 有限强观测 no-go（2026-07-27）

状态：`kernel-built / review-pending`

Owner / DRI：Joker-of-Gotham

风险 / 质量 / 成熟度：S2 / QA-L4 / M1（Pre-FCP）

## 问题

非分离的 D1-A effect 能否对一个构造子敏感的强操作等价达到 full
abstraction，即使源语言不包含显式 divergence 常量？

## 内核构造

`Cantilune.Pi.FMSUnseparatedFiniteStrongNoGo` 定义一个四状态有限
原生转移系统：

- inactive 进程；
- `tau.0`；
- `tau.tau.0`；以及
- `tau.0 + tau.tau.0`。

它从原生转移关系而非语法相等定义强双模拟。定理
`absorbedChoice_not_stronglyEquivalent` 证明 choice 态与两 tau 态不是强双模拟的。

对于每一个有序半格载体，其中 inactive 进程指称为 bottom、choice 指称为
supremum、tau 前缀为单调，
`absorbedChoice_denotation_eq` 证明

```text
denote (tau.0 + tau.tau.0) = denote (tau.tau.0).
```

其原因是序链
`bottom <= tau(bottom)`，再由单调性传递一次，随后被 supremum 吸收。
核心结论 `not_strongFullAbstract` 合并这两个事实。

## 结论

这比早先的显式 nullary 障碍更强。它表明 D1-A 指称相等不可能对一个有限
tau/choice 片段上的强观测达到 full abstraction。

因此 RFC-0002 与 ADR-0001 固定的最大相容路线为：

1. 陈述并证明 D1-A 全抽象定理，其观测为由非分离 effect 诱导的
   bottom/Hoare 观测；
2. 保留真正的 strong late-pi 单步 soundness 与 reflection 作为独立的
   操作投影定理；
3. 在终态分类与产品语义中保留 divergence/deadlock 分离；且
4. 绝不把 D1-A 定理呈现为分离 FMS 源 powerdomain 的重建。

本记录本身不构造剩余的正面 bottom/Hoare-观测定理。

## 后续正面范围

仓库随后构造了 finite 与 `RecursiveProc`
guarded/contextual Hoare 定理层。它单独证明 actual-Agent
native-path full abstraction 仅对确定性 typed tau/free-output
prefix trie 成立，另加一个 total supported finite-control coalgebra
与十五个 normative-event commutation cell。这些结果无一削弱本 no-go，
也不把更宽的 guarded 定理变为 actual-Agent strong-bisimulation full
abstraction。见研究记录 0025 与 0026。
