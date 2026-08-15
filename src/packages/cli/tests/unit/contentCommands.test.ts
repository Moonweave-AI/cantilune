import { describe, it, expect, vi } from "vitest";
import type { ContentRef } from "@cantilune/core";
import { createCommandRegistry } from "../../src/commands/registry.js";
import { registerContentCommands } from "../../src/commands/contentCommands.js";
import { createStore } from "../../src/store.js";
import { renderContentViewOutput } from "../../src/views/ContentView.js";
import { sampleRuntime } from "../support/sampleRuntime.js";
import type { ContentStore, ContentEntry } from "@cantilune/content";

/** Build a mock ContentStore with controllable list/get/remove. */
function mockStore(opts: {
  entries?: ContentEntry[];
  blobs?: Map<string, Uint8Array>;
}): ContentStore {
  const blobs = opts.blobs ?? new Map<string, Uint8Array>();
  const entries = opts.entries ?? [];
  return {
    isAvailable: () => true,
    put: vi.fn(async (content: string | Uint8Array): Promise<ContentRef> => {
      const bytes = typeof content === "string" ? new TextEncoder().encode(content) : content;
      const ref =
        `sha256:${Array.from(bytes.slice(0, 32), (b) => b.toString(16).padStart(2, "0")).join("")}` as ContentRef;
      blobs.set(ref as string, bytes);
      return ref;
    }),
    get: vi.fn(async (ref: ContentRef) => {
      const bytes = blobs.get(ref as string);
      if (bytes === undefined) return undefined;
      return {
        ref,
        bytes,
        metadata: {
          size: bytes.length,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      };
    }),
    exists: vi.fn(async (ref: ContentRef) => blobs.has(ref as string)),
    metadata: vi.fn(async () => undefined),
    count: vi.fn(async () => entries.length),
    list: vi.fn(async () => entries),
    remove: vi.fn(async (ref: ContentRef) => blobs.delete(ref as string)),
  } as unknown as ContentStore;
}

function servicesWith(store: ContentStore) {
  return { contentStore: () => store };
}

function registry() {
  const r = createCommandRegistry();
  for (const c of registerContentCommands()) r.register(c);
  return r;
}

describe("content command wiring", () => {
  it("content cat prefetches the body and stashes it for the view", async () => {
    const blobs = new Map<string, Uint8Array>([
      ["sha256:abc", new TextEncoder().encode("hello body")],
    ]);
    const store = mockStore({
      entries: [
        {
          ref: "sha256:abc" as ContentRef,
          metadata: {
            size: 10,
            mimeType: "text/plain",
            createdAt: "2026-08-14T00:00:00.000Z",
            createdBy: undefined,
          },
        },
      ],
      blobs,
    });
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/content cat sha256:abc", appStore, servicesWith(store));

    expect(appStore.activeView).toBe("content-cat");
    expect(appStore.viewArgs.ref).toBe("sha256:abc");
    expect(appStore.viewArgs.body).toBe("hello body");
    // The view renders the prefetched body, not a stub.
    expect(renderContentViewOutput("content-cat", appStore.viewArgs, sampleRuntime)).toContain(
      "hello body",
    );
  });

  it("content cat reports not-found when the ref is absent", async () => {
    const store = mockStore({ entries: [], blobs: new Map() });
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/content cat sha256:missing", appStore, servicesWith(store));

    expect(appStore.viewArgs.error).toBe("not-found");
    expect(renderContentViewOutput("content-cat", appStore.viewArgs, sampleRuntime)).toContain(
      "Not found",
    );
  });

  it("content ls prefetches entries and renders the table", async () => {
    const entries: ContentEntry[] = [
      {
        ref: "sha256:abc" as ContentRef,
        metadata: {
          size: 12,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: "actor:user",
        },
      },
      {
        ref: "sha256:def" as ContentRef,
        metadata: {
          size: 4,
          mimeType: "application/json",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      },
    ];
    const store = mockStore({ entries });
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/content ls", appStore, servicesWith(store));

    expect(appStore.activeView).toBe("content-ls");
    const output = renderContentViewOutput("content-ls", appStore.viewArgs, sampleRuntime);
    expect(output).toContain("sha256:abc");
    expect(output).toContain("sha256:def");
    expect(output).toContain("12");
  });

  it("content stats computes total, bytes, referenced, orphans", async () => {
    const entries: ContentEntry[] = [
      {
        ref: "sha256:abc" as ContentRef,
        metadata: {
          size: 10,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      },
      {
        ref: "sha256:orphan" as ContentRef,
        metadata: {
          size: 5,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      },
    ];
    const store = mockStore({ entries });
    const reg = registry();
    const appStore = createStore();
    appStore.runtime = sampleRuntime; // auditTail references sha256:abc + sha256:def

    await reg.execute("/content stats", appStore, servicesWith(store));

    const stats = appStore.viewArgs.stats as {
      total: number;
      totalBytes: number;
      referenced: number;
      orphans: number;
    };
    expect(stats.total).toBe(2);
    expect(stats.totalBytes).toBe(15);
    expect(stats.referenced).toBe(1); // sha256:abc is in auditTail
    expect(stats.orphans).toBe(1); // sha256:orphan is not
    const output = renderContentViewOutput("content-stats", appStore.viewArgs, sampleRuntime);
    expect(output).toContain("15");
  });

  it("content gc dry-run lists orphans without deleting", async () => {
    const entries: ContentEntry[] = [
      {
        ref: "sha256:abc" as ContentRef,
        metadata: {
          size: 10,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      },
      {
        ref: "sha256:orphan" as ContentRef,
        metadata: {
          size: 5,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      },
    ];
    const blobs = new Map<string, Uint8Array>([
      ["sha256:abc", new Uint8Array(10)],
      ["sha256:orphan", new Uint8Array(5)],
    ]);
    const store = mockStore({ entries, blobs });
    const reg = registry();
    const appStore = createStore();
    appStore.runtime = sampleRuntime;

    await reg.execute("/content gc", appStore, servicesWith(store));

    expect(appStore.viewArgs.confirm).toBe(false);
    expect(appStore.viewArgs.deletedCount).toBe(0);
    expect(appStore.viewArgs.orphans).toEqual(["sha256:orphan"]);
    expect(store.remove).not.toHaveBeenCalled();
  });

  it("content gc --confirm deletes the orphans", async () => {
    const entries: ContentEntry[] = [
      {
        ref: "sha256:abc" as ContentRef,
        metadata: {
          size: 10,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      },
      {
        ref: "sha256:orphan" as ContentRef,
        metadata: {
          size: 5,
          mimeType: "text/plain",
          createdAt: "2026-08-14T00:00:00.000Z",
          createdBy: undefined,
        },
      },
    ];
    const blobs = new Map<string, Uint8Array>([
      ["sha256:abc", new Uint8Array(10)],
      ["sha256:orphan", new Uint8Array(5)],
    ]);
    const store = mockStore({ entries, blobs });
    const reg = registry();
    const appStore = createStore();
    appStore.runtime = sampleRuntime;

    await reg.execute("/content gc --confirm", appStore, servicesWith(store));

    expect(appStore.viewArgs.confirm).toBe(true);
    expect(appStore.viewArgs.deletedCount).toBe(1);
    expect(store.remove).toHaveBeenCalledWith("sha256:orphan");
    expect(store.remove).not.toHaveBeenCalledWith("sha256:abc");
  });

  it("content handlers degrade gracefully without a content store", async () => {
    const reg = registry();
    const appStore = createStore();

    await reg.execute("/content ls", appStore); // no services
    expect(appStore.activeView).toBe("content-ls");
    expect(Array.isArray(appStore.viewArgs.entries)).toBe(true);
    expect((appStore.viewArgs.entries as unknown[]).length).toBe(0);

    await reg.execute("/content cat sha256:abc", appStore); // no services
    expect(appStore.viewArgs.error).toBe("no-content-store");
  });
});
