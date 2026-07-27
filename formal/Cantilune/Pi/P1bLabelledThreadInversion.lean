import Cantilune.Pi.P1bTwoThreadNativeInversion

/-!
# Labelled native inversion for the first P1b communication

The quantitative two-thread inversion proves that one native `tau` leaves
two one-prefix threads.  This module retains the labels which are deliberately
forgotten by that quantitative statement.

There are two layers.

* `SplitCommunication` is an exact inversion of a native `tau` at the actual
  parallel split of two `TwoCommThread`s.  Its four constructors are precisely
  `syncLeft`, `syncRight`, `closeLeft`, and `closeRight`; their indices retain
  the common subject, offered value, input binder, and exact native target.
* The labelled-core inversion theorems specialize those four cases to the
  request/accept incidence.  They normalize the exact native target to a pair
  whose output value is `payload` and whose two residual subjects are
  `offered`.  The residual input binder is existential because total
  capture-avoiding substitution may take its slow alpha-freshening branch.

Every premise below concerns one actual `Late.NativeStep`.  No transition is
transported through `Late.Struct`, and no weak or reflexive-transitive closure
is introduced.
-/

namespace Cantilune.Pi.P1bLabelledThreadInversion

open Cantilune.Pi.P1bLinkedCoreResidual
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bTwoThreadExtraction
open Cantilune.Pi.P1bTwoThreadNativeInversion
open Cantilune.Pi.Protocols

/-! ## Elementary native head inversion -/

/-- A raw output prefix has exactly its displayed native output head. -/
theorem send_head_inversion
    {channel value : Name} {continuation target : Raw.Proc}
    {action : Raw.Action}
    (step :
      Late.NativeStep
        (.send channel value continuation) action target) :
    action = .output channel value ∧ target = continuation := by
  cases step
  exact ⟨rfl, rfl⟩

/-- A raw input prefix has exactly its displayed native input head. -/
theorem recv_head_inversion
    {channel binder : Name} {continuation target : Raw.Proc}
    {action : Raw.Action}
    (step :
      Late.NativeStep
        (.recv channel binder continuation) action target) :
    action = .input channel binder ∧ target = continuation := by
  cases step
  exact ⟨rfl, rfl⟩

/--
An immediately restricted self-output cannot escape by `restrict`: the
offered name occurs in the free output label.  Its only native head is the
standard bound output produced by `open`.
-/
theorem restricted_self_send_head_inversion
    {fresh channel : Name} {continuation target : Raw.Proc}
    {action : Raw.Action}
    (step :
      Late.NativeStep
        (.new fresh (.send channel fresh continuation)) action target) :
    action = .boundOutput channel fresh ∧ target = continuation := by
  cases step with
  | restrict freshness inner =>
      cases inner
      exact False.elim (freshness (by simp [Raw.Action.names]))
  | «open» distinct inner =>
      cases inner
      exact ⟨rfl, rfl⟩

/-! ## Exact labels at the real two-thread split -/

/--
The four possible binary native communications at a two-thread parallel
split.  The indexed target is the exact target of the native rule, including
total capture-avoiding substitution and the restriction introduced by
`close`.
-/
inductive SplitCommunication
    (left right : Raw.Proc) : Raw.Proc → Prop where
  | syncLeft
      (outputStep :
        Late.NativeStep left (.output subject offered) leftTarget)
      (inputStep :
        Late.NativeStep right (.input subject inputBinder) rightTarget)
      (binderFresh : inputBinder ∉ leftTarget.freeNames) :
      SplitCommunication left right
        (.par leftTarget
          (rightTarget.substituteCaptureAvoiding inputBinder offered))
  | syncRight
      (inputStep :
        Late.NativeStep left (.input subject inputBinder) leftTarget)
      (outputStep :
        Late.NativeStep right (.output subject offered) rightTarget)
      (binderFresh : inputBinder ∉ rightTarget.freeNames) :
      SplitCommunication left right
        (.par
          (leftTarget.substituteCaptureAvoiding inputBinder offered)
          rightTarget)
  | closeLeft
      (outputStep :
        Late.NativeStep left (.boundOutput subject offered) leftTarget)
      (inputStep :
        Late.NativeStep right (.input subject inputBinder) rightTarget)
      (freshForReceiver : offered ∉ right.freeNames)
      (binderFresh : inputBinder ∉ leftTarget.freeNames) :
      SplitCommunication left right
        (.new offered
          (.par leftTarget
            (rightTarget.substituteCaptureAvoiding inputBinder offered)))
  | closeRight
      (inputStep :
        Late.NativeStep left (.input subject inputBinder) leftTarget)
      (outputStep :
        Late.NativeStep right (.boundOutput subject offered) rightTarget)
      (freshForReceiver : offered ∉ left.freeNames)
      (binderFresh : inputBinder ∉ rightTarget.freeNames) :
      SplitCommunication left right
        (.new offered
          (.par
            (leftTarget.substituteCaptureAvoiding inputBinder offered)
            rightTarget))

/--
Exact labelled inversion of a native `tau` at the actual split of two
sequential communication threads.

The two unary `par` cases are impossible because a `TwoCommThread` has no
native `tau`.  Therefore the result records one of the four genuine binary
rules, with no loss of its subject/value/binder parameters.
-/
theorem split_native_tau_inversion
    {left right target : Raw.Proc}
    (leftThread : TwoCommThread left)
    (rightThread : TwoCommThread right)
    (step : Late.NativeStep (.par left right) .tau target) :
    SplitCommunication left right target := by
  cases step with
  | parLeft fresh leftStep =>
      exact (TwoCommThread.no_native_tau leftThread leftStep).elim
  | parRight fresh rightStep =>
      exact (TwoCommThread.no_native_tau rightThread rightStep).elim
  | syncLeft outputStep inputStep binderFresh =>
      exact SplitCommunication.syncLeft
        outputStep inputStep binderFresh
  | syncRight inputStep outputStep binderFresh =>
      exact SplitCommunication.syncRight
        inputStep outputStep binderFresh
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      exact SplitCommunication.closeLeft
        outputStep inputStep freshForReceiver binderFresh
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      exact SplitCommunication.closeRight
        inputStep outputStep freshForReceiver binderFresh

/-! ## Total substitution, including the slow alpha-freshening branch -/

/--
The slow branch is reachable: when the residual input binder is exactly the
offered name, total substitution alpha-freshens it.  The equality is about the
executable substitution itself, not merely its structural class.
-/
theorem inputContinuation_slow_freshening
    (outerBinder offered : Name)
    (outer_ne_offered : outerBinder ≠ offered) :
    let fresh := (Raw.Proc.zero).freshName outerBinder offered
    Raw.Proc.substituteCaptureAvoiding
        (.recv outerBinder offered .zero)
        outerBinder offered =
      .recv offered fresh .zero ∧
    fresh ≠ offered := by
  let fresh := (Raw.Proc.zero).freshName outerBinder offered
  have residual_ne_outer : offered ≠ outerBinder :=
    outer_ne_offered.symm
  have fresh_ne_offered :
      fresh ≠ offered :=
    Raw.Proc.freshName_ne_replacement
      Raw.Proc.zero outerBinder offered
  refine ⟨?_, fresh_ne_offered⟩
  simp [fresh, Raw.Proc.substituteCaptureAvoiding,
    Raw.Proc.captureRisk, Raw.Proc.syntaxDepth,
    Raw.Proc.substituteCaptureAvoidingAux,
    Raw.Proc.renameBound, Raw.Proc.substRaw,
    outer_ne_offered, residual_ne_outer]

/--
Uniform structural normalization of the input continuation after total
substitution.  This aliases the kernel-checked slow/fast branch theorem at the
labelled boundary used below.
-/
theorem inputContinuation_total_struct
    (outerBinder offered residualBinder : Name)
    (outer_ne_offered : outerBinder ≠ offered) :
    ∃ normalizedBinder : Name,
      normalizedBinder ≠ offered ∧
      Late.Struct
        (Raw.Proc.substituteCaptureAvoiding
          (.recv outerBinder residualBinder .zero)
          outerBinder offered)
        (.recv offered normalizedBinder .zero) :=
  inputContinuation_substitution_struct
    outerBinder offered residualBinder outer_ne_offered

/--
An actual communication whose residual binder collides with the offered name
takes the slow freshening branch and still lands in the labelled residual
family.  This is a positive execution witness, not only a substitution lemma.
-/
theorem direct_native_tau_slow_freshening
    (publicSubject offered outerBinder payload : Name)
    (outer_ne_offered : outerBinder ≠ offered)
    (outer_ne_payload : outerBinder ≠ payload) :
    ∃ fresh : Name,
      fresh ≠ offered ∧
      Late.NativeStep
        (directCore
          publicSubject offered outerBinder payload offered)
        .tau
        (pairProcess offered payload fresh) := by
  let fresh := (Raw.Proc.zero).freshName outerBinder offered
  have substitution :=
    inputContinuation_slow_freshening
      outerBinder offered outer_ne_offered
  have binderFresh :
      outerBinder ∉
        (Raw.Proc.send offered payload .zero).freeNames := by
    simp [Raw.Proc.freeNames, outer_ne_offered, outer_ne_payload]
  have communication :
      Late.NativeStep
        (directCore
          publicSubject offered outerBinder payload offered)
        .tau
        (.par
          (.send offered payload .zero)
          ((.recv outerBinder offered .zero :
              Raw.Proc).substituteCaptureAvoiding
            outerBinder offered)) := by
    exact Late.NativeStep.syncLeft
      Late.NativeStep.prefixOutput
      Late.NativeStep.prefixInput
      binderFresh
  refine ⟨fresh, substitution.2, ?_⟩
  rw [substitution.1] at communication
  simpa [directCore, outputThread, inputThread, pairProcess] using
    communication

/-! ## Labelled request/accept cores -/

/-- Output-left source where the offered name is opened by the sender. -/
def closeDirectCore
    (publicSubject offered outerBinder payload residualBinder : Name) :
    Raw.Proc :=
  .par
    (.new offered
      (outputThread publicSubject offered payload))
    (inputThread publicSubject outerBinder residualBinder)

/-- Input-left mirror of `closeDirectCore`. -/
def closeCrossedCore
    (publicSubject offered outerBinder payload residualBinder : Name) :
    Raw.Proc :=
  .par
    (inputThread publicSubject outerBinder residualBinder)
    (.new offered
      (outputThread publicSubject offered payload))

/--
Any native `tau` from the exact direct labelled core is its displayed
output/input communication.  Its exact executable target is structurally a
pair whose output value is `payload` and whose two subjects are `offered`.
The existential binder covers both the fast and slow substitution branches.
-/
theorem direct_native_tau_labelled_inversion
    (publicSubject offered outerBinder payload residualBinder : Name)
    {target : Raw.Proc}
    (step :
      Late.NativeStep
        (directCore
          publicSubject offered outerBinder payload residualBinder)
        .tau target) :
    ∃ normalizedBinder : Name,
      normalizedBinder ≠ offered ∧
      Late.Struct target
        (pairProcess offered payload normalizedBinder) := by
  unfold directCore outputThread inputThread at step
  cases step with
  | parLeft fresh leftStep =>
      cases leftStep
  | parRight fresh rightStep =>
      cases rightStep
  | syncLeft outputStep inputStep binderFresh =>
      cases outputStep
      cases inputStep
      have outer_ne_offered : outerBinder ≠ offered := by
        intro equality
        subst outerBinder
        exact binderFresh (by simp [Raw.Proc.freeNames])
      rcases inputContinuation_total_struct
          outerBinder offered residualBinder outer_ne_offered with
        ⟨normalizedBinder, normalized_ne_offered, normalized⟩
      refine ⟨normalizedBinder, normalized_ne_offered, ?_⟩
      simpa [pairProcess] using
        (Late.Struct.par
          (Late.Struct.refl
            (.send offered payload .zero : Raw.Proc))
          normalized)
  | syncRight inputStep outputStep binderFresh =>
      cases inputStep
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      cases outputStep
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      cases inputStep

/--
The crossed ordinary communication has the same labelled residual, up to the
single post-step parallel commutativity equation.
-/
theorem crossed_native_tau_labelled_inversion
    (publicSubject offered outerBinder payload residualBinder : Name)
    {target : Raw.Proc}
    (step :
      Late.NativeStep
        (crossedCore
          publicSubject offered outerBinder payload residualBinder)
        .tau target) :
    ∃ normalizedBinder : Name,
      normalizedBinder ≠ offered ∧
      Late.Struct target
        (pairProcess offered payload normalizedBinder) := by
  unfold crossedCore outputThread inputThread at step
  cases step with
  | parLeft fresh leftStep =>
      cases leftStep
  | parRight fresh rightStep =>
      cases rightStep
  | syncLeft outputStep inputStep binderFresh =>
      cases outputStep
  | syncRight inputStep outputStep binderFresh =>
      cases inputStep
      cases outputStep
      have outer_ne_offered : outerBinder ≠ offered := by
        intro equality
        subst outerBinder
        exact binderFresh (by simp [Raw.Proc.freeNames])
      rcases inputContinuation_total_struct
          outerBinder offered residualBinder outer_ne_offered with
        ⟨normalizedBinder, normalized_ne_offered, normalized⟩
      refine ⟨normalizedBinder, normalized_ne_offered, ?_⟩
      apply Late.Struct.trans
        (Late.Struct.par normalized
          (Late.Struct.refl
            (.send offered payload .zero : Raw.Proc)))
      simpa [pairProcess] using
        (Late.Struct.parComm :
          Late.Struct
            (.par
              (.recv offered normalizedBinder .zero)
              (.send offered payload .zero))
            (.par
              (.send offered payload .zero)
              (.recv offered normalizedBinder .zero)))
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      cases outputStep
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      cases inputStep
      cases outputStep

/--
Any native `tau` from the output-left opened core is `open` followed by the
native `closeLeft` constructor.  The introduced restriction is retained and
the labelled residual is normalized beneath it.
-/
theorem closeDirect_native_tau_labelled_inversion
    (publicSubject offered outerBinder payload residualBinder : Name)
    {target : Raw.Proc}
    (step :
      Late.NativeStep
        (closeDirectCore
          publicSubject offered outerBinder payload residualBinder)
        .tau target) :
    ∃ normalizedBinder : Name,
      normalizedBinder ≠ offered ∧
      Late.Struct target
        (.new offered
          (pairProcess offered payload normalizedBinder)) := by
  unfold closeDirectCore outputThread inputThread at step
  cases step with
  | parLeft fresh leftStep =>
      cases leftStep with
      | restrict freshness inner =>
          cases inner
  | parRight fresh rightStep =>
      cases rightStep
  | syncLeft outputStep inputStep binderFresh =>
      cases outputStep with
      | restrict freshness inner =>
          cases inner
          exact False.elim
            (freshness (by simp [Raw.Action.names]))
  | syncRight inputStep outputStep binderFresh =>
      cases inputStep with
      | restrict freshness inner =>
          cases inner
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      cases outputStep with
      | restrict freshness inner =>
          cases inner
      | «open» distinct inner =>
          cases inner
          cases inputStep
          have outer_ne_offered : outerBinder ≠ offered := by
            intro equality
            subst outerBinder
            exact binderFresh (by simp [Raw.Proc.freeNames])
          rcases inputContinuation_total_struct
              outerBinder offered residualBinder outer_ne_offered with
            ⟨normalizedBinder, normalized_ne_offered, normalized⟩
          refine ⟨normalizedBinder, normalized_ne_offered, ?_⟩
          simpa [pairProcess] using
            (Late.Struct.new
              (Late.Struct.par
                (Late.Struct.refl
                  (.send offered payload .zero : Raw.Proc))
                normalized))
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      cases inputStep with
      | restrict freshness inner =>
          cases inner

/-- Input-left mirror of `closeDirect_native_tau_labelled_inversion`. -/
theorem closeCrossed_native_tau_labelled_inversion
    (publicSubject offered outerBinder payload residualBinder : Name)
    {target : Raw.Proc}
    (step :
      Late.NativeStep
        (closeCrossedCore
          publicSubject offered outerBinder payload residualBinder)
        .tau target) :
    ∃ normalizedBinder : Name,
      normalizedBinder ≠ offered ∧
      Late.Struct target
        (.new offered
          (pairProcess offered payload normalizedBinder)) := by
  unfold closeCrossedCore outputThread inputThread at step
  cases step with
  | parLeft fresh leftStep =>
      cases leftStep
  | parRight fresh rightStep =>
      cases rightStep with
      | restrict freshness inner =>
          cases inner
  | syncLeft outputStep inputStep binderFresh =>
      cases outputStep
  | syncRight inputStep outputStep binderFresh =>
      cases inputStep
      cases outputStep with
      | restrict freshness inner =>
          cases inner
          exact False.elim
            (freshness (by simp [Raw.Action.names]))
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      cases outputStep
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      cases inputStep
      cases outputStep with
      | restrict freshness inner =>
          cases inner
      | «open» distinct inner =>
          cases inner
          have outer_ne_offered : outerBinder ≠ offered := by
            intro equality
            subst outerBinder
            exact binderFresh (by simp [Raw.Proc.freeNames])
          rcases inputContinuation_total_struct
              outerBinder offered residualBinder outer_ne_offered with
            ⟨normalizedBinder, normalized_ne_offered, normalized⟩
          refine ⟨normalizedBinder, normalized_ne_offered, ?_⟩
          apply Late.Struct.new
          apply Late.Struct.trans
            (Late.Struct.par normalized
              (Late.Struct.refl
                (.send offered payload .zero : Raw.Proc)))
          simpa [pairProcess] using
            (Late.Struct.parComm :
              Late.Struct
                (.par
                  (.recv offered normalizedBinder .zero)
                  (.send offered payload .zero))
                (.par
                  (.send offered payload .zero)
                  (.recv offered normalizedBinder .zero)))

/-!
## Exact scope boundary

The results above are intentionally conditional on an exact labelled core.
`AugmentedRequestingFingerprint` alone cannot determine whether the two
length-two threads have polarity words `output-output` / `input-input` or the
crossed `output-input` / `input-output`: both have the same two polarity
counts and the same one output-link/one input-link counts.  The final P1b
reflection theorem therefore still needs a source-orbit incidence lemma which
connects an arbitrary structural representative to one of the four labelled
cores.  Once that lemma is supplied, the native residual and the slow
freshening branch are closed by the theorems in this file.
-/

/-! ### A finite counterexample to exact polarity-word recovery -/

/--
The aggregate fingerprint does not record which polarity owns the residual
payload prefix.  This process swaps the two guarded continuation polarities:
the output-headed thread continues with an input and the input-headed thread
continues with the payload output.
-/
def crossedPolarityRequesting : Raw.Proc :=
  .new publicName
    (.new session
      (.par
        (.send publicName session
          (.recv session payloadBinder .zero))
        (.recv publicName sessionBinder
          (.send sessionBinder payload .zero))))

/-- The crossed-polarity process has the complete nine-field fingerprint. -/
theorem crossedPolarityRequesting_augmentedFingerprint :
    P1bRequestingFingerprint.AugmentedRequestingFingerprint
      crossedPolarityRequesting := by
  refine {
    headPrefixCount_eq := ?_
    topThreadSquareMass_eq := ?_
    choicePotential_eq := ?_
    sendPrefixCount_eq := ?_
    recvPrefixCount_eq := ?_
    outputLinkCount_eq := ?_
    inputLinkCount_eq := ?_
    freeNames_eq := ?_
    freeSubjects_eq := ?_
  } <;>
    norm_num [crossedPolarityRequesting,
      Raw.Proc.headPrefixCount, Raw.Proc.topThreadSquareMass,
      Raw.Proc.choicePotential, Raw.Proc.sendPrefixCount,
      Raw.Proc.recvPrefixCount, Raw.Proc.outputLinkCount,
      Raw.Proc.inputLinkCount, Raw.Proc.subjectLink,
      Raw.Proc.prefixCount, Raw.Proc.freeNames,
      Raw.Proc.freeSubjects, publicName, session, sessionBinder,
      payload, payloadBinder] <;>
    decide

/-- It is not the exact canonical requesting syntax. -/
theorem crossedPolarityRequesting_ne_canonical :
    crossedPolarityRequesting ≠
      P1bRequestingFingerprint.canonicalRequesting := by
  norm_num [crossedPolarityRequesting,
    P1bRequestingFingerprint.canonicalRequesting,
    closedRestrictedHandshake, restrictedHandshake,
    request, accept, requestContinuation, acceptContinuation,
    Proc.erase, publicChannel, sessionChannel, boundSessionChannel,
    publicName, session, sessionBinder, payload, payloadBinder]
  decide

/--
Despite that source-side ambiguity, its actual native communication has the
same labelled residual: output value `payload`, and both residual subjects
`session`, modulo the single parallel swap.
-/
theorem crossedPolarityRequesting_native_tau :
    Late.NativeStep crossedPolarityRequesting .tau
      (.new publicName
        (.new session
          (.par
            (.recv session payloadBinder .zero)
            (.send session payload .zero)))) := by
  unfold crossedPolarityRequesting
  apply Late.NativeStep.restrict
    (by simp [Raw.Action.names])
  apply Late.NativeStep.restrict
    (by simp [Raw.Action.names])
  apply Late.NativeStep.syncLeft
      Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
  simp [Raw.Proc.freeNames, sessionBinder, session]

end Cantilune.Pi.P1bLabelledThreadInversion
