# ADR-0021: Transcripts on CollaborationSnapshot

| Field              | Value                                                                 |
| ------------------ | --------------------------------------------------------------------- |
| Status             | **Accepted**                                                          |
| Created            | 2026-08-15                                                            |
| Decision Owner     | Joker-of-Gotham                                                       |
| Reviewers          | Joker-of-Gotham (independent Architecture + Security; COI disclosed)  |
| Supersedes         | ADR-0012 §1 “MUST NOT write private history to CollaborationSnapshot” |
| Related            | ADR-0012, ADR-0005, ADR-0022                                          |

## Context

ADR-0012 kept LLM `messageHistory` off the shared world so Agents could not read each other’s reasoning. Owner (2026-08-15) reversed that product rule: operators and same-namespace peers must see what each Agent is thinking. Isolation moves from “not in the world” to **Namespace + grant**.

## Decision

1. `CollaborationSnapshot.transcripts` holds `ParticipantTranscript` (core type; same shape as boot `LlmMessage`).
2. Boot commits the exact loop history after each complete assistant/tool group (same checkpoint as ADR-0012 durability).
3. Presence is not authorization. Readers use `visibleTranscript`:
   - same `namespaceId` → full text
   - other namespace → summary unless the **subject Actor** approved a request or a `transcript_read` capability is held
4. Transcripts are committed world state, not ObservationEntry and not a parallel session identity.

## Consequences

- ADR-0012 §1 private-history rule is replaced; continuity, content-ref, and evidence rules in ADR-0012 still stand.
- Observability must redact before leaving the trust zone (ADR-0022 / 0025).
- Snapshot wire gains optional `transcripts` for backward load.

## Approval

**Architecture + Security**: Joker-of-Gotham (Owner-assigned independent reviewer; COI: also DRI)  
**Date**: 2026-08-15  
**Decision Reference**: production-release Owner answers (history = break_isolation; peer_history = same-NS full / cross-NS apply-to-subject)
