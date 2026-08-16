# ADR-0021：Transcript 进入 CollaborationSnapshot

| 字段       | 值                                                                              |
| ---------- | ------------------------------------------------------------------------------- |
| 状态       | **Accepted**                                                                    |
| 日期       | 2026-08-15                                                                      |
| 决策负责人 | Joker-of-Gotham                                                                 |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露）                     |
| 相关       | ADR-0012、ADR-0005、ADR-0022                                                    |
| 取代       | ADR-0012 §1「不得把私有历史写入 CollaborationSnapshot」                         |
| 被取代     | 无                                                                              |

> 英文正文为唯一权威来源：[`docs/adr/0021-snapshot-transcripts.md`](../0021-snapshot-transcripts.md)。

## 背景

ADR-0012 把 LLM `messageHistory` 留在共享世界之外，使 Agent 无法读取彼此的推理过程。Owner（2026-08-15）推翻该产品规则：运维与同命名空间 peer 必须能看见各 Agent 在想什么。隔离从「不进世界」改为 **Namespace + 授权**。

## 决策

1. `CollaborationSnapshot.transcripts` 持有 `ParticipantTranscript`（core 类型；形状与 boot `LlmMessage` 相同）。
2. Boot 在每一组完整的 assistant/tool 之后提交精确循环历史（与 ADR-0012 耐久检查点相同）。
3. 在场不等于授权。读者使用 `visibleTranscript`：
   - 同一 `namespaceId` → 全文
   - 其他命名空间 → 摘要，除非**被看历史的 Actor** 批准了申请，或持有 `transcript_read` 能力
4. Transcript 是已提交的世界状态，不是 ObservationEntry，也不是平行会话身份。

## 结果

- ADR-0012 §1 的私有历史规则被取代；ADR-0012 的连续性、content-ref 与证据规则仍然有效。
- 可观测性在离开信任区之前必须脱敏（ADR-0022 / 0025）。
- Snapshot 线路增加可选 `transcripts` 以兼容旧载荷。

## 批准

**Architecture + Security**：Joker-of-Gotham（Owner 指派的独立评审人；COI：同时为 DRI）  
**日期**：2026-08-15  
**决策引用**：生产发布 Owner 答复（history = break_isolation；peer_history = 同 NS 全文 / 跨 NS 向被看方申请）
