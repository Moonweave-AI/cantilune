import Cantilune.Pi.ExternalFMS
import Cantilune.Pi.FMSModel
import Cantilune.Pi.Late

/-!
# A concrete support-semantics bridge over the functor-category models

This file supplies a nonempty instance of the abstract bridge in
`ExternalFMS`.  It interprets a finite raw process by the support of its free
names in the current finite world.  Parallel and the deliberately
boundary-agnostic reference plugging operation are interpreted by union.

The construction is a support semantics, not the Fiore--Moggi--Sangiorgi
powerdomain semantics.  It proves that the existing OpenSMC/FMS interfaces can
actually commute for a nontrivial world-indexed carrier.  It does not claim
full abstraction, adequacy for hiding, or a solution of an FMS domain
equation.

`ExternalFMS.denote` presently receives a closed nominal term and a world, but
no proof that the term is supported by that world and no action that renames
the term along a world injection.  Consequently a fixed term with a free name
is not a natural global element under arbitrary injections.  The final
counterexample records this interface boundary explicitly.
-/

namespace Cantilune.Pi.FMSBridge

open CategoryTheory
open Cantilune.Pi
open Cantilune.Pi.FMSModel

/-- Free-name support of a raw process inside a finite world. -/
def supportDenote (process : Raw.Proc) (world : World) : Set (Fin world) :=
  { value | value.val ∈ process.freeNames }

@[simp]
theorem supportDenote_zero (world : World) :
    supportDenote .zero world = ∅ := by
  ext value
  simp [supportDenote, Raw.Proc.freeNames]

@[simp]
theorem supportDenote_par
    (left right : Raw.Proc) (world : World) :
    supportDenote (.par left right) world =
      supportDenote left world ∪ supportDenote right world := by
  ext value
  simp [supportDenote, Raw.Proc.freeNames]

/--
The transition graph is the exact image of native raw transitions under
support denotation.  This keeps `strong_step_preserving` non-vacuous without
pretending to provide the FMS powerdomain transition structure.
-/
def supportTransition
    (world : World) (source : Set (Fin world))
    (action : Raw.Action) (target : Set (Fin world)) : Prop :=
  ∃ left right,
    Raw.Step left action right ∧
    supportDenote left world = source ∧
    supportDenote right world = target

/-- A concrete, nonconstant-carrier inhabitant of the external model record. -/
def supportModel : ExternalFMS where
  World := World
  Agent world := setAgent.obj world
  denote := supportDenote
  inactive _ := ∅
  parallel _ := (· ∪ ·)
  observationalEq left right := left.freeNames = right.freeNames
  denotationalEq _ := Eq
  transition := supportTransition

/-- Union exposed at the dependent carrier type of `supportModel`. -/
def supportModelUnion
    (world : supportModel.World)
    (left right : supportModel.Agent world) :
    supportModel.Agent world := by
  change Set (Fin world) at left right ⊢
  exact left ∪ right

/-- Empty support exposed at the dependent carrier type of `supportModel`. -/
def supportModelEmpty
    (world : supportModel.World) : supportModel.Agent world := by
  change Set (Fin world)
  exact ∅

/-- The support model meets every generic bridge obligation. -/
theorem supportBridgeObligations :
    ExternalFMS.BridgeObligations supportModel where
  observational_refl := by
    intro process
    rfl
  observational_symm := by
    intro left right equality
    exact equality.symm
  observational_trans := by
    intro left middle right first second
    exact first.trans second
  denotational_refl := by
    intro world agent
    rfl
  denotational_symm := by
    intro world left right equality
    exact equality.symm
  denotational_trans := by
    intro world left middle right first second
    exact first.trans second
  zero_denotes_inactive := by
    intro world
    exact supportDenote_zero world
  parallel_preserving := by
    intro world left right
    exact supportDenote_par left right world
  strong_step_preserving := by
    intro left right action step world
    exact ⟨left, right, step, rfl, rfl⟩
  observational_sound := by
    intro left right equalSupport world
    ext value
    simp only [supportModel, supportDenote, Set.mem_setOf_eq]
    rw [equalSupport]

/--
Reference open interpretation.  Because `OpenSMC.Interface` contains only
sorts and no boundary-name assignment, it cannot select concrete names to
restrict.  The executable reference therefore interprets plugging as
parallel support union and every pure wiring term as inactive support.
-/
def supportOpenInterpretation :
    ExternalFMS.OpenInterpretation supportModel where
  plugHideRaw _ left right := .par left right
  plugHideDenote _ := supportModelUnion
  wiringRaw _ := .zero
  wiringDenote _ := supportModelEmpty
  parallel_congr := by
    intro world left left' right right' leftEq rightEq
    subst left'
    subst right'
    rfl
  plugHide_congr := by
    intro middle world left left' right right' leftEq rightEq
    subst left'
    subst right'
    rfl
  plugHide_preserving := by
    intro middle world left right
    exact supportDenote_par left right world
  wiring_preserving := by
    intro wiring world
    exact supportDenote_zero world

/--
An actual, unconditional commuting theorem for the concrete support model.
The theorem is pointwise in a finite world, exactly matching the current
`ExternalFMS` interface.
-/
theorem support_open_pi_commutes
    {Γ : TypeEnv} {input output : OpenSMC.Interface}
    (term : OpenSMC.Term Γ input output)
    (world : World) :
    supportModel.denote
        (ExternalFMS.OpenInterpretation.operationalRoute
          supportOpenInterpretation term)
        world =
      ExternalFMS.OpenInterpretation.denotationalRoute
        supportOpenInterpretation term world :=
  ExternalFMS.OpenInterpretation.open_pi_fms_commutes
    supportBridgeObligations supportOpenInterpretation term world

/--
The actual Set-valued and omega-CPO-valued world actions agree on their common
support carrier.
-/
theorem set_cpo_world_action_agree
    {source target : World} (injection : source ⟶ target)
    (support : Set (Fin source)) :
    cpoAgent.map injection support =
      setAgent.map injection support := by
  rfl

/-- Parallel support transport commutes in both concrete functor routes. -/
theorem set_cpo_parallel_natural
    {source target : World} (injection : source ⟶ target)
    (left right : Set (Fin source)) :
    cpoAgent.map injection
        (show Set (Fin source) from left ∪ right) =
      setAgent.map injection left ∪ setAgent.map injection right := by
  rw [set_cpo_world_action_agree]
  exact FMSModel.parallel_natural injection left right

/-- Empty support is transported to empty support by both world actions. -/
theorem set_cpo_inactive_natural
    {source target : World} (injection : source ⟶ target) :
    cpoAgent.map injection
        (show Set (Fin source) from ∅) =
      (∅ : Set (Fin target)) := by
  rw [set_cpo_world_action_agree]
  change homToFun injection '' (∅ : Set (Fin source)) = ∅
  simp

/-! ## Exact naturality boundary of the current external interface -/

/-- The transposition of the two-name world. -/
def swapTwo : (2 : World) ⟶ 2 where
  toFun := Equiv.swap (0 : Fin 2) (1 : Fin 2)
  injective := (Equiv.swap (0 : Fin 2) (1 : Fin 2)).injective

/-- A process with one free nominal name. -/
def freeZeroProcess : Raw.Proc :=
  .send 0 0 .zero

/--
A fixed nominal process is not a natural global element under arbitrary world
injections: swapping the world transports its support from `0` to `1`, while
re-denoting the unchanged syntax still selects `0`.

A strict natural denotation therefore minimally needs a supported-process
context and a corresponding process-renaming action.
-/
theorem fixed_nominal_denotation_not_natural :
    setAgent.map swapTwo (supportDenote freeZeroProcess 2) ≠
      supportDenote freeZeroProcess 2 := by
  intro equality
  have zeroMember :
      (0 : Fin 2) ∈
        setAgent.map swapTwo (supportDenote freeZeroProcess 2) := by
    rw [equality]
    simp [supportDenote, freeZeroProcess, Raw.Proc.freeNames]
  rcases zeroMember with ⟨source, sourceMember, endpoint⟩
  have sourceZero : source = (0 : Fin 2) := by
    simpa [supportDenote, freeZeroProcess, Raw.Proc.freeNames] using sourceMember
  subst source
  norm_num [swapTwo, homToFun, asInjection] at endpoint

end Cantilune.Pi.FMSBridge
