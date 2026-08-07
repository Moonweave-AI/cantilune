# @cantilune/core 测试目录

`src/` 仅含生产代码；全部可执行测试在本目录。

## 七层落位

| 层 | 目录 | 说明 |
|---|---|---|
| L2 | `types/` | 编译期 brand / export 契约 |
| L3 | `unit/` | 单元测试，镜像 `src/` 四目录 |
| L4 | `integration/` | 跨三柱数据流 |
| L5 | `contract/` | 对照 naming-contract；含 `contract/negative/` 负向 |
| L6 | `system/` | 包内 E2E、重放不变量 |
| L7 | `system/complex/` | 并行/嵌套、多 scope history |
| — | `support/` | fixture / assert / harness（非用例） |

L1（Lint / Format）在仓库根工具链，不在此目录。

## 命令

```bash
pnpm --filter @cantilune/core test              # L2–L7 全量
pnpm --filter @cantilune/core test:types        # L2
pnpm --filter @cantilune/core test:unit         # L3
pnpm --filter @cantilune/core test:integration  # L4
pnpm --filter @cantilune/core test:contract     # L5（含 negative）
pnpm --filter @cantilune/core test:system       # L6–L7
```

设计闭包与 OPEN 项见 [`DESIGN-CLOSURE.md`](./DESIGN-CLOSURE.md)。

## import 约定

- `unit/`：`../../../src/...` 精确定位
- `integration/` / `contract/` / `system/`：`../../src/...` 或 `@cantilune/core`
- `support/`：相对路径指向 `src/`（注意目录深度）

## 文件分布

| 目录 | 文件数 |
|---|---|
| `types/` | 2 |
| `unit/primitives/` | 4 |
| `unit/nodes/` | 8 |
| `unit/coordination/` | 4 |
| `unit/structure/` | 6 |
| `integration/` | 3 |
| `contract/` | 2 + `negative/` 5 |
| `system/` | 2 |
| `system/complex/` | 3 |
