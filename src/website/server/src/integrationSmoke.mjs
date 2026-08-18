/**
 * Live integration test for the website bridge (ADR-0030 §6 / Phase 1 L6).
 *
 * Starts a mock OpenAI-compatible LLM server that returns a single `done`
 * tool call, starts the bridge, connects a WS client, configures against the
 * mock, runs an instruction, and asserts the AgentEvent stream + run_result.
 *
 * Run: node src/integrationSmoke.mjs  (from src/website/server, after build)
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { once } from "node:events";

const MOCK_PORT = 9876;
const BRIDGE_PORT = 7475;

function startMockLlm() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url === "/v1/chat/completions") {
        // The agent loop prefers streaming (llm.stream). Emit an SSE stream
        // carrying one `done` tool call so the loop completes in one turn.
        res.writeHead(200, {
          "content-type": "text/event-stream",
          "cache-control": "no-cache",
          connection: "keep-alive",
        });
        const frame1 = {
          choices: [
            {
              index: 0,
              delta: {
                role: "assistant",
                tool_calls: [
                  { index: 0, id: "call_done_1", type: "function", function: { name: "done", arguments: '{"summary":"hello from mock"}' } },
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
        return;
      }
      if (req.url === "/v1/models") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ data: [{ id: "mock-model" }] }));
        return;
      }
      res.writeHead(404);
      res.end("not found");
    });
    server.listen(MOCK_PORT, "127.0.0.1", () => resolve(server));
  });
}

async function main() {
  const mock = await startMockLlm();
  console.log("mock LLM on", MOCK_PORT);

  const bridge = spawn(process.execPath, ["dist/server/src/index.js"], {
    env: { ...process.env, CANTILUNE_WEBSITE_PORT: String(BRIDGE_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });
  bridge.stdout.on("data", (d) => process.stdout.write(`[bridge] ${d}`));
  bridge.stderr.on("data", (d) => process.stderr.write(`[bridge!] ${d}`));

  await once(bridge.stdout, "data"); // "listening"

  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`, {
    origin: "http://localhost:5173",
  });

  const events = [];
  const allMessages = [];
  let runResult = null;
  let ready = false;

  await new Promise((resolve, reject) => {
    ws.addEventListener("open", () => resolve(), { once: true });
    ws.addEventListener("error", reject, { once: true });
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data.toString());
    allMessages.push(msg);
    if (msg.type === "ready") ready = true;
    else if (msg.type === "agent_event") events.push(msg.event);
    else if (msg.type === "run_result") runResult = msg;
    else if (msg.type === "error") console.error("server error:", msg.message);
  });

  // wait for ready
  await new Promise((r) => setTimeout(r, 200));
  if (!ready) throw new Error("no ready");
  console.log("OK ready");

  ws.send(JSON.stringify({
    type: "configure",
    provider: "openai",
    model: "mock-model",
    baseUrl: `http://127.0.0.1:${MOCK_PORT}/v1`,
    apiKey: "test-key",
    durable: "memory",
    maxTurns: 5,
  }));

  await new Promise((r) => setTimeout(r, 500));

  ws.send(JSON.stringify({ type: "run", instruction: "Say done." }));

  // wait for run_result (up to 15s)
  const deadline = Date.now() + 15000;
  while (runResult === null && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 100));
  }

  ws.close();
  bridge.kill();
  mock.close();

  if (runResult === null) {
    console.error("FAIL: no run_result; events:", events.map((e) => e.kind));
    process.exit(1);
  }

  const kinds = events.map((e) => e.kind);
  console.log("agent events:", kinds.join(" "));
  console.log("server message types:", allMessages.map((m) => m.type).join(" "));
  const worldMsg = allMessages.find((m) => m.type === "world");
  console.log("world snapshot present:", worldMsg !== undefined);
  console.log("run_result ok:", runResult.ok, "reason:", runResult.terminationReason, "turns:", runResult.turns);

  const hasTurnStart = kinds.includes("turn_start");
  const hasLlmEnd = kinds.includes("llm_end");
  const hasVerdict = kinds.includes("control_verdict");
  const ok = hasTurnStart && hasLlmEnd && hasVerdict && runResult.ok;

  if (!ok) {
    console.error(`FAIL: turnStart=${hasTurnStart} llmEnd=${hasLlmEnd} verdict=${hasVerdict} ok=${runResult.ok}`);
    process.exit(1);
  }
  console.log("PASS: real run streamed turn_start → llm_end → control_verdict → run_result(ok)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
