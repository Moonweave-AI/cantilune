import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import type { ContentEntry, ContentStore } from "@cantilune/content";
import type { SlashCommand, CommandCategory } from "./registry.js";
import type { AppStore, ViewType } from "../store.js";

/**
 * Open a content view with prefetched data merged into viewArgs. The content
 * store is async, but views render synchronously from RuntimeState/viewArgs, so
 * handlers fetch here and stash the result for the view to render.
 */
function openContentView(
  view: ViewType,
  stash: Record<string, unknown>,
): (args: Record<string, unknown>, store: AppStore) => void {
  return (args, store) => {
    store.mode = "view";
    store.activeView = view;
    store.viewArgs = { ...args, ...stash };
  };
}

/** Referenced content refs from the live world (audit + artifacts + sessions). */
function referencedRefs(store: AppStore): Set<string> {
  const snapshot = store.runtime.snapshot;
  if (snapshot === null) return new Set();
  const refs = new Set<string>();
  for (const entry of snapshot.auditTail) {
    refs.add(entry.payloadRef);
  }
  for (const artifact of snapshot.artifacts) {
    const contentRef = (artifact as { contentRef?: string }).contentRef;
    if (typeof contentRef === "string" && contentRef.length > 0) refs.add(contentRef);
  }
  for (const session of snapshot.sessions) {
    const s = session as { manifestRef?: string; contentRef?: string };
    if (typeof s.manifestRef === "string" && s.manifestRef.length > 0) refs.add(s.manifestRef);
    if (typeof s.contentRef === "string" && s.contentRef.length > 0) refs.add(s.contentRef);
  }
  return refs;
}

async function fetchEntries(
  services: { readonly contentStore?: () => ContentStore | undefined } | undefined,
): Promise<ContentEntry[]> {
  const store = services?.contentStore?.();
  if (store === undefined) return [];
  return [...(await store.list())];
}

export function registerContentCommands(): SlashCommand[] {
  const view = "view" as CommandCategory;
  const operation = "operation" as CommandCategory;
  return [
    {
      name: "/content cat",
      description: "Display content by ContentRef",
      category: view,
      args: [
        { name: "ref", description: "ContentRef (sha256:...)", required: true, type: "string" },
      ],
      async handler(args, store, services) {
        const ref = typeof args.ref === "string" ? args.ref : "";
        const contentStore = services?.contentStore?.();
        if (contentStore === undefined) {
          openContentView("content-cat", { ref, error: "no-content-store" })(args, store);
          return;
        }
        const blob = await contentStore.get(ref as Parameters<ContentStore["get"]>[0]);
        if (blob === undefined) {
          openContentView("content-cat", { ref, error: "not-found" })(args, store);
          return;
        }
        // UTF-8 text is rendered directly; binary is shown as a hex preview so a
        // raw-bytes view never blanks the terminal on non-text content.
        const body = textOrHexPreview(blob.bytes);
        openContentView("content-cat", {
          ref,
          body,
          mimeType: blob.metadata.mimeType,
          size: blob.metadata.size,
        })(args, store);
      },
    },
    {
      name: "/content put",
      description: "Store file into content-addressed store",
      category: operation,
      args: [{ name: "file", description: "Local file path", required: true, type: "string" }],
      async handler(args, store, services) {
        const filePath = typeof args.file === "string" ? args.file : "";
        const contentStore = services?.contentStore?.();
        if (contentStore === undefined) {
          services?.notify?.("error", "No content store connected");
          return;
        }
        try {
          const bytes = await readFile(filePath);
          const ref = await contentStore.put(bytes, {
            mimeType: "application/octet-stream",
            createdBy: "cli:content-put",
          });
          services?.notify?.("info", `Stored ${basename(filePath)} → ${ref as string}`);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          services?.notify?.("error", `content put failed: ${message}`);
        }
      },
    },
    {
      name: "/content ls",
      description: "List stored content refs",
      category: view,
      async handler(args, store, services) {
        const entries = await fetchEntries(services);
        openContentView("content-ls", { entries })(args, store);
      },
    },
    {
      name: "/content search",
      description: "Full-text search in content store",
      category: view,
      args: [{ name: "text", description: "Search text", required: true, type: "string" }],
      async handler(args, store, services) {
        const query = typeof args.text === "string" ? args.text.trim() : "";
        if (query.length === 0) {
          openContentView("content-search", {
            entries: [],
            text: "",
            error: "empty query is fail-closed",
          })(args, store);
          return;
        }
        const contentStore = services?.contentStore?.();
        const all = await fetchEntries(services);
        const matched: ContentEntry[] = [];
        if (contentStore !== undefined) {
          for (const entry of all) {
            const blob = await contentStore.get(entry.ref as Parameters<ContentStore["get"]>[0]);
            if (blob === undefined) continue;
            const text = Buffer.from(blob.bytes).toString("utf8");
            if (text.includes(query) || (entry.ref as string).includes(query)) {
              matched.push(entry);
            }
          }
        }
        openContentView("content-search", { entries: matched, text: query })(args, store);
      },
    },
    {
      name: "/content stats",
      description: "Content store statistics",
      category: view,
      async handler(args, store, services) {
        const entries = await fetchEntries(services);
        const referenced = referencedRefs(store);
        const totalBytes = entries.reduce((sum, e) => sum + e.metadata.size, 0);
        const orphanCount = entries.filter((e) => !referenced.has(e.ref as string)).length;
        openContentView("content-stats", {
          entries,
          stats: {
            total: entries.length,
            totalBytes,
            referenced: entries.filter((e) => referenced.has(e.ref as string)).length,
            orphans: orphanCount,
          },
        })(args, store);
      },
    },
    {
      name: "/content gc",
      description: "Garbage-collect unreferenced blobs (dry-run; --confirm to delete)",
      category: view,
      args: [
        {
          name: "--confirm",
          description: "Actually delete orphaned blobs",
          required: false,
          type: "boolean",
        },
      ],
      async handler(args, store, services) {
        const entries = await fetchEntries(services);
        const referenced = referencedRefs(store);
        const orphans = entries
          .filter((e) => !referenced.has(e.ref as string))
          .map((e) => e.ref as string);
        const confirm = args.confirm === true || args["--confirm"] === true;
        let deletedCount = 0;
        if (confirm) {
          const contentStore = services?.contentStore?.();
          if (contentStore === undefined) {
            openContentView("content-gc", {
              orphans,
              confirm: false,
              error: "no-content-store",
            })(args, store);
            return;
          }
          for (const ref of orphans) {
            if (await contentStore.remove(ref as Parameters<ContentStore["remove"]>[0])) {
              deletedCount += 1;
            }
          }
        }
        openContentView("content-gc", {
          orphans,
          confirm,
          deletedCount,
        })(args, store);
      },
    },
  ];
}

/** Render UTF-8 text directly; for non-text bytes, show a hex preview. */
function textOrHexPreview(bytes: Uint8Array): string {
  // Heuristic: treat as text if every byte is printable ASCII or common whitespace.
  // Content-addressed blobs may be binary; never blank the view on raw bytes.
  const sample = bytes.slice(0, 1024);
  let isText = true;
  for (const b of sample) {
    if (b === 0) {
      isText = false;
      break;
    }
  }
  if (isText && bytes.byteLength <= 4096) {
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      isText = false;
    }
  }
  // Binary: hex preview of first 64 bytes, plus length.
  const previewBytes = bytes.slice(0, 64);
  const hex = Array.from(previewBytes, (b) => b.toString(16).padStart(2, "0")).join(" ");
  return `[binary] ${bytes.byteLength} bytes\n${hex}${bytes.byteLength > 64 ? " …" : ""}`;
}
