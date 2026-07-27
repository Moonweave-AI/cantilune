import Cantilune.Pi.FMSPowerdomainBoundary

/-!
# Consistency audit of the external FMS powerdomain interface

The previous acceptance interface split the free continuous-semilattice
universal property from preservation of the order-theoretic divergence
constant.  Those two requirements are incompatible as stated.

On an empty source CPO, the identity of `P E` and the constant-deadlock map
both satisfy the old `freeLift_unique` premises, so every element of `P E`
is forced to equal deadlock.  `freeLift_divergence` then maps that same
element to the distinct least element of the ordered-Boolean computation,
while `freeLift_empty` maps it to `true`.  This yields `false = true`.

The theorem below is a kernel-checked rejection of the old interface, not an
assumption that a genuine Abramsky powerdomain is impossible.  The interface
must instead express morphisms preserving divergence, deadlock, and choice
inside one coherent universal property.
-/

noncomputable section

namespace Cantilune.Pi.FMSExternalPackageObstruction

open CategoryTheory
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSPowerdomainBoundary
open OmegaCompletePartialOrder

/-- Empty equality-ordered omega-CPO. -/
abbrev EmptyCpo : ωCPO :=
  ωCPO.of (FMSCpoFinitePower.EqualityOrder PEmpty)

/-- The unique continuous map out of the empty CPO. -/
def emptyMap (target : ωCPO) : EmptyCpo ⟶ target :=
  FMSCpoFinitePower.EqualityOrder.continuousTo
    (fun value : PEmpty => nomatch value)

/-- The free continuous semilattice exposed by the old package. -/
def freeSemilattice
    (power : LegacyCpoPowerdomainPackage) (source : ωCPO) :
    ContinuousJoinSemilattice where
  carrier := power.monad.obj source
  bottom := power.empty source
  choice := power.choice source
  choice_assoc := power.choice_assoc source
  choice_comm := power.choice_comm source
  choice_idem := power.choice_idem source
  bottom_choice := power.empty_choice source

/--
Ordered booleans as a nondeterministic computation with distinct
order-bottom (`false`) and choice identity/deadlock (`true`).
-/
def boolComputation : NondeterministicComputation where
  carrier := meetSemilattice.carrier
  divergence := false
  divergence_le := Bool.false_le
  deadlock := true
  choice := meetSemilattice.choice
  choice_assoc := meetSemilattice.choice_assoc
  choice_comm := meetSemilattice.choice_comm
  choice_idem := meetSemilattice.choice_idem
  deadlock_choice := meetSemilattice.bottom_choice

/-- Forget the CPO wrapper of the concrete Boolean computation. -/
def observeBool : boolComputation.carrier → Bool :=
  fun value => value

private theorem identity_is_old_free_lift
    (power : LegacyCpoPowerdomainPackage) :
    (𝟙 (power.monad.obj EmptyCpo)) =
      power.freeLift EmptyCpo (freeSemilattice power EmptyCpo)
        (emptyMap (power.monad.obj EmptyCpo)) := by
  exact
    power.freeLift_unique
      EmptyCpo (freeSemilattice power EmptyCpo)
      (emptyMap (power.monad.obj EmptyCpo))
      (𝟙 (power.monad.obj EmptyCpo))
      (by
        apply ContinuousHom.ext
        intro value
        exact nomatch value)
      rfl
      (by
        intro left right
        rfl)

private theorem deadlock_constant_is_old_free_lift
    (power : LegacyCpoPowerdomainPackage) :
    ContinuousHom.const (power.empty EmptyCpo) =
      power.freeLift EmptyCpo (freeSemilattice power EmptyCpo)
        (emptyMap (power.monad.obj EmptyCpo)) := by
  exact
    power.freeLift_unique
      EmptyCpo (freeSemilattice power EmptyCpo)
      (emptyMap (power.monad.obj EmptyCpo))
      (ContinuousHom.const (power.empty EmptyCpo))
      (by
        apply ContinuousHom.ext
        intro value
        exact nomatch value)
      rfl
      (by
        intro left right
        exact (power.choice_idem EmptyCpo (power.empty EmptyCpo)).symm)

/-- The old universal property collapses every free value to deadlock. -/
theorem old_free_lift_collapses
    (power : LegacyCpoPowerdomainPackage)
    (value : power.monad.obj EmptyCpo) :
    value = power.empty EmptyCpo := by
  have mapsEqual :
      (𝟙 (power.monad.obj EmptyCpo)) =
        ContinuousHom.const (power.empty EmptyCpo) :=
    (identity_is_old_free_lift power).trans
      (deadlock_constant_is_old_free_lift power).symm
  have pointwise := congrArg (fun map => map value) mapsEqual
  exact pointwise

/--
No value can satisfy the old post-hoc Abramsky coherence record for a
`CpoPowerdomainPackage`.  This is a defect in the record design, not a
negative theorem about the genuine FMS/Abramsky construction.
-/
theorem no_abramsky_coherence
    (power : LegacyCpoPowerdomainPackage) :
    ¬ Nonempty (LegacyAbramskyPowerdomainCoherence power) := by
  rintro ⟨coherence⟩
  let generator : EmptyCpo ⟶ boolComputation.carrier :=
    emptyMap boolComputation.carrier
  have divergenceEqualsDeadlock :
      coherence.divergence EmptyCpo = power.empty EmptyCpo :=
    old_free_lift_collapses power (coherence.divergence EmptyCpo)
  have mapsDivergence :
      power.freeLift EmptyCpo
          boolComputation.toContinuousJoinSemilattice generator
          (coherence.divergence EmptyCpo) =
        boolComputation.divergence :=
    coherence.freeLift_divergence EmptyCpo boolComputation generator
  have mapsDeadlock :
      power.freeLift EmptyCpo
          boolComputation.toContinuousJoinSemilattice generator
          (power.empty EmptyCpo) =
        boolComputation.deadlock :=
    power.freeLift_empty EmptyCpo
      boolComputation.toContinuousJoinSemilattice generator
  have sameLift :
      power.freeLift EmptyCpo
          boolComputation.toContinuousJoinSemilattice generator
          (coherence.divergence EmptyCpo) =
        power.freeLift EmptyCpo
          boolComputation.toContinuousJoinSemilattice generator
          (power.empty EmptyCpo) :=
    congrArg
      (fun value =>
        power.freeLift EmptyCpo
          boolComputation.toContinuousJoinSemilattice generator value)
      divergenceEqualsDeadlock
  have impossible :
      boolComputation.divergence = boolComputation.deadlock :=
    mapsDivergence.symm.trans (sameLift.trans mapsDeadlock)
  have impossibleBool : (false : Bool) = true := by
    exact congrArg observeBool impossible
  exact Bool.noConfusion impossibleBool

end Cantilune.Pi.FMSExternalPackageObstruction
