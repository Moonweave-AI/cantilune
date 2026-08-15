import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore } from "../store.js";

function setExport(store: AppStore, target: string, args: Record<string, unknown>): void {
  store.mode = "view";
  store.activeView = "export";
  store.viewArgs = { target, ...args };
}

export function registerExportCommands(): SlashCommand[] {
  const exportCat = "export" as CommandCategory;
  return [
    {
      name: "/export graph",
      description: "Export coordination DAG",
      category: exportCat,
      args: [
        {
          name: "format",
          description: "Export format (dot|mermaid|json|plantuml)",
          required: true,
          type: "string",
        },
      ],
      handler: (args, store) => setExport(store, "graph", args),
    },
    {
      name: "/export petri",
      description: "Export Petri net marking",
      category: exportCat,
      args: [
        {
          name: "format",
          description: "Export format (pnml|dot|json)",
          required: true,
          type: "string",
        },
      ],
      handler: (args, store) => setExport(store, "petri", args),
    },
    {
      name: "/export trace",
      description: "Export coordination trace",
      category: exportCat,
      handler: (_args, store) => setExport(store, "trace", _args),
    },
    {
      name: "/export snapshot",
      description: "Export snapshot by ref",
      category: exportCat,
      args: [{ name: "ref", description: "Snapshot ref", required: true, type: "string" }],
      handler: (args, store) => setExport(store, "snapshot", args),
    },
    {
      name: "/export bundle",
      description: "Export replay bundle manifest",
      category: exportCat,
      handler: (_args, store) => setExport(store, "bundle", _args),
    },
    {
      name: "/export four-view",
      description: "Export observability four-view bundle",
      category: exportCat,
      handler: (_args, store) => setExport(store, "four-view", _args),
    },
  ];
}
