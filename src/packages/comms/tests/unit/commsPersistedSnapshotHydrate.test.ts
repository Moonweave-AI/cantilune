import { describe, expect, it } from "vitest";
import { hydrateCommsPersistedSnapshot } from "../../src/foundation/commsPersistedSnapshot.js";

describe("commsPersistedSnapshot hydrate branches", () => {
  it("fills defaults for missing optional arrays", () => {
    const hydrated = hydrateCommsPersistedSnapshot({
      version: 1,
      frozen: true,
      sequence: 5,
    } as never);
    expect(hydrated.frozen).toBe(true);
    expect(hydrated.sequence).toBe(5);
    expect(hydrated.peers).toEqual([]);
    expect(hydrated.deadLetters).toEqual([]);
  });
});
