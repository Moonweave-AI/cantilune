/**
 * Library entry for `@cantilune/cli` — side-effect-free symbols embeddable by
 * other surfaces (the website bridge, ADR-0030). The default `index.ts` is the
 * bin entry and runs `main()` on import; this module exports the reusable
 * wiring without executing the CLI.
 */

export { createCliRuntimeBoot, type CliRuntimeHandle } from "./runtimeSync.js";
export { snapshotToData, buildLlmConfig, missingApiKeyVar } from "./runtimeSync.js";
export type { RuntimeState, SnapshotData, ChangeLogEntry, EpochInfo } from "./store.js";
export { createCliToolSet, parseMcpServerSpec } from "./wiring/cliToolSet.js";
export type { CliToolSetInput, ParsedMcpServer } from "./wiring/cliToolSet.js";
export { createSwarmController } from "./wiring/swarmControl.js";
export type {
  SwarmController,
  SwarmControllerStatus,
  SwarmEventRecord,
  ActivateResult as SwarmActivateResult,
} from "./wiring/swarmControl.js";
