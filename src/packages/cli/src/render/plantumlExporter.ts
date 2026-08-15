import type { GraphEdge, GraphNode } from "./asciiGraph.js";

function escapePlantUml(label: string): string {
  return label.replaceAll('"', "'");
}

export function exportPlantUml(nodes: GraphNode[], edges: GraphEdge[]): string {
  const lines: string[] = ["@startuml", "hide empty description"];
  for (const node of nodes) {
    const color = node.color ? ` #${node.color.replace("#", "")}` : "";
    lines.push(`class ${node.id}${color} {`, `  ${escapePlantUml(node.label)}`, "}");
  }
  for (const edge of edges) {
    const label = edge.label ? ` : ${escapePlantUml(edge.label)}` : "";
    lines.push(`${edge.from} --> ${edge.to}${label}`);
  }
  lines.push("@enduml");
  return lines.join("\n");
}
