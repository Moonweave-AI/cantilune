import Cantilune.Pi.FMSCpoNondeterministicBoundedRepresentatives

/-!
# The all-source solution-set condition

This file completes the ordinary adjoint-functor-theorem construction for
the category of pointed continuous semilattices:

1. every generator factors through its omega-closed generated subalgebra;
2. that carrier has the source-dependent countable-closure bound;
3. it is reindexed into a support of one fixed `Type 0`;
4. all such supported structures and generators form an actual `Type 0`
   family.

Consequently the concrete carrier functor satisfies
`SolutionSetCondition.{0}` at every omega-CPO source.  Combined with the
already proved completeness and limit preservation, mathlib's general
adjoint functor theorem constructs an ordinary free/forgetful adjunction
and its ordinary monad.

This theorem is deliberately about the ordinary category.  It does not by
itself supply enriched hom-omega-CPO universal properties, commutative
Fubini maps, recursive domain equations, hiding, adequacy, definability, or
full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicCardinalClosure
open Cantilune.Pi.FMSCpoNondeterministicGeneratedSubalgebra
open Cantilune.Pi.FMSCpoNondeterministicGeneratedCardinality
open Cantilune.Pi.FMSCpoNondeterministicBoundedRepresentatives

namespace GeneratedPresentation

variable
    (source : ωCPO)
    (target : NDωCPO)
    (generator : source ⟶ NDωCPO.forget.obj target)

/-- Embed the generated carrier into the fixed source-dependent bound type. -/
def embedding :
    Generated.Carrier source target generator ↪
      Presentation.BoundType source := by
  apply Classical.choice
  apply
    (Cardinal.le_def
      (Generated.Carrier source target generator)
      (Presentation.BoundType source)).mp
  rw [Cardinal.mk_out]
  exact
    GeneratedSyntax.generatedCarrier_cardinal_le
      source target generator

/-- The image support of the chosen bounded embedding. -/
def support :
    Set (Presentation.BoundType source) :=
  Set.range (embedding source target generator)

/-- Equivalence from the generated carrier to its fixed bounded support. -/
def carrierEquiv :
    Generated.Carrier source target generator ≃
      support source target generator :=
  Equiv.ofInjective
    (embedding source target generator)
    (embedding source target generator).injective

/-- The generated subalgebra reindexed to the bounded support. -/
def computation :
    SmallComputation
      (support source target generator) :=
  SmallComputation.reindex
    (Generated.object source target generator)
    (carrierEquiv source target generator)

/-- The source generator transported to the bounded representative. -/
def boundedGenerator :
    source ⟶
      NDωCPO.forget.obj
        (SmallComputation.object
          (computation source target generator)) :=
  Generated.restrictedGenerator source target generator ≫
    NDωCPO.forget.map
      (SmallComputation.forwardHom
        (Generated.object source target generator)
        (carrierEquiv source target generator))

/-- The complete `Type 0` presentation selected for this generator. -/
def code : Presentation.Code source where
  support := support source target generator
  computation := computation source target generator
  generator := boundedGenerator source target generator

/--
The bounded representative maps back through the inverse reindexing
isomorphism and then includes into the original target.
-/
def factor :
    Presentation.object source (code source target generator) ⟶
      target :=
  SmallComputation.backwardHom
      (Generated.object source target generator)
      (carrierEquiv source target generator) ≫
    Generated.inclusionHom source target generator

/--
The bounded presentation factors the original generator exactly, not merely
up to observational equivalence.
-/
theorem factorization :
    (code source target generator).generator ≫
        NDωCPO.forget.map
          (factor source target generator) =
      generator := by
  apply ContinuousHom.ext
  intro value
  change
    ((carrierEquiv source target generator).symm
      ((carrierEquiv source target generator)
        ⟨generator value,
          Generated.generator_mem
            source target generator value⟩)).1 =
      generator value
  rw [Equiv.symm_apply_apply]

end GeneratedPresentation

namespace Global

/-- The actual small family of all bounded presentations at a source. -/
abbrev Index (source : ωCPO) : Type :=
  Presentation.Code source

/-- Decode an index as an actual nondeterministic computation object. -/
def object
    (source : ωCPO)
    (index : Index source) :
    NDωCPO :=
  Presentation.object source index

/-- The structured-arrow generator stored by a bounded presentation. -/
def generator
    (source : ωCPO)
    (index : Index source) :
    source ⟶ NDωCPO.forget.obj (object source index) :=
  index.generator

/--
Every arrow from `source` to an underlying nondeterministic computation
factors through one member of the fixed `Type 0` presentation family.
-/
theorem source_solutionSet
    (source : ωCPO) :
    ∀ (target : NDωCPO)
      (targetGenerator :
        source ⟶ NDωCPO.forget.obj target),
      ∃ (index : Index source)
        (factor : object source index ⟶ target),
        generator source index ≫
            NDωCPO.forget.map factor =
          targetGenerator := by
  intro target targetGenerator
  exact
    ⟨GeneratedPresentation.code
        source target targetGenerator,
      GeneratedPresentation.factor
        source target targetGenerator,
      GeneratedPresentation.factorization
        source target targetGenerator⟩

/--
The concrete carrier functor satisfies the genuine all-source
`SolutionSetCondition.{0}`.
-/
theorem carrier_solutionSetCondition :
    SolutionSetCondition.{0}
      SolutionSet.carrierFunctor := by
  intro source
  refine
    ⟨Index source,
      object source,
      generator source,
      ?_⟩
  intro target targetGenerator
  exact source_solutionSet source target targetGenerator

/-- The carrier functor is an ordinary right adjoint. -/
theorem carrier_isRightAdjoint :
    SolutionSet.carrierFunctor.IsRightAdjoint :=
  SolutionSet.carrierIsRightAdjointOfSolutionSet
    carrier_solutionSetCondition

/-- The all-source ordinary free pointed continuous-semilattice functor. -/
def freeFunctor : ωCPO ⥤ NDωCPO :=
  SolutionSet.freeFunctorOfSolutionSet
    carrier_solutionSetCondition

/-- The all-source ordinary free/forgetful adjunction. -/
def freeAdjunction :
    freeFunctor ⊣ SolutionSet.carrierFunctor :=
  SolutionSet.freeAdjunctionOfSolutionSet
    carrier_solutionSetCondition

/-- The ordinary monad induced by the all-source adjunction. -/
def ordinaryMonad : Monad ωCPO :=
  freeAdjunction.toMonad

end Global

end Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet
