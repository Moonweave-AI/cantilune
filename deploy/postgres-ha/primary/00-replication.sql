-- Official streaming replication role (PostgreSQL 16 §26.2.5).
-- Local-only default password; override by editing before first initdb.
CREATE ROLE replicator WITH REPLICATION LOGIN PASSWORD 'cantilune_replica';
