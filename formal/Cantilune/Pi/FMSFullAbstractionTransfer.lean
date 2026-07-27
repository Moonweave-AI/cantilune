import Cantilune.Pi.FMSExternalPackage

/-!
# Full-abstraction transfer across the operational FMS syntax bridge

`CompleteExternalFMSTheoremPackage` requires the finite-world supported
syntax and the nominally closed late-pi syntax to share one denotation.  This
module derives the corresponding consumer-facing theorems.

All results remain conditional on a supplied complete package.  In
particular, this file does not construct an Abramsky powerdomain or a
solution of the FMS domain equation.
-/

namespace Cantilune.Pi.FMSFullAbstractionTransfer

open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSExternalPackage

namespace CompleteExternalFMSTheoremPackage

/--
The open FMS interpretation is fully abstract for late congruence at every
finite free-name context.  Both sides quantify over the same arbitrary finite
name substitutions; no injectivity restriction is imposed here.
-/
theorem supported_open_full_abstraction
    (package : CompleteExternalFMSTheoremPackage)
    {world : Nat} (left right : SupportedProc world 0) :
    SupportedLateCongruent left right ↔
      OpenDenotationallyEqual package.restriction left right :=
  package.worldIndexedFullAbstraction.open_full_abstraction left right

/--
Consequently the supported finite-context presentation of late congruence is
an equivalence relation.  The proof uses equality of every open denotational
valuation, so it does not assume transitivity of an arbitrary union of
bisimulation witnesses.
-/
theorem supportedLateCongruent_equivalence
    (package : CompleteExternalFMSTheoremPackage)
    (world : Nat) :
    Equivalence
      (fun left right : SupportedProc world 0 =>
        SupportedLateCongruent left right) := by
  constructor
  · intro process
    exact
      (supported_open_full_abstraction package process process).mpr
        (fun _target _valuation => rfl)
  · intro left right related
    have equal :=
      (supported_open_full_abstraction package left right).mp related
    exact
      (supported_open_full_abstraction package right left).mpr
        (fun target valuation => (equal target valuation).symm)
  · intro left middle right leftMiddle middleRight
    have first :=
      (supported_open_full_abstraction package left middle).mp leftMiddle
    have second :=
      (supported_open_full_abstraction package middle right).mp middleRight
    exact
      (supported_open_full_abstraction package left right).mpr
        (fun target valuation =>
          (first target valuation).trans (second target valuation))

/--
Full abstraction for canonical closed reifications of finite-world supported
syntax.

This is stronger than separately exposing the two denotation functions:
the operational relation on the actual raw late-pi representatives is
equivalent to equality in the natural supported-syntax denotation.
-/
theorem supported_full_abstraction
    (package : CompleteExternalFMSTheoremPackage)
    (left right : SupportedProc 0 0) :
    StrongLateBisimilar
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed left).1
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed right).1 ↔
      package.restriction.denote.app 0 left =
        package.restriction.denote.app 0 right := by
  simpa [FMSOperationalSyntaxBridge.SupportedProc.reifyClosed] using
    package.worldIndexedFullAbstraction.closed_full_abstraction
      0 left right

/--
Full abstraction for arbitrary nominally closed processes, expressed solely
through their finite-world supported encodings.
-/
theorem encoded_closed_full_abstraction
    (package : CompleteExternalFMSTheoremPackage)
    (left right : ClosedRaw) :
    StrongLateBisimilar left.1 right.1 ↔
      package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed left) =
        package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed right) := by
  rw [package.lateFullAbstraction.full_abstraction]
  rw [package.operationalDenotation.denote_encode]
  rw [package.operationalDenotation.denote_encode]
  rfl

/--
Encoding and canonical reification preserve and reflect strong late
bisimilarity, including for arbitrary closed nominal processes.

The proof intentionally goes through the shared FMS denotation.  It does not
assume an unproved general theorem saying that every structural congruence is
a late bisimulation.
-/
theorem reify_encode_bisimilarity_iff
    (package : CompleteExternalFMSTheoremPackage)
    (left right : ClosedRaw) :
    StrongLateBisimilar
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed
            (package.operationalDenotation.encodeClosed left)).1
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed
            (package.operationalDenotation.encodeClosed right)).1 ↔
      StrongLateBisimilar left.1 right.1 := by
  rw [supported_full_abstraction package]
  rw [← encoded_closed_full_abstraction package]

/--
Although transitivity of the unrestricted open-process relation is sensitive
to bound-action freshness, the closed relation used by the supplied FMS full
abstraction theorem is an equivalence: it is exactly equality of denotations.
-/
theorem closed_strongLateBisimilar_equivalence
    (package : CompleteExternalFMSTheoremPackage) :
    Equivalence
      (fun left right : ClosedRaw =>
        StrongLateBisimilar left.1 right.1) := by
  constructor
  · intro process
    exact
      (package.lateFullAbstraction.full_abstraction process process).mpr rfl
  · intro left right related
    have equal :=
      (package.lateFullAbstraction.full_abstraction left right).mp related
    exact
      (package.lateFullAbstraction.full_abstraction right left).mpr equal.symm
  · intro left middle right leftMiddle middleRight
    have first :=
      (package.lateFullAbstraction.full_abstraction left middle).mp
        leftMiddle
    have second :=
      (package.lateFullAbstraction.full_abstraction middle right).mp
        middleRight
    exact
      (package.lateFullAbstraction.full_abstraction left right).mpr
        (first.trans second)

/--
A native closed late-pi step remains sound when its endpoints are observed
through the supported-syntax denotation.
-/
theorem encoded_native_step_sound
    (package : CompleteExternalFMSTheoremPackage)
    {source target : ClosedRaw} {action : Raw.Action}
    (step : ClosedLateStep source action target) :
    package.lateFullAbstraction.transition
        (package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed source))
        action
        (package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed target)) := by
  rw [← package.operationalDenotation.denote_encode]
  rw [← package.operationalDenotation.denote_encode]
  exact package.lateFullAbstraction.native_step_sound step

/--
Completeness also transfers to the supported-syntax observation: every
denotational transition from an encoded closed process has a native closed
late-pi witness, and the witness's supported denotation is exactly the
reported target.
-/
theorem encoded_native_step_complete
    (package : CompleteExternalFMSTheoremPackage)
    {source : ClosedRaw} {action : Raw.Action}
    {denotationalTarget : package.domain.agent.obj 0}
    (transition :
      package.lateFullAbstraction.transition
        (package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed source))
        action denotationalTarget) :
    ∃ target : ClosedRaw,
      ClosedLateStep source action target ∧
        package.restriction.denote.app 0
            (package.operationalDenotation.encodeClosed target) =
          denotationalTarget := by
  have nominalTransition :
      package.lateFullAbstraction.transition
        (package.lateFullAbstraction.denote source)
        action denotationalTarget := by
    rw [package.operationalDenotation.denote_encode]
    exact transition
  obtain ⟨target, step, targetDenotation⟩ :=
    package.lateFullAbstraction.native_step_complete nominalTransition
  refine ⟨target, step, ?_⟩
  rw [← package.operationalDenotation.denote_encode]
  exact targetDenotation

end CompleteExternalFMSTheoremPackage

/--
Existence of a complete FMS package yields an actual witness for open full
abstraction at every finite context.  The existential package remains
visible, so this theorem cannot be used when `CompleteFMSAvailable` has not
been constructed.
-/
theorem complete_fms_available_open_full_abstraction
    (available : CompleteFMSAvailable)
    {world : Nat} (left right : SupportedProc world 0) :
    ∃ package : CompleteExternalFMSTheoremPackage,
      SupportedLateCongruent left right ↔
        OpenDenotationallyEqual package.restriction left right := by
  rcases available with ⟨package⟩
  exact
    ⟨package,
      CompleteExternalFMSTheoremPackage.supported_open_full_abstraction
        package left right⟩

end Cantilune.Pi.FMSFullAbstractionTransfer
