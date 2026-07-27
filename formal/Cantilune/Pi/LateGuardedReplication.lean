import Cantilune.Pi.Late

/-!
# Conservative guarded-replication extension of the native late pi kernel

`Raw.Proc` intentionally remains finite control because many existing
termination and inversion theorems recurse over that exact syntax.  This
module adds a separate syntax instead of silently invalidating those results.

Replication is guarded by construction.  There is no constructor for `!P`;
the only replicated terms are `!tau.P`, `!c<v>.P`, and `!c(x).P`.  Their
native rules consume the displayed prefix and leave a copy of the guarded
server behind.  Ordinary prefix, context, communication, restriction, open,
and close rules are stated directly over the extended syntax.

The `embedded` rule is conservative: it requires an existing
`Late.NativeStep` proof and merely transports that exact finite-control step
through `RecursiveProc.ofRaw`.  It does not manufacture a transition or a
weak closure.

This is an operational syntax extension only.  It does not construct an
Open-pi SMC identity, an observational quotient, or a full-abstraction model.
-/

namespace Cantilune.Pi

/--
Finite syntax with three explicitly guarded replication forms.

The ordinary constructors allow a replicated continuation to occur beneath
later prefixes and contexts; hence this is not merely a wrapper around
`Raw.Proc`.
-/
inductive RecursiveProc where
  | zero
  | tau (next : RecursiveProc)
  | send (channel value : Name) (next : RecursiveProc)
  | recv (channel binder : Name) (next : RecursiveProc)
  | choice (left right : RecursiveProc)
  | par (left right : RecursiveProc)
  | new (binder : Name) (body : RecursiveProc)
  | matchEq (left right : Name) (next : RecursiveProc)
  | matchNe (left right : Name) (next : RecursiveProc)
  | repTau (body : RecursiveProc)
  | repSend (channel value : Name) (body : RecursiveProc)
  | repRecv (channel binder : Name) (body : RecursiveProc)
  deriving DecidableEq, Repr

namespace RecursiveProc

/-! ## Nominal support -/

/-- Names occurring free in an extended process. -/
def freeNames : RecursiveProc → Finset Name
  | .zero => ∅
  | .tau next => next.freeNames
  | .send channel value next =>
      insert channel (insert value next.freeNames)
  | .recv channel binder next =>
      insert channel (next.freeNames.erase binder)
  | .choice left right => left.freeNames ∪ right.freeNames
  | .par left right => left.freeNames ∪ right.freeNames
  | .new binder body => body.freeNames.erase binder
  | .matchEq left right next =>
      insert left (insert right next.freeNames)
  | .matchNe left right next =>
      insert left (insert right next.freeNames)
  | .repTau body => body.freeNames
  | .repSend channel value body =>
      insert channel (insert value body.freeNames)
  | .repRecv channel binder body =>
      insert channel (body.freeNames.erase binder)

/-- All syntactically occurring names, including binder declarations. -/
def allNames : RecursiveProc → Finset Name
  | .zero => ∅
  | .tau next => next.allNames
  | .send channel value next =>
      insert channel (insert value next.allNames)
  | .recv channel binder next =>
      insert channel (insert binder next.allNames)
  | .choice left right => left.allNames ∪ right.allNames
  | .par left right => left.allNames ∪ right.allNames
  | .new binder body => insert binder body.allNames
  | .matchEq left right next =>
      insert left (insert right next.allNames)
  | .matchNe left right next =>
      insert left (insert right next.allNames)
  | .repTau body => body.allNames
  | .repSend channel value body =>
      insert channel (insert value body.allNames)
  | .repRecv channel binder body =>
      insert channel (insert binder body.allNames)

/-- Public nominal support is the finite set of free names. -/
abbrev support (process : RecursiveProc) : Finset Name :=
  process.freeNames

theorem freeNames_subset_allNames (process : RecursiveProc) :
    process.freeNames ⊆ process.allNames := by
  induction process <;>
    simp_all [freeNames, allNames, Finset.subset_iff] <;>
    aesop

/-! ## Conservative embedding of the existing finite-control syntax -/

/-- Structural inclusion of every existing raw finite-control process. -/
def ofRaw : Raw.Proc → RecursiveProc
  | .zero => .zero
  | .tau next => .tau (ofRaw next)
  | .send channel value next =>
      .send channel value (ofRaw next)
  | .recv channel binder next =>
      .recv channel binder (ofRaw next)
  | .choice left right => .choice (ofRaw left) (ofRaw right)
  | .par left right => .par (ofRaw left) (ofRaw right)
  | .new binder body => .new binder (ofRaw body)
  | .matchEq left right next => .matchEq left right (ofRaw next)
  | .matchNe left right next => .matchNe left right (ofRaw next)

@[simp]
theorem freeNames_ofRaw (process : Raw.Proc) :
    (ofRaw process).freeNames = process.freeNames := by
  induction process <;>
    simp_all [ofRaw, freeNames, Raw.Proc.freeNames]

@[simp]
theorem allNames_ofRaw (process : Raw.Proc) :
    (ofRaw process).allNames = process.allNames := by
  induction process <;>
    simp_all [ofRaw, allNames, Raw.Proc.allNames]

/-! ## Capture-aware renaming and substitution -/

/--
Detect whether direct free substitution would cross a binder for the
replacement.  Replicated input binds its parameter exactly like ordinary
input.
-/
def captureRisk (needle replacement : Name) : RecursiveProc → Bool
  | .zero => false
  | .tau next => next.captureRisk needle replacement
  | .send _ _ next => next.captureRisk needle replacement
  | .recv _ binder next =>
      if binder = needle then false
      else decide (binder = replacement) ||
        next.captureRisk needle replacement
  | .choice left right =>
      left.captureRisk needle replacement ||
        right.captureRisk needle replacement
  | .par left right =>
      left.captureRisk needle replacement ||
        right.captureRisk needle replacement
  | .new binder body =>
      if binder = needle then false
      else decide (binder = replacement) ||
        body.captureRisk needle replacement
  | .matchEq _ _ next => next.captureRisk needle replacement
  | .matchNe _ _ next => next.captureRisk needle replacement
  | .repTau body => body.captureRisk needle replacement
  | .repSend _ _ body => body.captureRisk needle replacement
  | .repRecv _ binder body =>
      if binder = needle then false
      else decide (binder = replacement) ||
        body.captureRisk needle replacement

/--
Direct free-name substitution.  This is used for bound renaming when the
replacement is already known fresh; callers needing arbitrary replacement use
`substituteCaptureAvoiding`.
-/
def substRaw (process : RecursiveProc)
    (needle replacement : Name) : RecursiveProc :=
  match process with
  | .zero => .zero
  | .tau next => .tau (next.substRaw needle replacement)
  | .send channel value next =>
      .send
        (if channel = needle then replacement else channel)
        (if value = needle then replacement else value)
        (next.substRaw needle replacement)
  | .recv channel binder next =>
      .recv
        (if channel = needle then replacement else channel)
        binder
        (if binder = needle then next
         else next.substRaw needle replacement)
  | .choice left right =>
      .choice
        (left.substRaw needle replacement)
        (right.substRaw needle replacement)
  | .par left right =>
      .par
        (left.substRaw needle replacement)
        (right.substRaw needle replacement)
  | .new binder body =>
      .new binder
        (if binder = needle then body
         else body.substRaw needle replacement)
  | .matchEq left right next =>
      .matchEq
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (next.substRaw needle replacement)
  | .matchNe left right next =>
      .matchNe
        (if left = needle then replacement else left)
        (if right = needle then replacement else right)
        (next.substRaw needle replacement)
  | .repTau body =>
      .repTau (body.substRaw needle replacement)
  | .repSend channel value body =>
      .repSend
        (if channel = needle then replacement else channel)
        (if value = needle then replacement else value)
        (body.substRaw needle replacement)
  | .repRecv channel binder body =>
      .repRecv
        (if channel = needle then replacement else channel)
        binder
        (if binder = needle then body
         else body.substRaw needle replacement)

/-- Executable substitution that reports a capture risk instead of renaming. -/
def substitute (process : RecursiveProc)
    (needle replacement : Name) : Option RecursiveProc :=
  if process.captureRisk needle replacement
  then none
  else some (process.substRaw needle replacement)

/-- Finite set avoided by deterministic alpha-freshening. -/
def avoidance (process : RecursiveProc)
    (needle replacement : Name) : Finset Name :=
  process.allNames ∪ {needle, replacement}

/-- A deterministic name outside the complete finite syntax support. -/
def freshName (process : RecursiveProc)
    (needle replacement : Name) : Name :=
  (process.avoidance needle replacement).sup id + 1

theorem freshName_not_mem_avoidance
    (process : RecursiveProc) (needle replacement : Name) :
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
    (process : RecursiveProc) (needle replacement : Name) :
    process.freshName needle replacement ∉ process.allNames := by
  intro member
  exact process.freshName_not_mem_avoidance needle replacement
    (Finset.mem_union_left _ member)

theorem freshName_ne_needle
    (process : RecursiveProc) (needle replacement : Name) :
    process.freshName needle replacement ≠ needle := by
  intro equality
  apply process.freshName_not_mem_avoidance needle replacement
  rw [equality]
  simp [avoidance]

theorem freshName_ne_replacement
    (process : RecursiveProc) (needle replacement : Name) :
    process.freshName needle replacement ≠ replacement := by
  intro equality
  apply process.freshName_not_mem_avoidance needle replacement
  rw [equality]
  simp [avoidance]

/-- Rename occurrences controlled by one immediately enclosing binder. -/
def renameBound (body : RecursiveProc)
    (binder replacement : Name) : RecursiveProc :=
  body.substRaw binder replacement

/-- Structural depth used as sufficient substitution fuel. -/
def syntaxDepth : RecursiveProc → Nat
  | .zero => 1
  | .tau next => next.syntaxDepth + 1
  | .send _ _ next => next.syntaxDepth + 1
  | .recv _ _ next => next.syntaxDepth + 1
  | .choice left right => max left.syntaxDepth right.syntaxDepth + 1
  | .par left right => max left.syntaxDepth right.syntaxDepth + 1
  | .new _ body => body.syntaxDepth + 1
  | .matchEq _ _ next => next.syntaxDepth + 1
  | .matchNe _ _ next => next.syntaxDepth + 1
  | .repTau body => body.syntaxDepth + 1
  | .repSend _ _ body => body.syntaxDepth + 1
  | .repRecv _ _ body => body.syntaxDepth + 1

/--
Fuelled total capture-avoiding substitution, including replicated input
binders.  A conflicting binder is renamed before descent.
-/
def substituteCaptureAvoidingAux :
    Nat → RecursiveProc → Name → Name → RecursiveProc
  | 0, process, _, _ => process
  | _ + 1, .zero, _, _ => .zero
  | fuel + 1, .tau next, needle, replacement =>
      .tau (substituteCaptureAvoidingAux fuel next needle replacement)
  | fuel + 1, .send channel value next, needle, replacement =>
      .send
        (if channel = needle then replacement else channel)
        (if value = needle then replacement else value)
        (substituteCaptureAvoidingAux fuel next needle replacement)
  | fuel + 1, .recv channel binder next, needle, replacement =>
      let channel' := if channel = needle then replacement else channel
      if binder = needle then
        .recv channel' binder next
      else if binder = replacement then
        let fresh := next.freshName needle replacement
        let renamed := next.renameBound binder fresh
        .recv channel' fresh
          (substituteCaptureAvoidingAux fuel renamed needle replacement)
      else
        .recv channel' binder
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
  | fuel + 1, .repTau body, needle, replacement =>
      .repTau
        (substituteCaptureAvoidingAux fuel body needle replacement)
  | fuel + 1, .repSend channel value body, needle, replacement =>
      .repSend
        (if channel = needle then replacement else channel)
        (if value = needle then replacement else value)
        (substituteCaptureAvoidingAux fuel body needle replacement)
  | fuel + 1, .repRecv channel binder body, needle, replacement =>
      let channel' := if channel = needle then replacement else channel
      if binder = needle then
        .repRecv channel' binder body
      else if binder = replacement then
        let fresh := body.freshName needle replacement
        let renamed := body.renameBound binder fresh
        .repRecv channel' fresh
          (substituteCaptureAvoidingAux fuel renamed needle replacement)
      else
        .repRecv channel' binder
          (substituteCaptureAvoidingAux fuel body needle replacement)

/-- Total deterministic capture-avoiding substitution. -/
def substituteCaptureAvoiding (process : RecursiveProc)
    (needle replacement : Name) : RecursiveProc :=
  if process.captureRisk needle replacement then
    substituteCaptureAvoidingAux
      process.syntaxDepth process needle replacement
  else
    process.substRaw needle replacement

/-- Capture-avoiding free-name renaming. -/
def renameFree (process : RecursiveProc)
    (source target : Name) : RecursiveProc :=
  process.substituteCaptureAvoiding source target

theorem substituteCaptureAvoiding_eq_substRaw
    (process : RecursiveProc) (needle replacement : Name)
    (safe : process.captureRisk needle replacement = false) :
    process.substituteCaptureAvoiding needle replacement =
      process.substRaw needle replacement := by
  simp [substituteCaptureAvoiding, safe]

theorem substitute_some_of_no_capture
    (process : RecursiveProc) (needle replacement : Name)
    (safe : process.captureRisk needle replacement = false) :
    process.substitute needle replacement =
      some (process.substituteCaptureAvoiding needle replacement) := by
  simp [substitute, substituteCaptureAvoiding, safe]

@[simp]
theorem captureRisk_ofRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (ofRaw process).captureRisk needle replacement =
      process.captureRisk needle replacement := by
  induction process <;>
    simp_all [ofRaw, captureRisk, Raw.Proc.captureRisk]

@[simp]
theorem substRaw_ofRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (ofRaw process).substRaw needle replacement =
      ofRaw (process.substRaw needle replacement) := by
  induction process <;>
    simp_all [ofRaw, substRaw, Raw.Proc.substRaw]
  all_goals
    split <;>
      simp_all

@[simp]
theorem avoidance_ofRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (ofRaw process).avoidance needle replacement =
      process.avoidance needle replacement := by
  simp [avoidance, Raw.Proc.avoidance]

@[simp]
theorem freshName_ofRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (ofRaw process).freshName needle replacement =
      process.freshName needle replacement := by
  simp [freshName, Raw.Proc.freshName]

@[simp]
theorem renameBound_ofRaw
    (process : Raw.Proc) (binder replacement : Name) :
    (ofRaw process).renameBound binder replacement =
      ofRaw (process.renameBound binder replacement) := by
  simp [renameBound, Raw.Proc.renameBound]

@[simp]
theorem syntaxDepth_ofRaw (process : Raw.Proc) :
    (ofRaw process).syntaxDepth = process.syntaxDepth := by
  induction process <;>
    simp_all [ofRaw, syntaxDepth, Raw.Proc.syntaxDepth]

theorem substituteCaptureAvoidingAux_ofRaw
    (fuel : Nat) (process : Raw.Proc)
    (needle replacement : Name) :
    substituteCaptureAvoidingAux fuel
        (ofRaw process) needle replacement =
      ofRaw
        (Raw.Proc.substituteCaptureAvoidingAux
          fuel process needle replacement) := by
  induction fuel generalizing process with
  | zero =>
      simp [substituteCaptureAvoidingAux,
        Raw.Proc.substituteCaptureAvoidingAux]
  | succ fuel inductionHypothesis =>
      cases process with
      | zero =>
          rfl
      | tau next =>
          simp [ofRaw, substituteCaptureAvoidingAux,
            Raw.Proc.substituteCaptureAvoidingAux,
            inductionHypothesis]
      | send channel value next =>
          simp [ofRaw, substituteCaptureAvoidingAux,
            Raw.Proc.substituteCaptureAvoidingAux,
            inductionHypothesis]
      | recv channel binder next =>
          by_cases stops : binder = needle
          · simp [ofRaw, substituteCaptureAvoidingAux,
              Raw.Proc.substituteCaptureAvoidingAux, stops]
          · by_cases conflicts : binder = replacement
            · have replacement_ne_needle : replacement ≠ needle := by
                intro equality
                exact stops (conflicts.trans equality)
              simp [ofRaw, substituteCaptureAvoidingAux,
                Raw.Proc.substituteCaptureAvoidingAux,
                conflicts, replacement_ne_needle,
                inductionHypothesis]
            · simp [ofRaw, substituteCaptureAvoidingAux,
                Raw.Proc.substituteCaptureAvoidingAux,
                stops, conflicts, inductionHypothesis]
      | choice left right =>
          simp [ofRaw, substituteCaptureAvoidingAux,
            Raw.Proc.substituteCaptureAvoidingAux,
            inductionHypothesis]
      | par left right =>
          simp [ofRaw, substituteCaptureAvoidingAux,
            Raw.Proc.substituteCaptureAvoidingAux,
            inductionHypothesis]
      | new binder body =>
          by_cases stops : binder = needle
          · simp [ofRaw, substituteCaptureAvoidingAux,
              Raw.Proc.substituteCaptureAvoidingAux, stops]
          · by_cases conflicts : binder = replacement
            · have replacement_ne_needle : replacement ≠ needle := by
                intro equality
                exact stops (conflicts.trans equality)
              simp [ofRaw, substituteCaptureAvoidingAux,
                Raw.Proc.substituteCaptureAvoidingAux,
                conflicts, replacement_ne_needle,
                inductionHypothesis]
            · simp [ofRaw, substituteCaptureAvoidingAux,
                Raw.Proc.substituteCaptureAvoidingAux,
                stops, conflicts, inductionHypothesis]
      | matchEq left right next =>
          simp [ofRaw, substituteCaptureAvoidingAux,
            Raw.Proc.substituteCaptureAvoidingAux,
            inductionHypothesis]
      | matchNe left right next =>
          simp [ofRaw, substituteCaptureAvoidingAux,
            Raw.Proc.substituteCaptureAvoidingAux,
            inductionHypothesis]

@[simp]
theorem substituteCaptureAvoiding_ofRaw
    (process : Raw.Proc) (needle replacement : Name) :
    (ofRaw process).substituteCaptureAvoiding needle replacement =
      ofRaw
        (process.substituteCaptureAvoiding needle replacement) := by
  by_cases risk :
      process.captureRisk needle replacement = true
  · simp [substituteCaptureAvoiding,
      Raw.Proc.substituteCaptureAvoiding,
      substituteCaptureAvoidingAux_ofRaw, risk]
  · have riskFalse :
        process.captureRisk needle replacement = false :=
      Bool.eq_false_of_not_eq_true risk
    simp [substituteCaptureAvoiding,
      Raw.Proc.substituteCaptureAvoiding,
      riskFalse]

/-! ## One-step guarded unfolding -/

/--
Expose one copy of a guarded replicated prefix.  Non-replicated processes are
left unchanged.
-/
def unfold : RecursiveProc → RecursiveProc
  | .repTau body =>
      .par (.tau body) (.repTau body)
  | .repSend channel value body =>
      .par (.send channel value body) (.repSend channel value body)
  | .repRecv channel binder body =>
      .par (.recv channel binder body) (.repRecv channel binder body)
  | process => process

@[simp]
theorem unfold_repTau (body : RecursiveProc) :
    (RecursiveProc.repTau body).unfold =
      .par (.tau body) (.repTau body) :=
  rfl

@[simp]
theorem unfold_repSend
    (channel value : Name) (body : RecursiveProc) :
    (RecursiveProc.repSend channel value body).unfold =
      .par (.send channel value body)
        (.repSend channel value body) :=
  rfl

@[simp]
theorem unfold_repRecv
    (channel binder : Name) (body : RecursiveProc) :
    (RecursiveProc.repRecv channel binder body).unfold =
      .par (.recv channel binder body)
        (.repRecv channel binder body) :=
  rfl

end RecursiveProc

namespace RecursiveLate

open RecursiveProc

/-! ## Strong native late semantics -/

/--
Strong late transitions for the guarded-replication syntax.

`embedded` transports only a previously established finite-control native
transition.  The three `replicated*` constructors are the only source of
unbounded operational reuse.
-/
inductive NativeStep :
    RecursiveProc → Raw.Action → RecursiveProc → Prop
  | embedded
      (step : Late.NativeStep source action target) :
      NativeStep
        (RecursiveProc.ofRaw source) action
        (RecursiveProc.ofRaw target)
  | prefixTau :
      NativeStep (.tau next) .tau next
  | prefixOutput :
      NativeStep (.send channel value next)
        (.output channel value) next
  | prefixInput :
      NativeStep (.recv channel binder next)
        (.input channel binder) next
  | matchGuard
      (step : NativeStep body action target) :
      NativeStep (.matchEq name name body) action target
  | mismatchGuard
      (distinct : left ≠ right)
      (step : NativeStep body action target) :
      NativeStep (.matchNe left right body) action target
  | choiceLeft
      (step : NativeStep left action next) :
      NativeStep (.choice left right) action next
  | choiceRight
      (step : NativeStep right action next) :
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
      (outputStep :
        NativeStep left (.output channel value) left')
      (inputStep :
        NativeStep right (.input channel binder) right')
      (fresh : binder ∉ left'.freeNames) :
      NativeStep (.par left right) .tau
        (.par left'
          (right'.substituteCaptureAvoiding binder value))
  | syncRight
      (inputStep :
        NativeStep left (.input channel binder) left')
      (outputStep :
        NativeStep right (.output channel value) right')
      (fresh : binder ∉ right'.freeNames) :
      NativeStep (.par left right) .tau
        (.par
          (left'.substituteCaptureAvoiding binder value)
          right')
  | restrict
      (fresh : binder ∉ action.names)
      (step : NativeStep body action next) :
      NativeStep (.new binder body) action (.new binder next)
  | open
      (distinct : fresh ≠ channel)
      (step :
        NativeStep body (.output channel fresh) next) :
      NativeStep (.new fresh body)
        (.boundOutput channel fresh) next
  | closeLeft
      (outputStep :
        NativeStep left
          (.boundOutput channel fresh) left')
      (inputStep :
        NativeStep right (.input channel binder) right')
      (freshForReceiver : fresh ∉ right.freeNames)
      (binderFresh : binder ∉ left'.freeNames) :
      NativeStep (.par left right) .tau
        (.new fresh
          (.par left'
            (right'.substituteCaptureAvoiding binder fresh)))
  | closeRight
      (inputStep :
        NativeStep left (.input channel binder) left')
      (outputStep :
        NativeStep right
          (.boundOutput channel fresh) right')
      (freshForReceiver : fresh ∉ left.freeNames)
      (binderFresh : binder ∉ right'.freeNames) :
      NativeStep (.par left right) .tau
        (.new fresh
          (.par
            (left'.substituteCaptureAvoiding binder fresh)
            right'))
  | replicatedTau :
      NativeStep (.repTau body) .tau
        (.par body (.repTau body))
  | replicatedOutput :
      NativeStep (.repSend channel value body)
        (.output channel value)
        (.par body (.repSend channel value body))
  | replicatedInput :
      NativeStep (.repRecv channel binder body)
        (.input channel binder)
        (.par body (.repRecv channel binder body))

/-- Every old native step remains exactly one native step after inclusion. -/
theorem ofRaw_native
    (step : Late.NativeStep source action target) :
    NativeStep
      (RecursiveProc.ofRaw source) action
      (RecursiveProc.ofRaw target) :=
  NativeStep.embedded step

/-! ## Operational relation between unfolding and replication -/

theorem unfold_repTau_native (body : RecursiveProc) :
    NativeStep
      (RecursiveProc.repTau body).unfold
      .tau
      (.par body (.repTau body)) := by
  apply NativeStep.parLeft
  · simp [Raw.Action.boundNames]
  · exact NativeStep.prefixTau

theorem unfold_repSend_native
    (channel value : Name) (body : RecursiveProc) :
    NativeStep
      (RecursiveProc.repSend channel value body).unfold
      (.output channel value)
      (.par body (.repSend channel value body)) := by
  apply NativeStep.parLeft
  · simp [Raw.Action.boundNames]
  · exact NativeStep.prefixOutput

theorem unfold_repRecv_native
    (channel binder : Name) (body : RecursiveProc)
    (fresh :
      binder ∉
        (RecursiveProc.repRecv channel binder body).freeNames) :
    NativeStep
      (RecursiveProc.repRecv channel binder body).unfold
      (.input channel binder)
      (.par body (.repRecv channel binder body)) := by
  apply NativeStep.parLeft
  · simpa [Raw.Action.boundNames, Finset.disjoint_left] using fresh
  · exact NativeStep.prefixInput

/-! ## Explicit unbounded behavior witness -/

/-- Repeated tau continuations accumulated to the left of one persistent server. -/
def replicatedTauState
    (body : RecursiveProc) : Nat → RecursiveProc
  | 0 => .repTau body
  | index + 1 => .par body (replicatedTauState body index)

theorem replicatedTauState_step
    (body : RecursiveProc) (index : Nat) :
    NativeStep
      (replicatedTauState body index)
      .tau
      (replicatedTauState body (index + 1)) := by
  induction index with
  | zero =>
      simpa [replicatedTauState] using
        (NativeStep.replicatedTau (body := body))
  | succ index inductionHypothesis =>
      change
        NativeStep
          (.par body (replicatedTauState body index))
          .tau
          (.par body
            (replicatedTauState body (index + 1)))
      apply NativeStep.parRight
      · simp [Raw.Action.boundNames]
      · exact inductionHypothesis

/-- A finite trace of exactly the indicated number of native transitions. -/
inductive NativeTrace :
    Nat → RecursiveProc → RecursiveProc → Prop
  | nil (process : RecursiveProc) :
      NativeTrace 0 process process
  | snoc
      (history : NativeTrace length source middle)
      (last : NativeStep middle action target) :
      NativeTrace (length + 1) source target

theorem replicatedTau_trace
    (body : RecursiveProc) (length : Nat) :
    NativeTrace length
      (.repTau body)
      (replicatedTauState body length) := by
  induction length with
  | zero =>
      exact NativeTrace.nil _
  | succ length inductionHypothesis =>
      exact
        NativeTrace.snoc inductionHypothesis
          (replicatedTauState_step body length)

/-- Minimal execution-budget predicate used to expose genuine reuse. -/
def HasArbitrarilyLongNativeRuns
    (process : RecursiveProc) : Prop :=
  ∀ requested,
    ∃ length target,
      requested ≤ length ∧
      NativeTrace length process target

/--
Unlike any fixed `Raw.Proc`, an explicitly replicated guarded tau prefix has
native runs of every finite length.
-/
theorem replicatedTau_hasArbitrarilyLongNativeRuns
    (body : RecursiveProc) :
    HasArbitrarilyLongNativeRuns (.repTau body) := by
  intro requested
  exact
    ⟨requested, replicatedTauState body requested,
      le_rfl, replicatedTau_trace body requested⟩

end RecursiveLate

end Cantilune.Pi
