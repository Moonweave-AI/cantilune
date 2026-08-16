# COMMS Design Status

## Scope

`@cantilune/comms` implements the typed late-π communication facet per RFC-0001 §7 and ADR-0004 / ADR-0018.

**Stop-Ship remaining (not engineering gaps):** FCP, formal `reviewed`, and auto-signed CommsProductCertificate. 0.x public A2A 1.0.0 + untrusted-network controls were Owner-accepted 2026-08-15 (independent Security = Joker-of-Gotham, COI disclosed). Engineering paths for loopback + FileTransport + NetTransport (TLS 1.3 + mTLS) + official `lf.a2a.v1.A2AService` + `a2a/0.1` harness are landed.

## Maturity

| Area                                | Status                                                                                                                                                                                            |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Directory / interface skeleton      | Landed                                                                                                                                                                                            |
| Strict ingress trust chain          | Landed — fail-closed identity → expiry → replay → authz → inbox                                                                                                                                   |
| Opaque auth capabilities            | Landed                                                                                                                                                                                            |
| Durable delivery / saga / recovery  | Landed (file store + MessagingSagaCoordinator); DLQ privileged replay is ADR-0018 residual                                                                                                        |
| Reconnect endpoint delegation + CAS | Landed                                                                                                                                                                                            |
| File store fail-closed              | Landed                                                                                                                                                                                            |
| Real envelope transport             | Loopback + FileTransport (owner+pid identity) + NetTransport (TLS 1.3 + mTLS fingerprint pin)                                                                                                     |
| Production `createCommsServices`    | Requires identity (or HMAC key from env/`hmac.key`), authorizer, observation, runtimeCommit, eStop, events, peerDir, freshAllocator, storeDir — no silent Memory\* defaults                       |
| Boot mesh wiring                    | `@cantilune/boot` N×N hub + per-agent CommsServices + receive/outbound pumps                                                                                                                      |
| A2A external interop                | A2A 1.0.0 data model + JSON-RPC/REST/SSE + official `lf.a2a.v1.A2AService` gRPC (`@grpc/grpc-js`, ADR-0027). Pinned `a2a/0.1` harness remains the T4 regression gate. Public claim is 1.0.0 only. |
| Typed mobility                      | Channel/name transfer requires a committed admission receipt bound to `SessionTransportBinding`; missing receipt E-Stops (ADR-0028). Not unrestricted π.                   |
| Product conformance certificate     | Not Owner-signed                                                                                                                                                                                  |
| L2 types / fuzz / partition suites  | Landed (`tests/types/` brands + identity contracts; netFrame partition/duplicate/reorder/truncate; reconnect-storm soak). Thresholds 90/88.                                                       |
| Independent Security sign-off       | **Signed for 0.x** by Joker-of-Gotham (Owner-assigned independent Security, COI disclosed, 2026-08-15). External Security still required before FCP.                                               |

## Evidence commands

```bash
pnpm --filter @cantilune/comms test
pnpm --filter @cantilune/comms test:coverage
pnpm --filter @cantilune/comms test:a2a-conformance
pnpm test:static
```

## Anchors

- ADR-0004, ADR-0008 (incl. FileTransport owner+pid STRIDE delta), ADR-0018 (T0–T4), ADR-0027, ADR-0028
- `diagrams/05-comms/`
- `tests/contract/security-regression.test.ts`
- `tests/contract/a2a-conformance-harness.test.ts`
