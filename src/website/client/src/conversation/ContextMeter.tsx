import { useEffect, useRef, useState } from "react";
import { formatTokens } from "./trajectoryModel";
import styles from "./ContextMeter.module.css";

const RADIUS = 5.5;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
interface ContextMeterProps {
  readonly usedTokens: number;
  readonly contextWindowTokens: number;
  readonly outputReserveTokens: number;
  readonly estimated: boolean;
  readonly estimateSource?: "heuristic" | "provider_usage";
  readonly prunedToolResults?: number;
  readonly summarizedMessages?: number;
}

export function ContextMeter({
  usedTokens,
  contextWindowTokens,
  outputReserveTokens,
  estimated,
  estimateSource,
  prunedToolResults = 0,
  summarizedMessages = 0,
}: ContextMeterProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const used = Math.max(0, usedTokens);
  const contextWindow = Math.max(1, contextWindowTokens);
  const promptBudget = Math.max(1, contextWindow - Math.max(0, outputReserveTokens));
  const percent = Math.min(100, Math.round((used / promptBudget) * 100));
  const reading = `${percent}%`;

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (event.target instanceof Node && rootRef.current?.contains(event.target) === true) return;
      setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={rootRef} className={styles.root}>
      <button
        type="button"
        className={styles.trigger}
        aria-label={`上下文已用 ${reading}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`上下文已用 ${reading}`}
        onClick={() => setOpen((value) => !value)}
      >
        <svg viewBox="0 0 14 14" width="14" height="14" aria-hidden>
          <circle className={styles.track} cx="7" cy="7" r={RADIUS} />
          <circle
            className={styles.fill}
            cx="7"
            cy="7"
            r={RADIUS}
            strokeDasharray={`${(CIRCUMFERENCE * percent) / 100} ${CIRCUMFERENCE}`}
            transform="rotate(-90 7 7)"
          />
        </svg>
      </button>
      {open && (
        <div className={styles.panel} role="dialog" aria-label="上下文占用">
          <div className={styles.header}>
            <span className={styles.headline}>上下文已用</span>
            <span className={styles.percent}>{reading}</span>
            <span className={styles.figures}>
              {estimated ? "≈" : ""}
              {formatTokens(used)} / {formatTokens(promptBudget)} prompt
            </span>
          </div>
          <div className={styles.bar}>
            <div className={styles.segment} style={{ width: `${Math.max(2, percent)}%` }} />
          </div>
          <div className={styles.figures}>
            {formatTokens(outputReserveTokens)} output reserved · {formatTokens(contextWindow)}{" "}
            total
          </div>
          {estimated && (
            <div className={styles.figures}>
              {estimateSource === "provider_usage" ? "provider usage + surface delta" : "heuristic"}
            </div>
          )}
          {(prunedToolResults > 0 || summarizedMessages > 0) && (
            <div className={styles.figures}>
              compacted: {summarizedMessages} messages · pruned: {prunedToolResults} tool results
            </div>
          )}
        </div>
      )}
    </span>
  );
}
