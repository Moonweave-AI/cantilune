import { type Footprint, type SnapshotRef } from "@cantilune/core";
import { type CommunicationOperationBinding } from "./communicationOperationRegistry.js";
import {
  type CommunicationProtocolPhase,
  type EndpointDisposition,
  type OccurrenceLifecycle,
} from "../foundation/communicationStateAxes.js";
import { type NativeCommunicationAction } from "./nativeCommunicationAction.js";
import { type StableCommunicationMetadata } from "../foundation/stableCommunicationMetadata.js";

export interface CommunicationOccurrenceRecord {
  readonly operation: CommunicationOperationBinding;
  readonly phase: CommunicationProtocolPhase;
  readonly lifecycle: OccurrenceLifecycle;
  readonly disposition: EndpointDisposition;
  readonly nativeAction: NativeCommunicationAction;
  readonly metadata: StableCommunicationMetadata;
  readonly beforeSnapshotRef: SnapshotRef;
  readonly afterSnapshotRef?: SnapshotRef;
  readonly effectiveFootprint: Footprint;
  readonly endpointEvidenceRef?: string;
  readonly replayEvidenceRef?: string;
  readonly transportAttemptRefs: readonly string[];
  readonly recordedAt: string;
}
