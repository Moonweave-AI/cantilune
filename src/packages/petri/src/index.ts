/**
 * @cantilune/petri — a dependency-free Petri-net firing engine.
 *
 * Exports the structural {@link PetriNet} type (reused from the PNML exporter
 * shape), the token-game {@link fire} engine, bounded {@link reachable}
 * analysis, and {@link placeInvariants} (S-invariant) computation. See
 * ADR-0017 for the design and scope.
 */

export * from "./net.js";
export * from "./firing.js";
export * from "./reachability.js";
export * from "./invariants.js";
