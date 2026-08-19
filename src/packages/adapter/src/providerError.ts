const CONTEXT_WINDOW_EXCEEDED = "CONTEXT_WINDOW_EXCEEDED";

function isContextOverflow(detail: string): boolean {
  return (
    /context[\s_-](?:length|window)[\s_-](?:exceed(?:ed|s)?|overflow|limit)/iu.test(detail) ||
    /maximum\s+context\s+(?:length|window)/iu.test(detail) ||
    /(?:prompt|input|request|messages?).{0,40}(?:too\s+(?:long|large)|exceed(?:s|ed)?).{0,40}context/iu.test(
      detail,
    )
  );
}

export function providerHttpError(provider: string, status: number, detail: string): Error {
  const message = `${provider} API error (${String(status)}): ${detail}`;
  const error = new Error(message) as Error & { code: string; status: number };
  error.code = isContextOverflow(message) ? CONTEXT_WINDOW_EXCEEDED : `HTTP_${String(status)}`;
  error.status = status;
  return error;
}
