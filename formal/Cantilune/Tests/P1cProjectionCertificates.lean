import Cantilune.Pi.P1cProjectionCertificates

namespace Cantilune.Tests.P1cProjectionCertificates

open Cantilune.Core
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cProjectionCertificates

example :
    ProjectionCertificate sourceLTS DAG.lts :=
  p1c_operational_certificates.dag

example :
    ProjectionCertificate sourceLTS Petri.lts :=
  p1c_operational_certificates.petri

example :
    ProjectionCertificate sourceLTS PiTarget.lts :=
  p1c_operational_certificates.pi

example :
    ProjectionCertificate sourceLTS Morphism.lts :=
  p1c_operational_certificates.morphism

example (event : SourceEvent) :
    PiTarget.lts.ObservableStep
      (.ready event)
      (PiTarget.mapEvent event)
      (.completed event) :=
  PiTarget.certificate.sound (source_event_observable event)

example (event : SourceEvent) :
    Cantilune.Pi.Late.Step
      (PiTarget.process (.ready event)).erase
      (PiTarget.mapEvent event).2.erase
      (PiTarget.process (.completed event)).erase :=
  PiTarget.step_standard_late
    (PiTarget.Step.execute event
      (piReferenceDerivation event).nativeStep)

example (event : SourceEvent) :
    Cantilune.Pi.Late.NativeStep
      (PiTarget.process (.ready event)).erase
      (PiTarget.mapEvent event).2.erase
      (PiTarget.process (.completed event)).erase :=
  PiTarget.step_standard_late_native
    (PiTarget.Step.execute event
      (piReferenceDerivation event).nativeStep)

example :
    ∀ {source target : SourceState} {events : List SourceEvent},
      sourceLTS.Path source events target ->
        DAG.lts.Path
          (DAG.certificate.mapState source)
          (events.map DAG.certificate.mapEvent)
          (DAG.certificate.mapState target) :=
  DAG.certificate.projection_paths_lift_and_reflect.1

end Cantilune.Tests.P1cProjectionCertificates
