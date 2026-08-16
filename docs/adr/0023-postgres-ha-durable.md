# ADR-0023: Postgres HA Durable Coordinator

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-15                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0003, ADR-0014                                                   |

## Context

ADR-0003 deferred multi-replica durable storage. One production pattern (Temporal-style) is: consume an operator-provided HA database and implement CAS + fencing in the application. That remains this ADR. A second production path — official etcd Raft — is ADR-0029.

## Decision

1. `createPostgresDurableCoordinator` implements `DurableCoordinator` (head CAS, changelog, recipe sidecar, epoch binding, fencing lease).
2. Connection: `CANTILUNE_DURABLE_DATABASE_URL`. `CANTILUNE_REQUIRE_POSTGRES_HA=1` **fail-closed** without it. Multi-host may instead use official etcd (ADR-0029).
3. Single-host default remains file CAS (`bootFileOS`).
4. Replication, backups, and failover for this path are the operator’s Postgres HA (streaming/sync replica). The in-repo operator kit is `deploy/postgres-ha` (official PostgreSQL 16 streaming + `FIRST 1 (replica)`), started by `scripts/host/provision-host.mjs`.
5. Cross-replica readers share one head; they must not each invent an EventSpine.
6. `probePostgresHa` auto-detects per OS: TCP to the URL host/port (default `127.0.0.1:5432`) plus `pg_is_in_recovery` / `pg_stat_replication` / `synchronous_standby_names`. A lone primary is not HA. `/status` and `scripts/verify-host.mjs` report; `CANTILUNE_REQUIRE_POSTGRES_HA=1` fail-closed at start. `CANTILUNE_HOST_MODE=multi` is satisfied by this URL **or** Raft.

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-15
