import Cantilune.Pi.FMSCpoUnseparatedSourceCore
import Cantilune.Pi.FMSCpoNominalDeltaCoherence

/-!
# Concrete Table-4 restriction on the unseparated recursive agent

This module constructs the action translation used by the FMS restriction
operator on Cantilune's concrete D1-A unseparated solution
`A ≅ PωScott (H A)`.  The
distinguished restricted name is always the last coordinate of the source
world.  The five source cases are the ones in Table 4 of
Fiore--Moggi--Sangiorgi:

* input on the restricted channel is discarded;
* input on an old channel is retained and its fresh continuation is
  alpha-swapped;
* free output on the restricted channel is discarded;
* free output of the restricted value becomes bound output;
* ordinary free output, bound output, and tau are retained.

The target continuations live in the shifted carrier `δ A`.  Consequently
the construction is a genuine coalgebra on `δ A`; terminality of the
concrete recursive solution then supplies the recursive restriction map.

No proof-carrying hiding interface is used in this file.

The exact boundary is important.  The construction below proves:

* continuity of every branch and of the Kleisli action fold;
* equivariance for every finite-world injection;
* an actual continuous-natural transformation on the fixed recursive
  carrier;
* the recursive unroll equation and its uniqueness by terminality.

It does **not** identify the lower omega-Scott effect with the separated
Abramsky/FMS free pointed continuous semilattice.  It also does not by itself
prove the complete Table-5 parallel/left-merge laws, operational adequacy,
definability, or full abstraction.  Those require separate theorem layers.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoAgentRestriction

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoNameAbstractionFunctor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoInputTransport
open Cantilune.Pi.FMSCpoNominalDeltaCoherence
open Cantilune.Pi.FMSCpoWorld

/-! ## The concrete recursive carrier -/

/-- The actual carrier solving `A ≅ P (H A)`. -/
abbrev Agent : World ⥤ ωCPO :=
  concreteActualAlgebraicCompactnessWitness.fixed.agent

/-- The carrier with one distinguished fresh name. -/
abbrev ShiftAgent : World ⥤ ωCPO :=
  shift.obj Agent

/-- The actual continuous-natural unfold direction. -/
abbrev agentUnfold :
    Agent ⟶ ActualAgentFunctor.obj Agent :=
  concreteActualAlgebraicCompactnessWitness.fixed.unfoldIso.hom

/-- The actual continuous-natural fold direction. -/
abbrev agentFold :
    ActualAgentFunctor.obj Agent ⟶ Agent :=
  concreteActualAlgebraicCompactnessWitness.fixed.foldIso.hom

/-! ## Small continuous combinators for separated action sums -/

/-- Continuous injection into the left side of a separated coproduct. -/
def separatedInl
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    α →𝒄 (α ⊕ β) where
  toFun := Sum.inl
  monotone' := fun _ _ ordered =>
    Sum.inl_le_inl_iff.2 ordered
  map_ωSup' := by
    intro chain
    change
      Sum.inl (ωSup chain) =
        ωSup (FMSCpoSeparatedSum.inlChain (β := β) chain)
    rw [FMSCpoSeparatedSum.omegaSup_inlChain]

/-- Continuous injection into the right side of a separated coproduct. -/
def separatedInr
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β] :
    β →𝒄 (α ⊕ β) where
  toFun := Sum.inr
  monotone' := fun _ _ ordered =>
    Sum.inr_le_inr_iff.2 ordered
  map_ωSup' := by
    intro chain
    change
      Sum.inr (ωSup chain) =
        ωSup (FMSCpoSeparatedSum.inrChain (α := α) chain)
    rw [FMSCpoSeparatedSum.omegaSup_inrChain]

/--
A continuously varying payload selected by an equality-ordered finite tag.
The tag of an increasing chain is definitionally constant.
-/
def taggedContinuous
    {ι α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (branch : ι → α →𝒄 β) :
    (EqualityOrder ι × α) →𝒄 β where
  toFun pair := branch pair.1 pair.2
  monotone' := by
    intro left right ordered
    rcases left with ⟨leftTag, leftValue⟩
    rcases right with ⟨rightTag, rightValue⟩
    have tagEq : leftTag = rightTag := ordered.1
    subst rightTag
    exact (branch leftTag).monotone ordered.2
  map_ωSup' := by
    intro chain
    let payload : Chain α :=
      chain.map OrderHom.snd
    let mappedOrder : (EqualityOrder ι × α) →o β :=
      { toFun := fun pair => branch pair.1 pair.2
        monotone' := by
          intro left right ordered
          rcases left with ⟨leftTag, leftValue⟩
          rcases right with ⟨rightTag, rightValue⟩
          have tagEq : leftTag = rightTag := ordered.1
          subst rightTag
          exact (branch leftTag).monotone ordered.2 }
    let branchOrder : α →o β :=
      (branch (chain 0).1).toOrderHom
    have tagAt (index : Nat) :
        (chain index).1 = (chain 0).1 := by
      exact (chain.monotone (Nat.zero_le index)).1.symm
    have mappedChain :
        chain.map mappedOrder =
          payload.map branchOrder := by
      apply Chain.ext
      funext index
      change
        branch (chain index).1 (chain index).2 =
          branch (chain 0).1 (chain index).2
      rw [tagAt index]
    change
      branch (chain 0).1 (ωSup payload) =
        ωSup (chain.map mappedOrder)
    rw [mappedChain]
    exact (branch (chain 0).1).continuous payload

/-- Dispatch on two equality-ordered tags and a continuous payload. -/
def doubleTaggedContinuous
    {ι κ α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (branch : ι → κ → α →𝒄 β) :
    ((EqualityOrder ι × EqualityOrder κ) × α) →𝒄 β :=
  (taggedContinuous fun first =>
    taggedContinuous (branch first)).comp
      (ContinuousHom.ofFun
        (fun pair => (pair.1.1, (pair.1.2, pair.2)))
        (by fun_prop))

/-- Constant bottom is continuous. -/
def bottomContinuous
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OrderBot β] :
    α →𝒄 β :=
  ContinuousHom.ofFun (fun _ => ⊥) (by fun_prop)

private theorem left_component_exists
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first)
    (index : Nat) :
    ∃ value : α, chain index = Sum.inl value := by
  cases atIndex : chain index with
  | inl value => exact ⟨value, rfl⟩
  | inr value =>
      have ordered := chain.monotone (Nat.zero_le index)
      change chain 0 ≤ chain index at ordered
      rw [atZero, atIndex] at ordered
      exact (Sum.not_inl_le_inr ordered).elim

private theorem right_component_exists
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first)
    (index : Nat) :
    ∃ value : β, chain index = Sum.inr value := by
  cases atIndex : chain index with
  | inl value =>
      have ordered := chain.monotone (Nat.zero_le index)
      change chain 0 ≤ chain index at ordered
      rw [atZero, atIndex] at ordered
      exact (Sum.not_inr_le_inl ordered).elim
  | inr value => exact ⟨value, rfl⟩

private def leftComponent
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first) :
    Chain α where
  toFun index :=
    Classical.choose
      (left_component_exists chain atZero index)
  monotone' := by
    intro lower upper ordered
    have mapped := chain.monotone ordered
    have lowerSpec :=
      Classical.choose_spec
        (left_component_exists chain atZero lower)
    have upperSpec :=
      Classical.choose_spec
        (left_component_exists chain atZero upper)
    change chain lower ≤ chain upper at mapped
    rw [lowerSpec, upperSpec] at mapped
    exact Sum.inl_le_inl_iff.1 mapped

private theorem leftComponent_spec
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first)
    (index : Nat) :
    chain index =
      Sum.inl (leftComponent chain atZero index) :=
  Classical.choose_spec
    (left_component_exists chain atZero index)

private def rightComponent
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first) :
    Chain β where
  toFun index :=
    Classical.choose
      (right_component_exists chain atZero index)
  monotone' := by
    intro lower upper ordered
    have mapped := chain.monotone ordered
    have lowerSpec :=
      Classical.choose_spec
        (right_component_exists chain atZero lower)
    have upperSpec :=
      Classical.choose_spec
        (right_component_exists chain atZero upper)
    change chain lower ≤ chain upper at mapped
    rw [lowerSpec, upperSpec] at mapped
    exact Sum.inr_le_inr_iff.1 mapped

private theorem rightComponent_spec
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first)
    (index : Nat) :
    chain index =
      Sum.inr (rightComponent chain atZero index) :=
  Classical.choose_spec
    (right_component_exists chain atZero index)

private theorem omegaSup_eq_inl_component
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : α}
    (atZero : chain 0 = Sum.inl first) :
    ωSup chain =
      Sum.inl (ωSup (leftComponent chain atZero)) := by
  apply le_antisymm
  · apply ωSup_le
    intro index
    rw [leftComponent_spec chain atZero index]
    exact Sum.inl_le_inl_iff.2
      (le_ωSup (leftComponent chain atZero) index)
  · cases atSup : ωSup chain with
    | inl upper =>
        apply Sum.inl_le_inl_iff.2
        apply ωSup_le
        intro index
        have ordered := le_ωSup chain index
        rw [leftComponent_spec chain atZero index, atSup]
          at ordered
        exact Sum.inl_le_inl_iff.1 ordered
    | inr upper =>
        have ordered := le_ωSup chain 0
        rw [atZero, atSup] at ordered
        exact (Sum.not_inl_le_inr ordered).elim

private theorem omegaSup_eq_inr_component
    {α β : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (chain : Chain (α ⊕ β))
    {first : β}
    (atZero : chain 0 = Sum.inr first) :
    ωSup chain =
      Sum.inr (ωSup (rightComponent chain atZero)) := by
  apply le_antisymm
  · apply ωSup_le
    intro index
    rw [rightComponent_spec chain atZero index]
    exact Sum.inr_le_inr_iff.2
      (le_ωSup (rightComponent chain atZero) index)
  · cases atSup : ωSup chain with
    | inl upper =>
        have ordered := le_ωSup chain 0
        rw [atZero, atSup] at ordered
        exact (Sum.not_inr_le_inl ordered).elim
    | inr upper =>
        apply Sum.inr_le_inr_iff.2
        apply ωSup_le
        intro index
        have ordered := le_ωSup chain index
        rw [rightComponent_spec chain atZero index, atSup]
          at ordered
        exact Sum.inr_le_inr_iff.1 ordered

/-- Continuous case analysis out of a separated coproduct. -/
def separatedCases
    {α β γ : Type*}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    [OmegaCompletePartialOrder γ]
    (left : α →𝒄 γ)
    (right : β →𝒄 γ) :
    (α ⊕ β) →𝒄 γ where
  toFun := Sum.elim left right
  monotone' := by
    intro lower upper ordered
    cases lower <;> cases upper
    · exact left.monotone
        (Sum.inl_le_inl_iff.1 ordered)
    · exact (Sum.not_inl_le_inr ordered).elim
    · exact (Sum.not_inr_le_inl ordered).elim
    · exact right.monotone
        (Sum.inr_le_inr_iff.1 ordered)
  map_ωSup' := by
    intro chain
    cases atZero : chain 0 with
    | inl first =>
        let component := leftComponent chain atZero
        let mappedOrder : (α ⊕ β) →o γ :=
          { toFun := Sum.elim left right
            monotone' := by
              intro lower upper ordered
              cases lower <;> cases upper
              · exact left.monotone
                  (Sum.inl_le_inl_iff.1 ordered)
              · exact (Sum.not_inl_le_inr ordered).elim
              · exact (Sum.not_inr_le_inl ordered).elim
              · exact right.monotone
                  (Sum.inr_le_inr_iff.1 ordered) }
        have mappedChain :
            chain.map mappedOrder =
              component.map left.toOrderHom := by
          apply Chain.ext
          funext index
          change
            Sum.elim left right (chain index) =
              left (component index)
          rw [leftComponent_spec chain atZero index]
          rfl
        rw [omegaSup_eq_inl_component chain atZero]
        change
          left (ωSup component) =
            ωSup (chain.map mappedOrder)
        rw [mappedChain]
        exact left.continuous component
    | inr first =>
        let component := rightComponent chain atZero
        let mappedOrder : (α ⊕ β) →o γ :=
          { toFun := Sum.elim left right
            monotone' := by
              intro lower upper ordered
              cases lower <;> cases upper
              · exact left.monotone
                  (Sum.inl_le_inl_iff.1 ordered)
              · exact (Sum.not_inl_le_inr ordered).elim
              · exact (Sum.not_inr_le_inl ordered).elim
              · exact right.monotone
                  (Sum.inr_le_inr_iff.1 ordered) }
        have mappedChain :
            chain.map mappedOrder =
              component.map right.toOrderHom := by
          apply Chain.ext
          funext index
          change
            Sum.elim left right (chain index) =
              right (component index)
          rw [rightComponent_spec chain atZero index]
          rfl
        rw [omegaSup_eq_inr_component chain atZero]
        change
          right (ωSup component) =
            ωSup (chain.map mappedOrder)
        rw [mappedChain]
        exact right.continuous component

/-! ## Last-coordinate classification -/

/-- An extended-world name is either old or the distinguished last name. -/
def oldName? (world : World) :
    Fin (world + 1) → Option (Fin world) :=
  Fin.lastCases none some

@[simp]
theorem oldName_castSucc
    (world : World) (name : Fin world) :
    oldName? world (Fin.castSucc name) = some name := by
  simp [oldName?]

@[simp]
theorem oldName_last (world : World) :
    oldName? world (Fin.last world) = none := by
  simp [oldName?]

/-! ## Continuous injections of the four target action constructors -/

abbrev TargetAction (world : World) :=
  ActionRepresentation ShiftAgent world

def injectInput (world : World) :
    (NameTag world ×
        NameAbstractionCarrier ShiftAgent world) →𝒄
      TargetAction world :=
  separatedInl

def injectFreeOutput (world : World) :
    ((NameTag world × NameTag world) ×
        ShiftAgent.obj world) →𝒄
      TargetAction world :=
  separatedInr.comp separatedInl

def injectBoundOutput (world : World) :
    (NameTag world × ShiftAgent.obj (world + 1)) →𝒄
      TargetAction world :=
  separatedInr.comp (separatedInr.comp separatedInl)

def injectTau (world : World) :
    ShiftAgent.obj world →𝒄 TargetAction world :=
  separatedInr.comp (separatedInr.comp separatedInr)

/-! ## The five Table-4 branch maps -/

/-- Retain an input on an old channel and exchange the two fresh binders. -/
def inputOld
    (world : World) (channel : Fin world) :
    ((Fin (world + 1) → Agent.obj (world + 1)) ×
        Agent.obj ((world + 1) + 1)) →𝒄
      OmegaScottPower (TargetAction world) :=
  principal.comp
    ((injectInput world).comp
      (ContinuousHom.ofFun
        (fun payload =>
          (nameTag channel,
            (fun name => payload.1 (Fin.castSucc name),
              Agent.map (lastTwoSwap world) payload.2)))
        (by fun_prop)))

/--
Input on the distinguished restricted channel is cancelled; input on an old
channel uses `inputOld`.
-/
def inputCase (world : World) :
    (NameTag (world + 1) ×
      NameAbstractionCarrier Agent (world + 1)) →𝒄
        OmegaScottPower (TargetAction world) :=
  taggedContinuous fun channel =>
    match oldName? world (tagName channel) with
    | some old => inputOld world old
    | none => bottomContinuous

/-- Retain an ordinary free output on two old names. -/
def freeOutputOld
    (world : World) (channel value : Fin world) :
    Agent.obj (world + 1) →𝒄
      OmegaScottPower (TargetAction world) :=
  principal.comp
    ((injectFreeOutput world).comp
      (ContinuousHom.ofFun
        (fun continuation =>
          ((nameTag channel, nameTag value), continuation))
        (by fun_prop)))

/--
Extruding the restricted value converts free output to bound output.  The
unused new last coordinate is allocated so that the recursive restriction at
the continuation world removes it again.
-/
def freeOutputFresh
    (world : World) (channel : Fin world) :
    Agent.obj (world + 1) →𝒄
      OmegaScottPower (TargetAction world) :=
  principal.comp
    ((injectBoundOutput world).comp
      (ContinuousHom.ofFun
        (fun continuation =>
          (nameTag channel,
            Agent.map (up (world + 1)) continuation))
        (by fun_prop)))

/-- Complete free-output case analysis. -/
def freeOutputCase (world : World) :
    ((NameTag (world + 1) × NameTag (world + 1)) ×
      Agent.obj (world + 1)) →𝒄
        OmegaScottPower (TargetAction world) :=
  doubleTaggedContinuous fun channel value =>
    match oldName? world (tagName channel),
        oldName? world (tagName value) with
    | none, _ => bottomContinuous
    | some oldChannel, none =>
        freeOutputFresh world oldChannel
    | some oldChannel, some oldValue =>
        freeOutputOld world oldChannel oldValue

/--
Retain bound output on an old channel.  The existing outer restricted name
and the newly bound output name exchange positions.
-/
def boundOutputOld
    (world : World) (channel : Fin world) :
    Agent.obj ((world + 1) + 1) →𝒄
      OmegaScottPower (TargetAction world) :=
  principal.comp
    ((injectBoundOutput world).comp
      (ContinuousHom.ofFun
        (fun continuation =>
          (nameTag channel,
            Agent.map (lastTwoSwap world) continuation))
        (by fun_prop)))

/-- Bound output on the restricted channel is cancelled. -/
def boundOutputCase (world : World) :
    (NameTag (world + 1) ×
      Agent.obj ((world + 1) + 1)) →𝒄
        OmegaScottPower (TargetAction world) :=
  taggedContinuous fun channel =>
    match oldName? world (tagName channel) with
    | some old => boundOutputOld world old
    | none => bottomContinuous

/-- Tau is retained with its continuation in the shifted carrier. -/
def tauCase (world : World) :
    Agent.obj (world + 1) →𝒄
      OmegaScottPower (TargetAction world) :=
  principal.comp
    ((injectTau world).comp
      (ContinuousHom.ofFun id (by fun_prop)))

/-! ## Branch equations and the complete action Kleisli map -/

@[simp]
theorem inputCase_old
    (world : World)
    (channel : Fin world)
    (known : Fin (world + 1) → Agent.obj (world + 1))
    (fresh : Agent.obj ((world + 1) + 1)) :
    inputCase world
        (nameTag (Fin.castSucc channel), (known, fresh)) =
      inputOld world channel (known, fresh) := by
  simp [inputCase, taggedContinuous]

@[simp]
theorem inputCase_restricted
    (world : World)
    (known : Fin (world + 1) → Agent.obj (world + 1))
    (fresh : Agent.obj ((world + 1) + 1)) :
    inputCase world
        (nameTag (Fin.last world), (known, fresh)) =
      (⊥ : OmegaScottPower (TargetAction world)) := by
  simp [inputCase, taggedContinuous, bottomContinuous]

@[simp]
theorem freeOutputCase_old
    (world : World)
    (channel value : Fin world)
    (continuation : Agent.obj (world + 1)) :
    freeOutputCase world
        ((nameTag (Fin.castSucc channel),
          nameTag (Fin.castSucc value)), continuation) =
      freeOutputOld world channel value continuation := by
  simp [freeOutputCase, doubleTaggedContinuous,
    taggedContinuous]

@[simp]
theorem freeOutputCase_extrude
    (world : World)
    (channel : Fin world)
    (continuation : Agent.obj (world + 1)) :
    freeOutputCase world
        ((nameTag (Fin.castSucc channel),
          nameTag (Fin.last world)), continuation) =
      freeOutputFresh world channel continuation := by
  simp [freeOutputCase, doubleTaggedContinuous,
    taggedContinuous]

@[simp]
theorem freeOutputCase_restricted_channel
    (world : World)
    (value : Fin (world + 1))
    (continuation : Agent.obj (world + 1)) :
    freeOutputCase world
        ((nameTag (Fin.last world), nameTag value),
          continuation) =
      (⊥ : OmegaScottPower (TargetAction world)) := by
  cases value using Fin.lastCases <;>
    simp [freeOutputCase, doubleTaggedContinuous,
      taggedContinuous, bottomContinuous]

@[simp]
theorem boundOutputCase_old
    (world : World)
    (channel : Fin world)
    (continuation : Agent.obj ((world + 1) + 1)) :
    boundOutputCase world
        (nameTag (Fin.castSucc channel), continuation) =
      boundOutputOld world channel continuation := by
  simp [boundOutputCase, taggedContinuous]

@[simp]
theorem boundOutputCase_restricted
    (world : World)
    (continuation : Agent.obj ((world + 1) + 1)) :
    boundOutputCase world
        (nameTag (Fin.last world), continuation) =
      (⊥ : OmegaScottPower (TargetAction world)) := by
  simp [boundOutputCase, taggedContinuous, bottomContinuous]

@[simp]
theorem tauCase_apply
    (world : World)
    (continuation : Agent.obj (world + 1)) :
    tauCase world continuation =
      principalRaw
        (Sum.inr (Sum.inr (Sum.inr continuation)) :
          TargetAction world) :=
  rfl

/--
The complete continuous Table-4 action map.  It is partial through the lower
powerdomain: cancelled source actions map to bottom and retained actions map
to principals.
-/
def actionRestrictionStep (world : World) :
    ActionRepresentation Agent (world + 1) →𝒄
      OmegaScottPower (TargetAction world) :=
  separatedCases (inputCase world)
    (separatedCases (freeOutputCase world)
      (separatedCases (boundOutputCase world)
        (tauCase world)))

@[simp]
theorem actionRestrictionStep_input
    (world : World)
    (value :
      NameTag (world + 1) ×
        NameAbstractionCarrier Agent (world + 1)) :
    actionRestrictionStep world (Sum.inl value) =
      inputCase world value :=
  rfl

@[simp]
theorem actionRestrictionStep_freeOutput
    (world : World)
    (value :
      (NameTag (world + 1) × NameTag (world + 1)) ×
        Agent.obj (world + 1)) :
    actionRestrictionStep world
        (Sum.inr (Sum.inl value)) =
      freeOutputCase world value :=
  rfl

@[simp]
theorem actionRestrictionStep_boundOutput
    (world : World)
    (value :
      NameTag (world + 1) ×
        Agent.obj ((world + 1) + 1)) :
    actionRestrictionStep world
        (Sum.inr (Sum.inr (Sum.inl value))) =
      boundOutputCase world value :=
  rfl

@[simp]
theorem actionRestrictionStep_tau
    (world : World)
    (continuation : Agent.obj (world + 1)) :
    actionRestrictionStep world
        (Sum.inr (Sum.inr (Sum.inr continuation))) =
      tauCase world continuation :=
  rfl

/--
Kleisli extension of the Table-4 action map to nondeterministic action
families.
-/
def actionRestrictionKleisli (world : World) :
    OmegaScottPower
        (ActionRepresentation Agent (world + 1)) →𝒄
      OmegaScottPower (TargetAction world) :=
  flatten.comp (map (actionRestrictionStep world))

@[simp]
theorem actionRestrictionKleisli_principal
    (world : World)
    (action : ActionRepresentation Agent (world + 1)) :
    actionRestrictionKleisli world (principalRaw action) =
      actionRestrictionStep world action := by
  change
    flattenRaw
        (mapRaw (actionRestrictionStep world)
          (principalRaw action)) =
      actionRestrictionStep world action
  rw [mapRaw_principal, flattenRaw_principal]

/-! ## Equivariance of the action fold -/

@[simp]
private theorem mapNameTag_successor_castSucc
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin source) :
    mapNameTag (successorMap injection)
        (nameTag (Fin.castSucc name)) =
      nameTag
        (Fin.castSucc (homToFun injection name)) := by
  apply congrArg nameTag
  change
    Injection.succ (asInjection injection)
        (Fin.castSucc name) =
      Fin.castSucc (homToFun injection name)
  exact Injection.succ_castSucc
    (asInjection injection) name

@[simp]
private theorem mapNameTag_successor_last
    {source target : World}
    (injection : source ⟶ target) :
    mapNameTag (successorMap injection)
        (nameTag (Fin.last source)) =
      nameTag (Fin.last target) := by
  apply congrArg nameTag
  change
    Injection.succ (asInjection injection)
        (Fin.last source) =
      Fin.last target
  exact Injection.succ_last (asInjection injection)

private theorem successor_outside_castSucc
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = name) :
    ¬ ∃ old : Fin (source + 1),
      homToFun (successorMap injection) old =
        Fin.castSucc name := by
  rintro ⟨old, equality⟩
  cases old using Fin.lastCases with
  | cast old =>
      apply outside
      refine ⟨old, ?_⟩
      apply Fin.castSucc_injective target
      change
        Injection.succ (asInjection injection)
            (Fin.castSucc old) =
          Fin.castSucc name at equality
      rw [Injection.succ_castSucc] at equality
      exact equality
  | last =>
      have impossible :
          Fin.last target = Fin.castSucc name := by
        change
          Injection.succ (asInjection injection)
              (Fin.last source) =
            Fin.castSucc name at equality
        rw [Injection.succ_last] at equality
        exact equality
      exact (Fin.castSucc_ne_last name impossible.symm).elim

private theorem input_extension_old
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = name)
    (old : Fin (source + 1)) :
    homToFun
        (lastTwoSwap source ≫
          successorMap
            (extendByName injection name outside))
        (Fin.castSucc old) =
      homToFun (successorMap injection) old := by
  cases old using Fin.lastCases with
  | cast old =>
      change
        homToFun
            (successorMap
              (extendByName injection name outside))
            (homToFun (lastTwoSwap source)
              (Fin.castSucc (Fin.castSucc old))) =
          homToFun (successorMap injection)
            (Fin.castSucc old)
      rw [lastTwoSwap_old]
      change
        Injection.succ
            (asInjection
              (extendByName injection name outside))
            (Fin.castSucc (Fin.castSucc old)) =
          Injection.succ (asInjection injection)
            (Fin.castSucc old)
      rw [Injection.succ_castSucc,
        Injection.succ_castSucc]
      exact congrArg Fin.castSucc
        (extendByName_castSucc injection name outside old)
  | last =>
      change
        homToFun
            (successorMap
              (extendByName injection name outside))
            (homToFun (lastTwoSwap source)
              (penultimateFresh source)) =
          homToFun (successorMap injection)
            (Fin.last source)
      rw [lastTwoSwap_penultimate]
      change
        Injection.succ
            (asInjection
              (extendByName injection name outside))
            (Fin.last (source + 1)) =
          Injection.succ (asInjection injection)
            (Fin.last source)
      rw [Injection.succ_last, Injection.succ_last]

private theorem input_extension_fresh
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = name) :
    homToFun
        (lastTwoSwap source ≫
          successorMap
            (extendByName injection name outside))
        (Fin.last (source + 1)) =
      Fin.castSucc name := by
  change
    homToFun
        (successorMap
          (extendByName injection name outside))
        (homToFun (lastTwoSwap source)
          (ultimateFresh source)) =
      Fin.castSucc name
  rw [lastTwoSwap_ultimate]
  change
    Injection.succ
        (asInjection
          (extendByName injection name outside))
        (Fin.castSucc (Fin.last source)) =
      Fin.castSucc name
  rw [Injection.succ_castSucc]
  exact congrArg Fin.castSucc
    (extendByName_last injection name outside)

/--
The difficult input branch is equivariant: extending the received-name
continuation and then hiding agrees with hiding first and extending in the
shifted model.  The proof explicitly uses the last-two-name alpha swap.
-/
theorem inputKnown_restriction_natural
    {source target : World}
    (injection : source ⟶ target)
    (known : Fin (source + 1) → Agent.obj (source + 1))
    (fresh : Agent.obj ((source + 1) + 1)) :
    (fun name =>
      inputKnownTransport Agent
        (successorMap injection) known fresh
        (Fin.castSucc name)) =
      inputKnownTransport ShiftAgent injection
        (fun old => known (Fin.castSucc old))
        (Agent.map (lastTwoSwap source) fresh) := by
  funext name
  by_cases inImage :
      ∃ old : Fin source,
        homToFun injection old = name
  · obtain ⟨old, maps⟩ := inImage
    subst name
    have successorMaps :
        homToFun (successorMap injection)
            (Fin.castSucc old) =
          Fin.castSucc (homToFun injection old) := by
      change
        Injection.succ (asInjection injection)
            (Fin.castSucc old) =
          Fin.castSucc (homToFun injection old)
      exact Injection.succ_castSucc
        (asInjection injection) old
    rw [← successorMaps]
    rw [inputKnownTransport_old Agent
      (successorMap injection) known fresh
      (Fin.castSucc old)]
    rw [inputKnownTransport_old ShiftAgent injection
      (fun old => known (Fin.castSucc old))
      (Agent.map (lastTwoSwap source) fresh) old]
    rfl
  · rw [inputKnownTransport_fresh Agent
      (successorMap injection) known fresh
      (Fin.castSucc name)
      (lastTwoSwap source ≫
        successorMap (extendByName injection name inImage))
      (input_extension_old injection name inImage)
      (input_extension_fresh injection name inImage)]
    rw [inputKnownTransport_fresh ShiftAgent injection
      (fun old => known (Fin.castSucc old))
      (Agent.map (lastTwoSwap source) fresh)
      name
      (extendByName injection name inImage)
      (extendByName_castSucc injection name inImage)
      (extendByName_last injection name inImage)]
    rw [Agent.map_comp]
    change
      (Agent.map (lastTwoSwap source) ≫
          Agent.map
            (successorMap
              (extendByName injection name inImage)))
          fresh =
        Agent.map
          (successorMap
            (extendByName injection name inImage))
          (Agent.map (lastTwoSwap source) fresh)
    rfl

@[simp]
private theorem actionWorldMap_injectInput
    {source target : World}
    (injection : source ⟶ target)
    (channel : NameTag source)
    (known : Fin source → ShiftAgent.obj source)
    (fresh : ShiftAgent.obj (source + 1)) :
    actionWorldMap ShiftAgent injection
        ((injectInput source) (channel, (known, fresh))) =
      (injectInput target)
        (mapNameTag injection channel,
          (inputKnownTransport ShiftAgent injection known fresh,
           ShiftAgent.map (successorMap injection) fresh)) := by
  change
    actionWorldMap ShiftAgent injection
        (Sum.inl (channel, (known, fresh))) =
      Sum.inl
        (mapNameTag injection channel,
          (inputKnownTransport ShiftAgent injection known fresh,
           ShiftAgent.map (successorMap injection) fresh))
  exact actionWorldMap_input
    ShiftAgent injection channel known fresh

@[simp]
private theorem actionWorldMap_injectFreeOutput
    {source target : World}
    (injection : source ⟶ target)
    (channel value : NameTag source)
    (continuation : ShiftAgent.obj source) :
    actionWorldMap ShiftAgent injection
        ((injectFreeOutput source)
          ((channel, value), continuation)) =
      (injectFreeOutput target)
        ((mapNameTag injection channel,
          mapNameTag injection value),
         ShiftAgent.map injection continuation) := by
  change
    actionWorldMap ShiftAgent injection
        (Sum.inr
          (Sum.inl ((channel, value), continuation))) =
      Sum.inr
        (Sum.inl
          ((mapNameTag injection channel,
            mapNameTag injection value),
           ShiftAgent.map injection continuation))
  exact actionWorldMap_freeOutput
    ShiftAgent injection channel value continuation

@[simp]
private theorem actionWorldMap_injectBoundOutput
    {source target : World}
    (injection : source ⟶ target)
    (channel : NameTag source)
    (continuation : ShiftAgent.obj (source + 1)) :
    actionWorldMap ShiftAgent injection
        ((injectBoundOutput source)
          (channel, continuation)) =
      (injectBoundOutput target)
        (mapNameTag injection channel,
         ShiftAgent.map (successorMap injection)
           continuation) := by
  change
    actionWorldMap ShiftAgent injection
        (Sum.inr
          (Sum.inr
            (Sum.inl (channel, continuation)))) =
      Sum.inr
        (Sum.inr
          (Sum.inl
            (mapNameTag injection channel,
             ShiftAgent.map (successorMap injection)
               continuation)))
  exact actionWorldMap_boundOutput
    ShiftAgent injection channel continuation

private theorem agent_lastTwoSwap_natural_apply
    {source target : World}
    (injection : source ⟶ target)
    (value : Agent.obj ((source + 1) + 1)) :
    Agent.map (lastTwoSwap target)
        (Agent.map
          (successorMap (successorMap injection))
          value) =
      ShiftAgent.map (successorMap injection)
        (Agent.map (lastTwoSwap source) value) := by
  have mapped :=
    congrArg Agent.map (lastTwoSwap_natural injection)
  rw [Agent.map_comp, Agent.map_comp] at mapped
  exact ContinuousHom.congr_fun mapped value

private theorem agent_allocation_natural_apply
    {source target : World}
    (injection : source ⟶ target)
    (value : Agent.obj (source + 1)) :
    Agent.map (up (target + 1))
        (Agent.map (successorMap injection) value) =
      ShiftAgent.map (successorMap injection)
        (Agent.map (up (source + 1)) value) := by
  have mapped :=
    congrArg Agent.map
      (worldUp.naturality (successorMap injection))
  rw [Agent.map_comp, Agent.map_comp] at mapped
  exact ContinuousHom.congr_fun mapped value

/--
Every one-action Table-4 branch commutes with an arbitrary finite-world
injection.  This is a theorem about the fixed concrete action map, not a
field supplied by a package.
-/
theorem actionRestrictionStep_natural
    {source target : World}
    (injection : source ⟶ target)
    (action : ActionRepresentation Agent (source + 1)) :
    actionRestrictionStep target
        (actionWorldMap Agent (successorMap injection) action) =
      mapRaw (actionWorldMap ShiftAgent injection)
        (actionRestrictionStep source action) := by
  rcases action with input | rest
  · rcases input with ⟨channel, known, fresh⟩
    cases nameEq : tagName channel using Fin.lastCases with
    | cast old =>
        have channelEq :
            channel = nameTag (Fin.castSucc old) := by
          rw [← nameTag_tagName channel, nameEq]
        subst channel
        rw [actionWorldMap_input]
        rw [actionRestrictionStep_input,
          actionRestrictionStep_input]
        rw [mapNameTag_successor_castSucc]
        change
          inputCase target
              (nameTag
                  (Fin.castSucc
                    (homToFun injection old)),
                (inputKnownTransport Agent
                  (successorMap injection) known fresh,
                 Agent.map
                   (successorMap (successorMap injection))
                   fresh)) =
            mapRaw (actionWorldMap ShiftAgent injection)
              (inputCase source
                (nameTag (Fin.castSucc old), (known, fresh)))
        rw [inputCase_old, inputCase_old]
        unfold inputOld
        change
          principalRaw
              ((injectInput target)
                (nameTag (homToFun injection old),
                  (fun name =>
                    inputKnownTransport Agent
                      (successorMap injection) known fresh
                      (Fin.castSucc name),
                   Agent.map (lastTwoSwap target)
                     (Agent.map
                       (successorMap
                         (successorMap injection))
                       fresh)))) =
            mapRaw (actionWorldMap ShiftAgent injection)
              (principalRaw
                ((injectInput source)
                  (nameTag old,
                    (fun name => known (Fin.castSucc name),
                     Agent.map (lastTwoSwap source) fresh))))
        rw [mapRaw_principal]
        rw [actionWorldMap_injectInput]
        apply congrArg principalRaw
        apply congrArg Sum.inl
        apply Prod.ext
        · rfl
        · apply Prod.ext
          · exact inputKnown_restriction_natural
              injection known fresh
          · exact agent_lastTwoSwap_natural_apply
              injection fresh
    | last =>
        have channelEq :
            channel = nameTag (Fin.last source) := by
          rw [← nameTag_tagName channel, nameEq]
        subst channel
        rw [actionWorldMap_input]
        rw [actionRestrictionStep_input,
          actionRestrictionStep_input]
        rw [mapNameTag_successor_last]
        change
          inputCase target
              (nameTag (Fin.last target),
                (inputKnownTransport Agent
                  (successorMap injection) known fresh,
                 Agent.map
                   (successorMap (successorMap injection))
                   fresh)) =
            mapRaw (actionWorldMap ShiftAgent injection)
              (inputCase source
                (nameTag (Fin.last source), (known, fresh)))
        rw [inputCase_restricted, inputCase_restricted,
          mapRaw_bot]
  · rcases rest with free | rest
    · rcases free with ⟨⟨channel, value⟩, continuation⟩
      cases channelEq : tagName channel using Fin.lastCases with
      | last =>
          have channelTagEq :
              channel = nameTag (Fin.last source) := by
            rw [← nameTag_tagName channel, channelEq]
          subst channel
          rw [actionWorldMap_freeOutput]
          rw [actionRestrictionStep_freeOutput,
            actionRestrictionStep_freeOutput]
          rw [mapNameTag_successor_last]
          change
            freeOutputCase target
                ((nameTag (Fin.last target),
                  mapNameTag (successorMap injection) value),
                 Agent.map (successorMap injection)
                   continuation) =
              mapRaw (actionWorldMap ShiftAgent injection)
                (freeOutputCase source
                  ((nameTag (Fin.last source), value),
                   continuation))
          rw [← nameTag_tagName
                (mapNameTag (successorMap injection) value),
            freeOutputCase_restricted_channel,
            ← nameTag_tagName value,
            freeOutputCase_restricted_channel,
            mapRaw_bot]
      | cast oldChannel =>
          have channelTagEq :
              channel =
                nameTag (Fin.castSucc oldChannel) := by
            rw [← nameTag_tagName channel, channelEq]
          subst channel
          cases valueEq : tagName value using Fin.lastCases with
          | last =>
              have valueTagEq :
                  value = nameTag (Fin.last source) := by
                rw [← nameTag_tagName value, valueEq]
              subst value
              rw [actionWorldMap_freeOutput]
              rw [actionRestrictionStep_freeOutput,
                actionRestrictionStep_freeOutput]
              rw [mapNameTag_successor_castSucc,
                mapNameTag_successor_last]
              change
                freeOutputCase target
                    ((nameTag
                        (Fin.castSucc
                          (homToFun injection oldChannel)),
                      nameTag (Fin.last target)),
                     Agent.map (successorMap injection)
                       continuation) =
                  mapRaw (actionWorldMap ShiftAgent injection)
                    (freeOutputCase source
                      ((nameTag (Fin.castSucc oldChannel),
                        nameTag (Fin.last source)),
                       continuation))
              rw [freeOutputCase_extrude,
                freeOutputCase_extrude]
              unfold freeOutputFresh
              change
                principalRaw
                    ((injectBoundOutput target)
                      (nameTag
                          (homToFun injection oldChannel),
                        Agent.map (up (target + 1))
                          (Agent.map
                            (successorMap injection)
                            continuation))) =
                  mapRaw
                    (actionWorldMap ShiftAgent injection)
                    (principalRaw
                      ((injectBoundOutput source)
                        (nameTag oldChannel,
                          Agent.map (up (source + 1))
                            continuation)))
              rw [mapRaw_principal]
              rw [actionWorldMap_injectBoundOutput]
              apply congrArg principalRaw
              apply congrArg Sum.inr
              apply congrArg Sum.inr
              apply congrArg Sum.inl
              apply Prod.ext
              · rfl
              · exact agent_allocation_natural_apply
                  injection continuation
          | cast oldValue =>
              have valueTagEq :
                  value =
                    nameTag (Fin.castSucc oldValue) := by
                rw [← nameTag_tagName value, valueEq]
              subst value
              rw [actionWorldMap_freeOutput]
              rw [actionRestrictionStep_freeOutput,
                actionRestrictionStep_freeOutput]
              rw [mapNameTag_successor_castSucc,
                mapNameTag_successor_castSucc]
              change
                freeOutputCase target
                    ((nameTag
                        (Fin.castSucc
                          (homToFun injection oldChannel)),
                      nameTag
                        (Fin.castSucc
                          (homToFun injection oldValue))),
                     Agent.map (successorMap injection)
                       continuation) =
                  mapRaw (actionWorldMap ShiftAgent injection)
                    (freeOutputCase source
                      ((nameTag (Fin.castSucc oldChannel),
                        nameTag (Fin.castSucc oldValue)),
                       continuation))
              rw [freeOutputCase_old, freeOutputCase_old]
              unfold freeOutputOld
              change
                principalRaw
                    ((injectFreeOutput target)
                      ((nameTag
                          (homToFun injection oldChannel),
                        nameTag
                          (homToFun injection oldValue)),
                       Agent.map (successorMap injection)
                         continuation)) =
                  mapRaw
                    (actionWorldMap ShiftAgent injection)
                    (principalRaw
                      ((injectFreeOutput source)
                        ((nameTag oldChannel,
                          nameTag oldValue),
                         continuation)))
              rw [mapRaw_principal]
              rw [actionWorldMap_injectFreeOutput]
              rfl
    · rcases rest with bound | continuation
      · rcases bound with ⟨channel, next⟩
        cases channelEq : tagName channel using Fin.lastCases with
        | last =>
            have channelTagEq :
                channel = nameTag (Fin.last source) := by
              rw [← nameTag_tagName channel, channelEq]
            subst channel
            rw [actionWorldMap_boundOutput]
            rw [actionRestrictionStep_boundOutput,
              actionRestrictionStep_boundOutput]
            rw [mapNameTag_successor_last]
            change
              boundOutputCase target
                  (nameTag (Fin.last target),
                   Agent.map
                     (successorMap (successorMap injection))
                     next) =
                mapRaw (actionWorldMap ShiftAgent injection)
                  (boundOutputCase source
                    (nameTag (Fin.last source), next))
            rw [boundOutputCase_restricted,
              boundOutputCase_restricted,
              mapRaw_bot]
        | cast old =>
            have channelTagEq :
                channel =
                  nameTag (Fin.castSucc old) := by
              rw [← nameTag_tagName channel, channelEq]
            subst channel
            rw [actionWorldMap_boundOutput]
            rw [actionRestrictionStep_boundOutput,
              actionRestrictionStep_boundOutput]
            rw [mapNameTag_successor_castSucc]
            change
              boundOutputCase target
                  (nameTag
                    (Fin.castSucc (homToFun injection old)),
                   Agent.map
                     (successorMap (successorMap injection))
                     next) =
                mapRaw (actionWorldMap ShiftAgent injection)
                  (boundOutputCase source
                    (nameTag (Fin.castSucc old), next))
            rw [boundOutputCase_old, boundOutputCase_old]
            unfold boundOutputOld
            change
              principalRaw
                  ((injectBoundOutput target)
                    (nameTag (homToFun injection old),
                      Agent.map (lastTwoSwap target)
                        (Agent.map
                          (successorMap
                            (successorMap injection))
                          next))) =
                mapRaw
                  (actionWorldMap ShiftAgent injection)
                  (principalRaw
                    ((injectBoundOutput source)
                      (nameTag old,
                        Agent.map (lastTwoSwap source)
                          next)))
            rw [mapRaw_principal]
            rw [actionWorldMap_injectBoundOutput]
            apply congrArg principalRaw
            apply congrArg Sum.inr
            apply congrArg Sum.inr
            apply congrArg Sum.inl
            apply Prod.ext
            · rfl
            · exact agent_lastTwoSwap_natural_apply
                injection next
      · rw [actionWorldMap_tau]
        rw [actionRestrictionStep_tau,
          actionRestrictionStep_tau]
        rw [tauCase_apply, tauCase_apply,
          mapRaw_principal, actionWorldMap_tau]
        apply congrArg principalRaw
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        rfl

/-! ## Natural Kleisli fold and the recursive restriction -/

/--
The lower-power Kleisli extension of the action translation is world
natural.  The proof uses the concrete multiplication naturality of
`OmegaScottPower`; it is not an assumed monad-coherence field.
-/
theorem actionRestrictionKleisli_natural
    {source target : World}
    (injection : source ⟶ target)
    (values :
      OmegaScottPower
        (ActionRepresentation Agent (source + 1))) :
    actionRestrictionKleisli target
        (mapRaw
          (actionWorldMap Agent
            (successorMap injection))
          values) =
      mapRaw (actionWorldMap ShiftAgent injection)
        (actionRestrictionKleisli source values) := by
  change
    flattenRaw
        (mapRaw (actionRestrictionStep target)
          (mapRaw
            (actionWorldMap Agent
              (successorMap injection))
            values)) =
      mapRaw (actionWorldMap ShiftAgent injection)
        (flattenRaw
          (mapRaw (actionRestrictionStep source)
            values))
  rw [mapRaw_comp]
  have stepHom :
      (actionRestrictionStep target).comp
          (actionWorldMap Agent
            (successorMap injection)) =
        (map (actionWorldMap ShiftAgent injection)).comp
          (actionRestrictionStep source) := by
    apply ContinuousHom.ext
    intro action
    exact actionRestrictionStep_natural
      injection action
  rw [stepHom, ← mapRaw_comp]
  exact flattenRaw_mapRaw_natural
    (actionWorldMap ShiftAgent injection)
    (mapRaw (actionRestrictionStep source) values)

/--
The Table-4 Kleisli action fold as an actual continuous natural
transformation.
-/
def actionRestrictionNatural :
    shift.obj (ActualAgentFunctor.obj Agent) ⟶
      ActualAgentFunctor.obj ShiftAgent where
  app world := actionRestrictionKleisli world
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro values
    exact actionRestrictionKleisli_natural
      injection values

/--
Coalgebra on the one-name-shifted recursive carrier.  It first unfolds the
concrete agent and then executes the actual Table-4 action translation.
-/
def restrictionCoalgebra :
    Coalgebra ActualAgentFunctor where
  V := ShiftAgent
  str := shift.map agentUnfold ≫ actionRestrictionNatural

/--
The recursive restriction coalgebra morphism into the concrete terminal
coalgebra.  Terminality computes the recursion rather than accepting a
proof-carrying hiding operation.
-/
def restrictionCoalgebraToAgent :
    restrictionCoalgebra ⟶
      concreteActualAlgebraicCompactnessWitness.fixed.coalgebra :=
  concreteActualAlgebraicCompactnessWitness.terminalCoalgebra.from
    restrictionCoalgebra

/-- The actual continuous-natural FMS restriction `δ A ⟶ A`. -/
def agentRestriction : ShiftAgent ⟶ Agent :=
  restrictionCoalgebraToAgent.f

/-- Restriction at one finite world, exposed as an actual continuous map. -/
def agentRestrictionAt (world : World) :
    Agent.obj (world + 1) →𝒄 Agent.obj world :=
  agentRestriction.app world

/-- Restriction commutes with every finite-world injection. -/
theorem agentRestriction_world_natural
    {source target : World}
    (injection : source ⟶ target) :
    ShiftAgent.map injection ≫
        agentRestrictionAt target =
      agentRestrictionAt source ≫
        Agent.map injection :=
  agentRestriction.naturality injection

/--
The defining recursive restriction equation.  Unfolding a restricted agent
is the Table-4 action fold followed by recursive restriction of every
continuation.
-/
theorem agentRestriction_unroll :
    restrictionCoalgebra.str ≫
        ActualAgentFunctor.map agentRestriction =
      agentRestriction ≫ agentUnfold :=
  restrictionCoalgebraToAgent.h

/--
The recursive restriction is the unique continuous-natural solution of its
Table-4 coalgebra equation.
-/
theorem agentRestriction_unique
    (candidate : ShiftAgent ⟶ Agent)
    (unroll :
      restrictionCoalgebra.str ≫
          ActualAgentFunctor.map candidate =
        candidate ≫ agentUnfold) :
    candidate = agentRestriction := by
  let candidateHom :
      restrictionCoalgebra ⟶
        concreteActualAlgebraicCompactnessWitness.fixed.coalgebra :=
    { f := candidate
      h := unroll }
  have unique :=
    concreteActualAlgebraicCompactnessWitness.terminalCoalgebra.hom_ext
      candidateHom restrictionCoalgebraToAgent
  exact congrArg Coalgebra.Hom.f unique

end Cantilune.Pi.FMSCpoAgentRestriction
