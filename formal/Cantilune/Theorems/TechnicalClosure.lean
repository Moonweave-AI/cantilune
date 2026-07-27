import Cantilune.Core.TerminalPartition
import Cantilune.Feedback.CompleteFiniteHeightClosure
import Cantilune.Pi.FMSConcreteD1AAcceptance
import Cantilune.Pi.FMSActualAgentNormativeCommutation
import Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
import Cantilune.Pi.FMSActualAgentPrefixFullAbstraction
import Cantilune.Pi.FMSMaximumCompatibleClosure
import Cantilune.Pi.FMSGuardedContextualComposition
import Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence
import Cantilune.Pi.FMSCpoOmegaScottWorldMonad
import Cantilune.Pi.FMSCpoSupportHidingCoherence
import Cantilune.Pi.FMSCpoSupportedParallelRestriction
import Cantilune.Pi.OpenSMCPolarisedHomBridge
import Cantilune.Pi.OpenSMCPolarisedProofCarrying
import Cantilune.Pi.P1cOperationRegistry
import Cantilune.Projection.CanonicalDAGTarget
import Cantilune.Theorems.CoreConformance
import Cantilune.Theorems.P1aProjectionScopeClosure
import Cantilune.Theorems.ProductCommonTrajectoryCertificate
import Cantilune.Theorems.ProductProtocolTrajectoryBridge
import Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory
import Cantilune.Theorems.SubstantiveProtocolTrajectoryBridge
import Cantilune.Theorems.SubstantiveReconnectConformance
import Cantilune.Theorems.SubstantiveReconnectCommonFMSTrajectory

/-!
# Final technical-closure aggregation

This module is the kernel-facing aggregation boundary for the ratified
generic-core scope.

There are two deliberately different theorems.

* `generic_technical_closure` is parameterised by a complete
  `CoreConformancePackage`.  It expands the package back into the native
  occurrence/replay, rank, resource/session, four projection, authorization,
  stable/fair probability, and cross-epoch conclusions from which it was
  built.  It does not manufacture a product package from a product name.
* `reference_technical_closure` is a no-argument anti-vacuity theorem.  Its
  admission and fixed-epoch rule use the same substantive reconnect
  occurrence.

The semantic boundary is explicit.  D1-A full abstraction below is the
constructed Hoare/contextual-Hoare result.  The finite strong-bisimulation
no-go and the all-omega-CPO definability no-go are retained as fields; neither
is silently re-labelled as a positive theorem.  The Open-pi category is the
presented typed/polarised category, while native representatives carry the
strong late-pi steps.  The raw structural identity obstruction is retained.

The aggregation includes an actual recursive-Agent full-abstraction theorem
only for the deterministic typed tau/free-output prefix trie, together with
its syntax-first compact realization and guarded-tau omega-limit.  The general
guarded-recursive result remains exactly the separately typed
finite-trace/contextual-Hoare theorem.  Neither field is reinterpreted as
unrestricted source strong-bisimulation full abstraction.

No inhabitant for any of the eight production packages is defined here.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Theorems.TechnicalClosure

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Core
open Cantilune.Feedback.EventTrajectory.FiniteDiscrete
open Cantilune.Feedback.ProductCommonFMSTrajectory
open Cantilune.Feedback.Probability
open Cantilune.Feedback.StochasticExecution.FiniteDiscrete
open Cantilune.Pi
open Cantilune.Pi.FMSActualAgentNormativeCommutation
open Cantilune.Pi.FMSActualAgentNormativeOperationalBridge
open Cantilune.Pi.FMSActualAgentPrefixFullAbstraction
open Cantilune.Pi.FMSConcreteD1AAcceptance
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSMaximumCompatibleClosure
open Cantilune.Pi.FMSCpoNondeterministicCategory
open Cantilune.Pi.FMSCpoNondeterministicGlobalConsequences
open Cantilune.Pi.FMSCpoNondeterministicGlobalSolutionSet
open Cantilune.Pi.FMSCpoNondeterministicSolutionSet
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottChosenCoherence
open Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence
open Cantilune.Pi.FMSCpoOmegaScottWorldMonad
open Cantilune.Pi.FMSCpoSupportHidingCoherence
open Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra
open Cantilune.Pi.FMSCpoSupportedParallelRestriction
open Cantilune.Pi.FMSCpoUnseparatedSourceCore
open Cantilune.Pi.FMSGuardedContextualComposition
open Cantilune.Pi.OpenSMCPolarisedHomBridge
open Cantilune.Pi.OpenSMCPolarisedAdequacy
open Cantilune.Pi.OpenSMCPolarisedOperational
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.P1cOperationRegistry
open Cantilune.Theorems.CoreConformance
open Cantilune.Theorems.HeterogeneousProductRuleAdmission
open Cantilune.Theorems.ProductProtocolTrajectoryBridge
open Cantilune.Theorems.ProductCommonTrajectoryCertificate
open Cantilune.Theorems.ProductRuleAdmission
open Cantilune.Theorems.ProductRuleProofBundle

universe u v w

/-! ## Global, no-argument semantic boundary -/

/-- The exact success/wait/deadlock partition proposition. -/
def ExactTerminalPartition (lts : ObservableLTS) (state : lts.State) : Prop :=
  lts.Normal state ↔
    (lts.SuccessfulTermination state ∨
      lts.ExternalWait state ∨
      lts.Deadlocked state) ∧
    (¬(lts.SuccessfulTermination state ∧ lts.ExternalWait state)) ∧
    (¬(lts.SuccessfulTermination state ∧ lts.Deadlocked state)) ∧
    ¬(lts.ExternalWait state ∧ lts.Deadlocked state)

/--
The complete presented-SMC/raw-representative boundary.

The coherence fields are equations in the presented category.  The last
field proves that no positive-prefix raw process can be its structural
identity under the selected alpha/ACU/scope congruence.
-/
structure PresentedOpenPiBoundary : Prop where
  totalIdentityRealization :
    ∀ object : Object,
      Nonempty
        (Σ process : RecursiveProc,
          HomRealizes (identity object) process)
  identities :
    ∀ {source target : Object} (process : Hom source target),
      comp (identity source) process = process ∧
        comp process (identity target) = process
  compositionAndTensor :
    ∀ {a b c d e f g : Object}
      (first : Hom a b) (second : Hom b c) (third : Hom c d)
      (left₁ : Hom a b) (left₂ : Hom b c)
      (right₁ : Hom e f) (right₂ : Hom f g),
      comp (comp first second) third =
          comp first (comp second third) ∧
        comp (parallel left₁ right₁) (parallel left₂ right₂) =
          parallel (comp left₁ left₂) (comp right₁ right₂)
  globalCoherence :
    ∀ a b c d : Object,
      (comp
          (associator (tensorObject a b) c d)
          (associator a b (tensorObject c d)) =
        comp
          (comp
            (parallel (associator a b c) (identity d))
            (associator a (tensorObject b c) d))
          (parallel (identity a) (associator b c d))) ∧
      (parallel (rightUnitor a) (identity b) =
        comp
          (associator a (ofPorts []) b)
          (parallel (identity a) (leftUnitor b))) ∧
      (comp
          (comp
            (associator a b c)
            (braid a (tensorObject b c)))
          (associator b c a) =
        comp
          (comp
            (parallel (braid a b) (identity c))
            (associator b a c))
          (parallel (identity b) (braid a c)))
  rawIdentityNoGo :
    ∀ middle : Name,
      ¬ Nonempty (PositivePrefixRawStructuralIdentity middle)

/-- The fixed presented Open-pi boundary is kernel constructed. -/
theorem presentedOpenPiBoundary : PresentedOpenPiBoundary where
  totalIdentityRealization :=
    every_identity_has_operational_realization
  identities := presented_identity_coherent
  compositionAndTensor := presented_composition_tensor_coherent
  globalCoherence := presented_global_smc_coherent
  rawIdentityNoGo := no_positive_prefix_raw_structural_identity

/--
Complete CENTRAL-10 boundary.

The presented equations, the proof-carrying typed/polarised Hom layer, and
the genuine native tensor/plug/hide/restriction bridge are one record.  This
is stronger than exposing the erased presented quotient alone: every Hom in
the proof-carrying component stores its exact payload/polarity profiles.
-/
structure CompleteOpenPiSMCOperationalBoundary where
  presented : PresentedOpenPiBoundary
  proofCarrying :
    Cantilune.Pi.OpenSMCPolarisedProofCarrying.ProofCarryingOpenPiAcceptance
  operational : HomOperationalBridgeAcceptance
  proofCarryingExact :
    proofCarrying =
      Cantilune.Pi.OpenSMCPolarisedProofCarrying.proofCarryingOpenPiAcceptance
  operationalExact :
    operational = homOperationalBridgeAcceptance

/-- Kernel-built algebraic and genuine-native Open-pi SMC boundary. -/
def completeOpenPiSMCOperationalBoundary :
    CompleteOpenPiSMCOperationalBoundary where
  presented := presentedOpenPiBoundary
  proofCarrying :=
    Cantilune.Pi.OpenSMCPolarisedProofCarrying.proofCarryingOpenPiAcceptance
  operational := homOperationalBridgeAcceptance
  proofCarryingExact := rfl
  operationalExact := rfl

/--
The positive operational boundary of the accepted D1-A model.

Every equivalence below names its observation explicitly.  In particular,
the full-abstraction fields are finite Hoare, guarded finite-trace Hoare, and
guarded contextual-Hoare results.
-/
structure D1AOperationalAcceptance : Prop where
  finiteAdequacy :
    ∀ (process :
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess)
      (observed :
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.Word),
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.EffectObserves
          (Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote
            process)
          observed ↔
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.OperationalMayPrefix
          process observed
  finiteFullAbstraction :
    ∀ left right :
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess,
      Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote left =
          Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote right ↔
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.HoareOperationallyEquivalent
          left right
  finiteDefinability :
    ∀ generators :
        Finset Cantilune.Pi.FMSFiniteOperationalFullAbstraction.Word,
      ∃ process :
          Cantilune.Pi.FMSFiniteOperationalFullAbstraction.FiniteProcess,
        Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote process =
          Cantilune.Pi.FMSFiniteOperationalFullAbstraction.hoareDenote
            generators.toList
  guardedAdequacy :
    ∀ (process : RecursiveProc) (actions : List Raw.Action),
      Cantilune.Pi.FMSCpoOmegaScottPower.WithOmegaScott.toOmegaScott
            (show EqualityOrder (List Raw.Action) from actions) ∈
          Cantilune.Pi.FMSCpoOmegaScottPower.carrier
            (Cantilune.Pi.FMSGuardedHoareTrace.denote process) ↔
        ∃ target,
          Cantilune.Pi.FMSGuardedHoareTrace.NativeTrace
            process actions target
  guardedFullAbstraction :
    ∀ left right : RecursiveProc,
      Cantilune.Pi.FMSGuardedHoareTrace.denote left =
          Cantilune.Pi.FMSGuardedHoareTrace.denote right ↔
        Cantilune.Pi.FMSGuardedHoareTrace.TraceEquivalent left right
  contextualFullAbstraction :
    ∀ left right : RecursiveProc,
      Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote left =
          Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote right ↔
        Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
          left right
  contextualCongruence :
    ∀ {left right : RecursiveProc},
      Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
          left right →
        ∀ frame : Cantilune.Pi.FMSGuardedContextualHoare.Context,
          Cantilune.Pi.FMSGuardedContextualHoare.ContextuallyEquivalent
            (frame.fill left) (frame.fill right)
  contextualSourceInterpretation :
    ∀ process : RecursiveProc,
      ∃ semantic :
          Cantilune.Pi.FMSGuardedContextualHoare.ContextualModel,
        semantic =
          Cantilune.Pi.FMSGuardedContextualHoare.contextualDenote process
  divergenceDeadlockSeparatedAboveEffect :
    ∀ body : RecursiveProc,
      Cantilune.Pi.FMSGuardedHoareTrace.denote
            (.zero : RecursiveProc) =
          Cantilune.Pi.FMSCpoUnseparatedSourceCore.effectBottom
            Cantilune.Pi.FMSGuardedHoareTrace.TraceCPO ∧
        Cantilune.Pi.FMSGuardedHoareTrace.denote (.repTau body) ≠
          Cantilune.Pi.FMSCpoUnseparatedSourceCore.effectBottom
            Cantilune.Pi.FMSGuardedHoareTrace.TraceCPO ∧
        RecursiveLate.OperationalDeadlocked (.zero : RecursiveProc) ∧
        RecursiveLate.NativeDiverges (.repTau body)

/-- Positive D1-A consequences, at their exact Hoare observations. -/
theorem d1aOperationalAcceptance : D1AOperationalAcceptance where
  finiteAdequacy := concreteAcceptance_finite_adequacy
  finiteFullAbstraction := concreteAcceptance_finite_full_abstraction
  finiteDefinability := concreteAcceptance_finite_definability
  guardedAdequacy := concreteAcceptance_guarded_adequacy
  guardedFullAbstraction := concreteAcceptance_guarded_full_abstraction
  contextualFullAbstraction :=
    concreteAcceptance_guarded_contextual_full_abstraction
  contextualCongruence := by
    intro left right equivalent frame
    exact
      concreteAcceptance_guarded_context_congruence equivalent frame
  contextualSourceInterpretation :=
    Cantilune.Pi.FMSGuardedContextualHoare.guarded_contextual_source_interpretation
  divergenceDeadlockSeparatedAboveEffect :=
    accepted_guarded_divergence_deadlock_separation

/-!
## Exact positive actual-Agent boundary

The general guarded Hoare theorem above deliberately does not identify its
trace carrier with the recursive FMS `Agent`.  The following package records
the independently constructed positive theorem that does live in that
recursive carrier.  Its source scope is stated in the types: deterministic
typed tau/free-output prefix tries, their constructive compact points, and
the guarded tau omega-chain.  No field widens that result to arbitrary
branching or to source strong bisimilarity.
-/

/-- Kernel-built actual-Agent adequacy/full abstraction at its exact scope. -/
structure ActualAgentPrefixBoundary : Prop where
  nativeAdequacy :
    ∀ {world depth : Nat}
      (trie : PrefixTrie world depth)
      (word : PrefixWord world),
      AgentObserves trie.denote word ↔ trie.NativeObserves word
  fullAbstraction :
    ∀ {world leftDepth rightDepth : Nat}
      (left : PrefixTrie world leftDepth)
      (right : PrefixTrie world rightDepth),
      left.denote = right.denote ↔
        PrefixOperationallyEquivalent left right
  compactRealization :
    ∀ {world : Nat} (point : CompactPrefixPoint world),
      Cantilune.Pi.FMSCpoSupportedActualAgent.supportedDenote.app
          world point.compile =
        point.realize
  guardedTauFiniteObservation :
    ∀ word : PrefixWord 0,
      AgentObserves guardedTauLimit word ↔
        ∃ depth,
          (guardedTauApprox depth).NativeObserves word
  guardedTauFixed :
    Cantilune.Pi.FMSCpoAgentOperationalBridge.fixedTauAgent
        0 guardedTauLimit =
      guardedTauLimit
  guardedTauNonInactive :
    guardedTauLimit ≠
      Cantilune.Pi.FMSCpoAgentOperationalBridge.fixedInactive 0
  sameHeadBranchingNoGo :
    principalRaw
          (leftContinuation ⊔ rightContinuation) ≠
        principalRaw leftContinuation ⊔
          principalRaw rightContinuation
  sameHeadMayCollapse :
    ∀ observed : Bool,
      TwoPointMay
          (principalRaw
            (leftContinuation ⊔ rightContinuation))
          observed ↔
        TwoPointMay
          (principalRaw leftContinuation ⊔
            principalRaw rightContinuation)
          observed

/-- The no-argument exact actual-Agent prefix theorem package. -/
theorem actualAgentPrefixBoundary : ActualAgentPrefixBoundary where
  nativeAdequacy := actualAgent_native_prefix_adequacy
  fullAbstraction := actualAgent_prefix_full_abstraction
  compactRealization := compactPrefix_compile_denote
  guardedTauFiniteObservation := guardedTau_limit_finite_observation
  guardedTauFixed := guardedTauLimit_fixed
  guardedTauNonInactive := guardedTauLimit_ne_inactive
  sameHeadBranchingNoGo := concrete_same_head_branching_no_go
  sameHeadMayCollapse := concrete_same_head_may_equivalent

/-!
## Total finite-control operational coalgebra and actual-Agent commutation

The deterministic prefix result above is not used as a substitute for the
full finite-control coalgebra.  The following package records the latter's
unfold equation and terminal-coalgebra uniqueness.  The separately named
commutation theorem then connects every one of the fifteen compiled
normative event representatives to the independently specified actual-Agent
source, target, and terminal endpoints.
-/

/-- Kernel-built total finite-control supported operational coalgebra. -/
structure TotalSupportedOperationalBoundary : Prop where
  unroll :
    totalSupportedOneStep ≫
        ActualAgentFunctor.map totalSupportedDenote =
      totalSupportedDenote ≫
        Cantilune.Pi.FMSCpoAgentRestriction.agentUnfold
  unique :
    ∀ candidate :
        Cantilune.Pi.FMSCpoContext.processCpoModel ⟶
          Cantilune.Pi.FMSCpoAgentRestriction.Agent,
      totalSupportedOneStep ≫ ActualAgentFunctor.map candidate =
          candidate ≫
            Cantilune.Pi.FMSCpoAgentRestriction.agentUnfold →
        candidate = totalSupportedDenote

/-- The total syntax coalgebra is the unique mediator into actual `Agent`. -/
theorem totalSupportedOperationalBoundary :
    TotalSupportedOperationalBoundary where
  unroll := totalSupportedDenote_unroll
  unique := totalSupportedDenote_unique

/--
Strong operational/FMS commutation for all fifteen normative event families.

This is the actual typed-syntax-to-`Agent` theorem.  Its `pointed` component
contains the genuine strong late-pi step and the alpha/derivative-alpha
boundary; its remaining fields are exact actual-Agent endpoint equalities.
-/
theorem open_pi_fms_commutes :
    ∀ event : Cantilune.Pi.P1cMatrix.SourceEvent,
      TotalCompiledNormativeCommutation event :=
  totalCompiledNormativeCommutation

/--
The global theory shared by every conforming product package.

`d1a` is the concrete all-object lower-omega-Scott/domain-equation/hiding
acceptance.  Positive full-abstraction fields are intentionally not restated
as strong-bisimulation facts: the concrete acceptance theorems retain their
Hoare and contextual-Hoare observation types.
-/
structure GlobalTheory where
  maximumFMS : MaximumCompatibleFMS
  maximumFMSExact : maximumFMS = maximumCompatibleFMS
  d1a : ConcreteAcceptance
  d1aExact : d1a = concreteAcceptance
  d1aOperational : D1AOperationalAcceptance
  actualAgentPrefix : ActualAgentPrefixBoundary
  totalSupportedOperational : TotalSupportedOperationalBoundary
  contextualHiding : ContextualHidingCoherenceAcceptance
  openPi : PresentedOpenPiBoundary
  homOperationalBridge : HomOperationalBridgeAcceptance
  normativeCommutation :
    ∀ event : Cantilune.Pi.P1cMatrix.SourceEvent,
      RepresentativeTraceCommutation
        (normativeRepresentative event)
  normativeActualAgentCommutation :
    ∀ event : Cantilune.Pi.P1cMatrix.SourceEvent,
      TotalCompiledNormativeCommutation event
  normativeFamilyCount :
    Fintype.card Cantilune.Pi.P1cMatrix.SourceEvent = 15
  registryStrong :
    ∀ index : OperationId,
      Late.NativeStep
        (readyProcess (familyAt index))
        (firstAction (familyAt index))
        (firstTarget (familyAt index))
  p1b :
    ProjectionCertificate
      Cantilune.Pi.Certificates.RequestAccept.sourceLTS
      Cantilune.Pi.Late.structuralLateLTS
  p1c :
    ProjectionCertificate
      Cantilune.Pi.P1cFullNativeRefinement.sourceLTS
      Cantilune.Pi.P1cFullNativeRefinement.targetLTS
  feedback :
    Cantilune.Feedback.CompleteFiniteHeightClosure.AuthorizedReference.Witness
      Cantilune.Theorems.SubstantiveReconnectConformance.newSignature
  terminalPartition :
    ∀ (lts : ObservableLTS) (state : lts.State),
      ExactTerminalPartition lts state
  strongBisimulationNoGo :
    ¬ Cantilune.Pi.FMSUnseparatedFiniteStrongNoGo.StrongFullAbstract
        (id : Prop → Prop)
  allDomainDefinabilityNoGo :
    ¬ Cantilune.Pi.FMSAllDomainDefinabilityNoGo.AllOmegaCpoElementsDefinable

/-- The no-argument global theorem package. -/
def globalTheory : GlobalTheory where
  maximumFMS := maximumCompatibleFMS
  maximumFMSExact := rfl
  d1a := concreteAcceptance
  d1aExact := rfl
  d1aOperational := d1aOperationalAcceptance
  actualAgentPrefix := actualAgentPrefixBoundary
  totalSupportedOperational := totalSupportedOperationalBoundary
  contextualHiding := contextualHidingCoherenceAccepted
  openPi := presentedOpenPiBoundary
  homOperationalBridge := homOperationalBridgeAcceptance
  normativeCommutation := concreteAcceptance_normative_commutation
  normativeActualAgentCommutation := open_pi_fms_commutes
  normativeFamilyCount := by decide
  registryStrong := registry_has_genuine_strong_step
  p1b := Cantilune.Pi.P1bNominalIncidenceClosure.pi_ra_certificate
  p1c := Cantilune.Pi.P1cFullNativeRefinement.certificate
  feedback :=
    Cantilune.Feedback.CompleteFiniteHeightClosure.AuthorizedReference.witness
      Cantilune.Theorems.SubstantiveReconnectConformance.newSignature
  terminalPartition := by
    intro lts state
    exact lts.terminal_exactly_one_iff_normal state
  strongBisimulationNoGo := by
    exact
      concreteAcceptance_strong_no_go
        (id : Prop → Prop) monotone_id
  allDomainDefinabilityNoGo :=
    concreteAcceptance_all_domain_no_go

/-!
## Complete no-argument FMS closure

`open_pi_fms_commutes` is intentionally the focused operational theorem for
the fifteen normative representatives.  It is not, by itself, the complete
FMS result.  The following proposition is the load-bearing aggregate used by
the central manifest.  Its conclusion names the constructed all-object
omega-Scott monad and full Fubini record, the continuous-natural recursive
domain solution and its universal properties, recursive and contextual
hiding, the finite/guarded contextual Hoare theorems, both concrete
commutation layers, and every accepted no-go boundary.

In particular, the final three fields make the maximum-compatible boundary
part of the theorem rather than prose: the separated canonical sequential
Fubini is not symmetric, the selected D1-A effect identifies its two nullary
effects, and neither strong-bisimulation full abstraction nor all-object
definability is silently claimed.
-/

/--
The maximum-compatible kernel-facing FMS closure at the ratified D1-A
boundary.

The equality to `omegaScottUnseparatedStrongCommutativeMonad` carries the
record's naturality, unit, multiplication, symmetry, associativity, unitor,
and both strength coherence laws.  The two following fields expose the most
load-bearing multiplication and symmetry equations directly as well.

This is deliberately a branch ledger, not a theorem identifying the
separated enriched-adjunction branch with the unseparated D1-A branch.  The
kernel no-go fields and the observation-specific adequacy fields are part of
the record so downstream text cannot silently strengthen it to source-paper
strong-bisimulation full abstraction.
-/
structure MaximumCompatibleD1AFMSClosure : Prop where
  maximumCompatibleLedger :
    ∃ ledger : MaximumCompatibleFMS,
      ledger = maximumCompatibleFMS
  concreteAcceptanceLedger :
    ∃ acceptance : ConcreteAcceptance,
      acceptance = concreteAcceptance
  separatedAllSourceEnriched :
    ∃ solution :
        SolutionSetCondition.{0} SolutionSet.carrierFunctor,
      Nonempty
        (Cantilune.Pi.FMSCpoNondeterministicEnrichedAdjunction.NDωCPO.CpoEnrichedFreeForgetAdjunction
          solution)
  allObjectStrongCommutativeExact :
    acceptedCore.strongCommutative =
      omegaScottUnseparatedStrongCommutativeMonad
  lowerOmegaScottMonadExact :
    acceptedCore.strongCommutative.power =
      omegaScottPowerMonad
  fubiniMultiplicationCoherence :
    ∀ left right : ωCPO,
      Limits.prod.map
            (acceptedCore.strongCommutative.power.μ.app left)
            (acceptedCore.strongCommutative.power.μ.app right) ≫
          acceptedCore.strongCommutative.fubini left right =
        acceptedCore.strongCommutative.fubini
            (acceptedCore.strongCommutative.power.toFunctor.obj left)
            (acceptedCore.strongCommutative.power.toFunctor.obj right) ≫
          acceptedCore.strongCommutative.power.toFunctor.map
            (acceptedCore.strongCommutative.fubini left right) ≫
          acceptedCore.strongCommutative.power.μ.app (left ⨯ right)
  fubiniSymmetry :
    ∀ left right : ωCPO,
      acceptedCore.strongCommutative.fubini left right ≫
          acceptedCore.strongCommutative.power.toFunctor.map
            (Limits.prod.braiding left right).hom =
        (Limits.prod.braiding
            (acceptedCore.strongCommutative.power.toFunctor.obj left)
          (acceptedCore.strongCommutative.power.toFunctor.obj right)).hom ≫
          acceptedCore.strongCommutative.fubini right left
  worldMonadExact :
    Cantilune.Pi.FMSCpoOmegaScottWorldMonad.omegaScottWorldMonad.{0} =
      Cantilune.Pi.FMSPointwiseCpoMonad.pointwiseCpoMonad
        (I := Cantilune.Pi.FMSModel.World)
        omegaScottPowerMonad.{0}
  worldFubiniNaturality :
    ∀ (left right :
        Cantilune.Pi.FMSCpoOmegaScottWorldMonad.WorldModel.{0})
      {source target : Cantilune.Pi.FMSModel.World}
      (injection : source ⟶ target)
      (leftValues : OmegaScottPower (left.obj source))
      (rightValues : OmegaScottPower (right.obj source)),
      mapRaw
          (Cantilune.Pi.FMSCpoOmegaScottStrength.productMap
            (left.map injection) (right.map injection))
          (Cantilune.Pi.FMSCpoOmegaScottStrength.fubiniRaw
            leftValues rightValues) =
        Cantilune.Pi.FMSCpoOmegaScottStrength.fubiniRaw
          (mapRaw (left.map injection) leftValues)
          (mapRaw (right.map injection) rightValues)
  worldAllocationFubiniCoherence :
    ∀ (left right :
        Cantilune.Pi.FMSCpoOmegaScottWorldMonad.WorldModel.{0}),
      Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.pointwiseProductMap
          (omegaScottWorldPower.map
            (Cantilune.Pi.FMSCpoWorld.allocate left))
          (omegaScottWorldPower.map
            (Cantilune.Pi.FMSCpoWorld.allocate right)) ≫
          pointwiseFubini
            (Cantilune.Pi.FMSCpoWorld.shift.obj left)
            (Cantilune.Pi.FMSCpoWorld.shift.obj right) =
        pointwiseFubini left right ≫
          omegaScottWorldPower.map
            (Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.pointwiseProductMap
              (Cantilune.Pi.FMSCpoWorld.allocate left)
              (Cantilune.Pi.FMSCpoWorld.allocate right))
  supportPowerHidingUnitCoherence :
    Cantilune.Pi.FMSCpoWorld.shift.map
          (omegaScottWorldMonad.η.app supportModel) ≫
        supportPowerHiding =
      Cantilune.Pi.FMSCpoWorld.supportHiding ≫
        omegaScottWorldMonad.η.app supportModel
  supportPowerHidingMultiplicationCoherence :
    Cantilune.Pi.FMSCpoWorld.shift.map
          (omegaScottWorldMonad.μ.app supportModel) ≫
        supportPowerHiding =
      Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.powerHiding
          supportPowerHiding ≫
        omegaScottWorldMonad.μ.app supportModel
  supportPowerHidingFubiniCoherence :
    Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.pointwiseProductMap
          supportPowerHiding supportPowerHiding ≫
        pointwiseFubini supportModel supportModel =
      Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.pointwiseProductMap
            (Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.shiftPowerIso.hom.app
              supportModel)
            (Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.shiftPowerIso.hom.app
              supportModel) ≫
          pointwiseFubini
            (Cantilune.Pi.FMSCpoWorld.shift.obj supportModel)
            (Cantilune.Pi.FMSCpoWorld.shift.obj supportModel) ≫
          omegaScottWorldPower.map
            (Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.pointwiseProductMap
              Cantilune.Pi.FMSCpoWorld.supportHiding
              Cantilune.Pi.FMSCpoWorld.supportHiding)
  poweredSupportDenotationHiding :
    Cantilune.Pi.FMSCpoWorld.allocate
          Cantilune.Pi.FMSCpoContext.processCpoModel ≫
        Cantilune.Pi.FMSCpoWorld.shift.map
          poweredSupportDenotation ≫
        supportPowerHiding =
      poweredSupportDenotation
  continuousNaturalRecursiveSolution :
    ∃ solution :
        acceptedCore.domainCompactness.fixed.agent ≅
          ActualAgentFunctor.obj
            acceptedCore.domainCompactness.fixed.agent,
      solution = acceptedDomainIso
  recursiveFoldInitial :
    Nonempty
      (CategoryTheory.Limits.IsInitial
        acceptedCore.domainCompactness.fixed.algebra)
  recursiveUnfoldTerminal :
    Nonempty
      (CategoryTheory.Limits.IsTerminal
        acceptedCore.domainCompactness.fixed.coalgebra)
  recursiveHidingWorldNatural :
    ∀ {source target : Cantilune.Pi.FMSModel.World}
      (injection : source ⟶ target),
      ShiftAgent.map injection ≫
          acceptedHiding.app target =
        acceptedHiding.app source ≫
          Agent.map injection
  recursiveHidingUnroll :
    restrictionCoalgebra.str ≫
          ActualAgentFunctor.map acceptedHiding =
      acceptedHiding ≫ agentUnfold
  recursiveHidingUnique :
    ∀ (candidate : ShiftAgent ⟶ Agent),
      restrictionCoalgebra.str ≫
            ActualAgentFunctor.map candidate =
          candidate ≫ agentUnfold →
      candidate = acceptedHiding
  supportedRecursiveRestrictionCoherence :
    ∀ (world : Cantilune.Pi.FMSModel.World)
      (body :
        Cantilune.Pi.FMSContext.SupportedProc world 1),
      agentUnfold.app world
          (Cantilune.Pi.FMSCpoSupportedActualAgent.supportedRestrictionDenote
            world body) =
        (ActualAgentFunctor.map acceptedHiding).app world
          (Cantilune.Pi.FMSCpoAgentRestriction.actionRestrictionKleisli world
            (agentUnfold.app (world + 1)
              (Cantilune.Pi.FMSCpoSupportedActualAgent.supportedDenote.app
                (world + 1)
                (Cantilune.Pi.FMSBinderInstantiation.SupportedProc.freshenOuter
                  body))))
  contextualHidingCoherence :
    ContextualHidingCoherenceAcceptance
  finiteGuardedContextualHoare :
    D1AOperationalAcceptance
  actualAgentPrefix :
    ActualAgentPrefixBoundary
  totalActualAgentCoalgebra :
    TotalSupportedOperationalBoundary
  representativeTraceCommutation :
    ∀ event : Cantilune.Pi.P1cMatrix.SourceEvent,
      RepresentativeTraceCommutation
        (normativeRepresentative event)
  actualAgentCommutation :
    ∀ event : Cantilune.Pi.P1cMatrix.SourceEvent,
      TotalCompiledNormativeCommutation event
  exactNormativeFamilyCount :
    Fintype.card Cantilune.Pi.P1cMatrix.SourceEvent = 15
  separatedSequentialFubiniNoGo :
    ∀ object : ωCPO,
      ¬
        (ContinuousHom.comp
            (sequentialFubini object object)
            (Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.explicitSwap
              ((SolutionSet.ordinaryMonadOfSolutionSet
                Global.carrier_solutionSetCondition).obj object)
              ((SolutionSet.ordinaryMonadOfSolutionSet
                Global.carrier_solutionSetCondition).obj object)) =
          ContinuousHom.comp
            ((SolutionSet.ordinaryMonadOfSolutionSet
              Global.carrier_solutionSetCondition).map
              (Cantilune.Pi.FMSCpoNondeterministicCanonicalFubini.explicitSwap
                object object))
            (sequentialFubini object object))
  d1aNullaryEffectsUnseparated :
    ∀ object : ωCPO.{0},
      effectDivergence object = effectDeadlock object
  strongBisimulationNoGo :
    ∀ {Carrier : Type}
      [SemilatticeSup Carrier] [OrderBot Carrier]
      (tau : Carrier → Carrier),
      Monotone tau →
        ¬ Cantilune.Pi.FMSUnseparatedFiniteStrongNoGo.StrongFullAbstract tau
  allDomainDefinabilityNoGo :
    ¬ Cantilune.Pi.FMSAllDomainDefinabilityNoGo.AllOmegaCpoElementsDefinable

/--
The no-argument, kernel-built maximum-compatible D1-A FMS theorem.

This is the CENTRAL-12 symbol.  It records both incompatible branches,
constructs the D1-A all-object/world-wise semantic core, and exposes every
positive observation theorem and no-go boundary without calling the ledger a
single source-paper FMS model.
-/
theorem maximum_compatible_d1a_fms_closure :
    MaximumCompatibleD1AFMSClosure where
  maximumCompatibleLedger :=
    ⟨maximumCompatibleFMS, rfl⟩
  concreteAcceptanceLedger :=
    ⟨concreteAcceptance, rfl⟩
  separatedAllSourceEnriched :=
    ⟨separated_all_source_solution_set,
      ⟨separated_enriched_adjunction⟩⟩
  allObjectStrongCommutativeExact := rfl
  lowerOmegaScottMonadExact :=
    accepted_power_is_lower_omegaScott
  fubiniMultiplicationCoherence :=
    accepted_fubini_multiplication_coherence
  fubiniSymmetry :=
    accepted_fubini_symmetry
  worldMonadExact := rfl
  worldFubiniNaturality :=
    pointwiseFubini_world_injection
  worldAllocationFubiniCoherence :=
    Cantilune.Pi.FMSCpoOmegaScottDeltaCoherence.allocation_pointwiseFubini_coherence
  supportPowerHidingUnitCoherence :=
    supportPowerHiding_unit_coherence
  supportPowerHidingMultiplicationCoherence :=
    supportPowerHiding_multiplication_coherence
  supportPowerHidingFubiniCoherence :=
    supportPowerHiding_fubini_coherence
  poweredSupportDenotationHiding :=
    poweredProcessSupport_allocate_hide
  continuousNaturalRecursiveSolution :=
    ⟨acceptedDomainIso, rfl⟩
  recursiveFoldInitial :=
    ⟨acceptedFoldIsInitial⟩
  recursiveUnfoldTerminal :=
    ⟨acceptedUnfoldIsTerminal⟩
  recursiveHidingWorldNatural :=
    accepted_hiding_world_natural
  recursiveHidingUnroll :=
    accepted_hiding_unroll
  recursiveHidingUnique :=
    accepted_hiding_unique
  supportedRecursiveRestrictionCoherence :=
    supportedRecursiveRestriction_coalgebra_commutes
  contextualHidingCoherence :=
    contextualHidingCoherenceAccepted
  finiteGuardedContextualHoare :=
    d1aOperationalAcceptance
  actualAgentPrefix :=
    actualAgentPrefixBoundary
  totalActualAgentCoalgebra :=
    totalSupportedOperationalBoundary
  representativeTraceCommutation :=
    concreteAcceptance_normative_commutation
  actualAgentCommutation :=
    open_pi_fms_commutes
  exactNormativeFamilyCount := by decide
  separatedSequentialFubiniNoGo :=
    separated_sequential_fubini_not_commutative
  d1aNullaryEffectsUnseparated :=
    d1a_nullary_effect_is_unseparated
  strongBisimulationNoGo :=
    Cantilune.Pi.FMSUnseparatedFiniteStrongNoGo.not_strongFullAbstract
  allDomainDefinabilityNoGo :=
    concreteAcceptance_all_domain_no_go

/-! ## Expansion of an arbitrary complete product package -/

variable
    {SourceCategory DagCategory PetriCategory PiCategory MorphismCategory :
      Type u}
    [Category.{v} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    [Category.{v} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{v} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{v} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{v} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    {source : ReindexableExecutionFamily}
    {dagFamily :
      ProjectionFamilyOver SourceCategory DagCategory source}
    {petriFamily :
      ProjectionFamilyOver SourceCategory PetriCategory source}
    {piFamily :
      ProjectionFamilyOver SourceCategory PiCategory source}
    {morphismFamily :
      ProjectionFamilyOver SourceCategory MorphismCategory source}
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceSemantics :
      HeterogeneousAdmissionLTS
        (source.package oldSignature)
        (source.package newSignature)}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        (source.package oldSignature)
        (source.package newSignature)
        sourceSemantics admission}
    {signatureCertificate :
      FourCoherentFamilyAdmission
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence}
    {KernelState : Type w} [Fintype KernelState] [DecidableEq KernelState]
    {kernel :
      NativeMarkovKernel newSignature
        (source.package newSignature) KernelState}
    {initial : InitialDistribution KernelState}
    {epsilon : Real}
    {RuleQualified RuleAuthorized :
      (source.package newSignature).lts.State →
        (source.package newSignature).lts.Event →
        (source.package newSignature).lts.State → Prop}
    {candidate : Candidate (source.package newSignature)}
    {P1bSource P1bTarget P1cSource P1cTarget : ObservableLTS}

variable
    (package :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        P1bSource P1bTarget P1cSource P1cTarget)

/--
Ordinary expansion of all fixed-epoch proof groups carried by the package.

Each conjunct is a proof-carrying structure or native policy proposition,
not a Boolean status flag.
-/
def ProductExpansion : Prop :=
  let bundle := package.crossEpoch.ruleBundle
  SourceOccurrenceEvidence
      (source.package newSignature) candidate ∧
    RuleRankEvidence
      (source.package newSignature)
      (before := candidate.before)
      (event := candidate.event)
      (after := candidate.after) ∧
    ResourceQuiescenceEvidence
      (source.package newSignature)
      (dagFamily.target.package newSignature)
      (petriFamily.target.package newSignature)
      (piFamily.target.package newSignature)
      (morphismFamily.target.package newSignature)
      (dagFamily.operational newSignature)
      (petriFamily.operational newSignature)
      (piFamily.operational newSignature)
      (morphismFamily.operational newSignature)
      candidate ∧
    ProjectionOccurrenceEvidence
      (source.package newSignature)
      (dagFamily.target.package newSignature)
      (dagFamily.operational newSignature) candidate ∧
    ProjectionOccurrenceEvidence
      (source.package newSignature)
      (petriFamily.target.package newSignature)
      (petriFamily.operational newSignature) candidate ∧
    Nonempty
      (Cantilune.Projection.P1aSemanticCertificate.ReconfigurablePetriCertificate
        admission
        (source.package oldSignature)
        (source.package newSignature)
        (petriFamily.target.package oldSignature)
        (petriFamily.target.package newSignature)
        sourceSemantics signatureCertificate.petriSemantics sourceOccurrence
        (petriFamily.operational oldSignature)
        (petriFamily.operational newSignature)
        signatureCertificate.petri.admissionProjection
        candidate package.crossEpoch.connects package.petriSemantic) ∧
    ProjectionOccurrenceEvidence
      (source.package newSignature)
      (piFamily.target.package newSignature)
      (piFamily.operational newSignature) candidate ∧
    ProjectionOccurrenceEvidence
      (source.package newSignature)
      (morphismFamily.target.package newSignature)
      (morphismFamily.operational newSignature) candidate ∧
    RuleQualified candidate.before candidate.event candidate.after ∧
    RuleAuthorized candidate.before candidate.event candidate.after ∧
    Nonempty
      (ProductPiFMSAlignment
        (source.package newSignature)
        (piFamily.target.package newSignature)
        (piFamily.operational newSignature)
        candidate) ∧
    Nonempty
      (ProductAdmissionPiFMSAlignment
        admission sourceSemantics sourceOccurrence
        signatureCertificate.piSemantics
        (piFamily.operational oldSignature)
        (piFamily.operational newSignature)
        signatureCertificate.pi.admissionProjection
        candidate package.crossEpoch.connects package.piFMSAlignment) ∧
    Nonempty
      (ProbabilitySchedulingObligations
        (source.package newSignature) kernel initial epsilon bundle.rank)

/-- The complete package expands without any further premise. -/
theorem product_expansion : ProductExpansion package := by
  let bundle := package.crossEpoch.ruleBundle
  exact
    ⟨bundle.sourceOccurrence,
      bundle.rank,
      bundle.resourceQuiescence,
      bundle.dag,
      bundle.petri,
      ⟨package.reconfigurablePetri⟩,
      bundle.pi,
      bundle.morphism,
      bundle.qualified,
      bundle.authorized,
      ⟨package.piFMSAlignment⟩,
      ⟨package.admissionPiFMSAlignment⟩,
      ⟨bundle.probability⟩⟩

/--
The selected-candidate DAG sidecar constructs an independent canonical target
LTS from the semantic certificate stored in the complete product package.  Its
states carry the exact Config-derived graph and SCC/rank data; its only native
constructor replays the selected verified DPO record.  This is not the
product-wide DAG projection: the complete `dagFamily.operational` certificate
and its path/terminal conclusions are exposed by
`complete_product_p1a_projection_scope`.
-/
theorem generic_dag_projection
    (certifiedPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        P1bSource P1bTarget P1cSource P1cTarget) :
    Nonempty
      (Cantilune.Projection.CanonicalDAGTarget.CanonicalDAGProjection
        (source.package newSignature)
        (dagFamily.target.package newSignature)
        (dagFamily.operational newSignature) candidate) :=
  ⟨Cantilune.Projection.CanonicalDAGTarget.CanonicalDAGProjection.ofSemanticCertificate
    certifiedPackage.dagSemantic⟩

/-- No-argument canonical DAG target for the nonempty reference package. -/
noncomputable def reference_dag_projection :=
  Classical.choice
    (generic_dag_projection
      Cantilune.Theorems.CoreConformance.Reference.core)

/--
The selected-candidate Petri sidecar retains the old declaration prefix under
signature reindexing, appends the admitted declaration, binds that declaration
to the same signature-admission event and native target occurrence, and
derives exact individual-token/provenance incidence and firing at the selected
post-admission occurrence.  It is not the product-wide Petri projection; that
complete certificate and its path/terminal conclusions are exposed by
`complete_product_p1a_projection_scope`.
-/
theorem generic_petri_projection
    (certifiedPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        P1bSource P1bTarget P1cSource P1cTarget) :
    Nonempty
      (Cantilune.Projection.P1aSemanticCertificate.ReconfigurablePetriCertificate
        admission
        (source.package oldSignature)
        (source.package newSignature)
        (petriFamily.target.package oldSignature)
        (petriFamily.target.package newSignature)
        sourceSemantics signatureCertificate.petriSemantics sourceOccurrence
        (petriFamily.operational oldSignature)
        (petriFamily.operational newSignature)
        signatureCertificate.petri.admissionProjection
        candidate certifiedPackage.crossEpoch.connects
        certifiedPackage.petriSemantic) :=
  ⟨certifiedPackage.reconfigurablePetri⟩

/--
CENTRAL-08: every complete product package exposes its product-wide DAG,
Petri, and morphism `ProjectionCertificate`s together with full path
lift/reflection and terminal-classification preservation.

The selected canonical DAG and reconfigurable Petri theorems above remain
occurrence-indexed semantic sidecars; they are not used to manufacture this
whole-LTS result.
-/
theorem generic_p1a_projection_scope :
    Nonempty
      (Cantilune.Theorems.P1aProjectionScopeClosure.CompleteProductP1aProjectionScope
        package) :=
  ⟨Cantilune.Theorems.P1aProjectionScopeClosure.complete_product_p1a_projection_scope
    package⟩

/-- Final product-relative technical result. -/
structure ProductTechnicalClosure where
  consistency : CoreConformancePackage.Consistency package
  expanded : ProductExpansion package
  completeP1a :
    Cantilune.Theorems.P1aProjectionScopeClosure.CompleteProductP1aProjectionScope
      package
  global : GlobalTheory
  selectedFMS :
    TotalCompiledNormativeCommutation
      package.piFMSAlignment.family
  admissionFMS :
    TotalCompiledNormativeCommutation
      (package.admissionPiFMSAlignment.operational.family
        (signatureCertificate.piSemantics.eventOf admission))

/--
Generic closure theorem for every product package that actually carries the
complete dependent certificates.  No production package is instantiated by
this theorem.
-/
def assemble :
    ProductTechnicalClosure package where
  consistency := package.consistency
  expanded := product_expansion package
  completeP1a :=
    Cantilune.Theorems.P1aProjectionScopeClosure.complete_product_p1a_projection_scope
      package
  global := globalTheory
  selectedFMS := package.piFMSAlignment.actual
  admissionFMS := package.admissionPiFMSAlignment.actual

/-- Public existential form for downstream product-conformance gates. -/
theorem generic_technical_closure :
    Nonempty (ProductTechnicalClosure package) :=
  ⟨assemble package⟩

/-!
## Product closure with an exact common-FMS trajectory

`ProductTechnicalClosure` expands all static, operational, resource, and
probabilistic certificates.  The following structure additionally requires
one caller-selected positive stochastic row to be the package's exact
candidate, registry operation, replay metadata, raw late-pi step, and actual
FMS endpoints.  It remains fully generic: neither a kernel nor a path is
manufactured by this theorem.
-/

structure CompleteProductTechnicalClosure
    (labelling : PositiveEventLabelling kernel)
    (fmsLabelling : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path)
    (selected : Nat) where
  technical : ProductTechnicalClosure package
  commonTrajectory :
    CompleteProductCommonTrajectoryCertificate
      package labelling fmsLabelling path agreement selected

/--
Compose the product-wide technical closure with a caller-supplied exact
selected-row common-FMS certificate.
-/
def assembleWithCommonTrajectory
    {labelling : PositiveEventLabelling kernel}
    {fmsLabelling : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}
    {selected : Nat}
    (trajectory :
      CompleteProductCommonTrajectoryCertificate
        package labelling fmsLabelling path agreement selected) :
    CompleteProductTechnicalClosure
      package labelling fmsLabelling path agreement selected where
  technical := assemble package
  commonTrajectory := trajectory

/-- Existential composition form for downstream product-conformance gates. -/
theorem generic_technical_closure_with_common_trajectory
    {labelling : PositiveEventLabelling kernel}
    {fmsLabelling : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}
    {selected : Nat}
    (trajectory :
      CompleteProductCommonTrajectoryCertificate
        package labelling fmsLabelling path agreement selected) :
    Nonempty
      (CompleteProductTechnicalClosure
        package labelling fmsLabelling path agreement selected) :=
  ⟨assembleWithCommonTrajectory package trajectory⟩

/-!
## Candidate-indexed four-projection consistency

The older `CompleteProductTechnicalClosure` intentionally accepts arbitrary
P1b/P1c LTS parameters.  That is useful as a reusable product interface, but
it is too weak to state the final Cantilune theorem: a caller could otherwise
pair its DPO candidate and stochastic row with an unrelated native P1c
occurrence.

The record below closes that dependency seam.  It retains the canonical
request/accept calculus as the globally reusable P1b sublanguage theorem and
specialises candidate-indexed P1c to the enriched structural calculus, while
remaining generic in every product category, signature admission, rule
candidate and Markov kernel.  The current P1b reference LTS has no product
session/correlation metadata, so this theorem deliberately makes no
P1b-to-candidate causal claim.  Its one dependent input is
`CompleteProductProtocolTrajectoryCertificate`; consequently the selected
stochastic row, replayable DPO event, registry operation, strong late-pi
derivative, enriched target edge and actual-Agent endpoints all use the same
product candidate.
-/

/--
The final generic four-projection certificate.

No field manufactures a product fact.  `technical` expands the complete
product package; `protocolTrajectory` independently retains the global P1b
reference calculus and binds P1c to the same candidate-indexed stochastic
row; the remaining fields insert the
kernel-built universal FMS, Open-pi and enriched-P1c results.  The full
product-wide DAG/Petri/morphism certificates are retained in
`technical.completeP1a`; `canonicalDAG` and `reconfigurablePetri` are only
selected-occurrence semantic sidecars.
-/
structure FourProjectionConsistency
    (canonicalPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget)
    (labelling : PositiveEventLabelling kernel)
    (fmsLabelling : ProductFMSLabelling labelling)
    (path : PositiveStatePath kernel)
    (agreement : labelling.TrajectoryAgreement path)
    (selected : Nat) where
  technical : ProductTechnicalClosure canonicalPackage
  protocolTrajectory :
    CompleteProductProtocolTrajectoryCertificate
      canonicalPackage labelling fmsLabelling path agreement selected
  protocolCandidateEvidence :
    CompleteProductProtocolTrajectoryCertificate.CompleteProtocolCandidateEvidence
      protocolTrajectory
  maximumCompatibleFMS : MaximumCompatibleD1AFMSClosure
  completeOpenPi : CompleteOpenPiSMCOperationalBoundary
  completeEnrichedP1c :
    Cantilune.Pi.P1cEnrichedStructuralCertificate.CompleteEnrichedStructuralP1c
  canonicalDAG :
    Nonempty
      (Cantilune.Projection.CanonicalDAGTarget.CanonicalDAGProjection
        (source.package newSignature)
        (dagFamily.target.package newSignature)
        (dagFamily.operational newSignature) candidate)
  reconfigurablePetri :
    Nonempty
      (Cantilune.Projection.P1aSemanticCertificate.ReconfigurablePetriCertificate
        admission
        (source.package oldSignature)
        (source.package newSignature)
        (petriFamily.target.package oldSignature)
        (petriFamily.target.package newSignature)
        sourceSemantics signatureCertificate.petriSemantics sourceOccurrence
        (petriFamily.operational oldSignature)
        (petriFamily.operational newSignature)
        signatureCertificate.petri.admissionProjection
        candidate canonicalPackage.crossEpoch.connects
        canonicalPackage.petriSemantic)

namespace FourProjectionConsistency

variable
    {canonicalPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget}
    {labelling : PositiveEventLabelling kernel}
    {fmsLabelling : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}
    {selected : Nat}
    (closure :
      FourProjectionConsistency
        canonicalPackage labelling fmsLabelling path agreement selected)

include closure in
/--
Compatibility projection exposing the global strong P1b reference step
beside the exact candidate-indexed P1c chain.  It does not assert a causal
P1b-to-product seam.
-/
def global_p1b_and_candidate_p1c_steps :=
  closure.protocolTrajectory.global_p1b_and_candidate_p1c_steps

include closure in
/--
The load-bearing selected-row evidence with all coordinate, registry,
replay, raw derivative, enriched target and actual-Agent equalities retained.
-/
def complete_protocol_candidate_evidence :=
  closure.protocolCandidateEvidence

include closure in
/-- Admission reaches the same selected candidate and its actual-Agent seam. -/
def admission_to_selected_candidate :=
  closure.protocolTrajectory.admission_to_selected_candidate

include closure in
/-- The selected candidate is a genuine enriched structural target step. -/
def enriched_product_target_step :=
  closure.protocolTrajectory.protocol.enriched_product_target_step

end FourProjectionConsistency

/-- Construct the final record from one exact dependent product certificate. -/
def assembleFourProjectionConsistency
    {canonicalPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget}
    {labelling : PositiveEventLabelling kernel}
    {fmsLabelling : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}
    {selected : Nat}
    (certificate :
      CompleteProductProtocolTrajectoryCertificate
        canonicalPackage labelling fmsLabelling path agreement selected) :
    FourProjectionConsistency
      canonicalPackage labelling fmsLabelling path agreement selected where
  technical := assemble canonicalPackage
  protocolTrajectory := certificate
  protocolCandidateEvidence :=
    certificate.complete_protocol_candidate_evidence
  maximumCompatibleFMS := maximum_compatible_d1a_fms_closure
  completeOpenPi := completeOpenPiSMCOperationalBoundary
  completeEnrichedP1c :=
    Cantilune.Pi.P1cEnrichedStructuralCertificate.complete_enriched_structural_p1c_certificate
  canonicalDAG := generic_dag_projection canonicalPackage
  reconfigurablePetri := generic_petri_projection canonicalPackage

/--
CENTRAL-18: every fully certified canonical-protocol product package has one
candidate-indexed four-projection consistency witness.

This is deliberately conditional on the complete product certificate.  It
does not instantiate any of the eight production packages.
-/
theorem generic_four_projection_consistency
    {canonicalPackage :
      CoreConformancePackage
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory
        source dagFamily petriFamily piFamily morphismFamily
        admission sourceSemantics sourceOccurrence signatureCertificate
        kernel initial epsilon RuleQualified RuleAuthorized candidate
        CanonicalP1bSource CanonicalP1bTarget
        CanonicalP1cSource CanonicalP1cTarget}
    {labelling : PositiveEventLabelling kernel}
    {fmsLabelling : ProductFMSLabelling labelling}
    {path : PositiveStatePath kernel}
    {agreement : labelling.TrajectoryAgreement path}
    {selected : Nat}
    (certificate :
      CompleteProductProtocolTrajectoryCertificate
        canonicalPackage labelling fmsLabelling path agreement selected) :
    Nonempty
      (FourProjectionConsistency
        canonicalPackage labelling fmsLabelling path agreement selected) :=
  ⟨assembleFourProjectionConsistency certificate⟩

/-! ## No-argument substantive reference closure -/

/--
The anti-vacuity closure for the connected reference execution.

The first field instantiates the generic theorem.  The second expands the
reference-specific operational facts (graph change, strict rank decrease,
four native/replay views, probability-one scheduling, SCC condensation,
five-view terminal agreement, and feedback closure).  `admissionConnection`
records that the heterogeneous admission target is the selected reconnect
source, without identifying their events.  `fixedBusinessP1a` is a separate
fourteen-event, three-target anti-vacuity reference.
-/
structure SubstantiveReferenceTechnicalClosure : Prop where
  packageClosure :
    Nonempty
      (ProductTechnicalClosure
        Cantilune.Theorems.SubstantiveReconnectConformance.core)
  substantive :
    Cantilune.Theorems.SubstantiveReconnectConformance.SubstantiveReferenceComplete
  legacyPetriAntiVacuity :
    Cantilune.Theorems.SubstantiveReconnectConformance.LegacyPetriAntiVacuity
  admissionConnection :
    Cantilune.Theorems.SubstantiveReconnectConformance.sourceAdmissionOccurrence.afterState =
        Cantilune.Theorems.SubstantiveReconnectConformance.candidate.before ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.candidate.before =
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectSource ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.candidate.event =
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectEvent ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.candidate.after =
        Cantilune.Theorems.SubstantiveReconnectConformance.reconnectTarget
  selectedNormativeFamily :
    Cantilune.Theorems.SubstantiveReconnectConformance.core.piFMSAlignment.family =
      .instanceReconnect
  selectedActualFMS :
    TotalCompiledNormativeCommutation .instanceReconnect
  admissionAlignmentExact :
    Cantilune.Theorems.SubstantiveReconnectConformance.core.admissionPiFMSAlignment =
      Cantilune.Theorems.SubstantiveReconnectConformance.admissionPiFMSAlignment
  admissionStrongRaw :
    Cantilune.Pi.Late.NativeStep
      (Cantilune.Pi.P1cFullNativeRefinement.readyProcess
        .dynamicPartnerAdmission)
      (Cantilune.Pi.P1cFullNativeRefinement.firstAction
        .dynamicPartnerAdmission)
      (Cantilune.Pi.P1cFullNativeRefinement.firstTarget
        .dynamicPartnerAdmission)
  admissionBoundaryMetadata :
    Cantilune.Theorems.SubstantiveReconnectConformance.core.admissionPiFMSAlignment.metadata.registry =
        ProductPiOperationalSemantics.stableMetadataOfDPOEvent
          ((Cantilune.Theorems.SubstantiveReconnectConformance.sourcePackage
              Cantilune.Theorems.SubstantiveReconnectConformance.newSignature).eventRecord
              Cantilune.Theorems.SubstantiveReconnectConformance.candidate.event).event ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.core.admissionPiFMSAlignment.metadata.registry.version =
        Cantilune.Theorems.SubstantiveReconnectConformance.admission.toVersion ∧
      Cantilune.Theorems.SubstantiveReconnectConformance.core.admissionPiFMSAlignment.metadata.tombstone =
        Cantilune.Theorems.SubstantiveReconnectConformance.admission.tombstoneId
  admissionTargetIsSelectedBusinessSource :
    normativeTargetAgent .dynamicPartnerAdmission =
      normativeSourceAgent .instanceReconnect
  actualCoreCommonTrajectory :
    Nonempty
      (CompleteProductTechnicalClosure
        Cantilune.Theorems.SubstantiveReconnectConformance.core
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.positiveLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.productFMSLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalPositivePath
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalTrajectoryAgreement
        0)
  candidateIndexedFourProjection :
    Nonempty
      (FourProjectionConsistency
        Cantilune.Theorems.SubstantiveReconnectConformance.core
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.positiveLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.productFMSLabelling
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalPositivePath
        Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.canonicalTrajectoryAgreement
        0)
  fixedBusinessP1a :
    Nonempty
      (Cantilune.Theorems.P1aProjectionScopeClosure.FixedSignatureReferenceP1aScope
        Cantilune.Theorems.P1aProjectionScopeClosure.fixedReferenceSignature)

/--
No-argument final technical theorem for the nonempty reference execution.

This theorem does not instantiate any of the eight production products.
-/
theorem reference_technical_closure :
    SubstantiveReferenceTechnicalClosure where
  packageClosure :=
    generic_technical_closure
      Cantilune.Theorems.SubstantiveReconnectConformance.core
  substantive :=
    Cantilune.Theorems.SubstantiveReconnectConformance.substantive_reference_complete
  legacyPetriAntiVacuity :=
    Cantilune.Theorems.SubstantiveReconnectConformance.legacyPetriAntiVacuity
  admissionConnection :=
    Cantilune.Theorems.SubstantiveReconnectConformance.admission_connects_selected_rule_occurrence
  selectedNormativeFamily := rfl
  selectedActualFMS :=
    Cantilune.Theorems.SubstantiveReconnectConformance.core.piFMSAlignment.actual
  admissionAlignmentExact := rfl
  admissionStrongRaw :=
    Cantilune.Theorems.SubstantiveReconnectConformance.admissionPiFMSAlignment.nativeRealization
  admissionBoundaryMetadata := by
    constructor
    · exact
        Cantilune.Theorems.SubstantiveReconnectConformance.admissionPiFMSAlignment.metadataRegistryExact
    · exact
        Cantilune.Theorems.SubstantiveReconnectConformance.admissionPiFMSAlignment.admissionBoundaryMetadataExact
  admissionTargetIsSelectedBusinessSource :=
    Cantilune.Theorems.SubstantiveReconnectConformance.admissionPiFMSAlignment.actualTargetIsSelectedBusinessSource
  actualCoreCommonTrajectory :=
    generic_technical_closure_with_common_trajectory
      Cantilune.Theorems.SubstantiveReconnectConformance.core
      Cantilune.Theorems.SubstantiveCoreCommonFMSTrajectory.Reference.completeCertificate
  candidateIndexedFourProjection :=
    generic_four_projection_consistency
      Cantilune.Theorems.SubstantiveProtocolTrajectoryBridge.referenceCompleteProtocolTrajectory
  fixedBusinessP1a :=
    Cantilune.Theorems.P1aProjectionScopeClosure.fixed_business_reference_nonempty

end Cantilune.Theorems.TechnicalClosure
