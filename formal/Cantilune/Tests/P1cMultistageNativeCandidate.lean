import Cantilune.Pi.P1cMultistageNativeCandidate

/-!
# Regression checks for the multistage full-native P1c candidate
-/

namespace Cantilune.Tests.P1cMultistageNativeCandidate

open Cantilune.Core
open Cantilune.Pi
open Cantilune.Pi.P1cMultistageNativeCandidate

example :
    Late.NativeStep
      (mapState .sessionEstablished) .tau
      (mapState .payloadComplete) :=
  established_native

example {action : Raw.Action} {target : Raw.Proc}
    (step :
      Late.NativeStep (mapState .sessionEstablished) action target) :
    action = .tau ∧ target = mapState .payloadComplete :=
  established_native_exact step

example {source : State} {action : Raw.Action} {target : Raw.Proc}
    (step : Late.NativeStep (mapState source) action target) :
    ∃ event sourceTarget,
      Step source event sourceTarget ∧
        mapEvent event = action ∧ mapState sourceTarget = target :=
  native_reflect step

example : ProjectionCertificate sourceLTS targetLTS :=
  certificate

end Cantilune.Tests.P1cMultistageNativeCandidate
