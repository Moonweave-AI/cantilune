import { timestamp } from "@cantilune/core";
import type { Clock } from "../../src/ports/clock.js";

export function createFixedClock(iso = "2026-08-07T10:00:00Z"): Clock {
  return {
    now() {
      return timestamp(iso);
    },
  };
}
