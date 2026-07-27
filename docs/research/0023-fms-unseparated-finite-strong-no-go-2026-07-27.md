# D1-A finite strong-observation no-go

Status: kernel-built, review-pending

Owner / DRI: Joker-of-Gotham

Risk / quality / maturity: S2 / QA-L4 / M1 (Pre-FCP)

## Question

Can an unseparated D1-A effect be fully abstract for a
constructor-sensitive strong operational equivalence even when the source
language contains no explicit divergence constant?

## Kernel construction

`Cantilune.Pi.FMSUnseparatedFiniteStrongNoGo` defines a four-state finite
native transition system:

- inactive process;
- `tau.0`;
- `tau.tau.0`; and
- `tau.0 + tau.tau.0`.

It defines strong bisimilarity from the native transition relation rather than
from syntax equality. The theorem
`absorbedChoice_not_stronglyEquivalent` proves that the choice state and the
two-tau state are not strongly bisimilar.

For every ordered semilattice carrier in which inactive process denotes
bottom, choice denotes supremum, and tau prefix is monotone,
`absorbedChoice_denotation_eq` proves

```text
denote (tau.0 + tau.tau.0) = denote (tau.tau.0).
```

The reason is the order chain
`bottom <= tau(bottom)`, transported once more by monotonicity and then
absorbed by supremum. The central result `not_strongFullAbstract` combines
the two facts.

## Consequence

This is stronger than the earlier explicit-nullary obstruction. It shows that
D1-A denotational equality cannot be fully abstract for strong observation
even on a finite tau/choice fragment.

The maximal-compatible route fixed by RFC-0002 and ADR-0001 is therefore:

1. state and prove the D1-A full-abstraction theorem for the bottom/Hoare
   observation induced by the unseparated effect;
2. retain genuine strong late-pi step soundness and reflection as an
   independent operational projection theorem;
3. retain divergence/deadlock separation in terminal classification and
   product semantics; and
4. never present the D1-A theorem as reconstruction of the separated FMS
   source powerdomain.

This record does not itself construct the remaining positive
bottom/Hoare-observation theorem.

## Subsequent positive scope

The repository later constructs the finite and `RecursiveProc`
guarded/contextual Hoare theorem layers. It separately proves actual-Agent
native-path full abstraction only for deterministic typed tau/free-output
prefix tries, plus a total supported finite-control coalgebra and fifteen
normative-event commutation cells. None of those results weakens this no-go or
turns the wider guarded theorem into actual-Agent strong-bisimulation full
abstraction. See research records 0025 and 0026.
