import type { WebConfig } from "../types.js";
import { DEFAULT_MAX_RESPONSE_SIZE, DEFAULT_WEB_TIMEOUT_MS } from "../types.js";

export interface WebFetchArgs {
  readonly url: string;
  readonly maxLength?: number;
}

export async function webFetch(args: WebFetchArgs, config: WebConfig): Promise<string> {
  const timeoutMs = config.timeoutMs ?? DEFAULT_WEB_TIMEOUT_MS;
  const maxResponseSize = config.maxResponseSize ?? DEFAULT_MAX_RESPONSE_SIZE;
  const maxLength = args.maxLength ?? maxResponseSize;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(args.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "CantiluneTools/0.0.1",
        Accept: "text/html,application/xhtml+xml,text/plain,*/*",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} fetching ${args.url}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const mediaType = contentType.split(";")[0]?.trim().toLowerCase() ?? "";

    if (
      mediaType.length > 0 &&
      mediaType !== "text/html" &&
      mediaType !== "text/plain" &&
      mediaType !== "application/xhtml+xml"
    ) {
      throw new Error(`Unsupported content type: ${mediaType}`);
    }

    const raw = await readLimitedText(response, maxResponseSize);
    const text =
      mediaType.includes("html") || mediaType === "application/xhtml+xml" ? htmlToText(raw) : raw;

    if (text.length > maxLength) {
      return `${text.slice(0, maxLength)}\n...(truncated)`;
    }

    return text;
  } finally {
    clearTimeout(timer);
  }
}

async function readLimitedText(response: Response, maxSize: number): Promise<string> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    return await response.text();
  }

  const decoder = new TextDecoder();
  let result = "";

  while (result.length < maxSize) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    result += decoder.decode(value, { stream: true });
  }

  reader.releaseLock();
  return result;
}

function stripInlineTags(input: string): string {
  let result = "";
  let i = 0;
  while (i < input.length) {
    if (input[i] === "<") {
      const closePos = input.indexOf(">", i + 2);
      const nlPos = input.indexOf("\n", i + 1);
      if (closePos !== -1 && (nlPos === -1 || closePos < nlPos)) {
        i = closePos + 1;
        continue;
      }
    }
    result += input[i];
    i++;
  }
  return result;
}

export function htmlToText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<h[1-6][^>]*>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ");

  text = stripInlineTags(text);

  text = decodeHtmlEntities(text);

  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line, index, arr) => line.length > 0 || (arr[index - 1]?.length ?? 0) > 0)
    .join("\n")
    .trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x27;", "'")
    .replaceAll(/&#(\d+);/g, (_match, code: string) => String.fromCodePoint(Number(code)))
    .replaceAll(/&#x([0-9a-fA-F]+);/g, (_match, hex: string) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    );
}

export const webFetchSchema = {
  name: "web_fetch",
  description: "Fetch URL content and convert HTML to plain text.",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string", description: "URL to fetch" },
      maxLength: { type: "number", description: "Maximum response length in characters" },
    },
    required: ["url"],
  },
} as const;
