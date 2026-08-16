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
import { createPostgresSqlExecutor, taggedSql, type SqlExecutor } from "./postgresSqlExecutor.js";

const DEFAULT_SCHEMA = "cantilune";
const IDENT_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

export interface PostgresDurableCoordinatorOptions {
  readonly connectionString: string;
  readonly schema?: string;
  readonly executor?: SqlExecutor;
  readonly initial?: CollaborationSnapshot;
  readonly leaseOwner?: string;
  readonly leaseToken?: string;
}

interface QualifiedTables {
  readonly head: string;
  readonly snapshots: string;
  readonly changes: string;
  readonly recipes: string;
  readonly epochBinding: string;
  readonly lease: string;
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

export class PostgresDurableCoordinator implements DurableCoordinator {
  constructor(
    private readonly executor: SqlExecutor,
    private readonly tables: QualifiedTables,
    private readonly leaseOwner: string,
    private readonly leaseToken: string,
  ) {}

  initialize(initial: CollaborationSnapshot | undefined): void {
    this.executor.transaction((tx) => {
      for (const statement of ddlStatements(this.tables)) {
        tx.query(statement);
      }
      tx.query(
        taggedSql(
          "upsert_lease",
          `INSERT INTO ${this.tables.lease} (id, owner, token, acquired_at) VALUES (1, $1, $2, NOW()) ON CONFLICT (id) DO UPDATE SET owner = EXCLUDED.owner, token = EXCLUDED.token, acquired_at = NOW()`,
        ),
        [this.leaseOwner, this.leaseToken],
      );
      if (initial !== undefined) {
        seedInitial(tx, this.tables, initial);
      }
    });
  }

  get(ref: SnapshotRef): CollaborationSnapshot | undefined {
    return this.executor.transaction((tx) => loadSnapshot(tx, this.tables, ref));
  }

  head(): SnapshotRef | undefined {
    return this.executor.transaction((tx) => loadHead(tx, this.tables));
  }

  activeBinding(): SchemaEpochBinding | undefined {
    return this.executor.transaction((tx) => loadBinding(tx, this.tables));
  }

  compareAndSwapHead(expected: SnapshotRef, snapshot: CollaborationSnapshot): boolean {
    return this.executor.transaction((tx) => {
      assertWriter(tx, this.tables, this.leaseOwner, this.leaseToken);
      return casHead(tx, this.tables, expected, snapshot, undefined);
    });
  }

  compareAndSwapHeadWithBinding(
    expected: SnapshotRef,
    snapshot: CollaborationSnapshot,
    binding: SchemaEpochBinding,
  ): boolean {
    return this.executor.transaction((tx) => {
      assertWriter(tx, this.tables, this.leaseOwner, this.leaseToken);
      return casHead(tx, this.tables, expected, snapshot, binding);
    });
  }

  commit(input: DurableCommitInput): DurableCommitResult {
    try {
      return this.executor.transaction((tx) => {
        assertWriter(tx, this.tables, this.leaseOwner, this.leaseToken);
        return commitInTransaction(tx, this.tables, input);
      });
    } catch (error) {
      if (error instanceof DurableAbort) {
        return error.result;
      }
      throw error;
    }
  }

  changes(): readonly CoordinationChange[] {
    return this.executor.transaction((tx) => loadChanges(tx, this.tables));
  }

  since(fromRef: SnapshotRef): readonly CoordinationChange[] {
    return this.executor.transaction((tx) => {
      const all = loadChanges(tx, this.tables);
      return changesSince(fromRef, all, (ref) => loadSnapshot(tx, this.tables, ref));
    });
  }

  recipeForChange(change: CoordinationChange): ReplayRecipe | undefined {
    return this.executor.transaction((tx) => {
      const stored = loadRecipe(tx, this.tables, change.changeId);
      if (stored !== undefined) {
        return stored;
      }
      return replayRecipeFromChange(change);
    });
  }
}

export function createPostgresDurableCoordinator(
  options: PostgresDurableCoordinatorOptions,
): DurableCoordinator {
  const schema = options.schema ?? DEFAULT_SCHEMA;
  assertSafeIdent(schema, "schema");
  const executor =
    options.executor ?? createPostgresSqlExecutor({ connectionString: options.connectionString });
  const owner = options.leaseOwner ?? `cantilune:${String(process.pid)}:${randomUUID()}`;
  const token = options.leaseToken ?? randomUUID();
  const coordinator = new PostgresDurableCoordinator(executor, qualifyTables(schema), owner, token);
  coordinator.initialize(options.initial);
  return Object.assign(coordinator, {
    close() {
      executor.end?.();
    },
  });
}

export function quoteIdent(name: string): string {
  return `"${name.replaceAll('"', '""')}"`;
}

export function assertSafeIdent(name: string, label: string): void {
  if (!IDENT_PATTERN.test(name)) {
    throw new Error(`${label} must be a simple SQL identifier, got ${name}`);
  }
}

function qualifyTables(schema: string): QualifiedTables {
  const prefix = quoteIdent(schema);
  return {
    head: `${prefix}.${quoteIdent("snapshot_head")}`,
    snapshots: `${prefix}.${quoteIdent("snapshots")}`,
    changes: `${prefix}.${quoteIdent("changes")}`,
    recipes: `${prefix}.${quoteIdent("recipes")}`,
    epochBinding: `${prefix}.${quoteIdent("epoch_binding")}`,
    lease: `${prefix}.${quoteIdent("fencing_lease")}`,
  };
}

function ddlStatements(tables: QualifiedTables): readonly string[] {
  const schemaName = tables.head.slice(0, tables.head.indexOf("."));
  return [
    taggedSql("ensure_ddl", `CREATE SCHEMA IF NOT EXISTS ${schemaName}`),
    taggedSql(
      "ensure_ddl",
      `CREATE TABLE IF NOT EXISTS ${tables.head} (id SMALLINT PRIMARY KEY, head_ref TEXT NOT NULL)`,
    ),
    taggedSql(
      "ensure_ddl",
      `CREATE TABLE IF NOT EXISTS ${tables.snapshots} (snapshot_ref TEXT PRIMARY KEY, payload JSONB NOT NULL)`,
    ),
    taggedSql(
      "ensure_ddl",
      `CREATE TABLE IF NOT EXISTS ${tables.changes} (seq BIGSERIAL PRIMARY KEY, change_id TEXT NOT NULL UNIQUE, before_ref TEXT NOT NULL, after_ref TEXT NOT NULL, payload JSONB NOT NULL)`,
    ),
    taggedSql(
      "ensure_ddl",
      `CREATE TABLE IF NOT EXISTS ${tables.recipes} (change_id TEXT PRIMARY KEY, payload JSONB NOT NULL)`,
    ),
    taggedSql(
      "ensure_ddl",
      `CREATE TABLE IF NOT EXISTS ${tables.epochBinding} (id SMALLINT PRIMARY KEY, payload JSONB NOT NULL)`,
    ),
    taggedSql(
      "ensure_ddl",
      `CREATE TABLE IF NOT EXISTS ${tables.lease} (id SMALLINT PRIMARY KEY, owner TEXT NOT NULL, token TEXT NOT NULL, acquired_at TIMESTAMPTZ NOT NULL)`,
    ),
  ];
}

function seedInitial(
  tx: SqlExecutor,
  tables: QualifiedTables,
  initial: CollaborationSnapshot,
): void {
  tx.query(
    taggedSql(
      "insert_snapshot",
      `INSERT INTO ${tables.snapshots} (snapshot_ref, payload) VALUES ($1, $2::jsonb) ON CONFLICT (snapshot_ref) DO NOTHING`,
    ),
    [initial.snapshotRef, encodeSnapshot(initial)],
  );
  tx.query(
    taggedSql(
      "seed_head",
      `INSERT INTO ${tables.head} (id, head_ref) VALUES (1, $1) ON CONFLICT (id) DO NOTHING`,
    ),
    [initial.snapshotRef],
  );
}

function assertWriter(
  tx: SqlExecutor,
  tables: QualifiedTables,
  owner: string,
  token: string,
): void {
  const lease = loadLease(tx, tables);
  if (lease === undefined || lease.token !== token || lease.owner !== owner) {
    throw new DurableAbort({ ok: false, reason: "fencing_stale" });
  }
}

function casHead(
  tx: SqlExecutor,
  tables: QualifiedTables,
  expected: SnapshotRef,
  snapshot: CollaborationSnapshot,
  binding: SchemaEpochBinding | undefined,
): boolean {
  const head = loadHead(tx, tables);
  if (head !== expected) {
    return false;
  }
  upsertSnapshot(tx, tables, snapshot);
  writeHead(tx, tables, snapshot.snapshotRef);
  if (binding !== undefined) {
    writeBinding(tx, tables, binding);
  }
  return true;
}

function commitInTransaction(
  tx: SqlExecutor,
  tables: QualifiedTables,
  input: DurableCommitInput,
): DurableCommitResult {
  const head = loadHead(tx, tables);
  if (head !== input.expectedHead) {
    throw new DurableAbort({ ok: false, reason: "head_mismatch" });
  }
  if (changeIdExists(tx, tables, input.change.changeId)) {
    throw new DurableAbort({ ok: false, reason: "duplicate_change_id" });
  }
  const chainReason = validateCommitChain(tx, tables, input);
  if (chainReason !== undefined) {
    throw new DurableAbort({ ok: false, reason: chainReason });
  }
  if (!insertSnapshotIfAbsent(tx, tables, input.after)) {
    throw new DurableAbort({ ok: false, reason: "after_ref_collision" });
  }
  if (!insertChange(tx, tables, input)) {
    throw new DurableAbort({ ok: false, reason: "changelog_append_failed" });
  }
  insertRecipe(tx, tables, input.change.changeId, input.recipe);
  writeHead(tx, tables, input.after.snapshotRef);
  return { ok: true };
}

function validateCommitChain(
  tx: SqlExecutor,
  tables: QualifiedTables,
  input: DurableCommitInput,
): string | undefined {
  const last = loadLastChange(tx, tables);
  if (last !== undefined) {
    if (!changeContinuesChain(last, input.change, (ref) => loadSnapshot(tx, tables, ref))) {
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

function loadLease(tx: SqlExecutor, tables: QualifiedTables): FencingLease | undefined {
  const result = tx.query(
    taggedSql("select_lease", `SELECT owner, token FROM ${tables.lease} WHERE id = 1 FOR UPDATE`),
  );
  const row = result.rows[0];
  if (row === undefined) {
    return undefined;
  }
  return { owner: asString(row.owner, "lease.owner"), token: asString(row.token, "lease.token") };
}

function loadHead(tx: SqlExecutor, tables: QualifiedTables): SnapshotRef | undefined {
  const result = tx.query(
    taggedSql("select_head", `SELECT head_ref FROM ${tables.head} WHERE id = 1 FOR UPDATE`),
  );
  const row = result.rows[0];
  if (row === undefined) {
    return undefined;
  }
  return asString(row.head_ref, "head_ref") as SnapshotRef;
}

function writeHead(tx: SqlExecutor, tables: QualifiedTables, headRef: SnapshotRef): void {
  tx.query(taggedSql("write_head", `UPDATE ${tables.head} SET head_ref = $1 WHERE id = 1`), [
    headRef,
  ]);
}

function loadSnapshot(
  tx: SqlExecutor,
  tables: QualifiedTables,
  ref: SnapshotRef,
): CollaborationSnapshot | undefined {
  const result = tx.query(
    taggedSql("select_snapshot", `SELECT payload FROM ${tables.snapshots} WHERE snapshot_ref = $1`),
    [ref],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return undefined;
  }
  return decodeStoredSnapshot(row.payload);
}

function insertSnapshotIfAbsent(
  tx: SqlExecutor,
  tables: QualifiedTables,
  snapshot: CollaborationSnapshot,
): boolean {
  const result = tx.query(
    taggedSql(
      "insert_snapshot",
      `INSERT INTO ${tables.snapshots} (snapshot_ref, payload) VALUES ($1, $2::jsonb) ON CONFLICT (snapshot_ref) DO NOTHING`,
    ),
    [snapshot.snapshotRef, encodeSnapshot(snapshot)],
  );
  return result.rowCount > 0;
}

function upsertSnapshot(
  tx: SqlExecutor,
  tables: QualifiedTables,
  snapshot: CollaborationSnapshot,
): void {
  tx.query(
    taggedSql(
      "upsert_snapshot",
      `INSERT INTO ${tables.snapshots} (snapshot_ref, payload) VALUES ($1, $2::jsonb) ON CONFLICT (snapshot_ref) DO UPDATE SET payload = EXCLUDED.payload`,
    ),
    [snapshot.snapshotRef, encodeSnapshot(snapshot)],
  );
}

function loadChanges(tx: SqlExecutor, tables: QualifiedTables): CoordinationChange[] {
  const result = tx.query(
    taggedSql("select_changes", `SELECT payload FROM ${tables.changes} ORDER BY seq ASC`),
  );
  return result.rows.map((row) => decodeStoredChange(row.payload));
}

function loadLastChange(tx: SqlExecutor, tables: QualifiedTables): CoordinationChange | undefined {
  const result = tx.query(
    taggedSql(
      "select_last_change",
      `SELECT payload FROM ${tables.changes} ORDER BY seq DESC LIMIT 1`,
    ),
  );
  const row = result.rows[0];
  if (row === undefined) {
    return undefined;
  }
  return decodeStoredChange(row.payload);
}

function changeIdExists(tx: SqlExecutor, tables: QualifiedTables, changeId: string): boolean {
  const result = tx.query(
    taggedSql("select_change_id", `SELECT 1 FROM ${tables.changes} WHERE change_id = $1`),
    [changeId],
  );
  return result.rowCount > 0 || result.rows.length > 0;
}

function insertChange(
  tx: SqlExecutor,
  tables: QualifiedTables,
  input: DurableCommitInput,
): boolean {
  const result = tx.query(
    taggedSql(
      "insert_change",
      `INSERT INTO ${tables.changes} (change_id, before_ref, after_ref, payload) VALUES ($1, $2, $3, $4::jsonb)`,
    ),
    [
      input.change.changeId,
      input.change.beforeRef,
      input.change.afterRef,
      encodeChangeWithRecipe(input.change, input.recipe),
    ],
  );
  return result.rowCount > 0;
}

function insertRecipe(
  tx: SqlExecutor,
  tables: QualifiedTables,
  changeId: string,
  recipe: ReplayRecipe,
): void {
  tx.query(
    taggedSql(
      "insert_recipe",
      `INSERT INTO ${tables.recipes} (change_id, payload) VALUES ($1, $2::jsonb)`,
    ),
    [changeId, snapshotReplayRecipe(recipe)],
  );
}

function loadRecipe(
  tx: SqlExecutor,
  tables: QualifiedTables,
  changeId: string,
): ReplayRecipe | undefined {
  const result = tx.query(
    taggedSql("select_recipe", `SELECT payload FROM ${tables.recipes} WHERE change_id = $1`),
    [changeId],
  );
  const row = result.rows[0];
  if (row === undefined) {
    return undefined;
  }
  return decodeStoredRecipe(row.payload);
}

function loadBinding(tx: SqlExecutor, tables: QualifiedTables): SchemaEpochBinding | undefined {
  const result = tx.query(
    taggedSql("select_binding", `SELECT payload FROM ${tables.epochBinding} WHERE id = 1`),
  );
  const row = result.rows[0];
  if (row === undefined) {
    return undefined;
  }
  return decodeStoredBinding(row.payload);
}

function writeBinding(tx: SqlExecutor, tables: QualifiedTables, binding: SchemaEpochBinding): void {
  tx.query(
    taggedSql(
      "upsert_binding",
      `INSERT INTO ${tables.epochBinding} (id, payload) VALUES (1, $1::jsonb) ON CONFLICT (id) DO UPDATE SET payload = EXCLUDED.payload`,
    ),
    [serializeSchemaBindingWire(binding)],
  );
}

function decodeStoredSnapshot(payload: unknown): CollaborationSnapshot {
  const decoded = decodeSnapshotFromUnknown(asJsonPayload(payload));
  if (isRuntimeViolation(decoded)) {
    throw new Error(`postgres durable: invalid snapshot payload: ${decoded.message}`);
  }
  return decoded;
}

function decodeStoredChange(payload: unknown): CoordinationChange {
  const decoded = decodeChangeFromUnknown(asJsonPayload(payload));
  if (isRuntimeViolation(decoded)) {
    throw new Error(`postgres durable: invalid change payload: ${decoded.message}`);
  }
  return snapshotCoordinationChange(decoded.change);
}

function decodeStoredBinding(payload: unknown): SchemaEpochBinding {
  const parsed = parseSchemaBindingWire(asJsonPayload(payload));
  if (!parsed.ok) {
    throw new Error(`postgres durable: invalid epoch binding: ${parsed.violation.message}`);
  }
  return parsed.value;
}

function decodeStoredRecipe(payload: unknown): ReplayRecipe {
  const value = asJsonPayload(payload);
  if (value === null || typeof value !== "object") {
    throw new Error("postgres durable: invalid recipe payload");
  }
  return snapshotReplayRecipe(value as ReplayRecipe);
}

function asJsonPayload(value: unknown): unknown {
  if (typeof value === "string") {
    return JSON.parse(value);
  }
  return value;
}

function asString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`postgres durable: expected non-empty string at ${label}`);
  }
  return value;
}

function isRuntimeViolation(value: unknown): value is RuntimeViolation {
  return typeof value === "object" && value !== null && "code" in value && "message" in value;
}
