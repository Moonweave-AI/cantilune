import Cantilune.Pi.LateGuardedReplicationAlphaSubstitutionCongruence

namespace Cantilune.Pi

open RecursiveProc

namespace RecursiveAlpha

/--
Fuelled capture-avoiding substitution respects recursive alpha conversion.
The outer induction decreases structural depth for freshly derived body
relations; the inner induction follows the given alpha derivation.
-/
theorem substituteCaptureAvoidingAux_congr_of_depth (depth : Nat) :
    ∀ {left right : RecursiveProc},
      RecursiveAlpha left right →
      left.syntaxDepth ≤ depth →
      ∀ fuel needle replacement,
        RecursiveAlpha
          (left.substituteCaptureAvoidingAux fuel needle replacement)
          (right.substituteCaptureAvoidingAux fuel needle replacement) := by
  induction depth with
  | zero =>
      intro left right relation enough
      have positive := RecursiveProc.syntaxDepth_pos left
      omega
  | succ depth outerIH =>
      intro left right relation
      induction relation with
      | refl =>
          intro enough fuel needle replacement
          exact RecursiveAlpha.refl _
      | symm relation inductionHypothesis =>
          intro enough fuel needle replacement
          apply RecursiveAlpha.symm
          apply inductionHypothesis
          · rw [RecursiveAlpha.syntaxDepth_eq relation]
            exact enough
      | trans first second firstIH secondIH =>
          intro enough fuel needle replacement
          apply RecursiveAlpha.trans
          · exact firstIH enough fuel needle replacement
          · apply secondIH
            · rw [← RecursiveAlpha.syntaxDepth_eq first]
              exact enough
      | tau relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.tau relation
          | succ fuel =>
              apply RecursiveAlpha.tau
              apply inductionHypothesis
              simp [RecursiveProc.syntaxDepth] at enough ⊢
              omega
      | send relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.send relation
          | succ fuel =>
              apply RecursiveAlpha.send
              apply inductionHypothesis
              simp [RecursiveProc.syntaxDepth] at enough ⊢
              omega
      | @recv body body' channel binder relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.recv relation
          | succ fuel =>
              have strict : body.syntaxDepth ≤ depth := by
                simpa [RecursiveProc.syntaxDepth] using enough
              let common :=
                RecursiveProc.substitutionCongruenceFresh
                  fuel body body' binder binder needle replacement
              have leftFreshBody : common ∉ body.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftBody
                    fuel body body' binder binder needle replacement)
              have rightFreshBody : common ∉ body'.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightBody
                    fuel body body' binder binder needle replacement)
              have leftFreshDirect :
                  common ∉
                    (body.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftDirect
                    fuel body body' binder binder needle replacement)
              have rightFreshDirect :
                  common ∉
                    (body'.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightDirect
                    fuel body body' binder binder needle replacement)
              have leftFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder
                        (body.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftConflict
                    fuel body body' binder binder needle replacement)
              have rightFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body'.renameBound binder
                        (body'.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightConflict
                    fuel body body' binder binder needle replacement)
              have commonNeNeedle : common ≠ needle := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_needle
                    fuel body body' binder binder needle replacement)
              have commonNeReplacement : common ≠ replacement := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_replacement
                    fuel body body' binder binder needle replacement)
              have leftSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body)
                    (body.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body binder common leftFreshBody)
              have rightSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body')
                    (body'.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body' binder common rightFreshBody)
              have leftNormalCongruent :=
                outerIH leftSourceAlpha
                  (by simpa using strict)
                  fuel needle replacement
              have rightStrict : body'.syntaxDepth ≤ depth := by
                rw [← RecursiveAlpha.syntaxDepth_eq relation]
                exact strict
              have rightNormalCongruent :=
                outerIH rightSourceAlpha
                  (by simpa using rightStrict)
                  fuel needle replacement
              have canonicalSourceAlpha :=
                RecursiveAlpha.substRaw_fresh_congr
                  relation binder common leftFreshBody rightFreshBody
              have canonicalCongruent :=
                outerIH canonicalSourceAlpha
                  (by
                    simpa [RecursiveProc.renameBound,
                      RecursiveProc.syntaxDepth_substRaw] using strict)
                  fuel needle replacement
              have leftNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_recv_to_common
                  fuel channel body binder needle replacement common
                  leftFreshBody leftFreshDirect leftFreshConflict
                  commonNeNeedle commonNeReplacement
                  leftNormalCongruent
              have rightNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_recv_to_common
                  fuel channel body' binder needle replacement common
                  rightFreshBody rightFreshDirect rightFreshConflict
                  commonNeNeedle commonNeReplacement
                  rightNormalCongruent
              exact RecursiveAlpha.trans leftNormalized
                (RecursiveAlpha.trans
                  (RecursiveAlpha.recv canonicalCongruent)
                  (RecursiveAlpha.symm rightNormalized))
      | choice leftRelation rightRelation leftIH rightIH =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.choice leftRelation rightRelation
          | succ fuel =>
              apply RecursiveAlpha.choice
              · apply leftIH
                simp [RecursiveProc.syntaxDepth] at enough ⊢
                omega
              · apply rightIH
                simp [RecursiveProc.syntaxDepth] at enough ⊢
                omega
      | par leftRelation rightRelation leftIH rightIH =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.par leftRelation rightRelation
          | succ fuel =>
              apply RecursiveAlpha.par
              · apply leftIH
                simp [RecursiveProc.syntaxDepth] at enough ⊢
                omega
              · apply rightIH
                simp [RecursiveProc.syntaxDepth] at enough ⊢
                omega
      | @new body body' binder relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.new relation
          | succ fuel =>
              have strict : body.syntaxDepth ≤ depth := by
                simpa [RecursiveProc.syntaxDepth] using enough
              let common :=
                RecursiveProc.substitutionCongruenceFresh
                  fuel body body' binder binder needle replacement
              have leftFreshBody : common ∉ body.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftBody
                    fuel body body' binder binder needle replacement)
              have rightFreshBody : common ∉ body'.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightBody
                    fuel body body' binder binder needle replacement)
              have leftFreshDirect :
                  common ∉
                    (body.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftDirect
                    fuel body body' binder binder needle replacement)
              have rightFreshDirect :
                  common ∉
                    (body'.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightDirect
                    fuel body body' binder binder needle replacement)
              have leftFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder
                        (body.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftConflict
                    fuel body body' binder binder needle replacement)
              have rightFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body'.renameBound binder
                        (body'.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightConflict
                    fuel body body' binder binder needle replacement)
              have commonNeNeedle : common ≠ needle := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_needle
                    fuel body body' binder binder needle replacement)
              have commonNeReplacement : common ≠ replacement := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_replacement
                    fuel body body' binder binder needle replacement)
              have leftSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body)
                    (body.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body binder common leftFreshBody)
              have rightSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body')
                    (body'.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body' binder common rightFreshBody)
              have leftNormalCongruent :=
                outerIH leftSourceAlpha
                  (by simpa using strict)
                  fuel needle replacement
              have rightStrict : body'.syntaxDepth ≤ depth := by
                rw [← RecursiveAlpha.syntaxDepth_eq relation]
                exact strict
              have rightNormalCongruent :=
                outerIH rightSourceAlpha
                  (by simpa using rightStrict)
                  fuel needle replacement
              have canonicalSourceAlpha :=
                RecursiveAlpha.substRaw_fresh_congr
                  relation binder common leftFreshBody rightFreshBody
              have canonicalCongruent :=
                outerIH canonicalSourceAlpha
                  (by
                    simpa [RecursiveProc.renameBound,
                      RecursiveProc.syntaxDepth_substRaw] using strict)
                  fuel needle replacement
              have leftNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_new_to_common
                  fuel body binder needle replacement common
                  leftFreshBody leftFreshDirect leftFreshConflict
                  commonNeNeedle commonNeReplacement
                  leftNormalCongruent
              have rightNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_new_to_common
                  fuel body' binder needle replacement common
                  rightFreshBody rightFreshDirect rightFreshConflict
                  commonNeNeedle commonNeReplacement
                  rightNormalCongruent
              exact RecursiveAlpha.trans leftNormalized
                (RecursiveAlpha.trans
                  (RecursiveAlpha.new canonicalCongruent)
                  (RecursiveAlpha.symm rightNormalized))
      | matchEq relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.matchEq relation
          | succ fuel =>
              apply RecursiveAlpha.matchEq
              apply inductionHypothesis
              simp [RecursiveProc.syntaxDepth] at enough ⊢
              omega
      | matchNe relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.matchNe relation
          | succ fuel =>
              apply RecursiveAlpha.matchNe
              apply inductionHypothesis
              simp [RecursiveProc.syntaxDepth] at enough ⊢
              omega
      | repTau relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.repTau relation
          | succ fuel =>
              apply RecursiveAlpha.repTau
              apply inductionHypothesis
              simp [RecursiveProc.syntaxDepth] at enough ⊢
              omega
      | repSend relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.repSend relation
          | succ fuel =>
              apply RecursiveAlpha.repSend
              apply inductionHypothesis
              simp [RecursiveProc.syntaxDepth] at enough ⊢
              omega
      | @repRecv body body' channel binder relation inductionHypothesis =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                RecursiveAlpha.repRecv relation
          | succ fuel =>
              have strict : body.syntaxDepth ≤ depth := by
                simpa [RecursiveProc.syntaxDepth] using enough
              let common :=
                RecursiveProc.substitutionCongruenceFresh
                  fuel body body' binder binder needle replacement
              have leftFreshBody : common ∉ body.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftBody
                    fuel body body' binder binder needle replacement)
              have rightFreshBody : common ∉ body'.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightBody
                    fuel body body' binder binder needle replacement)
              have leftFreshDirect :
                  common ∉
                    (body.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftDirect
                    fuel body body' binder binder needle replacement)
              have rightFreshDirect :
                  common ∉
                    (body'.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightDirect
                    fuel body body' binder binder needle replacement)
              have leftFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder
                        (body.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftConflict
                    fuel body body' binder binder needle replacement)
              have rightFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body'.renameBound binder
                        (body'.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightConflict
                    fuel body body' binder binder needle replacement)
              have commonNeNeedle : common ≠ needle := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_needle
                    fuel body body' binder binder needle replacement)
              have commonNeReplacement : common ≠ replacement := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_replacement
                    fuel body body' binder binder needle replacement)
              have leftSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body)
                    (body.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body binder common leftFreshBody)
              have rightSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body')
                    (body'.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body' binder common rightFreshBody)
              have leftNormalCongruent :=
                outerIH leftSourceAlpha
                  (by simpa using strict)
                  fuel needle replacement
              have rightStrict : body'.syntaxDepth ≤ depth := by
                rw [← RecursiveAlpha.syntaxDepth_eq relation]
                exact strict
              have rightNormalCongruent :=
                outerIH rightSourceAlpha
                  (by simpa using rightStrict)
                  fuel needle replacement
              have canonicalSourceAlpha :=
                RecursiveAlpha.substRaw_fresh_congr
                  relation binder common leftFreshBody rightFreshBody
              have canonicalCongruent :=
                outerIH canonicalSourceAlpha
                  (by
                    simpa [RecursiveProc.renameBound,
                      RecursiveProc.syntaxDepth_substRaw] using strict)
                  fuel needle replacement
              have leftNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_repRecv_to_common
                  fuel channel body binder needle replacement common
                  leftFreshBody leftFreshDirect leftFreshConflict
                  commonNeNeedle commonNeReplacement
                  leftNormalCongruent
              have rightNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_repRecv_to_common
                  fuel channel body' binder needle replacement common
                  rightFreshBody rightFreshDirect rightFreshConflict
                  commonNeNeedle commonNeReplacement
                  rightNormalCongruent
              exact RecursiveAlpha.trans leftNormalized
                (RecursiveAlpha.trans
                  (RecursiveAlpha.repRecv canonicalCongruent)
                  (RecursiveAlpha.symm rightNormalized))
      | @recvBinder alphaReplacement channel binder body fresh =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                (RecursiveAlpha.recvBinder fresh
                  (channel := channel) (binder := binder))
          | succ fuel =>
              let rightBody :=
                body.renameBound binder alphaReplacement
              have strict : body.syntaxDepth ≤ depth := by
                simpa [RecursiveProc.syntaxDepth] using enough
              let common :=
                RecursiveProc.substitutionCongruenceFresh
                  fuel body rightBody binder alphaReplacement
                    needle replacement
              have leftFreshBody : common ∉ body.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftBody
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshBody : common ∉ rightBody.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightBody
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftFreshDirect :
                  common ∉
                    (body.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftDirect
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshDirect :
                  common ∉
                    (rightBody.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightDirect
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder
                        (body.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftConflict
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (rightBody.renameBound alphaReplacement
                        (rightBody.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightConflict
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have commonNeNeedle : common ≠ needle := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_needle
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have commonNeReplacement : common ≠ replacement := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_replacement
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body)
                    (body.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body binder common leftFreshBody)
              have rightSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap alphaReplacement common) rightBody)
                    (rightBody.renameBound alphaReplacement common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    rightBody alphaReplacement common rightFreshBody)
              have leftNormalCongruent :=
                outerIH leftSourceAlpha
                  (by simpa using strict)
                  fuel needle replacement
              have rightStrict : rightBody.syntaxDepth ≤ depth := by
                simpa [rightBody, RecursiveProc.renameBound,
                  RecursiveProc.syntaxDepth_substRaw] using strict
              have rightNormalCongruent :=
                outerIH rightSourceAlpha
                  (by simpa using rightStrict)
                  fuel needle replacement
              have canonicalEq :
                  rightBody.renameBound alphaReplacement common =
                    body.renameBound binder common := by
                simpa [rightBody, RecursiveProc.renameBound] using
                  (RecursiveProc.substRaw_compose_of_intermediate_fresh
                    body binder alphaReplacement common fresh)
              have canonicalCongruent :
                  RecursiveAlpha
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder common)
                      needle replacement)
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (rightBody.renameBound alphaReplacement common)
                      needle replacement) := by
                rw [canonicalEq]
                exact RecursiveAlpha.refl _
              have leftNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_recv_to_common
                  fuel channel body binder needle replacement common
                  leftFreshBody leftFreshDirect leftFreshConflict
                  commonNeNeedle commonNeReplacement
                  leftNormalCongruent
              have rightNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_recv_to_common
                  fuel channel rightBody alphaReplacement
                    needle replacement common
                  rightFreshBody rightFreshDirect rightFreshConflict
                  commonNeNeedle commonNeReplacement
                  rightNormalCongruent
              simpa [rightBody] using
                RecursiveAlpha.trans leftNormalized
                  (RecursiveAlpha.trans
                    (RecursiveAlpha.recv canonicalCongruent)
                    (RecursiveAlpha.symm rightNormalized))
      | @newBinder alphaReplacement binder body fresh =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                (RecursiveAlpha.newBinder fresh (binder := binder))
          | succ fuel =>
              let rightBody :=
                body.renameBound binder alphaReplacement
              have strict : body.syntaxDepth ≤ depth := by
                simpa [RecursiveProc.syntaxDepth] using enough
              let common :=
                RecursiveProc.substitutionCongruenceFresh
                  fuel body rightBody binder alphaReplacement
                    needle replacement
              have leftFreshBody : common ∉ body.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftBody
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshBody : common ∉ rightBody.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightBody
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftFreshDirect :
                  common ∉
                    (body.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftDirect
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshDirect :
                  common ∉
                    (rightBody.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightDirect
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder
                        (body.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftConflict
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (rightBody.renameBound alphaReplacement
                        (rightBody.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightConflict
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have commonNeNeedle : common ≠ needle := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_needle
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have commonNeReplacement : common ≠ replacement := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_replacement
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body)
                    (body.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body binder common leftFreshBody)
              have rightSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap alphaReplacement common) rightBody)
                    (rightBody.renameBound alphaReplacement common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    rightBody alphaReplacement common rightFreshBody)
              have leftNormalCongruent :=
                outerIH leftSourceAlpha
                  (by simpa using strict)
                  fuel needle replacement
              have rightStrict : rightBody.syntaxDepth ≤ depth := by
                simpa [rightBody, RecursiveProc.renameBound,
                  RecursiveProc.syntaxDepth_substRaw] using strict
              have rightNormalCongruent :=
                outerIH rightSourceAlpha
                  (by simpa using rightStrict)
                  fuel needle replacement
              have canonicalEq :
                  rightBody.renameBound alphaReplacement common =
                    body.renameBound binder common := by
                simpa [rightBody, RecursiveProc.renameBound] using
                  (RecursiveProc.substRaw_compose_of_intermediate_fresh
                    body binder alphaReplacement common fresh)
              have canonicalCongruent :
                  RecursiveAlpha
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder common)
                      needle replacement)
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (rightBody.renameBound alphaReplacement common)
                      needle replacement) := by
                rw [canonicalEq]
                exact RecursiveAlpha.refl _
              have leftNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_new_to_common
                  fuel body binder needle replacement common
                  leftFreshBody leftFreshDirect leftFreshConflict
                  commonNeNeedle commonNeReplacement
                  leftNormalCongruent
              have rightNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_new_to_common
                  fuel rightBody alphaReplacement needle replacement common
                  rightFreshBody rightFreshDirect rightFreshConflict
                  commonNeNeedle commonNeReplacement
                  rightNormalCongruent
              simpa [rightBody] using
                RecursiveAlpha.trans leftNormalized
                  (RecursiveAlpha.trans
                    (RecursiveAlpha.new canonicalCongruent)
                    (RecursiveAlpha.symm rightNormalized))
      | @repRecvBinder alphaReplacement channel binder body fresh =>
          intro enough fuel needle replacement
          cases fuel with
          | zero =>
              simpa [RecursiveProc.substituteCaptureAvoidingAux] using
                (RecursiveAlpha.repRecvBinder fresh
                  (channel := channel) (binder := binder))
          | succ fuel =>
              let rightBody :=
                body.renameBound binder alphaReplacement
              have strict : body.syntaxDepth ≤ depth := by
                simpa [RecursiveProc.syntaxDepth] using enough
              let common :=
                RecursiveProc.substitutionCongruenceFresh
                  fuel body rightBody binder alphaReplacement
                    needle replacement
              have leftFreshBody : common ∉ body.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftBody
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshBody : common ∉ rightBody.allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightBody
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftFreshDirect :
                  common ∉
                    (body.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftDirect
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshDirect :
                  common ∉
                    (rightBody.substituteCaptureAvoidingAux
                      fuel needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightDirect
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder
                        (body.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_leftConflict
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have rightFreshConflict :
                  common ∉
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (rightBody.renameBound alphaReplacement
                        (rightBody.freshName needle replacement))
                      needle replacement).allNames := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_not_mem_rightConflict
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have commonNeNeedle : common ≠ needle := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_needle
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have commonNeReplacement : common ≠ replacement := by
                simpa [common] using
                  (RecursiveProc.substitutionCongruenceFresh_ne_replacement
                    fuel body rightBody binder alphaReplacement
                      needle replacement)
              have leftSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap binder common) body)
                    (body.renameBound binder common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    body binder common leftFreshBody)
              have rightSourceAlpha :
                  RecursiveAlpha
                    (RecursivePermutation.process
                      (Equiv.swap alphaReplacement common) rightBody)
                    (rightBody.renameBound alphaReplacement common) := by
                simpa [RecursiveProc.renameBound] using
                  (RecursivePermutation.process_swap_fresh_alpha_substRaw
                    rightBody alphaReplacement common rightFreshBody)
              have leftNormalCongruent :=
                outerIH leftSourceAlpha
                  (by simpa using strict)
                  fuel needle replacement
              have rightStrict : rightBody.syntaxDepth ≤ depth := by
                simpa [rightBody, RecursiveProc.renameBound,
                  RecursiveProc.syntaxDepth_substRaw] using strict
              have rightNormalCongruent :=
                outerIH rightSourceAlpha
                  (by simpa using rightStrict)
                  fuel needle replacement
              have canonicalEq :
                  rightBody.renameBound alphaReplacement common =
                    body.renameBound binder common := by
                simpa [rightBody, RecursiveProc.renameBound] using
                  (RecursiveProc.substRaw_compose_of_intermediate_fresh
                    body binder alphaReplacement common fresh)
              have canonicalCongruent :
                  RecursiveAlpha
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (body.renameBound binder common)
                      needle replacement)
                    (RecursiveProc.substituteCaptureAvoidingAux fuel
                      (rightBody.renameBound alphaReplacement common)
                      needle replacement) := by
                rw [canonicalEq]
                exact RecursiveAlpha.refl _
              have leftNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_repRecv_to_common
                  fuel channel body binder needle replacement common
                  leftFreshBody leftFreshDirect leftFreshConflict
                  commonNeNeedle commonNeReplacement
                  leftNormalCongruent
              have rightNormalized :=
                RecursiveAlpha.substituteCaptureAvoidingAux_repRecv_to_common
                  fuel channel rightBody alphaReplacement
                    needle replacement common
                  rightFreshBody rightFreshDirect rightFreshConflict
                  commonNeNeedle commonNeReplacement
                  rightNormalCongruent
              simpa [rightBody] using
                RecursiveAlpha.trans leftNormalized
                  (RecursiveAlpha.trans
                    (RecursiveAlpha.repRecv canonicalCongruent)
                    (RecursiveAlpha.symm rightNormalized))

/-- Fuelled substitution respects alpha at every fuel value. -/
theorem substituteCaptureAvoidingAux_congr
    (relation : RecursiveAlpha left right)
    (fuel : Nat) (needle replacement : Name) :
    RecursiveAlpha
      (left.substituteCaptureAvoidingAux fuel needle replacement)
      (right.substituteCaptureAvoidingAux fuel needle replacement) := by
  exact
    substituteCaptureAvoidingAux_congr_of_depth
      left.syntaxDepth relation le_rfl fuel needle replacement

/-- Total substitution is literally its depth-indexed fuelled computation. -/
theorem substituteCaptureAvoiding_eq_aux_depth
    (process : RecursiveProc) (needle replacement : Name) :
    process.substituteCaptureAvoiding needle replacement =
      process.substituteCaptureAvoidingAux
        process.syntaxDepth needle replacement := by
  unfold RecursiveProc.substituteCaptureAvoiding
  split
  · rfl
  · rename_i noRisk
    have safe :
        process.captureRisk needle replacement = false :=
      Bool.eq_false_of_not_eq_true noRisk
    exact
      (RecursiveProc.substituteCaptureAvoidingAux_eq_substRaw_of_no_capture
        process.syntaxDepth process needle replacement le_rfl safe).symm

/-- Total executable capture-avoiding substitution respects alpha. -/
theorem substituteCaptureAvoiding_congr
    (relation : RecursiveAlpha left right)
    (needle replacement : Name) :
    RecursiveAlpha
      (left.substituteCaptureAvoiding needle replacement)
      (right.substituteCaptureAvoiding needle replacement) := by
  rw [substituteCaptureAvoiding_eq_aux_depth]
  rw [substituteCaptureAvoiding_eq_aux_depth]
  rw [← syntaxDepth_eq relation]
  exact substituteCaptureAvoidingAux_congr
    relation left.syntaxDepth needle replacement

/-- Kernel-built inhabitant of the previously conditional interface. -/
theorem substitutionCongruent : SubstitutionCongruent := by
  intro left right relation needle replacement
  exact substituteCaptureAvoiding_congr
    relation needle replacement

end RecursiveAlpha

namespace RecursiveLate

/-- Unconditional finite-control permutation theorem with one native target. -/
theorem embedded_native_permute_up_to_alpha_unconditional
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
          (RecursiveProc.ofRaw target)) :=
  embedded_native_permute_up_to_alpha
    RecursiveAlpha.substitutionCongruent permutation step

/-- Unconditional all-constructor recursive native permutation theorem. -/
theorem native_permute_up_to_alpha_unconditional
    (permutation : Equiv.Perm Name)
    (step : NativeStep source action target) :
    ∃ transformedTarget,
      NativeStep
        (RecursivePermutation.process permutation source)
        (RecursivePermutation.action permutation action)
        transformedTarget ∧
      RecursiveAlpha transformedTarget
        (RecursivePermutation.process permutation target) :=
  native_permute_up_to_alpha
    RecursiveAlpha.substitutionCongruent permutation step

end RecursiveLate

namespace RecursiveAlphaOperational

open RecursiveActionAlpha

/-- Unconditional action of every native constructor on the alpha quotient. -/
theorem alphaNativeStep_permute_all_unconditional
    (permutation : Equiv.Perm Name)
    (step : RecursiveLate.NativeStep source action target) :
    AlphaNativeStep
      (permuteProcess permutation
        (Quotient.mk RecursiveAlpha.setoid source))
      (permuteDerivative permutation
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := action, target := target } :
            LabelledDerivative))) :=
  alphaNativeStep_permute_all
    RecursiveAlpha.substitutionCongruent permutation step

end RecursiveAlphaOperational

end Cantilune.Pi
