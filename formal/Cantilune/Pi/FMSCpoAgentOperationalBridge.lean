import Cantilune.Pi.FMSCpoAgentRestriction
import Cantilune.Pi.P1cFullNativeRefinement

/-!
# Concrete D1-A agent/late-pi operational bridge

This module connects one actual native P1c reconnect transition to the
concrete recursive D1-A carrier

`A ≅ PωScott (H A)`.

The construction is deliberately direct:

* inactive is the fold of the actual lower-power bottom;
* one tau prefix is the fold of the principal tau action;
* both constructors are continuous and natural in the finite-name world;
* the canonical P1c `instanceReconnect` event is an actual
  `Late.NativeStep`; and
* its source, tau label, and target form a commuting unfold square with the
  concrete fixed point.

The final section proves that the concrete Table-4 restriction constructed
in `FMSCpoAgentRestriction` preserves this tau representative.  No theorem
field or externally supplied semantic package is used.

This is the D1-A / lower-Hoare bridge.  It does not claim separated
divergence/deadlock semantics or strong-bisimulation full abstraction.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoAgentOperationalBridge

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoUnseparatedSourceCore
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.P1cFullNativeRefinement

/-! ## Concrete fixed-point elements -/

/-- The actual bottom action family at one finite world. -/
def fixedBottomLayer (world : World) :
    OmegaScottPower (ActionRepresentation Agent world) :=
  ⊥

/-- Inactive agent, constructed by folding the actual lower-power bottom. -/
def fixedInactive (world : World) : Agent.obj world :=
  agentFold.app world (fixedBottomLayer world)

/-- The exact tau summand of the FMS action representation. -/
def tauAction
    (world : World) (continuation : Agent.obj world) :
    ActionRepresentation Agent world :=
  Sum.inr (Sum.inr (Sum.inr continuation))

/-- The actual principal lower computation containing one tau action. -/
def fixedTauLayer
    (world : World) (continuation : Agent.obj world) :
    (ActualAgentFunctor.obj Agent).obj world :=
  principalRaw (tauAction world continuation)

/-- One semantic tau prefix, obtained by folding the actual action layer. -/
def fixedTauAgent
    (world : World) (continuation : Agent.obj world) :
    Agent.obj world :=
  agentFold.app world (fixedTauLayer world continuation)

/-- Injection into the tau summand is omega-continuous. -/
def tauActionContinuous (world : World) :
    Agent.obj world →𝒄 ActionRepresentation Agent world :=
  separatedInr.comp (separatedInr.comp separatedInr)

/-- Principal tau-action formation is omega-continuous. -/
def fixedTauLayerContinuous (world : World) :
    Agent.obj world →𝒄
      (ActualAgentFunctor.obj Agent).obj world :=
  principal.comp (tauActionContinuous world)

/-- Folding a principal tau action is an actual omega-continuous map. -/
def fixedTauContinuous (world : World) :
    Agent.obj world →𝒄 Agent.obj world :=
  (agentFold.app world).comp (fixedTauLayerContinuous world)

@[simp]
theorem fixedTauContinuous_apply
    (world : World) (continuation : Agent.obj world) :
    fixedTauContinuous world continuation =
      fixedTauAgent world continuation :=
  rfl

/-- The concrete fold/unfold isomorphism computes inactive exactly. -/
@[simp]
theorem fixedInactive_unfold (world : World) :
    agentUnfold.app world (fixedInactive world) =
      fixedBottomLayer world := by
  exact
    concreteActualAlgebraicCompactnessWitness.fixed.fold_unfold
      world (fixedBottomLayer world)

/-- The concrete fold/unfold isomorphism computes tau prefix exactly. -/
@[simp]
theorem fixedTauAgent_unfold
    (world : World) (continuation : Agent.obj world) :
    agentUnfold.app world (fixedTauAgent world continuation) =
      fixedTauLayer world continuation := by
  exact
    concreteActualAlgebraicCompactnessWitness.fixed.fold_unfold
      world (fixedTauLayer world continuation)

/-- The actual unfold component is injective because it has the actual fold. -/
theorem agentUnfold_injective (world : World) :
    Function.Injective (agentUnfold.app world) := by
  intro left right equal
  have folded := congrArg (agentFold.app world) equal
  calc
    left =
        agentFold.app world (agentUnfold.app world left) := by
      symm
      exact
        concreteActualAlgebraicCompactnessWitness.fixed.unfold_fold
          world left
    _ =
        agentFold.app world (agentUnfold.app world right) :=
      folded
    _ = right := by
      exact
        concreteActualAlgebraicCompactnessWitness.fixed.unfold_fold
          world right

/-! ## World naturality -/

/-- World reindexing preserves the actual lower-power bottom. -/
@[simp]
theorem fixedBottomLayer_world_natural
    {source target : World}
    (injection : source ⟶ target) :
    (ActualAgentFunctor.obj Agent).map injection
        (fixedBottomLayer source) =
      fixedBottomLayer target := by
  change
    mapRaw (actionWorldMap Agent injection)
        (⊥ : OmegaScottPower
          (ActionRepresentation Agent source)) =
      (⊥ : OmegaScottPower
        (ActionRepresentation Agent target))
  exact mapRaw_bot (actionWorldMap Agent injection)

/-- World reindexing maps a principal tau action to the corresponding tau. -/
@[simp]
theorem fixedTauLayer_world_natural
    {source target : World}
    (injection : source ⟶ target)
    (continuation : Agent.obj source) :
    (ActualAgentFunctor.obj Agent).map injection
        (fixedTauLayer source continuation) =
      fixedTauLayer target (Agent.map injection continuation) := by
  change
    mapRaw (actionWorldMap Agent injection)
        (principalRaw (tauAction source continuation)) =
      principalRaw
        (tauAction target (Agent.map injection continuation))
  rw [mapRaw_principal]
  exact congrArg principalRaw
    (actionWorldMap_tau Agent injection continuation)

/-- Inactive is a natural family of elements of the fixed agent. -/
@[simp]
theorem fixedInactive_world_natural
    {source target : World}
    (injection : source ⟶ target) :
    Agent.map injection (fixedInactive source) =
      fixedInactive target := by
  change
    Agent.map injection
        (agentFold.app source (fixedBottomLayer source)) =
      agentFold.app target (fixedBottomLayer target)
  rw [← fixedBottomLayer_world_natural injection]
  exact
    (ContinuousHom.congr_fun
      (agentFold.naturality injection)
      (fixedBottomLayer source)).symm

/-- Tau prefix commutes with every finite-world injection. -/
@[simp]
theorem fixedTauAgent_world_natural
    {source target : World}
    (injection : source ⟶ target)
    (continuation : Agent.obj source) :
    Agent.map injection (fixedTauAgent source continuation) =
      fixedTauAgent target (Agent.map injection continuation) := by
  change
    Agent.map injection
        (agentFold.app source
          (fixedTauLayer source continuation)) =
      agentFold.app target
        (fixedTauLayer target
          (Agent.map injection continuation))
  rw [← fixedTauLayer_world_natural injection continuation]
  exact
    (ContinuousHom.congr_fun
      (agentFold.naturality injection)
      (fixedTauLayer source continuation)).symm

/-- Tau prefix is an actual continuous-natural endomorphism of the agent. -/
def fixedTauNatural : Agent ⟶ Agent where
  app world := fixedTauContinuous world
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro continuation
    exact
      (fixedTauAgent_world_natural injection continuation).symm

/-! ## The concrete P1c reconnect square -/

/-- Canonical raw source of the normative reconnect event. -/
def reconnectSourceProcess : Raw.Proc :=
  readyProcess .instanceReconnect

/-- Canonical raw label of the normative reconnect event. -/
def reconnectAction : Raw.Action :=
  firstAction .instanceReconnect

/-- Canonical raw target of the normative reconnect event. -/
def reconnectTargetProcess : Raw.Proc :=
  firstTarget .instanceReconnect

/-- The reconnect target is interpreted by the actual folded bottom. -/
def reconnectTargetAgent (world : World) : Agent.obj world :=
  fixedInactive world

/-- The reconnect source is interpreted by one actual semantic tau layer. -/
def reconnectSourceAgent (world : World) : Agent.obj world :=
  fixedTauAgent world (reconnectTargetAgent world)

/-- The selected reconnect is one genuine strong standard late-pi step. -/
theorem reconnect_native :
    Late.NativeStep
      reconnectSourceProcess reconnectAction reconnectTargetProcess := by
  exact first_native .instanceReconnect

@[simp]
theorem reconnectAction_eq_tau :
    reconnectAction = .tau :=
  rfl

/--
The actual operational/denotational square.

The first conjunct is the genuine native step.  The remaining equalities
state that the fixed-point observation of the source is exactly the
principal tau action whose continuation is the denotation of the target,
and that the target unfolds to the actual D1-A bottom.
-/
theorem reconnect_fixed_point_action_commutes (world : World) :
    Late.NativeStep
        reconnectSourceProcess reconnectAction reconnectTargetProcess ∧
      reconnectAction = .tau ∧
      agentUnfold.app world (reconnectSourceAgent world) =
        principalRaw
          (tauAction world (reconnectTargetAgent world)) ∧
      agentUnfold.app world (reconnectTargetAgent world) =
        fixedBottomLayer world := by
  exact ⟨reconnect_native, rfl, fixedTauAgent_unfold _ _, fixedInactive_unfold _⟩

/-- Both denotational endpoints commute with world reindexing. -/
theorem reconnect_endpoints_world_natural
    {source target : World}
    (injection : source ⟶ target) :
    Agent.map injection (reconnectSourceAgent source) =
        reconnectSourceAgent target ∧
      Agent.map injection (reconnectTargetAgent source) =
        reconnectTargetAgent target := by
  constructor
  · exact
      (fixedTauAgent_world_natural injection
        (reconnectTargetAgent source)).trans
        (congrArg (fixedTauAgent target)
          (fixedInactive_world_natural injection))
  · exact fixedInactive_world_natural injection

/-! ## Restriction coherence on the representative -/

/-- Pointwise form of the recursive Table-4 unroll equation. -/
theorem agentRestriction_unfold_at
    (world : World) (value : Agent.obj (world + 1)) :
    agentUnfold.app world (agentRestrictionAt world value) =
      (ActualAgentFunctor.map agentRestriction).app world
        (actionRestrictionKleisli world
          (agentUnfold.app (world + 1) value)) := by
  have components :=
    congrArg (fun transformation => transformation.app world)
      agentRestriction_unroll
  exact (ContinuousHom.congr_fun components value).symm

/-- The concrete recursive restriction preserves every semantic tau prefix. -/
theorem agentRestriction_fixedTau
    (world : World) (continuation : Agent.obj (world + 1)) :
    agentRestrictionAt world
        (fixedTauAgent (world + 1) continuation) =
      fixedTauAgent world (agentRestrictionAt world continuation) := by
  apply agentUnfold_injective world
  rw [agentRestriction_unfold_at, fixedTauAgent_unfold,
    fixedTauAgent_unfold]
  change
    mapRaw
        (actionModelMapComponent agentRestriction world)
        (actionRestrictionKleisli world
          (principalRaw
            (tauAction (world + 1) continuation))) =
      principalRaw
        (tauAction world (agentRestrictionAt world continuation))
  rw [actionRestrictionKleisli_principal]
  simp only [tauAction, actionRestrictionStep_tau, tauCase_apply,
    mapRaw_principal, actionModelMap_tau]
  rfl

/-- Restriction maps the actual inactive representative to inactive. -/
theorem agentRestriction_fixedInactive (world : World) :
    agentRestrictionAt world (fixedInactive (world + 1)) =
      fixedInactive world := by
  apply agentUnfold_injective world
  rw [agentRestriction_unfold_at, fixedInactive_unfold,
    fixedInactive_unfold]
  change
    mapRaw _
        (actionRestrictionKleisli world
          (⊥ : OmegaScottPower
            (ActionRepresentation Agent (world + 1)))) =
      (⊥ : OmegaScottPower
        (ActionRepresentation Agent world))
  change
    mapRaw
        (actionModelMapComponent agentRestriction world)
        (flattenRaw
          (mapRaw (actionRestrictionStep world)
            (⊥ : OmegaScottPower
              (ActionRepresentation Agent (world + 1))))) =
      (⊥ : OmegaScottPower
        (ActionRepresentation Agent world))
  rw [mapRaw_bot, flattenRaw_effectBottom, mapRaw_bot]

/-- Restriction commutes with the selected reconnect semantic square. -/
theorem reconnect_restriction_commutes (world : World) :
    agentRestrictionAt world (reconnectSourceAgent (world + 1)) =
        reconnectSourceAgent world ∧
      agentRestrictionAt world (reconnectTargetAgent (world + 1)) =
        reconnectTargetAgent world := by
  constructor
  · change
      agentRestrictionAt world
          (fixedTauAgent (world + 1)
            (fixedInactive (world + 1))) =
        fixedTauAgent world (fixedInactive world)
    calc
      agentRestrictionAt world
          (fixedTauAgent (world + 1)
            (fixedInactive (world + 1))) =
          fixedTauAgent world
            (agentRestrictionAt world
              (fixedInactive (world + 1))) :=
        agentRestriction_fixedTau world _
      _ = fixedTauAgent world (fixedInactive world) :=
        congrArg (fixedTauAgent world)
          (agentRestriction_fixedInactive world)
  · exact agentRestriction_fixedInactive world

end Cantilune.Pi.FMSCpoAgentOperationalBridge
