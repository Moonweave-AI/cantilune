import type {
  SyscallRuntime,
  SyscallPrincipal,
  PerceptionResult,
  OperationSchemaProvider,
} from "./syscall.js";

function str(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

/**
 * Serialize the current world state into text the LLM can read.
 * Pure translation: no decisions, no filtering by policy.
 */
export async function perceive(
  runtime: SyscallRuntime,
  _principal: SyscallPrincipal,
  schemaProvider: OperationSchemaProvider,
): Promise<PerceptionResult> {
  const snapshot = runtime.getHead();

  const availableOps = schemaProvider.getTemplates().map((t) => t.operationTypeId);

  if (snapshot === undefined) {
    return {
      worldSummary: "World is empty. No participants or artifacts registered yet.",
      recentObservations: "",
      availableOperations: availableOps,
      headRef: undefined,
      epochId: undefined,
      participantCount: 0,
      artifactCount: 0,
      auditTailLength: 0,
    };
  }

  const worldSummary = renderWorldSummary(snapshot);
  const recentObservations = renderObservations(snapshot);

  return {
    worldSummary,
    recentObservations,
    availableOperations: availableOps,
    headRef: str(snapshot.snapshotRef),
    epochId: str(snapshot.epochId) || undefined,
    participantCount: snapshot.participants.size,
    artifactCount: snapshot.artifacts.size,
    auditTailLength: snapshot.auditTail.length,
  };
}

function renderWorldSummary(snap: ReturnType<SyscallRuntime["getHead"]> & object): string {
  const lines: string[] = [
    `[World State] epoch=${str(snap.epochId)} ref=${str(snap.snapshotRef)}`,
    "",
    ...renderParticipantsSection(snap),
    "",
    ...renderArtifactsSection(snap),
  ];

  if (snap.sessions.size > 0) {
    lines.push(...renderSessionsSection(snap), "");
  }

  if (snap.capabilities.size > 0) {
    lines.push(...renderCapabilitiesSection(snap), "");
  }

  if (snap.links.size > 0) {
    lines.push(...renderLinksSection(snap));
  }

  return lines.join("\n");
}

function renderParticipantsSection(snap: ReturnType<SyscallRuntime["getHead"]> & object): string[] {
  const lines = [`## Participants (${snap.participants.size})`];
  for (const [id, p] of snap.participants) {
    const part = p as { kind?: string; status?: string };
    lines.push(`- ${str(id)} [${part.kind ?? "unknown"}] status=${part.status ?? "unknown"}`);
  }
  return lines;
}

function renderArtifactsSection(snap: ReturnType<SyscallRuntime["getHead"]> & object): string[] {
  const lines = [`## Artifacts (${snap.artifacts.size})`];
  for (const [id, a] of snap.artifacts) {
    const art = a as {
      kind?: string;
      lifecycle?: string;
      owner?: { actorId?: string };
      contentRef?: unknown;
    };
    const ref = str(art.contentRef);
    lines.push(
      `- ${str(id)} [${art.kind ?? "?"}] lifecycle=${art.lifecycle ?? "?"} owner=${art.owner?.actorId ?? "?"} contentRef=${ref || "?"} (use read_content ref=${ref || "?"})`,
    );
  }
  return lines;
}

function renderSessionsSection(snap: ReturnType<SyscallRuntime["getHead"]> & object): string[] {
  const lines = [`## Sessions (${snap.sessions.size})`];
  for (const [id, s] of snap.sessions) {
    const sess = s as { controller?: unknown; participants?: unknown[] };
    lines.push(
      `- ${str(id)} controller=${str(sess.controller)} participants=${JSON.stringify(sess.participants)}`,
    );
  }
  return lines;
}

function renderCapabilitiesSection(snap: ReturnType<SyscallRuntime["getHead"]> & object): string[] {
  const lines = [`## Capabilities (${snap.capabilities.size})`];
  for (const [id, c] of snap.capabilities) {
    const cap = c as { holder?: unknown; scope?: unknown };
    lines.push(`- ${str(id)} holder=${str(cap.holder)} scope=${str(cap.scope)}`);
  }
  return lines;
}

function renderLinksSection(snap: ReturnType<SyscallRuntime["getHead"]> & object): string[] {
  const lines = [`## Links (${snap.links.size})`];
  for (const [id, l] of snap.links) {
    const link = l as {
      kind?: string;
      from?: { kind?: string; actorId?: string; artifactId?: string };
      to?: { kind?: string; actorId?: string; artifactId?: string };
    };
    const fromStr =
      link.from?.kind === "participant" ? String(link.from.actorId) : String(link.from?.artifactId);
    const toStr =
      link.to?.kind === "participant" ? String(link.to.actorId) : String(link.to?.artifactId);
    lines.push(`- ${str(id)} ${link.kind ?? "?"} from=${fromStr ?? "?"} to=${toStr ?? "?"}`);
  }
  return lines;
}

function renderObservations(snap: ReturnType<SyscallRuntime["getHead"]> & object): string {
  if (snap.auditTail.length === 0) return "No observations yet.";

  const recent = snap.auditTail.slice(-10);
  const lines = recent.map((obs) => {
    const entry = obs as {
      sequenceNo?: unknown;
      source?: { actorId?: string };
      payloadRef?: unknown;
      receivedAt?: unknown;
    };
    const seq = entry.sequenceNo;
    const seqStr = (
      typeof seq === "number" || typeof seq === "string" ? String(seq) : "?"
    ).padStart(3, "0");
    const recvAt = entry.receivedAt;
    const recvAtStr = typeof recvAt === "string" ? recvAt : "?";
    const payloadRef = str(entry.payloadRef);
    return `[Obs#${seqStr}] from=${entry.source?.actorId ?? "?"} payloadRef=${payloadRef || "?"} (use read_content ref=${payloadRef || "?"}) at=${recvAtStr}`;
  });
  if (snap.auditTail.length > 10) {
    lines.unshift(`(showing last 10 of ${snap.auditTail.length} observations)`);
  }
  return lines.join("\n");
}
