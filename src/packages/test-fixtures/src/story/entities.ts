import { artifactId, capabilityId, sessionId } from "@cantilune/core";

export const storyEntityIds = {
  task: artifactId("task-T"),
  writeLock: capabilityId("write-lock-w"),
  session: sessionId("session-s"),
} as const;
