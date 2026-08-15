import { type EventSpine } from "../world/eventSpine.js";
import { type CommunicationView } from "../projection/views/communicationView.js";
import { type DependencyView } from "../projection/views/dependencyView.js";
import { type ResourceView } from "../projection/views/resourceView.js";
import { type StructureView } from "../projection/views/structureView.js";
import { type DiagnosticSummary } from "../diagnostic/diagnosticSummary.js";
import { type ReadModelDerivationEvidence } from "../certificate/readModelDerivationEvidence.js";

export interface FourViewBundle {
  readonly spine: EventSpine;
  readonly dependency: DependencyView;
  readonly resource: ResourceView;
  readonly communication: CommunicationView;
  readonly structure: StructureView;
  readonly diagnostic?: DiagnosticSummary;
  /** Engineering self-check evidence — not a formal ProjectionCertificate. */
  readonly evidence?: ReadModelDerivationEvidence;
}

export function fourViewBundle(init: {
  readonly spine: EventSpine;
  readonly dependency: DependencyView;
  readonly resource: ResourceView;
  readonly communication: CommunicationView;
  readonly structure: StructureView;
  readonly diagnostic?: DiagnosticSummary;
  readonly evidence?: ReadModelDerivationEvidence;
}): FourViewBundle {
  return init;
}

/** @deprecated Use {@link FourViewBundle.evidence}. */
export type FourViewBundleWithCertificates = FourViewBundle;
