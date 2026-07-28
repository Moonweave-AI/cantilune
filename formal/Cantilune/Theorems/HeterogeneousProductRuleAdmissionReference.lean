import Cantilune.Theorems.HeterogeneousProductRuleAdmission
import Cantilune.Pi.AdmissionCertificate

/-!
# A nonempty heterogeneous product-rule certificate

This module inhabits the complete generic certificate from
`HeterogeneousProductRuleAdmission` with a deliberately small reference
execution family.  It is an anti-vacuity theorem for the interface:

* signature admission is a genuinely heterogeneous `0 -> 1` transition;
* the admitted epoch contains a distinct internal business rewrite;
* all four fixed-epoch projections are identity projections with categorical
  state/rewrite realizations and cross-layer coherence;
* rank, resource/session policy, authorization, fairness, and a positive
  probability bridge are concrete values.

The construction is not a product implementation and its four identity views
are not production DAG, pre-net, pi, and morphism semantics.
-/

noncomputable section

namespace Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.ProductRuleAdmission
open Cantilune.Theorems.HeterogeneousProductRuleAdmission

namespace Reference

abbrev oldSignature :=
  Cantilune.Pi.AdmissionCertificate.ReferenceSignature.source

abbrev newSignature :=
  Cantilune.Pi.AdmissionCertificate.ReferenceSignature.target

abbrev admission :=
  Cantilune.Pi.AdmissionCertificate.ReferenceSignature.event

inductive State
  | legacy
  | ready
  | done
  deriving DecidableEq, Repr, Fintype

inductive Event
  | business
  deriving DecidableEq, Repr, Fintype

def BusinessEnabled (signature : FinSignature) : Prop :=
  2 ≤ Fintype.card signature.Gen

theorem businessEnabled_mono
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (enabled : BusinessEnabled source) :
    BusinessEnabled target := by
  exact
    enabled.trans
      (Fintype.card_le_of_injective extension.gen extension.gen.injective)

inductive NativeStep (signature : FinSignature) : State → Event → State → Prop
  | business (enabled : BusinessEnabled signature) :
      NativeStep signature .ready .business .done

def version : State → Nat
  | .legacy => 0
  | .ready | .done => 1

abbrev lts (signature : FinSignature) : ObservableLTS where
  State := State
  Event := Event
  stateSetoid := ObservableLTS.equalitySetoid State
  step := NativeStep signature
  observable := fun _ => True
  success := fun state => state = .done
  waiting := fun state => state = .legacy
  signatureVersion := version
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

def config (signature : FinSignature) : State → Config signature
  | .legacy =>
      { signatureVersion := 0
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
        tombstones := ∅ }
  | .ready =>
      { signatureVersion := 1
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
        tombstones := ∅ }
  | .done =>
      { signatureVersion := 1
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
        policyState := 1
        tombstones := ∅ }

theorem config_wellFormed (signature : FinSignature) (state : State) :
    (config signature state).WellFormed := by
  cases state <;> simp [Config.WellFormed, config]

theorem old_business_disabled : ¬ BusinessEnabled oldSignature := by
  change ¬(2 ≤ 1)
  omega

theorem new_business_enabled : BusinessEnabled newSignature := by
  change 2 ≤ 2
  omega

def validReplayRecipe {signature : FinSignature}
    (recipe : DPOEvent.ReplayRecipe signature) : Bool :=
  recipe.signatureVersion = 1 &&
    recipe.ruleId = 7100 &&
    recipe.complementTag = 7100 &&
    recipe.policyEvidence = [7100, 7101] &&
    recipe.kind = .internal

def validReplaySource (source : Config signature) : Bool :=
  source.signatureVersion = 1 &&
    source.policyState = 0

def replayKernel (signature : FinSignature) : DPOEvent.ReplayKernel signature where
  run := fun recipe source =>
    if validReplayRecipe recipe && validReplaySource source then
      some (config signature .done)
    else
      none

def event (signature : FinSignature) : DPOEvent signature where
  signatureVersion := 1
  ruleId := 7100
  source := config signature .ready
  target := config signature .done
  matchDomainSize := 0
  matchCodomainSize := 0
  matchEmbedding := Function.Embedding.refl (Fin 0)
  complementTag := 7100
  freshNames := ∅
  policyEvidence := [7100, 7101]
  externalEvidence := []
  kind := .internal
  sourceVersion := rfl
  targetVersion := rfl
  freshForSource := by simp [config]
  sourceWellFormed := config_wellFormed signature .ready
  targetWellFormed := config_wellFormed signature .done

def verifiedEvent (signature : FinSignature) :
    DPOEvent.Verified (replayKernel signature) where
  event := event signature
  replay_correct := by
    simp [replayKernel, validReplayRecipe, validReplaySource,
      DPOEvent.replayRecipe, event, config]

def wrongRuleRecipe (signature : FinSignature) :
    DPOEvent.ReplayRecipe signature :=
  { (event signature).replayRecipe with ruleId := 7101 }

theorem replay_rejects_wrong_rule (signature : FinSignature) :
    (replayKernel signature).run
        (wrongRuleRecipe signature) (config signature .ready) = none := by
  simp [replayKernel, wrongRuleRecipe, validReplayRecipe]

theorem replay_rejects_wrong_source (signature : FinSignature) :
    (replayKernel signature).run
        (event signature).replayRecipe (config signature .done) = none := by
  simp [replayKernel, validReplayRecipe, validReplaySource, event, config]

def package (signature : FinSignature) : ExecutionPackage signature where
  lts := lts signature
  configOf := config signature
  replayKernel := replayKernel signature
  eventRecord := fun _ => verifiedEvent signature
  eventEndpoints := by
    intro source eventLabel target step
    rcases step with ⟨native, _observable⟩
    cases native
    exact (verifiedEvent signature).replays_recorded
  stateVersion := by
    intro state
    cases state <;> rfl
  resourcesClear := fun _ => True
  sessionsQuiescent := fun _ => True
  deletionPermitted := fun _ => False
  deletion_requires_resources := by simp
  deletion_requires_quiescence := by simp
  ranking :=
    { internal := fun _ => True
      rank
        | .legacy => 2
        | .ready => 1
        | .done => 0
      epoch := version
      decreases := by
        intro source eventLabel target step _internal
        rcases step with ⟨native, _observable⟩
        cases native
        norm_num
      epoch_preserved := by
        intro source eventLabel target step _internal
        rcases step with ⟨native, _observable⟩
        cases native
        rfl }

theorem old_has_no_business_step
    {source target : State} :
    ¬ (package oldSignature).lts.ObservableStep
        source .business target := by
  intro step
  rcases step with ⟨native, _observable⟩
  cases native with
  | business enabled =>
      exact old_business_disabled enabled

theorem old_business_unavailable :
    ¬ (package oldSignature).lts.ObservableStep
        .ready .business .done :=
  old_has_no_business_step

theorem new_business_available :
    (package newSignature).lts.ObservableStep .ready .business .done :=
  ⟨NativeStep.business new_business_enabled, trivial⟩

theorem replayCoherent
    {source target : FinSignature}
    (extension : SignatureExtension source target) :
    DPOEvent.ReplayKernel.ReindexCoherent
      extension (replayKernel source) (replayKernel target) where
  run_reindex := by
    intro recipe sourceConfig
    simp only [replayKernel]
    rw [show
      validReplayRecipe (DPOEvent.ReplayRecipe.reindex extension recipe) =
        validReplayRecipe recipe by
          rfl]
    rw [show
      validReplaySource (Config.reindex extension sourceConfig) =
        validReplaySource sourceConfig by
          rfl]
    split <;> simp [config, Config.reindex]

def packageReindexing
    {source target : FinSignature}
    (extension : SignatureExtension source target) :
    ExecutionPackage.Reindexing extension (package source) (package target) where
  replayCoherent := replayCoherent extension
  mapState := id
  mapEvent := id
  mapStep := by
    intro before eventLabel after step
    rcases step with ⟨native, observable⟩
    cases native with
    | business enabled =>
        exact
          ⟨NativeStep.business
              (businessEnabled_mono extension enabled),
            observable⟩
  configOf_natural := by
    intro state
    cases state <;> rfl
  eventRecord_natural := by
    intro eventLabel
    cases eventLabel
    rfl

def executionFamily : ReindexableExecutionFamily where
  package := package
  reindex := packageReindexing
  state_identity := by simp [packageReindexing]
  event_identity := by simp [packageReindexing]
  state_composition := by simp [packageReindexing]
  event_composition := by simp [packageReindexing]

/-! ## A faithful arrow realization of the three runtime states -/

def stateType : State → Type
  | .legacy => Fin 0
  | .ready => Fin 1
  | .done => Fin 2

def stateArrow (state : State) : Arrow (Type 0) :=
  Arrow.mk (𝟙 (stateType state))

theorem state_eq_of_arrow_iso
    {source target : State}
    (iso : stateArrow source ≅ stateArrow target) :
    source = target := by
  have cardinality :
      Nat.card (stateType source) =
        Nat.card (stateType target) :=
    Nat.card_congr
      ((Arrow.leftFunc : Arrow (Type 0) ⥤ Type 0).mapIso iso).toEquiv
  cases source <;> cases target <;>
    simp_all [stateType]

theorem stateArrow_injective : Function.Injective stateArrow := by
  intro source target equality
  exact state_eq_of_arrow_iso (eqToIso equality)

def businessCell :
    Arrow.Hom (stateArrow .ready) (stateArrow .done) :=
  Arrow.homMk'
    (TypeCat.ofHom fun _ : Fin 1 => (0 : Fin 2))
    (TypeCat.ofHom fun _ : Fin 1 => (0 : Fin 2))
    (by rfl)

def nativeCell
    {signature : FinSignature}
    {source : State} {eventLabel : Event} {target : State}
    (native : NativeStep signature source eventLabel target) :
    Arrow.Hom (stateArrow source) (stateArrow target) := by
  cases native
  exact businessCell

abbrev realization (signature : FinSignature) :
    CategoricalLTSRealization (lts signature) (Type 0) where
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
  stepCell := fun step => nativeCell step.1
  recoverEvent := fun _ _ _ => some .business
  recover_step := by
    intro source eventLabel target step
    cases eventLabel
    rfl
  stepCell_congr := by
    intro source source' eventLabel target target'
      sourceEquiv targetEquiv step
    subst source'
    subst target'
    cases step.1
    rfl

abbrev identityStatic :
    StaticSMCProjectionCertificate (Type 0) (Type 0) where
  functor := 𝟭 (Type 0)
  braided := inferInstance

abbrev identityOperational (signature : FinSignature) :
    ProjectionCertificate (lts signature) (lts signature) where
  mapState := fun state => state
  mapEvent := fun eventLabel => eventLabel
  Lift := Eq
  lift_chosen := by simp
  map_equiv := by simp
  sound := by
    intro source eventLabel target step
    exact step
  reflect := by
    intro source eventLabel target step
    exact ⟨eventLabel, target, step, rfl,
      (lts signature).stateSetoid.iseqv.refl target⟩
  success_iff := by simp
  waiting_iff := by simp
  signatureVersion_preserved := by simp

theorem identity_mapArrow_obj_eq (arrow : Arrow (Type 0)) :
    (𝟭 (Type 0)).mapArrow.obj arrow = arrow := by
  apply Arrow.ext rfl rfl
  apply ConcreteCategory.hom_ext
  intro value
  rfl

def identityCrossLayer (signature : FinSignature) :
    StaticOperationalCoherence
      identityStatic
      (identityOperational signature)
      (realization signature) (realization signature) where
  stateIso := fun state =>
    eqToIso (identity_mapArrow_obj_eq (stateArrow state))
  step_cell_commutes := by
    intro source eventLabel target step
    have soundEquality :
        (identityOperational signature).sound step = step :=
      Subsingleton.elim _ _
    rw [soundEquality]
    apply Arrow.hom_ext
    · apply ConcreteCategory.hom_ext
      intro value
      rfl
    · apply ConcreteCategory.hom_ext
      intro value
      rfl

/-! ## Identity projection family and heterogeneous admission -/

def identityFamily :
    ProjectionFamilyOver (Type 0) (Type 0) executionFamily where
  target := executionFamily
  static := fun _ => identityStatic
  operational := fun signature => identityOperational signature
  resources := fun _ =>
    { sourceResourcesValid := fun _ => True
      targetResourcesValid := fun _ => True
      resources_iff := by simp }
  terminals := fun signature =>
    TerminalProjectionCompatibility.ofOperational
      (identityOperational signature)
  state_natural := by
    intro old new extension state
    rfl
  event_natural := by
    intro old new extension eventLabel
    rfl

inductive AdmissionStep :
    State → Unit → State → Prop
  | register : AdmissionStep .legacy () .ready

def admissionSemantics :
    HeterogeneousAdmissionLTS
      (universes :=
        Cantilune.Pi.AdmissionCertificate.ReferenceSignature.universes)
      (package oldSignature) (package newSignature) where
  Event := Unit
  eventOf := fun _ => ()
  step := AdmissionStep

theorem admissionReplay :
    AdmissionReplays
      (universes :=
        Cantilune.Pi.AdmissionCertificate.ReferenceSignature.universes)
      admission
      (config oldSignature .legacy)
      (config newSignature .ready) := by
  constructor
  · rfl
  · rfl

def admissionOccurrence :
    HeterogeneousPackageAdmission
      (package oldSignature) (package newSignature)
      admissionSemantics admission where
  beforeState := .legacy
  afterState := .ready
  native := AdmissionStep.register
  replays := admissionReplay

def identityAdmissionProjection :
    HeterogeneousAdmissionProjection
      (package oldSignature) (package newSignature)
      (package oldSignature) (package newSignature)
      admissionSemantics admissionSemantics admission admissionOccurrence
      (identityFamily.operational oldSignature)
      (identityFamily.operational newSignature) where
  targetOccurrence := admissionOccurrence
  mapAdmissionEvent := id
  event_commutes := rfl
  before_commutes := rfl
  after_commutes := rfl

def coherentIdentityAdmission :
    CoherentProjectionFamilyAdmission
      (Type 0) (Type 0) identityFamily.toProjectionFamily
      admission admissionSemantics admissionOccurrence admissionSemantics where
  sourceBeforeRealization := realization oldSignature
  targetBeforeRealization := realization oldSignature
  beforeCrossLayer := identityCrossLayer oldSignature
  sourceAfterRealization := realization newSignature
  targetAfterRealization := realization newSignature
  afterCrossLayer := identityCrossLayer newSignature
  admissionProjection := identityAdmissionProjection

def fourCoherent :
    FourCoherentFamilyAdmission
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      executionFamily
      identityFamily identityFamily identityFamily identityFamily
      admission admissionSemantics admissionOccurrence where
  dagSemantics := admissionSemantics
  dag := coherentIdentityAdmission
  petriSemantics := admissionSemantics
  petri := coherentIdentityAdmission
  piSemantics := admissionSemantics
  pi := coherentIdentityAdmission
  morphismSemantics := admissionSemantics
  morphism := coherentIdentityAdmission

/-! ## Fixed-epoch occurrence and concrete policy/probability obligations -/

theorem fixedPolicy (signature : FinSignature) :
    FixedEpochPolicyCompatibility
      (package signature) (package signature)
      (identityFamily.operational signature)
      (identityFamily.resources signature) where
  sourceResources := rfl
  targetResources := rfl
  sessions := by simp [package]
  deletion := by simp [package]

def qualified (_before : State) (_event : Event) (_after : State) : Prop :=
  True

def authorized (_before : State) (_event : Event) (_after : State) : Prop :=
  True

def fixedOccurrence :
    FourFixedEpochOccurrence
      (package newSignature)
      (package newSignature) (package newSignature)
      (package newSignature) (package newSignature)
      (identityFamily.operational newSignature)
      (identityFamily.operational newSignature)
      (identityFamily.operational newSignature)
      (identityFamily.operational newSignature)
      (identityFamily.resources newSignature)
      (identityFamily.resources newSignature)
      (identityFamily.resources newSignature)
      (identityFamily.resources newSignature)
      qualified authorized where
  before := .ready
  event := .business
  after := .done
  sourceStep := ⟨NativeStep.business new_business_enabled, trivial⟩
  rank :=
    { decreases_if_internal := by
        intro _internal
        change 0 < 1
        omega
      epoch_preserved_if_internal := by
        intro _internal
        rfl }
  dagPolicy := fixedPolicy newSignature
  petriPolicy := fixedPolicy newSignature
  piPolicy := fixedPolicy newSignature
  morphismPolicy := fixedPolicy newSignature
  sourceResourcesBefore := trivial
  sourceResourcesAfter := trivial
  sourceSessionsBefore := trivial
  sourceSessionsAfter := trivial
  qualified := trivial
  authorized := trivial

noncomputable def kernelProbability : State → State → Real
  | .legacy, .legacy => 1
  | .ready, .done => 1
  | .done, .done => 1
  | _, _ => 0

noncomputable def kernel :
    NativeMarkovKernel newSignature (package newSignature) State where
  stateEquiv := Equiv.refl State
  probability := kernelProbability
  probability_nonnegative := by
    intro source target
    cases source <;> cases target <;> norm_num [kernelProbability]
  row_sum := by
    intro source
    classical
    rw [show
      (Finset.univ : Finset State) =
        {State.legacy, State.ready, State.done} by decide]
    cases source <;> simp [kernelProbability]
  native_support_of_change := by
    intro source target positive different
    cases source <;> cases target <;>
      try { simp_all [kernelProbability] }
    exact
      ⟨.business,
        ⟨NativeStep.business new_business_enabled, trivial⟩⟩

noncomputable def initial : InitialDistribution State where
  probability
    | .ready => 1
    | .legacy | .done => 0
  probability_nonnegative := by
    intro state
    cases state <;> norm_num
  total := by
    rw [show
      (Finset.univ : Finset State) =
        {State.legacy, State.ready, State.done} by decide]
    simp

def stableWindow : StableFairWindow where
  signatureVersion := fun _ => 1
  observed := fun _ => True
  startEpoch := 0
  opportunityEpoch := id
  signature_stable := by simp
  opportunity_after_start := by simp
  opportunity_strictMono := strictMono_id
  opportunity_observed := by simp
  cofinal := by
    intro epoch _afterStart
    exact ⟨epoch, le_rfl⟩

noncomputable def progress :
    ProgressBridge kernel initial (1 : Real) where
  window := stableWindow
  stable
    | .legacy | .done => true
    | .ready => false
  epsilon_pos := by norm_num
  epsilon_le_one := by norm_num
  pointwise_progress := by
    intro state unstable
    cases state with
    | legacy => exact False.elim (unstable rfl)
    | ready =>
        change
          (1 : Real) ≤
            ∑ target ∈
              (Finset.univ.filter fun target : State =>
                (match target with
                  | .legacy | .done => true
                  | .ready => false) = true),
              kernelProbability .ready target
        rw [show
          (Finset.univ.filter fun target : State =>
            (match target with
              | .legacy | .done => true
              | .ready => false) = true) =
            {State.legacy, State.done} by decide]
        norm_num [kernelProbability]
    | done => exact False.elim (unstable rfl)

theorem stochastic_business_progress :
    kernel.probability .ready .done = 1 ∧
      progress.stable .ready = false ∧
      progress.stable .done = true ∧
      (package newSignature).lts.ObservableStep
        .ready .business .done := by
  exact
    ⟨rfl, rfl, rfl,
      ⟨NativeStep.business new_business_enabled, trivial⟩⟩

def probabilityObligations :
    ProbabilitySchedulingObligations
      (package newSignature) kernel initial (1 : Real) fixedOccurrence.rank where
  stableWindow := stableWindow
  progress := progress
  progressWindow := rfl
  positiveEpsilon := by norm_num
  epsilonAtMostOne := by norm_num
  scheduling :=
    RuleSchedulingEvidence.internal
      trivial
      (by
        change 0 < 1
        omega)
      rfl

def admissionQualified (_before : State) (_after : State) : Prop := True

def admissionAuthorized (_before : State) (_after : State) : Prop := True

theorem admissionPolicy :
    AdmissionBoundaryObligations
      (sourceSemantics := admissionSemantics)
      admissionOccurrence admissionQualified admissionAuthorized where
  resourcesBefore := trivial
  resourcesAfter := trivial
  sessionsBefore := trivial
  sessionsAfter := trivial
  qualified := trivial
  authorized := trivial

def certificate :
    Certificate
      (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
      executionFamily
      identityFamily identityFamily identityFamily identityFamily
      admission admissionSemantics admissionOccurrence
      kernel initial (1 : Real)
      qualified authorized admissionQualified admissionAuthorized where
  coherent := fourCoherent
  dagBeforePolicy := fixedPolicy oldSignature
  petriBeforePolicy := fixedPolicy oldSignature
  piBeforePolicy := fixedPolicy oldSignature
  morphismBeforePolicy := fixedPolicy oldSignature
  admissionPolicy := admissionPolicy
  occurrence := fixedOccurrence
  probability := probabilityObligations

theorem certificate_nonempty :
    Nonempty
      (Certificate
        (Type 0) (Type 0) (Type 0) (Type 0) (Type 0)
        executionFamily
        identityFamily identityFamily identityFamily identityFamily
        admission admissionSemantics admissionOccurrence
        kernel initial (1 : Real)
        qualified authorized admissionQualified admissionAuthorized) :=
  ⟨certificate⟩

theorem admitted_rule_has_four_native_steps :
    (package newSignature).lts.ObservableStep .ready .business .done ∧
      (package newSignature).lts.ObservableStep .ready .business .done ∧
      (package newSignature).lts.ObservableStep .ready .business .done ∧
      (package newSignature).lts.ObservableStep .ready .business .done :=
  certificate.occurrence_mapped_steps

end Reference

end Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference
