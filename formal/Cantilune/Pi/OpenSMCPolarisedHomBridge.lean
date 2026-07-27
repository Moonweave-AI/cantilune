import Cantilune.Pi.FMSConcreteD1AAcceptance

/-!
# Proof-relevant bridge from presented Open-pi morphisms to native processes

The presented Open-pi quotient and the native late-pi LTS have deliberately
different equalities.  This module connects them with a proof-relevant,
partial realization relation rather than identifying them.

`HomRealizes h process` can only be built from:

* a typed atom and its erased guarded process;
* the concrete two-phase wire implementing a singleton presented identity;
* tensor/parallel;
* composition by the actual shared-boundary `plug`/restriction operation; or
* transport along an already proved presented-Hom equality.

`StrongHomRealization h` adds one genuine `RecursiveLate.NativeStep` whose
source is related to `h`.  Its FMS compatibility is constructed by the
concrete D1-A representative theorem.  Hiding/restriction preserve the native
step through the actual restriction rule while retaining the base Hom
realization as explicit data.

The identity bridge is intentionally a protocol: input and derivative-output
are two distinct strong labels.  It is not a raw structural identity, and the
existing no-go theorem remains part of the final acceptance record.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.OpenSMCPolarisedHomBridge

open Cantilune.Pi
open Cantilune.Pi.OpenSMCPolarisedOperational
open Cantilune.Pi.OpenSMCPolarisedAdequacy
open Cantilune.Pi.FMSConcreteD1AAcceptance

/--
Concrete nominal endpoints witnessing that a typed atom actually mentions
every declared abstract boundary position.

The `Realization` indices provide the port payload types; occurrence in the
erased syntax prevents an arbitrary typed process from being paired with an
unrelated nonempty Hom boundary.
-/
structure AtomBoundaryWitness
    {source target : Object} (process : Proc) where
  sourceNames : Realization source
  targetNames : Realization target
  sourceOccurs :
    ∀ position : Position source,
      sourceNames.nameAt position ∈ process.erase.allNames
  targetOccurs :
    ∀ position : Position target,
      targetNames.nameAt position ∈ process.erase.allNames

/--
The three names used by a singleton wire are pairwise distinct.

This is a semantic premise, not an implementation convention: without it a
bound payload may capture a public endpoint, or the two public ends may
collapse to one nominal channel.
-/
def WireNamesFresh
    (sourceName targetName binder : Name) : Prop :=
  sourceName ≠ targetName ∧
    sourceName ≠ binder ∧
    targetName ≠ binder

/--
Proof-relevant operational realization of a presented morphism.

There is no catch-all constructor.  In particular, presented equality alone
does not conjure a native transition; it can only transport a realization
which was already constructed by one of the operational constructors.
-/
inductive HomRealizes :
    {source target : Object} →
      Hom source target → RecursiveProc → Type
  | emptyIdentity :
      HomRealizes
        (identity (ofPorts []))
        .zero
  | singletonIdentity
      (port : PortType) (sourceName targetName binder : Name)
      (_fresh : WireNamesFresh sourceName targetName binder) :
      HomRealizes
        (identity (ofPorts [port]))
        (wire port sourceName targetName binder)
  | atom
      {source target : Object}
      (process : Proc) (typed : process.WellTyped environment)
      (boundary : AtomBoundaryWitness (source := source) (target := target)
        process) :
      HomRealizes
        (OpenSMC.Hom.atom environment
          source.boundary target.boundary process typed)
        (RecursiveProc.ofRaw process.erase)
  | parallel
      {leftIn leftOut rightIn rightOut : Object}
      {leftHom : Hom leftIn leftOut}
      {rightHom : Hom rightIn rightOut}
      {leftProcess rightProcess : RecursiveProc} :
      HomRealizes leftHom leftProcess →
      HomRealizes rightHom rightProcess →
      HomRealizes
        (parallel leftHom rightHom)
        (.par leftProcess rightProcess)
  | plug
      {source middle target : Object}
      {leftHom : Hom source middle}
      {rightHom : Hom middle target}
      {leftProcess rightProcess : RecursiveProc}
      (middleNames : Realization middle) :
      HomRealizes leftHom leftProcess →
      HomRealizes rightHom rightProcess →
      HomRealizes
        (comp leftHom rightHom)
        (OpenSMCPolarisedOperational.plug
          middleNames leftProcess rightProcess)
  | transport
      {source target : Object}
      {left right : Hom source target}
      {process : RecursiveProc} :
      left = right →
      HomRealizes left process →
      HomRealizes right process

/-! ## Total operational realization of presented wire identities -/

/-- Every positional object is equal to the canonical object on its ports. -/
theorem ofPorts_ports_eq (object : Object) :
    ofPorts object.ports = object := by
  cases object with
  | mk ports boundary boundarySpec =>
      dsimp [ofPorts] at boundarySpec ⊢
      subst boundary
      rfl

/-- Deterministic, position-disjoint nominal names for one wire. -/
def identitySourceName (offset : Nat) (port : PortType) : Name :=
  endpointName port.payload (3 * offset)

def identityTargetName (offset : Nat) (port : PortType) : Name :=
  endpointName port.payload (3 * offset + 1)

def identityBinderName (offset : Nat) (port : PortType) : Name :=
  valueName port.payload (3 * offset + 2)

/-- The canonical positional realization allocates three disjoint names. -/
theorem canonicalWireNamesFresh
    (offset : Nat) (port : PortType) :
    WireNamesFresh
      (identitySourceName offset port)
      (identityTargetName offset port)
      (identityBinderName offset port) := by
  rcases port with ⟨payload, polarity⟩
  cases payload with
  | data =>
      change
        4 * (3 * offset) ≠ 4 * (3 * offset + 1) ∧
          4 * (3 * offset) ≠ 4 * (3 * offset + 2) + 1 ∧
          4 * (3 * offset + 1) ≠ 4 * (3 * offset + 2) + 1
      omega
  | channel =>
      change
        4 * (3 * offset) + 2 ≠ 4 * (3 * offset + 1) + 2 ∧
          4 * (3 * offset) + 2 ≠ 4 * (3 * offset + 2) ∧
          4 * (3 * offset + 1) + 2 ≠ 4 * (3 * offset + 2)
      omega

/-- The three names allocated to one canonical wire position. -/
def identityWireNames
    (offset : Nat) (port : PortType) : Finset Name :=
  {identitySourceName offset port,
    identityTargetName offset port,
    identityBinderName offset port}

/-- All canonical names allocated by a suffix of positional wires. -/
def identityAllocatedNamesFrom : Nat → List PortType → Finset Name
  | _, [] => ∅
  | offset, port :: ports =>
      identityWireNames offset port ∪
        identityAllocatedNamesFrom (offset + 1) ports

theorem identityWireNames_bounds
    {offset : Nat} {port : PortType} {name : Name}
    (member : name ∈ identityWireNames offset port) :
    12 * offset ≤ name ∧ name < 12 * (offset + 1) := by
  rcases port with ⟨payload, polarity⟩
  cases payload with
  | data =>
      simp only [identityWireNames, Finset.mem_insert,
        Finset.mem_singleton] at member
      rcases member with equality | equality | equality
      · subst name
        change
          12 * offset ≤ 4 * (3 * offset) ∧
            4 * (3 * offset) < 12 * (offset + 1)
        omega
      · subst name
        change
          12 * offset ≤ 4 * (3 * offset + 1) ∧
            4 * (3 * offset + 1) < 12 * (offset + 1)
        omega
      · subst name
        change
          12 * offset ≤ 4 * (3 * offset + 2) + 1 ∧
            4 * (3 * offset + 2) + 1 < 12 * (offset + 1)
        omega
  | channel =>
      simp only [identityWireNames, Finset.mem_insert,
        Finset.mem_singleton] at member
      rcases member with equality | equality | equality
      · subst name
        change
          12 * offset ≤ 4 * (3 * offset) + 2 ∧
            4 * (3 * offset) + 2 < 12 * (offset + 1)
        omega
      · subst name
        change
          12 * offset ≤ 4 * (3 * offset + 1) + 2 ∧
            4 * (3 * offset + 1) + 2 < 12 * (offset + 1)
        omega
      · subst name
        change
          12 * offset ≤ 4 * (3 * offset + 2) ∧
            4 * (3 * offset + 2) < 12 * (offset + 1)
        omega

theorem identityAllocatedNamesFrom_lower
    {offset : Nat} {ports : List PortType} {name : Name}
    (member : name ∈ identityAllocatedNamesFrom offset ports) :
    12 * offset ≤ name := by
  induction ports generalizing offset with
  | nil =>
      simp [identityAllocatedNamesFrom] at member
  | cons port ports induction =>
      simp only [identityAllocatedNamesFrom, Finset.mem_union] at member
      rcases member with head | tail
      · exact (identityWireNames_bounds head).1
      · have lower := induction tail
        omega

/--
Different positional wires use disjoint nominal blocks.  Thus the total
identity realization is fresh not only inside each singleton protocol but
also across the tensor of all boundary positions.
-/
theorem identityWireNames_disjoint_tail
    (offset : Nat) (port : PortType) (ports : List PortType) :
    Disjoint
      (identityWireNames offset port)
      (identityAllocatedNamesFrom (offset + 1) ports) := by
  rw [Finset.disjoint_left]
  intro name head tail
  have upper : name < 12 * (offset + 1) :=
    (identityWireNames_bounds
      (offset := offset) (port := port) head).2
  have lower : 12 * (offset + 1) ≤ name :=
    identityAllocatedNamesFrom_lower
      (offset := offset + 1) (ports := ports) tail
  exact (Nat.not_lt_of_ge lower) upper

/-- Parallel bundle of the genuine two-phase singleton wire protocols. -/
def identityProcessFrom : Nat → List PortType → RecursiveProc
  | _, [] => .zero
  | offset, port :: ports =>
      .par
        (wire port
          (identitySourceName offset port)
          (identityTargetName offset port)
          (identityBinderName offset port))
        (identityProcessFrom (offset + 1) ports)

/--
Every presented identity has an operational realization.  Empty boundaries
use inactive syntax; nonempty boundaries are tensors of the genuine
two-phase singleton protocols.  This is a realization relation, not a claim
that the raw bundle is a structural identity.
-/
def identityRealizesList :
    (offset : Nat) → (ports : List PortType) →
      HomRealizes
        (identity (ofPorts ports))
        (identityProcessFrom offset ports)
  | _, [] => HomRealizes.emptyIdentity
  | offset, port :: ports => by
      have parallelRealizes :
          HomRealizes
            (parallel
              (identity (ofPorts [port]))
              (identity (ofPorts ports)))
            (.par
              (wire port
                (identitySourceName offset port)
                (identityTargetName offset port)
                (identityBinderName offset port))
              (identityProcessFrom (offset + 1) ports)) :=
        HomRealizes.parallel
          (HomRealizes.singletonIdentity port
            (identitySourceName offset port)
            (identityTargetName offset port)
            (identityBinderName offset port)
            (canonicalWireNamesFresh offset port))
          (identityRealizesList (offset + 1) ports)
      have identityEquality :
          parallel
              (identity (ofPorts [port]))
              (identity (ofPorts ports)) =
            identity (ofPorts (port :: ports)) := by
        calc
          parallel
                (identity (ofPorts [port]))
                (identity (ofPorts ports)) =
              identity
                (tensorObject (ofPorts [port]) (ofPorts ports)) :=
            parallel_identity (ofPorts [port]) (ofPorts ports)
          _ = identity (ofPorts (port :: ports)) := by
            congr 1
      exact HomRealizes.transport identityEquality parallelRealizes

/-- Total identity realization for every typed, polarised positional object. -/
def identityRealizes (object : Object) :
    Σ process : RecursiveProc,
      HomRealizes (identity object) process := by
  rw [← ofPorts_ports_eq object]
  exact
    ⟨identityProcessFrom 0 object.ports,
      identityRealizesList 0 object.ports⟩

/-- The total identity realization is nonempty without choosing raw equality. -/
theorem every_identity_has_operational_realization
    (object : Object) :
    Nonempty
      (Σ process : RecursiveProc,
        HomRealizes (identity object) process) :=
  ⟨identityRealizes object⟩

/--
A genuine strong representative whose source realizes one particular
presented morphism.
-/
structure StrongHomRealization
    {source target : Object} (hom : Hom source target) where
  representative : StrongRepresentative
  sourceRealizes : HomRealizes hom representative.source

namespace StrongHomRealization

/-- Every strong Hom realization has concrete representative-level D1-A data. -/
theorem fmsCommutation
    {source target : Object} {hom : Hom source target}
    (realization : StrongHomRealization hom) :
    RepresentativeTraceCommutation realization.representative :=
  representativeTraceCommutation realization.representative

/-- Tensor/parallel preserves a left native realization. -/
def tensorLeft
    {leftIn leftOut rightIn rightOut : Object}
    {leftHom : Hom leftIn leftOut}
    {rightHom : Hom rightIn rightOut}
    {rightProcess : RecursiveProc}
    (left : StrongHomRealization leftHom)
    (right : HomRealizes rightHom rightProcess)
    (fresh :
      Disjoint left.representative.action.boundNames
        rightProcess.freeNames) :
    StrongHomRealization (parallel leftHom rightHom) where
  representative := left.representative.tensorLeft rightProcess fresh
  sourceRealizes :=
    HomRealizes.parallel left.sourceRealizes right

/-- Mirror tensor propagation. -/
def tensorRight
    {leftIn leftOut rightIn rightOut : Object}
    {leftHom : Hom leftIn leftOut}
    {rightHom : Hom rightIn rightOut}
    {leftProcess : RecursiveProc}
    (left : HomRealizes leftHom leftProcess)
    (right : StrongHomRealization rightHom)
    (fresh :
      Disjoint right.representative.action.boundNames
        leftProcess.freeNames) :
    StrongHomRealization (parallel leftHom rightHom) where
  representative := right.representative.tensorRight leftProcess fresh
  sourceRealizes :=
    HomRealizes.parallel left right.sourceRealizes

end StrongHomRealization

/-! ## The honest two-phase identity bridge -/

/--
Operational protocol associated with one singleton presented identity.

Only the input-phase source realizes the presented identity.  The output
phase is explicitly the derivative of that input, not a second claim that the
derivative is a structural identity.
-/
structure WireIdentityProtocol
    (port : PortType) (sourceName targetName binder : Name) where
  namesFresh : WireNamesFresh sourceName targetName binder
  input :
    StrongHomRealization (identity (ofPorts [port]))
  inputExact :
    input.representative =
      wireInputRepresentative port sourceName targetName binder
  output : StrongRepresentative
  outputExact :
    output =
      wireOutputRepresentative port sourceName targetName binder
  connected :
    input.representative.target = output.source
  labelsDistinct :
    input.representative.action ≠ output.action

/-- Actual singleton identity protocol. -/
def wireIdentityProtocol
    (port : PortType) (sourceName targetName binder : Name)
    (fresh : WireNamesFresh sourceName targetName binder) :
    WireIdentityProtocol port sourceName targetName binder where
  namesFresh := fresh
  input :=
    { representative :=
        wireInputRepresentative port sourceName targetName binder
      sourceRealizes :=
        HomRealizes.singletonIdentity
          port sourceName targetName binder fresh }
  inputExact := rfl
  output :=
    wireOutputRepresentative port sourceName targetName binder
  outputExact := rfl
  connected :=
    wire_derivative_is_output_source
      port sourceName targetName binder
  labelsDistinct :=
    wire_labels_distinct port sourceName targetName binder

/-- Both phases are genuine native steps and share the derivative exactly. -/
theorem wire_identity_two_native_steps
    (port : PortType) (sourceName targetName binder : Name)
    (fresh : WireNamesFresh sourceName targetName binder) :
    let protocol :=
      wireIdentityProtocol port sourceName targetName binder fresh
    RecursiveLate.NativeStep
        protocol.input.representative.source
        protocol.input.representative.action
        protocol.input.representative.target ∧
      RecursiveLate.NativeStep
        protocol.output.source
        protocol.output.action
        protocol.output.target ∧
      protocol.input.representative.target = protocol.output.source ∧
      protocol.input.representative.action ≠ protocol.output.action := by
  dsimp [wireIdentityProtocol]
  exact
    ⟨(wireInputRepresentative port sourceName targetName binder).native,
      (wireOutputRepresentative port sourceName targetName binder).native,
      wire_derivative_is_output_source port sourceName targetName binder,
      wire_labels_distinct port sourceName targetName binder⟩

/-! ## Actual plug/composition bridge -/

/-- Left-output/right-input composition is one native plug/hide step. -/
def composeSyncLeft
    {source middle target : Object}
    {leftHom : Hom source middle}
    {rightHom : Hom middle target}
    {left right left' right' : RecursiveProc}
    (leftRealizes : HomRealizes leftHom left)
    (rightRealizes : HomRealizes rightHom right)
    (middleNames : Realization middle)
    (position : Position middle)
    (outputStep :
      RecursiveLate.NativeStep left
        (.output (middleNames.nameAt position) value) left')
    (inputStep :
      RecursiveLate.NativeStep right
        (.input (middleNames.nameAt position) binder) right')
    (binderFresh : binder ∉ left'.freeNames) :
    StrongHomRealization (comp leftHom rightHom) where
  representative :=
    plugLeftRepresentative middleNames position
      outputStep inputStep binderFresh
  sourceRealizes :=
    HomRealizes.plug middleNames leftRealizes rightRealizes

/-- Mirror input/output composition bridge. -/
def composeSyncRight
    {source middle target : Object}
    {leftHom : Hom source middle}
    {rightHom : Hom middle target}
    {left right left' right' : RecursiveProc}
    (leftRealizes : HomRealizes leftHom left)
    (rightRealizes : HomRealizes rightHom right)
    (middleNames : Realization middle)
    (position : Position middle)
    (inputStep :
      RecursiveLate.NativeStep left
        (.input (middleNames.nameAt position) binder) left')
    (outputStep :
      RecursiveLate.NativeStep right
        (.output (middleNames.nameAt position) value) right')
    (binderFresh : binder ∉ right'.freeNames) :
    StrongHomRealization (comp leftHom rightHom) where
  representative :=
    plugRightRepresentative middleNames position
      inputStep outputStep binderFresh
  sourceRealizes :=
    HomRealizes.plug middleNames leftRealizes rightRealizes

/-! ## Hiding/restriction keeps the Hom bridge explicit -/

/--
Hiding transforms a strong representative by native restriction while
retaining the presented Hom realization of its unhidden source.
-/
structure HiddenStrongHomRealization
    {source target : Object} (hom : Hom source target) where
  base : StrongHomRealization hom
  hidden : List Name
  hiddenRepresentative : StrongRepresentative
  sourceExact :
    hiddenRepresentative.source =
      hideNames hidden base.representative.source
  targetExact :
    hiddenRepresentative.target =
      hideNames hidden base.representative.target

/-- Finite hiding through the native restriction rule. -/
def hide
    {source target : Object} {hom : Hom source target}
    (base : StrongHomRealization hom)
    (hidden : List Name)
    (fresh :
      ∀ binder, binder ∈ hidden →
        binder ∉ base.representative.action.names) :
    HiddenStrongHomRealization hom where
  base := base
  hidden := hidden
  hiddenRepresentative :=
    base.representative.hide hidden fresh
  sourceExact := rfl
  targetExact := rfl

/-- One-name restriction is the singleton hiding construction. -/
def restriction
    {source target : Object} {hom : Hom source target}
    (base : StrongHomRealization hom)
    (hidden : Name)
    (fresh : hidden ∉ base.representative.action.names) :
    HiddenStrongHomRealization hom :=
  hide base [hidden] (by
    intro binder member
    simp only [List.mem_singleton] at member
    subst binder
    exact fresh)

/-- Hidden representatives retain concrete D1-A trace compatibility. -/
theorem HiddenStrongHomRealization.fmsCommutation
    {source target : Object} {hom : Hom source target}
    (hidden : HiddenStrongHomRealization hom) :
    RepresentativeTraceCommutation hidden.hiddenRepresentative :=
  representativeTraceCommutation hidden.hiddenRepresentative

/-! ## Boundary typing -/

/-- Every realized public endpoint has channel sort and its declared payload. -/
theorem realization_type_preserving
    {object : Object} (realization : Realization object)
    (position : Position object) :
    environment.sort (realization.nameAt position) = .channel ∧
      environment.payload (realization.nameAt position) =
        (object.ports.get position).payload :=
  ⟨realization.endpoint_sort position,
    realization.endpoint_payload position⟩

/-! ## A concrete nonempty atom/plug/FMS witness -/

namespace Reference

def port : PortType := ⟨.data, .positive⟩
def object : Object := ofPorts [port]
def endpoint : Name := endpointName .data 0
def value : Name := valueName .data 0
def binder : Name := value
def channel : Channel := ⟨endpoint, .data⟩

def outputProcess : Proc :=
  .send channel value .zero

def inputProcess : Proc :=
  .recv channel binder .zero

theorem outputWellTyped :
    outputProcess.WellTyped environment := by
  exact
    ⟨environment_sort_endpoint .data 0,
      environment_payload_endpoint .data 0,
      environment_sort_value .data 0,
      trivial⟩

theorem inputWellTyped :
    inputProcess.WellTyped environment := by
  exact
    ⟨environment_sort_endpoint .data 0,
      environment_payload_endpoint .data 0,
      environment_sort_value .data 0,
      trivial⟩

def middleNames : Realization object where
  offset := 0

def outputBoundary :
    AtomBoundaryWitness
      (source := object) (target := object) outputProcess where
  sourceNames := middleNames
  targetNames := middleNames
  sourceOccurs := by
    intro position
    fin_cases position
    simp [object, ofPorts, port, outputProcess, channel, endpoint, value,
      middleNames, Realization.nameAt, positionName,
      endpointName, Proc.erase, Raw.Proc.allNames]
  targetOccurs := by
    intro position
    fin_cases position
    simp [object, ofPorts, port, outputProcess, channel, endpoint, value,
      middleNames, Realization.nameAt, positionName,
      endpointName, Proc.erase, Raw.Proc.allNames]

def inputBoundary :
    AtomBoundaryWitness
      (source := object) (target := object) inputProcess where
  sourceNames := middleNames
  targetNames := middleNames
  sourceOccurs := by
    intro position
    fin_cases position
    simp [object, ofPorts, port, inputProcess, channel, endpoint, binder, value,
      middleNames, Realization.nameAt, positionName,
      endpointName, Proc.erase, Raw.Proc.allNames]
  targetOccurs := by
    intro position
    fin_cases position
    simp [object, ofPorts, port, inputProcess, channel, endpoint, binder, value,
      middleNames, Realization.nameAt, positionName,
      endpointName, Proc.erase, Raw.Proc.allNames]

def outputHom : Hom object object :=
  OpenSMC.Hom.atom environment
    object.boundary object.boundary
    outputProcess outputWellTyped

def inputHom : Hom object object :=
  OpenSMC.Hom.atom environment
    object.boundary object.boundary
    inputProcess inputWellTyped

def outputRealizes :
    HomRealizes outputHom
      (RecursiveProc.ofRaw outputProcess.erase) :=
  HomRealizes.atom outputProcess outputWellTyped outputBoundary

def inputRealizes :
    HomRealizes inputHom
      (RecursiveProc.ofRaw inputProcess.erase) :=
  HomRealizes.atom inputProcess inputWellTyped inputBoundary

def middlePosition : Position object :=
  ⟨0, by decide⟩

@[simp]
theorem middle_name :
    middleNames.nameAt middlePosition = endpoint := by
  rfl

theorem outputNative :
    RecursiveLate.NativeStep
      (RecursiveProc.ofRaw outputProcess.erase)
      (.output endpoint value)
      (RecursiveProc.ofRaw .zero) := by
  exact RecursiveLate.ofRaw_native Late.NativeStep.prefixOutput

theorem inputNative :
    RecursiveLate.NativeStep
      (RecursiveProc.ofRaw inputProcess.erase)
      (.input endpoint binder)
      (RecursiveProc.ofRaw .zero) := by
  exact RecursiveLate.ofRaw_native Late.NativeStep.prefixInput

/-- The same typed atoms compose through the same realized middle endpoint. -/
def composite :
    StrongHomRealization (comp outputHom inputHom) := by
  apply
    composeSyncLeft outputRealizes inputRealizes
      middleNames middlePosition outputNative inputNative
  simp [Raw.Proc.freeNames]

/-- Hom-indexed strong/FMS commutation for the substantive plug witness. -/
theorem compositeFMS :
    RepresentativeTraceCommutation composite.representative :=
  composite.fmsCommutation

end Reference

/-- Universal tensor closure of the Hom-indexed strong relation. -/
def TensorLeftClosed : Prop :=
  ∀ {leftIn leftOut rightIn rightOut : Object}
    {leftHom : Hom leftIn leftOut}
    {rightHom : Hom rightIn rightOut}
    {rightProcess : RecursiveProc}
    (left : StrongHomRealization leftHom)
    (right : HomRealizes rightHom rightProcess),
    Disjoint left.representative.action.boundNames
        rightProcess.freeNames →
      Nonempty
        (StrongHomRealization (parallel leftHom rightHom))

/-- The constructed relation is closed under tensor/left native placement. -/
theorem tensorLeftClosed : TensorLeftClosed := by
  intro leftIn leftOut rightIn rightOut
    leftHom rightHom rightProcess left right fresh
  exact ⟨left.tensorLeft right fresh⟩

/-- Universal strong shared-endpoint composition closure. -/
def PlugSyncLeftClosed : Prop :=
  ∀ {source middle target : Object}
    {leftHom : Hom source middle}
    {rightHom : Hom middle target}
    {left right left' right' : RecursiveProc}
    {value binder : Name}
    (leftRealizes : HomRealizes leftHom left)
    (rightRealizes : HomRealizes rightHom right)
    (middleNames : Realization middle)
    (position : Position middle)
    (outputStep :
      RecursiveLate.NativeStep left
        (.output (middleNames.nameAt position) value) left')
    (inputStep :
      RecursiveLate.NativeStep right
        (.input (middleNames.nameAt position) binder) right'),
    binder ∉ left'.freeNames →
      Nonempty (StrongHomRealization (comp leftHom rightHom))

/-- The constructed relation is closed under actual plug/hide synchronisation. -/
theorem plugSyncLeftClosed : PlugSyncLeftClosed := by
  intro source middle target leftHom rightHom
    left right left' right' value binder leftRealizes rightRealizes
    middleNames position outputStep inputStep fresh
  exact
    ⟨composeSyncLeft leftRealizes rightRealizes middleNames position
      outputStep inputStep fresh⟩

/-- Universal finite hiding closure around a Hom-indexed strong step. -/
def HidingClosed : Prop :=
  ∀ {source target : Object} {hom : Hom source target}
    (base : StrongHomRealization hom)
    (hidden : List Name),
    (∀ binder, binder ∈ hidden →
      binder ∉ base.representative.action.names) →
      Nonempty (HiddenStrongHomRealization hom)

/-- The constructed relation is closed under native finite restriction. -/
theorem hidingClosed : HidingClosed := by
  intro source target hom base hidden fresh
  exact ⟨hide base hidden fresh⟩

/--
No-argument acceptance record.  The central field is Hom-indexed: it cannot
be inhabited by placing an unrelated presented morphism next to an unrelated
native step.
-/
structure HomOperationalBridgeAcceptance where
  totalIdentity :
    ∀ object : Object,
      Nonempty
        (Σ process : RecursiveProc,
          HomRealizes (identity object) process)
  singletonWire :
    ∀ (port : PortType) (sourceName targetName binder : Name),
      WireNamesFresh sourceName targetName binder →
      WireIdentityProtocol port sourceName targetName binder
  identityNamesDisjoint :
    ∀ (offset : Nat) (port : PortType) (ports : List PortType),
      Disjoint
        (identityWireNames offset port)
        (identityAllocatedNamesFrom (offset + 1) ports)
  typedBoundary :
    ∀ {object : Object} (realization : Realization object)
      (position : Position object),
      environment.sort (realization.nameAt position) = .channel ∧
        environment.payload (realization.nameAt position) =
          (object.ports.get position).payload
  tensorClosure : TensorLeftClosed
  compositionClosure : PlugSyncLeftClosed
  hidingClosure : HidingClosed
  substantiveComposition :
    StrongHomRealization
      (comp Reference.outputHom Reference.inputHom)
  substantiveFMS :
    RepresentativeTraceCommutation
      substantiveComposition.representative
  rawIdentityNoGo :
    ∀ middle : Name,
      ¬ Nonempty (PositivePrefixRawStructuralIdentity middle)

/-- Actual no-argument Hom/native/FMS bridge. -/
def homOperationalBridgeAcceptance :
    HomOperationalBridgeAcceptance where
  totalIdentity := every_identity_has_operational_realization
  singletonWire := wireIdentityProtocol
  identityNamesDisjoint := identityWireNames_disjoint_tail
  typedBoundary := realization_type_preserving
  tensorClosure := tensorLeftClosed
  compositionClosure := plugSyncLeftClosed
  hidingClosure := hidingClosed
  substantiveComposition := Reference.composite
  substantiveFMS := Reference.compositeFMS
  rawIdentityNoGo := no_positive_prefix_raw_structural_identity

end Cantilune.Pi.OpenSMCPolarisedHomBridge
