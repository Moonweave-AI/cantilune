import Cantilune.Core.CompleteProjection
import Cantilune.Core.Package

/-!
# Extension-indexed projection families

`CompleteProjectionCertificate` deliberately certifies one admission event.
This module adds the missing family layer and, independently, makes runtime
reindexing commute with complete DPO-event replay.

The replay laws are equations about executable kernels and verified event
records.  They are not caller-selected propositions.
-/

namespace Cantilune.Core

open CategoryTheory

universe v₁ v₂ u₁ u₂

namespace DPOEvent

namespace ReplayRecipe

/-- Reindex the signature phantom of an endpoint-free replay recipe. -/
def reindex {σ τ : FinSignature} (_ι : SignatureExtension σ τ)
    (recipe : ReplayRecipe σ) : ReplayRecipe τ where
  signatureVersion := recipe.signatureVersion
  ruleId := recipe.ruleId
  matchDomainSize := recipe.matchDomainSize
  matchCodomainSize := recipe.matchCodomainSize
  matchEmbedding := recipe.matchEmbedding
  complementTag := recipe.complementTag
  freshNames := recipe.freshNames
  policyEvidence := recipe.policyEvidence
  externalEvidence := recipe.externalEvidence
  kind := recipe.kind

@[simp] theorem reindex_refl {σ : FinSignature}
    (recipe : ReplayRecipe σ) :
    reindex (SignatureExtension.refl σ) recipe = recipe := by
  cases recipe
  rfl

@[simp] theorem reindex_trans {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ)
    (recipe : ReplayRecipe σ) :
    reindex (SignatureExtension.trans ι κ) recipe =
      reindex κ (reindex ι recipe) := by
  cases recipe
  rfl

end ReplayRecipe

/-- Reindex both recorded endpoints and retain the complete DPO witness data. -/
def reindex {σ τ : FinSignature} (ι : SignatureExtension σ τ)
    (event : DPOEvent σ) : DPOEvent τ where
  signatureVersion := event.signatureVersion
  ruleId := event.ruleId
  source := Config.reindex ι event.source
  target := Config.reindex ι event.target
  matchDomainSize := event.matchDomainSize
  matchCodomainSize := event.matchCodomainSize
  matchEmbedding := event.matchEmbedding
  complementTag := event.complementTag
  freshNames := event.freshNames
  policyEvidence := event.policyEvidence
  externalEvidence := event.externalEvidence
  kind := event.kind
  sourceVersion := event.sourceVersion
  targetVersion := event.targetVersion
  freshForSource := event.freshForSource
  sourceWellFormed := Config.wellFormed_reindex ι event.sourceWellFormed
  targetWellFormed := Config.wellFormed_reindex ι event.targetWellFormed

@[simp] theorem replayRecipe_reindex {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (event : DPOEvent σ) :
    (reindex ι event).replayRecipe =
      ReplayRecipe.reindex ι event.replayRecipe := rfl

@[simp] theorem reindex_refl {σ : FinSignature} (event : DPOEvent σ) :
    reindex (SignatureExtension.refl σ) event = event := by
  cases event
  simp [reindex]

@[simp] theorem reindex_trans {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ)
    (event : DPOEvent σ) :
    reindex (SignatureExtension.trans ι κ) event =
      reindex κ (reindex ι event) := by
  cases event
  simp [reindex]

namespace ReplayKernel

/--
Two replay kernels are coherent along a signature extension when running the
reindexed recipe on the reindexed source produces exactly the reindexed old
result.
-/
structure ReindexCoherent {σ τ : FinSignature}
    (ι : SignatureExtension σ τ)
    (source : ReplayKernel σ) (target : ReplayKernel τ) : Prop where
  run_reindex :
    ∀ recipe config,
      target.run (ReplayRecipe.reindex ι recipe) (Config.reindex ι config) =
        Option.map (Config.reindex ι) (source.run recipe config)

namespace ReindexCoherent

/-- Every replay kernel is coherent along the identity extension. -/
theorem refl {σ : FinSignature} (kernel : ReplayKernel σ) :
    ReindexCoherent (SignatureExtension.refl σ) kernel kernel where
  run_reindex := by
    intro recipe config
    cases result : kernel.run recipe config with
    | none => simp [result]
    | some target => simp [result]

/-- Executable replay coherence composes with signature extensions. -/
theorem trans {σ τ υ : FinSignature}
    {ι : SignatureExtension σ τ} {κ : SignatureExtension τ υ}
    {firstKernel : ReplayKernel σ}
    {middleKernel : ReplayKernel τ}
    {finalKernel : ReplayKernel υ}
    (first : ReindexCoherent ι firstKernel middleKernel)
    (second : ReindexCoherent κ middleKernel finalKernel) :
    ReindexCoherent
      (SignatureExtension.trans ι κ) firstKernel finalKernel where
  run_reindex := by
    intro recipe config
    rw [ReplayRecipe.reindex_trans, Config.reindex_trans]
    rw [second.run_reindex, first.run_reindex]
    cases result : firstKernel.run recipe config with
    | none => simp
    | some target => simp

end ReindexCoherent

end ReplayKernel

namespace Verified

/-- Transport a verified record through coherent executable replay kernels. -/
def reindex {σ τ : FinSignature}
    {ι : SignatureExtension σ τ}
    {sourceKernel : ReplayKernel σ}
    {targetKernel : ReplayKernel τ}
    (coherent :
      ReplayKernel.ReindexCoherent ι sourceKernel targetKernel)
    (record : Verified sourceKernel) : Verified targetKernel where
  event := DPOEvent.reindex ι record.event
  replay_correct := by
    change
      targetKernel.run
          (ReplayRecipe.reindex ι record.event.replayRecipe)
          (Config.reindex ι record.event.source) =
        some (Config.reindex ι record.event.target)
    rw [coherent.run_reindex, record.replay_correct]
    rfl

@[simp] theorem reindex_event {σ τ : FinSignature}
    {ι : SignatureExtension σ τ}
    {sourceKernel : ReplayKernel σ}
    {targetKernel : ReplayKernel τ}
    (coherent :
      ReplayKernel.ReindexCoherent ι sourceKernel targetKernel)
    (record : Verified sourceKernel) :
    (reindex coherent record).event = DPOEvent.reindex ι record.event := rfl

@[simp] theorem reindex_refl {σ : FinSignature}
    {kernel : ReplayKernel σ} (record : Verified kernel) :
    reindex (ReplayKernel.ReindexCoherent.refl kernel) record = record := by
  cases record
  simp [reindex]

/-- Verified replay commutes with reindexing of both endpoints. -/
theorem replays_reindex {σ τ : FinSignature}
    {ι : SignatureExtension σ τ}
    {sourceKernel : ReplayKernel σ}
    {targetKernel : ReplayKernel τ}
    (coherent :
      ReplayKernel.ReindexCoherent ι sourceKernel targetKernel)
    {record : Verified sourceKernel}
    {source target : Config σ}
    (replay : record.Replays source target) :
    (reindex coherent record).Replays
      (Config.reindex ι source) (Config.reindex ι target) := by
  constructor
  · exact congrArg (Config.reindex ι) replay.1
  · change
      targetKernel.run
          (ReplayRecipe.reindex ι record.event.replayRecipe)
          (Config.reindex ι source) =
        some (Config.reindex ι target)
    rw [coherent.run_reindex, replay.2]
    rfl

end Verified

end DPOEvent

namespace SignatureAdmissionEvent

/-- Two admission records are consecutive only at the same epoch boundary. -/
structure Composable
    {universes : ProjectionUniverses}
    {σ τ υ : FinSignature}
    (first :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (second :
      SignatureAdmissionEvent universes (source := τ) (target := υ)) : Prop where
  versionBoundary : first.toVersion = second.fromVersion

end SignatureAdmissionEvent

namespace ExecutionPackage

/--
A reindexing between execution packages.  The event-record law is an equality
of verified records, hence it fixes both the transported `DPOEvent` and the
kernel proof used to replay it.
-/
structure Reindexing {σ τ : FinSignature}
    (ι : SignatureExtension σ τ)
    (source : ExecutionPackage σ) (target : ExecutionPackage τ) where
  replayCoherent :
    DPOEvent.ReplayKernel.ReindexCoherent
      ι source.replayKernel target.replayKernel
  mapState : source.lts.State → target.lts.State
  mapEvent : source.lts.Event → target.lts.Event
  mapStep :
    ∀ {before event after},
      source.lts.ObservableStep before event after →
        target.lts.ObservableStep
          (mapState before) (mapEvent event) (mapState after)
  configOf_natural :
    ∀ state,
      target.configOf (mapState state) =
        Config.reindex ι (source.configOf state)
  eventRecord_natural :
    ∀ event,
      target.eventRecord (mapEvent event) =
        DPOEvent.Verified.reindex replayCoherent
          (source.eventRecord event)

namespace Reindexing

/-- Identity reindexing of an execution package. -/
def identity {σ : FinSignature} (package : ExecutionPackage σ) :
    Reindexing (SignatureExtension.refl σ) package package where
  replayCoherent := DPOEvent.ReplayKernel.ReindexCoherent.refl _
  mapState := id
  mapEvent := id
  mapStep := by
    intro before event after step
    exact step
  configOf_natural := by
    intro state
    simp
  eventRecord_natural := by
    intro event
    simp

/--
The target event record replays exactly the reindexed source endpoints.
This uses the executable kernel equation and the event-record naturality law,
not merely `target.eventEndpoints`.
-/
theorem eventRecord_replay_commutes {σ τ : FinSignature}
    {ι : SignatureExtension σ τ}
    {source : ExecutionPackage σ} {target : ExecutionPackage τ}
    (reindexing : Reindexing ι source target)
    {before : source.lts.State} {event : source.lts.Event}
    {after : source.lts.State}
    (step : source.lts.ObservableStep before event after) :
    (target.eventRecord (reindexing.mapEvent event)).Replays
      (Config.reindex ι (source.configOf before))
      (Config.reindex ι (source.configOf after)) := by
  rw [reindexing.eventRecord_natural]
  exact
    DPOEvent.Verified.replays_reindex reindexing.replayCoherent
      (source.eventEndpoints step)

/-- The same replay square expressed at the mapped runtime states. -/
theorem mapped_eventRecord_replays {σ τ : FinSignature}
    {ι : SignatureExtension σ τ}
    {source : ExecutionPackage σ} {target : ExecutionPackage τ}
    (reindexing : Reindexing ι source target)
    {before : source.lts.State} {event : source.lts.Event}
    {after : source.lts.State}
    (step : source.lts.ObservableStep before event after) :
    (target.eventRecord (reindexing.mapEvent event)).Replays
      (target.configOf (reindexing.mapState before))
      (target.configOf (reindexing.mapState after)) := by
  rw [reindexing.configOf_natural, reindexing.configOf_natural]
  exact reindexing.eventRecord_replay_commutes step

end Reindexing

end ExecutionPackage

/--
Execution packages indexed by every finite signature and functorial in
monotone signature extensions.

The identity and composition fields are equations on actual state and event
maps.  Consequently an implementation cannot satisfy them with an unrelated
proof-valued witness.
-/
structure ReindexableExecutionFamily where
  package : ∀ σ : FinSignature, ExecutionPackage σ
  reindex :
    ∀ {σ τ : FinSignature} (ι : SignatureExtension σ τ),
      ExecutionPackage.Reindexing ι (package σ) (package τ)
  state_identity :
    ∀ (σ : FinSignature) (state : (package σ).lts.State),
      (reindex (SignatureExtension.refl σ)).mapState state = state
  event_identity :
    ∀ (σ : FinSignature) (event : (package σ).lts.Event),
      (reindex (SignatureExtension.refl σ)).mapEvent event = event
  state_composition :
    ∀ {σ τ υ : FinSignature}
      (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ)
      (state : (package σ).lts.State),
      (reindex (SignatureExtension.trans ι κ)).mapState state =
        (reindex κ).mapState ((reindex ι).mapState state)
  event_composition :
    ∀ {σ τ υ : FinSignature}
      (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ)
      (event : (package σ).lts.Event),
      (reindex (SignatureExtension.trans ι κ)).mapEvent event =
        (reindex κ).mapEvent ((reindex ι).mapEvent event)

namespace ReindexableExecutionFamily

/--
A pure signature reindexing can never itself be the state transition of a
strict epoch-advancing admission.

`ExecutionPackage.Reindexing.configOf_natural` transports a configuration by
`Config.reindex`, which preserves its `signatureVersion`.  In contrast,
`AdmissionReplays` changes that version from `fromVersion` to the strictly
larger `toVersion`.  Consequently a native admission must be represented by
an additional heterogeneous transition; identifying it with `mapState` is
inconsistent with the existing interfaces.
-/
theorem pure_reindex_ne_admission_target
    (family : ReindexableExecutionFamily)
    {universes : ProjectionUniverses}
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature))
    (source : (family.package sourceSignature).lts.State)
    (target : (family.package targetSignature).lts.State)
    (sourceVersion :
      ((family.package sourceSignature).configOf source).signatureVersion =
        admission.fromVersion)
    (targetVersion :
      ((family.package targetSignature).configOf target).signatureVersion =
        admission.toVersion) :
    (family.reindex admission.extension).mapState source ≠ target := by
  intro stateEquality
  have configurationEquality :
      (family.package targetSignature).configOf target =
        Config.reindex admission.extension
          ((family.package sourceSignature).configOf source) := by
    rw [← stateEquality]
    exact
      (family.reindex admission.extension).configOf_natural source
  have versionPreserved :
      ((family.package targetSignature).configOf target).signatureVersion =
        ((family.package sourceSignature).configOf source).signatureVersion := by
    rw [configurationEquality]
    exact Config.reindex_signatureVersion _ _
  have impossible : admission.toVersion = admission.fromVersion := by
    calc
      admission.toVersion =
          ((family.package targetSignature).configOf target).signatureVersion :=
        targetVersion.symm
      _ =
          ((family.package sourceSignature).configOf source).signatureVersion :=
        versionPreserved
      _ = admission.fromVersion := sourceVersion
  exact (Nat.ne_of_gt admission.advancesEpoch) impossible

end ReindexableExecutionFamily

/--
An extension-indexed projection family between two executable semantics.
Operational projection is natural with respect to signature reindexing on
both states and events.
-/
structure ProjectionFamily
    (SourceCategory : Type u₁) [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (TargetCategory : Type u₂) [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory] where
  source : ReindexableExecutionFamily
  target : ReindexableExecutionFamily
  static :
    ∀ _σ : FinSignature,
      StaticSMCProjectionCertificate SourceCategory TargetCategory
  operational :
    ∀ σ : FinSignature,
      ProjectionCertificate (source.package σ).lts (target.package σ).lts
  resources :
    ∀ σ : FinSignature, ResourceProjectionCompatibility (operational σ)
  terminals :
    ∀ σ : FinSignature, TerminalProjectionCompatibility (operational σ)
  state_natural :
    ∀ {σ τ : FinSignature} (ι : SignatureExtension σ τ)
      (state : (source.package σ).lts.State),
      (operational τ).mapState ((source.reindex ι).mapState state) =
        (target.reindex ι).mapState ((operational σ).mapState state)
  event_natural :
    ∀ {σ τ : FinSignature} (ι : SignatureExtension σ τ)
      (event : (source.package σ).lts.Event),
      (operational τ).mapEvent ((source.reindex ι).mapEvent event) =
        (target.reindex ι).mapEvent ((operational σ).mapEvent event)

namespace ProjectionFamily

/-- The identity projection on any reindexable execution family. -/
def identity
    (C : Type u₁) [Category.{v₁} C]
    [MonoidalCategory C] [SymmetricCategory C]
    (family : ReindexableExecutionFamily) :
    ProjectionFamily C C where
  source := family
  target := family
  static := fun _ => StaticSMCProjectionCertificate.identity
  operational := fun σ =>
    ProjectionCertificate.identity (family.package σ).lts
  resources := fun σ =>
    { sourceResourcesValid := fun _ => True
      targetResourcesValid := fun _ => True
      resources_iff := by simp }
  terminals := fun σ =>
    TerminalProjectionCompatibility.ofOperational
      (ProjectionCertificate.identity (family.package σ).lts)
  state_natural := by
    intro σ τ ι state
    rfl
  event_natural := by
    intro σ τ ι event
    rfl

@[simp] theorem identity_mapState
    (C : Type u₁) [Category.{v₁} C]
    [MonoidalCategory C] [SymmetricCategory C]
    (family : ReindexableExecutionFamily)
    (σ : FinSignature) (state : (family.package σ).lts.State) :
    ((identity C family).operational σ).mapState state = state := rfl

@[simp] theorem identity_mapEvent
    (C : Type u₁) [Category.{v₁} C]
    [MonoidalCategory C] [SymmetricCategory C]
    (family : ReindexableExecutionFamily)
    (σ : FinSignature) (event : (family.package σ).lts.Event) :
    ((identity C family).operational σ).mapEvent event = event := rfl

/--
Consecutive admissions induce the same source-state reindexing as their
composed signature extension.
-/
theorem source_admission_reindex_composition
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (family : ProjectionFamily SourceCategory TargetCategory)
    {universes : ProjectionUniverses}
    {σ τ υ : FinSignature}
    (first :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (second :
      SignatureAdmissionEvent universes (source := τ) (target := υ))
    (_composable : SignatureAdmissionEvent.Composable first second)
    (state : (family.source.package σ).lts.State) :
    (family.source.reindex
      (SignatureExtension.trans first.extension second.extension)).mapState
        state =
      (family.source.reindex second.extension).mapState
        ((family.source.reindex first.extension).mapState state) :=
  family.source.state_composition first.extension second.extension state

/-- Target-state reindexing obeys the same admission composition law. -/
theorem target_admission_reindex_composition
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (family : ProjectionFamily SourceCategory TargetCategory)
    {universes : ProjectionUniverses}
    {σ τ υ : FinSignature}
    (first :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (second :
      SignatureAdmissionEvent universes (source := τ) (target := υ))
    (_composable : SignatureAdmissionEvent.Composable first second)
    (state : (family.target.package σ).lts.State) :
    (family.target.reindex
      (SignatureExtension.trans first.extension second.extension)).mapState
        state =
      (family.target.reindex second.extension).mapState
        ((family.target.reindex first.extension).mapState state) :=
  family.target.state_composition first.extension second.extension state

/-- Event reindexing also composes across consecutive admissions. -/
theorem source_admission_event_composition
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (family : ProjectionFamily SourceCategory TargetCategory)
    {universes : ProjectionUniverses}
    {σ τ υ : FinSignature}
    (first :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (second :
      SignatureAdmissionEvent universes (source := τ) (target := υ))
    (_composable : SignatureAdmissionEvent.Composable first second)
    (event : (family.source.package σ).lts.Event) :
    (family.source.reindex
      (SignatureExtension.trans first.extension second.extension)).mapEvent
        event =
      (family.source.reindex second.extension).mapEvent
        ((family.source.reindex first.extension).mapEvent event) :=
  family.source.event_composition first.extension second.extension event

/--
The projection square remains natural when two admissions are crossed at
once.  Both paths are reduced to the actual extension-composition laws.
-/
theorem admission_projection_state_coherent
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (family : ProjectionFamily SourceCategory TargetCategory)
    {universes : ProjectionUniverses}
    {σ τ υ : FinSignature}
    (first :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (second :
      SignatureAdmissionEvent universes (source := τ) (target := υ))
    (_composable : SignatureAdmissionEvent.Composable first second)
    (state : (family.source.package σ).lts.State) :
    (family.operational υ).mapState
        ((family.source.reindex second.extension).mapState
          ((family.source.reindex first.extension).mapState state)) =
      (family.target.reindex second.extension).mapState
        ((family.target.reindex first.extension).mapState
          ((family.operational σ).mapState state)) := by
  rw [← family.source.state_composition]
  rw [family.state_natural]
  rw [family.target.state_composition]

end ProjectionFamily

/--
The family form of `CompleteProjectionCertificate`: one shared static,
operational, resource, and terminal interpretation must handle every admission
in the declared index type.

The explicit nonempty `AdmissionIndex` prevents an empty-index witness from
being mistaken for a completed extension family.
-/
structure CompleteProjectionFamily
    (SourceCategory : Type u₁) [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (TargetCategory : Type u₂) [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (Source Target : ObservableLTS)
    (universes : ProjectionUniverses) where
  AdmissionIndex : Type
  admissionIndexNonempty : Nonempty AdmissionIndex
  sourceSignature : AdmissionIndex → FinSignature
  targetSignature : AdmissionIndex → FinSignature
  admission :
    ∀ index,
      SignatureAdmissionEvent universes
        (source := sourceSignature index) (target := targetSignature index)
  static :
    StaticSMCProjectionCertificate SourceCategory TargetCategory
  operational : ProjectionCertificate Source Target
  admissionCompatible :
    ∀ index, AdmissionProjectionCompatibility operational (admission index)
  resources : ResourceProjectionCompatibility operational
  terminals : TerminalProjectionCompatibility operational

namespace CompleteProjectionFamily

/-- Select one ordinary complete certificate from the indexed family. -/
def certificateAt
    {SourceCategory : Type u₁} [Category.{v₁} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type u₂} [Category.{v₂} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {Source Target : ObservableLTS} {universes : ProjectionUniverses}
    (family :
      CompleteProjectionFamily
        SourceCategory TargetCategory Source Target universes)
    (index : family.AdmissionIndex) :
    CompleteProjectionCertificate
      SourceCategory TargetCategory Source Target (family.admission index) where
  static := family.static
  operational := family.operational
  admissionCompatible := family.admissionCompatible index
  resources := family.resources
  terminals := family.terminals

/--
Identity operational projection lifts to an indexed complete family once the
native LTS supplies the concrete admission steps.  Those steps are data, not
an arbitrary proposition hidden by the constructor.
-/
def identity
    (C : Type u₁) [Category.{v₁} C]
    [MonoidalCategory C] [SymmetricCategory C]
    (lts : ObservableLTS) (universes : ProjectionUniverses)
    (AdmissionIndex : Type) (nonempty : Nonempty AdmissionIndex)
    (sourceSignature targetSignature : AdmissionIndex → FinSignature)
    (admission :
      ∀ index,
        SignatureAdmissionEvent universes
          (source := sourceSignature index) (target := targetSignature index))
    (compatible :
      ∀ index,
        AdmissionProjectionCompatibility
          (ProjectionCertificate.identity lts) (admission index))
    (resourcesValid : lts.State → Prop) :
    CompleteProjectionFamily C C lts lts universes where
  AdmissionIndex := AdmissionIndex
  admissionIndexNonempty := nonempty
  sourceSignature := sourceSignature
  targetSignature := targetSignature
  admission := admission
  static := StaticSMCProjectionCertificate.identity
  operational := ProjectionCertificate.identity lts
  admissionCompatible := compatible
  resources :=
    { sourceResourcesValid := resourcesValid
      targetResourcesValid := resourcesValid
      resources_iff := by simp [ProjectionCertificate.identity] }
  terminals :=
    TerminalProjectionCompatibility.ofOperational
      (ProjectionCertificate.identity lts)

end CompleteProjectionFamily

end Cantilune.Core
