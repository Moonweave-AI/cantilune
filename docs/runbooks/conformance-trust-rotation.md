# Conformance trust rotation runbook

## Purpose

Rotate trust roots or policy versions without serving stale verification decisions from cache.

## Preconditions

- New trust root public keys published to the trust store (`TrustStore.version` bumped).
- New `VerificationPolicy.policyVersion` and `policyDigest` recorded in ADR-0009 change log.
- Verifier build pinned in CI (`ENGINEERING_ADMISSION_VERIFIER_BUILD` / package version).

## Rotation steps

1. **Publish trust material**
   - Add new `TrustRootEntry` rows with `notBefore` in the future if staged rollout.
   - Bump `TrustStore.version` (e.g. `trust/m3` → `trust/m4`).

2. **Invalidate caches**
   - Call `VerificationCache.invalidateAll()` on every verifier instance.
   - Cache keys MUST include: `subjectDigest + evidenceRoot + verifierBuild + policyVersion + trustRootSetVersion + revocationCheckpoint`.

3. **Verify gate**

   ```bash
   pnpm --filter @cantilune/conformance run verify:trust-rotation
   ```

4. **Re-verify sealed decisions**
   - Existing `ReviewedDecision` objects remain valid only if `verifierBuild` and `evidenceRootDigest` still match.
   - If verifier build changes, re-run machine verification and human review; do not reuse old seals.

5. **Control-plane**
   - Prepare/commit continues to require fresh `ReviewedDecision` bound to current verifier build.
   - No in-place mutation of stored decisions; append superseding decision log entries.

## CI gates

| Gate           | Command                                                          |
| -------------- | ---------------------------------------------------------------- |
| SBOM           | `pnpm --filter @cantilune/conformance run sbom`                  |
| Provenance     | `pnpm --filter @cantilune/conformance run provenance`            |
| Trust rotation | `pnpm --filter @cantilune/conformance run verify:trust-rotation` |
| Mutation       | `pnpm --filter @cantilune/conformance run test:mutation`         |

## Rollback

- Restore previous trust store snapshot.
- Bump `RevocationStore.checkpoint` to invalidate decisions issued under bad roots.
- Block release gate until new `ReviewedDecision` chain is complete.
