export interface PetriPlace {
  readonly id: string;
  readonly name: string;
  readonly tokens?: number;
}

export interface PetriTransition {
  readonly id: string;
  readonly name: string;
}

export interface PetriArc {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface PetriNet {
  readonly places: readonly PetriPlace[];
  readonly transitions: readonly PetriTransition[];
  readonly arcs: readonly PetriArc[];
}

function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function exportPnml(net: PetriNet): string {
  const lines: string[] = [
    '<?xml version="1.0" encoding="ISO-8859-1"?>',
    '<pnml xmlns="http://www.pnml.org/version-2009/grammar/pnml">',
    '  <net id="cantilune-net" type="http://www.pnml.org/version-2009/grammar/ptnet">',
  ];

  for (const place of net.places) {
    lines.push(
      `    <place id="${xmlEscape(place.id)}">`,
      `      <name><text>${xmlEscape(place.name)}</text></name>`,
    );
    if (place.tokens !== undefined) {
      lines.push(
        "      <initialMarking>",
        `        <text>${place.tokens}</text>`,
        "      </initialMarking>",
      );
    }
    lines.push("    </place>");
  }

  for (const transition of net.transitions) {
    lines.push(
      `    <transition id="${xmlEscape(transition.id)}">`,
      `      <name><text>${xmlEscape(transition.name)}</text></name>`,
      "    </transition>",
    );
  }

  for (const arc of net.arcs) {
    lines.push(
      `    <arc id="${xmlEscape(arc.id)}" source="${xmlEscape(arc.source)}" target="${xmlEscape(arc.target)}"/>`,
    );
  }

  lines.push("  </net>", "</pnml>");
  return lines.join("\n");
}
