# 工程设计体系测试覆盖矩阵

> 对照 `diagrams/00-naming-contract.md` §2–§3、`docs/adr/0002-core-engineering-boundaries.md`、`diagrams/02-runtime/`（02H 六层）。

## 图 01 四问（命名契约 §2）

| 问题                 | 工程对象                                  | 测试落点                                                                                         |
| -------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Q1 外部任务进入      | `ObservationEntry` → `introduce_artifact` | `integration/observation-vs-change`、`runtime/.../observation-event-storm`、`stress-mega-replay` |
| Q2 Actor 双视图      | `Participant` / `ActorRef`                | `unit/nodes/participant`、`contract/story-t0-to-delegate`                                        |
| Q3 协调事件链        | admit → commit → replay                   | `runtime/integration/story-t0-to-delegate`、`stress-mega-replay`、`loop-introduce-delegate`      |
| Q4 Change 无 payload | `CoordinationChange`                      | `types/brands`、`stress-codec-batch`                                                             |

## Core 三柱 + consistency

| 柱           | 模块                                    | 测试落点                                                    |
| ------------ | --------------------------------------- | ----------------------------------------------------------- |
| nodes        | workArtifact, capability, session, link | `unit/nodes/*`                                              |
| coordination | snapshot, change, validation, auditTail | `unit/coordination/*`、`consistency/*`                      |
| structure    | operators, isolation, trace, derive     | `unit/structure/*`、`stress-*`、`engineering-three-pillars` |
| consistency  | snapshotIntegrity, auditTail↔history    | `unit/consistency/*`、`contract/negative/audit-tail-sync`   |

## Runtime 六层（02H）

| 层            | 模块                                           | 测试落点                                       |
| ------------- | ---------------------------------------------- | ---------------------------------------------- |
| L1 foundation | brands, errors, eventKind                      | `unit/foundation/*`、`types/engineering-stack` |
| L2 admission  | gateway, footprintAuthority, compositionBridge | `unit/admission/*`、`admit-composition-path`   |
| L3 schema     | templates, conditionEvaluator                  | `unit/schema/*`                                |
| L4 execution  | apply, commit, handlers, replayKernel          | `replay-kernel-direct`、`delegate-round-robin` |
| L5 replay     | recipe, matchWitness, verifier                 | `unit/replay/*`、`stress-mega-replay`          |
| L6 observe    | ingestObservation                              | `unit/observe/*`、`observation-event-storm`    |
| 内存/codec    | store, changelog, codec                        | `stress-changelog`、`stress-codec-batch`       |

## STRESS 档位（CI）

| 常量            | Core                | Runtime                      |
| --------------- | ------------------- | ---------------------------- |
| Agent           | 100                 | 100                          |
| Task/Event      | 200 trace / 50 loop | 50 farm + 15 loop            |
| 隔离矩阵        | 4950 pairs          | —                            |
| Codec/Changelog | —                   | 100–200 batch                |
| L7 规模/韧性    | —                   | batch + crash-restart + soak |

## OPEN（诚实未闭包）

| 项                                     | 原因                                                         |
| -------------------------------------- | ------------------------------------------------------------ |
| core `story-t0-to-delegate`            | 仍用 `simulateCommit`；canonical E2E 在 `@cantilune/runtime` |
| matchWitness 持久化                    | recipe 内存有；Change wire 未强制写入 witness                |
| derive 结构投影                        | 仅 diagnostic summary，非调度投影                            |
| 外置 observability/control-plane/comms | 图 02G；非 runtime 包                                        |
