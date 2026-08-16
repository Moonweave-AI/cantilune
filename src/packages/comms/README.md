# @cantilune/comms

Typed late-π communication facet for Cantilune agent orchestration.

## Status

**M2–M3 prototype.** Not approved for production untrusted-network deployment. See [COMMS-DESIGN-CLOSURE.md](./COMMS-DESIGN-CLOSURE.md).

## Usage

### Production wiring (fail-closed)

Production callers must supply identity, authorizer, observation, and runtime commit ports:

```typescript
import { createCommsServices } from "@cantilune/comms";
import { createRuntimeCommsPorts } from "@cantilune/comms/runtime";

const ports = createRuntimeCommsPorts({ runtime, epochAdmin });
const services = createCommsServices({
  mode: "production",
  identity: hmacVerifier,
  authorizer: myAuthorizer,
  observation: ports.observation,
  runtimeCommit: ports.runtimeCommit,
  bindingResolver,
  sessionAuthority,
  quiescence,
});
```

Optional HMAC identity (A34): if `CANTILUNE_COMMS_HMAC_KEY` or `{storeDir}/hmac.key`
is present, production `createCommsServices` uses `HmacIdentityVerifier` and
ignores a weaker injected verifier. Keys are operator-supplied — never hardcoded.
Absent key material keeps the caller-supplied verifier (boot defaults to ActorId pin).

### NetTransport (ADR-0018 T3)

Cross-host delivery is TCP + TLS 1.3 + mTLS on the same `CommunicationTransport`
port. Callers supply leaf PEMs and receipt-pinned peer certificate fingerprints
(`issueSelfSignedMtlsPair` is the localhost/private-swarm issuer; production
multi-host should use operator-supplied material). An unpinned peer requires
`provenanceUnavailable` and must not carry publishable superiority claims.

```typescript
import { connectNetTransportPair, runA2AConformanceHarness } from "@cantilune/comms";

const [local, remote] = await connectNetTransportPair();
```

A2A Protocol **1.0.0** (ADR-0027) is implemented in `@cantilune/comms` as Agent Card,
Task/Message/Part/Artifact, Send/Stream/Get/List/Cancel, Get Agent Card, and push,
with JSON-RPC 2.0, HTTP/REST, SSE, and the official gRPC service
`lf.a2a.v1.A2AService` (`@grpc/grpc-js` + vendored `specification/a2a.proto`).
The public claim is **A2A 1.0.0 compliant**, not every future draft.

The pinned `a2a/0.1` harness (`pnpm --filter @cantilune/comms test:a2a-conformance`)
remains the ADR-0018 T4 regression gate.

### Test / local harness

```typescript
const services = createCommsServices({
  mode: "test",
  bindingResolver: { getActiveBinding: () => binding },
  sessionAuthority: { isController: () => true, isMember: () => true },
  quiescence: { resourcesClear: async () => true, sessionsQuiescent: async () => true },
});
```

Use `tests/support/commsTestHelpers.ts` (`sealTestAuthContext`, `withIntegrityDigest`) in package tests only.

## Subpath exports

| Export                     | Purpose                                       |
| -------------------------- | --------------------------------------------- |
| `@cantilune/comms`         | Core types + services                         |
| `@cantilune/comms/memory`  | In-memory store / loopback (non-production)   |
| `@cantilune/comms/runtime` | Runtime observe/commit ports                  |
| `@cantilune/comms/a2a`     | A2A 1.0.0 bindings + pinned `a2a/0.1` adapter |
| `@cantilune/comms/file`    | File-backed store (fail-closed on corruption) |
| `@cantilune/comms/net`     | `NetTransport` (TCP + TLS 1.3 + mTLS)         |

Stubs (`testRuntimeCommitPort`), test brokers, and permissive defaults are **not**
re-exported from the root entry or from `./memory`. Tests import them from
`src/engine/testRuntimeCommitPort.ts` / `src/integration/a2aExternalAgentHarness.ts`.

## Ingress pipeline

Inbound frames: **strict decode → transport binding → identity → expiry → replay → authorization → durable inbox → runtime consumer → ack**.

Any step failure prevents downstream side effects.
