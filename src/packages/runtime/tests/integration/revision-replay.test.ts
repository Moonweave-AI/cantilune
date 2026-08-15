import { describe, expect, it } from "vitest";
import { epochId, operationTypeId, operationTemplateRef } from "@cantilune/core";
import { createReplayVerifier } from "../../src/execution/replayVerifier.js";
import { introduceArtifactHandler } from "../../src/execution/handlers/index.js";
import { InMemoryHandlerRegistry } from "../../src/execution/handlerRegistry.js";
import { createActiveSchemaContext } from "../../src/engine/activeSchemaContext.js";
import { createDefaultSchema, defaultIntroduceTemplate } from "../../src/schema/defaultSchema.js";
import type { OperationTemplate } from "../../src/schema/operationTemplate.js";
import { buildTestRuntime } from "../support/buildTestRuntime.js";
import { proposeAndCommitOrThrow, introduceIntent } from "../support/scenario/scenarioRunner.js";

const INTRODUCE_V2: OperationTemplate = {
  ...defaultIntroduceTemplate(),
  templateRef: operationTemplateRef("introduce_artifact", "2"),
  description: "introduce v2 test template",
};

describe("revision replay", () => {
  it("replays committed revision-1 changes with matching handler revision", () => {
    const { runtime, t0, durable } = buildTestRuntime({ eventCount: 8 });
    const committed = proposeAndCommitOrThrow(runtime, introduceIntent(0));
    const replay = runtime.replay({ fromRef: t0.snapshotRef });
    expect(replay.ok).toBe(true);
    if (!replay.ok) {
      return;
    }
    expect(replay.terminal.artifacts.size).toBe(1);
    expect(committed.change.templateRef?.revision).toBe("1");
    expect(durable.changes()).toHaveLength(1);
  });

  it("fails replay when handler revision does not match committed template revision", () => {
    const { runtime, t0, durable } = buildTestRuntime({
      eventCount: 8,
    });
    proposeAndCommitOrThrow(runtime, introduceIntent(0));

    const baseSchema = createDefaultSchema();
    const templates = [...baseSchema.templates, INTRODUCE_V2];

    const handlers = new InMemoryHandlerRegistry();
    handlers.register(operationTypeId("introduce_artifact"), introduceArtifactHandler, "2");

    const verifier = createReplayVerifier({
      durable,
      handlers,
      schemaContext: createActiveSchemaContext(
        {
          ...baseSchema,
          templates,
        },
        epochId("42"),
      ),
    });

    const replay = verifier.verify({ fromRef: t0.snapshotRef });
    expect(replay.ok).toBe(false);
    if (replay.ok) {
      return;
    }
    expect(["replay_mismatch", "template_not_found"]).toContain(replay.violation.code);
  });
});
