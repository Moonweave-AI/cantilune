import Cantilune.Pi.FMSCpoOmegaScottStrongCoherence

/-!
# Chosen-product coherence for the omega-Scott lower monad

This file transports the already proved explicit-product Fubini laws across
mathlib's chosen binary products.  The target is an unseparated strong
commutative monad certificate, not `CpoPowerdomainPackage`: the latter also
requires a distinct divergence point and a free pointed-semilattice
universal property, neither of which is asserted here.
-/

noncomputable section

set_option maxHeartbeats 600000

namespace Cantilune.Pi.FMSCpoOmegaScottChosenCoherence

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottStrongCoherence

universe u

namespace ChosenProducts

@[reassoc (attr := simp)]
theorem productMap_fst
    {left left' right right' : ωCPO.{u}}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    productMap leftMap rightMap ≫
        FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodFst =
      FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodFst ≫
        leftMap := by
  apply ContinuousHom.ext
  intro value
  rfl

@[reassoc (attr := simp)]
theorem productMap_snd
    {left left' right right' : ωCPO.{u}}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    productMap leftMap rightMap ≫
        FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodSnd =
      FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodSnd ≫
        rightMap := by
  apply ContinuousHom.ext
  intro value
  rfl

set_option backward.isDefEq.respectTransparency false in
@[reassoc (attr := simp)]
theorem prodIsoProd_hom_fst
    (left right : ωCPO.{u}) :
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).hom ≫
        FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodFst =
      Limits.prod.fst := by
  simp
    [← Iso.eq_inv_comp,
      FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd]
  rfl

set_option backward.isDefEq.respectTransparency false in
@[reassoc (attr := simp)]
theorem prodIsoProd_hom_snd
    (left right : ωCPO.{u}) :
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).hom ≫
        FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodSnd =
      Limits.prod.snd := by
  simp
    [← Iso.eq_inv_comp,
      FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd]
  rfl

@[reassoc (attr := simp)]
theorem prodIsoProd_inv_fst
    (left right : ωCPO.{u}) :
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).inv ≫
        Limits.prod.fst =
      FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodFst := by
  simp [Iso.inv_comp_eq]

@[reassoc (attr := simp)]
theorem prodIsoProd_inv_snd
    (left right : ωCPO.{u}) :
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).inv ≫
        Limits.prod.snd =
      FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodSnd := by
  simp [Iso.inv_comp_eq]

theorem prodIsoProd_hom_natural
    {left left' right right' : ωCPO.{u}}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).hom ≫
        productMap leftMap rightMap =
      Limits.prod.map leftMap rightMap ≫
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left' right').hom := by
  apply ContinuousHom.ext
  intro value
  change
    productMap leftMap rightMap
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).hom value) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left' right').hom
        ((Limits.prod.map leftMap rightMap) value)
  rw [
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply,
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply]
  apply Prod.ext
  · change
      leftMap ((Limits.prod.fst : left ⨯ right ⟶ left) value) =
        (Limits.prod.fst : left' ⨯ right' ⟶ left')
          ((Limits.prod.map leftMap rightMap) value)
    exact
      (ContinuousHom.congr_fun
        (Limits.prod.map_fst leftMap rightMap) value).symm
  · change
      rightMap ((Limits.prod.snd : left ⨯ right ⟶ right) value) =
        (Limits.prod.snd : left' ⨯ right' ⟶ right')
          ((Limits.prod.map leftMap rightMap) value)
    exact
      (ContinuousHom.congr_fun
        (Limits.prod.map_snd leftMap rightMap) value).symm

theorem prodIsoProd_inv_natural
    {left left' right right' : ωCPO.{u}}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    productMap leftMap rightMap ≫
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left' right').inv =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).inv ≫
        Limits.prod.map leftMap rightMap := by
  rw [← cancel_epi
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      left right).hom]
  rw [← Category.assoc, prodIsoProd_hom_natural]
  simp

set_option backward.isDefEq.respectTransparency false in
theorem prodIsoProd_hom_braiding
    (left right : ωCPO.{u}) :
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).hom ≫
        (swapMap :
          ωCPO.of (left × right) ⟶
            ωCPO.of (right × left)) =
      (Limits.prod.braiding left right).hom ≫
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          right left).hom := by
  apply ContinuousHom.ext
  intro value
  change
    swapMap
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).hom value) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        right left).hom
        ((Limits.prod.braiding left right).hom value)
  rw [
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply,
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply]
  apply Prod.ext
  · exact
      (ConcreteCategory.congr_hom
        (Limits.prod.lift_fst
          (Limits.prod.snd : left ⨯ right ⟶ right)
          (Limits.prod.fst : left ⨯ right ⟶ left))
        value).symm
  · exact
      (ContinuousHom.congr_fun
        (Limits.prod.lift_snd
          (Limits.prod.snd : left ⨯ right ⟶ right)
          (Limits.prod.fst : left ⨯ right ⟶ left))
        value).symm

theorem prodIsoProd_inv_braiding
    (left right : ωCPO.{u}) :
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).inv ≫
        (Limits.prod.braiding left right).hom =
      (swapMap :
        ωCPO.of (left × right) ⟶
          ωCPO.of (right × left)) ≫
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          right left).inv := by
  rw [← cancel_mono
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      right left).hom]
  simp only [Category.assoc]
  rw [← prodIsoProd_hom_braiding]
  simp

def leftTripleHom
    (first second third : ωCPO.{u}) :
    ((first ⨯ second) ⨯ third).carrier →𝒄
      ((first.carrier × second.carrier) × third.carrier) :=
  (productMap
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first second).hom
      (ContinuousHom.id : third →𝒄 third)).comp
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      (first ⨯ second) third).hom

def leftTripleInv
    (first second third : ωCPO.{u}) :
    ((first.carrier × second.carrier) × third.carrier) →𝒄
      ((first ⨯ second) ⨯ third).carrier :=
  (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
    (first ⨯ second) third).inv.comp
    (productMap
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first second).inv
      (ContinuousHom.id : third →𝒄 third))

def rightTripleHom
    (first second third : ωCPO.{u}) :
    (first ⨯ (second ⨯ third)).carrier →𝒄
      (first.carrier × (second.carrier × third.carrier)) :=
  (productMap
      (ContinuousHom.id : first →𝒄 first)
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        second third).hom).comp
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      first (second ⨯ third)).hom

def rightTripleInv
    (first second third : ωCPO.{u}) :
    (first.carrier × (second.carrier × third.carrier)) →𝒄
      (first ⨯ (second ⨯ third)).carrier :=
  (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
    first (second ⨯ third)).inv.comp
    (productMap
      (ContinuousHom.id : first →𝒄 first)
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        second third).inv)

theorem leftTripleHom_inv
    (first second third : ωCPO.{u})
    (value : (first.carrier × second.carrier) × third.carrier) :
    leftTripleHom first second third
        (leftTripleInv first second third value) =
      value := by
  change
    productMap
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first second).hom
        (ContinuousHom.id : third →𝒄 third)
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (first ⨯ second) third).hom
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (first ⨯ second) third).inv
            (productMap
              (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                first second).inv
              (ContinuousHom.id : third →𝒄 third)
              value))) =
      value
  have outerCancel :=
    ContinuousHom.congr_fun
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (first ⨯ second) third).inv_hom_id
      (productMap
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first second).inv
        (ContinuousHom.id : third →𝒄 third)
        value)
  change
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      (first ⨯ second) third).hom
      ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (first ⨯ second) third).inv
        (productMap
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            first second).inv
          (ContinuousHom.id : third →𝒄 third)
          value)) =
    productMap
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first second).inv
      (ContinuousHom.id : third →𝒄 third)
      value
    at outerCancel
  rw [outerCancel]
  apply Prod.ext
  · exact
      ContinuousHom.congr_fun
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first second).inv_hom_id
        value.1
  · rfl

theorem rightTripleHom_inv
    (first second third : ωCPO.{u})
    (value : first.carrier × (second.carrier × third.carrier)) :
    rightTripleHom first second third
        (rightTripleInv first second third value) =
      value := by
  change
    productMap
        (ContinuousHom.id : first →𝒄 first)
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          second third).hom
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first (second ⨯ third)).hom
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            first (second ⨯ third)).inv
            (productMap
              (ContinuousHom.id : first →𝒄 first)
              (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                second third).inv
              value))) =
      value
  have outerCancel :=
    ContinuousHom.congr_fun
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first (second ⨯ third)).inv_hom_id
      (productMap
        (ContinuousHom.id : first →𝒄 first)
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          second third).inv
        value)
  change
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      first (second ⨯ third)).hom
      ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first (second ⨯ third)).inv
        (productMap
          (ContinuousHom.id : first →𝒄 first)
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            second third).inv
          value)) =
    productMap
      (ContinuousHom.id : first →𝒄 first)
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        second third).inv
      value
    at outerCancel
  rw [outerCancel]
  apply Prod.ext
  · rfl
  · exact
      ContinuousHom.congr_fun
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          second third).inv_hom_id
        value.2

theorem rightTripleInv_hom
    (first second third : ωCPO.{u})
    (value : (first ⨯ (second ⨯ third)).carrier) :
    rightTripleInv first second third
        (rightTripleHom first second third value) =
      value := by
  change
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      first (second ⨯ third)).inv
      (productMap
        (ContinuousHom.id : first →𝒄 first)
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          second third).inv
        (productMap
          (ContinuousHom.id : first →𝒄 first)
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            second third).hom
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            first (second ⨯ third)).hom value))) =
      value
  have innerCancel :=
    ContinuousHom.congr_fun
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        second third).hom_inv_id
      ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first (second ⨯ third)).hom value).2
  rw [show
    productMap
        (ContinuousHom.id : first →𝒄 first)
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          second third).inv
        (productMap
          (ContinuousHom.id : first →𝒄 first)
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            second third).hom
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            first (second ⨯ third)).hom value)) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first (second ⨯ third)).hom value by
    apply Prod.ext
    · rfl
    · exact innerCancel]
  exact
    ContinuousHom.congr_fun
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first (second ⨯ third)).hom_inv_id
      value

set_option backward.isDefEq.respectTransparency false in
theorem prodIsoProd_hom_associator
    (first second third : ωCPO.{u}) :
    (associatorMap :
        (first × second) × third →𝒄
          first × (second × third)).comp
        ((productMap
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            first second).hom
          (ContinuousHom.id : third →𝒄 third)).comp
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (first ⨯ second) third).hom) =
      (productMap
          (ContinuousHom.id : first →𝒄 first)
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            second third).hom).comp
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first (second ⨯ third)).hom.comp
        (Limits.prod.associator first second third).hom) := by
  apply ContinuousHom.ext
  intro value
  change
    associatorMap
        (productMap
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            first second).hom
          (ContinuousHom.id : third →𝒄 third)
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (first ⨯ second) third).hom value)) =
      productMap
        (ContinuousHom.id : first →𝒄 first)
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          second third).hom
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first (second ⨯ third)).hom
          ((Limits.prod.associator first second third).hom value))
  rw [
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply,
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply]
  change
    associatorMap
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first second).hom
          ((Limits.prod.fst :
            (first ⨯ second) ⨯ third ⟶
              first ⨯ second) value),
        (Limits.prod.snd :
          (first ⨯ second) ⨯ third ⟶ third) value) =
      ((Limits.prod.fst :
        first ⨯ (second ⨯ third) ⟶ first)
          ((Limits.prod.associator
            first second third).hom value),
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          second third).hom
          ((Limits.prod.snd :
            first ⨯ (second ⨯ third) ⟶
              second ⨯ third)
            ((Limits.prod.associator
              first second third).hom value)))
  rw [
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply,
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd_hom_apply]
  apply Prod.ext
  · change
      (Limits.prod.fst :
        first ⨯ second ⟶ first)
          ((Limits.prod.fst :
            (first ⨯ second) ⨯ third ⟶
              first ⨯ second) value) =
        (Limits.prod.fst :
          first ⨯ (second ⨯ third) ⟶ first)
          ((Limits.prod.associator
            first second third).hom value)
    exact
      (ConcreteCategory.congr_hom
        (Limits.prod.lift_fst
          (Limits.prod.fst ≫ Limits.prod.fst)
          (Limits.prod.lift
            (Limits.prod.fst ≫ Limits.prod.snd)
            Limits.prod.snd))
        value).symm
  · apply Prod.ext
    · change
        (Limits.prod.snd :
          first ⨯ second ⟶ second)
            ((Limits.prod.fst :
              (first ⨯ second) ⨯ third ⟶
                first ⨯ second) value) =
          (Limits.prod.fst :
            second ⨯ third ⟶ second)
            ((Limits.prod.snd :
              first ⨯ (second ⨯ third) ⟶
                second ⨯ third)
              ((Limits.prod.associator
                first second third).hom value))
      have outerSnd :=
        ConcreteCategory.congr_hom
          (Limits.prod.lift_snd
            (Limits.prod.fst ≫ Limits.prod.fst)
            (Limits.prod.lift
              (Limits.prod.fst ≫ Limits.prod.snd)
              Limits.prod.snd))
          value
      have innerFst :=
        ConcreteCategory.congr_hom
          (Limits.prod.lift_fst
            (Limits.prod.fst ≫ Limits.prod.snd)
            Limits.prod.snd)
          value
      exact innerFst.symm.trans
        (congrArg
          (fun morphismValue =>
            (Limits.prod.fst :
              second ⨯ third ⟶ second) morphismValue)
          outerSnd.symm)
    · change
        (Limits.prod.snd :
          (first ⨯ second) ⨯ third ⟶ third) value =
          (Limits.prod.snd :
            second ⨯ third ⟶ third)
            ((Limits.prod.snd :
              first ⨯ (second ⨯ third) ⟶
                second ⨯ third)
              ((Limits.prod.associator
                first second third).hom value))
      have outerSnd :=
        ConcreteCategory.congr_hom
          (Limits.prod.lift_snd
            (Limits.prod.fst ≫ Limits.prod.fst)
            (Limits.prod.lift
              (Limits.prod.fst ≫ Limits.prod.snd)
              Limits.prod.snd))
          value
      have innerSnd :=
        ConcreteCategory.congr_hom
          (Limits.prod.lift_snd
            (Limits.prod.fst ≫ Limits.prod.snd)
            Limits.prod.snd)
          value
      exact innerSnd.symm.trans
        (congrArg
          (fun morphismValue =>
            (Limits.prod.snd :
              second ⨯ third ⟶ third) morphismValue)
          outerSnd.symm)

theorem prodIsoProd_inv_associator
    (first second third : ωCPO.{u}) :
    (Limits.prod.associator first second third).hom.comp
        (leftTripleInv first second third) =
      (rightTripleInv first second third).comp
        (associatorMap :
          (first.carrier × second.carrier) × third.carrier →𝒄
            first.carrier ×
              (second.carrier × third.carrier)) := by
  apply ContinuousHom.ext
  intro value
  have rightInjective :
      Function.Injective
        (rightTripleHom first second third) := by
    intro leftValue rightValue equality
    calc
      leftValue =
          rightTripleInv first second third
            (rightTripleHom first second third leftValue) :=
        (rightTripleInv_hom
          first second third leftValue).symm
      _ =
          rightTripleInv first second third
            (rightTripleHom first second third rightValue) :=
        congrArg
          (rightTripleInv first second third)
          equality
      _ = rightValue :=
        rightTripleInv_hom
          first second third rightValue
  apply rightInjective
  have homAssociator :=
    ContinuousHom.congr_fun
      (prodIsoProd_hom_associator
        first second third)
      (leftTripleInv first second third value)
  change
    associatorMap
        (leftTripleHom first second third
          (leftTripleInv first second third value)) =
      rightTripleHom first second third
        ((Limits.prod.associator
          first second third).hom
          (leftTripleInv first second third value))
      at homAssociator
  calc
    rightTripleHom first second third
        ((Limits.prod.associator
          first second third).hom
          (leftTripleInv first second third value)) =
      associatorMap
        (leftTripleHom first second third
          (leftTripleInv first second third value)) :=
      homAssociator.symm
    _ = associatorMap value := by
      rw [leftTripleHom_inv]
    _ =
      rightTripleHom first second third
        (rightTripleInv first second third
          (associatorMap value)) := by
      rw [rightTripleHom_inv]

end ChosenProducts

/-! ## Explicit-product naturality as a morphism equation -/

theorem fubini_natural_hom
    {left left' right right' : ωCPO.{u}}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    productMap
        (map leftMap)
        (map rightMap) ≫
        (fubini :
          OmegaScottPower left' ×
              OmegaScottPower right' →𝒄
            OmegaScottPower (left' × right')) =
      (fubini :
        OmegaScottPower left ×
            OmegaScottPower right →𝒄
          OmegaScottPower (left × right)) ≫
        map (productMap leftMap rightMap) := by
  apply ContinuousHom.ext
  intro values
  exact
    (fubiniRaw_natural
      leftMap rightMap values.1 values.2).symm

theorem fubini_braiding_hom
    (left right : ωCPO.{u}) :
    (fubini :
        ωCPO.of
            (OmegaScottPower left ×
              OmegaScottPower right) ⟶
          omegaScottPowerCpo (left × right)) ≫
        map
          (swapMap :
            ωCPO.of (left × right) ⟶
              ωCPO.of (right × left)) =
      (swapMap :
        ωCPO.of
            (OmegaScottPower left ×
              OmegaScottPower right) ⟶
          ωCPO.of
            (OmegaScottPower right ×
              OmegaScottPower left)) ≫
        (fubini :
          ωCPO.of
              (OmegaScottPower right ×
                OmegaScottPower left) ⟶
            omegaScottPowerCpo (right × left)) := by
  apply ContinuousHom.ext
  intro values
  exact fubiniRaw_swap values.1 values.2

theorem fubiniRaw_left_unitor
    {left right : Type u}
    [OmegaCompletePartialOrder left]
    [OmegaCompletePartialOrder right]
    (unitValue : left)
    (values : OmegaScottPower right) :
    mapRaw
        (ContinuousHom.ofFun Prod.snd :
          left × right →𝒄 right)
        (fubiniRaw (principalRaw unitValue) values) =
      values := by
  apply mapRaw_eq_of_image_eq
  ext value
  constructor
  · rintro ⟨source, sourceMember, rfl⟩
    exact sourceMember.2
  · intro member
    exact
      ⟨(WithOmegaScott.toOmegaScott unitValue, value),
        ⟨le_rfl, member⟩, rfl⟩

theorem fubiniRaw_right_unitor
    {left right : Type u}
    [OmegaCompletePartialOrder left]
    [OmegaCompletePartialOrder right]
    (values : OmegaScottPower left)
    (unitValue : right) :
    mapRaw
        (ContinuousHom.ofFun Prod.fst :
          left × right →𝒄 left)
        (fubiniRaw values (principalRaw unitValue)) =
      values := by
  apply mapRaw_eq_of_image_eq
  ext value
  constructor
  · rintro ⟨source, sourceMember, rfl⟩
    exact sourceMember.1
  · intro member
    exact
      ⟨(value, WithOmegaScott.toOmegaScott unitValue),
        ⟨member, le_rfl⟩, rfl⟩

/-! ## Chosen-product Fubini naturality -/

theorem chosenFubini_natural
    {left left' right right' : ωCPO.{u}}
    (leftMap : left ⟶ left')
    (rightMap : right ⟶ right') :
    Limits.prod.map
          (omegaScottPowerFunctor.map leftMap)
          (omegaScottPowerFunctor.map rightMap) ≫
        chosenFubini left' right' =
      chosenFubini left right ≫
        omegaScottPowerFunctor.map
          (Limits.prod.map leftMap rightMap) := by
  change
    Limits.prod.map
          (map leftMap)
          (map rightMap) ≫
        chosenFubini left' right' =
      chosenFubini left right ≫
        map (Limits.prod.map leftMap rightMap)
  apply ContinuousHom.ext
  intro values
  simp only
    [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap]
  change
    map
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left' right').inv
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left')
            (omegaScottPowerCpo right')).hom
            ((Limits.prod.map
              (map leftMap)
              (map rightMap)) values))) =
      map
        (Limits.prod.map leftMap rightMap)
        (map
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left right).inv
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom values)))
  have inputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (map leftMap)
        (map rightMap))
      values
  change
    productMap (map leftMap) (map rightMap)
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo left)
          (omegaScottPowerCpo right)).hom values) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo left')
        (omegaScottPowerCpo right')).hom
        ((Limits.prod.map
          (map leftMap)
          (map rightMap)) values)
      at inputNaturality
  rw [← inputNaturality]
  have fubiniNaturality :=
    ContinuousHom.congr_fun
      (fubini_natural_hom leftMap rightMap)
      ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerFunctor.obj left)
        (omegaScottPowerFunctor.obj right)).hom values)
  change
    fubini
        (productMap
          (map leftMap)
          (map rightMap)
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom values)) =
      map (productMap leftMap rightMap)
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom values))
      at fubiniNaturality
  rw [fubiniNaturality]
  change
    mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left' right').inv
        (mapRaw
          (productMap leftMap rightMap)
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom values))) =
      mapRaw
        (Limits.prod.map leftMap rightMap)
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left right).inv
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom values)))
  rw [mapRaw_comp, mapRaw_comp]
  have outputNaturality :=
    ChosenProducts.prodIsoProd_inv_natural
      leftMap rightMap
  change
    (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      left' right').inv.comp
        (productMap leftMap rightMap) =
      (Limits.prod.map leftMap rightMap).comp
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
      at outputNaturality
  rw [outputNaturality]

/-! ## Compatibility with the monad unit -/

/--
The chosen-product Fubini map sends a pair of principal computations to the
principal computation at the chosen product.  This is the binary monoidal
unit diagram for the monad unit.
-/
theorem chosenFubini_principal
    (left right : ωCPO.{u}) :
    Limits.prod.map
          (omegaScottPowerUnit.app left)
          (omegaScottPowerUnit.app right) ≫
        chosenFubini left right =
      omegaScottPowerUnit.app (left ⨯ right) := by
  apply ContinuousHom.ext
  intro value
  simp only
    [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap]
  change
    mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom
            ((Limits.prod.map
              (principal : left ⟶ omegaScottPowerCpo left)
              (principal : right ⟶ omegaScottPowerCpo right)) value))) =
      principalRaw value
  have inputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (principal : left ⟶ omegaScottPowerCpo left)
        (principal : right ⟶ omegaScottPowerCpo right))
      value
  change
    productMap
        (principal : left ⟶ omegaScottPowerCpo left)
        (principal : right ⟶ omegaScottPowerCpo right)
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).hom value) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo left)
        (omegaScottPowerCpo right)).hom
        ((Limits.prod.map
          (principal : left ⟶ omegaScottPowerCpo left)
          (principal : right ⟶ omegaScottPowerCpo right)) value)
      at inputNaturality
  rw [← inputNaturality]
  change
    mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (fubiniRaw
          (principalRaw
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              left right).hom value).1)
          (principalRaw
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              left right).hom value).2)) =
      principalRaw value
  rw [fubiniRaw_principal, mapRaw_principal]
  congr 1
  exact
    ContinuousHom.congr_fun
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        left right).hom_inv_id
      value

/-! ## Compatibility with the monad multiplication -/

/--
The chosen-product Fubini map commutes with the closed-lower-set
multiplication.  This is the multiplicative diagram of a monoidal monad,
stated entirely with native `ωCPO` morphisms.
-/
theorem chosenFubini_multiplication
    (left right : ωCPO.{u}) :
    Limits.prod.map
          (omegaScottPowerMultiplication.app left)
          (omegaScottPowerMultiplication.app right) ≫
        chosenFubini left right =
      chosenFubini
          (omegaScottPowerFunctor.obj left)
          (omegaScottPowerFunctor.obj right) ≫
        omegaScottPowerFunctor.map (chosenFubini left right) ≫
        omegaScottPowerMultiplication.app (left ⨯ right) := by
  apply ContinuousHom.ext
  intro families
  simp only
    [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap,
      omegaScottPowerMultiplication]
  change
    map
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom
            ((Limits.prod.map
              (flatten :
                omegaScottPowerCpo (OmegaScottPower left) ⟶
                  omegaScottPowerCpo left)
              (flatten :
                omegaScottPowerCpo (OmegaScottPower right) ⟶
                  omegaScottPowerCpo right)) families))) =
      _
  have inputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (flatten :
          omegaScottPowerCpo (OmegaScottPower left) ⟶
            omegaScottPowerCpo left)
        (flatten :
          omegaScottPowerCpo (OmegaScottPower right) ⟶
            omegaScottPowerCpo right))
      families
  change
    productMap
        (flatten :
          omegaScottPowerCpo (OmegaScottPower left) ⟶
            omegaScottPowerCpo left)
        (flatten :
          omegaScottPowerCpo (OmegaScottPower right) ⟶
            omegaScottPowerCpo right)
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo (OmegaScottPower left))
          (omegaScottPowerCpo (OmegaScottPower right))).hom families) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo left)
        (omegaScottPowerCpo right)).hom
        ((Limits.prod.map
          (flatten :
            omegaScottPowerCpo (OmegaScottPower left) ⟶
              omegaScottPowerCpo left)
          (flatten :
            omegaScottPowerCpo (OmegaScottPower right) ⟶
              omegaScottPowerCpo right)) families)
      at inputNaturality
  rw [← inputNaturality]
  have multiplicationCoherence :=
    ContinuousHom.congr_fun
      (fubini_multiplication
        (α := left) (β := right))
      ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo (OmegaScottPower left))
        (omegaScottPowerCpo (OmegaScottPower right))).hom families)
  change
    fubini
        (productMap
          (flatten :
            omegaScottPowerCpo (OmegaScottPower left) ⟶
              omegaScottPowerCpo left)
          (flatten :
            omegaScottPowerCpo (OmegaScottPower right) ⟶
              omegaScottPowerCpo right)
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo (OmegaScottPower left))
            (omegaScottPowerCpo (OmegaScottPower right))).hom families)) =
      flatten
        (map fubini
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo (OmegaScottPower left))
              (omegaScottPowerCpo (OmegaScottPower right))).hom families)))
      at multiplicationCoherence
  rw [multiplicationCoherence]
  change
    mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (flattenRaw
          (mapRaw
            fubini
            (fubini
              ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                (omegaScottPowerCpo (OmegaScottPower left))
                (omegaScottPowerCpo (OmegaScottPower right))).hom
                families)))) =
      flattenRaw
        (mapRaw
          (chosenFubini left right)
          (mapRaw
            (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).inv
            (fubini
              ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                (omegaScottPowerCpo (OmegaScottPower left))
                (omegaScottPowerCpo (OmegaScottPower right))).hom
                families))))
  rw [← flattenRaw_mapRaw_natural]
  rw [mapRaw_comp, mapRaw_comp]
  have cancelTransport :
      (chosenFubini left right).comp
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).inv =
        (map
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left right).inv).comp
          fubini := by
    apply ContinuousHom.ext
    intro values
    simp only
      [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap]
    change
      mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left right).inv
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom
              ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                (omegaScottPowerCpo left)
                (omegaScottPowerCpo right)).inv values))) =
        mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left right).inv
          (fubini values)
    have isoCancel :=
      ContinuousHom.congr_fun
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo left)
          (omegaScottPowerCpo right)).inv_hom_id
        values
    change
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo left)
        (omegaScottPowerCpo right)).hom
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo left)
          (omegaScottPowerCpo right)).inv values) =
      values
      at isoCancel
    rw [isoCancel]
  exact congrArg
    (fun morphism =>
      flattenRaw
        (mapRaw morphism
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo (OmegaScottPower left))
              (omegaScottPowerCpo (OmegaScottPower right))).hom
              families))))
    cancelTransport.symm

/-! ## Symmetry on chosen products -/

theorem chosenFubini_braiding
    (left right : ωCPO.{u}) :
    chosenFubini left right ≫
        omegaScottPowerFunctor.map
          (Limits.prod.braiding left right).hom =
      (Limits.prod.braiding
          (omegaScottPowerFunctor.obj left)
          (omegaScottPowerFunctor.obj right)).hom ≫
        chosenFubini right left := by
  apply ContinuousHom.ext
  intro values
  simp only
    [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap]
  change
    mapRaw
        (Limits.prod.braiding left right).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left right).inv
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom values))) =
      mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          right left).inv
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo right)
            (omegaScottPowerCpo left)).hom
            ((Limits.prod.braiding
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom values)))
  have inputBraiding :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_braiding
        (omegaScottPowerCpo left)
        (omegaScottPowerCpo right))
      values
  change
    swapMap
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo left)
          (omegaScottPowerCpo right)).hom values) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo right)
        (omegaScottPowerCpo left)).hom
        ((Limits.prod.braiding
          (omegaScottPowerCpo left)
          (omegaScottPowerCpo right)).hom values)
      at inputBraiding
  rw [← inputBraiding]
  change
    mapRaw
        (Limits.prod.braiding left right).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left right).inv
          (fubiniRaw
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom values).1
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo right)).hom values).2)) =
      mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          right left).inv
        (fubiniRaw
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom values).2
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom values).1)
  rw [← fubiniRaw_swap]
  rw [mapRaw_comp, mapRaw_comp]
  have outputBraiding :=
    ChosenProducts.prodIsoProd_inv_braiding left right
  change
    (Limits.prod.braiding left right).hom.comp
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        right left).inv.comp swapMap
      at outputBraiding
  rw [outputBraiding]
  have swapCancel :
      ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        right left).inv.comp swapMap).comp swapMap =
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          right left).inv := by
    apply ContinuousHom.ext
    intro value
    rfl
  rw [swapCancel]

/-! ## Associativity on chosen products -/

theorem chosenFubini_associative
    (first second third : ωCPO.{u}) :
    Limits.prod.map
          (chosenFubini first second)
          (𝟙 (omegaScottPowerFunctor.obj third)) ≫
        chosenFubini (first ⨯ second) third ≫
        omegaScottPowerFunctor.map
          (Limits.prod.associator first second third).hom =
      (Limits.prod.associator
          (omegaScottPowerFunctor.obj first)
          (omegaScottPowerFunctor.obj second)
          (omegaScottPowerFunctor.obj third)).hom ≫
        Limits.prod.map
          (𝟙 (omegaScottPowerFunctor.obj first))
          (chosenFubini second third) ≫
        chosenFubini first (second ⨯ third) := by
  apply ContinuousHom.ext
  intro values
  simp only
    [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap]
  let explicitValues :=
    ChosenProducts.leftTripleHom
      (omegaScottPowerCpo first)
      (omegaScottPowerCpo second)
      (omegaScottPowerCpo third)
      values
  let reassociatedValues :=
    ChosenProducts.rightTripleHom
      (omegaScottPowerCpo first)
      (omegaScottPowerCpo second)
      (omegaScottPowerCpo third)
      ((Limits.prod.associator
        (omegaScottPowerCpo first)
        (omegaScottPowerCpo second)
        (omegaScottPowerCpo third)).hom values)
  have inputAssociator :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_associator
        (omegaScottPowerCpo first)
        (omegaScottPowerCpo second)
        (omegaScottPowerCpo third))
      values
  change
    associatorMap explicitValues =
      reassociatedValues
      at inputAssociator
  change
    mapRaw
        (Limits.prod.associator
          first second third).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (first ⨯ second) third).inv
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerFunctor.obj (first ⨯ second))
              (omegaScottPowerCpo third)).hom
              ((Limits.prod.map
                (chosenFubini first second)
                (𝟙 (omegaScottPowerCpo third))) values)))) =
      mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first (second ⨯ third)).inv
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo first)
            (omegaScottPowerFunctor.obj (second ⨯ third))).hom
            ((Limits.prod.map
              (𝟙 (omegaScottPowerCpo first))
              (chosenFubini second third))
              ((Limits.prod.associator
                (omegaScottPowerCpo first)
                (omegaScottPowerCpo second)
                (omegaScottPowerCpo third)).hom values))))
  have leftInputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (chosenFubini first second)
        (𝟙 (omegaScottPowerCpo third)))
      values
  change
    productMap
        (chosenFubini first second)
        (𝟙 (omegaScottPowerCpo third))
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo first ⨯ omegaScottPowerCpo second)
          (omegaScottPowerCpo third)).hom values) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerFunctor.obj (first ⨯ second))
        (omegaScottPowerCpo third)).hom
        ((Limits.prod.map
          (chosenFubini first second)
          (𝟙 (omegaScottPowerCpo third))) values)
      at leftInputNaturality
  rw [← leftInputNaturality]
  have rightInputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (𝟙 (omegaScottPowerCpo first))
        (chosenFubini second third))
      ((Limits.prod.associator
        (omegaScottPowerCpo first)
        (omegaScottPowerCpo second)
        (omegaScottPowerCpo third)).hom values)
  change
    productMap
        (𝟙 (omegaScottPowerCpo first))
        (chosenFubini second third)
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo first)
          (omegaScottPowerCpo second ⨯ omegaScottPowerCpo third)).hom
          ((Limits.prod.associator
            (omegaScottPowerCpo first)
            (omegaScottPowerCpo second)
            (omegaScottPowerCpo third)).hom values)) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo first)
        (omegaScottPowerFunctor.obj (second ⨯ third))).hom
        ((Limits.prod.map
          (𝟙 (omegaScottPowerCpo first))
          (chosenFubini second third))
          ((Limits.prod.associator
            (omegaScottPowerCpo first)
            (omegaScottPowerCpo second)
            (omegaScottPowerCpo third)).hom values))
      at rightInputNaturality
  rw [← rightInputNaturality]
  change
    mapRaw
        (Limits.prod.associator
          first second third).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (first ⨯ second) third).inv
          (fubiniRaw
            (mapRaw
              (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                first second).inv
              (fubiniRaw
                explicitValues.1.1
                explicitValues.1.2))
            explicitValues.2)) =
      mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first (second ⨯ third)).inv
        (fubiniRaw
          reassociatedValues.1
          (mapRaw
            (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              second third).inv
            (fubiniRaw
              reassociatedValues.2.1
              reassociatedValues.2.2)))
  rw [← inputAssociator]
  change
    mapRaw
        (Limits.prod.associator
          first second third).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (first ⨯ second) third).inv
          (fubiniRaw
            (mapRaw
              (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                first second).inv
              (fubiniRaw
                explicitValues.1.1
                explicitValues.1.2))
            explicitValues.2)) =
      mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          first (second ⨯ third)).inv
        (fubiniRaw
          explicitValues.1.1
          (mapRaw
            (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              second third).inv
            (fubiniRaw
              explicitValues.1.2
              explicitValues.2)))
  have leftFubiniNaturality :=
    fubiniRaw_natural
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        first second).inv
      (ContinuousHom.id : third →𝒄 third)
      (fubiniRaw
        explicitValues.1.1
        explicitValues.1.2)
      explicitValues.2
  rw [mapRaw_id] at leftFubiniNaturality
  rw [← leftFubiniNaturality]
  have rightFubiniNaturality :=
    fubiniRaw_natural
      (ContinuousHom.id : first →𝒄 first)
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        second third).inv
      explicitValues.1.1
      (fubiniRaw
        explicitValues.1.2
        explicitValues.2)
  rw [mapRaw_id] at rightFubiniNaturality
  rw [← rightFubiniNaturality]
  rw [mapRaw_comp, mapRaw_comp, mapRaw_comp]
  change
    mapRaw
        ((Limits.prod.associator
          first second third).hom.comp
          (ChosenProducts.leftTripleInv
            first second third))
        (fubiniRaw
          (fubiniRaw
            explicitValues.1.1
            explicitValues.1.2)
          explicitValues.2) =
      mapRaw
        (ChosenProducts.rightTripleInv
          first second third)
        (fubiniRaw
          explicitValues.1.1
          (fubiniRaw
            explicitValues.1.2
            explicitValues.2))
  have outputAssociator :=
    ChosenProducts.prodIsoProd_inv_associator
      first second third
  change
    (Limits.prod.associator
      first second third).hom.comp
        (ChosenProducts.leftTripleInv
          first second third) =
      (ChosenProducts.rightTripleInv
        first second third).comp associatorMap
      at outputAssociator
  rw [outputAssociator]
  rw [← mapRaw_comp]
  rw [fubiniRaw_associative]

/-! ## Cartesian unitors -/

theorem chosenFubini_leftUnitor
    (right : ωCPO.{u}) :
    Limits.prod.map
          (omegaScottPowerUnit.app (⊤_ ωCPO.{u}))
          (𝟙 (omegaScottPowerFunctor.obj right)) ≫
        chosenFubini (⊤_ ωCPO.{u}) right ≫
        omegaScottPowerFunctor.map
          (Limits.prod.leftUnitor right).hom =
      (Limits.prod.leftUnitor
        (omegaScottPowerFunctor.obj right)).hom := by
  apply ContinuousHom.ext
  intro value
  simp only
    [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap,
      omegaScottPowerUnit]
  change
    mapRaw
        (Limits.prod.leftUnitor right).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (⊤_ ωCPO.{u}) right).inv
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo (⊤_ ωCPO.{u}))
              (omegaScottPowerCpo right)).hom
              ((Limits.prod.map
                (principal :
                  (⊤_ ωCPO.{u}) ⟶
                    omegaScottPowerCpo (⊤_ ωCPO.{u}))
                (𝟙 (omegaScottPowerCpo right))) value)))) =
      (Limits.prod.leftUnitor
        (omegaScottPowerCpo right)).hom value
  have inputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (principal :
          (⊤_ ωCPO.{u}) ⟶
            omegaScottPowerCpo (⊤_ ωCPO.{u}))
        (𝟙 (omegaScottPowerCpo right)))
      value
  change
    productMap
        (principal :
          (⊤_ ωCPO.{u}) ⟶
            omegaScottPowerCpo (⊤_ ωCPO.{u}))
        (𝟙 (omegaScottPowerCpo right))
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (⊤_ ωCPO.{u})
          (omegaScottPowerCpo right)).hom value) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo (⊤_ ωCPO.{u}))
        (omegaScottPowerCpo right)).hom
        ((Limits.prod.map
          (principal :
            (⊤_ ωCPO.{u}) ⟶
              omegaScottPowerCpo (⊤_ ωCPO.{u}))
          (𝟙 (omegaScottPowerCpo right))) value)
      at inputNaturality
  rw [← inputNaturality]
  change
    mapRaw
        (Limits.prod.leftUnitor right).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (⊤_ ωCPO.{u}) right).inv
          (fubiniRaw
            (principalRaw
              ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                (⊤_ ωCPO.{u})
                (omegaScottPowerCpo right)).hom value).1)
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (⊤_ ωCPO.{u})
              (omegaScottPowerCpo right)).hom value).2)) =
      (Limits.prod.leftUnitor
        (omegaScottPowerCpo right)).hom value
  rw [mapRaw_comp]
  have outputUnitor :=
    ChosenProducts.prodIsoProd_inv_snd
      (⊤_ ωCPO.{u}) right
  change
    (Limits.prod.leftUnitor right).hom.comp
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (⊤_ ωCPO.{u}) right).inv =
      (ContinuousHom.ofFun Prod.snd :
        (⊤_ ωCPO.{u}) × right →𝒄 right)
      at outputUnitor
  rw [outputUnitor]
  rw [fubiniRaw_left_unitor]
  rfl

theorem chosenFubini_rightUnitor
    (left : ωCPO.{u}) :
    Limits.prod.map
          (𝟙 (omegaScottPowerFunctor.obj left))
          (omegaScottPowerUnit.app (⊤_ ωCPO.{u})) ≫
        chosenFubini left (⊤_ ωCPO.{u}) ≫
        omegaScottPowerFunctor.map
          (Limits.prod.rightUnitor left).hom =
      (Limits.prod.rightUnitor
        (omegaScottPowerFunctor.obj left)).hom := by
  apply ContinuousHom.ext
  intro value
  simp only
    [chosenFubini, omegaScottPowerFunctor, powerObject, powerMap,
      omegaScottPowerUnit]
  change
    mapRaw
        (Limits.prod.rightUnitor left).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left (⊤_ ωCPO.{u})).inv
          (fubini
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (omegaScottPowerCpo (⊤_ ωCPO.{u}))).hom
              ((Limits.prod.map
                (𝟙 (omegaScottPowerCpo left))
                (principal :
                  (⊤_ ωCPO.{u}) ⟶
                    omegaScottPowerCpo (⊤_ ωCPO.{u}))) value)))) =
      (Limits.prod.rightUnitor
        (omegaScottPowerCpo left)).hom value
  have inputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (𝟙 (omegaScottPowerCpo left))
        (principal :
          (⊤_ ωCPO.{u}) ⟶
            omegaScottPowerCpo (⊤_ ωCPO.{u})))
      value
  change
    productMap
        (𝟙 (omegaScottPowerCpo left))
        (principal :
          (⊤_ ωCPO.{u}) ⟶
            omegaScottPowerCpo (⊤_ ωCPO.{u}))
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo left)
          (⊤_ ωCPO.{u})).hom value) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo left)
        (omegaScottPowerCpo (⊤_ ωCPO.{u}))).hom
        ((Limits.prod.map
          (𝟙 (omegaScottPowerCpo left))
          (principal :
            (⊤_ ωCPO.{u}) ⟶
              omegaScottPowerCpo (⊤_ ωCPO.{u}))) value)
      at inputNaturality
  rw [← inputNaturality]
  change
    mapRaw
        (Limits.prod.rightUnitor left).hom
        (mapRaw
          (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left (⊤_ ωCPO.{u})).inv
          (fubiniRaw
            ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
              (omegaScottPowerCpo left)
              (⊤_ ωCPO.{u})).hom value).1
            (principalRaw
              ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
                (omegaScottPowerCpo left)
                (⊤_ ωCPO.{u})).hom value).2))) =
      (Limits.prod.rightUnitor
        (omegaScottPowerCpo left)).hom value
  rw [mapRaw_comp]
  have outputUnitor :=
    ChosenProducts.prodIsoProd_inv_fst
      left (⊤_ ωCPO.{u})
  change
    (Limits.prod.rightUnitor left).hom.comp
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left (⊤_ ωCPO.{u})).inv =
      (ContinuousHom.ofFun Prod.fst :
        left × (⊤_ ωCPO.{u}) →𝒄 left)
      at outputUnitor
  rw [outputUnitor]
  rw [fubiniRaw_right_unitor]
  rfl

/-! ## Chosen tensorial strengths -/

theorem chosenLeftStrength_eq
    (left right : ωCPO.{u}) :
    chosenLeftStrength left right =
      Limits.prod.map
          (omegaScottPowerUnit.app left)
          (𝟙 (omegaScottPowerFunctor.obj right)) ≫
        chosenFubini left right := by
  apply ContinuousHom.ext
  intro value
  simp only
    [chosenLeftStrength, chosenFubini, omegaScottPowerFunctor,
      powerObject, powerMap, omegaScottPowerUnit]
  change
    mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (leftStrength
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            left (omegaScottPowerCpo right)).hom value)) =
      mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom
            ((Limits.prod.map
              (principal : left ⟶ omegaScottPowerCpo left)
              (𝟙 (omegaScottPowerCpo right))) value)))
  have inputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (principal : left ⟶ omegaScottPowerCpo left)
        (𝟙 (omegaScottPowerCpo right)))
      value
  change
    productMap
        (principal : left ⟶ omegaScottPowerCpo left)
        (𝟙 (omegaScottPowerCpo right))
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left (omegaScottPowerCpo right)).hom value) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo left)
        (omegaScottPowerCpo right)).hom
        ((Limits.prod.map
          (principal : left ⟶ omegaScottPowerCpo left)
          (𝟙 (omegaScottPowerCpo right))) value)
      at inputNaturality
  rw [← inputNaturality]
  rfl

theorem chosenRightStrength_eq
    (left right : ωCPO.{u}) :
    chosenRightStrength left right =
      Limits.prod.map
          (𝟙 (omegaScottPowerFunctor.obj left))
          (omegaScottPowerUnit.app right) ≫
        chosenFubini left right := by
  apply ContinuousHom.ext
  intro value
  simp only
    [chosenRightStrength, chosenFubini, omegaScottPowerFunctor,
      powerObject, powerMap, omegaScottPowerUnit]
  change
    mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (rightStrength
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left) right).hom value)) =
      mapRaw
        (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).inv
        (fubini
          ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
            (omegaScottPowerCpo left)
            (omegaScottPowerCpo right)).hom
            ((Limits.prod.map
              (𝟙 (omegaScottPowerCpo left))
              (principal : right ⟶ omegaScottPowerCpo right)) value)))
  have inputNaturality :=
    ContinuousHom.congr_fun
      (ChosenProducts.prodIsoProd_hom_natural
        (𝟙 (omegaScottPowerCpo left))
        (principal : right ⟶ omegaScottPowerCpo right))
      value
  change
    productMap
        (𝟙 (omegaScottPowerCpo left))
        (principal : right ⟶ omegaScottPowerCpo right)
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          (omegaScottPowerCpo left) right).hom value) =
      (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
        (omegaScottPowerCpo left)
        (omegaScottPowerCpo right)).hom
        ((Limits.prod.map
          (𝟙 (omegaScottPowerCpo left))
          (principal : right ⟶ omegaScottPowerCpo right)) value)
      at inputNaturality
  rw [← inputNaturality]
  rfl

/-! ## Independent unseparated strong-commutative certificate -/

/--
A chosen-cartesian strong commutative monad certificate on `ωCPO`.

The word `Unseparated` is a scope boundary: the structure deliberately has no
field asserting a distinct divergence point, a free pointed-semilattice
universal property, an Abramsky domain equation, adequacy, definability, or
full abstraction.
-/
structure UnseparatedStrongCommutativeMonad where
  power : CategoryTheory.Monad ωCPO.{u}
  fubini :
    (left right : ωCPO.{u}) →
      (power.toFunctor.obj left ⨯
          power.toFunctor.obj right) ⟶
        power.toFunctor.obj (left ⨯ right)
  leftStrength :
    (left right : ωCPO.{u}) →
      (left ⨯ power.toFunctor.obj right) ⟶
        power.toFunctor.obj (left ⨯ right)
  rightStrength :
    (left right : ωCPO.{u}) →
      (power.toFunctor.obj left ⨯ right) ⟶
        power.toFunctor.obj (left ⨯ right)
  naturality :
    ∀ {left left' right right' : ωCPO.{u}}
      (leftMap : left ⟶ left')
      (rightMap : right ⟶ right'),
      Limits.prod.map
            (power.toFunctor.map leftMap)
            (power.toFunctor.map rightMap) ≫
          fubini left' right' =
        fubini left right ≫
          power.toFunctor.map
            (Limits.prod.map leftMap rightMap)
  unit_coherence :
    ∀ left right : ωCPO.{u},
      Limits.prod.map
            (power.η.app left)
            (power.η.app right) ≫
          fubini left right =
        power.η.app (left ⨯ right)
  multiplication_coherence :
    ∀ left right : ωCPO.{u},
      Limits.prod.map
            (power.μ.app left)
            (power.μ.app right) ≫
          fubini left right =
        fubini
            (power.toFunctor.obj left)
            (power.toFunctor.obj right) ≫
          power.toFunctor.map (fubini left right) ≫
          power.μ.app (left ⨯ right)
  symmetry_coherence :
    ∀ left right : ωCPO.{u},
      fubini left right ≫
          power.toFunctor.map
            (Limits.prod.braiding left right).hom =
        (Limits.prod.braiding
            (power.toFunctor.obj left)
            (power.toFunctor.obj right)).hom ≫
          fubini right left
  associativity_coherence :
    ∀ first second third : ωCPO.{u},
      Limits.prod.map
            (fubini first second)
            (𝟙 (power.toFunctor.obj third)) ≫
          fubini (first ⨯ second) third ≫
          power.toFunctor.map
            (Limits.prod.associator
              first second third).hom =
        (Limits.prod.associator
            (power.toFunctor.obj first)
            (power.toFunctor.obj second)
            (power.toFunctor.obj third)).hom ≫
          Limits.prod.map
            (𝟙 (power.toFunctor.obj first))
            (fubini second third) ≫
          fubini first (second ⨯ third)
  left_unitor_coherence :
    ∀ right : ωCPO.{u},
      Limits.prod.map
            (power.η.app (⊤_ ωCPO.{u}))
            (𝟙 (power.toFunctor.obj right)) ≫
          fubini (⊤_ ωCPO.{u}) right ≫
          power.toFunctor.map
            (Limits.prod.leftUnitor right).hom =
        (Limits.prod.leftUnitor
          (power.toFunctor.obj right)).hom
  right_unitor_coherence :
    ∀ left : ωCPO.{u},
      Limits.prod.map
            (𝟙 (power.toFunctor.obj left))
            (power.η.app (⊤_ ωCPO.{u})) ≫
          fubini left (⊤_ ωCPO.{u}) ≫
          power.toFunctor.map
            (Limits.prod.rightUnitor left).hom =
        (Limits.prod.rightUnitor
          (power.toFunctor.obj left)).hom
  left_strength_from_fubini :
    ∀ left right : ωCPO.{u},
      leftStrength left right =
        Limits.prod.map
            (power.η.app left)
            (𝟙 (power.toFunctor.obj right)) ≫
          fubini left right
  right_strength_from_fubini :
    ∀ left right : ωCPO.{u},
      rightStrength left right =
        Limits.prod.map
            (𝟙 (power.toFunctor.obj left))
            (power.η.app right) ≫
          fubini left right

/--
The omega-Scott closed-lower-set monad, with its chosen-product Fubini map
and tensorial strengths, inhabits the independent unseparated certificate.
-/
def omegaScottUnseparatedStrongCommutativeMonad :
    UnseparatedStrongCommutativeMonad where
  power := omegaScottPowerMonad
  fubini := chosenFubini
  leftStrength := chosenLeftStrength
  rightStrength := chosenRightStrength
  naturality := chosenFubini_natural
  unit_coherence := chosenFubini_principal
  multiplication_coherence := chosenFubini_multiplication
  symmetry_coherence := chosenFubini_braiding
  associativity_coherence := chosenFubini_associative
  left_unitor_coherence := chosenFubini_leftUnitor
  right_unitor_coherence := chosenFubini_rightUnitor
  left_strength_from_fubini := chosenLeftStrength_eq
  right_strength_from_fubini := chosenRightStrength_eq

end Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
