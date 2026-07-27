import Mathlib
import Cantilune.Core.Signature

/-!
# Typed free-SMC syntax

`FreeSMC` is the raw, intrinsically typed diagram syntax.  It is intentionally
not advertised as a completed quotient by the SMC equations: that quotient and
its categorical universal property are separate proof obligations.  The
syntax nevertheless makes every generator, sequential/parallel composition,
symmetry, copy, and discard operation explicit.
-/

namespace Cantilune.Core

/--
Raw intrinsically typed string-diagram syntax over a finite signature.

Copying and discarding require evidence from the declared structural mode, so
linear resources and channels cannot be duplicated or dropped implicitly.
-/
inductive FreeSMC (σ : FinSignature) :
    List σ.Obj → List σ.Obj → Type
  | identity (ports : List σ.Obj) : FreeSMC σ ports ports
  | generator (g : σ.Gen) : FreeSMC σ (σ.input g) (σ.output g)
  | sequential {a b c : List σ.Obj} :
      FreeSMC σ a b → FreeSMC σ b c → FreeSMC σ a c
  | tensor {a b c d : List σ.Obj} :
      FreeSMC σ a b → FreeSMC σ c d →
      FreeSMC σ (a ++ c) (b ++ d)
  | symmetry (left right : List σ.Obj) :
      FreeSMC σ (left ++ right) (right ++ left)
  | copy (o : σ.Obj) (allowed : (σ.mode o).AllowsCopy) :
      FreeSMC σ [o] [o, o]
  | discard (o : σ.Obj) (allowed : (σ.mode o).AllowsDrop) :
      FreeSMC σ [o] []

namespace FreeSMC

infixr:90 " ≫ₛ " => FreeSMC.sequential
infixr:80 " ⊗ₛ " => FreeSMC.tensor

/-- Number of primitive and structural nodes in a raw diagram. -/
def size {σ : FinSignature} {a b : List σ.Obj} :
    FreeSMC σ a b → Nat
  | .identity _ => 0
  | .generator _ => 1
  | .sequential f g => f.size + g.size
  | .tensor f g => f.size + g.size
  | .symmetry _ _ => 1
  | .copy _ _ => 1
  | .discard _ _ => 1

/-- Number of explicitly requested copy nodes. -/
def copyCount {σ : FinSignature} {a b : List σ.Obj} :
    FreeSMC σ a b → Nat
  | .identity _ => 0
  | .generator _ => 0
  | .sequential f g => f.copyCount + g.copyCount
  | .tensor f g => f.copyCount + g.copyCount
  | .symmetry _ _ => 0
  | .copy _ _ => 1
  | .discard _ _ => 0

/-- Number of explicitly requested discard nodes. -/
def discardCount {σ : FinSignature} {a b : List σ.Obj} :
    FreeSMC σ a b → Nat
  | .identity _ => 0
  | .generator _ => 0
  | .sequential f g => f.discardCount + g.discardCount
  | .tensor f g => f.discardCount + g.discardCount
  | .symmetry _ _ => 0
  | .copy _ _ => 0
  | .discard _ _ => 1

@[simp] theorem size_identity {σ : FinSignature} (ports : List σ.Obj) :
    (FreeSMC.identity ports).size = 0 := rfl

@[simp] theorem size_generator {σ : FinSignature} (g : σ.Gen) :
    (FreeSMC.generator g).size = 1 := rfl

@[simp] theorem size_sequential {σ : FinSignature}
    {a b c : List σ.Obj} (f : FreeSMC σ a b) (g : FreeSMC σ b c) :
    (f ≫ₛ g).size = f.size + g.size := rfl

@[simp] theorem size_tensor {σ : FinSignature}
    {a b c d : List σ.Obj} (f : FreeSMC σ a b) (g : FreeSMC σ c d) :
    (f ⊗ₛ g).size = f.size + g.size := rfl

@[simp] theorem copyCount_copy {σ : FinSignature} (o : σ.Obj)
    (h : (σ.mode o).AllowsCopy) :
    (FreeSMC.copy o h).copyCount = 1 := rfl

@[simp] theorem discardCount_discard {σ : FinSignature} (o : σ.Obj)
    (h : (σ.mode o).AllowsDrop) :
    (FreeSMC.discard o h).discardCount = 1 := rfl

/--
An eliminator into dependent semantic carriers.  It exposes precisely the
operations a later quotient/interpretation must assign; no equations are
silently assumed by the raw syntax.
-/
structure Algebra (σ : FinSignature) where
  Carrier : List σ.Obj → List σ.Obj → Type
  identity : (ports : List σ.Obj) → Carrier ports ports
  generator : (g : σ.Gen) → Carrier (σ.input g) (σ.output g)
  sequential :
    {a b c : List σ.Obj} → Carrier a b → Carrier b c → Carrier a c
  tensor :
    {a b c d : List σ.Obj} → Carrier a b → Carrier c d →
      Carrier (a ++ c) (b ++ d)
  symmetry :
    (left right : List σ.Obj) →
      Carrier (left ++ right) (right ++ left)
  copy :
    (o : σ.Obj) → (σ.mode o).AllowsCopy → Carrier [o] [o, o]
  discard :
    (o : σ.Obj) → (σ.mode o).AllowsDrop → Carrier [o] []

/-- Structural recursion from raw diagrams into an algebra. -/
def fold {σ : FinSignature} (A : Algebra σ)
    {a b : List σ.Obj} : FreeSMC σ a b → A.Carrier a b
  | .identity ports => A.identity ports
  | .generator g => A.generator g
  | .sequential f g => A.sequential (fold A f) (fold A g)
  | .tensor f g => A.tensor (fold A f) (fold A g)
  | .symmetry left right => A.symmetry left right
  | .copy o h => A.copy o h
  | .discard o h => A.discard o h

@[simp] theorem fold_identity {σ : FinSignature} (A : Algebra σ)
    (ports : List σ.Obj) :
    fold A (FreeSMC.identity ports) = A.identity ports := rfl

@[simp] theorem fold_generator {σ : FinSignature} (A : Algebra σ)
    (g : σ.Gen) :
    fold A (FreeSMC.generator g) = A.generator g := rfl

@[simp] theorem fold_sequential {σ : FinSignature} (A : Algebra σ)
    {a b c : List σ.Obj} (f : FreeSMC σ a b) (g : FreeSMC σ b c) :
    fold A (f ≫ₛ g) = A.sequential (fold A f) (fold A g) := rfl

@[simp] theorem fold_tensor {σ : FinSignature} (A : Algebra σ)
    {a b c d : List σ.Obj} (f : FreeSMC σ a b)
    (g : FreeSMC σ c d) :
    fold A (f ⊗ₛ g) = A.tensor (fold A f) (fold A g) := rfl

/--
An interpretation of the *raw* diagram term algebra.

The preservation fields are part of the data rather than postulated equations
on `FreeSMC`.  Consequently this is the appropriate homomorphism notion for
the initial-algebra theorem below.  It is deliberately weaker than a strong
symmetric-monoidal functor out of the quotient by the SMC coherence laws.
-/
structure Interpreter {σ : FinSignature} (A : Algebra σ) where
  map : {a b : List σ.Obj} → FreeSMC σ a b → A.Carrier a b
  map_identity :
    ∀ ports, map (FreeSMC.identity ports) = A.identity ports
  map_generator :
    ∀ g, map (FreeSMC.generator g) = A.generator g
  map_sequential :
    ∀ {a b c : List σ.Obj} (f : FreeSMC σ a b) (g : FreeSMC σ b c),
      map (f ≫ₛ g) = A.sequential (map f) (map g)
  map_tensor :
    ∀ {a b c d : List σ.Obj} (f : FreeSMC σ a b)
      (g : FreeSMC σ c d),
      map (f ⊗ₛ g) = A.tensor (map f) (map g)
  map_symmetry :
    ∀ left right,
      map (FreeSMC.symmetry left right) = A.symmetry left right
  map_copy :
    ∀ o (h : (σ.mode o).AllowsCopy),
      map (FreeSMC.copy o h) = A.copy o h
  map_discard :
    ∀ o (h : (σ.mode o).AllowsDrop),
      map (FreeSMC.discard o h) = A.discard o h

/-- The structurally recursive interpretation, bundled as a raw-algebra map. -/
def foldInterpreter {σ : FinSignature} (A : Algebra σ) : Interpreter A where
  map := fold A
  map_identity := by intros; rfl
  map_generator := by intros; rfl
  map_sequential := by intros; rfl
  map_tensor := by intros; rfl
  map_symmetry := by intros; rfl
  map_copy := by intros; rfl
  map_discard := by intros; rfl

@[ext]
theorem Interpreter.ext {σ : FinSignature} {A : Algebra σ}
    {F G : Interpreter A}
    (h : ∀ {a b : List σ.Obj} (f : FreeSMC σ a b), F.map f = G.map f) :
    F = G := by
  cases F
  cases G
  simp only [Interpreter.mk.injEq]
  funext a b f
  exact h f

/-- Every operation-preserving interpretation is the structural fold. -/
theorem Interpreter.eq_fold {σ : FinSignature} {A : Algebra σ}
    (F : Interpreter A) : F = foldInterpreter A := by
  apply Interpreter.ext
  intro a b f
  induction f with
  | identity ports =>
      exact F.map_identity ports
  | generator g =>
      exact F.map_generator g
  | sequential f g ihf ihg =>
      rw [F.map_sequential, ihf, ihg]
      rfl
  | tensor f g ihf ihg =>
      rw [F.map_tensor, ihf, ihg]
      rfl
  | symmetry left right =>
      exact F.map_symmetry left right
  | copy o h =>
      exact F.map_copy o h
  | discard o h =>
      exact F.map_discard o h

/--
Initiality of the intrinsically typed *raw term algebra*.

There is an interpretation into every algebra and it is unique as an
operation-preserving dependent function.  This exact equality is stronger
than uniqueness up to isomorphism because the theorem concerns syntax trees.
It must not be cited as the still-open categorical universal property of the
SMC-equation quotient; that later theorem has uniqueness only up to coherent
monoidal natural isomorphism.
-/
theorem freeSMC_universal {σ : FinSignature} (A : Algebra σ) :
    Nonempty (Interpreter A) ∧
      ∀ F G : Interpreter A, F = G := by
  constructor
  · exact ⟨foldInterpreter A⟩
  · intro F G
    exact F.eq_fold.trans G.eq_fold.symm

end FreeSMC

end Cantilune.Core
