/**
 * Tool-approval DENY path test for the website bridge (ADR-0030 §6).
 *
 * A mock SSE LLM calls a side-effecting tool (`write_file`); the bridge emits
 * `approval_request`; this client replies `deny`; the bridge resolves the
 * ToolApprover with `{allowed:false}`; we assert the tool is NOT executed and
 * the run continues (the loop should recover or stall, not crash).
 *
 * Unverified until run.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { once } from "node:events";

const MOCK_PORT = 9877;
const BRIDGE_PORT = 7477;

let callCount = 0;

function startMockLlm() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url !== "/v1/chat/completions") {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      callCount += 1;
      const first = callCount === 1;
      const frame1 = first
        ? {
            // Turn 1: call a side-effecting tool (shell) → triggers approval.
            choices: [
              {
                index: 0,
                delta: {
                  role: "assistant",
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_sh_1",
                      type: "function",
                      function: { name: "tool:shell_run_command", arguments: '{"command":"echo hi"}' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          }
        : {
            // Turn 2+: after denial, call `done` to finish cleanly.
            choices: [
              {
                index: 0,
                delta: {
                  role: "assistant",
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_done_n",
                      type: "function",
                      function: { name: "done", arguments: '{"summary":"recovered after denial"}' },
                    },
                  ],
                },
                finish_reason: null,
              },
            ],
          };
      const frame2 = {
        choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };
      res.write(`data: ${JSON.stringify(frame1)}\n\n`);
      res.write(`data: ${JSON.stringify(frame2)}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const mock = await startMockLlm();
  const bridge = spawn(process.execPath, ["dist/server/src/index.js"], {
    env: { ...process.env, CANTILUNE_WEBSITE_PORT: String(BRIDGE_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  bridge.stdout.on("data", (d) => process.stdout.write(`[bridge] ${d}`));
  bridge.stderr.on("data", (d) => process.stderr.write(`[bridge!] ${d}`));
  await once(bridge.stdout, "data");

  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`, {
    origin: "http://localhost:5173",
  });
  const events = [];
  const allMessages = [];
  let runResult = null;
  let ready = false;
  let approvalRequest = null;

  await new Promise((r, e) => {
    ws.addEventListener("open", () => r(), { once: true });
    ws.addEventListener("error", e, { once: true });
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data.toString());
    allMessages.push(msg);
    if (msg.type === "ready") ready = true;
    else if (msg.type === "agent_event") events.push(msg.event);
    else if (msg.type === "approval_request") approvalRequest = msg;
    else if (msg.type === "run_result") runResult = msg;
    else if (msg.type === "error") console.error("server error:", msg.message);
  });

  await new Promise((r) => setTimeout(r, 200));
  if (!ready) throw new Error("no ready");

  ws.send(
    JSON.stringify({
      type: "configure",
      provider: "openai",
      model: "mock-model",
      baseUrl: `http://127.0.0.1:${MOCK_PORT}/v1`,
      apiKey: "test-key",
      durable: "memory",
      maxTurns: 5,
    }),
  );
  await new Promise((r) => setTimeout(r, 400));
  ws.send(JSON.stringify({ type: "run", instruction: "Write a file then finish." }));

  // Wait for the approval_request (up to 10s).
  const approvalDeadline = Date.now() + 10000;
  while (approvalRequest === null && Date.now() < approvalDeadline) {
    await new Promise((r) => setTimeout(r, 100));
  }
  if (approvalRequest === null) {
    console.error("FAIL: no approval_request; events:", events.map((e) => e.kind).join(" "));
    ws.close();
    bridge.kill();
    mock.close();
    process.exit(1);
  }
  console.log("OK approval_request for tool:", approvalRequest.name, "id:", approvalRequest.toolCallId);

  // DENY it.
  ws.send(
    JSON.stringify({
      type: "approve",
      toolCallId: approvalRequest.toolCallId,
      decision: "deny",
    }),
  );

  // Wait for run_result (up to 20s).
  const deadline = Date.now() + 20000;
  while (runResult === null && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
  }

  ws.close();
  bridge.kill();
  mock.close();

  if (runResult === null) {
    console.error("FAIL: no run_result after deny");
    process.exit(1);
  }

  const kinds = events.map((e) => e.kind);
  console.log("agent events:", kinds.join(" "));
  console.log("server message types:", allMessages.map((m) => m.type).join(" "));
  // Find the tool_end for the denied call.
  const deniedToolEnd = events.find(
    (e) => e.kind === "tool_end" && e.toolCallId === approvalRequest.toolCallId,
  );
  console.log("denied tool_end ok:", deniedToolEnd?.ok, "output:", JSON.stringify(deniedToolEnd?.output));
  console.log("run_result ok:", runResult.ok, "reason:", runResult.terminationReason, "turns:", runResult.turns);

  const sawApproval = approvalRequest !== null;
  const denied = deniedToolEnd?.ok === false;
  const ok = sawApproval && denied;
  if (!ok) {
    console.error(`FAIL: sawApproval=${sawApproval} denied=${denied}`);
    process.exit(1);
  }
  console.log("PASS: deny path — approval_request emitted, tool_end ok:false after denial, run recovered");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
