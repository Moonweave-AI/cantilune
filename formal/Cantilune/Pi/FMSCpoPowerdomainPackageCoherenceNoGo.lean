import Cantilune.Pi.FMSExternalPackage
import Cantilune.Pi.FMSExactAcceptance
import Cantilune.Pi.FMSCpoOmegaScottChosenCoherence

/-!
# Distinguished-computation obstruction for commutative Fubini

This module isolates an acceptance-boundary incompatibility which is
independent of any concrete finite-powerset representation.

For a `CpoPowerdomainPackage`, suppose its Fubini map is strict in its first
computation argument for both distinguished computations:

* CPO bottom / divergence; and
* semilattice zero / deadlock.

The package already requires Fubini commutativity and natural preservation of
divergence.  Evaluating the commutativity square at `(divergence, deadlock)`
then identifies deadlock with divergence in the product computation object.
This contradicts the package's explicit separation field.

The theorem does **not** refute Abramsky's free construction as stated in the
FMS source.  It refutes the simultaneous strengthened acceptance requirements
of distinct divergence/deadlock, a symmetric Fubini map, and both first-input
strictness laws.  A source-compatible package must therefore weaken or
reinterpret at least one of those requirements.
-/

noncomputable section

namespace Cantilune.Pi.FMSCpoPowerdomainPackageCoherenceNoGo

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSExactAcceptance
open Cantilune.Pi.FMSCpoOmegaScottStrength
open Cantilune.Pi.FMSCpoOmegaScottStrongCoherence

/-- Embed an ordinary Lean pair into mathlib's chosen CPO product. -/
def toCategoricalProduct (left right : ωCPO) :
    ωCPO.of (left × right) ⟶ (left ⨯ right) :=
  (FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
    left right).inv

/-- A value of a chosen product assembled from its two coordinates. -/
def pairValue
    {left right : ωCPO}
    (leftValue : left) (rightValue : right) :
    (left ⨯ right).carrier :=
  toCategoricalProduct left right (leftValue, rightValue)

@[simp]
theorem braiding_pairValue
    {left right : ωCPO}
    (leftValue : left) (rightValue : right) :
    (Limits.prod.braiding left right).hom
        (pairValue leftValue rightValue) =
      pairValue rightValue leftValue := by
  let productIso :=
    FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
      right left
  suffices compared :
      productIso.hom
          ((Limits.prod.braiding left right).hom
            (pairValue leftValue rightValue)) =
        productIso.hom
          (pairValue rightValue leftValue) by
    have recovered :=
      congrArg (fun value => productIso.inv value) compared
    simpa [productIso] using recovered
  have braided :=
    ContinuousHom.congr_fun
      (Cantilune.Pi.FMSCpoOmegaScottChosenCoherence.ChosenProducts.prodIsoProd_hom_braiding
        left right)
      (pairValue leftValue rightValue)
  calc
    productIso.hom
        ((Limits.prod.braiding left right).hom
          (pairValue leftValue rightValue)) =
      swapMap
        ((FMSCpoOmegaScottStrongCoherence.ChosenProducts.prodIsoProd
          left right).hom
          (pairValue leftValue rightValue)) := braided.symm
    _ = swapMap (leftValue, rightValue) := by
      rw [pairValue, toCategoricalProduct]
      simp
    _ = (rightValue, leftValue) := rfl
    _ =
      productIso.hom
        (pairValue rightValue leftValue) := by
      dsimp [productIso, pairValue, toCategoricalProduct]
      simp

/--
The two algebraic strictness equations whose simultaneous use with symmetric
Fubini and separated constants is inconsistent.

They are kept outside `CpoPowerdomainPackage`: the latter intentionally does
not claim these missing algebraic Fubini laws.
-/
structure DistinguishedFubiniStrictness
    (power : CpoPowerdomainPackage) : Prop where
  left_divergence :
    ∀ (left right : ωCPO)
      (rightValue : power.monad.obj right),
      power.fubini left right
          (pairValue (power.divergence left) rightValue) =
        power.divergence (left ⨯ right)
  left_deadlock :
    ∀ (left right : ωCPO)
      (rightValue : power.monad.obj right),
      power.fubini left right
          (pairValue (power.empty left) rightValue) =
        power.empty (left ⨯ right)

/--
Commutativity plus both first-input strictness laws collapses the two
distinguished computations at every cartesian self-product.
-/
theorem deadlock_eq_divergence_on_product
    (power : CpoPowerdomainPackage)
    (strictness : DistinguishedFubiniStrictness power)
    (object : ωCPO) :
    power.empty (object ⨯ object) =
      power.divergence (object ⨯ object) := by
  have pointwise :=
    ContinuousHom.congr_fun
      (power.fubini_commutes object object)
      (pairValue
        (power.divergence object) (power.empty object))
  change
    power.fubini object object
        ((Limits.prod.braiding
          (power.monad.obj object)
          (power.monad.obj object)).hom
          (pairValue
            (power.divergence object) (power.empty object))) =
      power.monad.map (Limits.prod.braiding object object).hom
        (power.fubini object object
          (pairValue
            (power.divergence object) (power.empty object)))
    at pointwise
  rw [
    braiding_pairValue,
    strictness.left_deadlock,
    strictness.left_divergence,
    power.map_divergence] at pointwise
  exact pointwise

/--
No `CpoPowerdomainPackage` can additionally satisfy both distinguished
first-input strictness laws while retaining its required separation.
-/
theorem no_distinguishedFubiniStrictness
    (power : CpoPowerdomainPackage) :
    ¬ DistinguishedFubiniStrictness power := by
  intro strictness
  exact
    power.divergence_ne_empty ((⊤_ ωCPO) ⨯ (⊤_ ωCPO))
      (deadlock_eq_divergence_on_product
        power strictness (⊤_ ωCPO)).symm

/-! ## Consequence for the strengthened complete FMS acceptance target -/

/--
The currently requested strengthening of the exact FMS package: in addition
to the provisional construction, coherence, operational-denotation, and
full-abstraction fields currently bundled by `ExactFMSAcceptancePackage`,
its powerdomain Fubini must absorb both distinguished computations in the
first input.

Keeping this structure explicit prevents the extra laws from being smuggled
into the source-compatible FMS boundary.
-/
structure StrengthenedExactFMSAcceptancePackage where
  exact : ExactFMSAcceptancePackage
  distinguishedStrictness :
    DistinguishedFubiniStrictness exact.base.powerdomain

/--
The strengthened complete target is uninhabited.  This conclusion is
independent of whether an ordinary `ExactFMSAcceptancePackage` can be
constructed: any such package equipped with the two additional strictness
laws immediately contradicts divergence/deadlock separation.
-/
theorem no_strengthenedExactFMSAcceptancePackage :
    ¬ Nonempty StrengthenedExactFMSAcceptancePackage := by
  rintro ⟨package⟩
  exact
    no_distinguishedFubiniStrictness
      package.exact.base.powerdomain
      package.distinguishedStrictness

end Cantilune.Pi.FMSCpoPowerdomainPackageCoherenceNoGo
