# Concrete D1-A FMS acceptance（2026-07-27）

状态：`kernel-built / review-pending`

Owner / DRI：Joker-of-Gotham

风险 / 质量 / 成熟度：S2 / QA-L4 / M1（Pre-FCP）

## 已实际构造

本轮没有把文献结论或 proof-carrying interface 当作 Lean 证明。根导入
中的 concrete acceptance 直接组合以下内核构造：

1. 对所有 ωCPO 对象定义的 lower ω-Scott closed-set monad；
2. 单位、乘法、chosen symmetric Fubini、strength 及相容图；
3. D1-A 单一 effect bottom；
4. 实际连续自然域解 `A ≅ P(H A)`，以及初代数与终余代数；
5. FMS Table-4 动作 restriction fold、Kleisli 单位/乘法自然性、
   `δA → A` 的连续自然 restriction、unroll 与唯一性；
6. finite canonical late-π 片段的 Hoare adequacy、full abstraction 与
   finitely generated definability；
7. 任意 guarded-recursive 进程的 concrete lower-ωScott native trace
   adequacy/full abstraction；
8. 覆盖全部 guarded constructors（含 parallel、restriction 与三种
   guarded replication）的一孔 contextual Hoare completion、上下文
   同余和从源进程到其构造语义值的
   `contextualSourceInterpretation`；
9. 15 个规范事件的 genuine strong step 到 concrete trace effect 的
   representative-level commutation，同时保留 joint
   `DerivativeAlpha` quotient；
10. 一个真实 reconnect 的 fixed-agent unfold、世界自然性和
    restriction commutation。

主要入口：

- `Cantilune.Pi.FMSConcreteD1AAcceptance.concreteAcceptance`
- `Cantilune.Pi.FMSConcreteD1AAcceptance.normative_open_pi_fms_commutes`
- `Cantilune.Pi.FMSCpoAgentOperationalBridge.reconnect_fixed_point_action_commutes`
- `Cantilune.Pi.FMSCpoAgentOperationalBridge.reconnect_restriction_commutes`

## 必须保留的精确边界

这不是对 FMS 原论文 separated Abramsky powerdomain 的同义重建。
DRI 选择的 D1-A effect 把原论文中分离的 least element 与
semilattice zero 合并，因而：

- constructor-sensitive strong-bisimulation full abstraction 在有限
  τ/choice 子语言已经被 kernel no-go 排除；
- 正定理的观测是明确的 bottom/Hoare native trace，以及其 contextual
  completion；
- 原生 strong late-π soundness/reflection、joint derivative-alpha、
  terminal divergence/deadlock 分离仍由独立层负责；
- concrete trace carrier 是 representative-level；不宣称 literal-name
  trace 本身已经按 alpha 取商；
- “所有 ωCPO 的所有元素都可定义”被 Cantor no-go 排除；实际正面
  definability 只包括 finite Hoare finitely-generated points 与显式
  `CompactPrefixPoint` realization。`contextualSourceInterpretation`
  不是 reverse semantic-image definability。

这些边界不是未记录的弱化，而是 RFC-0002 §26 所要求的
kernel-no-go 后最大相容路线。

## 验证状态

定向 Lake 构建均已实际执行并通过；截至本记录：

- concrete D1-A acceptance：8,742 jobs；
- fixed-agent operational bridge：8,726 jobs 的根端复核；
- guarded trace：8,700 jobs；
- guarded contextual completion：8,701 jobs。

最终 commit-bound 全树构建、完整 axiom audit 与 source-integrity
证据将在技术证明提交冻结后生成。本记录本身不是独立人类 QA-L4
签署，也不把 RFC/ADR 状态提升为 Passed/Accepted。

## Actual-Agent 与最终组合的后续限定

第 22–26 行的 guarded theorem 量化于仓库自定义 `RecursiveProc`，其
语义是 lower-ω-Scott finite-action-trace/contextual-Hoare carrier。
它不等于 unrestricted recursive `Agent` strong-bisimulation full
abstraction。后续 actual-Agent 正面结果仅覆盖 deterministic typed
tau/free-output prefix trie、显式 `CompactPrefixPoint`，以及 total
supported finite-control coalgebra/十五 normative family commutation。

最终 CENTRAL-18 仍要求一个共同 product inhabitant 把
`OperationId`/registry `refinesTo`、`StableMetadata`、payload、
heterogeneous admission 和 selected-event `TrajectoryAgreement` 连到
同一 fixed-epoch occurrence。上述定向 job 数是可变树诊断，不是最终
commit-bound evidence。
