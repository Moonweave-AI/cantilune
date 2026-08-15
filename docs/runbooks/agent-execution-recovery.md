# Agent execution continuity recovery

Use this runbook when a file-backed CLI run reports `epoch_mismatch`, loses prior private
conversation context, cannot read an artifact body, or reports success after a failed tool call.

## Safety boundary

- Do not delete or rewrite the durable bundle as a first response. Copy the whole configured
  `storagePath` before attempting migration.
- Do not accept an epoch because its name resembles `boot-epoch-*`. An exact legacy epoch may be
  listed only after the Owner verifies that the persisted world was created with the same built-in
  schema revision and operation declarations as the current binary.
- Do not convert an `ArtifactId` into a `ContentRef`. A normal content reference is
  `sha256:<64 lowercase hexadecimal characters>` and is verified against stored bytes.

## 1. Identify the world and principal

1. Read `~/.cantilune/config.json` (on Windows, `%USERPROFILE%\.cantilune\config.json`) and record
   `storagePath`, `principalId`, and `compatibleEpochIds`.
2. Read `<storagePath>/runtime/durable.bundle.json`; record `t0Ref`, `headRef`, and the head
   snapshot's `epochId` and active participants.
3. Stop if the configured principal is not one of the world's active Agents. For an old world with
   no configured principal, the CLI adopts it only when exactly one active Agent exists; ambiguity
   fails closed.

## 2. Recover a verified static-schema epoch alias

After schema provenance has been reviewed, add only the exact persisted epoch to the CLI config:

```json
{
  "compatibleEpochIds": ["boot-epoch-3dd1b913"]
}
```

Restart the CLI and require all of the following before considering the incident recovered:

- the instruction observation succeeds before the first LLM turn;
- `emit_heartbeat` commits with the exact submitted `turnCount` and `lastAction`, and restart/replay
  preserves those values and the original commit-time `emittedAt`;
- missing or malformed heartbeat scalars are rejected rather than replaced with `0` / `unknown`;
- `RunResult.ok` is true only when `toolCalls.unresolved` is zero;
- the durable head advances on the intended coordination operation.

If schema identity cannot be proven, remove the alias and use a governed schema resolver/migration.
The safe result is a rejected run, not relabelling the current schema with the persisted epoch.

## 3. Recover content reachability

For new writes, retain the exact SHA-256 reference returned by `write_content`, pass that value as
`introduce_artifact.contentRef`, and read it with `read_content(ref)`. Verify that the committed
`WorkArtifact.contentRef` equals that reference and that a fresh boot instance reads the exact
bytes.

An old `content://<artifactId>` pointer is a dangling legacy record. The current forward guard
prevents new records of that form, but it cannot reconstruct lost bytes or infer which historical
SHA-256 blob belonged to the artifact. Repair requires the original bytes or an authoritative
mapping. Without that evidence, keep the record quarantined and create a reviewed replacement;
do not guess from the artifact name or an assistant summary.

When the full historical body is available, recompute SHA-256 over its exact UTF-8 bytes and compare
the complete reference. A hash printed in a log or an assistant summary alone cannot reconstruct
missing bytes. The incident-specific read-only evidence is recorded in
`docs/qa/0012-agent-execution-continuity-qa.md`.

## 4. Interpret completion correctly

- A `done` summary is a model claim, not proof.
- Any unresolved read, write, external-tool, or coordination failure makes the current run fail.
- A separate later user instruction starts a new ordinary read/write/coordination ledger; review the
  retained private history, but do not assume that the earlier business failure automatically
  poisons the new task. An unresolved external observation receipt is different: it crosses runs
  because the prior side effect remains safety-relevant until its exact stored output is observed.
- If an external side effect completed but its audit observation failed, retry only with the exact
  stored-output recovery receipt. Never rerun the external tool to clear that failure.
- If output/receipt persistence itself failed after an external side effect, mark the outcome
  indeterminate and stop. Exactly-once recovery for that earlier crash window remains Stop-Ship.

## 5. Restore private tool history safely

- A current file-backed CLI writes a version 3 session envelope containing the visible session and
  the exact validated Boot `AgentLoopHistory`. The envelope is revision-CAS protected and bound to
  the canonical path, principal, and durable-world genesis.
- Boot awaits that checkpoint after each complete LLM response/tool-result group and before the next
  LLM request. If checkpointing fails, treat the run as failed and the existing Boot OS as poisoned;
  rebuild from the last verified durable history. Do not infer tool evidence from visible cards.
- Graceful mid-group termination records every unexecuted sibling as `SKIPPED: NOT EXECUTED` before
  checkpointing, so already completed calls are not discarded as an incomplete provider group.
- A version 2 envelope migrates only plain user/assistant text. Tool cards from that format are not
  execution receipts.
- If the runtime genesis, principal, path, revision, or history digest differs, quarantine the
  session and resume without it. Do not edit the binding to force a match.
- A provider/model/endpoint change in memory mode creates a new runtime and content world. Await the
  old shutdown and clear both visible and private history; never attach old ContentRefs to it. In
  file mode, preserve exact history only when the verified world generation is unchanged.
- A hard crash between tools in one multi-tool LLM response is outside this checkpoint boundary.
  Recover the content blob by its verified hash if possible, but do not invent the missing tool
  result or retry an indeterminate external side effect.

## 6. Recover an abandoned file lock safely

The runtime and governance stores publish complete lock records with an atomic same-directory hard
link. They deliberately do **not** delete a lock merely because its recorded PID appears dead: PIDs
are reusable, and deleting by pathname creates an ABA race that can admit two writers. A process
crash can therefore leave `.durable.lock`, `.control-plane.lock`, `.comms.lock`, or
`.conformance.lock` fail-closed until an operator intervenes.

1. Stop every Cantilune/CLI/worker process that can access the affected storage tree. Include
   containers, scheduled jobs, and remote hosts sharing the volume.
2. Verify quiescence with the operating system's process and open-handle tools. The PID text in the
   lock file is diagnostic only; it is not sufficient proof that no holder exists.
3. Copy the storage tree and the lock record for incident evidence.
4. Remove only the single abandoned lock file in the exact store directory. Do not recursively
   delete lock-like files, parent directories, bundles, content blobs, or candidate files while a
   process might be running.
5. Start exactly one recovery process. Require it to read and validate the existing durable bundle
   before starting additional writers; then run the relevant replay/integrity check.

If the filesystem does not support atomic hard links in the same directory, the lock acquisition
fails rather than falling back to an unsafe protocol. Move the store to a supported local volume or
provide a separately reviewed kernel/distributed lock implementation.

## Rollback

Remove the reviewed alias from `compatibleEpochIds` to restore fail-closed admission. Restore the
copied `storagePath` only while the CLI is stopped. A rollback does not reconstruct dangling legacy
content or make an indeterminate external side effect safe to repeat.

## Release status

This runbook covers the single-Agent, file-backed forward-recovery path. Production swarm
lifecycle, cross-process epoch-transition crash atomicity, and external-tool exactly-once execution
remain blocked by ADR-0012 and its QA-L5 packet.
