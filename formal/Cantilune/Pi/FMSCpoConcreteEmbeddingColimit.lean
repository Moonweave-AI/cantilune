import Cantilune.Pi.FMSCpoConcreteBilimitExhaustivity

/-!
# The embedding colimit carried by the concrete EP bilimit

The projection-limit construction supplies an object
`concreteIterationLimit`, projections `pₙ : L ⟶ Aₙ`, embeddings
`eₙ : Aₙ ⟶ L`, and the exhaustive approximation equation

`x = ωSupₙ eₙ (pₙ x)`.

This module proves the other universal property of the same object.  For an
arbitrary target model `X` and an arbitrary cocone
`cₙ : Aₙ ⟶ X` compatible with the concrete tower embeddings, the map

`desc(c) = ωSupₙ (pₙ ≫ cₙ)`

is continuous and natural, factors every cocone leg, and is the unique map
with that property.  Thus the concrete EP bilimit is also the colimit of its
embedding chain.

We state the universal property directly over adjacent tower connectors.
This is equivalent to the usual `IsColimit` statement for the free
successor-chain category, while avoiding a second indexing category and the
associated arithmetic transports.  Crucially, the property quantifies over
every target and every compatible cocone; it is not restricted to canonical
finite-stage legs.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary

/-! ## Arbitrary cocones over the concrete embedding tower -/

/--
An arbitrary cocone over the adjacent embeddings of the concrete recursive
tower.
-/
structure ConcreteEmbeddingCocone
    (target : World ⥤ ωCPO) where
  leg :
    ∀ n, ConcreteActualIteration n ⟶ target
  compatible :
    ∀ n,
      (concreteActualIterationPair n).embedding ≫ leg (n + 1) =
        leg n

namespace ConcreteEmbeddingCocone

/--
Advancing the target of a canonical finite-stage map by one embedding.
-/
theorem concreteStageMap_target_embedding
    (source target : Nat)
    (ordered : source ≤ target) :
    concreteStageMap source target ≫
        (concreteActualIterationPair target).embedding =
      concreteStageMap source target.succ := by
  induction source generalizing target with
  | zero =>
      simpa only [concreteStageMap_zero] using
        concreteZeroStageMap_embedding target
  | succ source inductionHypothesis =>
      cases target with
      | zero =>
          omega
      | succ target =>
          have smaller : source ≤ target := by omega
          rw [concreteStageMap_succ_succ]
          rw [concreteStageMap_succ_succ]
          change
            ActualAgentFunctor.map (concreteStageMap source target) ≫
                ActualAgentFunctor.map
                  (concreteActualIterationPair target).embedding =
              ActualAgentFunctor.map
                (concreteStageMap source target.succ)
          rw [← ActualAgentFunctor.map_comp]
          rw [inductionHypothesis target smaller]

/--
Forward canonical stage maps are exactly respected by every embedding
cocone.
-/
theorem forward_stageMap_fac
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (source later : Nat)
    (ordered : source ≤ later) :
    concreteStageMap source later ≫ cocone.leg later =
      cocone.leg source := by
  induction later with
  | zero =>
      have sourceZero : source = 0 := by omega
      subst source
      rw [concreteStageMap_diagonal]
      exact Category.id_comp _
  | succ later inductionHypothesis =>
      by_cases diagonal : source = later.succ
      · subst source
        rw [concreteStageMap_diagonal]
        exact Category.id_comp _
      · have sourceEarlier : source ≤ later := by omega
        rw [← concreteStageMap_target_embedding
          source later sourceEarlier]
        rw [Category.assoc]
        rw [cocone.compatible later]
        exact inductionHypothesis sourceEarlier

/--
Backward canonical stage maps are below the source leg of every embedding
cocone.  The inequality is exactly where the EP approximation law
`embedding ≫ projection ≤ id` is used.
-/
theorem backward_stageMap_le
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (source earlier : Nat)
    (ordered : earlier ≤ source) :
    TransformationPointwiseLE
      (concreteStageMap source earlier ≫ cocone.leg earlier)
      (cocone.leg source) := by
  induction source with
  | zero =>
      have earlierZero : earlier = 0 := by omega
      subst earlier
      rw [concreteStageMap_diagonal]
      intro world value
      exact le_rfl
  | succ source inductionHypothesis =>
      by_cases diagonal : earlier = source.succ
      · subst earlier
        rw [concreteStageMap_diagonal]
        intro world value
        exact le_rfl
      · have earlierBefore : earlier ≤ source := by omega
        intro world value
        have previous :=
          inductionHypothesis earlierBefore world
            (((concreteActualIterationPair source).projection).app
              world value)
        have compatibleAtValue :
            (cocone.leg source).app world
                (((concreteActualIterationPair source).projection).app
                  world value) =
              (cocone.leg source.succ).app world
                (((concreteActualIterationPair source).embedding).app
                  world
                  (((concreteActualIterationPair source).projection).app
                    world value)) := by
          exact
            (ContinuousHom.congr_fun
              (NatTrans.congr_app
                (cocone.compatible source)
                world)
              (((concreteActualIterationPair source).projection).app
                world value)).symm
        calc
          (concreteStageMap source.succ earlier ≫
              cocone.leg earlier).app world value =
            (concreteStageMap source earlier ≫
              cocone.leg earlier).app world
                (((concreteActualIterationPair source).projection).app
                  world value) := by
                    rw [← concreteStageMap_source_projection
                      source earlier earlierBefore]
                    rfl
          _ ≤
            (cocone.leg source).app world
                (((concreteActualIterationPair source).projection).app
                  world value) :=
              previous
          _ =
            (cocone.leg source.succ).app world
                (((concreteActualIterationPair source).embedding).app
                  world
                  (((concreteActualIterationPair source).projection).app
                    world value)) :=
              compatibleAtValue
          _ ≤
            (cocone.leg source.succ).app world value :=
              (cocone.leg source.succ).app world |>.monotone
                ((concreteActualIterationPair source).embedding_projection_le
                  world value)

/--
Every canonical map between finite stages is below the corresponding source
cocone leg; it is an equality in the forward direction.
-/
theorem stageMap_le
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (source stage : Nat) :
    TransformationPointwiseLE
      (concreteStageMap source stage ≫ cocone.leg stage)
      (cocone.leg source) := by
  by_cases forward : source ≤ stage
  · rw [cocone.forward_stageMap_fac source stage forward]
    intro world value
    exact le_rfl
  · exact
      cocone.backward_stageMap_le source stage
        (Nat.le_of_not_ge forward)

/-! ## Supremum mediator -/

/-- The finite approximants to the cocone mediator. -/
def mediatorApproximation
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (stage : Nat) :
    concreteIterationLimit ⟶ target :=
  concreteIterationLimitProjection stage ≫ cocone.leg stage

/-- Consecutive mediator approximants are pointwise ordered. -/
theorem mediatorApproximation_le_succ
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (stage : Nat) :
    TransformationPointwiseLE
      (cocone.mediatorApproximation stage)
      (cocone.mediatorApproximation stage.succ) := by
  intro world value
  have projectionValue :
      (concreteIterationLimitProjection stage).app world value =
        ((concreteActualIterationPair stage).projection).app world
          ((concreteIterationLimitProjection stage.succ).app
            world value) :=
    ContinuousHom.congr_fun
      (NatTrans.congr_app
        (concreteIterationLimitProjection_compatible stage)
        world)
      value |>.symm
  calc
    (cocone.mediatorApproximation stage).app world value =
      (cocone.leg stage).app world
        (((concreteActualIterationPair stage).projection).app world
          ((concreteIterationLimitProjection stage.succ).app
            world value)) := by
              unfold mediatorApproximation
              change
                (cocone.leg stage).app world
                    ((concreteIterationLimitProjection stage).app
                      world value) =
                  _
              rw [projectionValue]
    _ =
      (cocone.leg stage.succ).app world
        (((concreteActualIterationPair stage).embedding).app world
          (((concreteActualIterationPair stage).projection).app world
            ((concreteIterationLimitProjection stage.succ).app
              world value))) := by
                exact
                  (ContinuousHom.congr_fun
                    (NatTrans.congr_app
                      (cocone.compatible stage)
                      world)
                    (((concreteActualIterationPair stage).projection).app
                      world
                      ((concreteIterationLimitProjection stage.succ).app
                        world value))).symm
    _ ≤
      (cocone.leg stage.succ).app world
        ((concreteIterationLimitProjection stage.succ).app
          world value) :=
            (cocone.leg stage.succ).app world |>.monotone
              ((concreteActualIterationPair stage).embedding_projection_le
                world
                  ((concreteIterationLimitProjection stage.succ).app
                    world value))
    _ = (cocone.mediatorApproximation stage.succ).app world value := rfl

/-- All mediator approximants form a pointwise omega-chain. -/
theorem mediatorApproximation_monotone
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target) :
    ∀ {first second : Nat}, first ≤ second →
      TransformationPointwiseLE
        (cocone.mediatorApproximation first)
        (cocone.mediatorApproximation second) := by
  intro first second ordered
  induction second generalizing first with
  | zero =>
      have firstZero : first = 0 := by omega
      subst first
      intro world value
      exact le_rfl
  | succ second inductionHypothesis =>
      by_cases equal : first = second.succ
      · subst first
        intro world value
        exact le_rfl
      · have earlier : first ≤ second := by omega
        intro world value
        exact
          le_trans
            (inductionHypothesis earlier world value)
            (cocone.mediatorApproximation_le_succ second world value)

/--
The continuous natural mediator induced by an arbitrary embedding cocone.
-/
def desc
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target) :
    concreteIterationLimit ⟶ target :=
  transformationSupremum
    cocone.mediatorApproximation
    cocone.mediatorApproximation_monotone

/-- Pointwise formula for the cocone mediator. -/
theorem desc_pointwise
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (world : World)
    (value : concreteIterationLimit.obj world) :
    cocone.desc.app world value =
      ωSup
        (transformationEvaluationChain
          cocone.mediatorApproximation
          cocone.mediatorApproximation_monotone
          world value) :=
  transformationSupremum_pointwise
    cocone.mediatorApproximation
    cocone.mediatorApproximation_monotone
    world value

/--
The supremum mediator factors every leg of every embedding cocone.
-/
theorem embedding_desc
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (source : Nat) :
    concreteIterationLimitEmbedding source ≫ cocone.desc =
      cocone.leg source := by
  apply NatTrans.ext
  funext world
  apply ContinuousHom.ext
  intro value
  apply le_antisymm
  · change
      cocone.desc.app world
          ((concreteIterationLimitEmbedding source).app world value) ≤
        (cocone.leg source).app world value
    rw [cocone.desc_pointwise]
    apply ωSup_le
    intro stage
    change
      (cocone.leg stage).app world
          ((concreteIterationLimitProjection stage).app world
            ((concreteIterationLimitEmbedding source).app world value)) ≤
        (cocone.leg source).app world value
    have stageObservation :=
      ContinuousHom.congr_fun
        (NatTrans.congr_app
          (concreteIterationLimitEmbedding_projection_stageMap
            source stage)
          world)
        value
    change
      (cocone.leg stage).app world
          ((concreteIterationLimitEmbedding source ≫
            concreteIterationLimitProjection stage).app world value) ≤
        _
    calc
      _ =
        (cocone.leg stage).app world
          ((concreteStageMap source stage).app world value) :=
            congrArg
              (fun observed => (cocone.leg stage).app world observed)
              stageObservation
      _ ≤ (cocone.leg source).app world value :=
        cocone.stageMap_le source stage world value
  · change
      (cocone.leg source).app world value ≤
        cocone.desc.app world
          ((concreteIterationLimitEmbedding source).app world value)
    rw [cocone.desc_pointwise]
    have sourceRetraction :=
      ContinuousHom.congr_fun
        (NatTrans.congr_app
          (concreteIterationLimitEmbedding_projection source)
          world)
        value
    have sourceRetractionValue :
        (concreteIterationLimitEmbedding source ≫
            concreteIterationLimitProjection source).app world value =
          value := by
      change
        (((concreteIterationLimitEmbedding source).app world ≫
          (concreteIterationLimitProjection source).app world) value) =
            value
      calc
        _ =
          (𝟙 ((ConcreteActualIteration source).obj world) :
            (ConcreteActualIteration source).obj world ⟶
              (ConcreteActualIteration source).obj world) value :=
            sourceRetraction
        _ = value := rfl
    calc
      (cocone.leg source).app world value =
        (cocone.mediatorApproximation source).app world
          ((concreteIterationLimitEmbedding source).app world value) := by
            unfold mediatorApproximation
            change
              (cocone.leg source).app world value =
                (cocone.leg source).app world
                  ((concreteIterationLimitEmbedding source ≫
                    concreteIterationLimitProjection source).app
                    world value)
            exact
              congrArg
                (fun observed =>
                  (cocone.leg source).app world observed)
                sourceRetractionValue |>.symm
      _ ≤
        ωSup
          (transformationEvaluationChain
            cocone.mediatorApproximation
            cocone.mediatorApproximation_monotone
            world
            ((concreteIterationLimitEmbedding source).app
              world value)) :=
          le_ωSup
            (transformationEvaluationChain
              cocone.mediatorApproximation
              cocone.mediatorApproximation_monotone
              world
              ((concreteIterationLimitEmbedding source).app
                world value))
            source

/--
Any map out of the concrete limit that factors the cocone legs is equal to
the supremum mediator.
-/
theorem desc_unique
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target)
    (candidate : concreteIterationLimit ⟶ target)
    (fac :
      ∀ n,
        concreteIterationLimitEmbedding n ≫ candidate =
          cocone.leg n) :
    candidate = cocone.desc := by
  apply NatTrans.ext
  funext world
  apply ContinuousHom.ext
  intro value
  calc
    candidate.app world value =
      candidate.app world
        (ωSup
          (transformationEvaluationChain
            concreteLimitApproximation
            concreteLimitApproximation_monotone
            world value)) := by
              rw [← concreteLimitApproximation_exhaustive world value]
    _ =
      ωSup
        ((transformationEvaluationChain
          concreteLimitApproximation
          concreteLimitApproximation_monotone
          world value).map
            (candidate.app world).toOrderHom) :=
              (candidate.app world).continuous _
    _ =
      ωSup
        (transformationEvaluationChain
          cocone.mediatorApproximation
          cocone.mediatorApproximation_monotone
          world value) := by
            apply congrArg ωSup
            apply Chain.ext
            funext stage
            change
              candidate.app world
                  ((concreteIterationLimitEmbedding stage).app world
                    ((concreteIterationLimitProjection stage).app
                      world value)) =
                (cocone.leg stage).app world
                  ((concreteIterationLimitProjection stage).app
                    world value)
            exact
              ContinuousHom.congr_fun
                (NatTrans.congr_app (fac stage) world)
                ((concreteIterationLimitProjection stage).app
                  world value)
    _ = cocone.desc.app world value :=
      (cocone.desc_pointwise world value).symm

end ConcreteEmbeddingCocone

/-! ## Explicit colimit universal property -/

/--
The canonical cocone of finite-stage embeddings into the concrete limit.
-/
def concreteIterationEmbeddingCocone :
    ConcreteEmbeddingCocone concreteIterationLimit where
  leg := concreteIterationLimitEmbedding
  compatible := concreteIterationLimitEmbedding_source_embedding

/--
Explicit universal property of an embedding-chain cocone.

This record is the successor-chain form of `CategoryTheory.IsColimit`: it
quantifies over every target and every compatible cocone, supplies a
mediator, proves every leg equation, and proves uniqueness among all
mediators satisfying those equations.
-/
structure ConcreteEmbeddingCoconeIsColimit where
  desc :
    ∀ {target : World ⥤ ωCPO},
      ConcreteEmbeddingCocone target →
        (concreteIterationLimit ⟶ target)
  fac :
    ∀ {target : World ⥤ ωCPO}
      (cocone : ConcreteEmbeddingCocone target)
      (n : Nat),
      concreteIterationLimitEmbedding n ≫ desc cocone =
        cocone.leg n
  uniq :
    ∀ {target : World ⥤ ωCPO}
      (cocone : ConcreteEmbeddingCocone target)
      (candidate : concreteIterationLimit ⟶ target),
      (∀ n,
        concreteIterationLimitEmbedding n ≫ candidate =
          cocone.leg n) →
      candidate = desc cocone

/--
The concrete projection limit is unconditionally also the colimit of the
concrete embedding chain.
-/
def concreteEmbeddingCoconeIsColimit :
    ConcreteEmbeddingCoconeIsColimit where
  desc cocone := cocone.desc
  fac cocone n := cocone.embedding_desc n
  uniq cocone candidate fac :=
    cocone.desc_unique candidate fac

/-- The constructed colimit mediator is the explicit supremum mediator. -/
@[simp]
theorem concreteEmbeddingCoconeIsColimit_desc
    {target : World ⥤ ωCPO}
    (cocone : ConcreteEmbeddingCocone target) :
    concreteEmbeddingCoconeIsColimit.desc cocone =
      cocone.desc :=
  rfl

end Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
