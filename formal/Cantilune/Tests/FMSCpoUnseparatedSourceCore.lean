import Cantilune.Pi.FMSCpoUnseparatedSourceCore

/-!
Kernel regression checks for the source-aligned unseparated FMS core.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoUnseparatedSourceCore

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoUnseparatedSourceCore

universe u

/-- The D1-A acceptance package is concretely inhabited. -/
example : Nonempty SourceAlignedUnseparatedCore :=
  ⟨concreteSourceAlignedUnseparatedCore⟩

/-- The effect-level divergence/deadlock collapse is theorem-level data. -/
example (object : ωCPO.{u}) :
    effectDivergence object = effectDeadlock object :=
  effectDivergence_eq_effectDeadlock object

/-- Direct image preserves the single nullary computation on all objects. -/
example
    {source target : Type}
    [OmegaCompletePartialOrder source]
    [OmegaCompletePartialOrder target]
    (morphism : source →𝒄 target) :
    mapRaw morphism (⊥ : OmegaScottPower source) =
      (⊥ : OmegaScottPower target) :=
  concreteSourceAlignedUnseparatedCore.effectLaws.map_bottom morphism

/-- The accepted domain witness is a genuine continuous-natural isomorphism. -/
example :
    concreteSourceAlignedUnseparatedCore.domainCompactness.fixed.agent ≅
      Cantilune.Pi.FMSCpoActualDomainEquationBoundary.ActualAgentFunctor.obj
        concreteSourceAlignedUnseparatedCore.domainCompactness.fixed.agent :=
  concreteSourceAlignedUnseparatedCore.unfoldIso

/-- The complete-join boundary provides a real universal extension. -/
example
    {source target : Type u}
    [OmegaCompletePartialOrder source]
    [CompleteLattice target]
    (generator : source →𝒄 target)
    (value : source) :
    completeJoinExtension generator (principalRaw value) =
      generator value :=
  completeJoinExtension_principal generator value

end Cantilune.Tests.FMSCpoUnseparatedSourceCore
