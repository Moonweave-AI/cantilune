import type { ControlPlaneViolation } from "../errors/controlPlaneViolation.js";
import type { ControlPlaneStore } from "../ports/controlPlaneStore.js";

export function ensureControlPlaneNotFrozen(
  store: ControlPlaneStore,
  phase: ControlPlaneViolation["phase"],
): void {
  if (store.isFrozen()) {
    throw Object.assign(new Error("control plane frozen"), {
      violation: { code: "control_plane_frozen", phase, message: "control plane is frozen" },
    });
  }
}
