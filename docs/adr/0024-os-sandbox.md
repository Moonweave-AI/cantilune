# ADR-0024: Production OS Sandbox (Hyper-V + gVisor)

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-15                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0011, ADR-0016                                                   |

## Context

Process deny-lists are not production isolation. Linux production isolation for untrusted agent tools is gVisor `runsc` (userspace kernel) or Firecracker. Windows production isolation is **Hyper-V isolated Windows containers** (separate kernel), not Docker Desktop process isolation.

## Decision

1. `OsSandbox` is required for untrusted shell / filesystem / MCP child processes.
2. `win32` → `docker run --isolation=hyperv` (or equivalent HCS Hyper-V isolate).
3. `linux` → `docker run --runtime=runsc`.
4. If the runtime cannot be probed, execution **fail-closed**. No silent downgrade to host process.
5. Evaluation judge isolation (ADR-0020 D6) remains; this ADR covers operator tool execution.
6. `probeSandboxHost` auto-detects: Windows = `Win32_ComputerSystem.HypervisorPresent` + VMMS + `docker --isolation=hyperv`; Linux = `runsc` on PATH + `docker --runtime=runsc`. `/status` and `scripts/verify-host.mjs` report; `CANTILUNE_HOST_MODE=multi` or `CANTILUNE_REQUIRE_SANDBOX=1` fail-closed at start. Operator enablement: `scripts/host/enable-hyperv.ps1` (Microsoft Hyper-V isolated containers) and `scripts/host/install-gvisor.sh` (official `runsc` apt/tarball + `runsc install`). Windows sandbox may target `CANTILUNE_DOCKER_CONTEXT=desktop-windows` so Linux compose and Hyper-V isolation do not share one engine.
7. Microsoft Learn: the Hyper-V role **cannot** be installed on Windows 10/11 Home. Do not apply unofficial Home-SKU Hyper-V patches, and do not report Linux containers as Hyper-V isolation. On an unsupported SKU, the operator Linux engine is a dedicated WSL distro running Docker Engine + official gVisor (`scripts/host/install-gvisor-wsl.sh`, default `Ubuntu-24.04`). That path is labeled `runsc`, never `hyperv`. Auto-select `runsc` only when the SKU cannot host Hyper-V **and** that distro probes ready. Explicit `CANTILUNE_SANDBOX_ISOLATION=hyperv` stays fail-closed.

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-15
