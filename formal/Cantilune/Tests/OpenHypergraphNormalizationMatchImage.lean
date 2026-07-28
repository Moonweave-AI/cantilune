import Cantilune.Core.OpenHypergraphNormalizationMatchImage

/-!
# Regression checks for the active-support match image
-/

namespace Cantilune.Tests.OpenHypergraphNormalizationMatchImage

open Cantilune.Core
open Cantilune.Core.OpenHypergraphNormalizationMatchImage
open Cantilune.Core.OpenHypergraphNormalizationFunctor

variable {σ : FinSignature} {inputs outputs : List σ.Obj}
variable {Node₁ Edge₁ Node₂ Edge₂ : Type}
variable [DecidableEq Node₁] [DecidableEq Edge₁]
variable [DecidableEq Node₂] [DecidableEq Edge₂]
variable
  {G : TypedOpenHypergraph σ inputs outputs Node₁ Edge₁}
  {H : TypedOpenHypergraph σ inputs outputs Node₂ Edge₂}

example
    (first second : TypedOpenHypergraph.Hom G H) :
    TypedOpenHypergraph.normalizeHom first =
        TypedOpenHypergraph.normalizeHom second ↔
      TypedOpenHypergraph.ActiveEquivalent first second :=
  TypedOpenHypergraph.normalizeHom_eq_iff_activeEquivalent

example :
    Function.Injective
      (TypedOpenHypergraph.normalizeActiveHom (G := G) (H := H)) :=
  TypedOpenHypergraph.normalizeActiveHom_injective

example (matching : TypedOpenHypergraph.Monomorphism G H) :
    TypedOpenHypergraph.ActiveMonomorphism G H :=
  TypedOpenHypergraph.ActiveMonomorphism.ofGlobal matching

end Cantilune.Tests.OpenHypergraphNormalizationMatchImage
