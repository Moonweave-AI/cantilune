import Cantilune.Pi.FMSCpoSupportedParallelRestriction

/-!
# Total finite-control supported operational coalgebra

This module closes the deliberately conservative boundary of
`FMSCpoSupportedActualAgent.supportedHeadLayer`.  Its one-step layer is
defined by fuel recursion over the finite syntax tree.  Choice, guards,
parallel, and restriction recursively inspect their operands; prefix
continuations remain supported processes and are therefore unfolded by this
same coalgebra at the next observation.

The parallel and restriction clauses reuse the continuous interleaving,
Fubini synchronization, and Table-4 restriction kernels from
`FMSCpoSupportedParallelRestriction`.
-/

noncomputable section

set_option linter.unusedSimpArgs false

namespace Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra

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
open Cantilune.Pi.FMSCanonicalHidingSyntax
open Cantilune.Pi.FMSOperationalSyntaxBridge
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoInputTransport
open Cantilune.Pi.FMSCpoNameAbstractionFunctor
open Cantilune.Pi.FMSCpoNominalDeltaCoherence
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoAgentOperationalBridge
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoWorld
open Cantilune.Pi.FMSCpoSupportedActualAgent
open Cantilune.Pi.FMSCpoSupportedParallelRestriction
open Cantilune.Pi.PowerdomainUnseparated

/-! ## Syntax height and fuel recursion -/

/-- Height of a finite-control supported process. -/
def processHeight {free bound : Nat} :
    SupportedProc free bound → Nat
  | .zero => 1
  | .tau next => processHeight next + 1
  | .input _ body => processHeight body + 1
  | .output _ _ next => processHeight next + 1
  | .choice left right =>
      max (processHeight left) (processHeight right) + 1
  | .parallel left right =>
      max (processHeight left) (processHeight right) + 1
  | .restrict body => processHeight body + 1
  | .matchEq _ _ next => processHeight next + 1
  | .matchNe _ _ next => processHeight next + 1

@[simp]
theorem processHeight_renameFree
    (rename : Fin source → Fin target)
    (process : SupportedProc source bound) :
    processHeight (SupportedProc.renameFree rename process) =
      processHeight process := by
  induction process <;>
    simp [processHeight, SupportedProc.renameFree, *]

private def processHeightSubstitutionProperty {free : Nat} :
    {bound : Nat} → SupportedProc free bound → Prop
  | 0, _ => True
  | bound + 1, process =>
      ∀ (binder : Fin (bound + 1))
        (replacement : ScopedName free bound),
        processHeight
            (SupportedProc.substituteBinderWith
              binder replacement process) =
          processHeight process

private theorem processHeightSubstitutionProperty_all
    {bound : Nat}
    (process : SupportedProc free bound) :
    processHeightSubstitutionProperty process := by
  induction process with
  | @zero bound =>
      cases bound <;>
        simp [processHeightSubstitutionProperty,
          SupportedProc.substituteBinderWith, processHeight]
  | @tau bound next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            ih binder replacement]
  | @input bound channel body ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            ih binder.castSucc (ScopedName.liftBound replacement)]
  | @output bound channel value next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            ih binder replacement]
  | @choice bound left right leftIH rightIH =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            leftIH binder replacement, rightIH binder replacement]
  | @parallel bound left right leftIH rightIH =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            leftIH binder replacement, rightIH binder replacement]
  | @restrict bound body ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            ih binder.castSucc (ScopedName.liftBound replacement)]
  | @matchEq bound left right next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            ih binder replacement]
  | @matchNe bound left right next ih =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder replacement
          simp [processHeightSubstitutionProperty,
            SupportedProc.substituteBinderWith, processHeight,
            ih binder replacement]

@[simp]
theorem processHeight_substituteBinderWith
    (binder : Fin (bound + 1))
    (replacement : ScopedName free bound)
    (process : SupportedProc free (bound + 1)) :
    processHeight
        (SupportedProc.substituteBinderWith binder replacement process) =
      processHeight process :=
  processHeightSubstitutionProperty_all process binder replacement

@[simp]
theorem processHeight_freshenOuter
    (body : SupportedProc world 1) :
    processHeight (SupportedProc.freshenOuter body) =
      processHeight body := by
  simp [SupportedProc.freshenOuter]

/-- Bound-output/input close, the Table-5 synchronization missing from the
conservative free-synchronization kernel. -/
def closePairRaw
    (world : World)
    (pair :
      ActionRepresentation processCpoModel world ×
        ActionRepresentation processCpoModel world) :
    OmegaScottPower
      (ActionRepresentation processCpoModel world) :=
  match pair.1, pair.2 with
  | Sum.inl (inputChannel, (_known, fresh)),
      Sum.inr (Sum.inr
        (Sum.inl (outputChannel, continuation))) =>
      if tagName inputChannel = tagName outputChannel then
        principalRaw
          (syntaxTauAction world
            (SupportedProc.restrictLast
              (.parallel fresh continuation)))
      else ⊥
  | Sum.inr (Sum.inr
        (Sum.inl (outputChannel, continuation))),
      Sum.inl (inputChannel, (_known, fresh)) =>
      if tagName inputChannel = tagName outputChannel then
        principalRaw
          (syntaxTauAction world
            (SupportedProc.restrictLast
              (.parallel continuation fresh)))
      else ⊥
  | _, _ => ⊥

/-- Close as a continuous kernel on the flat supported action carrier. -/
def closePairStep
    (world : World) :
    (ActionRepresentation processCpoModel world ×
      ActionRepresentation processCpoModel world) →𝒄
        OmegaScottPower
          (ActionRepresentation processCpoModel world) :=
  continuousOfFlat actionPair_le_eq (closePairRaw world)

/-- Fubini extension of bound-output/input close to arbitrary computations. -/
def closeSynchronizationLayer
    (world : World)
    (left right :
      OmegaScottPower
        (ActionRepresentation processCpoModel world)) :
    OmegaScottPower
      (ActionRepresentation processCpoModel world) :=
  flattenRaw
    (mapRaw (closePairStep world)
      (PowerdomainUnseparated.fubiniRaw left right))

/--
Parallel assembly parameterized by already computed operand layers.

This is the existing interleaving/synchronization implementation with the
conservative head calls factored out.
-/
def parallelLayerFrom
    (world : World)
    (left right : SupportedProc world 0)
    (leftLayer rightLayer :
      OmegaScottPower
        (ActionRepresentation processCpoModel world)) :
    OmegaScottPower
      (ActionRepresentation processCpoModel world) :=
  (mapRaw (interleaveLeftAction world right) leftLayer ⊔
    mapRaw (interleaveRightAction world left) rightLayer) ⊔
    synchronizationLayer world leftLayer rightLayer

/-- Complete Table-5 parallel assembly, including bound close. -/
def totalParallelLayerFrom
    (world : World)
    (left right : SupportedProc world 0)
    (leftLayer rightLayer :
      OmegaScottPower
        (ActionRepresentation processCpoModel world)) :
    OmegaScottPower
      (ActionRepresentation processCpoModel world) :=
  parallelLayerFrom world left right leftLayer rightLayer ⊔
    closeSynchronizationLayer world leftLayer rightLayer

/-- Restriction assembly parameterized by the recursively computed body layer. -/
def restrictionLayerFrom
    (world : World)
    (bodyLayer :
      OmegaScottPower
        (ActionRepresentation processCpoModel (world + 1))) :
    OmegaScottPower
      (ActionRepresentation processCpoModel world) :=
  restrictionLayer world bodyLayer

/--
Fuel-indexed total one-step semantics.

Fuel zero is the guarded approximation bottom.  At successor fuel every
non-prefix control operator recursively uses the same function at smaller
fuel.  Prefix continuations are intentionally left as syntax: after the
terminal map follows such a continuation, `totalSupportedLayer` is invoked
again on that continuation.
-/
def totalSupportedLayerFuel :
    Nat →
      (world : World) →
        SupportedProc world 0 →
          OmegaScottPower
            (ActionRepresentation processCpoModel world)
  | 0, _, _ => ⊥
  | _ + 1, world, .zero => ⊥
  | _ + 1, world, .tau next =>
      principalRaw (syntaxTauAction world next)
  | _ + 1, world, .input channel body =>
      principalRaw
        (syntaxInputAction world (closedName channel) body)
  | _ + 1, world, .output channel value next =>
      principalRaw
        (syntaxFreeOutputAction world
          (closedName channel) (closedName value) next)
  | fuel + 1, world, .choice left right =>
      totalSupportedLayerFuel fuel world left ⊔
        totalSupportedLayerFuel fuel world right
  | fuel + 1, world, .parallel left right =>
      totalParallelLayerFrom world left right
        (totalSupportedLayerFuel fuel world left)
        (totalSupportedLayerFuel fuel world right)
  | fuel + 1, world, .restrict body =>
      restrictionLayerFrom world
        (totalSupportedLayerFuel fuel (world + 1)
          (SupportedProc.freshenOuter body))
  | fuel + 1, world, .matchEq left right next =>
      if closedName left = closedName right then
        totalSupportedLayerFuel fuel world next
      else ⊥
  | fuel + 1, world, .matchNe left right next =>
      if closedName left ≠ closedName right then
        totalSupportedLayerFuel fuel world next
      else ⊥

/-- The total finite-control one-step layer, using the exact syntax height. -/
def totalSupportedLayer
    (world : World)
    (process : SupportedProc world 0) :
    OmegaScottPower
      (ActionRepresentation processCpoModel world) :=
  totalSupportedLayerFuel (processHeight process) world process

/-! ## Equivariance of the reused parallel kernels -/

/-- Canonical input transport distributes over parallel on the right. -/
theorem inputKnownTransport_parallelRight
    {source target : World}
    (injection : source ⟶ target)
    (right : SupportedProc source 0)
    (known : Fin source → processCpoModel.obj source)
    (fresh : processCpoModel.obj (source + 1))
    (name : Fin target) :
    inputKnownTransport processCpoModel injection
        (fun old => .parallel (known old) right)
        (.parallel fresh
          (SupportedProc.renameFree Fin.castSucc right))
        name =
      .parallel
        (inputKnownTransport processCpoModel injection
          known fresh name)
        (SupportedProc.renameFree
          (homToFun injection) right) := by
  rw [inputKnownTransport, inputKnownTransport]
  split_ifs with oldWitness
  · rfl
  · simp only [processCpoModel]
    change
      SupportedProc.renameFree
          (homToFun (extendByName injection name oldWitness))
          (.parallel fresh
            (SupportedProc.renameFree Fin.castSucc right)) =
        .parallel
          (SupportedProc.renameFree
            (homToFun (extendByName injection name oldWitness))
            fresh)
          (SupportedProc.renameFree
            (homToFun injection) right)
    rw [SupportedProc.renameFree]
    apply congrArg₂ SupportedProc.parallel
    · rfl
    · rw [SupportedProc.renameFree_comp]
      apply congrArg
        (fun rename => SupportedProc.renameFree rename right)
      funext old
      exact extendByName_castSucc
        injection name oldWitness old

/-- Canonical input transport distributes over parallel on the left. -/
theorem inputKnownTransport_parallelLeft
    {source target : World}
    (injection : source ⟶ target)
    (left : SupportedProc source 0)
    (known : Fin source → processCpoModel.obj source)
    (fresh : processCpoModel.obj (source + 1))
    (name : Fin target) :
    inputKnownTransport processCpoModel injection
        (fun old => .parallel left (known old))
        (.parallel
          (SupportedProc.renameFree Fin.castSucc left) fresh)
        name =
      .parallel
        (SupportedProc.renameFree
          (homToFun injection) left)
        (inputKnownTransport processCpoModel injection
          known fresh name) := by
  rw [inputKnownTransport, inputKnownTransport]
  split_ifs with oldWitness
  · rfl
  · simp only [processCpoModel]
    change
      SupportedProc.renameFree
          (homToFun (extendByName injection name oldWitness))
          (.parallel
            (SupportedProc.renameFree Fin.castSucc left) fresh) =
        .parallel
          (SupportedProc.renameFree
            (homToFun injection) left)
          (SupportedProc.renameFree
            (homToFun (extendByName injection name oldWitness))
            fresh)
    rw [SupportedProc.renameFree]
    apply congrArg₂ SupportedProc.parallel
    · rw [SupportedProc.renameFree_comp]
      apply congrArg
        (fun rename => SupportedProc.renameFree rename left)
      funext old
      exact extendByName_castSucc
        injection name oldWitness old
    · rfl

/-- Weakening a process and then mapping a successor injection is natural. -/
theorem renameFree_successor_castSucc
    {source target : World}
    (injection : source ⟶ target)
    (process : SupportedProc source bound) :
    SupportedProc.renameFree
        (homToFun (successorMap injection))
        (SupportedProc.renameFree Fin.castSucc process) =
      SupportedProc.renameFree Fin.castSucc
        (SupportedProc.renameFree
          (homToFun injection) process) := by
  rw [SupportedProc.renameFree_comp,
    SupportedProc.renameFree_comp]
  apply congrArg
    (fun rename => SupportedProc.renameFree rename process)
  funext old
  exact Injection.succ_castSucc
    (asInjection injection) old

@[simp]
theorem interleaveLeftAction_input
    (world : World) (right : SupportedProc world 0)
    (channel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh : processCpoModel.obj (world + 1)) :
    interleaveLeftAction world right
        (Sum.inl (channel, (known, fresh))) =
      Sum.inl
        (channel,
          (fun name => .parallel (known name) right,
           .parallel fresh
             (SupportedProc.renameFree Fin.castSucc right))) := by
  rfl

@[simp]
theorem interleaveLeftAction_freeOutput
    (world : World) (right : SupportedProc world 0)
    (channel value : NameTag world)
    (next : processCpoModel.obj world) :
    interleaveLeftAction world right
        (Sum.inr (Sum.inl ((channel, value), next))) =
      Sum.inr
        (Sum.inl
          ((channel, value), .parallel next right)) := by
  rfl

@[simp]
theorem interleaveLeftAction_boundOutput
    (world : World) (right : SupportedProc world 0)
    (channel : NameTag world)
    (next : processCpoModel.obj (world + 1)) :
    interleaveLeftAction world right
        (Sum.inr (Sum.inr (Sum.inl (channel, next)))) =
      Sum.inr
        (Sum.inr
          (Sum.inl
            (channel,
              .parallel next
                (SupportedProc.renameFree Fin.castSucc right)))) := by
  rfl

@[simp]
theorem interleaveLeftAction_tau
    (world : World) (right : SupportedProc world 0)
    (next : processCpoModel.obj world) :
    interleaveLeftAction world right
        (Sum.inr (Sum.inr (Sum.inr next))) =
      Sum.inr (Sum.inr (Sum.inr (.parallel next right))) := by
  rfl

@[simp]
theorem interleaveRightAction_input
    (world : World) (left : SupportedProc world 0)
    (channel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh : processCpoModel.obj (world + 1)) :
    interleaveRightAction world left
        (Sum.inl (channel, (known, fresh))) =
      Sum.inl
        (channel,
          (fun name => .parallel left (known name),
           .parallel
             (SupportedProc.renameFree Fin.castSucc left) fresh)) := by
  rfl

@[simp]
theorem interleaveRightAction_freeOutput
    (world : World) (left : SupportedProc world 0)
    (channel value : NameTag world)
    (next : processCpoModel.obj world) :
    interleaveRightAction world left
        (Sum.inr (Sum.inl ((channel, value), next))) =
      Sum.inr
        (Sum.inl
          ((channel, value), .parallel left next)) := by
  rfl

@[simp]
theorem interleaveRightAction_boundOutput
    (world : World) (left : SupportedProc world 0)
    (channel : NameTag world)
    (next : processCpoModel.obj (world + 1)) :
    interleaveRightAction world left
        (Sum.inr (Sum.inr (Sum.inl (channel, next)))) =
      Sum.inr
        (Sum.inr
          (Sum.inl
            (channel,
              .parallel
                (SupportedProc.renameFree Fin.castSucc left)
                next))) := by
  rfl

@[simp]
theorem interleaveRightAction_tau
    (world : World) (left : SupportedProc world 0)
    (next : processCpoModel.obj world) :
    interleaveRightAction world left
        (Sum.inr (Sum.inr (Sum.inr next))) =
      Sum.inr (Sum.inr (Sum.inr (.parallel left next))) := by
  rfl

/-- Left interleaving commutes with every finite-world injection. -/
theorem interleaveLeftAction_natural
    {source target : World}
    (injection : source ⟶ target)
    (right : SupportedProc source 0)
    (action : ActionRepresentation processCpoModel source) :
    actionWorldMap processCpoModel injection
        (interleaveLeftAction source right action) =
      interleaveLeftAction target
        (SupportedProc.renameFree (homToFun injection) right)
        (actionWorldMap processCpoModel injection action) := by
  rcases action with input | rest
  · rcases input with ⟨channel, known, fresh⟩
    rw [interleaveLeftAction_input,
      actionWorldMap_input, actionWorldMap_input,
      interleaveLeftAction_input]
    apply congrArg Sum.inl
    apply Prod.ext
    · rfl
    · apply Prod.ext
      · funext name
        exact inputKnownTransport_parallelRight
          injection right known fresh name
      · change
          SupportedProc.renameFree
              (homToFun (successorMap injection))
              (.parallel fresh
                (SupportedProc.renameFree Fin.castSucc right)) =
            .parallel
              (SupportedProc.renameFree
                (homToFun (successorMap injection)) fresh)
              (SupportedProc.renameFree Fin.castSucc
                (SupportedProc.renameFree
                  (homToFun injection) right))
        rw [SupportedProc.renameFree]
        exact congrArg
          (SupportedProc.parallel
            (SupportedProc.renameFree
              (homToFun (successorMap injection)) fresh))
          (renameFree_successor_castSucc injection right)
  · rcases rest with free | rest
    · rcases free with ⟨⟨channel, value⟩, continuation⟩
      rw [interleaveLeftAction_freeOutput,
        actionWorldMap_freeOutput, actionWorldMap_freeOutput,
        interleaveLeftAction_freeOutput]
      rfl
    · rcases rest with bound | continuation
      · rcases bound with ⟨channel, next⟩
        rw [interleaveLeftAction_boundOutput,
          actionWorldMap_boundOutput, actionWorldMap_boundOutput,
          interleaveLeftAction_boundOutput]
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        apply congrArg Sum.inl
        apply Prod.ext
        · rfl
        · change
            SupportedProc.renameFree
                (homToFun (successorMap injection))
                (.parallel next
                  (SupportedProc.renameFree Fin.castSucc right)) =
              .parallel
                (SupportedProc.renameFree
                  (homToFun (successorMap injection)) next)
                (SupportedProc.renameFree Fin.castSucc
                  (SupportedProc.renameFree
                    (homToFun injection) right))
          rw [SupportedProc.renameFree]
          exact congrArg
            (SupportedProc.parallel
              (SupportedProc.renameFree
                (homToFun (successorMap injection)) next))
            (renameFree_successor_castSucc injection right)
      · rw [interleaveLeftAction_tau,
          actionWorldMap_tau, actionWorldMap_tau,
          interleaveLeftAction_tau]
        rfl

/-- Right interleaving commutes with every finite-world injection. -/
theorem interleaveRightAction_natural
    {source target : World}
    (injection : source ⟶ target)
    (left : SupportedProc source 0)
    (action : ActionRepresentation processCpoModel source) :
    actionWorldMap processCpoModel injection
        (interleaveRightAction source left action) =
      interleaveRightAction target
        (SupportedProc.renameFree (homToFun injection) left)
        (actionWorldMap processCpoModel injection action) := by
  rcases action with input | rest
  · rcases input with ⟨channel, known, fresh⟩
    rw [interleaveRightAction_input,
      actionWorldMap_input, actionWorldMap_input,
      interleaveRightAction_input]
    apply congrArg Sum.inl
    apply Prod.ext
    · rfl
    · apply Prod.ext
      · funext name
        exact inputKnownTransport_parallelLeft
          injection left known fresh name
      · change
          SupportedProc.renameFree
              (homToFun (successorMap injection))
              (.parallel
                (SupportedProc.renameFree Fin.castSucc left) fresh) =
            .parallel
              (SupportedProc.renameFree Fin.castSucc
                (SupportedProc.renameFree
                  (homToFun injection) left))
              (SupportedProc.renameFree
                (homToFun (successorMap injection)) fresh)
        rw [SupportedProc.renameFree]
        exact congrArg
          (fun process =>
            SupportedProc.parallel process
              (SupportedProc.renameFree
                (homToFun (successorMap injection)) fresh))
          (renameFree_successor_castSucc injection left)
  · rcases rest with free | rest
    · rcases free with ⟨⟨channel, value⟩, continuation⟩
      rw [interleaveRightAction_freeOutput,
        actionWorldMap_freeOutput, actionWorldMap_freeOutput,
        interleaveRightAction_freeOutput]
      rfl
    · rcases rest with bound | continuation
      · rcases bound with ⟨channel, next⟩
        rw [interleaveRightAction_boundOutput,
          actionWorldMap_boundOutput, actionWorldMap_boundOutput,
          interleaveRightAction_boundOutput]
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        apply congrArg Sum.inl
        apply Prod.ext
        · rfl
        · change
            SupportedProc.renameFree
                (homToFun (successorMap injection))
                (.parallel
                  (SupportedProc.renameFree Fin.castSucc left) next) =
              .parallel
                (SupportedProc.renameFree Fin.castSucc
                  (SupportedProc.renameFree
                    (homToFun injection) left))
                (SupportedProc.renameFree
                  (homToFun (successorMap injection)) next)
          rw [SupportedProc.renameFree]
          exact congrArg
            (fun process =>
              SupportedProc.parallel process
                (SupportedProc.renameFree
                  (homToFun (successorMap injection)) next))
            (renameFree_successor_castSucc injection left)
      · rw [interleaveRightAction_tau,
          actionWorldMap_tau, actionWorldMap_tau,
          interleaveRightAction_tau]
        rfl

@[simp]
theorem syncPairStep_input_freeOutput
    (world : World)
    (inputChannel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh : processCpoModel.obj (world + 1))
    (outputChannel value : NameTag world)
    (next : processCpoModel.obj world) :
    syncPairStep world
        (Sum.inl (inputChannel, (known, fresh)),
         Sum.inr (Sum.inl ((outputChannel, value), next))) =
      if tagName inputChannel = tagName outputChannel then
        principalRaw
          (syntaxTauAction world
            (.parallel (known (tagName value)) next))
      else ⊥ := by
  rfl

@[simp]
theorem syncPairStep_freeOutput_input
    (world : World)
    (outputChannel value : NameTag world)
    (next : processCpoModel.obj world)
    (inputChannel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh : processCpoModel.obj (world + 1)) :
    syncPairStep world
        (Sum.inr (Sum.inl ((outputChannel, value), next)),
         Sum.inl (inputChannel, (known, fresh))) =
      if tagName inputChannel = tagName outputChannel then
        principalRaw
          (syntaxTauAction world
            (.parallel next (known (tagName value))))
      else ⊥ := by
  rfl

/-- The existing free input/output synchronization kernel is equivariant. -/
theorem syncPairStep_natural
    {source target : World}
    (injection : source ⟶ target)
    (left right :
      ActionRepresentation processCpoModel source) :
    mapRaw (actionWorldMap processCpoModel injection)
        (syncPairStep source (left, right)) =
      syncPairStep target
        (actionWorldMap processCpoModel injection left,
         actionWorldMap processCpoModel injection right) := by
  rcases left with leftInput | leftRest
  · rcases leftInput with ⟨leftChannel, leftKnown, leftFresh⟩
    rcases right with rightInput | rightRest
    · rcases rightInput with
        ⟨rightChannel, rightKnown, rightFresh⟩
      simp [syncPairStep, syncPairRaw, continuousOfFlat,
        actionWorldMap_input, mapRaw_bot]
    · rcases rightRest with rightFree | rightRest
      · rcases rightFree with
          ⟨⟨rightChannel, rightValue⟩, rightNext⟩
        by_cases channels :
            tagName leftChannel = tagName rightChannel
        · have mappedChannels :
              tagName (mapNameTag injection leftChannel) =
                tagName (mapNameTag injection rightChannel) := by
            simp [mapNameTag, channels]
          rw [syncPairStep_input_freeOutput, if_pos channels,
            mapRaw_principal]
          change
            principalRaw
                (actionWorldMap processCpoModel injection
                  (Sum.inr (Sum.inr (Sum.inr
                    (.parallel
                      (leftKnown (tagName rightValue))
                      rightNext))))) =
              _
          rw [actionWorldMap_tau,
            actionWorldMap_input, actionWorldMap_freeOutput,
            syncPairStep_input_freeOutput, if_pos mappedChannels]
          rw [show
            tagName (mapNameTag injection rightValue) =
              homToFun injection (tagName rightValue) by rfl]
          rw [inputKnownTransport_old]
          rfl
        · have mappedChannels :
              tagName (mapNameTag injection leftChannel) ≠
                tagName (mapNameTag injection rightChannel) := by
            intro equal
            apply channels
            exact (asInjection injection).injective equal
          simp [syncPairStep_input_freeOutput,
            actionWorldMap_input, actionWorldMap_freeOutput,
            channels, mappedChannels, mapRaw_bot]
      · rcases rightRest with rightBound | rightTau
        · rcases rightBound with ⟨rightChannel, rightNext⟩
          simp [syncPairStep, syncPairRaw, continuousOfFlat,
            actionWorldMap_input, actionWorldMap_boundOutput,
            mapRaw_bot]
        · simp [syncPairStep, syncPairRaw, continuousOfFlat,
            actionWorldMap_input, actionWorldMap_tau,
            mapRaw_bot]
  · rcases leftRest with leftFree | leftRest
    · rcases leftFree with
        ⟨⟨leftChannel, leftValue⟩, leftNext⟩
      rcases right with rightInput | rightRest
      · rcases rightInput with
          ⟨rightChannel, rightKnown, rightFresh⟩
        by_cases channels :
            tagName leftChannel = tagName rightChannel
        · have mappedChannels :
              tagName (mapNameTag injection leftChannel) =
                tagName (mapNameTag injection rightChannel) := by
            simp [mapNameTag, channels]
          rw [syncPairStep_freeOutput_input, if_pos channels.symm,
            mapRaw_principal]
          change
            principalRaw
                (actionWorldMap processCpoModel injection
                  (Sum.inr (Sum.inr (Sum.inr
                    (.parallel leftNext
                      (rightKnown (tagName leftValue))))))) =
              _
          rw [actionWorldMap_tau,
            actionWorldMap_freeOutput, actionWorldMap_input,
            syncPairStep_freeOutput_input,
            if_pos mappedChannels.symm]
          rw [show
            tagName (mapNameTag injection leftValue) =
              homToFun injection (tagName leftValue) by rfl]
          rw [inputKnownTransport_old]
          rfl
        · have mappedChannels :
              tagName (mapNameTag injection leftChannel) ≠
                tagName (mapNameTag injection rightChannel) := by
            intro equal
            apply channels
            exact (asInjection injection).injective equal
          have reverseChannels :
              tagName rightChannel ≠ tagName leftChannel :=
            fun equal => channels equal.symm
          have reverseMapped :
              tagName (mapNameTag injection rightChannel) ≠
                tagName (mapNameTag injection leftChannel) :=
            fun equal => mappedChannels equal.symm
          simp [syncPairStep_freeOutput_input,
            actionWorldMap_freeOutput, actionWorldMap_input,
            reverseChannels, reverseMapped, mapRaw_bot]
      · rcases rightRest with rightFree | rightRest
        · rcases rightFree with
            ⟨⟨rightChannel, rightValue⟩, rightNext⟩
          simp [syncPairStep, syncPairRaw, continuousOfFlat,
            actionWorldMap_freeOutput, mapRaw_bot]
        · rcases rightRest with rightBound | rightTau
          · rcases rightBound with ⟨rightChannel, rightNext⟩
            simp [syncPairStep, syncPairRaw, continuousOfFlat,
              actionWorldMap_freeOutput,
              actionWorldMap_boundOutput, mapRaw_bot]
          · simp [syncPairStep, syncPairRaw, continuousOfFlat,
              actionWorldMap_freeOutput, actionWorldMap_tau,
              mapRaw_bot]
    · rcases leftRest with leftBound | leftTau
      · rcases leftBound with ⟨leftChannel, leftNext⟩
        rcases right with rightInput | rightRest
        · rcases rightInput with
            ⟨rightChannel, rightKnown, rightFresh⟩
          simp [syncPairStep, syncPairRaw, continuousOfFlat,
            actionWorldMap_boundOutput, actionWorldMap_input,
            mapRaw_bot]
        · rcases rightRest with rightFree | rightRest
          · rcases rightFree with
              ⟨⟨rightChannel, rightValue⟩, rightNext⟩
            simp [syncPairStep, syncPairRaw, continuousOfFlat,
              actionWorldMap_boundOutput,
              actionWorldMap_freeOutput, mapRaw_bot]
          · rcases rightRest with rightBound | rightTau
            · rcases rightBound with ⟨rightChannel, rightNext⟩
              simp [syncPairStep, syncPairRaw, continuousOfFlat,
                actionWorldMap_boundOutput, mapRaw_bot]
            · simp [syncPairStep, syncPairRaw, continuousOfFlat,
                actionWorldMap_boundOutput, actionWorldMap_tau,
                mapRaw_bot]
      · rcases right with rightInput | rightRest
        · rcases rightInput with
            ⟨rightChannel, rightKnown, rightFresh⟩
          simp [syncPairStep, syncPairRaw, continuousOfFlat,
            actionWorldMap_tau, actionWorldMap_input,
            mapRaw_bot]
        · rcases rightRest with rightFree | rightRest
          · rcases rightFree with
              ⟨⟨rightChannel, rightValue⟩, rightNext⟩
            simp [syncPairStep, syncPairRaw, continuousOfFlat,
              actionWorldMap_tau, actionWorldMap_freeOutput,
              mapRaw_bot]
          · rcases rightRest with rightBound | rightTau
            · rcases rightBound with ⟨rightChannel, rightNext⟩
              simp [syncPairStep, syncPairRaw, continuousOfFlat,
                actionWorldMap_tau, actionWorldMap_boundOutput,
                mapRaw_bot]
            · simp [syncPairStep, syncPairRaw, continuousOfFlat,
                actionWorldMap_tau, mapRaw_bot]

/-- Free synchronization of arbitrary computations is equivariant. -/
theorem synchronizationLayer_natural
    {source target : World}
    (injection : source ⟶ target)
    (left right :
      OmegaScottPower
        (ActionRepresentation processCpoModel source)) :
    mapRaw (actionWorldMap processCpoModel injection)
        (synchronizationLayer source left right) =
      synchronizationLayer target
        (mapRaw (actionWorldMap processCpoModel injection) left)
        (mapRaw (actionWorldMap processCpoModel injection) right) := by
  unfold synchronizationLayer
  rw [← flattenRaw_mapRaw_natural]
  rw [mapRaw_comp]
  have kernel :
      (map (actionWorldMap processCpoModel injection)).comp
          (syncPairStep source) =
        (syncPairStep target).comp
          (FMSCpoOmegaScottStrength.productMap
            (actionWorldMap processCpoModel injection)
            (actionWorldMap processCpoModel injection)) := by
    apply ContinuousHom.ext
    intro pair
    exact syncPairStep_natural
      injection pair.1 pair.2
  rw [kernel, ← mapRaw_comp]
  rw [PowerdomainUnseparated.fubiniRaw_natural]

theorem mapRaw_interleaveLeft_natural
    {source target : World}
    (injection : source ⟶ target)
    (right : SupportedProc source 0)
    (layer :
      OmegaScottPower
        (ActionRepresentation processCpoModel source)) :
    mapRaw (actionWorldMap processCpoModel injection)
        (mapRaw (interleaveLeftAction source right) layer) =
      mapRaw
        (interleaveLeftAction target
          (SupportedProc.renameFree (homToFun injection) right))
        (mapRaw (actionWorldMap processCpoModel injection) layer) := by
  rw [mapRaw_comp]
  have square :
      (actionWorldMap processCpoModel injection).comp
          (interleaveLeftAction source right) =
        (interleaveLeftAction target
          (SupportedProc.renameFree (homToFun injection) right)).comp
            (actionWorldMap processCpoModel injection) := by
    apply ContinuousHom.ext
    intro action
    exact interleaveLeftAction_natural
      injection right action
  rw [square, ← mapRaw_comp]

theorem mapRaw_interleaveRight_natural
    {source target : World}
    (injection : source ⟶ target)
    (left : SupportedProc source 0)
    (layer :
      OmegaScottPower
        (ActionRepresentation processCpoModel source)) :
    mapRaw (actionWorldMap processCpoModel injection)
        (mapRaw (interleaveRightAction source left) layer) =
      mapRaw
        (interleaveRightAction target
          (SupportedProc.renameFree (homToFun injection) left))
        (mapRaw (actionWorldMap processCpoModel injection) layer) := by
  rw [mapRaw_comp]
  have square :
      (actionWorldMap processCpoModel injection).comp
          (interleaveRightAction source left) =
        (interleaveRightAction target
          (SupportedProc.renameFree (homToFun injection) left)).comp
            (actionWorldMap processCpoModel injection) := by
    apply ContinuousHom.ext
    intro action
    exact interleaveRightAction_natural
      injection left action
  rw [square, ← mapRaw_comp]

/-- Parallel assembly is natural when its two operand layers are natural. -/
theorem parallelLayerFrom_natural
    {source target : World}
    (injection : source ⟶ target)
    (left right : SupportedProc source 0)
    (leftLayer rightLayer :
      OmegaScottPower
        (ActionRepresentation processCpoModel source)) :
    mapRaw (actionWorldMap processCpoModel injection)
        (parallelLayerFrom source left right
          leftLayer rightLayer) =
      parallelLayerFrom target
        (SupportedProc.renameFree (homToFun injection) left)
        (SupportedProc.renameFree (homToFun injection) right)
        (mapRaw (actionWorldMap processCpoModel injection)
          leftLayer)
        (mapRaw (actionWorldMap processCpoModel injection)
          rightLayer) := by
  unfold parallelLayerFrom
  rw [mapRaw_sup, mapRaw_sup]
  rw [mapRaw_interleaveLeft_natural,
    mapRaw_interleaveRight_natural,
    synchronizationLayer_natural]

private theorem closeRestrictLast_natural
    {source target : World}
    (injection : source ⟶ target)
    (process : SupportedProc (source + 1) 0) :
    SupportedProc.restrictLast
        (SupportedProc.renameFree
          (homToFun (successorMap injection)) process) =
      SupportedProc.renameFree
        (homToFun injection)
        (SupportedProc.restrictLast process) := by
  have successorAsExtend :
      homToFun (successorMap injection) =
        ScopedName.extendFree (homToFun injection) := by
    funext name
    cases name using Fin.lastCases with
    | cast old =>
        rw [ScopedName.extendFree_castSucc]
        exact Injection.succ_castSucc
          (asInjection injection) old
    | last =>
        rw [ScopedName.extendFree_last]
        exact Injection.succ_last
          (asInjection injection)
  rw [successorAsExtend]
  exact SupportedProc.restrictLast_renameFree
    (homToFun injection) process

@[simp]
theorem closePairStep_input_boundOutput
    (world : World)
    (inputChannel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh : processCpoModel.obj (world + 1))
    (outputChannel : NameTag world)
    (next : processCpoModel.obj (world + 1)) :
    closePairStep world
        (Sum.inl (inputChannel, (known, fresh)),
         Sum.inr (Sum.inr
          (Sum.inl (outputChannel, next)))) =
      if tagName inputChannel = tagName outputChannel then
        principalRaw
          (syntaxTauAction world
            (SupportedProc.restrictLast
              (.parallel fresh next)))
      else ⊥ := by
  rfl

@[simp]
theorem closePairStep_boundOutput_input
    (world : World)
    (outputChannel : NameTag world)
    (next : processCpoModel.obj (world + 1))
    (inputChannel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh : processCpoModel.obj (world + 1)) :
    closePairStep world
        (Sum.inr (Sum.inr
          (Sum.inl (outputChannel, next))),
         Sum.inl (inputChannel, (known, fresh))) =
      if tagName inputChannel = tagName outputChannel then
        principalRaw
          (syntaxTauAction world
            (SupportedProc.restrictLast
              (.parallel next fresh)))
      else ⊥ := by
  rfl

theorem closePairStep_natural
    {source target : World}
    (injection : source ⟶ target)
    (left right :
      ActionRepresentation processCpoModel source) :
    mapRaw (actionWorldMap processCpoModel injection)
        (closePairStep source (left, right)) =
      closePairStep target
        (actionWorldMap processCpoModel injection left,
         actionWorldMap processCpoModel injection right) := by
  rcases left with leftInput | leftRest
  · rcases leftInput with ⟨leftChannel, leftKnown, leftFresh⟩
    rcases right with rightInput | rightRest
    · rcases rightInput with
        ⟨rightChannel, rightKnown, rightFresh⟩
      simp [closePairStep, closePairRaw, continuousOfFlat,
        actionWorldMap_input, mapRaw_bot]
    · rcases rightRest with rightFree | rightRest
      · rcases rightFree with
          ⟨⟨rightChannel, rightValue⟩, rightNext⟩
        simp [closePairStep, closePairRaw, continuousOfFlat,
          actionWorldMap_input, actionWorldMap_freeOutput,
          mapRaw_bot]
      · rcases rightRest with rightBound | rightTau
        · rcases rightBound with ⟨rightChannel, rightNext⟩
          by_cases channels :
              tagName leftChannel = tagName rightChannel
          · have mappedChannels :
                tagName (mapNameTag injection leftChannel) =
                  tagName (mapNameTag injection rightChannel) := by
              simp [mapNameTag, channels]
            rw [closePairStep_input_boundOutput,
              if_pos channels, mapRaw_principal]
            change
              principalRaw
                  (actionWorldMap processCpoModel injection
                    (Sum.inr (Sum.inr (Sum.inr
                      (SupportedProc.restrictLast
                        (.parallel leftFresh rightNext)))))) =
                _
            rw [actionWorldMap_tau, actionWorldMap_input,
              actionWorldMap_boundOutput,
              closePairStep_input_boundOutput,
              if_pos mappedChannels]
            apply congrArg principalRaw
            apply congrArg Sum.inr
            apply congrArg Sum.inr
            apply congrArg Sum.inr
            change
              SupportedProc.renameFree
                  (homToFun injection)
                  (SupportedProc.restrictLast
                    (.parallel leftFresh rightNext)) =
                SupportedProc.restrictLast
                  (.parallel
                    (SupportedProc.renameFree
                      (homToFun (successorMap injection))
                      leftFresh)
                    (SupportedProc.renameFree
                      (homToFun (successorMap injection))
                      rightNext))
            exact
              (closeRestrictLast_natural injection
                (.parallel leftFresh rightNext)).symm
          · have mappedChannels :
                tagName (mapNameTag injection leftChannel) ≠
                  tagName (mapNameTag injection rightChannel) := by
              intro equal
              exact channels
                ((asInjection injection).injective equal)
            rw [closePairStep_input_boundOutput,
              if_neg channels, mapRaw_bot,
              actionWorldMap_input, actionWorldMap_boundOutput,
              closePairStep_input_boundOutput,
              if_neg mappedChannels]
        · simp [closePairStep, closePairRaw, continuousOfFlat,
            actionWorldMap_input, actionWorldMap_tau,
            mapRaw_bot]
  · rcases leftRest with leftFree | leftRest
    · rcases leftFree with
        ⟨⟨leftChannel, leftValue⟩, leftNext⟩
      rcases right with rightInput | rightRest
      · rcases rightInput with
          ⟨rightChannel, rightKnown, rightFresh⟩
        simp [closePairStep, closePairRaw, continuousOfFlat,
          actionWorldMap_freeOutput, actionWorldMap_input,
          mapRaw_bot]
      · rcases rightRest with rightFree | rightRest
        · rcases rightFree with
            ⟨⟨rightChannel, rightValue⟩, rightNext⟩
          simp [closePairStep, closePairRaw, continuousOfFlat,
            actionWorldMap_freeOutput, mapRaw_bot]
        · rcases rightRest with rightBound | rightTau
          · rcases rightBound with ⟨rightChannel, rightNext⟩
            simp [closePairStep, closePairRaw, continuousOfFlat,
              actionWorldMap_freeOutput,
              actionWorldMap_boundOutput, mapRaw_bot]
          · simp [closePairStep, closePairRaw, continuousOfFlat,
              actionWorldMap_freeOutput, actionWorldMap_tau,
              mapRaw_bot]
    · rcases leftRest with leftBound | leftTau
      · rcases leftBound with ⟨leftChannel, leftNext⟩
        rcases right with rightInput | rightRest
        · rcases rightInput with
            ⟨rightChannel, rightKnown, rightFresh⟩
          by_cases channels :
              tagName rightChannel = tagName leftChannel
          · have mappedChannels :
                tagName (mapNameTag injection rightChannel) =
                  tagName (mapNameTag injection leftChannel) := by
              simp [mapNameTag, channels]
            rw [closePairStep_boundOutput_input,
              if_pos channels, mapRaw_principal]
            change
              principalRaw
                  (actionWorldMap processCpoModel injection
                    (Sum.inr (Sum.inr (Sum.inr
                      (SupportedProc.restrictLast
                        (.parallel leftNext rightFresh)))))) =
                _
            rw [actionWorldMap_tau,
              actionWorldMap_boundOutput, actionWorldMap_input,
              closePairStep_boundOutput_input,
              if_pos mappedChannels]
            apply congrArg principalRaw
            apply congrArg Sum.inr
            apply congrArg Sum.inr
            apply congrArg Sum.inr
            change
              SupportedProc.renameFree
                  (homToFun injection)
                  (SupportedProc.restrictLast
                    (.parallel leftNext rightFresh)) =
                SupportedProc.restrictLast
                  (.parallel
                    (SupportedProc.renameFree
                      (homToFun (successorMap injection))
                      leftNext)
                    (SupportedProc.renameFree
                      (homToFun (successorMap injection))
                      rightFresh))
            exact
              (closeRestrictLast_natural injection
                (.parallel leftNext rightFresh)).symm
          · have mappedChannels :
                tagName (mapNameTag injection rightChannel) ≠
                  tagName (mapNameTag injection leftChannel) := by
              intro equal
              exact channels
                ((asInjection injection).injective equal)
            rw [closePairStep_boundOutput_input,
              if_neg channels, mapRaw_bot,
              actionWorldMap_boundOutput, actionWorldMap_input,
              closePairStep_boundOutput_input,
              if_neg mappedChannels]
        · rcases rightRest with rightFree | rightRest
          · rcases rightFree with
              ⟨⟨rightChannel, rightValue⟩, rightNext⟩
            simp [closePairStep, closePairRaw, continuousOfFlat,
              actionWorldMap_boundOutput,
              actionWorldMap_freeOutput, mapRaw_bot]
          · rcases rightRest with rightBound | rightTau
            · rcases rightBound with ⟨rightChannel, rightNext⟩
              simp [closePairStep, closePairRaw, continuousOfFlat,
                actionWorldMap_boundOutput, mapRaw_bot]
            · simp [closePairStep, closePairRaw, continuousOfFlat,
                actionWorldMap_boundOutput, actionWorldMap_tau,
                mapRaw_bot]
      · rcases right with rightInput | rightRest
        · rcases rightInput with
            ⟨rightChannel, rightKnown, rightFresh⟩
          simp [closePairStep, closePairRaw, continuousOfFlat,
            actionWorldMap_tau, actionWorldMap_input,
            mapRaw_bot]
        · rcases rightRest with rightFree | rightRest
          · rcases rightFree with
              ⟨⟨rightChannel, rightValue⟩, rightNext⟩
            simp [closePairStep, closePairRaw, continuousOfFlat,
              actionWorldMap_tau, actionWorldMap_freeOutput,
              mapRaw_bot]
          · rcases rightRest with rightBound | rightTau
            · rcases rightBound with ⟨rightChannel, rightNext⟩
              simp [closePairStep, closePairRaw, continuousOfFlat,
                actionWorldMap_tau, actionWorldMap_boundOutput,
                mapRaw_bot]
            · simp [closePairStep, closePairRaw, continuousOfFlat,
                actionWorldMap_tau, mapRaw_bot]

theorem closeSynchronizationLayer_natural
    {source target : World}
    (injection : source ⟶ target)
    (left right :
      OmegaScottPower
        (ActionRepresentation processCpoModel source)) :
    mapRaw (actionWorldMap processCpoModel injection)
        (closeSynchronizationLayer source left right) =
      closeSynchronizationLayer target
        (mapRaw (actionWorldMap processCpoModel injection) left)
        (mapRaw (actionWorldMap processCpoModel injection) right) := by
  unfold closeSynchronizationLayer
  rw [← flattenRaw_mapRaw_natural]
  rw [mapRaw_comp]
  have kernel :
      (map (actionWorldMap processCpoModel injection)).comp
          (closePairStep source) =
        (closePairStep target).comp
          (FMSCpoOmegaScottStrength.productMap
            (actionWorldMap processCpoModel injection)
            (actionWorldMap processCpoModel injection)) := by
    apply ContinuousHom.ext
    intro pair
    exact closePairStep_natural
      injection pair.1 pair.2
  rw [kernel, ← mapRaw_comp]
  rw [PowerdomainUnseparated.fubiniRaw_natural]

theorem totalParallelLayerFrom_natural
    {source target : World}
    (injection : source ⟶ target)
    (left right : SupportedProc source 0)
    (leftLayer rightLayer :
      OmegaScottPower
        (ActionRepresentation processCpoModel source)) :
    mapRaw (actionWorldMap processCpoModel injection)
        (totalParallelLayerFrom source left right
          leftLayer rightLayer) =
      totalParallelLayerFrom target
        (SupportedProc.renameFree (homToFun injection) left)
        (SupportedProc.renameFree (homToFun injection) right)
        (mapRaw (actionWorldMap processCpoModel injection)
          leftLayer)
        (mapRaw (actionWorldMap processCpoModel injection)
          rightLayer) := by
  unfold totalParallelLayerFrom
  rw [mapRaw_sup, parallelLayerFrom_natural,
    closeSynchronizationLayer_natural]

/-! ## Equivariance of the reused Table-4 restriction kernel -/

theorem successorMap_as_extendFree
    {source target : World}
    (injection : source ⟶ target) :
    homToFun (successorMap injection) =
      ScopedName.extendFree (homToFun injection) := by
  funext name
  cases name using Fin.lastCases with
  | cast old =>
      rw [ScopedName.extendFree_castSucc]
      exact Injection.succ_castSucc
        (asInjection injection) old
  | last =>
      rw [ScopedName.extendFree_last]
      exact Injection.succ_last
        (asInjection injection)

theorem restrictLast_natural
    {source target : World}
    (injection : source ⟶ target)
    (process : SupportedProc (source + 1) 0) :
    SupportedProc.restrictLast
        (SupportedProc.renameFree
          (homToFun (successorMap injection)) process) =
      SupportedProc.renameFree
        (homToFun injection)
        (SupportedProc.restrictLast process) := by
  rw [successorMap_as_extendFree injection]
  exact SupportedProc.restrictLast_renameFree
    (homToFun injection) process

theorem mapNameTag_successor_castSucc_total
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin source) :
    mapNameTag (successorMap injection)
        (nameTag (Fin.castSucc name)) =
      nameTag
        (Fin.castSucc (homToFun injection name)) := by
  apply congrArg nameTag
  exact Injection.succ_castSucc
    (asInjection injection) name

theorem mapNameTag_successor_last_total
    {source target : World}
    (injection : source ⟶ target) :
    mapNameTag (successorMap injection)
        (nameTag (Fin.last source)) =
      nameTag (Fin.last target) := by
  apply congrArg nameTag
  exact Injection.succ_last
    (asInjection injection)

theorem swapThenRestrictContinuation_natural
    {source target : World}
    (injection : source ⟶ target)
    (process : SupportedProc ((source + 1) + 1) 0) :
    swapThenRestrictContinuation target
        (SupportedProc.renameFree
          (homToFun
            (successorMap (successorMap injection)))
          process) =
      SupportedProc.renameFree
        (homToFun (successorMap injection))
        (swapThenRestrictContinuation source process) := by
  unfold swapThenRestrictContinuation
  change
    SupportedProc.restrictLast
        (SupportedProc.renameFree
          (homToFun (lastTwoSwap target))
          (SupportedProc.renameFree
            (homToFun
              (successorMap (successorMap injection)))
            process)) =
      SupportedProc.renameFree
        (homToFun (successorMap injection))
        (SupportedProc.restrictLast
          (SupportedProc.renameFree
            (homToFun (lastTwoSwap source))
            process))
  rw [SupportedProc.renameFree_comp]
  rw [← restrictLast_natural (successorMap injection)]
  apply congrArg SupportedProc.restrictLast
  rw [SupportedProc.renameFree_comp]
  apply congrArg
    (fun rename => SupportedProc.renameFree rename process)
  exact congrArg homToFun
    (lastTwoSwap_natural injection)

private theorem restriction_input_extension_old
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = name)
    (old : Fin (source + 1)) :
    homToFun
        (lastTwoSwap source ≫
          successorMap
            (extendByName injection name outside))
        (Fin.castSucc old) =
      homToFun (successorMap injection) old := by
  cases old using Fin.lastCases with
  | cast old =>
      change
        homToFun
            (successorMap
              (extendByName injection name outside))
            (homToFun (lastTwoSwap source)
              (Fin.castSucc (Fin.castSucc old))) =
          homToFun (successorMap injection)
            (Fin.castSucc old)
      rw [lastTwoSwap_old]
      change
        Injection.succ
            (asInjection
              (extendByName injection name outside))
            (Fin.castSucc (Fin.castSucc old)) =
          Injection.succ (asInjection injection)
            (Fin.castSucc old)
      rw [Injection.succ_castSucc,
        Injection.succ_castSucc]
      exact congrArg Fin.castSucc
        (extendByName_castSucc
          injection name outside old)
  | last =>
      change
        homToFun
            (successorMap
              (extendByName injection name outside))
            (homToFun (lastTwoSwap source)
              (penultimateFresh source)) =
          homToFun (successorMap injection)
            (Fin.last source)
      rw [lastTwoSwap_penultimate]
      change
        Injection.succ
            (asInjection
              (extendByName injection name outside))
            (Fin.last (source + 1)) =
          Injection.succ (asInjection injection)
            (Fin.last source)
      rw [Injection.succ_last, Injection.succ_last]

private theorem restriction_input_extension_fresh
    {source target : World}
    (injection : source ⟶ target)
    (name : Fin target)
    (outside :
      ¬ ∃ old : Fin source,
        homToFun injection old = name) :
    homToFun
        (lastTwoSwap source ≫
          successorMap
            (extendByName injection name outside))
        (Fin.last (source + 1)) =
      Fin.castSucc name := by
  change
    homToFun
        (successorMap
          (extendByName injection name outside))
        (homToFun (lastTwoSwap source)
          (ultimateFresh source)) =
      Fin.castSucc name
  rw [lastTwoSwap_ultimate]
  change
    Injection.succ
        (asInjection
          (extendByName injection name outside))
        (Fin.castSucc (Fin.last source)) =
      Fin.castSucc name
  rw [Injection.succ_castSucc]
  exact congrArg Fin.castSucc
    (extendByName_last injection name outside)

theorem restrictKnownContinuation_natural
    {source target : World}
    (injection : source ⟶ target)
    (known :
      Fin (source + 1) →
        processCpoModel.obj (source + 1))
    (fresh :
      processCpoModel.obj ((source + 1) + 1)) :
    (fun name =>
      restrictLastContinuation target
        (inputKnownTransport processCpoModel
          (successorMap injection) known fresh
          (Fin.castSucc name))) =
      inputKnownTransport processCpoModel injection
        (fun old =>
          restrictLastContinuation source
            (known (Fin.castSucc old)))
        (swapThenRestrictContinuation source fresh) := by
  funext name
  by_cases inImage :
      ∃ old : Fin source,
        homToFun injection old = name
  · obtain ⟨old, maps⟩ := inImage
    subst name
    have successorMaps :
        homToFun (successorMap injection)
            (Fin.castSucc old) =
          Fin.castSucc (homToFun injection old) :=
      Injection.succ_castSucc
        (asInjection injection) old
    rw [← successorMaps]
    rw [inputKnownTransport_old processCpoModel
      (successorMap injection) known fresh
      (Fin.castSucc old)]
    rw [inputKnownTransport_old processCpoModel
      injection
      (fun old =>
        restrictLastContinuation source
          (known (Fin.castSucc old)))
      (swapThenRestrictContinuation source fresh)
      old]
    unfold restrictLastContinuation
    change
      SupportedProc.restrictLast
          (SupportedProc.renameFree
            (homToFun (successorMap injection))
            (known (Fin.castSucc old))) =
        SupportedProc.renameFree
          (homToFun injection)
          (SupportedProc.restrictLast
            (known (Fin.castSucc old)))
    exact restrictLast_natural injection _
  · rw [inputKnownTransport_fresh processCpoModel
      (successorMap injection) known fresh
      (Fin.castSucc name)
      (lastTwoSwap source ≫
        successorMap
          (extendByName injection name inImage))
      (restriction_input_extension_old
        injection name inImage)
      (restriction_input_extension_fresh
        injection name inImage)]
    rw [inputKnownTransport_fresh processCpoModel
      injection
      (fun old =>
        restrictLastContinuation source
          (known (Fin.castSucc old)))
      (swapThenRestrictContinuation source fresh)
      name
      (extendByName injection name inImage)
      (extendByName_castSucc injection name inImage)
      (extendByName_last injection name inImage)]
    unfold restrictLastContinuation
    unfold swapThenRestrictContinuation
    change
      SupportedProc.restrictLast
          (SupportedProc.renameFree
            (homToFun
              (lastTwoSwap source ≫
                successorMap
                  (extendByName injection name inImage)))
            fresh) =
        SupportedProc.renameFree
          (homToFun
            (extendByName injection name inImage))
          (SupportedProc.restrictLast
            (SupportedProc.renameFree
              (homToFun (lastTwoSwap source)) fresh))
    rw [← restrictLast_natural
      (extendByName injection name inImage)]
    apply congrArg SupportedProc.restrictLast
    calc
      SupportedProc.renameFree
          (homToFun
            (lastTwoSwap source ≫
              successorMap
                (extendByName injection name inImage)))
          fresh =
        SupportedProc.renameFree
          (homToFun
              (successorMap
                (extendByName injection name inImage)) ∘
            homToFun (lastTwoSwap source))
          fresh := by rfl
      _ =
        SupportedProc.renameFree
            (homToFun
              (successorMap
                (extendByName injection name inImage)))
          (SupportedProc.renameFree
              (homToFun (lastTwoSwap source)) fresh) :=
        (SupportedProc.renameFree_comp
          (homToFun (lastTwoSwap source))
          (homToFun
            (successorMap
              (extendByName injection name inImage)))
          fresh).symm

/--
Every one-action syntax Table-4 branch commutes with a world injection.
-/
theorem syntaxRestrictionStep_natural
    {source target : World}
    (injection : source ⟶ target)
    (action :
      ActionRepresentation processCpoModel (source + 1)) :
    syntaxRestrictionStep target
        (actionWorldMap processCpoModel
          (successorMap injection) action) =
      mapRaw (actionWorldMap processCpoModel injection)
        (syntaxRestrictionStep source action) := by
  rcases action with input | rest
  · rcases input with ⟨channel, known, fresh⟩
    cases channelName : tagName channel using Fin.lastCases with
    | cast old =>
        have channelEq :
            channel = nameTag (Fin.castSucc old) := by
          rw [← nameTag_tagName channel, channelName]
        subst channel
        rw [actionWorldMap_input,
          mapNameTag_successor_castSucc_total]
        change
          syntaxRestrictionRaw target
              (Sum.inl
                (nameTag
                    (Fin.castSucc
                      (homToFun injection old)),
                  (inputKnownTransport processCpoModel
                    (successorMap injection) known fresh,
                   processCpoModel.map
                    (successorMap (successorMap injection))
                    fresh))) =
            mapRaw (actionWorldMap processCpoModel injection)
              (syntaxRestrictionRaw source
                (Sum.inl
                  (nameTag (Fin.castSucc old),
                    (known, fresh))))
        simp only [syntaxRestrictionRaw, tagName_nameTag,
          oldName_castSucc, mapRaw_principal,
          actionWorldMap_input]
        apply congrArg principalRaw
        apply congrArg Sum.inl
        apply Prod.ext
        · rfl
        · apply Prod.ext
          · exact restrictKnownContinuation_natural
              injection known fresh
          · change
              swapThenRestrictContinuation target
                  (SupportedProc.renameFree
                    (homToFun
                      (successorMap
                        (successorMap injection)))
                    fresh) =
                SupportedProc.renameFree
                  (homToFun (successorMap injection))
                  (swapThenRestrictContinuation source fresh)
            exact swapThenRestrictContinuation_natural
              injection fresh
    | last =>
        have channelEq :
            channel = nameTag (Fin.last source) := by
          rw [← nameTag_tagName channel, channelName]
        subst channel
        rw [actionWorldMap_input,
          mapNameTag_successor_last_total]
        change
          syntaxRestrictionRaw target
              (Sum.inl
                (nameTag (Fin.last target),
                  (inputKnownTransport processCpoModel
                    (successorMap injection) known fresh,
                   processCpoModel.map
                    (successorMap (successorMap injection))
                    fresh))) =
            mapRaw (actionWorldMap processCpoModel injection)
              (syntaxRestrictionRaw source
                (Sum.inl
                  (nameTag (Fin.last source),
                    (known, fresh))))
        simp [syntaxRestrictionRaw, mapRaw_bot]
  · rcases rest with free | rest
    · rcases free with
        ⟨⟨channel, value⟩, continuation⟩
      cases channelName : tagName channel using Fin.lastCases with
      | last =>
          have channelEq :
              channel = nameTag (Fin.last source) := by
            rw [← nameTag_tagName channel, channelName]
          subst channel
          rw [actionWorldMap_freeOutput,
            mapNameTag_successor_last_total]
          change
            syntaxRestrictionRaw target
                (Sum.inr
                  (Sum.inl
                    ((nameTag (Fin.last target),
                      mapNameTag (successorMap injection) value),
                     processCpoModel.map
                      (successorMap injection) continuation))) =
              mapRaw (actionWorldMap processCpoModel injection)
                (syntaxRestrictionRaw source
                  (Sum.inr
                    (Sum.inl
                      ((nameTag (Fin.last source), value),
                       continuation))))
          simp [syntaxRestrictionRaw, mapRaw_bot]
      | cast oldChannel =>
          have channelEq :
              channel =
                nameTag (Fin.castSucc oldChannel) := by
            rw [← nameTag_tagName channel, channelName]
          subst channel
          cases valueName : tagName value using Fin.lastCases with
          | last =>
              have valueEq :
                  value = nameTag (Fin.last source) := by
                rw [← nameTag_tagName value, valueName]
              subst value
              rw [actionWorldMap_freeOutput,
                mapNameTag_successor_castSucc_total,
                mapNameTag_successor_last_total]
              change
                syntaxRestrictionRaw target
                    (Sum.inr
                      (Sum.inl
                        ((nameTag
                            (Fin.castSucc
                              (homToFun injection oldChannel)),
                          nameTag (Fin.last target)),
                         processCpoModel.map
                          (successorMap injection)
                          continuation))) =
                  mapRaw
                    (actionWorldMap processCpoModel injection)
                    (syntaxRestrictionRaw source
                      (Sum.inr
                        (Sum.inl
                          ((nameTag
                              (Fin.castSucc oldChannel),
                            nameTag (Fin.last source)),
                           continuation))))
              simp [syntaxRestrictionRaw, mapRaw_principal,
                actionWorldMap_boundOutput, mapNameTag]
          | cast oldValue =>
              have valueEq :
                  value =
                    nameTag (Fin.castSucc oldValue) := by
                rw [← nameTag_tagName value, valueName]
              subst value
              rw [actionWorldMap_freeOutput,
                mapNameTag_successor_castSucc_total,
                mapNameTag_successor_castSucc_total]
              change
                syntaxRestrictionRaw target
                    (Sum.inr
                      (Sum.inl
                        ((nameTag
                            (Fin.castSucc
                              (homToFun injection oldChannel)),
                          nameTag
                            (Fin.castSucc
                              (homToFun injection oldValue))),
                         processCpoModel.map
                          (successorMap injection)
                          continuation))) =
                  mapRaw
                    (actionWorldMap processCpoModel injection)
                    (syntaxRestrictionRaw source
                      (Sum.inr
                        (Sum.inl
                          ((nameTag
                              (Fin.castSucc oldChannel),
                            nameTag
                              (Fin.castSucc oldValue)),
                           continuation))))
              simp only [syntaxRestrictionRaw,
                tagName_nameTag, oldName_castSucc,
                mapRaw_principal, actionWorldMap_freeOutput]
              apply congrArg principalRaw
              apply congrArg Sum.inr
              apply congrArg Sum.inl
              apply Prod.ext
              · rfl
              · change
                  SupportedProc.restrictLast
                      (SupportedProc.renameFree
                        (homToFun (successorMap injection))
                        continuation) =
                    SupportedProc.renameFree
                      (homToFun injection)
                      (SupportedProc.restrictLast continuation)
                exact restrictLast_natural injection _
    · rcases rest with bound | tau
      · rcases bound with ⟨channel, continuation⟩
        cases channelName : tagName channel using Fin.lastCases with
        | last =>
            have channelEq :
                channel = nameTag (Fin.last source) := by
              rw [← nameTag_tagName channel, channelName]
            subst channel
            rw [actionWorldMap_boundOutput,
              mapNameTag_successor_last_total]
            change
              syntaxRestrictionRaw target
                  (Sum.inr
                    (Sum.inr
                      (Sum.inl
                        (nameTag (Fin.last target),
                         processCpoModel.map
                          (successorMap
                            (successorMap injection))
                          continuation)))) =
                mapRaw
                  (actionWorldMap processCpoModel injection)
                  (syntaxRestrictionRaw source
                    (Sum.inr
                      (Sum.inr
                        (Sum.inl
                          (nameTag (Fin.last source),
                           continuation)))))
            simp [syntaxRestrictionRaw, mapRaw_bot]
        | cast oldChannel =>
            have channelEq :
                channel =
                  nameTag (Fin.castSucc oldChannel) := by
              rw [← nameTag_tagName channel, channelName]
            subst channel
            rw [actionWorldMap_boundOutput,
              mapNameTag_successor_castSucc_total]
            change
              syntaxRestrictionRaw target
                  (Sum.inr
                    (Sum.inr
                      (Sum.inl
                        (nameTag
                          (Fin.castSucc
                            (homToFun injection oldChannel)),
                         processCpoModel.map
                          (successorMap
                            (successorMap injection))
                          continuation)))) =
                mapRaw
                  (actionWorldMap processCpoModel injection)
                  (syntaxRestrictionRaw source
                    (Sum.inr
                      (Sum.inr
                        (Sum.inl
                          (nameTag
                            (Fin.castSucc oldChannel),
                           continuation)))))
            simp only [syntaxRestrictionRaw,
              tagName_nameTag, oldName_castSucc,
              mapRaw_principal, actionWorldMap_boundOutput]
            apply congrArg principalRaw
            apply congrArg Sum.inr
            apply congrArg Sum.inr
            apply congrArg Sum.inl
            apply Prod.ext
            · rfl
            · change
                swapThenRestrictContinuation target
                    (SupportedProc.renameFree
                      (homToFun
                        (successorMap
                          (successorMap injection)))
                      continuation) =
                  SupportedProc.renameFree
                    (homToFun (successorMap injection))
                    (swapThenRestrictContinuation source
                      continuation)
              exact swapThenRestrictContinuation_natural
                injection continuation
      · rw [actionWorldMap_tau]
        change
          syntaxRestrictionRaw target
              (Sum.inr
                (Sum.inr
                  (Sum.inr
                    (processCpoModel.map
                      (successorMap injection) tau)))) =
            mapRaw
              (actionWorldMap processCpoModel injection)
              (syntaxRestrictionRaw source
                (Sum.inr (Sum.inr (Sum.inr tau))))
        simp only [syntaxRestrictionRaw, mapRaw_principal,
          actionWorldMap_tau]
        apply congrArg principalRaw
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        apply congrArg Sum.inr
        change
          SupportedProc.restrictLast
              (SupportedProc.renameFree
                (homToFun (successorMap injection)) tau) =
            SupportedProc.renameFree
              (homToFun injection)
              (SupportedProc.restrictLast tau)
        exact restrictLast_natural injection _

/-- Table-4 restriction of arbitrary computations is equivariant. -/
theorem restrictionLayerFrom_natural
    {source target : World}
    (injection : source ⟶ target)
    (layer :
      OmegaScottPower
        (ActionRepresentation processCpoModel (source + 1))) :
    mapRaw (actionWorldMap processCpoModel injection)
        (restrictionLayerFrom source layer) =
      restrictionLayerFrom target
        (mapRaw
          (actionWorldMap processCpoModel
            (successorMap injection))
          layer) := by
  unfold restrictionLayerFrom restrictionLayer
  rw [← flattenRaw_mapRaw_natural]
  rw [mapRaw_comp]
  have square :
      (map (actionWorldMap processCpoModel injection)).comp
          (syntaxRestrictionStep source) =
        (syntaxRestrictionStep target).comp
          (actionWorldMap processCpoModel
            (successorMap injection)) := by
    apply ContinuousHom.ext
    intro action
    exact (syntaxRestrictionStep_natural
      injection action).symm
  rw [square, ← mapRaw_comp]

/-! ## Naturality of the total fuel recursion -/

theorem totalSupportedLayerFuel_natural
    (fuel : Nat) :
    ∀ {source target : World}
      (injection : source ⟶ target)
      (process : SupportedProc source 0),
      mapRaw (actionWorldMap processCpoModel injection)
          (totalSupportedLayerFuel fuel source process) =
        totalSupportedLayerFuel fuel target
          (SupportedProc.renameFree
            (homToFun injection) process) := by
  induction fuel with
  | zero =>
      intro source target injection process
      simp [totalSupportedLayerFuel, mapRaw_bot]
  | succ fuel ih =>
      intro source target injection process
      cases process with
      | zero =>
          simp [totalSupportedLayerFuel, mapRaw_bot,
            SupportedProc.renameFree]
      | tau next =>
          simpa [totalSupportedLayerFuel,
            supportedHeadLayer,
            SupportedProc.renameFree] using
            supportedHeadLayer_natural
              injection (.tau next)
      | input channel body =>
          simpa [totalSupportedLayerFuel,
            supportedHeadLayer,
            SupportedProc.renameFree] using
            supportedHeadLayer_natural
              injection (.input channel body)
      | output channel value next =>
          simpa [totalSupportedLayerFuel,
            supportedHeadLayer,
            SupportedProc.renameFree] using
            supportedHeadLayer_natural
              injection (.output channel value next)
      | choice left right =>
          rw [totalSupportedLayerFuel, mapRaw_sup,
            ih injection left, ih injection right]
          rfl
      | parallel left right =>
          rw [totalSupportedLayerFuel]
          rw [totalParallelLayerFrom_natural]
          rw [ih injection left, ih injection right]
          rfl
      | restrict body =>
          rw [totalSupportedLayerFuel]
          rw [restrictionLayerFrom_natural]
          rw [ih (successorMap injection)
            (SupportedProc.freshenOuter body)]
          rw [renameFree_freshenOuter_successor]
          rfl
      | matchEq left right next =>
          simp only [SupportedProc.renameFree,
            totalSupportedLayerFuel, closedName_renameFree]
          by_cases equal :
              closedName left = closedName right
          · have mappedEqual :
                homToFun injection (closedName left) =
                  homToFun injection (closedName right) :=
              congrArg (homToFun injection) equal
            rw [if_pos equal, if_pos mappedEqual,
              ih injection next]
          · have mappedDistinct :
                homToFun injection (closedName left) ≠
                  homToFun injection (closedName right) :=
              fun mapped =>
                equal ((asInjection injection).injective mapped)
            rw [if_neg equal, if_neg mappedDistinct]
            exact mapRaw_bot _
      | matchNe left right next =>
          simp only [SupportedProc.renameFree,
            totalSupportedLayerFuel, closedName_renameFree]
          by_cases distinct :
              closedName left ≠ closedName right
          · have mappedDistinct :
                homToFun injection (closedName left) ≠
                  homToFun injection (closedName right) :=
              fun mapped =>
                distinct
                  ((asInjection injection).injective mapped)
            rw [if_pos distinct, if_pos mappedDistinct,
              ih injection next]
          · have equal :
                closedName left = closedName right :=
              not_ne_iff.mp distinct
            have mappedEqual :
                homToFun injection (closedName left) =
                  homToFun injection (closedName right) :=
              congrArg (homToFun injection) equal
            have notMappedDistinct :
                ¬ homToFun injection (closedName left) ≠
                    homToFun injection (closedName right) :=
              fun mappedDistinct => mappedDistinct mappedEqual
            rw [if_neg distinct, if_neg notMappedDistinct]
            exact mapRaw_bot _

/-- The exact-height total layer is a natural finite-world operation. -/
theorem totalSupportedLayer_natural
    {source target : World}
    (injection : source ⟶ target)
    (process : SupportedProc source 0) :
    mapRaw (actionWorldMap processCpoModel injection)
        (totalSupportedLayer source process) =
      totalSupportedLayer target
        (SupportedProc.renameFree
          (homToFun injection) process) := by
  unfold totalSupportedLayer
  rw [processHeight_renameFree]
  exact totalSupportedLayerFuel_natural
    (processHeight process) injection process

/-! ## Coalgebra and terminal denotation -/

/-- The total continuous-natural one-step map on supported syntax. -/
def totalSupportedOneStep :
    processCpoModel ⟶
      ActualAgentFunctor.obj processCpoModel where
  app world :=
    EqualityOrder.continuousTo
      (totalSupportedLayer world)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro process
    exact
      (totalSupportedLayer_natural
        injection process).symm

/-- Total finite-control syntax as a coalgebra of the actual FMS functor. -/
def totalSupportedCoalgebra :
    Coalgebra ActualAgentFunctor where
  V := processCpoModel
  str := totalSupportedOneStep

/-- The terminal-coalgebra denotation of the total operational coalgebra. -/
def totalSupportedDenote :
    processCpoModel ⟶ Agent :=
  (concreteCoalgebraToTerminal
    totalSupportedCoalgebra).f

/-- The total denotation is a coalgebra morphism. -/
theorem totalSupportedDenote_unroll :
    totalSupportedOneStep ≫
        ActualAgentFunctor.map totalSupportedDenote =
      totalSupportedDenote ≫ agentUnfold :=
  (concreteCoalgebraToTerminal
    totalSupportedCoalgebra).h

/-- Pointwise unfold equation for every finite-control process. -/
theorem totalSupportedDenote_unroll_at
    (world : World)
    (process : SupportedProc world 0) :
    agentUnfold.app world
        (totalSupportedDenote.app world process) =
      mapRaw
        (actionModelMapComponent
          totalSupportedDenote world)
        (totalSupportedLayer world process) := by
  have square :=
    congrArg
      (fun transformation =>
        transformation.app world)
      totalSupportedDenote_unroll
  change
    agentUnfold.app world
        (totalSupportedDenote.app world process) =
      (ActualAgentFunctor.map
        totalSupportedDenote).app world
          (totalSupportedLayer world process)
  exact
    (ContinuousHom.congr_fun square process).symm

/-- Terminality gives uniqueness of the total supported denotation. -/
theorem totalSupportedDenote_unique
    (candidate : processCpoModel ⟶ Agent)
    (commutes :
      totalSupportedOneStep ≫
          ActualAgentFunctor.map candidate =
        candidate ≫ agentUnfold) :
    candidate = totalSupportedDenote := by
  let hom :
      totalSupportedCoalgebra ⟶
        concreteActualCoalgebra :=
    { f := candidate
      h := commutes }
  have unique :=
    concreteCoalgebraToTerminal_unique
      totalSupportedCoalgebra hom
  exact congrArg Coalgebra.Hom.f unique

/-! ## Constructor and canonical operational equations -/

@[simp]
theorem totalSupportedLayer_zero
    (world : World) :
    totalSupportedLayer world
        (SupportedProc.zero : SupportedProc world 0) =
      ⊥ := by
  rfl

@[simp]
theorem totalSupportedLayer_tau
    (world : World)
    (next : SupportedProc world 0) :
    totalSupportedLayer world (.tau next) =
      principalRaw (syntaxTauAction world next) := by
  rfl

@[simp]
theorem totalSupportedLayer_input
    (world : World)
    (channel : ScopedName world 0)
    (body : SupportedProc world 1) :
    totalSupportedLayer world (.input channel body) =
      principalRaw
        (syntaxInputAction world
          (closedName channel) body) := by
  rfl

@[simp]
theorem totalSupportedLayer_output
    (world : World)
    (channel value : ScopedName world 0)
    (next : SupportedProc world 0) :
    totalSupportedLayer world
        (.output channel value next) =
      principalRaw
        (syntaxFreeOutputAction world
          (closedName channel) (closedName value) next) := by
  rfl

theorem totalSupportedLayer_choice
    (world : World)
    (left right : SupportedProc world 0) :
    totalSupportedLayer world (.choice left right) =
      totalSupportedLayerFuel
          (max (processHeight left) (processHeight right))
          world left ⊔
        totalSupportedLayerFuel
          (max (processHeight left) (processHeight right))
          world right := by
  rfl

theorem totalSupportedLayer_parallel
    (world : World)
    (left right : SupportedProc world 0) :
    totalSupportedLayer world (.parallel left right) =
      totalParallelLayerFrom world left right
        (totalSupportedLayerFuel
          (max (processHeight left) (processHeight right))
          world left)
        (totalSupportedLayerFuel
          (max (processHeight left) (processHeight right))
          world right) := by
  rfl

theorem totalSupportedLayer_restrict
    (world : World)
    (body : SupportedProc world 1) :
    totalSupportedLayer world (.restrict body) =
      restrictionLayerFrom world
        (totalSupportedLayerFuel
          (processHeight body) (world + 1)
          (SupportedProc.freshenOuter body)) := by
  rfl

@[simp]
theorem totalSupportedDenote_zero_unfold
    (world : World) :
    agentUnfold.app world
        (totalSupportedDenote.app world
          (SupportedProc.zero :
            SupportedProc world 0)) =
      (⊥ : OmegaScottPower
        (ActionRepresentation Agent world)) := by
  rw [totalSupportedDenote_unroll_at,
    totalSupportedLayer_zero]
  exact mapRaw_bot _

@[simp]
theorem totalSupportedDenote_tau_unfold
    (world : World)
    (next : SupportedProc world 0) :
    agentUnfold.app world
        (totalSupportedDenote.app world (.tau next)) =
      principalRaw
        (tauAction world
          (totalSupportedDenote.app world next)) := by
  rw [totalSupportedDenote_unroll_at,
    totalSupportedLayer_tau, mapRaw_principal]
  simp only [syntaxTauAction, actionModelMap_tau]
  rfl

@[simp]
theorem totalSupportedDenote_output_unfold
    (world : World)
    (channel value : ScopedName world 0)
    (next : SupportedProc world 0) :
    agentUnfold.app world
        (totalSupportedDenote.app world
          (.output channel value next)) =
      principalRaw
        (Sum.inr
          (Sum.inl
            ((nameTag (closedName channel),
              nameTag (closedName value)),
             totalSupportedDenote.app world next))) := by
  rw [totalSupportedDenote_unroll_at,
    totalSupportedLayer_output, mapRaw_principal]
  simp only [syntaxFreeOutputAction,
    actionModelMap_freeOutput]
  rfl

@[simp]
theorem totalSupportedDenote_input_unfold
    (world : World)
    (channel : ScopedName world 0)
    (body : SupportedProc world 1) :
    agentUnfold.app world
        (totalSupportedDenote.app world
          (.input channel body)) =
      principalRaw
        (Sum.inl
          (nameTag (closedName channel),
            (fun received =>
              totalSupportedDenote.app world
                (SupportedProc.instantiateOuter
                  received body),
             totalSupportedDenote.app (world + 1)
                (SupportedProc.freshenOuter body)))) := by
  rw [totalSupportedDenote_unroll_at,
    totalSupportedLayer_input, mapRaw_principal]
  simp only [syntaxInputAction, actionModelMap_input]
  rfl

theorem closeSynchronization_principal_input_boundOutput
    (world : World)
    (channel : NameTag world)
    (known : Fin world → processCpoModel.obj world)
    (fresh next : processCpoModel.obj (world + 1)) :
    closeSynchronizationLayer world
        (principalRaw
          (Sum.inl (channel, (known, fresh))))
        (principalRaw
          (Sum.inr (Sum.inr
            (Sum.inl (channel, next))))) =
      principalRaw
        (syntaxTauAction world
          (SupportedProc.restrictLast
            (.parallel fresh next))) := by
  unfold closeSynchronizationLayer
  rw [PowerdomainUnseparated.fubiniRaw_principal,
    mapRaw_principal, flattenRaw_principal]
  simp [closePairStep_input_boundOutput]

theorem closeSynchronization_principal_boundOutput_input
    (world : World)
    (channel : NameTag world)
    (next : processCpoModel.obj (world + 1))
    (known : Fin world → processCpoModel.obj world)
    (fresh : processCpoModel.obj (world + 1)) :
    closeSynchronizationLayer world
        (principalRaw
          (Sum.inr (Sum.inr
            (Sum.inl (channel, next)))))
        (principalRaw
          (Sum.inl (channel, (known, fresh)))) =
      principalRaw
        (syntaxTauAction world
          (SupportedProc.restrictLast
            (.parallel next fresh))) := by
  unfold closeSynchronizationLayer
  rw [PowerdomainUnseparated.fubiniRaw_principal,
    mapRaw_principal, flattenRaw_principal]
  simp [closePairStep_boundOutput_input]

/-- Canonical restriction extrusion is present in the total layer. -/
theorem totalSupportedLayer_restriction_extrusion
    (world : World)
    (channel : Fin world)
    (next : SupportedProc world 1) :
    totalSupportedLayer world
        (.restrict
          (.output
            (.free channel)
            (.bound (Fin.last 0))
            next)) =
      principalRaw
        (syntaxBoundOutputAction world channel
          (SupportedProc.freshenOuter next)) := by
  rw [totalSupportedLayer_restrict]
  rw [freshenOuter_output_bound]
  change
    restrictionLayerFrom world
        (principalRaw
          (syntaxFreeOutputAction (world + 1)
            (Fin.castSucc channel)
            (Fin.last world)
            (SupportedProc.freshenOuter next))) =
      _
  unfold restrictionLayerFrom
  exact restriction_principal_extrusion
    world channel (SupportedProc.freshenOuter next)

/--
The extrusion representative has both its total-layer bound output and its
genuine late-pi native step.
-/
theorem total_restriction_extrusion_native
    (world : World)
    (channel : Fin world)
    (next : SupportedProc world 1) :
    totalSupportedLayer world
        (.restrict
          (.output
            (.free channel)
            (.bound (Fin.last 0))
            next)) =
        principalRaw
          (syntaxBoundOutputAction world channel
            (SupportedProc.freshenOuter next)) ∧
      Late.NativeStep
        (SupportedProc.reifyAtWorld
          (.restrict
            (.output
              (.free channel)
              (.bound (Fin.last 0))
              next)))
        (.boundOutput channel.val world)
        (inputReificationTarget world next) := by
  exact
    ⟨totalSupportedLayer_restriction_extrusion
      world channel next,
     boundOutput_reification_native world channel next⟩

end Cantilune.Pi.FMSCpoSupportedTotalOperationalCoalgebra
