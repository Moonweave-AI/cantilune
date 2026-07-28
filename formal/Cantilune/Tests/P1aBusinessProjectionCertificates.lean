import Cantilune.Pi.P1aBusinessProjectionCertificates

/-! Regression checks for the replayable fixed-signature P1a bundle. -/

namespace Cantilune.Tests.P1aBusinessProjectionCertificates

open Cantilune.Core
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cBusinessReplayMatrix
open Cantilune.Pi.P1aBusinessProjectionCertificates

def signature : FinSignature where
  Obj := PUnit
  Gen := Empty
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := Empty.elim
  output := Empty.elim
  mode := fun _ => .linear
  contract := Empty.elim

def reconnect : BusinessEvent :=
  ⟨.instanceReconnect, by decide⟩

example :
    ReplayableCertificate signature :=
  replayableCertificate signature

example :
    DAG.lts.ObservableStep
        (.ready reconnect) reconnect (.completed reconnect) ∧
      Petri.lts.ObservableStep
        (.ready reconnect) reconnect (.completed reconnect) ∧
      Morphism.lts.ObservableStep
        (.ready reconnect) reconnect (.completed reconnect) :=
  every_business_event_native reconnect

example :
    Cantilune.Pi.P1cCompleteMatrix.DAG.Step
        (Cantilune.Pi.P1cCompleteMatrix.DAG.ready reconnect.1) reconnect.1
        (Cantilune.Pi.P1cCompleteMatrix.DAG.completed reconnect.1) ∧
      Cantilune.Pi.P1cCompleteMatrix.Petri.Step
        (Cantilune.Pi.P1cCompleteMatrix.Petri.ready reconnect.1) reconnect.1
        (Cantilune.Pi.P1cCompleteMatrix.Petri.completed reconnect.1) ∧
      Cantilune.Pi.P1cCompleteMatrix.Morphism.Step
        (.ready reconnect.1) reconnect.1 (.completed reconnect.1) :=
  every_business_event_matrix_native reconnect

example :
    ((ReferenceExecution.package signature).eventRecord reconnect).Replays
      ((ReferenceExecution.package signature).configOf (.ready reconnect))
      ((ReferenceExecution.package signature).configOf
        (.completed reconnect)) :=
  (replayableCertificate signature).replay reconnect

example :
    ((ReferenceExecution.package signature).eventRecord reconnect).event.ruleId =
      reconnect.ruleId :=
  replay_record_ruleId signature reconnect

example :
    ResourceProjectionCompatibility DAG.certificate :=
  dagResources signature

example :
    TerminalProjectionCompatibility Petri.certificate :=
  petriTerminals

example :
    Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
        operational.dag ∧
      Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
        operational.petri ∧
      Cantilune.Projection.GeneralP1a.Certificate.PathCoverage
        operational.morphism :=
  paths_lift_and_reflect_all

end Cantilune.Tests.P1aBusinessProjectionCertificates
