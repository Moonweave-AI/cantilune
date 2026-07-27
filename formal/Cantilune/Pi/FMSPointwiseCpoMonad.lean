import Cantilune.Pi.FMSExternalPackage

/-!
# Pointwise lifting of a CPO monad to finite-world models

For every small index category `I`, a supplied monad on mathlib's `ωCPO`
category lifts pointwise to `I ⥤ ωCPO`.  The construction is independent of
the still-missing Abramsky powerdomain inhabitant and closes a categorical
plumbing gap in the FMS acceptance interface.
-/

noncomputable section

namespace Cantilune.Pi.FMSPointwiseCpoMonad

open CategoryTheory

universe u

variable {I : Type u} [Category I]

/-- Postcompose every world model and natural transformation with a monad. -/
def pointwiseFunctor (base : CategoryTheory.Monad ωCPO) :
    (I ⥤ ωCPO) ⥤ (I ⥤ ωCPO) where
  obj model := model ⋙ base.toFunctor
  map transformation :=
    Functor.whiskerRight transformation base.toFunctor
  map_id model := by
    exact NatTrans.ext (funext fun object =>
      base.toFunctor.map_id (model.obj object))
  map_comp first second := by
    exact NatTrans.ext (funext fun object =>
      base.toFunctor.map_comp
        (first.app object) (second.app object))

/-- Pointwise monad unit. -/
def pointwiseUnit (base : CategoryTheory.Monad ωCPO) :
    𝟭 (I ⥤ ωCPO) ⟶ pointwiseFunctor (I := I) base where
  app model := Functor.whiskerLeft model base.η
  naturality := by
    intro source target transformation
    exact NatTrans.ext (funext fun object =>
      base.η.naturality (transformation.app object))

/-- Pointwise monad multiplication. -/
def pointwiseMultiplication (base : CategoryTheory.Monad ωCPO) :
    pointwiseFunctor (I := I) base ⋙ pointwiseFunctor (I := I) base ⟶
      pointwiseFunctor (I := I) base where
  app model := Functor.whiskerLeft model base.μ
  naturality := by
    intro source target transformation
    exact NatTrans.ext (funext fun object =>
      base.μ.naturality (transformation.app object))

/-- The actual pointwise monad on `ωCPO`-valued world models. -/
def pointwiseCpoMonad (base : CategoryTheory.Monad ωCPO) :
    CategoryTheory.Monad (I ⥤ ωCPO) where
  toFunctor := pointwiseFunctor (I := I) base
  η := pointwiseUnit (I := I) base
  μ := pointwiseMultiplication (I := I) base
  assoc model := by
    exact NatTrans.ext (funext fun object =>
      base.assoc (model.obj object))
  left_unit model := by
    exact NatTrans.ext (funext fun object =>
      base.left_unit (model.obj object))
  right_unit model := by
    exact NatTrans.ext (funext fun object =>
      base.right_unit (model.obj object))

@[simp]
theorem pointwise_unit_app
    (base : CategoryTheory.Monad ωCPO)
    (model : I ⥤ ωCPO) (object : I) :
    ((pointwiseCpoMonad (I := I) base).η.app model).app object =
      base.η.app (model.obj object) :=
  rfl

@[simp]
theorem pointwise_multiplication_app
    (base : CategoryTheory.Monad ωCPO)
    (model : I ⥤ ωCPO) (object : I) :
    ((pointwiseCpoMonad (I := I) base).μ.app model).app object =
      base.μ.app (model.obj object) :=
  rfl

end Cantilune.Pi.FMSPointwiseCpoMonad
