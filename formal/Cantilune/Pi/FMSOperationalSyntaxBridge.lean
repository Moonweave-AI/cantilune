import Cantilune.Pi.FMSContext
import Cantilune.Pi.Late

/-!
# Operational reification of finite-world FMS syntax

`FMSContext.SupportedProc` uses finite free-name worlds and locally nameless
binders, while the operational late semantics uses nominal natural names.
This module supplies a deterministic, capture-safe reification between the
two presentations.

Free names are supplied by an environment.  Every input or restriction uses
the current numerical supply as its binder and increments the supply.  If all
existing environment names are below the supply, newly allocated binders
cannot capture them.  The main support theorem proves that reification
introduces no free name outside the two environments; at world zero this
constructs an actual `ClosedRaw`.
-/

namespace Cantilune.Pi.FMSOperationalSyntaxBridge

open Cantilune.Pi.FMSContext

/-- The finite range of a nominal environment. -/
def nameRange {count : Nat} (environment : Fin count → Name) :
    Finset Name :=
  Finset.univ.image environment

@[simp]
theorem mem_nameRange {count : Nat}
    (environment : Fin count → Name) (name : Fin count) :
    environment name ∈ nameRange environment := by
  simp [nameRange]

/-- Add the newest binder as the last locally nameless index. -/
def extendBound {count : Nat}
    (fresh : Name) (environment : Fin count → Name) :
    Fin (count + 1) → Name :=
  Fin.lastCases fresh environment

@[simp]
theorem extendBound_last {count : Nat}
    (fresh : Name) (environment : Fin count → Name) :
    extendBound fresh environment (Fin.last count) = fresh := by
  simp [extendBound]

@[simp]
theorem extendBound_castSucc {count : Nat}
    (fresh : Name) (environment : Fin count → Name)
    (index : Fin count) :
    extendBound fresh environment index.castSucc = environment index := by
  simp [extendBound]

theorem nameRange_extendBound {count : Nat}
    (fresh : Name) (environment : Fin count → Name) :
    nameRange (extendBound fresh environment) =
      insert fresh (nameRange environment) := by
  ext name
  simp only [nameRange, Finset.mem_image, Finset.mem_univ, true_and,
    Finset.mem_insert]
  constructor
  · rintro ⟨index, rfl⟩
    refine Fin.lastCases ?_ (fun old => ?_) index
    · exact Or.inl (extendBound_last fresh environment)
    · exact Or.inr ⟨old, by simp [extendBound]⟩
  · rintro (rfl | ⟨old, rfl⟩)
    · exact ⟨Fin.last count, by simp [extendBound]⟩
    · exact ⟨old.castSucc, by simp [extendBound]⟩

/-- Every name already in an environment lies below the fresh supply. -/
def Below {count : Nat} (supply : Name)
    (environment : Fin count → Name) : Prop :=
  ∀ index, environment index < supply

theorem Below.step {count : Nat} {supply : Name}
    {environment : Fin count → Name}
    (below : Below supply environment) :
    Below (supply + 1) environment := by
  intro index
  exact Nat.lt_succ_of_lt (below index)

theorem Below.extendBound {count : Nat} {supply : Name}
    {environment : Fin count → Name}
    (below : Below supply environment) :
    Below (supply + 1) (extendBound supply environment) := by
  intro index
  refine Fin.lastCases ?_ (fun old => ?_) index
  · simp
  · simpa [extendBound] using Nat.lt_succ_of_lt (below old)

namespace ScopedName

/-- Interpret a scoped name in two disjoint syntactic environments. -/
def reify
    (freeEnvironment : Fin freeCount → Name)
    (boundEnvironment : Fin boundCount → Name) :
    ScopedName freeCount boundCount → Name
  | .free name => freeEnvironment name
  | .bound index => boundEnvironment index

theorem reify_mem
    (freeEnvironment : Fin freeCount → Name)
    (boundEnvironment : Fin boundCount → Name)
    (name : ScopedName freeCount boundCount) :
    reify freeEnvironment boundEnvironment name ∈
      nameRange freeEnvironment ∪ nameRange boundEnvironment := by
  cases name <;> simp [reify, nameRange]

end ScopedName

namespace SupportedProc

/--
Reify a locally nameless process with a monotonically increasing binder
supply.
-/
def reify
    (supply : Name)
    (freeEnvironment : Fin freeCount → Name)
    (boundEnvironment : Fin boundCount → Name) :
    SupportedProc freeCount boundCount → Raw.Proc
  | .zero => .zero
  | .tau next =>
      .tau (reify supply freeEnvironment boundEnvironment next)
  | .input channel body =>
      .recv
        (ScopedName.reify freeEnvironment boundEnvironment channel)
        supply
        (reify (supply + 1) freeEnvironment
          (extendBound supply boundEnvironment) body)
  | .output channel value next =>
      .send
        (ScopedName.reify freeEnvironment boundEnvironment channel)
        (ScopedName.reify freeEnvironment boundEnvironment value)
        (reify supply freeEnvironment boundEnvironment next)
  | .choice left right =>
      .choice
        (reify supply freeEnvironment boundEnvironment left)
        (reify supply freeEnvironment boundEnvironment right)
  | .parallel left right =>
      .par
        (reify supply freeEnvironment boundEnvironment left)
        (reify supply freeEnvironment boundEnvironment right)
  | .restrict body =>
      .new supply
        (reify (supply + 1) freeEnvironment
          (extendBound supply boundEnvironment) body)
  | .matchEq left right next =>
      .matchEq
        (ScopedName.reify freeEnvironment boundEnvironment left)
        (ScopedName.reify freeEnvironment boundEnvironment right)
        (reify supply freeEnvironment boundEnvironment next)
  | .matchNe left right next =>
      .matchNe
        (ScopedName.reify freeEnvironment boundEnvironment left)
        (ScopedName.reify freeEnvironment boundEnvironment right)
        (reify supply freeEnvironment boundEnvironment next)

private theorem mem_old_bound_of_mem_extended
    {count : Nat} {supply name : Name}
    {environment : Fin count → Name}
    (notFresh : name ≠ supply)
    (member : name ∈ nameRange (extendBound supply environment)) :
    name ∈ nameRange environment := by
  rw [nameRange_extendBound] at member
  rcases Finset.mem_insert.mp member with equality | old
  · exact False.elim (notFresh equality)
  · exact old

/--
Reification introduces no free nominal name outside the supplied free and
bound environments.
-/
theorem freeNames_reify_subset
    (process : SupportedProc freeCount boundCount)
    (supply : Name)
    (freeEnvironment : Fin freeCount → Name)
    (boundEnvironment : Fin boundCount → Name)
    (freeBelow : Below supply freeEnvironment)
    (boundBelow : Below supply boundEnvironment) :
    (reify supply freeEnvironment boundEnvironment process).freeNames ⊆
      nameRange freeEnvironment ∪ nameRange boundEnvironment := by
  induction process generalizing supply with
  | zero =>
      simp [reify, Raw.Proc.freeNames]
  | tau next ih =>
      simpa [reify, Raw.Proc.freeNames] using
        ih supply boundEnvironment freeBelow boundBelow
  | input channel body ih =>
      intro name member
      simp only [reify, Raw.Proc.freeNames] at member
      rcases Finset.mem_insert.mp member with channelName | bodyName
      · subst name
        exact ScopedName.reify_mem
          freeEnvironment boundEnvironment channel
      · have bodyMember : name ∈
            (reify (supply + 1) freeEnvironment
              (extendBound supply boundEnvironment) body).freeNames :=
          Finset.mem_of_mem_erase bodyName
        have classified :=
          ih (supply + 1) (extendBound supply boundEnvironment)
            freeBelow.step boundBelow.extendBound bodyMember
        rcases Finset.mem_union.mp classified with freeName | boundName
        · exact Finset.mem_union_left _ freeName
        · have notFresh : name ≠ supply :=
            (Finset.mem_erase.mp bodyName).1
          exact Finset.mem_union_right _
            (mem_old_bound_of_mem_extended notFresh boundName)
  | output channel value next ih =>
      intro name member
      simp only [reify, Raw.Proc.freeNames] at member
      rcases Finset.mem_insert.mp member with channelName | member
      · subst name
        exact ScopedName.reify_mem
          freeEnvironment boundEnvironment channel
      · rcases Finset.mem_insert.mp member with valueName | nextName
        · subst name
          exact ScopedName.reify_mem
            freeEnvironment boundEnvironment value
        · exact ih supply boundEnvironment freeBelow boundBelow nextName
  | choice left right leftIH rightIH =>
      intro name member
      simp only [reify, Raw.Proc.freeNames] at member
      rcases Finset.mem_union.mp member with leftName | rightName
      · exact leftIH supply boundEnvironment freeBelow boundBelow leftName
      · exact rightIH supply boundEnvironment freeBelow boundBelow rightName
  | parallel left right leftIH rightIH =>
      intro name member
      simp only [reify, Raw.Proc.freeNames] at member
      rcases Finset.mem_union.mp member with leftName | rightName
      · exact leftIH supply boundEnvironment freeBelow boundBelow leftName
      · exact rightIH supply boundEnvironment freeBelow boundBelow rightName
  | restrict body ih =>
      intro name member
      simp only [reify, Raw.Proc.freeNames] at member
      have bodyMember : name ∈
          (reify (supply + 1) freeEnvironment
            (extendBound supply boundEnvironment) body).freeNames :=
        Finset.mem_of_mem_erase member
      have classified :=
        ih (supply + 1) (extendBound supply boundEnvironment)
          freeBelow.step boundBelow.extendBound bodyMember
      rcases Finset.mem_union.mp classified with freeName | boundName
      · exact Finset.mem_union_left _ freeName
      · have notFresh : name ≠ supply :=
          (Finset.mem_erase.mp member).1
        exact Finset.mem_union_right _
          (mem_old_bound_of_mem_extended notFresh boundName)
  | matchEq left right next ih =>
      intro name member
      simp only [reify, Raw.Proc.freeNames] at member
      rcases Finset.mem_insert.mp member with leftName | member
      · subst name
        exact ScopedName.reify_mem
          freeEnvironment boundEnvironment left
      · rcases Finset.mem_insert.mp member with rightName | nextName
        · subst name
          exact ScopedName.reify_mem
            freeEnvironment boundEnvironment right
        · exact ih supply boundEnvironment freeBelow boundBelow nextName
  | matchNe left right next ih =>
      intro name member
      simp only [reify, Raw.Proc.freeNames] at member
      rcases Finset.mem_insert.mp member with leftName | member
      · subst name
        exact ScopedName.reify_mem
          freeEnvironment boundEnvironment left
      · rcases Finset.mem_insert.mp member with rightName | nextName
        · subst name
          exact ScopedName.reify_mem
            freeEnvironment boundEnvironment right
        · exact ih supply boundEnvironment freeBelow boundBelow nextName

/-- Canonical nominal representative of a process at finite world `world`. -/
def reifyAtWorld
    (process : SupportedProc world 0) : Raw.Proc :=
  reify world Fin.val Fin.elim0 process

theorem reifyAtWorld_freeNames_subset
    (process : SupportedProc world 0) :
    (reifyAtWorld process).freeNames ⊆
      nameRange (Fin.val : Fin world → Name) := by
  have freeBelow : Below world (Fin.val : Fin world → Name) :=
    fun index => index.isLt
  have boundBelow : Below world (Fin.elim0 : Fin 0 → Name) :=
    fun index => Fin.elim0 index
  simpa [reifyAtWorld, nameRange] using
    freeNames_reify_subset process world
      (Fin.val : Fin world → Name) (Fin.elim0 : Fin 0 → Name)
      freeBelow boundBelow

/-- At world zero, canonical reification is a genuinely closed raw process. -/
def reifyClosed (process : SupportedProc 0 0) :
    { raw : Raw.Proc // raw.freeNames = ∅ } :=
  ⟨reifyAtWorld process, by
    apply Finset.Subset.antisymm
    · intro name member
      have impossible :=
        reifyAtWorld_freeNames_subset process member
      simp [nameRange] at impossible
    · simp⟩

end SupportedProc

end Cantilune.Pi.FMSOperationalSyntaxBridge
