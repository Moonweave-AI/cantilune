import Cantilune.Core.CoherentProjection

/-!
# Regression checks for static/operational projection coherence
-/

namespace Cantilune.Tests.CoherentProjection

open CategoryTheory
open Cantilune.Core

#check CategoricalLTSRealization.state_eq_of_arrow_eq
#check CategoricalLTSRealization.state_equiv_iff_iso
#check CategoricalLTSRealization.event_eq_of_stepCell_eq
#check CategoricalLTSRealization.stepCell_representation_independent
#check StaticOperationalCoherence.step_hom_commutes
#check StaticOperationalCoherence.step_right_commutes
#check CoherentCompleteProjectionCertificate.mapped_rewrite_has_native_step
#check CoherentCompleteProjectionCertificate.mapped_rewrite_cell_commutes

universe v u

variable
    {L : ObservableLTS}
    {C : Type u} [Category.{v} C]
    (realization : CategoricalLTSRealization L C)

/-- Realized state equality reflects actual LTS state equality. -/
example {source target : L.State}
    (equality :
      realization.stateArrow source = realization.stateArrow target) :
    source = target :=
  realization.state_eq_of_arrow_eq equality

/-- One cell at fixed endpoints cannot recover two different event labels. -/
example
    {source target : L.State} {first second : L.Event}
    (firstStep : L.ObservableStep source first target)
    (secondStep : L.ObservableStep source second target)
    (equality :
      realization.stepCell firstStep =
        realization.stepCell secondStep) :
    first = second :=
  realization.event_eq_of_stepCell_eq firstStep secondStep equality

end Cantilune.Tests.CoherentProjection
