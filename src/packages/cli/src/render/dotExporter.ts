import type { GraphEdge, GraphNode } from "./asciiGraph.js";

function escapeDotLabel(label: string): string {
  return label.replaceAll('"', String.raw`\"`);
}

export function exportDot(nodes: GraphNode[], edges: GraphEdge[]): string {
  const lines: string[] = ["digraph Cantilune {", "  rankdir=TB;", "  node [shape=box];"];
  for (const node of nodes) {
    const attrs: string[] = [`label="${escapeDotLabel(node.label)}"`];
    if (node.color !== undefined) attrs.push(`color="${escapeDotLabel(node.color)}"`);
    lines.push(`  "${node.id}" [${attrs.join(", ")}];`);
  }
  for (const edge of edges) {
    const label = edge.label ? ` [label="${escapeDotLabel(edge.label)}"]` : "";
    lines.push(`  "${edge.from}" -> "${edge.to}"${label};`);
  }
  lines.push("}");
  return lines.join("\n");
}
