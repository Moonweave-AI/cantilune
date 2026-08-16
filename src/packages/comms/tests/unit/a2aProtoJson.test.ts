import { describe, expect, it } from "vitest";
import {
  isoToTimestamp,
  jsonToProtoMessage,
  jsonToProtoValue,
  objectToStruct,
  protoMessageToJson,
  protoValueToJson,
  structToObject,
  timestampToIso,
} from "../../src/transports/a2a/v1/a2aProtoJson.js";

describe("a2aProtoJson", () => {
  it("round-trips timestamps and structs", () => {
    const iso = "2026-08-16T00:00:00.000Z";
    const timestamp = isoToTimestamp(iso);
    expect(timestampToIso(timestamp)).toBe(iso);
    expect(protoMessageToJson(timestamp)).toBe(iso);

    const struct = objectToStruct({ sessionId: "s1", count: 2, ok: true, nested: { a: 1 } });
    expect(structToObject(struct)).toEqual({
      sessionId: "s1",
      count: 2,
      ok: true,
      nested: { a: 1 },
    });
    expect(protoMessageToJson(struct)).toEqual({
      sessionId: "s1",
      count: 2,
      ok: true,
      nested: { a: 1 },
    });
  });

  it("converts proto Values and drops empty part oneofs", () => {
    expect(protoValueToJson({ stringValue: "x" })).toBe("x");
    expect(protoValueToJson({ numberValue: 3 })).toBe(3);
    expect(protoValueToJson({ boolValue: false })).toBe(false);
    expect(protoValueToJson({ nullValue: 0 })).toBeNull();
    expect(protoValueToJson({ listValue: { values: [{ stringValue: "a" }] } })).toEqual(["a"]);
    expect(jsonToProtoValue(null)).toEqual({ nullValue: 0 });
    expect(jsonToProtoValue(["a"])).toEqual({
      listValue: { values: [{ stringValue: "a" }] },
    });
    expect(jsonToProtoValue(true)).toEqual({ boolValue: true });
    expect(jsonToProtoValue(1)).toEqual({ numberValue: 1 });
    expect(protoValueToJson("plain")).toBe("plain");
    expect(protoMessageToJson(new Uint8Array([104, 105]))).toBe("aGk=");
    expect(protoMessageToJson(["x", { seconds: "1", nanos: 0 }])).toEqual([
      "x",
      timestampToIso({ seconds: "1", nanos: 0 }),
    ]);
    expect(structToObject({})).toEqual({});
    expect(jsonToProtoMessage("2026-08-16T00:00:00.000Z", "timestamp")).toEqual(
      isoToTimestamp("2026-08-16T00:00:00.000Z"),
    );
    expect(jsonToProtoMessage({ trace: "t" }, "metadata")).toEqual(objectToStruct({ trace: "t" }));
    expect(jsonToProtoMessage({ a: 1 }, "data")).toEqual(jsonToProtoValue({ a: 1 }));
    expect(jsonToProtoMessage(undefined)).toBeUndefined();
    expect(jsonToProtoValue(Symbol("x"))).toEqual({ stringValue: "Symbol(x)" });
    expect(protoValueToJson({ structValue: objectToStruct({ k: "v" }) })).toEqual({ k: "v" });

    const json = protoMessageToJson({
      text: "hello",
      raw: "",
      url: "",
      content: "text",
      mediaType: "text/plain",
    });
    expect(json).toEqual({ text: "hello", mediaType: "text/plain" });
  });

  it("walks a SendMessage / Task pair between proto objects and JSON", () => {
    const protoRequest = {
      message: {
        messageId: "msg-1",
        role: "ROLE_USER",
        parts: [{ text: "plan", mediaType: "text/plain", content: "text" }],
        metadata: objectToStruct({ trace: "t1" }),
      },
    };
    const json = protoMessageToJson(protoRequest) as {
      message: { parts: unknown[]; metadata: Record<string, unknown> };
    };
    expect(json.message.parts).toEqual([{ text: "plan", mediaType: "text/plain" }]);
    expect(json.message.metadata).toEqual({ trace: "t1" });

    const protoOut = jsonToProtoMessage({
      task: {
        id: "task-1",
        status: { state: "TASK_STATE_COMPLETED", timestamp: "2026-08-16T00:00:00.000Z" },
        metadata: { sessionId: "s1" },
      },
    }) as {
      task: {
        status: { timestamp: { seconds: string; nanos: number } };
        metadata: { fields: Record<string, unknown> };
      };
    };
    expect(protoOut.task.status.timestamp.seconds).toBeDefined();
    expect(protoOut.task.metadata.fields.sessionId).toEqual({ stringValue: "s1" });
  });
});
