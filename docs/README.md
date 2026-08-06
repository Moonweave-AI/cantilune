# Cantilune documentation map

This directory separates normative design, decision history, proof evidence,
and explanatory material. Start here instead of reading files by date.

## Current status

- The generic Core Theory and one substantive reference execution are
  **proved / independent-review-pending** at the source and evidence commits
  recorded in the [delivery record](THEORY-CLOSURE-DELIVERY-2026-07-27.md).
- RFC-0002 is still **Draft / pre-FCP** and ADR-0001 is still **Proposed**.
  Kernel evidence does not grant governance acceptance.
- The eight planned production packages remain separate Product Conformance
  work. No core theorem manufactures package rules, permissions, runtime
  facts, or probability assumptions.

For a Chinese project overview, see [README.zh-CN.md](README.zh-CN.md).

## Read by purpose

| Need | Canonical document |
|---|---|
| Understand the project without mathematics | [Primer](primer/for-the-curious.md) · [简体中文](primer/zh-CN/for-the-curious.zh-CN.md) |
| Understand the orchestration architecture | [RFC-0001](rfc/0001-cantilune-architecture.md) · [简体中文](rfc/zh-CN/0001-cantilune-architecture.zh-CN.md) |
| Understand what four-projection consistency promises and requires | [RFC-0002](rfc/0002-projection-consistency.md) · [简体中文](rfc/zh-CN/0002-projection-consistency.zh-CN.md) |
| Read the normative mathematical model | [Formal semantics](spec/formal-semantics.md) · [简体中文](spec/zh-CN/formal-semantics.zh-CN.md) |
| Read projection-level observable policies | [Observable LTS policies](spec/observable-lts-policies.md) |
| Implement package terminal classification | [Success predicates interface](spec/success-predicates-interface.md) |
| Review the architecture decision | [ADR-0001](adr/0001-unified-formal-structure.md) · [简体中文](adr/zh-CN/0001-unified-formal-structure.zh-CN.md) |
| Verify exactly what was proved | [Theory delivery](THEORY-CLOSURE-DELIVERY-2026-07-27.md) → [QA-L4 packet](qa/0002-theory-closure-proved-review-pending-2026-07-27.md) → [source/build evidence](qa/evidence/2026-07-28-cantilune-theory-source-59a1a688.md) |
| Review source boundaries and no-go results | [Research map](research/README.md) |
| Assign independent reviewers | [Reviewer assignments](governance/reviewer-assignments.md) |

## Authority and document types

When two documents appear to disagree, use this order:

1. source code, proof manifest, source-integrity record, and immutable build
   evidence for claims about implemented theorems;
2. the formal specification for normative definitions;
3. RFCs and ADRs for accepted scope and architecture decisions;
4. the QA packet and delivery record for review state and exclusions;
5. research logs for source analysis, failed routes, and proof provenance;
6. the primer and repository overview for explanation only.

Research logs and dated build notes cannot promote a theorem, pass FCP, or
accept an ADR. English RFC/ADR/spec documents are primary; Chinese files are
translations and should be reconciled in the same change when normative text
changes.

## Directory layout

| Path | Contents |
|---|---|
| `adr/` | Architecture decisions and their Chinese translations |
| `governance/` | Reviewer ownership and conflict-of-interest records |
| `primer/` | Non-normative introductions |
| `qa/` | Current review packet and immutable evidence |
| `research/` | Source audits, no-go boundaries, and final proof records |
| `rfc/` | Architecture and formal-consistency proposals |
| `spec/` | Normative semantics and package-facing interfaces |

## Maintenance rules

- Update an existing canonical document instead of adding another completion
  summary.
- Put exact build output and hashes in `qa/evidence/`; do not copy them into
  multiple progress reports.
- Mark a claim `proved` only when it is bound to immutable source and evidence.
  Keep `reviewed`, FCP, ADR, and Product Conformance status separate.
- A superseded or retracted report should be removed after its durable facts
  are merged into the current record. Git history remains the archive.
- Use repository-relative links and run the documentation link check after
  moving or deleting files.
