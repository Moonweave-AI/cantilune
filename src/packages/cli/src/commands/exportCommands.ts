import type { CommandServices, SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore } from "../store.js";
import { buildExportBody, writeExportArtifact } from "../wiring/exportControl.js";

function setExport(
  store: AppStore,
  target: string,
  args: Record<string, unknown>,
  services?: CommandServices,
): void {
  const format = typeof args.format === "string" ? args.format : "json";
  const snapshotRef = typeof args.ref === "string" ? args.ref : undefined;
  const built = buildExportBody(
    target,
    format,
    store.runtime,
    services?.observeControl?.(),
    snapshotRef,
  );
  store.mode = "view";
  store.activeView = "export";
  if (!built.ok) {
    store.viewArgs = { target, format, error: built.message };
    return;
  }
  const storagePath = store.storagePath;
  const writtenPath =
    storagePath !== undefined ? writeExportArtifact(storagePath, target, format, built.body) : undefined;
  store.viewArgs = {
    target,
    format,
    body: built.body,
    ...(writtenPath !== undefined ? { writtenPath } : {}),
  };
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
      handler: (args, store, services) => setExport(store, "graph", args, services),
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
      handler: (args, store, services) => setExport(store, "petri", args, services),
    },
    {
      name: "/export trace",
      description: "Export coordination trace",
      category: exportCat,
      handler: (_args, store, services) => setExport(store, "trace", _args, services),
    },
    {
      name: "/export snapshot",
      description: "Export snapshot by ref",
      category: exportCat,
      args: [{ name: "ref", description: "Snapshot ref", required: true, type: "string" }],
      handler: (args, store, services) => setExport(store, "snapshot", args, services),
    },
    {
      name: "/export bundle",
      description: "Export replay bundle manifest",
      category: exportCat,
      handler: (_args, store, services) => setExport(store, "bundle", _args, services),
    },
    {
      name: "/export four-view",
      description: "Export observability four-view bundle",
      category: exportCat,
      handler: (_args, store, services) => setExport(store, "four-view", _args, services),
    },
  ];
}
