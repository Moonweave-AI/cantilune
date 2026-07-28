import Cantilune.Pi.OpenSMC
import Cantilune.Pi.LateGuardedReplication

/-!
# Polarised positional Open-pi boundaries and their strong operational kernel

The public boundary in this module contains no concrete pi names.  A port is
an abstract position carrying a payload sort and a polarity.  Concrete names
are selected only by `realizeAt`; tensor is therefore total even when an
object is tensored with itself.

There are deliberately two layers:

* `Hom` is the already kernel-checked presented OpenSMC quotient, indexed by
  the erased positional boundary.  Its category, tensor, associator, unitors
  and braiding inherit the complete SMC equations.
* `RecursiveLate.NativeStep` supplies the operational statements.  A
  polarised wire is a persistent guarded input followed by an output in the
  direction selected by the polarity.  Plugging requires both operands to
  expose complementary native actions on the *same realized middle
  endpoint*, and hides that endpoint by native restriction.  Every theorem
  below is one strong step; no weak closure or bisimulation quotient occurs.

A wire cannot forward a received value in one labelled transition: the
standard late LTS first exposes an input and only its derivative can output.
`wire_not_atomic_relay` records this load-bearing boundary as a kernel theorem.
-/

namespace Cantilune.Pi.OpenSMCPolarisedOperational

open Cantilune.Pi
open Cantilune.Pi.OpenSMC
open Cantilune.Pi.RecursiveProc

/-! ## Abstract typed and polarised positions -/

/-- Direction in which an identity wire forwards a received value. -/
inductive Polarity where
  | positive
  | negative
  deriving DecidableEq, Repr

/-- A public port is a channel position with a typed payload and polarity. -/
structure PortType where
  payload : NameSort
  polarity : Polarity
  deriving DecidableEq, Repr

/--
Public objects contain positions only; concrete names are not object data.

The erased interface is cached as a field so that tensor has a definitionally
concatenated OpenSMC boundary.  `boundary_spec` proves that this cache contains
exactly one channel occurrence per typed polarised port.
-/
structure Object where
  ports : List PortType
  boundary : OpenSMC.Interface
  boundary_spec :
    boundary = ports.map (fun _ => NameSort.channel)

/-- Canonical object constructor from an abstract position vector. -/
def ofPorts (ports : List PortType) : Object where
  ports := ports
  boundary := ports.map (fun _ => NameSort.channel)
  boundary_spec := rfl

/-- Positions are occurrence-sensitive, including under self tensor. -/
abbrev Position (object : Object) := Fin object.ports.length

/-- Total tensor on objects. -/
def tensorObject (left right : Object) : Object where
  ports := left.ports ++ right.ports
  boundary := left.boundary ++ right.boundary
  boundary_spec := by
    rw [left.boundary_spec, right.boundary_spec, List.map_append]

@[simp]
theorem tensorObject_nil_left (object : Object) :
    tensorObject (ofPorts []) object = object := by
  cases object
  simp [tensorObject, ofPorts]

@[simp]
theorem tensorObject_nil_right (object : Object) :
    tensorObject object (ofPorts []) = object := by
  cases object
  simp [tensorObject, ofPorts]

theorem tensorObject_assoc (a b c : Object) :
    tensorObject (tensorObject a b) c =
      tensorObject a (tensorObject b c) := by
  cases a
  cases b
  cases c
  simp [tensorObject, List.append_assoc]

/-! ## Presented SMC indexed by polarised positions -/

/--
The presented quotient sees one channel occurrence per abstract port.
Payload and polarity remain at the positional layer and are enforced by the
nominal realization below.
-/
def eraseBoundary (object : Object) : OpenSMC.Interface :=
  object.boundary

@[simp]
theorem eraseBoundary_nil :
    eraseBoundary (ofPorts []) = [] := by
  rfl

@[simp]
theorem eraseBoundary_tensor (left right : Object) :
    eraseBoundary (tensorObject left right) =
      eraseBoundary left ++ eraseBoundary right := by
  rfl

/--
Names used for public endpoints are even.  The residue modulo four records
the payload sort, so one fixed environment validates every realized object.
-/
def endpointName : NameSort → Nat → Name
  | .data, slot => 4 * slot
  | .channel, slot => 4 * slot + 2

/-- Values used by concrete regression witnesses have their declared sort. -/
def valueName : NameSort → Nat → Name
  | .data, slot => 4 * slot + 1
  | .channel, slot => 4 * slot

/-- A single infinite environment for all positional realizations. -/
def environment : TypeEnv where
  sort name := if name % 2 = 0 then .channel else .data
  payload name := if name % 4 = 0 then .data else .channel

@[simp]
theorem environment_sort_endpoint
    (payload : NameSort) (slot : Nat) :
    environment.sort (endpointName payload slot) = .channel := by
  cases payload <;>
    simp [environment, endpointName, Nat.mul_mod]

@[simp]
theorem environment_payload_endpoint
    (payload : NameSort) (slot : Nat) :
    environment.payload (endpointName payload slot) = payload := by
  cases payload <;>
    simp [environment, endpointName, Nat.add_mod]

@[simp]
theorem environment_sort_value
    (sort : NameSort) (slot : Nat) :
    environment.sort (valueName sort slot) = sort := by
  cases sort <;>
    simp [environment, valueName, Nat.mul_mod, Nat.add_mod]

/-- The algebraic hom set of the polarised positional presentation. -/
abbrev Hom (source target : Object) :=
  OpenSMC.Hom environment source.boundary target.boundary

def identity (object : Object) : Hom object object :=
  OpenSMC.Hom.identity environment object.boundary

def comp {source middle target : Object}
    (left : Hom source middle) (right : Hom middle target) :
    Hom source target :=
  OpenSMC.Hom.plugHide left right

def parallel
    {leftIn leftOut rightIn rightOut : Object}
    (left : Hom leftIn leftOut) (right : Hom rightIn rightOut) :
    Hom (tensorObject leftIn rightIn) (tensorObject leftOut rightOut) := by
  change OpenSMC.Hom environment
    (leftIn.boundary ++ rightIn.boundary)
    (leftOut.boundary ++ rightOut.boundary)
  exact OpenSMC.Hom.parallel left right

@[simp]
theorem comp_identity_left
    {source target : Object} (process : Hom source target) :
    comp (identity source) process = process :=
  OpenSMC.Hom.plug_id_left process

@[simp]
theorem comp_identity_right
    {source target : Object} (process : Hom source target) :
    comp process (identity target) = process :=
  OpenSMC.Hom.plug_id_right process

theorem comp_assoc
    {a b c d : Object}
    (first : Hom a b) (second : Hom b c) (third : Hom c d) :
    comp (comp first second) third =
      comp first (comp second third) :=
  OpenSMC.Hom.plug_assoc first second third

@[simp]
theorem parallel_identity (left right : Object) :
    parallel (identity left) (identity right) =
      identity (tensorObject left right) := by
  simpa [parallel, identity, tensorObject, eraseBoundary] using
    OpenSMC.Hom.tensor_id environment
      left.boundary right.boundary

theorem parallel_comp_interchange
    {a b c d e f : Object}
    (left₁ : Hom a b) (left₂ : Hom b c)
    (right₁ : Hom d e) (right₂ : Hom e f) :
    comp (parallel left₁ right₁) (parallel left₂ right₂) =
      parallel (comp left₁ left₂) (comp right₁ right₂) := by
  simpa [comp, parallel, tensorObject, eraseBoundary] using
    OpenSMC.Hom.tensor_comp left₁ left₂ right₁ right₂

def associator (a b c : Object) :
    Hom (tensorObject (tensorObject a b) c)
      (tensorObject a (tensorObject b c)) := by
  change OpenSMC.Hom environment
    ((a.boundary ++ b.boundary) ++ c.boundary)
    (a.boundary ++ (b.boundary ++ c.boundary))
  exact OpenSMC.Hom.associator environment
    a.boundary b.boundary c.boundary

def associatorInv (a b c : Object) :
    Hom (tensorObject a (tensorObject b c))
      (tensorObject (tensorObject a b) c) := by
  change OpenSMC.Hom environment
    (a.boundary ++ (b.boundary ++ c.boundary))
    ((a.boundary ++ b.boundary) ++ c.boundary)
  exact OpenSMC.Hom.associatorInv environment
    a.boundary b.boundary c.boundary

def leftUnitor (object : Object) :
    Hom (tensorObject (ofPorts []) object) object := by
  change OpenSMC.Hom environment
    ([] ++ object.boundary) object.boundary
  exact OpenSMC.Hom.leftUnitor environment object.boundary

def leftUnitorInv (object : Object) :
    Hom object (tensorObject (ofPorts []) object) := by
  change OpenSMC.Hom environment
    object.boundary ([] ++ object.boundary)
  exact OpenSMC.Hom.leftUnitorInv environment object.boundary

def rightUnitor (object : Object) :
    Hom (tensorObject object (ofPorts [])) object := by
  change OpenSMC.Hom environment
    (object.boundary ++ []) object.boundary
  exact OpenSMC.Hom.rightUnitor environment object.boundary

def rightUnitorInv (object : Object) :
    Hom object (tensorObject object (ofPorts [])) := by
  change OpenSMC.Hom environment
    object.boundary (object.boundary ++ [])
  exact OpenSMC.Hom.rightUnitorInv environment object.boundary

def braid (left right : Object) :
    Hom (tensorObject left right) (tensorObject right left) := by
  change OpenSMC.Hom environment
    (left.boundary ++ right.boundary)
    (right.boundary ++ left.boundary)
  exact OpenSMC.Hom.braid environment left.boundary right.boundary

theorem associator_hom_inv (a b c : Object) :
    comp (associator a b c) (associatorInv a b c) =
      identity (tensorObject (tensorObject a b) c) := by
  simpa [comp, associator, associatorInv, identity,
    tensorObject, eraseBoundary] using
    OpenSMC.Hom.associator_hom_inv environment
      a.boundary b.boundary c.boundary

theorem associator_inv_hom (a b c : Object) :
    comp (associatorInv a b c) (associator a b c) =
      identity (tensorObject a (tensorObject b c)) := by
  simpa [comp, associator, associatorInv, identity,
    tensorObject, eraseBoundary] using
    OpenSMC.Hom.associator_inv_hom environment
      a.boundary b.boundary c.boundary

theorem leftUnitor_hom_inv (object : Object) :
    comp (leftUnitor object) (leftUnitorInv object) =
      identity (tensorObject (ofPorts []) object) := by
  simpa [comp, leftUnitor, leftUnitorInv, identity,
    tensorObject, ofPorts] using
    OpenSMC.Hom.leftUnitor_hom_inv environment object.boundary

theorem leftUnitor_inv_hom (object : Object) :
    comp (leftUnitorInv object) (leftUnitor object) =
      identity object := by
  simpa [comp, leftUnitor, leftUnitorInv, identity,
    tensorObject, ofPorts] using
    OpenSMC.Hom.leftUnitor_inv_hom environment object.boundary

theorem rightUnitor_hom_inv (object : Object) :
    comp (rightUnitor object) (rightUnitorInv object) =
      identity (tensorObject object (ofPorts [])) := by
  simpa [comp, rightUnitor, rightUnitorInv, identity,
    tensorObject, ofPorts] using
    OpenSMC.Hom.rightUnitor_hom_inv environment object.boundary

theorem rightUnitor_inv_hom (object : Object) :
    comp (rightUnitorInv object) (rightUnitor object) =
      identity object := by
  simpa [comp, rightUnitor, rightUnitorInv, identity,
    tensorObject, ofPorts] using
    OpenSMC.Hom.rightUnitor_inv_hom environment object.boundary

theorem associator_natural
    {a a' b b' c c' : Object}
    (left : Hom a a') (middle : Hom b b') (right : Hom c c') :
    comp
        (parallel (parallel left middle) right)
        (associator a' b' c') =
      comp
        (associator a b c)
        (parallel left (parallel middle right)) := by
  simpa [comp, parallel, associator, tensorObject] using
    OpenSMC.Hom.associator_natural left middle right

theorem leftUnitor_natural
    {source target : Object} (process : Hom source target) :
    comp
        (parallel (identity (ofPorts [])) process)
        (leftUnitor target) =
      comp (leftUnitor source) process := by
  simpa [comp, parallel, identity, leftUnitor,
    tensorObject, ofPorts] using
    OpenSMC.Hom.leftUnitor_natural process

theorem rightUnitor_natural
    {source target : Object} (process : Hom source target) :
    comp
        (parallel process (identity (ofPorts [])))
        (rightUnitor target) =
      comp (rightUnitor source) process := by
  simpa [comp, parallel, identity, rightUnitor,
    tensorObject, ofPorts] using
    OpenSMC.Hom.rightUnitor_natural process

theorem braid_natural
    {a a' b b' : Object}
    (left : Hom a a') (right : Hom b b') :
    comp (parallel left right) (braid a' b') =
      comp (braid a b) (parallel right left) := by
  simpa [comp, parallel, braid, tensorObject] using
    OpenSMC.Hom.braid_natural left right

theorem braid_symmetry (a b : Object) :
    comp (braid a b) (braid b a) =
      identity (tensorObject a b) := by
  simpa [comp, braid, identity, tensorObject, eraseBoundary] using
    OpenSMC.Hom.symmetry environment
      a.boundary b.boundary

theorem pentagon (a b c d : Object) :
    comp
        (associator (tensorObject a b) c d)
        (associator a b (tensorObject c d)) =
      comp
        (comp
          (parallel (associator a b c) (identity d))
          (associator a (tensorObject b c) d))
        (parallel (identity a) (associator b c d)) := by
  simpa [comp, associator, parallel, identity,
    tensorObject, eraseBoundary] using
    OpenSMC.Hom.pentagon environment
      a.boundary b.boundary c.boundary d.boundary

theorem triangle (a b : Object) :
    parallel (rightUnitor a) (identity b) =
      comp
        (associator a (ofPorts []) b)
        (parallel (identity a) (leftUnitor b)) := by
  simpa [comp, parallel, identity, associator, rightUnitor,
    leftUnitor, tensorObject, ofPorts, eraseBoundary] using
    OpenSMC.Hom.triangle environment
      a.boundary b.boundary

theorem hexagon (a b c : Object) :
    comp
        (comp
          (associator a b c)
          (braid a (tensorObject b c)))
        (associator b c a) =
      comp
        (comp
          (parallel (braid a b) (identity c))
          (associator b a c))
        (parallel (identity b) (braid a c)) := by
  simpa [comp, parallel, identity, associator, braid,
    tensorObject, eraseBoundary] using
    OpenSMC.Hom.hexagon environment
      a.boundary b.boundary c.boundary

/-! ## Fresh nominal realization -/

def positionName
    (offset : Nat) (object : Object) (position : Position object) : Name :=
  endpointName (object.ports.get position).payload (offset + position)

theorem endpointName_slot_injective
    {leftPayload rightPayload : NameSort}
    {leftSlot rightSlot : Nat}
    (equality :
      endpointName leftPayload leftSlot =
        endpointName rightPayload rightSlot) :
    leftSlot = rightSlot := by
  cases leftPayload <;> cases rightPayload
  · simp [endpointName] at equality
    omega
  · have residue := congrArg (fun name : Nat => name % 4) equality
    simp [endpointName, Nat.add_mod] at residue
  · have residue := congrArg (fun name : Nat => name % 4) equality
    simp [endpointName, Nat.add_mod] at residue
  · simp [endpointName] at equality
    omega

theorem positionName_injective
    (offset : Nat) (object : Object) :
    Function.Injective (positionName offset object) := by
  intro left right equality
  apply Fin.ext
  have slots := endpointName_slot_injective equality
  omega

/-- A realization stores the concrete name at every abstract occurrence. -/
structure Realization (object : Object) where
  offset : Nat
  names : List Name :=
    List.ofFn (positionName offset object)
  names_spec :
    names = List.ofFn (positionName offset object) := by
      rfl

namespace Realization

def nameAt {object : Object}
    (realization : Realization object) (position : Position object) : Name :=
  positionName realization.offset object position

@[simp]
theorem names_eq {object : Object}
    (realization : Realization object) :
    realization.names =
      List.ofFn (positionName realization.offset object) :=
  realization.names_spec

theorem names_nodup {object : Object}
    (realization : Realization object) :
    realization.names.Nodup := by
  rw [realization.names_eq, List.nodup_ofFn]
  exact positionName_injective realization.offset object

@[simp]
theorem endpoint_sort {object : Object}
    (realization : Realization object) (position : Position object) :
    environment.sort (realization.nameAt position) = .channel :=
  environment_sort_endpoint _ _

@[simp]
theorem endpoint_payload {object : Object}
    (realization : Realization object) (position : Position object) :
    environment.payload (realization.nameAt position) =
      (object.ports.get position).payload :=
  environment_payload_endpoint _ _

end Realization

def avoidanceCeiling (avoid : Finset Name) : Nat :=
  avoid.sup id

def freshOffset (avoid : Finset Name) : Nat :=
  avoidanceCeiling avoid + 1

def freshRealization (avoid : Finset Name) (object : Object) :
    Realization object where
  offset := freshOffset avoid

theorem slot_le_endpointName (payload : NameSort) (slot : Nat) :
    slot ≤ endpointName payload slot := by
  cases payload <;> simp [endpointName] <;> omega

theorem member_le_avoidanceCeiling
    {avoid : Finset Name} {name : Name} (member : name ∈ avoid) :
    name ≤ avoidanceCeiling avoid :=
  Finset.le_sup (f := id) member

theorem freshRealization_disjoint
    (avoid : Finset Name) (object : Object) :
    Disjoint (freshRealization avoid object).names.toFinset avoid := by
  rw [Finset.disjoint_left]
  intro name realized forbidden
  rw [Realization.names_eq, List.mem_toFinset, List.mem_ofFn] at realized
  obtain ⟨position, positionEq⟩ := realized
  have below := member_le_avoidanceCeiling forbidden
  have aboveOffset :
      avoidanceCeiling avoid < freshOffset avoid := by
    simp [freshOffset]
  have offsetLeSlot :
      freshOffset avoid ≤ freshOffset avoid + position := by
    omega
  have slotLeName :=
    slot_le_endpointName
      (object.ports.get position).payload
      (freshOffset avoid + position)
  have above :
      avoidanceCeiling avoid <
        positionName (freshOffset avoid) object position := by
    exact lt_of_lt_of_le aboveOffset
      (le_trans offsetLeSlot slotLeName)
  change positionName (freshOffset avoid) object position = name at positionEq
  rw [positionEq] at above
  exact (not_lt_of_ge below) above

/-! ## Persistent polarised wires -/

/-- Direction selected by a port polarity. -/
def wireEndpoints (port : PortType) (source target : Name) : Name × Name :=
  match port.polarity with
  | .positive => (source, target)
  | .negative => (target, source)

/--
One persistent late-pi forwarding server.  Its input binder is exposed by a
strong late input action, and the derivative emits that received name.
-/
def wire (port : PortType)
    (source target binder : Name) : RecursiveProc :=
  let endpoints := wireEndpoints port source target
  .repRecv endpoints.1 binder
    (.send endpoints.2 binder .zero)

@[simp]
theorem wire_positive (payload : NameSort)
    (source target binder : Name) :
    wire ⟨payload, .positive⟩ source target binder =
      .repRecv source binder (.send target binder .zero) := by
  rfl

@[simp]
theorem wire_negative (payload : NameSort)
    (source target binder : Name) :
    wire ⟨payload, .negative⟩ source target binder =
      .repRecv target binder (.send source binder .zero) := by
  rfl

/-- First half of a reusable wire is one genuine strong late input step. -/
theorem wire_native_input
    (port : PortType) (source target binder : Name) :
    RecursiveLate.NativeStep
      (wire port source target binder)
      (.input (wireEndpoints port source target).1 binder)
      (.par
        (.send (wireEndpoints port source target).2 binder .zero)
        (wire port source target binder)) := by
  cases port with
  | mk payload polarity =>
      cases polarity <;>
        exact RecursiveLate.NativeStep.replicatedInput

/-- Its derivative exposes the forwarded output in one strong step. -/
theorem wire_native_output
    (port : PortType) (source target binder : Name) :
    RecursiveLate.NativeStep
      (.par
        (.send (wireEndpoints port source target).2 binder .zero)
        (wire port source target binder))
      (.output (wireEndpoints port source target).2 binder)
      (.par .zero (wire port source target binder)) := by
  apply RecursiveLate.NativeStep.parLeft
  · simp [Raw.Action.boundNames]
  · exact RecursiveLate.NativeStep.prefixOutput

/--
Standard late input and forwarded output are necessarily two different
labels; a claimed single action cannot be both halves of a nondegenerate
relay.
-/
theorem wire_not_atomic_relay
    {input output binder : Name} :
    Raw.Action.input input binder ≠ Raw.Action.output output binder := by
  intro equality
  cases equality

/-! ## Exact strong plug and hiding constructions -/

def hideNames : List Name → RecursiveProc → RecursiveProc
  | [], process => process
  | binder :: rest, process => .new binder (hideNames rest process)

@[simp]
theorem hideNames_nil (process : RecursiveProc) :
    hideNames [] process = process := by
  rfl

@[simp]
theorem hideNames_cons
    (binder : Name) (rest : List Name) (process : RecursiveProc) :
    hideNames (binder :: rest) process =
      .new binder (hideNames rest process) := by
  rfl

theorem hideNames_native
    (hidden : List Name)
    (step : RecursiveLate.NativeStep source action target)
    (fresh : ∀ binder, binder ∈ hidden → binder ∉ action.names) :
    RecursiveLate.NativeStep
      (hideNames hidden source) action (hideNames hidden target) := by
  induction hidden with
  | nil =>
      simpa using step
  | cons binder rest inductionHypothesis =>
      apply RecursiveLate.NativeStep.restrict
      · exact fresh binder (by simp)
      · exact inductionHypothesis (fun name member =>
          fresh name (by simp [member]))

theorem hideNames_native_tau
    (hidden : List Name)
    (step : RecursiveLate.NativeStep source .tau target) :
    RecursiveLate.NativeStep
      (hideNames hidden source) .tau (hideNames hidden target) :=
  hideNames_native hidden step (by
    intro binder member
    simp [Raw.Action.names])

/--
Endpoint-connecting plug: both processes are placed in parallel and the
concrete names of the realized middle boundary are restricted.
-/
def plug {middle : Object}
    (realization : Realization middle)
    (left right : RecursiveProc) : RecursiveProc :=
  hideNames realization.names (.par left right)

/--
Complementary free output/input actions on one realized middle occurrence
produce exactly one native tau step under the complete hidden boundary.
-/
theorem plug_syncLeft_native
    {middle : Object}
    (realization : Realization middle)
    (position : Position middle)
    (outputStep :
      RecursiveLate.NativeStep left
        (.output (realization.nameAt position) value) left')
    (inputStep :
      RecursiveLate.NativeStep right
        (.input (realization.nameAt position) binder) right')
    (binderFresh : binder ∉ left'.freeNames) :
    RecursiveLate.NativeStep
      (plug realization left right)
      .tau
      (hideNames realization.names
        (.par left'
          (right'.substituteCaptureAvoiding binder value))) := by
  apply hideNames_native_tau
  exact RecursiveLate.NativeStep.syncLeft
    outputStep inputStep binderFresh

/-- Mirror image of exact endpoint-connecting free communication. -/
theorem plug_syncRight_native
    {middle : Object}
    (realization : Realization middle)
    (position : Position middle)
    (inputStep :
      RecursiveLate.NativeStep left
        (.input (realization.nameAt position) binder) left')
    (outputStep :
      RecursiveLate.NativeStep right
        (.output (realization.nameAt position) value) right')
    (binderFresh : binder ∉ right'.freeNames) :
    RecursiveLate.NativeStep
      (plug realization left right)
      .tau
      (hideNames realization.names
        (.par
          (left'.substituteCaptureAvoiding binder value)
          right')) := by
  apply hideNames_native_tau
  exact RecursiveLate.NativeStep.syncRight
    inputStep outputStep binderFresh

/-- Tensor/parallel preserves any native step with the standard freshness side condition. -/
theorem parallel_native_left
    (fresh : Disjoint action.boundNames right.freeNames)
    (step : RecursiveLate.NativeStep left action left') :
    RecursiveLate.NativeStep
      (.par left right) action (.par left' right) :=
  RecursiveLate.NativeStep.parLeft fresh step

/-- Mirror image of exact tensor context propagation. -/
theorem parallel_native_right
    (fresh : Disjoint action.boundNames left.freeNames)
    (step : RecursiveLate.NativeStep right action right') :
    RecursiveLate.NativeStep
      (.par left right) action (.par left right') :=
  RecursiveLate.NativeStep.parRight fresh step

end Cantilune.Pi.OpenSMCPolarisedOperational
