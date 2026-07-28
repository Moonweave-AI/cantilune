import Cantilune.Pi.FMSFullAbstractionTransfer

namespace Cantilune.Tests.FMSFullAbstractionTransfer

open Cantilune.Pi
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSFullAbstractionTransfer

/--
Regression: the package exposes the open, all-substitutions theorem required
for late congruence, not only the closed world-zero theorem.
-/
example (package : CompleteExternalFMSTheoremPackage)
    {world : Nat} (left right : SupportedProc world 0) :
    SupportedLateCongruent left right ↔
      OpenDenotationallyEqual package.restriction left right :=
  CompleteExternalFMSTheoremPackage.supported_open_full_abstraction
    package left right

example (package : CompleteExternalFMSTheoremPackage) (world : Nat) :
    Equivalence
      (fun left right : SupportedProc world 0 =>
        SupportedLateCongruent left right) :=
  CompleteExternalFMSTheoremPackage.supportedLateCongruent_equivalence
    package world

example (available : CompleteFMSAvailable)
    {world : Nat} (left right : SupportedProc world 0) :
    ∃ package : CompleteExternalFMSTheoremPackage,
      SupportedLateCongruent left right ↔
        OpenDenotationallyEqual package.restriction left right :=
  complete_fms_available_open_full_abstraction available left right

/--
Regression: canonical supported syntax inherits the exact strong late
full-abstraction equivalence, rather than only one direction.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (left right : SupportedProc 0 0) :
    StrongLateBisimilar
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed left).1
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed right).1 ↔
      package.restriction.denote.app 0 left =
        package.restriction.denote.app 0 right :=
  CompleteExternalFMSTheoremPackage.supported_full_abstraction
    package left right

/--
Regression: arbitrary nominally closed processes are compared through their
actual supported encodings.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (left right : ClosedRaw) :
    StrongLateBisimilar left.1 right.1 ↔
      package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed left) =
        package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed right) :=
  CompleteExternalFMSTheoremPackage.encoded_closed_full_abstraction
    package left right

/--
Regression: encode followed by canonical reification preserves and reflects
the operational equivalence used by full abstraction.
-/
example (package : CompleteExternalFMSTheoremPackage)
    (left right : ClosedRaw) :
    StrongLateBisimilar
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed
            (package.operationalDenotation.encodeClosed left)).1
          (FMSOperationalSyntaxBridge.SupportedProc.reifyClosed
            (package.operationalDenotation.encodeClosed right)).1 ↔
      StrongLateBisimilar left.1 right.1 :=
  CompleteExternalFMSTheoremPackage.reify_encode_bisimilarity_iff
    package left right

example (package : CompleteExternalFMSTheoremPackage) :
    Equivalence
      (fun left right : ClosedRaw =>
        StrongLateBisimilar left.1 right.1) :=
  CompleteExternalFMSTheoremPackage.closed_strongLateBisimilar_equivalence
    package

/--
Regression: native-step completeness is stated at the supported denotation,
but still returns an actual closed raw late-pi derivation.
-/
example (package : CompleteExternalFMSTheoremPackage)
    {source : ClosedRaw} {action : Raw.Action}
    {target : package.domain.agent.obj 0}
    (transition :
      package.lateFullAbstraction.transition
        (package.restriction.denote.app 0
          (package.operationalDenotation.encodeClosed source))
        action target) :
    ∃ rawTarget : ClosedRaw,
      ClosedLateStep source action rawTarget ∧
        package.restriction.denote.app 0
            (package.operationalDenotation.encodeClosed rawTarget) =
          target :=
  CompleteExternalFMSTheoremPackage.encoded_native_step_complete
    package transition

end Cantilune.Tests.FMSFullAbstractionTransfer
