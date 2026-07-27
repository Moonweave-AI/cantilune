import Cantilune.Pi.FMSCpoNondeterministicGeneratedSubalgebra
import Mathlib.Data.W.Cardinal

/-!
# Cardinality of an omega-generated nondeterministic subalgebra

This file supplies a well-founded syntax whose nodes have arity zero, two,
or countable.  Every point of the generated `NDωCPO` subalgebra is
represented by such a tree:

* generator, divergence, and deadlock are nullary nodes;
* choice is binary; and
* an omega node denotes the supremum when its evaluated children form a
  chain, and divergence otherwise.

The last fallback makes evaluation total while retaining representatives
for every genuine omega-chain closure step.

Mathlib's cardinal theorem for W-types and the explicit fixed cardinal
`countableClosureBound` then prove

```text
#(Generated.Carrier X A f) ≤ countableClosureBound X.
```

This closes the cardinality half of the generated-subalgebra argument.  The
remaining global `SolutionSetCondition` step is categorical small
representation: encode/reindex every bounded generated algebra and its
generator into one `Type 0` family, then transport the strict factorization.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoNondeterministicGeneratedCardinality

open CategoryTheory
open OmegaCompletePartialOrder
open Cardinal
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicCardinalClosure
open Cantilune.Pi.FMSCpoNondeterministicGeneratedSubalgebra

namespace GeneratedSyntax

open scoped Classical

/-- The four non-generator operation symbols. -/
inductive Tag
  | divergence
  | deadlock
  | choice
  | omega
deriving DecidableEq, Fintype

/-- A generator-labelled node or one of the four fixed operation nodes. -/
abbrev Operation (α : Type) :=
  α ⊕ Tag

/-- Node arities: nullary, binary, or countable. -/
abbrev arity {α : Type} : Operation α → Type
  | .inl _ => PEmpty
  | .inr .divergence => PEmpty
  | .inr .deadlock => PEmpty
  | .inr .choice => Bool
  | .inr .omega => Nat

/-- Well-founded countably branching syntax. -/
abbrev Syntax (α : Type) :=
  WType (arity (α := α))

def generatorNode {α : Type} (value : α) : Syntax α :=
  WType.mk (.inl value) PEmpty.elim

def divergenceNode {α : Type} : Syntax α :=
  WType.mk (.inr .divergence) PEmpty.elim

def deadlockNode {α : Type} : Syntax α :=
  WType.mk (.inr .deadlock) PEmpty.elim

def choiceNode {α : Type}
    (left right : Syntax α) :
    Syntax α :=
  WType.mk (.inr .choice)
    (fun branch => Bool.rec left right branch)

def omegaNode {α : Type}
    (children : Nat → Syntax α) :
    Syntax α :=
  WType.mk (.inr .omega) children

/-! ## Cardinal bound for the syntax -/

theorem operation_cardinal_le
    (α : Type) :
    #(Operation α) ≤ countableClosureBound α := by
  change #(α ⊕ Tag) ≤ countableClosureBound α
  rw [Cardinal.mk_sum, Cardinal.lift_id, Cardinal.lift_id]
  apply Cardinal.add_le_of_le
    (aleph0_le_countableClosureBound α)
  · exact source_le_countableClosureBound α
  · exact
      (Cardinal.mk_lt_aleph0_iff.mpr
        (inferInstance : Finite Tag)).le.trans
        (aleph0_le_countableClosureBound α)

theorem arity_power_le
    (α : Type)
    (operation : Operation α) :
    countableClosureBound α ^ #(arity operation) ≤
      countableClosureBound α := by
  rcases operation with value | tag
  ·
    have empty_lt :
        (#PEmpty : Cardinal) < ℵ₀ := by
      simpa using Cardinal.aleph0_pos
    simpa only [arity] using
      Cardinal.pow_le
        (aleph0_le_countableClosureBound α)
        empty_lt
  ·
    cases tag
    ·
      have empty_lt :
          (#PEmpty : Cardinal) < ℵ₀ := by
        simpa using Cardinal.aleph0_pos
      simpa only [arity] using
        Cardinal.pow_le
          (aleph0_le_countableClosureBound α)
          empty_lt
    ·
      have empty_lt :
          (#PEmpty : Cardinal) < ℵ₀ := by
        simpa using Cardinal.aleph0_pos
      simpa only [arity] using
        Cardinal.pow_le
          (aleph0_le_countableClosureBound α)
          empty_lt
    ·
      have bool_lt :
          (#Bool : Cardinal) < ℵ₀ := by
        simp
      simpa only [arity] using
        Cardinal.pow_le
          (aleph0_le_countableClosureBound α)
          bool_lt
    ·
      simpa only [arity, Cardinal.mk_nat] using
        (countableClosureBound_power_aleph0 α).le

theorem syntax_cardinal_le
    (α : Type) :
    #(Syntax α) ≤ countableClosureBound α := by
  apply WType.cardinalMk_le_of_le
  refine
    (Cardinal.sum_le_mk_mul_iSup
      (fun operation : Operation α =>
        countableClosureBound α ^ #(arity operation))).trans ?_
  apply Cardinal.mul_le_of_le
    (aleph0_le_countableClosureBound α)
  · exact operation_cardinal_le α
  · exact ciSup_le' (arity_power_le α)

/-! ## Evaluation and coverage of the generated subalgebra -/

variable
    (source : ωCPO)
    (target : NDωCPO)
    (generator : source ⟶ NDωCPO.forget.obj target)

/-- Total evaluation of the W-syntax in the ambient target algebra. -/
noncomputable def evaluate :
    Syntax source.carrier → target.carrier
  | .mk (.inl value) _children =>
      generator value
  | .mk (.inr .divergence) _children =>
      target.computation.divergence
  | .mk (.inr .deadlock) _children =>
      target.computation.deadlock
  | .mk (.inr .choice) children =>
      target.computation.choice
        (evaluate (children false),
          evaluate (children true))
  | .mk (.inr .omega) children =>
      if monotone :
          Monotone
            (fun index =>
              evaluate (children index)) then
        ωSup
          ({ toFun := fun index =>
              evaluate (children index)
             monotone' := monotone } :
            Chain target.carrier)
      else
        target.computation.divergence

@[simp]
theorem evaluate_generator (value : source) :
    evaluate source target generator
        (generatorNode value) =
      generator value :=
  rfl

@[simp]
theorem evaluate_divergence :
    evaluate source target generator divergenceNode =
      target.computation.divergence :=
  rfl

@[simp]
theorem evaluate_deadlock :
    evaluate source target generator deadlockNode =
      target.computation.deadlock :=
  rfl

@[simp]
theorem evaluate_choice
    (left right : Syntax source.carrier) :
    evaluate source target generator
        (choiceNode left right) =
      target.computation.choice
        (evaluate source target generator left,
          evaluate source target generator right) := by
  simp [choiceNode, evaluate]

theorem evaluate_omega
    (children : Nat → Syntax source.carrier) :
    evaluate source target generator
        (omegaNode children) =
      if monotone :
          Monotone
            (fun index =>
              evaluate source target generator
                (children index)) then
        ωSup
          ({ toFun := fun index =>
              evaluate source target generator
                (children index)
             monotone' := monotone } :
            Chain target.carrier)
      else
        target.computation.divergence :=
  by
    simp [omegaNode, evaluate]

/--
The range of syntax evaluation is a closed carrier.  Genuine target chains
are represented by omega nodes; the non-monotone fallback is irrelevant to
this closure proof.
-/
def imageClosedCarrier :
    Generated.ClosedCarrier source target generator where
  carrier :=
    Set.range (evaluate source target generator)
  generator_mem value :=
    ⟨generatorNode value, evaluate_generator source target generator value⟩
  divergence_mem :=
    ⟨divergenceNode, evaluate_divergence source target generator⟩
  deadlock_mem :=
    ⟨deadlockNode, evaluate_deadlock source target generator⟩
  choice_mem := by
    rintro left right ⟨leftSyntax, rfl⟩ ⟨rightSyntax, rfl⟩
    exact
      ⟨choiceNode leftSyntax rightSyntax,
        evaluate_choice source target generator
          leftSyntax rightSyntax⟩
  omegaSup_mem := by
    intro chain members
    choose terms represents using members
    let evaluated : Nat → target.carrier :=
      fun index =>
        evaluate source target generator (terms index)
    have evaluated_eq : evaluated = chain := by
      funext index
      exact represents index
    have evaluated_monotone : Monotone evaluated := by
      rw [evaluated_eq]
      exact chain.monotone
    have raw_monotone :
        Monotone
          (fun index =>
            evaluate source target generator (terms index)) := by
      simpa [evaluated] using evaluated_monotone
    refine ⟨omegaNode terms, ?_⟩
    rw [evaluate_omega]
    rw [dif_pos raw_monotone]
    apply congrArg ωSup
    apply Chain.ext
    funext index
    exact represents index

/-- Choose a syntax representative for each generated carrier point. -/
def representative
    (value : Generated.Carrier source target generator) :
    Syntax source.carrier :=
  Classical.choose
    (value.2 (imageClosedCarrier source target generator))

theorem representative_evaluates
    (value : Generated.Carrier source target generator) :
    evaluate source target generator
        (representative source target generator value) =
      value.1 :=
  Classical.choose_spec
    (value.2 (imageClosedCarrier source target generator))

theorem representative_injective :
    Function.Injective
      (representative source target generator) := by
  intro left right equalSyntax
  apply Subtype.ext
  calc
    left.1 =
        evaluate source target generator
          (representative source target generator left) :=
      (representative_evaluates
        source target generator left).symm
    _ =
        evaluate source target generator
          (representative source target generator right) := by
      rw [equalSyntax]
    _ = right.1 :=
      representative_evaluates
        source target generator right

/--
The generated subalgebra has the source-dependent countable-closure
cardinality bound.
-/
theorem generatedCarrier_cardinal_le :
    #(Generated.Carrier source target generator) ≤
      countableClosureBound source.carrier :=
  (Cardinal.mk_le_of_injective
      (representative_injective source target generator)).trans
    (syntax_cardinal_le source.carrier)

end GeneratedSyntax

end Cantilune.Pi.FMSCpoNondeterministicGeneratedCardinality
