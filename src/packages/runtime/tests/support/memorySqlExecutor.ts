import {
  readSqlTag,
  type SqlExecutor,
  type SqlQueryResult,
  type SqlTag,
} from "../../src/memory/postgresSqlExecutor.js";

export interface MemorySqlState {
  head: string | undefined;
  snapshots: Map<string, unknown>;
  changes: MemoryChangeRow[];
  recipes: Map<string, unknown>;
  binding: unknown | undefined;
  lease: { owner: string; token: string } | undefined;
  nextSeq: number;
  failNextInsertChange: boolean;
}

export interface MemoryChangeRow {
  seq: number;
  changeId: string;
  beforeRef: string;
  afterRef: string;
  payload: unknown;
}

export interface MemorySqlHarness {
  readonly executor: SqlExecutor;
  readonly state: MemorySqlState;
}

type TagHandler = (state: MemorySqlState, params: readonly unknown[]) => SqlQueryResult;

const TAG_HANDLERS: Record<SqlTag, TagHandler> = {
  ensure_ddl: () => emptyResult(),
  select_lease: (state) => {
    if (state.lease === undefined) {
      return emptyResult();
    }
    return rows([{ owner: state.lease.owner, token: state.lease.token }]);
  },
  upsert_lease: (state, params) => {
    state.lease = { owner: String(params[0]), token: String(params[1]) };
    return { rows: [], rowCount: 1 };
  },
  select_head: (state) => {
    if (state.head === undefined) {
      return emptyResult();
    }
    return rows([{ head_ref: state.head }]);
  },
  write_head: (state, params) => {
    state.head = String(params[0]);
    return { rows: [], rowCount: 1 };
  },
  seed_head: (state, params) => {
    if (state.head !== undefined) {
      return emptyResult();
    }
    state.head = String(params[0]);
    return { rows: [], rowCount: 1 };
  },
  select_snapshot: (state, params) => {
    const payload = state.snapshots.get(String(params[0]));
    if (payload === undefined) {
      return emptyResult();
    }
    return rows([{ payload }]);
  },
  insert_snapshot: (state, params) => {
    const ref = String(params[0]);
    if (state.snapshots.has(ref)) {
      return emptyResult();
    }
    state.snapshots.set(ref, params[1]);
    return { rows: [], rowCount: 1 };
  },
  upsert_snapshot: (state, params) => {
    state.snapshots.set(String(params[0]), params[1]);
    return { rows: [], rowCount: 1 };
  },
  select_changes: (state) => rows(state.changes.map((change) => ({ payload: change.payload }))),
  select_last_change: (state) => {
    const last = state.changes.at(-1);
    if (last === undefined) {
      return emptyResult();
    }
    return rows([{ payload: last.payload }]);
  },
  select_change_id: (state, params) => {
    const found = state.changes.some((change) => change.changeId === String(params[0]));
    if (!found) {
      return emptyResult();
    }
    return rows([{ "?column?": 1 }]);
  },
  insert_change: (state, params) => {
    if (state.failNextInsertChange) {
      state.failNextInsertChange = false;
      return emptyResult();
    }
    const changeId = String(params[0]);
    if (state.changes.some((change) => change.changeId === changeId)) {
      return emptyResult();
    }
    state.changes.push({
      seq: state.nextSeq,
      changeId,
      beforeRef: String(params[1]),
      afterRef: String(params[2]),
      payload: params[3],
    });
    state.nextSeq += 1;
    return { rows: [], rowCount: 1 };
  },
  insert_recipe: (state, params) => {
    state.recipes.set(String(params[0]), params[1]);
    return { rows: [], rowCount: 1 };
  },
  select_recipe: (state, params) => {
    const payload = state.recipes.get(String(params[0]));
    if (payload === undefined) {
      return emptyResult();
    }
    return rows([{ payload }]);
  },
  select_binding: (state) => {
    if (state.binding === undefined) {
      return emptyResult();
    }
    return rows([{ payload: state.binding }]);
  },
  upsert_binding: (state, params) => {
    state.binding = params[0];
    return { rows: [], rowCount: 1 };
  },
};

export function createMemorySqlHarness(): MemorySqlHarness {
  const state: MemorySqlState = {
    head: undefined,
    snapshots: new Map(),
    changes: [],
    recipes: new Map(),
    binding: undefined,
    lease: undefined,
    nextSeq: 1,
    failNextInsertChange: false,
  };

  const run = (sql: string, params: readonly unknown[] = []): SqlQueryResult => {
    const trimmed = sql.trim();
    if (/^(BEGIN|COMMIT|ROLLBACK)\b/i.test(trimmed)) {
      return emptyResult();
    }
    const tag = readSqlTag(sql);
    if (tag === undefined) {
      throw new Error(`memory SqlExecutor: unrecognized SQL: ${sql}`);
    }
    return TAG_HANDLERS[tag](state, params);
  };

  const executor: SqlExecutor = {
    query: run,
    transaction(work) {
      const snapshot = cloneState(state);
      try {
        return work(executor);
      } catch (error) {
        assignState(state, snapshot);
        throw error;
      }
    },
  };

  return { executor, state };
}

function emptyResult(): SqlQueryResult {
  return { rows: [], rowCount: 0 };
}

function rows(values: Record<string, unknown>[]): SqlQueryResult {
  return { rows: values, rowCount: values.length };
}

function cloneState(state: MemorySqlState): MemorySqlState {
  return {
    head: state.head,
    snapshots: new Map(state.snapshots),
    changes: state.changes.map((change) => ({ ...change })),
    recipes: new Map(state.recipes),
    binding: state.binding,
    lease: state.lease === undefined ? undefined : { ...state.lease },
    nextSeq: state.nextSeq,
    failNextInsertChange: state.failNextInsertChange,
  };
}

function assignState(target: MemorySqlState, source: MemorySqlState): void {
  target.head = source.head;
  target.snapshots = new Map(source.snapshots);
  target.changes = source.changes.map((change) => ({ ...change }));
  target.recipes = new Map(source.recipes);
  target.binding = source.binding;
  target.lease = source.lease === undefined ? undefined : { ...source.lease };
  target.nextSeq = source.nextSeq;
  target.failNextInsertChange = source.failNextInsertChange;
}
