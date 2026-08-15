import type { RuleInventory } from "../manifest/ruleInventory.js";
import { validateRuleInventory } from "../manifest/ruleInventory.js";
import {
  conformanceViolation,
  type ConformanceViolation,
} from "../foundation/conformanceViolation.js";

export function verifyRuleInventoryCompleteness(
  inventory: RuleInventory,
  observedRuleIds: readonly string[],
): ConformanceViolation[] {
  const violations: ConformanceViolation[] = [];
  for (const message of validateRuleInventory(inventory)) {
    violations.push(conformanceViolation("inventory_duplicate", message));
  }
  const declared = new Set(inventory.entries.map((entry) => entry.ruleId));
  const observed = new Set(observedRuleIds);
  for (const ruleId of declared) {
    if (!observed.has(ruleId)) {
      violations.push(
        conformanceViolation("inventory_incomplete", `missing evidence for rule ${ruleId}`, ruleId),
      );
    }
  }
  for (const ruleId of observed) {
    if (!declared.has(ruleId)) {
      violations.push(
        conformanceViolation("inventory_extra", `undeclared rule evidence ${ruleId}`, ruleId),
      );
    }
  }
  if (declared.size !== inventory.entries.length) {
    violations.push(
      conformanceViolation("inventory_duplicate", "duplicate rule inventory entries"),
    );
  }
  return violations;
}
