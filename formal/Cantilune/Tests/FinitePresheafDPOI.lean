import Cantilune.Core.FinitePresheafDPOI
import Cantilune.Tests.OpenHypergraphDPOI

/-!
# Regression checks for the finite presheaf DPOI bridge

The deletion fixture has no inserted edges, so it satisfies the additional
`InterfaceLocal` condition.  The checks below elaborate both the contextual
host-indexed witness and the nondegenerate local-rule witness.
-/

namespace Cantilune.Tests.FinitePresheafDPOI

open Cantilune.Core
open Cantilune.Core.FinitePresheafDPOI
open Cantilune.Tests.OpenHypergraphDPOI

theorem deleteIsolated_interfaceLocal :
    View.InterfaceLocal deleteIsolated := by
  constructor <;> intro e he
  · simp [deleteIsolated] at he
  · simp [deleteIsolated] at he

example :
    Nonempty
      (AdhesiveDPOI.Derivation
        (View.Contextual.rule deleteIsolated)
        (View.Contextual.matching deleteIsolated)) :=
  View.Contextual.complement_exists deleteIsolated

example :
    Nonempty
      (AdhesiveDPOI.Derivation
        (View.Local.rule deleteIsolated deleteIsolated_interfaceLocal)
        (View.Local.matching deleteIsolated deleteIsolated_interfaceLocal)) :=
  View.Local.local_complement_exists
    deleteIsolated deleteIsolated_interfaceLocal

example :
    Nonempty
      ((View.wholeView deleteIsolated.complement).typed ≅
        (View.wholeView deleteIsolated.complement).typed) :=
  ⟨View.encodedComplementUniqueIso
    deleteIsolated
    deleteIsolated.complement_isComplement
    deleteIsolated.complement_isComplement⟩

end Cantilune.Tests.FinitePresheafDPOI
