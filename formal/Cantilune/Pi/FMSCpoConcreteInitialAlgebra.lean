import Cantilune.Pi.FMSCpoConcreteEmbeddingColimit

/-!
# Initiality of the concrete recursive algebra

The concrete EP bilimit is already:

* a fixed point `L ≅ F L`;
* the projection limit of its finite projection tower; and
* the colimit of its finite embedding tower.

This module supplies the initial-algebra half of algebraic compactness.  It
constructs the empty world model, uses the continuous natural tail
isomorphism `F 0 ≅ 1`, recursively turns every `F`-algebra into a cocone over
the singleton-seeded concrete tower, and invokes the embedding-colimit
universal property to obtain the unique algebra morphism.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit

open CategoryTheory
open CategoryTheory.Endofunctor
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary

namespace InitialAlgebra

abbrev emptyWorldModel :=
  Cantilune.Pi.FMSCpoFiniteApproximationTower.emptyWorldModel

abbrev EmptyCarrier :=
  Cantilune.Pi.FMSCpoFiniteApproximationTower.EmptyCarrier

def emptyCarrierElim
    {motive : Sort*}
    (value : EmptyCarrier) :
    motive :=
  Cantilune.Pi.FMSCpoFiniteApproximationTower.emptyCarrierElim
    value

abbrev emptyWorldModelTo :=
  Cantilune.Pi.FMSCpoFiniteApproximationTower.emptyWorldModelTo

/-- The genuine empty world model remains initial in the exact model category. -/
def emptyWorldModelIsInitial :
    IsInitial emptyWorldModel :=
  Cantilune.Pi.FMSCpoFiniteApproximationTower.emptyWorldModelIsInitial

/-! ## The continuous natural tail isomorphism `F 0 ≅ 1` -/

/-- The empty computation gives a natural point of `F X` for every model `X`. -/
def singletonBottomActual
    (model : World ⥤ ωCPO) :
    singletonWorldModel ⟶ ActualAgentFunctor.obj model where
  app world :=
    bottomComputation
      ((actionFunctor.obj model).obj world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro _
    change
      (⊥ :
        OmegaScottPower
          ((actionFunctor.obj model).obj target)) =
        mapRaw _ (⊥ :
          OmegaScottPower
            ((actionFunctor.obj model).obj source))
    rw [mapRaw_bot]

/-- The action object over the empty model has no inhabitants. -/
def actionEmptyElim
    {world : World}
    {motive : Sort*}
    (action :
      (actionFunctor.obj emptyWorldModel).obj world) :
    motive := by
  change
    ActionRepresentation emptyWorldModel world at action
  rcases action with input | rest
  · rcases input with ⟨_channel, _known, fresh⟩
    exact emptyCarrierElim fresh
  · rcases rest with freeOutput | rest
    · rcases freeOutput with ⟨_tags, continuation⟩
      exact emptyCarrierElim continuation
    · rcases rest with boundOutput | continuation
      · rcases boundOutput with ⟨_channel, continuation⟩
        exact emptyCarrierElim continuation
      · exact emptyCarrierElim continuation

/-- Every lower computation over the empty action carrier is the empty set. -/
theorem actualEmpty_value_eq_bot
    (world : World)
    (value :
      (ActualAgentFunctor.obj emptyWorldModel).obj world) :
    value =
      (⊥ :
        OmegaScottPower
          ((actionFunctor.obj emptyWorldModel).obj world)) := by
  change
    OmegaScottPower
      ((actionFunctor.obj emptyWorldModel).obj world) at value
  apply TopologicalSpace.Closeds.ext
  change
    (value : Set
      (WithOmegaScott
        ((actionFunctor.obj emptyWorldModel).obj world))) =
      ∅
  ext action
  constructor
  · intro _member
    exact
      actionEmptyElim
        (WithOmegaScott.ofOmegaScott action)
  · intro member
    exact False.elim member

/--
The first tail of the genuine initial chain is continuously and naturally
isomorphic to the singleton seed of the concrete EP tower.
-/
def actualEmptyTailIso :
    ActualAgentFunctor.obj emptyWorldModel ≅
      singletonWorldModel where
  hom := collapseWorldModel _
  inv := singletonBottomActual emptyWorldModel
  hom_inv_id := by
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro value
    change
      (⊥ :
        OmegaScottPower
          ((actionFunctor.obj emptyWorldModel).obj world)) =
        value
    exact (actualEmpty_value_eq_bot world value).symm
  inv_hom_id := by
    apply NatTrans.ext
    funext world
    apply ContinuousHom.ext
    intro value
    cases value
    rfl

/--
The seed embedding of the singleton EP tower is precisely the transported
first initial-chain connector.
-/
theorem actualEmptyTailIso_inv_map_emptyTo_singleton :
    actualEmptyTailIso.inv ≫
        ActualAgentFunctor.map
          (emptyWorldModelTo singletonWorldModel) =
      singletonSeedEmbedding := by
  apply NatTrans.ext
  funext world
  apply ContinuousHom.ext
  intro value
  cases value
  change
    mapRaw _ (⊥ :
      OmegaScottPower
        ((actionFunctor.obj emptyWorldModel).obj world)) =
      (⊥ :
        OmegaScottPower
          ((actionFunctor.obj singletonWorldModel).obj world))
  rw [mapRaw_bot]

/-! ## Every algebra induces a cocone over the concrete tower -/

/-- The tail-induced interpretation of the singleton seed in an algebra. -/
def algebraBaseLeg
    (target : Algebra ActualAgentFunctor) :
    singletonWorldModel ⟶ target.a :=
  actualEmptyTailIso.inv ≫
    ActualAgentFunctor.map
      (emptyWorldModelTo target.a) ≫
    target.str

/-- The recursively induced finite-stage interpretation in an arbitrary algebra. -/
def algebraStageLeg
    (target : Algebra ActualAgentFunctor) :
    ∀ n, ConcreteActualIteration n ⟶ target.a
  | 0 =>
      algebraBaseLeg target
  | n + 1 =>
      ActualAgentFunctor.map
          (algebraStageLeg target n) ≫
        target.str

@[simp]
theorem algebraStageLeg_zero
    (target : Algebra ActualAgentFunctor) :
    algebraStageLeg target 0 =
      algebraBaseLeg target :=
  rfl

@[simp]
theorem algebraStageLeg_succ
    (target : Algebra ActualAgentFunctor)
    (n : Nat) :
    algebraStageLeg target (n + 1) =
      ActualAgentFunctor.map
          (algebraStageLeg target n) ≫
        target.str :=
  rfl

/-- The recursively induced legs respect every concrete tower embedding. -/
theorem algebraStageLeg_compatible
    (target : Algebra ActualAgentFunctor) :
    ∀ n,
      (concreteActualIterationPair n).embedding ≫
          algebraStageLeg target (n + 1) =
        algebraStageLeg target n := by
  intro n
  induction n with
  | zero =>
      change
        singletonSeedEmbedding ≫
            (ActualAgentFunctor.map
                (algebraBaseLeg target) ≫
              target.str) =
          algebraBaseLeg target
      have emptyComposite :
          emptyWorldModelTo singletonWorldModel ≫
              algebraBaseLeg target =
            emptyWorldModelTo target.a :=
        Cantilune.Pi.FMSCpoFiniteApproximationTower.emptyWorldModelTo_unique
          _ _
      calc
        singletonSeedEmbedding ≫
            (ActualAgentFunctor.map
                (algebraBaseLeg target) ≫
              target.str) =
          (actualEmptyTailIso.inv ≫
            ActualAgentFunctor.map
              (emptyWorldModelTo singletonWorldModel)) ≫
            (ActualAgentFunctor.map
                (algebraBaseLeg target) ≫
              target.str) := by
                rw [actualEmptyTailIso_inv_map_emptyTo_singleton]
        _ =
          actualEmptyTailIso.inv ≫
            ((ActualAgentFunctor.map
                (emptyWorldModelTo singletonWorldModel) ≫
              ActualAgentFunctor.map
                (algebraBaseLeg target)) ≫
              target.str) := by
                simp only [Category.assoc]
        _ =
          actualEmptyTailIso.inv ≫
            (ActualAgentFunctor.map
                (emptyWorldModelTo singletonWorldModel ≫
                  algebraBaseLeg target) ≫
              target.str) := by
                exact
                  congrArg
                    (fun morphism =>
                      actualEmptyTailIso.inv ≫
                        (morphism ≫ target.str))
                    (ActualAgentFunctor.map_comp
                      (emptyWorldModelTo singletonWorldModel)
                      (algebraBaseLeg target)).symm
        _ =
          actualEmptyTailIso.inv ≫
            ActualAgentFunctor.map
              (emptyWorldModelTo target.a) ≫ target.str := by
                exact
                  congrArg
                    (fun morphism =>
                      actualEmptyTailIso.inv ≫
                        (ActualAgentFunctor.map morphism ≫
                          target.str))
                    emptyComposite
        _ = algebraBaseLeg target :=
          rfl
  | succ n inductionHypothesis =>
      rw [algebraStageLeg_succ]
      rw [algebraStageLeg_succ]
      change
        ActualAgentFunctor.map
            (concreteActualIterationPair n).embedding ≫
          (ActualAgentFunctor.map
              (algebraStageLeg target (n + 1)) ≫
            target.str) =
          ActualAgentFunctor.map
              (algebraStageLeg target n) ≫
            target.str
      simp only [← Category.assoc]
      rw [← ActualAgentFunctor.map_comp]
      rw [inductionHypothesis]

/-- Every algebra supplies a genuine cocone over the concrete embedding chain. -/
def algebraEmbeddingCocone
    (target : Algebra ActualAgentFunctor) :
    ConcreteEmbeddingCocone target.a where
  leg := algebraStageLeg target
  compatible := algebraStageLeg_compatible target

/-- The underlying map induced by the embedding colimit. -/
def algebraMediator
    (target : Algebra ActualAgentFunctor) :
    concreteIterationLimit ⟶ target.a :=
  (algebraEmbeddingCocone target).desc

@[simp]
theorem embedding_algebraMediator
    (target : Algebra ActualAgentFunctor)
    (n : Nat) :
    concreteIterationLimitEmbedding n ≫
        algebraMediator target =
      algebraStageLeg target n :=
  (algebraEmbeddingCocone target).embedding_desc n

/-! ## Joint epimorphy and the algebra square -/

/-- The complete family of finite-stage embeddings is jointly epimorphic. -/
theorem concreteIterationLimitEmbedding_jointly_epi
    {target : World ⥤ ωCPO}
    (first second : concreteIterationLimit ⟶ target)
    (equal :
      ∀ n,
        concreteIterationLimitEmbedding n ≫ first =
          concreteIterationLimitEmbedding n ≫ second) :
    first = second := by
  let cocone : ConcreteEmbeddingCocone target := {
    leg := fun n =>
      concreteIterationLimitEmbedding n ≫ first
    compatible := by
      intro n
      rw [← Category.assoc]
      rw [concreteIterationLimitEmbedding_source_embedding] }
  have firstFac :
      ∀ n,
        concreteIterationLimitEmbedding n ≫ first =
          cocone.leg n :=
    fun _ => rfl
  have secondFac :
      ∀ n,
        concreteIterationLimitEmbedding n ≫ second =
          cocone.leg n := by
    intro n
    exact (equal n).symm
  exact
    (cocone.desc_unique first firstFac).trans
      (cocone.desc_unique second secondFac).symm

/--
Applying `F` to all finite embeddings remains jointly epimorphic.  The proof
uses the fold/unfold isomorphism and the fact that stage zero factors through
stage one; it does not assume preservation of arbitrary colimits.
-/
theorem mappedConcreteIterationLimitEmbedding_jointly_epi
    {target : World ⥤ ωCPO}
    (first second :
      ActualAgentFunctor.obj concreteIterationLimit ⟶ target)
    (equal :
      ∀ n,
        ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫ first =
          ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫ second) :
    first = second := by
  have embeddingSuccUnfold :
      ∀ n,
        concreteIterationLimitEmbedding (n + 1) ≫
            concreteBilimitExhaustivity.unfold =
          ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) := by
    intro n
    calc
      concreteIterationLimitEmbedding (n + 1) ≫
          concreteBilimitExhaustivity.unfold =
        (ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          concreteIterationFold) ≫
            concreteBilimitExhaustivity.unfold := by
              exact congrArg
                (fun morphism =>
                  morphism ≫
                    concreteBilimitExhaustivity.unfold)
                (concreteIterationLimitEmbedding_succ n)
      _ =
        ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          (concreteIterationFold ≫
            concreteBilimitExhaustivity.unfold) :=
              Category.assoc _ _ _
      _ =
        ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          𝟙 (ActualAgentFunctor.obj concreteIterationLimit) := by
              rw [concreteBilimitExhaustivity.fold_unfold]
      _ =
        ActualAgentFunctor.map
          (concreteIterationLimitEmbedding n) :=
            Category.comp_id _
  have afterUnfold :
      concreteBilimitExhaustivity.unfold ≫ first =
        concreteBilimitExhaustivity.unfold ≫ second := by
    apply concreteIterationLimitEmbedding_jointly_epi
    intro stage
    have shifted :
        concreteIterationLimitEmbedding (stage + 1) ≫
            (concreteBilimitExhaustivity.unfold ≫ first) =
          concreteIterationLimitEmbedding (stage + 1) ≫
            (concreteBilimitExhaustivity.unfold ≫ second) := by
      have firstShift :
          concreteIterationLimitEmbedding (stage + 1) ≫
              (concreteBilimitExhaustivity.unfold ≫ first) =
          (concreteIterationLimitEmbedding (stage + 1) ≫
              concreteBilimitExhaustivity.unfold) ≫ first :=
                (Category.assoc _ _ _).symm
      have firstFinite :
          (concreteIterationLimitEmbedding (stage + 1) ≫
              concreteBilimitExhaustivity.unfold) ≫ first =
          ActualAgentFunctor.map
              (concreteIterationLimitEmbedding stage) ≫ first := by
                exact
                  congrArg
                    (fun morphism => morphism ≫ first)
                    (embeddingSuccUnfold stage)
      have finiteEqual :
          ActualAgentFunctor.map
              (concreteIterationLimitEmbedding stage) ≫ first =
            ActualAgentFunctor.map
              (concreteIterationLimitEmbedding stage) ≫ second :=
        equal stage
      have secondFinite :
          ActualAgentFunctor.map
              (concreteIterationLimitEmbedding stage) ≫ second =
          (concreteIterationLimitEmbedding (stage + 1) ≫
              concreteBilimitExhaustivity.unfold) ≫ second := by
                exact
                  congrArg
                    (fun morphism => morphism ≫ second)
                    (embeddingSuccUnfold stage).symm
      have secondShift :
          (concreteIterationLimitEmbedding (stage + 1) ≫
              concreteBilimitExhaustivity.unfold) ≫ second =
          concreteIterationLimitEmbedding (stage + 1) ≫
            (concreteBilimitExhaustivity.unfold ≫ second) :=
              Category.assoc _ _ _
      exact
        firstShift.trans
          (firstFinite.trans
            (finiteEqual.trans
              (secondFinite.trans secondShift)))
    have precomposed :=
      congrArg
        (fun morphism =>
          (concreteActualIterationPair stage).embedding ≫ morphism)
        shifted
    simpa only [← Category.assoc,
      concreteIterationLimitEmbedding_source_embedding] using
        precomposed
  calc
    first =
      (concreteIterationFold ≫
        concreteBilimitExhaustivity.unfold) ≫ first := by
          rw [concreteBilimitExhaustivity.fold_unfold]
          exact (Category.id_comp _).symm
    _ =
      concreteIterationFold ≫
        (concreteBilimitExhaustivity.unfold ≫ first) :=
          Category.assoc _ _ _
    _ =
      concreteIterationFold ≫
        (concreteBilimitExhaustivity.unfold ≫ second) := by
          rw [afterUnfold]
    _ =
      (concreteIterationFold ≫
        concreteBilimitExhaustivity.unfold) ≫ second :=
          (Category.assoc _ _ _).symm
    _ = second := by
      rw [concreteBilimitExhaustivity.fold_unfold]
      exact Category.id_comp _

/--
The zeroth embedding into the recursive limit is the transported initial
tail, followed by the concrete fold.
-/
theorem concreteIterationLimitEmbedding_zero_tail :
    concreteIterationLimitEmbedding 0 =
      actualEmptyTailIso.inv ≫
        ActualAgentFunctor.map
          (emptyWorldModelTo concreteIterationLimit) ≫
        concreteIterationFold := by
  have seedFactor :
      concreteIterationLimitEmbedding 0 =
        singletonSeedEmbedding ≫
          concreteIterationLimitEmbedding 1 :=
    (concreteIterationLimitEmbedding_source_embedding 0).symm
  have emptyComposite :
      emptyWorldModelTo singletonWorldModel ≫
          concreteIterationLimitEmbedding 0 =
        emptyWorldModelTo concreteIterationLimit :=
    Cantilune.Pi.FMSCpoFiniteApproximationTower.emptyWorldModelTo_unique
      _ _
  calc
    concreteIterationLimitEmbedding 0 =
      singletonSeedEmbedding ≫
        concreteIterationLimitEmbedding 1 :=
          seedFactor
    _ =
      (actualEmptyTailIso.inv ≫
        ActualAgentFunctor.map
          (emptyWorldModelTo singletonWorldModel)) ≫
        concreteIterationLimitEmbedding 1 := by
          rw [actualEmptyTailIso_inv_map_emptyTo_singleton]
    _ =
      (actualEmptyTailIso.inv ≫
        ActualAgentFunctor.map
          (emptyWorldModelTo singletonWorldModel)) ≫
        (ActualAgentFunctor.map
            (concreteIterationLimitEmbedding 0) ≫
          concreteIterationFold) := by
            exact
              congrArg
                (fun morphism =>
                  (actualEmptyTailIso.inv ≫
                    ActualAgentFunctor.map
                      (emptyWorldModelTo singletonWorldModel)) ≫
                    morphism)
                (concreteIterationLimitEmbedding_succ 0)
    _ =
      actualEmptyTailIso.inv ≫
        (ActualAgentFunctor.map
            (emptyWorldModelTo singletonWorldModel) ≫
          ActualAgentFunctor.map
            (concreteIterationLimitEmbedding 0)) ≫
        concreteIterationFold := by
          simp only [Category.assoc]
    _ =
      actualEmptyTailIso.inv ≫
        ActualAgentFunctor.map
          (emptyWorldModelTo singletonWorldModel ≫
            concreteIterationLimitEmbedding 0) ≫
        concreteIterationFold := by
          rw [ActualAgentFunctor.map_comp]
    _ =
      actualEmptyTailIso.inv ≫
        ActualAgentFunctor.map
          (emptyWorldModelTo concreteIterationLimit) ≫
        concreteIterationFold := by
          rw [emptyComposite]

/-- The colimit mediator into any algebra satisfies the algebra square. -/
theorem algebraMediator_hom
    (target : Algebra ActualAgentFunctor) :
    ActualAgentFunctor.map (algebraMediator target) ≫
        target.str =
      concreteIterationFold ≫ algebraMediator target := by
  apply mappedConcreteIterationLimitEmbedding_jointly_epi
  intro n
  have leftToLeg :
      ActualAgentFunctor.map
          (concreteIterationLimitEmbedding n) ≫
        (ActualAgentFunctor.map (algebraMediator target) ≫
          target.str) =
        algebraStageLeg target (n + 1) := by
    calc
      _ =
        (ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          ActualAgentFunctor.map (algebraMediator target)) ≫
            target.str :=
              (Category.assoc _ _ _).symm
      _ =
        ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n ≫
              algebraMediator target) ≫ target.str := by
                rw [ActualAgentFunctor.map_comp]
      _ =
        ActualAgentFunctor.map
            (algebraStageLeg target n) ≫ target.str := by
              rw [embedding_algebraMediator]
      _ =
        algebraStageLeg target (n + 1) :=
          (algebraStageLeg_succ target n).symm
  have foldEmbedding :
      ActualAgentFunctor.map
          (concreteIterationLimitEmbedding n) ≫
        concreteIterationFold =
      concreteIterationLimitEmbedding (n + 1) :=
    (concreteIterationLimitEmbedding_succ n).symm
  have rightToLeg :
      ActualAgentFunctor.map
          (concreteIterationLimitEmbedding n) ≫
        (concreteIterationFold ≫ algebraMediator target) =
      algebraStageLeg target (n + 1) := by
    calc
      _ =
        (ActualAgentFunctor.map
            (concreteIterationLimitEmbedding n) ≫
          concreteIterationFold) ≫ algebraMediator target :=
            (Category.assoc _ _ _).symm
      _ =
        concreteIterationLimitEmbedding (n + 1) ≫
          algebraMediator target := by
            exact
              congrArg
                (fun morphism =>
                  morphism ≫ algebraMediator target)
                foldEmbedding
      _ =
        algebraStageLeg target (n + 1) :=
          embedding_algebraMediator target (n + 1)
  exact leftToLeg.trans rightToLeg.symm

/-! ## The initial algebra -/

/-- The fold algebra with its concrete carrier exposed definitionally. -/
abbrev concreteFoldAlgebra :
    Algebra ActualAgentFunctor where
  a := concreteIterationLimit
  str := concreteIterationFold

/-- The algebra stored in the concrete fixed-point witness is the exposed fold algebra. -/
theorem concreteActualFixedPointWitness_algebra_eq :
    concreteActualFixedPointWitness.algebra =
      concreteFoldAlgebra :=
  rfl

/-- The unique algebra morphism from the concrete fixed-point algebra. -/
def concreteInitialAlgebraTo
    (target : Algebra ActualAgentFunctor) :
    concreteFoldAlgebra.Hom target where
  f := algebraMediator target
  h := by
    exact algebraMediator_hom target

/--
Every algebra morphism from the concrete fixed point has exactly the
recursively induced finite-stage legs.
-/
theorem algebraHom_stage
    {target : Algebra ActualAgentFunctor}
    (hom :
      concreteFoldAlgebra.Hom target) :
    ∀ n,
      concreteIterationLimitEmbedding n ≫ hom.f =
        algebraStageLeg target n := by
  intro n
  induction n with
  | zero =>
      change
        concreteIterationLimitEmbedding 0 ≫ hom.f =
          algebraBaseLeg target
      have emptyComposite :
          emptyWorldModelTo concreteIterationLimit ≫ hom.f =
            emptyWorldModelTo target.a :=
        Cantilune.Pi.FMSCpoFiniteApproximationTower.emptyWorldModelTo_unique
          _ _
      calc
        concreteIterationLimitEmbedding 0 ≫ hom.f =
          actualEmptyTailIso.inv ≫
            ActualAgentFunctor.map
              (emptyWorldModelTo concreteIterationLimit) ≫
            concreteIterationFold ≫ hom.f := by
              exact
                congrArg
                  (fun morphism => morphism ≫ hom.f)
                  concreteIterationLimitEmbedding_zero_tail
        _ =
          actualEmptyTailIso.inv ≫
            ActualAgentFunctor.map
              (emptyWorldModelTo concreteIterationLimit) ≫
            (ActualAgentFunctor.map hom.f ≫ target.str) := by
              exact
                congrArg
                  (fun morphism =>
                    actualEmptyTailIso.inv ≫
                      ActualAgentFunctor.map
                        (emptyWorldModelTo concreteIterationLimit) ≫
                      morphism)
                  hom.h.symm
        _ =
          actualEmptyTailIso.inv ≫
            (ActualAgentFunctor.map
                (emptyWorldModelTo concreteIterationLimit) ≫
              ActualAgentFunctor.map hom.f) ≫ target.str := by
                simp only [Category.assoc]
        _ =
          actualEmptyTailIso.inv ≫
            ActualAgentFunctor.map
              (emptyWorldModelTo concreteIterationLimit ≫ hom.f) ≫
            target.str := by
              rw [ActualAgentFunctor.map_comp]
        _ =
          actualEmptyTailIso.inv ≫
            ActualAgentFunctor.map
              (emptyWorldModelTo target.a) ≫
            target.str := by
              rw [emptyComposite]
        _ = algebraBaseLeg target := rfl
  | succ n inductionHypothesis =>
      change
        concreteIterationLimitEmbedding (n + 1) ≫ hom.f =
          ActualAgentFunctor.map
              (algebraStageLeg target n) ≫ target.str
      calc
        concreteIterationLimitEmbedding (n + 1) ≫ hom.f =
          (ActualAgentFunctor.map
              (concreteIterationLimitEmbedding n) ≫
            concreteIterationFold) ≫ hom.f := by
              exact
                congrArg
                  (fun morphism => morphism ≫ hom.f)
                  (concreteIterationLimitEmbedding_succ n)
        _ =
          ActualAgentFunctor.map
              (concreteIterationLimitEmbedding n) ≫
            (concreteIterationFold ≫ hom.f) :=
              Category.assoc _ _ _
        _ =
          ActualAgentFunctor.map
              (concreteIterationLimitEmbedding n) ≫
            (ActualAgentFunctor.map hom.f ≫ target.str) := by
              exact
                congrArg
                  (fun morphism =>
                    ActualAgentFunctor.map
                      (concreteIterationLimitEmbedding n) ≫ morphism)
                  hom.h.symm
        _ =
          (ActualAgentFunctor.map
              (concreteIterationLimitEmbedding n) ≫
            ActualAgentFunctor.map hom.f) ≫ target.str :=
              (Category.assoc _ _ _).symm
        _ =
          ActualAgentFunctor.map
              (concreteIterationLimitEmbedding n ≫ hom.f) ≫
            target.str := by
              rw [ActualAgentFunctor.map_comp]
        _ =
          ActualAgentFunctor.map
              (algebraStageLeg target n) ≫ target.str := by
                rw [inductionHypothesis]

/-- Every algebra morphism is the colimit-induced algebra morphism. -/
theorem concreteInitialAlgebraTo_unique
    (target : Algebra ActualAgentFunctor)
    (hom :
      concreteFoldAlgebra.Hom target) :
    hom = concreteInitialAlgebraTo target := by
  apply Algebra.Hom.ext
  exact
    (algebraEmbeddingCocone target).desc_unique
      hom.f
      (algebraHom_stage hom)

/-- The definitionally exposed concrete fold algebra is initial. -/
def concreteFoldAlgebraIsInitial :
    IsInitial concreteFoldAlgebra :=
  IsInitial.ofUniqueHom
    concreteInitialAlgebraTo
    concreteInitialAlgebraTo_unique

/--
The fold algebra stored in the concretely constructed fixed-point witness is
initial among all algebras of the exact actual-agent endofunctor.
-/
def concreteActualInitialAlgebra :
    IsInitial concreteActualFixedPointWitness.algebra := by
  rw [concreteActualFixedPointWitness_algebra_eq]
  exact concreteFoldAlgebraIsInitial

end InitialAlgebra

end Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
