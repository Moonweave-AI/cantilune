export type SchemaAdmissionState =
  | "proposed"
  | "validating"
  | "qualified"
  | "awaiting_authorization"
  | "authorized"
  | "preparing"
  | "prepared"
  | "committed"
  | "runtime_applying"
  | "acknowledged"
  | "rejected"
  | "cancelled"
  | "expired"
  | "degraded";

export const TERMINAL_ADMISSION_STATES: ReadonlySet<SchemaAdmissionState> = new Set([
  "committed",
  "acknowledged",
  "rejected",
  "cancelled",
  "expired",
]);

export function canTransitionAdmission(
  from: SchemaAdmissionState,
  to: SchemaAdmissionState,
): boolean {
  const transitions: Readonly<Record<SchemaAdmissionState, readonly SchemaAdmissionState[]>> = {
    proposed: ["validating", "cancelled"],
    validating: ["qualified", "rejected"],
    qualified: ["awaiting_authorization", "rejected"],
    awaiting_authorization: ["authorized", "rejected"],
    authorized: ["preparing", "rejected"],
    preparing: ["prepared", "expired", "rejected"],
    prepared: ["committed", "expired"],
    committed: ["runtime_applying", "degraded"],
    runtime_applying: ["acknowledged", "degraded"],
    acknowledged: [],
    rejected: [],
    cancelled: [],
    expired: [],
    degraded: ["acknowledged"],
  };
  return transitions[from]?.includes(to) ?? false;
}
