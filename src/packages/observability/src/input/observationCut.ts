import {
  rewriteSegments,
  validateBeforeRefChain,
  validateEpochConsistent,
  validateRunHistory,
  type ChangeId,
  type CollaborationSnapshot,
  type CoordinationChange,
  type SnapshotRef,
  type UnvalidatedTrace,
  type ValidatedRunHistory,
} from "@cantilune/core";
import { readOnlyViolation } from "../foundation/readOnlyViolation.js";
import { type ObservationInput, type ObservationReadPorts } from "./observationInput.js";

const DEFAULT_CUT_ATTEMPTS = 8;

function sleepMs(ms: number): void {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function uniqueChangeIds(changes: readonly CoordinationChange[]): boolean {
  const seen = new Set<ChangeId>();
  for (const change of changes) {
    if (seen.has(change.changeId)) {
      return false;
    }
    seen.add(change.changeId);
  }
  return true;
}

function validateHeadAlignment(
  sinceRef: SnapshotRef,
  headRef: SnapshotRef,
  snapshot: CollaborationSnapshot,
  changes: readonly CoordinationChange[],
): void {
  if (snapshot.snapshotRef !== headRef) {
    throw readOnlyViolation(
      "invalid_input",
      `head snapshot ref ${String(headRef)} does not match provided snapshot ${String(snapshot.snapshotRef)}`,
      "headRef",
    );
  }

  if (changes.length === 0 && sinceRef !== headRef) {
    throw readOnlyViolation(
      "invalid_input",
      `empty change window requires sinceRef === headRef (${String(sinceRef)} !== ${String(headRef)})`,
      "sinceRef",
    );
  }
}

function validateChangeChainBounds(
  sinceRef: SnapshotRef,
  headRef: SnapshotRef,
  changes: readonly CoordinationChange[],
): void {
  const first = changes[0];
  const last = changes.at(-1);
  if (first === undefined || last === undefined) {
    return;
  }

  if (first.beforeRef !== sinceRef) {
    throw readOnlyViolation(
      "invalid_input",
      `first change beforeRef ${String(first.beforeRef)} !== sinceRef ${String(sinceRef)}`,
      "sinceRef",
    );
  }

  if (last.afterRef !== headRef) {
    throw readOnlyViolation(
      "invalid_input",
      `last change afterRef ${String(last.afterRef)} !== headRef ${String(headRef)}`,
      "headRef",
    );
  }
}

function validateChangeChainContinuity(changes: readonly CoordinationChange[]): void {
  for (let index = 1; index < changes.length; index++) {
    const prior = changes[index - 1];
    const current = changes[index];
    if (prior === undefined || current === undefined) {
      continue;
    }
    if (current.beforeRef !== prior.afterRef) {
      throw readOnlyViolation(
        "invalid_input",
        `change chain gap at ${String(current.changeId)}: beforeRef ${String(current.beforeRef)} !== prior afterRef ${String(prior.afterRef)}`,
        "changes",
      );
    }
  }
}

function validateChangeEpochs(
  snapshot: CollaborationSnapshot,
  changes: readonly CoordinationChange[],
): void {
  for (const change of changes) {
    if (change.epochId !== snapshot.epochId) {
      throw readOnlyViolation(
        "invalid_input",
        `change ${String(change.changeId)} epoch ${String(change.epochId)} !== head snapshot epoch ${String(snapshot.epochId)}`,
        "epochId",
      );
    }
  }
}

/** Enforce closed sinceRef→headRef window and epoch/head alignment. */
export function validateObservationCut(input: ObservationInput): void {
  const { sinceRef, headRef, snapshot, changes } = input;

  validateHeadAlignment(sinceRef, headRef, snapshot, changes);
  if (changes.length === 0) {
    return;
  }

  if (!uniqueChangeIds(changes)) {
    throw readOnlyViolation("invalid_input", "duplicate changeId in observation window", "changes");
  }

  validateChangeChainBounds(sinceRef, headRef, changes);
  validateChangeChainContinuity(changes);
  validateBeforeRefChain(changes);
  validateEpochConsistent(changes);
  validateChangeEpochs(snapshot, changes);
}

function promoteValidatedHistory(history: UnvalidatedTrace): ValidatedRunHistory {
  return validateRunHistory(history);
}

function assertHistoryMatchesWindow(
  validated: ValidatedRunHistory,
  changes: readonly CoordinationChange[],
): void {
  const historyChanges = rewriteSegments(validated.segments);
  if (historyChanges.length !== changes.length) {
    throw readOnlyViolation(
      "invalid_input",
      `runHistory rewrite count ${historyChanges.length} !== window change count ${changes.length}`,
      "validatedHistory",
    );
  }
  for (let index = 0; index < changes.length; index++) {
    const windowChange = changes[index];
    const historyChange = historyChanges[index];
    if (windowChange === undefined || historyChange === undefined) {
      continue;
    }
    if (windowChange.changeId !== historyChange.changeId) {
      throw readOnlyViolation(
        "invalid_input",
        `runHistory changeId ${String(historyChange.changeId)} !== window changeId ${String(windowChange.changeId)} at index ${index}`,
        "validatedHistory",
      );
    }
  }
}

function cutFingerprint(
  headRef: SnapshotRef,
  snapshot: CollaborationSnapshot,
  changes: readonly CoordinationChange[],
): string {
  return JSON.stringify({
    headRef,
    snapshotRef: snapshot.snapshotRef,
    epochId: snapshot.epochId,
    changeIds: changes.map((change) => change.changeId),
    lastAfter: changes.at(-1)?.afterRef,
  });
}

function resolveValidatedHistory(
  rawHistory: UnvalidatedTrace | undefined,
  changes: readonly CoordinationChange[],
): ValidatedRunHistory {
  if (changes.length > 0) {
    if (rawHistory === undefined) {
      throw readOnlyViolation(
        "invalid_input",
        "runHistory port required for non-empty observation window",
        "runHistory",
      );
    }
    const validatedHistory = promoteValidatedHistory(rawHistory);
    assertHistoryMatchesWindow(validatedHistory, changes);
    return validatedHistory;
  }
  return rawHistory !== undefined
    ? promoteValidatedHistory(rawHistory)
    : promoteValidatedHistory([]);
}

interface CutSample {
  readonly headRef: SnapshotRef;
  readonly snapshot: CollaborationSnapshot;
  readonly changes: readonly CoordinationChange[];
}

function readStableCutSample(
  ports: ObservationReadPorts,
  sinceRef: SnapshotRef,
): CutSample | undefined {
  const headRefA = ports.head();
  if (headRefA === undefined) {
    throw readOnlyViolation("invalid_input", "head snapshot ref unavailable", "headRef");
  }
  const snapshotA = ports.getSnapshot(headRefA);
  if (snapshotA === undefined) {
    throw readOnlyViolation(
      "invalid_input",
      `head snapshot ${String(headRefA)} unavailable`,
      "snapshot",
    );
  }
  const changesA = ports.changesSince(sinceRef);

  const headRefB = ports.head();
  if (headRefB === undefined || headRefB !== headRefA) {
    return undefined;
  }
  const snapshotB = ports.getSnapshot(headRefB);
  if (snapshotB === undefined) {
    return undefined;
  }
  const changesB = ports.changesSince(sinceRef);
  const headRefC = ports.head();
  if (headRefC !== headRefA) {
    return undefined;
  }

  if (
    cutFingerprint(headRefA, snapshotA, changesA) !== cutFingerprint(headRefB, snapshotB, changesB)
  ) {
    return undefined;
  }

  return { headRef: headRefA, snapshot: snapshotB, changes: changesB };
}

/** Double-read ports until head/changes stabilize, then validate closed cut. */
export function readObservationCutFromPorts(
  ports: ObservationReadPorts,
  sinceRef: SnapshotRef,
  maxAttempts = DEFAULT_CUT_ATTEMPTS,
): ObservationInput {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      sleepMs(2 + attempt);
    }

    const sample = readStableCutSample(ports, sinceRef);
    if (sample === undefined) {
      continue;
    }

    const input: ObservationInput = {
      headRef: sample.headRef,
      sinceRef,
      snapshot: sample.snapshot,
      changes: sample.changes,
      validatedHistory: resolveValidatedHistory(ports.runHistory?.(), sample.changes),
    };
    validateObservationCut(input);
    return input;
  }

  throw readOnlyViolation(
    "invalid_input",
    `observation cut unstable after ${String(maxAttempts)} attempts`,
    "cut",
  );
}
