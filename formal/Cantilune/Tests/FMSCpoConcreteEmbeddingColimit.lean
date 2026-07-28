import Cantilune.Pi.FMSCpoConcreteEmbeddingColimit

namespace Cantilune.Tests.FMSCpoConcreteEmbeddingColimit

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

#check ConcreteEmbeddingCocone
#check ConcreteEmbeddingCocone.desc
#check ConcreteEmbeddingCocone.embedding_desc
#check ConcreteEmbeddingCocone.desc_unique
#check ConcreteEmbeddingCoconeIsColimit
#check concreteEmbeddingCoconeIsColimit

example
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (n : Nat) :
    concreteIterationLimitEmbedding n ≫
        concreteEmbeddingCoconeIsColimit.desc cocone =
      cocone.leg n :=
  concreteEmbeddingCoconeIsColimit.fac cocone n

example
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (candidate : concreteIterationLimit ⟶ target)
    (fac :
      ∀ n,
        concreteIterationLimitEmbedding n ≫ candidate =
          cocone.leg n) :
    candidate =
      concreteEmbeddingCoconeIsColimit.desc cocone :=
  concreteEmbeddingCoconeIsColimit.uniq cocone candidate fac

#print axioms concreteEmbeddingCoconeIsColimit

end Cantilune.Tests.FMSCpoConcreteEmbeddingColimit
