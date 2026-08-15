import { mkdirSync, readFileSync, renameSync, existsSync } from "node:fs";
import { join } from "node:path";
import { type IdempotencyKey, type SessionId } from "@cantilune/core";
import { MemoryCommsStore } from "../memory/memoryCommsStore.js";
import {
  type CommsStore,
  type CommsSnapshot,
  type OutboxAppendInput,
  type InboxAcceptInput,
  type ReconnectPersistInput,
  type ClosePersistInput,
  type PersistResult,
} from "../ports/commsStore.js";
import {
  type MessageId,
  type CommsStoreSequence,
  type ReconnectRecordId,
  type CloseRecordId,
  type DescriptorRef,
  type ChannelGeneration,
} from "../foundation/messageId.js";
import {
  type DeliveryRecord,
  type DeliveryAcknowledgement,
  type DeadLetterRecord,
} from "../delivery/deliveryRecord.js";
import {
  type SessionTransportBinding,
  type SessionHandshake,
} from "../session/sessionTransportBinding.js";
import { type PeerDescriptor } from "../peer/peerDescriptor.js";
import { type ReconnectCoordinatorRecord } from "../reconnect/admissionReconnectPlan.js";
import { type QuiescentClosePlan, type ForceCloseRecord } from "../close/quiescentClosePlan.js";
import { type CommunicationOccurrenceRecord } from "../protocol/communicationOccurrenceRecord.js";
import { type CommsEventEnvelope } from "../events/commsEvent.js";
import {
  type EndpointDelegationPlan,
  type EndpointDelegationReceipt,
} from "../mobility/endpointDelegation.js";
import { type CommunicationEnvelope } from "../envelope/communicationEnvelope.js";
import { withFileLock } from "./fileLock.js";
import { atomicWriteFileSync } from "./atomicWrite.js";
import {
  hydrateCommsSnapshot,
  serializeCommsSnapshot,
  type CommsPersistedSnapshot,
} from "./commsSnapshotCodec.js";

const SNAPSHOT_FILE = "comms.snapshot.json";
const JOURNAL_FILE = "comms.journal.json";

export interface FileCommsStoreOptions {
  readonly dir: string;
  readonly memory?: MemoryCommsStore;
}

/** Durable CommsStore — lock → reload → mutate → atomic persist. */
export class FileCommsStore implements CommsStore {
  readonly dir: string;
  private readonly memory: MemoryCommsStore;

  constructor(options: FileCommsStoreOptions) {
    this.dir = options.dir;
    this.memory = options.memory ?? new MemoryCommsStore();
    mkdirSync(this.dir, { recursive: true });
    this.load();
  }

  get delegate(): MemoryCommsStore {
    return this.memory;
  }

  snapshot(): CommsSnapshot {
    return this.memory.snapshot();
  }

  nextSequence(): CommsStoreSequence {
    return this.mutate(() => this.memory.nextSequence());
  }

  getPeer(ref: DescriptorRef): PeerDescriptor | undefined {
    return this.memory.getPeer(ref);
  }

  putPeer(descriptor: PeerDescriptor): void {
    this.mutate(() => {
      this.memory.putPeer(descriptor);
    });
  }

  getSessionBinding(sessionId: SessionId): SessionTransportBinding | undefined {
    return this.memory.getSessionBinding(sessionId);
  }

  casSessionBinding(input: {
    readonly sessionId: SessionId;
    readonly expectedGeneration: ChannelGeneration;
    readonly next: SessionTransportBinding;
  }): boolean {
    return this.mutate(() => this.memory.casSessionBinding(input));
  }

  /** Cross-process durable session binding CAS. */
  casSessionBindingDurable(input: {
    readonly sessionId: SessionId;
    readonly expectedGeneration: ChannelGeneration;
    readonly next: SessionTransportBinding;
  }): boolean {
    return withFileLock(this.dir, () => {
      this.load();
      const ok = this.memory.casSessionBinding(input);
      if (ok) {
        this.persistUnlocked();
      }
      return ok;
    });
  }

  appendOutbox(input: OutboxAppendInput): PersistResult {
    return this.mutate(() => this.memory.appendOutbox(input));
  }

  appendInbox(input: InboxAcceptInput): PersistResult {
    return this.mutate(() => this.memory.appendInbox(input));
  }

  updateDelivery(messageId: MessageId, next: DeliveryRecord): boolean {
    return this.mutate(() => this.memory.updateDelivery(messageId, next));
  }

  getDelivery(messageId: MessageId): DeliveryRecord | undefined {
    return this.memory.getDelivery(messageId);
  }

  getEnvelope(messageId: MessageId): CommunicationEnvelope | undefined {
    return this.memory.getEnvelope(messageId);
  }

  putAck(ack: DeliveryAcknowledgement): void {
    this.mutate(() => {
      this.memory.putAck(ack);
    });
  }

  putReconnect(record: ReconnectCoordinatorRecord): void {
    this.mutate(() => {
      this.memory.putReconnect(record);
    });
  }

  getReconnect(planId: ReconnectRecordId): ReconnectCoordinatorRecord | undefined {
    return this.memory.getReconnect(planId);
  }

  finalizeReconnect(input: ReconnectPersistInput): PersistResult {
    return this.mutate(() => this.memory.finalizeReconnect(input));
  }

  putClosePlan(plan: QuiescentClosePlan): void {
    this.mutate(() => {
      this.memory.putClosePlan(plan);
    });
  }

  finalizeClose(input: ClosePersistInput): PersistResult {
    return this.mutate(() => this.memory.finalizeClose(input));
  }

  getForceClose(planId: CloseRecordId): ForceCloseRecord | undefined {
    return this.memory.getForceClose(planId);
  }

  putForceClose(record: ForceCloseRecord): void {
    this.mutate(() => {
      this.memory.putForceClose(record);
    });
  }

  appendOccurrence(record: CommunicationOccurrenceRecord): void {
    this.mutate(() => {
      this.memory.appendOccurrence(record);
    });
  }

  appendEvent(event: CommsEventEnvelope): void {
    this.mutate(() => {
      this.memory.appendEvent(event);
    });
  }

  readEvents(since?: CommsStoreSequence): readonly CommsEventEnvelope[] {
    return this.memory.readEvents(since);
  }

  claimIdempotency(key: IdempotencyKey, digest: string): "claimed" | "replay" | "conflict" {
    return withFileLock(this.dir, () => {
      this.load();
      const result = this.memory.claimIdempotency(key, digest);
      if (result === "claimed") {
        this.persistUnlocked();
      }
      return result;
    });
  }

  putDeadLetter(record: DeadLetterRecord): void {
    this.mutate(() => {
      this.memory.putDeadLetter(record);
    });
  }

  putDelegation(plan: EndpointDelegationPlan): void {
    this.mutate(() => {
      this.memory.putDelegation(plan);
    });
  }

  putDelegationReceipt(receipt: EndpointDelegationReceipt): void {
    this.mutate(() => {
      this.memory.putDelegationReceipt(receipt);
    });
  }

  putHandshake(handshake: SessionHandshake): void {
    this.mutate(() => {
      this.memory.putHandshake(handshake);
    });
  }

  persist(): void {
    withFileLock(this.dir, () => {
      this.persistUnlocked();
    });
  }

  appendJournal(entry: unknown): void {
    const path = join(this.dir, JOURNAL_FILE);
    const prior = existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : [];
    prior.push(entry);
    atomicWriteFileSync(path, JSON.stringify(prior));
  }

  loadJournal(): readonly unknown[] {
    const path = join(this.dir, JOURNAL_FILE);
    if (!existsSync(path)) {
      return [];
    }
    return JSON.parse(readFileSync(path, "utf8")) as unknown[];
  }

  load(): void {
    const path = join(this.dir, SNAPSHOT_FILE);
    if (!existsSync(path)) {
      return;
    }
    try {
      const raw = JSON.parse(readFileSync(path, "utf8")) as CommsPersistedSnapshot;
      if (raw.version !== 1) {
        throw new Error(`unsupported snapshot version: ${String(raw.version)}`);
      }
      this.memory.restorePersistedSnapshot(hydrateCommsSnapshot(raw));
    } catch (error) {
      const quarantine = join(this.dir, `${SNAPSHOT_FILE}.corrupt.${Date.now()}`);
      try {
        renameSync(path, quarantine);
      } catch {
        // best effort quarantine
      }
      throw new Error(
        `comms snapshot corrupt or unreadable — quarantined; refusing fail-open start: ${String(error)}`,
      );
    }
  }

  recover(): CommsSnapshot {
    this.load();
    return this.memory.snapshot();
  }

  private mutate<T>(fn: () => T): T {
    return withFileLock(this.dir, () => {
      this.load();
      const result = fn();
      this.persistUnlocked();
      return result;
    });
  }

  private persistUnlocked(): void {
    atomicWriteFileSync(join(this.dir, SNAPSHOT_FILE), serializeCommsSnapshot(this.memory));
  }
}

export function createFileCommsStore(dir: string, memory?: MemoryCommsStore): FileCommsStore {
  return new FileCommsStore({ dir, ...(memory !== undefined ? { memory } : {}) });
}
