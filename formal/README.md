# Cantilune formal semantics

This directory is the single Lean 4 proof project for Cantilune's formal
semantics. The project pins both Lean and mathlib; `lake-manifest.json` records
the resolved dependency commits.

The English specification and RFC remain the normative prose sources. A proof
obligation is complete only when its manifest entry names a kernel-checked Lean
declaration and the required independent reviews are recorded.

## Build

```powershell
$env:PATH = "$env:USERPROFILE\.elan\bin;$env:PATH"
lake build
```

The dependency lock is present in this working tree; routine builds must not run
`lake update`. Run the complete local evidence gate from the repository root:

```powershell
.\formal\scripts\ci.ps1
```

This is a development gate: it compiles partial work while preserving its
manifest status. The final promotion gate is:

```powershell
.\formal\scripts\ci.ps1 -RequireComplete
```

The promotion form accepts only `reviewed` central obligations. Both forms
verify `source-integrity.json`, reject unknown kernel dependencies, and bind
any `proved/reviewed` claim to an existing source commit and durable evidence
files.

The current generic Core Theory is already bound as `proved /
review-pending`. To verify that a checkout still has the sealed proof tree
without recreating the deleted `.lake` cache, run:

```powershell
.\formal\scripts\ci.ps1 -RequireProved -VerifyTreeOnly
```

For an independent kernel rebuild, run the ordinary `lake build` and evidence
gate above. `formal/.lake/` is generated, ignored, and intentionally absent
from version control; the pinned toolchain and lock file reconstruct it.

No project theorem may use `sorry`, `admit`, a project-defined axiom, or
`unsafe`. A successful local build is still not an independent review or an
immutable proof record; see `build-evidence/` and `proof-obligations.json`.
