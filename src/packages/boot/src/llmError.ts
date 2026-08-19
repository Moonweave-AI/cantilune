export const CONTEXT_WINDOW_EXCEEDED = "CONTEXT_WINDOW_EXCEEDED";

export class LlmProviderError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "LlmProviderError";
  }
}

export function isContextWindowExceededError(value: unknown): boolean {
  if (value instanceof LlmProviderError && value.code === CONTEXT_WINDOW_EXCEEDED) return true;
  if (
    typeof value === "object" &&
    value !== null &&
    "code" in value &&
    value.code === CONTEXT_WINDOW_EXCEEDED
  )
    return true;
  const message = value instanceof Error ? value.message : String(value);
  return (
    /context[\s_-](?:length|window)[\s_-](?:exceed(?:ed|s)?|overflow|limit)/iu.test(message) ||
    /maximum\s+context\s+(?:length|window)/iu.test(message) ||
    /(?:prompt|input|request|messages?).{0,40}(?:too\s+(?:long|large)|exceed(?:s|ed)?).{0,40}context/iu.test(
      message,
    )
  );
}

export function providerHttpError(
  provider: string,
  status: number,
  detail: string,
): LlmProviderError {
  const message = `${provider} API error (${String(status)}): ${detail}`;
  return new LlmProviderError(
    message,
    isContextWindowExceededError(message) ? CONTEXT_WINDOW_EXCEEDED : `HTTP_${String(status)}`,
    status,
  );
}
