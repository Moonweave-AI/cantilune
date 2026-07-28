import Cantilune.Pi.FMSContext
import Cantilune.Pi.FMSCanonicalHidingSyntax
import Cantilune.Pi.FMSBinderInstantiation
import Cantilune.Pi.FMSOperationalSyntaxBridge
import Cantilune.Pi.Late
import Cantilune.Pi.FMSCpoContext
import Cantilune.Pi.FMSCpoFiniteAgent
import Cantilune.Pi.FMSCpoWorld
import Mathlib.CategoryTheory.Endofunctor.Algebra
import Mathlib.CategoryTheory.Monad.Types
import Mathlib.CategoryTheory.Whiskering
import Mathlib.Order.Category.OmegaCompletePartialOrder

/-!
# Versioned external boundary for the CPO FMS theorem

Mathlib supplies `ωCPO`, continuous maps, endofunctor algebras, and ordinary
category-theoretic monads.  It does not currently supply the Abramsky
powerdomain used by Fiore--Moggi--Sangiorgi, the required enriched
initial-domain-equation solution, or their late-π full-abstraction proof.

This file therefore defines a strict *input package*.  Every mathematical
claim is a proof field of a structure.  No inhabitant, postulate, instance,
or choice of fake semantics is provided.  A future mechanization or checked
external importer must construct all layers explicitly.
-/

noncomputable section

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits

namespace Cantilune.Pi.FMSExternalPackage

open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open OmegaCompletePartialOrder

/-! ## Internally mechanized fragment -/

/--
The concrete part of the FMS route that Cantilune now constructs internally.

This record deliberately stops before `CpoPowerdomainPackage`: finite
powerset is a monad on the equality-ordered/discrete CPO subcategory, not on
all of `ωCPO`, and therefore cannot be coerced into Abramsky's powerdomain.
-/
structure MechanizedCpoFragment where
  discretePower :
    CategoryTheory.Monad FMSCpoFinitePower.DiscreteCPO
  shift :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO)
  allocate :
    ∀ model : World ⥤ ωCPO, model ⟶ shift.obj model
  supportHiding :
    shift.obj FMSModel.cpoAgent ⟶ FMSModel.cpoAgent
  supportedSyntax : World ⥤ ωCPO
  supportDenotation :
    supportedSyntax ⟶ FMSModel.cpoAgent
  finiteAgentEquation :
    ∀ world,
      FMSCpoFiniteAgent.agentCpo world ≅
        FMSCpoFiniteAgent.layerCpo world
  finiteApproximationEquation :
    ∀ depth world,
      FMSCpoFiniteAgent.approximationCpo (depth + 1) world ≅
        ωCPO.of
          (FMSCpoFinitePower.EqualityOrder
            (FMSFinitePower.FinitePower
              (FMSFiniteAgent.ActionShape
                (FMSFiniteAgent.Approximation depth) world)))

/--
An actual inhabitant aggregating all internally proved CPO/finite results.
It contains no field for the unconstructed Abramsky powerdomain, enriched
initial domain solution, agent restriction, or full-abstraction theorem.
-/
def mechanizedCpoFragment : MechanizedCpoFragment where
  discretePower := FMSCpoFinitePower.finitePowerMonad
  shift := FMSCpoWorld.shift
  allocate := FMSCpoWorld.allocate
  supportHiding := FMSCpoWorld.supportHiding
  supportedSyntax := FMSCpoContext.processCpoModel
  supportDenotation := FMSCpoContext.cpoSupportDenotation
  finiteAgentEquation := FMSCpoFiniteAgent.agentLayerIso
  finiteApproximationEquation :=
    FMSCpoFiniteAgent.approximationIso

/-- Exact provenance required of an imported theorem package. -/
structure SourcePin where
  title : String
  authors : List String
  venue : String
  year : Nat
  doi : String
  artifact : String
  theoremRevision : String
deriving DecidableEq

/-- The paper revision against which this interface was audited. -/
def fmsLics1996 : SourcePin where
  title := "A fully abstract model for the pi-calculus"
  authors :=
    ["Marcelo Fiore", "Eugenio Moggi", "Davide Sangiorgi"]
  venue := "11th Annual IEEE Symposium on Logic in Computer Science"
  year := 1996
  doi := "10.1109/LICS.1996.561302"
  artifact := "https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf"
  theoremRevision := "LICS 1996 proceedings paper; author-hosted PDF"

/--
The complete journal revision is the acceptance pin for an imported FMS
theorem package.  The LICS paper above is an extended abstract and explicitly
omits parts of the categorical/domain-theoretic development; it is retained
as provenance, but is not sufficient by itself for the external proof input.
-/
def fmsJournal2002 : SourcePin where
  title := "A Fully Abstract Model for the pi-calculus"
  authors :=
    ["Marcelo Fiore", "Eugenio Moggi", "Davide Sangiorgi"]
  venue := "Information and Computation 179(1), 76-117"
  year := 2002
  doi := "10.1006/inco.2002.2968"
  artifact := "https://person.dibris.unige.it/moggi-eugenio/ftp/ic00.pdf"
  theoremRevision :=
    "author-hosted extended manuscript corresponding to Information and Computation 179(1), 25 November 2002; DOI is the publication pin"

/--
A continuous join-semilattice with bottom.  Laws are stated on the actual
continuous binary operation, not on an unbundled placeholder function.
-/
structure ContinuousJoinSemilattice where
  carrier : ωCPO
  bottom : carrier
  choice : ωCPO.of (carrier × carrier) ⟶ carrier
  choice_assoc :
    ∀ left middle right,
      choice (choice (left, middle), right) =
        choice (left, choice (middle, right))
  choice_comm :
    ∀ left right, choice (left, right) = choice (right, left)
  choice_idem :
    ∀ value, choice (value, value) = value
  bottom_choice :
    ∀ value, choice (bottom, value) = value

/--
An object of the strengthened Cantilune category of nondeterministic
computations.

The order-theoretic least element `divergence` and the semilattice identity
`deadlock` are stored as separate fields.  The FMS source writes these as
`⊥` and `0`, but does not impose their disequality.  This structure likewise
does not impose disequality; the later `CpoPowerdomainPackage` interface does,
as an additional Cantilune acceptance condition.
-/
structure NondeterministicComputation where
  carrier : ωCPO
  divergence : carrier
  divergence_le : ∀ value, divergence ≤ value
  deadlock : carrier
  choice : ωCPO.of (carrier × carrier) ⟶ carrier
  choice_assoc :
    ∀ left middle right,
      choice (choice (left, middle), right) =
        choice (left, choice (middle, right))
  choice_comm :
    ∀ left right, choice (left, right) = choice (right, left)
  choice_idem :
    ∀ value, choice (value, value) = value
  deadlock_choice :
    ∀ value, choice (deadlock, value) = value

namespace NondeterministicComputation

/--
Forget the order-theoretic least element while retaining the continuous
semilattice.  The reverse operation is intentionally unavailable: a
continuous semilattice alone need not specify a least element at all.
-/
def toContinuousJoinSemilattice
    (computation : NondeterministicComputation) :
    ContinuousJoinSemilattice where
  carrier := computation.carrier
  bottom := computation.deadlock
  choice := computation.choice
  choice_assoc := computation.choice_assoc
  choice_comm := computation.choice_comm
  choice_idem := computation.choice_idem
  bottom_choice := computation.deadlock_choice

end NondeterministicComputation

/--
The former, inconsistent split powerdomain interface.

It is retained only so `FMSExternalPackageObstruction` can permanently check
the counterexample.  Its universal property quantifies over maps preserving
deadlock and choice but not divergence.  Adding divergence preservation in a
separate record makes the two records jointly uninhabited.
-/
structure LegacyCpoPowerdomainPackage where
  monad : CategoryTheory.Monad ωCPO
  empty : (object : ωCPO) → monad.obj object
  choice :
    (object : ωCPO) →
      ωCPO.of (monad.obj object × monad.obj object) ⟶ monad.obj object
  choice_assoc :
    ∀ object left middle right,
      choice object (choice object (left, middle), right) =
        choice object (left, choice object (middle, right))
  choice_comm :
    ∀ object left right,
      choice object (left, right) = choice object (right, left)
  choice_idem :
    ∀ object value, choice object (value, value) = value
  empty_choice :
    ∀ object value, choice object (empty object, value) = value
  map_empty :
    ∀ {source target : ωCPO} (morphism : source ⟶ target),
      monad.map morphism (empty source) = empty target
  map_choice :
    ∀ {source target : ωCPO} (morphism : source ⟶ target) left right,
      monad.map morphism (choice source (left, right)) =
        choice target (monad.map morphism left, monad.map morphism right)
  fubini :
    ∀ (left right : ωCPO),
      (monad.obj left ⨯ monad.obj right) ⟶ monad.obj (left ⨯ right)
  fubini_natural :
    ∀ {left left' right right' : ωCPO}
      (leftMap : left ⟶ left') (rightMap : right ⟶ right'),
      Limits.prod.map (monad.map leftMap) (monad.map rightMap) ≫
          fubini left' right' =
        fubini left right ≫
          monad.map (Limits.prod.map leftMap rightMap)
  fubini_unit :
    ∀ (left right : ωCPO),
      Limits.prod.map (monad.η.app left) (monad.η.app right) ≫
          fubini left right =
        monad.η.app (left ⨯ right)
  fubini_commutes :
    ∀ (left right : ωCPO),
      (Limits.prod.braiding (monad.obj left) (monad.obj right)).hom ≫
          fubini right left =
        fubini left right ≫
          monad.map (Limits.prod.braiding left right).hom
  freeLift :
    ∀ (source : ωCPO) (target : ContinuousJoinSemilattice),
      (source ⟶ target.carrier) →
        (monad.obj source ⟶ target.carrier)
  freeLift_unit :
    ∀ source target generator,
      monad.η.app source ≫ freeLift source target generator = generator
  freeLift_empty :
    ∀ source target generator,
      freeLift source target generator (empty source) = target.bottom
  freeLift_choice :
    ∀ source target generator left right,
      freeLift source target generator (choice source (left, right)) =
        target.choice
          (freeLift source target generator left,
            freeLift source target generator right)
  freeLift_unique :
    ∀ source target generator
      (candidate : monad.obj source ⟶ target.carrier),
      monad.η.app source ≫ candidate = generator →
      candidate (empty source) = target.bottom →
      (∀ left right,
        candidate (choice source (left, right)) =
          target.choice (candidate left, candidate right)) →
      candidate = freeLift source target generator

/--
The extra order-theoretic coherence that distinguishes Abramsky's
powerdomain from an arbitrary free continuous semilattice monad.

`CpoPowerdomainPackage` retains the algebraic API used by existing internal
developments.  This record supplies the missing `⊥` of every free
nondeterministic computation and proves that functorial action,
multiplication, and the universal lift are strict.  A complete FMS
acceptance certificate must carry this record; merely providing `0` and
`∪` is insufficient.
-/
structure LegacyAbramskyPowerdomainCoherence
    (power : LegacyCpoPowerdomainPackage) where
  divergence :
    ∀ object : ωCPO, power.monad.obj object
  divergence_le :
    ∀ (object : ωCPO) (value : power.monad.obj object),
      divergence object ≤ value
  map_divergence :
    ∀ {source target : ωCPO} (morphism : source ⟶ target),
      power.monad.map morphism (divergence source) =
        divergence target
  multiplication_divergence :
    ∀ object : ωCPO,
      power.monad.μ.app object
          (divergence (power.monad.obj object)) =
        divergence object
  freeLift_divergence :
    ∀ (source : ωCPO) (target : NondeterministicComputation)
      (generator : source ⟶ target.carrier),
      power.freeLift source target.toContinuousJoinSemilattice generator
          (divergence source) =
        target.divergence

/--
Strengthened Cantilune powerdomain acceptance interface.

Divergence, deadlock, and idempotent choice live in one record.  Most
importantly, the free universal property is stated in the category of
`NondeterministicComputation`s: a candidate must preserve the unit,
divergence, deadlock, and choice before uniqueness can be invoked.  This
removes the legacy empty-CPO contradiction.

The `divergence_ne_empty` field is not asserted by the FMS source.  It is a
Cantilune-specific separation requirement and is intentionally visible here
so that source-law compatibility can be audited rather than silently assumed.
-/
structure CpoPowerdomainPackage where
  monad : CategoryTheory.Monad ωCPO
  divergence :
    ∀ object : ωCPO, monad.obj object
  divergence_le :
    ∀ (object : ωCPO) (value : monad.obj object),
      divergence object ≤ value
  empty : (object : ωCPO) → monad.obj object
  divergence_ne_empty :
    ∀ object : ωCPO, divergence object ≠ empty object
  choice :
    (object : ωCPO) →
      ωCPO.of (monad.obj object × monad.obj object) ⟶ monad.obj object
  choice_assoc :
    ∀ object left middle right,
      choice object (choice object (left, middle), right) =
        choice object (left, choice object (middle, right))
  choice_comm :
    ∀ object left right,
      choice object (left, right) = choice object (right, left)
  choice_idem :
    ∀ object value, choice object (value, value) = value
  empty_choice :
    ∀ object value, choice object (empty object, value) = value
  map_divergence :
    ∀ {source target : ωCPO} (morphism : source ⟶ target),
      monad.map morphism (divergence source) = divergence target
  map_empty :
    ∀ {source target : ωCPO} (morphism : source ⟶ target),
      monad.map morphism (empty source) = empty target
  map_choice :
    ∀ {source target : ωCPO} (morphism : source ⟶ target) left right,
      monad.map morphism (choice source (left, right)) =
        choice target (monad.map morphism left, monad.map morphism right)
  multiplication_divergence :
    ∀ object : ωCPO,
      monad.μ.app object (divergence (monad.obj object)) =
        divergence object
  fubini :
    ∀ (left right : ωCPO),
      (monad.obj left ⨯ monad.obj right) ⟶ monad.obj (left ⨯ right)
  fubini_natural :
    ∀ {left left' right right' : ωCPO}
      (leftMap : left ⟶ left') (rightMap : right ⟶ right'),
      Limits.prod.map (monad.map leftMap) (monad.map rightMap) ≫
          fubini left' right' =
        fubini left right ≫
          monad.map (Limits.prod.map leftMap rightMap)
  fubini_unit :
    ∀ (left right : ωCPO),
      Limits.prod.map (monad.η.app left) (monad.η.app right) ≫
          fubini left right =
        monad.η.app (left ⨯ right)
  fubini_commutes :
    ∀ (left right : ωCPO),
      (Limits.prod.braiding (monad.obj left) (monad.obj right)).hom ≫
          fubini right left =
        fubini left right ≫
          monad.map (Limits.prod.braiding left right).hom
  freeLift :
    ∀ (source : ωCPO) (target : NondeterministicComputation),
      (source ⟶ target.carrier) →
        (monad.obj source ⟶ target.carrier)
  freeLift_unit :
    ∀ source target generator,
      monad.η.app source ≫ freeLift source target generator = generator
  freeLift_divergence :
    ∀ source target generator,
      freeLift source target generator (divergence source) =
        target.divergence
  freeLift_empty :
    ∀ source target generator,
      freeLift source target generator (empty source) = target.deadlock
  freeLift_choice :
    ∀ source target generator left right,
      freeLift source target generator (choice source (left, right)) =
        target.choice
          (freeLift source target generator left,
            freeLift source target generator right)
  freeLift_unique :
    ∀ source target generator
      (candidate : monad.obj source ⟶ target.carrier),
      monad.η.app source ≫ candidate = generator →
      candidate (divergence source) = target.divergence →
      candidate (empty source) = target.deadlock →
      (∀ left right,
        candidate (choice source (left, right)) =
          target.choice (candidate left, candidate right)) →
      candidate = freeLift source target generator

namespace CpoPowerdomainPackage

/-- Every free powerdomain object is itself a nondeterministic computation. -/
def computation
    (power : CpoPowerdomainPackage) (object : ωCPO) :
    NondeterministicComputation where
  carrier := power.monad.obj object
  divergence := power.divergence object
  divergence_le := power.divergence_le object
  deadlock := power.empty object
  choice := power.choice object
  choice_assoc := power.choice_assoc object
  choice_comm := power.choice_comm object
  choice_idem := power.choice_idem object
  deadlock_choice := power.empty_choice object

/--
The two nullary computations of the Abramsky powerdomain do not collapse.
This is an explicit acceptance obligation, not a consequence of merely
naming two fields.
-/
theorem divergence_ne_deadlock
    (power : CpoPowerdomainPackage) (object : ωCPO) :
    (power.computation object).divergence ≠
      (power.computation object).deadlock :=
  power.divergence_ne_empty object

/-- The corrected free extension preserves all three distinguished operations. -/
theorem freeLift_preserves_structure
    (power : CpoPowerdomainPackage)
    (source : ωCPO) (target : NondeterministicComputation)
    (generator : source ⟶ target.carrier) :
    power.freeLift source target generator (power.divergence source) =
        target.divergence ∧
      power.freeLift source target generator (power.empty source) =
        target.deadlock ∧
      ∀ left right,
        power.freeLift source target generator
            (power.choice source (left, right)) =
          target.choice
            (power.freeLift source target generator left,
              power.freeLift source target generator right) :=
  ⟨power.freeLift_divergence source target generator,
    power.freeLift_empty source target generator,
    power.freeLift_choice source target generator⟩

end CpoPowerdomainPackage

/--
The two coherence diagrams which are not implied merely by exposing a
natural, symmetric Fubini map.  Together with `fubini_natural`,
`fubini_unit`, and `fubini_commutes` in `CpoPowerdomainPackage`, these are the
pointwise strong-commutative-monad laws used by the FMS interpretation.

They are separate from `CpoPowerdomainPackage` so that the already
mechanized discrete fragment can be compared with the exact acceptance
boundary without pretending that the full Abramsky construction exists.
-/
structure StrongCommutativePowerdomainCoherence
    (power : CpoPowerdomainPackage) where
  fubini_associative :
    ∀ (first second third : ωCPO),
      Limits.prod.map (power.fubini first second)
          (𝟙 (power.monad.obj third)) ≫
          power.fubini (first ⨯ second) third ≫
          power.monad.map
            (Limits.prod.associator first second third).hom =
        (Limits.prod.associator
          (power.monad.obj first)
          (power.monad.obj second)
          (power.monad.obj third)).hom ≫
          Limits.prod.map (𝟙 (power.monad.obj first))
            (power.fubini second third) ≫
          power.fubini first (second ⨯ third)
  fubini_multiplication :
    ∀ (left right : ωCPO),
      Limits.prod.map
          (power.monad.μ.app left) (power.monad.μ.app right) ≫
          power.fubini left right =
        power.fubini
            (power.monad.obj left) (power.monad.obj right) ≫
        power.monad.map (power.fubini left right) ≫
          power.monad.μ.app (left ⨯ right)

/--
Algebraic/Kleisli coherence omitted by an ordinary monad plus a bare free
extension.

The free extension into another free powerdomain must be the monad's Kleisli
extension, and multiplication must preserve deadlock and choice (divergence
is already required by `CpoPowerdomainPackage`).  These equations exclude
packages that supply unrelated monad and semilattice data.  The remaining
Fubini/strength equations for one pure/effectful argument and for
deadlock/choice are not implied by this record and remain an explicit
acceptance gap.
-/
structure KleisliPowerdomainCoherence
    (power : CpoPowerdomainPackage) where
  freeLift_free :
    ∀ (source target : ωCPO)
      (generator : source ⟶ power.monad.obj target),
      power.freeLift source (power.computation target) generator =
        power.monad.map generator ≫ power.monad.μ.app target
  multiplication_empty :
    ∀ object : ωCPO,
      power.monad.μ.app object
          (power.empty (power.monad.obj object)) =
        power.empty object
  multiplication_choice :
    ∀ (object : ωCPO)
      (left right : power.monad.obj (power.monad.obj object)),
      power.monad.μ.app object
          (power.choice (power.monad.obj object) (left, right)) =
        power.choice object
          (power.monad.μ.app object left,
            power.monad.μ.app object right)

/--
The enrichment data hidden by an ordinary categorical monad record.

The FMS construction uses a `Cpo`-monad induced by a `Cpo`-adjunction.
Consequently functorial action on morphisms and the universal extension
operation must themselves be continuous maps between the pointwise
omega-CPOs of continuous morphisms.  Ordinary naturality and the
element-by-element universal property do not imply these enriched facts, so
the complete acceptance package records them separately.
-/
structure CpoEnrichedPowerdomainCoherence
    (power : CpoPowerdomainPackage) where
  mapHomContinuous :
    ∀ (source target : ωCPO),
      ContinuousHom
        (ContinuousHom source target)
        (ContinuousHom
          (power.monad.obj source) (power.monad.obj target))
  mapHomContinuous_apply :
    ∀ (source target : ωCPO) (morphism : source ⟶ target),
      mapHomContinuous source target morphism =
        power.monad.map morphism
  freeLiftContinuous :
    ∀ (source : ωCPO) (target : NondeterministicComputation),
      ContinuousHom
        (ContinuousHom source target.carrier)
        (ContinuousHom (power.monad.obj source) target.carrier)
  freeLiftContinuous_apply :
    ∀ (source : ωCPO) (target : NondeterministicComputation)
      (generator : source ⟶ target.carrier),
      freeLiftContinuous source target generator =
        power.freeLift source target generator

namespace CpoEnrichedPowerdomainCoherence

/-- Enriched functorial action preserves suprema of omega-chains of maps. -/
theorem mapHom_ωSup
    {power : CpoPowerdomainPackage}
    (coherence : CpoEnrichedPowerdomainCoherence power)
    (source target : ωCPO)
    (chain :
      OmegaCompletePartialOrder.Chain
        (ContinuousHom source target)) :
    coherence.mapHomContinuous source target
        (OmegaCompletePartialOrder.ωSup chain) =
      OmegaCompletePartialOrder.ωSup
        (chain.map
          (coherence.mapHomContinuous source target).toOrderHom) :=
  (coherence.mapHomContinuous source target).map_ωSup' chain

/-- The free extension operation is continuous in its generator map. -/
theorem freeLift_ωSup
    {power : CpoPowerdomainPackage}
    (coherence : CpoEnrichedPowerdomainCoherence power)
    (source : ωCPO) (target : NondeterministicComputation)
    (chain :
      OmegaCompletePartialOrder.Chain
        (ContinuousHom source target.carrier)) :
    coherence.freeLiftContinuous source target
        (OmegaCompletePartialOrder.ωSup chain) =
      OmegaCompletePartialOrder.ωSup
        (chain.map
          (coherence.freeLiftContinuous source target).toOrderHom) :=
  (coherence.freeLiftContinuous source target).map_ωSup' chain

end CpoEnrichedPowerdomainCoherence

/-- Postcomposition lifts any CPO endofunctor pointwise to `ωCPO^I`. -/
def pointwiseCpoEndofunctor (base : ωCPO ⥤ ωCPO) :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) where
  obj model := model ⋙ base
  map transformation := Functor.whiskerRight transformation base
  map_id model := by
    exact NatTrans.ext (funext fun world => base.map_id (model.obj world))
  map_comp first second := by
    exact NatTrans.ext (funext fun world =>
      base.map_comp (first.app world) (second.app world))

/-! ## CPO-enriched local continuity for world-model endofunctors -/

/-- Pointwise order between natural transformations of CPO-valued models. -/
def TransformationPointwiseLE
    {source target : World ⥤ ωCPO}
    (first second : source ⟶ target) : Prop :=
  ∀ world value, first.app world value ≤ second.app world value

/--
An omega-chain of model transformations together with its actual pointwise
supremum natural transformation.

The supremum is carried explicitly because mathlib does not currently install
an omega-CPO instance on natural transformations in `World ⥤ ωCPO`.
-/
structure TransformationOmegaChain
    (source target : World ⥤ ωCPO) where
  sequence : Nat → (source ⟶ target)
  monotone :
    ∀ {first second : Nat}, first ≤ second →
      TransformationPointwiseLE (sequence first) (sequence second)
  supremum : source ⟶ target
  supremum_pointwise :
    ∀ world value,
      supremum.app world value =
        OmegaCompletePartialOrder.ωSup
          ({ toFun := fun index => sequence index |>.app world value
             monotone' := by
               intro first second bound
               exact monotone bound world value } :
            OmegaCompletePartialOrder.Chain (target.obj world))

/--
A world-model endofunctor is locally continuous when its action on
transformations is pointwise monotone and preserves every supplied
pointwise omega-supremum.
-/
structure EndofunctorLocallyContinuous
    (functor : (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO)) : Prop where
  map_monotone :
    ∀ {source target : World ⥤ ωCPO}
      {first second : source ⟶ target},
      TransformationPointwiseLE first second →
        TransformationPointwiseLE
          (functor.map first) (functor.map second)
  map_ωSup :
    ∀ {source target : World ⥤ ωCPO}
      (chain : TransformationOmegaChain source target)
      (world : World) (value : (functor.obj source).obj world),
      (functor.map chain.supremum).app world value =
        OmegaCompletePartialOrder.ωSup
          ({ toFun := fun index =>
              (functor.map (chain.sequence index)).app world value
             monotone' := by
               intro first second bound
               exact map_monotone
                 (chain.monotone bound) world value } :
            OmegaCompletePartialOrder.Chain
              ((functor.obj target).obj world))

/--
The carrier of the FMS action functor

`H X = N × (N ⇒ X) + N × N × X + N × δX + X`

at a finite world.  The input continuation is split using the FMS isomorphism
`(N ⇒ X)(n) ≅ X(n)^n × X(n+1)`.
-/
inductive ActionCarrier (model : World ⥤ ωCPO) (world : World) where
  | input
      (channel : Fin world)
      (known : Fin world → model.obj world)
      (fresh : model.obj (world + 1))
  | freeOutput
      (channel value : Fin world)
      (continuation : model.obj world)
  | boundOutput
      (channel : Fin world)
      (continuation : model.obj (world + 1))
  | tau (continuation : model.obj world)

namespace ActionCarrier

/-- Action of a model natural transformation on the exact FMS shape. -/
def mapModel {source target : World ⥤ ωCPO}
    (transformation : source ⟶ target) :
    ActionCarrier source world → ActionCarrier target world
  | .input channel known fresh =>
      .input channel
        (fun name => transformation.app world (known name))
        (transformation.app (world + 1) fresh)
  | .freeOutput channel value continuation =>
      .freeOutput channel value (transformation.app world continuation)
  | .boundOutput channel continuation =>
      .boundOutput channel
        (transformation.app (world + 1) continuation)
  | .tau continuation =>
      .tau (transformation.app world continuation)

/--
The canonical separated-sum order on the exact FMS action carrier.

Different action constructors (or different channel/name tags) are
incomparable.  Continuations retain the source model's order; input
continuations use the pointwise order on known names and the model order at
the genuinely fresh world.
-/
def SeparatedLE {model : World ⥤ ωCPO} {world : World} :
    ActionCarrier model world → ActionCarrier model world → Prop
  | .input channel known fresh,
      .input channel' known' fresh' =>
      channel = channel' ∧
        (∀ name, known name ≤ known' name) ∧
        fresh ≤ fresh'
  | .freeOutput channel value continuation,
      .freeOutput channel' value' continuation' =>
      channel = channel' ∧ value = value' ∧
        continuation ≤ continuation'
  | .boundOutput channel continuation,
      .boundOutput channel' continuation' =>
      channel = channel' ∧ continuation ≤ continuation'
  | .tau continuation, .tau continuation' =>
      continuation ≤ continuation'
  | _, _ => False

theorem separatedLE_refl
    {model : World ⥤ ωCPO} {world : World}
    (action : ActionCarrier model world) :
    SeparatedLE action action := by
  cases action <;> simp [SeparatedLE]

end ActionCarrier

/-- A scoped name in a binder-free context is necessarily a free name. -/
def closedScopedName
    (name : ScopedName world 0) : Fin world := by
  cases name with
  | free value => exact value
  | bound impossible => exact Fin.elim0 impossible

/--
A supplied solution of the exact CPO FMS agent equation.  `initial` is the
actual categorical initial-algebra proposition for `P̂ ∘ H`; `roll` supplies
the domain isomorphism rather than merely an unproved carrier equality.

This interface still exposes one deliberate review boundary:
`actionShape_model_natural` is natural in the model argument, while
`actionShape` is only a carrier equivalence at each world.  A complete
inhabitant must additionally justify that the chosen `actionFunctor` has the
FMS finite-world injection action, especially on `N ⇒ X`.  Until that
world-naturality theorem is added, even an inhabitant of this record is not by
itself the completed FMS `H` natural isomorphism.
-/
structure AgentDomainSolution (power : CpoPowerdomainPackage) where
  actionFunctor : (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO)
  actionShape :
    ∀ (model : World ⥤ ωCPO) (world : World),
      (actionFunctor.obj model).obj world ≃ ActionCarrier model world
  actionShape_model_natural :
    ∀ {source target : World ⥤ ωCPO}
      (transformation : source ⟶ target)
      (world : World) (action : (actionFunctor.obj source).obj world),
      actionShape target world
          ((actionFunctor.map transformation).app world action) =
        ActionCarrier.mapModel transformation
          (actionShape source world action)
  agent : World ⥤ ωCPO
  roll :
    ((actionFunctor ⋙
      pointwiseCpoEndofunctor power.monad.toFunctor).obj agent) ≅ agent
  initial :
    IsInitial
      ({ a := agent, str := roll.hom } :
        Algebra
          (actionFunctor ⋙
            pointwiseCpoEndofunctor power.monad.toFunctor))
  res :
    ∀ world,
      ωCPO.of
          ((Fin world → agent.obj world) × agent.obj (world + 1)) ⟶
        agent.obj world

namespace AgentDomainSolution

/-- Embed one exact FMS action through the powerdomain unit and fold it. -/
def prefixAction
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World)
    (action : ActionCarrier solution.agent world) :
    solution.agent.obj world :=
  solution.roll.hom.app world
    (power.monad.η.app
      ((solution.actionFunctor.obj solution.agent).obj world)
      ((solution.actionShape solution.agent world).symm action))

/-- Fold the powerdomain deadlock element into the agent domain. -/
def deadlock
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World) :
    solution.agent.obj world :=
  solution.roll.hom.app world
    (power.empty
      ((solution.actionFunctor.obj solution.agent).obj world))

/-- Fold the powerdomain least element into the agent domain. -/
def divergence
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World) :
    solution.agent.obj world :=
  solution.roll.hom.app world
    (power.divergence
      ((solution.actionFunctor.obj solution.agent).obj world))

/-- Nondeterministic choice transported across the domain isomorphism. -/
def choice
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World)
    (left right : solution.agent.obj world) :
    solution.agent.obj world :=
  solution.roll.hom.app world
    (power.choice
      ((solution.actionFunctor.obj solution.agent).obj world)
      (solution.roll.inv.app world left,
        solution.roll.inv.app world right))

private theorem roll_inv_hom_apply
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World)
    (value :
      ((solution.actionFunctor ⋙
        pointwiseCpoEndofunctor power.monad.toFunctor).obj
          solution.agent).obj world) :
    solution.roll.inv.app world
        (solution.roll.hom.app world value) = value :=
  by
    simp

private theorem roll_hom_inv_apply
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World)
    (value : solution.agent.obj world) :
    solution.roll.hom.app world
        (solution.roll.inv.app world value) = value :=
  by
    simp

/-- The folded divergence is least in every world of the agent domain. -/
theorem divergence_le
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World) (process : solution.agent.obj world) :
    solution.divergence world ≤ process := by
  calc
    solution.divergence world =
        solution.roll.hom.app world
          (power.divergence
            ((solution.actionFunctor.obj solution.agent).obj world)) :=
      rfl
    _ ≤ solution.roll.hom.app world
          (solution.roll.inv.app world process) :=
      (solution.roll.hom.app world).monotone
        (power.divergence_le _ _)
    _ = process := solution.roll_hom_inv_apply world process

/-- Divergence and deadlock remain distinct after folding the domain equation. -/
theorem divergence_ne_deadlock
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World) :
    solution.divergence world ≠ solution.deadlock world := by
  intro equal
  have unfolded :=
    congrArg (fun process => solution.roll.inv.app world process) equal
  simp only [divergence, deadlock] at unfolded
  rw [solution.roll_inv_hom_apply, solution.roll_inv_hom_apply] at unfolded
  change
    power.divergence
        ((solution.actionFunctor.obj solution.agent).obj world) =
      power.empty
        ((solution.actionFunctor.obj solution.agent).obj world)
    at unfolded
  exact
    power.divergence_ne_empty
      ((solution.actionFunctor.obj solution.agent).obj world) unfolded

/-- Agent choice is associative. -/
theorem choice_assoc
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World)
    (left middle right : solution.agent.obj world) :
    solution.choice world
        (solution.choice world left middle) right =
      solution.choice world left
        (solution.choice world middle right) := by
  unfold choice
  rw [solution.roll_inv_hom_apply, solution.roll_inv_hom_apply]
  rw [power.choice_assoc]

/-- Agent choice is commutative. -/
theorem choice_comm
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World)
    (left right : solution.agent.obj world) :
    solution.choice world left right =
      solution.choice world right left := by
  simpa [choice] using congrArg
    (fun value => solution.roll.hom.app world value)
    (power.choice_comm
      ((solution.actionFunctor.obj solution.agent).obj world)
      (solution.roll.inv.app world left)
      (solution.roll.inv.app world right))

/-- Agent choice is idempotent. -/
theorem choice_idem
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World) (process : solution.agent.obj world) :
    solution.choice world process process = process := by
  unfold choice
  rw [power.choice_idem]
  exact solution.roll_hom_inv_apply world process

/-- Deadlock is the identity of agent choice. -/
theorem deadlock_choice
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : World) (process : solution.agent.obj world) :
    solution.choice world (solution.deadlock world) process = process := by
  unfold choice deadlock
  rw [solution.roll_inv_hom_apply]
  rw [power.empty_choice]
  exact solution.roll_hom_inv_apply world process

end AgentDomainSolution

/--
Exact finite-injection action and CPO presentation of the FMS action shape.

`AgentDomainSolution.actionShape` alone is only a carrier equivalence.  This
record adds:

* an actual CPO object presenting every action layer;
* a continuous isomorphism to that object;
* the action on arbitrary world injections, including the input
  continuation at old and genuinely fresh names; and
* compatibility with both the action functor's world map and its model map.

Consequently a value of this structure cannot validate only the objectwise
cardinality of `H X`.
-/
structure ExactActionWorldCoherence {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power) where
  actionCpo :
    (model : World ⥤ ωCPO) → (world : World) → ωCPO
  carrierIdentification :
    ∀ model world, actionCpo model world ≃ ActionCarrier model world
  continuousShape :
    ∀ model world,
      (solution.actionFunctor.obj model).obj world ≅ actionCpo model world
  continuousShape_agrees :
    ∀ model world
      (action : (solution.actionFunctor.obj model).obj world),
      carrierIdentification model world
          ((continuousShape model world).hom action) =
        solution.actionShape model world action
  carrier_order_iff :
    ∀ model world
      (left right : actionCpo model world),
      left ≤ right ↔
        ActionCarrier.SeparatedLE
          (carrierIdentification model world left)
          (carrierIdentification model world right)
  inputKnownTransport :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (_injection : source ⟶ target),
      (Fin source → model.obj source) →
      model.obj (source + 1) →
      Fin target →
      model.obj target
  inputKnownTransport_old :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (known : Fin source → model.obj source)
      (fresh : model.obj (source + 1))
      (old : Fin source),
      inputKnownTransport model injection known fresh
          (FMSModel.homToFun injection old) =
        model.map injection (known old)
  inputKnownTransport_fresh :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (known : Fin source → model.obj source)
      (fresh : model.obj (source + 1))
      (newName : Fin target)
      (extension : source + 1 ⟶ target),
      (∀ old : Fin source,
        FMSModel.homToFun extension (Fin.castSucc old) =
          FMSModel.homToFun injection old) →
      FMSModel.homToFun extension (Fin.last source) = newName →
      inputKnownTransport model injection known fresh newName =
        model.map extension fresh
  mapAction :
    ∀ (model : World ⥤ ωCPO) {source target : World},
      (source ⟶ target) →
      ActionCarrier model source →
      ActionCarrier model target
  mapAction_input :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (channel : Fin source)
      (known : Fin source → model.obj source)
      (fresh : model.obj (source + 1)),
      mapAction model injection (.input channel known fresh) =
        .input (FMSModel.homToFun injection channel)
          (inputKnownTransport model injection known fresh)
          (model.map
            (FMSCpoWorld.successorWorld.map injection) fresh)
  mapAction_freeOutput :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (channel value : Fin source)
      (continuation : model.obj source),
      mapAction model injection
          (.freeOutput channel value continuation) =
        .freeOutput
          (FMSModel.homToFun injection channel)
          (FMSModel.homToFun injection value)
          (model.map injection continuation)
  mapAction_boundOutput :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (channel : Fin source)
      (continuation : model.obj (source + 1)),
      mapAction model injection (.boundOutput channel continuation) =
        .boundOutput
          (FMSModel.homToFun injection channel)
          (model.map
            (FMSCpoWorld.successorWorld.map injection) continuation)
  mapAction_tau :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (continuation : model.obj source),
      mapAction model injection (.tau continuation) =
        .tau (model.map injection continuation)
  shape_world_natural :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (action : (solution.actionFunctor.obj model).obj source),
      solution.actionShape model target
          ((solution.actionFunctor.obj model).map injection action) =
        mapAction model injection
          (solution.actionShape model source action)

/--
Endofunctor-level form of the exact action-shape coherence.

The objectwise `continuousShape` family is required to assemble into a
natural isomorphism with one actual exact-shape endofunctor.  This prevents a
provider from choosing unrelated CPO isomorphisms at each model and world.
-/
structure ExactActionEndofunctorCoherence
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (action : ExactActionWorldCoherence solution) where
  exactActionFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO)
  exact_obj :
    ∀ model world,
      (exactActionFunctor.obj model).obj world =
        action.actionCpo model world
  actionFunctorIso :
    solution.actionFunctor ≅ exactActionFunctor
  actionFunctorIso_agrees :
    ∀ model world,
      (actionFunctorIso.hom.app model).app world ≫
          eqToHom (exact_obj model world) =
        (action.continuousShape model world).hom

/-- Underlying set-valued carrier of a supplied CPO agent object. -/
def AgentDomainSolution.setCarrier {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power) : World ⥤ Type :=
  solution.agent ⋙ forget ωCPO

/--
Hiding adequacy is kept separate from the domain equation: it connects a
fixed syntactic restriction operation and its name abstraction to `res`.
-/
structure AdequateHiding {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power) where
  abstractionDenotation :
    ∀ world,
      SupportedProc (world + 1) 0 →
        ((Fin world → solution.agent.obj world) ×
          solution.agent.obj (world + 1))
  denote : processModel ⟶ solution.setCarrier
  restriction_preserving :
    ∀ world process,
      denote.app world
          (FMSCanonicalHidingSyntax.SupportedProc.restrictLast process) =
        solution.res world (abstractionDenotation world process)

/--
The natural name-abstraction object and the coherent restriction map.

The FMS restriction operator does not merely have one component at each
world.  Its domain is the input/name-abstraction shape
`X(n)^n × X(n+1)`, and both that shape and restriction must be natural for
every finite injection.  These fields turn `AgentDomainSolution.res` into
that actual natural transformation and connect it to the exact input
transport from `ExactActionWorldCoherence`.
-/
structure CoherentHiding {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (action : ExactActionWorldCoherence solution) where
  abstractionFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO)
  abstractionCpo :
    (model : World ⥤ ωCPO) → (world : World) → ωCPO
  abstractionCarrier :
    ∀ model world,
      abstractionCpo model world ≃
        ((Fin world → model.obj world) × model.obj (world + 1))
  continuousShape :
    ∀ model world,
      (abstractionFunctor.obj model).obj world ≅
        abstractionCpo model world
  shape :
    ∀ model world,
      (abstractionFunctor.obj model).obj world →
        ((Fin world → model.obj world) × model.obj (world + 1))
  shape_eq :
    ∀ model world value,
      shape model world value =
        abstractionCarrier model world
          ((continuousShape model world).hom value)
  shape_model_natural :
    ∀ {source target : World ⥤ ωCPO}
      (transformation : source ⟶ target)
      (world : World)
      (value : (abstractionFunctor.obj source).obj world),
      shape target world
          ((abstractionFunctor.map transformation).app world value) =
        (fun name => transformation.app world
            ((shape source world value).1 name),
          transformation.app (world + 1)
            (shape source world value).2)
  shape_world_natural :
    ∀ (model : World ⥤ ωCPO) {source target : World}
      (injection : source ⟶ target)
      (value : (abstractionFunctor.obj model).obj source),
      shape model target
          ((abstractionFunctor.obj model).map injection value) =
        (action.inputKnownTransport model injection
            (shape model source value).1
            (shape model source value).2,
          model.map (FMSCpoWorld.successorWorld.map injection)
            (shape model source value).2)
  restriction :
    abstractionFunctor.obj solution.agent ⟶ solution.agent
  restriction_agrees :
    ∀ world value,
      restriction.app world value =
        solution.res world
          (shape solution.agent world value)

/--
The syntactic abstraction used by adequate hiding is the value consumed by
the coherent name-abstraction functor.

Without this record, `AdequateHiding.abstractionDenotation` and
`CoherentHiding.shape` could still be chosen independently.  The field below
ties them to one abstracted denotation, while the canonical syntax being
hidden is fixed by `FMSCanonicalHidingSyntax.SupportedProc.restrictLast`.
-/
structure HidingDenotationCoherence
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (adequate : AdequateHiding solution)
    (action : ExactActionWorldCoherence solution)
    (coherent : CoherentHiding solution action) where
  abstractDenote :
    ∀ world,
      SupportedProc (world + 1) 0 →
        (coherent.abstractionFunctor.obj solution.agent).obj world
  abstraction_agrees :
    ∀ world process,
      coherent.shape solution.agent world
          (abstractDenote world process) =
        adequate.abstractionDenotation world process
  known_component :
    ∀ (world : Nat) (process : SupportedProc (world + 1) 0)
      (name : Fin world),
      (adequate.abstractionDenotation world process).1 name =
        adequate.denote.app world
          (SupportedProc.renameFree
            (FMSBinderInstantiation.ScopedName.instantiateLast name)
            process)
  fresh_component :
    ∀ (world : Nat) (process : SupportedProc (world + 1) 0),
      (adequate.abstractionDenotation world process).2 =
        adequate.denote.app (world + 1) process

namespace HidingDenotationCoherence

/--
The semantic restriction natural transformation denotes exactly the
canonical capture-avoiding syntactic hiding operation.
-/
theorem canonical_restriction_denotation
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    {adequate : AdequateHiding solution}
    {action : ExactActionWorldCoherence solution}
    {coherent : CoherentHiding solution action}
    (bridge :
      HidingDenotationCoherence solution adequate action coherent)
    (world : Nat) (process : SupportedProc (world + 1) 0) :
    coherent.restriction.app world
        (bridge.abstractDenote world process) =
      adequate.denote.app world
        (FMSCanonicalHidingSyntax.SupportedProc.restrictLast process) := by
  calc
    coherent.restriction.app world
        (bridge.abstractDenote world process) =
      solution.res world
        (coherent.shape solution.agent world
          (bridge.abstractDenote world process)) :=
      coherent.restriction_agrees world _
    _ = solution.res world
        (adequate.abstractionDenotation world process) := by
      rw [bridge.abstraction_agrees world process]
    _ = adequate.denote.app world
        (FMSCanonicalHidingSyntax.SupportedProc.restrictLast process) :=
      (adequate.restriction_preserving world process).symm

/--
The syntactic fresh-name component is a genuine inverse to canonical hiding:
instantiating the outer binder at the new last name and then applying the
semantic restriction denotes exactly the original locally nameless
restriction, including beneath nested binders.
-/
theorem canonical_restriction_freshenOuter
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    {adequate : AdequateHiding solution}
    {action : ExactActionWorldCoherence solution}
    {coherent : CoherentHiding solution action}
    (bridge :
      HidingDenotationCoherence solution adequate action coherent)
    (world : Nat) (body : SupportedProc world 1) :
    coherent.restriction.app world
        (bridge.abstractDenote world
          (FMSBinderInstantiation.SupportedProc.freshenOuter body)) =
      adequate.denote.app world
        (.restrict body : SupportedProc world 0) := by
  calc
    coherent.restriction.app world
        (bridge.abstractDenote world
          (FMSBinderInstantiation.SupportedProc.freshenOuter body)) =
      adequate.denote.app world
        (FMSCanonicalHidingSyntax.SupportedProc.restrictLast
          (FMSBinderInstantiation.SupportedProc.freshenOuter body)) :=
      bridge.canonical_restriction_denotation world _
    _ = adequate.denote.app world
        (.restrict body : SupportedProc world 0) := by
      rw [FMSBinderInstantiation.SupportedProc.restrictLast_freshenOuter]

end HidingDenotationCoherence

/--
Construct-by-construct compositionality of the supported syntax in the
supplied FMS domain.

The canonical domain operations for deadlock, prefix, and nondeterministic
choice are derived from `roll` and the corrected powerdomain.  Parallel is
kept as explicit supplied structure because the FMS construction derives it
through left-merge and synchronization.  Input continuations use the
kernel-defined known-name instantiation and genuinely fresh continuation.
-/
structure CompositionalFMSInterpretation
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (adequate : AdequateHiding solution) where
  parallel :
    ∀ world,
      ωCPO.of
          (solution.agent.obj world × solution.agent.obj world) ⟶
        solution.agent.obj world
  parallel_world_natural :
    ∀ {source target : World} (injection : source ⟶ target)
      (left right : solution.agent.obj source),
      solution.agent.map injection
          (parallel source (left, right)) =
        parallel target
          (solution.agent.map injection left,
            solution.agent.map injection right)
  parallel_assoc :
    ∀ world (left middle right : solution.agent.obj world),
      parallel world (parallel world (left, middle), right) =
        parallel world (left, parallel world (middle, right))
  parallel_comm :
    ∀ world (left right : solution.agent.obj world),
      parallel world (left, right) = parallel world (right, left)
  parallel_deadlock :
    ∀ world (process : solution.agent.obj world),
      parallel world (solution.deadlock world, process) = process
  denote_zero :
    ∀ world,
      adequate.denote.app world
          (SupportedProc.zero : SupportedProc world 0) =
        solution.deadlock world
  denote_tau :
    ∀ world (next : SupportedProc world 0),
      adequate.denote.app world (.tau next) =
        solution.prefixAction world
          (.tau (adequate.denote.app world next))
  denote_output :
    ∀ world (channel value : ScopedName world 0)
      (next : SupportedProc world 0),
      adequate.denote.app world (.output channel value next) =
        solution.prefixAction world
          (.freeOutput
            (closedScopedName channel)
            (closedScopedName value)
            (adequate.denote.app world next))
  denote_input :
    ∀ world (channel : ScopedName world 0)
      (body : SupportedProc world 1),
      adequate.denote.app world (.input channel body) =
        solution.prefixAction world
          (.input
            (closedScopedName channel)
            (fun received =>
              adequate.denote.app world
                (FMSBinderInstantiation.SupportedProc.instantiateOuter
                  received body))
            (adequate.denote.app (world + 1)
              (FMSBinderInstantiation.SupportedProc.freshenOuter body)))
  denote_choice :
    ∀ world (left right : SupportedProc world 0),
      adequate.denote.app world (.choice left right) =
        solution.choice world
          (adequate.denote.app world left)
          (adequate.denote.app world right)
  denote_parallel :
    ∀ world (left right : SupportedProc world 0),
      adequate.denote.app world (.parallel left right) =
        parallel world
          (adequate.denote.app world left,
            adequate.denote.app world right)
  denote_restrict :
    ∀ world (body : SupportedProc world 1),
      adequate.denote.app world (.restrict body) =
        solution.res world
          (adequate.abstractionDenotation world
            (FMSBinderInstantiation.SupportedProc.freshenOuter body))
  denote_matchEq :
    ∀ world (left right : ScopedName world 0)
      (next : SupportedProc world 0),
      adequate.denote.app world (.matchEq left right next) =
        if closedScopedName left = closedScopedName right then
          adequate.denote.app world next
        else
          solution.deadlock world
  denote_matchNe :
    ∀ world (left right : ScopedName world 0)
      (next : SupportedProc world 0),
      adequate.denote.app world (.matchNe left right next) =
        if closedScopedName left ≠ closedScopedName right then
          adequate.denote.app world next
        else
          solution.deadlock world

namespace CompositionalFMSInterpretation

/-- The right unit law follows from symmetry and the supplied left unit. -/
theorem parallel_deadlock_right
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    {adequate : AdequateHiding solution}
    (interpretation :
      CompositionalFMSInterpretation solution adequate)
    (world : World) (process : solution.agent.obj world) :
    interpretation.parallel world
        (process, solution.deadlock world) = process := by
  rw [interpretation.parallel_comm]
  exact interpretation.parallel_deadlock world process

end CompositionalFMSInterpretation

/-- Raw processes whose nominal free-name set is empty. -/
abbrev ClosedRaw :=
  { process : Raw.Proc // process.freeNames = ∅ }

/-- A standard structural late step that also carries closure of its target. -/
def ClosedLateStep
    (source : ClosedRaw) (action : Raw.Action) (target : ClosedRaw) : Prop :=
  Late.Step source.1 action target.1

/--
Continuation comparison for a strong *late* input.

After both sides expose the same input binder, the derivatives must remain
related after capture-avoiding substitution of every received name. Other
labels compare their derivatives directly. This is the quantification that
distinguishes late bisimulation from mere same-label step matching.
-/
def LateDerivativeRelated
    (relation : Raw.Proc → Raw.Proc → Prop)
    (action : Raw.Action) (leftTarget rightTarget : Raw.Proc) : Prop :=
  match action with
  | .input _ binder =>
      ∀ received,
        relation
          (leftTarget.substituteCaptureAvoiding binder received)
          (rightTarget.substituteCaptureAvoiding binder received)
  | .tau
  | .output _ _
  | .boundOutput _ _ =>
      relation leftTarget rightTarget

/--
Operational strong late bisimulation on raw processes.

Symmetry is part of the witness. A bound action is considered only when its
bound name is fresh for the process being matched, and input derivatives are
compared after every received-name substitution via
`LateDerivativeRelated`.
-/
def IsStrongLateBisimulation
    (relation : Raw.Proc → Raw.Proc → Prop) : Prop :=
  (∀ {left right}, relation left right → relation right left) ∧
  ∀ {left right}, relation left right →
    ∀ {action leftTarget},
      Late.Step left action leftTarget →
      Disjoint action.boundNames right.freeNames →
        ∃ rightTarget,
          Late.Step right action rightTarget ∧
            LateDerivativeRelated relation action leftTarget rightTarget

/--
The union of all operational strong late bisimulations.  Unlike a relation
field supplied by a package provider, this definition cannot be chosen after
seeing the denotation.
-/
def StrongLateBisimilar (left right : Raw.Proc) : Prop :=
  ∃ relation : Raw.Proc → Raw.Proc → Prop,
    IsStrongLateBisimulation relation ∧ relation left right

/--
Strong late bisimilarity after every finite name substitution.

`SupportedProc` is locally nameless, so an arbitrary map
`Fin source → Fin target` is a simultaneous, capture-free substitution of
the free-name context.  Quantifying over all such maps (not only injections)
is the finite-context presentation of late congruence used by the open FMS
interpretation.
-/
def SupportedLateCongruent
    {world : Nat}
    (left right : SupportedProc world 0) : Prop :=
  ∀ (target : Nat) (substitution : Fin world → Fin target),
    StrongLateBisimilar
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (SupportedProc.renameFree substitution left))
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (SupportedProc.renameFree substitution right))

namespace SupportedLateCongruent

/--
Late congruence is closed under a further simultaneous substitution of its
free-name context.  This property is independent of any denotational package
and follows from composition of locally nameless renamings.
-/
theorem renameFree
    {source target : Nat}
    {left right : SupportedProc source 0}
    (related : SupportedLateCongruent left right)
    (rename : Fin source → Fin target) :
    SupportedLateCongruent
      (SupportedProc.renameFree rename left)
      (SupportedProc.renameFree rename right) := by
  intro next substitution
  simpa [SupportedProc.renameFree_comp] using
    related next (substitution ∘ rename)

end SupportedLateCongruent

/--
Pointwise equality of the open interpretation under every finite valuation.

At a context of `world` free variables, the FMS open denotation is a map out
of the name object raised to `world`.  Evaluating it at a finite valuation is
represented here by simultaneous `SupportedProc.renameFree`, followed by the
world-indexed closed interpretation already carried by `AdequateHiding`.
-/
def OpenDenotationallyEqual
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    (restriction : AdequateHiding solution)
    {world : Nat}
    (left right : SupportedProc world 0) : Prop :=
  ∀ (target : Nat) (valuation : Fin world → Fin target),
    restriction.denote.app target
        (SupportedProc.renameFree valuation left) =
      restriction.denote.app target
        (SupportedProc.renameFree valuation right)

namespace OpenDenotationallyEqual

/-- Pointwise open denotational equality is an equivalence relation. -/
theorem equivalence
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    (restriction : AdequateHiding solution)
    (world : Nat) :
    Equivalence
      (fun left right : SupportedProc world 0 =>
        OpenDenotationallyEqual restriction left right) where
  refl := by
    intro process target valuation
    rfl
  symm := by
    intro left right equal target valuation
    exact (equal target valuation).symm
  trans := by
    intro left middle right leftMiddle middleRight target valuation
    exact (leftMiddle target valuation).trans
      (middleRight target valuation)

/-- Pointwise open-denotation equality is stable under pre-substitution. -/
theorem renameFree
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    {restriction : AdequateHiding solution}
    {source target : Nat}
    {left right : SupportedProc source 0}
    (equal : OpenDenotationallyEqual restriction left right)
    (rename : Fin source → Fin target) :
    OpenDenotationallyEqual restriction
      (SupportedProc.renameFree rename left)
      (SupportedProc.renameFree rename right) := by
  intro next valuation
  simpa [SupportedProc.renameFree_comp] using
    equal next (valuation ∘ rename)

end OpenDenotationallyEqual

/--
Cantilune's strong-late integration obligation at closed world zero.

The FMS full-abstraction theorem equates process bisimilarity with equality of
process denotations.  It does not, by that theorem statement alone, supply the
exact per-label image clauses below.  Those clauses are a deliberately
stronger local acceptance requirement: the supplied denotational transition
relation must be the exact image of native late-π steps and may not silently
replace one source event by `τ*`.

The local `Raw.Proc` language is finite-control and has no guarded
replication.  Consequently even an inhabitant of this record establishes only
the local language instance, not the full source language of FMS Theorem 3.3.
-/
structure StrongLateFullAbstraction {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power) where
  denote : ClosedRaw → solution.agent.obj 0
  transition :
    solution.agent.obj 0 →
      Raw.Action → solution.agent.obj 0 → Prop
  native_step_sound :
    ∀ {source action target},
      ClosedLateStep source action target →
        transition (denote source) action (denote target)
  native_step_complete :
    ∀ {source action denotationalTarget},
      transition (denote source) action denotationalTarget →
        ∃ target,
          ClosedLateStep source action target ∧
            denote target = denotationalTarget
  full_abstraction :
    ∀ left right,
      StrongLateBisimilar left.1 right.1 ↔ denote left = denote right

/--
The supported-syntax and operational closed-process presentations denote the
same FMS agents.

`AdequateHiding.denote` is natural on finite free-name worlds, whereas
`StrongLateFullAbstraction.denote` consumes nominally closed raw processes.
Without this record, a provider could choose these two maps independently and
still inhabit all of the older fields. The canonical reification theorem
closes the forward direction. `encodeClosed` plus `encode_reifies` states
that every closed raw process has a locally nameless representative, and
`denote_encode` ties the arbitrary closed-process semantics back to the
natural supported-syntax semantics.
-/
structure OperationalDenotationCoherence
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (restriction : AdequateHiding solution)
    (late : StrongLateFullAbstraction solution) where
  encodeClosed : ClosedRaw → SupportedProc 0 0
  encode_reifies :
    ∀ process,
      Late.Struct
        (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed
          (encodeClosed process)).1
        process.1
  denote_reification :
    ∀ process : SupportedProc 0 0,
      late.denote
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed process) =
        restriction.denote.app 0 process
  denote_encode :
    ∀ process : ClosedRaw,
      late.denote process =
        restriction.denote.app 0 (encodeClosed process)

/--
Full abstraction of the world-indexed closed interpretation for Cantilune's
finite-control supported syntax.

The earlier operational record intentionally concentrates on genuinely
closed raw processes at world zero.  The source theorem quantifies over every
finite visible-name context and over the full guarded-replication language:
equality of the closed interpretation is exactly strong late bisimilarity
with those names treated as constants.  This record captures the
world-indexed equation on the current supported syntax, but the current
syntax has no guarded replication.  A separate syntax/semantics extension is
therefore required before this field can be identified with FMS Theorem 3.3
without a fragment qualifier.  The open finite-context theorem is derived
below rather than accepted as an independent field; equivalence with the
source's quantification over all name substitutions also remains an explicit
bridge obligation.
-/
structure WorldIndexedFullAbstraction
    {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (restriction : AdequateHiding solution) where
  closed_full_abstraction :
    ∀ (world : Nat) (left right : SupportedProc world 0),
      StrongLateBisimilar
          (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld left)
          (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld right) ↔
        restriction.denote.app world left =
          restriction.denote.app world right

namespace WorldIndexedFullAbstraction

/--
FMS open full abstraction follows pointwise from the world-indexed closed
theorem: late congruence quantifies over all finite substitutions, while open
denotational equality quantifies over the same valuations.
-/
theorem open_full_abstraction
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    {restriction : AdequateHiding solution}
    (full : WorldIndexedFullAbstraction solution restriction)
    {world : Nat} (left right : SupportedProc world 0) :
    SupportedLateCongruent left right ↔
      OpenDenotationallyEqual restriction left right := by
  constructor
  · intro related target valuation
    exact
      (full.closed_full_abstraction target
        (SupportedProc.renameFree valuation left)
        (SupportedProc.renameFree valuation right)).mp
        (related target valuation)
  · intro equal target substitution
    exact
      (full.closed_full_abstraction target
        (SupportedProc.renameFree substitution left)
        (SupportedProc.renameFree substitution right)).mpr
        (equal target substitution)

end WorldIndexedFullAbstraction

/--
Aggregate proof input for the currently enumerated external CPO obligations.
No value of this type is defined in Cantilune.

This record is intentionally *not yet* an acceptance certificate for the full
FMS model: the action functor still lacks a world-natural CPO isomorphism to
the exact FMS `H`, `res` lacks its world-naturality/coherence laws, and the
powerdomain fields do not yet encode every strong-commutative-monad coherence.
Those gaps remain explicit central obligations even if a value of this record
is later supplied.
-/
structure ExternalFMSTheoremPackage where
  source : SourcePin
  source_matches_audit : source = fmsJournal2002
  powerdomain : CpoPowerdomainPackage
  domain : AgentDomainSolution powerdomain
  restriction : AdequateHiding domain
  lateFullAbstraction : StrongLateFullAbstraction domain

/--
The strictest current *provisional* acceptance package for the CPO FMS route.

Unlike `ExternalFMSTheoremPackage`, this record closes the four deliberately
enumerated construction gaps and the open/closed full-abstraction bridge:

1. all strong-commutative Fubini coherence used by the pointwise lifting;
2. continuity of functorial action and universal lifting on CPO-enriched
   hom-objects;
3. a continuous, world-natural realization of the exact action shape;
4. a natural name-abstraction object whose restriction component is
   definitionally tied to the supplied domain solution; and
5. an operational reification/encoding bridge proving that supported syntax
   and closed nominal late-π syntax use the same denotation; and
6. world-indexed closed full abstraction, from which open full abstraction
   for late congruence under every finite substitution is derived.

No inhabitant is defined in Cantilune.  Moreover this record is not yet a
complete characterization of the FMS construction: the remaining boundary
must still fix Fubini/strength algebraic equations, the canonical CPO
biCCC action object, the action-defined restriction operator `R`, the
left-merge/synchronization definition of parallel, and the stage-indexed
denotational transition relation induced by `roll.inv`.  It must also extend
the current finite-control operational and supported syntax with the guarded
replication covered by the source full-abstraction theorem, or else retain an
explicit finite-control qualifier.  Constructing an inhabitant requires a
genuine Abramsky powerdomain/domain-equation mechanization (or a checked
import), not the finite equality-ordered approximation.
-/
structure CompleteExternalFMSTheoremPackage
    extends ExternalFMSTheoremPackage where
  powerdomainCoherence :
    StrongCommutativePowerdomainCoherence powerdomain
  kleisliPowerdomain :
    KleisliPowerdomainCoherence powerdomain
  enrichedPowerdomain :
    CpoEnrichedPowerdomainCoherence powerdomain
  actionWorldCoherence :
    ExactActionWorldCoherence domain
  actionEndofunctorCoherence :
    ExactActionEndofunctorCoherence domain actionWorldCoherence
  actionLocallyContinuous :
    EndofunctorLocallyContinuous domain.actionFunctor
  coherentHiding :
    CoherentHiding domain actionWorldCoherence
  hidingDenotation :
    HidingDenotationCoherence domain restriction
      actionWorldCoherence coherentHiding
  compositionalInterpretation :
    CompositionalFMSInterpretation domain restriction
  operationalDenotation :
    OperationalDenotationCoherence domain restriction lateFullAbstraction
  worldIndexedFullAbstraction :
    WorldIndexedFullAbstraction domain restriction

/--
The current provisional FMS gate.  An inhabitant would discharge every field
currently enumerated above, but until the remaining acceptance gaps in the
record comment are closed it must not be reported as a completed genuine FMS
model.
-/
def CompleteFMSAvailable : Prop :=
  Nonempty CompleteExternalFMSTheoremPackage

/--
Conditional extraction is intentionally mundane: it demonstrates how a
consumer uses a supplied package without introducing an unproved constant.
-/
theorem full_abstraction_of_package
    (package : ExternalFMSTheoremPackage) (left right : ClosedRaw) :
    StrongLateBisimilar left.1 right.1 ↔
      package.lateFullAbstraction.denote left =
        package.lateFullAbstraction.denote right :=
  package.lateFullAbstraction.full_abstraction left right

/--
Full abstraction extracted from the *complete* acceptance certificate.
The proof adds no unproved declaration: existence of the certificate remains
an explicit premise.
-/
theorem full_abstraction_of_complete_package
    (package : CompleteExternalFMSTheoremPackage)
    (left right : ClosedRaw) :
    StrongLateBisimilar left.1 right.1 ↔
      package.lateFullAbstraction.denote left =
        package.lateFullAbstraction.denote right :=
  package.lateFullAbstraction.full_abstraction left right

/--
Existential form used by the four-projection gate.  It deliberately cannot
fire from `mechanizedCpoFragment`.
-/
theorem complete_fms_available_implies_full_abstraction
    (available : CompleteFMSAvailable) (left right : ClosedRaw) :
    StrongLateBisimilar left.1 right.1 ↔
      ∃ package : CompleteExternalFMSTheoremPackage,
        package.lateFullAbstraction.denote left =
          package.lateFullAbstraction.denote right := by
  rcases available with ⟨package⟩
  constructor
  · intro related
    exact ⟨package,
      package.lateFullAbstraction.full_abstraction left right |>.mp related⟩
  · rintro ⟨candidate, denotationsEqual⟩
    exact
      candidate.lateFullAbstraction.full_abstraction left right
        |>.mpr denotationsEqual

end Cantilune.Pi.FMSExternalPackage
