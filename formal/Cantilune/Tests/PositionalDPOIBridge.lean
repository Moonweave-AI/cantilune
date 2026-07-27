import Cantilune.Core.PositionalDPOIBridge
import Cantilune.Tests.PresheafComplementDPO

/-!
# Finite positional / essential-image DPO bridge regression

The identity witness has every object literally in the encoding image.  It
therefore checks the full lift into the essential-image subcategory and the
transport back to an intrinsic finite positional DPO witness.
-/

namespace Cantilune.Tests.PositionalDPOIBridge

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Core
open Cantilune.Core.PositionalDPOIBridge
open Cantilune.Tests.PositionalDPOI
open Cantilune.Tests.PresheafComplementDPO

noncomputable def identityDPOWitness :
    DPO.Witness (𝟙 G) (𝟙 G) (𝟙 G) where
  complement := DPO.identityComplement G
  result :=
    { cocone :=
        PushoutCocone.mk (𝟙 G) (𝟙 G)
          (by simp [DPO.identityComplement])
      isPushout := IsPushout.of_id_snd.isColimit }

theorem graph_mem_positionalImage :
    (PositionalDPOI.encodingFunctor signature [] []).essImage G := by
  exact
    Functor.obj_mem_essImage
      (PositionalDPOI.encodingFunctor signature [] [])
      graph

theorem identityWitness_mem :
    WitnessInPositionalImage identityDPOWitness where
  interface_mem := graph_mem_positionalImage
  left_mem := graph_mem_positionalImage
  right_mem := graph_mem_positionalImage
  host_mem := graph_mem_positionalImage
  complement_mem := graph_mem_positionalImage
  result_mem := graph_mem_positionalImage

noncomputable example :
    LiftedWitnessType identityDPOWitness identityWitness_mem :=
  liftWitness identityDPOWitness identityWitness_mem

noncomputable example :
    Nonempty
      (FiniteWitnessType identityDPOWitness identityWitness_mem) :=
  finite_bridge_exists identityDPOWitness identityWitness_mem

example :
    ¬ (PositionalDPOI.encodingFunctor signature [] []).EssSurj := by
  letI : Nonempty signature.Obj :=
    ⟨Cantilune.Tests.PositionalDPOI.Obj.wire⟩
  exact
    encodingFunctor_not_essSurj
      (σ := signature) (inputTypes := []) (outputTypes := [])

end Cantilune.Tests.PositionalDPOIBridge
