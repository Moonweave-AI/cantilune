// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import "../setup/inkSetup.js";
import { ClusterView, renderClusterViewOutput } from "../../src/views/ClusterView.js";
import ClusterViewContainer from "../../src/views/ClusterView.js";
import { SwarmView, renderSwarmViewOutput } from "../../src/views/SwarmView.js";
import SwarmViewContainer from "../../src/views/SwarmView.js";
import { ToolsView, renderToolsViewOutput } from "../../src/views/ToolsView.js";
import ToolsViewContainer from "../../src/views/ToolsView.js";
import { McpView, renderMcpViewOutput } from "../../src/views/McpView.js";
import McpViewContainer from "../../src/views/McpView.js";
import { ConfigView, renderConfigViewOutput } from "../../src/views/ConfigView.js";
import ConfigViewContainer from "../../src/views/ConfigView.js";
import { StatusView, renderStatusViewOutput } from "../../src/views/StatusView.js";
import StatusViewContainer from "../../src/views/StatusView.js";
import { SessionView, renderSessionViewOutput } from "../../src/views/SessionView.js";
import SessionViewContainer from "../../src/views/SessionView.js";
import { createStore, type AppStore, type SnapshotData } from "../../src/store.js";

const SNAPSHOT: SnapshotData = {
  snapshotRef: "snap:1",
  epochId: "epoch:1",
  participants: [
    { id: "agent:planner", kind: "agent", status: "active" },
    { id: "agent:worker", kind: "agent", status: "waiting" },
    { id: "agent:retired", kind: "agent", status: "retired" },
  ],
  artifacts: [{ id: "art:1", kind: "doc", lifecycle: "draft" }],
  sessions: [{ id: "sess:1", initiator: "agent:planner", status: "open" }],
  capabilities: [{ id: "cap:1", kind: "write", holder: "agent:worker" }],
  links: [{ from: "agent:planner", to: "agent:worker", kind: "delegates" }],
  auditTail: [],
  retired: [],
};

function connectedStore(overrides?: Partial<AppStore>): AppStore {
  return createStore({
    connected: true,
    runtime: {
      snapshot: SNAPSHOT,
      epoch: { epochId: "epoch:1", ordinal: 1, schemaId: "schema:1" },
      changeLog: [
        {
          changeId: "chg:1",
          operationTypeId: "register_participant",
          initiator: "agent:planner",
          beforeRef: "snap:0",
          afterRef: "snap:1",
          timestamp: "2026-01-01T00:00:00Z",
        },
        {
          changeId: "chg:2",
          operationTypeId: "emit_heartbeat",
          initiator: "agent:worker",
          beforeRef: "snap:1",
          afterRef: "snap:2",
          timestamp: "2026-01-01T00:00:05Z",
        },
        {
          changeId: "chg:3",
          operationTypeId: "signal_done",
          initiator: "agent:worker",
          beforeRef: "snap:2",
          afterRef: "snap:3",
          timestamp: "2026-01-01T00:00:09Z",
        },
      ],
    },
    ...overrides,
  });
}

describe("ClusterView", () => {
  it("tells the user to start a run when nothing is connected", () => {
    const output = renderClusterViewOutput("cluster", createStore());
    expect(output).toContain("No runtime connected");
  });

  it("counts total and live agents in the overview", () => {
    const output = renderClusterViewOutput("cluster", connectedStore());
    expect(output).toContain("Supervisor: not connected");
    expect(output).toContain("3 total, 2 live");
    expect(output).toContain("agent:planner");
  });

  it("summarises liveness signals in the status view", () => {
    const output = renderClusterViewOutput("cluster-status", connectedStore());
    expect(output).toContain("Registrations: 1");
    expect(output).toContain("Heartbeats: 1");
    expect(output).toContain("Done signals: 1");
    expect(output).toContain("2026-01-01T00:00:05Z");
  });

  it("lists links and sessions in the topology view", () => {
    const output = renderClusterViewOutput("cluster-topology", connectedStore());
    expect(output).toContain("Links (1)");
    expect(output).toContain("Sessions (1)");
    expect(output).toContain("delegates");
  });

  it("describes a flat peer set when there are no links yet", () => {
    const store = connectedStore({
      runtime: {
        snapshot: { ...SNAPSHOT, links: [], sessions: [] },
        epoch: null,
        changeLog: [],
      },
    });
    const output = renderClusterViewOutput("cluster-topology", store);
    expect(output).toContain("flat peer set");
    expect(output).toContain("agent:planner [active]");
  });

  it("reports no runtime for status and topology alike", () => {
    expect(renderClusterViewOutput("cluster-status", createStore())).toContain("No runtime");
    expect(renderClusterViewOutput("cluster-topology", createStore())).toContain("No runtime");
  });

  it("renders each cluster sub-view", () => {
    for (const view of ["cluster", "cluster-status", "cluster-topology"] as const) {
      const { container } = render(<ClusterView store={connectedStore()} activeView={view} />);
      expect(container.textContent).toContain("Cluster");
    }
    render(<ClusterViewContainer />);
    render(<ClusterViewContainer activeView="cluster-status" viewArgs={{}} />);
  });
});

describe("ToolsView", () => {
  it("lists the builtin syscall surface", () => {
    const output = renderToolsViewOutput("tools", connectedStore(), {});
    expect(output).toContain("register_participant");
    expect(output).toContain("emit_heartbeat");
    expect(output).toContain("runtime connected");
  });

  it("notes when no runtime is attached", () => {
    expect(renderToolsViewOutput("tools", createStore(), {})).toContain("not connected");
  });

  it("explains that coordination tools go through admission", () => {
    const output = renderToolsViewOutput("tools-test", createStore(), { name: "delegate" });
    expect(output).toContain("Tool: delegate");
    expect(output).toContain("runtime admission");
  });

  it("explains that loop tools bypass admission", () => {
    const output = renderToolsViewOutput("tools-test", createStore(), { name: "read_content" });
    expect(output).toContain("handled directly by the agent loop");
  });

  it("lists the alternatives for an unknown tool", () => {
    const output = renderToolsViewOutput("tools-test", createStore(), { name: "teleport" });
    expect(output).toContain("Unknown tool: teleport");
    expect(output).toContain("Available builtin tools");
  });

  it("renders both tool sub-views", () => {
    const registry = render(<ToolsView store={createStore()} activeView="tools" />);
    expect(registry.container.textContent).toContain("Registry");

    const dryRun = render(
      <ToolsView store={createStore({ viewArgs: { name: "done" } })} activeView="tools-test" />,
    );
    expect(dryRun.container.textContent).toContain("Dry Run");

    render(<ToolsViewContainer />);
    render(<ToolsViewContainer activeView="tools-test" viewArgs={{ name: "done" }} />);
  });
});

describe("McpView", () => {
  it("explains that no servers are attached by default", () => {
    const output = renderMcpViewOutput("mcp", {});
    expect(output).toContain("No servers in CliConfig.mcpServers");
  });

  it("accepts HTTP MCP URLs and still requires epoch-bound attach", () => {
    const output = renderMcpViewOutput("mcp-connect", { url: "http://localhost:9000" });
    expect(output).toContain("http://localhost:9000");
    expect(output).toContain("Requested HTTP MCP");
  });

  it("accepts a stdio MCP spec", () => {
    const output = renderMcpViewOutput("mcp-connect", { url: "docs=npx mcp-server" });
    expect(output).toContain("stdio MCP");
  });

  it("mentions a persisted spec before scheduling", () => {
    const output = renderMcpViewOutput("mcp-connect", {
      url: "docs=npx mcp-server",
      persisted: true,
    });
    expect(output).toContain("Wrote CliConfig.mcpServers.");
  });

  it("explains a scheduled epoch-bound attach", () => {
    const output = renderMcpViewOutput("mcp-connect", {
      url: "docs=npx mcp-server",
      scheduled: true,
    });
    expect(output).toContain("epoch-bound attach");
  });

  it("renders disconnect scheduling and errors", () => {
    expect(renderMcpViewOutput("mcp-disconnect", { name: "docs", scheduled: true })).toContain(
      "epoch-bound detach",
    );
    expect(
      renderMcpViewOutput("mcp-disconnect", { name: "docs", error: "not connected" }),
    ).toContain("not connected");
    expect(renderMcpViewOutput("mcp-disconnect", { name: "docs" })).toContain("/mcp disconnect");
  });

  it("lists persisted stdio and HTTP servers", () => {
    const output = renderMcpViewOutput("mcp", {}, [
      "docs=npx -y server",
      "https://mcp.example/sse",
    ]);
    expect(output).toContain("docs stdio npx");
    expect(output).toContain("mcp.example http https://mcp.example/sse");
  });

  it("renders both MCP sub-views", () => {
    const servers = render(<McpView store={createStore()} activeView="mcp" />);
    expect(servers.container.textContent).toContain("Servers");

    const connect = render(
      <McpView store={createStore({ viewArgs: { url: "http://x" } })} activeView="mcp-connect" />,
    );
    expect(connect.container.textContent).toContain("Connect");

    const disconnect = render(
      <McpView store={createStore({ viewArgs: { name: "docs" } })} activeView="mcp-disconnect" />,
    );
    expect(disconnect.container.textContent).toContain("Disconnect");

    render(<McpViewContainer />);
    render(<McpViewContainer activeView="mcp-connect" viewArgs={{ url: "http://x" }} />);
    render(<McpViewContainer activeView="mcp-disconnect" viewArgs={{ name: "docs" }} />);
  });
});

describe("ConfigView", () => {
  it("shows the effective settings and where they live", () => {
    const output = renderConfigViewOutput(createStore({ provider: "openai", model: "gpt-4o" }));
    expect(output).toContain("provider");
    expect(output).toContain("gpt-4o");
    expect(output).toContain("config.json");
  });

  it("reports auto when no theme has been pinned", () => {
    expect(renderConfigViewOutput(createStore())).toContain("auto (detected)");
  });

  it("reports the pinned theme once one is chosen", () => {
    expect(renderConfigViewOutput(createStore({ theme: "daylight" }))).toContain("daylight");
  });

  it("reports key presence without ever echoing the key", () => {
    const previous = process.env.OPENAI_API_KEY;
    try {
      process.env.OPENAI_API_KEY = "sk-super-secret-value";
      const output = renderConfigViewOutput(createStore({ provider: "openai" }));
      expect(output).toContain("set via OPENAI_API_KEY");
      expect(output).not.toContain("sk-super-secret-value");
    } finally {
      if (previous === undefined) delete process.env.OPENAI_API_KEY;
      else process.env.OPENAI_API_KEY = previous;
    }
  });

  it("tells the user which variable to export when the key is missing", () => {
    const previous = process.env.OPENAI_API_KEY;
    try {
      delete process.env.OPENAI_API_KEY;
      const output = renderConfigViewOutput(createStore({ provider: "openai" }));
      expect(output).toContain("MISSING — export OPENAI_API_KEY");
    } finally {
      if (previous !== undefined) process.env.OPENAI_API_KEY = previous;
    }
  });

  it("distinguishes a started runtime from a cold one", () => {
    expect(renderConfigViewOutput(createStore({ connected: true, durable: "file" }))).toContain(
      "connected (file)",
    );
    expect(renderConfigViewOutput(createStore({ connected: true, durable: "memory" }))).toContain(
      "connected (memory)",
    );
    expect(renderConfigViewOutput(createStore({ connected: false }))).toContain("not started");
    expect(
      renderConfigViewOutput(
        createStore({ connected: true, durable: "file", storagePath: undefined }),
      ),
    ).toContain("(unset)");
    expect(renderConfigViewOutput(createStore({ connected: true, durable: "memory" }))).toContain(
      "in-memory (dev)",
    );
  });

  it("renders the config panel", () => {
    const { container } = render(<ConfigView store={createStore()} />);
    expect(container.textContent).toContain("Configuration");
    render(<ConfigViewContainer />);
  });
});

describe("StatusView", () => {
  it("reports durable mode and turn budget", () => {
    const output = renderStatusViewOutput(
      createStore({ connected: true, durable: "file", storagePath: "/tmp/os" }),
    );
    expect(output).toContain("file");
    expect(output).toContain("/tmp/os");
    const { container } = render(<StatusView store={createStore({ connected: true })} />);
    expect(container.textContent).toContain("Status");
    render(<StatusViewContainer />);
  });

  it("covers memory durable, missing path, running agent, and zero maxTurns", () => {
    expect(renderStatusViewOutput(createStore({ durable: "memory", connected: false }))).toContain(
      "in-memory (dev)",
    );
    expect(
      renderStatusViewOutput(createStore({ durable: "file", storagePath: undefined })),
    ).toContain("(unset)");
    expect(renderStatusViewOutput(createStore({ agentRunning: true }))).toContain("running");
    expect(
      renderStatusViewOutput(
        createStore({
          viewArgs: {
            host: {
              platform: "win32",
              postgres: {
                urlConfigured: false,
                host: "127.0.0.1",
                port: 5432,
                tcpReachable: false,
                haReady: false,
                reason: "unset",
              },
              sandbox: {
                platform: "win32",
                isolation: "hyperv",
                isolationReady: false,
                dockerAvailable: false,
                hypervisorPresent: true,
                vmmsRunning: false,
                reason: "VMMS",
              },
              raft: {
                endpointsConfigured: false,
                embedRequested: false,
                endpoints: [],
                host: "127.0.0.1",
                port: 2379,
                tcpReachable: false,
                ready: false,
                reason: "unset",
              },
              required: { postgresHa: false, raft: false, sandbox: false, multi: false },
              ok: true,
              failClosedReasons: [],
            },
          },
        }),
      ),
    ).toContain("sandbox.isolation:");
    const { container } = render(
      <StatusView
        store={createStore({ maxTurns: 0, session: { ...createStore().session, turnCount: 3 } })}
      />,
    );
    expect(container.textContent).toContain("turns");
  });
});

describe("SessionView", () => {
  it("lists saved slots and surfaces errors", () => {
    expect(renderSessionViewOutput({})).toContain("No saved session slots");
    expect(renderSessionViewOutput({ error: "disk full" })).toContain("disk full");
    expect(renderSessionViewOutput({ slots: [null, "x", { name: 1 }] })).toContain(
      "No saved session slots",
    );
    expect(
      renderSessionViewOutput({
        slots: [
          { name: "alpha", savedAt: "2026-01-01T00:00:00.000Z", turnCount: 2, messageCount: 4 },
        ],
      }),
    ).toContain("alpha");
    const { container } = render(
      <SessionView
        store={createStore({
          viewArgs: {
            slots: [
              { name: "alpha", savedAt: "2026-01-01T00:00:00.000Z", turnCount: 2, messageCount: 4 },
            ],
          },
        })}
      />,
    );
    expect(container.textContent).toContain("Session slots");
    render(<SessionViewContainer />);
  });
});

describe("SwarmView", () => {
  it("tells the user to start a run when nothing is connected", () => {
    const output = renderSwarmViewOutput("swarm", createStore());
    expect(output).toContain("No runtime connected");
  });

  it("shows the not-connected swarm line when no controller is attached", () => {
    const output = renderSwarmViewOutput("swarm", connectedStore());
    expect(output).toContain("Swarm: not connected");
    expect(output).toContain("Agent pool: 0 active handles");
  });

  it("shows the running swarm line + agent pool count from prefetched status", () => {
    const store = connectedStore();
    store.viewArgs = {
      swarmStatus: {
        running: true,
        agents: new Map([["agent:worker", { status: "active", heartbeat: 0 }]]),
        events: [],
      },
    };
    const output = renderSwarmViewOutput("swarm", store, store.viewArgs);
    expect(output).toContain("Swarm: running");
    expect(output).toContain("Agent pool: 1 active handle");
  });

  it("pluralizes the agent pool count", () => {
    const store = connectedStore();
    store.viewArgs = {
      swarmStatus: {
        running: true,
        agents: new Map([
          ["agent:a", { status: "active", heartbeat: 0 }],
          ["agent:b", { status: "active", heartbeat: 0 }],
        ]),
        events: [],
      },
    };
    const output = renderSwarmViewOutput("swarm", store, store.viewArgs);
    expect(output).toContain("Agent pool: 2 active handles");
  });

  it("summarises liveness signals in the status view", () => {
    const output = renderSwarmViewOutput("swarm-status", connectedStore());
    expect(output).toContain("Heartbeats: 1");
    expect(output).toContain("Done signals: 1");
  });

  it("renders captured swarm events in the status view", () => {
    const store = connectedStore();
    store.viewArgs = {
      swarmStatus: {
        running: false,
        agents: new Map(),
        events: [
          { kind: "agent_started", actorId: "agent:worker", timestamp: 0 },
          { kind: "agent_done", actorId: "agent:worker", summary: "ok", timestamp: 1 },
        ],
      },
    };
    const output = renderSwarmViewOutput("swarm-status", store, store.viewArgs);
    expect(output).toContain("Swarm events (2)");
    expect(output).toContain("agent_started agent:worker");
    expect(output).toContain("agent_done agent:worker — ok");
  });

  it("reports no runtime for status alike", () => {
    expect(renderSwarmViewOutput("swarm-status", createStore())).toContain("No runtime");
  });

  it("renders each swarm sub-view", () => {
    for (const view of ["swarm", "swarm-status"] as const) {
      const { container } = render(<SwarmView store={connectedStore()} activeView={view} />);
      expect(container.textContent).toContain("Swarm");
    }
    render(<SwarmViewContainer />);
    render(<SwarmViewContainer activeView="swarm-status" viewArgs={{}} />);
  });
});
