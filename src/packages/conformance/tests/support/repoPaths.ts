import path from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

/** Monorepo root (cantilune). */
export const REPO_ROOT = path.resolve(packageRoot, "../../..");

export const PROOF_OBLIGATIONS_PATH = path.join(REPO_ROOT, "formal/proof-obligations.json");
