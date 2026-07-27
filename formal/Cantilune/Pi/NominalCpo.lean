import Cantilune.Pi.NominalFiniteSupport

/-!
# Nominal support certificates in `ωCPO^I`

A world-indexed omega-CPO already has a continuous renaming action: it is a
functor `World ⥤ ωCPO`.  This module adds a continuous natural support map and
the nominal support law saying that permutations which fix the recorded
support also fix the value.

The interface separately exposes `IsLeastSupport`.  Least support is not
silently assumed: in a finite atom world, complements can also support a set,
so the identity support of the powerset object is not generally least in the
usual infinite-atom nominal sense.

The existing nonconstant `cpoAgent` is instantiated with its identity support
map.  Allocation, freshness, permutation equivariance, and the
allocation/hiding retraction are proved using actual continuous maps and
natural transformations.

This is a nominal omega-CPO support layer, not an FMS powerdomain or a
full-abstraction result.
-/

noncomputable section

namespace Cantilune.Pi.NominalCpo

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.Worlds
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoWorld
open Cantilune.Pi.NominalFiniteSupport

/-- A permutation fixes a support pointwise. -/
def Fixes
    {world : World}
    (permutation : Permutation world)
    (support : Set (Fin world)) : Prop :=
  ∀ name ∈ support, permutation name = name

/-- Continuous permutation action inherited from a world-indexed CPO. -/
def permute
    (model : World ⥤ ωCPO)
    {world : World}
    (permutation : Permutation world) :
    model.obj world ⟶ model.obj world :=
  model.map (permutationInjection permutation)

/-- Continuous injection action inherited from the model functor. -/
def rename
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target) :
    model.obj source ⟶ model.obj target :=
  model.map injection

@[simp]
theorem rename_identity
    (model : World ⥤ ωCPO)
    (world : World) :
    rename model (𝟙 world) = 𝟙 (model.obj world) :=
  model.map_id world

@[simp]
theorem rename_comp
    (model : World ⥤ ωCPO)
    {first second third : World}
    (left : first ⟶ second)
    (right : second ⟶ third) :
    rename model (left ≫ right) =
      rename model left ≫ rename model right :=
  model.map_comp left right

/--
Continuous model transport is alpha-natural in the chosen fresh target name.

The two extensions of the same old-world injection differ by the canonical
finite permutation which fixes the complete old image.  Functoriality turns
that combinatorial equality into an equality of omega-continuous maps.
-/
theorem rename_freshChoiceAlpha
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (first second : Fin target)
    (firstFresh :
      ¬ ∃ old : Fin source,
        (asInjection injection) old = first)
    (secondFresh :
      ¬ ∃ old : Fin source,
        (asInjection injection) old = second) :
    rename model
          (FMSCpoInputTransport.extendByName
            injection first firstFresh) ≫
        permute model
          (freshChoiceAlpha
            (asInjection injection) first second
            firstFresh secondFresh).permutation =
      rename model
        (FMSCpoInputTransport.extendByName
          injection second secondFresh) := by
  change
    model.map
          (FMSCpoInputTransport.extendByName
            injection first firstFresh) ≫
        model.map
          (permutationInjection
            (freshChoiceAlpha
              (asInjection injection) first second
              firstFresh secondFresh).permutation) =
      model.map
        (FMSCpoInputTransport.extendByName
          injection second secondFresh)
  rw [← model.map_comp]
  congr 1
  exact
    (freshChoiceAlpha
      (asInjection injection) first second
      firstFresh secondFresh).extensions_related

/--
Pointwise form of `rename_freshChoiceAlpha`: changing a legal fresh
representative acts only by the canonical alpha permutation on the target
value.
-/
theorem rename_freshChoiceAlpha_apply
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (first second : Fin target)
    (firstFresh :
      ¬ ∃ old : Fin source,
        (asInjection injection) old = first)
    (secondFresh :
      ¬ ∃ old : Fin source,
        (asInjection injection) old = second)
    (value : model.obj (source + 1)) :
    permute model
        (freshChoiceAlpha
          (asInjection injection) first second
          firstFresh secondFresh).permutation
        (rename model
          (FMSCpoInputTransport.extendByName
            injection first firstFresh) value) =
      rename model
        (FMSCpoInputTransport.extendByName
          injection second secondFresh) value := by
  exact
    ContinuousHom.congr_fun
      (rename_freshChoiceAlpha
        model injection first second
        firstFresh secondFresh)
      value

/-- A candidate set supports a value if every pointwise-fixing permutation fixes it. -/
def Supports
    (model : World ⥤ ωCPO)
    {world : World}
    (candidate : Set (Fin world))
    (value : model.obj world) : Prop :=
  ∀ permutation : Permutation world,
    Fixes permutation candidate →
      permute model permutation value = value

/--
Continuous nominal support certificate for a world-indexed omega-CPO.

`support` is a natural transformation into the existing nonconstant support
object, so support transport is both omega-continuous and equivariant for every
finite-world injection.
-/
structure Certificate (model : World ⥤ ωCPO) where
  support : model ⟶ cpoAgent
  support_supports :
    ∀ (world : World) (value : model.obj world),
      Supports model (support.app world value) value

namespace Certificate

variable {model : World ⥤ ωCPO} (certificate : Certificate model)

/-- The support extractor at each world is an actual omega-continuous map. -/
def supportContinuous (world : World) :
    model.obj world ⟶ cpoAgent.obj world :=
  certificate.support.app world

/-- Every recorded support is finite because the world of names is finite. -/
theorem support_finite
    (world : World) (value : model.obj world) :
    (certificate.support.app world value).Finite :=
  Set.toFinite _

/-- Support transport is equivariant for every finite injection. -/
theorem support_rename
    {source target : World}
    (injection : source ⟶ target)
    (value : model.obj source) :
    certificate.support.app target (rename model injection value) =
      cpoAgent.map injection (certificate.support.app source value) := by
  have naturality := certificate.support.naturality injection
  exact ContinuousHom.congr_fun naturality value

/-- Support transport along a permutation is direct-image equivariance. -/
theorem support_permute
    {world : World}
    (permutation : Permutation world)
    (value : model.obj world) :
    certificate.support.app world (permute model permutation value) =
      permutation ''
        certificate.support.app world value := by
  change
    certificate.support.app world
        (rename model (permutationInjection permutation) value) =
      permutation '' certificate.support.app world value
  rw [support_rename certificate
    (permutationInjection permutation) value]
  rfl

/-- The certificate's recorded support satisfies the nominal support law. -/
theorem recorded_supports
    (world : World) (value : model.obj world) :
    Supports model (certificate.support.app world value) value :=
  certificate.support_supports world value

/--
Expressible least-support property.  This is deliberately separate from
`Certificate`, because finite worlds do not force it for every nominal action.
-/
def IsLeastSupport
    (world : World) (value : model.obj world) : Prop :=
  ∀ candidate : Set (Fin world),
    Supports model candidate value →
      (show Set (Fin world) from
        certificate.support.app world value) ⊆ candidate

/-- A model has least recorded supports when the separate minimality property holds. -/
def HasLeastSupports : Prop :=
  ∀ (world : World) (value : model.obj world),
    IsLeastSupport certificate world value

/-- Continuous allocation action along the canonical fresh-world inclusion. -/
def allocate (world : World) :
    model.obj world ⟶ model.obj (world + 1) :=
  rename model (up world)

/-- Allocation transports support by the actual injection action. -/
theorem support_allocate
    (world : World) (value : model.obj world) :
    certificate.support.app (world + 1)
        (allocate (model := model) world value) =
      Fin.castSucc ''
        certificate.support.app world value := by
  change
    certificate.support.app (world + 1)
        (rename model (up world) value) =
      cpoAgent.map (up world)
        (certificate.support.app world value)
  exact support_rename certificate (up world) value

/-- The distinguished last name is fresh for every allocated value's support. -/
theorem last_fresh_after_allocate
    (world : World) (value : model.obj world) :
    Fin.last world ∉
      (show Set (Fin (world + 1)) from
        certificate.support.app (world + 1)
          (allocate (model := model) world value)) := by
  rw [support_allocate certificate world value]
  rintro ⟨old, _oldMember, endpoint⟩
  exact Fin.castSucc_ne_last old endpoint

end Certificate

/-! ## The actual nonconstant support CPO instance -/

/-- Identity support extraction on the existing powerset-valued CPO agent. -/
def cpoAgentSupport : cpoAgent ⟶ cpoAgent :=
  𝟙 cpoAgent

/-- A pointwise-fixing permutation fixes a subset under direct image. -/
theorem cpoAgent_supports
    (world : World) (support : Set (Fin world)) :
    Supports cpoAgent support support := by
  intro permutation fixes
  change permutation '' support = support
  ext name
  constructor
  · rintro ⟨old, oldMember, endpoint⟩
    rw [fixes old oldMember] at endpoint
    simpa [endpoint] using oldMember
  · intro member
    exact ⟨name, member, fixes name member⟩

/-- Genuine nominal CPO certificate for the nonconstant `cpoAgent`. -/
def cpoAgentCertificate : Certificate cpoAgent where
  support := cpoAgentSupport
  support_supports := cpoAgent_supports

@[simp]
theorem cpoAgentCertificate_support
    (world : World) (support : Set (Fin world)) :
    cpoAgentCertificate.support.app world support = support :=
  rfl

/-- Permutation action on `cpoAgent` is the expected direct image. -/
theorem cpoAgent_permute
    {world : World}
    (permutation : Permutation world)
    (support : Set (Fin world)) :
    permute cpoAgent permutation support =
      permutation '' support :=
  rfl

/-- Injection action on `cpoAgent` is the expected continuous direct image. -/
theorem cpoAgent_rename
    {source target : World}
    (injection : source ⟶ target)
    (support : Set (Fin source)) :
    rename cpoAgent injection support =
      homToFun injection '' support :=
  rfl

/-- Actual continuous allocation on the nonconstant support CPO. -/
def cpoAgentAllocate (world : World) :
    cpoAgent.obj world ⟶ cpoAgent.obj (world + 1) :=
  cpoAgent.map (up world)

@[simp]
theorem cpoAgentAllocate_apply
    (world : World) (support : Set (Fin world)) :
    cpoAgentAllocate world support =
      Fin.castSucc '' support :=
  rfl

/-- The fresh last name is absent after continuous CPO allocation. -/
theorem cpoAgentAllocate_last_fresh
    (world : World) (support : Set (Fin world)) :
    Fin.last world ∉
      (show Set (Fin (world + 1)) from
        cpoAgentAllocate world support) := by
  rintro ⟨old, _oldMember, endpoint⟩
  exact Fin.castSucc_ne_last old endpoint

/--
At each world, continuous support hiding retracts continuous allocation.
-/
theorem cpoAgent_hiding_allocation_retraction
    (world : World) :
    cpoAgentAllocate world ≫ supportHiding.app world =
      𝟙 (cpoAgent.obj world) := by
  apply ContinuousHom.ext
  intro support
  change Set.preimage Fin.castSucc (Fin.castSucc '' support) = support
  ext name
  constructor
  · intro member
    rcases member with ⟨old, oldMember, endpoint⟩
    have oldEq : old = name :=
      Fin.castSucc_injective world endpoint
    simpa [oldEq] using oldMember
  · intro member
    exact ⟨name, member, rfl⟩

/--
The allocation/hiding retraction is natural across the complete world model.
-/
theorem cpoAgent_hiding_allocation_natural :
    FMSCpoWorld.allocate cpoAgent ≫ supportHiding =
      𝟙 cpoAgent := by
  ext world support
  exact
    ContinuousHom.congr_fun
      (cpoAgent_hiding_allocation_retraction world)
      support

/-- The natural allocation component has the same fresh-support equation. -/
theorem natural_allocate_last_fresh
    (world : World) (support : Set (Fin world)) :
    Fin.last world ∉
      (show Set (Fin (world + 1)) from
        (FMSCpoWorld.allocate cpoAgent).app world support) := by
  exact cpoAgentAllocate_last_fresh world support

end Cantilune.Pi.NominalCpo
