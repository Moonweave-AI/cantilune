import { describe, expect, it } from "vitest";
import {
  boundOutputAction,
  inputAction,
  internalAction,
  outputAction,
} from "../../src/protocol/nativeCommunicationAction.js";
import { channelId, descriptorRef } from "../../src/foundation/messageId.js";

describe("nativeCommunicationAction", () => {
  it("constructs action variants", () => {
    expect(internalAction()).toEqual({ kind: "internal" });
    expect(outputAction("subj", "payload")).toEqual({
      kind: "output",
      subjectRef: "subj",
      payloadRef: "payload",
    });
    expect(inputAction("subj", "binder")).toEqual({
      kind: "input",
      subjectRef: "subj",
      binderRef: "binder",
    });
    expect(
      boundOutputAction({
        freshEndpointRef: descriptorRef("ep-fresh"),
        freshChannelId: channelId("ch-fresh"),
        derivativeTargetRef: "target",
      }),
    ).toEqual({
      kind: "boundOutput",
      freshEndpointRef: "ep-fresh",
      freshChannelId: "ch-fresh",
      derivativeTargetRef: "target",
    });
  });
});
