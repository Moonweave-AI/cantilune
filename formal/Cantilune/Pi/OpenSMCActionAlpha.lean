import Cantilune.Pi.OpenSMCNominalAtomBoundary

/-!
# Alpha-equivalent late actions and labelled derivatives

Input and bound-output labels bind one name in their derivative.  Quotienting
the raw action alone is useful for comparing labels, but operational
alpha-conversion must rename the derivative at the same time.  This module
therefore exposes both quotients:

* `ActionAlpha` forgets only the binder spelling of input and bound-output
  actions; and
* `DerivativeAlpha` alpha-converts the action binder together with its
  occurrences in the derivative.

The native compatibility theorems below construct genuine
`Late.NativeStep` derivations from alpha-converted source representatives.
No weak transition or reflexive/transitive closure is used.
-/

namespace Cantilune.Pi.OpenSMCActionAlpha

open Cantilune.Pi

/-! ## The action orbit -/

/-- The observable part of a late action, with bound names omitted. -/
inductive ActionOrbit where
  | tau
  | output (channel value : Name)
  | input (channel : Name)
  | boundOutput (channel : Name)
  deriving DecidableEq, Repr

/-- Forget exactly the names bound by a late label. -/
def actionOrbit : Raw.Action → ActionOrbit
  | .tau => .tau
  | .output channel value => .output channel value
  | .input channel _ => .input channel
  | .boundOutput channel _ => .boundOutput channel

/--
Alpha equivalence of actions.

An input binder may always be freshened.  A bound-output binder may change
only between names distinct from its free subject; consequently the
non-derivable raw label `boundOutput channel channel` is not identified with
an `open` label.
-/
inductive ActionAlpha : Raw.Action → Raw.Action → Prop where
  | refl (action) :
      ActionAlpha action action
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

theorem orbit_eq
    (relation : ActionAlpha left right) :
    actionOrbit left = actionOrbit right := by
  induction relation <;> simp_all [actionOrbit]

theorem freeNames_eq
    (relation : ActionAlpha left right) :
    left.freeNames = right.freeNames := by
  induction relation <;>
    simp_all [Raw.Action.freeNames]

/-- The side condition required by the native `open` constructor. -/
def BoundOutputAdmissible : Raw.Action → Prop
  | .boundOutput channel binder => binder ≠ channel
  | _ => True

theorem boundOutputAdmissible_iff
    (relation : ActionAlpha left right) :
    BoundOutputAdmissible left ↔
      BoundOutputAdmissible right := by
  induction relation with
  | refl => rfl
  | symm _ inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans _ _ leftIH rightIH =>
      exact leftIH.trans rightIH
  | input => simp [BoundOutputAdmissible]
  | boundOutput leftFresh rightFresh =>
      simp [BoundOutputAdmissible, leftFresh, rightFresh]

theorem invalid_boundOutput_not_alpha_fresh
    (channel fresh : Name)
    (freshNeChannel : fresh ≠ channel) :
    ¬ ActionAlpha
      (.boundOutput channel channel)
      (.boundOutput channel fresh) := by
  intro relation
  have admissibility :=
    (boundOutputAdmissible_iff relation).2
  exact (admissibility freshNeChannel) rfl

/--
`ActionAlpha` is exactly the kernel of the observable orbit together with
preservation of bound-output admissibility.

The second conjunct is needed only for the syntactically possible, but
operationally non-derivable, label `boundOutput channel channel`.  In
particular, this theorem gives a complete (rather than merely sound)
description of the action-label alpha quotient without identifying that
invalid label with a genuine `open` label.
-/
theorem iff_orbit_eq_and_boundOutputAdmissible
    (left right : Raw.Action) :
    ActionAlpha left right ↔
      actionOrbit left = actionOrbit right ∧
        (BoundOutputAdmissible left ↔ BoundOutputAdmissible right) := by
  constructor
  · intro relation
    exact ⟨relation.orbit_eq, relation.boundOutputAdmissible_iff⟩
  · rintro ⟨orbit, admissible⟩
    cases left with
    | tau =>
        cases right with
        | tau => exact ActionAlpha.refl _
        | output channel value =>
            simp [actionOrbit] at orbit
        | input channel binder =>
            simp [actionOrbit] at orbit
        | boundOutput channel binder =>
            simp [actionOrbit] at orbit
    | output leftChannel leftValue =>
        cases right with
        | tau =>
            simp [actionOrbit] at orbit
        | output rightChannel rightValue =>
            simp [actionOrbit] at orbit
            rcases orbit with ⟨rfl, rfl⟩
            exact ActionAlpha.refl _
        | input rightChannel rightBinder =>
            simp [actionOrbit] at orbit
        | boundOutput rightChannel rightBinder =>
            simp [actionOrbit] at orbit
    | input leftChannel leftBinder =>
        cases right with
        | tau =>
            simp [actionOrbit] at orbit
        | output rightChannel rightValue =>
            simp [actionOrbit] at orbit
        | input rightChannel rightBinder =>
            simp [actionOrbit] at orbit
            subst rightChannel
            exact ActionAlpha.input leftChannel leftBinder rightBinder
        | boundOutput rightChannel rightBinder =>
            simp [actionOrbit] at orbit
    | boundOutput leftChannel leftBinder =>
        cases right with
        | tau =>
            simp [actionOrbit] at orbit
        | output rightChannel rightValue =>
            simp [actionOrbit] at orbit
        | input rightChannel rightBinder =>
            simp [actionOrbit] at orbit
        | boundOutput rightChannel rightBinder =>
            simp [actionOrbit] at orbit
            subst rightChannel
            simp only [BoundOutputAdmissible] at admissible
            by_cases leftFresh : leftBinder ≠ leftChannel
            · exact ActionAlpha.boundOutput leftFresh
                (admissible.mp leftFresh)
            · have leftEq : leftBinder = leftChannel :=
                not_ne_iff.mp leftFresh
              have rightEq : rightBinder = leftChannel :=
                not_ne_iff.mp (mt admissible.mpr leftFresh)
              subst leftBinder
              subst rightBinder
              exact ActionAlpha.refl _

end ActionAlpha

/-- Raw late actions modulo spelling of their bound name. -/
abbrev AlphaAction := Quotient ActionAlpha.setoid

@[simp]
theorem alphaAction_input_mk
    (channel leftBinder rightBinder : Name) :
    (Quotient.mk ActionAlpha.setoid
        (.input channel leftBinder) : AlphaAction) =
      Quotient.mk ActionAlpha.setoid
        (.input channel rightBinder) :=
  Quotient.sound (ActionAlpha.input channel leftBinder rightBinder)

@[simp]
theorem alphaAction_boundOutput_mk
    (channel leftBinder rightBinder : Name) :
    leftBinder ≠ channel →
    rightBinder ≠ channel →
    (Quotient.mk ActionAlpha.setoid
        (.boundOutput channel leftBinder) : AlphaAction) =
      Quotient.mk ActionAlpha.setoid
        (.boundOutput channel rightBinder) := by
  intro leftFresh rightFresh
  exact Quotient.sound
    (ActionAlpha.boundOutput leftFresh rightFresh)

/--
Exact equality criterion for arbitrary raw bound-output labels in
`AlphaAction`.

Genuine labels (binder distinct from subject) are equal precisely when their
subjects agree.  The invalid self-bound label remains in a separate quotient
class, as required by the native `open` side condition.
-/
theorem alphaAction_boundOutput_eq_iff
    (leftChannel leftBinder rightChannel rightBinder : Name) :
    (Quotient.mk ActionAlpha.setoid
        (.boundOutput leftChannel leftBinder) : AlphaAction) =
        Quotient.mk ActionAlpha.setoid
          (.boundOutput rightChannel rightBinder) ↔
      leftChannel = rightChannel ∧
        ((leftBinder ≠ leftChannel) ↔
          (rightBinder ≠ rightChannel)) := by
  constructor
  · intro equality
    have relation :
        ActionAlpha
          (.boundOutput leftChannel leftBinder)
          (.boundOutput rightChannel rightBinder) :=
      Quotient.exact equality
    have channelEq : leftChannel = rightChannel := by
      simpa [actionOrbit] using relation.orbit_eq
    have admissible :
        (leftBinder ≠ leftChannel) ↔
          (rightBinder ≠ rightChannel) := by
      simpa [ActionAlpha.BoundOutputAdmissible] using
        relation.boundOutputAdmissible_iff
    exact ⟨channelEq, admissible⟩
  · rintro ⟨rfl, admissible⟩
    apply Quotient.sound
    by_cases leftFresh : leftBinder ≠ leftChannel
    · exact ActionAlpha.boundOutput leftFresh
        (admissible.mp leftFresh)
    · have leftEq : leftBinder = leftChannel :=
        not_ne_iff.mp leftFresh
      have rightEq : rightBinder = leftChannel :=
        not_ne_iff.mp (mt admissible.mpr leftFresh)
      subst leftBinder
      subst rightBinder
      exact ActionAlpha.refl _

/-! ## The action/derivative orbit -/

/-- A labelled derivative before quotienting its bound name. -/
structure LabelledDerivative where
  action : Raw.Action
  target : Raw.Proc

/--
Alpha equivalence for a label together with its derivative.

The `inputBinder` and `boundOutputBinder` constructors rename exactly the
occurrences bound by the label.  Ordinary process alpha equivalence remains
available independently through `targetAlpha`.
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
      (relation : Late.Alpha leftTarget rightTarget) :
      DerivativeAlpha
        ⟨action, leftTarget⟩
        ⟨action, rightTarget⟩
  | inputBinder
      (replacementFresh : replacement ≠ channel)
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
  | refl => exact ActionAlpha.refl _
  | symm _ inductionHypothesis =>
      exact inductionHypothesis.symm
  | trans _ _ leftIH rightIH =>
      exact leftIH.trans rightIH
  | targetAlpha => exact ActionAlpha.refl _
  | inputBinder => exact ActionAlpha.input _ _ _
  | boundOutputBinder binderFresh replacementFresh =>
      exact ActionAlpha.boundOutput binderFresh replacementFresh

end DerivativeAlpha

/-- Labelled derivatives modulo process alpha and bound-label alpha. -/
abbrev AlphaDerivative := Quotient DerivativeAlpha.setoid

@[simp]
theorem alphaDerivative_input_mk
    (channel binder replacement : Name)
    (target : Raw.Proc)
    (replacementFresh : replacement ≠ channel)
    (fresh : replacement ∉ target.allNames) :
    (Quotient.mk DerivativeAlpha.setoid
        (⟨.input channel binder, target⟩ : LabelledDerivative) :
      AlphaDerivative) =
      Quotient.mk DerivativeAlpha.setoid
        ⟨.input channel replacement,
          target.renameBound binder replacement⟩ :=
  Quotient.sound
    (DerivativeAlpha.inputBinder replacementFresh fresh)

@[simp]
theorem alphaDerivative_boundOutput_mk
    (channel binder replacement : Name)
    (target : Raw.Proc)
    (binderFresh : binder ≠ channel)
    (replacementFresh : replacement ≠ channel)
    (fresh : replacement ∉ target.allNames) :
    (Quotient.mk DerivativeAlpha.setoid
        (⟨.boundOutput channel binder, target⟩ :
          LabelledDerivative) :
      AlphaDerivative) =
      Quotient.mk DerivativeAlpha.setoid
        ⟨.boundOutput channel replacement,
          target.renameBound binder replacement⟩ :=
  Quotient.sound
    (DerivativeAlpha.boundOutputBinder
      binderFresh replacementFresh fresh)

/-! ## Fresh raw substitution facts -/

/-- Substituting a name absent from the free support is syntactically inert. -/
theorem substRaw_eq_self_of_not_mem_freeNames
    (process : Raw.Proc) (needle replacement : Name)
    (absent : needle ∉ process.freeNames) :
    process.substRaw needle replacement = process := by
  induction process with
  | zero => rfl
  | tau next inductionHypothesis =>
      exact congrArg Raw.Proc.tau
        (inductionHypothesis absent)
  | send channel value next inductionHypothesis =>
      simp only [Raw.Proc.freeNames, Finset.mem_insert, not_or] at absent
      simp [Raw.Proc.substRaw, Ne.symm absent.1,
        Ne.symm absent.2.1, inductionHypothesis absent.2.2]
  | recv channel binder next inductionHypothesis =>
      simp only [Raw.Proc.freeNames, Finset.mem_insert, not_or] at absent
      have channelNe : channel ≠ needle :=
        Ne.symm absent.1
      by_cases binderNeedle : binder = needle
      · simp [Raw.Proc.substRaw, channelNe, binderNeedle]
      · have nextAbsent : needle ∉ next.freeNames := by
          intro member
          exact absent.2
            (Finset.mem_erase.mpr ⟨Ne.symm binderNeedle, member⟩)
        simp [Raw.Proc.substRaw, channelNe, binderNeedle,
          inductionHypothesis nextAbsent]
  | choice left right leftIH rightIH =>
      simp only [Raw.Proc.freeNames, Finset.mem_union, not_or] at absent
      simp [Raw.Proc.substRaw, leftIH absent.1, rightIH absent.2]
  | par left right leftIH rightIH =>
      simp only [Raw.Proc.freeNames, Finset.mem_union, not_or] at absent
      simp [Raw.Proc.substRaw, leftIH absent.1, rightIH absent.2]
  | new binder body inductionHypothesis =>
      by_cases binderNeedle : binder = needle
      · simp [Raw.Proc.substRaw, binderNeedle]
      · have bodyAbsent : needle ∉ body.freeNames := by
          intro member
          exact absent
            (Finset.mem_erase.mpr ⟨Ne.symm binderNeedle, member⟩)
        simp [Raw.Proc.substRaw, binderNeedle,
          inductionHypothesis bodyAbsent]
  | matchEq left right next inductionHypothesis =>
      simp only [Raw.Proc.freeNames, Finset.mem_insert, not_or] at absent
      simp [Raw.Proc.substRaw, Ne.symm absent.1,
        Ne.symm absent.2.1, inductionHypothesis absent.2.2]
  | matchNe left right next inductionHypothesis =>
      simp only [Raw.Proc.freeNames, Finset.mem_insert, not_or] at absent
      simp [Raw.Proc.substRaw, Ne.symm absent.1,
        Ne.symm absent.2.1, inductionHypothesis absent.2.2]

/-! ## Native input alpha conversion -/

/-- Every free name of a native label occurs in the raw source syntax. -/
theorem nativeStep_actionFreeNames_subset_sourceAllNames
    (step : Late.NativeStep source action target) :
    action.freeNames ⊆ source.allNames := by
  induction step <;>
    simp_all [Raw.Action.freeNames, Raw.Proc.allNames,
      Finset.subset_iff]

/--
Fresh substitution is equivariant for an ordinary output whose channel is
not the renamed value.  This is the operational core needed by `open` when a
restricted output name is alpha-freshened.
-/
private theorem nativeOutput_substValue_of_eq
    (step : Late.NativeStep source action target)
    (actionEq : action = .output channel value)
    (channelNeValue : channel ≠ value)
    (sourceFresh : replacement ∉ source.allNames) :
    Late.NativeStep
      (source.substRaw value replacement)
      (.output channel replacement)
      (target.substRaw value replacement) := by
  induction step generalizing channel value replacement with
  | prefixTau =>
      cases actionEq
  | @prefixOutput actualChannel actualValue next =>
      cases actionEq
      simpa [Raw.Proc.substRaw, channelNeValue] using
        (Late.NativeStep.prefixOutput :
          Late.NativeStep
            (.send actualChannel replacement
              (next.substRaw actualValue replacement))
            (.output actualChannel replacement)
            (next.substRaw actualValue replacement))
  | prefixInput =>
      cases actionEq
  | @matchGuard body actualAction actualTarget name inner
      inductionHypothesis =>
      have bodyFresh : replacement ∉ body.allNames := by
        have split :
            replacement ≠ name ∧ replacement ≠ name ∧
              replacement ∉ body.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
            using sourceFresh
        exact split.2.2
      have renamedStep :=
        inductionHypothesis actionEq channelNeValue bodyFresh
      simpa [Raw.Proc.substRaw] using
        Late.NativeStep.matchGuard renamedStep
  | @mismatchGuard leftName rightName body actualAction actualTarget
      distinct inner inductionHypothesis =>
      have split :
          replacement ≠ leftName ∧ replacement ≠ rightName ∧
            replacement ∉ body.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
          using sourceFresh
      have renamedStep :=
        inductionHypothesis actionEq channelNeValue split.2.2
      have renamedDistinct :
          (if leftName = value then replacement else leftName) ≠
            (if rightName = value then replacement else rightName) := by
        by_cases leftValue : leftName = value
        · by_cases rightValue : rightName = value
          · exact (distinct (leftValue.trans rightValue.symm)).elim
          · simpa [leftValue, rightValue] using split.2.1
        · by_cases rightValue : rightName = value
          · simpa [leftValue, rightValue] using (Ne.symm split.1)
          · simpa [leftValue, rightValue] using distinct
      simpa [Raw.Proc.substRaw] using
        Late.NativeStep.mismatchGuard renamedDistinct renamedStep
  | @choiceLeft left actualAction next right inner
      inductionHypothesis =>
      have split :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      have renamedStep :=
        inductionHypothesis actionEq channelNeValue split.1
      simpa [Raw.Proc.substRaw] using
        (Late.NativeStep.choiceLeft
          (right := right.substRaw value replacement)
          renamedStep)
  | @choiceRight right actualAction next left inner
      inductionHypothesis =>
      have split :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      have renamedStep :=
        inductionHypothesis actionEq channelNeValue split.2
      simpa [Raw.Proc.substRaw] using
        (Late.NativeStep.choiceRight
          (left := left.substRaw value replacement)
          renamedStep)
  | @parLeft left actualAction next right fresh inner
      inductionHypothesis =>
      have split :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      have renamedStep :=
        inductionHypothesis actionEq channelNeValue split.1
      have noBound :
          Disjoint
            (Raw.Action.output channel replacement).boundNames
            (right.substRaw value replacement).freeNames := by
        simp [Raw.Action.boundNames]
      simpa [Raw.Proc.substRaw] using
        Late.NativeStep.parLeft noBound renamedStep
  | @parRight right actualAction next left fresh inner
      inductionHypothesis =>
      have split :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      have renamedStep :=
        inductionHypothesis actionEq channelNeValue split.2
      have noBound :
          Disjoint
            (Raw.Action.output channel replacement).boundNames
            (left.substRaw value replacement).freeNames := by
        simp [Raw.Action.boundNames]
      simpa [Raw.Proc.substRaw] using
        Late.NativeStep.parRight noBound renamedStep
  | syncLeft =>
      cases actionEq
  | syncRight =>
      cases actionEq
  | @restrict restricted body actualAction next fresh inner
      inductionHypothesis =>
      have split :
          replacement ≠ restricted ∧
            replacement ∉ body.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
          using sourceFresh
      have originalFresh :
          restricted ≠ channel ∧ restricted ≠ value := by
        simpa [actionEq, Raw.Action.names] using fresh
      have renamedStep :=
        inductionHypothesis actionEq channelNeValue split.2
      have renamedFresh :
          restricted ∉
            (Raw.Action.output channel replacement).names := by
        simp [Raw.Action.names, originalFresh.1, Ne.symm split.1]
      simpa [Raw.Proc.substRaw, originalFresh.2] using
        Late.NativeStep.restrict renamedFresh renamedStep
  | «open» =>
      cases actionEq
  | closeLeft =>
      cases actionEq
  | closeRight =>
      cases actionEq

private theorem alphaRenameInput_of_eq
    (step : Late.NativeStep source action target)
    (actionEq : action = .input channel binder)
    (sourceFresh : replacement ∉ source.allNames)
    (targetFresh : replacement ∉ target.allNames) :
    ∃ renamedSource,
      Late.Alpha source renamedSource ∧
      Late.NativeStep renamedSource
        (.input channel replacement)
        (target.renameBound binder replacement) := by
  induction step generalizing channel binder replacement with
  | prefixTau =>
      cases actionEq
  | prefixOutput =>
      cases actionEq
  | @prefixInput actualChannel actualBinder actualTarget =>
      cases actionEq
      refine
        ⟨.recv actualChannel replacement
            (actualTarget.renameBound actualBinder replacement),
          ?_, Late.NativeStep.prefixInput⟩
      exact Late.Alpha.recvBinder targetFresh
  | @matchGuard body actualAction actualTarget name inner
      inductionHypothesis =>
      have bodyFresh : replacement ∉ body.allNames := by
        have split :
            replacement ≠ name ∧ replacement ≠ name ∧
              replacement ∉ body.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
            using sourceFresh
        exact split.2.2
      rcases inductionHypothesis actionEq bodyFresh targetFresh with
        ⟨renamedBody, bodyAlpha, renamedStep⟩
      exact
        ⟨.matchEq _ _ renamedBody,
          Late.Alpha.matchEq bodyAlpha,
          Late.NativeStep.matchGuard renamedStep⟩
  | @mismatchGuard leftName rightName body actualAction actualTarget
      distinct inner inductionHypothesis =>
      have bodyFresh : replacement ∉ body.allNames := by
        have split :
            replacement ≠ leftName ∧ replacement ≠ rightName ∧
              replacement ∉ body.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
            using sourceFresh
        exact split.2.2
      rcases inductionHypothesis actionEq bodyFresh targetFresh with
        ⟨renamedBody, bodyAlpha, renamedStep⟩
      exact
        ⟨.matchNe _ _ renamedBody,
          Late.Alpha.matchNe bodyAlpha,
          Late.NativeStep.mismatchGuard distinct renamedStep⟩
  | @choiceLeft left actualAction next right inner inductionHypothesis =>
      have leftFresh : replacement ∉ left.allNames := by
        have split :
            replacement ∉ left.allNames ∧
              replacement ∉ right.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
            using sourceFresh
        exact split.1
      rcases inductionHypothesis actionEq leftFresh targetFresh with
        ⟨renamedLeft, leftAlpha, renamedStep⟩
      exact
        ⟨Raw.Proc.choice renamedLeft right,
          Late.Alpha.choice leftAlpha (Late.Alpha.refl right),
          Late.NativeStep.choiceLeft renamedStep⟩
  | @choiceRight right actualAction next left inner inductionHypothesis =>
      have rightFresh : replacement ∉ right.allNames := by
        have split :
            replacement ∉ left.allNames ∧
              replacement ∉ right.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
            using sourceFresh
        exact split.2
      rcases inductionHypothesis actionEq rightFresh targetFresh with
        ⟨renamedRight, rightAlpha, renamedStep⟩
      exact
        ⟨Raw.Proc.choice left renamedRight,
          Late.Alpha.choice (Late.Alpha.refl left) rightAlpha,
          Late.NativeStep.choiceRight renamedStep⟩
  | @parLeft left actualAction next right fresh inner
      inductionHypothesis =>
      have leftFresh : replacement ∉ left.allNames := by
        have split :
            replacement ∉ left.allNames ∧
              replacement ∉ right.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
            using sourceFresh
        exact split.1
      have nextFresh : replacement ∉ next.allNames := by
        have split :
            replacement ∉ next.allNames ∧
              replacement ∉ right.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
            using targetFresh
        exact split.1
      have rightReplacementFresh :
          replacement ∉ right.freeNames := by
        intro member
        apply sourceFresh
        exact Finset.mem_union_right _
          (Raw.Proc.freeNames_subset_allNames right member)
      have binderRightFresh :
          binder ∉ right.freeNames := by
        simpa [actionEq, Raw.Action.boundNames] using fresh
      rcases inductionHypothesis actionEq leftFresh nextFresh with
        ⟨renamedLeft, leftAlpha, renamedStep⟩
      have renamedFresh :
          Disjoint
            (Raw.Action.input channel replacement).boundNames
            right.freeNames := by
        simpa [Raw.Action.boundNames] using
          rightReplacementFresh
      refine
        ⟨Raw.Proc.par renamedLeft right,
          Late.Alpha.par leftAlpha (Late.Alpha.refl right), ?_⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw,
        substRaw_eq_self_of_not_mem_freeNames
          right binder replacement binderRightFresh] using
        Late.NativeStep.parLeft renamedFresh renamedStep
  | @parRight right actualAction next left fresh inner
      inductionHypothesis =>
      have rightFresh : replacement ∉ right.allNames := by
        have split :
            replacement ∉ left.allNames ∧
              replacement ∉ right.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
            using sourceFresh
        exact split.2
      have nextFresh : replacement ∉ next.allNames := by
        have split :
            replacement ∉ left.allNames ∧
              replacement ∉ next.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
            using targetFresh
        exact split.2
      have leftReplacementFresh :
          replacement ∉ left.freeNames := by
        intro member
        apply sourceFresh
        exact Finset.mem_union_left _
          (Raw.Proc.freeNames_subset_allNames left member)
      have binderLeftFresh :
          binder ∉ left.freeNames := by
        simpa [actionEq, Raw.Action.boundNames] using fresh
      rcases inductionHypothesis actionEq rightFresh nextFresh with
        ⟨renamedRight, rightAlpha, renamedStep⟩
      have renamedFresh :
          Disjoint
            (Raw.Action.input channel replacement).boundNames
            left.freeNames := by
        simpa [Raw.Action.boundNames] using
          leftReplacementFresh
      refine
        ⟨Raw.Proc.par left renamedRight,
          Late.Alpha.par (Late.Alpha.refl left) rightAlpha, ?_⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw,
        substRaw_eq_self_of_not_mem_freeNames
          left binder replacement binderLeftFresh] using
        Late.NativeStep.parRight renamedFresh renamedStep
  | syncLeft =>
      cases actionEq
  | syncRight =>
      cases actionEq
  | @restrict restricted body actualAction next fresh inner
      inductionHypothesis =>
      have bodyFresh : replacement ∉ body.allNames := by
        have split :
            replacement ≠ restricted ∧
              replacement ∉ body.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
            using sourceFresh
        exact split.2
      have nextFresh : replacement ∉ next.allNames := by
        have split :
            replacement ≠ restricted ∧
              replacement ∉ next.allNames := by
          simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
            using targetFresh
        exact split.2
      have originalFresh :
          restricted ≠ channel ∧ restricted ≠ binder := by
        simpa [actionEq, Raw.Action.names] using fresh
      have restrictedNeBinder : restricted ≠ binder :=
        originalFresh.2
      have restrictedNeReplacement : restricted ≠ replacement := by
        intro equality
        subst restricted
        exact sourceFresh (by simp [Raw.Proc.allNames])
      rcases inductionHypothesis actionEq bodyFresh nextFresh with
        ⟨renamedBody, bodyAlpha, renamedStep⟩
      have renamedActionFresh :
          restricted ∉
            (Raw.Action.input channel replacement).names := by
        simp [Raw.Action.names, originalFresh.1,
          restrictedNeReplacement]
      refine
        ⟨Raw.Proc.new restricted renamedBody,
          Late.Alpha.new bodyAlpha, ?_⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw,
        restrictedNeBinder] using
        Late.NativeStep.restrict renamedActionFresh renamedStep
  | «open» =>
      cases actionEq
  | closeLeft =>
      cases actionEq
  | closeRight =>
      cases actionEq

/--
Freshly rename the binder of any native late input derivation.

The source changes only by process alpha equivalence.  The target uses the
matching free substitution because the input label binds that name in the
derivative.
-/
theorem alphaRenameInput
    (step :
      Late.NativeStep source (.input channel binder) target)
    (sourceFresh : replacement ∉ source.allNames)
    (targetFresh : replacement ∉ target.allNames) :
    ∃ renamedSource,
      Late.Alpha source renamedSource ∧
      Late.NativeStep renamedSource
        (.input channel replacement)
        (target.renameBound binder replacement) :=
  alphaRenameInput_of_eq step rfl sourceFresh targetFresh

/--
The renamed input derivative is in the same action/derivative alpha class.
-/
theorem alphaRenameInput_compatible
    (step :
      Late.NativeStep source (.input channel binder) target)
    (sourceFresh : replacement ∉ source.allNames)
    (targetFresh : replacement ∉ target.allNames) :
    ∃ renamedSource renamedTarget,
      Late.Alpha source renamedSource ∧
      Late.NativeStep renamedSource
        (.input channel replacement) renamedTarget ∧
      DerivativeAlpha
        ⟨.input channel binder, target⟩
        ⟨.input channel replacement, renamedTarget⟩ := by
  have replacementFresh : replacement ≠ channel := by
    intro equality
    subst replacement
    apply sourceFresh
    exact nativeStep_actionFreeNames_subset_sourceAllNames step
      (by simp [Raw.Action.freeNames])
  rcases alphaRenameInput step sourceFresh targetFresh with
    ⟨renamedSource, sourceAlpha, renamedStep⟩
  exact
    ⟨renamedSource, target.renameBound binder replacement,
      sourceAlpha, renamedStep,
      DerivativeAlpha.inputBinder replacementFresh targetFresh⟩

private theorem nativeBoundOutput_binder_ne_channel_of_eq
    (step : Late.NativeStep source action target)
    (actionEq : action = .boundOutput channel binder) :
    binder ≠ channel := by
  induction step generalizing channel binder with
  | prefixTau => cases actionEq
  | prefixOutput => cases actionEq
  | prefixInput => cases actionEq
  | matchGuard inner inductionHypothesis =>
      exact inductionHypothesis actionEq
  | mismatchGuard distinct inner inductionHypothesis =>
      exact inductionHypothesis actionEq
  | choiceLeft inner inductionHypothesis =>
      exact inductionHypothesis actionEq
  | choiceRight inner inductionHypothesis =>
      exact inductionHypothesis actionEq
  | parLeft fresh inner inductionHypothesis =>
      exact inductionHypothesis actionEq
  | parRight fresh inner inductionHypothesis =>
      exact inductionHypothesis actionEq
  | syncLeft => cases actionEq
  | syncRight => cases actionEq
  | restrict fresh inner inductionHypothesis =>
      exact inductionHypothesis actionEq
  | @«open» actualBinder actualChannel body next distinct inner
      inductionHypothesis =>
      cases actionEq
      exact distinct
  | closeLeft => cases actionEq
  | closeRight => cases actionEq

/-- Every native bound output has a binder distinct from its free channel. -/
theorem nativeBoundOutput_binder_ne_channel
    (step :
      Late.NativeStep source (.boundOutput channel binder) target) :
    binder ≠ channel :=
  nativeBoundOutput_binder_ne_channel_of_eq step rfl

private theorem alphaRenameBoundOutput_of_eq
    (step : Late.NativeStep source action target)
    (actionEq : action = .boundOutput channel binder)
    (sourceFresh : replacement ∉ source.allNames)
    (targetFresh : replacement ∉ target.allNames) :
    ∃ renamedSource,
      Late.Alpha source renamedSource ∧
      Late.NativeStep renamedSource
        (.boundOutput channel replacement)
        (target.renameBound binder replacement) := by
  induction step generalizing channel binder replacement with
  | prefixTau => cases actionEq
  | prefixOutput => cases actionEq
  | prefixInput => cases actionEq
  | @matchGuard body actualAction actualTarget name inner
      inductionHypothesis =>
      have split :
          replacement ≠ name ∧ replacement ≠ name ∧
            replacement ∉ body.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
          using sourceFresh
      rcases inductionHypothesis actionEq split.2.2 targetFresh with
        ⟨renamedBody, bodyAlpha, renamedStep⟩
      exact
        ⟨.matchEq _ _ renamedBody,
          Late.Alpha.matchEq bodyAlpha,
          Late.NativeStep.matchGuard renamedStep⟩
  | @mismatchGuard leftName rightName body actualAction actualTarget
      distinct inner inductionHypothesis =>
      have split :
          replacement ≠ leftName ∧ replacement ≠ rightName ∧
            replacement ∉ body.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
          using sourceFresh
      rcases inductionHypothesis actionEq split.2.2 targetFresh with
        ⟨renamedBody, bodyAlpha, renamedStep⟩
      exact
        ⟨.matchNe _ _ renamedBody,
          Late.Alpha.matchNe bodyAlpha,
          Late.NativeStep.mismatchGuard distinct renamedStep⟩
  | @choiceLeft left actualAction next right inner
      inductionHypothesis =>
      have split :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      rcases inductionHypothesis actionEq split.1 targetFresh with
        ⟨renamedLeft, leftAlpha, renamedStep⟩
      exact
        ⟨.choice renamedLeft right,
          Late.Alpha.choice leftAlpha (Late.Alpha.refl right),
          Late.NativeStep.choiceLeft renamedStep⟩
  | @choiceRight right actualAction next left inner
      inductionHypothesis =>
      have split :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      rcases inductionHypothesis actionEq split.2 targetFresh with
        ⟨renamedRight, rightAlpha, renamedStep⟩
      exact
        ⟨.choice left renamedRight,
          Late.Alpha.choice (Late.Alpha.refl left) rightAlpha,
          Late.NativeStep.choiceRight renamedStep⟩
  | @parLeft left actualAction next right fresh inner
      inductionHypothesis =>
      have sourceSplit :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      have targetSplit :
          replacement ∉ next.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using targetFresh
      have binderRightFresh :
          binder ∉ right.freeNames := by
        simpa [actionEq, Raw.Action.boundNames] using fresh
      have replacementRightFresh :
          replacement ∉ right.freeNames := by
        intro member
        exact sourceSplit.2
          (Raw.Proc.freeNames_subset_allNames right member)
      rcases inductionHypothesis actionEq sourceSplit.1
          targetSplit.1 with
        ⟨renamedLeft, leftAlpha, renamedStep⟩
      have renamedFresh :
          Disjoint
            (Raw.Action.boundOutput channel replacement).boundNames
            right.freeNames := by
        simpa [Raw.Action.boundNames] using replacementRightFresh
      refine
        ⟨.par renamedLeft right,
          Late.Alpha.par leftAlpha (Late.Alpha.refl right), ?_⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw,
        substRaw_eq_self_of_not_mem_freeNames
          right binder replacement binderRightFresh] using
        Late.NativeStep.parLeft renamedFresh renamedStep
  | @parRight right actualAction next left fresh inner
      inductionHypothesis =>
      have sourceSplit :
          replacement ∉ left.allNames ∧
            replacement ∉ right.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using sourceFresh
      have targetSplit :
          replacement ∉ left.allNames ∧
            replacement ∉ next.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_union, not_or]
          using targetFresh
      have binderLeftFresh :
          binder ∉ left.freeNames := by
        simpa [actionEq, Raw.Action.boundNames] using fresh
      have replacementLeftFresh :
          replacement ∉ left.freeNames := by
        intro member
        exact sourceSplit.1
          (Raw.Proc.freeNames_subset_allNames left member)
      rcases inductionHypothesis actionEq sourceSplit.2
          targetSplit.2 with
        ⟨renamedRight, rightAlpha, renamedStep⟩
      have renamedFresh :
          Disjoint
            (Raw.Action.boundOutput channel replacement).boundNames
            left.freeNames := by
        simpa [Raw.Action.boundNames] using replacementLeftFresh
      refine
        ⟨.par left renamedRight,
          Late.Alpha.par (Late.Alpha.refl left) rightAlpha, ?_⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw,
        substRaw_eq_self_of_not_mem_freeNames
          left binder replacement binderLeftFresh] using
        Late.NativeStep.parRight renamedFresh renamedStep
  | syncLeft => cases actionEq
  | syncRight => cases actionEq
  | @restrict restricted body actualAction next fresh inner
      inductionHypothesis =>
      have sourceSplit :
          replacement ≠ restricted ∧
            replacement ∉ body.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
          using sourceFresh
      have targetSplit :
          replacement ≠ restricted ∧
            replacement ∉ next.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
          using targetFresh
      have originalFresh :
          restricted ≠ channel ∧ restricted ≠ binder := by
        simpa [actionEq, Raw.Action.names] using fresh
      rcases inductionHypothesis actionEq sourceSplit.2
          targetSplit.2 with
        ⟨renamedBody, bodyAlpha, renamedStep⟩
      have renamedFresh :
          restricted ∉
            (Raw.Action.boundOutput channel replacement).names := by
        simp [Raw.Action.names, originalFresh.1, Ne.symm sourceSplit.1]
      refine
        ⟨.new restricted renamedBody,
          Late.Alpha.new bodyAlpha, ?_⟩
      simpa [Raw.Proc.renameBound, Raw.Proc.substRaw,
        originalFresh.2] using
        Late.NativeStep.restrict renamedFresh renamedStep
  | @«open» actualBinder actualChannel body next distinct inner
      inductionHypothesis =>
      cases actionEq
      have split :
          replacement ≠ actualBinder ∧
            replacement ∉ body.allNames := by
        simpa only [Raw.Proc.allNames, Finset.mem_insert, not_or]
          using sourceFresh
      have replacementNeChannel :
          replacement ≠ actualChannel := by
        intro equality
        subst replacement
        exact split.2
          (nativeStep_actionFreeNames_subset_sourceAllNames inner
            (by simp [Raw.Action.freeNames]))
      have renamedInner :
          Late.NativeStep
            (body.substRaw actualBinder replacement)
            (.output actualChannel replacement)
            (next.substRaw actualBinder replacement) :=
        nativeOutput_substValue_of_eq inner rfl
          (Ne.symm distinct) split.2
      refine
        ⟨.new replacement
            (body.substRaw actualBinder replacement),
          ?_, ?_⟩
      · simpa [Raw.Proc.renameBound] using
          (Late.Alpha.newBinder split.2)
      · simpa [Raw.Proc.renameBound] using
          Late.NativeStep.open replacementNeChannel renamedInner
  | closeLeft => cases actionEq
  | closeRight => cases actionEq

/--
Freshly rename the binder of any native bound-output derivation, including
an `open` nested under guards, choices, parallel contexts, and restrictions.
-/
theorem alphaRenameBoundOutput
    (step :
      Late.NativeStep source (.boundOutput channel binder) target)
    (sourceFresh : replacement ∉ source.allNames)
    (targetFresh : replacement ∉ target.allNames) :
    ∃ renamedSource,
      Late.Alpha source renamedSource ∧
      Late.NativeStep renamedSource
        (.boundOutput channel replacement)
        (target.renameBound binder replacement) :=
  alphaRenameBoundOutput_of_eq step rfl sourceFresh targetFresh

/--
The renamed bound output is represented by the same alpha derivative.
-/
theorem alphaRenameBoundOutput_compatible
    (step :
      Late.NativeStep source (.boundOutput channel binder) target)
    (sourceFresh : replacement ∉ source.allNames)
    (targetFresh : replacement ∉ target.allNames) :
    ∃ renamedSource renamedTarget,
      Late.Alpha source renamedSource ∧
      Late.NativeStep renamedSource
        (.boundOutput channel replacement) renamedTarget ∧
      DerivativeAlpha
        ⟨.boundOutput channel binder, target⟩
        ⟨.boundOutput channel replacement, renamedTarget⟩ := by
  have binderFresh : binder ≠ channel :=
    nativeBoundOutput_binder_ne_channel step
  have replacementFresh : replacement ≠ channel := by
    intro equality
    subst replacement
    apply sourceFresh
    exact nativeStep_actionFreeNames_subset_sourceAllNames step
      (by simp [Raw.Action.freeNames])
  rcases alphaRenameBoundOutput step sourceFresh targetFresh with
    ⟨renamedSource, sourceAlpha, renamedStep⟩
  exact
    ⟨renamedSource, target.renameBound binder replacement,
      sourceAlpha, renamedStep,
      DerivativeAlpha.boundOutputBinder
        binderFresh replacementFresh targetFresh⟩

end Cantilune.Pi.OpenSMCActionAlpha
