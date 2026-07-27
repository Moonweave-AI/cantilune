import Cantilune.Pi.FMSCpoFinitePower

/-!
# Why discrete finite power cannot extend pointwise to every omega-CPO

The internally mechanized finite-power monad is intentionally defined only on
equality-ordered CPOs.  This file records a concrete obstruction to extending
that exact construction objectwise to all omega-CPOs: on the two-element
ordered CPO, the singleton unit is not monotone when finite sets retain the
equality order.

This does not rule out the Abramsky powerdomain.  It rules out identifying the
existing discrete finite-power construction with that powerdomain.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSCpoFinitePowerObstruction

open CategoryTheory
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSModel

/-- Singleton does not preserve the nontrivial order `false ≤ true`. -/
theorem bool_singleton_not_monotone :
    ¬ ∀ ⦃left right : Bool⦄, left ≤ right →
        @LE.le (EqualityOrder (Finset Bool))
          EqualityOrder.instLE
          (({left} : Finset Bool) : EqualityOrder (Finset Bool))
          (({right} : Finset Bool) : EqualityOrder (Finset Bool)) := by
  intro monotone
  have ordered : false ≤ true := by decide
  have imageOrdered := monotone ordered
  change ({false} : Finset Bool) = {true} at imageOrdered
  simp at imageOrdered

/--
Consequently there is no continuous map with the finite-singleton carrier
function from the ordinary ordered Boolean CPO to the equality-ordered
finite-set CPO.
-/
theorem no_continuous_bool_singleton :
    ¬ ∃ unit :
        Bool →𝒄 EqualityOrder (Finset Bool),
      ∀ value, unit value = ({value} : Finset Bool) := by
  rintro ⟨unit, unit_apply⟩
  apply bool_singleton_not_monotone
  intro left right ordered
  have mapped := unit.monotone ordered
  change
    @LE.le (EqualityOrder (Finset Bool))
      EqualityOrder.instLE
      (unit left) (unit right)
    at mapped
  simpa [unit_apply] using mapped

/-! ## The obstruction at the actual `ωCPO^I` boundary -/

/--
Any continuous singleton map into an equality-ordered finite-set CPO forces
the source order to be discrete: comparable values must already be equal.
-/
theorem continuous_singleton_forces_order_eq
    {α : Type*} [OmegaCompletePartialOrder α]
    (unit : α →𝒄 EqualityOrder (Finset α))
    (unit_apply :
      ∀ value, unit value = ({value} : Finset α))
    {left right : α} (ordered : left ≤ right) :
    left = right := by
  have mapped := unit.monotone ordered
  change unit left = unit right at mapped
  rw [unit_apply left, unit_apply right] at mapped
  change ({left} : Finset α) = {right} at mapped
  exact Finset.singleton_injective mapped

/--
The tempting objectwise extension of the discrete finite-power functor to
all omega-CPOs: forget the source order and put the equality order on finite
sets.  Its action on maps is continuous only because both finite-set objects
carry the equality order.

This is a genuine endofunctor on `ωCPO`, but the theorems below show that it
cannot carry the singleton unit needed by a finite-power monad.
-/
def naiveFinitePowerFunctor : ωCPO ⥤ ωCPO where
  obj object := ωCPO.of (EqualityOrder (Finset object))
  map morphism := EqualityOrder.continuous (Finset.image morphism)
  map_id object := by
    apply OmegaCompletePartialOrder.ContinuousHom.ext
    intro values
    change Finset.image (fun value : object => value) values = values
    simp
  map_comp first second := by
    apply OmegaCompletePartialOrder.ContinuousHom.ext
    intro values
    change
      Finset.image (fun value => second (first value)) values =
        Finset.image second (Finset.image first values)
    apply Finset.ext
    intro target
    simp only [Finset.mem_image]
    constructor
    · rintro ⟨source, sourceMember, rfl⟩
      exact
        ⟨first source, ⟨source, sourceMember, rfl⟩, rfl⟩
    · rintro
        ⟨middle, ⟨source, sourceMember, middleEqual⟩, targetEqual⟩
      subst middle
      subst target
      exact ⟨source, sourceMember, rfl⟩

/--
A candidate natural singleton unit for `naiveFinitePowerFunctor`.

The pointwise equation is explicit so that no unrelated natural
transformation can be mistaken for the finite-power unit.
-/
structure NaiveSingletonUnit where
  unit : 𝟭 ωCPO ⟶ naiveFinitePowerFunctor
  singleton :
    ∀ (object : ωCPO) (value : object),
      unit.app object value = ({value} : Finset object)

/--
The equality-ordered finite-set endofunctor on all omega-CPOs has no natural
singleton unit.  In fact its component at the ordinary ordered Boolean CPO
would already be the impossible continuous map proved above.
-/
theorem no_naive_singleton_unit :
    ¬ Nonempty NaiveSingletonUnit := by
  rintro ⟨candidate⟩
  apply no_continuous_bool_singleton
  refine ⟨candidate.unit.app (ωCPO.of Bool), ?_⟩
  intro value
  exact candidate.singleton (ωCPO.of Bool) value

/--
Postcomposition with the naive finite-set endofunctor at the actual finite
injection index category used by the FMS model.
-/
def naivePointwiseFinitePowerFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) where
  obj model := model ⋙ naiveFinitePowerFunctor
  map transformation :=
    Functor.whiskerRight transformation naiveFinitePowerFunctor
  map_id model := by
    exact NatTrans.ext (funext fun world =>
      naiveFinitePowerFunctor.map_id (model.obj world))
  map_comp first second := by
    exact NatTrans.ext (funext fun world =>
      naiveFinitePowerFunctor.map_comp
        (first.app world) (second.app world))

/-- The constant ordinary ordered Boolean model in `ωCPO^I`. -/
def orderedBoolWorldModel : World ⥤ ωCPO :=
  (Functor.const World).obj (ωCPO.of Bool)

/--
A candidate pointwise singleton unit on the genuine FMS functor category.
The equation is quantified over every world model and every finite world.
-/
structure NaivePointwiseSingletonUnit where
  unit :
    𝟭 (World ⥤ ωCPO) ⟶ naivePointwiseFinitePowerFunctor
  singleton :
    ∀ (model : World ⥤ ωCPO) (world : World)
      (value : model.obj world),
      (unit.app model).app world value =
        ({value} : Finset (model.obj world))

namespace NaivePointwiseSingletonUnit

/--
A pointwise singleton unit would collapse the order in every object of every
world model.  Thus it cannot represent nondeterminism over a genuinely
ordered CPO.
-/
theorem order_eq
    (candidate : NaivePointwiseSingletonUnit)
    (model : World ⥤ ωCPO.{0}) (world : World)
    {left right : model.obj world} (ordered : left ≤ right) :
    left = right :=
  continuous_singleton_forces_order_eq
    ((candidate.unit.app model).app world)
    (candidate.singleton model world)
    ordered

end NaivePointwiseSingletonUnit

/--
There is no pointwise singleton unit for the equality-ordered finite-set
construction on `ωCPO^I`.

This is the precise CPO-world obstruction: evaluating a hypothetical unit at
the constant ordered-Boolean model and world zero yields a continuous
singleton map into an equality-ordered finite-set CPO.  Consequently the
internally constructed discrete finite-power monad cannot be promoted
pointwise to the full FMS CPO category by changing only its object domain.
-/
theorem no_naive_pointwise_singleton_unit :
    ¬ Nonempty NaivePointwiseSingletonUnit := by
  rintro ⟨candidate⟩
  apply no_continuous_bool_singleton
  refine
    ⟨(candidate.unit.app orderedBoolWorldModel).app 0, ?_⟩
  intro value
  exact candidate.singleton orderedBoolWorldModel 0 value

end Cantilune.Pi.FMSCpoFinitePowerObstruction
