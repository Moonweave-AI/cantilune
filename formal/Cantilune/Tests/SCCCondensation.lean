import Cantilune.Projection.SCCCondensation
import Cantilune.Projection.DAGScopeObstruction

/-!
# Regression checks for total SCC condensation
-/

namespace Cantilune.Tests.SCCCondensation

open Cantilune.Projection.DAGScopeObstruction
open Cantilune.Projection.RankableDAG
open Cantilune.Projection.SCCCondensation

#check FiniteDirectedGraph.original_edge_internal_or_condensed
#check FiniteDirectedGraph.condensationEdge_lt
#check FiniteDirectedGraph.condensation_acyclic
#check totalDAG
#check rankableViews
#check rankableViews_strict_preserves_incidence

/--
The legal self-loop which refutes a total strict rank still has a total,
acyclic SCC condensation.
-/
example
    (component : (dependencyGraph loopGraph).SCC) :
    ¬ Path (totalDAG loopGraph) component component :=
  totalDAG_acyclic loopGraph component

/--
The total construction and the strict construction have deliberately
different domains: the former accepts the self-loop while the latter remains
kernel-refuted.
-/
example :
    ¬ HasStrictIncidenceRank loopGraph :=
  loopGraph_not_rankable

end Cantilune.Tests.SCCCondensation
