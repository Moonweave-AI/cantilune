import Mathlib
import Cantilune.Core.Projection
import Cantilune.Projection.Reference

/-!
# Identity morphism projection

The morphism view is the total-category identity view of the finite reference
execution.  It changes neither native events nor terminal observations.
-/

namespace Cantilune.Projection.Morphism

open Cantilune.Core

/-- The independently named target view is definitionally the reference LTS. -/
def lts : ObservableLTS :=
  Reference.lts

def certificate : ProjectionCertificate Reference.lts lts where
  mapState := id
  mapEvent := id
  Lift := Eq
  lift_chosen := by
    intro event
    rfl
  map_equiv := by
    intro source target h
    exact h
  sound := by
    intro source event target transition
    exact transition
  reflect := by
    intro source event target transition
    exact ⟨event, target, transition, rfl, rfl⟩
  success_iff := by
    intro state
    rfl
  waiting_iff := by
    intro state
    rfl
  signatureVersion_preserved := by
    intro state
    rfl

theorem install_identity_step :
    lts.ObservableStep
      (certificate.mapState .empty)
      (certificate.mapEvent .install)
      (certificate.mapState .installed) :=
  certificate.sound Reference.install_observable

theorem execute_identity_step :
    lts.ObservableStep
      (certificate.mapState .installed)
      (certificate.mapEvent .execute)
      (certificate.mapState .finished) :=
  certificate.sound Reference.execute_observable

theorem terminal_certificate (state : Reference.State) :
    (lts.SuccessfulTermination (certificate.mapState state) ↔
      Reference.lts.SuccessfulTermination state) ∧
    (lts.ExternalWait (certificate.mapState state) ↔
      Reference.lts.ExternalWait state) ∧
    (lts.Deadlocked (certificate.mapState state) ↔
      Reference.lts.Deadlocked state) :=
  certificate.terminal_classification_preserved state

end Cantilune.Projection.Morphism
