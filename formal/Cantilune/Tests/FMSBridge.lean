import Cantilune.Pi.FMSBridge

/-! Regression checks for the concrete OpenPi/support-model bridge. -/

namespace Cantilune.Tests.FMSBridge

open CategoryTheory
open Cantilune.Pi
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSBridge

def permissiveEnv : TypeEnv where
  sort _ := .data
  payload _ := .data

def zeroAtom : OpenSMC.Term permissiveEnv [] [] :=
  .atom [] [] .zero trivial

def parallelZero : OpenSMC.Term permissiveEnv [] [] :=
  .parallel zeroAtom zeroAtom

def namedEnv : TypeEnv where
  sort name := if name = 0 then .channel else .data
  payload _ := .data

def namedProcess : Proc :=
  .send { name := 0, payload := .data } 1 .zero

theorem namedProcess_typed :
    namedProcess.WellTyped namedEnv := by
  simp [namedProcess, namedEnv, Proc.WellTyped]

def namedAtom : OpenSMC.Term namedEnv [] [] :=
  .atom [] [] namedProcess namedProcess_typed

def worldTwo : supportModel.World := by
  change World
  exact 2

example (world : World) :
    supportModel.denote
        (ExternalFMS.OpenInterpretation.operationalRoute
          supportOpenInterpretation parallelZero)
        world =
      ExternalFMS.OpenInterpretation.denotationalRoute
        supportOpenInterpretation parallelZero world :=
  support_open_pi_commutes parallelZero world

example :
    supportModel.denote
        (ExternalFMS.OpenInterpretation.operationalRoute
          supportOpenInterpretation namedAtom)
        worldTwo =
      ExternalFMS.OpenInterpretation.denotationalRoute
        supportOpenInterpretation namedAtom worldTwo :=
  support_open_pi_commutes namedAtom (2 : World)

example :
    (1 : Fin 2) ∈ supportDenote namedProcess.erase 2 := by
  simp [supportDenote, namedProcess, Proc.erase, Raw.Proc.freeNames]

example :
    supportDenote (.par freeZeroProcess .zero) 2 =
      supportDenote freeZeroProcess 2 ∪ supportDenote .zero 2 :=
  supportDenote_par _ _ _

example
    {source target : World} (injection : source ⟶ target)
    (support : Set (Fin source)) :
    cpoAgent.map injection support =
      setAgent.map injection support :=
  set_cpo_world_action_agree injection support

example
    {source target : World} (injection : source ⟶ target)
    (left right : Set (Fin source)) :
    cpoAgent.map injection
        (show Set (Fin source) from left ∪ right) =
      setAgent.map injection left ∪ setAgent.map injection right :=
  set_cpo_parallel_natural injection left right

example :
    setAgent.map swapTwo (supportDenote freeZeroProcess 2) ≠
      supportDenote freeZeroProcess 2 :=
  fixed_nominal_denotation_not_natural

end Cantilune.Tests.FMSBridge
