import Cantilune.Pi.FMSActualAgentNormativeCommutation
import Cantilune.Pi.OpenSMCActionAlpha

/-!
# Exact boundary for compiling the normative processes to supported syntax

`SupportedProc` has every finite-control constructor used by the fifteen
normative families.  Its canonical nominal realization `reifyAtWorld`,
however, allocates a binder at the world size and then increments the supply.
The reference raw processes deliberately use the concrete binders `0 .. 7`.
Consequently a bridge based on literal raw-syntax equality is impossible even
for the elementary input and bound-output families.

This module kernel-checks that obstruction and the intended repair:

* the canonical supported input and bound-output terms are not literally the
  corresponding reference raw sources;
* they are process-alpha equivalent; and
* their labelled derivatives are equal in the joint `DerivativeAlpha`
  relation.

Thus the future all-fifteen supported/Agent bridge must pass through the
ratified process-alpha and derivative-alpha quotients.  It must not claim
literal `reifyAtWorld = readyProcess` for binder-bearing events.
-/

namespace Cantilune.Pi.FMSNormativeSupportedCompileBoundary

open Cantilune.Pi
open Cantilune.Pi.Protocols
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSOperationalSyntaxBridge
open Cantilune.Pi.P1cMatrix
open Cantilune.Pi.P1cFullNativeRefinement
open Cantilune.Pi.OpenSMCActionAlpha
open Cantilune.Pi.FMSActualAgentNormativeCommutation

/--
The five binder-free reference sources are the literal-realization candidates.
The remaining ten families require process-alpha freshening before comparing
their canonical supported realization with the fixed nominal reference.  This
finite classification is not itself the eventual per-event equality proof.
-/
inductive CompileMode where
  | literal
  | throughAlpha
  deriving DecidableEq, Repr, Fintype

def normativeCompileMode : SourceEvent → CompileMode
  | .freeOutput
  | .choiceLeft
  | .choiceRight
  | .matchSuccess
  | .mismatchGuard => .literal
  | .boundOutput
  | .lateInput
  | .communication
  | .openClose
  | .restriction
  | .scopeExtrusion
  | .delegation
  | .dynamicPartnerAdmission
  | .instanceReconnect
  | .instanceDeleteQuiescent => .throughAlpha

theorem literal_family_count :
    (Finset.univ.filter
      (fun event : SourceEvent =>
        normativeCompileMode event = .literal)).card = 5 := by
  decide

theorem alpha_family_count :
    (Finset.univ.filter
      (fun event : SourceEvent =>
        normativeCompileMode event = .throughAlpha)).card = 10 := by
  decide

/-! ## Elementary input: exact obstruction and alpha repair -/

def canonicalLateInput :
    SupportedProc normativeBaseWorld 0 :=
  .input (.free (1 : Fin normativeBaseWorld)) .zero

theorem canonicalLateInput_reify :
    FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        canonicalLateInput =
      Raw.Proc.recv session normativeBaseWorld .zero := by
  rfl

theorem canonicalLateInput_not_literal :
    FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        canonicalLateInput ≠
      readyProcess .lateInput := by
  decide

/--
The obstruction is not specific to the chosen supported input: canonical
world-eight reification always chooses binder eight for a top-level input,
whereas the fixed reference source declares binder four.
-/
theorem lateInput_not_in_canonical_reify_range :
    ¬ ∃ process : SupportedProc normativeBaseWorld 0,
      FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld process =
        readyProcess .lateInput := by
  rintro ⟨process, equal⟩
  cases process <;>
    simp [FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld,
      FMSOperationalSyntaxBridge.SupportedProc.reify,
      readyProcess, messageReceiver, Proc.erase] at equal
  norm_num [normativeBaseWorld, payloadBinder] at equal

theorem canonicalLateInput_alpha :
    Late.Alpha
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        canonicalLateInput)
      (readyProcess .lateInput) := by
  change
    Late.Alpha
      (.recv session normativeBaseWorld .zero)
      (.recv session payloadBinder .zero)
  convert
    (Late.Alpha.recvBinder
      (ch := session)
      (binder := normativeBaseWorld)
      (body := Raw.Proc.zero)
      (replacement := payloadBinder)
      (by decide)) using 1 <;>
    simp [Raw.Proc.renameBound, Raw.Proc.substRaw]

theorem canonicalLateInput_derivative_alpha :
    DerivativeAlpha
      ⟨.input session normativeBaseWorld, .zero⟩
      ⟨firstAction .lateInput, firstTarget .lateInput⟩ := by
  change
    DerivativeAlpha
      ⟨.input session normativeBaseWorld, .zero⟩
      ⟨.input session payloadBinder, .zero⟩
  convert
    (DerivativeAlpha.inputBinder
      (channel := session)
      (binder := normativeBaseWorld)
      (replacement := payloadBinder)
      (target := Raw.Proc.zero)
      (by decide)
      (by decide)) using 1 <;>
    simp [Raw.Proc.renameBound, Raw.Proc.substRaw]

/-! ## Elementary bound output: exact obstruction and alpha repair -/

def canonicalBoundOutput :
    SupportedProc normativeBaseWorld 0 :=
  .restrict
    (.output
      (.free (5 : Fin normativeBaseWorld))
      (.bound (Fin.last 0))
      .zero)

theorem canonicalBoundOutput_reify :
    FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        canonicalBoundOutput =
      Raw.Proc.new normativeBaseWorld
        (Raw.Proc.send delegationBus normativeBaseWorld .zero) := by
  rfl

theorem canonicalBoundOutput_not_literal :
    FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        canonicalBoundOutput ≠
      readyProcess .boundOutput := by
  decide

/--
Likewise every canonically reified top-level restriction at world eight uses
binder eight, so no supported term can be literally the reference `new 6`
bound-output source.
-/
theorem boundOutput_not_in_canonical_reify_range :
    ¬ ∃ process : SupportedProc normativeBaseWorld 0,
      FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld process =
        readyProcess .boundOutput := by
  rintro ⟨process, equal⟩
  cases process <;>
    simp [FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld,
      FMSOperationalSyntaxBridge.SupportedProc.reify,
      readyProcess, Proc.erase] at equal
  norm_num [normativeBaseWorld, delegated] at equal

theorem canonicalBoundOutput_alpha :
    Late.Alpha
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        canonicalBoundOutput)
      (readyProcess .boundOutput) := by
  change
    Late.Alpha
      (.new normativeBaseWorld
        (.send delegationBus normativeBaseWorld .zero))
      (.new delegated
        (.send delegationBus delegated .zero))
  convert
    (Late.Alpha.newBinder
      (binder := normativeBaseWorld)
      (body :=
        Raw.Proc.send delegationBus normativeBaseWorld .zero)
      (replacement := delegated)
      (by decide)) using 1 <;>
    simp [Raw.Proc.renameBound, Raw.Proc.substRaw] <;>
    decide

theorem canonicalBoundOutput_derivative_alpha :
    DerivativeAlpha
      ⟨.boundOutput delegationBus normativeBaseWorld, .zero⟩
      ⟨firstAction .boundOutput, firstTarget .boundOutput⟩ := by
  change
    DerivativeAlpha
      ⟨.boundOutput delegationBus normativeBaseWorld, .zero⟩
      ⟨.boundOutput delegationBus delegated, .zero⟩
  convert
    (DerivativeAlpha.boundOutputBinder
      (channel := delegationBus)
      (binder := normativeBaseWorld)
      (replacement := delegated)
      (target := Raw.Proc.zero)
      (by decide)
      (by decide)
      (by decide)) using 1 <;>
    simp [Raw.Proc.renameBound, Raw.Proc.substRaw]

/--
The exact minimal interface required from the eventual all-fifteen bridge.
It records a supported source and target, alpha comparison with the fixed raw
reference, and joint derivative-alpha comparison of the native endpoint.
The total supported coalgebra must additionally prove that its denotation
unfolds to the actual action carrying the denotation of `target`.
-/
structure SupportedNormativeAlphaBridge (event : SourceEvent) where
  source : SupportedProc normativeBaseWorld 0
  target : SupportedProc normativeBaseWorld 0
  action : Raw.Action
  sourceAlpha :
    Late.Alpha
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld source)
      (readyProcess event)
  native :
    Late.NativeStep
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld source)
      action
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld target)
  derivativeAlpha :
    DerivativeAlpha
      ⟨action,
        FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld target⟩
      ⟨firstAction event, firstTarget event⟩

end Cantilune.Pi.FMSNormativeSupportedCompileBoundary
