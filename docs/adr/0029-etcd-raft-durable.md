# ADR-0029: Official etcd Raft Durable Coordinator

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-16                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0003, ADR-0014, ADR-0023                                         |

## Context

Multi-host durable storage needs a linearizable head, changelog, recipe sidecar, epoch binding, and fencing lease. ADR-0023 already consumes operator Postgres HA. This ADR adds a second production path that does **not** require an external SQL cluster: official **etcd** (Raft consensus + MVCC + Txn + Lease).

Cantilune implements the `DurableCoordinator` contract and fencing. Consensus, log replication, leader election, and snapshotting stay in etcd.

## Decision

1. `RaftKv` is the synchronous port (`get` / `range` / `txn` / `grantLease` / `keepAlive` / `revokeLease`). Production is `EtcdRaftKv` against the official etcd v3 JSON gateway. Tests inject `MemoryRaftKv` (in-process versioned KV + lease + atomic txn — not a `DurableCoordinator` mock).
2. `createRaftDurableCoordinator` implements the same commit / CAS / fencing / recipe / binding semantics as Postgres durable.
3. Multi-host locks use `RaftResourceLockTable` (cluster CAS). File locks are single-host only.
4. Environment:
   - `CANTILUNE_RAFT_ENDPOINTS` — comma-separated client URLs (`http://127.0.0.1:2379`)
   - `CANTILUNE_RAFT_EMBED=1` — start official `etcd` (`CANTILUNE_ETCD_BIN` or `.cantilune/bin/etcd`)
   - `CANTILUNE_RAFT_NAMESPACE` — key prefix (default `cantilune`)
   - `CANTILUNE_REQUIRE_RAFT=1` — fail-closed unless Raft is configured
5. `resolveProductionDurable` order: forced-flag conflict → Postgres URL (unless `REQUIRE_RAFT`) → Raft → file. `CANTILUNE_HOST_MODE=multi` requires Postgres URL **or** Raft.
6. Pin official etcd **v3.5.21**. Operator kit: `deploy/etcd-raft`. Installer: `scripts/host/install-etcd.mjs`.
7. Reads/writes use etcd’s default **linearizable** consistency. Do not switch durable traffic to serializable stale reads.
8. HTTP to etcd stays on a worker + `Atomics.wait` so the durable port remains synchronous (same pattern as `postgresSqlExecutor`).

## References

- Diego Ongaro & John Ousterhout, *In Search of an Understandable Consensus Algorithm (Extended Version)*, USENIX ATC 2014 (Raft).
- Diego Ongaro, *Consensus: Bridging Theory and Practice*, PhD thesis, Stanford, 2014.
- Heidi Howard, Malte Schwarzkopf, Anil Madhavapeddy, Jon Crowcroft, *Raft Refloated: Do We Have Consensus?*, ACM SIGOPS Operating Systems Review, 2015.
- etcd API guarantees: linearizable KV, `Txn` compare-and-swap, `LeaseGrant` / `KeepAlive` / `Revoke` (https://etcd.io/docs/v3.5/learning/api_guarantees/ and https://etcd.io/docs/v3.5/learning/api/).
- Kubernetes control plane stores cluster state in etcd; Cantilune reuses that production consensus implementation rather than a new Raft library.

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-16
