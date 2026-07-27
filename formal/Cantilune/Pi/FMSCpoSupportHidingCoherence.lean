import Cantilune.Pi.FMSCpoContext
import Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence
import Cantilune.Pi.FMSCpoWorld

/-!
# Coherence of allocation and support hiding in `ωCPO^I`

The internally mechanized support object has a genuine continuous allocation
map and a genuine continuous hiding map.  This module proves the strongest
coherence available for those concrete maps:

* hiding after allocating an old support is the identity; and
* supported-process denotation commutes with allocate-then-hide.

These are natural-transformation equalities in the actual functor category
`World ⥤ ωCPO`.  They concern finite name support only; they do not construct
the FMS agent restriction operator or an Abramsky powerdomain.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoSupportHidingCoherence

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoContext
open Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad
open Cantilune.Pi.FMSCpoWorld

/--
On the concrete support object, hiding is a retraction of allocation.

Both sides are morphisms in `ωCPO^I`; the proof uses injectivity of the
standard finite-world inclusion rather than equality-order discreteness.
-/
theorem supportHiding_after_allocate :
    allocate cpoAgent ≫ supportHiding = 𝟙 cpoAgent := by
  ext world support
  apply Set.ext
  intro value
  constructor
  · rintro ⟨source, sourceMember, endpoint⟩
    have sourceEq : source = value :=
      Fin.castSucc_injective world endpoint
    simpa [sourceEq] using sourceMember
  · intro member
    exact ⟨value, member, rfl⟩

/--
Component form of the support-denotation coherence.  Allocating the free
names of a supported process, taking its continuous support denotation in the
extended world, and hiding the distinguished fresh coordinate recovers the
original denotation exactly.
-/
theorem processSupport_allocate_hide_app
    (world : World) (process : SupportedProc world 0) :
    supportHiding.app world
        ((shift.map cpoSupportDenotation).app world
          ((allocate processCpoModel).app world process)) =
      cpoSupportDenotation.app world process := by
  apply Set.ext
  intro value
  change
    Fin.castSucc value ∈
        (SupportedProc.freeSupport
          (SupportedProc.renameFree Fin.castSucc process) :
            Set (Fin (world + 1))) ↔
      value ∈
        (SupportedProc.freeSupport process : Set (Fin world))
  rw [SupportedProc.freeSupport_renameFree]
  simp

/--
Allocate-then-denote-then-hide commutes as one equality of continuous natural
transformations in `ωCPO^I`.
-/
theorem processSupport_allocate_hide :
    allocate processCpoModel ≫
        shift.map cpoSupportDenotation ≫
        supportHiding =
      cpoSupportDenotation := by
  ext world process
  exact processSupport_allocate_hide_app world process

/-! ## Actual omega-Scott power of support hiding -/

/--
The concrete support hiding map lifted through the actual unseparated
omega-Scott world monad.
-/
def supportPowerHiding :
    shift.obj poweredSupportModel ⟶ poweredSupportModel :=
  powerHiding supportHiding

@[simp]
theorem supportPowerHiding_app
    (world : World)
    (values :
      OmegaScottPower (supportModel.obj (world + 1))) :
    supportPowerHiding.app world values =
      mapRaw (supportHiding.app world) values :=
  rfl

/-- Powered support hiding remains a retraction of powered allocation. -/
theorem supportPowerHiding_after_allocate :
    allocate poweredSupportModel ≫
        supportPowerHiding =
      𝟙 poweredSupportModel := by
  exact
    powerHiding_after_allocate
      supportHiding supportHiding_after_allocate

/-- Support hiding commutes with the actual pointwise omega-Scott unit. -/
theorem supportPowerHiding_unit_coherence :
    shift.map
        (omegaScottWorldMonad.η.app supportModel) ≫
        supportPowerHiding =
      supportHiding ≫
        omegaScottWorldMonad.η.app supportModel :=
  powerHiding_unit_coherence supportHiding

/--
Support hiding commutes with the actual pointwise omega-Scott
multiplication.
-/
theorem supportPowerHiding_multiplication_coherence :
    shift.map
        (omegaScottWorldMonad.μ.app supportModel) ≫
        supportPowerHiding =
      powerHiding supportPowerHiding ≫
        omegaScottWorldMonad.μ.app supportModel := by
  simpa only
      [supportPowerHiding, supportModel, poweredSupportModel] using
    powerHiding_multiplication_coherence supportHiding

/--
Hiding both powered support inputs commutes with the actual pointwise Fubini
map, including the explicit delta/power comparisons.
-/
theorem supportPowerHiding_fubini_coherence :
    pointwiseProductMap
        supportPowerHiding supportPowerHiding ≫
        pointwiseFubini supportModel supportModel =
      pointwiseProductMap
          (shiftPowerIso.hom.app supportModel)
          (shiftPowerIso.hom.app supportModel) ≫
        pointwiseFubini
          (shift.obj supportModel)
          (shift.obj supportModel) ≫
        omegaScottWorldPower.map
          (pointwiseProductMap supportHiding supportHiding) := by
  simpa only
      [supportPowerHiding, supportModel, poweredSupportModel] using
    powerHiding_pointwiseFubini_coherence
      supportHiding supportHiding

/--
The process-support denotation embedded by the monad unit is a genuine
effectful denotation into the powered support model.
-/
def poweredSupportDenotation :
    processCpoModel ⟶ poweredSupportModel :=
  cpoSupportDenotation ≫
    omegaScottWorldMonad.η.app supportModel

/--
Allocating a process, taking its powered support denotation one world later,
and applying powered support hiding recovers the original powered
denotation.
-/
theorem poweredProcessSupport_allocate_hide :
    allocate processCpoModel ≫
        shift.map poweredSupportDenotation ≫
        supportPowerHiding =
      poweredSupportDenotation := by
  ext world process
  change
    mapRaw (supportHiding.app world)
        (principalRaw
          ((shift.map cpoSupportDenotation).app world
            ((allocate processCpoModel).app world process))) =
      principalRaw
        (cpoSupportDenotation.app world process)
  rw [mapRaw_principal]
  exact
    congrArg principalRaw
      (processSupport_allocate_hide_app world process)

end Cantilune.Pi.FMSCpoSupportHidingCoherence
