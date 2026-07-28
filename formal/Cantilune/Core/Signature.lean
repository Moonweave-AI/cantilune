import Mathlib

/-!
# Finite signatures

This module separates a finite signature from its runtime instances.  A
signature extension is injective and carries proofs that every old object and
generator keeps its complete declaration.
-/

namespace Cantilune.Core

/-- Which structural operations may be used on a wire. -/
inductive StructuralMode
  | cartesian
  | affine
  | relevant
  | linear
  deriving DecidableEq, Repr

namespace StructuralMode

/-- Copying is explicit and is available only for cartesian or relevant data. -/
def AllowsCopy : StructuralMode → Prop
  | .cartesian | .relevant => True
  | .affine | .linear => False

/-- Discarding is explicit and is available only for cartesian or affine data. -/
def AllowsDrop : StructuralMode → Prop
  | .cartesian | .affine => True
  | .relevant | .linear => False

instance (mode : StructuralMode) : Decidable mode.AllowsCopy :=
  match mode with
  | .cartesian => isTrue trivial
  | .affine => isFalse id
  | .relevant => isTrue trivial
  | .linear => isFalse id

instance (mode : StructuralMode) : Decidable mode.AllowsDrop :=
  match mode with
  | .cartesian => isTrue trivial
  | .affine => isTrue trivial
  | .relevant => isFalse id
  | .linear => isFalse id

@[simp] theorem cartesian_allowsCopy : cartesian.AllowsCopy := trivial
@[simp] theorem cartesian_allowsDrop : cartesian.AllowsDrop := trivial
@[simp] theorem relevant_allowsCopy : relevant.AllowsCopy := trivial
@[simp] theorem affine_allowsDrop : affine.AllowsDrop := trivial

@[simp] theorem linear_forbidsCopy : ¬linear.AllowsCopy := by
  simp [AllowsCopy]

@[simp] theorem linear_forbidsDrop : ¬linear.AllowsDrop := by
  simp [AllowsDrop]

@[simp] theorem affine_forbidsCopy : ¬affine.AllowsCopy := by
  simp [AllowsCopy]

@[simp] theorem relevant_forbidsDrop : ¬relevant.AllowsDrop := by
  simp [AllowsDrop]

end StructuralMode

/--
A small, decidable contract vocabulary.  Contract atoms are deliberately
uninterpreted here: their semantics belongs to a projection or execution
package, while an extension must preserve the exact declaration.
-/
structure ContractSpec where
  requires : Finset String := ∅
  ensures : Finset String := ∅
  deriving DecidableEq

/--
A finite many-sorted signature.  `input` and `output` are ordered wire lists;
parallel composition therefore does not silently commute or duplicate wires.
-/
structure FinSignature where
  Obj : Type
  Gen : Type
  objFintype : Fintype Obj
  genFintype : Fintype Gen
  objDecidableEq : DecidableEq Obj
  genDecidableEq : DecidableEq Gen
  input : Gen → List Obj
  output : Gen → List Obj
  mode : Obj → StructuralMode
  contract : Gen → ContractSpec

attribute [instance] FinSignature.objFintype FinSignature.genFintype
  FinSignature.objDecidableEq FinSignature.genDecidableEq

/--
An admissible extension is a pair of injections preserving the complete old
declarations.  Consequently it can add declarations, but cannot redefine or
delete an old one.
-/
structure SignatureExtension (σ τ : FinSignature) where
  obj : σ.Obj ↪ τ.Obj
  gen : σ.Gen ↪ τ.Gen
  input_preserved :
    ∀ g, (σ.input g).map obj = τ.input (gen g)
  output_preserved :
    ∀ g, (σ.output g).map obj = τ.output (gen g)
  mode_preserved :
    ∀ o, σ.mode o = τ.mode (obj o)
  contract_preserved :
    ∀ g, σ.contract g = τ.contract (gen g)

namespace SignatureExtension

/-- The identity extension. -/
def refl (σ : FinSignature) : SignatureExtension σ σ where
  obj := ⟨id, Function.injective_id⟩
  gen := ⟨id, Function.injective_id⟩
  input_preserved := by
    intro g
    change List.map id (σ.input g) = σ.input g
    exact List.map_id _
  output_preserved := by
    intro g
    change List.map id (σ.output g) = σ.output g
    exact List.map_id _
  mode_preserved := by simp
  contract_preserved := by simp

/-- Composition of monotone signature extensions. -/
def trans {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ) :
    SignatureExtension σ υ where
  obj :=
    ⟨fun o => κ.obj (ι.obj o),
      κ.obj.injective.comp ι.obj.injective⟩
  gen :=
    ⟨fun g => κ.gen (ι.gen g),
      κ.gen.injective.comp ι.gen.injective⟩
  input_preserved := by
    intro g
    calc
      (σ.input g).map (fun o => κ.obj (ι.obj o)) =
          ((σ.input g).map ι.obj).map κ.obj := by
            simp [List.map_map]
      _ = (τ.input (ι.gen g)).map κ.obj := by
            rw [ι.input_preserved]
      _ = υ.input (κ.gen (ι.gen g)) := κ.input_preserved _
  output_preserved := by
    intro g
    calc
      (σ.output g).map (fun o => κ.obj (ι.obj o)) =
          ((σ.output g).map ι.obj).map κ.obj := by
            simp [List.map_map]
      _ = (τ.output (ι.gen g)).map κ.obj := by
            rw [ι.output_preserved]
      _ = υ.output (κ.gen (ι.gen g)) := κ.output_preserved _
  mode_preserved := by
    intro o
    exact (ι.mode_preserved o).trans (κ.mode_preserved (ι.obj o))
  contract_preserved := by
    intro g
    exact
      (ι.contract_preserved g).trans
        (κ.contract_preserved (ι.gen g))

/-- Reindex an ordered tensor word along a signature extension. -/
def reindexWord {σ τ : FinSignature} (ι : SignatureExtension σ τ)
    (ports : List σ.Obj) : List τ.Obj :=
  ports.map ι.obj

@[simp] theorem reindexWord_refl (σ : FinSignature) (ports : List σ.Obj) :
    reindexWord (refl σ) ports = ports := by
  change List.map id ports = ports
  exact List.map_id _

@[simp] theorem reindexWord_trans {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ)
    (ports : List σ.Obj) :
    reindexWord (trans ι κ) ports =
      reindexWord κ (reindexWord ι ports) := by
  simp [reindexWord, trans, List.map_map]

@[simp] theorem reindex_input {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (g : σ.Gen) :
    reindexWord ι (σ.input g) = τ.input (ι.gen g) :=
  ι.input_preserved g

@[simp] theorem reindex_output {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (g : σ.Gen) :
    reindexWord ι (σ.output g) = τ.output (ι.gen g) :=
  ι.output_preserved g

end SignatureExtension

end Cantilune.Core
