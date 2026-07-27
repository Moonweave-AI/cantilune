import Cantilune.Pi.FMSFiniteSupportSeparation

/-!
Directed kernel checks for the finite-support PCM and separated tensor.
-/

open Cantilune.Pi.FMSFiniteSupportSeparation

#check SeparationAlgebra.compose_exists_iff
#check SeparationAlgebra.disjoint_of_compose
#check SeparationAlgebra.support_left_subset
#check SeparationAlgebra.support_right_subset
#check SeparationAlgebra.frameStep_supportMonotone
#check SeparationAlgebra.frame_law
#check FinsetPCM.delete_frame_law
#check SeparatedTensor.associator_pentagon
#check SeparatedTensor.unitor_triangle
#check SeparatedTensor.braiding_hexagon

/-- The concrete finite-support PCM is inhabited. -/
example :
    Nonempty (FinsetPCM.algebra (Fin 4)).Carrier :=
  inferInstance

/-- Two concrete PCMs have a nonempty separated tensor via their units. -/
example :
    Nonempty
      (SeparatedTensor
        (SupportedObject.ofSeparationAlgebra
          (FinsetPCM.algebra (Fin 4)))
        (SupportedObject.ofSeparationAlgebra
          (FinsetPCM.algebra (Fin 4)))) :=
  inferInstance

/-- Partial union is admitted for disjoint singleton supports. -/
example :
    FinsetPCM.Compose (Fin 4)
      {0} {1}
      (({0} : Finset (Fin 4)) ∪ {1}) := by
  simp [FinsetPCM.Compose]

/-- Partial union rejects an overlapping singleton support. -/
example :
    ¬ FinsetPCM.Compose (Fin 4)
      {0} {0} ({0} : Finset (Fin 4)) := by
  simp [FinsetPCM.Compose]

#print axioms SeparationAlgebra.frame_law
#print axioms FinsetPCM.algebra
#print axioms FinsetPCM.delete_frame_law
#print axioms SeparatedTensor.associator
#print axioms SeparatedTensor.associator_pentagon
#print axioms SeparatedTensor.unitor_triangle
#print axioms SeparatedTensor.braiding_hexagon
