import Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
import Cantilune.Pi.FMSCpoConcreteAlgebraicCompactness
import Cantilune.Pi.FMSCpoOmegaScottFreeCompleteJoin

/-!
# Source-aligned unseparated FMS core

This module packages the concrete D1-A effect and recursive-domain results
that are already constructed in the kernel:

* the lower omega-Scott power monad on every `ωCPO`;
* its chosen-cartesian symmetric Fubini map, strengths, and all monad/Fubini
  coherence diagrams;
* one unseparated nullary effect, used both for divergence and deadlock;
* strict preservation of that nullary effect by direct image,
  multiplication, and raw cartesian Fubini; and
* the concrete continuous-natural fixed point of `P ∘ H`, with initial
  algebra and terminal coalgebra universal properties.

The package deliberately has no `divergence_ne_deadlock` field.  It also has
no fields for operational restriction/hiding, adequacy, definability, or
full abstraction.  Those are theorem layers above this core and cannot be
created by packaging the domain equation.

The final section records the exact universal-property boundary currently
proved for this concrete lower power: targets are complete lattices and
arrows preserve arbitrary suprema.  No claim of a free binary continuous
semilattice is made here.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoUnseparatedSourceCore

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoOmegaScottFreeCompleteJoin

universe u

/-! ## The single nullary effect -/

/-- The effect carrier at an arbitrary omega-CPO. -/
abbrev Effect (object : ωCPO.{u}) :=
  OmegaScottPower object

/-- The least lower computation. -/
def effectBottom (object : ωCPO.{u}) : Effect object :=
  ⊥

/-- D1-A interprets divergence by the single least lower computation. -/
def effectDivergence (object : ωCPO.{u}) : Effect object :=
  effectBottom object

/-- D1-A interprets deadlock by the same least lower computation. -/
def effectDeadlock (object : ωCPO.{u}) : Effect object :=
  effectBottom object

/-- Nondeterministic binary choice is closed-set union/lattice supremum. -/
def effectChoice
    (object : ωCPO.{u})
    (left right : Effect object) :
    Effect object :=
  left ⊔ right

@[simp]
theorem effectDivergence_eq_effectDeadlock
    (object : ωCPO.{u}) :
    effectDivergence object = effectDeadlock object :=
  rfl

theorem effectDivergence_le
    (object : ωCPO.{u})
    (value : Effect object) :
    effectDivergence object ≤ value :=
  bot_le

@[simp]
theorem effectChoice_assoc
    (object : ωCPO.{u})
    (left middle right : Effect object) :
    effectChoice object
        (effectChoice object left middle) right =
      effectChoice object left
        (effectChoice object middle right) :=
  by
    simpa [effectChoice] using
      (sup_assoc left middle right)

@[simp]
theorem effectChoice_comm
    (object : ωCPO.{u})
    (left right : Effect object) :
    effectChoice object left right =
      effectChoice object right left :=
  by
    simpa [effectChoice] using
      (sup_comm left right)

@[simp]
theorem effectChoice_idem
    (object : ωCPO.{u})
    (value : Effect object) :
    effectChoice object value value = value :=
  by
    simp [effectChoice]

@[simp]
theorem effectDeadlock_choice
    (object : ωCPO.{u})
    (value : Effect object) :
    effectChoice object (effectDeadlock object) value =
      value :=
  by
    simp [effectChoice, effectDeadlock, effectBottom]

@[simp]
theorem effectChoice_deadlock
    (object : ωCPO.{u})
    (value : Effect object) :
    effectChoice object value (effectDeadlock object) =
      value :=
  by
    simp [effectChoice, effectDeadlock, effectBottom]

/-! ## Strictness of the concrete monad operations -/

/-- Direct image preserves the single nullary effect. -/
theorem mapRaw_effectBottom
    {source target : Type u}
    [OmegaCompletePartialOrder source]
    [OmegaCompletePartialOrder target]
    (morphism : source →𝒄 target) :
    mapRaw morphism (⊥ : OmegaScottPower source) =
      (⊥ : OmegaScottPower target) := by
  apply le_antisymm
  · exact
      (mapRaw_le_iff morphism
        (⊥ : OmegaScottPower source)
        (⊥ : OmegaScottPower target)).2 bot_le
  · exact bot_le

/-- Monad multiplication preserves the single nullary effect. -/
theorem flattenRaw_effectBottom
    (object : Type u)
    [OmegaCompletePartialOrder object] :
    flattenRaw
        (⊥ : OmegaScottPower (OmegaScottPower object)) =
      (⊥ : OmegaScottPower object) := by
  apply le_antisymm
  · exact
      (flattenRaw_le_iff
        (⊥ : OmegaScottPower (OmegaScottPower object))
        (⊥ : OmegaScottPower object)).2 bot_le
  · exact bot_le

/-- Raw cartesian Fubini is strict in its left computation. -/
theorem fubiniRaw_effectBottom_left
    (left right : Type u)
    [OmegaCompletePartialOrder left]
    [OmegaCompletePartialOrder right]
    (values : OmegaScottPower right) :
    fubiniRaw (⊥ : OmegaScottPower left) values =
      (⊥ : OmegaScottPower (left × right)) := by
  apply le_antisymm
  · intro value member
    have leftMember := member.1
    change
      value.1 ∈
        (∅ : Set (WithOmegaScott left))
      at leftMember
    exact leftMember.elim
  · exact bot_le

/-- Raw cartesian Fubini is strict in its right computation. -/
theorem fubiniRaw_effectBottom_right
    (left right : Type u)
    [OmegaCompletePartialOrder left]
    [OmegaCompletePartialOrder right]
    (values : OmegaScottPower left) :
    fubiniRaw values (⊥ : OmegaScottPower right) =
      (⊥ : OmegaScottPower (left × right)) := by
  apply le_antisymm
  · intro value member
    have rightMember := member.2
    change
      value.2 ∈
        (∅ : Set (WithOmegaScott right))
      at rightMember
    exact rightMember.elim
  · exact bot_le

/--
Kernel-checkable laws for the fixed lower omega-Scott effect.  The carrier
and operations are not abstract fields, so an inhabitant cannot substitute a
different monad after proving the desired equations.
-/
structure OmegaScottUnseparatedEffectLaws : Prop where
  map_bottom :
    ∀ {source target : Type u}
      [OmegaCompletePartialOrder source]
      [OmegaCompletePartialOrder target]
      (morphism : source →𝒄 target),
      mapRaw morphism (⊥ : OmegaScottPower source) =
        (⊥ : OmegaScottPower target)
  multiplication_bottom :
    ∀ (object : Type u)
      [OmegaCompletePartialOrder object],
      flattenRaw
          (⊥ : OmegaScottPower (OmegaScottPower object)) =
        (⊥ : OmegaScottPower object)
  fubini_bottom_left :
    ∀ (left right : Type u)
      [OmegaCompletePartialOrder left]
      [OmegaCompletePartialOrder right]
      (values : OmegaScottPower right),
      fubiniRaw (⊥ : OmegaScottPower left) values =
        (⊥ : OmegaScottPower (left × right))
  fubini_bottom_right :
    ∀ (left right : Type u)
      [OmegaCompletePartialOrder left]
      [OmegaCompletePartialOrder right]
      (values : OmegaScottPower left),
      fubiniRaw values (⊥ : OmegaScottPower right) =
        (⊥ : OmegaScottPower (left × right))

/-- The fixed all-object lower omega-Scott effect satisfies its strict laws. -/
theorem omegaScottUnseparatedEffectLaws :
    OmegaScottUnseparatedEffectLaws where
  map_bottom := mapRaw_effectBottom
  multiplication_bottom := flattenRaw_effectBottom
  fubini_bottom_left := fubiniRaw_effectBottom_left
  fubini_bottom_right := fubiniRaw_effectBottom_right

/-! ## Concrete source-aligned core acceptance -/

/--
The D1-A core acceptance package.

`strongCommutative_power` ties the independently packaged chosen-product
coherence to the concrete lower omega-Scott monad.  `domainCompactness`
lives at the fixed endofunctor
`actionFunctor ⋙ pointwiseOmegaScottPowerFunctor`, so it is the actual
`A ≅ P(H A)` solution rather than an arbitrary supplied endofunctor.
-/
structure SourceAlignedUnseparatedCore where
  strongCommutative :
    UnseparatedStrongCommutativeMonad.{0}
  strongCommutative_power :
    strongCommutative.power = omegaScottPowerMonad
  effectLaws :
    OmegaScottUnseparatedEffectLaws.{0}
  domainCompactness :
    ActualAlgebraicCompactnessWitness

/-- Concrete inhabitant of the D1-A core acceptance package. -/
def concreteSourceAlignedUnseparatedCore :
    SourceAlignedUnseparatedCore where
  strongCommutative :=
    omegaScottUnseparatedStrongCommutativeMonad
  strongCommutative_power := rfl
  effectLaws := omegaScottUnseparatedEffectLaws
  domainCompactness :=
    concreteActualAlgebraicCompactnessWitness

namespace SourceAlignedUnseparatedCore

/-- The actual continuous-natural solution `A ≅ P(H A)`. -/
def unfoldIso
    (core : SourceAlignedUnseparatedCore) :
    core.domainCompactness.fixed.agent ≅
      ActualAgentFunctor.obj
        core.domainCompactness.fixed.agent :=
  core.domainCompactness.unfoldIso

/-- The inverse continuous-natural solution `P(H A) ≅ A`. -/
def foldIso
    (core : SourceAlignedUnseparatedCore) :
    ActualAgentFunctor.obj
        core.domainCompactness.fixed.agent ≅
      core.domainCompactness.fixed.agent :=
  core.domainCompactness.foldIso

/-- Folding after unfolding is the identity at every finite world. -/
@[simp]
theorem unfold_fold
    (core : SourceAlignedUnseparatedCore)
    (world : Cantilune.Pi.FMSModel.World)
    (value :
      core.domainCompactness.fixed.agent.obj world) :
    (core.foldIso.app world).hom
        ((core.unfoldIso.app world).hom value) =
      value :=
  core.domainCompactness.fixed.unfold_fold world value

/-- Unfolding after folding is the identity at every finite world. -/
@[simp]
theorem fold_unfold
    (core : SourceAlignedUnseparatedCore)
    (world : Cantilune.Pi.FMSModel.World)
    (value :
      (ActualAgentFunctor.obj
        core.domainCompactness.fixed.agent).obj world) :
    (core.unfoldIso.app world).hom
        ((core.foldIso.app world).hom value) =
      value :=
  core.domainCompactness.fixed.fold_unfold world value

/-- The fold algebra carried by the concrete solution is initial. -/
def foldIsInitial
    (core : SourceAlignedUnseparatedCore) :
    CategoryTheory.Limits.IsInitial
      core.domainCompactness.fixed.algebra :=
  core.domainCompactness.initialAlgebra

/-- The unfold coalgebra carried by the concrete solution is terminal. -/
def unfoldIsTerminal
    (core : SourceAlignedUnseparatedCore) :
    CategoryTheory.Limits.IsTerminal
      core.domainCompactness.fixed.coalgebra :=
  core.domainCompactness.terminalCoalgebra

end SourceAlignedUnseparatedCore

/-! ## Exact universal-property boundary -/

/--
The constructed extension into a complete-lattice target.  Its bundled type
records preservation of arbitrary suprema, which is the load-bearing premise
of the proved uniqueness theorem.
-/
def completeJoinExtension
    {source target : Type u}
    [OmegaCompletePartialOrder source]
    [CompleteLattice target]
    (generator : source →𝒄 target) :
    sSupHom (OmegaScottPower source) target :=
  liftSSupHom generator

/-- The complete-join extension agrees with the generator on principals. -/
theorem completeJoinExtension_principal
    {source target : Type u}
    [OmegaCompletePartialOrder source]
    [CompleteLattice target]
    (generator : source →𝒄 target)
    (value : source) :
    completeJoinExtension generator (principalRaw value) =
      generator value :=
  liftRaw_principal generator value

/--
Exact uniqueness boundary: an arbitrary-supremum-preserving extension is
uniquely the constructed extension.
-/
theorem completeJoinExtension_unique
    {source target : Type u}
    [OmegaCompletePartialOrder source]
    [CompleteLattice target]
    (generator : source →𝒄 target)
    (extension : sSupHom (OmegaScottPower source) target)
    (extendsGenerator :
      ∀ value : source,
        extension (principalRaw value) = generator value) :
    extension = completeJoinExtension generator :=
  liftSSupHom_unique generator extension extendsGenerator

end Cantilune.Pi.FMSCpoUnseparatedSourceCore
