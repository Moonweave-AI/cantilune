import Cantilune.Pi.FMSGuardedContextualHoare

/-!
# Continuous context composition for the guarded D1-A Hoare model

`FMSGuardedContextualHoare` completes the concrete guarded trace model by
observing a process in every one-hole context.  This module equips that
context-indexed carrier with its actual compositional action.

For a frame `F`, `precompose F` reindexes a semantic point along
`observer ↦ observer.comp F`.  The target trace effect is a complete lattice,
so the pointwise function space is an omega-CPO and this reindexing is an
actual `ContinuousHom`.  Filling a process frame and reindexing its contextual
denotation commute by kernel equality.

Parallel-left/right, choice-left/right, new/hide/restriction, and all three
guarded replication forms are concrete instances of the same continuous
action.  The context and continuous-map identity/associativity laws provide
the corresponding coherence.

This is the maximal compatible hiding/coherence theorem for the selected
unseparated D1-A contextual Hoare observation.  It neither separates the two
effect-level nullary constants nor claims the source paper's separated,
strong-bisimulation, left-merge model.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSGuardedContextualComposition

open Cantilune.Pi
open Cantilune.Pi.FMSGuardedContextualHoare
open Cantilune.Pi.FMSGuardedHoareTrace
open OmegaCompletePartialOrder

/-! ## The context monoid -/

/-- The hole is a right identity for context substitution. -/
@[simp]
theorem Context.comp_hole_right (context : Context) :
    context.comp .hole = context := by
  induction context <;> simp [Context.comp, *]

/-- The hole is a left identity for context substitution. -/
@[simp]
theorem Context.hole_comp (context : Context) :
    Context.hole.comp context = context :=
  rfl

/-- One-hole context substitution is associative. -/
theorem Context.comp_assoc
    (outer middle inner : Context) :
    (outer.comp middle).comp inner =
      outer.comp (middle.comp inner) := by
  induction outer <;> simp [Context.comp, *]

/-! ## Actual continuous reindexing -/

/--
Reindex a contextual semantic point along insertion of `frame` into the
observer's hole.
-/
def precompose
    (frame : Context)
    (semantic : ContextualModel) :
    ContextualModel :=
  fun observer => semantic (observer.comp frame)

@[simp]
theorem precompose_apply
    (frame observer : Context)
    (semantic : ContextualModel) :
    precompose frame semantic observer =
      semantic (observer.comp frame) :=
  rfl

/--
Context reindexing as a genuine omega-Scott-continuous endpoint on the
pointwise contextual model.
-/
def precomposeHom
    (frame : Context) :
    ContinuousHom ContextualModel ContextualModel :=
  ContinuousHom.ofFun
    (fun semantic observer =>
      semantic (observer.comp frame))
    (by fun_prop)

@[simp]
theorem precomposeHom_apply
    (frame : Context)
    (semantic : ContextualModel) :
    precomposeHom frame semantic =
      precompose frame semantic :=
  rfl

/-- The underlying reindexing function is omega-Scott continuous. -/
theorem precompose_omegaScottContinuous
    (frame : Context) :
    ωScottContinuous (precompose frame) := by
  unfold precompose
  fun_prop

/-- Reindexing by the hole is the identity continuous map. -/
@[simp]
theorem precomposeHom_hole :
    precomposeHom .hole =
      ContinuousHom.id := by
  apply ContinuousHom.ext
  intro semantic
  funext observer
  simp [precomposeHom]

/--
Context substitution is represented by composition of actual continuous
reindexing maps.
-/
theorem precomposeHom_comp
    (outer inner : Context) :
    precomposeHom (outer.comp inner) =
      (precomposeHom outer).comp
        (precomposeHom inner) := by
  apply ContinuousHom.ext
  intro semantic
  funext observer
  exact congrArg semantic
    (Context.comp_assoc observer outer inner).symm

/-- The continuous reindexing action satisfies associativity coherence. -/
theorem precomposeHom_assoc
    (outer middle inner : Context) :
    (precomposeHom outer).comp
        ((precomposeHom middle).comp
          (precomposeHom inner)) =
      ((precomposeHom outer).comp
          (precomposeHom middle)).comp
        (precomposeHom inner) :=
  ContinuousHom.comp_assoc _ _ _

/-! ## The fundamental fill/reindex exchange -/

/--
Filling a syntactic frame before denotation is exactly reindexing the
contextual denotation along that frame.
-/
theorem contextualDenote_fill
    (frame : Context)
    (process : RecursiveProc) :
    contextualDenote (frame.fill process) =
      precomposeHom frame (contextualDenote process) := by
  funext observer
  exact congrArg denote
    (Context.fill_comp observer frame process).symm

/--
Two nested fills commute with the continuous context action, including its
associativity coherence.
-/
theorem contextualDenote_fill_comp
    (outer inner : Context)
    (process : RecursiveProc) :
    contextualDenote
        ((outer.comp inner).fill process) =
      precomposeHom outer
        (precomposeHom inner
          (contextualDenote process)) := by
  rw [contextualDenote_fill]
  exact ContinuousHom.congr_fun
    (precomposeHom_comp outer inner)
    (contextualDenote process)

/-! ## Concrete constructor operations -/

/-- Add a fixed process on the right of the semantic hole. -/
def parLeftSemantic
    (right : RecursiveProc) :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.parLeft .hole right)

/-- Add a fixed process on the left of the semantic hole. -/
def parRightSemantic
    (left : RecursiveProc) :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.parRight left .hole)

/-- Add a fixed right branch to a nondeterministic choice. -/
def choiceLeftSemantic
    (right : RecursiveProc) :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.choiceLeft .hole right)

/-- Add a fixed left branch to a nondeterministic choice. -/
def choiceRightSemantic
    (left : RecursiveProc) :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.choiceRight left .hole)

/-- Hide a name by the native guarded syntax's restriction constructor. -/
def hideSemantic
    (binder : Name) :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.new binder .hole)

/--
Restriction and hiding are the same concrete operation at this contextual
Hoare layer.
-/
def restrictionSemantic
    (binder : Name) :
    ContinuousHom ContextualModel ContextualModel :=
  hideSemantic binder

/-- Guarded tau replication as a continuous contextual operation. -/
def repTauSemantic :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.repTau .hole)

/-- Guarded output replication as a continuous contextual operation. -/
def repSendSemantic
    (channel value : Name) :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.repSend channel value .hole)

/-- Guarded input replication as a continuous contextual operation. -/
def repRecvSemantic
    (channel binder : Name) :
    ContinuousHom ContextualModel ContextualModel :=
  precomposeHom (.repRecv channel binder .hole)

/-! ## Exact constructor/denotation exchange laws -/

theorem contextualDenote_par_left
    (left right : RecursiveProc) :
    contextualDenote (.par left right) =
      parLeftSemantic right (contextualDenote left) := by
  simpa [parLeftSemantic, Context.fill] using
    contextualDenote_fill
      (.parLeft .hole right) left

theorem contextualDenote_par_right
    (left right : RecursiveProc) :
    contextualDenote (.par left right) =
      parRightSemantic left (contextualDenote right) := by
  simpa [parRightSemantic, Context.fill] using
    contextualDenote_fill
      (.parRight left .hole) right

theorem contextualDenote_choice_left
    (left right : RecursiveProc) :
    contextualDenote (.choice left right) =
      choiceLeftSemantic right (contextualDenote left) := by
  simpa [choiceLeftSemantic, Context.fill] using
    contextualDenote_fill
      (.choiceLeft .hole right) left

theorem contextualDenote_choice_right
    (left right : RecursiveProc) :
    contextualDenote (.choice left right) =
      choiceRightSemantic left (contextualDenote right) := by
  simpa [choiceRightSemantic, Context.fill] using
    contextualDenote_fill
      (.choiceRight left .hole) right

theorem contextualDenote_hide
    (binder : Name)
    (process : RecursiveProc) :
    contextualDenote (.new binder process) =
      hideSemantic binder (contextualDenote process) := by
  simpa [hideSemantic, Context.fill] using
    contextualDenote_fill
      (.new binder .hole) process

theorem contextualDenote_restriction
    (binder : Name)
    (process : RecursiveProc) :
    contextualDenote (.new binder process) =
      restrictionSemantic binder
        (contextualDenote process) := by
  simpa [restrictionSemantic] using
    contextualDenote_hide binder process

theorem contextualDenote_repTau
    (body : RecursiveProc) :
    contextualDenote (.repTau body) =
      repTauSemantic (contextualDenote body) := by
  simpa [repTauSemantic, Context.fill] using
    contextualDenote_fill (.repTau .hole) body

theorem contextualDenote_repSend
    (channel value : Name)
    (body : RecursiveProc) :
    contextualDenote (.repSend channel value body) =
      repSendSemantic channel value
        (contextualDenote body) := by
  simpa [repSendSemantic, Context.fill] using
    contextualDenote_fill
      (.repSend channel value .hole) body

theorem contextualDenote_repRecv
    (channel binder : Name)
    (body : RecursiveProc) :
    contextualDenote (.repRecv channel binder body) =
      repRecvSemantic channel binder
        (contextualDenote body) := by
  simpa [repRecvSemantic, Context.fill] using
    contextualDenote_fill
      (.repRecv channel binder .hole) body

/-! ## Hiding and constructor coherence -/

/-- The public restriction operation is definitionally the hiding map. -/
@[simp]
theorem restrictionSemantic_eq_hide
    (binder : Name) :
    restrictionSemantic binder =
      hideSemantic binder :=
  rfl

/--
Nested hiding is represented by continuous-map composition and by the
corresponding nested restriction context.
-/
theorem hideSemantic_comp
    (outer inner : Name) :
    (hideSemantic outer).comp
        (hideSemantic inner) =
      precomposeHom
        (.new outer (.new inner .hole)) := by
  rw [hideSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.new outer .hole)
      (.new inner .hole)

/-- Parallel-left insertion composes coherently with hiding. -/
theorem parLeftSemantic_comp_hide
    (right : RecursiveProc)
    (binder : Name) :
    (parLeftSemantic right).comp
        (hideSemantic binder) =
      precomposeHom
        (.parLeft (.new binder .hole) right) := by
  rw [parLeftSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.parLeft .hole right)
      (.new binder .hole)

/-- Parallel-right insertion composes coherently with hiding. -/
theorem parRightSemantic_comp_hide
    (left : RecursiveProc)
    (binder : Name) :
    (parRightSemantic left).comp
        (hideSemantic binder) =
      precomposeHom
        (.parRight left (.new binder .hole)) := by
  rw [parRightSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.parRight left .hole)
      (.new binder .hole)

/-- Choice-left insertion composes coherently with hiding. -/
theorem choiceLeftSemantic_comp_hide
    (right : RecursiveProc)
    (binder : Name) :
    (choiceLeftSemantic right).comp
        (hideSemantic binder) =
      precomposeHom
        (.choiceLeft (.new binder .hole) right) := by
  rw [choiceLeftSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.choiceLeft .hole right)
      (.new binder .hole)

/-- Choice-right insertion composes coherently with hiding. -/
theorem choiceRightSemantic_comp_hide
    (left : RecursiveProc)
    (binder : Name) :
    (choiceRightSemantic left).comp
        (hideSemantic binder) =
      precomposeHom
        (.choiceRight left (.new binder .hole)) := by
  rw [choiceRightSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.choiceRight left .hole)
      (.new binder .hole)

/--
Guarded tau replication composes coherently with hiding; the theorem is
about the actual syntax constructors and not a Table-5 left-merge equation.
-/
theorem repTauSemantic_comp_hide
    (binder : Name) :
    repTauSemantic.comp (hideSemantic binder) =
      precomposeHom
        (.repTau (.new binder .hole)) := by
  rw [repTauSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.repTau .hole)
      (.new binder .hole)

/-- Guarded output replication composes coherently with hiding. -/
theorem repSendSemantic_comp_hide
    (channel value binder : Name) :
    (repSendSemantic channel value).comp
        (hideSemantic binder) =
      precomposeHom
        (.repSend channel value
          (.new binder .hole)) := by
  rw [repSendSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.repSend channel value .hole)
      (.new binder .hole)

/-- Guarded input replication composes coherently with hiding. -/
theorem repRecvSemantic_comp_hide
    (channel inputBinder hidden : Name) :
    (repRecvSemantic channel inputBinder).comp
        (hideSemantic hidden) =
      precomposeHom
        (.repRecv channel inputBinder
          (.new hidden .hole)) := by
  rw [repRecvSemantic, hideSemantic]
  symm
  simpa [Context.comp] using
    precomposeHom_comp
      (.repRecv channel inputBinder .hole)
      (.new hidden .hole)

/-! ## Kernel-checkable acceptance witness -/

/--
The concrete acceptance boundary for contextual D1-A composition and
hiding.  Every field refers to the fixed syntax, denotation, and continuous
maps defined above rather than to caller-supplied operations.
-/
structure ContextualHidingCoherenceAcceptance : Prop where
  reindex_continuous :
    ∀ frame : Context,
      ωScottContinuous (precompose frame)
  identity :
    precomposeHom .hole = ContinuousHom.id
  composition :
    ∀ outer inner : Context,
      precomposeHom (outer.comp inner) =
        (precomposeHom outer).comp
          (precomposeHom inner)
  fill_exchange :
    ∀ (frame : Context) (process : RecursiveProc),
      contextualDenote (frame.fill process) =
        precomposeHom frame
          (contextualDenote process)
  par_left_exchange :
    ∀ left right : RecursiveProc,
      contextualDenote (.par left right) =
        parLeftSemantic right
          (contextualDenote left)
  par_right_exchange :
    ∀ left right : RecursiveProc,
      contextualDenote (.par left right) =
        parRightSemantic left
          (contextualDenote right)
  choice_left_exchange :
    ∀ left right : RecursiveProc,
      contextualDenote (.choice left right) =
        choiceLeftSemantic right
          (contextualDenote left)
  choice_right_exchange :
    ∀ left right : RecursiveProc,
      contextualDenote (.choice left right) =
        choiceRightSemantic left
          (contextualDenote right)
  hiding_exchange :
    ∀ (binder : Name) (process : RecursiveProc),
      contextualDenote (.new binder process) =
        hideSemantic binder
          (contextualDenote process)
  restriction_is_hiding :
    ∀ binder : Name,
      restrictionSemantic binder =
        hideSemantic binder
  rep_tau_exchange :
    ∀ body : RecursiveProc,
      contextualDenote (.repTau body) =
        repTauSemantic (contextualDenote body)
  rep_send_exchange :
    ∀ (channel value : Name) (body : RecursiveProc),
      contextualDenote (.repSend channel value body) =
        repSendSemantic channel value
          (contextualDenote body)
  rep_recv_exchange :
    ∀ (channel binder : Name) (body : RecursiveProc),
      contextualDenote (.repRecv channel binder body) =
        repRecvSemantic channel binder
          (contextualDenote body)
  hiding_composition :
    ∀ outer inner : Name,
      (hideSemantic outer).comp
          (hideSemantic inner) =
        precomposeHom
          (.new outer (.new inner .hole))

/--
No-argument witness that the selected contextual Hoare model has the
continuous composition and hiding laws stated by the acceptance boundary.
-/
theorem contextualHidingCoherenceAccepted :
    ContextualHidingCoherenceAcceptance where
  reindex_continuous := precompose_omegaScottContinuous
  identity := precomposeHom_hole
  composition := precomposeHom_comp
  fill_exchange := contextualDenote_fill
  par_left_exchange := contextualDenote_par_left
  par_right_exchange := contextualDenote_par_right
  choice_left_exchange := contextualDenote_choice_left
  choice_right_exchange := contextualDenote_choice_right
  hiding_exchange := contextualDenote_hide
  restriction_is_hiding := restrictionSemantic_eq_hide
  rep_tau_exchange := contextualDenote_repTau
  rep_send_exchange := contextualDenote_repSend
  rep_recv_exchange := contextualDenote_repRecv
  hiding_composition := hideSemantic_comp

end Cantilune.Pi.FMSGuardedContextualComposition
