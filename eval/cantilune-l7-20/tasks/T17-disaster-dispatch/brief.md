# T17 复合灾害下的城市生命线调度

## 目标合同

千万人口城市同时遭遇地震、火灾、暴雨。指挥无人机、救护车、消防车、物资点做生命线调度。交通必须为消防开绿波，物资必须随损毁报告改投递点。

本轮用网格城市模型，不控制真实车辆。

## 世界与约束

- 时钟是短周期 tick。资源有容量与行程时间。
- 市民播报不得与现场事实矛盾。

## Peer 角色

态势、医疗、交通、无人机蜂群、播报。至少 4 个 peer。

## 协作与反馈环

新损毁 → 交通改路权 → 消防/医疗重派 → 物资改坐标 → 播报更新。任一环节掉队记回归。

## Wave-1 必须交付

1. `data/city-grid.json` — 网格、医院、消防、物资点。
2. `artifacts/hazards.md` — 三灾叠加初始态势。
3. `artifacts/medical.md` — 伤员与运力。
4. `artifacts/green-corridors.md` — 为消防开辟的通道。
5. `artifacts/uav.md` — 侦察与损毁回报。
6. `artifacts/supply-retarget.md` — 投递坐标调整。
7. `artifacts/broadcasts.md` — 与态势一致的播报。
8. `artifacts/tick-log.md` — 至少 5 个 tick 的协同记录。

## 禁止

静态一次分配、播报与地图不一致。
