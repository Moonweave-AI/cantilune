import Cantilune.Pi.FMSCpoActualDomainEquationBoundary

/-!
# Embedding--projection chains and their projection limits

This module supplies the first constructive part of the usual recursive-domain
route for the concrete Cantilune endofunctor

`F = actionFunctor ⋙ pointwiseOmegaScottPowerFunctor`.

It contains no fixed-point or algebraic-compactness postulate. In particular it
constructs:

* embedding--projection pairs in `ωCPO` and in the finite-world model
  category;
* preservation of model embedding--projection pairs by every locally
  continuous endofunctor, hence by the concrete `ActualAgentFunctor`;
* a concrete singleton/empty-computation seed pair and its iterated
  embedding--projection tower;
* the carrier-level inverse limit of an arbitrary omega-chain of continuous
  projections, including its universal mediating map and uniqueness;
* the pointwise world-natural inverse limit, its universal property, and the
  canonical fold `F L ⟶ L`.

The exact remaining step is proved equivalent in three forms: the shifted
`F L` cone is again a projection limit, the canonical fold is invertible, or
an explicit continuous two-sided unfold exists.  None of these equivalent
preservation witnesses is silently postulated here.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous

universe u

/-! ## Embedding--projection pairs -/

/-- A continuous embedding--projection pair between omega-CPOs. -/
structure CpoEmbeddingProjection (source target : ωCPO.{u}) where
  embedding : source ⟶ target
  projection : target ⟶ source
  projection_embedding :
    embedding ≫ projection = 𝟙 source
  embedding_projection_le :
    ∀ value, embedding (projection value) ≤ value

namespace CpoEmbeddingProjection

/-- The identity embedding--projection pair. -/
def identity (object : ωCPO.{u}) :
    CpoEmbeddingProjection object object where
  embedding := 𝟙 object
  projection := 𝟙 object
  projection_embedding := Category.comp_id _
  embedding_projection_le := fun _ => le_rfl

/-- Embedding--projection pairs compose. -/
def comp
    {first second third : ωCPO.{u}}
    (left : CpoEmbeddingProjection first second)
    (right : CpoEmbeddingProjection second third) :
    CpoEmbeddingProjection first third where
  embedding := left.embedding ≫ right.embedding
  projection := right.projection ≫ left.projection
  projection_embedding := by
    simp only [Category.assoc]
    rw [← Category.assoc right.embedding,
      right.projection_embedding]
    simp [left.projection_embedding]
  embedding_projection_le := by
    intro value
    change
      right.embedding
          (left.embedding
            (left.projection (right.projection value))) ≤
        value
    exact
      le_trans
        (right.embedding.monotone
          (left.embedding_projection_le
            (right.projection value)))
        (right.embedding_projection_le value)

@[simp]
theorem identity_embedding (object : ωCPO.{u}) :
    (identity object).embedding = 𝟙 object :=
  rfl

@[simp]
theorem identity_projection (object : ωCPO.{u}) :
    (identity object).projection = 𝟙 object :=
  rfl

end CpoEmbeddingProjection

/--
An embedding--projection pair between finite-world omega-CPO models.

The approximation inequality is pointwise because the functor category does
not currently carry a bundled locally ordered-category instance.
-/
structure ModelEmbeddingProjection
    (source target : World ⥤ ωCPO) where
  embedding : source ⟶ target
  projection : target ⟶ source
  projection_embedding :
    embedding ≫ projection = 𝟙 source
  embedding_projection_le :
    TransformationPointwiseLE
      (projection ≫ embedding) (𝟙 target)

namespace ModelEmbeddingProjection

/-- The identity model embedding--projection pair. -/
def identity (model : World ⥤ ωCPO) :
    ModelEmbeddingProjection model model where
  embedding := 𝟙 model
  projection := 𝟙 model
  projection_embedding := Category.comp_id _
  embedding_projection_le := by
    intro _ _
    exact le_rfl

/-- Model embedding--projection pairs compose. -/
def comp
    {first second third : World ⥤ ωCPO}
    (left : ModelEmbeddingProjection first second)
    (right : ModelEmbeddingProjection second third) :
    ModelEmbeddingProjection first third where
  embedding := left.embedding ≫ right.embedding
  projection := right.projection ≫ left.projection
  projection_embedding := by
    simp only [Category.assoc]
    rw [← Category.assoc right.embedding,
      right.projection_embedding]
    simp [left.projection_embedding]
  embedding_projection_le := by
    intro world value
    change
      right.embedding.app world
          (left.embedding.app world
            (left.projection.app world
              (right.projection.app world value))) ≤
        value
    exact
      le_trans
        (right.embedding.app world |>.monotone
          (left.embedding_projection_le world
            (right.projection.app world value)))
        (right.embedding_projection_le world value)

/--
Every locally continuous model endofunctor preserves
embedding--projection pairs.
-/
def map
    (functor : (World ⥤ ωCPO) ⥤ (World ⥤ ωCPO))
    (continuous : EndofunctorLocallyContinuous functor)
    {source target : World ⥤ ωCPO}
    (pair : ModelEmbeddingProjection source target) :
    ModelEmbeddingProjection
      (functor.obj source) (functor.obj target) where
  embedding := functor.map pair.embedding
  projection := functor.map pair.projection
  projection_embedding := by
    rw [← functor.map_comp, pair.projection_embedding,
      functor.map_id]
  embedding_projection_le := by
    intro world value
    have ordered :
        TransformationPointwiseLE
          (pair.projection ≫ pair.embedding)
          (𝟙 target) :=
      pair.embedding_projection_le
    have mapped :=
      continuous.map_monotone ordered world value
    simpa only [functor.map_comp, functor.map_id] using mapped

/-- The concrete action/lower-power endofunctor preserves EP pairs. -/
def mapActual
    {source target : World ⥤ ωCPO}
    (pair : ModelEmbeddingProjection source target) :
    ModelEmbeddingProjection
      (ActualAgentFunctor.obj source)
      (ActualAgentFunctor.obj target) :=
  pair.map ActualAgentFunctor actualAgentFunctor_locallyContinuous

end ModelEmbeddingProjection

/-! ## A concrete pointed seed pair -/

/-- The one-point omega-CPO used as the bottom approximation. -/
abbrev singletonCpo : ωCPO :=
  ωCPO.of PUnit

/-- The constant one-point finite-world model. -/
def singletonWorldModel : World ⥤ ωCPO where
  obj _ := singletonCpo
  map _ := 𝟙 singletonCpo
  map_id _ := rfl
  map_comp _ _ := by simp

/-- Direct image sends the empty omega-Scott computation to the empty one. -/
@[simp]
theorem mapRaw_bot
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : α →𝒄 β) :
    mapRaw function (⊥ : OmegaScottPower α) =
      (⊥ : OmegaScottPower β) := by
  apply TopologicalSpace.Closeds.ext
  change
    closure
        (omegaScottLift function ''
          (∅ : Set (WithOmegaScott α))) =
      (∅ : Set (WithOmegaScott β))
  simp

/-- Continuous selection of the empty computation. -/
def bottomComputation
    (object : ωCPO.{u}) :
    singletonCpo ⟶ omegaScottPowerFunctor.obj object :=
  ContinuousHom.ofFun
    (fun _ => (⊥ : OmegaScottPower object))

/-- The unique continuous collapse to the one-point omega-CPO. -/
def collapseToSingleton
    (object : ωCPO.{u}) :
    object ⟶ singletonCpo :=
  ContinuousHom.ofFun (fun _ => PUnit.unit)

/--
The empty lower-power computation is a natural embedding of the singleton
model into its first concrete recursive approximation.
-/
def singletonSeedEmbedding :
    singletonWorldModel ⟶
      ActualAgentFunctor.obj singletonWorldModel where
  app world :=
    bottomComputation
      ((Cantilune.Pi.FMSCpoActionFunctor.actionFunctor.obj
        singletonWorldModel).obj world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro _
    simp only [singletonWorldModel,
      bottomComputation,
      ActualAgentFunctor, pointwiseOmegaScottPowerFunctor,
      pointwiseCpoEndofunctor]
    change
      (⊥ :
        OmegaScottPower
          ((Cantilune.Pi.FMSCpoActionFunctor.actionFunctor.obj
            singletonWorldModel).obj target)) =
        mapRaw _ (⊥ :
          OmegaScottPower
            ((Cantilune.Pi.FMSCpoActionFunctor.actionFunctor.obj
              singletonWorldModel).obj source))
    rw [mapRaw_bot]

/-- The first concrete approximation continuously collapses to the seed. -/
def singletonSeedProjection :
    ActualAgentFunctor.obj singletonWorldModel ⟶
      singletonWorldModel where
  app world :=
    collapseToSingleton
      ((ActualAgentFunctor.obj singletonWorldModel).obj world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro _
    rfl

/--
A fully constructed seed embedding--projection pair for the concrete
unseparated lower-power endofunctor.
-/
def singletonSeedPair :
    ModelEmbeddingProjection
      singletonWorldModel
      (ActualAgentFunctor.obj singletonWorldModel) where
  embedding := singletonSeedEmbedding
  projection := singletonSeedProjection
  projection_embedding := by
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro value
    cases value
    rfl
  embedding_projection_le := by
    intro world value
    change
      (⊥ :
        OmegaScottPower
          ((Cantilune.Pi.FMSCpoActionFunctor.actionFunctor.obj
            singletonWorldModel).obj world)) ≤
        value
    exact bot_le

/-! ## The iterated actual-agent EP tower -/

/-- Iterates of the concrete recursive endofunctor from a chosen seed. -/
def ActualIteration (seed : World ⥤ ωCPO) :
    Nat → (World ⥤ ωCPO)
  | 0 => seed
  | n + 1 => ActualAgentFunctor.obj (ActualIteration seed n)

/--
The EP connector at every finite stage, generated from one supplied seed
embedding--projection pair.
-/
def actualIterationPair
    {seed : World ⥤ ωCPO}
    (seedPair :
      ModelEmbeddingProjection seed
        (ActualAgentFunctor.obj seed)) :
    (n : Nat) →
      ModelEmbeddingProjection
        (ActualIteration seed n)
        (ActualIteration seed (n + 1))
  | 0 => seedPair
  | n + 1 => (actualIterationPair seedPair n).mapActual

/-- The concrete EP approximation tower from the constructed singleton seed. -/
abbrev ConcreteActualIteration : Nat → (World ⥤ ωCPO) :=
  ActualIteration singletonWorldModel

/-- Every connector of the concrete approximation tower is an EP pair. -/
def concreteActualIterationPair (n : Nat) :
    ModelEmbeddingProjection
      (ConcreteActualIteration n)
      (ConcreteActualIteration (n + 1)) :=
  actualIterationPair singletonSeedPair n

@[simp]
theorem actualIterationPair_zero
    {seed : World ⥤ ωCPO}
    (seedPair :
      ModelEmbeddingProjection seed
        (ActualAgentFunctor.obj seed)) :
    actualIterationPair seedPair 0 = seedPair :=
  rfl

@[simp]
theorem actualIterationPair_succ
    {seed : World ⥤ ωCPO}
    (seedPair :
      ModelEmbeddingProjection seed
        (ActualAgentFunctor.obj seed))
    (n : Nat) :
    actualIterationPair seedPair (n + 1) =
      (actualIterationPair seedPair n).mapActual :=
  rfl

/-! ## Finite paths in an embedding--projection tower -/

/-- A model tower carrying both embeddings and projections at every step. -/
structure ModelEmbeddingProjectionChain where
  stage : Nat → (World ⥤ ωCPO)
  pair :
    ∀ n, ModelEmbeddingProjection (stage n) (stage (n + 1))

namespace ModelEmbeddingProjectionChain

/-- The composite EP pair across `length` consecutive connectors. -/
def pathPair
    (chain : ModelEmbeddingProjectionChain)
    (start : Nat) :
    (length : Nat) →
      ModelEmbeddingProjection
        (chain.stage start)
        (chain.stage (start + length))
  | 0 => ModelEmbeddingProjection.identity _
  | length + 1 =>
      (pathPair chain start length).comp
        (chain.pair (start + length))

@[simp]
theorem pathPair_zero
    (chain : ModelEmbeddingProjectionChain)
    (start : Nat) :
    chain.pathPair start 0 =
      ModelEmbeddingProjection.identity (chain.stage start) :=
  rfl

@[simp]
theorem pathPair_succ_embedding
    (chain : ModelEmbeddingProjectionChain)
    (start length : Nat) :
    (chain.pathPair start (length + 1)).embedding =
      (chain.pathPair start length).embedding ≫
        (chain.pair (start + length)).embedding :=
  rfl

@[simp]
theorem pathPair_succ_projection
    (chain : ModelEmbeddingProjectionChain)
    (start length : Nat) :
    (chain.pathPair start (length + 1)).projection =
      (chain.pair (start + length)).projection ≫
        (chain.pathPair start length).projection :=
  rfl

/-- Composite EP pairs from stage zero, without arithmetic transports. -/
def fromZeroPair
    (chain : ModelEmbeddingProjectionChain) :
    (n : Nat) →
      ModelEmbeddingProjection
        (chain.stage 0) (chain.stage n)
  | 0 => ModelEmbeddingProjection.identity _
  | n + 1 =>
      (fromZeroPair chain n).comp (chain.pair n)

@[simp]
theorem fromZeroPair_zero
    (chain : ModelEmbeddingProjectionChain) :
    chain.fromZeroPair 0 =
      ModelEmbeddingProjection.identity (chain.stage 0) :=
  rfl

@[simp]
theorem fromZeroPair_succ_embedding
    (chain : ModelEmbeddingProjectionChain)
    (n : Nat) :
    (chain.fromZeroPair (n + 1)).embedding =
      (chain.fromZeroPair n).embedding ≫
        (chain.pair n).embedding :=
  rfl

@[simp]
theorem fromZeroPair_succ_projection
    (chain : ModelEmbeddingProjectionChain)
    (n : Nat) :
    (chain.fromZeroPair (n + 1)).projection =
      (chain.pair n).projection ≫
        (chain.fromZeroPair n).projection :=
  rfl

/--
The canonical map from stage `source` to stage `target`: project backwards
when `target ≤ source`, and embed forwards otherwise.
-/
def stageMap
    (chain : ModelEmbeddingProjectionChain)
    (source target : Nat) :
    chain.stage source ⟶ chain.stage target :=
  if backward : target ≤ source then
    eqToHom
        (congrArg chain.stage
          (Nat.add_sub_of_le backward).symm) ≫
      (chain.pathPair target (source - target)).projection
  else
    (chain.pathPair source (target - source)).embedding ≫
      eqToHom
        (congrArg chain.stage
          (Nat.add_sub_of_le (Nat.le_of_not_ge backward)))

end ModelEmbeddingProjectionChain

/-! ## Pointwise omega-suprema of model transformations -/

/-- A pointwise-monotone sequence of model transformations at one world. -/
def transformationComponentChain
    {source target : World ⥤ ωCPO}
    (sequence : Nat → (source ⟶ target))
    (monotone :
      ∀ {first second : Nat}, first ≤ second →
        TransformationPointwiseLE
          (sequence first) (sequence second))
    (world : World) :
    Chain
      (ContinuousHom
        (source.obj world) (target.obj world)) where
  toFun index :=
    (show ContinuousHom
        (source.obj world) (target.obj world)
      from (sequence index).app world)
  monotone' := by
    intro first second ordered value
    exact monotone ordered world value

/-- Evaluate a transformation component chain at one source value. -/
def transformationEvaluationChain
    {source target : World ⥤ ωCPO}
    (sequence : Nat → (source ⟶ target))
    (monotone :
      ∀ {first second : Nat}, first ≤ second →
        TransformationPointwiseLE
          (sequence first) (sequence second))
    (world : World) (value : source.obj world) :
    Chain (target.obj world) :=
  (transformationComponentChain sequence monotone world).map
    ContinuousHom.toMono |>.map (OrderHom.apply value)

/-- Evaluation of a component supremum is the supremum of evaluations. -/
theorem transformationComponentSup_apply
    {source target : World ⥤ ωCPO}
    (sequence : Nat → (source ⟶ target))
    (monotone :
      ∀ {first second : Nat}, first ≤ second →
        TransformationPointwiseLE
          (sequence first) (sequence second))
    (world : World) (value : source.obj world) :
    (ContinuousHom.ωSup
        (transformationComponentChain
          sequence monotone world)) value =
      ωSup
        (transformationEvaluationChain
          sequence monotone world value) :=
  ContinuousHom.ωSup_apply _ _

/--
The pointwise omega-supremum of a monotone sequence of world-natural
transformations is again world-natural.
-/
def transformationSupremum
    {source target : World ⥤ ωCPO}
    (sequence : Nat → (source ⟶ target))
    (monotone :
      ∀ {first second : Nat}, first ≤ second →
        TransformationPointwiseLE
          (sequence first) (sequence second)) :
    source ⟶ target where
  app world :=
    (show ContinuousHom
      (source.obj world) (target.obj world)
      from
        ContinuousHom.ωSup
          (transformationComponentChain
            sequence monotone world))
  naturality := by
    intro sourceWorld targetWorld injection
    apply ContinuousHom.ext
    intro value
    calc
      (ContinuousHom.ωSup
          (transformationComponentChain
            sequence monotone targetWorld))
          ((source.map injection) value) =
        ωSup
          (transformationEvaluationChain
            sequence monotone targetWorld
              ((source.map injection) value)) :=
          transformationComponentSup_apply
            sequence monotone targetWorld _
      _ =
        ωSup
          ((transformationEvaluationChain
            sequence monotone sourceWorld value).map
              (target.map injection).toOrderHom) := by
          apply congrArg ωSup
          apply Chain.ext
          funext index
          exact
            ContinuousHom.congr_fun
              ((sequence index).naturality injection)
              value
      _ =
        (target.map injection)
          (ωSup
            (transformationEvaluationChain
              sequence monotone sourceWorld value)) := by
          exact
            ((target.map injection).continuous
              (transformationEvaluationChain
                sequence monotone sourceWorld value)).symm
      _ =
        (target.map injection)
          ((ContinuousHom.ωSup
            (transformationComponentChain
              sequence monotone sourceWorld)) value) := by
          rw [transformationComponentSup_apply]

/-- Pointwise characterization of the constructed transformation supremum. -/
theorem transformationSupremum_pointwise
    {source target : World ⥤ ωCPO}
    (sequence : Nat → (source ⟶ target))
    (monotone :
      ∀ {first second : Nat}, first ≤ second →
        TransformationPointwiseLE
          (sequence first) (sequence second))
    (world : World) (value : source.obj world) :
    (transformationSupremum sequence monotone).app world value =
      ωSup
        ({ toFun := fun index =>
            (sequence index).app world value
           monotone' := by
             intro first second ordered
             exact monotone ordered world value } :
          Chain (target.obj world)) := by
  exact transformationComponentSup_apply
    sequence monotone world value

/-- Bundle a monotone transformation sequence with its actual pointwise supremum. -/
def transformationOmegaChainOfSequence
    {source target : World ⥤ ωCPO}
    (sequence : Nat → (source ⟶ target))
    (monotone :
      ∀ {first second : Nat}, first ≤ second →
        TransformationPointwiseLE
          (sequence first) (sequence second)) :
    TransformationOmegaChain source target where
  sequence := sequence
  monotone := monotone
  supremum := transformationSupremum sequence monotone
  supremum_pointwise :=
    transformationSupremum_pointwise sequence monotone

/-- Drop the zeroth element of an omega-chain. -/
def chainTail
    {α : Type*} [Preorder α]
    (chain : Chain α) :
    Chain α where
  toFun index := chain (index + 1)
  monotone' := by
    intro first second ordered
    exact chain.monotone (Nat.add_le_add_right ordered 1)

/-- Dropping one element does not change the supremum of an omega-chain. -/
theorem omegaSup_chainTail
    {α : Type*} [OmegaCompletePartialOrder α]
    (chain : Chain α) :
    ωSup (chainTail chain) = ωSup chain := by
  apply le_antisymm
  · apply ωSup_le
    intro index
    exact le_ωSup chain (index + 1)
  · apply ωSup_le
    intro index
    exact
      le_trans
        (chain.monotone (Nat.le_succ index))
        (le_ωSup (chainTail chain) index)

/-! ## Explicit inverse limits of continuous projection chains -/

/-- A carrier-level omega-chain whose arrows point from stage `n+1` to `n`. -/
structure CpoProjectionChain where
  object : Nat → ωCPO.{u}
  projection : ∀ n, object (n + 1) ⟶ object n

namespace CpoProjectionChain

/-- Coherence of a thread through all projections. -/
def Coherent (chain : CpoProjectionChain.{u})
    (thread : ∀ n, chain.object n) : Prop :=
  ∀ n, chain.projection n (thread (n + 1)) = thread n

/-- The explicit carrier of the inverse limit of a projection chain. -/
def LimitCarrier (chain : CpoProjectionChain.{u}) :=
  { thread : ∀ n, chain.object n // chain.Coherent thread }

/-- Coherence is closed under pointwise omega-chain suprema. -/
theorem coherent_omegaSup
    (chain : CpoProjectionChain.{u})
    (threads : Chain (∀ n, chain.object n))
    (coherent :
      ∀ thread ∈ threads, chain.Coherent thread) :
    chain.Coherent (ωSup threads) := by
  intro n
  rw [show (ωSup threads) (n + 1) =
      ωSup (threads.map (Pi.evalOrderHom (n + 1))) by rfl]
  change
    (show ContinuousHom
        (chain.object (n + 1)) (chain.object n)
      from chain.projection n)
        (ωSup (threads.map (Pi.evalOrderHom (n + 1)))) =
      (ωSup threads) n
  rw [(show ContinuousHom
      (chain.object (n + 1)) (chain.object n)
    from chain.projection n).continuous]
  change
    ωSup
        ((threads.map (Pi.evalOrderHom (n + 1))).map
          (chain.projection n).toOrderHom) =
      (ωSup threads) n
  rw [show (ωSup threads) n =
      ωSup (threads.map (Pi.evalOrderHom n)) by rfl]
  apply congrArg ωSup
  apply Chain.ext
  funext index
  exact coherent (threads index) ⟨index, rfl⟩ n

/-- The inverse-limit carrier is itself an omega-CPO. -/
instance limitCarrierOmegaCompletePartialOrder
    (chain : CpoProjectionChain.{u}) :
    OmegaCompletePartialOrder chain.LimitCarrier :=
  OmegaCompletePartialOrder.subtype
    chain.Coherent
    (chain.coherent_omegaSup)

/-- The inverse-limit omega-CPO object. -/
def limitObject (chain : CpoProjectionChain.{u}) : ωCPO.{u} :=
  ωCPO.of chain.LimitCarrier

/-- Evaluation at a finite stage is continuous. -/
def limitProjection
    (chain : CpoProjectionChain.{u}) (n : Nat) :
    chain.limitObject ⟶ chain.object n where
  toFun thread := thread.1 n
  monotone' := fun _ _ ordered => ordered n
  map_ωSup' := fun _ => rfl

/-- The limit projections satisfy the projection-chain equations. -/
theorem limitProjection_compatible
    (chain : CpoProjectionChain.{u}) (n : Nat) :
    chain.limitProjection (n + 1) ≫ chain.projection n =
      chain.limitProjection n := by
  apply ContinuousHom.ext
  intro thread
  exact thread.2 n

/--
A continuous compatible cone into the projection chain.
-/
structure ContinuousCone
    (chain : CpoProjectionChain.{u}) (source : ωCPO.{u}) where
  leg : ∀ n, source ⟶ chain.object n
  compatible :
    ∀ n, leg (n + 1) ≫ chain.projection n = leg n

namespace ContinuousCone

/-- The universal mediating continuous map into the explicit limit. -/
def lift
    {chain : CpoProjectionChain.{u}} {source : ωCPO.{u}}
    (cone : ContinuousCone chain source) :
    source ⟶ chain.limitObject where
  toFun value :=
    ⟨fun n => cone.leg n value, fun n =>
      ContinuousHom.congr_fun (cone.compatible n) value⟩
  monotone' := by
    intro first second ordered n
    exact (cone.leg n).monotone ordered
  map_ωSup' := by
    intro values
    apply Subtype.ext
    funext n
    exact (cone.leg n).map_ωSup' values

/-- The mediating map has the requested components. -/
@[simp]
theorem lift_projection
    {chain : CpoProjectionChain.{u}} {source : ωCPO.{u}}
    (cone : ContinuousCone chain source) (n : Nat) :
    cone.lift ≫ chain.limitProjection n = cone.leg n := by
  apply ContinuousHom.ext
  intro _
  rfl

/-- A map into the explicit limit is determined by all finite projections. -/
theorem lift_unique
    {chain : CpoProjectionChain.{u}} {source : ωCPO.{u}}
    (cone : ContinuousCone chain source)
    (candidate : source ⟶ chain.limitObject)
    (fac : ∀ n,
      candidate ≫ chain.limitProjection n = cone.leg n) :
    candidate = cone.lift := by
  apply ContinuousHom.ext
  intro value
  apply Subtype.ext
  funext n
  exact ContinuousHom.congr_fun (fac n) value

end ContinuousCone

end CpoProjectionChain

/-! ## Pointwise inverse limits of model projection chains -/

/-- An omega-chain of finite-world models with natural projection maps. -/
structure ModelProjectionChain where
  stage : Nat → (World ⥤ ωCPO)
  projection : ∀ n, stage (n + 1) ⟶ stage n

namespace ModelProjectionChain

/-- Evaluation of a model projection chain at one finite world. -/
abbrev atWorld
    (chain : ModelProjectionChain) (world : World) :
    CpoProjectionChain where
  object n := (chain.stage n).obj world
  projection n := (chain.projection n).app world

/-- Reindexing all finite projections gives a compatible carrier cone. -/
def reindexCone
    (chain : ModelProjectionChain)
    {source target : World}
    (injection : source ⟶ target) :
    (chain.atWorld target).ContinuousCone
      (chain.atWorld source).limitObject where
  leg n :=
    (chain.atWorld source).limitProjection n ≫
      (chain.stage n).map injection
  compatible n := by
    change
      (chain.atWorld source).limitProjection (n + 1) ≫
          (chain.stage (n + 1)).map injection ≫
          (chain.projection n).app target =
        (chain.atWorld source).limitProjection n ≫
          (chain.stage n).map injection
    rw [(chain.projection n).naturality injection]
    rw [← Category.assoc]
    rw [(chain.atWorld source).limitProjection_compatible n]

/-- The continuous reindexing map on pointwise inverse-limit carriers. -/
def limitMap
    (chain : ModelProjectionChain)
    {source target : World}
    (injection : source ⟶ target) :
    (chain.atWorld source).limitObject ⟶
      (chain.atWorld target).limitObject :=
  (chain.reindexCone injection).lift

/-- The pointwise inverse limit is a genuine finite-world omega-CPO model. -/
def limitModel (chain : ModelProjectionChain) :
    World ⥤ ωCPO where
  obj world := (chain.atWorld world).limitObject
  map injection := chain.limitMap injection
  map_id world := by
    apply ContinuousHom.ext
    intro thread
    apply Subtype.ext
    funext n
    change
      (chain.stage n).map (𝟙 world) (thread.1 n) =
        thread.1 n
    exact
      ContinuousHom.congr_fun
        ((chain.stage n).map_id world)
        (thread.1 n)
  map_comp first second := by
    apply ContinuousHom.ext
    intro thread
    apply Subtype.ext
    funext n
    change
      (chain.stage n).map (first ≫ second)
          (thread.1 n) =
        (chain.stage n).map second
          ((chain.stage n).map first (thread.1 n))
    exact
      ContinuousHom.congr_fun
        ((chain.stage n).map_comp first second)
        (thread.1 n)

/-- The pointwise limit projections are world-natural. -/
def limitProjection
    (chain : ModelProjectionChain) (n : Nat) :
    chain.limitModel ⟶ chain.stage n where
  app world := (chain.atWorld world).limitProjection n
  naturality := by
    intro source target injection
    exact (chain.reindexCone injection).lift_projection n

/-- The natural limit projections satisfy the chain equations. -/
theorem limitProjection_compatible
    (chain : ModelProjectionChain) (n : Nat) :
    chain.limitProjection (n + 1) ≫ chain.projection n =
      chain.limitProjection n := by
  apply NatTrans.ext
  funext world
  exact (chain.atWorld world).limitProjection_compatible n

/-- The natural projections are jointly monic. -/
theorem limitProjection_jointly_monic
    (chain : ModelProjectionChain)
    {source : World ⥤ ωCPO}
    (first second : source ⟶ chain.limitModel)
    (equal :
      ∀ n,
        first ≫ chain.limitProjection n =
          second ≫ chain.limitProjection n) :
    first = second := by
  apply NatTrans.ext
  funext world
  apply ContinuousHom.ext
  intro value
  apply Subtype.ext
  funext n
  exact
    ContinuousHom.congr_fun
      (NatTrans.congr_app (equal n) world)
      value

/-! ### Universal property in the world-model category -/

/-- A world-natural compatible cone into a model projection chain. -/
structure ContinuousCone
    (chain : ModelProjectionChain)
    (source : World ⥤ ωCPO) where
  leg : ∀ n, source ⟶ chain.stage n
  compatible :
    ∀ n, leg (n + 1) ≫ chain.projection n = leg n

namespace ContinuousCone

/-- Evaluation of a model cone at one finite world. -/
def atWorld
    {chain : ModelProjectionChain}
    {source : World ⥤ ωCPO}
    (cone : ContinuousCone chain source)
    (world : World) :
    (chain.atWorld world).ContinuousCone (source.obj world) where
  leg n := (cone.leg n).app world
  compatible n := NatTrans.congr_app (cone.compatible n) world

/-- The pointwise mediating maps assemble into a natural transformation. -/
def lift
    {chain : ModelProjectionChain}
    {source : World ⥤ ωCPO}
    (cone : ContinuousCone chain source) :
    source ⟶ chain.limitModel where
  app world := (cone.atWorld world).lift
  naturality := by
    intro sourceWorld targetWorld injection
    apply ContinuousHom.ext
    intro value
    apply Subtype.ext
    funext n
    exact
      ContinuousHom.congr_fun
        ((cone.leg n).naturality injection)
        value

/-- The model-level mediator factors through every finite projection. -/
@[simp]
theorem lift_projection
    {chain : ModelProjectionChain}
    {source : World ⥤ ωCPO}
    (cone : ContinuousCone chain source)
    (n : Nat) :
    cone.lift ≫ chain.limitProjection n = cone.leg n := by
  apply NatTrans.ext
  funext world
  exact (cone.atWorld world).lift_projection n

/-- The model-level mediator is unique. -/
theorem lift_unique
    {chain : ModelProjectionChain}
    {source : World ⥤ ωCPO}
    (cone : ContinuousCone chain source)
    (candidate : source ⟶ chain.limitModel)
    (fac :
      ∀ n,
        candidate ≫ chain.limitProjection n =
          cone.leg n) :
    candidate = cone.lift :=
  chain.limitProjection_jointly_monic
    candidate cone.lift
    (fun n => (fac n).trans (cone.lift_projection n).symm)

end ContinuousCone

/-- The canonical projection cone carried by the explicit limit model. -/
def canonicalLimitCone (chain : ModelProjectionChain) :
    ContinuousCone chain chain.limitModel where
  leg := chain.limitProjection
  compatible := chain.limitProjection_compatible

/--
The explicit universal property for a model projection cone.

This formulation avoids depending on a separate categorical indexing
category: every other compatible cone has a mediator, the mediator factors
through every finite observation, and such mediators are unique.
-/
structure IsProjectionLimit
    {apex : World ⥤ ωCPO}
    (cone : ContinuousCone chain apex) where
  lift :
    ∀ {source : World ⥤ ωCPO},
      ContinuousCone chain source →
        (source ⟶ apex)
  fac :
    ∀ {source : World ⥤ ωCPO}
      (other : ContinuousCone chain source)
      (n : Nat),
      lift other ≫ cone.leg n = other.leg n
  uniq :
    ∀ {source : World ⥤ ωCPO}
      (other : ContinuousCone chain source)
      (first second : source ⟶ apex),
      (∀ n, first ≫ cone.leg n = other.leg n) →
      (∀ n, second ≫ cone.leg n = other.leg n) →
      first = second

/-- The explicitly constructed pointwise cone satisfies its universal property. -/
def canonicalLimitConeIsProjectionLimit
    (chain : ModelProjectionChain) :
    IsProjectionLimit (chain.canonicalLimitCone) where
  lift other := other.lift
  fac other n := other.lift_projection n
  uniq _other first second firstFac secondFac :=
    chain.limitProjection_jointly_monic first second
      (fun n => (firstFac n).trans (secondFac n).symm)

end ModelProjectionChain

/-- Forget the embeddings of an EP tower and retain its projection chain. -/
def ModelEmbeddingProjectionChain.toProjectionChain
    (chain : ModelEmbeddingProjectionChain) :
    ModelProjectionChain where
  stage := chain.stage
  projection n := (chain.pair n).projection

/-- The concrete iterated tower with both embeddings and projections. -/
abbrev concreteModelEmbeddingProjectionChain :
    ModelEmbeddingProjectionChain where
  stage := ConcreteActualIteration
  pair := concreteActualIterationPair

/-- The projection-chain underlying the concrete iterated EP tower. -/
abbrev concreteModelProjectionChain : ModelProjectionChain where
  stage := ConcreteActualIteration
  projection n := (concreteActualIterationPair n).projection

/-- Forgetting concrete embeddings yields exactly the concrete projection chain. -/
theorem concreteEmbeddingChain_toProjectionChain :
    concreteModelEmbeddingProjectionChain.toProjectionChain =
      concreteModelProjectionChain :=
  rfl

/-- The constructed pointwise inverse-limit world model of the concrete tower. -/
abbrev concreteIterationLimit : World ⥤ ωCPO :=
  concreteModelProjectionChain.limitModel

/-- Natural finite-stage observations from the concrete limit model. -/
def concreteIterationLimitProjection (n : Nat) :
    concreteIterationLimit ⟶ ConcreteActualIteration n :=
  concreteModelProjectionChain.limitProjection n

/-- Every finite-world model has a unique pointwise collapse to the seed. -/
def collapseWorldModel (model : World ⥤ ωCPO) :
    model ⟶ singletonWorldModel where
  app world := collapseToSingleton (model.obj world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro _
    rfl

/-- Concrete limit observations commute with every tower projection. -/
theorem concreteIterationLimitProjection_compatible (n : Nat) :
    concreteIterationLimitProjection (n + 1) ≫
        (concreteActualIterationPair n).projection =
      concreteIterationLimitProjection n :=
  concreteModelProjectionChain.limitProjection_compatible n

/-- Concrete finite observations jointly determine a limit transformation. -/
theorem concreteIterationLimitProjection_jointly_monic
    {source : World ⥤ ωCPO}
    (first second : source ⟶ concreteIterationLimit)
    (equal :
      ∀ n,
        first ≫ concreteIterationLimitProjection n =
          second ≫ concreteIterationLimitProjection n) :
    first = second :=
  concreteModelProjectionChain.limitProjection_jointly_monic
    first second equal

/-! ## The canonical fold into the concrete projection limit -/

/--
Finite observations of `F concreteIterationLimit`.

At stage zero there is the unique collapse to the singleton seed.  At stage
`n+1`, functoriality applies `F` to the `n`th observation of the limit.
-/
def concreteFoldConeLeg :
    (n : Nat) →
      ActualAgentFunctor.obj concreteIterationLimit ⟶
        ConcreteActualIteration n
  | 0 =>
      collapseWorldModel
        (ActualAgentFunctor.obj concreteIterationLimit)
  | n + 1 =>
      ActualAgentFunctor.map
        (concreteIterationLimitProjection n)

/-- The finite observations of `F limit` form a compatible projection cone. -/
theorem concreteFoldConeLeg_compatible (n : Nat) :
    concreteFoldConeLeg (n + 1) ≫
        (concreteActualIterationPair n).projection =
      concreteFoldConeLeg n := by
  cases n with
  | zero =>
      apply NatTrans.ext
      funext world
      apply ContinuousHom.ext
      intro _
      rfl
  | succ n =>
      change
        ActualAgentFunctor.map
            (concreteIterationLimitProjection (n + 1)) ≫
          ActualAgentFunctor.map
            (concreteActualIterationPair n).projection =
        ActualAgentFunctor.map
          (concreteIterationLimitProjection n)
      rw [← ActualAgentFunctor.map_comp]
      rw [concreteIterationLimitProjection_compatible n]

/-- The compatible shifted observations as a model-level continuous cone. -/
abbrev concreteFoldCone :
    concreteModelProjectionChain.ContinuousCone
      (ActualAgentFunctor.obj concreteIterationLimit) where
  leg := concreteFoldConeLeg
  compatible := concreteFoldConeLeg_compatible

/--
The canonical continuous fold map from `F limit` into the projection limit.

This is one direction of the recursive-domain equation and is constructed
without assumptions.
-/
def concreteIterationFold :
    ActualAgentFunctor.obj concreteIterationLimit ⟶
      concreteIterationLimit :=
  concreteFoldCone.lift

/-- Folding has exactly the prescribed finite observations. -/
@[simp]
theorem concreteIterationFold_projection (n : Nat) :
    concreteIterationFold ≫
        concreteIterationLimitProjection n =
      concreteFoldConeLeg n :=
  concreteFoldCone.lift_projection n

/-! ## Concrete finite-stage embeddings into the limit -/

/--
The singleton seed maps coherently into every finite stage by composing the
tower embeddings.
-/
def concreteSeedCone :
    concreteModelProjectionChain.ContinuousCone
      (ConcreteActualIteration 0) where
  leg n :=
    (concreteModelEmbeddingProjectionChain.fromZeroPair n).embedding
  compatible n := by
    change
      (concreteModelEmbeddingProjectionChain.fromZeroPair
          (n + 1)).embedding ≫
          (concreteActualIterationPair n).projection =
        (concreteModelEmbeddingProjectionChain.fromZeroPair
          n).embedding
    rw [
      ModelEmbeddingProjectionChain.fromZeroPair_succ_embedding]
    rw [Category.assoc]
    rw [(concreteActualIterationPair n).projection_embedding]
    rw [Category.comp_id]

/-- The canonical embedding of the singleton seed into the limit. -/
def concreteSeedLimitEmbedding :
    ConcreteActualIteration 0 ⟶ concreteIterationLimit :=
  concreteSeedCone.lift

/-- The seed embedding retracts along the zeroth limit projection. -/
theorem concreteSeedLimitEmbedding_projection :
    concreteSeedLimitEmbedding ≫
        concreteIterationLimitProjection 0 =
      𝟙 (ConcreteActualIteration 0) := by
  calc
    concreteSeedLimitEmbedding ≫
        concreteIterationLimitProjection 0 =
      concreteSeedCone.leg 0 := by
        exact concreteSeedCone.lift_projection 0
    _ = 𝟙 (ConcreteActualIteration 0) := rfl

/--
Canonical finite-stage embeddings, recursively shifted through `F` and the
constructed fold.
-/
def concreteIterationLimitEmbedding :
    (n : Nat) →
      ConcreteActualIteration n ⟶ concreteIterationLimit
  | 0 => concreteSeedLimitEmbedding
  | n + 1 =>
      ActualAgentFunctor.map
          (concreteIterationLimitEmbedding n) ≫
        concreteIterationFold

@[simp]
theorem concreteIterationLimitEmbedding_zero :
    concreteIterationLimitEmbedding 0 =
      concreteSeedLimitEmbedding :=
  rfl

@[simp]
theorem concreteIterationLimitEmbedding_succ
    (n : Nat) :
    concreteIterationLimitEmbedding (n + 1) =
      ActualAgentFunctor.map
          (concreteIterationLimitEmbedding n) ≫
        concreteIterationFold :=
  rfl

/-- Every finite-stage embedding is retracted by its limit projection. -/
theorem concreteIterationLimitEmbedding_projection
    (n : Nat) :
    concreteIterationLimitEmbedding n ≫
        concreteIterationLimitProjection n =
      𝟙 (ConcreteActualIteration n) := by
  induction n with
  | zero =>
      exact concreteSeedLimitEmbedding_projection
  | succ n inductionHypothesis =>
      rw [concreteIterationLimitEmbedding_succ]
      change
        (ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          concreteIterationFold) ≫
            concreteIterationLimitProjection (n + 1) =
          𝟙 (ActualAgentFunctor.obj
            (ConcreteActualIteration n))
      rw [Category.assoc]
      rw [concreteIterationFold_projection (n + 1)]
      change
        ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          ActualAgentFunctor.map
            (concreteIterationLimitProjection n) =
        𝟙 (ActualAgentFunctor.obj
          (ConcreteActualIteration n))
      rw [← ActualAgentFunctor.map_comp]
      rw [inductionHypothesis]
      rw [ActualAgentFunctor.map_id]

/-! ## The remaining omega-exhaustivity obligation -/

/-- The `n`th finite approximation endomap of the concrete limit. -/
def concreteLimitApproximation (n : Nat) :
    concreteIterationLimit ⟶ concreteIterationLimit :=
  concreteIterationLimitProjection n ≫
    concreteIterationLimitEmbedding n

/-- The `n`th finite approximation to the unfold map. -/
def concreteUnfoldApproximation (n : Nat) :
    concreteIterationLimit ⟶
      ActualAgentFunctor.obj concreteIterationLimit :=
  concreteIterationLimitProjection (n + 1) ≫
    ActualAgentFunctor.map
      (concreteIterationLimitEmbedding n)

/-- Postcomposing an unfold approximation with fold gives the next limit approximation. -/
theorem concreteUnfoldApproximation_fold
    (n : Nat) :
    concreteUnfoldApproximation n ≫
        concreteIterationFold =
      concreteLimitApproximation (n + 1) := by
  unfold concreteUnfoldApproximation
  unfold concreteLimitApproximation
  change
    (concreteIterationLimitProjection (n + 1) ≫
        ActualAgentFunctor.map
          (concreteIterationLimitEmbedding n)) ≫
        concreteIterationFold =
      concreteIterationLimitProjection (n + 1) ≫
        (ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          concreteIterationFold)
  exact Category.assoc _ _ _

/-- Precomposing an unfold approximation with fold maps a finite approximation through `F`. -/
theorem concreteFold_unfoldApproximation
    (n : Nat) :
    concreteIterationFold ≫
        concreteUnfoldApproximation n =
      ActualAgentFunctor.map
        (concreteLimitApproximation n) := by
  unfold concreteUnfoldApproximation
  unfold concreteLimitApproximation
  rw [← Category.assoc]
  rw [concreteIterationFold_projection (n + 1)]
  change
    ActualAgentFunctor.map
        (concreteIterationLimitProjection n) ≫
      ActualAgentFunctor.map
        (concreteIterationLimitEmbedding n) =
      _
  rw [← ActualAgentFunctor.map_comp]

/--
The exact omega-exhaustivity facts still required of the already constructed
finite-stage embeddings.

All carriers, embeddings, projections, retractions, and the fold are concrete.
The remaining fields assert that their finite approximation endomaps and
unfold approximants really form omega-chains, and that the former exhaust the
identity pointwise.
-/
structure ConcreteBilimitExhaustivity where
  approximation_monotone :
    ∀ {first second : Nat}, first ≤ second →
      TransformationPointwiseLE
        (concreteLimitApproximation first)
        (concreteLimitApproximation second)
  approximation_exhaustive :
    ∀ (world : World)
      (value : concreteIterationLimit.obj world),
      value =
        ωSup
          (transformationEvaluationChain
            concreteLimitApproximation
            approximation_monotone world value)
  unfold_monotone :
    ∀ {first second : Nat}, first ≤ second →
      TransformationPointwiseLE
        (concreteUnfoldApproximation first)
        (concreteUnfoldApproximation second)

namespace ConcreteBilimitExhaustivity

/-- The finite limit approximations bundled with identity as their actual supremum. -/
def approximationChain
    (exhaustive : ConcreteBilimitExhaustivity) :
    TransformationOmegaChain
      concreteIterationLimit concreteIterationLimit where
  sequence := concreteLimitApproximation
  monotone := exhaustive.approximation_monotone
  supremum := 𝟙 concreteIterationLimit
  supremum_pointwise := by
    intro world value
    exact exhaustive.approximation_exhaustive world value

/-- The concrete unfold approximation omega-chain. -/
def unfoldChain
    (exhaustive : ConcreteBilimitExhaustivity) :
    TransformationOmegaChain
      concreteIterationLimit
      (ActualAgentFunctor.obj concreteIterationLimit) :=
  transformationOmegaChainOfSequence
    concreteUnfoldApproximation exhaustive.unfold_monotone

/-- The pointwise omega-supremum of the concrete unfold approximations. -/
def unfold
    (exhaustive : ConcreteBilimitExhaustivity) :
    concreteIterationLimit ⟶
      ActualAgentFunctor.obj concreteIterationLimit :=
  transformationSupremum
    concreteUnfoldApproximation exhaustive.unfold_monotone

/-- Evaluation chain of finite limit approximations. -/
def approximationEvaluationChain
    (exhaustive : ConcreteBilimitExhaustivity)
    (world : World)
    (value : concreteIterationLimit.obj world) :
    Chain (concreteIterationLimit.obj world) :=
  transformationEvaluationChain
    concreteLimitApproximation
    exhaustive.approximation_monotone world value

/-- Evaluation chain of finite unfold approximations. -/
def unfoldEvaluationChain
    (exhaustive : ConcreteBilimitExhaustivity)
    (world : World)
    (value : concreteIterationLimit.obj world) :
    Chain
      ((ActualAgentFunctor.obj
        concreteIterationLimit).obj world) :=
  transformationEvaluationChain
    concreteUnfoldApproximation
    exhaustive.unfold_monotone world value

/-- The omega-supremum unfold followed by fold is the identity on the limit. -/
theorem unfold_fold
    (exhaustive : ConcreteBilimitExhaustivity) :
    exhaustive.unfold ≫ concreteIterationFold =
      𝟙 concreteIterationLimit := by
  apply NatTrans.ext
  funext world
  apply ContinuousHom.ext
  intro value
  change
    concreteIterationFold.app world
        ((transformationSupremum
          concreteUnfoldApproximation
          exhaustive.unfold_monotone).app world value) =
      value
  rw [transformationSupremum_pointwise]
  calc
    concreteIterationFold.app world
        (ωSup
          (exhaustive.unfoldEvaluationChain world value)) =
      ωSup
        ((exhaustive.unfoldEvaluationChain world value).map
          (concreteIterationFold.app world).toOrderHom) := by
            exact
              (concreteIterationFold.app world).continuous
                (exhaustive.unfoldEvaluationChain world value)
    _ =
      ωSup
        (chainTail
          (exhaustive.approximationEvaluationChain
            world value)) := by
            apply congrArg ωSup
            apply Chain.ext
            funext index
            exact
              ContinuousHom.congr_fun
                (NatTrans.congr_app
                  (concreteUnfoldApproximation_fold index)
                  world)
                value
    _ =
      ωSup
        (exhaustive.approximationEvaluationChain
          world value) :=
            omegaSup_chainTail _
    _ = value :=
      (exhaustive.approximation_exhaustive
        world value).symm

/-- The concrete `F`-image chain of finite limit approximations. -/
def mappedApproximationEvaluationChain
    (exhaustive : ConcreteBilimitExhaustivity)
    (world : World)
    (value :
      (ActualAgentFunctor.obj
        concreteIterationLimit).obj world) :
    Chain
      ((ActualAgentFunctor.obj
        concreteIterationLimit).obj world) where
  toFun index :=
    (ActualAgentFunctor.map
      (concreteLimitApproximation index)).app world value
  monotone' := by
    intro first second ordered
    exact
      actualAgentFunctor_locallyContinuous.map_monotone
        (exhaustive.approximation_monotone ordered)
        world value

/-- Fold followed by the omega-supremum unfold is the identity on `F limit`. -/
theorem fold_unfold
    (exhaustive : ConcreteBilimitExhaustivity) :
    concreteIterationFold ≫ exhaustive.unfold =
      𝟙 (ActualAgentFunctor.obj concreteIterationLimit) := by
  apply NatTrans.ext
  funext world
  apply ContinuousHom.ext
  intro value
  change
    (transformationSupremum
      concreteUnfoldApproximation
      exhaustive.unfold_monotone).app world
        (concreteIterationFold.app world value) =
      value
  rw [transformationSupremum_pointwise]
  calc
    ωSup
        (exhaustive.unfoldEvaluationChain world
          (concreteIterationFold.app world value)) =
      ωSup
        (exhaustive.mappedApproximationEvaluationChain
          world value) := by
            apply congrArg ωSup
            apply Chain.ext
            funext index
            exact
              ContinuousHom.congr_fun
                (NatTrans.congr_app
                  (concreteFold_unfoldApproximation index)
                  world)
                value
    _ =
      (ActualAgentFunctor.map
        exhaustive.approximationChain.supremum).app
          world value := by
            exact
              (actualAgentFunctor_locallyContinuous.map_ωSup
                exhaustive.approximationChain
                world value).symm
    _ = value := by
      change
        (ActualAgentFunctor.map
          (𝟙 concreteIterationLimit)).app world value =
        value
      rw [ActualAgentFunctor.map_id]
      rfl

end ConcreteBilimitExhaustivity

/--
An explicit continuous two-sided inverse of the constructed canonical fold.
-/
structure ConcreteIterationFoldInverse where
  unfold :
    concreteIterationLimit ⟶
      ActualAgentFunctor.obj concreteIterationLimit
  unfold_fold :
    unfold ≫ concreteIterationFold =
      𝟙 concreteIterationLimit
  fold_unfold :
    concreteIterationFold ≫ unfold =
      𝟙 (ActualAgentFunctor.obj concreteIterationLimit)

/--
Omega-exhaustivity of the concrete finite-stage embedding--projection tower
constructs a continuous two-sided inverse of the canonical fold.
-/
def ConcreteBilimitExhaustivity.toFoldInverse
    (exhaustive : ConcreteBilimitExhaustivity) :
    ConcreteIterationFoldInverse where
  unfold := exhaustive.unfold
  unfold_fold := exhaustive.unfold_fold
  fold_unfold := exhaustive.fold_unfold

/--
The precise bilimit-preservation obligation for the concrete endofunctor:
the shifted cone with apex `F concreteIterationLimit` must itself satisfy the
same projection-limit universal property.
-/
abbrev ConcreteFoldConeIsProjectionLimit :=
  concreteModelProjectionChain.IsProjectionLimit
    concreteFoldCone

/-- Bilimit preservation supplies the canonical unfold mediator. -/
def concreteIterationUnfoldOfProjectionLimit
    (preserved : ConcreteFoldConeIsProjectionLimit) :
    concreteIterationLimit ⟶
      ActualAgentFunctor.obj concreteIterationLimit :=
  preserved.lift
    concreteModelProjectionChain.canonicalLimitCone

/-- The preservation-supplied unfold has every required finite observation. -/
theorem concreteIterationUnfoldOfProjectionLimit_leg
    (preserved : ConcreteFoldConeIsProjectionLimit)
    (n : Nat) :
    concreteIterationUnfoldOfProjectionLimit preserved ≫
        concreteFoldConeLeg n =
      concreteIterationLimitProjection n :=
  preserved.fac
    concreteModelProjectionChain.canonicalLimitCone n

/-- The preservation-supplied unfold followed by fold is the identity. -/
theorem concreteIterationUnfoldOfProjectionLimit_fold
    (preserved : ConcreteFoldConeIsProjectionLimit) :
    concreteIterationUnfoldOfProjectionLimit preserved ≫
        concreteIterationFold =
      𝟙 concreteIterationLimit := by
  apply concreteIterationLimitProjection_jointly_monic
  intro n
  simp only [Category.assoc, Category.id_comp]
  rw [concreteIterationFold_projection n]
  exact concreteIterationUnfoldOfProjectionLimit_leg preserved n

/-- Fold followed by the preservation-supplied unfold is the identity. -/
theorem concreteIterationFold_unfoldOfProjectionLimit
    (preserved : ConcreteFoldConeIsProjectionLimit) :
    concreteIterationFold ≫
        concreteIterationUnfoldOfProjectionLimit preserved =
      𝟙 (ActualAgentFunctor.obj concreteIterationLimit) := by
  apply
    preserved.uniq
      concreteFoldCone
      (concreteIterationFold ≫
        concreteIterationUnfoldOfProjectionLimit preserved)
      (𝟙 (ActualAgentFunctor.obj concreteIterationLimit))
  · intro n
    rw [Category.assoc]
    change
      concreteIterationFold ≫
          concreteIterationUnfoldOfProjectionLimit preserved ≫
            concreteFoldConeLeg n =
        concreteFoldConeLeg n
    rw [concreteIterationUnfoldOfProjectionLimit_leg preserved n]
    exact concreteIterationFold_projection n
  · intro n
    simp

/-- Bilimit preservation constructs the complete explicit fold inverse. -/
def concreteIterationFoldInverseOfProjectionLimit
    (preserved : ConcreteFoldConeIsProjectionLimit) :
    ConcreteIterationFoldInverse where
  unfold := concreteIterationUnfoldOfProjectionLimit preserved
  unfold_fold :=
    concreteIterationUnfoldOfProjectionLimit_fold preserved
  fold_unfold :=
    concreteIterationFold_unfoldOfProjectionLimit preserved

namespace ConcreteIterationFoldInverse

/-- An explicit inverse transports every shifted finite observation back. -/
theorem unfold_foldConeLeg
    (inverse : ConcreteIterationFoldInverse)
    (n : Nat) :
    inverse.unfold ≫ concreteFoldConeLeg n =
      concreteIterationLimitProjection n := by
  rw [← concreteIterationFold_projection n]
  rw [← Category.assoc]
  rw [inverse.unfold_fold]
  exact Category.id_comp _

/--
An explicit fold inverse proves that the shifted `F limit` cone is itself a
projection limit.  This is the converse of
`concreteIterationFoldInverseOfProjectionLimit`.
-/
def foldConeIsProjectionLimit
    (inverse : ConcreteIterationFoldInverse) :
    ConcreteFoldConeIsProjectionLimit where
  lift other := other.lift ≫ inverse.unfold
  fac other n := by
    rw [Category.assoc]
    change
      other.lift ≫
          inverse.unfold ≫ concreteFoldConeLeg n =
        other.leg n
    rw [inverse.unfold_foldConeLeg n]
    exact other.lift_projection n
  uniq other first second firstFac secondFac := by
    have afterFold :
        first ≫ concreteIterationFold =
          second ≫ concreteIterationFold := by
      apply concreteIterationLimitProjection_jointly_monic
      intro n
      simp only [Category.assoc]
      rw [concreteIterationFold_projection n]
      have firstEquation := firstFac n
      have secondEquation := secondFac n
      change
        first ≫ concreteFoldConeLeg n =
          other.leg n at firstEquation
      change
        second ≫ concreteFoldConeLeg n =
          other.leg n at secondEquation
      exact firstEquation.trans secondEquation.symm
    calc
      first = first ≫
          (𝟙 (ActualAgentFunctor.obj concreteIterationLimit)) := by
            rw [Category.comp_id]
      _ = first ≫
          (concreteIterationFold ≫ inverse.unfold) := by
            rw [inverse.fold_unfold]
      _ = (first ≫ concreteIterationFold) ≫
          inverse.unfold := by
            rw [Category.assoc]
      _ = (second ≫ concreteIterationFold) ≫
          inverse.unfold := by
            rw [afterFold]
      _ = second ≫
          (concreteIterationFold ≫ inverse.unfold) := by
            rw [Category.assoc]
      _ = second ≫
          (𝟙 (ActualAgentFunctor.obj concreteIterationLimit)) := by
            rw [inverse.fold_unfold]
      _ = second := by
            rw [Category.comp_id]

/-- Every explicit fold inverse proves invertibility of the canonical fold. -/
theorem foldIsIso
    (inverse : ConcreteIterationFoldInverse) :
    IsIso concreteIterationFold where
  out :=
    ⟨inverse.unfold,
      inverse.fold_unfold,
      inverse.unfold_fold⟩

/-- Invertibility of the canonical fold reconstructs the explicit inverse. -/
noncomputable def ofIsIso
    [IsIso concreteIterationFold] :
    ConcreteIterationFoldInverse where
  unfold := inv concreteIterationFold
  unfold_fold := IsIso.inv_hom_id concreteIterationFold
  fold_unfold := IsIso.hom_inv_id concreteIterationFold

/-- A supplied inverse turns the constructed fold into the required iso. -/
def unfoldIso (inverse : ConcreteIterationFoldInverse) :
    concreteIterationLimit ≅
      ActualAgentFunctor.obj concreteIterationLimit where
  hom := inverse.unfold
  inv := concreteIterationFold
  hom_inv_id := inverse.unfold_fold
  inv_hom_id := inverse.fold_unfold

/-- A constructed inverse would discharge the concrete fixed-point boundary. -/
def toActualFixedPointWitness
    (inverse : ConcreteIterationFoldInverse) :
    ActualFixedPointWitness where
  agent := concreteIterationLimit
  unfoldIso := inverse.unfoldIso

end ConcreteIterationFoldInverse

/--
The concrete finite approximation theorem is sufficient for preservation of
the shifted projection limit.
-/
def ConcreteBilimitExhaustivity.foldConeIsProjectionLimit
    (exhaustive : ConcreteBilimitExhaustivity) :
    ConcreteFoldConeIsProjectionLimit :=
  exhaustive.toFoldInverse.foldConeIsProjectionLimit

/--
The concrete finite approximation theorem constructs the requested recursive
world model and its continuous natural domain isomorphism.
-/
def ConcreteBilimitExhaustivity.toActualFixedPointWitness
    (exhaustive : ConcreteBilimitExhaustivity) :
    ActualFixedPointWitness :=
  exhaustive.toFoldInverse.toActualFixedPointWitness

/--
Top-level spelling of the fixed-point construction from concrete
omega-exhaustivity.
-/
def concreteActualFixedPointWitnessOfExhaustivity
    (exhaustive : ConcreteBilimitExhaustivity) :
    ActualFixedPointWitness :=
  exhaustive.toActualFixedPointWitness

/--
The missing bilimit-preservation witness and the explicit fold inverse carry
exactly the same information.
-/
theorem concreteFoldConeProjectionLimit_iff_foldInverse :
    Nonempty ConcreteFoldConeIsProjectionLimit ↔
      Nonempty ConcreteIterationFoldInverse := by
  constructor
  · rintro ⟨preserved⟩
    exact
      ⟨concreteIterationFoldInverseOfProjectionLimit
        preserved⟩
  · rintro ⟨inverse⟩
    exact ⟨inverse.foldConeIsProjectionLimit⟩

/--
Exact minimal boundary: supplying a continuous two-sided inverse is
equivalent to proving that the already constructed canonical fold is an
isomorphism.

Thus the remaining theorem is not the existence of a carrier, tower, limit,
or fold; all of those have been constructed.  It is precisely preservation of
the embedding--projection bilimit strongly enough to make this fold
invertible.
-/
theorem concreteIterationFoldInverse_iff_isIso :
    Nonempty ConcreteIterationFoldInverse ↔
      IsIso concreteIterationFold := by
  constructor
  · rintro ⟨inverse⟩
    exact inverse.foldIsIso
  · intro invertible
    letI : IsIso concreteIterationFold := invertible
    exact ⟨ConcreteIterationFoldInverse.ofIsIso⟩

/-- Bilimit preservation is equivalent to invertibility of the canonical fold. -/
theorem concreteFoldConeProjectionLimit_iff_isIso :
    Nonempty ConcreteFoldConeIsProjectionLimit ↔
      IsIso concreteIterationFold :=
  concreteFoldConeProjectionLimit_iff_foldInverse.trans
    concreteIterationFoldInverse_iff_isIso

/-- A proof that the shifted cone is limiting constructs the actual fixed point. -/
def concreteActualFixedPointWitnessOfProjectionLimit
    (preserved : ConcreteFoldConeIsProjectionLimit) :
    ActualFixedPointWitness :=
  (concreteIterationFoldInverseOfProjectionLimit preserved)
    |>.toActualFixedPointWitness

/--
Conditional fixed-point construction stated at the minimal categorical
boundary.
-/
noncomputable def concreteActualFixedPointWitnessOfIsIso
    [IsIso concreteIterationFold] :
    ActualFixedPointWitness :=
  ConcreteIterationFoldInverse.ofIsIso.toActualFixedPointWitness

/-! ## Exact remaining construction boundary -/

/--
The additional constructive data required to turn an iterated model EP tower
into an actual fixed point.

This is deliberately a proposition over already constructed data, not an
postulate or an inhabitant. `limit` must be a world model; its projections must
be natural and jointly monic; `unfold` must be a continuous natural
isomorphism to the concrete recursive functor.
-/
structure ActualBilimitSolution
    (seed : World ⥤ ωCPO)
    (seedPair :
      ModelEmbeddingProjection seed
        (ActualAgentFunctor.obj seed)) where
  limit : World ⥤ ωCPO
  projection :
    ∀ n, limit ⟶ ActualIteration seed n
  projection_compatible :
    ∀ n,
      projection (n + 1) ≫
          (actualIterationPair seedPair n).projection =
        projection n
  jointly_monic :
    ∀ {source : World ⥤ ωCPO}
      (first second : source ⟶ limit),
      (∀ n, first ≫ projection n = second ≫ projection n) →
        first = second
  unfold : limit ≅ ActualAgentFunctor.obj limit

namespace ActualBilimitSolution

/-- Any constructed actual bilimit solution yields the legacy fixed point. -/
def toActualFixedPointWitness
    {seed : World ⥤ ωCPO}
    {seedPair :
      ModelEmbeddingProjection seed
        (ActualAgentFunctor.obj seed)}
    (solution : ActualBilimitSolution seed seedPair) :
    ActualFixedPointWitness where
  agent := solution.limit
  unfoldIso := solution.unfold

end ActualBilimitSolution

end Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
