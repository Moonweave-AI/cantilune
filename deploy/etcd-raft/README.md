# Official etcd Raft kit (ADR-0029)

Three-node official etcd **v3.5.21**. Cantilune consumes this cluster as `RaftKv`.

`pnpm install` (and `pnpm host:prefetch`) pull the image first. Start does not download:

```bash
pnpm host:prefetch
pnpm host:provision etcd
```

Or, after prefetch:

```bash
docker compose -f deploy/etcd-raft/docker-compose.yml up -d --pull never
```

Then:

```
CANTILUNE_RAFT_ENDPOINTS=http://127.0.0.1:2379,http://127.0.0.1:22379,http://127.0.0.1:32379
```

Single-host embed uses the binary `pnpm install` already wrote to `.cantilune/bin`. Set `CANTILUNE_RAFT_EMBED=1`.
