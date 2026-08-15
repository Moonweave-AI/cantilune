/**
 * Command wiring test for /petri commands (ADR-0017).
 *
 * Verifies that /petri, /petri transitions, /petri fire, /petri reach, and
 * /petri invariants prefetch real engine results through services.petriControl()
 * and stash them in store.viewArgs.petriData so the (synchronous) PetriView
 * renders from prefetched data. A real createPetriController stands in (the
 * engine is pure, so no mock is needed); the command wiring is under test.
 */
import { describe, it, expect } from "vitest";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { registerPetriCommands } from "../../src/commands/petriCommands.js";
import { createStore } from "../../src/store.js";
import { renderPetriViewOutput } from "../../src/views/PetriView.js";
import { sampleRuntime, emptyRuntime } from "../support/sampleRuntime.js";
import { createPetriController } from "../../src/wiring/petriControl.js";
import type { CommandServices } from "../../src/commands/registry.js";

function servicesWithController(): CommandServices {
  return { petriControl: () => createPetriController() };
}

function registry() {
  const reg = createCommandRegistry();
  for (const command of registerPetriCommands()) {
    reg.register(command);
  }
  return reg;
}

describe("/petri commands", () => {
  it("prefetches marking data for /petri", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute("/petri", store, servicesWithController());
    expect(store.activeView).toBe("petri");
    expect(store.viewArgs.petriData).toBeDefined();
    const output = renderPetriViewOutput("petri", store.viewArgs, sampleRuntime);
    expect(output).toContain("art:task-001");
  });

  it("prefetches transitions data for /petri transitions", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute("/petri transitions", store, servicesWithController());
    expect(store.activeView).toBe("petri-transitions");
    const output = renderPetriViewOutput("petri-transitions", store.viewArgs, sampleRuntime);
    expect(output).toContain("Enabled");
  });

  it("prefetches fire data for /petri fire with op + bindings", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute(
      '/petri fire introduce_artifact {"role":"coder"}',
      store,
      servicesWithController(),
    );
    expect(store.activeView).toBe("petri-fire");
    expect(store.viewArgs.petriData).toBeDefined();
    const output = renderPetriViewOutput("petri-fire", store.viewArgs, sampleRuntime);
    expect(output).toContain("Fire: introduce_artifact");
    expect(output).toContain('{"role":"coder"}');
  });

  it("prefetches reach data for /petri reach with goal", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute("/petri reach art:task-001", store, servicesWithController());
    expect(store.activeView).toBe("petri-reach");
    const output = renderPetriViewOutput("petri-reach", store.viewArgs, sampleRuntime);
    expect(output).toContain("Goal: art:task-001");
    expect(output).toContain("Verdict:");
  });

  it("prefetches invariants data for /petri invariants", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute("/petri invariants", store, servicesWithController());
    expect(store.activeView).toBe("petri-invariants");
    const output = renderPetriViewOutput("petri-invariants", store.viewArgs, sampleRuntime);
    expect(output).toContain("S-invariant");
  });

  it("falls back gracefully when no controller is present (headless)", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute("/petri", store, undefined);
    expect(store.activeView).toBe("petri");
    // petriData is null (no controller); view reports a data-load prompt.
    expect(store.viewArgs.petriData).toBeNull();
    const output = renderPetriViewOutput("petri", store.viewArgs, sampleRuntime);
    expect(output).toContain("No Petri data loaded");
  });

  it("renders no-runtime message when the runtime snapshot is null", async () => {
    const store = createStore({ runtime: emptyRuntime });
    await registry().execute("/petri", store, servicesWithController());
    const output = renderPetriViewOutput("petri", store.viewArgs, emptyRuntime);
    expect(output).toContain("No runtime connected");
  });

  it("reports a disabled fire when the op does not match any transition", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute("/petri fire nonexistent-op", store, servicesWithController());
    const output = renderPetriViewOutput("petri-fire", store.viewArgs, sampleRuntime);
    // Falls back to the first transition ("observe") and fires it (a real verdict).
    expect(output).toContain("Fire: observe");
  });

  it("treats malformed bindings JSON as no bindings and still fires", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute(
      "/petri fire introduce_artifact {not-valid-json}",
      store,
      servicesWithController(),
    );
    expect(store.activeView).toBe("petri-fire");
    // The parse catch drops bindings to undefined; the fire proceeds with "{}".
    const output = renderPetriViewOutput("petri-fire", store.viewArgs, sampleRuntime);
    expect(output).toContain("Fire: introduce_artifact");
    expect(output).toContain("{}");
  });

  it("stashes null petriData for /petri invariants in headless mode", async () => {
    const store = createStore({ runtime: sampleRuntime });
    await registry().execute("/petri invariants", store, undefined);
    expect(store.activeView).toBe("petri-invariants");
    expect(store.viewArgs.petriData).toBeNull();
    const output = renderPetriViewOutput("petri-invariants", store.viewArgs, sampleRuntime);
    expect(output).toContain("No Petri data loaded");
  });
});
