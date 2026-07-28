import Cantilune.Core.OpenHypergraphNormalizationFunctor

/-!
Kernel-checked regressions for functorial active-support normalization.
-/

namespace Cantilune.Tests.OpenHypergraphNormalizationFunctor

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.OpenHypergraphNormalizationFunctor

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
variable {Node₁ Edge₁ Node₂ Edge₂ Node₃ Edge₃ : Type}
variable [DecidableEq Node₁] [DecidableEq Edge₁]
variable [DecidableEq Node₂] [DecidableEq Edge₂]
variable [DecidableEq Node₃] [DecidableEq Edge₃]

variable
  {G : TypedOpenHypergraph σ inputTypes outputTypes Node₁ Edge₁}
  {H : TypedOpenHypergraph σ inputTypes outputTypes Node₂ Edge₂}
  {J : TypedOpenHypergraph σ inputTypes outputTypes Node₃ Edge₃}

open Cantilune.Core.OpenHypergraphNormalizationFunctor.TypedOpenHypergraph

example (f : TypedOpenHypergraph.Hom G H) :
    normalized G ⟶ normalized H :=
  normalizeHom f

example :
    normalizeHom (TypedOpenHypergraph.Hom.id G) = 𝟙 (normalized G) :=
  normalizeHom_id

example (f : TypedOpenHypergraph.Hom G H)
    (g : TypedOpenHypergraph.Hom H J) :
    normalizeHom (TypedOpenHypergraph.Hom.comp f g) =
      normalizeHom f ≫ normalizeHom g :=
  normalizeHom_comp f g

example (f : TypedOpenHypergraph.Monomorphism G H) :
    Mono (normalizeHom f.toHom) :=
  normalizeHom_mono f

example (f : TypedOpenHypergraph.Monomorphism G H) :
    Mono
      ((Cantilune.Core.PositionalDPOI.encodingFunctor
          σ inputTypes outputTypes).map (normalizeHom f.toHom)) :=
  normalizeHom_ambient_mono f

variable
  {rule :
    AdhesiveDPOI.Rule
      (FinitePresheafDPOI.typeGraph σ inputTypes outputTypes)}

example
    (leftIdentification : rule.left = (normalized G).encoded)
    (f : TypedOpenHypergraph.Monomorphism G H) :
    AdhesiveDPOI.Match rule (normalized H).encoded :=
  normalizedMatch leftIdentification f

example
    (leftIdentification : rule.left = (normalized G).encoded)
    (f : TypedOpenHypergraph.Monomorphism G H)
    (legal :
      PresheafComplementDPO.Presheaf.LegalMatch rule
        (normalizedMatch leftIdentification f)) :
    Nonempty
      (AdhesiveDPOI.Derivation rule
        (normalizedMatch leftIdentification f)) :=
  normalized_monic_gluing_has_derivation leftIdentification f legal

end Cantilune.Tests.OpenHypergraphNormalizationFunctor
