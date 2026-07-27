import Cantilune.Pi.P1bRequestingThreadPolarityClassifier

/-!
# Shared source/target split context for the P1b native step

`TwoThreadContext.native_tau_target` retains the residual thread shape, while
`TwoThreadContext.structural_normal_form` exposes the source split.  This
module couples the two inductions: the actual native derivation, its source,
and its exact target are normalized through the same outer restriction list.

At the unique live parallel split the package stores the genuine
`SplitCommunication` derivation.  No native transition is transported across
structural congruence.
-/

namespace Cantilune.Pi.P1bNativeSplitContext

open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bTwoThreadExtraction
open Cantilune.Pi.P1bTwoThreadNativeInversion
open Cantilune.Pi.P1bLabelledThreadInversion
open Cantilune.Pi.P1bRequestingThreadPolarityClassifier

/--
One actual native split together with source and target normal forms sharing
the same outer restriction list.
-/
def NativeSplitNormalForm
    (source target : Raw.Proc) : Prop :=
  ∃ binders left right splitTarget,
    TwoCommThread left ∧
      TwoCommThread right ∧
      SplitCommunication left right splitTarget ∧
      Late.Struct source (wrapNews binders (.par left right)) ∧
      Late.Struct target (wrapNews binders splitTarget)

/--
Every genuine native `tau` selected from a two-thread context reaches the
unique live split.  Prefix-free parallel garbage is removed on both source
and target; a choice wrapper is removed only on the source because its native
rule already selects the active branch.
-/
theorem native_tau_split_normal_form
    {source target : Raw.Proc}
    (context : TwoThreadContext source)
    (step : Late.NativeStep source .tau target) :
    NativeSplitNormalForm source target := by
  induction context generalizing target with
  | split leftThread rightThread =>
      exact ⟨[], _, _, target, leftThread, rightThread,
        split_native_tau_inversion leftThread rightThread step,
        Late.Struct.refl _, Late.Struct.refl _⟩
  | @new binder body inner inductionHypothesis =>
      cases step with
      | restrict fresh innerStep =>
          rcases inductionHypothesis innerStep with
            ⟨binders, coreLeft, coreRight, splitTarget,
              leftThread, rightThread, communication,
              sourceNormal, targetNormal⟩
          exact ⟨binder :: binders, coreLeft, coreRight, splitTarget,
            leftThread, rightThread, communication,
            by simpa [wrapNews] using Late.Struct.new sourceNormal,
            by simpa [wrapNews] using Late.Struct.new targetNormal⟩
  | @parLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | parLeft fresh innerStep =>
          rcases inductionHypothesis innerStep with
            ⟨binders, coreLeft, coreRight, splitTarget,
              leftThread, rightThread, communication,
              sourceNormal, targetNormal⟩
          have rightZero : Late.Struct right .zero :=
            (Late.Struct.structurallyZero_iff_prefixCount_zero right).2
              rightPrefixFree
          exact ⟨binders, coreLeft, coreRight, splitTarget,
            leftThread, rightThread, communication,
              Late.Struct.trans
                (Late.Struct.par sourceNormal rightZero)
                Late.Struct.parZero,
              Late.Struct.trans
                (Late.Struct.par targetNormal rightZero)
                Late.Struct.parZero⟩
      | parRight fresh inactiveStep =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inactiveStep rightPrefixFree).elim
      | syncLeft outputStep inputStep binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inputStep rightPrefixFree).elim
      | syncRight inputStep outputStep binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              outputStep rightPrefixFree).elim
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inputStep rightPrefixFree).elim
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              outputStep rightPrefixFree).elim
  | @parRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | parLeft fresh inactiveStep =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inactiveStep leftPrefixFree).elim
      | parRight fresh innerStep =>
          rcases inductionHypothesis innerStep with
            ⟨binders, coreLeft, coreRight, splitTarget,
              leftThread, rightThread, communication,
              sourceNormal, targetNormal⟩
          have leftZero : Late.Struct left .zero :=
            (Late.Struct.structurallyZero_iff_prefixCount_zero left).2
              leftPrefixFree
          exact ⟨binders, coreLeft, coreRight, splitTarget,
            leftThread, rightThread, communication,
              Late.Struct.trans
                (Late.Struct.par leftZero sourceNormal)
                (Late.Struct.par_zero_left _),
              Late.Struct.trans
                (Late.Struct.par leftZero targetNormal)
                (Late.Struct.par_zero_left _)⟩
      | syncLeft outputStep inputStep binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              outputStep leftPrefixFree).elim
      | syncRight inputStep outputStep binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inputStep leftPrefixFree).elim
      | closeLeft outputStep inputStep freshForReceiver binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              outputStep leftPrefixFree).elim
      | closeRight inputStep outputStep freshForReceiver binderFresh =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inputStep leftPrefixFree).elim
  | @choiceLeft left right inner rightPrefixFree inductionHypothesis =>
      cases step with
      | choiceLeft innerStep =>
          rcases inductionHypothesis innerStep with
            ⟨binders, coreLeft, coreRight, splitTarget,
              leftThread, rightThread, communication,
              sourceNormal, targetNormal⟩
          have rightZero : Late.Struct right .zero :=
            (Late.Struct.structurallyZero_iff_prefixCount_zero right).2
              rightPrefixFree
          exact ⟨binders, coreLeft, coreRight, splitTarget,
            leftThread, rightThread, communication,
              Late.Struct.trans
                (Late.Struct.choice sourceNormal rightZero)
                Late.Struct.choiceZero,
              targetNormal⟩
      | choiceRight inactiveStep =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inactiveStep rightPrefixFree).elim
  | @choiceRight right left leftPrefixFree inner inductionHypothesis =>
      cases step with
      | choiceLeft inactiveStep =>
          exact
            (Late.NativeStep.false_of_source_prefixCount_eq_zero
              inactiveStep leftPrefixFree).elim
      | choiceRight innerStep =>
          rcases inductionHypothesis innerStep with
            ⟨binders, coreLeft, coreRight, splitTarget,
              leftThread, rightThread, communication,
              sourceNormal, targetNormal⟩
          have leftZero : Late.Struct left .zero :=
            (Late.Struct.structurallyZero_iff_prefixCount_zero left).2
              leftPrefixFree
          exact ⟨binders, coreLeft, coreRight, splitTarget,
            leftThread, rightThread, communication,
              Late.Struct.trans
                (Late.Struct.choice leftZero sourceNormal)
                (Late.Struct.choice_zero_left _),
              targetNormal⟩

/--
Specialization to any representative in the canonical requesting structural
orbit.  The actual native split is exposed while both normalized endpoints
remain tied to the original derivation.
-/
theorem requesting_native_split_normal_form
    {source target : Raw.Proc}
    (relation :
      Late.Struct
        canonicalRequesting
        source)
    (step : Late.NativeStep source .tau target) :
    NativeSplitNormalForm source target := by
  have fingerprint :=
    augmentedFingerprint_of_struct_canonicalRequesting relation
  have context : TwoThreadContext source :=
    AugmentedRequestingFingerprint.twoThreadContext fingerprint
  exact native_tau_split_normal_form context step

/--
The shared split enriched with the canonical pure-polarity classification.
The disjunction is only parallel order: one side is send/send and the other
is receive/receive.
-/
def NativePolarizedSplitNormalForm
    (source target : Raw.Proc) : Prop :=
  ∃ binders left right splitTarget,
    TwoCommThread left ∧
      TwoCommThread right ∧
      ((left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
        (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2)) ∧
      SplitCommunication left right splitTarget ∧
      Late.Struct source (wrapNews binders (.par left right)) ∧
      Late.Struct target (wrapNews binders splitTarget)

/--
Every actual native first handshake in the canonical structural orbit has a
shared, labelled, pure-polarity split.  Only nominal subject/value/binder
incidence remains after this theorem.
-/
theorem requesting_native_polarized_split_normal_form
    {source target : Raw.Proc}
    (relation : Late.Struct canonicalRequesting source)
    (step : Late.NativeStep source .tau target) :
    NativePolarizedSplitNormalForm source target := by
  rcases requesting_native_split_normal_form relation step with
    ⟨binders, left, right, splitTarget,
      leftThread, rightThread, communication,
      sourceNormal, targetNormal⟩
  have canonicalNormal :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right)) :=
    Late.Struct.trans relation sourceNormal
  have polarities :=
    polarities_of_struct_canonical_split
      canonicalNormal leftThread rightThread
  exact ⟨binders, left, right, splitTarget,
    leftThread, rightThread, polarities, communication,
    sourceNormal, targetNormal⟩

end Cantilune.Pi.P1bNativeSplitContext
