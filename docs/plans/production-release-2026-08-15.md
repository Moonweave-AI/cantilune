# 生产级发布计划（2026-08-15）

| 字段   | 值                                                                     |
| ------ | ---------------------------------------------------------------------- |
| 状态   | Owner 决策已收口；工程接线与发布元数据已落地（npm publish 仍等 token） |
| Owner  | Joker-of-Gotham（DRI；本轮兼任独立 Architecture + Security 审阅人）    |
| COI    | 已披露：DRI 兼任独立审阅；不伪造外部审阅人姓名                         |
| Lean | 内核行保持 `proved`；Owner Accept 已记录       |
| FCP    | RFC-0001/0002/0003/0004 **FCP opened 2026-08-16**（closes 2026-08-30；not Accepted） |

本文是本轮「完整生产级发布」的单一执行计划。权威对照：Temporal Persistence、
gVisor / Hyper-V isolated containers、MCP 2026-07-28、A2A 1.0.0、
OpenTelemetry（Cantilune OTLP 导出已生产；官方 `gen_ai.*` 仍为 Development）、AG-UI 事件面、OTel Collector → SIEM。

---

## 0. Owner 决策记录（本聊天结案）

| ID  | 决策                                                                                                |
| --- | --------------------------------------------------------------------------------------------------- |
| G1  | 你兼任独立 Architecture + Security 审阅人并在本聊天结案；COI 写入 `reviewer-assignments.md`         |
| G2  | D1–D8 工程全做                                                               |
| G3  | D1 = **typed mobility**（admission 约束的名字/频道委派），不是无限制 π                              |
| G4  | D3 = 运维 **Postgres HA** 或官方 **etcd Raft**；Cantilune 做 CAS + fencing；无集群 fail-closed → file |
| G5  | D6 = Windows **Hyper-V isolated container** + Linux **gVisor runsc**；缺运行时 fail-closed          |
| G6  | 推翻 ADR-0012 §1：全量 `messageHistory` **进入** `CollaborationSnapshot`                            |
| G7  | 同 Namespace 参与者可读彼此全文；跨 Namespace 默认摘要；**被看历史的 Actor 批准**后可观测全文       |
| G8  | 对外宣称 **可观测性平台**（OTel + AG-UI + OTLP SIEM 桥）                                            |
| G9  | D8 MCP 热挂 = 运行中 connect/disconnect → schema admission + 新 epoch，**当前 turn 结束后生效**     |
| G10 | 租户 = Temporal/K8s **Namespace + RBAC**；跨租户控制台默认红action                                  |
| G11 | 发布 = GitHub Release + **npm 0.x**；**Apache-2.0**；不签 HSM；不自动签 Acceptance cert             |
| G12 | 无人值守 + 多机对抗 = 双机 LAN mTLS 对抗 + 8h soak + 崩溃自拉起；CI 用双进程模拟主机               |
| G13 | SIEM = **只导出 OTLP**；`ProjectionCertificate` 仍属 conformance；observability 持 digest           |
| G14 | 公开宣称 A2A，并按 **A2A 1.0.0 latest 全文**实现（JSON-RPC + REST + SSE + push；gRPC 绑定一并落地） |
| G15 | RFC Q1=已落地三柱+四投影；Q2=差异表不冻结竞品；Q3=policy DSL 非图灵完备；Q5=C1–C4 corpus；Q6=你     |
| G16 | Lean 义务行 **不得**改成 `reviewed`（promotion form unused）；Owner Accept 另记 `ownerAccept`                      |
| G17 | 本机 Windows Home：不升级 Pro；Hyper-V/VMMS 按 Microsoft Learn SKU **fail-closed**；本机隔离走 WSL Ubuntu-24.04 + 官方 gVisor `runsc`（永不报成 Hyper-V） |
| G18 | 进入 FCP；Owner 亲自签 Formal / Process / QA-L5 / AI-Eval（COI）；公开评测主张仅经 `OWNER_COI_PUBLIC_REVIEW_CONFIG`；分析层仍不得发出 `supported`；保持 SemVer 0.x；soak 以 8h 为足 |

---

## 1. 范围对照（原缺口 → 本轮产物）

| 原缺口                           | 本轮做法                                                    | ADR      |
| -------------------------------- | ----------------------------------------------------------- | -------- |
| Owner 门 / 独立审未签            | 你签核；Proposed→Accepted（COI 披露）；formal 不改 reviewed | 治理更新 |
| messageHistory 不进 snapshot     | 进世界；可见性按 Namespace + 申请                           | 0021     |
| 跨租户 / 红action / fleet 控制台 | Namespace + RBAC + 摘要/申请/批准                           | 0022     |
| 多副本分布式 DB / 无跨副本       | Postgres HA 或官方 etcd Raft；跨副本读同一 head             | 0023 / 0029 |
| 无容器级 sandbox                 | Hyper-V isolated / gVisor；缺则 fail-closed                 | 0024     |
| 故意不做 AG-UI / OTel；非平台    | OTLP + AG-UI 事件 + 平台口径                                | 0025     |
| MCP 不能热挂                     | epoch-bound attach                                          | 0026     |
| 公开 A2A 未完成                  | A2A 1.0.0 数据模型 + 三绑定 + Agent Card/Task/流式/push     | 0027     |
| 无限制 π（D1）                   | typed mobility，不改 Lean                                   | 0028     |
| D4 RFC-0003 中文                 | 全译，不宣称 QA-L5                                          | 文档     |
| D5 diagrams/07                   | `diagrams/07-production/` 八视图                            | 文档     |
| 无人值守 / 多机对抗              | 无审批路径 + L7 对抗 + 8h soak 脚本                        | 测试     |
| 外部 SIEM                        | OTLP 出口（Collector 转 Elastic/Splunk/Datadog）            | 0025     |
| ProjectionCertificate 归属       | 仍在 conformance；observability 只持 digest 引用            | 0025     |

---

## 2. 包边界（禁止平行身份层）

| 概念                      | 落点包                        | 规则                                                    |
| ------------------------- | ----------------------------- | ------------------------------------------------------- |
| `NamespaceId` / 命名空间  | `@cantilune/core`             | 一概念一 `camelCase.ts`；Participant 组合 `namespaceId` |
| `ParticipantTranscript`   | `@cantilune/core`             | 进 `CollaborationSnapshot.transcripts`；不另起会话身份  |
| `TranscriptAccessRequest` | `@cantilune/core`             | 跨域申请；批准后发 `transcript_read` capability         |
| `transcript_read`         | `ScopedCapability`            | 扩展既有 capability，不平行授权类型                     |
| Postgres / etcd Raft durable | `@cantilune/runtime`       | `DurableCoordinator`；file 仍为无集群默认               |
| 红action / OTel / AG-UI   | `@cantilune/observability`    | 只读；证书 digest 引用 conformance                      |
| Namespace RBAC / fleet    | `@cantilune/control-plane`    | 管理面；不改写 snapshot 图结构以外的授权事实            |
| A2A 1.0 + typed mobility  | `@cantilune/comms`            | 公开互操作面；admission-bound 频道委派                  |
| OS sandbox / MCP attach   | `@cantilune/tools` + boot/CLI | 工具执行隔离；热挂走 control-plane epoch                |

跨包测试只走 package exports。

---

## 3. 实施阶段

### P0 治理与契约

1. `LICENSE` Apache-2.0
2. ADR-0021–0029（英 + zh-CN）
3. 修订 ADR-0012（§1 被 0021 取代）、ADR-0003（分布式 DB）、ADR-0005（平台口径）、ADR-0008（公开 A2A）
4. RFC-0001 §15 Q1–Q6 按 G15 关闭；G18 于 2026-08-16 进入 FCP
5. `reviewer-assignments.md`：独立审阅人 = Owner（COI）
6. 各包 `private: false` + `license` + `publishConfig`（0.x，不自动签 cert）

### P1 core 世界模型

- `NamespaceId` + `CollaborationNamespace` + `DEFAULT_NAMESPACE_ID`
- `Participant.namespaceId`（缺省 `default`）
- `TranscriptMessage`（与 boot `LlmMessage` 同构，boot 改为组合 core）
- `ParticipantTranscript` + snapshot `transcripts`
- `TranscriptAccessRequest` + snapshot `transcriptAccessRequests`
- `CapabilityKind` 增 `transcript_read`；`CapabilityScope` 增 `transcript`
- integrity：transcript 的 actor 必须在 participants；跨域全文需要批准 capability
- 兼容：旧 wire 无新字段 → 空 map / default namespace

### P2 runtime durable（Postgres HA 或 etcd Raft）

- `createPostgresDurableCoordinator`：运维提供的 Postgres HA（ADR-0023）
- `createRaftDurableCoordinator`：官方 etcd Raft KV + Lease（ADR-0029；Ongaro–Ousterhout / etcd）
- 多宿主：`CANTILUNE_DURABLE_DATABASE_URL` **或** `CANTILUNE_RAFT_ENDPOINTS` / `CANTILUNE_RAFT_EMBED=1`；两者都无则 fail-closed
- 单宿主默认仍是 file CAS
- L7：fencing 互斥 + 崩溃恢复；无集群则显式失败，禁止 skipIf

### P3 observability 平台

- `redactFourViewBundle(bundle, access)`：同域全文；跨域摘要；有 `transcript_read` 则全文
- `projectionCertificateDigest`：只持 conformance digest，不复制证书类型
- OTel：`@opentelemetry/api` + OTLP/HTTP（Cantilune 导出已生产）；官方 `gen_ai.*` 键名仍标 Development
- AG-UI：标准事件（RUN\_\* / TEXT\_MESSAGE\_\* / TOOL\_CALL\_\* / STATE\_\* / REASONING\_\*）从 committed 世界+transcript 派生
- 跨副本：只读 Postgres head，禁止每副本各算 EventSpine

### P4 control-plane 租户与 fleet

- Domain/Namespace 注册 + RBAC（admin / member / observer）
- `requestTranscriptAccess` / `decideTranscriptAccess`（**目标 Actor 批准**）
- fleet 控制台：跨 Namespace 默认元数据+摘要；超管无自动全文
- 管理面仍走已有 NetTransport，不新开裸 HTTP

### P5 comms A2A 1.0 + typed mobility

按 [A2A 1.0.0](https://a2a-protocol.org/latest/specification/)：

- 数据模型：AgentCard、Task、Message、Part、Artifact、Extension
- 操作：Send Message / Streaming / Get·List·Cancel Task / Get Agent Card / push
- 绑定：JSON-RPC 2.0、HTTP/REST、SSE；gRPC 绑定（proto 对齐）
- 公开宣称：钉死 1.0.0 + 互操作文档；对端必须符合该版本
- typed mobility：频道/名字传递必须带 admission receipt；无收据 E-Stop

### P6 tools sandbox + MCP 热挂

- `OsSandbox`：`win32` → `docker run --isolation=hyperv`；`linux` → `--runtime=runsc`
- 探测失败 → 拒绝执行不可信 shell/fs/mcp（fail-closed）
- MCP：`/mcp connect|disconnect` 提交 schema admission；当前 turn 用旧工具面；下一 turn 用新 epoch
- HTTP 与 stdio MCP 均允许；热挂仍走 epoch admission，当前 turn 结束后生效

### P7 boot / CLI / 无人值守

- Agent loop 每完成一组 assistant+tool 后把 transcript **commit 进 snapshot**
- 无 `toolApprover` 为生产无人值守默认；危险工具只靠 sandbox + denyList
- `/swarm` 多机：directory + mTLS；对抗套件：伪造 pin、重放、分区
- `scripts/soak-24h.mjs`：本地/夜间默认 8h；CI 跑缩短 soak + 对抗

### P8 文档与发布

- RFC-0003 中文全译（不宣称 QA-L5）
- `diagrams/07-production/` 07A–07H
- README：可观测性平台、A2A 1.0、Owner-accepted、0.x、COI
- npm 0.x 发布清单（需你提供 `NPM_TOKEN` 才执行 `pnpm publish`）

---

## 4. 测试与门禁

- 各包 L2–L7；statements/functions/lines ≥90%、branches ≥88%
- 新增 L7：Postgres / etcd Raft fencing、sandbox fail-closed、跨域红action、A2A 1.0 正反例、MCP epoch 热挂、双进程对抗
- 8h soak **不**进 PR CI；进 `soak` workflow / 本地脚本
- 跨进程用例禁止 `beforeAll` 里 `pnpm build`；缺 `dist/` 显式失败

---

## 5. 发布口径（诚实）

**可以对外说**

- Owner-accepted 工程发布（0.x）
- 可观测性平台：committed-world 四角 + OTel/AG-UI/OTLP
- A2A 1.0.0 实现与公开互操作（对符合 1.0.0 的对端）
- 多机 mTLS mesh + Postgres HA 或官方 etcd Raft durable
- 生产隔离：Windows Hyper-V isolated / Linux gVisor

---

## 6. 验收清单

- [x] LICENSE + ADR-0021–0029 + 治理签核栏有你的名字与日期
- [x] snapshot 含 transcripts；同域可读、跨域摘要、目标 Actor 批准后全文
- [x] Postgres durable + 无 URL fail-closed（CLI/boot 经 `resolveProductionDurable`；活库 L7 在 CI `test:postgres-live`；本机 HA 套件 `deploy/postgres-ha` + `pnpm host:provision`）
- [x] 官方 etcd Raft durable + 无 endpoints/embed fail-closed（活库 L7 在 CI `test:raft-live`；本机套件 `deploy/etcd-raft` + `scripts/host/install-etcd.mjs`）
- [x] sandbox 两端探测 + fail-closed 测试（Hyper-V：`scripts/host/enable-hyperv.ps1`，Home SKU 按 Microsoft Learn 失败关闭；gVisor：官方 apt/tarball + WSL `install-gvisor-wsl.sh`，不把 Linux 容器报成 Hyper-V）
- [x] evaluation E7 预注册分析 + E8 四投影/理论预言机收集（分析层不发出 `supported`）
- [x] OTel OTLP + AG-UI 事件 + cert digest
- [x] Namespace RBAC + fleet 红action
- [x] A2A 1.0 操作与三绑定 + 官方 gRPC + 公开文档
- [x] MCP epoch 热挂（同 schema 工具面 epoch commit；TUI 仍不自签 FourView 证书）
- [x] 对抗 L7 + 8h soak 脚本 + `.github/workflows/soak.yml`（不进 PR CI）
- [x] RFC-0003 中文全译 + diagrams/07
- [x] 相关包测试与覆盖率门禁（默认套件；活 Postgres / etcd 为独立 CI job）
- [x] npm 0.x 元数据已就绪（`private: false` + `license` + `publishConfig`）；`pnpm publish` 仍等你的 `NPM_TOKEN`
- [x] FCP 入口记录 + Owner Formal / QA-L5 / AI-Eval 签字（COI）；Lean 未改 `reviewed`；`ownerAccept` 已记录
- [x] `pnpm check:0x` 纳入 `test:static`
- [x] WSL `Ubuntu-24.04` 已拉取 `alpine:3.20` 并经 `runsc` 冒烟
- [x] 8h soak 证据（run `2026-08-15T19-04-39-535Z`：1881 轮、0 失败；产物在 `.cantilune/soak/`，不进 PR CI）
- [x] SS-01 解除：`@cantilune/conformance` 为 0.x 生产发布权限（仍不自动签 Acceptance cert）
