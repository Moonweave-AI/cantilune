# ADR-0031: Controlled CloakBrowser Web Search

| Field | Value |
| --- | --- |
| Status | Proposed |
| Date | 2026-08-19 |
| Decision Owner | Joker-of-Gotham (DRI) |
| Related | ADR-0016, ADR-0024, ADR-0030, `@cantilune/tools` |

## Context

The website and CLI need a working public-web search path without requiring a
third-party search API key. The existing providers required a separately supplied
API key, leaving `web_search` unavailable in a default local installation.

Browser automation adds an S4 network-egress and profile-isolation risk. It must
not become a general browser-control capability for the model or frontend.

## Decision

- Add the pinned `cloakbrowser` wrapper and `playwright-core` to
  `@cantilune/tools`.
- Make `cloakbrowser` the keyless default `web_search` provider. It uses a
  temporary headless browser to visit only the fixed public DuckDuckGo HTML
  endpoint and returns a bounded list of public HTTP(S) search results.
- Do not expose browser operations to the website. The existing server-side
  `ToolApprover`, tool tiers, E-Stop signal, and workspace boundaries remain the
  authority boundary.
- Explicitly disable update and Widevine behavior, pin Chromium
  `146.0.7680.177.5`, use a repository-local ignored cache, and prefetch it from
  `prepare` and root `prebuild` through `scripts/host/prefetch-cloakbrowser.mjs`.
- The integration never uses a persistent profile, login key, cookies, proxy,
  extension paths, geo-IP, locale/timezone spoofing, humanization, or arbitrary
  navigation. Keyless calls are serialized.
- A failed signed binary download is fatal. There is no unchecked binary fallback
  and no automatic downgrade to an alternate browser.

## Consequences

`pnpm install` and root `pnpm build` provision the same pinned browser artifact
when it is absent. The first provision downloads a large Chromium archive and
therefore needs normal outbound network access. The runtime search path remains
read-only and bounded; `web_fetch` stays a separate tool subject to its existing
policy.

Real-network smoke validation is required after host credentials are confirmed
free of plaintext leakage. No API key or browser profile may be stored in
`.cantilune/host.env` for this integration.
