/**
 * Coordination DAG from committed beforeRef/afterRef links — not a changeLog chain.
 */
import type { ChangeLogEntry, RuntimeState } from "../store.js";
import type { GraphEdge, GraphNode } from "../render/asciiGraph.js";

export interface GraphViewData {
  readonly nodes: GraphNode[];
  readonly edges: GraphEdge[];
}

export function graphDataFromRuntime(runtime: RuntimeState): GraphViewData | null {
  if (runtime.changeLog.length === 0) {
    return runtime.snapshot === null ? null : { nodes: [], edges: [] };
  }

  const nodes: GraphNode[] = runtime.changeLog.map((entry) => ({
    id: entry.changeId,
    label: `${entry.operationTypeId}(${entry.initiator})`,
  }));

  const byAfterRef = new Map<string, ChangeLogEntry[]>();
  for (const entry of runtime.changeLog) {
    const list = byAfterRef.get(entry.afterRef) ?? [];
    list.push(entry);
    byAfterRef.set(entry.afterRef, list);
  }

  const edges: GraphEdge[] = [];
  const seen = new Set<string>();
  for (const entry of runtime.changeLog) {
    const parents = byAfterRef.get(entry.beforeRef) ?? [];
    for (const parent of parents) {
      if (parent.changeId === entry.changeId) continue;
      const key = `${parent.changeId}->${entry.changeId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ from: parent.changeId, to: entry.changeId, label: "before/after" });
    }
  }

  return { nodes, edges };
}

/** BFS shortest path over DAG edges. Missing endpoints fail closed. */
export function shortestPath(
  nodes: readonly GraphNode[],
  edges: readonly GraphEdge[],
  from: string,
  to: string,
): readonly string[] | undefined {
  const ids = new Set(nodes.map((node) => node.id));
  if (!ids.has(from) || !ids.has(to)) {
    return undefined;
  }
  if (from === to) {
    return [from];
  }
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }
  const queue: string[] = [from];
  const prev = new Map<string, string>();
  const visited = new Set<string>([from]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    for (const next of adj.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      prev.set(next, current);
      if (next === to) {
        const path = [to];
        let cursor: string | undefined = to;
        while (cursor !== from) {
          cursor = prev.get(cursor);
          if (cursor === undefined) return undefined;
          path.push(cursor);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return undefined;
}

export function graphStats(data: GraphViewData): {
  readonly nodes: number;
  readonly edges: number;
  readonly maxDepth: number;
  readonly leafChanges: number;
} {
  const outgoing = new Set(data.edges.map((edge) => edge.from));
  const incoming = new Map<string, number>();
  for (const node of data.nodes) {
    incoming.set(node.id, 0);
  }
  for (const edge of data.edges) {
    incoming.set(edge.to, (incoming.get(edge.to) ?? 0) + 1);
  }
  const roots = data.nodes.filter((node) => (incoming.get(node.id) ?? 0) === 0).map((n) => n.id);
  const adj = new Map<string, string[]>();
  for (const edge of data.edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
  }
  let maxDepth = 0;
  const visit = (id: string, depth: number, stack: Set<string>): void => {
    if (stack.has(id)) return;
    maxDepth = Math.max(maxDepth, depth);
    stack.add(id);
    for (const next of adj.get(id) ?? []) {
      visit(next, depth + 1, stack);
    }
    stack.delete(id);
  };
  for (const root of roots) {
    visit(root, 1, new Set());
  }
  if (data.nodes.length > 0 && maxDepth === 0) {
    maxDepth = 1;
  }
  const leafChanges = data.nodes.filter((node) => !outgoing.has(node.id)).length;
  return {
    nodes: data.nodes.length,
    edges: data.edges.length,
    maxDepth,
    leafChanges,
  };
}
