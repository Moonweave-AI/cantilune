import type { GraphEdge, GraphNode } from "./asciiGraph.js";

function escapeMermaidLabel(label: string): string {
  return label.replaceAll('"', "#quot;");
}

export function exportMermaid(nodes: GraphNode[], edges: GraphEdge[]): string {
  const lines: string[] = ["flowchart TD"];
  for (const node of nodes) {
    lines.push(`  ${node.id}["${escapeMermaidLabel(node.label)}"]`);
  }
  for (const edge of edges) {
    const label = edge.label ? `|${escapeMermaidLabel(edge.label)}|` : "";
    lines.push(`  ${edge.from} -->${label} ${edge.to}`);
  }
  return lines.join("\n");
}
