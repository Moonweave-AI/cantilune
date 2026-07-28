import Cantilune.Pi.FMSCpoFinitePower
import Cantilune.Pi.FMSFiniteAgent

/-!
# Continuous finite-agent syntax and its height colimit

The finite FMS syntax is equality ordered when embedded into `ωCPO`.  This
file turns its fold/unfold equivalence into an actual continuous isomorphism
and proves a universal property for the colimit of the finite-height syntax
filtration.

The height filtration is a colimit presentation of the recursive finite AST.
It must not be confused with the still-missing enriched initial solution of
`A ≅ P(H A)` in all of `ωCPO^I`.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSCpoFiniteAgent

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSFiniteAgent
open Cantilune.Pi.FMSFinitePower
open Cantilune.Pi.FMSCpoFinitePower

/-- Equality-ordered finite agents form actual omega-CPO objects. -/
def agentCpo (world : Nat) : ωCPO :=
  ωCPO.of (EqualityOrder (Agent world))

/-- Equality-ordered one-step syntax layers. -/
def layerCpo (world : Nat) : ωCPO :=
  ωCPO.of (EqualityOrder (Layer Agent world))

/-- Unfolding is continuous because the finite syntax carries equality order. -/
def unfoldContinuous (world : Nat) :
    agentCpo world ⟶ layerCpo world :=
  EqualityOrder.continuous Agent.unfold

/-- Refolding is continuous for the same reason. -/
def refoldContinuous (world : Nat) :
    layerCpo world ⟶ agentCpo world :=
  EqualityOrder.continuous Agent.refold

/--
The recursive finite syntax equation as a genuine isomorphism in mathlib's
category of omega-CPOs and continuous maps.
-/
def agentLayerIso (world : Nat) :
    agentCpo world ≅ layerCpo world where
  hom := unfoldContinuous world
  inv := refoldContinuous world
  hom_inv_id := by
    apply ContinuousHom.ext
    intro agent
    exact Agent.refold_unfold agent
  inv_hom_id := by
    apply ContinuousHom.ext
    intro layer
    exact Agent.unfold_refold layer

/-- Equality-ordered objectwise FMS approximation. -/
def approximationCpo (depth world : Nat) : ωCPO :=
  ωCPO.of (EqualityOrder (Approximation depth world))

/-- The successor approximation equation is a continuous isomorphism. -/
def approximationIso (depth world : Nat) :
    approximationCpo (depth + 1) world ≅
      ωCPO.of
        (EqualityOrder
          (FinitePower (ActionShape (Approximation depth) world))) where
  hom := EqualityOrder.continuous Approximation.unfold
  inv := EqualityOrder.continuous Approximation.fold
  hom_inv_id := by
    apply ContinuousHom.ext
    intro action
    exact Approximation.unfold_fold action
  inv_hom_id := by
    apply ContinuousHom.ext
    intro agent
    exact Approximation.fold_unfold agent

mutual

/-- Structural height of a finite agent. -/
def agentHeight : {world : Nat} → Agent world → Nat
  | _, .zero => 0
  | _, .choice left right =>
      Nat.max (agentHeight left) (agentHeight right) + 1
  | _, .prefix action => prefixHeight action + 1

/-- Maximum continuation height under one prefix. -/
def prefixHeight : {world : Nat} → Prefix world → Nat
  | _, .input _ known fresh =>
      Nat.max
        (Finset.univ.sup fun name => agentHeight (known name))
        (agentHeight fresh)
  | _, .freeOutput _ _ continuation => agentHeight continuation
  | _, .boundOutput _ continuation => agentHeight continuation
  | _, .tau continuation => agentHeight continuation

end

/-- Agents whose structural height is bounded by one finite stage. -/
abbrev BoundedAgent (depth world : Nat) :=
  { agent : Agent world // agentHeight agent ≤ depth }

/-- Inclusion of one finite-height stage into a later stage. -/
def widen {first second world : Nat} (bound : first ≤ second) :
    BoundedAgent first world → BoundedAgent second world :=
  fun agent => ⟨agent.1, le_trans agent.2 bound⟩

@[simp]
theorem widen_value {first second world : Nat} (bound : first ≤ second)
    (agent : BoundedAgent first world) :
    (widen bound agent).1 = agent.1 :=
  rfl

/-- Every finite agent appears in its own finite-height stage. -/
def canonicalStage (agent : Agent world) :
    BoundedAgent (agentHeight agent) world :=
  ⟨agent, le_rfl⟩

/--
A cocone over the directed finite-height filtration, stated without hidden
category-theoretic assumptions.
-/
structure HeightCocone (world : Nat) (target : Type u) where
  leg : ∀ depth, BoundedAgent depth world → target
  compatible :
    ∀ {first second} (bound : first ≤ second)
      (agent : BoundedAgent first world),
      leg second (widen bound agent) = leg first agent

/-- The map out of the height colimit selected by a compatible cocone. -/
def HeightCocone.lift (cocone : HeightCocone world target) :
    Agent world → target :=
  fun agent => cocone.leg (agentHeight agent) (canonicalStage agent)

theorem HeightCocone.lift_stage
    (cocone : HeightCocone world target) (depth : Nat)
    (agent : BoundedAgent depth world) :
    cocone.lift agent.1 = cocone.leg depth agent := by
  have compatibility :=
    cocone.compatible agent.2 (canonicalStage agent.1)
  have sameWiden :
      widen agent.2 (canonicalStage agent.1) = agent := by
    apply Subtype.ext
    rfl
  rw [sameWiden] at compatibility
  exact compatibility.symm

/-- Uniqueness part of the finite-height colimit universal property. -/
theorem HeightCocone.lift_unique
    (cocone : HeightCocone world target)
    (candidate : Agent world → target)
    (agrees :
      ∀ depth (agent : BoundedAgent depth world),
        candidate agent.1 = cocone.leg depth agent) :
    candidate = cocone.lift := by
  funext agent
  exact agrees (agentHeight agent) (canonicalStage agent)

/-- Each stage inclusion is an actual continuous map in `ωCPO`. -/
def stageContinuous (depth world : Nat) :
    ωCPO.of (EqualityOrder (BoundedAgent depth world)) ⟶
      agentCpo world :=
  EqualityOrder.continuous Subtype.val

/--
The Set-level colimit lift is continuous after equality-order realization.
This closes the finite syntax colimit, not the Abramsky-domain colimit.
-/
def HeightCocone.continuousLift
    (cocone : HeightCocone world target) :
    EqualityOrder (Agent world) →𝒄 EqualityOrder target :=
  EqualityOrder.continuous cocone.lift

end Cantilune.Pi.FMSCpoFiniteAgent
