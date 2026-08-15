import type {
  ActorRef,
  CollaborationSnapshot,
  CoordinationIntent,
  EvidenceRef,
  Footprint,
  SnapshotRef,
} from "@cantilune/core";
import type { AdmittedId } from "../foundation/brands.js";
import type { OperationTemplate } from "../schema/operationTemplate.js";
import type { ReplayRecipe } from "../replay/recipe.js";

/** Internal post-admission state — not constructible outside runtime admission. */
export interface AdmittedRecord {
  readonly admittedId: AdmittedId;
  readonly principal: ActorRef;
  readonly intent: CoordinationIntent;
  readonly beforeSnapshot: CollaborationSnapshot;
  readonly beforeRef: SnapshotRef;
  readonly template: OperationTemplate;
  readonly effectiveFootprint: Footprint;
  readonly recipe: ReplayRecipe;
  readonly authorization: readonly EvidenceRef[];
  readonly policyRevision: string;
  readonly expiresAt: number;
}
