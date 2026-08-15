import type { AdmittedId } from "../foundation/brands.js";

/** Opaque admission ticket — only {@link AdmissionGateway} may mint. */
export interface AdmissionTicket {
  readonly ticketId: AdmittedId;
}

export function admissionTicket(ticketId: AdmittedId): AdmissionTicket {
  return { ticketId };
}
