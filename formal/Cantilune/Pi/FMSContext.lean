import Cantilune.Pi.FMSModel
import Mathlib.Data.Finset.Image

/-!
# Supported, locally nameless finite-control processes

The FMS world action cannot be defined correctly on raw processes whose names
are unscoped natural numbers: a process at world `n` must expose which names
belong to `Fin n`, and restriction/input binders must not be affected by a
renaming of those free names.

This module supplies that missing syntax.  Free names are `Fin free`; bound
names are locally nameless `Fin bound`.  Every finite-world injection acts
only on the free summand.  The resulting process family is a genuine
covariant functor `I ⥤ Type`, and its finite support is a natural
transformation.  The final natural transformation into `setAgent` is a
concrete support denotation, not a claim of FMS full abstraction.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSContext

open CategoryTheory
open Cantilune.Pi.FMSModel

/-- A name is either free in the current finite world or locally bound. -/
inductive ScopedName (free bound : Nat) where
  | free (name : Fin free)
  | bound (index : Fin bound)
deriving DecidableEq

namespace ScopedName

/-- Rename only free names; locally bound indices remain unchanged. -/
def renameFree (rename : Fin source → Fin target) :
    ScopedName source boundCount → ScopedName target boundCount
  | .free name => .free (rename name)
  | .bound index => .bound index

@[simp]
theorem renameFree_free (rename : Fin source → Fin target)
    (name : Fin source) :
    renameFree rename (.free name : ScopedName source boundCount) =
      .free (rename name) :=
  rfl

@[simp]
theorem renameFree_bound (rename : Fin source → Fin target)
    (index : Fin boundCount) :
    renameFree rename (.bound index : ScopedName source boundCount) =
      .bound index :=
  rfl

@[simp]
theorem renameFree_id (name : ScopedName freeCount boundCount) :
    renameFree id name = name := by
  cases name <;> rfl

theorem renameFree_comp (first : Fin source → Fin middle)
    (second : Fin middle → Fin target)
    (name : ScopedName source boundCount) :
    renameFree second (renameFree first name) =
      renameFree (second ∘ first) name := by
  cases name <;> rfl

/-- The singleton/empty free support of a scoped name. -/
def freeSupport : ScopedName freeCount boundCount → Finset (Fin freeCount)
  | .free name => {name}
  | .bound _ => ∅

@[simp]
theorem freeSupport_renameFree (rename : Fin source → Fin target)
    (name : ScopedName source boundCount) :
    freeSupport (renameFree rename name) =
      (freeSupport name).image rename := by
  cases name <;> simp [freeSupport]

end ScopedName

/--
Finite-control π syntax with locally nameless input and restriction binders.
There is intentionally no recursion or replication.
-/
inductive SupportedProc (free : Nat) : Nat → Type where
  | zero {bound : Nat} : SupportedProc free bound
  | tau {bound : Nat} (next : SupportedProc free bound) :
      SupportedProc free bound
  | input {bound : Nat}
      (channel : ScopedName free bound)
      (body : SupportedProc free (bound + 1)) :
      SupportedProc free bound
  | output {bound : Nat}
      (channel value : ScopedName free bound)
      (next : SupportedProc free bound) :
      SupportedProc free bound
  | choice {bound : Nat}
      (left right : SupportedProc free bound) :
      SupportedProc free bound
  | parallel {bound : Nat}
      (left right : SupportedProc free bound) :
      SupportedProc free bound
  | restrict {bound : Nat}
      (body : SupportedProc free (bound + 1)) :
      SupportedProc free bound
  | matchEq {bound : Nat}
      (left right : ScopedName free bound)
      (next : SupportedProc free bound) :
      SupportedProc free bound
  | matchNe {bound : Nat}
      (left right : ScopedName free bound)
      (next : SupportedProc free bound) :
      SupportedProc free bound
deriving DecidableEq

namespace SupportedProc

/-- Covariant renaming of all and only free names. -/
def renameFree (rename : Fin source → Fin target) :
    SupportedProc source boundCount → SupportedProc target boundCount
  | .zero => .zero
  | .tau next => .tau (renameFree rename next)
  | .input channel body =>
      .input (channel.renameFree rename) (renameFree rename body)
  | .output channel value next =>
      .output (channel.renameFree rename) (value.renameFree rename)
        (renameFree rename next)
  | .choice left right =>
      .choice (renameFree rename left) (renameFree rename right)
  | .parallel left right =>
      .parallel (renameFree rename left) (renameFree rename right)
  | .restrict body => .restrict (renameFree rename body)
  | .matchEq left right next =>
      .matchEq (left.renameFree rename) (right.renameFree rename)
        (renameFree rename next)
  | .matchNe left right next =>
      .matchNe (left.renameFree rename) (right.renameFree rename)
        (renameFree rename next)

@[simp]
theorem renameFree_id (process : SupportedProc freeCount boundCount) :
    renameFree id process = process := by
  induction process <;>
    simp [renameFree, ScopedName.renameFree_id, *]

theorem renameFree_comp (first : Fin source → Fin middle)
    (second : Fin middle → Fin target)
    (process : SupportedProc source boundCount) :
    renameFree second (renameFree first process) =
      renameFree (second ∘ first) process := by
  induction process <;>
    simp [renameFree, ScopedName.renameFree_comp, *]

/-- All free names used by a finite-control process. -/
def freeSupport :
    SupportedProc freeCount boundCount → Finset (Fin freeCount)
  | .zero => ∅
  | .tau next => freeSupport next
  | .input channel body =>
      channel.freeSupport ∪ freeSupport body
  | .output channel value next =>
      channel.freeSupport ∪ value.freeSupport ∪ freeSupport next
  | .choice left right =>
      freeSupport left ∪ freeSupport right
  | .parallel left right =>
      freeSupport left ∪ freeSupport right
  | .restrict body => freeSupport body
  | .matchEq left right next =>
      left.freeSupport ∪ right.freeSupport ∪ freeSupport next
  | .matchNe left right next =>
      left.freeSupport ∪ right.freeSupport ∪ freeSupport next

/--
Support commutes exactly with arbitrary free-name renaming.  Injection is not
needed for this equation; the FMS functor later restricts to injections.
-/
@[simp]
theorem freeSupport_renameFree (rename : Fin source → Fin target)
    (process : SupportedProc source boundCount) :
    freeSupport (renameFree rename process) =
      (freeSupport process).image rename := by
  induction process <;>
    simp [renameFree, freeSupport, Finset.image_union, *]

end SupportedProc

/-! ## Genuine functors over the finite-injection category -/

/-- Supported closed terms form a covariant finite-world functor. -/
def processModel : World ⥤ Type where
  obj world := SupportedProc world 0
  map injection :=
    TypeCat.ofHom (SupportedProc.renameFree (homToFun injection))
  map_id world := by
    ext process
    exact SupportedProc.renameFree_id process
  map_comp first second := by
    ext process
    exact (SupportedProc.renameFree_comp
      (homToFun first) (homToFun second) process).symm

/-- Finite name supports form a covariant finite-world functor. -/
def finiteSupportModel : World ⥤ Type where
  obj world := Finset (Fin world)
  map injection :=
    TypeCat.ofHom (fun support => support.image (homToFun injection))
  map_id world := by
    ext support name
    simp
  map_comp first second := by
    ext support name
    simp [Finset.image_image]

/--
Taking free support is natural in the finite world.  This is the core
supported-process renaming theorem required before an FMS denotation can even
be stated naturally.
-/
def finiteSupportNatural : processModel ⟶ finiteSupportModel where
  app world := TypeCat.ofHom SupportedProc.freeSupport
  naturality := by
    intro source target injection
    ext process
    exact SupportedProc.freeSupport_renameFree
      (homToFun injection) process

/-- Coercion from finite support to set support is natural. -/
def finiteToSetNatural : finiteSupportModel ⟶ setAgent where
  app world := TypeCat.ofHom (fun support : Finset (Fin world) =>
    (support : Set (Fin world)))
  naturality := by
    intro source target injection
    ext support value
    change Finset (Fin source) at support
    change
      value ∈
          support.image (homToFun injection) ↔
        ∃ sourceValue,
          sourceValue ∈ support ∧
            homToFun injection sourceValue = value
    simp

/--
Concrete natural support denotation of supported processes into the existing
nonconstant `Set^I` support object.
-/
def supportDenotation : processModel ⟶ setAgent :=
  finiteSupportNatural ≫ finiteToSetNatural

theorem supportDenotation_app (world : World)
    (process : SupportedProc world 0) :
    supportDenotation.app world process =
      (SupportedProc.freeSupport process : Set (Fin world)) :=
  rfl

end Cantilune.Pi.FMSContext
