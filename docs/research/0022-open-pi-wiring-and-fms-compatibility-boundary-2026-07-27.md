# Open-pi wiring 与 FMS 最大相容边界（2026-07-27）

状态：`kernel-backed decision boundary / review-pending`

Owner / DRI：Joker-of-Gotham

风险 / QA / 成熟度：S2 / QA-L4 / M1 (Pre-FCP)

## 目的与非目标

本日志固定 RFC-0002 §26 与 ADR-0001 的内核证据边界，防止三类越界
陈述：

1. 把 Cantilune D1-A 非分离 effect 冒充为 FMS 原文的 separated
   Abramsky powerdomain；
2. 把有限 one-shot raw relay 冒充为 α/结构同余商上的范畴恒等线；
3. 把通用证书定理冒充为八个生产包已经实例化。

本日志不宣称 FMS 全抽象、Open-pi adequacy、FCP、ADR 接受或独立审阅
已经完成。

## FMS：被证明的 no-go 与没有被证明的 no-go

原始资料边界见
`docs/research/0021-fms-primary-source-boundary-2026-07-27.md`。FMS 原文的
nondeterministic computation 对象具有彼此不同的最小元 `⊥` 与半格零元
`0`。DRI 已批准的 D1-A 则在 effect 层使用一个底元：
`divergence = deadlock = bottom`，以保留对称交换 Fubini；原生 late-pi
LTS、终态分类与产品语义仍分别观察 divergence 与 deadlock。

内核定理：

- `Cantilune.Pi.FMSUnseparatedExplicitBottomNoGo.denote_deadlock_eq_divergence`
  证明两个显式 nullary 程序在 D1-A 指称中相等；
- `Cantilune.Pi.FMSUnseparatedExplicitBottomNoGo.not_fullAbstract`
  证明：若源扩展仍把这两个 nullary 程序观测为不等价，则该指称等式
  不可能与源端等价互相刻画。

这个定理的量词只覆盖“把两个 effect 常量同时暴露成可观察源程序”的
扩展。它不否证普通 finite pi 或 guarded replication 的 full
abstraction；后两者不是两个被直接映到同一 nullary bottom 的语法常量。
因此合规陈述必须明确区分：

- D1-A 的实际 effect 构造及其 Fubini/monad 定理；
- 普通 pi 语言在该 effect 上仍待完成的 adequacy、definability 与 full
  abstraction；
- FMS 原文 separated powerdomain 的资料陈述。

## Open-pi：raw 结构单位的精确 no-go

当前 raw 层的直接 plug 是
`ν middle. (left | right)`。`Raw.Proc.prefixCount` 在 α 转换与合法结构
同余下保持，而 direct plug 的前缀数是两侧前缀数之和。因此：

- `Cantilune.Pi.OpenSMCLinearOneShotObstruction.no_left_structural_unit_of_positive_prefix`
  排除任意正前缀候选的左结构单位律；
- `Cantilune.Pi.OpenSMCLinearOneShotObstruction.no_right_structural_unit_of_positive_prefix`
  排除对应的右结构单位律；
- `oneShotRelay_not_left_structural_unit` 与
  `oneShotRelay_not_right_structural_unit` 将结论实例化到具体 relay；
- `Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary.no_unbounded_native_forwarder`
  证明固定有限控制进程不能支持任意长的 native 重用；
- 同一文件中的 `producer_relay_native_trace` 与
  `oneShotRelay_native_trace` 则正面证明 genuine one-shot forwarding
  确实存在。

因此 no-go 排除的是以下合取：

```text
固定 finite raw process
+ 正前缀 relay
+ direct plug/hide
+ 仅 α/ACU/scope 结构同余作为 equality
+ 范畴左右单位律或任意重用
```

它不排除具名 Open-pi category、极性抽象端口、fresh nominal
representatives、replication/recursion、状态族，或单独的 wiring
semantics。

## DRI 选择的最大相容架构

规范架构分为两层：

1. **presented algebraic wiring SMC**：以有类型、有极性的抽象端口位置
   为对象，提供结构 wire identity、tensor、composition、plug、hide、
   restriction 与完整 SMC 协调；
2. **native operational layer**：以 fresh nominal realization 给出 raw
   process 代表，并为规范源事件给出 genuine strong late-pi step。

两层之间必须有显式 adequacy/commutation bridge。桥可以证明某个代数
结构的 operational realization，但不得把非平凡 protocol trace 写成
raw 结构等式，也不得宣称存在保持这些 wire identities 的 raw-process
SMC functor。Bisimulation 不作为 Hom equality。规范业务事件仍遵守“一
个源事件对应一个 strong native step”；代数 wiring identity 不是凭空
增加的业务事件。

## 产品与治理边界

Core Theory 只承诺：

- 对任意携带完整证书的包成立的参数化四投影定理；
- 至少一个非空、实质性的 reference execution package。

八个生产包的 rule inventory、rank、pre-net、资源、授权、公平性、稳定
窗口、正 ε 与生产 kernel/coupling 仍属于各包的 Product Conformance。
通用接口不能生成这些事实。

Lean kernel、build 与 axiom audit 最多把具体义务晋级为 `proved`。在
真实独立审阅人和 DRI 最终签字之前，聚合状态只能是
`proved / review-pending`；RFC 保持 Draft / Pre-FCP，ADR 保持 Proposed。

## 仍待闭合

1. 在已声明普通-pi 语言与观察关系上完成 D1-A 的 restriction/hiding、
   adequacy、definability 与 full abstraction；
2. 完成 presented wiring SMC 到 native operational representatives 的
   adequacy/commutation bridge；
3. 将证明证据绑定到不可变 commit 并完成 QA-L4 独立审阅；
4. 在后续 Product Conformance 中逐包提供真实运行事实。

如果新的 kernel no-go 改变上述边界，必须新增 RFC/ADR amendment；不得
以弱步、bisimulation equality、隐含源语言常量或虚构产品证书静默绕过。

## 2026-07-27 后续闭包与仍存条件

本日志第 113–120 行是先前的待办快照。后续候选现已构造：

- presented typed/polarised wiring SMC 的 proof-relevant native
  operational realization；
- D1-A actual recursive-domain solution和 recursive hiding；
- finite 与 `RecursiveProc` guarded/contextual Hoare 定理；
- actual-Agent deterministic typed prefix-trie full abstraction；
- total supported finite-control coalgebra；
- 十五个 normative family 的 genuine strong late-π/actual-Agent
  commutation。

精确边界不变：guarded Hoare theorem 不是 unrestricted actual-Agent
strong-bisimulation theorem；`contextualSourceInterpretation` 也不是
reverse semantic-image definability。CENTRAL-18 仍须由同一 product
certificate 连接 operation/`refinesTo`、`StableMetadata`、payload、
admission 和所选事件的 `TrajectoryAgreement`。在该链和不可变证据
完成前，状态仍是 candidate / review-pending。
