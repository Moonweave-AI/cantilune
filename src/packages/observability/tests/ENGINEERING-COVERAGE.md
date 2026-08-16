# Observability 工程设计测试覆盖矩阵

> 对照 `diagrams/03-observability/`（03A–03H）、`diagrams/00-naming-contract.md` §7、ADR-0005。

## 03H 六层只读抽象

| 层   | 模块                              | 测试落点                                                       |
| ---- | --------------------------------- | -------------------------------------------------------------- |
| S0   | `world/` · `EventSpine`           | `unit/world/eventSpine`                                        |
| O1   | `input/` · `observationCut`       | `unit/input/assembleWorld` · `contract/negative/invalid-input` |
| O2   | `spine/deriveEventSlice` · lenses | `unit/spine/deriveEventSlice` · `unit/projection/lenses`       |
| O3   | `foldFourViews` · views           | `unit/spine/deriveEventSlice` · integration                    |
| O4   | `index/` · `engine/`              | `unit/index/observationIndex` · integration                    |
| O5   | `diagnostic/`                     | `unit/diagnostic/diagnosticSummary`                            |
| O6   | `ReadModelDerivationEvidence`     | `unit/certificate/readModelDerivationEvidence` · E4/E3 负向    |
| 横切 | `CrossViewInvariants` E1–E7       | `contract/negative/cross-view-invariants` · L7 闭包            |

## 四工程读角 lens

| 读角                   | Lens                | 单测                   | 集成/L7                              |
| ---------------------- | ------------------- | ---------------------- | ---------------------------------- |
| dependency             | `dependencyLens`    | linkFilters · lenses   | ultimate · file-durable observe-cut |
| resource               | `resourceLens`      | lenses                 | stress · ultimate · file-durable   |
| communication          | `communicationLens` | lenses (create_session) | stress · ultimate · file-durable  |
| coordination-structure | `structureLens`     | lenses (nest/fork/box) | ultimate · file-durable nest/fork  |

## STRESS / ULTIMATE 档位

| 常量                        | 值  | 对 runtime                   |
| --------------------------- | --- | ---------------------------- |
| `OBS_SCALE.stressCommits`   | 80  | stressFarm 50 + loop 15×2    |
| `OBS_SCALE.ultimateCommits` | 265 | runtime ultimateHarness 同链 |

## L2 / CI 门禁

| 项              | 落点                                                    |
| --------------- | ------------------------------------------------------- |
| dist exports    | `types/package-exports.test.ts`（build 后 import dist） |
| pack consumer   | `scripts/pack-consumer-smoke.mjs` · CI `test:pack`      |
| tests typecheck | `tsconfig.tests.json` · `pnpm typecheck`                |
| coverage        | `vitest.config.ts` thresholds · CI `test:coverage`      |

## 已闭包（本轮）

| 项                              | 落点                                                                                         |
| ------------------------------- | -------------------------------------------------------------------------------------------- |
| `ObservationAccessContext`      | 生产 SDK `requireAccessContext: true`；L7 file-durable observe-cut 带 context                |
| L7 file durable observe-cut     | `system/file-durable-observe-cut.test.ts`（file persistence + 同目录 reopen；缺 dist 失败） |
| nest/fork/create_session        | 生产 `diagnosticStepFromChange` + communication `createdSessionRefs`；L7 实 commit 投影     |

## OPEN（诚实未闭包）

| 项                             | 原因                                                                        |
| ------------------------------ | --------------------------------------------------------------------------- |
| `ProjectionCertificate` 形式化 | 归 `@cantilune/conformance`；observability 仅 `ReadModelDerivationEvidence` |
