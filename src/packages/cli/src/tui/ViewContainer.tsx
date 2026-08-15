import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import type { ViewType } from "../store.js";
import { useTheme } from "../theme/themeContext.js";
import { border, fg } from "../theme/theme.js";
import { Spinner } from "./Spinner.js";

export interface ViewContainerProps {
  readonly activeView: ViewType;
  readonly viewArgs: Record<string, unknown>;
}

type ViewComponent = React.ComponentType<{
  viewArgs: Record<string, unknown>;
  activeView: ViewType;
}>;

const VIEW_MODULE_MAP: Record<string, string> = {
  world: "WorldView",
  graph: "GraphView",
  petri: "PetriView",
  trace: "TraceView",
  replay: "ReplayView",
  content: "ContentView",
  observe: "ObserveView",
  schema: "SchemaView",
  eval: "EvalView",
  cluster: "ClusterView",
  swarm: "SwarmView",
  tools: "ToolsView",
  mcp: "McpView",
  config: "ConfigView",
  export: "ExportView",
  help: "HelpView",
  events: "EventView",
};

function getModuleName(viewType: ViewType): string | undefined {
  const prefix = viewType.split("-")[0]!;
  return VIEW_MODULE_MAP[prefix];
}

async function loadViewComponent(viewType: ViewType): Promise<ViewComponent | null> {
  const moduleName = getModuleName(viewType);
  if (moduleName === undefined) return null;
  try {
    const mod = (await import(`../views/${moduleName}.js`)) as { default?: ViewComponent };
    return mod.default ?? null;
  } catch {
    return null;
  }
}

export function ViewContainer({ activeView, viewArgs }: ViewContainerProps): React.ReactElement {
  const theme = useTheme();
  const [loadedView, setLoadedView] = useState<ViewComponent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadViewComponent(activeView).then((component) => {
      if (!cancelled) {
        setLoadedView(() => component);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [activeView]);

  if (loading) {
    return (
      <Box flexGrow={1} paddingX={1}>
        <Spinner />
        <Text {...theme.text.muted}>
          {" "}
          loading {activeView}
          {theme.glyphs.ellipsis}
        </Text>
      </Box>
    );
  }

  if (loadedView === null) {
    return (
      <Box
        flexGrow={1}
        flexDirection="column"
        paddingX={1}
        borderStyle={theme.border}
        {...border(theme.colors.warning)}
      >
        <Text bold {...fg(theme.colors.warning)}>
          Coming soon
        </Text>
        <Text>View &quot;{activeView}&quot; is not implemented yet.</Text>
        {Object.keys(viewArgs).length > 0 ? (
          <Text {...theme.text.muted}>Args: {JSON.stringify(viewArgs)}</Text>
        ) : null}
      </Box>
    );
  }

  const LoadedView = loadedView;
  return (
    <Box flexGrow={1} flexDirection="column">
      <LoadedView viewArgs={viewArgs} activeView={activeView} />
    </Box>
  );
}
