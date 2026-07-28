import Cantilune.Pi.P1bLabelledThreadInversion

/-!
# Same-polarity guarded-continuation orbit for P1b

The augmented requesting fingerprint counts output and input prefixes but does
not remember their sequential order.  In particular, it cannot distinguish
the canonical pair of same-polarity threads

* `send ; send`, and
* `recv ; recv`

from `P1bLabelledThreadInversion.crossedPolarityRequesting`, whose two threads
are `send ; recv` and `recv ; send`.

This file adds the smallest order-sensitive invariant needed for that
distinction.  For every output prefix it counts all output prefixes guarded by
that prefix; the input metric is dual.  Binary constructors add the metrics,
so parallel and choice ACU, restriction permutation, and scope extrusion
preserve them.  Raw renaming and alpha conversion preserve the constructor
skeleton and therefore preserve both metrics as well.

This is deliberately not a complete nominal-incidence classifier.  It proves
that a structural representative of the canonical source cannot be the
crossed-polarity source, but it does not yet recover the public/session
subjects, transmitted value, or input binders from an arbitrary representative.
-/

namespace Cantilune.Pi

namespace Raw.Proc

/--
Number of ordered pairs of output prefixes in which the second prefix occurs
inside the guarded continuation of the first.
-/
def guardedSendPairCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => guardedSendPairCount next
  | .send _ _ next =>
      next.sendPrefixCount + guardedSendPairCount next
  | .recv _ _ next => guardedSendPairCount next
  | .choice left right =>
      guardedSendPairCount left + guardedSendPairCount right
  | .par left right =>
      guardedSendPairCount left + guardedSendPairCount right
  | .new _ body => guardedSendPairCount body
  | .matchEq _ _ next => guardedSendPairCount next
  | .matchNe _ _ next => guardedSendPairCount next

/--
Number of ordered pairs of input prefixes in which the second prefix occurs
inside the guarded continuation of the first.
-/
def guardedRecvPairCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => guardedRecvPairCount next
  | .send _ _ next => guardedRecvPairCount next
  | .recv _ _ next =>
      next.recvPrefixCount + guardedRecvPairCount next
  | .choice left right =>
      guardedRecvPairCount left + guardedRecvPairCount right
  | .par left right =>
      guardedRecvPairCount left + guardedRecvPairCount right
  | .new _ body => guardedRecvPairCount body
  | .matchEq _ _ next => guardedRecvPairCount next
  | .matchNe _ _ next => guardedRecvPairCount next

/-- Raw name substitution preserves guarded output-prefix order. -/
theorem guardedSendPairCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).guardedSendPairCount =
      process.guardedSendPairCount := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, guardedSendPairCount,
      Raw.Proc.sendPrefixCount_substRaw] <;>
    split <;>
    simp_all

/-- Raw name substitution preserves guarded input-prefix order. -/
theorem guardedRecvPairCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).guardedRecvPairCount =
      process.guardedRecvPairCount := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, guardedRecvPairCount] <;>
    split <;>
    simp_all [Raw.Proc.recvPrefixCount_substRaw]

end Raw.Proc

namespace Late.Alpha

/-- Alpha conversion preserves guarded output-prefix order. -/
theorem guardedSendPairCount_eq
    (relation : Alpha left right) :
    left.guardedSendPairCount = right.guardedSendPairCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simp [Raw.Proc.guardedSendPairCount, inductionHypothesis,
        Late.Alpha.sendPrefixCount_eq relation]
  | recv relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedSendPairCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedSendPairCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | recvBinder fresh =>
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.guardedSendPairCount_substRaw]
  | newBinder fresh =>
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.guardedSendPairCount_substRaw]

/-- Alpha conversion preserves guarded input-prefix order. -/
theorem guardedRecvPairCount_eq
    (relation : Alpha left right) :
    left.guardedRecvPairCount = right.guardedRecvPairCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.guardedRecvPairCount, inductionHypothesis,
        Late.Alpha.recvPrefixCount_eq relation]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedRecvPairCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedRecvPairCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | recvBinder fresh =>
      simp [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.guardedRecvPairCount_substRaw,
        Raw.Proc.recvPrefixCount_substRaw]
  | newBinder fresh =>
      simp [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.guardedRecvPairCount_substRaw]

end Late.Alpha

namespace Late.Struct

/--
The guarded output-prefix order metric is invariant under the complete
structural congruence, including alpha, both ACU theories, `newComm`, and scope
extrusion.
-/
theorem guardedSendPairCount_eq
    (relation : Struct left right) :
    left.guardedSendPairCount = right.guardedSendPairCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.guardedSendPairCount_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simp [Raw.Proc.guardedSendPairCount, inductionHypothesis,
        Late.Struct.sendPrefixCount_eq relation]
  | recv relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedSendPairCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedSendPairCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.guardedSendPairCount]
  | parComm =>
      simp [Raw.Proc.guardedSendPairCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.guardedSendPairCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.guardedSendPairCount]
  | choiceComm =>
      simp [Raw.Proc.guardedSendPairCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.guardedSendPairCount, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

/--
The guarded input-prefix order metric is invariant under the complete
structural congruence.
-/
theorem guardedRecvPairCount_eq
    (relation : Struct left right) :
    left.guardedRecvPairCount = right.guardedRecvPairCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.guardedRecvPairCount_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.guardedRecvPairCount, inductionHypothesis,
        Late.Struct.recvPrefixCount_eq relation]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedRecvPairCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.guardedRecvPairCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.guardedRecvPairCount]
  | parComm =>
      simp [Raw.Proc.guardedRecvPairCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.guardedRecvPairCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.guardedRecvPairCount]
  | choiceComm =>
      simp [Raw.Proc.guardedRecvPairCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.guardedRecvPairCount, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

end Late.Struct

namespace P1bRequestingPolarityOrbit

open Cantilune.Pi.Protocols
open P1bRequestingFingerprint
open P1bLabelledThreadInversion

/-- The canonical source has one guarded same-output pair and one same-input pair. -/
theorem canonicalRequesting_guardedPairCounts :
    canonicalRequesting.guardedSendPairCount = 1 ∧
      canonicalRequesting.guardedRecvPairCount = 1 := by
  norm_num [canonicalRequesting, closedRestrictedHandshake,
    restrictedHandshake, request, accept, requestContinuation,
    acceptContinuation, Proc.erase, Raw.Proc.guardedSendPairCount,
    Raw.Proc.guardedRecvPairCount, Raw.Proc.sendPrefixCount,
    Raw.Proc.recvPrefixCount]

/--
Every structural representative of the canonical source retains its two
same-polarity guarded-prefix pairs.
-/
theorem guardedPairCounts_of_struct_canonicalRequesting
    {source : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source) :
    source.guardedSendPairCount = 1 ∧
      source.guardedRecvPairCount = 1 := by
  rcases canonicalRequesting_guardedPairCounts with
    ⟨canonicalSend, canonicalRecv⟩
  exact ⟨
    (Late.Struct.guardedSendPairCount_eq relation).symm.trans canonicalSend,
    (Late.Struct.guardedRecvPairCount_eq relation).symm.trans canonicalRecv
  ⟩

/--
The crossed source has the same augmented requesting fingerprint but no
same-polarity guarded-prefix pair.
-/
theorem crossedPolarityRequesting_guardedPairCounts :
    crossedPolarityRequesting.guardedSendPairCount = 0 ∧
      crossedPolarityRequesting.guardedRecvPairCount = 0 := by
  norm_num [crossedPolarityRequesting,
    Raw.Proc.guardedSendPairCount, Raw.Proc.guardedRecvPairCount,
    Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount]

/--
The crossed-polarity counterexample is outside the complete structural orbit
of the canonical requesting source.  This is the strict strengthening over
`AugmentedRequestingFingerprint`: both sources satisfy that fingerprint, but
their guarded-pair counts differ.
-/
theorem not_struct_canonical_crossedPolarityRequesting :
    ¬ Late.Struct canonicalRequesting crossedPolarityRequesting := by
  intro relation
  have canonicalOrbit :=
    guardedPairCounts_of_struct_canonicalRequesting relation
  have crossedOrbit :=
    crossedPolarityRequesting_guardedPairCounts
  omega

/--
Pointwise source-orbit classifier: every representative reached from the
canonical source is syntactically distinct from the crossed-polarity source.
-/
theorem struct_canonical_source_ne_crossedPolarityRequesting
    {source : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source) :
    source ≠ crossedPolarityRequesting := by
  intro equality
  subst source
  exact not_struct_canonical_crossedPolarityRequesting relation

end P1bRequestingPolarityOrbit

end Cantilune.Pi
