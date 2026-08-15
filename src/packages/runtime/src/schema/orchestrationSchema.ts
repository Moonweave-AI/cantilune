import type {
  ChangeVisibility,
  MatchBinding,
  ObjectTypeId,
  OperationTemplateRef,
  OperationTypeId,
  SchemaId,
} from "@cantilune/core";
import type { OperationTemplate, TemplateCondition } from "./operationTemplate.js";

export type StructuralMode = "cartesian" | "affine" | "relevant" | "linear";

export interface ObjectTypeDeclaration {
  readonly objectTypeId: ObjectTypeId;
  readonly structuralMode: StructuralMode;
  readonly codecRef: string;
  readonly description: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface PortDeclaration {
  readonly portName: string;
  readonly position: number;
  readonly objectTypeId: ObjectTypeId;
}

export interface PortContract {
  readonly inputs: readonly PortDeclaration[];
  readonly outputs: readonly PortDeclaration[];
  readonly requires: readonly TemplateCondition[];
  readonly ensures: readonly TemplateCondition[];
}

export interface OperationTypeDeclaration {
  readonly operationTypeId: OperationTypeId;
  readonly templateRef: OperationTemplateRef;
  readonly portContract: PortContract;
  readonly requiredRoles: readonly MatchBinding["role"][];
  readonly defaultVisibility: ChangeVisibility;
  readonly mayCreateSessions: boolean;
}

export interface ResourceRule {
  readonly ruleId: string;
  readonly objectTypeId?: ObjectTypeId;
  readonly structuralMode: StructuralMode;
  readonly capacity?: number;
  readonly allowsCopy: boolean;
  readonly allowsDrop: boolean;
  readonly requiresQuiescence: boolean;
}

/** Immutable orchestration schema content — epoch lives in SchemaEpochBinding. */
export interface OrchestrationSchema {
  readonly schemaId: SchemaId;
  readonly wireVersion: number;
  readonly objectTypes: ReadonlyMap<ObjectTypeId, ObjectTypeDeclaration>;
  readonly operationTypes: ReadonlyMap<OperationTypeId, OperationTypeDeclaration>;
  /** Immutable template snapshot — precise revision per operation declaration. */
  readonly templates: readonly OperationTemplate[];
  readonly resourceRules: readonly ResourceRule[];
}

/**
 * Read-only Map implementation whose mutable backing collection is never
 * exposed. `Object.freeze(new Map())` is insufficient because `set`, `delete`,
 * and `clear` still mutate the Map's internal slots.
 */
class DetachedReadonlyMap<Key, Value> implements ReadonlyMap<Key, Value> {
  readonly #entries: Map<Key, Value>;

  constructor(entries: Iterable<readonly [Key, Value]>) {
    this.#entries = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: Key): Value | undefined {
    return this.#entries.get(key);
  }

  has(key: Key): boolean {
    return this.#entries.has(key);
  }

  entries(): MapIterator<[Key, Value]> {
    return this.#entries.entries();
  }

  keys(): MapIterator<Key> {
    return this.#entries.keys();
  }

  values(): MapIterator<Value> {
    return this.#entries.values();
  }

  forEach(
    callbackfn: (value: Value, key: Key, map: ReadonlyMap<Key, Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const [key, value] of this.#entries) {
      callbackfn.call(thisArg, value, key, this);
    }
  }

  [Symbol.iterator](): MapIterator<[Key, Value]> {
    return this.#entries[Symbol.iterator]();
  }
}

Object.freeze(DetachedReadonlyMap.prototype);

/** Same no-backing-leak guarantee as DetachedReadonlyMap, for schema-derived sets. */
class DetachedReadonlySet<Value> implements ReadonlySet<Value> {
  readonly #values: Set<Value>;

  constructor(values: Iterable<Value>) {
    this.#values = new Set(values);
    Object.freeze(this);
  }

  get size(): number {
    return this.#values.size;
  }

  has(value: Value): boolean {
    return this.#values.has(value);
  }

  entries(): SetIterator<[Value, Value]> {
    return this.#values.entries();
  }

  keys(): SetIterator<Value> {
    return this.#values.keys();
  }

  values(): SetIterator<Value> {
    return this.#values.values();
  }

  forEach(
    callbackfn: (value: Value, value2: Value, set: ReadonlySet<Value>) => void,
    thisArg?: unknown,
  ): void {
    for (const value of this.#values) {
      callbackfn.call(thisArg, value, value, this);
    }
  }

  [Symbol.iterator](): SetIterator<Value> {
    return this.#values[Symbol.iterator]();
  }
}

Object.freeze(DetachedReadonlySet.prototype);

function snapshotCondition(condition: TemplateCondition): TemplateCondition {
  return Object.freeze({
    kind: condition.kind,
    bindings: Object.freeze({ ...condition.bindings }),
  });
}

function snapshotPortDeclaration(declaration: PortDeclaration): PortDeclaration {
  return Object.freeze({ ...declaration });
}

function snapshotPortContract(contract: PortContract): PortContract {
  return Object.freeze({
    inputs: Object.freeze(contract.inputs.map(snapshotPortDeclaration)),
    outputs: Object.freeze(contract.outputs.map(snapshotPortDeclaration)),
    requires: Object.freeze(contract.requires.map(snapshotCondition)),
    ensures: Object.freeze(contract.ensures.map(snapshotCondition)),
  });
}

function snapshotTemplate(template: OperationTemplate): OperationTemplate {
  return Object.freeze({
    operationTypeId: template.operationTypeId,
    templateRef: Object.freeze({ ...template.templateRef }),
    description: template.description,
    requiredRoles: Object.freeze([...template.requiredRoles]),
    requires: Object.freeze(template.requires.map(snapshotCondition)),
    ensures: Object.freeze(template.ensures.map(snapshotCondition)),
    defaultVisibility: template.defaultVisibility,
    mayCreateSessions: template.mayCreateSessions,
  });
}

function snapshotObjectType(declaration: ObjectTypeDeclaration): ObjectTypeDeclaration {
  return Object.freeze({
    objectTypeId: declaration.objectTypeId,
    structuralMode: declaration.structuralMode,
    codecRef: declaration.codecRef,
    description: declaration.description,
    metadata: Object.freeze({ ...declaration.metadata }),
  });
}

function snapshotOperationType(declaration: OperationTypeDeclaration): OperationTypeDeclaration {
  return Object.freeze({
    operationTypeId: declaration.operationTypeId,
    templateRef: Object.freeze({ ...declaration.templateRef }),
    portContract: snapshotPortContract(declaration.portContract),
    requiredRoles: Object.freeze([...declaration.requiredRoles]),
    defaultVisibility: declaration.defaultVisibility,
    mayCreateSessions: declaration.mayCreateSessions,
  });
}

function snapshotResourceRule(rule: ResourceRule): ResourceRule {
  return Object.freeze({
    ruleId: rule.ruleId,
    ...(rule.objectTypeId !== undefined ? { objectTypeId: rule.objectTypeId } : {}),
    structuralMode: rule.structuralMode,
    ...(rule.capacity !== undefined ? { capacity: rule.capacity } : {}),
    allowsCopy: rule.allowsCopy,
    allowsDrop: rule.allowsDrop,
    requiresQuiescence: rule.requiresQuiescence,
  });
}

/**
 * Takes the authoritative, detached schema snapshot used by one epoch.
 *
 * Every caller-owned collection and nested declaration is copied. Arrays and
 * records are frozen, while Maps are replaced with collection views that do
 * not expose any mutator or mutable backing Map. This is the single boundary
 * used by both admission and historical replay.
 */
export function snapshotOrchestrationSchema(schema: OrchestrationSchema): OrchestrationSchema {
  const objectTypes = new DetachedReadonlyMap(
    [...schema.objectTypes].map(
      ([id, declaration]) => [id, snapshotObjectType(declaration)] as const,
    ),
  );
  const operationTypes = new DetachedReadonlyMap(
    [...schema.operationTypes].map(
      ([id, declaration]) => [id, snapshotOperationType(declaration)] as const,
    ),
  );

  return Object.freeze({
    schemaId: schema.schemaId,
    wireVersion: schema.wireVersion,
    objectTypes,
    operationTypes,
    templates: Object.freeze(schema.templates.map(snapshotTemplate)),
    resourceRules: Object.freeze(schema.resourceRules.map(snapshotResourceRule)),
  });
}

export function allowedOperationsFromSchema(
  schema: OrchestrationSchema,
): ReadonlySet<OperationTypeId> {
  return new DetachedReadonlySet(schema.operationTypes.keys());
}

export function resolveTemplate(
  schema: OrchestrationSchema,
  operationTypeId: OperationTypeId,
  revision?: string,
): OperationTemplate | undefined {
  if (revision !== undefined) {
    return schema.templates.find(
      (template) =>
        template.operationTypeId === operationTypeId && template.templateRef.revision === revision,
    );
  }
  const declaration = schema.operationTypes.get(operationTypeId);
  if (declaration === undefined) {
    return undefined;
  }
  return schema.templates.find(
    (template) =>
      template.operationTypeId === operationTypeId &&
      template.templateRef.revision === declaration.templateRef.revision,
  );
}

export function portContractFromTemplate(template: OperationTemplate): PortContract {
  return {
    inputs: [],
    outputs: [],
    requires: template.requires,
    ensures: template.ensures,
  };
}

export function operationDeclarationFromTemplate(
  template: OperationTemplate,
): OperationTypeDeclaration {
  return {
    operationTypeId: template.operationTypeId,
    templateRef: template.templateRef,
    portContract: portContractFromTemplate(template),
    requiredRoles: template.requiredRoles,
    defaultVisibility: template.defaultVisibility,
    mayCreateSessions: template.mayCreateSessions,
  };
}
