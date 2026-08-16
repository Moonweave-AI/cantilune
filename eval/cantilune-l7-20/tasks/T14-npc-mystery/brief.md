# T14 多 NPC 记忆小镇的可解悬疑演生

## 目标合同

构建一座有独立记忆、性格、动机的 NPC 小镇（目标合同 100 人；Wave-1 至少 **12 个** 完整卡 + 其余用生成规则扩到 100 的名册），在玩家介入后演生可解的悬疑谋杀案。谎言必须沿社交边延迟传播并扭曲。

## 世界与约束

- 每名完整 NPC 有记忆日志；跨 NPC 传递写 `rumor-bus`。
- 线索链必须可解：合规 peer 能从公开线索推出真凶，且只有一条主解。

## Peer 角色

世界观、记忆、冲突、线索合规、玩家预测。至少 3 个 peer。

## 协作与反馈环

玩家对 A 说谎 → 数个逻辑小时后 B 收到扭曲信息 → 线索合规检查是否仍可解。不可解则补线索或改动机，禁止锁死玩家。

## Wave-1 必须交付

1. `artifacts/town.md` — 地图与派系。
2. `artifacts/npcs/roster.json` — 100 名名册（12+ 完整）。
3. `artifacts/npcs/` — 完整卡含性格/动机/记忆。
4. `artifacts/murder.md` — 真凶与时间线（对玩家隐藏的裁判文件）。
5. `artifacts/clue-graph.md` — 可解证明。
6. `artifacts/lie-propagation.md` — 一次谎言延迟传播。
7. `artifacts/player-forecast.md` — 对玩家行为的预测与分支。

## 禁止

无解谜、真凶只在对话里、记忆不落盘。
