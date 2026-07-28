import Mathlib
import Cantilune.Core.Execution

/-!
# Operational projection certificates

A certificate keeps static state/event maps separate from native operational
evidence.  Soundness uses a chosen target event.  Reflection quantifies over
all native observable target events leaving an image state, so the target
transition domain cannot be defined circularly as the forward image.
-/

namespace Cantilune.Core

/--
Evidence that one independently defined observable LTS is a complete
projection of another on mapped states.
-/
structure ProjectionCertificate
    (Source Target : ObservableLTS) where
  mapState : Source.State → Target.State
  mapEvent : Source.Event → Target.Event
  Lift : Source.Event → Target.Event → Prop
  lift_chosen : ∀ e, Lift e (mapEvent e)
  map_equiv :
    ∀ {s t}, Source.stateSetoid.r s t →
      Target.stateSetoid.r (mapState s) (mapState t)
  sound :
    ∀ {s e t}, Source.ObservableStep s e t →
      Target.ObservableStep (mapState s) (mapEvent e) (mapState t)
  reflect :
    ∀ {s d t}, Target.ObservableStep (mapState s) d t →
      ∃ e s', Source.ObservableStep s e s' ∧
        Lift e d ∧ Target.stateSetoid.r t (mapState s')
  success_iff : ∀ s, Target.success (mapState s) ↔ Source.success s
  waiting_iff : ∀ s, Target.waiting (mapState s) ↔ Source.waiting s
  signatureVersion_preserved :
    ∀ s, Target.signatureVersion (mapState s) =
      Source.signatureVersion s

namespace ProjectionCertificate

variable {Source Target : ObservableLTS}
variable (P : ProjectionCertificate Source Target)

/-- A source observable path maps to a native observable target path. -/
theorem path_sound {s t : Source.State} {events : List Source.Event}
    (h : Source.Path s events t) :
    Target.Path (P.mapState s) (events.map P.mapEvent) (P.mapState t) := by
  induction h with
  | nil s => exact .nil (P.mapState s)
  | cons hstep hpath ih =>
      exact .cons (P.sound hstep) ih

/--
Auxiliary reflection theorem whose explicit start-state equivalence makes the
dependent path induction transparent.
-/
private theorem path_reflect_aux
    {start target : Target.State} {events : List Target.Event}
    (h : Target.Path start events target) :
    ∀ (s : Source.State),
      Target.stateSetoid.r start (P.mapState s) →
      ∃ sourceEvents sourceTarget,
        Source.Path s sourceEvents sourceTarget ∧
        List.Forall₂ P.Lift sourceEvents events ∧
        Target.stateSetoid.r target (P.mapState sourceTarget) := by
  induction h with
  | nil start =>
      intro s hstart
      exact ⟨[], s, .nil s, .nil, hstart⟩
  | @cons start middle target event rest hstep hpath ih =>
      intro s hstart
      have hmiddleRefl : Target.stateSetoid.r middle middle :=
        Target.stateSetoid.iseqv.refl middle
      have normalizedStep :
          Target.ObservableStep (P.mapState s) event middle := by
        exact
          ⟨(Target.step_congr hstart hmiddleRefl).mp hstep.1,
            hstep.2⟩
      obtain ⟨sourceEvent, sourceMiddle, hsource, hlift, hmiddle⟩ :=
        P.reflect normalizedStep
      obtain ⟨sourceRest, sourceFinal, hrest, hlifts, hfinal⟩ :=
        ih sourceMiddle hmiddle
      exact
        ⟨sourceEvent :: sourceRest, sourceFinal,
          .cons hsource hrest, .cons hlift hlifts, hfinal⟩

/--
Every native observable target path from an image state reflects to a source
path, with a pointwise `Lift` witness and an endpoint equivalent to a mapped
source state.
-/
theorem path_reflect {s : Source.State} {target : Target.State}
    {events : List Target.Event}
    (h : Target.Path (P.mapState s) events target) :
    ∃ sourceEvents sourceTarget,
      Source.Path s sourceEvents sourceTarget ∧
      List.Forall₂ P.Lift sourceEvents events ∧
      Target.stateSetoid.r target (P.mapState sourceTarget) :=
  P.path_reflect_aux h s (Target.stateSetoid.iseqv.refl _)

/-- The two path obligations, packaged as one kernel-checked metatheorem. -/
theorem projection_paths_lift_and_reflect :
    (∀ {s t : Source.State} {events : List Source.Event},
      Source.Path s events t →
        Target.Path (P.mapState s) (events.map P.mapEvent) (P.mapState t)) ∧
    (∀ {s : Source.State} {target : Target.State}
        {events : List Target.Event},
      Target.Path (P.mapState s) events target →
        ∃ sourceEvents sourceTarget,
          Source.Path s sourceEvents sourceTarget ∧
          List.Forall₂ P.Lift sourceEvents events ∧
          Target.stateSetoid.r target (P.mapState sourceTarget)) := by
  constructor
  · intro s t events h
    exact P.path_sound h
  · intro s target events h
    exact P.path_reflect h

/--
Soundness and operational exhaustiveness imply preservation and reflection of
normal form on mapped states.
-/
theorem normal_iff (s : Source.State) :
    Target.Normal (P.mapState s) ↔ Source.Normal s := by
  constructor
  · intro htarget hsource
    rcases hsource with ⟨event, state, hstep⟩
    exact htarget ⟨P.mapEvent event, P.mapState state, P.sound hstep⟩
  · intro hsource htarget
    rcases htarget with ⟨event, state, hstep⟩
    obtain ⟨sourceEvent, sourceState, hsourceStep, _hlift, _hendpoint⟩ :=
      P.reflect hstep
    exact hsource ⟨sourceEvent, sourceState, hsourceStep⟩

theorem successfulTermination_iff (s : Source.State) :
    Target.SuccessfulTermination (P.mapState s) ↔
      Source.SuccessfulTermination s := by
  simp only [ObservableLTS.SuccessfulTermination]
  exact and_congr (P.normal_iff s) (P.success_iff s)

theorem externalWait_iff (s : Source.State) :
    Target.ExternalWait (P.mapState s) ↔ Source.ExternalWait s := by
  simp only [ObservableLTS.ExternalWait]
  rw [P.normal_iff s, P.success_iff s, P.waiting_iff s]

theorem deadlocked_iff (s : Source.State) :
    Target.Deadlocked (P.mapState s) ↔ Source.Deadlocked s := by
  simp only [ObservableLTS.Deadlocked]
  rw [P.normal_iff s, P.success_iff s, P.waiting_iff s]

/--
The complete terminal classification is invariant under a certified
projection.  This is stronger than preserving a bare stuck/not-stuck bit.
-/
theorem terminal_classification_preserved (s : Source.State) :
    (Target.SuccessfulTermination (P.mapState s) ↔
      Source.SuccessfulTermination s) ∧
    (Target.ExternalWait (P.mapState s) ↔ Source.ExternalWait s) ∧
    (Target.Deadlocked (P.mapState s) ↔ Source.Deadlocked s) :=
  ⟨P.successfulTermination_iff s, P.externalWait_iff s,
    P.deadlocked_iff s⟩

end ProjectionCertificate

end Cantilune.Core
