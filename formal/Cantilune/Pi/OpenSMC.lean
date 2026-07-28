import Mathlib
import Cantilune.Pi.Core

/-!
# A typed presented SMC of open π-process expressions

Raw π syntax is not definitionally a symmetric monoidal category: parallel
composition is a binary constructor and neither its coherence equations nor
plugging identities hold by definitional equality.  This module therefore
keeps the two levels separate.

`Term Γ A B` is a typed, interface-indexed *presentation*.  Atomic terms carry
an actual `Proc.WellTyped Γ` witness.  `plugHide` and `parallel` are distinct
constructors representing sequential boundary plugging/hiding and disjoint
parallel placement.  `Equivalent` is the least congruence containing the
category, tensor, associator, unitor, and symmetry equations.  Its quotient is
the open-process SMC proved below.

This is an algebraic open-process layer.  It does not assert that this
presentation is already equivalent to the complete standard π calculus modulo
α-equivalence and structural congruence; that operational adequacy remains a
separate bridge obligation.
-/

namespace Cantilune.Pi.OpenSMC

open Cantilune.Pi

/-- A typed boundary is an ordered list of channel/data sorts. -/
abbrev Interface := List NameSort

/--
Typed open-process expressions.  The endpoints are the public input and output
boundaries; the intermediate boundary of `plugHide` is hidden by composition.
-/
inductive Term (Γ : TypeEnv) : Interface → Interface → Type
  | identity (boundary : Interface) :
      Term Γ boundary boundary
  | atom (input output : Interface) (process : Proc)
      (typed : process.WellTyped Γ) :
      Term Γ input output
  | plugHide {input middle output : Interface} :
      Term Γ input middle →
      Term Γ middle output →
      Term Γ input output
  | parallel {leftIn leftOut rightIn rightOut : Interface} :
      Term Γ leftIn leftOut →
      Term Γ rightIn rightOut →
      Term Γ (leftIn ++ rightIn) (leftOut ++ rightOut)
  | associator (left middle right : Interface) :
      Term Γ ((left ++ middle) ++ right) (left ++ (middle ++ right))
  | associatorInv (left middle right : Interface) :
      Term Γ (left ++ (middle ++ right)) ((left ++ middle) ++ right)
  | leftUnitor (boundary : Interface) :
      Term Γ ([] ++ boundary) boundary
  | leftUnitorInv (boundary : Interface) :
      Term Γ boundary ([] ++ boundary)
  | rightUnitor (boundary : Interface) :
      Term Γ (boundary ++ []) boundary
  | rightUnitorInv (boundary : Interface) :
      Term Γ boundary (boundary ++ [])
  | braid (left right : Interface) :
      Term Γ (left ++ right) (right ++ left)

namespace Term

/--
The generated equality theory for typed open-process expressions.  There is no
catch-all equation: only congruence and the stated SMC equations are present.
-/
inductive Equivalent {Γ : TypeEnv} :
    {input output : Interface} →
    Term Γ input output →
    Term Γ input output →
    Prop
  | refl {input output} (term : Term Γ input output) :
      Equivalent term term
  | symm {input output} {left right : Term Γ input output} :
      Equivalent left right → Equivalent right left
  | trans {input output} {first second third : Term Γ input output} :
      Equivalent first second →
      Equivalent second third →
      Equivalent first third
  | plug_congr {input middle output}
      {left left' : Term Γ input middle}
      {right right' : Term Γ middle output} :
      Equivalent left left' →
      Equivalent right right' →
      Equivalent (.plugHide left right) (.plugHide left' right')
  | parallel_congr {leftIn leftOut rightIn rightOut}
      {left left' : Term Γ leftIn leftOut}
      {right right' : Term Γ rightIn rightOut} :
      Equivalent left left' →
      Equivalent right right' →
      Equivalent (.parallel left right) (.parallel left' right')
  | plug_assoc {a b c d}
      (first : Term Γ a b) (second : Term Γ b c)
      (third : Term Γ c d) :
      Equivalent
        (.plugHide (.plugHide first second) third)
        (.plugHide first (.plugHide second third))
  | plug_id_left {a b} (term : Term Γ a b) :
      Equivalent (.plugHide (.identity a) term) term
  | plug_id_right {a b} (term : Term Γ a b) :
      Equivalent (.plugHide term (.identity b)) term
  | tensor_comp {a b c d e f}
      (left₁ : Term Γ a b) (left₂ : Term Γ b c)
      (right₁ : Term Γ d e) (right₂ : Term Γ e f) :
      Equivalent
        (.plugHide
          (.parallel left₁ right₁)
          (.parallel left₂ right₂))
        (.parallel
          (.plugHide left₁ left₂)
          (.plugHide right₁ right₂))
  | tensor_id (left right : Interface) :
      Equivalent
        (.parallel (.identity left) (.identity right))
        (.identity (left ++ right))
  | associator_hom_inv (left middle right : Interface) :
      Equivalent
        (.plugHide
          (.associator left middle right)
          (.associatorInv left middle right))
        (.identity ((left ++ middle) ++ right))
  | associator_inv_hom (left middle right : Interface) :
      Equivalent
        (.plugHide
          (.associatorInv left middle right)
          (.associator left middle right))
        (.identity (left ++ (middle ++ right)))
  | leftUnitor_hom_inv (boundary : Interface) :
      Equivalent
        (.plugHide (.leftUnitor boundary) (.leftUnitorInv boundary))
        (.identity ([] ++ boundary))
  | leftUnitor_inv_hom (boundary : Interface) :
      Equivalent
        (.plugHide (.leftUnitorInv boundary) (.leftUnitor boundary))
        (.identity boundary)
  | rightUnitor_hom_inv (boundary : Interface) :
      Equivalent
        (.plugHide (.rightUnitor boundary) (.rightUnitorInv boundary))
        (.identity (boundary ++ []))
  | rightUnitor_inv_hom (boundary : Interface) :
      Equivalent
        (.plugHide (.rightUnitorInv boundary) (.rightUnitor boundary))
        (.identity boundary)
  | associator_natural {a a' b b' c c'}
      (left : Term Γ a a') (middle : Term Γ b b')
      (right : Term Γ c c') :
      Equivalent
        (.plugHide
          (.parallel (.parallel left middle) right)
          (.associator a' b' c'))
        (.plugHide
          (.associator a b c)
          (.parallel left (.parallel middle right)))
  | leftUnitor_natural {a b} (term : Term Γ a b) :
      Equivalent
        (.plugHide
          (.parallel (.identity []) term)
          (.leftUnitor b))
        (.plugHide (.leftUnitor a) term)
  | rightUnitor_natural {a b} (term : Term Γ a b) :
      Equivalent
        (.plugHide
          (.parallel term (.identity []))
          (.rightUnitor b))
        (.plugHide (.rightUnitor a) term)
  | pentagon (a b c d : Interface) :
      Equivalent
        (.plugHide
          (.associator (a ++ b) c d)
          (.associator a b (c ++ d)))
        (.plugHide
          (.plugHide
            (.parallel (.associator a b c) (.identity d))
            (.associator a (b ++ c) d))
          (.parallel (.identity a) (.associator b c d)))
  | triangle (a b : Interface) :
      Equivalent
        (.parallel (.rightUnitor a) (.identity b))
        (.plugHide
          (.associator a [] b)
          (.parallel (.identity a) (.leftUnitor b)))
  | braid_natural {a a' b b'}
      (left : Term Γ a a') (right : Term Γ b b') :
      Equivalent
        (.plugHide
          (.parallel left right)
          (.braid a' b'))
        (.plugHide
          (.braid a b)
          (.parallel right left))
  | symmetry (a b : Interface) :
      Equivalent
        (.plugHide (.braid a b) (.braid b a))
        (.identity (a ++ b))
  | hexagon (a b c : Interface) :
      Equivalent
        (.plugHide
          (.plugHide
            (.associator a b c)
            (.braid a (b ++ c)))
          (.associator b c a))
        (.plugHide
          (.plugHide
            (.parallel (.braid a b) (.identity c))
            (.associator b a c))
          (.parallel (.identity b) (.braid a c)))

def setoid (Γ : TypeEnv) (input output : Interface) :
    Setoid (Term Γ input output) where
  r := Equivalent
  iseqv := ⟨Equivalent.refl, Equivalent.symm, Equivalent.trans⟩

end Term

/-- Morphisms are typed open-process expressions modulo exactly the SMC laws. -/
abbrev Hom (Γ : TypeEnv) (input output : Interface) :=
  Quotient (Term.setoid Γ input output)

namespace Hom

def identity (Γ : TypeEnv) (boundary : Interface) :
    Hom Γ boundary boundary :=
  Quotient.mk _ (.identity boundary)

def atom (Γ : TypeEnv) (input output : Interface)
    (process : Proc) (typed : process.WellTyped Γ) :
    Hom Γ input output :=
  Quotient.mk _ (.atom input output process typed)

/-- Sequential composition is represented by boundary plugging/hiding. -/
def plugHide {Γ : TypeEnv} {input middle output : Interface} :
    Hom Γ input middle → Hom Γ middle output → Hom Γ input output :=
  Quotient.map₂ Term.plugHide (by
    intro left left' leftEq right right' rightEq
    exact Term.Equivalent.plug_congr leftEq rightEq)

/-- Tensor is represented by disjoint parallel placement. -/
def parallel {Γ : TypeEnv}
    {leftIn leftOut rightIn rightOut : Interface} :
    Hom Γ leftIn leftOut →
    Hom Γ rightIn rightOut →
    Hom Γ (leftIn ++ rightIn) (leftOut ++ rightOut) :=
  Quotient.map₂ Term.parallel (by
    intro left left' leftEq right right' rightEq
    exact Term.Equivalent.parallel_congr leftEq rightEq)

def associator (Γ : TypeEnv) (left middle right : Interface) :
    Hom Γ ((left ++ middle) ++ right) (left ++ (middle ++ right)) :=
  Quotient.mk _ (.associator left middle right)

def associatorInv (Γ : TypeEnv) (left middle right : Interface) :
    Hom Γ (left ++ (middle ++ right)) ((left ++ middle) ++ right) :=
  Quotient.mk _ (.associatorInv left middle right)

def leftUnitor (Γ : TypeEnv) (boundary : Interface) :
    Hom Γ ([] ++ boundary) boundary :=
  Quotient.mk _ (.leftUnitor boundary)

def leftUnitorInv (Γ : TypeEnv) (boundary : Interface) :
    Hom Γ boundary ([] ++ boundary) :=
  Quotient.mk _ (.leftUnitorInv boundary)

def rightUnitor (Γ : TypeEnv) (boundary : Interface) :
    Hom Γ (boundary ++ []) boundary :=
  Quotient.mk _ (.rightUnitor boundary)

def rightUnitorInv (Γ : TypeEnv) (boundary : Interface) :
    Hom Γ boundary (boundary ++ []) :=
  Quotient.mk _ (.rightUnitorInv boundary)

def braid (Γ : TypeEnv) (left right : Interface) :
    Hom Γ (left ++ right) (right ++ left) :=
  Quotient.mk _ (.braid left right)

@[simp]
theorem plugHide_mk {Γ : TypeEnv} {input middle output : Interface}
    (left : Term Γ input middle) (right : Term Γ middle output) :
    plugHide (Quotient.mk _ left) (Quotient.mk _ right) =
      Quotient.mk _ (.plugHide left right) :=
  rfl

@[simp]
theorem parallel_mk {Γ : TypeEnv}
    {leftIn leftOut rightIn rightOut : Interface}
    (left : Term Γ leftIn leftOut) (right : Term Γ rightIn rightOut) :
    parallel (Quotient.mk _ left) (Quotient.mk _ right) =
      Quotient.mk _ (.parallel left right) :=
  rfl

theorem plug_assoc {Γ : TypeEnv} {a b c d : Interface}
    (first : Hom Γ a b) (second : Hom Γ b c) (third : Hom Γ c d) :
    plugHide (plugHide first second) third =
      plugHide first (plugHide second third) := by
  refine Quotient.inductionOn₃ first second third ?_
  intro first second third
  exact Quotient.sound (Term.Equivalent.plug_assoc first second third)

theorem plug_id_left {Γ : TypeEnv} {a b : Interface}
    (term : Hom Γ a b) :
    plugHide (identity Γ a) term = term := by
  refine Quotient.inductionOn term ?_
  intro term
  exact Quotient.sound (Term.Equivalent.plug_id_left term)

theorem plug_id_right {Γ : TypeEnv} {a b : Interface}
    (term : Hom Γ a b) :
    plugHide term (identity Γ b) = term := by
  refine Quotient.inductionOn term ?_
  intro term
  exact Quotient.sound (Term.Equivalent.plug_id_right term)

theorem tensor_comp {Γ : TypeEnv} {a b c d e f : Interface}
    (left₁ : Hom Γ a b) (left₂ : Hom Γ b c)
    (right₁ : Hom Γ d e) (right₂ : Hom Γ e f) :
    plugHide (parallel left₁ right₁) (parallel left₂ right₂) =
      parallel (plugHide left₁ left₂) (plugHide right₁ right₂) := by
  refine Quotient.inductionOn left₁ ?_
  intro left₁
  refine Quotient.inductionOn left₂ ?_
  intro left₂
  refine Quotient.inductionOn right₁ ?_
  intro right₁
  refine Quotient.inductionOn right₂ ?_
  intro right₂
  exact Quotient.sound
    (Term.Equivalent.tensor_comp left₁ left₂ right₁ right₂)

theorem tensor_id (Γ : TypeEnv) (left right : Interface) :
    parallel (identity Γ left) (identity Γ right) =
      identity Γ (left ++ right) :=
  Quotient.sound (Term.Equivalent.tensor_id left right)

theorem associator_hom_inv (Γ : TypeEnv)
    (left middle right : Interface) :
    plugHide
      (associator Γ left middle right)
      (associatorInv Γ left middle right) =
      identity Γ ((left ++ middle) ++ right) :=
  Quotient.sound (Term.Equivalent.associator_hom_inv left middle right)

theorem associator_inv_hom (Γ : TypeEnv)
    (left middle right : Interface) :
    plugHide
      (associatorInv Γ left middle right)
      (associator Γ left middle right) =
      identity Γ (left ++ (middle ++ right)) :=
  Quotient.sound (Term.Equivalent.associator_inv_hom left middle right)

theorem leftUnitor_hom_inv (Γ : TypeEnv) (boundary : Interface) :
    plugHide (leftUnitor Γ boundary) (leftUnitorInv Γ boundary) =
      identity Γ ([] ++ boundary) :=
  Quotient.sound (Term.Equivalent.leftUnitor_hom_inv boundary)

theorem leftUnitor_inv_hom (Γ : TypeEnv) (boundary : Interface) :
    plugHide (leftUnitorInv Γ boundary) (leftUnitor Γ boundary) =
      identity Γ boundary :=
  Quotient.sound (Term.Equivalent.leftUnitor_inv_hom boundary)

theorem rightUnitor_hom_inv (Γ : TypeEnv) (boundary : Interface) :
    plugHide (rightUnitor Γ boundary) (rightUnitorInv Γ boundary) =
      identity Γ (boundary ++ []) :=
  Quotient.sound (Term.Equivalent.rightUnitor_hom_inv boundary)

theorem rightUnitor_inv_hom (Γ : TypeEnv) (boundary : Interface) :
    plugHide (rightUnitorInv Γ boundary) (rightUnitor Γ boundary) =
      identity Γ boundary :=
  Quotient.sound (Term.Equivalent.rightUnitor_inv_hom boundary)

theorem associator_natural {Γ : TypeEnv}
    {a a' b b' c c' : Interface}
    (left : Hom Γ a a') (middle : Hom Γ b b') (right : Hom Γ c c') :
    plugHide
      (parallel (parallel left middle) right)
      (associator Γ a' b' c') =
    plugHide
      (associator Γ a b c)
      (parallel left (parallel middle right)) := by
  refine Quotient.inductionOn₃ left middle right ?_
  intro left middle right
  exact Quotient.sound
    (Term.Equivalent.associator_natural left middle right)

theorem leftUnitor_natural {Γ : TypeEnv} {a b : Interface}
    (term : Hom Γ a b) :
    plugHide
      (parallel (identity Γ []) term)
      (leftUnitor Γ b) =
    plugHide (leftUnitor Γ a) term := by
  refine Quotient.inductionOn term ?_
  intro term
  exact Quotient.sound (Term.Equivalent.leftUnitor_natural term)

theorem rightUnitor_natural {Γ : TypeEnv} {a b : Interface}
    (term : Hom Γ a b) :
    plugHide
      (parallel term (identity Γ []))
      (rightUnitor Γ b) =
    plugHide (rightUnitor Γ a) term := by
  refine Quotient.inductionOn term ?_
  intro term
  exact Quotient.sound (Term.Equivalent.rightUnitor_natural term)

theorem pentagon (Γ : TypeEnv) (a b c d : Interface) :
    plugHide
      (associator Γ (a ++ b) c d)
      (associator Γ a b (c ++ d)) =
    plugHide
      (plugHide
        (parallel (associator Γ a b c) (identity Γ d))
        (associator Γ a (b ++ c) d))
      (parallel (identity Γ a) (associator Γ b c d)) :=
  Quotient.sound (Term.Equivalent.pentagon a b c d)

theorem triangle (Γ : TypeEnv) (a b : Interface) :
    parallel (rightUnitor Γ a) (identity Γ b) =
    plugHide
      (associator Γ a [] b)
      (parallel (identity Γ a) (leftUnitor Γ b)) :=
  Quotient.sound (Term.Equivalent.triangle a b)

theorem braid_natural {Γ : TypeEnv} {a a' b b' : Interface}
    (left : Hom Γ a a') (right : Hom Γ b b') :
    plugHide
      (parallel left right)
      (braid Γ a' b') =
    plugHide
      (braid Γ a b)
      (parallel right left) := by
  refine Quotient.inductionOn₂ left right ?_
  intro left right
  exact Quotient.sound (Term.Equivalent.braid_natural left right)

theorem symmetry (Γ : TypeEnv) (a b : Interface) :
    plugHide (braid Γ a b) (braid Γ b a) =
      identity Γ (a ++ b) :=
  Quotient.sound (Term.Equivalent.symmetry a b)

theorem hexagon (Γ : TypeEnv) (a b c : Interface) :
    plugHide
      (plugHide
        (associator Γ a b c)
        (braid Γ a (b ++ c)))
      (associator Γ b c a) =
    plugHide
      (plugHide
        (parallel (braid Γ a b) (identity Γ c))
        (associator Γ b a c))
      (parallel (identity Γ b) (braid Γ a c)) :=
  Quotient.sound (Term.Equivalent.hexagon a b c)

end Hom

/-- Kernel-checked law bundle for the typed presented open-process SMC. -/
structure Laws (Γ : TypeEnv) : Prop where
  category_associativity :
    ∀ {a b c d} (first : Hom Γ a b) (second : Hom Γ b c)
      (third : Hom Γ c d),
      Hom.plugHide (Hom.plugHide first second) third =
        Hom.plugHide first (Hom.plugHide second third)
  category_left_identity :
    ∀ {a b} (term : Hom Γ a b),
      Hom.plugHide (Hom.identity Γ a) term = term
  category_right_identity :
    ∀ {a b} (term : Hom Γ a b),
      Hom.plugHide term (Hom.identity Γ b) = term
  tensor_interchange :
    ∀ {a b c d e f}
      (left₁ : Hom Γ a b) (left₂ : Hom Γ b c)
      (right₁ : Hom Γ d e) (right₂ : Hom Γ e f),
      Hom.plugHide
          (Hom.parallel left₁ right₁)
          (Hom.parallel left₂ right₂) =
        Hom.parallel
          (Hom.plugHide left₁ left₂)
          (Hom.plugHide right₁ right₂)
  tensor_identity :
    ∀ left right,
      Hom.parallel (Hom.identity Γ left) (Hom.identity Γ right) =
        Hom.identity Γ (left ++ right)
  associator_isomorphism :
    (∀ left middle right,
      Hom.plugHide
          (Hom.associator Γ left middle right)
          (Hom.associatorInv Γ left middle right) =
        Hom.identity Γ ((left ++ middle) ++ right)) ∧
    (∀ left middle right,
      Hom.plugHide
          (Hom.associatorInv Γ left middle right)
          (Hom.associator Γ left middle right) =
        Hom.identity Γ (left ++ (middle ++ right)))
  unitor_isomorphisms :
    (∀ boundary,
      Hom.plugHide
          (Hom.leftUnitor Γ boundary)
          (Hom.leftUnitorInv Γ boundary) =
        Hom.identity Γ ([] ++ boundary)) ∧
    (∀ boundary,
      Hom.plugHide
          (Hom.leftUnitorInv Γ boundary)
          (Hom.leftUnitor Γ boundary) =
        Hom.identity Γ boundary) ∧
    (∀ boundary,
      Hom.plugHide
          (Hom.rightUnitor Γ boundary)
          (Hom.rightUnitorInv Γ boundary) =
        Hom.identity Γ (boundary ++ [])) ∧
    (∀ boundary,
      Hom.plugHide
          (Hom.rightUnitorInv Γ boundary)
          (Hom.rightUnitor Γ boundary) =
        Hom.identity Γ boundary)
  associator_naturality :
    ∀ {a a' b b' c c'}
      (left : Hom Γ a a') (middle : Hom Γ b b') (right : Hom Γ c c'),
      Hom.plugHide
          (Hom.parallel (Hom.parallel left middle) right)
          (Hom.associator Γ a' b' c') =
        Hom.plugHide
          (Hom.associator Γ a b c)
          (Hom.parallel left (Hom.parallel middle right))
  unitor_naturality :
    (∀ {a b} (term : Hom Γ a b),
      Hom.plugHide
          (Hom.parallel (Hom.identity Γ []) term)
          (Hom.leftUnitor Γ b) =
        Hom.plugHide (Hom.leftUnitor Γ a) term) ∧
    (∀ {a b} (term : Hom Γ a b),
      Hom.plugHide
          (Hom.parallel term (Hom.identity Γ []))
          (Hom.rightUnitor Γ b) =
        Hom.plugHide (Hom.rightUnitor Γ a) term)
  pentagon :
    ∀ a b c d, Hom.plugHide
      (Hom.associator Γ (a ++ b) c d)
      (Hom.associator Γ a b (c ++ d)) =
    Hom.plugHide
      (Hom.plugHide
        (Hom.parallel (Hom.associator Γ a b c) (Hom.identity Γ d))
        (Hom.associator Γ a (b ++ c) d))
      (Hom.parallel (Hom.identity Γ a) (Hom.associator Γ b c d))
  triangle :
    ∀ a b,
      Hom.parallel (Hom.rightUnitor Γ a) (Hom.identity Γ b) =
      Hom.plugHide
        (Hom.associator Γ a [] b)
        (Hom.parallel (Hom.identity Γ a) (Hom.leftUnitor Γ b))
  symmetry :
    ∀ a b,
      Hom.plugHide (Hom.braid Γ a b) (Hom.braid Γ b a) =
        Hom.identity Γ (a ++ b)
  braid_naturality :
    ∀ {a a' b b'} (left : Hom Γ a a') (right : Hom Γ b b'),
      Hom.plugHide
          (Hom.parallel left right)
          (Hom.braid Γ a' b') =
        Hom.plugHide
          (Hom.braid Γ a b)
          (Hom.parallel right left)
  hexagon :
    ∀ a b c,
      Hom.plugHide
        (Hom.plugHide
          (Hom.associator Γ a b c)
          (Hom.braid Γ a (b ++ c)))
        (Hom.associator Γ b c a) =
      Hom.plugHide
        (Hom.plugHide
          (Hom.parallel (Hom.braid Γ a b) (Hom.identity Γ c))
          (Hom.associator Γ b a c))
        (Hom.parallel (Hom.identity Γ b) (Hom.braid Γ a c))

/--
Central SMC theorem for the typed *presented* open-process layer.

The proof establishes category laws, tensor interchange, unit/associator
isomorphisms, pentagon, triangle, symmetry, and hexagon.  Naturality is also
available as the standalone `Hom.associator_natural`,
`Hom.leftUnitor_natural`, `Hom.rightUnitor_natural`, and
`Hom.braid_natural` theorems.
-/
theorem open_pi_smc (Γ : TypeEnv) : Laws Γ where
  category_associativity := Hom.plug_assoc
  category_left_identity := Hom.plug_id_left
  category_right_identity := Hom.plug_id_right
  tensor_interchange := Hom.tensor_comp
  tensor_identity := Hom.tensor_id Γ
  associator_isomorphism :=
    ⟨Hom.associator_hom_inv Γ, Hom.associator_inv_hom Γ⟩
  unitor_isomorphisms :=
    ⟨Hom.leftUnitor_hom_inv Γ, Hom.leftUnitor_inv_hom Γ,
      Hom.rightUnitor_hom_inv Γ, Hom.rightUnitor_inv_hom Γ⟩
  associator_naturality := Hom.associator_natural
  unitor_naturality :=
    ⟨Hom.leftUnitor_natural, Hom.rightUnitor_natural⟩
  pentagon := Hom.pentagon Γ
  triangle := Hom.triangle Γ
  symmetry := Hom.symmetry Γ
  braid_naturality := Hom.braid_natural
  hexagon := Hom.hexagon Γ

end Cantilune.Pi.OpenSMC
