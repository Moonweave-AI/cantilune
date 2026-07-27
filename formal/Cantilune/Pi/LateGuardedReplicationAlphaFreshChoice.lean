import Cantilune.Pi.LateGuardedReplicationAlphaOperational

/-!
# Fresh-choice alpha uniqueness for guarded recursive substitution

The executable substitution chooses natural-number binders by `sup + 1`.
Literal permutation equivariance is therefore false.  This module proves the
nominal statement by induction on the substitution fuel: all discrepancies
between deterministic fresh choices are discharged through a common name
fresh for both derivatives.

No weak transition or tau closure is used.
-/

namespace Cantilune.Pi

namespace RecursivePermutation

@[simp]
private theorem swap_apply_eq_if_of_right_fresh
    (source replacement candidate : Name)
    (fresh : replacement ≠ candidate) :
    Equiv.swap source replacement candidate =
      if candidate = source then replacement else candidate := by
  simp [Equiv.swap_apply_def, Ne.symm fresh]

/-- A permutation fixing every complete syntactic name fixes the process. -/
theorem process_eq_self_of_allNames_fixed
    (permutation : Equiv.Perm Name) (processValue : RecursiveProc)
    (fixed :
      ∀ name, name ∈ processValue.allNames →
        permutation name = name) :
    process permutation processValue = processValue := by
  induction processValue <;>
    simp_all [process, RecursiveProc.allNames]

/--
Swapping one name with a globally fresh name has the same effect as raw free
substitution up to alpha.  Literal equality is false when the source is also
the spelling of a nested binder: global permutation renames that declaration,
whereas free substitution stops at it.
-/
theorem process_swap_fresh_alpha_substRaw
    (processValue : RecursiveProc) (source replacement : Name)
    (fresh : replacement ∉ processValue.allNames) :
    RecursiveAlpha
      (process (Equiv.swap source replacement) processValue)
      (processValue.substRaw source replacement) := by
  induction processValue with
  | zero =>
      exact RecursiveAlpha.refl _
  | tau next inductionHypothesis =>
      simpa [process, RecursiveProc.substRaw,
        RecursiveProc.allNames] using
        RecursiveAlpha.tau (inductionHypothesis fresh)
  | send channel value next inductionHypothesis =>
      simp only [RecursiveProc.allNames, Finset.mem_insert,
        not_or] at fresh
      simpa [process, RecursiveProc.substRaw,
        swap_apply_eq_if_of_right_fresh,
        fresh.1, fresh.2.1] using
        RecursiveAlpha.send (inductionHypothesis fresh.2.2)
  | recv channel binder next inductionHypothesis =>
      simp only [RecursiveProc.allNames, Finset.mem_insert,
        not_or] at fresh
      rcases fresh with ⟨channelFresh, binderFresh, nextFresh⟩
      by_cases stops : binder = source
      · subst binder
        have bodyRelation := inductionHypothesis nextFresh
        have binderRelation :
            RecursiveAlpha
              (.recv
                (if channel = source then replacement else channel)
                source next)
              (.recv
                (if channel = source then replacement else channel)
                replacement
                (next.renameBound source replacement)) :=
          RecursiveAlpha.recvBinder nextFresh
        have firstRelation :
            RecursiveAlpha
              (.recv
                (Equiv.swap source replacement channel)
                replacement
                (process (Equiv.swap source replacement) next))
              (.recv
                (if channel = source then replacement else channel)
                replacement
                (next.renameBound source replacement)) := by
          simpa [RecursiveProc.renameBound,
            swap_apply_eq_if_of_right_fresh,
            channelFresh] using
            RecursiveAlpha.recv bodyRelation
        simpa [process, RecursiveProc.substRaw,
          swap_apply_eq_if_of_right_fresh, channelFresh] using
          RecursiveAlpha.trans firstRelation
            (RecursiveAlpha.symm binderRelation)
      · simpa [process, RecursiveProc.substRaw,
          swap_apply_eq_if_of_right_fresh,
          channelFresh, binderFresh,
          stops] using
          RecursiveAlpha.recv (inductionHypothesis nextFresh)
  | choice left right leftIH rightIH =>
      simp only [RecursiveProc.allNames, Finset.mem_union,
        not_or] at fresh
      simpa [process, RecursiveProc.substRaw] using
        RecursiveAlpha.choice
          (leftIH fresh.1) (rightIH fresh.2)
  | par left right leftIH rightIH =>
      simp only [RecursiveProc.allNames, Finset.mem_union,
        not_or] at fresh
      simpa [process, RecursiveProc.substRaw] using
        RecursiveAlpha.par
          (leftIH fresh.1) (rightIH fresh.2)
  | new binder body inductionHypothesis =>
      simp only [RecursiveProc.allNames, Finset.mem_insert,
        not_or] at fresh
      rcases fresh with ⟨binderFresh, bodyFresh⟩
      by_cases stops : binder = source
      · subst binder
        have bodyRelation := inductionHypothesis bodyFresh
        have binderRelation :
            RecursiveAlpha
              (.new source body)
              (.new replacement
                (body.renameBound source replacement)) :=
          RecursiveAlpha.newBinder bodyFresh
        have firstRelation :
            RecursiveAlpha
              (.new replacement
                (process (Equiv.swap source replacement) body))
              (.new replacement
                (body.renameBound source replacement)) := by
          simpa [RecursiveProc.renameBound] using
            RecursiveAlpha.new bodyRelation
        simpa [process, RecursiveProc.substRaw] using
          RecursiveAlpha.trans firstRelation
            (RecursiveAlpha.symm binderRelation)
      · simpa [process, RecursiveProc.substRaw,
          swap_apply_eq_if_of_right_fresh,
          binderFresh, stops] using
          RecursiveAlpha.new (inductionHypothesis bodyFresh)
  | matchEq left right next inductionHypothesis =>
      simp only [RecursiveProc.allNames, Finset.mem_insert,
        not_or] at fresh
      simpa [process, RecursiveProc.substRaw,
        swap_apply_eq_if_of_right_fresh,
        fresh.1, fresh.2.1] using
        RecursiveAlpha.matchEq (inductionHypothesis fresh.2.2)
  | matchNe left right next inductionHypothesis =>
      simp only [RecursiveProc.allNames, Finset.mem_insert,
        not_or] at fresh
      simpa [process, RecursiveProc.substRaw,
        swap_apply_eq_if_of_right_fresh,
        fresh.1, fresh.2.1] using
        RecursiveAlpha.matchNe (inductionHypothesis fresh.2.2)
  | repTau body inductionHypothesis =>
      simpa [process, RecursiveProc.substRaw,
        RecursiveProc.allNames] using
        RecursiveAlpha.repTau (inductionHypothesis fresh)
  | repSend channel value body inductionHypothesis =>
      simp only [RecursiveProc.allNames, Finset.mem_insert,
        not_or] at fresh
      simpa [process, RecursiveProc.substRaw,
        swap_apply_eq_if_of_right_fresh,
        fresh.1, fresh.2.1] using
        RecursiveAlpha.repSend (inductionHypothesis fresh.2.2)
  | repRecv channel binder body inductionHypothesis =>
      simp only [RecursiveProc.allNames, Finset.mem_insert,
        not_or] at fresh
      rcases fresh with ⟨channelFresh, binderFresh, bodyFresh⟩
      by_cases stops : binder = source
      · subst binder
        have bodyRelation := inductionHypothesis bodyFresh
        have binderRelation :
            RecursiveAlpha
              (.repRecv
                (if channel = source then replacement else channel)
                source body)
              (.repRecv
                (if channel = source then replacement else channel)
                replacement
                (body.renameBound source replacement)) :=
          RecursiveAlpha.repRecvBinder bodyFresh
        have firstRelation :
            RecursiveAlpha
              (.repRecv
                (Equiv.swap source replacement channel)
                replacement
                (process (Equiv.swap source replacement) body))
              (.repRecv
                (if channel = source then replacement else channel)
                replacement
                (body.renameBound source replacement)) := by
          simpa [RecursiveProc.renameBound,
            swap_apply_eq_if_of_right_fresh,
            channelFresh] using
            RecursiveAlpha.repRecv bodyRelation
        simpa [process, RecursiveProc.substRaw,
          swap_apply_eq_if_of_right_fresh, channelFresh] using
          RecursiveAlpha.trans firstRelation
            (RecursiveAlpha.symm binderRelation)
      · simpa [process, RecursiveProc.substRaw,
          swap_apply_eq_if_of_right_fresh,
          channelFresh, binderFresh,
          stops] using
          RecursiveAlpha.repRecv (inductionHypothesis bodyFresh)

/--
Two fresh spellings of an immediately enclosing binder are connected by the
literal swap of those spellings.
-/
theorem process_swap_renameBound
    (body : RecursiveProc) (binder source replacement : Name)
    (sourceFresh : source ∉ body.allNames)
    (replacementFresh : replacement ∉ body.allNames)
    (binderNeSource : binder ≠ source)
    (binderNeReplacement : binder ≠ replacement) :
    process (Equiv.swap source replacement)
        (body.renameBound binder source) =
      body.renameBound binder replacement := by
  rw [process_renameBound]
  rw [process_eq_self_of_allNames_fixed]
  · simp [Equiv.swap_apply_of_ne_of_ne
      binderNeSource binderNeReplacement]
  · intro name member
    apply Equiv.swap_apply_of_ne_of_ne
    · intro equality
      subst name
      exact sourceFresh member
    · intro equality
      subst name
      exact replacementFresh member

end RecursivePermutation

namespace RecursiveAlpha

/-- Align two restriction binders through one name fresh for both bodies. -/
theorem new_of_common_fresh
    (leftBinder rightBinder common : Name)
    (leftBody rightBody : RecursiveProc)
    (commonFreshLeft : common ∉ leftBody.allNames)
    (commonFreshRight : common ∉ rightBody.allNames)
    (bodyRelation :
      RecursiveAlpha
        (leftBody.renameBound leftBinder common)
        (rightBody.renameBound rightBinder common)) :
    RecursiveAlpha
      (.new leftBinder leftBody)
      (.new rightBinder rightBody) := by
  exact RecursiveAlpha.trans
    (RecursiveAlpha.newBinder commonFreshLeft)
    (RecursiveAlpha.trans
      (RecursiveAlpha.new bodyRelation)
      (RecursiveAlpha.symm
        (RecursiveAlpha.newBinder commonFreshRight)))

/-- Align two input binders through one name fresh for both derivatives. -/
theorem recv_of_common_fresh
    (channel leftBinder rightBinder common : Name)
    (leftBody rightBody : RecursiveProc)
    (commonFreshLeft : common ∉ leftBody.allNames)
    (commonFreshRight : common ∉ rightBody.allNames)
    (bodyRelation :
      RecursiveAlpha
        (leftBody.renameBound leftBinder common)
        (rightBody.renameBound rightBinder common)) :
    RecursiveAlpha
      (.recv channel leftBinder leftBody)
      (.recv channel rightBinder rightBody) := by
  exact RecursiveAlpha.trans
    (RecursiveAlpha.recvBinder commonFreshLeft)
    (RecursiveAlpha.trans
      (RecursiveAlpha.recv bodyRelation)
      (RecursiveAlpha.symm
        (RecursiveAlpha.recvBinder commonFreshRight)))

/--
Align two guarded replicated-input binders through one name fresh for both
derivatives.
-/
theorem repRecv_of_common_fresh
    (channel leftBinder rightBinder common : Name)
    (leftBody rightBody : RecursiveProc)
    (commonFreshLeft : common ∉ leftBody.allNames)
    (commonFreshRight : common ∉ rightBody.allNames)
    (bodyRelation :
      RecursiveAlpha
        (leftBody.renameBound leftBinder common)
        (rightBody.renameBound rightBinder common)) :
    RecursiveAlpha
      (.repRecv channel leftBinder leftBody)
      (.repRecv channel rightBinder rightBody) := by
  exact RecursiveAlpha.trans
    (RecursiveAlpha.repRecvBinder commonFreshLeft)
    (RecursiveAlpha.trans
      (RecursiveAlpha.repRecv bodyRelation)
      (RecursiveAlpha.symm
        (RecursiveAlpha.repRecvBinder commonFreshRight)))

end RecursiveAlpha

namespace RecursiveProc

/-- Carrier used to choose a name fresh for two results and one source body. -/
def alphaCommonCarrier
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder : Name) : RecursiveProc :=
  .send leftBinder rightBinder
    (.par (.par leftResult rightResult) sourceBody)

/-- One deterministic name fresh for both results, source, and two binders. -/
def alphaCommonFresh
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) : Name :=
  (alphaCommonCarrier leftResult rightResult sourceBody
    leftBinder rightBinder).freshName needle replacement

theorem alphaCommonFresh_not_mem_left
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    alphaCommonFresh leftResult rightResult sourceBody
        leftBinder rightBinder needle replacement ∉
      leftResult.allNames := by
  intro member
  have member' :
      (alphaCommonCarrier leftResult rightResult sourceBody
          leftBinder rightBinder).freshName needle replacement ∈
        leftResult.allNames := by
    simpa [alphaCommonFresh] using member
  exact
    (freshName_not_mem_allNames
      (alphaCommonCarrier leftResult rightResult sourceBody
        leftBinder rightBinder) needle replacement)
      (by
        simp only [alphaCommonCarrier, allNames,
          Finset.mem_insert, Finset.mem_union]
        exact Or.inr (Or.inr (Or.inl (Or.inl member'))))

theorem alphaCommonFresh_not_mem_right
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    alphaCommonFresh leftResult rightResult sourceBody
        leftBinder rightBinder needle replacement ∉
      rightResult.allNames := by
  intro member
  have member' :
      (alphaCommonCarrier leftResult rightResult sourceBody
          leftBinder rightBinder).freshName needle replacement ∈
        rightResult.allNames := by
    simpa [alphaCommonFresh] using member
  exact
    (freshName_not_mem_allNames
      (alphaCommonCarrier leftResult rightResult sourceBody
        leftBinder rightBinder) needle replacement)
      (by
        simp only [alphaCommonCarrier, allNames,
          Finset.mem_insert, Finset.mem_union]
        exact Or.inr (Or.inr (Or.inl (Or.inr member'))))

theorem alphaCommonFresh_not_mem_source
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    alphaCommonFresh leftResult rightResult sourceBody
        leftBinder rightBinder needle replacement ∉
      sourceBody.allNames := by
  intro member
  have member' :
      (alphaCommonCarrier leftResult rightResult sourceBody
          leftBinder rightBinder).freshName needle replacement ∈
        sourceBody.allNames := by
    simpa [alphaCommonFresh] using member
  exact
    (freshName_not_mem_allNames
      (alphaCommonCarrier leftResult rightResult sourceBody
        leftBinder rightBinder) needle replacement)
      (by
        simp only [alphaCommonCarrier, allNames,
          Finset.mem_insert, Finset.mem_union]
        exact Or.inr (Or.inr (Or.inr member')))

theorem alphaCommonFresh_ne_leftBinder
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    alphaCommonFresh leftResult rightResult sourceBody
        leftBinder rightBinder needle replacement ≠ leftBinder := by
  intro equality
  have equality' :
      (alphaCommonCarrier leftResult rightResult sourceBody
          leftBinder rightBinder).freshName needle replacement =
        leftBinder := by
    simpa [alphaCommonFresh] using equality
  apply freshName_not_mem_allNames
    (alphaCommonCarrier leftResult rightResult sourceBody
      leftBinder rightBinder) needle replacement
  rw [equality']
  simp [alphaCommonCarrier, allNames]

theorem alphaCommonFresh_ne_rightBinder
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    alphaCommonFresh leftResult rightResult sourceBody
        leftBinder rightBinder needle replacement ≠ rightBinder := by
  intro equality
  have equality' :
      (alphaCommonCarrier leftResult rightResult sourceBody
          leftBinder rightBinder).freshName needle replacement =
        rightBinder := by
    simpa [alphaCommonFresh] using equality
  apply freshName_not_mem_allNames
    (alphaCommonCarrier leftResult rightResult sourceBody
      leftBinder rightBinder) needle replacement
  rw [equality']
  simp [alphaCommonCarrier, allNames]

theorem alphaCommonFresh_ne_needle
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    alphaCommonFresh leftResult rightResult sourceBody
        leftBinder rightBinder needle replacement ≠ needle :=
  freshName_ne_needle
    (alphaCommonCarrier leftResult rightResult sourceBody
      leftBinder rightBinder) needle replacement

theorem alphaCommonFresh_ne_replacement
    (leftResult rightResult sourceBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    alphaCommonFresh leftResult rightResult sourceBody
        leftBinder rightBinder needle replacement ≠ replacement :=
  freshName_ne_replacement
    (alphaCommonCarrier leftResult rightResult sourceBody
      leftBinder rightBinder) needle replacement

end RecursiveProc

namespace RecursivePermutation

/--
The common-fresh core used by every binder-conflict branch of the fuel
induction.  The induction hypothesis is applied once to the original
freshened body and once more after swapping its binder to the common name.
-/
theorem substituteAux_freshChoice_unique
    (fuel : Nat)
    (equivariant :
      ∀ (permutation : Equiv.Perm Name)
        (processValue : RecursiveProc) (needle replacement : Name),
        RecursiveAlpha
          (process permutation
            (RecursiveProc.substituteCaptureAvoidingAux
              fuel processValue needle replacement))
          (RecursiveProc.substituteCaptureAvoidingAux fuel
            (process permutation processValue)
            (permutation needle) (permutation replacement)))
    (permutation : Equiv.Perm Name)
    (body : RecursiveProc)
    (needle replacement firstFresh secondFresh : Name)
    (firstFreshBody : firstFresh ∉ body.allNames)
    (firstNeNeedle : firstFresh ≠ needle)
    (firstNeReplacement : firstFresh ≠ replacement)
    (secondFreshBody :
      secondFresh ∉ (process permutation body).allNames)
    (secondNeNeedle : secondFresh ≠ permutation needle)
    (secondNeReplacement :
      secondFresh ≠ permutation replacement) :
    let leftResult :=
      process permutation
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound replacement firstFresh)
          needle replacement)
    let rightResult :=
      RecursiveProc.substituteCaptureAvoidingAux fuel
        ((process permutation body).renameBound
          (permutation replacement) secondFresh)
        (permutation needle) (permutation replacement)
    ∃ common,
      common ∉ leftResult.allNames ∧
      common ∉ rightResult.allNames ∧
      RecursiveAlpha
        (leftResult.renameBound (permutation firstFresh) common)
        (rightResult.renameBound secondFresh common) := by
  dsimp only
  let permutedBody := process permutation body
  let leftInput := body.renameBound replacement firstFresh
  let permutedLeftInput := process permutation leftInput
  let leftAux :=
    RecursiveProc.substituteCaptureAvoidingAux fuel
      leftInput needle replacement
  let leftResult := process permutation leftAux
  let leftMiddle :=
    RecursiveProc.substituteCaptureAvoidingAux fuel
      permutedLeftInput
      (permutation needle) (permutation replacement)
  let rightInput :=
    permutedBody.renameBound (permutation replacement) secondFresh
  let rightResult :=
    RecursiveProc.substituteCaptureAvoidingAux fuel
      rightInput
      (permutation needle) (permutation replacement)
  let common :=
    RecursiveProc.alphaCommonFresh
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  have commonFreshLeft : common ∉ leftResult.allNames :=
    RecursiveProc.alphaCommonFresh_not_mem_left
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  have commonFreshRight : common ∉ rightResult.allNames :=
    RecursiveProc.alphaCommonFresh_not_mem_right
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  have commonFreshBody : common ∉ permutedBody.allNames :=
    RecursiveProc.alphaCommonFresh_not_mem_source
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  have commonNeFirst : common ≠ permutation firstFresh :=
    RecursiveProc.alphaCommonFresh_ne_leftBinder
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  have commonNeSecond : common ≠ secondFresh :=
    RecursiveProc.alphaCommonFresh_ne_rightBinder
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  have commonNeNeedle : common ≠ permutation needle :=
    RecursiveProc.alphaCommonFresh_ne_needle
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  have commonNeReplacement : common ≠ permutation replacement :=
    RecursiveProc.alphaCommonFresh_ne_replacement
      leftResult rightResult permutedBody
      (permutation firstFresh) secondFresh
      (permutation needle) (permutation replacement)
  let leftSwap : Equiv.Perm Name :=
    Equiv.swap (permutation firstFresh) common
  let rightSwap : Equiv.Perm Name :=
    Equiv.swap secondFresh common
  have permutedFirstFreshBody :
      permutation firstFresh ∉ permutedBody.allNames := by
    exact not_mem_allNames_process permutation body
      firstFresh firstFreshBody
  have firstBinderDistinct :
      permutation replacement ≠ permutation firstFresh :=
    permutation.injective.ne (Ne.symm firstNeReplacement)
  have leftInputEq :
      process leftSwap permutedLeftInput =
        permutedBody.renameBound (permutation replacement) common := by
    calc
      process leftSwap permutedLeftInput =
          process leftSwap
            (permutedBody.renameBound
              (permutation replacement) (permutation firstFresh)) := by
        simp [permutedLeftInput, leftInput, permutedBody]
      _ = permutedBody.renameBound
          (permutation replacement) common := by
        exact process_swap_renameBound
          permutedBody (permutation replacement)
          (permutation firstFresh) common
          permutedFirstFreshBody commonFreshBody
          firstBinderDistinct
          (Ne.symm commonNeReplacement)
  have rightInputEq :
      process rightSwap rightInput =
        permutedBody.renameBound (permutation replacement) common := by
    exact process_swap_renameBound
      permutedBody (permutation replacement)
      secondFresh common
      secondFreshBody commonFreshBody
      (Ne.symm secondNeReplacement)
      (Ne.symm commonNeReplacement)
  have leftSwapNeedle :
      leftSwap (permutation needle) = permutation needle := by
    apply Equiv.swap_apply_of_ne_of_ne
    · exact permutation.injective.ne
        (Ne.symm firstNeNeedle)
    · exact Ne.symm commonNeNeedle
  have leftSwapReplacement :
      leftSwap (permutation replacement) =
        permutation replacement := by
    apply Equiv.swap_apply_of_ne_of_ne
    · exact permutation.injective.ne
        (Ne.symm firstNeReplacement)
    · exact Ne.symm commonNeReplacement
  have rightSwapNeedle :
      rightSwap (permutation needle) = permutation needle := by
    apply Equiv.swap_apply_of_ne_of_ne
    · exact Ne.symm secondNeNeedle
    · exact Ne.symm commonNeNeedle
  have rightSwapReplacement :
      rightSwap (permutation replacement) =
        permutation replacement := by
    apply Equiv.swap_apply_of_ne_of_ne
    · exact Ne.symm secondNeReplacement
    · exact Ne.symm commonNeReplacement
  have firstStage :
      RecursiveAlpha leftResult leftMiddle := by
    exact equivariant permutation leftInput needle replacement
  have leftSwapStage :
      RecursiveAlpha
        (process leftSwap leftResult)
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (permutedBody.renameBound
            (permutation replacement) common)
          (permutation needle) (permutation replacement)) := by
    have transported := RecursiveAlpha.permute leftSwap firstStage
    have secondStage :=
      equivariant leftSwap permutedLeftInput
        (permutation needle) (permutation replacement)
    exact RecursiveAlpha.trans transported
      (by
        simpa [leftInputEq, leftSwapNeedle,
          leftSwapReplacement] using secondStage)
  have rightSwapStage :
      RecursiveAlpha
        (process rightSwap rightResult)
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (permutedBody.renameBound
            (permutation replacement) common)
          (permutation needle) (permutation replacement)) := by
    have stage :=
      equivariant rightSwap rightInput
        (permutation needle) (permutation replacement)
    simpa [rightInputEq, rightSwapNeedle,
      rightSwapReplacement] using stage
  have leftRename :
      RecursiveAlpha
        (leftResult.renameBound (permutation firstFresh) common)
        (process leftSwap leftResult) := by
    exact RecursiveAlpha.symm
      (process_swap_fresh_alpha_substRaw
        leftResult (permutation firstFresh) common
        commonFreshLeft)
  have rightRename :
      RecursiveAlpha
        (process rightSwap rightResult)
        (rightResult.renameBound secondFresh common) :=
    process_swap_fresh_alpha_substRaw
      rightResult secondFresh common commonFreshRight
  refine ⟨common, commonFreshLeft, commonFreshRight, ?_⟩
  exact RecursiveAlpha.trans leftRename
    (RecursiveAlpha.trans leftSwapStage
      (RecursiveAlpha.trans
        (RecursiveAlpha.symm rightSwapStage)
        rightRename))

/--
Fuelled capture-avoiding substitution is permutation-equivariant up to the
generated recursive alpha relation for every fuel value.
-/
theorem substituteCaptureAvoidingAux_permute_alpha
    (fuel : Nat) (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (needle replacement : Name) :
    RecursiveAlpha
      (process permutation
        (RecursiveProc.substituteCaptureAvoidingAux
          fuel processValue needle replacement))
      (RecursiveProc.substituteCaptureAvoidingAux fuel
        (process permutation processValue)
        (permutation needle) (permutation replacement)) := by
  induction fuel generalizing permutation processValue needle replacement with
  | zero =>
      exact RecursiveAlpha.refl _
  | succ fuel inductionHypothesis =>
      cases processValue with
      | zero =>
          exact RecursiveAlpha.refl _
      | tau next =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.tau
              (inductionHypothesis permutation next needle replacement)
      | send channel value next =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.send
              (inductionHypothesis permutation next needle replacement)
      | recv channel binder next =>
          by_cases stops : binder = needle
          · subst binder
            simp [RecursiveProc.substituteCaptureAvoidingAux,
              process]
            exact RecursiveAlpha.refl _
          · by_cases conflict : binder = replacement
            · subst binder
              let firstFresh := next.freshName needle replacement
              let permutedBody := process permutation next
              let secondFresh :=
                permutedBody.freshName
                  (permutation needle) (permutation replacement)
              have firstFreshBody :
                  firstFresh ∉ next.allNames :=
                next.freshName_not_mem_allNames needle replacement
              have firstNeNeedle : firstFresh ≠ needle :=
                next.freshName_ne_needle needle replacement
              have firstNeReplacement : firstFresh ≠ replacement :=
                next.freshName_ne_replacement needle replacement
              have secondFreshBody :
                  secondFresh ∉ permutedBody.allNames :=
                permutedBody.freshName_not_mem_allNames
                  (permutation needle) (permutation replacement)
              have secondNeNeedle :
                  secondFresh ≠ permutation needle :=
                permutedBody.freshName_ne_needle
                  (permutation needle) (permutation replacement)
              have secondNeReplacement :
                  secondFresh ≠ permutation replacement :=
                permutedBody.freshName_ne_replacement
                  (permutation needle) (permutation replacement)
              rcases substituteAux_freshChoice_unique
                  fuel inductionHypothesis permutation next
                  needle replacement firstFresh secondFresh
                  firstFreshBody firstNeNeedle firstNeReplacement
                  secondFreshBody secondNeNeedle secondNeReplacement with
                ⟨common, commonFreshLeft, commonFreshRight,
                  bodyRelation⟩
              have aligned :=
                RecursiveAlpha.recv_of_common_fresh
                  (permutation
                    (if channel = needle then replacement else channel))
                  (permutation firstFresh) secondFresh common
                  _ _ commonFreshLeft commonFreshRight bodyRelation
              simpa [RecursiveProc.substituteCaptureAvoidingAux,
                process, stops, firstFresh, secondFresh,
                permutedBody] using aligned
            · simpa [RecursiveProc.substituteCaptureAvoidingAux,
                process, stops, conflict] using
                RecursiveAlpha.recv
                  (inductionHypothesis permutation next
                    needle replacement)
      | choice left right =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.choice
              (inductionHypothesis permutation left needle replacement)
              (inductionHypothesis permutation right needle replacement)
      | par left right =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.par
              (inductionHypothesis permutation left needle replacement)
              (inductionHypothesis permutation right needle replacement)
      | new binder body =>
          by_cases stops : binder = needle
          · subst binder
            simp [RecursiveProc.substituteCaptureAvoidingAux,
              process]
            exact RecursiveAlpha.refl _
          · by_cases conflict : binder = replacement
            · subst binder
              let firstFresh := body.freshName needle replacement
              let permutedBody := process permutation body
              let secondFresh :=
                permutedBody.freshName
                  (permutation needle) (permutation replacement)
              have firstFreshBody :
                  firstFresh ∉ body.allNames :=
                body.freshName_not_mem_allNames needle replacement
              have firstNeNeedle : firstFresh ≠ needle :=
                body.freshName_ne_needle needle replacement
              have firstNeReplacement : firstFresh ≠ replacement :=
                body.freshName_ne_replacement needle replacement
              have secondFreshBody :
                  secondFresh ∉ permutedBody.allNames :=
                permutedBody.freshName_not_mem_allNames
                  (permutation needle) (permutation replacement)
              have secondNeNeedle :
                  secondFresh ≠ permutation needle :=
                permutedBody.freshName_ne_needle
                  (permutation needle) (permutation replacement)
              have secondNeReplacement :
                  secondFresh ≠ permutation replacement :=
                permutedBody.freshName_ne_replacement
                  (permutation needle) (permutation replacement)
              rcases substituteAux_freshChoice_unique
                  fuel inductionHypothesis permutation body
                  needle replacement firstFresh secondFresh
                  firstFreshBody firstNeNeedle firstNeReplacement
                  secondFreshBody secondNeNeedle secondNeReplacement with
                ⟨common, commonFreshLeft, commonFreshRight,
                  bodyRelation⟩
              have aligned :=
                RecursiveAlpha.new_of_common_fresh
                  (permutation firstFresh) secondFresh common
                  _ _ commonFreshLeft commonFreshRight bodyRelation
              simpa [RecursiveProc.substituteCaptureAvoidingAux,
                process, stops, firstFresh, secondFresh,
                permutedBody] using aligned
            · simpa [RecursiveProc.substituteCaptureAvoidingAux,
                process, stops, conflict] using
                RecursiveAlpha.new
                  (inductionHypothesis permutation body
                    needle replacement)
      | matchEq left right next =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.matchEq
              (inductionHypothesis permutation next needle replacement)
      | matchNe left right next =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.matchNe
              (inductionHypothesis permutation next needle replacement)
      | repTau body =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.repTau
              (inductionHypothesis permutation body needle replacement)
      | repSend channel value body =>
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            process] using
            RecursiveAlpha.repSend
              (inductionHypothesis permutation body needle replacement)
      | repRecv channel binder body =>
          by_cases stops : binder = needle
          · subst binder
            simp [RecursiveProc.substituteCaptureAvoidingAux,
              process]
            exact RecursiveAlpha.refl _
          · by_cases conflict : binder = replacement
            · subst binder
              let firstFresh := body.freshName needle replacement
              let permutedBody := process permutation body
              let secondFresh :=
                permutedBody.freshName
                  (permutation needle) (permutation replacement)
              have firstFreshBody :
                  firstFresh ∉ body.allNames :=
                body.freshName_not_mem_allNames needle replacement
              have firstNeNeedle : firstFresh ≠ needle :=
                body.freshName_ne_needle needle replacement
              have firstNeReplacement : firstFresh ≠ replacement :=
                body.freshName_ne_replacement needle replacement
              have secondFreshBody :
                  secondFresh ∉ permutedBody.allNames :=
                permutedBody.freshName_not_mem_allNames
                  (permutation needle) (permutation replacement)
              have secondNeNeedle :
                  secondFresh ≠ permutation needle :=
                permutedBody.freshName_ne_needle
                  (permutation needle) (permutation replacement)
              have secondNeReplacement :
                  secondFresh ≠ permutation replacement :=
                permutedBody.freshName_ne_replacement
                  (permutation needle) (permutation replacement)
              rcases substituteAux_freshChoice_unique
                  fuel inductionHypothesis permutation body
                  needle replacement firstFresh secondFresh
                  firstFreshBody firstNeNeedle firstNeReplacement
                  secondFreshBody secondNeNeedle secondNeReplacement with
                ⟨common, commonFreshLeft, commonFreshRight,
                  bodyRelation⟩
              have aligned :=
                RecursiveAlpha.repRecv_of_common_fresh
                  (permutation
                    (if channel = needle then replacement else channel))
                  (permutation firstFresh) secondFresh common
                  _ _ commonFreshLeft commonFreshRight bodyRelation
              simpa [RecursiveProc.substituteCaptureAvoidingAux,
                process, stops, firstFresh, secondFresh,
                permutedBody] using aligned
            · simpa [RecursiveProc.substituteCaptureAvoidingAux,
                process, stops, conflict] using
                RecursiveAlpha.repRecv
                  (inductionHypothesis permutation body
                    needle replacement)

/--
The total executable capture-avoiding substitution is permutation-equivariant
up to `RecursiveAlpha`, including every deterministic numeric-freshening
branch.
-/
theorem substituteCaptureAvoiding_permute_alpha
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (needle replacement : Name) :
    RecursiveAlpha
      (process permutation
        (processValue.substituteCaptureAvoiding needle replacement))
      ((process permutation processValue).substituteCaptureAvoiding
        (permutation needle) (permutation replacement)) := by
  by_cases risk :
      processValue.captureRisk needle replacement = true
  · have aux :=
      substituteCaptureAvoidingAux_permute_alpha
        processValue.syntaxDepth permutation processValue
        needle replacement
    simpa [RecursiveProc.substituteCaptureAvoiding, risk] using aux
  · have safe :
        processValue.captureRisk needle replacement = false :=
      Bool.eq_false_of_not_eq_true risk
    have strict :=
      process_substituteCaptureAvoiding_of_no_capture
        permutation processValue needle replacement safe
    rw [strict]
    exact RecursiveAlpha.refl _

end RecursivePermutation

namespace RecursiveAlpha

/--
The single congruence property needed to transport a communication
derivative that has already changed by alpha conversion.
-/
def SubstitutionCongruent : Prop :=
  ∀ {left right : RecursiveProc},
    RecursiveAlpha left right →
    ∀ needle replacement,
      RecursiveAlpha
        (left.substituteCaptureAvoiding needle replacement)
        (right.substituteCaptureAvoiding needle replacement)

/--
Fresh raw substitution respects alpha.  Both substitutions are factored
through the same literal swap, whose action preserves `RecursiveAlpha`.
-/
theorem substRaw_fresh_congr
    (relation : RecursiveAlpha left right)
    (needle replacement : Name)
    (freshLeft : replacement ∉ left.allNames)
    (freshRight : replacement ∉ right.allNames) :
    RecursiveAlpha
      (left.substRaw needle replacement)
      (right.substRaw needle replacement) := by
  exact RecursiveAlpha.trans
    (RecursiveAlpha.symm
      (RecursivePermutation.process_swap_fresh_alpha_substRaw
        left needle replacement freshLeft))
    (RecursiveAlpha.trans
      (RecursiveAlpha.permute
        (Equiv.swap needle replacement) relation)
      (RecursivePermutation.process_swap_fresh_alpha_substRaw
        right needle replacement freshRight))

/--
Under substitution congruence, an already alpha-shifted derivative can be
substituted and compared directly with the literal permutation of the
original derivative.  The second leg is the unconditional numeric-freshening
theorem above.
-/
theorem substitute_permuted_target
    (congruent : SubstitutionCongruent)
    (permutation : Equiv.Perm Name)
    (relation :
      RecursiveAlpha actual
        (RecursivePermutation.process permutation original))
    (needle replacement : Name) :
    RecursiveAlpha
      (actual.substituteCaptureAvoiding
        (permutation needle) (permutation replacement))
      (RecursivePermutation.process permutation
        (original.substituteCaptureAvoiding needle replacement)) := by
  exact RecursiveAlpha.trans
    (congruent relation (permutation needle) (permutation replacement))
    (RecursiveAlpha.symm
      (RecursivePermutation.substituteCaptureAvoiding_permute_alpha
        permutation original needle replacement))

/-- Recursive alpha conversion preserves the exact free-name interface. -/
theorem freeNames_eq
    (relation : RecursiveAlpha left right) :
    left.freeNames = right.freeNames := by
  induction relation with
  | refl =>
      rfl
  | symm _ inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans _ _ firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | send _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | recv _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | choice _ _ leftIH rightIH =>
      simp [RecursiveProc.freeNames, leftIH, rightIH]
  | par _ _ leftIH rightIH =>
      simp [RecursiveProc.freeNames, leftIH, rightIH]
  | new _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | matchEq _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | matchNe _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | repTau _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | repSend _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | repRecv _ inductionHypothesis =>
      simp [RecursiveProc.freeNames, inductionHypothesis]
  | recvBinder fresh =>
      simp only [RecursiveProc.freeNames, RecursiveProc.renameBound]
      rw [RecursiveProc.freeNames_substRaw_erase_replacement _ _ _ fresh]
  | newBinder fresh =>
      simp only [RecursiveProc.freeNames, RecursiveProc.renameBound]
      rw [RecursiveProc.freeNames_substRaw_erase_replacement _ _ _ fresh]
  | repRecvBinder fresh =>
      simp only [RecursiveProc.freeNames, RecursiveProc.renameBound]
      rw [RecursiveProc.freeNames_substRaw_erase_replacement _ _ _ fresh]

end RecursiveAlpha

namespace RecursivePermutation

/--
One arbitrary fresh spelling of an enclosing binder can be normalized to a
second common spelling after fuelled substitution.
-/
theorem substituteAux_freshChoice_to_common
    (fuel : Nat) (body : RecursiveProc)
    (binder needle replacement fresh common : Name)
    (freshBody : fresh ∉ body.allNames)
    (commonFreshBody : common ∉ body.allNames)
    (commonFreshResult :
      common ∉
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder fresh)
          needle replacement).allNames)
    (freshNeBinder : fresh ≠ binder)
    (commonNeBinder : common ≠ binder)
    (freshNeNeedle : fresh ≠ needle)
    (freshNeReplacement : fresh ≠ replacement)
    (commonNeNeedle : common ≠ needle)
    (commonNeReplacement : common ≠ replacement) :
    RecursiveAlpha
      ((RecursiveProc.substituteCaptureAvoidingAux fuel
        (body.renameBound binder fresh)
        needle replacement).renameBound fresh common)
      (RecursiveProc.substituteCaptureAvoidingAux fuel
        (body.renameBound binder common)
        needle replacement) := by
  let input := body.renameBound binder fresh
  let result :=
    RecursiveProc.substituteCaptureAvoidingAux fuel
      input needle replacement
  let swap : Equiv.Perm Name := Equiv.swap fresh common
  have inputEq :
      process swap input = body.renameBound binder common := by
    exact process_swap_renameBound body binder fresh common
      freshBody commonFreshBody
      (Ne.symm freshNeBinder) (Ne.symm commonNeBinder)
  have swapNeedle : swap needle = needle := by
    apply Equiv.swap_apply_of_ne_of_ne
    · exact Ne.symm freshNeNeedle
    · exact Ne.symm commonNeNeedle
  have swapReplacement : swap replacement = replacement := by
    apply Equiv.swap_apply_of_ne_of_ne
    · exact Ne.symm freshNeReplacement
    · exact Ne.symm commonNeReplacement
  have equivariant :=
    substituteCaptureAvoidingAux_permute_alpha
      fuel swap input needle replacement
  have renamedToSwap :
      RecursiveAlpha
        (result.renameBound fresh common)
        (process swap result) := by
    exact RecursiveAlpha.symm
      (process_swap_fresh_alpha_substRaw
        result fresh common commonFreshResult)
  exact RecursiveAlpha.trans renamedToSwap
    (by
      simpa [result, input, inputEq,
        swapNeedle, swapReplacement] using equivariant)

end RecursivePermutation

namespace RecursiveLate

/--
Every finite-control native derivation is permutation-equivariant up to alpha
at its derivative, provided capture-avoiding substitution is alpha-congruent.
Each returned witness is one genuine recursive native step.
-/
theorem embedded_native_permute_up_to_alpha
    (congruent : RecursiveAlpha.SubstitutionCongruent)
    (permutation : Equiv.Perm Name)
    (step : Late.NativeStep source action target) :
    ∃ transformedTarget,
      NativeStep
        (RecursivePermutation.process permutation
          (RecursiveProc.ofRaw source))
        (RecursivePermutation.action permutation action)
        transformedTarget ∧
      RecursiveAlpha transformedTarget
        (RecursivePermutation.process permutation
          (RecursiveProc.ofRaw target)) := by
  induction step with
  | prefixTau =>
      exact ⟨_, NativeStep.prefixTau, RecursiveAlpha.refl _⟩
  | prefixOutput =>
      exact ⟨_, NativeStep.prefixOutput, RecursiveAlpha.refl _⟩
  | prefixInput =>
      exact ⟨_, NativeStep.prefixInput, RecursiveAlpha.refl _⟩
  | matchGuard step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.matchGuard transformedStep,
          targetAlpha⟩
  | @mismatchGuard left right body actionValue targetValue
      distinct step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.mismatchGuard
            (permutation.injective.ne distinct) transformedStep,
          targetAlpha⟩
  | @choiceLeft left actionValue next right step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.choiceLeft transformedStep,
          targetAlpha⟩
  | @choiceRight right actionValue next left step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.choiceRight transformedStep,
          targetAlpha⟩
  | @parLeft left actionValue next right fresh step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      have recursiveFresh :
          Disjoint actionValue.boundNames
            (RecursiveProc.ofRaw right).freeNames := by
        simpa using fresh
      have permutedFresh :=
        RecursivePermutation.disjoint_bound_free
          permutation recursiveFresh
      exact
        ⟨.par transformedTarget
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw right)),
          NativeStep.parLeft permutedFresh transformedStep,
          RecursiveAlpha.par targetAlpha (RecursiveAlpha.refl _)⟩
  | @parRight right actionValue next left fresh step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      have recursiveFresh :
          Disjoint actionValue.boundNames
            (RecursiveProc.ofRaw left).freeNames := by
        simpa using fresh
      have permutedFresh :=
        RecursivePermutation.disjoint_bound_free
          permutation recursiveFresh
      exact
        ⟨.par
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw left))
            transformedTarget,
          NativeStep.parRight permutedFresh transformedStep,
          RecursiveAlpha.par (RecursiveAlpha.refl _) targetAlpha⟩
  | @syncLeft left channel value leftTarget right binder rightTarget
      outputStep inputStep fresh
      outputIH inputIH =>
      rcases outputIH with
        ⟨permutedLeftTarget, permutedOutput, leftAlpha⟩
      rcases inputIH with
        ⟨permutedRightTarget, permutedInput, rightAlpha⟩
      have recursiveFresh :
          binder ∉ (RecursiveProc.ofRaw leftTarget).freeNames := by
        simpa using fresh
      have expectedFresh :
          permutation binder ∉
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw leftTarget)).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation recursiveFresh
      have actualFresh :
          permutation binder ∉ permutedLeftTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq leftAlpha]
        exact expectedFresh
      have substitutedAlpha :
          RecursiveAlpha
            (permutedRightTarget.substituteCaptureAvoiding
              (permutation binder) (permutation value))
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (rightTarget.substituteCaptureAvoiding binder value))) := by
        simpa using
          (RecursiveAlpha.substitute_permuted_target
            congruent permutation rightAlpha binder value)
      exact
        ⟨.par permutedLeftTarget
            (permutedRightTarget.substituteCaptureAvoiding
              (permutation binder) (permutation value)),
          NativeStep.syncLeft permutedOutput permutedInput actualFresh,
          RecursiveAlpha.par leftAlpha substitutedAlpha⟩
  | @syncRight left channel binder leftTarget right value rightTarget
      inputStep outputStep fresh
      inputIH outputIH =>
      rcases inputIH with
        ⟨permutedLeftTarget, permutedInput, leftAlpha⟩
      rcases outputIH with
        ⟨permutedRightTarget, permutedOutput, rightAlpha⟩
      have recursiveFresh :
          binder ∉ (RecursiveProc.ofRaw rightTarget).freeNames := by
        simpa using fresh
      have expectedFresh :
          permutation binder ∉
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw rightTarget)).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation recursiveFresh
      have actualFresh :
          permutation binder ∉ permutedRightTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq rightAlpha]
        exact expectedFresh
      have substitutedAlpha :
          RecursiveAlpha
            (permutedLeftTarget.substituteCaptureAvoiding
              (permutation binder) (permutation value))
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (leftTarget.substituteCaptureAvoiding binder value))) := by
        simpa using
          (RecursiveAlpha.substitute_permuted_target
            congruent permutation leftAlpha binder value)
      exact
        ⟨.par
            (permutedLeftTarget.substituteCaptureAvoiding
              (permutation binder) (permutation value))
            permutedRightTarget,
          NativeStep.syncRight permutedInput permutedOutput actualFresh,
          RecursiveAlpha.par substitutedAlpha rightAlpha⟩
  | @restrict binder body actionValue next fresh step
      inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨.new (permutation binder) transformedTarget,
          NativeStep.restrict
            (RecursivePermutation.fresh_action_names
              permutation fresh)
            transformedStep,
          RecursiveAlpha.new targetAlpha⟩
  | @«open» fresh channel body next distinct step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.open
            (permutation.injective.ne distinct) transformedStep,
          targetAlpha⟩
  | @closeLeft left channel fresh leftTarget right binder rightTarget
      outputStep inputStep
      freshForReceiver binderFresh outputIH inputIH =>
      rcases outputIH with
        ⟨permutedLeftTarget, permutedOutput, leftAlpha⟩
      rcases inputIH with
        ⟨permutedRightTarget, permutedInput, rightAlpha⟩
      have receiverFreshRecursive :
          fresh ∉ (RecursiveProc.ofRaw right).freeNames := by
        simpa using freshForReceiver
      have receiverFreshPermuted :
          permutation fresh ∉
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw right)).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation receiverFreshRecursive
      have binderFreshRecursive :
          binder ∉ (RecursiveProc.ofRaw leftTarget).freeNames := by
        simpa using binderFresh
      have binderFreshExpected :
          permutation binder ∉
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw leftTarget)).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation binderFreshRecursive
      have binderFreshActual :
          permutation binder ∉ permutedLeftTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq leftAlpha]
        exact binderFreshExpected
      have substitutedAlpha :
          RecursiveAlpha
            (permutedRightTarget.substituteCaptureAvoiding
              (permutation binder) (permutation fresh))
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (rightTarget.substituteCaptureAvoiding binder fresh))) := by
        simpa using
          (RecursiveAlpha.substitute_permuted_target
            congruent permutation rightAlpha binder fresh)
      exact
        ⟨.new (permutation fresh)
            (.par permutedLeftTarget
              (permutedRightTarget.substituteCaptureAvoiding
                (permutation binder) (permutation fresh))),
          NativeStep.closeLeft permutedOutput permutedInput
            receiverFreshPermuted binderFreshActual,
          RecursiveAlpha.new
            (RecursiveAlpha.par leftAlpha substitutedAlpha)⟩
  | @closeRight left channel binder leftTarget right fresh rightTarget
      inputStep outputStep
      freshForReceiver binderFresh inputIH outputIH =>
      rcases inputIH with
        ⟨permutedLeftTarget, permutedInput, leftAlpha⟩
      rcases outputIH with
        ⟨permutedRightTarget, permutedOutput, rightAlpha⟩
      have receiverFreshRecursive :
          fresh ∉ (RecursiveProc.ofRaw left).freeNames := by
        simpa using freshForReceiver
      have receiverFreshPermuted :
          permutation fresh ∉
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw left)).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation receiverFreshRecursive
      have binderFreshRecursive :
          binder ∉ (RecursiveProc.ofRaw rightTarget).freeNames := by
        simpa using binderFresh
      have binderFreshExpected :
          permutation binder ∉
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw rightTarget)).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation binderFreshRecursive
      have binderFreshActual :
          permutation binder ∉ permutedRightTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq rightAlpha]
        exact binderFreshExpected
      have substitutedAlpha :
          RecursiveAlpha
            (permutedLeftTarget.substituteCaptureAvoiding
              (permutation binder) (permutation fresh))
            (RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (leftTarget.substituteCaptureAvoiding binder fresh))) := by
        simpa using
          (RecursiveAlpha.substitute_permuted_target
            congruent permutation leftAlpha binder fresh)
      exact
        ⟨.new (permutation fresh)
            (.par
              (permutedLeftTarget.substituteCaptureAvoiding
                (permutation binder) (permutation fresh))
              permutedRightTarget),
          NativeStep.closeRight permutedInput permutedOutput
            receiverFreshPermuted binderFreshActual,
          RecursiveAlpha.new
            (RecursiveAlpha.par substitutedAlpha rightAlpha)⟩

/--
Every guarded-recursive native constructor is permutation-equivariant up to
alpha at the derivative under the sole remaining substitution-congruence
interface.  The result is process-level and returns an actual one-step
derivation from the literally permuted source.
-/
theorem native_permute_up_to_alpha
    (congruent : RecursiveAlpha.SubstitutionCongruent)
    (permutation : Equiv.Perm Name)
    (step : NativeStep source action target) :
    ∃ transformedTarget,
      NativeStep
        (RecursivePermutation.process permutation source)
        (RecursivePermutation.action permutation action)
        transformedTarget ∧
      RecursiveAlpha transformedTarget
        (RecursivePermutation.process permutation target) := by
  induction step with
  | embedded oldStep =>
      exact embedded_native_permute_up_to_alpha
        congruent permutation oldStep
  | prefixTau =>
      exact ⟨_, NativeStep.prefixTau, RecursiveAlpha.refl _⟩
  | prefixOutput =>
      exact ⟨_, NativeStep.prefixOutput, RecursiveAlpha.refl _⟩
  | prefixInput =>
      exact ⟨_, NativeStep.prefixInput, RecursiveAlpha.refl _⟩
  | matchGuard step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.matchGuard transformedStep,
          targetAlpha⟩
  | @mismatchGuard left right body actionValue targetValue
      distinct step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.mismatchGuard
            (permutation.injective.ne distinct) transformedStep,
          targetAlpha⟩
  | @choiceLeft left actionValue next right step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.choiceLeft transformedStep,
          targetAlpha⟩
  | @choiceRight right actionValue next left step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.choiceRight transformedStep,
          targetAlpha⟩
  | @parLeft left actionValue next right fresh step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨.par transformedTarget
            (RecursivePermutation.process permutation right),
          NativeStep.parLeft
            (RecursivePermutation.disjoint_bound_free
              permutation fresh)
            transformedStep,
          RecursiveAlpha.par targetAlpha (RecursiveAlpha.refl _)⟩
  | @parRight right actionValue next left fresh step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨.par (RecursivePermutation.process permutation left)
            transformedTarget,
          NativeStep.parRight
            (RecursivePermutation.disjoint_bound_free
              permutation fresh)
            transformedStep,
          RecursiveAlpha.par (RecursiveAlpha.refl _) targetAlpha⟩
  | @syncLeft left channel value leftTarget right binder rightTarget
      outputStep inputStep fresh outputIH inputIH =>
      rcases outputIH with
        ⟨permutedLeftTarget, permutedOutput, leftAlpha⟩
      rcases inputIH with
        ⟨permutedRightTarget, permutedInput, rightAlpha⟩
      have expectedFresh :
          permutation binder ∉
            (RecursivePermutation.process
              permutation leftTarget).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation fresh
      have actualFresh :
          permutation binder ∉ permutedLeftTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq leftAlpha]
        exact expectedFresh
      have substitutedAlpha :=
        RecursiveAlpha.substitute_permuted_target
          congruent permutation rightAlpha binder value
      exact
        ⟨.par permutedLeftTarget
            (permutedRightTarget.substituteCaptureAvoiding
              (permutation binder) (permutation value)),
          NativeStep.syncLeft permutedOutput permutedInput actualFresh,
          RecursiveAlpha.par leftAlpha substitutedAlpha⟩
  | @syncRight left channel binder leftTarget right value rightTarget
      inputStep outputStep fresh inputIH outputIH =>
      rcases inputIH with
        ⟨permutedLeftTarget, permutedInput, leftAlpha⟩
      rcases outputIH with
        ⟨permutedRightTarget, permutedOutput, rightAlpha⟩
      have expectedFresh :
          permutation binder ∉
            (RecursivePermutation.process
              permutation rightTarget).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation fresh
      have actualFresh :
          permutation binder ∉ permutedRightTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq rightAlpha]
        exact expectedFresh
      have substitutedAlpha :=
        RecursiveAlpha.substitute_permuted_target
          congruent permutation leftAlpha binder value
      exact
        ⟨.par
            (permutedLeftTarget.substituteCaptureAvoiding
              (permutation binder) (permutation value))
            permutedRightTarget,
          NativeStep.syncRight permutedInput permutedOutput actualFresh,
          RecursiveAlpha.par substitutedAlpha rightAlpha⟩
  | @restrict binder body actionValue next fresh step
      inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨.new (permutation binder) transformedTarget,
          NativeStep.restrict
            (RecursivePermutation.fresh_action_names
              permutation fresh)
            transformedStep,
          RecursiveAlpha.new targetAlpha⟩
  | @«open» fresh channel body next distinct step inductionHypothesis =>
      rcases inductionHypothesis with
        ⟨transformedTarget, transformedStep, targetAlpha⟩
      exact
        ⟨transformedTarget,
          NativeStep.open
            (permutation.injective.ne distinct) transformedStep,
          targetAlpha⟩
  | @closeLeft left channel fresh leftTarget right binder rightTarget
      outputStep inputStep freshForReceiver binderFresh
      outputIH inputIH =>
      rcases outputIH with
        ⟨permutedLeftTarget, permutedOutput, leftAlpha⟩
      rcases inputIH with
        ⟨permutedRightTarget, permutedInput, rightAlpha⟩
      have receiverFreshPermuted :
          permutation fresh ∉
            (RecursivePermutation.process permutation right).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation freshForReceiver
      have binderFreshExpected :
          permutation binder ∉
            (RecursivePermutation.process
              permutation leftTarget).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation binderFresh
      have binderFreshActual :
          permutation binder ∉ permutedLeftTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq leftAlpha]
        exact binderFreshExpected
      have substitutedAlpha :=
        RecursiveAlpha.substitute_permuted_target
          congruent permutation rightAlpha binder fresh
      exact
        ⟨.new (permutation fresh)
            (.par permutedLeftTarget
              (permutedRightTarget.substituteCaptureAvoiding
                (permutation binder) (permutation fresh))),
          NativeStep.closeLeft permutedOutput permutedInput
            receiverFreshPermuted binderFreshActual,
          RecursiveAlpha.new
            (RecursiveAlpha.par leftAlpha substitutedAlpha)⟩
  | @closeRight left channel binder leftTarget right fresh rightTarget
      inputStep outputStep freshForReceiver binderFresh
      inputIH outputIH =>
      rcases inputIH with
        ⟨permutedLeftTarget, permutedInput, leftAlpha⟩
      rcases outputIH with
        ⟨permutedRightTarget, permutedOutput, rightAlpha⟩
      have receiverFreshPermuted :
          permutation fresh ∉
            (RecursivePermutation.process permutation left).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation freshForReceiver
      have binderFreshExpected :
          permutation binder ∉
            (RecursivePermutation.process
              permutation rightTarget).freeNames :=
        RecursivePermutation.fresh_process_freeNames
          permutation binderFresh
      have binderFreshActual :
          permutation binder ∉ permutedRightTarget.freeNames := by
        rw [RecursiveAlpha.freeNames_eq rightAlpha]
        exact binderFreshExpected
      have substitutedAlpha :=
        RecursiveAlpha.substitute_permuted_target
          congruent permutation leftAlpha binder fresh
      exact
        ⟨.new (permutation fresh)
            (.par
              (permutedLeftTarget.substituteCaptureAvoiding
                (permutation binder) (permutation fresh))
              permutedRightTarget),
          NativeStep.closeRight permutedInput permutedOutput
            receiverFreshPermuted binderFreshActual,
          RecursiveAlpha.new
            (RecursiveAlpha.par substitutedAlpha rightAlpha)⟩
  | replicatedTau =>
      exact ⟨_, NativeStep.replicatedTau, RecursiveAlpha.refl _⟩
  | replicatedOutput =>
      exact ⟨_, NativeStep.replicatedOutput, RecursiveAlpha.refl _⟩
  | replicatedInput =>
      exact ⟨_, NativeStep.replicatedInput, RecursiveAlpha.refl _⟩

end RecursiveLate

namespace RecursiveAlphaOperational

open RecursiveActionAlpha

/--
Conditional all-constructor action on the strong alpha quotient.  This is a
direct corollary of the process-level theorem and still contains one native
target derivation, never a weak closure.
-/
theorem alphaNativeStep_permute_all
    (congruent : RecursiveAlpha.SubstitutionCongruent)
    (permutation : Equiv.Perm Name)
    (step : RecursiveLate.NativeStep source action target) :
    AlphaNativeStep
      (permuteProcess permutation
        (Quotient.mk RecursiveAlpha.setoid source))
      (permuteDerivative permutation
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := action, target := target } :
            LabelledDerivative))) := by
  rcases RecursiveLate.native_permute_up_to_alpha
      congruent permutation step with
    ⟨permutedTarget, permutedStep, targetAlpha⟩
  exact alphaNativeStep_permute_up_to_targetAlpha
    permutation step permutedStep targetAlpha

end RecursiveAlphaOperational

end Cantilune.Pi
