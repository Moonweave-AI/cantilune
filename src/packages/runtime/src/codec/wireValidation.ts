import {
  ACTOR_KINDS as CORE_ACTOR_KINDS,
  ARTIFACT_LIFECYCLES as ARTIFACT_LIFECYCLE_VALUES,
  CAPABILITY_KINDS as CAPABILITY_KIND_VALUES,
  LINK_KINDS as LINK_KIND_VALUES,
  PARTICIPATION_STATUSES as PARTICIPATION_STATUS_VALUES,
  RETIRED_ENTITY_KINDS as RETIRED_ENTITY_KIND_VALUES,
  SESSION_VISIBILITIES as SESSION_VISIBILITY_VALUES,
  TRANSCRIPT_ACCESS_STATUSES as TRANSCRIPT_ACCESS_STATUS_VALUES,
  targetsFromMatchBindings,
} from "@cantilune/core";
import type { MatchBinding } from "@cantilune/core";
import { runtimeViolation } from "../foundation/errors.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import type { ChangeWireDto, MatchBindingWireDto } from "./changeCodec.js";
import type { SnapshotWireDto } from "./snapshotCodec.js";

export type CodecParseResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly violation: RuntimeViolation };

const BINDING_ROLES = new Set<MatchBinding["role"]>([
  "task",
  "artifact",
  "from",
  "to",
  "delegator",
  "delegatee",
  "participant",
  "capability",
  "session",
  "link",
]);

const VISIBILITIES = new Set<ChangeWireDto["visibility"]>([
  "internal",
  "external",
  "administrative",
]);

/**
 * Derived from core rather than restated here. Two hand-written copies of this
 * union lived in this file and both had drifted from `ActorKind`: one invented
 * `system`/`service` and omitted `tool`/`reviewer`/`runtime`/`environment`, the
 * other was two members behind on `ParticipationStatus`. Either way the store
 * accepted a commit it could not read back, leaving the world unloadable.
 */
const ACTOR_KINDS: ReadonlySet<string> = new Set<string>(CORE_ACTOR_KINDS);

const TARGET_KINDS = new Set(["artifact", "participant", "capability", "session", "link"]);

function fail(path: string, message: string): CodecParseResult<never> {
  return { ok: false, violation: runtimeViolation("codec_invalid", message, { path }) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  path: string,
): CodecParseResult<string> {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    return fail(`${path}.${key}`, `expected non-empty string at ${key}`);
  }
  return { ok: true, value };
}

function parseActorRef(value: unknown, path: string): CodecParseResult<ChangeWireDto["initiator"]> {
  if (!isRecord(value)) {
    return fail(path, "expected actor ref object");
  }
  const actorId = requireString(value, "actorId", path);
  if (!actorId.ok) {
    return actorId;
  }
  const kind = value.kind;
  if (typeof kind !== "string" || !ACTOR_KINDS.has(kind)) {
    return fail(`${path}.kind`, "invalid actor kind");
  }
  return {
    ok: true,
    value: {
      actorId: actorId.value as ChangeWireDto["initiator"]["actorId"],
      kind: kind as ChangeWireDto["initiator"]["kind"],
    },
  };
}

function parseMatchBinding(value: unknown, path: string): CodecParseResult<MatchBindingWireDto> {
  if (!isRecord(value)) {
    return fail(path, "expected match binding object");
  }
  const roleResult = requireString(value, "role", path);
  if (!roleResult.ok) {
    return roleResult;
  }
  if (!BINDING_ROLES.has(roleResult.value as MatchBinding["role"])) {
    return fail(`${path}.role`, `unknown binding role: ${roleResult.value}`);
  }
  const idResult = requireString(value, "id", path);
  if (!idResult.ok) {
    return idResult;
  }
  return { ok: true, value: { role: roleResult.value, id: idResult.value } };
}

function parseTarget(
  value: unknown,
  path: string,
): CodecParseResult<ChangeWireDto["targets"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected target object");
  }
  const kindResult = requireString(value, "kind", path);
  if (!kindResult.ok) {
    return kindResult;
  }
  if (!TARGET_KINDS.has(kindResult.value)) {
    return fail(`${path}.kind`, `unknown target kind: ${kindResult.value}`);
  }
  const idResult = requireString(value, "id", path);
  if (!idResult.ok) {
    return idResult;
  }
  return {
    ok: true,
    value: { kind: kindResult.value, id: idResult.value },
  };
}

function bindingToTargetKey(binding: MatchBindingWireDto): string {
  switch (binding.role) {
    case "task":
    case "artifact":
      return `artifact:${binding.id}`;
    case "from":
    case "to":
    case "delegator":
    case "delegatee":
    case "participant":
      return `participant:${binding.id}`;
    case "capability":
      return `capability:${binding.id}`;
    case "session":
      return `session:${binding.id}`;
    case "link":
      return `link:${binding.id}`;
    default:
      return `unknown:${binding.role}:${binding.id}`;
  }
}

function targetsMatchBindings(
  bindings: readonly MatchBindingWireDto[],
  targets: readonly ChangeWireDto["targets"][number][],
): boolean {
  const derived = new Set(bindings.map(bindingToTargetKey));
  const wire = new Set(targets.map((target) => `${target.kind}:${target.id}`));
  if (derived.size !== wire.size) {
    return false;
  }
  for (const key of derived) {
    if (!wire.has(key)) {
      return false;
    }
  }
  return true;
}

function parseStringArray(value: unknown, path: string): CodecParseResult<readonly string[]> {
  if (!Array.isArray(value)) {
    return fail(path, "expected string array");
  }
  const items: string[] = [];
  for (let index = 0; index < value.length; index++) {
    const item = value[index];
    if (typeof item !== "string" || item.length === 0) {
      return fail(`${path}[${index}]`, "expected non-empty string");
    }
    items.push(item);
  }
  return { ok: true, value: items };
}

const EVIDENCE_KINDS = new Set(["policy", "approval", "observation", "receipt"]);

function parseEvidenceArray(
  value: unknown,
  path: string,
): CodecParseResult<ChangeWireDto["authorization"]> {
  if (!Array.isArray(value)) {
    return fail(path, "expected evidence array");
  }
  const items: ChangeWireDto["authorization"][number][] = [];
  for (let index = 0; index < value.length; index++) {
    const entry = value[index];
    if (!isRecord(entry)) {
      return fail(`${path}[${index}]`, "expected evidence object");
    }
    const evidenceId = requireString(entry, "evidenceId", `${path}[${index}]`);
    if (!evidenceId.ok) {
      return evidenceId;
    }
    const kind = entry.kind;
    if (typeof kind !== "string" || !EVIDENCE_KINDS.has(kind)) {
      return fail(`${path}[${index}].kind`, "invalid evidence kind");
    }
    const contentRef = requireString(entry, "contentRef", `${path}[${index}]`);
    if (!contentRef.ok) {
      return contentRef;
    }
    items.push({
      evidenceId: evidenceId.value,
      kind: kind as ChangeWireDto["authorization"][number]["kind"],
      contentRef: contentRef.value,
    } as ChangeWireDto["authorization"][number]);
  }
  return { ok: true, value: items };
}

interface ChangeWireScalars {
  readonly changeId: string;
  readonly recordedAt: string;
  readonly epochId: string;
  readonly operationTypeId: string;
  readonly beforeRef: string;
  readonly afterRef: string;
}

function parseChangeWireScalars(
  input: Record<string, unknown>,
): CodecParseResult<ChangeWireScalars> {
  const changeId = requireString(input, "changeId", "change");
  if (!changeId.ok) {
    return changeId;
  }
  const recordedAt = requireString(input, "recordedAt", "change");
  if (!recordedAt.ok) {
    return recordedAt;
  }
  const epochId = requireString(input, "epochId", "change");
  if (!epochId.ok) {
    return epochId;
  }
  const operationTypeId = requireString(input, "operationTypeId", "change");
  if (!operationTypeId.ok) {
    return operationTypeId;
  }
  const beforeRef = requireString(input, "beforeRef", "change");
  if (!beforeRef.ok) {
    return beforeRef;
  }
  const afterRef = requireString(input, "afterRef", "change");
  if (!afterRef.ok) {
    return afterRef;
  }
  return {
    ok: true,
    value: {
      changeId: changeId.value,
      recordedAt: recordedAt.value,
      epochId: epochId.value,
      operationTypeId: operationTypeId.value,
      beforeRef: beforeRef.value,
      afterRef: afterRef.value,
    },
  };
}

function parseChangeMatchBindingsSection(input: Record<string, unknown>): CodecParseResult<{
  readonly matchBindings: MatchBindingWireDto[];
  readonly targets: ChangeWireDto["targets"][number][];
}> {
  if (!Array.isArray(input.matchBindings)) {
    return fail("change.matchBindings", "expected matchBindings array");
  }
  const matchBindings: MatchBindingWireDto[] = [];
  const seenRoles = new Set<string>();
  for (let index = 0; index < input.matchBindings.length; index++) {
    const parsed = parseMatchBinding(input.matchBindings[index], `change.matchBindings[${index}]`);
    if (!parsed.ok) {
      return parsed;
    }
    if (seenRoles.has(parsed.value.role)) {
      return fail(`change.matchBindings[${index}].role`, `duplicate role: ${parsed.value.role}`);
    }
    seenRoles.add(parsed.value.role);
    matchBindings.push(parsed.value);
  }

  if (!Array.isArray(input.targets)) {
    return fail("change.targets", "expected targets array");
  }
  const targets: ChangeWireDto["targets"][number][] = [];
  for (let index = 0; index < input.targets.length; index++) {
    const parsed = parseTarget(input.targets[index], `change.targets[${index}]`);
    if (!parsed.ok) {
      return parsed;
    }
    targets.push(parsed.value);
  }

  if (!targetsMatchBindings(matchBindings, targets)) {
    return fail("change.targets", "targets must match matchBindings derivation");
  }

  return { ok: true, value: { matchBindings, targets } };
}

function parseChangeActorSection(input: Record<string, unknown>): CodecParseResult<{
  readonly initiator: ChangeWireDto["initiator"];
  readonly involved: Array<ChangeWireDto["involved"][number]>;
}> {
  const initiator = parseActorRef(input.initiator, "change.initiator");
  if (!initiator.ok) {
    return initiator;
  }

  if (!Array.isArray(input.involved)) {
    return fail("change.involved", "expected involved array");
  }
  const involved: Array<ChangeWireDto["involved"][number]> = [];
  for (let index = 0; index < input.involved.length; index++) {
    const parsed = parseActorRef(input.involved[index], `change.involved[${index}]`);
    if (!parsed.ok) {
      return parsed;
    }
    involved.push(parsed.value);
  }

  return { ok: true, value: { initiator: initiator.value, involved } };
}

function parseChangeEvidenceSection(input: Record<string, unknown>): CodecParseResult<{
  readonly authorization: ChangeWireDto["authorization"];
  readonly external: ChangeWireDto["external"];
  readonly createdSessionRefs: readonly string[];
  readonly visibility: ChangeWireDto["visibility"];
}> {
  const authorization = parseEvidenceArray(input.authorization, "change.authorization");
  if (!authorization.ok) {
    return authorization;
  }
  const external = parseEvidenceArray(input.external, "change.external");
  if (!external.ok) {
    return external;
  }
  const createdSessionRefs = parseStringArray(
    input.createdSessionRefs,
    "change.createdSessionRefs",
  );
  if (!createdSessionRefs.ok) {
    return createdSessionRefs;
  }

  const visibility = input.visibility;
  if (
    typeof visibility !== "string" ||
    !VISIBILITIES.has(visibility as ChangeWireDto["visibility"])
  ) {
    return fail("change.visibility", "invalid visibility");
  }

  return {
    ok: true,
    value: {
      authorization: authorization.value,
      external: external.value,
      createdSessionRefs: createdSessionRefs.value,
      visibility: visibility as ChangeWireDto["visibility"],
    },
  };
}

function parseTemplateRefField(
  value: unknown,
): CodecParseResult<ChangeWireDto["templateRef"] | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(value)) {
    return fail("change.templateRef", "expected templateRef object");
  }
  const op = requireString(value, "operationTypeId", "change.templateRef");
  if (!op.ok) {
    return op;
  }
  const revision = requireString(value, "revision", "change.templateRef");
  if (!revision.ok) {
    return revision;
  }
  return { ok: true, value: { operationTypeId: op.value, revision: revision.value } };
}

function parseMatchWitnessField(
  value: unknown,
): CodecParseResult<NonNullable<ChangeWireDto["matchWitness"]>> {
  if (value === undefined) {
    return fail("change.matchWitness", "matchWitness is required on Change wire");
  }
  if (!isRecord(value)) {
    return fail("change.matchWitness", "expected matchWitness object");
  }
  const domainSize = value.domainSize;
  const codomainSize = value.codomainSize;
  if (typeof domainSize !== "number" || typeof codomainSize !== "number") {
    return fail("change.matchWitness", "domainSize and codomainSize must be numbers");
  }
  if (!Array.isArray(value.embedding)) {
    return fail("change.matchWitness.embedding", "expected embedding array");
  }
  const embedding: number[] = [];
  for (let index = 0; index < value.embedding.length; index++) {
    const item = value.embedding[index];
    if (typeof item !== "number") {
      return fail(`change.matchWitness.embedding[${index}]`, "expected number");
    }
    embedding.push(item);
  }
  return { ok: true, value: { domainSize, codomainSize, embedding } };
}

function parseOptionalNumberField(
  value: unknown,
  path: string,
): CodecParseResult<number | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "number") {
    return fail(path, "expected number");
  }
  return { ok: true, value };
}

function parseOptionalStringArrayField(
  value: unknown,
  path: string,
): CodecParseResult<readonly string[] | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  return parseStringArray(value, path);
}

function parseOptionalStringField(
  value: unknown,
  path: string,
): CodecParseResult<string | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (typeof value !== "string" || value.length === 0) {
    return fail(path, "expected non-empty string");
  }
  return { ok: true, value };
}

function parseOptionalScalarInputs(
  value: unknown,
  path: string,
): CodecParseResult<ChangeWireDto["scalarInputs"] | undefined> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (!isRecord(value)) {
    return fail(path, "expected scalar input object");
  }
  const prototype = Object.getPrototypeOf(value) as unknown;
  if (prototype !== Object.prototype && prototype !== null) {
    return fail(path, "expected plain scalar input object");
  }

  const entries: [string, string | number | boolean][] = [];
  for (const [name, scalar] of Object.entries(value)) {
    if (name.length === 0) {
      return fail(path, "scalar input names must be non-empty");
    }
    if (
      (typeof scalar !== "string" || scalar.length === 0) &&
      (typeof scalar !== "number" || !Number.isFinite(scalar)) &&
      typeof scalar !== "boolean"
    ) {
      return fail(`${path}.${name}`, "expected non-empty string, finite number, or boolean");
    }
    entries.push([name, scalar]);
  }
  return { ok: true, value: Object.fromEntries(entries) };
}

function parseChangeOptionalFields(input: Record<string, unknown>): CodecParseResult<{
  readonly templateRef: ChangeWireDto["templateRef"] | undefined;
  readonly matchWitness: NonNullable<ChangeWireDto["matchWitness"]>;
  readonly complementTag: number | undefined;
  readonly freshLinkRefs: readonly string[] | undefined;
  readonly inputContentRefs: readonly string[] | undefined;
  readonly scalarInputs: ChangeWireDto["scalarInputs"] | undefined;
  readonly emittedAt: string | undefined;
}> {
  const templateRef = parseTemplateRefField(input.templateRef);
  if (!templateRef.ok) {
    return templateRef;
  }

  const matchWitness = parseMatchWitnessField(input.matchWitness);
  if (!matchWitness.ok) {
    return matchWitness;
  }

  const complementTag = parseOptionalNumberField(input.complementTag, "change.complementTag");
  if (!complementTag.ok) {
    return complementTag;
  }

  const freshLinkRefs = parseOptionalStringArrayField(input.freshLinkRefs, "change.freshLinkRefs");
  if (!freshLinkRefs.ok) {
    return freshLinkRefs;
  }

  const inputContentRefs = parseOptionalStringArrayField(
    input.inputContentRefs,
    "change.inputContentRefs",
  );
  if (!inputContentRefs.ok) {
    return inputContentRefs;
  }

  const scalarInputs = parseOptionalScalarInputs(input.scalarInputs, "change.scalarInputs");
  if (!scalarInputs.ok) {
    return scalarInputs;
  }

  const emittedAt = parseOptionalStringField(input.emittedAt, "change.emittedAt");
  if (!emittedAt.ok) {
    return emittedAt;
  }

  return {
    ok: true,
    value: {
      templateRef: templateRef.value,
      matchWitness: matchWitness.value,
      complementTag: complementTag.value,
      freshLinkRefs: freshLinkRefs.value,
      inputContentRefs: inputContentRefs.value,
      scalarInputs: scalarInputs.value,
      emittedAt: emittedAt.value,
    },
  };
}

export function parseChangeWire(input: unknown): CodecParseResult<ChangeWireDto> {
  if (!isRecord(input)) {
    return fail("change", "expected change wire object");
  }

  const scalars = parseChangeWireScalars(input);
  if (!scalars.ok) {
    return scalars;
  }

  const bindings = parseChangeMatchBindingsSection(input);
  if (!bindings.ok) {
    return bindings;
  }

  const actors = parseChangeActorSection(input);
  if (!actors.ok) {
    return actors;
  }

  const evidence = parseChangeEvidenceSection(input);
  if (!evidence.ok) {
    return evidence;
  }

  const optional = parseChangeOptionalFields(input);
  if (!optional.ok) {
    return optional;
  }

  const {
    templateRef,
    matchWitness,
    complementTag,
    freshLinkRefs,
    inputContentRefs,
    scalarInputs,
    emittedAt,
  } = optional.value;

  if (scalars.value.operationTypeId === "emit_heartbeat" && emittedAt === undefined) {
    return fail("change.emittedAt", "emit_heartbeat requires replay-authoritative emittedAt");
  }

  const dto: ChangeWireDto = {
    changeId: scalars.value.changeId,
    recordedAt: scalars.value.recordedAt,
    epochId: scalars.value.epochId,
    operationTypeId: scalars.value.operationTypeId,
    beforeRef: scalars.value.beforeRef,
    afterRef: scalars.value.afterRef,
    matchBindings: bindings.value.matchBindings,
    targets: bindings.value.targets,
    initiator: actors.value.initiator,
    involved: actors.value.involved,
    authorization: evidence.value.authorization,
    external: evidence.value.external,
    createdSessionRefs: evidence.value.createdSessionRefs,
    visibility: evidence.value.visibility,
    matchWitness,
    ...(templateRef !== undefined ? { templateRef } : {}),
    ...(complementTag !== undefined ? { complementTag } : {}),
    ...(freshLinkRefs !== undefined ? { freshLinkRefs } : {}),
    ...(inputContentRefs !== undefined ? { inputContentRefs } : {}),
    ...(scalarInputs !== undefined ? { scalarInputs } : {}),
    ...(emittedAt !== undefined ? { emittedAt } : {}),
  };

  return { ok: true, value: dto };
}

const PARTICIPATION_STATUSES: ReadonlySet<string> = new Set<string>(PARTICIPATION_STATUS_VALUES);

const ARTIFACT_LIFECYCLES: ReadonlySet<string> = new Set<string>(ARTIFACT_LIFECYCLE_VALUES);

const LINK_KINDS: ReadonlySet<string> = new Set<string>(LINK_KIND_VALUES);

const CAPABILITY_KINDS: ReadonlySet<string> = new Set<string>(CAPABILITY_KIND_VALUES);

const SESSION_VISIBILITIES: ReadonlySet<string> = new Set<string>(SESSION_VISIBILITY_VALUES);

const RETIRED_ENTITY_KINDS: ReadonlySet<string> = new Set<string>(RETIRED_ENTITY_KIND_VALUES);

const TRANSCRIPT_ACCESS_STATUSES: ReadonlySet<string> = new Set<string>(
  TRANSCRIPT_ACCESS_STATUS_VALUES,
);

const TRANSCRIPT_ROLES: ReadonlySet<string> = new Set(["system", "user", "assistant", "tool"]);

function parseParticipantWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["participants"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected participant object");
  }
  const actorId = requireString(value, "actorId", path);
  if (!actorId.ok) {
    return actorId;
  }
  const kind = value.kind;
  if (typeof kind !== "string" || !ACTOR_KINDS.has(kind)) {
    return fail(`${path}.kind`, "invalid participant kind");
  }
  const status = value.status;
  if (typeof status !== "string" || !PARTICIPATION_STATUSES.has(status)) {
    return fail(`${path}.status`, "invalid participation status");
  }
  // manifestRef is optional (absent for non-agent participants and pre-activation
  // agents). When present it must be a non-empty content-addressed reference.
  const manifestRef = value.manifestRef;
  if (manifestRef !== undefined) {
    if (typeof manifestRef !== "string" || manifestRef.length === 0) {
      return fail(`${path}.manifestRef`, "invalid manifest reference");
    }
  }
  const namespaceId = value.namespaceId;
  if (namespaceId !== undefined && (typeof namespaceId !== "string" || namespaceId.length === 0)) {
    return fail(`${path}.namespaceId`, "invalid namespace id");
  }
  const result: {
    actorId: string;
    kind: SnapshotWireDto["participants"][number]["kind"];
    status: SnapshotWireDto["participants"][number]["status"];
    manifestRef?: string;
    namespaceId?: string;
  } = {
    actorId: actorId.value,
    kind: kind as SnapshotWireDto["participants"][number]["kind"],
    status: status as SnapshotWireDto["participants"][number]["status"],
  };
  if (manifestRef !== undefined) {
    result.manifestRef = manifestRef;
  }
  if (typeof namespaceId === "string") {
    result.namespaceId = namespaceId;
  }
  return { ok: true, value: result as SnapshotWireDto["participants"][number] };
}

function parseWorkArtifactWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["artifacts"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected artifact object");
  }
  const artifactId = requireString(value, "artifactId", path);
  if (!artifactId.ok) {
    return artifactId;
  }
  const kind = requireString(value, "kind", path);
  if (!kind.ok) {
    return kind;
  }
  const contentRef = requireString(value, "contentRef", path);
  if (!contentRef.ok) {
    return contentRef;
  }
  const owner = parseActorRef(value.owner, `${path}.owner`);
  if (!owner.ok) {
    return owner;
  }
  const lifecycle = value.lifecycle;
  if (typeof lifecycle !== "string" || !ARTIFACT_LIFECYCLES.has(lifecycle)) {
    return fail(`${path}.lifecycle`, "invalid artifact lifecycle");
  }
  return {
    ok: true,
    value: {
      artifactId: artifactId.value,
      kind: kind.value,
      contentRef: contentRef.value,
      owner: owner.value,
      lifecycle: lifecycle as SnapshotWireDto["artifacts"][number]["lifecycle"],
    } as SnapshotWireDto["artifacts"][number],
  };
}

function parseLinkEndpointWire(
  value: unknown,
  path: string,
): CodecParseResult<{ readonly kind: "participant" | "artifact"; readonly id: string }> {
  if (!isRecord(value)) {
    return fail(path, "expected link endpoint object");
  }
  const kind = value.kind;
  if (kind !== "participant" && kind !== "artifact") {
    return fail(`${path}.kind`, "invalid link endpoint kind");
  }
  const idKey = kind === "participant" ? "actorId" : "artifactId";
  const id = requireString(value, idKey, path);
  if (!id.ok) {
    return id;
  }
  return { ok: true, value: { kind, id: id.value } };
}

function parseCollaborationLinkWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["links"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected link object");
  }
  const linkId = requireString(value, "linkId", path);
  if (!linkId.ok) {
    return linkId;
  }
  const kind = value.kind;
  if (typeof kind !== "string" || !LINK_KINDS.has(kind)) {
    return fail(`${path}.kind`, "invalid link kind");
  }
  const from = parseLinkEndpointWire(value.from, `${path}.from`);
  if (!from.ok) {
    return from;
  }
  const to = parseLinkEndpointWire(value.to, `${path}.to`);
  if (!to.ok) {
    return to;
  }
  return {
    ok: true,
    value: {
      linkId: linkId.value,
      kind: kind as SnapshotWireDto["links"][number]["kind"],
      from:
        from.value.kind === "participant"
          ? { kind: "participant", actorId: from.value.id }
          : { kind: "artifact", artifactId: from.value.id },
      to:
        to.value.kind === "participant"
          ? { kind: "participant", actorId: to.value.id }
          : { kind: "artifact", artifactId: to.value.id },
    } as SnapshotWireDto["links"][number],
  };
}

function parseCommunicationSessionWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["sessions"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected session object");
  }
  const sessionId = requireString(value, "sessionId", path);
  if (!sessionId.ok) {
    return sessionId;
  }
  const controller = requireString(value, "controller", path);
  if (!controller.ok) {
    return controller;
  }
  const participants = parseStringArray(value.participants, `${path}.participants`);
  if (!participants.ok) {
    return participants;
  }
  const visibility = value.visibility;
  if (typeof visibility !== "string" || !SESSION_VISIBILITIES.has(visibility)) {
    return fail(`${path}.visibility`, "invalid session visibility");
  }
  return {
    ok: true,
    value: {
      sessionId: sessionId.value,
      controller: controller.value,
      participants: participants.value,
      visibility: visibility as SnapshotWireDto["sessions"][number]["visibility"],
    } as SnapshotWireDto["sessions"][number],
  };
}

function parseScopedCapabilityWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["capabilities"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected capability object");
  }
  const capabilityId = requireString(value, "capabilityId", path);
  if (!capabilityId.ok) {
    return capabilityId;
  }
  const kind = value.kind;
  if (typeof kind !== "string" || !CAPABILITY_KINDS.has(kind)) {
    return fail(`${path}.kind`, "invalid capability kind");
  }
  const holder = requireString(value, "holder", path);
  if (!holder.ok) {
    return holder;
  }
  if (!isRecord(value.scope)) {
    return fail(`${path}.scope`, "expected capability scope object");
  }
  const scopeKind = value.scope.kind;
  if (scopeKind === "artifact") {
    const artifactId = requireString(value.scope, "artifactId", `${path}.scope`);
    if (!artifactId.ok) {
      return artifactId;
    }
    return {
      ok: true,
      value: {
        capabilityId: capabilityId.value,
        kind: kind as SnapshotWireDto["capabilities"][number]["kind"],
        holder: holder.value,
        scope: { kind: "artifact", artifactId: artifactId.value },
      } as SnapshotWireDto["capabilities"][number],
    };
  }
  if (scopeKind === "session") {
    const sessionId = requireString(value.scope, "sessionId", `${path}.scope`);
    if (!sessionId.ok) {
      return sessionId;
    }
    return {
      ok: true,
      value: {
        capabilityId: capabilityId.value,
        kind: kind as SnapshotWireDto["capabilities"][number]["kind"],
        holder: holder.value,
        scope: { kind: "session", sessionId: sessionId.value },
      } as SnapshotWireDto["capabilities"][number],
    };
  }
  if (scopeKind === "transcript") {
    const actorId = requireString(value.scope, "actorId", `${path}.scope`);
    if (!actorId.ok) {
      return actorId;
    }
    const namespaceId = requireString(value.scope, "namespaceId", `${path}.scope`);
    if (!namespaceId.ok) {
      return namespaceId;
    }
    return {
      ok: true,
      value: {
        capabilityId: capabilityId.value,
        kind: kind as SnapshotWireDto["capabilities"][number]["kind"],
        holder: holder.value,
        scope: {
          kind: "transcript",
          actorId: actorId.value,
          namespaceId: namespaceId.value,
        },
      } as SnapshotWireDto["capabilities"][number],
    };
  }
  return fail(`${path}.scope.kind`, "invalid capability scope kind");
}

function parseObservationEntryWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["auditTail"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected observation entry object");
  }
  const sequenceNo = value.sequenceNo;
  if (typeof sequenceNo !== "number" || !Number.isInteger(sequenceNo) || sequenceNo < 0) {
    return fail(`${path}.sequenceNo`, "expected non-negative integer sequenceNo");
  }
  const source = parseActorRef(value.source, `${path}.source`);
  if (!source.ok) {
    return source;
  }
  const payloadRef = requireString(value, "payloadRef", path);
  if (!payloadRef.ok) {
    return payloadRef;
  }
  const receivedAt = requireString(value, "receivedAt", path);
  if (!receivedAt.ok) {
    return receivedAt;
  }
  return {
    ok: true,
    value: {
      sequenceNo,
      source: source.value,
      payloadRef: payloadRef.value,
      receivedAt: receivedAt.value,
    } as SnapshotWireDto["auditTail"][number],
  };
}

type HeartbeatEntryWire = NonNullable<SnapshotWireDto["heartbeatLog"]>[number];

function parseHeartbeatEntryWire(
  value: unknown,
  path: string,
): CodecParseResult<HeartbeatEntryWire> {
  if (!isRecord(value)) {
    return fail(path, "expected heartbeat entry object");
  }
  const sequenceNo = value.sequenceNo;
  if (typeof sequenceNo !== "number" || !Number.isInteger(sequenceNo) || sequenceNo < 0) {
    return fail(`${path}.sequenceNo`, "expected non-negative integer sequenceNo");
  }
  const turnCount = value.turnCount;
  if (typeof turnCount !== "number" || !Number.isInteger(turnCount) || turnCount < 0) {
    return fail(`${path}.turnCount`, "expected non-negative integer turnCount");
  }
  const agentId = requireString(value, "agentId", path);
  if (!agentId.ok) {
    return agentId;
  }
  const emittedAt = requireString(value, "emittedAt", path);
  if (!emittedAt.ok) {
    return emittedAt;
  }
  const lastAction = requireString(value, "lastAction", path);
  if (!lastAction.ok) {
    return lastAction;
  }
  return {
    ok: true,
    value: {
      agentId: agentId.value,
      sequenceNo,
      emittedAt: emittedAt.value,
      turnCount,
      lastAction: lastAction.value,
    } as HeartbeatEntryWire,
  };
}

function parsePolicyContextWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["policyContext"]> {
  if (!isRecord(value)) {
    return fail(path, "expected policyContext object");
  }
  if (!isRecord(value.approvalState)) {
    return fail(`${path}.approvalState`, "expected approvalState object");
  }
  if (!isRecord(value.retryState)) {
    return fail(`${path}.retryState`, "expected retryState object");
  }
  const approvalKind = value.approvalState.kind;
  const retryKind = value.retryState.kind;
  if (typeof approvalKind !== "string" || typeof retryKind !== "string") {
    return fail(path, "invalid policyContext state kinds");
  }
  return {
    ok: true,
    value: value as unknown as SnapshotWireDto["policyContext"],
  };
}

function parseEntityTombstoneWire(
  value: unknown,
  path: string,
): CodecParseResult<SnapshotWireDto["retiredEntities"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected tombstone object");
  }
  const entityId = requireString(value, "entityId", path);
  if (!entityId.ok) {
    return entityId;
  }
  const entityKind = value.entityKind;
  if (typeof entityKind !== "string" || !RETIRED_ENTITY_KINDS.has(entityKind)) {
    return fail(`${path}.entityKind`, "invalid retired entity kind");
  }
  const retiredAt = requireString(value, "retiredAt", path);
  if (!retiredAt.ok) {
    return retiredAt;
  }
  let reasonRef: string | undefined;
  if (value.reasonRef !== undefined) {
    if (typeof value.reasonRef !== "string") {
      return fail(`${path}.reasonRef`, "expected string reasonRef");
    }
    reasonRef = value.reasonRef;
  }
  return {
    ok: true,
    value: {
      entityId: entityId.value,
      entityKind: entityKind as SnapshotWireDto["retiredEntities"][number]["entityKind"],
      retiredAt: retiredAt.value,
      ...(reasonRef !== undefined ? { reasonRef } : {}),
    } as SnapshotWireDto["retiredEntities"][number],
  };
}

function parseEntityArray<T>(
  values: unknown,
  path: string,
  parseItem: (value: unknown, itemPath: string) => CodecParseResult<T>,
): CodecParseResult<readonly T[]> {
  if (!Array.isArray(values)) {
    return fail(path, "expected array");
  }
  const items: T[] = [];
  for (let index = 0; index < values.length; index++) {
    const parsed = parseItem(values[index], `${path}[${index}]`);
    if (!parsed.ok) {
      return parsed;
    }
    items.push(parsed.value);
  }
  return { ok: true, value: items };
}

function parseNamespaceWire(
  value: unknown,
  path: string,
): CodecParseResult<NonNullable<SnapshotWireDto["namespaces"]>[number]> {
  if (!isRecord(value)) {
    return fail(path, "expected namespace object");
  }
  const namespaceId = requireString(value, "namespaceId", path);
  if (!namespaceId.ok) {
    return namespaceId;
  }
  const displayName = requireString(value, "displayName", path);
  if (!displayName.ok) {
    return displayName;
  }
  const adminPrincipals = parseStringArray(value.adminPrincipals ?? [], `${path}.adminPrincipals`);
  if (!adminPrincipals.ok) {
    return adminPrincipals;
  }
  return {
    ok: true,
    value: {
      namespaceId: namespaceId.value,
      displayName: displayName.value,
      adminPrincipals: adminPrincipals.value,
    } as NonNullable<SnapshotWireDto["namespaces"]>[number],
  };
}

function parseTranscriptMessageWire(
  value: unknown,
  path: string,
): CodecParseResult<NonNullable<SnapshotWireDto["transcripts"]>[number]["messages"][number]> {
  if (!isRecord(value)) {
    return fail(path, "expected transcript message object");
  }
  const role = value.role;
  if (typeof role !== "string" || !TRANSCRIPT_ROLES.has(role)) {
    return fail(`${path}.role`, "invalid transcript message role");
  }
  const rawContent = value.content;
  if (typeof rawContent !== "string") {
    return fail(`${path}.content`, "expected string at content");
  }
  if (role === "tool") {
    const toolCallId = requireString(value, "toolCallId", path);
    if (!toolCallId.ok) {
      return toolCallId;
    }
    return {
      ok: true,
      value: { role: "tool", toolCallId: toolCallId.value, content: rawContent },
    };
  }
  if (role === "assistant") {
    const toolCalls = parseTranscriptToolCalls(value.toolCalls, `${path}.toolCalls`);
    if (!toolCalls.ok) {
      return toolCalls;
    }
    return {
      ok: true,
      value: {
        role: "assistant",
        content: rawContent,
        ...(toolCalls.value !== undefined ? { toolCalls: toolCalls.value } : {}),
      } as NonNullable<SnapshotWireDto["transcripts"]>[number]["messages"][number],
    };
  }
  return {
    ok: true,
    value: { role: role as "system" | "user", content: rawContent },
  };
}

function parseTranscriptToolCalls(
  value: unknown,
  path: string,
): CodecParseResult<
  readonly { readonly id: string; readonly name: string; readonly arguments: string }[] | undefined
> {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (!Array.isArray(value)) {
    return fail(path, "expected toolCalls array");
  }
  const calls: { readonly id: string; readonly name: string; readonly arguments: string }[] = [];
  for (const [index, entry] of value.entries()) {
    if (!isRecord(entry)) {
      return fail(`${path}[${index}]`, "expected tool call object");
    }
    const id = requireString(entry, "id", `${path}[${index}]`);
    const name = requireString(entry, "name", `${path}[${index}]`);
    const args = entry.arguments;
    if (!id.ok) {
      return id;
    }
    if (!name.ok) {
      return name;
    }
    if (typeof args !== "string") {
      return fail(`${path}[${index}].arguments`, "expected string at arguments");
    }
    calls.push({ id: id.value, name: name.value, arguments: args });
  }
  return { ok: true, value: calls };
}

function parseTranscriptWire(
  value: unknown,
  path: string,
): CodecParseResult<NonNullable<SnapshotWireDto["transcripts"]>[number]> {
  if (!isRecord(value)) {
    return fail(path, "expected transcript object");
  }
  const actorId = requireString(value, "actorId", path);
  if (!actorId.ok) {
    return actorId;
  }
  const namespaceId = requireString(value, "namespaceId", path);
  if (!namespaceId.ok) {
    return namespaceId;
  }
  const revision = value.revision;
  if (typeof revision !== "number" || !Number.isInteger(revision) || revision < 0) {
    return fail(`${path}.revision`, "expected non-negative integer revision");
  }
  const messages = parseEntityArray(value.messages, `${path}.messages`, parseTranscriptMessageWire);
  if (!messages.ok) {
    return messages;
  }
  return {
    ok: true,
    value: {
      actorId: actorId.value,
      namespaceId: namespaceId.value,
      revision,
      messages: messages.value,
    } as NonNullable<SnapshotWireDto["transcripts"]>[number],
  };
}

function parseTranscriptAccessRequestWire(
  value: unknown,
  path: string,
): CodecParseResult<NonNullable<SnapshotWireDto["transcriptAccessRequests"]>[number]> {
  if (!isRecord(value)) {
    return fail(path, "expected transcript access request object");
  }
  const requestId = requireString(value, "requestId", path);
  if (!requestId.ok) {
    return requestId;
  }
  const requester = parseActorRef(value.requester, `${path}.requester`);
  if (!requester.ok) {
    return requester;
  }
  const subjectActorId = requireString(value, "subjectActorId", path);
  if (!subjectActorId.ok) {
    return subjectActorId;
  }
  const subjectNamespaceId = requireString(value, "subjectNamespaceId", path);
  if (!subjectNamespaceId.ok) {
    return subjectNamespaceId;
  }
  const status = value.status;
  if (typeof status !== "string" || !TRANSCRIPT_ACCESS_STATUSES.has(status)) {
    return fail(`${path}.status`, "invalid transcript access status");
  }
  const result: {
    requestId: string;
    requester: NonNullable<SnapshotWireDto["transcriptAccessRequests"]>[number]["requester"];
    subjectActorId: string;
    subjectNamespaceId: string;
    status: NonNullable<SnapshotWireDto["transcriptAccessRequests"]>[number]["status"];
    decidedBy?: NonNullable<SnapshotWireDto["transcriptAccessRequests"]>[number]["requester"];
  } = {
    requestId: requestId.value,
    requester: requester.value,
    subjectActorId: subjectActorId.value,
    subjectNamespaceId: subjectNamespaceId.value,
    status: status as NonNullable<SnapshotWireDto["transcriptAccessRequests"]>[number]["status"],
  };
  if (value.decidedBy !== undefined) {
    const decidedBy = parseActorRef(value.decidedBy, `${path}.decidedBy`);
    if (!decidedBy.ok) {
      return decidedBy;
    }
    result.decidedBy = decidedBy.value;
  }
  return {
    ok: true,
    value: result as NonNullable<SnapshotWireDto["transcriptAccessRequests"]>[number],
  };
}

export function parseSnapshotWire(input: unknown): CodecParseResult<SnapshotWireDto> {
  if (!isRecord(input)) {
    return fail("snapshot", "expected snapshot wire object");
  }

  const snapshotRef = requireString(input, "snapshotRef", "snapshot");
  if (!snapshotRef.ok) {
    return snapshotRef;
  }
  const epochId = requireString(input, "epochId", "snapshot");
  if (!epochId.ok) {
    return epochId;
  }

  const participants = parseEntityArray(
    input.participants,
    "snapshot.participants",
    parseParticipantWire,
  );
  if (!participants.ok) {
    return participants;
  }
  const artifacts = parseEntityArray(input.artifacts, "snapshot.artifacts", parseWorkArtifactWire);
  if (!artifacts.ok) {
    return artifacts;
  }
  const links = parseEntityArray(input.links, "snapshot.links", parseCollaborationLinkWire);
  if (!links.ok) {
    return links;
  }
  const sessions = parseEntityArray(
    input.sessions,
    "snapshot.sessions",
    parseCommunicationSessionWire,
  );
  if (!sessions.ok) {
    return sessions;
  }
  const capabilities = parseEntityArray(
    input.capabilities,
    "snapshot.capabilities",
    parseScopedCapabilityWire,
  );
  if (!capabilities.ok) {
    return capabilities;
  }
  const auditTail = parseEntityArray(
    input.auditTail,
    "snapshot.auditTail",
    parseObservationEntryWire,
  );
  if (!auditTail.ok) {
    return auditTail;
  }
  const retiredEntities = parseEntityArray(
    input.retiredEntities,
    "snapshot.retiredEntities",
    parseEntityTombstoneWire,
  );
  if (!retiredEntities.ok) {
    return retiredEntities;
  }
  const policyContext = parsePolicyContextWire(input.policyContext, "snapshot.policyContext");
  if (!policyContext.ok) {
    return policyContext;
  }
  // Absent in bundles written before heartbeats were part of the wire format.
  const heartbeatLog = parseEntityArray(
    input.heartbeatLog ?? [],
    "snapshot.heartbeatLog",
    parseHeartbeatEntryWire,
  );
  if (!heartbeatLog.ok) {
    return heartbeatLog;
  }
  const namespaces = parseEntityArray(
    input.namespaces ?? [],
    "snapshot.namespaces",
    parseNamespaceWire,
  );
  if (!namespaces.ok) {
    return namespaces;
  }
  const transcripts = parseEntityArray(
    input.transcripts ?? [],
    "snapshot.transcripts",
    parseTranscriptWire,
  );
  if (!transcripts.ok) {
    return transcripts;
  }
  const transcriptAccessRequests = parseEntityArray(
    input.transcriptAccessRequests ?? [],
    "snapshot.transcriptAccessRequests",
    parseTranscriptAccessRequestWire,
  );
  if (!transcriptAccessRequests.ok) {
    return transcriptAccessRequests;
  }

  return {
    ok: true,
    value: {
      snapshotRef: snapshotRef.value,
      epochId: epochId.value,
      participants: participants.value,
      artifacts: artifacts.value,
      links: links.value,
      sessions: sessions.value,
      capabilities: capabilities.value,
      policyContext: policyContext.value,
      auditTail: auditTail.value,
      retiredEntities: retiredEntities.value,
      heartbeatLog: heartbeatLog.value,
      namespaces: namespaces.value,
      transcripts: transcripts.value,
      transcriptAccessRequests: transcriptAccessRequests.value,
    },
  };
}

/** Validate typed bindings against targets after decode (defense in depth). */
export function assertTargetsDerivedFromBindings(
  bindings: readonly MatchBinding[],
  targets: readonly { readonly kind: string; readonly id: string }[],
): boolean {
  const derived = targetsFromMatchBindings(bindings).map((target) => `${target.kind}:${target.id}`);
  const wire = targets.map((target) => `${target.kind}:${target.id}`);
  if (derived.length !== wire.length) {
    return false;
  }
  const derivedSet = new Set(derived);
  return wire.every((key) => derivedSet.has(key));
}
