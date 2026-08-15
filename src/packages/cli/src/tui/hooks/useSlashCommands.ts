import { useCallback, useMemo, useRef } from "react";
import { createFullCommandRegistry } from "../../commands/fullRegistry.js";
import type { CommandRegistry, CommandServices, SlashCommand } from "../../commands/registry.js";
import type { AppStore, ReactiveStore } from "../../store.js";

export interface UseSlashCommandsResult {
  readonly registry: CommandRegistry;
  readonly commands: readonly SlashCommand[];
  readonly find: (input: string) => readonly SlashCommand[];
  readonly execute: (input: string) => Promise<void>;
  readonly names: readonly string[];
}

export interface UseSlashCommandsOptions {
  readonly store: ReactiveStore;
  readonly services?: CommandServices;
}

/**
 * Keys whose value differs between two store snapshots.
 *
 * Command handlers mutate a draft copy, but `CommandServices` callbacks
 * (`notify`, `resetRuntime`, `pick`) write straight to the live store while the
 * handler is still running. Committing the whole draft would roll those writes
 * back — a `/provider` switch would drop its own confirmation notice and
 * re-mark the torn-down runtime as connected. Applying only the keys the
 * handler touched leaves concurrent service writes intact.
 */
export function changedKeys(before: AppStore, after: AppStore): Partial<AppStore> {
  const patch: Record<string, unknown> = {};
  for (const key of Object.keys(after) as (keyof AppStore)[]) {
    if (after[key] !== before[key]) patch[key] = after[key];
  }
  return patch as Partial<AppStore>;
}

/**
 * Bridges the command registry (which mutates a plain `AppStore`) to the
 * reactive store.
 *
 * Handlers get a mutable draft copy; whatever they changed is committed in one
 * update afterwards. This keeps all existing command modules working verbatim
 * while still producing exactly one re-render per command.
 */
export function useSlashCommands({
  store,
  services,
}: UseSlashCommandsOptions): UseSlashCommandsResult {
  const registryRef = useRef<CommandRegistry | null>(null);
  if (registryRef.current === null) {
    const registry = createFullCommandRegistry();
    registry.register({
      name: "/chat",
      description: "Return to chat mode",
      category: "control",
      handler: (_args, draft) => {
        draft.mode = "chat";
        draft.activeView = null;
      },
    });
    registryRef.current = registry;
  }

  const registry = registryRef.current;

  const find = useCallback((input: string) => registry.find(input), [registry]);

  const execute = useCallback(
    async (input: string) => {
      const before = store.get();
      const draft: AppStore = { ...before };
      await registry.execute(input, draft, services);
      const patch = changedKeys(before, draft);
      if (Object.keys(patch).length > 0) store.set(patch);
    },
    [registry, services, store],
  );

  const commands = useMemo(() => registry.getAll(), [registry]);
  const names = useMemo(
    () => commands.map((command) => command.name).sort((a, b) => a.localeCompare(b)),
    [commands],
  );

  return { registry, commands, find, execute, names };
}

export function isSlashInput(input: string): boolean {
  return input.trimStart().startsWith("/");
}

export function slashQueryFromInput(input: string): string {
  const trimmed = input.trimStart();
  if (!trimmed.startsWith("/")) return "";
  return trimmed.slice(1);
}
