import Mathlib
import Cantilune.Core.Signature

/-!
# Four-view signature admission

Runtime signature growth is legal only when every declaration has semantics in
all four projection universes.  This module keeps those universes abstract, so
it does not freeze a product API, while making preservation of every old
interpretation a proof obligation.

An interpretation maps a finite Cantilune signature into one fixed semantic
universe.  `Extends` says that an injective signature extension preserves the
semantic object and generator assigned to every old declaration.  The typing,
mode, and contract preservation theorems are then derived from the two
interpretations and the underlying `SignatureExtension`; they are not extra
assumptions.
-/

namespace Cantilune.Core

/-- A total interpretation of one finite signature in a semantic universe. -/
structure SignatureInterpretation
    (signature : FinSignature) (Object Generator : Type) where
  object : signature.Obj → Object
  generator : signature.Gen → Generator
  input : Generator → List Object
  output : Generator → List Object
  mode : Object → StructuralMode
  contract : Generator → ContractSpec
  input_preserved :
    ∀ symbol,
      (signature.input symbol).map object = input (generator symbol)
  output_preserved :
    ∀ symbol,
      (signature.output symbol).map object = output (generator symbol)
  mode_preserved :
    ∀ objectSymbol,
      mode (object objectSymbol) = signature.mode objectSymbol
  contract_preserved :
    ∀ symbol,
      contract (generator symbol) = signature.contract symbol

namespace SignatureInterpretation

/--
An interpretation of an extended signature preserves the semantic identity of
every old object and generator.  New declarations are interpreted because
`new` is total on the extended finite signature.
-/
structure Extends {source target : FinSignature}
    {Object Generator : Type}
    (extension : SignatureExtension source target)
    (old : SignatureInterpretation source Object Generator)
    (new : SignatureInterpretation target Object Generator) : Prop where
  object_preserved :
    ∀ objectSymbol,
      old.object objectSymbol = new.object (extension.obj objectSymbol)
  generator_preserved :
    ∀ symbol,
      old.generator symbol = new.generator (extension.gen symbol)

namespace Extends

variable {source target final : FinSignature}
variable {Object Generator : Type}
variable {old : SignatureInterpretation source Object Generator}
variable {middle : SignatureInterpretation target Object Generator}
variable {new : SignatureInterpretation final Object Generator}

/-- Preserved semantic inputs follow from declaration preservation. -/
theorem input_coherent
    {extension : SignatureExtension source target}
    (witness : Extends extension old middle) (symbol : source.Gen) :
    old.input (old.generator symbol) =
      middle.input (middle.generator (extension.gen symbol)) := by
  calc
    old.input (old.generator symbol) =
        (source.input symbol).map old.object :=
      (old.input_preserved symbol).symm
    _ = (source.input symbol).map
        (fun objectSymbol =>
          middle.object (extension.obj objectSymbol)) := by
      apply List.map_congr_left
      intro objectSymbol _membership
      exact witness.object_preserved objectSymbol
    _ = (target.input (extension.gen symbol)).map middle.object := by
      rw [← extension.input_preserved symbol]
      simp [List.map_map, Function.comp_def]
    _ = middle.input (middle.generator (extension.gen symbol)) :=
      middle.input_preserved (extension.gen symbol)

/-- Preserved semantic outputs follow from declaration preservation. -/
theorem output_coherent
    {extension : SignatureExtension source target}
    (witness : Extends extension old middle) (symbol : source.Gen) :
    old.output (old.generator symbol) =
      middle.output (middle.generator (extension.gen symbol)) := by
  calc
    old.output (old.generator symbol) =
        (source.output symbol).map old.object :=
      (old.output_preserved symbol).symm
    _ = (source.output symbol).map
        (fun objectSymbol =>
          middle.object (extension.obj objectSymbol)) := by
      apply List.map_congr_left
      intro objectSymbol _membership
      exact witness.object_preserved objectSymbol
    _ = (target.output (extension.gen symbol)).map middle.object := by
      rw [← extension.output_preserved symbol]
      simp [List.map_map, Function.comp_def]
    _ = middle.output (middle.generator (extension.gen symbol)) :=
      middle.output_preserved (extension.gen symbol)

/-- Structural modes of old objects cannot change during admission. -/
theorem mode_coherent
    {extension : SignatureExtension source target}
    (_witness : Extends extension old middle) (objectSymbol : source.Obj) :
    old.mode (old.object objectSymbol) =
      middle.mode (middle.object (extension.obj objectSymbol)) := by
  rw [old.mode_preserved, middle.mode_preserved,
    ← extension.mode_preserved]

/-- Contracts of old generators cannot change during admission. -/
theorem contract_coherent
    {extension : SignatureExtension source target}
    (_witness : Extends extension old middle) (symbol : source.Gen) :
    old.contract (old.generator symbol) =
      middle.contract (middle.generator (extension.gen symbol)) := by
  rw [old.contract_preserved, middle.contract_preserved,
    ← extension.contract_preserved]

/-- Interpretation preservation composes across epoch boundaries. -/
theorem trans
    {first : SignatureExtension source target}
    {second : SignatureExtension target final}
    (firstWitness : Extends first old middle)
    (secondWitness : Extends second middle new) :
    Extends (SignatureExtension.trans first second) old new where
  object_preserved := by
    intro objectSymbol
    exact
      (firstWitness.object_preserved objectSymbol).trans
        (secondWitness.object_preserved (first.obj objectSymbol))
  generator_preserved := by
    intro symbol
    exact
      (firstWitness.generator_preserved symbol).trans
        (secondWitness.generator_preserved (first.gen symbol))

end Extends

end SignatureInterpretation

/--
The four target universes are parameters of the theory layer.  Concrete
products may choose different carriers without changing admission logic.
-/
structure ProjectionUniverses where
  dagObject : Type
  dagGenerator : Type
  petriObject : Type
  petriGenerator : Type
  piObject : Type
  piGenerator : Type
  morphismObject : Type
  morphismGenerator : Type

/-- Total DAG, Petri, π, and morphism views of one finite signature. -/
structure FourSignatureViews
    (universes : ProjectionUniverses) (signature : FinSignature) where
  dag :
    SignatureInterpretation signature
      universes.dagObject universes.dagGenerator
  petri :
    SignatureInterpretation signature
      universes.petriObject universes.petriGenerator
  pi :
    SignatureInterpretation signature
      universes.piObject universes.piGenerator
  morphism :
    SignatureInterpretation signature
      universes.morphismObject universes.morphismGenerator

/--
Admission certificate for one monotone extension.  Absence of any one field
makes admission uninhabitable.
-/
structure FourViewAdmission
    (universes : ProjectionUniverses)
    {source target : FinSignature}
    (extension : SignatureExtension source target)
    (old : FourSignatureViews universes source)
    (new : FourSignatureViews universes target) : Prop where
  dag : SignatureInterpretation.Extends extension old.dag new.dag
  petri : SignatureInterpretation.Extends extension old.petri new.petri
  pi : SignatureInterpretation.Extends extension old.pi new.pi
  morphism :
    SignatureInterpretation.Extends extension old.morphism new.morphism

namespace FourViewAdmission

/-- Four-projection admission evidence composes across finite epochs. -/
theorem trans
    {universes : ProjectionUniverses}
    {source middleSignature target : FinSignature}
    {first : SignatureExtension source middleSignature}
    {second : SignatureExtension middleSignature target}
    {old : FourSignatureViews universes source}
    {middle : FourSignatureViews universes middleSignature}
    {new : FourSignatureViews universes target}
    (firstAdmission : FourViewAdmission universes first old middle)
    (secondAdmission : FourViewAdmission universes second middle new) :
    FourViewAdmission universes
      (SignatureExtension.trans first second) old new where
  dag := firstAdmission.dag.trans secondAdmission.dag
  petri := firstAdmission.petri.trans secondAdmission.petri
  pi := firstAdmission.pi.trans secondAdmission.pi
  morphism := firstAdmission.morphism.trans secondAdmission.morphism

end FourViewAdmission

/--
An epoch-boundary admission event.  The trace retains both versions and the
four-view certificate; the strict inequality rules out an in-epoch extension.
-/
structure SignatureAdmissionEvent
    (universes : ProjectionUniverses)
    {source target : FinSignature} where
  fromVersion : Nat
  toVersion : Nat
  advancesEpoch : fromVersion < toVersion
  extension : SignatureExtension source target
  oldViews : FourSignatureViews universes source
  newViews : FourSignatureViews universes target
  certificate :
    FourViewAdmission universes extension oldViews newViews
  tombstoneId : Nat

end Cantilune.Core
