import { describe, expect, it } from "vitest";
import { COMMS_RULE_INVENTORY } from "../../src/conformance/commsRuleInventory.js";
import { COMMS_MANIFEST_SCHEMA_VERSION } from "../../src/conformance/commsConformanceManifest.js";

describe("conformance scaffold", () => {
  it("lists comms rule inventory", () => {
    expect(COMMS_RULE_INVENTORY.length).toBeGreaterThan(0);
    expect(COMMS_RULE_INVENTORY[0]?.ruleId).toContain("comms.");
  });

  it("pins manifest schema version", () => {
    expect(COMMS_MANIFEST_SCHEMA_VERSION).toBe(1);
  });
});
