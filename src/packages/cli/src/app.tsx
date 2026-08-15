import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Box, useApp } from "ink";
import { createAdapter, listProviders } from "@cantilune/adapter";
import { ReactiveStore } from "./store.js";
import { ensureCliPrincipal, loadConfig, updateConfig, type CliConfig } from "./config.js";
import type { CommandServices } from "./commands/registry.js";
import { buildLlmConfig } from "./runtimeSync.js";
import { createClusterController, type ClusterController } from "./wiring/clusterControl.js";
import { createSwarmController, type SwarmController } from "./wiring/swarmControl.js";
import { getControlPlaneController } from "./wiring/controlPlaneControl.js";
import { createEvalController, type EvalController } from "./wiring/evalControl.js";
import { createPetriController } from "./wiring/petriControl.js";
import { ChatPanel } from "./tui/ChatPanel.js";
import { StatusBar } from "./tui/StatusBar.js";
import { InputBar } from "./tui/InputBar.js";
import { AskPanel } from "./tui/AskPanel.js";
import { ViewContainer } from "./tui/ViewContainer.js";
import { PickerPanel, type PickerOption } from "./tui/PickerPanel.js";
import { ConfirmDialog } from "./tui/ConfirmDialog.js";
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

export interface AppProps {
  readonly provider?: string;
  readonly model?: string;
  readonly baseUrl?: string;
}

/**
 * Rows consumed by chrome: status line, divider, the bordered input box, and
 * the hint line beneath it. Over-reserving is much cheaper than the transcript
 * pushing the prompt off-screen.
 */
const CHROME_ROWS = 9;
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
  const [confirmMessage, setConfirmMessage] = useState<string | null>(null);
  const [pendingPick, setPendingPick] = useState<PendingPick | null>(null);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Hydrate persisted config once, letting explicit CLI flags win.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const loadedConfig: CliConfig = await loadConfig();
        if (cancelled) return;
        const config = await ensureCliPrincipal(loadedConfig);
        if (cancelled) return;
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
        );
        return swarmControllerRef.current;
      },
      controlPlane: () => getControlPlaneController(),
      evalControl: () => {
        // The eval harness uses in-memory ports; it does not need a runtime
        // handle, but it shares the CLI's configured LLM adapter so /eval run
        // makes a real governed call (not a new egress path).
        const llmFactory = () => {
          const state = store.get();
          return createAdapter(buildLlmConfig(state.provider, state.model, state.baseUrl));
        };
        evalControllerRef.current ??= createEvalController(llmFactory);
        return evalControllerRef.current;
      },
      petriControl: () => {
        // The Petri engine is pure and read-only over the runtime snapshot
        // (ADR-0017); no runtime handle or LLM is needed. One stateless
        // controller for the App lifecycle.
        return createPetriController();
      },
    }),
    [exit, stop, store, runtimeBackends],
  );

  const { commands, execute } = useSlashCommands({ store, services });

  useKeyboard(store, {
    onAbort: abort,
    onScroll: (delta) => {
      setScrollOffset((current) =>
        Math.max(0, Math.min(state.session.messages.length - 1, current + delta)),
      );
    },
    onScrollReset: () => {
      setScrollOffset(0);
    },
    enabled: state.mode !== "confirm" && state.mode !== "picker" && state.mode !== "ask",
  });

  const handleCommandExecute = useCallback(
    async (input: string) => {
      try {
        await execute(input);
        // A command that opened a picker owns the mode until it resolves.
        if (store.get().mode !== "picker") {
          const next = store.get();
          store.set({ mode: next.activeView !== null ? "view" : "chat" });
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
      await persistVerifiedSession();
    },
    [handleCommandExecute, persistVerifiedSession, start, store],
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

  const showSidebar = state.layout === "observe" && columns >= MIN_WIDTH_FOR_SIDEBAR;
  const sidebarWidth = showSidebar ? Math.min(38, Math.floor(columns * 0.32)) : 0;
  const mainWidth = columns - sidebarWidth;
  const bodyHeight = Math.max(6, rows - CHROME_ROWS);
  const participants = state.runtime.snapshot?.participants.length ?? 0;

  return (
    <Box flexDirection="column" width={columns}>
      <StatusBar
        provider={state.provider}
        model={state.model}
        session={state.session}
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

      <Box flexDirection="row" flexGrow={1}>
        <Box flexDirection="column" width={mainWidth} flexGrow={1}>
          {state.mode === "view" && state.activeView !== null ? (
            <ViewContainer activeView={state.activeView} viewArgs={state.viewArgs} />
          ) : (
            <ChatPanel
              messages={state.session.messages}
              height={bodyHeight}
              width={mainWidth - 2}
              detail={state.layout}
              scrollOffset={scrollOffset}
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

      {state.mode === "confirm" && confirmMessage !== null ? (
        <ConfirmDialog
          message={confirmMessage}
          onConfirm={() => {
            exit();
          }}
          onCancel={() => {
            store.set({ mode: "chat" });
            setConfirmMessage(null);
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
          state.mode === "ask"
        }
        history={inputHistory}
        commands={commands}
        width={columns}
        onSubmit={handleSubmit}
      />
    </Box>
  );
}
