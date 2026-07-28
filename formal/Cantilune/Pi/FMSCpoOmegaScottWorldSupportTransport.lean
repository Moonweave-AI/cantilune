import Cantilune.Pi.FMSCpoOmegaScottPowerSupport
import Cantilune.Pi.FMSCpoFinitePower
import Cantilune.Pi.NominalFiniteSupport

/-!
# Exact finite-world transport for the supported omega-Scott power

`SupportedOmegaCpo Resource` fixes its resource type.  A finite-world arrow
changes that type from `Fin source` to `Fin target`, so an ordinary
`SupportedOmegaCpo.Hom` cannot express world reindexing.  This file supplies
the missing dependent morphism: its support equation is direct image along
the finite injection.

These dependent morphisms assemble into a category of finite-world supported
omega-CPO models.  The existing lower/Hoare omega-Scott construction lifts to
an actual endofunctor and monad on that category.  Return, direct image,
choice, and flattening commute with world transport, and computation support
is pushed forward exactly.

This is a support-aware lift of the repository's lower omega-Scott monad.  It
does not identify that monad with Abramsky's pointed powerdomain, separate
divergence from deadlock, solve the FMS recursive domain equation, or prove
full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.Worlds
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottPowerSupport
open Cantilune.Pi.NominalFiniteSupport

universe u

/-! ## Dependent exact-support maps -/

/--
A continuous map whose finite support is transported exactly along a world
injection.
-/
@[ext]
structure ReindexHom
    {source target : World}
    (injection : Injection source target)
    (sourceObject : SupportedOmegaCpo.{0, u} (Fin source))
    (targetObject : SupportedOmegaCpo.{0, u} (Fin target)) where
  toContinuousHom :
    sourceObject.Carrier →𝒄 targetObject.Carrier
  support_map :
    ∀ value,
      targetObject.support (toContinuousHom value) =
        mapSupport injection (sourceObject.support value)

instance
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)} :
    CoeFun
      (ReindexHom injection sourceObject targetObject)
      (fun _ => sourceObject.Carrier → targetObject.Carrier) :=
  ⟨fun morphism => morphism.toContinuousHom⟩

namespace ReindexHom

/-- Identity world transport. -/
def id
    {world : World}
    (object : SupportedOmegaCpo.{0, u} (Fin world)) :
    ReindexHom (Injection.identity world) object object where
  toContinuousHom := ContinuousHom.id
  support_map := by
    intro value
    exact (mapSupport_identity world (object.support value)).symm

/-- Composition of dependent world transports. -/
def comp
    {first second third : World}
    {leftInjection : Injection first second}
    {rightInjection : Injection second third}
    {firstObject : SupportedOmegaCpo.{0, u} (Fin first)}
    {secondObject : SupportedOmegaCpo.{0, u} (Fin second)}
    {thirdObject : SupportedOmegaCpo.{0, u} (Fin third)}
    (left :
      ReindexHom leftInjection firstObject secondObject)
    (right :
      ReindexHom rightInjection secondObject thirdObject) :
    ReindexHom
      (leftInjection.comp rightInjection)
      firstObject thirdObject where
  toContinuousHom :=
    ContinuousHom.comp
      right.toContinuousHom left.toContinuousHom
  support_map := by
    intro value
    change
      thirdObject.support (right (left value)) =
        mapSupport
          (leftInjection.comp rightInjection)
          (firstObject.support value)
    rw [right.support_map, left.support_map]
    exact
      (mapSupport_comp
        leftInjection rightInjection
        (firstObject.support value)).symm

@[simp]
theorem id_apply
    {world : World}
    (object : SupportedOmegaCpo.{0, u} (Fin world))
    (value : object.Carrier) :
    id object value = value :=
  rfl

@[simp]
theorem comp_apply
    {first second third : World}
    {leftInjection : Injection first second}
    {rightInjection : Injection second third}
    {firstObject : SupportedOmegaCpo.{0, u} (Fin first)}
    {secondObject : SupportedOmegaCpo.{0, u} (Fin second)}
    {thirdObject : SupportedOmegaCpo.{0, u} (Fin third)}
    (left :
      ReindexHom leftInjection firstObject secondObject)
    (right :
      ReindexHom rightInjection secondObject thirdObject)
    (value : firstObject.Carrier) :
    left.comp right value = right (left value) :=
  rfl

end ReindexHom

/-! ## Exact support transport through the lower omega-Scott power -/

/--
Direct image of a lower computation along a dependent exact-support map
pushes the union of outcome supports forward exactly.
-/
@[simp]
theorem powerSupport_mapRaw_reindex
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject)
    (values : OmegaScottPower sourceObject.Carrier) :
    powerSupport targetObject
        (mapRaw morphism.toContinuousHom values) =
      mapSupport injection
        (powerSupport sourceObject values) := by
  apply Finset.Subset.antisymm
  · apply
      (powerSupport_subset_iff
        targetObject
        (mapRaw morphism.toContinuousHom values)
        (mapSupport injection
          (powerSupport sourceObject values))).2
    apply
      (mapRaw_le_iff
        morphism.toContinuousHom
        values
        (supportBound targetObject
          (mapSupport injection
            (powerSupport sourceObject values)))).2
    intro value valueMember
    change
      targetObject.support
          (morphism
            (WithOmegaScott.ofOmegaScott value)) ⊆
        mapSupport injection
          (powerSupport sourceObject values)
    rw [morphism.support_map]
    intro targetResource targetMember
    rcases
        (mem_mapSupport
          injection
          (sourceObject.support
            (WithOmegaScott.ofOmegaScott value))
          targetResource).1 targetMember with
      ⟨sourceResource, sourceSupportMember, endpoint⟩
    apply
      (mem_mapSupport
        injection
        (powerSupport sourceObject values)
        targetResource).2
    exact
      ⟨sourceResource,
        (mem_powerSupport_iff
          sourceObject values sourceResource).2
          ⟨WithOmegaScott.ofOmegaScott value,
            valueMember, sourceSupportMember⟩,
        endpoint⟩
  · intro targetResource targetMember
    rcases
        (mem_mapSupport
          injection
          (powerSupport sourceObject values)
          targetResource).1 targetMember with
      ⟨sourceResource, sourceResourceMember, endpoint⟩
    rcases
        (mem_powerSupport_iff
          sourceObject values sourceResource).1
          sourceResourceMember with
      ⟨sourceValue, sourceValueMember, sourceSupportMember⟩
    apply
      (mem_powerSupport_iff
        targetObject
        (mapRaw morphism.toContinuousHom values)
        targetResource).2
    refine
      ⟨morphism sourceValue, ?_, ?_⟩
    · exact
        subset_closure
          ⟨WithOmegaScott.toOmegaScott sourceValue,
            sourceValueMember, rfl⟩
    · rw [morphism.support_map]
      exact
        (mem_mapSupport
          injection
          (sourceObject.support sourceValue)
          targetResource).2
          ⟨sourceResource, sourceSupportMember, endpoint⟩

/-- Lift a dependent exact-support map through the omega-Scott power. -/
def powerReindex
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject) :
    ReindexHom
      injection
      (FMSCpoOmegaScottPowerSupport.powerObject sourceObject)
      (FMSCpoOmegaScottPowerSupport.powerObject targetObject) where
  toContinuousHom :=
    FMSCpoOmegaScottPower.map morphism.toContinuousHom
  support_map :=
    powerSupport_mapRaw_reindex morphism

@[simp]
theorem powerReindex_id_apply
    {world : World}
    (object : SupportedOmegaCpo.{0, u} (Fin world))
    (values : OmegaScottPower object.Carrier) :
    powerReindex (ReindexHom.id object) values = values :=
  mapRaw_id values

@[simp]
theorem powerReindex_comp_apply
    {first second third : World}
    {leftInjection : Injection first second}
    {rightInjection : Injection second third}
    {firstObject : SupportedOmegaCpo.{0, u} (Fin first)}
    {secondObject : SupportedOmegaCpo.{0, u} (Fin second)}
    {thirdObject : SupportedOmegaCpo.{0, u} (Fin third)}
    (left :
      ReindexHom leftInjection firstObject secondObject)
    (right :
      ReindexHom rightInjection secondObject thirdObject)
    (values : OmegaScottPower firstObject.Carrier) :
    powerReindex (left.comp right) values =
      powerReindex right (powerReindex left values) :=
  (mapRaw_comp
    left.toContinuousHom right.toContinuousHom values).symm

/-! ## The category of exact-support finite-world models -/

/--
A finite-injection indexed omega-CPO model with exact support transport.
-/
structure SupportedWorldModel where
  obj :
    (world : World) →
      SupportedOmegaCpo.{0, u} (Fin world)
  reindex :
    {source target : World} →
      (injection : Injection source target) →
      ReindexHom injection (obj source) (obj target)
  reindex_id :
    ∀ (world : World) (value : (obj world).Carrier),
      reindex (Injection.identity world) value = value
  reindex_comp :
    ∀ {first second third : World}
      (left : Injection first second)
      (right : Injection second third)
      (value : (obj first).Carrier),
      reindex (left.comp right) value =
        reindex right (reindex left value)

namespace SupportedWorldModel

/-- Natural exact-support maps between finite-world supported models. -/
structure Hom
    (source target : SupportedWorldModel.{u}) where
  app :
    (world : World) →
      SupportedOmegaCpo.Hom
        (source.obj world) (target.obj world)
  natural :
    ∀ {first second : World}
      (injection : Injection first second)
      (value : (source.obj first).Carrier),
      target.reindex injection (app first value) =
        app second (source.reindex injection value)

instance
    {source target : SupportedWorldModel.{u}} :
    CoeFun (Hom source target)
      (fun _ =>
        (world : World) →
          (source.obj world).Carrier →
          (target.obj world).Carrier) :=
  ⟨fun morphism world => morphism.app world⟩

/-- Extensional equality of natural supported maps. -/
@[ext]
theorem Hom.ext_apply
    {source target : SupportedWorldModel.{u}}
    {left right : Hom source target}
    (equal :
      ∀ (world : World)
        (value : (source.obj world).Carrier),
        left.app world value = right.app world value) :
    left = right := by
  cases left with
  | mk leftApp leftNatural =>
      cases right with
      | mk rightApp rightNatural =>
          have appEqual : leftApp = rightApp := by
            funext world
            apply SupportedOmegaCpo.Hom.ext
            apply ContinuousHom.ext
            intro value
            exact equal world value
          subst rightApp
          rfl

/-- Identity natural supported map. -/
def Hom.id
    (model : SupportedWorldModel.{u}) :
    Hom model model where
  app world := SupportedOmegaCpo.Hom.id (model.obj world)
  natural := by
    intros
    rfl

/-- Composition of natural supported maps. -/
def Hom.comp
    {first second third : SupportedWorldModel.{u}}
    (left : Hom first second)
    (right : Hom second third) :
    Hom first third where
  app world :=
    (left.app world).comp (right.app world)
  natural := by
    intro source target injection value
    change
      third.reindex injection
          (right.app source (left.app source value)) =
        right.app target
          (left.app target
            (first.reindex injection value))
    rw [right.natural, left.natural]

/-- Exact-support finite-world models form a category. -/
instance : Category SupportedWorldModel.{u} where
  Hom := Hom
  id := Hom.id
  comp := Hom.comp
  id_comp := by
    intro first second morphism
    apply Hom.ext_apply
    intros
    rfl
  comp_id := by
    intro first second morphism
    apply Hom.ext_apply
    intros
    rfl
  assoc := by
    intro first second third fourth left middle right
    apply Hom.ext_apply
    intros
    rfl

/-! ## Worldwise power functor and monad -/

/-- Apply the supported omega-Scott power at every finite world. -/
def powerModel
    (model : SupportedWorldModel.{u}) :
    SupportedWorldModel.{u} where
  obj world :=
    FMSCpoOmegaScottPowerSupport.powerObject
      (model.obj world)
  reindex injection :=
    powerReindex (model.reindex injection)
  reindex_id := by
    intro world values
    change
      mapRaw
          (model.reindex
            (Injection.identity world)).toContinuousHom
          values =
        values
    have mapEqual :
        (model.reindex
          (Injection.identity world)).toContinuousHom =
          ContinuousHom.id := by
      apply ContinuousHom.ext
      intro value
      exact model.reindex_id world value
    rw [mapEqual]
    exact mapRaw_id values
  reindex_comp := by
    intro first second third left right values
    change
      mapRaw
          (model.reindex
            (left.comp right)).toContinuousHom
          values =
        mapRaw
          (model.reindex right).toContinuousHom
          (mapRaw
            (model.reindex left).toContinuousHom
            values)
    have mapEqual :
        (model.reindex
          (left.comp right)).toContinuousHom =
          ContinuousHom.comp
            (model.reindex right).toContinuousHom
            (model.reindex left).toContinuousHom := by
      apply ContinuousHom.ext
      intro value
      exact model.reindex_comp left right value
    rw [mapEqual]
    exact
      (mapRaw_comp
        (model.reindex left).toContinuousHom
        (model.reindex right).toContinuousHom
        values).symm

/-- Lift a natural exact-support map pointwise through the power. -/
def powerHom
    {source target : SupportedWorldModel.{u}}
    (morphism : Hom source target) :
    Hom (powerModel source) (powerModel target) where
  app world :=
    mapSupported (morphism.app world)
  natural := by
    intro first second injection values
    change
      mapRaw
          (target.reindex injection).toContinuousHom
          (mapRaw
            (morphism.app first).toContinuousHom
            values) =
        mapRaw
          (morphism.app second).toContinuousHom
          (mapRaw
            (source.reindex injection).toContinuousHom
            values)
    rw [mapRaw_comp, mapRaw_comp]
    congr 1
    apply ContinuousHom.ext
    intro value
    exact morphism.natural injection value

/-- The supported lower omega-Scott power is an actual endofunctor. -/
def powerFunctor :
    SupportedWorldModel.{u} ⥤
      SupportedWorldModel.{u} where
  obj := powerModel
  map := powerHom
  map_id model := by
    apply Hom.ext_apply
    intro world values
    exact mapRaw_id values
  map_comp first second := by
    apply Hom.ext_apply
    intro world values
    exact
      (mapRaw_comp
        (first.app world).toContinuousHom
        (second.app world).toContinuousHom
        values).symm

/-- Pointwise return, natural both in worlds and in supported models. -/
def unitApp
    (model : SupportedWorldModel.{u}) :
    Hom model (powerModel model) where
  app world :=
    principalSupported (model.obj world)
  natural := by
    intro first second injection value
    exact
      mapRaw_principal
        (model.reindex injection).toContinuousHom
        value

/-- Unit of the supported world power monad. -/
def powerUnit :
    𝟭 SupportedWorldModel.{u} ⟶ powerFunctor where
  app := unitApp
  naturality := by
    intro source target morphism
    apply Hom.ext_apply
    intro world value
    exact
      (mapRaw_principal
        (morphism.app world).toContinuousHom
        value).symm

/-- Pointwise flattening, natural both in worlds and in supported models. -/
def multiplicationApp
    (model : SupportedWorldModel.{u}) :
    Hom (powerModel (powerModel model))
      (powerModel model) where
  app world :=
    flattenSupported (model.obj world)
  natural := by
    intro first second injection family
    exact
      (flattenRaw_mapRaw_natural
        (model.reindex injection).toContinuousHom
        family).symm

/-- Multiplication of the supported world power monad. -/
def powerMultiplication :
    powerFunctor ⋙ powerFunctor ⟶
      powerFunctor where
  app := multiplicationApp
  naturality := by
    intro source target morphism
    apply Hom.ext_apply
    intro world family
    exact
      flattenRaw_mapRaw_natural
        (morphism.app world).toContinuousHom
        family

/--
The lower omega-Scott monad lifted to exact-support finite-world models.
-/
def powerMonad :
    CategoryTheory.Monad SupportedWorldModel.{u} where
  toFunctor := powerFunctor
  η := powerUnit
  μ := powerMultiplication
  assoc model := by
    apply Hom.ext_apply
    intro world family
    exact flattenRaw_assoc family
  left_unit model := by
    apply Hom.ext_apply
    intro world values
    exact flattenRaw_principal values
  right_unit model := by
    apply Hom.ext_apply
    intro world values
    exact flattenRaw_mapRaw_principal values

/-! ## Choice and explicit operational equations across worlds -/

/-- Direct image preserves binary lower choice. -/
theorem mapRaw_choice
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β)
    (left right : OmegaScottPower α) :
    mapRaw function (left ⊔ right) =
      mapRaw function left ⊔
        mapRaw function right := by
  apply le_antisymm
  · apply
      (mapRaw_le_iff
        function
        (left ⊔ right)
        (mapRaw function left ⊔
          mapRaw function right)).2
    apply sup_le
    · exact
        (mapRaw_le_iff
          function left
          (mapRaw function left ⊔
            mapRaw function right)).1
          le_sup_left
    · exact
        (mapRaw_le_iff
          function right
          (mapRaw function left ⊔
            mapRaw function right)).1
          le_sup_right
  · apply sup_le
    · exact mapRaw_monotone function le_sup_left
    · exact mapRaw_monotone function le_sup_right

/-- World reindexing commutes with finite nondeterministic choice. -/
theorem powerReindex_choice
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject)
    (left right : OmegaScottPower sourceObject.Carrier) :
    powerReindex morphism (choice (left, right)) =
      choice
        (powerReindex morphism left,
          powerReindex morphism right) :=
  mapRaw_choice morphism.toContinuousHom left right

/-- World reindexing commutes with return. -/
theorem powerReindex_principal
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject)
    (value : sourceObject.Carrier) :
    powerReindex morphism (principalRaw value) =
      principalRaw (morphism value) :=
  mapRaw_principal morphism.toContinuousHom value

/-- World reindexing commutes with monad multiplication. -/
theorem powerReindex_flatten
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject)
    (family :
      OmegaScottPower
        (OmegaScottPower sourceObject.Carrier)) :
    powerReindex morphism (flattenRaw family) =
      flattenRaw
        (powerReindex (powerReindex morphism) family) :=
  (flattenRaw_mapRaw_natural
    morphism.toContinuousHom family).symm

/--
The support of a returned, reindexed value is the exact direct image of its
source support.
-/
theorem powerSupport_principal_reindex
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject)
    (value : sourceObject.Carrier) :
    powerSupport targetObject
        (principalRaw (morphism value)) =
      mapSupport injection
        (sourceObject.support value) := by
  rw [powerSupport_principalRaw, morphism.support_map]

/--
After transporting both alternatives, binary choice has exactly the direct
image of the source choice support.
-/
theorem powerSupport_choice_reindex
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject)
    (left right :
      OmegaScottPower sourceObject.Carrier) :
    powerSupport targetObject
        (choice
          (powerReindex morphism left,
            powerReindex morphism right)) =
      mapSupport injection
        (powerSupport sourceObject
          (choice (left, right))) := by
  rw [← powerReindex_choice morphism left right]
  exact
    powerSupport_mapRaw_reindex
      morphism (choice (left, right))

/--
After transporting a nested family, flattening has exactly the direct image
of the source flattened support.
-/
theorem powerSupport_flatten_reindex
    {source target : World}
    {injection : Injection source target}
    {sourceObject : SupportedOmegaCpo.{0, u} (Fin source)}
    {targetObject : SupportedOmegaCpo.{0, u} (Fin target)}
    (morphism :
      ReindexHom injection sourceObject targetObject)
    (family :
      OmegaScottPower
        (OmegaScottPower sourceObject.Carrier)) :
    powerSupport targetObject
        (flattenRaw
          (powerReindex (powerReindex morphism) family)) =
      mapSupport injection
        (powerSupport sourceObject
          (flattenRaw family)) := by
  rw [← powerReindex_flatten morphism family]
  exact
    powerSupport_mapRaw_reindex
      morphism (flattenRaw family)

/-! ## A nonconstant exact-support world model -/

/--
At world `n`, finite supports themselves form an equality-ordered supported
omega-CPO.  Its support map is the carried finite set.
-/
def finiteSupportObject
    (world : World) :
    SupportedOmegaCpo.{0, 0} (Fin world) where
  Carrier :=
    EqualityOrder (Support world)
  omega := inferInstance
  support := fun value => value
  support_mono := by
    intro left right equal
    subst right
    exact Finset.Subset.rfl
  support_omegaSup_bounded := by
    intro chain
    exact ⟨0, Finset.Subset.rfl⟩

/-- Every finite injection transports the concrete support carrier exactly. -/
def finiteSupportReindex
    {source target : World}
    (injection : Injection source target) :
    ReindexHom
      injection
      (finiteSupportObject source)
      (finiteSupportObject target) where
  toContinuousHom :=
    EqualityOrder.continuous (mapSupport injection)
  support_map := by
    intro support
    rfl

/-- The concrete nonconstant finite-support model over all finite worlds. -/
def finiteSupportWorldModel :
    SupportedWorldModel.{0} where
  obj := finiteSupportObject
  reindex := finiteSupportReindex
  reindex_id := by
    intro world support
    exact mapSupport_identity world support
  reindex_comp := by
    intro first second third left right support
    exact mapSupport_comp left right support

/--
Its pointwise lower power is a genuine, nonconstant, exact-support
finite-world model.
-/
def poweredFiniteSupportWorldModel :
    SupportedWorldModel.{0} :=
  powerModel finiteSupportWorldModel

end SupportedWorldModel

end Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport
