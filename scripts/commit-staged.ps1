# Staged commit script (PowerShell / Windows): commits all QA-0012 + D1/D2/C2
# + CLI#4 work in package/domain stages, then pushes to origin/main.
#
# Run from the repo root in PowerShell:
#     .\scripts\commit-staged.ps1
#
# Each stage adds explicit paths and commits. If any stage fails the script
# throws and stops; prior commits stay local and unpushed - inspect with
# `git log --oneline` and `git status`, fix, and re-run. Push happens ONLY at
# the very end, after all commits succeed.
#
# NOTE: PowerShell 5.1 has no `&&`/`||`; each native git call is checked via
# $LASTEXITCODE. Here-string closing '@ MUST sit at column 0.

$ErrorActionPreference = 'Stop'

function Invoke-Git {
    # Run git with the given args; throw on nonzero exit so the script halts.
    # NOTE: do NOT use `2>&1` here. PowerShell 5.1 routes native stderr (e.g.
    # the benign LF->CRLF warning) into the error stream, and with
    # $ErrorActionPreference='Stop' that throws even when git exits 0. Let
    # stderr print to the console naturally and judge success by $LASTEXITCODE.
    & git @args
    if ($LASTEXITCODE -ne 0) {
        throw "git $($args -join ' ') failed (exit $LASTEXITCODE)"
    }
}

# Start from a clean staging area so each stage's `git add` is exact.
# (Unstage only - never touch the working tree.)
Invoke-Git restore --staged -- .

# -- Stage 1: config & infrastructure ---------------------------------------
Invoke-Git add .gitignore package.json pnpm-lock.yaml AGENTS.md `
    eslint.config.js prettier.config.js .prettierignore `
    .github .vscode .cursor scripts diagrams
Invoke-Git commit -m @'
chore: add repo config, workflows, diagrams, and tooling scaffolding

Adds/updates: .gitignore (ignore CLI run artifacts + .kilo), package.json +
pnpm-lock workspace, AGENTS.md engineering closure, eslint/prettier configs,
GitHub Actions workflows (per-package + repo-gate), .vscode settings, Cursor
ontotect skills (state/ remains ignored), scripts/, and the 01-06 diagram
series. Also drops the .cursor/hooks/state/ runtime files from tracking.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 2: @cantilune/core enhancements -----------------------------------
Invoke-Git add src/packages/core/
Invoke-Git commit -m @'
feat(core): extend coordination, nodes, structure, and test suite

Coordination (collaborationSnapshot, observationStream, validation, change),
nodes (collaborationLink, communicationSession), structure, primitives, plus
the layered test suite and design-closure checklist recorded in AGENTS.md.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 3: SS-02 / ADR-0014 - durable epoch journal (runtime) --------------
Invoke-Git add src/packages/runtime/
Invoke-Git commit -m @'
feat(runtime): durable epoch journal atomic with the head (ADR-0014, SS-02)

DurableWireBundle gains optional schemaBinding; compareAndSwapHeadWithBinding
commits head + binding atomically; commit/recoverEpochTransition use the durable
bundle as authority when the in-memory journal is empty. L7 cross-process
crash test verifies recovery after a post-CAS kill. Closes SS-02 of QA-0012.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 4: SS-03 / ADR-0016 - external-tool exactly-once (content + syscall + tools)
Invoke-Git add src/packages/content/ src/packages/syscall/ src/packages/tools/
Invoke-Git commit -m @'
feat(content,syscall,tools): external-tool exactly-once execution (ADR-0016, SS-03)

content: content-addressed store (memory + file adapters) backing the durable
pre-invocation journal and artifact refs. syscall ToolExecutor gains
tier/tierFor/reconcile; useTool writes dispatched pre-execute and branches on
restart (read->re-dispatch, idempotent->reconcile, non-idempotent->ambiguous);
tools declares per-tool tiers (filesystem/shell/web/mcp). Four-boundary
cross-process crash tests. Closes SS-03 of QA-0012.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 5: D1 / ADR-0018 - inter-agent file transport (comms) --------------
Invoke-Git add src/packages/comms/
Invoke-Git commit -m @'
feat(comms): filesystem-backed inter-agent transport (ADR-0018, D1)

fileTransport.ts implements CommunicationTransport over the filesystem:
atomic dispatch (fsync + rename + pid-sequenced temp), FIFO receive with an
explicit base64-shape regex guard (Node Buffer.from is lenient), E-Stop paths,
and connectFileTransportPair. Unit + contract + cross-process tests.
T1 (FileTransport) realized; T3/T4 (NetTransport) not yet started.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 6: boot + cli - SS-01/D2/C2/CLI#4 package (ADR-0015/0019/0020) ----
Invoke-Git add src/packages/boot/ src/packages/cli/
Invoke-Git commit -m @'
feat(boot,cli): swarm lifecycle, multi-agent boot, judge verifier, CLI commands

- SS-01 / ADR-0015: ClusterSupervisor on the committed-change feed cursor,
  activate_participant, Participant.manifestRef, durable signal_done,
  liveness-expiry retire, reconcileLivenessFromWorld on (re)start.
- D2 / ADR-0019: bootSwarm beside bootCantilune (single-Agent byte-identical),
  pluggable AgentFactory -> per-agent CantilunOS on one shared durable world,
  /swarm command family, headless --swarm, L6 + L7 cross-process crash tests.
- C2 / ADR-0020: LLM judge verifier (blinded, clamped, fail-closed placeholder
  fallback), judge audit journal, calibration fixture.
- CLI #4: /content /cluster /eval /schema /petri wired to real engines.
Coverage gates green (boot 456 tests EXIT=0, cli 584 tests EXIT=0).

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 7: @cantilune/petri - Petri net executor (ADR-0017, CLI #4) --------
Invoke-Git add src/packages/petri/
Invoke-Git commit -m @'
feat(petri): real Petri firing engine (ADR-0017, CLI #4)

Dep-free package: structural net + marking + enablement, token-game firing,
bounded BFS reachability (mandatory maxSteps), S-invariants via Martinez-Silva
signed elimination. PetriNet type matches pnmlExporter for no-conversion
assignment. 53 tests, coverage gate EXIT=0.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 8: remaining production packages ----------------------------------
Invoke-Git add src/packages/observability/ src/packages/evaluation/ `
    src/packages/control-plane/ src/packages/adapter/ `
    src/packages/conformance/ src/packages/test-fixtures/
Invoke-Git commit -m @'
feat: observability, evaluation, control-plane, adapter, conformance packages

Adds the remaining production packages in the workspace: observability
(read boundary), evaluation (ADR-0011 engine), control-plane (ADR-0006
two-phase commit), adapter (LLM provider), conformance (RFC-0003), and
test-fixtures (fixture factory). All meet the L2-L7 coverage gate.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Stage 9: documentation (ADRs, RFCs, specs, research, QA, governance) ----
Invoke-Git add docs/
Invoke-Git commit -m @'
docs: ADRs 0001-0020, RFCs, specs, research, QA-0012 packet, governance

- ADRs 0014-0020 (SS-02/SS-01/SS-03/Petri/D1/D2/C2) with Owner design
  approval signatures; all remain Proposed pending independent L5 review.
- QA-0012 packet updated: SS-01/02/03 + CLI#4 + D1/D2/C2 implemented and green;
  L5 review package at docs/qa/qa-0012-l5-review-package.md.
- Full zh-CN translations of ADRs/RFCs/specs/research; reviewer-assignments
  updated. English canonical; zh-CN mirrors.

Co-Authored-By: Claude <noreply@anthropic.com>
'@

# -- Verify nothing was left behind ------------------------------------------
Write-Host "=== Remaining uncommitted (should be empty or only ignored) ==="
$ErrorActionPreference = 'Continue'
& git status --porcelain
Write-Host ""
$ErrorActionPreference = 'Stop'

# -- Push ---------------------------------------------------------------------
Write-Host "=== Pushing to origin/main ==="
Invoke-Git push origin main

Write-Host ""
Write-Host "=== Done. Last 10 commits: ==="
$ErrorActionPreference = 'Continue'
& git log --oneline -10
