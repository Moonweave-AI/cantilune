# 8h soak evidence (2026-08-16)

| Field | Value |
| --- | --- |
| Status | **ok** (Owner authorized 8h as sufficient; not a release certificate) |
| Run id | `2026-08-15T19-04-39-535Z` |
| Started | 2026-08-15T19:04:39.535Z |
| Ended (8h cutoff) | 2026-08-16T03:04:37.798Z |
| Elapsed ms | 28798263 (~7h 59m 58s) |
| Cycles in 8h | 1881 |
| Failed cycles | 0 |
| Originally requested | 86400000 ms (24h); Owner cut over to 8h on 2026-08-16 |
| Authorized duration | 28800000 ms (8h) |
| Local evidence | `.cantilune/soak/2026-08-15T19-04-39-535Z/` (gitignore) |
| PR CI | shortened soak only (`.github/workflows/soak.yml`) |

Each cycle ran `@cantilune/boot` `tests/system/soak/cluster-soak.test.ts` and
`@cantilune/comms` `tests/system/l7/reconnect-storm-soak.test.ts`. Later soak
defaults are **8h** (`CANTILUNE_SOAK_MS` default in `scripts/soak-24h.mjs`).
Cycle logs stay local and gitignored. Not a release certificate.
