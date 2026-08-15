import { describe, it, expect } from "vitest";
import { intentRef } from "../../src/act.js";
import { contentRef } from "@cantilune/core";
import type { ContentRef } from "@cantilune/core";
import type { ToolInvocationKey } from "../../src/syscall.js";

const key: ToolInvocationKey = {
  principal: { actorId: "p", kind: "agent" },
  toolName: "t",
  argumentsDigest: "sha256:0000000000000000000000000000000000000000000000000000000000000000",
  originalToolCallId: "c",
};

describe("ref check", () => {
  it("completed ref with vs without outputRef", () => {
    const withoutOut = intentRef(key, "completed");
    const withOut = intentRef(key, "completed", contentRef("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa") as ContentRef);
    console.log("without outputRef:", String(withoutOut));
    console.log("with outputRef:   ", String(withOut));
    expect(withoutOut).not.toEqual(withOut);
  });
});
