/**
 * NodeRow — routes a conversation node by kind to its renderer (ADR-0030 §4.2).
 * Each renderer makes one packages concept legible.
 */

import type { ConversationNode } from "./nodes";
import type { ControlVerdictKindWire, TerminationAuditWire } from "@shared/protocol";
import { memo, useState, type MouseEvent, type ReactNode } from "react";
import { MarkdownView } from "./MarkdownView";
import { DisclosureRow } from "./DisclosureRow";
import { ErrorBoundary } from "../shell/ErrorBoundary";
import { IconCopy, IconSearch, IconTerminal } from "../theme/icons";
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

export const NodeRow = memo(function NodeRow({
  node,
  onAskUserReply,
}: NodeRowProps): JSX.Element {
  switch (node.kind) {
    case "user":
      return (
        <div className={styles.user}>
          <div className={styles.userBubble}>{node.text}</div>
        </div>
      );

    case "assistant":
    case "reasoning":
      if ((node.text ?? "").trim().length === 0 && node.pending !== true) return <></>;
      return (
        <div className={styles.assistant}>
          <ErrorBoundary
            fallback={<pre style={{ whiteSpace: "pre-wrap", margin: 0 }}>{node.text}</pre>}
          >
            <MarkdownView source={node.text} />
          </ErrorBoundary>
        </div>
      );

    case "tool_call":
      return (
        <DisclosureRow
          title={toolTitle(node.toolName)}
          summary={toolSummary(node)}
          pending={node.pending === true}
          icon={toolIcon(node.toolName)}
        >
          <ToolResultCard node={node} />
        </DisclosureRow>
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
      if (node.pending === true || node.approval === undefined) return <></>;
      return (
        <div className={styles.approval}>
          <div className={styles.approvalHead}>
            <span className={styles.approvalTier}>已处理 · {node.approval.tier}</span>
            <span className={styles.approvalName}>{node.approval.name}</span>
          </div>
        </div>
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
});

function RunResultRow({
  result,
}: {
  readonly result: NonNullable<ConversationNode["runResult"]>;
}): JSX.Element {
  return (
    <details className={styles.runResult} data-ok={result.ok}>
      <summary className={styles.runResultHead}>
        <span className={styles.runResultBadge}>{result.ok ? "✓ complete" : "✗ ended"}</span>
        <span className={styles.runResultReason}>{result.terminationReason ?? "controller"}</span>
        <small>
          {result.turns} turns · {formatMs(result.elapsedMs)} · 展开
        </small>
      </summary>
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
    </details>
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

function toolIcon(name: string | undefined): ReactNode {
  const key = (name ?? "").toLowerCase();
  if (key.includes("search") || key.includes("web") || key.includes("tavily")) {
    return <IconSearch size={14} />;
  }
  return <IconTerminal size={14} />;
}

function toolTitle(name: string | undefined): string {
  const key = (name ?? "").toLowerCase();
  if (
    key.includes("shell") ||
    key.includes("bash") ||
    key.includes("pwsh") ||
    key.includes("powershell") ||
    key === "cmd" ||
    key.includes("terminal")
  ) {
    return "Shell";
  }
  if (key.includes("search") || key.includes("web") || key.includes("tavily") || key.includes("serper")) {
    return "Search";
  }
  if (key.includes("read")) return "Read";
  if (key.includes("write") || key.includes("edit") || key.includes("apply_patch")) return "Write";
  return name ?? "tool";
}

function toolSummary(node: ConversationNode): string {
  if (node.pending === true) return "running…";
  const description = node.arguments?.description;
  if (typeof description === "string" && description.trim().length > 0) {
    return description.replace(/\s+/g, " ").slice(0, 72);
  }
  const command = commandLine(node.arguments);
  if (command.length > 0) return command.replace(/\s+/g, " ").slice(0, 48);
  if (node.ok === false) return "failed";
  return "ok";
}

function commandLine(args: Record<string, unknown> | undefined): string {
  if (args === undefined) return "";
  const argv = args.argv;
  if (Array.isArray(argv) && argv.every((item) => typeof item === "string")) {
    return argv.join(" ");
  }
  for (const key of ["command", "cmd", "script", "query", "url", "path"] as const) {
    const value = args[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

function ToolResultCard({ node }: { readonly node: ConversationNode }): JSX.Element {
  const [copied, setCopied] = useState(false);
  const command = commandLine(node.arguments);
  const output = node.output ?? "";
  const copy = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    const text = command.length > 0 ? command : output;
    if (text.length === 0) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard blocked */
    }
  };
  return (
    <div
      className={styles.toolCard}
      data-ok={node.ok === false ? "false" : "true"}
      onClick={(event) => event.stopPropagation()}
    >
      <header>
        <i
          className={styles.statusDot}
          data-ok={node.pending === true ? "pending" : node.ok === false ? "false" : "true"}
        />
        <code>{command.length > 0 ? command : (node.toolName ?? "tool")}</code>
        <button type="button" onClick={copy} aria-label="复制命令">
          <IconCopy size={13} />
          {copied ? "已复制" : "复制"}
        </button>
      </header>
      {output.length > 0 && (
        <pre>{output.length > 4_000 ? `${output.slice(0, 4_000)}…` : output}</pre>
      )}
    </div>
  );
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}
