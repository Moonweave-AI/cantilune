#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const monorepoRoot = resolve(scriptDir, "..");
const packageRoot = (name) => join(monorepoRoot, "src", "packages", name);

function windowsShimCli(shim, relativeCliPaths) {
  const matches = execFileSync("where.exe", [`${shim}.cmd`], { encoding: "utf8" })
    .split(/\r?\n/u)
    .filter(Boolean);
  for (const match of matches) {
    for (const relativeCliPath of relativeCliPaths) {
      const candidate = resolve(dirname(match), ...relativeCliPath);
      if (existsSync(candidate)) return candidate;
    }
  }
  throw new Error(`unable to locate the ${shim} JavaScript entrypoint`);
}

const pnpmInvocation =
  process.platform === "win32"
    ? {
        command: process.execPath,
        prefix: [
          windowsShimCli("pnpm", [
            ["node_modules", "pnpm", "bin", "pnpm.mjs"],
            ["..", "node_modules", "pnpm", "bin", "pnpm.cjs"],
          ]),
        ],
      }
    : { command: "pnpm", prefix: [] };
const npmInvocation =
  process.platform === "win32"
    ? {
        command: process.execPath,
        prefix: [join(dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")],
      }
    : { command: "npm", prefix: [] };

const targets = {
  syscall: {
    packages: ["core", "content", "runtime", "observability", "syscall"],
    runtimeSource: `import {
  createStaticSchemaProvider,
  createSyscall,
  schemasFromTemplates,
  toolArgumentsDigest,
} from "@cantilune/syscall";

const templates = [{
  operationTypeId: "op-smoke",
  description: "pack smoke operation",
  requiredRoles: ["actor"],
}];
const provider = createStaticSchemaProvider(templates);
const schemas = schemasFromTemplates(provider.getTemplates());

if (typeof createSyscall !== "function") throw new Error("createSyscall export missing");
if (schemas.length !== 1 || schemas[0].name !== "op-smoke") {
  throw new Error("schema exports are not executable from the packed package");
}
if (!toolArgumentsDigest({ value: "pack-smoke" })?.startsWith("sha256:")) {
  throw new Error("toolArgumentsDigest export is not executable");
}
console.log("@cantilune/syscall pack runtime smoke ok");
`,
    typeSource: `import {
  createStaticSchemaProvider,
  type ActionCall,
  type AvailableTemplate,
  type OperationSchemaProvider,
  type Syscall,
  type SyscallDependencies,
} from "@cantilune/syscall";
import { operationTypeId } from "@cantilune/core";

const template: AvailableTemplate = {
  operationTypeId: operationTypeId("op-type-smoke"),
  description: "type export smoke",
  requiredRoles: ["actor"],
};
const provider: OperationSchemaProvider = createStaticSchemaProvider([template]);
const call: ActionCall = { operation: "op-type-smoke", args: { actor: "agent-a" } };
const dependencyKey: keyof SyscallDependencies = "schemaProvider";
const acceptPublicSyscall = (_syscall: Syscall): void => {};

void provider;
void call;
void dependencyKey;
void acceptPublicSyscall;
`,
  },
  boot: {
    packages: ["core", "content", "runtime", "observability", "syscall", "comms", "boot"],
    runtimeSource: `import {
  DEFAULT_TEMPLATES,
  createAgentLoopHistory,
  createDefaultCompletionDetector,
  mergeToolExecutors,
} from "@cantilune/boot";

const history = createAgentLoopHistory([{ role: "user", content: "pack smoke" }]);
const detector = createDefaultCompletionDetector();
const tools = mergeToolExecutors([]);

if (!Array.isArray(DEFAULT_TEMPLATES) || DEFAULT_TEMPLATES.length === 0) {
  throw new Error("DEFAULT_TEMPLATES export missing from packed package");
}
if (history.messages.length !== 1 || typeof detector.isDone !== "function") {
  throw new Error("agent-loop exports are not executable from the packed package");
}
if (!Array.isArray(tools.executors) || tools.executors.length !== 0) {
  throw new Error("tool merge export is not executable");
}
console.log("@cantilune/boot pack runtime smoke ok");
`,
    typeSource: `import {
  createAgentLoopHistory,
  type AgentLoopConfig,
  type BootConfig,
  type CantilunOS,
  type LlmAdapter,
  type LlmChatRequest,
  type LlmChatResponse,
} from "@cantilune/boot";

const config: BootConfig = {
  durable: "memory",
  contentStore: "memory",
  llm: { provider: "pack-smoke", model: "pack-smoke" },
};
const response: LlmChatResponse = {
  text: "done",
  toolCalls: [],
  finishReason: "stop",
};
const adapter: LlmAdapter = {
  async chat(_request: LlmChatRequest): Promise<LlmChatResponse> {
    return response;
  },
};
const history = createAgentLoopHistory();
const loopLimitKey: keyof AgentLoopConfig = "maxTurns";
const acceptPublicOS = (_os: CantilunOS): void => {};

void config;
void adapter;
void history;
void loopLimitKey;
void acceptPublicOS;
`,
  },
};

const targetName = process.argv[2];
const target = targets[targetName];
if (target === undefined) {
  throw new Error(`usage: node scripts/packConsumerSmoke.mjs <${Object.keys(targets).join("|")}>`);
}

const packDir = mkdtempSync(join(tmpdir(), `cantilune-${targetName}-packs-`));
const consumerDir = mkdtempSync(join(tmpdir(), `cantilune-${targetName}-consumer-`));

function run(invocation, args, cwd, env = process.env) {
  execFileSync(invocation.command, [...invocation.prefix, ...args], { cwd, env, stdio: "inherit" });
}

function packedFileFor(packageName, previousFiles) {
  const created = readdirSync(packDir).filter(
    (name) => name.endsWith(".tgz") && !previousFiles.has(name),
  );
  if (created.length !== 1) {
    throw new Error(`expected one tarball for ${packageName}, found ${created.length}`);
  }
  return join(packDir, created[0]);
}

try {
  const dependencies = {};

  for (const name of target.packages) {
    const root = packageRoot(name);
    run(pnpmInvocation, ["build"], root);

    const before = new Set(readdirSync(packDir));
    run(pnpmInvocation, ["--silent", "pack", "--pack-destination", packDir], root);

    const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
    const tarballPath = packedFileFor(manifest.name, before).replaceAll("\\", "/");
    dependencies[manifest.name] = `file:${tarballPath}`;
  }

  writeFileSync(
    join(consumerDir, "package.json"),
    `${JSON.stringify(
      {
        name: `${targetName}-pack-consumer-smoke`,
        private: true,
        type: "module",
        dependencies,
      },
      null,
      2,
    )}\n`,
  );
  writeFileSync(join(consumerDir, "smoke.mjs"), target.runtimeSource);
  writeFileSync(join(consumerDir, "smoke.mts"), target.typeSource);
  writeFileSync(
    join(consumerDir, "tsconfig.json"),
    `${JSON.stringify(
      {
        compilerOptions: {
          target: "ES2022",
          module: "NodeNext",
          moduleResolution: "NodeNext",
          strict: true,
          noEmit: true,
          skipLibCheck: true,
        },
        include: ["smoke.mts"],
      },
      null,
      2,
    )}\n`,
  );

  const npmEnvironment = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => name !== "npm_config_recursive"),
  );
  run(
    npmInvocation,
    ["install", "--ignore-scripts", "--no-audit", "--no-fund"],
    consumerDir,
    npmEnvironment,
  );
  run(
    { command: process.execPath, prefix: [] },
    [join(monorepoRoot, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.json"],
    consumerDir,
  );
  run({ command: process.execPath, prefix: [] }, ["smoke.mjs"], consumerDir);
} finally {
  rmSync(packDir, { recursive: true, force: true });
  rmSync(consumerDir, { recursive: true, force: true });
}
