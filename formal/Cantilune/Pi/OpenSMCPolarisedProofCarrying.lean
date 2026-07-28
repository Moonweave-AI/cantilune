import Cantilune.Pi.OpenSMCPolarisedHomBridge

/-!
# Proof-carrying typed/polarised Open-pi morphisms

`OpenSMCPolarisedOperational.Hom` is intentionally implemented by the
presented OpenSMC quotient after erasing every public port to a channel
occurrence.  The object indices still contain payload and polarity, but the
quotient value by itself does not.

This module puts that information back into the data carried by a morphism.
`TypedPolarisedHom source target` stores the exact source and target port
profiles together with the presented quotient.  Composition and tensor are
defined on that proof-carrying type, and all category and symmetric-monoidal
equations are proved by the kernel from the corresponding presented
equations.  Native realizations are related only to the `erased` field of the
same proof-carrying morphism.

The construction is deliberately not a bisimulation quotient and it does not
claim that a positive-prefix process is a raw structural identity.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.OpenSMCPolarisedProofCarrying

open Cantilune.Pi
open Cantilune.Pi.OpenSMCPolarisedOperational
open Cantilune.Pi.OpenSMCPolarisedAdequacy
open Cantilune.Pi.OpenSMCPolarisedHomBridge

/--
A presented morphism together with the exact typed and polarised public
profiles at both ends.

The equality proofs make the extra lists canonical.  Keeping the lists as
data (rather than merely relying on an erased `Hom` abbreviation) makes loss
of payload or polarity visible in the type checked interface.
-/
structure TypedPolarisedHom (source target : Object) where
  erased : Hom source target
  sourceProfile : List PortType
  targetProfile : List PortType
  sourceProfileExact : sourceProfile = source.ports
  targetProfileExact : targetProfile = target.ports

namespace TypedPolarisedHom

/-- Canonical proof-carrying lift of a presented morphism. -/
def lift {source target : Object} (hom : Hom source target) :
    TypedPolarisedHom source target where
  erased := hom
  sourceProfile := source.ports
  targetProfile := target.ports
  sourceProfileExact := rfl
  targetProfileExact := rfl

/-- Equality is determined by the presented morphism; profiles are exact. -/
@[ext]
theorem ext
    {source target : Object}
    {left right : TypedPolarisedHom source target}
    (erasedEqual : left.erased = right.erased) :
    left = right := by
  cases left with
  | mk leftErased leftSource leftTarget leftSourceExact leftTargetExact =>
      cases right with
      | mk rightErased rightSource rightTarget rightSourceExact rightTargetExact =>
          subst leftSource
          subst leftTarget
          subst rightSource
          subst rightTarget
          cases erasedEqual
          rfl

@[simp]
theorem lift_erased
    {source target : Object} (hom : Hom source target) :
    (lift hom).erased = hom :=
  rfl

/-- The complete source payload/polarity vector is retained. -/
theorem source_profile_retained
    {source target : Object}
    (hom : TypedPolarisedHom source target) :
    hom.sourceProfile = source.ports :=
  hom.sourceProfileExact

/-- The complete target payload/polarity vector is retained. -/
theorem target_profile_retained
    {source target : Object}
    (hom : TypedPolarisedHom source target) :
    hom.targetProfile = target.ports :=
  hom.targetProfileExact

/-- Proof-carrying identity. -/
def identity (object : Object) : TypedPolarisedHom object object :=
  lift (OpenSMCPolarisedOperational.identity object)

/-- Proof-carrying composition. -/
def compose
    {source middle target : Object}
    (left : TypedPolarisedHom source middle)
    (right : TypedPolarisedHom middle target) :
    TypedPolarisedHom source target :=
  lift (OpenSMCPolarisedOperational.comp left.erased right.erased)

/-- Proof-carrying tensor. -/
def tensor
    {leftIn leftOut rightIn rightOut : Object}
    (left : TypedPolarisedHom leftIn leftOut)
    (right : TypedPolarisedHom rightIn rightOut) :
    TypedPolarisedHom
      (tensorObject leftIn rightIn) (tensorObject leftOut rightOut) :=
  lift (OpenSMCPolarisedOperational.parallel left.erased right.erased)

def associator (a b c : Object) :
    TypedPolarisedHom
      (tensorObject (tensorObject a b) c)
      (tensorObject a (tensorObject b c)) :=
  lift (OpenSMCPolarisedOperational.associator a b c)

def associatorInv (a b c : Object) :
    TypedPolarisedHom
      (tensorObject a (tensorObject b c))
      (tensorObject (tensorObject a b) c) :=
  lift (OpenSMCPolarisedOperational.associatorInv a b c)

def leftUnitor (object : Object) :
    TypedPolarisedHom (tensorObject (ofPorts []) object) object :=
  lift (OpenSMCPolarisedOperational.leftUnitor object)

def leftUnitorInv (object : Object) :
    TypedPolarisedHom object (tensorObject (ofPorts []) object) :=
  lift (OpenSMCPolarisedOperational.leftUnitorInv object)

def rightUnitor (object : Object) :
    TypedPolarisedHom (tensorObject object (ofPorts [])) object :=
  lift (OpenSMCPolarisedOperational.rightUnitor object)

def rightUnitorInv (object : Object) :
    TypedPolarisedHom object (tensorObject object (ofPorts [])) :=
  lift (OpenSMCPolarisedOperational.rightUnitorInv object)

def braid (left right : Object) :
    TypedPolarisedHom
      (tensorObject left right) (tensorObject right left) :=
  lift (OpenSMCPolarisedOperational.braid left right)

@[simp]
theorem identity_comp
    {source target : Object}
    (hom : TypedPolarisedHom source target) :
    compose (identity source) hom = hom := by
  apply ext
  exact OpenSMCPolarisedOperational.comp_identity_left hom.erased

@[simp]
theorem comp_identity
    {source target : Object}
    (hom : TypedPolarisedHom source target) :
    compose hom (identity target) = hom := by
  apply ext
  exact OpenSMCPolarisedOperational.comp_identity_right hom.erased

theorem compose_assoc
    {a b c d : Object}
    (first : TypedPolarisedHom a b)
    (second : TypedPolarisedHom b c)
    (third : TypedPolarisedHom c d) :
    compose (compose first second) third =
      compose first (compose second third) := by
  apply ext
  exact
    OpenSMCPolarisedOperational.comp_assoc
      first.erased second.erased third.erased

@[simp]
theorem tensor_identity (left right : Object) :
    tensor (identity left) (identity right) =
      identity (tensorObject left right) := by
  apply ext
  exact OpenSMCPolarisedOperational.parallel_identity left right

theorem tensor_comp_interchange
    {a b c d e f : Object}
    (left₁ : TypedPolarisedHom a b)
    (left₂ : TypedPolarisedHom b c)
    (right₁ : TypedPolarisedHom d e)
    (right₂ : TypedPolarisedHom e f) :
    compose (tensor left₁ right₁) (tensor left₂ right₂) =
      tensor (compose left₁ left₂) (compose right₁ right₂) := by
  apply ext
  exact
    OpenSMCPolarisedOperational.parallel_comp_interchange
      left₁.erased left₂.erased right₁.erased right₂.erased

/-- Associator and unitors are genuine isomorphisms in the carried layer. -/
theorem structural_isomorphisms (a b c : Object) :
    (compose (associator a b c) (associatorInv a b c) =
      identity (tensorObject (tensorObject a b) c)) ∧
    (compose (associatorInv a b c) (associator a b c) =
      identity (tensorObject a (tensorObject b c))) ∧
    (compose (leftUnitor a) (leftUnitorInv a) =
      identity (tensorObject (ofPorts []) a)) ∧
    (compose (leftUnitorInv a) (leftUnitor a) = identity a) ∧
    (compose (rightUnitor a) (rightUnitorInv a) =
      identity (tensorObject a (ofPorts []))) ∧
    (compose (rightUnitorInv a) (rightUnitor a) = identity a) := by
  constructor
  · apply ext
    exact OpenSMCPolarisedOperational.associator_hom_inv a b c
  constructor
  · apply ext
    exact OpenSMCPolarisedOperational.associator_inv_hom a b c
  constructor
  · apply ext
    exact OpenSMCPolarisedOperational.leftUnitor_hom_inv a
  constructor
  · apply ext
    exact OpenSMCPolarisedOperational.leftUnitor_inv_hom a
  constructor
  · apply ext
    exact OpenSMCPolarisedOperational.rightUnitor_hom_inv a
  · apply ext
    exact OpenSMCPolarisedOperational.rightUnitor_inv_hom a

/-- Associator naturality in the proof-carrying layer. -/
theorem associator_natural
    {a a' b b' c c' : Object}
    (left : TypedPolarisedHom a a')
    (middle : TypedPolarisedHom b b')
    (right : TypedPolarisedHom c c') :
    compose
        (tensor (tensor left middle) right)
        (associator a' b' c') =
      compose
        (associator a b c)
        (tensor left (tensor middle right)) := by
  apply ext
  exact
    OpenSMCPolarisedOperational.associator_natural
      left.erased middle.erased right.erased

/-- Left unitor naturality in the proof-carrying layer. -/
theorem leftUnitor_natural
    {source target : Object}
    (hom : TypedPolarisedHom source target) :
    compose
        (tensor (identity (ofPorts [])) hom)
        (leftUnitor target) =
      compose (leftUnitor source) hom := by
  apply ext
  exact OpenSMCPolarisedOperational.leftUnitor_natural hom.erased

/-- Right unitor naturality in the proof-carrying layer. -/
theorem rightUnitor_natural
    {source target : Object}
    (hom : TypedPolarisedHom source target) :
    compose
        (tensor hom (identity (ofPorts [])))
        (rightUnitor target) =
      compose (rightUnitor source) hom := by
  apply ext
  exact OpenSMCPolarisedOperational.rightUnitor_natural hom.erased

/-- Braiding naturality in the proof-carrying layer. -/
theorem braid_natural
    {a a' b b' : Object}
    (left : TypedPolarisedHom a a')
    (right : TypedPolarisedHom b b') :
    compose (tensor left right) (braid a' b') =
      compose (braid a b) (tensor right left) := by
  apply ext
  exact
    OpenSMCPolarisedOperational.braid_natural
      left.erased right.erased

/-- The carried braiding is symmetric, not merely braided. -/
theorem braid_symmetry (left right : Object) :
    compose (braid left right) (braid right left) =
      identity (tensorObject left right) := by
  apply ext
  exact OpenSMCPolarisedOperational.braid_symmetry left right

/-- Pentagon, triangle, and hexagon in the proof-carrying layer. -/
theorem global_smc_coherent (a b c d : Object) :
    (compose
        (associator (tensorObject a b) c d)
        (associator a b (tensorObject c d)) =
      compose
        (compose
          (tensor (associator a b c) (identity d))
          (associator a (tensorObject b c) d))
        (tensor (identity a) (associator b c d))) ∧
    (tensor (rightUnitor a) (identity b) =
      compose
        (associator a (ofPorts []) b)
        (tensor (identity a) (leftUnitor b))) ∧
    (compose
        (compose
          (associator a b c)
          (braid a (tensorObject b c)))
        (associator b c a) =
      compose
        (compose
          (tensor (braid a b) (identity c))
          (associator b a c))
        (tensor (identity b) (braid a c))) := by
  rcases presented_global_smc_coherent a b c d with
    ⟨pentagon, triangle, hexagon⟩
  constructor
  · apply ext
    exact pentagon
  constructor
  · apply ext
    exact triangle
  · apply ext
    exact hexagon

end TypedPolarisedHom

/-- Native realization is indexed by the exact proof-carrying morphism. -/
abbrev NativeRealizes
    {source target : Object}
    (hom : TypedPolarisedHom source target)
    (process : RecursiveProc) : Type :=
  HomRealizes hom.erased process

/-- Strong native realization of the exact proof-carrying morphism. -/
abbrev StrongNativeRealization
    {source target : Object}
    (hom : TypedPolarisedHom source target) : Type :=
  StrongHomRealization hom.erased

/-- Every proof-carrying identity has its genuine wire realization. -/
theorem identity_has_native_realization (object : Object) :
    Nonempty
      (Σ process : RecursiveProc,
        NativeRealizes (TypedPolarisedHom.identity object) process) :=
  every_identity_has_operational_realization object

/-- Tensor preserves a genuine strong native step on the left. -/
def TypedTensorLeftClosed : Prop :=
  ∀ {leftIn leftOut rightIn rightOut : Object}
    {leftHom : TypedPolarisedHom leftIn leftOut}
    {rightHom : TypedPolarisedHom rightIn rightOut}
    {rightProcess : RecursiveProc}
    (left : StrongNativeRealization leftHom)
    (right : NativeRealizes rightHom rightProcess),
    Disjoint left.representative.action.boundNames
        rightProcess.freeNames →
      Nonempty
        (StrongNativeRealization
          (TypedPolarisedHom.tensor leftHom rightHom))

theorem typed_tensor_left_closed : TypedTensorLeftClosed := by
  intro leftIn leftOut rightIn rightOut
    leftHom rightHom rightProcess left right fresh
  exact ⟨left.tensorLeft right fresh⟩

/-- Shared-boundary plug is a genuine native communication step. -/
def TypedPlugSyncLeftClosed : Prop :=
  ∀ {source middle target : Object}
    {leftHom : TypedPolarisedHom source middle}
    {rightHom : TypedPolarisedHom middle target}
    {left right left' right' : RecursiveProc}
    {value binder : Name}
    (leftRealizes : NativeRealizes leftHom left)
    (rightRealizes : NativeRealizes rightHom right)
    (middleNames : Realization middle)
    (position : Position middle)
    (outputStep :
      RecursiveLate.NativeStep left
        (.output (middleNames.nameAt position) value) left')
    (inputStep :
      RecursiveLate.NativeStep right
        (.input (middleNames.nameAt position) binder) right'),
    binder ∉ left'.freeNames →
      Nonempty
        (StrongNativeRealization
          (TypedPolarisedHom.compose leftHom rightHom))

theorem typed_plug_sync_left_closed : TypedPlugSyncLeftClosed := by
  intro source middle target leftHom rightHom
    left right left' right' value binder leftRealizes rightRealizes
    middleNames position outputStep inputStep fresh
  exact
    ⟨composeSyncLeft leftRealizes rightRealizes middleNames position
      outputStep inputStep fresh⟩

/-- Finite native hiding preserves the exact proof-carrying Hom index. -/
def TypedHidingClosed : Prop :=
  ∀ {source target : Object}
    {hom : TypedPolarisedHom source target}
    (base : StrongNativeRealization hom)
    (hidden : List Name),
    (∀ binder, binder ∈ hidden →
      binder ∉ base.representative.action.names) →
      Nonempty (HiddenStrongHomRealization hom.erased)

theorem typed_hiding_closed : TypedHidingClosed := by
  intro source target hom base hidden fresh
  exact ⟨OpenSMCPolarisedHomBridge.hide base hidden fresh⟩

/-- One-name restriction is separately exposed, not inferred from prose. -/
def TypedRestrictionClosed : Prop :=
  ∀ {source target : Object}
    {hom : TypedPolarisedHom source target}
    (base : StrongNativeRealization hom)
    (hidden : Name),
    hidden ∉ base.representative.action.names →
      Nonempty (HiddenStrongHomRealization hom.erased)

theorem typed_restriction_closed : TypedRestrictionClosed := by
  intro source target hom base hidden fresh
  exact ⟨OpenSMCPolarisedHomBridge.restriction base hidden fresh⟩

/-- Complete proof-carrying SMC and native-operation acceptance boundary. -/
structure ProofCarryingOpenPiAcceptance where
  sourceProfileRetained :
    ∀ {source target : Object}
      (hom : TypedPolarisedHom source target),
      hom.sourceProfile = source.ports
  targetProfileRetained :
    ∀ {source target : Object}
      (hom : TypedPolarisedHom source target),
      hom.targetProfile = target.ports
  identityLeft :
    ∀ {source target : Object}
      (hom : TypedPolarisedHom source target),
      TypedPolarisedHom.compose
        (TypedPolarisedHom.identity source) hom = hom
  identityRight :
    ∀ {source target : Object}
      (hom : TypedPolarisedHom source target),
      TypedPolarisedHom.compose hom
        (TypedPolarisedHom.identity target) = hom
  associative :
    ∀ {a b c d : Object}
      (first : TypedPolarisedHom a b)
      (second : TypedPolarisedHom b c)
      (third : TypedPolarisedHom c d),
      TypedPolarisedHom.compose
          (TypedPolarisedHom.compose first second) third =
        TypedPolarisedHom.compose first
          (TypedPolarisedHom.compose second third)
  tensorIdentity :
    ∀ left right : Object,
      TypedPolarisedHom.tensor
          (TypedPolarisedHom.identity left)
          (TypedPolarisedHom.identity right) =
        TypedPolarisedHom.identity (tensorObject left right)
  tensorInterchange :
    ∀ {a b c d e f : Object}
      (left₁ : TypedPolarisedHom a b)
      (left₂ : TypedPolarisedHom b c)
      (right₁ : TypedPolarisedHom d e)
      (right₂ : TypedPolarisedHom e f),
      TypedPolarisedHom.compose
          (TypedPolarisedHom.tensor left₁ right₁)
          (TypedPolarisedHom.tensor left₂ right₂) =
        TypedPolarisedHom.tensor
          (TypedPolarisedHom.compose left₁ left₂)
          (TypedPolarisedHom.compose right₁ right₂)
  structuralIsomorphisms :
    ∀ a b c : Object,
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.associator a b c)
          (TypedPolarisedHom.associatorInv a b c) =
        TypedPolarisedHom.identity (tensorObject (tensorObject a b) c)) ∧
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.associatorInv a b c)
          (TypedPolarisedHom.associator a b c) =
        TypedPolarisedHom.identity (tensorObject a (tensorObject b c))) ∧
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.leftUnitor a)
          (TypedPolarisedHom.leftUnitorInv a) =
        TypedPolarisedHom.identity (tensorObject (ofPorts []) a)) ∧
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.leftUnitorInv a)
          (TypedPolarisedHom.leftUnitor a) =
        TypedPolarisedHom.identity a) ∧
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.rightUnitor a)
          (TypedPolarisedHom.rightUnitorInv a) =
        TypedPolarisedHom.identity (tensorObject a (ofPorts []))) ∧
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.rightUnitorInv a)
          (TypedPolarisedHom.rightUnitor a) =
        TypedPolarisedHom.identity a)
  associatorNaturality :
    ∀ {a a' b b' c c' : Object}
      (left : TypedPolarisedHom a a')
      (middle : TypedPolarisedHom b b')
      (right : TypedPolarisedHom c c'),
      TypedPolarisedHom.compose
          (TypedPolarisedHom.tensor
            (TypedPolarisedHom.tensor left middle) right)
          (TypedPolarisedHom.associator a' b' c') =
        TypedPolarisedHom.compose
          (TypedPolarisedHom.associator a b c)
          (TypedPolarisedHom.tensor left
            (TypedPolarisedHom.tensor middle right))
  leftUnitorNaturality :
    ∀ {source target : Object}
      (hom : TypedPolarisedHom source target),
      TypedPolarisedHom.compose
          (TypedPolarisedHom.tensor
            (TypedPolarisedHom.identity (ofPorts [])) hom)
          (TypedPolarisedHom.leftUnitor target) =
        TypedPolarisedHom.compose
          (TypedPolarisedHom.leftUnitor source) hom
  rightUnitorNaturality :
    ∀ {source target : Object}
      (hom : TypedPolarisedHom source target),
      TypedPolarisedHom.compose
          (TypedPolarisedHom.tensor hom
            (TypedPolarisedHom.identity (ofPorts [])))
          (TypedPolarisedHom.rightUnitor target) =
        TypedPolarisedHom.compose
          (TypedPolarisedHom.rightUnitor source) hom
  braidNaturality :
    ∀ {a a' b b' : Object}
      (left : TypedPolarisedHom a a')
      (right : TypedPolarisedHom b b'),
      TypedPolarisedHom.compose
          (TypedPolarisedHom.tensor left right)
          (TypedPolarisedHom.braid a' b') =
        TypedPolarisedHom.compose
          (TypedPolarisedHom.braid a b)
          (TypedPolarisedHom.tensor right left)
  symmetry :
    ∀ left right : Object,
      TypedPolarisedHom.compose
          (TypedPolarisedHom.braid left right)
          (TypedPolarisedHom.braid right left) =
        TypedPolarisedHom.identity (tensorObject left right)
  globalCoherence :
    ∀ a b c d : Object,
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.associator (tensorObject a b) c d)
          (TypedPolarisedHom.associator a b (tensorObject c d)) =
        TypedPolarisedHom.compose
          (TypedPolarisedHom.compose
            (TypedPolarisedHom.tensor
              (TypedPolarisedHom.associator a b c)
              (TypedPolarisedHom.identity d))
            (TypedPolarisedHom.associator a (tensorObject b c) d))
          (TypedPolarisedHom.tensor
            (TypedPolarisedHom.identity a)
            (TypedPolarisedHom.associator b c d))) ∧
      (TypedPolarisedHom.tensor
          (TypedPolarisedHom.rightUnitor a)
          (TypedPolarisedHom.identity b) =
        TypedPolarisedHom.compose
          (TypedPolarisedHom.associator a (ofPorts []) b)
          (TypedPolarisedHom.tensor
            (TypedPolarisedHom.identity a)
            (TypedPolarisedHom.leftUnitor b))) ∧
      (TypedPolarisedHom.compose
          (TypedPolarisedHom.compose
            (TypedPolarisedHom.associator a b c)
            (TypedPolarisedHom.braid a (tensorObject b c)))
          (TypedPolarisedHom.associator b c a) =
        TypedPolarisedHom.compose
          (TypedPolarisedHom.compose
            (TypedPolarisedHom.tensor
              (TypedPolarisedHom.braid a b)
              (TypedPolarisedHom.identity c))
            (TypedPolarisedHom.associator b a c))
          (TypedPolarisedHom.tensor
            (TypedPolarisedHom.identity b)
            (TypedPolarisedHom.braid a c)))
  identityNative :
    ∀ object : Object,
      Nonempty
        (Σ process : RecursiveProc,
          NativeRealizes (TypedPolarisedHom.identity object) process)
  tensorNative : TypedTensorLeftClosed
  plugNative : TypedPlugSyncLeftClosed
  hideNative : TypedHidingClosed
  restrictionNative : TypedRestrictionClosed
  substantivePlug :
    StrongNativeRealization
      (TypedPolarisedHom.compose
        (TypedPolarisedHom.lift Reference.outputHom)
        (TypedPolarisedHom.lift Reference.inputHom))

/-- No-argument kernel construction of the complete proof-carrying boundary. -/
def proofCarryingOpenPiAcceptance : ProofCarryingOpenPiAcceptance where
  sourceProfileRetained := TypedPolarisedHom.source_profile_retained
  targetProfileRetained := TypedPolarisedHom.target_profile_retained
  identityLeft := TypedPolarisedHom.identity_comp
  identityRight := TypedPolarisedHom.comp_identity
  associative := TypedPolarisedHom.compose_assoc
  tensorIdentity := TypedPolarisedHom.tensor_identity
  tensorInterchange := TypedPolarisedHom.tensor_comp_interchange
  structuralIsomorphisms := TypedPolarisedHom.structural_isomorphisms
  associatorNaturality := TypedPolarisedHom.associator_natural
  leftUnitorNaturality := TypedPolarisedHom.leftUnitor_natural
  rightUnitorNaturality := TypedPolarisedHom.rightUnitor_natural
  braidNaturality := TypedPolarisedHom.braid_natural
  symmetry := TypedPolarisedHom.braid_symmetry
  globalCoherence := TypedPolarisedHom.global_smc_coherent
  identityNative := identity_has_native_realization
  tensorNative := typed_tensor_left_closed
  plugNative := typed_plug_sync_left_closed
  hideNative := typed_hiding_closed
  restrictionNative := typed_restriction_closed
  substantivePlug := Reference.composite

end Cantilune.Pi.OpenSMCPolarisedProofCarrying
