/**
 * CLI authorization gate: prompt bridging and the session allowlist.
 *
 * The gate holds a real dispatch open, so its two obligations are that a denial
 * is reported as a denial and that "allow for this run" is scoped to the run
 * that granted it — trust must not survive a reset.
 */
import { describe, expect, it, vi } from "vitest";
import type { ToolApprovalRequest } from "@cantilune/syscall";
import { createCliToolApprover } from "../../src/wiring/toolApproval.js";
import { formatArgValue } from "../../src/tui/ApprovalDialog.js";

function request(toolName: string, args: Record<string, unknown> = {}): ToolApprovalRequest {
  return {
    toolName,
    args,
    tier: "non-idempotent",
    key: {
      principal: { actorId: "planner", kind: "agent" },
      toolName,
      argumentsDigest: "sha256:test",
      originalToolCallId: "c1",
    },
  };
}

describe("prompt bridging", () => {
  it("allows when the operator approves once, without remembering the tool", async () => {
    const prompt = vi.fn(async () => "once" as const);
    const approver = createCliToolApprover({ prompt });

    expect(await approver.requestApproval(request("shell"))).toEqual({ allowed: true });
    expect(await approver.requestApproval(request("shell"))).toEqual({ allowed: true });
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(approver.allowlist()).toEqual([]);
  });

  it("denies with a reason the caller can surface", async () => {
    const approver = createCliToolApprover({ prompt: async () => "deny" });
    const decision = await approver.requestApproval(request("shell"));
    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toContain("operator denied");
  });

  it("passes the full request through to the prompt", async () => {
    const seen: ToolApprovalRequest[] = [];
    const approver = createCliToolApprover({
      prompt: async (r) => {
        seen.push(r);
        return "once";
      },
    });
    await approver.requestApproval(request("shell", { cmd: "ls -la" }));
    expect(seen[0]).toMatchObject({ toolName: "shell", args: { cmd: "ls -la" } });
  });

  it("forwards a custom tier set to the syscall contract", () => {
    const approver = createCliToolApprover({
      prompt: async () => "once",
      requiresApprovalFor: ["read"],
    });
    expect(approver.requiresApprovalFor).toEqual(["read"]);
  });

  it("leaves the tier set unset when none is configured", () => {
    const approver = createCliToolApprover({ prompt: async () => "once" });
    expect(approver.requiresApprovalFor).toBeUndefined();
  });
});

describe("session allowlist", () => {
  it("stops asking for a tool the operator allowed for the run", async () => {
    const prompt = vi.fn(async () => "always" as const);
    const approver = createCliToolApprover({ prompt });

    await approver.requestApproval(request("shell"));
    await approver.requestApproval(request("shell"));
    expect(prompt).toHaveBeenCalledTimes(1);
    expect(approver.allowlist()).toEqual(["shell"]);
  });

  it("keeps the allowance scoped to that one tool", async () => {
    const prompt = vi.fn(async () => "always" as const);
    const approver = createCliToolApprover({ prompt });

    await approver.requestApproval(request("shell"));
    await approver.requestApproval(request("filesystem_edit_file"));
    expect(prompt).toHaveBeenCalledTimes(2);
    expect(approver.allowlist()).toEqual(["filesystem_edit_file", "shell"]);
  });

  it("forgets every allowance on reset, so a reboot re-asks", async () => {
    const prompt = vi.fn(async () => "always" as const);
    const approver = createCliToolApprover({ prompt });

    await approver.requestApproval(request("shell"));
    approver.reset();
    expect(approver.allowlist()).toEqual([]);
    await approver.requestApproval(request("shell"));
    expect(prompt).toHaveBeenCalledTimes(2);
  });
});

describe("argument rendering", () => {
  it("shows a short string verbatim", () => {
    expect(formatArgValue("ls -la", 40)).toBe("ls -la");
  });

  it("serializes non-strings so the operator sees real values", () => {
    expect(formatArgValue({ a: 1 }, 40)).toBe('{"a":1}');
    expect(formatArgValue(42, 40)).toBe("42");
    expect(formatArgValue(true, 40)).toBe("true");
  });

  it("flattens newlines so one argument stays one row", () => {
    expect(formatArgValue("line one\n  line two", 40)).toBe("line one line two");
  });

  it("truncates past the width budget rather than wrapping the dialog", () => {
    const long = "x".repeat(100);
    const rendered = formatArgValue(long, 10);
    expect(rendered).toHaveLength(10);
    expect(rendered.endsWith("…")).toBe(true);
  });

  it("renders undefined without throwing", () => {
    expect(formatArgValue(undefined, 20)).toBe("undefined");
  });
});
