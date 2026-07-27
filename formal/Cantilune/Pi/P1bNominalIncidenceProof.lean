import Cantilune.Pi.P1bNominalIncidenceBoundary

/-!
# Nominal incidence at the P1b requesting split

This file develops the syntax-directed one-prefix normalizers needed to turn
the aggregate requesting invariants into exact residual names.  The arguments
use only the existing raw syntax, structural congruence, and finite support
functions.
-/

namespace Cantilune.Pi.P1bNominalIncidenceProof

open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bRequestingNominalOrbit
open Cantilune.Pi.P1bTwoThreadExtraction
open Cantilune.Pi.P1bTwoThreadNativeInversion
open Cantilune.Pi.P1bLabelledThreadInversion
open Cantilune.Pi.P1bNominalIncidenceBoundary

@[simp]
theorem outputLinkCount_wrapNews
    (binders : List Name) (process : Raw.Proc) :
    (wrapNews binders process).outputLinkCount =
      process.outputLinkCount := by
  induction binders <;>
    simp_all [wrapNews, Raw.Proc.outputLinkCount]

@[simp]
theorem inputLinkCount_wrapNews
    (binders : List Name) (process : Raw.Proc) :
    (wrapNews binders process).inputLinkCount =
      process.inputLinkCount := by
  induction binders <;>
    simp_all [wrapNews, Raw.Proc.inputLinkCount]

theorem mem_freeSubjects_wrapNews_iff
    (name : Name) (binders : List Name) (process : Raw.Proc) :
    name ∈ (wrapNews binders process).freeSubjects ↔
      name ∉ binders ∧ name ∈ process.freeSubjects := by
  induction binders with
  | nil =>
      simp [wrapNews]
  | cons binder rest inductionHypothesis =>
      simp only [wrapNews, Raw.Proc.freeSubjects, Finset.mem_erase,
        List.mem_cons, not_or]
      rw [inductionHypothesis]
      aesop

private theorem freeSubjects_eq_empty_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.freeSubjects = ∅ := by
  have relation :
      Late.Struct process .zero :=
    (Late.Struct.structurallyZero_iff_prefixCount_zero process).2 prefixFree
  simpa [Raw.Proc.freeSubjects] using
    Late.Struct.freeSubjects_eq relation

private theorem freeOutputValues_eq_empty_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.freeOutputValues = ∅ := by
  have relation :
      Late.Struct process .zero :=
    (Late.Struct.structurallyZero_iff_prefixCount_zero process).2 prefixFree
  simpa [Raw.Proc.freeOutputValues] using
    Late.Struct.freeOutputValues_eq relation

private theorem outputLinkCount_eq_zero_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.outputLinkCount = 0 := by
  have relation :
      Late.Struct process .zero :=
    (Late.Struct.structurallyZero_iff_prefixCount_zero process).2 prefixFree
  simpa [Raw.Proc.outputLinkCount] using
    Late.Struct.outputLinkCount_eq relation

private theorem inputLinkCount_eq_zero_of_prefixCount_eq_zero
    (process : Raw.Proc)
    (prefixFree : process.prefixCount = 0) :
    process.inputLinkCount = 0 := by
  have relation :
      Late.Struct process .zero :=
    (Late.Struct.structurallyZero_iff_prefixCount_zero process).2 prefixFree
  simpa [Raw.Proc.inputLinkCount] using
    Late.Struct.inputLinkCount_eq relation

theorem outputLinkCount_eq_zero_of_sendPrefixCount_eq_zero
    (process : Raw.Proc)
    (noSend : process.sendPrefixCount = 0) :
    process.outputLinkCount = 0 := by
  induction process <;>
    simp_all [Raw.Proc.sendPrefixCount, Raw.Proc.outputLinkCount,
      Raw.Proc.subjectLink]

theorem inputLinkCount_eq_zero_of_recvPrefixCount_eq_zero
    (process : Raw.Proc)
    (noRecv : process.recvPrefixCount = 0) :
    process.inputLinkCount = 0 := by
  induction process <;>
    simp_all [Raw.Proc.recvPrefixCount, Raw.Proc.inputLinkCount,
      Raw.Proc.subjectLink]

theorem freeOutputValues_eq_empty_of_sendPrefixCount_eq_zero
    (process : Raw.Proc)
    (noSend : process.sendPrefixCount = 0) :
    process.freeOutputValues = ∅ := by
  induction process <;>
    simp_all [Raw.Proc.sendPrefixCount, Raw.Proc.freeOutputValues]

@[simp]
theorem syntaxDepth_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).syntaxDepth =
      process.syntaxDepth := by
  induction process <;>
    simp_all [Raw.Proc.substRaw, Raw.Proc.syntaxDepth] <;>
    split <;>
    simp_all

private theorem mem_freeSubjects_substituteCaptureAvoidingAux
    (fuel : Nat) (process : Raw.Proc)
    (needle replacement : Name)
    (enough : process.syntaxDepth ≤ fuel)
    (member : needle ∈ process.freeSubjects) :
    replacement ∈
      (process.substituteCaptureAvoidingAux
        fuel needle replacement).freeSubjects := by
  induction fuel generalizing process with
  | zero =>
      cases process <;>
        simp [Raw.Proc.syntaxDepth] at enough
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          simp [Raw.Proc.freeSubjects] at member
      | tau next =>
          apply inductionHypothesis next
          · simpa [Raw.Proc.syntaxDepth] using enough
          · simpa [Raw.Proc.freeSubjects] using member
      | send channel value next =>
          simp only [Raw.Proc.substituteCaptureAvoidingAux,
            Raw.Proc.freeSubjects, Finset.mem_insert]
          simp only [Raw.Proc.freeSubjects, Finset.mem_insert] at member
          by_cases channelNeedle : channel = needle
          · left
            simp [channelNeedle]
          · right
            apply inductionHypothesis next
            · simpa [Raw.Proc.syntaxDepth] using enough
            · exact member.resolve_left (Ne.symm channelNeedle)
      | recv channel binder next =>
          simp only [Raw.Proc.freeSubjects, Finset.mem_erase,
            Finset.mem_insert] at member
          rcases member with needleAtHead |
            ⟨needleNeBinder, needleInNext⟩
          · have channelNeedle : channel = needle :=
              needleAtHead.symm
            simp only [Raw.Proc.substituteCaptureAvoidingAux]
            by_cases binderNeedle : binder = needle
            · rw [if_pos binderNeedle]
              simp [Raw.Proc.freeSubjects, channelNeedle]
            · rw [if_neg binderNeedle]
              by_cases binderReplacement : binder = replacement
              · rw [if_pos binderReplacement]
                simp [Raw.Proc.freeSubjects, channelNeedle]
              · rw [if_neg binderReplacement]
                simp [Raw.Proc.freeSubjects, channelNeedle]
          · by_cases binderNeedle : binder = needle
            · exact (needleNeBinder binderNeedle.symm).elim
            · by_cases binderReplacement : binder = replacement
              · let fresh := next.freshName needle replacement
                let renamed := next.renameBound binder fresh
                have replacementNeNeedle : replacement ≠ needle := by
                  intro equality
                  exact binderNeedle (binderReplacement.trans equality)
                have freshNotAll :
                    fresh ∉ next.allNames :=
                  Raw.Proc.freshName_not_mem_allNames
                    next needle replacement
                have needleNeFresh :
                    needle ≠ fresh :=
                  Ne.symm
                    (Raw.Proc.freshName_ne_needle
                      next needle replacement)
                have needleInRenamed :
                    needle ∈ renamed.freeSubjects := by
                  rw [show renamed = next.substRaw binder fresh by
                    simp [renamed, Raw.Proc.renameBound_eq_substRaw]]
                  have transported :=
                    (Raw.Proc.substName_mem_freeSubjects_substRaw_iff
                      next binder fresh needle freshNotAll needleNeFresh).2
                      needleInNext
                  simpa [Raw.Proc.substName, binderNeedle,
                    Ne.symm binderNeedle] using
                    transported
                have renamedDepth :
                    renamed.syntaxDepth = next.syntaxDepth := by
                  simp [renamed, Raw.Proc.renameBound_eq_substRaw]
                have replacementInRenamed :=
                  inductionHypothesis renamed
                    (by
                      rw [renamedDepth]
                      simpa [Raw.Proc.syntaxDepth] using enough)
                    needleInRenamed
                have replacementNeFresh :
                    replacement ≠ fresh :=
                  Ne.symm
                    (Raw.Proc.freshName_ne_replacement
                      next needle replacement)
                simp only [Raw.Proc.substituteCaptureAvoidingAux]
                rw [if_neg binderNeedle, if_pos binderReplacement]
                simp only [Raw.Proc.freeSubjects, Finset.mem_insert,
                  Finset.mem_erase]
                right
                exact ⟨replacementNeFresh,
                  by
                    simpa [fresh, renamed, binderReplacement] using
                      replacementInRenamed⟩
              · have replacementInNext :=
                  inductionHypothesis next
                    (by
                      simpa [Raw.Proc.syntaxDepth] using enough)
                    needleInNext
                have replacementNeBinder : replacement ≠ binder :=
                  Ne.symm binderReplacement
                simp only [Raw.Proc.substituteCaptureAvoidingAux]
                rw [if_neg binderNeedle, if_neg binderReplacement]
                simp only [Raw.Proc.freeSubjects, Finset.mem_insert,
                  Finset.mem_erase]
                right
                exact ⟨replacementNeBinder, replacementInNext⟩
      | choice left right =>
          simp only [Raw.Proc.freeSubjects, Finset.mem_union] at member
          simp only [Raw.Proc.substituteCaptureAvoidingAux,
            Raw.Proc.freeSubjects, Finset.mem_union]
          rcases member with member | member
          · left
            exact inductionHypothesis left
              (by
                simp only [Raw.Proc.syntaxDepth] at enough
                omega)
              member
          · right
            exact inductionHypothesis right
              (by
                simp only [Raw.Proc.syntaxDepth] at enough
                omega)
              member
      | par left right =>
          simp only [Raw.Proc.freeSubjects, Finset.mem_union] at member
          simp only [Raw.Proc.substituteCaptureAvoidingAux,
            Raw.Proc.freeSubjects, Finset.mem_union]
          rcases member with member | member
          · left
            exact inductionHypothesis left
              (by
                simp only [Raw.Proc.syntaxDepth] at enough
                omega)
              member
          · right
            exact inductionHypothesis right
              (by
                simp only [Raw.Proc.syntaxDepth] at enough
                omega)
              member
      | new binder body =>
          simp only [Raw.Proc.freeSubjects, Finset.mem_erase] at member
          rcases member with ⟨needleNeBinder, needleInBody⟩
          by_cases binderNeedle : binder = needle
          · exact (needleNeBinder binderNeedle.symm).elim
          · by_cases binderReplacement : binder = replacement
            · let fresh := body.freshName needle replacement
              let renamed := body.renameBound binder fresh
              have replacementNeNeedle : replacement ≠ needle := by
                intro equality
                exact binderNeedle (binderReplacement.trans equality)
              have freshNotAll :
                  fresh ∉ body.allNames :=
                Raw.Proc.freshName_not_mem_allNames
                  body needle replacement
              have needleNeFresh :
                  needle ≠ fresh :=
                Ne.symm
                  (Raw.Proc.freshName_ne_needle
                    body needle replacement)
              have needleInRenamed :
                  needle ∈ renamed.freeSubjects := by
                rw [show renamed = body.substRaw binder fresh by
                  simp [renamed, Raw.Proc.renameBound_eq_substRaw]]
                have transported :=
                  (Raw.Proc.substName_mem_freeSubjects_substRaw_iff
                    body binder fresh needle freshNotAll needleNeFresh).2
                    needleInBody
                simpa [Raw.Proc.substName, binderNeedle,
                  Ne.symm binderNeedle] using
                  transported
              have renamedDepth :
                  renamed.syntaxDepth = body.syntaxDepth := by
                simp [renamed, Raw.Proc.renameBound_eq_substRaw]
              have replacementInRenamed :=
                inductionHypothesis renamed
                  (by
                    rw [renamedDepth]
                    simpa [Raw.Proc.syntaxDepth] using enough)
                  needleInRenamed
              have replacementNeFresh :
                  replacement ≠ fresh :=
                Ne.symm
                  (Raw.Proc.freshName_ne_replacement
                    body needle replacement)
              simpa [Raw.Proc.substituteCaptureAvoidingAux,
                Raw.Proc.freeSubjects, binderNeedle,
                binderReplacement, fresh, renamed,
                replacementNeFresh, replacementNeNeedle] using
                replacementInRenamed
            · have replacementInBody :=
                inductionHypothesis body
                  (by
                    simpa [Raw.Proc.syntaxDepth] using enough)
                  needleInBody
              have replacementNeBinder : replacement ≠ binder :=
                Ne.symm binderReplacement
              simpa [Raw.Proc.substituteCaptureAvoidingAux,
                Raw.Proc.freeSubjects, binderNeedle,
                binderReplacement, replacementNeBinder] using
                replacementInBody
      | matchEq left right next =>
          apply inductionHypothesis next
          · simpa [Raw.Proc.syntaxDepth] using enough
          · simpa [Raw.Proc.freeSubjects] using member
      | matchNe left right next =>
          apply inductionHypothesis next
          · simpa [Raw.Proc.syntaxDepth] using enough
          · simpa [Raw.Proc.freeSubjects] using member

private theorem mem_freeSubjects_substRaw_image_of_noCapture
    (process : Raw.Proc) (needle replacement : Name)
    (safe : process.captureRisk needle replacement = false)
    (member : needle ∈ process.freeSubjects) :
    replacement ∈
      (process.substRaw needle replacement).freeSubjects := by
  induction process with
  | zero =>
      simp [Raw.Proc.freeSubjects] at member
  | tau next inductionHypothesis =>
      exact inductionHypothesis
        (by simpa [Raw.Proc.captureRisk] using safe)
        (by simpa [Raw.Proc.freeSubjects] using member)
  | send channel value next inductionHypothesis =>
      simp only [Raw.Proc.freeSubjects, Finset.mem_insert] at member
      simp only [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
        Finset.mem_insert]
      rcases member with channelNeedle | member
      · left
        simp [channelNeedle.symm]
      · right
        exact inductionHypothesis
          (by simpa [Raw.Proc.captureRisk] using safe)
          member
  | recv channel binder next inductionHypothesis =>
      simp only [Raw.Proc.freeSubjects, Finset.mem_insert,
        Finset.mem_erase] at member
      rcases member with channelNeedle | ⟨needleNeBinder, member⟩
      · simp [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
          channelNeedle.symm]
      ·
        have binderNeedle : binder ≠ needle :=
          Ne.symm needleNeBinder
        have safeParts :
            binder ≠ replacement ∧
              next.captureRisk needle replacement = false := by
          simpa [Raw.Proc.captureRisk, binderNeedle] using safe
        simp only [Raw.Proc.substRaw, binderNeedle,
          Raw.Proc.freeSubjects, Finset.mem_insert,
          Finset.mem_erase]
        right
        refine ⟨Ne.symm safeParts.1, ?_⟩
        exact inductionHypothesis safeParts.2 member
  | choice left right leftIH rightIH =>
      have safeParts :
          left.captureRisk needle replacement = false ∧
            right.captureRisk needle replacement = false := by
        simpa [Raw.Proc.captureRisk] using safe
      simp only [Raw.Proc.freeSubjects, Finset.mem_union] at member ⊢
      simp only [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
        Finset.mem_union]
      rcases member with member | member
      · exact Or.inl (leftIH safeParts.1 member)
      · exact Or.inr (rightIH safeParts.2 member)
  | par left right leftIH rightIH =>
      have safeParts :
          left.captureRisk needle replacement = false ∧
            right.captureRisk needle replacement = false := by
        simpa [Raw.Proc.captureRisk] using safe
      simp only [Raw.Proc.freeSubjects, Finset.mem_union] at member ⊢
      simp only [Raw.Proc.substRaw, Raw.Proc.freeSubjects,
        Finset.mem_union]
      rcases member with member | member
      · exact Or.inl (leftIH safeParts.1 member)
      · exact Or.inr (rightIH safeParts.2 member)
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.freeSubjects, Finset.mem_erase] at member
      rcases member with ⟨needleNeBinder, member⟩
      have binderNeedle : binder ≠ needle :=
        Ne.symm needleNeBinder
      have safeParts :
          binder ≠ replacement ∧
            body.captureRisk needle replacement = false := by
        simpa [Raw.Proc.captureRisk, binderNeedle] using safe
      simp only [Raw.Proc.substRaw, binderNeedle,
        Raw.Proc.freeSubjects, Finset.mem_erase]
      exact ⟨Ne.symm safeParts.1,
        inductionHypothesis safeParts.2 member⟩
  | matchEq left right next inductionHypothesis =>
      exact inductionHypothesis
        (by simpa [Raw.Proc.captureRisk] using safe)
        (by simpa [Raw.Proc.freeSubjects] using member)
  | matchNe left right next inductionHypothesis =>
      exact inductionHypothesis
        (by simpa [Raw.Proc.captureRisk] using safe)
        (by simpa [Raw.Proc.freeSubjects] using member)

theorem OneCommThread.mem_freeSubjects_substituteCaptureAvoiding
    {process : Raw.Proc}
    (_thread : OneCommThread process)
    {needle replacement : Name}
    (member : needle ∈ process.freeSubjects) :
    replacement ∈
      (process.substituteCaptureAvoiding needle replacement).freeSubjects := by
  unfold Raw.Proc.substituteCaptureAvoiding
  split
  · exact mem_freeSubjects_substituteCaptureAvoidingAux
      process.syntaxDepth process needle replacement
      (Nat.le_refl _) member
  · have safe :
        process.captureRisk needle replacement = false := by
      cases equality :
          process.captureRisk needle replacement <;>
        simp_all
    exact mem_freeSubjects_substRaw_image_of_noCapture
      process needle replacement safe member

private theorem Late.NativeStep.source_sendPrefixCount_pos_of_outputLike
    (step : Late.NativeStep source action target)
    (outputLike :
      (∃ channel value, action = .output channel value) ∨
      (∃ channel value, action = .boundOutput channel value)) :
    0 < source.sendPrefixCount := by
  induction step <;>
    simp_all [Raw.Proc.sendPrefixCount]

private theorem Late.NativeStep.source_recvPrefixCount_pos_of_input
    (step : Late.NativeStep source action target)
    (isInput : ∃ channel binder, action = .input channel binder) :
    0 < source.recvPrefixCount := by
  induction step <;>
    simp_all [Raw.Proc.recvPrefixCount]

/--
An input exposed by a pure two-input communication thread consumes exactly
one of its two receive prefixes.
-/
theorem TwoCommThread.target_recvPrefixCount_eq_one_of_input
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (sourceRecv : source.recvPrefixCount = 2)
    (step : Late.NativeStep source (.input channel binder) target) :
    target.recvPrefixCount = 1 := by
  induction thread generalizing target with
  | send tail =>
      cases step
  | recv tail =>
      cases step
      simpa [Raw.Proc.recvPrefixCount] using sourceRecv
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerRecv : body.recvPrefixCount = 2 := by
            simpa [Raw.Proc.recvPrefixCount] using sourceRecv
          simpa [Raw.Proc.recvPrefixCount] using
            inductionHypothesis innerRecv innerStep
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have rightRecv :
              right.recvPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree).2
          have leftRecv : left.recvPrefixCount = 2 := by
            simpa [Raw.Proc.recvPrefixCount, rightRecv] using sourceRecv
          simpa [Raw.Proc.recvPrefixCount, rightRecv] using
            inductionHypothesis leftRecv innerStep
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have leftRecv :
              left.recvPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree).2
          have rightRecv : right.recvPrefixCount = 2 := by
            simpa [Raw.Proc.recvPrefixCount, leftRecv] using sourceRecv
          simpa [Raw.Proc.recvPrefixCount, leftRecv] using
            inductionHypothesis rightRecv innerStep
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have rightRecv :
              right.recvPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree).2
          have leftRecv : left.recvPrefixCount = 2 := by
            simpa [Raw.Proc.recvPrefixCount, rightRecv] using sourceRecv
          exact inductionHypothesis leftRecv innerStep
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have leftRecv :
              left.recvPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree).2
          have rightRecv : right.recvPrefixCount = 2 := by
            simpa [Raw.Proc.recvPrefixCount, leftRecv] using sourceRecv
          exact inductionHypothesis rightRecv innerStep

/--
An ordinary output exposed by a pure two-output communication thread consumes
exactly one of its two send prefixes.
-/
theorem TwoCommThread.target_sendPrefixCount_eq_one_of_output
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (sourceSend : source.sendPrefixCount = 2)
    (step : Late.NativeStep source (.output channel value) target) :
    target.sendPrefixCount = 1 := by
  induction thread generalizing target with
  | send tail =>
      cases step
      simpa [Raw.Proc.sendPrefixCount] using sourceSend
  | recv tail =>
      cases step
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerSend : body.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount] using sourceSend
          simpa [Raw.Proc.sendPrefixCount] using
            inductionHypothesis innerSend innerStep
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have rightSend :
              right.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree).1
          have leftSend : left.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, rightSend] using sourceSend
          simpa [Raw.Proc.sendPrefixCount, rightSend] using
            inductionHypothesis leftSend innerStep
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have leftSend :
              left.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree).1
          have rightSend : right.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, leftSend] using sourceSend
          simpa [Raw.Proc.sendPrefixCount, leftSend] using
            inductionHypothesis rightSend innerStep
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have rightSend :
              right.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree).1
          have leftSend : left.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, rightSend] using sourceSend
          exact inductionHypothesis leftSend innerStep
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have leftSend :
              left.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree).1
          have rightSend : right.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, leftSend] using sourceSend
          exact inductionHypothesis rightSend innerStep

/--
A bound output exposed by `open` consumes exactly one send prefix of a pure
two-output communication thread.
-/
theorem TwoCommThread.target_sendPrefixCount_eq_one_of_boundOutput
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (sourceSend : source.sendPrefixCount = 2)
    (step : Late.NativeStep source (.boundOutput channel value) target) :
    target.sendPrefixCount = 1 := by
  induction thread generalizing target with
  | send tail =>
      cases step
  | recv tail =>
      cases step
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerSend : body.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount] using sourceSend
          simpa [Raw.Proc.sendPrefixCount] using
            inductionHypothesis innerSend innerStep
      | «open» distinct innerStep =>
          have innerSend : body.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount] using sourceSend
          exact TwoCommThread.target_sendPrefixCount_eq_one_of_output
            inner innerSend innerStep
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have rightSend :
              right.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree).1
          have leftSend : left.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, rightSend] using sourceSend
          simpa [Raw.Proc.sendPrefixCount, rightSend] using
            inductionHypothesis leftSend innerStep
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have leftSend :
              left.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree).1
          have rightSend : right.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, leftSend] using sourceSend
          simpa [Raw.Proc.sendPrefixCount, leftSend] using
            inductionHypothesis rightSend innerStep
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have rightSend :
              right.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree).1
          have leftSend : left.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, rightSend] using sourceSend
          exact inductionHypothesis leftSend innerStep
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have leftSend :
              left.sendPrefixCount = 0 :=
            (polarityCounts_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree).1
          have rightSend : right.sendPrefixCount = 2 := by
            simpa [Raw.Proc.sendPrefixCount, leftSend] using sourceSend
          exact inductionHypothesis rightSend innerStep

theorem OneCommThread.outputLinkCount_eq_zero
    {process : Raw.Proc}
    (thread : OneCommThread process) :
    process.outputLinkCount = 0 := by
  induction thread with
  | @send channel value next tailPrefixFree =>
      have tailLinks :=
        outputLinkCount_eq_zero_of_prefixCount_eq_zero next tailPrefixFree
      have tailSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero next tailPrefixFree
      simp [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
        tailLinks, tailSubjects]
  | @recv channel binder next tailPrefixFree =>
      simpa [Raw.Proc.outputLinkCount] using
        outputLinkCount_eq_zero_of_prefixCount_eq_zero next tailPrefixFree
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.outputLinkCount] using inductionHypothesis
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.outputLinkCount, inductionHypothesis,
        outputLinkCount_eq_zero_of_prefixCount_eq_zero right rightPrefixFree]
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.outputLinkCount, inductionHypothesis,
        outputLinkCount_eq_zero_of_prefixCount_eq_zero left leftPrefixFree]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.outputLinkCount, inductionHypothesis,
        outputLinkCount_eq_zero_of_prefixCount_eq_zero right rightPrefixFree]
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.outputLinkCount, inductionHypothesis,
        outputLinkCount_eq_zero_of_prefixCount_eq_zero left leftPrefixFree]

theorem OneCommThread.inputLinkCount_eq_zero
    {process : Raw.Proc}
    (thread : OneCommThread process) :
    process.inputLinkCount = 0 := by
  induction thread with
  | @send channel value next tailPrefixFree =>
      simpa [Raw.Proc.inputLinkCount] using
        inputLinkCount_eq_zero_of_prefixCount_eq_zero next tailPrefixFree
  | @recv channel binder next tailPrefixFree =>
      have tailLinks :=
        inputLinkCount_eq_zero_of_prefixCount_eq_zero next tailPrefixFree
      have tailSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero next tailPrefixFree
      simp [Raw.Proc.inputLinkCount, Raw.Proc.subjectLink,
        tailLinks, tailSubjects]
  | new inner inductionHypothesis =>
      simpa [Raw.Proc.inputLinkCount] using inductionHypothesis
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.inputLinkCount, inductionHypothesis,
        inputLinkCount_eq_zero_of_prefixCount_eq_zero right rightPrefixFree]
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.inputLinkCount, inductionHypothesis,
        inputLinkCount_eq_zero_of_prefixCount_eq_zero left leftPrefixFree]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      simp [Raw.Proc.inputLinkCount, inductionHypothesis,
        inputLinkCount_eq_zero_of_prefixCount_eq_zero right rightPrefixFree]
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      simp [Raw.Proc.inputLinkCount, inductionHypothesis,
        inputLinkCount_eq_zero_of_prefixCount_eq_zero left leftPrefixFree]

/--
Following a free-output head through a two-prefix thread removes exactly its
outer output-link contribution.
-/
theorem TwoCommThread.outputLinkCount_step
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (step : Late.NativeStep source (.output channel value) target) :
    source.outputLinkCount =
      target.outputLinkCount + Raw.Proc.subjectLink value target := by
  induction thread generalizing target with
  | send tail =>
      cases step
      rfl
  | recv tail =>
      cases step
  | @new body binder inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have binderFresh :
              binder ≠ channel ∧ binder ≠ value := by
            simpa [Raw.Action.names] using fresh
          have valueNeBinder : value ≠ binder :=
            Ne.symm binderFresh.2
          simpa [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, valueNeBinder] using innerResult
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree
          have rightSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          simpa [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, rightLinks, rightSubjects] using
            innerResult
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree
          have leftSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          simpa [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, leftLinks, leftSubjects] using
            innerResult
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree
          simpa [Raw.Proc.outputLinkCount, rightLinks] using innerResult
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree
          simpa [Raw.Proc.outputLinkCount, leftLinks] using innerResult

/--
Following an input head through a two-prefix thread removes exactly its outer
input-link contribution.
-/
theorem TwoCommThread.inputLinkCount_step
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (step : Late.NativeStep source (.input channel binder) target) :
    source.inputLinkCount =
      target.inputLinkCount + Raw.Proc.subjectLink binder target := by
  induction thread generalizing target with
  | send tail =>
      cases step
  | recv tail =>
      cases step
      rfl
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have restrictedFresh :
              restricted ≠ channel ∧ restricted ≠ binder := by
            simpa [Raw.Action.names] using fresh
          have binderNeRestricted : binder ≠ restricted :=
            Ne.symm restrictedFresh.2
          simpa [Raw.Proc.inputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, binderNeRestricted] using innerResult
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightLinks :=
            inputLinkCount_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree
          have rightSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          simpa [Raw.Proc.inputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, rightLinks, rightSubjects] using
            innerResult
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftLinks :=
            inputLinkCount_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree
          have leftSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          simpa [Raw.Proc.inputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, leftLinks, leftSubjects] using
            innerResult
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightLinks :=
            inputLinkCount_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree
          simpa [Raw.Proc.inputLinkCount, rightLinks] using innerResult
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftLinks :=
            inputLinkCount_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree
          simpa [Raw.Proc.inputLinkCount, leftLinks] using innerResult

/--
The same link decomposition for a bound output exposed by `open`.
-/
theorem TwoCommThread.boundOutputLinkCount_step
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (step : Late.NativeStep source (.boundOutput channel value) target) :
    source.outputLinkCount =
      target.outputLinkCount + Raw.Proc.subjectLink value target := by
  induction thread generalizing target with
  | send tail =>
      cases step
  | recv tail =>
      cases step
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have restrictedFresh :
              restricted ≠ channel ∧ restricted ≠ value := by
            simpa [Raw.Action.names] using fresh
          have valueNeRestricted : value ≠ restricted :=
            Ne.symm restrictedFresh.2
          simpa [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, valueNeRestricted] using innerResult
      | «open» distinct innerStep =>
          simpa [Raw.Proc.outputLinkCount] using
            TwoCommThread.outputLinkCount_step inner innerStep
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree
          have rightSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          simpa [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, rightLinks, rightSubjects] using
            innerResult
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree
          have leftSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          simpa [Raw.Proc.outputLinkCount, Raw.Proc.subjectLink,
            Raw.Proc.freeSubjects, leftLinks, leftSubjects] using
            innerResult
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              right rightPrefixFree
          simpa [Raw.Proc.outputLinkCount, rightLinks] using innerResult
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftLinks :=
            outputLinkCount_eq_zero_of_prefixCount_eq_zero
              left leftPrefixFree
          simpa [Raw.Proc.outputLinkCount, leftLinks] using innerResult

/--
Free output values across an ordinary output head: the offered value is
removed and all residual values remain.
-/
theorem TwoCommThread.freeOutputValues_output_step
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (step : Late.NativeStep source (.output channel value) target) :
    source.freeOutputValues =
      insert value target.freeOutputValues := by
  induction thread generalizing target with
  | send tail =>
      cases step
      rfl
  | recv tail =>
      cases step
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have restrictedFresh :
              restricted ≠ channel ∧ restricted ≠ value := by
            simpa [Raw.Action.names] using fresh
          ext name
          simp only [Raw.Proc.freeOutputValues, Finset.mem_erase,
            Finset.mem_insert]
          rw [congrArg (fun names => name ∈ names) innerResult]
          aesop
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, rightValues]
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, leftValues]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, rightValues]
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, leftValues]

/--
For a bound output, the opened value was erased by its source restriction.
-/
theorem TwoCommThread.freeOutputValues_boundOutput_step
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (step : Late.NativeStep source (.boundOutput channel value) target) :
    source.freeOutputValues =
      target.freeOutputValues.erase value := by
  induction thread generalizing target with
  | send tail =>
      cases step
  | recv tail =>
      cases step
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have restrictedFresh :
              restricted ≠ channel ∧ restricted ≠ value := by
            simpa [Raw.Action.names] using fresh
          ext name
          simp only [Raw.Proc.freeOutputValues, Finset.mem_erase]
          rw [congrArg (fun names => name ∈ names) innerResult]
          aesop
      | «open» distinct innerStep =>
          have innerResult :=
            TwoCommThread.freeOutputValues_output_step inner innerStep
          ext name
          simp only [Raw.Proc.freeOutputValues, Finset.mem_erase]
          rw [congrArg (fun names => name ∈ names) innerResult]
          aesop
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, rightValues]
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, leftValues]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have innerResult := inductionHypothesis innerStep
          have rightValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, rightValues]
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have innerResult := inductionHypothesis innerStep
          have leftValues :=
            freeOutputValues_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          simp [Raw.Proc.freeOutputValues, innerResult, leftValues]

/--
An ordinary output cannot hide the offered value from a residual free-subject
occurrence.
-/
theorem TwoCommThread.output_value_subject_back
    {source target : Raw.Proc}
    (thread : TwoCommThread source)
    (step : Late.NativeStep source (.output channel value) target)
    (targetSubject : value ∈ target.freeSubjects) :
    value ∈ source.freeSubjects := by
  induction thread generalizing target with
  | send tail =>
      cases step
      simp [Raw.Proc.freeSubjects, targetSubject]
  | recv tail =>
      cases step
  | @new body restricted inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          have restrictedFresh :
              restricted ≠ channel ∧ restricted ≠ value := by
            simpa [Raw.Action.names] using fresh
          simp only [Raw.Proc.freeSubjects, Finset.mem_erase] at targetSubject
          have innerSubject := inductionHypothesis innerStep
            targetSubject.2
          simpa [Raw.Proc.freeSubjects, Ne.symm restrictedFresh.2] using
            innerSubject
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          have rightSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              right rightPrefixFree
          have innerSourceSubject :=
            inductionHypothesis innerStep
              (by
                simpa [Raw.Proc.freeSubjects, rightSubjects] using
                  targetSubject)
          simp [Raw.Proc.freeSubjects, innerSourceSubject]
      | parRight fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          have leftSubjects :=
            freeSubjects_eq_empty_of_prefixCount_eq_zero
              left leftPrefixFree
          have innerSourceSubject :=
            inductionHypothesis innerStep
              (by
                simpa [Raw.Proc.freeSubjects, leftSubjects] using
                  targetSubject)
          simp [Raw.Proc.freeSubjects, innerSourceSubject]
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          have innerSourceSubject :=
            inductionHypothesis innerStep targetSubject
          simp [Raw.Proc.freeSubjects, innerSourceSubject]
      | choiceRight inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact (Late.NativeStep.false_of_source_prefixCount_eq_zero
            inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          have innerSourceSubject :=
            inductionHypothesis innerStep targetSubject
          simp [Raw.Proc.freeSubjects, innerSourceSubject]
/--
A one-communication thread known to contain its unique output subject and
value normalizes to precisely that output prefix.
-/
theorem OneCommThread.send_struct_of_support
    {process : Raw.Proc}
    (thread : OneCommThread process)
    (sendOne : process.sendPrefixCount = 1)
    (subjectFree : subject ∈ process.freeSubjects)
    (valueFree : value ∈ process.freeOutputValues) :
    Late.Struct process (.send subject value .zero) := by
  induction thread with
  | @send channel sentValue next tailPrefixFree =>
      have tailSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero next tailPrefixFree
      have tailValues :=
        freeOutputValues_eq_empty_of_prefixCount_eq_zero next tailPrefixFree
      have channelEq : channel = subject := by
        simp [Raw.Proc.freeSubjects, tailSubjects] at subjectFree
        exact subjectFree.symm
      have valueEq : sentValue = value := by
        simp [Raw.Proc.freeOutputValues, tailValues] at valueFree
        exact valueFree.symm
      subst channel
      subst sentValue
      exact Late.Struct.send
        ((Late.Struct.structurallyZero_iff_prefixCount_zero next).2
          tailPrefixFree)
  | @recv channel binder next tailPrefixFree =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          next tailPrefixFree with
        ⟨tailSend, _⟩
      simp [Raw.Proc.sendPrefixCount, tailSend] at sendOne
  | @new body binder inner inductionHypothesis =>
      have innerSend : body.sendPrefixCount = 1 := by
        simpa [Raw.Proc.sendPrefixCount] using sendOne
      have subjectSupport :
          subject ≠ binder ∧ subject ∈ body.freeSubjects := by
        simpa [Raw.Proc.freeSubjects] using subjectFree
      have binderNeSubject : binder ≠ subject := by
        exact Ne.symm subjectSupport.1
      have innerSubject : subject ∈ body.freeSubjects := by
        exact subjectSupport.2
      have valueSupport :
          value ≠ binder ∧ value ∈ body.freeOutputValues := by
        simpa [Raw.Proc.freeOutputValues] using valueFree
      have binderNeValue : binder ≠ value := by
        exact Ne.symm valueSupport.1
      have innerValue : value ∈ body.freeOutputValues := by
        exact valueSupport.2
      apply Late.Struct.trans
        (Late.Struct.new
          (inductionHypothesis innerSend innerSubject innerValue))
      apply Late.Struct.new_fresh
      simp [Raw.Proc.freeNames, binderNeSubject, binderNeValue]
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          right rightPrefixFree with
        ⟨rightSend, _⟩
      have rightSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero right rightPrefixFree
      have rightValues :=
        freeOutputValues_eq_empty_of_prefixCount_eq_zero right rightPrefixFree
      have leftSend : left.sendPrefixCount = 1 := by
        simpa [Raw.Proc.sendPrefixCount, rightSend] using sendOne
      have leftSubject : subject ∈ left.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, rightSubjects] using subjectFree
      have leftValue : value ∈ left.freeOutputValues := by
        simpa [Raw.Proc.freeOutputValues, rightValues] using valueFree
      apply Late.Struct.trans
        (Late.Struct.par
          (inductionHypothesis leftSend leftSubject leftValue)
          ((Late.Struct.structurallyZero_iff_prefixCount_zero right).2
            rightPrefixFree))
      exact Late.Struct.parZero
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          left leftPrefixFree with
        ⟨leftSend, _⟩
      have leftSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero left leftPrefixFree
      have leftValues :=
        freeOutputValues_eq_empty_of_prefixCount_eq_zero left leftPrefixFree
      have rightSend : right.sendPrefixCount = 1 := by
        simpa [Raw.Proc.sendPrefixCount, leftSend] using sendOne
      have rightSubject : subject ∈ right.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, leftSubjects] using subjectFree
      have rightValue : value ∈ right.freeOutputValues := by
        simpa [Raw.Proc.freeOutputValues, leftValues] using valueFree
      apply Late.Struct.trans
        (Late.Struct.par
          ((Late.Struct.structurallyZero_iff_prefixCount_zero left).2
            leftPrefixFree)
          (inductionHypothesis rightSend rightSubject rightValue))
      exact Late.Struct.par_zero_left _
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          right rightPrefixFree with
        ⟨rightSend, _⟩
      have rightSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero right rightPrefixFree
      have rightValues :=
        freeOutputValues_eq_empty_of_prefixCount_eq_zero right rightPrefixFree
      have leftSend : left.sendPrefixCount = 1 := by
        simpa [Raw.Proc.sendPrefixCount, rightSend] using sendOne
      have leftSubject : subject ∈ left.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, rightSubjects] using subjectFree
      have leftValue : value ∈ left.freeOutputValues := by
        simpa [Raw.Proc.freeOutputValues, rightValues] using valueFree
      apply Late.Struct.trans
        (Late.Struct.choice
          (inductionHypothesis leftSend leftSubject leftValue)
          ((Late.Struct.structurallyZero_iff_prefixCount_zero right).2
            rightPrefixFree))
      exact Late.Struct.choiceZero
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          left leftPrefixFree with
        ⟨leftSend, _⟩
      have leftSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero left leftPrefixFree
      have leftValues :=
        freeOutputValues_eq_empty_of_prefixCount_eq_zero left leftPrefixFree
      have rightSend : right.sendPrefixCount = 1 := by
        simpa [Raw.Proc.sendPrefixCount, leftSend] using sendOne
      have rightSubject : subject ∈ right.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, leftSubjects] using subjectFree
      have rightValue : value ∈ right.freeOutputValues := by
        simpa [Raw.Proc.freeOutputValues, leftValues] using valueFree
      apply Late.Struct.trans
        (Late.Struct.choice
          ((Late.Struct.structurallyZero_iff_prefixCount_zero left).2
            leftPrefixFree)
          (inductionHypothesis rightSend rightSubject rightValue))
      exact Late.Struct.choice_zero_left _

/--
A one-communication thread known to contain its unique input subject
normalizes to an input prefix.  Its binder remains existential.
-/
theorem OneCommThread.recv_struct_of_subject
    {process : Raw.Proc}
    (thread : OneCommThread process)
    (recvOne : process.recvPrefixCount = 1)
    (subjectFree : subject ∈ process.freeSubjects) :
    ∃ binder,
      Late.Struct process (.recv subject binder .zero) := by
  induction thread with
  | @send channel sentValue next tailPrefixFree =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          next tailPrefixFree with
        ⟨_, tailRecv⟩
      simp [Raw.Proc.recvPrefixCount, tailRecv] at recvOne
  | @recv channel binder next tailPrefixFree =>
      have tailSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero next tailPrefixFree
      have channelEq : channel = subject := by
        simp [Raw.Proc.freeSubjects, tailSubjects] at subjectFree
        exact subjectFree.symm
      subst channel
      exact ⟨binder,
        Late.Struct.recv
          ((Late.Struct.structurallyZero_iff_prefixCount_zero next).2
            tailPrefixFree)⟩
  | @new body binder inner inductionHypothesis =>
      have innerRecv : body.recvPrefixCount = 1 := by
        simpa [Raw.Proc.recvPrefixCount] using recvOne
      have subjectSupport :
          subject ≠ binder ∧ subject ∈ body.freeSubjects := by
        simpa [Raw.Proc.freeSubjects] using subjectFree
      have binderNeSubject : binder ≠ subject := by
        exact Ne.symm subjectSupport.1
      have innerSubject : subject ∈ body.freeSubjects := by
        exact subjectSupport.2
      rcases inductionHypothesis innerRecv innerSubject with
        ⟨residualBinder, normalized⟩
      refine ⟨residualBinder, ?_⟩
      apply Late.Struct.trans (Late.Struct.new normalized)
      apply Late.Struct.new_fresh
      simp [Raw.Proc.freeNames, binderNeSubject]
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          right rightPrefixFree with
        ⟨_, rightRecv⟩
      have rightSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero right rightPrefixFree
      have leftRecv : left.recvPrefixCount = 1 := by
        simpa [Raw.Proc.recvPrefixCount, rightRecv] using recvOne
      have leftSubject : subject ∈ left.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, rightSubjects] using subjectFree
      rcases inductionHypothesis leftRecv leftSubject with
        ⟨binder, normalized⟩
      exact ⟨binder,
        Late.Struct.trans
          (Late.Struct.par normalized
            ((Late.Struct.structurallyZero_iff_prefixCount_zero right).2
              rightPrefixFree))
          Late.Struct.parZero⟩
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          left leftPrefixFree with
        ⟨_, leftRecv⟩
      have leftSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero left leftPrefixFree
      have rightRecv : right.recvPrefixCount = 1 := by
        simpa [Raw.Proc.recvPrefixCount, leftRecv] using recvOne
      have rightSubject : subject ∈ right.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, leftSubjects] using subjectFree
      rcases inductionHypothesis rightRecv rightSubject with
        ⟨binder, normalized⟩
      exact ⟨binder,
        Late.Struct.trans
          (Late.Struct.par
            ((Late.Struct.structurallyZero_iff_prefixCount_zero left).2
              leftPrefixFree)
            normalized)
          (Late.Struct.par_zero_left _)⟩
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          right rightPrefixFree with
        ⟨_, rightRecv⟩
      have rightSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero right rightPrefixFree
      have leftRecv : left.recvPrefixCount = 1 := by
        simpa [Raw.Proc.recvPrefixCount, rightRecv] using recvOne
      have leftSubject : subject ∈ left.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, rightSubjects] using subjectFree
      rcases inductionHypothesis leftRecv leftSubject with
        ⟨binder, normalized⟩
      exact ⟨binder,
        Late.Struct.trans
          (Late.Struct.choice normalized
            ((Late.Struct.structurallyZero_iff_prefixCount_zero right).2
              rightPrefixFree))
          Late.Struct.choiceZero⟩
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      rcases polarityCounts_eq_zero_of_prefixCount_eq_zero
          left leftPrefixFree with
        ⟨_, leftRecv⟩
      have leftSubjects :=
        freeSubjects_eq_empty_of_prefixCount_eq_zero left leftPrefixFree
      have rightRecv : right.recvPrefixCount = 1 := by
        simpa [Raw.Proc.recvPrefixCount, leftRecv] using recvOne
      have rightSubject : subject ∈ right.freeSubjects := by
        simpa [Raw.Proc.freeSubjects, leftSubjects] using subjectFree
      rcases inductionHypothesis rightRecv rightSubject with
        ⟨binder, normalized⟩
      exact ⟨binder,
        Late.Struct.trans
          (Late.Struct.choice
            ((Late.Struct.structurallyZero_iff_prefixCount_zero left).2
              leftPrefixFree)
            normalized)
          (Late.Struct.choice_zero_left _)⟩

/-! ## Exact remaining wrapped-support interface -/

/--
The smallest target-side support package left after the labelled split
inversion.  It contains no established state, linked endpoint, or canonical
residual.  Its four nominal facts are:

* the residual channel is not the free payload;
* it is the output residual's free subject;
* the payload is that residual's free output value; and
* it is the input residual's free subject.
-/
def SplitSupportTransfer
    (binders : List Name)
    (splitTarget : Raw.Proc) : Prop :=
  ∃ residualChannel outputResidual inputResidual,
    OneCommThread outputResidual ∧
    OneCommThread inputResidual ∧
    outputResidual.sendPrefixCount = 1 ∧
    inputResidual.recvPrefixCount = 1 ∧
    residualChannel ≠ payload ∧
    residualChannel ∈ outputResidual.freeSubjects ∧
    payload ∈ outputResidual.freeOutputValues ∧
    residualChannel ∈ inputResidual.freeSubjects ∧
    Late.Struct
      (wrapNews binders splitTarget)
      (.new residualChannel
        (.par outputResidual inputResidual))

/--
Source-orbit quantification of the exact support package.  The actual
`SplitCommunication` index remains present, so this interface cannot select
an unrelated target.
-/
def RequestingSplitSupportTransfer : Prop :=
  ∀ {binders : List Name} {left right splitTarget : Raw.Proc}
      (_leftThread : TwoCommThread left)
      (_rightThread : TwoCommThread right)
      (_polarities :
        (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
        (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
      (communication : SplitCommunication left right splitTarget),
    Late.Struct canonicalRequesting
        (wrapNews binders (.par left right)) →
      SplitSupportTransfer binders splitTarget

/--
The remaining wrapped-support statement is sufficient for the original
non-circular nominal-incidence boundary.
-/
theorem requestingPolarizedNominalIncidence_of_splitSupportTransfer
    (transfer : RequestingSplitSupportTransfer) :
    RequestingPolarizedNominalIncidence := by
  intro binders left right splitTarget
    leftThread rightThread polarities communication canonical
  rcases transfer leftThread rightThread polarities communication canonical with
    ⟨residualChannel, outputResidual, inputResidual,
      outputThread, inputThread, outputOne, inputOne,
      channel_ne_payload, outputSubject, outputPayload,
      inputSubject, targetNormal⟩
  have outputNormal :
      Late.Struct outputResidual
        (.send residualChannel payload .zero) :=
    OneCommThread.send_struct_of_support
      outputThread outputOne outputSubject outputPayload
  rcases OneCommThread.recv_struct_of_subject
      inputThread inputOne inputSubject with
    ⟨residualBinder, inputNormal⟩
  refine ⟨residualChannel, residualBinder,
    channel_ne_payload, ?_⟩
  apply Late.Struct.trans targetNormal
  apply Late.Struct.new
  simpa [pairProcess] using
    Late.Struct.par outputNormal inputNormal

end Cantilune.Pi.P1bNominalIncidenceProof
