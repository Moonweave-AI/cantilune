export interface GraphNode {
  id: string;
  label: string;
  color?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label?: string;
}

function buildAdjacency(edges: GraphEdge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adj.get(edge.from) ?? [];
    list.push(edge.to);
    adj.set(edge.from, list);
    if (!adj.has(edge.to)) adj.set(edge.to, []);
  }
  return adj;
}

function topologicalLayers(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const ids = nodes.map((n) => n.id);
  const inDegree = new Map<string, number>(ids.map((id) => [id, 0]));
  for (const edge of edges) {
    inDegree.set(edge.to, (inDegree.get(edge.to) ?? 0) + 1);
  }

  const adj = buildAdjacency(edges);
  const layers: string[][] = [];
  let frontier = ids.filter((id) => (inDegree.get(id) ?? 0) === 0);

  const visited = new Set<string>();
  while (frontier.length > 0) {
    layers.push([...frontier]);
    for (const id of frontier) visited.add(id);
    const next: string[] = [];
    for (const id of frontier) {
      for (const to of adj.get(id) ?? []) {
        inDegree.set(to, (inDegree.get(to) ?? 0) - 1);
        if ((inDegree.get(to) ?? 0) === 0 && !visited.has(to)) {
          next.push(to);
          visited.add(to);
        }
      }
    }
    frontier = next;
  }

  const remaining = ids.filter((id) => !visited.has(id));
  if (remaining.length > 0) layers.push(remaining);
  return layers;
}

function nodeBox(label: string): string[] {
  const inner = ` ${label} `;
  const top = "┌" + "─".repeat(inner.length) + "┐";
  const mid = "│" + inner + "│";
  const bot = "└" + "─".repeat(inner.length) + "┘";
  return [top, mid, bot];
}

export function renderGraph(nodes: GraphNode[], edges: GraphEdge[]): string {
  if (nodes.length === 0) return "(empty graph)";

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const layers = topologicalLayers(nodes, edges);
  const lines: string[] = [];

  for (let li = 0; li < layers.length; li++) {
    const layer = layers[li];
    if (layer === undefined) continue;

    const boxes = layer.map((id) => {
      const node = nodeMap.get(id);
      return nodeBox(node?.label ?? id);
    });

    const maxHeight = Math.max(...boxes.map((b) => b.length));
    for (let row = 0; row < maxHeight; row++) {
      lines.push(boxes.map((box) => box[row] ?? " ".repeat(box[0]?.length ?? 0)).join("   "));
    }

    if (li < layers.length - 1) {
      lines.push("        │", "        ▼");
    }
  }

  if (edges.length > 0) {
    lines.push("", "Edges:");
    for (const edge of edges) {
      const from = nodeMap.get(edge.from)?.label ?? edge.from;
      const to = nodeMap.get(edge.to)?.label ?? edge.to;
      const label = edge.label ? ` [${edge.label}]` : "";
      lines.push(`  ${from} ──► ${to}${label}`);
    }
  }

  return lines.join("\n");
}
