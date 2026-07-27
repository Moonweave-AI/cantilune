import Cantilune.Pi.P1cClosedNativeCertificate

/-!
Kernel-checked regressions for the closed internal P1c redesign.
-/

namespace Cantilune.Tests.P1cClosedNativeCertificate

open Cantilune.Pi
open Cantilune.Pi.P1cClosedNativeCertificate

example :
    Late.NativeStep closedCommunicationSource.erase .tau
      closedCommunicationTarget.erase :=
  closed_communication_native

example {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedCommunicationSource.erase action next) :
    action = .tau ∧ next = closedCommunicationTarget.erase :=
  closed_communication_native_exact step

example :
    Late.NativeStep closedOpenCloseSource.erase .tau
      closedOpenCloseTarget.erase :=
  closed_open_close_native

example {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedOpenCloseSource.erase action next) :
    action = .tau ∧ next = closedOpenCloseTarget.erase :=
  closed_open_close_native_exact step

example :
    Late.NativeStep closedOpenCloseTarget.erase .tau
      Protocols.closedCompletedProcess.erase :=
  closed_open_close_target_followup_native

example :
    Late.NativeStep closedReconnectSource.erase .tau
      closedReconnectTarget.erase :=
  closed_reconnect_native

example {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedReconnectSource.erase action next) :
    action = .tau ∧ next = closedReconnectTarget.erase :=
  closed_reconnect_native_exact step

example :
    Late.NativeStep closedQuiescentDeleteSource.erase .tau
      closedQuiescentDeleteTarget.erase :=
  closed_quiescent_delete_native

example {action : Raw.Action} {next : Raw.Proc}
    (step :
      Late.NativeStep closedQuiescentDeleteSource.erase action next) :
    action = .tau ∧ next = closedQuiescentDeleteTarget.erase :=
  closed_quiescent_delete_native_exact step

example (event : ClosedInternalEvent) :
    Late.NativeStep (source event) .tau (target event) :=
  native event

example (event : ClosedInternalEvent)
    {action : Raw.Action} {next : Raw.Proc}
    (step : Late.NativeStep (source event) action next) :
    action = .tau ∧ next = target event :=
  native_exact event step

example :
    ¬ ∃ certificate :
        Cantilune.Core.ProjectionCertificate
          P1cMatrix.sourceLTS ClosedFullNativeTarget.lts,
        ∀ state,
          certificate.mapState state =
            ClosedFullNativeTarget.mapState state :=
  ClosedFullNativeTarget.no_event_isolated_projection_certificate

end Cantilune.Tests.P1cClosedNativeCertificate
