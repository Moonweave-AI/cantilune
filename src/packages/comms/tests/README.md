# @cantilune/comms tests

| Layer            | Path                                      |
| ---------------- | ----------------------------------------- |
| L3 unit/contract | `tests/unit/` · `tests/contract/`         |
| L4 integration   | `tests/integration/`                      |
| L6 system        | `tests/system/dual-peer-loopback.test.ts` |
| L7 OS / file     | `tests/system/l7/`                        |
| fuzz             | `tests/fuzz/`                             |
| mutation gate    | `tests/mutation/`                         |

```bash
pnpm --filter @cantilune/comms test
pnpm --filter @cantilune/comms test:coverage
pnpm --filter @cantilune/comms test:fuzz
pnpm --filter @cantilune/comms test:mutation
```

See `ENGINEERING-COVERAGE.md` for matrix.
