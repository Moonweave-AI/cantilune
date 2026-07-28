import Cantilune.Theorems.CoreConformance
import Cantilune.Projection.SCCCondensation

/-!
# One substantive reconnect across an epoch boundary

`CoreConformance.Reference` originally combined two independently useful
anti-vacuity witnesses: the cross-epoch family used the small identity
semantics, while the reconnect `ProductRuleProofBundle` was stored beside it.
This module closes that residual gap.  One indexed occurrence is used for:

* the post-admission source state;
* the fixed-epoch candidate and replayable `DPOEvent`;
* the DAG, individual-token Petri, standard late-pi, and morphism views; and
* the positive-probability execution cell.

The construction is still a reference execution family, not an
instantiation of any production package.
-/

noncomputable section

namespace Cantilune.Theorems.SubstantiveReconnectConformance

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Pi.P1cAdmittedOperations
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems
open Cantilune.Theorems.ProductRuleProofBundle
open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Projection.P1aSemanticCertificate

universe u

/-! ## A reindex-natural family of admitted occurrences -/

/--
The epoch is explicit because a genuine admission cannot be a pure signature
reindex.  The optional generator is a typed node label; the boolean is the
pre/post reconnect phase.
-/
abbrev Epoch := Fin 4

abbrev State (signature : FinSignature) :=
  Epoch × Option signature.Gen × Bool

/-- Business keys retain the epoch and the exact typed label. -/
abbrev BusinessKey (signature : FinSignature) :=
  Epoch × Option signature.Gen

/--
Every positive kernel edge has an explicit event.  Business events carry the
reconnect key; hold events are replayable identity observations and are kept
distinct so one `DPOEvent` label never claims two endpoints.
-/
inductive Event (signature : FinSignature)
  | business (key : BusinessKey signature)
  | hold (state : State signature)
  deriving DecidableEq, Fintype

def emptyConfig (signature : FinSignature) (epoch : Nat) :
    Config signature where
  signatureVersion := epoch
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

def pairConfig (signature : FinSignature) (epoch : Nat)
    (generator : signature.Gen) :
    Config signature where
  signatureVersion := epoch
  nodes := {0, 1}
  edges := ∅
  nodeLabel := fun node =>
    if node = 0 ∨ node = 1 then some generator else none
  dataTokens := ∅
  resourceTokens := ∅
  names := ∅
  dataOwner := fun _ => none
  resourceOwner := fun _ => none
  sessionOwner := fun _ => none
  externalObservations := []
  policyState := 0
  tombstones := ∅

def baseConfig (signature : FinSignature) (epoch : Nat) :
    Option signature.Gen → Config signature
  | none => emptyConfig signature epoch
  | some generator => pairConfig signature epoch generator

def request : Option α → Request
  | none => .mismatch 0 1
  | some _ => .reconnect 0 1

theorem empty_wellFormed (signature : FinSignature) (epoch : Nat) :
    (emptyConfig signature epoch).WellFormed := by
  simp [Config.WellFormed, emptyConfig]

theorem empty_acyclic (signature : FinSignature) (epoch : Nat) :
    Acyclic (emptyConfig signature epoch) :=
  acyclic_of_edges_empty rfl

theorem empty_ownership (signature : FinSignature) (epoch : Nat) :
    (emptyConfig signature epoch).OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, emptyConfig]

theorem pair_wellFormed (signature : FinSignature) (epoch : Nat)
    (generator : signature.Gen) :
    (pairConfig signature epoch generator).WellFormed := by
  constructor
  · intro node
    simp [pairConfig]
  · intro edge member
    simp [pairConfig] at member

theorem pair_acyclic (signature : FinSignature) (epoch : Nat)
    (generator : signature.Gen) :
    Acyclic (pairConfig signature epoch generator) :=
  acyclic_of_edges_empty rfl

theorem pair_ownership (signature : FinSignature) (epoch : Nat)
    (generator : signature.Gen) :
    (pairConfig signature epoch generator).OwnershipWellFormed := by
  simp [Config.OwnershipWellFormed, pairConfig]

theorem reconnect_target_wellFormed (signature : FinSignature) (epoch : Nat)
    (generator : signature.Gen) :
    (applyRequest (pairConfig signature epoch generator)
      (.reconnect 0 1)).WellFormed := by
  constructor
  · intro node
    simp [applyRequest, pairConfig]
  · intro edge member
    have edgeShape : edge = (0, 1) := by
      simpa [applyRequest, pairConfig] using member
    subst edge
    simp [applyRequest, pairConfig]

theorem reconnect_target_acyclic (signature : FinSignature) (epoch : Nat)
    (generator : signature.Gen) :
    Acyclic
      (applyRequest (pairConfig signature epoch generator)
        (.reconnect 0 1)) := by
  apply acyclic_of_rank (rank := id)
  intro edge member
  simp [applyRequest, pairConfig] at member
  subst edge
  decide

theorem mismatch_target_wellFormed (signature : FinSignature) (epoch : Nat) :
    (applyRequest (emptyConfig signature epoch) (.mismatch 0 1)).WellFormed :=
  empty_wellFormed signature epoch

theorem mismatch_target_acyclic (signature : FinSignature) (epoch : Nat) :
    Acyclic
      (applyRequest (emptyConfig signature epoch) (.mismatch 0 1)) :=
  acyclic_of_edges_empty rfl

def occurrence (signature : FinSignature) (epoch : Nat)
    (generator : Option signature.Gen) :
    Occurrence signature where
  source := baseConfig signature epoch generator
  request := request generator
  admitted := by
    cases generator with
    | none =>
        exact
          ⟨empty_wellFormed signature epoch,
            empty_acyclic signature epoch,
            by norm_num [Request.Enabled, request, baseConfig, emptyConfig],
            mismatch_target_wellFormed signature epoch,
            mismatch_target_acyclic signature epoch,
            empty_ownership signature epoch⟩
    | some generator =>
        exact
          ⟨pair_wellFormed signature epoch generator,
            pair_acyclic signature epoch generator,
            by
              norm_num [Request.Enabled, request, baseConfig, pairConfig],
            reconnect_target_wellFormed signature epoch generator,
            reconnect_target_acyclic signature epoch generator,
            pair_ownership signature epoch generator⟩

def configOf (signature : FinSignature) : State signature → Config signature
  | (epoch, generator, false) =>
      (occurrence signature epoch.val generator).source
  | (epoch, generator, true) =>
      (occurrence signature epoch.val generator).target

inductive SourceStep (signature : FinSignature) :
    State signature → Event signature → State signature → Prop
  | business (epoch : Epoch) (generator : Option signature.Gen) :
      SourceStep signature
        (epoch, generator, false) (.business (epoch, generator))
        (epoch, generator, true)
  | hold (state : State signature) :
      SourceStep signature state (.hold state) state

def sourceLTS (signature : FinSignature) : ObservableLTS where
  State := State signature
  Event := Event signature
  stateSetoid := ObservableLTS.equalitySetoid _
  step := SourceStep signature
  observable := fun _ => True
  success := fun state => state.2.2
  waiting := fun _ => False
  signatureVersion := fun state => state.1.val
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

theorem configOf_wellFormed (signature : FinSignature)
    (state : State signature) :
    (configOf signature state).WellFormed := by
  rcases state with ⟨epoch, generator, phase⟩
  cases phase
  · exact (occurrence signature epoch.val generator).source_wellFormed
  · exact (occurrence signature epoch.val generator).target_wellFormed

def familyReplayKernel (signature : FinSignature) :
    DPOEvent.ReplayKernel signature where
  run := fun recipe source =>
    if recipe.ruleId = 90 then some source
    else
      (Cantilune.Pi.P1cAdmittedOperations.replayKernel (σ := signature)).run
        recipe source

def businessRecord (signature : FinSignature)
    (key : BusinessKey signature) :
    DPOEvent.Verified (familyReplayKernel signature) where
  event := Cantilune.Pi.P1cAdmittedOperations.event
    (occurrence signature key.1.val key.2)
  replay_correct := by
    have old :=
      (verifiedEvent (occurrence signature key.1.val key.2)).replay_correct
    change
      (if
        (Cantilune.Pi.P1cAdmittedOperations.event
          (occurrence signature key.1.val key.2)).replayRecipe.ruleId = 90
        then some _
        else
          (Cantilune.Pi.P1cAdmittedOperations.replayKernel
            (σ := signature)).run _ _) =
        some _
    rw [if_neg]
    · exact old
    · cases key with
      | mk epoch generator =>
          cases generator <;>
            simp [occurrence, request,
              Cantilune.Pi.P1cAdmittedOperations.event,
              DPOEvent.replayRecipe, Request.ruleId]

def emptyEmbedding (cardinality : Nat) : Fin 0 ↪ Fin cardinality where
  toFun := Fin.elim0
  inj' := by intro value; exact Fin.elim0 value

theorem emptyEmbedding_heq {left right : Nat}
    (cardinality : left = right) :
    HEq (emptyEmbedding left) (emptyEmbedding right) := by
  subst right
  apply heq_of_eq
  apply Subsingleton.elim

def holdEvent (signature : FinSignature) (state : State signature) :
    DPOEvent signature where
  signatureVersion := (configOf signature state).signatureVersion
  ruleId := 90
  source := configOf signature state
  target := configOf signature state
  matchDomainSize := 0
  matchCodomainSize := (configOf signature state).nodes.card
  matchEmbedding := emptyEmbedding _
  complementTag := 90
  freshNames := ∅
  policyEvidence := [(configOf signature state).policyState]
  externalEvidence := []
  kind := .external
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp
  sourceWellFormed := configOf_wellFormed signature state
  targetWellFormed := configOf_wellFormed signature state

def holdRecord (signature : FinSignature) (state : State signature) :
    DPOEvent.Verified (familyReplayKernel signature) where
  event := holdEvent signature state
  replay_correct := by
    simp [familyReplayKernel, holdEvent, DPOEvent.replayRecipe]

def eventRecord (signature : FinSignature) :
    Event signature → DPOEvent.Verified (familyReplayKernel signature)
  | .business key => businessRecord signature key
  | .hold state => holdRecord signature state

def sourcePackage (signature : FinSignature) :
    ExecutionPackage signature where
  lts := sourceLTS signature
  configOf := configOf signature
  replayKernel := familyReplayKernel signature
  eventRecord := eventRecord signature
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨step, _observable⟩
    cases step with
    | business epoch generator =>
        exact (businessRecord signature (epoch, generator)).replays_recorded
    | hold =>
        exact (holdRecord signature source).replays_recorded
  stateVersion := by
    rintro ⟨epoch, generator, phase⟩
    change (configOf signature (epoch, generator, phase)).signatureVersion =
      epoch
    cases generator <;> cases phase <;>
      simp [configOf, occurrence, baseConfig, emptyConfig, pairConfig,
        Occurrence.target, applyRequest, request]
  resourcesClear := fun state => (configOf signature state).resourceTokens = ∅
  sessionsQuiescent := fun state => (configOf signature state).names = ∅
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun event =>
        match event with
        | .business _ => True
        | .hold _ => False
      rank := fun state => if state.2.2 then 0 else 1
      epoch := fun state => state.1.val
      decreases := by
        intro source event target step internal
        rcases step with ⟨native, _observable⟩
        cases native with
        | business => simp
        | hold => simp at internal
      epoch_preserved := by
        intro source event target step internal
        rcases step with ⟨native, _observable⟩
        cases native with
        | business => rfl
        | hold => simp at internal }

/-! ## Signature reindexing -/

def reindexState {source target : FinSignature}
    (extension : SignatureExtension source target) :
    State source → State target
  | (epoch, generator, phase) =>
      (epoch, generator.map extension.gen, phase)

def reindexEvent {source target : FinSignature}
    (extension : SignatureExtension source target) :
    Event source → Event target
  | .business (epoch, generator) =>
      .business (epoch, generator.map extension.gen)
  | .hold (epoch, generator, phase) =>
      .hold (epoch, generator.map extension.gen, phase)

@[simp] theorem reindex_emptyConfig
    {source target : FinSignature}
    (extension : SignatureExtension source target) (epoch : Nat) :
    Config.reindex extension (emptyConfig source epoch) =
      emptyConfig target epoch := by
  rfl

@[simp] theorem reindex_pairConfig
    {source target : FinSignature}
    (extension : SignatureExtension source target) (epoch : Nat)
    (generator : source.Gen) :
    Config.reindex extension (pairConfig source epoch generator) =
      pairConfig target epoch (extension.gen generator) := by
  unfold Config.reindex pairConfig
  congr 1
  funext node
  simp

@[simp] theorem reindex_baseConfig
    {source target : FinSignature}
    (extension : SignatureExtension source target) (epoch : Nat)
    (generator : Option source.Gen) :
    Config.reindex extension (baseConfig source epoch generator) =
      baseConfig target epoch (generator.map extension.gen) := by
  cases generator <;> simp [baseConfig]

@[simp] theorem reindex_applyRequest
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (config : Config source) (operation : Request) :
    Config.reindex extension (applyRequest config operation) =
      applyRequest (Config.reindex extension config) operation := by
  cases operation with
  | mismatch left right => rfl
  | reconnect left right => rfl
  | quiescentDelete victim =>
      cases config
      simp [Config.reindex, applyRequest, incidentEdges]
      funext node
      by_cases equality : node = victim <;> simp [equality]

@[simp] theorem request_map {source target : FinSignature}
    (extension : SignatureExtension source target)
    (generator : Option source.Gen) :
    request (generator.map extension.gen) = request generator := by
  cases generator <;> rfl

@[simp] theorem reindex_configOf
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (state : State source) :
    Config.reindex extension (configOf source state) =
      configOf target (reindexState extension state) := by
  rcases state with ⟨epoch, generator, phase⟩
  cases phase <;>
    simp [configOf, occurrence, Occurrence.target, reindexState]

/-!
The existing executable P1c replay kernel is natural because request
decoding uses only the reindex-invariant recipe and graph/runtime footprint.
This concrete equation is the only nontrivial package reindexing obligation.
-/
@[simp] theorem decodeRequest_reindex
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (recipe : DPOEvent.ReplayRecipe source) :
    decodeRequest (DPOEvent.ReplayRecipe.reindex extension recipe) =
      decodeRequest recipe := by
  cases recipe
  rfl

theorem enabled_reindex_iff
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (config : Config source) (operation : Request) :
    operation.Enabled (Config.reindex extension config) ↔
      operation.Enabled config := by
  cases operation <;>
    simp [Request.Enabled, Config.reindex, incidentEdges]

theorem recipeConsistent_reindex_iff
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (recipe : DPOEvent.ReplayRecipe source)
    (config : Config source) (operation : Request)
    (oldEnabled : operation.Enabled config)
    (newEnabled : operation.Enabled (Config.reindex extension config)) :
    recipeConsistent
        (DPOEvent.ReplayRecipe.reindex extension recipe)
        (Config.reindex extension config) operation newEnabled ↔
      recipeConsistent recipe config operation oldEnabled := by
  cases recipe
  simpa [DPOEvent.ReplayRecipe.reindex, recipeConsistent,
    Config.reindex, matchNodes]

theorem replayKernel_reindexCoherent
    {source target : FinSignature}
    (extension : SignatureExtension source target) :
    DPOEvent.ReplayKernel.ReindexCoherent extension
      (Cantilune.Pi.P1cAdmittedOperations.replayKernel (σ := source))
      (Cantilune.Pi.P1cAdmittedOperations.replayKernel (σ := target)) := by
  constructor
  intro recipe config
  simp only [Cantilune.Pi.P1cAdmittedOperations.replayKernel]
  rw [decodeRequest_reindex]
  cases decoded : decodeRequest recipe with
  | none => simp [decoded]
  | some operation =>
      simp only
      by_cases enabled : operation.Enabled config
      · have mappedEnabled :
          operation.Enabled (Config.reindex extension config) := by
          exact (enabled_reindex_iff extension config operation).2 enabled
        rw [dif_pos mappedEnabled, dif_pos enabled]
        by_cases consistent :
            recipeConsistent recipe config operation enabled
        · have mappedConsistent :
            recipeConsistent
              (DPOEvent.ReplayRecipe.reindex extension recipe)
              (Config.reindex extension config) operation mappedEnabled := by
            exact
              (recipeConsistent_reindex_iff extension recipe config operation
                enabled mappedEnabled).2 consistent
          rw [if_pos mappedConsistent, if_pos consistent]
          simp
        · have mappedInconsistent :
            ¬ recipeConsistent
              (DPOEvent.ReplayRecipe.reindex extension recipe)
              (Config.reindex extension config) operation mappedEnabled := by
            intro mapped
            apply consistent
            exact
              (recipeConsistent_reindex_iff extension recipe config operation
                enabled mappedEnabled).1 mapped
          rw [if_neg mappedInconsistent, if_neg consistent]
          rfl
      · have mappedDisabled :
          ¬ operation.Enabled (Config.reindex extension config) := by
          exact fun mapped =>
            enabled ((enabled_reindex_iff extension config operation).1 mapped)
        rw [dif_neg mappedDisabled, dif_neg enabled]
        rfl

theorem familyReplayKernel_reindexCoherent
    {source target : FinSignature}
    (extension : SignatureExtension source target) :
    DPOEvent.ReplayKernel.ReindexCoherent extension
      (familyReplayKernel source) (familyReplayKernel target) := by
  constructor
  intro recipe config
  by_cases hold : recipe.ruleId = 90
  · simp [familyReplayKernel, DPOEvent.ReplayRecipe.reindex, hold]
  · have delegated :=
      (replayKernel_reindexCoherent extension).run_reindex recipe config
    simpa [familyReplayKernel, DPOEvent.ReplayRecipe.reindex, hold] using
      delegated

def reindexOccurrence {source target : FinSignature}
    (extension : SignatureExtension source target)
    (old : Occurrence source) :
    Occurrence target :=
  occurrence target old.source.signatureVersion
    (match old.request with
      | .reconnect _ _ =>
          (old.source.nodeLabel 0).map extension.gen
      | _ => none)

/-!
For the canonical event family it is clearer, and definitionally stronger, to
reindex the epoch/label key and rebuild the canonical occurrence.
-/
def mapOccurrence {source target : FinSignature}
    (extension : SignatureExtension source target)
    (event : BusinessKey source) :
    Occurrence target :=
  occurrence target event.1.val (event.2.map extension.gen)

@[simp] theorem mapOccurrence_source
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (event : BusinessKey source) :
    (mapOccurrence extension event).source =
      Config.reindex extension
        (occurrence source event.1.val event.2).source := by
  rcases event with ⟨epoch, generator⟩
  cases generator <;> simp [mapOccurrence, occurrence]

@[simp] theorem mapOccurrence_request
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (event : BusinessKey source) :
    (mapOccurrence extension event).request =
      (occurrence source event.1.val event.2).request := by
  rcases event with ⟨epoch, generator⟩
  cases generator <;> rfl

@[simp] theorem mapOccurrence_target
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (event : BusinessKey source) :
    (mapOccurrence extension event).target =
      Config.reindex extension
        (occurrence source event.1.val event.2).target := by
  rw [Occurrence.target, Occurrence.target, mapOccurrence_source,
    mapOccurrence_request]
  exact
    (reindex_applyRequest extension
      (occurrence source event.1.val event.2).source
      (occurrence source event.1.val event.2).request).symm

theorem matchEmbedding_mapOccurrence
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (event : BusinessKey source) :
    HEq
      (finsetEmbedding (matchNodes_subset (mapOccurrence extension event)))
      (finsetEmbedding
        (matchNodes_subset (occurrence source event.1.val event.2))) := by
  rcases event with ⟨epoch, generator⟩
  cases generator
  · apply heq_of_eq
    congr
  · apply heq_of_eq
    congr

theorem p1cEvent_natural
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (event : BusinessKey source) :
    (verifiedEvent (mapOccurrence extension event)).event =
      DPOEvent.reindex extension
        (verifiedEvent (occurrence source event.1.val event.2)).event := by
  rw [DPOEvent.mk.injEq]
  simp [mapOccurrence_source, mapOccurrence_target, mapOccurrence_request,
    Cantilune.Pi.P1cAdmittedOperations.verifiedEvent,
    Cantilune.Pi.P1cAdmittedOperations.event, DPOEvent.reindex, matchNodes]
  exact ⟨matchEmbedding_mapOccurrence extension event, rfl⟩

theorem businessRecord_natural
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (event : BusinessKey source) :
    businessRecord target (event.1, event.2.map extension.gen) =
      DPOEvent.Verified.reindex
        (familyReplayKernel_reindexCoherent extension)
        (businessRecord source event) := by
  rw [DPOEvent.Verified.mk.injEq]
  exact p1cEvent_natural extension event

theorem holdEvent_natural
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (state : State source) :
    holdEvent target (reindexState extension state) =
      DPOEvent.reindex extension (holdEvent source state) := by
  have configuration :=
    reindex_configOf extension state
  have cardinality :
      (configOf target (reindexState extension state)).nodes.card =
        (configOf source state).nodes.card := by
    simpa [Config.reindex] using
      congrArg (fun config : Config target => config.nodes.card)
        configuration.symm
  rw [DPOEvent.mk.injEq]
  simp only [holdEvent, DPOEvent.reindex]
  simp_rw [← reindex_configOf extension state]
  simp [Config.reindex, emptyEmbedding]
  exact emptyEmbedding_heq cardinality

theorem holdRecord_natural
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (state : State source) :
    holdRecord target (reindexState extension state) =
      DPOEvent.Verified.reindex
        (familyReplayKernel_reindexCoherent extension)
        (holdRecord source state) := by
  rw [DPOEvent.Verified.mk.injEq]
  exact holdEvent_natural extension state

def sourceReindexing {source target : FinSignature}
    (extension : SignatureExtension source target) :
    ExecutionPackage.Reindexing extension
      (sourcePackage source) (sourcePackage target) where
  replayCoherent := familyReplayKernel_reindexCoherent extension
  mapState := reindexState extension
  mapEvent := reindexEvent extension
  mapStep := by
    intro before event after step
    rcases step with ⟨step, observable⟩
    cases step with
    | business epoch generator =>
        exact ⟨SourceStep.business _ _, trivial⟩
    | hold state =>
        exact ⟨SourceStep.hold _, trivial⟩
  configOf_natural := by
    intro state
    exact (reindex_configOf extension state).symm
  eventRecord_natural := by
    intro event
    cases event with
    | business key => exact businessRecord_natural extension key
    | hold state => exact holdRecord_natural extension state

def sourceFamily : ReindexableExecutionFamily where
  package := sourcePackage
  reindex := sourceReindexing
  state_identity := by
    rintro signature ⟨epoch, generator, phase⟩
    change reindexState (SignatureExtension.refl signature)
      (epoch, generator, phase) = (epoch, generator, phase)
    cases generator <;> rfl
  event_identity := by
    intro signature event
    cases event with
    | business key =>
        rcases key with ⟨epoch, generator⟩
        cases generator <;> rfl
    | hold state =>
        rcases state with ⟨epoch, generator, phase⟩
        cases generator <;> rfl
  state_composition := by
    rintro source middle target first second ⟨epoch, generator, phase⟩
    change
      reindexState (SignatureExtension.trans first second)
          (epoch, generator, phase) =
        reindexState second
          (reindexState first (epoch, generator, phase))
    simp [reindexState, SignatureExtension.trans, Option.map_map,
      Function.comp_def]
  event_composition := by
    intro source middle target first second event
    cases event with
    | business key =>
        rcases key with ⟨epoch, generator⟩
        change
          reindexEvent (SignatureExtension.trans first second)
              (.business (epoch, generator)) =
            reindexEvent second
              (reindexEvent first (.business (epoch, generator)))
        simp [reindexEvent, SignatureExtension.trans, Option.map_map,
          Function.comp_def]
    | hold state =>
        rcases state with ⟨epoch, generator, phase⟩
        change
          reindexEvent (SignatureExtension.trans first second)
              (.hold (epoch, generator, phase)) =
            reindexEvent second
              (reindexEvent first (.hold (epoch, generator, phase)))
        simp [reindexEvent, reindexState, SignatureExtension.trans,
          Option.map_map, Function.comp_def]

/-! ## Four non-identity operational target families -/

abbrev ViewKind :=
  Cantilune.Theorems.P1cProductRuleProofBundle.ViewKind

abbrev ViewNativePayload {signature : FinSignature}
    (kind : ViewKind) (occurrence : Occurrence signature) :=
  Cantilune.Theorems.P1cProductRuleProofBundle.NativePayload kind occurrence

inductive ViewStep (kind : ViewKind) (signature : FinSignature) :
    State signature → Event signature → State signature → Prop
  | business (epoch : Epoch) (generator : Option signature.Gen)
      (native :
        ViewNativePayload kind (occurrence signature epoch.val generator)) :
      ViewStep kind signature
        (epoch, generator, false) (.business (epoch, generator))
        (epoch, generator, true)
  | hold (state : State signature) :
      ViewStep kind signature state (.hold state) state

def viewLTS (kind : ViewKind) (signature : FinSignature) :
    ObservableLTS where
  State := State signature
  Event := Event signature
  stateSetoid := ObservableLTS.equalitySetoid _
  step := ViewStep kind signature
  observable := fun _ => True
  success := fun state => state.2.2
  waiting := fun _ => False
  signatureVersion := fun state => state.1.val
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

def viewPackage (kind : ViewKind) (signature : FinSignature) :
    ExecutionPackage signature where
  lts := viewLTS kind signature
  configOf := configOf signature
  replayKernel := familyReplayKernel signature
  eventRecord := eventRecord signature
  eventEndpoints := by
    intro source event target step
    rcases step with ⟨step, _observable⟩
    cases step with
    | business epoch generator native =>
        exact (businessRecord signature (epoch, generator)).replays_recorded
    | hold =>
        exact (holdRecord signature source).replays_recorded
  stateVersion := by
    rintro ⟨epoch, generator, phase⟩
    change (configOf signature (epoch, generator, phase)).signatureVersion =
      epoch.val
    cases generator <;> cases phase <;>
      simp [configOf, occurrence, baseConfig, emptyConfig, pairConfig,
        Occurrence.target, applyRequest, request]
  resourcesClear := fun state => (configOf signature state).resourceTokens = ∅
  sessionsQuiescent := fun state => (configOf signature state).names = ∅
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun event =>
        match event with
        | .business _ => True
        | .hold _ => False
      rank := fun state => if state.2.2 then 0 else 1
      epoch := fun state => state.1.val
      decreases := by
        intro source event target step internal
        rcases step with ⟨native, _observable⟩
        cases native with
        | business => simp
        | hold => simp at internal
      epoch_preserved := by
        intro source event target step internal
        rcases step with ⟨native, _observable⟩
        cases native with
        | business => rfl
        | hold => simp at internal }

def operationalProjection (kind : ViewKind) (signature : FinSignature) :
    ProjectionCertificate
      (sourceLTS signature) (viewLTS kind signature) where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by simp
  map_equiv := by
    intro source target equality
    exact equality
  sound := by
    intro source event target step
    rcases step with ⟨step, observable⟩
    cases step with
    | business epoch generator =>
        exact
          ⟨ViewStep.business _ _
            (Cantilune.Theorems.P1cProductRuleProofBundle.nativePayload
              kind (occurrence signature _ _)),
            observable⟩
    | hold state =>
        exact ⟨ViewStep.hold _, observable⟩
  reflect := by
    intro source event target step
    rcases step with ⟨step, observable⟩
    cases step with
    | business epoch generator native =>
        exact
          ⟨.business (epoch, generator), (epoch, generator, true),
            ⟨SourceStep.business epoch generator, observable⟩, rfl, rfl⟩
    | hold =>
        exact
          ⟨.hold source, source, ⟨SourceStep.hold source, observable⟩, rfl, rfl⟩
  success_iff := by simp [sourceLTS, viewLTS]
  waiting_iff := by simp [sourceLTS, viewLTS]
  signatureVersion_preserved := by
    intro state
    rfl

def viewReindexing (kind : ViewKind)
    {source target : FinSignature}
    (extension : SignatureExtension source target) :
    ExecutionPackage.Reindexing extension
      (viewPackage kind source) (viewPackage kind target) where
  replayCoherent := familyReplayKernel_reindexCoherent extension
  mapState := reindexState extension
  mapEvent := reindexEvent extension
  mapStep := by
    intro before event after step
    rcases step with ⟨step, observable⟩
    cases step with
    | business epoch generator native =>
        exact
          ⟨ViewStep.business _ _
            (Cantilune.Theorems.P1cProductRuleProofBundle.nativePayload
              kind (occurrence target _ _)),
            observable⟩
    | hold state =>
        exact ⟨ViewStep.hold _, observable⟩
  configOf_natural := by
    intro state
    exact (reindex_configOf extension state).symm
  eventRecord_natural := by
    intro event
    cases event with
    | business key => exact businessRecord_natural extension key
    | hold state => exact holdRecord_natural extension state

def viewFamily (kind : ViewKind) : ReindexableExecutionFamily where
  package := viewPackage kind
  reindex := viewReindexing kind
  state_identity := by
    rintro signature ⟨epoch, generator, phase⟩
    change reindexState (SignatureExtension.refl signature)
      (epoch, generator, phase) = (epoch, generator, phase)
    cases generator <;> rfl
  event_identity := by
    intro signature event
    cases event with
    | business key =>
        rcases key with ⟨epoch, generator⟩
        cases generator <;> rfl
    | hold state =>
        rcases state with ⟨epoch, generator, phase⟩
        cases generator <;> rfl
  state_composition := by
    rintro source middle target first second ⟨epoch, generator, phase⟩
    change
      reindexState (SignatureExtension.trans first second)
          (epoch, generator, phase) =
        reindexState second
          (reindexState first (epoch, generator, phase))
    simp [reindexState, SignatureExtension.trans, Option.map_map,
      Function.comp_def]
  event_composition := by
    intro source middle target first second event
    cases event with
    | business key =>
        rcases key with ⟨epoch, generator⟩
        change
          reindexEvent (SignatureExtension.trans first second)
              (.business (epoch, generator)) =
            reindexEvent second
              (reindexEvent first (.business (epoch, generator)))
        simp [reindexEvent, SignatureExtension.trans, Option.map_map,
          Function.comp_def]
    | hold state =>
        rcases state with ⟨epoch, generator, phase⟩
        change
          reindexEvent (SignatureExtension.trans first second)
              (.hold (epoch, generator, phase)) =
            reindexEvent second
              (reindexEvent first (.hold (epoch, generator, phase)))
        simp [reindexEvent, reindexState, SignatureExtension.trans,
          Option.map_map, Function.comp_def]

abbrev identityStatic :
    StaticSMCProjectionCertificate (Type 0) (Type 0) :=
  Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.identityStatic

def projectionFamily (kind : ViewKind) :
    ProjectionFamilyOver (Type 0) (Type 0) sourceFamily where
  target := viewFamily kind
  static := fun _ => identityStatic
  operational := operationalProjection kind
  resources := fun signature =>
    { sourceResourcesValid :=
        (sourcePackage signature).resourcesClear
      targetResourcesValid :=
        (viewPackage kind signature).resourcesClear
      resources_iff := by
        intro state
        rfl }
  terminals := fun signature =>
    TerminalProjectionCompatibility.ofOperational
      (operationalProjection kind signature)
  state_natural := by
    intro oldSignature newSignature extension state
    rfl
  event_natural := by
    intro oldSignature newSignature extension event
    rfl

abbrev dagFamily := projectionFamily .dag
abbrev petriFamily := projectionFamily .petri
abbrev piFamily := projectionFamily .pi
abbrev morphismFamily := projectionFamily .morphism

/-! ## Faithful finite-state categorical realizations -/

def stateCode {signature : FinSignature} (state : State signature) : Nat :=
  ((Fintype.equivFin (State signature)) state).val

theorem stateCode_injective {signature : FinSignature} :
    Function.Injective (stateCode (signature := signature)) := by
  intro source target equality
  apply (Fintype.equivFin (State signature)).injective
  apply Fin.ext
  exact equality

def stateType {signature : FinSignature} (state : State signature) : Type :=
  Fin (stateCode state + 1)

def stateArrow {signature : FinSignature} (state : State signature) :
    Arrow (Type 0) :=
  Arrow.mk (𝟙 (stateType state))

theorem state_eq_of_arrow_iso {signature : FinSignature}
    {source target : State signature}
    (iso : stateArrow source ≅ stateArrow target) :
    source = target := by
  have cardinality :=
    Nat.card_congr
      ((Arrow.leftFunc : Arrow (Type 0) ⥤ Type 0).mapIso iso).toEquiv
  change Nat.card (stateType source) = Nat.card (stateType target) at cardinality
  have codeEquality : stateCode source = stateCode target := by
    simpa [stateType] using cardinality
  exact stateCode_injective codeEquality

theorem stateArrow_injective {signature : FinSignature} :
    Function.Injective (stateArrow (signature := signature)) := by
  intro source target equality
  exact state_eq_of_arrow_iso (eqToIso equality)

def nativeCell {signature : FinSignature}
    {source target : State signature} :
    Arrow.Hom (stateArrow source) (stateArrow target) :=
  Arrow.homMk'
    (TypeCat.ofHom fun _ : stateType source =>
      (⟨0, Nat.zero_lt_succ _⟩ : stateType target))
    (TypeCat.ofHom fun _ : stateType source =>
      (⟨0, Nat.zero_lt_succ _⟩ : stateType target))
    (by rfl)

def sourceRealization (signature : FinSignature) :
    CategoricalLTSRealization (sourceLTS signature) (Type 0) where
  stateArrow := stateArrow
  state_injective := stateArrow_injective
  stateEquivIso := by
    intro source target equivalent
    subst target
    exact Iso.refl _
  state_iso_reflects_equiv := by
    intro source target iso
    exact state_eq_of_arrow_iso iso.some
  stateEquivIso_refl := by
    intro state
    rfl
  stateEquivIso_symm := by
    intro source target equivalent
    subst target
    rfl
  stateEquivIso_trans := by
    intro first middle last left right
    subst middle
    subst last
    rfl
  stepCell := fun _ => nativeCell
  recoverEvent := by
    classical
    exact fun source target _cell =>
      if source = target then some (.hold source)
      else some (.business (source.1, source.2.1))
  recover_step := by
    classical
    intro source event target step
    rcases step with ⟨step, observable⟩
    cases step with
    | business epoch generator =>
        have endpoints_ne :
            (epoch, generator, false) ≠
              (epoch, generator, true) := by
          intro equality
          have contradiction :=
            congrArg (fun state : State signature => state.2.2) equality
          simp at contradiction
        simp
        exact endpoints_ne
    | hold state =>
        simp
  stepCell_congr := by
    intro source source' event target target' sourceEq targetEq step
    subst source'
    subst target'
    apply Arrow.hom_ext <;>
      apply ConcreteCategory.hom_ext <;>
      intro value <;> rfl

def viewRealization (kind : ViewKind) (signature : FinSignature) :
    CategoricalLTSRealization (viewLTS kind signature) (Type 0) where
  stateArrow := stateArrow
  state_injective := stateArrow_injective
  stateEquivIso := by
    intro source target equivalent
    subst target
    exact Iso.refl _
  state_iso_reflects_equiv := by
    intro source target iso
    exact state_eq_of_arrow_iso iso.some
  stateEquivIso_refl := by
    intro state
    rfl
  stateEquivIso_symm := by
    intro source target equivalent
    subst target
    rfl
  stateEquivIso_trans := by
    intro first middle last left right
    subst middle
    subst last
    rfl
  stepCell := fun _ => nativeCell
  recoverEvent := by
    classical
    exact fun source target _cell =>
      if source = target then some (.hold source)
      else some (.business (source.1, source.2.1))
  recover_step := by
    classical
    intro source event target step
    rcases step with ⟨step, observable⟩
    cases step with
    | business epoch generator native =>
        have endpoints_ne :
            (epoch, generator, false) ≠
              (epoch, generator, true) := by
          intro equality
          have contradiction :=
            congrArg (fun state : State signature => state.2.2) equality
          simp at contradiction
        simp
        exact endpoints_ne
    | hold state =>
        simp
  stepCell_congr := by
    intro source source' event target target' sourceEq targetEq step
    subst source'
    subst target'
    apply Arrow.hom_ext <;>
      apply ConcreteCategory.hom_ext <;>
      intro value <;> rfl

def crossLayer (kind : ViewKind) (signature : FinSignature) :
    StaticOperationalCoherence identityStatic
      (operationalProjection kind signature)
      (sourceRealization signature) (viewRealization kind signature) where
  stateIso := fun state =>
    eqToIso
      (Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference.identity_mapArrow_obj_eq
        (stateArrow state))
  step_cell_commutes := by
    intro source event target step
    apply Arrow.hom_ext
    · apply ConcreteCategory.hom_ext
      intro value
      rfl
    · apply ConcreteCategory.hom_ext
      intro value
      rfl

/-! ## The strict admission whose endpoint is the reconnect source -/

abbrev oldSignature :=
  Cantilune.Pi.AdmissionCertificate.ReferenceSignature.source

abbrev newSignature :=
  Cantilune.Pi.AdmissionCertificate.ReferenceSignature.target

abbrev universes :=
  Cantilune.Pi.AdmissionCertificate.ReferenceSignature.universes

def admission :
    SignatureAdmissionEvent universes
      (source := oldSignature) (target := newSignature) where
  fromVersion := 2
  toVersion := 3
  advancesEpoch := by omega
  extension :=
    Cantilune.Pi.AdmissionCertificate.ReferenceSignature.extension
  oldViews :=
    Cantilune.Pi.AdmissionCertificate.ReferenceSignature.oldViews
  newViews :=
    Cantilune.Pi.AdmissionCertificate.ReferenceSignature.newViews
  certificate :=
    Cantilune.Pi.AdmissionCertificate.ReferenceSignature.fourViewAdmission
  tombstoneId := 7001

def epochTwo : Epoch := ⟨2, by decide⟩
def epochThree : Epoch := ⟨3, by decide⟩

def beforeState : State oldSignature :=
  (epochTwo, some .existing, false)

def reconnectSource : State newSignature :=
  (epochThree, some .existing, false)

def reconnectEvent : Event newSignature :=
  .business (epochThree, some .existing)

def reconnectTarget : State newSignature :=
  (epochThree, some .existing, true)

inductive SourceAdmissionStep :
    State oldSignature → Unit → State newSignature → Prop
  | register : SourceAdmissionStep beforeState () reconnectSource

def sourceAdmissionSemantics :
    HeterogeneousAdmissionLTS (universes := universes)
      (sourcePackage oldSignature) (sourcePackage newSignature) where
  Event := Unit
  eventOf := fun _ => ()
  step := SourceAdmissionStep

theorem sourceAdmissionReplays :
    AdmissionReplays admission
      (configOf oldSignature beforeState)
      (configOf newSignature reconnectSource) := by
  constructor
  · rfl
  · unfold admissionTarget withSignatureVersion
    simp [admission, beforeState, reconnectSource, epochTwo, epochThree,
      configOf, occurrence, baseConfig, pairConfig, Config.reindex]
    funext node
    by_cases member : node = 0 ∨ node = 1 <;>
      simp [member,
        Cantilune.Pi.AdmissionCertificate.ReferenceSignature.extension]

def sourceAdmissionOccurrence :
    HeterogeneousPackageAdmission
      (sourcePackage oldSignature) (sourcePackage newSignature)
      sourceAdmissionSemantics admission where
  beforeState := beforeState
  afterState := reconnectSource
  native := SourceAdmissionStep.register
  replays := sourceAdmissionReplays

inductive ViewAdmissionStep (kind : ViewKind) :
    State oldSignature → Unit → State newSignature → Prop
  | register : ViewAdmissionStep kind beforeState () reconnectSource

def viewAdmissionSemantics (kind : ViewKind) :
    HeterogeneousAdmissionLTS (universes := universes)
      (viewPackage kind oldSignature) (viewPackage kind newSignature) where
  Event := Unit
  eventOf := fun _ => ()
  step := ViewAdmissionStep kind

def viewAdmissionOccurrence (kind : ViewKind) :
    HeterogeneousPackageAdmission
      (viewPackage kind oldSignature) (viewPackage kind newSignature)
      (viewAdmissionSemantics kind) admission where
  beforeState := beforeState
  afterState := reconnectSource
  native := ViewAdmissionStep.register
  replays := sourceAdmissionReplays

def admissionProjection (kind : ViewKind) :
    HeterogeneousAdmissionProjection
      (sourcePackage oldSignature) (sourcePackage newSignature)
      (viewPackage kind oldSignature) (viewPackage kind newSignature)
      sourceAdmissionSemantics (viewAdmissionSemantics kind)
      admission sourceAdmissionOccurrence
      (operationalProjection kind oldSignature)
      (operationalProjection kind newSignature) where
  targetOccurrence := viewAdmissionOccurrence kind
  mapAdmissionEvent := id
  event_commutes := rfl
  before_commutes := rfl
  after_commutes := rfl

def coherentAdmission (kind : ViewKind) :
    CoherentProjectionFamilyAdmission
      (Type 0) (Type 0) (projectionFamily kind).toProjectionFamily
      admission sourceAdmissionSemantics sourceAdmissionOccurrence
      (viewAdmissionSemantics kind) where
  sourceBeforeRealization := sourceRealization oldSignature
  targetBeforeRealization := viewRealization kind oldSignature
  beforeCrossLayer := crossLayer kind oldSignature
  sourceAfterRealization := sourceRealization newSignature
  targetAfterRealization := viewRealization kind newSignature
  afterCrossLayer := crossLayer kind newSignature
  admissionProjection := admissionProjection kind

def fourCoherent :
    FourCoherentFamilyAdmission
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      sourceFamily dagFamily petriFamily piFamily morphismFamily
      admission sourceAdmissionSemantics sourceAdmissionOccurrence where
  dagSemantics := viewAdmissionSemantics .dag
  dag := coherentAdmission .dag
  petriSemantics := viewAdmissionSemantics .petri
  petri := coherentAdmission .petri
  piSemantics := viewAdmissionSemantics .pi
  pi := coherentAdmission .pi
  morphismSemantics := viewAdmissionSemantics .morphism
  morphism := coherentAdmission .morphism

/-! ## The post-admission reconnect occurrence and its probability kernel -/

def candidate : Candidate (sourcePackage newSignature) where
  before := reconnectSource
  event := reconnectEvent
  after := reconnectTarget

theorem reconnectNative :
    (sourcePackage newSignature).lts.ObservableStep
      reconnectSource reconnectEvent reconnectTarget := by
  exact
    ⟨SourceStep.business (signature := newSignature)
        epochThree (some .existing),
      trivial⟩

theorem reconnectReplays :
    ((sourcePackage newSignature).eventRecord reconnectEvent).Replays
      ((sourcePackage newSignature).configOf reconnectSource)
      ((sourcePackage newSignature).configOf reconnectTarget) :=
  (sourcePackage newSignature).eventEndpoints reconnectNative

def rankEvidence :
    Cantilune.Theorems.ProductRuleAdmission.RuleRankEvidence
      (sourcePackage newSignature)
      (before := candidate.before)
      (event := candidate.event)
      (after := candidate.after) where
  decreases_if_internal := by
    intro internal
    exact
      (sourcePackage newSignature).ranking.decreases
        reconnectNative internal
  epoch_preserved_if_internal := by
    intro internal
    exact
      (sourcePackage newSignature).ranking.epoch_preserved
        reconnectNative internal

def nextState (state : State newSignature) : State newSignature :=
  if state = reconnectSource then reconnectTarget else state

noncomputable def kernelProbability
    (source target : State newSignature) : Real :=
  if target = nextState source then 1 else 0

noncomputable def kernel :
    NativeMarkovKernel
      newSignature (sourcePackage newSignature) (State newSignature) where
  stateEquiv := Equiv.refl _
  probability := kernelProbability
  probability_nonnegative := by
    intro source target
    by_cases equal : target = nextState source <;>
      simp [kernelProbability, equal]
  row_sum := by
    intro source
    classical
    simp [kernelProbability]
  native_support_of_change := by
    intro source target positive different
    have target_eq : target = nextState source := by
      by_contra unequal
      simp [kernelProbability, unequal] at positive
    by_cases selected : source = reconnectSource
    · subst source
      have target_is_reconnect : target = reconnectTarget := by
        simpa [nextState] using target_eq
      subst target
      exact ⟨reconnectEvent, reconnectNative⟩
    · have target_is_source : target = source := by
        simpa [nextState, selected] using target_eq
      exact False.elim (different target_is_source.symm)

noncomputable def initial :
    InitialDistribution (State newSignature) where
  probability := fun state => if state = reconnectSource then 1 else 0
  probability_nonnegative := by
    intro state
    by_cases equal : state = reconnectSource <;> simp [equal]
  total := by
    classical
    rw [Finset.sum_ite_eq' Finset.univ reconnectSource]
    simp

def stableWindow :
    StableFairWindow where
  signatureVersion := fun _ => 3
  observed := fun _ => True
  startEpoch := 3
  opportunityEpoch := fun opportunity => 3 + opportunity
  signature_stable := by simp
  opportunity_after_start := by omega
  opportunity_strictMono := by
    intro left right less
    exact Nat.add_lt_add_left less 3
  opportunity_observed := by simp
  cofinal := by
    intro epoch afterStart
    exact ⟨epoch, by omega⟩

def stableState (state : State newSignature) : Bool :=
  decide (state ≠ reconnectSource)

theorem stable_reconnectTarget :
    stableState reconnectTarget = true := by
  simp [stableState, reconnectTarget, reconnectSource]

theorem unstable_is_reconnectSource
    {state : State newSignature}
    (unstable : stableState state ≠ true) :
    state = reconnectSource := by
  by_contra different
  exact unstable (by simp [stableState, different])

noncomputable def progress :
    ProgressBridge kernel initial (1 : Real) where
  window := stableWindow
  stable := stableState
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  pointwise_progress := by
    intro state unstable
    have state_eq := unstable_is_reconnectSource unstable
    subst state
    classical
    have target_mem :
        reconnectTarget ∈
          stableStates stableState := by
      simp [stableStates, stable_reconnectTarget]
    calc
      (1 : Real) =
          kernelProbability reconnectSource reconnectTarget := by
            simp [kernelProbability, nextState]
      _ ≤
          ∑ target ∈
            stableStates stableState,
              kernelProbability reconnectSource target := by
          apply Finset.single_le_sum
          · intro target _member
            by_cases equal : target = nextState reconnectSource <;>
              simp [kernelProbability, equal]
          · exact target_mem

def qualified
    (before : State newSignature)
    (event : Event newSignature)
    (after : State newSignature) : Prop :=
  before = reconnectSource ∧
    event = reconnectEvent ∧
      after = reconnectTarget

def authorized
    (before : State newSignature)
    (event : Event newSignature)
    (after : State newSignature) : Prop :=
  qualified before event after ∧
    (configOf newSignature before).policyState = 0

def probabilityObligations :
    ProbabilitySchedulingObligations
      (sourcePackage newSignature) kernel initial (1 : Real)
      rankEvidence where
  stableWindow := stableWindow
  progress := progress
  progressWindow := rfl
  positiveEpsilon := by norm_num
  epsilonAtMostOne := by norm_num
  scheduling :=
    Cantilune.Theorems.ProductRuleAdmission.RuleSchedulingEvidence.internal
      (by
        change True
        trivial)
      (by
        change 0 < 1
        omega)
      rfl

theorem config_resources_empty
    (signature : FinSignature) (state : State signature) :
    (configOf signature state).resourceTokens = ∅ := by
  rcases state with ⟨epoch, generator, phase⟩
  cases generator <;> cases phase <;>
    simp [configOf, occurrence, baseConfig, emptyConfig, pairConfig,
      Occurrence.target, applyRequest, request]

theorem config_names_empty
    (signature : FinSignature) (state : State signature) :
    (configOf signature state).names = ∅ := by
  rcases state with ⟨epoch, generator, phase⟩
  cases generator <;> cases phase <;>
    simp [configOf, occurrence, baseConfig, emptyConfig, pairConfig,
      Occurrence.target, applyRequest, request]

def resourceQuiescence :
    ResourceQuiescenceEvidence
      (sourcePackage newSignature)
      (viewPackage .dag newSignature)
      (viewPackage .petri newSignature)
      (viewPackage .pi newSignature)
      (viewPackage .morphism newSignature)
      (operationalProjection .dag newSignature)
      (operationalProjection .petri newSignature)
      (operationalProjection .pi newSignature)
      (operationalProjection .morphism newSignature)
      candidate where
  sourceResourcesBefore := config_resources_empty _ _
  sourceResourcesAfter := config_resources_empty _ _
  sourceSessionsBefore := config_names_empty _ _
  sourceSessionsAfter := config_names_empty _ _
  dagResourcesBefore := config_resources_empty _ _
  dagResourcesAfter := config_resources_empty _ _
  dagSessionsBefore := config_names_empty _ _
  dagSessionsAfter := config_names_empty _ _
  petriResourcesBefore := config_resources_empty _ _
  petriResourcesAfter := config_resources_empty _ _
  petriSessionsBefore := config_names_empty _ _
  petriSessionsAfter := config_names_empty _ _
  piResourcesBefore := config_resources_empty _ _
  piResourcesAfter := config_resources_empty _ _
  piSessionsBefore := config_names_empty _ _
  piSessionsAfter := config_names_empty _ _
  morphismResourcesBefore := config_resources_empty _ _
  morphismResourcesAfter := config_resources_empty _ _
  morphismSessionsBefore := config_names_empty _ _
  morphismSessionsAfter := config_names_empty _ _

def dagEvidence :
    ProjectionOccurrenceEvidence
      (sourcePackage newSignature) (viewPackage .dag newSignature)
      (operationalProjection .dag newSignature) candidate :=
  ProjectionOccurrenceEvidence.ofProjection reconnectNative

def petriEvidence :
    ProjectionOccurrenceEvidence
      (sourcePackage newSignature) (viewPackage .petri newSignature)
      (operationalProjection .petri newSignature) candidate :=
  ProjectionOccurrenceEvidence.ofProjection reconnectNative

def piEvidence :
    ProjectionOccurrenceEvidence
      (sourcePackage newSignature) (viewPackage .pi newSignature)
      (operationalProjection .pi newSignature) candidate :=
  ProjectionOccurrenceEvidence.ofProjection reconnectNative

def morphismEvidence :
    ProjectionOccurrenceEvidence
      (sourcePackage newSignature) (viewPackage .morphism newSignature)
      (operationalProjection .morphism newSignature) candidate :=
  ProjectionOccurrenceEvidence.ofProjection reconnectNative

def proofBundle :
    ProductRuleProofBundle
      (sourcePackage newSignature)
      (viewPackage .dag newSignature)
      (viewPackage .petri newSignature)
      (viewPackage .pi newSignature)
      (viewPackage .morphism newSignature)
      (operationalProjection .dag newSignature)
      (operationalProjection .petri newSignature)
      (operationalProjection .pi newSignature)
      (operationalProjection .morphism newSignature)
      kernel initial (1 : Real) qualified authorized candidate where
  sourceOccurrence :=
    SourceOccurrenceEvidence.ofNative reconnectNative
  rank := rankEvidence
  resourceQuiescence := resourceQuiescence
  dag := dagEvidence
  petri := petriEvidence
  pi := piEvidence
  morphism := morphismEvidence
  qualified := by
    exact ⟨rfl, rfl, rfl⟩
  authorized := by
    constructor
    · exact ⟨rfl, rfl, rfl⟩
    · rfl
  probability := probabilityObligations

/-- Canonical SCC/rank semantics for the selected reconnect DAG occurrence. -/
def dagSemantic :
    DAGSemanticCertificate
      (sourcePackage newSignature)
      (viewPackage .dag newSignature)
      (operationalProjection .dag newSignature)
      candidate where
  sourceOccurrence := proofBundle.sourceOccurrence
  occurrence := dagEvidence
  eventRecordExact := rfl
  beforeConfig := rfl
  afterConfig := rfl

/--
Canonical declaration-order and individual-token/provenance semantics for the
same selected reconnect occurrence.
-/
abbrev selectedPetriEvent :=
  ((sourcePackage newSignature).eventRecord candidate.event).event

def legacyPetriDeclaration : PetriRuleDeclaration where
  signatureVersion := admission.fromVersion
  ruleId := 89
  ordinal := 0

def admittedPetriDeclaration : PetriRuleDeclaration :=
  declarationOfEvent selectedPetriEvent 1

theorem admittedPetriDeclaration_ne_legacy :
    admittedPetriDeclaration ≠ legacyPetriDeclaration := by
  decide

def legacyPetriBeforeConfig : Config oldSignature where
  signatureVersion := admission.fromVersion
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

def legacyPetriAfterConfig : Config oldSignature :=
  { legacyPetriBeforeConfig with policyState := 1 }

def legacyPetriTransition :
    Cantilune.Core.DPO.FiniteSupportEvent
      (ProvenanceToken oldSignature) :=
  endpointDelta legacyPetriBeforeConfig legacyPetriAfterConfig

theorem legacyPetriTransition_nonempty :
    ProvenanceToken.policy 1 ∈ legacyPetriTransition.insert := by
  simp [legacyPetriTransition, endpointDelta,
    legacyPetriBeforeConfig, legacyPetriAfterConfig,
    provenanceMarking, optionalAtom]

def legacyPetriNet :
    OrderedPreNet
      (Cantilune.Core.DPO.FiniteSupportEvent
        (ProvenanceToken oldSignature)) :=
  singletonDeclarationNet legacyPetriDeclaration legacyPetriTransition

theorem legacyPetriDeclaration_declared :
    legacyPetriDeclaration ∈ legacyPetriNet.declarations := by
  simp [legacyPetriNet, singletonDeclarationNet]

def admittedPetriNet :
    OrderedPreNet
      (Cantilune.Core.DPO.FiniteSupportEvent
        (ProvenanceToken newSignature)) :=
  appendReindexedPreNet
    (reindexFiniteSupportEvent admission.extension)
    legacyPetriNet
    admittedPetriDeclaration
    (endpointDelta selectedPetriEvent.source selectedPetriEvent.target)
    (by decide)
    (by decide)

def petriSemantic :
    PetriSemanticCertificate
      (sourcePackage newSignature)
      (viewPackage .petri newSignature)
      (operationalProjection .petri newSignature)
      candidate where
  sourceOccurrence := proofBundle.sourceOccurrence
  occurrence := petriEvidence
  eventRecordExact := rfl
  beforeConfig := rfl
  afterConfig := rfl
  net := admittedPetriNet
  selectedDeclaration := admittedPetriDeclaration
  selectedDeclared := by
    simp [admittedPetriNet, appendReindexedPreNet]
  selectedVersion := rfl
  selectedRule := rfl
  selectedIncidenceExact := by
    simp [admittedPetriNet, appendReindexedPreNet,
      legacyPetriNet, singletonDeclarationNet,
      admittedPetriDeclaration_ne_legacy]

def petriNetExtension :
    PreNetExtension admission legacyPetriNet
      admittedPetriNet admittedPetriDeclaration where
  appendedDeclarations := [admittedPetriDeclaration]
  declarationsAppend := rfl
  oldDeclaredInNew := by
    intro declaration declared
    simp only [admittedPetriNet, appendReindexedPreNet,
      List.mem_append, List.mem_singleton]
    exact Or.inl declared
  oldIncidencePreserved := by
    intro declaration declared
    simp [admittedPetriNet, appendReindexedPreNet, declared]
  selectedInAppend := by simp
  selectedNotOld := by
    simp [legacyPetriNet, singletonDeclarationNet,
      admittedPetriDeclaration_ne_legacy]
  extensionAddsGenerator := by
    intro surjective
    obtain ⟨generator, equality⟩ :=
      surjective
        Cantilune.Pi.AdmissionCertificate.ReferenceSignature.TargetGenerator.admitted
    cases generator
    cases equality
  traceTombstone := admission.tombstoneId
  traceTombstoneExact := rfl
  selectedAdmissionVersion := rfl

theorem legacyPetriIncidence_retained :
    admittedPetriNet.transitionOf legacyPetriDeclaration
        (petriNetExtension.oldDeclaredInNew
          legacyPetriDeclaration legacyPetriDeclaration_declared) =
      reindexFiniteSupportEvent admission.extension
        (legacyPetriNet.transitionOf legacyPetriDeclaration
          legacyPetriDeclaration_declared) :=
  petriNetExtension.oldIncidencePreserved
    legacyPetriDeclaration legacyPetriDeclaration_declared

/--
Reference-only anti-vacuity: the old epoch contains a genuinely nonempty
incidence, and that exact incidence is retained through the certified
signature reindexing.  The generic certificate intentionally permits the
first admission to start from an empty registry.
-/
def LegacyPetriAntiVacuity : Prop :=
  ProvenanceToken.policy 1 ∈ legacyPetriTransition.insert ∧
    admittedPetriNet.transitionOf legacyPetriDeclaration
        (petriNetExtension.oldDeclaredInNew
          legacyPetriDeclaration legacyPetriDeclaration_declared) =
      reindexFiniteSupportEvent admission.extension
        (legacyPetriNet.transitionOf legacyPetriDeclaration
          legacyPetriDeclaration_declared)

theorem legacyPetriAntiVacuity :
    LegacyPetriAntiVacuity :=
  ⟨legacyPetriTransition_nonempty, legacyPetriIncidence_retained⟩

def crossEpoch :
    CrossEpochProductFamily
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      sourceFamily dagFamily petriFamily piFamily morphismFamily
      admission sourceAdmissionSemantics sourceAdmissionOccurrence
      fourCoherent kernel initial (1 : Real)
      qualified authorized candidate where
  connects := rfl
  ruleBundle := proofBundle

def reconfigurablePetri :
    ReconfigurablePetriCertificate
      admission
      (sourcePackage oldSignature) (sourcePackage newSignature)
      (viewPackage .petri oldSignature) (viewPackage .petri newSignature)
      sourceAdmissionSemantics (viewAdmissionSemantics .petri)
      sourceAdmissionOccurrence
      (operationalProjection .petri oldSignature)
      (operationalProjection .petri newSignature)
      fourCoherent.petri.admissionProjection
      candidate crossEpoch.connects petriSemantic :=
  ReconfigurablePetriCertificate.ofPreNetExtension
    legacyPetriNet petriNetExtension

/-! ## Exact event labelling and structural endpoint facts -/

theorem target_eq_next_of_positive
    {source target : State newSignature}
    (positive : 0 < kernel.probability source target) :
    target = nextState source := by
  by_contra unequal
  simp [kernel, kernelProbability, unequal] at positive

noncomputable def positiveLabelling :
    Cantilune.Feedback.EventTrajectory.FiniteDiscrete.PositiveEventLabelling
      kernel where
  event := by
    intro source target positive
    exact
      if source = reconnectSource then reconnectEvent else .hold source
  native := by
    intro source target positive
    have target_eq := target_eq_next_of_positive positive
    by_cases selected : source = reconnectSource
    · subst source
      have target_is_reconnect : target = reconnectTarget := by
        simpa [nextState] using target_eq
      subst target
      change
        (sourcePackage newSignature).lts.ObservableStep
          reconnectSource reconnectEvent reconnectTarget
      exact reconnectNative
    · have target_is_source : target = source := by
        simpa [nextState, selected] using target_eq
      subst target
      rw [show nextState source = source by simp [nextState, selected]]
      rw [show kernel.stateEquiv source = source by rfl]
      simp only [selected, ↓reduceIte]
      change
        (sourcePackage newSignature).lts.ObservableStep
          source (.hold source) source
      exact ⟨SourceStep.hold source, trivial⟩

theorem selected_kernel_edge :
    kernel.probability reconnectSource reconnectTarget = 1 := by
  simp [kernel, kernelProbability, nextState]

theorem selected_event_is_reconnect :
    positiveLabelling.event
        (show 0 < kernel.probability reconnectSource reconnectTarget by
          rw [selected_kernel_edge]
          norm_num) =
      reconnectEvent := by
  simp [positiveLabelling]

theorem selected_event_replays :
    ((sourcePackage newSignature).eventRecord
      (positiveLabelling.event
        (show 0 < kernel.probability reconnectSource reconnectTarget by
          rw [selected_kernel_edge]
          norm_num))).Replays
      ((sourcePackage newSignature).configOf reconnectSource)
      ((sourcePackage newSignature).configOf reconnectTarget) := by
  rw [selected_event_is_reconnect]
  exact reconnectReplays

theorem every_positive_path_has_exact_event_replay
    (path :
      Cantilune.Feedback.EventTrajectory.FiniteDiscrete.PositiveStatePath
        kernel) :
    Nonempty
      (positiveLabelling.TrajectoryAgreement path) :=
  ⟨positiveLabelling.trajectoryAgreement path⟩

def reconnectGraph :
    Cantilune.Projection.SCCCondensation.FiniteDirectedGraph Nat where
  nodes := (configOf newSignature reconnectTarget).nodes
  edges := (configOf newSignature reconnectTarget).edges
  endpoints := by
    intro edge membership
    change edge ∈ ({(0, 1)} : Finset (Nat × Nat)) at membership
    simp at membership
    subst edge
    change 0 ∈ ({0, 1} : Finset Nat) ∧ 1 ∈ ({0, 1} : Finset Nat)
    simp

noncomputable def reconnectCondensation :=
  reconnectGraph.condensation

theorem reconnect_condensation_acyclic
    (component : reconnectGraph.SCC) :
    ¬ Cantilune.Projection.RankableDAG.Path
      reconnectCondensation component component :=
  reconnectGraph.condensation_acyclic component

theorem reconnect_edge_strict
    {source target : Nat}
    (edge : (source, target) ∈ reconnectGraph.edges) :
    source < target := by
  change (source, target) ∈ ({(0, 1)} : Finset (Nat × Nat)) at edge
  simp at edge
  omega

theorem target_success_in_all_views :
    (sourcePackage newSignature).lts.success reconnectTarget ∧
      (viewPackage .dag newSignature).lts.success reconnectTarget ∧
      (viewPackage .petri newSignature).lts.success reconnectTarget ∧
      (viewPackage .pi newSignature).lts.success reconnectTarget ∧
      (viewPackage .morphism newSignature).lts.success reconnectTarget := by
  simp [sourcePackage, sourceLTS, viewPackage, viewLTS, reconnectTarget]

theorem source_not_success_in_all_views :
    ¬ (sourcePackage newSignature).lts.success reconnectSource ∧
      ¬ (viewPackage .dag newSignature).lts.success reconnectSource ∧
      ¬ (viewPackage .petri newSignature).lts.success reconnectSource ∧
      ¬ (viewPackage .pi newSignature).lts.success reconnectSource ∧
      ¬ (viewPackage .morphism newSignature).lts.success reconnectSource := by
  simp [sourcePackage, sourceLTS, viewPackage, viewLTS, reconnectSource]

theorem reconnect_changes_graph :
    (configOf newSignature reconnectTarget).edges = {(0, 1)} ∧
      (configOf newSignature reconnectTarget).edges ≠
        (configOf newSignature reconnectSource).edges := by
  simp [reconnectTarget, reconnectSource, configOf, occurrence,
    Occurrence.target, applyRequest, request, baseConfig, pairConfig]

/-! ## The no-argument core witness -/

abbrev P1bSource :=
  Cantilune.Pi.Certificates.RequestAccept.sourceLTS

abbrev P1bTarget :=
  Cantilune.Pi.Late.structuralLateLTS

abbrev P1cSource :=
  Cantilune.Pi.P1cFullNativeRefinement.sourceLTS

abbrev P1cTarget :=
  Cantilune.Pi.P1cFullNativeRefinement.targetLTS

def p1bOccurrence :
    Cantilune.Theorems.CoreConformance.NativeOccurrence P1bSource where
  source := .requesting
  event := .establishSession
  target := .established
  native :=
    ⟨Cantilune.Pi.Certificates.RequestAccept.Step.establishSession, trivial⟩

def p1cOccurrence :
    Cantilune.Theorems.CoreConformance.NativeOccurrence P1cSource where
  source := .ready .instanceReconnect
  event := .execute .instanceReconnect
  target :=
    Cantilune.Pi.P1cFullNativeRefinement.afterFirst .instanceReconnect
  native :=
    ⟨Cantilune.Pi.P1cFullNativeRefinement.Step.execute .instanceReconnect,
      trivial⟩

/--
The substantive π view exposes the exact closed nominal representative
carried by `P1cAdmittedOperations.PiView`.  Runtime graph names remain in the
replay recipe and the registry metadata; the hidden π binders are the
canonical representative of the normative `.instanceReconnect` family.
-/
def reconnectPiStateRealization :
    State newSignature → Cantilune.Pi.Raw.Proc
  | (_, _, false) =>
      Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        .instanceReconnect
  | (_, _, true) =>
      Cantilune.Pi.P1cFullNativeRefinement.firstTarget
        .instanceReconnect

/-- Event realization used by the selected reconnect cell. -/
def reconnectPiEventRealization :
    Event newSignature → Cantilune.Pi.Raw.Action
  | .business _ =>
      Cantilune.Pi.P1cFullNativeRefinement.firstAction
        .instanceReconnect
  | .hold _ => .tau

def reconnectPiOperational :
    Cantilune.Theorems.CoreConformance.ProductPiOperationalSemantics
      (viewPackage .pi newSignature) where
  operation
    | .business _ =>
        Cantilune.Pi.P1cOperationRegistry.instanceReconnectOperation
    | .hold _ =>
        Cantilune.Pi.P1cOperationRegistry.instanceReconnectOperation
  fromPhase
    | .business _ => .requested
    | .hold _ => .completed
  toPhase
    | .business _ => .reconnected
    | .hold _ => .completed
  statePayload := reconnectPiStateRealization
  actionPayload := reconnectPiEventRealization

/-- The selected reconnect edge's exact fixed-epoch π/FMS alignment. -/
def reconnectPiFMSAlignment :
    Cantilune.Theorems.CoreConformance.ProductPiFMSAlignment
      (sourcePackage newSignature)
      (viewPackage .pi newSignature)
      (operationalProjection .pi newSignature)
      candidate where
  operational := reconnectPiOperational
  projectedNative := piEvidence.native
  realizesProjected := by
    apply
      Cantilune.Pi.P1cOperationRegistry.RegistryNativeStep.native
    exact
      Cantilune.Pi.P1cFullNativeRefinement.first_native
        .instanceReconnect
  source_to_family := by
    exact Cantilune.Pi.Late.Struct.refl _
  derivative_to_family := by
    exact
      Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha.refl _
  compiled :=
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.compiledCanonicalPointed
      .instanceReconnect
  actual :=
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.totalCompiledNormativeCommutation
      .instanceReconnect

/-- Raw realization of the independently supplied π admission occurrence. -/
def admissionPiOperational :
    Cantilune.Theorems.CoreConformance.ProductAdmissionPiOperationalSemantics
      fourCoherent.piSemantics where
  operation := fun _ =>
    Cantilune.Pi.P1cOperationRegistry.dynamicPartnerAdmissionOperation
  fromPhase := fun _ => .requested
  toPhase := fun _ => .admitted
  beforePayload := fun _ =>
    Cantilune.Pi.P1cFullNativeRefinement.readyProcess
      .dynamicPartnerAdmission
  afterPayload := fun _ =>
    Cantilune.Pi.P1cFullNativeRefinement.firstTarget
      .dynamicPartnerAdmission
  actionPayload := fun _ =>
    Cantilune.Pi.P1cFullNativeRefinement.firstAction
      .dynamicPartnerAdmission

/--
The exact signature admission, the exact projected π target occurrence, the
selected reconnect DPO event, and the actual recursive Agent form one seam.
-/
def admissionPiFMSAlignment :
    Cantilune.Theorems.CoreConformance.ProductAdmissionPiFMSAlignment
      admission sourceAdmissionSemantics sourceAdmissionOccurrence
      fourCoherent.piSemantics
      (operationalProjection .pi oldSignature)
      (operationalProjection .pi newSignature)
      fourCoherent.pi.admissionProjection
      candidate crossEpoch.connects reconnectPiFMSAlignment where
  operational := admissionPiOperational
  metadata :=
    { registry :=
        Cantilune.Theorems.CoreConformance.ProductPiOperationalSemantics.stableMetadataOfDPOEvent
          ((sourcePackage newSignature).eventRecord candidate.event).event
      tombstone := admission.tombstoneId
      registryVersion := rfl
      tombstoneExact := rfl }
  metadataRegistryExact := rfl
  admissionFamilyExact := by decide
  realizesTargetAdmission := by
    apply Cantilune.Pi.P1cOperationRegistry.RegistryNativeStep.native
    exact
      Cantilune.Pi.P1cFullNativeRefinement.first_native
        .dynamicPartnerAdmission
  source_to_family := Cantilune.Pi.Late.Struct.refl _
  derivative_to_business :=
    Cantilune.Pi.OpenSMCActionAlpha.DerivativeAlpha.refl _
  actual :=
    Cantilune.Pi.FMSActualAgentNormativeOperationalBridge.totalCompiledNormativeCommutation
      .dynamicPartnerAdmission
  actualEndpointSeam :=
    Cantilune.Pi.FMSActualAgentNormativeCommutation.dynamic_admission_target_eq_reconnect_source

def core :
    Cantilune.Theorems.CoreConformance.CoreConformancePackage
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      sourceFamily dagFamily petriFamily piFamily morphismFamily
      admission sourceAdmissionSemantics sourceAdmissionOccurrence
      fourCoherent kernel initial (1 : Real) qualified authorized candidate
      P1bSource P1bTarget P1cSource P1cTarget where
  crossEpoch := crossEpoch
  dagSemantic := dagSemantic
  petriSemantic := petriSemantic
  reconfigurablePetri := reconfigurablePetri
  p1b :=
    Cantilune.Pi.P1bNominalIncidenceClosure.pi_ra_certificate
  p1c :=
    Cantilune.Pi.P1cFullNativeRefinement.certificate
  p1bOccurrence := p1bOccurrence
  p1cOccurrence := p1cOccurrence
  piFMSAlignment := reconnectPiFMSAlignment
  admissionPiFMSAlignment := admissionPiFMSAlignment

theorem substantive_reference_consistency :
    Nonempty
      (Cantilune.Theorems.CoreConformance.CoreConformancePackage.Consistency
        core) :=
  Cantilune.Theorems.CoreConformance.CoreConformancePackage.four_projection_core_consistency
    core

theorem admission_connects_selected_rule_occurrence :
    sourceAdmissionOccurrence.afterState = candidate.before ∧
      candidate.before = reconnectSource ∧
      candidate.event = reconnectEvent ∧
      candidate.after = reconnectTarget := by
  exact ⟨crossEpoch.connects, rfl, rfl, rfl⟩

structure Package where
  generic :
    Cantilune.Theorems.CoreConformance.CoreConformancePackage
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      sourceFamily dagFamily petriFamily piFamily morphismFamily
      admission sourceAdmissionSemantics sourceAdmissionOccurrence
      fourCoherent kernel initial (1 : Real) qualified authorized candidate
      P1bSource P1bTarget P1cSource P1cTarget
  feedback :
    Cantilune.Feedback.AuthorizedFeedbackClosure.ReferenceClosure newSignature
  connectsSubstantiveOccurrence :
    sourceAdmissionOccurrence.afterState = candidate.before
  selectedProbability : kernel.probability reconnectSource reconnectTarget = 1
  selectedReplay :
    ((sourcePackage newSignature).eventRecord reconnectEvent).Replays
      ((sourcePackage newSignature).configOf reconnectSource)
      ((sourcePackage newSignature).configOf reconnectTarget)
  terminalFourView : (sourcePackage newSignature).lts.success reconnectTarget ∧
    (viewPackage .dag newSignature).lts.success reconnectTarget ∧
    (viewPackage .petri newSignature).lts.success reconnectTarget ∧
    (viewPackage .pi newSignature).lts.success reconnectTarget ∧
    (viewPackage .morphism newSignature).lts.success reconnectTarget

def package : Package where
  generic := core
  feedback :=
    Cantilune.Feedback.AuthorizedFeedbackClosure.referenceClosure newSignature
  connectsSubstantiveOccurrence := crossEpoch.connects
  selectedProbability := selected_kernel_edge
  selectedReplay := reconnectReplays
  terminalFourView := target_success_in_all_views

theorem package_nonempty : Nonempty Package :=
  ⟨package⟩

/--
The direct anti-vacuity conclusion.  Its fields expose the single connected
occurrence rather than merely asserting that the generic facade is inhabited.
-/
structure SubstantiveReferenceComplete : Prop where
  coreConsistency :
    Nonempty
      (Cantilune.Theorems.CoreConformance.CoreConformancePackage.Consistency
        core)
  admissionConnects :
    sourceAdmissionOccurrence.afterState = candidate.before
  graphChanges :
    (configOf newSignature reconnectTarget).edges ≠
      (configOf newSignature reconnectSource).edges
  rankStrict :
    (sourcePackage newSignature).ranking.rank reconnectTarget <
      (sourcePackage newSignature).ranking.rank reconnectSource
  sourceReplay :
    ((sourcePackage newSignature).eventRecord reconnectEvent).Replays
      ((sourcePackage newSignature).configOf reconnectSource)
      ((sourcePackage newSignature).configOf reconnectTarget)
  dagNative :
    (viewPackage .dag newSignature).lts.ObservableStep
      reconnectSource reconnectEvent reconnectTarget
  petriNative :
    (viewPackage .petri newSignature).lts.ObservableStep
      reconnectSource reconnectEvent reconnectTarget
  piNative :
    (viewPackage .pi newSignature).lts.ObservableStep
      reconnectSource reconnectEvent reconnectTarget
  morphismNative :
    (viewPackage .morphism newSignature).lts.ObservableStep
      reconnectSource reconnectEvent reconnectTarget
  dagReplay :
    ((viewPackage .dag newSignature).eventRecord reconnectEvent).Replays
      ((viewPackage .dag newSignature).configOf reconnectSource)
      ((viewPackage .dag newSignature).configOf reconnectTarget)
  petriReplay :
    ((viewPackage .petri newSignature).eventRecord reconnectEvent).Replays
      ((viewPackage .petri newSignature).configOf reconnectSource)
      ((viewPackage .petri newSignature).configOf reconnectTarget)
  piReplay :
    ((viewPackage .pi newSignature).eventRecord reconnectEvent).Replays
      ((viewPackage .pi newSignature).configOf reconnectSource)
      ((viewPackage .pi newSignature).configOf reconnectTarget)
  morphismReplay :
    ((viewPackage .morphism newSignature).eventRecord reconnectEvent).Replays
      ((viewPackage .morphism newSignature).configOf reconnectSource)
      ((viewPackage .morphism newSignature).configOf reconnectTarget)
  probabilityOne :
    kernel.probability reconnectSource reconnectTarget = 1
  selectedExactEvent :
    positiveLabelling.event
        (show 0 < kernel.probability reconnectSource reconnectTarget by
          rw [selected_kernel_edge]
          norm_num) =
      reconnectEvent
  condensationAcyclic :
    ∀ component : reconnectGraph.SCC,
      ¬ Cantilune.Projection.RankableDAG.Path
        reconnectCondensation component component
  terminalFiveView :
    (sourcePackage newSignature).lts.success reconnectTarget ∧
      (viewPackage .dag newSignature).lts.success reconnectTarget ∧
      (viewPackage .petri newSignature).lts.success reconnectTarget ∧
      (viewPackage .pi newSignature).lts.success reconnectTarget ∧
      (viewPackage .morphism newSignature).lts.success reconnectTarget
  feedbackClosed :
    Nonempty
      (Cantilune.Feedback.AuthorizedFeedbackClosure.ReferenceClosure
        newSignature)

theorem substantive_reference_complete :
    SubstantiveReferenceComplete where
  coreConsistency := substantive_reference_consistency
  admissionConnects := crossEpoch.connects
  graphChanges := reconnect_changes_graph.2
  rankStrict := by
    change 0 < 1
    omega
  sourceReplay := reconnectReplays
  dagNative := dagEvidence.native
  petriNative := petriEvidence.native
  piNative := piEvidence.native
  morphismNative := morphismEvidence.native
  dagReplay := dagEvidence.replay
  petriReplay := petriEvidence.replay
  piReplay := piEvidence.replay
  morphismReplay := morphismEvidence.replay
  probabilityOne := selected_kernel_edge
  selectedExactEvent := selected_event_is_reconnect
  condensationAcyclic := reconnect_condensation_acyclic
  terminalFiveView := target_success_in_all_views
  feedbackClosed :=
    Cantilune.Feedback.AuthorizedFeedbackClosure.referenceClosure_nonempty
      newSignature

end Cantilune.Theorems.SubstantiveReconnectConformance
