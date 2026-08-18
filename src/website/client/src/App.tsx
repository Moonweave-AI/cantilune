/** Cantilune website harness UI — the browser is the view/control surface. */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  ClusterEventWire,
  ConfigureRequest,
  ServerMessage,
  SwarmStatusWire,
  WorldSnapshotWire,
} from "@shared/protocol";
import { useBridge } from "./ws/useBridge";
import { AppFrame } from "./shell/AppFrame";
import { DetailsRail } from "./shell/DetailsRail";
import { SidebarPanel, type SessionSummary, type WorkspaceSummary } from "./shell/SidebarPanel";
import type { ConfigPresetDefaults, ProviderEntryWire } from "./config/ConfigPanel";
import { SettingsOverlay, type SettingsTab } from "./settings/SettingsOverlay";
import { ConversationView } from "./conversation/ConversationView";
import { Composer } from "./conversation/Composer";
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
import "./theme/tokens.css";

type SessionView = "conversation" | "trajectory";
type RunMode = "execute" | "plan" | "observe";
export type ThemePreference = "dark" | "light" | "system";

const initialSession: SessionSummary = {
  id: "session-1",
  title: "New session",
  updatedAt: "Just now",
};
const initialWorkspace: WorkspaceSummary = {
  id: "workspace-1",
  name: "Cantilune workspace",
  path: ".",
};

export function App(): JSX.Element {
  const [conversation, setConversation] = useState<ConversationState>(() =>
    createConversationState(),
  );
  const [sessionConversations, setSessionConversations] = useState<
    Readonly<Record<string, ConversationState>>
  >({ [initialSession.id]: createConversationState() });
  const [providers, setProviders] = useState<readonly ProviderEntryWire[]>([]);
  const [configured, setConfigured] = useState(false);
  const [running, setRunning] = useState(false);
  const [theme, setTheme] = useState<ThemePreference>("dark");
  const [provider, setProvider] = useState<string | undefined>(undefined);
  const [model, setModel] = useState<string | undefined>(undefined);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [world, setWorld] = useState<WorldSnapshotWire | null>(null);
  const [swarmStatus, setSwarmStatus] = useState<SwarmStatusWire | null>(null);
  const [clusterEvents, setClusterEvents] = useState<readonly ClusterEventWire[]>([]);
  const [sessions, setSessions] = useState<readonly SessionSummary[]>([initialSession]);
  const [activeSessionId, setActiveSessionId] = useState(initialSession.id);
  const [workspace, setWorkspace] = useState<WorkspaceSummary>(initialWorkspace);
  const [view, setView] = useState<SessionView>("conversation");
  const [mode, setMode] = useState<RunMode>("execute");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [preset, setPreset] = useState<ConfigPresetDefaults | undefined>(undefined);

  const convRef = useRef(conversation);
  convRef.current = conversation;

  useEffect(() => {
    setSessionConversations((previous) => ({ ...previous, [activeSessionId]: conversation }));
  }, [activeSessionId, conversation]);

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const resolved = theme === "system" ? (media.matches ? "dark" : "light") : theme;
      document.body.dataset.clnTheme = resolved;
    };
    apply();
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
    }
  }, []);

  const bridge = useBridge(handleMessage);

  const onConfigure = useCallback(
    (request: ConfigureRequest) => {
      setProvider(request.provider);
      setModel(request.model);
      setConfigured(false);
      setConversation(createConversationState());
      bridge.send(request);
    },
    [bridge],
  );

  const onSend = useCallback(
    (instruction: string) => {
      const title = instruction.trim().replace(/\s+/g, " ").slice(0, 42) || "New session";
      setSessions((previous) =>
        previous.map((session) =>
          session.id === activeSessionId ? { ...session, title, updatedAt: "Just now" } : session,
        ),
      );
      setConversation((prev) => appendUserInstruction(prev, instruction));
      setRunning(true);
      bridge.send({ type: "run", instruction });
    },
    [activeSessionId, bridge],
  );

  const onStop = useCallback(() => {
    bridge.send({ type: "stop" });
    setRunning(false);
  }, [bridge]);

  const onNewSession = useCallback(() => {
    if (running) bridge.send({ type: "stop" });
    const id = `session-${Date.now()}`;
    setSessions((previous) => [{ id, title: "New session", updatedAt: "Just now" }, ...previous]);
    setSessionConversations((previous) => ({ ...previous, [id]: createConversationState() }));
    setActiveSessionId(id);
    setRunning(false);
    setSelectedId(null);
    setConversation(createConversationState());
    setView("conversation");
  }, [bridge, running]);

  const onSelectSession = useCallback(
    (id: string) => {
      setActiveSessionId(id);
      setConversation(sessionConversations[id] ?? createConversationState());
      setSelectedId(null);
      setView("conversation");
    },
    [sessionConversations],
  );

  const onApprove = useCallback(
    (toolCallId: string, decision: "allow" | "deny") => {
      bridge.send({ type: "approve", toolCallId, decision });
      setConversation((prev) => resolveApproval(prev, toolCallId));
    },
    [bridge],
  );

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
      session: sessions.find((item) => item.id === activeSessionId) ?? initialSession,
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

  const onAddWorkspace = useCallback((name: string, path: string) => {
    setWorkspace({ id: `workspace-${Date.now()}`, name, path });
  }, []);

  const onApplyPreset = useCallback((nextPreset: ConfigPresetDefaults) => {
    setPreset(nextPreset);
    setSettingsTab("models");
  }, []);

  const selected = useMemo<ConversationNode | null>(() => {
    if (selectedId === null) return null;
    return conversation.nodes.find((node) => node.id === selectedId) ?? null;
  }, [conversation.nodes, selectedId]);

  const activeSession = sessions.find((item) => item.id === activeSessionId) ?? initialSession;

  return (
    <AppFrame
      detailsVisible={view !== "trajectory"}
      sidebar={
        <SidebarPanel
          configured={configured}
          connectionStatus={bridge.status}
          sessions={sessions}
          activeSessionId={activeSessionId}
          workspace={workspace}
          onNewSession={onNewSession}
          onSelectSession={onSelectSession}
          onSettings={() => setSettingsOpen(true)}
          onAddWorkspace={onAddWorkspace}
        />
      }
      center={
        <>
          <ConversationView
            nodes={conversation.nodes}
            onApprove={onApprove}
            onAskUserReply={onAskUserReply}
            onSelectNode={setSelectedId}
            view={view}
            mode={mode}
            sessionTitle={activeSession.title}
            onViewChange={setView}
            onModeChange={setMode}
            onDownloadLog={onDownloadLog}
          />
          <Composer
            configured={configured}
            running={running}
            provider={provider}
            model={model}
            empty={conversation.nodes.length === 0}
            onSend={onSend}
            onStop={onStop}
          />
          {settingsOpen && (
            <SettingsOverlay
              providers={providers}
              configured={configured}
              connectionStatus={bridge.status}
              theme={theme}
              activeTab={settingsTab}
              preset={preset}
              onTabChange={setSettingsTab}
              onClose={() => setSettingsOpen(false)}
              onThemeChange={setTheme}
              onConfigure={onConfigure}
              onNewSession={onNewSession}
              workspacePath={workspace.path}
              onDownloadLog={onDownloadLog}
              onApplyPreset={onApplyPreset}
            />
          )}
        </>
      }
      details={
        <DetailsRail
          selected={selected}
          world={world}
          swarmStatus={swarmStatus}
          clusterEvents={clusterEvents}
          dark={theme === "dark"}
          onThemeToggle={() => setTheme(theme === "dark" ? "light" : "dark")}
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
