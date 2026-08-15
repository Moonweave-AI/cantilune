# Agent compatibility

Ontotect uses the open Agent Skills directory format: one `ontotect/` directory containing `SKILL.md`, optional `scripts/`, `references/`, `assets/`, and product metadata under `agents/`. Keep the directory intact so relative links continue to work.

## Portability rules

- Keep only `name` and `description` in `SKILL.md` frontmatter. Host-specific fields are not required for execution.
- Keep the directory name and `name` equal to `ontotect`; use lowercase kebab-case identifiers.
- Reference bundled files with paths relative to `SKILL.md`.
- Do not depend on Claude-only command interpolation, host-specific tool names, or implicit shell syntax.
- Treat `agents/openai.yaml` as optional Codex UI metadata. Other hosts may ignore it safely.
- Let the host enforce permissions. Ontotect must request confirmation before installing packages, writing outside the requested project, publishing, or changing remote resources.
- Run Python scripts with the host's available Python 3 interpreter. Each script must fail with an actionable dependency message when an optional ontology library is absent.

## Installation locations

Copy the complete `ontotect/` directory to one of the host's discovered roots:

| Host | Project location | User/global location | Refresh |
|---|---|---|---|
| Cursor | `.cursor/skills/ontotect/` | `~/.cursor/skills/ontotect/` | Start a new session or reload the skill list. |
| Codex | `.agents/skills/ontotect/` at the working directory, an ancestor, or repository root. | Current public discovery docs list `~/.agents/skills/ontotect/`; the built-in creator/managed installer also uses `$CODEX_HOME/skills/ontotect/` (default `~/.codex/skills/ontotect/`). | Codex normally detects changes; restart when a client does not refresh. |
| Kilo | `.kilo/skills/ontotect/` or `.agents/skills/ontotect/` | `~/.kilo/skills/ontotect/` | Use `/reload` or start a new session. |
| OpenCode | `.opencode/skills/ontotect/`, `.agents/skills/ontotect/`, or `.claude/skills/ontotect/` | `~/.config/opencode/skills/ontotect/`, `~/.agents/skills/ontotect/`, or `~/.claude/skills/ontotect/` | Start a new session or use the host's reload mechanism. |
| Claude Code | `.claude/skills/ontotect/` | `~/.claude/skills/ontotect/` | Live reload normally works; restart when the top-level skills directory was created after session start. |

For a mixed-tool repository, use `.agents/skills/ontotect/` for Kilo and OpenCode, then mirror the same directory into `.cursor/skills/`, `.claude/skills/`, and the configured Codex root. Prefer a copy or package-manager installation over filesystem links when the tools run on different operating systems or containers.

Run `python scripts/install_skill.py --help` from the skill directory for a dry-run-capable installer. It never overwrites an existing skill unless `--force` is supplied.

## Host behavior to test

For every claimed host:

1. Confirm `ontotect` appears in the available skill list.
2. Ask a trigger-matching request such as: `Review this OWL ontology for logical, SHACL, and governance defects.`
3. Confirm the host loads `SKILL.md` and can read `references/workflow.md` on demand.
4. Confirm relative links resolve from the skill directory.
5. Run `python scripts/ontology_audit.py --help` without requiring host-specific environment variables.
6. Confirm the skill does not auto-execute scripts or request permissions merely by loading.

Treat a successful frontmatter parse as structural compatibility only. Behavioral compatibility also requires the host to expose file reads and, for automation, a user-approved command tool.

## Authoritative host references

- Agent Skills open specification: https://agentskills.io and https://github.com/agentskills/agentskills/blob/main/docs/specification.mdx
- Cursor Agent Skills announcement: https://cursor.com/changelog/2-4
- Codex skills documentation: https://developers.openai.com/codex/skills
- Codex skill-creator reference in the official repository: https://github.com/openai/codex/blob/main/codex-rs/skills/src/assets/samples/skill-creator/SKILL.md
- Kilo Skills: https://kilo.ai/docs/customize/skills
- OpenCode Agent Skills: https://opencode.ai/docs/skills/
- Claude Code Skills: https://code.claude.com/docs/en/slash-commands

Recheck these paths when packaging a release because host discovery rules are product behavior and can change.
