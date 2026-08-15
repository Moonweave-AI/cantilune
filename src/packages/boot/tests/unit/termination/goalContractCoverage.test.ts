/**
 * Branch coverage for the goal-contract compiler (ADR-0013).
 *
 * compileGoalContract has several fallback paths the happy-path suite does not
 * exercise: an LLM that returns no tool call, a tool call with the wrong name,
 * tool-call arguments that are not a plain object, text that contains no JSON
 * object, text JSON that parses to a non-object, a criteria array that is
 * present but every entry normalizes to undefined (empty result), and an LLM
 * that throws. Each path must fall back to the default system contract rather
 * than throw or inject an unverifiable condition.
 */
import { describe, it, expect } from "vitest";
import { compileGoalContract, defaultSystemContract } from "../../../src/termination/goalContract.js";
import { createDefaultVerifierRegistry, VerifierRegistry } from "../../../src/termination/index.js";
import type { LlmAdapter, LlmChatResponse, LlmToolCallResult } from "../../../src/types.js";

const FROZEN_AT = "2026-01-01T00:00:00.000Z";

function makeLlm(response: Partial<LlmChatResponse>): LlmAdapter {
  return {
    async chat() {
      return {
        text: response.text,
        toolCalls: response.toolCalls ?? [],
        finishReason: response.finishReason ?? "stop",
      };
    },
  };
}

/** LLM that throws on chat — exercises the compileGoalContract catch fallback. */
function throwingLlm(error: unknown): LlmAdapter {
  return {
    async chat() {
      throw error;
    },
  };
}

function toolCall(name: string, args: unknown): LlmToolCallResult {
  return { id: "call-1", name, arguments: args as LlmToolCallResult["arguments"] };
}

describe("compileGoalContract — fallback branches", () => {
  it("falls back to default contract when the LLM returns no tool calls and no text", async () => {
    const llm = makeLlm({ text: undefined, toolCalls: [] });
    const contract = await compileGoalContract("do a thing", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
    expect(contract.criteria).toHaveLength(1);
    expect(contract.criteria[0]!.verifierId).toBe("no_infinite_loop");
  });

  it("falls back when the tool call has the wrong name (not propose_contract)", async () => {
    const llm = makeLlm({
      toolCalls: [toolCall("some_other_tool", { criteria: [] })],
    });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
  });

  it("falls back when tool-call arguments are not a plain object (e.g. a string)", async () => {
    // arguments as a raw JSON string, not a parsed object — isPlainObject is false.
    const llm = makeLlm({
      toolCalls: [toolCall("propose_contract", "{\"criteria\":[]}")],
    });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
  });

  it("falls back when text has no JSON object match", async () => {
    const llm = makeLlm({ text: "I cannot help with that.", toolCalls: [] });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
  });

  it("falls back when text JSON parses to a non-object (e.g. a bare array)", async () => {
    const llm = makeLlm({ text: "[1, 2, 3]", toolCalls: [] });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
  });

  it("falls back when text JSON is malformed (unparseable)", async () => {
    const llm = makeLlm({ text: "{ not valid json {{{", toolCalls: [] });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
  });

  it("falls back when every proposed criterion normalizes to undefined (unknown verifier ids)", async () => {
    // Criteria present but every verifierId is unknown to the registry → all normalize
    // to undefined → criteria.length === 0 → fall back to default.
    const tinyRegistry = new VerifierRegistry([]); // no verifiers registered
    const llm = makeLlm({
      toolCalls: [
        toolCall("propose_contract", {
          criteria: [
            { id: "c1", description: "desc", kind: "hard", weight: 1, threshold: 1, verifierId: "no_such_verifier" },
          ],
        }),
      ],
    });
    const contract = await compileGoalContract("x", llm, tinyRegistry, FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
  });

  it("falls back when the LLM throws during chat", async () => {
    const llm = throwingLlm(new Error("network down"));
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
  });

  it("falls back to default when no LLM adapter is provided (undefined)", async () => {
    const contract = await compileGoalContract("x", undefined, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("system");
    // The default contract must equal defaultSystemContract for the same instruction.
    const direct = defaultSystemContract("x", FROZEN_AT);
    expect(contract.contractId).toBe(direct.contractId);
  });

  it("compiles an LLM-drafted contract when a valid proposal is returned", async () => {
    const llm = makeLlm({
      toolCalls: [
        toolCall("propose_contract", {
          criteria: [
            { id: "deliver", description: "produce an artifact", kind: "hard", weight: 1, threshold: 1, verifierId: "task_artifact_exists" },
            { id: "progress", description: "make coordination progress", kind: "soft", weight: 0.5, threshold: 0.5, verifierId: "coordination_progress" },
          ],
        }),
      ],
    });
    const contract = await compileGoalContract("build a report", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("llm");
    expect(contract.criteria).toHaveLength(2);
    expect(contract.criteria[0]!.id).toBe("deliver");
    // Hard criterion defaults weight to 1; soft keeps declared 0.5.
    expect(contract.criteria.find((c) => c.kind === "hard")!.weight).toBe(1);
    expect(contract.criteria.find((c) => c.kind === "soft")!.weight).toBe(0.5);
  });

  it("coerces stringified numeric weight/threshold and defaults threshold to 1 when missing", async () => {
    const llm = makeLlm({
      toolCalls: [
        toolCall("propose_contract", {
          criteria: [
            // weight as a string "0.4", threshold omitted → clamp + default.
            { id: "softy", description: "qualitative", kind: "soft", weight: "0.4", verifierId: "structured_rubric" },
          ],
        }),
      ],
    });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("llm");
    expect(contract.criteria[0]!.weight).toBe(0.4);
    expect(contract.criteria[0]!.threshold).toBe(1);
  });

  it("extractTextJson path compiles a contract from JSON embedded in prose text", async () => {
    // Model ignores the tool and emits JSON inside text — extractTextJson must recover it.
    const llm = makeLlm({
      text: 'Sure! Here is the contract: {"criteria":[{"id":"p","description":"progress","kind":"hard","weight":1,"threshold":1,"verifierId":"coordination_progress"}]}',
      toolCalls: [],
    });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    expect(contract.compiledBy).toBe("llm");
    expect(contract.criteria[0]!.id).toBe("p");
  });

  it("rejects a criterion whose kind is neither hard nor soft", async () => {
    const llm = makeLlm({
      toolCalls: [
        toolCall("propose_contract", {
          criteria: [
            { id: "bad", description: "desc", kind: "mandatory", weight: 1, threshold: 1, verifierId: "no_infinite_loop" },
          ],
        }),
      ],
    });
    const contract = await compileGoalContract("x", llm, createDefaultVerifierRegistry(), FROZEN_AT);
    // The one criterion normalizes to undefined (bad kind) → empty → fall back.
    expect(contract.compiledBy).toBe("system");
  });
});
