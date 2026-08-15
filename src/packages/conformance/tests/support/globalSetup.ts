import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export default function globalSetup(): void {
  const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  execSync("pnpm build", { cwd: packageRoot, stdio: "ignore" }); // NOSONAR — test setup, PATH is trusted
}
