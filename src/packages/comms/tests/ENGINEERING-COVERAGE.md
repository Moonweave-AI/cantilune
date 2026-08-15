# Comms test engineering coverage (honest)

## Layer map

| Layer          | Path                 | Status                                                     |
| -------------- | -------------------- | ---------------------------------------------------------- |
| L2 types       | `tests/types/`       | **Missing** — planned                                      |
| L3 unit        | `tests/unit/`        | Registry + reconnect handoff                               |
| L4 integration | `tests/integration/` | Runtime saga, reconnect, observability                     |
| L5 contract    | `tests/contract/`    | Wire negatives, HMAC, **security-regression**, certificate |
| L6 system      | `tests/system/`      | Loopback, A2A in-process broker (not external network)     |
| L7             | `tests/system/l7/`   | File CAS, soak (limited), crash reload                     |
| fuzz           | `tests/fuzz/`        | Registry smoke — **not property/fuzz engine**              |
| mutation       | `tests/mutation/`    | Gate placeholder — **not mutation engine**                 |

## Coverage gate

`vitest.config.ts` enforces **55%** minimum (statements/branches/functions/lines). This is a floor, not M4 evidence.

## Stop-ship gaps (tests still needed)

- Real multi-process network ingress/auth/inbox/ack
- Kill/crash mid-write + corrupt snapshot quarantine
- Partition / duplicate / reorder / key rotation
- Reconnect storm + resource ceiling soak
- Independent Security + protocol oracle
