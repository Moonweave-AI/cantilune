# Package evidence inventories (P6)

Each production package under `src/packages/*/evidence/inventory.json` is the
input surface for `@cantilune/conformance` `verifyPackage` / `verify-package`.

## CI usage

```bash
pnpm --filter @cantilune/conformance exec node dist/cli/main.js verify-package \
  --manifest <path> \
  --inventory src/packages/<pkg>/evidence/inventory.json \
  --store-dir <evidence-store>
```

Empty `artifacts` arrays **must fail** verification (no silent self-attestation).
Release certificates are **not** auto-signed by this workflow — Owner gate C3.
