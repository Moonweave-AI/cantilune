import Cantilune.Pi.OpenSMCPolarisedOperational
import Cantilune.Pi.OpenSMCLinearOneShotObstruction
import Cantilune.Pi.LateGuardedReplicationAlphaOperational
import Cantilune.Pi.P1cFullNativeRefinement

/-!
# Adequacy boundary for the polarised Open-pi presentation

This module closes the load-bearing part of the two-layer Open-pi design.

* The presented `Hom` layer owns category and symmetric-monoidal equality.
* Nominal representatives own genuine strong late-pi transitions.
* Every operational witness below contains one
  `RecursiveLate.NativeStep`; no transitive closure is used.
* Bound labels and their derivatives pass to the joint
  `DerivativeAlpha` quotient, rather than to a process-bisimulation quotient.

An operational wire is necessarily a two-transition protocol: input first,
then output from the derivative.  It is therefore not identified with the
presented identity term.  The final section reuses the prefix-count invariant
to prove that this separation is forced by the selected raw structural
equality.
-/

namespace Cantilune.Pi.OpenSMCPolarisedAdequacy

open Cantilune.Pi
open Cantilune.Pi.OpenSMCPolarisedOperational
open Cantilune.Pi.OpenSMCLinearOneShotObstruction
open Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary
open Cantilune.Pi.RecursiveActionAlpha
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cFullNativeRefinement

/-! ## Proof-relevant strong nominal representatives -/

/--
A nominal representative is adequate only when it carries an actual native
derivation.  In particular, the relation cannot be inhabited by merely
postulating an observationally equivalent target.
-/
structure StrongRepresentative where
  source : RecursiveProc
  action : Raw.Action
  target : RecursiveProc
  native : RecursiveLate.NativeStep source action target

namespace StrongRepresentative

/--
Every representative descends to exactly one strong step on the joint
action/derivative alpha quotient.
-/
theorem alphaNative (representative : StrongRepresentative) :
    RecursiveAlphaOperational.AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid representative.source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := representative.action
           target := representative.target } :
          LabelledDerivative)) :=
  RecursiveAlphaOperational.alphaNativeStep_mk representative.native

/-- Parallel placement on the left preserves the same native action. -/
def tensorLeft
    (representative : StrongRepresentative)
    (right : RecursiveProc)
    (fresh :
      Disjoint representative.action.boundNames right.freeNames) :
    StrongRepresentative where
  source := .par representative.source right
  action := representative.action
  target := .par representative.target right
  native := parallel_native_left fresh representative.native

/-- Parallel placement on the right preserves the same native action. -/
def tensorRight
    (left : RecursiveProc)
    (representative : StrongRepresentative)
    (fresh :
      Disjoint representative.action.boundNames left.freeNames) :
    StrongRepresentative where
  source := .par left representative.source
  action := representative.action
  target := .par left representative.target
  native := parallel_native_right fresh representative.native

/--
Restriction of a list of names preserves a visible action exactly when every
hidden name is fresh for that action.
-/
def hide
    (hidden : List Name)
    (representative : StrongRepresentative)
    (fresh :
      ∀ binder, binder ∈ hidden →
        binder ∉ representative.action.names) :
    StrongRepresentative where
  source := hideNames hidden representative.source
  action := representative.action
  target := hideNames hidden representative.target
  native := hideNames_native hidden representative.native fresh

/-- A synchronisation label is unaffected by any finite hiding boundary. -/
def hideTau
    (hidden : List Name)
    (representative : StrongRepresentative)
    (isTau : representative.action = .tau) :
    StrongRepresentative where
  source := hideNames hidden representative.source
  action := .tau
  target := hideNames hidden representative.target
  native := by
    apply hideNames_native_tau
    simpa only [isTau] using representative.native

end StrongRepresentative

/-! ## Fresh abstract-boundary realization -/

/-- A fresh realization records both non-aliasing and external freshness. -/
structure FreshBoundaryWitness
    (avoid : Finset Name) (object : Object) where
  realization : Realization object
  occurrenceDistinct : realization.names.Nodup
  externallyFresh : Disjoint realization.names.toFinset avoid

/--
Every finite avoid-set and every typed polarised positional boundary has a
fresh nominal realization.
-/
def freshBoundary
    (avoid : Finset Name) (object : Object) :
    FreshBoundaryWitness avoid object where
  realization := freshRealization avoid object
  occurrenceDistinct := Realization.names_nodup _
  externallyFresh := freshRealization_disjoint avoid object

/-- The same construction applies to the total tensor boundary. -/
def freshTensorBoundary
    (avoid : Finset Name) (left right : Object) :
    FreshBoundaryWitness avoid (tensorObject left right) :=
  freshBoundary avoid (tensorObject left right)

/-! ## Operational generators for wire, tensor, hiding, and plug -/

/-- First strong transition of the persistent nominal wire. -/
def wireInputRepresentative
    (port : PortType) (source target binder : Name) :
    StrongRepresentative where
  source := wire port source target binder
  action := .input (wireEndpoints port source target).1 binder
  target :=
    .par
      (.send (wireEndpoints port source target).2 binder .zero)
      (wire port source target binder)
  native := wire_native_input port source target binder

/-- Second strong transition, emitted by the derivative of the wire input. -/
def wireOutputRepresentative
    (port : PortType) (source target binder : Name) :
    StrongRepresentative where
  source :=
    .par
      (.send (wireEndpoints port source target).2 binder .zero)
      (wire port source target binder)
  action := .output (wireEndpoints port source target).2 binder
  target := .par .zero (wire port source target binder)
  native := wire_native_output port source target binder

/-- The two native wire transitions share their intermediate process exactly. -/
theorem wire_derivative_is_output_source
    (port : PortType) (source target binder : Name) :
    (wireInputRepresentative port source target binder).target =
      (wireOutputRepresentative port source target binder).source :=
  rfl

/-- The input and derivative-output labels cannot collapse to one label. -/
theorem wire_labels_distinct
    (port : PortType) (source target binder : Name) :
    (wireInputRepresentative port source target binder).action ≠
      (wireOutputRepresentative port source target binder).action :=
  wire_not_atomic_relay

/--
Left-output/right-input plugging at one shared realized endpoint is a single
strong synchronisation under restriction of the whole middle boundary.
-/
def plugLeftRepresentative
    {middle : Object}
    (realization : Realization middle)
    (position : Position middle)
    (outputStep :
      RecursiveLate.NativeStep left
        (.output (realization.nameAt position) value) left')
    (inputStep :
      RecursiveLate.NativeStep right
        (.input (realization.nameAt position) binder) right')
    (binderFresh : binder ∉ left'.freeNames) :
    StrongRepresentative where
  source := plug realization left right
  action := .tau
  target :=
    hideNames realization.names
      (.par left'
        (right'.substituteCaptureAvoiding binder value))
  native :=
    plug_syncLeft_native realization position
      outputStep inputStep binderFresh

/-- Mirror-oriented shared-endpoint plugging is also one strong step. -/
def plugRightRepresentative
    {middle : Object}
    (realization : Realization middle)
    (position : Position middle)
    (inputStep :
      RecursiveLate.NativeStep left
        (.input (realization.nameAt position) binder) left')
    (outputStep :
      RecursiveLate.NativeStep right
        (.output (realization.nameAt position) value) right')
    (binderFresh : binder ∉ right'.freeNames) :
    StrongRepresentative where
  source := plug realization left right
  action := .tau
  target :=
    hideNames realization.names
      (.par
        (left'.substituteCaptureAvoiding binder value)
        right')
  native :=
    plug_syncRight_native realization position
      inputStep outputStep binderFresh

/-!
Restriction has two native operational faces.  A name fresh for a visible
label is transported by `restrict`; extrusion of a restricted output is the
native `open` rule and produces a bound-output label.
-/

/-- One-name hiding is exactly one application of native restriction. -/
def restrictionRepresentative
    (hidden : Name)
    (representative : StrongRepresentative)
    (fresh : hidden ∉ representative.action.names) :
    StrongRepresentative :=
  representative.hide [hidden] (by
    intro binder member
    simp only [List.mem_singleton] at member
    subst binder
    exact fresh)

/-- A restricted free output exposes one genuine bound-output transition. -/
def openBoundOutputRepresentative
    (fresh channel : Name)
    (distinct : fresh ≠ channel)
    (output :
      RecursiveLate.NativeStep body
        (.output channel fresh) target) :
    StrongRepresentative where
  source := .new fresh body
  action := .boundOutput channel fresh
  target := target
  native := RecursiveLate.NativeStep.open distinct output

/-! ## Presented SMC coherence remains algebraic -/

/--
The category identity equations are theorems of the presented algebraic
layer.  No operational relay is inserted into either equation.
-/
theorem presented_identity_coherent
    {source target : Object} (process : Hom source target) :
    comp (identity source) process = process ∧
      comp process (identity target) = process :=
  ⟨comp_identity_left process, comp_identity_right process⟩

/-- Associativity and tensor interchange hold in the presented layer. -/
theorem presented_composition_tensor_coherent
    {a b c d e f g : Object}
    (first : Hom a b) (second : Hom b c) (third : Hom c d)
    (left₁ : Hom a b) (left₂ : Hom b c)
    (right₁ : Hom e f) (right₂ : Hom f g) :
    comp (comp first second) third =
        comp first (comp second third) ∧
      comp (parallel left₁ right₁) (parallel left₂ right₂) =
        parallel (comp left₁ left₂) (comp right₁ right₂) :=
  ⟨comp_assoc first second third,
    parallel_comp_interchange left₁ left₂ right₁ right₂⟩

/--
The three global SMC coherence diagrams commute in the presented layer.
-/
theorem presented_global_smc_coherent
    (a b c d : Object) :
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
        (parallel (identity b) (braid a c))) :=
  ⟨pentagon a b c d, triangle a b, hexagon a b c⟩

/-! ## All normative events remain strong one-step events -/

/--
The canonical operational representative of any one of the fifteen
normative event families embeds its genuine raw late step into the guarded
recursive syntax.
-/
def normativeRepresentative (event : SourceEvent) :
    StrongRepresentative where
  source := RecursiveProc.ofRaw (readyProcess event)
  action := firstAction event
  target := RecursiveProc.ofRaw (firstTarget event)
  native := RecursiveLate.ofRaw_native (first_native event)

/-- There are exactly fifteen normative families in the closed core. -/
theorem normative_family_count :
    Fintype.card SourceEvent = 15 := by
  native_decide

/--
Every normative event therefore has one genuine strong step on the joint
derivative-alpha quotient as well.
-/
theorem normative_alpha_native (event : SourceEvent) :
    RecursiveAlphaOperational.AlphaNativeStep
      (Quotient.mk RecursiveAlpha.setoid
        (normativeRepresentative event).source)
      (Quotient.mk DerivativeAlpha.setoid
        ({ action := (normativeRepresentative event).action
           target := (normativeRepresentative event).target } :
          LabelledDerivative)) :=
  (normativeRepresentative event).alphaNative

/-! ## Exact no-go and maximal compatible replacement -/

/--
A positive-prefix raw identity candidate would need both structural unit
laws for every raw process.
-/
structure PositivePrefixRawStructuralIdentity (middle : Name) where
  process : Raw.Proc
  positive : 0 < process.prefixCount
  leftUnit :
    ∀ body, Late.Struct (rawPlug middle process body) body
  rightUnit :
    ∀ body, Late.Struct (rawPlug middle body process) body

/--
No positive-prefix raw process can implement the presented identity under
alpha, parallel ACU, and the legal scope laws of `Late.Struct`.
-/
theorem no_positive_prefix_raw_structural_identity
    (middle : Name) :
    ¬ Nonempty (PositivePrefixRawStructuralIdentity middle) := by
  rintro ⟨candidate⟩
  exact
    no_left_structural_unit_of_positive_prefix
      middle candidate.process .zero candidate.positive
      (candidate.leftUnit .zero)

/--
The strongest compatible identity statement combines the algebraic unit
equations, the raw structural no-go, and the real two-transition wire
protocol.  It does not identify the operational wire with the algebraic
identity.
-/
theorem maximal_compatible_identity
    {sourceObject targetObject : Object}
    (process : Hom sourceObject targetObject)
    (middle : Name)
    (port : PortType) (source target binder : Name) :
    (comp (identity sourceObject) process = process ∧
      comp process (identity targetObject) = process) ∧
    ¬ Nonempty (PositivePrefixRawStructuralIdentity middle) ∧
    RecursiveLate.NativeStep
      (wireInputRepresentative port source target binder).source
      (wireInputRepresentative port source target binder).action
      (wireInputRepresentative port source target binder).target ∧
    RecursiveLate.NativeStep
      (wireOutputRepresentative port source target binder).source
      (wireOutputRepresentative port source target binder).action
      (wireOutputRepresentative port source target binder).target := by
  exact
    ⟨presented_identity_coherent process,
      no_positive_prefix_raw_structural_identity middle,
      (wireInputRepresentative port source target binder).native,
      (wireOutputRepresentative port source target binder).native⟩

end Cantilune.Pi.OpenSMCPolarisedAdequacy
