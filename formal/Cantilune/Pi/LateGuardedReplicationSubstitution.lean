import Cantilune.Pi.LateGuardedReplicationMeta

/-!
# Substitution and support laws for guarded replication

This file supplies the nominal laws which are deliberately not built into the
definition of `RecursiveProc`.  In particular, the proofs cover the
alpha-freshening branches for ordinary input, restriction, and replicated
input.  Equalities below are kernel equalities of finite supports; no weak
transition or observational quotient is used.
-/

namespace Cantilune.Pi
namespace RecursiveProc

/-- Replace one member of a finite support by another name. -/
def replaceSupport (names : Finset Name) (needle replacement : Name) :
    Finset Name :=
  if needle ∈ names then
    insert replacement (names.erase needle)
  else
    names

theorem mem_replaceSupport_iff
    (name : Name) (names : Finset Name) (needle replacement : Name) :
    name ∈ replaceSupport names needle replacement ↔
      (name = replacement ∧ needle ∈ names) ∨
      (name ≠ needle ∧ name ∈ names) := by
  by_cases present : needle ∈ names
  · simp only [replaceSupport, if_pos present, Finset.mem_insert,
      Finset.mem_erase]
    constructor
    · rintro (equal | ⟨notNeedle, member⟩)
      · exact Or.inl ⟨equal, present⟩
      · exact Or.inr ⟨notNeedle, member⟩
    · rintro (⟨equal, _⟩ | ⟨notNeedle, member⟩)
      · exact Or.inl equal
      · exact Or.inr ⟨notNeedle, member⟩
  · simp only [replaceSupport, if_neg present]
    constructor
    · intro member
      exact Or.inr ⟨fun equal => present (equal ▸ member), member⟩
    · rintro (⟨_, needleMember⟩ | ⟨_, member⟩)
      · exact False.elim (present needleMember)
      · exact member

@[simp]
theorem replaceSupport_empty (needle replacement : Name) :
    replaceSupport ∅ needle replacement = ∅ := by
  simp [replaceSupport]

theorem replaceSupport_insert
    (name : Name) (names : Finset Name) (needle replacement : Name) :
    replaceSupport (insert name names) needle replacement =
      insert (if name = needle then replacement else name)
        (replaceSupport names needle replacement) := by
  ext candidate
  simp only [mem_replaceSupport_iff, Finset.mem_insert]
  by_cases nameNeedle : name = needle <;>
    simp_all <;> aesop

theorem replaceSupport_union
    (left right : Finset Name) (needle replacement : Name) :
    replaceSupport (left ∪ right) needle replacement =
      replaceSupport left needle replacement ∪
        replaceSupport right needle replacement := by
  ext name
  simp only [mem_replaceSupport_iff, Finset.mem_union]
  aesop

theorem replaceSupport_erase
    (names : Finset Name) (binder needle replacement : Name)
    (binder_ne_needle : binder ≠ needle)
    (binder_ne_replacement : binder ≠ replacement) :
    replaceSupport (names.erase binder) needle replacement =
      (replaceSupport names needle replacement).erase binder := by
  ext name
  simp only [mem_replaceSupport_iff, Finset.mem_erase]
  aesop

@[simp]
theorem replaceSupport_erase_needle
    (names : Finset Name) (needle replacement : Name) :
    replaceSupport (names.erase needle) needle replacement =
      names.erase needle := by
  ext name
  simp [mem_replaceSupport_iff]

@[simp]
theorem replaceSupport_self (names : Finset Name) (name : Name) :
    replaceSupport names name name = names := by
  by_cases present : name ∈ names
  · simp [replaceSupport, present, Finset.insert_erase present]
  · simp [replaceSupport, present]

/-! ## Raw substitution and complete-name bounds -/

theorem syntaxDepth_substRaw
    (process : RecursiveProc) (needle replacement : Name) :
    (process.substRaw needle replacement).syntaxDepth =
      process.syntaxDepth := by
  induction process <;>
    simp_all [substRaw, syntaxDepth] <;>
    split <;> simp_all

/--
Fresh raw renaming has the exact binder-support effect needed by each
alpha-freshening branch.  The theorem includes guarded replicated input.
-/
theorem freeNames_substRaw_erase_replacement
    (process : RecursiveProc) (needle replacement : Name)
    (fresh : replacement ∉ process.allNames) :
    (process.substRaw needle replacement).freeNames.erase replacement =
      process.freeNames.erase needle := by
  induction process with
  | zero =>
      simp [substRaw, freeNames]
  | tau next ih =>
      have nextFresh : replacement ∉ next.allNames := by
        simpa [allNames] using fresh
      simpa [substRaw, freeNames] using ih nextFresh
  | send channel value next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, valueFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        by_cases valueNeedle : value = needle <;>
        simp_all <;> aesop
  | recv channel binder next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, binderFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop

  | choice left right leftIH rightIH =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ left.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ right.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | par left right leftIH rightIH =>
      simp only [allNames, Finset.mem_union, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh⟩
      have leftSupport := leftIH leftFresh
      have rightSupport := rightIH rightFresh
      ext name
      have leftMembership :
          (name ≠ replacement ∧
              name ∈ (left.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ left.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) leftSupport).to_iff
      have rightMembership :
          (name ≠ replacement ∧
              name ∈ (right.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ right.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) rightSupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_union]
      aesop
  | new binder body ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨binderFresh, bodyFresh⟩
      have bodySupport := ih bodyFresh
      have bodyFreeFresh : replacement ∉ body.freeNames :=
        fun member =>
          bodyFresh (freeNames_subset_allNames body member)
      ext name
      have bodyMembership :
          (name ≠ replacement ∧
              name ∈ (body.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ body.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) bodySupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase]
      by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop
  | matchEq left right next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases leftNeedle : left = needle <;>
        by_cases rightNeedle : right = needle <;>
        simp_all <;> aesop
  | matchNe left right next ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨leftFresh, rightFresh, nextFresh⟩
      have nextSupport := ih nextFresh
      have nextFreeFresh : replacement ∉ next.freeNames :=
        fun member =>
          nextFresh (freeNames_subset_allNames next member)
      ext name
      have nextMembership :
          (name ≠ replacement ∧
              name ∈ (next.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ next.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) nextSupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases leftNeedle : left = needle <;>
        by_cases rightNeedle : right = needle <;>
        simp_all <;> aesop
  | repTau body ih =>
      have bodyFresh : replacement ∉ body.allNames := by
        simpa [allNames] using fresh
      simpa [substRaw, freeNames] using ih bodyFresh
  | repSend channel value body ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, valueFresh, bodyFresh⟩
      have bodySupport := ih bodyFresh
      have bodyFreeFresh : replacement ∉ body.freeNames :=
        fun member =>
          bodyFresh (freeNames_subset_allNames body member)
      ext name
      have bodyMembership :
          (name ≠ replacement ∧
              name ∈ (body.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ body.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) bodySupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        by_cases valueNeedle : value = needle <;>
        simp_all <;> aesop
  | repRecv channel binder body ih =>
      simp only [allNames, Finset.mem_insert, not_or] at fresh
      rcases fresh with ⟨channelFresh, binderFresh, bodyFresh⟩
      have bodySupport := ih bodyFresh
      have bodyFreeFresh : replacement ∉ body.freeNames :=
        fun member =>
          bodyFresh (freeNames_subset_allNames body member)
      ext name
      have bodyMembership :
          (name ≠ replacement ∧
              name ∈ (body.substRaw needle replacement).freeNames) ↔
            (name ≠ needle ∧ name ∈ body.freeNames) := by
        simpa only [Finset.mem_erase] using
          (congrArg (fun names => name ∈ names) bodySupport).to_iff
      simp only [substRaw, freeNames, Finset.mem_erase,
        Finset.mem_insert]
      by_cases channelNeedle : channel = needle <;>
        by_cases binderNeedle : binder = needle <;>
        simp_all <;> aesop

/-! ## Total capture-avoiding support theorem -/

theorem syntaxDepth_pos (process : RecursiveProc) :
    0 < process.syntaxDepth := by
  induction process <;> simp_all [syntaxDepth]

/--
Every sufficiently fuelled execution of the capture-avoiding algorithm has
the expected free support.  Induction is on fuel, so recursive calls on
alpha-renamed bodies are covered as well as structural subterms.
-/
theorem freeNames_substituteCaptureAvoidingAux
    (fuel : Nat) (process : RecursiveProc)
    (needle replacement : Name)
    (enough : process.syntaxDepth ≤ fuel) :
    (substituteCaptureAvoidingAux
        fuel process needle replacement).freeNames =
      replaceSupport process.freeNames needle replacement := by
  induction fuel generalizing process with
  | zero =>
      exact False.elim ((Nat.not_lt_zero _)
        (lt_of_lt_of_le (syntaxDepth_pos process) enough))
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          simp [substituteCaptureAvoidingAux, freeNames,
            replaceSupport]
      | tau next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          simpa [substituteCaptureAvoidingAux, freeNames] using
            inductionHypothesis next nextEnough
      | send channel value next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          change
            insert (if channel = needle then replacement else channel)
                (insert (if value = needle then replacement else value)
                  (substituteCaptureAvoidingAux
                    fuel next needle replacement).freeNames) =
              replaceSupport
                (insert channel (insert value next.freeNames))
                needle replacement
          rw [inductionHypothesis next nextEnough]
          rw [replaceSupport_insert, replaceSupport_insert]
      | recv channel binder next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          by_cases stops : binder = needle
          · simp only [substituteCaptureAvoidingAux, stops, if_pos,
              freeNames]
            rw [replaceSupport_insert]
            simp
          · by_cases conflicts : binder = replacement
            · subst binder
              let fresh := next.freshName needle replacement
              let renamed := next.renameBound replacement fresh
              have replacement_ne_needle : replacement ≠ needle := stops
              have freshNeedle : fresh ≠ needle :=
                next.freshName_ne_needle needle replacement
              have freshReplacement : fresh ≠ replacement :=
                next.freshName_ne_replacement needle replacement
              have freshAll : fresh ∉ next.allNames :=
                next.freshName_not_mem_allNames needle replacement
              have renamedDepth :
                  renamed.syntaxDepth = next.syntaxDepth := by
                simpa [renamed, renameBound] using
                  syntaxDepth_substRaw next replacement fresh
              have renamedEnough : renamed.syntaxDepth ≤ fuel := by
                simpa [renamedDepth] using nextEnough
              have recursiveSupport :=
                inductionHypothesis renamed renamedEnough
              have alphaSupport :
                  renamed.freeNames.erase fresh =
                    next.freeNames.erase replacement := by
                simpa [renamed, renameBound] using
                  freeNames_substRaw_erase_replacement
                    next replacement fresh freshAll
              simp only [substituteCaptureAvoidingAux,
                replacement_ne_needle, if_false, if_true, freeNames]
              change
                insert
                    (if channel = needle then replacement else channel)
                    ((substituteCaptureAvoidingAux fuel renamed
                      needle replacement).freeNames.erase fresh) =
                  replaceSupport
                    (insert channel (next.freeNames.erase replacement))
                    needle replacement
              rw [recursiveSupport]
              rw [← replaceSupport_erase renamed.freeNames fresh
                needle replacement freshNeedle freshReplacement]
              rw [alphaSupport]
              rw [replaceSupport_insert]
            · simp only [substituteCaptureAvoidingAux, stops, if_false,
                conflicts, freeNames]
              rw [inductionHypothesis next nextEnough]
              rw [← replaceSupport_erase next.freeNames binder
                needle replacement stops conflicts]
              rw [replaceSupport_insert]
      | choice left right =>
          have leftEnough : left.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          have rightEnough : right.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          simp only [substituteCaptureAvoidingAux, freeNames]
          rw [inductionHypothesis left leftEnough]
          rw [inductionHypothesis right rightEnough]
          rw [replaceSupport_union]
      | par left right =>
          have leftEnough : left.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          have rightEnough : right.syntaxDepth ≤ fuel := by
            simp [syntaxDepth] at enough
            omega
          simp only [substituteCaptureAvoidingAux, freeNames]
          rw [inductionHypothesis left leftEnough]
          rw [inductionHypothesis right rightEnough]
          rw [replaceSupport_union]
      | new binder body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          by_cases stops : binder = needle
          · simp only [substituteCaptureAvoidingAux, stops, if_pos,
              freeNames]
            simp
          · by_cases conflicts : binder = replacement
            · subst binder
              let fresh := body.freshName needle replacement
              let renamed := body.renameBound replacement fresh
              have replacement_ne_needle : replacement ≠ needle := stops
              have freshNeedle : fresh ≠ needle :=
                body.freshName_ne_needle needle replacement
              have freshReplacement : fresh ≠ replacement :=
                body.freshName_ne_replacement needle replacement
              have freshAll : fresh ∉ body.allNames :=
                body.freshName_not_mem_allNames needle replacement
              have renamedDepth :
                  renamed.syntaxDepth = body.syntaxDepth := by
                simpa [renamed, renameBound] using
                  syntaxDepth_substRaw body replacement fresh
              have renamedEnough : renamed.syntaxDepth ≤ fuel := by
                simpa [renamedDepth] using bodyEnough
              have recursiveSupport :=
                inductionHypothesis renamed renamedEnough
              have alphaSupport :
                  renamed.freeNames.erase fresh =
                    body.freeNames.erase replacement := by
                simpa [renamed, renameBound] using
                  freeNames_substRaw_erase_replacement
                    body replacement fresh freshAll
              simp only [substituteCaptureAvoidingAux,
                replacement_ne_needle, if_false, if_true, freeNames]
              change
                  (substituteCaptureAvoidingAux fuel renamed
                    needle replacement).freeNames.erase fresh =
                replaceSupport (body.freeNames.erase replacement)
                  needle replacement
              rw [recursiveSupport]
              rw [← replaceSupport_erase renamed.freeNames fresh
                needle replacement freshNeedle freshReplacement]
              rw [alphaSupport]
            · simp only [substituteCaptureAvoidingAux, stops, if_false,
                conflicts, freeNames]
              rw [inductionHypothesis body bodyEnough]
              rw [← replaceSupport_erase body.freeNames binder
                needle replacement stops conflicts]
      | matchEq left right next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          change
            insert (if left = needle then replacement else left)
                (insert (if right = needle then replacement else right)
                  (substituteCaptureAvoidingAux
                    fuel next needle replacement).freeNames) =
              replaceSupport
                (insert left (insert right next.freeNames))
                needle replacement
          rw [inductionHypothesis next nextEnough]
          rw [replaceSupport_insert, replaceSupport_insert]
      | matchNe left right next =>
          have nextEnough : next.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          change
            insert (if left = needle then replacement else left)
                (insert (if right = needle then replacement else right)
                  (substituteCaptureAvoidingAux
                    fuel next needle replacement).freeNames) =
              replaceSupport
                (insert left (insert right next.freeNames))
                needle replacement
          rw [inductionHypothesis next nextEnough]
          rw [replaceSupport_insert, replaceSupport_insert]
      | repTau body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          simpa [substituteCaptureAvoidingAux, freeNames] using
            inductionHypothesis body bodyEnough
      | repSend channel value body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          change
            insert (if channel = needle then replacement else channel)
                (insert (if value = needle then replacement else value)
                  (substituteCaptureAvoidingAux
                    fuel body needle replacement).freeNames) =
              replaceSupport
                (insert channel (insert value body.freeNames))
                needle replacement
          rw [inductionHypothesis body bodyEnough]
          rw [replaceSupport_insert, replaceSupport_insert]
      | repRecv channel binder body =>
          have bodyEnough : body.syntaxDepth ≤ fuel := by
            simpa [syntaxDepth] using enough
          by_cases stops : binder = needle
          · simp only [substituteCaptureAvoidingAux, stops, if_pos,
              freeNames]
            rw [replaceSupport_insert]
            simp
          · by_cases conflicts : binder = replacement
            · subst binder
              let fresh := body.freshName needle replacement
              let renamed := body.renameBound replacement fresh
              have replacement_ne_needle : replacement ≠ needle := stops
              have freshNeedle : fresh ≠ needle :=
                body.freshName_ne_needle needle replacement
              have freshReplacement : fresh ≠ replacement :=
                body.freshName_ne_replacement needle replacement
              have freshAll : fresh ∉ body.allNames :=
                body.freshName_not_mem_allNames needle replacement
              have renamedDepth :
                  renamed.syntaxDepth = body.syntaxDepth := by
                simpa [renamed, renameBound] using
                  syntaxDepth_substRaw body replacement fresh
              have renamedEnough : renamed.syntaxDepth ≤ fuel := by
                simpa [renamedDepth] using bodyEnough
              have recursiveSupport :=
                inductionHypothesis renamed renamedEnough
              have alphaSupport :
                  renamed.freeNames.erase fresh =
                    body.freeNames.erase replacement := by
                simpa [renamed, renameBound] using
                  freeNames_substRaw_erase_replacement
                    body replacement fresh freshAll
              simp only [substituteCaptureAvoidingAux,
                replacement_ne_needle, if_false, if_true, freeNames]
              change
                insert
                    (if channel = needle then replacement else channel)
                    ((substituteCaptureAvoidingAux fuel renamed
                      needle replacement).freeNames.erase fresh) =
                  replaceSupport
                    (insert channel (body.freeNames.erase replacement))
                    needle replacement
              rw [recursiveSupport]
              rw [← replaceSupport_erase renamed.freeNames fresh
                needle replacement freshNeedle freshReplacement]
              rw [alphaSupport]
              rw [replaceSupport_insert]
            · simp only [substituteCaptureAvoidingAux, stops, if_false,
                conflicts, freeNames]
              rw [inductionHypothesis body bodyEnough]
              rw [← replaceSupport_erase body.freeNames binder
                needle replacement stops conflicts]
              rw [replaceSupport_insert]

/--
On the direct branch, absence of capture risk is exactly the side condition
needed for raw substitution to implement the same support replacement.
-/
theorem freeNames_substRaw_eq_replaceSupport_of_no_capture
    (process : RecursiveProc) (needle replacement : Name)
    (safe : process.captureRisk needle replacement = false) :
    (process.substRaw needle replacement).freeNames =
      replaceSupport process.freeNames needle replacement := by
  induction process with
  | zero =>
      simp [substRaw, freeNames, replaceSupport]
  | tau next ih =>
      simpa [substRaw, freeNames, captureRisk] using ih safe
  | send channel value next ih =>
      have nextSafe : next.captureRisk needle replacement = false := by
        simpa [captureRisk] using safe
      change
        insert (if channel = needle then replacement else channel)
            (insert (if value = needle then replacement else value)
              (next.substRaw needle replacement).freeNames) =
          replaceSupport
            (insert channel (insert value next.freeNames))
            needle replacement
      rw [ih nextSafe]
      rw [replaceSupport_insert, replaceSupport_insert]
  | recv channel binder next ih =>
      by_cases stops : binder = needle
      · simp only [substRaw, stops, if_pos, freeNames]
        rw [replaceSupport_insert]
        simp
      · have safeParts :
            binder ≠ replacement ∧
              next.captureRisk needle replacement = false := by
          simpa [captureRisk, stops] using safe
        simp only [substRaw, stops, if_false, freeNames]
        rw [ih safeParts.2]
        rw [← replaceSupport_erase next.freeNames binder
          needle replacement stops safeParts.1]
        rw [replaceSupport_insert]
  | choice left right leftIH rightIH =>
      have safeParts :
          left.captureRisk needle replacement = false ∧
            right.captureRisk needle replacement = false := by
        simpa [captureRisk] using safe
      simp only [substRaw, freeNames]
      rw [leftIH safeParts.1, rightIH safeParts.2]
      rw [replaceSupport_union]
  | par left right leftIH rightIH =>
      have safeParts :
          left.captureRisk needle replacement = false ∧
            right.captureRisk needle replacement = false := by
        simpa [captureRisk] using safe
      simp only [substRaw, freeNames]
      rw [leftIH safeParts.1, rightIH safeParts.2]
      rw [replaceSupport_union]
  | new binder body ih =>
      by_cases stops : binder = needle
      · simp only [substRaw, stops, if_pos, freeNames]
        simp
      · have safeParts :
            binder ≠ replacement ∧
              body.captureRisk needle replacement = false := by
          simpa [captureRisk, stops] using safe
        simp only [substRaw, stops, if_false, freeNames]
        rw [ih safeParts.2]
        rw [← replaceSupport_erase body.freeNames binder
          needle replacement stops safeParts.1]
  | matchEq left right next ih =>
      have nextSafe : next.captureRisk needle replacement = false := by
        simpa [captureRisk] using safe
      change
        insert (if left = needle then replacement else left)
            (insert (if right = needle then replacement else right)
              (next.substRaw needle replacement).freeNames) =
          replaceSupport
            (insert left (insert right next.freeNames))
            needle replacement
      rw [ih nextSafe]
      rw [replaceSupport_insert, replaceSupport_insert]
  | matchNe left right next ih =>
      have nextSafe : next.captureRisk needle replacement = false := by
        simpa [captureRisk] using safe
      change
        insert (if left = needle then replacement else left)
            (insert (if right = needle then replacement else right)
              (next.substRaw needle replacement).freeNames) =
          replaceSupport
            (insert left (insert right next.freeNames))
            needle replacement
      rw [ih nextSafe]
      rw [replaceSupport_insert, replaceSupport_insert]
  | repTau body ih =>
      simpa [substRaw, freeNames, captureRisk] using ih safe
  | repSend channel value body ih =>
      have bodySafe : body.captureRisk needle replacement = false := by
        simpa [captureRisk] using safe
      change
        insert (if channel = needle then replacement else channel)
            (insert (if value = needle then replacement else value)
              (body.substRaw needle replacement).freeNames) =
          replaceSupport
            (insert channel (insert value body.freeNames))
            needle replacement
      rw [ih bodySafe]
      rw [replaceSupport_insert, replaceSupport_insert]
  | repRecv channel binder body ih =>
      by_cases stops : binder = needle
      · simp only [substRaw, stops, if_pos, freeNames]
        rw [replaceSupport_insert]
        simp
      · have safeParts :
            binder ≠ replacement ∧
              body.captureRisk needle replacement = false := by
          simpa [captureRisk, stops] using safe
        simp only [substRaw, stops, if_false, freeNames]
        rw [ih safeParts.2]
        rw [← replaceSupport_erase body.freeNames binder
          needle replacement stops safeParts.1]
        rw [replaceSupport_insert]

/--
Capture-avoiding substitution has the standard exact free-name action for
every process, including the ordinary-input, restriction, and replicated-input
alpha-conflict branches.
-/
theorem freeNames_substituteCaptureAvoiding
    (process : RecursiveProc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).freeNames =
      replaceSupport process.freeNames needle replacement := by
  unfold substituteCaptureAvoiding
  split
  · exact freeNames_substituteCaptureAvoidingAux
      process.syntaxDepth process needle replacement le_rfl
  · rename_i notRisk
    exact freeNames_substRaw_eq_replaceSupport_of_no_capture
      process needle replacement (Bool.eq_false_of_not_eq_true notRisk)

/-- A distinct substituted name has no remaining free occurrence. -/
theorem needle_not_mem_freeNames_substituteCaptureAvoiding
    (process : RecursiveProc) (needle replacement : Name)
    (distinct : needle ≠ replacement) :
    needle ∉
      (process.substituteCaptureAvoiding needle replacement).freeNames := by
  rw [freeNames_substituteCaptureAvoiding]
  simp only [mem_replaceSupport_iff]
  aesop

/--
When the needle is absent, support is unchanged even though the deterministic
algorithm may still alpha-freshen a syntactically conflicting binder.
-/
theorem freeNames_substituteCaptureAvoiding_eq_self_of_not_mem
    (process : RecursiveProc) (needle replacement : Name)
    (absent : needle ∉ process.freeNames) :
    (process.substituteCaptureAvoiding needle replacement).freeNames =
      process.freeNames := by
  rw [freeNames_substituteCaptureAvoiding]
  simp [replaceSupport, absent]

/-- A fresh replacement becomes free exactly when the needle was free. -/
theorem replacement_mem_freeNames_substituteCaptureAvoiding_iff
    (process : RecursiveProc) (needle replacement : Name)
    (fresh : replacement ∉ process.freeNames) :
    replacement ∈
        (process.substituteCaptureAvoiding needle replacement).freeNames ↔
      needle ∈ process.freeNames := by
  rw [freeNames_substituteCaptureAvoiding]
  simp only [mem_replaceSupport_iff]
  aesop

/-- Support substitution composes when the intermediate name is fresh. -/
theorem replaceSupport_compose_of_intermediate_fresh
    (names : Finset Name) (first intermediate final : Name)
    (fresh : intermediate ∉ names) :
    replaceSupport
        (replaceSupport names first intermediate)
        intermediate final =
      replaceSupport names first final := by
  ext name
  simp only [mem_replaceSupport_iff]
  aesop

/-- Raw substitution is a syntactic no-op when the needle occurs nowhere. -/
theorem substRaw_eq_self_of_not_mem_allNames
    (process : RecursiveProc) (needle replacement : Name)
    (absent : needle ∉ process.allNames) :
    process.substRaw needle replacement = process := by
  induction process <;>
    simp_all [substRaw, allNames] <;> aesop

/--
Raw substitutions compose syntactically when the intermediate name occurs
nowhere in the original syntax, including binder declarations.
-/
theorem substRaw_compose_of_intermediate_fresh
    (process : RecursiveProc) (first intermediate final : Name)
    (fresh : intermediate ∉ process.allNames) :
    substRaw (process.substRaw first intermediate)
        intermediate final =
      process.substRaw first final := by
  induction process <;>
    simp_all [substRaw, allNames, eq_comm,
      substRaw_eq_self_of_not_mem_allNames] <;>
    (try split) <;>
    (try simp_all [substRaw_eq_self_of_not_mem_allNames])

/--
The strongest unconditional composition statement for the concrete
capture-avoiding implementation is support-level equality.  It is exact when
the intermediate name was initially fresh and includes all alpha branches.
-/
theorem freeNames_substituteCaptureAvoiding_compose
    (process : RecursiveProc) (first intermediate final : Name)
    (fresh : intermediate ∉ process.freeNames) :
    (substituteCaptureAvoiding
        (process.substituteCaptureAvoiding first intermediate)
        intermediate final).freeNames =
      (process.substituteCaptureAvoiding first final).freeNames := by
  rw [freeNames_substituteCaptureAvoiding]
  rw [freeNames_substituteCaptureAvoiding]
  rw [freeNames_substituteCaptureAvoiding]
  exact replaceSupport_compose_of_intermediate_fresh
    process.freeNames first intermediate final fresh

/--
Under explicit whole-syntax freshness for all three capture-avoiding calls,
composition also holds as process syntax.  The intermediate freshness is what
prevents the second substitution from changing unrelated original names.
-/
theorem substituteCaptureAvoiding_compose_of_global_freshness
    (process : RecursiveProc) (first intermediate final : Name)
    (intermediateFresh : intermediate ∉ process.allNames)
    (finalFreshOriginal : final ∉ process.allNames)
    (finalFreshIntermediate :
      final ∉ (process.substRaw first intermediate).allNames) :
    substituteCaptureAvoiding
        (process.substituteCaptureAvoiding first intermediate)
        intermediate final =
      process.substituteCaptureAvoiding first final := by
  rw [substituteCaptureAvoiding_eq_substRaw_of_replacement_fresh
    process first intermediate intermediateFresh]
  rw [substituteCaptureAvoiding_eq_substRaw_of_replacement_fresh
    (process.substRaw first intermediate) intermediate final
      finalFreshIntermediate]
  rw [substituteCaptureAvoiding_eq_substRaw_of_replacement_fresh
    process first final finalFreshOriginal]
  exact substRaw_compose_of_intermediate_fresh
    process first intermediate final intermediateFresh

/--
The replicated-input conflict branch really alpha-freshens its binder before
descent.  This is an exact equation for the executable implementation.
-/
theorem substituteCaptureAvoiding_repRecv_conflict
    (channel binder : Name) (body : RecursiveProc)
    (needle replacement : Name)
    (notStop : binder ≠ needle)
    (conflict : binder = replacement) :
    substituteCaptureAvoiding
        (RecursiveProc.repRecv channel binder body)
        needle replacement =
      let fresh := body.freshName needle replacement
      let renamed := body.renameBound binder fresh
      RecursiveProc.repRecv
        (if channel = needle then replacement else channel)
        fresh
        (substituteCaptureAvoidingAux
          body.syntaxDepth renamed needle replacement) := by
  subst binder
  have replacement_ne_needle : replacement ≠ needle := notStop
  simp [substituteCaptureAvoiding, captureRisk, syntaxDepth,
    substituteCaptureAvoidingAux, replacement_ne_needle]

theorem substRaw_self
    (process : RecursiveProc) (name : Name) :
    process.substRaw name name = process := by
  induction process <;>
    simp_all [substRaw]

theorem captureRisk_self
    (process : RecursiveProc) (name : Name) :
    process.captureRisk name name = false := by
  induction process <;> simp_all [captureRisk]

@[simp]
theorem substituteCaptureAvoiding_self
    (process : RecursiveProc) (name : Name) :
    process.substituteCaptureAvoiding name name = process := by
  rw [substituteCaptureAvoiding_eq_substRaw
    process name name (captureRisk_self process name)]
  exact substRaw_self process name

end RecursiveProc
end Cantilune.Pi
