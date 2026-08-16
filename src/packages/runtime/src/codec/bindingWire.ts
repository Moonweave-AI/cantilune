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

function requireNumber(
  record: Record<string, unknown>,
  key: string,
  path: string,
): CodecParseResult<number> {
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

/** Scalar fields the binding wire form requires, grouped by primitive type. */
const BINDING_STRING_FIELDS = [
  "activationDomainId",
  "epochId",
  "runtimeHead",
  "admissionId",
  "activatedBy",
  "activatedAt",
] as const;
const BINDING_NUMBER_FIELDS = ["bindingGeneration", "epochOrdinal"] as const;

/** Nested ref fields and the string keys each one must carry. */
const BINDING_REF_FIELDS = [
  ["schemaRef", ["schemaId", "revisionId", "digest"]],
  ["policyRef", ["policyId", "revisionId", "digest"]],
  ["handlerManifestRef", ["manifestId", "digest"]],
] as const;

/**
 * Validate every scalar and nested-ref field in one pass.
 *
 * Collecting the fields through a table keeps {@link parseSchemaBindingWire}
 * free of one guarded branch per field, which is what pushed it over the
 * cognitive-complexity budget. The first violation short-circuits, so the
 * reported path is still the first malformed field in declaration order.
 */
function collectBindingFields(input: Record<string, unknown>): CodecParseResult<{
  readonly strings: Record<string, string>;
  readonly numbers: Record<string, number>;
  readonly refs: Record<string, Record<string, string>>;
}> {
  const strings: Record<string, string> = {};
  for (const field of BINDING_STRING_FIELDS) {
    const result = requireString(input, field, "schemaBinding");
    if (!result.ok) return result;
    strings[field] = result.value;
  }

  const numbers: Record<string, number> = {};
  for (const field of BINDING_NUMBER_FIELDS) {
    const result = requireNumber(input, field, "schemaBinding");
    if (!result.ok) return result;
    numbers[field] = result.value;
  }

  // Optional: absent means "no predecessor generation", not a malformed field.
  if (input.previousBindingGeneration !== undefined) {
    const prev = requireNumber(input, "previousBindingGeneration", "schemaBinding");
    if (!prev.ok) return prev;
    numbers.previousBindingGeneration = prev.value;
  }

  const refs: Record<string, Record<string, string>> = {};
  for (const [field, keys] of BINDING_REF_FIELDS) {
    const result = requireRef(input[field], `schemaBinding.${field}`, keys);
    if (!result.ok) return result;
    refs[field] = result.value;
  }

  return { ok: true, value: { strings, numbers, refs } };
}

/** Parse and validate a wire binding DTO into a frozen {@link SchemaEpochBinding}. */
export function parseSchemaBindingWire(input: unknown): CodecParseResult<SchemaEpochBinding> {
  if (!isRecord(input)) {
    return fail("schemaBinding", "expected schema binding object");
  }

  const collected = collectBindingFields(input);
  if (!collected.ok) return collected;
  const { strings, numbers, refs } = collected.value;
  const schemaRef = refs.schemaRef!;
  const policyRef = refs.policyRef!;
  const handlerManifestRef = refs.handlerManifestRef!;
  const previousBindingGeneration = numbers.previousBindingGeneration;

  const binding: SchemaEpochBinding = {
    activationDomainId: strings.activationDomainId as ActivationDomainId,
    bindingGeneration: numbers.bindingGeneration as BindingGeneration,
    epochId: strings.epochId as EpochId,
    epochOrdinal: numbers.epochOrdinal as EpochOrdinal,
    schemaRef: {
      schemaId: schemaRef.schemaId as SchemaId,
      revisionId: schemaRef.revisionId as SchemaRevisionId,
      digest: schemaRef.digest as SchemaDigest,
    } as SchemaRef,
    policyRef: {
      policyId: policyRef.policyId as PolicyId,
      revisionId: policyRef.revisionId as PolicyRevisionId,
      digest: policyRef.digest,
    } as PolicyRef,
    handlerManifestRef: {
      manifestId: handlerManifestRef.manifestId as HandlerManifestId,
      digest: handlerManifestRef.digest as HandlerManifestDigest,
    } as HandlerManifestRef,
    runtimeHead: strings.runtimeHead as SnapshotRef,
    admissionId: strings.admissionId as SchemaAdmissionId,
    ...(previousBindingGeneration !== undefined
      ? { previousBindingGeneration: previousBindingGeneration as BindingGeneration }
      : {}),
    activatedBy: strings.activatedBy!,
    activatedAt: strings.activatedAt!,
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
