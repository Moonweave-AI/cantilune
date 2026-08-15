import type { ConformanceViolation } from "../foundation/conformanceViolation.js";

export const EXIT_OK = 0;
export const EXIT_VIOLATIONS = 1;
export const EXIT_USAGE = 2;
export const EXIT_TOOL_FAILURE = 3;

export type CliResult =
  | { readonly kind: "ok"; readonly output?: string }
  | {
      readonly kind: "violations";
      readonly violations: readonly ConformanceViolation[];
      readonly output?: string;
    }
  | { readonly kind: "usage"; readonly message: string }
  | { readonly kind: "tool_failure"; readonly message: string };

export function cliExitCode(result: CliResult): number {
  switch (result.kind) {
    case "ok":
      return EXIT_OK;
    case "violations":
      return EXIT_VIOLATIONS;
    case "usage":
      return EXIT_USAGE;
    case "tool_failure":
      return EXIT_TOOL_FAILURE;
  }
}
