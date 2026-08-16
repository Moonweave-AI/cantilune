import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prefetchMode } from "./prefetch-host.mjs";

describe("prefetchMode", () => {
  it("pulls every host image on a local clone", () => {
    assert.equal(prefetchMode({}), "all");
  });

  it("installs only the official etcd binary when asked or in GitHub Actions", () => {
    assert.equal(prefetchMode({ CANTILUNE_HOST_PREFETCH: "bin" }), "bin");
    assert.equal(prefetchMode({ GITHUB_ACTIONS: "true" }), "bin");
  });
});
