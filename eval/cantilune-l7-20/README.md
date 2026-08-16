# Cantilune L7-20

面向 **真实 Cantilune 框架** 的长程 swarm 套件：20 个彼此隔离的任务，覆盖文件系统、大型 Agent swarm、通信、可观测性与超长程运行。

这不是 demo 题集，也不是公开榜单。协议见 [PROTOCOL.md](./PROTOCOL.md)。主张命名走 `evaluation.c1`–`evaluation.c5`，与产品符合性 C0–C9 分开。

## 目录

```
eval/cantilune-l7-20/
  PROTOCOL.md             预注册协议（指标 / 停轮 / 检修）
  suite.manifest.json     机器可读套件
  tasks/README.md         20 题索引
  tasks/Txx-*/brief.md    润色后的目标合同 + Wave-1 切片
  tasks/Txx-*/checkpoint.json
```

跑出来的世界、内容库、轨迹只进 `.cantilune/eval/l7-20/`，不进本目录。

## 怎么跑一整轮

需要已配置的 LLM（与 TUI 相同，例如 DashScope）。**不要**在 CI 里无密钥空跑后把失败当成「框架不能 swarm」。

```powershell
pnpm eval:l7-20 -- --provider dashscope
pnpm eval:l7-20 -- --plan-only
```

只跑一题（检修时从失败点重来）：

```powershell
pnpm eval:l7-20 -- --provider dashscope --from T07 --to T07
```

默认：T01→T20 串行；任一 checkpoint 硬门失败立刻停，并写该任务目录下的 `REPAIR.md`。

## 一题里 Agent 该做什么

brief 里的「目标合同」是全愿景（重构十万行、拍 10 集动画、实盘对冲……）。**本轮判定的是 Wave-1**：在隔离世界里自举最小可运行设定，自己决定要不要拉 peer，把架构/证据/代码/记录写进 `artifacts/`，并留下可重放轨迹。

不要让用户去执行 `/swarm` 或 `tool:web_fetch`。集群结构由运行中的 Agent 自决。

## 和 `@cantilune/evaluation` 的关系

`createCantiluneL7TwentySuite` / `evaluateL7TwentyCheckpoint` 消费本目录。E7 分析仍不得把本套件均值写成 `supported`。
