import Mathlib.CategoryTheory.Monad.Types
import Mathlib.CategoryTheory.Whiskering
import Mathlib.Data.Finset.Functor
import Mathlib.Data.Finset.Lattice.Fold

/-!
# The finite-powerset/free-semilattice monad

The set-theoretic FMS model uses the free-semilattice monad.  On `Type` this is
the finite powerset functor, represented in Lean by `Finset`.  This file
records both the genuine category-theoretic monad and its free universal
property.  It is not Abramsky's CPO powerdomain.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSFinitePower

open CategoryTheory

/-- Finite nondeterministic collections. -/
abbrev FinitePower (α : Type u) := Finset α

/--
The actual category-theoretic finite-powerset monad on `Type`, obtained from
mathlib's lawful commutative `Finset` monad.
-/
def finitePowerMonad : CategoryTheory.Monad (Type u) :=
  CategoryTheory.ofTypeMonad Finset

/--
Flatten a finite family of finite sets. Packaging the classical
`DecidableEq` choice in this definition keeps clients independent of a
particular decidability instance.
-/
def flatten (sets : Finset (Finset α)) : Finset α :=
  joinM sets

@[simp]
theorem mem_flatten {value : α} {sets : Finset (Finset α)} :
    value ∈ flatten sets ↔ ∃ choices ∈ sets, value ∈ choices := by
  simp [flatten, joinM, Finset.bind_def]

@[simp]
theorem finitePower_unit_apply (value : α) :
    finitePowerMonad.η.app α value = ({value} : Finset α) :=
  rfl

@[simp]
theorem finitePower_mu_apply (sets : Finset (Finset α)) :
    finitePowerMonad.μ.app α sets = flatten sets :=
  rfl

/-- The free extension of generators into a join-semilattice with bottom. -/
def lift [SemilatticeSup β] [OrderBot β]
    (generator : α → β) (values : FinitePower α) : β :=
  values.sup generator

@[simp]
theorem lift_empty [SemilatticeSup β] [OrderBot β]
    (generator : α → β) :
    lift generator ∅ = ⊥ := by
  simp [lift]

@[simp]
theorem lift_singleton [SemilatticeSup β] [OrderBot β]
    (generator : α → β) (value : α) :
    lift generator {value} = generator value := by
  simp [lift]

@[simp]
theorem lift_union [SemilatticeSup β] [OrderBot β]
    (generator : α → β) (left right : FinitePower α) :
    lift generator (left ∪ right) =
      lift generator left ⊔ lift generator right := by
  simp [lift, Finset.sup_union]

/--
Uniqueness of the semilattice homomorphism extending a generator assignment.
This is the free-semilattice universal property, not merely the three monad
laws.
-/
theorem lift_unique [SemilatticeSup β] [OrderBot β]
    (generator : α → β)
    (candidate : FinitePower α → β)
    (map_empty : candidate ∅ = ⊥)
    (map_union :
      ∀ left right,
        candidate (left ∪ right) =
          candidate left ⊔ candidate right)
    (map_singleton :
      ∀ value, candidate {value} = generator value) :
    candidate = lift generator := by
  funext values
  induction values using Finset.induction_on with
  | empty =>
      simpa using map_empty
  | @insert value values fresh ih =>
      have decomposition :
          insert value values = ({value} : Finset α) ∪ values := by
        ext item
        simp
      rw [decomposition, map_union, map_singleton, ih]
      simp [lift]

/-- Kleisli bind is finite union of the selected finite sets. -/
theorem bind_eq_biUnion
    (values : FinitePower α) (next : α → FinitePower β) :
    (values >>= next) = values.biUnion next :=
  by
    simp [Finset.bind_def, Finset.sup_eq_biUnion]

/-- Nondeterministic choice is commutative and idempotent. -/
theorem choice_comm_idem (left right : FinitePower α) :
    left ∪ right = right ∪ left ∧ left ∪ left = left :=
  ⟨Finset.union_comm _ _, Finset.union_self _⟩

/--
Finite powerset is a commutative applicative/monad in mathlib, supplying the
FMS interchange law for independent finite choices.
-/
theorem finitePower_commutative :
    CommApplicative Finset :=
  inferInstance

/-! ## Pointwise lifting to the actual functor category `Type^I` -/

/--
Postcomposition by finite powerset. Thus
`pointwiseFinitePowerFunctor.obj X` has carrier `Finset (X.obj world)` at
every finite-injection world.
-/
def pointwiseFinitePowerFunctor {I : Type v} [Category I] :
    (I ⥤ Type u) ⥤ (I ⥤ Type u) where
  obj model := model ⋙ finitePowerMonad.toFunctor
  map transformation :=
    Functor.whiskerRight transformation finitePowerMonad.toFunctor
  map_id model := by
    ext world value
    simp
  map_comp first second := by
    ext world value
    simp

/-- Pointwise singleton, natural both in the world and in the model. -/
def pointwiseUnit {I : Type v} [Category I] :
    𝟭 (I ⥤ Type u) ⟶ pointwiseFinitePowerFunctor (I := I) :=
  { app := fun model => Functor.whiskerLeft model finitePowerMonad.η
    naturality := by
      intro source target transformation
      ext world value
      change
        ({transformation.app world value} :
          Finset (target.obj world)) =
        Finset.image (transformation.app world) {value}
      simp }

/-- Pointwise finite union, natural both in the world and in the model. -/
def pointwiseMultiplication {I : Type v} [Category I] :
    pointwiseFinitePowerFunctor (I := I) ⋙
        pointwiseFinitePowerFunctor (I := I) ⟶
      pointwiseFinitePowerFunctor (I := I) :=
  { app := fun model => Functor.whiskerLeft model finitePowerMonad.μ
    naturality := by
      intro source target transformation
      exact NatTrans.ext (funext fun world =>
        finitePowerMonad.μ.naturality (transformation.app world)) }

/--
The genuine pointwise finite-powerset monad on any `Type`-valued functor
category, in particular on the FMS category `Set^I`.
-/
def pointwiseFinitePowerMonad {I : Type v} [Category I] :
    CategoryTheory.Monad (I ⥤ Type u) where
  toFunctor := pointwiseFinitePowerFunctor
  η := pointwiseUnit (I := I)
  μ := pointwiseMultiplication (I := I)
  assoc model := by
    exact NatTrans.ext (funext fun world =>
      finitePowerMonad.assoc (model.obj world))
  left_unit model := by
    exact NatTrans.ext (funext fun world =>
      finitePowerMonad.left_unit (model.obj world))
  right_unit model := by
    exact NatTrans.ext (funext fun world =>
      finitePowerMonad.right_unit (model.obj world))

end Cantilune.Pi.FMSFinitePower
