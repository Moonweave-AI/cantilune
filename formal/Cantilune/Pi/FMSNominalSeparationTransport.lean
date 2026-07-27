import Cantilune.Pi.FMSFiniteSupportSeparation
import Cantilune.Pi.NominalFiniteSupport

/-!
# Nominal transport of finite separation algebras

Finite-world injections act on resource supports by direct image.  This
module proves that the action is a faithful transport of the concrete
finite-set partial commutative monoid:

* compatibility is preserved and reflected;
* a partial composition exists after renaming exactly when it existed before;
* the renamed composite is exactly the composite of the renamed operands; and
* identity and sequential renaming agree with the world category.

Thus allocation and alpha-renaming do not merely preserve support
cardinality: they preserve the partial separation operation itself.  This is
the bridge from the nominal support model to the separated tensor predicate.
It does not construct a powerdomain or assert Fubini laws for effects.
-/

namespace Cantilune.Pi.FMSNominalSeparationTransport

open Cantilune.Pi.Worlds
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSFiniteSupportSeparation
open Cantilune.Pi.NominalFiniteSupport

/-- Rename a concrete finite-set PCM carrier along a finite-world injection. -/
def renameCarrier
    {source target : World}
    (injection : Injection source target) :
    Support source → Support target :=
  mapSupport injection

@[simp]
theorem renameCarrier_empty
    {source target : World}
    (injection : Injection source target) :
    renameCarrier injection (∅ : Support source) =
      (∅ : Support target) := by
  simp [renameCarrier, mapSupport]

/-- Nominal renaming preserves and reflects PCM compatibility. -/
@[simp]
theorem compatible_rename_iff
    {source target : World}
    (injection : Injection source target)
    (left right : Support source) :
    (FinsetPCM.algebra (Fin target)).Compatible
        (renameCarrier injection left)
        (renameCarrier injection right) ↔
      (FinsetPCM.algebra (Fin source)).Compatible left right := by
  exact disjoint_mapSupport_iff injection left right

/--
The concrete partial composition is transported faithfully by every world
injection.
-/
@[simp]
theorem compose_rename_iff
    {source target : World}
    (injection : Injection source target)
    (left right result : Support source) :
    (FinsetPCM.algebra (Fin target)).Compose
        (renameCarrier injection left)
        (renameCarrier injection right)
        (renameCarrier injection result) ↔
      (FinsetPCM.algebra (Fin source)).Compose
        left right result := by
  change
    (Disjoint
          (mapSupport injection left)
          (mapSupport injection right) ∧
        mapSupport injection result =
          mapSupport injection left ∪
            mapSupport injection right) ↔
      (Disjoint left right ∧ result = left ∪ right)
  constructor
  · rintro ⟨separated, resultEquation⟩
    refine
      ⟨(disjoint_mapSupport_iff
          injection left right).mp separated, ?_⟩
    apply mapSupport_injective injection
    simpa using resultEquation
  · rintro ⟨separated, rfl⟩
    exact
      ⟨(disjoint_mapSupport_iff
          injection left right).mpr separated,
        mapSupport_union injection left right⟩

/-- Forward-use form of `compose_rename_iff`. -/
theorem compose_rename
    {source target : World}
    (injection : Injection source target)
    {left right result : Support source}
    (composition :
      (FinsetPCM.algebra (Fin source)).Compose
        left right result) :
    (FinsetPCM.algebra (Fin target)).Compose
      (renameCarrier injection left)
      (renameCarrier injection right)
      (renameCarrier injection result) :=
  (compose_rename_iff injection left right result).mpr composition

/-- Reflection form: renamed composition cannot create source compatibility. -/
theorem compose_reflect
    {source target : World}
    (injection : Injection source target)
    {left right result : Support source}
    (composition :
      (FinsetPCM.algebra (Fin target)).Compose
        (renameCarrier injection left)
        (renameCarrier injection right)
        (renameCarrier injection result)) :
    (FinsetPCM.algebra (Fin source)).Compose
      left right result :=
  (compose_rename_iff injection left right result).mp composition

@[simp]
theorem renameCarrier_identity
    (world : World)
    (support : Support world) :
    renameCarrier (Injection.identity world) support = support :=
  mapSupport_identity world support

@[simp]
theorem renameCarrier_comp
    {first second third : World}
    (left : Injection first second)
    (right : Injection second third)
    (support : Support first) :
    renameCarrier (left.comp right) support =
      renameCarrier right (renameCarrier left support) :=
  mapSupport_comp left right support

end Cantilune.Pi.FMSNominalSeparationTransport
