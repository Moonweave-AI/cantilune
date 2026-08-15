import { epochId, type EpochId } from "@cantilune/core";
import type { DurableCoordinator } from "../ports/durableCoordinator.js";
import type { OrchestrationSchema } from "../schema/orchestrationSchema.js";
import { snapshotOrchestrationSchema } from "../schema/orchestrationSchema.js";
import { createActiveSchemaContext, type ActiveSchemaContext } from "./activeSchemaContext.js";
import type { MutableSchemaContextHolder } from "./memoryEpochAdministration.js";
import type { RuntimeDependencies } from "./runtimeDependencies.js";

/**
 * Epoch used when the store has no head yet.
 *
 * A world with no head cannot be committed to at all — admission rejects with
 * `head_not_found` before it ever compares epochs — so this value can never
 * cause a mismatch. It exists only so the context has something to report.
 */
export const UNSEEDED_EPOCH_ID = epochId("unseeded");

/** The epoch stamped on the store's current head, or undefined when empty. */
function headEpochId(durable: DurableCoordinator): EpochId | undefined {
  const head = durable.head();
  if (head === undefined) return undefined;
  return durable.get(head)?.epochId;
}

/**
 * Static-schema wiring with an explicit epoch binding.
 *
 * The helper must never infer schema identity from an epoch string stored in a
 * snapshot. A durable world may have been produced by a different schema, and
 * simply relabelling the caller's compiled schema with that epoch would turn an
 * `epoch_mismatch` into unsafe admission under the wrong declarations.
 *
 * Callers therefore name the epoch for which the supplied static schema is
 * authoritative. A narrowly-scoped legacy migration may additionally declare
 * compatible epoch aliases. Those aliases are an explicit caller assertion,
 * not a value learned from the durable head.
 */
export function runtimeDependenciesWithStaticSchema(
  deps: Omit<RuntimeDependencies, "schemaContext"> & {
    readonly schema: OrchestrationSchema;
    readonly activeEpochId: EpochId;
    readonly compatibleEpochIds?: readonly EpochId[];
  },
): RuntimeDependencies {
  const { schema, activeEpochId, compatibleEpochIds = [], ...rest } = deps;
  const durable = rest.durable;
  const compatible = new Set<EpochId>([activeEpochId, ...compatibleEpochIds]);
  // Capture at wiring time. Deferring this copy until holder.get() would let a
  // caller mutate the supplied schema after construction but before admission.
  const schemaSnapshot = snapshotOrchestrationSchema(schema);

  const initialHeadEpoch = headEpochId(durable);
  if (initialHeadEpoch !== undefined && !compatible.has(initialHeadEpoch)) {
    throw new Error(
      `static schema epoch ${String(activeEpochId)} is not bound to head snapshot epoch ${String(initialHeadEpoch)}; ` +
        "provide a governed schema resolver or an explicitly reviewed compatibleEpochIds migration",
    );
  }

  // Revalidate on every use so a later dynamic epoch transition cannot silently
  // reuse this static schema. For an explicitly declared legacy alias the
  // context must carry the head epoch because admission compares those values.
  const holder: MutableSchemaContextHolder = {
    get(): ActiveSchemaContext {
      const head = headEpochId(durable);
      if (head !== undefined && !compatible.has(head)) {
        throw new Error(
          `static schema epoch ${String(activeEpochId)} is not bound to head snapshot epoch ${String(head)}`,
        );
      }
      const active = head ?? activeEpochId ?? UNSEEDED_EPOCH_ID;
      return createActiveSchemaContext(schemaSnapshot, active);
    },
    // Epoch transitions belong to the control-plane-governed wiring, which
    // supplies its own holder. Accepting a set() here would let a caller pin
    // an epoch that the head then drifts away from — the exact failure this
    // helper exists to prevent.
    set(): void {
      throw new Error(
        "static schema wiring does not support epoch transitions; " +
          "use the epoch administration wiring instead",
      );
    },
  };

  return { ...rest, schemaContext: holder };
}
