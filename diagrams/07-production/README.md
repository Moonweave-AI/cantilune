# 图 07 · 生产发布面（07A–07H）

本目录是 2026-08-15 工程 0.x 发布的窄范围工程图。英文 ADR-0021–0029 为权威；图只画编排语义，不嵌入 Lean / 数学证明。

| 图 | 文件 | 范围 |
| -- | ---- | ---- |
| 07A | `07a-class.puml` | Namespace + Transcript + AccessRequest + Actor |
| 07B | `07b-seq.puml` | 跨 NS 申请 / 主体批准 / 观察脱敏 |
| 07C | `07c-durable.puml` | file / Postgres HA / 官方 etcd Raft |
| 07D | `07d-sandbox.puml` | Hyper-V / gVisor；探测失败关闭 |
| 07E | `07e-otel.puml` | 可观测性平台：OTel + AG-UI + OTLP |
| 07F | `07f-a2a.puml` | A2A 1.0.0 操作与绑定 |
| 07G | `07g-mcp.puml` | MCP 热挂：当前回合旧面，下一回合新 epoch |
| 07H | `07h-redaction.puml` | Fleet 控制台脱敏层 |

命名约定见 [`../00-naming-contract.md`](../00-naming-contract.md)。本地预览需要 Java；无 JVM 时可用 PlantUML 在线服务器。
