import Cantilune.Pi.LateGuardedReplication

/-!
# Conservativity and freshness for guarded replication

This module records two meta-theoretic boundaries of the guarded-replication
extension.

* A native extended transition whose source is in the image of `ofRaw` is
  exactly an old finite-control native transition.  In particular, the new
  replication rules cannot manufacture a transition from an embedded old
  process.
* Choosing a replacement outside the complete syntactic name set makes the
  direct substitution branch capture-free, including under replicated input.

Both statements concern one strong native step.  No weak closure or
observational quotient is used.
-/

namespace Cantilune.Pi

namespace RecursiveProc

/-- Partial inverse of `ofRaw`; guarded replication is deliberately rejected. -/
def toRaw? : RecursiveProc → Option Raw.Proc
  | .zero => some .zero
  | .tau next => next.toRaw?.map .tau
  | .send channel value next =>
      next.toRaw?.map (.send channel value)
  | .recv channel binder next =>
      next.toRaw?.map (.recv channel binder)
  | .choice left right => do
      let oldLeft ← left.toRaw?
      let oldRight ← right.toRaw?
      pure (.choice oldLeft oldRight)
  | .par left right => do
      let oldLeft ← left.toRaw?
      let oldRight ← right.toRaw?
      pure (.par oldLeft oldRight)
  | .new binder body =>
      body.toRaw?.map (.new binder)
  | .matchEq left right next =>
      next.toRaw?.map (.matchEq left right)
  | .matchNe left right next =>
      next.toRaw?.map (.matchNe left right)
  | .repTau _ | .repSend _ _ _ | .repRecv _ _ _ => none

@[simp]
theorem toRaw?_ofRaw (process : Raw.Proc) :
    (ofRaw process).toRaw? = some process := by
  induction process <;>
    simp_all [ofRaw, toRaw?]

/-- The structural embedding of finite-control processes is injective. -/
theorem ofRaw_injective : Function.Injective ofRaw := by
  intro left right equality
  have decoded := congrArg toRaw? equality
  simpa using decoded

/--
If the proposed replacement is absent from every syntactic name position,
then no binder can capture it.  The statement covers all three guarded
replication constructors, in particular the binder of `repRecv`.
-/
theorem captureRisk_eq_false_of_replacement_fresh
    (process : RecursiveProc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    process.captureRisk needle replacement = false := by
  induction process with
  | zero =>
      rfl
  | tau next inductionHypothesis =>
      simpa [captureRisk, allNames] using
        inductionHypothesis fresh
  | send channel value next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      simpa [captureRisk] using inductionHypothesis fresh.2.2
  | recv channel binder next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      by_cases stops : binder = needle
      · simp [captureRisk, stops]
      · have binderNotReplacement : binder ≠ replacement := by
          simpa [eq_comm] using fresh.2.1
        simp [captureRisk, stops, binderNotReplacement,
          inductionHypothesis fresh.2.2]
  | choice left right leftHypothesis rightHypothesis =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      simp [captureRisk, leftHypothesis fresh.1,
        rightHypothesis fresh.2]
  | par left right leftHypothesis rightHypothesis =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      simp [captureRisk, leftHypothesis fresh.1,
        rightHypothesis fresh.2]
  | new binder body inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      by_cases stops : binder = needle
      · simp [captureRisk, stops]
      · have binderNotReplacement : binder ≠ replacement := by
          simpa [eq_comm] using fresh.1
        simp [captureRisk, stops, binderNotReplacement,
          inductionHypothesis fresh.2]
  | matchEq left right next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      simpa [captureRisk] using inductionHypothesis fresh.2.2
  | matchNe left right next inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      simpa [captureRisk] using inductionHypothesis fresh.2.2
  | repTau body inductionHypothesis =>
      simpa [captureRisk, allNames] using
        inductionHypothesis fresh
  | repSend channel value body inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      simpa [captureRisk] using inductionHypothesis fresh.2.2
  | repRecv channel binder body inductionHypothesis =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      by_cases stops : binder = needle
      · simp [captureRisk, stops]
      · have binderNotReplacement : binder ≠ replacement := by
          simpa [eq_comm] using fresh.2.1
        simp [captureRisk, stops, binderNotReplacement,
          inductionHypothesis fresh.2.2]

/--
With a globally fresh replacement, total capture-avoiding substitution takes
the direct structural branch.  Thus no alpha-freshening is needed and no
binder captures the replacement.
-/
theorem substituteCaptureAvoiding_eq_substRaw_of_replacement_fresh
    (process : RecursiveProc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    process.substituteCaptureAvoiding needle replacement =
      process.substRaw needle replacement :=
  substituteCaptureAvoiding_eq_substRaw process needle replacement
    (captureRisk_eq_false_of_replacement_fresh
      process needle replacement fresh)

/--
The deterministic fresh name generated from the complete syntax is always a
capture-free replacement.
-/
theorem captureRisk_freshName_eq_false
    (process : RecursiveProc) (needle replacement : Name) :
    process.captureRisk needle
      (process.freshName needle replacement) = false :=
  captureRisk_eq_false_of_replacement_fresh
    process needle (process.freshName needle replacement)
    (process.freshName_not_mem_allNames needle replacement)

end RecursiveProc

namespace RecursiveLate

open RecursiveProc

/--
Source-directed conservativity.  Every strong native transition starting at
an embedded finite-control process has an embedded target and is witnessed by
the corresponding old `Late.NativeStep`.

This stronger formulation is useful because the target need not be assumed in
the image: that fact is derived from the transition.
-/
theorem native_source_conservative
    (step : NativeStep source action target) :
    ∀ oldSource,
      source = RecursiveProc.ofRaw oldSource →
      ∃ oldTarget,
        target = RecursiveProc.ofRaw oldTarget ∧
          Late.NativeStep oldSource action oldTarget := by
  induction step with
  | embedded oldStep =>
      intro oldSource sourceEquality
      have sourceIdentity :=
        RecursiveProc.ofRaw_injective sourceEquality
      subst oldSource
      exact ⟨_, rfl, oldStep⟩
  | @prefixTau next =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      subst next
      exact ⟨_, rfl, Late.NativeStep.prefixTau⟩
  | @prefixOutput channel value next =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with
        ⟨channelEquality, valueEquality, nextEquality⟩
      subst_vars
      exact ⟨_, rfl, Late.NativeStep.prefixOutput⟩
  | @prefixInput channel binder next =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with
        ⟨channelEquality, binderEquality, nextEquality⟩
      subst_vars
      exact ⟨_, rfl, Late.NativeStep.prefixInput⟩
  | @matchGuard body action target name inner inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with
        ⟨leftEquality, rightEquality, bodyEquality⟩
      subst_vars
      obtain ⟨oldTarget, targetEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      exact
        ⟨oldTarget, targetEquality,
          Late.NativeStep.matchGuard oldStep⟩
  | @mismatchGuard left right body action target distinct inner
      inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with
        ⟨leftEquality, rightEquality, bodyEquality⟩
      subst_vars
      obtain ⟨oldTarget, targetEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      exact
        ⟨oldTarget, targetEquality,
          Late.NativeStep.mismatchGuard distinct oldStep⟩
  | @choiceLeft left action next right inner inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldNext, nextEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      exact
        ⟨oldNext, nextEquality,
          Late.NativeStep.choiceLeft oldStep⟩
  | @choiceRight right action next left inner inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldNext, nextEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      exact
        ⟨oldNext, nextEquality,
          Late.NativeStep.choiceRight oldStep⟩
  | @parLeft left action next right fresh inner inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldNext, nextEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      subst next
      exact
        ⟨_, rfl,
          Late.NativeStep.parLeft (by simpa using fresh) oldStep⟩
  | @parRight right action next left fresh inner inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldNext, nextEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      subst next
      exact
        ⟨_, rfl,
          Late.NativeStep.parRight (by simpa using fresh) oldStep⟩
  | @syncLeft left channel value left' right binder right'
      outputStep inputStep fresh outputHypothesis inputHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldLeft', leftEquality, oldOutput⟩ :=
        outputHypothesis _ rfl
      obtain ⟨oldRight', rightEquality, oldInput⟩ :=
        inputHypothesis _ rfl
      subst left'
      subst right'
      exact
        ⟨_,
          by
            rw [RecursiveProc.substituteCaptureAvoiding_ofRaw]
            rfl,
          Late.NativeStep.syncLeft oldOutput oldInput
            (by simpa using fresh)⟩
  | @syncRight left channel binder left' right value right'
      inputStep outputStep fresh inputHypothesis outputHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldLeft', leftEquality, oldInput⟩ :=
        inputHypothesis _ rfl
      obtain ⟨oldRight', rightEquality, oldOutput⟩ :=
        outputHypothesis _ rfl
      subst left'
      subst right'
      exact
        ⟨_,
          by
            rw [RecursiveProc.substituteCaptureAvoiding_ofRaw]
            rfl,
          Late.NativeStep.syncRight oldInput oldOutput
            (by simpa using fresh)⟩
  | @restrict binder body action next fresh inner inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨binderEquality, bodyEquality⟩
      subst_vars
      obtain ⟨oldNext, nextEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      subst next
      exact
        ⟨_, rfl, Late.NativeStep.restrict fresh oldStep⟩
  | @«open» fresh channel body next distinct inner inductionHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨binderEquality, bodyEquality⟩
      subst_vars
      obtain ⟨oldNext, nextEquality, oldStep⟩ :=
        inductionHypothesis _ rfl
      subst next
      exact
        ⟨_, rfl, Late.NativeStep.open distinct oldStep⟩
  | @closeLeft left channel fresh left' right binder right'
      outputStep inputStep freshForReceiver binderFresh
      outputHypothesis inputHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldLeft', leftEquality, oldOutput⟩ :=
        outputHypothesis _ rfl
      obtain ⟨oldRight', rightEquality, oldInput⟩ :=
        inputHypothesis _ rfl
      subst left'
      subst right'
      exact
        ⟨_,
          by
            rw [RecursiveProc.substituteCaptureAvoiding_ofRaw]
            rfl,
          Late.NativeStep.closeLeft oldOutput oldInput
            (by simpa using freshForReceiver)
            (by simpa using binderFresh)⟩
  | @closeRight left channel binder left' right fresh right'
      inputStep outputStep freshForReceiver binderFresh
      inputHypothesis outputHypothesis =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
      rcases sourceEquality with ⟨leftEquality, rightEquality⟩
      subst_vars
      obtain ⟨oldLeft', leftEquality, oldInput⟩ :=
        inputHypothesis _ rfl
      obtain ⟨oldRight', rightEquality, oldOutput⟩ :=
        outputHypothesis _ rfl
      subst left'
      subst right'
      exact
        ⟨_,
          by
            rw [RecursiveProc.substituteCaptureAvoiding_ofRaw]
            rfl,
          Late.NativeStep.closeRight oldInput oldOutput
            (by simpa using freshForReceiver)
            (by simpa using binderFresh)⟩
  | replicatedTau =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
  | replicatedOutput =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality
  | replicatedInput =>
      intro oldSource sourceEquality
      cases oldSource <;> simp [RecursiveProc.ofRaw] at sourceEquality

/--
Exact one-step reflection on the finite-control image.
-/
theorem ofRaw_native_reflect
    (step :
      NativeStep
        (RecursiveProc.ofRaw source) action
        (RecursiveProc.ofRaw target)) :
    Late.NativeStep source action target := by
  obtain ⟨oldTarget, targetEquality, oldStep⟩ :=
    native_source_conservative step source rfl
  have targetIdentity : oldTarget = target :=
    RecursiveProc.ofRaw_injective targetEquality.symm
  simpa [targetIdentity] using oldStep

/--
The embedded old relation and the extended relation coincide exactly on the
finite-control image.
-/
theorem ofRaw_native_iff :
    NativeStep
        (RecursiveProc.ofRaw source) action
        (RecursiveProc.ofRaw target) ↔
      Late.NativeStep source action target :=
  ⟨ofRaw_native_reflect, ofRaw_native⟩

end RecursiveLate

end Cantilune.Pi
