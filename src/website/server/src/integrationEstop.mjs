/**
 * E-Stop abort test for the website bridge (ADR-0030 §6).
 *
 * A mock SSE LLM streams text slowly (long deltas with delays). The client
 * sends `stop` mid-run; the bridge's AbortController aborts `os.run()`, which
 * must surface a run_result with terminationReason "aborted".
 *
 * Unverified until run.
 */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { once } from "node:events";

const MOCK_PORT = 9878;
const BRIDGE_PORT = 7478;

function startMockLlm() {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      if (req.url !== "/v1/chat/completions") {
        res.writeHead(404);
        res.end("not found");
        return;
      }
      res.writeHead(200, { "content-type": "text/event-stream" });
      // Stream several slow text deltas so the run is in-flight when we stop.
      let i = 0;
      const timer = setInterval(() => {
        if (i >= 8) {
          clearInterval(timer);
          const done = {
            choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
            usage: { prompt_tokens: 10, completion_tokens: 8, total_tokens: 18 },
          };
          res.write(`data: ${JSON.stringify(done)}\n\n`);
          res.write("data: [DONE]\n\n");
          res.end();
          return;
        }
        const frame = {
          choices: [{ index: 0, delta: { content: `word${i} ` }, finish_reason: null }],
        };
        res.write(`data: ${JSON.stringify(frame)}\n\n`);
        i += 1;
      }, 400); // 400ms per delta → ~3.2s total; we stop at ~1s.
      // If the client aborts, the socket closes; drain silently.
      req.on("close", () => {
        clearInterval(timer);
        try { res.end(); } catch { /* already closed */ }
      });
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
  let runResult = null;
  let ready = false;

  await new Promise((r, e) => {
    ws.addEventListener("open", () => r(), { once: true });
    ws.addEventListener("error", e, { once: true });
  });

  ws.addEventListener("message", (event) => {
    const msg = JSON.parse(event.data.toString());
    if (msg.type === "ready") ready = true;
    else if (msg.type === "agent_event") events.push(msg.event);
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
  ws.send(JSON.stringify({ type: "run", instruction: "Keep streaming text." }));

  // Wait ~1.2s so a few deltas arrive, then STOP.
  await new Promise((r) => setTimeout(r, 1200));
  const deltasBefore = events.filter((e) => e.kind === "llm_delta").length;
  console.log("deltas before stop:", deltasBefore);
  ws.send(JSON.stringify({ type: "stop" }));

  // Wait for run_result (up to 15s).
  const deadline = Date.now() + 15000;
  while (runResult === null && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
  }

  ws.close();
  bridge.kill();
  mock.close();

  if (runResult === null) {
    console.error("FAIL: no run_result after stop; events:", events.map((e) => e.kind).join(" "));
    process.exit(1);
  }

  const kinds = events.map((e) => e.kind);
  console.log("agent events:", kinds.join(" "));
  console.log(
    "run_result ok:", runResult.ok,
    "reason:", runResult.terminationReason,
    "turns:", runResult.turns,
  );

  // We expect the run to be aborted (ok:false, terminationReason aborted).
  const aborted = runResult.ok === false && runResult.terminationReason === "aborted";
  if (!aborted) {
    console.error(
      `FAIL: expected ok=false reason=aborted, got ok=${runResult.ok} reason=${runResult.terminationReason}`,
    );
    process.exit(1);
  }
  console.log("PASS: E-Stop — stop mid-run aborted the run (terminationReason:aborted)");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
