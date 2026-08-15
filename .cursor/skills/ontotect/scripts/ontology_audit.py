#!/usr/bin/env python3
"""Advisory RDF/OWL structure audit with optional SHACL validation.

Requires RDFLib. SHACL validation additionally requires pySHACL. This script
does not perform complete OWL consistency, satisfiability, profile, or
entailment checking; use a suitable reasoner/ROBOT pipeline for those claims.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import Counter, defaultdict
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable


try:
    from rdflib import BNode, Graph, Literal, Namespace, RDF, RDFS, URIRef
    from rdflib.namespace import DCTERMS, OWL, SKOS
except ImportError as exc:  # pragma: no cover - exercised without dependency
    print(
        "error: ontology_audit.py requires RDFLib. "
        "Install it in an approved environment with: python -m pip install rdflib",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc


SH = Namespace("http://www.w3.org/ns/shacl#")
IAO = Namespace("http://purl.obolibrary.org/obo/IAO_")
OBOINOWL = Namespace("http://www.geneontology.org/formats/oboInOwl#")
SCHEMA = Namespace("https://schema.org/")

STANDARD_NAMESPACES = (
    str(RDF),
    str(RDFS),
    str(OWL),
    str(SKOS),
    str(DCTERMS),
    str(SH),
    "http://www.w3.org/2001/XMLSchema#",
)

DECLARATION_TYPES = {
    OWL.Class,
    RDFS.Class,
    OWL.ObjectProperty,
    OWL.DatatypeProperty,
    OWL.AnnotationProperty,
    RDF.Property,
    OWL.NamedIndividual,
}
PROPERTY_TYPES = {
    OWL.ObjectProperty,
    OWL.DatatypeProperty,
    OWL.AnnotationProperty,
    RDF.Property,
}
DEFINITION_PROPERTIES = {
    SKOS.definition,
    DCTERMS.description,
    RDFS.comment,
    URIRef("http://purl.obolibrary.org/obo/IAO_0000115"),
}
TITLE_PROPERTIES = {DCTERMS.title, RDFS.label, SCHEMA.name}
DESCRIPTION_PROPERTIES = {DCTERMS.description, RDFS.comment, SCHEMA.description}
CREATOR_PROPERTIES = {DCTERMS.creator, SCHEMA.creator}
LICENSE_PROPERTIES = {DCTERMS.license, SCHEMA.license}
REPLACEMENT_PROPERTIES = {
    DCTERMS.isReplacedBy,
    URIRef("http://purl.obolibrary.org/obo/IAO_0100001"),
    OBOINOWL.consider,
}

SEVERITY_RANK = {"info": 1, "warning": 2, "error": 3}


@dataclass(frozen=True)
class Finding:
    code: str
    severity: str
    subject: str
    message: str
    evidence: str = ""


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("ontology", type=Path, help="Ontology/RDF document to audit.")
    parser.add_argument("--format", help="Explicit RDFLib parser format.")
    parser.add_argument("--data", type=Path, help="Data graph for SHACL validation.")
    parser.add_argument("--shapes", type=Path, help="SHACL shapes graph.")
    parser.add_argument("--data-format", help="Explicit RDFLib data graph format.")
    parser.add_argument("--shapes-format", help="Explicit RDFLib shapes format.")
    parser.add_argument(
        "--inference",
        choices=("none", "rdfs", "owlrl", "both"),
        default="none",
        help="pySHACL inference option (default: none).",
    )
    parser.add_argument(
        "--advanced",
        action="store_true",
        help="Enable pySHACL advanced features when validating shapes.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        help="Write the complete JSON report to this file.",
    )
    parser.add_argument("--json", action="store_true", help="Print JSON to stdout.")
    parser.add_argument(
        "--fail-on",
        choices=("none", "warning", "error"),
        default="none",
        help="Return exit 1 at or above this advisory severity (default: none).",
    )
    parser.add_argument(
        "--include-standard-terms",
        action="store_true",
        help="Audit declarations in RDF/RDFS/OWL/SKOS/SHACL namespaces too.",
    )
    return parser.parse_args()


def guess_format(path: Path) -> str | None:
    suffix = path.suffix.lower()
    return {
        ".ttl": "turtle",
        ".rdf": "xml",
        ".owl": "xml",
        ".xml": "xml",
        ".nt": "nt",
        ".nq": "nquads",
        ".trig": "trig",
        ".jsonld": "json-ld",
        ".json": "json-ld",
    }.get(suffix)


def load_graph(path: Path, rdf_format: str | None) -> Graph:
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")
    graph = Graph()
    graph.parse(path, format=rdf_format or guess_format(path))
    return graph


def is_public_term(term: Any, include_standard: bool) -> bool:
    if not isinstance(term, URIRef):
        return False
    text = str(term)
    return include_standard or not text.startswith(STANDARD_NAMESPACES)


def declarations(graph: Graph) -> dict[Any, set[Any]]:
    result: dict[Any, set[Any]] = defaultdict(set)
    for subject, rdf_type in graph.subject_objects(RDF.type):
        if rdf_type in DECLARATION_TYPES:
            result[subject].add(rdf_type)
    return result


def has_any(graph: Graph, subject: Any, predicates: Iterable[Any]) -> bool:
    return any(next(graph.objects(subject, predicate), None) is not None for predicate in predicates)


def literal_is_true(value: Any) -> bool:
    if isinstance(value, Literal):
        try:
            return bool(value.toPython()) is True
        except (TypeError, ValueError):
            return str(value).strip().lower() == "true"
    return False


def metadata_findings(graph: Graph, ontology_nodes: list[Any]) -> list[Finding]:
    findings: list[Finding] = []
    if not ontology_nodes:
        return [
            Finding(
                "META-001",
                "warning",
                "",
                "No owl:Ontology declaration was found.",
            )
        ]
    if len(ontology_nodes) > 1:
        findings.append(
            Finding(
                "META-002",
                "warning",
                "",
                "Multiple owl:Ontology declarations were found; confirm document boundaries.",
                ", ".join(sorted(map(str, ontology_nodes))),
            )
        )
    for node in ontology_nodes:
        required_groups = (
            ("META-003", TITLE_PROPERTIES, "title or label"),
            ("META-004", DESCRIPTION_PROPERTIES, "description or comment"),
            ("META-005", CREATOR_PROPERTIES, "creator"),
            ("META-006", LICENSE_PROPERTIES, "license"),
        )
        for code, predicates, label in required_groups:
            if not has_any(graph, node, predicates):
                findings.append(
                    Finding(code, "warning", str(node), f"Ontology metadata lacks {label}.")
                )
        if next(graph.objects(node, OWL.versionIRI), None) is None:
            findings.append(
                Finding(
                    "META-007",
                    "info",
                    str(node),
                    "Ontology has no owl:versionIRI; confirm the project's version policy.",
                )
            )
    return findings


def term_findings(
    graph: Graph, declared: dict[Any, set[Any]], include_standard: bool
) -> list[Finding]:
    findings: list[Finding] = []
    for subject, types in sorted(declared.items(), key=lambda item: str(item[0])):
        if isinstance(subject, BNode):
            findings.append(
                Finding(
                    "TERM-001",
                    "warning",
                    str(subject),
                    "A vocabulary declaration uses a blank node; public terms need persistent IRIs.",
                    ", ".join(sorted(map(str, types))),
                )
            )
            continue
        if not is_public_term(subject, include_standard):
            continue
        labels = list(graph.objects(subject, RDFS.label))
        if not labels:
            findings.append(
                Finding("TERM-002", "warning", str(subject), "Public term lacks rdfs:label.")
            )
        if not has_any(graph, subject, DEFINITION_PROPERTIES):
            findings.append(
                Finding(
                    "TERM-003",
                    "warning",
                    str(subject),
                    "Public term lacks a recognized definition/comment property.",
                )
            )
        by_language: Counter[str] = Counter(
            (label.language or "") for label in labels if isinstance(label, Literal)
        )
        duplicates = sorted(lang or "[no language]" for lang, count in by_language.items() if count > 1)
        if duplicates:
            findings.append(
                Finding(
                    "TERM-004",
                    "info",
                    str(subject),
                    "Multiple rdfs:label values share a language; confirm the preferred-label policy.",
                    ", ".join(duplicates),
                )
            )

        deprecated = any(literal_is_true(value) for value in graph.objects(subject, OWL.deprecated))
        if deprecated and not has_any(graph, subject, REPLACEMENT_PROPERTIES):
            findings.append(
                Finding(
                    "TERM-005",
                    "info",
                    str(subject),
                    "Deprecated term has no recognized replacement/consider annotation.",
                )
            )
    return findings


def label_collision_findings(
    graph: Graph, declared: dict[Any, set[Any]], include_standard: bool
) -> list[Finding]:
    index: dict[tuple[str, str], set[str]] = defaultdict(set)
    for subject in declared:
        if not is_public_term(subject, include_standard):
            continue
        for label in graph.objects(subject, RDFS.label):
            if isinstance(label, Literal):
                normalized = re.sub(r"\s+", " ", str(label).strip()).casefold()
                index[(normalized, label.language or "")].add(str(subject))
    findings: list[Finding] = []
    for (label, language), subjects in sorted(index.items()):
        if label and len(subjects) > 1:
            findings.append(
                Finding(
                    "LABEL-001",
                    "info",
                    "",
                    f"The same normalized label is used by {len(subjects)} public terms.",
                    f"{label!r}@{language or '[none]'}: " + ", ".join(sorted(subjects)),
                )
            )
    return findings


def strongly_connected_components(edges: dict[Any, set[Any]]) -> list[list[Any]]:
    index = 0
    stack: list[Any] = []
    on_stack: set[Any] = set()
    indices: dict[Any, int] = {}
    lowlinks: dict[Any, int] = {}
    components: list[list[Any]] = []

    def visit(node: Any) -> None:
        nonlocal index
        indices[node] = index
        lowlinks[node] = index
        index += 1
        stack.append(node)
        on_stack.add(node)

        for target in edges.get(node, set()):
            if target not in indices:
                visit(target)
                lowlinks[node] = min(lowlinks[node], lowlinks[target])
            elif target in on_stack:
                lowlinks[node] = min(lowlinks[node], indices[target])

        if lowlinks[node] == indices[node]:
            component: list[Any] = []
            while True:
                current = stack.pop()
                on_stack.remove(current)
                component.append(current)
                if current == node:
                    break
            components.append(component)

    for node in set(edges) | {target for values in edges.values() for target in values}:
        if node not in indices:
            visit(node)
    return components


def hierarchy_findings(graph: Graph) -> list[Finding]:
    edges: dict[Any, set[Any]] = defaultdict(set)
    for child, parent in graph.subject_objects(RDFS.subClassOf):
        if isinstance(child, URIRef) and isinstance(parent, URIRef) and child != parent:
            edges[child].add(parent)
    findings: list[Finding] = []
    for component in strongly_connected_components(edges):
        if len(component) > 1:
            findings.append(
                Finding(
                    "TAXON-001",
                    "warning",
                    "",
                    "Named classes form a subclass cycle; confirm equivalence or repair direction.",
                    " -> ".join(sorted(map(str, component))),
                )
            )
    return findings


def axiom_findings(graph: Graph, declared: dict[Any, set[Any]]) -> list[Finding]:
    findings: list[Finding] = []
    for subject, obj in graph.subject_objects(OWL.sameAs):
        subject_types = declared.get(subject, set())
        object_types = declared.get(obj, set())
        if subject_types & ({OWL.Class, RDFS.Class} | PROPERTY_TYPES) or object_types & (
            {OWL.Class, RDFS.Class} | PROPERTY_TYPES
        ):
            findings.append(
                Finding(
                    "AXIOM-001",
                    "warning",
                    str(subject),
                    "owl:sameAs involves a declared class/property; confirm identity-level metamodeling.",
                    str(obj),
                )
            )

    for prop in declared:
        if not (declared[prop] & PROPERTY_TYPES):
            continue
        domains = sorted(map(str, graph.objects(prop, RDFS.domain)))
        ranges = sorted(map(str, graph.objects(prop, RDFS.range)))
        if len(domains) > 1:
            findings.append(
                Finding(
                    "AXIOM-002",
                    "info",
                    str(prop),
                    "Property has multiple rdfs:domain axioms; RDFS interprets them conjunctively.",
                    ", ".join(domains),
                )
            )
        if len(ranges) > 1:
            findings.append(
                Finding(
                    "AXIOM-003",
                    "info",
                    str(prop),
                    "Property has multiple rdfs:range axioms; RDFS interprets them conjunctively.",
                    ", ".join(ranges),
                )
            )
    return findings


def collect_metrics(graph: Graph, declared: dict[Any, set[Any]]) -> dict[str, Any]:
    class_nodes = {
        subject
        for subject, types in declared.items()
        if OWL.Class in types or RDFS.Class in types
    }
    property_nodes = {
        subject for subject, types in declared.items() if types & PROPERTY_TYPES
    }
    individuals = {
        subject for subject, types in declared.items() if OWL.NamedIndividual in types
    }
    namespaces: Counter[str] = Counter()
    for term in declared:
        if isinstance(term, URIRef):
            text = str(term)
            cut = max(text.rfind("#"), text.rfind("/"))
            namespaces[text[: cut + 1] if cut >= 0 else text] += 1
    return {
        "triples": len(graph),
        "ontology_declarations": len(set(graph.subjects(RDF.type, OWL.Ontology))),
        "declared_terms": len(declared),
        "classes": len(class_nodes),
        "properties": len(property_nodes),
        "named_individuals": len(individuals),
        "subclass_axioms": len(set(graph.subject_objects(RDFS.subClassOf))),
        "equivalent_class_axioms": len(set(graph.subject_objects(OWL.equivalentClass))),
        "disjointness_axioms": len(set(graph.subject_objects(OWL.disjointWith))),
        "imports": len(set(graph.objects(None, OWL.imports))),
        "top_namespaces": namespaces.most_common(10),
    }


def validate_shacl(
    data_graph: Graph,
    shapes_graph: Graph,
    ontology_graph: Graph,
    inference: str,
    advanced: bool,
) -> dict[str, Any]:
    try:
        from pyshacl import validate
    except ImportError as exc:
        raise RuntimeError(
            "SHACL validation requires pySHACL. Install it in an approved "
            "environment with: python -m pip install pyshacl"
        ) from exc

    conforms, results_graph, results_text = validate(
        data_graph,
        shacl_graph=shapes_graph,
        ont_graph=ontology_graph,
        inference=inference,
        advanced=advanced,
        abort_on_first=False,
        allow_infos=True,
        allow_warnings=True,
        meta_shacl=False,
    )
    result_nodes = set(results_graph.subjects(RDF.type, SH.ValidationResult))
    severity_counts: Counter[str] = Counter()
    for node in result_nodes:
        severity = next(results_graph.objects(node, SH.resultSeverity), None)
        severity_counts[str(severity or "unspecified")] += 1
    return {
        "executed": True,
        "conforms": bool(conforms),
        "inference": inference,
        "advanced": advanced,
        "result_count": len(result_nodes),
        "severity_counts": dict(severity_counts),
        "text": str(results_text),
    }


def render_human(report: dict[str, Any]) -> None:
    print("Ontotect advisory ontology audit")
    print(f"Ontology: {report['ontology']}")
    print("Metrics:")
    for key, value in report["metrics"].items():
        print(f"  {key}: {value}")
    print(f"Findings: {len(report['findings'])}")
    for finding in report["findings"]:
        subject = f" [{finding['subject']}]" if finding["subject"] else ""
        print(f"- {finding['severity'].upper()} {finding['code']}{subject}: {finding['message']}")
        if finding["evidence"]:
            print(f"  evidence: {finding['evidence']}")
    shacl = report.get("shacl")
    if shacl:
        print(
            "SHACL: "
            + ("conforms" if shacl.get("conforms") else "does not conform")
            + f" ({shacl.get('result_count', 0)} results)"
        )
    print("Limit: this audit is not an OWL consistency/profile/entailment check.")


def main() -> int:
    args = parse_args()
    try:
        ontology_graph = load_graph(args.ontology, args.format)
        declared = declarations(ontology_graph)
        ontology_nodes = list(ontology_graph.subjects(RDF.type, OWL.Ontology))
        findings = (
            metadata_findings(ontology_graph, ontology_nodes)
            + term_findings(ontology_graph, declared, args.include_standard_terms)
            + label_collision_findings(
                ontology_graph, declared, args.include_standard_terms
            )
            + hierarchy_findings(ontology_graph)
            + axiom_findings(ontology_graph, declared)
        )
        findings.sort(key=lambda item: (-SEVERITY_RANK[item.severity], item.code, item.subject))
        report: dict[str, Any] = {
            "ontology": str(args.ontology.resolve()),
            "metrics": collect_metrics(ontology_graph, declared),
            "findings": [asdict(item) for item in findings],
            "limitations": [
                "Advisory structural checks only.",
                "No complete OWL consistency, satisfiability, profile, or entailment reasoning.",
                "Findings require interpretation against the ontology contract.",
            ],
        }

        if args.shapes:
            data_graph = load_graph(args.data or args.ontology, args.data_format)
            shapes_graph = load_graph(args.shapes, args.shapes_format)
            report["shacl"] = validate_shacl(
                data_graph,
                shapes_graph,
                ontology_graph,
                args.inference,
                args.advanced,
            )
    except Exception as exc:  # report parser/dependency/runtime failures distinctly
        print(f"error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        render_human(report)

    shacl_failed = bool(report.get("shacl")) and not report["shacl"]["conforms"]
    if args.fail_on == "none":
        advisory_failed = False
    else:
        threshold = SEVERITY_RANK[args.fail_on]
        advisory_failed = any(
            SEVERITY_RANK[item.severity] >= threshold for item in findings
        )
    return 1 if shacl_failed or advisory_failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
