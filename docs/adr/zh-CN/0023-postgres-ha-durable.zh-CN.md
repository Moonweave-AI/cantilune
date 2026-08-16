# ADR-0023：Postgres HA 耐久协调器

| 字段       | 值                                                          |
| ---------- | ----------------------------------------------------------- |
| 状态       | **Accepted**                                                |
| 日期       | 2026-08-15                                                  |
| 决策负责人 | Joker-of-Gotham                                             |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露） |
| 相关       | ADR-0003、ADR-0014                                          |
| 取代       | 无                                                          |
| 被取代     | 无                                                          |

> 英文正文为唯一权威来源：[`docs/adr/0023-postgres-ha-durable.md`](../0023-postgres-ha-durable.md)。

## 背景

ADR-0003 推迟了多副本耐久存储。一条生产路径（Temporal 风格）是：消费运维提供的 HA 数据库，并在应用层实现 CAS + fencing。这仍是本 ADR。第二条生产路径——官方 etcd Raft——见 ADR-0029。

## 决策

1. `createPostgresDurableCoordinator` 实现 `DurableCoordinator`（head CAS、changelog、recipe sidecar、epoch binding、fencing lease）。
2. 连接：`CANTILUNE_DURABLE_DATABASE_URL`。`CANTILUNE_REQUIRE_POSTGRES_HA=1` 在缺失该值时**失败关闭**。多宿主也可改走官方 etcd（ADR-0029）。
3. 单宿主默认仍为文件 CAS（`bootFileOS`）。
4. 本路径的复制、备份与故障转移属于运维的 Postgres HA（流复制/同步副本）。仓库内运维套件为 `deploy/postgres-ha`（官方 PostgreSQL 16 流复制 + `FIRST 1 (replica)`），由 `scripts/host/provision-host.mjs` 拉起。
5. 跨副本读者共享同一个 head；它们不得各自发明一条 EventSpine。
6. `probePostgresHa` 按系统自动探测：对 URL 主机/端口做 TCP（默认 `127.0.0.1:5432`），并查询 `pg_is_in_recovery` / `pg_stat_replication` / `synchronous_standby_names`。单机主库不算 HA。`/status` 与 `scripts/verify-host.mjs` 只报告；`CANTILUNE_REQUIRE_POSTGRES_HA=1` 启动时失败关闭。`CANTILUNE_HOST_MODE=multi` 可由本 URL **或** Raft 满足。

## 批准

**Architecture + Security**：Joker-of-Gotham（COI 已披露）  
**日期**：2026-08-15
