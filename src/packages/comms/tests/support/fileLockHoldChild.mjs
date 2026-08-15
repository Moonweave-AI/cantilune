import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const [modulePath, dir, mode, label, readyPath, releasePath, eventsPath, timeoutText] =
  process.argv.slice(2);
const { acquireFileLock } = await import(pathToFileURL(modulePath).href);

try {
  const lock = acquireFileLock(dir, { timeoutMs: Number(timeoutText) });
  appendFileSync(eventsPath, `enter:${label}\n`, "utf8");
  if (mode === "hold") {
    writeFileSync(readyPath, "ready", "utf8");
    while (!existsSync(releasePath)) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
  }
  appendFileSync(eventsPath, `exit:${label}\n`, "utf8");
  lock.release();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 2;
}
