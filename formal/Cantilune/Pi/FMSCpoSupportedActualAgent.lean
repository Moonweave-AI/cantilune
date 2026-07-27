import Cantilune.Pi.FMSCpoConcreteAlgebraicCompactness
import Cantilune.Pi.FMSCpoAgentOperationalBridge
import Cantilune.Pi.FMSBinderInstantiation
import Cantilune.Pi.FMSOperationalSyntaxBridge

/-!
# Supported syntax as an actual coalgebra for the concrete FMS agent

This file constructs the missing direct bridge

`processCpoModel ⟶ ActualAgentFunctor.obj processCpoModel ⟶ Agent`.

The first arrow is an actual continuous natural transformation.  Its carrier
is the finite-control `SupportedProc` syntax itself, not an externally supplied
interface and not a parallel trace model.  Terminality of Cantilune's concrete
solution of `A ≅ PωScott (H A)` then produces the denotation.

The coalgebra covers the native head constructors `0`, tau, input, free
output, binary choice, equality match, and inequality match.  Parallel and
restriction require the left-merge/synchronisation and Table-4 action folds,
respectively.  They are deliberately mapped to the unseparated effect bottom
here rather than being given a false compositional interpretation.  The final
section connects restriction to the independently constructed recursive
`agentRestriction` and records native bound output separately.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoSupportedActualAgent

universe u

open CategoryTheory
open CategoryTheory.Endofunctor
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoContext
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSBinderInstantiation
open Cantilune.Pi.FMSOperationalSyntaxBridge
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoAgentOperationalBridge
open Cantilune.Pi.FMSCpoInputTransport

/-! ## Locally nameless transport lemmas -/

/-- A scoped name at binder depth zero is necessarily a free name. -/
def closedName {world : Nat} : ScopedName world 0 → Fin world
  | .free name => name
  | .bound impossible => Fin.elim0 impossible

@[simp]
theorem closedName_free {world : Nat} (name : Fin world) :
    closedName (.free name : ScopedName world 0) = name :=
  rfl

@[simp]
theorem closedName_renameFree
    (rename : Fin source → Fin target)
    (name : ScopedName source 0) :
    closedName (ScopedName.renameFree rename name) =
      rename (closedName name) := by
  cases name with
  | free name => rfl
  | bound impossible => exact Fin.elim0 impossible

private theorem scopedName_renameFree_liftBound
    (rename : Fin source → Fin target)
    (name : ScopedName source bound) :
    ScopedName.renameFree rename (ScopedName.liftBound name) =
      ScopedName.liftBound (ScopedName.renameFree rename name) := by
  cases name <;> rfl

private theorem scopedName_renameFree_substituteBinder
    (rename : Fin source → Fin target)
    (binder : Fin (bound + 1))
    (replacement : ScopedName source bound)
    (name : ScopedName source (bound + 1)) :
    ScopedName.renameFree rename
        (ScopedName.substituteBinder binder replacement name) =
      ScopedName.substituteBinder binder
        (ScopedName.renameFree rename replacement)
        (ScopedName.renameFree rename name) := by
  cases name with
  | free name => rfl
  | bound index =>
      induction index using binder.succAboveCases
      · simp [ScopedName.substituteBinder]
      · simp [ScopedName.substituteBinder]

private def renameSubstitutionProperty
    (rename : Fin source → Fin target) :
    {bound : Nat} → SupportedProc source bound → Prop
  | 0, _ => True
  | bound + 1, process =>
      ∀ (binder : Fin (bound + 1))
        (replacement : ScopedName source bound),
        SupportedProc.renameFree rename
            (SupportedProc.substituteBinderWith binder replacement process) =
          SupportedProc.substituteBinderWith binder
            (ScopedName.renameFree rename replacement)
            (SupportedProc.renameFree rename process)

private theorem renameSubstitutionProperty_all
    (rename : Fin source → Fin target)
    {bound : Nat}
    (process : SupportedProc source bound) :
    renameSubstitutionProperty rename process := by
  induction process with
  | @zero bound =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith]
  | @tau bound next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.tau.injEq]
          exact ih binder replacement
  | @input bound channel body ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.input.injEq]
          constructor
          · exact scopedName_renameFree_substituteBinder
              rename binder replacement channel
          · simpa [scopedName_renameFree_liftBound] using
              ih binder.castSucc (ScopedName.liftBound replacement)
  | @output bound channel value next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.output.injEq]
          exact ⟨
            scopedName_renameFree_substituteBinder
              rename binder replacement channel,
            scopedName_renameFree_substituteBinder
              rename binder replacement value,
            ih binder replacement⟩
  | @choice bound left right leftIH rightIH =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.choice.injEq]
          exact ⟨leftIH binder replacement, rightIH binder replacement⟩
  | @parallel bound left right leftIH rightIH =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.parallel.injEq]
          exact ⟨leftIH binder replacement, rightIH binder replacement⟩
  | @restrict bound body ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.restrict.injEq]
          simpa [scopedName_renameFree_liftBound] using
            ih binder.castSucc (ScopedName.liftBound replacement)
  | @matchEq bound left right next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.matchEq.injEq]
          exact ⟨
            scopedName_renameFree_substituteBinder
              rename binder replacement left,
            scopedName_renameFree_substituteBinder
              rename binder replacement right,
            ih binder replacement⟩
  | @matchNe bound left right next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp only [SupportedProc.renameFree,
            SupportedProc.substituteBinderWith, SupportedProc.matchNe.injEq]
          exact ⟨
            scopedName_renameFree_substituteBinder
              rename binder replacement left,
            scopedName_renameFree_substituteBinder
              rename binder replacement right,
            ih binder replacement⟩

/-- Free renaming commutes with capture-avoiding binder substitution. -/
theorem renameFree_substituteBinderWith
    (rename : Fin source → Fin target)
    (binder : Fin (bound + 1))
    (replacement : ScopedName source bound)
    (process : SupportedProc source (bound + 1)) :
    SupportedProc.renameFree rename
        (SupportedProc.substituteBinderWith binder replacement process) =
      SupportedProc.substituteBinderWith binder
        (ScopedName.renameFree rename replacement)
        (SupportedProc.renameFree rename process) := by
  exact renameSubstitutionProperty_all rename process binder replacement

/-- Known input instantiation is natural in every free-name map. -/
@[simp]
theorem renameFree_instantiateOuter
    (rename : Fin source → Fin target)
    (received : Fin source)
    (body : SupportedProc source 1) :
    SupportedProc.renameFree rename
        (SupportedProc.instantiateOuter received body) =
      SupportedProc.instantiateOuter (rename received)
        (SupportedProc.renameFree rename body) := by
  unfold SupportedProc.instantiateOuter
  simpa using
    renameFree_substituteBinderWith rename (Fin.last 0)
      (.free received) body

/--
Fresh input instantiation transported along an extension is the corresponding
known input instantiation at the selected target name.
-/
theorem renameFree_freshenOuter_extension
    (injection : source ⟶ target)
    (newName : Fin target)
    (extension : source + 1 ⟶ target)
    (oldAgreement :
      ∀ old : Fin source,
        homToFun extension (Fin.castSucc old) =
          homToFun injection old)
    (freshAgreement :
      homToFun extension (Fin.last source) = newName)
    (body : SupportedProc source 1) :
    SupportedProc.renameFree (homToFun extension)
        (SupportedProc.freshenOuter body) =
      SupportedProc.instantiateOuter newName
        (SupportedProc.renameFree (homToFun injection) body) := by
  unfold SupportedProc.freshenOuter
  unfold SupportedProc.instantiateOuter
  rw [renameFree_substituteBinderWith]
  apply congrArg₂
    (SupportedProc.substituteBinderWith (Fin.last 0))
  · exact congrArg ScopedName.free freshAgreement
  · rw [SupportedProc.renameFree_comp]
    apply congrArg (fun rename =>
      SupportedProc.renameFree rename body)
    funext old
    exact oldAgreement old

/--
The syntax-level name abstraction is exactly natural for the FMS old/fresh
transport.
-/
theorem inputAbstraction_natural
    (injection : source ⟶ target)
    (body : SupportedProc source 1) :
    inputKnownTransport processCpoModel injection
        (fun received =>
          SupportedProc.instantiateOuter received body)
        (SupportedProc.freshenOuter body) =
      fun received =>
        SupportedProc.instantiateOuter received
          (SupportedProc.renameFree
            (homToFun injection) body) := by
  funext received
  by_cases oldWitness :
      ∃ old : Fin source,
        homToFun injection old = received
  · obtain ⟨old, rfl⟩ := oldWitness
    rw [inputKnownTransport_old]
    exact renameFree_instantiateOuter
      (homToFun injection) old body
  · let extension : source + 1 ⟶ target :=
      extendByName injection received oldWitness
    rw [inputKnownTransport_fresh processCpoModel injection
      (fun old => SupportedProc.instantiateOuter old body)
      (SupportedProc.freshenOuter body)
      received extension
      (extendByName_castSucc injection received oldWitness)
      (extendByName_last injection received oldWitness)]
    exact renameFree_freshenOuter_extension
      injection received extension
      (extendByName_castSucc injection received oldWitness)
      (extendByName_last injection received oldWitness)
      body

/-- Canonical fresh input continuation is natural under successor worlds. -/
@[simp]
theorem renameFree_freshenOuter_successor
    (injection : source ⟶ target)
    (body : SupportedProc source 1) :
    SupportedProc.renameFree
        (homToFun (successorMap injection))
        (SupportedProc.freshenOuter body) =
      SupportedProc.freshenOuter
        (SupportedProc.renameFree (homToFun injection) body) := by
  unfold SupportedProc.freshenOuter
  rw [renameFree_substituteBinderWith]
  apply congrArg₂
    (SupportedProc.substituteBinderWith (Fin.last 0))
  · apply congrArg ScopedName.free
    change
      Cantilune.Pi.FMSCpoWorld.Injection.succ
          (asInjection injection) (Fin.last source) =
        Fin.last target
    exact Cantilune.Pi.FMSCpoWorld.Injection.succ_last
      (asInjection injection)
  · rw [SupportedProc.renameFree_comp]
    rw [SupportedProc.renameFree_comp]
    apply congrArg (fun rename =>
      SupportedProc.renameFree rename body)
    funext old
    change
      Cantilune.Pi.FMSCpoWorld.Injection.succ
          (asInjection injection) (Fin.castSucc old) =
        Fin.castSucc (homToFun injection old)
    exact Cantilune.Pi.FMSCpoWorld.Injection.succ_castSucc
      (asInjection injection) old

/-! ## The actual supported-syntax coalgebra -/

/-- The exact tau action over the syntax carrier. -/
def syntaxTauAction
    (world : World) (continuation : processCpoModel.obj world) :
    ActionRepresentation processCpoModel world :=
  Sum.inr (Sum.inr (Sum.inr continuation))

/-- The exact free-output action over the syntax carrier. -/
def syntaxFreeOutputAction
    (world : World) (channel value : Fin world)
    (continuation : processCpoModel.obj world) :
    ActionRepresentation processCpoModel world :=
  Sum.inr
    (Sum.inl
      ((nameTag channel, nameTag value), continuation))

/-- The exact input action over the syntax carrier. -/
def syntaxInputAction
    (world : World) (channel : Fin world)
    (body : SupportedProc world 1) :
    ActionRepresentation processCpoModel world :=
  Sum.inl
    (nameTag channel,
      (fun received =>
        SupportedProc.instantiateOuter received body,
       SupportedProc.freshenOuter body))

/-- Direct image preserves binary lower-power choice. -/
theorem mapRaw_sup
    {α β : Type u}
    [OmegaCompletePartialOrder α]
    [OmegaCompletePartialOrder β]
    (function : ωCPO.of α ⟶ ωCPO.of β)
    (left right : OmegaScottPower α) :
    mapRaw function (left ⊔ right) =
      mapRaw function left ⊔ mapRaw function right := by
  apply le_antisymm
  · apply (mapRaw_le_iff function _ _).2
    apply sup_le
    · exact (mapRaw_le_iff function left _).1 le_sup_left
    · exact (mapRaw_le_iff function right _).1 le_sup_right
  · apply sup_le
    · exact mapRaw_monotone function le_sup_left
    · exact mapRaw_monotone function le_sup_right

/--
One supported operational layer.  Parallel and restriction are explicitly
outside this coalgebra fragment and therefore map to the effect bottom.
-/
def supportedHeadLayer :
    (world : World) →
      SupportedProc world 0 →
        OmegaScottPower
          (ActionRepresentation processCpoModel world)
  | world, .zero => ⊥
  | world, .tau next =>
      principalRaw (syntaxTauAction world next)
  | world, .input channel body =>
      principalRaw
        (syntaxInputAction world (closedName channel) body)
  | world, .output channel value next =>
      principalRaw
        (syntaxFreeOutputAction world
          (closedName channel) (closedName value) next)
  | world, .choice left right =>
      supportedHeadLayer world left ⊔
        supportedHeadLayer world right
  | _, .parallel _ _ => ⊥
  | _, .restrict _ => ⊥
  | world, .matchEq left right next =>
      if closedName left = closedName right then
        supportedHeadLayer world next
      else ⊥
  | world, .matchNe left right next =>
      if closedName left ≠ closedName right then
        supportedHeadLayer world next
      else ⊥

/-- One supported layer commutes with every injection of finite worlds. -/
theorem supportedHeadLayer_natural
    {source target : World}
    (injection : source ⟶ target)
    (process : SupportedProc source 0) :
    mapRaw (actionWorldMap processCpoModel injection)
        (supportedHeadLayer source process) =
      supportedHeadLayer target
        (SupportedProc.renameFree
          (homToFun injection) process) := by
  cases process with
  | zero =>
      simp [supportedHeadLayer, SupportedProc.renameFree, mapRaw_bot]
  | tau next =>
      rw [supportedHeadLayer, mapRaw_principal]
      simp only [syntaxTauAction, actionWorldMap_tau,
        SupportedProc.renameFree, supportedHeadLayer]
      rfl
  | input channel body =>
      rw [supportedHeadLayer, mapRaw_principal]
      simp only [syntaxInputAction, actionWorldMap_input,
        SupportedProc.renameFree, supportedHeadLayer,
        closedName_renameFree]
      apply congrArg principalRaw
      apply congrArg Sum.inl
      apply Prod.ext
      · rfl
      · apply Prod.ext
        · exact inputAbstraction_natural injection body
        · exact renameFree_freshenOuter_successor injection body
  | output channel value next =>
      rw [supportedHeadLayer, mapRaw_principal]
      simp only [syntaxFreeOutputAction, actionWorldMap_freeOutput,
        SupportedProc.renameFree, supportedHeadLayer,
        closedName_renameFree]
      rfl
  | choice left right =>
      rw [supportedHeadLayer, mapRaw_sup,
        supportedHeadLayer_natural injection left,
        supportedHeadLayer_natural injection right]
      simp [SupportedProc.renameFree, supportedHeadLayer]
  | parallel left right =>
      simp [supportedHeadLayer, SupportedProc.renameFree, mapRaw_bot]
  | restrict body =>
      simp [supportedHeadLayer, SupportedProc.renameFree, mapRaw_bot]
  | matchEq left right next =>
      simp only [SupportedProc.renameFree, supportedHeadLayer,
        closedName_renameFree]
      by_cases equal : closedName left = closedName right
      · have renamedEqual :
          homToFun injection (closedName left) =
            homToFun injection (closedName right) :=
          congrArg (homToFun injection) equal
        rw [if_pos equal, if_pos renamedEqual,
          supportedHeadLayer_natural injection next]
      · have renamedDistinct :
          homToFun injection (closedName left) ≠
            homToFun injection (closedName right) :=
          fun equality =>
            equal ((asInjection injection).injective equality)
        rw [if_neg equal, if_neg renamedDistinct]
        exact mapRaw_bot _
  | matchNe left right next =>
      simp only [SupportedProc.renameFree, supportedHeadLayer,
        closedName_renameFree]
      by_cases distinct : closedName left ≠ closedName right
      · have renamedDistinct :
          homToFun injection (closedName left) ≠
            homToFun injection (closedName right) :=
          fun equality =>
            distinct ((asInjection injection).injective equality)
        rw [if_pos distinct, if_pos renamedDistinct,
          supportedHeadLayer_natural injection next]
      · have equal : closedName left = closedName right :=
          not_ne_iff.mp distinct
        have renamedEqual :
          homToFun injection (closedName left) =
            homToFun injection (closedName right) :=
          congrArg (homToFun injection) equal
        have notRenamedDistinct :
            ¬ homToFun injection (closedName left) ≠
              homToFun injection (closedName right) :=
          fun renamedDistinct => renamedDistinct renamedEqual
        rw [if_neg distinct, if_neg notRenamedDistinct]
        exact mapRaw_bot _
termination_by process

/--
The actual continuous natural one-step map on `processCpoModel`.
-/
def supportedOneStep :
    processCpoModel ⟶ ActualAgentFunctor.obj processCpoModel where
  app world :=
    EqualityOrder.continuousTo
      (supportedHeadLayer world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro process
    exact (supportedHeadLayer_natural injection process).symm

/-- Supported syntax bundled as a coalgebra of the actual FMS functor. -/
def supportedCoalgebra : Coalgebra ActualAgentFunctor where
  V := processCpoModel
  str := supportedOneStep

/--
The concrete denotation obtained by the actual terminal-coalgebra map.
-/
def supportedDenote : processCpoModel ⟶ Agent :=
  (concreteCoalgebraToTerminal supportedCoalgebra).f

/-- The denotation is a genuine coalgebra morphism. -/
theorem supportedDenote_unroll :
    supportedOneStep ≫ ActualAgentFunctor.map supportedDenote =
      supportedDenote ≫ agentUnfold :=
  (concreteCoalgebraToTerminal supportedCoalgebra).h

/-- Pointwise form of the coalgebra commuting square. -/
theorem supportedDenote_unroll_at
    (world : World) (process : SupportedProc world 0) :
    agentUnfold.app world
        (supportedDenote.app world process) =
      mapRaw
        (actionModelMapComponent supportedDenote world)
        (supportedHeadLayer world process) := by
  have square :=
    congrArg (fun transformation => transformation.app world)
      supportedDenote_unroll
  change
    agentUnfold.app world
        (supportedDenote.app world process) =
      (ActualAgentFunctor.map supportedDenote).app world
        (supportedHeadLayer world process)
  exact (ContinuousHom.congr_fun square process).symm

/--
Terminality gives uniqueness among all continuous natural maps satisfying
the same coalgebra equation.
-/
theorem supportedDenote_unique
    (candidate : processCpoModel ⟶ Agent)
    (commutes :
      supportedOneStep ≫ ActualAgentFunctor.map candidate =
        candidate ≫ agentUnfold) :
    candidate = supportedDenote := by
  let hom :
      supportedCoalgebra ⟶ concreteActualCoalgebra :=
    { f := candidate
      h := commutes }
  have unique :=
    concreteCoalgebraToTerminal_unique supportedCoalgebra hom
  exact congrArg Coalgebra.Hom.f unique

/-! ## Actual constructor equations -/

@[simp]
theorem supportedDenote_zero_unfold (world : World) :
    agentUnfold.app world
        (supportedDenote.app world
          (SupportedProc.zero : SupportedProc world 0)) =
      (⊥ : OmegaScottPower
        (ActionRepresentation Agent world)) := by
  rw [supportedDenote_unroll_at]
  rw [supportedHeadLayer]
  change mapRaw _ (⊥ : OmegaScottPower
    (ActionRepresentation processCpoModel world)) = _
  exact mapRaw_bot _

@[simp]
theorem supportedDenote_tau_unfold
    (world : World) (next : SupportedProc world 0) :
    agentUnfold.app world
        (supportedDenote.app world (.tau next)) =
      principalRaw
        (tauAction world
          (supportedDenote.app world next)) := by
  rw [supportedDenote_unroll_at]
  rw [supportedHeadLayer]
  rw [mapRaw_principal]
  simp only [syntaxTauAction, actionModelMap_tau]
  rfl

@[simp]
theorem supportedDenote_output_unfold
    (world : World)
    (channel value : ScopedName world 0)
    (next : SupportedProc world 0) :
    agentUnfold.app world
        (supportedDenote.app world
          (.output channel value next)) =
      principalRaw
        (Sum.inr
          (Sum.inl
            ((nameTag (closedName channel),
              nameTag (closedName value)),
             supportedDenote.app world next))) := by
  rw [supportedDenote_unroll_at]
  rw [supportedHeadLayer]
  rw [mapRaw_principal]
  simp only [syntaxFreeOutputAction, actionModelMap_freeOutput]
  rfl

@[simp]
theorem supportedDenote_input_unfold
    (world : World)
    (channel : ScopedName world 0)
    (body : SupportedProc world 1) :
    agentUnfold.app world
        (supportedDenote.app world (.input channel body)) =
      principalRaw
        (Sum.inl
          (nameTag (closedName channel),
            (fun received =>
              supportedDenote.app world
                (SupportedProc.instantiateOuter received body),
             supportedDenote.app (world + 1)
                (SupportedProc.freshenOuter body)))) := by
  rw [supportedDenote_unroll_at]
  rw [supportedHeadLayer]
  rw [mapRaw_principal]
  simp only [syntaxInputAction, actionModelMap_input]
  rfl

theorem supportedDenote_choice_unfold
    (world : World)
    (left right : SupportedProc world 0) :
    agentUnfold.app world
        (supportedDenote.app world (.choice left right)) =
      mapRaw (actionModelMapComponent supportedDenote world)
          (supportedHeadLayer world left) ⊔
        mapRaw (actionModelMapComponent supportedDenote world)
          (supportedHeadLayer world right) := by
  rw [supportedDenote_unroll_at]
  rw [supportedHeadLayer]
  change mapRaw _ (_ ⊔ _) = _
  exact mapRaw_sup _ _ _

theorem supportedDenote_matchEq_unfold
    (world : World)
    (left right : ScopedName world 0)
    (next : SupportedProc world 0)
    (equal : closedName left = closedName right) :
    agentUnfold.app world
        (supportedDenote.app world (.matchEq left right next)) =
      agentUnfold.app world
        (supportedDenote.app world next) := by
  rw [supportedDenote_unroll_at, supportedDenote_unroll_at]
  simp [supportedHeadLayer, equal]

theorem supportedDenote_matchNe_unfold
    (world : World)
    (left right : ScopedName world 0)
    (next : SupportedProc world 0)
    (distinct : closedName left ≠ closedName right) :
    agentUnfold.app world
        (supportedDenote.app world (.matchNe left right next)) =
      agentUnfold.app world
        (supportedDenote.app world next) := by
  rw [supportedDenote_unroll_at, supportedDenote_unroll_at]
  simp [supportedHeadLayer, distinct]

/-! ## Equality in the actual recursive carrier -/

/-- Fold a single actual FMS action into the recursive carrier. -/
def fixedPrefixAgent
    (world : World)
    (action : ActionRepresentation Agent world) :
    Agent.obj world :=
  agentFold.app world (principalRaw action)

@[simp]
theorem fixedPrefixAgent_unfold
    (world : World)
    (action : ActionRepresentation Agent world) :
    agentUnfold.app world (fixedPrefixAgent world action) =
      principalRaw action := by
  exact
    concreteActualAlgebraicCompactnessWitness.fixed.fold_unfold
      world (principalRaw action)

/-- The actual input action generated by a supported binder body. -/
def actualInputAction
    (world : World)
    (channel : Fin world)
    (known : Fin world → Agent.obj world)
    (fresh : Agent.obj (world + 1)) :
    ActionRepresentation Agent world :=
  Sum.inl (nameTag channel, (known, fresh))

/-- The actual free-output action generated by supported syntax. -/
def actualFreeOutputAction
    (world : World)
    (channel value : Fin world)
    (continuation : Agent.obj world) :
    ActionRepresentation Agent world :=
  Sum.inr
    (Sum.inl
      ((nameTag channel, nameTag value), continuation))

/-- The actual bound-output action in the concrete recursive carrier. -/
def actualBoundOutputAction
    (world : World)
    (channel : Fin world)
    (continuation : Agent.obj (world + 1)) :
    ActionRepresentation Agent world :=
  Sum.inr
    (Sum.inr
      (Sum.inl (nameTag channel, continuation)))

/-- Actual binary lower-power choice before folding. -/
def fixedChoiceLayer
    (world : World)
    (left right : Agent.obj world) :
    OmegaScottPower
      (ActionRepresentation Agent world) :=
  let leftLayer :
      OmegaScottPower
        (ActionRepresentation Agent world) :=
    agentUnfold.app world left
  let rightLayer :
      OmegaScottPower
        (ActionRepresentation Agent world) :=
    agentUnfold.app world right
  leftLayer ⊔ rightLayer

/-- Actual binary lower-power choice folded into the recursive carrier. -/
def fixedChoiceAgent
    (world : World)
    (left right : Agent.obj world) :
    Agent.obj world :=
  agentFold.app world (fixedChoiceLayer world left right)

@[simp]
theorem fixedChoiceAgent_unfold
    (world : World)
    (left right : Agent.obj world) :
    agentUnfold.app world (fixedChoiceAgent world left right) =
      fixedChoiceLayer world left right := by
  exact
    concreteActualAlgebraicCompactnessWitness.fixed.fold_unfold
      world (fixedChoiceLayer world left right)

/-- Inactive syntax denotes the actual folded lower-power bottom. -/
@[simp]
theorem supportedDenote_zero (world : World) :
    supportedDenote.app world
        (SupportedProc.zero : SupportedProc world 0) =
      fixedInactive world := by
  apply agentUnfold_injective world
  rw [supportedDenote_zero_unfold, fixedInactive_unfold]
  rfl

/-- Tau syntax denotes the actual principal tau action, not a trace proxy. -/
@[simp]
theorem supportedDenote_tau
    (world : World) (next : SupportedProc world 0) :
    supportedDenote.app world (.tau next) =
      fixedTauAgent world
        (supportedDenote.app world next) := by
  apply agentUnfold_injective world
  rw [supportedDenote_tau_unfold, fixedTauAgent_unfold]
  rfl

/-- Free output denotes the corresponding actual principal action. -/
@[simp]
theorem supportedDenote_output
    (world : World)
    (channel value : ScopedName world 0)
    (next : SupportedProc world 0) :
    supportedDenote.app world
        (.output channel value next) =
      fixedPrefixAgent world
        (actualFreeOutputAction world
          (closedName channel) (closedName value)
          (supportedDenote.app world next)) := by
  apply agentUnfold_injective world
  rw [supportedDenote_output_unfold, fixedPrefixAgent_unfold]
  rfl

/-- Input denotes the complete actual old/fresh FMS abstraction. -/
@[simp]
theorem supportedDenote_input
    (world : World)
    (channel : ScopedName world 0)
    (body : SupportedProc world 1) :
    supportedDenote.app world (.input channel body) =
      fixedPrefixAgent world
        (actualInputAction world (closedName channel)
          (fun received =>
            supportedDenote.app world
              (SupportedProc.instantiateOuter received body))
          (supportedDenote.app (world + 1)
            (SupportedProc.freshenOuter body))) := by
  apply agentUnfold_injective world
  rw [supportedDenote_input_unfold, fixedPrefixAgent_unfold]
  rfl

/-- Syntax choice is the actual lower-power join in the recursive carrier. -/
theorem supportedDenote_choice
    (world : World)
    (left right : SupportedProc world 0) :
    supportedDenote.app world (.choice left right) =
      fixedChoiceAgent world
        (supportedDenote.app world left)
        (supportedDenote.app world right) := by
  apply agentUnfold_injective world
  rw [supportedDenote_choice_unfold, fixedChoiceAgent_unfold]
  unfold fixedChoiceLayer
  apply congrArg₂
    (fun
      first second :
        OmegaScottPower (ActionRepresentation Agent world) =>
      first ⊔ second)
  · exact
      (supportedDenote_unroll_at world left).symm
  · exact
      (supportedDenote_unroll_at world right).symm

/-- A true equality guard is semantically transparent in the actual Agent. -/
theorem supportedDenote_matchEq
    (world : World)
    (left right : ScopedName world 0)
    (next : SupportedProc world 0)
    (equal : closedName left = closedName right) :
    supportedDenote.app world (.matchEq left right next) =
      supportedDenote.app world next := by
  apply agentUnfold_injective world
  exact supportedDenote_matchEq_unfold world left right next equal

/-- A true inequality guard is semantically transparent in the actual Agent. -/
theorem supportedDenote_matchNe
    (world : World)
    (left right : ScopedName world 0)
    (next : SupportedProc world 0)
    (distinct : closedName left ≠ closedName right) :
    supportedDenote.app world (.matchNe left right next) =
      supportedDenote.app world next := by
  apply agentUnfold_injective world
  exact supportedDenote_matchNe_unfold world left right next distinct

/-! ## Native late-pi adequacy of the supported heads -/

theorem tau_reification_native
    (world : World) (next : SupportedProc world 0) :
    Late.NativeStep
      (SupportedProc.reifyAtWorld (.tau next))
      .tau
      (SupportedProc.reifyAtWorld next) := by
  exact Late.NativeStep.prefixTau

theorem output_reification_native
    (world : World)
    (channel value : ScopedName world 0)
    (next : SupportedProc world 0) :
    Late.NativeStep
      (SupportedProc.reifyAtWorld
        (.output channel value next))
      (.output
        (closedName channel).val
        (closedName value).val)
      (SupportedProc.reifyAtWorld next) := by
  cases channel with
  | free channel =>
      cases value with
      | free value =>
          exact Late.NativeStep.prefixOutput
      | bound impossible => exact Fin.elim0 impossible
  | bound impossible => exact Fin.elim0 impossible

/-- The exact nominal derivative selected by canonical input reification. -/
def inputReificationTarget
    (world : World) (body : SupportedProc world 1) : Raw.Proc :=
  SupportedProc.reify (world + 1)
    Fin.val
    (FMSOperationalSyntaxBridge.extendBound world Fin.elim0)
    body

theorem input_reification_native
    (world : World)
    (channel : ScopedName world 0)
    (body : SupportedProc world 1) :
    Late.NativeStep
      (SupportedProc.reifyAtWorld (.input channel body))
      (.input (closedName channel).val world)
      (inputReificationTarget world body) := by
  cases channel with
  | free channel =>
      exact Late.NativeStep.prefixInput
  | bound impossible => exact Fin.elim0 impossible

theorem choice_left_reification_native
    (world : World)
    (left right : SupportedProc world 0)
    (action : Raw.Action) (target : Raw.Proc)
    (step :
      Late.NativeStep
        (SupportedProc.reifyAtWorld left) action target) :
    Late.NativeStep
      (SupportedProc.reifyAtWorld (.choice left right))
      action target := by
  exact Late.NativeStep.choiceLeft step

theorem choice_right_reification_native
    (world : World)
    (left right : SupportedProc world 0)
    (action : Raw.Action) (target : Raw.Proc)
    (step :
      Late.NativeStep
        (SupportedProc.reifyAtWorld right) action target) :
    Late.NativeStep
      (SupportedProc.reifyAtWorld (.choice left right))
      action target := by
  exact Late.NativeStep.choiceRight step

theorem matchEq_reification_native
    (world : World)
    (name : ScopedName world 0)
    (next : SupportedProc world 0)
    (action : Raw.Action) (target : Raw.Proc)
    (step :
      Late.NativeStep
        (SupportedProc.reifyAtWorld next) action target) :
    Late.NativeStep
      (SupportedProc.reifyAtWorld (.matchEq name name next))
      action target := by
  exact Late.NativeStep.matchGuard step

/--
Canonical locally nameless scope extrusion is one genuine bound-output step.
The restricted name is the current fresh supply `world`, and is provably
distinct from every old channel `channel.val`.
-/
theorem boundOutput_reification_native
    (world : World)
    (channel : Fin world)
    (next : SupportedProc world 1) :
    Late.NativeStep
      (SupportedProc.reifyAtWorld
        (.restrict
          (.output
            (.free channel)
            (.bound (Fin.last 0))
            next)))
      (.boundOutput channel.val world)
      (inputReificationTarget world next) := by
  apply Late.NativeStep.open
  · exact Nat.ne_of_lt channel.isLt |>.symm
  · exact Late.NativeStep.prefixOutput

/-! ## Honest boundary and the independent recursive restriction -/

/-- Parallel is intentionally not fabricated by the prefix coalgebra. -/
@[simp]
theorem parallel_head_is_bottom
    (world : World) (left right : SupportedProc world 0) :
    supportedHeadLayer world (.parallel left right) = ⊥ :=
  by simp [supportedHeadLayer]

/-- Restriction is intentionally not fabricated by the prefix coalgebra. -/
@[simp]
theorem restriction_head_is_bottom
    (world : World) (body : SupportedProc world 1) :
    supportedHeadLayer world (.restrict body) = ⊥ :=
  by simp [supportedHeadLayer]

/--
The actual recursive Table-4 restriction can nevertheless be applied to the
actual denotation of the canonically freshened body.
-/
def supportedRestrictionDenote
    (world : World) (body : SupportedProc world 1) :
    Agent.obj world :=
  agentRestrictionAt world
    (supportedDenote.app (world + 1)
      (SupportedProc.freshenOuter body))

/-- Restriction of a tau-prefixed supported process commutes with actual tau. -/
theorem supportedRestriction_tau
    (world : World) (next : SupportedProc world 1)
    (denoteFreshTau :
      supportedDenote.app (world + 1)
          (SupportedProc.freshenOuter (.tau next)) =
        fixedTauAgent (world + 1)
          (supportedDenote.app (world + 1)
            (SupportedProc.freshenOuter next))) :
    supportedRestrictionDenote world (.tau next) =
      fixedTauAgent world
        (supportedRestrictionDenote world next) := by
  unfold supportedRestrictionDenote
  rw [denoteFreshTau]
  exact agentRestriction_fixedTau world _

end Cantilune.Pi.FMSCpoSupportedActualAgent
