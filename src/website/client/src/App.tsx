/** Cantilune website harness UI — the browser is the view/control surface. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClusterEventWire,
  ClientMessage,
  ConfigureRequest,
  ServerMessage,
  SwarmStatusWire,
  WorldSnapshotWire,
} from "@shared/protocol";
import { useBridge } from "./ws/useBridge";
import { AppFrame } from "./shell/AppFrame";
import { DetailsRail } from "./shell/DetailsRail";
import { SidebarPanel } from "./shell/SidebarPanel";
import type { ConfigPresetDefaults, ProviderEntryWire } from "./config/ConfigPanel";
import { SettingsOverlay, type SettingsTab } from "./settings/SettingsOverlay";
import { ConversationView } from "./conversation/ConversationView";
import {
  appendApproval,
  appendError,
  appendRunResult,
  appendUserInstruction,
  createConversationState,
  reduceAgentEvent,
  resolveApproval,
  resolveAskUser,
  type ConversationNode,
  type ConversationState,
} from "./conversation/nodes";
import {
  DEFAULT_SESSION,
  DEFAULT_WORKSPACE,
  discardSessionTranscript,
  loadHarness,
  loadSessionTranscript,
  saveHarness,
  saveSessionTranscript,
  type CatalogEntry,
  type GroupBy,
  type HarnessSnapshot,
  type OrderBy,
  type SessionSummary,
  type SessionView,
  type WorkspaceSummary,
} from "./persist/store";
import "./theme/tokens.css";
import {
  applyResolvedTheme,
  readThemePreference,
  resolveTheme,
  writeThemePreference,
  type ThemePreference,
} from "./theme/theme";

export type { ThemePreference };
export type { SessionSummary, WorkspaceSummary };

const boot = loadHarness();

function withWorkspace(request: ConfigureRequest, workspace: WorkspaceSummary): ConfigureRequest {
  const next: { -readonly [K in keyof ConfigureRequest]: ConfigureRequest[K] } = { ...request };
  if (workspace.path.length > 0 && workspace.path !== ".") next.workspace = workspace.path;
  else delete next.workspace;
  return next;
}

export function App(): JSX.Element {
  const [conversation, setConversation] = useState<ConversationState>(
    () => boot.conversations[boot.activeSessionId] ?? createConversationState(),
  );
  const [sessionConversations, setSessionConversations] = useState<
    Readonly<Record<string, ConversationState>>
  >(boot.conversations);
  const [providers, setProviders] = useState<readonly ProviderEntryWire[]>([]);
  const [configured, setConfigured] = useState(false);
  const [running, setRunning] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>(() => readThemePreference());
  const [configure, setConfigure] = useState<ConfigureRequest | undefined>(boot.configure);
  const [provider, setProvider] = useState<string | undefined>(boot.configure?.provider);
  const [model, setModel] = useState<string | undefined>(boot.configure?.model);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldSnapshotWire | null>(null);
  const [swarmStatus, setSwarmStatus] = useState<SwarmStatusWire | null>(null);
  const [clusterEvents, setClusterEvents] = useState<readonly ClusterEventWire[]>([]);
  const [sessions, setSessions] = useState<readonly SessionSummary[]>(boot.sessions);
  const [activeSessionId, setActiveSessionId] = useState(boot.activeSessionId);
  const [workspaces, setWorkspaces] = useState<readonly WorkspaceSummary[]>(boot.workspaces);
  const [activeWorkspaceId, setActiveWorkspaceId] = useState(boot.activeWorkspaceId);
  const [view, setView] = useState<SessionView>(boot.view);
  const [mode, setMode] = useState(boot.mode);
  const [groupBy, setGroupBy] = useState<GroupBy>(boot.groupBy);
  const [orderBy, setOrderBy] = useState<OrderBy>(boot.orderBy);
  const [collapsedWorkspaceIds, setCollapsedWorkspaceIds] = useState<readonly string[]>(
    boot.collapsedWorkspaceIds,
  );
  const [catalog, setCatalog] = useState<readonly CatalogEntry[]>(boot.catalog);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [preset, setPreset] = useState<ConfigPresetDefaults | undefined>(undefined);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const convRef = useRef(conversation);
  convRef.current = conversation;
  const conversationsRef = useRef(sessionConversations);
  conversationsRef.current = sessionConversations;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;
  const configureRef = useRef(configure);
  configureRef.current = configure;
  const workspacesRef = useRef(workspaces);
  workspacesRef.current = workspaces;
  const activeWorkspaceIdRef = useRef(activeWorkspaceId);
  activeWorkspaceIdRef.current = activeWorkspaceId;
  const persistTimer = useRef(0);
  const sendRef = useRef<(message: ClientMessage) => void>(() => undefined);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const hydratedRef = useRef((boot.conversations[boot.activeSessionId]?.nodes.length ?? 0) > 0);

  useEffect(() => {
    if (hydratedRef.current) return;
    const timer = window.setTimeout(() => {
      if (convRef.current.nodes.length > 0) {
        hydratedRef.current = true;
        return;
      }
      const loaded = loadSessionTranscript(boot.activeSessionId);
      hydratedRef.current = true;
      if (loaded.nodes.length === 0) return;
      setConversation(loaded);
      conversationsRef.current = {
        ...conversationsRef.current,
        [boot.activeSessionId]: loaded,
      };
      setSessionConversations(conversationsRef.current);
    }, 32);
    return () => window.clearTimeout(timer);
  }, []);

  const workspace =
    workspaces.find((item) => item.id === activeWorkspaceId) ??
    workspaces[0] ??
    DEFAULT_WORKSPACE;

  useEffect(() => {
    setSessionConversations((previous) => {
      if (previous[activeSessionId] === conversation) return previous;
      return { ...previous, [activeSessionId]: conversation };
    });
  }, [activeSessionId, conversation]);

  useEffect(() => {
    if (!hydratedRef.current && convRef.current.nodes.length === 0) return;
    window.clearTimeout(persistTimer.current);
    persistTimer.current = window.setTimeout(
      () => {
        const snapshot: HarnessSnapshot = {
          schema: 1,
          sessions,
          activeSessionId,
          workspaces,
          activeWorkspaceId,
          conversations: { ...conversationsRef.current, [activeSessionId]: convRef.current },
          configure,
          catalog,
          view,
          mode,
          groupBy,
          orderBy,
          collapsedWorkspaceIds,
        };
        saveHarness(snapshot);
      },
      running ? 2000 : 400,
    );
    return () => window.clearTimeout(persistTimer.current);
  }, [
    activeSessionId,
    activeWorkspaceId,
    collapsedWorkspaceIds,
    configure,
    conversation,
    catalog,
    groupBy,
    mode,
    orderBy,
    running,
    sessions,
    view,
    workspaces,
  ]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      applyResolvedTheme(resolveTheme(theme, media.matches));
    };
    apply();
    writeThemePreference(theme);
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [theme]);

  const handleMessage = useCallback((message: ServerMessage) => {
    switch (message.type) {
      case "ready":
        setProviders(message.providers);
        break;
      case "agent_event":
        if (
          message.event.kind === "diagnostic" &&
          message.event.phase === "configuration" &&
          message.event.message.startsWith("OS booted:")
        ) {
          setConfigured(true);
        }
        if (message.event.kind === "error" && message.event.phase === "configuration") {
          setConfigured(false);
        }
        setConversation((prev) => reduceAgentEvent(prev, message.event));
        break;
      case "approval_request":
        if (modeRef.current === "execute") {
          sendRef.current({
            type: "approve",
            toolCallId: message.toolCallId,
            decision: "allow",
          });
          break;
        }
        setConversation((prev) => appendApproval(prev, message));
        break;
      case "run_result":
        setRunning(false);
        setConversation((prev) => appendRunResult(prev, message));
        break;
      case "error":
        setConfigured(false);
        setConversation((prev) => appendError(prev, message.message));
        break;
      case "cluster_event":
        setClusterEvents((prev) => [...prev, message.event].slice(-200));
        break;
      case "swarm:status":
        setSwarmStatus(message.status);
        break;
      case "world":
        setWorld(message.snapshot);
        break;
      case "workspacePicked": {
        const path = message.path;
        if (path === undefined || path.length === 0) break;
        const existing = workspacesRef.current.find((item) => item.path === path);
        if (existing !== undefined) {
          activeWorkspaceIdRef.current = existing.id;
          setActiveWorkspaceId(existing.id);
          const saved = configureRef.current;
          if (saved !== undefined) sendRef.current(withWorkspace(saved, existing));
          break;
        }
        const leaf = path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() ?? path;
        const next: WorkspaceSummary = { id: `workspace-${Date.now()}`, name: leaf, path };
        workspacesRef.current = [...workspacesRef.current, next];
        setWorkspaces(workspacesRef.current);
        activeWorkspaceIdRef.current = next.id;
        setActiveWorkspaceId(next.id);
        const saved = configureRef.current;
        if (saved !== undefined) sendRef.current(withWorkspace(saved, next));
        break;
      }
    }
  }, []);

  const bridge = useBridge(handleMessage);
  const send = bridge.send;
  sendRef.current = send;

  useEffect(() => {
    if (bridge.status !== "open") return;
    const saved = configureRef.current;
    if (saved === undefined) return;
    const currentWorkspace =
      workspacesRef.current.find((item) => item.id === activeWorkspaceIdRef.current) ??
      workspacesRef.current[0] ??
      DEFAULT_WORKSPACE;
    send(withWorkspace(saved, currentWorkspace));
    send({ type: "setMode", mode: modeRef.current });
  }, [bridge.status, send]);

  const onConfigure = useCallback(
    (request: ConfigureRequest) => {
      const next = withWorkspace(request, workspace);
      setConfigure(next);
      setProvider(next.provider);
      setModel(next.model);
      setCatalog((previous) => {
        const shared = previous.map((entry) =>
          entry.provider === next.provider
            ? {
                ...entry,
                ...(next.apiKey !== undefined && next.apiKey.length > 0 ? { apiKey: next.apiKey } : {}),
                ...(next.baseUrl !== undefined && next.baseUrl.length > 0
                  ? { baseUrl: next.baseUrl }
                  : {}),
              }
            : entry,
        );
        if (shared.some((entry) => entry.provider === next.provider && entry.model === next.model)) {
          return shared;
        }
        return [
          ...shared,
          {
            id: `${next.provider}:${next.model}`,
            provider: next.provider,
            model: next.model,
            label: next.model,
            ...(next.apiKey !== undefined && next.apiKey.length > 0 ? { apiKey: next.apiKey } : {}),
            ...(next.baseUrl !== undefined && next.baseUrl.length > 0 ? { baseUrl: next.baseUrl } : {}),
          },
        ];
      });
      setConfigured(false);
      bridge.send(next);
    },
    [bridge, workspace],
  );

  const onSend = useCallback(
    (instruction: string) => {
      const title = instruction.trim().replace(/\s+/g, " ").slice(0, 42) || "新会话";
      setSessions((previous) =>
        previous.map((session) =>
          session.id === activeSessionId ? { ...session, title, updatedAtMs: Date.now() } : session,
        ),
      );
      setConversation((prev) => appendUserInstruction(prev, instruction));
      setRunning(true);
      bridge.send({ type: "run", instruction, mode: modeRef.current });
    },
    [activeSessionId, bridge],
  );

  const onStop = useCallback(() => {
    bridge.send({ type: "stop" });
    setRunning(false);
  }, [bridge]);

  const onNewSession = useCallback((workspaceId?: string) => {
    if (running) bridge.send({ type: "stop" });
    const id = `session-${Date.now()}`;
    const owner = workspaceId ?? activeWorkspaceIdRef.current;
    if (workspaceId !== undefined) {
      activeWorkspaceIdRef.current = workspaceId;
      setActiveWorkspaceId(workspaceId);
    }
    const next: SessionSummary = {
      id,
      title: "新会话",
      updatedAtMs: Date.now(),
      workspaceId: owner,
    };
    setSessions((previous) => [next, ...previous]);
    setSessionConversations((previous) => ({ ...previous, [id]: createConversationState() }));
    setActiveSessionId(id);
    setRunning(false);
    setSelectedId(null);
    setConversation(createConversationState());
    setView("conversation");
    setDetailsOpen(false);
  }, [bridge, running]);

  const onSelectWorkspace = useCallback((id: string) => {
    activeWorkspaceIdRef.current = id;
    setActiveWorkspaceId(id);
  }, []);

  const onSelectSession = useCallback((id: string) => {
    const currentId = sessionsRef.current.find((item) => item.id === id)?.id ?? id;
    saveSessionTranscript(activeSessionId, convRef.current);
    conversationsRef.current = {
      ...conversationsRef.current,
      [activeSessionId]: convRef.current,
    };
    const cached = conversationsRef.current[currentId];
    const next =
      cached !== undefined && cached.nodes.length > 0 ? cached : loadSessionTranscript(currentId);
    conversationsRef.current = { ...conversationsRef.current, [currentId]: next };
    setSessionConversations(conversationsRef.current);
    setActiveSessionId(currentId);
    setConversation(next);
    setSelectedId(null);
    setView("conversation");
    setDetailsOpen(false);
  }, [activeSessionId]);

  const onApprove = useCallback(
    (toolCallId: string, decision: "allow" | "deny", scope?: "once" | "always") => {
      bridge.send({
        type: "approve",
        toolCallId,
        decision,
        ...(scope !== undefined ? { scope } : {}),
      });
      setConversation((prev) => resolveApproval(prev, toolCallId));
    },
    [bridge],
  );

  const onAllowAll = useCallback(() => {
    onApprove("*", "allow");
  }, [onApprove]);

  const onAlwaysAllow = useCallback(() => {
    onApprove("*", "allow", "always");
  }, [onApprove]);

  const onAskUserReply = useCallback(
    (answer: string) => {
      bridge.send({ type: "askUser:reply", answer });
      setConversation((prev) => resolveAskUser(prev, answer));
    },
    [bridge],
  );

  const onDownloadLog = useCallback(() => {
    const log = {
      schema: "cantilune.session-log/v1",
      exportedAt: new Date().toISOString(),
      session: sessions.find((item) => item.id === activeSessionId) ?? DEFAULT_SESSION,
      workspace,
      view,
      mode,
      connection: { provider, model, configured },
      conversation: convRef.current.nodes,
      world,
      swarm: swarmStatus,
      clusterEvents,
    };
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(log, null, 2)], { type: "application/json" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `cantilune-${activeSessionId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }, [
    activeSessionId,
    clusterEvents,
    configured,
    mode,
    model,
    provider,
    sessions,
    view,
    world,
    workspace,
  ]);

  const onRenameWorkspace = useCallback((id: string, name: string) => {
    setWorkspaces((previous) =>
      previous.map((item) => (item.id === id ? { ...item, name } : item)),
    );
  }, []);

  const onDeleteWorkspace = useCallback((id: string) => {
    const remaining = workspacesRef.current.filter((item) => item.id !== id);
    const fallback = remaining[0];
    if (fallback === undefined) return;
    setWorkspaces(remaining);
    setSessions((previous) =>
      previous.map((item) => (item.workspaceId === id ? { ...item, workspaceId: fallback.id } : item)),
    );
    if (activeWorkspaceIdRef.current === id) {
      activeWorkspaceIdRef.current = fallback.id;
      setActiveWorkspaceId(fallback.id);
    }
  }, []);

  const onToggleWorkspace = useCallback((id: string) => {
    setCollapsedWorkspaceIds((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  }, []);

  const onDeleteSession = useCallback(
    (id: string) => {
      const current = sessionsRef.current;
      const remaining = current.filter((session) => session.id !== id);
      const fallback =
        remaining[0] ??
        ({
          id: `session-${Date.now()}`,
          title: "新会话",
          updatedAtMs: Date.now(),
          workspaceId: activeWorkspaceIdRef.current,
        } satisfies SessionSummary);
      const nextSessions = remaining.length > 0 ? remaining : [fallback];
      conversationsRef.current = {
        ...conversationsRef.current,
        [activeSessionId]: convRef.current,
      };
      const nextConversations: Record<string, ConversationState> = { ...conversationsRef.current };
      delete nextConversations[id];
      if (remaining.length === 0) {
        nextConversations[fallback.id] = createConversationState();
      }
      conversationsRef.current = nextConversations;
      sessionsRef.current = nextSessions;
      discardSessionTranscript(id);
      setSessions(nextSessions);
      setSessionConversations(nextConversations);
      if (activeSessionId === id) {
        setActiveSessionId(fallback.id);
        setConversation(nextConversations[fallback.id] ?? createConversationState());
        setSelectedId(null);
        setView("conversation");
        setDetailsOpen(false);
      }
    },
    [activeSessionId],
  );

  const onPickDirectory = useCallback(() => {
    send({ type: "pickWorkspace" });
  }, [send]);

  const onSelectModel = useCallback(
    (entry: CatalogEntry) => {
      setProvider(entry.provider);
      setModel(entry.model);
      const saved = configureRef.current;
      if (saved === undefined) {
        setSettingsTab("models");
        setSettingsOpen(true);
        return;
      }
      const currentWorkspace =
        workspacesRef.current.find((item) => item.id === activeWorkspaceIdRef.current) ??
        workspacesRef.current[0] ??
        DEFAULT_WORKSPACE;
      const next = withWorkspace(
        { ...saved, provider: entry.provider, model: entry.model },
        currentWorkspace,
      );
      setConfigure(next);
      setConfigured(false);
      send(next);
    },
    [send],
  );

  const onModeChange = useCallback(
    (next: typeof mode) => {
      setMode(next);
      send({ type: "setMode", mode: next });
    },
    [send],
  );

  const onApplyPreset = useCallback((nextPreset: ConfigPresetDefaults) => {
    setPreset(nextPreset);
    setSettingsTab("models");
  }, []);

  const openSettings = useCallback((tab: SettingsTab = "general") => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  }, []);

  const selected = useMemo<ConversationNode | null>(() => {
    if (selectedId === null) return null;
    return conversation.nodes.find((node) => node.id === selectedId) ?? null;
  }, [conversation.nodes, selectedId]);

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? DEFAULT_SESSION;

  return (
    <AppFrame
      detailsOpen={detailsOpen}
      overlay={
        settingsOpen ? (
          <SettingsOverlay
            providers={providers}
            configured={configured}
            connectionStatus={bridge.status}
            theme={theme}
            activeTab={settingsTab}
            preset={preset}
            defaults={configure}
            catalog={catalog}
            onTabChange={setSettingsTab}
            onClose={() => setSettingsOpen(false)}
            onThemeChange={setTheme}
            onConfigure={onConfigure}
            onCatalogChange={setCatalog}
            onNewSession={onNewSession}
            workspacePath={workspace.path}
            onDownloadLog={onDownloadLog}
            onApplyPreset={onApplyPreset}
          />
        ) : null
      }
      sidebar={(layout) => (
        <SidebarPanel
          collapsed={layout.collapsed}
          configured={configured}
          connectionStatus={bridge.status}
          sessions={sessions}
          activeSessionId={activeSessionId}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          groupBy={groupBy}
          orderBy={orderBy}
          collapsedWorkspaceIds={collapsedWorkspaceIds}
          onToggle={layout.onToggle}
          onNewSession={onNewSession}
          onSelectSession={onSelectSession}
          onSettings={() => openSettings("general")}
          onRenameWorkspace={onRenameWorkspace}
          onDeleteWorkspace={onDeleteWorkspace}
          onSelectWorkspace={onSelectWorkspace}
          onToggleWorkspace={onToggleWorkspace}
          onGroupByChange={setGroupBy}
          onOrderByChange={setOrderBy}
          onDeleteSession={onDeleteSession}
          onPickDirectory={onPickDirectory}
        />
      )}
      center={
        <ConversationView
          nodes={conversation.nodes}
          onApprove={onApprove}
          onAskUserReply={onAskUserReply}
          onSelectNode={(id) => {
            setSelectedId(id);
            setDetailsOpen(true);
          }}
          view={view}
          mode={mode}
          sessionTitle={activeSession.title}
          workspaceName={workspace.name}
          configured={configured}
          running={running}
          provider={provider}
          model={model}
          catalog={catalog}
          onViewChange={setView}
          onModeChange={onModeChange}
          onDownloadLog={onDownloadLog}
          onOpenDetails={() => setDetailsOpen(true)}
          onOpenSettings={() => openSettings("general")}
          onOpenModelSettings={() => openSettings("models")}
          onSelectModel={onSelectModel}
          onNewSession={onNewSession}
          onSend={onSend}
          onStop={onStop}
          onAllowAll={onAllowAll}
          onAlwaysAllow={onAlwaysAllow}
          onPickWorkspace={onPickDirectory}
        />
      }
      details={
        <DetailsRail
          selected={selected}
          world={world}
          swarmStatus={swarmStatus}
          clusterEvents={clusterEvents}
          onClose={() => {
            setDetailsOpen(false);
            setSelectedId(null);
          }}
          onSwarmStart={() => bridge.send({ type: "swarm:start" })}
          onSwarmStop={() => bridge.send({ type: "swarm:stop" })}
          onSwarmActivate={(agentId, manifest) =>
            bridge.send({ type: "swarm:activate", agentId, manifest })
          }
        />
      }
    />
  );
}
