# COMMS Design Status (M2–M3 prototype — NOT M4 closure)

## Scope

`@cantilune/comms` implements the typed late-π communication facet **design prototype** per RFC-0001 §7 and ADR-0004.

**Stop-Ship:** This package is **not** design-closed for untrusted networks, multi-tenant / cross-org identity, or product conformance claims until independent Security, runtime/control-plane, protocol, and formal reviewers sign off.

## Maturity (honest)

| Area                                | Status                                                  |
| ----------------------------------- | ------------------------------------------------------- |
| Directory / interface skeleton      | M2–M3                                                   |
| Strict ingress trust chain          | In progress — fail-closed pipeline landed               |
| Opaque auth capabilities            | In progress                                             |
| Durable delivery / saga / recovery  | In progress                                             |
| Reconnect endpoint delegation + CAS | In progress                                             |
| File store fail-closed              | In progress                                             |
| Real envelope transport             | In progress (wire codec + loopback/A2A bytes)           |
| A2A external interop                | **Experimental in-repo adapter only**                   |
| Product conformance certificate     | **Not valid** — string non-empty check removed/replaced |
| L2 types tests                      | Pending                                                 |
| Real fuzz / mutation engines        | Pending                                                 |
| Independent Security sign-off       | **OPEN**                                                |

## Closed (design artifacts only)

- [x] 15 canonical families / 60 operation codes (static registry)
- [x] Four separated state axes (types)
- [x] diagrams/05-comms 八视图 (05A–05H)
- [x] ADR-0004 / ADR-0008 drafts (deferred items remain explicit)

## Evidence commands

```bash
pnpm --filter @cantilune/comms test
pnpm --filter @cantilune/comms test:coverage
pnpm test:static
```

## Anchors

- ADR-0004, ADR-0008
- `diagrams/05-comms/`
- `tests/contract/security-regression.test.ts`
