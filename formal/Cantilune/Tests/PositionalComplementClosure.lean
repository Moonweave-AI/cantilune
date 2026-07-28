import Cantilune.Core.PositionalComplementClosure
import Cantilune.Tests.PositionalDPOI

/-!
# Positional canonical-complement closure regression

The identity occurrence deletes nothing.  This exercises the construction of
the retained intrinsic graph and the typed natural isomorphism with the
canonical retained subpresheaf.
-/

namespace Cantilune.Tests.PositionalComplementClosure

open CategoryTheory
open Cantilune.Core
open Cantilune.Core.PositionalComplementClosure
open Cantilune.Core.PresheafComplementDPO
open Cantilune.Tests.PositionalDPOI

theorem identity_legal :
    Legal (𝟙 graph) (𝟙 graph) := by
  intro X Y f x hx hdel
  rcases hdel with ⟨y, hy, hno⟩
  apply hno y
  change y = y
  rfl

theorem identity_boundary_retained :
    BoundaryRetained (𝟙 graph) (𝟙 graph) := by
  constructor
  · intro i
    exact Fin.elim0 i
  · intro i
    exact Fin.elim0 i

noncomputable example :
    (PositionalDPOI.encodingFunctor signature [] []).essImage
      (retainedObject (𝟙 graph) (𝟙 graph) identity_legal) :=
  retainedObject_mem_positionalImage
    (𝟙 graph) (𝟙 graph)
    identity_legal identity_boundary_retained

end Cantilune.Tests.PositionalComplementClosure
