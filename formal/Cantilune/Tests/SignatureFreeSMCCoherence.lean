import Cantilune.Core.SignatureFreeSMCCoherence

/-!
# Regression checks for Free-SMC signature-extension coherence
-/

namespace Cantilune.Tests.SignatureFreeSMCCoherence

open Cantilune.Core
open Cantilune.Core.FreeSMCQuotient
open Cantilune.Core.FreeSMCUniversal

example {σ τ υ : FinSignature}
    (first : SignatureExtension σ τ)
    (second : SignatureExtension τ υ)
    {source target : List σ.Obj}
    (diagram : FreeSMC σ source target) :
    HEq
      (FreeSMC.reindex (SignatureExtension.trans first second) diagram)
      (FreeSMC.reindex second (FreeSMC.reindex first diagram)) :=
  FreeSMC.reindex_trans_heq first second diagram

example {σ τ : FinSignature}
    (extension : SignatureExtension σ τ) (ports : Word σ) :
    (SignatureFreeSMC.extensionFunctor extension).obj ports =
      extension.reindexWord ports :=
  SignatureFreeSMC.extensionFunctor_obj extension ports

example {σ τ : FinSignature}
    (extension : SignatureExtension σ τ) :
    Nonempty ((SignatureFreeSMC.extensionFunctor extension).Monoidal) ∧
      Nonempty ((SignatureFreeSMC.extensionFunctor extension).Braided) :=
  SignatureFreeSMC.extensionFunctor_strong_symmetric extension

example {σ τ : FinSignature}
    (extension : SignatureExtension σ τ) (generator : σ.Gen) :
    (SignatureFreeSMC.extensionFunctor extension).map
        (ofRaw (FreeSMC.generator generator)) =
      (SignatureFreeSMC.extensionInterpretation extension).generator
        generator :=
  SignatureFreeSMC.extensionFunctor_map_generator extension generator

end Cantilune.Tests.SignatureFreeSMCCoherence
