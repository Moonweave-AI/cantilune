/** Wall-clock or logical instant recorded by the runtime when an entry is admitted. */
export type Timestamp = string;

/** Strict monotonic sequence number for auditTail ordering (Obs#001, Obs#002, …). */
export type SequenceNo = number;

export function timestamp(value: string): Timestamp {
  return value;
}

export function sequenceNo(value: number): SequenceNo {
  return value;
}
