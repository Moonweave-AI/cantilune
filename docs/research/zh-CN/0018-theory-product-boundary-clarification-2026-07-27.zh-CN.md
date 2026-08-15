# 理论—产品边界澄清 — 2026-07-27

状态：分析 / 边界修正  
治理：S2 / QA-L4 / M1  
DRI：Joker-of-Gotham

## 执行摘要

**已识别问题：** 八个产品包（Cantilune、Cantilune Notation、Libretto、Cast、Baton、Cue、Chorus、Reprise）错误地阻断了核心理论 FCP 完成。当前理论义务要求"所有产品都提供证书"，这混淆了两个不同的门：

1. **核心理论 FCP** — 抽象元定理、通用接口、参考见证
2. **产品符合性** — 具体包实例化、运行时事实、授权策略

**根本原因：** 当前 RFC-0002 与 ADR-0001 接受标准将抽象理论完成与具体产品实例化混同，制造了一个虚假依赖，使理论在所有八个产品包连同其运行时证据存在之前无法闭合。

**正确边界：** 理论证明通用证书接口是_可满足的_（通过参考见证）。产品稍后用具体操作事实实例化这些接口。理论 FCP 不应阻塞于产品存在。

## 当前状态分析

### 今日阻断核心理论 FCP 的事项

来自 RFC-0002 §11 跟踪表与研究审计 0008：

| 阻断项                 | 当前状态                                     | 性质         |
| ---------------------- | -------------------------------------------- | ------------ |
| P1a DAG/Petri 规则映射 | 通用操作族存在；无生产规则清单               | **产品特定** |
| P1b FMS 完整居民       | 有限片段存在；完整 Abramsky 幂域缺失         | **理论缺口** |
| P1c 通用 admitted 规则 | 60/60 参考矩阵完成；无产品 `Config` 规则     | **产品特定** |
| 八个包证书             | 无包源码树、清单或规则清单存在               | **产品特定** |
| DAG rank 保持          | 通用 rankable-DAG 定理存在；无产品 rank 函数 | **产品特定** |
| Petri pre-net 语义     | 通用 pre-net 构造存在；无产品 firing 映射    | **产品特定** |
| 资源/会话策略          | 通用资源层存在；无产品策略                   | **产品特定** |
| 授权谓词               | 通用授权门存在；无产品谓词                   | **产品特定** |
| 公平性/稳定窗口        | 通用调度器定理存在；无产品窗口               | **产品特定** |
| 正-ε 进展              | 通用内核界存在；无产品 ε 值                  | **产品特定** |

**分析：** 10 个阻断项中的 8 个是产品特定的实例化缺口，而非理论缺口。唯一真正的理论缺口是完整 FMS 幂域/完全抽象包。

### 混淆源自何处

**RFC-0002 §3.1 证明状态表**陈述：

> "DAG：[...] 预期的静态目标证书不完整 [...] 任意 typed-DPO 映射缺失"  
> "Petri：[...] 预期的静态目标不完整 [...] 通用规则到 firing 映射缺失"

该措辞混淆了：

- **通用定理**："每个可 rank 图都有一个严格 DAG 视图"（理论，完成）
- **产品事实**："Libretto 包中的规则 R₇ 保持 rank"（产品，缺失）

**RFC-0002 §4.3 P1c 工作**要求：

> "将闭合有限多状态 P1c 参考协议提升至全部 15 个 admitted 非 fixture `Config` 出现，连同产品资源、静止、admission 与静态层"

这混同了：

- **参考见证**：mismatch/reconnect/delete 有四视图证书（理论，完成）
- **产品规则**：Baton、Cue 等包提供其规则清单（产品，缺失）

**研究日志 0008 产品包审计**结论：

> "当前仓库无法实例化任何生产包 `ProductRuleProofBundle`。八个包名均为规划中的分发，而其包源码树、清单、产品规则与包拥有的证明输入尚不存在。"

审计发现**包不存在**，而理论 FCP 却阻塞于它们的证书。

## 正确边界定义

### 核心理论 FCP 范围（应独立闭合）

核心理论证明投影一致性的**抽象条件**与**通用接口**。它确立：

1. **元定理**（对满足输入的全称量化）：
   - "对每个可 rank 的类型化图 G，存在一个严格 DAG 投影"
   - "对每个带有公平性证据的执行包，期望命中 ≤ H/ε"
   - "对每个共享一个源的四投影族，跨视图事件一致"

2. **通用证书接口**（具有良定义语义的类型）：
   - `ProjectionCertificate`：soundness、reflection、terminal 保持
   - `ProductRuleProofBundle`：静态/操作/资源/admission 层
   - `ExecutionPackage`：原生步、重放、epoch、概率 kernel

3. **参考见证**（非空洞性证明）：
   - 60/60 P1c 参考矩阵，含全部四投影
   - mismatch/reconnect/delete 带可执行图更新
   - 有限异构运行时带 admission 跨越

4. **反例**（边界澄清）：
   - 无限制 slice ≠ 位置性 DPOI（有限 boundary-duplicate 反例）
   - 离散 finite power ≠ FMS 幂域（无连续单例 unit）
   - 两态协议 ≠ 完整 late reflection（存在环境变迁）

### 属于核心理论的内容（抽象）

**静态层：**

- FreeSMC 商与任意目标泛性质 ✓（kernel-built）
- 类型化位置性 DPOI 等价与精确 essential image ✓（kernel-built）
- 通用 pre-net/free-SSMC 声明序构造 ✓（kernel-built）
- 类型化 open-process SMC 呈现 ✓（kernel-built）

**操作层：**

- 通用 `ProjectionFamily`，按有限签名索引 ✓（kernel-built）
- 从所供 LTS 同构复用的操作证书构造子 ✓（kernel-built）
- P1c 60/60 参考矩阵，带四个独立原生推导 ✓（kernel-built）
- P1b request/accept 未过滤结构 strong-late 证书 ✓（implemented_unverified）

**随机层：**

- 通用 Ionescu–Tulcea 轨迹构造子 ✓（kernel-built）
- 带 DPO 重放的 event-labelled 耦合 ✓（kernel-built）
- 有限异构 `EpochChain` 带 admission 边界 ✓（kernel-built）
- 从所供公平性/ε 的期望命中界 ✓（kernel-built）

**指称层（真正缺口）：**

- 所有 ωCPO 上的完整 FMS 幂域 ✗（缺失；仅有限片段）
- 递归 agent domain 解 A ≅ P(H A) ✗（未分离不动点存在；完整包缺失）
- Agent restriction/hiding 与 coherence ✗（支持层收缩存在；agent 操作缺失）
- strong-late 完全抽象 ✗（条件接口存在；无居民）

### 属于产品的内容（具体）

**产品符合性门**（後續門，独立于理论 FCP）：

每个产品包（Cantilune、Libretto、Cast 等）提供：

1. **包清单与规则清单**：
   - `packages/cantilune/cantilune.yaml`（包元数据）
   - `packages/cantilune/rules/`（可枚举规则集）
   - 包 owner 与符合性联系人

2. **逐规则证书**（实例化通用接口）：
   - 每个规则的 `dag_certificate: ProductRuleProofBundle`
   - rank 函数与 rank 保持证明
   - pre-net token 语义与 firing 推导
   - π 原生推导（以理论 P1c 参考为模板）
   - 态射视图（通常为 identity 或直接组合）

3. **运行时操作事实**（无法从规则名推断）：
   - 资源/会话策略（例如"context window ≤ 200k tokens"）
   - 删除/静止谓词
   - 授权谓词（例如"部署需人工批准"）
   - 冲突解决策略

4. **随机证据**（逐包执行特征）：
   - 公平性/稳定窗口定义
   - 正-ε 进展界
   - opportunity-epoch 对齐策略
   - 生产 Markov kernel 构造

## 应移除的不正确依赖

### 来自 RFC-0002 §3.1"按投影的证明状态"

**当前（不正确）：**

> "DAG：[...] 任意 typed-DPO 映射缺失"

**更正后：**

> "DAG：通用 rankable-graph 投影完成。产品规则映射（rank、推导）是包符合性义务。"

---

**当前（不正确）：**

> "Petri：[...] 通用规则到 firing 映射缺失"

**更正后：**

> "Petri：通用 pre-net/SSMC 构造完成。产品 firing 映射（enabling、token 语义）是包符合性义务。"

### 来自 RFC-0002 §4.3"P1c 工作"

**当前（不正确）：**

> "将闭合有限多状态 P1c 参考协议提升至全部 15 个 admitted 非 fixture `Config` 出现，连同产品资源、静止、admission 与静态层"

**更正后：**

> "P1c 参考矩阵（60/60 单元）完成。产品包以理论的参考见证为模板实例化 `ProductRuleProofBundle`。资源/静止策略是包符合性输入。"

### 来自 RFC-0002 §11 跟踪表

**当前（不正确）：**

> "将闭合有限多状态 P1c 参考协议提升至全部 15 个 admitted 非 fixture `Config` 出现，连同产品资源、静止、admission 与静态层且无弱步 | DRI + 进程语义评审人 | Pre-FCP"

**更正后（拆分为两个门）：**

**理论 FCP 门：**

> "P1c 参考操作证书（60/60 原生单元，四个 event-indexed 受限关系证书）| DRI + 进程语义评审人 | Pre-FCP"

**产品符合性门（FCP 后）：**

> "各包为其 admitted 规则提供 ProductRuleProofBundle，以理论参考构造为模板 | 包 owner 们 | 产品发布"

### 来自 ADR-0001 接受标准

**当前（不正确，第 161-174 行）：**

> 接受前所需证据：
>
> 1. 定义精确源语法、configurations、规则、新鲜性与粒度；
> 2. 构造并独立检查当前显式完整 FMS 的一个居民 [...]
> 3. 将已实现的 SMC/参考证书扩展到完整 admitted 规则集；
> 4. 独立定义可观察目标推导 [...]
> 5. 定义并证明成功 terminal 谓词的保持/反射；
> 6. 完成全部 DAG/Petri 直接规则映射证明；并
> 7. 获得独立的形式数学/范畴/进程语义评审。

**第 3 项与第 6 项是产品义务，不是理论门。**

**更正后：**

**理论 FCP 门：**

1. 定义精确源语法、configurations、规则、新鲜性、粒度 ✓（完成）
2. 完整 FMS 幂域/domain/完全抽象或已接受的回退范围 ✗（真正阻断项）
3. 定义可观察目标推导、同余、管理策略 ✓（完成）
4. 在参考中定义并证明 terminal 谓词的保持/反射 ✓（完成）
5. 获得独立形式数学/范畴/进程语义评审 ✗（治理阻断项）

**产品符合性门（FCP 后）：**

1. 各包将其 admitted 规则集扩展参考证书
2. 各包为其规则提供 DAG rank 函数与 Petri firing 映射

## 提议的更正 FCP 标准

### RFC-0002 FCP 进入（理论完成）

**RFC-0002 FCP 进入的充分条件：**

1. ✓ **FreeSMC 泛性质** — 任意目标幺半比较（kernel-built）
2. ✓ **位置性 DPOI 范畴闭包** — 有限良构 essential image 等价（kernel-built）
3. ✓ **P1a 通用操作族** — 从 LTS 同构复用的证书构造子（kernel-built）
4. ⚠ **P1b request/accept 操作** — 未过滤结构 strong-late 证书（implemented_unverified；需不可变 commit + 独立评审）
5. ✓ **P1c 参考矩阵** — 60/60 原生单元，四个 event-indexed 证书（kernel-built）
6. ✓ **异构轨迹** — 有限 `EpochChain` 带 admission、重放、epoch（kernel-built）
7. ✗ **完整 FMS 或已接受的回退** — RFC-0002 §16 提议 finite-control 边界；需 FCP 决策
8. ✗ **独立评审** — 范畴/DPO、进程语义、Lean-assumptions 评审人未指派

**从 FCP 门移除的产品特定项：**

- ❌ "任意 typed-DPO 映射"（产品规则清单）
- ❌ "通用规则到 firing 映射"（产品 pre-net 语义）
- ❌ "产品资源、静止、admission 层"（产品运行时事实）
- ❌ "八个包证书"（包尚不存在）

### ADR-0001 接受（理论架构决策）

**ADR-0001 接受的充分条件：**

1. ✓ **统一对象 (C, R) 已定义** — SMC + string-diagram rewriting（规范）
2. ✓ **四个投影已规约** — DAG、Petri、π、态射带 SMC-函子条款（规范）
3. ✓ **通用一致性接口** — `ProjectionCertificate`、`ProjectionFamily`、event lift 关系（kernel-built）
4. ✓ **参考非空洞见证** — 60/60 P1c 矩阵、异构运行时（kernel-built）
5. ⚠ **P1b 操作闭包** — 结构 strong-late 证书（implemented_unverified）
6. ✗ **完整 FMS 或已接受范围** —（待 FCP 决策）
7. ✗ **独立评审 + RFC-0002 FCP** —（治理）

**从接受门移除的产品特定项：**

- ❌ "扩展到完整 admitted 规则集"（各包为其规则实例化）
- ❌ "完成全部 DAG/Petri 直接规则映射证明"（逐包证书）

## 八包混淆

### 当前不正确框架（研究日志 0008）

> "八个包名均为规划中的分发，而其包源码树、清单、产品规则与包拥有的证明输入尚不存在于此。"

**阻断理论 FCP 的包：**

1. Cantilune — 缺失
2. Cantilune Notation — 缺失
3. Cantilune Libretto — 缺失
4. Cantilune Cast — 缺失
5. Cantilune Baton — 缺失
6. Cantilune Cue — 缺失
7. Cantilune Chorus — 缺失
8. Cantilune Reprise — 缺失

**问题：** 理论 FCP 要求"所有八个包提供证书"，但包是规划中的未来分发，不阻断理论的正确性。

### 正确框架（理论 vs 产品分离）

**核心理论 FCP**证明：

- "存在一个通用 `ProductRuleProofBundle` 接口"
- "60 单元参考矩阵满足该接口"
- "任何提供 (rank、pre-net、resource、authorization、ε) 的包都可以实例化它"

**产品符合性**（各包独立、FCP 后）：

- Cantilune 包提供其规则清单与证书
- Libretto 包提供其规则清单与证书
- ……等。

**为何分离重要：**

- 理论可以在包开发期间闭合并接受评审
- 包团队可以并行实例化证书
- 新包可以添加而无需重开理论 FCP
- 参考见证证明接口可实现

## 推荐行动

### 立即（澄清现有文档）

1. **RFC-0002 §3.1 修订：**
   - 将 DAG/Petri 状态从"任意映射缺失"改为"通用构造完成；产品实例化属包符合性"
   - 在理论 FCP 之后添加显式"产品符合性（後續門）"一节

2. **RFC-0002 §4 修订：**
   - 将 P1c 工作拆分为：
     - **P1c 理论**：参考矩阵完成（FCP 门）
     - **P1c 产品**：包为其规则实例化（FCP 后）

3. **ADR-0001 修订：**
   - 从接受标准中移除"扩展到完整 admitted 规则集"
   - 从接受标准中移除"完成全部 DAG/Petri 直接规则映射证明"
   - 添加"通用接口支持产品实例化（参考见证存在）"

4. **研究日志 0008 重构：**
   - 将标题从"产品包投影证书审计"改为"产品包符合性就绪审计"
   - 澄清："包是未来工作；其缺失不阻断核心理论 FCP"

### 近期（启用 FCP 进入）

1. **解决 FMS 范围决策**（RFC-0002 §16）：
   - 选项 A：采纳 finite-control 边界（使原生 π 成为规范投影）
   - 选项 B：保留完整 FMS 为强制（阻断至 Abramsky 幂域构造完成）
   - **决策权威：** DRI + 进程语义评审人在 FCP 期间

2. **将 P1b 绑定到不可变 commit：**
   - 当前状态：可变 worktree 中 `implemented_unverified`
   - 行动：commit `formal/` 树，运行完整证据门，记录聚合
   - 启用：晋级为 `implemented`（待独立评审）

3. **指派独立评审人：**
   - 范畴/DPO/Petri 评审人（针对 DPOI/FreeSMC/pre-net）
   - 进程语义/FMS 评审人（针对 P1b/P1c 操作）
   - Lean kernel-assumptions 评审人（针对 axiom 审计）

### FCP 后（产品符合性）

1. **创建包边界：**
   - `packages/cantilune/`（第一个包）
   - `packages/cantilune-libretto/` 等。
   - 每个带 `package.yaml`、`rules/`、`tests/`

2. **包符合性规约：**
   - 文档：计划中的 `docs/conformance/` 规约（尚未创建）
   - 模板：`packages/_template/rule-certificate-template.lean`
   - 工具：`scripts/validate-package-conformance.ps1`

3. **增量实例化：**
   - 各包就绪时提供证书
   - 无"八个同时"门
   - 理论在产品开发期间保持稳定

## 真正的理论阻断项

**唯一真正阻断核心理论 FCP 完成的事项：**

**完整 FMS 幂域/domain/完全抽象包**

来自研究日志 0015：

> "剩余缺口并非一个无差别的实现任务。它由以下构成：
>
> 1. Lean 树中仍缺失的精确数学居民；
> 2. 为 RFC/FCP 保留的公开语义选择；以及
> 3. 仓库中缺失的生产事实与 kernel。
>
> 任何定理、包名或通用接口都无法凭空制造第 2 或第 3 组中的项。"

**今日所存在（理论片段）：**

- 有限 `Finset` free-semilattice 单子 ✓
- Equality-ordered discrete-CPO 有限 strict power ✓
- 未分离 omega-Scott 不动点 A ≅ P(H A) ✓
- 支持层分配/hiding 收缩 ✓
- 递归 alpha/substitution 同余 ✓

**仍缺失（基础数学）：**

- 所有-ωCPO Abramsky/omega-ideal 幂域 ✗
- 带交换 Fubini 的分离 divergence/deadlock ✗
- `World ⥤ ωCPO` 的代数紧致性或已检验 bilimit ✗
- Agent restriction 操作（不仅仅是支持 hiding） ✗
- Adequacy（语义变迁 = 原生步） ✗
- finite-control π 的 strong-late 完全抽象 ✗

**RFC-0002 §16 提议解决：**

> "P1 的规范 π 投影是类型化的、finite-control open-process 呈现，连同原生标准结构 late-π LTS。[...] `FMSGatedFourProjection` 仍是独立的可选符合性门。"

这将：

- ✓ 解除理论 FCP 阻塞（操作 π 已完成）
- ✓ 保持诚实（无虚假 FMS 主张）
- ✓ 启用未来扩展（FMS 成为可选符合性）
- ⚠ 需 FCP 批准（非自动）

## 总结：更正后的门结构

```
┌─────────────────────────────────────────────────────────────┐
│ 核心理论 FCP（P0 - 阻断项目）                      │
│                                                             │
│ ✓ 通用证书接口（kernel-built）            │
│ ✓ 参考见证（60/60 P1c，异构运行时）   │
│ ⚠ P1b 操作（implemented_unverified → 需评审）  │
│ ✗ FMS 范围决策（§16 提案待 FCP 批准）   │
│ ✗ 独立评审（评审人未指派）                │
└─────────────────────────────────────────────────────────────┘
                            │
                            │ 理论 FCP 已接受
                            ↓
┌─────────────────────────────────────────────────────────────┐
│ 产品符合性（P1 - 逐包，并行）           │
│                                                             │
│ Cantilune 包：                                          │
│   □ 规则清单                                          │
│   □ DAG rank 函数 + 保持证明                │
│   □ Petri pre-net 语义 + firing 推导           │
│   □ 资源/授权策略                         │
│   □ 公平性/ε 证据                                     │
│                                                             │
│ Libretto 包：（相同结构，独立时间）      │
│ Cast 包：...                                           │
│ [... 剩余六个包 ...]                            │
└─────────────────────────────────────────────────────────────┘
```

**关键洞察：** 理论证明证书是_可能的_（通过参考见证）。产品证明它们是_现实的_（通过具体实例化）。第一个门不阻塞于第二个。

## 参考文献

- ADR-0001 §开放问题（第 161-174 行）：当前混同的理论/产品标准
- RFC-0002 §3.1：当前混淆通用/产品的投影状态
- RFC-0002 §4.3：当前混同参考/产品的 P1c 工作
- RFC-0002 §16：提议的 FMS 范围解决
- 研究日志 0008：八包符合性审计（否定结果）
- 研究日志 0015：承重理论闭合（三类缺口分析）
- 研究日志 0006 §仍具约束力的边界：显式的理论 vs 外部 vs 治理分离
