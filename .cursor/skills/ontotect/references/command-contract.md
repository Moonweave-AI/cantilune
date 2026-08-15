# Ontotect command contract

Ontotect is one portable Agent Skill with an internal command interface. The
commands are semantic instructions to the agent, not claims that a shell
program has completed ontology engineering.

## Portable invocation

Use the host-neutral form everywhere:

```text
Use Ontotect. Command: <command>. Target: <path-or-IRI>. <request>
```

When a host exposes a direct skill invocation, these shorter forms may work:

```text
$ontotect <command> <target> <request>
/ontotect <command> <target> <request>
```

The invocation marker is host behavior. The command names and their semantics
remain the same. Never make a workflow depend on host-specific interpolation,
implicit shell execution, or a particular slash-command implementation.

## Commands

| Command | Purpose | Default mutation boundary |
|---|---|---|
| `help` | Explain Ontotect and give a safe first command. | Read-only |
| `router` (`route`) | Select a command, entry stage, and pipeline. | Read-only when explicitly invoked |
| `status` | Reconstruct the current state and next gate. | Read-only |
| `build` | Design, construct, or extend an ontology. | Project-scoped artifacts |
| `review` | Produce evidence-linked findings without repair. | Read-only |
| `repair` | Reproduce and minimally correct a defect. | Authorized target only |
| `optimize` | Improve a measured cost while protecting semantics. | Authorized target only |
| `refactor` | Improve structure under a semantic preservation contract. | Authorized target only |
| `validate` | Run and report specified evidence layers. | Read-only by default |
| `govern` | Define ownership, change, identifier, and maintenance controls. | Project governance artifacts |
| `release` | Verify and prepare a coordinated release. | Release workspace; publication requires separate authorization |

Lifecycle stages are available through `stage <stage>` and as direct aliases:
`charter`, `reuse`, `conceptualize`, `formalize`, `implement`, `verify`, and
`release`. The direct `release` command and the Stage G alias intentionally
share one contract.

Engineering scenario commands select a lifecycle entry stage. `help` has no
lifecycle stage (`n/a`), while `status` reports the stage reconstructed from
evidence or `unverified`. These coordination values are not stage aliases and
cannot be requested with `stage`.

## Optional qualifiers

```text
--from-stage <stage>   start at a stage whose prerequisites are evidenced
--to-stage <stage>     stop after this stage and report the next gate
--qa <QA-L0..QA-L5>    requested evidence level, never an automatic claim
--plan-only            produce the route and plan without changing artifacts
--resume <state-file>  reconstruct work from a durable state artifact
```

Qualifiers are request metadata, not permission escalation. A requested stage
cannot turn an unmet prerequisite into a pass. Record it as `blocked`,
`unverified`, or an explicitly bounded `prototype`.

## Explicit command rules

1. `help`, explicit `router`, `status`, and `--plan-only` remain read-only.
2. An explicit command overrides inferred synonyms. A stage qualifier narrows
   that command but does not change its mutation boundary.
3. `review` never repairs and `validate` never redesigns unless the user
   explicitly requests a following mutating command.
4. Multiple explicit intents form a pipeline in this order:
   `review -> repair/refactor/optimize -> validate -> govern -> release`.
5. Missing authority, incompatible licensing, public-IRI reuse, sensitive data,
   or a request outside the named target can stop any pipeline.
6. Do not install dependencies, publish remotely, or change files outside the
   authorized scope merely because a command would benefit from it.

## Work and result cards

Start an engineering route with a Route Card using
[route-card.md](../assets/route-card.md). Explicit `router` always returns the
card. `help` answers its response contract directly, while `status` reconstructs
the Work State directly; neither needs a synthetic Route Card unless the host
requires a common envelope. At each material gate, publish a compact progress
card containing command, stage, facts, assumptions, decisions, artifacts,
checks, blockers, and next gate. Persist cross-session state using
[work-state.md](../assets/work-state.md) or an equivalent project artifact.

The final result must contain:

1. outcome;
2. ontology contract;
3. artifacts;
4. evidence actually produced;
5. findings or decisions;
6. semantic impact;
7. `unverified` items and residual risks;
8. next gate, Owner/DRI, and completion criterion.

Keep three layers distinct:

- **individual check result**: `pass`, `fail`, `error`, `unverified`, or
  `not-applicable` with rationale;
- **exception overlay**: `none` or `accepted-exception` without erasing the
  underlying result;
- **lifecycle and release gate disposition**: `pass`, `pass-with-actions`,
  `revise`, `blocked`, or `unverified`.

An exception is valid only when its authority, rationale, scope, review or
expiry condition, and durable decision artifact are recorded. A release also
needs the release policy and release authority to permit that exception. Apply
gate precedence deterministically:

1. `revise` when executed evidence shows an unmet required contract and no
   valid exception covers it;
2. otherwise `blocked` when a known missing authority, license, critical
   input, dependency, privacy/safety control, or prerequisite prevents the
   required work;
3. otherwise `unverified` when required evidence is absent or uninterpretable
   but no specific blocker has been established;
4. otherwise `pass-with-actions` when all blocking requirements are satisfied
   and only valid exceptions or owned non-blocking actions remain;
5. otherwise `pass` when every required item passed or is justifiably
   `not-applicable`.

For a tool `error`, diagnose the cause and then apply the same precedence; do
not treat the error itself as an ontology failure or a pass. A user-reported
success without its execution contract or evidence artifact remains a reported
claim and the check result is `unverified`. Do not introduce hashes, dependency
locks, repeated tool-version checks, or version pinning unless the user or a
proportionate assurance process requires them.
