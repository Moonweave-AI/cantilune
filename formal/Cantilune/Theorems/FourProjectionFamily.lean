import Cantilune.Core.ProjectionFamily
import Cantilune.Theorems.FourProjection

/-!
# Four projections indexed by runtime signature extensions

`ProjectionFamily` makes one projection natural in monotone signature
extensions.  This module closes the corresponding four-view interface gap:
the DAG, Petri, pi, and morphism families are forced by type to share one
source execution family.

The theorem remains a composition theorem.  It does not manufacture any
production projection or turn a signature-admission boundary into a
fixed-signature `DPOEvent`.
-/

namespace Cantilune.Theorems

open CategoryTheory
open Cantilune.Core

universe vₛ vₜ uₛ uₜ

/--
One target family whose source execution family is fixed externally.  This
is the shared-source form of `Core.ProjectionFamily`.
-/
structure TargetProjectionFamily
    (SourceCategory : Type uₛ) [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (TargetCategory : Type uₜ) [Category.{vₜ} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (source : ReindexableExecutionFamily) where
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

namespace TargetProjectionFamily

variable
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {TargetCategory : Type uₜ} [Category.{vₜ} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {source : ReindexableExecutionFamily}

/-- Recover the ordinary one-target projection-family record. -/
def toProjectionFamily
    (family :
      TargetProjectionFamily SourceCategory TargetCategory source) :
    Cantilune.Core.ProjectionFamily SourceCategory TargetCategory where
  source := source
  target := family.target
  static := family.static
  operational := family.operational
  resources := family.resources
  terminals := family.terminals
  state_natural := family.state_natural
  event_natural := family.event_natural

/-- Regard an ordinary projection family as sharing its own source. -/
def ofProjectionFamily
    (family :
      Cantilune.Core.ProjectionFamily SourceCategory TargetCategory) :
    TargetProjectionFamily SourceCategory TargetCategory family.source where
  target := family.target
  static := family.static
  operational := family.operational
  resources := family.resources
  terminals := family.terminals
  state_natural := family.state_natural
  event_natural := family.event_natural

/-- Identity target family on a shared source. -/
def identity
    (C : Type uₛ) [Category.{vₛ} C]
    [MonoidalCategory C] [SymmetricCategory C]
    (family : ReindexableExecutionFamily) :
    TargetProjectionFamily C C family :=
  ofProjectionFamily (Cantilune.Core.ProjectionFamily.identity C family)

end TargetProjectionFamily

/--
Four signature-indexed projections sharing exactly one source execution
family.  The target packages and categories remain independent.
-/
structure FourProjectionFamilies
    (SourceCategory : Type uₛ) [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    (DagCategory PetriCategory PiCategory MorphismCategory : Type uₜ)
    [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    where
  source : ReindexableExecutionFamily
  dag : TargetProjectionFamily SourceCategory DagCategory source
  petri : TargetProjectionFamily SourceCategory PetriCategory source
  pi : TargetProjectionFamily SourceCategory PiCategory source
  morphism : TargetProjectionFamily SourceCategory MorphismCategory source

namespace FourProjectionFamilies

variable
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {DagCategory PetriCategory PiCategory MorphismCategory : Type uₜ}
    [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (families :
      FourProjectionFamilies
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory)

/-- At each signature, the family gives an ordinary shared-source bundle. -/
def certificateAt (σ : FinSignature) :
    FourProjectionCertificate (families.source.package σ).lts where
  dagLTS := (families.dag.target.package σ).lts
  petriLTS := (families.petri.target.package σ).lts
  piLTS := (families.pi.target.package σ).lts
  morphismLTS := (families.morphism.target.package σ).lts
  dag := families.dag.operational σ
  petri := families.petri.operational σ
  pi := families.pi.operational σ
  morphism := families.morphism.operational σ

/--
Path soundness/reflection, terminal classification, and epoch preservation
hold simultaneously at every runtime signature.
-/
theorem operational_consistency_at (σ : FinSignature) :
    (PathConsistency (families.certificateAt σ).dag ∧
      (∀ state, TerminalConsistency (families.certificateAt σ).dag state) ∧
      (∀ state,
        (families.certificateAt σ).dagLTS.signatureVersion
            ((families.certificateAt σ).dag.mapState state) =
          (families.source.package σ).lts.signatureVersion state)) ∧
    (PathConsistency (families.certificateAt σ).petri ∧
      (∀ state, TerminalConsistency (families.certificateAt σ).petri state) ∧
      (∀ state,
        (families.certificateAt σ).petriLTS.signatureVersion
            ((families.certificateAt σ).petri.mapState state) =
          (families.source.package σ).lts.signatureVersion state)) ∧
    (PathConsistency (families.certificateAt σ).pi ∧
      (∀ state, TerminalConsistency (families.certificateAt σ).pi state) ∧
      (∀ state,
        (families.certificateAt σ).piLTS.signatureVersion
            ((families.certificateAt σ).pi.mapState state) =
          (families.source.package σ).lts.signatureVersion state)) ∧
    (PathConsistency (families.certificateAt σ).morphism ∧
      (∀ state,
        TerminalConsistency (families.certificateAt σ).morphism state) ∧
      (∀ state,
        (families.certificateAt σ).morphismLTS.signatureVersion
            ((families.certificateAt σ).morphism.mapState state) =
          (families.source.package σ).lts.signatureVersion state)) :=
  four_projection_operational_consistency (families.certificateAt σ)

/--
Two composable admissions commute with all four projected state maps.  Each
component is the concrete state naturality equation of its target family.
-/
theorem admission_state_coherent_all
    {universes : ProjectionUniverses}
    {σ τ υ : FinSignature}
    (first :
      SignatureAdmissionEvent universes (source := σ) (target := τ))
    (second :
      SignatureAdmissionEvent universes (source := τ) (target := υ))
    (composable : SignatureAdmissionEvent.Composable first second)
    (state : (families.source.package σ).lts.State) :
    (families.dag.operational υ).mapState
        ((families.source.reindex second.extension).mapState
          ((families.source.reindex first.extension).mapState state)) =
      (families.dag.target.reindex second.extension).mapState
        ((families.dag.target.reindex first.extension).mapState
          ((families.dag.operational σ).mapState state)) ∧
    (families.petri.operational υ).mapState
        ((families.source.reindex second.extension).mapState
          ((families.source.reindex first.extension).mapState state)) =
      (families.petri.target.reindex second.extension).mapState
        ((families.petri.target.reindex first.extension).mapState
          ((families.petri.operational σ).mapState state)) ∧
    (families.pi.operational υ).mapState
        ((families.source.reindex second.extension).mapState
          ((families.source.reindex first.extension).mapState state)) =
      (families.pi.target.reindex second.extension).mapState
        ((families.pi.target.reindex first.extension).mapState
          ((families.pi.operational σ).mapState state)) ∧
    (families.morphism.operational υ).mapState
        ((families.source.reindex second.extension).mapState
          ((families.source.reindex first.extension).mapState state)) =
      (families.morphism.target.reindex second.extension).mapState
        ((families.morphism.target.reindex first.extension).mapState
          ((families.morphism.operational σ).mapState state)) := by
  exact
    ⟨families.dag.toProjectionFamily.admission_projection_state_coherent
        first second composable state,
      families.petri.toProjectionFamily.admission_projection_state_coherent
        first second composable state,
      families.pi.toProjectionFamily.admission_projection_state_coherent
        first second composable state,
      families.morphism.toProjectionFamily.admission_projection_state_coherent
        first second composable state⟩

/--
After a signature extension, every projected source step is still represented
by a target event record that replays its exact mapped configurations.
-/
theorem projected_event_replay_commutes_all
    {σ τ : FinSignature} (ι : SignatureExtension σ τ)
    {before : (families.source.package σ).lts.State}
    {event : (families.source.package σ).lts.Event}
    {after : (families.source.package σ).lts.State}
    (step : (families.source.package σ).lts.ObservableStep before event after) :
    ((families.dag.target.package τ).eventRecord
      ((families.dag.target.reindex ι).mapEvent
        ((families.dag.operational σ).mapEvent event))).Replays
      ((families.dag.target.package τ).configOf
        ((families.dag.target.reindex ι).mapState
          ((families.dag.operational σ).mapState before)))
      ((families.dag.target.package τ).configOf
        ((families.dag.target.reindex ι).mapState
          ((families.dag.operational σ).mapState after))) ∧
    ((families.petri.target.package τ).eventRecord
      ((families.petri.target.reindex ι).mapEvent
        ((families.petri.operational σ).mapEvent event))).Replays
      ((families.petri.target.package τ).configOf
        ((families.petri.target.reindex ι).mapState
          ((families.petri.operational σ).mapState before)))
      ((families.petri.target.package τ).configOf
        ((families.petri.target.reindex ι).mapState
          ((families.petri.operational σ).mapState after))) ∧
    ((families.pi.target.package τ).eventRecord
      ((families.pi.target.reindex ι).mapEvent
        ((families.pi.operational σ).mapEvent event))).Replays
      ((families.pi.target.package τ).configOf
        ((families.pi.target.reindex ι).mapState
          ((families.pi.operational σ).mapState before)))
      ((families.pi.target.package τ).configOf
        ((families.pi.target.reindex ι).mapState
          ((families.pi.operational σ).mapState after))) ∧
    ((families.morphism.target.package τ).eventRecord
      ((families.morphism.target.reindex ι).mapEvent
        ((families.morphism.operational σ).mapEvent event))).Replays
      ((families.morphism.target.package τ).configOf
        ((families.morphism.target.reindex ι).mapState
          ((families.morphism.operational σ).mapState before)))
      ((families.morphism.target.package τ).configOf
        ((families.morphism.target.reindex ι).mapState
          ((families.morphism.operational σ).mapState after))) := by
  have dagStep := (families.dag.operational σ).sound step
  have petriStep := (families.petri.operational σ).sound step
  have piStep := (families.pi.operational σ).sound step
  have morphismStep := (families.morphism.operational σ).sound step
  exact
    ⟨(families.dag.target.reindex ι).mapped_eventRecord_replays dagStep,
      (families.petri.target.reindex ι).mapped_eventRecord_replays petriStep,
      (families.pi.target.reindex ι).mapped_eventRecord_replays piStep,
      (families.morphism.target.reindex ι).mapped_eventRecord_replays
        morphismStep⟩

end FourProjectionFamilies

end Cantilune.Theorems
