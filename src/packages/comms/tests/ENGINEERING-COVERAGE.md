# Engineering Coverage — `@cantilune/comms`

| Layer          | Location             | Status                                                                                       |
| -------------- | -------------------- | -------------------------------------------------------------------------------------------- |
| L2 types       | `tests/types/`       | Landed (`package-exports`, brands, identity contracts)                                       |
| L3 unit        | `tests/unit/`        | Landed (netFrame partition/duplicate/reorder/truncate, HMAC compose, pin rotation, A2A HTTP) |
| L4 contract    | `tests/contract/`    | Landed (incl. `a2a/0.1` harness)                                                             |
| L5 integration | `tests/integration/` | Landed                                                                                       |
| L6/L7 system   | `tests/system/`      | Landed (file/net cross-process; reconnect-storm soak; public A2A claim = Owner C6)           |

## Coverage gate

`vitest.config.ts` enforces the monorepo gate: statements/functions/lines **≥90%**, branches **≥88%**.
