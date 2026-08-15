# Research map and retained record

The research directory keeps claim-level audits and proof-boundary records,
not every intermediate progress report. Current implementation status is
controlled by the [delivery record](../THEORY-CLOSURE-DELIVERY-2026-07-27.md),
the [QA-L4 packet](../qa/0002-theory-closure-proved-review-pending-2026-07-27.md),
and the [immutable evidence](../qa/evidence/2026-07-28-cantilune-theory-source-59a1a688.md).

## Retained records

| Record                                                                                                                     | Why it remains                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| [0001 — P1b π-bridge independent audit](0001-p1b-pi-bridge-audit.md) · [简体中文](zh-CN/0001-p1b-pi-bridge-audit.zh-CN.md) | Original independent finding that rejected an ill-typed/overstated π bridge and established the later proof boundary                  |
| [FMS domain-theory comprehensive reference](fms-domain-theory-comprehensive.md)                                            | Consolidated source, dependency, and construction-route research; its dated status snapshots are background, not current proof status |
| [0008 — product-package certificate audit](0008-product-package-certificate-audit-2026-07-26.md)                           | Dated repository finding that generic theory and absent production-package facts are different obligations                            |
| [0018 — theory/product boundary](0018-theory-product-boundary-clarification-2026-07-27.md)                                 | Full rationale for separating Core Theory FCP from per-package conformance                                                            |
| [0019 — kernel recovery](0019-post-09f9476-kernel-recovery-2026-07-27.md)                                                  | Controlling correction for the withdrawn Gate 5/7 completion reports and their non-reproducible provenance                            |
| [0021 — FMS primary-source boundary](0021-fms-primary-source-boundary-2026-07-27.md)                                       | Pinned source reading and exact limits of the D1-A route                                                                              |
| [0022 — Open-π/FMS compatibility boundary](0022-open-pi-wiring-and-fms-compatibility-boundary-2026-07-27.md)               | Maximum-compatible engineering boundary for wiring, effects, and product obligations                                                  |
| [0023 — finite strong-observation no-go](0023-fms-unseparated-finite-strong-no-go-2026-07-27.md)                           | Kernel-backed counterexample preventing an overbroad full-abstraction claim                                                           |
| [0024 — all-domain definability no-go](0024-fms-all-domain-definability-cardinal-no-go-2026-07-27.md)                      | Kernel-backed cardinality boundary for definability claims                                                                            |
| [0025 — concrete D1-A acceptance](0025-concrete-d1a-fms-acceptance-2026-07-27.md)                                          | Exact positive semantic scope and exclusions                                                                                          |
| [0026 — final common-chain proof](0026-final-common-chain-candidate-2026-07-27.md)                                         | Source/evidence-bound technical closure record                                                                                        |
| [0027 — final load-bearing seams](0027-final-load-bearing-seams-2026-07-27.md)                                             | Detailed P1a, admission, metadata, replay, trajectory, and actual-Agent seam construction                                             |

## Consolidated chronology

| Period        | Durable outcome                                                                                                                      | Current location                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| 2026-07-23    | Initial π bridge was not well typed; early fixed-host and Set/discrete-CPO fragments were insufficient                               | 0001, the formal spec, and final proof records 0025–0027 |
| 2026-07-23–25 | Iterative DPOI, P1c, stochastic, support, and replay constructions established the path but were mutable-tree snapshots              | Final source-bound records 0025–0027 and QA evidence     |
| 2026-07-26    | FMS source scope, dependency search, enriched-adjunction route, commutativity obstruction, and named-boundary limits were reconciled | FMS comprehensive reference plus 0021–0024               |
| 2026-07-27    | Core Theory and Product Conformance were separated; D1-A and maximum-compatible Open-π scope were fixed                              | 0008, 0018, and RFC-0002                                 |
| 2026-07-27    | Gate 5/7 reports were found to contain uncompiled, interface-only, or overstated completion claims                                   | 0019; the misleading reports have been removed           |
| 2026-07-28    | The final common chain was bound to immutable source/build evidence; human review and governance remained pending                    | 0026–0027, QA packet, and delivery record                |

Intermediate logs 0002–0007, 0009–0017, the duplicate 0018/0019 summaries,
and the Gate 5/7 progress-report cluster were removed after consolidation.
Their full text remains recoverable from Git history, but none is a current
source of truth.

## Reading rule

Use research records to understand _why_ a boundary exists. Use the formal
specification to understand _what_ is normative, and use immutable QA evidence
to determine _whether_ an implementation claim was actually proved. Product
claims additionally require package-owned conformance records that do not yet
exist in this repository.
