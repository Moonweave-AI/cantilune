import { describe, expect, it } from "vitest";
import {
  complementTagFromSelector,
  defaultComplementSelector,
  DEFAULT_COMPLEMENT_TAG,
} from "../../../src/replay/complementSelector.js";

describe("complementSelector", () => {
  it("defaults to tag 0", () => {
    const selector = defaultComplementSelector();
    expect(selector.tag).toBe(DEFAULT_COMPLEMENT_TAG);
    expect(complementTagFromSelector(selector)).toBe(0);
  });
});
