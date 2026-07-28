import Cantilune.Core.Projection
import Cantilune.Projection.DAG
import Cantilune.Projection.PreNet
import Cantilune.Projection.Morphism

/-!
# General operational P1a certificate layer

The original P1a modules provide one finite, nonempty reference instance.
This module adds the reusable theorem layer:

* an independently stated observable-LTS isomorphism;
* a construction of a complete `ProjectionCertificate` from that isomorphism;
* a three-view P1a family for DAG, Petri/pre-net, and morphism views; and
* simultaneous soundness, path reflection, and terminal-classification
  theorems for all three views.

This is the general *operational* P1a layer.  Static SMC, resource, and
signature-admission evidence continue to live in
`CompleteProjectionCertificate`; this module does not manufacture those
layers from an LTS isomorphism.
-/

namespace Cantilune.Projection.GeneralP1a

open Cantilune.Core

/--
An isomorphism between independently specified observable transition systems.
The fields mention the native `step` and `observable` predicates separately,
so target transitions are not defined as the image of source transitions.
-/
structure ObservableLTSIso (Source Target : ObservableLTS) where
  stateEquiv : Source.State ≃ Target.State
  eventEquiv : Source.Event ≃ Target.Event
  stateSetoid_iff :
    ∀ {left right},
      Target.stateSetoid.r (stateEquiv left) (stateEquiv right) ↔
        Source.stateSetoid.r left right
  step_iff :
    ∀ {source event target},
      Target.step
        (stateEquiv source) (eventEquiv event) (stateEquiv target) ↔
        Source.step source event target
  observable_iff :
    ∀ event,
      Target.observable (eventEquiv event) ↔ Source.observable event
  success_iff :
    ∀ state, Target.success (stateEquiv state) ↔ Source.success state
  waiting_iff :
    ∀ state, Target.waiting (stateEquiv state) ↔ Source.waiting state
  signatureVersion_eq :
    ∀ state,
      Target.signatureVersion (stateEquiv state) =
        Source.signatureVersion state

namespace ObservableLTSIso

variable {Source Target : ObservableLTS}

/--
Every observable-LTS isomorphism induces a projection certificate with exact
event lifting and exhaustive reflection.
-/
def toProjectionCertificate
    (iso : ObservableLTSIso Source Target) :
    ProjectionCertificate Source Target where
  mapState := iso.stateEquiv
  mapEvent := iso.eventEquiv
  Lift := fun source target => target = iso.eventEquiv source
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target equivalent
    exact iso.stateSetoid_iff.mpr equivalent
  sound := by
    rintro source event target ⟨step, observable⟩
    exact ⟨iso.step_iff.mpr step, iso.observable_iff event |>.mpr observable⟩
  reflect := by
    rintro source targetEvent target ⟨step, observable⟩
    let sourceEvent := iso.eventEquiv.symm targetEvent
    let sourceTarget := iso.stateEquiv.symm target
    have eventRoundTrip : iso.eventEquiv sourceEvent = targetEvent :=
      iso.eventEquiv.apply_symm_apply targetEvent
    have stateRoundTrip : iso.stateEquiv sourceTarget = target :=
      iso.stateEquiv.apply_symm_apply target
    have targetStep :
        Target.step
          (iso.stateEquiv source)
          (iso.eventEquiv sourceEvent)
          (iso.stateEquiv sourceTarget) := by
      simpa [eventRoundTrip, stateRoundTrip] using step
    have targetObservable :
        Target.observable (iso.eventEquiv sourceEvent) := by
      simpa [eventRoundTrip] using observable
    refine ⟨sourceEvent, sourceTarget,
      ⟨iso.step_iff.mp targetStep,
        iso.observable_iff sourceEvent |>.mp targetObservable⟩,
      eventRoundTrip.symm, ?_⟩
    rw [stateRoundTrip]
  success_iff := iso.success_iff
  waiting_iff := iso.waiting_iff
  signatureVersion_preserved := iso.signatureVersion_eq

end ObservableLTSIso

/--
The three operational projections that make up P1a.  Each target transition
system is independent and each certificate includes native one-step
soundness, exhaustiveness/reflection, terminal predicates, and version
preservation.
-/
structure Certificate
    (Source Dag Petri Morphism : ObservableLTS) where
  dag : ProjectionCertificate Source Dag
  petri : ProjectionCertificate Source Petri
  morphism : ProjectionCertificate Source Morphism

namespace Certificate

variable
    {Source Dag Petri Morphism : ObservableLTS}
    (certificate : Certificate Source Dag Petri Morphism)

/-- The proposition proved by the generic path lift-and-reflect metatheorem. -/
def PathCoverage
    {Source Target : ObservableLTS}
    (projection : ProjectionCertificate Source Target) : Prop :=
  (∀ {source target : Source.State} {events : List Source.Event},
      Source.Path source events target →
        Target.Path
          (projection.mapState source)
          (events.map projection.mapEvent)
          (projection.mapState target)) ∧
    (∀ {source : Source.State} {target : Target.State}
        {events : List Target.Event},
      Target.Path (projection.mapState source) events target →
        ∃ sourceEvents sourceTarget,
          Source.Path source sourceEvents sourceTarget ∧
            List.Forall₂ projection.Lift sourceEvents events ∧
            Target.stateSetoid.r target
              (projection.mapState sourceTarget))

/-- Every native source step has one native one-step derivation in all views. -/
theorem sound_all
    {source : Source.State} {event : Source.Event} {target : Source.State}
    (step : Source.ObservableStep source event target) :
    Dag.ObservableStep
        (certificate.dag.mapState source)
        (certificate.dag.mapEvent event)
        (certificate.dag.mapState target) ∧
      Petri.ObservableStep
        (certificate.petri.mapState source)
        (certificate.petri.mapEvent event)
        (certificate.petri.mapState target) ∧
      Morphism.ObservableStep
        (certificate.morphism.mapState source)
        (certificate.morphism.mapEvent event)
        (certificate.morphism.mapState target) :=
  ⟨certificate.dag.sound step,
    certificate.petri.sound step,
    certificate.morphism.sound step⟩

/-- Source paths map to native paths in all three P1a views. -/
theorem paths_sound_all
    {source target : Source.State} {events : List Source.Event}
    (path : Source.Path source events target) :
    Dag.Path
        (certificate.dag.mapState source)
        (events.map certificate.dag.mapEvent)
        (certificate.dag.mapState target) ∧
      Petri.Path
        (certificate.petri.mapState source)
        (events.map certificate.petri.mapEvent)
        (certificate.petri.mapState target) ∧
      Morphism.Path
        (certificate.morphism.mapState source)
        (events.map certificate.morphism.mapEvent)
        (certificate.morphism.mapState target) :=
  ⟨certificate.dag.path_sound path,
    certificate.petri.path_sound path,
    certificate.morphism.path_sound path⟩

/-- The reusable path soundness/reflection theorem is available in every view. -/
theorem paths_lift_and_reflect_all :
    PathCoverage certificate.dag ∧
      PathCoverage certificate.petri ∧
      PathCoverage certificate.morphism :=
  ⟨ProjectionCertificate.projection_paths_lift_and_reflect certificate.dag,
    ProjectionCertificate.projection_paths_lift_and_reflect certificate.petri,
    ProjectionCertificate.projection_paths_lift_and_reflect
      certificate.morphism⟩

/-- Success, external wait, and genuine deadlock agree in every P1a view. -/
theorem terminals_all (state : Source.State) :
    ((Dag.SuccessfulTermination (certificate.dag.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Dag.ExternalWait (certificate.dag.mapState state) ↔
        Source.ExternalWait state) ∧
      (Dag.Deadlocked (certificate.dag.mapState state) ↔
        Source.Deadlocked state)) ∧
    ((Petri.SuccessfulTermination (certificate.petri.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Petri.ExternalWait (certificate.petri.mapState state) ↔
        Source.ExternalWait state) ∧
      (Petri.Deadlocked (certificate.petri.mapState state) ↔
        Source.Deadlocked state)) ∧
    ((Morphism.SuccessfulTermination
          (certificate.morphism.mapState state) ↔
        Source.SuccessfulTermination state) ∧
      (Morphism.ExternalWait (certificate.morphism.mapState state) ↔
        Source.ExternalWait state) ∧
      (Morphism.Deadlocked (certificate.morphism.mapState state) ↔
        Source.Deadlocked state)) :=
  ⟨certificate.dag.terminal_classification_preserved state,
    certificate.petri.terminal_classification_preserved state,
    certificate.morphism.terminal_classification_preserved state⟩

/-- Signature versions agree simultaneously in all three target views. -/
theorem signature_versions_all (state : Source.State) :
    Dag.signatureVersion (certificate.dag.mapState state) =
        Source.signatureVersion state ∧
      Petri.signatureVersion (certificate.petri.mapState state) =
        Source.signatureVersion state ∧
      Morphism.signatureVersion (certificate.morphism.mapState state) =
        Source.signatureVersion state :=
  ⟨certificate.dag.signatureVersion_preserved state,
    certificate.petri.signatureVersion_preserved state,
    certificate.morphism.signatureVersion_preserved state⟩

end Certificate

/-- Nonempty concrete P1a witness supplied by the existing reference models. -/
def referenceCertificate :
    Certificate
      Reference.lts DAG.lts PreNet.lts Morphism.lts where
  dag := DAG.dag_certificate
  petri := PreNet.reconfigurable_petri_certificate
  morphism := Morphism.certificate

theorem reference_install_native_all :
    DAG.lts.ObservableStep
        DAG.emptyState .addWorker DAG.installedState ∧
      PreNet.lts.ObservableStep
        PreNet.emptyState .declareWorker PreNet.installedState ∧
      Morphism.lts.ObservableStep
        .empty .install .installed :=
  referenceCertificate.sound_all Reference.install_observable

theorem reference_execute_native_all :
    DAG.lts.ObservableStep
        DAG.installedState .runWorker DAG.finishedState ∧
      PreNet.lts.ObservableStep
        PreNet.installedState
        (.fireWorker PreNet.inputToken.id)
        PreNet.finishedState ∧
      Morphism.lts.ObservableStep
        .installed .execute .finished :=
  referenceCertificate.sound_all Reference.execute_observable

end Cantilune.Projection.GeneralP1a
