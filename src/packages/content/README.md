# @cantilune/content

Content-addressed storage for Cantilune. Resolves `ContentRef` to actual bytes.

## Overview

Cantilune separates coordination structure (the "who does what" graph) from content
(the actual text, code, files). `WorkArtifact.contentRef` and `ObservationEntry.payloadRef`
point to content stored here.

**Key properties:**

- **Content-addressed**: SHA-256 of bytes = ref. Same content always same ref (dedup).
- **Immutable**: once stored, content never changes or deletes.
- **Consistent**: `get()` always returns `Uint8Array`. Use `blobToText()` for string decoding.

## Ref format

```
sha256:<64 hex characters>
```

Example: `sha256:2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824`

## Usage

```typescript
import { createMemoryContentStore, blobToText } from "@cantilune/content";

const store = createMemoryContentStore();

// Store content
const ref = await store.put("function login() { ... }", { mimeType: "text/typescript" });

// Retrieve content
const blob = await store.get(ref);
const text = blobToText(blob!);
```

## Adapters

| Adapter | Import                      | Use case                               |
| ------- | --------------------------- | -------------------------------------- |
| Memory  | `@cantilune/content/memory` | Tests, short-lived processes           |
| File    | `@cantilune/content/file`   | Local development, durable single-node |

## API

```typescript
interface ContentStore {
  put(content: string | Uint8Array, options?: ContentPutOptions): Promise<ContentRef>;
  get(ref: ContentRef): Promise<ContentBlob | undefined>;
  exists(ref: ContentRef): Promise<boolean>;
  metadata(ref: ContentRef): Promise<ContentMetadata | undefined>;
  count(): Promise<number>;
  list(): Promise<readonly ContentEntry[]>;
  remove(ref: ContentRef): Promise<boolean>; // destructive: GC only, human-gated
}
```

## Environment

Current implementation requires **Node.js** (`node:crypto` for SHA-256).
Browser/edge support is a future consideration.
