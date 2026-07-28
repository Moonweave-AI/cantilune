# All-ωCPO 全域可定义性的基数 no-go（2026-07-27）

状态：`kernel-built / review-pending`

Owner / DRI：Joker-of-Gotham

风险 / 质量 / 成熟度：S2 / QA-L4 / M1（Pre-FCP）

## 问题

已确认路线要求优先证明有限进程，再扩展到源论文的 guarded
recursion / replication；同时“尽可能”尝试一个更强目标：由同一个
π 进程语言定义任意 ωCPO 对象的每个元素。

这个额外目标严格超出 FMS 原论文的 definability 范围，而且存在
与语义细节无关的基数障碍。

## 内核构造

Lean 模块
`Cantilune.Pi.FMSAllDomainDefinabilityNoGo` 取当前原生 π 语法类型
`Raw.Proc`，并考察其幂集 `Set Raw.Proc`。按包含关系，幂集是一个
完全格，因而也是 ωCPO。

对任意候选解释

```text
denote : Raw.Proc → Set Raw.Proc
```

模块用 Cantor 对角集合构造证明 `denote` 不可能满射。核心结论为：

- `no_surjective_powerset_denotation`；
- `processPowersetOmegaCpo`；
- `not_allOmegaCpoElementsDefinable`。

这些结论已经由 Lean 4 内核检查；依赖仅为项目允许的
`propext`、`Classical.choice` 与 `Quot.sound`。

## 结论

“同一个进程语法定义所有 ωCPO 的所有元素”在 ZFC/Lean 现用基础下
不可能，因此不能作为完成门槛。最大相容路线是：

1. 对 D1-A 的有限、紧致/代数元素建立实际 definability；
2. 对 guarded recursion / replication 建立由有限逼近诱导的
   adequacy 与适用观测下的 full abstraction；
3. 对任意产品规则保留参数化证书定理；
4. 不把上述范围扩张为全域、全对象、全元素的可定义性。

这不是对有限/紧致 definability 的否证，也不削弱原生 late-π
强一步、终态 divergence/deadlock 分离或产品层证书。

## 当前正面范围的精确化

“有限/紧致”不得理解为任意 ωCPO 的全部 compact 或 algebraic 元素均
已可定义。仓库实际构造的是：

- finite Hoare 模型中显式 finitely-generated points 的 definability；
- actual recursive `Agent` 中显式定义的 `CompactPrefixPoint`
  realization；以及
- `contextualSourceInterpretation` 这一源到语义的映射。

最后一项不是从语义值到进程的逆向 definability。任何更宽的 compact
definability 主张都需要独立的新定理。
