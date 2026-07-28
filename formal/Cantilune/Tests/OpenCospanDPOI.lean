import Cantilune.Core.OpenCospanDPOI
import Cantilune.Tests.DPOConcurrency

/-!
# Open-cospan DPOI regression checks

The identity fixture is small on purpose, but it elaborates all new generic
interfaces:

* the category of fixed-boundary open cospans;
* the canonical full DPO derivation for an arbitrary monic legal match;
* an explicit retained-boundary lift through that derivation; and
* the boundary-preserving concurrency isomorphism.
-/

namespace Cantilune.Tests.OpenCospanDPOI

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Core
open Cantilune.Core.AdhesiveDPOI
open Cantilune.Core.OpenCospanDPOI
open Cantilune.Core.OpenCospanDPOI.ConcurrencyBoundary
open Cantilune.Tests.PresheafComplementDPO
open Cantilune.Tests.DPOConcurrency

/-- The identity-open state has the whole fixture as both boundary feet. -/
def identityOpen : OpenCospan G G where
  apex := G
  inputLeg := 𝟙 G
  outputLeg := 𝟙 G
  input_mono := by infer_instance
  output_mono := by infer_instance

example : identityOpen ⟶ identityOpen :=
  𝟙 identityOpen

noncomputable abbrev canonicalIdentityDerivation :
    Derivation identityRule identityMatch :=
  OpenCospanDPOI.Presheaf.canonicalDerivation identity_legal

example :
    Nonempty (Derivation identityRule identityMatch) :=
  OpenCospanDPOI.Presheaf.arbitrary_monic_gluing_has_derivation
    identity_legal

/-- The identity rule retains both identity boundary legs. -/
noncomputable def canonicalIdentityBoundary :
    BoundaryLift
      (hostOpen := identityOpen)
      canonicalIdentityDerivation where
  inputToComplement :=
    canonicalIdentityDerivation.interfaceToComplement
  outputToComplement :=
    canonicalIdentityDerivation.interfaceToComplement
  input_factor := by
    simpa [canonicalIdentityDerivation, identityOpen, identityRule,
      identityMatch] using
      canonicalIdentityDerivation.complementSquare.w.symm
  output_factor := by
    simpa [canonicalIdentityDerivation, identityOpen, identityRule,
      identityMatch] using
      canonicalIdentityDerivation.complementSquare.w.symm

noncomputable example : OpenCospan G G :=
  canonicalIdentityBoundary.resultOpen

example :
    Mono canonicalIdentityBoundary.inputToComplement :=
  canonicalIdentityBoundary.inputToComplement_mono

/-- The common identity boundary embeds in the pullback joint context. -/
noncomputable def identityJointBoundary :
    ConcurrencyBoundary.JointBoundary
      (hostOpen := identityOpen)
      (independent := identityIndependent) where
  inputToJoint :=
    pullback.lift (𝟙 G) (𝟙 G) (by simp [identityDerivation])
  outputToJoint :=
    pullback.lift (𝟙 G) (𝟙 G) (by simp [identityDerivation])
  input_factor := by
    simpa [identityDerivation, identityOpen,
        DPOConcurrency.ParallelIndependent.jointToFirst] using
      (pullback.lift_fst
        (𝟙 G) (𝟙 G)
        (by simp : (𝟙 G) ≫ (𝟙 G) = (𝟙 G) ≫ (𝟙 G)))
  output_factor := by
    simpa [identityDerivation, identityOpen,
        DPOConcurrency.ParallelIndependent.jointToFirst] using
      (pullback.lift_fst
        (𝟙 G) (𝟙 G)
        (by simp : (𝟙 G) ≫ (𝟙 G) = (𝟙 G) ≫ (𝟙 G)))

noncomputable example :
    identityJointBoundary.firstAfterSecondOpen ≅
      identityJointBoundary.secondAfterFirstOpen :=
  identityJointBoundary.concurrencyOpenIso

example :
    identityJointBoundary.firstAfterSecondOpen.inputLeg ≫
        identityJointBoundary.concurrencyOpenIso.hom.apex =
      identityJointBoundary.secondAfterFirstOpen.inputLeg :=
  identityJointBoundary.concurrency_preserves_input_boundary

example :
    identityJointBoundary.firstAfterSecondOpen.outputLeg ≫
        identityJointBoundary.concurrencyOpenIso.hom.apex =
      identityJointBoundary.secondAfterFirstOpen.outputLeg :=
  identityJointBoundary.concurrency_preserves_output_boundary

end Cantilune.Tests.OpenCospanDPOI
