/**
 * Start the live coordination supervisors once a runtime handle exists.
 *
 * Swarm is the production watcher (ClusterSupervisor + SwarmScheduler +
 * per-agent CantilunOS). Cluster attaches to that same watcher when the App
 * wires a sibling; starting both independently would drain one feed twice.
 */
export interface SupervisorStartResult {
  readonly ok: boolean;
  readonly message?: string;
}

export interface StartableSupervisor {
  start(): SupervisorStartResult;
}

export function startLiveSupervisors(
  swarm: StartableSupervisor | undefined,
  cluster: StartableSupervisor | undefined,
): SupervisorStartResult {
  if (swarm === undefined && cluster === undefined) {
    return { ok: false, message: "no runtime connected — supervisors were not started" };
  }
  const swarmResult = swarm?.start();
  const clusterResult = cluster?.start();
  if (swarmResult?.ok === true && clusterResult?.ok === true) {
    return { ok: true, message: "cluster and swarm supervisors are live" };
  }
  if (swarmResult?.ok === true) {
    return { ok: true, message: swarmResult.message ?? "swarm supervisor is live" };
  }
  if (clusterResult?.ok === true) {
    return { ok: true, message: clusterResult.message ?? "cluster supervisor is live" };
  }
  return {
    ok: false,
    message:
      clusterResult?.message ?? swarmResult?.message ?? "failed to start cluster/swarm supervisors",
  };
}
