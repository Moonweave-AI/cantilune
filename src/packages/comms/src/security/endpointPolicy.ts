import { err, ok, type Result } from "@cantilune/core";
import { commsViolation, type CommsViolation } from "../foundation/commsViolation.js";
import { type EndpointPolicy } from "./identityVerifier.js";

function globToRegExp(glob: string): RegExp {
  let regex = "^";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i];
    if (ch === "*") {
      if (glob[i + 1] === "*") {
        regex += ".*";
        i++;
      } else {
        regex += "[^/]*";
      }
    } else if (ch === "?") {
      regex += ".";
    } else if (ch === ".") {
      regex += String.raw`\.`;
    } else if (/[+^${}()|[\]\\]/.test(ch ?? "")) {
      regex += `\\${ch}`;
    } else {
      regex += ch;
    }
  }
  regex += "$";
  return new RegExp(regex, "i");
}

function hasGlobSyntax(pattern: string): boolean {
  return pattern.includes("*") || pattern.includes("?");
}

export function matchEndpointPattern(uri: string, pattern: string): boolean {
  if (hasGlobSyntax(pattern)) {
    return globToRegExp(pattern).test(uri);
  }
  return uri === pattern || uri.startsWith(pattern);
}

function matchesAnyPattern(uri: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => matchEndpointPattern(uri, pattern));
}

function endpointPolicyViolation(uri: string): Result<void, CommsViolation> {
  return err(
    commsViolation("endpoint_policy_violation", "negotiate", `endpoint not allowed: ${uri}`),
  );
}

/** Test-mode default — allows all endpoint URIs. */
export function permissiveEndpointPolicy(): EndpointPolicy {
  return {
    assertEndpointAllowed() {
      return ok(undefined);
    },
  };
}

/** Production default — denies all endpoints until caller configures an allowlist. */
export function denyByDefaultEndpointPolicy(): EndpointPolicy {
  return {
    assertEndpointAllowed(uri) {
      return endpointPolicyViolation(uri);
    },
  };
}

export function allowlistEndpointPolicy(patterns: readonly string[]): EndpointPolicy {
  return {
    assertEndpointAllowed(uri) {
      if (patterns.length === 0) {
        return endpointPolicyViolation(uri);
      }
      if (matchesAnyPattern(uri, patterns)) {
        return ok(undefined);
      }
      return endpointPolicyViolation(uri);
    },
  };
}

export function denylistEndpointPolicy(patterns: readonly string[]): EndpointPolicy {
  return {
    assertEndpointAllowed(uri) {
      if (matchesAnyPattern(uri, patterns)) {
        return endpointPolicyViolation(uri);
      }
      return ok(undefined);
    },
  };
}

/** @deprecated Use {@link permissiveEndpointPolicy} — kept for backwards compatibility. */
export class PermissiveEndpointPolicy implements EndpointPolicy {
  assertEndpointAllowed(_uri: string): Result<void, CommsViolation> {
    return ok(undefined);
  }
}
