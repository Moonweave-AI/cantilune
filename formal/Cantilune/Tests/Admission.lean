import Mathlib
import Cantilune.Core.Admission

/-!
# Executable four-view admission reference

This file instantiates the abstract admission interface with a deliberately
small family of finite signatures.  It is a regression witness for the
admission contract, not a model of general P1c mobility or reconfiguration.

At each epoch boundary one object and one generator are appended.  Every
generator has one input and one output of its correspondingly indexed object.
The four semantic views use disjoint numeric namespaces, making it executable
to check that the newly admitted declaration has an interpretation everywhere.
-/

namespace Cantilune.Tests.Admission

open Cantilune.Core

/-- The one contract used by this finite reference family. -/
def referenceContract : ContractSpec where
  requires := {"registered"}
  ensures := {"typed"}

/--
The size-`n` reference signature has `n` objects and `n` generators.  Generator
`i` consumes and produces object `i`; every wire is linear.
-/
def referenceSignature (n : Nat) : FinSignature where
  Obj := Fin n
  Gen := Fin n
  objFintype := inferInstance
  genFintype := inferInstance
  objDecidableEq := inferInstance
  genDecidableEq := inferInstance
  input := fun generator => [generator]
  output := fun generator => [generator]
  mode := fun _ => .linear
  contract := fun _ => referenceContract

/-- Append one object and one generator without changing an old declaration. -/
def appendOne (n : Nat) :
    SignatureExtension (referenceSignature n) (referenceSignature (n + 1)) where
  obj := Fin.castSuccEmb
  gen := Fin.castSuccEmb
  input_preserved := by
    intro generator
    rfl
  output_preserved := by
    intro generator
    rfl
  mode_preserved := by
    intro objectSymbol
    rfl
  contract_preserved := by
    intro generator
    rfl

/-- A semantic generator records the ports and contract assigned by one view. -/
structure SemanticGenerator where
  code : Nat
  inputPorts : List Nat
  outputPorts : List Nat
  contractSpec : ContractSpec
  deriving DecidableEq

/--
Interpret a reference signature in one numeric namespace.  Different offsets
stand for the four distinct target universes used by this executable witness.
-/
def interpretation (offset n : Nat) :
    SignatureInterpretation (referenceSignature n) Nat SemanticGenerator where
  object := fun objectSymbol => offset + objectSymbol.val
  generator := fun symbol =>
    { code := offset + symbol.val
      inputPorts := [offset + symbol.val]
      outputPorts := [offset + symbol.val]
      contractSpec := referenceContract }
  input := SemanticGenerator.inputPorts
  output := SemanticGenerator.outputPorts
  mode := fun _ => .linear
  contract := SemanticGenerator.contractSpec
  input_preserved := by
    intro symbol
    rfl
  output_preserved := by
    intro symbol
    rfl
  mode_preserved := by
    intro objectSymbol
    rfl
  contract_preserved := by
    intro symbol
    rfl

/-- The four carriers are intentionally explicit even though this test reuses types. -/
def universes : ProjectionUniverses where
  dagObject := Nat
  dagGenerator := SemanticGenerator
  petriObject := Nat
  petriGenerator := SemanticGenerator
  piObject := Nat
  piGenerator := SemanticGenerator
  morphismObject := Nat
  morphismGenerator := SemanticGenerator

/-- Four total views, separated by their numeric namespace offsets. -/
def views (n : Nat) : FourSignatureViews universes (referenceSignature n) where
  dag := interpretation 0 n
  petri := interpretation 100 n
  pi := interpretation 200 n
  morphism := interpretation 300 n

/-- Appending one declaration preserves one view's complete old semantics. -/
theorem interpretationAppendOne (offset n : Nat) :
    SignatureInterpretation.Extends
      (appendOne n) (interpretation offset n) (interpretation offset (n + 1)) where
  object_preserved := by
    intro objectSymbol
    rfl
  generator_preserved := by
    intro symbol
    rfl

/-- A concrete four-view admission between two adjacent finite signatures. -/
theorem admission (n : Nat) :
    FourViewAdmission universes (appendOne n) (views n) (views (n + 1)) where
  dag := interpretationAppendOne 0 n
  petri := interpretationAppendOne 100 n
  pi := interpretationAppendOne 200 n
  morphism := interpretationAppendOne 300 n

abbrev initialSignature : FinSignature := referenceSignature 1
abbrev middleSignature : FinSignature := referenceSignature 2
abbrev finalSignature : FinSignature := referenceSignature 3

theorem firstAdmission :
    FourViewAdmission universes (appendOne 1) (views 1) (views 2) :=
  admission 1

theorem secondAdmission :
    FourViewAdmission universes (appendOne 2) (views 2) (views 3) :=
  admission 2

/-- The two independently certified epoch admissions compose. -/
theorem combinedAdmission :
    FourViewAdmission universes
      (SignatureExtension.trans (appendOne 1) (appendOne 2))
      (views 1) (views 3) :=
  firstAdmission.trans secondAdmission

/-- An executable first epoch-boundary admission event. -/
def firstEvent :
    SignatureAdmissionEvent universes
      (source := initialSignature) (target := middleSignature) where
  fromVersion := 0
  toVersion := 1
  advancesEpoch := by omega
  extension := appendOne 1
  oldViews := views 1
  newViews := views 2
  certificate := firstAdmission
  tombstoneId := 1000

/-- An executable second epoch-boundary admission event. -/
def secondEvent :
    SignatureAdmissionEvent universes
      (source := middleSignature) (target := finalSignature) where
  fromVersion := 1
  toVersion := 2
  advancesEpoch := by omega
  extension := appendOne 2
  oldViews := views 2
  newViews := views 3
  certificate := secondAdmission
  tombstoneId := 1001

/-! ## Finite and executable regression facts -/

example : Fintype.card initialSignature.Obj = 1 := by native_decide
example : Fintype.card middleSignature.Gen = 2 := by native_decide
example : Fintype.card finalSignature.Gen = 3 := by native_decide

/-- The first appended symbol is genuinely new, rather than an old alias. -/
example :
    ¬ ∃ oldSymbol : initialSignature.Gen,
        (appendOne 1).gen oldSymbol = (Fin.last 1 : middleSignature.Gen) := by
  native_decide

/-- The old generator keeps its identity in every semantic view. -/
example (oldSymbol : initialSignature.Gen) :
    (views 1).dag.generator oldSymbol =
        (views 2).dag.generator ((appendOne 1).gen oldSymbol) ∧
      (views 1).petri.generator oldSymbol =
        (views 2).petri.generator ((appendOne 1).gen oldSymbol) ∧
      (views 1).pi.generator oldSymbol =
        (views 2).pi.generator ((appendOne 1).gen oldSymbol) ∧
      (views 1).morphism.generator oldSymbol =
        (views 2).morphism.generator ((appendOne 1).gen oldSymbol) := by
  exact
    ⟨firstAdmission.dag.generator_preserved oldSymbol,
      firstAdmission.petri.generator_preserved oldSymbol,
      firstAdmission.pi.generator_preserved oldSymbol,
      firstAdmission.morphism.generator_preserved oldSymbol⟩

/-- The old object keeps its identity in every semantic view. -/
example (oldObject : initialSignature.Obj) :
    (views 1).dag.object oldObject =
        (views 2).dag.object ((appendOne 1).obj oldObject) ∧
      (views 1).petri.object oldObject =
        (views 2).petri.object ((appendOne 1).obj oldObject) ∧
      (views 1).pi.object oldObject =
        (views 2).pi.object ((appendOne 1).obj oldObject) ∧
      (views 1).morphism.object oldObject =
        (views 2).morphism.object ((appendOne 1).obj oldObject) := by
  exact
    ⟨firstAdmission.dag.object_preserved oldObject,
      firstAdmission.petri.object_preserved oldObject,
      firstAdmission.pi.object_preserved oldObject,
      firstAdmission.morphism.object_preserved oldObject⟩

/--
The port-level generator semantics is preserved in all four views as a
consequence of the declaration and object preservation proofs.
-/
example (oldSymbol : initialSignature.Gen) :
    (views 1).dag.input ((views 1).dag.generator oldSymbol) =
        (views 2).dag.input
          ((views 2).dag.generator ((appendOne 1).gen oldSymbol)) ∧
      (views 1).petri.input ((views 1).petri.generator oldSymbol) =
        (views 2).petri.input
          ((views 2).petri.generator ((appendOne 1).gen oldSymbol)) ∧
      (views 1).pi.output ((views 1).pi.generator oldSymbol) =
        (views 2).pi.output
          ((views 2).pi.generator ((appendOne 1).gen oldSymbol)) ∧
      (views 1).morphism.output ((views 1).morphism.generator oldSymbol) =
        (views 2).morphism.output
          ((views 2).morphism.generator ((appendOne 1).gen oldSymbol)) := by
  exact
    ⟨firstAdmission.dag.input_coherent oldSymbol,
      firstAdmission.petri.input_coherent oldSymbol,
      firstAdmission.pi.output_coherent oldSymbol,
      firstAdmission.morphism.output_coherent oldSymbol⟩

/--
The first new generator has a concrete, view-specific interpretation in all
four target universes.
-/
example :
    ((views 2).dag.generator (Fin.last 1)).code = 1 ∧
      ((views 2).petri.generator (Fin.last 1)).code = 101 ∧
      ((views 2).pi.generator (Fin.last 1)).code = 201 ∧
      ((views 2).morphism.generator (Fin.last 1)).code = 301 := by
  native_decide

/-- Composition also preserves the original generator across both admissions. -/
example (oldSymbol : initialSignature.Gen) :
    (views 1).pi.generator oldSymbol =
      (views 3).pi.generator
        ((SignatureExtension.trans (appendOne 1) (appendOne 2)).gen oldSymbol) :=
  combinedAdmission.pi.generator_preserved oldSymbol

/-- The strict epoch inequality rules out an admission within one epoch. -/
example {source target : FinSignature}
    (event : SignatureAdmissionEvent universes (source := source) (target := target)) :
    ¬ event.fromVersion = event.toVersion :=
  Nat.ne_of_lt event.advancesEpoch

end Cantilune.Tests.Admission
