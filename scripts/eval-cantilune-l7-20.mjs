#!/usr/bin/env node
/**
 * Serial L7-20 runner. One isolated world per task; fail-closed stop + REPAIR.md.
 *
 *   pnpm eval:l7-20 -- --provider dashscope
 *   pnpm eval:l7-20 -- --from T07 --to T07 --provider dashscope
 *   pnpm eval:l7-20 -- --plan-only
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const suiteRoot = resolve(repoRoot, "eval/cantilune-l7-20");
const evaluationCorpus = resolve(repoRoot, "src/packages/evaluation/dist/corpus/index.js");

function loadRepoHostEnv() {
  const file = resolve(repoRoot, ".cantilune/host.env");
  if (!existsSync(file)) return;
  for (const raw of readFileSync(file, "utf8").split(/\r?\n/)) {
    const line = raw.trim();
    if (line.length === 0 || line.startsWith("#") || !line.includes("=")) continue;
    const index = line.indexOf("=");
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key.length === 0) continue;
    if (process.env[key] === undefined || process.env[key] === "") {
      process.env[key] = value;
    }
  }
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
}

/**
 * Each task world is file-local under `--storage-path`. Host HA (Postgres /
 * etcd) stays available for the interactive TUI; pinning file here is the
 * isolation contract, not a per-task special case.
 */
function isolatedEvalEnv(base) {
  return {
    ...base,
    CANTILUNE_DURABLE_BACKEND: "file",
  };
}

async function ensureEvaluationBuild() {
  if (existsSync(evaluationCorpus)) return;
  await run("pnpm", ["--filter", "@cantilune/evaluation...", "build"]);
  if (!existsSync(evaluationCorpus)) {
    throw new Error("evaluation corpus build missing; pnpm --filter @cantilune/evaluation... build");
  }
}

function run(command, args, options = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: options.capture === true ? ["ignore", "pipe", "inherit"] : "inherit",
      shell: true,
      cwd: options.cwd ?? repoRoot,
      env: options.env,
    });
    let stdout = "";
    if (options.capture === true && child.stdout !== null) {
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
        process.stdout.write(chunk);
      });
    }
    child.on("exit", (code) => {
      if (code === 0 || options.allowFailure === true) {
        resolvePromise({ code: code ?? 1, stdout });
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

const PROVIDER_ENV_KEYS = {
  dashscope: "DASHSCOPE_API_KEY",
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

async function main() {
  loadRepoHostEnv();
  await ensureEvaluationBuild();
  const corpus = await import(pathToFileURL(evaluationCorpus).href);
  const args = corpus.parseL7TwentyRunArgs(process.argv.slice(2));
  const provider = args.provider ?? "dashscope";
  const envKey = PROVIDER_ENV_KEYS[provider];
  if (args.planOnly !== true && envKey !== undefined && !process.env[envKey]) {
    fail(
      `missing ${envKey} for --provider ${provider}. Set it in this shell or .cantilune/host.env (same as the TUI).`,
    );
    return;
  }
  const suite = corpus.loadCantiluneL7TwentySuite(suiteRoot);
  const planned = corpus.planL7TwentyRun(suite.tasks, args);
  const runId = args.runId ?? new Date().toISOString().replace(/[:.]/g, "-");
  const isolationRoot = resolve(repoRoot, suite.manifest.isolationRoot, runId);

  process.stdout.write(
    `cantilune L7-20 ${runId} tasks=${planned.map((task) => task.id).join(",")}\n`,
  );
  if (args.planOnly) {
    mkdirSync(resolve(repoRoot, ".cantilune/eval/l7-20"), { recursive: true });
    writeFileSync(
      resolve(repoRoot, ".cantilune/eval/l7-20", `${runId}.plan.json`),
      `${JSON.stringify(
        { runId, tasks: planned.map((task) => task.id), isolationRoot },
        null,
        2,
      )}\n`,
    );
    return;
  }

  mkdirSync(isolationRoot, { recursive: true });
  const scorerSourcePaths = [
    resolve(repoRoot, "src/packages/evaluation/src/corpus/cantiluneL7Twenty.ts"),
    resolve(repoRoot, "src/packages/evaluation/src/corpus/evaluateL7TwentyCheckpoint.ts"),
  ];
  const fingerprints = corpus.fingerprintSuiteSources(suiteRoot, scorerSourcePaths);
  const round = [];

  for (const spec of planned) {
    const workspaceDir =
      args.scoreOnlyDir !== undefined ? resolve(args.scoreOnlyDir) : resolve(isolationRoot, spec.id);
    mkdirSync(workspaceDir, { recursive: true });
    const instructionPath = resolve(workspaceDir, "INSTRUCTION.md");
    const taskPath = resolve(workspaceDir, "TASK.md");
    writeFileSync(taskPath, spec.brief, "utf8");
    writeFileSync(instructionPath, corpus.composeL7TwentyInstruction(spec), "utf8");

    if (args.scoreOnlyDir === undefined) {
      const cliArgs = [
        "cantilune",
        "--",
        "run",
        "--headless",
        "--swarm",
        "--json",
        "--instruction-file",
        instructionPath,
        "--storage-path",
        workspaceDir,
        "--workspace",
        workspaceDir,
      ];
      if (args.provider !== undefined) cliArgs.push("--provider", args.provider);
      if (args.model !== undefined) cliArgs.push("--model", args.model);
      if (args.baseUrl !== undefined) cliArgs.push("--base-url", args.baseUrl);
      if (args.maxTurns !== undefined) cliArgs.push("--max-turns", String(args.maxTurns));
      const spawned = await run("pnpm", cliArgs, {
        cwd: repoRoot,
        capture: true,
        allowFailure: true,
        env: isolatedEvalEnv(process.env),
      });
      const extracted = corpus.extractRunResultJson(spawned.stdout);
      const resultPath = resolve(workspaceDir, "result.json");
      if (extracted !== undefined) {
        writeFileSync(resultPath, `${JSON.stringify(extracted)}\n`, "utf8");
      } else if (!existsSync(resultPath)) {
        writeFileSync(
          resultPath,
          `${JSON.stringify({ ok: spawned.code === 0, summary: "no-json-result" })}\n`,
          "utf8",
        );
      }
    }

    const evidence = corpus.collectL7TwentyEvidence({
      workspaceDir,
      suiteRoot,
      taskId: spec.id,
      suiteFingerprints: fingerprints,
      scorerSourcePaths,
    });
    const evaluation = corpus.evaluateL7TwentyCheckpoint(spec, evidence);
    writeFileSync(
      resolve(workspaceDir, "checkpoint-eval.json"),
      `${JSON.stringify(evaluation, null, 2)}\n`,
      "utf8",
    );
    round.push({ taskId: spec.id, decision: evaluation.decision, passed: evaluation.passed });
    process.stdout.write(
      `${spec.id} ${evaluation.passed ? "measured" : "notSupported"} gates=${evaluation.gates
        .map((gate) => `${gate.id}:${gate.passed ? "ok" : "fail"}`)
        .join(",")}\n`,
    );
    if (corpus.nextL7TwentyAction(evaluation) === "stop-repair") {
      writeFileSync(resolve(workspaceDir, "REPAIR.md"), corpus.writeL7RepairMarkdown(evaluation), "utf8");
      writeFileSync(
        resolve(isolationRoot, "round.json"),
        `${JSON.stringify({ runId, stoppedAt: spec.id, tasks: round }, null, 2)}\n`,
        "utf8",
      );
      fail(`L7-20 stopped at ${spec.id}; see ${resolve(workspaceDir, "REPAIR.md")}`);
      return;
    }
  }

  writeFileSync(
    resolve(isolationRoot, "round.json"),
    `${JSON.stringify({ runId, stoppedAt: null, tasks: round }, null, 2)}\n`,
    "utf8",
  );
  process.stdout.write(`L7-20 round measured ${round.length}/${planned.length}\n`);
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
