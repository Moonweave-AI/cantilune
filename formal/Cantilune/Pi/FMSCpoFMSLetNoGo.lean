/-!
# The commutative-let obstruction with distinct divergence and deadlock

The FMS metalanguage combines three equations:

* sequencing a divergent computation is strict;
* sequencing the semilattice zero/deadlock returns zero; and
* two independent nested `let`s commute.

Those equations already identify divergence and deadlock.  The argument is
purely algebraic: it mentions no powerset, finite carrier, order, topology,
or concrete powerdomain representation.

The original FMS construction does not require the two constants to be
distinct.  Disequality is an additional Cantilune acceptance condition.
Consequently a target which requires all four fields below is inconsistent
and must be revised before a complete package can be constructed.
-/

namespace Cantilune.Pi.FMSCpoFMSLetNoGo

universe u

/--
The fragment of the FMS `let` equations needed by the obstruction.

`PUnit` is used only to express a continuation with a bound result.  The
exchange law is the constant-result instance of commutativity of nested
monadic `let`.
-/
structure CommutativeLetWithStrictConstants
    (Computation : Type u) where
  divergence : Computation
  deadlock : Computation
  bind : Computation → (PUnit → Computation) → Computation
  bind_divergence :
    ∀ continuation,
      bind divergence continuation = divergence
  bind_deadlock :
    ∀ continuation,
      bind deadlock continuation = deadlock
  exchange :
    ∀ first second result,
      bind first (fun _ => bind second (fun _ => result)) =
        bind second (fun _ => bind first (fun _ => result))

namespace CommutativeLetWithStrictConstants

/--
Strict divergence, zero-preserving sequencing, and commutative nested `let`
force the two constants to coincide.
-/
theorem divergence_eq_deadlock
    {Computation : Type u}
    (laws : CommutativeLetWithStrictConstants Computation) :
    laws.divergence = laws.deadlock := by
  let leftContinuation : PUnit → Computation :=
    fun _ =>
      laws.bind laws.deadlock (fun _ => laws.divergence)
  let rightContinuation : PUnit → Computation :=
    fun _ =>
      laws.bind laws.divergence (fun _ => laws.divergence)
  calc
    laws.divergence =
        laws.bind laws.divergence leftContinuation :=
      (laws.bind_divergence leftContinuation).symm
    _ =
        laws.bind laws.deadlock rightContinuation := by
      exact
        laws.exchange laws.divergence laws.deadlock laws.divergence
    _ = laws.deadlock :=
      laws.bind_deadlock rightContinuation

end CommutativeLetWithStrictConstants

/--
The inconsistent strengthened target: the three source-style `let` equations
plus an additional separation proof for the two constants.
-/
structure SeparatedCommutativeLet
    (Computation : Type u)
    extends CommutativeLetWithStrictConstants Computation where
  divergence_ne_deadlock : divergence ≠ deadlock

/--
No carrier can inhabit the strengthened separated commutative-let target.
-/
theorem no_separated_commutative_let
    (Computation : Type u) :
    ¬ Nonempty (SeparatedCommutativeLet Computation) := by
  rintro ⟨laws⟩
  exact
    laws.divergence_ne_deadlock
      laws.toCommutativeLetWithStrictConstants.divergence_eq_deadlock

end Cantilune.Pi.FMSCpoFMSLetNoGo
