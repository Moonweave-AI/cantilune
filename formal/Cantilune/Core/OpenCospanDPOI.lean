import Cantilune.Core.DPOConcurrency

/-!
# Boundary-preserving open-cospan DPOI rewriting

This file supplies the categorical boundary layer which is deliberately
separate from the existence of a pushout complement.

* `OpenCospan I O` is the category of typed open states with fixed input and
  output objects and monic boundary legs.
* `BoundaryLift` is the exact DPOI boundary condition: both boundary legs of
  the host factor through the retained complement.  It is evidence, rather
  than an automatic consequence of the ordinary DPO gluing condition.
* A boundary lift canonically turns the complement and result of a DPO
  derivation into open cospans and both DPO context maps into
  boundary-preserving morphisms.
* For incidence presheaves, every monic match satisfying the explicit gluing
  condition has a canonical full DPO derivation: the complement is the
  retained-subpresheaf construction and the result is the adhesive pushout.
* Standard parallel independence, together with retention of the boundary in
  the joint context, yields a canonical isomorphism of open sequential
  results.  Thus the existing DPO concurrency isomorphism preserves the whole
  input/output interface, not merely the two rule right-hand sides.

No theorem below claims that every monic match admits a complement, nor that
an ordinary gluing condition prevents deletion of a distinguished open
boundary.  Those are separate and explicit obligations.
-/

namespace Cantilune.Core.OpenCospanDPOI

open CategoryTheory
open CategoryTheory.Limits

universe u v

/-! ## The fixed-boundary open-cospan category -/

section OpenCospan

variable {C : Type u} [Category.{v} C]

/--
An open object with fixed input object `I` and output object `O`.

Fixing the feet is the usual category in which a DPOI rewrite takes place:
objects are cospans `I ⟶ G ⟵ O`, and arrows commute with both legs.
-/
structure OpenCospan (I O : C) where
  apex : C
  inputLeg : I ⟶ apex
  outputLeg : O ⟶ apex
  input_mono : Mono inputLeg
  output_mono : Mono outputLeg

/-- A map of open cospans which is the identity on the fixed boundary. -/
structure BoundaryHom {I O : C} (G H : OpenCospan I O) where
  apex : G.apex ⟶ H.apex
  input_comm : G.inputLeg ≫ apex = H.inputLeg
  output_comm : G.outputLeg ≫ apex = H.outputLeg

@[ext]
theorem BoundaryHom.ext {I O : C} {G H : OpenCospan I O}
    {f g : BoundaryHom G H} (h : f.apex = g.apex) : f = g := by
  cases f
  cases g
  cases h
  rfl

/-- Identity boundary-preserving map. -/
def BoundaryHom.id {I O : C} (G : OpenCospan I O) :
    BoundaryHom G G where
  apex := 𝟙 G.apex
  input_comm := by simp
  output_comm := by simp

/-- Composition of boundary-preserving maps. -/
def BoundaryHom.comp {I O : C} {G H K : OpenCospan I O}
    (f : BoundaryHom G H) (g : BoundaryHom H K) :
    BoundaryHom G K where
  apex := f.apex ≫ g.apex
  input_comm := by
    simpa only [← Category.assoc, f.input_comm] using g.input_comm
  output_comm := by
    simpa only [← Category.assoc, f.output_comm] using g.output_comm

/-- Open cospans over a fixed boundary and boundary-preserving maps form a category. -/
instance openCospanCategory (I O : C) : Category (OpenCospan I O) where
  Hom := BoundaryHom
  id := BoundaryHom.id
  comp := BoundaryHom.comp
  id_comp := by
    intro G H f
    ext
    simp [BoundaryHom.comp, BoundaryHom.id]
  comp_id := by
    intro G H f
    ext
    simp [BoundaryHom.comp, BoundaryHom.id]
  assoc := by
    intro A B D E f g h
    ext
    simp [BoundaryHom.comp, Category.assoc]

@[simp]
theorem category_hom_apex {I O : C} {G H : OpenCospan I O}
    (f : G ⟶ H) :
    (f : BoundaryHom G H).apex = f.apex :=
  rfl

/-- Forget the fixed boundary and retain the map of apexes. -/
def apexFunctor (I O : C) : OpenCospan I O ⥤ C where
  obj G := G.apex
  map f := f.apex
  map_id _ := rfl
  map_comp _ _ := rfl

instance apexFunctor_faithful (I O : C) :
    (apexFunctor I O).Faithful where
  map_injective := by
    intro G H f g h
    exact BoundaryHom.ext h

/-- Package the pre-existing open typed-hypergraph record as a fixed-boundary cospan. -/
def ofOpenTypedHypergraph
    {Shape : Type u} [Category.{v} Shape]
    {T : AdhesiveDPOI.HypergraphPresheaf Shape}
    (G : AdhesiveDPOI.OpenTypedHypergraph T) :
    OpenCospan G.input G.output where
  apex := G.apex
  inputLeg := G.inputLeg
  outputLeg := G.outputLeg
  input_mono := G.input_mono
  output_mono := G.output_mono

end OpenCospan

/-! ## Boundary lifts through one DPO derivation -/

section BoundaryLift

variable {Shape : Type u} [Category.{v} Shape]
variable {T : AdhesiveDPOI.HypergraphPresheaf Shape}
variable {I O : AdhesiveDPOI.TypedHypergraph T}
variable {rule : AdhesiveDPOI.Rule T}
variable {hostOpen : OpenCospan I O}
variable {matching : AdhesiveDPOI.Match rule hostOpen.apex}

/--
The exact open-boundary condition for a DPO derivation.

Both distinguished host boundary legs must factor through the retained
complement.  Monicity of the lifts follows from monicity of the original
boundary legs, so it is proved rather than included as extra data.
-/
structure BoundaryLift
    (derivation : AdhesiveDPOI.Derivation rule matching) where
  inputToComplement : I ⟶ derivation.complement
  outputToComplement : O ⟶ derivation.complement
  input_factor :
    inputToComplement ≫ derivation.complementToHost = hostOpen.inputLeg
  output_factor :
    outputToComplement ≫ derivation.complementToHost = hostOpen.outputLeg

namespace BoundaryLift

variable {derivation : AdhesiveDPOI.Derivation rule matching}
    (boundary : BoundaryLift (hostOpen := hostOpen) derivation)

theorem inputToComplement_mono :
    Mono boundary.inputToComplement := by
  letI : Mono hostOpen.inputLeg := hostOpen.input_mono
  exact mono_of_mono_fac boundary.input_factor

theorem outputToComplement_mono :
    Mono boundary.outputToComplement := by
  letI : Mono hostOpen.outputLeg := hostOpen.output_mono
  exact mono_of_mono_fac boundary.output_factor

/-- The retained complement as an open cospan over the unchanged boundary. -/
def complementOpen : OpenCospan I O where
  apex := derivation.complement
  inputLeg := boundary.inputToComplement
  outputLeg := boundary.outputToComplement
  input_mono := boundary.inputToComplement_mono
  output_mono := boundary.outputToComplement_mono

/-- The complement inclusion is a boundary-preserving open-cospan map. -/
def complementToHostOpen :
    boundary.complementOpen ⟶ hostOpen where
  apex := derivation.complementToHost
  input_comm := boundary.input_factor
  output_comm := boundary.output_factor

/-- The retained context embeds monomorphically into the DPO result. -/
theorem complementToResult_mono :
    Mono derivation.complementToResult := by
  letI : Mono rule.rightLeg := rule.right_mono
  exact
    Adhesive.mono_of_isPushout_of_mono_left derivation.resultSquare

/-- The DPO result with exactly the same fixed input and output boundary. -/
def resultOpen : OpenCospan I O where
  apex := derivation.result
  inputLeg := boundary.inputToComplement ≫ derivation.complementToResult
  outputLeg := boundary.outputToComplement ≫ derivation.complementToResult
  input_mono := by
    letI : Mono boundary.inputToComplement :=
      boundary.inputToComplement_mono
    letI : Mono derivation.complementToResult :=
      complementToResult_mono (derivation := derivation)
    infer_instance
  output_mono := by
    letI : Mono boundary.outputToComplement :=
      boundary.outputToComplement_mono
    letI : Mono derivation.complementToResult :=
      complementToResult_mono (derivation := derivation)
    infer_instance

/-- The second DPO context leg is boundary-preserving. -/
def complementToResultOpen :
    boundary.complementOpen ⟶ boundary.resultOpen where
  apex := derivation.complementToResult
  input_comm := rfl
  output_comm := rfl

/--
The lift of an input boundary is unique whenever it exists: the complement
inclusion is monic in an adhesive category.
-/
theorem input_lift_unique
    (other : I ⟶ derivation.complement)
    (hother :
      other ≫ derivation.complementToHost = hostOpen.inputLeg) :
    other = boundary.inputToComplement := by
  letI : Mono rule.leftLeg := rule.left_mono
  letI : Mono derivation.complementToHost :=
    Adhesive.mono_of_isPushout_of_mono_left derivation.complementSquare
  apply (cancel_mono derivation.complementToHost).1
  exact hother.trans boundary.input_factor.symm

/-- The output boundary lift is unique for the same reason. -/
theorem output_lift_unique
    (other : O ⟶ derivation.complement)
    (hother :
      other ≫ derivation.complementToHost = hostOpen.outputLeg) :
    other = boundary.outputToComplement := by
  letI : Mono rule.leftLeg := rule.left_mono
  letI : Mono derivation.complementToHost :=
    Adhesive.mono_of_isPushout_of_mono_left derivation.complementSquare
  apply (cancel_mono derivation.complementToHost).1
  exact hother.trans boundary.output_factor.symm

end BoundaryLift

end BoundaryLift

/-! ## Canonical arbitrary-monic incidence-presheaf derivations -/

namespace Presheaf

open Cantilune.Core.FinitePresheafDPOI

variable
  {T : AdhesiveDPOI.HypergraphPresheaf IncidenceShape}
  {rule : AdhesiveDPOI.Rule T}
  {host : AdhesiveDPOI.TypedHypergraph T}
  {matching : AdhesiveDPOI.Match rule host}

/--
The canonical complete DPO derivation for an arbitrary monic incidence-
presheaf match satisfying gluing.

The first square is the explicit retained-subpresheaf complement.  The second
square is the pushout supplied by adhesivity along the monic right rule leg.
-/
noncomputable def canonicalDerivation
    (legal :
      PresheafComplementDPO.Presheaf.LegalMatch rule matching) :
    AdhesiveDPOI.Derivation rule matching := by
  letI : Mono rule.rightLeg := rule.right_mono
  exact
    { complement :=
        PresheafComplementDPO.Presheaf.complement legal
      result :=
        pushout rule.rightLeg
          (PresheafComplementDPO.Presheaf.interfaceToComplement legal)
      interfaceToComplement :=
        PresheafComplementDPO.Presheaf.interfaceToComplement legal
      complementToHost :=
        PresheafComplementDPO.Presheaf.complementToHost legal
      rightToResult :=
        pushout.inl rule.rightLeg
          (PresheafComplementDPO.Presheaf.interfaceToComplement legal)
      complementToResult :=
        pushout.inr rule.rightLeg
          (PresheafComplementDPO.Presheaf.interfaceToComplement legal)
      complementSquare :=
        PresheafComplementDPO.Presheaf.typed_isPushout legal
      resultSquare := IsPushout.of_hasPushout _ _ }

theorem canonicalDerivation_complement_is_canonical
    (legal :
      PresheafComplementDPO.Presheaf.LegalMatch rule matching) :
    (canonicalDerivation legal).complement =
      PresheafComplementDPO.Presheaf.complement legal :=
  rfl

theorem arbitrary_monic_gluing_has_derivation
    (legal :
      PresheafComplementDPO.Presheaf.LegalMatch rule matching) :
    Nonempty (AdhesiveDPOI.Derivation rule matching) :=
  ⟨canonicalDerivation legal⟩

/--
Exact existence statement: an arbitrary monic match has a canonical DPO
derivation precisely after the ordinary gluing obligation has been supplied.
An open rewrite additionally requires a `BoundaryLift`.
-/
theorem arbitrary_monic_gluing_has_open_result
    {I O : AdhesiveDPOI.TypedHypergraph T}
    (hostOpen : OpenCospan I O)
    {openMatching : AdhesiveDPOI.Match rule hostOpen.apex}
    (legal :
      PresheafComplementDPO.Presheaf.LegalMatch rule openMatching)
    (boundary :
      BoundaryLift
        (hostOpen := hostOpen)
        (canonicalDerivation legal)) :
    Nonempty (OpenCospan I O) :=
  ⟨boundary.resultOpen⟩

end Presheaf

/-! ## Open-boundary preservation by DPO concurrency -/

section Concurrency

variable {Shape : Type u} [Category.{v} Shape]
variable {T : AdhesiveDPOI.HypergraphPresheaf Shape}
variable {I O : AdhesiveDPOI.TypedHypergraph T}
variable {rule₁ rule₂ : AdhesiveDPOI.Rule T}
variable {hostOpen : OpenCospan I O}
variable {matching₁ : AdhesiveDPOI.Match rule₁ hostOpen.apex}
variable {matching₂ : AdhesiveDPOI.Match rule₂ hostOpen.apex}
variable {first : AdhesiveDPOI.Derivation rule₁ matching₁}
variable {second : AdhesiveDPOI.Derivation rule₂ matching₂}

namespace ConcurrencyBoundary

variable
  {independent :
    DPOConcurrency.ParallelIndependent first second}

/--
Both open boundaries survive in the joint context retained by two
parallel-independent derivations.

Factoring through the first context is sufficient; the pullback equation
proves the corresponding factorisation through the second context.
-/
structure JointBoundary where
  inputToJoint : I ⟶ independent.JointContext
  outputToJoint : O ⟶ independent.JointContext
  input_factor :
    (inputToJoint ≫ independent.jointToFirst) ≫
        first.complementToHost =
      hostOpen.inputLeg
  output_factor :
    (outputToJoint ≫ independent.jointToFirst) ≫
        first.complementToHost =
      hostOpen.outputLeg

namespace JointBoundary

variable
  (boundary :
    JointBoundary (hostOpen := hostOpen) (independent := independent))

theorem input_factor_second :
    (boundary.inputToJoint ≫ independent.jointToSecond) ≫
        second.complementToHost =
      hostOpen.inputLeg := by
  calc
    (boundary.inputToJoint ≫ independent.jointToSecond) ≫
          second.complementToHost =
        (boundary.inputToJoint ≫ independent.jointToFirst) ≫
          first.complementToHost := by
            simpa only [Category.assoc] using
              congrArg (fun z => boundary.inputToJoint ≫ z)
                (pullback.condition :
                  independent.jointToFirst ≫ first.complementToHost =
                    independent.jointToSecond ≫
                      second.complementToHost).symm
    _ = hostOpen.inputLeg := boundary.input_factor

theorem output_factor_second :
    (boundary.outputToJoint ≫ independent.jointToSecond) ≫
        second.complementToHost =
      hostOpen.outputLeg := by
  calc
    (boundary.outputToJoint ≫ independent.jointToSecond) ≫
          second.complementToHost =
        (boundary.outputToJoint ≫ independent.jointToFirst) ≫
          first.complementToHost := by
            simpa only [Category.assoc] using
              congrArg (fun z => boundary.outputToJoint ≫ z)
                (pullback.condition :
                  independent.jointToFirst ≫ first.complementToHost =
                    independent.jointToSecond ≫
                      second.complementToHost).symm
    _ = hostOpen.outputLeg := boundary.output_factor

theorem inputToJoint_mono :
    Mono boundary.inputToJoint := by
  letI : Mono hostOpen.inputLeg := hostOpen.input_mono
  have hfac :
      boundary.inputToJoint ≫
          (independent.jointToFirst ≫ first.complementToHost) =
        hostOpen.inputLeg := by
    simpa only [Category.assoc] using boundary.input_factor
  exact mono_of_mono_fac hfac

theorem outputToJoint_mono :
    Mono boundary.outputToJoint := by
  letI : Mono hostOpen.outputLeg := hostOpen.output_mono
  have hfac :
      boundary.outputToJoint ≫
          (independent.jointToFirst ≫ first.complementToHost) =
        hostOpen.outputLeg := by
    simpa only [Category.assoc] using boundary.output_factor
  exact mono_of_mono_fac hfac

/-- The joint boundary induces the boundary lift for the first derivation. -/
noncomputable def firstBoundaryLift :
    BoundaryLift (hostOpen := hostOpen) first where
  inputToComplement :=
    boundary.inputToJoint ≫ independent.jointToFirst
  outputToComplement :=
    boundary.outputToJoint ≫ independent.jointToFirst
  input_factor := boundary.input_factor
  output_factor := boundary.output_factor

/-- The same joint boundary induces the boundary lift for the second derivation. -/
noncomputable def secondBoundaryLift :
    BoundaryLift (hostOpen := hostOpen) second where
  inputToComplement :=
    boundary.inputToJoint ≫ independent.jointToSecond
  outputToComplement :=
    boundary.outputToJoint ≫ independent.jointToSecond
  input_factor := boundary.input_factor_second
  output_factor := boundary.output_factor_second

theorem jointToSecondResidualContext_mono :
    Mono independent.jointToSecondResidualContext := by
  letI : Mono rule₁.rightLeg := rule₁.right_mono
  exact
    Adhesive.mono_of_isPushout_of_mono_left
      independent.second_residual_context_square

theorem secondResidualContextToFirstAfterSecondResult_mono :
    Mono independent.secondResidualContextToFirstAfterSecondResult := by
  letI : Mono rule₂.rightLeg := rule₂.right_mono
  exact
    Adhesive.mono_of_isPushout_of_mono_left
      independent.first_after_second_is_second_pushout

theorem secondAfterFirst_complementToResult_mono :
    Mono independent.secondAfterFirst.complementToResult := by
  letI : Mono rule₂.rightLeg := rule₂.right_mono
  exact
    Adhesive.mono_of_isPushout_of_mono_left
      independent.secondAfterFirst.resultSquare

/--
The sequential result “second, then first” with the original boundary
transported through the joint and second-residual contexts.
-/
noncomputable def firstAfterSecondOpen : OpenCospan I O where
  apex := independent.firstAfterSecond.result
  inputLeg :=
    (boundary.inputToJoint ≫ independent.jointToSecondResidualContext) ≫
      independent.secondResidualContextToFirstAfterSecondResult
  outputLeg :=
    (boundary.outputToJoint ≫ independent.jointToSecondResidualContext) ≫
      independent.secondResidualContextToFirstAfterSecondResult
  input_mono := by
    exact
      mono_comp'
        (mono_comp'
          boundary.inputToJoint_mono
          (jointToSecondResidualContext_mono
            (independent := independent)))
        (secondResidualContextToFirstAfterSecondResult_mono
          (independent := independent))
  output_mono := by
    exact
      mono_comp'
        (mono_comp'
          boundary.outputToJoint_mono
          (jointToSecondResidualContext_mono
            (independent := independent)))
        (secondResidualContextToFirstAfterSecondResult_mono
          (independent := independent))

/--
The sequential result “first, then second” with that same original boundary.
-/
noncomputable def secondAfterFirstOpen : OpenCospan I O where
  apex := independent.secondAfterFirst.result
  inputLeg :=
    (boundary.inputToJoint ≫ independent.jointToSecondResidualContext) ≫
      independent.secondAfterFirst.complementToResult
  outputLeg :=
    (boundary.outputToJoint ≫ independent.jointToSecondResidualContext) ≫
      independent.secondAfterFirst.complementToResult
  input_mono := by
    exact
      mono_comp'
        (mono_comp'
          boundary.inputToJoint_mono
          (jointToSecondResidualContext_mono
            (independent := independent)))
        (secondAfterFirst_complementToResult_mono
          (independent := independent))
  output_mono := by
    exact
      mono_comp'
        (mono_comp'
          boundary.outputToJoint_mono
          (jointToSecondResidualContext_mono
            (independent := independent)))
        (secondAfterFirst_complementToResult_mono
          (independent := independent))

/-- The categorical concurrency map is a map of open cospans. -/
noncomputable def concurrencyOpenHom :
    boundary.firstAfterSecondOpen ⟶
      boundary.secondAfterFirstOpen where
  apex := independent.concurrencyIso.hom
  input_comm := by
    simpa only [firstAfterSecondOpen, secondAfterFirstOpen,
        Category.assoc] using
      congrArg
        (fun z =>
          (boundary.inputToJoint ≫
            independent.jointToSecondResidualContext) ≫ z)
        independent.concurrencyIso_secondContext
  output_comm := by
    simpa only [firstAfterSecondOpen, secondAfterFirstOpen,
        Category.assoc] using
      congrArg
        (fun z =>
          (boundary.outputToJoint ≫
            independent.jointToSecondResidualContext) ≫ z)
        independent.concurrencyIso_secondContext

/-- The inverse concurrency map also preserves both boundary legs. -/
noncomputable def concurrencyOpenInv :
    boundary.secondAfterFirstOpen ⟶
      boundary.firstAfterSecondOpen where
  apex := independent.concurrencyIso.inv
  input_comm := by
    rw [← (boundary.concurrencyOpenHom).input_comm]
    simp [concurrencyOpenHom, Category.assoc]
  output_comm := by
    rw [← (boundary.concurrencyOpenHom).output_comm]
    simp [concurrencyOpenHom, Category.assoc]

/--
Boundary-preserving local Church--Rosser theorem: the two sequential DPO
results are canonically isomorphic in the category of fixed-boundary open
cospans.
-/
noncomputable def concurrencyOpenIso :
    boundary.firstAfterSecondOpen ≅
      boundary.secondAfterFirstOpen where
  hom := boundary.concurrencyOpenHom
  inv := boundary.concurrencyOpenInv
  hom_inv_id := by
    apply BoundaryHom.ext
    change
      independent.concurrencyIso.hom ≫
          independent.concurrencyIso.inv =
        𝟙 independent.firstAfterSecond.result
    simp
  inv_hom_id := by
    apply BoundaryHom.ext
    change
      independent.concurrencyIso.inv ≫
          independent.concurrencyIso.hom =
        𝟙 independent.secondAfterFirst.result
    simp

theorem concurrency_preserves_input_boundary :
    boundary.firstAfterSecondOpen.inputLeg ≫
        (boundary.concurrencyOpenIso).hom.apex =
      boundary.secondAfterFirstOpen.inputLeg :=
  (boundary.concurrencyOpenIso).hom.input_comm

theorem concurrency_preserves_output_boundary :
    boundary.firstAfterSecondOpen.outputLeg ≫
        (boundary.concurrencyOpenIso).hom.apex =
      boundary.secondAfterFirstOpen.outputLeg :=
  (boundary.concurrencyOpenIso).hom.output_comm

end JointBoundary

end ConcurrencyBoundary

end Concurrency

end Cantilune.Core.OpenCospanDPOI
