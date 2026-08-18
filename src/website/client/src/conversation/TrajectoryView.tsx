import { useEffect, useMemo, useState } from "react";
import type { ConversationNode } from "./nodes";
import styles from "./TrajectoryView.module.css";

interface TrajectoryViewProps {
  readonly nodes: readonly ConversationNode[];
  readonly onSelectNode: (id: string) => void;
}

type TimelineMode = "duration" | "turns" | "calls";
type DetailTab = "summary" | "payload" | "result" | "schema";

export function TrajectoryView({ nodes, onSelectNode }: TrajectoryViewProps): JSX.Element {
  const [mode, setMode] = useState<TimelineMode>("duration");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(nodes.at(-1)?.id ?? null);
  const [detailTab, setDetailTab] = useState<DetailTab>("summary");
  useEffect(() => {
    if (selectedId === null && nodes.length > 0) setSelectedId(nodes.at(-1)?.id ?? null);
  }, [nodes, selectedId]);
  const visible = useMemo(
    () => nodes.filter((node) => searchable(node).includes(query.trim().toLowerCase())),
    [nodes, query],
  );
  const selected = nodes.find((node) => node.id === selectedId) ?? visible.at(-1) ?? null;
  const select = (node: ConversationNode) => {
    setSelectedId(node.id);
    onSelectNode(node.id);
  };

  if (nodes.length === 0)
    return (
      <div className={styles.empty}>第一次运行后，这里会显示完整的模型、推理与工具调用轨迹。</div>
    );

  return (
    <section className={styles.root} aria-label="运行轨迹">
      <header className={styles.toolbar} role="toolbar" aria-label="轨迹工具栏">
        <div className={styles.modeTabs}>
          <ModeButton active={mode === "duration"} onClick={() => setMode("duration")}>
            ◷ Duration
          </ModeButton>
          <ModeButton active={mode === "turns"} onClick={() => setMode("turns")}>
            ▣ Turns
          </ModeButton>
          <ModeButton active={mode === "calls"} onClick={() => setMode("calls")}>
            ▤ Calls
          </ModeButton>
        </div>
        <label className={styles.search}>
          <span>⌕</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索"
            aria-label="搜索轨迹"
          />
        </label>
      </header>
      <Timeline nodes={nodes} mode={mode} selectedId={selected?.id ?? null} onSelect={select} />
      <div className={styles.ledger}>
        <div className={styles.tablePane}>
          {visible.map((node, index) => (
            <TrajectoryRow
              key={node.id}
              node={node}
              step={index + 1}
              selected={node.id === selected?.id}
              onClick={() => select(node)}
            />
          ))}
          {visible.length === 0 && <p className={styles.noMatches}>没有匹配的运行事件。</p>}
        </div>
        <TrajectoryInspector
          node={selected}
          tab={detailTab}
          onTabChange={setDetailTab}
          onClose={() => setSelectedId(null)}
        />
      </div>
    </section>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  readonly active: boolean;
  readonly onClick: () => void;
  readonly children: string;
}): JSX.Element {
  return (
    <button
      type="button"
      className={active ? styles.modeActive : styles.modeButton}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function Timeline({
  nodes,
  mode,
  selectedId,
  onSelect,
}: {
  readonly nodes: readonly ConversationNode[];
  readonly mode: TimelineMode;
  readonly selectedId: string | null;
  readonly onSelect: (node: ConversationNode) => void;
}): JSX.Element {
  const width = (node: ConversationNode): number =>
    mode === "turns"
      ? 1
      : mode === "calls"
        ? node.kind === "tool_call"
          ? 2.2
          : 0.6
        : Math.max(0.6, Math.min(3.5, (node.elapsedMs ?? node.text?.length ?? 12) / 25));
  return (
    <div className={styles.timeline}>
      {(["Input", "Model", "Tools"] as const).map((lane) => (
        <div className={styles.lane} key={lane}>
          <span>{lane}</span>
          <div className={styles.track}>
            {nodes.map((node) => {
              const kind = laneKind(node, lane);
              return (
                <button
                  type="button"
                  aria-label={`${lane} ${labelFor(node)}`}
                  key={`${lane}-${node.id}`}
                  data-kind={kind}
                  data-selected={node.id === selectedId || undefined}
                  style={{ flexGrow: width(node) }}
                  onClick={() => onSelect(node)}
                />
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function TrajectoryRow({
  node,
  step,
  selected,
  onClick,
}: {
  readonly node: ConversationNode;
  readonly step: number;
  readonly selected: boolean;
  readonly onClick: () => void;
}): JSX.Element {
  return (
    <button
      type="button"
      className={styles.row}
      data-selected={selected || undefined}
      data-kind={node.kind}
      onClick={onClick}
    >
      <span className={styles.turn}>
        Turn {node.turn || 1}
        <i />
      </span>
      <span className={styles.kind}>
        {glyphFor(node)}
        <em>{labelFor(node)}</em>
      </span>
      <span className={styles.rowContent}>
        <strong>{summaryFor(node)}</strong>
        {node.toolName !== undefined && <small>{node.toolName}</small>}
      </span>
      <span className={styles.step}>Step {step}</span>
    </button>
  );
}

function TrajectoryInspector({
  node,
  tab,
  onTabChange,
  onClose,
}: {
  readonly node: ConversationNode | null;
  readonly tab: DetailTab;
  readonly onTabChange: (tab: DetailTab) => void;
  readonly onClose: () => void;
}): JSX.Element {
  if (node === null)
    return (
      <aside className={styles.inspector}>
        <p>选择一个事件以查看详情。</p>
      </aside>
    );
  const payload = node.arguments ?? (node.text !== undefined ? { text: node.text } : {});
  const result =
    node.output ?? node.runResult?.summary ?? node.detail ?? node.message ?? "尚无返回内容";
  return (
    <aside className={styles.inspector}>
      <header>
        <span data-kind={node.kind}>{labelFor(node).toUpperCase()}</span>
        <small>Turn {node.turn || 1}</small>
        <button type="button" onClick={onClose} aria-label="关闭详情">
          ×
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
            <dd>{node.ok === false || node.kind === "error" ? "Failed" : "Completed"}</dd>
            <dt>时长</dt>
            <dd>{node.elapsedMs === undefined ? "—" : `${node.elapsedMs} ms`}</dd>
            {node.toolName !== undefined && (
              <>
                <dt>工具</dt>
                <dd>{node.toolName}</dd>
              </>
            )}
          </dl>
        )}
        {tab === "payload" && <pre>{JSON.stringify(payload, null, 2)}</pre>}
        {tab === "result" && <pre>{result}</pre>}
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

function laneKind(node: ConversationNode, lane: "Input" | "Model" | "Tools"): string {
  if (lane === "Input") return node.kind === "user" ? "input" : "idle";
  if (lane === "Tools") return node.kind === "tool_call" ? "tool" : "idle";
  return ["assistant", "reasoning", "diagnostic", "turn"].includes(node.kind) ? "model" : "idle";
}
function glyphFor(node: ConversationNode): string {
  return node.kind === "tool_call"
    ? "⌁"
    : node.kind === "reasoning"
      ? "✦"
      : node.kind === "error"
        ? "!"
        : "·";
}
function labelFor(node: ConversationNode): string {
  if (node.kind === "tool_call") return node.ok === false ? "工具失败" : "工具";
  if (node.kind === "reasoning") return "思考";
  if (node.kind === "assistant") return "助手消息";
  if (node.kind === "user") return "用户消息";
  if (node.kind === "run_result") return "运行结果";
  if (node.kind === "error") return "错误";
  return node.kind.replace("_", " ");
}
function summaryFor(node: ConversationNode): string {
  const text =
    node.text ??
    node.output ??
    node.detail ??
    node.message ??
    node.question ??
    node.runResult?.summary ??
    node.lastAction ??
    "运行事件";
  return text.replace(/\s+/g, " ");
}
function searchable(node: ConversationNode): string {
  return `${labelFor(node)} ${summaryFor(node)} ${node.toolName ?? ""}`.toLowerCase();
}
function tabLabel(tab: DetailTab): string {
  return { summary: "摘要", payload: "载荷", result: "结果", schema: "定义" }[tab];
}
function schemaFor(node: ConversationNode): string {
  return node.toolName === undefined
    ? "该事件没有独立工具定义。"
    : "工具参数与执行结果会在这里按当前运行事件展示。";
}
