import {
  actorId,
  actorRef,
  err,
  namespaceId,
  ok,
  type Result,
  type RuntimeInstanceId,
  type SchemaEpochBinding,
} from "@cantilune/core";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";
import type { AdministrationContext } from "../administration/administrationContext.js";
import type { FullControlPlaneService } from "../engine/controlPlaneService.js";
import { isNamespaceRbacRole } from "../namespace/namespaceRegistry.js";
import type {
  CommitSchemaAdmissionCommand,
  PrepareSchemaAdmissionCommand,
} from "../engine/controlPlaneWorker.js";
import type { RolloutPlan } from "../rollout/runtimeBinding.js";

export const CONTROL_PLANE_ADMIN_OPERATIONS = [
  "submit",
  "prepare",
  "commit",
  "rollout",
  "acknowledge",
  "register_namespace",
  "list_namespaces",
  "assign_namespace_role",
] as const;

export type ControlPlaneAdminOperation = (typeof CONTROL_PLANE_ADMIN_OPERATIONS)[number];

export interface ControlPlaneAdminEnvelope {
  readonly senderId: string;
  readonly sessionId?: string;
  readonly operation: ControlPlaneAdminOperation;
  readonly payload: unknown;
}

export interface ControlPlaneAdminSessionOptions {
  readonly service: FullControlPlaneService;
  readonly adminAllowlist: readonly string[];
  readonly admittedSessionIds?: readonly string[];
}

export interface ControlPlaneAdminHandler {
  handle(envelope: ControlPlaneAdminEnvelope): Promise<Result<unknown, ControlPlaneViolation>>;
}

const ADMIN_ROLES = [
  "schema-qualifier",
  "schema-proposer",
  "schema-authorizer",
  "schema-committer",
  "policy-admin",
  "rollout-admin",
] as const;

function isAdminOperation(value: string): value is ControlPlaneAdminOperation {
  return (CONTROL_PLANE_ADMIN_OPERATIONS as readonly string[]).includes(value);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function decodeControlPlaneAdminEnvelope(
  bytes: Uint8Array,
): ControlPlaneAdminEnvelope | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return undefined;
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.senderId !== "string" || record.senderId.length === 0) {
    return undefined;
  }
  if (typeof record.operation !== "string" || !isAdminOperation(record.operation)) {
    return undefined;
  }
  return {
    senderId: record.senderId,
    operation: record.operation,
    payload: record.payload,
    ...(typeof record.sessionId === "string" ? { sessionId: record.sessionId } : {}),
  };
}

export function encodeControlPlaneAdminEnvelope(envelope: ControlPlaneAdminEnvelope): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(envelope));
}

export class ControlPlaneAdminSession implements ControlPlaneAdminHandler {
  private readonly service: FullControlPlaneService;
  private readonly adminAllowlist: ReadonlySet<string>;
  private readonly admittedSessions: ReadonlySet<string>;

  constructor(options: ControlPlaneAdminSessionOptions) {
    this.service = options.service;
    this.adminAllowlist = new Set(options.adminAllowlist);
    this.admittedSessions = new Set(options.admittedSessionIds ?? []);
  }

  authorize(envelope: ControlPlaneAdminEnvelope): Result<void, ControlPlaneViolation> {
    if (!this.adminAllowlist.has(envelope.senderId)) {
      return err(
        controlPlaneViolation("authorization_denied", "authorize", "unknown admin sender"),
      );
    }
    if (this.admittedSessions.size > 0) {
      if (envelope.sessionId === undefined || !this.admittedSessions.has(envelope.sessionId)) {
        return err(
          controlPlaneViolation("authorization_denied", "authorize", "admin session not admitted"),
        );
      }
    }
    return ok(undefined);
  }

  async handle(
    envelope: ControlPlaneAdminEnvelope,
  ): Promise<Result<unknown, ControlPlaneViolation>> {
    const gate = this.authorize(envelope);
    if (!gate.ok) {
      return gate;
    }
    const context = this.contextFor(envelope);
    switch (envelope.operation) {
      case "submit":
        return this.service.submitSchemaAdmissionWire(envelope.payload, context);
      case "prepare":
        return this.dispatchPrepare(envelope.payload, context);
      case "commit":
        return this.dispatchCommit(envelope.payload, context);
      case "rollout":
        return this.service.setFleetRollout(envelope.payload as RolloutPlan, context);
      case "acknowledge":
        return this.dispatchAcknowledge(envelope.payload, context);
      case "register_namespace":
        return this.dispatchRegisterNamespace(envelope.payload, context);
      case "list_namespaces":
        return ok(this.service.listNamespaces());
      case "assign_namespace_role":
        return this.dispatchAssignNamespaceRole(envelope.payload, context);
    }
  }

  private dispatchPrepare(
    payload: unknown,
    context: AdministrationContext,
  ): ReturnType<FullControlPlaneService["prepareSchemaAdmission"]> {
    const record = asRecord(payload);
    if (record === undefined) {
      return Promise.resolve(
        err(controlPlaneViolation("invalid_input", "prepare", "prepare payload required")),
      );
    }
    return this.service.prepareSchemaAdmission({
      ...(record as unknown as PrepareSchemaAdmissionCommand),
      context,
    });
  }

  private dispatchCommit(
    payload: unknown,
    context: AdministrationContext,
  ): ReturnType<FullControlPlaneService["commitSchemaAdmission"]> {
    const record = asRecord(payload);
    if (record === undefined) {
      return Promise.resolve(
        err(controlPlaneViolation("invalid_input", "commit", "commit payload required")),
      );
    }
    return this.service.commitSchemaAdmission({
      ...(record as unknown as CommitSchemaAdmissionCommand),
      context,
    });
  }

  private dispatchRegisterNamespace(
    payload: unknown,
    context: AdministrationContext,
  ): ReturnType<FullControlPlaneService["registerNamespace"]> {
    const record = asRecord(payload);
    if (
      record === undefined ||
      typeof record.namespaceId !== "string" ||
      typeof record.displayName !== "string"
    ) {
      return err(
        controlPlaneViolation("invalid_input", "register", "register_namespace payload required"),
      );
    }
    const actor =
      typeof record.actorId === "string" ? record.actorId : context.principal.actorRef.actorId;
    return this.service.registerNamespace({
      namespaceId: namespaceId(record.namespaceId),
      displayName: record.displayName,
      actorId: actorId(actor as string),
    });
  }

  private dispatchAssignNamespaceRole(
    payload: unknown,
    context: AdministrationContext,
  ): ReturnType<FullControlPlaneService["assignNamespaceRole"]> {
    const record = asRecord(payload);
    if (
      record === undefined ||
      typeof record.namespaceId !== "string" ||
      typeof record.actorId !== "string" ||
      typeof record.role !== "string" ||
      !isNamespaceRbacRole(record.role)
    ) {
      return err(
        controlPlaneViolation(
          "invalid_input",
          "authorize",
          "assign_namespace_role payload required",
        ),
      );
    }
    const assignedBy =
      typeof record.assignedBy === "string"
        ? record.assignedBy
        : (context.principal.actorRef.actorId as string);
    return this.service.assignNamespaceRole({
      namespaceId: namespaceId(record.namespaceId),
      actorId: actorId(record.actorId),
      role: record.role,
      assignedBy: actorId(assignedBy),
    });
  }

  private dispatchAcknowledge(
    payload: unknown,
    context: AdministrationContext,
  ): Result<void, ControlPlaneViolation> {
    const record = asRecord(payload);
    if (record === undefined || typeof record.runtimeInstanceId !== "string") {
      return err(controlPlaneViolation("invalid_input", "query", "acknowledge payload required"));
    }
    return this.service.acknowledgeRuntimeInstance(
      record.runtimeInstanceId as RuntimeInstanceId,
      record.observedBinding as SchemaEpochBinding,
      context,
    );
  }

  private contextFor(envelope: ControlPlaneAdminEnvelope): AdministrationContext {
    return {
      principal: {
        actorRef: actorRef(actorId(envelope.senderId), "reviewer"),
        roles: [...ADMIN_ROLES],
        scopes: ["control-plane"],
      },
      issuedAt: new Date().toISOString(),
      sessionId: envelope.sessionId ?? `admin-${envelope.senderId}`,
    };
  }
}

export function createControlPlaneAdminSession(
  options: ControlPlaneAdminSessionOptions,
): ControlPlaneAdminSession {
  return new ControlPlaneAdminSession(options);
}
