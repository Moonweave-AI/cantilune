import Mathlib
import Cantilune.Core.Admission
import Cantilune.Core.DPO
import Cantilune.Core.Package
import Cantilune.Core.SignatureCoherence

/-!
# Structural safety regressions

These checks exercise the type-level copy/drop prohibition, signature
preservation, complete-event replay, deletion preconditions, and the concrete
finite-support concurrency fragment.
-/

namespace Cantilune.Tests.Safety

open Cantilune.Core

example : ¬StructuralMode.linear.AllowsCopy :=
  StructuralMode.linear_forbidsCopy

example : ¬StructuralMode.linear.AllowsDrop :=
  StructuralMode.linear_forbidsDrop

example {σ τ : FinSignature} (extension : SignatureExtension σ τ)
    (generator : σ.Gen) :
    σ.contract generator = τ.contract (extension.gen generator) :=
  extension.contract_preserved generator

example {σ τ υ : FinSignature}
    (first : SignatureExtension σ τ)
    (second : SignatureExtension τ υ)
    (ports : List σ.Obj) :
    (SignatureExtension.trans first second).reindexWord ports =
      second.reindexWord (first.reindexWord ports) :=
  SignatureExtension.reindexWord_trans first second ports

example {universes : ProjectionUniverses}
    {σ τ υ : FinSignature}
    {first : SignatureExtension σ τ}
    {second : SignatureExtension τ υ}
    {old : FourSignatureViews universes σ}
    {middle : FourSignatureViews universes τ}
    {new : FourSignatureViews universes υ}
    (firstAdmission : FourViewAdmission universes first old middle)
    (secondAdmission : FourViewAdmission universes second middle new) :
    FourViewAdmission universes
      (SignatureExtension.trans first second) old new :=
  firstAdmission.trans secondAdmission

example {σ : FinSignature} {kernel : DPOEvent.ReplayKernel σ}
    {event : DPOEvent.Verified kernel}
    {source left right : Config σ}
    (leftReplay : event.Replays source left)
    (rightReplay : event.Replays source right) :
    left = right :=
  DPOEvent.event_replay_unique leftReplay rightReplay

example {σ : FinSignature} (package : ExecutionPackage σ)
    {state : package.lts.State}
    (permitted : package.deletionPermitted state) :
    package.resourcesClear state ∧ package.sessionsQuiescent state :=
  ⟨package.deletion_resource_safe permitted,
    package.deletion_session_safe permitted⟩

def leftEvent : DPO.FiniteSupportEvent Nat where
  erase := {0}
  insert := {2}
  internallyDisjoint := by decide

def rightEvent : DPO.FiniteSupportEvent Nat where
  erase := {1}
  insert := {3}
  internallyDisjoint := by decide

example :
    DPO.FiniteSupportEvent.Independent leftEvent rightEvent := by
  constructor <;> simp [leftEvent, rightEvent]

example :
    rightEvent.Enabled (leftEvent.apply {0, 1}) ∧
      leftEvent.Enabled (rightEvent.apply {0, 1}) ∧
      rightEvent.apply (leftEvent.apply {0, 1}) =
        leftEvent.apply (rightEvent.apply {0, 1}) :=
  dpo_concurrency
    (by constructor <;> simp [leftEvent, rightEvent])
    (by simp [DPO.FiniteSupportEvent.Enabled, leftEvent])
    (by simp [DPO.FiniteSupportEvent.Enabled, rightEvent])

end Cantilune.Tests.Safety
