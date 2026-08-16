# Cantilune L7-20 预注册评测协议

| 字段 | 值 |
| --- | --- |
| 协议 id | `evaluation.protocol.cantilune-l7-20` |
| 状态 | **proposed**（未 freeze；本文件是预注册草案，不是公开优越性主张） |
| 套件 | `eval/cantilune-l7-20` |
| 主张绑定 | 过程证据可对照 `evaluation.c1`–`evaluation.c5`；**分析层不得发出 `supported`**（RFC-0004 / E7） |
| Owner | Joker-of-Gotham |

本协议在跑任何归因于本套件的 run 之前写成。跑完后改指标必须新开协议版本（`amendmentOf`），不得回改本文件来「救」分数。

## 1. 评测对象与非目标

**对象：** 真实 Cantilune OS（file durable、swarm supervisor、syscall/tools、comms、observability）。用户只给任务正文；集群结构与推进由运行中的 Agent 自决。

**非目标：**

- 不把 Vitest 绿、TUI 能聊、或「模型口头说支持多 Agent」当成任务完成。
- 不把 Lean / `proved` 行当成经验分数。
- 不发布相对 Cursor / Codex / Claude Code 的公开优越性结论（须 Owner COI 评审 + 冻结协议）。
- 不要求一轮 CI 里真的交付「工业级 10 集动画」或「百亿资金实盘」。全愿景写在 brief 的目标合同里；**本轮可判定的是 Wave-1 切片 + 过程门**。

## 2. 权威依据（指标从这里内化，不是从一次跑分事后挑选）

| 来源 | 内化成什么 |
| --- | --- |
| [SWE-bench / SWE-bench Verified](https://www.swebench.com/) | 每任务独立工作区；能跑的检查用隔离产物，不信自我报告 |
| [TheAgentCompany](https://the-agent-company.com/) | 长程职业任务用 **checkpoint / 子目标** 计分，不全或零 |
| [τ-bench](https://github.com/sierra-research/tau-bench) | 报告 **pass^k**，不把单次成功当可靠性 |
| [GAIA](https://huggingface.co/gaia-benchmark) | 多步 + 工具；本套件 **不** 使用公开金标答案表 |
| [AgentBench](https://github.com/THUDM/AgentBench) | 分环境（OS / 检索 / 决策），不合成单一排行榜 |
| [Terminal-Bench](https://www.tbench.ai/) | 终端与文件系统轨迹可审计 |
| [OSWorld](https://os-world.github.io/) | 环境状态对照，不只看对话 |
| [Inspect AI](https://inspect.aisi.org.uk/) | 轨迹日志是一等证据 |
| ACL 2026 *Survey on Evaluation of LLM-based Agents* | 完成率实现因域而异；必须有针对性核验步骤 |
| 2026-04 Berkeley RDI 对八大 agent bench 的奖励黑客审计 | **禁止** agent 改自己的评分器 / 测试钩子；评分只读声明产物 |
| RFC-0004 / ADR-0011 | 预注册、三值决策、E7 不发 `supported` |

## 3. 一轮跑法（20 任务串行 + 任务间检查点）

```
for T in T01..T20:
  1. 建立隔离世界  .cantilune/eval/l7-20/<runId>/<taskId>/
  2. 复制 brief.md → TASK.md（只读对评分器）
  3. 真实 boot：`cantilune run --headless --swarm --instruction-file --storage-path`，durable=file，工具根与 durable 均仅该目录。无预注册 worker 时走发起方 loop + 一份 supervisor（禁止第二条 feed）。
  4. 写出 result.json / world.json / events.jsonl（能拿到的都写）
  5. 跑本任务 checkpoint（fail-closed）
  6. 若任一硬门失败：
       - 写 REPAIR.md（任务 id、失败门、轨迹摘要）
       - 停止后续任务
       - 对照 PROTOCOL §6 检查工程落地（不得改评分器来消红）
  7. 硬门通过：进入下一任务（工作区不复用）
```

并行 20 路会交叉污染 durable / comms / 内容库，本协议 **禁止**。pass^k 是同一任务的独立重复 run，不是 20 题并行。

## 4. 预注册指标

每个任务输出一组观察。分析只做区间 / Holm / 效应量，**不**把「均值好看」写成 supported。

| 指标 id | 角色 | 定义 | 硬门？ |
| --- | --- | --- | --- |
| `l7.process.swarmFanout` | primary / c1 | 本任务隔离世界里 `register_participant` + `activate_participant` 后 **active 且非 initiator** 的 peer 数 | 是（≥ `minPeers`） |
| `l7.process.activateLoop` | primary / c2 | 存在由 supervisor 拉起的第二（或第 n）个 Agent loop 证据，而不是只改了 snapshot 字段 | 是 |
| `l7.process.notLecture` | guardrail | 轨迹里实际发生 tool/act；禁止「建议用户去调 tool:…」却零调用 | 是 |
| `l7.process.horizon` | secondary / c2 | 本任务 turn 数 ≥ `minTurns`（长程，不是一问一答） | 是 |
| `l7.fs.artifacts` | primary | `artifacts/` 下声明 glob 均非空，且不在套件源码目录 | 是 |
| `l7.comms.session` | secondary | 至少一条 `create_session` 或 comms 投递记录（任务声明需要时） | 按任务 |
| `l7.observe.spine` | primary / c5 | 可重放的 event/audit 轨迹；缺文件即失败 | 是 |
| `l7.observe.noSelfScore` | guardrail | 工作区未改写 `checkpoint.json` / 本协议 / 评分源码 | 是 |
| `l7.outcome.wave1` | primary | Wave-1 切片产物齐套（见各任务 checkpoint） | 是 |
| `l7.reliability.passAtK` | analysis-only | 同一任务 k 次独立 run 全过的比例；默认 k=1，发布前须 k≥3 | 否（本草案默认 k=1） |

**失败处理：** 硬门失败 = 该任务 `notSupported`（过程意义），整轮 **停**。缺失轨迹 = 失败，不插补为 0 分通过。

## 5. 隔离契约

| 层 | 位置 | 可否提交 |
| --- | --- | --- |
| 套件源（brief / 协议 / manifest） | `eval/cantilune-l7-20/` | 是 |
| 单任务跑产物 | `.cantilune/eval/l7-20/<runId>/<taskId>/` | **否** |
| 评分器 | `@cantilune/evaluation` `corpus/cantiluneL7Twenty.ts` | 是（agent 不可写） |

Agent 的 file/content/durable 根必须是该任务目录。禁止写回 `eval/cantilune-l7-20/tasks/**`。

## 6. 单任务失败后的工程检修（停轮，不改分数）

检查顺序固定：

1. **启动路径：** CLI 是否在 runtime 就绪后挂上 **一份** swarm（禁止第二条 feed 双拉起）。
2. **工具是否真调用：** `register_participant` / `activate_participant` / `write_content` 是否在 availableActions 且被执行。
3. **supervisor：** activate 之后是否出现第二个 CantilunOS loop。
4. **durable / private history：** 是否又出现 UI-only persist 拒写。
5. **comms / observe：** session 与四投影是否有 digest。
6. **对照实现：** 只读参考 LangGraph durable / SWE-agent trajectory / Inspect transcript / A2A 官方数据模型 / 本仓 ADR-0015·0019·0021·0025，再改 **生产路径**，然后从失败任务重跑，不得从 T01 偷偷改金标。

## 7. 决策规则（本草案）

- 20/20 硬门通过 → 套件 run `measured`（仍不是公开主张）。
- 任一硬门失败 → 套件 run 终止，`notSupported` 记在该任务，后续任务 `notRun`。
- 轨迹被篡改或评分器被工作区改写 → 整轮作废。
- 公开 `supported`：禁止。须新协议 + Owner COI 评审。
