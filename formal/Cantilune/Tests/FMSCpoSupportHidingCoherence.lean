import Cantilune.Pi.FMSCpoSupportHidingCoherence

/-!
Kernel-checked regressions for continuous allocation/support-hiding coherence.
-/

namespace Cantilune.Tests.FMSCpoSupportHidingCoherence

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoContext
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad
open Cantilune.Pi.FMSCpoWorld
open Cantilune.Pi.FMSCpoSupportHidingCoherence

example :
    allocate cpoAgent ≫ supportHiding = 𝟙 cpoAgent :=
  supportHiding_after_allocate

example (world : World) (process : SupportedProc world 0) :
    supportHiding.app world
        ((shift.map cpoSupportDenotation).app world
          ((allocate processCpoModel).app world process)) =
      cpoSupportDenotation.app world process :=
  processSupport_allocate_hide_app world process

example :
    allocate processCpoModel ≫
        shift.map cpoSupportDenotation ≫
        supportHiding =
      cpoSupportDenotation :=
  processSupport_allocate_hide

example :
    allocate poweredSupportModel ≫
        supportPowerHiding =
      𝟙 poweredSupportModel :=
  supportPowerHiding_after_allocate

example :
    shift.map
        (omegaScottWorldMonad.η.app supportModel) ≫
        supportPowerHiding =
      supportHiding ≫
        omegaScottWorldMonad.η.app supportModel :=
  supportPowerHiding_unit_coherence

example :
    shift.map
        (omegaScottWorldMonad.μ.app supportModel) ≫
        supportPowerHiding =
      Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.powerHiding
          supportPowerHiding ≫
        omegaScottWorldMonad.μ.app supportModel :=
  supportPowerHiding_multiplication_coherence

example :
    allocate processCpoModel ≫
        shift.map poweredSupportDenotation ≫
        supportPowerHiding =
      poweredSupportDenotation :=
  poweredProcessSupport_allocate_hide

#check supportPowerHiding_fubini_coherence

#print axioms supportPowerHiding_after_allocate
#print axioms supportPowerHiding_unit_coherence
#print axioms supportPowerHiding_multiplication_coherence
#print axioms supportPowerHiding_fubini_coherence
#print axioms poweredProcessSupport_allocate_hide

end Cantilune.Tests.FMSCpoSupportHidingCoherence
