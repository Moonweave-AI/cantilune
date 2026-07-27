import Cantilune.Theorems.ProductProtocolTrajectoryBridge
import Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory

/-!
# No-argument global-P1b/candidate-indexed-P1c trajectory reference

This module instantiates the generic dependency bridge with the substantive
post-admission reconnect execution.  The P1b establishment step is retained
as the separately verified global request/accept sublanguage witness; no
P1b-to-reconnect session or causal seam is claimed.  The P1c occurrence, product DPO candidate,
registry row, stochastic row, raw late-pi transition, and actual-Agent
endpoints all select `.instanceReconnect`.
-/

noncomputable section

namespace Cantilune.Theorems.SubstantiveProtocolTrajectoryBridge

open Cantilune.Theorems.ProductProtocolTrajectoryBridge

/-- The reference package uses exactly the canonical P1b and candidate-indexed P1c occurrences. -/
def referenceProtocolBridge :
    CandidateIndexedProtocolBridge
      Cantilune.Theorems.SubstantiveReconnectConformance.core where
  p1bGlobalCertificate := rfl
  p1bGlobalOccurrence := rfl
  p1cCertificate := rfl
  p1cOccurrence := rfl
  candidatePhaseEdge :=
    Cantilune.Pi.P1cEnrichedStructuralCertificate.PhaseEdge.first
      .instanceReconnect
  admissionPhaseEdge :=
    Cantilune.Pi.P1cEnrichedStructuralCertificate.PhaseEdge.first
      .dynamicPartnerAdmission

/--
The single reference certificate carrying both the candidate-indexed
protocol bridge and the exact common-FMS stochastic row.
-/
def referenceCompleteProtocolTrajectory :
    CompleteProductProtocolTrajectoryCertificate
      Cantilune.Theorems.SubstantiveReconnectConformance.core
      Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.positiveLabelling
      Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.productFMSLabelling
      Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalPositivePath
      Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalTrajectoryAgreement
      0 where
  protocol := referenceProtocolBridge
  trajectory :=
    Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.completeCertificate

/--
Reference anti-vacuity: one record separately retains the global P1b
sublanguage theorem and proves that the reconnect candidate, selected
stochastic row, registry payload, replay, strong/enriched P1c transition and
actual-Agent endpoints coincide exactly.
-/
def reference_complete_protocol_candidate_evidence :=
  referenceCompleteProtocolTrajectory.complete_protocol_candidate_evidence

end Cantilune.Theorems.SubstantiveProtocolTrajectoryBridge
