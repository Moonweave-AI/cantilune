import Cantilune.Pi.FMSCpoWorld
import Mathlib.Data.Fin.Tuple.Basic

/-!
# Canonical transport for the FMS name-abstraction component

For a covariant model `X : I ⥤ ωCPO`, the input/name-abstraction component
at world `n` has carrier

`(Fin n → X n) × X (n + 1)`.

Along an injection `i : n ⟶ m`, an old target name is interpreted through
the corresponding old continuation.  Every name outside the image of `i`
determines the unique extension `n + 1 ⟶ m` which sends the distinguished
fresh name to that target name, and is interpreted through the fresh
continuation.

This file constructs that operation for every actual `ωCPO^I` model and
proves both defining equations.  Functoriality of the complete abstraction
object and the finite separated coproducts used by the full action functor
remain separate obligations.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoInputTransport

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.Worlds

/--
Extend a finite injection by one distinguished source name, sending that
fresh source name to a chosen target name outside the old image.
-/
def extendByName
    {source target : World}
    (injection : source ⟶ target)
    (newName : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = newName) :
    source + 1 ⟶ target where
  toFun :=
    Fin.snoc
      (fun old => homToFun injection old)
      newName
  injective := by
    apply (Fin.snoc_injective_iff).2
    constructor
    · exact (asInjection injection).injective
    · intro member
      rcases member with ⟨old, equality⟩
      exact outside ⟨old, equality⟩

@[simp]
theorem extendByName_castSucc
    {source target : World}
    (injection : source ⟶ target)
    (newName : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = newName)
    (old : Fin source) :
    homToFun (extendByName injection newName outside)
        (Fin.castSucc old) =
      homToFun injection old := by
  simp [extendByName, homToFun, asInjection]

@[simp]
theorem extendByName_last
    {source target : World}
    (injection : source ⟶ target)
    (newName : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = newName) :
    homToFun (extendByName injection newName outside)
        (Fin.last source) =
      newName := by
  simp [extendByName, homToFun, asInjection]

/--
Any injection extending `injection` and sending the distinguished fresh
source name to `newName` is the canonical `extendByName`.
-/
theorem extendByName_unique
    {source target : World}
    (injection : source ⟶ target)
    (newName : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = newName)
    (extension : source + 1 ⟶ target)
    (oldAgreement :
      ∀ old : Fin source,
        homToFun extension (Fin.castSucc old) =
          homToFun injection old)
    (freshAgreement :
      homToFun extension (Fin.last source) = newName) :
    extendByName injection newName outside = extension := by
  apply Injection.ext
  intro value
  cases value using Fin.lastCases with
  | cast old =>
      exact extendByName_castSucc
        injection newName outside old |>.trans
          (oldAgreement old).symm
  | last =>
      exact extendByName_last
        injection newName outside |>.trans
          freshAgreement.symm

/--
The canonical action of a world injection on the known-name component of
`X(n)^n × X(n+1)`.
-/
def inputKnownTransport
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (known : Fin source → model.obj source)
    (fresh : model.obj (source + 1))
    (name : Fin target) :
    model.obj target :=
  if oldWitness :
      ∃ old : Fin source,
        homToFun injection old = name
  then
    model.map injection
      (known (Classical.choose oldWitness))
  else
    model.map
      (extendByName injection name oldWitness)
      fresh

/-- Old names are transported through the old continuation. -/
theorem inputKnownTransport_old
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (known : Fin source → model.obj source)
    (fresh : model.obj (source + 1))
    (old : Fin source) :
    inputKnownTransport model injection known fresh
        (homToFun injection old) =
      model.map injection (known old) := by
  rw [inputKnownTransport]
  split_ifs with oldWitness
  · have chosenMaps :
        homToFun injection
            (Classical.choose oldWitness) =
          homToFun injection old :=
      Classical.choose_spec oldWitness
    have chosenEq :
        Classical.choose oldWitness = old :=
      (asInjection injection).injective chosenMaps
    rw [chosenEq]
  · exact (oldWitness ⟨old, rfl⟩).elim

/--
The fresh defining equation is independent of how an extension is supplied:
injectivity forces every such extension to be the canonical extension.
-/
theorem inputKnownTransport_fresh
    (model : World ⥤ ωCPO)
    {source target : World}
    (injection : source ⟶ target)
    (known : Fin source → model.obj source)
    (fresh : model.obj (source + 1))
    (newName : Fin target)
    (extension : source + 1 ⟶ target)
    (oldAgreement :
      ∀ old : Fin source,
        homToFun extension (Fin.castSucc old) =
          homToFun injection old)
    (freshAgreement :
      homToFun extension (Fin.last source) = newName) :
    inputKnownTransport model injection known fresh newName =
      model.map extension fresh := by
  have outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = newName := by
    rintro ⟨old, oldMaps⟩
    have collision :
        homToFun extension (Fin.castSucc old) =
          homToFun extension (Fin.last source) := by
      rw [oldAgreement old, oldMaps, freshAgreement]
    have sourceCollision :
        Fin.castSucc old = Fin.last source :=
      (asInjection extension).injective collision
    exact Fin.castSucc_ne_last old sourceCollision
  rw [inputKnownTransport, dif_neg outside]
  rw [extendByName_unique
    injection newName outside extension
    oldAgreement freshAgreement]

/-- The canonical input transport is natural in the model argument. -/
theorem inputKnownTransport_model_natural
    {sourceModel targetModel : World ⥤ ωCPO}
    (transformation : sourceModel ⟶ targetModel)
    {source target : World}
    (injection : source ⟶ target)
    (known : Fin source → sourceModel.obj source)
    (fresh : sourceModel.obj (source + 1))
    (name : Fin target) :
    inputKnownTransport targetModel injection
        (fun old => transformation.app source (known old))
        (transformation.app (source + 1) fresh)
        name =
      transformation.app target
        (inputKnownTransport sourceModel injection
          known fresh name) := by
  rw [inputKnownTransport, inputKnownTransport]
  split_ifs with oldWitness
  · have naturality :=
      transformation.naturality injection
    exact
      (ContinuousHom.congr_fun
        naturality.symm
        (known (Classical.choose oldWitness)))
  · have naturality :=
      transformation.naturality
        (extendByName injection name oldWitness)
    exact
      (ContinuousHom.congr_fun
        naturality.symm fresh)

/-- Transport along an identity world injection is the original family. -/
theorem inputKnownTransport_identity
    (model : World ⥤ ωCPO)
    (world : World)
    (known : Fin world → model.obj world)
    (fresh : model.obj (world + 1)) :
    inputKnownTransport model (𝟙 world)
        known fresh =
      known := by
  funext name
  simpa using
    inputKnownTransport_old model (𝟙 world)
      known fresh name

/--
Canonical input transport respects composition of finite-world injections.

The proof distinguishes a target name already present at the intermediate
world from one freshly added after it.  In both cases uniqueness of
`extendByName` identifies the direct extension with the corresponding
composite extension.
-/
theorem inputKnownTransport_comp
    (model : World ⥤ ωCPO)
    {first second third : World}
    (left : first ⟶ second)
    (right : second ⟶ third)
    (known : Fin first → model.obj first)
    (fresh : model.obj (first + 1)) :
    inputKnownTransport model (left ≫ right)
        known fresh =
      inputKnownTransport model right
        (inputKnownTransport model left known fresh)
        (model.map
          (Cantilune.Pi.FMSCpoWorld.successorWorld.map left)
          fresh) := by
  funext name
  by_cases throughMiddle :
      ∃ middle : Fin second,
        homToFun right middle = name
  · obtain ⟨middle, middleMaps⟩ := throughMiddle
    rw [← middleMaps]
    rw [inputKnownTransport_old
      model right
      (inputKnownTransport model left known fresh)
      (model.map
        (Cantilune.Pi.FMSCpoWorld.successorWorld.map left)
        fresh)
      middle]
    by_cases fromOld :
        ∃ old : Fin first,
          homToFun left old = middle
    · obtain ⟨old, oldMaps⟩ := fromOld
      have compositeMaps :
          homToFun (left ≫ right) old =
            homToFun right middle := by
        simp [oldMaps]
      rw [← compositeMaps]
      rw [inputKnownTransport_old
        model (left ≫ right) known fresh old]
      rw [← oldMaps]
      rw [inputKnownTransport_old
        model left known fresh old]
      rw [model.map_comp]
      rfl
    · let extension : first + 1 ⟶ second :=
        extendByName left middle fromOld
      have extensionOld :
          ∀ old : Fin first,
            homToFun (extension ≫ right)
                (Fin.castSucc old) =
              homToFun (left ≫ right) old := by
        intro old
        simp [extension]
      have extensionFresh :
          homToFun (extension ≫ right)
              (Fin.last first) =
            homToFun right middle := by
        simp [extension]
      rw [inputKnownTransport_fresh
        model (left ≫ right) known fresh
        (homToFun right middle)
        (extension ≫ right)
        extensionOld extensionFresh]
      rw [inputKnownTransport_fresh
        model left known fresh middle extension
        (extendByName_castSucc left middle fromOld)
        (extendByName_last left middle fromOld)]
      rw [model.map_comp]
      rfl
  · let extension : second + 1 ⟶ third :=
      extendByName right name throughMiddle
    have directOld :
        ∀ old : Fin first,
          homToFun
              (Cantilune.Pi.FMSCpoWorld.successorWorld.map left ≫
                extension)
              (Fin.castSucc old) =
            homToFun (left ≫ right) old := by
      intro old
      calc
        homToFun
            (Cantilune.Pi.FMSCpoWorld.successorWorld.map left ≫
              extension)
            (Fin.castSucc old) =
          homToFun extension
            (Fin.castSucc (homToFun left old)) := by
              change
                homToFun extension
                    (Cantilune.Pi.FMSCpoWorld.Injection.succ
                      (asInjection left) (Fin.castSucc old)) =
                  _
              rw [
                Cantilune.Pi.FMSCpoWorld.Injection.succ_castSucc]
              rfl
        _ = homToFun right (homToFun left old) := by
          exact
            extendByName_castSucc right name
              throughMiddle (homToFun left old)
        _ = homToFun (left ≫ right) old := rfl
    have directFresh :
        homToFun
            (Cantilune.Pi.FMSCpoWorld.successorWorld.map left ≫
              extension)
            (Fin.last first) =
          name := by
      calc
        homToFun
            (Cantilune.Pi.FMSCpoWorld.successorWorld.map left ≫
              extension)
            (Fin.last first) =
          homToFun extension (Fin.last second) := by
            change
              homToFun extension
                  (Cantilune.Pi.FMSCpoWorld.Injection.succ
                    (asInjection left) (Fin.last first)) =
                _
            rw [
              Cantilune.Pi.FMSCpoWorld.Injection.succ_last]
        _ = name :=
          extendByName_last right name throughMiddle
    rw [inputKnownTransport_fresh
      model (left ≫ right) known fresh name
      (Cantilune.Pi.FMSCpoWorld.successorWorld.map left ≫
        extension)
      directOld directFresh]
    rw [inputKnownTransport_fresh
      model right
      (inputKnownTransport model left known fresh)
      (model.map
        (Cantilune.Pi.FMSCpoWorld.successorWorld.map left)
        fresh)
      name extension
      (extendByName_castSucc right name throughMiddle)
      (extendByName_last right name throughMiddle)]
    rw [model.map_comp]
    rfl

/--
For every chosen target name outside the old image, the canonical extension
exists uniquely.  This is the finite-world combinatorial fact needed by the
input action; it does not appeal to an external FMS package.
-/
theorem exists_unique_fresh_extension
    {source target : World}
    (injection : source ⟶ target)
    (newName : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = newName) :
    ∃! extension : source + 1 ⟶ target,
      (∀ old : Fin source,
        homToFun extension (Fin.castSucc old) =
          homToFun injection old) ∧
      homToFun extension (Fin.last source) = newName := by
  refine
    ⟨extendByName injection newName outside,
      ?_, ?_⟩
  · constructor
    · exact extendByName_castSucc injection newName outside
    · exact extendByName_last injection newName outside
  · intro extension properties
    exact
      (extendByName_unique injection newName outside
        extension properties.1 properties.2).symm

end Cantilune.Pi.FMSCpoInputTransport
