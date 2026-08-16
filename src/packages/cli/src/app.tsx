import { join } from "node:path";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, useApp } from "ink";
import { createAdapter, listProviders } from "@cantilune/adapter";
import { ReactiveStore } from "./store.js";
import { ensureCliPrincipal, loadConfig, updateConfig, type CliConfig } from "./config.js";
import type { CommandServices } from "./commands/registry.js";
import { buildLlmConfig } from "./runtimeSync.js";
import { createClusterController, type ClusterController } from "./wiring/clusterControl.js";
import { createSwarmController, type SwarmController } from "./wiring/swarmControl.js";
import { startLiveSupervisors } from "./wiring/startLiveSupervisors.js";
import { getControlPlaneController } from "./wiring/controlPlaneControl.js";
import { createEvalController, type EvalController } from "./wiring/evalControl.js";
import { createPetriController } from "./wiring/petriControl.js";
import { createObserveController } from "./wiring/observeControl.js";
import { createReplayController } from "./wiring/replayControl.js";
import { createCliToolSet } from "./wiring/cliToolSet.js";
import {
  assertRequiredHostCapabilities,
  probeHostCapabilities,
} from "./wiring/hostCapabilities.js";
import { ChatPanel } from "./tui/ChatPanel.js";
import { groupTranscript, turnKey } from "./tui/transcriptItems.js";
import { StatusBar } from "./tui/StatusBar.js";
import { InputBar } from "./tui/InputBar.js";
import { AskPanel } from "./tui/AskPanel.js";
import { ViewContainer } from "./tui/ViewContainer.js";
import { PickerPanel, type PickerOption } from "./tui/PickerPanel.js";
import { ConfirmDialog } from "./tui/ConfirmDialog.js";
import { ApprovalDialog } from "./tui/ApprovalDialog.js";
import { ObservePanel } from "./tui/ObservePanel.js";
import { useSlashCommands, isSlashInput } from "./tui/hooks/useSlashCommands.js";
import { useAgentLoop } from "./tui/hooks/useAgentLoop.js";
import { useKeyboard } from "./tui/hooks/useKeyboard.js";
import {
  createSessionWorldBinding,
  useSession,
  type SessionWorldBinding,
} from "./tui/hooks/useSession.js";
import { useTerminalSize } from "./tui/hooks/useTerminalSize.js";
import { StoreProvider, useAppStore, useStoreHandle } from "./storeContext.js";
import { ThemeProvider } from "./theme/themeContext.js";
import { Divider } from "./tui/Divider.js";
import { chatBodyHeight, dialogReserveRows, paletteVisibleRows } from "./tui/layoutBudget.js";
import { modeAfterCommand, readConfirmMessage } from "./tui/commandMode.js";

export interface AppProps {
  readonly provider?: string;
  readonly model?: string;
  readonly baseUrl?: string;
}

/** Below this width the observe panel would squeeze the transcript too hard. */
const MIN_WIDTH_FOR_SIDEBAR = 90;

interface PendingPick {
  readonly title: string;
  readonly options: readonly PickerOption[];
  readonly resolve: (id: string | null) => void;
}

/**
 * Build the optional `options` prop for {@link AskPanel} without an inline
 * conditional spread, which keeps the JSX free of a nested ternary.
 */
function askOptionsProp(
  options: readonly string[] | undefined,
): { readonly options: readonly string[] } | Record<string, never> {
  return options === undefined ? {} : { options };
}

export function App(props: AppProps): React.ReactElement {
  const storeRef = useRef<ReactiveStore | null>(null);
  storeRef.current ??= new ReactiveStore({
    ...(props.provider !== undefined ? { provider: props.provider } : {}),
    ...(props.model !== undefined ? { model: props.model } : {}),
    ...(props.baseUrl !== undefined ? { baseUrl: props.baseUrl } : {}),
  });

  return (
    <StoreProvider store={storeRef.current}>
      <ThemedShell {...props} />
    </StoreProvider>
  );
}

/**
 * Bridges store state into the theme context.
 *
 * The theme lives in the store so `/theme` can change it live, but every
 * component reads it through {@link ThemeProvider} rather than threading it
 * down as a prop.
 */
function ThemedShell(props: AppProps): React.ReactElement {
  const { theme } = useAppStore();
  return (
    <ThemeProvider name={theme ?? undefined}>
      <AppBody {...props} />
    </ThemeProvider>
  );
}

function AppBody({ provider, model, baseUrl }: AppProps): React.ReactElement {
  const store = useStoreHandle();
  const state = useAppStore();
  const { exit } = useApp();
  const { columns, rows } = useTerminalSize();

  const { restoreFor, save, loaded, loadError } = useSession();
  /** Generation that authorized the conversational rows currently in the store. */
  const [sessionSeedWorld, setSessionSeedWorld] = useState<SessionWorldBinding | null>(null);
  const [inputHistory, setInputHistory] = useState<string[]>([]);
  const [configured, setConfigured] = useState(false);
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [expandedTurns, setExpandedTurns] = useState<readonly number[]>([]);
  const [overlayRows, setOverlayRows] = useState(0);

  // Hydrate persisted config once, letting explicit CLI flags win.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedConfig: CliConfig = await loadConfig();
        if (cancelled) return;
        await assertRequiredHostCapabilities();
        if (cancelled) return;
        const config = await ensureCliPrincipal(loadedConfig);
        if (cancelled) return;
        cliConfigRef.current = config;
        store.set({
          provider: provider ?? config.provider,
          model: model ?? config.model,
          baseUrl: baseUrl ?? config.baseUrl,
          layout: config.layout ?? "focus",
          theme: config.theme ?? null,
          durable: config.durable ?? "file",
          storagePath: config.storagePath,
          principalId: config.principalId,
          compatibleEpochIds: config.compatibleEpochIds,
          maxTurns: config.maxTurns,
          contractProvider: config.contractProvider,
          contractModel: config.contractModel,
          judgeProvider: config.judgeProvider,
          judgeModel: config.judgeModel,
          judgeQuorumModels: config.judgeQuorumModels,
          mcpServers: config.mcpServers,
          searchProvider: config.searchProvider,
        });
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : String(error);
        store.set({ notice: { level: "error", text: message } });
      } finally {
        if (!cancelled) setConfigured(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store, provider, model, baseUrl]);

  // This is the binding used for one hydration decision, not a live runtime
  // guard. useAgentLoop independently re-reads durable identity before every
  // start so unrelated renders cannot silently relabel an existing transcript.
  const sessionWorld = useMemo(
    () =>
      createSessionWorldBinding({
        durable: state.durable,
        ...(state.storagePath !== undefined ? { storagePath: state.storagePath } : {}),
        ...(state.principalId !== undefined ? { principalId: state.principalId } : {}),
      }),
    [state.durable, state.principalId, state.storagePath],
  );
  const savedSession = restoreFor(sessionWorld);

  // Restore only after configuration is known and only from the exact same
  // durable/path/principal world. Legacy unbound files deliberately fail closed.
  useEffect(() => {
    if (loaded && configured && savedSession !== null) {
      setSessionSeedWorld(sessionWorld);
      if (store.get().session.messages.length === 0 && savedSession.session.messages.length > 0) {
        store.set({ session: savedSession.session });
      }
    }
  }, [configured, loaded, savedSession, sessionWorld, store]);

  useEffect(() => {
    if (loaded && loadError !== null) {
      store.set({ notice: { level: "error", text: loadError } });
    }
  }, [loadError, loaded, store]);

  const persistCurrentSession = useCallback(
    async (
      expectedWorld: SessionWorldBinding | null,
      history: ReturnType<ReturnType<typeof useAgentLoop>["privateHistory"]>,
    ): Promise<void> => {
      const current = store.get();
      if (expectedWorld === null) {
        // Memory worlds are intentionally process-local; skipping persistence
        // is their normal contract. A file session without prior seed/runtime
        // authority must not be labelled from a fresh identity read here.
        if (current.durable === "file") {
          store.set({
            notice: {
              level: "warn",
              text: "Private transcript was not persisted because no verified session-world authority is available.",
            },
          });
        }
        return;
      }
      if (history === null) {
        throw new Error("Private history is unavailable; refusing to persist a UI-only transcript");
      }
      await save(current.session, history, expectedWorld);
      setSessionSeedWorld(expectedWorld);
    },
    [save, store],
  );

  const invalidateSessionSeed = useCallback(() => {
    setSessionSeedWorld(null);
  }, []);
  const checkpointPrivateHistory = useCallback(
    async (
      history: NonNullable<ReturnType<ReturnType<typeof useAgentLoop>["privateHistory"]>>,
      world: SessionWorldBinding,
    ) => {
      await save(store.get().session, history, world);
      setSessionSeedWorld(world);
    },
    [save, store],
  );
  const {
    running,
    start,
    abort,
    stop,
    sessionWorld: currentSessionWorld,
    privateHistory: currentPrivateHistory,
    isolateSession,
    prepare,
    runtimeBackends,
  } = useAgentLoop({
    store,
    sessionSeedWorld,
    sessionSeedHistory: savedSession?.history ?? null,
    onSessionSeedInvalidated: invalidateSessionSeed,
    onHistoryCheckpoint: checkpointPrivateHistory,
  });

  // Single cluster supervisor controller for the App lifecycle (ADR-0015). It
  // is lazily built on first /cluster use and re-reads the live runtime
  // backends each call so a reboot rebinds it without leaking a supervisor.
  const clusterControllerRef = useRef<ClusterController | null>(null);

  // Single multi-agent swarm controller for the App lifecycle (ADR-0019). Lazily
  // built on first /swarm use and re-reads the live runtime backends each call
  // so a reboot rebinds it without leaking a swarm supervisor + agent pool.
  const swarmControllerRef = useRef<SwarmController | null>(null);
  const cliConfigRef = useRef<CliConfig | null>(null);

  // Single evaluation controller for the App lifecycle (ADR-0011). Lazily built
  // on first /eval use from the CLI LLM adapter + in-memory eval ports. It does
  // not depend on the runtime handle, so it survives a reboot; reset clears it
  // so a new run sequence starts from an empty run store.
  const evalControllerRef = useRef<EvalController | null>(null);

  const persistVerifiedSession = useCallback(async (): Promise<void> => {
    try {
      await persistCurrentSession(currentSessionWorld(), currentPrivateHistory());
    } catch (error) {
      // Saving is a separate authority boundary from running. In particular,
      // a bundle may be replaced after start()'s post-run check. Isolate the
      // cached OS and seed immediately; never leave the stale transcript live.
      const message = error instanceof Error ? error.message : String(error);
      await isolateSession(message);
      store.appendMessage({ role: "error", content: message, timestamp: Date.now() });
      store.set({ notice: { level: "error", text: message } });
    }
  }, [currentPrivateHistory, currentSessionWorld, isolateSession, persistCurrentSession, store]);

  const services = useMemo<CommandServices>(
    () => ({
      persistConfig: async (patch) => {
        await updateConfig(patch);
      },
      resetRuntime: async (mode) => {
        // Stop any running cluster supervisor before the runtime it reads is
        // torn down, so its feed-drain timers do not fire against a dead world.
        clusterControllerRef.current?.stop();
        clusterControllerRef.current = null;
        // Stop any running swarm supervisor before the runtime it reads is torn
        // down, so its feed-drain + heartbeat timers do not fire against a dead
        // world (governed E-Stop; the per-agent CantilunOS pool is aborted).
        swarmControllerRef.current?.stop();
        swarmControllerRef.current = null;
        // Drop the eval controller so a new run sequence starts from an empty
        // run store; the in-memory ports die with the controller.
        evalControllerRef.current = null;
        await stop(mode);
      },
      exit,
      notify: (level, text) => {
        store.set({ notice: { level, text } });
      },
      listProviders: () =>
        listProviders().map((entry) => ({
          id: entry.slug,
          label: `${entry.slug}  ${entry.tier}`,
        })),
      pick: (title, options) =>
        new Promise<string | null>((resolve) => {
          store.set({ mode: "picker" });
          setPendingPick({ title, options, resolve });
        }),
      contentStore: () => runtimeBackends().contentStore,
      clusterControl: () => {
        const backends = runtimeBackends();
        // No runtime handle yet — there is nothing to control.
        if (backends.syscallRuntime === undefined) return undefined;
        // One controller per App lifecycle, bound to whatever runtime the
        // handle currently owns (re-read on each call so a reboot rebinds it).
        const llmFactory = () => {
          const state = store.get();
          return createAdapter(buildLlmConfig(state.provider, state.model, state.baseUrl));
        };
        clusterControllerRef.current ??= createClusterController(
          () => ({
            contentStore: runtimeBackends().contentStore,
            syscallRuntime: runtimeBackends().syscallRuntime,
            storagePath: runtimeBackends().storagePath,
          }),
          llmFactory,
          () => swarmControllerRef.current ?? undefined,
        );
        return clusterControllerRef.current;
      },
      swarmControl: () => {
        const backends = runtimeBackends();
        // No runtime handle yet — there is nothing to control.
        if (backends.syscallRuntime === undefined) return undefined;
        // One swarm controller per App lifecycle, bound to whatever runtime the
        // handle currently owns (re-read on each call so a reboot rebinds it).
        const llmFactory = () => {
          const state = store.get();
          return createAdapter(buildLlmConfig(state.provider, state.model, state.baseUrl));
        };
        swarmControllerRef.current ??= createSwarmController(
          () => ({
            contentStore: runtimeBackends().contentStore,
            syscallRuntime: runtimeBackends().syscallRuntime,
            storagePath: runtimeBackends().storagePath,
          }),
          llmFactory,
          cliConfigRef.current ?? undefined,
        );
        return swarmControllerRef.current;
      },
      controlPlane: () => {
        const { durable, storagePath } = store.get();
        return getControlPlaneController({
          ephemeral: durable === "memory",
          ...(storagePath !== undefined ? { storagePath } : {}),
        });
      },
      evalControl: () => {
        // File-durable eval store under storagePath/eval; fail-closed C9.
        const llmFactory = () => {
          const state = store.get();
          return createAdapter(buildLlmConfig(state.provider, state.model, state.baseUrl));
        };
        const { storagePath } = store.get();
        evalControllerRef.current ??= createEvalController(llmFactory, {
          ...(storagePath !== undefined ? { evalStoreDir: join(storagePath, "eval") } : {}),
        });
        return evalControllerRef.current;
      },
      petriControl: () => {
        // The Petri engine is pure and read-only over the runtime snapshot
        // (ADR-0017); no runtime handle or LLM is needed. One stateless
        // controller for the App lifecycle.
        return createPetriController();
      },
      observeControl: () => {
        const backends = runtimeBackends();
        if (backends.coordinationRuntime === undefined) return undefined;
        return createObserveController({
          coordinationRuntime: () => runtimeBackends().coordinationRuntime,
          getSnapshot: (ref) => runtimeBackends().getSnapshot?.(ref),
        });
      },
      replayControl: () => {
        const backends = runtimeBackends();
        if (backends.coordinationRuntime === undefined) return undefined;
        return createReplayController({
          coordinationRuntime: () => runtimeBackends().coordinationRuntime,
        });
      },
      getSnapshot: (ref) => runtimeBackends().getSnapshot?.(ref),
      headSnapshotRef: () => runtimeBackends().headSnapshotRef?.(),
      summarizeCompact: async (droppedText) => {
        const current = store.get();
        const provider = current.contractProvider ?? current.judgeProvider;
        const model = current.contractModel ?? current.judgeModel;
        if (provider === undefined || model === undefined) {
          return undefined;
        }
        const adapter = createAdapter(buildLlmConfig(provider, model, current.baseUrl));
        const result = await adapter.chat({
          messages: [
            {
              role: "user",
              content: `Summarize the following dropped conversation turns in at most 8 sentences. Do not invent tools or outcomes.\n\n${droppedText}`,
            },
          ],
          tools: [],
        });
        const text = result.text?.trim();
        return text !== undefined && text.length > 0 ? text : undefined;
      },
      probeHost: () => probeHostCapabilities(),
      listInjectedTools: async () => {
        const current = store.get();
        const { tools } = createCliToolSet({
          workingDirectory: process.cwd(),
          ...(current.mcpServers !== undefined ? { mcpServers: current.mcpServers } : {}),
          ...(current.searchProvider !== undefined
            ? { searchProvider: current.searchProvider }
            : {}),
        });
        const listed = await tools.listTools();
        return listed.map((tool) => ({ name: tool.name, description: tool.description }));
      },
    }),
    [exit, stop, store, runtimeBackends],
  );

  const { commands, execute } = useSlashCommands({ store, services });

  const bringUpSupervisors = useCallback((): void => {
    const result = startLiveSupervisors(services.swarmControl?.(), services.clusterControl?.());
    if (result.ok) {
      store.set({
        notice: { level: "info", text: result.message ?? "cluster and swarm supervisors are live" },
      });
      return;
    }
    if (result.message !== undefined) {
      store.set({ notice: { level: "warn", text: result.message } });
    }
  }, [services, store]);

  useEffect(() => {
    if (!configured || !loaded || loadError !== null) return;
    let cancelled = false;
    void (async () => {
      const ready = await prepare();
      if (cancelled || !ready) return;
      bringUpSupervisors();
    })();
    return () => {
      cancelled = true;
    };
  }, [bringUpSupervisors, configured, loadError, loaded, prepare]);

  useKeyboard(store, {
    onAbort: abort,
    onScroll: (delta) => {
      const itemCount = groupTranscript(state.session.messages).length;
      setScrollOffset((current) =>
        Math.max(0, Math.min(Math.max(0, itemCount - 1), current + delta)),
      );
    },
    onScrollReset: () => {
      setScrollOffset(0);
    },
    onToggleActivity: () => {
      const items = groupTranscript(store.get().session.messages);
      const last = [...items].reverse().find((item) => item.kind === "turn");
      if (last === undefined) return;
      const id = turnKey(last);
      setExpandedTurns((prev) =>
        prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id],
      );
    },
    enabled:
      state.mode !== "confirm" &&
      state.mode !== "picker" &&
      state.mode !== "ask" &&
      state.mode !== "approve",
  });

  const handleCommandExecute = useCallback(
    async (input: string) => {
      try {
        await execute(input);
        const next = store.get();
        const mode = modeAfterCommand(next.mode, next.activeView);
        if (mode !== next.mode) {
          store.set({ mode: mode as typeof next.mode });
        }
      } catch (error) {
        store.appendMessage({
          role: "error",
          content: error instanceof Error ? error.message : String(error),
          timestamp: Date.now(),
        });
        store.set({ mode: "chat" });
      }
      await persistVerifiedSession();
    },
    [execute, persistVerifiedSession, store],
  );

  /**
   * Routes one prompt submission.
   *
   * `InputBar` decides when a slash command is complete enough to run, so by
   * the time text arrives here the only question is command versus chat.
   */
  const handleSubmit = useCallback(
    async (value: string) => {
      setInputHistory((prev) => [...prev, value]);
      setScrollOffset(0);

      if (isSlashInput(value)) {
        await handleCommandExecute(value);
        return;
      }

      store.set({ mode: "chat" });
      await start(value);
      bringUpSupervisors();
      await persistVerifiedSession();
    },
    [bringUpSupervisors, handleCommandExecute, persistVerifiedSession, start, store],
  );

  const resolvePick = useCallback(
    (id: string | null) => {
      pendingPick?.resolve(id);
      setPendingPick(null);
      const next = store.get();
      store.set({ mode: next.activeView !== null ? "view" : "chat" });
    },
    [pendingPick, store],
  );

  // The confirm prompt is derived from the store rather than from local state.
  // It used to be held in a `useState` that nothing ever set, so `/quit` — which
  // sets `mode: "confirm"` and puts its message in `viewArgs` — rendered no
  // dialog while confirm mode disabled both the input bar and the global
  // keybindings. That left the TUI frozen with no way out but Ctrl+C.
  const confirmMessage = readConfirmMessage(state.mode, state.viewArgs);

  const showSidebar = state.layout === "observe" && columns >= MIN_WIDTH_FOR_SIDEBAR;
  const sidebarWidth = showSidebar ? Math.min(38, Math.floor(columns * 0.32)) : 0;
  const mainWidth = columns - sidebarWidth;
  const hasNotice = state.notice !== null;
  const bodyHeight = chatBodyHeight({
    rows,
    notice: hasNotice,
    overlayRows,
    dialogRows: dialogReserveRows(state.mode),
  });
  const suggestionRows = paletteVisibleRows(rows, hasNotice);
  const participants = state.runtime.snapshot?.participants.length ?? 0;
  const handleOverlayRows = useCallback((next: number) => {
    setOverlayRows((prev) => (prev === next ? prev : next));
  }, []);

  return (
    <Box flexDirection="column" width={columns} height={rows} overflow="hidden">
      <Box flexDirection="column" flexShrink={0} width={columns} overflow="hidden">
        <StatusBar
          provider={state.provider}
          model={state.model}
          session={state.session}
          maxTurns={state.maxTurns ?? 200}
          phase={state.phase}
          layout={state.layout}
          connected={state.connected}
          notice={state.notice}
          participants={Math.max(1, participants)}
          width={columns}
        />

        <Box paddingX={1}>
          <Divider width={Math.max(0, columns - 2)} />
        </Box>
      </Box>

      <Box flexDirection="row" width={columns} height={bodyHeight} overflow="hidden" flexShrink={0}>
        <Box flexDirection="column" width={mainWidth} height={bodyHeight} overflow="hidden">
          {state.mode === "view" && state.activeView !== null ? (
            <ViewContainer activeView={state.activeView} viewArgs={state.viewArgs} />
          ) : (
            <ChatPanel
              messages={state.session.messages}
              height={bodyHeight}
              width={mainWidth - 2}
              detail={state.layout}
              scrollOffset={scrollOffset}
              expandedTurns={expandedTurns}
            />
          )}
        </Box>

        {showSidebar ? (
          <ObservePanel
            runtime={state.runtime}
            phase={state.phase}
            width={sidebarWidth}
            height={bodyHeight}
          />
        ) : null}
      </Box>

      {state.mode === "picker" && pendingPick !== null ? (
        <PickerPanel
          title={pendingPick.title}
          options={pendingPick.options}
          onSelect={(option) => {
            resolvePick(option.id);
          }}
          onCancel={() => {
            resolvePick(null);
          }}
        />
      ) : null}

      {state.mode === "ask" && state.pendingAsk !== null ? (
        <AskPanel
          question={state.pendingAsk.question}
          {...askOptionsProp(state.pendingAsk.options)}
          onAnswer={(reply) => {
            state.pendingAsk?.answer(reply);
          }}
        />
      ) : null}

      {state.mode === "approve" && state.pendingApproval !== null ? (
        <ApprovalDialog
          request={state.pendingApproval.request}
          onDecide={(choice) => {
            state.pendingApproval?.decide(choice);
          }}
          width={columns}
        />
      ) : null}

      {confirmMessage !== null ? (
        <ConfirmDialog
          message={confirmMessage}
          onConfirm={() => {
            void (async () => {
              try {
                clusterControllerRef.current?.stop();
                swarmControllerRef.current?.stop();
                await stop("preserve");
              } finally {
                exit();
              }
            })();
          }}
          onCancel={() => {
            store.set({ mode: "chat", viewArgs: {} });
          }}
        />
      ) : null}

      <InputBar
        disabled={
          !loaded ||
          loadError !== null ||
          !configured ||
          running ||
          state.mode === "confirm" ||
          state.mode === "picker" ||
          state.mode === "ask" ||
          state.mode === "approve"
        }
        history={inputHistory}
        commands={commands}
        width={columns}
        suggestionRows={suggestionRows}
        onOverlayRows={handleOverlayRows}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
