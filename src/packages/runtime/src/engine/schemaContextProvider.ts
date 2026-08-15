import type { ActiveSchemaContext } from "./activeSchemaContext.js";
import type { MutableSchemaContextHolder } from "./memoryEpochAdministration.js";
import type { RuntimeDependencies } from "./runtimeDependencies.js";

export function resolveActiveSchemaContext(
  deps: Pick<RuntimeDependencies, "schemaContext">,
): ActiveSchemaContext {
  const candidate = deps.schemaContext as ActiveSchemaContext | MutableSchemaContextHolder;
  if (typeof candidate === "object" && candidate !== null && "get" in candidate) {
    return (candidate as MutableSchemaContextHolder).get();
  }
  return candidate as ActiveSchemaContext;
}
