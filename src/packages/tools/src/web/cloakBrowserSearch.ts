import { launch } from "cloakbrowser";
import { resolve } from "node:path";

export const CLOAKBROWSER_VERSION = "146.0.7680.177.5";
const MAX_QUERY_LENGTH = 512;
const MAX_RESULTS = 10;

export interface CloakBrowserSearchArgs {
  readonly query: string;
  readonly maxResults?: number;
  readonly timeoutMs?: number;
  readonly signal?: AbortSignal;
}

interface SearchResult {
  readonly title: string;
  readonly url: string;
  readonly snippet: string;
}

interface SearchPage {
  goto(
    url: string,
    options: { readonly waitUntil: "domcontentloaded"; readonly timeout: number },
  ): Promise<unknown>;
  evaluate<T, Arg>(pageFunction: (argument: Arg) => T | Promise<T>, argument: Arg): Promise<T>;
}

interface SearchDomElement {
  readonly textContent: string | null;
  readonly href?: string;
}

interface SearchDomRow {
  querySelector(selector: string): SearchDomElement | null;
}

interface SearchDocument {
  querySelectorAll(selector: string): readonly SearchDomRow[];
}

interface SearchBrowser {
  newPage(): Promise<SearchPage>;
  close(): Promise<void>;
}

export interface CloakBrowserLauncher {
  (options: {
    readonly headless: true;
    readonly browserVersion: string;
    readonly stealthArgs: false;
    readonly humanize: false;
  }): Promise<SearchBrowser>;
}

let searchInFlight = false;

/** Apply safe, deterministic defaults without overwriting an explicit host policy. */
export function configureCloakBrowserRuntime(env: NodeJS.ProcessEnv = process.env): void {
  env.CLOAKBROWSER_CACHE_DIR ??= resolve(process.cwd(), ".cantilune", "cloakbrowser");
  env.CLOAKBROWSER_VERSION ??= CLOAKBROWSER_VERSION;
  env.CLOAKBROWSER_AUTO_UPDATE ??= "false";
  env.CLOAKBROWSER_WIDEVINE ??= "0";
}

function abortable<T>(operation: Promise<T>, signal: AbortSignal | undefined): Promise<T> {
  if (signal === undefined) return operation;
  if (signal.aborted) return Promise.reject(new Error("CloakBrowser search aborted"));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new Error("CloakBrowser search aborted"));
    signal.addEventListener("abort", onAbort, { once: true });
    void operation
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", onAbort));
  });
}

/**
 * Search through a temporary, keyless browser. This deliberately excludes
 * persistent profiles, login state, proxies, extensions, geo-IP, and
 * humanization. The tool can only visit the fixed search endpoint.
 */
export async function cloakBrowserSearch(
  args: CloakBrowserSearchArgs,
  launcher: CloakBrowserLauncher = launch as unknown as CloakBrowserLauncher,
): Promise<readonly SearchResult[]> {
  configureCloakBrowserRuntime();
  if (args.signal?.aborted === true) throw new Error("CloakBrowser search aborted");
  const query = args.query.trim();
  if (query.length === 0) throw new Error("Search query must not be empty");
  if (query.length > MAX_QUERY_LENGTH) {
    throw new Error(`Search query exceeds ${MAX_QUERY_LENGTH} characters`);
  }
  const maxResults = Math.max(1, Math.min(MAX_RESULTS, Math.floor(args.maxResults ?? 5)));
  if (searchInFlight) {
    throw new Error("CloakBrowser search is busy; retry after the current search completes");
  }

  searchInFlight = true;
  let browser: SearchBrowser | undefined;
  try {
    browser = await launcher({
      headless: true,
      browserVersion: process.env.CLOAKBROWSER_VERSION ?? CLOAKBROWSER_VERSION,
      stealthArgs: false,
      humanize: false,
    });
    const page = await browser.newPage();
    const endpoint = new URL("https://html.duckduckgo.com/html/");
    endpoint.searchParams.set("q", query);
    await abortable(
      page.goto(endpoint.toString(), {
        waitUntil: "domcontentloaded",
        timeout: args.timeoutMs ?? 30_000,
      }),
      args.signal,
    );
    return await abortable(
      page.evaluate((limit) => {
        const page = globalThis as unknown as {
          readonly document: SearchDocument;
          readonly location: { readonly href: string };
        };
        const clean = (value: string): string => value.replace(/\s+/gu, " ").trim();
        const results: SearchResult[] = [];
        for (const row of page.document.querySelectorAll(".result")) {
          const anchor = row.querySelector("a.result__a");
          if (anchor === null || anchor.href === undefined) continue;
          const title = clean(anchor.textContent ?? "");
          const snippet = clean(row.querySelector(".result__snippet")?.textContent ?? "");
          const href = new URL(anchor.href, page.location.href);
          const redirected = href.searchParams.get("uddg");
          let url = href.toString();
          if (redirected !== null) {
            try {
              url = decodeURIComponent(redirected);
            } catch {
              continue;
            }
          }
          if (!/^https?:\/\//iu.test(url) || title.length === 0) continue;
          results.push({ title, url, snippet });
          if (results.length >= limit) break;
        }
        return results;
      }, maxResults),
      args.signal,
    );
  } finally {
    searchInFlight = false;
    await browser?.close();
  }
}
