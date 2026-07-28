import Cantilune.Core.FreeSMCQuotient

/-!
# Free-SMC quotient regressions

These nonempty checks use a one-object, one-generator signature and exercise
category associativity, tensor interchange, symmetry naturality, and the
quotient universal property.
-/

namespace Cantilune.Tests.FreeSMCQuotient

open Cantilune.Core
open Cantilune.Core.FreeSMC
open Cantilune.Core.FreeSMCQuotient

def signature : FinSignature where
  Obj := Unit
  Gen := Unit
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun _ => [()]
  output := fun _ => [()]
  mode := fun _ => .cartesian
  contract := fun _ => {}

def generator : Raw signature [()] [()] :=
  .generator ()

def qGenerator : Hom signature [()] [()] :=
  ofRaw generator

example :
    (qGenerator ≫q id signature [()]) ≫q id signature [()] =
      qGenerator ≫q
        (id signature [()] ≫q id signature [()]) :=
  comp_assoc _ _ _

example :
    (qGenerator ≫q qGenerator) ⊗q
        (qGenerator ≫q qGenerator) =
      (qGenerator ⊗q qGenerator) ≫q
        (qGenerator ⊗q qGenerator) :=
  tensor_comp _ _ _ _

example :
    (qGenerator ⊗q qGenerator) ≫q
        symmetry signature [()] [()] =
      symmetry signature [()] [()] ≫q
        (qGenerator ⊗q qGenerator) :=
  symmetry_natural _ _

example :
    Nonempty
        (Interpreter (freeSymmetricMonoidalCategory signature)) ∧
      ∀ F G : Interpreter (freeSymmetricMonoidalCategory signature),
        F = G :=
  freeSMC_quotient_universal
    (freeSymmetricMonoidalCategory signature)

example :
    Nonempty
        (Interpreter (freeSymmetricMonoidalCategory signature)) ∧
      ∀ F G : Interpreter (freeSymmetricMonoidalCategory signature),
        Nonempty (CoherentMonoidalIso F G) :=
  freeSMC_quotient_universal_up_to_iso
    (freeSymmetricMonoidalCategory signature)

example :
    (quotientInterpreter (freeSymmetricMonoidalCategory signature)).map
        (ofRaw (generator ≫ₛ generator)) =
      FreeSMC.fold
        (freeSymmetricMonoidalCategory signature).algebra
        (generator ≫ₛ generator) :=
  quotient_interpretation_factors_raw_fold
    (freeSymmetricMonoidalCategory signature)
    (generator ≫ₛ generator)

end Cantilune.Tests.FreeSMCQuotient
