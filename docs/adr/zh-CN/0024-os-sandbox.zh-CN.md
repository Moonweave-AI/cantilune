# ADR-0024：生产 OS 沙箱（Hyper-V + gVisor）

| 字段       | 值                                                          |
| ---------- | ----------------------------------------------------------- |
| 状态       | **Accepted**                                                |
| 日期       | 2026-08-15                                                  |
| 决策负责人 | Joker-of-Gotham                                             |
| 评审人     | Joker-of-Gotham（独立 Architecture + Security；COI 已披露） |
| 相关       | ADR-0011、ADR-0016                                          |
| 取代       | 无                                                          |
| 被取代     | 无                                                          |

> 英文正文为唯一权威来源：[`docs/adr/0024-os-sandbox.md`](../0024-os-sandbox.md)。

## 背景

进程拒绝列表不是生产隔离。Linux 上不可信 agent 工具的生产隔离是 gVisor `runsc`（用户态内核）或 Firecracker。Windows 上的生产隔离是 **Hyper-V 隔离的 Windows 容器**（独立内核），而不是 Docker Desktop 进程隔离。

## 决策

1. 不可信的 shell / filesystem / MCP 子进程必须使用 `OsSandbox`。
2. `win32` → `docker run --isolation=hyperv`（或等价的 HCS Hyper-V isolate）。
3. `linux` → `docker run --runtime=runsc`。
4. 若运行时无法探测，执行**失败关闭**。禁止静默降级到宿主进程。
5. 评测评判器隔离（ADR-0020 D6）仍然有效；本 ADR 覆盖运维工具执行。
6. `probeSandboxHost` 按系统自动探测：Windows = `Win32_ComputerSystem.HypervisorPresent` + VMMS + `docker --isolation=hyperv`；Linux = PATH 上的 `runsc` + `docker --runtime=runsc`。`/status` 与 `scripts/verify-host.mjs` 只报告；`CANTILUNE_HOST_MODE=multi` 或 `CANTILUNE_REQUIRE_SANDBOX=1` 启动时失败关闭。运维启用：`scripts/host/enable-hyperv.ps1`（Microsoft Hyper-V isolated containers）与 `scripts/host/install-gvisor.sh`（官方 `runsc` apt/tarball + `runsc install`）。Windows 沙箱可用 `CANTILUNE_DOCKER_CONTEXT=desktop-windows`，以免与 Linux compose 争用同一引擎。
7. Microsoft Learn：Windows 10/11 Home **不能**安装 Hyper-V 角色。禁止用非官方 Home SKU 补丁，也禁止把 Linux 容器报成 Hyper-V isolation。在不支持的 SKU 上，运维 Linux 引擎是独立 WSL 发行版 + Docker Engine + 官方 gVisor（`scripts/host/install-gvisor-wsl.sh`，默认 `Ubuntu-24.04`）。该路径标记为 `runsc`，永不标记为 `hyperv`。仅当 SKU 无法承载 Hyper-V **且**该发行版探测就绪时才自动选择 `runsc`。显式 `CANTILUNE_SANDBOX_ISOLATION=hyperv` 仍失败关闭。

## 批准

**Architecture + Security**：Joker-of-Gotham（COI 已披露）  
**日期**：2026-08-15
