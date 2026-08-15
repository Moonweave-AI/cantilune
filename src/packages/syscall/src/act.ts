import {
  ACTOR_KINDS,
  MATCH_BINDING_ROLES,
  operationTypeId,
  matchBinding,
  coordinationIntent,
  contentRef,
  actorId as coreActorId,
  actorRef,
} from "@cantilune/core";
import type { MatchBinding, ActorKind, ContentRef, OperationScalarInputs } from "@cantilune/core";
import { createContentHasher, isSha256ContentRef } from "@cantilune/content";
import { createHash } from "node:crypto";
import type {
  SyscallRuntime,
  SyscallContentStore,
  SyscallPrincipal,
  ActionCall,
  ActionResult,
  ToolCall,
  ToolResult,
  ToolObservationRecovery,
  ToolObservationRetryResult,
  ToolExecutor,
  ToolInvocationKey,
  ToolReconcileResult,
  OperationSchemaProvider,
  AvailableTemplate,
} from "./syscall.js";

const TOOL_OBSERVATION_RECEIPT_KIND = "cantilune.external-tool-observation-recovery";
const TOOL_OBSERVATION_RECEIPT_VERSION = 1;
const TOOL_OBSERVATION_RECEIPT_MIME = "application/vnd.cantilune.tool-observation-recovery+json";
const TOOL_OBSERVATION_RECEIPT_CREATOR = "cantilune:tool-observation-recovery:v1";
const TOOL_INVOCATION_INTENT_KIND = "cantilune.external-tool-invocation-intent";
const TOOL_INVOCATION_INTENT_VERSION = 1;
const TOOL_INVOCATION_INTENT_MIME = "application/vnd.cantilune.tool-invocation-intent+json";
const TOOL_INVOCATION_INTENT_CREATOR = "cantilune:tool-invocation-intent:v1";
const SHA256_DIGEST = /^sha256:[0-9a-f]{64}$/u;
const NON_NEGATIVE_INTEGER = /^(?:0|[1-9][0-9]*)$/u;

// Derived from core rather than restated: a role or kind added there but not
// here was silently dropped from every intent this layer built.
const VALID_BINDING_ROLES: ReadonlySet<string> = new Set<string>(MATCH_BINDING_ROLES);
const VALID_ACTOR_KINDS: ReadonlySet<string> = new Set<string>(ACTOR_KINDS);

type ContentInputResult =
  | { readonly ok: true; readonly refs: readonly ContentRef[] }
  | { readonly ok: false; readonly message: string };

type ScalarInputResult =
  | { readonly ok: true; readonly inputs: OperationScalarInputs }
  | { readonly ok: false; readonly message: string };

function templateDeclarationError(
  template: AvailableTemplate,
  operation: string,
): string | undefined {
  const names = new Map<string, string>();
  const declarations = [
    ...template.requiredRoles.map((name) => ({ name, kind: "binding role" })),
    ...(template.contentRefInputs ?? []).map(({ name }) => ({ name, kind: "contentRef input" })),
    ...(template.scalarInputs ?? []).map(({ name }) => ({ name, kind: "scalar input" })),
  ];
  for (const declaration of declarations) {
    if (declaration.name === "") {
      return `Operation "${operation}" has an invalid template: input names must be non-empty.`;
    }
    const previous = names.get(declaration.name);
    if (previous !== undefined) {
      return (
        `Operation "${operation}" has an invalid template: "${declaration.name}" is declared ` +
        `as both ${previous} and ${declaration.kind}.`
      );
    }
    names.set(declaration.name, declaration.kind);
  }
  for (const declaration of template.scalarInputs ?? []) {
    if (declaration.type !== "string" && declaration.type !== "nonNegativeInteger") {
      return (
        `Operation "${operation}" has an invalid template: scalar input ` +
        `"${declaration.name}" has unsupported type "${String(declaration.type)}".`
      );
    }
  }
  return undefined;
}

async function resolveContentInputs(
  template: AvailableTemplate,
  call: ActionCall,
  contentStore: Pick<SyscallContentStore, "exists"> | undefined,
): Promise<ContentInputResult> {
  const contentRefInputs = template.contentRefInputs ?? [];
  const refs: ContentRef[] = [];
  for (const input of contentRefInputs) {
    const value = call.args[input.name];
    if (value === undefined || value === "") continue;
    if (!isSha256ContentRef(value)) {
      return {
        ok: false,
        message: `Operation "${call.operation}" parameter "${input.name}" must be a valid sha256 ContentRef.`,
      };
    }
    const ref = contentRef(value);
    if (contentStore !== undefined && !(await contentStore.exists(ref))) {
      return {
        ok: false,
        message:
          `Operation "${call.operation}" parameter "${input.name}" references unavailable content ` +
          `${value}. Store it with write_content first.`,
      };
    }
    refs.push(ref);
  }
  return { ok: true, refs };
}

function resolveScalarInputs(template: AvailableTemplate, call: ActionCall): ScalarInputResult {
  const entries: [string, string | number | boolean][] = [];
  for (const declaration of template.scalarInputs ?? []) {
    const raw = call.args[declaration.name];
    if (raw === undefined || raw === "") continue;
    if (declaration.type === "string") {
      entries.push([declaration.name, raw]);
      continue;
    }
    if (!NON_NEGATIVE_INTEGER.test(raw)) {
      return {
        ok: false,
        message:
          `Operation "${call.operation}" parameter "${declaration.name}" must be a canonical ` +
          "non-negative integer string.",
      };
    }
    const parsed = Number(raw);
    if (!Number.isSafeInteger(parsed)) {
      return {
        ok: false,
        message:
          `Operation "${call.operation}" parameter "${declaration.name}" exceeds the safe ` +
          "integer range.",
      };
    }
    entries.push([declaration.name, parsed]);
  }
  return { ok: true, inputs: Object.fromEntries(entries) };
}

/**
 * Parse LLM tool_call → CoordinationIntent → runtime.proposeAndCommit().
 * Pure translation: no strategy. If runtime rejects, returns error message for LLM.
 *
 * Binding roles are derived from the schema template, not hardcoded.
 */
export async function act(
  runtime: SyscallRuntime,
  principal: SyscallPrincipal,
  schemaProvider: OperationSchemaProvider,
  call: ActionCall,
  contentStore?: Pick<SyscallContentStore, "exists">,
): Promise<ActionResult> {
  const templates = schemaProvider.getTemplates();
  const template = templates.find((t) => (t.operationTypeId as string) === call.operation);

  if (template === undefined) {
    const available = templates.map((t) => t.operationTypeId as string).join(", ");
    return {
      ok: false,
      message: `Unknown operation: "${call.operation}". Available operations: [${available}]`,
      newHeadRef: undefined,
    };
  }

  const declarationError = templateDeclarationError(template, call.operation);
  if (declarationError !== undefined) {
    return { ok: false, message: declarationError, newHeadRef: undefined };
  }

  const contentRefInputs = template.contentRefInputs ?? [];
  const scalarInputs = template.scalarInputs ?? [];
  const requiredContentRefInputs = contentRefInputs.filter((input) => input.required !== false);
  const requiredScalarInputs = scalarInputs.filter((input) => input.required !== false);
  const missingParameters = [
    ...template.requiredRoles.filter((role) => !(role in call.args) || call.args[role] === ""),
    ...requiredContentRefInputs
      .filter((input) => !(input.name in call.args) || call.args[input.name] === "")
      .map((input) => input.name),
    ...requiredScalarInputs
      .filter((input) => !(input.name in call.args) || call.args[input.name] === "")
      .map((input) => input.name),
  ];
  if (missingParameters.length > 0) {
    return {
      ok: false,
      message: `Operation "${call.operation}" requires parameters: [${missingParameters.join(", ")}]. You provided: [${Object.keys(call.args).join(", ")}]`,
      newHeadRef: undefined,
    };
  }

  const contentInputs = await resolveContentInputs(template, call, contentStore);
  if (!contentInputs.ok) {
    return { ok: false, message: contentInputs.message, newHeadRef: undefined };
  }
  const resolvedScalarInputs = resolveScalarInputs(template, call);
  if (!resolvedScalarInputs.ok) {
    return { ok: false, message: resolvedScalarInputs.message, newHeadRef: undefined };
  }

  const templateRoles = new Set(template.requiredRoles);
  const validEntries = Object.entries(call.args)
    .filter(([_, v]) => v !== "")
    .filter(([role]) => templateRoles.has(role));

  const bindings: MatchBinding[] = [];
  for (const [role, value] of validEntries) {
    if (!VALID_BINDING_ROLES.has(role)) continue;
    const binding = matchBinding(role as MatchBinding["role"], value);
    bindings.push(binding);
  }

  if (template.requiredRoles.length > 0 && bindings.length === 0) {
    return {
      ok: false,
      message: `Operation "${call.operation}": none of the provided args [${Object.keys(call.args).join(", ")}] match known binding roles.`,
      newHeadRef: undefined,
    };
  }

  // Refused rather than coerced to "agent": silently rewriting the caller's
  // declared kind submits an intent under an identity nobody asked for, and
  // admission then judges it against the wrong role bindings.
  if (!VALID_ACTOR_KINDS.has(principal.kind)) {
    return {
      ok: false,
      message:
        `Operation "${call.operation}" refused: principal kind "${principal.kind}" is not one of ` +
        `[${ACTOR_KINDS.join(", ")}].`,
      newHeadRef: undefined,
    };
  }
  const principalRef = actorRef(coreActorId(principal.actorId), principal.kind as ActorKind);
  const intent = coordinationIntent(
    principalRef,
    operationTypeId(call.operation),
    bindings,
    undefined,
    contentInputs.refs.length > 0 ? contentInputs.refs : undefined,
    Object.keys(resolvedScalarInputs.inputs).length > 0 ? resolvedScalarInputs.inputs : undefined,
  );

  return commitIntent(runtime, call.operation, intent);
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return "[unknown error]";
}

/** Canonical digest shared by execution receipts and boot's exact-retry lookup. */
export function toolArgumentsDigest(args: Readonly<Record<string, unknown>>): string | undefined {
  return canonicalToolArguments(args)?.digest;
}

function canonicalToolArguments(
  args: Readonly<Record<string, unknown>>,
): { readonly args: Record<string, unknown>; readonly digest: string } | undefined {
  try {
    const normalized = canonicalJson(args, new WeakSet<object>());
    if (normalized === null || typeof normalized !== "object" || Array.isArray(normalized)) {
      return undefined;
    }
    const canonical = JSON.stringify(normalized);
    return {
      // canonicalJson constructs a fresh deep tree, so the executor cannot
      // mutate the caller's arguments or change the identity already signed.
      args: normalized as Record<string, unknown>,
      digest: `sha256:${createHash("sha256").update(canonical).digest("hex")}`,
    };
  } catch {
    return undefined;
  }
}

function canonicalJson(value: unknown, ancestors: WeakSet<object>): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  ) {
    return value;
  }
  if (typeof value !== "object") throw new TypeError("tool arguments must be JSON values");
  if (ancestors.has(value)) throw new TypeError("cyclic tool arguments");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) return value.map((entry) => canonicalJson(entry, ancestors));
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      throw new TypeError("tool arguments must be plain JSON objects");
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalJson(entry, ancestors)]),
    );
  } finally {
    ancestors.delete(value);
  }
}

function requireToolExecutorResult(value: unknown): {
  readonly ok: boolean;
  readonly output: string;
} {
  let detached: unknown;
  try {
    detached = structuredClone(value);
  } catch {
    throw new TypeError("Tool executor returned a non-cloneable result.");
  }
  if (
    detached === null ||
    typeof detached !== "object" ||
    Array.isArray(detached) ||
    Object.getPrototypeOf(detached) !== Object.prototype
  ) {
    throw new TypeError("Tool executor returned an invalid result.");
  }
  const record = detached as Record<string, unknown>;
  if ((record["ok"] !== true && record["ok"] !== false) || typeof record["output"] !== "string") {
    throw new TypeError("Tool executor returned an invalid result.");
  }
  return { ok: record["ok"], output: record["output"] };
}

interface ToolObservationReceipt {
  readonly kind: typeof TOOL_OBSERVATION_RECEIPT_KIND;
  readonly version: typeof TOOL_OBSERVATION_RECEIPT_VERSION;
  readonly principal: { readonly actorId: string; readonly kind: string };
  readonly toolName: string;
  readonly originalToolCallId: string;
  readonly argumentsDigest: string;
  readonly outputRef: string;
}

function receiptText(receipt: ToolObservationReceipt): string {
  return JSON.stringify(receipt);
}

/**
 * Pre-invocation journal entry (ADR-0016). A content-addressed blob written
 * BEFORE `toolExecutor.execute` so a crash at any of the four boundaries is
 * recoverable. The blob is immutable, so the lifecycle is two blobs keyed by
 * the same idempotency tuple but with a different `status` field:
 * - `dispatched`  : written before execute; its presence with no `completed`
 *                   blob means the run crashed mid-invocation.
 * - `completed`   : written after a successful execute/reconcile; its presence
 *                   means the invocation already produced its output.
 *
 * Because `ContentStore` is content-addressed, the ref of a journal blob is
 * `sha256(canonicalIntentBytes)` — a pure function of the idempotency key +
 * status. The run derives that ref deterministically (it never relies on a
 * list/index API) and probes the store with `exists(ref)` / `get(ref)`.
 */
interface ToolInvocationIntent {
  readonly kind: typeof TOOL_INVOCATION_INTENT_KIND;
  readonly version: typeof TOOL_INVOCATION_INTENT_VERSION;
  readonly principal: { readonly actorId: string; readonly kind: string };
  readonly toolName: string;
  readonly originalToolCallId: string;
  readonly argumentsDigest: string;
  readonly status: "dispatched" | "completed";
  /** Present only on a `completed` entry: the durable output ref produced. */
  readonly outputRef?: string;
}

/** Fixed key order so the intent's bytes — and therefore its ref — are stable. */
const INTENT_FIELD_ORDER = [
  "argumentsDigest",
  "kind",
  "originalToolCallId",
  "outputRef",
  "principal",
  "status",
  "toolName",
  "version",
] as const;

function intentText(intent: ToolInvocationIntent): string {
  // Re-serialize in the fixed field order so the bytes (and thus the ref) are
  // independent of the object's insertion order. outputRef is omitted when
  // undefined (dispatched entry), included when set (completed entry).
  const ordered: Record<string, unknown> = {};
  for (const field of INTENT_FIELD_ORDER) {
    if (field === "outputRef") {
      if (intent.outputRef !== undefined) ordered[field] = intent.outputRef;
    } else {
      ordered[field] = (intent as unknown as Record<string, unknown>)[field];
    }
  }
  return JSON.stringify(ordered);
}

/** Build the deterministic idempotency key for an invocation. */
function invocationKey(
  principal: SyscallPrincipal,
  toolName: string,
  argumentsDigest: string,
  originalToolCallId: string,
): ToolInvocationKey {
  return {
    principal: { actorId: principal.actorId, kind: principal.kind },
    toolName,
    argumentsDigest,
    originalToolCallId,
  };
}

/** Derive the deterministic ContentRef under which a journal status blob lives. */
export function intentRef(
  key: ToolInvocationKey,
  status: "dispatched" | "completed",
  outputRef?: ContentRef,
): ContentRef {
  const intent: ToolInvocationIntent = {
    kind: TOOL_INVOCATION_INTENT_KIND,
    version: TOOL_INVOCATION_INTENT_VERSION,
    principal: key.principal,
    toolName: key.toolName,
    originalToolCallId: key.originalToolCallId,
    argumentsDigest: key.argumentsDigest,
    status,
    ...(outputRef !== undefined ? { outputRef: String(outputRef) } : {}),
  };
  const bytes = new TextEncoder().encode(intentText(intent));
  return createContentHasher()(bytes);
}

/** Read and strictly validate a journal blob at a deterministic ref. */
export async function readIntent(
  contentStore: SyscallContentStore,
  ref: ContentRef,
): Promise<ToolInvocationIntent | undefined> {
  let blob;
  try {
    blob = await contentStore.get(ref);
  } catch {
    return undefined;
  }
  if (blob === undefined) return undefined;
  if (
    blob.metadata.mimeType !== TOOL_INVOCATION_INTENT_MIME ||
    blob.metadata.createdBy !== TOOL_INVOCATION_INTENT_CREATOR ||
    blob.metadata.size !== blob.bytes.length
  ) {
    return undefined;
  }
  if (createContentHasher()(blob.bytes) !== ref) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(blob.bytes));
  } catch {
    return undefined;
  }
  return strictIntent(parsed);
}

export function strictIntent(value: unknown): ToolInvocationIntent | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const hasOutput = "outputRef" in record;
  const expected = hasOutput
    ? ["argumentsDigest", "kind", "originalToolCallId", "outputRef", "principal", "status", "toolName", "version"]
    : ["argumentsDigest", "kind", "originalToolCallId", "principal", "status", "toolName", "version"];
  if (!exactKeys(record, expected)) return undefined;
  const principal = record["principal"];
  if (principal === null || typeof principal !== "object" || Array.isArray(principal)) return undefined;
  const principalRecord = principal as Record<string, unknown>;
  if (!exactKeys(principalRecord, ["actorId", "kind"])) return undefined;
  if (
    record["kind"] !== TOOL_INVOCATION_INTENT_KIND ||
    record["version"] !== TOOL_INVOCATION_INTENT_VERSION ||
    (record["status"] !== "dispatched" && record["status"] !== "completed") ||
    typeof principalRecord["actorId"] !== "string" ||
    typeof principalRecord["kind"] !== "string" ||
    typeof record["toolName"] !== "string" ||
    typeof record["originalToolCallId"] !== "string" ||
    typeof record["argumentsDigest"] !== "string" ||
    (hasOutput && typeof record["outputRef"] !== "string")
  ) {
    return undefined;
  }
  return {
    kind: TOOL_INVOCATION_INTENT_KIND,
    version: TOOL_INVOCATION_INTENT_VERSION,
    principal: { actorId: principalRecord["actorId"], kind: principalRecord["kind"] },
    toolName: record["toolName"],
    originalToolCallId: record["originalToolCallId"],
    argumentsDigest: record["argumentsDigest"],
    status: record["status"],
    ...(hasOutput ? { outputRef: record["outputRef"] as string } : {}),
  };
}

/** Write a journal status blob. Returns the ref (always the deterministic one). */
async function writeIntent(
  contentStore: SyscallContentStore,
  key: ToolInvocationKey,
  status: "dispatched" | "completed",
  outputRef?: ContentRef,
): Promise<ContentRef> {
  const intent: ToolInvocationIntent = {
    kind: TOOL_INVOCATION_INTENT_KIND,
    version: TOOL_INVOCATION_INTENT_VERSION,
    principal: key.principal,
    toolName: key.toolName,
    originalToolCallId: key.originalToolCallId,
    argumentsDigest: key.argumentsDigest,
    status,
    ...(outputRef !== undefined ? { outputRef: String(outputRef) } : {}),
  };
  const ref = intentRef(key, status, outputRef);
  const text = intentText(intent);
  await contentStore.put(text, {
    mimeType: TOOL_INVOCATION_INTENT_MIME,
    createdBy: TOOL_INVOCATION_INTENT_CREATOR,
  });
  // The store is content-addressed, so the blob lives at the derived ref whether
  // this call wrote it or a concurrent writer did (identical bytes → same ref).
  return ref;
}

async function createObservationRecovery(
  contentStore: SyscallContentStore,
  principal: SyscallPrincipal,
  call: Pick<ToolCall, "callId" | "toolName">,
  argumentsDigest: string,
  outputRef: ContentRef,
): Promise<ToolObservationRecovery | undefined> {
  const originalToolCallId = call.callId;
  if (originalToolCallId === "" || !SHA256_DIGEST.test(argumentsDigest)) {
    return undefined;
  }
  const receipt: ToolObservationReceipt = {
    kind: TOOL_OBSERVATION_RECEIPT_KIND,
    version: TOOL_OBSERVATION_RECEIPT_VERSION,
    principal: { actorId: principal.actorId, kind: principal.kind },
    toolName: call.toolName,
    originalToolCallId,
    argumentsDigest,
    outputRef: String(outputRef),
  };
  const receiptRef = await contentStore.put(receiptText(receipt), {
    mimeType: TOOL_OBSERVATION_RECEIPT_MIME,
    createdBy: TOOL_OBSERVATION_RECEIPT_CREATOR,
  });
  return {
    toolName: call.toolName,
    originalToolCallId,
    argumentsDigest,
    outputRef,
    receiptRef,
  };
}

function failedObservationResult(
  output: string,
  outputRef: ContentRef,
  warning: string,
  observationRecovery: ToolObservationRecovery | undefined,
): ToolResult {
  return {
    ok: false,
    output,
    contentRef: outputRef,
    observeWarning: warning,
    observationRecovery,
  };
}

function commitIntent(
  runtime: SyscallRuntime,
  operation: string,
  intent: ReturnType<typeof coordinationIntent>,
): ActionResult {
  let result;
  try {
    result = runtime.proposeAndCommit(intent);
  } catch (err: unknown) {
    return {
      ok: false,
      message: `Operation "${operation}" error: ${errorMessage(err)}`,
      newHeadRef: undefined,
    };
  }

  if (!result || typeof result !== "object") {
    return {
      ok: false,
      message: `Operation "${operation}" rejected: unknown error`,
      newHeadRef: undefined,
    };
  }

  if ("ok" in result && result.ok === true) {
    if (
      !("newHeadRef" in result) ||
      typeof result.newHeadRef !== "string" ||
      result.newHeadRef === ""
    ) {
      return {
        ok: false,
        message: `Operation "${operation}" rejected: runtime omitted the commit receipt`,
        newHeadRef: undefined,
      };
    }
    return {
      ok: true,
      message: `Operation "${operation}" committed successfully.`,
      newHeadRef: result.newHeadRef,
    };
  }

  if (!("ok" in result) || result.ok !== false) {
    return {
      ok: false,
      message: `Operation "${operation}" rejected: invalid runtime result`,
      newHeadRef: undefined,
    };
  }

  return {
    ok: false,
    message: `Operation "${operation}" rejected: ${
      typeof result.message === "string" ? result.message : "unknown error"
    }`,
    newHeadRef: undefined,
  };
}

/**
 * Invoke external tool → store result → observe in runtime.
 * Checks observe() return strictly via ok field.
 */
export async function useTool(
  runtime: SyscallRuntime,
  contentStore: SyscallContentStore,
  principal: SyscallPrincipal,
  toolExecutor: ToolExecutor | undefined,
  call: ToolCall,
): Promise<ToolResult> {
  if (toolExecutor === undefined) {
    return {
      ok: false,
      output: "No tool executor configured.",
      contentRef: undefined,
      observeWarning: undefined,
      observationRecovery: undefined,
    };
  }

  if (!call.toolName) {
    return {
      ok: false,
      output: "Tool name is required.",
      contentRef: undefined,
      observeWarning: undefined,
      observationRecovery: undefined,
    };
  }

  const canonicalArguments = canonicalToolArguments(call.args);
  if (call.callId === "" || canonicalArguments === undefined) {
    return {
      ok: false,
      output: "A non-empty callId and canonical JSON arguments are required before tool execution.",
      contentRef: undefined,
      observeWarning: undefined,
      observationRecovery: undefined,
    };
  }

  // ADR-0016: the idempotency key. The same tuple already authenticates the
  // observation-recovery receipt, so one key validates journal and receipt.
  const key = invocationKey(
    principal,
    call.toolName,
    canonicalArguments.digest,
    call.callId,
  );
  const tier: NonNullable<ToolExecutor["tier"]> =
    toolExecutor.tierFor?.(call.toolName) ?? toolExecutor.tier ?? "non-idempotent";

  // The recoverable artifact is the `dispatched` journal entry. It is written
  // before execute and is content-addressed by a ref that depends only on
  // (key, "dispatched") — it carries no outputRef, so it is findable from the
  // idempotency key alone after a crash. The `completed` entry (written after
  // the output is durable) carries the outputRef in its bytes and is therefore
  // NOT findable from the key under a content-addressed store; it is retained
  // only for observability and does not drive recovery. See ADR-0016 §4.
  //
  // Boundary 1 — dispatched but not completed: a prior run wrote `dispatched`
  // and crashed before producing durable output. Re-dispatching may double a
  // side effect, so branch on the tool's tier (ADR-0016 §4).
  const dispatchedRef = intentRef(key, "dispatched");
  const dispatched = await readIntent(contentStore, dispatchedRef);
  if (dispatched !== undefined) {
    if (tier === "read") {
      // No side effect: safe to re-dispatch.
      return dispatchAndCommit(
        runtime,
        contentStore,
        principal,
        toolExecutor,
        call,
        canonicalArguments,
        key,
      );
    }
    if (tier === "idempotent") {
      if (toolExecutor.reconcile === undefined) {
        return ambiguousFailure(key, "Idempotent tool declared no reconcile method.");
      }
      let reconciled: ToolReconcileResult;
      try {
        reconciled = await toolExecutor.reconcile(key);
      } catch {
        return ambiguousFailure(key, "Tool reconcile raised an error.");
      }
      if (reconciled.status === "known") {
        // Reuse the prior output without re-executing the side effect.
        return commitReconciledOutput(
          runtime,
          contentStore,
          principal,
          call,
          canonicalArguments,
          key,
          reconciled.output,
        );
      }
      // status === "unknown": the side effect did not land; safe to re-dispatch.
      return dispatchAndCommit(
        runtime,
        contentStore,
        principal,
        toolExecutor,
        call,
        canonicalArguments,
        key,
      );
    }
    // tier === "non-idempotent": MUST NOT re-dispatch (ADR-0016).
    return ambiguousFailure(key, "Non-idempotent tool was dispatched but produced no durable output.");
  }

  // Fresh invocation: write the `dispatched` journal entry first, then execute.
  await writeIntent(contentStore, key, "dispatched");
  return dispatchAndCommit(
    runtime,
    contentStore,
    principal,
    toolExecutor,
    call,
    canonicalArguments,
    key,
  );
}

/** Typed failure for a non-idempotent tool that may have already side-effected. */
function ambiguousFailure(key: ToolInvocationKey, reason: string): ToolResult {
  return {
    ok: false,
    output: `Ambiguous external-tool invocation for ${key.toolName} ` +
      `(callId ${key.originalToolCallId}): ${reason} ` +
      `An operator must verify whether the side effect landed before retrying.`,
    contentRef: undefined,
    observeWarning: undefined,
    observationRecovery: undefined,
    disposition: "ambiguous",
  };
}

/** Execute the tool, store the output, write the completed journal, observe. */
async function dispatchAndCommit(
  runtime: SyscallRuntime,
  contentStore: SyscallContentStore,
  principal: SyscallPrincipal,
  toolExecutor: ToolExecutor,
  call: ToolCall,
  canonicalArguments: { readonly args: Record<string, unknown>; readonly digest: string },
  key: ToolInvocationKey,
): Promise<ToolResult> {
  let execResult: { readonly ok: boolean; readonly output: string };
  try {
    execResult = requireToolExecutorResult(
      await toolExecutor.execute(call.toolName, canonicalArguments.args),
    );
  } catch {
    return {
      ok: false,
      output: "Tool executor returned an invalid result.",
      contentRef: undefined,
      observeWarning: undefined,
      observationRecovery: undefined,
    };
  }

  if (!execResult.ok) {
    return {
      ok: false,
      output: execResult.output,
      contentRef: undefined,
      observeWarning: undefined,
      observationRecovery: undefined,
    };
  }

  return commitReconciledOutput(runtime, contentStore, principal, call, canonicalArguments, key, execResult.output);
}

/** Store an output (from execute or reconcile), journal `completed`, observe. */
async function commitReconciledOutput(
  runtime: SyscallRuntime,
  contentStore: SyscallContentStore,
  principal: SyscallPrincipal,
  call: ToolCall,
  canonicalArguments: { readonly args: Record<string, unknown>; readonly digest: string },
  key: ToolInvocationKey,
  output: string,
): Promise<ToolResult> {
  const ref = await contentStore.put(output, {
    mimeType: "text/plain",
    createdBy: `tool:${call.toolName}`,
  });
  const observationRecovery = await createObservationRecovery(
    contentStore,
    principal,
    call,
    canonicalArguments.digest,
    ref,
  );
  // ADR-0016 §4 step 5: mark the invocation completed with its durable output.
  await writeIntent(contentStore, key, "completed", ref);

  const principalRef = { actorId: principal.actorId, kind: principal.kind };
  let observeResult: { readonly ok: boolean; readonly message?: string };
  try {
    observeResult = materializeObserveResult(
      runtime.observe({ source: principalRef, payloadRef: ref }, { principal: principalRef }),
    );
  } catch (err: unknown) {
    return failedObservationResult(
      output,
      ref,
      `Observation error: ${errorMessage(err)}. ` +
        `Tool output stored at ${ref as string} but not in audit trail.`,
      observationRecovery,
    );
  }

  if (!observeResult.ok) {
    const message = observeResult.message ?? "unknown";
    return failedObservationResult(
      output,
      ref,
      `Observation rejected: ${message}. ` +
        `Tool output stored at ${ref as string} but not in audit trail.`,
      observationRecovery,
    );
  }

  return { ok: true, output, contentRef: ref, observeWarning: undefined, observationRecovery: undefined };
}

/** Retry only the audit observation of one already-stored external-tool output. */
export async function retryToolObservation(
  runtime: SyscallRuntime,
  contentStore: SyscallContentStore,
  principal: SyscallPrincipal,
  recovery: ToolObservationRecovery,
): Promise<ToolObservationRetryResult> {
  const validated = await validateObservationRecovery(contentStore, principal, recovery);
  if (!validated.ok) return observationRetryFailure(validated.message);

  const principalRef = { actorId: principal.actorId, kind: principal.kind };
  let observeResult: { readonly ok: boolean; readonly message?: string };
  try {
    observeResult = materializeObserveResult(
      runtime.observe(
        { source: principalRef, payloadRef: recovery.outputRef },
        { principal: principalRef },
      ),
    );
  } catch (err: unknown) {
    return observationRetryFailure(`Observation retry error: ${errorMessage(err)}.`);
  }
  if (!observeResult.ok) {
    return observationRetryFailure(
      `Observation retry rejected: ${observeResult.message ?? "unknown"}.`,
    );
  }
  return {
    ok: true,
    outputRef: recovery.outputRef,
    message: `Stored tool output ${String(recovery.outputRef)} observed successfully without re-executing the tool.`,
    observeWarning: undefined,
  };
}

type RecoveryValidation = { readonly ok: true } | { readonly ok: false; readonly message: string };

async function validateObservationRecovery(
  contentStore: SyscallContentStore,
  principal: SyscallPrincipal,
  recovery: ToolObservationRecovery,
): Promise<RecoveryValidation> {
  if (
    recovery.toolName === "" ||
    recovery.originalToolCallId === "" ||
    !SHA256_DIGEST.test(recovery.argumentsDigest) ||
    !isSha256ContentRef(String(recovery.outputRef)) ||
    !isSha256ContentRef(String(recovery.receiptRef))
  ) {
    return { ok: false, message: "Invalid external-tool observation recovery identity." };
  }

  const [receiptBlob, outputBlob] = await Promise.all([
    contentStore.get(recovery.receiptRef),
    contentStore.get(recovery.outputRef),
  ]);
  if (receiptBlob === undefined || outputBlob === undefined) {
    return { ok: false, message: "Recovery receipt or stored tool output is unavailable." };
  }
  if (
    receiptBlob.metadata.mimeType !== TOOL_OBSERVATION_RECEIPT_MIME ||
    receiptBlob.metadata.createdBy !== TOOL_OBSERVATION_RECEIPT_CREATOR ||
    receiptBlob.metadata.size !== receiptBlob.bytes.length ||
    outputBlob.metadata.size !== outputBlob.bytes.length ||
    createContentHasher()(receiptBlob.bytes) !== recovery.receiptRef ||
    createContentHasher()(outputBlob.bytes) !== recovery.outputRef
  ) {
    return { ok: false, message: "Recovery receipt or stored output failed integrity checks." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(receiptBlob.bytes));
  } catch {
    return { ok: false, message: "Recovery receipt is not valid JSON." };
  }
  const receipt = strictReceipt(parsed);
  if (
    receipt === undefined ||
    receiptText(receipt) !== new TextDecoder().decode(receiptBlob.bytes)
  ) {
    return { ok: false, message: "Recovery receipt is non-canonical or has an invalid schema." };
  }
  if (
    receipt.principal.actorId !== principal.actorId ||
    receipt.principal.kind !== principal.kind ||
    receipt.toolName !== recovery.toolName ||
    receipt.originalToolCallId !== recovery.originalToolCallId ||
    receipt.argumentsDigest !== recovery.argumentsDigest ||
    receipt.outputRef !== String(recovery.outputRef)
  ) {
    return { ok: false, message: "Recovery receipt does not match the caller or original output." };
  }
  return { ok: true };
}

function strictReceipt(value: unknown): ToolObservationReceipt | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (
    !exactKeys(record, [
      "argumentsDigest",
      "kind",
      "originalToolCallId",
      "outputRef",
      "principal",
      "toolName",
      "version",
    ])
  )
    return undefined;
  const principal = record["principal"];
  if (principal === null || typeof principal !== "object" || Array.isArray(principal))
    return undefined;
  const principalRecord = principal as Record<string, unknown>;
  if (!exactKeys(principalRecord, ["actorId", "kind"])) return undefined;
  if (
    record["kind"] !== TOOL_OBSERVATION_RECEIPT_KIND ||
    record["version"] !== TOOL_OBSERVATION_RECEIPT_VERSION ||
    typeof principalRecord["actorId"] !== "string" ||
    typeof principalRecord["kind"] !== "string" ||
    typeof record["toolName"] !== "string" ||
    typeof record["originalToolCallId"] !== "string" ||
    typeof record["argumentsDigest"] !== "string" ||
    typeof record["outputRef"] !== "string"
  )
    return undefined;
  return {
    kind: TOOL_OBSERVATION_RECEIPT_KIND,
    version: TOOL_OBSERVATION_RECEIPT_VERSION,
    principal: { actorId: principalRecord["actorId"], kind: principalRecord["kind"] },
    toolName: record["toolName"],
    originalToolCallId: record["originalToolCallId"],
    argumentsDigest: record["argumentsDigest"],
    outputRef: record["outputRef"],
  };
}

function exactKeys(record: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(record).sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index]);
}

function materializeObserveResult(value: unknown): {
  readonly ok: boolean;
  readonly message?: string;
} {
  let detached: unknown;
  try {
    detached = structuredClone(value);
  } catch {
    throw new TypeError("runtime returned a non-cloneable observation result");
  }
  if (detached === null || typeof detached !== "object" || Array.isArray(detached)) {
    throw new TypeError("runtime returned an invalid observation result");
  }
  const record = detached as Record<string, unknown>;
  if (
    (record["ok"] !== true && record["ok"] !== false) ||
    (record["message"] !== undefined && typeof record["message"] !== "string")
  ) {
    throw new TypeError("runtime returned an invalid observation result");
  }
  return {
    ok: record["ok"],
    ...(typeof record["message"] === "string" ? { message: record["message"] } : {}),
  };
}

function observationRetryFailure(message: string): ToolObservationRetryResult {
  return { ok: false, outputRef: undefined, message, observeWarning: message };
}
