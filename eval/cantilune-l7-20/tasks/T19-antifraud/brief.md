# T19 进化中的黑产对抗与误杀仲裁

## 目标合同

在合成的亿级用户平台切片上，对抗会改策略的刷单/洗钱/虚假交易网络。一边在关系图上追踪，一边由仲裁评估新策略误杀率，动态平衡。

本轮不攻击真实用户、不部署真实封禁。

## 世界与约束

- 黑产策略在 `adversary/` 按回合进化；风控不得读取其「未来回合」文件。
- 误杀率超过阈值则新策略不得全量。

## Peer 角色

异常捕获、图谱、手法逆向、策略生成、误杀仲裁。至少 3 个 peer。

## 协作与反馈环

新手法出现 → 图谱更新 → 策略草案 → 仲裁抽样误杀 → 通过才灰度。禁止无仲裁全封。

## Wave-1 必须交付

1. `data/graph-slice.json` — 合成账户/设备/订单图。
2. `adversary/round-1.md` 与 `adversary/round-2.md` — 进化（裁判可见）。
3. `artifacts/anomalies.md` — 捕获。
4. `artifacts/graph-findings.md` — 社区/路径。
5. `artifacts/strategy-v1.md` 与 `artifacts/strategy-v2.md`。
6. `artifacts/arbitration.md` — 误杀估计与是否全量。
7. `artifacts/balance.md` — 召回与误杀的权衡。

## 禁止

对真实平台做对抗、无误杀估计的一刀切。
