import Cantilune.Pi.FMSGuardedContextualComposition

namespace Cantilune.Tests.FMSGuardedContextualComposition

open Cantilune.Pi
open Cantilune.Pi.FMSGuardedContextualHoare
open Cantilune.Pi.FMSGuardedContextualComposition

#check Context.comp_hole_right
#check Context.hole_comp
#check Context.comp_assoc
#check precomposeHom
#check precompose_omegaScottContinuous
#check precomposeHom_hole
#check precomposeHom_comp
#check precomposeHom_assoc
#check contextualDenote_fill
#check contextualDenote_fill_comp
#check contextualDenote_par_left
#check contextualDenote_par_right
#check contextualDenote_choice_left
#check contextualDenote_choice_right
#check contextualDenote_hide
#check contextualDenote_restriction
#check contextualDenote_repTau
#check contextualDenote_repSend
#check contextualDenote_repRecv
#check hideSemantic_comp
#check parLeftSemantic_comp_hide
#check parRightSemantic_comp_hide
#check choiceLeftSemantic_comp_hide
#check choiceRightSemantic_comp_hide
#check repTauSemantic_comp_hide
#check repSendSemantic_comp_hide
#check repRecvSemantic_comp_hide
#check ContextualHidingCoherenceAcceptance
#check contextualHidingCoherenceAccepted

def testProcess : RecursiveProc :=
  .send 3 5 (.recv 7 11 .zero)

def testFrame : Context :=
  .new 13
    (.parLeft .hole
      (.recv 17 19 (.send 23 19 .zero)))

example :
    contextualDenote (testFrame.fill testProcess) =
      precomposeHom testFrame
        (contextualDenote testProcess) :=
  contextualDenote_fill _ _

example :
    contextualDenote
        (.par testProcess (.tau .zero)) =
      parLeftSemantic (.tau .zero)
        (contextualDenote testProcess) :=
  contextualDenote_par_left _ _

example :
    contextualDenote
        (.new 29 (.repTau testProcess)) =
      hideSemantic 29
        (repTauSemantic
          (contextualDenote testProcess)) := by
  rw [contextualDenote_hide, contextualDenote_repTau]

#print axioms Context.comp_assoc
#print axioms precomposeHom_comp
#print axioms contextualDenote_fill
#print axioms contextualDenote_par_left
#print axioms contextualDenote_hide
#print axioms contextualDenote_repTau
#print axioms hideSemantic_comp
#print axioms contextualHidingCoherenceAccepted

end Cantilune.Tests.FMSGuardedContextualComposition
