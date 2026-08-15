import type { CollaborationSnapshot, SchemaEpochBinding, SnapshotRef } from "@cantilune/core";
import type { SnapshotWireDto } from "../codec/snapshotCodec.js";
import type { ChangeWireDto } from "../codec/changeCodec.js";
import { decodeChangeFromUnknown, encodeChangeWithRecipe } from "../codec/changeCodec.js";
import { decodeSnapshotFromUnknown, encodeSnapshot } from "../codec/snapshotCodec.js";
import { parseSchemaBindingWire, serializeSchemaBindingWire, type SchemaBindingWireDto } from "../codec/bindingWire.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { ReplayRecipe } from "../replay/recipe.js";
import { RecipeSidecar } from "../replay/recipeSidecar.js";
import type { MemoryDurableCoordinator } from "./memoryDurableCoordinator.js";
import { MemoryChangeLog } from "./memoryChangeLog.js";
import { MemoryCollaborationStore } from "./memoryStore.js";
import { MemoryDurableCoordinator as MemoryDurableCoordinatorImpl } from "./memoryDurableCoordinator.js";

export interface RecipeWireEntry {
  readonly changeId: string;
  readonly recipe: ReplayRecipe;
}

export interface DurableWireBundle {
  readonly t0Ref: string;
  readonly headRef: string;
  readonly snapshots: readonly SnapshotWireDto[];
  readonly changes: readonly ChangeWireDto[];
  readonly recipes: readonly RecipeWireEntry[];
  /**
   * Active schema epoch binding for the head, atomically published with it.
   * Absent in bundles written before SS-02 (ADR-0014); a legacy bundle is
   * tolerated only through the explicit static-schema boot path.
   */
  readonly schemaBinding?: SchemaBindingWireDto;
}

export interface ImportDurableResult {
  readonly durable: MemoryDurableCoordinator;
  readonly store: MemoryCollaborationStore;
  readonly changelog: MemoryChangeLog;
  readonly sidecar: RecipeSidecar;
  readonly t0: CollaborationSnapshot;
  /** Active binding carried by the bundle, or undefined for a legacy bundle. */
  readonly schemaBinding: SchemaEpochBinding | undefined;
}

export function exportDurableBundle(
  durable: MemoryDurableCoordinator,
  store: MemoryCollaborationStore,
  sidecar: RecipeSidecar,
  t0Ref: SnapshotRef,
): DurableWireBundle {
  const headRef = durable.head();
  if (headRef === undefined) {
    throw new Error("exportDurableBundle: missing head");
  }

  const snapshots = store.allSnapshots().map((snapshot) => encodeSnapshot(snapshot));
  const changes = durable.changes().map((change) => {
    const recipe = sidecar.get(change.changeId);
    if (recipe === undefined) {
      throw new Error(`exportDurableBundle: missing recipe for ${change.changeId}`);
    }
    return encodeChangeWithRecipe(change, recipe);
  });
  const recipes = durable.changes().map((change) => {
    const recipe = sidecar.get(change.changeId);
    if (recipe === undefined) {
      throw new Error(`exportDurableBundle: missing recipe for ${change.changeId}`);
    }
    return { changeId: change.changeId, recipe };
  });
  const activeBinding = durable.activeBinding();
  const schemaBinding =
    activeBinding === undefined ? undefined : serializeSchemaBindingWire(activeBinding);

  return {
    t0Ref,
    headRef,
    snapshots,
    changes,
    recipes,
    ...(schemaBinding !== undefined ? { schemaBinding } : {}),
  };
}

function decodeSnapshotsFromBundle(wires: unknown): CollaborationSnapshot[] | RuntimeViolation {
  if (!Array.isArray(wires)) {
    return runtimeViolation("codec_invalid", "bundle missing snapshots array");
  }
  const snapshots: CollaborationSnapshot[] = [];
  for (const wire of wires) {
    const decoded = decodeSnapshotFromUnknown(wire);
    if ("code" in decoded) {
      return decoded;
    }
    snapshots.push(decoded);
  }
  return snapshots;
}

function appendChangesFromBundle(
  wires: unknown,
  changelog: MemoryChangeLog,
  sidecar: RecipeSidecar,
): RuntimeViolation | undefined {
  if (!Array.isArray(wires)) {
    return runtimeViolation("codec_invalid", "bundle missing changes array");
  }
  for (const wire of wires) {
    const decoded = decodeChangeFromUnknown(wire);
    if ("code" in decoded) {
      return decoded;
    }
    const { change, recipe } = decoded;
    if (!changelog.append(change)) {
      return runtimeViolation("codec_invalid", `duplicate changeId ${change.changeId}`);
    }
    // The recipe embedded in the strictly decoded change wire is the sole
    // replay authority. The legacy top-level copy is consistency evidence only.
    sidecar.put(change.changeId, recipe);
  }
  return undefined;
}

function canonicalJson(value: unknown): string | undefined {
  try {
    return JSON.stringify(value, (_key, entry: unknown) => {
      if (entry === null || typeof entry !== "object" || Array.isArray(entry)) return entry;
      const prototype = Object.getPrototypeOf(entry) as unknown;
      if (prototype !== Object.prototype && prototype !== null) {
        throw new TypeError("non-JSON recipe value");
      }
      return Object.fromEntries(
        Object.entries(entry as Record<string, unknown>).sort(([left], [right]) =>
          left.localeCompare(right),
        ),
      );
    });
  } catch {
    return undefined;
  }
}

function validateRecipeCopies(
  recipes: unknown,
  sidecar: RecipeSidecar,
  changelog: MemoryChangeLog,
): RuntimeViolation | undefined {
  if (!Array.isArray(recipes)) {
    return runtimeViolation("codec_invalid", "bundle missing recipes array");
  }
  const seen = new Set<string>();
  for (const entry of recipes) {
    if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
      return runtimeViolation("codec_invalid", "bundle contains malformed recipe entry");
    }
    const record = entry as Record<string, unknown>;
    const changeId = record["changeId"];
    if (typeof changeId !== "string" || changeId === "" || seen.has(changeId)) {
      return runtimeViolation("codec_invalid", "bundle contains invalid or duplicate recipe id");
    }
    const change = changelog.all().find((candidate) => candidate.changeId === changeId);
    const authoritative = change === undefined ? undefined : sidecar.get(change.changeId);
    if (
      authoritative === undefined ||
      canonicalJson(record["recipe"]) === undefined ||
      canonicalJson(record["recipe"]) !== canonicalJson(authoritative)
    ) {
      return runtimeViolation("codec_invalid", `bundle recipe mismatch for ${changeId}`);
    }
    seen.add(changeId);
  }
  if (seen.size !== changelog.all().length) {
    return runtimeViolation("codec_invalid", "bundle recipe copies do not match change history");
  }
  return undefined;
}

export function importDurableBundle(bundle: unknown): ImportDurableResult | RuntimeViolation {
  if (bundle === null || typeof bundle !== "object") {
    return runtimeViolation("codec_invalid", "bundle must be object");
  }

  const record = bundle as Record<string, unknown>;
  if (typeof record.t0Ref !== "string" || typeof record.headRef !== "string") {
    return runtimeViolation("codec_invalid", "bundle missing t0Ref/headRef/snapshots/changes");
  }

  const snapshotsResult = decodeSnapshotsFromBundle(record.snapshots);
  if ("code" in snapshotsResult) {
    return snapshotsResult;
  }
  const snapshots = snapshotsResult;

  const t0 = snapshots.find((snapshot) => snapshot.snapshotRef === record.t0Ref);
  if (t0 === undefined) {
    return runtimeViolation("codec_invalid", `bundle missing t0 snapshot ${record.t0Ref}`);
  }

  const store = new MemoryCollaborationStore();
  for (const snapshot of snapshots) {
    store.putIfAbsent(snapshot);
  }
  store.setHead(record.headRef as SnapshotRef);

  const changelog = new MemoryChangeLog();
  const sidecar = new RecipeSidecar();
  const changesError = appendChangesFromBundle(record.changes, changelog, sidecar);
  if (changesError !== undefined) {
    return changesError;
  }
  const recipeError = validateRecipeCopies(record.recipes, sidecar, changelog);
  if (recipeError !== undefined) return recipeError;

  // The active binding is optional: bundles written before SS-02 (ADR-0014)
  // carry none and are tolerated through the explicit static-schema boot path.
  // When present it must parse and its epoch must match the head's epoch, so a
  // reader never observes a head whose epoch has no binding.
  let schemaBinding: SchemaEpochBinding | undefined;
  if (record.schemaBinding !== undefined) {
    const parsed = parseSchemaBindingWire(record.schemaBinding);
    if (!parsed.ok) {
      return parsed.violation;
    }
    const head = store.get(record.headRef as SnapshotRef);
    if (head === undefined) {
      return runtimeViolation("codec_invalid", "bundle schemaBinding present but head missing");
    }
    if (parsed.value.epochId !== head.epochId) {
      return runtimeViolation(
        "codec_invalid",
        `bundle schemaBinding epoch ${String(parsed.value.epochId)} does not match head epoch ${String(head.epochId)}`,
      );
    }
    schemaBinding = parsed.value;
  }

  const durable = new MemoryDurableCoordinatorImpl(store, changelog, sidecar, schemaBinding);
  return { durable, store, changelog, sidecar, t0, schemaBinding };
}

export function serializeDurableBundle(bundle: DurableWireBundle): unknown {
  return structuredClone(bundle);
}

export function deserializeDurableBundle(json: unknown): ImportDurableResult | RuntimeViolation {
  return importDurableBundle(json);
}

export function importDurableBundleTyped(bundle: DurableWireBundle): ImportDurableResult {
  const result = importDurableBundle(bundle);
  if ("code" in result) {
    throw new Error(result.message);
  }
  return result;
}
