/**
 * Export artifacts from the same production projections as /graph /petri /observe.
 * Writes atomically under `{storagePath}/exports/`.
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { exportDot } from "../render/dotExporter.js";
import { exportJson } from "../render/jsonExporter.js";
import { exportMermaid } from "../render/mermaidExporter.js";
import { exportPlantUml } from "../render/plantumlExporter.js";
import { exportPnml } from "../render/pnmlExporter.js";
import type { GraphEdge, GraphNode } from "../render/asciiGraph.js";
import type { RuntimeState } from "../store.js";
import { graphDataFromRuntime } from "./graphData.js";
import { projectPetriNet } from "./petriControl.js";
import type { ObserveController } from "./observeControl.js";

export interface ExportArtifact {
  readonly body: string;
  readonly path: string;
  readonly target: string;
  readonly format: string;
}

function extensionFor(format: string): string {
  switch (format) {
    case "dot":
      return "dot";
    case "mermaid":
      return "mmd";
    case "plantuml":
      return "puml";
    case "pnml":
      return "pnml";
    default:
      return "json";
  }
}

export function writeExportArtifact(
  storagePath: string,
  target: string,
  format: string,
  body: string,
): string {
  const dir = join(storagePath, "exports");
  mkdirSync(dir, { recursive: true });
  const name = `${target}-${String(Date.now())}.${extensionFor(format)}`;
  const dest = join(dir, name);
  const tmp = join(dir, `.${name}.${randomUUID()}.tmp`);
  writeFileSync(tmp, body, "utf8");
  renameSync(tmp, dest);
  return dest;
}

function exportGraphFormat(format: string, nodes: GraphNode[], edges: GraphEdge[]): string {
  switch (format) {
    case "dot":
      return exportDot(nodes, edges);
    case "mermaid":
      return exportMermaid(nodes, edges);
    case "plantuml":
      return exportPlantUml(nodes, edges);
    default:
      return exportJson({ nodes, edges });
  }
}

export function buildExportBody(
  target: string,
  format: string,
  runtime: RuntimeState,
  observe?: ObserveController,
  snapshotRef?: string,
): { readonly ok: true; readonly body: string } | { readonly ok: false; readonly message: string } {
  switch (target) {
    case "graph": {
      const data = graphDataFromRuntime(runtime);
      if (data === null) return { ok: false, message: "no runtime graph" };
      if (data.nodes.length === 0) {
        return {
          ok: true,
          body: exportJson({
            nodes: [],
            edges: [],
            note: "No coordination changes recorded yet.",
          }),
        };
      }
      return { ok: true, body: exportGraphFormat(format, data.nodes, data.edges) };
    }
    case "petri": {
      const projected = projectPetriNet(runtime);
      if (projected === null) return { ok: false, message: "no runtime petri projection" };
      if (format === "pnml") return { ok: true, body: exportPnml(projected.net) };
      if (format === "dot") {
        const nodes: GraphNode[] = [
          ...projected.net.places.map((place) => ({ id: place.id, label: place.name })),
          ...projected.net.transitions.map((transition) => ({
            id: transition.id,
            label: transition.name,
          })),
        ];
        const edges: GraphEdge[] = projected.net.arcs.map((arc) => ({
          from: arc.source,
          to: arc.target,
        }));
        return { ok: true, body: exportDot(nodes, edges) };
      }
      return { ok: true, body: exportJson(projected.net) };
    }
    case "trace":
      return { ok: true, body: exportJson({ trace: runtime.changeLog }) };
    case "snapshot": {
      const head = runtime.snapshot?.snapshotRef;
      if (
        snapshotRef !== undefined &&
        head !== undefined &&
        snapshotRef !== head
      ) {
        return {
          ok: true,
          body: exportJson({
            ref: snapshotRef,
            snapshot: null,
            note: "Only current head snapshot is available in this export path; use /world or getSnapshot for historical refs",
          }),
        };
      }
      return {
        ok: true,
        body: exportJson({
          ref: head ?? snapshotRef ?? null,
          snapshot: runtime.snapshot,
        }),
      };
    }
    case "bundle":
      return {
        ok: true,
        body: exportJson({
          snapshotRef: runtime.snapshot?.snapshotRef ?? null,
          epochId: runtime.epoch?.epochId ?? runtime.snapshot?.epochId ?? null,
          changeCount: runtime.changeLog.length,
          changes: runtime.changeLog,
        }),
      };
    case "four-view": {
      if (observe === undefined) {
        return { ok: false, message: "observability controller required for four-view export" };
      }
      const result = observe.observe({});
      if (!result.ok) {
        return { ok: false, message: result.message };
      }
      return { ok: true, body: exportJson(result.projection) };
    }
    default:
      return { ok: false, message: `unknown export target: ${target}` };
  }
}
