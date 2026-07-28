import Cantilune.Pi.FMSExternalPackage
import Mathlib.CategoryTheory.Adjunction.Basic

/-!
# The category of nondeterministic omega-CPO computations

The FMS powerdomain is the monad induced by a Cpo-enriched left adjoint to
the forgetful functor from nondeterministic computations.  This file
mechanizes the underlying ordinary category:

* objects carry an order-theoretic least divergence, a semilattice identity
  deadlock, and continuous idempotent commutative choice;
* arrows are continuous maps preserving all three pieces of structure;
* the carrier functor to `ωCPO` is faithful.

It also verifies a load-bearing interface fact.  Any supplied
`CpoPowerdomainPackage` determines a free-object functor and its existing
`freeLift` laws construct an ordinary adjunction to the carrier functor.
Thus the package really does encode an ordinary free pointed-semilattice
universal property, rather than merely storing unrelated operations.

The converse is deliberately absent.  An ordinary adjunction alone does not
construct the required Cpo-enrichment, divergence/deadlock separation,
commutative Fubini maps, recursive domain solution, hiding, adequacy, or full
abstraction.  No `CpoPowerdomainPackage` is constructed here.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicCategory

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage

universe u

/-! ## Objects and strict semilattice arrows -/

/-- A bundled object of the FMS category of nondeterministic computations. -/
structure NDωCPO where
  computation : NondeterministicComputation

namespace NDωCPO

/-- The underlying omega-CPO carrier. -/
abbrev carrier (object : NDωCPO) : ωCPO :=
  object.computation.carrier

/-- A continuous strict semilattice homomorphism. -/
@[ext]
structure Hom (source target : NDωCPO) where
  hom : source.carrier ⟶ target.carrier
  map_divergence :
    hom source.computation.divergence =
      target.computation.divergence
  map_deadlock :
    hom source.computation.deadlock =
      target.computation.deadlock
  map_choice :
    ∀ left right,
      hom (source.computation.choice (left, right)) =
        target.computation.choice (hom left, hom right)

instance : Category NDωCPO where
  Hom := Hom
  id object :=
    { hom := 𝟙 object.carrier
      map_divergence := rfl
      map_deadlock := rfl
      map_choice := by
        intro left right
        rfl }
  comp := fun {source _ target} first second =>
    { hom := first.hom ≫ second.hom
      map_divergence := by
        change
          second.hom
              (first.hom source.computation.divergence) =
            target.computation.divergence
        rw [first.map_divergence, second.map_divergence]
      map_deadlock := by
        change
          second.hom
              (first.hom source.computation.deadlock) =
            target.computation.deadlock
        rw [first.map_deadlock, second.map_deadlock]
      map_choice := by
        intro left right
        change
          second.hom
              (first.hom
                (source.computation.choice (left, right))) =
            target.computation.choice
              (second.hom (first.hom left),
                second.hom (first.hom right))
        rw [first.map_choice, second.map_choice] }

@[simp]
theorem id_hom (object : NDωCPO) :
    (𝟙 object : object ⟶ object).hom =
      𝟙 object.carrier :=
  rfl

@[simp]
theorem comp_hom
    {first second third : NDωCPO}
    (left : first ⟶ second)
    (right : second ⟶ third) :
    (left ≫ right).hom = left.hom ≫ right.hom :=
  rfl

/-- Forget all nondeterministic structure. -/
def forget : NDωCPO ⥤ ωCPO where
  obj object := object.carrier
  map morphism := morphism.hom

instance forget_faithful : forget.Faithful where
  map_injective equality := Hom.ext equality

/-! ## The free functor supplied by an accepted powerdomain package -/

/-- The free nondeterministic object encoded by a powerdomain package. -/
def freeObject
    (power : CpoPowerdomainPackage)
    (source : ωCPO) :
    NDωCPO :=
  ⟨power.computation source⟩

/-- Functorial action as a strict semilattice homomorphism. -/
def freeMap
    (power : CpoPowerdomainPackage)
    {source target : ωCPO}
    (morphism : source ⟶ target) :
    freeObject power source ⟶ freeObject power target where
  hom := power.monad.map morphism
  map_divergence := power.map_divergence morphism
  map_deadlock := power.map_empty morphism
  map_choice := power.map_choice morphism

/--
Every supplied powerdomain package determines an ordinary free-object
functor.  This construction uses only its monad functor and the three
structure-preservation laws.
-/
def freeFunctor
    (power : CpoPowerdomainPackage) :
    ωCPO ⥤ NDωCPO where
  obj := freeObject power
  map := freeMap power
  map_id object := by
    apply Hom.ext
    exact power.monad.toFunctor.map_id object
  map_comp first second := by
    apply Hom.ext
    exact power.monad.toFunctor.map_comp first second

@[simp]
theorem freeFunctor_obj_carrier
    (power : CpoPowerdomainPackage)
    (source : ωCPO) :
    ((freeFunctor power).obj source).carrier =
      power.monad.obj source :=
  rfl

@[simp]
theorem freeFunctor_map_hom
    (power : CpoPowerdomainPackage)
    {source target : ωCPO}
    (morphism : source ⟶ target) :
    ((freeFunctor power).map morphism).hom =
      power.monad.map morphism :=
  rfl

/-! ## Free extension as a hom-set equivalence -/

/-- Package `freeLift` as a strict semilattice arrow. -/
def liftHom
    (power : CpoPowerdomainPackage)
    (source : ωCPO)
    (target : NDωCPO)
    (generator : source ⟶ target.carrier) :
    (freeFunctor power).obj source ⟶ target where
  hom :=
    power.freeLift source target.computation generator
  map_divergence :=
    power.freeLift_divergence
      source target.computation generator
  map_deadlock :=
    power.freeLift_empty
      source target.computation generator
  map_choice :=
    power.freeLift_choice
      source target.computation generator

/-- Restrict a strict semilattice arrow along the powerdomain unit. -/
def restrictHom
    (power : CpoPowerdomainPackage)
    (source : ωCPO)
    (target : NDωCPO)
    (morphism : (freeFunctor power).obj source ⟶ target) :
    source ⟶ (forget.obj target) :=
  power.monad.η.app source ≫ morphism.hom

theorem lift_restrict
    (power : CpoPowerdomainPackage)
    (source : ωCPO)
    (target : NDωCPO)
    (morphism : (freeFunctor power).obj source ⟶ target) :
    liftHom power source target
        (restrictHom power source target morphism) =
      morphism := by
  apply Hom.ext
  exact
    (power.freeLift_unique
      source target.computation
      (restrictHom power source target morphism)
      morphism.hom
      rfl
      morphism.map_divergence
      morphism.map_deadlock
      morphism.map_choice).symm

theorem restrict_lift
    (power : CpoPowerdomainPackage)
    (source : ωCPO)
    (target : NDωCPO)
    (generator : source ⟶ forget.obj target) :
    restrictHom power source target
        (liftHom power source target generator) =
      generator :=
  power.freeLift_unit
    source target.computation generator

/-- The ordinary free/forgetful hom-set equivalence. -/
def freeForgetHomEquiv
    (power : CpoPowerdomainPackage)
    (source : ωCPO)
    (target : NDωCPO) :
    ((freeFunctor power).obj source ⟶ target) ≃
      (source ⟶ forget.obj target) where
  toFun := restrictHom power source target
  invFun := liftHom power source target
  left_inv := lift_restrict power source target
  right_inv := restrict_lift power source target

/-!
The two following naturality lemmas are proved from the package's
universality.  They are not added as further fields.
-/

theorem lift_precomp
    (power : CpoPowerdomainPackage)
    {source' source : ωCPO}
    (before : source' ⟶ source)
    (target : NDωCPO)
    (generator : source ⟶ forget.obj target) :
    liftHom power source' target (before ≫ generator) =
      (freeFunctor power).map before ≫
        liftHom power source target generator := by
  apply Hom.ext
  symm
  apply
    (power.freeLift_unique
      source' target.computation
      (before ≫ generator)
      (((freeFunctor power).map before ≫
        liftHom power source target generator).hom))
  · change
      power.monad.η.app source' ≫
          power.monad.map before ≫
            power.freeLift source target.computation generator =
        before ≫ generator
    rw [← Category.assoc]
    rw [← power.monad.η.naturality before]
    rw [Category.assoc]
    rw [power.freeLift_unit]
    simp
    rfl
  · exact
      ((freeFunctor power).map before ≫
        liftHom power source target generator).map_divergence
  · exact
      ((freeFunctor power).map before ≫
        liftHom power source target generator).map_deadlock
  · exact
      ((freeFunctor power).map before ≫
        liftHom power source target generator).map_choice

theorem restrict_postcomp
    (power : CpoPowerdomainPackage)
    (source : ωCPO)
    {target target' : NDωCPO}
    (morphism : (freeFunctor power).obj source ⟶ target)
    (after : target ⟶ target') :
    restrictHom power source target' (morphism ≫ after) =
      restrictHom power source target morphism ≫
        forget.map after := by
  simp only [restrictHom, comp_hom, forget]
  rfl

/--
The hom-set equivalence together with both categorical naturality laws.
This is the exact input consumed by mathlib's ordinary-adjunction
constructor.
-/
def freeForgetCoreHomEquiv
    (power : CpoPowerdomainPackage) :
    Adjunction.CoreHomEquiv
      (freeFunctor power) forget :=
    { homEquiv := freeForgetHomEquiv power
      homEquiv_naturality_left_symm := by
        intro source' source target before generator
        exact lift_precomp power before target generator
      homEquiv_naturality_right := by
        intro source target target' morphism after
        exact restrict_postcomp power source morphism after }

/--
The corrected powerdomain acceptance record entails the ordinary
free/forgetful adjunction.

This theorem is one-way: it validates the record's universal-property
content but does not construct a record or discharge the enriched
adjoint-functor existence argument.
-/
def freeForgetAdjunction
    (power : CpoPowerdomainPackage) :
    freeFunctor power ⊣ forget :=
  Adjunction.mkOfHomEquiv
    (freeForgetCoreHomEquiv power)

@[simp]
theorem freeForgetAdjunction_homEquiv_apply
    (power : CpoPowerdomainPackage)
    (source : ωCPO)
    (target : NDωCPO)
    (morphism : (freeFunctor power).obj source ⟶ target) :
    (freeForgetAdjunction power).homEquiv source target morphism =
      restrictHom power source target morphism := by
  change
    ((Adjunction.mkOfHomEquiv
      (freeForgetCoreHomEquiv power)).homEquiv
        source target) morphism =
      restrictHom power source target morphism
  rw [Adjunction.mkOfHomEquiv_homEquiv]
  rfl

end NDωCPO

end Cantilune.Pi.FMSCpoNondeterministicCategory
