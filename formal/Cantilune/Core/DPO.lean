import Mathlib.CategoryTheory.Adhesive.Basic
import Mathlib.Data.Finset.BooleanAlgebra

/-!
# DPO witnesses and an executable finite-support fragment

The categorical part of this file records the two pushout squares of a DPO
derivation using their actual universal properties.  Uniqueness of the result
is then obtained from `IsColimit.uniqueUpToIso`; it is not stored as a field.

Existence and uniqueness of *pushout complements* require the usual adhesive
category and gluing hypotheses and are intentionally not claimed here.  A
`PushoutComplement` is explicit evidence that those obligations have already
been discharged for one match.

The final section gives a small, nonempty executable instance: finite carrier
rewrites by disjoint deletion and insertion.  Its concurrency theorem is
proved from disjoint supports.  It is the set-carrier fragment needed by later
typed hypergraph work, not a replacement for the general adhesive-category
concurrency theorem.
-/

namespace Cantilune.Core

open CategoryTheory CategoryTheory.Limits

universe v u

namespace DPO

/--
Evidence that `context` is a pushout complement for `left` along `matching`.

The square is

```
K --left--> L
|            |
interface    matching
|            |
v            v
D ---------> G .
```

The `IsColimit` field is the universal property of this particular square,
not an assertion that every match admits a complement.
-/
structure PushoutComplement {C : Type u} [Category.{v} C]
    {K L G : C} (left : K ⟶ L) (matching : L ⟶ G) where
  context : C
  interface : K ⟶ context
  inclusion : context ⟶ G
  square : left ≫ matching = interface ≫ inclusion
  isPushout :
    IsColimit (PushoutCocone.mk matching inclusion square)

/--
In an adhesive category, a witnessed pushout complement whose rule leg is
monic is also a pullback square.  This is the precise adhesive fact used here;
complement existence remains a separate gluing-condition obligation.
-/
theorem PushoutComplement.isPullback {C : Type u}
    [Category.{v} C] [Adhesive C]
    {K L G : C} {left : K ⟶ L} {matching : L ⟶ G}
    (c : PushoutComplement left matching) [Mono left] :
    IsPullback left c.interface matching c.inclusion :=
  Adhesive.isPullback_of_isPushout_of_mono_left
    (IsPushout.of_isColimit c.isPushout)

/--
The identity square is a concrete pushout-complement witness in every
category.  Besides being useful for no-op rules, it witnesses that the
categorical interface itself is inhabited without assuming a uniqueness
oracle.
-/
def identityComplement {C : Type u} [Category.{v} C] (X : C) :
    PushoutComplement (𝟙 X) (𝟙 X) where
  context := X
  interface := 𝟙 X
  inclusion := 𝟙 X
  square := by simp
  isPushout :=
    PushoutCocone.IsColimit.mk
      (by simp)
      (fun s => s.inl)
      (fun s => by simp)
      (fun s => by simpa using s.condition)
      (fun _ _ hleft _ => by simpa using hleft)

/--
The second pushout of a DPO derivation for a fixed complement leg and rule
right leg.
-/
structure Result {C : Type u} [Category.{v} C]
    {K D R : C} (interface : K ⟶ D) (right : K ⟶ R) where
  cocone : PushoutCocone interface right
  isPushout : IsColimit cocone

/-- A complete DPO witness: a chosen complement followed by the result pushout. -/
structure Witness {C : Type u} [Category.{v} C]
    {K L R G : C} (left : K ⟶ L) (right : K ⟶ R)
    (matching : L ⟶ G) where
  complement : PushoutComplement left matching
  result : Result complement.interface right

/--
Canonical result witness whenever the relevant categorical pushout exists.

This demonstrates that `Result` is an ordinary universal-property interface,
not a record whose result-uniqueness field assumes the theorem below.
-/
noncomputable def canonicalResult {C : Type u} [Category.{v} C]
    {K D R : C} (interface : K ⟶ D) (right : K ⟶ R)
    [HasPushout interface right] : Result interface right where
  cocone :=
    PushoutCocone.mk
      (pushout.inl interface right)
      (pushout.inr interface right)
      (pushout.condition : _)
  isPushout := pushoutIsPushout interface right

/--
Two categorical DPO results built from the same complement span are uniquely
isomorphic, with the isomorphism induced by the pushout universal properties.
-/
noncomputable def resultUniqueIso {C : Type u} [Category.{v} C]
    {K D R : C} {interface : K ⟶ D} {right : K ⟶ R}
    (x y : Result interface right) :
    x.cocone.pt ≅ y.cocone.pt :=
  IsColimit.coconePointUniqueUpToIso x.isPushout y.isPushout

@[reassoc (attr := simp)]
theorem resultUniqueIso_hom_inl {C : Type u} [Category.{v} C]
    {K D R : C} {interface : K ⟶ D} {right : K ⟶ R}
    (x y : Result interface right) :
    x.cocone.inl ≫ (resultUniqueIso x y).hom = y.cocone.inl := by
  exact
    IsColimit.comp_coconePointUniqueUpToIso_hom
      x.isPushout y.isPushout WalkingSpan.left

@[reassoc (attr := simp)]
theorem resultUniqueIso_hom_inr {C : Type u} [Category.{v} C]
    {K D R : C} {interface : K ⟶ D} {right : K ⟶ R}
    (x y : Result interface right) :
    x.cocone.inr ≫ (resultUniqueIso x y).hom = y.cocone.inr := by
  exact
    IsColimit.comp_coconePointUniqueUpToIso_hom
      x.isPushout y.isPushout WalkingSpan.right

section FiniteSupport

variable {α : Type*} [DecidableEq α]

/--
An executable finite-set DPO fragment.

`erase` and `insert` are internally disjoint, matching the retained/deleted
partition of a valid set-carrier rule.  Typing, dangling, and resource side
conditions belong to the surrounding event package.
-/
structure FiniteSupportEvent (α : Type*) [DecidableEq α] where
  erase : Finset α
  insert : Finset α
  internallyDisjoint : Disjoint erase insert

namespace FiniteSupportEvent

/-- An event is enabled when every requested deletion is present. -/
def Enabled (e : FiniteSupportEvent α) (state : Finset α) : Prop :=
  e.erase ⊆ state

/-- Deterministic carrier update of a finite-support event. -/
def apply (e : FiniteSupportEvent α) (state : Finset α) : Finset α :=
  (state \ e.erase) ∪ e.insert

/--
Structural independence: events neither compete to delete the same carrier
nor insert something deleted by the other event.
-/
structure Independent (e f : FiniteSupportEvent α) : Prop where
  erase_erase : Disjoint e.erase f.erase
  insert_erase : Disjoint e.insert f.erase
  erase_insert : Disjoint e.erase f.insert

theorem enabled_after_left {e f : FiniteSupportEvent α} {state : Finset α}
    (h : Independent e f) (hf : f.Enabled state) :
    f.Enabled (e.apply state) := by
  intro x hx
  have hxState : x ∈ state := hf hx
  have hxNotErased : x ∉ e.erase := by
    exact fun hxErase =>
      Finset.disjoint_left.mp h.erase_erase hxErase hx
  exact Finset.mem_union_left _ (Finset.mem_sdiff.mpr ⟨hxState, hxNotErased⟩)

theorem enabled_after_right {e f : FiniteSupportEvent α} {state : Finset α}
    (h : Independent e f) (he : e.Enabled state) :
    e.Enabled (f.apply state) := by
  intro x hx
  have hxState : x ∈ state := he hx
  have hxNotErased : x ∉ f.erase := by
    exact fun hxErase =>
      Finset.disjoint_left.mp h.erase_erase hx hxErase
  exact Finset.mem_union_left _ (Finset.mem_sdiff.mpr ⟨hxState, hxNotErased⟩)

/-- Disjoint finite-support rewrites have equal residual results. -/
theorem apply_comm_of_independent {e f : FiniteSupportEvent α}
    (h : Independent e f) :
    (fun state => f.apply (e.apply state)) =
      (fun state => e.apply (f.apply state)) := by
  funext state
  ext x
  have hef : x ∈ e.insert → x ∉ f.erase := by
    intro hxInsert hxErase
    exact Finset.disjoint_left.mp h.insert_erase hxInsert hxErase
  have hfe : x ∈ f.insert → x ∉ e.erase := by
    intro hxInsert hxErase
    exact Finset.disjoint_left.mp h.erase_insert hxErase hxInsert
  simp only [apply, Finset.mem_union, Finset.mem_sdiff]
  aesop

/--
Independent enabled events support both residual orders, and the two orders
reach the same carrier state.
-/
theorem concurrency {e f : FiniteSupportEvent α} {state : Finset α}
    (h : Independent e f) (he : e.Enabled state) (hf : f.Enabled state) :
    f.Enabled (e.apply state) ∧
      e.Enabled (f.apply state) ∧
      f.apply (e.apply state) = e.apply (f.apply state) := by
  refine ⟨enabled_after_left h hf, enabled_after_right h he, ?_⟩
  exact congrFun (apply_comm_of_independent h) state

/-- A concrete nonempty event for the executable fragment. -/
def emptyEvent : FiniteSupportEvent α where
  erase := ∅
  insert := ∅
  internallyDisjoint := by simp

end FiniteSupportEvent

end FiniteSupport

end DPO

/-- Central theorem name for categorical uniqueness of the second DPO pushout. -/
noncomputable def dpo_result_unique {C : Type u} [Category.{v} C]
    {K D R : C} {interface : K ⟶ D} {right : K ⟶ R}
    (x y : DPO.Result interface right) :
    x.cocone.pt ≅ y.cocone.pt :=
  DPO.resultUniqueIso x y

/--
Central theorem name for the proved finite-support concurrency fragment.

The theorem includes residual enabledness as well as equality of the two
results.  A later M-adhesive hypergraph theorem must map its independence
conditions into `FiniteSupportEvent.Independent` or replace this fragment with
the fully categorical concurrency theorem.
-/
theorem dpo_concurrency {α : Type*} [DecidableEq α]
    {e f : DPO.FiniteSupportEvent α} {state : Finset α}
    (h : DPO.FiniteSupportEvent.Independent e f)
    (he : DPO.FiniteSupportEvent.Enabled e state)
    (hf : DPO.FiniteSupportEvent.Enabled f state) :
    DPO.FiniteSupportEvent.Enabled f (e.apply state) ∧
      DPO.FiniteSupportEvent.Enabled e (f.apply state) ∧
      f.apply (e.apply state) = e.apply (f.apply state) :=
  DPO.FiniteSupportEvent.concurrency h he hf

end Cantilune.Core
