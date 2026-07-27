import Cantilune.Pi.LateGuardedReplicationAlpha
import Cantilune.Pi.LateGuardedReplicationSubstitution

/-!
# Operational alpha closure for guarded recursive late pi

The executable capture-avoiding substitution in
`LateGuardedReplication` chooses a fresh natural number by taking a numeric
maximum.  Consequently it is intentionally not *literally* equivariant under
arbitrary finite permutations.  This file separates the strict nominal laws
which do hold, constructs an existentially saturated strong operational
quotient, and exposes the exact derivative-alpha witness needed to cross the
numeric-freshening boundary.

It does **not** assert the still-stronger universal statement that every
deterministic fresh choice is permutation-equivariant up to
`RecursiveAlpha`.  That statement needs a general fresh-choice alpha
uniqueness theorem.  Here it is proved concretely for the repository's
canonical counterexample, while the all-constructor exact theorem is stated
under the precise `captureRisk = false` premises.

No weak transition or reflexive/transitive operational closure is introduced.
-/

namespace Cantilune.Pi

namespace RecursivePermutation

@[simp]
private theorem apply_if_eq
    (permutation : Equiv.Perm Name)
    (candidate needle replacement : Name) :
    permutation (if candidate = needle then replacement else candidate) =
      if permutation candidate = permutation needle
      then permutation replacement
      else permutation candidate := by
  by_cases equality : candidate = needle <;> simp [equality]

@[simp]
theorem process_substRaw
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (needle replacement : Name) :
    process permutation (processValue.substRaw needle replacement) =
      (process permutation processValue).substRaw
        (permutation needle) (permutation replacement) := by
  induction processValue <;>
    simp_all [process, RecursiveProc.substRaw]
  all_goals
    split <;> simp_all

@[simp]
theorem process_renameBound
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (binder replacement : Name) :
    process permutation (processValue.renameBound binder replacement) =
      (process permutation processValue).renameBound
        (permutation binder) (permutation replacement) := by
  simp [RecursiveProc.renameBound]

theorem not_mem_allNames_process
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (name : Name)
    (fresh : name ∉ processValue.allNames) :
    permutation name ∉
      (process permutation processValue).allNames := by
  intro member
  exact fresh
    ((mem_allNames_process permutation processValue name).mp member)

@[simp]
theorem captureRisk_process
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (needle replacement : Name) :
    (process permutation processValue).captureRisk
        (permutation needle) (permutation replacement) =
      processValue.captureRisk needle replacement := by
  induction processValue <;>
    simp_all [process, RecursiveProc.captureRisk]

@[simp]
theorem syntaxDepth_process
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) :
    (process permutation processValue).syntaxDepth =
      processValue.syntaxDepth := by
  induction processValue <;>
    simp_all [process, RecursiveProc.syntaxDepth]

/--
On the genuinely capture-free branch the executable substitution is strictly
equivariant.  The alpha residual is needed only when deterministic
freshening is entered.
-/
theorem process_substituteCaptureAvoiding_of_no_capture
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (needle replacement : Name)
    (safe : processValue.captureRisk needle replacement = false) :
    process permutation
        (processValue.substituteCaptureAvoiding needle replacement) =
      (process permutation processValue).substituteCaptureAvoiding
        (permutation needle) (permutation replacement) := by
  rw [RecursiveProc.substituteCaptureAvoiding_eq_substRaw
    processValue needle replacement safe]
  rw [RecursiveProc.substituteCaptureAvoiding_eq_substRaw
    (process permutation processValue)
    (permutation needle) (permutation replacement)]
  · exact process_substRaw permutation processValue needle replacement
  · simpa using safe

/--
Even when numeric freshening prevents literal process equivariance, the exact
free support remains equivariant.  This uses the complete substitution
support theorem, including ordinary input, restriction, and replicated input
conflict branches.
-/
theorem mem_freeNames_substituteCaptureAvoiding_process
    (permutation : Equiv.Perm Name)
    (processValue : RecursiveProc) (needle replacement name : Name) :
    permutation name ∈
        ((process permutation processValue).substituteCaptureAvoiding
          (permutation needle) (permutation replacement)).freeNames ↔
      name ∈
        (processValue.substituteCaptureAvoiding
          needle replacement).freeNames := by
  rw [RecursiveProc.freeNames_substituteCaptureAvoiding]
  rw [RecursiveProc.freeNames_substituteCaptureAvoiding]
  simp only [RecursiveProc.mem_replaceSupport_iff]
  rw [mem_freeNames_process permutation processValue needle]
  rw [mem_freeNames_process permutation processValue name]
  simp

end RecursivePermutation

namespace RecursiveAlpha

/-- Literal global permutations preserve the generated alpha relation. -/
theorem permute
    (permutation : Equiv.Perm Name)
    (relation : RecursiveAlpha left right) :
    RecursiveAlpha
      (RecursivePermutation.process permutation left)
      (RecursivePermutation.process permutation right) := by
  induction relation with
  | refl =>
      exact RecursiveAlpha.refl _
  | symm _ inductionHypothesis =>
      exact RecursiveAlpha.symm inductionHypothesis
  | trans _ _ firstIH secondIH =>
      exact RecursiveAlpha.trans firstIH secondIH
  | tau _ inductionHypothesis =>
      exact RecursiveAlpha.tau inductionHypothesis
  | send _ inductionHypothesis =>
      exact RecursiveAlpha.send inductionHypothesis
  | recv _ inductionHypothesis =>
      exact RecursiveAlpha.recv inductionHypothesis
  | choice _ _ leftIH rightIH =>
      exact RecursiveAlpha.choice leftIH rightIH
  | par _ _ leftIH rightIH =>
      exact RecursiveAlpha.par leftIH rightIH
  | new _ inductionHypothesis =>
      exact RecursiveAlpha.new inductionHypothesis
  | matchEq _ inductionHypothesis =>
      exact RecursiveAlpha.matchEq inductionHypothesis
  | matchNe _ inductionHypothesis =>
      exact RecursiveAlpha.matchNe inductionHypothesis
  | repTau _ inductionHypothesis =>
      exact RecursiveAlpha.repTau inductionHypothesis
  | repSend _ inductionHypothesis =>
      exact RecursiveAlpha.repSend inductionHypothesis
  | repRecv _ inductionHypothesis =>
      exact RecursiveAlpha.repRecv inductionHypothesis
  | @recvBinder replacement channel binder body fresh =>
      simpa [RecursivePermutation.process] using
        (RecursiveAlpha.recvBinder
          (channel := permutation channel)
          (binder := permutation binder)
          (RecursivePermutation.not_mem_allNames_process
            permutation body replacement fresh))
  | @newBinder replacement binder body fresh =>
      simpa [RecursivePermutation.process] using
        (RecursiveAlpha.newBinder
          (binder := permutation binder)
          (RecursivePermutation.not_mem_allNames_process
            permutation body replacement fresh))
  | @repRecvBinder replacement channel binder body fresh =>
      simpa [RecursivePermutation.process] using
        (RecursiveAlpha.repRecvBinder
          (channel := permutation channel)
          (binder := permutation binder)
          (RecursivePermutation.not_mem_allNames_process
            permutation body replacement fresh))

end RecursiveAlpha

namespace RecursiveActionAlpha

/-!
An action binder and its derivative form one nominal object.  Quotienting the
label alone would lose the binding incidence, so the operational quotient
below uses this paired relation.
-/

/-- Alpha equivalence of strong-late actions. -/
inductive ActionAlpha : Raw.Action → Raw.Action → Prop where
  | refl (action) : ActionAlpha action action
  | symm (relation : ActionAlpha left right) :
      ActionAlpha right left
  | trans
      (first : ActionAlpha left middle)
      (second : ActionAlpha middle right) :
      ActionAlpha left right
  | input (channel leftBinder rightBinder : Name) :
      ActionAlpha
        (.input channel leftBinder)
        (.input channel rightBinder)
  | boundOutput
      (leftFresh : leftBinder ≠ channel)
      (rightFresh : rightBinder ≠ channel) :
      ActionAlpha
        (.boundOutput channel leftBinder)
        (.boundOutput channel rightBinder)

namespace ActionAlpha

theorem equivalence : Equivalence ActionAlpha :=
  ⟨ActionAlpha.refl, @ActionAlpha.symm, @ActionAlpha.trans⟩

def setoid : Setoid Raw.Action where
  r := ActionAlpha
  iseqv := equivalence

theorem permute
    (permutation : Equiv.Perm Name)
    (relation : ActionAlpha left right) :
    ActionAlpha
      (RecursivePermutation.action permutation left)
      (RecursivePermutation.action permutation right) := by
  induction relation with
  | refl =>
      exact ActionAlpha.refl _
  | symm _ inductionHypothesis =>
      exact ActionAlpha.symm inductionHypothesis
  | trans _ _ firstIH secondIH =>
      exact ActionAlpha.trans firstIH secondIH
  | input =>
      exact ActionAlpha.input _ _ _
  | boundOutput leftFresh rightFresh =>
      exact ActionAlpha.boundOutput
        (permutation.injective.ne leftFresh)
        (permutation.injective.ne rightFresh)

end ActionAlpha

/-- A raw action together with the derivative in which its binder scopes. -/
structure LabelledDerivative where
  action : Raw.Action
  target : RecursiveProc

/--
Alpha equivalence of recursive labelled derivatives.  The two binder rules
rename the label and derivative together.
-/
inductive DerivativeAlpha :
    LabelledDerivative → LabelledDerivative → Prop where
  | refl (derivative) :
      DerivativeAlpha derivative derivative
  | symm (relation : DerivativeAlpha left right) :
      DerivativeAlpha right left
  | trans
      (first : DerivativeAlpha left middle)
      (second : DerivativeAlpha middle right) :
      DerivativeAlpha left right
  | targetAlpha
      (relation : RecursiveAlpha leftTarget rightTarget) :
      DerivativeAlpha
        ⟨action, leftTarget⟩
        ⟨action, rightTarget⟩
  | inputBinder
      (fresh : replacement ∉ target.allNames) :
      DerivativeAlpha
        ⟨.input channel binder, target⟩
        ⟨.input channel replacement,
          target.renameBound binder replacement⟩
  | boundOutputBinder
      (binderFresh : binder ≠ channel)
      (replacementFresh : replacement ≠ channel)
      (fresh : replacement ∉ target.allNames) :
      DerivativeAlpha
        ⟨.boundOutput channel binder, target⟩
        ⟨.boundOutput channel replacement,
          target.renameBound binder replacement⟩

namespace DerivativeAlpha

theorem equivalence : Equivalence DerivativeAlpha :=
  ⟨DerivativeAlpha.refl, @DerivativeAlpha.symm,
    @DerivativeAlpha.trans⟩

def setoid : Setoid LabelledDerivative where
  r := DerivativeAlpha
  iseqv := equivalence

theorem action
    (relation : DerivativeAlpha left right) :
    ActionAlpha left.action right.action := by
  induction relation with
  | refl =>
      exact ActionAlpha.refl _
  | symm _ inductionHypothesis =>
      exact ActionAlpha.symm inductionHypothesis
  | trans _ _ firstIH secondIH =>
      exact ActionAlpha.trans firstIH secondIH
  | targetAlpha =>
      exact ActionAlpha.refl _
  | inputBinder =>
      exact ActionAlpha.input _ _ _
  | boundOutputBinder binderFresh replacementFresh =>
      exact ActionAlpha.boundOutput binderFresh replacementFresh

/-- Literal action of a permutation on a labelled derivative. -/
def permute
    (permutation : Equiv.Perm Name)
    (derivative : LabelledDerivative) : LabelledDerivative where
  action := RecursivePermutation.action permutation derivative.action
  target := RecursivePermutation.process permutation derivative.target

theorem permute_relation
    (permutation : Equiv.Perm Name)
    (relation : DerivativeAlpha left right) :
    DerivativeAlpha
      (permute permutation left)
      (permute permutation right) := by
  induction relation with
  | refl =>
      exact DerivativeAlpha.refl _
  | symm _ inductionHypothesis =>
      exact DerivativeAlpha.symm inductionHypothesis
  | trans _ _ firstIH secondIH =>
      exact DerivativeAlpha.trans firstIH secondIH
  | targetAlpha relation =>
      exact DerivativeAlpha.targetAlpha
        (RecursiveAlpha.permute permutation relation)
  | @inputBinder replacement channel binder target fresh =>
      simpa [permute, RecursivePermutation.action,
        RecursivePermutation.process] using
        (DerivativeAlpha.inputBinder
          (channel := permutation channel)
          (binder := permutation binder)
          (RecursivePermutation.not_mem_allNames_process
            permutation target replacement fresh))
  | @boundOutputBinder binder channel replacement target
      binderFresh replacementFresh fresh =>
      simpa [permute, RecursivePermutation.action,
        RecursivePermutation.process] using
        (DerivativeAlpha.boundOutputBinder
          (binder := permutation binder)
          (channel := permutation channel)
          (permutation.injective.ne binderFresh)
          (permutation.injective.ne replacementFresh)
          (RecursivePermutation.not_mem_allNames_process
            permutation target replacement fresh))

end DerivativeAlpha

abbrev AlphaAction := Quotient ActionAlpha.setoid
abbrev AlphaDerivative := Quotient DerivativeAlpha.setoid

/-- Forget the derivative while retaining the alpha class of its action. -/
def derivativeAction : AlphaDerivative → AlphaAction :=
  Quotient.map
    (fun derivative => derivative.action)
    (by
      intro left right relation
      exact relation.action)

/-- Permutation action on recursive alpha classes. -/
def permuteProcess
    (permutation : Equiv.Perm Name) :
    RecursiveAlpha.AlphaQuotient → RecursiveAlpha.AlphaQuotient :=
  Quotient.map
    (RecursivePermutation.process permutation)
    (by
      intro left right relation
      exact RecursiveAlpha.permute permutation relation)

/-- Permutation action on labelled-derivative alpha classes. -/
def permuteDerivative
    (permutation : Equiv.Perm Name) :
    AlphaDerivative → AlphaDerivative :=
  Quotient.map
    (DerivativeAlpha.permute permutation)
    (by
      intro left right relation
      exact DerivativeAlpha.permute_relation permutation relation)

end RecursiveActionAlpha

namespace RecursiveAlphaOperational

open RecursiveActionAlpha

/-- Processes modulo guarded-recursive alpha equivalence. -/
abbrev AlphaProcess := Quotient RecursiveAlpha.setoid

/--
Existentially saturated strong one-step relation on alpha classes.

Every witness is an actual `RecursiveLate.NativeStep`; this definition does
not invent a weak step.  Saturation makes the relation extensional in both
quotient endpoints while retaining the action/derivative binding incidence.
-/
def AlphaNativeStep
    (source : AlphaProcess) (derivative : AlphaDerivative) : Prop :=
  ∃ rawSource rawAction rawTarget,
    RecursiveLate.NativeStep rawSource rawAction rawTarget ∧
    (Quotient.mk RecursiveAlpha.setoid rawSource : AlphaProcess) =
      source ∧
    (Quotient.mk DerivativeAlpha.setoid
        ({ action := rawAction, target := rawTarget } :
          LabelledDerivative) : AlphaDerivative) =
      derivative

/-- Every genuine native step injects as exactly one strong quotient step. -/
theorem alphaNativeStep_mk
    (step : RecursiveLate.NativeStep source action target) :
    AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := action, target := target } :
          LabelledDerivative)) :=
  ⟨source, action, target, step, rfl, rfl⟩

theorem alphaNativeStep_congr
    (sourceEq : source = source')
    (derivativeEq : derivative = derivative')
    (step : AlphaNativeStep source derivative) :
    AlphaNativeStep source' derivative' := by
  simpa [sourceEq, derivativeEq] using step

/--
The already established exact permutation-stable fragment acts on the strong
alpha quotient.  In particular this covers `open` and therefore genuine
bound-output labels together with their derivatives.
-/
theorem alphaNativeStep_permute_stable
    (permutation : Equiv.Perm Name)
    (step : RecursiveLate.NativeStep source action target)
    (stable : RecursiveLate.PermutationStable step) :
    AlphaNativeStep
      (permuteProcess permutation
        (Quotient.mk RecursiveAlpha.setoid source))
      (permuteDerivative permutation
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := action, target := target } :
            LabelledDerivative))) := by
  exact alphaNativeStep_mk
    (RecursiveLate.native_permute permutation step stable)

/--
General strong quotient bridge for an operational permutation witness.

The witness may use a different spelling for a bound action and/or an
alpha-equivalent target.  `DerivativeAlpha` records both changes together;
the theorem still requires one genuine native step from the literally
permuted source.
-/
theorem alphaNativeStep_permute_of_derivativeAlpha
    (permutation : Equiv.Perm Name)
    (_step : RecursiveLate.NativeStep source action target)
    (permutedStep :
      RecursiveLate.NativeStep
        (RecursivePermutation.process permutation source)
        permutedAction permutedTarget)
    (derivativeRelation :
      DerivativeAlpha
        ({ action := permutedAction, target := permutedTarget } :
          LabelledDerivative)
        (DerivativeAlpha.permute permutation
          ({ action := action, target := target } :
            LabelledDerivative))) :
    AlphaNativeStep
      (permuteProcess permutation
        (Quotient.mk RecursiveAlpha.setoid source))
      (permuteDerivative permutation
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := action, target := target } :
            LabelledDerivative))) := by
  refine ⟨_, _, _, permutedStep, rfl, ?_⟩
  exact Quotient.sound derivativeRelation

/--
Common specialization: the permuted native derivation has the exact
permuted action and only its target carries an alpha residual.
-/
theorem alphaNativeStep_permute_up_to_targetAlpha
    (permutation : Equiv.Perm Name)
    (step : RecursiveLate.NativeStep source action target)
    (permutedStep :
      RecursiveLate.NativeStep
        (RecursivePermutation.process permutation source)
        (RecursivePermutation.action permutation action)
        permutedTarget)
    (targetRelation :
      RecursiveAlpha permutedTarget
        (RecursivePermutation.process permutation target)) :
    AlphaNativeStep
      (permuteProcess permutation
        (Quotient.mk RecursiveAlpha.setoid source))
      (permuteDerivative permutation
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := action, target := target } :
            LabelledDerivative))) := by
  apply alphaNativeStep_permute_of_derivativeAlpha
    permutation step permutedStep
  exact DerivativeAlpha.targetAlpha targetRelation

end RecursiveAlphaOperational

namespace RecursiveLate

/-!
## Exact all-constructor equivariance on the non-freshening branch

The older `PermutationStable` classifier deliberately omitted `embedded`,
communication, and close.  The following classifier includes every native
constructor.  Its four communication constructors carry exactly the
condition under which executable substitution stays on its structural
(`substRaw`) branch.  Thus no constructor is silently dropped and the
remaining boundary is explicit.
-/

private theorem embedded_boundOutput_binder_ne_channel_of_eq
    (step : Late.NativeStep source action target) :
    ∀ channel binder,
      action = .boundOutput channel binder →
      binder ≠ channel := by
  induction step with
  | prefixTau =>
      intro channel binder equality
      cases equality
  | prefixOutput =>
      intro channel binder equality
      cases equality
  | prefixInput =>
      intro channel binder equality
      cases equality
  | matchGuard step inductionHypothesis =>
      exact inductionHypothesis
  | mismatchGuard distinct step inductionHypothesis =>
      exact inductionHypothesis
  | choiceLeft step inductionHypothesis =>
      exact inductionHypothesis
  | choiceRight step inductionHypothesis =>
      exact inductionHypothesis
  | parLeft fresh step inductionHypothesis =>
      exact inductionHypothesis
  | parRight fresh step inductionHypothesis =>
      exact inductionHypothesis
  | syncLeft =>
      intro channel binder equality
      cases equality
  | syncRight =>
      intro channel binder equality
      cases equality
  | restrict fresh step inductionHypothesis =>
      exact inductionHypothesis
  | «open» distinct step =>
      intro channel binder equality
      cases equality
      exact distinct
  | closeLeft =>
      intro channel binder equality
      cases equality
  | closeRight =>
      intro channel binder equality
      cases equality

private theorem embedded_boundOutput_binder_ne_channel
    (step :
      Late.NativeStep source (.boundOutput channel binder) target) :
    binder ≠ channel :=
  embedded_boundOutput_binder_ne_channel_of_eq step channel binder rfl

/-- Every recursively derivable bound-output label has a fresh subject. -/
private theorem native_boundOutput_binder_ne_channel_of_eq
    (step : NativeStep source action target) :
    ∀ channel binder,
      action = .boundOutput channel binder →
      binder ≠ channel := by
  induction step with
  | embedded oldStep =>
      exact embedded_boundOutput_binder_ne_channel_of_eq oldStep
  | prefixTau =>
      intro channel binder equality
      cases equality
  | prefixOutput =>
      intro channel binder equality
      cases equality
  | prefixInput =>
      intro channel binder equality
      cases equality
  | matchGuard step inductionHypothesis =>
      exact inductionHypothesis
  | mismatchGuard distinct step inductionHypothesis =>
      exact inductionHypothesis
  | choiceLeft step inductionHypothesis =>
      exact inductionHypothesis
  | choiceRight step inductionHypothesis =>
      exact inductionHypothesis
  | parLeft fresh step inductionHypothesis =>
      exact inductionHypothesis
  | parRight fresh step inductionHypothesis =>
      exact inductionHypothesis
  | syncLeft =>
      intro channel binder equality
      cases equality
  | syncRight =>
      intro channel binder equality
      cases equality
  | restrict fresh step inductionHypothesis =>
      exact inductionHypothesis
  | «open» distinct step =>
      intro channel binder equality
      cases equality
      exact distinct
  | closeLeft =>
      intro channel binder equality
      cases equality
  | closeRight =>
      intro channel binder equality
      cases equality
  | replicatedTau =>
      intro channel binder equality
      cases equality
  | replicatedOutput =>
      intro channel binder equality
      cases equality
  | replicatedInput =>
      intro channel binder equality
      cases equality

theorem native_boundOutput_binder_ne_channel
    (step :
      NativeStep source (.boundOutput channel binder) target) :
    binder ≠ channel :=
  native_boundOutput_binder_ne_channel_of_eq step channel binder rfl

/-- Exact-equivariance evidence for an embedded finite-control derivation. -/
inductive EmbeddedPermutationStable :
    {source : Raw.Proc} →
    {action : Raw.Action} →
    {target : Raw.Proc} →
    Late.NativeStep source action target → Prop
  | prefixTau :
      EmbeddedPermutationStable
        (Late.NativeStep.prefixTau (next := next))
  | prefixOutput :
      EmbeddedPermutationStable
        (Late.NativeStep.prefixOutput
          (ch := channel) (value := value) (next := next))
  | prefixInput :
      EmbeddedPermutationStable
        (Late.NativeStep.prefixInput
          (ch := channel) (binder := binder) (next := next))
  | matchGuard
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.matchGuard (name := name) step)
  | mismatchGuard
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.mismatchGuard distinct step)
  | choiceLeft
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.choiceLeft (right := right) step)
  | choiceRight
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.choiceRight (left := left) step)
  | parLeft
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.parLeft fresh step)
  | parRight
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.parRight fresh step)
  | syncLeft
      {left leftTarget right rightTarget : Raw.Proc}
      {channel value binder : Name}
      (outputStep :
        Late.NativeStep left (.output channel value) leftTarget)
      (inputStep :
        Late.NativeStep right (.input channel binder) rightTarget)
      (fresh : binder ∉ leftTarget.freeNames)
      (outputStable : EmbeddedPermutationStable outputStep)
      (inputStable : EmbeddedPermutationStable inputStep)
      (safe : rightTarget.captureRisk binder value = false) :
      EmbeddedPermutationStable
        (Late.NativeStep.syncLeft outputStep inputStep fresh)
  | syncRight
      {left leftTarget right rightTarget : Raw.Proc}
      {channel binder value : Name}
      (inputStep :
        Late.NativeStep left (.input channel binder) leftTarget)
      (outputStep :
        Late.NativeStep right (.output channel value) rightTarget)
      (fresh : binder ∉ rightTarget.freeNames)
      (inputStable : EmbeddedPermutationStable inputStep)
      (outputStable : EmbeddedPermutationStable outputStep)
      (safe : leftTarget.captureRisk binder value = false) :
      EmbeddedPermutationStable
        (Late.NativeStep.syncRight inputStep outputStep fresh)
  | restrict
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.restrict fresh step)
  | open
      (stable : EmbeddedPermutationStable step) :
      EmbeddedPermutationStable
        (Late.NativeStep.open distinct step)
  | closeLeft
      {left leftTarget right rightTarget : Raw.Proc}
      {channel fresh binder : Name}
      (outputStep :
        Late.NativeStep left
          (.boundOutput channel fresh) leftTarget)
      (inputStep :
        Late.NativeStep right (.input channel binder) rightTarget)
      (freshForReceiver : fresh ∉ right.freeNames)
      (binderFresh : binder ∉ leftTarget.freeNames)
      (outputStable : EmbeddedPermutationStable outputStep)
      (inputStable : EmbeddedPermutationStable inputStep)
      (safe : rightTarget.captureRisk binder fresh = false) :
      EmbeddedPermutationStable
        (Late.NativeStep.closeLeft outputStep inputStep
          freshForReceiver binderFresh)
  | closeRight
      {left leftTarget right rightTarget : Raw.Proc}
      {channel binder fresh : Name}
      (inputStep :
        Late.NativeStep left (.input channel binder) leftTarget)
      (outputStep :
        Late.NativeStep right
          (.boundOutput channel fresh) rightTarget)
      (freshForReceiver : fresh ∉ left.freeNames)
      (binderFresh : binder ∉ rightTarget.freeNames)
      (inputStable : EmbeddedPermutationStable inputStep)
      (outputStable : EmbeddedPermutationStable outputStep)
      (safe : leftTarget.captureRisk binder fresh = false) :
      EmbeddedPermutationStable
        (Late.NativeStep.closeRight inputStep outputStep
          freshForReceiver binderFresh)

/--
An embedded stable derivation is exactly equivariant after inclusion in the
recursive kernel.  The proof traverses every old native constructor.
-/
theorem embedded_native_permute
    (permutation : Equiv.Perm Name)
    (step : Late.NativeStep source action target)
    (stable : EmbeddedPermutationStable step) :
    NativeStep
      (RecursivePermutation.process permutation
        (RecursiveProc.ofRaw source))
      (RecursivePermutation.action permutation action)
      (RecursivePermutation.process permutation
        (RecursiveProc.ofRaw target)) := by
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
      have recursiveFresh :
          Disjoint actionValue.boundNames
            (RecursiveProc.ofRaw right).freeNames := by
        simpa using fresh
      apply NativeStep.parLeft
      · simpa using
          (RecursivePermutation.disjoint_bound_free
            permutation recursiveFresh)
      · exact inductionHypothesis
  | @parRight sourceValue actionValue targetValue stepValue
      left fresh stable inductionHypothesis =>
      have recursiveFresh :
          Disjoint actionValue.boundNames
            (RecursiveProc.ofRaw left).freeNames := by
        simpa using fresh
      apply NativeStep.parRight
      · simpa using
          (RecursivePermutation.disjoint_bound_free
            permutation recursiveFresh)
      · exact inductionHypothesis
  | @syncLeft left leftTarget right rightTarget channel value binder
      outputStep inputStep fresh outputStable inputStable safe
      outputIH inputIH =>
      have safeRecursive :
          (RecursiveProc.ofRaw rightTarget).captureRisk binder value =
            false := by
        simpa using safe
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation (RecursiveProc.ofRaw rightTarget) binder value
          safeRecursive
      have targetEq :
          RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (rightTarget.substituteCaptureAvoiding binder value)) =
            (RecursivePermutation.process permutation
                (RecursiveProc.ofRaw rightTarget)).substituteCaptureAvoiding
              (permutation binder) (permutation value) := by
        rw [← RecursiveProc.substituteCaptureAvoiding_ofRaw]
        exact substitutionEq
      have recursiveFresh :
          binder ∉ (RecursiveProc.ofRaw leftTarget).freeNames := by
        simpa using fresh
      have transformed :=
        NativeStep.syncLeft outputIH inputIH
          (by
            simpa using
              (RecursivePermutation.fresh_process_freeNames
                permutation
                (processValue := RecursiveProc.ofRaw leftTarget)
                recursiveFresh))
      simpa [RecursiveProc.ofRaw, RecursivePermutation.process,
        RecursivePermutation.action, targetEq] using transformed
  | @syncRight left leftTarget right rightTarget channel binder value
      inputStep outputStep fresh inputStable outputStable safe
      inputIH outputIH =>
      have safeRecursive :
          (RecursiveProc.ofRaw leftTarget).captureRisk binder value =
            false := by
        simpa using safe
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation (RecursiveProc.ofRaw leftTarget) binder value
          safeRecursive
      have targetEq :
          RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (leftTarget.substituteCaptureAvoiding binder value)) =
            (RecursivePermutation.process permutation
                (RecursiveProc.ofRaw leftTarget)).substituteCaptureAvoiding
              (permutation binder) (permutation value) := by
        rw [← RecursiveProc.substituteCaptureAvoiding_ofRaw]
        exact substitutionEq
      have recursiveFresh :
          binder ∉ (RecursiveProc.ofRaw rightTarget).freeNames := by
        simpa using fresh
      have transformed :=
        NativeStep.syncRight inputIH outputIH
          (by
            simpa using
              (RecursivePermutation.fresh_process_freeNames
                permutation
                (processValue := RecursiveProc.ofRaw rightTarget)
                recursiveFresh))
      simpa [RecursiveProc.ofRaw, RecursivePermutation.process,
        RecursivePermutation.action, targetEq] using transformed
  | @restrict sourceValue actionValue targetValue stepValue
      binder fresh stable inductionHypothesis =>
      exact NativeStep.restrict
        (RecursivePermutation.fresh_action_names permutation fresh)
        inductionHypothesis
  | @«open» sourceValue channel fresh targetValue stepValue
      distinct stable inductionHypothesis =>
      exact NativeStep.open
        (permutation.injective.ne distinct) inductionHypothesis
  | @closeLeft left leftTarget right rightTarget channel fresh binder
      outputStep inputStep freshForReceiver binderFresh
      outputStable inputStable safe outputIH inputIH =>
      have safeRecursive :
          (RecursiveProc.ofRaw rightTarget).captureRisk binder fresh =
            false := by
        simpa using safe
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation (RecursiveProc.ofRaw rightTarget) binder fresh
          safeRecursive
      have targetEq :
          RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (rightTarget.substituteCaptureAvoiding binder fresh)) =
            (RecursivePermutation.process permutation
                (RecursiveProc.ofRaw rightTarget)).substituteCaptureAvoiding
              (permutation binder) (permutation fresh) := by
        rw [← RecursiveProc.substituteCaptureAvoiding_ofRaw]
        exact substitutionEq
      have receiverFreshRecursive :
          fresh ∉ (RecursiveProc.ofRaw right).freeNames := by
        simpa using freshForReceiver
      have binderFreshRecursive :
          binder ∉ (RecursiveProc.ofRaw leftTarget).freeNames := by
        simpa using binderFresh
      have transformed :=
        NativeStep.closeLeft outputIH inputIH
          (by
            simpa using
              (RecursivePermutation.fresh_process_freeNames
                permutation
                (processValue := RecursiveProc.ofRaw right)
                receiverFreshRecursive))
          (by
            simpa using
              (RecursivePermutation.fresh_process_freeNames
                permutation
                (processValue := RecursiveProc.ofRaw leftTarget)
                binderFreshRecursive))
      simpa [RecursiveProc.ofRaw, RecursivePermutation.process,
        RecursivePermutation.action, targetEq] using transformed
  | @closeRight left leftTarget right rightTarget channel binder fresh
      inputStep outputStep freshForReceiver binderFresh
      inputStable outputStable safe inputIH outputIH =>
      have safeRecursive :
          (RecursiveProc.ofRaw leftTarget).captureRisk binder fresh =
            false := by
        simpa using safe
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation (RecursiveProc.ofRaw leftTarget) binder fresh
          safeRecursive
      have targetEq :
          RecursivePermutation.process permutation
              (RecursiveProc.ofRaw
                (leftTarget.substituteCaptureAvoiding binder fresh)) =
            (RecursivePermutation.process permutation
                (RecursiveProc.ofRaw leftTarget)).substituteCaptureAvoiding
              (permutation binder) (permutation fresh) := by
        rw [← RecursiveProc.substituteCaptureAvoiding_ofRaw]
        exact substitutionEq
      have receiverFreshRecursive :
          fresh ∉ (RecursiveProc.ofRaw left).freeNames := by
        simpa using freshForReceiver
      have binderFreshRecursive :
          binder ∉ (RecursiveProc.ofRaw rightTarget).freeNames := by
        simpa using binderFresh
      have transformed :=
        NativeStep.closeRight inputIH outputIH
          (by
            simpa using
              (RecursivePermutation.fresh_process_freeNames
                permutation
                (processValue := RecursiveProc.ofRaw left)
                receiverFreshRecursive))
          (by
            simpa using
              (RecursivePermutation.fresh_process_freeNames
                permutation
                (processValue := RecursiveProc.ofRaw rightTarget)
                binderFreshRecursive))
      simpa [RecursiveProc.ofRaw, RecursivePermutation.process,
        RecursivePermutation.action, targetEq] using transformed

/-- Exact all-constructor permutation evidence for recursive native steps. -/
inductive ExactPermutationStable :
    {source : RecursiveProc} →
    {action : Raw.Action} →
    {target : RecursiveProc} →
    NativeStep source action target → Prop
  | embedded
      (stable : EmbeddedPermutationStable oldStep) :
      ExactPermutationStable (NativeStep.embedded oldStep)
  | prefixTau :
      ExactPermutationStable (NativeStep.prefixTau (next := next))
  | prefixOutput :
      ExactPermutationStable
        (NativeStep.prefixOutput
          (channel := channel) (value := value) (next := next))
  | prefixInput :
      ExactPermutationStable
        (NativeStep.prefixInput
          (channel := channel) (binder := binder) (next := next))
  | matchGuard
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.matchGuard (name := name) step)
  | mismatchGuard
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.mismatchGuard distinct step)
  | choiceLeft
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.choiceLeft (right := right) step)
  | choiceRight
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.choiceRight (left := left) step)
  | parLeft
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.parLeft fresh step)
  | parRight
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.parRight fresh step)
  | syncLeft
      {left leftTarget right rightTarget : RecursiveProc}
      {channel value binder : Name}
      (outputStep :
        NativeStep left (.output channel value) leftTarget)
      (inputStep :
        NativeStep right (.input channel binder) rightTarget)
      (fresh : binder ∉ leftTarget.freeNames)
      (outputStable : ExactPermutationStable outputStep)
      (inputStable : ExactPermutationStable inputStep)
      (safe : rightTarget.captureRisk binder value = false) :
      ExactPermutationStable
        (NativeStep.syncLeft outputStep inputStep fresh)
  | syncRight
      {left leftTarget right rightTarget : RecursiveProc}
      {channel binder value : Name}
      (inputStep :
        NativeStep left (.input channel binder) leftTarget)
      (outputStep :
        NativeStep right (.output channel value) rightTarget)
      (fresh : binder ∉ rightTarget.freeNames)
      (inputStable : ExactPermutationStable inputStep)
      (outputStable : ExactPermutationStable outputStep)
      (safe : leftTarget.captureRisk binder value = false) :
      ExactPermutationStable
        (NativeStep.syncRight inputStep outputStep fresh)
  | restrict
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.restrict fresh step)
  | open
      (stable : ExactPermutationStable step) :
      ExactPermutationStable (NativeStep.open distinct step)
  | closeLeft
      {left leftTarget right rightTarget : RecursiveProc}
      {channel fresh binder : Name}
      (outputStep :
        NativeStep left (.boundOutput channel fresh) leftTarget)
      (inputStep :
        NativeStep right (.input channel binder) rightTarget)
      (freshForReceiver : fresh ∉ right.freeNames)
      (binderFresh : binder ∉ leftTarget.freeNames)
      (outputStable : ExactPermutationStable outputStep)
      (inputStable : ExactPermutationStable inputStep)
      (safe : rightTarget.captureRisk binder fresh = false) :
      ExactPermutationStable
        (NativeStep.closeLeft outputStep inputStep
          freshForReceiver binderFresh)
  | closeRight
      {left leftTarget right rightTarget : RecursiveProc}
      {channel binder fresh : Name}
      (inputStep :
        NativeStep left (.input channel binder) leftTarget)
      (outputStep :
        NativeStep right (.boundOutput channel fresh) rightTarget)
      (freshForReceiver : fresh ∉ left.freeNames)
      (binderFresh : binder ∉ rightTarget.freeNames)
      (inputStable : ExactPermutationStable inputStep)
      (outputStable : ExactPermutationStable outputStep)
      (safe : leftTarget.captureRisk binder fresh = false) :
      ExactPermutationStable
        (NativeStep.closeRight inputStep outputStep
          freshForReceiver binderFresh)
  | replicatedTau :
      ExactPermutationStable (NativeStep.replicatedTau (body := body))
  | replicatedOutput :
      ExactPermutationStable
        (NativeStep.replicatedOutput
          (channel := channel) (value := value) (body := body))
  | replicatedInput :
      ExactPermutationStable
        (NativeStep.replicatedInput
          (channel := channel) (binder := binder) (body := body))

/--
Every constructor of the recursive native relation is exactly equivariant
when each executable substitution takes its non-freshening branch.
-/
theorem native_permute_exact
    (permutation : Equiv.Perm Name)
    (step : NativeStep source action target)
    (stable : ExactPermutationStable step) :
    NativeStep
      (RecursivePermutation.process permutation source)
      (RecursivePermutation.action permutation action)
      (RecursivePermutation.process permutation target) := by
  induction stable with
  | embedded stable =>
      exact embedded_native_permute permutation _ stable
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
        (RecursivePermutation.disjoint_bound_free permutation fresh)
        inductionHypothesis
  | @parRight sourceValue actionValue targetValue stepValue
      left fresh stable inductionHypothesis =>
      exact NativeStep.parRight
        (RecursivePermutation.disjoint_bound_free permutation fresh)
        inductionHypothesis
  | @syncLeft left leftTarget right rightTarget channel value binder
      outputStep inputStep fresh outputStable inputStable safe
      outputIH inputIH =>
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation rightTarget binder value safe
      have transformed :=
        NativeStep.syncLeft outputIH inputIH
          (RecursivePermutation.fresh_process_freeNames
            permutation fresh)
      simpa [RecursivePermutation.process, RecursivePermutation.action,
        substitutionEq] using
        transformed
  | @syncRight left leftTarget right rightTarget channel binder value
      inputStep outputStep fresh inputStable outputStable safe
      inputIH outputIH =>
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation leftTarget binder value safe
      have transformed :=
        NativeStep.syncRight inputIH outputIH
          (RecursivePermutation.fresh_process_freeNames
            permutation fresh)
      simpa [RecursivePermutation.process, RecursivePermutation.action,
        substitutionEq] using
        transformed
  | @restrict sourceValue actionValue targetValue stepValue
      binder fresh stable inductionHypothesis =>
      exact NativeStep.restrict
        (RecursivePermutation.fresh_action_names permutation fresh)
        inductionHypothesis
  | @«open» sourceValue channel fresh targetValue stepValue
      distinct stable inductionHypothesis =>
      exact NativeStep.open
        (permutation.injective.ne distinct) inductionHypothesis
  | @closeLeft left leftTarget right rightTarget channel fresh binder
      outputStep inputStep freshForReceiver binderFresh
      outputStable inputStable safe outputIH inputIH =>
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation rightTarget binder fresh safe
      have transformed :=
        NativeStep.closeLeft outputIH inputIH
          (RecursivePermutation.fresh_process_freeNames
            permutation freshForReceiver)
          (RecursivePermutation.fresh_process_freeNames
            permutation binderFresh)
      simpa [RecursivePermutation.process, RecursivePermutation.action,
        substitutionEq] using
        transformed
  | @closeRight left leftTarget right rightTarget channel binder fresh
      inputStep outputStep freshForReceiver binderFresh
      inputStable outputStable safe inputIH outputIH =>
      have substitutionEq :=
        RecursivePermutation.process_substituteCaptureAvoiding_of_no_capture
          permutation leftTarget binder fresh safe
      have transformed :=
        NativeStep.closeRight inputIH outputIH
          (RecursivePermutation.fresh_process_freeNames
            permutation freshForReceiver)
          (RecursivePermutation.fresh_process_freeNames
            permutation binderFresh)
      simpa [RecursivePermutation.process, RecursivePermutation.action,
        substitutionEq] using
        transformed
  | replicatedTau =>
      exact NativeStep.replicatedTau
  | replicatedOutput =>
      exact NativeStep.replicatedOutput
  | replicatedInput =>
      exact NativeStep.replicatedInput

end RecursiveLate

namespace RecursiveAlphaOperational

open RecursiveActionAlpha

/--
All native constructors, including embedded communication and both close
orientations, act on the alpha quotient whenever their concrete substitution
does not enter numeric freshening.
-/
theorem alphaNativeStep_permute_exact
    (permutation : Equiv.Perm Name)
    (step : RecursiveLate.NativeStep source action target)
    (stable : RecursiveLate.ExactPermutationStable step) :
    AlphaNativeStep
      (permuteProcess permutation
        (Quotient.mk RecursiveAlpha.setoid source))
      (permuteDerivative permutation
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := action, target := target } :
            LabelledDerivative))) := by
  exact alphaNativeStep_mk
    (RecursiveLate.native_permute_exact permutation step stable)

end RecursiveAlphaOperational

end Cantilune.Pi
