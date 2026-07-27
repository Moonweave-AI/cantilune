import Mathlib.CategoryTheory.Monoidal.Cartesian.Basic
import Cantilune.Core.ProjectionFamily
import Cantilune.Tests.CompleteProjection

/-!
# Extension-indexed projection-family regression

This module constructs a nonempty execution family for every finite signature,
then checks identity projection, admission composition, and DPO replay
commutation on actual values.
-/

namespace Cantilune.Tests.ProjectionFamily

open CategoryTheory
open Cantilune.Core

#check ReindexableExecutionFamily.pure_reindex_ne_admission_target

/-- Empty but well-formed runtime configuration over an arbitrary signature. -/
def emptyConfig (σ : FinSignature) : Config σ where
  signatureVersion := 0
  nodes := ∅
  edges := ∅
  nodeLabel := fun _ => none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 0
  tombstones := ∅

theorem emptyConfig_wellFormed (σ : FinSignature) :
    (emptyConfig σ).WellFormed := by
  simp [Config.WellFormed, emptyConfig]

/-- Replay leaves its explicit source unchanged. -/
def replayKernel (σ : FinSignature) : DPOEvent.ReplayKernel σ where
  run := fun _ source => some source

def event (σ : FinSignature) : DPOEvent σ where
  signatureVersion := 0
  ruleId := 0
  source := emptyConfig σ
  target := emptyConfig σ
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := Function.Embedding.refl (Fin 0)
  complementTag := 0
  freshNames := ∅
  policyEvidence := []
  externalEvidence := []
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp [emptyConfig]
  sourceWellFormed := emptyConfig_wellFormed σ
  targetWellFormed := emptyConfig_wellFormed σ

def verifiedEvent (σ : FinSignature) :
    DPOEvent.Verified (replayKernel σ) where
  event := event σ
  replay_correct := rfl

def lts : ObservableLTS where
  State := Unit
  Event := Unit
  stateSetoid := ObservableLTS.equalitySetoid Unit
  step := fun _ _ _ => True
  observable := fun _ => True
  success := fun _ => True
  waiting := fun _ => False
  signatureVersion := fun _ => 0
  step_congr := by simp
  success_congr := by simp
  waiting_congr := by simp
  signatureVersion_congr := by simp

theorem nativeStep : lts.ObservableStep () () () :=
  ⟨trivial, trivial⟩

def package (σ : FinSignature) : ExecutionPackage σ where
  lts := lts
  configOf := fun _ => emptyConfig σ
  replayKernel := replayKernel σ
  eventRecord := fun _ => verifiedEvent σ
  eventEndpoints := by
    intro source eventLabel target step
    exact (verifiedEvent σ).replays_recorded
  stateVersion := by simp [emptyConfig, lts]
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => 0
      decreases := by simp
      epoch_preserved := by simp }

theorem replayCoherent {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) :
    DPOEvent.ReplayKernel.ReindexCoherent
      ι (replayKernel σ) (replayKernel τ) where
  run_reindex := by
    intro recipe config
    rfl

def packageReindexing {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) :
    ExecutionPackage.Reindexing ι (package σ) (package τ) where
  replayCoherent := replayCoherent ι
  mapState := id
  mapEvent := id
  mapStep := by
    intro before eventLabel after step
    exact step
  configOf_natural := by
    intro state
    cases state
    rfl
  eventRecord_natural := by
    intro eventLabel
    cases eventLabel
    rfl

/-- A genuinely inhabited execution family over all finite signatures. -/
def executionFamily : ReindexableExecutionFamily where
  package := package
  reindex := packageReindexing
  state_identity := by simp [packageReindexing]
  event_identity := by simp [packageReindexing]
  state_composition := by simp [packageReindexing]
  event_composition := by simp [packageReindexing]

def identityProjection :
    Cantilune.Core.ProjectionFamily (Type 0) (Type 0) :=
  Cantilune.Core.ProjectionFamily.identity (Type 0) executionFamily

example :
    (identityProjection.operational
      Cantilune.Tests.CompleteProjection.signature).mapState () = () := rfl

/-- A second aligned epoch step over the existing finite admission fixture. -/
def secondAdmission :
    SignatureAdmissionEvent
      Cantilune.Tests.CompleteProjection.universes
      (source := Cantilune.Tests.CompleteProjection.signature)
      (target := Cantilune.Tests.CompleteProjection.signature) where
  fromVersion := 1
  toVersion := 2
  advancesEpoch := by omega
  extension :=
    SignatureExtension.refl Cantilune.Tests.CompleteProjection.signature
  oldViews := Cantilune.Tests.CompleteProjection.views
  newViews := Cantilune.Tests.CompleteProjection.views
  certificate := Cantilune.Tests.CompleteProjection.admissionCertificate
  tombstoneId := 1

theorem admissionsComposable :
    SignatureAdmissionEvent.Composable
      Cantilune.Tests.CompleteProjection.admission secondAdmission where
  versionBoundary := rfl

example :
    (identityProjection.source.reindex
      (SignatureExtension.trans
        Cantilune.Tests.CompleteProjection.admission.extension
        secondAdmission.extension)).mapState () =
      (identityProjection.source.reindex secondAdmission.extension).mapState
        ((identityProjection.source.reindex
          Cantilune.Tests.CompleteProjection.admission.extension).mapState ()) :=
  identityProjection.source_admission_reindex_composition
    Cantilune.Tests.CompleteProjection.admission secondAdmission
      admissionsComposable ()

example :=
    ((packageReindexing
      (SignatureExtension.refl
        Cantilune.Tests.CompleteProjection.signature))).eventRecord_replay_commutes
      nativeStep

/-- Singleton indexing is nonempty and selects the old complete certificate. -/
def completeFamily :
    CompleteProjectionFamily
      (Type 0) (Type 0)
      Cantilune.Tests.CompleteProjection.lts
      Cantilune.Tests.CompleteProjection.lts
      Cantilune.Tests.CompleteProjection.universes :=
  CompleteProjectionFamily.identity
    (Type 0)
    Cantilune.Tests.CompleteProjection.lts
    Cantilune.Tests.CompleteProjection.universes
    Unit inferInstance
    (fun _ => Cantilune.Tests.CompleteProjection.signature)
    (fun _ => Cantilune.Tests.CompleteProjection.signature)
    (fun _ => Cantilune.Tests.CompleteProjection.admission)
    (fun _ => Cantilune.Tests.CompleteProjection.admissionCompatible)
    (fun _ => True)

example :
    ((completeFamily.certificateAt ()).operational.mapState
      Cantilune.Tests.CompleteProjection.beforeState) =
        Cantilune.Tests.CompleteProjection.beforeState := rfl

end Cantilune.Tests.ProjectionFamily
