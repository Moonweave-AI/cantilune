import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { prefetchMode } from "./prefetch-host.mjs";
import { CLOAKBROWSER_VERSION, cloakBrowserEnvironment } from "./prefetch-cloakbrowser.mjs";

describe("prefetchMode", () => {
  it("pulls every host image on a local clone", () => {
    assert.equal(prefetchMode({}), "all");
  });

  it("installs only the official etcd binary when asked or in GitHub Actions", () => {
    assert.equal(prefetchMode({ CANTILUNE_HOST_PREFETCH: "bin" }), "bin");
    assert.equal(prefetchMode({ GITHUB_ACTIONS: "true" }), "bin");
  });
});

describe("cloakBrowserEnvironment", () => {
  it("pins a repository-local, non-updating keyless browser configuration", () => {
    const env = cloakBrowserEnvironment("D:/repo", {});
    assert.equal(env.CLOAKBROWSER_VERSION, CLOAKBROWSER_VERSION);
    assert.equal(env.CLOAKBROWSER_AUTO_UPDATE, "false");
    assert.equal(env.CLOAKBROWSER_WIDEVINE, "0");
    assert.match(env.CLOAKBROWSER_CACHE_DIR, /\.cantilune[\\/]cloakbrowser$/u);
  });

  it("preserves explicit host overrides", () => {
    const env = cloakBrowserEnvironment("D:/repo", {
      CLOAKBROWSER_CACHE_DIR: "D:/shared-cache",
      CLOAKBROWSER_VERSION: "1.2.3.4",
      CLOAKBROWSER_AUTO_UPDATE: "true",
      CLOAKBROWSER_WIDEVINE: "1",
    });
    assert.deepEqual(env, {
      CLOAKBROWSER_CACHE_DIR: "D:/shared-cache",
      CLOAKBROWSER_VERSION: "1.2.3.4",
      CLOAKBROWSER_AUTO_UPDATE: "true",
      CLOAKBROWSER_WIDEVINE: "1",
    });
  });
});
