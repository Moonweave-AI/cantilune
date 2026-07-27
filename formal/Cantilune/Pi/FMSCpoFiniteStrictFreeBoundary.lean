import Cantilune.Pi.FMSCpoFiniteStrictPower
import Cantilune.Pi.FMSCpoNondeterministicNullary
import Cantilune.Pi.FMSCpoNondeterministicSolutionSet

/-!
# Exact free-object boundary of the finite strict powerset

`FMSCpoFiniteStrictPower` constructs the genuine ordered omega-CPO

`WithBot (Set α)`

for finite `α`.  Its order above divergence is subset inclusion and its
choice is strict union.  This file checks whether that object is the free
object of `NDωCPO` on the equality-ordered omega-CPO on `α`.

The answer is exact:

* the construction bundles as an `NDωCPO` object and its singleton map is a
  genuine structured arrow;
* for every inhabited finite `α`, this structured arrow is not initial.
  The constant-divergence generator into the ordered Boolean meet algebra
  has no continuous strict-semilattice extension;
* the empty source still has a genuine local solution set and initial
  structured arrow, already represented by the separated two-point nullary
  object.

The obstruction is not cardinality or finiteness.  Subset inclusion makes
`deadlock ≤ singleton a`, whereas a free extension would have to send those
points to target deadlock and target divergence respectively.  In the
ordered Boolean meet algebra this would require `true ≤ false`.

No global solution-set condition is asserted here.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoFiniteStrictFreeBoundary

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoFiniteStrictPower
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicNullary.NDωCPO

namespace FiniteStrictBoundary

/-- The equality-ordered omega-CPO on a finite type. -/
abbrev equalitySource (α : Type) : ωCPO :=
  ωCPO.of (EqualityOrder α)

/-- The finite strict powerset bundled as an object of `NDωCPO`. -/
def strictFiniteObject (α : Type) [Finite α] : NDωCPO where
  computation := strictFiniteComputation α

/-- The genuine singleton generator into the finite strict powerset. -/
def singletonGenerator (α : Type) [Finite α] :
    equalitySource α ⟶
      NDωCPO.forget.obj (strictFiniteObject α) :=
  singleton α

/--
The proposed finite strict free object, represented as a structured arrow.

This is a well-typed candidate.  Initiality is deliberately not included in
the definition and is refuted below for every inhabited source.
-/
def strictFiniteUniversalCandidate (α : Type) [Finite α] :
    StructuredArrow (equalitySource α) NDωCPO.forget :=
  StructuredArrow.mk (singletonGenerator α)

/-- A continuous generator sending every name to target divergence. -/
def constantDivergenceGenerator (α : Type) :
    equalitySource α ⟶ NDωCPO.forget.obj nullaryObject :=
  EqualityOrder.continuousTo
    (fun _ : α => nullaryObject.computation.divergence)

/-- The constant-divergence generator as a structured arrow. -/
def constantDivergenceArrow (α : Type) :
    StructuredArrow (equalitySource α) NDωCPO.forget :=
  StructuredArrow.mk (constantDivergenceGenerator α)

/--
There is no strict continuous semilattice extension of the
constant-divergence generator through the finite strict singleton map.

The proof uses only:

* preservation of deadlock by an `NDωCPO` arrow;
* the structured-arrow triangle at one generator;
* monotonicity at `deadlock < singleton witness`;
* the mechanically separated ordered Boolean target.
-/
theorem no_constantDivergence_extension
    (α : Type) [Finite α] [Inhabited α] :
    ¬ Nonempty
      (strictFiniteUniversalCandidate α ⟶
        constantDivergenceArrow α) := by
  rintro ⟨extension⟩
  let witness : α := default
  have triangle := StructuredArrow.w extension
  have atWitness :=
    congrArg
      (fun morphism =>
        (ConcreteCategory.hom (C := ωCPO) morphism) witness)
      triangle
  have generatorMapped :
      extension.right.hom (singleton α witness) =
        nullaryObject.computation.divergence := by
    change
      extension.right.hom (singleton α witness) =
        nullaryObject.computation.divergence
      at atWitness
    exact atWitness
  have sourceOrdered :
      (strictFiniteObject α).computation.deadlock ≤
        singleton α witness := by
    change deadlock α ≤
      (↑({witness} : Set α) : StrictFinitePower α)
    exact le_of_lt (deadlock_lt_singleton witness)
  have targetOrdered :=
    extension.right.hom.monotone sourceOrdered
  change
    (ConcreteCategory.hom (C := ωCPO) extension.right.hom)
        (strictFiniteObject α).computation.deadlock ≤
      (ConcreteCategory.hom (C := ωCPO) extension.right.hom)
        (singleton α witness)
    at targetOrdered
  have deadlockMapped :
      (ConcreteCategory.hom (C := ωCPO) extension.right.hom)
          (strictFiniteObject α).computation.deadlock =
        nullaryObject.computation.deadlock := by
    exact extension.right.map_deadlock
  rw [deadlockMapped, generatorMapped] at targetOrdered
  exact (by decide : ¬ (true : Bool) ≤ false) targetOrdered

/--
For every inhabited finite type, the finite strict structured arrow is not
initial and therefore is not the free `NDωCPO` object on that source.
-/
theorem strictFiniteUniversalCandidate_not_initial
    (α : Type) [Finite α] [Inhabited α] :
    IsInitial (strictFiniteUniversalCandidate α) → False := by
  intro initial
  exact
    no_constantDivergence_extension α
      ⟨initial.to (constantDivergenceArrow α)⟩

/--
Classical nonempty formulation of the same boundary.  This avoids presenting
the typeclass form as if `Inhabited α` were an extra mathematical
assumption.
-/
theorem strictFiniteUniversalCandidate_not_initial_of_nonempty
    (α : Type) [Finite α] (nonempty : Nonempty α) :
    IsInitial (strictFiniteUniversalCandidate α) → False := by
  letI : Inhabited α := ⟨Classical.choice nonempty⟩
  exact strictFiniteUniversalCandidate_not_initial α

/--
Equivalent direct formulation: no universal extension operation can assign
an `NDωCPO` arrow to every target generator while restricting along
singleton.
-/
theorem no_strictFinite_freeLift
    (α : Type) [Finite α] [Inhabited α] :
    ¬ ∀ (target : NDωCPO)
        (generator : equalitySource α ⟶ NDωCPO.forget.obj target),
      ∃ extension : strictFiniteObject α ⟶ target,
        singletonGenerator α ≫ NDωCPO.forget.map extension =
          generator := by
  intro freeLift
  obtain ⟨extension, restricts⟩ :=
    freeLift nullaryObject (constantDivergenceGenerator α)
  let structuredExtension :
      strictFiniteUniversalCandidate α ⟶
        constantDivergenceArrow α :=
    StructuredArrow.homMk extension restricts
  exact
    no_constantDivergence_extension α
      ⟨structuredExtension⟩

/-- Classical nonempty formulation of the failed all-target extension law. -/
theorem no_strictFinite_freeLift_of_nonempty
    (α : Type) [Finite α] (nonempty : Nonempty α) :
    ¬ ∀ (target : NDωCPO)
        (generator : equalitySource α ⟶ NDωCPO.forget.obj target),
      ∃ extension : strictFiniteObject α ⟶ target,
        singletonGenerator α ≫ NDωCPO.forget.map extension =
          generator := by
  letI : Inhabited α := ⟨Classical.choice nonempty⟩
  exact no_strictFinite_freeLift α

/-! ## The genuine empty-source local boundary -/

/--
The empty omega-CPO has a genuine singleton solution set.  This restates the
local witness at the finite-discrete boundary without extending it to any
nonempty finite type.
-/
theorem emptyEqualitySource_solutionSet :
    ∃ (ι : Type) (objects : ι → NDωCPO)
        (generators : ∀ index : ι,
          equalitySource PEmpty ⟶
            NDωCPO.forget.obj (objects index)),
      ∀ (target : NDωCPO)
        (generator :
          equalitySource PEmpty ⟶ NDωCPO.forget.obj target),
        ∃ (index : ι) (factor : objects index ⟶ target),
          generators index ≫ NDωCPO.forget.map factor =
            generator :=
  Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet.emptyCpo_solutionSet

/-- The actual empty-source universal structured arrow. -/
abbrev emptyEqualitySourceUniversalArrow :
    StructuredArrow (equalitySource PEmpty) NDωCPO.forget :=
  Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet.emptyCpoUniversalArrow

/-- The actual empty-source structured arrow is initial. -/
def emptyEqualitySourceUniversalArrow_isInitial :
    IsInitial emptyEqualitySourceUniversalArrow :=
  Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet.emptyCpoUniversalIsInitial

end FiniteStrictBoundary

end Cantilune.Pi.FMSCpoFiniteStrictFreeBoundary
