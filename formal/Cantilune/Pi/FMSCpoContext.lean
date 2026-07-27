import Cantilune.Pi.FMSCpoFinitePower
import Cantilune.Pi.FMSContext

/-!
# Supported process syntax in the actual category `ωCPO^I`

The locally nameless syntax functor is equality ordered, while its support
denotation lands in the subset-ordered support CPO.  This gives a genuine
nonconstant natural transformation in `ωCPO^I`; it remains a support
interpretation, not the FMS agent denotation.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoContext

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoFinitePower

/-- Equality-ordered supported syntax as an actual CPO-valued world functor. -/
def processCpoModel : World ⥤ ωCPO :=
  processModel ⋙ equalityCpoFunctor

/-- Equality-ordered finite supports as an actual CPO-valued world functor. -/
def finiteSupportCpoModel : World ⥤ ωCPO :=
  finiteSupportModel ⋙ equalityCpoFunctor

/-- Free-support extraction is a natural continuous transformation. -/
def finiteSupportCpoNatural :
    processCpoModel ⟶ finiteSupportCpoModel :=
  Functor.whiskerRight finiteSupportNatural equalityCpoFunctor

/--
The exact free-name support map into the existing subset-ordered CPO support
object.  Continuity follows from equality order on finite syntax.
-/
def cpoSupportDenotation : processCpoModel ⟶ cpoAgent where
  app world :=
    EqualityOrder.continuousTo fun process : SupportedProc world 0 =>
      (SupportedProc.freeSupport process : Set (Fin world))
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro process
    apply Set.ext
    intro value
    change
      value ∈
          (SupportedProc.freeSupport
            (SupportedProc.renameFree (homToFun injection) process) :
              Set (Fin target)) ↔
        value ∈
          homToFun injection ''
            (SupportedProc.freeSupport process : Set (Fin source))
    rw [SupportedProc.freeSupport_renameFree]
    simp

@[simp]
theorem cpoSupportDenotation_app (world : World)
    (process : SupportedProc world 0) :
    cpoSupportDenotation.app world process =
      (SupportedProc.freeSupport process : Set (Fin world)) :=
  rfl

end Cantilune.Pi.FMSCpoContext
