import { describe, expect, it } from "vitest";
import {
  actorId,
  actorRef,
  changeId,
  coordinationChange,
  epochId,
  operationTemplateRef,
  operationTypeId,
  snapshotRef,
  timestamp,
} from "@cantilune/core";
import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import {
  createOtlpTraceExporter,
  GEN_AI_ATTRIBUTES,
  GEN_AI_SEMCONV_STABILITY,
  CANTILUNE_OTLP_EXPORT_MATURITY,
} from "../../../src/export/otlpTraceExporter.js";

class MemorySpanExporter implements SpanExporter {
  readonly spans: ReadableSpan[] = [];

  export(spans: ReadableSpan[], resultCallback: (result: { code: number }) => void): void {
    this.spans.push(...spans);
    resultCallback({ code: 0 });
  }

  shutdown(): Promise<void> {
    return Promise.resolve();
  }

  forceFlush(): Promise<void> {
    return Promise.resolve();
  }
}

function sampleChange(options?: { readonly template?: boolean; readonly recordedAt?: string }) {
  return coordinationChange({
    changeId: changeId("chg-001"),
    recordedAt: timestamp(options?.recordedAt ?? "2026-08-15T10:00:00.000Z"),
    epochId: epochId("1"),
    operationTypeId: operationTypeId("introduce_artifact"),
    beforeRef: snapshotRef("snap-S0"),
    afterRef: snapshotRef("snap-S1"),
    initiator: actorRef(actorId("planner"), "agent"),
    visibility: "external",
    ...(options?.template === true
      ? { templateRef: operationTemplateRef("introduce_artifact", "1") }
      : {}),
  });
}

describe("createOtlpTraceExporter", () => {
  it("exports one span per committed change through an injected SpanExporter", async () => {
    const memory = new MemorySpanExporter();
    const exporter = createOtlpTraceExporter({ spanExporter: memory });
    await exporter.exportCommittedChanges([
      sampleChange({ template: true }),
      coordinationChange({
        changeId: changeId("chg-002"),
        recordedAt: timestamp("not-a-date"),
        epochId: epochId("1"),
        operationTypeId: operationTypeId("delegate"),
        beforeRef: snapshotRef("snap-S1"),
        afterRef: snapshotRef("snap-S2"),
        initiator: actorRef(actorId("planner"), "agent"),
        visibility: "internal",
      }),
    ]);
    expect(memory.spans).toHaveLength(2);
    const [first] = memory.spans;
    expect(first?.name).toBe("cantilune.commit introduce_artifact");
    expect(first?.attributes[GEN_AI_ATTRIBUTES.operationName]).toBe("invoke_agent");
    expect(first?.attributes[GEN_AI_ATTRIBUTES.providerName]).toBe("cantilune");
    expect(first?.attributes[GEN_AI_ATTRIBUTES.conversationId]).toBe("snap-S1");
    expect(first?.attributes[GEN_AI_ATTRIBUTES.stability]).toBe(GEN_AI_SEMCONV_STABILITY);
    expect(first?.attributes[GEN_AI_ATTRIBUTES.exportMaturity]).toBe(CANTILUNE_OTLP_EXPORT_MATURITY);
    expect(GEN_AI_SEMCONV_STABILITY).toBe("Development");
    expect(CANTILUNE_OTLP_EXPORT_MATURITY).toBe("production");
    expect(first?.attributes["cantilune.change.template_ref"]).toBe("introduce_artifact@1");
    await exporter.shutdown();
  });

  it("force-flushes an empty change list without creating spans", async () => {
    const memory = new MemorySpanExporter();
    const exporter = createOtlpTraceExporter({ spanExporter: memory });
    await exporter.exportCommittedChanges([]);
    expect(memory.spans).toHaveLength(0);
    await exporter.shutdown();
  });

  it("constructs the official OTLP/HTTP exporter when no port is injected", async () => {
    const exporter = createOtlpTraceExporter({
      url: "http://127.0.0.1:9/v1/traces",
      headers: { "x-cantilune": "test" },
    });
    await exporter.shutdown();
    const fallback = createOtlpTraceExporter();
    await fallback.shutdown();
  });
});
