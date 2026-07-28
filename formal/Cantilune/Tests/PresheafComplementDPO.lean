import Cantilune.Core.PresheafComplementDPO
import Cantilune.Tests.PositionalDPOI

/-!
# General presheaf-complement regression checks

The identity rule is deliberately simple, but it exercises the general monic
match API rather than the fixed-host inclusion fragment.
-/

namespace Cantilune.Tests.PresheafComplementDPO

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.AdhesiveDPOI
open Cantilune.Core.PositionalDPOI
open Cantilune.Core.PresheafComplementDPO
open Cantilune.Tests.PositionalDPOI

abbrev T :=
  Cantilune.Core.FinitePresheafDPOI.typeGraph
    signature [] []

abbrev G : TypedHypergraph T :=
  (encodingFunctor signature [] []).obj graph

def identityRule : Rule T where
  interface := G
  left := G
  right := G
  leftLeg := 𝟙 G
  rightLeg := 𝟙 G
  left_mono := by infer_instance
  right_mono := by infer_instance

def identityMatch : Match identityRule G where
  arrow := identityRule.leftLeg
  mono := identityRule.left_mono

theorem identity_legal :
    Presheaf.LegalMatch identityRule identityMatch := by
  intro X Y f x hx hdel
  rcases hdel with ⟨y, _, hno⟩
  exact hno y (by rfl)

example :
    Nonempty
      (DPO.PushoutComplement
        identityRule.leftLeg identityMatch.arrow) :=
  Presheaf.complement_exists identity_legal

example :
    Nonempty
      (DPO.PushoutComplement
        identityRule.leftLeg identityMatch.arrow) ↔
      Presheaf.LegalMatch identityRule identityMatch :=
  Presheaf.complement_exists_iff_gluing

noncomputable example :
    (Presheaf.pushoutComplement identity_legal).context ≅
      Presheaf.complement
        (Presheaf.gluing_of_complement
          (Presheaf.pushoutComplement identity_legal)) :=
  Presheaf.complementUniqueIso
    (Presheaf.pushoutComplement identity_legal)

end Cantilune.Tests.PresheafComplementDPO
