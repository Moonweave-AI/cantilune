import Cantilune.Pi.LateGuardedReplicationAlphaFreshChoice

/-!
# Alpha congruence of recursive capture-avoiding substitution

This module advances the remaining quotient-compatibility interface for the
executable guarded-recursive substitution.  The first normalization lemma
shows that the fuelled algorithm agrees literally with raw substitution when
its capture-risk test is false.  The complete `SubstitutionCongruent`
inhabitant still requires the analogous common-fresh normalizers for
`recv` and `repRecv`; no such inhabitant is claimed here.
-/

namespace Cantilune.Pi

namespace RecursiveProc

/--
Finite carrier containing every source and actual derivative for the two
common-fresh normalizations used by substitution congruence.
-/
def substitutionCongruenceCarrier
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) : RecursiveProc :=
  .send leftBinder rightBinder
    (.send needle replacement
      (.par leftBody
        (.par rightBody
          (.par
            (leftBody.substituteCaptureAvoidingAux
              fuel needle replacement)
            (.par
              (rightBody.substituteCaptureAvoidingAux
                fuel needle replacement)
              (.par
                (RecursiveProc.substituteCaptureAvoidingAux fuel
                  (leftBody.renameBound leftBinder
                    (leftBody.freshName needle replacement))
                  needle replacement)
                (RecursiveProc.substituteCaptureAvoidingAux fuel
                  (rightBody.renameBound rightBinder
                    (rightBody.freshName needle replacement))
                  needle replacement)))))))

/-- Deterministic common spelling outside the complete finite carrier. -/
def substitutionCongruenceFresh
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) : Name :=
  RecursiveProc.freshName
    (substitutionCongruenceCarrier fuel leftBody rightBody
      leftBinder rightBinder needle replacement)
    needle replacement

theorem substitutionCongruenceFresh_not_mem_carrier
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ∉
      (substitutionCongruenceCarrier fuel leftBody rightBody
        leftBinder rightBinder needle replacement).allNames := by
  simpa [substitutionCongruenceFresh] using
    (freshName_not_mem_allNames
      (substitutionCongruenceCarrier fuel leftBody rightBody
        leftBinder rightBinder needle replacement)
      needle replacement)

theorem substitutionCongruenceFresh_ne_needle
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ≠ needle :=
  by
    simpa [substitutionCongruenceFresh] using
      (freshName_ne_needle
        (substitutionCongruenceCarrier fuel leftBody rightBody
          leftBinder rightBinder needle replacement)
        needle replacement)

theorem substitutionCongruenceFresh_ne_replacement
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ≠ replacement :=
  by
    simpa [substitutionCongruenceFresh] using
      (freshName_ne_replacement
        (substitutionCongruenceCarrier fuel leftBody rightBody
          leftBinder rightBinder needle replacement)
        needle replacement)

theorem substitutionCongruenceFresh_not_mem_leftBody
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ∉ leftBody.allNames := by
  intro member
  apply substitutionCongruenceFresh_not_mem_carrier
    fuel leftBody rightBody leftBinder rightBinder needle replacement
  simp [substitutionCongruenceCarrier, RecursiveProc.allNames, member]

theorem substitutionCongruenceFresh_not_mem_rightBody
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ∉ rightBody.allNames := by
  intro member
  apply substitutionCongruenceFresh_not_mem_carrier
    fuel leftBody rightBody leftBinder rightBinder needle replacement
  simp [substitutionCongruenceCarrier, RecursiveProc.allNames, member]

theorem substitutionCongruenceFresh_not_mem_leftDirect
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ∉
      (leftBody.substituteCaptureAvoidingAux
        fuel needle replacement).allNames := by
  intro member
  apply substitutionCongruenceFresh_not_mem_carrier
    fuel leftBody rightBody leftBinder rightBinder needle replacement
  simp [substitutionCongruenceCarrier, RecursiveProc.allNames, member]

theorem substitutionCongruenceFresh_not_mem_rightDirect
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ∉
      (rightBody.substituteCaptureAvoidingAux
        fuel needle replacement).allNames := by
  intro member
  apply substitutionCongruenceFresh_not_mem_carrier
    fuel leftBody rightBody leftBinder rightBinder needle replacement
  simp [substitutionCongruenceCarrier, RecursiveProc.allNames, member]

theorem substitutionCongruenceFresh_not_mem_leftConflict
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ∉
      (RecursiveProc.substituteCaptureAvoidingAux fuel
        (leftBody.renameBound leftBinder
          (leftBody.freshName needle replacement))
        needle replacement).allNames := by
  intro member
  apply substitutionCongruenceFresh_not_mem_carrier
    fuel leftBody rightBody leftBinder rightBinder needle replacement
  simp [substitutionCongruenceCarrier, RecursiveProc.allNames, member]

theorem substitutionCongruenceFresh_not_mem_rightConflict
    (fuel : Nat) (leftBody rightBody : RecursiveProc)
    (leftBinder rightBinder needle replacement : Name) :
    substitutionCongruenceFresh fuel leftBody rightBody
        leftBinder rightBinder needle replacement ∉
      (RecursiveProc.substituteCaptureAvoidingAux fuel
        (rightBody.renameBound rightBinder
          (rightBody.freshName needle replacement))
        needle replacement).allNames := by
  intro member
  apply substitutionCongruenceFresh_not_mem_carrier
    fuel leftBody rightBody leftBinder rightBinder needle replacement
  simp [substitutionCongruenceCarrier, RecursiveProc.allNames, member]

/--
With enough fuel and a negative capture-risk test, the fuelled algorithm
agrees literally with raw substitution.
-/
theorem substituteCaptureAvoidingAux_eq_substRaw_of_no_capture
    (fuel : Nat) (process : RecursiveProc)
    (needle replacement : Name)
    (enough : process.syntaxDepth ≤ fuel)
    (safe : process.captureRisk needle replacement = false) :
    process.substituteCaptureAvoidingAux fuel needle replacement =
      process.substRaw needle replacement := by
  induction fuel generalizing process with
  | zero =>
      have positive := syntaxDepth_pos process
      omega
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          rfl
      | tau next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          simpa [substituteCaptureAvoidingAux, substRaw, captureRisk] using
            inductionHypothesis next nextEnough safe
      | send channel value next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          have nextSafe :
              next.captureRisk needle replacement = false := by
            simpa [captureRisk] using safe
          simp [substituteCaptureAvoidingAux, substRaw,
            inductionHypothesis next nextEnough nextSafe]
      | recv channel binder next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          by_cases stops : binder = needle
          · simp [substituteCaptureAvoidingAux, substRaw, stops]
          · have safeParts :
                binder ≠ replacement ∧
                  next.captureRisk needle replacement = false := by
              simpa [captureRisk, stops] using safe
            simp [substituteCaptureAvoidingAux, substRaw, stops,
              safeParts.1,
              inductionHypothesis next nextEnough safeParts.2]
      | choice left right =>
          have leftEnough : left.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          have rightEnough : right.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          have safeParts :
              left.captureRisk needle replacement = false ∧
                right.captureRisk needle replacement = false := by
            simpa [captureRisk] using safe
          simp [substituteCaptureAvoidingAux, substRaw,
            inductionHypothesis left leftEnough safeParts.1,
            inductionHypothesis right rightEnough safeParts.2]
      | par left right =>
          have leftEnough : left.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          have rightEnough : right.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          have safeParts :
              left.captureRisk needle replacement = false ∧
                right.captureRisk needle replacement = false := by
            simpa [captureRisk] using safe
          simp [substituteCaptureAvoidingAux, substRaw,
            inductionHypothesis left leftEnough safeParts.1,
            inductionHypothesis right rightEnough safeParts.2]
      | new binder body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          by_cases stops : binder = needle
          · simp [substituteCaptureAvoidingAux, substRaw, stops]
          · have safeParts :
                binder ≠ replacement ∧
                  body.captureRisk needle replacement = false := by
              simpa [captureRisk, stops] using safe
            simp [substituteCaptureAvoidingAux, substRaw, stops,
              safeParts.1,
              inductionHypothesis body bodyEnough safeParts.2]
      | matchEq left right next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          have nextSafe :
              next.captureRisk needle replacement = false := by
            simpa [captureRisk] using safe
          simp [substituteCaptureAvoidingAux, substRaw,
            inductionHypothesis next nextEnough nextSafe]
      | matchNe left right next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          have nextSafe :
              next.captureRisk needle replacement = false := by
            simpa [captureRisk] using safe
          simp [substituteCaptureAvoidingAux, substRaw,
            inductionHypothesis next nextEnough nextSafe]
      | repTau body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          simpa [substituteCaptureAvoidingAux, substRaw, captureRisk] using
            inductionHypothesis body bodyEnough safe
      | repSend channel value body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          have bodySafe :
              body.captureRisk needle replacement = false := by
            simpa [captureRisk] using safe
          simp [substituteCaptureAvoidingAux, substRaw,
            inductionHypothesis body bodyEnough bodySafe]
      | repRecv channel binder body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          by_cases stops : binder = needle
          · simp [substituteCaptureAvoidingAux, substRaw, stops]
          · have safeParts :
                binder ≠ replacement ∧
                  body.captureRisk needle replacement = false := by
              simpa [captureRisk, stops] using safe
            simp [substituteCaptureAvoidingAux, substRaw, stops,
              safeParts.1,
              inductionHypothesis body bodyEnough safeParts.2]

end RecursiveProc

namespace RecursiveAlpha

/-- Alpha conversion preserves structural substitution depth exactly. -/
theorem syntaxDepth_eq
    (relation : RecursiveAlpha left right) :
    left.syntaxDepth = right.syntaxDepth := by
  induction relation with
  | refl =>
      rfl
  | symm _ inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans _ _ firstIH secondIH =>
      exact firstIH.trans secondIH
  | tau _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | send _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | recv _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | choice _ _ leftIH rightIH =>
      simp [RecursiveProc.syntaxDepth, leftIH, rightIH]
  | par _ _ leftIH rightIH =>
      simp [RecursiveProc.syntaxDepth, leftIH, rightIH]
  | new _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | matchEq _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | matchNe _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | repTau _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | repSend _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | repRecv _ inductionHypothesis =>
      simp [RecursiveProc.syntaxDepth, inductionHypothesis]
  | recvBinder _ =>
      simp [RecursiveProc.syntaxDepth, RecursiveProc.renameBound,
        RecursiveProc.syntaxDepth_substRaw]
  | newBinder _ =>
      simp [RecursiveProc.syntaxDepth, RecursiveProc.renameBound,
        RecursiveProc.syntaxDepth_substRaw]
  | repRecvBinder _ =>
      simp [RecursiveProc.syntaxDepth, RecursiveProc.renameBound,
        RecursiveProc.syntaxDepth_substRaw]

/--
If the substituted name is not free, fuelled capture avoidance changes at
most binder spellings; its result remains alpha-equivalent to the source.
-/
theorem substituteCaptureAvoidingAux_alpha_self_of_needle_not_free
    (fuel : Nat) (process : RecursiveProc)
    (needle replacement : Name)
    (absent : needle ∉ process.freeNames) :
    RecursiveAlpha
      (process.substituteCaptureAvoidingAux fuel needle replacement)
      process := by
  induction fuel generalizing process with
  | zero =>
      exact RecursiveAlpha.refl _
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          exact RecursiveAlpha.refl _
      | tau next =>
          apply RecursiveAlpha.tau
          apply inductionHypothesis
          simpa [RecursiveProc.freeNames] using absent
      | send channel value next =>
          have absentParts :
              channel ≠ needle ∧ value ≠ needle ∧
                needle ∉ next.freeNames := by
            have raw :
                needle ≠ channel ∧ needle ≠ value ∧
                  needle ∉ next.freeNames := by
              simpa [RecursiveProc.freeNames] using absent
            exact ⟨Ne.symm raw.1, Ne.symm raw.2.1, raw.2.2⟩
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            absentParts.1, absentParts.2.1] using
            RecursiveAlpha.send
              (inductionHypothesis next absentParts.2.2)
      | recv channel binder next =>
          have channelNe : channel ≠ needle := by
            intro equality
            apply absent
            simp [RecursiveProc.freeNames, equality]
          by_cases stops : binder = needle
          · simpa [RecursiveProc.substituteCaptureAvoidingAux,
              stops, channelNe] using
              (RecursiveAlpha.refl
                (RecursiveProc.recv channel binder next))
          · have nextAbsent : needle ∉ next.freeNames := by
              intro member
              apply absent
              simp [RecursiveProc.freeNames, Ne.symm channelNe,
                member, Ne.symm stops]
            by_cases conflicts : binder = replacement
            · have replacementNeNeedle : replacement ≠ needle := by
                intro equality
                apply stops
                exact conflicts.trans equality
              let fresh := next.freshName needle replacement
              let renamed := next.renameBound binder fresh
              have freshAll : fresh ∉ next.allNames := by
                exact next.freshName_not_mem_allNames needle replacement
              have freshNeNeedle : fresh ≠ needle :=
                next.freshName_ne_needle needle replacement
              have renamedAbsent : needle ∉ renamed.freeNames := by
                have supportEq :
                    renamed.freeNames.erase fresh =
                      next.freeNames.erase binder := by
                  simpa [renamed, RecursiveProc.renameBound] using
                    (RecursiveProc.freeNames_substRaw_erase_replacement
                      next binder fresh freshAll)
                intro member
                have erased :
                    needle ∈ renamed.freeNames.erase fresh :=
                  Finset.mem_erase.mpr ⟨Ne.symm freshNeNeedle, member⟩
                rw [supportEq] at erased
                exact nextAbsent (Finset.mem_of_mem_erase erased)
              have bodyRelation :
                  RecursiveAlpha
                    (renamed.substituteCaptureAvoidingAux
                      fuel needle replacement)
                    renamed :=
                inductionHypothesis renamed renamedAbsent
              have renamedProcess :
                  RecursiveAlpha
                    (.recv
                      (if channel = needle then replacement else channel)
                      fresh
                      (renamed.substituteCaptureAvoidingAux
                        fuel needle replacement))
                    (.recv channel fresh renamed) := by
                simpa [channelNe] using RecursiveAlpha.recv bodyRelation
              have binderRelation :
                  RecursiveAlpha
                    (.recv channel binder next)
                    (.recv channel fresh renamed) := by
                simpa [fresh, renamed] using
                  (RecursiveAlpha.recvBinder freshAll
                    (channel := channel) (binder := binder))
              simpa [RecursiveProc.substituteCaptureAvoidingAux,
                stops, conflicts, fresh, renamed, channelNe,
                replacementNeNeedle] using
                RecursiveAlpha.trans renamedProcess
                  (RecursiveAlpha.symm binderRelation)
            · simpa [RecursiveProc.substituteCaptureAvoidingAux,
                stops, conflicts, channelNe] using
                RecursiveAlpha.recv
                  (inductionHypothesis next nextAbsent)
      | choice left right =>
          have absentParts :
              needle ∉ left.freeNames ∧ needle ∉ right.freeNames := by
            simpa [RecursiveProc.freeNames] using absent
          simpa [RecursiveProc.substituteCaptureAvoidingAux] using
            RecursiveAlpha.choice
              (inductionHypothesis left absentParts.1)
              (inductionHypothesis right absentParts.2)
      | par left right =>
          have absentParts :
              needle ∉ left.freeNames ∧ needle ∉ right.freeNames := by
            simpa [RecursiveProc.freeNames] using absent
          simpa [RecursiveProc.substituteCaptureAvoidingAux] using
            RecursiveAlpha.par
              (inductionHypothesis left absentParts.1)
              (inductionHypothesis right absentParts.2)
      | new binder body =>
          by_cases stops : binder = needle
          · simpa [RecursiveProc.substituteCaptureAvoidingAux, stops] using
              (RecursiveAlpha.refl (RecursiveProc.new binder body))
          · have bodyAbsent : needle ∉ body.freeNames := by
              intro member
              apply absent
              simp [RecursiveProc.freeNames, member, Ne.symm stops]
            by_cases conflicts : binder = replacement
            · have replacementNeNeedle : replacement ≠ needle := by
                intro equality
                apply stops
                exact conflicts.trans equality
              let fresh := body.freshName needle replacement
              let renamed := body.renameBound binder fresh
              have freshAll : fresh ∉ body.allNames := by
                exact body.freshName_not_mem_allNames needle replacement
              have freshNeNeedle : fresh ≠ needle :=
                body.freshName_ne_needle needle replacement
              have renamedAbsent : needle ∉ renamed.freeNames := by
                have supportEq :
                    renamed.freeNames.erase fresh =
                      body.freeNames.erase binder := by
                  simpa [renamed, RecursiveProc.renameBound] using
                    (RecursiveProc.freeNames_substRaw_erase_replacement
                      body binder fresh freshAll)
                intro member
                have erased :
                    needle ∈ renamed.freeNames.erase fresh :=
                  Finset.mem_erase.mpr ⟨Ne.symm freshNeNeedle, member⟩
                rw [supportEq] at erased
                exact bodyAbsent (Finset.mem_of_mem_erase erased)
              have bodyRelation :
                  RecursiveAlpha
                    (renamed.substituteCaptureAvoidingAux
                      fuel needle replacement)
                    renamed :=
                inductionHypothesis renamed renamedAbsent
              have renamedProcess :
                  RecursiveAlpha
                    (.new fresh
                      (renamed.substituteCaptureAvoidingAux
                        fuel needle replacement))
                    (.new fresh renamed) :=
                RecursiveAlpha.new bodyRelation
              have binderRelation :
                  RecursiveAlpha
                    (.new binder body)
                    (.new fresh renamed) := by
                simpa [fresh, renamed] using
                  (RecursiveAlpha.newBinder freshAll
                    (binder := binder))
              simpa [RecursiveProc.substituteCaptureAvoidingAux,
                stops, conflicts, fresh, renamed,
                replacementNeNeedle] using
                RecursiveAlpha.trans renamedProcess
                  (RecursiveAlpha.symm binderRelation)
            · simpa [RecursiveProc.substituteCaptureAvoidingAux,
                stops, conflicts] using
                RecursiveAlpha.new
                  (inductionHypothesis body bodyAbsent)
      | matchEq left right next =>
          have absentParts :
              left ≠ needle ∧ right ≠ needle ∧
                needle ∉ next.freeNames := by
            have raw :
                needle ≠ left ∧ needle ≠ right ∧
                  needle ∉ next.freeNames := by
              simpa [RecursiveProc.freeNames] using absent
            exact ⟨Ne.symm raw.1, Ne.symm raw.2.1, raw.2.2⟩
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            absentParts.1, absentParts.2.1] using
            RecursiveAlpha.matchEq
              (inductionHypothesis next absentParts.2.2)
      | matchNe left right next =>
          have absentParts :
              left ≠ needle ∧ right ≠ needle ∧
                needle ∉ next.freeNames := by
            have raw :
                needle ≠ left ∧ needle ≠ right ∧
                  needle ∉ next.freeNames := by
              simpa [RecursiveProc.freeNames] using absent
            exact ⟨Ne.symm raw.1, Ne.symm raw.2.1, raw.2.2⟩
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            absentParts.1, absentParts.2.1] using
            RecursiveAlpha.matchNe
              (inductionHypothesis next absentParts.2.2)
      | repTau body =>
          apply RecursiveAlpha.repTau
          apply inductionHypothesis
          simpa [RecursiveProc.freeNames] using absent
      | repSend channel value body =>
          have absentParts :
              channel ≠ needle ∧ value ≠ needle ∧
                needle ∉ body.freeNames := by
            have raw :
                needle ≠ channel ∧ needle ≠ value ∧
                  needle ∉ body.freeNames := by
              simpa [RecursiveProc.freeNames] using absent
            exact ⟨Ne.symm raw.1, Ne.symm raw.2.1, raw.2.2⟩
          simpa [RecursiveProc.substituteCaptureAvoidingAux,
            absentParts.1, absentParts.2.1] using
            RecursiveAlpha.repSend
              (inductionHypothesis body absentParts.2.2)
      | repRecv channel binder body =>
          have channelNe : channel ≠ needle := by
            intro equality
            apply absent
            simp [RecursiveProc.freeNames, equality]
          by_cases stops : binder = needle
          · simpa [RecursiveProc.substituteCaptureAvoidingAux,
              stops, channelNe] using
              (RecursiveAlpha.refl
                (RecursiveProc.repRecv channel binder body))
          · have bodyAbsent : needle ∉ body.freeNames := by
              intro member
              apply absent
              simp [RecursiveProc.freeNames, Ne.symm channelNe,
                member, Ne.symm stops]
            by_cases conflicts : binder = replacement
            · have replacementNeNeedle : replacement ≠ needle := by
                intro equality
                apply stops
                exact conflicts.trans equality
              let fresh := body.freshName needle replacement
              let renamed := body.renameBound binder fresh
              have freshAll : fresh ∉ body.allNames := by
                exact body.freshName_not_mem_allNames needle replacement
              have freshNeNeedle : fresh ≠ needle :=
                body.freshName_ne_needle needle replacement
              have renamedAbsent : needle ∉ renamed.freeNames := by
                have supportEq :
                    renamed.freeNames.erase fresh =
                      body.freeNames.erase binder := by
                  simpa [renamed, RecursiveProc.renameBound] using
                    (RecursiveProc.freeNames_substRaw_erase_replacement
                      body binder fresh freshAll)
                intro member
                have erased :
                    needle ∈ renamed.freeNames.erase fresh :=
                  Finset.mem_erase.mpr ⟨Ne.symm freshNeNeedle, member⟩
                rw [supportEq] at erased
                exact bodyAbsent (Finset.mem_of_mem_erase erased)
              have bodyRelation :
                  RecursiveAlpha
                    (renamed.substituteCaptureAvoidingAux
                      fuel needle replacement)
                    renamed :=
                inductionHypothesis renamed renamedAbsent
              have renamedProcess :
                  RecursiveAlpha
                    (.repRecv
                      (if channel = needle then replacement else channel)
                      fresh
                      (renamed.substituteCaptureAvoidingAux
                        fuel needle replacement))
                    (.repRecv channel fresh renamed) := by
                simpa [channelNe] using RecursiveAlpha.repRecv bodyRelation
              have binderRelation :
                  RecursiveAlpha
                    (.repRecv channel binder body)
                    (.repRecv channel fresh renamed) := by
                simpa [fresh, renamed] using
                  (RecursiveAlpha.repRecvBinder freshAll
                    (channel := channel) (binder := binder))
              simpa [RecursiveProc.substituteCaptureAvoidingAux,
                stops, conflicts, fresh, renamed, channelNe,
                replacementNeNeedle] using
                RecursiveAlpha.trans renamedProcess
                  (RecursiveAlpha.symm binderRelation)
            · simpa [RecursiveProc.substituteCaptureAvoidingAux,
                stops, conflicts, channelNe] using
                RecursiveAlpha.repRecv
                  (inductionHypothesis body bodyAbsent)

/--
Normalize one restriction to a caller-chosen binder fresh for every body that
can occur in the normalization.  The callback is used only on a relation
between strict subterms.
-/
theorem substituteCaptureAvoidingAux_new_to_common
    (fuel : Nat) (body : RecursiveProc)
    (binder needle replacement common : Name)
    (commonFreshBody : common ∉ body.allNames)
    (commonFreshDirect :
      common ∉
        (body.substituteCaptureAvoidingAux
          fuel needle replacement).allNames)
    (commonFreshConflict :
      common ∉
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder
            (body.freshName needle replacement))
          needle replacement).allNames)
    (commonNeNeedle : common ≠ needle)
    (commonNeReplacement : common ≠ replacement)
    (normalCongruent :
      RecursiveAlpha
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (RecursivePermutation.process
            (Equiv.swap binder common) body)
          needle replacement)
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder common)
          needle replacement)) :
    RecursiveAlpha
      (RecursiveProc.substituteCaptureAvoidingAux
        (fuel + 1) (.new binder body)
        needle replacement)
      (.new common
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder common)
          needle replacement)) := by
  by_cases stops : binder = needle
  · subst binder
    let canonicalBody := body.renameBound needle common
    have needleAbsentCanonical :
        needle ∉ canonicalBody.freeNames := by
      have supportEq :
          canonicalBody.freeNames.erase common =
            body.freeNames.erase needle := by
        simpa [canonicalBody, RecursiveProc.renameBound] using
          (RecursiveProc.freeNames_substRaw_erase_replacement
            body needle common commonFreshBody)
      intro member
      have erased :
          needle ∈ canonicalBody.freeNames.erase common :=
        Finset.mem_erase.mpr ⟨Ne.symm commonNeNeedle, member⟩
      rw [supportEq] at erased
      exact (Finset.mem_erase.mp erased).1 rfl
    have unchanged :
        RecursiveAlpha
          (canonicalBody.substituteCaptureAvoidingAux
            fuel needle replacement)
          canonicalBody :=
      substituteCaptureAvoidingAux_alpha_self_of_needle_not_free
        fuel canonicalBody needle replacement needleAbsentCanonical
    have binderRelation :
        RecursiveAlpha
          (.new needle body)
          (.new common canonicalBody) := by
      simpa [canonicalBody] using
        (RecursiveAlpha.newBinder commonFreshBody
          (binder := needle))
    simpa [RecursiveProc.substituteCaptureAvoidingAux,
      canonicalBody] using
      RecursiveAlpha.trans binderRelation
        (RecursiveAlpha.new (RecursiveAlpha.symm unchanged))
  · by_cases conflicts : binder = replacement
    · let fresh := body.freshName needle replacement
      let freshenedBody := body.renameBound binder fresh
      let leftResult :=
        freshenedBody.substituteCaptureAvoidingAux
          fuel needle replacement
      let canonicalBody := body.renameBound binder common
      let canonicalResult :=
        canonicalBody.substituteCaptureAvoidingAux
          fuel needle replacement
      have freshBody : fresh ∉ body.allNames :=
        body.freshName_not_mem_allNames needle replacement
      have freshNeNeedle : fresh ≠ needle :=
        body.freshName_ne_needle needle replacement
      have freshNeReplacement : fresh ≠ replacement :=
        body.freshName_ne_replacement needle replacement
      have freshNeBinder : fresh ≠ binder := by
        simpa [conflicts] using freshNeReplacement
      have commonNeBinder : common ≠ binder := by
        simpa [conflicts] using commonNeReplacement
      have replacementNeNeedle : replacement ≠ needle := by
        intro equality
        apply stops
        exact conflicts.trans equality
      have aligned :
          RecursiveAlpha
            (leftResult.renameBound fresh common)
            canonicalResult := by
        simpa [fresh, freshenedBody, leftResult,
          canonicalBody, canonicalResult] using
          (RecursivePermutation.substituteAux_freshChoice_to_common
            fuel body binder needle replacement fresh common
            freshBody commonFreshBody
            (by simpa [fresh, freshenedBody, leftResult] using
              commonFreshConflict)
            freshNeBinder commonNeBinder
            freshNeNeedle freshNeReplacement
            commonNeNeedle commonNeReplacement)
      have normalized :
          RecursiveAlpha
            (.new fresh leftResult)
            (.new common canonicalResult) := by
        have binderConversion :
            RecursiveAlpha
              (.new fresh leftResult)
              (.new common
                (leftResult.renameBound fresh common)) := by
          exact RecursiveAlpha.newBinder
            (by simpa [leftResult, freshenedBody, fresh] using
              commonFreshConflict)
        exact RecursiveAlpha.trans binderConversion
          (RecursiveAlpha.new aligned)
      simpa [RecursiveProc.substituteCaptureAvoidingAux,
        stops, conflicts, fresh, freshenedBody, leftResult,
        canonicalBody, canonicalResult,
        replacementNeNeedle] using normalized
    · let directResult :=
        body.substituteCaptureAvoidingAux fuel needle replacement
      let canonicalBody := body.renameBound binder common
      let canonicalResult :=
        canonicalBody.substituteCaptureAvoidingAux
          fuel needle replacement
      let swap : Equiv.Perm Name := Equiv.swap binder common
      have swapNeedle : swap needle = needle := by
        apply Equiv.swap_apply_of_ne_of_ne
        · exact Ne.symm stops
        · exact Ne.symm commonNeNeedle
      have swapReplacement : swap replacement = replacement := by
        apply Equiv.swap_apply_of_ne_of_ne
        · exact Ne.symm conflicts
        · exact Ne.symm commonNeReplacement
      have renamedToPermuted :
          RecursiveAlpha
            (directResult.renameBound binder common)
            (RecursivePermutation.process swap directResult) :=
        RecursiveAlpha.symm
          (RecursivePermutation.process_swap_fresh_alpha_substRaw
            directResult binder common
            (by simpa [directResult] using commonFreshDirect))
      have equivariant :
          RecursiveAlpha
            (RecursivePermutation.process swap directResult)
            (RecursiveProc.substituteCaptureAvoidingAux fuel
              (RecursivePermutation.process swap body)
              needle replacement) := by
        simpa [directResult, swapNeedle, swapReplacement] using
          (RecursivePermutation.substituteCaptureAvoidingAux_permute_alpha
            fuel swap body needle replacement)
      have recursiveRelation :
          RecursiveAlpha
            (RecursiveProc.substituteCaptureAvoidingAux fuel
              (RecursivePermutation.process swap body)
              needle replacement)
            canonicalResult := by
        simpa [swap, canonicalResult, canonicalBody] using
          normalCongruent
      have bodyRelation :
          RecursiveAlpha
            (directResult.renameBound binder common)
            canonicalResult :=
        RecursiveAlpha.trans renamedToPermuted
          (RecursiveAlpha.trans equivariant recursiveRelation)
      have normalized :
          RecursiveAlpha
            (.new binder directResult)
            (.new common canonicalResult) := by
        have binderConversion :
            RecursiveAlpha
              (.new binder directResult)
              (.new common
                (directResult.renameBound binder common)) := by
          exact RecursiveAlpha.newBinder
            (by simpa [directResult] using commonFreshDirect)
        exact RecursiveAlpha.trans binderConversion
          (RecursiveAlpha.new bodyRelation)
      simpa [RecursiveProc.substituteCaptureAvoidingAux,
        stops, conflicts, directResult, canonicalBody,
        canonicalResult] using normalized

/--
Normalize one input binder to a caller-chosen common spelling.  The channel
is substituted identically on both sides; only the derivative binder needs
common-fresh alignment.
-/
theorem substituteCaptureAvoidingAux_recv_to_common
    (fuel : Nat) (channel : Name) (body : RecursiveProc)
    (binder needle replacement common : Name)
    (commonFreshBody : common ∉ body.allNames)
    (commonFreshDirect :
      common ∉
        (body.substituteCaptureAvoidingAux
          fuel needle replacement).allNames)
    (commonFreshConflict :
      common ∉
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder
            (body.freshName needle replacement))
          needle replacement).allNames)
    (commonNeNeedle : common ≠ needle)
    (commonNeReplacement : common ≠ replacement)
    (normalCongruent :
      RecursiveAlpha
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (RecursivePermutation.process
            (Equiv.swap binder common) body)
          needle replacement)
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder common)
          needle replacement)) :
    RecursiveAlpha
      (RecursiveProc.substituteCaptureAvoidingAux
        (fuel + 1) (.recv channel binder body)
        needle replacement)
      (.recv
        (if channel = needle then replacement else channel)
        common
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder common)
          needle replacement)) := by
  let channel' := if channel = needle then replacement else channel
  by_cases stops : binder = needle
  · subst binder
    let canonicalBody := body.renameBound needle common
    have needleAbsentCanonical :
        needle ∉ canonicalBody.freeNames := by
      have supportEq :
          canonicalBody.freeNames.erase common =
            body.freeNames.erase needle := by
        simpa [canonicalBody, RecursiveProc.renameBound] using
          (RecursiveProc.freeNames_substRaw_erase_replacement
            body needle common commonFreshBody)
      intro member
      have erased :
          needle ∈ canonicalBody.freeNames.erase common :=
        Finset.mem_erase.mpr ⟨Ne.symm commonNeNeedle, member⟩
      rw [supportEq] at erased
      exact (Finset.mem_erase.mp erased).1 rfl
    have unchanged :
        RecursiveAlpha
          (canonicalBody.substituteCaptureAvoidingAux
            fuel needle replacement)
          canonicalBody :=
      substituteCaptureAvoidingAux_alpha_self_of_needle_not_free
        fuel canonicalBody needle replacement needleAbsentCanonical
    have binderRelation :
        RecursiveAlpha
          (.recv channel' needle body)
          (.recv channel' common canonicalBody) := by
      simpa [canonicalBody] using
        (RecursiveAlpha.recvBinder commonFreshBody
          (channel := channel') (binder := needle))
    simpa [RecursiveProc.substituteCaptureAvoidingAux,
      canonicalBody, channel'] using
      RecursiveAlpha.trans binderRelation
        (RecursiveAlpha.recv (RecursiveAlpha.symm unchanged))
  · by_cases conflicts : binder = replacement
    · let fresh := body.freshName needle replacement
      let freshenedBody := body.renameBound binder fresh
      let leftResult :=
        freshenedBody.substituteCaptureAvoidingAux
          fuel needle replacement
      let canonicalBody := body.renameBound binder common
      let canonicalResult :=
        canonicalBody.substituteCaptureAvoidingAux
          fuel needle replacement
      have freshBody : fresh ∉ body.allNames :=
        body.freshName_not_mem_allNames needle replacement
      have freshNeNeedle : fresh ≠ needle :=
        body.freshName_ne_needle needle replacement
      have freshNeReplacement : fresh ≠ replacement :=
        body.freshName_ne_replacement needle replacement
      have freshNeBinder : fresh ≠ binder := by
        simpa [conflicts] using freshNeReplacement
      have commonNeBinder : common ≠ binder := by
        simpa [conflicts] using commonNeReplacement
      have replacementNeNeedle : replacement ≠ needle := by
        intro equality
        apply stops
        exact conflicts.trans equality
      have aligned :
          RecursiveAlpha
            (leftResult.renameBound fresh common)
            canonicalResult := by
        simpa [fresh, freshenedBody, leftResult,
          canonicalBody, canonicalResult] using
          (RecursivePermutation.substituteAux_freshChoice_to_common
            fuel body binder needle replacement fresh common
            freshBody commonFreshBody
            (by simpa [fresh, freshenedBody, leftResult] using
              commonFreshConflict)
            freshNeBinder commonNeBinder
            freshNeNeedle freshNeReplacement
            commonNeNeedle commonNeReplacement)
      have normalized :
          RecursiveAlpha
            (.recv channel' fresh leftResult)
            (.recv channel' common canonicalResult) := by
        have binderConversion :
            RecursiveAlpha
              (.recv channel' fresh leftResult)
              (.recv channel' common
                (leftResult.renameBound fresh common)) := by
          exact RecursiveAlpha.recvBinder
            (by simpa [leftResult, freshenedBody, fresh] using
              commonFreshConflict)
        exact RecursiveAlpha.trans binderConversion
          (RecursiveAlpha.recv aligned)
      simpa [RecursiveProc.substituteCaptureAvoidingAux,
        stops, conflicts, fresh, freshenedBody, leftResult,
        canonicalBody, canonicalResult, channel',
        replacementNeNeedle] using normalized
    · let directResult :=
        body.substituteCaptureAvoidingAux fuel needle replacement
      let canonicalBody := body.renameBound binder common
      let canonicalResult :=
        canonicalBody.substituteCaptureAvoidingAux
          fuel needle replacement
      let swap : Equiv.Perm Name := Equiv.swap binder common
      have swapNeedle : swap needle = needle := by
        apply Equiv.swap_apply_of_ne_of_ne
        · exact Ne.symm stops
        · exact Ne.symm commonNeNeedle
      have swapReplacement : swap replacement = replacement := by
        apply Equiv.swap_apply_of_ne_of_ne
        · exact Ne.symm conflicts
        · exact Ne.symm commonNeReplacement
      have renamedToPermuted :
          RecursiveAlpha
            (directResult.renameBound binder common)
            (RecursivePermutation.process swap directResult) :=
        RecursiveAlpha.symm
          (RecursivePermutation.process_swap_fresh_alpha_substRaw
            directResult binder common
            (by simpa [directResult] using commonFreshDirect))
      have equivariant :
          RecursiveAlpha
            (RecursivePermutation.process swap directResult)
            (RecursiveProc.substituteCaptureAvoidingAux fuel
              (RecursivePermutation.process swap body)
              needle replacement) := by
        simpa [directResult, swapNeedle, swapReplacement] using
          (RecursivePermutation.substituteCaptureAvoidingAux_permute_alpha
            fuel swap body needle replacement)
      have recursiveRelation :
          RecursiveAlpha
            (RecursiveProc.substituteCaptureAvoidingAux fuel
              (RecursivePermutation.process swap body)
              needle replacement)
            canonicalResult := by
        simpa [swap, canonicalResult, canonicalBody] using
          normalCongruent
      have bodyRelation :
          RecursiveAlpha
            (directResult.renameBound binder common)
            canonicalResult :=
        RecursiveAlpha.trans renamedToPermuted
          (RecursiveAlpha.trans equivariant recursiveRelation)
      have normalized :
          RecursiveAlpha
            (.recv channel' binder directResult)
            (.recv channel' common canonicalResult) := by
        have binderConversion :
            RecursiveAlpha
              (.recv channel' binder directResult)
              (.recv channel' common
                (directResult.renameBound binder common)) := by
          exact RecursiveAlpha.recvBinder
            (by simpa [directResult] using commonFreshDirect)
        exact RecursiveAlpha.trans binderConversion
          (RecursiveAlpha.recv bodyRelation)
      simpa [RecursiveProc.substituteCaptureAvoidingAux,
        stops, conflicts, directResult, canonicalBody,
        canonicalResult, channel'] using normalized

/-- Replicated-input counterpart of `substituteCaptureAvoidingAux_recv_to_common`. -/
theorem substituteCaptureAvoidingAux_repRecv_to_common
    (fuel : Nat) (channel : Name) (body : RecursiveProc)
    (binder needle replacement common : Name)
    (commonFreshBody : common ∉ body.allNames)
    (commonFreshDirect :
      common ∉
        (body.substituteCaptureAvoidingAux
          fuel needle replacement).allNames)
    (commonFreshConflict :
      common ∉
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder
            (body.freshName needle replacement))
          needle replacement).allNames)
    (commonNeNeedle : common ≠ needle)
    (commonNeReplacement : common ≠ replacement)
    (normalCongruent :
      RecursiveAlpha
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (RecursivePermutation.process
            (Equiv.swap binder common) body)
          needle replacement)
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder common)
          needle replacement)) :
    RecursiveAlpha
      (RecursiveProc.substituteCaptureAvoidingAux
        (fuel + 1) (.repRecv channel binder body)
        needle replacement)
      (.repRecv
        (if channel = needle then replacement else channel)
        common
        (RecursiveProc.substituteCaptureAvoidingAux fuel
          (body.renameBound binder common)
          needle replacement)) := by
  let channel' := if channel = needle then replacement else channel
  by_cases stops : binder = needle
  · subst binder
    let canonicalBody := body.renameBound needle common
    have needleAbsentCanonical :
        needle ∉ canonicalBody.freeNames := by
      have supportEq :
          canonicalBody.freeNames.erase common =
            body.freeNames.erase needle := by
        simpa [canonicalBody, RecursiveProc.renameBound] using
          (RecursiveProc.freeNames_substRaw_erase_replacement
            body needle common commonFreshBody)
      intro member
      have erased :
          needle ∈ canonicalBody.freeNames.erase common :=
        Finset.mem_erase.mpr ⟨Ne.symm commonNeNeedle, member⟩
      rw [supportEq] at erased
      exact (Finset.mem_erase.mp erased).1 rfl
    have unchanged :
        RecursiveAlpha
          (canonicalBody.substituteCaptureAvoidingAux
            fuel needle replacement)
          canonicalBody :=
      substituteCaptureAvoidingAux_alpha_self_of_needle_not_free
        fuel canonicalBody needle replacement needleAbsentCanonical
    have binderRelation :
        RecursiveAlpha
          (.repRecv channel' needle body)
          (.repRecv channel' common canonicalBody) := by
      simpa [canonicalBody] using
        (RecursiveAlpha.repRecvBinder commonFreshBody
          (channel := channel') (binder := needle))
    simpa [RecursiveProc.substituteCaptureAvoidingAux,
      canonicalBody, channel'] using
      RecursiveAlpha.trans binderRelation
        (RecursiveAlpha.repRecv (RecursiveAlpha.symm unchanged))
  · by_cases conflicts : binder = replacement
    · let fresh := body.freshName needle replacement
      let freshenedBody := body.renameBound binder fresh
      let leftResult :=
        freshenedBody.substituteCaptureAvoidingAux
          fuel needle replacement
      let canonicalBody := body.renameBound binder common
      let canonicalResult :=
        canonicalBody.substituteCaptureAvoidingAux
          fuel needle replacement
      have freshBody : fresh ∉ body.allNames :=
        body.freshName_not_mem_allNames needle replacement
      have freshNeNeedle : fresh ≠ needle :=
        body.freshName_ne_needle needle replacement
      have freshNeReplacement : fresh ≠ replacement :=
        body.freshName_ne_replacement needle replacement
      have freshNeBinder : fresh ≠ binder := by
        simpa [conflicts] using freshNeReplacement
      have commonNeBinder : common ≠ binder := by
        simpa [conflicts] using commonNeReplacement
      have replacementNeNeedle : replacement ≠ needle := by
        intro equality
        apply stops
        exact conflicts.trans equality
      have aligned :
          RecursiveAlpha
            (leftResult.renameBound fresh common)
            canonicalResult := by
        simpa [fresh, freshenedBody, leftResult,
          canonicalBody, canonicalResult] using
          (RecursivePermutation.substituteAux_freshChoice_to_common
            fuel body binder needle replacement fresh common
            freshBody commonFreshBody
            (by simpa [fresh, freshenedBody, leftResult] using
              commonFreshConflict)
            freshNeBinder commonNeBinder
            freshNeNeedle freshNeReplacement
            commonNeNeedle commonNeReplacement)
      have normalized :
          RecursiveAlpha
            (.repRecv channel' fresh leftResult)
            (.repRecv channel' common canonicalResult) := by
        have binderConversion :
            RecursiveAlpha
              (.repRecv channel' fresh leftResult)
              (.repRecv channel' common
                (leftResult.renameBound fresh common)) := by
          exact RecursiveAlpha.repRecvBinder
            (by simpa [leftResult, freshenedBody, fresh] using
              commonFreshConflict)
        exact RecursiveAlpha.trans binderConversion
          (RecursiveAlpha.repRecv aligned)
      simpa [RecursiveProc.substituteCaptureAvoidingAux,
        stops, conflicts, fresh, freshenedBody, leftResult,
        canonicalBody, canonicalResult, channel',
        replacementNeNeedle] using normalized
    · let directResult :=
        body.substituteCaptureAvoidingAux fuel needle replacement
      let canonicalBody := body.renameBound binder common
      let canonicalResult :=
        canonicalBody.substituteCaptureAvoidingAux
          fuel needle replacement
      let swap : Equiv.Perm Name := Equiv.swap binder common
      have swapNeedle : swap needle = needle := by
        apply Equiv.swap_apply_of_ne_of_ne
        · exact Ne.symm stops
        · exact Ne.symm commonNeNeedle
      have swapReplacement : swap replacement = replacement := by
        apply Equiv.swap_apply_of_ne_of_ne
        · exact Ne.symm conflicts
        · exact Ne.symm commonNeReplacement
      have renamedToPermuted :
          RecursiveAlpha
            (directResult.renameBound binder common)
            (RecursivePermutation.process swap directResult) :=
        RecursiveAlpha.symm
          (RecursivePermutation.process_swap_fresh_alpha_substRaw
            directResult binder common
            (by simpa [directResult] using commonFreshDirect))
      have equivariant :
          RecursiveAlpha
            (RecursivePermutation.process swap directResult)
            (RecursiveProc.substituteCaptureAvoidingAux fuel
              (RecursivePermutation.process swap body)
              needle replacement) := by
        simpa [directResult, swapNeedle, swapReplacement] using
          (RecursivePermutation.substituteCaptureAvoidingAux_permute_alpha
            fuel swap body needle replacement)
      have recursiveRelation :
          RecursiveAlpha
            (RecursiveProc.substituteCaptureAvoidingAux fuel
              (RecursivePermutation.process swap body)
              needle replacement)
            canonicalResult := by
        simpa [swap, canonicalResult, canonicalBody] using
          normalCongruent
      have bodyRelation :
          RecursiveAlpha
            (directResult.renameBound binder common)
            canonicalResult :=
        RecursiveAlpha.trans renamedToPermuted
          (RecursiveAlpha.trans equivariant recursiveRelation)
      have normalized :
          RecursiveAlpha
            (.repRecv channel' binder directResult)
            (.repRecv channel' common canonicalResult) := by
        have binderConversion :
            RecursiveAlpha
              (.repRecv channel' binder directResult)
              (.repRecv channel' common
                (directResult.renameBound binder common)) := by
          exact RecursiveAlpha.repRecvBinder
            (by simpa [directResult] using commonFreshDirect)
        exact RecursiveAlpha.trans binderConversion
          (RecursiveAlpha.repRecv bodyRelation)
      simpa [RecursiveProc.substituteCaptureAvoidingAux,
        stops, conflicts, directResult, canonicalBody,
        canonicalResult, channel'] using normalized

end RecursiveAlpha

end Cantilune.Pi
