import Cantilune.Pi.FMSPointwiseCpoMonad

/-!
# Pointwise Abramsky-powerdomain structure in `ωCPO`-valued world models

Given a genuine `CpoPowerdomainPackage` on `ωCPO`, this module constructs the
corresponding nondeterministic computation object at every world and proves
that divergence, deadlock, choice, and Fubini are natural in the indexing
category.  This is actual functor-category plumbing; it does not manufacture
the still-missing base powerdomain or solve the recursive FMS agent equation.
-/

noncomputable section

namespace Cantilune.Pi.FMSPointwisePowerdomain

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Pi.FMSExternalPackage

variable {I : Type} [Category I]

/--
A world-indexed nondeterministic computation whose distinguished operations
are natural for every index morphism.
-/
structure PointwiseNondeterministicModel where
  carrier : I ⥤ ωCPO.{0}
  divergence : ∀ object, carrier.obj object
  divergence_natural :
    ∀ {source target : I} (morphism : source ⟶ target),
      carrier.map morphism (divergence source) = divergence target
  deadlock : ∀ object, carrier.obj object
  deadlock_natural :
    ∀ {source target : I} (morphism : source ⟶ target),
      carrier.map morphism (deadlock source) = deadlock target
  choice :
    ∀ object,
      ωCPO.of (carrier.obj object × carrier.obj object) ⟶
        carrier.obj object
  choice_natural :
    ∀ {source target : I} (morphism : source ⟶ target)
      (left right : carrier.obj source),
      carrier.map morphism (choice source (left, right)) =
        choice target
          (carrier.map morphism left, carrier.map morphism right)
  divergence_le :
    ∀ object (value : carrier.obj object), divergence object ≤ value
  divergence_ne_deadlock :
    ∀ object, divergence object ≠ deadlock object
  choice_assoc :
    ∀ object left middle right,
      choice object (choice object (left, middle), right) =
        choice object (left, choice object (middle, right))
  choice_comm :
    ∀ object left right,
      choice object (left, right) = choice object (right, left)
  choice_idem :
    ∀ object value, choice object (value, value) = value
  deadlock_choice :
    ∀ object value, choice object (deadlock object, value) = value

/-- Pointwise powerdomain computation carried by a world model. -/
def computation
    (power : CpoPowerdomainPackage)
    (model : I ⥤ ωCPO.{0}) :
    PointwiseNondeterministicModel (I := I) where
  carrier := model ⋙ power.monad.toFunctor
  divergence := fun object => power.divergence (model.obj object)
  divergence_natural := by
    intro source target morphism
    exact power.map_divergence (model.map morphism)
  deadlock := fun object => power.empty (model.obj object)
  deadlock_natural := by
    intro source target morphism
    exact power.map_empty (model.map morphism)
  choice := fun object => power.choice (model.obj object)
  choice_natural := by
    intro source target morphism left right
    exact power.map_choice (model.map morphism) left right
  divergence_le := fun object =>
    power.divergence_le (model.obj object)
  divergence_ne_deadlock := fun object =>
    power.divergence_ne_empty (model.obj object)
  choice_assoc := fun object =>
    power.choice_assoc (model.obj object)
  choice_comm := fun object =>
    power.choice_comm (model.obj object)
  choice_idem := fun object =>
    power.choice_idem (model.obj object)
  deadlock_choice := fun object =>
    power.empty_choice (model.obj object)

/-- The underlying monad is the actual pointwise lift on `I ⥤ ωCPO`. -/
def monad (power : CpoPowerdomainPackage) :
    CategoryTheory.Monad (I ⥤ ωCPO.{0}) :=
  Cantilune.Pi.FMSPointwiseCpoMonad.pointwiseCpoMonad power.monad

@[simp] theorem computation_carrier_obj
    (power : CpoPowerdomainPackage)
    (model : I ⥤ ωCPO.{0}) (object : I) :
    (computation (I := I) power model).carrier.obj object =
      power.monad.obj (model.obj object) :=
  rfl

/--
Pointwise Fubini maps for two world models, including naturality in the index
category.  The equation is the componentwise naturality square needed for
the strong commutative pointwise lift.
-/
structure PointwiseFubini
    (power : CpoPowerdomainPackage)
    (left right : I ⥤ ωCPO.{0}) where
  app :
    ∀ object,
      (power.monad.obj (left.obj object) ⨯
        power.monad.obj (right.obj object)) ⟶
      power.monad.obj (left.obj object ⨯ right.obj object)
  naturality :
    ∀ {source target : I} (morphism : source ⟶ target),
      Limits.prod.map
          (power.monad.map (left.map morphism))
          (power.monad.map (right.map morphism)) ≫
          app target =
        app source ≫
          power.monad.map
            (Limits.prod.map
              (left.map morphism) (right.map morphism))

/-- The base powerdomain's Fubini family lifts pointwise and naturally. -/
def fubini
    (power : CpoPowerdomainPackage)
    (left right : I ⥤ ωCPO.{0}) :
    PointwiseFubini power left right where
  app := fun object =>
    power.fubini (left.obj object) (right.obj object)
  naturality := by
    intro source target morphism
    exact
      power.fubini_natural
        (left.map morphism) (right.map morphism)

/-- Pointwise multiplication preserves the divergence component. -/
theorem multiplication_divergence_app
    (power : CpoPowerdomainPackage)
    (model : I ⥤ ωCPO.{0}) (object : I) :
    ((monad (I := I) power).μ.app model).app object
        (power.divergence
          (power.monad.obj (model.obj object))) =
      power.divergence (model.obj object) :=
  power.multiplication_divergence (model.obj object)

end Cantilune.Pi.FMSPointwisePowerdomain
