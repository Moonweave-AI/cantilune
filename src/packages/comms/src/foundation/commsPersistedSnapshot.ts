/** Wire format for file-backed comms snapshot persistence. */
export interface CommsPersistedSnapshot {
  readonly version: 1;
  readonly checksum?: string;
  readonly frozen: boolean;
  readonly sequence: number;
  readonly peers: readonly [string, unknown][];
  readonly sessions: readonly [string, unknown][];
  readonly outbox: readonly unknown[];
  readonly inbox: readonly unknown[];
  readonly deliveries: readonly [string, unknown][];
  readonly envelopes: readonly [string, unknown][];
  readonly acks: readonly unknown[];
  readonly reconnects: readonly [string, unknown][];
  readonly closePlans: readonly [string, unknown][];
  readonly closeReceipts: readonly [string, unknown][];
  readonly forceCloses: readonly [string, unknown][];
  readonly occurrences: readonly unknown[];
  readonly events: readonly unknown[];
  readonly idempotency: readonly [string, string][];
  readonly deadLetters: readonly unknown[];
  readonly delegations: readonly [string, unknown][];
  readonly delegationReceipts: readonly [string, unknown][];
  readonly handshakes: readonly [string, unknown][];
}

export function hydrateCommsPersistedSnapshot(raw: CommsPersistedSnapshot): CommsPersistedSnapshot {
  return {
    version: 1,
    frozen: Boolean(raw.frozen),
    sequence: raw.sequence ?? 0,
    peers: raw.peers ?? [],
    sessions: raw.sessions ?? [],
    outbox: raw.outbox ?? [],
    inbox: raw.inbox ?? [],
    deliveries: raw.deliveries ?? [],
    envelopes: raw.envelopes ?? [],
    acks: raw.acks ?? [],
    reconnects: raw.reconnects ?? [],
    closePlans: raw.closePlans ?? [],
    closeReceipts: raw.closeReceipts ?? [],
    forceCloses: raw.forceCloses ?? [],
    occurrences: raw.occurrences ?? [],
    events: raw.events ?? [],
    idempotency: raw.idempotency ?? [],
    deadLetters: raw.deadLetters ?? [],
    delegations: raw.delegations ?? [],
    delegationReceipts: raw.delegationReceipts ?? [],
    handshakes: raw.handshakes ?? [],
  };
}
