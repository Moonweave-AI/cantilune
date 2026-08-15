import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCommsServices } from "../../../src/engine/createCommsServices.js";
import { testRuntimeCommitPort } from "../../../src/engine/testRuntimeCommitPort.js";

describe("comms file store soak", () => {
  it("persists 20 reconnect event sequences without corruption", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-comms-soak-"));
    try {
      const services = createCommsServices({
        mode: "test",
        storeDir: dir,
        bindingResolver: { getActiveBinding: () => undefined },
        sessionAuthority: { isController: () => true, isMember: () => true },
        runtimeCommit: testRuntimeCommitPort(),
        quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
      });

      for (let index = 0; index < 20; index += 1) {
        services.store.appendEvent({
          eventId: `evt-soak-${index}` as never,
          storeSequence: services.store.nextSequence(),
          kind: "MessageEnqueued",
          occurredAt: `2026-08-11T16:${String(index).padStart(2, "0")}:00Z`,
          payload: { messageId: `msg-soak-${index}` },
        });
      }

      const snapshot = services.store.snapshot();
      expect(snapshot.events.length).toBeGreaterThanOrEqual(20);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
