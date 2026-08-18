import styles from "./ApprovalDock.module.css";

export interface ApprovalItem {
  readonly toolCallId: string;
  readonly name: string;
  readonly arguments: Record<string, unknown>;
  readonly tier: string;
}

interface ApprovalDockProps {
  readonly items: readonly ApprovalItem[];
  readonly onAllow: (toolCallId: string) => void;
  readonly onDeny: (toolCallId: string) => void;
  readonly onAlways: () => void;
  readonly onAllowAll: () => void;
}

export function ApprovalDock({
  items,
  onAllow,
  onDeny,
  onAlways,
  onAllowAll,
}: ApprovalDockProps): JSX.Element | null {
  if (items.length === 0) return null;
  return (
    <div className={styles.dock} role="region" aria-label="工具批准">
      {items.map((item) => (
        <article key={item.toolCallId} className={styles.card}>
          <header>
            <strong>{item.name}</strong>
            <em>{item.tier}</em>
          </header>
          <pre>{JSON.stringify(item.arguments, null, 2)}</pre>
          <footer>
            <button type="button" className={styles.deny} onClick={() => onDeny(item.toolCallId)}>
              拒绝
            </button>
            <button type="button" className={styles.allow} onClick={() => onAllow(item.toolCallId)}>
              允许
            </button>
          </footer>
        </article>
      ))}
      <div className={styles.bar}>
        <button type="button" onClick={onAlways}>
          始终允许本次运行
        </button>
        <button type="button" className={styles.primary} onClick={onAllowAll}>
          全部允许
        </button>
      </div>
    </div>
  );
}
