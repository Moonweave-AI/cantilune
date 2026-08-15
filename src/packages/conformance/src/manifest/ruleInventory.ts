export interface RuleInventoryEntry {
  readonly ruleId: string;
  readonly ruleKind: string;
  readonly theoryRef: string;
}

export interface RuleInventory {
  readonly inventorySchemaVersion: 1;
  readonly inventoryDigest: string;
  readonly entries: readonly RuleInventoryEntry[];
}

export function validateRuleInventory(inventory: RuleInventory): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const entry of inventory.entries) {
    if (seen.has(entry.ruleId)) {
      errors.push(`duplicate ruleId: ${entry.ruleId}`);
    }
    seen.add(entry.ruleId);
    if (entry.ruleId.length === 0) {
      errors.push("empty ruleId");
    }
  }
  return errors;
}
