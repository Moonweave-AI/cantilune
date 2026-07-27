import Cantilune.Pi.LateAlphaSupport
import Cantilune.Pi.Protocols

/-!
# Structural fingerprints for the request/accept residual

The ordinary prefix and support counts do not remember which continuations
are guarded, their input/output polarity, or whether a transmitted/bound
name is used as the next subject.  This module develops candidate
alpha-stable invariants for those features.  They are useful necessary
measurements, not a complete requesting-state normal form: in particular the
seven aggregate values below do not retain the identity and position of the
free payload in the guarded output continuation.
-/

namespace Cantilune.Pi

namespace Raw.Proc

/-- Rename one name exactly as `substRaw` renames free name occurrences. -/
def substName (needle replacement name : Name) : Name :=
  if name = needle then replacement else name

/-- Renaming a name to itself is definitionally inert throughout the syntax. -/
@[simp]
theorem substRaw_self (process : Raw.Proc) (name : Name) :
    process.substRaw name name = process := by
  induction process <;>
    simp_all [Raw.Proc.substRaw]

/-- Number of currently enabled prefix heads. -/
def headPrefixCount : Raw.Proc → Nat
  | .zero => 0
  | .tau _ => 1
  | .send _ _ _ => 1
  | .recv _ _ _ => 1
  | .choice left right =>
      headPrefixCount left + headPrefixCount right
  | .par left right =>
      headPrefixCount left + headPrefixCount right
  | .new _ body => headPrefixCount body
  | .matchEq _ _ _ => 1
  | .matchNe _ _ _ => 1

/--
Second moment of the sizes of enabled sequential threads.  A prefix guards
its entire continuation and therefore contributes the square of its full
prefix count; parallel and choice expose the sum of their enabled threads.
-/
def topThreadSquareMass : Raw.Proc → Nat
  | .zero => 0
  | process@(.tau _) => process.prefixCount * process.prefixCount
  | process@(.send _ _ _) => process.prefixCount * process.prefixCount
  | process@(.recv _ _ _) => process.prefixCount * process.prefixCount
  | .choice left right =>
      topThreadSquareMass left + topThreadSquareMass right
  | .par left right =>
      topThreadSquareMass left + topThreadSquareMass right
  | .new _ body => topThreadSquareMass body
  | process@(.matchEq _ _ _) =>
      process.prefixCount * process.prefixCount
  | process@(.matchNe _ _ _) =>
      process.prefixCount * process.prefixCount

/--
Lengths of the currently enabled sequential threads.  A prefix contributes
its whole guarded continuation as one thread; parallel and choice expose the
concatenation of their enabled threads.
-/
def topThreadLengths : Raw.Proc → List Nat
  | .zero => []
  | process@(.tau _) => [process.prefixCount]
  | process@(.send _ _ _) => [process.prefixCount]
  | process@(.recv _ _ _) => [process.prefixCount]
  | .choice left right =>
      topThreadLengths left ++ topThreadLengths right
  | .par left right =>
      topThreadLengths left ++ topThreadLengths right
  | .new _ body => topThreadLengths body
  | process@(.matchEq _ _ _) => [process.prefixCount]
  | process@(.matchNe _ _ _) => [process.prefixCount]

@[simp]
theorem topThreadLengths_length (process : Raw.Proc) :
    process.topThreadLengths.length = process.headPrefixCount := by
  induction process <;>
    simp_all [topThreadLengths, headPrefixCount]

@[simp]
theorem topThreadLengths_sum (process : Raw.Proc) :
    process.topThreadLengths.sum = process.prefixCount := by
  induction process <;>
    simp_all [topThreadLengths, Raw.Proc.prefixCount]

@[simp]
theorem topThreadLengths_square_sum (process : Raw.Proc) :
    (process.topThreadLengths.map (fun length => length * length)).sum =
      process.topThreadSquareMass := by
  induction process <;>
    simp_all [topThreadLengths, topThreadSquareMass,
      Raw.Proc.prefixCount]

/--
Two enabled threads with square mass eight are exactly two length-two
threads.  This is the finite arithmetic core of the guarded-thread normal
form.
-/
theorem topThreadLengths_eq_two_two_of_head_two_mass_eight
    (process : Raw.Proc)
    (heads : process.headPrefixCount = 2)
    (mass : process.topThreadSquareMass = 8) :
    process.topThreadLengths = [2, 2] := by
  have lengthTwo : process.topThreadLengths.length = 2 := by
    simpa using heads
  rcases List.length_eq_two.mp lengthTwo with
    ⟨first, second, threadShape⟩
  have squareSum : first * first + second * second = 8 := by
    have equality := process.topThreadLengths_square_sum
    rw [threadShape] at equality
    simpa using equality.trans mass
  have firstAtMostTwo : first ≤ 2 := by
    nlinarith
  have secondAtMostTwo : second ≤ 2 := by
    nlinarith
  have firstEq : first = 2 := by
    interval_cases first <;>
      interval_cases second <;>
      norm_num at squareSum
    norm_num
  have secondEq : second = 2 := by
    interval_cases first <;>
      interval_cases second <;>
      norm_num at squareSum
    norm_num
  simpa [firstEq, secondEq] using threadShape

/-- Two length-two enabled threads have total prefix length four. -/
theorem prefixCount_eq_four_of_head_two_mass_eight
    (process : Raw.Proc)
    (heads : process.headPrefixCount = 2)
    (mass : process.topThreadSquareMass = 8) :
    process.prefixCount = 4 := by
  rw [← process.topThreadLengths_sum,
    process.topThreadLengths_eq_two_two_of_head_two_mass_eight heads mass]
  rfl

/--
Pairwise mass between genuinely live alternatives.  It is zero precisely
when every choice node has at most one prefix-bearing branch.  The
pair-product makes it invariant under choice associativity and commutativity.
-/
def choicePotential : Raw.Proc → Nat
  | .zero => 0
  | .tau next => choicePotential next
  | .send _ _ next => choicePotential next
  | .recv _ _ next => choicePotential next
  | .choice left right =>
      choicePotential left + choicePotential right +
        left.prefixCount * right.prefixCount
  | .par left right =>
      choicePotential left + choicePotential right
  | .new _ body => choicePotential body
  | .matchEq _ _ next => choicePotential next
  | .matchNe _ _ next => choicePotential next

/-- Number of output prefixes, including guarded continuations. -/
def sendPrefixCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => sendPrefixCount next
  | .send _ _ next => sendPrefixCount next + 1
  | .recv _ _ next => sendPrefixCount next
  | .choice left right => sendPrefixCount left + sendPrefixCount right
  | .par left right => sendPrefixCount left + sendPrefixCount right
  | .new _ body => sendPrefixCount body
  | .matchEq _ _ next => sendPrefixCount next
  | .matchNe _ _ next => sendPrefixCount next

/-- Number of input prefixes, including guarded continuations. -/
def recvPrefixCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => recvPrefixCount next
  | .send _ _ next => recvPrefixCount next
  | .recv _ _ next => recvPrefixCount next + 1
  | .choice left right => recvPrefixCount left + recvPrefixCount right
  | .par left right => recvPrefixCount left + recvPrefixCount right
  | .new _ body => recvPrefixCount body
  | .matchEq _ _ next => recvPrefixCount next
  | .matchNe _ _ next => recvPrefixCount next

/--
The communication-prefix partition is exactly the output/input polarity
partition used by the requesting fingerprint.
-/
theorem communicationPrefixCount_eq_send_add_recv
    (process : Raw.Proc) :
    process.communicationPrefixCount =
      process.sendPrefixCount + process.recvPrefixCount := by
  induction process <;>
    simp_all [Raw.Proc.communicationPrefixCount, sendPrefixCount,
      recvPrefixCount, Nat.add_assoc, Nat.add_comm, Nat.add_left_comm]

/-- Indicator that a name is used as a free subject in a continuation. -/
def subjectLink (name : Name) (next : Raw.Proc) : Nat :=
  if name ∈ next.freeSubjects then 1 else 0

/--
Number of output prefixes whose transmitted value is used as a subject in
their guarded continuation.
-/
def outputLinkCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => outputLinkCount next
  | .send _ value next =>
      outputLinkCount next + subjectLink value next
  | .recv _ _ next => outputLinkCount next
  | .choice left right => outputLinkCount left + outputLinkCount right
  | .par left right => outputLinkCount left + outputLinkCount right
  | .new _ body => outputLinkCount body
  | .matchEq _ _ next => outputLinkCount next
  | .matchNe _ _ next => outputLinkCount next

/--
Number of input prefixes whose binder is used as a subject in their guarded
continuation.
-/
def inputLinkCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => inputLinkCount next
  | .send _ _ next => inputLinkCount next
  | .recv _ binder next =>
      inputLinkCount next + subjectLink binder next
  | .choice left right => inputLinkCount left + inputLinkCount right
  | .par left right => inputLinkCount left + inputLinkCount right
  | .new _ body => inputLinkCount body
  | .matchEq _ _ next => inputLinkCount next
  | .matchNe _ _ next => inputLinkCount next

/--
Fresh raw renaming preserves whether the correspondingly renamed name is a
free prefix subject.  This is the binder-aware incidence fact used by both
input- and restriction-alpha conversion.
-/
theorem substName_mem_freeSubjects_substRaw_iff
    (process : Raw.Proc) (needle replacement name : Name)
    (fresh : replacement ∉ process.allNames)
    (nameFresh : name ≠ replacement) :
    substName needle replacement name ∈
        (process.substRaw needle replacement).freeSubjects ↔
      name ∈ process.freeSubjects := by
  induction process with
  | zero =>
      simp [substName, Raw.Proc.substRaw, Raw.Proc.freeSubjects]
  | tau next inductionHypothesis =>
      have nextFresh : replacement ∉ next.allNames := by
        simpa [Raw.Proc.allNames] using fresh
      simpa [Raw.Proc.substRaw, Raw.Proc.freeSubjects] using
        inductionHypothesis nextFresh
  | send channel value next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, valueFresh, nextFresh⟩
      have nextIncidence := inductionHypothesis nextFresh
      simp only [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
        Finset.mem_insert]
      unfold substName at nextIncidence ⊢
      split <;> split <;> simp_all [eq_comm] <;> aesop
  | recv channel binder next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, binderFresh, nextFresh⟩
      have replacementNotSubject : replacement ∉ next.freeSubjects :=
        fun member =>
          nextFresh
            (Raw.Proc.freeNames_subset_allNames next
              (Raw.Proc.freeSubjects_subset_freeNames next member))
      by_cases binderNeedle : binder = needle
      · subst binder
        by_cases nameNeedle : name = needle <;>
          by_cases channelNeedle : channel = needle <;>
          simp_all [Raw.Proc.substRaw, Raw.Proc.freeSubjects, substName,
            eq_comm]
      · have nextIncidence :=
          inductionHypothesis nextFresh
        simp only [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
          binderNeedle, Finset.mem_insert, Finset.mem_erase]
        unfold substName at nextIncidence ⊢
        split <;> split <;> simp_all [eq_comm] <;> aesop
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      simpa [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
        leftIH leftFresh, rightIH rightFresh]
  | par left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      simpa [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
        leftIH leftFresh, rightIH rightFresh]
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨binderFresh, bodyFresh⟩
      have replacementNotSubject : replacement ∉ body.freeSubjects :=
        fun member =>
          bodyFresh
            (Raw.Proc.freeNames_subset_allNames body
              (Raw.Proc.freeSubjects_subset_freeNames body member))
      by_cases binderNeedle : binder = needle
      · subst binder
        by_cases nameNeedle : name = needle <;>
          simp_all [Raw.Proc.substRaw, Raw.Proc.freeSubjects, substName,
            eq_comm]
      · have bodyIncidence :=
          inductionHypothesis bodyFresh
        simp only [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
          binderNeedle, Finset.mem_erase]
        unfold substName at bodyIncidence ⊢
        split <;> simp_all [eq_comm] <;> aesop
  | matchEq left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, Raw.Proc.freeSubjects] using
        inductionHypothesis nextFresh
  | matchNe left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, Raw.Proc.freeSubjects] using
        inductionHypothesis nextFresh

/-- Raw renaming preserves the number of enabled sequential heads. -/
theorem headPrefixCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).headPrefixCount =
      process.headPrefixCount := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, headPrefixCount] <;>
    split <;> simp_all

/-- Raw renaming preserves the enabled-thread square mass. -/
theorem topThreadSquareMass_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).topThreadSquareMass =
      process.topThreadSquareMass := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, topThreadSquareMass,
      Raw.Proc.prefixCount, Raw.Proc.prefixCount_substRaw]
  all_goals
    split <;>
      simp_all [Raw.Proc.prefixCount_substRaw]

/-- Raw renaming preserves live-choice potential. -/
theorem choicePotential_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).choicePotential =
      process.choicePotential := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, choicePotential,
      Raw.Proc.prefixCount, Raw.Proc.prefixCount_substRaw] <;>
    split <;> simp_all

/-- Raw renaming preserves output-prefix polarity. -/
theorem sendPrefixCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).sendPrefixCount =
      process.sendPrefixCount := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, sendPrefixCount] <;>
    split <;> simp_all

/-- Raw renaming preserves input-prefix polarity. -/
theorem recvPrefixCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).recvPrefixCount =
      process.recvPrefixCount := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, recvPrefixCount] <;>
    split <;> simp_all

/--
The fuelled capture-avoiding implementation preserves output-prefix
polarity.  Binder freshening changes names only, so the constructor skeleton
is unchanged in both the fast and slow branches.
-/
theorem sendPrefixCount_substituteCaptureAvoidingAux
    (fuel : Nat) (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoidingAux fuel needle replacement).sendPrefixCount =
      process.sendPrefixCount := by
  induction fuel generalizing process with
  | zero =>
      rfl
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          rfl
      | tau next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
            inductionHypothesis]
      | send channel value next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
            inductionHypothesis]
      | recv channel binder next =>
          by_cases boundNeedle : binder = needle
          · simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
              boundNeedle]
          · by_cases boundReplacement : binder = replacement
            · have replacementNotNeedle : replacement ≠ needle := by
                intro equality
                exact boundNeedle (boundReplacement.trans equality)
              simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
                boundReplacement, inductionHypothesis,
                replacementNotNeedle,
                Raw.Proc.renameBound_eq_substRaw,
                Raw.Proc.sendPrefixCount_substRaw]
            · simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
                boundNeedle, boundReplacement, inductionHypothesis]
      | choice left right =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
            inductionHypothesis]
      | par left right =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
            inductionHypothesis]
      | new binder body =>
          by_cases boundNeedle : binder = needle
          · simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
              boundNeedle]
          · by_cases boundReplacement : binder = replacement
            · have replacementNotNeedle : replacement ≠ needle := by
                intro equality
                exact boundNeedle (boundReplacement.trans equality)
              simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
                boundReplacement, inductionHypothesis,
                replacementNotNeedle,
                Raw.Proc.renameBound_eq_substRaw,
                Raw.Proc.sendPrefixCount_substRaw]
            · simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
                boundNeedle, boundReplacement, inductionHypothesis]
      | matchEq left right next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
            inductionHypothesis]
      | matchNe left right next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, sendPrefixCount,
            inductionHypothesis]

/-- Total capture-avoiding substitution preserves output-prefix polarity. -/
theorem sendPrefixCount_substituteCaptureAvoiding
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).sendPrefixCount =
      process.sendPrefixCount := by
  unfold Raw.Proc.substituteCaptureAvoiding
  split
  · exact
      sendPrefixCount_substituteCaptureAvoidingAux
        process.syntaxDepth process needle replacement
  · exact sendPrefixCount_substRaw process needle replacement

/--
The fuelled capture-avoiding implementation preserves input-prefix polarity,
including the branch which alpha-freshens a conflicting input or restriction
binder.
-/
theorem recvPrefixCount_substituteCaptureAvoidingAux
    (fuel : Nat) (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoidingAux fuel needle replacement).recvPrefixCount =
      process.recvPrefixCount := by
  induction fuel generalizing process with
  | zero =>
      rfl
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          rfl
      | tau next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
            inductionHypothesis]
      | send channel value next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
            inductionHypothesis]
      | recv channel binder next =>
          by_cases boundNeedle : binder = needle
          · simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
              boundNeedle]
          · by_cases boundReplacement : binder = replacement
            · have replacementNotNeedle : replacement ≠ needle := by
                intro equality
                exact boundNeedle (boundReplacement.trans equality)
              simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
                boundReplacement, inductionHypothesis,
                replacementNotNeedle,
                Raw.Proc.renameBound_eq_substRaw,
                Raw.Proc.recvPrefixCount_substRaw]
            · simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
                boundNeedle, boundReplacement, inductionHypothesis]
      | choice left right =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
            inductionHypothesis]
      | par left right =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
            inductionHypothesis]
      | new binder body =>
          by_cases boundNeedle : binder = needle
          · simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
              boundNeedle]
          · by_cases boundReplacement : binder = replacement
            · have replacementNotNeedle : replacement ≠ needle := by
                intro equality
                exact boundNeedle (boundReplacement.trans equality)
              simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
                boundReplacement, inductionHypothesis,
                replacementNotNeedle,
                Raw.Proc.renameBound_eq_substRaw,
                Raw.Proc.recvPrefixCount_substRaw]
            · simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
                boundNeedle, boundReplacement, inductionHypothesis]
      | matchEq left right next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
            inductionHypothesis]
      | matchNe left right next =>
          simp [Raw.Proc.substituteCaptureAvoidingAux, recvPrefixCount,
            inductionHypothesis]

/-- Total capture-avoiding substitution preserves input-prefix polarity. -/
theorem recvPrefixCount_substituteCaptureAvoiding
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).recvPrefixCount =
      process.recvPrefixCount := by
  unfold Raw.Proc.substituteCaptureAvoiding
  split
  · exact
      recvPrefixCount_substituteCaptureAvoidingAux
        process.syntaxDepth process needle replacement
  · exact recvPrefixCount_substRaw process needle replacement

/--
The incidence indicator commutes with a fresh injective raw renaming.  The
`name ≠ replacement` side condition is essential: asking about the fresh
codomain name itself would conflate it with the image of `needle`.
-/
theorem subjectLink_substRaw
    (process : Raw.Proc) (needle replacement name : Name)
    (fresh : replacement ∉ process.allNames)
    (nameFresh : name ≠ replacement) :
    subjectLink (substName needle replacement name)
        (process.substRaw needle replacement) =
      subjectLink name process := by
  unfold subjectLink
  by_cases member : name ∈ process.freeSubjects
  · have renamed :
        substName needle replacement name ∈
          (process.substRaw needle replacement).freeSubjects :=
      (substName_mem_freeSubjects_substRaw_iff
        process needle replacement name fresh nameFresh).2 member
    simp [member, renamed]
  · have renamed :
        substName needle replacement name ∉
          (process.substRaw needle replacement).freeSubjects := by
      simpa only [
        substName_mem_freeSubjects_substRaw_iff
          process needle replacement name fresh nameFresh] using member
    simp [member, renamed]

/--
Fresh raw renaming preserves the number of value-to-continuation subject
links.  Freshness supplies injectivity on every transmitted value occurring
in the source syntax.
-/
theorem outputLinkCount_substRaw
    (process : Raw.Proc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    (process.substRaw needle replacement).outputLinkCount =
      process.outputLinkCount := by
  induction process with
  | zero =>
      simp [Raw.Proc.substRaw, outputLinkCount]
  | tau next inductionHypothesis =>
      have nextFresh : replacement ∉ next.allNames := by
        simpa [Raw.Proc.allNames] using fresh
      simpa [Raw.Proc.substRaw, outputLinkCount] using
        inductionHypothesis nextFresh
  | send channel value next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, valueFresh, nextFresh⟩
      have nextInvariant := inductionHypothesis nextFresh
      have linkInvariant :=
        subjectLink_substRaw next needle replacement value nextFresh
          (Ne.symm valueFresh)
      have linkInvariant' :
          subjectLink
              (if value = needle then replacement else value)
              (next.substRaw needle replacement) =
            subjectLink value next := by
        simpa [substName] using linkInvariant
      simp [Raw.Proc.substRaw, outputLinkCount, substName,
        nextInvariant, linkInvariant']
  | recv channel binder next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_channelFresh, _binderFresh, nextFresh⟩
      by_cases binderNeedle : binder = needle
      · simp [Raw.Proc.substRaw, outputLinkCount, binderNeedle]
      · simpa [Raw.Proc.substRaw, outputLinkCount, binderNeedle] using
          inductionHypothesis nextFresh
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      simp [Raw.Proc.substRaw, outputLinkCount,
        leftIH leftFresh, rightIH rightFresh]
  | par left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      simp [Raw.Proc.substRaw, outputLinkCount,
        leftIH leftFresh, rightIH rightFresh]
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_binderFresh, bodyFresh⟩
      by_cases binderNeedle : binder = needle
      · simp [Raw.Proc.substRaw, outputLinkCount, binderNeedle]
      · simpa [Raw.Proc.substRaw, outputLinkCount, binderNeedle] using
          inductionHypothesis bodyFresh
  | matchEq left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, outputLinkCount] using
        inductionHypothesis nextFresh
  | matchNe left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, outputLinkCount] using
        inductionHypothesis nextFresh

/--
Fresh raw renaming preserves the number of binder-to-continuation subject
links.  At a shadowing input binder `substRaw` stops, exactly matching the
late binding discipline.
-/
theorem inputLinkCount_substRaw
    (process : Raw.Proc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    (process.substRaw needle replacement).inputLinkCount =
      process.inputLinkCount := by
  induction process with
  | zero =>
      simp [Raw.Proc.substRaw, inputLinkCount]
  | tau next inductionHypothesis =>
      have nextFresh : replacement ∉ next.allNames := by
        simpa [Raw.Proc.allNames] using fresh
      simpa [Raw.Proc.substRaw, inputLinkCount] using
        inductionHypothesis nextFresh
  | send channel value next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_channelFresh, _valueFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, inputLinkCount] using
        inductionHypothesis nextFresh
  | recv channel binder next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_channelFresh, binderFresh, nextFresh⟩
      by_cases binderNeedle : binder = needle
      · simp [Raw.Proc.substRaw, inputLinkCount, binderNeedle]
      · have nextInvariant := inductionHypothesis nextFresh
        have linkInvariant :
            subjectLink binder (next.substRaw needle replacement) =
              subjectLink binder next := by
          simpa [substName, binderNeedle] using
            subjectLink_substRaw next needle replacement binder nextFresh
              (Ne.symm binderFresh)
        simp [Raw.Proc.substRaw, inputLinkCount, binderNeedle,
          nextInvariant, linkInvariant]
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      simp [Raw.Proc.substRaw, inputLinkCount,
        leftIH leftFresh, rightIH rightFresh]
  | par left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      simp [Raw.Proc.substRaw, inputLinkCount,
        leftIH leftFresh, rightIH rightFresh]
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_binderFresh, bodyFresh⟩
      by_cases binderNeedle : binder = needle
      · simp [Raw.Proc.substRaw, inputLinkCount, binderNeedle]
      · simpa [Raw.Proc.substRaw, inputLinkCount, binderNeedle] using
          inductionHypothesis bodyFresh
  | matchEq left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, inputLinkCount] using
        inductionHypothesis nextFresh
  | matchNe left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, inputLinkCount] using
        inductionHypothesis nextFresh

end Raw.Proc

namespace Late.Alpha

/-- Alpha conversion preserves the enabled-thread count. -/
theorem headPrefixCount_eq
    (relation : Alpha left right) :
    left.headPrefixCount = right.headPrefixCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      rfl
  | send relation inductionHypothesis =>
      rfl
  | recv relation inductionHypothesis =>
      rfl
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.headPrefixCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.headPrefixCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.headPrefixCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      rfl
  | matchNe relation inductionHypothesis =>
      rfl
  | @recvBinder replacement channel binder body fresh =>
      simp [Raw.Proc.headPrefixCount, Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.headPrefixCount_substRaw]
  | newBinder fresh =>
      simp [Raw.Proc.headPrefixCount, Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.headPrefixCount_substRaw]

/-- Alpha conversion preserves the enabled-thread square mass. -/
theorem topThreadSquareMass_eq
    (relation : Alpha left right) :
    left.topThreadSquareMass = right.topThreadSquareMass := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Alpha.prefixCount_eq relation]
  | send relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Alpha.prefixCount_eq relation]
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Alpha.prefixCount_eq relation]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.topThreadSquareMass, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.topThreadSquareMass, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.topThreadSquareMass] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Alpha.prefixCount_eq relation]
  | matchNe relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Alpha.prefixCount_eq relation]
  | @recvBinder replacement channel binder body fresh =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.prefixCount_substRaw]
  | newBinder fresh =>
      simp [Raw.Proc.topThreadSquareMass,
        Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.topThreadSquareMass_substRaw]

/-- Alpha conversion preserves choice branching potential. -/
theorem choicePotential_eq
    (relation : Alpha left right) :
    left.choicePotential = right.choicePotential := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | send relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | recv relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.choicePotential, leftIH, rightIH,
        Late.Alpha.prefixCount_eq leftRelation,
        Late.Alpha.prefixCount_eq rightRelation]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.choicePotential, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | recvBinder fresh =>
      simp [Raw.Proc.choicePotential, Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.choicePotential_substRaw]
  | newBinder fresh =>
      simp [Raw.Proc.choicePotential, Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.choicePotential_substRaw]

/-- Alpha conversion preserves output/input polarity counts. -/
theorem sendPrefixCount_eq
    (relation : Alpha left right) :
    left.sendPrefixCount = right.sendPrefixCount := by
  induction relation <;>
    simp_all [Raw.Proc.sendPrefixCount,
      Raw.Proc.renameBound_eq_substRaw,
      Raw.Proc.sendPrefixCount_substRaw]

/-- Alpha conversion preserves input-prefix polarity counts. -/
theorem recvPrefixCount_eq
    (relation : Alpha left right) :
    left.recvPrefixCount = right.recvPrefixCount := by
  induction relation <;>
    simp_all [Raw.Proc.recvPrefixCount,
      Raw.Proc.renameBound_eq_substRaw,
      Raw.Proc.recvPrefixCount_substRaw]

/-- Alpha conversion preserves value-to-continuation subject incidence. -/
theorem outputLinkCount_eq
    (relation : Alpha left right) :
    left.outputLinkCount = right.outputLinkCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      have support := Late.Alpha.freeSubjects_eq relation
      simp [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
        inductionHypothesis, support]
  | recv relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.outputLinkCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.outputLinkCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | recvBinder fresh =>
      simp [Raw.Proc.outputLinkCount, Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.outputLinkCount_substRaw _ _ _ fresh]
  | newBinder fresh =>
      simp [Raw.Proc.outputLinkCount, Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.outputLinkCount_substRaw _ _ _ fresh]

/-- Alpha conversion preserves binder-to-continuation subject incidence. -/
theorem inputLinkCount_eq
    (relation : Alpha left right) :
    left.inputLinkCount = right.inputLinkCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | recv relation inductionHypothesis =>
      have support := Late.Alpha.freeSubjects_eq relation
      simp [Raw.Proc.inputLinkCount, Raw.Proc.subjectLink,
        inductionHypothesis, support]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.inputLinkCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.inputLinkCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | @recvBinder replacement channel binder body fresh =>
      by_cases same : binder = replacement
      · subst binder
        simp [Raw.Proc.inputLinkCount,
          Raw.Proc.renameBound_eq_substRaw,
          Raw.Proc.substRaw_self]
      · have bodyInvariant :=
          Raw.Proc.inputLinkCount_substRaw body binder replacement fresh
        have linkInvariant :=
          Raw.Proc.subjectLink_substRaw body binder replacement binder
            fresh same
        have linkInvariant' :
            Raw.Proc.subjectLink replacement
                (body.substRaw binder replacement) =
              Raw.Proc.subjectLink binder body := by
          simpa [Raw.Proc.substName] using linkInvariant
        simp [Raw.Proc.inputLinkCount,
          Raw.Proc.renameBound_eq_substRaw, bodyInvariant,
          same, linkInvariant']
  | newBinder fresh =>
      simp [Raw.Proc.inputLinkCount, Raw.Proc.renameBound_eq_substRaw,
        Raw.Proc.inputLinkCount_substRaw _ _ _ fresh]

end Late.Alpha

namespace Late.Struct

/-- Structural congruence preserves the enabled-thread count. -/
theorem headPrefixCount_eq
    (relation : Struct left right) :
    left.headPrefixCount = right.headPrefixCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.headPrefixCount_eq relation
  | tau relation inductionHypothesis =>
      rfl
  | send relation inductionHypothesis =>
      rfl
  | recv relation inductionHypothesis =>
      rfl
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.headPrefixCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.headPrefixCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.headPrefixCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      rfl
  | matchNe relation inductionHypothesis =>
      rfl
  | parZero =>
      simp [Raw.Proc.headPrefixCount]
  | parComm =>
      simp [Raw.Proc.headPrefixCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.headPrefixCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.headPrefixCount]
  | choiceComm =>
      simp [Raw.Proc.headPrefixCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.headPrefixCount, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

/-- Structural congruence preserves enabled-thread square mass. -/
theorem topThreadSquareMass_eq
    (relation : Struct left right) :
    left.topThreadSquareMass = right.topThreadSquareMass := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.topThreadSquareMass_eq relation
  | tau relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Struct.prefixCount_eq relation]
  | send relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Struct.prefixCount_eq relation]
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Struct.prefixCount_eq relation]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.topThreadSquareMass, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.topThreadSquareMass, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.topThreadSquareMass] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Struct.prefixCount_eq relation]
  | matchNe relation inductionHypothesis =>
      simp [Raw.Proc.topThreadSquareMass, Raw.Proc.prefixCount,
        Late.Struct.prefixCount_eq relation]
  | parZero =>
      simp [Raw.Proc.topThreadSquareMass]
  | parComm =>
      simp [Raw.Proc.topThreadSquareMass, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.topThreadSquareMass, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.topThreadSquareMass]
  | choiceComm =>
      simp [Raw.Proc.topThreadSquareMass, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.topThreadSquareMass, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

/-- Structural congruence preserves live-choice branching potential. -/
theorem choicePotential_eq
    (relation : Struct left right) :
    left.choicePotential = right.choicePotential := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.choicePotential_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | send relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | recv relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.choicePotential, leftIH, rightIH,
        Late.Struct.prefixCount_eq leftRelation,
        Late.Struct.prefixCount_eq rightRelation]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.choicePotential, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.choicePotential] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.choicePotential]
  | parComm =>
      simp [Raw.Proc.choicePotential, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.choicePotential, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.choicePotential, Raw.Proc.prefixCount]
  | choiceComm =>
      simp [Raw.Proc.choicePotential, Nat.add_comm, Nat.mul_comm]
  | choiceAssoc =>
      simp [Raw.Proc.choicePotential, Raw.Proc.prefixCount,
        Nat.add_mul, Nat.mul_add]
      omega
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

/-- Structural congruence preserves output-prefix polarity. -/
theorem sendPrefixCount_eq
    (relation : Struct left right) :
    left.sendPrefixCount = right.sendPrefixCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.sendPrefixCount_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.sendPrefixCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simp [Raw.Proc.sendPrefixCount, inductionHypothesis]
  | recv relation inductionHypothesis =>
      simpa [Raw.Proc.sendPrefixCount] using inductionHypothesis
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.sendPrefixCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.sendPrefixCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.sendPrefixCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.sendPrefixCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.sendPrefixCount] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.sendPrefixCount]
  | parComm =>
      simp [Raw.Proc.sendPrefixCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.sendPrefixCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.sendPrefixCount]
  | choiceComm =>
      simp [Raw.Proc.sendPrefixCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.sendPrefixCount, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

/-- Structural congruence preserves input-prefix polarity. -/
theorem recvPrefixCount_eq
    (relation : Struct left right) :
    left.recvPrefixCount = right.recvPrefixCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.recvPrefixCount_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.recvPrefixCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simpa [Raw.Proc.recvPrefixCount] using inductionHypothesis
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.recvPrefixCount, inductionHypothesis]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.recvPrefixCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.recvPrefixCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.recvPrefixCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.recvPrefixCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.recvPrefixCount] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.recvPrefixCount]
  | parComm =>
      simp [Raw.Proc.recvPrefixCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.recvPrefixCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.recvPrefixCount]
  | choiceComm =>
      simp [Raw.Proc.recvPrefixCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.recvPrefixCount, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

/-- Structural congruence preserves transmitted-value subject links. -/
theorem outputLinkCount_eq
    (relation : Struct left right) :
    left.outputLinkCount = right.outputLinkCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.outputLinkCount_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      have support := Late.Struct.freeSubjects_eq relation
      simp [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
        inductionHypothesis, support]
  | recv relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.outputLinkCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.outputLinkCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.outputLinkCount]
  | parComm =>
      simp [Raw.Proc.outputLinkCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.outputLinkCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.outputLinkCount]
  | choiceComm =>
      simp [Raw.Proc.outputLinkCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.outputLinkCount, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

/-- Structural congruence preserves input-binder subject links. -/
theorem inputLinkCount_eq
    (relation : Struct left right) :
    left.inputLinkCount = right.inputLinkCount := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.inputLinkCount_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | send relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | recv relation inductionHypothesis =>
      have support := Late.Struct.freeSubjects_eq relation
      simp [Raw.Proc.inputLinkCount, Raw.Proc.subjectLink,
        inductionHypothesis, support]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.inputLinkCount, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.inputLinkCount, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.inputLinkCount]
  | parComm =>
      simp [Raw.Proc.inputLinkCount, Nat.add_comm]
  | parAssoc =>
      simp [Raw.Proc.inputLinkCount, Nat.add_assoc]
  | choiceZero =>
      simp [Raw.Proc.inputLinkCount]
  | choiceComm =>
      simp [Raw.Proc.inputLinkCount, Nat.add_comm]
  | choiceAssoc =>
      simp [Raw.Proc.inputLinkCount, Nat.add_assoc]
  | newZero =>
      rfl
  | newComm distinct =>
      rfl
  | scopeExtrude fresh =>
      rfl

end Late.Struct

namespace Raw.Proc

/-- No enabled sequential head implies no executable prefix anywhere. -/
theorem prefixCount_eq_zero_of_headPrefixCount_eq_zero
    (process : Raw.Proc)
    (empty : process.headPrefixCount = 0) :
    process.prefixCount = 0 := by
  induction process with
  | zero =>
      rfl
  | tau next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | send channel value next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | recv channel binder next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | choice left right leftIH rightIH =>
      simp only [headPrefixCount, Nat.add_eq_zero_iff] at empty
      simp [Raw.Proc.prefixCount, leftIH empty.1, rightIH empty.2]
  | par left right leftIH rightIH =>
      simp only [headPrefixCount, Nat.add_eq_zero_iff] at empty
      simp [Raw.Proc.prefixCount, leftIH empty.1, rightIH empty.2]
  | new binder body inductionHypothesis =>
      simpa [headPrefixCount, Raw.Proc.prefixCount] using
        inductionHypothesis empty
  | matchEq left right next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | matchNe left right next inductionHypothesis =>
      simp [headPrefixCount] at empty

/-- No enabled sequential head also implies zero square mass. -/
theorem topThreadSquareMass_eq_zero_of_headPrefixCount_eq_zero
    (process : Raw.Proc)
    (empty : process.headPrefixCount = 0) :
    process.topThreadSquareMass = 0 := by
  induction process with
  | zero =>
      rfl
  | tau next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | send channel value next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | recv channel binder next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | choice left right leftIH rightIH =>
      simp only [headPrefixCount, Nat.add_eq_zero_iff] at empty
      simp [topThreadSquareMass, leftIH empty.1, rightIH empty.2]
  | par left right leftIH rightIH =>
      simp only [headPrefixCount, Nat.add_eq_zero_iff] at empty
      simp [topThreadSquareMass, leftIH empty.1, rightIH empty.2]
  | new binder body inductionHypothesis =>
      simpa [headPrefixCount, topThreadSquareMass] using
        inductionHypothesis empty
  | matchEq left right next inductionHypothesis =>
      simp [headPrefixCount] at empty
  | matchNe left right next inductionHypothesis =>
      simp [headPrefixCount] at empty

/--
If exactly one sequential thread is enabled, square mass recovers the square
of the complete prefix count of that thread.
-/
theorem topThreadSquareMass_eq_prefixCount_mul_self_of_headPrefixCount_eq_one
    (process : Raw.Proc)
    (single : process.headPrefixCount = 1) :
    process.topThreadSquareMass =
      process.prefixCount * process.prefixCount := by
  induction process with
  | zero =>
      simp [headPrefixCount] at single
  | tau next inductionHypothesis =>
      rfl
  | send channel value next inductionHypothesis =>
      rfl
  | recv channel binder next inductionHypothesis =>
      rfl
  | choice left right leftIH rightIH =>
      simp only [headPrefixCount] at single
      rcases Nat.eq_zero_or_pos left.headPrefixCount with leftZero | leftPositive
      · have rightOne : right.headPrefixCount = 1 := by omega
        have leftPrefixes :=
          prefixCount_eq_zero_of_headPrefixCount_eq_zero left leftZero
        have leftMass :=
          topThreadSquareMass_eq_zero_of_headPrefixCount_eq_zero left leftZero
        simp [topThreadSquareMass, Raw.Proc.prefixCount,
          leftPrefixes, leftMass, rightIH rightOne]
      · have leftOne : left.headPrefixCount = 1 := by omega
        have rightZero : right.headPrefixCount = 0 := by omega
        have rightPrefixes :=
          prefixCount_eq_zero_of_headPrefixCount_eq_zero right rightZero
        have rightMass :=
          topThreadSquareMass_eq_zero_of_headPrefixCount_eq_zero right rightZero
        simp [topThreadSquareMass, Raw.Proc.prefixCount,
          rightPrefixes, rightMass, leftIH leftOne]
  | par left right leftIH rightIH =>
      simp only [headPrefixCount] at single
      rcases Nat.eq_zero_or_pos left.headPrefixCount with leftZero | leftPositive
      · have rightOne : right.headPrefixCount = 1 := by omega
        have leftPrefixes :=
          prefixCount_eq_zero_of_headPrefixCount_eq_zero left leftZero
        have leftMass :=
          topThreadSquareMass_eq_zero_of_headPrefixCount_eq_zero left leftZero
        simp [topThreadSquareMass, Raw.Proc.prefixCount,
          leftPrefixes, leftMass, rightIH rightOne]
      · have leftOne : left.headPrefixCount = 1 := by omega
        have rightZero : right.headPrefixCount = 0 := by omega
        have rightPrefixes :=
          prefixCount_eq_zero_of_headPrefixCount_eq_zero right rightZero
        have rightMass :=
          topThreadSquareMass_eq_zero_of_headPrefixCount_eq_zero right rightZero
        simp [topThreadSquareMass, Raw.Proc.prefixCount,
          rightPrefixes, rightMass, leftIH leftOne]
  | new binder body inductionHypothesis =>
      simpa [headPrefixCount, topThreadSquareMass,
        Raw.Proc.prefixCount] using inductionHypothesis single
  | matchEq left right next inductionHypothesis =>
      rfl
  | matchNe left right next inductionHypothesis =>
      rfl

end Raw.Proc

namespace Late.NativeStep

/-- Every native strong-late derivation exposes at least one enabled head. -/
theorem source_headPrefixCount_pos
    (step : NativeStep source action target) :
    0 < source.headPrefixCount := by
  induction step <;>
    simp_all [Raw.Proc.headPrefixCount] <;>
    omega

/-!
### Exact quantitative residual

The generic late-semantics library proves only that a communication-only
`tau` consumes *at least* two prefixes.  Choice can normally make that bound
strict by discarding an unselected live branch.  The requesting fingerprint's
zero `choicePotential` rules out exactly that source of loss.

The helper below is private because its action cost is only an induction
device for the requesting residual.  It says that a unary-free step consumes
one prefix for a visible input/output (including bound output) and two for a
silent communication, provided no choice node has two live branches.
-/

private def actionPrefixCost : Raw.Action → Nat
  | .tau => 2
  | .output _ _ => 1
  | .input _ _ => 1
  | .boundOutput _ _ => 1

/-!
The two polarity costs are action-sensitive.  Under the unary-free
hypothesis a silent action can only be a binary communication, so it consumes
one output and one input.  Free and bound output consume one output only;
late input consumes one input only.
-/

private def sendActionCost : Raw.Action → Nat
  | .tau => 1
  | .output _ _ => 1
  | .input _ _ => 0
  | .boundOutput _ _ => 1

private def recvActionCost : Raw.Action → Nat
  | .tau => 1
  | .output _ _ => 0
  | .input _ _ => 1
  | .boundOutput _ _ => 0

/-- A prefix-free process has neither output nor input prefixes. -/
private theorem polarityCounts_eq_zero_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.sendPrefixCount = 0 ∧ process.recvPrefixCount = 0 := by
  have communicationBound :=
    Raw.Proc.communicationPrefixCount_le_prefixCount process
  have polarityPartition :=
    Raw.Proc.communicationPrefixCount_eq_send_add_recv process
  omega

/--
Exact action-sensitive polarity consumption.  `choicePotential = 0` is the
condition which prevents a selected choice branch from discarding additional
send or receive prefixes; `unaryPrefixCount = 0` excludes the unary `tau` and
guard constructors.
-/
private theorem target_polarityCounts_add_cost_eq_of_noUnary_noChoice
    (step : NativeStep source action target)
    (noUnary : source.unaryPrefixCount = 0)
    (noChoiceLoss : source.choicePotential = 0) :
    (target.sendPrefixCount + sendActionCost action =
        source.sendPrefixCount) ∧
      (target.recvPrefixCount + recvActionCost action =
        source.recvPrefixCount) := by
  induction step with
  | prefixTau =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | prefixOutput =>
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        sendActionCost, recvActionCost]
  | prefixInput =>
      simp [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        sendActionCost, recvActionCost]
  | matchGuard inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | mismatchGuard distinct inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | @choiceLeft active action' next inactive inner inductionHypothesis =>
      have activePositive := inner.source_prefixCount_pos
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨activeNoUnary, _inactiveNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨choiceSumZero, branchProduct⟩
      rcases Nat.add_eq_zero_iff.mp choiceSumZero with
        ⟨activeNoChoice, _inactiveNoChoice⟩
      have inactiveZero : inactive.prefixCount = 0 := by
        rcases Nat.mul_eq_zero.mp branchProduct with leftZero | rightZero
        · exact (Nat.ne_of_gt activePositive leftZero).elim
        · exact rightZero
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          inactive inactiveZero with
        ⟨inactiveSend, inactiveRecv⟩
      rcases inductionHypothesis activeNoUnary activeNoChoice with
        ⟨sendResidual, recvResidual⟩
      constructor
      · simp only [Raw.Proc.sendPrefixCount] at sendResidual ⊢
        omega
      · simp only [Raw.Proc.recvPrefixCount] at recvResidual ⊢
        omega
  | @choiceRight active action' next inactive inner inductionHypothesis =>
      have activePositive := inner.source_prefixCount_pos
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨_inactiveNoUnary, activeNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨choiceSumZero, branchProduct⟩
      rcases Nat.add_eq_zero_iff.mp choiceSumZero with
        ⟨_inactiveNoChoice, activeNoChoice⟩
      have inactiveZero : inactive.prefixCount = 0 := by
        rcases Nat.mul_eq_zero.mp branchProduct with leftZero | rightZero
        · exact leftZero
        · exact (Nat.ne_of_gt activePositive rightZero).elim
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          inactive inactiveZero with
        ⟨inactiveSend, inactiveRecv⟩
      rcases inductionHypothesis activeNoUnary activeNoChoice with
        ⟨sendResidual, recvResidual⟩
      constructor
      · simp only [Raw.Proc.sendPrefixCount] at sendResidual ⊢
        omega
      · simp only [Raw.Proc.recvPrefixCount] at recvResidual ⊢
        omega
  | parLeft fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨activeNoUnary, _inactiveNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨activeNoChoice, _inactiveNoChoice⟩
      rcases inductionHypothesis activeNoUnary activeNoChoice with
        ⟨sendResidual, recvResidual⟩
      constructor
      · simp only [Raw.Proc.sendPrefixCount] at sendResidual ⊢
        omega
      · simp only [Raw.Proc.recvPrefixCount] at recvResidual ⊢
        omega
  | parRight fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨_inactiveNoUnary, activeNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨_inactiveNoChoice, activeNoChoice⟩
      rcases inductionHypothesis activeNoUnary activeNoChoice with
        ⟨sendResidual, recvResidual⟩
      constructor
      · simp only [Raw.Proc.sendPrefixCount] at sendResidual ⊢
        omega
      · simp only [Raw.Proc.recvPrefixCount] at recvResidual ⊢
        omega
  | syncLeft outputStep inputStep binderFresh outputIH inputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨outputNoUnary, inputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨outputNoChoice, inputNoChoice⟩
      rcases outputIH outputNoUnary outputNoChoice with
        ⟨outputSend, outputRecv⟩
      rcases inputIH inputNoUnary inputNoChoice with
        ⟨inputSend, inputRecv⟩
      simp only [sendActionCost, recvActionCost] at outputSend outputRecv inputSend inputRecv
      constructor
      · simp only [Raw.Proc.sendPrefixCount, sendActionCost]
        rw [Raw.Proc.sendPrefixCount_substituteCaptureAvoiding]
        omega
      · simp only [Raw.Proc.recvPrefixCount, recvActionCost]
        rw [Raw.Proc.recvPrefixCount_substituteCaptureAvoiding]
        omega
  | syncRight inputStep outputStep binderFresh inputIH outputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨inputNoUnary, outputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨inputNoChoice, outputNoChoice⟩
      rcases inputIH inputNoUnary inputNoChoice with
        ⟨inputSend, inputRecv⟩
      rcases outputIH outputNoUnary outputNoChoice with
        ⟨outputSend, outputRecv⟩
      simp only [sendActionCost, recvActionCost] at inputSend inputRecv outputSend outputRecv
      constructor
      · simp only [Raw.Proc.sendPrefixCount, sendActionCost]
        rw [Raw.Proc.sendPrefixCount_substituteCaptureAvoiding]
        omega
      · simp only [Raw.Proc.recvPrefixCount, recvActionCost]
        rw [Raw.Proc.recvPrefixCount_substituteCaptureAvoiding]
        omega
  | restrict fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      simpa [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount] using
        inductionHypothesis noUnary noChoiceLoss
  | «open» distinct inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      simpa [Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
        sendActionCost, recvActionCost] using
        inductionHypothesis noUnary noChoiceLoss
  | closeLeft outputStep inputStep freshForReceiver binderFresh
      outputIH inputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨outputNoUnary, inputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨outputNoChoice, inputNoChoice⟩
      rcases outputIH outputNoUnary outputNoChoice with
        ⟨outputSend, outputRecv⟩
      rcases inputIH inputNoUnary inputNoChoice with
        ⟨inputSend, inputRecv⟩
      simp only [sendActionCost, recvActionCost] at outputSend outputRecv inputSend inputRecv
      constructor
      · simp only [Raw.Proc.sendPrefixCount, sendActionCost]
        rw [Raw.Proc.sendPrefixCount_substituteCaptureAvoiding]
        omega
      · simp only [Raw.Proc.recvPrefixCount, recvActionCost]
        rw [Raw.Proc.recvPrefixCount_substituteCaptureAvoiding]
        omega
  | closeRight inputStep outputStep freshForReceiver binderFresh
      inputIH outputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨inputNoUnary, outputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨inputNoChoice, outputNoChoice⟩
      rcases inputIH inputNoUnary inputNoChoice with
        ⟨inputSend, inputRecv⟩
      rcases outputIH outputNoUnary outputNoChoice with
        ⟨outputSend, outputRecv⟩
      simp only [sendActionCost, recvActionCost] at inputSend inputRecv outputSend outputRecv
      constructor
      · simp only [Raw.Proc.sendPrefixCount, sendActionCost]
        rw [Raw.Proc.sendPrefixCount_substituteCaptureAvoiding]
        omega
      · simp only [Raw.Proc.recvPrefixCount, recvActionCost]
        rw [Raw.Proc.recvPrefixCount_substituteCaptureAvoiding]
        omega

/--
A unary-free, no-live-choice native communication consumes exactly one output
prefix.  The result covers both ordinary synchronization and `open`/`close`.
-/
theorem target_sendPrefixCount_add_one_eq_of_tau_noUnary_noChoice
    (step : NativeStep source .tau target)
    (noUnary : source.unaryPrefixCount = 0)
    (noChoiceLoss : source.choicePotential = 0) :
    target.sendPrefixCount + 1 = source.sendPrefixCount := by
  simpa [sendActionCost] using
    (target_polarityCounts_add_cost_eq_of_noUnary_noChoice
      step noUnary noChoiceLoss).1

/--
A unary-free, no-live-choice native communication consumes exactly one input
prefix.  Capture-avoiding substitution cannot change this polarity count.
-/
theorem target_recvPrefixCount_add_one_eq_of_tau_noUnary_noChoice
    (step : NativeStep source .tau target)
    (noUnary : source.unaryPrefixCount = 0)
    (noChoiceLoss : source.choicePotential = 0) :
    target.recvPrefixCount + 1 = source.recvPrefixCount := by
  simpa [recvActionCost] using
    (target_polarityCounts_add_cost_eq_of_noUnary_noChoice
      step noUnary noChoiceLoss).2

private theorem target_prefixCount_add_cost_eq_of_noUnary_noChoice
    (step : NativeStep source action target)
    (noUnary : source.unaryPrefixCount = 0)
    (noChoiceLoss : source.choicePotential = 0) :
    target.prefixCount + actionPrefixCost action =
      source.prefixCount := by
  induction step with
  | prefixTau =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | prefixOutput =>
      simp [Raw.Proc.prefixCount, actionPrefixCost]
  | prefixInput =>
      simp [Raw.Proc.prefixCount, actionPrefixCost]
  | matchGuard inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | mismatchGuard distinct inner inductionHypothesis =>
      simp [Raw.Proc.unaryPrefixCount] at noUnary
  | @choiceLeft active action' next inactive inner inductionHypothesis =>
      have activePositive := inner.source_prefixCount_pos
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨activeNoUnary, _inactiveNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨choiceSumZero, branchProduct⟩
      rcases Nat.add_eq_zero_iff.mp choiceSumZero with
        ⟨activeNoChoice, _inactiveNoChoice⟩
      have inactiveZero : inactive.prefixCount = 0 := by
        rcases Nat.mul_eq_zero.mp branchProduct with leftZero | rightZero
        · exact (Nat.ne_of_gt activePositive leftZero).elim
        · exact rightZero
      have residual :=
        inductionHypothesis activeNoUnary activeNoChoice
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | @choiceRight active action' next inactive inner inductionHypothesis =>
      have activePositive := inner.source_prefixCount_pos
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨_inactiveNoUnary, activeNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨choiceSumZero, branchProduct⟩
      rcases Nat.add_eq_zero_iff.mp choiceSumZero with
        ⟨_inactiveNoChoice, activeNoChoice⟩
      have inactiveZero : inactive.prefixCount = 0 := by
        rcases Nat.mul_eq_zero.mp branchProduct with leftZero | rightZero
        · exact leftZero
        · exact (Nat.ne_of_gt activePositive rightZero).elim
      have residual :=
        inductionHypothesis activeNoUnary activeNoChoice
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | parLeft fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨activeNoUnary, _inactiveNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨activeNoChoice, _inactiveNoChoice⟩
      have residual :=
        inductionHypothesis activeNoUnary activeNoChoice
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | parRight fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨_inactiveNoUnary, activeNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨_inactiveNoChoice, activeNoChoice⟩
      have residual :=
        inductionHypothesis activeNoUnary activeNoChoice
      simp only [Raw.Proc.prefixCount] at residual ⊢
      omega
  | syncLeft outputStep inputStep binderFresh outputIH inputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨outputNoUnary, inputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨outputNoChoice, inputNoChoice⟩
      have outputResidual :=
        outputIH outputNoUnary outputNoChoice
      have inputResidual :=
        inputIH inputNoUnary inputNoChoice
      simp only [actionPrefixCost] at outputResidual inputResidual ⊢
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega
  | syncRight inputStep outputStep binderFresh inputIH outputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨inputNoUnary, outputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨inputNoChoice, outputNoChoice⟩
      have inputResidual :=
        inputIH inputNoUnary inputNoChoice
      have outputResidual :=
        outputIH outputNoUnary outputNoChoice
      simp only [actionPrefixCost] at inputResidual outputResidual ⊢
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega
  | restrict fresh inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      simpa [Raw.Proc.prefixCount] using
        inductionHypothesis noUnary noChoiceLoss
  | «open» distinct inner inductionHypothesis =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      simpa [Raw.Proc.prefixCount, actionPrefixCost] using
        inductionHypothesis noUnary noChoiceLoss
  | closeLeft outputStep inputStep freshForReceiver binderFresh
      outputIH inputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨outputNoUnary, inputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨outputNoChoice, inputNoChoice⟩
      have outputResidual :=
        outputIH outputNoUnary outputNoChoice
      have inputResidual :=
        inputIH inputNoUnary inputNoChoice
      simp only [actionPrefixCost] at outputResidual inputResidual ⊢
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega
  | closeRight inputStep outputStep freshForReceiver binderFresh
      inputIH outputIH =>
      simp only [Raw.Proc.unaryPrefixCount] at noUnary
      simp only [Raw.Proc.choicePotential] at noChoiceLoss
      rcases Nat.add_eq_zero_iff.mp noUnary with
        ⟨inputNoUnary, outputNoUnary⟩
      rcases Nat.add_eq_zero_iff.mp noChoiceLoss with
        ⟨inputNoChoice, outputNoChoice⟩
      have inputResidual :=
        inputIH inputNoUnary inputNoChoice
      have outputResidual :=
        outputIH outputNoUnary outputNoChoice
      simp only [actionPrefixCost] at inputResidual outputResidual ⊢
      simp only [Raw.Proc.prefixCount]
      rw [Raw.Proc.prefixCount_substituteCaptureAvoiding]
      omega

/--
A unary-free silent native step consumes exactly two prefixes when every
choice node has at most one live branch.  Unlike the generic lower bound,
this equality accounts for (and excludes) prefix loss from choice selection.
-/
theorem target_prefixCount_add_two_eq_of_tau_noUnary_noChoice
    (step : NativeStep source .tau target)
    (noUnary : source.unaryPrefixCount = 0)
    (noChoiceLoss : source.choicePotential = 0) :
    target.prefixCount + 2 = source.prefixCount := by
  simpa [actionPrefixCost] using
    target_prefixCount_add_cost_eq_of_noUnary_noChoice
      step noUnary noChoiceLoss

end Late.NativeStep

namespace P1bRequestingFingerprint

open Cantilune.Pi.Protocols

/-- The canonical erased source of the first request/accept handshake. -/
def canonicalRequesting : Raw.Proc :=
  closedRestrictedHandshake.erase

/--
The seven source-specific invariants of the canonical requesting state:
two enabled guarded threads of length two, no live choice, balanced
input/output polarity, and one continuation subject link in each direction.
-/
theorem canonicalRequesting_fingerprint :
    canonicalRequesting.headPrefixCount = 2 ∧
    canonicalRequesting.topThreadSquareMass = 8 ∧
    canonicalRequesting.choicePotential = 0 ∧
    canonicalRequesting.sendPrefixCount = 2 ∧
    canonicalRequesting.recvPrefixCount = 2 ∧
    canonicalRequesting.outputLinkCount = 1 ∧
    canonicalRequesting.inputLinkCount = 1 := by
  norm_num [canonicalRequesting, closedRestrictedHandshake,
    restrictedHandshake, request, accept, requestContinuation,
    acceptContinuation, Proc.erase, Raw.Proc.headPrefixCount,
    Raw.Proc.topThreadSquareMass, Raw.Proc.choicePotential,
    Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
    Raw.Proc.outputLinkCount, Raw.Proc.inputLinkCount,
    Raw.Proc.subjectLink, Raw.Proc.prefixCount, Raw.Proc.freeSubjects,
    publicChannel, sessionChannel, boundSessionChannel,
    publicName, session, sessionBinder, payload, payloadBinder]

/-- Every structural representative of the requesting source has the same fingerprint. -/
theorem fingerprint_of_struct_canonicalRequesting
    {source : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source) :
    source.headPrefixCount = 2 ∧
    source.topThreadSquareMass = 8 ∧
    source.choicePotential = 0 ∧
    source.sendPrefixCount = 2 ∧
    source.recvPrefixCount = 2 ∧
    source.outputLinkCount = 1 ∧
    source.inputLinkCount = 1 := by
  rcases canonicalRequesting_fingerprint with
    ⟨heads, mass, choices, sends, receives, outputLinks, inputLinks⟩
  exact ⟨
    (Late.Struct.headPrefixCount_eq relation).symm.trans heads,
    (Late.Struct.topThreadSquareMass_eq relation).symm.trans mass,
    (Late.Struct.choicePotential_eq relation).symm.trans choices,
    (Late.Struct.sendPrefixCount_eq relation).symm.trans sends,
    (Late.Struct.recvPrefixCount_eq relation).symm.trans receives,
    (Late.Struct.outputLinkCount_eq relation).symm.trans outputLinks,
    (Late.Struct.inputLinkCount_eq relation).symm.trans inputLinks⟩

/-!
## Augmented requesting fingerprint

The seven numeric fields deliberately forget name identity.  The exact
requesting orbit additionally carries the free-name and free-subject
interfaces already known to be invariant under `Late.Struct`.  This
nine-field bundle is only a low-risk packaging lemma; it does not assert the
pending `4 → 2` residual theorem.

The declarations in this section are kernel-checked.  They remain necessary
conditions and deliberately do not assert the pending positional sufficiency
theorem.
-/

/--
Seven guarded-thread measurements plus the two exact nominal support
interfaces of the closed request/accept source.
-/
structure AugmentedRequestingFingerprint
    (process : Raw.Proc) : Prop where
  headPrefixCount_eq :
    process.headPrefixCount = 2
  topThreadSquareMass_eq :
    process.topThreadSquareMass = 8
  choicePotential_eq :
    process.choicePotential = 0
  sendPrefixCount_eq :
    process.sendPrefixCount = 2
  recvPrefixCount_eq :
    process.recvPrefixCount = 2
  outputLinkCount_eq :
    process.outputLinkCount = 1
  inputLinkCount_eq :
    process.inputLinkCount = 1
  freeNames_eq :
    process.freeNames = {payload}
  freeSubjects_eq :
    process.freeSubjects = ∅

/--
Every augmented requesting candidate has exactly the
four communication prefixes recorded by its two polarity fields.
-/
theorem AugmentedRequestingFingerprint.communicationPrefixCount_eq
    {process : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process) :
    process.communicationPrefixCount = 4 := by
  rw [Raw.Proc.communicationPrefixCount_eq_send_add_recv,
    fingerprint.sendPrefixCount_eq, fingerprint.recvPrefixCount_eq]

/--
The communication partition gives the lower half of
the requesting four-prefix normal-form argument.
-/
theorem AugmentedRequestingFingerprint.four_le_prefixCount
    {process : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process) :
    4 ≤ process.prefixCount := by
  rw [← fingerprint.communicationPrefixCount_eq]
  exact Raw.Proc.communicationPrefixCount_le_prefixCount process

/--
The enabled-thread extractor sees exactly the two
length-two guarded communication threads used by the positional normal-form
argument.  This fixes their lengths but deliberately records no name
incidence or polarity order.
-/
theorem AugmentedRequestingFingerprint.topThreadLengths_eq
    {process : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process) :
    process.topThreadLengths = [2, 2] :=
  Raw.Proc.topThreadLengths_eq_two_two_of_head_two_mass_eight process
    fingerprint.headPrefixCount_eq fingerprint.topThreadSquareMass_eq

/--
The two guarded threads and square mass fix the total
prefix count at four.
-/
theorem AugmentedRequestingFingerprint.prefixCount_eq
    {process : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process) :
    process.prefixCount = 4 :=
  Raw.Proc.prefixCount_eq_four_of_head_two_mass_eight process
    fingerprint.headPrefixCount_eq fingerprint.topThreadSquareMass_eq

/--
All four prefixes in an augmented requesting
candidate are communication prefixes.
-/
theorem AugmentedRequestingFingerprint.unaryPrefixCount_eq
    {process : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process) :
    process.unaryPrefixCount = 0 := by
  have partition :=
    Raw.Proc.prefixCount_eq_communication_add_unary process
  rw [fingerprint.prefixCount_eq,
    fingerprint.communicationPrefixCount_eq] at partition
  omega

/--
Every native silent derivative of an augmented
requesting candidate has exactly the two residual payload prefixes.

This is the exact quantitative `4 → 2` residual.  It intentionally does not
identify the residual's binder/channel incidence or claim structural
congruence with `closedHandshakeResult.erase`; those are the remaining
positional normal-form obligations.
-/
theorem AugmentedRequestingFingerprint.native_tau_target_prefixCount_eq
    {process target : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process)
    (step : Late.NativeStep process .tau target) :
    target.prefixCount = 2 := by
  have exactResidual :=
    Late.NativeStep.target_prefixCount_add_two_eq_of_tau_noUnary_noChoice
      step fingerprint.unaryPrefixCount_eq
        fingerprint.choicePotential_eq
  rw [fingerprint.prefixCount_eq] at exactResidual
  omega

/--
The first request/accept communication leaves exactly
one output prefix in its native residual.
-/
theorem AugmentedRequestingFingerprint.native_tau_target_sendPrefixCount_eq
    {process target : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process)
    (step : Late.NativeStep process .tau target) :
    target.sendPrefixCount = 1 := by
  have exactResidual :=
    Late.NativeStep.target_sendPrefixCount_add_one_eq_of_tau_noUnary_noChoice
      step fingerprint.unaryPrefixCount_eq
        fingerprint.choicePotential_eq
  rw [fingerprint.sendPrefixCount_eq] at exactResidual
  omega

/--
The first request/accept communication leaves exactly
one input prefix in its native residual.
-/
theorem AugmentedRequestingFingerprint.native_tau_target_recvPrefixCount_eq
    {process target : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process)
    (step : Late.NativeStep process .tau target) :
    target.recvPrefixCount = 1 := by
  have exactResidual :=
    Late.NativeStep.target_recvPrefixCount_add_one_eq_of_tau_noUnary_noChoice
      step fingerprint.unaryPrefixCount_eq
        fingerprint.choicePotential_eq
  rw [fingerprint.recvPrefixCount_eq] at exactResidual
  omega

/--
Compatibility helper for callers which already carry an independent upper
bound.  The result is now also available unconditionally above from the
guarded-thread square-mass lemma.
-/
theorem AugmentedRequestingFingerprint.noUnary_of_prefixCount_le_four
    {process : Raw.Proc}
    (fingerprint : AugmentedRequestingFingerprint process)
    (upper : process.prefixCount ≤ 4) :
    process.prefixCount = 4 ∧ process.unaryPrefixCount = 0 := by
  have partition :=
    Raw.Proc.prefixCount_eq_communication_add_unary process
  rw [fingerprint.communicationPrefixCount_eq] at partition
  omega

/--
The canonical erased requesting process inhabits the
nine-field bundle.
-/
theorem canonicalRequesting_augmentedFingerprint :
    AugmentedRequestingFingerprint canonicalRequesting := by
  rcases canonicalRequesting_fingerprint with
    ⟨heads, mass, choices, sends, receives, outputLinks, inputLinks⟩
  refine {
    headPrefixCount_eq := heads
    topThreadSquareMass_eq := mass
    choicePotential_eq := choices
    sendPrefixCount_eq := sends
    recvPrefixCount_eq := receives
    outputLinkCount_eq := outputLinks
    inputLinkCount_eq := inputLinks
    freeNames_eq := ?_
    freeSubjects_eq := ?_
  }
  · norm_num [canonicalRequesting, closedRestrictedHandshake,
      restrictedHandshake, request, accept, requestContinuation,
      acceptContinuation, Proc.erase, Raw.Proc.freeNames,
      publicChannel, sessionChannel, boundSessionChannel,
      publicName, session, sessionBinder, payload, payloadBinder]
    decide
  · norm_num [canonicalRequesting, closedRestrictedHandshake,
      restrictedHandshake, request, accept, requestContinuation,
      acceptContinuation, Proc.erase, Raw.Proc.freeSubjects,
      publicChannel, sessionChannel, boundSessionChannel,
      publicName, session, sessionBinder, payload, payloadBinder]

/--
Structural representatives of the canonical
requesting source inherit both the numeric and nominal parts of the bundle.
-/
theorem augmentedFingerprint_of_struct_canonicalRequesting
    {source : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source) :
    AugmentedRequestingFingerprint source := by
  rcases fingerprint_of_struct_canonicalRequesting relation with
    ⟨heads, mass, choices, sends, receives, outputLinks, inputLinks⟩
  exact {
    headPrefixCount_eq := heads
    topThreadSquareMass_eq := mass
    choicePotential_eq := choices
    sendPrefixCount_eq := sends
    recvPrefixCount_eq := receives
    outputLinkCount_eq := outputLinks
    inputLinkCount_eq := inputLinks
    freeNames_eq :=
      (Late.Struct.freeNames_eq relation).symm.trans
        canonicalRequesting_augmentedFingerprint.freeNames_eq
    freeSubjects_eq :=
      (Late.Struct.freeSubjects_eq relation).symm.trans
        canonicalRequesting_augmentedFingerprint.freeSubjects_eq
  }

/-!
## Negative regression: the seven numeric fields are not complete

The following three declarations are intentionally kept in this isolated
module until a targeted kernel build is available.  They record the minimal
single-position mutation of the canonical closed restriction envelope:
the guarded payload `3` is replaced by the already restricted public name
`0`.  All seven numeric fields survive, but the residual loses the free
payload and therefore cannot be structurally established.
-/

/-- A closed four-prefix process with the canonical seven numeric fields. -/
def badRequesting : Raw.Proc :=
  .new 0
    (.new 1
      (.par
        (.send 0 1 (.send 1 0 .zero))
        (.recv 0 2 (.recv 2 2 .zero))))

/-- The exact native `tau` endpoint of `badRequesting`. -/
def badRequestingTarget : Raw.Proc :=
  .new 0
    (.new 1
      (.par
        (.send 1 0 .zero)
        (.recv 1 2 .zero)))

/--
The counterexample agrees with every field of the
canonical seven-component fingerprint.
-/
theorem badRequesting_fingerprint :
    badRequesting.headPrefixCount = 2 ∧
    badRequesting.topThreadSquareMass = 8 ∧
    badRequesting.choicePotential = 0 ∧
    badRequesting.sendPrefixCount = 2 ∧
    badRequesting.recvPrefixCount = 2 ∧
    badRequesting.outputLinkCount = 1 ∧
    badRequesting.inputLinkCount = 1 := by
  norm_num [badRequesting, Raw.Proc.headPrefixCount,
    Raw.Proc.topThreadSquareMass, Raw.Proc.choicePotential,
    Raw.Proc.sendPrefixCount, Raw.Proc.recvPrefixCount,
    Raw.Proc.outputLinkCount, Raw.Proc.inputLinkCount,
    Raw.Proc.subjectLink, Raw.Proc.prefixCount,
    Raw.Proc.freeSubjects]

/--
The nominal-support field added by
`AugmentedRequestingFingerprint` rejects the seven-value counterexample.
This is only a regression for the known false weakening; it is not a
sufficiency theorem for arbitrary requesting representatives.
-/
theorem badRequesting_not_augmented :
    ¬AugmentedRequestingFingerprint badRequesting := by
  intro augmented
  have support := augmented.freeNames_eq
  norm_num [badRequesting, Raw.Proc.freeNames, payload] at support

/--
This is one native strong-late derivation, consisting
of ordinary `syncLeft` under the two existing restrictions.
-/
theorem badRequesting_native :
    Late.NativeStep badRequesting .tau badRequestingTarget := by
  unfold badRequesting badRequestingTarget
  apply Late.NativeStep.restrict
  · simp [Raw.Action.names]
  · apply Late.NativeStep.restrict
    · simp [Raw.Action.names]
    · apply Late.NativeStep.syncLeft
        Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
      simp [Raw.Proc.freeNames]

/--
The native endpoint is not the established protocol
state.  Structural congruence preserves free names, whereas the mutated
endpoint has none and the established endpoint retains free payload `3`.
-/
theorem badRequesting_not_established :
    ¬Late.Struct badRequestingTarget closedHandshakeResult.erase := by
  intro relation
  have support := Late.Struct.freeNames_eq relation
  norm_num [badRequestingTarget, closedHandshakeResult, handshakeResult,
    requestContinuation, Proc.erase, Raw.Proc.freeNames,
    publicChannel, sessionChannel, publicName, session,
    payload, payloadBinder] at support
  have unequal :
      (({0, 1} : Finset Name).erase 1).erase 0 ≠
        ({3, 1} : Finset Name).erase 1 := by
    decide
  exact unequal support

end P1bRequestingFingerprint

end Cantilune.Pi
