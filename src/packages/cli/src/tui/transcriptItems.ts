import type { ChatMessage, LifecycleLine, ToolCallDisplay } from "../store.js";
import { describeToolCard, toolFamily } from "./formatToolCard.js";

export type TranscriptItem =
  | { readonly kind: "message"; readonly message: ChatMessage }
  | {
      readonly kind: "turn";
      readonly assistant: ChatMessage;
      readonly tools: readonly ToolCallDisplay[];
      readonly lifecycle: readonly LifecycleLine[];
    };

/**
 * Fold tool-only system rows into the preceding assistant turn.
 *
 * Claude Code / Codex / OpenCode treat a turn as one cell: prose, then a
 * separate activity stack. Our store still appends tool cards as later
 * system messages; grouping is how the transcript stops interleaving them
 * with the wrapping answer.
 */
export function groupTranscript(messages: readonly ChatMessage[]): TranscriptItem[] {
  const items: TranscriptItem[] = [];
  for (const message of messages) {
    const toolsOnly =
      message.role === "system" &&
      message.content.trim().length === 0 &&
      (message.toolCalls?.length ?? 0) > 0;
    const last = items.at(-1);
    if (toolsOnly && last?.kind === "turn") {
      items[items.length - 1] = {
        ...last,
        tools: [...last.tools, ...(message.toolCalls ?? [])],
      };
      continue;
    }
    if (message.role === "assistant") {
      items.push({
        kind: "turn",
        assistant: message,
        tools: [...(message.toolCalls ?? [])],
        lifecycle: message.lifecycle ?? [],
      });
      continue;
    }
    items.push({ kind: "message", message });
  }
  return items;
}

export function turnKey(item: Extract<TranscriptItem, { kind: "turn" }>): number {
  return item.assistant.turn ?? item.assistant.timestamp;
}

/**
 * A `done` summary that restates the assistant bubble is chrome, not a second
 * reply. Hide that card's essay; a one-line "Done" is enough.
 */
export function isRedundantDone(summary: string, assistantContent: string): boolean {
  const claim = collapseWs(summary);
  const prose = collapseWs(assistantContent);
  if (claim.length < 8 || prose.length < 8) return false;
  if (prose.includes(claim) || claim.includes(prose)) return true;
  const n = Math.min(24, claim.length, prose.length);
  return claim.slice(0, n) === prose.slice(0, n);
}

export function visibleTools(
  tools: readonly ToolCallDisplay[],
  assistantContent: string,
): readonly ToolCallDisplay[] {
  return tools.filter((tool) => {
    if (toolFamily(tool.name) !== "done") return true;
    const summary =
      typeof tool.args.summary === "string" ? tool.args.summary : (tool.result?.output ?? "");
    return !isRedundantDone(summary, assistantContent);
  });
}

export function activityHeadline(tools: readonly ToolCallDisplay[], ellipsis = "..."): string {
  if (tools.length === 0) return "Activity";
  if (tools.length === 1) {
    const model = describeToolCard(tools[0]!);
    if (model.headline.length === 0) return model.title;
    const clipped =
      model.headline.length > 42
        ? `${model.headline.slice(0, Math.max(0, 42 - ellipsis.length))}${ellipsis}`
        : model.headline;
    return `${model.title} ${clipped}`;
  }
  return `${tools.length} tools`;
}

function collapseWs(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}
