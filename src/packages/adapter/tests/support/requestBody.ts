/**
 * Narrows a captured `fetch` body to the JSON string every adapter sends. The
 * body type also admits streams and form data, which would stringify to
 * `[object Object]` and turn a genuine regression into a confusing parse error.
 */
export function requestBodyText(body: RequestInit["body"]): string {
  if (typeof body !== "string") {
    throw new TypeError(`expected a string request body, received ${typeof body}`);
  }
  return body;
}
