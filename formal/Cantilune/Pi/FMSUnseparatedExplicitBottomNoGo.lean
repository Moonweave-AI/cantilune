import Cantilune.Pi.FMSCpoUnseparatedSourceCore

/-!
# No-go for an observable explicit bottom in the unseparated FMS effect

The D1-A effect deliberately identifies the effect-level divergence constant
with the effect-level deadlock constant.  This is compatible with the
source-paper full-abstraction target only because the target language is the
ordinary pi calculus: the auxiliary bottom used by the approximation proof is
not an observable source-process constructor.

This file records the exact boundary.  If both nullary constants are exposed
as distinct observable programs, no denotation through the unseparated
nullary effect can be fully abstract for equality of those programs.

The theorem does not rule out full abstraction for ordinary finite pi
processes or for guarded replication.  Those processes have action structure,
so their denotations need not be the nullary bottom.
-/

noncomputable section

namespace Cantilune.Pi.FMSUnseparatedExplicitBottomNoGo

open Cantilune.Pi.FMSCpoUnseparatedSourceCore

/-- A universe-fixed carrier used only to witness the nullary collapse. -/
abbrev NullaryObject : ωCPO.{0} :=
  ωCPO.of PUnit

/-- The two nullary observations which the source proof keeps distinct. -/
inductive ExplicitNullary where
  | deadlock
  | divergence
deriving DecidableEq

/-- Operational equivalence exposes the constructors themselves. -/
def OperationallyEquivalent
    (left right : ExplicitNullary) : Prop :=
  left = right

/--
The D1-A nullary denotation.  Both constructors are interpreted by the
single bottom computation of the concrete all-omega-CPO effect.
-/
def denote (program : ExplicitNullary) :
    Effect NullaryObject :=
  match program with
  | .deadlock => effectDeadlock NullaryObject
  | .divergence => effectDivergence NullaryObject

@[simp]
theorem denote_deadlock_eq_divergence :
    denote .deadlock = denote .divergence := by
  exact
    (effectDivergence_eq_effectDeadlock
      NullaryObject).symm

theorem deadlock_not_operationallyEquivalent_divergence :
    ¬ OperationallyEquivalent .deadlock .divergence := by
  intro equal
  cases equal

/--
Full abstraction for this explicit-nullary extension would say that
denotational equality is exactly operational equality.
-/
def FullAbstract : Prop :=
  ∀ left right,
    denote left = denote right ↔
      OperationallyEquivalent left right

/--
Kernel no-go: D1-A cannot be fully abstract for a language which exposes and
observationally separates both effect-level nullary constants.
-/
theorem not_fullAbstract :
    ¬ FullAbstract := by
  intro full
  have equivalent :
      OperationallyEquivalent .deadlock .divergence :=
    (full .deadlock .divergence).mp
      denote_deadlock_eq_divergence
  exact
    deadlock_not_operationallyEquivalent_divergence
      equivalent

/--
Consequently, a full-abstraction theorem for the ordinary pi calculus must
not silently quantify over the auxiliary explicit-bottom extension.
-/
theorem fullAbstraction_requires_hidden_auxiliary_bottom
    (claim :
      ∀ left right,
        denote left = denote right →
          OperationallyEquivalent left right) :
    False :=
  deadlock_not_operationallyEquivalent_divergence
    (claim .deadlock .divergence
      denote_deadlock_eq_divergence)

end Cantilune.Pi.FMSUnseparatedExplicitBottomNoGo
