import Cantilune.Pi.FMSCpoActionFunctor

/-!
# Local continuity of the exact FMS action endofunctor

The exact action functor is assembled from four separated constructors.  Its
action on a chain of model transformations leaves every finite action tag
fixed and applies the transformation pointwise to the continuation data.
This module proves that action monotone and omega-supremum preserving.

The result concerns the action-shape endofunctor only.  It does not construct
the FMS powerdomain or solve the recursive agent-domain equation.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoActionLocallyContinuous

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor

/-- The constant omega-chain at one value. -/
def constantChain
    {α : Type*} [Preorder α]
    (value : α) :
    Chain α where
  toFun _ := value
  monotone' := by
    intro _ _ _
    exact le_rfl

@[simp]
theorem constantChain_apply
    {α : Type*} [Preorder α]
    (value : α) (index : Nat) :
    constantChain value index = value :=
  rfl

/-- The supremum of a constant chain is its constant value. -/
@[simp]
theorem omegaSup_constantChain
    {α : Type*} [OmegaCompletePartialOrder α]
    (value : α) :
    ωSup (constantChain value) = value := by
  apply le_antisymm
  · apply ωSup_le
    intro _
    exact le_rfl
  · exact le_ωSup (constantChain value) 0

/-- Apply a chain of model transformations to one continuation. -/
def applicationChain
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (value : source.obj world) :
    Chain (target.obj world) where
  toFun index := (chain.sequence index).app world value
  monotone' := by
    intro first second ordered
    exact chain.monotone ordered world value

@[simp]
theorem applicationChain_apply
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (value : source.obj world)
    (index : Nat) :
    applicationChain chain world value index =
      (chain.sequence index).app world value :=
  rfl

/-- Apply a transformation chain pointwise to an input continuation family. -/
def knownApplicationChain
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (known : Fin world → source.obj world) :
    Chain (Fin world → target.obj world) where
  toFun index name :=
    (chain.sequence index).app world (known name)
  monotone' := by
    intro first second ordered name
    exact chain.monotone ordered world (known name)

@[simp]
theorem knownApplicationChain_apply
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (known : Fin world → source.obj world)
    (index : Nat)
    (name : Fin world) :
    knownApplicationChain chain world known index name =
      (chain.sequence index).app world (known name) :=
  rfl

/--
The exact action endofunctor is monotone on every hom omega-chain.
-/
theorem actionFunctor_map_monotone
    {source target : World ⥤ ωCPO}
    {first second : source ⟶ target}
    (ordered : TransformationPointwiseLE first second) :
    TransformationPointwiseLE
      (actionFunctor.map first)
      (actionFunctor.map second) := by
  intro world action
  change
    actionModelMapComponent first world action ≤
      actionModelMapComponent second world action
  rcases action with input | rest
  · rcases input with ⟨channel, known, fresh⟩
    simp only [actionModelMap_input]
    apply Sum.inl_le_inl_iff.2
    constructor
    · exact le_rfl
    · constructor
      · intro name
        exact ordered world (known name)
      · exact ordered (world + 1) fresh
  · rcases rest with free | rest
    · rcases free with ⟨tags, continuation⟩
      rcases tags with ⟨channel, value⟩
      simp only [actionModelMap_freeOutput]
      apply Sum.inr_le_inr_iff.2
      apply Sum.inl_le_inl_iff.2
      constructor
      · exact le_rfl
      · exact ordered world continuation
    · rcases rest with bound | continuation
      · rcases bound with ⟨channel, next⟩
        simp only [actionModelMap_boundOutput]
        apply Sum.inr_le_inr_iff.2
        apply Sum.inr_le_inr_iff.2
        apply Sum.inl_le_inl_iff.2
        constructor
        · exact le_rfl
        · exact ordered (world + 1) next
      · simp only [actionModelMap_tau]
        apply Sum.inr_le_inr_iff.2
        apply Sum.inr_le_inr_iff.2
        apply Sum.inr_le_inr_iff.2
        exact ordered world continuation

/-- The chain obtained by mapping one action through a transformation chain. -/
def mappedActionChain
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (action : (actionFunctor.obj source).obj world) :
    Chain (ActionRepresentation target world) where
  toFun index :=
    (actionFunctor.map (chain.sequence index)).app world action
  monotone' := by
    intro first second ordered
    exact actionFunctor_map_monotone
      (chain.monotone ordered) world action

/--
The exact action endofunctor preserves every supplied pointwise
omega-supremum of model transformations.
-/
theorem actionFunctor_map_omegaSup
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (action : (actionFunctor.obj source).obj world) :
    (actionFunctor.map chain.supremum).app world action =
      ωSup (mappedActionChain chain world action) := by
  rcases action with input | rest
  · rcases input with ⟨channel, known, fresh⟩
    let knownChain :=
      knownApplicationChain chain world known
    let freshChain :=
      applicationChain chain (world + 1) fresh
    let abstractionChain :=
      knownChain.zip freshChain
    let payloadChain :=
      (constantChain channel).zip abstractionChain
    have mapped :
        mappedActionChain chain world
            (Sum.inl (channel, (known, fresh))) =
          Cantilune.Pi.FMSCpoSeparatedSum.inlChain
            payloadChain := by
      apply Chain.ext
      funext index
      rfl
    change
      actionModelMapComponent chain.supremum world
          (Sum.inl (channel, (known, fresh))) =
        _
    rw [actionModelMap_input, mapped,
      Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inlChain,
      Prod.ωSup_zip, omegaSup_constantChain,
      Prod.ωSup_zip]
    apply congrArg Sum.inl
    apply Prod.ext
    · rfl
    · apply Prod.ext
      · funext name
        change
          chain.supremum.app world (known name) =
            ωSup
              (applicationChain chain world (known name))
        simpa [applicationChain] using
          chain.supremum_pointwise world (known name)
      · simpa [freshChain, applicationChain] using
          chain.supremum_pointwise (world + 1) fresh
  · rcases rest with free | rest
    · rcases free with ⟨tags, continuation⟩
      rcases tags with ⟨channel, value⟩
      let continuationChain :=
        applicationChain chain world continuation
      let payloadChain :=
        (constantChain (channel, value)).zip
          continuationChain
      have mapped :
          mappedActionChain chain world
              (Sum.inr
                (Sum.inl
                  ((channel, value), continuation))) =
            Cantilune.Pi.FMSCpoSeparatedSum.inrChain
              (Cantilune.Pi.FMSCpoSeparatedSum.inlChain
                payloadChain) := by
        apply Chain.ext
        funext index
        rfl
      change
        actionModelMapComponent chain.supremum world
            (Sum.inr
              (Sum.inl
                ((channel, value), continuation))) =
          _
      rw [actionModelMap_freeOutput, mapped,
        Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inrChain,
        Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inlChain,
        Prod.ωSup_zip, omegaSup_constantChain]
      apply congrArg Sum.inr
      apply congrArg Sum.inl
      apply Prod.ext
      · rfl
      · simpa [continuationChain, applicationChain] using
          chain.supremum_pointwise world continuation
    · rcases rest with bound | continuation
      · rcases bound with ⟨channel, next⟩
        let continuationChain :=
          applicationChain chain (world + 1) next
        let payloadChain :=
          (constantChain channel).zip continuationChain
        have mapped :
            mappedActionChain chain world
                (Sum.inr
                  (Sum.inr
                    (Sum.inl (channel, next)))) =
              Cantilune.Pi.FMSCpoSeparatedSum.inrChain
                (Cantilune.Pi.FMSCpoSeparatedSum.inrChain
                  (Cantilune.Pi.FMSCpoSeparatedSum.inlChain
                    payloadChain)) := by
          apply Chain.ext
          funext index
          rfl
        change
          actionModelMapComponent chain.supremum world
              (Sum.inr
                (Sum.inr
                  (Sum.inl (channel, next)))) =
            _
        rw [actionModelMap_boundOutput, mapped,
          Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inrChain,
          Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inrChain,
          Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inlChain,
          Prod.ωSup_zip, omegaSup_constantChain]
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        apply congrArg Sum.inl
        apply Prod.ext
        · rfl
        · simpa [continuationChain, applicationChain] using
            chain.supremum_pointwise (world + 1) next
      · let continuationChain :=
          applicationChain chain world continuation
        have mapped :
            mappedActionChain chain world
                (Sum.inr
                  (Sum.inr
                    (Sum.inr continuation))) =
              Cantilune.Pi.FMSCpoSeparatedSum.inrChain
                (Cantilune.Pi.FMSCpoSeparatedSum.inrChain
                  (Cantilune.Pi.FMSCpoSeparatedSum.inrChain
                    continuationChain)) := by
          apply Chain.ext
          funext index
          rfl
        change
          actionModelMapComponent chain.supremum world
              (Sum.inr
                (Sum.inr
                  (Sum.inr continuation))) =
            _
        rw [actionModelMap_tau, mapped,
          Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inrChain,
          Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inrChain,
          Cantilune.Pi.FMSCpoSeparatedSum.omegaSup_inrChain]
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        simpa [continuationChain, applicationChain] using
          chain.supremum_pointwise world continuation

/--
Kernel-checked local continuity of the exact FMS action endofunctor.
-/
theorem actionFunctorLocallyContinuous :
    EndofunctorLocallyContinuous actionFunctor where
  map_monotone := actionFunctor_map_monotone
  map_ωSup := by
    intro source target chain world action
    change
      (actionFunctor.map chain.supremum).app world action =
        @ωSup
          (ActionRepresentation target world)
          (inferInstance)
          _
    convert actionFunctor_map_omegaSup chain world action using 1
    apply congrArg ωSup
    apply Chain.ext
    funext index
    rfl

end Cantilune.Pi.FMSCpoActionLocallyContinuous
