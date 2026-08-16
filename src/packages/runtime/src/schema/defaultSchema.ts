import { objectTypeId, operationTypeId, operationTemplateRef, schemaId } from "@cantilune/core";
import type { OperationTemplate } from "./operationTemplate.js";
import {
  operationDeclarationFromTemplate,
  type OrchestrationSchema,
  type ObjectTypeDeclaration,
} from "./orchestrationSchema.js";

const INTRODUCE_ARTIFACT: OperationTemplate = {
  operationTypeId: operationTypeId("introduce_artifact"),
  templateRef: operationTemplateRef("introduce_artifact", "1"),
  description: "Introduce a new work artifact with write-lock capability",
  requiredRoles: ["task", "from"],
  requires: [
    { kind: "participant.registered", bindings: { participant: "from" } },
    { kind: "task.not_exists", bindings: { task: "task" } },
  ],
  ensures: [
    { kind: "task.exists", bindings: { task: "task" } },
    { kind: "delegator.holds", bindings: { task: "task", from: "from" } },
  ],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const DELEGATE: OperationTemplate = {
  operationTypeId: operationTypeId("delegate"),
  templateRef: operationTemplateRef("delegate", "1"),
  description: "Delegate task ownership and scoped capability to another participant",
  requiredRoles: ["task", "from", "to", "capability"],
  requires: [
    { kind: "task.exists", bindings: { task: "task" } },
    { kind: "delegator.holds", bindings: { task: "task", from: "from", capability: "capability" } },
    { kind: "delegatee.can_accept", bindings: { to: "to" } },
  ],
  ensures: [
    { kind: "task.exists", bindings: { task: "task" } },
    { kind: "delegator.holds", bindings: { task: "task", from: "to", capability: "capability" } },
  ],
  defaultVisibility: "external",
  mayCreateSessions: true,
};

const FORK_BRANCH: OperationTemplate = {
  operationTypeId: operationTypeId("fork_branch"),
  templateRef: operationTemplateRef("fork_branch", "1"),
  description: "Open a parallel branch (optional task intro + parallel_with links)",
  requiredRoles: ["from"],
  requires: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const CREATE_SESSION: OperationTemplate = {
  operationTypeId: operationTypeId("create_session"),
  templateRef: operationTemplateRef("create_session", "1"),
  description: "Open a communication session with controller and participants",
  requiredRoles: ["from"],
  requires: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  defaultVisibility: "external",
  mayCreateSessions: true,
};

const PUBLISH_ARTIFACT: OperationTemplate = {
  operationTypeId: operationTypeId("publish_artifact"),
  templateRef: operationTemplateRef("publish_artifact", "1"),
  description: "Publish a work artifact (lifecycle transition)",
  requiredRoles: ["task", "from"],
  requires: [
    { kind: "task.exists", bindings: { task: "task" } },
    { kind: "delegator.holds", bindings: { task: "task", from: "from" } },
  ],
  ensures: [{ kind: "task.exists", bindings: { task: "task" } }],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const TRANSFER_SESSION: OperationTemplate = {
  operationTypeId: operationTypeId("transfer_session"),
  templateRef: operationTemplateRef("transfer_session", "1"),
  description: "Transfer session controller to another participant",
  requiredRoles: ["session", "from", "to"],
  requires: [
    { kind: "session.exists", bindings: { session: "session" } },
    { kind: "session.controller_matches", bindings: { session: "session", from: "from" } },
    { kind: "participant.registered", bindings: { participant: "from" } },
    { kind: "participant.registered", bindings: { participant: "to" } },
  ],
  ensures: [{ kind: "session.exists", bindings: { session: "session" } }],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const REGISTER_PARTICIPANT: OperationTemplate = {
  operationTypeId: operationTypeId("register_participant"),
  templateRef: operationTemplateRef("register_participant", "1"),
  description: "Register a new agent participant in the coordination world",
  requiredRoles: ["from", "participant"],
  requires: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "participant" } }],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const ACTIVATE_PARTICIPANT: OperationTemplate = {
  operationTypeId: operationTypeId("activate_participant"),
  templateRef: operationTemplateRef("activate_participant", "1"),
  description:
    "Admit a registered participant to active and bind its content-addressed manifest (ADR-0015)",
  requiredRoles: ["from", "participant"],
  requires: [{ kind: "participant.registered", bindings: { participant: "participant" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "participant" } }],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const SIGNAL_DONE: OperationTemplate = {
  operationTypeId: operationTypeId("signal_done"),
  templateRef: operationTemplateRef("signal_done", "1"),
  description: "Signal that an agent has completed its work",
  requiredRoles: ["from"],
  requires: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const RETIRE_PARTICIPANT: OperationTemplate = {
  operationTypeId: operationTypeId("retire_participant"),
  templateRef: operationTemplateRef("retire_participant", "1"),
  description: "Retire a participant from the coordination world",
  requiredRoles: ["from", "participant"],
  requires: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "participant" } }],
  defaultVisibility: "external",
  mayCreateSessions: false,
};

const COMMIT_TRANSCRIPT: OperationTemplate = {
  operationTypeId: operationTypeId("commit_transcript"),
  templateRef: operationTemplateRef("commit_transcript", "1"),
  description: "Commit this participant's LLM transcript onto the shared world (ADR-0021)",
  requiredRoles: ["from"],
  requires: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  defaultVisibility: "internal",
  mayCreateSessions: false,
};

const EMIT_HEARTBEAT: OperationTemplate = {
  operationTypeId: operationTypeId("emit_heartbeat"),
  templateRef: operationTemplateRef("emit_heartbeat", "1"),
  description: "Emit a heartbeat signal proving agent liveness",
  requiredRoles: ["from"],
  requires: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  ensures: [{ kind: "participant.registered", bindings: { participant: "from" } }],
  defaultVisibility: "internal",
  mayCreateSessions: false,
};

const DEFAULT_TEMPLATES: readonly OperationTemplate[] = [
  INTRODUCE_ARTIFACT,
  DELEGATE,
  CREATE_SESSION,
  FORK_BRANCH,
  PUBLISH_ARTIFACT,
  TRANSFER_SESSION,
  REGISTER_PARTICIPANT,
  ACTIVATE_PARTICIPANT,
  SIGNAL_DONE,
  RETIRE_PARTICIPANT,
  EMIT_HEARTBEAT,
  COMMIT_TRANSCRIPT,
];

const DEFAULT_OBJECT_TYPES: readonly ObjectTypeDeclaration[] = [
  {
    objectTypeId: objectTypeId("artifact"),
    structuralMode: "affine",
    codecRef: "cantilune/work-artifact@1",
    description: "Work artifact node",
    metadata: {},
  },
  {
    objectTypeId: objectTypeId("capability"),
    structuralMode: "linear",
    codecRef: "cantilune/scoped-capability@1",
    description: "Scoped capability token",
    metadata: {},
  },
];

export function buildOrchestrationSchema(
  schemaIdValue: string,
  templates: readonly OperationTemplate[] = DEFAULT_TEMPLATES,
): OrchestrationSchema {
  const operationTypes = new Map(
    templates.map((template) => [
      template.operationTypeId,
      operationDeclarationFromTemplate(template),
    ]),
  );
  const objectTypes = new Map(
    DEFAULT_OBJECT_TYPES.map((objectType) => [objectType.objectTypeId, objectType]),
  );
  return {
    schemaId: schemaId(schemaIdValue),
    wireVersion: 1,
    objectTypes,
    operationTypes,
    templates: [...templates],
    resourceRules: [],
  };
}

export function createDefaultSchema(schemaIdValue = "default-v1"): OrchestrationSchema {
  return buildOrchestrationSchema(schemaIdValue);
}

export function defaultIntroduceTemplate(): OperationTemplate {
  return INTRODUCE_ARTIFACT;
}

export function defaultDelegateTemplate(): OperationTemplate {
  return DELEGATE;
}

export function defaultCreateSessionTemplate(): OperationTemplate {
  return CREATE_SESSION;
}

export function defaultForkBranchTemplate(): OperationTemplate {
  return FORK_BRANCH;
}

export function defaultPublishArtifactTemplate(): OperationTemplate {
  return PUBLISH_ARTIFACT;
}

export function defaultTransferSessionTemplate(): OperationTemplate {
  return TRANSFER_SESSION;
}

export function defaultActivateParticipantTemplate(): OperationTemplate {
  return ACTIVATE_PARTICIPANT;
}

export function defaultTemplates(): readonly OperationTemplate[] {
  return DEFAULT_TEMPLATES;
}
