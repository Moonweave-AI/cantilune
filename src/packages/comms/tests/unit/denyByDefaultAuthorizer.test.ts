import { describe, expect, it } from "vitest";
import { denyByDefaultAuthorizer } from "../../src/security/denyByDefaultAuthorizer.js";
import { buildTestAuthContext } from "../support/envelopeFixtures.js";

describe("denyByDefaultAuthorizer", () => {
  it("denies all actions by default", () => {
    const authorizer = denyByDefaultAuthorizer();
    const result = authorizer.authorize({
      action: "ingress.receive",
      context: buildTestAuthContext(),
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.error.code).toBe("session_not_authorized");
  });
});
