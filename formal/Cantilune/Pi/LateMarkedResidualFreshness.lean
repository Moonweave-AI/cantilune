import Cantilune.Pi.LateGuardedReplicationSubstitution
import Cantilune.Pi.LateMarkedIndependentExchange

/-!
# Source-fresh marked independence and residual freshness

This module closes the nominal residual premise left explicit by
`LateMarkedIndependentExchange`.  A marked derivative can only acquire free
names from its source and from the complete operational support of its event.
Consequently, disjoint event supports and the two source-side bound-name
freshness premises imply both residual freshness premises.

The result is deliberately strong-step and occurrence-sensitive.  It neither
introduces weak transitions nor permits effects with overlapping supports
(in particular, communications on the same channel) to commute.
-/

namespace Cantilune.Pi
namespace LateMarkedIndependentExchange

/-- Replacing one free name introduces at most the replacement name. -/
theorem replaceSupport_subset_union_singleton
    (names : Finset Name) (needle replacement : Name) :
    RecursiveProc.replaceSupport names needle replacement ⊆
      names ∪ {replacement} := by
  intro name member
  rw [RecursiveProc.mem_replaceSupport_iff] at member
  simp only [Finset.mem_union, Finset.mem_singleton]
  aesop

/--
The finite-control capture-avoiding substitution has the same exact support
action as its guarded-recursive embedding.
-/
theorem raw_freeNames_substituteCaptureAvoiding_eq_replaceSupport
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).freeNames =
      RecursiveProc.replaceSupport
        process.freeNames needle replacement := by
  rw [← RecursiveProc.freeNames_ofRaw
    (process.substituteCaptureAvoiding needle replacement)]
  rw [← RecursiveProc.substituteCaptureAvoiding_ofRaw]
  rw [RecursiveProc.freeNames_substituteCaptureAvoiding]
  rw [RecursiveProc.freeNames_ofRaw]

/-- Raw capture-avoiding substitution introduces at most its replacement. -/
theorem raw_substitution_freeNames_subset
    (process : Raw.Proc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).freeNames ⊆
      process.freeNames ∪ {replacement} := by
  rw [raw_freeNames_substituteCaptureAvoiding_eq_replaceSupport]
  exact replaceSupport_subset_union_singleton _ _ _

/-- Recursive capture-avoiding substitution introduces at most its replacement. -/
theorem recursive_substitution_freeNames_subset
    (process : RecursiveProc) (needle replacement : Name) :
    (process.substituteCaptureAvoiding needle replacement).freeNames ⊆
      process.freeNames ∪ {replacement} := by
  rw [RecursiveProc.freeNames_substituteCaptureAvoiding]
  exact replaceSupport_subset_union_singleton _ _ _

namespace RawNativeEvent

/-- Every name exposed by the strong-late label is retained by the mark. -/
theorem action_names_subset_support
    (event : RawNativeEvent) :
    event.action.names ⊆ event.support := by
  induction event <;>
    simp_all [action, support, Raw.Action.names, Finset.subset_iff]

end RawNativeEvent

namespace RawMarkedStep

/--
A finite-control marked derivative has no unexplained free name: every target
name was already free in the source or is carried by the full event support.
-/
theorem target_freeNames_subset_source_union_support
    (step : RawMarkedStep source action event target) :
    target.freeNames ⊆ source.freeNames ∪ event.support := by
  induction step with
  | prefixTau =>
      exact Finset.subset_union_left
  | prefixOutput =>
      intro name member
      simp [Raw.Proc.freeNames, RawNativeEvent.support, member]
  | @prefixInput channel binder next =>
      intro name member
      by_cases bound : name = binder
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, bound]
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, member, bound]
  | matchGuard step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, sourceName]
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, eventName]
  | mismatchGuard distinct step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, sourceName]
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, eventName]
  | choiceLeft step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, sourceName]
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, eventName]
  | choiceRight step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, sourceName]
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, eventName]
  | parLeft fresh step ih =>
      intro name member
      simp only [Raw.Proc.freeNames, RawNativeEvent.support,
        Finset.mem_union] at member ⊢
      rcases member with targetName | untouchedName
      · have classified := ih targetName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inl sourceName)
        · exact Or.inr eventName
      · exact Or.inl (Or.inr untouchedName)
  | parRight fresh step ih =>
      intro name member
      simp only [Raw.Proc.freeNames, RawNativeEvent.support,
        Finset.mem_union] at member ⊢
      rcases member with untouchedName | targetName
      · exact Or.inl (Or.inl untouchedName)
      · have classified := ih targetName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inr sourceName)
        · exact Or.inr eventName
  | syncLeft outputStep inputStep fresh outputIH inputIH =>
      intro name member
      simp only [Raw.Proc.freeNames, RawNativeEvent.support,
        Finset.mem_union, Finset.mem_insert] at member ⊢
      rcases member with leftName | substitutedName
      · have classified := outputIH leftName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inl sourceName)
        · aesop
      · have introduced :=
          raw_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with rightName | replacementName
        · have classified := inputIH rightName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inr sourceName)
          · aesop
        · aesop
  | syncRight inputStep outputStep fresh inputIH outputIH =>
      intro name member
      simp only [Raw.Proc.freeNames, RawNativeEvent.support,
        Finset.mem_union, Finset.mem_insert] at member ⊢
      rcases member with substitutedName | rightName
      · have introduced :=
          raw_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with leftName | replacementName
        · have classified := inputIH leftName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inl sourceName)
          · aesop
        · aesop
      · have classified := outputIH rightName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inr sourceName)
        · aesop
  | @restrict binder body action event next fresh step ih =>
      intro name member
      simp only [Raw.Proc.freeNames, RawNativeEvent.support,
        Finset.mem_union, Finset.mem_insert, Finset.mem_erase] at member ⊢
      have classified := ih member.2
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · by_cases binderName : name = binder
        · exact Or.inr (Or.inl binderName)
        · exact Or.inl ⟨binderName, sourceName⟩
      · exact Or.inr (Or.inr eventName)
  | @«open» fresh channel body outputEvent next distinct step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · by_cases freshName : name = fresh
        · simp [Raw.Proc.freeNames, RawNativeEvent.support, freshName]
        · simp [Raw.Proc.freeNames, RawNativeEvent.support, freshName,
            sourceName]
      · simp [Raw.Proc.freeNames, RawNativeEvent.support, eventName]
  | closeLeft outputStep inputStep freshForReceiver binderFresh
      outputIH inputIH =>
      intro name member
      simp only [Raw.Proc.freeNames, RawNativeEvent.support,
        Finset.mem_union, Finset.mem_insert, Finset.mem_erase] at member ⊢
      rcases member.2 with leftName | substitutedName
      · have classified := outputIH leftName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inl sourceName)
        · aesop
      · have introduced :=
          raw_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with rightName | replacementName
        · have classified := inputIH rightName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inr sourceName)
          · aesop
        · aesop
  | closeRight inputStep outputStep freshForReceiver binderFresh
      inputIH outputIH =>
      intro name member
      simp only [Raw.Proc.freeNames, RawNativeEvent.support,
        Finset.mem_union, Finset.mem_insert, Finset.mem_erase] at member ⊢
      rcases member.2 with substitutedName | rightName
      · have introduced :=
          raw_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with leftName | replacementName
        · have classified := inputIH leftName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inl sourceName)
          · aesop
        · aesop
      · have classified := outputIH rightName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inr sourceName)
        · aesop

end RawMarkedStep

namespace RecursiveNativeEvent

/-- Every name exposed by a recursive strong-late label occurs in its mark. -/
theorem action_names_subset_support
    (event : RecursiveNativeEvent) :
    event.action.names ⊆ event.support := by
  induction event with
  | embedded event =>
      exact event.action_names_subset_support
  | prefixTau =>
      simp [action, support, Raw.Action.names]
  | prefixOutput =>
      simp [action, support, Raw.Action.names]
  | prefixInput =>
      simp [action, support, Raw.Action.names]
  | matchGuard =>
      simp_all [action, support, Raw.Action.names, Finset.subset_iff]
  | mismatchGuard =>
      simp_all [action, support, Raw.Action.names, Finset.subset_iff]
  | choiceLeft =>
      simp_all [action, support, Raw.Action.names, Finset.subset_iff]
  | choiceRight =>
      simp_all [action, support, Raw.Action.names, Finset.subset_iff]
  | parLeft =>
      simp_all [action, support, Raw.Action.names, Finset.subset_iff]
  | parRight =>
      simp_all [action, support, Raw.Action.names, Finset.subset_iff]
  | syncLeft =>
      simp [action, support, Raw.Action.names]
  | syncRight =>
      simp [action, support, Raw.Action.names]
  | restrict =>
      simp_all [action, support, Raw.Action.names, Finset.subset_iff]
  | «open» =>
      simp [action, support, Raw.Action.names]
  | closeLeft =>
      simp [action, support, Raw.Action.names]
  | closeRight =>
      simp [action, support, Raw.Action.names]
  | replicatedTau =>
      simp [action, support, Raw.Action.names]
  | replicatedOutput =>
      simp [action, support, Raw.Action.names]
  | replicatedInput =>
      simp [action, support, Raw.Action.names]

end RecursiveNativeEvent

namespace RecursiveMarkedStep

/--
A guarded-recursive marked derivative has no unexplained free name: every
target name comes from the source or the occurrence support.
-/
theorem target_freeNames_subset_source_union_support
    (step : RecursiveMarkedStep source action event target) :
    target.freeNames ⊆ source.freeNames ∪ event.support := by
  induction step with
  | embedded rawStep =>
      simpa [RecursiveProc.freeNames_ofRaw, RecursiveNativeEvent.support] using
        rawStep.target_freeNames_subset_source_union_support
  | prefixTau =>
      exact Finset.subset_union_left
  | prefixOutput =>
      intro name member
      simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, member]
  | @prefixInput channel binder next =>
      intro name member
      by_cases bound : name = binder
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, bound]
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support,
          member, bound]
  | matchGuard step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, sourceName]
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, eventName]
  | mismatchGuard distinct step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, sourceName]
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, eventName]
  | choiceLeft step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, sourceName]
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, eventName]
  | choiceRight step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, sourceName]
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, eventName]
  | parLeft fresh step ih =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union] at member ⊢
      rcases member with targetName | untouchedName
      · have classified := ih targetName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inl sourceName)
        · exact Or.inr eventName
      · exact Or.inl (Or.inr untouchedName)
  | parRight fresh step ih =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union] at member ⊢
      rcases member with untouchedName | targetName
      · exact Or.inl (Or.inl untouchedName)
      · have classified := ih targetName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inr sourceName)
        · exact Or.inr eventName
  | syncLeft outputStep inputStep fresh outputIH inputIH =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union, Finset.mem_insert] at member ⊢
      rcases member with leftName | substitutedName
      · have classified := outputIH leftName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inl sourceName)
        · aesop
      · have introduced :=
          recursive_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with rightName | replacementName
        · have classified := inputIH rightName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inr sourceName)
          · aesop
        · aesop
  | syncRight inputStep outputStep fresh inputIH outputIH =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union, Finset.mem_insert] at member ⊢
      rcases member with substitutedName | rightName
      · have introduced :=
          recursive_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with leftName | replacementName
        · have classified := inputIH leftName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inl sourceName)
          · aesop
        · aesop
      · have classified := outputIH rightName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inr sourceName)
        · aesop
  | @restrict binder body action event next fresh step ih =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union, Finset.mem_insert, Finset.mem_erase] at member ⊢
      have classified := ih member.2
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · by_cases binderName : name = binder
        · exact Or.inr (Or.inl binderName)
        · exact Or.inl ⟨binderName, sourceName⟩
      · exact Or.inr (Or.inr eventName)
  | @«open» fresh channel body outputEvent next distinct step ih =>
      intro name member
      have classified := ih member
      rw [Finset.mem_union] at classified
      rcases classified with sourceName | eventName
      · by_cases freshName : name = fresh
        · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, freshName]
        · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support,
            freshName, sourceName]
      · simp [RecursiveProc.freeNames, RecursiveNativeEvent.support, eventName]
  | closeLeft outputStep inputStep freshForReceiver binderFresh
      outputIH inputIH =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union, Finset.mem_insert, Finset.mem_erase] at member ⊢
      rcases member.2 with leftName | substitutedName
      · have classified := outputIH leftName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inl sourceName)
        · aesop
      · have introduced :=
          recursive_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with rightName | replacementName
        · have classified := inputIH rightName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inr sourceName)
          · aesop
        · aesop
  | closeRight inputStep outputStep freshForReceiver binderFresh
      inputIH outputIH =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union, Finset.mem_insert, Finset.mem_erase] at member ⊢
      rcases member.2 with substitutedName | rightName
      · have introduced :=
          recursive_substitution_freeNames_subset _ _ _ substitutedName
        simp only [Finset.mem_union, Finset.mem_singleton] at introduced
        rcases introduced with leftName | replacementName
        · have classified := inputIH leftName
          rw [Finset.mem_union] at classified
          rcases classified with sourceName | eventName
          · exact Or.inl (Or.inl sourceName)
          · aesop
        · aesop
      · have classified := outputIH rightName
        rw [Finset.mem_union] at classified
        rcases classified with sourceName | eventName
        · exact Or.inl (Or.inr sourceName)
        · aesop
  | replicatedTau =>
      intro name member
      simpa [RecursiveProc.freeNames, RecursiveNativeEvent.support] using member
  | replicatedOutput =>
      intro name member
      simpa [RecursiveProc.freeNames, RecursiveNativeEvent.support] using member
  | @replicatedInput channel binder body =>
      intro name member
      simp only [RecursiveProc.freeNames, RecursiveNativeEvent.support,
        Finset.mem_union, Finset.mem_insert, Finset.mem_erase] at member ⊢
      rcases member with bodyName | sourceName
      · by_cases bound : name = binder
        · exact Or.inr (Or.inr (by simpa using bound))
        · exact Or.inl (Or.inr ⟨bound, bodyName⟩)
      · exact Or.inl sourceName

end RecursiveMarkedStep

/--
The minimal source-side certificate for commuting two marked component
occurrences.

The two source freshness premises are independent requirements: support
disjointness alone does not say that a bound action name is fresh for the
other component's pre-existing free names.
-/
structure SourceFreshParallelIndependent
    {left right left' right' : RecursiveProc}
    {leftAction rightAction : Raw.Action}
    {leftEvent rightEvent : RecursiveNativeEvent}
    (leftStep :
      RecursiveMarkedStep left leftAction leftEvent left')
    (rightStep :
      RecursiveMarkedStep right rightAction rightEvent right') : Prop where
  effects : RecursiveEventIndependent leftEvent rightEvent
  leftSourceFresh :
    Disjoint leftAction.boundNames right.freeNames
  rightSourceFresh :
    Disjoint rightAction.boundNames left.freeNames

namespace SourceFreshParallelIndependent

theorem left_boundNames_subset_event_support
    {left right left' right' : RecursiveProc}
    {leftAction rightAction : Raw.Action}
    {leftEvent rightEvent : RecursiveNativeEvent}
    {leftStep :
      RecursiveMarkedStep left leftAction leftEvent left'}
    {rightStep :
      RecursiveMarkedStep right rightAction rightEvent right'}
    (_independent :
      SourceFreshParallelIndependent leftStep rightStep) :
    leftAction.boundNames ⊆ leftEvent.support := by
  intro name member
  have actionEq := leftStep.event_action
  rw [← actionEq] at member
  exact leftEvent.action_names_subset_support
    (by
      rw [Raw.Action.names_eq_free_union_bound]
      exact Finset.mem_union_right _ member)

theorem right_boundNames_subset_event_support
    {left right left' right' : RecursiveProc}
    {leftAction rightAction : Raw.Action}
    {leftEvent rightEvent : RecursiveNativeEvent}
    {leftStep :
      RecursiveMarkedStep left leftAction leftEvent left'}
    {rightStep :
      RecursiveMarkedStep right rightAction rightEvent right'}
    (_independent :
      SourceFreshParallelIndependent leftStep rightStep) :
    rightAction.boundNames ⊆ rightEvent.support := by
  intro name member
  have actionEq := rightStep.event_action
  rw [← actionEq] at member
  exact rightEvent.action_names_subset_support
    (by
      rw [Raw.Action.names_eq_free_union_bound]
      exact Finset.mem_union_right _ member)

/-- Source freshness persists after the independent right occurrence. -/
theorem leftResidualFresh
    {left right left' right' : RecursiveProc}
    {leftAction rightAction : Raw.Action}
    {leftEvent rightEvent : RecursiveNativeEvent}
    {leftStep :
      RecursiveMarkedStep left leftAction leftEvent left'}
    {rightStep :
      RecursiveMarkedStep right rightAction rightEvent right'}
    (independent :
      SourceFreshParallelIndependent leftStep rightStep) :
    Disjoint leftAction.boundNames right'.freeNames := by
  rw [Finset.disjoint_left]
  intro name boundName targetName
  have targetCases :=
    rightStep.target_freeNames_subset_source_union_support targetName
  rw [Finset.mem_union] at targetCases
  cases targetCases with
  | inl sourceName =>
      exact (Finset.disjoint_left.mp independent.leftSourceFresh)
        boundName sourceName
  | inr eventName =>
      have leftEventName :=
        independent.left_boundNames_subset_event_support boundName
      exact (Finset.disjoint_left.mp independent.effects)
        leftEventName eventName

/-- Source freshness persists after the independent left occurrence. -/
theorem rightResidualFresh
    {left right left' right' : RecursiveProc}
    {leftAction rightAction : Raw.Action}
    {leftEvent rightEvent : RecursiveNativeEvent}
    {leftStep :
      RecursiveMarkedStep left leftAction leftEvent left'}
    {rightStep :
      RecursiveMarkedStep right rightAction rightEvent right'}
    (independent :
      SourceFreshParallelIndependent leftStep rightStep) :
    Disjoint rightAction.boundNames left'.freeNames := by
  rw [Finset.disjoint_left]
  intro name boundName targetName
  have targetCases :=
    leftStep.target_freeNames_subset_source_union_support targetName
  rw [Finset.mem_union] at targetCases
  cases targetCases with
  | inl sourceName =>
      exact (Finset.disjoint_left.mp independent.rightSourceFresh)
        boundName sourceName
  | inr eventName =>
      have rightEventName :=
        independent.right_boundNames_subset_event_support boundName
      exact (Finset.disjoint_left.mp independent.effects.symm)
        rightEventName eventName

/--
The source-side certificate supplies all four freshness premises required by
the existing exact marked residual square.
-/
theorem toResidualSquare
    {left right left' right' : RecursiveProc}
    {leftAction rightAction : Raw.Action}
    {leftEvent rightEvent : RecursiveNativeEvent}
    {leftStep :
      RecursiveMarkedStep left leftAction leftEvent left'}
    {rightStep :
      RecursiveMarkedStep right rightAction rightEvent right'}
    (independent :
      SourceFreshParallelIndependent leftStep rightStep) :
    ParallelResidualSquare
      (.par left right) leftEvent rightEvent (.par left' right') :=
  ParallelResidualSquare.ofComponents
    leftStep rightStep independent.effects
    independent.leftSourceFresh independent.rightSourceFresh
    independent.leftResidualFresh independent.rightResidualFresh

/-- Exact strong marked exchange derived from source-side independence. -/
theorem exact_marked_diamond
    {left right left' right' : RecursiveProc}
    {leftAction rightAction : Raw.Action}
    {leftEvent rightEvent : RecursiveNativeEvent}
    {leftStep :
      RecursiveMarkedStep left leftAction leftEvent left'}
    {rightStep :
      RecursiveMarkedStep right rightAction rightEvent right'}
    (independent :
      SourceFreshParallelIndependent leftStep rightStep) :
    RecursiveMarkedTrace
        (.par left right)
        [.parLeft leftEvent, .parRight rightEvent]
        (.par left' right') ∧
      RecursiveMarkedTrace
        (.par left right)
        [.parRight rightEvent, .parLeft leftEvent]
        (.par left' right') :=
  independent.toResidualSquare.exact_marked_diamond

end SourceFreshParallelIndependent

end LateMarkedIndependentExchange
end Cantilune.Pi
