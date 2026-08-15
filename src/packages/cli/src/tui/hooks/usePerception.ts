import { useEffect, useRef } from "react";

export interface PerceptionSnapshot {
  readonly timestamp: number;
  readonly summary: string;
}

export interface UsePerceptionOptions {
  readonly intervalMs?: number;
  readonly enabled?: boolean;
  readonly perceive: () => Promise<PerceptionSnapshot> | PerceptionSnapshot;
  readonly onSnapshot: (snapshot: PerceptionSnapshot) => void;
}

export function usePerception({
  intervalMs = 5_000,
  enabled = true,
  perceive,
  onSnapshot,
}: UsePerceptionOptions): void {
  const perceiveRef = useRef(perceive);
  const onSnapshotRef = useRef(onSnapshot);
  perceiveRef.current = perceive;
  onSnapshotRef.current = onSnapshot;

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const tick = async () => {
      try {
        const snapshot = await perceiveRef.current();
        if (!cancelled) onSnapshotRef.current(snapshot);
      } catch {
        // Perception failures are non-fatal in the TUI.
      }
    };

    void tick();
    const timer = setInterval(() => {
      void tick();
    }, intervalMs);

    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [enabled, intervalMs]);
}
