/**
 * WorldPanel — ADR-0030 §5. Renders the live `CollaborationSnapshot`: the
 * coordination world's participants, artifacts, sessions, capabilities, and
 * audit tail. Surfaces the coordination runtime the packages own.
 */

import type { WorldSnapshotWire } from "@shared/protocol";
import styles from "./WorldPanel.module.css";

interface WorldPanelProps {
  readonly snapshot: WorldSnapshotWire;
}

export function WorldPanel({ snapshot }: WorldPanelProps): JSX.Element {
  return (
    <div className={styles.panel}>
      <header className={styles.head}>
        <span className={styles.title}>World</span>
        <span className={styles.epoch}>{snapshot.epochId}</span>
      </header>
      <div className={styles.body}>
        <Section label="participants" count={snapshot.participants.length}>
          {snapshot.participants.map((p) => (
            <div key={p.id} className={styles.row}>
              <span className={styles.id}>{p.id}</span>
              <span className={styles.tag} data-status={p.status}>
                {p.status}
              </span>
              <span className={styles.kind}>{p.kind}</span>
            </div>
          ))}
        </Section>

        {snapshot.artifacts.length > 0 && (
          <Section label="artifacts" count={snapshot.artifacts.length}>
            {snapshot.artifacts.map((a) => (
              <div key={a.id} className={styles.row}>
                <span className={styles.id}>{a.id}</span>
                <span className={styles.kind}>{a.kind}</span>
                <span className={styles.tag} data-status={a.lifecycle}>
                  {a.lifecycle}
                </span>
              </div>
            ))}
          </Section>
        )}

        {snapshot.sessions.length > 0 && (
          <Section label="sessions" count={snapshot.sessions.length}>
            {snapshot.sessions.map((s) => (
              <div key={s.id} className={styles.row}>
                <span className={styles.id}>{s.id}</span>
                <span className={styles.kind}>by {s.initiator}</span>
                <span className={styles.tag} data-status={s.status}>
                  {s.status}
                </span>
              </div>
            ))}
          </Section>
        )}

        {snapshot.capabilities.length > 0 && (
          <Section label="capabilities" count={snapshot.capabilities.length}>
            {snapshot.capabilities.map((c) => (
              <div key={c.id} className={styles.row}>
                <span className={styles.id}>{c.id}</span>
                <span className={styles.kind}>
                  {c.kind} → {c.holder}
                </span>
              </div>
            ))}
          </Section>
        )}

        {snapshot.links.length > 0 && (
          <Section label="links" count={snapshot.links.length}>
            {snapshot.links.map((l, i) => (
              <div key={i} className={styles.row}>
                <span className={styles.id}>
                  {l.from} → {l.to}
                </span>
                <span className={styles.kind}>{l.kind}</span>
              </div>
            ))}
          </Section>
        )}

        {snapshot.auditTail.length > 0 && (
          <Section label="audit tail" count={snapshot.auditTail.length}>
            {snapshot.auditTail.map((a, i) => (
              <div key={i} className={styles.row}>
                <span className={styles.id}>{a.source}</span>
                <span className={styles.kind}>{a.payloadRef.slice(0, 12)}…</span>
              </div>
            ))}
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({
  label,
  count,
  children,
}: {
  readonly label: string;
  readonly count: number;
  readonly children: React.ReactNode;
}): JSX.Element {
  return (
    <section className={styles.section}>
      <span className={styles.sectionLabel}>
        {label} ({count})
      </span>
      {children}
    </section>
  );
}
