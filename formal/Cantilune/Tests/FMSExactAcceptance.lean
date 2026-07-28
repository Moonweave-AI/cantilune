import Cantilune.Pi.FMSExactAcceptance

/-!
# Exact FMS acceptance boundary regression

These checks consume only caller-supplied exact packages.  They do not
construct an Abramsky powerdomain, a domain-equation solution, or an
inhabitant of `ExactFMSAvailable`.
-/

open Cantilune.Pi
open Cantilune.Pi.FMSExternalPackage
open Cantilune.Pi.FMSExactAcceptance

#check PowerdomainObservation
#check RestrictionActionFold
#check NaturalBinaryOperation
#check CanSynchronize
#check ParallelConstruction
#check StageTransition
#check ExactFMSAcceptancePackage
#check ExactFMSAvailable
#check ExactFMSAcceptancePackage.transition_iff_unrolled_stage
#check ExactFMSAcceptancePackage.parallel_is_four_way_choice
