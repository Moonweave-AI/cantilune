# ADR-0029：官方 etcd Raft 耐久协调器

| 字段       | 值                                                          |
| ---------- | ----------------------------------------------------------- |
| 状态       | **Accepted**                                                |
| 日期       | 2026-08-16                                                  |
| 决策负责人 | Joker-of-Gotham                                             |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露） |
| 相关       | ADR-0003、ADR-0014、ADR-0023                                |

> 英文正文为唯一权威来源：[`docs/adr/0029-etcd-raft-durable.md`](../0029-etcd-raft-durable.md)。

## 背景

多宿主耐久存储需要线性一致的 head、changelog、recipe sidecar、epoch binding 与 fencing lease。ADR-0023 已消费运维 Postgres HA。本 ADR 增加第二条生产路径：官方 **etcd**（Raft 共识 + MVCC + Txn + Lease），不强制外部 SQL 集群。

Cantilune 实现 `DurableCoordinator` 契约与 fencing。共识、日志复制、选举与快照留在 etcd。

## 决策

1. `RaftKv` 为同步端口。生产走 `EtcdRaftKv`（官方 etcd v3 JSON gateway）。测试注入 `MemoryRaftKv`（进程内 versioned KV + lease + 原子 txn，不是 DurableCoordinator mock）。
2. `createRaftDurableCoordinator` 与 Postgres durable 同一套 commit / CAS / fencing / recipe / binding 语义。
3. 多宿主锁走 `RaftResourceLockTable`。文件锁只用于单宿主。
4. 环境变量：`CANTILUNE_RAFT_ENDPOINTS`、`CANTILUNE_RAFT_EMBED=1`、`CANTILUNE_RAFT_NAMESPACE`、`CANTILUNE_REQUIRE_RAFT=1`。
5. `resolveProductionDurable`：强制标志冲突 → Postgres URL（除非 `REQUIRE_RAFT`）→ Raft → file。`CANTILUNE_HOST_MODE=multi` 要求 Postgres URL **或** Raft。
6. 钉官方 etcd **v3.5.21**。运维套件 `deploy/etcd-raft`；安装器 `scripts/host/install-etcd.mjs`。
7. 耐久读写使用 etcd 默认 **linearizable**，不用 serializable 旧读。
8. etcd HTTP 走 worker + `Atomics.wait`，耐久端口保持同步。

## 依据

- Ongaro & Ousterhout，USENIX ATC 2014（Raft）
- Ongaro 博士论文，Stanford，2014
- Howard 等，*Raft Refloated*，2015
- etcd API guarantees：线性一致 KV、Txn CAS、Lease
- Kubernetes 控制面用 etcd；Cantilune 复用该生产共识实现

## 批准

**Architecture + Security**：Joker-of-Gotham（COI 已披露）  
**日期**：2026-08-16
