import type { CollaborationSnapshot, TranscriptMessage } from "@cantilune/core";
import { participantTranscript, withTranscript } from "@cantilune/core";
import { DEFAULT_NAMESPACE_ID } from "@cantilune/core";
import type { ReplayRecipe } from "../../replay/recipe.js";
import type { ApplyContext } from "../applyContext.js";
import type { ApplyResult } from "../handlerRegistry.js";
import { actorRefsFromSnapshot } from "../participantRef.js";

function isTranscriptMessage(value: unknown): value is TranscriptMessage {
  if (value === null || typeof value !== "object") {
    return false;
  }
  const row = value as { role?: unknown; content?: unknown; toolCallId?: unknown };
  if (typeof row.content !== "string") {
    return false;
  }
  if (row.role === "system" || row.role === "user" || row.role === "assistant") {
    return true;
  }
  return row.role === "tool" && typeof row.toolCallId === "string";
}

export function commitTranscriptHandler(
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  _ctx: ApplyContext,
): ApplyResult {
  const fromBinding = recipe.matchBindings.find((binding) => binding.role === "from");
  if (fromBinding?.role !== "from") {
    return { ok: false, reason: "commit_transcript requires 'from' binding" };
  }
  const current = before.participants.get(fromBinding.actorId);
  if (current === undefined || current.status === "retired") {
    return { ok: false, reason: "cannot commit transcript for missing or retired participant" };
  }
  const messagesJson = recipe.scalarInputs["messagesJson"];
  if (typeof messagesJson !== "string" || messagesJson.length === 0) {
    return { ok: false, reason: "commit_transcript requires scalar input 'messagesJson'" };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(messagesJson);
  } catch {
    return { ok: false, reason: "commit_transcript messagesJson is not valid JSON" };
  }
  if (!Array.isArray(parsed) || !parsed.every(isTranscriptMessage)) {
    return { ok: false, reason: "commit_transcript messagesJson must be a TranscriptMessage array" };
  }
  const revisionRaw = recipe.scalarInputs["revision"];
  const revision =
    typeof revisionRaw === "number" && Number.isSafeInteger(revisionRaw) && revisionRaw >= 0
      ? revisionRaw
      : (before.transcripts.get(fromBinding.actorId)?.revision ?? 0) + 1;
  const after = withTranscript(
    before,
    participantTranscript(fromBinding.actorId, parsed, {
      namespaceId: current.namespaceId ?? DEFAULT_NAMESPACE_ID,
      revision,
    }),
  );
  return {
    ok: true,
    after,
    involved: actorRefsFromSnapshot(before, [fromBinding.actorId]),
    createdSessionRefs: [],
  };
}
