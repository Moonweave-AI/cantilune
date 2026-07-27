import Cantilune.Core.DPO
import Cantilune.Core.Execution
import Cantilune.Pi.Late
import Cantilune.Pi.P1cClosedNativeCertificate
import Mathlib.Data.Fintype.EquivFin

/-!
# Non-circular admitted operations for the critical P1c rules

This module gives mismatch, reconnect, and quiescent deletion a shared
operational occurrence.  The occurrence is not an event-indexed
`ready → completed` fixture:

* its target configuration is computed from its source and request;
* its DAG footprint is a pair of enabled finite-support DPO updates;
* its Petri transition is enabled and its firing is proved equal to the
  marking of the computed target;
* its morphism view is the same deterministic configuration update;
* its π view is an independently derived native standard-late step; and
* its `DPOEvent` replay kernel decodes the endpoint-free recipe, rechecks
  admissibility against the supplied source, and recomputes the target.

The graph layer is the executable finite-support DPO fragment over
`Config.nodes` and `Config.edges`.  It is not a replacement for the typed
presheaf DPOI construction: `Config` does not contain ordered hyperedge
incidence or open-boundary maps.
-/

noncomputable section

namespace Cantilune.Pi.P1cAdmittedOperations

open Cantilune.Core

variable {σ : FinSignature}

/-- The three critical operations, with runtime parameters but no proof fields. -/
inductive Request where
  | mismatch (left right : Name)
  | reconnect (source target : Nat)
  | quiescentDelete (victim : Nat)
  deriving DecidableEq, Repr

/-- Edges incident to a node; deletion removes all of them explicitly. -/
def incidentEdges (config : Config σ) (node : Nat) : Finset (Nat × Nat) :=
  config.edges.filter fun edge => edge.1 = node ∨ edge.2 = node

/-- The deterministic configuration update denoted by one request. -/
def applyRequest (config : Config σ) : Request → Config σ
  | .mismatch _ _ =>
      { config with policyState := config.policyState + 1 }
  | .reconnect source target =>
      { config with edges := insert (source, target) config.edges }
  | .quiescentDelete victim =>
      { config with
        nodes := config.nodes.erase victim
        edges := config.edges \ incidentEdges config victim
        nodeLabel := fun node =>
          if node = victim then none else config.nodeLabel node
        tombstones := insert victim config.tombstones }

/-! ## Graph admission and finite-support DPO footprints -/

/-- A non-empty directed path in a runtime configuration. -/
inductive GraphPath (config : Config σ) : Nat → Nat → Prop where
  | single {source target}
      (edge : (source, target) ∈ config.edges) :
      GraphPath config source target
  | snoc {source middle target}
      (path : GraphPath config source middle)
      (edge : (middle, target) ∈ config.edges) :
      GraphPath config source target

/-- The selected DAG view admits only acyclic source and target graphs. -/
def Acyclic (config : Config σ) : Prop :=
  ∀ node, ¬GraphPath config node node

theorem GraphPath.rank_lt {config : Config σ} {rank : Nat → Nat}
    (ranked :
      ∀ edge ∈ config.edges, rank edge.1 < rank edge.2)
    {source target : Nat} (path : GraphPath config source target) :
    rank source < rank target := by
  induction path with
  | single edge =>
      exact ranked _ edge
  | snoc path edge inductionHypothesis =>
      exact Nat.lt_trans inductionHypothesis (ranked _ edge)

/--
A concrete topological ranking proves acyclicity.  This is useful both for
admission checkers and for non-empty reconnect regression examples.
-/
theorem acyclic_of_rank {config : Config σ} {rank : Nat → Nat}
    (ranked :
      ∀ edge ∈ config.edges, rank edge.1 < rank edge.2) :
    Acyclic config := by
  intro node path
  exact (GraphPath.rank_lt ranked path).false

theorem acyclic_of_edges_empty {config : Config σ}
    (emptyEdges : config.edges = ∅) :
    Acyclic config := by
  apply acyclic_of_rank (rank := fun _ => 0)
  intro edge member
  rw [emptyEdges] at member
  simp at member

/-- Request-specific executable preconditions. -/
def Request.Enabled (config : Config σ) : Request → Prop
  | .mismatch left right => left ≠ right
  | .reconnect source target =>
      source ∈ config.nodes ∧
        target ∈ config.nodes ∧
        (source, target) ∉ config.edges
  | .quiescentDelete victim =>
      victim ∈ config.nodes ∧
        (∀ token ∈ config.dataTokens,
          config.dataOwner token ≠ some victim) ∧
        (∀ token ∈ config.resourceTokens,
          config.resourceOwner token ≠ some victim) ∧
        ∀ name ∈ config.names,
          config.sessionOwner name ≠ some victim

instance (config : Config σ) (request : Request) :
    Decidable (request.Enabled config) := by
  cases request <;> simp only [Request.Enabled] <;> infer_instance

/--
Admission is a checkable semantic predicate over the source and computed
target.  In particular, well-formedness and acyclicity are propositions about
the actual configurations rather than fields of a target transition system.
-/
def Admissible (config : Config σ) (request : Request) : Prop :=
  config.WellFormed ∧
    Acyclic config ∧
    request.Enabled config ∧
    (applyRequest config request).WellFormed ∧
    Acyclic (applyRequest config request) ∧
    config.OwnershipWellFormed

/-- One admitted occurrence with its uniquely computed endpoint. -/
structure Occurrence (σ : FinSignature) where
  source : Config σ
  request : Request
  admitted : Admissible source request

namespace Occurrence

def target (occurrence : Occurrence σ) : Config σ :=
  applyRequest occurrence.source occurrence.request

theorem source_wellFormed (occurrence : Occurrence σ) :
    occurrence.source.WellFormed :=
  occurrence.admitted.1

theorem target_wellFormed (occurrence : Occurrence σ) :
    occurrence.target.WellFormed :=
  occurrence.admitted.2.2.2.1

theorem request_enabled (occurrence : Occurrence σ) :
    occurrence.request.Enabled occurrence.source :=
  occurrence.admitted.2.2.1

theorem source_ownershipWellFormed (occurrence : Occurrence σ) :
    occurrence.source.OwnershipWellFormed :=
  occurrence.admitted.2.2.2.2.2

theorem target_acyclic (occurrence : Occurrence σ) :
    Acyclic occurrence.target :=
  occurrence.admitted.2.2.2.2.1

end Occurrence

/--
Deleting a node that owns no live token, resource, or session preserves
ownership well-formedness.  Reconnect and mismatch preserve it definitionally.
-/
theorem ownershipWellFormed_applyRequest
    {config : Config σ} {request : Request}
    (ownership : config.OwnershipWellFormed)
    (enabled : request.Enabled config) :
    (applyRequest config request).OwnershipWellFormed := by
  cases request with
  | mismatch left right =>
      exact ownership
  | reconnect source target =>
      exact ownership
  | quiescentDelete victim =>
      rcases ownership with ⟨dataOwnership, resourceOwnership,
        sessionOwnership⟩
      rcases enabled with ⟨_victimMember, dataQuiescent,
        resourceQuiescent, sessionQuiescent⟩
      constructor
      · intro token tokenMember
        obtain ⟨owner, ownerEq, ownerMember⟩ :=
          dataOwnership token tokenMember
        refine ⟨owner, ownerEq, ?_⟩
        simp only [applyRequest, Finset.mem_erase]
        exact
          ⟨fun ownerEqVictim =>
              dataQuiescent token tokenMember
                (ownerEq.trans (congrArg some ownerEqVictim)),
            ownerMember⟩
      · constructor
        · intro token tokenMember
          obtain ⟨owner, ownerEq, ownerMember⟩ :=
            resourceOwnership token tokenMember
          refine ⟨owner, ownerEq, ?_⟩
          simp only [applyRequest, Finset.mem_erase]
          exact
            ⟨fun ownerEqVictim =>
                resourceQuiescent token tokenMember
                  (ownerEq.trans (congrArg some ownerEqVictim)),
              ownerMember⟩
        · intro name nameMember
          obtain ⟨owner, ownerEq, ownerMember⟩ :=
            sessionOwnership name nameMember
          refine ⟨owner, ownerEq, ?_⟩
          simp only [applyRequest, Finset.mem_erase]
          exact
            ⟨fun ownerEqVictim =>
                sessionQuiescent name nameMember
                  (ownerEq.trans (congrArg some ownerEqVictim)),
              ownerMember⟩

theorem Occurrence.target_ownershipWellFormed
    (occurrence : Occurrence σ) :
    occurrence.target.OwnershipWellFormed :=
  ownershipWellFormed_applyRequest occurrence.source_ownershipWellFormed
    occurrence.request_enabled

/-- Node-carrier part of the DPO update. -/
def nodeRewrite (request : Request) : DPO.FiniteSupportEvent Nat where
  erase :=
    match request with
    | .quiescentDelete victim => {victim}
    | _ => ∅
  insert := ∅
  internallyDisjoint := by
    cases request <;> simp

/-- Edge-carrier part of the DPO update. -/
def edgeRewrite (config : Config σ) (request : Request) :
    DPO.FiniteSupportEvent (Nat × Nat) where
  erase :=
    match request with
    | .quiescentDelete victim => incidentEdges config victim
    | _ => ∅
  insert :=
    match request with
    | .reconnect source target => {(source, target)}
    | _ => ∅
  internallyDisjoint := by
    cases request <;> simp

namespace DAG

/--
The native DAG/DPO step predicate.  Every field is a property of the concrete
finite-support events and computed endpoint; no source-event image relation
appears in the definition.
-/
structure Step (source : Config σ) (request : Request)
    (target : Config σ) : Prop where
  nodeEnabled : (nodeRewrite request).Enabled source.nodes
  edgeEnabled : (edgeRewrite source request).Enabled source.edges
  nodeResult : (nodeRewrite request).apply source.nodes = target.nodes
  edgeResult : (edgeRewrite source request).apply source.edges = target.edges
  sourceAcyclic : Acyclic source
  targetAcyclic : Acyclic target

theorem ofOccurrence (occurrence : Occurrence σ) :
    Step occurrence.source occurrence.request occurrence.target := by
  rcases occurrence with ⟨source, request, admitted⟩
  cases request with
  | mismatch left right =>
      refine
        { nodeEnabled := by
            change (∅ : Finset Nat) ⊆ source.nodes
            exact Finset.empty_subset _
          edgeEnabled := by
            change (∅ : Finset (Nat × Nat)) ⊆ source.edges
            exact Finset.empty_subset _
          nodeResult := by
            change (source.nodes \ ∅) ∪ ∅ = source.nodes
            simp
          edgeResult := by
            change (source.edges \ ∅) ∪ ∅ = source.edges
            simp
          sourceAcyclic := admitted.2.1
          targetAcyclic := admitted.2.2.2.2.1 }
  | reconnect reconnectSource reconnectTarget =>
      refine
        { nodeEnabled := by
            change (∅ : Finset Nat) ⊆ source.nodes
            exact Finset.empty_subset _
          edgeEnabled := by
            change (∅ : Finset (Nat × Nat)) ⊆ source.edges
            exact Finset.empty_subset _
          nodeResult := by
            change (source.nodes \ ∅) ∪ ∅ = source.nodes
            simp
          edgeResult := by
            change
              (source.edges \ ∅) ∪ {(reconnectSource, reconnectTarget)} =
                insert (reconnectSource, reconnectTarget) source.edges
            ext edge
            simp [or_comm]
          sourceAcyclic := admitted.2.1
          targetAcyclic := admitted.2.2.2.2.1 }
  | quiescentDelete victim =>
      refine
        { nodeEnabled := by
            change {victim} ⊆ source.nodes
            exact Finset.singleton_subset_iff.mpr admitted.2.2.1.1
          edgeEnabled := by
            change incidentEdges source victim ⊆ source.edges
            intro edge member
            exact (Finset.mem_filter.mp member).1
          nodeResult := by
            change (source.nodes \ {victim}) ∪ ∅ = source.nodes.erase victim
            simp [Finset.sdiff_singleton_eq_erase]
          edgeResult := by
            change
              (source.edges \ incidentEdges source victim) ∪ ∅ =
                source.edges \ incidentEdges source victim
            simp
          sourceAcyclic := admitted.2.1
          targetAcyclic := admitted.2.2.2.2.1 }

end DAG

/-! ## Petri enabling and firing -/

namespace Petri

/-- Tokens expose the actual configuration footprint in the Petri marking. -/
inductive Token where
  | node (name : Nat)
  | edge (source target : Nat)
  | data (identity : Nat)
  | resource (identity : Nat)
  | policy (state : Nat)
  deriving DecidableEq, Repr

def marking (config : Config σ) : Finset Token :=
  (config.nodes.image Token.node) ∪
    (config.edges.image fun edge => Token.edge edge.1 edge.2) ∪
    (config.dataTokens.image Token.data) ∪
    (config.resourceTokens.image Token.resource) ∪
    {Token.policy config.policyState}

/--
The transition consumes exactly the tokens absent from the computed target
and produces exactly the newly present tokens.  Since the target is already a
deterministic request application, this is an executable incidence
translation rather than a separately asserted adequacy relation.
-/
def transition (source : Config σ) (request : Request) :
    DPO.FiniteSupportEvent Token where
  erase := marking source \ marking (applyRequest source request)
  insert := marking (applyRequest source request) \ marking source
  internallyDisjoint := by
    rw [Finset.disjoint_left]
    intro token erased inserted
    exact (Finset.mem_sdiff.mp inserted).2
      (Finset.mem_sdiff.mp erased).1

def Enabled (source : Finset Token)
    (transition : DPO.FiniteSupportEvent Token) : Prop :=
  transition.Enabled source

def fire (source : Finset Token)
    (transition : DPO.FiniteSupportEvent Token) : Finset Token :=
  transition.apply source

theorem transition_enabled (source : Config σ) (request : Request) :
    Enabled (marking source) (transition source request) := by
  intro token member
  exact (Finset.mem_sdiff.mp member).1

theorem fire_transition (source : Config σ) (request : Request) :
    fire (marking source) (transition source request) =
      marking (applyRequest source request) := by
  ext token
  simp only [fire, transition, DPO.FiniteSupportEvent.apply,
    Finset.mem_union, Finset.mem_sdiff]
  by_cases sourceMember : token ∈ marking source
  · by_cases targetMember : token ∈ marking (applyRequest source request) <;>
      simp [sourceMember, targetMember]
  · by_cases targetMember : token ∈ marking (applyRequest source request) <;>
      simp [sourceMember, targetMember]

/-- A native Petri firing is defined by enabling plus the firing equation. -/
def Step (source : Config σ) (request : Request) (target : Config σ) : Prop :=
  Enabled (marking source) (transition source request) ∧
    fire (marking source) (transition source request) = marking target

theorem ofOccurrence (occurrence : Occurrence σ) :
    Step occurrence.source occurrence.request occurrence.target :=
  ⟨transition_enabled _ _, fire_transition _ _⟩

end Petri

/-! ## Morphism and standard-late π views -/

namespace Morphism

/-- The total morphism view is the deterministic configuration transformer. -/
def Step (source : Config σ) (request : Request) (target : Config σ) : Prop :=
  applyRequest source request = target

theorem ofOccurrence (occurrence : Occurrence σ) :
    Step occurrence.source occurrence.request occurrence.target :=
  rfl

end Morphism

namespace PiView

/-!
The operational request keeps its runtime channel/value pair in the replay
recipe and, downstream, in the enriched registry metadata.  The raw π view
uses the fixed closed nominal representative of the normative reconnect
family.  This is intentional: the hidden delegation bus and delegated name
are α-local implementation names, while the product occurrence identity is
carried by the replay/event metadata rather than by exposing either name.
-/

def source : Request → Raw.Proc
  | .mismatch left right => .matchNe left right (.tau .zero)
  | .reconnect _ _ =>
      P1cClosedNativeCertificate.closedReconnectSource.erase
  | .quiescentDelete channel =>
      .par
        (.send channel channel .zero)
        (.recv channel (channel + 1) .zero)

def target : Request → Raw.Proc
  | .mismatch _ _ => .zero
  | .reconnect _ _ =>
      P1cClosedNativeCertificate.closedReconnectTarget.erase
  | .quiescentDelete _ => .par .zero .zero

/--
Every admitted request has one native standard-late transition.  This proof
uses the independently defined `Late.NativeStep` rules directly.
-/
theorem native (occurrence : Occurrence σ) :
    Late.NativeStep
      (source occurrence.request)
      .tau
      (target occurrence.request) := by
  cases requestShape : occurrence.request with
  | mismatch left right =>
      apply Late.NativeStep.mismatchGuard
      · simpa [Request.Enabled, requestShape] using
          occurrence.request_enabled
      · exact Late.NativeStep.prefixTau
  | reconnect channel value =>
      exact P1cClosedNativeCertificate.closed_reconnect_native
  | quiescentDelete channel =>
      apply Late.NativeStep.syncLeft
        Late.NativeStep.prefixOutput Late.NativeStep.prefixInput
      simp [Raw.Proc.freeNames]

theorem strongLate (occurrence : Occurrence σ) :
    Late.Step
      (source occurrence.request)
      .tau
      (target occurrence.request) :=
  Late.Step.native (native occurrence)

end PiView

/-! ## Endpoint-free replay -/

def Request.ruleId : Request → Nat
  | .mismatch _ _ => 40
  | .reconnect _ _ => 41
  | .quiescentDelete _ => 42

def Request.evidence : Request → List Nat
  | .mismatch left right => [left, right]
  | .reconnect source target => [source, target]
  | .quiescentDelete victim => [victim]

def decodeRequest (recipe : DPOEvent.ReplayRecipe σ) : Option Request :=
  match recipe.ruleId, recipe.externalEvidence with
  | 40, [left, right] => some (.mismatch left right)
  | 41, [source, target] => some (.reconnect source target)
  | 42, [victim] => some (.quiescentDelete victim)
  | _, _ => none

/-- Finite support selected as the concrete node match of a request. -/
def matchNodes (source : Config σ) : Request → Finset Nat
  | .mismatch _ _ => ∅
  | .reconnect left right => {left, right}
  | .quiescentDelete _ => source.nodes

theorem matchNodes_subset_of_enabled {source : Config σ} {request : Request}
    (enabled : request.Enabled source) :
    matchNodes source request ⊆ source.nodes := by
  cases requestShape : request with
  | mismatch left right =>
      simp [matchNodes]
  | reconnect left right =>
      simp only [matchNodes, Finset.insert_subset_iff,
        Finset.singleton_subset_iff]
      rw [requestShape] at enabled
      rcases enabled with ⟨leftMember, rightMember, _⟩
      exact ⟨leftMember, rightMember⟩
  | quiescentDelete victim =>
      simp [matchNodes]

theorem matchNodes_subset (occurrence : Occurrence σ) :
    matchNodes occurrence.source occurrence.request ⊆
      occurrence.source.nodes :=
  matchNodes_subset_of_enabled occurrence.request_enabled

/-- Canonical finite ordinal embedding induced by a finite-set inclusion. -/
def finsetEmbedding {left right : Finset Nat} (subset : left ⊆ right) :
    Fin left.card ↪ Fin right.card :=
  left.equivFin.symm.toEmbedding |>.trans
    ({ toFun := fun value : left => ⟨value.1, subset value.2⟩
       inj' := by
         intro first second equality
         apply Subtype.ext
         exact congrArg (fun value : right => value.1) equality } :
      left ↪ right) |>.trans
    right.equivFin.toEmbedding

/-- Proof-irrelevant executable fingerprint of a finite ordinal embedding. -/
def embeddingValues {domain codomain : Nat}
    (embedding : Fin domain ↪ Fin codomain) : List Nat :=
  List.ofFn fun index => (embedding index).val

/--
All endpoint-free recipe fields that can affect this finite-support replay are
validated.  Comparing `embeddingValues` also prevents accepting a recipe with
the right cardinalities but a different concrete match monomorphism.
-/
def recipeConsistent (recipe : DPOEvent.ReplayRecipe σ)
    (source : Config σ) (request : Request)
    (enabled : request.Enabled source) : Prop :=
  recipe.signatureVersion = source.signatureVersion ∧
  recipe.ruleId = request.ruleId ∧
  recipe.matchDomainSize = (matchNodes source request).card ∧
  recipe.matchCodomainSize = source.nodes.card ∧
  recipe.complementTag = request.ruleId ∧
  recipe.freshNames = ∅ ∧
  recipe.policyEvidence = [source.policyState] ∧
  recipe.externalEvidence = request.evidence ∧
  recipe.kind = .external ∧
  embeddingValues recipe.matchEmbedding =
    embeddingValues
      (finsetEmbedding (matchNodes_subset_of_enabled enabled))

instance (recipe : DPOEvent.ReplayRecipe σ) (source : Config σ)
    (request : Request) (enabled : request.Enabled source) :
    Decidable (recipeConsistent recipe source request enabled) := by
  unfold recipeConsistent
  infer_instance

/--
Replay decodes the request, rechecks its executable operational precondition
and the complete recipe fingerprint on the claimed source, and only then
computes the endpoint.  Well-formedness and acyclicity remain proof-level
invariants of `Occurrence`: unlike the finite request/recipe checks, they are
not decidable executable checks on an arbitrary function-valued `Config`.
-/
def replayKernel : DPOEvent.ReplayKernel σ where
  run := fun recipe source =>
    match decodeRequest recipe with
    | none => none
    | some request =>
        if enabled : request.Enabled source then
          if recipeConsistent recipe source request enabled then
            some (applyRequest source request)
          else none
        else none

/-- A replayable complete event derived from one admitted occurrence. -/
def event (occurrence : Occurrence σ) : DPOEvent σ where
  signatureVersion := occurrence.source.signatureVersion
  ruleId := occurrence.request.ruleId
  source := occurrence.source
  target := occurrence.target
  matchDomainSize := (matchNodes occurrence.source occurrence.request).card
  matchCodomainSize := occurrence.source.nodes.card
  matchEmbedding := finsetEmbedding (matchNodes_subset occurrence)
  complementTag := occurrence.request.ruleId
  freshNames := ∅
  policyEvidence := [occurrence.source.policyState]
  externalEvidence := occurrence.request.evidence
  kind := .external
  sourceVersion := rfl
  targetVersion := by
    change
      (applyRequest occurrence.source occurrence.request).signatureVersion =
        occurrence.source.signatureVersion
    cases occurrence.request <;> rfl
  freshForSource := by simp
  sourceWellFormed := occurrence.source_wellFormed
  targetWellFormed := occurrence.target_wellFormed

theorem event_recipe_decodes (occurrence : Occurrence σ) :
    decodeRequest (event occurrence).replayRecipe =
      some occurrence.request := by
  rcases occurrence with ⟨source, request, admitted⟩
  cases request <;> rfl

theorem event_recipe_consistent (occurrence : Occurrence σ) :
    recipeConsistent (event occurrence).replayRecipe occurrence.source
      occurrence.request occurrence.request_enabled := by
  simp [recipeConsistent, event, DPOEvent.replayRecipe]

/--
The recorded target is recomputed by the replay kernel from the recipe and
source; it is not projected from the event record.
-/
def verifiedEvent (occurrence : Occurrence σ) :
    DPOEvent.Verified (replayKernel (σ := σ)) where
  event := event occurrence
  replay_correct := by
    change
      (match decodeRequest (event occurrence).replayRecipe with
      | none => none
      | some request =>
          if enabled : request.Enabled occurrence.source then
            if recipeConsistent (event occurrence).replayRecipe
                occurrence.source request enabled then
              some (applyRequest occurrence.source request)
            else none
          else none) =
        some occurrence.target
    rw [event_recipe_decodes occurrence]
    change
      (if occurrence.request.Enabled occurrence.source then
          if recipeConsistent (event occurrence).replayRecipe
              occurrence.source occurrence.request
              occurrence.request_enabled then
            some (applyRequest occurrence.source occurrence.request)
          else none
        else none) =
        some occurrence.target
    rw [if_pos occurrence.request_enabled]
    rw [if_pos (event_recipe_consistent occurrence)]
    rfl

theorem replay_exact (occurrence : Occurrence σ) :
    (verifiedEvent occurrence).Replays occurrence.source occurrence.target :=
  (verifiedEvent occurrence).replays_recorded

/-- The four operational views and replay are derived from one occurrence. -/
structure CommonDerivation (occurrence : Occurrence σ) : Prop where
  dag :
    DAG.Step occurrence.source occurrence.request occurrence.target
  petri :
    Petri.Step occurrence.source occurrence.request occurrence.target
  piNative :
    Late.NativeStep
      (PiView.source occurrence.request) .tau
        (PiView.target occurrence.request)
  pi :
    Late.Step
      (PiView.source occurrence.request) .tau
        (PiView.target occurrence.request)
  morphism :
    Morphism.Step occurrence.source occurrence.request occurrence.target
  replay :
    (verifiedEvent occurrence).Replays occurrence.source occurrence.target

theorem commonDerivation (occurrence : Occurrence σ) :
    CommonDerivation occurrence where
  dag := DAG.ofOccurrence occurrence
  petri := Petri.ofOccurrence occurrence
  piNative := PiView.native occurrence
  pi := PiView.strongLate occurrence
  morphism := Morphism.ofOccurrence occurrence
  replay := replay_exact occurrence

end Cantilune.Pi.P1cAdmittedOperations
