import { SpanStatusCode, type Attributes, type Tracer } from "@opentelemetry/api";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import {
  BasicTracerProvider,
  SimpleSpanProcessor,
  type SpanExporter,
} from "@opentelemetry/sdk-trace-base";
import type { CoordinationChange } from "@cantilune/core";

/**
 * Upstream OpenTelemetry GenAI semantic conventions (`gen_ai.*`).
 * Official status remains Development (no Stable keys as of 2026-07).
 * See https://github.com/open-telemetry/semantic-conventions-genai
 * Cantilune's OTLP export path itself is production — do not conflate the two.
 */
export const GEN_AI_SEMCONV_STABILITY = "Development" as const;

/** Cantilune OTLP/HTTP export maturity (engineering production, ADR-0025). */
export const CANTILUNE_OTLP_EXPORT_MATURITY = "production" as const;

export const GEN_AI_ATTRIBUTES = {
  operationName: "gen_ai.operation.name",
  providerName: "gen_ai.provider.name",
  conversationId: "gen_ai.conversation.id",
  requestModel: "gen_ai.request.model",
  stability: "cantilune.gen_ai.semconv.stability",
  exportMaturity: "cantilune.otlp.export.maturity",
} as const;

export type { SpanExporter };

export interface OtlpTraceExporterOptions {
  readonly url?: string;
  readonly headers?: Record<string, string>;
  /** Injected SpanExporter port — tests supply an in-memory exporter. */
  readonly spanExporter?: SpanExporter;
}

export interface ObservabilityTraceExporter {
  exportCommittedChanges(changes: readonly CoordinationChange[]): Promise<void>;
  shutdown(): Promise<void>;
}

function resolveSpanExporter(options: OtlpTraceExporterOptions): SpanExporter {
  if (options.spanExporter !== undefined) {
    return options.spanExporter;
  }
  return new OTLPTraceExporter({
    ...(options.url !== undefined ? { url: options.url } : {}),
    ...(options.headers !== undefined ? { headers: options.headers } : {}),
  });
}

function changeAttributes(change: CoordinationChange): Attributes {
  return {
    [GEN_AI_ATTRIBUTES.operationName]: "invoke_agent",
    [GEN_AI_ATTRIBUTES.providerName]: "cantilune",
    [GEN_AI_ATTRIBUTES.conversationId]: change.afterRef,
    [GEN_AI_ATTRIBUTES.stability]: GEN_AI_SEMCONV_STABILITY,
    [GEN_AI_ATTRIBUTES.exportMaturity]: CANTILUNE_OTLP_EXPORT_MATURITY,
    "cantilune.change.id": change.changeId,
    "cantilune.operation.type": change.operationTypeId,
    "cantilune.change.visibility": change.visibility,
    "cantilune.initiator.actor_id": change.initiator.actorId,
    "cantilune.snapshot.before": change.beforeRef,
    "cantilune.snapshot.after": change.afterRef,
    "cantilune.change.epoch": change.epochId,
    ...(change.templateRef !== undefined
      ? {
          "cantilune.change.template_ref": `${change.templateRef.operationTypeId}@${change.templateRef.revision}`,
        }
      : {}),
  };
}

function recordChangeSpan(tracer: Tracer, change: CoordinationChange): void {
  const parsed = Date.parse(change.recordedAt);
  const span = tracer.startSpan(`cantilune.commit ${change.operationTypeId}`, {
    attributes: changeAttributes(change),
    ...(Number.isNaN(parsed) ? {} : { startTime: parsed }),
  });
  span.setStatus({ code: SpanStatusCode.OK });
  if (Number.isNaN(parsed)) {
    span.end();
    return;
  }
  span.end(parsed);
}

/**
 * Export one OTLP span per committed change. Official `gen_ai.*` keys stay
 * Development; Cantilune OTLP export is production.
 */
export function createOtlpTraceExporter(
  options: OtlpTraceExporterOptions = {},
): ObservabilityTraceExporter {
  const exporter = resolveSpanExporter(options);
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  const tracer = provider.getTracer("cantilune.observability", "0.0.1");
  return {
    async exportCommittedChanges(changes) {
      for (const change of changes) {
        recordChangeSpan(tracer, change);
      }
      await provider.forceFlush();
    },
    async shutdown() {
      await provider.shutdown();
    },
  };
}
