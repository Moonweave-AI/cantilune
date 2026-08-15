import { describe, expect, it } from "vitest";
import {
  ALL_OPERATION_CODES,
  deriveOperationFamily,
  resolveOperationBinding,
} from "../../src/protocol/communicationOperationRegistry.js";
import { handlerManifestRef, operationTemplateRef } from "@cantilune/core";

describe("communication operation registry", () => {
  it("maps all 60 closed operation codes to one of 15 families", () => {
    expect(ALL_OPERATION_CODES).toHaveLength(60);
    const families = new Set(ALL_OPERATION_CODES.map((code) => deriveOperationFamily(code)));
    expect(families.size).toBe(15);
  });

  it("derives family from operationCode only — never caller-supplied", () => {
    const binding = resolveOperationBinding({
      operationCode: "reconnect",
      operationTemplateRef: operationTemplateRef("introduce", "1"),
      codecRef: "comms/wire-v1",
      handlerManifestRef: handlerManifestRef("handlers" as never, "digest" as never),
      protocolVersion: "comms/1",
    });
    expect(binding.family).toBe("instanceReconnect");
    expect(binding.operationCode).toBe("reconnect");
  });

  it("maps dynamicPartnerAdmission alias newChannel", () => {
    expect(deriveOperationFamily("newChannel")).toBe("dynamicPartnerAdmission");
  });
});
