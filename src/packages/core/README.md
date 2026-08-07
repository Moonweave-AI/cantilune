# @cantilune/core

Cantilune 语义内核：三柱架构。

- **nodes** — 协作网实体（Participant、WorkArtifact、Link…）
- **coordination** — 协调世界（CollaborationSnapshot）、协调事件（CoordinationChange）、外部观察（auditTail）
- **structure** — Agent 组合原语（operators）与隔离 / 历史 / 派生视图（derive）

Agent 通过 `CompositionIntent` 在运行时改拓扑；静态结构从 Snapshot + RunHistory 派生，而非预置死图。

## 开发

```bash
pnpm install
pnpm --filter @cantilune/core typecheck
pnpm --filter @cantilune/core test
pnpm --filter @cantilune/core build
```

## 测试

生产代码在 `src/`；全部测试在 `tests/`（见 `tests/README.md`）。

```bash
pnpm --filter @cantilune/core test:unit          # L3
pnpm --filter @cantilune/core test:integration   # L4
pnpm --filter @cantilune/core test:contract      # L5
pnpm --filter @cantilune/core test:system        # L6–L7
pnpm --filter @cantilune/core test:types         # L2
```
