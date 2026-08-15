import type {
  ActivationDomainId,
  BindingGeneration,
  EpochId,
  EpochOrdinal,
  HandlerManifestDigest,
  HandlerManifestId,
  PolicyId,
  PolicyRevisionId,
  SchemaAdmissionId,
  SchemaDigest,
  SchemaId,
  SchemaRevisionId,
  SchemaEpochBinding,
  SchemaRef,
  PolicyRef,
  HandlerManifestRef,
  SnapshotRef,
} from "@cantilune/core";
import { snapshotSchemaEpochBinding } from "../engine/activeSchemaContext.js";
import { runtimeViolation } from "../foundation/errors.js";
import type { RuntimeViolation } from "../foundation/errors.js";
import type { CodecParseResult } from "./wireValidation.js";

/**
 * Wire DTO for the active {@link SchemaEpochBinding} stored in the durable bundle.
 *
 * Every field is a primitive (string or number), so the wire form mirrors the
 * domain shape directly. The codec validates field presence and primitive
 * types; the {@link snapshotSchemaEpochBinding} snapshot helper validates the
 * nested ref objects and freezes the result. A bundle reader therefore never
 * constructs a binding it cannot reconstruct exactly.
 */
export interface SchemaBindingWireDto {
  readonly activationDomainId: string;
  readonly bindingGeneration: number;
  readonly epochId: string;
  readonly epochOrdinal: number;
  readonly schemaRef: {
    readonly schemaId: string;
    readonly revisionId: string;
    readonly digest: string;
  };
  readonly policyRef: {
    readonly policyId: string;
    readonly revisionId: string;
    readonly digest: string;
  };
  readonly handlerManifestRef: {
    readonly manifestId: string;
    readonly digest: string;
  };
  readonly runtimeHead: string;
  readonly admissionId: string;
  readonly previousBindingGeneration?: number;
  readonly activatedBy: string;
  readonly activatedAt: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function fail(path: string, message: string): CodecParseResult<never> {
  return { ok: false, violation: runtimeViolation("codec_invalid", message, { path }) };
}

function requireString(record: Record<string, unknown>, key: string, path: string): CodecParseResult<string> {
  const value = record[key];
  if (typeof value !== "string" || value.length === 0) {
    return fail(`${path}.${key}`, `expected non-empty string at ${key}`);
  }
  return { ok: true, value };
}

function requireNumber(record: Record<string, unknown>, key: string, path: string): CodecParseResult<number> {
  const value = record[key];
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fail(`${path}.${key}`, `expected finite number at ${key}`);
  }
  return { ok: true, value };
}

function requireRef(
  value: unknown,
  path: string,
  fields: readonly string[],
): CodecParseResult<Record<string, string>> {
  if (!isRecord(value)) {
    return fail(path, "expected ref object");
  }
  const out: Record<string, string> = {};
  for (const field of fields) {
    const result = requireString(value, field, path);
    if (!result.ok) {
      return result;
    }
    out[field] = result.value;
  }
  return { ok: true, value: out };
}

/** Parse and validate a wire binding DTO into a frozen {@link SchemaEpochBinding}. */
export function parseSchemaBindingWire(input: unknown): CodecParseResult<SchemaEpochBinding> {
  if (!isRecord(input)) {
    return fail("schemaBinding", "expected schema binding object");
  }

  const activationDomainId = requireString(input, "activationDomainId", "schemaBinding");
  if (!activationDomainId.ok) return activationDomainId;
  const bindingGeneration = requireNumber(input, "bindingGeneration", "schemaBinding");
  if (!bindingGeneration.ok) return bindingGeneration;
  const epochId = requireString(input, "epochId", "schemaBinding");
  if (!epochId.ok) return epochId;
  const epochOrdinal = requireNumber(input, "epochOrdinal", "schemaBinding");
  if (!epochOrdinal.ok) return epochOrdinal;
  const schemaRef = requireRef(input.schemaRef, "schemaBinding.schemaRef", [
    "schemaId",
    "revisionId",
    "digest",
  ]);
  if (!schemaRef.ok) return schemaRef;
  const policyRef = requireRef(input.policyRef, "schemaBinding.policyRef", [
    "policyId",
    "revisionId",
    "digest",
  ]);
  if (!policyRef.ok) return policyRef;
  const handlerManifestRef = requireRef(input.handlerManifestRef, "schemaBinding.handlerManifestRef", [
    "manifestId",
    "digest",
  ]);
  if (!handlerManifestRef.ok) return handlerManifestRef;
  const runtimeHead = requireString(input, "runtimeHead", "schemaBinding");
  if (!runtimeHead.ok) return runtimeHead;
  const admissionId = requireString(input, "admissionId", "schemaBinding");
  if (!admissionId.ok) return admissionId;
  const activatedBy = requireString(input, "activatedBy", "schemaBinding");
  if (!activatedBy.ok) return activatedBy;
  const activatedAt = requireString(input, "activatedAt", "schemaBinding");
  if (!activatedAt.ok) return activatedAt;

  let previousBindingGeneration: number | undefined;
  if (input.previousBindingGeneration !== undefined) {
    const prev = requireNumber(input, "previousBindingGeneration", "schemaBinding");
    if (!prev.ok) return prev;
    previousBindingGeneration = prev.value;
  }

  const binding: SchemaEpochBinding = {
    activationDomainId: activationDomainId.value as ActivationDomainId,
    bindingGeneration: bindingGeneration.value as BindingGeneration,
    epochId: epochId.value as EpochId,
    epochOrdinal: epochOrdinal.value as EpochOrdinal,
    schemaRef: {
      schemaId: schemaRef.value.schemaId as SchemaId,
      revisionId: schemaRef.value.revisionId as SchemaRevisionId,
      digest: schemaRef.value.digest as SchemaDigest,
    } as SchemaRef,
    policyRef: {
      policyId: policyRef.value.policyId as PolicyId,
      revisionId: policyRef.value.revisionId as PolicyRevisionId,
      digest: policyRef.value.digest,
    } as PolicyRef,
    handlerManifestRef: {
      manifestId: handlerManifestRef.value.manifestId as HandlerManifestId,
      digest: handlerManifestRef.value.digest as HandlerManifestDigest,
    } as HandlerManifestRef,
    runtimeHead: runtimeHead.value as SnapshotRef,
    admissionId: admissionId.value as SchemaAdmissionId,
    ...(previousBindingGeneration !== undefined
      ? { previousBindingGeneration: previousBindingGeneration as BindingGeneration }
      : {}),
    activatedBy: activatedBy.value,
    activatedAt: activatedAt.value,
  };

  // The snapshot helper validates nested ref shapes and freezes the result.
  // It throws on a malformed binding, which we convert to a codec violation.
  try {
    return { ok: true, value: snapshotSchemaEpochBinding(binding) };
  } catch (error) {
    return fail(
      "schemaBinding",
      `binding failed snapshot validation: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** Serialize a {@link SchemaEpochBinding} into the plain wire DTO form. */
export function serializeSchemaBindingWire(binding: SchemaEpochBinding): SchemaBindingWireDto {
  const snapshot = snapshotSchemaEpochBinding(binding);
  return {
    activationDomainId: snapshot.activationDomainId,
    bindingGeneration: snapshot.bindingGeneration,
    epochId: snapshot.epochId,
    epochOrdinal: snapshot.epochOrdinal,
    schemaRef: {
      schemaId: snapshot.schemaRef.schemaId,
      revisionId: snapshot.schemaRef.revisionId,
      digest: snapshot.schemaRef.digest,
    },
    policyRef: {
      policyId: snapshot.policyRef.policyId,
      revisionId: snapshot.policyRef.revisionId,
      digest: snapshot.policyRef.digest,
    },
    handlerManifestRef: {
      manifestId: snapshot.handlerManifestRef.manifestId,
      digest: snapshot.handlerManifestRef.digest,
    },
    runtimeHead: snapshot.runtimeHead,
    admissionId: snapshot.admissionId,
    ...(snapshot.previousBindingGeneration !== undefined
      ? { previousBindingGeneration: snapshot.previousBindingGeneration }
      : {}),
    activatedBy: snapshot.activatedBy,
    activatedAt: snapshot.activatedAt,
  };
}
