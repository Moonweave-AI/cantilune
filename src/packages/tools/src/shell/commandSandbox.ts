import type { ShellConfig } from "../types.js";

const DEFAULT_DENY_LIST = [
  "rm -rf /",
  "rm -rf /*",
  "mkfs",
  "dd if=",
  "> /dev/",
  ":(){ :|:& };:",
  "format c:",
  "del /f /s /q",
];

export function checkCommand(
  command: string,
  config: ShellConfig,
): { allowed: boolean; reason?: string } {
  const trimmed = command.trim();
  if (trimmed.length === 0) {
    return { allowed: false, reason: "Empty command" };
  }

  const denyList = config.denyList ?? DEFAULT_DENY_LIST;
  for (const pattern of denyList) {
    if (matchesPattern(trimmed, pattern)) {
      return { allowed: false, reason: `Command denied by denyList: ${pattern}` };
    }
  }

  const allowList = config.allowList;
  if (allowList !== undefined && allowList.length > 0) {
    const allowed = allowList.some((prefix) => trimmed.startsWith(prefix));
    if (!allowed) {
      return { allowed: false, reason: "Command not in allowList" };
    }
  }

  return { allowed: true };
}

function matchesPattern(command: string, pattern: string): boolean {
  const normalizedCommand = command.toLowerCase();
  const normalizedPattern = pattern.toLowerCase();
  return normalizedCommand.includes(normalizedPattern);
}
