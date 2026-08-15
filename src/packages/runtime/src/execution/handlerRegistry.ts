import type { ActorRef, OperationTypeId } from "@cantilune/core";
import type { CollaborationSnapshot } from "@cantilune/core";
import type { SessionId } from "@cantilune/core";
import type { ReplayRecipe } from "../replay/recipe.js";
import type { ApplyContext } from "./applyContext.js";

export type ApplyResult =
  | {
      readonly ok: true;
      readonly after: CollaborationSnapshot;
      readonly involved: readonly ActorRef[];
      readonly createdSessionRefs: readonly SessionId[];
    }
  | { readonly ok: false; readonly reason: string };

export type OperationHandler = (
  before: CollaborationSnapshot,
  recipe: ReplayRecipe,
  ctx: ApplyContext,
) => ApplyResult;

export interface OperationHandlerRegistry {
  register(operationTypeId: OperationTypeId, handler: OperationHandler, revision?: string): void;
  get(operationTypeId: OperationTypeId, revision?: string): OperationHandler | undefined;
}

export class InMemoryHandlerRegistry implements OperationHandlerRegistry {
  private readonly handlers = new Map<string, OperationHandler>();

  register(operationTypeId: OperationTypeId, handler: OperationHandler, revision?: string): void {
    this.handlers.set(handlerKey(operationTypeId, revision), handler);
    if (revision === undefined) {
      this.handlers.set(operationTypeId, handler);
    } else if (!this.handlers.has(operationTypeId)) {
      this.handlers.set(operationTypeId, handler);
    }
  }

  get(operationTypeId: OperationTypeId, revision?: string): OperationHandler | undefined {
    if (revision !== undefined) {
      return this.handlers.get(handlerKey(operationTypeId, revision));
    }
    return this.handlers.get(operationTypeId);
  }
}

function handlerKey(operationTypeId: OperationTypeId, revision?: string): string {
  return revision !== undefined ? `${operationTypeId}@${revision}` : operationTypeId;
}
