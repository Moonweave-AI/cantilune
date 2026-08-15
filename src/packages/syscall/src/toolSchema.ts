import type {
  ActionSchema,
  ToolExecutor,
  OperationSchemaProvider,
  AvailableTemplate,
} from "./syscall.js";

/**
 * Generate ActionSchema from runtime OperationTemplates dynamically.
 * No hardcoded operation list — derives from whatever the runtime schema declares.
 */
export function schemasFromTemplates(templates: readonly AvailableTemplate[]): ActionSchema[] {
  return templates.map((t) => {
    const contentRefInputs = t.contentRefInputs ?? [];
    const scalarInputs = t.scalarInputs ?? [];
    return {
      name: t.operationTypeId as string,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries([
          ...t.requiredRoles.map((role) => [
            role,
            { type: "string", description: `${role} identifier` },
          ]),
          ...contentRefInputs.map((input) => [
            input.name,
            {
              type: "string",
              pattern: "^sha256:[0-9a-f]{64}$",
              description: input.description ?? `${input.name} content reference`,
            },
          ]),
          ...scalarInputs.map((input) => [
            input.name,
            input.type === "nonNegativeInteger"
              ? {
                  type: "string",
                  pattern: "^(?:0|[1-9][0-9]*)$",
                  description:
                    input.description ?? `${input.name} non-negative integer (decimal string)`,
                  "x-cantilune-scalarType": input.type,
                }
              : {
                  type: "string",
                  minLength: 1,
                  description: input.description ?? `${input.name} string value`,
                  "x-cantilune-scalarType": input.type,
                },
          ]),
        ]),
        required: [
          ...t.requiredRoles,
          ...contentRefInputs
            .filter((input) => input.required !== false)
            .map((input) => input.name),
          ...scalarInputs.filter((input) => input.required !== false).map((input) => input.name),
        ],
      },
    };
  });
}

/**
 * Merge Cantilune action schemas with external tool schemas.
 * External tools are exposed with "tool:" prefix to the LLM.
 */
export async function mergeWithToolSchemas(
  actionSchemas: ActionSchema[],
  toolExecutor: ToolExecutor | undefined,
): Promise<ActionSchema[]> {
  if (toolExecutor === undefined) return actionSchemas;

  const toolSchemas = await toolExecutor.listTools();
  const toolActions = toolSchemas.map((t): ActionSchema => ({
    name: `tool:${t.name}`,
    description: `[External Tool] ${t.description}`,
    parameters: t.parameters,
  }));

  return [...actionSchemas, ...toolActions];
}

/**
 * Create a schema provider from a static list of templates.
 * For dynamic scenarios, implementations should query runtime's active schema.
 */
export function createStaticSchemaProvider(
  templates: readonly AvailableTemplate[],
): OperationSchemaProvider {
  const snapshot = templates.map(cloneTemplate);
  return {
    getTemplates(): AvailableTemplate[] {
      return snapshot.map(cloneTemplate);
    },
  };
}

function cloneTemplate(template: AvailableTemplate): AvailableTemplate {
  return {
    operationTypeId: template.operationTypeId,
    description: template.description,
    requiredRoles: [...template.requiredRoles],
    ...(template.contentRefInputs === undefined
      ? {}
      : {
          contentRefInputs: template.contentRefInputs.map((input) => ({
            name: input.name,
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.required === undefined ? {} : { required: input.required }),
          })),
        }),
    ...(template.scalarInputs === undefined
      ? {}
      : {
          scalarInputs: template.scalarInputs.map((input) => ({
            name: input.name,
            type: input.type,
            ...(input.description === undefined ? {} : { description: input.description }),
            ...(input.required === undefined ? {} : { required: input.required }),
          })),
        }),
  };
}
