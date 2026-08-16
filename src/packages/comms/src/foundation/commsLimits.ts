/** Resource and wire limits for comms ingress and delivery (M3 defaults). */
export const COMMS_LIMITS = {
  maxFrameBytes: 1_048_576,
  maxEnvelopeDepth: 32,
  maxCollectionSize: 10_000,
  maxAttachmentBytes: 16_777_216,
  maxDecompressedBytes: 32_777_216,
  replayWindowMs: 300_000,
  defaultMessageTtlMs: 86_400_000,
  maxRetryAttempts: 16,
  defaultRetryBudgetMs: 600_000,
  maxConcurrentSends: 256,
  maxInboxBacklog: 50_000,
} as const;

export const COMMS_WIRE_VERSION_V1 = 1 as const;
export const COMMS_REGISTRY_VERSION_V1 = 1 as const;
/** Pinned regression profile for the ADR-0018 T4 harness. */
export const A2A_PROFILE_PINNED = "a2a/0.1" as const;
/** A2A Protocol 1.0.0 Major.Minor (ADR-0027). Patch is not negotiated. */
export const A2A_PROTOCOL_VERSION_V1 = "1.0" as const;
/** Public A2A 1.0.0 profile string — distinct from the a2a/0.1 regression pin. */
export const A2A_PROFILE_V1 = "a2a/1.0" as const;
