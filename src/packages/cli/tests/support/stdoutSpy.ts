import { vi } from "vitest";

/**
 * Silences `process.stdout.write` for the duration of a test while still
 * recording the calls, so headless-runner assertions can inspect the output
 * without polluting the reporter.
 */
export function spyOnStdoutWrite() {
  return vi.spyOn(process.stdout, "write").mockImplementation(() => true);
}

export type StdoutWriteSpy = ReturnType<typeof spyOnStdoutWrite>;
