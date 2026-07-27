import Cantilune.Pi.FMSCpoFiniteSupportTensor

/-!
# Regression tests for the omega-CPO finite-support separated tensor

The concrete object below is equality ordered, so every omega-chain is
constant and the explicit support-stabilisation premise is witnessed at
index zero.  Its separated tensor nevertheless has genuinely nonempty,
disjoint finite supports.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoFiniteSupportTensor

open OmegaCompletePartialOrder
open Cantilune.Pi.FMSCpoFiniteSupportTensor
open Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated

/-- A concrete equality-ordered finite-support omega-CPO. -/
def finiteSupportObject (nameCount : Nat) :
    SupportedOmegaCpo (Fin nameCount) where
  Carrier :=
    Cantilune.Pi.FMSCpoFinitePower.EqualityOrder
      (Finset (Fin nameCount))
  omega := inferInstance
  support := fun names => names
  support_mono := by
    intro first second ordered
    change first = second at ordered
    subst second
    exact Finset.Subset.rfl
  support_omegaSup_bounded := by
    intro chain
    exact ⟨0, Finset.Subset.rfl⟩

def twoNames : SupportedOmegaCpo (Fin 2) :=
  finiteSupportObject 2

/-- A nontrivial separated point with one name on each side. -/
def separatedPoint :
    (tensor twoNames twoNames).Carrier where
  fst := ({0} : Finset (Fin 2))
  snd := ({1} : Finset (Fin 2))
  separated := by
    change
      Disjoint
        ({0} : Finset (Fin 2))
        ({1} : Finset (Fin 2))
    simp

theorem separatedPoint_support :
    (tensor twoNames twoNames).support separatedPoint =
      ({0, 1} : Finset (Fin 2)) := by
  simp [tensor, separatedPoint, twoNames, finiteSupportObject]

theorem braidingPoint_fst :
    (braidingHom twoNames twoNames separatedPoint).fst =
      ({1} : Finset (Fin 2)) :=
  by
    rfl

theorem braidingPoint_snd :
    (braidingHom twoNames twoNames separatedPoint).snd =
      ({0} : Finset (Fin 2)) :=
  by
    rfl

/-- A constant chain used to exercise the constructed tensor omega-CPO. -/
def separatedPointChain :
    Chain (tensor twoNames twoNames).Carrier where
  toFun := fun _ => separatedPoint
  monotone' := by
    intro first second ordered
    exact ⟨rfl, rfl⟩

theorem separatedPointChain_sup_fst :
    (carrierOmegaSup separatedPointChain).fst =
      ({0} : Finset (Fin 2)) :=
  by
    rfl

theorem separatedPointChain_sup_snd :
    (carrierOmegaSup separatedPointChain).snd =
      ({1} : Finset (Fin 2)) :=
  by
    rfl

/-- The general coherence theorems instantiate on a nonempty object. -/
theorem concrete_pentagon :
    (associatorHom
        (tensor twoNames twoNames)
        twoNames twoNames).comp
      (associatorHom
        twoNames twoNames
        (tensor twoNames twoNames)) =
    ((map
        (associatorHom twoNames twoNames twoNames)
        (SupportedOmegaCpo.Hom.id twoNames)).comp
      (associatorHom
        twoNames (tensor twoNames twoNames) twoNames)).comp
      (map
        (SupportedOmegaCpo.Hom.id twoNames)
        (associatorHom twoNames twoNames twoNames)) :=
  associator_pentagon twoNames twoNames twoNames twoNames

theorem concrete_hexagon :
    ((associatorHom twoNames twoNames twoNames).comp
      (braidingHom twoNames (tensor twoNames twoNames))).comp
      (associatorHom twoNames twoNames twoNames) =
    ((map
        (braidingHom twoNames twoNames)
        (SupportedOmegaCpo.Hom.id twoNames)).comp
      (associatorHom twoNames twoNames twoNames)).comp
      (map
        (SupportedOmegaCpo.Hom.id twoNames)
        (braidingHom twoNames twoNames)) :=
  braiding_hexagon twoNames twoNames twoNames

#print axioms
  Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated.omegaSup_separated
#print axioms
  Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated.mapContinuous
#print axioms
  Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated.associator_pentagon
#print axioms
  Cantilune.Pi.FMSCpoFiniteSupportTensor.Separated.braiding_hexagon

end Cantilune.Tests.FMSCpoFiniteSupportTensor
