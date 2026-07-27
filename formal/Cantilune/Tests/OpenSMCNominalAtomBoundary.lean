import Cantilune.Pi.OpenSMCNominalAtomBoundary

namespace Cantilune.Tests.OpenSMCNominalAtomBoundary

open Cantilune.Pi.OpenSMCNominalAtomBoundary

#check AtomBoundaryCertificate.toTerm
#check AtomBoundaryCertificate.freeNames_eq_boundary
#check AtomBoundaryCertificate.empty_boundary_closed
#check namedProcessCertificate
#check nominal_atom_nonempty
#check namedProcess_not_empty_boundary

example :
    namedInput.names = {0} :=
  namedInput_names

example :
    namedOutput.names = {1} :=
  namedOutput_names

end Cantilune.Tests.OpenSMCNominalAtomBoundary
