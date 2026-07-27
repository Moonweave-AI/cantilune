import Mathlib

/-!
# A finite-control typed π-calculus core

This file defines a deliberately small π-calculus kernel.  Processes are finite
syntax trees: there is no recursion and no replication.  Names are nominal
natural numbers, while a separate environment supplies their sorts and channel
payload sorts.

Substitution is executable and capture-safe in a restricted, explicit sense:
it returns `none` instead of crossing an input or restriction binder that would
capture the replacement name.  The communication rules only accept successful
substitutions.

`Raw` is an independently defined untyped syntax and labelled transition
system.  It is not defined as the image of the typed transition system; the
erasure theorem below is therefore a genuine preservation statement.

This kernel does not yet quotient by α-equivalence or structural congruence,
and it does not formalise the usual bound-name freshness side condition for a
general parallel-context rule.  Consequently `Raw.Step` is a finite
late-inspired reference relation, not yet an equivalence proof with a complete
standard late-π LTS.
-/

namespace Cantilune.Pi

abbrev Name := Nat

/-- The two name sorts needed by the reference protocols. -/
inductive NameSort where
  | data
  | channel
  deriving DecidableEq, Repr

/--
An environment assigns a sort to every name and, for names used as channels,
the sort of payload accepted by that channel.
-/
structure TypeEnv where
  sort : Name → NameSort
  payload : Name → NameSort

/-- A channel occurrence records the expected sort of its payload. -/
structure Channel where
  name : Name
  payload : NameSort
  deriving DecidableEq, Repr

/--
Finite-control process syntax.  `recv c x p` and `new x p` bind `x` in `p`.
There is no recursion or replication.
-/
inductive Proc where
  | zero
  | tau (next : Proc)
  | send (ch : Channel) (value : Name) (next : Proc)
  | recv (ch : Channel) (binder : Name) (next : Proc)
  | choice (left right : Proc)
  | par (left right : Proc)
  | new (binder : Name) (body : Proc)
  | matchEq (left right : Name) (next : Proc)
  | matchNe (left right : Name) (next : Proc)
  deriving DecidableEq, Repr

namespace Proc

/-- A syntax-directed typing judgment for the annotated process language. -/
def WellTyped (Γ : TypeEnv) : Proc → Prop
  | .zero => True
  | .tau next => WellTyped Γ next
  | .send ch value next =>
      Γ.sort ch.name = .channel ∧
      Γ.payload ch.name = ch.payload ∧
      Γ.sort value = ch.payload ∧
      WellTyped Γ next
  | .recv ch binder next =>
      Γ.sort ch.name = .channel ∧
      Γ.payload ch.name = ch.payload ∧
      Γ.sort binder = ch.payload ∧
      WellTyped Γ next
  | .choice left right => WellTyped Γ left ∧ WellTyped Γ right
  | .par left right => WellTyped Γ left ∧ WellTyped Γ right
  | .new binder body => Γ.sort binder = .channel ∧ WellTyped Γ body
  | .matchEq left right next =>
      Γ.sort left = Γ.sort right ∧ WellTyped Γ next
  | .matchNe left right next =>
      Γ.sort left = Γ.sort right ∧ WellTyped Γ next

/-- Replace the free occurrence of a channel name. -/
private def substChannel (ch : Channel) (needle replacement : Name) : Channel :=
  if ch.name = needle then { ch with name := replacement } else ch

/--
Detect whether replacing free `needle` by `replacement` would cross a binder
for `replacement`.  A binder for `needle` stops the search because occurrences
below it are not free.
-/
def captureRisk (needle replacement : Name) : Proc → Bool
  | .zero => false
  | .tau next => captureRisk needle replacement next
  | .send _ _ next => captureRisk needle replacement next
  | .recv _ binder next =>
      if binder = needle then false
      else decide (binder = replacement) || captureRisk needle replacement next
  | .choice left right =>
      captureRisk needle replacement left || captureRisk needle replacement right
  | .par left right =>
      captureRisk needle replacement left || captureRisk needle replacement right
  | .new binder body =>
      if binder = needle then false
      else decide (binder = replacement) || captureRisk needle replacement body
  | .matchEq _ _ next => captureRisk needle replacement next
  | .matchNe _ _ next => captureRisk needle replacement next

/--
Raw free-name substitution.  It is exposed only through `substitute`, which
first rejects capture.
-/
def substRaw (process : Proc) (needle replacement : Name) : Proc :=
  match process with
  | .zero => .zero
  | .tau next => .tau (substRaw next needle replacement)
  | .send ch value next =>
      .send
        (substChannel ch needle replacement)
        (if value = needle then replacement else value)
        (substRaw next needle replacement)
  | .recv ch binder next =>
      .recv
        (substChannel ch needle replacement)
        binder
        (if binder = needle then next else substRaw next needle replacement)
  | .choice left right =>
      .choice (substRaw left needle replacement) (substRaw right needle replacement)
  | .par left right =>
      .par (substRaw left needle replacement) (substRaw right needle replacement)
  | .new binder body =>
      .new binder (if binder = needle then body else substRaw body needle replacement)
  | .matchEq left right next =>
      .matchEq
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (substRaw next needle replacement)
  | .matchNe left right next =>
      .matchNe
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (substRaw next needle replacement)

/--
Executable capture-safe substitution.  Rejection is observable as `none`;
there is no implicit α-renaming hidden in the transition relation.
-/
def substitute (process : Proc) (needle replacement : Name) : Option Proc :=
  if captureRisk needle replacement process
  then none
  else some (substRaw process needle replacement)

end Proc

namespace Raw

/-- Untyped π syntax used as the erasure target. -/
inductive Proc where
  | zero
  | tau (next : Proc)
  | send (ch value : Name) (next : Proc)
  | recv (ch binder : Name) (next : Proc)
  | choice (left right : Proc)
  | par (left right : Proc)
  | new (binder : Name) (body : Proc)
  | matchEq (left right : Name) (next : Proc)
  | matchNe (left right : Name) (next : Proc)
  deriving DecidableEq, Repr

namespace Proc

def captureRisk (needle replacement : Name) : Proc → Bool
  | .zero => false
  | .tau next => captureRisk needle replacement next
  | .send _ _ next => captureRisk needle replacement next
  | .recv _ binder next =>
      if binder = needle then false
      else decide (binder = replacement) || captureRisk needle replacement next
  | .choice left right =>
      captureRisk needle replacement left || captureRisk needle replacement right
  | .par left right =>
      captureRisk needle replacement left || captureRisk needle replacement right
  | .new binder body =>
      if binder = needle then false
      else decide (binder = replacement) || captureRisk needle replacement body
  | .matchEq _ _ next => captureRisk needle replacement next
  | .matchNe _ _ next => captureRisk needle replacement next

def substRaw (process : Proc) (needle replacement : Name) : Proc :=
  match process with
  | .zero => .zero
  | .tau next => .tau (substRaw next needle replacement)
  | .send ch value next =>
      .send
        (if ch = needle then replacement else ch)
        (if value = needle then replacement else value)
        (substRaw next needle replacement)
  | .recv ch binder next =>
      .recv
        (if ch = needle then replacement else ch)
        binder
        (if binder = needle then next else substRaw next needle replacement)
  | .choice left right =>
      .choice (substRaw left needle replacement) (substRaw right needle replacement)
  | .par left right =>
      .par (substRaw left needle replacement) (substRaw right needle replacement)
  | .new binder body =>
      .new binder (if binder = needle then body else substRaw body needle replacement)
  | .matchEq left right next =>
      .matchEq
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (substRaw next needle replacement)
  | .matchNe left right next =>
      .matchNe
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (substRaw next needle replacement)

def substitute (process : Proc) (needle replacement : Name) : Option Proc :=
  if captureRisk needle replacement process
  then none
  else some (substRaw process needle replacement)

end Proc

/-- Native labels of the independently defined untyped LTS. -/
inductive Action where
  | tau
  | output (ch value : Name)
  | input (ch binder : Name)
  | boundOutput (ch fresh : Name)
  deriving DecidableEq, Repr

namespace Action

def names : Action → Finset Name
  | .tau => ∅
  | .output ch value => {ch, value}
  | .input ch binder => {ch, binder}
  | .boundOutput ch fresh => {ch, fresh}

end Action

/--
Strong, one-step, late-inspired semantics for the raw reference calculus.  The
`open`/`closeLeft`/`closeRight` constructors expose scope extrusion as a single
τ derivation tree when communication closes a bound output.  General
α-conversion, structural congruence, and bound-name freshness under `par` are
separate obligations.
-/
inductive Step : Proc → Action → Proc → Prop where
  | prefixTau :
      Step (.tau next) .tau next
  | prefixOutput :
      Step (.send ch value next) (.output ch value) next
  | prefixInput :
      Step (.recv ch binder next) (.input ch binder) next
  | matchGuard
      (step : Step body action target) :
      Step (.matchEq name name body) action target
  | mismatchGuard
      (distinct : left ≠ right)
      (step : Step body action target) :
      Step (.matchNe left right body) action target
  | choiceLeft (step : Step left action next) :
      Step (.choice left right) action next
  | choiceRight (step : Step right action next) :
      Step (.choice left right) action next
  | parLeft (step : Step left action next) :
      Step (.par left right) action (.par next right)
  | parRight (step : Step right action next) :
      Step (.par left right) action (.par left next)
  | syncLeft
      (outputStep : Step left (.output ch value) left')
      (inputStep : Step right (.input ch binder) right')
      (substitution : right'.substitute binder value = some right'') :
      Step (.par left right) .tau (.par left' right'')
  | syncRight
      (inputStep : Step left (.input ch binder) left')
      (outputStep : Step right (.output ch value) right')
      (substitution : left'.substitute binder value = some left'') :
      Step (.par left right) .tau (.par left'' right')
  | restrict
      (fresh : binder ∉ action.names)
      (step : Step body action next) :
      Step (.new binder body) action (.new binder next)
  | scopeOpen (distinct : fresh ≠ ch) :
      Step
        (.new fresh (.send ch fresh next))
        (.boundOutput ch fresh)
        next
  | scopeCloseLeft
      (outputStep : Step left (.boundOutput ch fresh) left')
      (inputStep : Step right (.input ch binder) right')
      (substitution : right'.substitute binder fresh = some right'') :
      Step (.par left right) .tau (.new fresh (.par left' right''))
  | scopeCloseRight
      (inputStep : Step left (.input ch binder) left')
      (outputStep : Step right (.boundOutput ch fresh) right')
      (substitution : left'.substitute binder fresh = some left'') :
      Step (.par left right) .tau (.new fresh (.par left'' right'))

end Raw

/-- Erase channel payload annotations from typed processes. -/
def Proc.erase : Proc → Raw.Proc
  | .zero => .zero
  | .tau next => .tau next.erase
  | .send ch value next => .send ch.name value next.erase
  | .recv ch binder next => .recv ch.name binder next.erase
  | .choice left right => .choice left.erase right.erase
  | .par left right => .par left.erase right.erase
  | .new binder body => .new binder body.erase
  | .matchEq left right next => .matchEq left right next.erase
  | .matchNe left right next => .matchNe left right next.erase

/-- Native labels of the typed LTS. -/
inductive Action where
  | tau
  | output (ch : Channel) (value : Name)
  | input (ch : Channel) (binder : Name)
  | boundOutput (ch : Channel) (fresh : Name)
  deriving DecidableEq, Repr

namespace Action

def names : Action → Finset Name
  | .tau => ∅
  | .output ch value => {ch.name, value}
  | .input ch binder => {ch.name, binder}
  | .boundOutput ch fresh => {ch.name, fresh}

def erase : Action → Raw.Action
  | .tau => .tau
  | .output ch value => .output ch.name value
  | .input ch binder => .input ch.name binder
  | .boundOutput ch fresh => .boundOutput ch.name fresh

theorem erase_names (action : Action) :
    action.erase.names = action.names := by
  cases action <;> rfl

end Action

namespace Proc

theorem erase_captureRisk (process : Proc) (needle replacement : Name) :
    process.erase.captureRisk needle replacement =
      process.captureRisk needle replacement := by
  induction process with
  | zero => rfl
  | tau next ih =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk, ih]
  | send ch value next ih =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk, ih]
  | recv ch binder next ih =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk]
      split <;> simp_all
  | choice left right ihLeft ihRight =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk, ihLeft, ihRight]
  | par left right ihLeft ihRight =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk, ihLeft, ihRight]
  | new binder body ih =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk]
      split <;> simp_all
  | matchEq left right next ih =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk, ih]
  | matchNe left right next ih =>
      simp only [erase, Raw.Proc.captureRisk, captureRisk, ih]

theorem erase_substRaw (process : Proc) (needle replacement : Name) :
    (process.substRaw needle replacement).erase =
      process.erase.substRaw needle replacement := by
  induction process with
  | zero => rfl
  | tau next ih =>
      simp only [substRaw, erase, Raw.Proc.substRaw, ih]
  | send ch value next ih =>
      simp only [substRaw, erase, Raw.Proc.substRaw, substChannel, ih]
      split <;> simp_all
  | recv ch binder next ih =>
      simp only [substRaw, erase, Raw.Proc.substRaw, substChannel]
      split <;> split <;> simp_all
  | choice left right ihLeft ihRight =>
      simp only [substRaw, erase, Raw.Proc.substRaw, ihLeft, ihRight]
  | par left right ihLeft ihRight =>
      simp only [substRaw, erase, Raw.Proc.substRaw, ihLeft, ihRight]
  | new binder body ih =>
      simp only [substRaw, erase, Raw.Proc.substRaw]
      split <;> simp_all
  | matchEq left right next ih =>
      simp only [substRaw, erase, Raw.Proc.substRaw, ih]
  | matchNe left right next ih =>
      simp only [substRaw, erase, Raw.Proc.substRaw, ih]

/-- Erasure commutes with the executable capture-safe substitution. -/
theorem erase_substitute (process : Proc) (needle replacement : Name) :
    process.erase.substitute needle replacement =
      (process.substitute needle replacement).map Proc.erase := by
  simp only [substitute, Raw.Proc.substitute, erase_captureRisk]
  split <;> simp_all [erase_substRaw]

end Proc

/--
The typed strong one-step semantics.  Synchronisation requires equal channel
annotations, so mismatched payload sorts cannot communicate.
-/
inductive Step : Proc → Action → Proc → Prop where
  | prefixTau :
      Step (.tau next) .tau next
  | prefixOutput :
      Step (.send ch value next) (.output ch value) next
  | prefixInput :
      Step (.recv ch binder next) (.input ch binder) next
  | matchGuard
      (step : Step body action target) :
      Step (.matchEq name name body) action target
  | mismatchGuard
      (distinct : left ≠ right)
      (step : Step body action target) :
      Step (.matchNe left right body) action target
  | choiceLeft (step : Step left action next) :
      Step (.choice left right) action next
  | choiceRight (step : Step right action next) :
      Step (.choice left right) action next
  | parLeft (step : Step left action next) :
      Step (.par left right) action (.par next right)
  | parRight (step : Step right action next) :
      Step (.par left right) action (.par left next)
  | syncLeft
      (outputStep : Step left (.output ch value) left')
      (inputStep : Step right (.input ch binder) right')
      (substitution : right'.substitute binder value = some right'') :
      Step (.par left right) .tau (.par left' right'')
  | syncRight
      (inputStep : Step left (.input ch binder) left')
      (outputStep : Step right (.output ch value) right')
      (substitution : left'.substitute binder value = some left'') :
      Step (.par left right) .tau (.par left'' right')
  | restrict
      (fresh : binder ∉ action.names)
      (step : Step body action next) :
      Step (.new binder body) action (.new binder next)
  | scopeOpen (distinct : fresh ≠ ch.name) :
      Step
        (.new fresh (.send ch fresh next))
        (.boundOutput ch fresh)
        next
  | scopeCloseLeft
      (outputStep : Step left (.boundOutput ch fresh) left')
      (inputStep : Step right (.input ch binder) right')
      (substitution : right'.substitute binder fresh = some right'') :
      Step (.par left right) .tau (.new fresh (.par left' right''))
  | scopeCloseRight
      (inputStep : Step left (.input ch binder) left')
      (outputStep : Step right (.boundOutput ch fresh) right')
      (substitution : left'.substitute binder fresh = some left'') :
      Step (.par left right) .tau (.new fresh (.par left'' right'))

namespace Step

/--
Every typed transition erases to one independently defined raw transition with
the same one-step granularity.  No weak closure or generated image relation is
used.
-/
theorem erase_preserves {process next : Proc} {action : Action}
    (step : Step process action next) :
    Raw.Step process.erase action.erase next.erase := by
  induction step with
  | prefixTau =>
      exact Raw.Step.prefixTau
  | prefixOutput =>
      exact Raw.Step.prefixOutput
  | prefixInput =>
      exact Raw.Step.prefixInput
  | matchGuard _ ih =>
      exact Raw.Step.matchGuard ih
  | mismatchGuard distinct _ ih =>
      exact Raw.Step.mismatchGuard distinct ih
  | choiceLeft _ ih =>
      exact Raw.Step.choiceLeft ih
  | choiceRight _ ih =>
      exact Raw.Step.choiceRight ih
  | parLeft _ ih =>
      exact Raw.Step.parLeft ih
  | parRight _ ih =>
      exact Raw.Step.parRight ih
  | syncLeft outputStep inputStep substitution ihOutput ihInput =>
      apply Raw.Step.syncLeft ihOutput ihInput
      rw [Proc.erase_substitute]
      simp [substitution]
  | syncRight inputStep outputStep substitution ihInput ihOutput =>
      apply Raw.Step.syncRight ihInput ihOutput
      rw [Proc.erase_substitute]
      simp [substitution]
  | restrict fresh step ih =>
      apply Raw.Step.restrict
      · simpa [Action.erase_names] using fresh
      · exact ih
  | scopeOpen distinct =>
      apply Raw.Step.scopeOpen
      simpa using distinct
  | scopeCloseLeft outputStep inputStep substitution ihOutput ihInput =>
      apply Raw.Step.scopeCloseLeft ihOutput ihInput
      rw [Proc.erase_substitute]
      simp [substitution]
  | scopeCloseRight inputStep outputStep substitution ihInput ihOutput =>
      apply Raw.Step.scopeCloseRight ihInput ihOutput
      rw [Proc.erase_substitute]
      simp [substitution]

end Step

/--
Stable central declaration for the operational erasure obligation.  Every
typed native step is mapped to exactly one independently defined raw native
step; there is no reflexive-transitive closure in the conclusion.
-/
theorem typed_pi_erasure_operational
    {process next : Proc} {action : Action}
    (step : Step process action next) :
    Raw.Step process.erase action.erase next.erase :=
  Step.erase_preserves step

/--
A typed transition packages the annotated transition with source and target
typing derivations.  Keeping this wrapper separate leaves the native LTS
independent of a particular global environment.
-/
def TypedStep (Γ : TypeEnv) (process : Proc) (action : Action) (next : Proc) : Prop :=
  process.WellTyped Γ ∧ Step process action next ∧ next.WellTyped Γ

/-- A process has at least one kernel transition, visible or internal. -/
def HasTransition (process : Proc) : Prop :=
  ∃ action next, Step process action next

/--
Syntactic kernel deadlock is distinct from literal `zero` and means absence of
every kernel transition, including an externally offered input.  This is not
yet a deadlock predicate modulo structural congruence.
-/
def Deadlocked (process : Proc) : Prop :=
  process ≠ .zero ∧ ¬HasTransition process

/-- Syntactic recognition of an externally open input wait. -/
def OpenWait (process : Proc) : Prop :=
  ∃ ch binder next, process = .recv ch binder next

/-- Every input prefix has a visible kernel transition. -/
theorem recv_has_transition (ch : Channel) (binder : Name) (next : Proc) :
    HasTransition (.recv ch binder next) :=
  ⟨.input ch binder, next, Step.prefixInput⟩

/-- An open input wait is not a deadlock. -/
theorem open_wait_not_deadlocked {process : Proc} (waiting : OpenWait process) :
    ¬Deadlocked process := by
  rintro ⟨_, noStep⟩
  rcases waiting with ⟨ch, binder, next, rfl⟩
  exact noStep (recv_has_transition ch binder next)

end Cantilune.Pi
