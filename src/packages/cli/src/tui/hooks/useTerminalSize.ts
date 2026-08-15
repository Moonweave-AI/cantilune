import { useEffect, useState } from "react";
import { useStdout } from "ink";

export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

const FALLBACK: TerminalSize = { columns: 100, rows: 30 };

/**
 * Track terminal dimensions, re-rendering on resize.
 *
 * Ink does not expose a resize hook, so this subscribes to the stdout stream's
 * own `resize` event. Non-TTY environments (CI, piped output) get a stable
 * fallback so layout math never divides by zero.
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();

  const read = (): TerminalSize => {
    const columns = stdout?.columns;
    const rows = stdout?.rows;
    return {
      columns: typeof columns === "number" && columns > 0 ? columns : FALLBACK.columns,
      rows: typeof rows === "number" && rows > 0 ? rows : FALLBACK.rows,
    };
  };

  const [size, setSize] = useState<TerminalSize>(read);

  useEffect(() => {
    if (stdout === undefined) return;
    const onResize = (): void => {
      setSize(read);
    };
    stdout.on("resize", onResize);
    return () => {
      stdout.off("resize", onResize);
    };
    // `read` closes over `stdout` only; re-subscribing on identity change is enough.
  }, [stdout]);

  return size;
}
