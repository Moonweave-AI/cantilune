import Cantilune.Pi.FMSExternalPackage

/-!
# Genuine open FMS denotations as `ωCPO^I` morphisms

For a supported process with `k` free names, the FMS open interpretation is
not merely a meta-level quantification over valuations.  It is a continuous
natural transformation

`N^k ⟶ A`.

Here `N^k(n) = Fin k → Fin n` carries equality order, so every valuation map
is continuous.  Naturality follows from the supplied world-natural closed
denotation and capture-free composition of `renameFree`.
-/

noncomputable section

namespace Cantilune.Pi.FMSOpenDenotation

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSExternalPackage
open OmegaCompletePartialOrder

/-- Equality-ordered finite valuations, the CPO-valued name power `N^arity`. -/
def valuationCpoModel (arity : Nat) : World ⥤ ωCPO where
  obj target :=
    ωCPO.of (EqualityOrder (Fin arity → Fin target))
  map injection :=
    EqualityOrder.continuous fun valuation name =>
      homToFun injection (valuation name)
  map_id world := by
    apply ContinuousHom.ext
    intro valuation
    rfl
  map_comp first second := by
    apply ContinuousHom.ext
    intro valuation
    rfl

/--
The actual continuous natural open denotation of one supported process.
-/
def openDenotation
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    (adequate : AdequateHiding solution)
    {arity : Nat}
    (process : SupportedProc arity 0) :
    valuationCpoModel arity ⟶ solution.agent where
  app target :=
    EqualityOrder.continuousTo fun valuation =>
      adequate.denote.app target
        (SupportedProc.renameFree valuation process)
  naturality := by
    intro source target injection
    apply ContinuousHom.ext
    intro valuation
    change
      adequate.denote.app target
          (SupportedProc.renameFree
            (homToFun injection ∘ valuation) process) =
        solution.agent.map injection
          (adequate.denote.app source
            (SupportedProc.renameFree valuation process))
    have natural :=
      congrArg
        (fun morphism =>
          morphism (SupportedProc.renameFree valuation process))
        (adequate.denote.naturality injection)
    change
      adequate.denote.app target
          (SupportedProc.renameFree (homToFun injection)
            (SupportedProc.renameFree valuation process)) =
        solution.agent.map injection
          (adequate.denote.app source
            (SupportedProc.renameFree valuation process))
      at natural
    simpa only [SupportedProc.renameFree_comp] using
      natural

@[simp] theorem openDenotation_app
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    (adequate : AdequateHiding solution)
    {arity target : Nat}
    (process : SupportedProc arity 0)
    (valuation : Fin arity → Fin target) :
    (openDenotation adequate process).app target valuation =
      adequate.denote.app target
        (SupportedProc.renameFree valuation process) :=
  rfl

/--
The earlier pointwise valuation predicate is exactly equality of the genuine
open natural transformations.
-/
theorem openDenotationallyEqual_iff
    {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    (adequate : AdequateHiding solution)
    {arity : Nat}
    (left right : SupportedProc arity 0) :
    OpenDenotationallyEqual adequate left right ↔
      openDenotation adequate left = openDenotation adequate right := by
  constructor
  · intro equal
    apply NatTrans.ext
    funext target
    apply ContinuousHom.ext
    intro valuation
    exact equal target valuation
  · intro equal target valuation
    have component :=
      congrArg
        (fun transformation =>
          transformation.app target valuation) equal
    exact component

end Cantilune.Pi.FMSOpenDenotation
