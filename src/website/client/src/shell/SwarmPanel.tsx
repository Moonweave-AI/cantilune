/**
 * SwarmPanel — ADR-0030 §3.4. Renders the live swarm (multi-agent cluster)
 * state: start/stop controls, agent roster with status, scheduler summary,
 * and a scrolling lifecycle event feed. The client sends `swarm:start` /
 * `swarm:stop` / `swarm:activate` / `swarm:status`; the server polls the
 * SwarmController and pushes `swarm:status` + `cluster_event` batches.
 */

import { useState } from "react";
import type {
  ClusterEventWire,
  SwarmStatusWire,
  StartConditionExpressionWire,
} from "@shared/protocol";
import styles from "./SwarmPanel.module.css";

interface SwarmPanelProps {
  readonly status: SwarmStatusWire | null;
  readonly events: readonly ClusterEventWire[];
  readonly onStart: () => void;
  readonly onStop: () => void;
  readonly onActivate: (agentId: string, manifest: ActivateManifestInput) => void;
}

export interface ActivateManifestInput {
  readonly assignedTask: string;
  readonly systemPrompt?: string;
  readonly model?: string;
  readonly provider?: string;
  readonly maxTurns?: number;
  readonly heartbeatIntervalMs?: number;
  readonly startCondition?: StartConditionExpressionWire;
}

const STATUS_TONE: Record<string, string> = {
  running: styles.toneRun!,
  done: styles.toneDone!,
  stale: styles.toneStale!,
  retired: styles.toneRetired!,
  queued: styles.toneQueued!,
  active: styles.toneRun!,
};

function toneFor(status: string): string {
  return STATUS_TONE[status] ?? styles.toneUnknown!;
}

export function SwarmPanel({
  status,
  events,
  onStart,
  onStop,
  onActivate,
}: SwarmPanelProps): JSX.Element {
  const [agentId, setAgentId] = useState("worker-1");
  const [task, setTask] = useState("Summarize the current artifact.");
  const [showActivate, setShowActivate] = useState(false);

  const running = status?.running ?? false;
  const agents = status?.agents ?? [];
  const scheduler = status?.scheduler;
  const eventFeed = status?.events ?? events;

  return (
    <div className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.title}>Swarm</span>
        <span className={running ? styles.liveBadge : styles.offBadge}>
          {running ? "live" : "idle"}
        </span>
        <div className={styles.controls}>
          {!running ? (
            <button type="button" className={styles.startBtn} onClick={onStart}>
              Start
            </button>
          ) : (
            <button type="button" className={styles.stopBtn} onClick={onStop}>
              Stop
            </button>
          )}
        </div>
      </div>

      {scheduler !== undefined && (
        <div className={styles.scheduler}>
          <div className={styles.metric}>
            <span className={styles.metricVal}>{scheduler.running}</span>
            <span className={styles.metricLabel}>running</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricVal}>{scheduler.pendingCount}</span>
            <span className={styles.metricLabel}>pending</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricVal}>{scheduler.startedTotal}</span>
            <span className={styles.metricLabel}>started</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricVal}>{scheduler.completedTotal}</span>
            <span className={styles.metricLabel}>done</span>
          </div>
          <div className={styles.metric}>
            <span className={styles.metricVal}>{scheduler.consumedTurns}</span>
            <span className={styles.metricLabel}>turns</span>
          </div>
          {scheduler.saturated && <span className={styles.saturated}>saturated</span>}
          {scheduler.stallTicks > 0 && (
            <span className={styles.stalled}>stall ×{scheduler.stallTicks}</span>
          )}
        </div>
      )}

      <div className={styles.section}>
        <div className={styles.subhead}>Agents ({agents.length})</div>
        {agents.length === 0 ? (
          <div className={styles.empty}>No agents activated. Use Activate to add one.</div>
        ) : (
          <ul className={styles.agentList}>
            {agents.map((a) => (
              <li key={a.id} className={styles.agentRow}>
                <span className={styles.agentId}>{a.id}</span>
                <span className={`${styles.statusTag} ${toneFor(a.status)}`}>{a.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className={styles.section}>
        <button
          type="button"
          className={styles.activateToggle}
          onClick={() => setShowActivate((v) => !v)}
        >
          {showActivate ? "− Hide activate" : "+ Activate agent"}
        </button>
        {showActivate && (
          <div className={styles.activateForm}>
            <label className={styles.field}>
              Agent id
              <input
                className={styles.input}
                value={agentId}
                onChange={(e) => setAgentId(e.target.value)}
              />
            </label>
            <label className={styles.field}>
              Assigned task
              <textarea
                className={styles.textarea}
                value={task}
                onChange={(e) => setTask(e.target.value)}
                rows={2}
              />
            </label>
            <button
              type="button"
              className={styles.activateBtn}
              disabled={task.trim().length === 0}
              onClick={() => onActivate(agentId, { assignedTask: task })}
            >
              Activate
            </button>
          </div>
        )}
      </div>

      <div className={styles.section}>
        <div className={styles.subhead}>Event feed</div>
        <ul className={styles.eventList}>
          {eventFeed.length === 0 ? (
            <li className={styles.empty}>No events yet.</li>
          ) : (
            eventFeed
              .slice(-12)
              .reverse()
              .map((e, i) => (
                <li key={`${e.kind}-${i}`} className={styles.eventRow}>
                  <span className={styles.eventKind}>{e.kind}</span>
                  {"actorId" in e && e.actorId !== undefined && (
                    <span className={styles.eventActor}>{e.actorId}</span>
                  )}
                  {"summary" in e && e.summary !== undefined && (
                    <span className={styles.eventSummary}>{e.summary}</span>
                  )}
                  {"detail" in e && (e as { detail?: string }).detail !== undefined && (
                    <span className={styles.eventSummary}>{(e as { detail: string }).detail}</span>
                  )}
                </li>
              ))
          )}
        </ul>
      </div>
    </div>
  );
}
