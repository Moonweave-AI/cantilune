# ADR-0026：受 epoch 约束的 MCP 热挂

| 字段       | 值                                                          |
| ---------- | ----------------------------------------------------------- |
| 状态       | **Accepted**                                                |
| 日期       | 2026-08-15                                                  |
| 决策负责人 | Joker-of-Gotham                                             |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露） |
| 相关       | ADR-0006、MCP 2026-07-28                                    |
| 取代       | 无                                                          |
| 被取代     | 无                                                          |

> 英文正文为唯一权威来源：[`docs/adr/0026-mcp-epoch-attach.md`](../0026-mcp-epoch-attach.md)。

## 背景

MCP 2026-07-28 是无状态的（`server/discover`，无协议会话）。Cantilune 仍把可见工具面绑定到 schema epoch。回合中途变更工具集会破坏准入单调性。

## 决策

1. 存活 OS 上允许 `/mcp connect|disconnect`。
2. 每次变更提交 schema 准入，并在 commit 时进入新 epoch。
3. **当前 LLM 回合**保持旧工具面。下一回合使用新 epoch。
4. HTTP 与 stdio MCP 均允许。热挂仍须带推进 epoch 的 schema admission receipt；当前回合保持旧工具面。
5. Discover/list 缓存在 epoch 变更时失效。

## 批准

**Architecture + Security**：Joker-of-Gotham（COI 已披露）  
**日期**：2026-08-15
