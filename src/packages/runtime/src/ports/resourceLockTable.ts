import type { Footprint } from "@cantilune/core";
import type { AdmittedId } from "../foundation/brands.js";

export interface ResourceLockTable {
  acquire(admittedId: AdmittedId, footprint: Footprint, leaseMs?: number): boolean;
  release(admittedId: AdmittedId): void;
  isHeld(admittedId: AdmittedId): boolean;
  /** Count non-expired locks for epoch-transition quiescence checks. */
  heldLockCount(): number;
}
