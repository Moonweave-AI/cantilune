# ADR-0025: Observability Platform (OTel + AG-UI + OTLP)

| Field          | Value                                                                |
| -------------- | -------------------------------------------------------------------- |
| Status         | **Accepted**                                                         |
| Created        | 2026-08-15                                                           |
| Decision Owner | Joker-of-Gotham                                                      |
| Reviewers      | Joker-of-Gotham (independent Architecture + Security; COI disclosed) |
| Related        | ADR-0005, RFC-0001 §7                                                |

## Context

Owner authorized a public **observability platform** claim. Cantilune OTLP/HTTP export is **production** (`CANTILUNE_OTLP_EXPORT_MATURITY`). Upstream OpenTelemetry `gen_ai.*` keys remain **Development** (repo `semantic-conventions-genai`; no Stable keys as of 2026-07) — that is the official spec status, not a Cantilune landing gap. AG-UI is the agent↔user event standard. SIEM products ingest OTLP via Collector; Cantilune must not vendor-lock Splunk/Elastic APIs.

## Decision

1. `@cantilune/observability` is the platform read face: FourView + redaction + exporters.
2. OTLP/HTTP export using official `@opentelemetry/*` is production. Official `gen_ai.*` attribute names stay Development until upstream stabilizes them.
3. AG-UI events derived from committed world + visible transcripts (RUN/TEXT/TOOL/STATE/REASONING).
4. `ProjectionCertificate` stays in `@cantilune/conformance`. Observability holds only a digest reference.
5. Production reads require `ObservationAccessContext`. Cross-namespace applies ADR-0022.
6. No second EventSpine per replica.

## Approval

**Architecture + Security**: Joker-of-Gotham (COI disclosed)  
**Date**: 2026-08-15
