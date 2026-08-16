import React, { useMemo } from "react";
import { Text } from "ink";
import type { AppStore } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { ViewFrame } from "./ViewFrame.js";
import type { SessionSlotMeta } from "../session/sessionSlots.js";

export interface ViewProps {
  readonly store: AppStore;
}

function readSlots(viewArgs: Record<string, unknown>): readonly SessionSlotMeta[] {
  const slots = viewArgs.slots;
  if (!Array.isArray(slots)) return [];
  return slots.filter((slot): slot is SessionSlotMeta => {
    if (typeof slot !== "object" || slot === null) return false;
    const record = slot as Record<string, unknown>;
    return (
      typeof record.name === "string" &&
      typeof record.savedAt === "string" &&
      typeof record.turnCount === "number" &&
      typeof record.messageCount === "number"
    );
  });
}

export function renderSessionViewOutput(viewArgs: Record<string, unknown>): string {
  const error = viewArgs.error;
  if (typeof error === "string" && error.length > 0) {
    return error;
  }
  const slots = readSlots(viewArgs);
  if (slots.length === 0) {
    return "No saved session slots.\n\n/session save <name>   write the current transcript to a named slot";
  }
  return renderTable(
    [
      { header: "Slot", width: 18 },
      { header: "Saved", width: 24 },
      { header: "Turns", width: 8 },
      { header: "Msgs", width: 8 },
    ],
    slots.map((slot) => [
      slot.name,
      slot.savedAt,
      String(slot.turnCount),
      String(slot.messageCount),
    ]),
  );
}

export function SessionView({ store }: ViewProps): React.ReactElement {
  const output = useMemo(() => renderSessionViewOutput(store.viewArgs), [store.viewArgs]);
  return (
    <ViewFrame title="Session slots" tone="accentAlt">
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
}

export default function SessionViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({ activeView: "session-list", viewArgs: props.viewArgs ?? {} });
  return <SessionView store={store} />;
}
