import { describe, it, expect } from "vitest";
import { uuidIdGenerator, wallClock } from "../../src/bootCantilune.js";

describe("boot memory adapters", () => {
  it("uuidIdGenerator produces branded ids for every IdGenerator method", () => {
    const gen = uuidIdGenerator();
    expect(String(gen.changeId())).toBeTruthy();
    expect(String(gen.snapshotRef())).toBeTruthy();
    expect(String(gen.sessionId())).toBeTruthy();
    expect(String(gen.linkId())).toBeTruthy();
    expect(String(gen.artifactId())).toBeTruthy();
    expect(String(gen.capabilityId())).toBeTruthy();
    expect(String(gen.evidenceId())).toBeTruthy();
  });

  it("wallClock returns an ISO timestamp", () => {
    const clock = wallClock();
    expect(String(clock.now())).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
