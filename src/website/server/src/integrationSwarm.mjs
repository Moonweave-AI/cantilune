/**
 * Swarm control live test for the website bridge (ADR-0030 §6).
 *
 * Configures the bridge, starts the swarm, asserts a swarm:status push with
 * running:true, stops it, asserts running:false. Does not activate an agent
 * (that requires a registered participant, which a single-run loop does not
 * create); the start/stop/status wiring is what this verifies.
 *
 * Unverified until run.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { once } from "node:events";

const MOCK_PORT = 9879;
const BRIDGE_PORT = 7479;

function startMockLlm() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url !== "/v1/chat/completions") {
        res.writeHead(404);
        res.end();
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      const f1 = { choices: [{ index: 0, delta: { role: "assistant", tool_calls: [{ index: 0, id: "c1", type: "function", function: { name: "done", arguments: '{"summary":"ok"}' } }] }, finish_reason: null }] };
      const f2 = { choices: [{ index: 0, delta: {}, finish_reason: "tool_calls" }], usage: { prompt_tokens: 5, completion_tokens: 3, total_tokens: 8 } };
      res.write(`data: ${JSON.stringify(f1)}\n\n`);
      res.write(`data: ${JSON.stringify(f2)}\n\n`);
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

  const ws = new WebSocket(`ws://127.0.0.1:${BRIDGE_PORT}`, { origin: "http://localhost:5173" });
  const messages = [];
  let ready = false;

  await new Promise((r, e) => {
    ws.addEventListener("open", () => r(), { once: true });
    ws.addEventListener("error", e, { once: true });
  });
  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data.toString());
    messages.push(msg);
    if (msg.type === "ready") ready = true;
  });

  await new Promise((r) => setTimeout(r, 200));
  if (!ready) throw new Error("no ready");

  // Configure (required before swarm).
  ws.send(JSON.stringify({
    type: "configure",
    provider: "openai",
    model: "mock-model",
    baseUrl: `http://127.0.0.1:${MOCK_PORT}/v1`,
    apiKey: "test-key",
    durable: "memory",
    maxTurns: 3,
  }));
  await new Promise((r) => setTimeout(r, 500));

  // Start swarm.
  ws.send(JSON.stringify({ type: "swarm:start" }));

  // Wait for a swarm:status with running:true.
  const startDeadline = Date.now() + 5000;
  let started = false;
  while (Date.now() < startDeadline) {
    const statusMsg = messages.find((m) => m.type === "swarm:status" && m.status.running === true);
    if (statusMsg) { started = true; break; }
    await new Promise((r) => setTimeout(r, 150));
  }
  console.log("swarm started (running:true):", started);
  if (!started) {
    const err = messages.find((m) => m.type === "error");
    console.error("error msg:", err);
    process.exit(1);
  }

  // Stop swarm.
  ws.send(JSON.stringify({ type: "swarm:stop" }));
  await new Promise((r) => setTimeout(r, 600));
  const stoppedMsg = [...messages].reverse().find((m) => m.type === "swarm:status");
  const stopped = stoppedMsg !== undefined && stoppedMsg.status.running === false;
  console.log("swarm stopped (running:false):", stopped);

  ws.close();
  bridge.kill();
  mock.close();

  if (!started || !stopped) {
    console.error(`FAIL: started=${started} stopped=${stopped}`);
    process.exit(1);
  }
  console.log("PASS: swarm start → status(running:true) → stop → status(running:false)");
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
