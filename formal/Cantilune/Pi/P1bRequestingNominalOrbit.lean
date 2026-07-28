import Cantilune.Pi.P1bTwoThreadExtraction

/-!
# Nominal structural orbit of the P1b requesting source

The augmented requesting fingerprint records the free-name and free-subject
interfaces, but those sets alone do not say that the unique free payload is
used as an output value.  This module adds that positional nominal invariant.

`Raw.Proc.freeOutputValues` is the finite set of names which occur freely in
output-value positions.  The binder clauses deliberately erase input and
restriction binders.  The central proofs audit every constructor of
`Late.Alpha` and `Late.Struct`, including ACU, `newComm`, scope extrusion,
symmetry, and transitivity.

The final structural-orbit theorem combines this invariant with the genuine
`TwoThreadContext` extraction.  It localizes the free payload to one of the
two active communication threads and proves that no outer normal-form
restriction binds it.  It does not claim the still-pending complete
channel/link incidence classification or transport a native step as a weak
transition.
-/

namespace Cantilune.Pi

namespace Raw.Proc

/--
Names occurring freely in output-value positions.

Input and restriction binders erase occurrences in their bodies, exactly as
they do for `freeNames`.  Subjects, match operands, and input binders are not
output values.
-/
def freeOutputValues : Raw.Proc → Finset Name
  | .zero => ∅
  | .tau next => freeOutputValues next
  | .send _ value next => insert value (freeOutputValues next)
  | .recv _ binder next => (freeOutputValues next).erase binder
  | .choice left right =>
      freeOutputValues left ∪ freeOutputValues right
  | .par left right =>
      freeOutputValues left ∪ freeOutputValues right
  | .new binder body => (freeOutputValues body).erase binder
  | .matchEq _ _ next => freeOutputValues next
  | .matchNe _ _ next => freeOutputValues next

/-- Every free output value is a free process name. -/
theorem freeOutputValues_subset_freeNames (process : Raw.Proc) :
    process.freeOutputValues ⊆ process.freeNames := by
  induction process <;>
    simp_all [freeOutputValues, Raw.Proc.freeNames,
      Finset.subset_iff] <;>
    aesop

/--
Fresh raw renaming transports the free output-value interface.  Erasing the
fresh replacement on the renamed side agrees with erasing the old name on
the source side.
-/
theorem freeOutputValues_substRaw_erase_replacement
    (process : Raw.Proc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    (process.substRaw needle replacement).freeOutputValues.erase replacement =
      process.freeOutputValues.erase needle := by
  induction process with
  | zero =>
      simp [Raw.Proc.substRaw, freeOutputValues]
  | tau next inductionHypothesis =>
      have nextFresh : replacement ∉ next.allNames := by
        simpa [Raw.Proc.allNames] using fresh
      simpa [Raw.Proc.substRaw, freeOutputValues] using
        inductionHypothesis nextFresh
  | send channel value next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_channelFresh, valueFresh, nextFresh⟩
      have nextSupport := inductionHypothesis nextFresh
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeOutputValues) ↔
            (name ≠ needle ∧ name ∈ next.freeOutputValues) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeOutputValues, Finset.mem_erase,
        Finset.mem_insert]
      by_cases valueNeedle : value = needle <;>
        simp_all <;> aesop
  | recv channel binder next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_channelFresh, binderFresh, nextFresh⟩
      have nextSupport := inductionHypothesis nextFresh
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeOutputValues) ↔
            (name ≠ needle ∧ name ∈ next.freeOutputValues) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [Raw.Proc.substRaw, freeOutputValues, Finset.mem_erase]
      by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeOutputValues) ↔
            (name ≠ needle ∧ name ∈ left.freeOutputValues) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeOutputValues) ↔
            (name ≠ needle ∧ name ∈ right.freeOutputValues) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [Raw.Proc.substRaw, freeOutputValues, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | par left right leftIH rightIH =>
      simp only [Raw.Proc.allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeOutputValues) ↔
            (name ≠ needle ∧ name ∈ left.freeOutputValues) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeOutputValues) ↔
            (name ≠ needle ∧ name ∈ right.freeOutputValues) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [Raw.Proc.substRaw, freeOutputValues, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | new binder body inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨binderFresh, bodyFresh⟩
      have bodySupport := inductionHypothesis bodyFresh
      ext name
      have bodyMembership :
          (name ≠ replacement ∧
              name ∈ (body.substRaw needle replacement).freeOutputValues) ↔
            (name ≠ needle ∧ name ∈ body.freeOutputValues) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) bodySupport).to_iff
      simp only [Raw.Proc.substRaw, freeOutputValues, Finset.mem_erase]
      by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop
  | matchEq left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, freeOutputValues] using
        inductionHypothesis nextFresh
  | matchNe left right next inductionHypothesis =>
      simp only [Raw.Proc.allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨_leftFresh, _rightFresh, nextFresh⟩
      simpa [Raw.Proc.substRaw, freeOutputValues] using
        inductionHypothesis nextFresh

end Raw.Proc

namespace Late.Alpha

/-- Alpha conversion preserves the free output-value interface. -/
theorem freeOutputValues_eq
    (relation : Alpha left right) :
    left.freeOutputValues = right.freeOutputValues := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.freeOutputValues] using inductionHypothesis
  | send relation inductionHypothesis =>
      simp [Raw.Proc.freeOutputValues, inductionHypothesis]
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.freeOutputValues, inductionHypothesis]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeOutputValues, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeOutputValues, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simp [Raw.Proc.freeOutputValues, inductionHypothesis]
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.freeOutputValues] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.freeOutputValues] using inductionHypothesis
  | recvBinder fresh =>
      simp only [Raw.Proc.freeOutputValues,
        Raw.Proc.renameBound_eq_substRaw]
      rw [Raw.Proc.freeOutputValues_substRaw_erase_replacement
        _ _ _ fresh]
  | newBinder fresh =>
      simp only [Raw.Proc.freeOutputValues,
        Raw.Proc.renameBound_eq_substRaw]
      rw [Raw.Proc.freeOutputValues_substRaw_erase_replacement
        _ _ _ fresh]

end Late.Alpha

namespace Late.Struct

/--
Structural congruence preserves the free output-value interface.

The scope-extrusion case uses its freshness premise together with
`freeOutputValues_subset_freeNames`; `newComm` reduces to commutation of
finite-set erasure.
-/
theorem freeOutputValues_eq
    (relation : Struct left right) :
    left.freeOutputValues = right.freeOutputValues := by
  induction relation with
  | refl process =>
      rfl
  | symm relation inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans first second firstIH secondIH =>
      exact firstIH.trans secondIH
  | alpha relation =>
      exact Late.Alpha.freeOutputValues_eq relation
  | tau relation inductionHypothesis =>
      simpa [Raw.Proc.freeOutputValues] using inductionHypothesis
  | send relation inductionHypothesis =>
      simp [Raw.Proc.freeOutputValues, inductionHypothesis]
  | recv relation inductionHypothesis =>
      simp [Raw.Proc.freeOutputValues, inductionHypothesis]
  | choice leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeOutputValues, leftIH, rightIH]
  | par leftRelation rightRelation leftIH rightIH =>
      simp [Raw.Proc.freeOutputValues, leftIH, rightIH]
  | new relation inductionHypothesis =>
      simp [Raw.Proc.freeOutputValues, inductionHypothesis]
  | matchEq relation inductionHypothesis =>
      simpa [Raw.Proc.freeOutputValues] using inductionHypothesis
  | matchNe relation inductionHypothesis =>
      simpa [Raw.Proc.freeOutputValues] using inductionHypothesis
  | parZero =>
      simp [Raw.Proc.freeOutputValues]
  | parComm =>
      simp [Raw.Proc.freeOutputValues, Finset.union_comm]
  | parAssoc =>
      simp [Raw.Proc.freeOutputValues, Finset.union_assoc]
  | choiceZero =>
      simp [Raw.Proc.freeOutputValues]
  | choiceComm =>
      simp [Raw.Proc.freeOutputValues, Finset.union_comm]
  | choiceAssoc =>
      simp [Raw.Proc.freeOutputValues, Finset.union_assoc]
  | newZero =>
      simp [Raw.Proc.freeOutputValues]
  | newComm distinct =>
      ext name
      simp only [Raw.Proc.freeOutputValues, Finset.mem_erase]
      aesop
  | @scopeExtrude binder left right fresh =>
      have binderFresh :
          binder ∉ left.freeOutputValues := by
        intro member
        exact fresh
          (Raw.Proc.freeOutputValues_subset_freeNames left member)
      ext name
      simp only [Raw.Proc.freeOutputValues, Finset.mem_erase,
        Finset.mem_union]
      constructor <;> intro membership
      · rcases membership with ⟨notBinder, inLeft | inRight⟩
        · exact Or.inl inLeft
        · exact Or.inr ⟨notBinder, inRight⟩
      · constructor
        · intro nameEq
          subst name
          rcases membership with inLeft | inRight
          · exact binderFresh inLeft
          · exact inRight.1 rfl
        · rcases membership with inLeft | inRight
          · exact Or.inl inLeft
          · exact Or.inr inRight.2

end Late.Struct

namespace P1bRequestingNominalOrbit

open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bTwoThreadExtraction

/-- The canonical requesting source has exactly one free output value. -/
theorem canonicalRequesting_freeOutputValues :
    canonicalRequesting.freeOutputValues = {payload} := by
  norm_num [canonicalRequesting, closedRestrictedHandshake,
    restrictedHandshake, request, accept, requestContinuation,
    acceptContinuation, Proc.erase, Raw.Proc.freeOutputValues,
    publicChannel, sessionChannel, boundSessionChannel,
    publicName, session, sessionBinder, payload, payloadBinder]

/--
Every structural representative retains the fact that the protocol payload,
and no other free name, occupies an output-value position.
-/
theorem freeOutputValues_of_struct_canonicalRequesting
    {source : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source) :
    source.freeOutputValues = {payload} :=
  (Late.Struct.freeOutputValues_eq relation).symm.trans
    canonicalRequesting_freeOutputValues

/-- Output-value membership through a finite restriction context. -/
theorem mem_freeOutputValues_wrapNews_iff
    (name : Name) (binders : List Name) (process : Raw.Proc) :
    name ∈ (wrapNews binders process).freeOutputValues ↔
      name ∉ binders ∧ name ∈ process.freeOutputValues := by
  induction binders with
  | nil =>
      simp [wrapNews]
  | cons binder rest inductionHypothesis =>
      simp [wrapNews, Raw.Proc.freeOutputValues, inductionHypothesis,
        and_assoc]

/--
An explicit normal-form package for the requesting structural orbit.

Besides the syntax-directed two-thread witnesses, the package localizes the
free payload to one active thread and rules out its capture by the extracted
outer restriction list.
-/
def OrbitNormalForm (source : Raw.Proc) : Prop :=
  ∃ binders left right,
    TwoCommThread left ∧
    TwoCommThread right ∧
    Late.Struct source (wrapNews binders (.par left right)) ∧
    Late.Struct canonicalRequesting
      (wrapNews binders (.par left right)) ∧
    AugmentedRequestingFingerprint
      (wrapNews binders (.par left right)) ∧
    (wrapNews binders (.par left right)).freeOutputValues = {payload} ∧
    payload ∉ binders ∧
    (payload ∈ left.freeOutputValues ∨
      payload ∈ right.freeOutputValues)

/--
Every `Late.Struct` representative of the canonical requesting source admits
the two-thread nominal orbit normal form.

This theorem is the source-side bridge needed before native-rule inversion:
it audits the complete structural orbit without asserting a false native-step
transport lemma.
-/
theorem orbit_normal_form
    {source : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source) :
    OrbitNormalForm source := by
  have fingerprint :
      AugmentedRequestingFingerprint source :=
    augmentedFingerprint_of_struct_canonicalRequesting relation
  have context : TwoThreadContext source :=
    AugmentedRequestingFingerprint.twoThreadContext fingerprint
  rcases context.structural_normal_form with
    ⟨binders, left, right, leftThread, rightThread, sourceNormal⟩
  have canonicalNormal :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right)) :=
    Late.Struct.trans relation sourceNormal
  have normalFingerprint :
      AugmentedRequestingFingerprint
        (wrapNews binders (.par left right)) :=
    augmentedFingerprint_of_struct_canonicalRequesting canonicalNormal
  have sourceValues : source.freeOutputValues = {payload} :=
    freeOutputValues_of_struct_canonicalRequesting relation
  have normalValues :
      (wrapNews binders (.par left right)).freeOutputValues = {payload} :=
    (Late.Struct.freeOutputValues_eq sourceNormal).symm.trans sourceValues
  have payloadNormal :
      payload ∈
        (wrapNews binders (.par left right)).freeOutputValues := by
    rw [normalValues]
    simp
  have payloadScoped :=
    (mem_freeOutputValues_wrapNews_iff
      payload binders (.par left right)).mp payloadNormal
  have payloadInThreads :
      payload ∈ left.freeOutputValues ∨
        payload ∈ right.freeOutputValues := by
    simpa only [Raw.Proc.freeOutputValues, Finset.mem_union] using
      payloadScoped.2
  exact ⟨binders, left, right, leftThread, rightThread, sourceNormal,
    canonicalNormal, normalFingerprint, normalValues, payloadScoped.1,
    payloadInThreads⟩

/--
Exact constraints on a native step selected anywhere in the requesting
structural orbit.

This is not a weak-step statement: `step` is one genuine
`Late.NativeStep`.  The result combines the nominal orbit normal form with
the exact `4 → 2` residual and its one-output/one-input polarity.
-/
theorem native_step_orbit_constraints
    {source target : Raw.Proc} {action : Raw.Action}
    (relation : Late.Struct canonicalRequesting source)
    (step : Late.NativeStep source action target) :
    action = .tau ∧
      OrbitNormalForm source ∧
      target.prefixCount = 2 ∧
      target.sendPrefixCount = 1 ∧
      target.recvPrefixCount = 1 := by
  have fingerprint :
      AugmentedRequestingFingerprint source :=
    augmentedFingerprint_of_struct_canonicalRequesting relation
  have actionEq :
      action = .tau :=
    (Late.Step.native step).action_eq_tau_of_source_freeSubjects_empty
      fingerprint.freeSubjects_eq
  subst action
  exact ⟨rfl, orbit_normal_form relation,
    fingerprint.native_tau_target_prefixCount_eq step,
    fingerprint.native_tau_target_sendPrefixCount_eq step,
    fingerprint.native_tau_target_recvPrefixCount_eq step⟩

end P1bRequestingNominalOrbit

end Cantilune.Pi
