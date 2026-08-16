# ADR-0026: Epoch-Bound MCP Hot Attach

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-15                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0006, MCP 2026-07-28                                             |

## Context

MCP 2026-07-28 is stateless (`server/discover`, no protocol session). Cantilune still binds the visible tool surface to a schema epoch. Mid-turn tool-set mutation would break admission monotonicity.

## Decision

1. `/mcp connect|disconnect` is allowed on a live OS.
2. Each change submits schema admission and, on commit, a new epoch.
3. The **current LLM turn** keeps the old tool surface. The next turn uses the new epoch.
4. HTTP and stdio MCP are both allowed. Hot-attach still requires a schema admission receipt that advances the epoch; the current turn keeps the old tool surface.
5. Discover/list cache invalidates on epoch change.

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-15
