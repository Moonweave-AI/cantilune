import Cantilune.Pi.FMSCpoFiniteSupportTensor
import Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini

/-!
# Empty-support strict constants and separated commutativity

This file isolates the support-separated analogue of
`FMSCpoNondeterministicCanonicalFubini.no_commutative_first_strict_pairing`.
The domain of the candidate pairing is the genuine finite-support separated
tensor, rather than an unrestricted cartesian product.

The theorem is deliberately conditional.  It assumes:

* divergence and deadlock both have empty finite resource support;
* consequently the mixed pairs `(divergence, deadlock)` and
  `(deadlock, divergence)` belong to the separated tensor;
* the pairing is continuous on that separated tensor;
* it is first-strict for both constants;
* it commutes with the separated braiding and an output symmetry;
* the output symmetry fixes the distinguished constants.

Under precisely those hypotheses, symmetry evaluates the same mixed point
once as deadlock and once as divergence, so the constants collapse.

This is **not** a no-go theorem for Abramsky powerdomains in general.  The
argument does not apply if the mixed point is absent (for example because
the constants have incompatible support), if one strictness law is dropped,
if the tensor is ordered rather than symmetric, if the output action does not
fix the distinguished constant, or if divergence and deadlock are intentionally
unseparated.  Nor does it construct or refute a recursive FMS domain equation.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoFiniteSupportStrictConstantsNoGo

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSFiniteSupportSeparation
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated

universe u v

/-! ## The exact resource-level premise -/

namespace ResourceLevel

variable
    {Resource : Type}
    [DecidableEq Resource]

/--
Two computation constants with empty resource support are composable in any
finite-support separation algebra.  The result has the same support as the
PCM unit.

Nothing here says that either computation constant, or their composite, is
equal to the PCM unit: the conclusion is only about resource support.
-/
theorem empty_supported_constants_compose
    (algebra : SeparationAlgebra Resource)
    (divergence deadlock : algebra.Carrier)
    (divergence_support :
      algebra.support divergence = ∅)
    (deadlock_support :
      algebra.support deadlock = ∅) :
    ∃ result,
      algebra.Compose divergence deadlock result ∧
        algebra.support result = algebra.support algebra.empty := by
  have compatible :
      Disjoint
        (algebra.support divergence)
        (algebra.support deadlock) := by
    rw [divergence_support, deadlock_support]
    exact Finset.disjoint_empty_left _
  rcases
      (algebra.compose_exists_iff_disjoint
        divergence deadlock).mpr compatible with
    ⟨result, composition⟩
  refine ⟨result, composition, ?_⟩
  rw [algebra.support_compose composition,
    divergence_support, deadlock_support,
    algebra.support_empty]
  exact Finset.empty_union ∅

end ResourceLevel

/-! ## Empty-supported constants in the omega-CPO tensor -/

variable
    {Resource : Type u}
    [DecidableEq Resource]

/--
Distinguished divergence and deadlock values whose *resource supports* are
both empty.  Distinctness is not built into this structure: it is the
additional premise contradicted by the no-go theorem below.
-/
structure EmptySupportConstants
    (object : SupportedOmegaCpo Resource) where
  divergence : object.Carrier
  deadlock : object.Carrier
  divergence_support :
    object.support divergence = ∅
  deadlock_support :
    object.support deadlock = ∅

namespace EmptySupportConstants

variable
    {object : SupportedOmegaCpo Resource}
    (constants : EmptySupportConstants object)

/-- Divergence is separated from every right-hand value. -/
def leftDivergence
    (right : object.Carrier) :
    Carrier object object where
  fst := constants.divergence
  snd := right
  separated := by
    rw [constants.divergence_support]
    exact Finset.disjoint_empty_left _

/-- Deadlock is separated from every right-hand value. -/
def leftDeadlock
    (right : object.Carrier) :
    Carrier object object where
  fst := constants.deadlock
  snd := right
  separated := by
    rw [constants.deadlock_support]
    exact Finset.disjoint_empty_left _

@[simp]
theorem leftDivergence_fst
    (right : object.Carrier) :
    (constants.leftDivergence right).fst =
      constants.divergence :=
  rfl

@[simp]
theorem leftDivergence_snd
    (right : object.Carrier) :
    (constants.leftDivergence right).snd = right :=
  rfl

@[simp]
theorem leftDeadlock_fst
    (right : object.Carrier) :
    (constants.leftDeadlock right).fst =
      constants.deadlock :=
  rfl

@[simp]
theorem leftDeadlock_snd
    (right : object.Carrier) :
    (constants.leftDeadlock right).snd = right :=
  rfl

/--
The separated braiding exchanges the mixed divergence/deadlock point.
Proof irrelevance discharges the two independently constructed separation
certificates.
-/
theorem braiding_leftDivergence_deadlock :
    braidingContinuous object object
        (constants.leftDivergence constants.deadlock) =
      constants.leftDeadlock constants.divergence := by
  apply Carrier.ext <;> rfl

/-- The reverse mixed point is exchanged in the other direction. -/
theorem braiding_leftDeadlock_divergence :
    braidingContinuous object object
        (constants.leftDeadlock constants.divergence) =
      constants.leftDivergence constants.deadlock := by
  apply Carrier.ext <;> rfl

end EmptySupportConstants

/-! ## The separated strict-constants obstruction -/

/--
A candidate symmetric Fubini-like pairing on the separated tensor.

The output symmetry is kept explicit because a genuine Fubini commutativity
square also acts on the paired output object.  Fixing both constants records
the usual naturality of divergence and deadlock under coordinate exchange.
-/
structure SymmetricFirstStrictPairing
    (source target : SupportedOmegaCpo Resource)
    (sourceConstants : EmptySupportConstants source)
    (targetConstants : EmptySupportConstants target) where
  pairing :
    (tensor source source).Carrier →𝒄 target.Carrier
  outputSwap :
    target.Carrier →𝒄 target.Carrier
  outputSwap_divergence :
    outputSwap targetConstants.divergence =
      targetConstants.divergence
  outputSwap_deadlock :
    outputSwap targetConstants.deadlock =
      targetConstants.deadlock
  first_divergence :
    ∀ right,
      pairing (sourceConstants.leftDivergence right) =
        targetConstants.divergence
  first_deadlock :
    ∀ right,
      pairing (sourceConstants.leftDeadlock right) =
        targetConstants.deadlock
  commutes :
    ContinuousHom.comp pairing
        (braidingContinuous source source) =
      ContinuousHom.comp outputSwap pairing

/--
Symmetry plus the two first-strict laws collapses target deadlock to target
divergence.  This orientation uses only that output symmetry fixes
divergence.
-/
theorem symmetric_first_strict_pairing_collapses
    {source target : SupportedOmegaCpo Resource}
    {sourceConstants : EmptySupportConstants source}
    {targetConstants : EmptySupportConstants target}
    (candidate :
      SymmetricFirstStrictPairing
        source target sourceConstants targetConstants) :
    targetConstants.deadlock =
      targetConstants.divergence := by
  have pointwise :=
    ContinuousHom.congr_fun candidate.commutes
      (sourceConstants.leftDivergence
        sourceConstants.deadlock)
  change
    candidate.pairing
        (braidingContinuous source source
          (sourceConstants.leftDivergence
            sourceConstants.deadlock)) =
      candidate.outputSwap
        (candidate.pairing
          (sourceConstants.leftDivergence
            sourceConstants.deadlock))
    at pointwise
  calc
    targetConstants.deadlock =
        candidate.pairing
          (sourceConstants.leftDeadlock
            sourceConstants.divergence) :=
      (candidate.first_deadlock _).symm
    _ =
        candidate.pairing
          (braidingContinuous source source
            (sourceConstants.leftDivergence
              sourceConstants.deadlock)) := by
      rw [
        sourceConstants.braiding_leftDivergence_deadlock]
    _ =
        candidate.outputSwap
          (candidate.pairing
            (sourceConstants.leftDivergence
              sourceConstants.deadlock)) :=
      pointwise
    _ =
        candidate.outputSwap
          targetConstants.divergence := by
      rw [candidate.first_divergence]
    _ = targetConstants.divergence :=
      candidate.outputSwap_divergence

/--
The reverse evaluation gives the opposite-oriented collapse.  This proof
uses only that output symmetry fixes deadlock.
-/
theorem symmetric_first_strict_pairing_collapses_reverse
    {source target : SupportedOmegaCpo Resource}
    {sourceConstants : EmptySupportConstants source}
    {targetConstants : EmptySupportConstants target}
    (candidate :
      SymmetricFirstStrictPairing
        source target sourceConstants targetConstants) :
    targetConstants.divergence =
      targetConstants.deadlock := by
  have pointwise :=
    ContinuousHom.congr_fun candidate.commutes
      (sourceConstants.leftDeadlock
        sourceConstants.divergence)
  change
    candidate.pairing
        (braidingContinuous source source
          (sourceConstants.leftDeadlock
            sourceConstants.divergence)) =
      candidate.outputSwap
        (candidate.pairing
          (sourceConstants.leftDeadlock
            sourceConstants.divergence))
    at pointwise
  calc
    targetConstants.divergence =
        candidate.pairing
          (sourceConstants.leftDivergence
            sourceConstants.deadlock) :=
      (candidate.first_divergence _).symm
    _ =
        candidate.pairing
          (braidingContinuous source source
            (sourceConstants.leftDeadlock
              sourceConstants.divergence)) := by
      rw [
        sourceConstants.braiding_leftDeadlock_divergence]
    _ =
        candidate.outputSwap
          (candidate.pairing
            (sourceConstants.leftDeadlock
              sourceConstants.divergence)) :=
      pointwise
    _ =
        candidate.outputSwap
          targetConstants.deadlock := by
      rw [candidate.first_deadlock]
    _ = targetConstants.deadlock :=
      candidate.outputSwap_deadlock

/--
Therefore no such candidate can coexist with a proof that target divergence
and target deadlock are distinct.
-/
theorem no_symmetric_first_strict_pairing_of_distinct_constants
    {source target : SupportedOmegaCpo Resource}
    {sourceConstants : EmptySupportConstants source}
    {targetConstants : EmptySupportConstants target}
    (distinct :
      targetConstants.divergence ≠
        targetConstants.deadlock)
    (candidate :
      SymmetricFirstStrictPairing
        source target sourceConstants targetConstants) :
    False :=
  distinct
    (symmetric_first_strict_pairing_collapses_reverse
      candidate)

end Cantilune.Pi.FMSCpoFiniteSupportStrictConstantsNoGo
