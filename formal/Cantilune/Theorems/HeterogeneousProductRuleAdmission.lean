import Cantilune.Core.EpochSeparatedProjection
import Cantilune.Theorems.ProductRuleAdmission

/-!
# Heterogeneous product-rule admission

This is the constructive replacement for the deliberately uninhabited
fixed-signature admission record in `ProductRuleAdmission`.

The two kinds of transition remain separate:

* an ordinary product-rule occurrence lives inside the new, fixed-signature
  epoch and is projected by four ordinary `ProjectionCertificate`s;
* admission of the rule symbol crosses from the old signature to the new
  signature and is certified by `HeterogeneousPackageAdmission`,
  `CoherentProjectionFamilyAdmission`, and `FourTargetAdmissionBundle`.

No target transition, replay witness, static interpretation, rank argument,
resource policy, authorization decision, fairness window, or probability
lower bound is synthesized in this file.  A concrete product supplies all of
them as fields; the definitions below only assemble and expose those fields.

Verification status: the replacement interface is root-imported and has
passed the pinned Lean build and kernel-dependency audit in the current
working tree.  It remains uncommitted and independently unreviewed, and it
constructs no product-specific inhabitant.
-/

noncomputable section

namespace Cantilune.Theorems.HeterogeneousProductRuleAdmission

open CategoryTheory
open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.ProductRuleAdmission

universe u v

/--
An extension-indexed projection family with a definitionally shared source
execution family.

`ProjectionFamily` stores its source as a field.  Four unrelated values of
that structure therefore do not, by their types alone, share a source.  This
wrapper fixes the source as a parameter, so all four views below use the same
old and new source packages without equality casts or proof-irrelevant
identifications.
-/
structure ProjectionFamilyOver
    (SourceCategory TargetCategory : Type u)
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    (source : ReindexableExecutionFamily) where
  target : ReindexableExecutionFamily
  static :
    ∀ _signature : FinSignature,
      StaticSMCProjectionCertificate SourceCategory TargetCategory
  operational :
    ∀ signature : FinSignature,
      ProjectionCertificate
        (source.package signature).lts
        (target.package signature).lts
  resources :
    ∀ signature : FinSignature,
      ResourceProjectionCompatibility (operational signature)
  terminals :
    ∀ signature : FinSignature,
      TerminalProjectionCompatibility (operational signature)
  state_natural :
    ∀ {oldSignature newSignature : FinSignature}
      (extension : SignatureExtension oldSignature newSignature)
      (state : (source.package oldSignature).lts.State),
      (operational newSignature).mapState
          ((source.reindex extension).mapState state) =
        (target.reindex extension).mapState
          ((operational oldSignature).mapState state)
  event_natural :
    ∀ {oldSignature newSignature : FinSignature}
      (extension : SignatureExtension oldSignature newSignature)
      (event : (source.package oldSignature).lts.Event),
      (operational newSignature).mapEvent
          ((source.reindex extension).mapEvent event) =
        (target.reindex extension).mapEvent
          ((operational oldSignature).mapEvent event)

namespace ProjectionFamilyOver

/-- Forget only the fact that the source family was fixed as a parameter. -/
def toProjectionFamily
    {SourceCategory TargetCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {source : ReindexableExecutionFamily}
    (family :
      ProjectionFamilyOver SourceCategory TargetCategory source) :
    ProjectionFamily SourceCategory TargetCategory where
  source := source
  target := family.target
  static := family.static
  operational := family.operational
  resources := family.resources
  terminals := family.terminals
  state_natural := family.state_natural
  event_natural := family.event_natural

@[simp] theorem toProjectionFamily_source
    {SourceCategory TargetCategory : Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} TargetCategory]
    [MonoidalCategory TargetCategory] [SymmetricCategory TargetCategory]
    {source : ReindexableExecutionFamily}
    (family :
      ProjectionFamilyOver SourceCategory TargetCategory source) :
    family.toProjectionFamily.source = source :=
  rfl

end ProjectionFamilyOver

/--
Four coherent projection-family admissions over one shared source family and
one shared heterogeneous source occurrence.

Each view supplies its own target semantics and its own
`CoherentProjectionFamilyAdmission`.  In particular, the structure cannot
manufacture a native target admission from the fixed-epoch projection.
-/
structure FourCoherentFamilyAdmission
    (SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u)
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (source : ReindexableExecutionFamily)
    (dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source)
    (petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source)
    (piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source)
    (morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source)
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature))
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission) where
  dagSemantics :
    HeterogeneousAdmissionLTS
      (dagFamily.target.package oldSignature)
      (dagFamily.target.package newSignature)
  dag :
    CoherentProjectionFamilyAdmission
      SourceCategory DagCategory dagFamily.toProjectionFamily
      admission sourceSemantics sourceOccurrence dagSemantics

  petriSemantics :
    HeterogeneousAdmissionLTS
      (petriFamily.target.package oldSignature)
      (petriFamily.target.package newSignature)
  petri :
    CoherentProjectionFamilyAdmission
      SourceCategory PetriCategory petriFamily.toProjectionFamily
      admission sourceSemantics sourceOccurrence petriSemantics

  piSemantics :
    HeterogeneousAdmissionLTS
      (piFamily.target.package oldSignature)
      (piFamily.target.package newSignature)
  pi :
    CoherentProjectionFamilyAdmission
      SourceCategory PiCategory piFamily.toProjectionFamily
      admission sourceSemantics sourceOccurrence piSemantics

  morphismSemantics :
    HeterogeneousAdmissionLTS
      (morphismFamily.target.package oldSignature)
      (morphismFamily.target.package newSignature)
  morphism :
    CoherentProjectionFamilyAdmission
      SourceCategory MorphismCategory morphismFamily.toProjectionFamily
      admission sourceSemantics sourceOccurrence morphismSemantics

namespace FourCoherentFamilyAdmission

/--
Forget the static/cross-layer family fields and expose the exact operational
four-target boundary bundle.  Every native and replay field comes from the
four supplied coherent admissions.
-/
def toFourTargetAdmissionBundle
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    (coherent :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence) :
    FourTargetAdmissionBundle
      admission
      (source.package oldSignature)
      (source.package newSignature)
      sourceSemantics sourceOccurrence where
  dagBefore := dagFamily.target.package oldSignature
  dagAfter := dagFamily.target.package newSignature
  dagBeforeProjection := dagFamily.operational oldSignature
  dagAfterProjection := dagFamily.operational newSignature
  dagSemantics := coherent.dagSemantics
  dag := coherent.dag.admissionProjection
  petriBefore := petriFamily.target.package oldSignature
  petriAfter := petriFamily.target.package newSignature
  petriBeforeProjection := petriFamily.operational oldSignature
  petriAfterProjection := petriFamily.operational newSignature
  petriSemantics := coherent.petriSemantics
  petri := coherent.petri.admissionProjection
  piBefore := piFamily.target.package oldSignature
  piAfter := piFamily.target.package newSignature
  piBeforeProjection := piFamily.operational oldSignature
  piAfterProjection := piFamily.operational newSignature
  piSemantics := coherent.piSemantics
  pi := coherent.pi.admissionProjection
  morphismBefore := morphismFamily.target.package oldSignature
  morphismAfter := morphismFamily.target.package newSignature
  morphismBeforeProjection := morphismFamily.operational oldSignature
  morphismAfterProjection := morphismFamily.operational newSignature
  morphismSemantics := coherent.morphismSemantics
  morphism := coherent.morphism.admissionProjection

/-- Fixed-signature operational projections at any selected epoch. -/
def fixedFourProjection
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    (_coherent :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence)
    (signature : FinSignature) :
    FourProjectionCertificate (source.package signature).lts where
  dagLTS := (dagFamily.target.package signature).lts
  petriLTS := (petriFamily.target.package signature).lts
  piLTS := (piFamily.target.package signature).lts
  morphismLTS := (morphismFamily.target.package signature).lts
  dag := dagFamily.operational signature
  petri := petriFamily.operational signature
  pi := piFamily.operational signature
  morphism := morphismFamily.operational signature

end FourCoherentFamilyAdmission

/--
Anchoring of one fixed-epoch projection's abstract policy predicates to the
two concrete execution packages.

Resource preservation is already proved by `resources`; the equalities below
state that its predicates really are the packages' resource predicates.
Session and deletion policy are intentionally additional product evidence.
-/
structure FixedEpochPolicyCompatibility
    {signature : FinSignature}
    (source target : ExecutionPackage signature)
    (projection : ProjectionCertificate source.lts target.lts)
    (resources : ResourceProjectionCompatibility projection) : Prop where
  sourceResources :
    resources.sourceResourcesValid = source.resourcesClear
  targetResources :
    resources.targetResourcesValid = target.resourcesClear
  sessions :
    ∀ state,
      target.sessionsQuiescent (projection.mapState state) ↔
        source.sessionsQuiescent state
  deletion :
    ∀ state,
      target.deletionPermitted (projection.mapState state) ↔
        source.deletionPermitted state

namespace FixedEpochPolicyCompatibility

/-- Concrete resource validity is preserved and reflected by the view. -/
theorem resources_iff
    {signature : FinSignature}
    {source target : ExecutionPackage signature}
    {projection : ProjectionCertificate source.lts target.lts}
    {resources : ResourceProjectionCompatibility projection}
    (policy :
      FixedEpochPolicyCompatibility
        source target projection resources)
    (state : source.lts.State) :
    target.resourcesClear (projection.mapState state) ↔
      source.resourcesClear state := by
  rw [← policy.targetResources, resources.resources_iff,
    policy.sourceResources]

end FixedEpochPolicyCompatibility

/--
One actual rule occurrence in a fixed-signature epoch.

The only transition here is `sourceStep`; all four mapped native transitions
are consequences of the four supplied `ProjectionCertificate`s.  Rank,
resource/session endpoints, policy anchoring, qualification, and
authorization remain concrete-product obligations.
-/
structure FourFixedEpochOccurrence
    {signature : FinSignature}
    (source dag petri pi morphism : ExecutionPackage signature)
    (dagProjection : ProjectionCertificate source.lts dag.lts)
    (petriProjection : ProjectionCertificate source.lts petri.lts)
    (piProjection : ProjectionCertificate source.lts pi.lts)
    (morphismProjection :
      ProjectionCertificate source.lts morphism.lts)
    (dagResources : ResourceProjectionCompatibility dagProjection)
    (petriResources : ResourceProjectionCompatibility petriProjection)
    (piResources : ResourceProjectionCompatibility piProjection)
    (morphismResources :
      ResourceProjectionCompatibility morphismProjection)
    (RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop) where
  before : source.lts.State
  event : source.lts.Event
  after : source.lts.State
  sourceStep : source.lts.ObservableStep before event after
  rank :
    RuleRankEvidence source
      (before := before) (event := event) (after := after)

  dagPolicy :
    FixedEpochPolicyCompatibility
      source dag dagProjection dagResources
  petriPolicy :
    FixedEpochPolicyCompatibility
      source petri petriProjection petriResources
  piPolicy :
    FixedEpochPolicyCompatibility
      source pi piProjection piResources
  morphismPolicy :
    FixedEpochPolicyCompatibility
      source morphism morphismProjection morphismResources

  sourceResourcesBefore : source.resourcesClear before
  sourceResourcesAfter : source.resourcesClear after
  sourceSessionsBefore : source.sessionsQuiescent before
  sourceSessionsAfter : source.sessionsQuiescent after
  qualified : RuleQualified before event after
  authorized : RuleAuthorized before event after

namespace FourFixedEpochOccurrence

/-- The four target views all perform one native fixed-epoch step. -/
theorem mappedSteps
    {signature : FinSignature}
    {source dag petri pi morphism : ExecutionPackage signature}
    {dagProjection : ProjectionCertificate source.lts dag.lts}
    {petriProjection : ProjectionCertificate source.lts petri.lts}
    {piProjection : ProjectionCertificate source.lts pi.lts}
    {morphismProjection :
      ProjectionCertificate source.lts morphism.lts}
    {dagResources : ResourceProjectionCompatibility dagProjection}
    {petriResources : ResourceProjectionCompatibility petriProjection}
    {piResources : ResourceProjectionCompatibility piProjection}
    {morphismResources :
      ResourceProjectionCompatibility morphismProjection}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    (occurrence :
      FourFixedEpochOccurrence
        source dag petri pi morphism
        dagProjection petriProjection piProjection morphismProjection
        dagResources petriResources piResources morphismResources
        RuleQualified RuleAuthorized) :
    dag.lts.ObservableStep
        (dagProjection.mapState occurrence.before)
        (dagProjection.mapEvent occurrence.event)
        (dagProjection.mapState occurrence.after) ∧
      petri.lts.ObservableStep
        (petriProjection.mapState occurrence.before)
        (petriProjection.mapEvent occurrence.event)
        (petriProjection.mapState occurrence.after) ∧
      pi.lts.ObservableStep
        (piProjection.mapState occurrence.before)
        (piProjection.mapEvent occurrence.event)
        (piProjection.mapState occurrence.after) ∧
      morphism.lts.ObservableStep
        (morphismProjection.mapState occurrence.before)
        (morphismProjection.mapEvent occurrence.event)
        (morphismProjection.mapState occurrence.after) :=
  ⟨dagProjection.sound occurrence.sourceStep,
    petriProjection.sound occurrence.sourceStep,
    piProjection.sound occurrence.sourceStep,
    morphismProjection.sound occurrence.sourceStep⟩

/--
The Petri component is the product's native pre-net step.  It is not a
separate invented relation: it is exactly the Petri package's observable
transition obtained from the supplied projection certificate.
-/
theorem petriNative
    {signature : FinSignature}
    {source dag petri pi morphism : ExecutionPackage signature}
    {dagProjection : ProjectionCertificate source.lts dag.lts}
    {petriProjection : ProjectionCertificate source.lts petri.lts}
    {piProjection : ProjectionCertificate source.lts pi.lts}
    {morphismProjection :
      ProjectionCertificate source.lts morphism.lts}
    {dagResources : ResourceProjectionCompatibility dagProjection}
    {petriResources : ResourceProjectionCompatibility petriProjection}
    {piResources : ResourceProjectionCompatibility piProjection}
    {morphismResources :
      ResourceProjectionCompatibility morphismProjection}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    (occurrence :
      FourFixedEpochOccurrence
        source dag petri pi morphism
        dagProjection petriProjection piProjection morphismProjection
        dagResources petriResources piResources morphismResources
        RuleQualified RuleAuthorized) :
    petri.lts.ObservableStep
      (petriProjection.mapState occurrence.before)
      (petriProjection.mapEvent occurrence.event)
      (petriProjection.mapState occurrence.after) :=
  petriProjection.sound occurrence.sourceStep

/-- Both endpoints satisfy every target view's concrete resource policy. -/
theorem endpointResources
    {signature : FinSignature}
    {source dag petri pi morphism : ExecutionPackage signature}
    {dagProjection : ProjectionCertificate source.lts dag.lts}
    {petriProjection : ProjectionCertificate source.lts petri.lts}
    {piProjection : ProjectionCertificate source.lts pi.lts}
    {morphismProjection :
      ProjectionCertificate source.lts morphism.lts}
    {dagResources : ResourceProjectionCompatibility dagProjection}
    {petriResources : ResourceProjectionCompatibility petriProjection}
    {piResources : ResourceProjectionCompatibility piProjection}
    {morphismResources :
      ResourceProjectionCompatibility morphismProjection}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    (occurrence :
      FourFixedEpochOccurrence
        source dag petri pi morphism
        dagProjection petriProjection piProjection morphismProjection
        dagResources petriResources piResources morphismResources
        RuleQualified RuleAuthorized) :
    dag.resourcesClear (dagProjection.mapState occurrence.before) ∧
      petri.resourcesClear
        (petriProjection.mapState occurrence.before) ∧
      pi.resourcesClear (piProjection.mapState occurrence.before) ∧
      morphism.resourcesClear
        (morphismProjection.mapState occurrence.before) ∧
      dag.resourcesClear (dagProjection.mapState occurrence.after) ∧
      petri.resourcesClear
        (petriProjection.mapState occurrence.after) ∧
      pi.resourcesClear (piProjection.mapState occurrence.after) ∧
      morphism.resourcesClear
        (morphismProjection.mapState occurrence.after) :=
  ⟨(occurrence.dagPolicy.resources_iff occurrence.before).mpr
      occurrence.sourceResourcesBefore,
    (occurrence.petriPolicy.resources_iff occurrence.before).mpr
      occurrence.sourceResourcesBefore,
    (occurrence.piPolicy.resources_iff occurrence.before).mpr
      occurrence.sourceResourcesBefore,
    (occurrence.morphismPolicy.resources_iff occurrence.before).mpr
      occurrence.sourceResourcesBefore,
    (occurrence.dagPolicy.resources_iff occurrence.after).mpr
      occurrence.sourceResourcesAfter,
    (occurrence.petriPolicy.resources_iff occurrence.after).mpr
      occurrence.sourceResourcesAfter,
    (occurrence.piPolicy.resources_iff occurrence.after).mpr
      occurrence.sourceResourcesAfter,
    (occurrence.morphismPolicy.resources_iff occurrence.after).mpr
      occurrence.sourceResourcesAfter⟩

end FourFixedEpochOccurrence

/--
Probability and scheduling obligations for the concrete fixed-epoch
occurrence.

The stable window, fairness, and `ε` lower bound are fields.  They are not
consequences of boundedness, rank, or admission coherence.
-/
structure ProbabilitySchedulingObligations
    {signature : FinSignature}
    (package : ExecutionPackage signature)
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    (kernel : NativeMarkovKernel signature package KernelState)
    (initial : InitialDistribution KernelState)
    (epsilon : Real)
    {before : package.lts.State}
    {event : package.lts.Event}
    {after : package.lts.State}
    (rank :
      RuleRankEvidence package
        (before := before) (event := event) (after := after)) where
  stableWindow : StableFairWindow
  progress : ProgressBridge kernel initial epsilon
  progressWindow : progress.window = stableWindow
  positiveEpsilon : 0 < epsilon
  epsilonAtMostOne : epsilon ≤ 1
  scheduling :
    RuleSchedulingEvidence package kernel progress rank

/--
Product policy at the heterogeneous epoch boundary.  The native source step
and replay witness are already in `sourceOccurrence`; resource/session
quiescence and admission authorization remain product-specific.
-/
structure AdmissionBoundaryObligations
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter}
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission)
    (AdmissionQualified AdmissionAuthorized :
      sourceBefore.lts.State → sourceAfter.lts.State → Prop) : Prop where
  resourcesBefore :
    sourceBefore.resourcesClear sourceOccurrence.beforeState
  resourcesAfter :
    sourceAfter.resourcesClear sourceOccurrence.afterState
  sessionsBefore :
    sourceBefore.sessionsQuiescent sourceOccurrence.beforeState
  sessionsAfter :
    sourceAfter.sessionsQuiescent sourceOccurrence.afterState
  qualified :
    AdmissionQualified
      sourceOccurrence.beforeState sourceOccurrence.afterState
  authorized :
    AdmissionAuthorized
      sourceOccurrence.beforeState sourceOccurrence.afterState

/--
The complete, generally parameterized product execution-package certificate.

The record combines, but does not weaken, three independently supplied
layers:

1. four coherent heterogeneous admissions over one source occurrence;
2. one ordinary fixed-signature occurrence in the admitted signature; and
3. product policy/probability obligations.

There is no `CompleteProjectionCertificate` field because that record would
again conflate a strict epoch boundary with a fixed-signature source LTS.
-/
structure Certificate
    (SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u)
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (source : ReindexableExecutionFamily)
    (dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source)
    (petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source)
    (piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source)
    (morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source)
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature))
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission)
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    (kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState)
    (initial : InitialDistribution KernelState)
    (epsilon : Real)
    (RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop)
    (AdmissionQualified AdmissionAuthorized :
      (source.package oldSignature).lts.State →
        (source.package newSignature).lts.State → Prop) where
  coherent :
    FourCoherentFamilyAdmission
      SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
      source dagFamily petriFamily piFamily morphismFamily
      admission sourceSemantics sourceOccurrence

  /--
  Old-epoch package policy anchors.  The new-epoch anchors are fields of
  `occurrence`, so both sides of the boundary remain concrete.
  -/
  dagBeforePolicy :
    FixedEpochPolicyCompatibility
      (source.package oldSignature)
      (dagFamily.target.package oldSignature)
      (dagFamily.operational oldSignature)
      (dagFamily.resources oldSignature)
  petriBeforePolicy :
    FixedEpochPolicyCompatibility
      (source.package oldSignature)
      (petriFamily.target.package oldSignature)
      (petriFamily.operational oldSignature)
      (petriFamily.resources oldSignature)
  piBeforePolicy :
    FixedEpochPolicyCompatibility
      (source.package oldSignature)
      (piFamily.target.package oldSignature)
      (piFamily.operational oldSignature)
      (piFamily.resources oldSignature)
  morphismBeforePolicy :
    FixedEpochPolicyCompatibility
      (source.package oldSignature)
      (morphismFamily.target.package oldSignature)
      (morphismFamily.operational oldSignature)
      (morphismFamily.resources oldSignature)

  admissionPolicy :
    AdmissionBoundaryObligations
      sourceOccurrence AdmissionQualified AdmissionAuthorized

  occurrence :
    FourFixedEpochOccurrence
      (source.package newSignature)
      (dagFamily.target.package newSignature)
      (petriFamily.target.package newSignature)
      (piFamily.target.package newSignature)
      (morphismFamily.target.package newSignature)
      (dagFamily.operational newSignature)
      (petriFamily.operational newSignature)
      (piFamily.operational newSignature)
      (morphismFamily.operational newSignature)
      (dagFamily.resources newSignature)
      (petriFamily.resources newSignature)
      (piFamily.resources newSignature)
      (morphismFamily.resources newSignature)
      RuleQualified RuleAuthorized

  probability :
    ProbabilitySchedulingObligations
      (source.package newSignature) kernel initial epsilon occurrence.rank

namespace Certificate

/-- The independently native four-view epoch boundary. -/
def admissionBundle
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
    {AdmissionQualified AdmissionAuthorized :
      (source.package oldSignature).lts.State →
        (source.package newSignature).lts.State → Prop}
    (certificate :
      Certificate
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence
        kernel initial epsilon RuleQualified RuleAuthorized
        AdmissionQualified AdmissionAuthorized) :
    FourTargetAdmissionBundle
      admission
      (source.package oldSignature)
      (source.package newSignature)
      sourceSemantics sourceOccurrence :=
  certificate.coherent.toFourTargetAdmissionBundle

/-- The four fixed-signature projections used by the admitted occurrence. -/
def fixedProjections
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
    {AdmissionQualified AdmissionAuthorized :
      (source.package oldSignature).lts.State →
        (source.package newSignature).lts.State → Prop}
    (certificate :
      Certificate
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence
        kernel initial epsilon RuleQualified RuleAuthorized
        AdmissionQualified AdmissionAuthorized) :
    FourProjectionCertificate (source.package newSignature).lts :=
  certificate.coherent.fixedFourProjection newSignature

/--
Source theorem for fixed-epoch soundness of the concrete occurrence.
-/
theorem occurrence_mapped_steps
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {KernelState : Type*} [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
    {AdmissionQualified AdmissionAuthorized :
      (source.package oldSignature).lts.State →
        (source.package newSignature).lts.State → Prop}
    (certificate :
      Certificate
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence
        kernel initial epsilon RuleQualified RuleAuthorized
        AdmissionQualified AdmissionAuthorized) :
    let occurrence := certificate.occurrence
    let projections := certificate.fixedProjections
    projections.dagLTS.ObservableStep
        (projections.dag.mapState occurrence.before)
        (projections.dag.mapEvent occurrence.event)
        (projections.dag.mapState occurrence.after) ∧
      projections.petriLTS.ObservableStep
        (projections.petri.mapState occurrence.before)
        (projections.petri.mapEvent occurrence.event)
        (projections.petri.mapState occurrence.after) ∧
      projections.piLTS.ObservableStep
        (projections.pi.mapState occurrence.before)
        (projections.pi.mapEvent occurrence.event)
        (projections.pi.mapState occurrence.after) ∧
      projections.morphismLTS.ObservableStep
        (projections.morphism.mapState occurrence.before)
        (projections.morphism.mapEvent occurrence.event)
        (projections.morphism.mapState occurrence.after) := by
  exact certificate.occurrence.mappedSteps

end Certificate

end Cantilune.Theorems.HeterogeneousProductRuleAdmission
