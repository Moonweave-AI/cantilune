import { asBrand, type Brand } from "@cantilune/core";

function asNumberBrand<T extends number, B extends string>(value: T): Brand<T, B> {
  return value as Brand<T, B>;
}

export type MessageId = Brand<string, "MessageId">;
export const messageId = (value: string): MessageId => asBrand(value);

export type ChannelId = Brand<string, "ChannelId">;
export const channelId = (value: string): ChannelId => asBrand(value);

export type ConnectionId = Brand<string, "ConnectionId">;
export const connectionId = (value: string): ConnectionId => asBrand(value);

export type DescriptorRef = Brand<string, "DescriptorRef">;
export const descriptorRef = (value: string): DescriptorRef => asBrand(value);

export type WireVersion = Brand<number, "WireVersion">;
export const wireVersion = (value: number): WireVersion => asNumberBrand(value);

export type RegistryVersion = Brand<number, "RegistryVersion">;
export const registryVersion = (value: number): RegistryVersion => asNumberBrand(value);

export type CommsEventId = Brand<string, "CommsEventId">;
export const commsEventId = (value: string): CommsEventId => asBrand(value);

export type CommsStoreSequence = Brand<number, "CommsStoreSequence">;
export const commsStoreSequence = (value: number): CommsStoreSequence => asNumberBrand(value);

export type ChannelGeneration = Brand<number, "ChannelGeneration">;
export const channelGeneration = (value: number): ChannelGeneration => asNumberBrand(value);

export type DeliveryAttemptId = Brand<string, "DeliveryAttemptId">;
export const deliveryAttemptId = (value: string): DeliveryAttemptId => asBrand(value);

export type ReconnectRecordId = Brand<string, "ReconnectRecordId">;
export const reconnectRecordId = (value: string): ReconnectRecordId => asBrand(value);

export type CloseRecordId = Brand<string, "CloseRecordId">;
export const closeRecordId = (value: string): CloseRecordId => asBrand(value);
