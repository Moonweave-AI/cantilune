import Cantilune.Pi.FMSCpoNondeterministicSolutionSet
import Mathlib.SetTheory.Cardinal.Arithmetic
import Mathlib.SetTheory.Ordinal.Univ

/-!
# A source-dependent cardinal closed under countable arity

The solution-set proof needs a bound that can contain the generators and is
stable under adjoining all countable sequences.  This file constructs that
bound without assuming a free algebra or a solution set.

For a type `α`, put

```text
μ α = max #α ℵ₀
κ α = 2 ^ μ α.
```

Then `#α ≤ κ α`, `ℵ₀ ≤ κ α`, and `κ α ^ ℵ₀ = κ α`.  Moreover its lift is
strictly below the next universe cardinal.  Thus cardinal arithmetic is not
the remaining obstruction to the all-source proof.

What is still absent is the structural theorem that the intersection of all
`NDωCPO` subalgebras containing a generator is itself represented by a
carrier of size at most this bound.  That theorem must account for
omega-chain suprema and then reindex the resulting algebra and factor map.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicCardinalClosure

open Cardinal

universe u

/-- The infinite cardinal containing the source carrier. -/
def generatorBound (α : Type u) : Cardinal.{u} :=
  max #α ℵ₀

/--
The countable-arity closure cardinal.  Taking one powerset-sized step makes
it a fixed point of exponentiation by `ℵ₀`.
-/
def countableClosureBound (α : Type u) : Cardinal.{u} :=
  2 ^ generatorBound α

theorem source_le_generatorBound (α : Type u) :
    #α ≤ generatorBound α :=
  le_max_left _ _

theorem aleph0_le_generatorBound (α : Type u) :
    ℵ₀ ≤ generatorBound α :=
  le_max_right _ _

theorem generatorBound_lt_countableClosureBound (α : Type u) :
    generatorBound α < countableClosureBound α :=
  cantor (generatorBound α)

theorem source_le_countableClosureBound (α : Type u) :
    #α ≤ countableClosureBound α :=
  (source_le_generatorBound α).trans
    (generatorBound_lt_countableClosureBound α).le

theorem aleph0_le_countableClosureBound (α : Type u) :
    ℵ₀ ≤ countableClosureBound α :=
  (aleph0_le_generatorBound α).trans
    (generatorBound_lt_countableClosureBound α).le

/--
The chosen bound is closed under the set of all countable sequences.

This is the exact arithmetic fact used to bound a single closure step that
adjoins every omega-chain supremum.
-/
theorem countableClosureBound_power_aleph0 (α : Type u) :
    countableClosureBound α ^ ℵ₀ =
      countableClosureBound α := by
  calc
    countableClosureBound α ^ ℵ₀ =
        2 ^ (generatorBound α * ℵ₀) := by
      exact power_mul.symm
    _ = 2 ^ generatorBound α := by
      rw [mul_aleph0_eq (aleph0_le_generatorBound α)]
    _ = countableClosureBound α :=
      rfl

/--
The cardinal remains genuinely small: its lift is strictly below the
cardinality of the next Lean universe.
-/
theorem countableClosureBound_lift_lt_univ (α : Type u) :
    lift.{u + 1, u} (countableClosureBound α) <
      univ.{u, u + 1} :=
  lift_lt_univ _

end Cantilune.Pi.FMSCpoNondeterministicCardinalClosure
