import Mathlib
import Cantilune.Projection.All

/-!
# Executable P1a certificate regressions

These checks exercise the finite reference projections.  They deliberately
stay within the two native source events and make no general graph-rewriting
or Petri-net claim.
-/

namespace Cantilune.Tests.ProjectionCertificates

open Cantilune.Core
open Cantilune.Projection

/-! The central declarations contain the complete certificate data. -/

example : ProjectionCertificate Reference.lts DAG.lts :=
  DAG.dag_certificate

example : ProjectionCertificate Reference.lts PreNet.lts :=
  PreNet.reconfigurable_petri_certificate

example : ProjectionCertificate Reference.lts Morphism.lts :=
  Morphism.certificate

/-! Chosen events and signature versions are preserved definitionally. -/

example :
    DAG.dag_certificate.mapEvent .install = .addWorker :=
  rfl

example :
    PreNet.reconfigurable_petri_certificate.mapEvent .execute =
      .fireWorker PreNet.inputToken.id :=
  rfl

example (state : Reference.State) :
    DAG.lts.signatureVersion
        (DAG.dag_certificate.mapState state) =
      Reference.lts.signatureVersion state :=
  DAG.dag_certificate.signatureVersion_preserved state

example (state : Reference.State) :
    PreNet.lts.signatureVersion
        (PreNet.reconfigurable_petri_certificate.mapState state) =
      Reference.lts.signatureVersion state :=
  PreNet.reconfigurable_petri_certificate.signatureVersion_preserved state

example (state : Reference.State) :
    Morphism.lts.signatureVersion
        (Morphism.certificate.mapState state) =
      Reference.lts.signatureVersion state :=
  Morphism.certificate.signatureVersion_preserved state

example :
    DAG.lts.signatureVersion DAG.emptyState = 0 ∧
      DAG.lts.signatureVersion DAG.installedState = 1 ∧
      DAG.lts.signatureVersion DAG.finishedState = 1 := by
  native_decide

example :
    PreNet.lts.signatureVersion PreNet.emptyState = 0 ∧
      PreNet.lts.signatureVersion PreNet.installedState = 1 ∧
      PreNet.lts.signatureVersion PreNet.finishedState = 1 := by
  native_decide

/-! Both source steps produce independently defined native target steps. -/

example :
    DAG.lts.ObservableStep
      DAG.emptyState .addWorker DAG.installedState :=
  DAG.dag_certificate.sound Reference.install_observable

example :
    DAG.lts.ObservableStep
      DAG.installedState .runWorker DAG.finishedState :=
  DAG.dag_certificate.sound Reference.execute_observable

example :
    PreNet.lts.ObservableStep
      PreNet.emptyState .declareWorker PreNet.installedState :=
  PreNet.reconfigurable_petri_certificate.sound
    Reference.install_observable

example :
    PreNet.lts.ObservableStep
      PreNet.installedState
      (.fireWorker PreNet.inputToken.id)
      PreNet.finishedState :=
  PreNet.reconfigurable_petri_certificate.sound
    Reference.execute_observable

example :
    Morphism.lts.ObservableStep
      .empty .install .installed :=
  Morphism.certificate.sound Reference.install_observable

/-! Native image steps reflect to source events and equivalent endpoints. -/

example :
    ∃ event state,
      Reference.lts.ObservableStep .empty event state ∧
        DAG.Lift event .addWorker ∧
        DAG.lts.stateSetoid.r
          DAG.installedState (DAG.mapState state) :=
  DAG.dag_certificate.reflect DAG.install_native

example :
    ∃ event state,
      Reference.lts.ObservableStep .installed event state ∧
        PreNet.Lift event (.fireWorker PreNet.inputToken.id) ∧
        PreNet.lts.stateSetoid.r
          PreNet.finishedState (PreNet.mapState state) :=
  PreNet.reconfigurable_petri_certificate.reflect
    PreNet.firing_native

/-! Events not present in the native finite transition relations are rejected. -/

private theorem dag_empty_ne_installed :
    DAG.emptyState ≠ DAG.installedState := by
  intro equality
  have versionEquality :=
    congrArg DAG.State.version equality
  norm_num [DAG.emptyState, DAG.installedState] at versionEquality

private theorem dag_finished_ne_installed :
    DAG.finishedState ≠ DAG.installedState := by
  intro equality
  have completionEquality :=
    congrArg
      (fun state => DAG.Vertex.worker ∈ state.completed)
      equality
  simp [DAG.finishedState, DAG.installedState] at completionEquality

example :
    ¬DAG.lts.ObservableStep
      DAG.emptyState .runWorker DAG.finishedState := by
  rintro ⟨step, _⟩
  rcases DAG.step_characterization step with shape | shape
  · cases shape.2.1
  · exact dag_empty_ne_installed shape.1

example :
    ¬DAG.lts.ObservableStep
      DAG.finishedState .runWorker DAG.finishedState := by
  rintro ⟨step, _⟩
  rcases DAG.step_characterization step with shape | shape
  · cases shape.2.1
  · exact dag_finished_ne_installed shape.1

private theorem prenet_installed_ne_empty :
    PreNet.installedState ≠ PreNet.emptyState := by
  intro equality
  have versionEquality :=
    congrArg PreNet.State.version equality
  norm_num [PreNet.installedState, PreNet.emptyState] at versionEquality

private theorem prenet_finished_ne_installed :
    PreNet.finishedState ≠ PreNet.installedState := by
  intro equality
  have tokenEquality :=
    congrArg
      (fun state => PreNet.inputToken ∈ state.marking)
      equality
  simp [PreNet.finishedState, PreNet.installedState,
    PreNet.inputToken, PreNet.outputToken] at tokenEquality

example :
    ¬PreNet.lts.ObservableStep
      PreNet.installedState
      (.fireWorker (PreNet.inputToken.id + 1))
      PreNet.finishedState := by
  rintro ⟨step, _⟩
  rcases PreNet.step_characterization step with shape | shape
  · exact prenet_installed_ne_empty shape.1
  · have tokenEquality := congrArg
      (fun event =>
        match event with
        | .declareWorker => 0
        | .fireWorker tokenId => tokenId)
      shape.2.1
    simp [PreNet.inputToken] at tokenEquality

example :
    ¬PreNet.lts.ObservableStep
      PreNet.finishedState
      (.fireWorker PreNet.inputToken.id)
      PreNet.finishedState := by
  rintro ⟨step, _⟩
  rcases PreNet.step_characterization step with shape | shape
  · cases shape.2.1
  · exact prenet_finished_ne_installed shape.1

/-! Declaration order and token identity remain explicit finite data. -/

example :
    PreNet.workerNet.declarations =
      [PreNet.workerDeclaration] :=
  rfl

example :
    PreNet.workerNet.declarations.map
        PreNet.Declaration.ordinal = [0] := by
  native_decide

example :
    PreNet.workerNet.declarations.Pairwise
      PreNet.declarationBefore :=
  PreNet.worker_declaration_ordered

example :
    PreNet.tokenIds PreNet.installedState.marking =
      PreNet.tokenIds PreNet.finishedState.marking :=
  PreNet.firing_preserves_token_identity

example :
    PreNet.tokenIds PreNet.installedState.marking =
      {PreNet.inputToken.id} := by
  native_decide

example {event : PreNet.Event}
    (step :
      PreNet.Step PreNet.installedState event PreNet.finishedState) :
    event = .fireWorker PreNet.inputToken.id := by
  rcases PreNet.step_characterization step with shape | shape
  · exact False.elim (prenet_installed_ne_empty shape.1)
  · exact shape.2.1

/-! Terminal observations are transported by the certificate, not recomputed. -/

example :
    DAG.lts.SuccessfulTermination DAG.finishedState :=
  (DAG.dag_certificate.successfulTermination_iff .finished).2
    Reference.finished_successful

example :
    PreNet.lts.SuccessfulTermination PreNet.finishedState :=
  (PreNet.reconfigurable_petri_certificate.successfulTermination_iff
      .finished).2
    Reference.finished_successful

example (state : Reference.State) :
    (DAG.lts.SuccessfulTermination
        (DAG.mapState state) ↔
      Reference.lts.SuccessfulTermination state) ∧
    (DAG.lts.ExternalWait
        (DAG.mapState state) ↔
      Reference.lts.ExternalWait state) ∧
    (DAG.lts.Deadlocked
        (DAG.mapState state) ↔
      Reference.lts.Deadlocked state) :=
  DAG.dag_certificate.terminal_classification_preserved state

example (state : Reference.State) :
    (PreNet.lts.SuccessfulTermination
        (PreNet.mapState state) ↔
      Reference.lts.SuccessfulTermination state) ∧
    (PreNet.lts.ExternalWait
        (PreNet.mapState state) ↔
      Reference.lts.ExternalWait state) ∧
    (PreNet.lts.Deadlocked
        (PreNet.mapState state) ↔
      Reference.lts.Deadlocked state) :=
  PreNet.reconfigurable_petri_certificate.terminal_classification_preserved
    state

example (state : Reference.State) :
    (Morphism.lts.SuccessfulTermination
        (Morphism.certificate.mapState state) ↔
      Reference.lts.SuccessfulTermination state) ∧
    (Morphism.lts.ExternalWait
        (Morphism.certificate.mapState state) ↔
      Reference.lts.ExternalWait state) ∧
    (Morphism.lts.Deadlocked
        (Morphism.certificate.mapState state) ↔
      Reference.lts.Deadlocked state) :=
  Morphism.certificate.terminal_classification_preserved state

end Cantilune.Tests.ProjectionCertificates
