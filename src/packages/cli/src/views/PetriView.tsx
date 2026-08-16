import React from "react";
import { Text } from "ink";
import { NO_RUNTIME_MESSAGE } from "../runtimeSync.js";
import type { AppStore, RuntimeState, ViewType } from "../store.js";
import { useAppStore } from "../storeContext.js";
import { renderTable } from "../render/asciiTable.js";
import { DiffView } from "./DiffView.js";
import { ReportView } from "./ReportView.js";
import { ViewFrame, type ViewTone } from "./ViewFrame.js";
import { str } from "./viewStr.js";
import type {
  PetriSnapshot,
  PetriFireSnapshot,
  PetriReachSnapshot,
  PetriInvariantsSnapshot,
} from "../wiring/petriControl.js";

/** Petri analysis is the formal/structural lens; it keeps the violet accent. */
const PETRI_TONE: ViewTone = "accentAlt";

export interface ViewProps {
  readonly store: AppStore;
}

/** Render a marking table from a PetriSnapshot. */
function renderMarkingTable(data: PetriSnapshot): string {
  return renderTable(
    [
      { header: "Place", width: 18 },
      { header: "Tokens", width: 8, align: "right" },
    ],
    data.places.map((p) => [p.name, String(p.tokens)]),
  );
}

/** Read prefetched petri data of a given kind from viewArgs. */
function readPetriData<T>(viewArgs: Record<string, unknown>): T | undefined {
  return "petriData" in viewArgs ? ((viewArgs.petriData as T | null) ?? undefined) : undefined;
}

function fireLabel(fire: PetriFireSnapshot): string {
  if (fire.result.ok) {
    return "After (fired)";
  }
  return disabledFireLabel(fire);
}

/** Label for the after-side of a fire diff when the fire was blocked. */
function disabledFireLabel(fire: PetriFireSnapshot): string {
  if (fire.result.blockedReason === "self-loop-arc") {
    return "After (disabled: self-loop arc)";
  }
  if (fire.result.blockedReason === "disabled") {
    const under = fire.result.underMarked ?? [];
    return `After (disabled: ${under.length > 0 ? under.join(", ") : "under-marked"})`;
  }
  return "After (disabled: unknown transition)";
}

/** Human-readable reachability verdict from a reach snapshot. */
function reachVerdict(reach: PetriReachSnapshot): string {
  if (reach.reachable) {
    return "reachable";
  }
  if (reach.dead) {
    return "unreachable (dead marking)";
  }
  return `unreachable within ${reach.maxSteps} steps`;
}

export function renderPetriViewOutput(
  activeView: ViewType,
  viewArgs: Record<string, unknown>,
  runtime: RuntimeState,
): string {
  // No runtime snapshot → the engine has nothing to project, regardless of
  // whether a (null) petriData was stashed by a headless/no-controller path.
  if (runtime.snapshot === null) {
    return NO_RUNTIME_MESSAGE;
  }

  switch (activeView) {
    case "petri-transitions":
      return renderTransitionsOutput(viewArgs);
    case "petri-fire":
      return renderFireOutput(viewArgs);
    case "petri-reach":
      return renderReachOutput(viewArgs);
    case "petri-invariants":
      return renderInvariantsOutput(viewArgs);
    case "petri":
    default:
      return renderMarkingOutput(viewArgs);
  }
}

/** /petri transitions: enabled-transition table with consume/produce arcs. */
function renderTransitionsOutput(viewArgs: Record<string, unknown>): string {
  const data = readPetriData<PetriSnapshot>(viewArgs);
  if (data === undefined) {
    return "No Petri data loaded";
  }
  return renderTable(
    [
      { header: "Operation", width: 22 },
      { header: "Enabled", width: 8 },
      { header: "Consumes", width: 18 },
      { header: "Produces", width: 18 },
    ],
    data.transitions.map((t) => [
      t.name,
      t.enabled ? "yes" : "no",
      t.consumes.length > 0 ? t.consumes.join(",") : "—",
      t.produces.length > 0 ? t.produces.join(",") : "—",
    ]),
  );
}

/** /petri fire: before/after marking diff with a real fire verdict label. */
function renderFireOutput(viewArgs: Record<string, unknown>): string {
  const fire = readPetriData<PetriFireSnapshot>(viewArgs);
  if (fire === undefined) {
    return "No Petri data loaded";
  }
  return [
    `Fire: ${fire.op}`,
    `bindings: ${fire.bindings}`,
    "",
    "Before:",
    renderMarkingTable(fire.before),
    "",
    fireLabel(fire),
    renderMarkingTable(fire.after),
  ].join("\n");
}

/** /petri reach: bounded-BFS verdict + firing trace. */
function renderReachOutput(viewArgs: Record<string, unknown>): string {
  const reach = readPetriData<PetriReachSnapshot>(viewArgs);
  if (reach === undefined) {
    return "No Petri data loaded";
  }
  const verdict = reachVerdict(reach);
  return [
    `Goal: ${str(viewArgs.goal, reach.goal)}`,
    `Verdict: ${verdict} (explored ${reach.explored} markings)`,
    "",
    renderTable(
      [
        { header: "Step", width: 6, align: "right" },
        { header: "Transition", width: 22 },
        { header: "Tokens", width: 10, align: "right" },
      ],
      reach.trace.map((step) => [
        String(step.step),
        step.transition,
        String(step.marking.places.reduce((sum, p) => sum + p.tokens, 0)),
      ]),
    ),
  ].join("\n");
}

/** /petri invariants: S-invariant + T-invariant bases from the real engine. */
function renderInvariantsOutput(viewArgs: Record<string, unknown>): string {
  const inv = readPetriData<PetriInvariantsSnapshot>(viewArgs);
  if (inv === undefined) {
    return "No Petri data loaded";
  }
  const sRows =
    inv.invariants.length === 0
      ? [["(none)", "S-invariant", "ok"]]
      : inv.invariants.map((row) => [row.label, "S-invariant", "ok"]);
  const tRows =
    (inv.transitionInvariants?.length ?? 0) === 0
      ? [["(none)", "T-invariant", "ok"]]
      : (inv.transitionInvariants ?? []).map((row) => [row.label, "T-invariant", "ok"]);
  return renderTable(
    [
      { header: "Invariant", width: 28 },
      { header: "Type", width: 12 },
      { header: "Status", width: 10 },
    ],
    [...sRows, ...tRows],
  );
}

/** /petri: current marking table (places + tokens). */
function renderMarkingOutput(viewArgs: Record<string, unknown>): string {
  const data = readPetriData<PetriSnapshot>(viewArgs);
  if (data === undefined) {
    return "No Petri data loaded";
  }
  if (data.places.length === 0) {
    return "No Petri markings available from current snapshot.";
  }
  return renderMarkingTable(data);
}

export function PetriView({ store }: ViewProps): React.ReactElement {
  const activeView = store.activeView ?? "petri";
  const hasData =
    "petriData" in store.viewArgs &&
    store.viewArgs.petriData !== null &&
    store.viewArgs.petriData !== undefined;
  const output = renderPetriViewOutput(activeView, store.viewArgs, store.runtime);

  if (store.runtime.snapshot === null) {
    return <ViewFrame title="Petri Net" tone={PETRI_TONE} empty={output} />;
  }

  if (activeView === "petri-fire") {
    const fire = readPetriData<PetriFireSnapshot>(store.viewArgs);
    if (fire === undefined) {
      return (
        <ViewFrame title="Petri Fire" tone={PETRI_TONE}>
          <Text>{output}</Text>
        </ViewFrame>
      );
    }
    return (
      <ViewFrame title="Petri Fire" tone={PETRI_TONE}>
        <DiffView
          leftLabel="before"
          rightLabel={fireLabel(fire)}
          left={renderMarkingTable(fire.before)}
          right={renderMarkingTable(fire.after)}
        />
      </ViewFrame>
    );
  }

  if (activeView === "petri-invariants" && hasData) {
    return (
      <ViewFrame title="Petri Invariants" tone={PETRI_TONE}>
        <ReportView
          title="Petri Invariants"
          sections={[
            {
              heading: "S-Invariants",
              content:
                "Computed from the projected net's incidence matrix (Martinez-Silva elimination).",
            },
            {
              heading: "T-Invariants",
              content:
                "S- and T-invariant bases from `@cantilune/petri` (Martinez–Silva).",
            },
          ]}
        />
        <Text>{output}</Text>
      </ViewFrame>
    );
  }

  const titles: Record<string, string> = {
    petri: "Current Marking",
    "petri-transitions": "Enabled Transitions",
    "petri-reach": "Reachability Analysis",
  };

  return (
    <ViewFrame title={titles[activeView] ?? "Petri Net"} tone={PETRI_TONE}>
      <Text>{output}</Text>
    </ViewFrame>
  );
}

export interface ViewContainerProps {
  readonly viewArgs?: Record<string, unknown>;
  readonly activeView?: ViewType;
}

export default function PetriViewContainer(props: ViewContainerProps): React.ReactElement {
  const store = useAppStore({
    activeView: props.activeView ?? "petri",
    viewArgs: props.viewArgs ?? {},
  });
  return <PetriView store={store} />;
}
