# @cantilune/core 测试目录

`src/` 仅含生产代码；全部可执行测试在本目录。

## 七层落位（诚实声明）

| 层  | 目录                        | 当前状态                                                      |
| --- | --------------------------- | ------------------------------------------------------------- |
| L2  | `types/` + `pnpm typecheck` | typecheck 含 `tsc`；Vitest types 为补充                       |
| L3  | `unit/`                     | **成立**                                                      |
| L4  | `integration/`              | **部分** — 窄跨柱流                                           |
| L5  | `contract/` + `negative/`   | **成立**                                                      |
| L6  | `system/`                   | **成立** — 大规模 history/derive（`simulateCommit` 非 L6 证据） |
| L7  | `system/complex/`           | **成立** — 30~50 规模隔离矩阵、nest/fork 树、循环编排 harness |

L7 复杂场景（core）：

| 文件                             | 规模                      | 验证点                                    |
| -------------------------------- | ------------------------- | ----------------------------------------- |
| `isolation-matrix`               | 10 / 30 fork 分支         | 两两 `compatibleConcurrently`             |
| `nest-fork-tree`                 | 30 分支 + 15 nest 对      | 并行 fork 与不相交 nest 层                |
| `large-history-slicing`          | 10 / 50 task              | `sliceRunHistory` 每 scope 一段           |
| `loop-orchestration`             | 10×8 / 20×12 轮           | introduce→delegate 循环 + 链/epoch/derive |
| `large-derive-serial`            | 50 change                 | 大图 serial diagnostic                    |
| `composition-intent-scale`       | 30+ intent                | `toCoordinationIntent` 映射               |
| `composition-operators-boundary` | 7×30 operators            | interface+goal+footprint                  |
| `engineering-three-pillars`      | 100×50                    | 三柱 + consistency 闭包                   |
| **STRESS**                       |                           |                                           |
| `stress-isolation-matrix`        | **100** fork (4950 pairs) |                                           |
| `stress-history-validation`      | **200** mixed trace       |                                           |
| `stress-loop-orchestration`      | **50×100**                |                                           |

工程设计覆盖矩阵：[`ENGINEERING-COVERAGE.md`](./ENGINEERING-COVERAGE.md)

## 命令

```bash
pnpm --filter @cantilune/core typecheck   # tsc 生产 + 测试
pnpm --filter @cantilune/core test        # L2–L7 Vitest
pnpm --filter @cantilune/core test:coverage
pnpm --filter @cantilune/core build
```

设计闭包见 [`DESIGN-CLOSURE.md`](./DESIGN-CLOSURE.md) 与 [`docs/adr/0002-core-engineering-boundaries.md`](../../../../docs/adr/0002-core-engineering-boundaries.md)。

## import 约定

- 生产校验：`validateAuditTailMatchesHistory` 从 `src/consistency/index.js` 导入
- 测试 Change 构造：优先 `support/fixtures/change-fixture.ts`（提供默认 visibility）
- Canonical delegate：`support/fixtures/standard-story/delegate-change.ts`（含 authorization + matchBindings）
