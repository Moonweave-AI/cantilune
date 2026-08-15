/**
 * Child process entry: durable CAS bump on shared control-plane snapshot.
 * Usage: node casBindingChild.mjs <dir> <workerLabel> <expectedGeneration> <domainId>
 */
import { bindingGeneration } from "../../../core/dist/index.js";
import { MemoryControlPlaneStore } from "../../dist/memory/memoryControlPlaneStore.js";
import { createFileControlPlaneStore } from "../../dist/file/fileControlPlaneStore.js";

const dir = process.argv[2];
const workerLabel = process.argv[3];
const expectedGeneration = Number(process.argv[4]);
const domainId = process.argv[5];

if (
  dir === undefined ||
  workerLabel === undefined ||
  Number.isNaN(expectedGeneration) ||
  domainId === undefined
) {
  console.error("usage: casBindingChild.mjs <dir> <workerLabel> <expectedGeneration> <domainId>");
  process.exit(2);
}

const memory = new MemoryControlPlaneStore();
const fileStore = createFileControlPlaneStore(dir, memory);
const active = fileStore.delegate.getActiveBinding(domainId);
if (active === undefined) {
  console.error("active binding missing");
  process.exit(3);
}

const nextBinding = {
  ...active,
  bindingGeneration: bindingGeneration(expectedGeneration + 1),
  activatedBy: workerLabel,
  activatedAt: new Date().toISOString(),
};

const ok = fileStore.casActiveBindingDurable({
  domainId,
  expectedGeneration: bindingGeneration(expectedGeneration),
  nextBinding,
});

process.stdout.write(ok ? "won" : "lost");
process.exit(ok ? 0 : 2);
