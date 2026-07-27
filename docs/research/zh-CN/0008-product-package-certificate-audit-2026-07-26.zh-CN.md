# 产品包投影证书审计——2026-07-26

## 结论

当前仓库无法实例化任何生产包 `ProductRuleProofBundle`。八个包名都只是
计划发行物；仓库中尚不存在它们各自的包源码树、manifest、产品规则以及包
所有的证明输入。

这是一个仓库层面的负面发现，不是否定通用形式接口。Lean 工程已经包含参考
规则、通用证书门以及一个实质性的 P1c reconnect 见证；但这些制品没有归属
或索引到八个计划产品包中的任何一个，因此不能记作产品包证书。

## 分类与依据

- 工作对象：只读的仓库/产品包证书审计。
- 观测到的成熟度：pre-alpha/bootstrap。
- 质量含义：该发现阻断产品级理论总闭合；在进入不可变已评审 commit 前，
  仍不得把可变工作树结果升级为正式证明状态。
- 决策：继续迭代；八行均不得晋级为 `proved`、`reviewed`、FCP 完成或
  ADR Accepted。

## 证据边界

- 审计基线 `HEAD`：`078da5f19a14538032b2b139600eef9ec9e49711`。
- 审计日期：2026-07-26。
- 工作树含未提交、未跟踪的形式化工作，因此该 `HEAD` 不绑定新增 Lean
  声明。
- 本审计未访问网络或包注册表，只判断本地仓库中是否存在相应制品。

直接证据：

1. `README.md:41` 明确项目为 pre-alpha，处于仓库 bootstrap 和合同设计
   阶段，并说明目标能力并非均已实现。
2. `README.md:171-182` 将八个独立安装发行物表述为 *planned*。
3. `README.md:205` 明确写明 “Package publication has not started.”
4. `README.md:271-291` 中的 `packages/`、`providers/`、
   `conformance/`、`integration/` 是预期目录树，并说每个包将来才
   *expected* 拥有 manifest、源码和测试等制品。
5. 审计时仓库根目录只有 `.agents`、`.git`、`.github`、`assets`、
   `docs`、`formal`；上述四个预期目录都不存在。
6. 仓库搜索只能在英中文目标架构 README 中定位八个发行名，找不到产品包
   manifest 或源码树。

## 八包缺失证据矩阵

`缺失` 表示仓库中找不到包所有的制品，不表示通用/参考 Lean 理论中没有对应
概念。

| 计划包 | 计划发行名 | 包目录/manifest | 产品规则 | 四视图 admission | rank | pre-net | 资源/会话与删除 | authorization | 稳定/公平窗口 | 正 ε |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Cantilune | `moonweave-cantilune` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |
| Cantilune Notation | `moonweave-cantilune-notation` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |
| Cantilune Libretto | `moonweave-cantilune-libretto` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |
| Cantilune Cast | `moonweave-cantilune-cast` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |
| Cantilune Baton | `moonweave-cantilune-baton` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |
| Cantilune Cue | `moonweave-cantilune-cue` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |
| Cantilune Chorus | `moonweave-cantilune-chorus` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |
| Cantilune Reprise | `moonweave-cantilune-reprise` | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 | 缺失 |

“四视图 admission”必须包含具体 DAG、individual-token pre-net/Petri、
原生 late-π、morphism 解释，以及它们的 native、reflection、replay、
signature-extension 证据；只引用通用 gate 不能填充该单元。

## 同轮新增的形式结果

`Cantilune.Theorems.CrossEpochProductFamily` 现给出通用的单边界组合：
输入真实 `FourCoherentFamilyAdmission`、新签名下真实
`ProductRuleProofBundle` 以及 admission 后源状态与固定规则源状态的连接等式；
输出四个原生目标 admission、四个原生单事件路径、精确 admission replay、
精确 endpoint-free `DPOEvent` replay 和四个 dependent `EpochChain`。

这些 dependent chain 使用已有的任意有限 `EpochChain` 类型，其 replay 与
严格版本递增证明均通过 kernel。定理不会制造缺失的产品实例。单边界范围是
有意的；更长链必须为每个额外边界和规则单元提供真实相邻端点和证书。

本轮实际执行：

```text
lake build Cantilune.Theorems.CrossEpochProductFamily \
  Cantilune.Tests.CrossEpochProductFamily
Build completed successfully (8696 jobs).
```

随后根导入也实际构建成功：

```text
lake build Cantilune
Build completed successfully (8942 jobs).
```

该结果来自 2026-07-26 的可变工作树，不是不可变 commit 绑定的独立评审证据。

## 阻塞与下一步

- 尚无可用于量化完备性的产品规则清单。
- 预期路径中没有包 owner 或 manifest，无法推导规则/admission 归属。
- rank、pre-net、资源/会话 quiescence、authorization、公平性、稳定窗口和
  正 ε 是操作事实，不能从包名或通用定理自动推出。
- 把参考 P1c reconnect bundle 冒充八包之一会制造虚假完成证据。

## 下一步

| 动作 | Owner | 评审时点 | 权威证据 |
|---|---|---|---|
| 建立各包 manifest、源码、测试和 owner 边界 | 产品包 Owner | 产品证书工作前 | 包目录与 owner 规则 |
| 发布每包有限产品规则清单 | 产品包 Owner | 宣称完备前 | 产品规则规范 |
| 为每条规则提交 `ProductRuleProofBundle` 与跨 epoch admission 输入 | 规则 Owner + 形式化 DRI | 逐规则 | Lean 声明与 proof manifest |
| 提交 rank、pre-net、资源/会话、authorization、稳定/公平窗口和正 ε 证据 | 运行时/概率 Owner | 逐执行包 | Lean 声明与操作证据 |
| 在不可变 commit 上重跑矩阵 | 独立 QA-L4 评审人 | FCP 前 | QA 记录与 commit |
