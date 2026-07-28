import Cantilune.Pi.FMSCpoFiniteApproximationTower

/-!
Kernel regression checks for the genuine finite approximation tower.  The
negative checks deliberately prevent this tower from being presented as an
embedding-projection colimit or recursive-domain solution.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoFiniteApproximationTower

open CategoryTheory
open CategoryTheory.Limits
open OmegaCompletePartialOrder
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSCpoOmegaScottLocallyContinuous
open Cantilune.Pi.FMSCpoFiniteApproximationTower

example :
    IsInitial emptyWorldModel :=
  emptyWorldModelIsInitial

example :
    EndofunctorLocallyContinuous agentPowerFunctor :=
  agentPowerFunctorLocallyContinuous

example (depth : Nat) :
    Approximation (depth + 1) =
      agentPowerFunctor.obj (Approximation depth) :=
  approximation_successor depth

example (depth : Nat) :
    approximationConnection (depth + 1) =
      agentPowerFunctor.map
        (approximationConnection depth) :=
  approximationConnection_successor depth

example
    (start length : Nat)
    (world : World)
    (chain : Chain ((Approximation start).obj world)) :
    (approximationPath start length).app world
        (ωSup chain) =
      ωSup
        (chain.map
          ((approximationPath start length).app
            world).toOrderHom) :=
  approximationPath_continuous
    start length world chain

example :
    IsEmpty
      (Approximation 1 ⟶ Approximation 0) :=
  no_firstStage_to_empty

example :
    ¬ ∃ backward : Approximation 1 ⟶ Approximation 0,
        approximationConnection 0 ≫ backward =
          𝟙 (Approximation 0) :=
  no_seed_retraction

example :
    IsEmpty
      (Approximation 0 ≅ Approximation 1) :=
  no_initial_firstStage_iso

end Cantilune.Tests.FMSCpoFiniteApproximationTower
