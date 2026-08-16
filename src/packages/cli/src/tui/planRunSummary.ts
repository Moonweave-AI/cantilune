import type { ChatMessage } from "../store.js";

export type RunSummaryPlan =
  | { readonly action: "none" }
  | { readonly action: "fill"; readonly content: string }
  | { readonly action: "append"; readonly role: "assistant" | "error"; readonly content: string };

/**
 * Decide how a finished run's summary should enter the transcript.
 *
 * The summary is a completion claim (`done.summary`), not a second reply.
 * Appending it whenever it differs from streamed prose hides the real answer
 * behind a duplicate bubble and starves the chat window.
 */
export function planRunSummary(
  messages: readonly ChatMessage[],
  summary: string,
  ok: boolean,
): RunSummaryPlan {
  const content = summary.trim();
  if (content.length === 0) return { action: "none" };

  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message?.role !== "assistant") continue;
    if (message.content.trim().length === 0) return { action: "fill", content };
    return { action: "none" };
  }

  return { action: "append", role: ok ? "assistant" : "error", content };
}
