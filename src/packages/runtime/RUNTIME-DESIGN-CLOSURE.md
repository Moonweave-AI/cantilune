# @cantilune/runtime 设计闭包清单

> 对照 `diagrams/02-runtime/`（02A–02H）、ADR-0002、ADR-0003、`formal/Cantilune/Core/Execution.lean`、[`ENGINEERING-COVERAGE.md`](../core/tests/ENGINEERING-COVERAGE.md)

---

## 1. 证据强度（诚实声明）

| 含义      | 说明                                                             |
| --------- | ---------------------------------------------------------------- |
| ✅ 已闭包 | 代码 + 对应层测试成立                                            |
| ⚠️ 部分   | 分布式 DB 未做；ADR-0003 Request Changes 已 remediate，待 Accept |
| ❌ OPEN   | 刻意未做或外置包                                                 |

**结论（2026-08-10）：** M2 工程原型级纵向闭环已成立。**FileDurableCoordinator** + **FileResourceLockTable** 提供跨进程 CAS 与锁；76/76 Vitest。**M2 原型 Stop-Ship 已解除**；**ADR-0003 Accept**（reviewer: Joker-of-Gotham）。

---

## 2. 六层抽象（02H）闭包表

| 层           | 模块                                              | 状态 | 测试                                             |
| ------------ | ------------------------------------------------- | ---- | ------------------------------------------------ |
| L1 运行世界  | `engine/` · `ports/` · `schema/`                  | ✅   | typecheck + eslint + CI                          |
| L2 外部边界  | `observe/ingestObservation` + `RunHistoryTracker` | ✅   | `observe-boundary`, `observation-event-storm`    |
| L3 意图处置  | `admission/` · ticket registry                    | ✅   | `ticket-security`, `concurrent-admit-reconcile`  |
| L4 执行语义  | 六 handlers + revision registry                   | ✅   | `extended-operators`, `revision-replay`          |
| L5 持久轨迹  | memory + **file durable** + bundle                | ✅   | `cross-process-durable`, `durableBundle`         |
| L6 重放验证  | canonical replay + template revision              | ✅   | `cold-start-replay`, `replay-invariants`, `soak` |
| L7 规模/韧性 | batch + crash-restart + **worker parallel**       | ✅   | `tests/system/l7/*`                              |
| 横切 codec   | `wireValidation` unknown→DTO                      | ✅   | `wireValidation`, `codec-invalid`                |

---

## 3. Lean 理论映射（Execution.lean）

| 形式化             | 工程                          | 状态                             |
| ------------------ | ----------------------------- | -------------------------------- |
| `ReplayRecipe`     | wire + sidecar + bundle       | ✅                               |
| `Verified`         | `snapshotsCanonicallyEqual`   | ⚠️ 工程深等价，非形式化 Verified |
| Template revision  | registry `@revision` 精确匹配 | ✅                               |
| SignatureAdmission | control-plane stub            | ⚠️ stub                          |

---

## 4. OPEN（下一迭代）

| 项                                   | 落点                                  |
| ------------------------------------ | ------------------------------------- |
| 分布式 DB / 多副本 durable           | 未来 ADR（file durable 为单目录 CAS） |
| ADR-0003 Accept + 生产边界 Stop-Ship | ✅ M2 Accept；生产边界仍 Open         |
| `@cantilune/comms`                   | 外置 02G                              |

---

## 5. CORE-HANDOFF 退出条件

| #   | 条件                              | 状态              |
| --- | --------------------------------- | ----------------- |
| 1   | before + recipe → canonical after | ✅                |
| 2   | replay 不读 after                 | ✅                |
| 3   | strict codec + cold replay        | ✅                |
| 4   | L6–L7 测试矩阵                    | ✅ M2 范围        |
| 5   | pack consumer smoke               | ✅ `test:pack` CI |

# Epoch transition atomicity boundary (2026-08-13)

Static-schema wiring now requires an explicit authoritative epoch and rejects
arbitrary durable-head epochs. A caller may declare reviewed compatibility
aliases, but the runtime no longer treats an epoch string as proof that the
caller's compiled schema is the schema that created the world.

The in-process epoch path now validates and caches the target schema during
prepare, re-resolves and compares it before commit, and performs all detectable
head/binding/epoch/quiescence/schema checks before moving the durable head.
Recovery fails closed when the target schema is missing or has drifted. The
business commit/replay chain accepts only canonically verified observation
and/or epoch-only head advances, and resolver-backed replay selects the schema
binding for each historical epoch.

**QA-L5 Stop-Ship residual:** `MemoryEpochAdministration` still keeps its
prepared/committed receipt journal in process memory. With a file-backed
`DurableCoordinator`, a crash after the epoch-head CAS but before the in-memory
journal and holders are updated cannot be recovered from `admissionId` alone:
the durable snapshot records `epochId`, but not the admission id, schema ref,
or complete from-binding needed to reconstruct `RuntimeEpochReceipt`. Closing
this requires a durable epoch journal written in the same transaction as the
head, or a separately reviewed recovery protocol carrying authenticated
binding/request evidence. Until then, cross-process epoch-transition atomicity
and crash recovery are **unverified and not release-ready**; the passing
in-process and control-plane tests must not be cited as evidence for that claim.

# Content reference authority boundary (2026-08-13)

`CoordinationRuntime` now checks the post-apply artifact delta before durable
commit. Every newly created artifact, and every changed `contentRef`, must be
available from a synchronous `ContentRefAuthority`. Missing wiring, a negative
answer, or an authority exception returns `content_ref_unavailable` and leaves
the durable head unchanged. This check is intentionally below syscall so a
direct public-runtime caller cannot bypass it.

Observation ingest applies the same literal-true authority check to
`ObservationEntry.payloadRef` before its head CAS. A direct caller therefore cannot persist a
dangling audit reference that perception later presents as readable content.

The memory and file content stores implement the authority on the same object
used for reads and writes. The file implementation synchronously reads the blob
and metadata and re-hashes the bytes; async `exists()` is only a convenience
probe and is never treated as synchronous commit evidence. Boot and CLI wire
that exact store instance into runtime and syscall.
