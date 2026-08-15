import { describe, expect, it } from "vitest";
import { createCommsServices } from "../../src/engine/createCommsServices.js";
import { defaultTestQuiescence, defaultTestSessionAuthority } from "../support/envelopeFixtures.js";

describe("createCommsServices", () => {
  it("creates test-mode services with memory store", () => {
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
    });
    expect(services.store).toBeDefined();
    expect(services.ingress).toBeDefined();
    expect(services.recovery.outbox).toBeDefined();
    expect(services.messagingSaga).toBeDefined();
  });

  it("throws in production mode without required ports", () => {
    expect(() =>
      createCommsServices({
        mode: "production",
        bindingResolver: { getActiveBinding: () => undefined },
        sessionAuthority: defaultTestSessionAuthority,
        quiescence: defaultTestQuiescence,
      }),
    ).toThrow(/production.*requires/);
  });

  it("freezes and unfreezes via admin service", () => {
    const services = createCommsServices({
      mode: "test",
      bindingResolver: { getActiveBinding: () => undefined },
      sessionAuthority: defaultTestSessionAuthority,
      quiescence: defaultTestQuiescence,
    });
    expect(services.admin.isFrozen()).toBe(false);
    services.admin.setFrozen(true);
    expect(services.admin.isFrozen()).toBe(true);
  });
});
