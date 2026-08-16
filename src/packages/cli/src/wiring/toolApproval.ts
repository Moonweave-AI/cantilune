/**
 * Bridges the syscall authorization port to the TUI prompt.
 *
 * The syscall layer asks with an async call and holds the dispatch until it
 * resolves; the TUI answers with a keypress. This module is the adapter between
 * those two shapes, plus the session allowlist that "allow for this run"
 * populates.
 *
 * Nothing here decides policy. Which tiers require authorization is the
 * approver contract's business (ADR-0016 tiers), and whether a dispatch is even
 * reached is the runtime's.
 */
import type {
  ToolApprovalDecision,
  ToolApprovalRequest,
  ToolApprover,
  ToolExecutionTier,
} from "@cantilune/syscall";

/** How the operator answered one prompt. */
export type ApprovalChoice = "once" | "always" | "deny";

/** Presents a request and resolves with the operator's choice. */
export type ApprovalPrompt = (request: ToolApprovalRequest) => Promise<ApprovalChoice>;

export interface CliToolApprover extends ToolApprover {
  /** Tool names the operator allowed for the remainder of the run. */
  allowlist(): readonly string[];
  /** Forget every session allowance, e.g. when the runtime is reset. */
  reset(): void;
}

export interface CliToolApproverOptions {
  readonly prompt: ApprovalPrompt;
  /**
   * Tiers that require authorization. Omitted keeps the syscall default, which
   * asks for both side-effecting tiers and never for reads.
   */
  readonly requiresApprovalFor?: readonly ToolExecutionTier[];
}

/**
 * Build the CLI's authorization gate.
 *
 * "Allow for this run" is scoped to the tool name and to this approver
 * instance, so it dies with the runtime it was granted against — a reboot or a
 * `/reset` does not silently carry a prior session's trust forward.
 */
export function createCliToolApprover(options: CliToolApproverOptions): CliToolApprover {
  const allowed = new Set<string>();

  const approver: CliToolApprover = {
    ...(options.requiresApprovalFor !== undefined
      ? { requiresApprovalFor: options.requiresApprovalFor }
      : {}),

    async requestApproval(request: ToolApprovalRequest): Promise<ToolApprovalDecision> {
      if (allowed.has(request.toolName)) return { allowed: true };

      const choice = await options.prompt(request);
      if (choice === "deny") {
        return { allowed: false, reason: "the operator denied this invocation" };
      }
      if (choice === "always") allowed.add(request.toolName);
      return { allowed: true };
    },

    allowlist(): readonly string[] {
      return [...allowed].sort();
    },

    reset(): void {
      allowed.clear();
    },
  };
  return approver;
}
