import { describe, expect, it } from "vitest";
import {
  isRecord,
  rejectUnknownKeys,
  requireNumber,
  requireObject,
  requireString,
} from "../../../src/codec/wireHelpers.js";

describe("wire helpers", () => {
  it("detects plain records", () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it("rejects unknown keys", () => {
    const result = rejectUnknownKeys({ allowed: true, extra: 1 }, ["allowed"], "root");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_input");
  });

  it("requires non-empty strings", () => {
    expect(requireString({ name: "ok" }, "name", "root").ok).toBe(true);
    expect(requireString({ name: "" }, "name", "root").ok).toBe(false);
    expect(requireString({ name: 1 }, "name", "root").ok).toBe(false);
  });

  it("requires finite numbers", () => {
    expect(requireNumber({ count: 3 }, "count", "root").ok).toBe(true);
    expect(requireNumber({ count: NaN }, "count", "root").ok).toBe(false);
    expect(requireNumber({ count: "3" }, "count", "root").ok).toBe(false);
  });

  it("requires objects", () => {
    expect(requireObject({ a: 1 }, "root").ok).toBe(true);
    expect(requireObject("string", "root").ok).toBe(false);
    expect(requireObject([], "root").ok).toBe(false);
  });
});
