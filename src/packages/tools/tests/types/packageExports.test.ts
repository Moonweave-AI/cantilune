import { describe, expect, it } from "vitest";
import * as toolsExports from "../../src/index.js";
import {
  DEFAULT_MAX_FILE_SIZE,
  DEFAULT_MAX_OUTPUT_SIZE,
  DEFAULT_MAX_RESPONSE_SIZE,
  DEFAULT_SHELL_TIMEOUT_MS,
  DEFAULT_WEB_TIMEOUT_MS,
} from "../../src/types.js";

describe("@cantilune/tools package exports", () => {
  it("exports createToolSet", () => {
    expect(toolsExports.createToolSet).toBeTypeOf("function");
  });

  it("exports createFilesystemExecutor", () => {
    expect(toolsExports.createFilesystemExecutor).toBeTypeOf("function");
  });

  it("exports createShellExecutor", () => {
    expect(toolsExports.createShellExecutor).toBeTypeOf("function");
  });

  it("exports createWebExecutor", () => {
    expect(toolsExports.createWebExecutor).toBeTypeOf("function");
  });

  it("exports createOsSandbox and applyMcpAttach", () => {
    expect(toolsExports.createOsSandbox).toBeTypeOf("function");
    expect(toolsExports.applyMcpAttach).toBeTypeOf("function");
    expect(toolsExports.probeSandboxHost).toBeTypeOf("function");
    expect(toolsExports.assertSandboxIsolation).toBeTypeOf("function");
    expect(toolsExports.createWslDockerRunner).toBeTypeOf("function");
    expect(toolsExports.hyperVSkuSupported).toBeTypeOf("function");
    expect(toolsExports.DEFAULT_SANDBOX_MODE).toBe("required");
  });

  it("exports default configuration constants", () => {
    expect(DEFAULT_MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
    expect(DEFAULT_SHELL_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULT_MAX_OUTPUT_SIZE).toBe(100 * 1024);
    expect(DEFAULT_WEB_TIMEOUT_MS).toBe(30_000);
    expect(DEFAULT_MAX_RESPONSE_SIZE).toBe(1024 * 1024);
  });
});
