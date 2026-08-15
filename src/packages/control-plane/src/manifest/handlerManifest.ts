import {
  err,
  handlerManifestDigest,
  handlerManifestRef,
  ok,
  type ContentDigest,
  type HandlerManifestId,
  type HandlerManifestRef,
  type OperationTemplateRef,
  type OperationTypeId,
  type Result,
} from "@cantilune/core";
import { digestOfCanonical } from "../schema/schemaDigest.js";
import {
  controlPlaneViolation,
  type ControlPlaneViolation,
} from "../errors/controlPlaneViolation.js";

export interface HandlerBinding {
  readonly operationTypeId: OperationTypeId;
  readonly templateRef: OperationTemplateRef;
  readonly handlerRevision: string;
  readonly artifactRef: string;
  readonly artifactDigest: ContentDigest;
  readonly runtimeCompatibility: string;
}

export interface HandlerManifest {
  readonly manifestRef: HandlerManifestRef;
  readonly bindings: readonly HandlerBinding[];
  readonly canonicalDigest: ContentDigest;
  readonly createdAt: string;
}

export function createHandlerManifest(input: {
  readonly manifestId: HandlerManifestId;
  readonly bindings: readonly HandlerBinding[];
  readonly createdAt: string;
}): HandlerManifest {
  const canonicalDigest = digestOfCanonical({
    manifestId: input.manifestId,
    bindings: input.bindings,
  });
  return {
    manifestRef: handlerManifestRef(
      input.manifestId,
      handlerManifestDigest(canonicalDigest as string),
    ),
    bindings: input.bindings,
    canonicalDigest,
    createdAt: input.createdAt,
  };
}

export function validateHandlerManifestAgainstSchema(
  manifest: HandlerManifest,
  operationTypeIds: readonly OperationTypeId[],
): Result<void, ControlPlaneViolation> {
  for (const operationTypeId of operationTypeIds) {
    const binding = manifest.bindings.find((item) => item.operationTypeId === operationTypeId);
    if (binding === undefined) {
      return err(
        controlPlaneViolation(
          "handler_manifest_mismatch",
          "validate",
          `missing handler binding for ${operationTypeId}`,
          { path: operationTypeId },
        ),
      );
    }
    if (binding.artifactDigest.length === 0) {
      return err(
        controlPlaneViolation(
          "handler_manifest_mismatch",
          "validate",
          `empty artifact digest for ${operationTypeId}`,
        ),
      );
    }
  }
  return ok(undefined);
}
