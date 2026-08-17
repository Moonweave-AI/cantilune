# Cantilune L7-20 测试结果汇总 (2026-08-17)

本目录汇总 20 个 L7-20 任务在 2026-08-17 的最终 `measured` 证据。每个任务子目录包含该任务最后一次通过全部硬门的:

- `checkpoint-eval.json` — 9 道硬门(swarmFanout/activateLoop/notLecture/horizon/artifacts/comms/observe/noSelfScore/wave1)的判定
- `result.json` — headless 运行的 RunResult(turns/elapsedMs/operations)
- `swarm-status.json` — supervisor 调度器快照(startedTotal/completedTotal/consumedTurns)
- `cluster-events.jsonl` — supervisor 事件流(agent_queued/agent_started/agent_done/heartbeat_received/cluster_complete)

`round-summary.json` 是 20 任务的汇总判定。按 PROTOCOL §7,本轮 `measured`(20/20 硬门通过),仍**不是**公开 `supported` 主张(须新协议 + Owner COI 评审)。

## 运行参数

- provider: dashscope
- model: qwen3-235b-a22b
- durable: file(--storage-path 隐含)
- per-task: --max-turns 30 --max-time-ms 1200000 (T20 用 35/1500000)
- passAtK: 1

## 复现

```powershell
pnpm install --ignore-scripts
pnpm build
pnpm eval:l7-20 -- --provider dashscope --max-turns 30 --max-time-ms 1200000
```

任一任务硬门失败会停轮并写 `REPAIR.md`,修复生产路径后从该任务重跑(不得改评分器或 checkpoint)。

## 隔离

原始运行产物在 `.cantilune/eval/l7-20/<runId>/<taskId>/`(被 .gitignore),本目录是从中提取的评分快照,不包含工作区 `artifacts/`(那些是 agent 写的,评分器只读)。
