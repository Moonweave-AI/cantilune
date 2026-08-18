import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconDownload, IconFolder } from "../theme/icons";
import { LunarLogo } from "../theme/LunarLogo";
import type { CatalogEntry } from "../persist/store";
import { ApprovalDock, type ApprovalItem } from "./ApprovalDock";
import { Composer } from "./Composer";
import { NodeRow } from "./NodeRow";
import type { ConversationNode } from "./nodes";
import type { RunMode } from "./PermissionSelect";
import { TrajectoryView } from "./TrajectoryView";
import styles from "./ConversationView.module.css";

const FOLLOW_THRESHOLD = 24;
const VISIBLE_NODE_WINDOW = 48;

interface ConversationViewProps {
  readonly nodes: readonly ConversationNode[];
  readonly onApprove: (toolCallId: string, decision: "allow" | "deny") => void;
  readonly onAskUserReply: (answer: string) => void;
  readonly onSelectNode: (id: string) => void;
  readonly view: "conversation" | "trajectory";
  readonly mode: RunMode;
  readonly sessionTitle: string;
  readonly workspaceName: string;
  readonly configured: boolean;
  readonly running: boolean;
  readonly provider: string | undefined;
  readonly model: string | undefined;
  readonly catalog: readonly CatalogEntry[];
  readonly onViewChange: (view: "conversation" | "trajectory") => void;
  readonly onModeChange: (mode: RunMode) => void;
  readonly onDownloadLog: () => void;
  readonly onOpenDetails: () => void;
  readonly onOpenSettings: () => void;
  readonly onOpenModelSettings: () => void;
  readonly onSelectModel: (entry: CatalogEntry) => void;
  readonly onNewSession: () => void;
  readonly onSend: (instruction: string) => void;
  readonly onStop: () => void;
  readonly onAllowAll: () => void;
  readonly onAlwaysAllow: () => void;
  readonly onPickWorkspace: () => void;
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
    workspaceName,
    configured,
    running,
    provider,
    model,
    catalog,
    onViewChange,
    onModeChange,
    onDownloadLog,
    onOpenDetails,
    onOpenSettings,
    onOpenModelSettings,
    onSelectModel,
    onNewSession,
    onSend,
    onStop,
    onAllowAll,
    onAlwaysAllow,
    onPickWorkspace,
  } = props;
  const scrollRef = useRef<HTMLDivElement>(null);
  const seatObserver = useRef<ResizeObserver | null>(null);
  const stick = useRef(true);
  const [follow, setFollow] = useState(true);
  const [composerOpen, setComposerOpen] = useState(false);
  const [showEarlier, setShowEarlier] = useState(false);
  const hero = nodes.length === 0;
  const phase = hero ? "hero" : "active";
  const overlay = view === "trajectory" && composerOpen;
  const usedTokens = nodes.reduce((sum, node) => {
    if (node.usage !== undefined) return sum + node.usage.total;
    const chars = (node.text ?? node.output ?? node.message ?? "").length;
    return sum + Math.ceil(chars / 4);
  }, 0);
  const turns = Math.max(0, ...nodes.map((node) => node.turn));
  const pendingApprovals = useMemo<readonly ApprovalItem[]>(
    () =>
      nodes.flatMap((node) => {
        if (node.kind !== "approval" || node.pending !== true || node.approval === undefined) {
          return [];
        }
        return [node.approval];
      }),
    [nodes],
  );
  const thread = useMemo(() => {
    const filtered = nodes.filter((node) => {
      if (
        node.kind === "run_result" ||
        node.kind === "turn" ||
        node.kind === "diagnostic"
      ) {
        return false;
      }
      if (node.kind === "approval" && node.pending === true) return false;
      if (
        (node.kind === "assistant" || node.kind === "reasoning") &&
        (node.text ?? "").trim().length === 0 &&
        node.pending !== true
      ) {
        return false;
      }
      return true;
    });
    if (showEarlier || filtered.length <= VISIBLE_NODE_WINDOW) return filtered;
    return filtered.slice(-VISIBLE_NODE_WINDOW);
  }, [nodes, showEarlier]);
  const hiddenCount = useMemo(() => {
    const total = nodes.filter((node) => {
      if (node.kind === "run_result" || node.kind === "turn" || node.kind === "diagnostic") {
        return false;
      }
      if (node.kind === "approval" && node.pending === true) return false;
      return true;
    }).length;
    return Math.max(0, total - thread.length);
  }, [nodes, thread.length]);

  const seatResizeRef = useCallback((seat: HTMLDivElement | null) => {
    seatObserver.current?.disconnect();
    seatObserver.current = null;
    const scroller = seat?.parentElement ?? null;
    if (seat === null || scroller === null) return;
    let last = -1;
    const apply = () => {
      const height = seat.offsetHeight;
      if (height === last) return;
      last = height;
      scroller.style.setProperty("--cln-composer-height", `${height}px`);
    };
    seatObserver.current = new ResizeObserver(apply);
    seatObserver.current.observe(seat);
    apply();
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (element !== null && stick.current && view === "conversation") {
      element.scrollTop = element.scrollHeight;
    }
  }, [nodes, view]);

  return (
    <div className={styles.root} data-phase={phase}>
      <header className={hero ? styles.headerHidden : styles.header}>
        <div className={styles.titleRow}>
          <div className={styles.crumbs}>
            <span className={styles.crumb}>{workspaceName}</span>
            <span className={styles.crumbSep}>/</span>
            <strong className={styles.crumbCurrent} title={sessionTitle}>
              {sessionTitle}
            </strong>
          </div>
          <div className={styles.headerUtilities}>
            <button type="button" className={styles.logButton} onClick={onOpenDetails}>
              检查
            </button>
            <button type="button" className={styles.logButton} onClick={onDownloadLog}>
              <IconDownload size={13} />
              Session log
            </button>
          </div>
        </div>
        <div className={styles.tabs} role="tablist" aria-label="会话视图">
          <button
            type="button"
            role="tab"
            aria-selected={view === "conversation"}
            className={view === "conversation" ? styles.tabActive : styles.tab}
            onClick={() => onViewChange("conversation")}
          >
            对话
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === "trajectory"}
            className={view === "trajectory" ? styles.tabActive : styles.tab}
            onClick={() => onViewChange("trajectory")}
          >
            轨迹
          </button>
        </div>
      </header>

      <div
        className={styles.scrollBody}
        ref={scrollRef}
        data-conversation-scroll=""
        onScroll={() => {
          const element = scrollRef.current;
          if (element === null) return;
          const next =
            element.scrollHeight - element.scrollTop - element.clientHeight < FOLLOW_THRESHOLD;
          if (stick.current === next) return;
          stick.current = next;
          setFollow(next);
        }}
      >
        {view === "trajectory" ? (
          <div
            className={styles.viewArea}
            data-conversation-composer-overlay={overlay || undefined}
          >
            <TrajectoryView
              nodes={nodes}
              onSelectNode={onSelectNode}
              compactDock={!composerOpen}
            />
          </div>
        ) : (
          <div className={styles.viewArea} role="log" aria-label="Agent 对话" aria-live="polite">
            {hero ? null : (
              <div className={styles.flow}>
                {hiddenCount > 0 && (
                  <button
                    type="button"
                    className={styles.showEarlier}
                    onClick={() => setShowEarlier(true)}
                  >
                    显示更早的 {hiddenCount} 条记录
                  </button>
                )}
                {thread.map((node) => (
                  <div
                    key={node.id}
                    className={styles.node}
                    data-kind={node.kind}
                    onClick={(event) => {
                      const target = event.target;
                      if (
                        target instanceof Element &&
                        target.closest("button, a, input, textarea, pre, details") !== null
                      ) {
                        return;
                      }
                      onSelectNode(node.id);
                    }}
                  >
                    <NodeRow node={node} onApprove={onApprove} onAskUserReply={onAskUserReply} />
                  </div>
                ))}
                {nodes
                  .filter((node) => node.kind === "run_result")
                  .map((node) => (
                    <div key={node.id} className={styles.controllerDock}>
                      <NodeRow node={node} onApprove={onApprove} onAskUserReply={onAskUserReply} />
                    </div>
                  ))}
              </div>
            )}
          </div>
        )}
        <div ref={seatResizeRef} className={styles.composerSeat} data-composer-seat="">
          <div className={`${styles.composerStack} ${hero ? styles.composerHero : ""}`}>
            {hero && <HeroGlow className={styles.heroGlow ?? ""} />}
            {hero && (
              <div className={styles.headline}>
                <LunarLogo size={34} />
                <span>Cantilune</span>
                <em>HARNESS</em>
              </div>
            )}
            {hero && (
              <div className={styles.heroWorkspaceRow}>
                <button type="button" className={styles.workspaceChip} onClick={onPickWorkspace}>
                  <IconFolder size={16} />
                  <span>{workspaceName}</span>
                </button>
              </div>
            )}
            <ApprovalDock
              items={pendingApprovals}
              onAllow={(toolCallId) => onApprove(toolCallId, "allow")}
              onDeny={(toolCallId) => onApprove(toolCallId, "deny")}
              onAlways={onAlwaysAllow}
              onAllowAll={onAllowAll}
            />
            {view === "trajectory" && !hero && (
              <button
                type="button"
                className={styles.composerToggle}
                aria-expanded={composerOpen}
                onClick={() => setComposerOpen((open) => !open)}
              >
                {composerOpen ? "收起输入" : "显示输入"}
              </button>
            )}
            {(hero || view !== "trajectory" || composerOpen) && (
            <Composer
              configured={configured}
              running={running}
              provider={provider}
              model={model}
              catalog={catalog}
              hero={hero}
              overlay={overlay}
              mode={mode}
              usedTokens={usedTokens}
              turns={turns}
              steps={nodes.length}
              workspaceName={workspaceName}
              onModeChange={onModeChange}
              onSend={onSend}
              onStop={onStop}
              onOpenSettings={onOpenSettings}
              onOpenModelSettings={onOpenModelSettings}
              onSelectModel={onSelectModel}
              onNewSession={onNewSession}
              onDownloadLog={onDownloadLog}
            />
            )}
          </div>
        </div>
      </div>
      {!hero && view === "conversation" && !follow && (
        <button
          type="button"
          className={styles.jump}
          aria-label="滚动到最新"
          onClick={() => {
            stick.current = true;
            setFollow(true);
            const element = scrollRef.current;
            if (element !== null) element.scrollTop = element.scrollHeight;
          }}
        >
          <IconChevronDown size={16} />
        </button>
      )}
    </div>
  );
}

function HeroGlow({ className }: { readonly className: string }): JSX.Element {
  return <div className={className} aria-hidden="true" />;
}
