import type { ReactNode } from "react";
import { IconChevronDown } from "../theme/icons";
import styles from "./DisclosureRow.module.css";

interface DisclosureRowProps {
  readonly title: string;
  readonly summary?: string | undefined;
  readonly pending?: boolean;
  readonly icon?: ReactNode;
  readonly children?: ReactNode;
}

export function DisclosureRow({
  title,
  summary,
  pending = false,
  icon,
  children,
}: DisclosureRowProps): JSX.Element {
  return (
    <details className={styles.root} data-pending={pending || undefined}>
      <summary className={styles.row}>
        <span className={styles.chevron} aria-hidden>
          <IconChevronDown size={12} />
        </span>
        {icon !== undefined && <span className={styles.icon}>{icon}</span>}
        <span className={styles.title}>{title}</span>
        {summary !== undefined && summary.length > 0 && (
          <>
            <i className={styles.sep} />
            <span className={styles.summary}>{summary}</span>
          </>
        )}
      </summary>
      {children !== undefined && <div className={styles.body}>{children}</div>}
    </details>
  );
}
