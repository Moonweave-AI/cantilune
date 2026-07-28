import Cantilune.Pi.FMSCpoUnseparatedSourceCore
import Cantilune.Pi.FMSCpoAgentRestriction
import Cantilune.Pi.FMSFiniteOperationalFullAbstraction
import Cantilune.Pi.FMSGuardedHoareTrace
import Cantilune.Pi.FMSGuardedContextualHoare
import Cantilune.Pi.OpenSMCPolarisedAdequacy

/-!
# Concrete D1-A FMS acceptance and Open-pi commutation

This file is the non-parametric acceptance point for the ratified D1-A
route.  Every operation mentioned below is the operation constructed by the
imported kernel modules:

* the all-object lower omega-Scott monad, its chosen symmetric Fubini map,
  strengths, and monad/Fubini coherence;
* the continuous-natural solution `A ≅ P (H A)`, with its initial-algebra
  and terminal-coalgebra witnesses;
* the recursively computed Table-4 restriction/hiding transformation;
* finite and guarded-recursive Hoare adequacy and full abstraction at their
  explicitly defined trace/context observations; and
* the proof-relevant strong Open-pi representatives of all fifteen
  normative event families.

The Open-pi/FMS bridge is intentionally the selected D1-A representative
theorem.  A genuine
strong native step supplies a singleton native trace and therefore concrete
membership in the lower omega-Scott trace effect.  The same representative
also supplies a step on the joint `DerivativeAlpha` quotient.  The FMS trace
carrier remains representative-level: this file does **not** assert that raw
lists of literal action names are themselves quotient-invariant.

The final no-go fields retain the exact boundaries.  D1-A is not fully
abstract for constructor-sensitive strong bisimulation, and one process
syntax cannot define every element of every omega-CPO.  These results do not
weaken the positive finite/compact and guarded Hoare theorems.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSConcreteD1AAcceptance

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoUnseparatedSourceCore
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.OpenSMCPolarisedAdequacy
open Cantilune.Pi.RecursiveActionAlpha
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cFullNativeRefinement

namespace Finite

open Cantilune.Pi.FMSFiniteOperationalFullAbstraction

end Finite

namespace Guarded

open Cantilune.Pi.FMSGuardedHoareTrace

end Guarded

/-! ## Fixed all-object semantic core -/

/-- The accepted core is definitionally the constructed all-object core. -/
abbrev acceptedCore : SourceAlignedUnseparatedCore :=
  concreteSourceAlignedUnseparatedCore

/-- The accepted monad is exactly the lower omega-Scott power monad. -/
theorem accepted_power_is_lower_omegaScott :
    acceptedCore.strongCommutative.power =
      omegaScottPowerMonad :=
  acceptedCore.strongCommutative_power

/--
The chosen Fubini map has all naturality, unit, multiplication, symmetry,
associativity, unitor, and strength coherence fields of the concrete
certificate.
-/
theorem accepted_fubini_multiplication_coherence
    (left right : ωCPO) :
    Limits.prod.map
          (acceptedCore.strongCommutative.power.μ.app left)
          (acceptedCore.strongCommutative.power.μ.app right) ≫
        acceptedCore.strongCommutative.fubini left right =
      acceptedCore.strongCommutative.fubini
          (acceptedCore.strongCommutative.power.toFunctor.obj left)
          (acceptedCore.strongCommutative.power.toFunctor.obj right) ≫
        acceptedCore.strongCommutative.power.toFunctor.map
          (acceptedCore.strongCommutative.fubini left right) ≫
        acceptedCore.strongCommutative.power.μ.app (left ⨯ right) :=
  acceptedCore.strongCommutative.multiplication_coherence left right

/-- The accepted Fubini map is symmetric on every pair of omega-CPOs. -/
theorem accepted_fubini_symmetry
    (left right : ωCPO) :
    acceptedCore.strongCommutative.fubini left right ≫
        acceptedCore.strongCommutative.power.toFunctor.map
          (Limits.prod.braiding left right).hom =
      (Limits.prod.braiding
          (acceptedCore.strongCommutative.power.toFunctor.obj left)
          (acceptedCore.strongCommutative.power.toFunctor.obj right)).hom ≫
        acceptedCore.strongCommutative.fubini right left :=
  acceptedCore.strongCommutative.symmetry_coherence left right

/-- The actual continuous-natural recursive-domain solution. -/
abbrev acceptedDomainIso :
    acceptedCore.domainCompactness.fixed.agent ≅
      ActualAgentFunctor.obj
        acceptedCore.domainCompactness.fixed.agent :=
  acceptedCore.unfoldIso

/-- The fold algebra of the accepted solution is initial. -/
def acceptedFoldIsInitial :
    IsInitial acceptedCore.domainCompactness.fixed.algebra :=
  acceptedCore.foldIsInitial

/-- The unfold coalgebra of the accepted solution is terminal. -/
def acceptedUnfoldIsTerminal :
    IsTerminal acceptedCore.domainCompactness.fixed.coalgebra :=
  acceptedCore.unfoldIsTerminal

/-! ## Actual recursive restriction/hiding -/

/--
The accepted hiding operation is the recursively computed Table-4
restriction, not a supplied map.
-/
abbrev acceptedHiding : ShiftAgent ⟶ Agent :=
  agentRestriction

/-- Accepted hiding is natural in every finite-world injection. -/
theorem accepted_hiding_world_natural
    {source target : Cantilune.Pi.FMSModel.World}
    (injection : source ⟶ target) :
    ShiftAgent.map injection ≫
        acceptedHiding.app target =
      acceptedHiding.app source ≫
        Agent.map injection :=
  agentRestriction_world_natural injection

/-- Accepted hiding satisfies the actual recursive Table-4 unroll equation. -/
theorem accepted_hiding_unroll :
    restrictionCoalgebra.str ≫
        ActualAgentFunctor.map acceptedHiding =
      acceptedHiding ≫ agentUnfold :=
  agentRestriction_unroll

/-- Terminality makes the accepted recursive hiding solution unique. -/
theorem accepted_hiding_unique
    (candidate : ShiftAgent ⟶ Agent)
    (unroll :
      restrictionCoalgebra.str ≫
          ActualAgentFunctor.map candidate =
        candidate ≫ agentUnfold) :
    candidate = acceptedHiding :=
  agentRestriction_unique candidate unroll

/-! ## Concrete finite and guarded Hoare theorem layer -/

/-- Finite Hoare adequacy for the concrete compiled source fragment. -/
theorem accepted_finite_hoare_adequacy
    (process :
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess)
    (observed :
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.Word) :
    Cantilune.Pi.FMSFiniteOperationalFullAbstraction.EffectObserves
          (Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote
            process)
          observed ↔
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.OperationalMayPrefix
        process observed :=
  Cantilune.Pi.FMSFiniteOperationalFullAbstraction.finite_hoare_adequacy
    process observed

/-- Finite Hoare full abstraction at the induced D1-A observation. -/
theorem accepted_finite_hoare_full_abstraction
    (left right :
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess) :
    Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote left =
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote right ↔
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.HoareOperationallyEquivalent
        left right :=
  Cantilune.Pi.FMSFiniteOperationalFullAbstraction.finite_hoare_full_abstraction
    left right

/-- Every finitely generated Hoare computation has a concrete source term. -/
theorem accepted_finite_hoare_definability
    (generators :
      Finset Cantilune.Pi.FMSFiniteOperationalFullAbstraction.Word) :
    ∃ process :
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess,
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote process =
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote
          generators.toList :=
  Cantilune.Pi.FMSFiniteOperationalFullAbstraction.finite_hoare_definability
    generators

/-- Guarded-recursive Hoare adequacy for every process and finite trace. -/
theorem accepted_guarded_hoare_adequacy
    (process : RecursiveProc)
    (actions : List Raw.Action) :
    WithOmegaScott.toOmegaScott
          (show EqualityOrder (List Raw.Action) from actions) ∈
        carrier
          (Cantilune.Pi.FMSGuardedHoareTrace.denote process) ↔
      ∃ target,
        Cantilune.Pi.FMSGuardedHoareTrace.NativeTrace
          process actions target :=
  Cantilune.Pi.FMSGuardedHoareTrace.guarded_hoare_adequacy
    process actions

/-- Guarded-recursive full abstraction for native finite-trace observation. -/
theorem accepted_guarded_hoare_full_abstraction
    (left right : RecursiveProc) :
    Cantilune.Pi.FMSGuardedHoareTrace.denote left =
        Cantilune.Pi.FMSGuardedHoareTrace.denote right ↔
      Cantilune.Pi.FMSGuardedHoareTrace.TraceEquivalent left right :=
  Cantilune.Pi.FMSGuardedHoareTrace.guarded_hoare_full_abstraction
    left right

/--
Contextual completion of the guarded theorem for all one-hole guarded
process contexts, including parallel, restriction, and guarded replication.
This is D1-A contextual Hoare full abstraction, not source strong-bisimulation
full abstraction.
-/
theorem accepted_guarded_contextual_hoare_full_abstraction
    (left right : RecursiveProc) :
    Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote left =
        Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote right ↔
      Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
        left right :=
  Cantilune.Pi.FMSGuardedContextualHoare.guarded_contextual_hoare_full_abstraction
    left right

/-- Contextual Hoare equivalence is a congruence for every guarded context. -/
theorem accepted_guarded_context_congruence
    {left right : RecursiveProc}
    (equivalent :
      Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
        left right)
    (frame : Cantilune.Pi.FMSGuardedContextualHoare.Context) :
    Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
      (frame.fill left) (frame.fill right) :=
  Cantilune.Pi.FMSGuardedContextualHoare.context_congruence
    equivalent frame

/--
Every guarded source term has a total interpretation in the concrete
context-indexed trace model.  This is not semantic-to-source definability.
-/
theorem accepted_guarded_contextual_source_interpretation
    (process : RecursiveProc) :
    ∃ semantic :
        Cantilune.Pi.FMSGuardedContextualHoare.ContextualModel,
      semantic =
        Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote process :=
  Cantilune.Pi.FMSGuardedContextualHoare.guarded_contextual_source_interpretation
    process

/--
Compatibility alias for the historical name.  Its quantifier direction is
source-to-semantics and must not be cited as reverse definability.
-/
theorem accepted_guarded_contextual_definability
    (process : RecursiveProc) :
    ∃ semantic :
        Cantilune.Pi.FMSGuardedContextualHoare.ContextualModel,
      semantic =
        Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote process :=
  accepted_guarded_contextual_source_interpretation process

/--
The native and trace/terminal layer separates guarded divergence from
deadlock even though the nullary powerdomain effect has one bottom.
-/
theorem accepted_guarded_divergence_deadlock_separation
    (body : RecursiveProc) :
    Cantilune.Pi.FMSGuardedHoareTrace.denote
          (.zero : RecursiveProc) =
        effectBottom
          Cantilune.Pi.FMSGuardedHoareTrace.TraceCPO ∧
      Cantilune.Pi.FMSGuardedHoareTrace.denote (.repTau body) ≠
        effectBottom
          Cantilune.Pi.FMSGuardedHoareTrace.TraceCPO ∧
      RecursiveLate.OperationalDeadlocked (.zero : RecursiveProc) ∧
      RecursiveLate.NativeDiverges (.repTau body) :=
  Cantilune.Pi.FMSGuardedHoareTrace.guarded_divergence_deadlock_separated_above_effect
    body

/-! ## Strong representative to concrete trace-effect commutation -/

/-- The concrete singleton trace point associated with one representative. -/
abbrev representativeTracePoint
    (representative : StrongRepresentative) :
    WithOmegaScott
      (EqualityOrder (List Raw.Action)) :=
  WithOmegaScott.toOmegaScott
    (show EqualityOrder (List Raw.Action) from [representative.action])

/--
Concrete one-step commutation data.  `alphaNative` lives in the operational
joint derivative-alpha quotient.  `traceMembership` is deliberately a
representative-level FMS trace fact and makes no standalone alpha-invariance
claim about literal action lists.
-/
structure RepresentativeTraceCommutation
    (representative : StrongRepresentative) : Prop where
  native :
    RecursiveLate.NativeStep
      representative.source
      representative.action
      representative.target
  alphaNative :
    RecursiveAlphaOperational.AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid representative.source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := representative.action
           target := representative.target } :
          LabelledDerivative))
  singletonTrace :
    Cantilune.Pi.FMSGuardedHoareTrace.NativeTrace
      representative.source
      [representative.action]
      representative.target
  traceMembership :
    representativeTracePoint representative ∈
      carrier
        (Cantilune.Pi.FMSGuardedHoareTrace.denote
          representative.source)

/--
Every proof-relevant strong representative constructs its concrete D1-A
trace commutation data directly from its `NativeStep`.
-/
theorem representativeTraceCommutation
    (representative : StrongRepresentative) :
    RepresentativeTraceCommutation representative where
  native := representative.native
  alphaNative := representative.alphaNative
  singletonTrace := .one representative.native
  traceMembership :=
    (accepted_guarded_hoare_adequacy
      representative.source [representative.action]).2
      ⟨representative.target, .one representative.native⟩

/--
Maximal-compatible Open-pi/FMS one-step commutation: the native step and its
joint derivative-alpha quotient image construct a concrete singleton
membership in the representative-level trace effect.
-/
theorem open_pi_fms_commutes_d1a_representative_level
    (representative : StrongRepresentative) :
    RecursiveLate.NativeStep
        representative.source
        representative.action
        representative.target ∧
      RecursiveAlphaOperational.AlphaNativeStep
        (Quotient.mk RecursiveAlpha.setoid representative.source)
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := representative.action
             target := representative.target } :
            LabelledDerivative)) ∧
      representativeTracePoint representative ∈
        carrier
          (Cantilune.Pi.FMSGuardedHoareTrace.denote
            representative.source) := by
  let commuting := representativeTraceCommutation representative
  exact
    ⟨commuting.native,
      commuting.alphaNative,
      commuting.traceMembership⟩

/-- Concrete commutation data for one of the fifteen normative families. -/
theorem normativeTraceCommutation
    (event : SourceEvent) :
    RepresentativeTraceCommutation
      (normativeRepresentative event) :=
  representativeTraceCommutation (normativeRepresentative event)

/--
All fifteen normative event representatives have a genuine strong step, a
joint derivative-alpha quotient step, and a concrete D1-A trace membership.
-/
theorem normative_open_pi_fms_commutes
    (event : SourceEvent) :
    RecursiveLate.NativeStep
        (normativeRepresentative event).source
        (normativeRepresentative event).action
        (normativeRepresentative event).target ∧
      RecursiveAlphaOperational.AlphaNativeStep
        (Quotient.mk RecursiveAlpha.setoid
          (normativeRepresentative event).source)
        (Quotient.mk DerivativeAlpha.setoid
          ({ action := (normativeRepresentative event).action
             target := (normativeRepresentative event).target } :
            LabelledDerivative)) ∧
      representativeTracePoint (normativeRepresentative event) ∈
        carrier
          (Cantilune.Pi.FMSGuardedHoareTrace.denote
            (normativeRepresentative event).source) :=
  open_pi_fms_commutes_d1a_representative_level
    (normativeRepresentative event)

/-- The commutation family is indexed by exactly fifteen event families. -/
theorem normative_commutation_family_count :
    Fintype.card SourceEvent = 15 :=
  normative_family_count

/-! ## Recorded no-go boundaries -/

/-- D1-A cannot be fully abstract for constructor-sensitive strong bisim. -/
theorem accepted_strong_bisimulation_full_abstraction_no_go
    {Carrier : Type*}
    [SemilatticeSup Carrier] [OrderBot Carrier]
    (tau : Carrier → Carrier)
    (tauMonotone : Monotone tau) :
    ¬ FMSUnseparatedFiniteStrongNoGo.StrongFullAbstract tau :=
  FMSUnseparatedFiniteStrongNoGo.not_strongFullAbstract
    tau tauMonotone

/-- The optional all-omega-CPO, all-element definability demand is false. -/
theorem accepted_all_domain_definability_no_go :
    ¬ FMSAllDomainDefinabilityNoGo.AllOmegaCpoElementsDefinable :=
  FMSAllDomainDefinabilityNoGo.not_allOmegaCpoElementsDefinable

/-! ## One fixed acceptance value, not a supplied-theorem interface -/

/--
The final acceptance package only stores equalities tying its data fields to
the constructed constants.  All load-bearing theorems are then exposed below
as ordinary theorems about this no-argument value.
-/
structure ConcreteAcceptance where
  core : SourceAlignedUnseparatedCore
  core_eq : core = acceptedCore
  restriction : ShiftAgent ⟶ Agent
  restriction_eq : restriction = acceptedHiding

/-- The actual, no-argument D1-A acceptance value. -/
def concreteAcceptance : ConcreteAcceptance where
  core := acceptedCore
  core_eq := rfl
  restriction := acceptedHiding
  restriction_eq := rfl

@[simp]
theorem concreteAcceptance_core :
    concreteAcceptance.core = acceptedCore :=
  concreteAcceptance.core_eq

@[simp]
theorem concreteAcceptance_hiding :
    concreteAcceptance.restriction = acceptedHiding :=
  concreteAcceptance.restriction_eq

theorem concreteAcceptance_finite_adequacy
    (process :
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess)
    (observed :
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.Word) :
    Cantilune.Pi.FMSFiniteOperationalFullAbstraction.EffectObserves
          (Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote
            process)
          observed ↔
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.OperationalMayPrefix
        process observed :=
  accepted_finite_hoare_adequacy process observed

theorem concreteAcceptance_finite_full_abstraction
    (left right :
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess) :
    Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote left =
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote right ↔
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.HoareOperationallyEquivalent
        left right :=
  accepted_finite_hoare_full_abstraction left right

theorem concreteAcceptance_finite_definability
    (generators :
      Finset Cantilune.Pi.FMSFiniteOperationalFullAbstraction.Word) :
    ∃ process :
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess,
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote process =
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote
          generators.toList :=
  accepted_finite_hoare_definability generators

theorem concreteAcceptance_guarded_adequacy
    (process : RecursiveProc)
    (actions : List Raw.Action) :
    WithOmegaScott.toOmegaScott
          (show EqualityOrder (List Raw.Action) from actions) ∈
        carrier
          (Cantilune.Pi.FMSGuardedHoareTrace.denote process) ↔
      ∃ target,
        Cantilune.Pi.FMSGuardedHoareTrace.NativeTrace
          process actions target :=
  accepted_guarded_hoare_adequacy process actions

theorem concreteAcceptance_guarded_full_abstraction
    (left right : RecursiveProc) :
    Cantilune.Pi.FMSGuardedHoareTrace.denote left =
        Cantilune.Pi.FMSGuardedHoareTrace.denote right ↔
      Cantilune.Pi.FMSGuardedHoareTrace.TraceEquivalent left right :=
  accepted_guarded_hoare_full_abstraction left right

theorem concreteAcceptance_guarded_contextual_full_abstraction
    (left right : RecursiveProc) :
    Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote left =
        Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote right ↔
      Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
        left right :=
  accepted_guarded_contextual_hoare_full_abstraction left right

theorem concreteAcceptance_guarded_context_congruence
    {left right : RecursiveProc}
    (equivalent :
      Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
        left right)
    (frame : Cantilune.Pi.FMSGuardedContextualHoare.Context) :
    Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
      (frame.fill left) (frame.fill right) :=
  accepted_guarded_context_congruence equivalent frame

/--
The concrete acceptance package's honest source-to-contextual-semantics
interpretation theorem.
-/
theorem concreteAcceptance_guarded_contextual_source_interpretation
    (process : RecursiveProc) :
    ∃ semantic :
        Cantilune.Pi.FMSGuardedContextualHoare.ContextualModel,
      semantic =
        Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote process :=
  accepted_guarded_contextual_source_interpretation process

/--
Compatibility alias for the historical name.  This is source interpretation,
not semantic-to-source definability.
-/
theorem concreteAcceptance_guarded_contextual_definability
    (process : RecursiveProc) :
    ∃ semantic :
        Cantilune.Pi.FMSGuardedContextualHoare.ContextualModel,
      semantic =
        Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote process :=
  concreteAcceptance_guarded_contextual_source_interpretation process

theorem concreteAcceptance_normative_commutation
    (event : SourceEvent) :
    RepresentativeTraceCommutation
      (normativeRepresentative event) :=
  normativeTraceCommutation event

theorem concreteAcceptance_strong_no_go
    {Carrier : Type*}
    [SemilatticeSup Carrier] [OrderBot Carrier]
    (tau : Carrier → Carrier)
    (tauMonotone : Monotone tau) :
    ¬ FMSUnseparatedFiniteStrongNoGo.StrongFullAbstract tau :=
  accepted_strong_bisimulation_full_abstraction_no_go
    tau tauMonotone

theorem concreteAcceptance_all_domain_no_go :
    ¬ FMSAllDomainDefinabilityNoGo.AllOmegaCpoElementsDefinable :=
  accepted_all_domain_definability_no_go

end Cantilune.Pi.FMSConcreteD1AAcceptance
