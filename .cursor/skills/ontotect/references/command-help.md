# `help` command

Use `help` for first contact, command discovery, or a short explanation of an
ontology-engineering concept. It is read-only and does not inspect or modify a
project unless the user separately asks for project-specific orientation.
`help` is a coordination command, not a lifecycle stage. Do not invent an
entry stage or emit a Route Card merely to answer help; if a surrounding host
requires the card envelope, use `Entry stage: n/a`.

## Response contract

Answer in the user's language and keep the first screen useful:

1. Define Ontotect in one sentence.
2. Explain the separation among domain commitments, OWL/RDFS entailment,
   SHACL data constraints, SPARQL acceptance queries, and governance.
3. Show the command table with one-line “use when” guidance.
4. Give three copyable starts: build, review, and repair/validate.
5. Explain automatic routing and that `route` aliases `router`.
6. State that unavailable reasoning, validation, or domain authority remains
   `unverified`.
7. Recommend one next command; do not begin it automatically.

## Minimal examples

```text
Use Ontotect. Command: build. Target: ./ontology. Start from four competency questions.
Use Ontotect. Command: review. Target: ./ontology.ttl. Do not modify files.
Use Ontotect. Command: repair. Target: ./ontology.ttl. Reproduce the failing CQ first.
```

For a topic such as “OWL or SHACL?”, answer the topic first, then name the
relevant command and reference. Do not turn help into an exhaustive textbook
or imply that an editor, parser, reasoner, validator, or linter alone proves
ontology quality.
