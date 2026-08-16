# Operator Postgres HA kit (ADR-0023)

Official PostgreSQL 16 streaming + `FIRST 1 (replica)`.

`pnpm install` (and `pnpm host:prefetch`) pull `postgres:16` first. Start does not download:

```bash
pnpm host:prefetch
pnpm host:provision postgres
```

Or, after prefetch:

```bash
docker compose -f deploy/postgres-ha/docker-compose.yml up -d --pull never
```
