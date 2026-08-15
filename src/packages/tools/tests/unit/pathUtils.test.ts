import { describe, expect, it } from "vitest";
import { matchGlobPattern, resolveSafePath } from "../../src/filesystem/pathUtils.js";

describe("pathUtils", () => {
  it("resolveSafePath accepts paths within root", () => {
    const resolved = resolveSafePath("/tmp/root", "subdir/file.txt");
    expect(resolved).toContain("subdir");
    expect(resolved).toContain("file.txt");
  });

  it("resolveSafePath rejects traversal outside root", () => {
    expect(() => resolveSafePath("/tmp/root", "../etc/passwd")).toThrow("outside allowed root");
  });

  it("matchGlobPattern supports wildcards and question marks", () => {
    expect(matchGlobPattern("alpha.ts", "*.ts")).toBe(true);
    expect(matchGlobPattern("alpha.ts", "*.js")).toBe(false);
    expect(matchGlobPattern("a.ts", "?.ts")).toBe(true);
    expect(matchGlobPattern("ab.ts", "?.ts")).toBe(false);
  });

  it("matchGlobPattern supports ** segments", () => {
    expect(matchGlobPattern("nested/deep/file.json", "**/*.json")).toBe(true);
  });

  it("matchGlobPattern escapes regex special characters in pattern", () => {
    expect(matchGlobPattern("file+1.txt", "file+1.txt")).toBe(true);
    expect(matchGlobPattern("fileX1.txt", "file+1.txt")).toBe(false);
  });
});
