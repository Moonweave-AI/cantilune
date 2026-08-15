export interface ConformanceAuditEvent {
  readonly kind: "verification_started" | "verification_completed" | "gate_evaluated";
  readonly runId: string;
  readonly profile: string;
  readonly subjectDigest: string;
  readonly decisionDigest?: string;
  readonly at: string;
}

export interface AuditSink {
  readonly emit: (event: ConformanceAuditEvent) => void;
}
