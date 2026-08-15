# ADR-0014：与 head 原子同写的持久 epoch 日志

| 字段       | 值                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------------- |
| 状态       | **Proposed**（已请求 Owner 审查；解除 QA-0012 的 SS-02）                                                         |
| 创建时间   | 2026-08-14                                                                                                       |
| 更新时间   | 2026-08-14                                                                                                       |
| 决策 Owner | Joker-of-Gotham                                                                                                  |
| 实现 DRI   | Codex 实现团队                                                                                                   |
| 审查人     | 独立架构与安全审查待进行（QA-L5 出口门禁）                                                                       |
| 摘要       | 将 active schema epoch 绑定折叠进发布 head 的同一原子写，使得 head CAS 之后、holder/journal 更新之前的崩溃可恢复 |
| 权威来源   | 本 ADR                                                                                                           |
| 相关       | ADR-0006、ADR-0012（SS-02）、RFC-0001、`@cantilune/runtime`、`@cantilune/control-plane`、`@cantilune/boot`       |
| 取代       | 无（扩展 ADR-0006 §"cross-process recovery Stop-Ship"）                                                          |
| 被取代     | 无                                                                                                               |

## 背景

`MemoryEpochAdministration.commitEpochTransition`（位于 `src/packages/runtime/src/engine/memoryEpochAdministration.ts`）以一个有序序列提交一次 epoch 切换。临界区为：

```
line 607:  deps.durable.compareAndSwapHead(headRef, after)   ← DURABLE（原子，经由 withMutate）
            ═══ 崩溃窗口打开 ═══
line 611:  deps.schemaHolder.set(record.targetContext)       ← 内存中
line 612:  deps.bindingHolder.set(record.toBinding)          ← 内存中
lines 614-629: committed.set(admissionId, …)                 ← 内存中
            ═══ 崩溃窗口关闭 ═══
```

durable head CAS 通过 `FileDurableCoordinator.withMutate` 原子地发布新快照（带新的 `epochId`），后者经由 `atomicWriteFileSync`（临时文件 + fsync + rename + 目录 fsync）写入整个 `DurableWireBundle`。但该 bundle 只包含 `t0Ref`、`headRef`、`snapshots`、`changes`、`recipes`——它**不携带 `SchemaEpochBinding`、不携带 `schemaRef`、不携带 `admissionId`**。随后的 schema holder、binding holder 与 `committed` 回执日志都是内存中闭包。该窗口内的崩溃会丢失全部三者。

`recoverEpochTransition(admissionId)` 查询 `committed.get(admissionId)`——一个内存中 `Map`，崩溃后为空——并返回 `replay_mismatch`。重启时，boot 接线（`runtimeDependenciesWithStaticSchema`）从一个静态默认 schema 与 `BOOT_EPOCH_ID` 重建 schema context；head 的 epoch 现在是新 epoch，不匹配，故 runtime 拒绝启动。control-plane 侧已持久化一个 durable binding（`FileControlPlaneStore.casActiveBindingDurable` + `commitReceipts`），但 runtime 恢复路径并不查询它。

这就是 `docs/qa/0012-agent-execution-continuity-qa.md` 的 SS-02：durable head CAS 与内存中 holder/journal 更新之间精确边界上的跨进程崩溃不可恢复。

## 决策

Owner 选择 **"扩展 DurableWireBundle 原子同写"**：使 active schema epoch 绑定成为发布新 head 的同一原子持久事务的一部分。崩溃窗口消失，因为磁盘上的 bundle 始终携带与 head 匹配的绑定；恢复读取 bundle 并重建 holder，无需内存中日志或 control-plane store。

本决策将恢复路径保持在 runtime 持久层内自包含，不引入跨包的 runtime→control-plane 恢复依赖（被否决的备选方案）。它不复制 control-plane 自身的 durable binding：control-plane binding 仍是 admission 权威；runtime bundle 的 binding 是 runtime 的 active-context 恢复记录。ADR-0006 的 M3 进程内范围不变；仅解除跨进程恢复 Stop-Ship。

### 1. 以 active binding 字段扩展持久 bundle

为 `DurableWireBundle` 增加一个可选的 `schemaBinding` 字段：

- 该字段携带 **active** `SchemaEpochBinding`（最后提交的 epoch 转换的 `toBinding`，或种子世界的初始 binding）。
- 它是一个镜像 `SchemaEpochBinding` 形状的 wire DTO——所有字段都是原始字符串，因此除了严格字段校验外不需要结构化编解码器（复用 `@cantilune/runtime` 已导出的 `snapshotSchemaEpochBinding` snapshot/validate 模式）。
- 该字段 **可选以保证向后兼容**：缺少该字段的 bundle 是 legacy/pre-SS-02 bundle。导入时，仅当 boot 接线提供一个显式静态 schema（现有路径）时，缺失的 `schemaBinding` 才被容忍；新的恢复路径要求字段存在并与 head 的 epoch 匹配。这在首次加载时不破坏现有世界的同时保持前向完整性。

### 2. 以原子 head+binding CAS 扩展持久协调器

为 `DurableCoordinator` 端口增加 `compareAndSwapHeadWithBinding(expected, snapshot, binding)`：

- 对于 `MemoryDurableCoordinator`，它在一个逻辑操作中执行 head CAS 并将 binding 存入协调器持有的 active-binding 槽。
- 对于 `FileDurableCoordinator`，它在 `withMutate` 内运行，使 head CAS **与** binding 更新在同一个 `writeBundleAtomic` 调用中发布。写入磁盘的 bundle 同时携带新的 `headRef` 与新的 `schemaBinding`，要么两者都写，要么都不写。
- 普通 `compareAndSwapHead`（用于 observation ingest 及所有非 epoch 的 head 移动）不改变 active binding——observation 不改变 schema epoch。

### 3. 原子地提交 epoch 转换

`commitEpochTransition` 以一次原子调用取代分裂序列：

```
deps.durable.compareAndSwapHeadWithBinding(headRef, after, record.toBinding)
  ← durable：head + binding 一起发布（或都不发布）
deps.schemaHolder.set(record.targetContext)
deps.bindingHolder.set(record.toBinding)
committed.set(admissionId, …)
```

内存中 holder/journal 更新仍在其后，但它们现在是 durable state 的 **收敛重建**，而非真理之源。durable CAS 之后、holder/journal 更新之前的崩溃无害：bundle 已有 binding；holder 可从其重建。

### 4. 从 bundle 恢复

`recoverEpochTransition(admissionId)` 增加一个回退：当内存中 `committed` 日志为空（崩溃后），它从持久协调器读取 active binding，对照 head 的 epoch 校验，解析并校验目标 schema，重建 holder。control-plane 的 `recoverForwardCommit` 路径（它调用 `recoverEpochTransition(admissionId)`）现可跨进程成功，因为 binding 是 durable 的。

### 5. 重启时重建 schema context

boot 接线增加一个 bundle 源 binding 路径。当持久 bundle 携带 active `schemaBinding` 时，boot 层从其重建 `ActiveSchemaContext`，而非强制使用静态默认 schema。对于没有 binding 的世界（legacy 或显式静态），现有静态 schema 路径保留。`runtimeDependenciesWithStaticSchema` 的不变量——绝不从 epoch 字符串单独推断 schema 身份——得到保持：binding 是一个完整的 `SchemaEpochBinding`，含 `schemaRef`/`admissionId`/`activatedBy`，而非裸 epoch 名。

## 关键不变量

1. 磁盘上的 bundle 始终携带与其 head 匹配的 binding。读者绝不会观察到 epoch 无 binding 的 head。
2. head 与 binding 在一次原子写中发布（temp + fsync + rename + 目录 fsync）。崩溃后要么留下旧 head+旧 binding，要么留下新 head+新 binding，绝不出现不匹配。
3. 内存中 holder 与 `committed` 日志是 durable state 的重建，不是独立权威。崩溃丢失它们可从 bundle 恢复。
4. runtime 恢复路径自包含：不依赖 control-plane store。control-plane binding 仍是 admission 权威；bundle binding 是 runtime active-context 记录。
5. 没有 `schemaBinding` 字段的 legacy bundle 仅可通过现有显式静态 schema 路径在导入时被容忍；新恢复要求该字段存在。

## 考虑过的备选方案

| 备选方案                                       | 处置 | 原因                                                                                        |
| ---------------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| runtime 恢复读取 control-plane durable binding | 否决 | 引入 runtime→control-plane 跨包恢复依赖与排序问题；所选路径使恢复在 runtime bundle 内自包含 |
| bundle + control-plane 交叉校验                | 否决 | 工作量最大且双一致性测试面；自包含 bundle 已闭合该窗口                                      |
| 保留内存中日志，增加周期性 checkpoint          | 否决 | 周期性 checkpoint 在 CAS 与下一个 checkpoint 之间仍有崩溃窗口；不闭合边界                   |
| 让 `done`/observation ingest 也携带 binding    | 否决 | observation 不改变 schema epoch；在每次 head 移动上携带 binding 既浪费又模糊 epoch 边界     |

## 后果

### 正面

- durable head CAS 之后的跨进程崩溃窗口已闭合；SS-02 被解除。
- `recoverEpochTransition` 仅从 durable state 即可跨进程成功。
- boot 层不再拒绝重启 head 已推进到新 epoch 的世界。
- runtime 持久层仍是唯一恢复权威——无新跨包依赖。

### 负面

- `DurableWireBundle` wire 格式增加一个字段；严格编解码器须在导入时校验。缺少该字段的 legacy bundle 在首次加载时需显式静态 schema 路径（无自动重标，保持 ADR-0012 §4）。
- `DurableCoordinator` 增加一个方法；`MemoryDurableCoordinator` 增加一个 active-binding 槽，须在入口处快照。
- 须在精确 CAS/binding 边界处新增一个真实跨进程崩溃测试（无 mock 信号注入）以解除门禁。

## 迁移与验证

1. 以可选且经校验的 `schemaBinding` 字段扩展 `DurableWireBundle` + `importDurableBundle`/`exportDurableBundle`；容忍 legacy 缺失。
2. 在 `DurableCoordinator` 端口、`MemoryDurableCoordinator`、`FileDurableCoordinator`（后者在 `withMutate` 内）增加 `compareAndSwapHeadWithBinding`。
3. 重写 `commitEpochTransition` 使用原子 head+binding CAS；保留内存中 holder/journal 更新作为收敛重建。
4. 为 `recoverEpochTransition` 增加 bundle 源恢复回退。
5. 在 boot 接线中增加 bundle 源 binding 重建路径；为 legacy/无 binding 世界保留静态 schema 路径。
6. 增加一个真实跨进程崩溃测试：子进程提交 epoch 转换（推进 head 与 binding）并在 durable CAS 之后立即被 kill；新进程加载 bundle 并确认 holder 从 durable binding 重建且 runtime 在新 epoch 下启动。
7. 运行受影响包的单元、集成、契约、系统、lint、format 与类型检查；达到 ≥90/88 覆盖率门禁。

## 批准

**Owner 设计批准**：Joker-of-Gotham —— 2026-08-14（设计已批准；实现已落地并变绿）
**DRI 签名**：Joker-of-Gotham —— 2026-08-14
**日期**：2026-08-14
**决策引用**：QA-0012 SS-02、ADR-0006 §"cross-process recovery Stop-Ship"、ADR-0012 §6
**状态**：Proposed。Acceptance 另需独立架构 + 安全评审人签署（QA-L5 出口语门禁）。Owner 即 DRI（COI）；独立评审须由非 DRI 外部评审人签署。
