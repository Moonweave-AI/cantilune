# Ontotect router

`router` is the canonical command name; `route` is a compatibility alias. When
the user invokes Ontotect without a command, run this router and then continue
with the selected pipeline. When the user explicitly invokes `router` or
`route`, return the Route Card only unless they explicitly ask to continue.

## Routing sequence

Apply these rules in order:

1. Honor `help`, explicit `router`, `status`, and `--plan-only` first.
2. Honor an explicit scenario command and explicit stage.
3. Establish the mutation boundary. A read-only request cannot become a repair,
   refactor, optimization, or publication merely because a defect is visible.
4. Prefer a demonstrated contract failure over structural or performance work.
5. Infer scenario intent from the requested outcome.
6. Infer the first unmet lifecycle stage from available artifacts and evidence.
7. Compose multiple authorized intents into the canonical pipeline.
8. Emit a Route Card before loading engineering command references. For
   automatic `help` or `status`, dispatch directly to that coordination
   response; explicit `router` still returns its Route Card.

## Scenario signals

Use meaning, not substring count alone. These bilingual cues are routing aids:

| Command | English cues | 中文线索 |
|---|---|---|
| `help` | help, getting started, how to use, what is Ontotect | 帮助、入门、怎么用、Ontotect 是什么 |
| `status` | status, progress, resume, next gate | 状态、进度、恢复、下一阶段 |
| `build` | build, create, design, construct, extend, model | 构建、创建、设计、建模、扩展、新建 |
| `review` | review, audit, assess, inspect, critique, find defects | 审核、审查、评审、评估、找问题、质量检查 |
| `repair` | repair, fix, debug, failing, wrong entailment, conflict | 修复、修正、排错、失败、错误推理、冲突、不可满足 |
| `optimize` | optimize, latency, memory, scale, benchmark, performance | 优化、延迟、内存、规模、基准、性能 |
| `refactor` | refactor, reorganize, modularize, preserve semantics | 重构、重组、模块化、保持语义、整理结构 |
| `validate` | validate, conformance, reasoner, SHACL, test, consistency | 验证、校验、合规、推理器、SHACL、测试、一致性 |
| `govern` | governance, owner, policy, versioning, deprecation, provenance | 治理、权责、所有者、策略、版本、弃用、溯源、许可 |
| `release` | release, publish, package, migration, distribution | 发布、发行、上线、打包、迁移、分发 |

Tie-breakers:

- A failing requirement, CQ, inference, shape, mapping, or build selects
  `repair`; a structure-only change under a protected contract selects
  `refactor`; a measured cost selects `optimize`.
- A request to find and explain defects selects `review`; a request to execute
  named checks selects `validate`.
- Ownership and policy select `govern`; packaging and release disposition
  select `release`. Remote publication still requires explicit authorization.
- With an existing ontology and no stronger signal, choose `review`. With no
  ontology artifact, choose `build` at `charter`.

## Stage selection

This table applies to engineering scenario commands. For coordination,
`help` uses `n/a`; `status` reports the stage reconstructed from durable
evidence, or `unverified` when none can be established.

| First unmet evidence | Entry stage |
|---|---|
| Purpose, scope, stakeholders, CQs, or acceptance evidence | `charter` (A) |
| Reuse/import/mapping assessment | `reuse` (B) |
| Categories, taxonomy, identity, roles, relations, or examples | `conceptualize` (C) |
| Semantic stack, profile, IRI/import/module policy, or axiom plan | `formalize` (D) |
| Vertical slice, ontology/shapes/queries/fixtures | `implement` (E) |
| Executed syntax, logic, CQ, SHACL, review, or operational evidence | `verify` (F) |
| Change classification, migration, approval, and coordinated distribution | `release` (G) |

Mode-specific defaults override simple stage inference: `review` and
`validate` begin with a frozen verification contract; `repair` begins by
reproducing the failure; `refactor` begins with a preservation contract;
`optimize` begins with a measured baseline; `govern` begins with authority and
decision rights; `release` begins with a verification preflight.

## Multi-intent pipeline

Normalize authorized work to:

```text
review
  -> repair | refactor | optimize
  -> validate
  -> govern
  -> release
```

Do not silently turn “review” into “review and repair.” Phrases such as “review
then fix” or “审核并修复” authorize the two-stage pipeline; a vague suggestion
to improve does not. If `repair`, `refactor`, and `optimize` are all requested,
keep each as a separate stage and state its own completion criterion.

## Route Card decision

The Route Card must state:

- selected command, entry stage, and pipeline;
- evidence-based reason and any plausible alternative;
- target and baseline;
- mutation boundary;
- required inputs and applicable gates;
- exit criterion;
- assumptions and checks still `unverified`;
- immediate next action.

Ask one blocking question only when different answers would materially change
the ontology commitment, permitted mutation, or release authority. Otherwise
choose the narrowest useful route and make the assumption visible.
