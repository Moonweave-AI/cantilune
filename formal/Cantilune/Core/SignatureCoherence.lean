import Cantilune.Core.FreeSMC

/-!
# Signature-extension coherence

An extension acts on every typed raw diagram.  The central coherence witness
below proves that composing extensions preserves object words and every
component of an old generator declaration.  These are derived facts about
`SignatureExtension.trans`; no coherence field is assumed.
-/

namespace Cantilune.Core

namespace FreeSMC

/-- Reindex a raw typed diagram along a monotone signature extension. -/
def reindex {σ τ : FinSignature} (ι : SignatureExtension σ τ)
    {a b : List σ.Obj} :
    FreeSMC σ a b →
      FreeSMC τ (ι.reindexWord a) (ι.reindexWord b)
  | .identity ports => .identity (ι.reindexWord ports)
  | .generator g => by
      rw [SignatureExtension.reindex_input,
        SignatureExtension.reindex_output]
      exact .generator (ι.gen g)
  | .sequential f g => .sequential (reindex ι f) (reindex ι g)
  | .tensor f g => by
      simpa [SignatureExtension.reindexWord, List.map_append] using
        FreeSMC.tensor (reindex ι f) (reindex ι g)
  | .symmetry left right => by
      simpa [SignatureExtension.reindexWord, List.map_append] using
        FreeSMC.symmetry (σ := τ)
          (ι.reindexWord left) (ι.reindexWord right)
  | .copy o allowed => by
      have allowed' : (τ.mode (ι.obj o)).AllowsCopy := by
        rw [← ι.mode_preserved o]
        exact allowed
      simpa [SignatureExtension.reindexWord] using
        FreeSMC.copy (σ := τ) (ι.obj o) allowed'
  | .discard o allowed => by
      have allowed' : (τ.mode (ι.obj o)).AllowsDrop := by
        rw [← ι.mode_preserved o]
        exact allowed
      simpa [SignatureExtension.reindexWord] using
        FreeSMC.discard (σ := τ) (ι.obj o) allowed'

@[simp] theorem reindex_identity {σ τ : FinSignature}
    (ι : SignatureExtension σ τ) (ports : List σ.Obj) :
    reindex ι (FreeSMC.identity ports) =
      FreeSMC.identity (ι.reindexWord ports) := rfl

@[simp] theorem reindex_sequential {σ τ : FinSignature}
    (ι : SignatureExtension σ τ)
    {a b c : List σ.Obj} (f : FreeSMC σ a b) (g : FreeSMC σ b c) :
    reindex ι (f ≫ₛ g) = reindex ι f ≫ₛ reindex ι g := rfl

end FreeSMC

namespace SignatureExtension

/--
All declaration-level coherence equations for a composable pair of signature
extensions.

The word equation is the object part used by tensor boundaries.  The remaining
equations state that inputs, outputs, structural modes, and contracts of old
symbols have one meaning after either one composed reindexing or two
successive reindexings.
-/
structure Coherence {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ) : Prop where
  objectMap :
    ∀ o, (trans ι κ).obj o = κ.obj (ι.obj o)
  generatorMap :
    ∀ g, (trans ι κ).gen g = κ.gen (ι.gen g)
  words :
    ∀ ports,
      reindexWord (trans ι κ) ports =
        reindexWord κ (reindexWord ι ports)
  inputs :
    ∀ g,
      reindexWord (trans ι κ) (σ.input g) =
        υ.input (κ.gen (ι.gen g))
  outputs :
    ∀ g,
      reindexWord (trans ι κ) (σ.output g) =
        υ.output (κ.gen (ι.gen g))
  modes :
    ∀ o, σ.mode o = υ.mode (κ.obj (ι.obj o))
  contracts :
    ∀ g, σ.contract g = υ.contract (κ.gen (ι.gen g))

/--
Signature admission is coherent under composition.

This theorem is independent of any runtime graph: it proves that an old
declaration has exactly the same reindexed type and contract whether epochs
are crossed one at a time or through the composed extension.
-/
theorem signature_extension_coherent {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ) :
    Coherence ι κ where
  objectMap := by intro; rfl
  generatorMap := by intro; rfl
  words := reindexWord_trans ι κ
  inputs := by
    intro g
    exact (trans ι κ).input_preserved g
  outputs := by
    intro g
    exact (trans ι κ).output_preserved g
  modes := by
    intro o
    exact (ι.mode_preserved o).trans (κ.mode_preserved (ι.obj o))
  contracts := by
    intro g
    exact
      (ι.contract_preserved g).trans
        (κ.contract_preserved (ι.gen g))

end SignatureExtension

/-- Stable central theorem name. -/
theorem signature_extension_coherent {σ τ υ : FinSignature}
    (ι : SignatureExtension σ τ) (κ : SignatureExtension τ υ) :
    SignatureExtension.Coherence ι κ :=
  SignatureExtension.signature_extension_coherent ι κ

end Cantilune.Core
