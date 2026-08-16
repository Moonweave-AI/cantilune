import { ok } from "@cantilune/core";
import { createProcessEStopGate } from "../../src/adapters/process/processEStopGate.js";
import { createProcessEventSink } from "../../src/adapters/process/processEventSink.js";
import { createProcessReplayProtector } from "../../src/adapters/process/processReplayProtector.js";
import { createFilePeerDirectory } from "../../src/adapters/file/filePeerDirectory.js";
import { createFileFreshAllocator } from "../../src/adapters/file/fileFreshAllocator.js";
import { testRuntimeCommitPort } from "../../src/engine/testRuntimeCommitPort.js";
import type { CommsServicesDeps } from "../../src/engine/createCommsServices.js";
import type { IdentityVerifier } from "../../src/security/identityVerifier.js";
import { defaultTestQuiescence, defaultTestSessionAuthority } from "./envelopeFixtures.js";

export function productionCommsDeps(
  storeDir: string,
  identity?: IdentityVerifier,
): CommsServicesDeps {
  return {
    mode: "production",
    storeDir,
    ...(identity !== undefined ? { identity } : {}),
    authorizer: { authorize: () => ok(undefined) },
    observation: {
      observe: async () => ({ ok: true, value: { snapshotRef: "snap-prod" as never } }),
    },
    runtimeCommit: testRuntimeCommitPort(),
    eStop: createProcessEStopGate(),
    events: createProcessEventSink(),
    peerDirectory: createFilePeerDirectory(storeDir),
    freshAllocator: createFileFreshAllocator(storeDir),
    replay: createProcessReplayProtector(),
    bindingResolver: { getActiveBinding: () => undefined },
    sessionAuthority: defaultTestSessionAuthority,
    quiescence: defaultTestQuiescence,
  };
}
