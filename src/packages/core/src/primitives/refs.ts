import type { Brand } from "./ids.js";

declare const refBrand: unique symbol;

export type RefBrand<T extends string> = Brand<string, T>;

export type SnapshotRef = RefBrand<"SnapshotRef">;
export type ContentRef = RefBrand<"ContentRef">;

export const snapshotRef = (value: string): SnapshotRef => value as SnapshotRef;
export const contentRef = (value: string): ContentRef => value as ContentRef;

/** What kind of entity a change target or footprint entry refers to. */
export type TargetKind = "artifact" | "participant" | "session" | "capability" | "link";

/** A concrete entity matched or touched by a coordination step. */
export interface TargetRef {
  readonly kind: TargetKind;
  readonly id: string;
}

export function targetRef(kind: TargetKind, id: string): TargetRef {
  return { kind, id };
}

/** Kind of evidence attached to authorization or external proof. */
export type EvidenceKind = "policy" | "approval" | "observation" | "receipt";

/** Pointer to auditable evidence; often references an ObservationEntry in auditTail. */
export interface EvidenceRef {
  readonly evidenceId: string;
  readonly kind: EvidenceKind;
  readonly contentRef: ContentRef;
}

export function evidenceRef(
  evidenceId: string,
  kind: EvidenceKind,
  contentRefValue: ContentRef,
): EvidenceRef {
  return {
    evidenceId,
    kind,
    contentRef: contentRefValue,
  };
}
