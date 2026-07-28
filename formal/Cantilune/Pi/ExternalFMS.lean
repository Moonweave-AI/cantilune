import Mathlib
import Cantilune.Pi.Core
import Cantilune.Pi.OpenSMC

/-!
# Explicit boundary for an external FMS denotational model

This module intentionally does **not** postulate full abstraction or construct
the Fiore--Moggi--Sangiorgi presheaf/CPO model.  It only records the data and
proof obligations that an independently checked external model must provide
before a commuting bridge can be claimed.
-/

namespace Cantilune.Pi

/--
Data exported by an external denotational implementation.  No equations,
world-renaming action, naturality, or soundness facts are built into this
record, so a value of `ExternalFMS` alone is not evidence that the supplied
data implements the Fiore--Moggi--Sangiorgi model.
-/
structure ExternalFMS where
  World : Type
  Agent : World → Type
  denote : Raw.Proc → (world : World) → Agent world
  inactive : (world : World) → Agent world
  parallel : (world : World) → Agent world → Agent world → Agent world
  observationalEq : Raw.Proc → Raw.Proc → Prop
  denotationalEq :
    (world : World) → Agent world → Agent world → Prop
  transition :
    (world : World) → Agent world → Raw.Action → Agent world → Prop

namespace ExternalFMS

/--
The minimum obligations represented by this current interface before it may
advertise an operational/denotational bridge.  This is an unsupplied
proposition over supplied data; the module neither postulates a witness nor
registers an instance.  A complete FMS bridge additionally requires the
world/injection functoriality and naturality interface that is deliberately
absent above.
-/
structure BridgeObligations (model : ExternalFMS) : Prop where
  observational_refl :
    ∀ process, model.observationalEq process process
  observational_symm :
    ∀ {left right},
      model.observationalEq left right →
      model.observationalEq right left
  observational_trans :
    ∀ {left middle right},
      model.observationalEq left middle →
      model.observationalEq middle right →
      model.observationalEq left right
  denotational_refl :
    ∀ world agent, model.denotationalEq world agent agent
  denotational_symm :
    ∀ world {left right},
      model.denotationalEq world left right →
      model.denotationalEq world right left
  denotational_trans :
    ∀ world {left middle right},
      model.denotationalEq world left middle →
      model.denotationalEq world middle right →
      model.denotationalEq world left right
  zero_denotes_inactive :
    ∀ world,
      model.denotationalEq world (model.denote .zero world) (model.inactive world)
  parallel_preserving :
    ∀ world left right,
      model.denotationalEq world
        (model.denote (.par left right) world)
        (model.parallel world (model.denote left world) (model.denote right world))
  strong_step_preserving :
    ∀ {left right action},
      Raw.Step left action right →
      ∀ world,
        model.transition world
          (model.denote left world)
          action
          (model.denote right world)
  observational_sound :
    ∀ {left right},
      model.observationalEq left right →
      ∀ world,
        model.denotationalEq world
          (model.denote left world)
          (model.denote right world)

/--
Typed processes enter an external model only through independently checked
erasure.  This definition makes the data-flow direction explicit without
asserting that any `BridgeObligations` witness exists.
-/
def denoteTyped (model : ExternalFMS) (process : Proc) (world : model.World) :
    model.Agent world :=
  model.denote process.erase world

/--
Structural wiring generators used by the presented open-process SMC.  Keeping
them explicit prevents the external bridge from silently interpreting
plugging, hiding, or symmetry as the closed-process `parallel` operation.
-/
inductive OpenWiring where
  | associator (left middle right : OpenSMC.Interface)
  | associatorInv (left middle right : OpenSMC.Interface)
  | leftUnitor (boundary : OpenSMC.Interface)
  | leftUnitorInv (boundary : OpenSMC.Interface)
  | rightUnitor (boundary : OpenSMC.Interface)
  | rightUnitorInv (boundary : OpenSMC.Interface)
  | braid (left right : OpenSMC.Interface)

/--
Independent interpretation data for open boundary plugging and structural
wiring.  A provider must supply concrete raw π terms and denotational
operations, plus local preservation and congruence proofs.  No inhabitant is
constructed in this repository.
-/
structure OpenInterpretation (model : ExternalFMS) where
  plugHideRaw :
    OpenSMC.Interface → Raw.Proc → Raw.Proc → Raw.Proc
  plugHideDenote :
    (middle : OpenSMC.Interface) →
    (world : model.World) →
    model.Agent world → model.Agent world → model.Agent world
  wiringRaw : OpenWiring → Raw.Proc
  wiringDenote :
    OpenWiring → (world : model.World) → model.Agent world
  parallel_congr :
    ∀ world {left left' right right'},
      model.denotationalEq world left left' →
      model.denotationalEq world right right' →
      model.denotationalEq world
        (model.parallel world left right)
        (model.parallel world left' right')
  plugHide_congr :
    ∀ middle world {left left' right right'},
      model.denotationalEq world left left' →
      model.denotationalEq world right right' →
      model.denotationalEq world
        (plugHideDenote middle world left right)
        (plugHideDenote middle world left' right')
  plugHide_preserving :
    ∀ middle world left right,
      model.denotationalEq world
        (model.denote (plugHideRaw middle left right) world)
        (plugHideDenote middle world
          (model.denote left world) (model.denote right world))
  wiring_preserving :
    ∀ wiring world,
      model.denotationalEq world
        (model.denote (wiringRaw wiring) world)
        (wiringDenote wiring world)

namespace OpenInterpretation

/--
The operational route from a typed open expression to independently supplied
raw π wiring.  Atomic processes pass only through typed erasure; parallel
remains raw π parallel.
-/
def operationalRoute {model : ExternalFMS} (interpretation : OpenInterpretation model)
    {Γ : TypeEnv} {input output : OpenSMC.Interface} :
    OpenSMC.Term Γ input output → Raw.Proc
  | .identity _ => .zero
  | .atom _ _ process _ => process.erase
  | .plugHide (middle := middle) left right =>
      interpretation.plugHideRaw middle
        (operationalRoute interpretation left)
        (operationalRoute interpretation right)
  | .parallel left right =>
      .par
        (operationalRoute interpretation left)
        (operationalRoute interpretation right)
  | .associator left middle right =>
      interpretation.wiringRaw (.associator left middle right)
  | .associatorInv left middle right =>
      interpretation.wiringRaw (.associatorInv left middle right)
  | .leftUnitor boundary =>
      interpretation.wiringRaw (.leftUnitor boundary)
  | .leftUnitorInv boundary =>
      interpretation.wiringRaw (.leftUnitorInv boundary)
  | .rightUnitor boundary =>
      interpretation.wiringRaw (.rightUnitor boundary)
  | .rightUnitorInv boundary =>
      interpretation.wiringRaw (.rightUnitorInv boundary)
  | .braid left right =>
      interpretation.wiringRaw (.braid left right)

/--
The direct denotational route for the same open expression.  In particular,
`parallel` is the internal operation on the agent object, not the tensor of
the surrounding model category.
-/
def denotationalRoute {model : ExternalFMS}
    (interpretation : OpenInterpretation model)
    {Γ : TypeEnv} {input output : OpenSMC.Interface}
    (term : OpenSMC.Term Γ input output)
    (world : model.World) : model.Agent world :=
  match term with
  | .identity _ => model.inactive world
  | .atom _ _ process _ => model.denote process.erase world
  | .plugHide (middle := middle) left right =>
      interpretation.plugHideDenote middle world
        (denotationalRoute interpretation left world)
        (denotationalRoute interpretation right world)
  | .parallel left right =>
      model.parallel world
        (denotationalRoute interpretation left world)
        (denotationalRoute interpretation right world)
  | .associator left middle right =>
      interpretation.wiringDenote (.associator left middle right) world
  | .associatorInv left middle right =>
      interpretation.wiringDenote (.associatorInv left middle right) world
  | .leftUnitor boundary =>
      interpretation.wiringDenote (.leftUnitor boundary) world
  | .leftUnitorInv boundary =>
      interpretation.wiringDenote (.leftUnitorInv boundary) world
  | .rightUnitor boundary =>
      interpretation.wiringDenote (.rightUnitor boundary) world
  | .rightUnitorInv boundary =>
      interpretation.wiringDenote (.rightUnitorInv boundary) world
  | .braid left right =>
      interpretation.wiringDenote (.braid left right) world

/--
Conditional, construct-by-construct commutation of the typed-open operational
route with the external denotational route.

This theorem is not an FMS witness and does not assert full abstraction.  It
requires both the generic `BridgeObligations` and independent concrete
`OpenInterpretation` data.  The conclusion is proved by structural induction;
it is not stored as a field of either premise.
-/
theorem open_pi_fms_commutes {model : ExternalFMS}
    (bridge : BridgeObligations model)
    (interpretation : OpenInterpretation model)
    {Γ : TypeEnv} {input output : OpenSMC.Interface}
    (term : OpenSMC.Term Γ input output)
    (world : model.World) :
    model.denotationalEq world
      (model.denote (operationalRoute interpretation term) world)
      (denotationalRoute interpretation term world) := by
  induction term with
  | identity boundary =>
      exact bridge.zero_denotes_inactive world
  | atom input output process typed =>
      exact bridge.denotational_refl world _
  | plugHide left right leftIH rightIH =>
      exact bridge.denotational_trans world
        (interpretation.plugHide_preserving _ world _ _)
        (interpretation.plugHide_congr _ world leftIH rightIH)
  | parallel left right leftIH rightIH =>
      exact bridge.denotational_trans world
        (bridge.parallel_preserving world _ _)
        (interpretation.parallel_congr world leftIH rightIH)
  | associator left middle right =>
      exact interpretation.wiring_preserving
        (.associator left middle right) world
  | associatorInv left middle right =>
      exact interpretation.wiring_preserving
        (.associatorInv left middle right) world
  | leftUnitor boundary =>
      exact interpretation.wiring_preserving (.leftUnitor boundary) world
  | leftUnitorInv boundary =>
      exact interpretation.wiring_preserving (.leftUnitorInv boundary) world
  | rightUnitor boundary =>
      exact interpretation.wiring_preserving (.rightUnitor boundary) world
  | rightUnitorInv boundary =>
      exact interpretation.wiring_preserving (.rightUnitorInv boundary) world
  | braid left right =>
      exact interpretation.wiring_preserving (.braid left right) world

end OpenInterpretation

end ExternalFMS

end Cantilune.Pi
