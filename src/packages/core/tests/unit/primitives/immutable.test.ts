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

describe("detached map read surface", () => {
  const view = cloneReadonlyMap(
    new Map([
      ["a", 1],
      ["b", 2],
    ]),
  );

  it("reports size, membership, and lookups", () => {
    expect(view.size).toBe(2);
    expect(view.has("a")).toBe(true);
    expect(view.has("missing")).toBe(false);
    expect(view.get("b")).toBe(2);
    expect(view.get("missing")).toBeUndefined();
  });

  it("iterates entries, keys, and values", () => {
    expect([...view.entries()]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    expect([...view.keys()]).toEqual(["a", "b"]);
    expect([...view.values()]).toEqual([1, 2]);
    expect([...view]).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
  });

  it("passes itself, not the backing Map, to forEach", () => {
    const seen: [number, string, unknown][] = [];
    view.forEach(function (value, key, map) {
      seen.push([value, key, map]);
    });
    expect(seen.map(([value, key]) => [key, value])).toEqual([
      ["a", 1],
      ["b", 2],
    ]);
    // Handing the caller the backing Map would leak the mutators the view
    // exists to withhold.
    expect(seen.every(([, , map]) => map === view)).toBe(true);
  });

  it("honours the forEach thisArg", () => {
    const context = { tag: "ctx", seen: [] as string[] };
    view.forEach(function (this: typeof context, _value, key) {
      this.seen.push(key);
    }, context);
    expect(context.seen).toEqual(["a", "b"]);
  });

  it("applies the value cloner per entry", () => {
    const doubled = cloneReadonlyMap(new Map([["a", 2]]), (value) => value * 2);
    expect(doubled.get("a")).toBe(4);
  });
});

describe("detached set read surface", () => {
  const view = cloneReadonlySet(new Set(["x", "y"]));

  it("reports size and membership", () => {
    expect(view.size).toBe(2);
    expect(view.has("x")).toBe(true);
    expect(view.has("missing")).toBe(false);
  });

  it("iterates entries, keys, and values", () => {
    expect([...view.entries()]).toEqual([
      ["x", "x"],
      ["y", "y"],
    ]);
    expect([...view.keys()]).toEqual(["x", "y"]);
    expect([...view.values()]).toEqual(["x", "y"]);
    expect([...view]).toEqual(["x", "y"]);
  });

  it("passes itself, not the backing Set, to forEach", () => {
    const seen: unknown[] = [];
    view.forEach((_value, _value2, set) => {
      seen.push(set);
    });
    expect(seen.every((set) => set === view)).toBe(true);
  });

  it("honours the forEach thisArg", () => {
    const context = { seen: [] as string[] };
    view.forEach(function (this: typeof context, value) {
      this.seen.push(value);
    }, context);
    expect(context.seen).toEqual(["x", "y"]);
  });

  it("applies the value cloner per member", () => {
    expect([...cloneReadonlySet(new Set(["a"]), (value) => value.toUpperCase())]).toEqual(["A"]);
  });
});
