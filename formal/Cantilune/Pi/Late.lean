import Cantilune.Pi.Core

/-!
# Finite-control standard late pi semantics

This module adds the nominal infrastructure that is intentionally absent from
`Cantilune.Pi.Core`:

* free/all-name analysis and deterministic fresh-name generation;
* total, capture-avoiding substitution (by alpha-freshening a conflicting
  binder before descending);
* alpha equivalence for input and restriction binders;
* structural congruence, including ACU laws for parallel and choice and the
  usual freshness-guarded restriction extrusion law;
* a strong late labelled transition system with bound-action freshness side
  conditions, closed under structural congruence.

The syntax remains finite control: there is no replication, recursion, or
infinite sum.  This file does not claim a completeness theorem for the full
pi-calculus.  The older `Raw.Step` relation remains the exact erasure target of
the typed reference kernel; `Late.NativeStep` is the stricter, hygienic
semantics used when standard late side conditions matter.
-/

namespace Cantilune.Pi

namespace Raw.Proc

/-- Names that occur free in a raw process. -/
def freeNames : Raw.Proc → Finset Name
  | .zero => ∅
  | .tau next => freeNames next
  | .send ch value next => insert ch (insert value (freeNames next))
  | .recv ch binder next => insert ch ((freeNames next).erase binder)
  | .choice left right => freeNames left ∪ freeNames right
  | .par left right => freeNames left ∪ freeNames right
  | .new binder body => (freeNames body).erase binder
  | .matchEq left right next => insert left (insert right (freeNames next))
  | .matchNe left right next => insert left (insert right (freeNames next))

/-- All names, including binder declarations, occurring in a raw process. -/
def allNames : Raw.Proc → Finset Name
  | .zero => ∅
  | .tau next => allNames next
  | .send ch value next => insert ch (insert value (allNames next))
  | .recv ch binder next => insert ch (insert binder (allNames next))
  | .choice left right => allNames left ∪ allNames right
  | .par left right => allNames left ∪ allNames right
  | .new binder body => insert binder (allNames body)
  | .matchEq left right next => insert left (insert right (allNames next))
  | .matchNe left right next => insert left (insert right (allNames next))

theorem freeNames_subset_allNames (process : Raw.Proc) :
    process.freeNames ⊆ process.allNames := by
  induction process <;>
    simp_all [freeNames, allNames, Finset.subset_iff] <;>
    aesop

/-- The finite set avoided by deterministic fresh-name generation. -/
def avoidance (process : Raw.Proc) (needle replacement : Name) : Finset Name :=
  process.allNames ∪ {needle, replacement}

/--
A deterministic fresh name.  It is one greater than the supremum of the
finite avoidance set.
-/
def freshName (process : Raw.Proc) (needle replacement : Name) : Name :=
  (process.avoidance needle replacement).sup id + 1

theorem freshName_not_mem_avoidance
    (process : Raw.Proc) (needle replacement : Name) :
    process.freshName needle replacement ∉
      process.avoidance needle replacement := by
  intro member
  have bounded :
      process.freshName needle replacement ≤
        (process.avoidance needle replacement).sup id :=
    Finset.le_sup (f := id) member
  have impossible :
      Nat.succ ((process.avoidance needle replacement).sup id) ≤
        (process.avoidance needle replacement).sup id := by
    simpa [freshName, Nat.succ_eq_add_one] using bounded
  exact (Nat.not_succ_le_self _) impossible

theorem freshName_not_mem_allNames
    (process : Raw.Proc) (needle replacement : Name) :
    process.freshName needle replacement ∉ process.allNames := by
  intro member
  exact process.freshName_not_mem_avoidance needle replacement
    (Finset.mem_union_left _ member)

theorem freshName_ne_needle
    (process : Raw.Proc) (needle replacement : Name) :
    process.freshName needle replacement ≠ needle := by
  intro equality
  apply process.freshName_not_mem_avoidance needle replacement
  rw [equality]
  simp [avoidance]

theorem freshName_ne_replacement
    (process : Raw.Proc) (needle replacement : Name) :
    process.freshName needle replacement ≠ replacement := by
  intro equality
  apply process.freshName_not_mem_avoidance needle replacement
  rw [equality]
  simp [avoidance]

/--
Rename the occurrences bound by an immediately enclosing binder.  Shadowing
binders with the same old name stop `substRaw`; callers require the new name
to be fresh for the body, so this operation cannot capture a free occurrence.
-/
def renameBound
    (body : Raw.Proc) (binder replacement : Name) : Raw.Proc :=
  body.substRaw binder replacement

theorem renameBound_eq_substRaw
    (body : Raw.Proc) (binder replacement : Name) :
    body.renameBound binder replacement =
      body.substRaw binder replacement :=
  rfl

/-- A structural depth used as sufficient recursion fuel. -/
def syntaxDepth : Raw.Proc → Nat
  | .zero => 1
  | .tau next => syntaxDepth next + 1
  | .send _ _ next => syntaxDepth next + 1
  | .recv _ _ next => syntaxDepth next + 1
  | .choice left right => max (syntaxDepth left) (syntaxDepth right) + 1
  | .par left right => max (syntaxDepth left) (syntaxDepth right) + 1
  | .new _ body => syntaxDepth body + 1
  | .matchEq _ _ next => syntaxDepth next + 1
  | .matchNe _ _ next => syntaxDepth next + 1

/--
Fuelled implementation of total capture-avoiding substitution.  Fuel is
decreased before every recursive descent.  When a binder equals the
replacement name, the binder and its bound occurrences are first renamed to a
deterministically fresh name.
-/
def substituteCaptureAvoidingAux :
    Nat → Raw.Proc → Name → Name → Raw.Proc
  | 0, process, _, _ => process
  | _ + 1, .zero, _, _ => .zero
  | fuel + 1, .tau next, needle, replacement =>
      .tau (substituteCaptureAvoidingAux fuel next needle replacement)
  | fuel + 1, .send ch value next, needle, replacement =>
      .send
        (if ch = needle then replacement else ch)
        (if value = needle then replacement else value)
        (substituteCaptureAvoidingAux fuel next needle replacement)
  | fuel + 1, .recv ch binder next, needle, replacement =>
      let ch' := if ch = needle then replacement else ch
      if binder = needle then
        .recv ch' binder next
      else if binder = replacement then
        let fresh := next.freshName needle replacement
        let renamed := next.renameBound binder fresh
        .recv ch' fresh
          (substituteCaptureAvoidingAux fuel renamed needle replacement)
      else
        .recv ch' binder
          (substituteCaptureAvoidingAux fuel next needle replacement)
  | fuel + 1, .choice left right, needle, replacement =>
      .choice
        (substituteCaptureAvoidingAux fuel left needle replacement)
        (substituteCaptureAvoidingAux fuel right needle replacement)
  | fuel + 1, .par left right, needle, replacement =>
      .par
        (substituteCaptureAvoidingAux fuel left needle replacement)
        (substituteCaptureAvoidingAux fuel right needle replacement)
  | fuel + 1, .new binder body, needle, replacement =>
      if binder = needle then
        .new binder body
      else if binder = replacement then
        let fresh := body.freshName needle replacement
        let renamed := body.renameBound binder fresh
        .new fresh
          (substituteCaptureAvoidingAux fuel renamed needle replacement)
      else
        .new binder
          (substituteCaptureAvoidingAux fuel body needle replacement)
  | fuel + 1, .matchEq left right next, needle, replacement =>
      .matchEq
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (substituteCaptureAvoidingAux fuel next needle replacement)
  | fuel + 1, .matchNe left right next, needle, replacement =>
      .matchNe
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (substituteCaptureAvoidingAux fuel next needle replacement)

/--
Total capture-avoiding substitution.  The fast branch agrees definitionally
with the existing executable substitution whenever no capture risk is found;
the slow branch alpha-freshens conflicting binders.
-/
def substituteCaptureAvoiding
    (process : Raw.Proc) (needle replacement : Name) : Raw.Proc :=
  if process.captureRisk needle replacement then
    substituteCaptureAvoidingAux process.syntaxDepth process needle replacement
  else
    process.substRaw needle replacement

theorem substituteCaptureAvoiding_eq_substRaw
    (process : Raw.Proc) (needle replacement : Name)
    (safe : process.captureRisk needle replacement = false) :
    process.substituteCaptureAvoiding needle replacement =
      process.substRaw needle replacement := by
  simp [substituteCaptureAvoiding, safe]

theorem substitute_some_of_no_capture
    (process : Raw.Proc) (needle replacement : Name)
    (safe : process.captureRisk needle replacement = false) :
    process.substitute needle replacement =
      some (process.substituteCaptureAvoiding needle replacement) := by
  simp [Raw.Proc.substitute, substituteCaptureAvoiding, safe]

end Raw.Proc

namespace Raw.Action

/-- Names bound in the derivative by a late action. -/
def boundNames : Raw.Action → Finset Name
  | .input _ binder => {binder}
  | .boundOutput _ fresh => {fresh}
  | .tau
  | .output _ _ => ∅

/-- Names occurring free in a late action. -/
def freeNames : Raw.Action → Finset Name
  | .tau => ∅
  | .output ch value => {ch, value}
  | .input ch _ => {ch}
  | .boundOutput ch _ => {ch}

theorem names_eq_free_union_bound (action : Raw.Action) :
    action.names = action.freeNames ∪ action.boundNames := by
  cases action <;> simp [Raw.Action.names, freeNames, boundNames]

end Raw.Action

namespace Late

/--
Alpha equivalence generated by congruence and capture-free renaming of input
and restriction binders.
-/
inductive Alpha : Raw.Proc → Raw.Proc → Prop where
  | refl (process) : Alpha process process
  | symm (relation : Alpha left right) : Alpha right left
  | trans (first : Alpha left middle) (second : Alpha middle right) :
      Alpha left right
  | tau (relation : Alpha next next') :
      Alpha (.tau next) (.tau next')
  | send (relation : Alpha next next') :
      Alpha (.send ch value next) (.send ch value next')
  | recv (relation : Alpha next next') :
      Alpha (.recv ch binder next) (.recv ch binder next')
  | choice
      (leftRelation : Alpha left left')
      (rightRelation : Alpha right right') :
      Alpha (.choice left right) (.choice left' right')
  | par
      (leftRelation : Alpha left left')
      (rightRelation : Alpha right right') :
      Alpha (.par left right) (.par left' right')
  | new (relation : Alpha body body') :
      Alpha (.new binder body) (.new binder body')
  | matchEq (relation : Alpha next next') :
      Alpha (.matchEq left right next) (.matchEq left right next')
  | matchNe (relation : Alpha next next') :
      Alpha (.matchNe left right next) (.matchNe left right next')
  | recvBinder
      (fresh : replacement ∉ body.allNames) :
      Alpha
        (.recv ch binder body)
        (.recv ch replacement (body.renameBound binder replacement))
  | newBinder
      (fresh : replacement ∉ body.allNames) :
      Alpha
        (.new binder body)
        (.new replacement (body.renameBound binder replacement))

namespace Alpha

theorem equivalence : Equivalence Alpha :=
  ⟨Alpha.refl, @Alpha.symm, @Alpha.trans⟩

def setoid : Setoid Raw.Proc where
  r := Alpha
  iseqv := equivalence

end Alpha

/--
Structural congruence for the finite syntax.  Parallel and choice each form a
commutative monoid; restriction is alpha-compatible, commutes with a distinct
restriction, eliminates over zero, and extrudes across a parallel component
that does not contain its binder free.
-/
inductive Struct : Raw.Proc → Raw.Proc → Prop where
  | refl (process) : Struct process process
  | symm (relation : Struct left right) : Struct right left
  | trans (first : Struct left middle) (second : Struct middle right) :
      Struct left right
  | alpha (relation : Alpha left right) : Struct left right
  | tau (relation : Struct next next') :
      Struct (.tau next) (.tau next')
  | send (relation : Struct next next') :
      Struct (.send ch value next) (.send ch value next')
  | recv (relation : Struct next next') :
      Struct (.recv ch binder next) (.recv ch binder next')
  | choice
      (leftRelation : Struct left left')
      (rightRelation : Struct right right') :
      Struct (.choice left right) (.choice left' right')
  | par
      (leftRelation : Struct left left')
      (rightRelation : Struct right right') :
      Struct (.par left right) (.par left' right')
  | new (relation : Struct body body') :
      Struct (.new binder body) (.new binder body')
  | matchEq (relation : Struct next next') :
      Struct (.matchEq left right next) (.matchEq left right next')
  | matchNe (relation : Struct next next') :
      Struct (.matchNe left right next) (.matchNe left right next')
  | parZero : Struct (.par process .zero) process
  | parComm : Struct (.par left right) (.par right left)
  | parAssoc :
      Struct (.par (.par first second) third)
        (.par first (.par second third))
  | choiceZero : Struct (.choice process .zero) process
  | choiceComm : Struct (.choice left right) (.choice right left)
  | choiceAssoc :
      Struct (.choice (.choice first second) third)
        (.choice first (.choice second third))
  | newZero : Struct (.new binder .zero) .zero
  | newComm (distinct : first ≠ second) :
      Struct (.new first (.new second body))
        (.new second (.new first body))
  | scopeExtrude
      (fresh : binder ∉ left.freeNames) :
      Struct (.new binder (.par left right))
        (.par left (.new binder right))

namespace Struct

theorem equivalence : Equivalence Struct :=
  ⟨Struct.refl, @Struct.symm, @Struct.trans⟩

def setoid : Setoid Raw.Proc where
  r := Struct
  iseqv := equivalence

theorem par_zero_left (process : Raw.Proc) :
    Struct (.par .zero process) process :=
  Struct.trans Struct.parComm Struct.parZero

theorem choice_zero_left (process : Raw.Proc) :
    Struct (.choice .zero process) process :=
  Struct.trans Struct.choiceComm Struct.choiceZero

end Struct

/--
The native strong late relation before structural-congruence closure.

The parallel rules enforce freshness of names bound by the action in the
untouched component.  Communication substitutes only after the input
transition, as required by late semantics.
-/
inductive NativeStep : Raw.Proc → Raw.Action → Raw.Proc → Prop where
  | prefixTau :
      NativeStep (.tau next) .tau next
  | prefixOutput :
      NativeStep (.send ch value next) (.output ch value) next
  | prefixInput :
      NativeStep (.recv ch binder next) (.input ch binder) next
  | matchGuard
      (step : NativeStep body action target) :
      NativeStep (.matchEq name name body) action target
  | mismatchGuard
      (distinct : left ≠ right)
      (step : NativeStep body action target) :
      NativeStep (.matchNe left right body) action target
  | choiceLeft (step : NativeStep left action next) :
      NativeStep (.choice left right) action next
  | choiceRight (step : NativeStep right action next) :
      NativeStep (.choice left right) action next
  | parLeft
      (fresh : Disjoint action.boundNames right.freeNames)
      (step : NativeStep left action next) :
      NativeStep (.par left right) action (.par next right)
  | parRight
      (fresh : Disjoint action.boundNames left.freeNames)
      (step : NativeStep right action next) :
      NativeStep (.par left right) action (.par left next)
  | syncLeft
      (outputStep : NativeStep left (.output ch value) left')
      (inputStep : NativeStep right (.input ch binder) right')
      (fresh : binder ∉ left'.freeNames) :
      NativeStep (.par left right) .tau
        (.par left' (right'.substituteCaptureAvoiding binder value))
  | syncRight
      (inputStep : NativeStep left (.input ch binder) left')
      (outputStep : NativeStep right (.output ch value) right')
      (fresh : binder ∉ right'.freeNames) :
      NativeStep (.par left right) .tau
        (.par (left'.substituteCaptureAvoiding binder value) right')
  | restrict
      (fresh : binder ∉ action.names)
      (step : NativeStep body action next) :
      NativeStep (.new binder body) action (.new binder next)
  | open
      (distinct : fresh ≠ ch)
      (step : NativeStep body (.output ch fresh) next) :
      NativeStep (.new fresh body) (.boundOutput ch fresh) next
  | closeLeft
      (outputStep : NativeStep left (.boundOutput ch fresh) left')
      (inputStep : NativeStep right (.input ch binder) right')
      (freshForReceiver : fresh ∉ right.freeNames)
      (binderFresh : binder ∉ left'.freeNames) :
      NativeStep (.par left right) .tau
        (.new fresh
          (.par left' (right'.substituteCaptureAvoiding binder fresh)))
  | closeRight
      (inputStep : NativeStep left (.input ch binder) left')
      (outputStep : NativeStep right (.boundOutput ch fresh) right')
      (freshForReceiver : fresh ∉ left.freeNames)
      (binderFresh : binder ∉ right'.freeNames) :
      NativeStep (.par left right) .tau
        (.new fresh
          (.par (left'.substituteCaptureAvoiding binder fresh) right'))

/-- Strong late transition modulo structural congruence at both endpoints. -/
inductive Step : Raw.Proc → Raw.Action → Raw.Proc → Prop where
  | native (step : NativeStep source action target) :
      Step source action target
  | congr
      (sourceCongruence : Struct source source')
      (step : NativeStep source' action target')
      (targetCongruence : Struct target' target) :
      Step source action target

namespace Step

theorem source_struct
    (sourceCongruence : Struct source source')
    (step : NativeStep source' action target) :
    Step source action target :=
  Step.congr sourceCongruence step (Struct.refl target)

theorem target_struct
    (step : NativeStep source action target')
    (targetCongruence : Struct target' target) :
    Step source action target :=
  Step.congr (Struct.refl source) step targetCongruence

/--
Structural closure is stable under further congruence at both endpoints, not
just for a freshly constructed native derivation.
-/
theorem structural_closure
    (sourceCongruence : Struct source source')
    (step : Step source' action target')
    (targetCongruence : Struct target' target) :
    Step source action target := by
  cases step with
  | native nativeStep =>
      exact Step.congr sourceCongruence nativeStep targetCongruence
  | congr innerSource nativeStep innerTarget =>
      exact Step.congr
        (Struct.trans sourceCongruence innerSource)
        nativeStep
        (Struct.trans innerTarget targetCongruence)

end Step

/--
Stable alias for the already kernel-checked typed-to-independent-raw erasure
theorem.  It records the exact compatibility boundary: the typed reference
kernel erases to `Raw.Step`; the stricter `Late.NativeStep` additionally
requires the standard freshness premises above.
-/
theorem typed_kernel_erasure_operational
    {process next : Cantilune.Pi.Proc} {action : Cantilune.Pi.Action}
    (step : Cantilune.Pi.Step process action next) :
    Raw.Step process.erase action.erase next.erase :=
  Cantilune.Pi.typed_pi_erasure_operational step

end Late

end Cantilune.Pi
