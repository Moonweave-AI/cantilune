# ADR-0025：可观测性平台（OTel + AG-UI + OTLP）

| 字段       | 值                                                          |
| ---------- | ----------------------------------------------------------- |
| 状态       | **Accepted**                                                |
| 日期       | 2026-08-15                                                  |
| 决策负责人 | Joker-of-Gotham                                             |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露） |
| 相关       | ADR-0005、RFC-0001 §7                                       |
| 取代       | 无                                                          |
| 被取代     | 无                                                          |

> 英文正文为唯一权威来源：[`docs/adr/0025-observability-platform.md`](../0025-observability-platform.md)。

## 背景

Owner 授权对外宣称**可观测性平台**。Cantilune 的 OTLP/HTTP 导出已是**生产**（`CANTILUNE_OTLP_EXPORT_MATURITY`）。上游 OpenTelemetry `gen_ai.*` 键名仍为 **Development**（仓库 `semantic-conventions-genai`；截至 2026-07 无 Stable）——这是官方约定状态，不是 Cantilune 未落地。AG-UI 是 agent↔用户事件标准。SIEM 产品经 Collector 摄入 OTLP；Cantilune 不得厂商锁定 Splunk/Elastic API。

## 决策

1. `@cantilune/observability` 是平台读面：FourView + 脱敏 + 导出器。
2. 使用官方 `@opentelemetry/*` 的 OTLP/HTTP 导出已投产。官方 `gen_ai.*` 属性名在上游稳定前保持 Development。
3. AG-UI 事件从已提交世界 + 可见 transcript 派生（RUN/TEXT/TOOL/STATE/REASONING）。
4. `ProjectionCertificate` 仍属 `@cantilune/conformance`。可观测性只持 digest 引用。
5. 生产读取要求 `ObservationAccessContext`。跨命名空间适用 ADR-0022。
6. 每副本不得另起第二条 EventSpine。

## 批准

**Architecture + Security**：Joker-of-Gotham（COI 已披露）  
**日期**：2026-08-15
