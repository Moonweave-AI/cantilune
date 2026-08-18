# @cantilune/website-server — 项目结构 (Project Structure)

> 本地 Node 后端：托管 Cantilune 包并把 AgentEvents 流式推送给网站客户端 (ADR-0030)。
> 位于 Cantilune monorepo 的 `src/website/server`，包名 `@cantilune/website-server` v0.0.1，
> ESM (`"type": "module"`)，Apache-2.0。

```
src/website/server/
├── package.json                     # 包元数据 + workspace 依赖 + npm scripts
├── tsconfig.json                    # extends ../../../tsconfig.base.json; rootDir ".." → outDir "dist"
├── src/
│   ├── index.ts                     # ★ 入口：localhost-only HTTP + WebSocket 服务器
│   ├── bridge.ts                    # ★ BridgeSession：ADR-0030 权威侧核心会话逻辑
│   ├── worldSnapshot.ts             # CollaborationSnapshot → WorldSnapshotWire 投影
│   ├── pickDirectory.ts             # 跨平台原生"选择目录"对话框
│   ├── winVistaFolderDialog.cs      # Windows Vista+ IFileOpenDialog 的 C# 源码（文件夹选择）
│   ├── integrationSmoke.mjs         # 集成测试：mock LLM 冒烟（run 全链路）
│   ├── integrationDeny.mjs          # 集成测试：工具审批 DENY 路径
│   ├── integrationEstop.mjs         # 集成测试：E-Stop 中止运行
│   ├── integrationSwarm.mjs         # 集成测试：swarm start/stop/status
│   └── integrationReal.mjs          # 集成测试：真实 LLM 提供商（默认 DashScope）
├── dist/                            # tsc 编译产物（git 可忽略/构建生成）
│   ├── server/src/                  #   index.js / bridge.js / worldSnapshot.js (+ .d.ts/.map)
│   └── shared/protocol.js           #   编译自 src/website/shared/protocol.ts（共享协议，包外兄弟目录）
├── node_modules/                    # 依赖（含 @cantilune/* workspace 链接）
└── .cantilune/                      # 协调 OS 运行时状态（内容存储/durable bundle/锁）— 非项目源码
```

## 关键模块说明

### src/index.ts — 服务器入口
- 监听 `127.0.0.1:7474`（`CANTILUNE_WEBSITE_PORT` / `CANTILUNE_WEBSITE_HOST` 可覆盖）。
- 仅允许回环 Origin（`:7474` 与 Vite dev `:5173`），否则 `1008 origin not allowed`。
- 每个 WebSocket 连接 → 一个 `BridgeSession`；HTTP GET 返回 `{service, status:"ok"}`。
- `SIGINT`/`SIGTERM` 优雅关闭（先关全部 session 再关 server）。

### src/bridge.ts — BridgeSession（核心）
- `configure`：复用 CLI 同款生产路径 `createCliRuntimeBoot` + `createCliToolSet`
  从客户端配置启动 OS（provider/model/durable/contentStore/阈值/MCP/搜索提供商等），
  并构建 swarm 控制器（`createSwarmController`）。密钥只存于服务端内存。
- `run`：单飞模式驱动 `os.run()`，通过 `onEvent` 流式回传所有 AgentEvent
  （turn_start → llm_* → tool_* → control_verdict(含 TerminationAudit) → run_result），
  每轮提交后推送 world snapshot。
- 工具审批：`ToolApprover` 按 `runMode`（execute/plan/observe）+ `alwaysAllow` 决策，
  plan 模式把 `approval_request` 转发给浏览器等待 allow/deny；observe 直接拒绝。
- `stop`：`AbortController.abort()` → E-Stop。
- `ask_user`：转发浏览器并等待回复。
- Swarm 控制：`swarm:start/stop/activate/status`；1s 轮询推送 `swarm:status`，
  并转发最新 3 条 cluster_event 供前端动画。
- `verdictToWire`：把运行期 `ControlVerdict` + `TerminationAudit`（H/C/U/VOC*、criterionEvals、
  decisionChain）投影为线格式。

### src/worldSnapshot.ts
- 复用 CLI 的 `snapshotToData`，保证 world 面板与 `/world` 输出完全一致。

### src/pickDirectory.ts + winVistaFolderDialog.cs
- Windows：PowerShell `Add-Type` 编译 `VistaFolderDialog`（IFileOpenDialog 文件夹选择，
  源码缺失时用内嵌 `EMBEDDED_CS` 兜底）；macOS：`osascript choose folder`；Linux：`zenity`。

### 集成测试（node src/integration*.mjs，需先 build）
| 脚本 | 端口 | 验证点 |
|---|---|---|
| integrationSmoke | 7475 | mock SSE LLM 返回单次 `done`，断言 turn_start/llm_end/control_verdict/run_result(ok) + world |
| integrationDeny | 7477 | mock 调用 side-effect 工具 → approval_request → deny → tool_end ok:false，run 恢复 |
| integrationEstop | 7478 | 慢速流中 `stop` → run_result ok:false + terminationReason:"aborted" |
| integrationSwarm | 7479 | swarm start → status(running:true) → stop → status(running:false) |
| integrationReal | 7476 | 真实提供商（默认 dashscope/qwen-turbo，`CANTILUNE_TEST_API_KEY` 仅从环境读取） |

## 共享协议（dist/shared/protocol.js，源码位于包外 src/website/shared/protocol.ts）
- `ClientMessage`：configure / run / askUser:reply / approve / stop / inspect / swarm:start / swarm:stop / swarm:activate / swarm:status。
- `ServerMessage`：ready（提供商目录）/ agent_event / approval_request / cluster_event / swarm:status / run_result / world / error。
- `AgentEventWire`：turn_start / llm_start / llm_delta / llm_end / tool_start / tool_end / turn_end / error / control_verdict / ask_user / diagnostic。
- `ControlVerdictKindWire`：DONE / CONTINUE / VERIFY / ASK_USER / REPLAN / STALLED。
- 约束：该模块不得 import `node:*` 或任何 Node-only 的 Cantilune 包，供 server/client 两端共用。

## npm scripts
- `dev`: pnpm exec tsx watch src/index.ts · `build`: tsc -p tsconfig.json
- `start`: node dist/server/src/index.js · `typecheck`: tsc --noEmit
- `smoke` / `smoke:deny` / `smoke:estop` / `smoke:swarm` / `smoke:real` / `smoke:all`
- `clean`: 删除 dist

## 依赖
- workspace: @cantilune/adapter, boot, cli, core, runtime, syscall · 外部: ws ^8.18.0
- dev: @types/node, @types/ws, tsx, typescript
