# @cantilune/runtime 测试目录

`src/` 仅含生产代码；全部可执行测试在本目录。

## 七层落位

| 层  | 目录                                              | 说明                                                                |
| --- | ------------------------------------------------- | ------------------------------------------------------------------- |
| L1  | 仓库根 `pnpm lint` / `format:check` / `typecheck` | 静态门禁                                                            |
| L2  | `types/`                                          | 编译期 export / brand 契约                                          |
| L3  | `unit/`                                           | admission · observe · codec · memory · schema · replay · foundation |
| L4  | `integration/`                                    | 跨模块：observe 边界、story 全链路                                  |
| L5  | `contract/` + `negative/`                         | 准入拒绝、replay 链断裂                                             |
| L6  | `system/`                                         | runtime replay 不变量（真 apply/replay）                            |
| L7  | `system/complex/`                                 | 大规模串行/并发/循环 + 真 runtime replay 闭包                       |

L7 复杂场景（runtime，真 admit/commit/replay）：

| 文件                         | 规模                     | 验证点                                  |
| ---------------------------- | ------------------------ | --------------------------------------- |
| `serial-introduce-farm`      | 15 task                  | 串行 introduce + 全链 replay            |
| `concurrent-admit-reconcile` | 2 路 disjoint admit      | 并发 admit、stale commit 拒绝、re-admit |
| `delegate-round-robin`       | 5 hop × 12 agent         | 单 task 多轮 delegate                   |
| `loop-introduce-delegate`    | 8 轮 × 12 agent          | 循环 introduce+delegate + replay        |
| `large-replay-closure`       | 6 farm + 4 loop + 20 obs | 组合场景 T0 重放                        |
| `observation-event-storm`    | 20 obs                   | auditTail 风暴                          |
| `lock-contention`            | 重叠 admit               | resource_conflict                       |
| **STRESS**                   |                          |                                         |
| `stress-serial-farm`         | **50** / 100 agent       |                                         |
| `stress-mega-replay`         | 50+15×2 + 50 obs         |                                         |
| `stress-codec-batch`         | **100**                  |                                         |
| `stress-changelog`           | **200**                  |                                         |
| **工程设计**                 |                          |                                         |
| `replay-kernel-direct`       | ReplayKernel             |                                         |
| `admit-composition-path`     | Composition 路由         |                                         |
| `policy-deny`                | policy 负向              |                                         |
| `types/engineering-stack`    | 02H 六层 export          |                                         |

覆盖矩阵：[`ENGINEERING-COVERAGE.md`](../core/tests/ENGINEERING-COVERAGE.md)

## 命令

```bash
pnpm --filter @cantilune/runtime typecheck
pnpm --filter @cantilune/runtime test
pnpm --filter @cantilune/runtime test:types
pnpm --filter @cantilune/runtime test:unit
pnpm --filter @cantilune/runtime test:integration
pnpm --filter @cantilune/runtime test:contract
pnpm --filter @cantilune/runtime test:system
pnpm --filter @cantilune/runtime test:coverage
```

仓库级 L1：`pnpm test:static`（lint + format + typecheck）

## import 约定

- `unit/`：`../../../src/...`
- `integration/` / `contract/` / `system/`：优先 `@cantilune/runtime` / `@cantilune/core`
- 共享构造：`support/buildTestRuntime.ts`
