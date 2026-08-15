import type { SnapshotRef } from "@cantilune/core";
import type { AdmittedId } from "../foundation/brands.js";
import type { ResourceLockTable } from "../ports/resourceLockTable.js";
import type { AdmittedRecord } from "./admittedRecord.js";
import type { AdmissionTicket } from "./admissionTicket.js";
import { admissionTicket } from "./admissionTicket.js";

export type AdmissionRegistryError =
  | { readonly kind: "ticket_not_found" }
  | { readonly kind: "ticket_expired" }
  | { readonly kind: "lock_not_held" }
  | {
      readonly kind: "head_mismatch";
      readonly expected: SnapshotRef;
      readonly actual?: SnapshotRef;
    };

export class AdmissionRegistry {
  private readonly records = new Map<AdmittedId, AdmittedRecord>();

  constructor(
    private readonly locks: ResourceLockTable,
    private readonly defaultLeaseMs = 60_000,
  ) {}

  register(record: Omit<AdmittedRecord, "expiresAt">, leaseMs?: number): AdmissionTicket {
    const expiresAt = Date.now() + (leaseMs ?? this.defaultLeaseMs);
    this.records.set(record.admittedId, Object.freeze({ ...record, expiresAt }));
    return admissionTicket(record.admittedId);
  }

  resolveForCommit(
    ticket: AdmissionTicket,
    currentHead: SnapshotRef | undefined,
  ): { ok: true; record: AdmittedRecord } | { ok: false; error: AdmissionRegistryError } {
    const record = this.records.get(ticket.ticketId);
    if (record === undefined) {
      return { ok: false, error: { kind: "ticket_not_found" } };
    }
    if (Date.now() > record.expiresAt) {
      this.cancel(ticket);
      return { ok: false, error: { kind: "ticket_expired" } };
    }
    if (!this.locks.isHeld(ticket.ticketId)) {
      return { ok: false, error: { kind: "lock_not_held" } };
    }
    if (currentHead !== record.beforeRef) {
      return {
        ok: false,
        error: {
          kind: "head_mismatch",
          expected: record.beforeRef,
          ...(currentHead !== undefined ? { actual: currentHead } : {}),
        },
      };
    }
    return { ok: true, record };
  }

  consume(ticket: AdmissionTicket): void {
    this.records.delete(ticket.ticketId);
  }

  cancel(ticket: AdmissionTicket): void {
    this.locks.release(ticket.ticketId);
    this.records.delete(ticket.ticketId);
  }

  activeCount(): number {
    for (const [id, record] of [...this.records.entries()]) {
      if (Date.now() > record.expiresAt) {
        this.records.delete(id);
      }
    }
    return this.records.size;
  }
}
