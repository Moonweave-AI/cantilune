import Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference

/-!
# Parameterized product-rule proof bundles

This module is an admission gate for one product rule occurrence in an
already-admitted, fixed-signature epoch.  It does not define a product API and
does not invent any target semantics.  A candidate contains only its source
endpoints and event.  Admission requires a separate proof bundle containing:

* a native source occurrence and its replay record;
* internal-rank evidence;
* resource clearance and session quiescence at every projected endpoint;
* one native step, target replay, and full outgoing-step reflection theorem
  for each of the DAG, Petri, pi, and morphism projections;
* qualification and authorization; and
* a stable fair window, positive bounded epsilon, progress bridge, and rule
  scheduling evidence through `ProbabilitySchedulingObligations`.

The gate is intentionally downstream of
`HeterogeneousProductRuleAdmission.Certificate`: admitting a new signature
symbol still requires that heterogeneous certificate.  This file only closes
the generic fixed-epoch rule gate and must not be read as evidence for any of
the eight production packages.
-/

noncomputable section

namespace Cantilune.Theorems.ProductRuleProofBundle

open Cantilune.Core
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.ProductRuleAdmission
open Cantilune.Theorems.HeterogeneousProductRuleAdmission

universe u

/-- Endpoint data for a proposed rule, with no transition proof hidden in it. -/
structure Candidate
    {signature : FinSignature}
    (source : ExecutionPackage signature) where
  before : source.lts.State
  event : source.lts.Event
  after : source.lts.State

/-- The actual source transition and its deterministic replay record. -/
structure SourceOccurrenceEvidence
    {signature : FinSignature}
    (source : ExecutionPackage signature)
    (candidate : Candidate source) : Prop where
  native :
    source.lts.ObservableStep
      candidate.before candidate.event candidate.after
  replay :
    (source.eventRecord candidate.event).Replays
      (source.configOf candidate.before)
      (source.configOf candidate.after)

namespace SourceOccurrenceEvidence

/-- Obtain replay only from the package's recorded native event. -/
def ofNative
    {signature : FinSignature}
    {source : ExecutionPackage signature}
    {candidate : Candidate source}
    (native :
      source.lts.ObservableStep
        candidate.before candidate.event candidate.after) :
    SourceOccurrenceEvidence source candidate where
  native := native
  replay := source.eventEndpoints native

end SourceOccurrenceEvidence

/--
Per-view evidence for the proposed occurrence.

`reflect` is deliberately the complete reflection obligation for every native
target step leaving the mapped source state, not merely a proof about the
chosen forward image.  Thus the target transition domain cannot be defined
as a one-event image without separately proving exhaustiveness.
-/
structure ProjectionOccurrenceEvidence
    {signature : FinSignature}
    (source target : ExecutionPackage signature)
    (projection : ProjectionCertificate source.lts target.lts)
    (candidate : Candidate source) : Prop where
  native :
    target.lts.ObservableStep
      (projection.mapState candidate.before)
      (projection.mapEvent candidate.event)
      (projection.mapState candidate.after)
  reflect :
    ∀ {targetEvent targetState},
      target.lts.ObservableStep
          (projection.mapState candidate.before)
          targetEvent targetState →
        ∃ sourceEvent sourceState,
          source.lts.ObservableStep
              candidate.before sourceEvent sourceState ∧
            projection.Lift sourceEvent targetEvent ∧
            target.lts.stateSetoid.r
              targetState (projection.mapState sourceState)
  replay :
    (target.eventRecord (projection.mapEvent candidate.event)).Replays
      (target.configOf (projection.mapState candidate.before))
      (target.configOf (projection.mapState candidate.after))

namespace ProjectionOccurrenceEvidence

/--
Build a view cell from an independently supplied complete projection
certificate and an actual source step.
-/
def ofProjection
    {signature : FinSignature}
    {source target : ExecutionPackage signature}
    {projection : ProjectionCertificate source.lts target.lts}
    {candidate : Candidate source}
    (native :
      source.lts.ObservableStep
        candidate.before candidate.event candidate.after) :
    ProjectionOccurrenceEvidence source target projection candidate where
  native := projection.sound native
  reflect := by
    intro targetEvent targetState targetStep
    exact projection.reflect targetStep
  replay := target.eventEndpoints (projection.sound native)

end ProjectionOccurrenceEvidence

/--
Concrete resource and quiescence checks for the source and all four target
views.  These are endpoint facts, not default predicates supplied by the
generic gate.
-/
structure ResourceQuiescenceEvidence
    {signature : FinSignature}
    (source dag petri pi morphism : ExecutionPackage signature)
    (dagProjection : ProjectionCertificate source.lts dag.lts)
    (petriProjection : ProjectionCertificate source.lts petri.lts)
    (piProjection : ProjectionCertificate source.lts pi.lts)
    (morphismProjection :
      ProjectionCertificate source.lts morphism.lts)
    (candidate : Candidate source) : Prop where
  sourceResourcesBefore : source.resourcesClear candidate.before
  sourceResourcesAfter : source.resourcesClear candidate.after
  sourceSessionsBefore : source.sessionsQuiescent candidate.before
  sourceSessionsAfter : source.sessionsQuiescent candidate.after

  dagResourcesBefore :
    dag.resourcesClear (dagProjection.mapState candidate.before)
  dagResourcesAfter :
    dag.resourcesClear (dagProjection.mapState candidate.after)
  dagSessionsBefore :
    dag.sessionsQuiescent (dagProjection.mapState candidate.before)
  dagSessionsAfter :
    dag.sessionsQuiescent (dagProjection.mapState candidate.after)

  petriResourcesBefore :
    petri.resourcesClear (petriProjection.mapState candidate.before)
  petriResourcesAfter :
    petri.resourcesClear (petriProjection.mapState candidate.after)
  petriSessionsBefore :
    petri.sessionsQuiescent (petriProjection.mapState candidate.before)
  petriSessionsAfter :
    petri.sessionsQuiescent (petriProjection.mapState candidate.after)

  piResourcesBefore :
    pi.resourcesClear (piProjection.mapState candidate.before)
  piResourcesAfter :
    pi.resourcesClear (piProjection.mapState candidate.after)
  piSessionsBefore :
    pi.sessionsQuiescent (piProjection.mapState candidate.before)
  piSessionsAfter :
    pi.sessionsQuiescent (piProjection.mapState candidate.after)

  morphismResourcesBefore :
    morphism.resourcesClear
      (morphismProjection.mapState candidate.before)
  morphismResourcesAfter :
    morphism.resourcesClear
      (morphismProjection.mapState candidate.after)
  morphismSessionsBefore :
    morphism.sessionsQuiescent
      (morphismProjection.mapState candidate.before)
  morphismSessionsAfter :
    morphism.sessionsQuiescent
      (morphismProjection.mapState candidate.after)

/--
The complete proof-carrying fixed-epoch rule bundle.

Nothing in this record defines any of the five LTS transition relations; all
native and reflection fields are propositions about packages supplied as
parameters.
-/
structure ProductRuleProofBundle
    {signature : FinSignature}
    (source dag petri pi morphism : ExecutionPackage signature)
    (dagProjection : ProjectionCertificate source.lts dag.lts)
    (petriProjection : ProjectionCertificate source.lts petri.lts)
    (piProjection : ProjectionCertificate source.lts pi.lts)
    (morphismProjection :
      ProjectionCertificate source.lts morphism.lts)
    {KernelState : Type u} [Fintype KernelState] [DecidableEq KernelState]
    (kernel : NativeMarkovKernel signature source KernelState)
    (initial : InitialDistribution KernelState)
    (epsilon : Real)
    (RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop)
    (candidate : Candidate source) where
  sourceOccurrence : SourceOccurrenceEvidence source candidate
  rank :
    RuleRankEvidence source
      (before := candidate.before)
      (event := candidate.event)
      (after := candidate.after)
  resourceQuiescence :
    ResourceQuiescenceEvidence
      source dag petri pi morphism
      dagProjection petriProjection piProjection morphismProjection
      candidate

  dag :
    ProjectionOccurrenceEvidence source dag dagProjection candidate
  petri :
    ProjectionOccurrenceEvidence source petri petriProjection candidate
  pi :
    ProjectionOccurrenceEvidence source pi piProjection candidate
  morphism :
    ProjectionOccurrenceEvidence
      source morphism morphismProjection candidate

  qualified :
    RuleQualified candidate.before candidate.event candidate.after
  authorized :
    RuleAuthorized candidate.before candidate.event candidate.after

  probability :
    ProbabilitySchedulingObligations
      source kernel initial epsilon rank

/--
Names of independently required proof groups.  `Incomplete` submissions retain
the exact reason a rule was rejected without manufacturing a default proof.
-/
inductive RequiredProofField
  | sourceNativeAndReplay
  | rank
  | resourceQuiescence
  | dagNative
  | dagReflection
  | dagReplay
  | petriNative
  | petriReflection
  | petriReplay
  | piNative
  | piReflection
  | piReplay
  | morphismNative
  | morphismReflection
  | morphismReplay
  | qualification
  | authorization
  | stableWindow
  | fairness
  | epsilon
  deriving DecidableEq, Repr

/--
A submission is either complete proof data or an explicitly incomplete
attempt.  There is no permissive constructor and no boolean assertion that
can stand in for a proof bundle.
-/
inductive Submission
    {signature : FinSignature}
    (source dag petri pi morphism : ExecutionPackage signature)
    (dagProjection : ProjectionCertificate source.lts dag.lts)
    (petriProjection : ProjectionCertificate source.lts petri.lts)
    (piProjection : ProjectionCertificate source.lts pi.lts)
    (morphismProjection :
      ProjectionCertificate source.lts morphism.lts)
    {KernelState : Type u} [Fintype KernelState] [DecidableEq KernelState]
    (kernel : NativeMarkovKernel signature source KernelState)
    (initial : InitialDistribution KernelState)
    (epsilon : Real)
    (RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop)
    (candidate : Candidate source) where
  | complete
      (bundle :
        ProductRuleProofBundle
          source dag petri pi morphism
          dagProjection petriProjection piProjection morphismProjection
          kernel initial epsilon RuleQualified RuleAuthorized candidate)
  | incomplete (missing : RequiredProofField)

namespace Submission

/-- The only successful gate branch extracts an already complete bundle. -/
def runGate
    {signature : FinSignature}
    {source dag petri pi morphism : ExecutionPackage signature}
    {dagProjection : ProjectionCertificate source.lts dag.lts}
    {petriProjection : ProjectionCertificate source.lts petri.lts}
    {piProjection : ProjectionCertificate source.lts pi.lts}
    {morphismProjection :
      ProjectionCertificate source.lts morphism.lts}
    {KernelState : Type u} [Fintype KernelState] [DecidableEq KernelState]
    {kernel : NativeMarkovKernel signature source KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    {candidate : Candidate source}
    (submission :
      Submission
        source dag petri pi morphism
        dagProjection petriProjection piProjection morphismProjection
        kernel initial epsilon RuleQualified RuleAuthorized candidate) :
    Option
      (ProductRuleProofBundle
        source dag petri pi morphism
        dagProjection petriProjection piProjection morphismProjection
        kernel initial epsilon RuleQualified RuleAuthorized candidate) :=
  match submission with
  | .complete bundle => some bundle
  | .incomplete _ => none

/-- Successful admission is exactly successful extraction by the gate. -/
def Admitted
    {signature : FinSignature}
    {source dag petri pi morphism : ExecutionPackage signature}
    {dagProjection : ProjectionCertificate source.lts dag.lts}
    {petriProjection : ProjectionCertificate source.lts petri.lts}
    {piProjection : ProjectionCertificate source.lts pi.lts}
    {morphismProjection :
      ProjectionCertificate source.lts morphism.lts}
    {KernelState : Type u} [Fintype KernelState] [DecidableEq KernelState]
    {kernel : NativeMarkovKernel signature source KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    {candidate : Candidate source}
    (submission :
      Submission
        source dag petri pi morphism
        dagProjection petriProjection piProjection morphismProjection
        kernel initial epsilon RuleQualified RuleAuthorized candidate) :
    Prop :=
  submission.runGate ≠ none

@[simp]
theorem complete_admitted
    {signature : FinSignature}
    {source dag petri pi morphism : ExecutionPackage signature}
    {dagProjection : ProjectionCertificate source.lts dag.lts}
    {petriProjection : ProjectionCertificate source.lts petri.lts}
    {piProjection : ProjectionCertificate source.lts pi.lts}
    {morphismProjection :
      ProjectionCertificate source.lts morphism.lts}
    {KernelState : Type u} [Fintype KernelState] [DecidableEq KernelState]
    {kernel : NativeMarkovKernel signature source KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    {candidate : Candidate source}
    (bundle :
      ProductRuleProofBundle
        source dag petri pi morphism
        dagProjection petriProjection piProjection morphismProjection
        kernel initial epsilon RuleQualified RuleAuthorized candidate) :
    Admitted (.complete bundle) := by
  simp [Admitted, runGate]

/--
Kernel-level negative gate: naming any missing required field makes admission
impossible.  In particular, callers cannot replace a missing proof with an
unverified flag.
-/
@[simp]
theorem incomplete_rejected
    {signature : FinSignature}
    {source dag petri pi morphism : ExecutionPackage signature}
    {dagProjection : ProjectionCertificate source.lts dag.lts}
    {petriProjection : ProjectionCertificate source.lts petri.lts}
    {piProjection : ProjectionCertificate source.lts pi.lts}
    {morphismProjection :
      ProjectionCertificate source.lts morphism.lts}
    {KernelState : Type u} [Fintype KernelState] [DecidableEq KernelState]
    {kernel : NativeMarkovKernel signature source KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      source.lts.State → source.lts.Event → source.lts.State → Prop}
    {candidate : Candidate source}
    (missing : RequiredProofField) :
    ¬ Admitted
      (Submission.incomplete
        (source := source) (dag := dag) (petri := petri)
        (pi := pi) (morphism := morphism)
        (dagProjection := dagProjection)
        (petriProjection := petriProjection)
        (piProjection := piProjection)
        (morphismProjection := morphismProjection)
        (kernel := kernel) (initial := initial) (epsilon := epsilon)
        (RuleQualified := RuleQualified)
        (RuleAuthorized := RuleAuthorized)
        (candidate := candidate)
        missing) := by
  simp [Admitted, runGate]

end Submission

/-! ## Nonempty reference and a concrete negative gate -/

namespace GateReference

open Cantilune.Theorems.HeterogeneousProductRuleAdmissionReference.Reference

abbrev sourcePackage := package newSignature
abbrev targetPackage := package newSignature
abbrev identityProjection :=
  identityFamily.operational newSignature

def candidate : Candidate sourcePackage where
  before := .ready
  event := .business
  after := .done

theorem safety :
    ResourceQuiescenceEvidence
      sourcePackage
      targetPackage targetPackage targetPackage targetPackage
      identityProjection identityProjection
      identityProjection identityProjection
      candidate where
  sourceResourcesBefore := trivial
  sourceResourcesAfter := trivial
  sourceSessionsBefore := trivial
  sourceSessionsAfter := trivial
  dagResourcesBefore := trivial
  dagResourcesAfter := trivial
  dagSessionsBefore := trivial
  dagSessionsAfter := trivial
  petriResourcesBefore := trivial
  petriResourcesAfter := trivial
  petriSessionsBefore := trivial
  petriSessionsAfter := trivial
  piResourcesBefore := trivial
  piResourcesAfter := trivial
  piSessionsBefore := trivial
  piSessionsAfter := trivial
  morphismResourcesBefore := trivial
  morphismResourcesAfter := trivial
  morphismSessionsBefore := trivial
  morphismSessionsAfter := trivial

def bundle :
    ProductRuleProofBundle
      sourcePackage
      targetPackage targetPackage targetPackage targetPackage
      identityProjection identityProjection
      identityProjection identityProjection
      kernel initial (1 : Real)
      qualified authorized candidate where
  sourceOccurrence :=
    SourceOccurrenceEvidence.ofNative new_business_available
  rank := fixedOccurrence.rank
  resourceQuiescence := safety
  dag :=
    ProjectionOccurrenceEvidence.ofProjection
      new_business_available
  petri :=
    ProjectionOccurrenceEvidence.ofProjection
      new_business_available
  pi :=
    ProjectionOccurrenceEvidence.ofProjection
      new_business_available
  morphism :=
    ProjectionOccurrenceEvidence.ofProjection
      new_business_available
  qualified := trivial
  authorized := trivial
  probability := probabilityObligations

def submission :
    Submission
      sourcePackage
      targetPackage targetPackage targetPackage targetPackage
      identityProjection identityProjection
      identityProjection identityProjection
      kernel initial (1 : Real)
      qualified authorized candidate :=
  .complete bundle

/-- A nonempty reference passes because every proof group is inhabited. -/
theorem reference_admitted :
    submission.Admitted :=
  Submission.complete_admitted bundle

def missingRank :
    Submission
      sourcePackage
      targetPackage targetPackage targetPackage targetPackage
      identityProjection identityProjection
      identityProjection identityProjection
      kernel initial (1 : Real)
      qualified authorized candidate :=
  .incomplete .rank

/-- The same reference shape is rejected when its rank proof is absent. -/
theorem missing_rank_rejected :
    ¬ missingRank.Admitted := by
  exact Submission.incomplete_rejected .rank

end GateReference

end Cantilune.Theorems.ProductRuleProofBundle
