# T11 利率决议驱动的多资产对冲推演

## 目标合同

在合成的「决议文本 + 主席讲话转写」发布后，于 **模拟的 10 分钟窗口** 内完成股、债、商品的建仓与对冲计划。音频情绪变化必须改语义权重并触发撤单/改单记录。

本轮不做真实下单、不连接经纪商。

## 世界与约束

- 时钟用逻辑毫秒/秒推进，写在 `artifacts/clock.md`。
- 流动性监控可否决超深度订单。

## Peer 角色

文本微观解析、音频情绪、债、股对冲、流动性。至少 3 个 peer。情绪 peer 的更新必须可见于共享权重文件。

## 协作与反馈环

语气犹豫 → 上调 hawkish 不确定权重 → 各市场子策略同步改单。禁止各市场各写互斥方向还不记账。

## Wave-1 必须交付

1. `data/fomc-statement.md` 与 `data/chair-transcript.md`。
2. `artifacts/semantics.md` — 文本要点与初始权重。
3. `artifacts/audio-shift.md` — 至少一次情绪修正。
4. `artifacts/book.md` — 多资产意向仓位（虚拟账户）。
5. `artifacts/cancels.md` — 协同撤单/改单序列。
6. `artifacts/clock.md` — 窗口内时间线。

## 禁止

真实交易、保证收益话术。
