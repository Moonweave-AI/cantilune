#!/usr/bin/env python3
"""Compare two asserted RDF graphs modulo triple order and blank-node labels.

This is not an inferred semantic diff. For release claims, also compare reasoner
classifications, expected entailments/non-entailments, SHACL, and CQ results.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path
from typing import Any


try:
    from rdflib import Graph, RDF, RDFS
    from rdflib.compare import graph_diff, to_isomorphic
    from rdflib.namespace import DCTERMS, OWL, SKOS
except ImportError as exc:  # pragma: no cover
    print(
        "error: ontology_diff.py requires RDFLib. "
        "Install it in an approved environment with: python -m pip install rdflib",
        file=sys.stderr,
    )
    raise SystemExit(2) from exc


LOGICAL_PREDICATES = {
    RDF.type,
    RDFS.subClassOf,
    RDFS.subPropertyOf,
    RDFS.domain,
    RDFS.range,
    OWL.equivalentClass,
    OWL.equivalentProperty,
    OWL.disjointWith,
    OWL.inverseOf,
    OWL.propertyChainAxiom,
    OWL.sameAs,
    OWL.differentFrom,
    OWL.members,
    OWL.distinctMembers,
    OWL.onProperty,
    OWL.someValuesFrom,
    OWL.allValuesFrom,
    OWL.hasValue,
    OWL.minCardinality,
    OWL.maxCardinality,
    OWL.cardinality,
    OWL.minQualifiedCardinality,
    OWL.maxQualifiedCardinality,
    OWL.qualifiedCardinality,
    OWL.onClass,
    OWL.onDataRange,
    OWL.intersectionOf,
    OWL.unionOf,
    OWL.complementOf,
    OWL.oneOf,
}

ANNOTATION_PREDICATES = {
    RDFS.label,
    RDFS.comment,
    SKOS.prefLabel,
    SKOS.altLabel,
    SKOS.definition,
    DCTERMS.title,
    DCTERMS.description,
    DCTERMS.source,
    DCTERMS.creator,
    DCTERMS.license,
    OWL.deprecated,
    OWL.versionInfo,
}

DEPENDENCY_PREDICATES = {
    OWL.imports,
    OWL.versionIRI,
    OWL.priorVersion,
    OWL.backwardCompatibleWith,
    OWL.incompatibleWith,
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path, help="Baseline RDF document.")
    parser.add_argument("after", type=Path, help="Candidate RDF document.")
    parser.add_argument("--before-format", help="Explicit RDFLib parser format.")
    parser.add_argument("--after-format", help="Explicit RDFLib parser format.")
    parser.add_argument(
        "--limit",
        type=int,
        default=50,
        help="Maximum added and removed triples to print/store (default: 50).",
    )
    parser.add_argument("--output", type=Path, help="Write JSON report to this file.")
    parser.add_argument("--json", action="store_true", help="Print JSON report.")
    parser.add_argument(
        "--fail-on-change",
        action="store_true",
        help="Return exit 1 when asserted graph changes are present.",
    )
    return parser.parse_args()


def guess_format(path: Path) -> str | None:
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
    }.get(path.suffix.lower())


def load_graph(path: Path, rdf_format: str | None) -> Graph:
    if not path.is_file():
        raise FileNotFoundError(f"File not found: {path}")
    graph = Graph()
    graph.parse(path, format=rdf_format or guess_format(path))
    return graph


def category(predicate: Any) -> str:
    if predicate in DEPENDENCY_PREDICATES:
        return "identity_dependency"
    if predicate in LOGICAL_PREDICATES:
        return "logical"
    if predicate in ANNOTATION_PREDICATES:
        return "annotation"
    return "other"


def triple_text(triple: tuple[Any, Any, Any]) -> str:
    subject, predicate, obj = triple
    return f"{subject.n3()} {predicate.n3()} {obj.n3()} ."


def summarize(graph: Graph) -> dict[str, Any]:
    counts = Counter(category(predicate) for _, predicate, _ in graph)
    return {"triples": len(graph), "categories": dict(sorted(counts.items()))}


def changes(graph: Graph, limit: int) -> dict[str, Any]:
    ordered = sorted((triple_text(triple), category(triple[1])) for triple in graph)
    category_counts = Counter(item[1] for item in ordered)
    return {
        "count": len(ordered),
        "category_counts": dict(sorted(category_counts.items())),
        "triples": [item[0] for item in ordered[: max(limit, 0)]],
        "truncated": len(ordered) > max(limit, 0),
    }


def render_human(report: dict[str, Any]) -> None:
    print("Ontotect asserted RDF graph diff")
    print(f"Before: {report['before']['path']} ({report['before']['triples']} triples)")
    print(f"After:  {report['after']['path']} ({report['after']['triples']} triples)")
    print(f"Common canonical triples: {report['common_triples']}")
    for direction in ("removed", "added"):
        section = report[direction]
        print(f"{direction.title()}: {section['count']} {section['category_counts']}")
        for triple in section["triples"]:
            print(f"  {triple}")
        if section["truncated"]:
            print("  ... output truncated; raise --limit or inspect the JSON report")
    print("Limit: asserted graph diff only; run reasoner/CQ/SHACL comparisons separately.")


def main() -> int:
    args = parse_args()
    try:
        before = load_graph(args.before, args.before_format)
        after = load_graph(args.after, args.after_format)
        common, before_only, after_only = graph_diff(
            to_isomorphic(before), to_isomorphic(after)
        )
        report = {
            "before": {"path": str(args.before.resolve()), **summarize(before)},
            "after": {"path": str(args.after.resolve()), **summarize(after)},
            "common_triples": len(common),
            "removed": changes(before_only, args.limit),
            "added": changes(after_only, args.limit),
            "classification": {
                "identity_dependency": "Ontology/version/import compatibility surface.",
                "logical": "Potentially changes asserted or inferred semantics; reasoner evidence required.",
                "annotation": "May affect humans, discovery, governance, or downstream metadata consumers.",
                "other": "Requires predicate-specific interpretation.",
            },
            "limitations": [
                "No inference or OWL semantic equivalence comparison.",
                "Dataset/named-graph placement is not compared because inputs are parsed as RDF graphs.",
                "Every change requires interpretation against protected ontology contracts.",
            ],
        }
    except Exception as exc:
        print(f"error: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 2

    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(report, indent=2), encoding="utf-8")
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        render_human(report)

    changed = bool(report["removed"]["count"] or report["added"]["count"])
    return 1 if args.fail_on_change and changed else 0


if __name__ == "__main__":
    raise SystemExit(main())
