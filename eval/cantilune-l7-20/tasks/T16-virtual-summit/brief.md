# T16 虚拟峰会排期与突发调度

## 目标合同

在虚拟会场策划一场含 50 演讲、30 展商、上万观众容量的行业峰会：招商、排期、暖场、现场突发。大牌嘉宾断线迟到时，必须在 **一秒逻辑时钟** 内改后续 5 场并安抚观众。

## 世界与约束

- 资源：房间、同传、展位互斥。
- 突发写入 `incidents/`，调度结果必须可回放。

## Peer 角色

招商、排期、会场、现场调度、接待。至少 3 个 peer。

## 协作与反馈环

断线事件 → 调度命令排期重算后 5 场 → 接待发安抚。禁止只改一场不管级联。

## Wave-1 必须交付

1. `artifacts/sponsors.md` — 30 展商意向（合成）。
2. `artifacts/speakers.json` — 50 嘉宾槽。
3. `artifacts/venue.md` — 房间与容量。
4. `artifacts/schedule-v1.json` — 初始排期。
5. `artifacts/incidents/late-keynote.md` — 突发。
6. `artifacts/schedule-v2.json` — 级联后排期（后 5 场有差）。
7. `artifacts/audience-care.md` — 安抚话术与通道。

## 禁止

50 嘉宾只有数字没有槽位；突发后排期不变。
