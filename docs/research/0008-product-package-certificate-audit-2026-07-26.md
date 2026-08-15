# Product-package projection-certificate audit — 2026-07-26

## Conclusion

No production-package `ProductRuleProofBundle` can be instantiated
from the current repository. All eight package names are planned
distributions, while their package source trees, manifests, product rules, and
package-owned proof inputs do not yet exist here.

This is a negative repository finding, not a negative result about the generic
formal interfaces. The Lean development contains reference rules and generic
certificate gates, including a substantive P1c reconnect witness. Those
artifacts are not owned by, or indexed to, any of the eight planned product
packages and therefore must not be reported as product-package certificates.

## Classification and rationale

- Work object: read-only repository/package-certificate audit.
- Repository maturity observed: pre-alpha/bootstrap.
- Quality implication: this finding blocks product-wide theory closure and
  remains unverified beyond the mutable working tree until captured at an
  immutable reviewed commit.
- Decision: iterate. Do not promote the eight package rows to `proved`,
  `reviewed`, FCP-complete, or ADR-accepted status.

## Evidence boundary

Audit baseline:

- repository `HEAD`: `078da5f19a14538032b2b139600eef9ec9e49711`;
- audit date: 2026-07-26;
- the worktree contains uncommitted and untracked formal work, so `HEAD` does
  not bind the newly constructed Lean declarations;
- no network or package registry query was used; this is a local-repository
  existence audit.

Direct repository evidence:

1. `README.md:41` calls the project pre-alpha, says it is entering repository
   bootstrap and contract design, and explicitly says the described target
   capabilities are not all implemented.
2. `README.md:171-182` describes one repository and eight _planned_
   independently installable distributions.
3. `README.md:205` states: “Package publication has not started.”
4. `README.md:271-291` presents `packages/`, `providers/`, `conformance/`, and
   `integration/` as the intended tree and says each package is _expected_ to
   have its own manifest, source, tests, and related artifacts.
5. At audit time, the repository root contains `.agents`, `.git`, `.github`,
   `assets`, `docs`, and `formal`; the four intended directories
   `packages/`, `providers/`, `conformance/`, and `integration/` do not exist.
6. A repository search finds the distribution names in the English/Chinese
   target-architecture README material, but no package manifest or product
   source tree.

## Eight-package missing-evidence matrix

`Missing` means that no package-owned artifact was locatable in this
repository. It does not mean the corresponding concept is absent from the
generic/reference Lean theory.

| Planned package    | Planned distribution           | Package tree / manifest | Product rules | Four-view admission |    Rank | Pre-net | Resource/session & deletion | Authorization | Stable/fair window | Positive ε |
| ------------------ | ------------------------------ | ----------------------: | ------------: | ------------------: | ------: | ------: | --------------------------: | ------------: | -----------------: | ---------: |
| Cantilune          | `moonweave-cantilune`          |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |
| Cantilune Notation | `moonweave-cantilune-notation` |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |
| Cantilune Libretto | `moonweave-cantilune-libretto` |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |
| Cantilune Cast     | `moonweave-cantilune-cast`     |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |
| Cantilune Baton    | `moonweave-cantilune-baton`    |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |
| Cantilune Cue      | `moonweave-cantilune-cue`      |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |
| Cantilune Chorus   | `moonweave-cantilune-chorus`   |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |
| Cantilune Reprise  | `moonweave-cantilune-reprise`  |                 Missing |       Missing |             Missing | Missing | Missing |                     Missing |       Missing |            Missing |    Missing |

The required “four-view admission” cell includes concrete DAG, individual-token
pre-net/Petri, native late-π, and morphism interpretations plus their native,
reflection, replay, and signature-extension evidence. A package cannot fill
that cell by referring only to the generic gate.

## Formal result produced alongside the audit

`Cantilune.Theorems.CrossEpochProductFamily` now provides a generic
one-boundary composition:

- a real `FourCoherentFamilyAdmission`;
- a real new-signature `ProductRuleProofBundle`; and
- an equation connecting the admitted source state to the fixed rule source.

From those inputs it derives four native target admission edges, four native
one-event fixed-signature paths, exact admission replay, exact endpoint-free
`DPOEvent` replay, and four dependent `EpochChain` values. The dependent
chains use the existing arbitrary finite `EpochChain` type, and their replay
and strict-version proofs are kernel checked.

This theorem does not manufacture any missing package inhabitant. Its
one-boundary scope is deliberate: longer chains require actual adjacent
package endpoints and certificates for every additional boundary and rule
cell.

Targeted build actually executed:

```text
lake build Cantilune.Theorems.CrossEpochProductFamily \
  Cantilune.Tests.CrossEpochProductFamily
Build completed successfully (8696 jobs).
```

The root import was then built successfully as well:

```text
lake build Cantilune
Build completed successfully (8942 jobs).
```

The build was run against the mutable worktree on 2026-07-26. It is not
immutable commit-bound review evidence.

## Blockers and risks

- There is no product rule inventory against which completeness can be
  quantified.
- There are no package owners or package-local manifests in the intended
  paths from which rule/admission ownership can be derived.
- Rank, pre-net, resource/session quiescence, authorization, fairness,
  stable-window, and positive-ε assumptions are operational facts and cannot
  be inferred from a package name or generic theorem.
- Treating the reference P1c reconnect bundle as one of the eight product
  packages would erase the product boundary and create false completion
  evidence.

## Next steps

| Action                                                                                             | Owner                      | Due/review                      | Canonical link                            |
| -------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------- | ----------------------------------------- |
| Create each real package manifest/source/test/owner boundary                                       | Package owners             | Before product certificate work | Package tree and owner rules              |
| Publish a finite product-rule inventory per package                                                | Package owners             | Before completeness claims      | Package rule specification                |
| Supply `ProductRuleProofBundle` and cross-epoch admission inputs per rule                          | Rule owners + formal DRI   | Per rule                        | Lean declaration and proof manifest       |
| Supply rank, pre-net, resource/session, authorization, stable/fair-window, and positive-ε evidence | Runtime/probability owners | Per execution package           | Lean declaration and operational evidence |
| Re-run this matrix against an immutable commit                                                     | Independent QA-L4 reviewer | Before FCP                      | QA record + commit                        |
