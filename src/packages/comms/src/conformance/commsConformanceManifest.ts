/** Comms-owned conformance manifest scaffold (M2). */
export interface CommsConformanceManifest {
  readonly manifestSchemaVersion: 1;
  readonly packageName: "@cantilune/comms";
  readonly claimScope: "generic" | "reference" | "product";
  readonly ruleInventoryRef: string;
  readonly evidenceRootDigest: string;
}

export const COMMS_MANIFEST_SCHEMA_VERSION = 1 as const;
