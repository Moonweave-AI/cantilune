import { useState } from "react";
import type { ClusterEventWire, SwarmStatusWire, WorldSnapshotWire } from "@shared/protocol";
import type { ConversationNode } from "../conversation/nodes";
import { DetailsPanel } from "./DetailsPanel";
import { SwarmPanel, type ActivateManifestInput } from "./SwarmPanel";
import { WorldPanel } from "./WorldPanel";
import styles from "./DetailsRail.module.css";

type RailTab = "inspect" | "world" | "swarm";

interface DetailsRailProps {
  readonly selected: ConversationNode | null;
  readonly world: WorldSnapshotWire | null;
  readonly swarmStatus: SwarmStatusWire | null;
  readonly clusterEvents: readonly ClusterEventWire[];
  readonly dark: boolean;
  readonly onThemeToggle: () => void;
  readonly onSwarmStart: () => void;
  readonly onSwarmStop: () => void;
  readonly onSwarmActivate: (agentId: string, manifest: ActivateManifestInput) => void;
}

export function DetailsRail({
  selected,
  world,
  swarmStatus,
  clusterEvents,
  dark,
  onThemeToggle,
  onSwarmStart,
  onSwarmStop,
  onSwarmActivate,
}: DetailsRailProps): JSX.Element {
  const [tab, setTab] = useState<RailTab>("inspect");
  return (
    <div className={styles.rail}>
      <nav className={styles.tabs} role="tablist" aria-label="Runtime panels">
        {(
          [
            ["inspect", "\u68c0\u67e5"],
            ["world", "\u4e16\u754c"],
            ["swarm", "\u96c6\u7fa4"],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? styles.tabActive : styles.tab}
            key={id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className={styles.content}>
        {tab === "inspect" && (
          <DetailsPanel selected={selected} onThemeToggle={onThemeToggle} dark={dark} hideHeader />
        )}
        {tab === "world" && (
          <>
            {world !== null ? (
              <WorldPanel snapshot={world} />
            ) : (
              <EmptyState label="\u8fde\u63a5\u8fd0\u884c\u65f6\u540e\uff0c\u8fd9\u91cc\u4f1a\u663e\u793a\u4e16\u754c\u5feb\u7167\u3002" />
            )}
          </>
        )}
        {tab === "swarm" && (
          <SwarmPanel
            status={swarmStatus}
            events={clusterEvents}
            onStart={onSwarmStart}
            onStop={onSwarmStop}
            onActivate={onSwarmActivate}
          />
        )}
      </div>
    </div>
  );
}

function EmptyState({ label }: { readonly label: string }): JSX.Element {
  return <p className={styles.empty}>{label}</p>;
}
