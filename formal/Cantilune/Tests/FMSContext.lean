import Cantilune.Pi.FMSContext

namespace Cantilune.Tests.FMSContext

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext

noncomputable section

open scoped Classical

def sample : SupportedProc 2 0 :=
  .parallel
    (.output (.free 0) (.free 1) .zero)
    (.restrict
      (.input (.free 0) (.matchEq (.bound 0) (.free 1) .zero)))

example :
    SupportedProc.freeSupport sample = {0, 1} := by
  simp [sample, SupportedProc.freeSupport, ScopedName.freeSupport]

def includeTwo : (2 : World) ⟶ 3 where
  toFun := fun name => Fin.castSucc name
  injective := Fin.castSucc_injective 2

example :
    SupportedProc.freeSupport
        (SupportedProc.renameFree (homToFun includeTwo) sample) =
      (SupportedProc.freeSupport sample).image (homToFun includeTwo) :=
  SupportedProc.freeSupport_renameFree _ _

example :
    finiteSupportModel.map includeTwo
        (finiteSupportNatural.app 2 sample) =
      finiteSupportNatural.app 3 (processModel.map includeTwo sample) :=
  by
    change
      (SupportedProc.freeSupport sample).image (homToFun includeTwo) =
        SupportedProc.freeSupport
          (SupportedProc.renameFree (homToFun includeTwo) sample)
    exact (SupportedProc.freeSupport_renameFree _ _).symm

example :
    supportDenotation.app 2 sample =
      ({0, 1} : Set (Fin 2)) := by
  rw [supportDenotation_app]
  ext name
  simp [sample, SupportedProc.freeSupport, ScopedName.freeSupport]

end

end Cantilune.Tests.FMSContext
