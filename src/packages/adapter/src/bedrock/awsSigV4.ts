import { createHash, createHmac } from "node:crypto";

interface AwsCredentials {
  readonly accessKeyId: string;
  readonly secretAccessKey: string;
  readonly sessionToken?: string;
}

interface SignedRequest {
  readonly url: string;
  readonly headers: Record<string, string>;
}

function sha256Hex(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

function hmacSha256(key: Buffer | string, data: string): Buffer {
  return createHmac("sha256", key).update(data, "utf8").digest();
}

function getSignatureKey(
  secretAccessKey: string,
  dateStamp: string,
  region: string,
  service: string,
): Buffer {
  const kDate = hmacSha256(`AWS4${secretAccessKey}`, dateStamp);
  const kRegion = hmacSha256(kDate, region);
  const kService = hmacSha256(kRegion, service);
  return hmacSha256(kService, "aws4_request");
}

function encodeRfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (char) => `%${(char.codePointAt(0) ?? 0).toString(16).toUpperCase()}`,
  );
}

export function signAwsRequest(input: {
  readonly method: string;
  readonly url: string;
  readonly region: string;
  readonly service: string;
  readonly body: string;
  readonly credentials: AwsCredentials;
  readonly extraHeaders?: Record<string, string>;
}): SignedRequest {
  const parsedUrl = new URL(input.url);
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(input.body);

  const headers: Record<string, string> = {
    host: parsedUrl.host,
    "content-type": "application/json",
    "x-amz-date": amzDate,
    "x-amz-content-sha256": payloadHash,
    ...input.extraHeaders,
  };

  if (input.credentials.sessionToken !== undefined) {
    headers["x-amz-security-token"] = input.credentials.sessionToken;
  }

  const canonicalHeaderEntries = Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), value.trim()] as const)
    .sort(([a], [b]) => a.localeCompare(b));

  const signedHeaders = canonicalHeaderEntries.map(([key]) => key).join(";");
  const canonicalHeaders = canonicalHeaderEntries
    .map(([key, value]) => `${key}:${value}\n`)
    .join("");

  const canonicalRequest = [
    input.method,
    parsedUrl.pathname,
    parsedUrl.searchParams.toString(),
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n");

  const credentialScope = `${dateStamp}/${input.region}/${input.service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");

  const signature = hmacSha256(
    getSignatureKey(input.credentials.secretAccessKey, dateStamp, input.region, input.service),
    stringToSign,
  ).toString("hex");

  headers.Authorization = [
    "AWS4-HMAC-SHA256 Credential=",
    `${input.credentials.accessKeyId}/${credentialScope}, `,
    `SignedHeaders=${signedHeaders}, `,
    `Signature=${signature}`,
  ].join("");

  return { url: input.url, headers };
}

function resolveConfigApiKey(apiKey?: (() => string) | string): string | undefined {
  if (typeof apiKey === "function") {
    return apiKey();
  }
  if (typeof apiKey === "string") {
    return apiKey;
  }
  return undefined;
}

export function resolveAwsCredentials(configApiKey?: (() => string) | string): AwsCredentials {
  const fromConfig = resolveConfigApiKey(configApiKey);
  const accessKeyId = fromConfig ?? process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;

  if (!accessKeyId || !secretAccessKey) {
    throw new Error(
      "AWS credentials are required for Bedrock (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)",
    );
  }

  return {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken !== undefined ? { sessionToken } : {}),
  };
}

export function buildBedrockConverseUrl(
  region: string,
  modelId: string,
  baseUrlOverride?: string,
): string {
  if (baseUrlOverride !== undefined && baseUrlOverride.length > 0) {
    let end = baseUrlOverride.length;
    while (end > 0 && baseUrlOverride[end - 1] === "/") {
      end--;
    }
    const normalized = baseUrlOverride.slice(0, end);
    return `${normalized}/model/${encodeRfc3986(modelId)}/converse`;
  }
  return `https://bedrock-runtime.${region}.amazonaws.com/model/${encodeRfc3986(modelId)}/converse`;
}

export function resolveAwsRegion(baseUrl?: string): string {
  if (baseUrl !== undefined) {
    const match = /bedrock-runtime\.([a-z0-9-]+)\.amazonaws\.com/i.exec(baseUrl);
    if (match?.[1] !== undefined) {
      return match[1];
    }
  }
  return process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "us-east-1";
}
