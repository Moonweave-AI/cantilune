import Cantilune.Core.DPO
import Cantilune.Core.EpochSeparatedProjection
import Cantilune.Projection.SCCCondensation
import Cantilune.Theorems.ProductRuleProofBundle

/-!
# Non-vacuous semantic certificates for the DAG and Petri P1a views

An ordinary `ProjectionOccurrenceEvidence` proves that a selected source
occurrence has a native target step, complete reflection, and replay.  By
itself, however, it does not say that a target called "DAG" is the canonical
graph view of the source configuration, or that a target called "Petri"
uses an ordered declaration registry and individual provenance tokens.

This module adds those two semantic obligations without allowing a product to
supply an unrelated graph or marking:

* the dependency graph is computed directly from the replayed `DPOEvent`
  endpoints;
* the total DAG is the canonical SCC condensation, so every source edge is
  either internal to one SCC or occurs in the condensation;
* the Petri marking is computed directly from every finite runtime component
  of a `Config`;
* the selected transition is the canonical endpoint difference; and
* the selected pre-net declaration is tied to the same replayed event's
  signature version and rule id.

The certificates are occurrence-level.  A product conformance package should
index both of them by its single selected `Candidate`; it must not existentially
choose a different occurrence for either view.
-/

noncomputable section

namespace Cantilune.Projection.P1aSemanticCertificate

open Cantilune.Core
open Cantilune.Core.DPO
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Projection.RankableDAG
open Cantilune.Projection.SCCCondensation
open Cantilune.Theorems.ProductRuleProofBundle

/-! ## Canonical configuration dependency graph -/

/--
The directed graph carried by a runtime configuration.  The graph is not a
field of a product certificate: its vertices and edges are definitionally the
configuration's active nodes and edges.
-/
def configDependencyGraph {σ : FinSignature}
    (config : Config σ) (wellFormed : config.WellFormed) :
    FiniteDirectedGraph Nat where
  nodes := config.nodes
  edges := config.edges
  endpoints := wellFormed.2

@[simp] theorem configDependencyGraph_nodes
    {σ : FinSignature} (config : Config σ)
    (wellFormed : config.WellFormed) :
    (configDependencyGraph config wellFormed).nodes = config.nodes :=
  rfl

@[simp] theorem configDependencyGraph_edges
    {σ : FinSignature} (config : Config σ)
    (wellFormed : config.WellFormed) :
    (configDependencyGraph config wellFormed).edges = config.edges :=
  rfl

/--
Proof witnesses for well-formedness cannot alter the canonical graph.
-/
theorem configDependencyGraph_proof_irrel
    {σ : FinSignature} (config : Config σ)
    (left right : config.WellFormed) :
    configDependencyGraph config left =
      configDependencyGraph config right := by
  have equal : left = right := Subsingleton.elim _ _
  cases equal
  rfl

/-! ## DAG semantic certificate -/

/--
The DAG target must realize the same source occurrence and expose exactly the
same endpoint configurations.  No graph-valued field is accepted: all graph
and SCC objects below are computed from the source event record.
-/
structure DAGSemanticCertificate
    {σ : FinSignature}
    (source dag : ExecutionPackage σ)
    (projection : ProjectionCertificate source.lts dag.lts)
    (candidate : Candidate source) : Prop where
  sourceOccurrence : SourceOccurrenceEvidence source candidate
  occurrence :
    ProjectionOccurrenceEvidence source dag projection candidate
  eventRecordExact :
    (dag.eventRecord
      (projection.mapEvent candidate.event)).event =
      (source.eventRecord candidate.event).event
  beforeConfig :
    dag.configOf (projection.mapState candidate.before) =
      source.configOf candidate.before
  afterConfig :
    dag.configOf (projection.mapState candidate.after) =
      source.configOf candidate.after

namespace DAGSemanticCertificate

variable
    {σ : FinSignature}
    {source dag : ExecutionPackage σ}
    {projection : ProjectionCertificate source.lts dag.lts}
    {candidate : Candidate source}
    (certificate :
      DAGSemanticCertificate source dag projection candidate)

/-- The complete source event selected by this certificate. -/
abbrev selectedEvent
    (_certificate :
      DAGSemanticCertificate source dag projection candidate) :
    DPOEvent σ :=
  (source.eventRecord candidate.event).event

/-- The source package's before configuration is the recorded DPO source. -/
theorem source_before_eq_event_source :
    source.configOf candidate.before = certificate.selectedEvent.source :=
  certificate.sourceOccurrence.replay.1

/-- The source package's after configuration is the recorded DPO target. -/
theorem source_after_eq_event_target :
    source.configOf candidate.after = certificate.selectedEvent.target := by
  have replay := certificate.sourceOccurrence.replay
  rw [certificate.source_before_eq_event_source] at replay
  exact DPOEvent.replay_recovers_recorded_target replay

/-- The DAG target before state denotes exactly the recorded DPO source. -/
theorem dag_before_eq_event_source :
    dag.configOf (projection.mapState candidate.before) =
      certificate.selectedEvent.source :=
  certificate.beforeConfig.trans certificate.source_before_eq_event_source

/-- The DAG target after state denotes exactly the recorded DPO target. -/
theorem dag_after_eq_event_target :
    dag.configOf (projection.mapState candidate.after) =
      certificate.selectedEvent.target :=
  certificate.afterConfig.trans certificate.source_after_eq_event_target

/--
The mapped DAG step carries the complete source DPO record, including the
endpoint-free replay recipe, match embedding, fresh-name evidence, policy and
external metadata, and event kind.
-/
theorem dag_event_record_exact :
    (dag.eventRecord
      (projection.mapEvent candidate.event)).event =
      certificate.selectedEvent :=
  certificate.eventRecordExact

/-- Endpoint-free deterministic replay input is literally unchanged. -/
theorem dag_replay_recipe_exact :
    (dag.eventRecord
      (projection.mapEvent candidate.event)).event.replayRecipe =
      certificate.selectedEvent.replayRecipe :=
  congrArg DPOEvent.replayRecipe certificate.eventRecordExact

/-- Canonical dependency graph before the selected event. -/
def beforeGraph : FiniteDirectedGraph Nat :=
  configDependencyGraph certificate.selectedEvent.source
    certificate.selectedEvent.sourceWellFormed

/-- Canonical dependency graph after the selected event. -/
def afterGraph : FiniteDirectedGraph Nat :=
  configDependencyGraph certificate.selectedEvent.target
    certificate.selectedEvent.targetWellFormed

@[simp] theorem beforeGraph_nodes :
    certificate.beforeGraph.nodes =
      certificate.selectedEvent.source.nodes :=
  rfl

@[simp] theorem beforeGraph_edges :
    certificate.beforeGraph.edges =
      certificate.selectedEvent.source.edges :=
  rfl

@[simp] theorem afterGraph_nodes :
    certificate.afterGraph.nodes =
      certificate.selectedEvent.target.nodes :=
  rfl

@[simp] theorem afterGraph_edges :
    certificate.afterGraph.edges =
      certificate.selectedEvent.target.edges :=
  rfl

/-- Total canonical DAG before the event. -/
noncomputable def beforeCondensation :
    StrictGraph certificate.beforeGraph.SCC :=
  certificate.beforeGraph.condensation

/-- Total canonical DAG after the event. -/
noncomputable def afterCondensation :
    StrictGraph certificate.afterGraph.SCC :=
  certificate.afterGraph.condensation

theorem beforeCondensation_acyclic
    (component : certificate.beforeGraph.SCC) :
    ¬ Path certificate.beforeCondensation component component :=
  certificate.beforeGraph.condensation_acyclic component

theorem afterCondensation_acyclic
    (component : certificate.afterGraph.SCC) :
    ¬ Path certificate.afterCondensation component component :=
  certificate.afterGraph.condensation_acyclic component

/--
No before-edge is silently removed: it is internal to one SCC or represented
by a canonical condensation edge.
-/
theorem before_edge_internal_or_condensed
    (edge : {edge // edge ∈ certificate.beforeGraph.edges}) :
    certificate.beforeGraph.component
          (certificate.beforeGraph.sourceActive edge) =
        certificate.beforeGraph.component
          (certificate.beforeGraph.targetActive edge) ∨
      (certificate.beforeGraph.component
          (certificate.beforeGraph.sourceActive edge),
        certificate.beforeGraph.component
          (certificate.beforeGraph.targetActive edge)) ∈
        certificate.beforeGraph.condensationEdges :=
  certificate.beforeGraph.original_edge_internal_or_condensed edge

/--
No after-edge is silently removed: it is internal to one SCC or represented
by a canonical condensation edge.
-/
theorem after_edge_internal_or_condensed
    (edge : {edge // edge ∈ certificate.afterGraph.edges}) :
    certificate.afterGraph.component
          (certificate.afterGraph.sourceActive edge) =
        certificate.afterGraph.component
          (certificate.afterGraph.targetActive edge) ∨
      (certificate.afterGraph.component
          (certificate.afterGraph.sourceActive edge),
        certificate.afterGraph.component
          (certificate.afterGraph.targetActive edge)) ∈
        certificate.afterGraph.condensationEdges :=
  certificate.afterGraph.original_edge_internal_or_condensed edge

/-- Every canonical before-condensation edge strictly increases its rank. -/
theorem before_condensation_edge_rank_strict
    {left right : certificate.beforeGraph.SCC}
    (edge :
      (left, right) ∈ certificate.beforeCondensation.edges) :
    certificate.beforeCondensation.rank left <
      certificate.beforeCondensation.rank right :=
  certificate.beforeCondensation.rank_strict (left, right) edge

/-- Every canonical after-condensation edge strictly increases its rank. -/
theorem after_condensation_edge_rank_strict
    {left right : certificate.afterGraph.SCC}
    (edge :
      (left, right) ∈ certificate.afterCondensation.edges) :
    certificate.afterCondensation.rank left <
      certificate.afterCondensation.rank right :=
  certificate.afterCondensation.rank_strict (left, right) edge

end DAGSemanticCertificate

/-! ## Generic ordered pre-net -/

/-- A declaration is permanently identified by signature version and rule id. -/
structure PetriRuleDeclaration where
  signatureVersion : Nat
  ruleId : Nat
  ordinal : Nat
  deriving DecidableEq, Repr

/--
A declaration-order pre-net.  Old declarations cannot be conflated because
their `(signatureVersion, ruleId)` keys are unique, and list order carries a
strictly increasing ordinal.
-/
structure OrderedPreNet (Transition : Type*) where
  declarations : List PetriRuleDeclaration
  uniqueRuleKeys :
    (declarations.map fun declaration =>
      (declaration.signatureVersion, declaration.ruleId)).Nodup
  strictDeclarationOrder :
    declarations.Pairwise fun left right => left.ordinal < right.ordinal
  /--
  Every declared stable rule has a concrete transition incidence.  The
  membership index prevents transitions from being attached to undeclared
  keys.
  -/
  transitionOf :
    (declaration : PetriRuleDeclaration) →
      declaration ∈ declarations → Transition

namespace OrderedPreNet

/-- At most one declaration has a given stable version/rule key. -/
theorem declaration_unique
    {Transition : Type*}
    (net : OrderedPreNet Transition)
    {left right : PetriRuleDeclaration}
    (leftMember : left ∈ net.declarations)
    (rightMember : right ∈ net.declarations)
    (sameVersion : left.signatureVersion = right.signatureVersion)
    (sameRule : left.ruleId = right.ruleId) :
    left = right := by
  exact
    List.inj_on_of_nodup_map net.uniqueRuleKeys
      leftMember rightMember
      (Prod.ext sameVersion sameRule)

end OrderedPreNet

/-- A one-declaration pre-net with an explicitly supplied real incidence. -/
def singletonDeclarationNet {Transition : Type*}
    (declaration : PetriRuleDeclaration) (transition : Transition) :
    OrderedPreNet Transition where
  declarations := [declaration]
  uniqueRuleKeys := by simp
  strictDeclarationOrder := by simp
  transitionOf := by
    intro selected declared
    have exactDeclaration : selected = declaration := by
      simpa using declared
    subst selected
    exact transition

/--
Append one declaration to an existing ordered pre-net while reindexing every
old incidence into the new transition carrier.  The two structural proof
arguments make the declaration-key and ordinal obligations explicit rather
than hiding them behind a Boolean admission test.
-/
def appendReindexedPreNet
    {OldTransition NewTransition : Type*}
    (reindex : OldTransition → NewTransition)
    (oldNet : OrderedPreNet OldTransition)
    (newDeclaration : PetriRuleDeclaration)
    (newTransition : NewTransition)
    (uniqueRuleKeys :
      ((oldNet.declarations ++ [newDeclaration]).map fun declaration =>
        (declaration.signatureVersion, declaration.ruleId)).Nodup)
    (strictDeclarationOrder :
      (oldNet.declarations ++ [newDeclaration]).Pairwise
        fun left right => left.ordinal < right.ordinal) :
    OrderedPreNet NewTransition where
  declarations := oldNet.declarations ++ [newDeclaration]
  uniqueRuleKeys := uniqueRuleKeys
  strictDeclarationOrder := strictDeclarationOrder
  transitionOf := by
    intro declaration _declared
    by_cases oldDeclared : declaration ∈ oldNet.declarations
    · exact reindex (oldNet.transitionOf declaration oldDeclared)
    · exact newTransition

@[simp]
theorem appendReindexedPreNet_old_transition
    {OldTransition NewTransition : Type*}
    (reindex : OldTransition → NewTransition)
    (oldNet : OrderedPreNet OldTransition)
    (newDeclaration : PetriRuleDeclaration)
    (newTransition : NewTransition)
    (uniqueRuleKeys strictDeclarationOrder)
    (declaration : PetriRuleDeclaration)
    (oldDeclared : declaration ∈ oldNet.declarations) :
    (appendReindexedPreNet reindex oldNet newDeclaration newTransition
      uniqueRuleKeys strictDeclarationOrder).transitionOf
        declaration
        (by
          simp only [appendReindexedPreNet, List.mem_append,
            List.mem_singleton]
          exact Or.inl oldDeclared) =
      reindex (oldNet.transitionOf declaration oldDeclared) := by
  simp [appendReindexedPreNet, oldDeclared]

@[simp]
theorem appendReindexedPreNet_new_transition
    {OldTransition NewTransition : Type*}
    (reindex : OldTransition → NewTransition)
    (oldNet : OrderedPreNet OldTransition)
    (newDeclaration : PetriRuleDeclaration)
    (newTransition : NewTransition)
    (uniqueRuleKeys strictDeclarationOrder)
    (newIsFresh : newDeclaration ∉ oldNet.declarations) :
    (appendReindexedPreNet reindex oldNet newDeclaration newTransition
      uniqueRuleKeys strictDeclarationOrder).transitionOf
        newDeclaration
        (by simp [appendReindexedPreNet]) =
      newTransition := by
  simp [appendReindexedPreNet, newIsFresh]

/-- Canonical declaration carried by one replayable DPO event. -/
def declarationOfEvent {σ : FinSignature}
    (event : DPOEvent σ) (ordinal : Nat := 0) :
    PetriRuleDeclaration where
  signatureVersion := event.signatureVersion
  ruleId := event.ruleId
  ordinal := ordinal

/-- The smallest declaration-order pre-net admitting one selected event. -/
def singletonEventNet {σ : FinSignature} {Transition : Type*}
    (event : DPOEvent σ) (transition : Transition) :
    OrderedPreNet Transition :=
  singletonDeclarationNet (declarationOfEvent event) transition

@[simp]
theorem declarationOfEvent_mem_singletonEventNet
    {σ : FinSignature} {Transition : Type*}
    (event : DPOEvent σ) (transition : Transition) :
    declarationOfEvent event ∈
      (singletonEventNet event transition).declarations := by
  simp [singletonEventNet, singletonDeclarationNet]

@[simp]
theorem singletonEventNet_transitionOf
    {σ : FinSignature} {Transition : Type*}
    (event : DPOEvent σ) (transition : Transition) :
    (singletonEventNet event transition).transitionOf
        (declarationOfEvent event)
        (declarationOfEvent_mem_singletonEventNet event transition) =
      transition := by
  rfl

@[simp]
theorem declarationOfEvent_signatureVersion
    {σ : FinSignature} (event : DPOEvent σ) :
    (declarationOfEvent event).signatureVersion =
      event.signatureVersion :=
  rfl

@[simp]
theorem declarationOfEvent_ruleId
    {σ : FinSignature} (event : DPOEvent σ) :
    (declarationOfEvent event).ruleId = event.ruleId :=
  rfl

/-! ## Canonical individual-token Petri semantics -/

/--
Finite provenance atoms of a runtime configuration.  The constructors retain
stable token identities, owner links, observation positions, and tombstones;
they do not collapse a marking to token counts.
-/
inductive ProvenanceToken (σ : FinSignature) where
  | signatureVersion (version : Nat)
  | node (identity : Nat)
  | edge (source target : Nat)
  | nodeLabel (node : Nat) (generator : σ.Gen)
  | data (identity : Nat)
  | dataOwner (identity owner : Nat)
  | resource (identity : Nat)
  | resourceOwner (identity owner : Nat)
  | name (identity : Nat)
  | sessionOwner (identity owner : Nat)
  | observation (ordinal value : Nat)
  | policy (state : Nat)
  | tombstone (identity : Nat)
  deriving DecidableEq

/-- Turn an optional owner/label into zero or one provenance atom. -/
def optionalAtom {α : Type*} [DecidableEq α]
    (value : Option α) : Finset α :=
  match value with
  | none => ∅
  | some atom => {atom}

/--
Canonical individual-token marking of every finite, operationally relevant
component of a configuration.  Owner functions and node labels are observed
only on their finite live domains.
-/
def provenanceMarking {σ : FinSignature}
    (config : Config σ) : Finset (ProvenanceToken σ) :=
  {ProvenanceToken.signatureVersion config.signatureVersion} ∪
    config.nodes.image ProvenanceToken.node ∪
    (config.edges.image fun edge =>
      ProvenanceToken.edge edge.1 edge.2) ∪
    (config.nodes.biUnion fun node =>
      optionalAtom
        (config.nodeLabel node |>.map
          (ProvenanceToken.nodeLabel node))) ∪
    config.dataTokens.image ProvenanceToken.data ∪
    (config.dataTokens.biUnion fun identity =>
      optionalAtom
        (config.dataOwner identity |>.map
          (ProvenanceToken.dataOwner identity))) ∪
    config.resourceTokens.image ProvenanceToken.resource ∪
    (config.resourceTokens.biUnion fun identity =>
      optionalAtom
        (config.resourceOwner identity |>.map
          (ProvenanceToken.resourceOwner identity))) ∪
    config.names.image ProvenanceToken.name ∪
    (config.names.biUnion fun identity =>
      optionalAtom
        (config.sessionOwner identity |>.map
          (ProvenanceToken.sessionOwner identity))) ∪
    (config.externalObservations.zipIdx.toFinset.image fun observation =>
      ProvenanceToken.observation observation.2 observation.1) ∪
    {ProvenanceToken.policy config.policyState} ∪
    config.tombstones.image ProvenanceToken.tombstone

/--
Canonical Petri transition between two replay endpoints: consume exactly
atoms absent from the target and produce exactly atoms absent from the source.
-/
def endpointDelta {σ : FinSignature}
    (source target : Config σ) :
    DPO.FiniteSupportEvent (ProvenanceToken σ) where
  erase := provenanceMarking source \ provenanceMarking target
  insert := provenanceMarking target \ provenanceMarking source
  internallyDisjoint := by
    rw [Finset.disjoint_left]
    intro token erased inserted
    exact (Finset.mem_sdiff.mp inserted).2
      (Finset.mem_sdiff.mp erased).1

theorem endpointDelta_enabled {σ : FinSignature}
    (source target : Config σ) :
    (endpointDelta source target).Enabled (provenanceMarking source) := by
  intro token member
  exact (Finset.mem_sdiff.mp member).1

/-- The canonical endpoint delta fires to exactly the target marking. -/
theorem endpointDelta_apply {σ : FinSignature}
    (source target : Config σ) :
    (endpointDelta source target).apply (provenanceMarking source) =
      provenanceMarking target := by
  ext token
  simp only [endpointDelta, DPO.FiniteSupportEvent.apply,
    Finset.mem_union, Finset.mem_sdiff]
  by_cases sourceMember : token ∈ provenanceMarking source
  · by_cases targetMember : token ∈ provenanceMarking target <;>
      simp [sourceMember, targetMember]
  · by_cases targetMember : token ∈ provenanceMarking target <;>
      simp [sourceMember, targetMember]

/-- A retained atom is never consumed. -/
theorem retained_not_erased {σ : FinSignature}
    {source target : Config σ} {token : ProvenanceToken σ}
    (sourceMember : token ∈ provenanceMarking source)
    (targetMember : token ∈ provenanceMarking target) :
    token ∉ (endpointDelta source target).erase := by
  simp [endpointDelta, sourceMember, targetMember]

/-- A retained atom is never spuriously re-created. -/
theorem retained_not_inserted {σ : FinSignature}
    {source target : Config σ} {token : ProvenanceToken σ}
    (sourceMember : token ∈ provenanceMarking source)
    (targetMember : token ∈ provenanceMarking target) :
    token ∉ (endpointDelta source target).insert := by
  simp [endpointDelta, sourceMember, targetMember]

/--
A retained individual token survives the firing as the same provenance atom.
-/
theorem retained_identity {σ : FinSignature}
    {source target : Config σ} {token : ProvenanceToken σ}
    (sourceMember : token ∈ provenanceMarking source)
    (targetMember : token ∈ provenanceMarking target) :
    token ∈
      (endpointDelta source target).apply (provenanceMarking source) := by
  rw [endpointDelta_apply]
  exact targetMember

/-! ## Cross-epoch reindexing of Petri incidence -/

/-- The empty incidence, used only as a genuine retained legacy rule witness. -/
def emptyFiniteSupportEvent {α : Type*} [DecidableEq α] :
    DPO.FiniteSupportEvent α where
  erase := ∅
  insert := ∅
  internallyDisjoint := by simp

/--
Reindex a provenance atom along the same append-only signature extension used
by the heterogeneous admission.  Stable runtime identities are unchanged;
only generator-typed node-label atoms move to the target signature.
-/
def reindexProvenanceToken
    {oldSignature newSignature : FinSignature}
    (extension : SignatureExtension oldSignature newSignature) :
    ProvenanceToken oldSignature → ProvenanceToken newSignature
  | .signatureVersion version => .signatureVersion version
  | .node identity => .node identity
  | .edge source target => .edge source target
  | .nodeLabel node generator =>
      .nodeLabel node (extension.gen generator)
  | .data identity => .data identity
  | .dataOwner identity owner => .dataOwner identity owner
  | .resource identity => .resource identity
  | .resourceOwner identity owner => .resourceOwner identity owner
  | .name identity => .name identity
  | .sessionOwner identity owner => .sessionOwner identity owner
  | .observation ordinal value => .observation ordinal value
  | .policy state => .policy state
  | .tombstone identity => .tombstone identity

theorem reindexProvenanceToken_injective
    {oldSignature newSignature : FinSignature}
    (extension : SignatureExtension oldSignature newSignature) :
    Function.Injective (reindexProvenanceToken extension) := by
  intro left right equality
  cases left <;> cases right <;>
    simp_all [reindexProvenanceToken,
      Function.Injective.eq_iff extension.gen.injective]

@[simp]
theorem reindexProvenanceToken_refl
    {signature : FinSignature}
    (token : ProvenanceToken signature) :
    reindexProvenanceToken (SignatureExtension.refl signature) token =
      token := by
  cases token <;> rfl

@[simp]
theorem reindexProvenanceToken_trans
    {first second third : FinSignature}
    (left : SignatureExtension first second)
    (right : SignatureExtension second third)
    (token : ProvenanceToken first) :
    reindexProvenanceToken (SignatureExtension.trans left right) token =
      reindexProvenanceToken right
        (reindexProvenanceToken left token) := by
  cases token <;> rfl

/--
Reindex the complete erase/insert incidence of an old transition.  Injectivity
of provenance reindexing preserves internal disjointness.
-/
def reindexFiniteSupportEvent
    {oldSignature newSignature : FinSignature}
    (extension : SignatureExtension oldSignature newSignature)
    (transition :
      DPO.FiniteSupportEvent (ProvenanceToken oldSignature)) :
    DPO.FiniteSupportEvent (ProvenanceToken newSignature) where
  erase := transition.erase.image (reindexProvenanceToken extension)
  insert := transition.insert.image (reindexProvenanceToken extension)
  internallyDisjoint := by
    rw [Finset.disjoint_left]
    intro token erased inserted
    rcases Finset.mem_image.mp erased with
      ⟨oldErased, oldErasedMember, erasedEquality⟩
    rcases Finset.mem_image.mp inserted with
      ⟨oldInserted, oldInsertedMember, insertedEquality⟩
    have sameOld : oldErased = oldInserted :=
      reindexProvenanceToken_injective extension
        (erasedEquality.trans insertedEquality.symm)
    subst oldInserted
    exact
      (Finset.disjoint_left.mp transition.internallyDisjoint)
        oldErasedMember oldInsertedMember

@[simp]
theorem reindexFiniteSupportEvent_erase
    {oldSignature newSignature : FinSignature}
    (extension : SignatureExtension oldSignature newSignature)
    (transition :
      DPO.FiniteSupportEvent (ProvenanceToken oldSignature)) :
    (reindexFiniteSupportEvent extension transition).erase =
      transition.erase.image (reindexProvenanceToken extension) :=
  rfl

@[simp]
theorem reindexFiniteSupportEvent_insert
    {oldSignature newSignature : FinSignature}
    (extension : SignatureExtension oldSignature newSignature)
    (transition :
      DPO.FiniteSupportEvent (ProvenanceToken oldSignature)) :
    (reindexFiniteSupportEvent extension transition).insert =
      transition.insert.image (reindexProvenanceToken extension) :=
  rfl

@[simp]
theorem reindexFiniteSupportEvent_refl
    {signature : FinSignature}
    (transition :
      DPO.FiniteSupportEvent (ProvenanceToken signature)) :
    reindexFiniteSupportEvent
        (SignatureExtension.refl signature) transition =
      transition := by
  have tokenRefl :
      reindexProvenanceToken (SignatureExtension.refl signature) =
        id := by
    funext token
    exact reindexProvenanceToken_refl token
  cases transition with
  | mk erase insert internallyDisjoint =>
      congr 1 <;> simp [reindexFiniteSupportEvent, tokenRefl]

@[simp]
theorem reindexFiniteSupportEvent_trans
    {first second third : FinSignature}
    (left : SignatureExtension first second)
    (right : SignatureExtension second third)
    (transition :
      DPO.FiniteSupportEvent (ProvenanceToken first)) :
    reindexFiniteSupportEvent
        (SignatureExtension.trans left right) transition =
      reindexFiniteSupportEvent right
        (reindexFiniteSupportEvent left transition) := by
  have tokenTrans :
      reindexProvenanceToken (SignatureExtension.trans left right) =
        reindexProvenanceToken right ∘
          reindexProvenanceToken left := by
    funext token
    exact reindexProvenanceToken_trans left right token
  cases transition with
  | mk erase insert internallyDisjoint =>
      unfold reindexFiniteSupportEvent
      congr 1
      · change
          Finset.image
              (reindexProvenanceToken
                (SignatureExtension.trans left right)) erase =
            Finset.image (reindexProvenanceToken right)
              (Finset.image (reindexProvenanceToken left) erase)
        rw [tokenTrans, Finset.image_image]
      · change
          Finset.image
              (reindexProvenanceToken
                (SignatureExtension.trans left right)) insert =
            Finset.image (reindexProvenanceToken right)
              (Finset.image (reindexProvenanceToken left) insert)
        rw [tokenTrans, Finset.image_image]

/--
An actual append-only pre-net extension across one epoch boundary.

* the old declaration list is a literal prefix;
* every old declaration's incidence is preserved by the admission's exact
  signature reindexing;
* the selected declaration occurs in the appended suffix and not in the old
  net;
* the signature extension genuinely adds a generator;
* the selected declaration and trace tombstone use this admission's target
  version and tombstone id.
-/
structure PreNetExtension
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (oldNet :
      OrderedPreNet
        (DPO.FiniteSupportEvent (ProvenanceToken oldSignature)))
    (newNet :
      OrderedPreNet
        (DPO.FiniteSupportEvent (ProvenanceToken newSignature)))
    (selectedNewDeclaration : PetriRuleDeclaration) where
  appendedDeclarations : List PetriRuleDeclaration
  declarationsAppend :
    newNet.declarations =
      oldNet.declarations ++ appendedDeclarations
  oldDeclaredInNew :
    ∀ declaration,
      declaration ∈ oldNet.declarations →
        declaration ∈ newNet.declarations
  oldIncidencePreserved :
    ∀ declaration
      (oldDeclared : declaration ∈ oldNet.declarations),
      newNet.transitionOf declaration
          (oldDeclaredInNew declaration oldDeclared) =
        reindexFiniteSupportEvent admission.extension
          (oldNet.transitionOf declaration oldDeclared)
  selectedInAppend :
    selectedNewDeclaration ∈ appendedDeclarations
  selectedNotOld :
    selectedNewDeclaration ∉ oldNet.declarations
  extensionAddsGenerator :
    ¬Function.Surjective admission.extension.gen
  traceTombstone : Nat
  traceTombstoneExact :
    traceTombstone = admission.tombstoneId
  selectedAdmissionVersion :
    selectedNewDeclaration.signatureVersion = admission.toVersion

namespace PreNetExtension

variable
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {oldNet :
      OrderedPreNet
        (DPO.FiniteSupportEvent (ProvenanceToken oldSignature))}
    {newNet :
      OrderedPreNet
        (DPO.FiniteSupportEvent (ProvenanceToken newSignature))}
    {selectedNewDeclaration : PetriRuleDeclaration}
    (extension :
      PreNetExtension admission oldNet newNet selectedNewDeclaration)

include extension

/-- Prefix/append gives a canonical proof that every old key remains live. -/
theorem old_declaration_is_prefix
    (declaration : PetriRuleDeclaration)
    (oldDeclared : declaration ∈ oldNet.declarations) :
    declaration ∈ newNet.declarations := by
  rw [extension.declarationsAppend]
  exact List.mem_append_left _ oldDeclared

/-- The admission-selected declaration is genuinely present in the new net. -/
theorem selected_declared :
    selectedNewDeclaration ∈ newNet.declarations := by
  rw [extension.declarationsAppend]
  exact List.mem_append_right _ extension.selectedInAppend

/-- No declaration is removed or assigned an unrelated target incidence. -/
theorem old_incidence_reindexed
    (declaration : PetriRuleDeclaration)
    (oldDeclared : declaration ∈ oldNet.declarations) :
    newNet.transitionOf declaration
        (extension.oldDeclaredInNew declaration oldDeclared) =
      reindexFiniteSupportEvent admission.extension
        (oldNet.transitionOf declaration oldDeclared) :=
  extension.oldIncidencePreserved declaration oldDeclared

/-- The epoch boundary is nontrivial at the signature-generator level. -/
theorem signatures_genuinely_differ :
    ¬Function.Surjective admission.extension.gen :=
  extension.extensionAddsGenerator

end PreNetExtension

/-! ## Petri semantic certificate -/

/--
The Petri target realizes the selected occurrence at exactly the same
configurations, while an ordered pre-net declaration is tied to the selected
replayable event.  Markings, deltas, enabling, firing, and token identity are
then computed rather than supplied.
-/
structure PetriSemanticCertificate
    {σ : FinSignature}
    (source petri : ExecutionPackage σ)
    (projection : ProjectionCertificate source.lts petri.lts)
    (candidate : Candidate source) where
  sourceOccurrence : SourceOccurrenceEvidence source candidate
  occurrence :
    ProjectionOccurrenceEvidence source petri projection candidate
  eventRecordExact :
    (petri.eventRecord
      (projection.mapEvent candidate.event)).event =
      (source.eventRecord candidate.event).event
  beforeConfig :
    petri.configOf (projection.mapState candidate.before) =
      source.configOf candidate.before
  afterConfig :
    petri.configOf (projection.mapState candidate.after) =
      source.configOf candidate.after
  net : OrderedPreNet
    (DPO.FiniteSupportEvent (ProvenanceToken σ))
  selectedDeclaration : PetriRuleDeclaration
  selectedDeclared : selectedDeclaration ∈ net.declarations
  selectedVersion :
    selectedDeclaration.signatureVersion =
      (source.eventRecord candidate.event).event.signatureVersion
  selectedRule :
    selectedDeclaration.ruleId =
      (source.eventRecord candidate.event).event.ruleId
  /--
  The transition attached to the selected declaration is the canonical
  individual-token incidence of this exact replayed DPO event.  This rules
  out an unrelated caller-chosen endpoint delta.
  -/
  selectedIncidenceExact :
    net.transitionOf selectedDeclaration selectedDeclared =
      endpointDelta
        (source.eventRecord candidate.event).event.source
        (source.eventRecord candidate.event).event.target

namespace PetriSemanticCertificate

variable
    {σ : FinSignature}
    {source petri : ExecutionPackage σ}
    {projection : ProjectionCertificate source.lts petri.lts}
    {candidate : Candidate source}
    (certificate :
      PetriSemanticCertificate source petri projection candidate)

/-- The complete source event selected by this certificate. -/
abbrev selectedEvent
    (_certificate :
      PetriSemanticCertificate source petri projection candidate) :
    DPOEvent σ :=
  (source.eventRecord candidate.event).event

theorem source_before_eq_event_source :
    source.configOf candidate.before = certificate.selectedEvent.source :=
  certificate.sourceOccurrence.replay.1

theorem source_after_eq_event_target :
    source.configOf candidate.after = certificate.selectedEvent.target := by
  have replay := certificate.sourceOccurrence.replay
  rw [certificate.source_before_eq_event_source] at replay
  exact DPOEvent.replay_recovers_recorded_target replay

theorem petri_before_eq_event_source :
    petri.configOf (projection.mapState candidate.before) =
      certificate.selectedEvent.source :=
  certificate.beforeConfig.trans certificate.source_before_eq_event_source

theorem petri_after_eq_event_target :
    petri.configOf (projection.mapState candidate.after) =
      certificate.selectedEvent.target :=
  certificate.afterConfig.trans certificate.source_after_eq_event_target

/--
The mapped Petri step carries the complete source DPO event rather than only
the same rule id.
-/
theorem petri_event_record_exact :
    (petri.eventRecord
      (projection.mapEvent candidate.event)).event =
      certificate.selectedEvent :=
  certificate.eventRecordExact

/-- Endpoint-free replay input and all stable metadata are preserved. -/
theorem petri_replay_recipe_exact :
    (petri.eventRecord
      (projection.mapEvent candidate.event)).event.replayRecipe =
      certificate.selectedEvent.replayRecipe :=
  congrArg DPOEvent.replayRecipe certificate.eventRecordExact

/-- Canonical individual-token marking before the selected event. -/
def beforeMarking : Finset (ProvenanceToken σ) :=
  provenanceMarking certificate.selectedEvent.source

/-- Canonical individual-token marking after the selected event. -/
def afterMarking : Finset (ProvenanceToken σ) :=
  provenanceMarking certificate.selectedEvent.target

/--
Selected Petri transition from the actual ordered pre-net incidence.  The
certificate field `selectedIncidenceExact` ties it to the exact DPO record.
-/
def selectedTransition : DPO.FiniteSupportEvent (ProvenanceToken σ) :=
  certificate.net.transitionOf
    certificate.selectedDeclaration certificate.selectedDeclared

theorem selectedTransition_incidence_exact :
    certificate.selectedTransition =
      endpointDelta certificate.selectedEvent.source
        certificate.selectedEvent.target :=
  certificate.selectedIncidenceExact

theorem selectedTransition_enabled :
    certificate.selectedTransition.Enabled certificate.beforeMarking :=
  certificate.selectedTransition_incidence_exact ▸
    endpointDelta_enabled _ _

theorem selectedTransition_fires :
    certificate.selectedTransition.apply certificate.beforeMarking =
      certificate.afterMarking :=
  certificate.selectedTransition_incidence_exact ▸
    endpointDelta_apply _ _

/--
One theorem binds the source occurrence, mapped native Petri step, declared
incidence, enabling, and exact firing endpoint.  None of these witnesses can
refer to a different candidate.
-/
theorem selected_native_enabled_fires :
    source.lts.ObservableStep
        candidate.before candidate.event candidate.after ∧
      petri.lts.ObservableStep
        (projection.mapState candidate.before)
        (projection.mapEvent candidate.event)
        (projection.mapState candidate.after) ∧
      certificate.selectedTransition.Enabled certificate.beforeMarking ∧
      certificate.selectedTransition.apply certificate.beforeMarking =
        certificate.afterMarking :=
  ⟨certificate.sourceOccurrence.native,
    certificate.occurrence.native,
    certificate.selectedTransition_enabled,
    certificate.selectedTransition_fires⟩

/-- The selected pre-net declaration has the exact replay-event key. -/
theorem selected_declaration_key :
    (certificate.selectedDeclaration.signatureVersion,
      certificate.selectedDeclaration.ruleId) =
    (certificate.selectedEvent.signatureVersion,
      certificate.selectedEvent.ruleId) :=
  Prod.ext certificate.selectedVersion certificate.selectedRule

/--
The complete selected-occurrence closure: target metadata, declaration key,
concrete incidence, both native steps, enabling, and firing all refer to the
same source candidate and the same replayable DPO event.
-/
theorem selected_occurrence_incidence_closure :
    (petri.eventRecord
      (projection.mapEvent candidate.event)).event =
        certificate.selectedEvent ∧
      (certificate.selectedDeclaration.signatureVersion,
        certificate.selectedDeclaration.ruleId) =
        (certificate.selectedEvent.signatureVersion,
          certificate.selectedEvent.ruleId) ∧
      certificate.selectedTransition =
        endpointDelta certificate.selectedEvent.source
          certificate.selectedEvent.target ∧
      source.lts.ObservableStep
        candidate.before candidate.event candidate.after ∧
      petri.lts.ObservableStep
        (projection.mapState candidate.before)
        (projection.mapEvent candidate.event)
        (projection.mapState candidate.after) ∧
      certificate.selectedTransition.Enabled certificate.beforeMarking ∧
      certificate.selectedTransition.apply certificate.beforeMarking =
        certificate.afterMarking := by
  exact
    ⟨certificate.petri_event_record_exact,
      certificate.selected_declaration_key,
      certificate.selectedTransition_incidence_exact,
      certificate.sourceOccurrence.native,
      certificate.occurrence.native,
      certificate.selectedTransition_enabled,
      certificate.selectedTransition_fires⟩

/-- Retained individual tokens preserve their exact provenance identity. -/
theorem selectedTransition_retained_identity
    {token : ProvenanceToken σ}
    (beforeMember : token ∈ certificate.beforeMarking)
    (afterMember : token ∈ certificate.afterMarking) :
    token ∈
      certificate.selectedTransition.apply certificate.beforeMarking := by
  rw [certificate.selectedTransition_incidence_exact]
  exact retained_identity beforeMember afterMember

end PetriSemanticCertificate

/-! ## Admission-indexed reconfigurable Petri certificate -/

/--
The complete Petri certificate across one genuine signature epoch boundary.

The type mentions the exact heterogeneous source admission, exact Petri target
admission projection, endpoint projections, post-admission candidate, and its
fixed-epoch semantic certificate.  Thus a caller cannot combine a pre-net
extension from one admission with the native target occurrence of another.
-/
structure ReconfigurablePetriCertificate
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature))
    (sourceBefore : ExecutionPackage oldSignature)
    (sourceAfter : ExecutionPackage newSignature)
    (petriBefore : ExecutionPackage oldSignature)
    (petriAfter : ExecutionPackage newSignature)
    (sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter)
    (petriSemantics :
      HeterogeneousAdmissionLTS petriBefore petriAfter)
    (sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission)
    (beforeProjection :
      ProjectionCertificate sourceBefore.lts petriBefore.lts)
    (afterProjection :
      ProjectionCertificate sourceAfter.lts petriAfter.lts)
    (admissionProjection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter petriBefore petriAfter
        sourceSemantics petriSemantics admission sourceOccurrence
        beforeProjection afterProjection)
    (candidate : Candidate sourceAfter)
    (connects : sourceOccurrence.afterState = candidate.before)
    (semantic :
      PetriSemanticCertificate
        sourceAfter petriAfter afterProjection candidate) where
  oldNet :
    OrderedPreNet
      (DPO.FiniteSupportEvent (ProvenanceToken oldSignature))
  preNetExtension :
    PreNetExtension admission oldNet semantic.net
      semantic.selectedDeclaration
  targetAdmissionNative :
    petriSemantics.step
      admissionProjection.targetOccurrence.beforeState
      (petriSemantics.eventOf admission)
      admissionProjection.targetOccurrence.afterState
  targetAdmissionReplays :
    AdmissionReplays admission
      (petriBefore.configOf
        admissionProjection.targetOccurrence.beforeState)
      (petriAfter.configOf
        admissionProjection.targetOccurrence.afterState)
  targetAfterIsSelectedSource :
    admissionProjection.targetOccurrence.afterState =
      afterProjection.mapState candidate.before

namespace ReconfigurablePetriCertificate

variable
    {universes : ProjectionUniverses}
    {oldSignature newSignature : FinSignature}
    {admission :
      SignatureAdmissionEvent universes
        (source := oldSignature) (target := newSignature)}
    {sourceBefore : ExecutionPackage oldSignature}
    {sourceAfter : ExecutionPackage newSignature}
    {petriBefore : ExecutionPackage oldSignature}
    {petriAfter : ExecutionPackage newSignature}
    {sourceSemantics :
      HeterogeneousAdmissionLTS sourceBefore sourceAfter}
    {petriSemantics :
      HeterogeneousAdmissionLTS petriBefore petriAfter}
    {sourceOccurrence :
      HeterogeneousPackageAdmission
        sourceBefore sourceAfter sourceSemantics admission}
    {beforeProjection :
      ProjectionCertificate sourceBefore.lts petriBefore.lts}
    {afterProjection :
      ProjectionCertificate sourceAfter.lts petriAfter.lts}
    {admissionProjection :
      HeterogeneousAdmissionProjection
        sourceBefore sourceAfter petriBefore petriAfter
        sourceSemantics petriSemantics admission sourceOccurrence
        beforeProjection afterProjection}
    {candidate : Candidate sourceAfter}
    {connects : sourceOccurrence.afterState = candidate.before}
    {semantic :
      PetriSemanticCertificate
        sourceAfter petriAfter afterProjection candidate}

/-- Build the operational half from the exact target admission projection. -/
def ofPreNetExtension
    (oldNet :
      OrderedPreNet
        (DPO.FiniteSupportEvent (ProvenanceToken oldSignature)))
    (preNetExtension :
      PreNetExtension admission oldNet semantic.net
        semantic.selectedDeclaration) :
    ReconfigurablePetriCertificate
      admission sourceBefore sourceAfter petriBefore petriAfter
      sourceSemantics petriSemantics sourceOccurrence
      beforeProjection afterProjection admissionProjection
      candidate connects semantic where
  oldNet := oldNet
  preNetExtension := preNetExtension
  targetAdmissionNative :=
    admissionProjection.targetOccurrence.native
  targetAdmissionReplays :=
    admissionProjection.targetOccurrence.replays
  targetAfterIsSelectedSource :=
    admissionProjection.after_commutes.symm.trans
      (congrArg afterProjection.mapState connects)

variable
    (certificate :
      ReconfigurablePetriCertificate
        admission sourceBefore sourceAfter petriBefore petriAfter
        sourceSemantics petriSemantics sourceOccurrence
        beforeProjection afterProjection admissionProjection
        candidate connects semantic)

/-- Every legacy rule keeps its exact incidence after signature reindexing. -/
theorem legacy_incidence_preserved
    (declaration : PetriRuleDeclaration)
    (declared :
      declaration ∈ certificate.oldNet.declarations) :
    semantic.net.transitionOf declaration
        (certificate.preNetExtension.oldDeclaredInNew declaration declared) =
      reindexFiniteSupportEvent admission.extension
        (certificate.oldNet.transitionOf declaration declared) :=
  certificate.preNetExtension.oldIncidencePreserved declaration declared

/--
One kernel theorem exposes all load-bearing cross-epoch facts: a genuinely
larger signature, native/replayable target admission, endpoint connection,
append-only declaration, tombstone/version identity, and the fixed-epoch
native/enabled/firing closure for the selected new rule.
-/
theorem complete_cross_epoch_incidence :
    ¬Function.Surjective admission.extension.gen ∧
      petriSemantics.step
        admissionProjection.targetOccurrence.beforeState
        (petriSemantics.eventOf admission)
        admissionProjection.targetOccurrence.afterState ∧
      AdmissionReplays admission
        (petriBefore.configOf
          admissionProjection.targetOccurrence.beforeState)
        (petriAfter.configOf
          admissionProjection.targetOccurrence.afterState) ∧
      admissionProjection.targetOccurrence.afterState =
        afterProjection.mapState candidate.before ∧
      semantic.selectedDeclaration ∈
        certificate.preNetExtension.appendedDeclarations ∧
      semantic.selectedDeclaration ∉
        certificate.oldNet.declarations ∧
      certificate.preNetExtension.traceTombstone =
        admission.tombstoneId ∧
      semantic.selectedDeclaration.signatureVersion =
        admission.toVersion ∧
      (petriAfter.eventRecord
        (afterProjection.mapEvent candidate.event)).event =
          semantic.selectedEvent ∧
      semantic.selectedTransition =
        endpointDelta semantic.selectedEvent.source
          semantic.selectedEvent.target ∧
      sourceAfter.lts.ObservableStep
        candidate.before candidate.event candidate.after ∧
      petriAfter.lts.ObservableStep
        (afterProjection.mapState candidate.before)
        (afterProjection.mapEvent candidate.event)
        (afterProjection.mapState candidate.after) ∧
      semantic.selectedTransition.Enabled semantic.beforeMarking ∧
      semantic.selectedTransition.apply semantic.beforeMarking =
        semantic.afterMarking := by
  exact
    ⟨certificate.preNetExtension.extensionAddsGenerator,
      certificate.targetAdmissionNative,
      certificate.targetAdmissionReplays,
      certificate.targetAfterIsSelectedSource,
      certificate.preNetExtension.selectedInAppend,
      certificate.preNetExtension.selectedNotOld,
      certificate.preNetExtension.traceTombstoneExact,
      certificate.preNetExtension.selectedAdmissionVersion,
      semantic.petri_event_record_exact,
      semantic.selectedTransition_incidence_exact,
      semantic.sourceOccurrence.native,
      semantic.occurrence.native,
      semantic.selectedTransition_enabled,
      semantic.selectedTransition_fires⟩

end ReconfigurablePetriCertificate

end Cantilune.Projection.P1aSemanticCertificate
