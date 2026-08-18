import { useEffect, useMemo, useState } from "react";
import { IconClock, IconClose, IconCopy, IconSearch, IconThink, IconTool } from "../theme/icons";
import type { ConversationNode } from "./nodes";
import {
  buildTrajectory,
  formatDuration,
  labelFor,
  searchable,
  schemaFor,
  summaryFor,
  type TimelineLane,
} from "./trajectoryModel";
import styles from "./TrajectoryView.module.css";

interface TrajectoryViewProps {
  readonly nodes: readonly ConversationNode[];
  readonly onSelectNode: (id: string) => void;
  readonly compactDock?: boolean;
}

type DetailTab = "summary" | "payload" | "result" | "schema";

const LANES: readonly { readonly id: TimelineLane; readonly label: string }[] = [
  { id: "input", label: "Input" },
  { id: "model", label: "Model" },
  { id: "tools", label: "Tools" },
];

export function TrajectoryView({
  nodes,
  onSelectNode,
  compactDock = false,
}: TrajectoryViewProps): JSX.Element {
  const [actualDuration, setActualDuration] = useState(true);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(nodes.at(-1)?.id ?? null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [hoverX, setHoverX] = useState<number | null>(null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  const [now, setNow] = useState(() => Date.now());
  const [collapsedTurns, setCollapsedTurns] = useState<ReadonlySet<number>>(new Set());
  const [callsCollapsed, setCallsCollapsed] = useState(false);

  const live = nodes.some((node) => node.pending === true);
  useEffect(() => {
    if (!live) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [live]);

  useEffect(() => {
    if (selectedId === null && nodes.length > 0) setSelectedId(nodes.at(-1)?.id ?? null);
  }, [nodes, selectedId]);

  const model = useMemo(
    () => buildTrajectory(nodes, actualDuration ? "duration" : "sequence", now),
    [actualDuration, nodes, now],
  );
  const visible = useMemo(
    () =>
      nodes.filter((node) => {
        if (callsCollapsed && (node.kind === "tool_call" || node.kind === "approval")) return false;
        return searchable(node).includes(query.trim().toLowerCase());
      }),
    [callsCollapsed, nodes, query],
  );
  const groups = useMemo(() => {
    const map = new Map<number, ConversationNode[]>();
    for (const node of visible) {
      const turn = node.turn || 0;
      const list = map.get(turn) ?? [];
      list.push(node);
      map.set(turn, list);
    }
    return [...map.entries()].sort((left, right) => left[0] - right[0]);
  }, [visible]);
  const selected = nodes.find((node) => node.id === selectedId) ?? visible.at(-1) ?? null;
  const selectedSpan = model.spans.find((span) => span.id === selected?.id);
  const allTurnsCollapsed = groups.length > 0 && groups.every(([turn]) => collapsedTurns.has(turn));

  const select = (node: ConversationNode) => {
    setSelectedId(node.id);
    onSelectNode(node.id);
  };

  if (nodes.length === 0) {
    return (
      <div className={styles.empty}>
        <strong>还没有运行轨迹</strong>
        <p>第一次运行后，这里会按时间轴展开模型、推理与工具调用。</p>
      </div>
    );
  }

  return (
    <section
      className={styles.root}
      aria-label="运行轨迹"
      data-compact-dock={compactDock || undefined}
    >
      <header className={styles.toolbar} role="toolbar" aria-label="轨迹工具栏">
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.toggle}
            aria-pressed={actualDuration}
            title={actualDuration ? "按占用时长排列（压缩空闲空档）" : "改用占用时长"}
            onClick={() => setActualDuration((value) => !value)}
          >
            <IconClock size={12} />
            Duration
          </button>
          <button
            type="button"
            className={styles.action}
            aria-pressed={allTurnsCollapsed}
            title={allTurnsCollapsed ? "展开全部回合" : "折叠全部回合"}
            onClick={() =>
              setCollapsedTurns(
                allTurnsCollapsed ? new Set() : new Set(groups.map(([turn]) => turn)),
              )
            }
          >
            <span aria-hidden>{allTurnsCollapsed ? "⊞" : "⊟"}</span>
            Turns
          </button>
          <button
            type="button"
            className={styles.action}
            aria-pressed={callsCollapsed}
            title={callsCollapsed ? "展开工具调用" : "折叠工具调用"}
            onClick={() => setCallsCollapsed((value) => !value)}
          >
            <span aria-hidden>{callsCollapsed ? "⊞" : "⊟"}</span>
            Calls
          </button>
        </div>
        <label className={styles.search}>
          <IconSearch size={11} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search"
            aria-label="搜索轨迹"
          />
        </label>
      </header>

      <div
        className={styles.timeline}
        onMouseLeave={() => {
          setHoveredId(null);
          setHoverX(null);
        }}
      >
        <div className={styles.laneLabels}>
          {LANES.map((lane) => (
            <span key={lane.id}>{lane.label}</span>
          ))}
        </div>
        <div
          className={styles.track}
          onMouseMove={(event) => {
            const rect = event.currentTarget.getBoundingClientRect();
            setHoverX(((event.clientX - rect.left) / rect.width) * 100);
          }}
        >
          {model.spans.map((span) => (
            <button
              key={span.id}
              type="button"
              className={styles.span}
              data-lane={span.lane}
              data-error={span.error || undefined}
              data-pending={span.pending || undefined}
              data-selected={span.id === selected?.id || undefined}
              data-dimmed={
                selected !== null && span.id !== selected.id && hoveredId !== span.id
                  ? true
                  : undefined
              }
              style={{
                ["--cln-span-left" as string]: `${span.start * 100}%`,
                ["--cln-span-width" as string]: `${Math.max(0.35, (span.end - span.start) * 100)}%`,
                ["--cln-span-lane" as string]: String(
                  span.lane === "input" ? 0 : span.lane === "model" ? 1 : 2,
                ),
              }}
              aria-label={`${span.lane} ${labelFor(nodes.find((node) => node.id === span.id) ?? nodes[0]!)}`}
              onMouseEnter={() => setHoveredId(span.id)}
              onClick={() => {
                const node = nodes.find((item) => item.id === span.id);
                if (node !== undefined) select(node);
              }}
            />
          ))}
          {hoverX !== null && <i className={styles.hoverLine} style={{ left: `${hoverX}%` }} />}
          {selectedSpan !== undefined && (
            <b
              className={styles.selection}
              style={{
                ["--cln-span-left" as string]: `${selectedSpan.start * 100}%`,
                ["--cln-span-width" as string]: `${Math.max(0.4, (selectedSpan.end - selectedSpan.start) * 100)}%`,
              }}
            />
          )}
        </div>
        <div className={styles.ticks}>
          <span />
          <div>
            {model.ticks.map((tick) => (
              <em key={tick}>{actualDuration ? formatDuration(tick) : String(tick)}</em>
            ))}
          </div>
        </div>
      </div>

      <div className={styles.ledger}>
        <div className={styles.tablePane}>
          <table className={styles.table}>
            <colgroup>
              <col className={styles.eventColumn} />
              <col />
            </colgroup>
            <thead>
              <tr>
                <th className={styles.eventHeader}>Event</th>
                <th>Content</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(([turn, rows]) => {
                const folded = collapsedTurns.has(turn);
                return (
                  <TurnBlock
                    key={turn}
                    turn={turn}
                    rows={rows}
                    folded={folded}
                    selectedId={selected?.id ?? null}
                    durationOf={(id) => model.spans.find((span) => span.id === id)?.durationMs ?? 0}
                    onToggle={() =>
                      setCollapsedTurns((previous) => {
                        const next = new Set(previous);
                        if (next.has(turn)) next.delete(turn);
                        else next.add(turn);
                        return next;
                      })
                    }
                    onSelect={select}
                  />
                );
              })}
            </tbody>
          </table>
          {visible.length === 0 && <p className={styles.noMatches}>没有匹配的运行事件。</p>}
        </div>
        <TrajectoryInspector
          node={selected}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setSelectedId(null)}
          durationMs={selectedSpan?.durationMs}
        />
      </div>
    </section>
  );
}

function TurnBlock({
  turn,
  rows,
  folded,
  selectedId,
  durationOf,
  onToggle,
  onSelect,
}: {
  readonly turn: number;
  readonly rows: readonly ConversationNode[];
  readonly folded: boolean;
  readonly selectedId: string | null;
  readonly durationOf: (id: string) => number;
  readonly onToggle: () => void;
  readonly onSelect: (node: ConversationNode) => void;
}): JSX.Element {
  return (
    <>
      <tr className={styles.turnStart} data-turn-start="true">
        <td colSpan={2}>
          <button type="button" className={styles.groupHead} onClick={onToggle}>
            <span>Turn {turn || 1}</span>
            <small>
              {rows.length} ·{" "}
              {formatDuration(rows.reduce((sum, node) => sum + durationOf(node.id), 0))}
            </small>
          </button>
        </td>
      </tr>
      {folded ? (
        <tr data-collapsed-summary="">
          <td>
            <div className={styles.eventInner}>回合</div>
          </td>
          <td>
            <div className={styles.contentInner}>
              <span className={styles.contentText}>{rows.length} 步已折叠</span>
            </div>
          </td>
        </tr>
      ) : (
        rows.map((node) => (
          <tr
            key={node.id}
            className={styles.row}
            data-selected={node.id === selectedId || undefined}
            data-kind={node.kind}
            data-error={node.ok === false || node.kind === "error" || undefined}
            onClick={() => onSelect(node)}
          >
            <td>
              <div className={styles.eventInner}>
                {node.kind === "tool_call" || node.kind === "approval" ? (
                  <IconTool size={12} />
                ) : node.kind === "reasoning" ? (
                  <IconThink size={12} />
                ) : (
                  <i />
                )}
                {labelFor(node)}
              </div>
            </td>
            <td className={styles.contentCell}>
              <div className={styles.contentInner}>
                <span className={styles.contentText}>{summaryFor(node)}</span>
                <em>{formatDuration(durationOf(node.id))}</em>
              </div>
            </td>
          </tr>
        ))
      )}
    </>
  );
}

function TrajectoryInspector({
  node,
  tab,
  onTabChange,
  onClose,
  durationMs,
}: {
  readonly node: ConversationNode | null;
  readonly tab: DetailTab;
  readonly onTabChange: (tab: DetailTab) => void;
  readonly onClose: () => void;
  readonly durationMs: number | undefined;
}): JSX.Element {
  if (node === null) {
    return (
      <aside className={styles.inspector}>
        <p>选择一个事件以查看详情。</p>
      </aside>
    );
  }
  const payload = node.arguments ?? (node.text !== undefined ? { text: node.text } : {});
  const result =
    node.output ?? node.runResult?.summary ?? node.detail ?? node.message ?? "尚无返回内容";
  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* clipboard may be blocked */
    }
  };
  return (
    <aside className={styles.inspector}>
      <header>
        <span data-kind={node.kind}>{labelFor(node)}</span>
        <small>Turn {node.turn || 1}</small>
        <button type="button" onClick={onClose} aria-label="关闭详情">
          <IconClose size={14} />
        </button>
      </header>
      <nav role="tablist">
        {(["summary", "payload", "result", "schema"] as const).map((item) => (
          <button
            type="button"
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? styles.inspectorTabActive : styles.inspectorTab}
            onClick={() => onTabChange(item)}
          >
            {tabLabel(item)}
          </button>
        ))}
      </nav>
      <div className={styles.inspectorBody}>
        {tab === "summary" && (
          <dl>
            <dt>层级</dt>
            <dd>Assistant Message › {labelFor(node)}</dd>
            <dt>状态</dt>
            <dd>
              {node.pending === true
                ? "进行中"
                : node.ok === false || node.kind === "error"
                  ? "失败"
                  : "完成"}
            </dd>
            <dt>时长</dt>
            <dd>{durationMs === undefined ? "—" : formatDuration(durationMs)}</dd>
            {node.toolName !== undefined && (
              <>
                <dt>工具</dt>
                <dd>{node.toolName}</dd>
              </>
            )}
            {node.usage !== undefined && (
              <>
                <dt>Tokens</dt>
                <dd>
                  {node.usage.prompt} → {node.usage.completion} / {node.usage.total}
                </dd>
              </>
            )}
          </dl>
        )}
        {tab === "payload" && (
          <div className={styles.preWrap}>
            <button
              type="button"
              className={styles.copy}
              onClick={() => void copy(JSON.stringify(payload, null, 2))}
              aria-label="复制载荷"
            >
              <IconCopy size={12} />
            </button>
            <pre>{JSON.stringify(payload, null, 2)}</pre>
          </div>
        )}
        {tab === "result" && (
          <div className={styles.preWrap}>
            <button
              type="button"
              className={styles.copy}
              onClick={() => void copy(result)}
              aria-label="复制结果"
            >
              <IconCopy size={12} />
            </button>
            <pre>{result}</pre>
          </div>
        )}
        {tab === "schema" && (
          <div className={styles.schema}>
            <strong>{node.toolName ?? labelFor(node)}</strong>
            <p>{schemaFor(node)}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

function tabLabel(tab: DetailTab): string {
  return { summary: "摘要", payload: "载荷", result: "结果", schema: "定义" }[tab];
}
