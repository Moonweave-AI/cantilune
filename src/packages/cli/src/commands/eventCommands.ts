import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";

function openView(view: ViewType) {
  return (_args: Record<string, unknown>, store: AppStore): void => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = {};
  };
}

/**
 * The `/events` family opens the live per-event timeline of the agent loop.
 *
 * Unlike the post-hoc `observe` four-view bundle (which aggregates the world
 * state into dependency/resource/communication/structure lenses), this is the
 * real-time, per-event stream: turn_start → llm_start → llm_delta → llm_end →
 * tool_start → tool_end → turn_end, plus diagnostics for provider drift and
 * model behavior deviations. The two are complementary, not competing.
 */
export function registerEventCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  return [
    {
      name: "/events",
      description: "Live per-event stream of the agent loop (turns, LLM, tools, diagnostics)",
      category: view,
      handler: openView("events"),
    },
  ];
}
