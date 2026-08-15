# Ontotect Route Card

```text
Command: <help|router|status|build|review|repair|optimize|refactor|validate|govern|release|stage>
Entry stage: <n/a for help | reconstructed/unverified for status | charter|reuse|conceptualize|formalize|implement|verify|release>
Pipeline: <ordered commands>
Why this route: <request and artifact evidence>
Alternative considered: <route and why not selected>

Target: <path, IRI, module, dataset, or project>
Baseline: <existing VCS reference/copy/release, or not yet established>
Mutation boundary: <read-only or exact authorized artifact scope>

Required inputs:
- <input>

Applicable gates:
- <gate and expected evidence>

Exit criterion: <observable condition>
Assumptions: <explicit assumptions>
Unverified: <checks, prerequisites, authority, or evidence not yet established>
Next action: <first bounded action>
```

An explicit `router`/`route` command stops after this card unless the user asks
to continue. Automatic routing at normal Ontotect entry emits the card and then
continues within the stated mutation boundary.
