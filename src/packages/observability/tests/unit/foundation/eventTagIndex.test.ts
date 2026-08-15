import { describe, expect, it } from "vitest";
import { changeId, epochId, operationTypeId, timestamp } from "@cantilune/core";
import { createEventTagIndex, mapEventTagIndex } from "../../../src/foundation/eventTagIndex.js";
import { eventTagKey } from "../../../src/foundation/eventTag.js";
import { expectReadOnlyViolation } from "../../support/assertions/violations.js";

function tag(id: string) {
  return {
    changeId: changeId(id),
    epochId: epochId("1"),
    operationTypeId: operationTypeId("introduce_artifact"),
    recordedAt: timestamp("2026-08-07T10:00:00Z"),
  };
}

describe("createEventTagIndex", () => {
  it("indexes entries by changeId and exposes iterators", () => {
    const index = createEventTagIndex([
      { tag: tag("chg-001"), value: "a" },
      { tag: tag("chg-002"), value: "b" },
    ]);
    expect(index.size).toBe(2);
    expect(index.get(tag("chg-001"))).toBe("a");
    expect(index.getByChangeId(changeId("chg-002"))).toBe("b");
    expect(index.has(tag("chg-001"))).toBe(true);
    expect(index.has(tag("chg-missing"))).toBe(false);
    expect([...index.entries()]).toHaveLength(2);
    expect(index.tags()).toHaveLength(2);
    expect([...index.values()]).toEqual(["a", "b"]);
  });

  it("rejects duplicate changeId entries", () => {
    expect(
      expectReadOnlyViolation(
        () =>
          createEventTagIndex([
            { tag: tag("chg-001"), value: "a" },
            { tag: tag("chg-001"), value: "b" },
          ]),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("rejects duplicate changeId with mismatched metadata", () => {
    const base = tag("chg-001");
    const altered = { ...base, recordedAt: timestamp("2026-08-07T11:00:00Z") };
    expect(
      expectReadOnlyViolation(
        () =>
          createEventTagIndex([
            { tag: base, value: "a" },
            { tag: altered, value: "b" },
          ]),
        "invalid_input",
      ).code,
    ).toBe("invalid_input");
  });

  it("throws on get when tag metadata does not match stored entry", () => {
    const stored = tag("chg-001");
    const index = createEventTagIndex([{ tag: stored, value: "a" }]);
    const lookup = { ...stored, recordedAt: timestamp("2026-08-07T11:00:00Z") };
    expect(expectReadOnlyViolation(() => index.get(lookup), "invalid_input").code).toBe(
      "invalid_input",
    );
  });
});

describe("mapEventTagIndex", () => {
  it("maps values while preserving tags", () => {
    const index = createEventTagIndex([{ tag: tag("chg-001"), value: 1 }]);
    const mapped = mapEventTagIndex(index, (_tag, value) => value + 1);
    expect(mapped.get(tag("chg-001"))).toBe(2);
    expect(eventTagKey(mapped.tags()[0]!)).toBe("chg-001");
  });
});
