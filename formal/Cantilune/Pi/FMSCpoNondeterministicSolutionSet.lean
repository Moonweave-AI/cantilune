import Cantilune.Pi.FMSCpoNondeterministicNullary
import Cantilune.Pi.FMSExternalPackageObstruction
import Mathlib.CategoryTheory.Adjunction.AdjointFunctorTheorems
import Mathlib.CategoryTheory.Monad.Adjunction

/-!
# The exact solution-set boundary for the Abramsky powerdomain

`FMSCpoNondeterministicLimits` proves that the category of nondeterministic
omega-CPO computations is complete and that its carrier functor preserves
all small limits.  Consequently the general adjoint functor theorem reduces
existence of the *ordinary* free pointed continuous-semilattice functor to
one remaining condition: a small solution set.

This file makes that reduction exact:

* the carrier functor has a left adjoint iff it satisfies the solution-set
  condition;
* a solution set constructs an actual ordinary free functor, adjunction, and
  induced monad;
* every such free object separates divergence from deadlock;
* the empty omega-CPO has a concrete singleton solution set, represented by
  the separated two-point initial computation.

The global solution-set condition is deliberately not asserted.  Nor does an
ordinary adjunction construct Cpo-enrichment, Fubini maps, the recursive
domain equation, hiding, adequacy, or full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicSolutionSet

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSExternalPackageObstruction
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicNullary.NDωCPO

namespace SolutionSet

/-- Local short name for the actual category constructed in the category module. -/
abbrev Computation :=
  Cantilune.Pi.FMSCpoNondeterministicCategory.NDωCPO

/-- Local short name for the actual carrier functor whose limits were proved. -/
abbrev carrierFunctor : Computation ⥤ ωCPO :=
  Cantilune.Pi.FMSCpoNondeterministicLimits.NDωCPO.carrierFunctor

/-- Local short name for the mechanically constructed nullary free object. -/
abbrev nullaryObject : Computation :=
  Cantilune.Pi.FMSCpoNondeterministicNullary.NDωCPO.nullaryObject

/-! ## Exact general-adjoint-functor-theorem gate -/

/--
For the concrete carrier functor, the solution-set condition is not merely
sufficient but necessary for existence of an ordinary left adjoint.

The forward implication uses the explicitly constructed limits and their
preservation.  The reverse implication is the general necessary condition
for every right adjoint.
-/
theorem carrier_solutionSetCondition_iff_isRightAdjoint :
    SolutionSetCondition.{0} carrierFunctor ↔
      carrierFunctor.IsRightAdjoint := by
  constructor
  · intro solution
    exact
      isRightAdjoint_of_preservesLimits_of_solutionSetCondition
        carrierFunctor solution
  · intro rightAdjoint
    letI : carrierFunctor.IsRightAdjoint := rightAdjoint
    exact solutionSetCondition_of_isRightAdjoint carrierFunctor

/-- Right-adjoint evidence constructed by the general adjoint functor theorem. -/
theorem carrierIsRightAdjointOfSolutionSet
    (solution : SolutionSetCondition.{0} carrierFunctor) :
    carrierFunctor.IsRightAdjoint :=
  carrier_solutionSetCondition_iff_isRightAdjoint.mp solution

/-- The ordinary free nondeterministic-computation functor selected by AFT. -/
def freeFunctorOfSolutionSet
    (solution : SolutionSetCondition.{0} carrierFunctor) :
    ωCPO ⥤ Computation := by
  letI : carrierFunctor.IsRightAdjoint :=
    carrierIsRightAdjointOfSolutionSet solution
  exact carrierFunctor.leftAdjoint

/-- The actual ordinary free/forgetful adjunction selected by AFT. -/
def freeAdjunctionOfSolutionSet
    (solution : SolutionSetCondition.{0} carrierFunctor) :
    freeFunctorOfSolutionSet solution ⊣ carrierFunctor := by
  letI : carrierFunctor.IsRightAdjoint :=
    carrierIsRightAdjointOfSolutionSet solution
  exact Adjunction.ofIsRightAdjoint carrierFunctor

/-- The ordinary monad induced by the solution-set adjunction. -/
def ordinaryMonadOfSolutionSet
    (solution : SolutionSetCondition.{0} carrierFunctor) :
    Monad ωCPO :=
  (freeAdjunctionOfSolutionSet solution).toMonad

/-! ## The ordinary monad really carries the strict algebraic operations -/

/-- Divergence in the free computation selected by the solution set. -/
def ordinaryDivergence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    (ordinaryMonadOfSolutionSet solution).obj source :=
  ((freeFunctorOfSolutionSet solution).obj source).computation.divergence

/-- Deadlock in the free computation selected by the solution set. -/
def ordinaryDeadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    (ordinaryMonadOfSolutionSet solution).obj source :=
  ((freeFunctorOfSolutionSet solution).obj source).computation.deadlock

/-- Continuous idempotent choice in the selected free computation. -/
def ordinaryChoice
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    ωCPO.of
        ((ordinaryMonadOfSolutionSet solution).obj source ×
          (ordinaryMonadOfSolutionSet solution).obj source) ⟶
      (ordinaryMonadOfSolutionSet solution).obj source :=
  ((freeFunctorOfSolutionSet solution).obj source).computation.choice

/-- Functorial action of the induced ordinary monad is divergence-strict. -/
theorem ordinaryMap_divergence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (morphism : source ⟶ target) :
    (ordinaryMonadOfSolutionSet solution).map morphism
        (ordinaryDivergence solution source) =
      ordinaryDivergence solution target :=
  ((freeFunctorOfSolutionSet solution).map morphism).map_divergence

/-- Functorial action of the induced ordinary monad preserves deadlock. -/
theorem ordinaryMap_deadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (morphism : source ⟶ target) :
    (ordinaryMonadOfSolutionSet solution).map morphism
        (ordinaryDeadlock solution source) =
      ordinaryDeadlock solution target :=
  ((freeFunctorOfSolutionSet solution).map morphism).map_deadlock

/-- Functorial action of the induced ordinary monad preserves choice. -/
theorem ordinaryMap_choice
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (morphism : source ⟶ target)
    (left right :
      (ordinaryMonadOfSolutionSet solution).obj source) :
    (ordinaryMonadOfSolutionSet solution).map morphism
        (ordinaryChoice solution source (left, right)) =
      ordinaryChoice solution target
        ((ordinaryMonadOfSolutionSet solution).map morphism left,
          (ordinaryMonadOfSolutionSet solution).map morphism right) :=
  ((freeFunctorOfSolutionSet solution).map morphism).map_choice left right

/--
The induced monad multiplication is divergence-strict because it is the
carrier of the counit, which is an arrow in `Computation`.
-/
theorem ordinaryMultiplication_divergence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    (ordinaryMonadOfSolutionSet solution).μ.app source
        (ordinaryDivergence solution
          ((ordinaryMonadOfSolutionSet solution).obj source)) =
      ordinaryDivergence solution source :=
  ((freeAdjunctionOfSolutionSet solution).counit.app
    ((freeFunctorOfSolutionSet solution).obj source)).map_divergence

/-- The induced monad multiplication preserves deadlock. -/
theorem ordinaryMultiplication_deadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    (ordinaryMonadOfSolutionSet solution).μ.app source
        (ordinaryDeadlock solution
          ((ordinaryMonadOfSolutionSet solution).obj source)) =
      ordinaryDeadlock solution source :=
  ((freeAdjunctionOfSolutionSet solution).counit.app
    ((freeFunctorOfSolutionSet solution).obj source)).map_deadlock

/-- The induced monad multiplication preserves choice. -/
theorem ordinaryMultiplication_choice
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO)
    (left right :
      (ordinaryMonadOfSolutionSet solution).obj
        ((ordinaryMonadOfSolutionSet solution).obj source)) :
    (ordinaryMonadOfSolutionSet solution).μ.app source
        (ordinaryChoice solution
          ((ordinaryMonadOfSolutionSet solution).obj source)
          (left, right)) =
      ordinaryChoice solution source
        ((ordinaryMonadOfSolutionSet solution).μ.app source left,
          (ordinaryMonadOfSolutionSet solution).μ.app source right) :=
  ((freeAdjunctionOfSolutionSet solution).counit.app
    ((freeFunctorOfSolutionSet solution).obj source)).map_choice left right

/-! ## The ordinary free-extension universal property -/

/-- Bundle the raw acceptance-record algebra as an object of `Computation`. -/
def computationObject
    (target : NondeterministicComputation) :
    Computation where
  computation := target

/-- Extend a continuous generator to the carrier of the unique strict arrow. -/
def ordinaryFreeLift
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier) :
    (ordinaryMonadOfSolutionSet solution).obj source ⟶ target.carrier :=
  ((freeAdjunctionOfSolutionSet solution).homEquiv source
    (computationObject target)).symm generator |>.hom

/-- The ordinary free extension restricts to its generator along the unit. -/
theorem ordinaryFreeLift_unit
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier) :
    (ordinaryMonadOfSolutionSet solution).η.app source ≫
        ordinaryFreeLift solution source target generator =
      generator := by
  exact
    Equiv.apply_symm_apply
      ((freeAdjunctionOfSolutionSet solution).homEquiv source
        (computationObject target))
      generator

/-- The ordinary free extension preserves divergence. -/
theorem ordinaryFreeLift_divergence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier) :
    ordinaryFreeLift solution source target generator
        (ordinaryDivergence solution source) =
      target.divergence :=
  (((freeAdjunctionOfSolutionSet solution).homEquiv source
    (computationObject target)).symm generator).map_divergence

/-- The ordinary free extension preserves deadlock. -/
theorem ordinaryFreeLift_deadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier) :
    ordinaryFreeLift solution source target generator
        (ordinaryDeadlock solution source) =
      target.deadlock :=
  (((freeAdjunctionOfSolutionSet solution).homEquiv source
    (computationObject target)).symm generator).map_deadlock

/-- The ordinary free extension preserves binary choice. -/
theorem ordinaryFreeLift_choice
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier)
    (left right : (ordinaryMonadOfSolutionSet solution).obj source) :
    ordinaryFreeLift solution source target generator
        (ordinaryChoice solution source (left, right)) =
      target.choice
        (ordinaryFreeLift solution source target generator left,
          ordinaryFreeLift solution source target generator right) :=
  (((freeAdjunctionOfSolutionSet solution).homEquiv source
    (computationObject target)).symm generator).map_choice left right

/--
Any continuous map that restricts to the generator and preserves all three
distinguished operations is the ordinary free extension.
-/
theorem ordinaryFreeLift_unique
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier)
    (candidate :
      (ordinaryMonadOfSolutionSet solution).obj source ⟶ target.carrier)
    (restricts :
      (ordinaryMonadOfSolutionSet solution).η.app source ≫ candidate =
        generator)
    (mapsDivergence :
      candidate (ordinaryDivergence solution source) =
        target.divergence)
    (mapsDeadlock :
      candidate (ordinaryDeadlock solution source) =
        target.deadlock)
    (mapsChoice :
      ∀ left right,
        candidate (ordinaryChoice solution source (left, right)) =
          target.choice
            (candidate left, candidate right)) :
    candidate = ordinaryFreeLift solution source target generator := by
  let candidateArrow :
      (freeFunctorOfSolutionSet solution).obj source ⟶
        computationObject target :=
    { hom := candidate
      map_divergence := mapsDivergence
      map_deadlock := mapsDeadlock
      map_choice := mapsChoice }
  have represented :
      (freeAdjunctionOfSolutionSet solution).homEquiv source
          (computationObject target)
          candidateArrow =
        generator := by
    exact restricts
  have arrowEquality :
      candidateArrow =
        ((freeAdjunctionOfSolutionSet solution).homEquiv source
          (computationObject target)).symm generator := by
    apply
      ((freeAdjunctionOfSolutionSet solution).homEquiv source
        (computationObject target)).injective
    rw [represented, Equiv.apply_symm_apply]
  exact congrArg (fun arrow => arrow.hom) arrowEquality

/--
The ordinary solution-set free object separates its two nullary
computations.  This local formulation is used below before the more general
adjunction theorem is stated.
-/
theorem ordinaryDivergence_ne_deadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    ordinaryDivergence solution source ≠
      ordinaryDeadlock solution source := by
  intro collapsed
  let strictArrow :
      (freeFunctorOfSolutionSet solution).obj source ⟶ nullaryObject :=
    ((freeAdjunctionOfSolutionSet solution).homEquiv source
      nullaryObject).symm
        (ContinuousHom.const nullaryObject.computation.divergence)
  have mapped :=
    congrArg (fun value => strictArrow.hom value) collapsed
  change
    strictArrow.hom
        ((freeFunctorOfSolutionSet solution).obj source).computation.divergence =
      strictArrow.hom
        ((freeFunctorOfSolutionSet solution).obj source).computation.deadlock
    at mapped
  rw [strictArrow.map_divergence, strictArrow.map_deadlock] at mapped
  exact nullary_divergence_ne_deadlock mapped

/-! ## Exact remaining data for the current powerdomain acceptance record -/

/--
The ordinary adjunction does not choose a commutative Fubini map.  This
record isolates exactly that additional data required by the current
`CpoPowerdomainPackage` interface.

It is an explicit premise, not an inhabitant constructed in this file.
-/
structure OrdinaryFubiniWitness
    (solution : SolutionSetCondition.{0} carrierFunctor) where
  fubini :
    ∀ (left right : ωCPO),
      ((ordinaryMonadOfSolutionSet solution).obj left ⨯
          (ordinaryMonadOfSolutionSet solution).obj right) ⟶
        (ordinaryMonadOfSolutionSet solution).obj (left ⨯ right)
  natural :
    ∀ {left left' right right' : ωCPO}
      (leftMap : left ⟶ left') (rightMap : right ⟶ right'),
      Limits.prod.map
          ((ordinaryMonadOfSolutionSet solution).map leftMap)
          ((ordinaryMonadOfSolutionSet solution).map rightMap) ≫
          fubini left' right' =
        fubini left right ≫
          (ordinaryMonadOfSolutionSet solution).map
            (Limits.prod.map leftMap rightMap)
  unit :
    ∀ (left right : ωCPO),
      Limits.prod.map
          ((ordinaryMonadOfSolutionSet solution).η.app left)
          ((ordinaryMonadOfSolutionSet solution).η.app right) ≫
          fubini left right =
        (ordinaryMonadOfSolutionSet solution).η.app (left ⨯ right)
  commutes :
    ∀ (left right : ωCPO),
      (Limits.prod.braiding
          ((ordinaryMonadOfSolutionSet solution).obj left)
          ((ordinaryMonadOfSolutionSet solution).obj right)).hom ≫
          fubini right left =
        fubini left right ≫
          (ordinaryMonadOfSolutionSet solution).map
            (Limits.prod.braiding left right).hom

/--
A global solution set plus an explicit Fubini witness constructs the current
ordinary `CpoPowerdomainPackage` record.

This theorem closes every ordinary algebraic field of that record from the
adjunction.  It does not construct the Fubini witness and does not imply the
separate enriched, strong-coherence, recursive-domain, or full-abstraction
acceptance records.
-/
def powerdomainPackageOfSolutionSet
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (fubini : OrdinaryFubiniWitness solution) :
    CpoPowerdomainPackage where
  monad := ordinaryMonadOfSolutionSet solution
  divergence := ordinaryDivergence solution
  divergence_le := by
    intro source value
    exact
      ((freeFunctorOfSolutionSet solution).obj source).computation.divergence_le
        value
  empty := ordinaryDeadlock solution
  divergence_ne_empty :=
    ordinaryDivergence_ne_deadlock solution
  choice := ordinaryChoice solution
  choice_assoc := by
    intro source left middle right
    exact
      ((freeFunctorOfSolutionSet solution).obj source).computation.choice_assoc
        left middle right
  choice_comm := by
    intro source left right
    exact
      ((freeFunctorOfSolutionSet solution).obj source).computation.choice_comm
        left right
  choice_idem := by
    intro source value
    exact
      ((freeFunctorOfSolutionSet solution).obj source).computation.choice_idem
        value
  empty_choice := by
    intro source value
    exact
      ((freeFunctorOfSolutionSet solution).obj source).computation.deadlock_choice
        value
  map_divergence := ordinaryMap_divergence solution
  map_empty := ordinaryMap_deadlock solution
  map_choice := ordinaryMap_choice solution
  multiplication_divergence :=
    ordinaryMultiplication_divergence solution
  fubini := fubini.fubini
  fubini_natural := fubini.natural
  fubini_unit := fubini.unit
  fubini_commutes := fubini.commutes
  freeLift := ordinaryFreeLift solution
  freeLift_unit := ordinaryFreeLift_unit solution
  freeLift_divergence := ordinaryFreeLift_divergence solution
  freeLift_empty := ordinaryFreeLift_deadlock solution
  freeLift_choice := ordinaryFreeLift_choice solution
  freeLift_unique := ordinaryFreeLift_unique solution

/-! ## Separation follows already from the ordinary universal property -/

/-- A continuous constant generator into the separated nullary object. -/
def constantDivergenceGenerator
    (source : ωCPO) :
    source ⟶ carrierFunctor.obj nullaryObject :=
  ContinuousHom.const nullaryObject.computation.divergence

/--
The universal strict arrow from a free object to the separated nullary
computation.
-/
def freeToNullary
    {free : ωCPO ⥤ Computation}
    (adjunction : free ⊣ carrierFunctor)
    (source : ωCPO) :
    free.obj source ⟶ nullaryObject :=
  (adjunction.homEquiv source nullaryObject).symm
    (constantDivergenceGenerator source)

/--
Every object of any ordinary left adjoint to the carrier functor separates
the order-theoretic least element from the semilattice identity.

This is stronger than storing separation as an unrelated package field: if
the two constants collapsed, the universal strict map to `nullaryObject`
would collapse its mechanically proved distinct constants.
-/
theorem freeObject_divergence_ne_deadlock
    {free : ωCPO ⥤ Computation}
    (adjunction : free ⊣ carrierFunctor)
    (source : ωCPO) :
    (free.obj source).computation.divergence ≠
      (free.obj source).computation.deadlock := by
  intro collapsed
  have mapped :=
    congrArg
      (fun value => (freeToNullary adjunction source).hom value)
      collapsed
  rw [(freeToNullary adjunction source).map_divergence,
    (freeToNullary adjunction source).map_deadlock] at mapped
  exact nullary_divergence_ne_deadlock mapped

/-- Separation for the particular AFT-selected free functor. -/
theorem freeObjectOfSolutionSet_divergence_ne_deadlock
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) :
    ((freeFunctorOfSolutionSet solution).obj source).computation.divergence ≠
      ((freeFunctorOfSolutionSet solution).obj source).computation.deadlock :=
  freeObject_divergence_ne_deadlock
    (freeAdjunctionOfSolutionSet solution) source

/-! ## A genuine local solution-set witness: the empty omega-CPO -/

/-- The unique generator from the empty omega-CPO to the nullary free object. -/
def emptyNullaryGenerator :
    Cantilune.Pi.FMSExternalPackageObstruction.EmptyCpo ⟶
      carrierFunctor.obj nullaryObject :=
  Cantilune.Pi.FMSExternalPackageObstruction.emptyMap
    (carrierFunctor.obj nullaryObject)

/--
The singleton family consisting of `nullaryObject` is a solution set at the
empty omega-CPO.  This is the first genuine (but local) solution-set witness,
not a supplied global powerdomain package.
-/
theorem emptyCpo_solutionSet :
    ∃ (ι : Type) (objects : ι → Computation)
        (generators : ∀ index : ι,
          Cantilune.Pi.FMSExternalPackageObstruction.EmptyCpo ⟶
            carrierFunctor.obj (objects index)),
      ∀ (target : Computation)
        (generator :
          Cantilune.Pi.FMSExternalPackageObstruction.EmptyCpo ⟶
            carrierFunctor.obj target),
        ∃ (index : ι) (factor : objects index ⟶ target),
          generators index ≫ carrierFunctor.map factor = generator := by
  refine ⟨PUnit, fun _ => nullaryObject, fun _ => emptyNullaryGenerator, ?_⟩
  intro target generator
  refine ⟨PUnit.unit, nullaryTo target, ?_⟩
  apply ContinuousHom.ext
  intro value
  exact nomatch value

/-- The structured arrow represented by the local empty-source solution. -/
def emptyCpoUniversalArrow :
    StructuredArrow
      Cantilune.Pi.FMSExternalPackageObstruction.EmptyCpo
      carrierFunctor :=
  StructuredArrow.mk emptyNullaryGenerator

/-- The unique structured-arrow map from the empty-source universal arrow. -/
def emptyCpoUniversalTo
    (target :
      StructuredArrow
        Cantilune.Pi.FMSExternalPackageObstruction.EmptyCpo
        carrierFunctor) :
    emptyCpoUniversalArrow ⟶ target :=
  StructuredArrow.homMk
    (nullaryTo target.right)
    (by
      apply ContinuousHom.ext
      intro value
      exact nomatch value)

/-- The empty-source structured arrow is genuinely initial. -/
def emptyCpoUniversalIsInitial :
    IsInitial emptyCpoUniversalArrow :=
  IsInitial.ofUniqueHom
    emptyCpoUniversalTo
    (by
      intro target morphism
      apply StructuredArrow.hom_ext
      exact nullaryTo_unique target.right morphism.right)

end SolutionSet

end Cantilune.Pi.FMSCpoNondeterministicSolutionSet
