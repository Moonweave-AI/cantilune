import Cantilune.Pi.PowerdomainUnseparated.Domain

/-!
# Adequacy boundary for the unseparated powerdomain

An operational adequacy theorem is meaningful only after fixing a concrete
program syntax, native evaluation relation, and denotation.  This module
bundles exactly those data and proves the two-direction equivalence from the
proof fields.  It does not manufacture a language semantics from the
powerdomain alone.
-/

noncomputable section

namespace Cantilune.Pi.PowerdomainUnseparated

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower

universe u

/--
Proof-carrying adequacy data for one concrete language and value domain.
The denotation is the actual unseparated omega-Scott power carrier.
-/
structure AdequacyPackage
    (Program Value : Type u)
    [OmegaCompletePartialOrder Value] where
  evaluates : Program → Value → Prop
  denote : Program → UnseparatedPower Value
  sound :
    ∀ {program value},
      evaluates program value →
        WithOmegaScott.toOmegaScott value ∈ carrier (denote program)
  complete :
    ∀ {program value},
      WithOmegaScott.toOmegaScott value ∈ carrier (denote program) →
        evaluates program value

namespace AdequacyPackage

variable
    {Program Value : Type u}
    [OmegaCompletePartialOrder Value]
    (package : AdequacyPackage Program Value)

def operationalResult (program : Program) : Set Value :=
  { value | package.evaluates program value }

def denotationalResult (program : Program) : Set Value :=
  { value |
    WithOmegaScott.toOmegaScott value ∈
      carrier (package.denote program) }

theorem result_membership_iff
    (program : Program) (value : Value) :
    value ∈ package.operationalResult program ↔
      value ∈ package.denotationalResult program := by
  constructor
  · exact package.sound
  · exact package.complete

theorem result_extensionality (program : Program) :
    package.operationalResult program =
      package.denotationalResult program := by
  ext value
  exact package.result_membership_iff program value

def operationallyTerminates (program : Program) : Prop :=
  ∃ value, package.evaluates program value

def denotationallyTerminates (program : Program) : Prop :=
  ∃ value,
    WithOmegaScott.toOmegaScott value ∈
      carrier (package.denote program)

theorem termination_iff (program : Program) :
    package.operationallyTerminates program ↔
      package.denotationallyTerminates program := by
  constructor
  · rintro ⟨value, evaluation⟩
    exact ⟨value, package.sound evaluation⟩
  · rintro ⟨value, membership⟩
    exact ⟨value, package.complete membership⟩

theorem evaluation_iff_denotation_member
    (program : Program) (value : Value) :
    package.evaluates program value ↔
      WithOmegaScott.toOmegaScott value ∈
        carrier (package.denote program) :=
  package.result_membership_iff program value

end AdequacyPackage

/--
The current repository has a constructed domain solution but still requires
an inhabitant of this structure for the chosen native late-pi language.
-/
def ConcreteAdequacyObligation :=
  Σ Program Value : Type,
    Σ _ : OmegaCompletePartialOrder Value,
      AdequacyPackage Program Value

end Cantilune.Pi.PowerdomainUnseparated
