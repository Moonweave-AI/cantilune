import Cantilune.Pi.P1cCriticalMultistageCertificate

/-!
# Regression checks for the shared critical P1c full-native certificate
-/

namespace Cantilune.Tests.P1cCriticalMultistageCertificate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.P1cCriticalMultistageCertificate

example : ProjectionCertificate sourceLTS targetLTS :=
  certificate

example :
    Late.NativeStep
      (mapState .reconnectReady) .tau
      (mapState .reconnectDone) :=
  native_sound Step.reconnect

example :
    Late.NativeStep
      (mapState .sessionEstablished) .tau
      (mapState .payloadComplete) :=
  native_sound Step.transmitPayload

example {action : Raw.Action} {target : Raw.Proc}
    (step : Late.NativeStep (mapState .reconnectDone) action target) :
    False :=
  closed_reconnect_target_no_native step

example {source : State} {action : Raw.Action} {target : Raw.Proc}
    (step : Late.NativeStep (mapState source) action target) :
    ∃ event sourceTarget,
      Step source event sourceTarget ∧
        mapEvent event = action ∧ mapState sourceTarget = target :=
  native_reflect step

end Cantilune.Tests.P1cCriticalMultistageCertificate
