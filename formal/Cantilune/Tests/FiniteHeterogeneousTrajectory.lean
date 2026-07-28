import Cantilune.Feedback.FiniteHeterogeneousTrajectory

/-!
# Regression checks for arbitrary finite heterogeneous event traces
-/

namespace Cantilune.Tests.FiniteHeterogeneousTrajectory

open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Pi.AdmissionCertificate
open Cantilune.Feedback.HeterogeneousAdmissionTrajectory.Reference
open Cantilune.Feedback.FiniteHeterogeneousTrajectory

example :
    ChainTraceAgreement epochChain :=
  complete_chain_trace_agreement epochChain

example :
    ChainPath ReferenceSignature.universes epochChain
      (ChainState.start epochChain)
      (traceEvents epochChain)
      (ChainState.finish epochChain) :=
  trace_path epochChain

example
    (event :
      ChainEvent ReferenceSignature.universes epochChain)
    (member : event ∈ traceEvents epochChain) :
    EventReplay ReferenceSignature.universes event :=
  trace_event_replay epochChain event member

example
    (event :
      ChainEvent ReferenceSignature.universes epochChain)
    (member : event ∈ traceEvents epochChain) :
    ExecutionEpochAligned ReferenceSignature.universes event :=
  trace_event_execution_epoch_aligned epochChain event member

end Cantilune.Tests.FiniteHeterogeneousTrajectory
