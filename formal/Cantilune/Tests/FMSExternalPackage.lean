import Cantilune.Pi.FMSExternalPackage

namespace Cantilune.Tests.FMSExternalPackage

open Cantilune.Pi
open Cantilune.Pi.FMSExternalPackage
open OmegaCompletePartialOrder

example (power : CpoPowerdomainPackage) (object : ωCPO) :
    (power.computation object).divergence ≠
      (power.computation object).deadlock :=
  power.divergence_ne_deadlock object

example {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : Nat) (process : solution.agent.obj world) :
    solution.divergence world ≤ process :=
  solution.divergence_le world process

example {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : Nat) :
    solution.divergence world ≠ solution.deadlock world :=
  solution.divergence_ne_deadlock world

example {power : CpoPowerdomainPackage}
    (solution : AgentDomainSolution power)
    (world : Nat)
    (left middle right : solution.agent.obj world) :
    solution.choice world (solution.choice world left middle) right =
      solution.choice world left (solution.choice world middle right) :=
  solution.choice_assoc world left middle right

example :
    fmsLics1996.doi = "10.1109/LICS.1996.561302" :=
  rfl

example :
    fmsJournal2002.doi = "10.1006/inco.2002.2968" :=
  rfl

example :
    mechanizedCpoFragment.shift =
      Cantilune.Pi.FMSCpoWorld.shift :=
  rfl

example (world : Nat) :
    (mechanizedCpoFragment.finiteAgentEquation world).hom =
      (Cantilune.Pi.FMSCpoFiniteAgent.agentLayerIso world).hom :=
  rfl

/--
The external boundary uses the late-input clause, not mere same-label
derivative matching: every received name is substituted before comparison.
-/
example (relation : Raw.Proc → Raw.Proc → Prop)
    (channel binder : Name) (left right : Raw.Proc) :
    LateDerivativeRelated relation (.input channel binder) left right ↔
      ∀ received,
        relation
          (left.substituteCaptureAvoiding binder received)
          (right.substituteCaptureAvoiding binder received) :=
  Iff.rfl

/--
Regression for the conditional boundary: this theorem requires a package
argument.  The test does not construct one.
-/
example (package : ExternalFMSTheoremPackage)
    (left right : ClosedRaw) :
    StrongLateBisimilar left right ↔
      package.lateFullAbstraction.denote left =
        package.lateFullAbstraction.denote right :=
  full_abstraction_of_package package left right

/--
The strengthened acceptance boundary also remains conditional.  This test
checks extraction from a caller-supplied complete package; it deliberately
does not manufacture an inhabitant of `CompleteFMSAvailable`.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (left right : ClosedRaw) :
    StrongLateBisimilar left right ↔
      package.lateFullAbstraction.denote left =
        package.lateFullAbstraction.denote right :=
  full_abstraction_of_complete_package package left right

/--
The complete package cannot interpret the supported and nominal syntaxes by
unrelated denotation functions: canonical closed reification must commute
with denotation.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (process : FMSContext.SupportedProc 0 0) :
    package.lateFullAbstraction.denote
        (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed process) =
      package.restriction.denote.app 0 process :=
  package.operationalDenotation.denote_reification process

/--
Every nominally closed process must also be represented by supported syntax,
up to the standard structural congruence used by the late semantics.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (process : ClosedRaw) :
    Late.Struct
        (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed
          (package.operationalDenotation.encodeClosed process)).1
        process.1 :=
  package.operationalDenotation.encode_reifies process

example (package : CompleteExternalFMSTheoremPackage)
    (world : Nat) (process : FMSContext.SupportedProc (world + 1) 0) :
    package.coherentHiding.restriction.app world
        (package.hidingDenotation.abstractDenote world process) =
      package.restriction.denote.app world
        (FMSCanonicalHidingSyntax.SupportedProc.restrictLast process) :=
  package.hidingDenotation.canonical_restriction_denotation world process

example (package : CompleteExternalFMSTheoremPackage)
    (world : Nat) (process : FMSContext.SupportedProc (world + 1) 0)
    (name : Fin world) :
    (package.restriction.abstractionDenotation world process).1 name =
      package.restriction.denote.app world
        (FMSContext.SupportedProc.renameFree
          (FMSBinderInstantiation.ScopedName.instantiateLast name)
          process) :=
  package.hidingDenotation.known_component world process name

example (package : CompleteExternalFMSTheoremPackage)
    (world : Nat) (body : FMSContext.SupportedProc world 1) :
    package.coherentHiding.restriction.app world
        (package.hidingDenotation.abstractDenote world
          (FMSBinderInstantiation.SupportedProc.freshenOuter body)) =
      package.restriction.denote.app world
        (.restrict body : FMSContext.SupportedProc world 0) :=
  package.hidingDenotation.canonical_restriction_freshenOuter world body

/--
The complete gate now exposes the order-theoretic divergence element
separately from nondeterministic deadlock.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (object : ωCPO) (value : package.powerdomain.monad.obj object) :
    package.powerdomain.divergence object ≤ value :=
  package.powerdomain.divergence_le object value

/--
The accepted powerdomain must be locally continuous on morphisms; an
ordinary functor record is not enough for the CPO-enriched FMS construction.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (source target : ωCPO) :
    ContinuousHom
      (ContinuousHom source target)
      (ContinuousHom
        (package.powerdomain.monad.obj source)
        (package.powerdomain.monad.obj target)) :=
  package.enrichedPowerdomain.mapHomContinuous source target

example (computation : NondeterministicComputation) :
    computation.toContinuousJoinSemilattice.bottom =
      computation.deadlock :=
  rfl

example (power : CpoPowerdomainPackage) (object : ωCPO) :
    NondeterministicComputation :=
  power.computation object

/--
The complete FMS boundary includes the world-indexed theorem needed for the
open interpretation.  The result is still conditional on a supplied package.
-/
example (package : CompleteExternalFMSTheoremPackage)
    {world : Nat}
    (left right : FMSContext.SupportedProc world 0) :
    SupportedLateCongruent left right ↔
      OpenDenotationallyEqual package.restriction left right :=
  package.worldIndexedFullAbstraction.open_full_abstraction left right

example {source target : Nat}
    {left right : FMSContext.SupportedProc source 0}
    (related : SupportedLateCongruent left right)
    (rename : Fin source → Fin target) :
    SupportedLateCongruent
      (FMSContext.SupportedProc.renameFree rename left)
      (FMSContext.SupportedProc.renameFree rename right) :=
  related.renameFree rename

example (package : CompleteExternalFMSTheoremPackage) (world : Nat) :
    Equivalence
      (fun left right : FMSContext.SupportedProc world 0 =>
        OpenDenotationallyEqual package.restriction left right) :=
  OpenDenotationallyEqual.equivalence package.restriction world

example (available : CompleteFMSAvailable)
    (left right : ClosedRaw) :
    StrongLateBisimilar left right ↔
      ∃ package : CompleteExternalFMSTheoremPackage,
        package.lateFullAbstraction.denote left =
          package.lateFullAbstraction.denote right :=
  complete_fms_available_implies_full_abstraction available left right

end Cantilune.Tests.FMSExternalPackage
