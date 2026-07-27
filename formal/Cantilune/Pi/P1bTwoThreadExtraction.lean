import Cantilune.Pi.P1bRequestingFingerprint
import Cantilune.Pi.P1bRequestingNormalForm

/-!
# Two-thread extraction for the P1b requesting source

This isolated module turns the quantitative requesting fingerprint into
syntax-directed evidence.  The evidence is not a record which repeats the
metric assumptions:

* `OneCommThread` follows the raw syntax down to one input/output prefix;
* `TwoCommThread` follows it down to two sequential communication prefixes;
* `TwoThreadContext` exposes one parallel split containing two such threads.

Only restrictions and parallel/choice components with prefix-free siblings
may surround the active cores.  The final theorem normalizes the outer
two-thread context, using `Late.Struct`, to a finite restriction list around
one parallel split.  It does not classify the nominal incidence inside the
two threads and does not transport a native step across structural
congruence.

The module is imported by the root π theory.  Its remaining limitation is
nominal incidence, not elaboration status.
-/

namespace Cantilune.Pi.P1bTwoThreadExtraction

open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm

/--
Syntax-directed evidence for exactly one communication prefix, modulo
restrictions and parallel/choice siblings with no executable prefix.
-/
inductive OneCommThread : Raw.Proc → Prop
  | send
      (tailPrefixFree : next.prefixCount = 0) :
      OneCommThread (.send channel value next)
  | recv
      (tailPrefixFree : next.prefixCount = 0) :
      OneCommThread (.recv channel binder next)
  | new
      (inner : OneCommThread body) :
      OneCommThread (.new binder body)
  | parLeft
      (inner : OneCommThread left)
      (rightPrefixFree : right.prefixCount = 0) :
      OneCommThread (.par left right)
  | parRight
      (leftPrefixFree : left.prefixCount = 0)
      (inner : OneCommThread right) :
      OneCommThread (.par left right)
  | choiceLeft
      (inner : OneCommThread left)
      (rightPrefixFree : right.prefixCount = 0) :
      OneCommThread (.choice left right)
  | choiceRight
      (leftPrefixFree : left.prefixCount = 0)
      (inner : OneCommThread right) :
      OneCommThread (.choice left right)

/--
Syntax-directed evidence for one enabled thread containing exactly two
sequential communication prefixes.  The continuation after the first prefix
must itself contain exactly one communication thread.
-/
inductive TwoCommThread : Raw.Proc → Prop
  | send
      (tail : OneCommThread next) :
      TwoCommThread (.send channel value next)
  | recv
      (tail : OneCommThread next) :
      TwoCommThread (.recv channel binder next)
  | new
      (inner : TwoCommThread body) :
      TwoCommThread (.new binder body)
  | parLeft
      (inner : TwoCommThread left)
      (rightPrefixFree : right.prefixCount = 0) :
      TwoCommThread (.par left right)
  | parRight
      (leftPrefixFree : left.prefixCount = 0)
      (inner : TwoCommThread right) :
      TwoCommThread (.par left right)
  | choiceLeft
      (inner : TwoCommThread left)
      (rightPrefixFree : right.prefixCount = 0) :
      TwoCommThread (.choice left right)
  | choiceRight
      (leftPrefixFree : left.prefixCount = 0)
      (inner : TwoCommThread right) :
      TwoCommThread (.choice left right)

/--
An outer context containing exactly two length-two communication threads.
The `split` constructor is the only source of two live branches.  Every other
constructor records a restriction or a prefix-free parallel/choice sibling.
-/
inductive TwoThreadContext : Raw.Proc → Prop
  | split
      (leftThread : TwoCommThread left)
      (rightThread : TwoCommThread right) :
      TwoThreadContext (.par left right)
  | new {binder : Name} {body : Raw.Proc}
      (inner : TwoThreadContext body) :
      TwoThreadContext (.new binder body)
  | parLeft
      (inner : TwoThreadContext left)
      (rightPrefixFree : right.prefixCount = 0) :
      TwoThreadContext (.par left right)
  | parRight
      (leftPrefixFree : left.prefixCount = 0)
      (inner : TwoThreadContext right) :
      TwoThreadContext (.par left right)
  | choiceLeft
      (inner : TwoThreadContext left)
      (rightPrefixFree : right.prefixCount = 0) :
      TwoThreadContext (.choice left right)
  | choiceRight
      (leftPrefixFree : left.prefixCount = 0)
      (inner : TwoThreadContext right) :
      TwoThreadContext (.choice left right)

/-- Every enabled head accounts for at least one executable prefix. -/
theorem headPrefixCount_le_prefixCount (process : Raw.Proc) :
    process.headPrefixCount ≤ process.prefixCount := by
  induction process <;>
    simp_all [Raw.Proc.headPrefixCount, Raw.Proc.prefixCount] <;>
    omega

/-- A prefix-free process contributes no enabled-thread length. -/
theorem topThreadLengths_eq_nil_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.topThreadLengths = [] := by
  have headFree : process.headPrefixCount = 0 := by
    have bound := headPrefixCount_le_prefixCount process
    omega
  have lengthFree : process.topThreadLengths.length = 0 := by
    rw [process.topThreadLengths_length, headFree]
  exact List.length_eq_zero_iff.mp lengthFree

/--
A unary-free process with exactly one executable prefix has concrete
`OneCommThread` evidence.  No choice assumption is needed: a prefix-count
split of one already makes the unselected side prefix-free.
-/
theorem oneCommThread_of_prefixCount_eq_one
    (process : Raw.Proc)
    (onePrefix : process.prefixCount = 1)
    (noUnary : process.unaryPrefixCount = 0) :
    OneCommThread process := by
  induction process with
  | zero =>
      simp [Raw.Proc.prefixCount] at onePrefix
  | tau next inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | send channel value next inductionHypothesis =>
      apply OneCommThread.send
      simp only [Raw.Proc.prefixCount] at onePrefix
      omega
  | recv channel binder next inductionHypothesis =>
      apply OneCommThread.recv
      simp only [Raw.Proc.prefixCount] at onePrefix
      omega
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.prefixCount] at onePrefix
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      rcases noUnary with ⟨leftNoUnary, rightNoUnary⟩
      rcases Nat.eq_zero_or_pos left.prefixCount with
        leftPrefixFree | leftPositive
      · have rightOne : right.prefixCount = 1 := by
          omega
        exact OneCommThread.choiceRight leftPrefixFree
          (rightIH rightOne rightNoUnary)
      · have leftOne : left.prefixCount = 1 := by
          omega
        have rightPrefixFree : right.prefixCount = 0 := by
          omega
        exact OneCommThread.choiceLeft
          (leftIH leftOne leftNoUnary) rightPrefixFree
  | par left right leftIH rightIH =>
      simp only [Raw.Proc.prefixCount] at onePrefix
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      rcases noUnary with ⟨leftNoUnary, rightNoUnary⟩
      rcases Nat.eq_zero_or_pos left.prefixCount with
        leftPrefixFree | leftPositive
      · have rightOne : right.prefixCount = 1 := by
          omega
        exact OneCommThread.parRight leftPrefixFree
          (rightIH rightOne rightNoUnary)
      · have leftOne : left.prefixCount = 1 := by
          omega
        have rightPrefixFree : right.prefixCount = 0 := by
          omega
        exact OneCommThread.parLeft
          (leftIH leftOne leftNoUnary) rightPrefixFree
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.prefixCount] at onePrefix
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      exact OneCommThread.new
        (inductionHypothesis onePrefix noUnary)
  | matchEq left right next inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | matchNe left right next inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary

/--
One enabled length-two thread with no unary prefix and no live choice has
concrete `TwoCommThread` evidence.
-/
theorem twoCommThread_of_metrics
    (process : Raw.Proc)
    (threadLength : process.topThreadLengths = [2])
    (noUnary : process.unaryPrefixCount = 0)
    (noLiveChoice : process.choicePotential = 0) :
    TwoCommThread process := by
  induction process with
  | zero =>
      simp [Raw.Proc.topThreadLengths] at threadLength
  | tau next inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | send channel value next inductionHypothesis =>
      apply TwoCommThread.send
      apply oneCommThread_of_prefixCount_eq_one next
      · simp [Raw.Proc.topThreadLengths,
          Raw.Proc.prefixCount] at threadLength
        omega
      · simpa [Raw.Proc.unaryPrefixCount] using noUnary
  | recv channel binder next inductionHypothesis =>
      apply TwoCommThread.recv
      apply oneCommThread_of_prefixCount_eq_one next
      · simp [Raw.Proc.topThreadLengths,
          Raw.Proc.prefixCount] at threadLength
        omega
      · simpa [Raw.Proc.unaryPrefixCount] using noUnary
  | choice left right leftIH rightIH =>
      have headSum : left.headPrefixCount + right.headPrefixCount = 1 := by
        have lengths := congrArg List.length threadLength
        simpa [Raw.Proc.topThreadLengths,
          Raw.Proc.headPrefixCount] using lengths
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      rcases noUnary with ⟨leftNoUnary, rightNoUnary⟩
      simp only [Raw.Proc.choicePotential] at noLiveChoice
      rcases Nat.add_eq_zero_iff.mp noLiveChoice with
        ⟨choiceSumFree, _branchProductFree⟩
      rcases Nat.add_eq_zero_iff.mp choiceSumFree with
        ⟨leftNoChoice, rightNoChoice⟩
      rcases Nat.eq_zero_or_pos left.headPrefixCount with
        leftHeadFree | leftHeadPositive
      · have leftPrefixFree :=
          Raw.Proc.prefixCount_eq_zero_of_headPrefixCount_eq_zero
            left leftHeadFree
        have leftLengthsFree :=
          topThreadLengths_eq_nil_of_prefixCount_eq_zero
            left leftPrefixFree
        have rightLength : right.topThreadLengths = [2] := by
          simpa [Raw.Proc.topThreadLengths, leftLengthsFree] using
            threadLength
        exact TwoCommThread.choiceRight leftPrefixFree
          (rightIH rightLength rightNoUnary rightNoChoice)
      · have rightHeadFree : right.headPrefixCount = 0 := by
          omega
        have rightPrefixFree :=
          Raw.Proc.prefixCount_eq_zero_of_headPrefixCount_eq_zero
            right rightHeadFree
        have rightLengthsFree :=
          topThreadLengths_eq_nil_of_prefixCount_eq_zero
            right rightPrefixFree
        have leftLength : left.topThreadLengths = [2] := by
          simpa [Raw.Proc.topThreadLengths, rightLengthsFree] using
            threadLength
        exact TwoCommThread.choiceLeft
          (leftIH leftLength leftNoUnary leftNoChoice)
          rightPrefixFree
  | par left right leftIH rightIH =>
      have headSum : left.headPrefixCount + right.headPrefixCount = 1 := by
        have lengths := congrArg List.length threadLength
        simpa [Raw.Proc.topThreadLengths,
          Raw.Proc.headPrefixCount] using lengths
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      rcases noUnary with ⟨leftNoUnary, rightNoUnary⟩
      simp only [Raw.Proc.choicePotential,
        Nat.add_eq_zero_iff] at noLiveChoice
      rcases noLiveChoice with ⟨leftNoChoice, rightNoChoice⟩
      rcases Nat.eq_zero_or_pos left.headPrefixCount with
        leftHeadFree | leftHeadPositive
      · have leftPrefixFree :=
          Raw.Proc.prefixCount_eq_zero_of_headPrefixCount_eq_zero
            left leftHeadFree
        have leftLengthsFree :=
          topThreadLengths_eq_nil_of_prefixCount_eq_zero
            left leftPrefixFree
        have rightLength : right.topThreadLengths = [2] := by
          simpa [Raw.Proc.topThreadLengths, leftLengthsFree] using
            threadLength
        exact TwoCommThread.parRight leftPrefixFree
          (rightIH rightLength rightNoUnary rightNoChoice)
      · have rightHeadFree : right.headPrefixCount = 0 := by
          omega
        have rightPrefixFree :=
          Raw.Proc.prefixCount_eq_zero_of_headPrefixCount_eq_zero
            right rightHeadFree
        have rightLengthsFree :=
          topThreadLengths_eq_nil_of_prefixCount_eq_zero
            right rightPrefixFree
        have leftLength : left.topThreadLengths = [2] := by
          simpa [Raw.Proc.topThreadLengths, rightLengthsFree] using
            threadLength
        exact TwoCommThread.parLeft
          (leftIH leftLength leftNoUnary leftNoChoice)
          rightPrefixFree
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.topThreadLengths] at threadLength
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noLiveChoice
      exact TwoCommThread.new
        (inductionHypothesis threadLength noUnary noLiveChoice)
  | matchEq left right next inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | matchNe left right next inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary

/--
The two-thread metric package extracts a genuine `TwoThreadContext`.
Parallel may split the two threads one-per-side; zero/live-choice constraints
force choice to retain both threads on a single side.
-/
theorem twoThreadContext_of_metrics
    (process : Raw.Proc)
    (threadLengths : process.topThreadLengths = [2, 2])
    (noUnary : process.unaryPrefixCount = 0)
    (noLiveChoice : process.choicePotential = 0) :
    TwoThreadContext process := by
  induction process with
  | zero =>
      simp [Raw.Proc.topThreadLengths] at threadLengths
  | tau next inductionHypothesis =>
      simp [Raw.Proc.topThreadLengths] at threadLengths
  | send channel value next inductionHypothesis =>
      simp [Raw.Proc.topThreadLengths] at threadLengths
  | recv channel binder next inductionHypothesis =>
      simp [Raw.Proc.topThreadLengths] at threadLengths
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      rcases noUnary with ⟨leftNoUnary, rightNoUnary⟩
      simp only [Raw.Proc.choicePotential] at noLiveChoice
      rcases Nat.add_eq_zero_iff.mp noLiveChoice with
        ⟨choiceSumFree, branchProductFree⟩
      rcases Nat.add_eq_zero_iff.mp choiceSumFree with
        ⟨leftNoChoice, rightNoChoice⟩
      rcases Nat.mul_eq_zero.mp branchProductFree with
        leftPrefixFree | rightPrefixFree
      · have leftLengthsFree :=
          topThreadLengths_eq_nil_of_prefixCount_eq_zero
            left leftPrefixFree
        have rightLengths : right.topThreadLengths = [2, 2] := by
          simpa [Raw.Proc.topThreadLengths, leftLengthsFree] using
            threadLengths
        exact TwoThreadContext.choiceRight leftPrefixFree
          (rightIH rightLengths rightNoUnary rightNoChoice)
      · have rightLengthsFree :=
          topThreadLengths_eq_nil_of_prefixCount_eq_zero
            right rightPrefixFree
        have leftLengths : left.topThreadLengths = [2, 2] := by
          simpa [Raw.Proc.topThreadLengths, rightLengthsFree] using
            threadLengths
        exact TwoThreadContext.choiceLeft
          (leftIH leftLengths leftNoUnary leftNoChoice)
          rightPrefixFree
  | par left right leftIH rightIH =>
      have headSum : left.headPrefixCount + right.headPrefixCount = 2 := by
        have lengths := congrArg List.length threadLengths
        simpa [Raw.Proc.topThreadLengths,
          Raw.Proc.headPrefixCount] using lengths
      simp only [Raw.Proc.unaryPrefixCount,
        Nat.add_eq_zero_iff] at noUnary
      rcases noUnary with ⟨leftNoUnary, rightNoUnary⟩
      simp only [Raw.Proc.choicePotential,
        Nat.add_eq_zero_iff] at noLiveChoice
      rcases noLiveChoice with ⟨leftNoChoice, rightNoChoice⟩
      by_cases leftHeadFree : left.headPrefixCount = 0
      · have leftPrefixFree :=
          Raw.Proc.prefixCount_eq_zero_of_headPrefixCount_eq_zero
            left leftHeadFree
        have leftLengthsFree :=
          topThreadLengths_eq_nil_of_prefixCount_eq_zero
            left leftPrefixFree
        have rightLengths : right.topThreadLengths = [2, 2] := by
          simpa [Raw.Proc.topThreadLengths, leftLengthsFree] using
            threadLengths
        exact TwoThreadContext.parRight leftPrefixFree
          (rightIH rightLengths rightNoUnary rightNoChoice)
      · by_cases rightHeadFree : right.headPrefixCount = 0
        · have rightPrefixFree :=
            Raw.Proc.prefixCount_eq_zero_of_headPrefixCount_eq_zero
              right rightHeadFree
          have rightLengthsFree :=
            topThreadLengths_eq_nil_of_prefixCount_eq_zero
              right rightPrefixFree
          have leftLengths : left.topThreadLengths = [2, 2] := by
            simpa [Raw.Proc.topThreadLengths, rightLengthsFree] using
              threadLengths
          exact TwoThreadContext.parLeft
            (leftIH leftLengths leftNoUnary leftNoChoice)
            rightPrefixFree
        · have leftHeadOne : left.headPrefixCount = 1 := by
            omega
          have rightHeadOne : right.headPrefixCount = 1 := by
            omega
          have leftLengthOne : left.topThreadLengths.length = 1 := by
            rw [left.topThreadLengths_length, leftHeadOne]
          have rightLengthOne : right.topThreadLengths.length = 1 := by
            rw [right.topThreadLengths_length, rightHeadOne]
          rcases List.length_eq_one_iff.mp leftLengthOne with
            ⟨leftLength, leftShape⟩
          rcases List.length_eq_one_iff.mp rightLengthOne with
            ⟨rightLength, rightShape⟩
          have splitShape :
              [leftLength] ++ [rightLength] = [2, 2] := by
            simpa only [Raw.Proc.topThreadLengths,
              leftShape, rightShape] using threadLengths
          have lengthValues :
              leftLength = 2 ∧ rightLength = 2 := by
            simpa using splitShape
          have leftLengths : left.topThreadLengths = [2] := by
            simpa [lengthValues.1] using leftShape
          have rightLengths : right.topThreadLengths = [2] := by
            simpa [lengthValues.2] using rightShape
          exact TwoThreadContext.split
            (twoCommThread_of_metrics
              left leftLengths leftNoUnary leftNoChoice)
            (twoCommThread_of_metrics
              right rightLengths rightNoUnary rightNoChoice)
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.topThreadLengths] at threadLengths
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noLiveChoice
      exact TwoThreadContext.new
        (inductionHypothesis threadLengths noUnary noLiveChoice)
  | matchEq left right next inductionHypothesis =>
      simp [Raw.Proc.topThreadLengths] at threadLengths
  | matchNe left right next inductionHypothesis =>
      simp [Raw.Proc.topThreadLengths] at threadLengths

/--
Every extracted outer context is structurally a finite restriction list
around one parallel split of the two concrete communication threads.

Restrictions below either thread's first communication prefix deliberately
remain inside `TwoCommThread`: the selected `Late.Struct` theory has no law
which moves `new` through `send` or `recv`.  Consequently this theorem
extracts exactly the restrictions in the outer two-thread context and makes
no stronger, unjustified claim that every internal binder belongs to one
global `wrapNews`.
-/
theorem TwoThreadContext.structural_normal_form
    {process : Raw.Proc}
    (context : TwoThreadContext process) :
    ∃ binders left right,
      TwoCommThread left ∧
      TwoCommThread right ∧
      Cantilune.Pi.Late.Struct process
        (wrapNews binders (.par left right)) := by
  induction context with
  | split leftThread rightThread =>
      exact ⟨[], _, _, leftThread, rightThread,
        Cantilune.Pi.Late.Struct.refl _⟩
  | @new binder body inner inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      refine ⟨binder :: binders, left, right,
        leftThread, rightThread, ?_⟩
      simpa [wrapNews] using
        Cantilune.Pi.Late.Struct.new normalized
  | parLeft inner rightPrefixFree inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      refine ⟨binders, left, right, leftThread, rightThread, ?_⟩
      apply Cantilune.Pi.Late.Struct.trans
        (Cantilune.Pi.Late.Struct.par normalized
          ((Cantilune.Pi.Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            rightPrefixFree))
      exact Cantilune.Pi.Late.Struct.parZero
  | parRight leftPrefixFree inner inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      refine ⟨binders, left, right, leftThread, rightThread, ?_⟩
      apply Cantilune.Pi.Late.Struct.trans
        (Cantilune.Pi.Late.Struct.par
          ((Cantilune.Pi.Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            leftPrefixFree)
          normalized)
      exact Cantilune.Pi.Late.Struct.par_zero_left _
  | choiceLeft inner rightPrefixFree inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      refine ⟨binders, left, right, leftThread, rightThread, ?_⟩
      apply Cantilune.Pi.Late.Struct.trans
        (Cantilune.Pi.Late.Struct.choice normalized
          ((Cantilune.Pi.Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            rightPrefixFree))
      exact Cantilune.Pi.Late.Struct.choiceZero
  | choiceRight leftPrefixFree inner inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨binders, left, right, leftThread, rightThread, normalized⟩
      refine ⟨binders, left, right, leftThread, rightThread, ?_⟩
      apply Cantilune.Pi.Late.Struct.trans
        (Cantilune.Pi.Late.Struct.choice
          ((Cantilune.Pi.Late.Struct.structurallyZero_iff_prefixCount_zero _).mpr
            leftPrefixFree)
          normalized)
      exact Cantilune.Pi.Late.Struct.choice_zero_left _

/--
The augmented requesting fingerprint supplies the complete non-nominal
two-thread extraction.  Name incidence inside the two threads remains the
separate linked-core obligation.
-/
theorem AugmentedRequestingFingerprint.twoThreadContext
    {process : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process) :
    TwoThreadContext process :=
  twoThreadContext_of_metrics process
    fingerprint.topThreadLengths_eq
    fingerprint.unaryPrefixCount_eq
    fingerprint.choicePotential_eq

end Cantilune.Pi.P1bTwoThreadExtraction
