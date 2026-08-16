import { describe, it, expect } from "vitest";
import { buildDefaultSystemPrompt } from "../../src/agentLoop.js";

describe("buildDefaultSystemPrompt", () => {
  it("gives the agent freedom to grow a cluster instead of defaulting to a chatbot", () => {
    const prompt = buildDefaultSystemPrompt("cli-test");
    expect(prompt).toContain("autonomous peer");
    expect(prompt).toContain("cli-test");
    expect(prompt).toContain("register_participant");
    expect(prompt).toContain("activate_participant");
    expect(prompt).toContain("write_content an AgentManifest");
    expect(prompt).toContain("StartConditionExpression");
    expect(prompt).not.toContain("Be efficient: minimize unnecessary operations");
    expect(prompt).not.toContain("default single-agent");
    expect(prompt).toContain("Do not tell the human to run /swarm");
  });
});
