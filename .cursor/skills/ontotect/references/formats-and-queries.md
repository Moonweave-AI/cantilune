# Formats, queries, shapes, and test artifacts

## Contents

1. Serialization policy
2. Turtle source pattern
3. Manchester and functional syntax
4. Qualified relation pattern
5. SHACL pattern
6. SPARQL competency tests
7. Test fixture discipline

## 1. Serialization policy

Choose a canonical source syntax and generate secondary distributions. Prefer:

- Turtle for human review and source control;
- RDF/XML when required by established OWL tooling or an exchange contract;
- JSON-LD for JSON-oriented Web integration with a governed context;
- N-Triples/N-Quads for streaming, canonical comparison inputs, or bulk exchange;
- TriG for RDF datasets with named graphs;
- Manchester Syntax for readable OWL class expressions and review examples, not as the sole interchange format;
- Functional-Style Syntax for precise OWL specification and reasoner-focused tests.

Graph equivalence is independent of prefix names, triple order, and many formatting choices. Do not use line diffs alone as semantic diffs. Blank-node identifiers are local serialization details.

## 2. Turtle source pattern

```turtle
@prefix ex: <https://example.org/ontology/> .
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
@prefix skos: <http://www.w3.org/2004/02/skos/core#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

<https://example.org/ontology>
    a owl:Ontology ;
    owl:versionIRI <https://example.org/ontology/1.2.0> ;
    owl:versionInfo "1.2.0" ;
    dcterms:title "Example ontology"@en ;
    dcterms:description "Vocabulary for the approved example scope."@en ;
    dcterms:creator <https://example.org/agents/ontology-team> ;
    dcterms:issued "2026-08-07"^^xsd:date ;
    dcterms:license <https://creativecommons.org/licenses/by/4.0/> .

ex:Observation
    a owl:Class ;
    rdfs:label "observation"@en ;
    skos:definition "A planned process that produces an estimate about an observed property."@en ;
    dcterms:source <https://example.org/requirements/CQ-001> .

ex:observes
    a owl:ObjectProperty ;
    rdfs:label "observes"@en ;
    rdfs:domain ex:Observation ;
    rdfs:range ex:ObservableProperty .

ex:hasResult
    a owl:ObjectProperty ;
    rdfs:label "has result"@en ;
    rdfs:domain ex:Observation ;
    rdfs:range ex:Result .

ex:SuccessfulObservation
    a owl:Class ;
    rdfs:subClassOf ex:Observation ,
        [ a owl:Restriction ;
          owl:onProperty ex:hasResult ;
          owl:someValuesFrom ex:Result
        ] .
```

Use ontology metadata terms agreed by the community. Do not add metadata merely to satisfy a generic checklist when its value is unknown; record the gap.

## 3. Manchester and functional syntax

Manchester Syntax is useful for design and review:

```text
Class: SuccessfulObservation
  SubClassOf:
    Observation,
    hasResult some Result,
    observes exactly 1 ObservableProperty
```

Functional-Style Syntax makes the logical structure explicit:

```text
SubClassOf(
  :SuccessfulObservation
  ObjectIntersectionOf(
    :Observation
    ObjectSomeValuesFrom(:hasResult :Result)
    ObjectExactCardinality(1 :observes :ObservableProperty)
  )
)
```

Before using exact cardinality, decide whether multiple IRIs may denote the same filler and whether the intended requirement is logical or an input constraint.

## 4. Qualified relation pattern

Model a time- and provenance-qualified assignment as an individual:

```turtle
@prefix prov: <http://www.w3.org/ns/prov#> .
@prefix time: <http://www.w3.org/2006/time#> .

ex:Assignment a owl:Class ;
    rdfs:label "assignment"@en .

ex:assignedAgent a owl:ObjectProperty ;
    rdfs:domain ex:Assignment ;
    rdfs:range prov:Agent .

ex:assignedRole a owl:ObjectProperty ;
    rdfs:domain ex:Assignment ;
    rdfs:range ex:Role .

ex:validDuring a owl:ObjectProperty ;
    rdfs:domain ex:Assignment ;
    rdfs:range time:TemporalEntity .

ex:assignment-42 a ex:Assignment ;
    ex:assignedAgent ex:alice ;
    ex:assignedRole ex:ReviewerRole ;
    ex:validDuring ex:interval-2026 ;
    prov:wasDerivedFrom ex:appointment-record-42 .
```

Use a direct binary property only when the qualification does not matter to identity, queries, provenance, or change history.

## 5. SHACL pattern

Use SHACL for explicit graph/data conformance. State whether the validator receives inferred triples and which entailment regime is enabled.

```turtle
@prefix ex: <https://example.org/ontology/> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix sh: <http://www.w3.org/ns/shacl#> .
@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .

ex:ObservationShape
    a sh:NodeShape ;
    sh:targetClass ex:Observation ;
    sh:closed true ;
    sh:ignoredProperties ( rdf:type ) ;
    sh:property [
        sh:path ex:observes ;
        sh:minCount 1 ;
        sh:maxCount 1 ;
        sh:class ex:ObservableProperty ;
        sh:severity sh:Violation ;
        sh:message "An observation must identify exactly one observable property."@en
    ] ;
    sh:property [
        sh:path ex:recordedAt ;
        sh:maxCount 1 ;
        sh:datatype xsd:dateTimeStamp
    ] .
```

`sh:closed true` is a strong interface decision. Apply it only when extra properties are genuinely invalid for the targeted graph, and list ignored/system properties deliberately.

Do not assume a shape target discovers subclasses without the validator's documented entailment behavior. Materialize required types or configure inference explicitly.

## 6. SPARQL competency tests

### Positive answer-set test

```sparql
PREFIX ex: <https://example.org/ontology/>

SELECT ?sensor WHERE {
  ?sensor a ex:ApprovedSensor ;
          ex:observes ex:AirTemperature .
}
ORDER BY ?sensor
```

Compare results with a stored expected binding set. Specify the dataset, default/named graph behavior, entailment regime, and whether inferred triples are materialized.

### Expected entailment ASK

```sparql
PREFIX ex: <https://example.org/ontology/>

ASK { ex:sensor-7 a ex:ApprovedSensor }
```

Expected: `true` after the agreed reasoning/materialization step.

### Expected non-entailment ASK

```sparql
PREFIX ex: <https://example.org/ontology/>

ASK { ex:sensor-7 a ex:UnsafeSensor }
```

Expected: `false` means the triple is not present in the tested graph; under open-world semantics it does not prove membership in the complement. If the logical requirement is disjointness or complement membership, test that with a reasoner and explicit axioms.

### Invariant query

```sparql
PREFIX owl: <http://www.w3.org/2002/07/owl#>

ASK {
  ?entity owl:deprecated true .
  FILTER NOT EXISTS { ?entity <http://purl.org/dc/terms/isReplacedBy> ?replacement }
}
```

Expected: `false` when project policy requires a replacement for every deprecated term. Prefer SHACL for reusable constraint reports; use SPARQL when query-based CI is clearer or the condition is outside SHACL Core.

## 7. Test fixture discipline

Organize tests by semantic intent rather than tool alone:

```text
tests/
  fixtures/
    positive.ttl
    negative.ttl
    boundary.ttl
  entailments/
    expected.ofn
    forbidden.ofn
  queries/
    CQ-001.rq
    CQ-001.expected.tsv
  shapes/
    domain.shacl.ttl
  manifests/
    evidence-manifest.json
```

For every test, record:

- requirement/CQ identifier;
- input ontology, import closure, data, and shapes;
- reasoner/validator/query engine and configuration;
- expected result and why it is authoritative;
- whether the result tests asserted data, entailment, non-entailment, or validation;
- stable comparison policy for blank nodes, ordering, datatypes, and language tags.

Use minimal fixtures to localize failures and representative integrated fixtures to catch interactions. A test that always passes without the target axiom is not evidence; mutation-check essential tests by temporarily removing or changing the axiom in an isolated workspace.
