# 产品包投影证书审计 — 2026-07-26

## 结论

当前仓库无法实例化任何生产包的 `ProductRuleProofBundle`。全部八个包名为计划中的发行物，而其包源代码树、清单、产品规则以及包拥有的证明输入在此尚不存在。

这是一项否定性仓库发现，而非关于通用形式接口的否定性结果。Lean 开发包含参考规则与通用证书门，包括一个实质性的 P1c 重连见证。这些制品不归任何八个计划中的生产包所有，也不被索引至其中，因此不得被报告为产品包证书。

## 分类与理由

- 工作对象：只读仓库/包证书审计。
- 观察到的仓库成熟度：pre-alpha/bootstrap。
- 质量影响：此发现阻塞产品级理论闭包，且在被捕获至不可变评审提交之前，超出可变工作树的部分仍为未验证。
- 决策：迭代。不要将八个包行晋级至 `proved`、`reviewed`、FCP 完成或 ADR 接受状态。

## 证据边界

审计基线：

- 仓库 `HEAD`：`078da5f19a14538032b2b139600eef9ec9e49711`；
- 审计日期：2026-07-26；
- 工作树包含未提交与未追踪的形式工作，因此 `HEAD` 不绑定新构造的 Lean 声明；
- 未使用网络或包注册表查询；这是一次本地仓库存在性审计。

直接仓库证据：

1. `README.md:41` 称项目处于 pre-alpha，说它正在进入仓库引导与契约设计阶段，并明确说明所描述的目标能力尚未全部实现。
2. `README.md:171-182` 描述了一个仓库和八个 _计划中的_ 独立可安装发行物。
3. `README.md:205` 声明："Package publication has not started."
4. `README.md:271-291` 将 `packages/`、`providers/`、`conformance/` 和 `integration/` 呈现为预期的目录树，并说每个包 _预期_ 有自己的清单、源代码、测试与相关制品。
5. 审计时，仓库根目录包含 `.agents`、`.git`、`.github`、`assets`、`docs` 和 `formal`；四个预期目录 `packages/`、`providers/`、`conformance/` 和 `integration/` 不存在。
6. 仓库搜索在中英文目标架构 README 材料中找到发行名称，但未找到包清单或产品源代码树。

## 八包缺失证据矩阵

`Missing` 表示在仓库中未定位到任何包拥有的制品。这并不意味着通用/参考 Lean 理论中缺少相应概念。

| 计划包             | 计划发行物                     | 包树/清单 | 产品规则 | 四视图准入 |    Rank | Pre-net | 资源/会话与删除 |    授权 | 稳定/公平窗口 |    正 ε |
| ------------------ | ------------------------------ | --------: | -------: | ---------: | ------: | ------: | --------------: | ------: | ------------: | ------: |
| Cantilune          | `moonweave-cantilune`          |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |
| Cantilune Notation | `moonweave-cantilune-notation` |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |
| Cantilune Libretto | `moonweave-cantilune-libretto` |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |
| Cantilune Cast     | `moonweave-cantilune-cast`     |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |
| Cantilune Baton    | `moonweave-cantilune-baton`    |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |
| Cantilune Cue      | `moonweave-cantilune-cue`      |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |
| Cantilune Chorus   | `moonweave-cantilune-chorus`   |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |
| Cantilune Reprise  | `moonweave-cantilune-reprise`  |   Missing |  Missing |    Missing | Missing | Missing |         Missing | Missing |       Missing | Missing |

所要求的"四视图准入"单元格包括具体的 DAG、individual-token pre-net/Petri、原生 late-π 与态射解释，以及它们的原生、反射、重放与签名扩展证据。一个包不能仅通过引用通用门来填充该单元格。

## 审计同时产出的形式结果

`Cantilune.Theorems.CrossEpochProductFamily` 现提供一个通用单边界组合：

- 一个真实的 `FourCoherentFamilyAdmission`；
- 一个真实的新签名 `ProductRuleProofBundle`；以及
- 一条将已准入的源状态连接到固定规则源的方程。

从这些输入中，它导出四条原生目标准入边、四条原生单事件固定签名路径、精确的准入重放、精确的无端点 `DPOEvent` 重放，以及四个依赖的 `EpochChain` 值。依赖链使用现有的任意有限 `EpochChain` 类型，其重放与严格版本证明经内核检查。

此定理不制造任何缺失的包居留项。其单边界范围是刻意的：更长的链需要每个额外边界与规则单元格的实际相邻包端点与证书。

定向构建实际执行：

```text
lake build Cantilune.Theorems.CrossEpochProductFamily \
  Cantilune.Tests.CrossEpochProductFamily
Build completed successfully (8696 jobs).
```

根导入随后也成功构建：

```text
lake build Cantilune
Build completed successfully (8942 jobs).
```

构建于 2026-07-26 在可变工作树上运行。它不是不可变提交绑定的评审证据。

## 阻塞与风险

- 没有可用于量化完整性的产品规则清单。
- 在预期路径中没有包所有者或包本地清单，无法据此推导规则/准入所有权。
- Rank、pre-net、资源/会话静止、授权、公平性、稳定窗口与正-ε 假设是操作事实，不能从包名或通用定理中推断。
- 将参考 P1c 重连 bundle 视为八个生产包之一会抹除产品边界并制造虚假的完成证据。

## 后续步骤

| 行动                                                          | Owner                 | 到期/评审        | 权威链接            |
| ------------------------------------------------------------- | --------------------- | ---------------- | ------------------- |
| 创建每个真实的包清单/源代码/测试/所有者边界                   | 包所有者              | 产品证书工作之前 | 包树与所有者规则    |
| 每包发布有限的产品规则清单                                    | 包所有者              | 完整性声称之前   | 包规则规范          |
| 每规则提供 `ProductRuleProofBundle` 与跨 epoch 准入输入       | 规则所有者 + 形式 DRI | 每规则           | Lean 声明与证明清单 |
| 提供 rank、pre-net、资源/会话、授权、稳定/公平窗口与正-ε 证据 | 运行时/概率所有者     | 每执行包         | Lean 声明与操作证据 |
| 针对不可变提交重新运行此矩阵                                  | 独立 QA-L4 评审人     | FCP 之前         | QA 记录 + 提交      |
