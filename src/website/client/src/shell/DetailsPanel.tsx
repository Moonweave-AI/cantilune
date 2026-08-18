/**
 * DetailsPanel — ADR-0030 §4.4. Shows the selected node's raw detail + the
 * termination-controller/run ledger. Full audit inspector lands in S5.
 */

import type { ConversationNode } from "../conversation/nodes";
import styles from "./DetailsPanel.module.css";

interface DetailsPanelProps {
  readonly selected: ConversationNode | null;
  readonly hideHeader?: boolean;
}

export function DetailsPanel({ selected, hideHeader = false }: DetailsPanelProps): JSX.Element {
  return (
    <div className={hideHeader ? styles.panelCompact : styles.panel}>
      <header className={styles.head}>
        <span className={styles.title}>{"\u68c0\u67e5"}</span>
      </header>
      <div className={styles.body}>
        {selected === null ? (
          <p className={styles.empty}>
            {
              "\u9009\u62e9\u4f1a\u8bdd\u4e2d\u7684\u4e00\u6761\u8bb0\u5f55\uff0c\u5728\u6b64\u67e5\u770b\u5b83\u7684\u8fd0\u884c\u7ec6\u8282\u3002"
            }
          </p>
        ) : (
          <NodeDetail node={selected} />
        )}
      </div>
    </div>
  );
}

function NodeDetail({ node }: { readonly node: ConversationNode }): JSX.Element {
  return (
    <div className={styles.detail}>
      <Row label="kind" value={node.kind} />
      <Row label="turn" value={String(node.turn)} />
      {node.toolName !== undefined && <Row label="tool" value={node.toolName} />}
      {node.verdictKind !== undefined && <Row label="verdict" value={node.verdictKind} />}
      {node.phase !== undefined && <Row label="phase" value={node.phase} />}
      {node.elapsedMs !== undefined && <Row label="elapsed" value={`${node.elapsedMs}ms`} />}
      {node.arguments !== undefined && (
        <Block label="arguments" value={JSON.stringify(node.arguments, null, 2)} />
      )}
      {node.output !== undefined && <Block label="output" value={node.output} />}
      {node.text !== undefined && <Block label="text" value={node.text} />}
      {node.detail !== undefined && <Block label="detail" value={node.detail} />}
    </div>
  );
}

function Row({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div className={styles.row}>
      <span className={styles.rowLabel}>{label}</span>
      <span className={styles.rowValue}>{value}</span>
    </div>
  );
}

function Block({ label, value }: { readonly label: string; readonly value: string }): JSX.Element {
  return (
    <div className={styles.block}>
      <span className={styles.rowLabel}>{label}</span>
      <pre className={styles.blockValue}>{value}</pre>
    </div>
  );
}
