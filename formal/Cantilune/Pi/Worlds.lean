import Mathlib

/-!
# Covariant finite-injection worlds

This file gives a small, dependency-light presentation of the indexing
category used by the set-valued FMS route.  Objects are finite ordinals and
arrows are injections.  `IModel` is therefore the data of a covariant functor
from that category to types.

The construction below establishes the pointwise terminal object and product
at the level needed by later interpretations.  It deliberately does not claim
the CPO/powerdomain/full-abstraction results of Fiore--Moggi--Sangiorgi.
-/

namespace Cantilune.Pi.Worlds

/-- An arrow between finite-ordinal worlds. -/
structure Injection (source target : Nat) where
  toFun : Fin source → Fin target
  injective : Function.Injective toFun

instance {source target : Nat} :
    CoeFun (Injection source target) (fun _ => Fin source → Fin target) :=
  ⟨Injection.toFun⟩

namespace Injection

@[ext]
theorem ext {source target : Nat} {left right : Injection source target}
    (same : ∀ value, left value = right value) :
    left = right := by
  cases left with
  | mk leftFun leftInjective =>
      cases right with
      | mk rightFun rightInjective =>
          congr 1
          funext value
          exact same value

/-- Identity injection. -/
def identity (world : Nat) : Injection world world where
  toFun := id
  injective := Function.injective_id

/-- Covariant composition, written in diagrammatic order. -/
def comp {first second third : Nat}
    (left : Injection first second)
    (right : Injection second third) :
    Injection first third where
  toFun := right ∘ left
  injective := right.injective.comp left.injective

@[simp]
theorem identity_apply {world : Nat} (value : Fin world) :
    identity world value = value :=
  rfl

@[simp]
theorem comp_apply {first second third : Nat}
    (left : Injection first second)
    (right : Injection second third)
    (value : Fin first) :
    left.comp right value = right (left value) :=
  rfl

@[simp]
theorem identity_comp {source target : Nat}
    (inj : Injection source target) :
    (identity source).comp inj = inj := by
  ext value
  rfl

@[simp]
theorem comp_identity {source target : Nat}
    (inj : Injection source target) :
    inj.comp (identity target) = inj := by
  ext value
  rfl

@[simp]
theorem comp_assoc {a b c d : Nat}
    (first : Injection a b)
    (second : Injection b c)
    (third : Injection c d) :
    (first.comp second).comp third =
      first.comp (second.comp third) := by
  ext value
  rfl

end Injection

/-- A covariant set-valued model over finite-injection worlds. -/
structure IModel where
  obj : Nat → Type
  map :
    {source target : Nat} →
      Injection source target → obj source → obj target
  map_identity :
    ∀ world value, map (Injection.identity world) value = value
  map_then :
    ∀ {first second third}
      (left : Injection first second)
      (right : Injection second third)
      (value : obj first),
      map (left.comp right) value = map right (map left value)

namespace IModel

/-- Natural transformations are the arrows of the model category. -/
structure Hom (source target : IModel) where
  app : ∀ world, source.obj world → target.obj world
  natural :
    ∀ {first second} (inj : Injection first second)
      (value : source.obj first),
      target.map inj (app first value) =
        app second (source.map inj value)

namespace Hom

def identity (model : IModel) : Hom model model where
  app := fun _ value => value
  natural := by
    intros
    rfl

def comp {first second third : IModel}
    (left : Hom first second) (right : Hom second third) :
    Hom first third where
  app := fun world value => right.app world (left.app world value)
  natural := by
    intro source target inj value
    rw [right.natural, left.natural]

end Hom

/-- The pointwise terminal model. -/
def terminal : IModel where
  obj := fun _ => PUnit
  map := fun _ _ => PUnit.unit
  map_identity := by
    intro world value
    cases value
    rfl
  map_then := by
    intro first second third left right value
    cases value
    rfl

/-- Pointwise cartesian product of two covariant models. -/
def product (left right : IModel) : IModel where
  obj := fun world => left.obj world × right.obj world
  map := fun inj value =>
    (left.map inj value.1, right.map inj value.2)
  map_identity := by
    intro world value
    apply Prod.ext
    · exact left.map_identity world value.1
    · exact right.map_identity world value.2
  map_then := by
    intro first second third before after value
    apply Prod.ext
    · exact left.map_then before after value.1
    · exact right.map_then before after value.2

/-- Unique pointwise arrow into the terminal model. -/
def terminate (model : IModel) : Hom model terminal where
  app := fun _ _ => PUnit.unit
  natural := by
    intros
    rfl

/-- First pointwise projection. -/
def firstProjection (left right : IModel) :
    Hom (product left right) left where
  app := fun _ value => value.1
  natural := by
    intros
    rfl

/-- Second pointwise projection. -/
def secondProjection (left right : IModel) :
    Hom (product left right) right where
  app := fun _ value => value.2
  natural := by
    intros
    rfl

/-- Pointwise pairing of two natural transformations. -/
def pair {source left right : IModel}
    (first : Hom source left) (second : Hom source right) :
    Hom source (product left right) where
  app := fun world value =>
    (first.app world value, second.app world value)
  natural := by
    intro before after inj value
    apply Prod.ext
    · exact first.natural inj value
    · exact second.natural inj value

@[simp]
theorem firstProjection_pair {source left right : IModel}
    (first : Hom source left) (second : Hom source right)
    (world : Nat) (value : source.obj world) :
    (firstProjection left right).app world
        ((pair first second).app world value) =
      first.app world value :=
  rfl

@[simp]
theorem secondProjection_pair {source left right : IModel}
    (first : Hom source left) (second : Hom source right)
    (world : Nat) (value : source.obj world) :
    (secondProjection left right).app world
        ((pair first second).app world value) =
      second.app world value :=
  rfl

/--
The algebraic operations carried by the distinguished agent object.  In
particular `parallel` has domain `agent × agent`; it is not the tensor
bifunctor of the surrounding model category.
-/
structure AgentAlgebra where
  agent : IModel
  inactive : Hom terminal agent
  parallel : Hom (product agent agent) agent

def parallel_is_internal (algebra : AgentAlgebra) :
    Hom (product algebra.agent algebra.agent) algebra.agent :=
  algebra.parallel

end IModel

end Cantilune.Pi.Worlds
