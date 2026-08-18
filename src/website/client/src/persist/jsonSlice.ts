/**
 * Scan a JSON object for a top-level property without JSON.parse.
 * Used to peel oversized conversation blobs out of localStorage before React boots.
 */

function skipWs(source: string, index: number): number {
  let i = index;
  while (i < source.length && source.charCodeAt(i) <= 32) i += 1;
  return i;
}

function skipString(source: string, index: number): number {
  let i = index + 1;
  while (i < source.length) {
    const code = source.charCodeAt(i);
    if (code === 92) {
      i += 2;
      continue;
    }
    if (code === 34) return i + 1;
    i += 1;
  }
  return i;
}

function skipValue(source: string, index: number): number {
  const i = skipWs(source, index);
  const code = source.charCodeAt(i);
  if (code === 34) return skipString(source, i);
  if (code === 123 || code === 91) {
    const open = code;
    const close = code === 123 ? 125 : 93;
    let depth = 1;
    let j = i + 1;
    while (j < source.length && depth > 0) {
      const inner = source.charCodeAt(j);
      if (inner === 34) {
        j = skipString(source, j);
        continue;
      }
      if (inner === open) depth += 1;
      else if (inner === close) depth -= 1;
      j += 1;
    }
    return j;
  }
  let j = i;
  while (j < source.length) {
    const inner = source.charCodeAt(j);
    if (inner === 44 || inner === 125 || inner === 93 || inner <= 32) break;
    j += 1;
  }
  return j;
}

export interface JsonPropertySpan {
  readonly valueStart: number;
  readonly valueEnd: number;
}

/** Locate `"key": <value>` on the root object of `source`. */
export function findTopLevelProperty(source: string, key: string): JsonPropertySpan | undefined {
  let i = skipWs(source, 0);
  if (source.charCodeAt(i) !== 123) return undefined;
  i += 1;
  const want = `"${key}"`;
  while (i < source.length) {
    i = skipWs(source, i);
    if (source.charCodeAt(i) === 125) return undefined;
    if (source.charCodeAt(i) !== 34) return undefined;
    const keyStart = i;
    i = skipString(source, i);
    const keyText = source.slice(keyStart, i);
    i = skipWs(source, i);
    if (source.charCodeAt(i) !== 58) return undefined;
    i += 1;
    i = skipWs(source, i);
    const valueStart = i;
    const valueEnd = skipValue(source, i);
    if (keyText === want) return { valueStart, valueEnd };
    i = skipWs(source, valueEnd);
    if (source.charCodeAt(i) === 44) i += 1;
  }
  return undefined;
}

export function sliceTopLevelProperty(source: string, key: string): string | undefined {
  const span = findTopLevelProperty(source, key);
  if (span === undefined) return undefined;
  return source.slice(span.valueStart, span.valueEnd);
}

export function replaceTopLevelProperty(source: string, key: string, valueJson: string): string | undefined {
  const span = findTopLevelProperty(source, key);
  if (span === undefined) return undefined;
  return source.slice(0, span.valueStart) + valueJson + source.slice(span.valueEnd);
}
