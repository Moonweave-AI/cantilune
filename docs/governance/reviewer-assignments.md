# Cantilune Theory Reviewer Assignments

**Current status (2026-07-28):** the table below records interim DRI coverage,
not independent QA-L4 signatures. The immutable source and evidence are now
available in [PR #1](https://github.com/Moonweave-AI/cantilune/pull/1);
independent reviewers remain unassigned and are required before FCP
disposition.

| Role | Current Assignment | Status | COI Documented |
|------|-------------------|--------|----------------|
| **Formal Mathematics Reviewer** | DRI (Joker-of-Gotham) | Temporary | Yes |
| **Process Semantics Reviewer** | DRI (Joker-of-Gotham) | Temporary | Yes |
| **Lean Assumptions Reviewer** | DRI (Joker-of-Gotham) | Temporary | Yes |

## Rationale

Per DRI decision (2026-07-27): "因为当前项目限制无法指定多个审阅人，因此DRI本人暂时担任所有人类权限"

## Conflict of Interest (COI) Disclosure

**Acknowledged**: DRI is both the primary author and temporary reviewer. This is acceptable for S2 pre-FCP work under the following conditions:

1. **Transparency**: COI is explicitly documented (this file)
2. **Interim Status**: External reviewers will be recruited for final FCP acceptance
3. **Mechanized Verification**: Lean 4 kernel provides independent verification layer
4. **Governance Requirement**: All claims are kernel-verified (zero sorry standard)

## External Reviewer Recruitment (Post-Implementation)

Target external reviewers (to be recruited):
- **Formal Math**: Domain theory expert (CPO/powerdomain/full abstraction)
- **Process Semantics**: π-calculus expert (bisimulation/LTS/observable semantics)
- **Lean**: Lean 4 community member (mathlib contributor preferred)

Recruitment trigger: now, against the immutable S/E/P chain in PR #1 and before
FCP disposition.

## Approval

**DRI Signature**: Joker-of-Gotham  
**Date**: 2026-07-27  
**Decision Reference**: RFC-0002 §23 and the current [QA-L4 review packet](../qa/0002-theory-closure-proved-review-pending-2026-07-27.md)
