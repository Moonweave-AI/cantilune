import Cantilune.Core.OpenHypergraph
import Cantilune.Core.DPO

/-!
# Executable finite typed DPOI rewriting

This module proves a DPOI-style rewrite theorem for *inclusion matches* of
finite typed open hypergraphs.  A match selects finite active node and edge
supports.  Deletion is legal exactly when the identification, dangling, and
boundary conditions below hold.  Fresh insertion data is checked for typing
and incidence before it is admitted.

The construction computes the pushout-complement carrier by deletion and the
second pushout carrier by fresh insertion.  Subject reduction, deterministic
fixed-match uniqueness, proof-representative independence, boundary
preservation, and a parallel-independence theorem are kernel checked.

This finite theorem is not a claim that the ambient open-hypergraph category
has been instantiated as a general M-adhesive presheaf category.
-/

namespace Cantilune.Core

namespace DPOI

open TypedOpenHypergraph

variable {σ : FinSignature} {inputTypes outputTypes : List σ.Obj}
variable {Node Edge : Type*} [DecidableEq Node] [DecidableEq Edge]

/--
An injective inclusion match into an active host graph.

The maps from the selected subtypes to the ambient identifiers are `Subtype.val`;
their injectivity is proved below as the identification part of the gluing
condition.
-/
structure InclusionMatch
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) where
  nodes : Finset Node
  edges : Finset Edge
  nodes_active : nodes ⊆ G.nodes
  edges_active : edges ⊆ G.edges
  source_closed :
    ∀ e, e ∈ edges → ∀ n, n ∈ G.sources e → n ∈ nodes
  target_closed :
    ∀ e, e ∈ edges → ∀ n, n ∈ G.targets e → n ∈ nodes

namespace InclusionMatch

variable {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}

/-- The node component of an inclusion match is an embedding. -/
def nodeEmbedding (m : InclusionMatch G) : ↥m.nodes ↪ Node :=
  ⟨Subtype.val, Subtype.val_injective⟩

/-- The edge component of an inclusion match is an embedding. -/
def edgeEmbedding (m : InclusionMatch G) : ↥m.edges ↪ Edge :=
  ⟨Subtype.val, Subtype.val_injective⟩

/--
The identification gluing condition is automatic for concrete inclusion
matches: neither nodes nor edges can be identified by the match.
-/
theorem identificationCondition (m : InclusionMatch G) :
    Function.Injective m.nodeEmbedding ∧
      Function.Injective m.edgeEmbedding :=
  ⟨m.nodeEmbedding.injective, m.edgeEmbedding.injective⟩

end InclusionMatch

/-- Finite carrier support of a proposed rewrite. -/
structure RewriteSupport (Node Edge : Type*) [DecidableEq Node] [DecidableEq Edge] where
  deleteNodes : Finset Node
  deleteEdges : Finset Edge
  insertNodes : Finset Node
  insertEdges : Finset Edge

namespace RewriteSupport

/-- A rewrite support is determined by its four finite carrier sets. -/
@[ext]
theorem ext
    {s t : RewriteSupport Node Edge}
    (deleteNodes : s.deleteNodes = t.deleteNodes)
    (deleteEdges : s.deleteEdges = t.deleteEdges)
    (insertNodes : s.insertNodes = t.insertNodes)
    (insertEdges : s.insertEdges = t.insertEdges) :
    s = t := by
  cases s
  cases t
  simp_all

/-- Apply only the node-carrier update. -/
def applyNodes (s : RewriteSupport Node Edge) (nodes : Finset Node) : Finset Node :=
  (nodes \ s.deleteNodes) ∪ s.insertNodes

/-- Apply only the edge-carrier update. -/
def applyEdges (s : RewriteSupport Node Edge) (edges : Finset Edge) : Finset Edge :=
  (edges \ s.deleteEdges) ∪ s.insertEdges

end RewriteSupport

/--
No retained host edge may remain incident to a deleted node.  This is the
finite directed-hypergraph dangling condition.
-/
def DanglingCondition
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge)
    (s : RewriteSupport Node Edge) : Prop :=
  ∀ e, e ∈ G.edges → e ∉ s.deleteEdges →
    (∀ n, n ∈ G.sources e → n ∉ s.deleteNodes) ∧
    (∀ n, n ∈ G.targets e → n ∉ s.deleteNodes)

/-- The open interface is retained pointwise by the rewrite. -/
def BoundaryCondition
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge)
    (s : RewriteSupport Node Edge) : Prop :=
  (∀ i, G.inputBoundary i ∉ s.deleteNodes) ∧
  (∀ i, G.outputBoundary i ∉ s.deleteNodes)

/--
All executable obligations for one finite typed inclusion-match rewrite.

Fresh inserted identifiers already have total declarations in the ambient
graph universe; the final four fields validate those declarations against the
post-deletion/post-insertion carrier and the signature.
-/
structure AdmissibleRewrite
    (G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) where
  matching : InclusionMatch G
  support : RewriteSupport Node Edge
  deleteNodes_matched : support.deleteNodes ⊆ matching.nodes
  deleteEdges_matched : support.deleteEdges ⊆ matching.edges
  insertNodes_fresh : Disjoint support.insertNodes G.nodes
  insertEdges_fresh : Disjoint support.insertEdges G.edges
  dangling : DanglingCondition G support
  boundary : BoundaryCondition G support
  insertedSources_active :
    ∀ e, e ∈ support.insertEdges →
      ∀ n, n ∈ G.sources e → n ∈ support.applyNodes G.nodes
  insertedTargets_active :
    ∀ e, e ∈ support.insertEdges →
      ∀ n, n ∈ G.targets e → n ∈ support.applyNodes G.nodes
  insertedSources_typed :
    ∀ e, e ∈ support.insertEdges →
      (G.sources e).map G.nodeType = σ.input (G.edgeLabel e)
  insertedTargets_typed :
    ∀ e, e ∈ support.insertEdges →
      (G.targets e).map G.nodeType = σ.output (G.edgeLabel e)

namespace AdmissibleRewrite

variable {G : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}

theorem deleteNodes_active (r : AdmissibleRewrite G) :
    r.support.deleteNodes ⊆ G.nodes :=
  fun _ hn => r.matching.nodes_active (r.deleteNodes_matched hn)

theorem deleteEdges_active (r : AdmissibleRewrite G) :
    r.support.deleteEdges ⊆ G.edges :=
  fun _ he => r.matching.edges_active (r.deleteEdges_matched he)

theorem delete_insert_nodes_disjoint (r : AdmissibleRewrite G) :
    Disjoint r.support.deleteNodes r.support.insertNodes := by
  rw [Finset.disjoint_left]
  intro n hnDelete hnInsert
  exact
    Finset.disjoint_left.mp r.insertNodes_fresh hnInsert
      (r.deleteNodes_active hnDelete)

theorem delete_insert_edges_disjoint (r : AdmissibleRewrite G) :
    Disjoint r.support.deleteEdges r.support.insertEdges := by
  rw [Finset.disjoint_left]
  intro e heDelete heInsert
  exact
    Finset.disjoint_left.mp r.insertEdges_fresh heInsert
      (r.deleteEdges_active heDelete)

/-- The executable pushout-complement carrier: delete the matched `L \ K`. -/
def complementRaw (r : AdmissibleRewrite G) :
    RawTypedOpenHypergraph σ inputTypes outputTypes Node Edge where
  nodes := G.nodes \ r.support.deleteNodes
  edges := G.edges \ r.support.deleteEdges
  nodeType := G.nodeType
  edgeLabel := G.edgeLabel
  sources := G.sources
  targets := G.targets
  inputBoundary := G.inputBoundary
  outputBoundary := G.outputBoundary

theorem complement_wellFormed (r : AdmissibleRewrite G) :
    r.complementRaw.IsWellFormed := by
  constructor
  · intro e he n hn
    have heHost : e ∈ G.edges := Finset.mem_sdiff.mp he |>.1
    have heRetained : e ∉ r.support.deleteEdges := Finset.mem_sdiff.mp he |>.2
    have hnHost : n ∈ G.nodes := G.wellFormed.source_active e heHost n hn
    have hnRetained : n ∉ r.support.deleteNodes :=
      (r.dangling e heHost heRetained).1 n hn
    exact Finset.mem_sdiff.mpr ⟨hnHost, hnRetained⟩
  · intro e he n hn
    have heHost : e ∈ G.edges := Finset.mem_sdiff.mp he |>.1
    have heRetained : e ∉ r.support.deleteEdges := Finset.mem_sdiff.mp he |>.2
    have hnHost : n ∈ G.nodes := G.wellFormed.target_active e heHost n hn
    have hnRetained : n ∉ r.support.deleteNodes :=
      (r.dangling e heHost heRetained).2 n hn
    exact Finset.mem_sdiff.mpr ⟨hnHost, hnRetained⟩
  · intro e he
    exact G.wellFormed.source_typed e (Finset.mem_sdiff.mp he |>.1)
  · intro e he
    exact G.wellFormed.target_typed e (Finset.mem_sdiff.mp he |>.1)
  · intro i
    exact
      Finset.mem_sdiff.mpr
        ⟨G.wellFormed.inputBoundary_active i, r.boundary.1 i⟩
  · intro i
    exact
      Finset.mem_sdiff.mpr
        ⟨G.wellFormed.outputBoundary_active i, r.boundary.2 i⟩
  · exact G.wellFormed.inputBoundary_injective
  · exact G.wellFormed.outputBoundary_injective
  · exact G.wellFormed.inputBoundary_typed
  · exact G.wellFormed.outputBoundary_typed

/-- Certified pushout-complement graph for the finite inclusion match. -/
def complement (r : AdmissibleRewrite G) :
    TypedOpenHypergraph σ inputTypes outputTypes Node Edge where
  toRawTypedOpenHypergraph := r.complementRaw
  wellFormed := r.complement_wellFormed

/--
A complement predicate tied only to the explicit finite deletion
construction.  It contains no oracle asserting existence or uniqueness of a
categorical pushout complement.
-/
def IsComplement (r : AdmissibleRewrite G)
    (D : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) : Prop :=
  D.toRawTypedOpenHypergraph = r.complementRaw

@[simp]
theorem complement_isComplement (r : AdmissibleRewrite G) :
    r.IsComplement r.complement :=
  rfl

/--
The finite inclusion-match complement is unique among certified graphs
realising the explicit deletion construction.

This is the executable gluing theorem; it is not derived from adhesivity.
-/
theorem fixed_match_complement_unique
    (r : AdmissibleRewrite G)
    {D E : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
    (hD : r.IsComplement D) (hE : r.IsComplement E) :
    D = E :=
  TypedOpenHypergraph.ext (hD.trans hE.symm)

/--
The executable second-pushout carrier: add the fresh `R \ K` declarations to
the computed complement.
-/
def resultRaw (r : AdmissibleRewrite G) :
    RawTypedOpenHypergraph σ inputTypes outputTypes Node Edge where
  nodes := r.support.applyNodes G.nodes
  edges := r.support.applyEdges G.edges
  nodeType := G.nodeType
  edgeLabel := G.edgeLabel
  sources := G.sources
  targets := G.targets
  inputBoundary := G.inputBoundary
  outputBoundary := G.outputBoundary

/-- Subject reduction for the executable finite typed DPOI construction. -/
theorem subject_reduction (r : AdmissibleRewrite G) :
    r.resultRaw.IsWellFormed := by
  constructor
  · intro e he n hn
    rcases Finset.mem_union.mp he with heRetained | heInserted
    · have heHost : e ∈ G.edges := Finset.mem_sdiff.mp heRetained |>.1
      have heNotDeleted : e ∉ r.support.deleteEdges :=
        Finset.mem_sdiff.mp heRetained |>.2
      have hnHost := G.wellFormed.source_active e heHost n hn
      have hnNotDeleted := (r.dangling e heHost heNotDeleted).1 n hn
      exact
        Finset.mem_union_left _
          (Finset.mem_sdiff.mpr ⟨hnHost, hnNotDeleted⟩)
    · exact r.insertedSources_active e heInserted n hn
  · intro e he n hn
    rcases Finset.mem_union.mp he with heRetained | heInserted
    · have heHost : e ∈ G.edges := Finset.mem_sdiff.mp heRetained |>.1
      have heNotDeleted : e ∉ r.support.deleteEdges :=
        Finset.mem_sdiff.mp heRetained |>.2
      have hnHost := G.wellFormed.target_active e heHost n hn
      have hnNotDeleted := (r.dangling e heHost heNotDeleted).2 n hn
      exact
        Finset.mem_union_left _
          (Finset.mem_sdiff.mpr ⟨hnHost, hnNotDeleted⟩)
    · exact r.insertedTargets_active e heInserted n hn
  · intro e he
    rcases Finset.mem_union.mp he with heRetained | heInserted
    · exact
        G.wellFormed.source_typed e (Finset.mem_sdiff.mp heRetained |>.1)
    · exact r.insertedSources_typed e heInserted
  · intro e he
    rcases Finset.mem_union.mp he with heRetained | heInserted
    · exact
        G.wellFormed.target_typed e (Finset.mem_sdiff.mp heRetained |>.1)
    · exact r.insertedTargets_typed e heInserted
  · intro i
    exact
      Finset.mem_union_left _
        (Finset.mem_sdiff.mpr
          ⟨G.wellFormed.inputBoundary_active i, r.boundary.1 i⟩)
  · intro i
    exact
      Finset.mem_union_left _
        (Finset.mem_sdiff.mpr
          ⟨G.wellFormed.outputBoundary_active i, r.boundary.2 i⟩)
  · exact G.wellFormed.inputBoundary_injective
  · exact G.wellFormed.outputBoundary_injective
  · exact G.wellFormed.inputBoundary_typed
  · exact G.wellFormed.outputBoundary_typed

/-- The certified finite typed DPOI result. -/
def result (r : AdmissibleRewrite G) :
    TypedOpenHypergraph σ inputTypes outputTypes Node Edge where
  toRawTypedOpenHypergraph := r.resultRaw
  wellFormed := r.subject_reduction

/-- A result predicate that contains no result-uniqueness oracle. -/
def IsResult (r : AdmissibleRewrite G)
    (H : TypedOpenHypergraph σ inputTypes outputTypes Node Edge) : Prop :=
  H.toRawTypedOpenHypergraph = r.resultRaw

@[simp]
theorem result_isResult (r : AdmissibleRewrite G) :
    r.IsResult r.result :=
  rfl

/--
For a fixed inclusion match and concrete fresh support, two certified results
satisfying the executable construction are equal.
-/
theorem fixed_match_result_unique
    (r : AdmissibleRewrite G)
    {H J : TypedOpenHypergraph σ inputTypes outputTypes Node Edge}
    (hH : r.IsResult H) (hJ : r.IsResult J) :
    H = J :=
  TypedOpenHypergraph.ext (hH.trans hJ.symm)

/--
Two proof records designate the same rewrite representative when their four
finite carrier supports agree.  Match and gluing proofs do not influence the
computed endpoint.
-/
structure SameRepresentative (r s : AdmissibleRewrite G) : Prop where
  deleteNodes : r.support.deleteNodes = s.support.deleteNodes
  deleteEdges : r.support.deleteEdges = s.support.deleteEdges
  insertNodes : r.support.insertNodes = s.support.insertNodes
  insertEdges : r.support.insertEdges = s.support.insertEdges

/-- The endpoint is independent of the proof representative of a rewrite. -/
theorem result_respects_representative
    {r s : AdmissibleRewrite G} (h : SameRepresentative r s) :
    r.result = s.result := by
  apply TypedOpenHypergraph.ext
  have hs : r.support = s.support :=
    RewriteSupport.ext h.deleteNodes h.deleteEdges h.insertNodes h.insertEdges
  change r.resultRaw = s.resultRaw
  simp only [resultRaw]
  rw [hs]

/-- The input boundary embedding is preserved pointwise by DPOI rewriting. -/
@[simp]
theorem result_inputBoundary (r : AdmissibleRewrite G) :
    r.result.inputBoundary = G.inputBoundary :=
  rfl

/-- The output boundary embedding is preserved pointwise by DPOI rewriting. -/
@[simp]
theorem result_outputBoundary (r : AdmissibleRewrite G) :
    r.result.outputBoundary = G.outputBoundary :=
  rfl

/-- Node support as the existing executable finite-support DPO event. -/
def nodeEvent (r : AdmissibleRewrite G) : DPO.FiniteSupportEvent Node where
  erase := r.support.deleteNodes
  insert := r.support.insertNodes
  internallyDisjoint := r.delete_insert_nodes_disjoint

/-- Edge support as the existing executable finite-support DPO event. -/
def edgeEvent (r : AdmissibleRewrite G) : DPO.FiniteSupportEvent Edge where
  erase := r.support.deleteEdges
  insert := r.support.insertEdges
  internallyDisjoint := r.delete_insert_edges_disjoint

@[simp]
theorem nodeEvent_enabled (r : AdmissibleRewrite G) :
    r.nodeEvent.Enabled G.nodes :=
  r.deleteNodes_active

@[simp]
theorem edgeEvent_enabled (r : AdmissibleRewrite G) :
    r.edgeEvent.Enabled G.edges :=
  r.deleteEdges_active

/-- Parallel independence for both node and hyperedge carrier supports. -/
structure Independent (r s : AdmissibleRewrite G) : Prop where
  nodes : r.nodeEvent.Independent s.nodeEvent
  edges : r.edgeEvent.Independent s.edgeEvent

/--
Independent finite typed rewrite supports remain mutually enabled and commute
on both active carriers.  This is the proved concurrency theorem for the
finite inclusion-match fragment.
-/
theorem concurrency
    {r s : AdmissibleRewrite G} (h : Independent r s) :
    s.nodeEvent.Enabled (r.nodeEvent.apply G.nodes) ∧
      r.nodeEvent.Enabled (s.nodeEvent.apply G.nodes) ∧
      s.nodeEvent.apply (r.nodeEvent.apply G.nodes) =
        r.nodeEvent.apply (s.nodeEvent.apply G.nodes) ∧
      s.edgeEvent.Enabled (r.edgeEvent.apply G.edges) ∧
      r.edgeEvent.Enabled (s.edgeEvent.apply G.edges) ∧
      s.edgeEvent.apply (r.edgeEvent.apply G.edges) =
        r.edgeEvent.apply (s.edgeEvent.apply G.edges) := by
  have hn :=
    DPO.FiniteSupportEvent.concurrency
      h.nodes r.nodeEvent_enabled s.nodeEvent_enabled
  have he :=
    DPO.FiniteSupportEvent.concurrency
      h.edges r.edgeEvent_enabled s.edgeEvent_enabled
  exact ⟨hn.1, hn.2.1, hn.2.2, he.1, he.2.1, he.2.2⟩

end AdmissibleRewrite

end DPOI

end Cantilune.Core
