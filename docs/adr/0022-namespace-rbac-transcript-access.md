# ADR-0022: Namespace RBAC and Transcript Access Grants

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-15                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0021, ADR-0005, ADR-0006, ADR-0007                               |

## Context

Fleet admin must become a cross-tenant console without a shared plaintext world. Temporal and Kubernetes isolate with Namespace + RBAC, not “one admin sees every conversation.”

## Decision

1. Core `CollaborationNamespace` + `Participant.namespaceId` (default `default`).
2. Control-plane RBAC: `admin` / `member` / `observer` per Namespace.
3. Cross-namespace default: metadata + `summarizeTranscript` only.
4. `TranscriptAccessRequest` is committed world state. **Only the subject Actor** may approve, deny, or revoke.
5. Approval materializes `ScopedCapability` kind `transcript_read` scoped to `{ kind: "transcript", actorId, namespaceId }` — no parallel auth type.
6. Super-admin fleet views do not bypass redaction.

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-15
