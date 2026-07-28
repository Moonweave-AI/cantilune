import Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary
import Cantilune.Pi.OpenSMCNamedComposition

/-!
# Exact obstruction to a linear one-shot named category in the current layer

`OpenSMCFiniteControlIdentityBoundary` shows that finite control still admits
genuine one-shot relays, although no fixed process can be reused without
bound.  This file asks the narrower question: can that relay serve as the
identity of a named linear category using the definitions already present?

The answer is no for two independent, mechanically checked reasons.

1. `AtomBoundaryCertificate` requires input and output supports to be
   disjoint.  The same nonempty named boundary therefore cannot occur at both
   ends of an admitted identity atom.
2. The direct raw interpretation of plug/hide,
   `ν middle. (left | right)`, adds the prefix budgets of both sides.
   Alpha/structural congruence preserves that budget exactly, so a positive
   one-shot relay cannot satisfy either category unit law under the existing
   structural equality.

There is also no current linear-use type: exact support is a `Finset` and
forgets multiplicity.  A well-typed admitted atom below uses the same public
subject twice while retaining exact singleton support.

These results do not exclude a linear one-shot open-pi category with a richer
design.  Such a design must at least distinguish input/output endpoint
occurrences and their usage multiplicity, choose alpha-fresh physical
representatives for composition, and use a reduction/bisimulation quotient
when a relay is consumed.  A genuine native one-shot synchronization is
included to show that the obstruction is not the absence of operational
communication.
-/

namespace Cantilune.Pi.OpenSMCLinearOneShotObstruction

open Cantilune.Pi
open Cantilune.Pi.OpenSMCBoundaryObstruction
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCFiniteControlIdentityBoundary

/-! ## Current named atom admission cannot contain a nonempty identity -/

/--
The current disjoint-polarity atom certificate has no inhabitant whose two
interfaces are the same nonempty named boundary.
-/
theorem no_nonempty_same_boundary_atom_certificate
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ)
    (nonempty : boundary.names.Nonempty) :
    ¬ ∃ process : Proc,
      AtomBoundaryCertificate Γ boundary boundary process := by
  rintro ⟨process, certificate⟩
  obtain ⟨name, member⟩ := nonempty
  exact
    (Finset.disjoint_left.mp
      certificate.input_output_disjoint)
      member member

/-! ## Exact support is not a linear-use certificate -/

/--
Number of free occurrences of one name as a prefix subject.

An input or restriction binder shadows the same name in its continuation.
Choice and parallel add usage, exposing precisely the multiplicity discarded
by the existing `freeSubjects : Finset Name`.
-/
def freeSubjectOccurrenceCount
    (subject : Name) : Raw.Proc → Nat
  | .zero => 0
  | .tau next =>
      freeSubjectOccurrenceCount subject next
  | .send channel _ next =>
      (if channel = subject then 1 else 0) +
        freeSubjectOccurrenceCount subject next
  | .recv channel binder next =>
      (if channel = subject then 1 else 0) +
        if binder = subject then 0
        else freeSubjectOccurrenceCount subject next
  | .choice left right =>
      freeSubjectOccurrenceCount subject left +
        freeSubjectOccurrenceCount subject right
  | .par left right =>
      freeSubjectOccurrenceCount subject left +
        freeSubjectOccurrenceCount subject right
  | .new binder body =>
      if binder = subject then 0
      else freeSubjectOccurrenceCount subject body
  | .matchEq _ _ next =>
      freeSubjectOccurrenceCount subject next
  | .matchNe _ _ next =>
      freeSubjectOccurrenceCount subject next

/-- A well-typed one-channel process that receives and then sends once. -/
def typedOneChannelEcho : Proc :=
  .recv { name := 0, payload := .data } 2
    (.send { name := 0, payload := .data } 2 .zero)

theorem typedOneChannelEcho_wellTyped :
    typedOneChannelEcho.WellTyped environment := by
  simp [typedOneChannelEcho, environment, Proc.WellTyped]

@[simp]
theorem typedOneChannelEcho_support :
    typedOneChannelEcho.erase.freeNames = {0} := by
  ext name
  simp [typedOneChannelEcho, Proc.erase, Raw.Proc.freeNames]
  aesop

@[simp]
theorem typedOneChannelEcho_subject_use_count :
    freeSubjectOccurrenceCount 0 typedOneChannelEcho.erase = 2 := by
  rfl

/--
The existing exact-support certificate accepts the two-use process at one
public input port because it records support but no usage multiplicity.
-/
theorem typedOneChannelEcho_certificate :
    AtomBoundaryCertificate
      environment namedInput (NamedInterface.empty environment)
      typedOneChannelEcho where
  typed := typedOneChannelEcho_wellTyped
  support_exact := by
    simp
  input_output_disjoint := by
    simp

/--
A concrete admitted atom disproves the implication from exact nominal support
to at-most-once subject use.
-/
theorem exact_support_allows_repeated_subject_use :
    ∃ process : Proc,
      AtomBoundaryCertificate
          environment namedInput (NamedInterface.empty environment)
          process ∧
        1 < freeSubjectOccurrenceCount 0 process.erase := by
  exact
    ⟨typedOneChannelEcho,
      typedOneChannelEcho_certificate,
      by simp⟩

/-! ## Positive-prefix relays cannot be structural category units -/

/--
The direct finite raw interpretation of plug/hide: parallel placement followed
by restriction of one shared middle name.
-/
def rawPlug
    (middle : Name) (left right : Raw.Proc) : Raw.Proc :=
  .new middle (.par left right)

@[simp]
theorem rawPlug_prefixCount
    (middle : Name) (left right : Raw.Proc) :
    (rawPlug middle left right).prefixCount =
      left.prefixCount + right.prefixCount :=
  rfl

/--
Any proposed left identity with a positive operational prefix budget fails
the current structural unit equation.
-/
theorem no_left_structural_unit_of_positive_prefix
    (middle : Name) (identity process : Raw.Proc)
    (positive : 0 < identity.prefixCount) :
    ¬ Late.Struct (rawPlug middle identity process) process := by
  intro structural
  have countEquality :=
    Late.Struct.prefixCount_eq structural
  simp only [rawPlug_prefixCount] at countEquality
  omega

/--
The same prefix invariant rules out the current structural right unit law.
-/
theorem no_right_structural_unit_of_positive_prefix
    (middle : Name) (process identity : Raw.Proc)
    (positive : 0 < identity.prefixCount) :
    ¬ Late.Struct (rawPlug middle process identity) process := by
  intro structural
  have countEquality :=
    Late.Struct.prefixCount_eq structural
  simp only [rawPlug_prefixCount] at countEquality
  omega

/-- The concrete one-shot relay cannot be a left unit under `Late.Struct`. -/
theorem oneShotRelay_not_left_structural_unit
    (middle : Name) (process : Raw.Proc) :
    ¬ Late.Struct (rawPlug middle oneShotRelay process) process :=
  no_left_structural_unit_of_positive_prefix
    middle oneShotRelay process (by simp)

/-- The concrete one-shot relay cannot be a right unit under `Late.Struct`. -/
theorem oneShotRelay_not_right_structural_unit
    (middle : Name) (process : Raw.Proc) :
    ¬ Late.Struct (rawPlug middle process oneShotRelay) process :=
  no_right_structural_unit_of_positive_prefix
    middle process oneShotRelay (by simp)

/-! ## The relay is oriented, but genuine one-shot forwarding exists -/

/-- Every initial native action of the relay is its input prefix. -/
theorem oneShotRelay_initial_action
    (step : Late.NativeStep oneShotRelay action target) :
    action = .input 0 2 ∧
      target = .send 1 2 .zero := by
  cases step
  exact ⟨rfl, rfl⟩

/--
In particular, the chosen relay does not expose an output action before its
input.  A bidirectional identity would need an explicit dual/choice rule; it
is not supplied by exact support.
-/
theorem oneShotRelay_no_initial_output
    (channel value : Name) :
    ¬ ∃ target,
      Late.NativeStep oneShotRelay (.output channel value) target := by
  rintro ⟨target, step⟩
  have action :=
    oneShotRelay_initial_action step
  simp at action

/-- One producer sends the payload consumed by the relay. -/
def relayProducer : Raw.Proc :=
  .send 0 7 .zero

/-- The result after the relay consumes the producer output. -/
def deliveredRelayTarget : Raw.Proc :=
  .par .zero (.send 1 7 .zero)

/--
The producer and relay perform a genuine native synchronization, including
capture-avoiding late substitution of payload `7` for binder `2`.
-/
theorem producer_relay_native_sync :
    Late.NativeStep
      (.par relayProducer oneShotRelay)
      .tau deliveredRelayTarget := by
  simpa [relayProducer, oneShotRelay, deliveredRelayTarget,
    Raw.Proc.substituteCaptureAvoiding,
    Raw.Proc.captureRisk, Raw.Proc.substRaw] using
    (Late.NativeStep.syncLeft
      (Late.NativeStep.prefixOutput :
        Late.NativeStep relayProducer (.output 0 7) .zero)
      (Late.NativeStep.prefixInput :
        Late.NativeStep oneShotRelay (.input 0 2)
          (.send 1 2 .zero))
      (by simp [Raw.Proc.freeNames]))

/-- The delivered payload can then be emitted once on the output endpoint. -/
theorem deliveredRelayTarget_native_output :
    Late.NativeStep deliveredRelayTarget
      (.output 1 7) (.par .zero .zero) := by
  exact
    Late.NativeStep.parRight
      (by simp [Raw.Action.boundNames, Raw.Proc.freeNames])
      Late.NativeStep.prefixOutput

/--
The operational positive result is a real two-transition native trace, not a
presented identity constructor.
-/
theorem producer_relay_native_trace :
    NativeTrace 2
      (.par relayProducer oneShotRelay)
      (.par .zero .zero) := by
  exact
    NativeTrace.snoc
      (NativeTrace.snoc
        (NativeTrace.nil
          (.par relayProducer oneShotRelay))
        producer_relay_native_sync)
      deliveredRelayTarget_native_output

end Cantilune.Pi.OpenSMCLinearOneShotObstruction
