#!/usr/bin/env python3
"""Render Ontotect help, routing, and command cards.

This standard-library CLI is a navigator. It does not parse, reason over,
validate, modify, install, or publish ontology artifacts.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import asdict, dataclass
from typing import Iterable, Sequence


SCENARIO_COMMANDS = (
    "help",
    "router",
    "status",
    "build",
    "review",
    "repair",
    "optimize",
    "refactor",
    "validate",
    "govern",
    "release",
)
ROUTABLE_COMMANDS = tuple(command for command in SCENARIO_COMMANDS if command != "router")
STAGES = (
    "charter",
    "reuse",
    "conceptualize",
    "formalize",
    "implement",
    "verify",
    "release",
)
DIRECT_STAGE_ALIASES = tuple(stage for stage in STAGES if stage != "release")
QA_LEVELS = tuple(f"QA-L{level}" for level in range(6))

READ_ONLY = "read-only: inspect or describe only; do not modify ontology artifacts"
PROJECT_WRITES = (
    "project-scoped writes to the explicitly named target only; no dependency "
    "installation, remote publication, or out-of-scope changes"
)
RELEASE_WRITES = (
    "prepare and verify release-workspace artifacts only; remote publication "
    "requires separate explicit authorization"
)


@dataclass(frozen=True)
class CommandSpec:
    entry_stage: str
    required_inputs: tuple[str, ...]
    gates: tuple[str, ...]
    exit_criterion: str
    mutation_boundary: str


COMMAND_SPECS = {
    "help": CommandSpec(
        "n/a",
        ("optional help topic",),
        ("explain Ontotect and recommend one next command",),
        "The user can choose a command without project mutation.",
        READ_ONLY,
    ),
    "status": CommandSpec(
        "unverified",
        ("work-state artifact or authorized project artifacts",),
        ("reconstruct stage", "separate executed from planned evidence"),
        "Current state, blockers, and the next gate are explicit.",
        READ_ONLY,
    ),
    "build": CommandSpec(
        "charter",
        ("purpose and stakeholders", "scope", "at least one testable CQ"),
        ("A charter", "B reuse", "C conceptualize", "D formalize", "E implement", "F verify"),
        "Requested CQ scope has artifacts and observable acceptance evidence.",
        PROJECT_WRITES,
    ),
    "review": CommandSpec(
        "verify",
        ("frozen target/baseline", "intended contract", "imports/data/shapes/tests as applicable"),
        ("freeze target", "run applicable evidence layers", "trace and report findings"),
        "Every finding is evidence-linked and unchecked layers are explicit.",
        READ_ONLY,
    ),
    "repair": CommandSpec(
        "verify",
        ("reproducible failure", "authorized intended result", "baseline and protected invariants"),
        ("reproduce", "minimize cause", "repair", "regress", "semantic impact"),
        "The defect is resolved and protected invariants pass or remain explicitly unverified.",
        PROJECT_WRITES,
    ),
    "optimize": CommandSpec(
        "implement",
        ("metric and budget", "representative workload", "semantic invariants"),
        ("measure baseline", "locate bottleneck", "change", "compare", "regress"),
        "Before/after evidence meets the target without unauthorized semantic loss.",
        PROJECT_WRITES,
    ),
    "refactor": CommandSpec(
        "implement",
        ("baseline", "semantic preservation contract", "consumer/public IRI surface"),
        ("define invariants", "transform", "semantic diff", "regress"),
        "Structure improves while the agreed contract is preserved or migrations are declared.",
        PROJECT_WRITES,
    ),
    "validate": CommandSpec(
        "verify",
        ("named artifacts", "conformance definition", "expected results and execution regime"),
        ("execute applicable evidence layers", "report each result separately"),
        "Requested checks have pass/fail/error/unverified/not-applicable results, separate exception overlays, and evidence limits.",
        READ_ONLY,
    ),
    "govern": CommandSpec(
        "release",
        ("community/scope", "Owner/DRI", "decision and release authority"),
        ("decision rights", "change/IRI/deprecation policy", "provenance/license", "maintenance"),
        "Governance artifacts, authority gaps, and maintenance gates are explicit.",
        PROJECT_WRITES,
    ),
    "release": CommandSpec(
        "release",
        ("named candidate and baseline", "Stage F evidence", "consumers and release authority"),
        ("preflight", "semantic change/migration", "assemble release set", "disposition"),
        "The candidate has a truthful release disposition and complete coordinated artifact set.",
        RELEASE_WRITES,
    ),
}

STAGE_GATES = {
    "charter": "A: scope, roles, CQs, examples, constraints, and acceptance matrix",
    "reuse": "B: attributable reuse/import/module/mapping decisions",
    "conceptualize": "C: terms, relations, definitions, examples, and ontological commitments",
    "formalize": "D: semantic stack, profile, IRI/import/module, and axiom plan",
    "implement": "E: CQ-sized ontology, shape, query, and fixture slice",
    "verify": "F: independently reported syntax, logic, CQ, SHACL, review, and operational evidence",
    "release": "G: semantic change, migration, coordinated release set, approvals, and maintenance",
}

COMMAND_KEYWORDS = {
    "help": (
        "help", "getting started", "how to use", "what is ontotect",
        "帮助", "入门", "怎么用", "如何使用", "是什么",
    ),
    "status": (
        "status", "progress", "next gate", "work state",
        "状态", "进度", "下一阶段", "工作状态",
    ),
    "build": (
        "build", "create", "design", "construct", "extend", "new ontology", "model",
        "构建", "创建", "设计", "建模", "扩展", "新建",
    ),
    "review": (
        "review", "audit", "assess", "inspect", "critique", "find defects", "find issues",
        "审核", "审查", "评审", "评估", "找问题", "质量检查",
    ),
    "repair": (
        "repair", "fix", "debug", "failing", "failure", "wrong entailment", "broken", "conflict",
        "修复", "修正", "排错", "失败", "错误推理", "冲突", "不可满足",
    ),
    "optimize": (
        "optimize", "performance", "latency", "memory", "benchmark", "scale", "speed up",
        "优化", "性能", "延迟", "内存", "基准", "规模", "提速",
    ),
    "refactor": (
        "refactor", "reorganize", "modularize", "preserve semantics", "semantic-preserving",
        "重构", "重组", "模块化", "保持语义", "语义不变", "整理结构",
    ),
    "validate": (
        "validate", "verification", "conformance", "reasoner", "shacl", "consistency", "run tests",
        "验证", "校验", "合规", "推理器", "一致性", "运行测试",
    ),
    "govern": (
        "governance", "owner", "policy", "versioning", "deprecation", "provenance", "license", "maintenance",
        "治理", "权责", "所有者", "策略", "版本", "弃用", "溯源", "许可", "维护",
    ),
    "release": (
        "release", "publish", "package", "migration", "distribution",
        "发布", "发行", "上线", "打包", "迁移", "分发",
    ),
}

STAGE_KEYWORDS = {
    "charter": ("charter", "scope", "requirements", "competency question", "project brief", "范围", "需求", "胜任力问题", "项目简报"),
    "reuse": ("reuse", "import", "candidate ontology", "mapping candidate", "复用", "导入", "候选本体", "映射候选"),
    "conceptualize": ("conceptualize", "conceptual model", "taxonomy", "identity", "role", "term inventory", "概念化", "概念模型", "分类体系", "同一性", "角色", "术语清单"),
    "formalize": ("formalize", "owl profile", "axiom", "iri policy", "semantic stack", "形式化", "正式化", "owl 配置", "公理", "iri 策略", "语义栈"),
    "implement": ("implement", "turtle", "shape", "fixture", "write ttl", "实现", "编写 ttl", "形状", "测试数据"),
    "verify": ("verify", "validate", "reasoner", "shacl", "conformance", "验证", "校验", "推理器", "一致性"),
    "release": ("release", "publish", "migration", "distribution", "发布", "迁移", "分发"),
}

PIPELINE_RANK = {
    "build": 0,
    "review": 10,
    "repair": 20,
    "refactor": 21,
    "optimize": 22,
    "validate": 30,
    "govern": 40,
    "release": 50,
}


@dataclass(frozen=True)
class RouteCard:
    command: str
    entry_stage: str
    pipeline: tuple[str, ...]
    why_this_route: str
    target: str
    mutation_boundary: str
    required_inputs: tuple[str, ...]
    applicable_gates: tuple[str, ...]
    exit_criterion: str
    assumptions: tuple[str, ...]
    unverified: tuple[str, ...]
    next_action: str
    cli_execution: str = "not started; this navigator only rendered a card"


def _contains(text: str, keyword: str) -> bool:
    if any("\u4e00" <= char <= "\u9fff" for char in keyword):
        return keyword in text
    pattern = r"(?<![a-z0-9])" + re.escape(keyword) + r"(?![a-z0-9])"
    return re.search(pattern, text) is not None


def _matches(text: str, mapping: dict[str, tuple[str, ...]]) -> list[str]:
    lowered = text.casefold()
    return [
        name
        for name, keywords in mapping.items()
        if any(_contains(lowered, keyword.casefold()) for keyword in keywords)
    ]


def _ordered_pipeline(commands: Iterable[str]) -> tuple[str, ...]:
    unique = set(commands)
    if "help" in unique:
        return ("help",)
    if "status" in unique:
        return ("status",)
    return tuple(sorted(unique, key=lambda item: PIPELINE_RANK.get(item, 999)))


def _infer_stage(text: str, primary: str) -> str:
    if primary == "help":
        return "n/a"
    if primary == "status":
        return "unverified"
    if primary in {"review", "repair", "validate"}:
        return "verify"
    if primary in {"optimize", "refactor"}:
        return "implement"
    if primary in {"govern", "release"}:
        return "release"
    matches = _matches(text, STAGE_KEYWORDS)
    if primary == "build":
        # A downstream validation or release intent belongs in the pipeline;
        # it must not make a new build skip its unmet construction gates.
        matches = [stage for stage in matches if stage not in {"verify", "release"}]
    if matches:
        return matches[0]
    return COMMAND_SPECS.get(primary, COMMAND_SPECS["build"]).entry_stage


def _pipeline_boundary(pipeline: Sequence[str], plan_only: bool) -> str:
    if plan_only or all(COMMAND_SPECS[item].mutation_boundary == READ_ONLY for item in pipeline):
        return READ_ONLY
    if "release" in pipeline:
        return RELEASE_WRITES
    return PROJECT_WRITES


def infer_route(
    request: str,
    *,
    explicit_command: str | None = None,
    additional_commands: Sequence[str] = (),
    explicit_stage: str | None = None,
    target: str | None = None,
    plan_only: bool = False,
) -> RouteCard:
    """Infer a routing card without inspecting or modifying any target."""

    normalized = request.strip()
    if explicit_command:
        selected = [explicit_command, *additional_commands]
        why = "Explicit command selection overrides keyword inference."
    else:
        selected = _matches(normalized, COMMAND_KEYWORDS)
        if not selected:
            artifact_hint = bool(re.search(r"\.(ttl|owl|rdf|xml|jsonld|nt|nq|trig)\b", normalized.casefold()))
            selected = ["review" if artifact_hint else "build"]
            why = (
                "No decisive mode cue was found; an existing ontology artifact defaults to review."
                if artifact_hint
                else "No decisive mode cue or existing artifact was established; defaulting to build at charter."
            )
        else:
            why = "Bilingual intent cues selected the scenario pipeline; the agent must confirm them against artifacts."

    pipeline = _ordered_pipeline(selected)
    if not pipeline:
        pipeline = ("build",)
    primary = pipeline[0]
    stage = explicit_stage or _infer_stage(normalized, primary)
    spec = COMMAND_SPECS[primary]
    target_text = target or "not specified; identify within the authorized request scope"
    assumptions = (
        "Keyword routing is advisory until the agent inspects the request and authorized artifacts.",
        "A requested entry stage has not been proven to satisfy its prerequisite gates.",
    )
    unverified = (
        "Target artifacts, prerequisites, imports, authority, and prior evidence were not inspected.",
        "No parsing, OWL reasoning, SHACL validation, CQ execution, semantic diff, modification, or publication occurred.",
    )
    return RouteCard(
        command=primary,
        entry_stage=stage,
        pipeline=pipeline,
        why_this_route=why,
        target=target_text,
        mutation_boundary=_pipeline_boundary(pipeline, plan_only),
        required_inputs=spec.required_inputs,
        applicable_gates=spec.gates,
        exit_criterion=spec.exit_criterion,
        assumptions=assumptions,
        unverified=unverified,
        next_action=(
            "Return help and recommend one next command."
            if primary == "help"
            else f"Have the Ontotect agent inspect the target and confirm entry to {stage}; this CLI will not execute it."
        ),
    )


def explicit_command_card(
    command: str,
    *,
    target: str | None,
    from_stage: str | None,
    to_stage: str | None,
    qa: str | None,
    plan_only: bool,
    resume: str | None,
    request: str,
) -> RouteCard:
    stage = from_stage or COMMAND_SPECS[command].entry_stage
    card = infer_route(
        request,
        explicit_command=command,
        explicit_stage=stage,
        target=target,
        plan_only=plan_only,
    )
    assumptions = list(card.assumptions)
    if to_stage:
        assumptions.append(f"Requested stop stage: {to_stage}.")
    if qa:
        assumptions.append(f"Requested evidence target: {qa}; it is not yet achieved.")
    if resume:
        assumptions.append(f"Resume artifact named but not inspected by this CLI: {resume}.")
    return RouteCard(**{**asdict(card), "assumptions": tuple(assumptions)})


def stage_card(stage: str, target: str | None, plan_only: bool) -> RouteCard:
    boundary = READ_ONLY if plan_only or stage == "verify" else (RELEASE_WRITES if stage == "release" else PROJECT_WRITES)
    return RouteCard(
        command="stage",
        entry_stage=stage,
        pipeline=(f"stage:{stage}",),
        why_this_route="An explicit lifecycle-stage command overrides automatic stage inference.",
        target=target or "not specified; identify within the authorized request scope",
        mutation_boundary=boundary,
        required_inputs=(f"entry evidence required by {stage}", "authorized target and responsible Owner/DRI"),
        applicable_gates=(STAGE_GATES[stage],),
        exit_criterion=f"Stage {stage} has a truthful gate disposition and the next gate is stated without entering it.",
        assumptions=("Prior-stage prerequisites have not been inspected by this CLI.",),
        unverified=(
            "No project artifact or prior gate was inspected.",
            "No ontology engineering operation was executed.",
        ),
        next_action=f"Have the Ontotect agent verify prerequisites and execute only Stage {stage}.",
    )


def help_card(topic: str = "") -> dict[str, object]:
    return {
        "kind": "Ontotect help card",
        "summary": (
            "Ontotect engineers governed, testable ontologies while separating "
            "domain commitments, logical entailment, graph constraints, queries, and release evidence."
        ),
        "topic": topic or "getting started",
        "commands": list(SCENARIO_COMMANDS),
        "router_alias": "route",
        "stages": list(STAGES),
        "portable_invocation": "Use Ontotect. Command: <command>. Target: <path-or-IRI>. <request>",
        "examples": [
            "$ontotect build ./ontology --from-stage charter --to-stage verify",
            "$ontotect review ./ontology.ttl",
            "$ontotect router '审核并修复这个本体，然后验证 SHACL'",
        ],
        "cli_limit": "This navigator only renders cards; it performs no ontology engineering.",
        "next_command": "router",
    }


def _render_value(value: object, indent: str = "") -> list[str]:
    if isinstance(value, (list, tuple)):
        return [f"{indent}- {item}" for item in value] or [f"{indent}- none"]
    return [f"{indent}{value}"]


def render_card(card: RouteCard) -> str:
    data = asdict(card)
    labels = {
        "command": "Command",
        "entry_stage": "Entry stage",
        "pipeline": "Pipeline",
        "why_this_route": "Why this route",
        "target": "Target",
        "mutation_boundary": "Mutation boundary",
        "required_inputs": "Required inputs",
        "applicable_gates": "Applicable gates",
        "exit_criterion": "Exit criterion",
        "assumptions": "Assumptions",
        "unverified": "Unverified",
        "next_action": "Next action",
        "cli_execution": "CLI execution",
    }
    lines = ["Ontotect Route/Command Card"]
    for key, value in data.items():
        if isinstance(value, (list, tuple)):
            lines.append(f"{labels[key]}:")
            lines.extend(_render_value(value, "  "))
        else:
            lines.append(f"{labels[key]}: {value}")
    return "\n".join(lines)


def render_help(card: dict[str, object]) -> str:
    lines = ["Ontotect Help", str(card["summary"]), f"Topic: {card['topic']}"]
    lines.append("Commands: " + ", ".join(card["commands"]))  # type: ignore[arg-type]
    lines.append("Router alias: route")
    lines.append("Stages: " + ", ".join(card["stages"]))  # type: ignore[arg-type]
    lines.append("Portable invocation: " + str(card["portable_invocation"]))
    lines.append("Examples:")
    lines.extend(f"- {item}" for item in card["examples"])  # type: ignore[union-attr]
    lines.append("Limit: " + str(card["cli_limit"]))
    lines.append("Recommended next command: router")
    return "\n".join(lines)


def _add_json_option(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--json", action="store_true", help="Emit the card as JSON.")


def _add_command_options(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("target", nargs="?", help="Target path, IRI, module, dataset, or project.")
    parser.add_argument("request", nargs="*", help="Additional natural-language request.")
    parser.add_argument("--from-stage", choices=STAGES)
    parser.add_argument("--to-stage", choices=STAGES)
    parser.add_argument("--qa", choices=QA_LEVELS)
    parser.add_argument("--plan-only", action="store_true")
    parser.add_argument("--resume", help="Work-state artifact to be inspected by the agent.")
    _add_json_option(parser)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="ontotect",
        description="Render Ontotect navigation cards; no ontology engineering is executed.",
    )
    subparsers = parser.add_subparsers(dest="subcommand")

    help_parser = subparsers.add_parser("help", help="Show Ontotect onboarding and commands.")
    help_parser.add_argument("topic", nargs="*", help="Optional command or ontology-engineering topic.")
    _add_json_option(help_parser)

    router_parser = subparsers.add_parser(
        "router", aliases=["route"], help="Infer a route from an English or Chinese request."
    )
    router_parser.add_argument("request", nargs="*", help="Natural-language request to classify.")
    router_parser.add_argument("--command", choices=ROUTABLE_COMMANDS, help="Explicit primary command; overrides inference.")
    router_parser.add_argument("--also", action="append", choices=ROUTABLE_COMMANDS, default=[], help="Add an explicit pipeline command.")
    router_parser.add_argument("--stage", choices=STAGES, help="Explicit entry stage.")
    router_parser.add_argument("--target", help="Target path, IRI, module, dataset, or project.")
    router_parser.add_argument("--plan-only", action="store_true", help="Keep the proposed pipeline read-only.")
    _add_json_option(router_parser)

    for command in ("status", "build", "review", "repair", "optimize", "refactor", "validate", "govern", "release"):
        command_parser = subparsers.add_parser(command, help=f"Render a {command} command card.")
        _add_command_options(command_parser)

    stage_parser = subparsers.add_parser("stage", help="Render one lifecycle-stage card.")
    stage_parser.add_argument("stage", choices=STAGES)
    stage_parser.add_argument("target", nargs="?")
    stage_parser.add_argument("--plan-only", action="store_true")
    _add_json_option(stage_parser)

    for stage in DIRECT_STAGE_ALIASES:
        alias_parser = subparsers.add_parser(stage, help=f"Alias for 'stage {stage}'.")
        alias_parser.add_argument("target", nargs="?")
        alias_parser.add_argument("--plan-only", action="store_true")
        _add_json_option(alias_parser)

    return parser


def _emit(value: RouteCard | dict[str, object], json_output: bool) -> None:
    if json_output:
        payload = asdict(value) if isinstance(value, RouteCard) else value
        print(json.dumps(payload, ensure_ascii=False, indent=2))
    elif isinstance(value, RouteCard):
        print(render_card(value))
    else:
        print(render_help(value))


def main(argv: Sequence[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    command = args.subcommand
    if command is None:
        _emit(help_card(), False)
        return 0
    if command == "help":
        _emit(help_card(" ".join(args.topic)), args.json)
        return 0
    if command in {"router", "route"}:
        card = infer_route(
            " ".join(args.request),
            explicit_command=args.command,
            additional_commands=args.also,
            explicit_stage=args.stage,
            target=args.target,
            plan_only=args.plan_only,
        )
        _emit(card, args.json)
        return 0
    if command == "stage":
        _emit(stage_card(args.stage, args.target, args.plan_only), args.json)
        return 0
    if command in DIRECT_STAGE_ALIASES:
        _emit(stage_card(command, args.target, args.plan_only), args.json)
        return 0

    request = " ".join(args.request)
    card = explicit_command_card(
        command,
        target=args.target,
        from_stage=args.from_stage,
        to_stage=args.to_stage,
        qa=args.qa,
        plan_only=args.plan_only,
        resume=args.resume,
        request=request,
    )
    _emit(card, args.json)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
