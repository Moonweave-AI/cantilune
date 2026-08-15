import { createHash } from "node:crypto";
import type { LlmAdapter, LlmChatResponse, LlmMessage, LlmToolDef } from "../types.js";
import type { AcceptanceCriterion, GoalContract } from "./types.js";
import type { VerifierRegistry } from "./verifierRegistry.js";

/**
 * GoalContractCompiler — compiles a natural-language instruction into a frozen
 * structured goal contract once per run. The LLM may draft the criteria, but the
 * system freezes them; the contract is immutable for the rest of the run.
 *
 * Hard rule: no instruction-type preset. The compiler never branches on
 * instruction text to pick a "chat" vs "task" contract. The default fallback
 * contract is the same single no_infinite_loop condition for every instruction.
 */

const SYSTEM_PROMPT = [
  "You are a goal-contract compiler for an autonomous agent OS.",
  "Given a user instruction, decompose it into a small set of structured acceptance criteria.",
  "Each criterion has: id, description, kind (hard|soft), weight, threshold, verifierId.",
  "Use only verifier ids from the provided list. Prefer hard criteria for concrete deliverables;",
  "use soft criteria for qualitative goals. Aim for 1-5 criteria; avoid over-decomposition.",
  "Return ONLY a JSON object { criteria: [...] }. No prose, no markdown fences.",
].join(" ");

/** Builds the LLM tool schema forcing a structured contract proposal. */
function contractExtractionTool(verifierIds: readonly string[]): LlmToolDef {
  return {
    name: "propose_contract",
    description: "Propose the structured acceptance criteria for the instruction.",
    parameters: {
      type: "object",
      additionalProperties: false,
      properties: {
        criteria: {
          type: "array",
          minItems: 1,
          items: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string", description: "Stable kebab-case id" },
              description: { type: "string" },
              kind: { type: "string", enum: ["hard", "soft"] },
              weight: { type: "number", minimum: 0, maximum: 1 },
              threshold: { type: "number", minimum: 0, maximum: 1 },
              verifierId: { type: "string", description: `One of: ${verifierIds.join(", ")}` },
            },
            required: ["id", "description", "kind", "weight", "threshold", "verifierId"],
          },
        },
      },
      required: ["criteria"],
    },
  };
}

interface RawContract {
  readonly criteria?: unknown;
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function clamp(value: unknown, min: number, max: number): number | undefined {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.min(max, Math.max(min, n));
}

/**
 * Validate and normalize one raw criterion. Returns undefined on any structural
 * error so a malformed LLM proposal cannot inject an unverifiable condition.
 */
function normalizeCriterion(
  raw: unknown,
  registry: VerifierRegistry,
): AcceptanceCriterion | undefined {
  if (!isPlainObject(raw)) return undefined;
  const id = typeof raw["id"] === "string" ? raw["id"] : undefined;
  const description = typeof raw["description"] === "string" ? raw["description"] : undefined;
  const kind = raw["kind"] === "hard" || raw["kind"] === "soft" ? raw["kind"] : undefined;
  const verifierId = typeof raw["verifierId"] === "string" ? raw["verifierId"] : undefined;
  if (!id || !description || !kind || !verifierId) return undefined;
  if (!registry.has(verifierId)) return undefined;
  const weight = clamp(raw["weight"], 0, 1) ?? (kind === "hard" ? 1 : 0.5);
  const threshold = clamp(raw["threshold"], 0, 1) ?? 1;
  return { id, description, kind, weight, threshold, verifierId };
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (isPlainObject(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortKeys(value[key]);
        return acc;
      }, {});
  }
  return value;
}

function digestContract(instruction: string, criteria: readonly AcceptanceCriterion[]): string {
  const payload = canonicalJson({ instruction, criteria });
  return `sha256:${createHash("sha256").update(payload).digest("hex")}`;
}

/**
 * The default fallback contract, used when the LLM cannot draft one. Identical
 * for every instruction — no type preset — and carries the single condition that
 * directly prevents the unproductive-loop failure mode.
 */
export function defaultSystemContract(
  instruction: string,
  frozenAt: string,
): GoalContract {
  const criteria: AcceptanceCriterion[] = [
    {
      id: "no_infinite_loop",
      description: "The agent must not enter an unproductive loop of repeated plain-text turns.",
      kind: "hard",
      weight: 1,
      threshold: 1,
      verifierId: "no_infinite_loop",
    },
  ];
  return {
    contractId: digestContract(instruction, criteria),
    instruction,
    criteria,
    frozenAt,
    compiledBy: "system",
  };
}

function extractToolCallArgs(response: LlmChatResponse): RawContract | undefined {
  const call = response.toolCalls[0];
  if (call === undefined || call.name !== "propose_contract") return undefined;
  // call.arguments is already a parsed object (LlmToolCallArguments), not a string.
  return isPlainObject(call.arguments) ? (call.arguments as RawContract) : undefined;
}

/** Try to parse the response text as a JSON contract (for models that ignore the tool). */
function extractTextJson(response: LlmChatResponse): RawContract | undefined {
  const text = response.text ?? "";
  const match = /\{[\s\S]*\}/u.exec(text);
  if (match === null) return undefined;
  try {
    const parsed = JSON.parse(match[0]) as unknown;
    return isPlainObject(parsed) ? (parsed as RawContract) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Compile a goal contract for one run. Attempts an LLM draft first; on any
 * failure (no adapter, no network, malformed proposal, unknown verifier), falls
 * back to the default system contract. Never throws.
 */
export async function compileGoalContract(
  instruction: string,
  llm: LlmAdapter | undefined,
  registry: VerifierRegistry,
  frozenAt: string,
): Promise<GoalContract> {
  const verifierIds = [
    "no_infinite_loop",
    "duplicate_reply",
    "coordination_progress",
    "task_artifact_exists",
    "structured_rubric",
    "semantic_coverage",
  ].filter((id) => registry.has(id));

  if (llm !== undefined) {
    try {
      const messages: LlmMessage[] = [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Instruction: ${instruction}` },
      ];
      const tools: LlmToolDef[] = [contractExtractionTool(verifierIds)];
      const response = await llm.chat({ messages, tools });
      const raw = extractToolCallArgs(response) ?? extractTextJson(response);
      if (raw?.criteria !== undefined && Array.isArray(raw.criteria)) {
        const criteria = raw.criteria
          .map((c) => normalizeCriterion(c, registry))
          .filter((c): c is AcceptanceCriterion => c !== undefined);
        if (criteria.length > 0) {
          return {
            contractId: digestContract(instruction, criteria),
            instruction,
            criteria,
            frozenAt,
            compiledBy: "llm",
          };
        }
      }
    } catch {
      // Any LLM failure falls back to the default contract below.
    }
  }
  return defaultSystemContract(instruction, frozenAt);
}
