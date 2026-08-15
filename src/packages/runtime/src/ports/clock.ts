import type { Timestamp } from "@cantilune/core";

export interface Clock {
  now(): Timestamp;
}
