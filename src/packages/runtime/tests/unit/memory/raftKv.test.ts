import { describe, expect, it } from "vitest";
import { etcdRangeEnd, etcdRangeEndBytes } from "../../../src/memory/etcdJson.js";
import { assertSafeNamespace, matchesCompare } from "../../../src/memory/raftKv.js";

describe("raftKv helpers", () => {
  it("rejects an unsafe namespace and accepts a simple identifier", () => {
    expect(() => assertSafeNamespace("cantilune;drop")).toThrow(/simple identifier/);
    expect(() => assertSafeNamespace("cantilune_prod")).not.toThrow();
  });

  it("matches create / version / value compares", () => {
    expect(
      matchesCompare(undefined, { key: "k", target: "create", result: "equal" }),
    ).toBe(true);
    expect(
      matchesCompare(undefined, { key: "k", target: "create", result: "notEqual" }),
    ).toBe(false);
    const entry = {
      key: "k",
      value: "v",
      version: 2,
      createRevision: 1,
      modRevision: 3,
    };
    expect(matchesCompare(entry, { key: "k", target: "create", result: "notEqual" })).toBe(true);
    expect(
      matchesCompare(entry, { key: "k", target: "version", result: "equal", version: 2 }),
    ).toBe(true);
    expect(
      matchesCompare(entry, { key: "k", target: "version", result: "notEqual", version: 1 }),
    ).toBe(true);
    expect(matchesCompare(entry, { key: "k", target: "value", result: "equal", value: "v" })).toBe(
      true,
    );
    expect(
      matchesCompare(entry, { key: "k", target: "value", result: "notEqual", value: "other" }),
    ).toBe(true);
    expect(matchesCompare(undefined, { key: "k", target: "version", result: "equal", version: 0 })).toBe(
      true,
    );
  });

  it("increments the last byte for an etcd prefix range_end", () => {
    expect(etcdRangeEnd("abc")).toBe("abd");
    expect(etcdRangeEndBytes(Buffer.from([0x61, 0x62, 0xff]))).toEqual(Buffer.from([0x61, 0x63]));
    expect(etcdRangeEndBytes(Buffer.from([0xff]))).toEqual(Buffer.from([0]));
  });
});
