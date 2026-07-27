import Cantilune.Pi.LateStructuralQuotient

/-!
# Name support under standard late-pi equivalences

The raw late semantics uses nominal binders and a total capture-avoiding
substitution.  In order to realize the structural quotient categorically, the
selected state equivalence must preserve the observable free-name interface.

This module proves that fact from the inductive definitions.  In particular,
the binder-renaming constructors of `Late.Alpha` are discharged by a
substitution-support theorem rather than by postulating alpha conversion as
an opaque primitive.
-/

namespace Cantilune.Pi

namespace Raw.Proc

/--
Number of executable prefix/guard constructors.  Parallel, choice, and
restriction only aggregate or hide prefixes and therefore do not contribute
an extra unit.
-/
def prefixCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => prefixCount next + 1
  | .send _ _ next => prefixCount next + 1
  | .recv _ _ next => prefixCount next + 1
  | .choice left right => prefixCount left + prefixCount right
  | .par left right => prefixCount left + prefixCount right
  | .new _ body => prefixCount body
  | .matchEq _ _ next => prefixCount next + 1
  | .matchNe _ _ next => prefixCount next + 1

/--
Number of communication prefixes.  Output and input contribute one; silent
and guard prefixes do not.  This separates genuine binary communication from
the unary `tau`/guard rules while retaining the same additive behaviour under
parallel, choice, and restriction.
-/
def communicationPrefixCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => communicationPrefixCount next
  | .send _ _ next => communicationPrefixCount next + 1
  | .recv _ _ next => communicationPrefixCount next + 1
  | .choice left right =>
      communicationPrefixCount left + communicationPrefixCount right
  | .par left right =>
      communicationPrefixCount left + communicationPrefixCount right
  | .new _ body => communicationPrefixCount body
  | .matchEq _ _ next => communicationPrefixCount next
  | .matchNe _ _ next => communicationPrefixCount next

/-- Number of executable unary `tau` or guard prefixes. -/
def unaryPrefixCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => unaryPrefixCount next + 1
  | .send _ _ next => unaryPrefixCount next
  | .recv _ _ next => unaryPrefixCount next
  | .choice left right => unaryPrefixCount left + unaryPrefixCount right
  | .par left right => unaryPrefixCount left + unaryPrefixCount right
  | .new _ body => unaryPrefixCount body
  | .matchEq _ _ next => unaryPrefixCount next + 1
  | .matchNe _ _ next => unaryPrefixCount next + 1

/--
Names occurring freely as prefix subjects.  Payload-only occurrences are
excluded, which is essential for closed-channel protocols that intentionally
retain free data values.
-/
def freeSubjects : Raw.Proc → Finset Name
  | .zero => ∅
  | .tau next => freeSubjects next
  | .send channel _ next => insert channel (freeSubjects next)
  | .recv channel binder next =>
      insert channel ((freeSubjects next).erase binder)
  | .choice left right => freeSubjects left ∪ freeSubjects right
  | .par left right => freeSubjects left ∪ freeSubjects right
  | .new binder body => (freeSubjects body).erase binder
  | .matchEq _ _ next => freeSubjects next
  | .matchNe _ _ next => freeSubjects next

/-- Every free prefix subject is a free process name. -/
theorem freeSubjects_subset_freeNames (process : Raw.Proc) :
    process.freeSubjects ⊆ process.freeNames := by
  induction process <;>
    simp_all [freeSubjects, freeNames, Finset.subset_iff] <;>
    aesop

/-- Executable prefixes partition into communication and unary prefixes. -/
theorem prefixCount_eq_communication_add_unary
    (process : Raw.Proc) :
    process.prefixCount =
      process.communicationPrefixCount + process.unaryPrefixCount := by
  induction process <;>
    simp_all [prefixCount, communicationPrefixCount, unaryPrefixCount] <;>
    omega

/-- Communication prefixes are a subcount of executable prefixes. -/
theorem communicationPrefixCount_le_prefixCount
    (process : Raw.Proc) :
    process.communicationPrefixCount ≤ process.prefixCount := by
  induction process <;>
    simp_all [communicationPrefixCount, prefixCount] <;>
    omega

/-- Raw name substitution preserves the process constructor skeleton. -/
theorem prefixCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).prefixCount =
      process.prefixCount := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, prefixCount] <;>
    split <;> simp_all

/-- Raw name substitution preserves the number of communication prefixes. -/
theorem communicationPrefixCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).communicationPrefixCount =
      process.communicationPrefixCount := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, communicationPrefixCount] <;>
    split <;> simp_all

/-- The fuelled capture-avoiding implementation preserves constructor count. -/
theorem prefixCount_substituteCaptureAvoidingAux
    (fuel : Nat) (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoidingAux fuel needle replacement).prefixCount =
      process.prefixCount := by
  induction fuel generalizing process with
  | zero =>
      rfl
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          rfl
      | tau next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
            inductionHypothesis]
      | send channel value next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
            inductionHypothesis]
      | recv channel binder next =>
          by_cases boundNeedle : binder = needle
          · simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
              boundNeedle]
          · by_cases boundReplacement : binder = replacement
            · have replacementNotNeedle : replacement ≠ needle := by
                intro equality
                exact boundNeedle (boundReplacement.trans equality)
              simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
                boundReplacement, inductionHypothesis,
                replacementNotNeedle,
                Raw.Proc.renameBound_eq_substRaw,
                Raw.Proc.prefixCount_substRaw]
            · simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
                boundNeedle, boundReplacement, inductionHypothesis]
      | choice left right =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
            inductionHypothesis]
      | par left right =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
            inductionHypothesis]
      | new binder body =>
          by_cases boundNeedle : binder = needle
          · simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
              boundNeedle]
          · by_cases boundReplacement : binder = replacement
            · have replacementNotNeedle : replacement ≠ needle := by
                intro equality
                exact boundNeedle (boundReplacement.trans equality)
              simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
                boundReplacement, inductionHypothesis,
                replacementNotNeedle,
                Raw.Proc.renameBound_eq_substRaw,
                Raw.Proc.prefixCount_substRaw]
            · simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
                boundNeedle, boundReplacement, inductionHypothesis]
      | matchEq left right next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
            inductionHypothesis]
      | matchNe left right next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, prefixCount,
            inductionHypothesis]

/-- Total capture-avoiding substitution preserves executable prefix count. -/
theorem prefixCount_substituteCaptureAvoiding
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).prefixCount =
      process.prefixCount := by
  unfold Raw.Proc.substituteCaptureAvoiding
  split
  · exact
      prefixCount_substituteCaptureAvoidingAux
        process.syntaxDepth process needle replacement
  · exact prefixCount_substRaw process needle replacement

/--
If `replacement` is fresh for a process, raw substitution changes its
free-name set only by replacing `needle` with `replacement`.  Erasing the new
name therefore recovers the old support with `needle` erased.

This is the exact support fact needed by both input- and restriction-binder
alpha conversion.
-/
theorem freeNames_substRaw_erase_replacement
    (process : Raw.Proc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    (process.substRaw needle replacement).freeNames.erase replacement =
      process.freeNames.erase needle := by
  induction process with
  | zero =>
      simp [Raw.Proc.substRaw, freeNames]
  | tau next ih =>
      have nextFresh : replacement ∉ next.allNames := by
        simpa [allNames] using fresh
      simpa [Raw.Proc.substRaw, freeNames] using ih nextFresh
  | send channel value next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, valueFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (Raw.Proc.freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        by_cases valueNeedle : value = needle <;>
        simp_all <;> aesop
  | recv channel binder next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, binderFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (Raw.Proc.freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop
  | choice left right leftIH rightIH =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ left.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ right.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [Raw.Proc.substRaw, freeNames, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | par left right leftIH rightIH =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ left.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ right.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [Raw.Proc.substRaw, freeNames, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | new binder body ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨binderFresh, bodyFresh⟩
      have bodySupport := ih bodyFresh
      have bodyFreeFresh : replacement ∉ body.freeNames :=
        fun member =>
          bodyFresh (Raw.Proc.freeNames_subset_allNames body member)
      ext name
      have bodyMembership :
          (name ≠ replacement ∧
              name ∈ (body.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ body.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) bodySupport).to_iff
      simp only [Raw.Proc.substRaw, freeNames, Finset.mem_erase]
      by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop
  | matchEq left right next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (Raw.Proc.freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases leftNeedle : left = needle <;>
        by_cases rightNeedle : right = needle <;>
        simp_all <;> aesop
  | matchNe left right next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (Raw.Proc.freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases leftNeedle : left = needle <;>
      by_cases rightNeedle : right = needle <;>
        simp_all <;> aesop

/--
The corresponding fresh-renaming theorem for prefix subjects.  This is the
nominal fact required to show that alpha conversion cannot turn a free data
payload into a free channel subject.
-/
theorem freeSubjects_substRaw_erase_replacement
    (process : Raw.Proc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    (process.substRaw needle replacement).freeSubjects.erase replacement =
      process.freeSubjects.erase needle := by
  induction process with
  | zero =>
      simp [Raw.Proc.substRaw, freeSubjects]
  | tau next inductionHypothesis =>
      have nextFresh : replacement ∉ next.allNames := by
        simpa [allNames] using fresh
      simpa [Raw.Proc.substRaw, freeSubjects] using
        inductionHypothesis nextFresh
  | send channel value next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, _valueFresh, nextFresh⟩
      have nextSupport := inductionHypothesis nextFresh
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeSubjects) ↔
            (name ≠ needle ∧ name ∈ next.freeSubjects) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeSubjects, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        simp_all <;> aesop
  | recv channel binder next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, binderFresh, nextFresh⟩
      have nextSupport := inductionHypothesis nextFresh
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeSubjects) ↔
            (name ≠ needle ∧ name ∈ next.freeSubjects) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeSubjects, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop
  | choice left right leftIH rightIH =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeSubjects) ↔
            (name ≠ needle ∧ name ∈ left.freeSubjects) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeSubjects) ↔
            (name ≠ needle ∧ name ∈ right.freeSubjects) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [Raw.Proc.substRaw, freeSubjects, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | par left right leftIH rightIH =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeSubjects) ↔
            (name ≠ needle ∧ name ∈ left.freeSubjects) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeSubjects) ↔
            (name ≠ needle ∧ name ∈ right.freeSubjects) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [Raw.Proc.substRaw, freeSubjects, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | new binder body inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨binderFresh, bodyFresh⟩
      have bodySupport := inductionHypothesis bodyFresh
      ext name
      have bodyMembership :
          (name ≠ replacement ∧
              name ∈ (body.substRaw needle replacement).freeSubjects) ↔
            (name ≠ needle ∧ name ∈ body.freeSubjects) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) bodySupport).to_iff
      simp only [Raw.Proc.substRaw, freeSubjects, Finset.mem_erase]
      by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop
  | matchEq left right next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, freeSubjects] using
        inductionHypothesis nextFresh
  | matchNe left right next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, freeSubjects] using
        inductionHypothesis nextFresh

end Raw.Proc

namespace Raw.Action

/-- Only the silent action has an empty free-name interface. -/
theorem freeNames_eq_empty_iff (action : Raw.Action) :
    action.freeNames = ∅ ↔ action = .tau := by
  cases action <;> simp [Raw.Action.freeNames]

/-- A label's channel subject is supported by a set of free subjects. -/
def SubjectSupported (action : Raw.Action) (subjects : Finset Name) : Prop :=
  match action with
  | .tau => True
  | .output channel _ => channel ∈ subjects
  | .input channel _ => channel ∈ subjects
  | .boundOutput channel _ => channel ∈ subjects

/-- No non-silent action is supported by the empty subject interface. -/
theorem eq_tau_of_subjectSupported_empty
    (action : Raw.Action)
    (supported : action.SubjectSupported ∅) :
    action = .tau := by
  cases action <;>
    simp_all [SubjectSupported]

end Raw.Action

namespace Late.Alpha

/-- Alpha conversion preserves the executable constructor count. -/
theorem prefixCount_eq
    (relation : Alpha left right) :
    left.prefixCount = right.prefixCount := by
  induction relation <;>
    simp_all [Raw.Proc.prefixCount, Raw.Proc.renameBound_eq_substRaw,
      Raw.Proc.prefixCount_substRaw]

/-- Alpha conversion preserves the communication-prefix subcount. -/
theorem communicationPrefixCount_eq
    (relation : Alpha left right) :
    left.communicationPrefixCount = right.communicationPrefixCount := by
  induction relation <;>
    simp_all [Raw.Proc.communicationPrefixCount,
      Raw.Proc.renameBound_eq_substRaw,
      Raw.Proc.communicationPrefixCount_substRaw]

/-- Alpha conversion preserves the free prefix-subject interface. -/
theorem freeSubjects_eq
    (relation : Alpha left right) :
    left.freeSubjects = right.freeSubjects := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.freeSubjects] using inductionHypothesis
  | send relation inductionHypothesis =>
      simp [Raw.Proc.freeSubjects, inductionHypothesis]
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.freeSubjects, inductionHypothesis]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeSubjects, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeSubjects, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simp [Raw.Proc.freeSubjects, inductionHypothesis]
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.freeSubjects] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.freeSubjects] using inductionHypothesis
  | recvBinder fresh =>
      simp only [Raw.Proc.freeSubjects, Raw.Proc.renameBound_eq_substRaw]
      rw [Raw.Proc.freeSubjects_substRaw_erase_replacement _ _ _ fresh]
  | newBinder fresh =>
      simp only [Raw.Proc.freeSubjects, Raw.Proc.renameBound_eq_substRaw]
      rw [Raw.Proc.freeSubjects_substRaw_erase_replacement _ _ _ fresh]

/-- Alpha-equivalent raw processes expose exactly the same free names. -/
theorem freeNames_eq
    (relation : Alpha left right) :
    left.freeNames = right.freeNames := by
  induction relation with
  | refl process =>
      rfl
  | symm relation ih =>
      exact ih.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | send relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | recv relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeNames, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeNames, leftIH, rightIH]
  | new relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | matchEq relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | matchNe relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | recvBinder fresh =>
      simp only [Raw.Proc.freeNames, Raw.Proc.renameBound_eq_substRaw]
      rw [Raw.Proc.freeNames_substRaw_erase_replacement _ _ _ fresh]
  | newBinder fresh =>
      simp only [Raw.Proc.freeNames, Raw.Proc.renameBound_eq_substRaw]
      rw [Raw.Proc.freeNames_substRaw_erase_replacement _ _ _ fresh]

end Late.Alpha

namespace Late.Struct

/-- Structural congruence preserves the executable constructor count. -/
theorem prefixCount_eq
    (relation : Struct left right) :
    left.prefixCount = right.prefixCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation ih =>
      exact ih.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.prefixCount_eq relation
  | tau relation ih =>
      simp [Raw.Proc.prefixCount, ih]
  | send relation ih =>
      simp [Raw.Proc.prefixCount, ih]
  | recv relation ih =>
      simp [Raw.Proc.prefixCount, ih]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.prefixCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.prefixCount, leftIH, rightIH]
  | new relation ih =>
      simp [Raw.Proc.prefixCount, ih]
  | matchEq relation ih =>
      simp [Raw.Proc.prefixCount, ih]
  | matchNe relation ih =>
      simp [Raw.Proc.prefixCount, ih]
  | parZero =>
      simp [Raw.Proc.prefixCount]
  | parComm =>
      simp [Raw.Proc.prefixCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.prefixCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.prefixCount]
  | choiceComm =>
      simp [Raw.Proc.prefixCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.prefixCount, Nat.add_assoc]
  | newZero =>
      simp [Raw.Proc.prefixCount]
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      simp [Raw.Proc.prefixCount]

/-- Structural congruence preserves the communication-prefix subcount. -/
theorem communicationPrefixCount_eq
    (relation : Struct left right) :
    left.communicationPrefixCount = right.communicationPrefixCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.communicationPrefixCount_eq relation
  | tau relation inductionHypothesis =>
      simp [Raw.Proc.communicationPrefixCount, inductionHypothesis]
  | send relation inductionHypothesis =>
      simp [Raw.Proc.communicationPrefixCount, inductionHypothesis]
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.communicationPrefixCount, inductionHypothesis]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.communicationPrefixCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.communicationPrefixCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simp [Raw.Proc.communicationPrefixCount, inductionHypothesis]
  | matchEq relation inductionHypothesis =>
      simp [Raw.Proc.communicationPrefixCount, inductionHypothesis]
  | matchNe relation inductionHypothesis =>
      simp [Raw.Proc.communicationPrefixCount, inductionHypothesis]
  | parZero =>
      simp [Raw.Proc.communicationPrefixCount]
  | parComm =>
      simp [Raw.Proc.communicationPrefixCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.communicationPrefixCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.communicationPrefixCount]
  | choiceComm =>
      simp [Raw.Proc.communicationPrefixCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.communicationPrefixCount, Nat.add_assoc]
  | newZero =>
      simp [Raw.Proc.communicationPrefixCount]
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      simp [Raw.Proc.communicationPrefixCount]

/-- Being communication-only is independent of the structural representative. -/
theorem allCommunication_iff
    (relation : Struct left right) :
    left.prefixCount = left.communicationPrefixCount ↔
      right.prefixCount = right.communicationPrefixCount := by
  rw [prefixCount_eq relation, communicationPrefixCount_eq relation]

/-- Structural congruence preserves the free prefix-subject interface. -/
theorem freeSubjects_eq
    (relation : Struct left right) :
    left.freeSubjects = right.freeSubjects := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.freeSubjects_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.freeSubjects] using inductionHypothesis
  | send relation inductionHypothesis =>
      simp [Raw.Proc.freeSubjects, inductionHypothesis]
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.freeSubjects, inductionHypothesis]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeSubjects, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeSubjects, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simp [Raw.Proc.freeSubjects, inductionHypothesis]
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.freeSubjects] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.freeSubjects] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.freeSubjects]
  | parComm =>
      simp [Raw.Proc.freeSubjects, Finset.union_comm]
  | parAssoc =>
      simp [Raw.Proc.freeSubjects, Finset.union_assoc]
  | choiceZero =>
      simp [Raw.Proc.freeSubjects]
  | choiceComm =>
      simp [Raw.Proc.freeSubjects, Finset.union_comm]
  | choiceAssoc =>
      simp [Raw.Proc.freeSubjects, Finset.union_assoc]
  | newZero =>
      simp [Raw.Proc.freeSubjects]
  | newComm distinct =>
      ext name
      simp only [Raw.Proc.freeSubjects, Finset.mem_erase]
      aesop
  | scopeExtrude fresh =>
      ext name
      simp only [Raw.Proc.freeSubjects, Finset.mem_erase,
        Finset.mem_union]
      constructor
      · intro source
        rcases source with ⟨notBinder, inLeft | inRight⟩
        · exact Or.inl inLeft
        · exact Or.inr ⟨notBinder, inRight⟩
      · intro target
        constructor
        · intro binderEq
          subst name
          rcases target with inLeft | inRight
          · exact fresh
              (Raw.Proc.freeSubjects_subset_freeNames _ inLeft)
          · exact inRight.1 rfl
        · rcases target with inLeft | inRight
          · exact Or.inl inLeft
          · exact Or.inr inRight.2

/--
Structural congruence preserves the free-name interface.  The scope-extrusion
case uses its freshness premise; all alpha cases reduce to
`Late.Alpha.freeNames_eq`.
-/
theorem freeNames_eq
    (relation : Struct left right) :
    left.freeNames = right.freeNames := by
  induction relation with
  | refl process =>
      rfl
  | symm relation ih =>
      exact ih.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.freeNames_eq relation
  | tau relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | send relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | recv relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeNames, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeNames, leftIH, rightIH]
  | new relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | matchEq relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | matchNe relation ih =>
      simp [Raw.Proc.freeNames, ih]
  | parZero =>
      simp [Raw.Proc.freeNames]
  | parComm =>
      simp [Raw.Proc.freeNames, Finset.union_comm]
  | parAssoc =>
      simp [Raw.Proc.freeNames, Finset.union_assoc]
  | choiceZero =>
      simp [Raw.Proc.freeNames]
  | choiceComm =>
      simp [Raw.Proc.freeNames, Finset.union_comm]
  | choiceAssoc =>
      simp [Raw.Proc.freeNames, Finset.union_assoc]
  | newZero =>
      simp [Raw.Proc.freeNames]
  | newComm distinct =>
      ext name
      simp only [Raw.Proc.freeNames, Finset.mem_erase]
      aesop
  | scopeExtrude fresh =>
      ext name
      simp only [Raw.Proc.freeNames, Finset.mem_erase, Finset.mem_union]
      constructor
      · intro source
        rcases source with ⟨notBinder, inLeft | inRight⟩
        · exact Or.inl inLeft
        · exact Or.inr ⟨notBinder, inRight⟩
      · intro target
        constructor
        · intro binderEq
          subst name
          rcases target with inLeft | inRight
          · exact fresh inLeft
          · exact inRight.1 rfl
        · rcases target with inLeft | inRight
          · exact Or.inl inLeft
          · exact Or.inr inRight.2

/-- Structural equivalence to `0` forces an empty free-name interface. -/
theorem freeNames_eq_empty_of_structurallyZero
    (zero : Struct process .zero) :
    process.freeNames = ∅ := by
  simpa [Raw.Proc.freeNames] using freeNames_eq zero

/--
For the finite syntax, structural equivalence to `0` is characterized exactly
by absence of executable prefixes.  This gives a decidable, representative-
independent terminal predicate for the standard structural quotient.
-/
theorem structurallyZero_iff_prefixCount_zero
    (process : Raw.Proc) :
    StructurallyZero process ↔ process.prefixCount = 0 := by
  constructor
  · intro zero
    simpa [StructurallyZero, Raw.Proc.prefixCount] using prefixCount_eq zero
  · intro count
    induction process with
    | zero =>
        exact Struct.refl _
    | tau next ih =>
        simp [Raw.Proc.prefixCount] at count
    | send channel value next ih =>
        simp [Raw.Proc.prefixCount] at count
    | recv channel binder next ih =>
        simp [Raw.Proc.prefixCount] at count
    | choice left right leftIH rightIH =>
        simp only [Raw.Proc.prefixCount, Nat.add_eq_zero_iff] at count
        exact Struct.trans
          (Struct.choice (leftIH count.1) (rightIH count.2))
          (Struct.choiceZero (process := .zero))
    | par left right leftIH rightIH =>
        simp only [Raw.Proc.prefixCount, Nat.add_eq_zero_iff] at count
        exact Struct.trans
          (Struct.par (leftIH count.1) (rightIH count.2))
          (Struct.parZero (process := .zero))
    | new binder body ih =>
        simp only [Raw.Proc.prefixCount] at count
        exact Struct.trans (Struct.new (ih count)) Struct.newZero
    | matchEq left right next ih =>
        simp [Raw.Proc.prefixCount] at count
    | matchNe left right next ih =>
        simp [Raw.Proc.prefixCount] at count

/--
The current standard structural congruence deliberately does not contain the
S4 idempotence equation for choice.  This concrete counterexample proves that
the equation is not derivable indirectly from the existing constructors.
Whether S4 belongs here, in a bisimulation/equational quotient, or only in
the FMS semilattice remains an RFC-level semantic choice.
-/
theorem choice_idempotence_not_structural :
    ¬ Struct
        (.choice (.tau .zero) (.tau .zero))
        (.tau .zero) := by
  intro relation
  have count := prefixCount_eq relation
  norm_num [Raw.Proc.prefixCount] at count

end Late.Struct

namespace Late.NativeStep

/-- Every native label is supported by the source's free prefix subjects. -/
theorem action_subjectSupported_source
    (step : NativeStep source action target) :
    action.SubjectSupported source.freeSubjects := by
  induction step <;>
    simp_all [Raw.Action.SubjectSupported, Raw.Proc.freeSubjects,
      Raw.Action.names] <;>
    aesop

/-- A native label exposes only names already free in its source process. -/
theorem action_freeNames_subset_source
    (step : NativeStep source action target) :
    action.freeNames ⊆ source.freeNames := by
  induction step with
  | prefixTau =>
      simp [Raw.Action.freeNames]
  | prefixOutput =>
      simp [Raw.Action.freeNames, Raw.Proc.freeNames]
  | prefixInput =>
      simp [Raw.Action.freeNames, Raw.Proc.freeNames]
  | matchGuard inner inductionHypothesis =>
      intro name member
      simp only [Raw.Proc.freeNames, Finset.mem_insert]
      exact Or.inr (Or.inr (inductionHypothesis member))
  | mismatchGuard _ inner inductionHypothesis =>
      intro name member
      simp only [Raw.Proc.freeNames, Finset.mem_insert]
      exact Or.inr (Or.inr (inductionHypothesis member))
  | choiceLeft inner inductionHypothesis =>
      exact
        inductionHypothesis.trans
          (by simp [Raw.Proc.freeNames])
  | choiceRight inner inductionHypothesis =>
      exact
        inductionHypothesis.trans
          (by simp [Raw.Proc.freeNames])
  | parLeft _ inner inductionHypothesis =>
      exact
        inductionHypothesis.trans
          (by simp [Raw.Proc.freeNames])
  | parRight _ inner inductionHypothesis =>
      exact
        inductionHypothesis.trans
          (by simp [Raw.Proc.freeNames])
  | syncLeft =>
      simp [Raw.Action.freeNames]
  | syncRight =>
      simp [Raw.Action.freeNames]
  | restrict fresh inner inductionHypothesis =>
      intro name member
      simp only [Raw.Proc.freeNames, Finset.mem_erase]
      refine ⟨?_, inductionHypothesis member⟩
      intro nameEq
      subst name
      apply fresh
      rw [Raw.Action.names_eq_free_union_bound]
      simp only [Finset.mem_union]
      exact Or.inl member
  | «open» distinct inner inductionHypothesis =>
      intro name member
      simp only [Raw.Action.freeNames, Finset.mem_singleton] at member
      subst name
      simp only [Raw.Proc.freeNames, Finset.mem_erase]
      refine ⟨fun equality => distinct equality.symm, ?_⟩
      exact inductionHypothesis (by simp [Raw.Action.freeNames])
  | closeLeft =>
      simp [Raw.Action.freeNames]
  | closeRight =>
      simp [Raw.Action.freeNames]

/-- Every native transition source contains at least one executable prefix. -/
theorem source_prefixCount_pos
  (step : NativeStep source action target) :
    0 < source.prefixCount := by
  induction step <;>
    simp_all [Raw.Proc.prefixCount]

/-- Every native strong-late transition strictly consumes constructor count. -/
theorem target_prefixCount_lt
    (step : NativeStep source action target) :
    target.prefixCount < source.prefixCount := by
  induction step <;>
    simp_all [Raw.Proc.prefixCount,
    Raw.Proc.prefixCount_substituteCaptureAvoiding] <;>
    omega

/--
If every executable prefix in the source is an input or output, a native
silent transition consumes at least two prefixes.  Unary `tau` and guard
rules are excluded by the count equality; the remaining silent base rules
are communication or close.
-/
private theorem target_prefixCount_add_two_le_of_action_eq_tau_all_communication
    (step : NativeStep source action target)
    (silent : action = .tau)
    (noUnary : source.unaryPrefixCount = 0) :
    target.prefixCount + 2 ≤ source.prefixCount := by
  induction step with
  | prefixTau =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | prefixOutput =>
      simp at silent
  | prefixInput =>
      simp at silent
  | matchGuard inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | mismatchGuard distinct inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | choiceLeft inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount, Nat.add_eq_zero_iff] at noUnary
      have residual := inductionHypothesis silent noUnary.1
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | choiceRight inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount, Nat.add_eq_zero_iff] at noUnary
      have residual := inductionHypothesis silent noUnary.2
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | parLeft fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount, Nat.add_eq_zero_iff] at noUnary
      have residual := inductionHypothesis silent noUnary.1
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | parRight fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount, Nat.add_eq_zero_iff] at noUnary
      have residual := inductionHypothesis silent noUnary.2
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | syncLeft outputStep inputStep fresh =>
      have outputDecrease := outputStep.target_prefixCount_lt
      have inputDecrease := inputStep.target_prefixCount_lt
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega
  | syncRight inputStep outputStep fresh =>
      have inputDecrease := inputStep.target_prefixCount_lt
      have outputDecrease := outputStep.target_prefixCount_lt
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega
  | restrict fresh inner inductionHypothesis =>
      exact inductionHypothesis silent noUnary
  | «open» distinct inner inductionHypothesis =>
      simp at silent
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      have outputDecrease := outputStep.target_prefixCount_lt
      have inputDecrease := inputStep.target_prefixCount_lt
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      have inputDecrease := inputStep.target_prefixCount_lt
      have outputDecrease := outputStep.target_prefixCount_lt
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega

/--
Specialization of the communication-only decrease theorem to a silent native
transition.
-/
theorem target_prefixCount_add_two_le_of_tau_all_communication
    (step : NativeStep source .tau target)
    (allCommunication :
      source.prefixCount = source.communicationPrefixCount) :
    target.prefixCount + 2 ≤ source.prefixCount := by
  have partition :=
    Raw.Proc.prefixCount_eq_communication_add_unary source
  have noUnary : source.unaryPrefixCount = 0 := by
    omega
  exact
    target_prefixCount_add_two_le_of_action_eq_tau_all_communication
      step rfl noUnary

end Late.NativeStep

namespace Late.Step

/--
Structural closure preserves label support in the chosen source
representative.
-/
theorem action_subjectSupported_source
    (step : Step source action target) :
    action.SubjectSupported source.freeSubjects := by
  cases step with
  | native native =>
      exact native.action_subjectSupported_source
  | congr sourceCongruence native _targetCongruence =>
      rw [Late.Struct.freeSubjects_eq sourceCongruence]
      exact native.action_subjectSupported_source

/-- A process with no free prefix subject can expose only `tau`. -/
theorem action_eq_tau_of_source_freeSubjects_empty
    (step : Step source action target)
    (closedSubjects : source.freeSubjects = ∅) :
    action = .tau := by
  have supported := step.action_subjectSupported_source
  rw [closedSubjects] at supported
  exact Raw.Action.eq_tau_of_subjectSupported_empty action supported

/--
The free names of a structurally closed label are still contained in the
chosen source representative.
-/
theorem action_freeNames_subset_source
    (step : Step source action target) :
    action.freeNames ⊆ source.freeNames := by
  cases step with
  | native native =>
      exact native.action_freeNames_subset_source
  | congr sourceCongruence native _targetCongruence =>
      rw [Late.Struct.freeNames_eq sourceCongruence]
      exact native.action_freeNames_subset_source

/-- Every transition from a closed raw process is necessarily silent. -/
theorem action_eq_tau_of_source_freeNames_empty
    (step : Step source action target)
    (closed : source.freeNames = ∅) :
    action = .tau := by
  have subset := step.action_freeNames_subset_source
  have actionClosed : action.freeNames = ∅ := by
    ext name
    simp only [Finset.notMem_empty, iff_false]
    intro member
    have sourceMember := subset member
    rw [closed] at sourceMember
    exact Finset.notMem_empty _ sourceMember
  exact (Raw.Action.freeNames_eq_empty_iff action).mp actionClosed

/--
The source of a structurally closed strong-late transition has positive
prefix count.  Structural representatives cannot evade this check because
`Late.Struct.prefixCount_eq` is exact.
-/
theorem source_prefixCount_pos
    (step : Step source action target) :
    0 < source.prefixCount := by
  cases step with
  | native native =>
      exact native.source_prefixCount_pos
  | congr sourceCongruence native _targetCongruence =>
      rw [Late.Struct.prefixCount_eq sourceCongruence]
      exact native.source_prefixCount_pos

/-- Structural closure preserves the strict decrease of executable prefixes. -/
theorem target_prefixCount_lt
    (step : Step source action target) :
    target.prefixCount < source.prefixCount := by
  cases step with
  | native native =>
      exact native.target_prefixCount_lt
  | congr sourceCongruence native targetCongruence =>
      rw [Late.Struct.prefixCount_eq sourceCongruence]
      rw [← Late.Struct.prefixCount_eq targetCongruence]
      exact native.target_prefixCount_lt

/--
The two-prefix decrease bound also survives structural changes of both
representatives.
-/
theorem target_prefixCount_add_two_le_of_tau_all_communication
    (step : Step source .tau target)
    (allCommunication :
      source.prefixCount = source.communicationPrefixCount) :
    target.prefixCount + 2 ≤ source.prefixCount := by
  cases step with
  | native native =>
      exact
        native.target_prefixCount_add_two_le_of_tau_all_communication
          allCommunication
  | congr sourceCongruence native targetCongruence =>
      have representativeAllCommunication :=
        (Late.Struct.allCommunication_iff sourceCongruence).mp
          allCommunication
      have bound :=
        native.target_prefixCount_add_two_le_of_tau_all_communication
          representativeAllCommunication
      have sourcePrefixEq :=
        Late.Struct.prefixCount_eq sourceCongruence
      have targetPrefixEq :=
        Late.Struct.prefixCount_eq targetCongruence
      omega

/--
A structural strong-late `tau` step from a two-prefix, communication-only
source has a prefix-free derivative.  Both source and target representative
changes are accounted for explicitly.
-/
theorem target_prefixCount_zero_of_two_communication_tau
    (step : Step source .tau target)
    (twoPrefixes : source.prefixCount = 2)
    (allCommunication :
      source.prefixCount = source.communicationPrefixCount) :
    target.prefixCount = 0 := by
  cases step with
  | native native =>
      have bound :=
        native.target_prefixCount_add_two_le_of_tau_all_communication
          allCommunication
      omega
  | congr sourceCongruence native targetCongruence =>
      have sourcePrefixEq :=
        Late.Struct.prefixCount_eq sourceCongruence
      have representativeAllCommunication :=
        (Late.Struct.allCommunication_iff sourceCongruence).mp
          allCommunication
      have bound :=
        native.target_prefixCount_add_two_le_of_tau_all_communication
          representativeAllCommunication
      have targetPrefixEq :=
        Late.Struct.prefixCount_eq targetCongruence
      omega

/-- A prefix-free process has no structural strong-late transition. -/
theorem not_of_prefixCount_zero
    (empty : source.prefixCount = 0) :
    ¬Step source action target := by
  intro step
  have positive := step.source_prefixCount_pos
  omega

end Late.Step

end Cantilune.Pi
