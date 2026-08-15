import { describe, expect, it } from "vitest";
import {
  createMemoryConformanceEngine,
  createNoopAuditSink,
} from "../../src/adapters/memory/index.js";
import { verifyRuleInventoryCompleteness } from "../../src/verifier/inventoryVerifier.js";
import type { RuleInventory } from "../../src/manifest/ruleInventory.js";

describe("conformance engine inventory gate", () => {
  it("rejects hidden extra rules", () => {
    const inventory: RuleInventory = {
      inventorySchemaVersion: 1,
      inventoryDigest: "abc",
      entries: [{ ruleId: "rule-a", ruleKind: "native", theoryRef: "Execution.lean" }],
    };
    const violations = verifyRuleInventoryCompleteness(inventory, ["rule-a", "rule-hidden"]);
    expect(violations.some((v) => v.code === "inventory_extra")).toBe(true);
  });

  it("rejects missing declared rules", () => {
    const inventory: RuleInventory = {
      inventorySchemaVersion: 1,
      inventoryDigest: "abc",
      entries: [
        { ruleId: "rule-a", ruleKind: "native", theoryRef: "Execution.lean" },
        { ruleId: "rule-b", ruleKind: "native", theoryRef: "Execution.lean" },
      ],
    };
    const violations = verifyRuleInventoryCompleteness(inventory, ["rule-a"]);
    expect(violations.some((v) => v.code === "inventory_incomplete")).toBe(true);
  });

  it("inventory duplicate entries branch", () => {
    const inventory: RuleInventory = {
      inventorySchemaVersion: 1,
      inventoryDigest: "abc",
      entries: [
        { ruleId: "rule-a", ruleKind: "native", theoryRef: "Execution.lean" },
        { ruleId: "rule-a", ruleKind: "native", theoryRef: "Execution.lean" },
      ],
    };
    const violations = verifyRuleInventoryCompleteness(inventory, ["rule-a"]);
    expect(violations.some((v) => v.code === "inventory_duplicate")).toBe(true);
  });

  it("lists missing evidence via engine", () => {
    const engine = createMemoryConformanceEngine({ audit: createNoopAuditSink() });
    const missing = engine.listMissingEvidence({
      inventory: {
        inventorySchemaVersion: 1,
        inventoryDigest: "abc",
        entries: [{ ruleId: "r1", ruleKind: "native", theoryRef: "t" }],
      },
      observedRuleIds: [],
    });
    expect(missing).toEqual(["r1"]);
  });
});
