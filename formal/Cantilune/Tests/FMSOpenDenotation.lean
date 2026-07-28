import Cantilune.Pi.FMSOpenDenotation

/-!
# Regression checks for genuine open FMS natural transformations
-/

namespace Cantilune.Tests.FMSOpenDenotation

open CategoryTheory
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSOpenDenotation

example (arity : Nat) :
    World ⥤ ωCPO :=
  valuationCpoModel arity

example {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    (adequate : AdequateHiding solution)
    {arity : Nat} (process : SupportedProc arity 0) :
    valuationCpoModel arity ⟶ solution.agent :=
  openDenotation adequate process

example {power : CpoPowerdomainPackage}
    {solution : AgentDomainSolution power}
    (adequate : AdequateHiding solution)
    {arity : Nat} (left right : SupportedProc arity 0) :
    OpenDenotationallyEqual adequate left right ↔
      openDenotation adequate left = openDenotation adequate right :=
  openDenotationallyEqual_iff adequate left right

end Cantilune.Tests.FMSOpenDenotation
