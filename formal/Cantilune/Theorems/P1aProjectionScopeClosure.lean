import Cantilune.Pi.P1aBusinessProjectionCertificates
import Cantilune.Theorems.CoreConformance

/-!
# Exact P1a projection-scope aggregation

This module separates two facts that must not be conflated.

* A `CoreConformancePackage` is indexed by complete fixed-epoch DAG, Petri,
  and morphism `ProjectionCertificate`s.  `productOperational` packages those
  exact certificates and the theorem below exposes their path and terminal
  consequences.
* `fixedBusinessReference` is a separate nonempty reference calculus.  Its
  fourteen same-signature events have three independently declared target
  carriers and replayable source `DPOEvent`s.  It is not asserted to share a
  source state, occurrence, or target with an arbitrary product package.

Candidate-selected canonical-DAG and reconfigurable-Petri constructions live
in `TechnicalClosure`.  They are useful semantic sidecars for one selected
occurrence; they are not substitutes for the complete projections assembled
here.
-/

noncomputable section

namespace Cantilune.Theorems.P1aProjectionScopeClosure

open CategoryTheory
open Cantilune.Core
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Theorems.CoreConformance
open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Theorems.ProductRuleAdmission
open Cantilune.Theorems.ProductRuleProofBundle

universe u v w

/-- Terminal classification agreement for all three complete P1a views. -/
def TerminalCoverage
    {Source Dag Petri Morphism : ObservableLTS}
    (certificate :
      Cantilune.Projection.GeneralP1a.Certificate
        Source Dag Petri Morphism) : Prop :=
  ∀ state : Source.State,
    ((Dag.SuccessfulTermination (certificate.dag.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Dag.ExternalWait (certificate.dag.mapState state) ↔
        Source.ExternalWait state) ∧
      (Dag.Deadlocked (certificate.dag.mapState state) ↔
        Source.Deadlocked state)) ∧
    ((Petri.SuccessfulTermination (certificate.petri.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Petri.ExternalWait (certificate.petri.mapState state) ↔
        Source.ExternalWait state) ∧
      (Petri.Deadlocked (certificate.petri.mapState state) ↔
        Source.Deadlocked state)) ∧
    ((Morphism.SuccessfulTermination
          (certificate.morphism.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Morphism.ExternalWait (certificate.morphism.mapState state) ↔
        Source.ExternalWait state) ∧
      (Morphism.Deadlocked (certificate.morphism.mapState state) ↔
        Source.Deadlocked state))

/-- Path soundness and reflection for every complete P1a view. -/
def PathCoverage
    {Source Dag Petri Morphism : ObservableLTS}
    (certificate :
      Cantilune.Projection.GeneralP1a.Certificate
        Source Dag Petri Morphism) : Prop :=
  Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
      certificate.dag ∧
    Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
      certificate.petri ∧
    Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
      certificate.morphism

variable
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
    {signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence}
    {KernelState : Type w} [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
    {candidate : Candidate (source.package newSignature)}
    {P1bSource P1bTarget P1cSource P1cTarget : ObservableLTS}

variable
    (package :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        P1bSource P1bTarget P1cSource P1cTarget)

/--
The full fixed-epoch P1a operational certificate carried by a product.

This definition uses the package's indexed family certificates verbatim; it
does not derive a target from the selected source occurrence.
-/
def productOperational :
    Cantilune.Projection.GeneralP1a.Certificate
      (source.package newSignature).lts
      (dagFamily.target.package newSignature).lts
      (petriFamily.target.package newSignature).lts
      (morphismFamily.target.package newSignature).lts := by
  let _packageWitness := package
  exact
    { dag := dagFamily.operational newSignature
      petri := petriFamily.operational newSignature
      morphism := morphismFamily.operational newSignature }

/--
Exact product-wide P1a scope: the three complete projection certificates,
their generic path theorem, and their terminal-classification theorem.
-/
structure CompleteProductP1aProjectionScope where
  operational :
    Cantilune.Projection.GeneralP1a.Certificate
      (source.package newSignature).lts
      (dagFamily.target.package newSignature).lts
      (petriFamily.target.package newSignature).lts
      (morphismFamily.target.package newSignature).lts
  packageOperationalExact :
    operational = productOperational package
  dagExact :
    operational.dag = dagFamily.operational newSignature
  petriExact :
    operational.petri = petriFamily.operational newSignature
  morphismExact :
    operational.morphism = morphismFamily.operational newSignature
  paths : PathCoverage operational
  terminals : TerminalCoverage operational

/--
Every complete product package exposes the exact full P1a projections and
their path/terminal consequences.  No candidate-specific sidecar is used.
-/
def complete_product_p1a_projection_scope :
    CompleteProductP1aProjectionScope package where
  operational := productOperational package
  packageOperationalExact := rfl
  dagExact := rfl
  petriExact := rfl
  morphismExact := rfl
  paths :=
    (productOperational package).paths_lift_and_reflect_all
  terminals := fun state =>
    (productOperational package).terminals_all state

/-! ## Independent fixed-signature anti-vacuity witness -/

/-- A concrete finite signature used only by the reference P1a calculus. -/
def fixedReferenceSignature : FinSignature where
  Obj := PUnit
  Gen := Empty
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := Empty.elim
  output := Empty.elim
  mode := fun _ => .linear
  contract := Empty.elim

/--
The nonempty fourteen-event reference evidence.

The target types are the three separately declared `DAG.State`,
`Petri.State`, and `Morphism.State` carriers in
`P1aBusinessProjectionCertificates`.  This record deliberately makes no
type-inequality claim; independence is by their native declarations and
transition constructors, not by a cardinality argument.
-/
structure FixedSignatureReferenceP1aScope
    (σ : FinSignature) where
  replayable :
    Cantilune.Pi.P1aBusinessProjectionCertificates.ReplayableCertificate σ
  replayableExact :
    replayable =
      Cantilune.Pi.P1aBusinessProjectionCertificates.replayableCertificate σ
  eventCount :
    Fintype.card
        Cantilune.Pi.P1cBusinessReplayMatrix.BusinessEvent = 14
  paths :
    PathCoverage replayable.operational
  terminals :
    TerminalCoverage replayable.operational

/-- Concrete fixed-signature, fourteen-event, three-carrier reference. -/
def fixedBusinessReference :
    FixedSignatureReferenceP1aScope fixedReferenceSignature where
  replayable :=
    Cantilune.Pi.P1aBusinessProjectionCertificates.replayableCertificate
      fixedReferenceSignature
  replayableExact := rfl
  eventCount := by decide
  paths :=
    Cantilune.Pi.P1aBusinessProjectionCertificates.paths_lift_and_reflect_all
  terminals := fun state =>
    Cantilune.Pi.P1aBusinessProjectionCertificates.operational.terminals_all
      state

/-- Public anti-vacuity form, independent of every product package. -/
theorem fixed_business_reference_nonempty :
    Nonempty
      (FixedSignatureReferenceP1aScope fixedReferenceSignature) :=
  ⟨fixedBusinessReference⟩

end Cantilune.Theorems.P1aProjectionScopeClosure
