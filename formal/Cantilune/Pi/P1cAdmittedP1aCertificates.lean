import Cantilune.Core.CompleteProjection
import Cantilune.Core.Package
import Cantilune.Pi.P1cAdmittedOperations
import Cantilune.Projection.GeneralP1a

/-!
# P1a certificates over concrete admitted P1c occurrences

This module projects one genuinely admitted mismatch, reconnect, or
quiescent-delete occurrence.  Unlike the finite audit cursor, the source and
all three targets denote the actual `occurrence.source` and computed
`occurrence.target` configurations.

Every target step stores the existing `P1cAdmittedOperations.CommonDerivation`
for that occurrence.  The execution packages share the endpoint-free replay
kernel and the verified `DPOEvent`.  Resource and session predicates contain
the actual ownership invariant and, for deletion, the admitted no-owner
conditions.
-/

noncomputable section

namespace Cantilune.Pi.P1cAdmittedP1aCertificates

open Cantilune.Core
open Cantilune.Pi.P1cAdmittedOperations

variable {σ : FinSignature}

/-- The singleton request family selected by one concrete occurrence. -/
abbrev Family (occurrence : Occurrence σ) :=
  { request : Request // request = occurrence.request }

def family (occurrence : Occurrence σ) : Family occurrence :=
  ⟨occurrence.request, rfl⟩

/-- Both source states retain the exact runtime request family. -/
inductive State (occurrence : Occurrence σ)
  | ready (request : Family occurrence)
  | completed (request : Family occurrence)
  deriving DecidableEq

def success (occurrence : Occurrence σ) : State occurrence → Prop
  | .ready _ => False
  | .completed _ => True

def configOf (occurrence : Occurrence σ) :
    State occurrence → Config σ
  | .ready _ => occurrence.source
  | .completed _ => occurrence.target

@[simp]
theorem configOf_ready (occurrence : Occurrence σ)
    (request : Family occurrence) :
    configOf occurrence (.ready request) = occurrence.source :=
  rfl

@[simp]
theorem configOf_completed (occurrence : Occurrence σ)
    (request : Family occurrence) :
    configOf occurrence (.completed request) = occurrence.target :=
  rfl

@[simp]
theorem configOf_signatureVersion (occurrence : Occurrence σ)
    (state : State occurrence) :
    (configOf occurrence state).signatureVersion =
      occurrence.source.signatureVersion := by
  cases state
  · rfl
  · change
      (applyRequest occurrence.source occurrence.request).signatureVersion =
        occurrence.source.signatureVersion
    cases occurrence.request <;> rfl

theorem ownershipWellFormed_all (occurrence : Occurrence σ)
    (state : State occurrence) :
    (configOf occurrence state).OwnershipWellFormed := by
  cases state
  · exact occurrence.source_ownershipWellFormed
  · exact occurrence.target_ownershipWellFormed

/--
Ownership remains well formed, and a selected deletion victim owns no live
linear resource at either endpoint.
-/
def resourcesClear (occurrence : Occurrence σ)
    (state : State occurrence) : Prop :=
  (configOf occurrence state).OwnershipWellFormed ∧
    ∀ victim,
      occurrence.request = .quiescentDelete victim →
      ∀ token ∈ (configOf occurrence state).resourceTokens,
        (configOf occurrence state).resourceOwner token ≠ some victim

/--
Ownership remains well formed, and a selected deletion victim owns no live
session/name at either endpoint.
-/
def sessionsQuiescent (occurrence : Occurrence σ)
    (state : State occurrence) : Prop :=
  (configOf occurrence state).OwnershipWellFormed ∧
    ∀ victim,
      occurrence.request = .quiescentDelete victim →
      ∀ name ∈ (configOf occurrence state).names,
        (configOf occurrence state).sessionOwner name ≠ some victim

/-- Deletion permission is exposed only at the actual pre-state. -/
def deletionPermitted (occurrence : Occurrence σ)
    (state : State occurrence) : Prop :=
  (∃ request, state = .ready request) ∧
    ∃ victim, occurrence.request = .quiescentDelete victim

private theorem request_resource_clear
    (occurrence : Occurrence σ) (state : State occurrence) :
    ∀ victim,
      occurrence.request = .quiescentDelete victim →
      ∀ token ∈ (configOf occurrence state).resourceTokens,
        (configOf occurrence state).resourceOwner token ≠ some victim := by
  rcases occurrence with ⟨source, request, admitted⟩
  cases request with
  | mismatch left right =>
      intro victim impossible
      cases impossible
  | reconnect reconnectSource reconnectTarget =>
      intro victim impossible
      cases impossible
  | quiescentDelete deleted =>
      intro victim equality
      cases equality
      have clear :
          ∀ token ∈ source.resourceTokens,
            source.resourceOwner token ≠ some deleted :=
        admitted.2.2.1.2.2.1
      cases state <;>
        simpa [configOf, Occurrence.target, applyRequest] using clear

private theorem request_session_quiescent
    (occurrence : Occurrence σ) (state : State occurrence) :
    ∀ victim,
      occurrence.request = .quiescentDelete victim →
      ∀ name ∈ (configOf occurrence state).names,
        (configOf occurrence state).sessionOwner name ≠ some victim := by
  rcases occurrence with ⟨source, request, admitted⟩
  cases request with
  | mismatch left right =>
      intro victim impossible
      cases impossible
  | reconnect reconnectSource reconnectTarget =>
      intro victim impossible
      cases impossible
  | quiescentDelete deleted =>
      intro victim equality
      cases equality
      have quiescent :
          ∀ name ∈ source.names,
            source.sessionOwner name ≠ some deleted :=
        admitted.2.2.1.2.2.2
      cases state <;>
        simpa [configOf, Occurrence.target, applyRequest] using quiescent

theorem resourcesClear_all (occurrence : Occurrence σ)
    (state : State occurrence) :
    resourcesClear occurrence state :=
  ⟨ownershipWellFormed_all occurrence state,
    request_resource_clear occurrence state⟩

theorem sessionsQuiescent_all (occurrence : Occurrence σ)
    (state : State occurrence) :
    sessionsQuiescent occurrence state :=
  ⟨ownershipWellFormed_all occurrence state,
    request_session_quiescent occurrence state⟩

theorem deletion_requires_resources (occurrence : Occurrence σ)
    (state : State occurrence)
    (_permitted : deletionPermitted occurrence state) :
    resourcesClear occurrence state :=
  resourcesClear_all occurrence state

theorem deletion_requires_quiescence (occurrence : Occurrence σ)
    (state : State occurrence)
    (_permitted : deletionPermitted occurrence state) :
    sessionsQuiescent occurrence state :=
  sessionsQuiescent_all occurrence state

/-! ## Source package -/

inductive SourceStep (occurrence : Occurrence σ) :
    State occurrence → Family occurrence → State occurrence → Prop
  | execute (request : Family occurrence) :
      SourceStep occurrence (.ready request) request (.completed request)

def sourceLTS (occurrence : Occurrence σ) : ObservableLTS where
  State := State occurrence
  Event := Family occurrence
  stateSetoid := ObservableLTS.equalitySetoid _
  step := SourceStep occurrence
  observable := fun _ => True
  success := success occurrence
  waiting := fun _ => False
  signatureVersion := fun _ => occurrence.source.signatureVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

theorem source_observable (occurrence : Occurrence σ)
    (request : Family occurrence) :
    (sourceLTS occurrence).ObservableStep
      (.ready request) request (.completed request) :=
  ⟨SourceStep.execute request, trivial⟩

def sourcePackage (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := sourceLTS occurrence
  configOf := configOf occurrence
  replayKernel := P1cAdmittedOperations.replayKernel
  eventRecord := fun _ => verifiedEvent occurrence
  eventEndpoints := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact replay_exact occurrence
  stateVersion := configOf_signatureVersion occurrence
  resourcesClear := resourcesClear occurrence
  sessionsQuiescent := sessionsQuiescent occurrence
  deletionPermitted := deletionPermitted occurrence
  deletion_requires_resources := deletion_requires_resources occurrence
  deletion_requires_quiescence := deletion_requires_quiescence occurrence
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by
        intro _source _event _target _step impossible
        contradiction
      epoch_preserved := by
        intro _source _event _target _step impossible
        contradiction }

theorem source_replay_exact (occurrence : Occurrence σ)
    (request : Family occurrence) :
    ((sourcePackage occurrence).eventRecord request).Replays
      occurrence.source occurrence.target :=
  (sourcePackage occurrence).eventEndpoints
    (source_observable occurrence request)

/-! ## Native DAG target -/

namespace DAG

/--
The target transition cannot be constructed without the shared concrete
DAG/Petri/pi/morphism/replay derivation.
-/
inductive Step (occurrence : Occurrence σ) :
    State occurrence → Family occurrence → State occurrence → Prop
  | execute (request : Family occurrence)
      (common : CommonDerivation occurrence) :
      Step occurrence (.ready request) request (.completed request)

def lts (occurrence : Occurrence σ) : ObservableLTS where
  State := State occurrence
  Event := Family occurrence
  stateSetoid := ObservableLTS.equalitySetoid _
  step := Step occurrence
  observable := fun _ => True
  success := success occurrence
  waiting := fun _ => False
  signatureVersion := fun _ => occurrence.source.signatureVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

theorem step_common {occurrence : Occurrence σ}
    {source target : State occurrence} {request : Family occurrence}
    (step : Step occurrence source request target) :
    CommonDerivation occurrence := by
  cases step with
  | execute request common => exact common

theorem step_native {occurrence : Occurrence σ}
    {source target : State occurrence} {request : Family occurrence}
    (step : Step occurrence source request target) :
    P1cAdmittedOperations.DAG.Step
      occurrence.source occurrence.request occurrence.target :=
  (step_common step).dag

def certificate (occurrence : Occurrence σ) :
    ProjectionCertificate (sourceLTS occurrence) (lts occurrence) where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro request; rfl
  map_equiv := by
    intro source target equality
    exact equality
  sound := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact ⟨Step.execute request (commonDerivation occurrence), trivial⟩
  reflect := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact
      ⟨request, .completed request,
        source_observable occurrence request, rfl, rfl⟩
  success_iff := by intro state; rfl
  waiting_iff := by intro state; rfl
  signatureVersion_preserved := by intro state; rfl

def package (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := lts occurrence
  configOf := configOf occurrence
  replayKernel := P1cAdmittedOperations.replayKernel
  eventRecord := fun _ => verifiedEvent occurrence
  eventEndpoints := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact replay_exact occurrence
  stateVersion := configOf_signatureVersion occurrence
  resourcesClear := resourcesClear occurrence
  sessionsQuiescent := sessionsQuiescent occurrence
  deletionPermitted := deletionPermitted occurrence
  deletion_requires_resources := deletion_requires_resources occurrence
  deletion_requires_quiescence := deletion_requires_quiescence occurrence
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by
        intro _source _event _target _step impossible
        contradiction
      epoch_preserved := by
        intro _source _event _target _step impossible
        contradiction }

end DAG

/-! ## Native Petri target -/

namespace Petri

inductive Step (occurrence : Occurrence σ) :
    State occurrence → Family occurrence → State occurrence → Prop
  | fire (request : Family occurrence)
      (common : CommonDerivation occurrence) :
      Step occurrence (.ready request) request (.completed request)

def lts (occurrence : Occurrence σ) : ObservableLTS where
  State := State occurrence
  Event := Family occurrence
  stateSetoid := ObservableLTS.equalitySetoid _
  step := Step occurrence
  observable := fun _ => True
  success := success occurrence
  waiting := fun _ => False
  signatureVersion := fun _ => occurrence.source.signatureVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

theorem step_common {occurrence : Occurrence σ}
    {source target : State occurrence} {request : Family occurrence}
    (step : Step occurrence source request target) :
    CommonDerivation occurrence := by
  cases step with
  | fire request common => exact common

theorem step_native {occurrence : Occurrence σ}
    {source target : State occurrence} {request : Family occurrence}
    (step : Step occurrence source request target) :
    P1cAdmittedOperations.Petri.Step
      occurrence.source occurrence.request occurrence.target :=
  (step_common step).petri

def certificate (occurrence : Occurrence σ) :
    ProjectionCertificate (sourceLTS occurrence) (lts occurrence) where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro request; rfl
  map_equiv := by
    intro source target equality
    exact equality
  sound := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact ⟨Step.fire request (commonDerivation occurrence), trivial⟩
  reflect := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact
      ⟨request, .completed request,
        source_observable occurrence request, rfl, rfl⟩
  success_iff := by intro state; rfl
  waiting_iff := by intro state; rfl
  signatureVersion_preserved := by intro state; rfl

def package (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := lts occurrence
  configOf := configOf occurrence
  replayKernel := P1cAdmittedOperations.replayKernel
  eventRecord := fun _ => verifiedEvent occurrence
  eventEndpoints := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact replay_exact occurrence
  stateVersion := configOf_signatureVersion occurrence
  resourcesClear := resourcesClear occurrence
  sessionsQuiescent := sessionsQuiescent occurrence
  deletionPermitted := deletionPermitted occurrence
  deletion_requires_resources := deletion_requires_resources occurrence
  deletion_requires_quiescence := deletion_requires_quiescence occurrence
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by
        intro _source _event _target _step impossible
        contradiction
      epoch_preserved := by
        intro _source _event _target _step impossible
        contradiction }

end Petri

/-! ## Native morphism target -/

namespace Morphism

inductive Step (occurrence : Occurrence σ) :
    State occurrence → Family occurrence → State occurrence → Prop
  | map (request : Family occurrence)
      (common : CommonDerivation occurrence) :
      Step occurrence (.ready request) request (.completed request)

def lts (occurrence : Occurrence σ) : ObservableLTS where
  State := State occurrence
  Event := Family occurrence
  stateSetoid := ObservableLTS.equalitySetoid _
  step := Step occurrence
  observable := fun _ => True
  success := success occurrence
  waiting := fun _ => False
  signatureVersion := fun _ => occurrence.source.signatureVersion
  step_congr := by
    intro source source' event target target' sourceEq targetEq
    subst source'
    subst target'
    rfl
  success_congr := by
    intro source target equality
    subst target
    rfl
  waiting_congr := by
    intro source target equality
    subst target
    rfl
  signatureVersion_congr := by
    intro source target equality
    subst target
    rfl

theorem step_common {occurrence : Occurrence σ}
    {source target : State occurrence} {request : Family occurrence}
    (step : Step occurrence source request target) :
    CommonDerivation occurrence := by
  cases step with
  | map request common => exact common

theorem step_native {occurrence : Occurrence σ}
    {source target : State occurrence} {request : Family occurrence}
    (step : Step occurrence source request target) :
    P1cAdmittedOperations.Morphism.Step
      occurrence.source occurrence.request occurrence.target :=
  (step_common step).morphism

def certificate (occurrence : Occurrence σ) :
    ProjectionCertificate (sourceLTS occurrence) (lts occurrence) where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by intro request; rfl
  map_equiv := by
    intro source target equality
    exact equality
  sound := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact ⟨Step.map request (commonDerivation occurrence), trivial⟩
  reflect := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact
      ⟨request, .completed request,
        source_observable occurrence request, rfl, rfl⟩
  success_iff := by intro state; rfl
  waiting_iff := by intro state; rfl
  signatureVersion_preserved := by intro state; rfl

def package (occurrence : Occurrence σ) : ExecutionPackage σ where
  lts := lts occurrence
  configOf := configOf occurrence
  replayKernel := P1cAdmittedOperations.replayKernel
  eventRecord := fun _ => verifiedEvent occurrence
  eventEndpoints := by
    rintro source request target ⟨step, _observable⟩
    cases step
    exact replay_exact occurrence
  stateVersion := configOf_signatureVersion occurrence
  resourcesClear := resourcesClear occurrence
  sessionsQuiescent := sessionsQuiescent occurrence
  deletionPermitted := deletionPermitted occurrence
  deletion_requires_resources := deletion_requires_resources occurrence
  deletion_requires_quiescence := deletion_requires_quiescence occurrence
  ranking :=
    { internal := fun _ => False
      rank := fun _ => 0
      epoch := fun _ => occurrence.source.signatureVersion
      decreases := by
        intro _source _event _target _step impossible
        contradiction
      epoch_preserved := by
        intro _source _event _target _step impossible
        contradiction }

end Morphism

/-! ## Shared certificate and runtime compatibility -/

def operational (occurrence : Occurrence σ) :
    Cantilune.Projection.GeneralP1a.Certificate
      (sourceLTS occurrence)
      (DAG.lts occurrence)
      (Petri.lts occurrence)
      (Morphism.lts occurrence) where
  dag := DAG.certificate occurrence
  petri := Petri.certificate occurrence
  morphism := Morphism.certificate occurrence

def dagResources (occurrence : Occurrence σ) :
    ResourceProjectionCompatibility (DAG.certificate occurrence) where
  sourceResourcesValid := (sourcePackage occurrence).resourcesClear
  targetResourcesValid := (DAG.package occurrence).resourcesClear
  resources_iff := by intro state; rfl

def petriResources (occurrence : Occurrence σ) :
    ResourceProjectionCompatibility (Petri.certificate occurrence) where
  sourceResourcesValid := (sourcePackage occurrence).resourcesClear
  targetResourcesValid := (Petri.package occurrence).resourcesClear
  resources_iff := by intro state; rfl

def morphismResources (occurrence : Occurrence σ) :
    ResourceProjectionCompatibility (Morphism.certificate occurrence) where
  sourceResourcesValid := (sourcePackage occurrence).resourcesClear
  targetResourcesValid := (Morphism.package occurrence).resourcesClear
  resources_iff := by intro state; rfl

theorem dagTerminals (occurrence : Occurrence σ) :
    TerminalProjectionCompatibility (DAG.certificate occurrence) :=
  TerminalProjectionCompatibility.ofOperational (DAG.certificate occurrence)

theorem petriTerminals (occurrence : Occurrence σ) :
    TerminalProjectionCompatibility (Petri.certificate occurrence) :=
  TerminalProjectionCompatibility.ofOperational
    (Petri.certificate occurrence)

theorem morphismTerminals (occurrence : Occurrence σ) :
    TerminalProjectionCompatibility (Morphism.certificate occurrence) :=
  TerminalProjectionCompatibility.ofOperational
    (Morphism.certificate occurrence)

/-- All three target packages denote the exact source-package configuration. -/
theorem config_preserved_all (occurrence : Occurrence σ)
    (state : State occurrence) :
    (DAG.package occurrence).configOf
        ((DAG.certificate occurrence).mapState state) =
        (sourcePackage occurrence).configOf state ∧
      (Petri.package occurrence).configOf
        ((Petri.certificate occurrence).mapState state) =
        (sourcePackage occurrence).configOf state ∧
      (Morphism.package occurrence).configOf
        ((Morphism.certificate occurrence).mapState state) =
        (sourcePackage occurrence).configOf state :=
  ⟨rfl, rfl, rfl⟩

/-- Resource, session, and deletion predicates are not weakened by projection. -/
theorem runtime_predicates_preserved_all (occurrence : Occurrence σ)
    (state : State occurrence) :
    ((DAG.package occurrence).resourcesClear
        ((DAG.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).resourcesClear state) ∧
    ((Petri.package occurrence).resourcesClear
        ((Petri.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).resourcesClear state) ∧
    ((Morphism.package occurrence).resourcesClear
        ((Morphism.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).resourcesClear state) ∧
    ((DAG.package occurrence).sessionsQuiescent
        ((DAG.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).sessionsQuiescent state) ∧
    ((Petri.package occurrence).sessionsQuiescent
        ((Petri.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).sessionsQuiescent state) ∧
    ((Morphism.package occurrence).sessionsQuiescent
        ((Morphism.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).sessionsQuiescent state) ∧
    ((DAG.package occurrence).deletionPermitted
        ((DAG.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).deletionPermitted state) ∧
    ((Petri.package occurrence).deletionPermitted
        ((Petri.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).deletionPermitted state) ∧
    ((Morphism.package occurrence).deletionPermitted
        ((Morphism.certificate occurrence).mapState state) ↔
      (sourcePackage occurrence).deletionPermitted state) := by
  exact ⟨by rfl, by rfl, by rfl, by rfl, by rfl, by rfl,
    by rfl, by rfl, by rfl⟩

/--
The one observable source occurrence has three exact native target steps,
each carrying the same common derivation and replaying the same verified
record.
-/
structure SharedOccurrenceEvidence (occurrence : Occurrence σ) : Prop where
  source :
    (sourcePackage occurrence).lts.ObservableStep
      (.ready (family occurrence)) (family occurrence)
      (.completed (family occurrence))
  dag :
    (DAG.package occurrence).lts.ObservableStep
      (.ready (family occurrence)) (family occurrence)
      (.completed (family occurrence))
  petri :
    (Petri.package occurrence).lts.ObservableStep
      (.ready (family occurrence)) (family occurrence)
      (.completed (family occurrence))
  morphism :
    (Morphism.package occurrence).lts.ObservableStep
      (.ready (family occurrence)) (family occurrence)
      (.completed (family occurrence))
  common : CommonDerivation occurrence
  replay :
    ((sourcePackage occurrence).eventRecord (family occurrence)).Replays
      occurrence.source occurrence.target
  resources :
    (sourcePackage occurrence).resourcesClear
      (.ready (family occurrence))
  sessions :
    (sourcePackage occurrence).sessionsQuiescent
      (.ready (family occurrence))

theorem sharedOccurrenceEvidence (occurrence : Occurrence σ) :
    SharedOccurrenceEvidence occurrence := by
  have source := source_observable occurrence (family occurrence)
  have projected := (operational occurrence).sound_all source
  exact
    { source := source
      dag := projected.1
      petri := projected.2.1
      morphism := projected.2.2
      common := commonDerivation occurrence
      replay := source_replay_exact occurrence (family occurrence)
      resources :=
        resourcesClear_all occurrence (.ready (family occurrence))
      sessions :=
        sessionsQuiescent_all occurrence (.ready (family occurrence)) }

end Cantilune.Pi.P1cAdmittedP1aCertificates
