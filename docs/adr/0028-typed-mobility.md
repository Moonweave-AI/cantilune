# ADR-0028: Admission-Bound Typed Mobility

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-15                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0004, ADR-0008                                                   |

## Context

Plan D1 said “unrestricted π mobility.” Owner chose **typed mobility**: names/channels may be delegated only with an admission receipt. Unrestricted mobility would contradict deny-by-default comms.

## Decision

1. Channel/name capability transfer requires a committed admission receipt bound to the session and principals.
2. Transfer without a receipt is E-Stop (same family as pin rotation without admission).
3. This is not unrestricted π and does not change the formal kernel.

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-15
