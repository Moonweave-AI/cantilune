import Cantilune.Pi.PowerdomainUnseparated.Adequacy

/-!
# Full-abstraction and definability boundaries

Full abstraction depends on the chosen program contexts and observations.
The powerdomain and recursive carrier do not determine those choices.  This
module therefore provides proof-carrying structures and derives the final
equivalences from their fields, while leaving construction for the native
late-pi language as an explicit obligation.
-/

namespace Cantilune.Pi.PowerdomainUnseparated

universe u

structure FullAbstractionPackage
    (Program Denotation Observation : Type u) where
  Context : Type u
  denote : Program → Denotation
  plug : Context → Program → Program
  observes : Program → Observation → Prop
  contextDenote : Context → Denotation → Denotation
  compositional :
    ∀ context program,
      denote (plug context program) =
        contextDenote context (denote program)
  sound :
    ∀ {left right},
      denote left = denote right →
        ∀ context observation,
          (observes (plug context left) observation ↔
            observes (plug context right) observation)
  complete :
    ∀ {left right},
      (∀ context observation,
        observes (plug context left) observation ↔
          observes (plug context right) observation) →
        denote left = denote right

namespace FullAbstractionPackage

variable
    {Program Denotation Observation : Type u}
    (package :
      FullAbstractionPackage Program Denotation Observation)

def ObservationallyEquivalent
    (left right : Program) : Prop :=
  ∀ context observation,
    package.observes (package.plug context left) observation ↔
      package.observes (package.plug context right) observation

theorem denotation_eq_implies_observationallyEquivalent
    {left right : Program}
    (equal : package.denote left = package.denote right) :
    package.ObservationallyEquivalent left right :=
  package.sound equal

theorem observationallyEquivalent_implies_denotation_eq
    {left right : Program}
    (equivalent : package.ObservationallyEquivalent left right) :
    package.denote left = package.denote right :=
  package.complete equivalent

/--
The full-abstraction equivalence follows from the package's explicit
soundness and completeness fields.
-/
theorem full_abstraction_of_package
    (left right : Program) :
    package.denote left = package.denote right ↔
      package.ObservationallyEquivalent left right :=
  ⟨package.denotation_eq_implies_observationallyEquivalent,
    package.observationallyEquivalent_implies_denotation_eq⟩

theorem observationallyEquivalent_refl
    (program : Program) :
    package.ObservationallyEquivalent program program := by
  intro context observation
  rfl

theorem observationallyEquivalent_symm
    {left right : Program}
    (equivalent : package.ObservationallyEquivalent left right) :
    package.ObservationallyEquivalent right left := by
  intro context observation
  exact (equivalent context observation).symm

theorem observationallyEquivalent_trans
    {first second third : Program}
    (firstSecond :
      package.ObservationallyEquivalent first second)
    (secondThird :
      package.ObservationallyEquivalent second third) :
    package.ObservationallyEquivalent first third := by
  intro context observation
  exact
    (firstSecond context observation).trans
      (secondThird context observation)

end FullAbstractionPackage

/--
Constructive definability data.  Only denotations selected by `compact` are
required to have a representing program.
-/
structure DefinabilityPackage
    (Program Denotation Observation : Type u)
    extends FullAbstractionPackage Program Denotation Observation where
  compact : Denotation → Prop
  realize : Denotation → Program
  realize_correct :
    ∀ denotation,
      compact denotation →
        toFullAbstractionPackage.denote (realize denotation) =
          denotation

namespace DefinabilityPackage

variable
    {Program Denotation Observation : Type u}
    (package :
      DefinabilityPackage Program Denotation Observation)

/--
Definability follows only for a package that already supplies `realize` and
`realize_correct`.
-/
theorem compact_definable_of_package
    (denotation : Denotation)
    (compact : package.compact denotation) :
    ∃ program,
      package.toFullAbstractionPackage.denote program =
        denotation :=
  ⟨package.realize denotation,
    package.realize_correct denotation compact⟩

end DefinabilityPackage

end Cantilune.Pi.PowerdomainUnseparated
