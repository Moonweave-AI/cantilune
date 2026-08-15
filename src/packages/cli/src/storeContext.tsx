import React, { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { createStore, ReactiveStore } from "./store.js";
import type { AppStore } from "./store.js";

const StoreContext = createContext<ReactiveStore | null>(null);

function isReactiveStore(value: ReactiveStore | AppStore): value is ReactiveStore {
  return value instanceof ReactiveStore;
}

/**
 * Provide a store to the view tree.
 *
 * Accepts either a live {@link ReactiveStore} (the TUI) or a plain
 * {@link AppStore} snapshot (tests and headless render helpers, which render
 * once against fixed state). Plain snapshots are wrapped in a store that never
 * emits, so views stay pure functions of their input.
 */
export function StoreProvider({
  store,
  children,
}: {
  readonly store: ReactiveStore | AppStore;
  readonly children: React.ReactNode;
}): React.ReactElement {
  const resolved = useMemo(
    () => (isReactiveStore(store) ? store : ReactiveStore.fromSnapshot(store)),
    [store],
  );

  return <StoreContext.Provider value={resolved}>{children}</StoreContext.Provider>;
}

/** Access the reactive store handle for writes. Throws outside a provider. */
export function useStoreHandle(): ReactiveStore {
  const store = useContext(StoreContext);
  if (store === null) {
    throw new Error("useStoreHandle must be used within a StoreProvider");
  }
  return store;
}

/**
 * Subscribe to the current store snapshot.
 *
 * View containers pass their own `activeView`/`viewArgs` as overrides so a
 * single provider can host several views at once (and so `ViewContainer` can
 * drive a view purely by prop). Overrides therefore layer on top of the shared
 * state rather than being discarded. With no overrides the context state is
 * returned by reference, so identity checks still hold.
 *
 * Outside a provider — unit tests, headless render helpers — this falls back to
 * a detached default store, keeping views pure functions of their props.
 */
export function useAppStore(overrides?: Partial<AppStore>): AppStore {
  const store = useContext(StoreContext);
  const subscribe = store?.subscribe ?? noopSubscribe;
  const getSnapshot = (): number => store?.getVersion() ?? 0;
  useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  if (store === null) {
    return createStore(overrides);
  }

  const state = store.get();
  if (overrides === undefined || Object.keys(overrides).length === 0) {
    return state;
  }
  return { ...state, ...overrides };
}

function noopSubscribe(): () => void {
  return () => {
    /* detached store never changes */
  };
}
