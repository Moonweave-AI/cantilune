import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  COMMS_HMAC_KEY_ENV,
  COMMS_HMAC_KEY_FILE,
  createHmacKeyResolver,
  resolveCommsHmacKey,
} from "../../src/security/hmacKeyMaterial.js";

describe("hmacKeyMaterial", () => {
  it("prefers env over store file and ignores blank values", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-hmac-key-"));
    try {
      writeFileSync(join(dir, COMMS_HMAC_KEY_FILE), "file-secret\n", "utf8");
      expect(
        resolveCommsHmacKey({
          storeDir: dir,
          env: { [COMMS_HMAC_KEY_ENV]: " env-secret " },
        }),
      ).toBe("env-secret");
      expect(resolveCommsHmacKey({ storeDir: dir, env: { [COMMS_HMAC_KEY_ENV]: "  " } })).toBe(
        "file-secret",
      );
      expect(resolveCommsHmacKey({ env: {} })).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("treats a missing or empty key file as absent", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-hmac-empty-"));
    try {
      expect(resolveCommsHmacKey({ storeDir: dir, env: {} })).toBeUndefined();
      writeFileSync(join(dir, COMMS_HMAC_KEY_FILE), "   \n", "utf8");
      expect(resolveCommsHmacKey({ storeDir: dir, env: {} })).toBeUndefined();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("fail-closes when the key path exists but is unreadable", () => {
    const dir = mkdtempSync(join(tmpdir(), "cantilune-hmac-dir-"));
    try {
      mkdirSync(join(dir, COMMS_HMAC_KEY_FILE));
      expect(() => resolveCommsHmacKey({ storeDir: dir, env: {} })).toThrow(/unreadable/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("resolves a non-empty secret and rejects an empty resolver secret", () => {
    const ok = createHmacKeyResolver("operator-secret").resolveVerificationKey("any");
    expect(ok.ok).toBe(true);
    const empty = createHmacKeyResolver("").resolveVerificationKey("any");
    expect(empty.ok).toBe(false);
  });
});
