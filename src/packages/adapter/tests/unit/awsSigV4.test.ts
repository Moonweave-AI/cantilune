import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBedrockConverseUrl,
  resolveAwsCredentials,
  resolveAwsRegion,
  signAwsRequest,
} from "../../src/bedrock/awsSigV4.js";

describe("awsSigV4", () => {
  const envSnapshot = { ...process.env };

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...envSnapshot };
  });

  it("signs requests with Authorization and required AWS headers", () => {
    const signed = signAwsRequest({
      method: "POST",
      url: "https://bedrock-runtime.us-east-1.amazonaws.com/model/anthropic.claude-3/invoke",
      region: "us-east-1",
      service: "bedrock",
      body: '{"prompt":"hi"}',
      credentials: {
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      },
    });

    expect(signed.url).toContain("bedrock-runtime.us-east-1.amazonaws.com");
    expect(signed.headers.Authorization).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIAIOSFODNN7EXAMPLE\//,
    );
    expect(signed.headers.Authorization).toContain("SignedHeaders=");
    expect(signed.headers.Authorization).toContain("Signature=");
    expect(signed.headers["x-amz-date"]).toBe("20240615T120000Z");
    expect(signed.headers["x-amz-content-sha256"]).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.headers.host).toBe("bedrock-runtime.us-east-1.amazonaws.com");
  });

  it("includes session token and extra headers when provided", () => {
    const signed = signAwsRequest({
      method: "POST",
      url: "https://bedrock-runtime.eu-west-1.amazonaws.com/model/test/converse",
      region: "eu-west-1",
      service: "bedrock",
      body: "{}",
      credentials: {
        accessKeyId: "AKID",
        secretAccessKey: "SECRET",
        sessionToken: "SESSION-TOKEN",
      },
      extraHeaders: { "x-custom": "value" },
    });

    expect(signed.headers["x-amz-security-token"]).toBe("SESSION-TOKEN");
    expect(signed.headers["x-custom"]).toBe("value");
  });

  it("RFC3986-encodes model ids with special characters in converse URL", () => {
    const url = buildBedrockConverseUrl("us-west-2", "anthropic.claude-3-sonnet");
    expect(url).toBe(
      "https://bedrock-runtime.us-west-2.amazonaws.com/model/anthropic.claude-3-sonnet/converse",
    );

    const overrideUrl = buildBedrockConverseUrl(
      "us-west-2",
      "model/with/slash",
      "https://custom.endpoint.com///",
    );
    expect(overrideUrl).toBe("https://custom.endpoint.com/model/model%2Fwith%2Fslash/converse");
  });

  it("resolves AWS region from bedrock base URL", () => {
    expect(resolveAwsRegion("https://bedrock-runtime.ap-southeast-1.amazonaws.com")).toBe(
      "ap-southeast-1",
    );
  });

  it("falls back to env region or us-east-1 default", () => {
    delete process.env.AWS_REGION;
    delete process.env.AWS_DEFAULT_REGION;
    expect(resolveAwsRegion()).toBe("us-east-1");

    process.env.AWS_REGION = "eu-central-1";
    expect(resolveAwsRegion()).toBe("eu-central-1");

    delete process.env.AWS_REGION;
    process.env.AWS_DEFAULT_REGION = "sa-east-1";
    expect(resolveAwsRegion()).toBe("sa-east-1");
  });

  it("resolves credentials from config function, string, or environment", () => {
    process.env.AWS_SECRET_ACCESS_KEY = "secret-from-env";

    expect(resolveAwsCredentials(() => "config-key")).toEqual({
      accessKeyId: "config-key",
      secretAccessKey: "secret-from-env",
    });

    expect(resolveAwsCredentials("string-key")).toEqual({
      accessKeyId: "string-key",
      secretAccessKey: "secret-from-env",
    });

    process.env.AWS_ACCESS_KEY_ID = "env-key";
    expect(resolveAwsCredentials()).toEqual({
      accessKeyId: "env-key",
      secretAccessKey: "secret-from-env",
    });

    process.env.AWS_SESSION_TOKEN = "token-123";
    expect(resolveAwsCredentials()).toEqual({
      accessKeyId: "env-key",
      secretAccessKey: "secret-from-env",
      sessionToken: "token-123",
    });
  });

  it("throws when AWS credentials are missing", () => {
    delete process.env.AWS_ACCESS_KEY_ID;
    delete process.env.AWS_SECRET_ACCESS_KEY;

    expect(() => resolveAwsCredentials()).toThrow("AWS credentials are required for Bedrock");
  });
});
