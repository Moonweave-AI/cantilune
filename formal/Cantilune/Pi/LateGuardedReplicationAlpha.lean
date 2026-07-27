import Cantilune.Pi.LateGuardedReplicationMeta

/-!
# Alpha equivalence and finite renaming for guarded recursive late pi

This module supplies two deliberately distinct nominal structures.

* `RecursiveAlpha` is the least equivalence and process congruence generated
  by capture-free changes of the binders of `recv`, `new`, and `repRecv`.
* `RecursivePermutation` is the literal action of a name permutation on
  processes and late action labels.

The second structure is used to state an exact equivariance result for the
fragment of `RecursiveLate.NativeStep` whose target does not invoke the
deterministic capture-avoiding substitution algorithm.  That fragment includes
restriction and `open`, so bound-output labels are covered.  Communication and
close are excluded from the exact theorem: their targets use
`substituteCaptureAvoiding`, whose numeric choice of a fresh name is not
equivariant under arbitrary finite permutations.  The final theorem gives a
concrete counterexample to the missing substitution equation.

No weak transition or observational quotient is introduced.
-/

namespace Cantilune.Pi

namespace RecursivePermutation

/-- Literal action of a name permutation on the guarded recursive syntax. -/
def process (permutation : Equiv.Perm Name) : RecursiveProc → RecursiveProc
  | .zero => .zero
  | .tau next => .tau (process permutation next)
  | .send channel value next =>
      .send (permutation channel) (permutation value)
        (process permutation next)
  | .recv channel binder next =>
      .recv (permutation channel) (permutation binder)
        (process permutation next)
  | .choice left right =>
      .choice (process permutation left) (process permutation right)
  | .par left right =>
      .par (process permutation left) (process permutation right)
  | .new binder body =>
      .new (permutation binder) (process permutation body)
  | .matchEq left right next =>
      .matchEq (permutation left) (permutation right)
        (process permutation next)
  | .matchNe left right next =>
      .matchNe (permutation left) (permutation right)
        (process permutation next)
  | .repTau body =>
      .repTau (process permutation body)
  | .repSend channel value body =>
      .repSend (permutation channel) (permutation value)
        (process permutation body)
  | .repRecv channel binder body =>
      .repRecv (permutation channel) (permutation binder)
        (process permutation body)

/-- Literal action of the same permutation on strong-late labels. -/
def action (permutation : Equiv.Perm Name) : Raw.Action → Raw.Action
  | .tau => .tau
  | .output channel value =>
      .output (permutation channel) (permutation value)
  | .input channel binder =>
      .input (permutation channel) (permutation binder)
  | .boundOutput channel fresh =>
      .boundOutput (permutation channel) (permutation fresh)

@[simp]
theorem process_refl (processValue : RecursiveProc) :
    process (Equiv.refl Name) processValue = processValue := by
  induction processValue <;> simp_all [process]

@[simp]
theorem action_refl (actionValue : Raw.Action) :
    action (Equiv.refl Name) actionValue = actionValue := by
  cases actionValue <;> rfl

theorem process_trans
    (first second : Equiv.Perm Name) (processValue : RecursiveProc) :
    process (first.trans second) processValue =
      process second (process first processValue) := by
  induction processValue <;> simp_all [process]

theorem action_trans
    (first second : Equiv.Perm Name) (actionValue : Raw.Action) :
    action (first.trans second) actionValue =
      action second (action first actionValue) := by
  cases actionValue <;> rfl

@[simp]
theorem process_symm_process
    (permutation : Equiv.Perm Name) (processValue : RecursiveProc) :
    process permutation.symm (process permutation processValue) =
      processValue := by
  rw [← process_trans]
  simp

@[simp]
theorem action_symm_action
    (permutation : Equiv.Perm Name) (actionValue : Raw.Action) :
    action permutation.symm (action permutation actionValue) =
      actionValue := by
  rw [← action_trans]
  simp

theorem mem_freeNames_process
    (permutation : Equiv.Perm Name) (processValue : RecursiveProc)
    (name : Name) :
    permutation name ∈
        (process permutation processValue).freeNames ↔
      name ∈ processValue.freeNames := by
  induction processValue generalizing name <;>
    simp_all [process, RecursiveProc.freeNames]

theorem mem_allNames_process
    (permutation : Equiv.Perm Name) (processValue : RecursiveProc)
    (name : Name) :
    permutation name ∈
        (process permutation processValue).allNames ↔
      name ∈ processValue.allNames := by
  induction processValue generalizing name <;>
    simp_all [process, RecursiveProc.allNames]

theorem mem_action_names
    (permutation : Equiv.Perm Name) (actionValue : Raw.Action)
    (name : Name) :
    permutation name ∈ (action permutation actionValue).names ↔
      name ∈ actionValue.names := by
  cases actionValue <;> simp [action, Raw.Action.names]

theorem mem_action_boundNames
    (permutation : Equiv.Perm Name) (actionValue : Raw.Action)
    (name : Name) :
    permutation name ∈
        (action permutation actionValue).boundNames ↔
      name ∈ actionValue.boundNames := by
  cases actionValue <;> simp [action, Raw.Action.boundNames]

theorem fresh_action_names
    (permutation : Equiv.Perm Name)
    (fresh : binder ∉ actionValue.names) :
    permutation binder ∉
      (action permutation actionValue).names := by
  intro member
  exact fresh ((mem_action_names permutation actionValue binder).mp member)

theorem fresh_process_freeNames
    (permutation : Equiv.Perm Name)
    (fresh : binder ∉ processValue.freeNames) :
    permutation binder ∉
      (process permutation processValue).freeNames := by
  intro member
  exact fresh ((mem_freeNames_process permutation processValue binder).mp member)

theorem disjoint_bound_free
    (permutation : Equiv.Perm Name)
    (fresh : Disjoint actionValue.boundNames processValue.freeNames) :
    Disjoint
      (action permutation actionValue).boundNames
      (process permutation processValue).freeNames := by
  rw [Finset.disjoint_left] at fresh ⊢
  intro renamed memberBound memberFree
  let original := permutation.symm renamed
  have renamedEq : permutation original = renamed := by
    simp [original]
  rw [← renamedEq] at memberBound memberFree
  exact fresh
    ((mem_action_boundNames permutation actionValue original).mp memberBound)
    ((mem_freeNames_process permutation processValue original).mp memberFree)

end RecursivePermutation

/-!
## Alpha equivalence
-/

/--
Alpha equivalence for guarded recursive processes.

The three binder-changing rules demand a name absent from the complete body
syntax.  Their use of `renameBound` therefore cannot capture a free name.
Every process constructor, including all guarded replication constructors, is
a congruence.
-/
inductive RecursiveAlpha : RecursiveProc → RecursiveProc → Prop where
  | refl (process) : RecursiveAlpha process process
  | symm (relation : RecursiveAlpha left right) :
      RecursiveAlpha right left
  | trans
      (first : RecursiveAlpha left middle)
      (second : RecursiveAlpha middle right) :
      RecursiveAlpha left right
  | tau (relation : RecursiveAlpha next next') :
      RecursiveAlpha (.tau next) (.tau next')
  | send (relation : RecursiveAlpha next next') :
      RecursiveAlpha
        (.send channel value next)
        (.send channel value next')
  | recv (relation : RecursiveAlpha next next') :
      RecursiveAlpha
        (.recv channel binder next)
        (.recv channel binder next')
  | choice
      (leftRelation : RecursiveAlpha left left')
      (rightRelation : RecursiveAlpha right right') :
      RecursiveAlpha (.choice left right) (.choice left' right')
  | par
      (leftRelation : RecursiveAlpha left left')
      (rightRelation : RecursiveAlpha right right') :
      RecursiveAlpha (.par left right) (.par left' right')
  | new (relation : RecursiveAlpha body body') :
      RecursiveAlpha (.new binder body) (.new binder body')
  | matchEq (relation : RecursiveAlpha next next') :
      RecursiveAlpha
        (.matchEq left right next)
        (.matchEq left right next')
  | matchNe (relation : RecursiveAlpha next next') :
      RecursiveAlpha
        (.matchNe left right next)
        (.matchNe left right next')
  | repTau (relation : RecursiveAlpha body body') :
      RecursiveAlpha (.repTau body) (.repTau body')
  | repSend (relation : RecursiveAlpha body body') :
      RecursiveAlpha
        (.repSend channel value body)
        (.repSend channel value body')
  | repRecv (relation : RecursiveAlpha body body') :
      RecursiveAlpha
        (.repRecv channel binder body)
        (.repRecv channel binder body')
  | recvBinder
      (fresh : replacement ∉ body.allNames) :
      RecursiveAlpha
        (.recv channel binder body)
        (.recv channel replacement
          (body.renameBound binder replacement))
  | newBinder
      (fresh : replacement ∉ body.allNames) :
      RecursiveAlpha
        (.new binder body)
        (.new replacement
          (body.renameBound binder replacement))
  | repRecvBinder
      (fresh : replacement ∉ body.allNames) :
      RecursiveAlpha
        (.repRecv channel binder body)
        (.repRecv channel replacement
          (body.renameBound binder replacement))

namespace RecursiveAlpha

theorem equivalence : Equivalence RecursiveAlpha :=
  ⟨RecursiveAlpha.refl, @RecursiveAlpha.symm, @RecursiveAlpha.trans⟩

def setoid : Setoid RecursiveProc where
  r := RecursiveAlpha
  iseqv := equivalence

/-- Alpha classes of guarded recursive processes. -/
abbrev AlphaQuotient := _root_.Quotient setoid

end RecursiveAlpha

namespace RecursiveLate

open RecursiveProc

/-!
## Exact permutation-stable native derivations

`PermutationStable` is evidence about an existing native derivation, not a
new transition relation.  It excludes precisely the constructors whose target
contains deterministic capture-avoiding substitution (`sync*` and `close*`)
and the opaque finite-control embedding.  All prefix, guard, choice, parallel,
restriction, open, and guarded-replication constructors are represented.
-/

inductive PermutationStable :
    {source : RecursiveProc} →
    {action : Raw.Action} →
    {target : RecursiveProc} →
    NativeStep source action target → Prop
  | prefixTau :
      PermutationStable (NativeStep.prefixTau (next := next))
  | prefixOutput :
      PermutationStable
        (NativeStep.prefixOutput
          (channel := channel) (value := value) (next := next))
  | prefixInput :
      PermutationStable
        (NativeStep.prefixInput
          (channel := channel) (binder := binder) (next := next))
  | matchGuard
      (stable : PermutationStable step) :
      PermutationStable (NativeStep.matchGuard (name := name) step)
  | mismatchGuard
      (stable : PermutationStable step) :
      PermutationStable
        (NativeStep.mismatchGuard distinct step)
  | choiceLeft
      (stable : PermutationStable step) :
      PermutationStable (NativeStep.choiceLeft (right := right) step)
  | choiceRight
      (stable : PermutationStable step) :
      PermutationStable (NativeStep.choiceRight (left := left) step)
  | parLeft
      (stable : PermutationStable step) :
      PermutationStable (NativeStep.parLeft fresh step)
  | parRight
      (stable : PermutationStable step) :
      PermutationStable (NativeStep.parRight fresh step)
  | restrict
      (stable : PermutationStable step) :
      PermutationStable (NativeStep.restrict fresh step)
  | open
      (stable : PermutationStable step) :
      PermutationStable (NativeStep.open distinct step)
  | replicatedTau :
      PermutationStable (NativeStep.replicatedTau (body := body))
  | replicatedOutput :
      PermutationStable
        (NativeStep.replicatedOutput
          (channel := channel) (value := value) (body := body))
  | replicatedInput :
      PermutationStable
        (NativeStep.replicatedInput
          (channel := channel) (binder := binder) (body := body))

/--
Every permutation-stable native derivation is exactly equivariant, including
the bound-output label produced by `open`.
-/
theorem native_permute
    (permutation : Equiv.Perm Name)
    (step : NativeStep source action target)
    (stable : PermutationStable step) :
    NativeStep
      (RecursivePermutation.process permutation source)
      (RecursivePermutation.action permutation action)
      (RecursivePermutation.process permutation target) := by
  induction stable with
  | prefixTau =>
      exact NativeStep.prefixTau
  | prefixOutput =>
      exact NativeStep.prefixOutput
  | prefixInput =>
      exact NativeStep.prefixInput
  | matchGuard stable inductionHypothesis =>
      exact NativeStep.matchGuard inductionHypothesis
  | @mismatchGuard sourceValue actionValue targetValue stepValue
      left right distinct stable inductionHypothesis =>
      exact NativeStep.mismatchGuard
        (permutation.injective.ne distinct) inductionHypothesis
  | choiceLeft stable inductionHypothesis =>
      exact NativeStep.choiceLeft inductionHypothesis
  | choiceRight stable inductionHypothesis =>
      exact NativeStep.choiceRight inductionHypothesis
  | @parLeft sourceValue actionValue targetValue stepValue
      right fresh stable inductionHypothesis =>
      exact NativeStep.parLeft
        (RecursivePermutation.disjoint_bound_free
          permutation fresh)
        inductionHypothesis
  | @parRight sourceValue actionValue targetValue stepValue
      left fresh stable inductionHypothesis =>
      exact NativeStep.parRight
        (RecursivePermutation.disjoint_bound_free
          permutation fresh)
        inductionHypothesis
  | @restrict sourceValue actionValue targetValue stepValue
      binder fresh stable inductionHypothesis =>
      exact NativeStep.restrict
        (RecursivePermutation.fresh_action_names permutation fresh)
        inductionHypothesis
  | @«open» sourceValue channel fresh targetValue stepValue
      distinct stable inductionHypothesis =>
      exact NativeStep.open
        (permutation.injective.ne distinct)
        inductionHypothesis
  | replicatedTau =>
      exact NativeStep.replicatedTau
  | replicatedOutput =>
      exact NativeStep.replicatedOutput
  | replicatedInput =>
      exact NativeStep.replicatedInput

end RecursiveLate

namespace RecursivePermutation

/--
The deterministic capture-avoiding substitution implementation is not
equivariant under arbitrary name permutations.

The body contains a binder for the replacement `1`, forcing deterministic
freshening.  Swapping `0` and `10` changes the numeric supremum used by
`freshName`, so permuting the chosen result is not the result chosen after
permuting the input.
-/
theorem substituteCaptureAvoiding_not_fully_equivariant :
    ∃ (permutation : Equiv.Perm Name)
      (processValue : RecursiveProc) (needle replacement : Name),
      process permutation
          (processValue.substituteCaptureAvoiding needle replacement) ≠
        (process permutation processValue).substituteCaptureAvoiding
          (permutation needle) (permutation replacement) := by
  let permutation : Equiv.Perm Name := Equiv.swap 0 10
  let processValue : RecursiveProc :=
    .new 1 (.send 0 1 .zero)
  refine ⟨permutation, processValue, 0, 1, ?_⟩
  decide

end RecursivePermutation

end Cantilune.Pi
