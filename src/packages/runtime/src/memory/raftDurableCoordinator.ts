import { randomUUID } from "node:crypto";
import type {
  CollaborationSnapshot,
  CoordinationChange,
  SchemaEpochBinding,
  SnapshotRef,
} from "@cantilune/core";
import { changeContinuesChain, isVerifiableUnloggedAdvance } from "../codec/observationBridge.js";
import { decodeChangeFromUnknown, encodeChangeWithRecipe } from "../codec/changeCodec.js";
import { decodeSnapshotFromUnknown, encodeSnapshot } from "../codec/snapshotCodec.js";
import { parseSchemaBindingWire, serializeSchemaBindingWire } from "../codec/bindingWire.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import type {
  DurableCommitInput,
  DurableCommitResult,
  DurableCoordinator,
} from "../ports/durableCoordinator.js";
import { snapshotCoordinationChange, snapshotReplayRecipe } from "../replay/authoritySnapshot.js";
import { replayRecipeFromChange, type ReplayRecipe } from "../replay/recipe.js";
import { assertSafeNamespace, type RaftCompare, type RaftKv, type RaftOp } from "./raftKv.js";

const DEFAULT_NAMESPACE = "cantilune";
const DEFAULT_LEASE_TTL_SECONDS = 30;

export interface RaftDurableCoordinatorOptions {
  readonly kv: RaftKv;
  readonly namespace?: string;
  readonly initial?: CollaborationSnapshot;
  readonly leaseOwner?: string;
  readonly leaseToken?: string;
  readonly leaseTtlSeconds?: number;
}

interface RaftKeys {
  readonly head: string;
  readonly binding: string;
  readonly lease: string;
  readonly seq: string;
  readonly fencingLease: string;
  snapshot(ref: string): string;
  change(seq: number): string;
  changeId(id: string): string;
  recipe(id: string): string;
  readonly changePrefix: string;
}

interface FencingLease {
  readonly owner: string;
  readonly token: string;
}

class DurableAbort extends Error {
  readonly result: DurableCommitResult;

  constructor(result: DurableCommitResult) {
    super(result.ok ? "durable abort" : result.reason);
    this.name = "DurableAbort";
    this.result = result;
  }
}

export class RaftDurableCoordinator implements DurableCoordinator {
  constructor(
    private readonly kv: RaftKv,
    private readonly keys: RaftKeys,
    private readonly leaseOwner: string,
    private readonly leaseToken: string,
  ) {}

  initialize(
    initial: CollaborationSnapshot | undefined,
    leaseTtlSeconds: number,
  ): void {
    const granted = this.kv.grantLease(leaseTtlSeconds);
    const encoded = encodeLease(this.leaseOwner, this.leaseToken);
    this.kv.txn([], [
      { kind: "put", key: this.keys.lease, value: encoded, leaseId: granted.leaseId },
      { kind: "put", key: this.keys.fencingLease, value: granted.leaseId },
    ]);
    if (initial !== undefined) {
      seedInitial(this.kv, this.keys, initial);
    }
  }

  get(ref: SnapshotRef): CollaborationSnapshot | undefined {
    this.refreshLease();
    return loadSnapshot(this.kv, this.keys, ref);
  }

  head(): SnapshotRef | undefined {
    this.refreshLease();
    return loadHead(this.kv, this.keys);
  }

  activeBinding(): SchemaEpochBinding | undefined {
    this.refreshLease();
    return loadBinding(this.kv, this.keys);
  }

  compareAndSwapHead(expected: SnapshotRef, snapshot: CollaborationSnapshot): boolean {
    this.refreshLease();
    assertWriter(this.kv, this.keys, this.leaseOwner, this.leaseToken);
    return casHead(this.kv, this.keys, this.leaseOwner, this.leaseToken, expected, snapshot, undefined);
  }

  compareAndSwapHeadWithBinding(
    expected: SnapshotRef,
    snapshot: CollaborationSnapshot,
    binding: SchemaEpochBinding,
  ): boolean {
    this.refreshLease();
    assertWriter(this.kv, this.keys, this.leaseOwner, this.leaseToken);
    return casHead(this.kv, this.keys, this.leaseOwner, this.leaseToken, expected, snapshot, binding);
  }

  commit(input: DurableCommitInput): DurableCommitResult {
    try {
      this.refreshLease();
      assertWriter(this.kv, this.keys, this.leaseOwner, this.leaseToken);
      return commitAtomic(this.kv, this.keys, this.leaseOwner, this.leaseToken, input);
    } catch (error) {
      if (error instanceof DurableAbort) {
        return error.result;
      }
      throw error;
    }
  }

  changes(): readonly CoordinationChange[] {
    this.refreshLease();
    return loadChanges(this.kv, this.keys);
  }

  since(fromRef: SnapshotRef): readonly CoordinationChange[] {
    this.refreshLease();
    const all = loadChanges(this.kv, this.keys);
    return changesSince(fromRef, all, (ref) => loadSnapshot(this.kv, this.keys, ref));
  }

  recipeForChange(change: CoordinationChange): ReplayRecipe | undefined {
    this.refreshLease();
    const stored = loadRecipe(this.kv, this.keys, change.changeId);
    if (stored !== undefined) {
      return stored;
    }
    return replayRecipeFromChange(change);
  }

  private refreshLease(): void {
    const leaseId = this.kv.get(this.keys.fencingLease)?.value;
    if (leaseId !== undefined) {
      this.kv.keepAlive(leaseId);
    }
  }
}

export function createRaftDurableCoordinator(
  options: RaftDurableCoordinatorOptions,
): DurableCoordinator {
  const namespace = options.namespace ?? DEFAULT_NAMESPACE;
  assertSafeNamespace(namespace);
  const owner = options.leaseOwner ?? `cantilune:${String(process.pid)}:${randomUUID()}`;
  const token = options.leaseToken ?? randomUUID();
  const coordinator = new RaftDurableCoordinator(options.kv, qualifyKeys(namespace), owner, token);
  coordinator.initialize(options.initial, options.leaseTtlSeconds ?? DEFAULT_LEASE_TTL_SECONDS);
  return coordinator;
}

function qualifyKeys(namespace: string): RaftKeys {
  const root = `${namespace}/durable`;
  return {
    head: `${root}/meta/head`,
    binding: `${root}/meta/binding`,
    lease: `${root}/meta/lease`,
    seq: `${root}/meta/changeSeq`,
    fencingLease: `${root}/meta/fencingLeaseId`,
    snapshot: (ref) => `${root}/snapshots/${ref}`,
    change: (seq) => `${root}/changes/${String(seq).padStart(20, "0")}`,
    changeId: (id) => `${root}/changeIds/${id}`,
    recipe: (id) => `${root}/recipes/${id}`,
    changePrefix: `${root}/changes/`,
  };
}

function seedInitial(kv: RaftKv, keys: RaftKeys, initial: CollaborationSnapshot): void {
  kv.txn(
    [{ key: keys.head, target: "create", result: "equal" }],
    [
      { kind: "put", key: keys.snapshot(initial.snapshotRef), value: encodeJson(encodeSnapshot(initial)) },
      { kind: "put", key: keys.head, value: initial.snapshotRef },
    ],
  );
}

function assertWriter(kv: RaftKv, keys: RaftKeys, owner: string, token: string): void {
  if (!leaseOwned(kv, keys, owner, token)) {
    throw new DurableAbort({ ok: false, reason: "fencing_stale" });
  }
}

function leaseOwned(kv: RaftKv, keys: RaftKeys, owner: string, token: string): boolean {
  const lease = loadLease(kv, keys);
  return lease !== undefined && lease.owner === owner && lease.token === token;
}

function casHead(
  kv: RaftKv,
  keys: RaftKeys,
  owner: string,
  token: string,
  expected: SnapshotRef,
  snapshot: CollaborationSnapshot,
  binding: SchemaEpochBinding | undefined,
): boolean {
  const ops: RaftOp[] = [
    { kind: "put", key: keys.snapshot(snapshot.snapshotRef), value: encodeJson(encodeSnapshot(snapshot)) },
    { kind: "put", key: keys.head, value: snapshot.snapshotRef },
  ];
  if (binding !== undefined) {
    ops.push({ kind: "put", key: keys.binding, value: encodeJson(serializeSchemaBindingWire(binding)) });
  }
  const result = kv.txn(writerAndHead(keys, owner, token, expected), ops);
  return result.succeeded;
}

function commitAtomic(
  kv: RaftKv,
  keys: RaftKeys,
  owner: string,
  token: string,
  input: DurableCommitInput,
): DurableCommitResult {
  const head = loadHead(kv, keys);
  if (head !== input.expectedHead) {
    throw new DurableAbort({ ok: false, reason: "head_mismatch" });
  }
  if (changeIdExists(kv, keys, input.change.changeId)) {
    throw new DurableAbort({ ok: false, reason: "duplicate_change_id" });
  }
  const chainReason = validateCommitChain(kv, keys, input);
  if (chainReason !== undefined) {
    throw new DurableAbort({ ok: false, reason: chainReason });
  }
  if (kv.get(keys.snapshot(input.after.snapshotRef)) !== undefined) {
    throw new DurableAbort({ ok: false, reason: "after_ref_collision" });
  }
  const seqEntry = kv.get(keys.seq);
  const nextSeq = Number(seqEntry?.value ?? "0") + 1;
  const compares: RaftCompare[] = [
    ...writerAndHead(keys, owner, token, input.expectedHead),
    { key: keys.changeId(input.change.changeId), target: "create", result: "equal" },
    { key: keys.snapshot(input.after.snapshotRef), target: "create", result: "equal" },
    {
      key: keys.seq,
      target: "version",
      result: "equal",
      version: seqEntry?.version ?? 0,
    },
  ];
  const result = kv.txn(compares, [
    {
      kind: "put",
      key: keys.snapshot(input.after.snapshotRef),
      value: encodeJson(encodeSnapshot(input.after)),
    },
    {
      kind: "put",
      key: keys.change(nextSeq),
      value: encodeJson(encodeChangeWithRecipe(input.change, input.recipe)),
    },
    { kind: "put", key: keys.changeId(input.change.changeId), value: String(nextSeq) },
    {
      kind: "put",
      key: keys.recipe(input.change.changeId),
      value: encodeJson(snapshotReplayRecipe(input.recipe)),
    },
    { kind: "put", key: keys.head, value: input.after.snapshotRef },
    { kind: "put", key: keys.seq, value: String(nextSeq) },
  ]);
  if (!result.succeeded) {
    if (!leaseOwned(kv, keys, owner, token)) {
      throw new DurableAbort({ ok: false, reason: "fencing_stale" });
    }
    if (loadHead(kv, keys) !== input.expectedHead) {
      throw new DurableAbort({ ok: false, reason: "head_mismatch" });
    }
    throw new DurableAbort({ ok: false, reason: "changelog_append_failed" });
  }
  return { ok: true };
}

function writerAndHead(
  keys: RaftKeys,
  owner: string,
  token: string,
  expected: SnapshotRef,
): RaftCompare[] {
  return [
    { key: keys.lease, target: "value", result: "equal", value: encodeLease(owner, token) },
    { key: keys.head, target: "value", result: "equal", value: expected },
  ];
}

function validateCommitChain(
  kv: RaftKv,
  keys: RaftKeys,
  input: DurableCommitInput,
): string | undefined {
  const last = loadLastChange(kv, keys);
  if (last !== undefined) {
    if (!changeContinuesChain(last, input.change, (ref) => loadSnapshot(kv, keys, ref))) {
      return "chain_broken";
    }
    return undefined;
  }
  if (input.change.beforeRef !== input.expectedHead) {
    return "chain_broken";
  }
  return undefined;
}

function changesSince(
  fromRef: SnapshotRef,
  all: readonly CoordinationChange[],
  resolve: (ref: SnapshotRef) => CollaborationSnapshot | undefined,
): readonly CoordinationChange[] {
  const directStart = all.findIndex((change) => change.beforeRef === fromRef);
  if (directStart >= 0) {
    return all.slice(directStart);
  }
  const from = resolve(fromRef);
  if (from === undefined) {
    return [];
  }
  const anchor = all.findIndex((change) => change.afterRef === fromRef);
  const startAt = anchor >= 0 ? anchor + 1 : 0;
  const bridgedIndex = all.findIndex((change, index) => {
    if (index < startAt) {
      return false;
    }
    const before = resolve(change.beforeRef);
    return before !== undefined && isVerifiableUnloggedAdvance(from, before);
  });
  if (bridgedIndex >= 0) {
    return all.slice(bridgedIndex);
  }
  return [];
}

function loadLease(kv: RaftKv, keys: RaftKeys): FencingLease | undefined {
  const entry = kv.get(keys.lease);
  if (entry === undefined) {
    return undefined;
  }
  const parsed = parseJson(entry.value);
  if (parsed === null || typeof parsed !== "object") {
    throw new Error("raft durable: expected non-empty string at lease.owner");
  }
  const record = parsed as Record<string, unknown>;
  return {
    owner: asString(record.owner, "lease.owner"),
    token: asString(record.token, "lease.token"),
  };
}

function loadHead(kv: RaftKv, keys: RaftKeys): SnapshotRef | undefined {
  const entry = kv.get(keys.head);
  if (entry === undefined || entry.value.length === 0) {
    return undefined;
  }
  return entry.value as SnapshotRef;
}

function loadSnapshot(
  kv: RaftKv,
  keys: RaftKeys,
  ref: SnapshotRef,
): CollaborationSnapshot | undefined {
  const entry = kv.get(keys.snapshot(ref));
  if (entry === undefined) {
    return undefined;
  }
  return decodeStoredSnapshot(entry.value);
}

function loadChanges(kv: RaftKv, keys: RaftKeys): CoordinationChange[] {
  return kv.range(keys.changePrefix).map((entry) => decodeStoredChange(entry.value));
}

function loadLastChange(kv: RaftKv, keys: RaftKeys): CoordinationChange | undefined {
  const rows = kv.range(keys.changePrefix);
  const last = rows.at(-1);
  if (last === undefined) {
    return undefined;
  }
  return decodeStoredChange(last.value);
}

function changeIdExists(kv: RaftKv, keys: RaftKeys, changeId: string): boolean {
  return kv.get(keys.changeId(changeId)) !== undefined;
}

function loadRecipe(kv: RaftKv, keys: RaftKeys, changeId: string): ReplayRecipe | undefined {
  const entry = kv.get(keys.recipe(changeId));
  if (entry === undefined) {
    return undefined;
  }
  return decodeStoredRecipe(entry.value);
}

function loadBinding(kv: RaftKv, keys: RaftKeys): SchemaEpochBinding | undefined {
  const entry = kv.get(keys.binding);
  if (entry === undefined) {
    return undefined;
  }
  return decodeStoredBinding(entry.value);
}

function decodeStoredSnapshot(payload: string): CollaborationSnapshot {
  const decoded = decodeSnapshotFromUnknown(parseJson(payload));
  if (isRuntimeViolation(decoded)) {
    throw new Error(`raft durable: invalid snapshot payload: ${decoded.message}`);
  }
  return decoded;
}

function decodeStoredChange(payload: string): CoordinationChange {
  const decoded = decodeChangeFromUnknown(parseJson(payload));
  if (isRuntimeViolation(decoded)) {
    throw new Error(`raft durable: invalid change payload: ${decoded.message}`);
  }
  return snapshotCoordinationChange(decoded.change);
}

function decodeStoredBinding(payload: string): SchemaEpochBinding {
  const parsed = parseSchemaBindingWire(parseJson(payload));
  if (!parsed.ok) {
    throw new Error(`raft durable: invalid epoch binding: ${parsed.violation.message}`);
  }
  return parsed.value;
}

function decodeStoredRecipe(payload: string): ReplayRecipe {
  const value = parseJson(payload);
  if (value === null || typeof value !== "object") {
    throw new Error("raft durable: invalid recipe payload");
  }
  return snapshotReplayRecipe(value as ReplayRecipe);
}

function encodeLease(owner: string, token: string): string {
  return JSON.stringify({ owner, token });
}

function encodeJson(value: unknown): string {
  return JSON.stringify(value);
}

function parseJson(value: string): unknown {
  return JSON.parse(value);
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`raft durable: expected non-empty string at ${label}`);
  }
  return value;
}

function isRuntimeViolation(value: unknown): value is RuntimeViolation {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}
