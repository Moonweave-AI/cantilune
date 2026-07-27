import Cantilune.Core.FreeSMC

/-!
# The SMC-equation quotient of `FreeSMC`

`FreeSMC` is deliberately a raw, intrinsically typed syntax tree.  This
module adds the generated congruence for the category and symmetric monoidal
coherence equations, forms the hom-wise quotient, and proves its strict
universal property for interpretations that fix the object words and the
chosen interpretations of generators, copy, and discard.

The object tensor is word concatenation.  Since Lean's `List.append` is
associative and right-unital propositionally rather than definitionally,
associators and right unitors below are transported identities.  This is the
standard strictification at the level of tensor words; no copy or discard is
introduced by a coherence map.
-/

namespace Cantilune.Core
namespace FreeSMCQuotient

abbrev Word (σ : FinSignature) := List σ.Obj
abbrev Raw (σ : FinSignature) := FreeSMC σ

/-- Transport both endpoints of an intrinsically typed raw diagram. -/
def castRaw {σ : FinSignature} {a b a' b' : Word σ}
    (ha : a = a') (hb : b = b') (f : Raw σ a b) : Raw σ a' b' := by
  subst ha
  subst hb
  exact f

@[simp] theorem castRaw_rfl {σ : FinSignature} {a b : Word σ}
    (f : Raw σ a b) : castRaw rfl rfl f = f := rfl

/-- The raw coherence arrow induced by an equality of tensor words. -/
def equalityRaw {σ : FinSignature} {a b : Word σ} (h : a = b) :
    Raw σ a b :=
  castRaw rfl h (.identity a)

/-- Strictified associator: a transported identity on the flattened word. -/
def associatorRaw (σ : FinSignature) (a b c : Word σ) :
    Raw σ ((a ++ b) ++ c) (a ++ (b ++ c)) :=
  equalityRaw (List.append_assoc a b c)

/-- Inverse strictified associator. -/
def associatorInvRaw (σ : FinSignature) (a b c : Word σ) :
    Raw σ (a ++ (b ++ c)) ((a ++ b) ++ c) :=
  equalityRaw (List.append_assoc a b c).symm

/-- The left unitor is definitionally an identity for list words. -/
def leftUnitorRaw (σ : FinSignature) (a : Word σ) :
    Raw σ ([] ++ a) a :=
  .identity a

/-- Inverse left unitor. -/
def leftUnitorInvRaw (σ : FinSignature) (a : Word σ) :
    Raw σ a ([] ++ a) :=
  .identity a

/-- The right unitor is the identity transported along `append_nil`. -/
def rightUnitorRaw (σ : FinSignature) (a : Word σ) :
    Raw σ (a ++ []) a :=
  equalityRaw (List.append_nil a)

/-- Inverse right unitor. -/
def rightUnitorInvRaw (σ : FinSignature) (a : Word σ) :
    Raw σ a (a ++ []) :=
  equalityRaw (List.append_nil a).symm

open FreeSMC

/--
The least equivalence relation compatible with sequential and tensor
composition and containing the category, bifunctor, naturality, inverse, and
SMC coherence equations.

The `equivalence` and two congruence constructors make the intended
"generated congruence" explicit; no semantic equality is hidden here.
-/
inductive Congruent (σ : FinSignature) :
    {a b : Word σ} → Raw σ a b → Raw σ a b → Prop
  | refl {a b} (f : Raw σ a b) : Congruent σ f f
  | symm {a b} {f g : Raw σ a b} :
      Congruent σ f g → Congruent σ g f
  | trans {a b} {f g h : Raw σ a b} :
      Congruent σ f g → Congruent σ g h → Congruent σ f h
  | sequential {a b c} {f f' : Raw σ a b} {g g' : Raw σ b c} :
      Congruent σ f f' → Congruent σ g g' →
        Congruent σ (f ≫ₛ g) (f' ≫ₛ g')
  | tensor {a b c d} {f f' : Raw σ a b} {g g' : Raw σ c d} :
      Congruent σ f f' → Congruent σ g g' →
        Congruent σ (f ⊗ₛ g) (f' ⊗ₛ g')

  | id_comp {a b} (f : Raw σ a b) :
      Congruent σ ((.identity a) ≫ₛ f) f
  | comp_id {a b} (f : Raw σ a b) :
      Congruent σ (f ≫ₛ (.identity b)) f
  | comp_assoc {a b c d}
      (f : Raw σ a b) (g : Raw σ b c) (h : Raw σ c d) :
      Congruent σ ((f ≫ₛ g) ≫ₛ h) (f ≫ₛ (g ≫ₛ h))

  | tensor_id (a b : Word σ) :
      Congruent σ ((.identity a) ⊗ₛ (.identity b))
        (.identity (a ++ b))
  | tensor_comp {a b c d e f}
      (p : Raw σ a b) (q : Raw σ b c)
      (r : Raw σ d e) (s : Raw σ e f) :
      Congruent σ ((p ≫ₛ q) ⊗ₛ (r ≫ₛ s))
        ((p ⊗ₛ r) ≫ₛ (q ⊗ₛ s))

  | associator_natural {a b c a' b' c'}
      (f : Raw σ a a') (g : Raw σ b b') (h : Raw σ c c') :
      Congruent σ
        (((f ⊗ₛ g) ⊗ₛ h) ≫ₛ associatorRaw σ a' b' c')
        (associatorRaw σ a b c ≫ₛ (f ⊗ₛ (g ⊗ₛ h)))
  | left_unitor_natural {a b} (f : Raw σ a b) :
      Congruent σ
        (((.identity []) ⊗ₛ f) ≫ₛ leftUnitorRaw σ b)
        (leftUnitorRaw σ a ≫ₛ f)
  | right_unitor_natural {a b} (f : Raw σ a b) :
      Congruent σ
        ((f ⊗ₛ (.identity [])) ≫ₛ rightUnitorRaw σ b)
        (rightUnitorRaw σ a ≫ₛ f)
  | symmetry_natural {a b c d}
      (f : Raw σ a b) (g : Raw σ c d) :
      Congruent σ
        ((f ⊗ₛ g) ≫ₛ .symmetry b d)
        (.symmetry a c ≫ₛ (g ⊗ₛ f))

  | associator_hom_inv (a b c : Word σ) :
      Congruent σ
        (associatorRaw σ a b c ≫ₛ associatorInvRaw σ a b c)
        (.identity ((a ++ b) ++ c))
  | associator_inv_hom (a b c : Word σ) :
      Congruent σ
        (associatorInvRaw σ a b c ≫ₛ associatorRaw σ a b c)
        (.identity (a ++ (b ++ c)))
  | left_unitor_hom_inv (a : Word σ) :
      Congruent σ
        (leftUnitorRaw σ a ≫ₛ leftUnitorInvRaw σ a)
        (.identity ([] ++ a))
  | left_unitor_inv_hom (a : Word σ) :
      Congruent σ
        (leftUnitorInvRaw σ a ≫ₛ leftUnitorRaw σ a)
        (.identity a)
  | right_unitor_hom_inv (a : Word σ) :
      Congruent σ
        (rightUnitorRaw σ a ≫ₛ rightUnitorInvRaw σ a)
        (.identity (a ++ []))
  | right_unitor_inv_hom (a : Word σ) :
      Congruent σ
        (rightUnitorInvRaw σ a ≫ₛ rightUnitorRaw σ a)
        (.identity a)
  | symmetry_involutive (a b : Word σ) :
      Congruent σ
        ((.symmetry a b) ≫ₛ (.symmetry b a))
        (.identity (a ++ b))

  | pentagon (a b c d : Word σ) :
      Congruent σ
        (associatorRaw σ (a ++ b) c d ≫ₛ
          associatorRaw σ a b (c ++ d))
        (((associatorRaw σ a b c ⊗ₛ .identity d) ≫ₛ
          associatorRaw σ a (b ++ c) d) ≫ₛ
          (.identity a ⊗ₛ associatorRaw σ b c d))
  | triangle (a b : Word σ) :
      Congruent σ
        (associatorRaw σ a [] b ≫ₛ
          (.identity a ⊗ₛ leftUnitorRaw σ b))
        (rightUnitorRaw σ a ⊗ₛ .identity b)
  | hexagon (a b c : Word σ) :
      Congruent σ
        ((associatorRaw σ a b c ≫ₛ .symmetry a (b ++ c)) ≫ₛ
          associatorRaw σ b c a)
        (((.symmetry a b ⊗ₛ .identity c) ≫ₛ
          associatorRaw σ b a c) ≫ₛ
          (.identity b ⊗ₛ .symmetry a c))

namespace Congruent

instance setoid (σ : FinSignature) (a b : Word σ) :
    Setoid (Raw σ a b) where
  r := Congruent σ
  iseqv := ⟨Congruent.refl, Congruent.symm, Congruent.trans⟩

end Congruent

/-- A hom of the free SMC is a raw diagram modulo the generated SMC laws. -/
abbrev Hom (σ : FinSignature) (a b : Word σ) :=
  Quotient (Congruent.setoid σ a b)

/-- Insert a raw diagram into the SMC quotient. -/
def ofRaw {σ : FinSignature} {a b : Word σ} (f : Raw σ a b) :
    Hom σ a b :=
  Quotient.mk (Congruent.setoid σ a b) f

theorem sound {σ : FinSignature} {a b : Word σ} {f g : Raw σ a b}
    (h : Congruent σ f g) : ofRaw f = ofRaw g :=
  Quotient.sound h

/-- Quotient identity. -/
def id (σ : FinSignature) (a : Word σ) : Hom σ a a :=
  ofRaw (.identity a)

/-- Quotient sequential composition. -/
def comp {σ : FinSignature} {a b c : Word σ} :
    Hom σ a b → Hom σ b c → Hom σ a c :=
  Quotient.map₂ FreeSMC.sequential
    (fun {f f'} (hf : Congruent σ f f')
      {g g'} (hg : Congruent σ g g') =>
        Congruent.sequential hf hg)

/-- Quotient tensor product. -/
def tensor {σ : FinSignature} {a b c d : Word σ} :
    Hom σ a b → Hom σ c d → Hom σ (a ++ c) (b ++ d) :=
  Quotient.map₂ FreeSMC.tensor
    (fun {f f'} (hf : Congruent σ f f')
      {g g'} (hg : Congruent σ g g') =>
        Congruent.tensor hf hg)

infixr:90 " ≫q " => comp
infixr:80 " ⊗q " => tensor

def symmetry (σ : FinSignature) (a b : Word σ) :
    Hom σ (a ++ b) (b ++ a) :=
  ofRaw (.symmetry a b)

def associator (σ : FinSignature) (a b c : Word σ) :
    Hom σ ((a ++ b) ++ c) (a ++ (b ++ c)) :=
  ofRaw (associatorRaw σ a b c)

def associatorInv (σ : FinSignature) (a b c : Word σ) :
    Hom σ (a ++ (b ++ c)) ((a ++ b) ++ c) :=
  ofRaw (associatorInvRaw σ a b c)

def leftUnitor (σ : FinSignature) (a : Word σ) :
    Hom σ ([] ++ a) a :=
  ofRaw (leftUnitorRaw σ a)

def leftUnitorInv (σ : FinSignature) (a : Word σ) :
    Hom σ a ([] ++ a) :=
  ofRaw (leftUnitorInvRaw σ a)

def rightUnitor (σ : FinSignature) (a : Word σ) :
    Hom σ (a ++ []) a :=
  ofRaw (rightUnitorRaw σ a)

def rightUnitorInv (σ : FinSignature) (a : Word σ) :
    Hom σ a (a ++ []) :=
  ofRaw (rightUnitorInvRaw σ a)

@[simp] theorem ofRaw_comp {σ : FinSignature} {a b c : Word σ}
    (f : Raw σ a b) (g : Raw σ b c) :
    ofRaw (f ≫ₛ g) = ofRaw f ≫q ofRaw g := rfl

@[simp] theorem ofRaw_tensor {σ : FinSignature} {a b c d : Word σ}
    (f : Raw σ a b) (g : Raw σ c d) :
    ofRaw (f ⊗ₛ g) = ofRaw f ⊗q ofRaw g := rfl

theorem id_comp {σ : FinSignature} {a b : Word σ} (f : Hom σ a b) :
    id σ a ≫q f = f := by
  refine Quotient.inductionOn f ?_
  intro raw
  exact sound (Congruent.id_comp raw)

theorem comp_id {σ : FinSignature} {a b : Word σ} (f : Hom σ a b) :
    f ≫q id σ b = f := by
  refine Quotient.inductionOn f ?_
  intro raw
  exact sound (Congruent.comp_id raw)

theorem comp_assoc {σ : FinSignature} {a b c d : Word σ}
    (f : Hom σ a b) (g : Hom σ b c) (h : Hom σ c d) :
    (f ≫q g) ≫q h = f ≫q (g ≫q h) := by
  refine Quotient.inductionOn₃ f g h ?_
  intro p q r
  exact sound (Congruent.comp_assoc p q r)

theorem tensor_id {σ : FinSignature} (a b : Word σ) :
    id σ a ⊗q id σ b = id σ (a ++ b) :=
  sound (Congruent.tensor_id a b)

theorem tensor_comp {σ : FinSignature}
    {a b c d e f : Word σ}
    (p : Hom σ a b) (q : Hom σ b c)
    (r : Hom σ d e) (s : Hom σ e f) :
    (p ≫q q) ⊗q (r ≫q s) =
      (p ⊗q r) ≫q (q ⊗q s) := by
  refine Quotient.inductionOn p ?_
  intro p'
  refine Quotient.inductionOn q ?_
  intro q'
  refine Quotient.inductionOn r ?_
  intro r'
  refine Quotient.inductionOn s ?_
  intro s'
  exact sound (Congruent.tensor_comp p' q' r' s')

theorem associator_natural {σ : FinSignature}
    {a b c a' b' c' : Word σ}
    (f : Hom σ a a') (g : Hom σ b b') (h : Hom σ c c') :
    ((f ⊗q g) ⊗q h) ≫q associator σ a' b' c' =
      associator σ a b c ≫q (f ⊗q (g ⊗q h)) := by
  refine Quotient.inductionOn₃ f g h ?_
  intro f' g' h'
  exact sound (Congruent.associator_natural f' g' h')

theorem left_unitor_natural {σ : FinSignature}
    {a b : Word σ} (f : Hom σ a b) :
    (id σ [] ⊗q f) ≫q leftUnitor σ b =
      leftUnitor σ a ≫q f := by
  refine Quotient.inductionOn f ?_
  intro f'
  exact sound (Congruent.left_unitor_natural f')

theorem right_unitor_natural {σ : FinSignature}
    {a b : Word σ} (f : Hom σ a b) :
    (f ⊗q id σ []) ≫q rightUnitor σ b =
      rightUnitor σ a ≫q f := by
  refine Quotient.inductionOn f ?_
  intro f'
  exact sound (Congruent.right_unitor_natural f')

theorem symmetry_natural {σ : FinSignature}
    {a b c d : Word σ} (f : Hom σ a b) (g : Hom σ c d) :
    (f ⊗q g) ≫q symmetry σ b d =
      symmetry σ a c ≫q (g ⊗q f) := by
  refine Quotient.inductionOn₂ f g ?_
  intro f' g'
  exact sound (Congruent.symmetry_natural f' g')

theorem associator_hom_inv {σ : FinSignature} (a b c : Word σ) :
    associator σ a b c ≫q associatorInv σ a b c =
      id σ ((a ++ b) ++ c) :=
  sound (Congruent.associator_hom_inv a b c)

theorem associator_inv_hom {σ : FinSignature} (a b c : Word σ) :
    associatorInv σ a b c ≫q associator σ a b c =
      id σ (a ++ (b ++ c)) :=
  sound (Congruent.associator_inv_hom a b c)

theorem leftUnitor_hom_inv {σ : FinSignature} (a : Word σ) :
    leftUnitor σ a ≫q leftUnitorInv σ a = id σ ([] ++ a) :=
  sound (Congruent.left_unitor_hom_inv a)

theorem leftUnitor_inv_hom {σ : FinSignature} (a : Word σ) :
    leftUnitorInv σ a ≫q leftUnitor σ a = id σ a :=
  sound (Congruent.left_unitor_inv_hom a)

theorem rightUnitor_hom_inv {σ : FinSignature} (a : Word σ) :
    rightUnitor σ a ≫q rightUnitorInv σ a = id σ (a ++ []) :=
  sound (Congruent.right_unitor_hom_inv a)

theorem rightUnitor_inv_hom {σ : FinSignature} (a : Word σ) :
    rightUnitorInv σ a ≫q rightUnitor σ a = id σ a :=
  sound (Congruent.right_unitor_inv_hom a)

theorem symmetry_involutive {σ : FinSignature} (a b : Word σ) :
    symmetry σ a b ≫q symmetry σ b a = id σ (a ++ b) :=
  sound (Congruent.symmetry_involutive a b)

theorem pentagon {σ : FinSignature} (a b c d : Word σ) :
    associator σ (a ++ b) c d ≫q associator σ a b (c ++ d) =
      ((associator σ a b c ⊗q id σ d) ≫q
        associator σ a (b ++ c) d) ≫q
          (id σ a ⊗q associator σ b c d) :=
  sound (Congruent.pentagon a b c d)

theorem triangle {σ : FinSignature} (a b : Word σ) :
    associator σ a [] b ≫q
        (id σ a ⊗q leftUnitor σ b) =
      rightUnitor σ a ⊗q id σ b :=
  sound (Congruent.triangle a b)

theorem hexagon {σ : FinSignature} (a b c : Word σ) :
    (associator σ a b c ≫q symmetry σ a (b ++ c)) ≫q
        associator σ b c a =
      ((symmetry σ a b ⊗q id σ c) ≫q
        associator σ b a c) ≫q
          (id σ b ⊗q symmetry σ a c) := by
  exact sound (Congruent.hexagon a b c)

/--
The individual SMC equations required of an interpretation algebra.

These are precisely the generating equations above, not an assumption that
the fold respects the generated congruence.  The latter is proved separately
by induction in `fold_respects`.
-/
structure Laws {σ : FinSignature} (A : FreeSMC.Algebra σ) where
  id_comp :
    ∀ {a b} (f : A.Carrier a b),
      A.sequential (A.identity a) f = f
  comp_id :
    ∀ {a b} (f : A.Carrier a b),
      A.sequential f (A.identity b) = f
  comp_assoc :
    ∀ {a b c d}
      (f : A.Carrier a b) (g : A.Carrier b c) (h : A.Carrier c d),
      A.sequential (A.sequential f g) h =
        A.sequential f (A.sequential g h)
  tensor_id :
    ∀ (a b : Word σ),
      A.tensor (A.identity a) (A.identity b) =
        A.identity (a ++ b)
  tensor_comp :
    ∀ {a b c d e f}
      (p : A.Carrier a b) (q : A.Carrier b c)
      (r : A.Carrier d e) (s : A.Carrier e f),
      A.tensor (A.sequential p q) (A.sequential r s) =
        A.sequential (A.tensor p r) (A.tensor q s)

  associator_natural :
    ∀ {a b c a' b' c'}
      (f : A.Carrier a a') (g : A.Carrier b b')
      (h : A.Carrier c c'),
      A.sequential
          (A.tensor (A.tensor f g) h)
          (FreeSMC.fold A (associatorRaw σ a' b' c')) =
        A.sequential
          (FreeSMC.fold A (associatorRaw σ a b c))
          (A.tensor f (A.tensor g h))
  left_unitor_natural :
    ∀ {a b} (f : A.Carrier a b),
      A.sequential
          (A.tensor (A.identity []) f)
          (FreeSMC.fold A (leftUnitorRaw σ b)) =
        A.sequential
          (FreeSMC.fold A (leftUnitorRaw σ a)) f
  right_unitor_natural :
    ∀ {a b} (f : A.Carrier a b),
      A.sequential
          (A.tensor f (A.identity []))
          (FreeSMC.fold A (rightUnitorRaw σ b)) =
        A.sequential
          (FreeSMC.fold A (rightUnitorRaw σ a)) f
  symmetry_natural :
    ∀ {a b c d} (f : A.Carrier a b) (g : A.Carrier c d),
      A.sequential (A.tensor f g) (A.symmetry b d) =
        A.sequential (A.symmetry a c) (A.tensor g f)

  associator_hom_inv :
    ∀ (a b c : Word σ),
      FreeSMC.fold A
          (associatorRaw σ a b c ≫ₛ associatorInvRaw σ a b c) =
        FreeSMC.fold A (.identity ((a ++ b) ++ c))
  associator_inv_hom :
    ∀ (a b c : Word σ),
      FreeSMC.fold A
          (associatorInvRaw σ a b c ≫ₛ associatorRaw σ a b c) =
        FreeSMC.fold A (.identity (a ++ (b ++ c)))
  left_unitor_hom_inv :
    ∀ (a : Word σ),
      FreeSMC.fold A
          (leftUnitorRaw σ a ≫ₛ leftUnitorInvRaw σ a) =
        FreeSMC.fold A (.identity ([] ++ a))
  left_unitor_inv_hom :
    ∀ (a : Word σ),
      FreeSMC.fold A
          (leftUnitorInvRaw σ a ≫ₛ leftUnitorRaw σ a) =
        FreeSMC.fold A (.identity a)
  right_unitor_hom_inv :
    ∀ (a : Word σ),
      FreeSMC.fold A
          (rightUnitorRaw σ a ≫ₛ rightUnitorInvRaw σ a) =
        FreeSMC.fold A (.identity (a ++ []))
  right_unitor_inv_hom :
    ∀ (a : Word σ),
      FreeSMC.fold A
          (rightUnitorInvRaw σ a ≫ₛ rightUnitorRaw σ a) =
        FreeSMC.fold A (.identity a)
  symmetry_involutive :
    ∀ (a b : Word σ),
      FreeSMC.fold A ((.symmetry a b) ≫ₛ (.symmetry b a)) =
        FreeSMC.fold A (.identity (a ++ b))

  pentagon :
    ∀ (a b c d : Word σ),
      FreeSMC.fold A
          (associatorRaw σ (a ++ b) c d ≫ₛ
            associatorRaw σ a b (c ++ d)) =
        FreeSMC.fold A
          (((associatorRaw σ a b c ⊗ₛ .identity d) ≫ₛ
            associatorRaw σ a (b ++ c) d) ≫ₛ
            (.identity a ⊗ₛ associatorRaw σ b c d))
  triangle :
    ∀ (a b : Word σ),
      FreeSMC.fold A
          (associatorRaw σ a [] b ≫ₛ
            (.identity a ⊗ₛ leftUnitorRaw σ b)) =
        FreeSMC.fold A (rightUnitorRaw σ a ⊗ₛ .identity b)
  hexagon :
    ∀ (a b c : Word σ),
      FreeSMC.fold A
          ((associatorRaw σ a b c ≫ₛ .symmetry a (b ++ c)) ≫ₛ
            associatorRaw σ b c a) =
        FreeSMC.fold A
          (((.symmetry a b ⊗ₛ .identity c) ≫ₛ
            associatorRaw σ b a c) ≫ₛ
            (.identity b ⊗ₛ .symmetry a c))

/-- An algebra together with proofs of every generated SMC equation. -/
structure LawfulAlgebra (σ : FinSignature) where
  algebra : FreeSMC.Algebra σ
  laws : Laws algebra

/-- A lawful algebra's structural fold respects the generated congruence. -/
theorem fold_respects {σ : FinSignature} (A : LawfulAlgebra σ)
    {a b : Word σ} {f g : Raw σ a b} (h : Congruent σ f g) :
    FreeSMC.fold A.algebra f = FreeSMC.fold A.algebra g := by
  induction h with
  | refl => rfl
  | symm _ ih => exact ih.symm
  | trans _ _ ih₁ ih₂ => exact ih₁.trans ih₂
  | sequential _ _ ih₁ ih₂ =>
      simp only [FreeSMC.fold_sequential]
      rw [ih₁, ih₂]
  | tensor _ _ ih₁ ih₂ =>
      simp only [FreeSMC.fold_tensor]
      rw [ih₁, ih₂]
  | id_comp f => exact A.laws.id_comp (FreeSMC.fold A.algebra f)
  | comp_id f => exact A.laws.comp_id (FreeSMC.fold A.algebra f)
  | comp_assoc f g h =>
      exact A.laws.comp_assoc
        (FreeSMC.fold A.algebra f)
        (FreeSMC.fold A.algebra g)
        (FreeSMC.fold A.algebra h)
  | tensor_id a b => exact A.laws.tensor_id a b
  | tensor_comp p q r s =>
      exact A.laws.tensor_comp
        (FreeSMC.fold A.algebra p)
        (FreeSMC.fold A.algebra q)
        (FreeSMC.fold A.algebra r)
        (FreeSMC.fold A.algebra s)
  | associator_natural f g h =>
      exact A.laws.associator_natural
        (FreeSMC.fold A.algebra f)
        (FreeSMC.fold A.algebra g)
        (FreeSMC.fold A.algebra h)
  | left_unitor_natural f =>
      exact A.laws.left_unitor_natural (FreeSMC.fold A.algebra f)
  | right_unitor_natural f =>
      exact A.laws.right_unitor_natural (FreeSMC.fold A.algebra f)
  | symmetry_natural f g =>
      exact A.laws.symmetry_natural
        (FreeSMC.fold A.algebra f)
        (FreeSMC.fold A.algebra g)
  | associator_hom_inv a b c => exact A.laws.associator_hom_inv a b c
  | associator_inv_hom a b c => exact A.laws.associator_inv_hom a b c
  | left_unitor_hom_inv a => exact A.laws.left_unitor_hom_inv a
  | left_unitor_inv_hom a => exact A.laws.left_unitor_inv_hom a
  | right_unitor_hom_inv a => exact A.laws.right_unitor_hom_inv a
  | right_unitor_inv_hom a => exact A.laws.right_unitor_inv_hom a
  | symmetry_involutive a b => exact A.laws.symmetry_involutive a b
  | pentagon a b c d => exact A.laws.pentagon a b c d
  | triangle a b => exact A.laws.triangle a b
  | hexagon a b c => exact A.laws.hexagon a b c

/-- The canonical interpretation of quotient diagrams in a lawful algebra. -/
def interpret {σ : FinSignature} (A : LawfulAlgebra σ)
    {a b : Word σ} : Hom σ a b → A.algebra.Carrier a b :=
  Quotient.lift (FreeSMC.fold A.algebra)
    (fun _ _ h => fold_respects A h)

@[simp] theorem interpret_ofRaw {σ : FinSignature} (A : LawfulAlgebra σ)
    {a b : Word σ} (f : Raw σ a b) :
    interpret A (ofRaw f) = FreeSMC.fold A.algebra f := rfl

/--
A strict identity-on-objects SMC interpretation out of the quotient.
Generator, copy, and discard interpretations are fixed by the target algebra.
-/
structure Interpreter {σ : FinSignature} (A : LawfulAlgebra σ) where
  map : {a b : Word σ} → Hom σ a b → A.algebra.Carrier a b
  map_identity :
    ∀ a, map (id σ a) = A.algebra.identity a
  map_generator :
    ∀ g, map (ofRaw (.generator g)) = A.algebra.generator g
  map_sequential :
    ∀ {a b c} (f : Hom σ a b) (g : Hom σ b c),
      map (f ≫q g) = A.algebra.sequential (map f) (map g)
  map_tensor :
    ∀ {a b c d} (f : Hom σ a b) (g : Hom σ c d),
      map (f ⊗q g) = A.algebra.tensor (map f) (map g)
  map_symmetry :
    ∀ a b, map (symmetry σ a b) = A.algebra.symmetry a b
  map_copy :
    ∀ o (h : (σ.mode o).AllowsCopy),
      map (ofRaw (.copy o h)) = A.algebra.copy o h
  map_discard :
    ∀ o (h : (σ.mode o).AllowsDrop),
      map (ofRaw (.discard o h)) = A.algebra.discard o h

/-- The quotient fold bundled as an operation-preserving interpretation. -/
def quotientInterpreter {σ : FinSignature} (A : LawfulAlgebra σ) :
    Interpreter A where
  map := interpret A
  map_identity := by intros; rfl
  map_generator := by intros; rfl
  map_sequential := by
    intro a b c f g
    refine Quotient.inductionOn f ?_
    intro f'
    refine Quotient.inductionOn g ?_
    intro g'
    rfl
  map_tensor := by
    intro a b c d f g
    refine Quotient.inductionOn f ?_
    intro f'
    refine Quotient.inductionOn g ?_
    intro g'
    rfl
  map_symmetry := by intros; rfl
  map_copy := by intros; rfl
  map_discard := by intros; rfl

@[ext]
theorem Interpreter.ext {σ : FinSignature} {A : LawfulAlgebra σ}
    {F G : Interpreter A}
    (h : ∀ {a b : Word σ} (f : Hom σ a b), F.map f = G.map f) :
    F = G := by
  cases F
  cases G
  simp only [Interpreter.mk.injEq]
  funext a b f
  exact h f

/-- On an inserted raw term, any quotient interpreter is its structural fold. -/
theorem Interpreter.map_ofRaw_eq_fold {σ : FinSignature}
    {A : LawfulAlgebra σ} (F : Interpreter A)
    {a b : Word σ} (f : Raw σ a b) :
    F.map (ofRaw f) = FreeSMC.fold A.algebra f := by
  induction f with
  | identity ports =>
      exact F.map_identity ports
  | generator g =>
      exact F.map_generator g
  | sequential f g ihf ihg =>
      change F.map (ofRaw f ≫q ofRaw g) =
        A.algebra.sequential
          (FreeSMC.fold A.algebra f) (FreeSMC.fold A.algebra g)
      rw [F.map_sequential, ihf, ihg]
  | tensor f g ihf ihg =>
      change F.map (ofRaw f ⊗q ofRaw g) =
        A.algebra.tensor
          (FreeSMC.fold A.algebra f) (FreeSMC.fold A.algebra g)
      rw [F.map_tensor, ihf, ihg]
  | symmetry left right =>
      exact F.map_symmetry left right
  | copy o h =>
      exact F.map_copy o h
  | discard o h =>
      exact F.map_discard o h

/-- Every strict interpretation is the quotient fold. -/
theorem Interpreter.eq_quotientInterpreter {σ : FinSignature}
    {A : LawfulAlgebra σ} (F : Interpreter A) :
    F = quotientInterpreter A := by
  apply Interpreter.ext
  intro a b q
  refine Quotient.inductionOn q ?_
  intro f
  change F.map (ofRaw f) = FreeSMC.fold A.algebra f
  exact F.map_ofRaw_eq_fold f

/--
Universal property of the SMC-equation quotient.

For every lawful identity-on-objects algebra there exists exactly one strict
symmetric-monoidal interpretation that has the prescribed values on
generators, explicit copy, and explicit discard.  Unlike
`FreeSMC.freeSMC_universal`, this theorem eliminates from the equation
quotient rather than merely recursing over raw syntax trees.
-/
theorem freeSMC_quotient_universal {σ : FinSignature}
    (A : LawfulAlgebra σ) :
    Nonempty (Interpreter A) ∧
      ∀ F G : Interpreter A, F = G := by
  constructor
  · exact ⟨quotientInterpreter A⟩
  · intro F G
    exact F.eq_quotientInterpreter.trans G.eq_quotientInterpreter.symm

/--
A coherent monoidal natural isomorphism between two identity-on-objects
interpretations.

The object components live in the interpretation algebra, naturality is
stated against every quotient arrow, and `tensor`/`unit` are the monoidal
coherence equations. This record deliberately does not identify an arbitrary
target category with the word-indexed algebra; it is the up-to-isomorphism
form of the strict universal property proved above.
-/
structure CoherentMonoidalIso {σ : FinSignature}
    {A : LawfulAlgebra σ} (F G : Interpreter A) where
  hom : ∀ object : Word σ, A.algebra.Carrier object object
  inv : ∀ object : Word σ, A.algebra.Carrier object object
  hom_inv :
    ∀ object,
      A.algebra.sequential (hom object) (inv object) =
        A.algebra.identity object
  inv_hom :
    ∀ object,
      A.algebra.sequential (inv object) (hom object) =
        A.algebra.identity object
  natural :
    ∀ {source target : Word σ} (arrow : Hom σ source target),
      A.algebra.sequential (hom source) (G.map arrow) =
        A.algebra.sequential (F.map arrow) (hom target)
  unit : hom [] = A.algebra.identity []
  tensor :
    ∀ left right,
      hom (left ++ right) =
        A.algebra.tensor (hom left) (hom right)

/-- Identity components form a coherent monoidal natural isomorphism. -/
def CoherentMonoidalIso.identity {σ : FinSignature}
    {A : LawfulAlgebra σ} (F : Interpreter A) :
    CoherentMonoidalIso F F where
  hom := A.algebra.identity
  inv := A.algebra.identity
  hom_inv := by
    intro object
    exact A.laws.id_comp (A.algebra.identity object)
  inv_hom := by
    intro object
    exact A.laws.id_comp (A.algebra.identity object)
  natural := by
    intro source target arrow
    exact
      (A.laws.id_comp (F.map arrow)).trans
        (A.laws.comp_id (F.map arrow)).symm
  unit := rfl
  tensor := by
    intro left right
    exact (A.laws.tensor_id left right).symm

/--
Existence and uniqueness up to coherent monoidal natural isomorphism.

For the strict identity-on-objects interpretation class, the preceding
theorem actually proves equality. Transporting along that equality supplies
the categorically conventional, weaker uniqueness statement without
postulating an isomorphism.
-/
theorem freeSMC_quotient_universal_up_to_iso {σ : FinSignature}
    (A : LawfulAlgebra σ) :
    Nonempty (Interpreter A) ∧
      ∀ F G : Interpreter A, Nonempty (CoherentMonoidalIso F G) := by
  constructor
  · exact ⟨quotientInterpreter A⟩
  · intro F G
    have equality : F = G :=
      F.eq_quotientInterpreter.trans G.eq_quotientInterpreter.symm
    subst G
    exact ⟨CoherentMonoidalIso.identity F⟩

/-- The raw universal map is the quotient universal map precomposed with `ofRaw`. -/
theorem quotient_interpretation_factors_raw_fold {σ : FinSignature}
    (A : LawfulAlgebra σ) {a b : Word σ} (f : Raw σ a b) :
    (quotientInterpreter A).map (ofRaw f) =
      (FreeSMC.foldInterpreter A.algebra).map f :=
  rfl

/-- The quotient itself, regarded as an algebra for the raw syntax. -/
def quotientAlgebra (σ : FinSignature) : FreeSMC.Algebra σ where
  Carrier := Hom σ
  identity := id σ
  generator := fun g => ofRaw (.generator g)
  sequential := comp
  tensor := tensor
  symmetry := symmetry σ
  copy := fun o h => ofRaw (.copy o h)
  discard := fun o h => ofRaw (.discard o h)

/-- Folding into the quotient is exactly insertion of the original raw term. -/
theorem quotientFold_eq_ofRaw {σ : FinSignature} {a b : Word σ}
    (f : Raw σ a b) :
    FreeSMC.fold (quotientAlgebra σ) f = ofRaw f := by
  induction f with
  | identity ports => rfl
  | generator g => rfl
  | sequential f g ihf ihg =>
      change
        FreeSMC.fold (quotientAlgebra σ) f ≫q
            FreeSMC.fold (quotientAlgebra σ) g =
          ofRaw (f ≫ₛ g)
      rw [ihf, ihg, ofRaw_comp]
  | tensor f g ihf ihg =>
      change
        FreeSMC.fold (quotientAlgebra σ) f ⊗q
            FreeSMC.fold (quotientAlgebra σ) g =
          ofRaw (f ⊗ₛ g)
      rw [ihf, ihg, ofRaw_tensor]
  | symmetry left right => rfl
  | copy o h => rfl
  | discard o h => rfl

/-- Every generated equation is valid for the quotient's own fold. -/
theorem quotientFold_sound {σ : FinSignature} {a b : Word σ}
    {f g : Raw σ a b} (h : Congruent σ f g) :
    FreeSMC.fold (quotientAlgebra σ) f =
      FreeSMC.fold (quotientAlgebra σ) g :=
  (quotientFold_eq_ofRaw f).trans
    ((sound h).trans (quotientFold_eq_ofRaw g).symm)

/--
All internal category, tensor, associator, unitor, braiding, pentagon,
triangle, and hexagon checks for the quotient, bundled as a lawful algebra.
This is the project's self-contained symmetric-monoidal-category witness.
-/
def freeSymmetricMonoidalCategory (σ : FinSignature) : LawfulAlgebra σ where
  algebra := quotientAlgebra σ
  laws := by
    constructor
    · intro a b f
      exact id_comp f
    · intro a b f
      exact comp_id f
    · intro a b c d f g h
      exact comp_assoc f g h
    · intro a b
      exact tensor_id a b
    · intro a b c d e f p q r s
      exact tensor_comp p q r s
    · intro a b c a' b' c' f g h
      change
        ((f ⊗q g) ⊗q h) ≫q
            FreeSMC.fold (quotientAlgebra σ)
              (associatorRaw σ a' b' c') =
          FreeSMC.fold (quotientAlgebra σ)
              (associatorRaw σ a b c) ≫q
            (f ⊗q (g ⊗q h))
      rw [quotientFold_eq_ofRaw, quotientFold_eq_ofRaw]
      exact associator_natural f g h
    · intro a b f
      change
        (id σ [] ⊗q f) ≫q leftUnitor σ b =
          leftUnitor σ a ≫q f
      exact left_unitor_natural f
    · intro a b f
      change
        (f ⊗q id σ []) ≫q
            FreeSMC.fold (quotientAlgebra σ)
              (rightUnitorRaw σ b) =
          FreeSMC.fold (quotientAlgebra σ)
              (rightUnitorRaw σ a) ≫q f
      rw [quotientFold_eq_ofRaw, quotientFold_eq_ofRaw]
      exact right_unitor_natural f
    · intro a b c d f g
      exact symmetry_natural f g
    · intro a b c
      exact quotientFold_sound (Congruent.associator_hom_inv a b c)
    · intro a b c
      exact quotientFold_sound (Congruent.associator_inv_hom a b c)
    · intro a
      exact quotientFold_sound (Congruent.left_unitor_hom_inv a)
    · intro a
      exact quotientFold_sound (Congruent.left_unitor_inv_hom a)
    · intro a
      exact quotientFold_sound (Congruent.right_unitor_hom_inv a)
    · intro a
      exact quotientFold_sound (Congruent.right_unitor_inv_hom a)
    · intro a b
      exact quotientFold_sound (Congruent.symmetry_involutive a b)
    · intro a b c d
      exact quotientFold_sound (Congruent.pentagon a b c d)
    · intro a b
      exact quotientFold_sound (Congruent.triangle a b)
    · intro a b c
      exact quotientFold_sound (Congruent.hexagon a b c)

end FreeSMCQuotient
end Cantilune.Core
