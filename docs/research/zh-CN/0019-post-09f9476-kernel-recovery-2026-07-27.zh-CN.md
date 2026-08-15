# 后 `09f9476` 内核恢复 — 2026-07-27

状态：已验证可变树恢复；Pre-FCP  
治理：S2 / QA-L4 目标 / M1  
分支：`codex/theory-foundation`  
被审计 HEAD：`09f9476846a54cea3fa7b97a970ec599d1d4c96d`

## 决策

早先关于全部十个 FCP 门已完成的报告予以撤回。
提交 `90e9eba`、`b164408` 与 `36bdddd` 不含被跟踪的 `formal/`
源码。提交 `09f9476` 仅含十个新增的 Gate 5/7 文件，且不包含
可复现的完整 Lean 工程。这些新文件在其完成报告撰写之前尚未被
编译过。

当前可变树现已被修复，并由被钉定的 Lean kernel 实际检查过。
这确立了有用的实现证据，但并不满足不可变溯源、独立
QA-L4 评审、完整 FMS 语义桥或严格完成门。

## 不可变审计发现

- 在 `b164408` 处所声称的 Gate 4 绑定无法绑定 P1b Lean 源，因为
  该提交不含任何此类源。
- 原始 `P1cMultiState/Matrix.lean` 不可编译，且编码的是状态
  标签而非 3,600 条原生操作证明。
- 原始 `P1cMultiState/Reflection.lean` 使用了一个无约束的变迁
  记录并断言了虚假的任意满射性。
- 原始 `PowerdomainUnseparated` 文件不可编译，包含显式
  占位符/公设，混用了不兼容的载体，并包含对非空 Hoare 载体的
  虚假严格 bottom Fubini 声称。
- DRI 自指派不构成独立 QA-L4 评审。
- `formal/proof-obligations.json` 仍是权威状态账本：
  11 项 `implemented_unverified`，7 项 `partial_scaffold`，0 项 `proved`，
  0 项 `reviewed`。

## P1c 恢复

修复后的 P1c 参考层现：

- 提供一个 proof-carrying 的全索引 `Fin 60 -> P1cOperation`；
- 定义一个全 `Fin 60 x Fin 60` 表；
- 在其假设证成独立性处证明实际的 guarded 独立性引理；
- 为每个表位置证明 `matrix_cell_protocol_completion`；
- 定义一个全态射到进程语法翻译；
- 仅对 `InTranslationImage` 证明精确 round-trip；并
- 移除每个任意 π 变迁都是某个态射重写之像的虚假声称。

最强诚实陈述是一个通用 request/acknowledge/complete
协议与一个语法翻译像对应。它不是 3,600 条
原生 late-pi 归约、逐单元交换、DPO reflection 或
生产 P1c 包的证明。另行存在的
`P1cFullNativeRefinement.certificate` 仍是更强的原生 15-family
候选，并保持 `implemented_unverified`。

## 未分离幂域恢复

损坏的非空 Hoare 草稿已被移除。修复后的立面复用
已构造的 all-omega-CPO lower omega-Scott 闭集线：

- 空闭集作为 bottom，因而 effect 层
  `divergence = deadlock = bottom`；
- 一个连续 choice 操作；
- 逐点 power 函子、unit、multiplication、bind 与单子律；
- 连续 Fubini naturality、unit/principal 律、对称性、结合性，
  以及已有的 chosen-product strong commutative monad 包；并
- 对已实现的 `ActualAgentFunctor` 的一个具体
  continuous-natural 解、初始代数、终余代数与
  代数紧致性见证。

这是一个未分离 lower omega-Scott endofunctor 的真实构造。
它不是分离 divergence/deadlock 的 Abramsky 幂域，也不是
每个局部连续 endofunctor 的一般代数紧致性定理。

`AdequacyPackage`、`FullAbstractionPackage` 与 `DefinabilityPackage` 是
proof-carrying 接口。其导出定理一旦某个具体语言
提供其字段即有效，但未构造任何原生标准 late-pi 居民。因此 adequacy、
definability 与完全抽象仍然开放，且 `CENTRAL-12` 仍为
`partial_scaffold`。

## 实际执行的可复现检查

从 `formal/`，使用 `leanprover/lean4:v4.32.0`：

```powershell
lake build Cantilune.Pi.P1cMultiState
lake build Cantilune.Tests.P1cMultiState `
  Cantilune.Tests.PowerdomainUnseparated Cantilune.Pi
powershell -ExecutionPolicy Bypass -File .\scripts\ci.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\ci.ps1 -RequireComplete
```

观察到的常规 CI 结果：

- 485 个工程 Lean 源；
- 源聚合
  `c21eb3dccf06d3c431d49592d6a0ef433cc5fc474b571d0863f6db176445a1f4`；
- 零整词 `sorry`、`admit`、`axiom` 或 `unsafe`；
- 根构建成功：9,139 个 job；
- 1,377 个已审计声明；
- 依赖允许清单中仅有 `propext`、`Classical.choice` 与
  `Quot.sound`；并
- 常规证据门退出码 0。

观察到的严格完成结果：预期退出码 1。18 项
中心义务中的每一项仍低于 `reviewed`。

成功运行仅作为可变树的证据。它未绑定到
干净的不可变候选提交，也不是独立评审。

## 剩余承重义务

1. 构造一个具体原生 late-pi adequacy 包及相关的
   definability/full-abstraction 居民，或通过 RFC/FCP 正式变更 Gate 7
   范围。
2. 在一个精确不可变源快照上证明或评审更强的原生 P1c
   证书；修复后的 `P1cMultiState` 立面不是替代品。
3. 创建一个干净的 proof-sensitive 候选提交，包含完整
   formal 树、工具链、依赖锁、source-integrity 记录、审计
   清单与 manifest。
4. 将每个晋级的中心符号绑定到该提交与一条构建证据
   记录。
5. 获得三项独立非作者 QA-L4 评审，包括 Lean kernel
   假设与进程语义评审。
6. 在开启 FCP 前对齐 RFC-0002、ADR-0001、英文/中文
   规范与所有 FCP 报告。
7. 保持产品符合性分离：八个规划中的包仍无
   规则清单或包拥有的 rank、pre-net、resource、
   authorization、fairness、stable-window 或 positive-epsilon 事实。

## 控制性结论

修复后的可变树可被 kernel 构建且无禁用 Lean
占位符。早先的 Gate 5/7 完成报告不是有效证据。
Cantilune 仍为 Pre-FCP：严格证明 manifest、不可变溯源、
具体 native-pi FMS 语义定理与独立 QA-L4 评审未
闭合。
