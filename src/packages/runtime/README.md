# @cantilune/runtime

Cantilune coordination runtime — admission, apply, commit, replay.

Aligns with `diagrams/02-runtime/` and ADR-0002.

## Six-layer abstraction

| Layer | Module                           | Responsibility                      |
| ----- | -------------------------------- | ----------------------------------- |
| L1    | `engine/` · `ports/` · `schema/` | Running world + allow-space         |
| L2    | `observe/`                       | External boundary → auditTail       |
| L3    | `admission/` · `replay/recipe`   | Intent disposition → AdmittedIntent |
| L4    | `execution/`                     | ReplayKernel + handlers             |
| L5    | `execution/commitChange`         | Atomic put + ChangeLog              |
| L6    | `execution/replayVerifier`       | Chain replay without afterRef input |

## Commands

```bash
pnpm --filter @cantilune/core build
pnpm --filter @cantilune/runtime typecheck
pnpm --filter @cantilune/runtime test
pnpm --filter @cantilune/runtime build
```

## Exit criteria (CORE-HANDOFF)

- [x] before + admitted recipe → canonical after
- [x] replay without reading afterRef
- [x] admission failure zero side effects
- [x] story-t0-to-delegate via runtime
- [x] replay verification

`CoordinationIntent.inputContentRefs` is copied through admission into the durable
`ReplayRecipe` sidecar. It is distinct from `external` evidence. Operations that create a
`WorkArtifact` reject missing content refs instead of fabricating non-addressable `content://`
fallbacks; `fork_branch` remains content-free when it creates topology only.

The commit boundary also requires a synchronous `ContentRefAuthority` for every artifact whose
`contentRef` is newly introduced or changed. Direct runtime integrations must inject this port;
otherwise content-bearing commits fail closed with `content_ref_unavailable`. Boot and CLI pass the
same memory/file `ContentStore` instance to syscall and to this authority. Do not adapt the async
`ContentStore.exists()` Promise into a synchronous truth value.

The same authority guards every `ObservationEntry.payloadRef` before its audit-tail snapshot is
published. This keeps the reference advertised by perception/read_content reachable even for
direct `CoordinationRuntime.observe()` callers.
