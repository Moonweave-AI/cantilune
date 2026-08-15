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
| `@cantilune/comms/a2a`     | **Experimental** A2A wire adapter             |
| `@cantilune/comms/file`    | File-backed store (fail-closed on corruption) |

Stubs (`testRuntimeCommitPort`), test brokers, and permissive defaults are **not** re-exported from the root entry.

## Ingress pipeline

Inbound frames: **strict decode → transport binding → identity → expiry → replay → authorization → durable inbox → runtime consumer → ack**.

Any step failure prevents downstream side effects.
