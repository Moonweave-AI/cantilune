import Cantilune.Pi.LateAlphaSupport
import Cantilune.Pi.LateStructuralQuotient
import Cantilune.Pi.OpenSMCNamedComposition

/-!
# Contextual open processes with external boundary wiring

This module tests the standard alternative to a persistent relay process:
interfaces remain external wiring metadata, while the process body contains
only executable pi syntax.  Identity therefore has an empty body and an empty
wiring program.  Composition joins bodies in parallel and concatenates a
finite program of capture-avoiding name fusions and restrictions.

The body quotient must be structural congruence, rather than bound-name alpha
alone.  The final kernel-checked obstruction proves why: alpha conversion
preserves the number of parallel nodes, so `0 | P` is not alpha-equivalent to
`P`.  Structural congruence supplies exactly the ACU equations needed by the
category laws.

The wiring interpreter is executable on raw bodies.  We prove native
operational compatibility for output-prefix fusion and restriction.  We also
exhibit the standard limitation of non-injective fusion: it can turn a true
mismatch guard into a false one and therefore cannot preserve every native
strong-late transition.
-/

namespace Cantilune.Pi.OpenSMCContextualBoundaryCategory

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary

/-! ## Finite external wiring programs -/

/-- One external wiring instruction. -/
inductive WiringOp where
  | fuse (needle replacement : Name)
  | restrict (binder : Name)
  deriving DecidableEq, Repr

namespace WiringOp

/-- Execute one wiring instruction on a raw body. -/
def apply : WiringOp → Raw.Proc → Raw.Proc
  | .fuse needle replacement, body =>
      body.substituteCaptureAvoiding needle replacement
  | .restrict binder, body =>
      .new binder body

end WiringOp

/-- Execute a finite wiring program from left to right. -/
def applyProgram (program : List WiringOp) (body : Raw.Proc) : Raw.Proc :=
  program.foldl (fun current operation => operation.apply current) body

@[simp]
theorem applyProgram_nil (body : Raw.Proc) :
    applyProgram [] body = body :=
  rfl

theorem applyProgram_append
    (first second : List WiringOp) (body : Raw.Proc) :
    applyProgram (first ++ second) body =
      applyProgram second (applyProgram first body) := by
  simp [applyProgram, List.foldl_append]

/--
Boundary wiring is external metadata.  Its indices state which public
interfaces surround the program; concrete fusion/restriction instructions
remain finite syntax.
-/
structure BoundaryWiring
    {Γ : TypeEnv}
    (input output : NamedInterface Γ) where
  program : List WiringOp

namespace BoundaryWiring

def identity (boundary : NamedInterface Γ) :
    BoundaryWiring boundary boundary where
  program := []

def comp
    (left : BoundaryWiring input middle)
    (right : BoundaryWiring middle output) :
    BoundaryWiring input output where
  program := left.program ++ right.program

@[simp]
theorem comp_identity_left
    (wiring : BoundaryWiring input output) :
    comp (identity input) wiring = wiring := by
  cases wiring
  simp [comp, identity]

@[simp]
theorem comp_identity_right
    (wiring : BoundaryWiring input output) :
    comp wiring (identity output) = wiring := by
  cases wiring
  simp [comp, identity]

theorem comp_assoc
    (first : BoundaryWiring a b)
    (second : BoundaryWiring b c)
    (third : BoundaryWiring c d) :
    comp (comp first second) third =
      comp first (comp second third) := by
  cases first
  cases second
  cases third
  simp [comp, List.append_assoc]

end BoundaryWiring

/-! ## Structural body monoid -/

abbrev StructuralProcess := Late.StructuralProcess

def structuralZero : StructuralProcess :=
  Quotient.mk Late.Struct.setoid Raw.Proc.zero

def structuralPar :
    StructuralProcess → StructuralProcess → StructuralProcess :=
  Quotient.map₂ Raw.Proc.par (by
    intro left left' leftEq right right' rightEq
    exact Late.Struct.par leftEq rightEq)

@[simp]
theorem structuralPar_mk
    (left right : Raw.Proc) :
    structuralPar
        (Quotient.mk Late.Struct.setoid left)
        (Quotient.mk Late.Struct.setoid right) =
      Quotient.mk Late.Struct.setoid (.par left right) :=
  rfl

@[simp]
theorem structuralPar_zero_left (process : StructuralProcess) :
    structuralPar structuralZero process = process := by
  refine Quotient.inductionOn process ?_
  intro representative
  exact Quotient.sound (Late.Struct.par_zero_left representative)

@[simp]
theorem structuralPar_zero_right (process : StructuralProcess) :
    structuralPar process structuralZero = process := by
  refine Quotient.inductionOn process ?_
  intro representative
  exact Quotient.sound (Late.Struct.parZero)

theorem structuralPar_assoc
    (first second third : StructuralProcess) :
    structuralPar (structuralPar first second) third =
      structuralPar first (structuralPar second third) := by
  refine Quotient.inductionOn₃ first second third ?_
  intro first second third
  exact Quotient.sound (Late.Struct.parAssoc)

/-! ## The contextual category -/

/--
An open body with its boundary wiring kept outside executable process syntax.

No relay process is inserted.  A morphism may carry a finite pending wiring
program, whose raw interpreter is `applyProgram`.
-/
structure ContextualOpenProcess
    {Γ : TypeEnv}
    (input output : NamedInterface Γ) where
  body : StructuralProcess
  wiring : BoundaryWiring input output

namespace ContextualOpenProcess

def identity (boundary : NamedInterface Γ) :
    ContextualOpenProcess boundary boundary where
  body := structuralZero
  wiring := BoundaryWiring.identity boundary

def comp
    (left : ContextualOpenProcess input middle)
    (right : ContextualOpenProcess middle output) :
    ContextualOpenProcess input output where
  body := structuralPar left.body right.body
  wiring := BoundaryWiring.comp left.wiring right.wiring

@[simp]
theorem comp_identity_left
    (process : ContextualOpenProcess input output) :
    comp (identity input) process = process := by
  cases process
  simp [comp, identity]

@[simp]
theorem comp_identity_right
    (process : ContextualOpenProcess input output) :
    comp process (identity output) = process := by
  cases process
  simp [comp, identity]

theorem comp_assoc
    (first : ContextualOpenProcess a b)
    (second : ContextualOpenProcess b c)
    (third : ContextualOpenProcess c d) :
    comp (comp first second) third =
      comp first (comp second third) := by
  cases first
  cases second
  cases third
  simp [comp, structuralPar_assoc, BoundaryWiring.comp_assoc]

/-- Identity has no executable relay body, even at a nonempty boundary. -/
@[simp]
theorem identity_body (boundary : NamedInterface Γ) :
    (identity boundary).body = structuralZero :=
  rfl

/-- Identity also contributes no fusion or restriction instruction. -/
@[simp]
theorem identity_program (boundary : NamedInterface Γ) :
    (identity boundary).wiring.program = [] :=
  rfl

end ContextualOpenProcess

/--
The laws above form an actual category for each fixed type environment.

This is intentionally only a category.  No tensor or SMC structure is claimed
for the contextual construction.
-/
instance contextualCategory (Γ : TypeEnv) :
    CategoryTheory.Category (NamedInterface Γ) where
  Hom := ContextualOpenProcess
  id := ContextualOpenProcess.identity
  comp := ContextualOpenProcess.comp
  id_comp := ContextualOpenProcess.comp_identity_left
  comp_id := ContextualOpenProcess.comp_identity_right
  assoc := ContextualOpenProcess.comp_assoc

/-! ## Native compatibility and the fusion boundary -/

/--
Capture-avoiding fusion commutes with an output prefix and preserves its
native one-step derivation, with both free names in the label renamed.
-/
theorem fuse_output_prefix_native
    (channel value needle replacement : Name)
    (next : Raw.Proc) :
    Late.NativeStep
      ((Raw.Proc.send channel value next).substituteCaptureAvoiding
        needle replacement)
      (.output
        (if channel = needle then replacement else channel)
        (if value = needle then replacement else value))
      (next.substituteCaptureAvoiding needle replacement) := by
  by_cases risk :
      next.captureRisk needle replacement = true
  · simp [Raw.Proc.substituteCaptureAvoiding, Raw.Proc.captureRisk,
      Raw.Proc.syntaxDepth, Raw.Proc.substituteCaptureAvoidingAux,
      risk]
    exact Late.NativeStep.prefixOutput
  · have safe :
        next.captureRisk needle replacement = false := by
      exact Bool.eq_false_of_not_eq_true risk
    simp [Raw.Proc.substituteCaptureAvoiding, Raw.Proc.captureRisk,
      Raw.Proc.substRaw, safe]
    exact Late.NativeStep.prefixOutput

/-- Restriction is a native strong-late congruence under its usual freshness. -/
theorem restrict_native
    (step : Late.NativeStep source action target)
    (fresh : binder ∉ action.names) :
    Late.NativeStep
      (WiringOp.apply (.restrict binder) source)
      action
      (WiringOp.apply (.restrict binder) target) :=
  Late.NativeStep.restrict fresh step

/-- A concrete native mismatch step before a non-injective fusion. -/
theorem mismatch_before_fusion_native :
    Late.NativeStep
      (.matchNe 0 1 (.tau .zero))
      .tau
      .zero :=
  Late.NativeStep.mismatchGuard (by decide)
    Late.NativeStep.prefixTau

@[simp]
theorem mismatch_fusion_result :
    (Raw.Proc.matchNe 0 1 (.tau .zero)).substituteCaptureAvoiding 1 0 =
      .matchNe 0 0 (.tau .zero) := by
  rfl

/--
Non-injective fusion is not an equivariance of native late pi: identifying
the two names of a true mismatch disables the transition.
-/
theorem mismatch_after_fusion_no_native_tau :
    ¬ ∃ target,
      Late.NativeStep
        (Raw.Proc.substituteCaptureAvoiding
          (Raw.Proc.matchNe 0 1 (.tau .zero)) 1 0)
        .tau target := by
  rw [mismatch_fusion_result]
  rintro ⟨target, step⟩
  cases step with
  | mismatchGuard distinct inner =>
      exact distinct rfl

/-! ## Why the body quotient cannot be alpha alone -/

/-- Count parallel constructors; bound-name alpha conversion preserves it. -/
def parNodeCount : Raw.Proc → Nat
  | .zero => 0
  | .tau next => parNodeCount next
  | .send _ _ next => parNodeCount next
  | .recv _ _ next => parNodeCount next
  | .choice left right => parNodeCount left + parNodeCount right
  | .par left right => parNodeCount left + parNodeCount right + 1
  | .new _ body => parNodeCount body
  | .matchEq _ _ next => parNodeCount next
  | .matchNe _ _ next => parNodeCount next

theorem parNodeCount_substRaw
    (process : Raw.Proc) (needle replacement : Name) :
    parNodeCount (process.substRaw needle replacement) =
      parNodeCount process := by
  induction process with
  | zero => rfl
  | tau next ih =>
      simp [Raw.Proc.substRaw, parNodeCount, ih]
  | send channel value next ih =>
      simp [Raw.Proc.substRaw, parNodeCount, ih]
  | recv channel binder next ih =>
      by_cases stops : binder = needle <;>
        simp [Raw.Proc.substRaw, parNodeCount, stops, ih]
  | choice left right leftIH rightIH =>
      simp [Raw.Proc.substRaw, parNodeCount, leftIH, rightIH]
  | par left right leftIH rightIH =>
      simp [Raw.Proc.substRaw, parNodeCount, leftIH, rightIH]
  | new binder body ih =>
      by_cases stops : binder = needle <;>
        simp [Raw.Proc.substRaw, parNodeCount, stops, ih]
  | matchEq left right next ih =>
      simp [Raw.Proc.substRaw, parNodeCount, ih]
  | matchNe left right next ih =>
      simp [Raw.Proc.substRaw, parNodeCount, ih]

theorem alpha_parNodeCount_eq
    (relation : Late.Alpha left right) :
    parNodeCount left = parNodeCount right := by
  induction relation <;>
    simp_all [parNodeCount, Raw.Proc.renameBound_eq_substRaw,
      parNodeCount_substRaw]

/--
Bound-name alpha conversion cannot supply the parallel unit law required by
contextual composition.  Structural congruence is therefore the minimal
existing quotient on which the category above can be constructed.
-/
theorem alpha_parallel_zero_not_identity (process : Raw.Proc) :
    ¬ Late.Alpha (.par .zero process) process := by
  intro relation
  have countEq := alpha_parNodeCount_eq relation
  simp [parNodeCount] at countEq

end Cantilune.Pi.OpenSMCContextualBoundaryCategory
