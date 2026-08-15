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

| 读角                   | Lens                | 单测                   | 集成/L7                     |
| ---------------------- | ------------------- | ---------------------- | --------------------------- |
| dependency             | `dependencyLens`    | linkFilters · lenses   | ultimate                    |
| resource               | `resourceLens`      | lenses                 | stress · ultimate           |
| communication          | `communicationLens` | lenses                 | stress · ultimate           |
| coordination-structure | `structureLens`     | lenses (nest/fork/box) | ultimate serial composition |

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

## OPEN（诚实未闭包）

| 项                              | 原因                                                                                        |
| ------------------------------- | ------------------------------------------------------------------------------------------- |
| `ProjectionCertificate` 形式化  | 归 `@cantilune/conformance`；observability 仅 `ReadModelDerivationEvidence`                 |
| `ObservationAccessContext`      | ADR-0005 推迟至生产读侧；M2–M3 为 trusted internal API                                      |
| L7 file durable / 冷启动 / 并发 | 需 runtime+observability 联合场景；当前 L7 为内存规模 smoke                                 |
| nest/fork runtime apply         | observability 只投影已 commit 事实；无 create_session handler 时长链仅含 introduce/delegate |
