import Cantilune.Core.PositionalDPOI
import Mathlib.CategoryTheory.Limits.FunctorCategory.EpiMono
import Mathlib.CategoryTheory.Limits.Types.Pushouts

/-!
# Explicit pushout complements for typed incidence presheaves

The construction in this file does not obtain complement existence from
adhesivity.  It first proves the set-level deletion construction for an
injective match and then lifts it pointwise to a presheaf, provided the
retained carriers are closed under every incidence map.  That closure
condition is the categorical form of the dangling/gluing condition.
-/

namespace Cantilune.Core.PresheafComplementDPO

open CategoryTheory
open CategoryTheory.Limits

universe u

namespace TypeComplement

variable {K L G : Type u}

/--
Elements of the host deleted by a rule occurrence: they are in the image of
the match but their unique preimage is not in the image of the interface.
-/
def Deleted (left : K → L) (matching : L → G) (x : G) : Prop :=
  ∃ y : L, matching y = x ∧ ∀ k : K, left k ≠ y

abbrev Carrier (left : K → L) (matching : L → G) :=
  {x : G // ¬ Deleted left matching x}

def interface (left : K → L) (matching : L → G)
    (matching_injective : Function.Injective matching) :
    K → Carrier left matching :=
  fun k =>
    ⟨matching (left k), by
      intro h
      rcases h with ⟨y, hy, hno⟩
      have hyl : y = left k :=
        matching_injective (hy.trans rfl)
      exact hno k hyl.symm⟩

def inclusion (left : K → L) (matching : L → G) :
    Carrier left matching → G :=
  Subtype.val

/--
For an injective occurrence, deleting precisely `m(L \ l(K))` gives a
pushout square in `Type`.
-/
theorem isPushout (left : K → L) (matching : L → G)
    (matching_injective : Function.Injective matching) :
    IsPushout
      (TypeCat.ofHom left)
      (TypeCat.ofHom (interface left matching matching_injective))
      (TypeCat.ofHom matching)
      (TypeCat.ofHom (inclusion left matching)) := by
  classical
  let desc :
      (s : PushoutCocone
        (TypeCat.ofHom left)
        (TypeCat.ofHom (interface left matching matching_injective))) →
        G ⟶ s.pt :=
    fun s => TypeCat.ofHom fun x =>
      if hx : ∃ y : L, matching y = x then
        s.inl (Classical.choose hx)
      else
        s.inr
          ⟨x, by
            intro hdel
            exact hx ⟨hdel.choose, hdel.choose_spec.1⟩⟩
  refine IsPushout.of_isColimit
    (PushoutCocone.IsColimit.mk
      (by ext k; rfl)
      desc ?_ ?_ ?_)
  · intro s
    ext y
    change
      (if hx : ∃ z : L, matching z = matching y then
        s.inl (Classical.choose hx)
      else
        s.inr
          ⟨matching y, by
            intro hdel
            exact hx ⟨hdel.choose, hdel.choose_spec.1⟩⟩) =
        s.inl y
    rw [dif_pos ⟨y, rfl⟩]
    congr 1
    exact
      matching_injective
        (Classical.choose_spec (show ∃ z : L, matching z = matching y from
          ⟨y, rfl⟩))
  · intro s
    ext x
    change
      (if hx : ∃ y : L, matching y = x.1 then
        s.inl (Classical.choose hx)
      else
        s.inr
          ⟨x.1, by
            intro hdel
            exact hx ⟨hdel.choose, hdel.choose_spec.1⟩⟩) =
        s.inr x
    by_cases hx : ∃ y : L, matching y = x.1
    · rw [dif_pos hx]
      let y := Classical.choose hx
      have hy : matching y = x.1 := Classical.choose_spec hx
      have hk : ∃ k : K, left k = y := by
        by_contra hnone
        apply x.2
        refine ⟨y, hy, ?_⟩
        intro k hky
        exact hnone ⟨k, hky⟩
      let k := Classical.choose hk
      have hky : left k = y := Classical.choose_spec hk
      have hcondition :=
        ConcreteCategory.congr_hom s.condition k
      change
        s.inl (left k) =
          s.inr (interface left matching matching_injective k)
        at hcondition
      have hsub :
          interface left matching matching_injective k = x := by
        apply Subtype.ext
        exact (congrArg matching hky).trans hy
      calc
        s.inl y = s.inl (left k) := by rw [hky]
        _ = s.inr (interface left matching matching_injective k) := by
          exact hcondition
        _ = s.inr x := by rw [hsub]
    · rw [dif_neg hx]
  · intro s m hmL hmD
    ext x
    change
      m x =
        if hx : ∃ y : L, matching y = x then
          s.inl (Classical.choose hx)
        else
          s.inr
            ⟨x, by
              intro hdel
              exact hx ⟨hdel.choose, hdel.choose_spec.1⟩⟩
    by_cases hx : ∃ y : L, matching y = x
    · rw [dif_pos hx]
      have hpoint :=
        ConcreteCategory.congr_hom hmL (Classical.choose hx)
      change
        m (matching (Classical.choose hx)) =
          s.inl (Classical.choose hx)
        at hpoint
      rw [Classical.choose_spec hx] at hpoint
      exact hpoint
    · rw [dif_neg hx]
      have hretained : ¬ Deleted left matching x := by
        intro hdel
        exact hx ⟨hdel.choose, hdel.choose_spec.1⟩
      have hpoint :=
        ConcreteCategory.congr_hom hmD
          (⟨x, hretained⟩ : Carrier left matching)
      change m x = s.inr (⟨x, hretained⟩ : Carrier left matching)
        at hpoint
      exact hpoint

end TypeComplement

namespace Presheaf

open Cantilune.Core.AdhesiveDPOI

variable
  {T : HypergraphPresheaf
    Cantilune.Core.FinitePresheafDPOI.IncidenceShape}
  {rule : Rule T}
  {host : TypedHypergraph T}
  {matching : Match rule host}

abbrev Component (A : TypedHypergraph T)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :=
  A.left.obj X

/-- Componentwise form of the deleted image `m(L \ l(K))`. -/
def Deleted
    (rule : Rule T) {host : TypedHypergraph T}
    (matching : Match rule host)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ)
    (x : Component host X) : Prop :=
  TypeComplement.Deleted
    (rule.leftLeg.left.app X)
    (matching.arrow.left.app X)
    x

/--
The gluing condition for an injective presheaf occurrence.

Since both rule leg and match are monic, the identification condition is
automatic.  The remaining obligation is closure of retained elements under
every presheaf structure map; for the incidence shape this is exactly the
dangling condition.
-/
def Gluing (rule : Rule T) {host : TypedHypergraph T}
    (matching : Match rule host) : Prop :=
  ∀ {X Y :
      Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ}
    (f : X ⟶ Y)
    (x : Component host X),
      ¬ Deleted rule matching X x →
        ¬ Deleted rule matching Y
          (host.left.map f x)

abbrev LegalMatch (rule : Rule T) {host : TypedHypergraph T}
    (matching : Match rule host) :=
  Gluing rule matching

private theorem component_injective_of_mono
    {A B : TypedHypergraph T} (f : A ⟶ B) [Mono f]
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.Injective (f.left.app X) := by
  haveI : Mono f.left := Over.mono_left_of_mono f
  have hmonoApp :
      Mono (f.left.app X) :=
    (NatTrans.mono_iff_mono_app'
      (C := Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ)
      (D := Type) f.left).mp (by infer_instance) X
  exact (mono_iff_injective _).mp hmonoApp

theorem matching_component_injective
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.Injective (matching.arrow.left.app X) := by
  letI : Mono matching.arrow := matching.mono
  exact component_injective_of_mono matching.arrow X

theorem left_component_injective
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.Injective (rule.leftLeg.left.app X) := by
  letI : Mono rule.leftLeg := rule.left_mono
  exact component_injective_of_mono rule.leftLeg X

/-- Pointwise retained carrier of the canonical complement. -/
abbrev ComplementCarrier
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :=
  TypeComplement.Carrier
    (rule.leftLeg.left.app X)
    (matching.arrow.left.app X)

/-- The retained carriers form a presheaf exactly when gluing holds. -/
def complementPresheaf (legal : LegalMatch rule matching) :
    Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ ⥤ Type where
  obj X := ComplementCarrier (rule := rule) (matching := matching) X
  map {X Y} f :=
    TypeCat.ofHom fun x =>
      ⟨host.left.map f x.1, legal f x.1 x.2⟩
  map_id X := by
    ext x
    simp
  map_comp f g := by
    ext x
    simp

def complementTyping (legal : LegalMatch rule matching) :
    complementPresheaf legal ⟶ T where
  app X :=
    TypeCat.ofHom fun x => host.hom.app X x.1
  naturality := by
    intro X Y f
    ext x
    exact ConcreteCategory.congr_hom (host.hom.naturality f) x.1

/-- Canonical typed presheaf complement. -/
def complement (legal : LegalMatch rule matching) : TypedHypergraph T :=
  Over.mk (complementTyping legal)

def inclusionNatural (legal : LegalMatch rule matching) :
    (complement legal).left ⟶ host.left where
  app X := TypeCat.ofHom Subtype.val
  naturality := by
    intro X Y f
    ext x
    rfl

/-- Inclusion of the retained complement into the host. -/
def complementToHost (legal : LegalMatch rule matching) :
    complement legal ⟶ host :=
  Over.homMk (inclusionNatural legal) (by rfl)

def interfaceNatural (legal : LegalMatch rule matching) :
    rule.interface.left ⟶ (complement legal).left where
  app X :=
    TypeCat.ofHom
      (TypeComplement.interface
        (rule.leftLeg.left.app X)
        (matching.arrow.left.app X)
        (matching_component_injective X))
  naturality := by
    intro X Y f
    ext k
    apply Subtype.ext
    change
      matching.arrow.left.app Y
          (rule.leftLeg.left.app Y
            (rule.interface.left.map f k)) =
        host.left.map f
          (matching.arrow.left.app X
            (rule.leftLeg.left.app X k))
    calc
      matching.arrow.left.app Y
            (rule.leftLeg.left.app Y
              (rule.interface.left.map f k)) =
          matching.arrow.left.app Y
            (rule.left.left.map f
              (rule.leftLeg.left.app X k)) := by
            congr 1
            exact
              ConcreteCategory.congr_hom
                (rule.leftLeg.left.naturality f) k
      _ =
          host.left.map f
            (matching.arrow.left.app X
              (rule.leftLeg.left.app X k)) := by
            exact
              ConcreteCategory.congr_hom
                (matching.arrow.left.naturality f)
                (rule.leftLeg.left.app X k)

/-- The interface map into the retained complement. -/
def interfaceToComplement (legal : LegalMatch rule matching) :
    rule.interface ⟶ complement legal :=
  Over.homMk (interfaceNatural legal) (by
    ext X k
    have hLeftApp :=
      congrArg (fun η => η.app X) (Over.w rule.leftLeg)
    have hLeft :=
      ConcreteCategory.congr_hom hLeftApp k
    have hMatchApp :=
      congrArg (fun η => η.app X) (Over.w matching.arrow)
    have hMatch :=
      ConcreteCategory.congr_hom hMatchApp
        (rule.leftLeg.left.app X k)
    change
      host.hom.app X
          (matching.arrow.left.app X
            (rule.leftLeg.left.app X k)) =
        rule.interface.hom.app X k
    exact hMatch.trans hLeft)

/-- The canonical complement square is a pushout pointwise. -/
theorem presheaf_isPushout (legal : LegalMatch rule matching) :
    IsPushout
      rule.leftLeg.left
      (interfaceToComplement legal).left
      matching.arrow.left
      (complementToHost legal).left := by
  apply IsPushout.of_forall_isPushout_app
  intro X
  exact
    TypeComplement.isPushout
      (rule.leftLeg.left.app X)
      (matching.arrow.left.app X)
      (matching_component_injective X)

/-- The canonical complement square is a pushout in the typed slice. -/
theorem typed_isPushout (legal : LegalMatch rule matching) :
    IsPushout
      rule.leftLeg
      (interfaceToComplement legal)
      matching.arrow
      (complementToHost legal) := by
  apply IsPushout.of_map_of_faithful (F := Over.forget T)
  exact presheaf_isPushout legal

/--
Every monic match satisfying the explicit gluing condition has a categorical
pushout complement.
-/
noncomputable def pushoutComplement
    (legal : LegalMatch rule matching) :
    DPO.PushoutComplement rule.leftLeg matching.arrow where
  context := complement legal
  interface := interfaceToComplement legal
  inclusion := complementToHost legal
  square := (typed_isPushout legal).w
  isPushout := (typed_isPushout legal).isColimit

theorem complement_exists (legal : LegalMatch rule matching) :
    Nonempty (DPO.PushoutComplement rule.leftLeg matching.arrow) :=
  ⟨pushoutComplement legal⟩

private theorem complement_component_isPushout
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    IsPushout
      (rule.leftLeg.left.app X)
      (c.interface.left.app X)
      (matching.arrow.left.app X)
      (c.inclusion.left.app X) := by
  have hSlice :
      IsPushout rule.leftLeg c.interface matching.arrow c.inclusion :=
    IsPushout.of_isColimit c.isPushout
  have hPresheaf :
      IsPushout rule.leftLeg.left c.interface.left
        matching.arrow.left c.inclusion.left := by
    simpa using hSlice.map (Over.forget T)
  exact hPresheaf.app X

/--
Conversely, existence of any categorical pushout complement forces the
retained carriers to be closed under incidence maps.  Thus gluing is
necessary, not merely sufficient.
-/
theorem gluing_of_complement
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow) :
    LegalMatch rule matching := by
  intro X Y f x hxRetained hDeleted
  rcases hDeleted with ⟨yY, hyY, hnoY⟩
  rcases
      Types.eq_or_eq_of_isPushout
        (complement_component_isPushout c X) x with
    ⟨yX, hyX⟩ | ⟨dX, hdX⟩
  · have hkX :
        ∃ kX : Component rule.interface X,
          rule.leftLeg.left.app X kX = yX := by
      by_contra hnone
      apply hxRetained
      refine ⟨yX, hyX, ?_⟩
      intro k hk
      exact hnone ⟨k, hk⟩
    rcases hkX with ⟨kX, hkX⟩
    apply hnoY (rule.interface.left.map f kX)
    apply matching_component_injective Y
    have hLeft :=
      ConcreteCategory.congr_hom
        (rule.leftLeg.left.naturality f) kX
    have hMatching :=
      ConcreteCategory.congr_hom
        (matching.arrow.left.naturality f)
        (rule.leftLeg.left.app X kX)
    calc
      matching.arrow.left.app Y
          (rule.leftLeg.left.app Y
            (rule.interface.left.map f kX)) =
          matching.arrow.left.app Y
            (rule.left.left.map f
              (rule.leftLeg.left.app X kX)) := by
            exact congrArg (matching.arrow.left.app Y) hLeft
      _ =
          host.left.map f
            (matching.arrow.left.app X
              (rule.leftLeg.left.app X kX)) := hMatching
      _ =
          host.left.map f
            (matching.arrow.left.app X yX) := by rw [hkX]
      _ = host.left.map f x := congrArg (host.left.map f) hyX
      _ = matching.arrow.left.app Y yY := hyY.symm
  · have hInclusion :=
      ConcreteCategory.congr_hom
        (c.inclusion.left.naturality f) dX
    have hCross :
        matching.arrow.left.app Y yY =
          c.inclusion.left.app Y (c.context.left.map f dX) := by
      calc
        matching.arrow.left.app Y yY =
            host.left.map f x := hyY
        _ =
            host.left.map f (c.inclusion.left.app X dX) := by rw [hdX]
        _ =
            c.inclusion.left.app Y (c.context.left.map f dX) :=
              hInclusion.symm
    have hIntersection :=
      (Types.pushoutCocone_inl_eq_inr_iff_of_isColimit
        (complement_component_isPushout c Y).isColimit
        (left_component_injective Y)
        yY (c.context.left.map f dX)).mp hCross
    rcases hIntersection with ⟨kY, hkY, _⟩
    exact hnoY kY hkY

/-- Exact existence criterion for a monic typed-presheaf match. -/
theorem complement_exists_iff_gluing :
    Nonempty (DPO.PushoutComplement rule.leftLeg matching.arrow) ↔
      LegalMatch rule matching := by
  constructor
  · rintro ⟨c⟩
    exact gluing_of_complement c
  · exact complement_exists

private theorem context_image_retained
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ)
    (d : Component c.context X) :
    ¬ Deleted rule matching X (c.inclusion.left.app X d) := by
  intro hDeleted
  rcases hDeleted with ⟨y, hy, hno⟩
  have hIntersection :=
    (Types.pushoutCocone_inl_eq_inr_iff_of_isColimit
      (complement_component_isPushout c X).isColimit
      (left_component_injective X)
      y d).mp hy
  rcases hIntersection with ⟨k, hk, _⟩
  exact hno k hk

/-- Canonical map from any complement context into the retained subtype. -/
def contextToCanonicalComponent
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Component c.context X →
      ComplementCarrier (rule := rule) (matching := matching) X :=
  fun d =>
    ⟨c.inclusion.left.app X d, context_image_retained c X d⟩

def contextToCanonicalNatural
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow) :
    c.context.left ⟶
      (complement (gluing_of_complement c)).left where
  app X := TypeCat.ofHom (contextToCanonicalComponent c X)
  naturality := by
    intro X Y f
    ext d
    apply Subtype.ext
    exact
      ConcreteCategory.congr_hom
        (c.inclusion.left.naturality f) d

private theorem contextToCanonicalComponent_injective
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.Injective (contextToCanonicalComponent c X) := by
  intro d₁ d₂ h
  have hval :
      c.inclusion.left.app X d₁ =
        c.inclusion.left.app X d₂ :=
    congrArg Subtype.val h
  exact
    (Types.pushoutCocone_inr_injective_of_isColimit
      (complement_component_isPushout c X).isColimit
      (left_component_injective X)) hval

private theorem contextToCanonicalComponent_surjective
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.Surjective (contextToCanonicalComponent c X) := by
  intro x
  rcases
      Types.eq_or_eq_of_isPushout
        (complement_component_isPushout c X) x.1 with
    ⟨y, hy⟩ | ⟨d, hd⟩
  · have hk :
        ∃ k : Component rule.interface X,
          rule.leftLeg.left.app X k = y := by
      by_contra hnone
      apply x.2
      refine ⟨y, hy, ?_⟩
      intro k hky
      exact hnone ⟨k, hky⟩
    rcases hk with ⟨k, hk⟩
    refine ⟨c.interface.left.app X k, ?_⟩
    apply Subtype.ext
    have hSquareLeft :=
      congrArg (fun q => q.left) c.square
    have hSquareApp :=
      congrArg (fun η => η.app X) hSquareLeft
    have hSquare :=
      ConcreteCategory.congr_hom hSquareApp k
    change
      c.inclusion.left.app X (c.interface.left.app X k) = x.1
    calc
      c.inclusion.left.app X (c.interface.left.app X k) =
          matching.arrow.left.app X
            (rule.leftLeg.left.app X k) := hSquare.symm
      _ = matching.arrow.left.app X y := by rw [hk]
      _ = x.1 := hy
  · refine ⟨d, ?_⟩
    apply Subtype.ext
    exact hd

private theorem contextToCanonicalComponent_bijective
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Function.Bijective (contextToCanonicalComponent c X) :=
  ⟨contextToCanonicalComponent_injective c X,
    contextToCanonicalComponent_surjective c X⟩

noncomputable def contextComponentEquiv
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow)
    (X : Cantilune.Core.FinitePresheafDPOI.IncidenceShapeᵒᵖ) :
    Component c.context X ≃
      ComplementCarrier (rule := rule) (matching := matching) X :=
  Equiv.ofBijective
    (contextToCanonicalComponent c X)
    (contextToCanonicalComponent_bijective c X)

/-- Any complement context is naturally isomorphic to the canonical one. -/
noncomputable def contextPresheafIso
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow) :
    c.context.left ≅
      (complement (gluing_of_complement c)).left :=
  NatIso.ofComponents
    (fun X => (contextComponentEquiv c X).toIso)
    (fun f => contextToCanonicalNatural c |>.naturality f)

/--
Pushout complements are unique up to an isomorphism compatible with their
maps into the fixed host.
-/
noncomputable def complementUniqueIso
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow) :
    c.context ≅ complement (gluing_of_complement c) :=
  Over.isoMk (contextPresheafIso c) (by
    ext X d
    have hApp :=
      congrArg (fun η => η.app X) (Over.w c.inclusion)
    exact ConcreteCategory.congr_hom hApp d)

@[simp]
theorem complementUniqueIso_inclusion
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow) :
    (complementUniqueIso c).hom ≫
        complementToHost (gluing_of_complement c) =
      c.inclusion := by
  ext X d
  rfl

@[simp]
theorem complementUniqueIso_interface
    (c : DPO.PushoutComplement rule.leftLeg matching.arrow) :
    c.interface ≫ (complementUniqueIso c).hom =
      interfaceToComplement (gluing_of_complement c) := by
  ext X k
  apply Subtype.ext
  have hSquareLeft :=
    congrArg (fun q => q.left) c.square
  have hSquareApp :=
    congrArg (fun η => η.app X) hSquareLeft
  exact (ConcreteCategory.congr_hom hSquareApp k).symm

end Presheaf

end Cantilune.Core.PresheafComplementDPO
