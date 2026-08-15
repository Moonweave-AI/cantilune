import type { ActorRef } from "@cantilune/core";

/** Trusted principal established by control-plane entry — not caller-supplied strings. */
export interface AdministrationPrincipal {
  readonly actorRef: ActorRef;
  readonly roles: readonly string[];
  readonly scopes: readonly string[];
}

/** Server-side administration context; callers must obtain this from a trusted gateway. */
export interface AdministrationContext {
  readonly principal: AdministrationPrincipal;
  readonly issuedAt: string;
  readonly sessionId: string;
}

export function administrationActor(context: AdministrationContext): ActorRef {
  return context.principal.actorRef;
}

export function administrationActorId(context: AdministrationContext): string {
  return context.principal.actorRef.actorId as string;
}

export function actorIdsEqual(left: ActorRef | string, right: ActorRef | string): boolean {
  const leftId = typeof left === "string" ? left : (left.actorId as string);
  const rightId = typeof right === "string" ? right : (right.actorId as string);
  return leftId === rightId;
}

export function hasRole(context: AdministrationContext, role: string): boolean {
  return context.principal.roles.includes(role);
}

export function hasScope(context: AdministrationContext, scope: string): boolean {
  return context.principal.scopes.includes(scope);
}
