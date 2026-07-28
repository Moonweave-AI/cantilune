import Cantilune.Pi.FMSGuardedHoareTrace

/-!
# Contextual completion of the guarded D1-A Hoare observation

Plain trace equivalence need not by itself be a congruence for every
pi-calculus constructor.  This module therefore performs the standard
contextual completion explicitly.  Contexts cover every constructor of the
guarded-recursive syntax, including parallel, restriction, and the three
guarded replication forms.

The denotation of a process is the function which maps each one-hole context
to the concrete lower omega-Scott trace computation of the filled process.
Equality in this context-indexed trace function space is fully abstract for
the contextual native finite-trace observation defined below.  This is a
by-construction contextual completion: it is not the recursively solved FMS
`Agent` object and it does not establish the source-paper Agent-observation
full-abstraction theorem.  Context composition proves congruence without
assuming that plain trace equality is compositional.

This is the maximal D1-A/Hoare observation selected after the finite strong
full-abstraction no-go.  It is not advertised as the separated source FMS
strong-bisimulation theorem.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSGuardedContextualHoare

open Cantilune.Pi
open Cantilune.Pi.FMSGuardedHoareTrace

/-- One-hole contexts for every guarded-recursive process constructor. -/
inductive Context where
  | hole
  | tau (next : Context)
  | send (channel value : Name) (next : Context)
  | recv (channel binder : Name) (next : Context)
  | choiceLeft (left : Context) (right : RecursiveProc)
  | choiceRight (left : RecursiveProc) (right : Context)
  | parLeft (left : Context) (right : RecursiveProc)
  | parRight (left : RecursiveProc) (right : Context)
  | new (binder : Name) (body : Context)
  | matchEq (left right : Name) (next : Context)
  | matchNe (left right : Name) (next : Context)
  | repTau (body : Context)
  | repSend (channel value : Name) (body : Context)
  | repRecv (channel binder : Name) (body : Context)

/-- Fill the unique hole of a guarded-recursive context. -/
def Context.fill : Context → RecursiveProc → RecursiveProc
  | .hole, process => process
  | .tau next, process => .tau (next.fill process)
  | .send channel value next, process =>
      .send channel value (next.fill process)
  | .recv channel binder next, process =>
      .recv channel binder (next.fill process)
  | .choiceLeft left right, process =>
      .choice (left.fill process) right
  | .choiceRight left right, process =>
      .choice left (right.fill process)
  | .parLeft left right, process =>
      .par (left.fill process) right
  | .parRight left right, process =>
      .par left (right.fill process)
  | .new binder body, process =>
      .new binder (body.fill process)
  | .matchEq left right next, process =>
      .matchEq left right (next.fill process)
  | .matchNe left right next, process =>
      .matchNe left right (next.fill process)
  | .repTau body, process =>
      .repTau (body.fill process)
  | .repSend channel value body, process =>
      .repSend channel value (body.fill process)
  | .repRecv channel binder body, process =>
      .repRecv channel binder (body.fill process)

@[simp]
theorem Context.fill_hole (process : RecursiveProc) :
    Context.hole.fill process = process :=
  rfl

/-- Substitute an inner one-hole context into an outer one. -/
def Context.comp : Context → Context → Context
  | .hole, inner => inner
  | .tau next, inner => .tau (next.comp inner)
  | .send channel value next, inner =>
      .send channel value (next.comp inner)
  | .recv channel binder next, inner =>
      .recv channel binder (next.comp inner)
  | .choiceLeft left right, inner =>
      .choiceLeft (left.comp inner) right
  | .choiceRight left right, inner =>
      .choiceRight left (right.comp inner)
  | .parLeft left right, inner =>
      .parLeft (left.comp inner) right
  | .parRight left right, inner =>
      .parRight left (right.comp inner)
  | .new binder body, inner =>
      .new binder (body.comp inner)
  | .matchEq left right next, inner =>
      .matchEq left right (next.comp inner)
  | .matchNe left right next, inner =>
      .matchNe left right (next.comp inner)
  | .repTau body, inner =>
      .repTau (body.comp inner)
  | .repSend channel value body, inner =>
      .repSend channel value (body.comp inner)
  | .repRecv channel binder body, inner =>
      .repRecv channel binder (body.comp inner)

/-- Filling composed contexts is literal substitution composition. -/
theorem Context.fill_comp
    (outer inner : Context)
    (process : RecursiveProc) :
    (outer.comp inner).fill process =
      outer.fill (inner.fill process) := by
  induction outer with
  | hole => rfl
  | tau next induction =>
      simp [Context.comp, Context.fill, induction]
  | send channel value next induction =>
      simp [Context.comp, Context.fill, induction]
  | recv channel binder next induction =>
      simp [Context.comp, Context.fill, induction]
  | choiceLeft left right induction =>
      simp [Context.comp, Context.fill, induction]
  | choiceRight left right induction =>
      simp [Context.comp, Context.fill, induction]
  | parLeft left right induction =>
      simp [Context.comp, Context.fill, induction]
  | parRight left right induction =>
      simp [Context.comp, Context.fill, induction]
  | new binder body induction =>
      simp [Context.comp, Context.fill, induction]
  | matchEq left right next induction =>
      simp [Context.comp, Context.fill, induction]
  | matchNe left right next induction =>
      simp [Context.comp, Context.fill, induction]
  | repTau body induction =>
      simp [Context.comp, Context.fill, induction]
  | repSend channel value body induction =>
      simp [Context.comp, Context.fill, induction]
  | repRecv channel binder body induction =>
      simp [Context.comp, Context.fill, induction]

/-- The actual context-indexed D1-A semantic carrier. -/
abbrev ContextualModel :=
  Context → TraceEffect

/-- Concrete contextual denotation, not a caller-supplied interpretation. -/
def contextualDenote
    (process : RecursiveProc) : ContextualModel :=
  fun context => denote (context.fill process)

/-- Contextual native finite-trace observation. -/
def ContextuallyEquivalent
    (left right : RecursiveProc) : Prop :=
  ∀ (context : Context) (actions : List Raw.Action),
    Observes (context.fill left) actions ↔
      Observes (context.fill right) actions

/--
Full abstraction of the actual context-indexed lower/Hoare denotation for
the complete guarded-recursive syntax.
-/
theorem guarded_contextual_hoare_full_abstraction
    (left right : RecursiveProc) :
    contextualDenote left = contextualDenote right ↔
      ContextuallyEquivalent left right := by
  constructor
  · intro equal context actions
    have atContext :
        denote (context.fill left) =
          denote (context.fill right) :=
      congrFun equal context
    exact
      (guarded_hoare_full_abstraction
        (context.fill left) (context.fill right)).mp
        atContext actions
  · intro equivalent
    funext context
    exact
      (guarded_hoare_full_abstraction
        (context.fill left) (context.fill right)).mpr
        (equivalent context)

/-- Contextual equivalence is preserved by every one-hole context. -/
theorem context_congruence
    (equivalent : ContextuallyEquivalent left right)
    (frame : Context) :
    ContextuallyEquivalent
      (frame.fill left) (frame.fill right) := by
  intro observer actions
  rw [← Context.fill_comp, ← Context.fill_comp]
  exact equivalent (observer.comp frame) actions

/--
Every guarded source process has a total interpretation in the contextual
trace model.  This is the source-to-semantics direction only.
-/
theorem guarded_contextual_source_interpretation
    (process : RecursiveProc) :
    ∃ semantic : ContextualModel,
      semantic = contextualDenote process :=
  ⟨contextualDenote process, rfl⟩

/--
Compatibility alias for the historical theorem name.

The statement is *not* semantic-to-source definability: it merely says that
each source process denotes the point obtained by `contextualDenote`.
-/
theorem guarded_contextual_definability
    (process : RecursiveProc) :
    ∃ semantic : ContextualModel,
      semantic = contextualDenote process :=
  guarded_contextual_source_interpretation process

/--
The identity context recovers the underlying concrete trace computation.
-/
@[simp]
theorem contextualDenote_hole
    (process : RecursiveProc) :
    contextualDenote process .hole = denote process :=
  rfl

end Cantilune.Pi.FMSGuardedContextualHoare
