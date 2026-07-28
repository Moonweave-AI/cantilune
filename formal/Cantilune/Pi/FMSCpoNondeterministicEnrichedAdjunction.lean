import Cantilune.Pi.FMSCpoNondeterministicEnrichment
import Cantilune.Pi.FMSCpoNondeterministicKleisli

/-!
# Enrichment forced by the free nondeterministic omega-CPO

For the ordinary free object selected by a genuine solution set, the inverse
hom-set map is not merely a set-theoretic operation.  This file proves that
it is omega-continuous in the generator.

The monotonicity proof uses the standard free-algebra argument.  For two
ordered generators, the points where their extensions are ordered form an
omega-closed strict semilattice subalgebra containing the unit image.
Freeness gives a retraction onto that subalgebra, hence every point belongs
to it.  Preservation of omega-suprema then follows because the pointwise
omega-supremum of a chain of strict homomorphisms is again a strict
homomorphism and has the required restriction along the unit.

This closes the enrichment consequence *conditional on* an actual global
`SolutionSetCondition`.  It does not construct that solution set, a Fubini
map, a recursive domain solution, hiding, or full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicEnrichedAdjunction

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicEnrichment
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet.SolutionSet

namespace NDωCPO

/-- The strict algebra arrow represented by an ordinary free extension. -/
def ordinaryFreeLiftArrow
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier) :
    (freeFunctorOfSolutionSet solution).obj source ⟶
      computationObject target :=
  ((freeAdjunctionOfSolutionSet solution).homEquiv source
    (computationObject target)).symm generator

@[simp]
theorem ordinaryFreeLiftArrow_hom
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier) :
    (ordinaryFreeLiftArrow solution source target generator).hom =
      ordinaryFreeLift solution source target generator :=
  rfl

/--
The free extension with both hom objects exposed as their underlying
`ContinuousHom` types.  This wrapper avoids relying on type-class synthesis
through the categorical hom notation when forming chains of generators.
-/
def ordinaryFreeLiftRaw
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator :
      ContinuousHom source.carrier
        (computationObject target).carrier.carrier) :
    ContinuousHom
      ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier
      (computationObject target).carrier.carrier :=
  ordinaryFreeLift solution source target generator

@[simp]
theorem ordinaryFreeLiftRaw_apply
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator :
      ContinuousHom source.carrier
        (computationObject target).carrier.carrier)
    (value : ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier) :
    ordinaryFreeLiftRaw solution source target generator value =
      ordinaryFreeLift solution source target generator value :=
  rfl

/-- Bundled strict-hom wrapper with an explicitly raw generator hom type. -/
def ordinaryFreeLiftArrowRaw
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator :
      ContinuousHom source.carrier
        (computationObject target).carrier.carrier) :
    (freeFunctorOfSolutionSet solution).obj source ⟶
      computationObject target :=
  ordinaryFreeLiftArrow solution source target generator

/--
Carrier of the omega-closed subalgebra on which two free extensions are
pointwise ordered.
-/
abbrev LiftOrderCarrier
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (lower upper : source ⟶ target.carrier) :=
  { value : (ordinaryMonadOfSolutionSet solution).obj source //
      ordinaryFreeLift solution source target lower value ≤
        ordinaryFreeLift solution source target upper value }

/-- The order predicate is closed under suprema of omega-chains. -/
theorem liftOrder_omegaClosed
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (lower upper : source ⟶ target.carrier)
    (chain :
      Chain ((ordinaryMonadOfSolutionSet solution).obj source))
    (ordered :
      ∀ value ∈ chain,
        ordinaryFreeLift solution source target lower value ≤
          ordinaryFreeLift solution source target upper value) :
    ordinaryFreeLift solution source target lower (ωSup chain) ≤
      ordinaryFreeLift solution source target upper (ωSup chain) := by
  let lowerChain :=
    chain.map (ordinaryFreeLift solution source target lower).toOrderHom
  let upperChain :=
    chain.map (ordinaryFreeLift solution source target upper).toOrderHom
  calc
    ordinaryFreeLift solution source target lower (ωSup chain) =
        ωSup lowerChain := by
      exact
        (ordinaryFreeLift solution source target lower).continuous chain
    _ ≤ ωSup upperChain := by
      apply ωSup_le
      intro index
      exact
        le_ωSup_of_le index
          (ordered (chain index) ⟨index, rfl⟩)
    _ =
        ordinaryFreeLift solution source target upper (ωSup chain) := by
      exact
        (ordinaryFreeLift solution source target upper).continuous chain
          |>.symm

/-- Omega-CPO structure on the ordered-extension subalgebra. -/
@[implicit_reducible]
def liftOrderOmegaCompletePartialOrder
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (lower upper : source ⟶ target.carrier) :
    OmegaCompletePartialOrder
      (LiftOrderCarrier solution source target lower upper) :=
  OmegaCompletePartialOrder.subtype
    (fun value =>
      ordinaryFreeLift solution source target lower value ≤
        ordinaryFreeLift solution source target upper value)
    (liftOrder_omegaClosed solution source target lower upper)

/-- The ordered-extension points form a strict semilattice computation. -/
def liftOrderComputation
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (lower upper : source ⟶ target.carrier) :
    NondeterministicComputation := by
  letI :=
    liftOrderOmegaCompletePartialOrder
      solution source target lower upper
  exact
    { carrier :=
        ωCPO.of (LiftOrderCarrier solution source target lower upper)
      divergence :=
        ⟨ordinaryDivergence solution source, by
          rw [
            ordinaryFreeLift_divergence,
            ordinaryFreeLift_divergence]⟩
      divergence_le := by
        intro value
        exact
          ((freeFunctorOfSolutionSet solution).obj source).computation.divergence_le
            value.1
      deadlock :=
        ⟨ordinaryDeadlock solution source, by
          rw [
            ordinaryFreeLift_deadlock,
            ordinaryFreeLift_deadlock]⟩
      choice :=
        { toFun := fun pair =>
            ⟨ordinaryChoice solution source (pair.1.1, pair.2.1), by
              rw [
                ordinaryFreeLift_choice,
                ordinaryFreeLift_choice]
              exact target.choice.monotone ⟨pair.1.2, pair.2.2⟩⟩
          monotone' := by
            intro first second ordered
            exact
              ((freeFunctorOfSolutionSet solution).obj source).computation.choice
                |>.monotone ⟨ordered.1, ordered.2⟩
          map_ωSup' := by
            intro chain
            apply Subtype.ext
            exact
              ((freeFunctorOfSolutionSet solution).obj source).computation.choice
                |>.continuous
                  (chain.map
                    { toFun := fun pair => (pair.1.1, pair.2.1)
                      monotone' := by
                        intro first second ordered
                        exact ⟨ordered.1, ordered.2⟩ }) }
      choice_assoc := by
        intro first second third
        apply Subtype.ext
        exact
          ((freeFunctorOfSolutionSet solution).obj source).computation.choice_assoc
            first.1 second.1 third.1
      choice_comm := by
        intro first second
        apply Subtype.ext
        exact
          ((freeFunctorOfSolutionSet solution).obj source).computation.choice_comm
            first.1 second.1
      choice_idem := by
        intro value
        apply Subtype.ext
        exact
          ((freeFunctorOfSolutionSet solution).obj source).computation.choice_idem
            value.1
      deadlock_choice := by
        intro value
        apply Subtype.ext
        exact
          ((freeFunctorOfSolutionSet solution).obj source).computation.deadlock_choice
            value.1 }

/-- Inclusion of the ordered-extension subalgebra into the free algebra. -/
def liftOrderInclusion
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (lower upper : source ⟶ target.carrier) :
    computationObject
        (liftOrderComputation solution source target lower upper) ⟶
      (freeFunctorOfSolutionSet solution).obj source := by
  letI :=
    liftOrderOmegaCompletePartialOrder
      solution source target lower upper
  exact
    { hom :=
        { toFun := Subtype.val
          monotone' := fun _ _ ordered => ordered
          map_ωSup' := by
            intro chain
            rfl }
      map_divergence := rfl
      map_deadlock := rfl
      map_choice := by
        intro first second
        rfl }

/--
The unit factors through the ordered-extension subalgebra whenever the
generators are pointwise ordered.
-/
def liftOrderGenerator
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (lower upper : source ⟶ target.carrier)
    (ordered : ∀ value, lower value ≤ upper value) :
    source ⟶
      (liftOrderComputation solution source target lower upper).carrier := by
  letI :=
    liftOrderOmegaCompletePartialOrder
      solution source target lower upper
  exact
    { toFun := fun value =>
        ⟨(ordinaryMonadOfSolutionSet solution).η.app source value, by
          have lowerUnit :=
            ContinuousHom.congr_fun
              (ordinaryFreeLift_unit solution source target lower)
              value
          have upperUnit :=
            ContinuousHom.congr_fun
              (ordinaryFreeLift_unit solution source target upper)
              value
          calc
            ordinaryFreeLift solution source target lower
                ((ordinaryMonadOfSolutionSet solution).η.app source value) =
                lower value := lowerUnit
            _ ≤ upper value := ordered value
            _ =
                ordinaryFreeLift solution source target upper
                  ((ordinaryMonadOfSolutionSet solution).η.app source value) :=
              upperUnit.symm⟩
      monotone' := by
        intro first second firstLeSecond
        exact
          (ordinaryMonadOfSolutionSet solution).η.app source
            |>.monotone firstLeSecond
      map_ωSup' := by
        intro chain
        apply Subtype.ext
        exact
          (ordinaryMonadOfSolutionSet solution).η.app source
            |>.continuous chain }

/-- Free extension is monotone in its generator map. -/
theorem ordinaryFreeLift_monotone
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    ∀ lower upper : source ⟶ target.carrier,
      (∀ value, lower value ≤ upper value) →
        ∀ value,
          ordinaryFreeLift solution source target lower value ≤
            ordinaryFreeLift solution source target upper value := by
  intro lower upper ordered value
  letI :=
    liftOrderOmegaCompletePartialOrder
      solution source target lower upper
  let subLift :
      (ordinaryMonadOfSolutionSet solution).obj source ⟶
        (liftOrderComputation solution source target lower upper).carrier :=
    ordinaryFreeLift solution source
      (liftOrderComputation solution source target lower upper)
      (liftOrderGenerator solution source target lower upper ordered)
  let inclusion :=
    (liftOrderInclusion solution source target lower upper).hom
  have compositeRestricts :
      (ordinaryMonadOfSolutionSet solution).η.app source ≫
          (subLift ≫ inclusion) =
        (ordinaryMonadOfSolutionSet solution).η.app source := by
    rw [← Category.assoc]
    rw [ordinaryFreeLift_unit]
    rfl
  have compositeIsIdentity :
      subLift ≫ inclusion =
        𝟙 ((ordinaryMonadOfSolutionSet solution).obj source) := by
    have compositeUnique :=
      ordinaryFreeLift_unique solution source
        ((freeFunctorOfSolutionSet solution).obj source).computation
        ((ordinaryMonadOfSolutionSet solution).η.app source)
        (subLift ≫ inclusion)
        compositeRestricts
        (by
          change
            inclusion
                (subLift (ordinaryDivergence solution source)) =
              ordinaryDivergence solution source
          rw [ordinaryFreeLift_divergence]
          rfl)
        (by
          change
            inclusion
                (subLift (ordinaryDeadlock solution source)) =
              ordinaryDeadlock solution source
          rw [ordinaryFreeLift_deadlock]
          rfl)
        (by
          intro left right
          change
            inclusion
                (subLift
                  (ordinaryChoice solution source (left, right))) =
              ordinaryChoice solution source
                (inclusion (subLift left), inclusion (subLift right))
          rw [ordinaryFreeLift_choice]
          rfl)
    have identityUnique :=
      ordinaryFreeLift_unique solution source
        ((freeFunctorOfSolutionSet solution).obj source).computation
        ((ordinaryMonadOfSolutionSet solution).η.app source)
        (𝟙 ((ordinaryMonadOfSolutionSet solution).obj source))
        (by
          exact
            Category.comp_id
              ((ordinaryMonadOfSolutionSet solution).η.app source))
        (by rfl)
        (by rfl)
        (by intro left right; rfl)
    exact compositeUnique.trans identityUnique.symm
  have pointInSubalgebra := (subLift value).2
  have recovered :
      inclusion (subLift value) = value := by
    exact
      ContinuousHom.congr_fun compositeIsIdentity value
  change
    ordinaryFreeLift solution source target lower
        (inclusion (subLift value)) ≤
      ordinaryFreeLift solution source target upper
        (inclusion (subLift value))
    at pointInSubalgebra
  simpa [recovered] using pointInSubalgebra

/-- Raw hom-object formulation of monotonicity. -/
theorem ordinaryFreeLiftRaw_monotone
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    Monotone (ordinaryFreeLiftRaw solution source target) := by
  intro lower upper ordered value
  exact
    ordinaryFreeLift_monotone solution source target
      lower upper ordered value

/-- Free extension as an order homomorphism between raw hom objects. -/
def ordinaryFreeLiftRawOrderHom
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    OrderHom
      (ContinuousHom source.carrier
        (computationObject target).carrier.carrier)
      (ContinuousHom
        ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier
        (computationObject target).carrier.carrier) where
  toFun := ordinaryFreeLiftRaw solution source target
  monotone' := ordinaryFreeLiftRaw_monotone solution source target

/-- Free extension as a monotone map into the enriched hom object. -/
def ordinaryFreeLiftArrowOrderHom
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    OrderHom
      (ContinuousHom source.carrier
        (computationObject target).carrier.carrier)
      ((freeFunctorOfSolutionSet solution).obj source ⟶
        computationObject target) where
  toFun := fun generator =>
    ordinaryFreeLiftArrow solution source target generator
  monotone' := by
    intro lower upper ordered value
    exact
      ordinaryFreeLift_monotone solution source target
        lower upper ordered value

/--
Free extension preserves suprema of omega-chains of generators.  The proof
uses the already constructed omega-CPO of strict algebra homomorphisms.
-/
theorem ordinaryFreeLift_omegaSup
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (chain :
      Chain
        (ContinuousHom source.carrier
          (computationObject target).carrier.carrier)) :
    ordinaryFreeLiftRaw solution source target (ωSup chain) =
      ωSup
        (chain.map
          (ordinaryFreeLiftRawOrderHom solution source target)) := by
  let arrowChain :
      Chain
        ((freeFunctorOfSolutionSet solution).obj source ⟶
          computationObject target) :=
    chain.map (ordinaryFreeLiftArrowOrderHom solution source target)
  let unitRaw :
      ContinuousHom source.carrier
        ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier :=
    (ordinaryMonadOfSolutionSet solution).η.app source
  have restrictsRaw :
      ContinuousHom.comp (ωSup arrowChain).hom unitRaw =
        ωSup chain := by
    apply ContinuousHom.ext
    intro value
    change
      (ωSup arrowChain).hom (unitRaw value) =
        (ωSup chain) value
    rw [
      Cantilune.Pi.FMSCpoNondeterministicEnrichment.NDωCPO.omegaSup_apply
        ((freeFunctorOfSolutionSet solution).obj source)
        (computationObject target)
        arrowChain
        (unitRaw value)]
    let generatorEvaluation :
        Chain (computationObject target).carrier.carrier :=
      chain.map
        { toFun := fun generator => generator value
          monotone' := by
            intro lower upper ordered
            exact ordered value }
    have rhsEvaluation :
        (ωSup chain) value = ωSup generatorEvaluation := by
      rfl
    rw [rhsEvaluation]
    apply congrArg ωSup
    apply Chain.ext
    funext index
    exact
      ContinuousHom.congr_fun
        (ordinaryFreeLift_unit solution source target (chain index))
        value
  have restricts :
      (ordinaryMonadOfSolutionSet solution).η.app source ≫
          (ωSup arrowChain).hom =
        ωSup chain := by
    exact restrictsRaw
  let supremumGenerator :
      ContinuousHom source.carrier
        (computationObject target).carrier.carrier :=
    ωSup chain
  have unique :=
    ordinaryFreeLift_unique solution source target
      supremumGenerator
      (ωSup arrowChain).hom
      restricts
      (ωSup arrowChain).map_divergence
      (ωSup arrowChain).map_deadlock
      (ωSup arrowChain).map_choice
  have uniqueRaw :
      (ωSup arrowChain).hom =
        ordinaryFreeLiftRaw solution source target supremumGenerator :=
    unique
  calc
    ordinaryFreeLiftRaw solution source target (ωSup chain) =
        ordinaryFreeLiftRaw solution source target supremumGenerator := rfl
    _ = (ωSup arrowChain).hom := uniqueRaw.symm
    _ =
        ωSup
          (arrowChain.map
            (Cantilune.Pi.FMSCpoNondeterministicEnrichment.NDωCPO.homOrderHom
              ((freeFunctorOfSolutionSet solution).obj source)
              (computationObject target))) :=
      Cantilune.Pi.FMSCpoNondeterministicEnrichment.NDωCPO.omegaSup_hom
        ((freeFunctorOfSolutionSet solution).obj source)
        (computationObject target)
        arrowChain
    _ =
        ωSup
          (chain.map
            (ordinaryFreeLiftRawOrderHom solution source target)) := by
      rfl

/-- The inverse enriched hom map: free extension is omega-continuous. -/
def ordinaryFreeLiftContinuous
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    ContinuousHom
      (ContinuousHom source.carrier
        (computationObject target).carrier.carrier)
      (ContinuousHom
        ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier
        (computationObject target).carrier.carrier) where
  toFun := ordinaryFreeLiftRaw solution source target
  monotone' := ordinaryFreeLiftRaw_monotone solution source target
  map_ωSup' := ordinaryFreeLift_omegaSup solution source target

/-- The bundled strict-hom free extension preserves omega-suprema. -/
theorem ordinaryFreeLiftArrow_omegaSup
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (chain :
      Chain
        (ContinuousHom source.carrier
          (computationObject target).carrier.carrier)) :
    ordinaryFreeLiftArrowRaw solution source target (ωSup chain) =
      ωSup
        (chain.map
          (ordinaryFreeLiftArrowOrderHom solution source target)) := by
  apply NDωCPO.Hom.ext
  calc
    (ordinaryFreeLiftArrowRaw solution source target (ωSup chain)).hom =
        ordinaryFreeLiftRaw solution source target (ωSup chain) := rfl
    _ =
        ωSup
          (chain.map
            (ordinaryFreeLiftRawOrderHom solution source target)) :=
      ordinaryFreeLift_omegaSup solution source target chain
    _ =
        (ωSup
          (chain.map
            (ordinaryFreeLiftArrowOrderHom solution source target))).hom := by
      symm
      exact
        Cantilune.Pi.FMSCpoNondeterministicEnrichment.NDωCPO.omegaSup_hom
          ((freeFunctorOfSolutionSet solution).obj source)
          (computationObject target)
          (chain.map
            (ordinaryFreeLiftArrowOrderHom solution source target))

/-- The inverse hom-object map as a continuous map of enriched homs. -/
def ordinaryFreeLiftArrowContinuous
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    ContinuousHom
      (ContinuousHom source.carrier
        (computationObject target).carrier.carrier)
      ((freeFunctorOfSolutionSet solution).obj source ⟶
        computationObject target) where
  toFun := ordinaryFreeLiftArrowRaw solution source target
  monotone' := (ordinaryFreeLiftArrowOrderHom solution source target).monotone
  map_ωSup' := ordinaryFreeLiftArrow_omegaSup solution source target

/-- Precomposition by the free unit is continuous on raw hom objects. -/
def precomposeUnitContinuous
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    ContinuousHom
      (ContinuousHom
        ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier
        (computationObject target).carrier.carrier)
      (ContinuousHom source.carrier
        (computationObject target).carrier.carrier) := by
  let unitRaw :
      ContinuousHom source.carrier
        ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier :=
    (ordinaryMonadOfSolutionSet solution).η.app source
  exact
    { toFun := fun morphism => ContinuousHom.comp morphism unitRaw
      monotone' := by
        intro lower upper ordered value
        exact ordered (unitRaw value)
      map_ωSup' := by
        intro chain
        apply ContinuousHom.ext
        intro value
        rfl }

/-- The forward restriction hom-object map is omega-continuous. -/
def ordinaryRestrictionContinuous
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    ContinuousHom
      ((freeFunctorOfSolutionSet solution).obj source ⟶
        computationObject target)
      (ContinuousHom source.carrier
        (computationObject target).carrier.carrier) :=
  ContinuousHom.comp
    (precomposeUnitContinuous solution source target)
    (Cantilune.Pi.FMSCpoNondeterministicEnrichment.NDωCPO.forgetHomContinuous
      ((freeFunctorOfSolutionSet solution).obj source)
      (computationObject target))

@[simp]
theorem ordinaryRestrictionContinuous_apply
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation)
    (morphism :
      (freeFunctorOfSolutionSet solution).obj source ⟶
        computationObject target) :
    ordinaryRestrictionContinuous solution source target morphism =
      (ordinaryMonadOfSolutionSet solution).η.app source ≫
        morphism.hom :=
  rfl

/-- A continuous isomorphism between two omega-CPO hom objects. -/
structure ContinuousHomEquivalence (left right : Type*)
    [OmegaCompletePartialOrder left]
    [OmegaCompletePartialOrder right] where
  forward : ContinuousHom left right
  inverse : ContinuousHom right left
  inverse_forward : ∀ value, inverse (forward value) = value
  forward_inverse : ∀ value, forward (inverse value) = value

/--
The ordinary free/forgetful hom-set equivalence is an isomorphism of
omega-CPO hom objects.
-/
def enrichedFreeForgetHomEquivalence
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) (target : NondeterministicComputation) :
    ContinuousHomEquivalence
      ((freeFunctorOfSolutionSet solution).obj source ⟶
        computationObject target)
      (ContinuousHom source.carrier
        (computationObject target).carrier.carrier) where
  forward := ordinaryRestrictionContinuous solution source target
  inverse := ordinaryFreeLiftArrowContinuous solution source target
  inverse_forward := by
    intro morphism
    apply NDωCPO.Hom.ext
    symm
    apply
      ordinaryFreeLift_unique solution source target
        ((ordinaryMonadOfSolutionSet solution).η.app source ≫
          morphism.hom)
        morphism.hom
    · rfl
    · exact morphism.map_divergence
    · exact morphism.map_deadlock
    · exact morphism.map_choice
  forward_inverse := by
    intro generator
    exact ordinaryFreeLift_unit solution source target generator

/--
Explicit CPO-enriched free/forgetful adjunction package.  Agreement with the
ordinary hom equivalence imports its two-variable naturality, while both
directions of every hom equivalence are continuous by construction.
-/
structure CpoEnrichedFreeForgetAdjunction
    (solution : SolutionSetCondition.{0} carrierFunctor) where
  ordinary :
    freeFunctorOfSolutionSet solution ⊣ carrierFunctor
  homEquivalence :
    ∀ (source : ωCPO) (target : NDωCPO),
      ContinuousHomEquivalence
        ((freeFunctorOfSolutionSet solution).obj source ⟶ target)
        (ContinuousHom source.carrier target.carrier.carrier)
  forward_agrees :
    ∀ (source : ωCPO) (target : NDωCPO)
      (morphism :
        (freeFunctorOfSolutionSet solution).obj source ⟶ target),
      (homEquivalence source target).forward morphism =
        ordinary.homEquiv source target morphism
  inverse_agrees :
    ∀ (source : ωCPO) (target : NDωCPO)
      (generator : ContinuousHom source.carrier target.carrier.carrier),
      (homEquivalence source target).inverse generator =
        (ordinary.homEquiv source target).symm generator

/-- The all-source solution set induces a genuine CPO-enriched adjunction. -/
def cpoEnrichedFreeForgetAdjunction
    (solution : SolutionSetCondition.{0} carrierFunctor) :
    CpoEnrichedFreeForgetAdjunction solution where
  ordinary := freeAdjunctionOfSolutionSet solution
  homEquivalence := fun source target =>
    enrichedFreeForgetHomEquivalence solution source target.computation
  forward_agrees := by
    intro source target morphism
    rfl
  inverse_agrees := by
    intro source target generator
    rfl

/-- Enriched hom equivalence is natural in the source argument. -/
theorem enrichedHom_forward_natural_left
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source' source : ωCPO} (before : source' ⟶ source)
    (target : NDωCPO)
    (morphism :
      (freeFunctorOfSolutionSet solution).obj source ⟶ target) :
    ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
      source' target).forward
        ((freeFunctorOfSolutionSet solution).map before ≫ morphism) =
      before ≫
        ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
          source target).forward morphism := by
  exact
    (freeAdjunctionOfSolutionSet solution).homEquiv_naturality_left
      before morphism

/-- Enriched hom equivalence is natural in the target argument. -/
theorem enrichedHom_forward_natural_right
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) {target target' : NDωCPO}
    (morphism :
      (freeFunctorOfSolutionSet solution).obj source ⟶ target)
    (after : target ⟶ target') :
    ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
      source target').forward (morphism ≫ after) =
      ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
        source target).forward morphism ≫
        carrierFunctor.map after := by
  exact
    (freeAdjunctionOfSolutionSet solution).homEquiv_naturality_right
      morphism after

/-- The continuous inverse hom map is natural in the source argument. -/
theorem enrichedHom_inverse_natural_left
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source' source : ωCPO} (before : source' ⟶ source)
    (target : NDωCPO)
    (generator : source ⟶ carrierFunctor.obj target) :
    ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
      source' target).inverse (before ≫ generator) =
      (freeFunctorOfSolutionSet solution).map before ≫
        ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
          source target).inverse generator := by
  exact
    (freeAdjunctionOfSolutionSet solution).homEquiv_naturality_left_symm
      before generator

/-- The continuous inverse hom map is natural in the target argument. -/
theorem enrichedHom_inverse_natural_right
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source : ωCPO) {target target' : NDωCPO}
    (generator : source ⟶ carrierFunctor.obj target)
    (after : target ⟶ target') :
    ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
      source target').inverse
        (generator ≫ carrierFunctor.map after) =
      ((cpoEnrichedFreeForgetAdjunction solution).homEquivalence
        source target).inverse generator ≫ after := by
  exact
    (freeAdjunctionOfSolutionSet solution).homEquiv_naturality_right_symm
      generator after

/-- Postcomposition by the free unit is continuous on hom objects. -/
def postcomposeUnitContinuous
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source target : ωCPO) :
    ContinuousHom
      (ContinuousHom source.carrier target.carrier)
      (ContinuousHom source.carrier
        ((freeFunctorOfSolutionSet solution).obj target).carrier.carrier) := by
  let unitRaw :
      ContinuousHom target.carrier
        ((freeFunctorOfSolutionSet solution).obj target).carrier.carrier :=
    (ordinaryMonadOfSolutionSet solution).η.app target
  exact
    { toFun := fun morphism => ContinuousHom.comp unitRaw morphism
      monotone' := by
        intro lower upper ordered value
        exact unitRaw.monotone (ordered value)
      map_ωSup' := by
        intro chain
        apply ContinuousHom.ext
        intro value
        let evaluation :
            Chain target.carrier :=
          chain.map
            { toFun := fun morphism => morphism value
              monotone' := by
                intro lower upper ordered
                exact ordered value }
        change
          unitRaw (ωSup evaluation) =
            ωSup (evaluation.map unitRaw.toOrderHom)
        exact unitRaw.continuous evaluation }

/--
Functorial action of the induced monad is the free extension of the
postcomposed unit.
-/
theorem ordinaryMap_eq_freeLift
    (solution : SolutionSetCondition.{0} carrierFunctor)
    {source target : ωCPO}
    (morphism : source ⟶ target) :
    (ordinaryMonadOfSolutionSet solution).map morphism =
      ordinaryFreeLift solution source
        ((freeFunctorOfSolutionSet solution).obj target).computation
        (morphism ≫
          (ordinaryMonadOfSolutionSet solution).η.app target) := by
  apply
    ordinaryFreeLift_unique solution source
      ((freeFunctorOfSolutionSet solution).obj target).computation
      (morphism ≫
        (ordinaryMonadOfSolutionSet solution).η.app target)
      ((ordinaryMonadOfSolutionSet solution).map morphism)
  · exact
      ((ordinaryMonadOfSolutionSet solution).η.naturality morphism).symm
  · exact ordinaryMap_divergence solution morphism
  · exact ordinaryMap_deadlock solution morphism
  · exact ordinaryMap_choice solution morphism

/-- Raw hom-object wrapper for monadic functorial action. -/
def ordinaryMapRaw
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source target : ωCPO)
    (morphism : ContinuousHom source.carrier target.carrier) :
    ContinuousHom
      ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier
      ((freeFunctorOfSolutionSet solution).obj target).carrier.carrier :=
  (ordinaryMonadOfSolutionSet solution).map morphism

/-- Monad functorial action is omega-continuous on hom objects. -/
def ordinaryMapHomContinuous
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source target : ωCPO) :
    ContinuousHom
      (ContinuousHom source.carrier target.carrier)
      (ContinuousHom
        ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier
        ((freeFunctorOfSolutionSet solution).obj target).carrier.carrier) := by
  let freeTarget :=
    ((freeFunctorOfSolutionSet solution).obj target).computation
  let constructed :
      ContinuousHom
        (ContinuousHom source.carrier target.carrier)
        (ContinuousHom
          ((freeFunctorOfSolutionSet solution).obj source).carrier.carrier
          ((freeFunctorOfSolutionSet solution).obj target).carrier.carrier) :=
    ContinuousHom.comp
      (ordinaryFreeLiftContinuous solution source freeTarget)
      (postcomposeUnitContinuous solution source target)
  exact
    ContinuousHom.copy
      (ordinaryMapRaw solution source target)
      constructed
      (by
        funext morphism
        exact ordinaryMap_eq_freeLift solution morphism)

@[simp]
theorem ordinaryMapHomContinuous_apply
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (source target : ωCPO)
    (morphism : ContinuousHom source.carrier target.carrier) :
    ordinaryMapHomContinuous solution source target morphism =
      ordinaryMapRaw solution source target morphism :=
  rfl

/--
A global ordinary solution set already forces the enriched hom-action and
free-extension fields of the current powerdomain acceptance interface.
-/
def enrichedPowerdomainCoherenceOfSolutionSet
    (solution : SolutionSetCondition.{0} carrierFunctor)
    (fubini : OrdinaryFubiniWitness solution) :
    CpoEnrichedPowerdomainCoherence
      (powerdomainPackageOfSolutionSet solution fubini) where
  mapHomContinuous := ordinaryMapHomContinuous solution
  mapHomContinuous_apply := by
    intro source target morphism
    rfl
  freeLiftContinuous := ordinaryFreeLiftContinuous solution
  freeLiftContinuous_apply := by
    intro source target generator
    rfl

end NDωCPO

end Cantilune.Pi.FMSCpoNondeterministicEnrichedAdjunction
