import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { ChatMessage, SessionState } from "../store.js";

const SLOT_NAME = /^[A-Za-z0-9._-]+$/;
const KEEP_RECENT_MESSAGES = 8;

export interface SessionSlotMeta {
  readonly name: string;
  readonly savedAt: string;
  readonly turnCount: number;
  readonly messageCount: number;
}

export interface CompactResult {
  readonly session: SessionState;
  readonly dropped: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isChatMessage(value: unknown): value is ChatMessage {
  if (!isRecord(value)) return false;
  const role = value["role"];
  return (
    (role === "user" || role === "assistant" || role === "system" || role === "error") &&
    typeof value["content"] === "string" &&
    typeof value["timestamp"] === "number"
  );
}

function isSessionState(value: unknown): value is SessionState {
  if (!isRecord(value) || !Array.isArray(value["messages"])) return false;
  const tokenUsage = value["tokenUsage"];
  return (
    value["messages"].every(isChatMessage) &&
    typeof value["turnCount"] === "number" &&
    typeof value["startTime"] === "number" &&
    isRecord(tokenUsage) &&
    typeof tokenUsage["prompt"] === "number" &&
    typeof tokenUsage["completion"] === "number" &&
    typeof tokenUsage["total"] === "number" &&
    typeof value["costUsd"] === "number"
  );
}

export function assertSlotName(name: string): string {
  if (!SLOT_NAME.test(name)) {
    throw new Error(
      `Invalid session slot name "${name}": use letters, digits, ".", "_" or "-" only`,
    );
  }
  return name;
}

export function sessionSlotsDir(storagePath: string): string {
  return join(resolve(storagePath), "session-slots");
}

function slotPath(storagePath: string, name: string): string {
  return join(sessionSlotsDir(storagePath), `${assertSlotName(name)}.json`);
}

export function listSessionSlots(storagePath: string): SessionSlotMeta[] {
  const dir = sessionSlotsDir(storagePath);
  if (!existsSync(dir)) return [];
  const slots: SessionSlotMeta[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    const name = file.slice(0, -".json".length);
    if (!SLOT_NAME.test(name)) continue;
    try {
      const raw = JSON.parse(readFileSync(join(dir, file), "utf8")) as unknown;
      if (!isRecord(raw) || !isSessionState(raw["session"]) || typeof raw["savedAt"] !== "string") {
        continue;
      }
      slots.push({
        name,
        savedAt: raw["savedAt"],
        turnCount: raw["session"].turnCount,
        messageCount: raw["session"].messages.length,
      });
    } catch {
      continue;
    }
  }
  return slots.sort((a, b) => a.name.localeCompare(b.name));
}

export function saveSessionSlot(
  storagePath: string,
  name: string,
  session: SessionState,
): SessionSlotMeta {
  const dir = sessionSlotsDir(storagePath);
  mkdirSync(dir, { recursive: true });
  const savedAt = new Date().toISOString();
  writeFileSync(slotPath(storagePath, name), JSON.stringify({ savedAt, session }, null, 2), "utf8");
  return {
    name,
    savedAt,
    turnCount: session.turnCount,
    messageCount: session.messages.length,
  };
}

export function loadSessionSlot(storagePath: string, name: string): SessionState | undefined {
  const path = slotPath(storagePath, name);
  if (!existsSync(path)) return undefined;
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!isRecord(raw) || !isSessionState(raw["session"])) return undefined;
  return raw["session"];
}

export function compactSession(
  session: SessionState,
  keepMessages = KEEP_RECENT_MESSAGES,
  summary?: string,
): CompactResult {
  if (session.messages.length <= keepMessages) {
    return { session, dropped: 0 };
  }
  const dropped = session.messages.length - keepMessages;
  const kept = session.messages.slice(-keepMessages);
  const marker: ChatMessage = {
    role: "system",
    content:
      summary !== undefined && summary.trim().length > 0
        ? `[Conversation compacted: ${String(dropped)} earlier messages summarized]\n${summary}`
        : `[Conversation compacted: ${String(dropped)} earlier messages omitted — no contract/judge LLM configured, so this is truncation not a summary]`,
    timestamp: Date.now(),
  };
  return {
    session: { ...session, messages: [marker, ...kept] },
    dropped,
  };
}
