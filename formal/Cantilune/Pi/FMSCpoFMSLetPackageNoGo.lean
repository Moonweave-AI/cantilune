import Cantilune.Pi.FMSExternalPackage
import Cantilune.Pi.FMSCpoFMSLetNoGo

/-!
# Package-level form of the FMS commutative-let obstruction

`CpoPowerdomainPackage` explicitly requires its order-theoretic divergence
and semilattice empty/deadlock constants to be distinct.  This module connects
those actual package fields to the representation-independent `let`
obstruction.

The bridge deliberately stores the three `let` equations as assumptions.
The current `CpoPowerdomainPackage` record does not contain a bind operation
or a multiplication-at-empty law from which all three could be derived.
Consequently this theorem says exactly that the strengthened package cannot
be extended by the full source-style strict/zero/commutative `let` fragment.
-/

namespace Cantilune.Pi.FMSCpoFMSLetPackageNoGo

open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoFMSLetNoGo

/-- A single concrete carrier on which to test the package `let` laws. -/
abbrev UnitComputation (power : CpoPowerdomainPackage) : Type :=
  power.monad.obj (ωCPO.of PUnit)

/--
The three source-style `let` equations, specialized to the actual package
carrier over the one-point omega-CPO.
-/
structure SourceLetLaws (power : CpoPowerdomainPackage) where
  bind :
    UnitComputation power →
      (PUnit → UnitComputation power) →
        UnitComputation power
  bind_divergence :
    ∀ continuation,
      bind (power.divergence (ωCPO.of PUnit)) continuation =
        power.divergence (ωCPO.of PUnit)
  bind_empty :
    ∀ continuation,
      bind (power.empty (ωCPO.of PUnit)) continuation =
        power.empty (ωCPO.of PUnit)
  exchange :
    ∀ first second result,
      bind first (fun _ => bind second (fun _ => result)) =
        bind second (fun _ => bind first (fun _ => result))

/-- Package fields plus source `let` laws form the forbidden separated record. -/
def SourceLetLaws.toSeparatedCommutativeLet
    {power : CpoPowerdomainPackage}
    (laws : SourceLetLaws power) :
    SeparatedCommutativeLet (UnitComputation power) where
  divergence := power.divergence (ωCPO.of PUnit)
  deadlock := power.empty (ωCPO.of PUnit)
  bind := laws.bind
  bind_divergence := laws.bind_divergence
  bind_deadlock := laws.bind_empty
  exchange := laws.exchange
  divergence_ne_deadlock :=
    power.divergence_ne_empty (ωCPO.of PUnit)

/--
No strengthened `CpoPowerdomainPackage` can also carry all three source-style
commutative-let equations, independently of its carrier or representation.
-/
theorem no_sourceLetLaws
    (power : CpoPowerdomainPackage) :
    ¬ Nonempty (SourceLetLaws power) := by
  rintro ⟨laws⟩
  exact
    no_separated_commutative_let (UnitComputation power)
      ⟨laws.toSeparatedCommutativeLet⟩

end Cantilune.Pi.FMSCpoFMSLetPackageNoGo
