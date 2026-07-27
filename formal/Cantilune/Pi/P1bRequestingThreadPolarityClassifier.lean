import Cantilune.Pi.P1bRequestingPolarityOrbit

/-!
# Thread-local polarity classification for the P1b requesting orbit

The global guarded-pair invariant separates the canonical same-polarity
requesting source from the crossed-polarity counterexample.  This module
connects that invariant to the syntax-directed two-thread extraction.

It proves:

* prefix-free processes and `OneCommThread`s have no guarded same-polarity
  pair;
* in a `TwoCommThread`, one guarded output pair is equivalent to both
  communication prefixes being outputs, and dually for inputs;
* consequently the two concrete threads in every structural normal form of
  the canonical requesting orbit are one output/output thread and one
  input/input thread, up to exchanging the two parallel components.

The result classifies polarity only.  It does not yet classify the subjects,
the transmitted payload, or the input-binder incidence.
-/

namespace Cantilune.Pi.P1bRequestingThreadPolarityClassifier

open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bRequestingPolarityOrbit
open Cantilune.Pi.P1bTwoThreadExtraction

/-- Prefix-free syntax has no guarded same-polarity communication pair. -/
theorem guardedPairCounts_eq_zero_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.guardedSendPairCount = 0 ∧
      process.guardedRecvPairCount = 0 := by
  induction process with
  | zero =>
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount]
  | tau next inductionHypothesis =>
      simp [Raw.Proc.prefixCount] at prefixFree
  | send channel value next inductionHypothesis =>
      simp [Raw.Proc.prefixCount] at prefixFree
  | recv channel binder next inductionHypothesis =>
      simp [Raw.Proc.prefixCount] at prefixFree
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.prefixCount, Nat.add_eq_zero_iff] at prefixFree
      rcases prefixFree with ⟨leftFree, rightFree⟩
      rcases leftIH leftFree with ⟨leftSend, leftRecv⟩
      rcases rightIH rightFree with ⟨rightSend, rightRecv⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount,
        leftSend, leftRecv, rightSend, rightRecv]
  | par left right leftIH rightIH =>
      simp only [Raw.Proc.prefixCount, Nat.add_eq_zero_iff] at prefixFree
      rcases prefixFree with ⟨leftFree, rightFree⟩
      rcases leftIH leftFree with ⟨leftSend, leftRecv⟩
      rcases rightIH rightFree with ⟨rightSend, rightRecv⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount,
        leftSend, leftRecv, rightSend, rightRecv]
  | new binder body inductionHypothesis =>
      simpa [Raw.Proc.prefixCount, Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount] using
        inductionHypothesis prefixFree
  | matchEq left right next inductionHypothesis =>
      simp [Raw.Proc.prefixCount] at prefixFree
  | matchNe left right next inductionHypothesis =>
      simp [Raw.Proc.prefixCount] at prefixFree

namespace OneCommThread

/-- A one-communication thread contains no ordered same-polarity pair. -/
theorem guardedPairCounts_eq_zero
    {process : Raw.Proc}
    (thread : OneCommThread process) :
    process.guardedSendPairCount = 0 ∧
      process.guardedRecvPairCount = 0 := by
  induction thread with
  | @send next channel value tailPrefixFree =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ tailPrefixFree with
        ⟨tailSendPair, tailRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ tailPrefixFree with
        ⟨tailSend, _⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount,
        tailSendPair, tailRecvPair, tailSend]
  | @recv next channel binder tailPrefixFree =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ tailPrefixFree with
        ⟨tailSendPair, tailRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ tailPrefixFree with
        ⟨_, tailRecv⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount,
        tailSendPair, tailRecvPair, tailRecv]
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount] using inductionHypothesis
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSendPair, rightRecvPair⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount, inductionHypothesis,
        rightSendPair, rightRecvPair]
  | @parRight left right leftPrefixFree inner inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSendPair, leftRecvPair⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount, inductionHypothesis,
        leftSendPair, leftRecvPair]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSendPair, rightRecvPair⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount, inductionHypothesis,
        rightSendPair, rightRecvPair]
  | @choiceRight left right leftPrefixFree inner inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSendPair, leftRecvPair⟩
      simp [Raw.Proc.guardedSendPairCount,
        Raw.Proc.guardedRecvPairCount, inductionHypothesis,
        leftSendPair, leftRecvPair]

end OneCommThread

namespace TwoCommThread

/-- Both communication prefixes of a two-thread evidence object partition by polarity. -/
theorem sendPrefixCount_add_recvPrefixCount_eq_two
    {process : Raw.Proc}
    (thread : TwoCommThread process) :
    process.sendPrefixCount + process.recvPrefixCount = 2 := by
  have prefixCount :=
    P1bTwoThreadNativeInversion.TwoCommThread.prefixCount_eq_two thread
  have unaryCount :=
    P1bTwoThreadNativeInversion.TwoCommThread.unaryPrefixCount_eq_zero thread
  have prefixPartition :=
    Raw.Proc.prefixCount_eq_communication_add_unary process
  have polarityPartition :=
    Raw.Proc.communicationPrefixCount_eq_send_add_recv process
  omega

/--
A two-communication thread has one guarded output pair exactly when both
communication prefixes are outputs.
-/
theorem guardedSendPairCount_eq_one_iff_sendPrefixCount_eq_two
    {process : Raw.Proc}
    (thread : TwoCommThread process) :
    process.guardedSendPairCount = 1 ↔
      process.sendPrefixCount = 2 := by
  induction thread with
  | @send next channel value tail =>
      rcases OneCommThread.guardedPairCounts_eq_zero tail with
        ⟨tailSendPair, tailRecvPair⟩
      have tailPolarity :=
        P1bTwoThreadNativeInversion.OneCommThread.sendPrefixCount_add_recvPrefixCount_eq_one
          tail
      simp only [Raw.Proc.guardedSendPairCount,
        Raw.Proc.sendPrefixCount]
      omega
  | @recv next channel binder tail =>
      rcases OneCommThread.guardedPairCounts_eq_zero tail with
        ⟨tailSendPair, tailRecvPair⟩
      have tailPolarity :=
        P1bTwoThreadNativeInversion.OneCommThread.sendPrefixCount_add_recvPrefixCount_eq_one
          tail
      simp only [Raw.Proc.guardedSendPairCount,
        Raw.Proc.sendPrefixCount]
      omega
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.guardedSendPairCount,
        Raw.Proc.sendPrefixCount] using inductionHypothesis
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSendPair, rightRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSend, rightRecv⟩
      simpa [Raw.Proc.guardedSendPairCount,
        Raw.Proc.sendPrefixCount, rightSendPair, rightSend] using
        inductionHypothesis
  | @parRight left right leftPrefixFree inner inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSendPair, leftRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSend, leftRecv⟩
      simpa [Raw.Proc.guardedSendPairCount,
        Raw.Proc.sendPrefixCount, leftSendPair, leftSend] using
        inductionHypothesis
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSendPair, rightRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSend, rightRecv⟩
      simpa [Raw.Proc.guardedSendPairCount,
        Raw.Proc.sendPrefixCount, rightSendPair, rightSend] using
        inductionHypothesis
  | @choiceRight left right leftPrefixFree inner inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSendPair, leftRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSend, leftRecv⟩
      simpa [Raw.Proc.guardedSendPairCount,
        Raw.Proc.sendPrefixCount, leftSendPair, leftSend] using
        inductionHypothesis

/--
A two-communication thread has one guarded input pair exactly when both
communication prefixes are inputs.
-/
theorem guardedRecvPairCount_eq_one_iff_recvPrefixCount_eq_two
    {process : Raw.Proc}
    (thread : TwoCommThread process) :
    process.guardedRecvPairCount = 1 ↔
      process.recvPrefixCount = 2 := by
  induction thread with
  | @send next channel value tail =>
      rcases OneCommThread.guardedPairCounts_eq_zero tail with
        ⟨tailSendPair, tailRecvPair⟩
      have tailPolarity :=
        P1bTwoThreadNativeInversion.OneCommThread.sendPrefixCount_add_recvPrefixCount_eq_one
          tail
      simp only [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.recvPrefixCount]
      omega
  | @recv next channel binder tail =>
      rcases OneCommThread.guardedPairCounts_eq_zero tail with
        ⟨tailSendPair, tailRecvPair⟩
      have tailPolarity :=
        P1bTwoThreadNativeInversion.OneCommThread.sendPrefixCount_add_recvPrefixCount_eq_one
          tail
      simp only [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.recvPrefixCount]
      omega
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.recvPrefixCount] using inductionHypothesis
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSendPair, rightRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSend, rightRecv⟩
      simpa [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.recvPrefixCount, rightRecvPair, rightRecv] using
        inductionHypothesis
  | @parRight left right leftPrefixFree inner inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSendPair, leftRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSend, leftRecv⟩
      simpa [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.recvPrefixCount, leftRecvPair, leftRecv] using
        inductionHypothesis
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSendPair, rightRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ rightPrefixFree with
        ⟨rightSend, rightRecv⟩
      simpa [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.recvPrefixCount, rightRecvPair, rightRecv] using
        inductionHypothesis
  | @choiceRight left right leftPrefixFree inner inductionHypothesis =>
      rcases
          guardedPairCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSendPair, leftRecvPair⟩
      rcases
          P1bTwoThreadNativeInversion.polarityCounts_eq_zero_of_prefixCount_eq_zero
            _ leftPrefixFree with
        ⟨leftSend, leftRecv⟩
      simpa [Raw.Proc.guardedRecvPairCount,
        Raw.Proc.recvPrefixCount, leftRecvPair, leftRecv] using
        inductionHypothesis

end TwoCommThread

/-- Wrapping a process in finitely many restrictions preserves output pairs. -/
@[simp]
theorem guardedSendPairCount_wrapNews
    (binders : List Name) (process : Raw.Proc) :
    (wrapNews binders process).guardedSendPairCount =
      process.guardedSendPairCount := by
  induction binders with
  | nil =>
      rfl
  | cons binder binders inductionHypothesis =>
      simpa [wrapNews, Raw.Proc.guardedSendPairCount] using
        inductionHypothesis

/-- Wrapping a process in finitely many restrictions preserves input pairs. -/
@[simp]
theorem guardedRecvPairCount_wrapNews
    (binders : List Name) (process : Raw.Proc) :
    (wrapNews binders process).guardedRecvPairCount =
      process.guardedRecvPairCount := by
  induction binders with
  | nil =>
      rfl
  | cons binder binders inductionHypothesis =>
      simpa [wrapNews, Raw.Proc.guardedRecvPairCount] using
        inductionHypothesis

/--
If a canonical-orbit representative is already normalized to two concrete
threads, those threads have opposite pure polarities, up to parallel order.
-/
theorem polarities_of_struct_canonical_split
    {binders : List Name} {left right : Raw.Proc}
    (relation :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right)))
    (leftThread : TwoCommThread left)
    (rightThread : TwoCommThread right) :
    (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
      (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2) := by
  have guardedPairs :=
    guardedPairCounts_of_struct_canonicalRequesting relation
  simp only [guardedSendPairCount_wrapNews,
    guardedRecvPairCount_wrapNews, Raw.Proc.guardedSendPairCount,
    Raw.Proc.guardedRecvPairCount] at guardedPairs
  have leftPolarity :=
    TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two leftThread
  have rightPolarity :=
    TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two rightThread
  have leftSendIff :=
    TwoCommThread.guardedSendPairCount_eq_one_iff_sendPrefixCount_eq_two
      leftThread
  have rightSendIff :=
    TwoCommThread.guardedSendPairCount_eq_one_iff_sendPrefixCount_eq_two
      rightThread
  have leftRecvIff :=
    TwoCommThread.guardedRecvPairCount_eq_one_iff_recvPrefixCount_eq_two
      leftThread
  have rightRecvIff :=
    TwoCommThread.guardedRecvPairCount_eq_one_iff_recvPrefixCount_eq_two
      rightThread
  by_cases leftSendPair : left.guardedSendPairCount = 1
  · left
    have leftSend := leftSendIff.mp leftSendPair
    have rightRecvPair : right.guardedRecvPairCount = 1 := by
      omega
    exact ⟨leftSend, rightRecvIff.mp rightRecvPair⟩
  · right
    have rightSendPair : right.guardedSendPairCount = 1 := by
      omega
    have rightSend := rightSendIff.mp rightSendPair
    have leftRecvPair : left.guardedRecvPairCount = 1 := by
      omega
    exact ⟨leftRecvIff.mp leftRecvPair, rightSend⟩

/--
Every structural representative of the canonical requesting source admits a
two-thread normal form whose components are exactly one output/output thread
and one input/input thread, up to swapping the two components.
-/
theorem requesting_two_thread_polarity_normal_form
    {source : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source) :
    ∃ binders left right,
      TwoCommThread left ∧
      TwoCommThread right ∧
      ((left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
        (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2)) ∧
      Late.Struct source (wrapNews binders (.par left right)) := by
  have fingerprint :=
    augmentedFingerprint_of_struct_canonicalRequesting relation
  have context : TwoThreadContext source :=
    AugmentedRequestingFingerprint.twoThreadContext fingerprint
  rcases context.structural_normal_form with
    ⟨binders, left, right, leftThread, rightThread, normalized⟩
  have canonicalNormalized :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right)) :=
    Late.Struct.trans relation normalized
  exact ⟨binders, left, right, leftThread, rightThread,
    polarities_of_struct_canonical_split
      canonicalNormalized leftThread rightThread,
    normalized⟩

end Cantilune.Pi.P1bRequestingThreadPolarityClassifier
