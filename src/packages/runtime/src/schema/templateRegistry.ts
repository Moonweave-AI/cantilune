import type { OperationTypeId } from "@cantilune/core";
import type { OperationTemplate } from "./operationTemplate.js";

export interface TemplateRegistry {
  get(operationTypeId: OperationTypeId, revision?: string): OperationTemplate | undefined;
  register(template: OperationTemplate): void;
  list(): readonly OperationTemplate[];
}

export class InMemoryTemplateRegistry implements TemplateRegistry {
  private readonly templates = new Map<string, OperationTemplate>();

  get(operationTypeId: OperationTypeId, revision?: string): OperationTemplate | undefined {
    if (revision !== undefined) {
      return this.templates.get(templateKey(operationTypeId, revision));
    }
    return this.templates.get(operationTypeId);
  }

  register(template: OperationTemplate): void {
    const revision = template.templateRef.revision;
    this.templates.set(templateKey(template.operationTypeId, revision), template);
    if (!this.templates.has(template.operationTypeId)) {
      this.templates.set(template.operationTypeId, template);
    }
  }

  list(): readonly OperationTemplate[] {
    const seen = new Set<string>();
    const result: OperationTemplate[] = [];
    for (const template of this.templates.values()) {
      const key = templateKey(template.operationTypeId, template.templateRef.revision);
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);
      result.push(template);
    }
    return result;
  }
}

function templateKey(operationTypeId: OperationTypeId, revision: string): string {
  return `${operationTypeId}@${revision}`;
}
