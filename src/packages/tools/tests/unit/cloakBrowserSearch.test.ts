import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CLOAKBROWSER_VERSION,
  cloakBrowserSearch,
  configureCloakBrowserRuntime,
  type CloakBrowserLauncher,
} from "../../src/web/cloakBrowserSearch.js";

const CLOAK_ENV = [
  "CLOAKBROWSER_CACHE_DIR",
  "CLOAKBROWSER_VERSION",
  "CLOAKBROWSER_AUTO_UPDATE",
  "CLOAKBROWSER_WIDEVINE",
] as const;

afterEach(() => {
  for (const key of CLOAK_ENV) delete process.env[key];
});

function launcherFor(
  options: {
    readonly rows?: readonly {
      readonly title?: string;
      readonly href?: string;
      readonly snippet?: string;
    }[];
    readonly goto?: Promise<unknown>;
  } = {},
): {
  readonly launcher: CloakBrowserLauncher;
  readonly launch: ReturnType<typeof vi.fn>;
  readonly close: ReturnType<typeof vi.fn>;
} {
  const close = vi.fn(async () => undefined);
  const goto = vi.fn(() => options.goto ?? Promise.resolve(undefined));
  const evaluate = vi.fn(async (pageFunction: (limit: number) => unknown, limit: number) => {
    const globals = globalThis as unknown as { document?: unknown; location?: unknown };
    const priorDocument = globals.document;
    const priorLocation = globals.location;
    globals.location = { href: "https://html.duckduckgo.com/html/" };
    globals.document = {
      querySelectorAll: () =>
        (options.rows ?? []).map((row) => ({
          querySelector: (selector: string) => {
            if (selector === "a.result__a" && row.href !== undefined) {
              return { textContent: row.title ?? "", href: row.href };
            }
            if (selector === ".result__snippet") return { textContent: row.snippet ?? "" };
            return null;
          },
        })),
    };
    try {
      return pageFunction(limit);
    } finally {
      globals.document = priorDocument;
      globals.location = priorLocation;
    }
  });
  const launch = vi.fn(async () => ({
    newPage: async () => ({ goto, evaluate }),
    close,
  }));
  return { launcher: launch as unknown as CloakBrowserLauncher, launch, close };
}

describe("configureCloakBrowserRuntime", () => {
  it("pins the isolated cache and leaves explicit host choices intact", () => {
    const env: NodeJS.ProcessEnv = {};
    configureCloakBrowserRuntime(env);
    expect(env.CLOAKBROWSER_CACHE_DIR).toContain(".cantilune");
    expect(env.CLOAKBROWSER_VERSION).toBe(CLOAKBROWSER_VERSION);
    expect(env.CLOAKBROWSER_AUTO_UPDATE).toBe("false");
    expect(env.CLOAKBROWSER_WIDEVINE).toBe("0");

    configureCloakBrowserRuntime({
      CLOAKBROWSER_CACHE_DIR: "host-cache",
      CLOAKBROWSER_VERSION: "1.2.3.4",
      CLOAKBROWSER_AUTO_UPDATE: "true",
      CLOAKBROWSER_WIDEVINE: "1",
    });
  });
});

describe("cloakBrowserSearch", () => {
  it("uses a temporary fixed search endpoint and returns only public result links", async () => {
    const { launcher, launch, close } = launcherFor({
      rows: [
        { title: " First hit ", href: "https://example.com/a", snippet: " one  two " },
        { title: "Ignored", href: "mailto:test@example.com", snippet: "not public http" },
        {
          title: "Redirected",
          href: "https://duckduckgo.com/l/?uddg=https%253A%252F%252Fexample.org%252Fb",
          snippet: "second",
        },
      ],
    });

    const results = await cloakBrowserSearch(
      { query: "cantilune tools", maxResults: 25 },
      launcher,
    );

    expect(results).toEqual([
      { title: "First hit", url: "https://example.com/a", snippet: "one two" },
      { title: "Redirected", url: "https://example.org/b", snippet: "second" },
    ]);
    expect(launch).toHaveBeenCalledWith({
      headless: true,
      browserVersion: CLOAKBROWSER_VERSION,
      stealthArgs: false,
      humanize: false,
    });
    expect(close).toHaveBeenCalledOnce();
  });

  it("drops malformed redirects and non-http rows while retaining valid results", async () => {
    const { launcher } = launcherFor({
      rows: [
        { title: "Missing href" },
        { title: " ", href: "https://example.com/empty-title" },
        {
          title: "Broken redirect",
          href: "https://duckduckgo.com/l/?uddg=%E0%A4%A",
        },
        { title: "Not HTTP", href: "mailto:operator@example.com" },
        { title: "Kept", href: "https://example.net/kept" },
      ],
    });

    await expect(cloakBrowserSearch({ query: "filter", maxResults: 0 }, launcher)).resolves.toEqual(
      [{ title: "Kept", url: "https://example.net/kept", snippet: "" }],
    );
  });

  it("rejects invalid or already-aborted input before launching a browser", async () => {
    const { launcher, launch } = launcherFor();
    await expect(cloakBrowserSearch({ query: "  " }, launcher)).rejects.toThrow(
      "must not be empty",
    );
    await expect(cloakBrowserSearch({ query: "x".repeat(513) }, launcher)).rejects.toThrow(
      "exceeds",
    );
    const controller = new AbortController();
    controller.abort();
    await expect(
      cloakBrowserSearch({ query: "aborted", signal: controller.signal }, launcher),
    ).rejects.toThrow("aborted");
    expect(launch).not.toHaveBeenCalled();
  });

  it("serializes the keyless browser and closes it when an active search is aborted", async () => {
    let resolveGoto: (() => void) | undefined;
    const goto = new Promise<void>((resolve) => {
      resolveGoto = resolve;
    });
    const { launcher, close } = launcherFor({ goto });
    const controller = new AbortController();
    const pending = cloakBrowserSearch({ query: "active", signal: controller.signal }, launcher);
    await Promise.resolve();
    await expect(cloakBrowserSearch({ query: "parallel" }, launcher)).rejects.toThrow("busy");
    controller.abort();
    await expect(pending).rejects.toThrow("aborted");
    resolveGoto?.();
    expect(close).toHaveBeenCalledOnce();
  });
});
