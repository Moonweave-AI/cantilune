# @cantilune/core

Cantilune 语义内核：三柱架构 + consistency 层。

- **nodes** — 协作网实体（Participant、WorkArtifact、Link…）
- **coordination** — 协作世界（CollaborationSnapshot）、协调变更（CoordinationChange）、外部观察（auditTail）
- **structure** — Agent 组合原语（operators）与隔离 / 历史 / 诊断派生
- **consistency** — 跨柱校验（auditTail↔history、snapshot 完整性）

Agent 通过 `CompositionIntent` 在运行时改拓扑；静态结构从 Snapshot + RunHistory 派生，而非预置死图。

> **发布状态：** `"private": true` — 见 [CORE-HANDOFF.md](./CORE-HANDOFF.md) 与 ADR-0002。在 runtime replay 闭包前不公开发布。

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
pnpm --filter @cantilune/core test:system        # L6–L7（当前不成立，见 DESIGN-CLOSURE）
pnpm --filter @cantilune/core test:types         # L2 补充
pnpm --filter @cantilune/core test:coverage
```
