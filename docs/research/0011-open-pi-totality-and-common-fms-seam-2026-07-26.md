---
superseded_by: fms-domain-theory-comprehensive.md
superseded_date: 2026-07-27
---

# Open-pi totality and common-FMS seam audit — 2026-07-26

## Conclusion

Two previously conflated obligations now have separate mechanical outcomes.

1. The current concrete-name `NamedInterface` representation cannot support a
   total occurrence-preserving tensor on nonempty boundaries.  Even if a
   candidate tensor may permute ports, tensoring a nonempty boundary with
   itself duplicates a concrete name and contradicts the required `Nodup`
   invariant.  The current exact-name `PlugCertificate` also cannot be total
   at a nonempty identity boundary.
2. Given two already certified adjacent product rows, one explicitly shared
   `ExactFMSAcceptancePackage`, an operational state seam, and a denotational
   endpoint seam, Cantilune now constructs a non-erasing two-row cross-epoch
   chain.  It contains four exact native FMS edges—two admissions and two
   fixed-signature rules—and couples the same operational chain to the
   event-labelled stochastic trajectory.

The first result is a representation no-go, not a no-go theorem for every
possible Open-pi category.  The second is a conditional composition theorem,
not a construction of the missing exact FMS package or any production rule.

Disposition: **iterate**.  Do not promote CENTRAL-12 or CENTRAL-18, enter FCP,
or accept ADR-0001 on these results alone.

## Governance

- Work object: load-bearing formal-semantics research and implementation.
- Risk: S2.
- Quality target: QA-L4.
- Maturity: Pre-FCP/M1.
- DRI: Joker-of-Gotham.
- Decision artifacts: RFC-0002 and ADR-0001 remain pending.

Repository and source text were treated as untrusted evidence.  No approval,
review, product fact, or external theorem was fabricated.

## Kernel-built Open-pi boundary results

The module
`Cantilune.Pi.OpenSMCTotalNamedBoundary` proves:

- `no_totalOccurrenceTensor_of_nonempty`: no total tensor can both preserve
  all concrete port occurrences up to permutation and return a valid
  `NamedInterface` when a nonempty boundary exists;
- `no_totalExactNamePlug_of_nonempty`: the existing exact-name plug
  certificate cannot be total at nonempty identities;
- `no_sortChanging_selfBoundaryRenaming`: the boundary-renaming record
  enforces sort preservation pointwise on every source name, rather than
  accepting a sort-changing permutation merely because the aggregate sort
  list is unchanged;
- `no_sortedFreshBoundarySupply_singletonChannel`: `TypeEnv` alone does not
  entail an infinite sort-preserving fresh-name supply;
- `SortedFreshBoundarySupply.tensorObject_sorts`: after an explicit freshening
  supply is provided, a total object-level tensor exists and has the expected
  concatenated sort shape;
- `hideMany_native` and `hideMany_native_tau`: a genuine single native
  late-pi transition is preserved through finite restrictions under the
  standard action-freshness premise, with tau requiring no extra premise;
- `plugHide_syncLeft_native`, `plugHide_syncRight_native`,
  `plugHide_closeLeft_native`, and `plugHide_closeRight_native`: ordinary
  communication and bound-output close followed by arbitrary finite hiding
  are exact one-step `Late.NativeStep` derivations.

These results do not define a tensor on morphisms, identity wires, public
renaming transport, interchange, associators, unitors, braiding, or a
structural/bisimulation quotient validating those laws.

### Bound-output action alpha status

The earlier statement that a general bound-output action-label alpha quotient
was still absent is no longer accurate for this working tree.
`Cantilune.Pi.OpenSMCActionAlpha` quotients input and bound-output labels and
joint action/derivative pairs by freshness-safe binder renaming, constructs
genuine one-step native transports for both cases, and rejects the invalid
label whose bound-output binder equals its free channel.
`Cantilune.Pi.OpenSMCAlphaTransitionQuotient` additionally supplies fresh
bound-output representatives and the corresponding alpha-native transition
class.  These declarations are root-imported and included in the kernel
dependency audit.

This closes label/derivative alpha conversion.  It does not construct the
missing total named-boundary SMC: public-boundary freshening, process
transport, identity wiring, representative independence, full categorical
coherence, and operational plug/hide adequacy remain separate obligations.

## Minimal representation change required for a total Open-pi SMC

A future construction must add and prove, rather than silently assume:

1. an infinite fresh-name supply for every admitted sort;
2. coherent sort-preserving public-boundary renaming;
3. polarized linear alias/wire processes for nonempty identities;
4. transport of raw processes, alpha classes, action labels, and native
   transitions along public renaming;
5. a composition and tensor definition independent of fresh representatives;
6. category, interchange, pentagon, triangle, and hexagon laws in the chosen
   equality or observational quotient; and
7. operational sufficiency/reflection for plug, hide, restriction, free
   communication, and bound-output close.

This is a normative syntax/interface change.  Under the stop conditions in
RFC-0002 it requires an explicit RFC/ADR decision before implementation may
claim the total Open-pi SMC requested by the completion gate.

## Kernel-built common-FMS two-row result

The module `Cantilune.Theorems.FMSCommonTwoRowCrossEpochChain` proves:

- `directAdapterMiddle_ne`: the old one-row adapter's eventful final epoch is
  not the next adapter's empty initial epoch;
- `TwoRowOperationalSeam.carriedBoundary`: the second admission starts from
  the first row's actual eventful endpoint rather than resetting history;
- `TwoRowOperationalSeam.source_eventCount`: the composed source chain has
  exactly four event labels;
- `SharedFMSGatedCrossEpochEvidence`: the FMS package is a common type index,
  so two rows cannot carry unrelated packages under one value;
- `TwoRowCommonFMSSeam.nativePath_of_denotational_seam`: the exact
  denotational path is
  `admission₁ ; rule₁ ; admission₂ ; rule₂`;
- `TwoRowCommonFMSSeam.complete_with_denotational_seam`: five operational
  views, exact replay,
  strict admission boundaries, both row conclusions, and the common
  denotational path are packaged together; and
- `TwoRowCommonFMSSeam.sampled_mark_action_at_position` and
  `canonical_marked_replay_positioned_fms_actions_almost_sure`: under a
  caller-supplied `FourPositionFMSActionAgreement`, every dependent source
  mark in the canonical four-event replay is identified with the FMS action
  at the same position.

`FiniteCommonFMSPathAgreement` records the corresponding interface for an
arbitrary finite supplied chain.  `ProductionActionFaithfulness` is an
optional caller obligation for injective positions, non-`tau` actions, and
payload preservation; the module deliberately manufactures no such
production fact.

The theorem deliberately requires:

- a concrete `ExactFMSAcceptancePackage`;
- both complete product rows;
- equality of the adjacent operational source endpoints; and
- equality of their denotational endpoints; and
- for event/action identity, an explicit positional action interpretation.

None of those inputs is derived from package names or from proof
irrelevance.  In particular, the theorem does not construct the all-omega-CPO
powerdomain, recursive FMS domain, or eight production-package certificates.
Its probability-one statement is only for the canonical deterministic marked
replay scheduler.  It is not a `TrajectoryAgreement` for the two supplied
product kernels and does not couple a production Markov kernel.

## Verification actually executed

Against an earlier mutable-worktree snapshot:

```text
lake build Cantilune

Build completed successfully (9005 jobs).
```

This historical count is not evidence for the later enrichment and audit-list
edits.  The authoritative final mutable-tree result for this increment is
recorded separately in
`formal/build-evidence/2026-07-26-ndcpo-openpi-commonfms-root.md`.

An explicit `#print axioms` audit of the new NDωCPO category/limits,
named-boundary, and common-FMS declarations contains only the permitted
foundational dependencies `propext`, `Classical.choice`, and `Quot.sound`.

This evidence is mutable-worktree evidence.  It is not an immutable
commit-bound QA-L4 review.

## Remaining blocking inputs

- The total Open-pi SMC needs the representation decision and constructions
  listed above.
- The common-FMS theorem needs an actual inhabited exact FMS package.
- General finite chains need one real adjacent seam and certified row per
  boundary; a two-row theorem does not manufacture arbitrary rows.
- The eight planned production distributions still have no package-owned rule
  inventories or rank, pre-net, resource, authorization, fairness,
  stable-window, or positive-epsilon facts.
