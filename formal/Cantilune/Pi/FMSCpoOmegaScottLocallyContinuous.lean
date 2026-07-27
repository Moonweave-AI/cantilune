import Cantilune.Pi.FMSCpoActionLocallyContinuous
import Cantilune.Pi.FMSCpoOmegaScottPower

/-!
# Enriched local continuity of the unseparated omega-Scott lower power

This module proves that the omega-Scott closed lower-set endofunctor is
continuous in its morphism argument.  The load-bearing theorem is

`mapRaw (ωSup fᵢ) S = ωSup (mapRaw fᵢ S)`.

The forward inclusion uses that the target supremum is closed under
omega-chain suprema.  The reverse inclusion uses lower closure and the
pointwise inequalities `fᵢ ≤ ωSup fᵢ`.  The proof is then lifted pointwise to
finite-world models and composed, in Lean's left-to-right functor-composition
notation, as `actionFunctor ⋙ pointwiseCpoEndofunctor
omegaScottPowerFunctor`.

This remains the unseparated lower/Hoare monad: its empty computation is also
the order bottom.  No separated Abramsky powerdomain, recursive domain
solution, adequacy, or full abstraction follows.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous

open CategoryTheory
open OmegaCompletePartialOrder
open Set
open Topology
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoActionLocallyContinuous

universe u

/-! ## Continuity in the base morphism argument -/

/--
Direct image is monotone in its continuous-map argument.  The proof uses the
lower closure of the target computation.
-/
theorem mapRaw_function_monotone
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    {first second : α →𝒄 β}
    (ordered : first ≤ second)
    (values : OmegaScottPower α) :
    mapRaw first values ≤ mapRaw second values := by
  apply
    (mapRaw_le_iff first values
      (mapRaw second values)).2
  intro source sourceMember
  have secondMember :
      omegaScottLift second source ∈
        carrier (mapRaw second values) :=
    subset_closure ⟨source, sourceMember, rfl⟩
  change
    omegaScottLift first source ∈
      carrier (mapRaw second values)
  apply
    isLowerSet (mapRaw second values)
      (a := omegaScottLift second source)
      (b := omegaScottLift first source)
      ?_ secondMember
  exact ordered (WithOmegaScott.ofOmegaScott source)

/-- Map one fixed computation along a varying continuous morphism. -/
def mapRawFunctionOrderHom
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (values : OmegaScottPower α) :
    (α →𝒄 β) →o OmegaScottPower β where
  toFun function := mapRaw function values
  monotone' := fun _ _ ordered =>
    mapRaw_function_monotone ordered values

/--
The mapped-computation chain associated with a chain of continuous maps.
-/
def mapRawFunctionChain
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (functions : Chain (α →𝒄 β))
    (values : OmegaScottPower α) :
    Chain (OmegaScottPower β) :=
  functions.map (mapRawFunctionOrderHom values)

/--
Direct image preserves omega-suprema in the function argument.

For the nontrivial inclusion, every `fᵢ x` belongs to the closed target
supremum; its chain-sup closure therefore contains
`(ωSup fᵢ) x`.  The reverse inclusion follows from lower closure and
`fᵢ x ≤ (ωSup fᵢ) x`.
-/
theorem mapRaw_function_omegaSup
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (functions : Chain (α →𝒄 β))
    (values : OmegaScottPower α) :
    mapRaw (ωSup functions) values =
      ωSup (mapRawFunctionChain functions values) := by
  apply le_antisymm
  · apply
      (mapRaw_le_iff (ωSup functions) values
        (ωSup (mapRawFunctionChain functions values))).2
    intro source sourceMember
    let sourceValue : α :=
      WithOmegaScott.ofOmegaScott source
    let applicationValues : Chain β :=
      (functions.map ContinuousHom.toMono).map
        (OrderHom.apply sourceValue)
    have members :
        ∀ index,
          WithOmegaScott.toOmegaScott
              (applicationValues index) ∈
            carrier
              (ωSup
                (mapRawFunctionChain functions values)) := by
      intro index
      have imageMember :
          omegaScottLift (functions index) source ∈
            carrier (mapRaw (functions index) values) :=
        subset_closure ⟨source, sourceMember, rfl⟩
      have inclusion :
          mapRaw (functions index) values ≤
            ωSup
              (mapRawFunctionChain functions values) :=
        le_ωSup
          (mapRawFunctionChain functions values) index
      have applicationMember :
          WithOmegaScott.toOmegaScott
              (applicationValues index) ∈
            carrier (mapRaw (functions index) values) := by
        simpa [applicationValues, sourceValue,
          omegaScottLift] using imageMember
      exact inclusion applicationMember
    have limitMember :
        WithOmegaScott.toOmegaScott
            (ωSup applicationValues) ∈
          carrier
            (ωSup
              (mapRawFunctionChain functions values)) :=
      omegaSup_mem
        (ωSup (mapRawFunctionChain functions values))
        applicationValues members
    change
      WithOmegaScott.toOmegaScott
          ((ωSup functions) sourceValue) ∈
        carrier
          (ωSup
            (mapRawFunctionChain functions values))
    have pointwise :
        (ωSup functions) sourceValue =
          ωSup applicationValues := by
      simpa [applicationValues] using
        ContinuousHom.ωSup_apply functions sourceValue
    rw [pointwise]
    exact limitMember
  · apply ωSup_le
    intro index
    exact
      mapRaw_function_monotone
        (le_ωSup functions index) values

/--
The omega-Scott lower-power action is a continuous map between enriched hom
omega-CPOs.
-/
def omegaScottPowerMapHomContinuous
    (source target : ωCPO.{u}) :
    ContinuousHom source target →𝒄
      ContinuousHom
        (omegaScottPowerFunctor.obj source)
        (omegaScottPowerFunctor.obj target) where
  toFun morphism := omegaScottPowerFunctor.map morphism
  monotone' := by
    intro first second ordered values
    exact mapRaw_function_monotone ordered values
  map_ωSup' := by
    intro functions
    apply ContinuousHom.ext
    intro values
    change
      mapRaw (ωSup functions) values =
        ωSup (mapRawFunctionChain functions values)
    exact mapRaw_function_omegaSup functions values

/--
The concrete enriched-hom omega-chain equation exposed without the bundled
continuous map.
-/
theorem omegaScottPowerFunctor_map_omegaSup
    (source target : ωCPO.{u})
    (functions : Chain (ContinuousHom source target))
    (values : omegaScottPowerFunctor.obj source) :
    omegaScottPowerFunctor.map
        (@ωSup (ContinuousHom source target)
          (inferInstance) functions) values =
      ωSup
        (functions.map
          (omegaScottPowerMapHomContinuous
            source target).toOrderHom) values := by
  exact
    ContinuousHom.congr_fun
      ((omegaScottPowerMapHomContinuous
        source target).map_ωSup' functions)
      values

/-! ## Pointwise lifting to finite worlds -/

/-- The actual pointwise world-model lower-power endofunctor. -/
abbrev pointwiseOmegaScottPowerFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) :=
  pointwiseCpoEndofunctor omegaScottPowerFunctor

/-- Components of a transformation omega-chain form an enriched hom chain. -/
def worldComponentChain
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World) :
    Chain
      (ContinuousHom
        (source.obj world) (target.obj world)) where
  toFun index := (chain.sequence index).app world
  monotone' := by
    intro first second ordered value
    exact chain.monotone ordered world value

/-- The declared transformation supremum is the enriched component supremum. -/
theorem worldComponentChain_supremum
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World) :
    chain.supremum.app world =
      ωSup (worldComponentChain chain world) := by
  apply ContinuousHom.ext
  intro value
  exact chain.supremum_pointwise world value

/-- Pointwise lower-power action is monotone on model transformations. -/
theorem pointwiseOmegaScottPower_map_monotone
    {source target : World ⥤ ωCPO}
    {first second : source ⟶ target}
    (ordered : TransformationPointwiseLE first second) :
    TransformationPointwiseLE
      (pointwiseOmegaScottPowerFunctor.map first)
      (pointwiseOmegaScottPowerFunctor.map second) := by
  intro world values
  change
    mapRaw (first.app world) values ≤
      mapRaw (second.app world) values
  exact
    mapRaw_function_monotone
      (fun value => ordered world value) values

/-- Pointwise lower-power action preserves transformation omega-suprema. -/
theorem pointwiseOmegaScottPower_map_omegaSup
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target)
    (world : World)
    (values :
      (pointwiseOmegaScottPowerFunctor.obj source).obj world) :
    (pointwiseOmegaScottPowerFunctor.map
        chain.supremum).app world values =
      ωSup
        ({ toFun := fun index =>
            (pointwiseOmegaScottPowerFunctor.map
              (chain.sequence index)).app world values
           monotone' := by
             intro first second ordered
             exact
               pointwiseOmegaScottPower_map_monotone
                 (chain.monotone ordered) world values } :
          Chain
            ((pointwiseOmegaScottPowerFunctor.obj target).obj
              world)) := by
  change
    mapRaw (chain.supremum.app world) values =
      _
  rw [worldComponentChain_supremum chain world]
  have base :=
    mapRaw_function_omegaSup
      (worldComponentChain chain world) values
  convert base using 1
  apply congrArg ωSup
  apply Chain.ext
  funext index
  rfl

/-- Kernel-checked local continuity of the pointwise lower-power functor. -/
theorem pointwiseOmegaScottPowerLocallyContinuous :
    EndofunctorLocallyContinuous
      pointwiseOmegaScottPowerFunctor where
  map_monotone := pointwiseOmegaScottPower_map_monotone
  map_ωSup := pointwiseOmegaScottPower_map_omegaSup

/-! ## Closure under endofunctor composition -/

/--
Map a transformation omega-chain through one locally continuous
world-model endofunctor.
-/
def mappedTransformationChain
    {firstFunctor :
      (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO)}
    (continuous :
      EndofunctorLocallyContinuous firstFunctor)
    {source target : World ⥤ ωCPO}
    (chain : TransformationOmegaChain source target) :
    TransformationOmegaChain
      (firstFunctor.obj source)
      (firstFunctor.obj target) where
  sequence index :=
    firstFunctor.map (chain.sequence index)
  monotone := by
    intro first second ordered
    exact continuous.map_monotone
      (chain.monotone ordered)
  supremum :=
    firstFunctor.map chain.supremum
  supremum_pointwise := by
    intro world value
    exact continuous.map_ωSup chain world value

/-- Locally continuous world-model endofunctors are closed under composition. -/
theorem locallyContinuous_comp
    {firstFunctor secondFunctor :
      (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO)}
    (firstContinuous :
      EndofunctorLocallyContinuous firstFunctor)
    (secondContinuous :
      EndofunctorLocallyContinuous secondFunctor) :
    EndofunctorLocallyContinuous
      (firstFunctor ⋙ secondFunctor) where
  map_monotone := by
    intro source target first second ordered
    exact
      secondContinuous.map_monotone
        (firstContinuous.map_monotone ordered)
  map_ωSup := by
    intro source target chain world value
    exact
      secondContinuous.map_ωSup
        (mappedTransformationChain
          firstContinuous chain)
        world value

/--
Lean's `actionFunctor ⋙ pointwiseOmegaScottPowerFunctor` is the composite
`P ∘ H`: first form the exact action object, then apply the unseparated
lower-power functor pointwise.
-/
theorem actionThenOmegaScottPowerLocallyContinuous :
    EndofunctorLocallyContinuous
      (actionFunctor ⋙
        pointwiseOmegaScottPowerFunctor) :=
  locallyContinuous_comp
    actionFunctorLocallyContinuous
    pointwiseOmegaScottPowerLocallyContinuous

end Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous
