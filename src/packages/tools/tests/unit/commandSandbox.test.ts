import { describe, expect, it } from "vitest";
import { checkCommand } from "../../src/shell/commandSandbox.js";

describe("commandSandbox", () => {
  it("rejects empty commands", () => {
    const check = checkCommand("   ", { enabled: true });
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe("Empty command");
  });

  it("denies commands matching default denyList patterns", () => {
    const check = checkCommand("please mkfs /dev/sda", { enabled: true });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("mkfs");
  });

  it("uses custom denyList", () => {
    const check = checkCommand("curl evil", { enabled: true, denyList: ["curl"] });
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain("curl");
  });

  it("allows commands when allowList prefix matches", () => {
    const check = checkCommand("git status", { enabled: true, allowList: ["git "] });
    expect(check.allowed).toBe(true);
  });

  it("rejects commands outside allowList when configured", () => {
    const check = checkCommand("npm test", { enabled: true, allowList: ["pnpm "] });
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe("Command not in allowList");
  });

  it("allows any non-denied command when allowList is empty", () => {
    const check = checkCommand("echo safe", { enabled: true, allowList: [] });
    expect(check.allowed).toBe(true);
  });
});
