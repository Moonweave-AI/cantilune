/**
 * NodeRow — routes a conversation node by kind to its renderer (ADR-0030 §4.2).
 * Each renderer makes one packages concept legible.
 */

import type { ConversationNode } from "./nodes";
import type { ControlVerdictKindWire, TerminationAuditWire } from "@shared/protocol";
import styles from "./NodeRow.module.css";

interface NodeRowProps {
  readonly node: ConversationNode;
  readonly onApprove: (toolCallId: string, decision: "allow" | "deny") => void;
  readonly onAskUserReply: (answer: string) => void;
}

const VERDICT_LABEL: Record<ControlVerdictKindWire, string> = {
  DONE: "Done",
  CONTINUE: "Continue",
  VERIFY: "Verify",
  ASK_USER: "Ask User",
  REPLAN: "Replan",
  STALLED: "Stalled",
};

export function NodeRow({ node, onApprove, onAskUserReply }: NodeRowProps): JSX.Element {
  switch (node.kind) {
    case "user":
      return (
        <div className={styles.user}>
          <div className={styles.userBubble}>{node.text}</div>
        </div>
      );

    case "assistant":
      return <div className={styles.assistant}>{renderMarkdown(node.text)}</div>;

    case "reasoning":
      return (
        <details className={styles.reasoning} open={node.pending}>
          <summary>
            <span className={styles.reasoningLabel}>Think{node.pending ? "…" : ""}</span>
          </summary>
          <div className={`${styles.reasoningBody} ${node.pending ? styles.reasoningPending : ""}`}>
            {node.text}
          </div>
        </details>
      );

    case "tool_call":
      return (
        <div className={styles.toolCall}>
          <div className={styles.toolHead}>
            <span className={styles.toolIcon}>{node.coordination ? "⇄" : "⚙"}</span>
            <span className={styles.toolName}>{node.toolName}</span>
            {node.pending ? (
              <span className={styles.toolPending}>running…</span>
            ) : (
              <span className={node.ok ? styles.toolOk : styles.toolFail}>
                {node.ok ? "ok" : "failed"}
              </span>
            )}
          </div>
          {node.arguments !== undefined && (
            <pre className={styles.toolArgs}>{JSON.stringify(node.arguments, null, 2)}</pre>
          )}
          {node.output !== undefined && <pre className={styles.toolOutput}>{node.output}</pre>}
        </div>
      );

    case "control_verdict":
      return (
        <div className={styles.verdict}>
          <div className={styles.verdictHead}>
            <span className={styles.verdictChip} data-kind={node.verdictKind}>
              {VERDICT_LABEL[node.verdictKind ?? "CONTINUE"]}
            </span>
            {node.verdictReason !== undefined && (
              <span className={styles.verdictReason}>{node.verdictReason}</span>
            )}
          </div>
          {node.missingEvidence !== undefined && node.missingEvidence.length > 0 && (
            <div className={styles.verdictMissing}>
              <span className={styles.verdictMissingLabel}>missing evidence:</span>
              <ul>
                {node.missingEvidence.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}
          {node.audit !== undefined && <AuditView audit={node.audit} />}
        </div>
      );

    case "ask_user":
      return (
        <div className={styles.askUser}>
          <div className={styles.askQuestion}>{node.question}</div>
          {node.pending ? (
            <AskUserInput options={node.options} onReply={onAskUserReply} />
          ) : (
            <div className={styles.askAnswer}>{node.text}</div>
          )}
        </div>
      );

    case "approval":
      return node.approval !== undefined ? (
        <div className={styles.approval}>
          <div className={styles.approvalHead}>
            <span className={styles.approvalTier}>tier: {node.approval.tier}</span>
            <span className={styles.approvalName}>{node.approval.name}</span>
          </div>
          <pre className={styles.toolArgs}>{JSON.stringify(node.approval.arguments, null, 2)}</pre>
          {node.pending ? (
            <div className={styles.approvalActions}>
              <button
                className={styles.approveBtn}
                onClick={() => onApprove(node.approval!.toolCallId, "allow")}
              >
                Allow
              </button>
              <button
                className={styles.denyBtn}
                onClick={() => onApprove(node.approval!.toolCallId, "deny")}
              >
                Deny
              </button>
            </div>
          ) : (
            <span className={styles.resolvedBadge}>resolved</span>
          )}
        </div>
      ) : (
        <></>
      );

    case "diagnostic":
      return (
        <div className={styles.diagnostic}>
          <span className={styles.diagTag}>diagnostic · {node.phase}</span>
          <span>{node.message}</span>
        </div>
      );

    case "turn":
      return (
        <div className={styles.turn}>
          <span className={styles.turnLabel}>turn {node.turn}</span>
          {node.lastAction !== undefined && (
            <span className={styles.turnAction}>{node.lastAction}</span>
          )}
          {node.elapsedMs !== undefined && (
            <span className={styles.turnTime}>{formatMs(node.elapsedMs)}</span>
          )}
        </div>
      );

    case "error":
      return (
        <div className={styles.error}>
          <span className={styles.errorTag}>error · {node.phase ?? "—"}</span>
          <span>{node.message}</span>
          {node.detail !== undefined && <pre className={styles.errorDetail}>{node.detail}</pre>}
        </div>
      );

    case "run_result":
      return node.runResult !== undefined ? <RunResultRow result={node.runResult} /> : <></>;
  }
}

function RunResultRow({
  result,
}: {
  readonly result: NonNullable<ConversationNode["runResult"]>;
}): JSX.Element {
  return (
    <div className={styles.runResult} data-ok={result.ok}>
      <div className={styles.runResultHead}>
        <span className={styles.runResultBadge}>{result.ok ? "✓ complete" : "✗ ended"}</span>
        <span className={styles.runResultReason}>{result.terminationReason ?? "—"}</span>
      </div>
      <div className={styles.runResultSummary}>{result.summary}</div>
      <div className={styles.runResultStats}>
        <span>{result.turns} turns</span>
        <span>{formatMs(result.elapsedMs)}</span>
        <span>
          {result.operations.committed} committed / {result.operations.rejected} rejected
        </span>
        <span>
          tools {result.toolCalls.succeeded}/{result.toolCalls.total} ok ·{" "}
          {result.toolCalls.unresolved} unresolved
        </span>
      </div>
    </div>
  );
}

function AskUserInput({
  options,
  onReply,
}: {
  readonly options: readonly string[] | undefined;
  readonly onReply: (answer: string) => void;
}): JSX.Element {
  return (
    <div className={styles.askInput}>
      {options !== undefined && options.length > 0 ? (
        options.map((opt) => (
          <button key={opt} className={styles.askOption} onClick={() => onReply(opt)}>
            {opt}
          </button>
        ))
      ) : (
        <AskUserFreeText onReply={onReply} />
      )}
    </div>
  );
}

function AskUserFreeText({ onReply }: { readonly onReply: (answer: string) => void }): JSX.Element {
  return (
    <form
      className={styles.askForm}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const value = String(data.get("answer") ?? "");
        if (value.length > 0) onReply(value);
      }}
    >
      <input
        name="answer"
        className={styles.askInputField}
        placeholder="Reply…"
        autoComplete="off"
      />
      <button type="submit" className={styles.askSubmit}>
        Send
      </button>
    </form>
  );
}

function AuditView({ audit }: { readonly audit: TerminationAuditWire }): JSX.Element {
  const fmt = (n: number) => n.toFixed(2);
  return (
    <details className={styles.audit}>
      <summary>termination audit</summary>
      <div className={styles.auditGrid}>
        <span>
          <b>H</b> hard gate: <code>{audit.H}</code>
        </span>
        <span>
          <b>C</b> completion: <code>{fmt(audit.C)}</code>
        </span>
        <span>
          <b>U</b> uncertainty: <code>{fmt(audit.U)}</code>
        </span>
        <span>
          <b>VOC*</b> continuation: <code>{fmt(audit.VOCstar)}</code>
        </span>
      </div>
      {audit.criterionEvals.length > 0 && (
        <table className={styles.auditTable}>
          <thead>
            <tr>
              <th>id</th>
              <th>kind</th>
              <th>weight</th>
              <th>ρ</th>
              <th>satisfied</th>
            </tr>
          </thead>
          <tbody>
            {audit.criterionEvals.map((e) => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.kind}</td>
                <td>{e.weight}</td>
                <td>{e.rho !== undefined ? fmt(e.rho) : "—"}</td>
                <td>{e.satisfied ? "✓" : "✗"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {audit.decisionChain.length > 0 && (
        <div className={styles.auditChain}>
          <span className={styles.auditChainLabel}>decision chain:</span>
          <ol>
            {audit.decisionChain.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </details>
  );
}

function renderMarkdown(text: string | undefined): JSX.Element {
  if (text === undefined) return <></>;
  return <div className={styles.markdown}>{markdownToJsx(text)}</div>;
}

/** Minimal, dependency-free Markdown → React renderer (ADR-0030 §4.2). */
function markdownToJsx(src: string): readonly JSX.Element[] {
  const blocks = src.split(/\n{2,}/);
  return blocks.map((block, i) => {
    const trimmed = block.trim();
    if (trimmed.length === 0) return <div key={i} className={styles.mdSpacer} />;
    // fenced code block
    const fence = trimmed.match(/^```(\w*)\n([\s\S]*?)```$/);
    if (fence !== null) {
      return (
        <pre key={i} className={styles.mdCodeBlock}>
          <code>{fence[2]}</code>
        </pre>
      );
    }
    // heading
    const heading = trimmed.match(/^(#{1,4})\s+(.*)$/);
    if (heading !== null && heading[1] !== undefined && heading[2] !== undefined) {
      const level = heading[1].length;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4";
      return (
        <Tag key={i} className={styles.mdHeading}>
          {inlineMd(heading[2])}
        </Tag>
      );
    }
    // unordered list
    if (
      /^[-*]\s+/m.test(trimmed) &&
      trimmed.split("\n").every((l) => /^[-*]\s+/.test(l.trim()) || l.trim().length === 0)
    ) {
      const items = trimmed
        .split("\n")
        .filter((l) => /^[-*]\s+/.test(l.trim()))
        .map((l) => l.trim().replace(/^[-*]\s+/, ""));
      return (
        <ul key={i} className={styles.mdList}>
          {items.map((it, j) => (
            <li key={j}>{inlineMd(it)}</li>
          ))}
        </ul>
      );
    }
    // ordered list
    if (
      /^\d+\.\s+/m.test(trimmed) &&
      trimmed.split("\n").every((l) => /^\d+\.\s+/.test(l.trim()) || l.trim().length === 0)
    ) {
      const items = trimmed
        .split("\n")
        .filter((l) => /^\d+\.\s+/.test(l.trim()))
        .map((l) => l.trim().replace(/^\d+\.\s+/, ""));
      return (
        <ol key={i} className={styles.mdList}>
          {items.map((it, j) => (
            <li key={j}>{inlineMd(it)}</li>
          ))}
        </ol>
      );
    }
    return (
      <p key={i} className={styles.mdPara}>
        {inlineMd(trimmed)}
      </p>
    );
  });
}

/** Inline: `code`, **bold**, *italic*. */
function inlineMd(text: string): readonly JSX.Element[] {
  const out: JSX.Element[] = [];
  let rest = text;
  let key = 0;
  const push = (node: JSX.Element) => {
    out.push(node);
  };
  while (rest.length > 0) {
    const code = rest.match(/^`([^`]+)`/);
    if (code !== null) {
      push(
        <code key={key++} className={styles.mdInlineCode}>
          {code[1]}
        </code>,
      );
      rest = rest.slice(code[0].length);
      continue;
    }
    const bold = rest.match(/^\*\*([^*]+)\*\*/);
    if (bold !== null) {
      push(<strong key={key++}>{bold[1]}</strong>);
      rest = rest.slice(bold[0].length);
      continue;
    }
    const italic = rest.match(/^\*([^*]+)\*/);
    if (italic !== null) {
      push(<em key={key++}>{italic[1]}</em>);
      rest = rest.slice(italic[0].length);
      continue;
    }
    const next = rest.search(/[`*]/);
    if (next === -1) {
      push(<span key={key++}>{rest}</span>);
      break;
    }
    push(<span key={key++}>{rest.slice(0, next)}</span>);
    rest = rest.slice(next);
  }
  return out;
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
