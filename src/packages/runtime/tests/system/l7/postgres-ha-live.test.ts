import { describe, expect, it } from "vitest";
import { probePostgresHa } from "../../../src/memory/postgresHostProbe.js";

/**
 * Live Postgres HA (ADR-0023). Not in the default vitest include set.
 * Missing URL is an explicit failure — never skipIf.
 */
const url = process.env.CANTILUNE_DURABLE_DATABASE_URL?.trim();
if (url === undefined || url.length === 0) {
  throw new Error(
    "CANTILUNE_DURABLE_DATABASE_URL is required for postgres-ha-live (ADR-0023). Provision deploy/postgres-ha or set the operator URL.",
  );
}

describe("L7 live Postgres HA catalog", () => {
  it("reports a replica or synchronous standby, not a lone primary", async () => {
    const probe = await probePostgresHa({ connectionString: url, env: process.env });
    expect(probe.urlConfigured).toBe(true);
    expect(probe.tcpReachable).toBe(true);
    expect(probe.haReady).toBe(true);
    expect(
      (probe.replicaCount ?? 0) > 0 || (probe.synchronousStandbyNames ?? "").trim().length > 0,
    ).toBe(true);
  });
});
