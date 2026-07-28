import Cantilune.Pi.FMSCpoNondeterministicCategory
import Mathlib.CategoryTheory.Limits.Constructions.LimitsOfProductsAndEqualizers
import Mathlib.CategoryTheory.Limits.Preserves.Shapes.Equalizers

/-!
# Limits of nondeterministic omega-CPO computations

This file discharges the completeness half of the ordinary adjoint-functor
route for the FMS nondeterministic-computation category.

Products and equalizers are constructed on the underlying omega-CPO and all
distinguished operations are inherited pointwise.  The constructions include
the full universal properties in `NDωCPO`; consequently the category has all
small limits.

This is not a construction of Abramsky's powerdomain.  The solution-set
condition, the free/forgetful adjunction, Cpo-enrichment, commutativity,
recursive domain solution, hiding, adequacy, and full abstraction remain
separate obligations.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicLimits

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoNondeterministicCategory

namespace NDωCPO

/-- The carrier functor, locally named to avoid `CategoryTheory.forget`. -/
abbrev carrierFunctor :
    NDωCPO ⥤ ωCPO :=
  Cantilune.Pi.FMSCpoNondeterministicCategory.NDωCPO.forget

/-! ## Arbitrary products -/

/-- Pointwise product of nondeterministic omega-CPO computations. -/
def productObject
    {J : Type}
    (family : J → NDωCPO) :
    NDωCPO where
  computation :=
    { carrier := ωCPO.of (∀ index, (family index).carrier)
      divergence := fun index =>
        (family index).computation.divergence
      divergence_le := by
        intro value index
        exact (family index).computation.divergence_le (value index)
      deadlock := fun index =>
        (family index).computation.deadlock
      choice :=
        ContinuousHom.ofFun
          (fun pair index =>
            (family index).computation.choice
              (pair.1 index, pair.2 index))
          (by fun_prop)
      choice_assoc := by
        intro left middle right
        funext index
        exact
          (family index).computation.choice_assoc
            (left index) (middle index) (right index)
      choice_comm := by
        intro left right
        funext index
        exact
          (family index).computation.choice_comm
            (left index) (right index)
      choice_idem := by
        intro value
        funext index
        exact
          (family index).computation.choice_idem
            (value index)
      deadlock_choice := by
        intro value
        funext index
        exact
          (family index).computation.deadlock_choice
            (value index) }

/-- Projection from the pointwise product. -/
def productProjection
    {J : Type}
    (family : J → NDωCPO)
    (index : J) :
    productObject family ⟶ family index where
  hom :=
    ContinuousHom.ofFun
      (fun value => value index)
      (by fun_prop)
  map_divergence := rfl
  map_deadlock := rfl
  map_choice := by
    intro left right
    rfl

/-- The pointwise product cone. -/
def productCone
    {J : Type}
    (family : J → NDωCPO) :
    Fan family :=
  Fan.mk
    (productObject family)
    (productProjection family)

/-- The pointwise product cone has the categorical universal property. -/
def productConeIsLimit
    {J : Type}
    (family : J → NDωCPO) :
    IsLimit (productCone family) where
  lift cone :=
    { hom :=
        ContinuousHom.ofFun
          (fun value index =>
            (cone.π.app ⟨index⟩).hom value)
          (by fun_prop)
      map_divergence := by
        funext index
        exact (cone.π.app ⟨index⟩).map_divergence
      map_deadlock := by
        funext index
        exact (cone.π.app ⟨index⟩).map_deadlock
      map_choice := by
        intro left right
        funext index
        exact (cone.π.app ⟨index⟩).map_choice left right }
  fac cone index := by
    apply NDωCPO.Hom.ext
    apply ContinuousHom.ext
    intro value
    rfl
  uniq cone candidate equations := by
    apply NDωCPO.Hom.ext
    apply ContinuousHom.ext
    intro value
    funext index
    have component :=
      ContinuousHom.congr_fun
        (congrArg NDωCPO.Hom.hom (equations ⟨index⟩))
        value
    exact component

instance hasProduct
    {J : Type}
    (family : J → NDωCPO) :
    HasProduct family :=
  HasLimit.mk ⟨productCone family, productConeIsLimit family⟩

instance hasProducts :
    HasProducts.{0} NDωCPO :=
  fun _ =>
    { has_limit := fun _ =>
        hasLimit_of_iso Discrete.natIsoFunctor.symm }

/-! ## The carrier functor preserves products -/

/-- The underlying omega-CPO of the pointwise product is a product cone. -/
def forgetProductConeIsLimit
    {J : Type}
    (family : J → NDωCPO) :
    IsLimit (carrierFunctor.mapCone (productCone family)) where
  lift cone :=
    ContinuousHom.ofFun
      (fun value index =>
        cone.π.app ⟨index⟩ value)
      (by fun_prop)
  fac cone index := by
    apply ContinuousHom.ext
    intro value
    rfl
  uniq cone candidate equations := by
    apply ContinuousHom.ext
    intro value
    funext index
    exact
      ContinuousHom.congr_fun
        (equations ⟨index⟩)
        value

instance forgetPreservesProduct
    {J : Type}
    (family : J → NDωCPO) :
    PreservesLimit (Discrete.functor family) carrierFunctor :=
  preservesLimit_of_preserves_limit_cone
    (productConeIsLimit family)
    (forgetProductConeIsLimit family)

instance forgetPreservesProducts
    {J : Type} :
    PreservesLimitsOfShape (Discrete J) carrierFunctor :=
  preservesLimitsOfShape_of_discrete carrierFunctor

/-! ## Equalizers -/

/-- Carrier of the pointwise equalizer of two strict semilattice arrows. -/
abbrev EqualizerCarrier
    {source target : NDωCPO}
    (left right : source ⟶ target) :=
  { value : source.carrier // left.hom value = right.hom value }

/-- The equalizer object is closed under all nondeterministic structure. -/
def equalizerObject
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    NDωCPO where
  computation :=
    { carrier := ωCPO.of (EqualizerCarrier left right)
      divergence :=
        ⟨source.computation.divergence, by
          rw [left.map_divergence, right.map_divergence]⟩
      divergence_le := by
        intro value
        exact source.computation.divergence_le value.1
      deadlock :=
        ⟨source.computation.deadlock, by
          rw [left.map_deadlock, right.map_deadlock]⟩
      choice :=
        { toFun := fun pair =>
            ⟨source.computation.choice (pair.1.1, pair.2.1), by
              rw [left.map_choice, right.map_choice]
              rw [pair.1.2, pair.2.2]⟩
          monotone' := by
            intro first second ordered
            exact
              source.computation.choice.monotone
                ⟨ordered.1, ordered.2⟩
          map_ωSup' := by
            intro chain
            apply Subtype.ext
            exact
              source.computation.choice.continuous
                (chain.map
                  { toFun := fun pair =>
                      (pair.1.1, pair.2.1)
                    monotone' := by
                      intro first second ordered
                      exact ⟨ordered.1, ordered.2⟩ }) }
      choice_assoc := by
        intro first second third
        apply Subtype.ext
        exact
          source.computation.choice_assoc
            first.1 second.1 third.1
      choice_comm := by
        intro first second
        apply Subtype.ext
        exact
          source.computation.choice_comm first.1 second.1
      choice_idem := by
        intro value
        apply Subtype.ext
        exact source.computation.choice_idem value.1
      deadlock_choice := by
        intro value
        apply Subtype.ext
        exact source.computation.deadlock_choice value.1 }

/-- Inclusion of the equalizer carrier. -/
def equalizerInclusion
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    equalizerObject left right ⟶ source where
  hom :=
    { toFun := Subtype.val
      monotone' := fun _ _ ordered => ordered
      map_ωSup' := by
        intro chain
        rfl }
  map_divergence := rfl
  map_deadlock := rfl
  map_choice := by
    intro first second
    rfl

/-- The equalizer inclusion equalizes the supplied strict arrows. -/
theorem equalizerCondition
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    equalizerInclusion left right ≫ left =
      equalizerInclusion left right ≫ right := by
  apply NDωCPO.Hom.ext
  apply ContinuousHom.ext
  intro value
  exact value.2

/-- The pointwise equalizer fork. -/
def equalizerFork
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    Fork left right :=
  Fork.ofι
    (equalizerInclusion left right)
    (equalizerCondition left right)

/-- The mediating strict semilattice arrow into the pointwise equalizer. -/
def equalizerLift
    {source target : NDωCPO}
    (left right : source ⟶ target)
    (fork : Fork left right) :
    fork.pt ⟶ equalizerObject left right where
  hom :=
    { toFun := fun value =>
        ⟨fork.ι.hom value, by
          exact
            ContinuousHom.congr_fun
              (congrArg NDωCPO.Hom.hom fork.condition)
              value⟩
      monotone' := fun _ _ ordered =>
        fork.ι.hom.monotone ordered
      map_ωSup' := by
        intro chain
        apply Subtype.ext
        exact fork.ι.hom.continuous chain }
  map_divergence := by
    apply Subtype.ext
    exact fork.ι.map_divergence
  map_deadlock := by
    apply Subtype.ext
    exact fork.ι.map_deadlock
  map_choice := by
    intro first second
    apply Subtype.ext
    exact fork.ι.map_choice first second

/-- The pointwise equalizer fork has the categorical universal property. -/
def equalizerForkIsLimit
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    IsLimit (equalizerFork left right) :=
  Fork.IsLimit.mk'
    (equalizerFork left right)
    (fun fork =>
      ⟨equalizerLift left right fork,
        by
          apply NDωCPO.Hom.ext
          apply ContinuousHom.ext
          intro value
          rfl,
        fun equation => by
          apply NDωCPO.Hom.ext
          apply ContinuousHom.ext
          intro value
          apply Subtype.ext
          exact
            ContinuousHom.congr_fun
              (congrArg NDωCPO.Hom.hom equation)
              value⟩)

instance hasEqualizer
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    HasLimit (parallelPair left right) :=
  HasLimit.mk
    ⟨equalizerFork left right,
      equalizerForkIsLimit left right⟩

instance hasEqualizers :
    HasEqualizers NDωCPO :=
  hasEqualizers_of_hasLimit_parallelPair _

/-! ## The carrier functor preserves equalizers -/

/-- The continuous mediating map from an arbitrary mapped cone. -/
def forgetEqualizerConeLift
    {source target : NDωCPO}
    (left right : source ⟶ target)
    (cone :
      Cone (parallelPair left right ⋙ carrierFunctor)) :
    cone.pt ⟶ carrierFunctor.obj (equalizerObject left right) where
  toFun := fun value =>
    ⟨cone.π.app WalkingParallelPair.zero value, by
      have leftEquation :
          left.hom
                (cone.π.app WalkingParallelPair.zero value) =
              cone.π.app WalkingParallelPair.one value :=
        ContinuousHom.congr_fun
          (cone.w WalkingParallelPairHom.left)
          value
      have rightEquation :
          right.hom
                (cone.π.app WalkingParallelPair.zero value) =
              cone.π.app WalkingParallelPair.one value :=
        ContinuousHom.congr_fun
          (cone.w WalkingParallelPairHom.right)
          value
      exact leftEquation.trans rightEquation.symm⟩
  monotone' := fun _ _ ordered =>
    (cone.π.app WalkingParallelPair.zero).monotone ordered
  map_ωSup' := by
    intro chain
    apply Subtype.ext
    exact
      (cone.π.app WalkingParallelPair.zero).continuous chain

/-- The mapped pointwise equalizer fork is an equalizer in `ωCPO`. -/
def forgetEqualizerForkIsLimit
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    IsLimit (carrierFunctor.mapCone (equalizerFork left right)) where
  lift cone :=
    forgetEqualizerConeLift left right cone
  fac cone index := by
    cases index with
    | zero =>
        apply ContinuousHom.ext
        intro value
        rfl
    | one =>
        apply ContinuousHom.ext
        intro value
        exact
          ContinuousHom.congr_fun
            (cone.w WalkingParallelPairHom.left)
            value
  uniq cone candidate equations := by
    apply ContinuousHom.ext
    intro value
    apply Subtype.ext
    exact
      ContinuousHom.congr_fun
        (equations WalkingParallelPair.zero)
        value

instance forgetPreservesEqualizer
    {source target : NDωCPO}
    (left right : source ⟶ target) :
    PreservesLimit (parallelPair left right) carrierFunctor :=
  preservesLimit_of_preserves_limit_cone
    (equalizerForkIsLimit left right)
    (forgetEqualizerForkIsLimit left right)

instance forgetPreservesEqualizers :
    PreservesLimitsOfShape WalkingParallelPair carrierFunctor where
  preservesLimit {K} :=
    preservesLimit_of_iso_diagram
      carrierFunctor (diagramIsoParallelPair K).symm

/--
`NDωCPO` is complete: arbitrary products and equalizers were constructed
above, so the standard products-and-equalizers theorem supplies every small
limit.
-/
instance hasLimits :
    HasLimits.{0} NDωCPO :=
  has_limits_of_hasEqualizers_and_products

/--
The carrier functor preserves every small limit.  This is derived from the
explicit product and equalizer preservation proofs, not stored as an input
field.
-/
instance forgetPreservesLimits :
    PreservesLimitsOfSize.{0, 0} carrierFunctor :=
  preservesLimits_of_preservesEqualizers_and_products carrierFunctor

end NDωCPO

end Cantilune.Pi.FMSCpoNondeterministicLimits
