import { describe, expect, it } from "vitest";
import {
  clonePlainObject,
  cloneReadonlyArray,
  cloneReadonlyMap,
  cloneReadonlySet,
} from "../../../src/primitives/immutable.js";

describe("immutable collection views", () => {
  it("detach Maps without exposing native Map mutators", () => {
    const sourceValue = { state: "active" };
    const view = cloneReadonlyMap(new Map([["agent", sourceValue]]), (value) =>
      clonePlainObject(value),
    );

    sourceValue.state = "retired";
    const runtimeShape = view as unknown as Record<string, unknown>;
    expect(view.get("agent")).toEqual({ state: "active" });
    expect(runtimeShape.set).toBeUndefined();
    expect(runtimeShape.delete).toBeUndefined();
    expect(runtimeShape.clear).toBeUndefined();
    expect(Object.isFrozen(view)).toBe(true);
  });

  it("detach Sets without exposing native Set mutators", () => {
    const view = cloneReadonlySet(new Set(["agent"]));
    const runtimeShape = view as unknown as Record<string, unknown>;

    expect([...view]).toEqual(["agent"]);
    expect(runtimeShape.add).toBeUndefined();
    expect(runtimeShape.delete).toBeUndefined();
    expect(runtimeShape.clear).toBeUndefined();
    expect(Object.isFrozen(view)).toBe(true);
  });

  it("freezes detached arrays and plain records", () => {
    const array = cloneReadonlyArray(["a"]);
    const record = clonePlainObject({ state: "active" });

    expect(Object.isFrozen(array)).toBe(true);
    expect(Object.isFrozen(record)).toBe(true);
  });
});
