import { createCommandRegistry } from "./registry.js";
import type { CommandRegistry } from "./registry.js";
import { registerWorldCommands } from "./worldCommands.js";
import { registerGraphCommands } from "./graphCommands.js";
import { registerPetriCommands } from "./petriCommands.js";
import { registerTraceCommands } from "./traceCommands.js";
import { registerReplayCommands } from "./replayCommands.js";
import { registerContentCommands } from "./contentCommands.js";
import { registerObserveCommands } from "./observeCommands.js";
import { registerSchemaCommands } from "./schemaCommands.js";
import { registerEvalCommands } from "./evalCommands.js";
import { registerExportCommands } from "./exportCommands.js";
import { registerControlCommands } from "./controlCommands.js";
import { registerSessionCommands } from "./sessionCommands.js";
import { registerClusterCommands } from "./clusterCommands.js";
import { registerSwarmCommands } from "./swarmCommands.js";
import { registerEventCommands } from "./eventCommands.js";

export function createFullCommandRegistry(): CommandRegistry {
  const registry = createCommandRegistry();
  const modules = [
    registerWorldCommands,
    registerGraphCommands,
    registerPetriCommands,
    registerTraceCommands,
    registerReplayCommands,
    registerContentCommands,
    registerObserveCommands,
    registerSchemaCommands,
    registerEvalCommands,
    registerExportCommands,
    registerControlCommands,
    registerSessionCommands,
    registerClusterCommands,
    registerSwarmCommands,
    registerEventCommands,
  ];
  for (const registerFn of modules) {
    for (const command of registerFn()) {
      registry.register(command);
    }
  }
  return registry;
}
