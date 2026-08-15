export function idPool(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, index) => `${prefix}-${String(index).padStart(3, "0")}`);
}

/** Enough ids for N serial commits (each needs snapshotRef + changeId; delegate may need session). */
export function runtimeIdConfig(eventCount: number) {
  return {
    snapshotRefs: idPool("snap", eventCount + 2),
    changeIds: idPool("chg", eventCount),
    sessionIds: idPool("session", eventCount),
  };
}
