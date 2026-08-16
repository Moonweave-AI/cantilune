import { operationTypeId } from "@cantilune/core";
import type { OperationHandlerRegistry } from "../handlerRegistry.js";
import { InMemoryHandlerRegistry } from "../handlerRegistry.js";
import { createSessionHandler } from "./createSession.js";
import { delegateHandler } from "./delegate.js";
import { forkBranchHandler } from "./forkBranch.js";
import { introduceArtifactHandler } from "./introduceArtifact.js";
import { publishArtifactHandler } from "./publishArtifact.js";
import { transferSessionHandler } from "./transferSession.js";
import { registerParticipantHandler } from "./registerParticipant.js";
import { activateParticipantHandler } from "./activateParticipant.js";
import { signalDoneHandler } from "./signalDone.js";
import { retireParticipantHandler } from "./retireParticipant.js";
import { emitHeartbeatHandler } from "./emitHeartbeat.js";
import { commitTranscriptHandler } from "./commitTranscript.js";

export function createDefaultHandlers(): OperationHandlerRegistry {
  const registry = new InMemoryHandlerRegistry();
  registry.register(operationTypeId("introduce_artifact"), introduceArtifactHandler, "1");
  registry.register(operationTypeId("delegate"), delegateHandler, "1");
  registry.register(operationTypeId("create_session"), createSessionHandler, "1");
  registry.register(operationTypeId("fork_branch"), forkBranchHandler, "1");
  registry.register(operationTypeId("publish_artifact"), publishArtifactHandler, "1");
  registry.register(operationTypeId("transfer_session"), transferSessionHandler, "1");
  registry.register(operationTypeId("register_participant"), registerParticipantHandler, "1");
  registry.register(operationTypeId("activate_participant"), activateParticipantHandler, "1");
  registry.register(operationTypeId("signal_done"), signalDoneHandler, "1");
  registry.register(operationTypeId("retire_participant"), retireParticipantHandler, "1");
  registry.register(operationTypeId("emit_heartbeat"), emitHeartbeatHandler, "1");
  registry.register(operationTypeId("commit_transcript"), commitTranscriptHandler, "1");
  return registry;
}

export { introduceArtifactHandler } from "./introduceArtifact.js";
export { delegateHandler } from "./delegate.js";
export { createSessionHandler } from "./createSession.js";
export { forkBranchHandler } from "./forkBranch.js";
export { publishArtifactHandler } from "./publishArtifact.js";
export { transferSessionHandler } from "./transferSession.js";
export { registerParticipantHandler } from "./registerParticipant.js";
export { activateParticipantHandler } from "./activateParticipant.js";
export { signalDoneHandler } from "./signalDone.js";
export { retireParticipantHandler } from "./retireParticipant.js";
export { emitHeartbeatHandler } from "./emitHeartbeat.js";
export { commitTranscriptHandler } from "./commitTranscript.js";
