import Cantilune.Pi.OpenSMCBoundaryRenamingCalculus
import Cantilune.Pi.OpenSMCCanonicalPositional

/-!
# Regression checks for composable named-boundary renaming
-/

namespace Cantilune.Tests.OpenSMCBoundaryRenamingCalculus

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCTotalNamedBoundary
open Cantilune.Pi.OpenSMCCanonicalPositional
open Cantilune.Pi.OpenSMCBoundaryRenamingCalculus

#check Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.identity
#check Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.comp
#check Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.identity_comp
#check Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.comp_identity
#check Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.comp_assoc
#check Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.comp_congr
#check FreshenedBoundary.exists_sameTarget_iff_disjoint
#check SortedFreshBoundarySupply.refresh
#check SortedFreshBoundarySupply.refresh_fresh_for_previous
#check SortedFreshBoundarySupply.refresh_fresh_for_extra
#check publicSupport_swap
#check publicSupport_self
#check no_sameName_atom_wire_of_nonempty

#print axioms Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.comp_assoc
#print axioms Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.comp_congr
#print axioms SortedFreshBoundarySupply.refresh_fresh_for_extra
#print axioms FreshenedBoundary.exists_sameTarget_iff_disjoint
#print axioms no_sameName_atom_wire_of_nonempty

/--
Two concrete positional realization changes compose on every represented
port, even though the boundary-renaming record deliberately leaves names
outside the source support unconstrained.
-/
theorem realizationRenaming_composes_on_port
    (position : Position singletonChannel) :
    (Cantilune.Pi.OpenSMCBoundaryRenamingCalculus.BoundaryRenaming.comp
        (realizationRenaming 0 4 singletonChannel)
        (realizationRenaming 4 9 singletonChannel)).nameMap
        (positionName 0 singletonChannel position) =
      positionName 9 singletonChannel position := by
  simp [realizationRenaming]

/--
The canonical supply can refresh a nonempty boundary twice while retaining
freshness for both the old and newly requested finite avoidance sets.
-/
noncomputable def twiceFreshenedSingleton :
    FreshenedBoundary
      (realizeAt 0 singletonChannel)
      ({0, 1} ∪ {8, 9}) :=
  SortedFreshBoundarySupply.refresh
    canonicalSortedFreshBoundarySupply
    (canonicalSortedFreshBoundarySupply.freshen
      {0, 1} (realizeAt 0 singletonChannel))
    {8, 9}

theorem twiceFreshenedSingleton_fresh_for_old :
    Disjoint twiceFreshenedSingleton.target.names
      ({0, 1} : Finset Name) :=
  SortedFreshBoundarySupply.refresh_fresh_for_previous
    canonicalSortedFreshBoundarySupply
    (canonicalSortedFreshBoundarySupply.freshen
      {0, 1} (realizeAt 0 singletonChannel))
    {8, 9}

theorem twiceFreshenedSingleton_fresh_for_new :
    Disjoint twiceFreshenedSingleton.target.names
      ({8, 9} : Finset Name) :=
  SortedFreshBoundarySupply.refresh_fresh_for_extra
    canonicalSortedFreshBoundarySupply
    (canonicalSortedFreshBoundarySupply.freshen
      {0, 1} (realizeAt 0 singletonChannel))
    {8, 9}

/-- The unchanged nonempty boundary cannot be fresh for its own support. -/
theorem no_same_target_self_freshening :
    ¬ ∃ freshened :
        FreshenedBoundary
          (realizeAt 0 singletonChannel)
          (realizeAt 0 singletonChannel).names,
        freshened.target = realizeAt 0 singletonChannel := by
  rw [FreshenedBoundary.exists_sameTarget_iff_disjoint]
  intro disjoint
  have nonempty :
      (realizeAt 0 singletonChannel).names.Nonempty := by
    simp [singletonChannel, NamedInterface.names, realizeAt]
  rcases nonempty with ⟨name, member⟩
  exact (Finset.disjoint_left.mp disjoint) member member

end Cantilune.Tests.OpenSMCBoundaryRenamingCalculus
