import Cantilune.Pi.FMSCpoConcreteEmbeddingCategoricalColimit

noncomputable section

namespace Cantilune.Tests.FMSCpoConcreteEmbeddingCategoricalColimit

open CategoryTheory
open CategoryTheory.Limits
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

#check ConcreteEmbeddingIndex
#check concreteEmbeddingDiagram
#check concreteEmbeddingCategoricalCocone
#check ConcreteEmbeddingCocone.ofCategorical
#check concreteEmbeddingCategoricalIsColimit

example :
    IsColimit concreteEmbeddingCategoricalCocone :=
  concreteEmbeddingCategoricalIsColimit

example
    (cocone : Cocone concreteEmbeddingDiagram)
    (index : ConcreteEmbeddingIndex) :
    concreteEmbeddingCategoricalCocone.ι.app index ≫
        concreteEmbeddingCategoricalIsColimit.desc cocone =
      cocone.ι.app index :=
  concreteEmbeddingCategoricalIsColimit.fac cocone index

example
    (cocone : Cocone concreteEmbeddingDiagram)
    (candidate :
      concreteEmbeddingCategoricalCocone.pt ⟶ cocone.pt)
    (fac :
      ∀ index,
        concreteEmbeddingCategoricalCocone.ι.app index ≫
            candidate =
          cocone.ι.app index) :
    candidate =
      concreteEmbeddingCategoricalIsColimit.desc cocone :=
  concreteEmbeddingCategoricalIsColimit.uniq
    cocone candidate fac

#print axioms concreteStageMap_forward_comp
#print axioms concreteEmbeddingCategoricalIsColimit

end Cantilune.Tests.FMSCpoConcreteEmbeddingCategoricalColimit
