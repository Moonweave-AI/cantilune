/**
 * REAL-provider live integration test for the website bridge (ADR-0030 §6).
 *
 * Connects to a real OpenAI-compatible provider (default: Alibaba DashScope /
 * 阿里百炼) using a key passed via env, configures the bridge, runs a real
 * instruction, and asserts the AgentEvent stream + a DONE control verdict.
 *
 * The key is read ONLY from the environment (CANTILUNE_TEST_API_KEY). It is
 * never written to disk, never printed, never persisted. This file contains no
 * credential. Unverified until run against a live endpoint.
 *
 * Run: CANTILUNE_TEST_API_KEY=sk-... node src/integrationReal.mjs
 *   (from src/website/server, after `pnpm build`)
 *
 * Env:
 *   CANTILUNE_TEST_API_KEY   required — the provider API key (no default).
 *   CANTILUNE_TEST_PROVIDER   default "dashscope".
 *   CANTILUNE_TEST_MODEL      default "qwen-turbo".
 *   CANTILUNE_TEST_BASE_URL   optional override (defaults to provider default).
 *   CANTILUNE_TEST_PORT       bridge port, default 7476.
 */

import { spawn } from "node:child_process";
import { WebSocket } from "ws";
import { once } from "node:events";

const API_KEY = process.env.CANTILUNE_TEST_API_KEY;
const PROVIDER = process.env.CANTILUNE_TEST_PROVIDER ?? "dashscope";
const MODEL = process.env.CANTILUNE_TEST_MODEL ?? "qwen-turbo";
const BASE_URL = process.env.CANTILUNE_TEST_BASE_URL; // undefined → provider default
const BRIDGE_PORT = Number(process.env.CANTILUNE_TEST_PORT ?? 7476);

if (!API_KEY) {
  console.error(
    "FAIL: set CANTILUNE_TEST_API_KEY (the provider key). It is read from env only.",
  );
  process.exit(2);
}

async function main() {
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

  await new Promise((r) => setTimeout(r, 200));
  if (!ready) throw new Error("no ready");
  console.log(`OK ready — provider=${PROVIDER} model=${MODEL}`);

  const configure = {
    type: "configure",
    provider: PROVIDER,
    model: MODEL,
    apiKey: API_KEY,
    durable: "memory",
    maxTurns: 6,
  };
  if (BASE_URL) configure.baseUrl = BASE_URL;
  ws.send(JSON.stringify(configure));

  await new Promise((r) => setTimeout(r, 400));

  // A real instruction the model should answer and then call `done`.
  ws.send(
    JSON.stringify({
      type: "run",
      instruction:
        "Reply with one short sentence greeting, then finish by calling the `done` tool with a one-sentence summary.",
    }),
  );

  const deadline = Date.now() + 90000;
  while (runResult === null && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 150));
  }

  ws.close();
  bridge.kill();

  if (runResult === null) {
    console.error("FAIL: no run_result within 90s");
    console.error("events:", events.map((e) => e.kind).join(" "));
    process.exit(1);
  }

  const kinds = events.map((e) => e.kind);
  console.log("agent events:", kinds.join(" "));
  console.log("server message types:", allMessages.map((m) => m.type).join(" "));
  const verdict = events.find((e) => e.kind === "control_verdict");
  console.log("verdict kind:", verdict?.verdict?.kind ?? "(none)");
  console.log(
    "run_result ok:", runResult.ok,
    "reason:", runResult.terminationReason,
    "turns:", runResult.turns,
    "summary:", JSON.stringify(runResult.summary),
  );

  const hasTurnStart = kinds.includes("turn_start");
  const hasLlmEnd = kinds.includes("llm_end");
  const hasVerdict = kinds.includes("control_verdict");
  const ok = hasTurnStart && hasLlmEnd && hasVerdict && runResult.ok;
  if (!ok) {
    console.error(
      `FAIL: turnStart=${hasTurnStart} llmEnd=${hasLlmEnd} verdict=${hasVerdict} ok=${runResult.ok}`,
    );
    process.exit(1);
  }
  console.log(
    `PASS: real ${PROVIDER}/${MODEL} run streamed to DONE verdict (ok, ${runResult.turns} turn)`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
