import Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

/-!
# Concrete exhaustivity of the singleton-seeded EP bilimit

This module discharges the finite-approximation premise left explicit by
`FMSCpoEmbeddingProjectionBilimit`.  The proof uses canonical maps between
finite stages of the concrete tower.  Their definition is structurally
recursive in the source stage, so no equality transport between differently
associated natural-number indices is required.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary

/-! ## Canonical finite-stage maps -/

/--
The canonical forward map from the singleton seed to a finite stage.

Writing this recursion through `F` makes the base case of the source-embedding
law judgmentally visible.
-/
def concreteZeroStageMap :
    (target : Nat) →
      ConcreteActualIteration 0 ⟶ ConcreteActualIteration target
  | 0 => 𝟙 _
  | target + 1 =>
      (concreteActualIterationPair 0).embedding ≫
        ActualAgentFunctor.map (concreteZeroStageMap target)

@[simp]
theorem concreteZeroStageMap_zero :
    concreteZeroStageMap 0 =
      𝟙 (ConcreteActualIteration 0) :=
  rfl

@[simp]
theorem concreteZeroStageMap_succ (target : Nat) :
    concreteZeroStageMap target.succ =
      (concreteActualIterationPair 0).embedding ≫
        ActualAgentFunctor.map (concreteZeroStageMap target) :=
  rfl

/--
The canonical map from source stage `n` to target stage `k`.

At a successor source and successor target it is obtained by applying `F`;
at target zero it projects the source once and continues recursively.
-/
def concreteStageMap :
    (source : Nat) →
      (target : Nat) →
        ConcreteActualIteration source ⟶ ConcreteActualIteration target
  | 0 => concreteZeroStageMap
  | source + 1 => fun
      | 0 =>
          (concreteActualIterationPair source).projection ≫
            concreteStageMap source 0
      | target + 1 =>
          ActualAgentFunctor.map (concreteStageMap source target)

@[simp]
theorem concreteStageMap_zero (target : Nat) :
    concreteStageMap 0 target = concreteZeroStageMap target :=
  rfl

@[simp]
theorem concreteStageMap_succ_zero (source : Nat) :
    concreteStageMap source.succ 0 =
      (concreteActualIterationPair source).projection ≫
        concreteStageMap source 0 :=
  rfl

@[simp]
theorem concreteStageMap_succ_succ
    (source target : Nat) :
    concreteStageMap source.succ target.succ =
      ActualAgentFunctor.map (concreteStageMap source target) :=
  rfl

/-- The canonical map from a finite stage to itself is the identity. -/
theorem concreteStageMap_diagonal (stage : Nat) :
    concreteStageMap stage stage =
      𝟙 (ConcreteActualIteration stage) := by
  induction stage with
  | zero => rfl
  | succ stage inductionHypothesis =>
      rw [concreteStageMap_succ_succ]
      rw [inductionHypothesis]
      rw [ActualAgentFunctor.map_id]
      rfl

/--
Advancing the source through one tower embedding leaves its canonical map to
every target unchanged.
-/
theorem concreteStageMap_source_embedding
    (source target : Nat) :
    (concreteActualIterationPair source).embedding ≫
        concreteStageMap source.succ target =
      concreteStageMap source target := by
  induction source generalizing target with
  | zero =>
      cases target with
      | zero =>
          rw [concreteStageMap_succ_zero]
          rw [← Category.assoc]
          rw [(concreteActualIterationPair 0).projection_embedding]
          simp
      | succ target =>
          rw [concreteStageMap_succ_succ]
          exact concreteZeroStageMap_succ target
  | succ source inductionHypothesis =>
      cases target with
      | zero =>
          rw [concreteStageMap_succ_zero]
          rw [← Category.assoc]
          rw [
            (concreteActualIterationPair source.succ).projection_embedding]
          simp
      | succ target =>
          rw [concreteStageMap_succ_succ]
          rw [concreteStageMap_succ_succ]
          change
            ActualAgentFunctor.map
                (concreteActualIterationPair source).embedding ≫
              ActualAgentFunctor.map
                (concreteStageMap source.succ target) =
              ActualAgentFunctor.map
                (concreteStageMap source target)
          rw [← ActualAgentFunctor.map_comp]
          rw [inductionHypothesis]

/--
Advancing the target and then applying its tower projection leaves every
canonical finite-stage map unchanged.
-/
theorem concreteStageMap_target_projection
    (source target : Nat) :
    concreteStageMap source target.succ ≫
        (concreteActualIterationPair target).projection =
      concreteStageMap source target := by
  induction source generalizing target with
  | zero =>
      induction target with
      | zero =>
          rw [concreteStageMap_zero]
          rw [concreteZeroStageMap_succ]
          rw [concreteZeroStageMap_zero]
          change
            (((concreteActualIterationPair 0).embedding ≫
                ActualAgentFunctor.map
                  (𝟙 (ConcreteActualIteration 0))) ≫
                (concreteActualIterationPair 0).projection) =
              𝟙 (ConcreteActualIteration 0)
          calc
            _ =
                (((concreteActualIterationPair 0).embedding ≫
                    𝟙 (ActualAgentFunctor.obj
                      (ConcreteActualIteration 0))) ≫
                  (concreteActualIterationPair 0).projection) := by
                    rw [ActualAgentFunctor.map_id]
            _ =
                (concreteActualIterationPair 0).embedding ≫
                  (concreteActualIterationPair 0).projection := by
                    exact
                      congrArg
                        (fun morphism =>
                          morphism ≫
                            (concreteActualIterationPair 0).projection)
                        (Category.comp_id
                          (concreteActualIterationPair 0).embedding)
            _ = 𝟙 (ConcreteActualIteration 0) :=
              (concreteActualIterationPair 0).projection_embedding
      | succ target inductionHypothesis =>
          rw [concreteStageMap_zero, concreteZeroStageMap_succ]
          rw [concreteStageMap_zero, concreteZeroStageMap_succ]
          have normalizedInductionHypothesis :
              concreteZeroStageMap target.succ ≫
                  (concreteActualIterationPair target).projection =
                concreteZeroStageMap target := by
            simpa only [concreteStageMap_zero] using
              inductionHypothesis
          dsimp only [ConcreteActualIteration, ActualIteration]
          change
            ((concreteActualIterationPair 0).embedding ≫
                ActualAgentFunctor.map
                  (concreteZeroStageMap target.succ)) ≫
                ActualAgentFunctor.map
                  (concreteActualIterationPair target).projection =
              (concreteActualIterationPair 0).embedding ≫
                ActualAgentFunctor.map
                  (concreteZeroStageMap target)
          rw [Category.assoc]
          erw [← ActualAgentFunctor.map_comp]
          rw [normalizedInductionHypothesis]
  | succ source inductionHypothesis =>
      cases target with
      | zero =>
          apply NatTrans.ext
          funext world
          apply ContinuousHom.ext
          intro value
          rfl
      | succ target =>
          rw [concreteStageMap_succ_succ]
          rw [concreteStageMap_succ_succ]
          change
            ActualAgentFunctor.map
                (concreteStageMap source target.succ) ≫
              ActualAgentFunctor.map
                (concreteActualIterationPair target).projection =
              ActualAgentFunctor.map
                (concreteStageMap source target)
          rw [← ActualAgentFunctor.map_comp]
          rw [inductionHypothesis]

/-- The finite-stage maps form a compatible cone into the concrete tower. -/
def concreteStageCone (source : Nat) :
    concreteModelProjectionChain.ContinuousCone
      (ConcreteActualIteration source) where
  leg := concreteStageMap source
  compatible := concreteStageMap_target_projection source

/-- The canonical finite-stage embedding into the explicit inverse limit. -/
def canonicalConcreteIterationLimitEmbedding (source : Nat) :
    ConcreteActualIteration source ⟶ concreteIterationLimit :=
  (concreteStageCone source).lift

@[simp]
theorem canonicalConcreteIterationLimitEmbedding_projection
    (source target : Nat) :
    canonicalConcreteIterationLimitEmbedding source ≫
        concreteIterationLimitProjection target =
      concreteStageMap source target :=
  (concreteStageCone source).lift_projection target

/-- Canonical adjacent embeddings agree in the inverse limit. -/
theorem canonicalConcreteIterationLimitEmbedding_source_embedding
    (source : Nat) :
    (concreteActualIterationPair source).embedding ≫
        canonicalConcreteIterationLimitEmbedding source.succ =
      canonicalConcreteIterationLimitEmbedding source := by
  apply concreteIterationLimitProjection_jointly_monic
  intro target
  simp only [Category.assoc,
    canonicalConcreteIterationLimitEmbedding_projection]
  exact concreteStageMap_source_embedding source target

/-! ## Identification with the fold-recursive embeddings -/

/-- The seed-to-stage maps extend through the next concrete tower embedding. -/
theorem concreteZeroStageMap_embedding (target : Nat) :
    concreteZeroStageMap target ≫
        (concreteActualIterationPair target).embedding =
      concreteZeroStageMap target.succ := by
  induction target with
  | zero =>
      rw [concreteZeroStageMap_zero, Category.id_comp]
      rw [concreteZeroStageMap_succ, concreteZeroStageMap_zero]
      calc
        (concreteActualIterationPair 0).embedding =
            (concreteActualIterationPair 0).embedding ≫
              𝟙 (ActualAgentFunctor.obj
                (ConcreteActualIteration 0)) := by
                  exact
                    (Category.comp_id
                      (concreteActualIterationPair 0).embedding).symm
        _ =
            (concreteActualIterationPair 0).embedding ≫
              ActualAgentFunctor.map
                (𝟙 (ConcreteActualIteration 0)) := by
                  rw [ActualAgentFunctor.map_id]
  | succ target inductionHypothesis =>
      rw [concreteZeroStageMap_succ]
      rw [concreteZeroStageMap_succ]
      calc
        ((concreteActualIterationPair 0).embedding ≫
              ActualAgentFunctor.map
                (concreteZeroStageMap target)) ≫
            ActualAgentFunctor.map
              (concreteActualIterationPair target).embedding =
          (concreteActualIterationPair 0).embedding ≫
            (ActualAgentFunctor.map
                (concreteZeroStageMap target) ≫
              ActualAgentFunctor.map
                (concreteActualIterationPair target).embedding) :=
                  Category.assoc _ _ _
        _ =
          (concreteActualIterationPair 0).embedding ≫
            ActualAgentFunctor.map
              (concreteZeroStageMap target ≫
                (concreteActualIterationPair target).embedding) := by
                  exact congrArg
                    (fun morphism =>
                      (concreteActualIterationPair 0).embedding ≫
                        morphism)
                    (ActualAgentFunctor.map_comp _ _).symm
        _ =
          (concreteActualIterationPair 0).embedding ≫
            ActualAgentFunctor.map
              (concreteZeroStageMap target.succ) := by
                  rw [inductionHypothesis]

/--
The seed cone originally used to construct the zeroth limit embedding has
exactly the recursively defined canonical finite-stage legs.
-/
theorem concreteFromZeroEmbedding_eq_zeroStageMap (target : Nat) :
    (concreteModelEmbeddingProjectionChain.fromZeroPair target).embedding =
      concreteZeroStageMap target := by
  induction target with
  | zero =>
      rfl
  | succ target inductionHypothesis =>
      rw [
        ModelEmbeddingProjectionChain.fromZeroPair_succ_embedding]
      rw [inductionHypothesis]
      exact concreteZeroStageMap_embedding target

/--
Every finite observation of the existing fold-recursive limit embedding is
the corresponding canonical finite-stage map.
-/
theorem concreteIterationLimitEmbedding_projection_stageMap
    (source target : Nat) :
    concreteIterationLimitEmbedding source ≫
        concreteIterationLimitProjection target =
      concreteStageMap source target := by
  induction source generalizing target with
  | zero =>
      rw [concreteIterationLimitEmbedding_zero]
      calc
        concreteSeedLimitEmbedding ≫
              concreteIterationLimitProjection target =
            concreteSeedCone.leg target := by
              exact concreteSeedCone.lift_projection target
        _ =
            (concreteModelEmbeddingProjectionChain.fromZeroPair
              target).embedding := rfl
        _ = concreteZeroStageMap target :=
          concreteFromZeroEmbedding_eq_zeroStageMap target
        _ = concreteStageMap 0 target := rfl
  | succ source inductionHypothesis =>
      cases target with
      | zero =>
          apply NatTrans.ext
          funext world
          apply ContinuousHom.ext
          intro value
          rfl
      | succ target =>
          rw [concreteIterationLimitEmbedding_succ]
          rw [concreteStageMap_succ_succ]
          calc
            (ActualAgentFunctor.map
                  (concreteIterationLimitEmbedding source) ≫
                concreteIterationFold) ≫
                concreteIterationLimitProjection target.succ =
              ActualAgentFunctor.map
                  (concreteIterationLimitEmbedding source) ≫
                (concreteIterationFold ≫
                  concreteIterationLimitProjection
                    target.succ) :=
                      Category.assoc _ _ _
            _ =
              ActualAgentFunctor.map
                  (concreteIterationLimitEmbedding source) ≫
                concreteFoldConeLeg target.succ := by
                  rw [concreteIterationFold_projection]
            _ =
              ActualAgentFunctor.map
                  (concreteIterationLimitEmbedding source) ≫
                ActualAgentFunctor.map
                  (concreteIterationLimitProjection target) := rfl
            _ =
              ActualAgentFunctor.map
                (concreteIterationLimitEmbedding source ≫
                  concreteIterationLimitProjection target) :=
                    (ActualAgentFunctor.map_comp _ _).symm
            _ =
              ActualAgentFunctor.map
                (concreteStageMap source target) := by
                  rw [inductionHypothesis]

/-- The existing fold-recursive embedding is the canonical cone mediator. -/
theorem concreteIterationLimitEmbedding_eq_canonical
    (source : Nat) :
    concreteIterationLimitEmbedding source =
      canonicalConcreteIterationLimitEmbedding source := by
  apply concreteIterationLimitProjection_jointly_monic
  intro target
  rw [
    concreteIterationLimitEmbedding_projection_stageMap,
    canonicalConcreteIterationLimitEmbedding_projection]

/-- Adjacent tower embeddings agree for the existing limit embeddings. -/
theorem concreteIterationLimitEmbedding_source_embedding
    (source : Nat) :
    (concreteActualIterationPair source).embedding ≫
        concreteIterationLimitEmbedding source.succ =
      concreteIterationLimitEmbedding source := by
  rw [concreteIterationLimitEmbedding_eq_canonical]
  rw [concreteIterationLimitEmbedding_eq_canonical]
  exact
    canonicalConcreteIterationLimitEmbedding_source_embedding source

/-! ## Monotone finite approximations -/

/--
When the target is no later than the source, projecting the source once and
then using the canonical map is the canonical map from the successor source.
-/
theorem concreteStageMap_source_projection
    (source target : Nat)
    (ordered : target ≤ source) :
    (concreteActualIterationPair source).projection ≫
        concreteStageMap source target =
      concreteStageMap source.succ target := by
  induction source generalizing target with
  | zero =>
      have targetZero : target = 0 := by omega
      subst target
      rfl
  | succ source inductionHypothesis =>
      cases target with
      | zero =>
          rfl
      | succ target =>
          have smaller : target ≤ source := by omega
          change
            ActualAgentFunctor.map
                (concreteActualIterationPair source).projection ≫
              ActualAgentFunctor.map
                (concreteStageMap source target) =
              ActualAgentFunctor.map
                (concreteStageMap source.succ target)
          rw [← ActualAgentFunctor.map_comp]
          rw [inductionHypothesis target smaller]

/--
For a coherent inverse-limit thread, mapping a later component backwards to
an earlier stage recovers that earlier component exactly.
-/
theorem concreteStageMap_limitProjection_exact
    (world : World)
    (value : concreteIterationLimit.obj world)
    (source target : Nat)
    (ordered : target ≤ source) :
    (concreteStageMap source target).app world
        ((concreteIterationLimitProjection source).app world value) =
      (concreteIterationLimitProjection target).app world value := by
  induction source generalizing target with
  | zero =>
      have targetZero : target = 0 := by omega
      subst target
      rw [concreteStageMap_diagonal]
      rfl
  | succ source inductionHypothesis =>
      by_cases diagonal : target = source.succ
      · subst target
        rw [concreteStageMap_diagonal]
        rfl
      · have smaller : target ≤ source := by omega
        have compatibleValue :
            ((concreteActualIterationPair source).projection).app world
                ((concreteIterationLimitProjection source.succ).app
                  world value) =
              (concreteIterationLimitProjection source).app
                world value :=
          ContinuousHom.congr_fun
            (NatTrans.congr_app
              (concreteIterationLimitProjection_compatible source)
              world)
            value
        calc
          (concreteStageMap source.succ target).app world
              ((concreteIterationLimitProjection source.succ).app
                world value) =
            ((concreteActualIterationPair source).projection ≫
              concreteStageMap source target).app world
                ((concreteIterationLimitProjection source.succ).app
                  world value) := by
                    rw [concreteStageMap_source_projection
                      source target smaller]
          _ =
            (concreteStageMap source target).app world
              (((concreteActualIterationPair source).projection).app
                world
                ((concreteIterationLimitProjection source.succ).app
                  world value)) := rfl
          _ =
            (concreteStageMap source target).app world
              ((concreteIterationLimitProjection source).app
                world value) := by
                  rw [compatibleValue]
          _ =
            (concreteIterationLimitProjection target).app world value :=
              inductionHypothesis target smaller

/-- Consecutive finite approximation endomaps are pointwise ordered. -/
theorem concreteLimitApproximation_le_succ (source : Nat) :
    TransformationPointwiseLE
      (concreteLimitApproximation source)
      (concreteLimitApproximation source.succ) := by
  intro world value
  let nextValue :=
    (concreteIterationLimitProjection source.succ).app world value
  have projectionValue :
      (concreteIterationLimitProjection source).app world value =
        ((concreteActualIterationPair source).projection).app
          world nextValue := by
    exact
      (ContinuousHom.congr_fun
        (NatTrans.congr_app
          (concreteIterationLimitProjection_compatible source)
          world)
        value).symm
  calc
    (concreteLimitApproximation source).app world value =
        (concreteIterationLimitEmbedding source).app world
          (((concreteActualIterationPair source).projection).app
            world nextValue) := by
              unfold concreteLimitApproximation
              change
                (concreteIterationLimitEmbedding source).app world
                    ((concreteIterationLimitProjection source).app
                      world value) =
                  (concreteIterationLimitEmbedding source).app world
                    (((concreteActualIterationPair source).projection).app
                      world nextValue)
              rw [projectionValue]
    _ =
        (concreteIterationLimitEmbedding source.succ).app world
          (((concreteActualIterationPair source).embedding).app world
            (((concreteActualIterationPair source).projection).app
              world nextValue)) := by
                exact
                  (ContinuousHom.congr_fun
                    (NatTrans.congr_app
                      (concreteIterationLimitEmbedding_source_embedding
                        source)
                      world)
                    (((concreteActualIterationPair source).projection).app
                      world nextValue)).symm
    _ ≤
        (concreteIterationLimitEmbedding source.succ).app world
          nextValue :=
            (concreteIterationLimitEmbedding source.succ).app world
              |>.monotone
                ((concreteActualIterationPair source).embedding_projection_le
                  world nextValue)
    _ =
        (concreteLimitApproximation source.succ).app world value := rfl

/-- The complete finite-approximation family is pointwise monotone. -/
theorem concreteLimitApproximation_monotone :
    ∀ {first second : Nat}, first ≤ second →
      TransformationPointwiseLE
        (concreteLimitApproximation first)
        (concreteLimitApproximation second) := by
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
            (concreteLimitApproximation_le_succ second world value)

/--
At every coordinate no later than the approximation stage, the finite
approximation agrees exactly with the original inverse-limit thread.
-/
theorem concreteLimitApproximation_component_exact
    (world : World)
    (value : concreteIterationLimit.obj world)
    (source target : Nat)
    (ordered : target ≤ source) :
    ((concreteLimitApproximation source).app world value).1 target =
      value.1 target := by
  let sourceValue :=
    (concreteIterationLimitProjection source).app world value
  calc
    ((concreteLimitApproximation source).app world value).1 target =
        (concreteStageMap source target).app world sourceValue := by
          unfold concreteLimitApproximation
          exact
            ContinuousHom.congr_fun
              (NatTrans.congr_app
                (concreteIterationLimitEmbedding_projection_stageMap
                  source target)
                world)
              sourceValue
    _ =
        (concreteIterationLimitProjection target).app world value :=
          concreteStageMap_limitProjection_exact
            world value source target ordered
    _ = value.1 target := rfl

/--
The finite approximation chain exhausts every inverse-limit thread
coordinatewise.
-/
theorem concreteLimitApproximation_exhaustive
    (world : World)
    (value : concreteIterationLimit.obj world) :
    value =
      ωSup
        (transformationEvaluationChain
          concreteLimitApproximation
          concreteLimitApproximation_monotone world value) := by
  apply Subtype.ext
  funext target
  let coordinateChain :
      Chain ((ConcreteActualIteration target).obj world) := {
    toFun := fun index =>
      ((concreteLimitApproximation index).app world value).1 target
    monotone' := by
      intro first second ordered
      exact
        (concreteLimitApproximation_monotone ordered world value)
          target }
  change value.1 target = ωSup coordinateChain
  apply le_antisymm
  · calc
      value.1 target =
          ((concreteLimitApproximation target).app world value).1
            target :=
              (concreteLimitApproximation_component_exact
                world value target target le_rfl).symm
      _ ≤ ωSup coordinateChain :=
        le_ωSup coordinateChain target
  · apply ωSup_le
    intro index
    let later := max index target
    have indexEarlier : index ≤ later :=
      Nat.le_max_left index target
    have targetEarlier : target ≤ later :=
      Nat.le_max_right index target
    calc
      coordinateChain index =
          ((concreteLimitApproximation index).app world value).1
            target := rfl
      _ ≤
          ((concreteLimitApproximation later).app world value).1
            target :=
              (concreteLimitApproximation_monotone
                indexEarlier world value) target
      _ = value.1 target :=
        concreteLimitApproximation_component_exact
          world value later target targetEarlier

/-! ## Monotone unfold approximations -/

@[simp]
theorem concreteActualIterationPair_succ_projection
    (source : Nat) :
    (concreteActualIterationPair source.succ).projection =
      ActualAgentFunctor.map
        (concreteActualIterationPair source).projection :=
  rfl

/--
Projecting one stage and embedding it into the limit is pointwise below the
next finite-stage embedding.
-/
theorem concreteProjection_embedding_le_next (source : Nat) :
    TransformationPointwiseLE
      ((concreteActualIterationPair source).projection ≫
        concreteIterationLimitEmbedding source)
      (concreteIterationLimitEmbedding source.succ) := by
  intro world value
  calc
    ((concreteIterationLimitEmbedding source).app world
        (((concreteActualIterationPair source).projection).app world
          value)) =
      (concreteIterationLimitEmbedding source.succ).app world
        (((concreteActualIterationPair source).embedding).app world
          (((concreteActualIterationPair source).projection).app world
            value)) := by
              exact
                (ContinuousHom.congr_fun
                  (NatTrans.congr_app
                    (concreteIterationLimitEmbedding_source_embedding
                      source)
                    world)
                  (((concreteActualIterationPair source).projection).app
                    world value)).symm
    _ ≤
      (concreteIterationLimitEmbedding source.succ).app world value :=
        (concreteIterationLimitEmbedding source.succ).app world
          |>.monotone
            ((concreteActualIterationPair source).embedding_projection_le
              world value)

/-- Consecutive unfold approximations are pointwise ordered. -/
theorem concreteUnfoldApproximation_le_succ (source : Nat) :
    TransformationPointwiseLE
      (concreteUnfoldApproximation source)
      (concreteUnfoldApproximation source.succ) := by
  intro world value
  let laterValue :=
    (concreteIterationLimitProjection (source + 2)).app world value
  have projectionValue :
      (concreteIterationLimitProjection source.succ).app world value =
        ((concreteActualIterationPair source.succ).projection).app
          world laterValue := by
    exact
      (ContinuousHom.congr_fun
        (NatTrans.congr_app
          (concreteIterationLimitProjection_compatible source.succ)
          world)
        value).symm
  have mapped :
      TransformationPointwiseLE
        (ActualAgentFunctor.map
          ((concreteActualIterationPair source).projection ≫
            concreteIterationLimitEmbedding source))
        (ActualAgentFunctor.map
          (concreteIterationLimitEmbedding source.succ)) :=
    actualAgentFunctor_locallyContinuous.map_monotone
      (concreteProjection_embedding_le_next source)
  calc
    (concreteUnfoldApproximation source).app world value =
        (ActualAgentFunctor.map
          (concreteIterationLimitEmbedding source)).app world
            ((concreteIterationLimitProjection source.succ).app
              world value) := rfl
    _ =
        (ActualAgentFunctor.map
          (concreteIterationLimitEmbedding source)).app world
            (((concreteActualIterationPair source.succ).projection).app
              world laterValue) := by
                rw [projectionValue]
    _ =
        (ActualAgentFunctor.map
          ((concreteActualIterationPair source).projection ≫
            concreteIterationLimitEmbedding source)).app
              world laterValue := by
                rw [concreteActualIterationPair_succ_projection]
                exact
                  (ContinuousHom.congr_fun
                    (NatTrans.congr_app
                      (ActualAgentFunctor.map_comp
                        (concreteActualIterationPair source).projection
                        (concreteIterationLimitEmbedding source))
                      world)
                    laterValue).symm
    _ ≤
        (ActualAgentFunctor.map
          (concreteIterationLimitEmbedding source.succ)).app
            world laterValue :=
              mapped world laterValue
    _ =
        (concreteUnfoldApproximation source.succ).app world value := rfl

/-- The complete unfold-approximation family is pointwise monotone. -/
theorem concreteUnfoldApproximation_monotone :
    ∀ {first second : Nat}, first ≤ second →
      TransformationPointwiseLE
        (concreteUnfoldApproximation first)
        (concreteUnfoldApproximation second) := by
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
            (concreteUnfoldApproximation_le_succ second world value)

/-! ## Unconditional concrete bilimit witness -/

/-- The fully constructed exhaustivity witness for the concrete EP tower. -/
theorem concreteBilimitExhaustivity : ConcreteBilimitExhaustivity where
  approximation_monotone := concreteLimitApproximation_monotone
  approximation_exhaustive := concreteLimitApproximation_exhaustive
  unfold_monotone := concreteUnfoldApproximation_monotone

/--
The singleton-seeded concrete recursive tower therefore supplies an actual
continuous natural solution of `A ≅ P(H A)` for the unseparated omega-Scott
power functor, without an extra bilimit premise.
-/
def concreteActualFixedPointWitness : ActualFixedPointWitness :=
  concreteActualFixedPointWitnessOfExhaustivity
    concreteBilimitExhaustivity

end Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
