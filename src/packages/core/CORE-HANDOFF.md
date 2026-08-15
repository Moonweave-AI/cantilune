# @cantilune/core 收尾清单

> 状态：**runtime 纵向闭环 + core bridge 已落地**（2026-08-10）  
> 权威边界：[ADR-0002](../../../docs/adr/0002-core-engineering-boundaries.md)  
> Runtime 闭包：[`../runtime/RUNTIME-DESIGN-CLOSURE.md`](../runtime/RUNTIME-DESIGN-CLOSURE.md)

## 已完成（core 职责内）

| 类别               | 内容                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| 三柱 + consistency | nodes · coordination · structure · consistency 四层导出              |
| 不变量 I1–I11      | Observation/Change 分离、无 payload、链/epoch、footprint、完整性校验 |
| 重放 recipe 基础   | `MatchBinding`、`templateRef`、`visibility` 必填                     |
| 测试               | L3–L5 纯 core；L6–L7 结构/derive stress                              |

## 与 @cantilune/runtime 分工

| 能力                          | core                            | runtime                |
| ----------------------------- | ------------------------------- | ---------------------- |
| 类型 + 纯校验                 | ✅                              | 消费                   |
| apply / admit / replay        | ❌                              | ✅                     |
| I12 独立重放                  | 声明 receipt                    | ✅ ReplayVerifier      |
| I6 auditTail ↔ history        | ✅ 纯函数                       | ✅ commit 路径调用     |
| story E2E                     | ⚠️ `simulateCommit` 遗留        | ✅ canonical + bridge  |
| CompositionIntent → admission | ⚠️ `toCoordinationIntent` lossy | ✅ `compositionBridge` |
| 共享 fixture                  | ✅ `@cantilune/test-fixtures`   | ✅ 同包                |

**canonical 编排故事测试：** `@cantilune/runtime` + `core/tests/integration/core-runtime-bridge`。

## runtime 退出条件

| #   | 条件                                            | 状态                            |
| --- | ----------------------------------------------- | ------------------------------- |
| 1   | before + admitted recipe → 唯一 canonical after | ✅                              |
| 2   | replay 不读 after 即可重算                      | ✅                              |
| 3   | 无效输入原子拒绝且不污染状态                    | ✅                              |
| 4   | story 经 runtime（非 simulateCommit）           | ✅ bridge + runtime integration |
| 5   | L6–L7 重新标注成立                              | ✅ runtime stress               |

## OPEN

| 项                                            | 落点                         |
| --------------------------------------------- | ---------------------------- |
| core contract story 删除 simulateCommit       | 保留 deprecated 至下一里程碑 |
| derive 结构投影                               | 新 ADR                       |
| `@cantilune/comms` / `@cantilune/conformance` | 外置 02G                     |
