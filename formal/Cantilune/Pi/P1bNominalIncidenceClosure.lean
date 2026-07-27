import Cantilune.Pi.P1bNominalIncidenceProof

/-!
# Closing the P1b nominal-incidence support transfer

This file discharges the four native communication cases left by
`RequestingSplitSupportTransfer`.  The proof reasons from the actual labelled
derivations and the canonical source orbit.  It does not assume a canonical
endpoint, a linked residual, or a weak transition.
-/

namespace Cantilune.Pi.P1bNominalIncidenceClosure

open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bRequestingNominalOrbit
open Cantilune.Pi.P1bTwoThreadExtraction
open Cantilune.Pi.P1bTwoThreadNativeInversion
open Cantilune.Pi.P1bLabelledThreadInversion
open Cantilune.Pi.P1bRequestingThreadPolarityClassifier
open Cantilune.Pi.P1bNominalIncidenceBoundary
open Cantilune.Pi.P1bNominalIncidenceProof

private theorem Late.NativeStep.source_sendPrefixCount_pos_of_outputLike
    (step : Late.NativeStep source action target)
    (outputLike :
      (∃ channel value, action = .output channel value) ∨
      (∃ channel value, action = .boundOutput channel value)) :
    0 < source.sendPrefixCount := by
  induction step <;>
    simp_all [Raw.Proc.sendPrefixCount]

private theorem output_left_polarities
    {left right target : Raw.Proc} {action : Raw.Action}
    (leftThread : TwoCommThread left)
    (polarities :
      (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
      (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
    (outputStep : Late.NativeStep left action target)
    (outputLike :
      (∃ channel value, action = .output channel value) ∨
      (∃ channel value, action = .boundOutput channel value)) :
    left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2 := by
  rcases polarities with direct | crossed
  · exact direct
  · have partition :=
      TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two leftThread
    have positive :=
      Late.NativeStep.source_sendPrefixCount_pos_of_outputLike
        outputStep outputLike
    omega

private theorem output_right_polarities
    {left right target : Raw.Proc} {action : Raw.Action}
    (rightThread : TwoCommThread right)
    (polarities :
      (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
      (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
    (outputStep : Late.NativeStep right action target)
    (outputLike :
      (∃ channel value, action = .output channel value) ∨
      (∃ channel value, action = .boundOutput channel value)) :
    left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2 := by
  rcases polarities with direct | crossed
  · have partition :=
      TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two rightThread
    have positive :=
      Late.NativeStep.source_sendPrefixCount_pos_of_outputLike
        outputStep outputLike
    omega
  · exact crossed

private theorem pair_freeNames
    (channel value binder : Name) :
    (pairProcess channel value binder).freeNames =
      insert channel {value} := by
  ext name
  simp [pairProcess, Raw.Proc.freeNames]
  aesop

private theorem wrapped_pair_support
    (binders : List Name)
    (core : Raw.Proc)
    (channel : Name)
    (channelMem : channel ∈ binders)
    (payloadNotMem : payload ∉ binders)
    (coreSupport : core.freeNames = insert channel {payload}) :
    (wrapNews binders core).freeNames = {payload} := by
  ext name
  rw [P1bRestrictionEnvelope.mem_freeNames_wrapNews_iff, coreSupport]
  simp only [Finset.mem_insert, Finset.mem_singleton]
  constructor
  · rintro ⟨notBound, rfl | rfl⟩
    · exact (notBound channelMem).elim
    · rfl
  · intro equality
    subst name
    exact ⟨payloadNotMem, Or.inr rfl⟩

private theorem wrapped_singleton_fresh
    (binders : List Name)
    (core : Raw.Proc)
    (payloadNotMem : payload ∉ binders)
    (coreSupport : core.freeNames = {payload}) :
    ∀ name, name ∈ binders → name ∉ core.freeNames := by
  intro name member free
  rw [coreSupport] at free
  have equality : name = payload := by
    simpa using free
  subst name
  exact payloadNotMem member

private theorem SplitSupportTransfer.transport
    {binders : List Name}
    {sourceTarget destinationTarget : Raw.Proc}
    (relation :
      Late.Struct
        (wrapNews binders destinationTarget)
        (wrapNews binders sourceTarget))
    (transfer : SplitSupportTransfer binders sourceTarget) :
    SplitSupportTransfer binders destinationTarget := by
  rcases transfer with
    ⟨residualChannel, outputResidual, inputResidual,
      outputThread, inputThread, outputOne, inputOne,
      channelNePayload, outputSubject, outputPayload,
      inputSubject, normalized⟩
  exact ⟨residualChannel, outputResidual, inputResidual,
    outputThread, inputThread, outputOne, inputOne,
    channelNePayload, outputSubject, outputPayload,
    inputSubject, Late.Struct.trans relation normalized⟩

/--
Exact support transfer for the ordinary output-left communication.  In this
case the offered session is one of the already-extracted outer restrictions.
-/
theorem splitSupportTransfer_syncLeft
    {binders : List Name}
    {left right leftTarget rightTarget : Raw.Proc}
    (leftThread : TwoCommThread left)
    (rightThread : TwoCommThread right)
    (polarities :
      (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
      (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
    (outputStep :
      Late.NativeStep left (.output subject offered) leftTarget)
    (inputStep :
      Late.NativeStep right (.input subject inputBinder) rightTarget)
    (_binderFresh : inputBinder ∉ leftTarget.freeNames)
    (canonical :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right))) :
    SplitSupportTransfer binders
      (.par leftTarget
        (rightTarget.substituteCaptureAvoiding inputBinder offered)) := by
  have oriented :=
    output_left_polarities leftThread polarities outputStep
      (Or.inl ⟨subject, offered, rfl⟩)
  have leftSend : left.sendPrefixCount = 2 := oriented.1
  have rightRecv : right.recvPrefixCount = 2 := oriented.2
  have leftPartition :=
    TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two leftThread
  have rightPartition :=
    TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two rightThread
  have leftRecv : left.recvPrefixCount = 0 := by omega
  have rightSend : right.sendPrefixCount = 0 := by omega
  have fingerprint :=
    augmentedFingerprint_of_struct_canonicalRequesting canonical
  have sourceValues :=
    freeOutputValues_of_struct_canonicalRequesting canonical
  have payloadWrapped :
      payload ∈
        (wrapNews binders (.par left right)).freeOutputValues := by
    rw [sourceValues]
    simp
  have payloadScoped :=
    (mem_freeOutputValues_wrapNews_iff
      payload binders (.par left right)).mp payloadWrapped
  have payloadNotMem : payload ∉ binders := payloadScoped.1
  have rightValues :
      right.freeOutputValues = ∅ :=
    freeOutputValues_eq_empty_of_sendPrefixCount_eq_zero
      right rightSend
  have payloadInLeft : payload ∈ left.freeOutputValues := by
    simpa [Raw.Proc.freeOutputValues, rightValues] using payloadScoped.2
  have outputThread :
      OneCommThread leftTarget :=
    TwoCommThread.target_oneCommThread leftThread outputStep
  have inputThreadRaw :
      OneCommThread rightTarget :=
    TwoCommThread.target_oneCommThread rightThread inputStep
  have inputThread :
      OneCommThread
        (rightTarget.substituteCaptureAvoiding inputBinder offered) :=
    OneCommThread.substituteCaptureAvoiding
      inputThreadRaw inputBinder offered
  have outputOne :
      leftTarget.sendPrefixCount = 1 :=
    TwoCommThread.target_sendPrefixCount_eq_one_of_output
      leftThread leftSend outputStep
  have inputOneRaw :
      rightTarget.recvPrefixCount = 1 :=
    TwoCommThread.target_recvPrefixCount_eq_one_of_input
      rightThread rightRecv inputStep
  have inputOne :
      (rightTarget.substituteCaptureAvoiding
        inputBinder offered).recvPrefixCount = 1 := by
    rw [Raw.Proc.recvPrefixCount_substituteCaptureAvoiding]
    exact inputOneRaw
  have totalOutputLinks :
      left.outputLinkCount + right.outputLinkCount = 1 := by
    simpa [Raw.Proc.outputLinkCount] using
      fingerprint.outputLinkCount_eq
  have rightOutputLinks : right.outputLinkCount = 0 :=
    outputLinkCount_eq_zero_of_sendPrefixCount_eq_zero
      right rightSend
  have leftOutputLinks : left.outputLinkCount = 1 := by omega
  have outputStepLinks :=
    TwoCommThread.outputLinkCount_step leftThread outputStep
  have outputResidualLinks :
      leftTarget.outputLinkCount = 0 :=
    OneCommThread.outputLinkCount_eq_zero outputThread
  have offeredLink :
      Raw.Proc.subjectLink offered leftTarget = 1 := by
    omega
  have outputSubject :
      offered ∈ leftTarget.freeSubjects := by
    simpa [Raw.Proc.subjectLink] using offeredLink
  have totalInputLinks :
      left.inputLinkCount + right.inputLinkCount = 1 := by
    simpa [Raw.Proc.inputLinkCount] using
      fingerprint.inputLinkCount_eq
  have leftInputLinks : left.inputLinkCount = 0 :=
    inputLinkCount_eq_zero_of_recvPrefixCount_eq_zero
      left leftRecv
  have rightInputLinks : right.inputLinkCount = 1 := by omega
  have inputStepLinks :=
    TwoCommThread.inputLinkCount_step rightThread inputStep
  have inputResidualLinks :
      rightTarget.inputLinkCount = 0 :=
    OneCommThread.inputLinkCount_eq_zero inputThreadRaw
  have binderLink :
      Raw.Proc.subjectLink inputBinder rightTarget = 1 := by
    omega
  have binderSubject :
      inputBinder ∈ rightTarget.freeSubjects := by
    simpa [Raw.Proc.subjectLink] using binderLink
  have inputSubject :
      offered ∈
        (rightTarget.substituteCaptureAvoiding
          inputBinder offered).freeSubjects :=
    OneCommThread.mem_freeSubjects_substituteCaptureAvoiding
      inputThreadRaw binderSubject
  have offeredSourceSubject :
      offered ∈ left.freeSubjects :=
    TwoCommThread.output_value_subject_back
      leftThread outputStep outputSubject
  have offeredNePayload : offered ≠ payload := by
    intro equality
    subst offered
    have wrappedSubject :
        payload ∈
          (wrapNews binders (.par left right)).freeSubjects :=
      (mem_freeSubjects_wrapNews_iff
        payload binders (.par left right)).2
        ⟨payloadNotMem, by
          simp [Raw.Proc.freeSubjects, offeredSourceSubject]⟩
    rw [fingerprint.freeSubjects_eq] at wrappedSubject
    simp at wrappedSubject
  have sourceOutputValues :=
    TwoCommThread.freeOutputValues_output_step leftThread outputStep
  have offeredInLeft : offered ∈ left.freeOutputValues := by
    rw [sourceOutputValues]
    simp
  have offeredMem : offered ∈ binders := by
    by_contra offeredNotMem
    have offeredWrapped :
        offered ∈
          (wrapNews binders (.par left right)).freeOutputValues :=
      (mem_freeOutputValues_wrapNews_iff
        offered binders (.par left right)).2
        ⟨offeredNotMem, by
          simp [Raw.Proc.freeOutputValues, offeredInLeft]⟩
    rw [sourceValues] at offeredWrapped
    have equality : offered = payload := by
      simpa using offeredWrapped
    exact offeredNePayload equality
  have outputPayload :
      payload ∈ leftTarget.freeOutputValues := by
    rw [sourceOutputValues] at payloadInLeft
    simpa [Ne.symm offeredNePayload] using payloadInLeft
  have outputNormal :
      Late.Struct leftTarget
        (.send offered payload .zero) :=
    OneCommThread.send_struct_of_support
      outputThread outputOne outputSubject outputPayload
  rcases OneCommThread.recv_struct_of_subject
      inputThread inputOne inputSubject with
    ⟨residualBinder, inputNormal⟩
  have coreNormal :
      Late.Struct
        (.par leftTarget
          (rightTarget.substituteCaptureAvoiding inputBinder offered))
        (pairProcess offered payload residualBinder) := by
    simpa [pairProcess] using
      Late.Struct.par outputNormal inputNormal
  have coreSupport :
      (Raw.Proc.par leftTarget
        (rightTarget.substituteCaptureAvoiding
          inputBinder offered)).freeNames =
        insert offered {payload} :=
    (Late.Struct.freeNames_eq coreNormal).trans
      (pair_freeNames offered payload residualBinder)
  have wrappedSupport :
      (wrapNews binders
        (.par leftTarget
          (rightTarget.substituteCaptureAvoiding
            inputBinder offered))).freeNames =
        {payload} :=
    wrapped_pair_support binders _ offered offeredMem
      payloadNotMem coreSupport
  let envelope :=
    P1bRestrictionEnvelope.singleEnvelopeDecomposition
      binders
      (.par leftTarget
        (rightTarget.substituteCaptureAvoiding inputBinder offered))
      offered payload offeredNePayload coreSupport wrappedSupport
  refine ⟨offered, leftTarget,
    rightTarget.substituteCaptureAvoiding inputBinder offered,
    outputThread, inputThread, outputOne, inputOne,
    offeredNePayload, outputSubject, outputPayload, inputSubject, ?_⟩
  simpa [wrapNews] using envelope.normalized

/--
The ordinary input-left communication is the structural mirror of
`splitSupportTransfer_syncLeft`.  The actual target is transported only by
parallel commutativity; the native derivations themselves are not changed.
-/
theorem splitSupportTransfer_syncRight
    {binders : List Name}
    {left right leftTarget rightTarget : Raw.Proc}
    (leftThread : TwoCommThread left)
    (rightThread : TwoCommThread right)
    (polarities :
      (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
      (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
    (inputStep :
      Late.NativeStep left (.input subject inputBinder) leftTarget)
    (outputStep :
      Late.NativeStep right (.output subject offered) rightTarget)
    (binderFresh : inputBinder ∉ rightTarget.freeNames)
    (canonical :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right))) :
    SplitSupportTransfer binders
      (.par
        (leftTarget.substituteCaptureAvoiding inputBinder offered)
        rightTarget) := by
  have mirroredCanonical :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par right left)) :=
    Late.Struct.trans canonical
      (P1bLinkedEndpointNormalization.wrapNews_struct binders
        (Late.Struct.parComm :
          Late.Struct (.par left right) (.par right left)))
  have mirroredPolarities :
      (right.sendPrefixCount = 2 ∧ left.recvPrefixCount = 2) ∨
      (right.recvPrefixCount = 2 ∧ left.sendPrefixCount = 2) := by
    rcases polarities with direct | crossed
    · exact Or.inr ⟨direct.2, direct.1⟩
    · exact Or.inl ⟨crossed.2, crossed.1⟩
  have mirrored :=
    splitSupportTransfer_syncLeft
      rightThread leftThread mirroredPolarities
      outputStep inputStep binderFresh mirroredCanonical
  apply SplitSupportTransfer.transport
    (sourceTarget :=
      .par rightTarget
        (leftTarget.substituteCaptureAvoiding inputBinder offered))
    (destinationTarget :=
      .par
        (leftTarget.substituteCaptureAvoiding inputBinder offered)
        rightTarget)
  · exact
      P1bLinkedEndpointNormalization.wrapNews_struct binders
        (Late.Struct.parComm :
          Late.Struct
            (.par
              (leftTarget.substituteCaptureAvoiding inputBinder offered)
              rightTarget)
            (.par rightTarget
              (leftTarget.substituteCaptureAvoiding inputBinder offered)))
  · exact mirrored

/--
Exact support transfer for the native output-left `open`/`close` rule.  The
session restriction is introduced by the target rule itself, so every outer
restriction is fresh for the closed residual and can be removed.
-/
theorem splitSupportTransfer_closeLeft
    {binders : List Name}
    {left right leftTarget rightTarget : Raw.Proc}
    (leftThread : TwoCommThread left)
    (rightThread : TwoCommThread right)
    (polarities :
      (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
      (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
    (outputStep :
      Late.NativeStep left (.boundOutput subject offered) leftTarget)
    (inputStep :
      Late.NativeStep right (.input subject inputBinder) rightTarget)
    (_freshForReceiver : offered ∉ right.freeNames)
    (_binderFresh : inputBinder ∉ leftTarget.freeNames)
    (canonical :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right))) :
    SplitSupportTransfer binders
      (.new offered
        (.par leftTarget
          (rightTarget.substituteCaptureAvoiding inputBinder offered))) := by
  have oriented :=
    output_left_polarities leftThread polarities outputStep
      (Or.inr ⟨subject, offered, rfl⟩)
  have leftSend : left.sendPrefixCount = 2 := oriented.1
  have rightRecv : right.recvPrefixCount = 2 := oriented.2
  have leftPartition :=
    TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two leftThread
  have rightPartition :=
    TwoCommThread.sendPrefixCount_add_recvPrefixCount_eq_two rightThread
  have leftRecv : left.recvPrefixCount = 0 := by omega
  have rightSend : right.sendPrefixCount = 0 := by omega
  have fingerprint :=
    augmentedFingerprint_of_struct_canonicalRequesting canonical
  have sourceValues :=
    freeOutputValues_of_struct_canonicalRequesting canonical
  have payloadWrapped :
      payload ∈
        (wrapNews binders (.par left right)).freeOutputValues := by
    rw [sourceValues]
    simp
  have payloadScoped :=
    (mem_freeOutputValues_wrapNews_iff
      payload binders (.par left right)).mp payloadWrapped
  have payloadNotMem : payload ∉ binders := payloadScoped.1
  have rightValues :
      right.freeOutputValues = ∅ :=
    freeOutputValues_eq_empty_of_sendPrefixCount_eq_zero
      right rightSend
  have payloadInLeft : payload ∈ left.freeOutputValues := by
    simpa [Raw.Proc.freeOutputValues, rightValues] using payloadScoped.2
  have outputThread :
      OneCommThread leftTarget :=
    TwoCommThread.target_oneCommThread leftThread outputStep
  have inputThreadRaw :
      OneCommThread rightTarget :=
    TwoCommThread.target_oneCommThread rightThread inputStep
  have inputThread :
      OneCommThread
        (rightTarget.substituteCaptureAvoiding inputBinder offered) :=
    OneCommThread.substituteCaptureAvoiding
      inputThreadRaw inputBinder offered
  have outputOne :
      leftTarget.sendPrefixCount = 1 :=
    TwoCommThread.target_sendPrefixCount_eq_one_of_boundOutput
      leftThread leftSend outputStep
  have inputOneRaw :
      rightTarget.recvPrefixCount = 1 :=
    TwoCommThread.target_recvPrefixCount_eq_one_of_input
      rightThread rightRecv inputStep
  have inputOne :
      (rightTarget.substituteCaptureAvoiding
        inputBinder offered).recvPrefixCount = 1 := by
    rw [Raw.Proc.recvPrefixCount_substituteCaptureAvoiding]
    exact inputOneRaw
  have totalOutputLinks :
      left.outputLinkCount + right.outputLinkCount = 1 := by
    simpa [Raw.Proc.outputLinkCount] using
      fingerprint.outputLinkCount_eq
  have rightOutputLinks : right.outputLinkCount = 0 :=
    outputLinkCount_eq_zero_of_sendPrefixCount_eq_zero
      right rightSend
  have leftOutputLinks : left.outputLinkCount = 1 := by omega
  have outputStepLinks :=
    TwoCommThread.boundOutputLinkCount_step leftThread outputStep
  have outputResidualLinks :
      leftTarget.outputLinkCount = 0 :=
    OneCommThread.outputLinkCount_eq_zero outputThread
  have offeredLink :
      Raw.Proc.subjectLink offered leftTarget = 1 := by
    omega
  have outputSubject :
      offered ∈ leftTarget.freeSubjects := by
    simpa [Raw.Proc.subjectLink] using offeredLink
  have totalInputLinks :
      left.inputLinkCount + right.inputLinkCount = 1 := by
    simpa [Raw.Proc.inputLinkCount] using
      fingerprint.inputLinkCount_eq
  have leftInputLinks : left.inputLinkCount = 0 :=
    inputLinkCount_eq_zero_of_recvPrefixCount_eq_zero
      left leftRecv
  have rightInputLinks : right.inputLinkCount = 1 := by omega
  have inputStepLinks :=
    TwoCommThread.inputLinkCount_step rightThread inputStep
  have inputResidualLinks :
      rightTarget.inputLinkCount = 0 :=
    OneCommThread.inputLinkCount_eq_zero inputThreadRaw
  have binderLink :
      Raw.Proc.subjectLink inputBinder rightTarget = 1 := by
    omega
  have binderSubject :
      inputBinder ∈ rightTarget.freeSubjects := by
    simpa [Raw.Proc.subjectLink] using binderLink
  have inputSubject :
      offered ∈
        (rightTarget.substituteCaptureAvoiding
          inputBinder offered).freeSubjects :=
    OneCommThread.mem_freeSubjects_substituteCaptureAvoiding
      inputThreadRaw binderSubject
  have sourceOutputValues :=
    TwoCommThread.freeOutputValues_boundOutput_step
      leftThread outputStep
  have payloadErased :
      payload ∈ leftTarget.freeOutputValues.erase offered := by
    rw [← sourceOutputValues]
    exact payloadInLeft
  have payloadNeOffered : payload ≠ offered :=
    (Finset.mem_erase.mp payloadErased).1
  have offeredNePayload : offered ≠ payload :=
    Ne.symm payloadNeOffered
  have outputPayload :
      payload ∈ leftTarget.freeOutputValues :=
    (Finset.mem_erase.mp payloadErased).2
  have outputNormal :
      Late.Struct leftTarget
        (.send offered payload .zero) :=
    OneCommThread.send_struct_of_support
      outputThread outputOne outputSubject outputPayload
  rcases OneCommThread.recv_struct_of_subject
      inputThread inputOne inputSubject with
    ⟨residualBinder, inputNormal⟩
  have coreNormal :
      Late.Struct
        (.par leftTarget
          (rightTarget.substituteCaptureAvoiding inputBinder offered))
        (pairProcess offered payload residualBinder) := by
    simpa [pairProcess] using
      Late.Struct.par outputNormal inputNormal
  have closedNormal :
      Late.Struct
        (.new offered
          (.par leftTarget
            (rightTarget.substituteCaptureAvoiding inputBinder offered)))
        (.new offered
          (pairProcess offered payload residualBinder)) :=
    Late.Struct.new coreNormal
  have exactClosedSupport :
      (Raw.Proc.new offered
        (pairProcess offered payload residualBinder)).freeNames =
        {payload} := by
    rw [Raw.Proc.freeNames, pair_freeNames]
    ext name
    simp [offeredNePayload]
  have closedSupport :
      (Raw.Proc.new offered
        (.par leftTarget
          (rightTarget.substituteCaptureAvoiding
            inputBinder offered))).freeNames =
        {payload} :=
    (Late.Struct.freeNames_eq closedNormal).trans exactClosedSupport
  have allOuterFresh :=
    wrapped_singleton_fresh binders
      (.new offered
        (.par leftTarget
          (rightTarget.substituteCaptureAvoiding
            inputBinder offered)))
      payloadNotMem closedSupport
  have outerNormal :
      Late.Struct
        (wrapNews binders
          (.new offered
            (.par leftTarget
              (rightTarget.substituteCaptureAvoiding
                inputBinder offered))))
        (.new offered
          (.par leftTarget
            (rightTarget.substituteCaptureAvoiding
              inputBinder offered))) :=
    P1bLinkedEndpointNormalization.wrapNews_all_fresh_normalizes
      binders _ allOuterFresh
  exact ⟨offered, leftTarget,
    rightTarget.substituteCaptureAvoiding inputBinder offered,
    outputThread, inputThread, outputOne, inputOne,
    offeredNePayload, outputSubject, outputPayload, inputSubject,
    outerNormal⟩

/--
The input-left `open`/`close` case follows from the output-left case by the
same structural mirror used for ordinary synchronization.
-/
theorem splitSupportTransfer_closeRight
    {binders : List Name}
    {left right leftTarget rightTarget : Raw.Proc}
    (leftThread : TwoCommThread left)
    (rightThread : TwoCommThread right)
    (polarities :
      (left.sendPrefixCount = 2 ∧ right.recvPrefixCount = 2) ∨
      (left.recvPrefixCount = 2 ∧ right.sendPrefixCount = 2))
    (inputStep :
      Late.NativeStep left (.input subject inputBinder) leftTarget)
    (outputStep :
      Late.NativeStep right (.boundOutput subject offered) rightTarget)
    (freshForReceiver : offered ∉ left.freeNames)
    (binderFresh : inputBinder ∉ rightTarget.freeNames)
    (canonical :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par left right))) :
    SplitSupportTransfer binders
      (.new offered
        (.par
          (leftTarget.substituteCaptureAvoiding inputBinder offered)
          rightTarget)) := by
  have mirroredCanonical :
      Late.Struct canonicalRequesting
        (wrapNews binders (.par right left)) :=
    Late.Struct.trans canonical
      (P1bLinkedEndpointNormalization.wrapNews_struct binders
        (Late.Struct.parComm :
          Late.Struct (.par left right) (.par right left)))
  have mirroredPolarities :
      (right.sendPrefixCount = 2 ∧ left.recvPrefixCount = 2) ∨
      (right.recvPrefixCount = 2 ∧ left.sendPrefixCount = 2) := by
    rcases polarities with direct | crossed
    · exact Or.inr ⟨direct.2, direct.1⟩
    · exact Or.inl ⟨crossed.2, crossed.1⟩
  have mirrored :=
    splitSupportTransfer_closeLeft
      rightThread leftThread mirroredPolarities
      outputStep inputStep freshForReceiver binderFresh mirroredCanonical
  apply SplitSupportTransfer.transport
    (sourceTarget :=
      .new offered
        (.par rightTarget
          (leftTarget.substituteCaptureAvoiding inputBinder offered)))
    (destinationTarget :=
      .new offered
        (.par
          (leftTarget.substituteCaptureAvoiding inputBinder offered)
          rightTarget))
  · exact
      P1bLinkedEndpointNormalization.wrapNews_struct binders
        (Late.Struct.new
          (Late.Struct.parComm :
            Late.Struct
              (.par
                (leftTarget.substituteCaptureAvoiding inputBinder offered)
                rightTarget)
              (.par rightTarget
                (leftTarget.substituteCaptureAvoiding
                  inputBinder offered))))
  · exact mirrored

/--
All four constructors of the genuine split derivation satisfy the exact
wrapped-support transfer.
-/
theorem requestingSplitSupportTransfer :
    RequestingSplitSupportTransfer := by
  intro binders left right splitTarget
    leftThread rightThread polarities communication canonical
  cases communication with
  | syncLeft outputStep inputStep binderFresh =>
      exact splitSupportTransfer_syncLeft
        leftThread rightThread polarities outputStep inputStep
        binderFresh canonical
  | syncRight inputStep outputStep binderFresh =>
      exact splitSupportTransfer_syncRight
        leftThread rightThread polarities inputStep outputStep
        binderFresh canonical
  | closeLeft outputStep inputStep freshForReceiver binderFresh =>
      exact splitSupportTransfer_closeLeft
        leftThread rightThread polarities outputStep inputStep
        freshForReceiver binderFresh canonical
  | closeRight inputStep outputStep freshForReceiver binderFresh =>
      exact splitSupportTransfer_closeRight
        leftThread rightThread polarities inputStep outputStep
        freshForReceiver binderFresh canonical

/--
The final non-circular nominal-incidence boundary is now inhabited.
-/
theorem requestingPolarizedNominalIncidence :
    RequestingPolarizedNominalIncidence :=
  requestingPolarizedNominalIncidence_of_splitSupportTransfer
    requestingSplitSupportTransfer

/--
Exact one-native-step residual classification for the requesting state.
-/
theorem requestingNativeResidual :
    P1bRequestingReflectionClosure.RequestingNativeResidual :=
  requestingNativeResidual_of_polarizedNominalIncidence
    requestingPolarizedNominalIncidence

/--
Full standard late reflection for the finite request/accept reference
calculus.
-/
theorem standardLateReflection :
    P1bStructuralLateBridge.StandardLateReflection :=
  P1bRequestingReflectionClosure.standardLateReflection_of_requestingNativeResidual
    requestingNativeResidual

/--
The completed request/accept projection certificate.  Its reflection field is
the theorem above; no endpoint classifier remains as an argument.
-/
def pi_ra_certificate :
    Core.ProjectionCertificate
      Certificates.RequestAccept.sourceLTS
      Late.structuralLateLTS :=
  P1bStructuralLateBridge.certificateOfReflection
    standardLateReflection

/-- Backward-compatible camel-case spelling for downstream experiments. -/
abbrev piRA_certificate :=
  pi_ra_certificate

end Cantilune.Pi.P1bNominalIncidenceClosure
