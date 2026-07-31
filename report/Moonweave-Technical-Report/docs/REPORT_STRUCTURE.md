# Report architecture / 技术报告结构

The default structure synthesizes the recurring strengths of the five supplied
model reports and Moonweave governance requirements.

| Part | Required question | Minimum evidence |
|---|---|---|
| Cover + control | What exact document is this? | owner, status, version, dates, revisions |
| Abstract + executive summary | What changed and what was decided? | headline claim, scope, limitations, decision |
| Context and scope | What problem and use envelope? | goals, non-goals, claim taxonomy |
| System overview | What is the one-page mental model? | boundary diagram, invariants, interface |
| Architecture | How does control and data move? | components, trust boundaries, failure states |
| Data and method | How was evidence produced? | manifest, splits, seeds, metrics, reproduction |
| Infrastructure | Under what operational conditions? | hardware, capacity, failure domains, cost |
| Evaluation | Does it work and compared with what? | baseline, uncertainty, error analysis |
| Safety/governance | Can it fail safely and who approved? | threat model, controls, residual risk, decision |
| Limitations | Where does the claim stop? | negative results, out-of-scope use, external validity |
| Deployment | How is it monitored and reversed? | gates, alerts, owner, rollback rehearsal |
| Appendices | Can another reviewer inspect the chain? | manifests, contributions, checklist, change log |

## Modular rule

One chapter owns one reporting concern. Figures live in `components/`, data in
`data/`, and shared presentation rules in the class/config files. Avoid placing
all content, plot data, and formatting in `main.tex`.

## Evidence-bearing metadata

Moonweave governance materials treat documentation as a single source of truth.
The template therefore includes owner, `last_reviewed`, type, status,
`review_cycle`, version, code revision, data version, model/runtime version,
reviewers, and license fields.

## Adaptation

- A small library may omit training/infrastructure chapters but should retain
  evaluation, limitations, and release evidence.
- A model report should add training-data, capability, misuse, and bias detail.
- An agent report should add tools, permissions, memory, human review, and action
  failure modes.
- A governance report should foreground decision rights, evidence status, accepted
  risk, and change history.

