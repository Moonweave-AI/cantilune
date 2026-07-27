import Cantilune.Pi.FMSFinitePower

/-!
# Finite Set-side FMS agent syntax and approximants

This module constructs two pieces that are available without the external CPO
theorem:

1. a finite recursive prefix/choice syntax with a structural fold/unfold; and
2. the exact finite stages `A₀ = 0`, `Aₙ₊₁ = P_f (H Aₙ)`.

The binary-choice syntax is also quotiented by the ACUI equations, producing
the finite semilattice laws expected of `P_f`.  What is *not* claimed here is
that the stage chain has been equipped with the full finite-injection action
of `(N ⇒ -)`, or that its colimit is an initial algebra in `Set^I`.  Those are
precisely the remaining Set-side domain-equation obligations.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSFiniteAgent

open Cantilune.Pi.FMSFinitePower

/-- The exact four FMS action summands at one finite world. -/
inductive ActionShape (agent : Nat → Type) (world : Nat) where
  | input
      (channel : Fin world)
      (known : Fin world → agent world)
      (fresh : agent (world + 1))
  | freeOutput
      (channel value : Fin world)
      (continuation : agent world)
  | boundOutput
      (channel : Fin world)
      (continuation : agent (world + 1))
  | tau (continuation : agent world)

namespace ActionShape

/-- Map a world-indexed family transformation through the FMS action shape. -/
def map {source target : Nat → Type}
    (transformation : ∀ world, source world → target world) :
    ActionShape source world → ActionShape target world
  | .input channel known fresh =>
      .input channel
        (fun name => transformation world (known name))
        (transformation (world + 1) fresh)
  | .freeOutput channel value continuation =>
      .freeOutput channel value (transformation world continuation)
  | .boundOutput channel continuation =>
      .boundOutput channel (transformation (world + 1) continuation)
  | .tau continuation =>
      .tau (transformation world continuation)

@[simp]
theorem map_id (action : ActionShape source world) :
    map (fun _ value => value) action = action := by
  cases action <;> rfl

theorem map_comp
    {source middle target : Nat → Type}
    (first : ∀ world, source world → middle world)
    (second : ∀ world, middle world → target world)
    (action : ActionShape source world) :
    map second (map first action) =
      map (fun world value => second world (first world value)) action := by
  cases action <;> rfl

end ActionShape

/-! ## Recursive finite prefix/choice syntax -/

mutual

/-- Finite-control agent trees. -/
inductive Agent : Nat → Type where
  | zero {world : Nat} : Agent world
  | choice {world : Nat} (left right : Agent world) : Agent world
  | prefix {world : Nat} (action : Prefix world) : Agent world

/-- A single FMS prefix whose continuations are finite agents. -/
inductive Prefix : Nat → Type where
  | input {world : Nat}
      (channel : Fin world)
      (known : Fin world → Agent world)
      (fresh : Agent (world + 1)) : Prefix world
  | freeOutput {world : Nat}
      (channel value : Fin world)
      (continuation : Agent world) : Prefix world
  | boundOutput {world : Nat}
      (channel : Fin world)
      (continuation : Agent (world + 1)) : Prefix world
  | tau {world : Nat} (continuation : Agent world) : Prefix world

end

/-- Algebra data for a structural fold of finite agent trees. -/
structure Algebra (carrier : Nat → Type) where
  zero : ∀ world, carrier world
  choice : ∀ world, carrier world → carrier world → carrier world
  action : ∀ world, ActionShape carrier world → carrier world

mutual

/-- Structural fold on agents. -/
def Agent.fold (algebra : Algebra carrier) :
    ∀ {world}, Agent world → carrier world
  | _, .zero => algebra.zero _
  | _, .choice left right =>
      algebra.choice _ (left.fold algebra) (right.fold algebra)
  | _, .prefix action => algebra.action _ (action.fold algebra)

/-- Structural fold through one prefix layer. -/
def Prefix.fold (algebra : Algebra carrier) :
    ∀ {world}, Prefix world → ActionShape carrier world
  | _, .input channel known fresh =>
      .input channel
        (fun name => (known name).fold algebra)
        (fresh.fold algebra)
  | _, .freeOutput channel value continuation =>
      .freeOutput channel value (continuation.fold algebra)
  | _, .boundOutput channel continuation =>
      .boundOutput channel (continuation.fold algebra)
  | _, .tau continuation =>
      .tau (continuation.fold algebra)

end

/-- One explicit syntax layer of the finite tree equation. -/
abbrev Layer (agent : Nat → Type) (world : Nat) :=
  PUnit ⊕ (agent world × agent world) ⊕ ActionShape agent world

/-- Expose the root constructor of a finite agent. -/
def Agent.unfold : Agent world → Layer Agent world
  | .zero => .inl PUnit.unit
  | .choice left right => .inr (.inl (left, right))
  | .prefix action =>
      .inr (.inr <| match action with
        | .input channel known fresh =>
            .input channel known fresh
        | .freeOutput channel value continuation =>
            .freeOutput channel value continuation
        | .boundOutput channel continuation =>
            .boundOutput channel continuation
        | .tau continuation => .tau continuation)

/-- Rebuild a finite agent from one exposed syntax layer. -/
def Agent.refold : Layer Agent world → Agent world
  | .inl _ => .zero
  | .inr (.inl (left, right)) => .choice left right
  | .inr (.inr action) =>
      .prefix <| match action with
        | .input channel known fresh =>
            .input channel known fresh
        | .freeOutput channel value continuation =>
            .freeOutput channel value continuation
        | .boundOutput channel continuation =>
            .boundOutput channel continuation
        | .tau continuation => .tau continuation

@[simp]
theorem Agent.refold_unfold (agent : Agent world) :
    Agent.refold agent.unfold = agent := by
  cases agent with
  | zero => rfl
  | choice left right => rfl
  | «prefix» action =>
      cases action <;> rfl

@[simp]
theorem Agent.unfold_refold (layer : Layer Agent world) :
    Agent.unfold (Agent.refold layer) = layer := by
  rcases layer with unitValue | layer
  · cases unitValue
    rfl
  · rcases layer with pair | action
    · rfl
    · cases action <;> rfl

/-- The recursive finite syntax is isomorphic to one explicit AST layer. -/
def agentLayerEquiv (world : Nat) :
    Agent world ≃ Layer Agent world where
  toFun := Agent.unfold
  invFun := Agent.refold
  left_inv := Agent.refold_unfold
  right_inv := Agent.unfold_refold

/-! ## ACUI quotient of finite choice -/

mutual

/-- Congruence and ACUI equations for binary nondeterministic choice. -/
inductive ChoiceEq : {world : Nat} → Agent world → Agent world → Prop
  | refl (agent : Agent world) : ChoiceEq agent agent
  | symm (proof : ChoiceEq left right) : ChoiceEq right left
  | trans (first : ChoiceEq left middle) (second : ChoiceEq middle right) :
      ChoiceEq left right
  | choiceCongr (left : ChoiceEq left₁ left₂)
      (right : ChoiceEq right₁ right₂) :
      ChoiceEq (.choice left₁ right₁) (.choice left₂ right₂)
  | prefixCongr (proof : PrefixEq left right) :
      ChoiceEq (.prefix left) (.prefix right)
  | zeroLeft (agent : Agent world) :
      ChoiceEq (.choice .zero agent) agent
  | comm (left right : Agent world) :
      ChoiceEq (.choice left right) (.choice right left)
  | assoc (left middle right : Agent world) :
      ChoiceEq
        (.choice (.choice left middle) right)
        (.choice left (.choice middle right))
  | idem (agent : Agent world) :
      ChoiceEq (.choice agent agent) agent

/-- Prefix congruence generated by equivalence of every continuation. -/
inductive PrefixEq : {world : Nat} → Prefix world → Prefix world → Prop
  | input
      (known :
        ∀ name, ChoiceEq (leftKnown name) (rightKnown name))
      (fresh : ChoiceEq leftFresh rightFresh) :
      PrefixEq
        (.input channel leftKnown leftFresh)
        (.input channel rightKnown rightFresh)
  | freeOutput (continuation : ChoiceEq left right) :
      PrefixEq
        (.freeOutput channel value left)
        (.freeOutput channel value right)
  | boundOutput (continuation : ChoiceEq left right) :
      PrefixEq
        (.boundOutput channel left)
        (.boundOutput channel right)
  | tau (continuation : ChoiceEq left right) :
      PrefixEq (.tau left) (.tau right)

end

theorem choiceEq_equivalence (world : Nat) :
    Equivalence (@ChoiceEq world) where
  refl := ChoiceEq.refl
  symm := ChoiceEq.symm
  trans := ChoiceEq.trans

/-- Setoid quotient imposing the finite-semilattice equations on choices. -/
def choiceSetoid (world : Nat) : Setoid (Agent world) where
  r := ChoiceEq
  iseqv := choiceEq_equivalence world

/-- The ACUI choice setoid used by `ChoiceQuotient`. -/
instance choiceSetoidInstance (world : Nat) : Setoid (Agent world) :=
  choiceSetoid world

/-- Finite agents modulo choice ACUI and prefix congruence. -/
abbrev ChoiceQuotient (world : Nat) :=
  Quotient (choiceSetoidInstance world)

/-- Inactive agent in the choice quotient. -/
def quotientZero (world : Nat) : ChoiceQuotient world :=
  Quotient.mk' (Agent.zero : Agent world)

/-- Well-defined nondeterministic choice in the quotient. -/
def quotientChoice (left right : ChoiceQuotient world) :
    ChoiceQuotient world :=
  Quotient.map₂ Agent.choice
    (fun _ _ leftEq _ _ rightEq =>
      ChoiceEq.choiceCongr leftEq rightEq)
    left right

@[simp]
theorem quotientChoice_zero_left (agent : ChoiceQuotient world) :
    quotientChoice (quotientZero world) agent = agent := by
  refine Quotient.inductionOn agent ?_
  intro representative
  exact Quotient.sound (ChoiceEq.zeroLeft representative)

theorem quotientChoice_comm (left right : ChoiceQuotient world) :
    quotientChoice left right = quotientChoice right left := by
  refine Quotient.inductionOn₂ left right ?_
  intro leftRepresentative rightRepresentative
  exact Quotient.sound
    (ChoiceEq.comm leftRepresentative rightRepresentative)

theorem quotientChoice_assoc
    (left middle right : ChoiceQuotient world) :
    quotientChoice (quotientChoice left middle) right =
      quotientChoice left (quotientChoice middle right) := by
  refine Quotient.inductionOn₃ left middle right ?_
  intro leftRepresentative middleRepresentative rightRepresentative
  exact Quotient.sound
    (ChoiceEq.assoc leftRepresentative middleRepresentative
      rightRepresentative)

@[simp]
theorem quotientChoice_idem (agent : ChoiceQuotient world) :
    quotientChoice agent agent = agent := by
  refine Quotient.inductionOn agent ?_
  intro representative
  exact Quotient.sound (ChoiceEq.idem representative)

/-! ## Exact finite stages of `A = P_f (H A)` -/

/--
The initial-chain approximants.  Stage zero is the empty carrier; every
successor is exactly the finite powerset of the four FMS action summands over
the previous stage.
-/
def Approximation : Nat → Nat → Type
  | 0, _ => Empty
  | depth + 1, world =>
      FinitePower (ActionShape (Approximation depth) world)

/-- The successor-stage equation is definitional. -/
def Approximation.fold :
    FinitePower (ActionShape (Approximation depth) world) →
      Approximation (depth + 1) world :=
  id

/-- Expose a successor approximation as `P_f(H A_depth)`. -/
def Approximation.unfold :
    Approximation (depth + 1) world →
      FinitePower (ActionShape (Approximation depth) world) :=
  id

@[simp]
theorem Approximation.fold_unfold
    (agent : Approximation (depth + 1) world) :
    Approximation.fold (Approximation.unfold agent) = agent :=
  rfl

@[simp]
theorem Approximation.unfold_fold
    (actions :
      FinitePower (ActionShape (Approximation depth) world)) :
    Approximation.unfold (Approximation.fold actions) = actions :=
  rfl

/-- Empty nondeterministic agent at every positive approximation stage. -/
def Approximation.zero (depth world : Nat) :
    Approximation (depth + 1) world :=
  Approximation.fold ∅

/-- Finite nondeterministic choice at every positive approximation stage. -/
def Approximation.choice
    (left right : Approximation (depth + 1) world) :
    Approximation (depth + 1) world :=
  Approximation.fold
    (Approximation.unfold left ∪ Approximation.unfold right)

theorem Approximation.choice_comm
    (left right : Approximation (depth + 1) world) :
    Approximation.choice left right =
      Approximation.choice right left :=
  congrArg Approximation.fold
    (Finset.union_comm
      (Approximation.unfold left) (Approximation.unfold right))

@[simp]
theorem Approximation.choice_idem
    (agent : Approximation (depth + 1) world) :
    Approximation.choice agent agent = agent :=
  by
    simp [Approximation.choice]

end Cantilune.Pi.FMSFiniteAgent
