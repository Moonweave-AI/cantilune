import { useInput, useApp, type Key } from "ink";
import type { AppStore, ReactiveStore } from "../../store.js";

export interface KeyboardHandlers {
  readonly onAbort?: () => void;
  readonly onScroll?: (delta: number) => void;
  readonly onScrollReset?: () => void;
  /** Expand or collapse the newest turn's tool / lifecycle stack. */
  readonly onToggleActivity?: () => void;
  readonly enabled?: boolean;
}

/**
 * Global shortcuts that apply regardless of which panel has focus.
 *
 * Ctrl+C interrupts a run rather than killing the process — matching Claude
 * Code, where quitting is an explicit Ctrl+D. A second Ctrl+C while idle exits.
 *
 * Deliberately claims no printable characters: `/` used to open the command
 * palette from here, which fired even mid-sentence and left the input bar and
 * the palette both interpreting the following keystrokes.
 */
export function useKeyboard(store: ReactiveStore, handlers: KeyboardHandlers = {}): void {
  const { exit } = useApp();
  const enabled = handlers.enabled ?? true;

  const handleCtrl = (input: string, state: AppStore): boolean => {
    if (input === "c") {
      if (state.agentRunning) {
        handlers.onAbort?.();
      } else {
        exit();
      }
      return true;
    }
    if (input === "d") {
      exit();
      return true;
    }
    // Ctrl+O flips between the focus and observe layouts.
    if (input === "o") {
      store.set({ layout: state.layout === "focus" ? "observe" : "focus" });
      return true;
    }
    // Ctrl+T expands the newest turn's activity. Ctrl+E is line-end in the
    // input bar (emacs), so it must not be claimed here.
    if (input === "t") {
      handlers.onToggleActivity?.();
      return true;
    }
    return false;
  };

  const handlePaging = (key: Key): boolean => {
    if (key.ctrl && key.upArrow) {
      handlers.onScroll?.(1);
      return true;
    }
    if (key.ctrl && key.downArrow) {
      handlers.onScroll?.(-1);
      return true;
    }
    if (key.pageUp) {
      handlers.onScroll?.(5);
      return true;
    }
    if (key.pageDown) {
      handlers.onScroll?.(-5);
      return true;
    }
    return false;
  };

  useInput(
    (input, key) => {
      if (!enabled) return;
      const state = store.get();

      if (key.ctrl && handleCtrl(input, state)) return;
      if (handlePaging(key)) return;

      if (key.escape) {
        handlers.onScrollReset?.();
        if (state.mode !== "chat" || state.activeView !== null) {
          store.set({ mode: "chat", activeView: null, notice: null });
        }
      }
    },
    { isActive: enabled },
  );
}
