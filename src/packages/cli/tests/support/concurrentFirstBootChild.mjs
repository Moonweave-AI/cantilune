import { existsSync } from "node:fs";
import { join } from "node:path";
import { ensureCliPrincipal, loadConfig } from "../../dist/config.js";
import { createFileRuntimePersistence, readFileRuntimeIdentity } from "@cantilune/runtime/memory";

const [configPath, storagePath, candidate, barrierPath, identityMode = "generated"] =
  process.argv.slice(2);
if (
  configPath === undefined ||
  storagePath === undefined ||
  candidate === undefined ||
  barrierPath === undefined ||
  (identityMode !== "generated" && identityMode !== "explicit")
) {
  throw new Error("expected configPath storagePath candidate barrierPath");
}

try {
  // Both workers load the absent config before the parent releases them. This
  // reproduces the true first-boot race rather than letting one simply resume.
  const loaded = await loadConfig(configPath);
  const proposed = {
    ...loaded,
    durable: "file",
    storagePath,
    // Exercise the real default-first-boot path. An explicitly configured
    // principal is an identity claim and must lose closed rather than silently
    // adopting another process's winner.
    principalId: identityMode === "explicit" ? candidate : undefined,
  };
  process.stdout.write(`READY ${candidate}\n`);

  const deadline = Date.now() + 10_000;
  while (!existsSync(barrierPath)) {
    if (Date.now() >= deadline) throw new Error("timed out waiting for parent barrier");
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5);
  }

  let reconciled;
  let lostConfigRace = false;
  let rejected = false;
  try {
    reconciled = await ensureCliPrincipal(proposed, configPath);
  } catch (error) {
    if (
      identityMode === "explicit" &&
      error instanceof Error &&
      (error.message.includes("lost the concurrent first-boot race") ||
        error.message.includes("is not an active Agent in the durable world"))
    ) {
      rejected = true;
    } else {
      if (!(error instanceof Error) || !error.message.includes("must reload before booting")) {
        throw error;
      }
      lostConfigRace = true;
      // The durable winner may exist before it has published config. Retrying
      // from DEFAULT_CONFIG would silently escape to cwd/.cantilune/os and turn
      // this isolation test into a false pass (and repository pollution). Keep
      // the original durability/path authority while dropping only the losing
      // explicit principal candidate so adoption reads the real winner.
      const reloaded = await loadConfig(configPath);
      reconciled = await ensureCliPrincipal(
        {
          ...reloaded,
          durable: proposed.durable,
          storagePath: proposed.storagePath,
          principalId: undefined,
        },
        configPath,
      );
    }
  }
  const persistence = createFileRuntimePersistence({ dir: join(storagePath, "runtime") });
  const headRef = persistence.durable.head();
  const head = headRef === undefined ? undefined : persistence.durable.get(headRef);
  const identity = readFileRuntimeIdentity(join(storagePath, "runtime"));
  const activeAgents = [...(head?.participants.values() ?? [])]
    .filter((entry) => entry.kind === "agent" && entry.status === "active")
    .map((entry) => String(entry.actorId));

  process.stdout.write(
    `${JSON.stringify({
      candidate,
      principalId: rejected ? null : reconciled.principalId,
      genesisRef: identity === undefined ? null : String(identity.genesisRef),
      activeAgents,
      openedRuntime: !rejected,
      lostConfigRace,
      rejected,
    })}\n`,
  );
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
}
