import { type DescriptorRef, type ChannelId } from "../foundation/messageId.js";

export type NativeActionKind = "internal" | "output" | "input" | "boundOutput";

export interface NativeCommunicationAction {
  readonly kind: NativeActionKind;
  readonly subjectRef?: string;
  readonly payloadRef?: string;
  readonly binderRef?: string;
  readonly freshEndpointRef?: DescriptorRef;
  readonly freshChannelId?: ChannelId;
  readonly derivativeTargetRef?: string;
}

export function internalAction(): NativeCommunicationAction {
  return { kind: "internal" };
}

export function outputAction(subjectRef: string, payloadRef: string): NativeCommunicationAction {
  return { kind: "output", subjectRef, payloadRef };
}

export function inputAction(subjectRef: string, binderRef: string): NativeCommunicationAction {
  return { kind: "input", subjectRef, binderRef };
}

export function boundOutputAction(input: {
  readonly freshEndpointRef: DescriptorRef;
  readonly freshChannelId: ChannelId;
  readonly derivativeTargetRef: string;
}): NativeCommunicationAction {
  return {
    kind: "boundOutput",
    freshEndpointRef: input.freshEndpointRef,
    freshChannelId: input.freshChannelId,
    derivativeTargetRef: input.derivativeTargetRef,
  };
}
