import Cantilune.Pi.NominalFiniteSupport

/-!
Kernel checks for the nominal finite-support and fresh-choice alpha layer.
-/

namespace Cantilune.Tests.NominalFiniteSupport

open Cantilune.Pi.NominalFiniteSupport

#check mapSupport_comp
#check card_mapSupport
#check disjoint_mapSupport_iff
#check mapSupport_union
#check permuteSupport_symm
#check disjoint_permuteSupport_iff
#check last_not_mem_allocateSupport
#check disjoint_allocateSupport_iff
#check dropFresh_allocateSupport
#check extendByName_fresh_choice
#check freshChoiceAlpha
#check finiteSupportModel
#check finiteSupportToSetAgent
#check allocateSupport_agrees_setAgent
#check supportHiding_allocate

#print axioms extendByName_fresh_choice
#print axioms freshChoiceAlpha
#print axioms disjoint_mapSupport_iff
#print axioms disjoint_permuteSupport_iff
#print axioms disjoint_allocateSupport_iff
#print axioms finiteSupportToSetAgent
#print axioms supportHiding_allocate

end Cantilune.Tests.NominalFiniteSupport
