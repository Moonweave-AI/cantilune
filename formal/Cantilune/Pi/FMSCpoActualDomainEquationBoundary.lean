import Cantilune.Pi.FMSCpoActionFunctor
import Cantilune.Pi.FMSCpoOmegaScottPower
import Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous
import Cantilune.Pi.FMSCpoFiniteApproximationTower
import Cantilune.Pi.FMSExternalPackage
import Mathlib.CategoryTheory.Limits.Preserves.Shapes.Terminal

/-!
# The actual unseparated FMS domain-equation boundary

This module fixes the recursive functor to the one that is already
mechanized:

`F = actionFunctor ⋙ pointwiseOmegaScottPowerFunctor`.

It does **not** postulate a fixed point.  It gives the proof-carrying
interfaces used by the later concrete bilimit construction:

* `ActualFixedPointWitness` supplies a continuous natural isomorphism
  `A ≅ F A`;
* `ActualAlgebraicCompactnessWitness` additionally proves that the induced
  algebra is initial and the induced coalgebra is terminal;
* `ActualAgentDomainBridge` states exactly what is still needed to transport
  such a witness to the older `AgentDomainSolution` interface for a supplied
  `CpoPowerdomainPackage`.

The finite initial approximation tower is also connected to this boundary.
Its first connector has no retraction and its first two stages are not
isomorphic, so the current tower cannot silently be used as the required
fixed-point witness.

This module itself defines no inhabitant.  The downstream
`FMSCpoConcreteBilimitExhaustivity` module now constructs an
`ActualFixedPointWitness` for this exact unseparated omega-Scott functor.  It
does not construct algebraic compactness, an Abramsky powerdomain, adequacy,
definability, or a full-abstraction package.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoActualDomainEquationBoundary

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous

/-! ## The concrete recursive endofunctor -/

/-- The actual endofunctor currently constructed in Cantilune. -/
abbrev ActualAgentFunctor :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) :=
  actionFunctor ⋙ pointwiseOmegaScottPowerFunctor

/-- Local continuity is a theorem about the concrete composite, not a field. -/
theorem actualAgentFunctor_locallyContinuous :
    EndofunctorLocallyContinuous ActualAgentFunctor :=
  actionThenOmegaScottPowerLocallyContinuous

/-! ## Supplied fixed points and algebraic compactness -/

/--
A genuine solution of the actual recursive carrier equation.

The isomorphism lives in `World ⥤ ωCPO`; consequently both directions are
world-natural transformations whose components are omega-continuous maps.
This record is the interface consumed by the concrete bilimit module, which
now defines an inhabitant for the unseparated omega-Scott functor.
-/
structure ActualFixedPointWitness where
  agent : World ⥤ ωCPO
  unfoldIso : agent ≅ ActualAgentFunctor.obj agent

namespace ActualFixedPointWitness

/-- Folding is the inverse continuous natural isomorphism. -/
def foldIso (witness : ActualFixedPointWitness) :
    ActualAgentFunctor.obj witness.agent ≅ witness.agent :=
  witness.unfoldIso.symm

/-- The algebra induced by the fold direction. -/
def algebra (witness : ActualFixedPointWitness) :
    Algebra ActualAgentFunctor where
  a := witness.agent
  str := witness.foldIso.hom

/-- The coalgebra induced by the unfold direction. -/
def coalgebra (witness : ActualFixedPointWitness) :
    Coalgebra ActualAgentFunctor where
  V := witness.agent
  str := witness.unfoldIso.hom

/-- Continuous unfold at one finite world. -/
def unfoldAt (witness : ActualFixedPointWitness) (world : World) :
    witness.agent.obj world ≅
      (ActualAgentFunctor.obj witness.agent).obj world :=
  witness.unfoldIso.app world

/-- Continuous fold at one finite world. -/
def foldAt (witness : ActualFixedPointWitness) (world : World) :
    (ActualAgentFunctor.obj witness.agent).obj world ≅
      witness.agent.obj world :=
  witness.foldIso.app world

@[simp]
theorem unfoldAt_hom
    (witness : ActualFixedPointWitness) (world : World) :
    (witness.unfoldAt world).hom =
      witness.unfoldIso.hom.app world :=
  rfl

@[simp]
theorem foldAt_hom
    (witness : ActualFixedPointWitness) (world : World) :
    (witness.foldAt world).hom =
      witness.foldIso.hom.app world :=
  rfl

/-- Unfold is natural for every finite-world injection. -/
theorem unfold_world_natural
    (witness : ActualFixedPointWitness)
    {source target : World}
    (injection : source ⟶ target) :
    witness.agent.map injection ≫
        (witness.unfoldAt target).hom =
      (witness.unfoldAt source).hom ≫
        (ActualAgentFunctor.obj witness.agent).map injection :=
  witness.unfoldIso.hom.naturality injection

/-- Fold is natural for every finite-world injection. -/
theorem fold_world_natural
    (witness : ActualFixedPointWitness)
    {source target : World}
    (injection : source ⟶ target) :
    (ActualAgentFunctor.obj witness.agent).map injection ≫
        (witness.foldAt target).hom =
      (witness.foldAt source).hom ≫
        witness.agent.map injection :=
  witness.foldIso.hom.naturality injection

/-- Folding after unfolding is the identity, pointwise. -/
@[simp]
theorem unfold_fold
    (witness : ActualFixedPointWitness)
    (world : World)
    (value : witness.agent.obj world) :
    (witness.foldAt world).hom
        ((witness.unfoldAt world).hom value) =
      value := by
  change
    (witness.unfoldAt world).inv
        ((witness.unfoldAt world).hom value) =
      value
  simpa using
    congrArg
      (fun morphism => morphism value)
      (witness.unfoldAt world).hom_inv_id

/-- Unfolding after folding is the identity, pointwise. -/
@[simp]
theorem fold_unfold
    (witness : ActualFixedPointWitness)
    (world : World)
    (value :
      (ActualAgentFunctor.obj witness.agent).obj world) :
    (witness.unfoldAt world).hom
        ((witness.foldAt world).hom value) =
      value := by
  change
    (witness.foldAt world).inv
        ((witness.foldAt world).hom value) =
      value
  simpa using
    congrArg
      (fun morphism => morphism value)
      (witness.foldAt world).hom_inv_id

end ActualFixedPointWitness

/--
The algebraic-compactness evidence needed by the FMS recursive equation.

This deliberately stores universal properties rather than deriving them from
local continuity.  Local continuity alone does not construct a bilimit or an
embedding-projection completion in the current category.
-/
structure ActualAlgebraicCompactnessWitness where
  fixed : ActualFixedPointWitness
  initialAlgebra : IsInitial fixed.algebra
  terminalCoalgebra : IsTerminal fixed.coalgebra

namespace ActualAlgebraicCompactnessWitness

/-- The continuous fold natural isomorphism carried by compactness evidence. -/
def foldIso (witness : ActualAlgebraicCompactnessWitness) :
    ActualAgentFunctor.obj witness.fixed.agent ≅ witness.fixed.agent :=
  witness.fixed.foldIso

/-- The continuous unfold natural isomorphism carried by compactness evidence. -/
def unfoldIso (witness : ActualAlgebraicCompactnessWitness) :
    witness.fixed.agent ≅ ActualAgentFunctor.obj witness.fixed.agent :=
  witness.fixed.unfoldIso

/--
Lambek's theorem applied to the supplied initial algebra.  This is derived
evidence that the fold structure map is an isomorphism; it is not a
construction of the initial algebra.
-/
theorem initial_fold_isIso
    (witness : ActualAlgebraicCompactnessWitness) :
    IsIso witness.fixed.algebra.str :=
  Algebra.Initial.str_isIso witness.initialAlgebra

/--
The dual Lambek theorem applied to the supplied terminal coalgebra.
-/
theorem terminal_unfold_isIso
    (witness : ActualAlgebraicCompactnessWitness) :
    IsIso witness.fixed.coalgebra.str :=
  Coalgebra.Terminal.str_isIso witness.terminalCoalgebra

end ActualAlgebraicCompactnessWitness

/-! ## Conditional bridge to `AgentDomainSolution` -/

/-- The recursive functor expected by an arbitrary supplied power package. -/
abbrev PackageAgentFunctor (power : CpoPowerdomainPackage) :
    (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO) :=
  actionFunctor ⋙
    pointwiseCpoEndofunctor power.monad.toFunctor

/--
The remaining data needed to interpret an actual compact fixed point through
the legacy `AgentDomainSolution` boundary.

`powerFunctorIso` is a strong requirement: it says that the supplied
powerdomain functor is naturally isomorphic to the currently mechanized
unseparated lower-power functor on the whole exact action composite.  No such
`CpoPowerdomainPackage` is constructed in Cantilune.
-/
structure ActualAgentDomainBridge
    (power : CpoPowerdomainPackage)
    (witness : ActualAlgebraicCompactnessWitness) where
  powerFunctorIso :
    ActualAgentFunctor ≅ PackageAgentFunctor power
  res :
    ∀ world,
      ωCPO.of
          ((Fin world → witness.fixed.agent.obj world) ×
            witness.fixed.agent.obj (world + 1)) ⟶
        witness.fixed.agent.obj world

namespace ActualAgentDomainBridge

/-- Fold after transporting the supplied power functor to the actual one. -/
def transportedRoll
    {power : CpoPowerdomainPackage}
    {witness : ActualAlgebraicCompactnessWitness}
    (bridge : ActualAgentDomainBridge power witness) :
    (PackageAgentFunctor power).obj witness.fixed.agent ≅
      witness.fixed.agent :=
  (bridge.powerFunctorIso.app witness.fixed.agent).symm ≪≫
    witness.fixed.foldIso

/--
The transported algebra is exactly the image of the actual initial algebra
under the equivalence induced by `powerFunctorIso`.
-/
theorem transportedAlgebra_eq
    {power : CpoPowerdomainPackage}
    {witness : ActualAlgebraicCompactnessWitness}
    (bridge : ActualAgentDomainBridge power witness) :
    ({ a := witness.fixed.agent
       str := bridge.transportedRoll.hom } :
        Algebra (PackageAgentFunctor power)) =
      (Algebra.equivOfNatIso bridge.powerFunctorIso).functor.obj
        witness.fixed.algebra :=
  rfl

/--
Initiality transports mechanically across the natural equivalence of
recursive functors.
-/
noncomputable def transportedInitial
    {power : CpoPowerdomainPackage}
    {witness : ActualAlgebraicCompactnessWitness}
    (bridge : ActualAgentDomainBridge power witness) :
    IsInitial
      ({ a := witness.fixed.agent
         str := bridge.transportedRoll.hom } :
        Algebra (PackageAgentFunctor power)) := by
  rw [bridge.transportedAlgebra_eq]
  exact
    witness.initialAlgebra.isInitialObj
      (Algebra.equivOfNatIso bridge.powerFunctorIso).functor
      witness.fixed.algebra

/--
Conditional conversion to the existing domain-solution interface.

Only the exact action functor, its already-proved carrier/model naturality,
the supplied compact fixed point, the explicit power-functor comparison, and
the supplied restriction component are used.
-/
def toAgentDomainSolution
    {power : CpoPowerdomainPackage}
    {witness : ActualAlgebraicCompactnessWitness}
    (bridge : ActualAgentDomainBridge power witness) :
    AgentDomainSolution power where
  actionFunctor := actionFunctor
  actionShape := actionEquiv
  actionShape_model_natural := actionEquiv_model_natural
  agent := witness.fixed.agent
  roll := bridge.transportedRoll
  initial := bridge.transportedInitial
  res := bridge.res

@[simp]
theorem toAgentDomainSolution_agent
    {power : CpoPowerdomainPackage}
    {witness : ActualAlgebraicCompactnessWitness}
    (bridge : ActualAgentDomainBridge power witness) :
    bridge.toAgentDomainSolution.agent = witness.fixed.agent :=
  rfl

@[simp]
theorem toAgentDomainSolution_roll
    {power : CpoPowerdomainPackage}
    {witness : ActualAlgebraicCompactnessWitness}
    (bridge : ActualAgentDomainBridge power witness) :
    bridge.toAgentDomainSolution.roll =
      bridge.transportedRoll :=
  rfl

end ActualAgentDomainBridge

/-! ## Honest boundary to the complete acceptance package -/

/--
Compatibility data for extending this actual fixed point to an already
supplied complete FMS acceptance package.

The complete package remains a premise.  The equation says that its fold is
the transported actual fold, up to the supplied carrier isomorphism.  This
record therefore cannot manufacture hiding, adequacy, definability, or full
abstraction from a bare domain equation.
-/
structure CompleteAcceptanceExtension
    (witness : ActualAlgebraicCompactnessWitness) where
  package : CompleteExternalFMSTheoremPackage
  recursiveFunctorIso :
    ActualAgentFunctor ≅
      (package.domain.actionFunctor ⋙
        pointwiseCpoEndofunctor
          package.powerdomain.monad.toFunctor)
  carrierIso : witness.fixed.agent ≅ package.domain.agent
  fold_agrees :
    (recursiveFunctorIso.app witness.fixed.agent).inv ≫
          witness.fixed.foldIso.hom ≫ carrierIso.hom =
      (package.domain.actionFunctor ⋙
          pointwiseCpoEndofunctor
            package.powerdomain.monad.toFunctor).map
            carrierIso.hom ≫
        package.domain.roll.hom

namespace CompleteAcceptanceExtension

/-- Extraction is conditional: the complete package was supplied as data. -/
def toCompleteExternalFMSTheoremPackage
    {witness : ActualAlgebraicCompactnessWitness}
    (extension : CompleteAcceptanceExtension witness) :
    CompleteExternalFMSTheoremPackage :=
  extension.package

end CompleteAcceptanceExtension

/-! ## The finite initial tower cannot discharge the boundary -/

open Cantilune.Pi.FMSCpoFiniteApproximationTower

/-- The first finite connector has no retraction. -/
theorem finiteTowerSeed_hasNoRetraction :
    ¬ ∃ backward : Approximation 1 ⟶ Approximation 0,
        approximationConnection 0 ≫ backward =
          𝟙 (Approximation 0) :=
  no_seed_retraction

/-- The first two finite stages cannot be a fixed-point isomorphism. -/
theorem initialStage_not_fixedPoint :
    IsEmpty
      (Approximation 0 ≅
        ActualAgentFunctor.obj (Approximation 0)) := by
  simpa only [Approximation] using no_initial_firstStage_iso

/--
Consequently no actual fixed-point witness can choose the initial finite
stage as its carrier.
-/
theorem fixedPoint_agent_ne_initialStage
    (witness : ActualFixedPointWitness) :
    witness.agent ≠ Approximation 0 := by
  intro equal
  have impossible :
      Approximation 0 ≅
        ActualAgentFunctor.obj (Approximation 0) :=
    (eqToIso equal.symm) ≪≫
      witness.unfoldIso ≪≫
      ActualAgentFunctor.mapIso (eqToIso equal)
  exact initialStage_not_fixedPoint.false impossible

/--
The stronger compactness witness also cannot be obtained by taking the
initial finite stage as the alleged solution.
-/
theorem compactWitness_agent_ne_initialStage
    (witness : ActualAlgebraicCompactnessWitness) :
    witness.fixed.agent ≠ Approximation 0 :=
  fixedPoint_agent_ne_initialStage witness.fixed

end Cantilune.Pi.FMSCpoActualDomainEquationBoundary
