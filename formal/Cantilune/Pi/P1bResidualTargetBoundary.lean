import Cantilune.Pi.P1bLinkedEndpointNormalization

/-!
# Exact-target boundary for the P1b requesting residual

The requesting reflection theorem must classify a native endpoint only up to
`Late.Struct`.  Requiring the native target itself to inhabit
`LinkedEndpointForm` is false: structural representatives may carry a
parallel-zero context through the native rule.

This file records the smallest concrete counterexample.  It uses one genuine
native step and no weak closure.
-/

namespace Cantilune.Pi.P1bResidualTargetBoundary

open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bLinkedCoreResidual
open Cantilune.Pi.P1bLinkedEndpointNormalization

/-- A structural requesting representative with one inert parallel sibling. -/
def zeroPaddedRequesting : Raw.Proc :=
  .par closedRestrictedHandshake.erase .zero

/-- Its exact native endpoint retains the inert sibling syntactically. -/
def zeroPaddedEstablished : Raw.Proc :=
  .par closedHandshakeResult.erase .zero

/-- The padded source is structurally the canonical requesting source. -/
theorem canonical_struct_zeroPaddedRequesting :
    Late.Struct closedRestrictedHandshake.erase zeroPaddedRequesting := by
  simpa [zeroPaddedRequesting] using
    (Late.Struct.symm
      (Late.Struct.parZero :
        Late.Struct
          (.par closedRestrictedHandshake.erase .zero)
          closedRestrictedHandshake.erase))

/-- The padded representative has one genuine native first handshake. -/
theorem zeroPaddedRequesting_native_tau :
    Late.NativeStep zeroPaddedRequesting .tau zeroPaddedEstablished := by
  apply Late.NativeStep.parLeft
  · simp [Raw.Action.boundNames, Raw.Proc.freeNames]
  · exact canonical_closed_requesting_native_tau

/-- The exact padded target still normalizes to the canonical established state. -/
theorem zeroPaddedEstablished_struct_canonical :
    Late.Struct zeroPaddedEstablished closedHandshakeResult.erase := by
  simpa [zeroPaddedEstablished] using
    (Late.Struct.parZero :
      Late.Struct
        (.par closedHandshakeResult.erase .zero)
        closedHandshakeResult.erase)

/-- Raw top-level restriction shape, deliberately not quotient-invariant. -/
def StartsWithRestriction : Raw.Proc → Prop
  | .new _ _ => True
  | _ => False

/-- Every exact linked endpoint constructor starts with a restriction. -/
theorem linkedEndpointForm_startsWithRestriction
    (form : LinkedEndpointForm incidence endpoint) :
    StartsWithRestriction endpoint := by
  cases form with
  | syncLeft restrictions order =>
      have lengths := order.length_eq
      cases restrictions with
      | nil => simp at lengths
      | cons binder rest =>
          simp [P1bRequestingNormalForm.wrapNews, StartsWithRestriction]
  | syncRight restrictions order =>
      have lengths := order.length_eq
      cases restrictions with
      | nil => simp at lengths
      | cons binder rest =>
          simp [P1bRequestingNormalForm.wrapNews, StartsWithRestriction]
  | closeLeft outer order =>
      have lengths := order.length_eq
      cases outer with
      | nil => simp at lengths
      | cons binder rest =>
          simp [P1bRequestingNormalForm.wrapNews, StartsWithRestriction]
  | closeRight outer order =>
      have lengths := order.length_eq
      cases outer with
      | nil => simp at lengths
      | cons binder rest =>
          simp [P1bRequestingNormalForm.wrapNews, StartsWithRestriction]
  | publicOnOutput =>
      simp [publicOnOutputEndpoint, StartsWithRestriction]
  | publicOnInput =>
      simp [publicOnInputEndpoint, StartsWithRestriction]
  | sessionOnly =>
      simp [StartsWithRestriction]

/--
No exact linked endpoint constructor has a top-level parallel-zero shape.
Consequently the final residual theorem must conclude target congruence to a
linked endpoint, not exact membership of the target syntax.
-/
theorem zeroPaddedEstablished_not_exact_linkedEndpoint
    (incidence : LinkedIncidence) :
    ¬ LinkedEndpointForm incidence zeroPaddedEstablished := by
  intro form
  have restricted := linkedEndpointForm_startsWithRestriction form
  simpa [zeroPaddedEstablished, StartsWithRestriction] using restricted

/--
The counterexample packages the required final theorem shape: a structural
source representative, a genuine native step, and a structurally canonical
target, while exact linked-endpoint membership fails.
-/
theorem exact_target_classification_is_too_strong :
    Late.Struct closedRestrictedHandshake.erase zeroPaddedRequesting ∧
      Late.NativeStep zeroPaddedRequesting .tau zeroPaddedEstablished ∧
      Late.Struct zeroPaddedEstablished closedHandshakeResult.erase ∧
      ∀ incidence, ¬ LinkedEndpointForm incidence zeroPaddedEstablished := by
  exact
    ⟨canonical_struct_zeroPaddedRequesting,
      zeroPaddedRequesting_native_tau,
      zeroPaddedEstablished_struct_canonical,
      zeroPaddedEstablished_not_exact_linkedEndpoint⟩

end Cantilune.Pi.P1bResidualTargetBoundary
