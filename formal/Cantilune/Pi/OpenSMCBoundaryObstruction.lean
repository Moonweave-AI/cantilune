import Cantilune.Pi.Late
import Cantilune.Pi.OpenSMC

/-!
# Boundary-support obstruction for the current open-process presentation

`OpenSMC.Interface` records only a list of sorts.  An atom, however, contains
a process over global natural-number names and currently has no premise tying
its free names to its two interfaces.

The theorem below makes the resulting semantic gap precise.  Even in one
fixed, well-typed environment there is no function of the two sort-only
interfaces which recovers the free-name support of every atom: both the
inactive process and a process with a public output inhabit the same
`[] -> []` atom boundary, but their supports differ.

This does not contradict the already proved SMC equations of the presented
quotient.  It proves that those equations alone cannot justify the stronger
claim that the presentation is a sufficiently hiding, name-disciplined
open-pi category.
-/

namespace Cantilune.Pi.OpenSMCBoundaryObstruction

open Cantilune.Pi

/-- A small environment with one channel name and one data name. -/
def environment : TypeEnv where
  sort name := if name = 0 then .channel else .data
  payload _ := .data

/-- A closed continuation preceded by an output using two free names. -/
def namedProcess : Proc :=
  .send { name := 0, payload := .data } 1 .zero

theorem namedProcess_wellTyped :
    namedProcess.WellTyped environment := by
  simp [namedProcess, environment, Proc.WellTyped]

/--
The current atom constructor accepts both processes at the identical empty
input/output boundary.
-/
def zeroAtom : OpenSMC.Term environment [] [] :=
  .atom [] [] .zero trivial

def namedAtom : OpenSMC.Term environment [] [] :=
  .atom [] [] namedProcess namedProcess_wellTyped

@[simp]
theorem zero_support :
    (Proc.erase (.zero : Proc)).freeNames = ∅ := by
  rfl

@[simp]
theorem named_support :
    namedProcess.erase.freeNames = {0, 1} := by
  simp [namedProcess, Proc.erase, Raw.Proc.freeNames]

/--
No support assignment depending only on the current pair of sort-only
interfaces can characterize the free names of every well-typed atom.

Consequently a semantic completion of `open_pi_smc` must enrich the boundary
objects (or the atom constructor) with nominal support/wiring data; it cannot
be derived from the present constructor premises.
-/
theorem no_sort_only_boundary_support :
    ¬ ∃ support :
        OpenSMC.Interface → OpenSMC.Interface → Finset Name,
      ∀ (input output : OpenSMC.Interface)
        (process : Proc) (typed : process.WellTyped environment),
        process.erase.freeNames = support input output := by
  rintro ⟨support, characterizes⟩
  have zeroEquation :=
    characterizes [] [] (.zero : Proc) (by trivial)
  have namedEquation :=
    characterizes [] [] namedProcess namedProcess_wellTyped
  have supportsEqual :
      namedProcess.erase.freeNames = (Proc.erase (.zero : Proc)).freeNames :=
    namedEquation.trans zeroEquation.symm
  simpa using supportsEqual

/--
The obstruction is witnessed by actual inhabitants of the presented term
family, rather than by an empty or merely hypothetical interface.
-/
theorem obstruction_is_nonempty :
    Nonempty (OpenSMC.Term environment [] []) ∧
      namedProcess.erase.freeNames ≠
        (Proc.erase (.zero : Proc)).freeNames := by
  refine ⟨⟨namedAtom⟩, ?_⟩
  simp

end Cantilune.Pi.OpenSMCBoundaryObstruction
