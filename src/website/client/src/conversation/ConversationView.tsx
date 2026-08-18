import { useEffect, useRef } from "react";
import { LunarLogo } from "../theme/LunarLogo";
import { NodeRow } from "./NodeRow";
import type { ConversationNode } from "./nodes";
import { TrajectoryView } from "./TrajectoryView";
import styles from "./ConversationView.module.css";

const FOLLOW_THRESHOLD = 24;

interface ConversationViewProps {
  readonly nodes: readonly ConversationNode[];
  readonly onApprove: (toolCallId: string, decision: "allow" | "deny") => void;
  readonly onAskUserReply: (answer: string) => void;
  readonly onSelectNode: (id: string) => void;
  readonly view: "conversation" | "trajectory";
  readonly mode: "execute" | "plan" | "observe";
  readonly sessionTitle: string;
  readonly onViewChange: (view: "conversation" | "trajectory") => void;
  readonly onModeChange: (mode: "execute" | "plan" | "observe") => void;
  readonly onDownloadLog: () => void;
}

export function ConversationView(props: ConversationViewProps): JSX.Element {
  const {
    nodes,
    onApprove,
    onAskUserReply,
    onSelectNode,
    view,
    mode,
    sessionTitle,
    onViewChange,
    onModeChange,
    onDownloadLog,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);
  useEffect(() => {
    const element = scrollRef.current;
    if (element !== null && stick.current) element.scrollTop = element.scrollHeight;
  });

  return (
    <section className={styles.root}>
      <header className={styles.header}>
        <div className={styles.sessionMeta}>
          <strong title={sessionTitle}>{sessionTitle}</strong>
          <label className={styles.mode}>
            <span>◌</span>
            <select
              value={mode}
              onChange={(event) => onModeChange(event.target.value as typeof mode)}
              aria-label="Agent 模式"
            >
              <option value="execute">标准模式</option>
              <option value="plan">规划模式</option>
              <option value="observe">观察模式</option>
            </select>
          </label>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="会话视图">
          <button
            type="button"
            role="tab"
            aria-selected={view === "conversation"}
            className={view === "conversation" ? styles.activeTab : styles.tab}
            onClick={() => onViewChange("conversation")}
          >
            对话
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "trajectory"}
            className={view === "trajectory" ? styles.activeTab : styles.tab}
            onClick={() => onViewChange("trajectory")}
          >
            轨迹
          </button>
        </div>
        <button type="button" className={styles.logButton} onClick={onDownloadLog}>
          Session log <span>⇩</span>
        </button>
      </header>

      {view === "trajectory" ? (
        <TrajectoryView nodes={nodes} onSelectNode={onSelectNode} />
      ) : (
        <div
          className={styles.scroll}
          ref={scrollRef}
          onScroll={() => {
            const element = scrollRef.current;
            if (element !== null)
              stick.current =
                element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_THRESHOLD;
          }}
          role="log"
          aria-label="Agent 对话"
          aria-live="polite"
          tabIndex={0}
        >
          {nodes.length === 0 ? (
            <div className={styles.emptyState}>
              <div className={styles.emptyBrand}>
                <LunarLogo size={30} />
                <span>Cantilune</span>
                <em>HARNESS</em>
              </div>
              <p>选择工作区并连接模型后，开始一段新的运行。</p>
            </div>
          ) : (
            <div className={styles.flow}>
              {nodes.map((node) => (
                <div key={node.id} className={styles.node} onClick={() => onSelectNode(node.id)}>
                  <NodeRow node={node} onApprove={onApprove} onAskUserReply={onAskUserReply} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
