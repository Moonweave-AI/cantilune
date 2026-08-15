# @cantilune/observability 测试目录

`src/` 仅含生产代码；全部可执行测试在本目录。

## 七层落位

| 层  | 目录                      | 说明                                                 |
| --- | ------------------------- | ---------------------------------------------------- |
| L1  | 仓库根 `pnpm test:static` | 静态门禁                                             |
| L2  | `types/`                  | export / 03H 六层模块栈                              |
| L3  | `unit/`                   | foundation · input · spine · projection · invariants |
| L4  | `integration/`            | runtime T0→delegate → FourViewBundle                 |
| L5  | `contract/negative/`      | E1–E7 负向 · invalid_input                           |
| L6  | —                         | （与 L7 合并：系统级四视图闭包）                     |
| L7  | `system/complex/`         | stress 80 commits · ultimate 265 commits             |

## L7 复杂场景

| 文件                    | 规模                         | 验证点                                    |
| ----------------------- | ---------------------------- | ----------------------------------------- |
| `stress-mega-four-view` | 50 farm + 15 loop + 50 obs   | 80 commits · E1–E7 · 四 View byEvent 齐   |
| `ultimate-closure`      | runtime ultimate 265 commits | 全链 fold · cross-view · diagnostic stats |

## Harness

- `support/scenario/observabilityHarness.ts` — `observeCommittedExplicit` / runtime ports
- `support/scenario/largeWorld.ts` — `OBS_SCALE` 档位常量
- `support/assertions/violations.ts` — `ReadOnlyViolation` 断言

覆盖矩阵：[`ENGINEERING-COVERAGE.md`](./ENGINEERING-COVERAGE.md)
