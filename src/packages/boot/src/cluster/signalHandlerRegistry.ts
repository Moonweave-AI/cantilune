/**
 * Signal handler registry for ClusterSupervisor.
 *
 * Each coordination operation type is handled by a registered signal handler.
 * Dispatch is purely by registry lookup — no if-else or switch.
 */
import type { OperationTypeId, CoordinationChange } from "@cantilune/core";

export type SignalHandler = (change: CoordinationChange) => Promise<void>;

export class SignalHandlerRegistry {
  private readonly handlers = new Map<string, SignalHandler>();

  register(opId: OperationTypeId, handler: SignalHandler): void {
    this.handlers.set(opId as string, handler);
  }

  async dispatch(opId: OperationTypeId, change: CoordinationChange): Promise<void> {
    const handler = this.handlers.get(opId as string);
    if (handler !== undefined) {
      await handler(change);
    }
  }

  has(opId: OperationTypeId): boolean {
    return this.handlers.has(opId as string);
  }
}
