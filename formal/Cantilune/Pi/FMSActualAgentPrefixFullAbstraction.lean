import Cantilune.Pi.FMSCpoSupportedActualAgent
import Cantilune.Pi.FMSFiniteOperationalFullAbstraction

/-!
# Full abstraction for the canonical finite actual-Agent prefix trie

The lower-power algebra contains a precise obstruction to separating
non-canonical same-head branching by base may observations: a union of two
continuation principals need not equal the principal of their join.  Turning
that algebraic obstruction into a theorem about an unrestricted raw syntax
would additionally require definability of both shapes.  This module proves
the positive result on the canonical deterministic trie presentation, where
every node has at most one continuation for each typed action label.

The operational observation is defined from genuine strong late-pi steps on
the reified supported process.  The powerdomain membership predicate is a
separate semantic observation; neither is defined as denotational equality.
-/

noncomputable section

namespace Cantilune.Pi.FMSActualAgentPrefixFullAbstraction

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSContext
open Cantilune.Pi.FMSCpoActionFunctor
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoActualDomainEquationBoundary
open Cantilune.Pi.FMSCpoEmbeddingProjectionBilimit
open Cantilune.Pi.FMSCpoAgentRestriction
open Cantilune.Pi.FMSCpoAgentOperationalBridge
open Cantilune.Pi.FMSCpoSupportedActualAgent

/-- Typed labels supported by the deterministic actual-Agent prefix trie. -/
inductive PrefixLabel (world : Nat) where
  | tau
  | output (channel value : Fin world)
deriving DecidableEq, Fintype

/-- The genuine raw late-pi action represented by a typed trie label. -/
def PrefixLabel.action {world : Nat} :
    PrefixLabel world → Raw.Action
  | .tau => .tau
  | .output channel value => .output channel.val value.val

theorem PrefixLabel.action_injective {world : Nat} :
    Function.Injective
      (@PrefixLabel.action world) := by
  intro left right equal
  cases left with
  | tau =>
      cases right with
      | tau => rfl
      | output channel value =>
          simp [PrefixLabel.action] at equal
  | output leftChannel leftValue =>
      cases right with
      | tau =>
          simp [PrefixLabel.action] at equal
      | output rightChannel rightValue =>
          simp only [PrefixLabel.action,
            Raw.Action.output.injEq] at equal
          rcases equal with
            ⟨channelEqual, valueEqual⟩
          congr
          · exact Fin.ext channelEqual
          · exact Fin.ext valueEqual

/-- Embed the typed trie label into the existing raw-prefix compiler. -/
def PrefixLabel.finiteLabel {world : Nat}
    (label : PrefixLabel world) :
    FMSFiniteOperationalFullAbstraction.FiniteLabel :=
  match label with
  | .tau => .tau
  | .output channel value =>
      .output channel.val value.val

@[simp]
theorem PrefixLabel.finiteLabel_action
    {world : Nat} (label : PrefixLabel world) :
    label.finiteLabel.action = label.action := by
  cases label <;> rfl

/-- Prefix a supported process by one typed trie label. -/
def PrefixLabel.prefix {world : Nat}
    (label : PrefixLabel world)
    (next : SupportedProc world 0) :
    SupportedProc world 0 :=
  match label with
  | .tau => .tau next
  | .output channel value =>
      .output (.free channel) (.free value) next

@[simp]
theorem PrefixLabel.reify_prefix
    {world : Nat}
    (label : PrefixLabel world)
    (next : SupportedProc world 0) :
    FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (label.prefix next) =
      label.finiteLabel.prefix
        (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld next) := by
  cases label <;> rfl

theorem PrefixLabel.reify_prefix_native
    {world : Nat}
    (label : PrefixLabel world)
    (next : SupportedProc world 0) :
    Late.NativeStep
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        (label.prefix next))
      label.action
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld next) := by
  rw [PrefixLabel.reify_prefix]
  simpa only [PrefixLabel.finiteLabel_action] using
    FMSFiniteOperationalFullAbstraction.FiniteLabel.prefix_native
      label.finiteLabel
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld next)

theorem PrefixLabel.reify_prefix_native_iff
    {world : Nat}
    (label : PrefixLabel world)
    (next : SupportedProc world 0)
    (action : Raw.Action) (target : Raw.Proc) :
    Late.NativeStep
        (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
          (label.prefix next))
        action target ↔
      action = label.action ∧
        target =
          FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld next := by
  rw [PrefixLabel.reify_prefix]
  simpa only [PrefixLabel.finiteLabel_action] using
    FMSFiniteOperationalFullAbstraction.FiniteLabel.prefix_native_iff
      label.finiteLabel
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld next)
      target action

/-- The corresponding action in the recursive FMS action carrier. -/
def PrefixLabel.semanticAction {world : Nat}
    (label : PrefixLabel world)
    (continuation : Agent.obj world) :
    ActionRepresentation Agent world :=
  match label with
  | .tau => tauAction world continuation
  | .output channel value =>
      Sum.inr
        (Sum.inl
          ((nameTag channel, nameTag value), continuation))

/-- The same action at the exact carrier selected by `actionFunctor`. -/
def PrefixLabel.actualAction {world : Nat}
    (label : PrefixLabel world)
    (continuation : Agent.obj world) :
    ((actionFunctor.obj Agent).obj world).carrier :=
  label.semanticAction continuation

/--
A finite-depth canonical trie.  The branch function makes the same-label
continuation unique by construction.  `dead` is available at every padding
depth, so a branch can terminate before the global depth bound.
-/
inductive PrefixTrie (world : Nat) : Nat → Type where
  | dead {depth : Nat} : PrefixTrie world depth
  | node {depth : Nat}
      (active : PrefixLabel world → Bool)
      (branch : PrefixLabel world → PrefixTrie world depth) :
      PrefixTrie world (depth + 1)

/-- Right-associated finite choice over a fixed label enumeration. -/
def chooseSupported {world : Nat}
    (active : PrefixLabel world → Bool)
    (continuation : PrefixLabel world → SupportedProc world 0) :
    List (PrefixLabel world) → SupportedProc world 0
  | [] => .zero
  | label :: rest =>
      if active label then
        .choice (label.prefix (continuation label))
          (chooseSupported active continuation rest)
      else
        chooseSupported active continuation rest

theorem chooseSupported_native_step_iff
    {world : Nat}
    (active : PrefixLabel world → Bool)
    (continuation : PrefixLabel world → SupportedProc world 0)
    (labels : List (PrefixLabel world))
    (action : Raw.Action) (target : Raw.Proc) :
    Late.NativeStep
        (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
          (chooseSupported active continuation labels))
        action target ↔
      ∃ label ∈ labels,
        active label = true ∧
        action = label.action ∧
        target =
          FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
            (continuation label) := by
  induction labels with
  | nil =>
      constructor
      · intro step
        cases step
      · rintro ⟨label, impossible, _⟩
        exact (by simpa using impossible)
  | cons head rest induction =>
      by_cases enabled : active head = true
      · constructor
        · intro step
          simp only [chooseSupported, enabled, if_true] at step
          cases step with
          | choiceLeft first =>
              rcases
                  (PrefixLabel.reify_prefix_native_iff
                    head (continuation head)
                    action target).mp first with
                ⟨actionEqual, targetEqual⟩
              exact
                ⟨head, by simp, enabled,
                  actionEqual, targetEqual⟩
          | choiceRight later =>
              rcases induction.mp later with
                ⟨label, member, labelEnabled,
                  actionEqual, targetEqual⟩
              exact
                ⟨label, by simp [member], labelEnabled,
                  actionEqual, targetEqual⟩
        · rintro
            ⟨label, member, labelEnabled,
              actionEqual, targetEqual⟩
          rcases List.mem_cons.mp member with
            labelHead | labelTail
          · have labelEqual : label = head := labelHead
            subst label
            subst action
            subst target
            simp only [chooseSupported, enabled, if_true]
            exact Late.NativeStep.choiceLeft
              (head.reify_prefix_native
                (continuation head))
          · have later :
                Late.NativeStep
                  (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
                    (chooseSupported active continuation rest))
                  action target :=
              induction.mpr
                ⟨label, labelTail, labelEnabled,
                  actionEqual, targetEqual⟩
            simp only [chooseSupported, enabled, if_true]
            exact Late.NativeStep.choiceRight later
      · have disabled :=
          Bool.eq_false_of_not_eq_true enabled
        constructor
        · intro step
          have later :
              Late.NativeStep
                (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
                  (chooseSupported active continuation rest))
                action target := by
            simpa [chooseSupported, disabled] using step
          rcases induction.mp later with
            ⟨label, member, labelEnabled,
              actionEqual, targetEqual⟩
          exact
            ⟨label, by simp [member], labelEnabled,
              actionEqual, targetEqual⟩
        · rintro
            ⟨label, member, labelEnabled,
              actionEqual, targetEqual⟩
          rcases List.mem_cons.mp member with
            labelHead | labelTail
          · have labelEqual : label = head := labelHead
            subst label
            exact (enabled labelEnabled).elim
          · have later :=
              induction.mpr
                ⟨label, labelTail, labelEnabled,
                  actionEqual, targetEqual⟩
            simpa [chooseSupported, disabled] using later

/-- Compile a deterministic trie to the supported locally nameless syntax. -/
def PrefixTrie.compile {world : Nat} :
    (depth : Nat) → PrefixTrie world depth → SupportedProc world 0
  | _, .dead => .zero
  | depth + 1, .node active branch =>
      chooseSupported active
        (fun label =>
          PrefixTrie.compile depth (branch label))
        (Finset.univ : Finset (PrefixLabel world)).toList
termination_by depth => depth

/--
Purely syntactic prefix-path semantics.  The empty path is accepted only as
an induction device; exported observations below require a nonempty word.
-/
def PrefixTrie.Path {world : Nat} {depth : Nat}
    (trie : PrefixTrie world depth) :
    List (PrefixLabel world) → Prop
  | [] => True
  | label :: rest =>
      match trie with
      | .dead => False
      | .node active branch =>
          active label = true ∧ (branch label).Path rest
termination_by labels => labels.length

/-- Actual recursive-Agent denotation of a canonical trie. -/
def PrefixTrie.denote {world : Nat} {depth : Nat}
    (trie : PrefixTrie world depth) :
    Agent.obj world :=
  supportedDenote.app world (trie.compile depth)

/-- Finite lower-power union corresponding to one canonical trie node. -/
def chooseLayer {world : Nat}
    (active : PrefixLabel world → Bool)
    (continuation : PrefixLabel world → Agent.obj world) :
    List (PrefixLabel world) →
      OmegaScottPower (ActionRepresentation Agent world)
  | [] => ⊥
  | label :: rest =>
      if active label then
        principalRaw (label.semanticAction (continuation label)) ⊔
          chooseLayer active continuation rest
      else
        chooseLayer active continuation rest

@[simp]
theorem supportedDenote_prefix_unfold
    {world : Nat}
    (label : PrefixLabel world)
    (next : SupportedProc world 0) :
    agentUnfold.app world
        (supportedDenote.app world (label.prefix next)) =
      principalRaw
        (label.semanticAction
          (supportedDenote.app world next)) := by
  cases label with
  | tau =>
      exact supportedDenote_tau_unfold world next
  | output channel value =>
      change
        agentUnfold.app world
            (supportedDenote.app world
              (.output (.free channel) (.free value) next)) =
          principalRaw
            (Sum.inr
              (Sum.inl
                ((nameTag channel, nameTag value),
                  supportedDenote.app world next)))
      exact
        supportedDenote_output_unfold world
          (ScopedName.free channel) (ScopedName.free value) next

theorem chooseSupported_denote_unfold
    {world : Nat}
    (active : PrefixLabel world → Bool)
    (continuation : PrefixLabel world → SupportedProc world 0)
    (labels : List (PrefixLabel world)) :
    agentUnfold.app world
        (supportedDenote.app world
          (chooseSupported active continuation labels)) =
      chooseLayer active
        (fun label =>
          supportedDenote.app world (continuation label))
        labels := by
  induction labels with
  | nil =>
      exact supportedDenote_zero_unfold world
  | cons label rest induction =>
      by_cases enabled : active label = true
      · simp only [chooseSupported, enabled, if_true, chooseLayer]
        rw [supportedDenote_choice_unfold]
        rw [← supportedDenote_unroll_at world
          (label.prefix (continuation label))]
        rw [← supportedDenote_unroll_at world
          (chooseSupported active continuation rest)]
        rw [supportedDenote_prefix_unfold, induction]
      · have disabled : active label = false := by
          exact Bool.eq_false_of_not_eq_true enabled
        simp only [chooseSupported, disabled, if_false,
          chooseLayer]
        exact induction

@[simp]
theorem PrefixTrie.denote_dead_unfold
    {world depth : Nat} :
    agentUnfold.app world
        ((PrefixTrie.dead :
          PrefixTrie world depth).denote) =
      (⊥ : OmegaScottPower
        (ActionRepresentation Agent world)) := by
  simpa only [PrefixTrie.denote, PrefixTrie.compile] using
    supportedDenote_zero_unfold world

theorem PrefixTrie.denote_node_unfold
    {world depth : Nat}
    (active : PrefixLabel world → Bool)
    (branch : PrefixLabel world → PrefixTrie world depth) :
    agentUnfold.app world
        ((PrefixTrie.node active branch).denote) =
      chooseLayer active
        (fun label => (branch label).denote)
        (Finset.univ : Finset (PrefixLabel world)).toList := by
  simpa only [PrefixTrie.denote, PrefixTrie.compile] using
    chooseSupported_denote_unfold active
      (fun label => (branch label).compile depth)
      (Finset.univ : Finset (PrefixLabel world)).toList

@[simp]
theorem nameTag_le_iff
    {world : Nat} (left right : Fin world) :
    nameTag left ≤ nameTag right ↔ left = right :=
  Iff.rfl

@[simp]
theorem semanticAction_le_iff
    {world : Nat}
    (observed offered : PrefixLabel world)
    (lower upper : Agent.obj world) :
    observed.semanticAction lower ≤
        offered.semanticAction upper ↔
      observed = offered ∧ lower ≤ upper := by
  cases observed <;> cases offered <;>
    simp [PrefixLabel.semanticAction, tauAction,
      nameTag_le_iff]

theorem mem_chooseLayer_iff
    {world : Nat}
    (active : PrefixLabel world → Bool)
    (continuation : PrefixLabel world → Agent.obj world)
    (labels : List (PrefixLabel world))
    (observed : PrefixLabel world)
    (lower : Agent.obj world) :
    WithOmegaScott.toOmegaScott
          (observed.semanticAction lower) ∈
        carrier (chooseLayer active continuation labels) ↔
      ∃ offered ∈ labels,
        active offered = true ∧
        observed = offered ∧
        lower ≤ continuation offered := by
  induction labels with
  | nil =>
      simp [chooseLayer, carrier]
  | cons offered rest induction =>
      by_cases enabled : active offered = true
      · constructor
        · intro member
          have split :
              WithOmegaScott.toOmegaScott
                    (observed.semanticAction lower) ∈
                  carrier
                    (principalRaw
                      (offered.semanticAction
                        (continuation offered))) ∨
                WithOmegaScott.toOmegaScott
                    (observed.semanticAction lower) ∈
                  carrier
                    (chooseLayer active continuation rest) := by
            simpa [chooseLayer, enabled, carrier] using member
          rcases split with head | tail
          · have ordered :
                observed.semanticAction lower ≤
                  offered.semanticAction
                    (continuation offered) :=
              (mem_principalRaw_iff _ _).mp head
            rcases
                (semanticAction_le_iff observed offered
                  lower (continuation offered)).mp ordered with
              ⟨equal, continuationLe⟩
            exact
              ⟨offered, by simp, enabled, equal,
                continuationLe⟩
          · rcases induction.mp tail with
              ⟨candidate, candidateMem, candidateEnabled,
                equal, continuationLe⟩
            exact
              ⟨candidate, by simp [candidateMem],
                candidateEnabled, equal, continuationLe⟩
        · rintro
            ⟨candidate, candidateMem, candidateEnabled,
              equal, continuationLe⟩
          rcases List.mem_cons.mp candidateMem with
            candidateHead | candidateTail
          · have equalHead : observed = offered :=
              equal.trans candidateHead
            have continuationLeHead :
                lower ≤ continuation offered := by
              simpa [candidateHead] using continuationLe
            have ordered :
                observed.semanticAction lower ≤
                  offered.semanticAction
                    (continuation offered) :=
              (semanticAction_le_iff observed offered
                lower (continuation offered)).mpr
                ⟨equalHead, continuationLeHead⟩
            have head :
                WithOmegaScott.toOmegaScott
                      (observed.semanticAction lower) ∈
                    carrier
                      (principalRaw
                        (offered.semanticAction
                          (continuation offered))) :=
              (mem_principalRaw_iff _ _).mpr ordered
            simpa [chooseLayer, enabled, carrier] using
              (Or.inl head)
          · have tail :
                WithOmegaScott.toOmegaScott
                      (observed.semanticAction lower) ∈
                    carrier
                      (chooseLayer active continuation rest) :=
              induction.mpr
                ⟨candidate, candidateTail, candidateEnabled,
                  equal, continuationLe⟩
            simpa [chooseLayer, enabled, carrier] using
              (Or.inr tail)
      · have disabled : active offered = false :=
          Bool.eq_false_of_not_eq_true enabled
        constructor
        · intro member
          rcases induction.mp (by
              simpa [chooseLayer, disabled] using member) with
            ⟨candidate, candidateMem, candidateEnabled,
              equal, continuationLe⟩
          exact
            ⟨candidate, by simp [candidateMem],
              candidateEnabled, equal, continuationLe⟩
        · rintro
            ⟨candidate, candidateMem, candidateEnabled,
              equal, continuationLe⟩
          rcases List.mem_cons.mp candidateMem with
            candidateHead | candidateTail
          · have headEnabled : active offered = true := by
              simpa [candidateHead] using candidateEnabled
            exact (enabled headEnabled).elim
          · have tail :=
              induction.mpr
                ⟨candidate, candidateTail, candidateEnabled,
                  equal, continuationLe⟩
            simpa [chooseLayer, disabled] using tail

@[simp]
theorem mem_chooseLayer_univ_iff
    {world : Nat}
    (active : PrefixLabel world → Bool)
    (continuation : PrefixLabel world → Agent.obj world)
    (observed : PrefixLabel world)
    (lower : Agent.obj world) :
    WithOmegaScott.toOmegaScott
          (observed.semanticAction lower) ∈
        carrier
          (chooseLayer active continuation
            (Finset.univ :
              Finset (PrefixLabel world)).toList) ↔
      active observed = true ∧
        lower ≤ continuation observed := by
  rw [mem_chooseLayer_iff]
  constructor
  · rintro ⟨offered, _, enabled, rfl, ordered⟩
    exact ⟨enabled, ordered⟩
  · rintro ⟨enabled, ordered⟩
    exact
      ⟨observed, by simp, enabled, rfl, ordered⟩

/--
Independent semantic path observation: each head is witnessed by membership
in the unfolded lower powerdomain.  It is not denotational equality.
-/
def AgentPath {world : Nat} :
    Agent.obj world → List (PrefixLabel world) → Prop
  | _, [] => True
  | agent, label :: rest =>
      ∃ continuation : Agent.obj world,
        WithOmegaScott.toOmegaScott
            (label.semanticAction continuation) ∈
          carrier (agentUnfold.app world agent) ∧
        AgentPath continuation rest
termination_by _ labels => labels.length

theorem AgentPath.mono
    {world : Nat}
    {lower upper : Agent.obj world}
    (ordered : lower ≤ upper)
    (labels : List (PrefixLabel world))
    (observed : AgentPath lower labels) :
    AgentPath upper labels := by
  cases labels with
  | nil =>
      simpa [AgentPath]
  | cons label rest =>
      simp only [AgentPath] at observed ⊢
      rcases observed with
        ⟨continuation, member, tail⟩
      exact
        ⟨continuation,
          (agentUnfold.app world).monotone ordered member,
          tail⟩

theorem agentPath_denote_iff_path
    {world depth : Nat}
    (trie : PrefixTrie world depth)
    (labels : List (PrefixLabel world)) :
    AgentPath trie.denote labels ↔ trie.Path labels := by
  induction labels generalizing depth with
  | nil =>
      simp [AgentPath, PrefixTrie.Path]
  | cons label rest induction =>
      cases trie with
      | dead =>
          simp only [AgentPath, PrefixTrie.Path]
          constructor
          · rintro ⟨continuation, member, _⟩
            rw [PrefixTrie.denote_dead_unfold] at member
            change
              WithOmegaScott.toOmegaScott
                    (label.semanticAction continuation) ∈
                (∅ : Set
                  (WithOmegaScott
                    (ActionRepresentation Agent world)))
              at member
            exact member.elim
          · intro impossible
            exact impossible.elim
      | node active branch =>
          simp only [AgentPath, PrefixTrie.Path]
          constructor
          · rintro ⟨continuation, member, tail⟩
            rw [PrefixTrie.denote_node_unfold] at member
            change
              WithOmegaScott.toOmegaScott
                    (label.semanticAction continuation) ∈
                (carrier
                  (chooseLayer active
                    (fun head => (branch head).denote)
                    (Finset.univ :
                      Finset (PrefixLabel world)).toList) :
                  Set
                    (WithOmegaScott
                      (ActionRepresentation Agent world)))
              at member
            have decoded :
                active label = true ∧
                  continuation ≤ (branch label).denote :=
              (mem_chooseLayer_univ_iff active
                (fun head => (branch head).denote)
                label continuation).mp
                (by simpa only using member)
            rcases decoded with ⟨enabled, ordered⟩
            have branchTail :
                AgentPath (branch label).denote rest :=
              tail.mono ordered rest
            exact
              ⟨enabled,
                (induction (trie := branch label)).mp
                  branchTail⟩
          · rintro ⟨enabled, tail⟩
            have branchTail :
                AgentPath (branch label).denote rest :=
              (induction (trie := branch label)).mpr tail
            refine
              ⟨(branch label).denote, ?_, branchTail⟩
            rw [PrefixTrie.denote_node_unfold]
            change
              WithOmegaScott.toOmegaScott
                    (label.semanticAction
                      (branch label).denote) ∈
                (carrier
                  (chooseLayer active
                    (fun head => (branch head).denote)
                    (Finset.univ :
                      Finset (PrefixLabel world)).toList) :
                  Set
                    (WithOmegaScott
                      (ActionRepresentation Agent world)))
            have member :=
              (mem_chooseLayer_univ_iff active
                (fun head => (branch head).denote)
                label (branch label).denote).mpr
                ⟨enabled, le_rfl⟩
            simpa only using member

theorem chooseLayer_eq_bot_of_inactive
    {world : Nat}
    (active : PrefixLabel world → Bool)
    (continuation : PrefixLabel world → Agent.obj world)
    (labels : List (PrefixLabel world))
    (inactive :
      ∀ label ∈ labels, active label = false) :
    chooseLayer active continuation labels = ⊥ := by
  induction labels with
  | nil =>
      rfl
  | cons label rest induction =>
      have headInactive := inactive label (by simp)
      have tailInactive :
          ∀ candidate ∈ rest, active candidate = false :=
        fun candidate member =>
          inactive candidate (by simp [member])
      simp [chooseLayer, headInactive,
        induction tailInactive]

theorem chooseLayer_congr_active
    {world : Nat}
    (active : PrefixLabel world → Bool)
    (left right : PrefixLabel world → Agent.obj world)
    (labels : List (PrefixLabel world))
    (continuations :
      ∀ label ∈ labels,
        active label = true → left label = right label) :
    chooseLayer active left labels =
      chooseLayer active right labels := by
  induction labels with
  | nil =>
      rfl
  | cons label rest induction =>
      by_cases enabled : active label = true
      · have headEqual :=
          continuations label (by simp) enabled
        have tailEqual :
            ∀ candidate ∈ rest,
              active candidate = true →
                left candidate = right candidate :=
          fun candidate member =>
            continuations candidate (by simp [member])
        simp [chooseLayer, enabled, headEqual,
          induction tailEqual]
      · have disabled :=
          Bool.eq_false_of_not_eq_true enabled
        have tailEqual :
            ∀ candidate ∈ rest,
              active candidate = true →
                left candidate = right candidate :=
          fun candidate member =>
            continuations candidate (by simp [member])
        simp [chooseLayer, disabled, induction tailEqual]

/--
Canonical deterministic tries are separated by their finite prefix paths.
The recursive call is on the strict pair of child depth bounds.
-/
theorem PrefixTrie.denote_eq_of_path_equiv
    {world leftDepth rightDepth : Nat}
    (left : PrefixTrie world leftDepth)
    (right : PrefixTrie world rightDepth)
    (equivalent :
      ∀ labels : List (PrefixLabel world),
        left.Path labels ↔ right.Path labels) :
    left.denote = right.denote := by
  apply agentUnfold_injective world
  cases left with
  | dead =>
      cases right with
      | dead =>
          rw [PrefixTrie.denote_dead_unfold,
            PrefixTrie.denote_dead_unfold]
      | @node depth active branch =>
          have inactive :
              ∀ label : PrefixLabel world,
                active label = false := by
            intro label
            have singleton := equivalent [label]
            have notEnabled : ¬ active label = true := by
              simpa [PrefixTrie.Path] using singleton
            exact Bool.eq_false_of_not_eq_true notEnabled
          rw [PrefixTrie.denote_dead_unfold,
            PrefixTrie.denote_node_unfold]
          symm
          apply chooseLayer_eq_bot_of_inactive
          intro label _
          exact inactive label
  | @node leftDepth activeLeft branchLeft =>
      cases right with
      | dead =>
          have inactive :
              ∀ label : PrefixLabel world,
                activeLeft label = false := by
            intro label
            have singleton := equivalent [label]
            have notEnabled :
                ¬ activeLeft label = true := by
              simpa [PrefixTrie.Path] using singleton
            exact Bool.eq_false_of_not_eq_true notEnabled
          rw [PrefixTrie.denote_node_unfold,
            PrefixTrie.denote_dead_unfold]
          apply chooseLayer_eq_bot_of_inactive
          intro label _
          exact inactive label
      | @node rightDepth activeRight branchRight =>
          have activeEqual :
              activeLeft = activeRight := by
            funext label
            have singleton := equivalent [label]
            have truthEquivalent :
                activeLeft label = true ↔
                  activeRight label = true := by
              simpa [PrefixTrie.Path] using singleton
            exact Bool.eq_iff_iff.mpr truthEquivalent
          subst activeRight
          have continuationEqual :
              ∀ label : PrefixLabel world,
                activeLeft label = true →
                  (branchLeft label).denote =
                    (branchRight label).denote := by
            intro label enabled
            apply PrefixTrie.denote_eq_of_path_equiv
            intro rest
            have prefixed := equivalent (label :: rest)
            simpa [PrefixTrie.Path, enabled] using prefixed
          rw [PrefixTrie.denote_node_unfold,
            PrefixTrie.denote_node_unfold]
          apply chooseLayer_congr_active
          intro label _ enabled
          exact continuationEqual label enabled
termination_by leftDepth + rightDepth

/-- Exact inversion of the first native step of a canonical trie node. -/
theorem PrefixTrie.node_native_step_iff
    {world depth : Nat}
    (active : PrefixLabel world → Bool)
    (branch : PrefixLabel world → PrefixTrie world depth)
    (action : Raw.Action) (target : Raw.Proc) :
    Late.NativeStep
        (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
          ((PrefixTrie.node active branch).compile))
        action target ↔
      ∃ label : PrefixLabel world,
        active label = true ∧
        action = label.action ∧
        target =
          FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
            ((branch label).compile) := by
  simp only [PrefixTrie.compile]
  rw [chooseSupported_native_step_iff]
  constructor
  · rintro
      ⟨label, _, enabled, actionEqual, targetEqual⟩
    exact
      ⟨label, enabled, actionEqual, targetEqual⟩
  · rintro
      ⟨label, enabled, actionEqual, targetEqual⟩
    exact
      ⟨label, by simp, enabled, actionEqual, targetEqual⟩

/-- A finite path made exclusively of genuine strong late-pi steps. -/
inductive NativePrefixPath :
    Raw.Proc → List Raw.Action → Raw.Proc → Prop where
  | nil (process : Raw.Proc) :
      NativePrefixPath process [] process
  | cons
      (first : Late.NativeStep source action middle)
      (later : NativePrefixPath middle actions target) :
      NativePrefixPath source (action :: actions) target

/--
The structural path predicate is exact: it neither invents nor filters any
native step of the compiled/reified deterministic trie.
-/
theorem nativePrefixPath_compile_iff
    {world depth : Nat}
    (trie : PrefixTrie world depth)
    (labels : List (PrefixLabel world)) :
    (∃ target : Raw.Proc,
      NativePrefixPath
        (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
          trie.compile)
        (labels.map PrefixLabel.action)
        target) ↔
      trie.Path labels := by
  induction labels generalizing depth with
  | nil =>
      constructor
      · intro _
        simp [PrefixTrie.Path]
      · intro _
        exact
          ⟨FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
              trie.compile,
            NativePrefixPath.nil _⟩
  | cons label rest induction =>
      cases trie with
      | dead =>
          constructor
          · rintro ⟨target, path⟩
            have normalized :
                NativePrefixPath .zero
                  (label.action ::
                    rest.map PrefixLabel.action)
                  target := by
              simpa only [PrefixTrie.compile,
                List.map_cons,
                FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld,
                FMSOperationalSyntaxBridge.SupportedProc.reify] using
                path
            cases normalized with
            | cons first later =>
                cases first
          · intro impossible
            simpa [PrefixTrie.Path] using impossible
      | node active branch =>
          constructor
          · rintro ⟨target, path⟩
            cases path with
            | cons first later =>
                rcases
                    (PrefixTrie.node_native_step_iff
                      active branch _ _).mp first with
                  ⟨offered, enabled, actionEqual,
                    middleEqual⟩
                have labelEqual : label = offered :=
                  PrefixLabel.action_injective actionEqual
                subst offered
                rw [middleEqual] at later
                have tailPath :
                    ∃ final,
                      NativePrefixPath
                        (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
                          (branch label).compile)
                        (rest.map PrefixLabel.action)
                        final :=
                  ⟨target, later⟩
                have structural :
                    active label = true ∧
                      (branch label).Path rest :=
                  ⟨enabled,
                    (induction (trie := branch label)).mp
                      tailPath⟩
                simpa only [PrefixTrie.Path] using structural
          · simp only [PrefixTrie.Path]
            rintro ⟨enabled, tail⟩
            rcases
                (induction (trie := branch label)).mpr tail with
              ⟨target, later⟩
            have first :
                Late.NativeStep
                  (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
                    ((PrefixTrie.node active branch).compile))
                  label.action
                  (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
                    (branch label).compile) :=
              (PrefixTrie.node_native_step_iff
                active branch label.action _).mpr
                ⟨label, enabled, rfl, rfl⟩
            exact
              ⟨target, NativePrefixPath.cons first later⟩

/-- A nonempty canonical word. -/
structure PrefixWord (world : Nat) where
  labels : List (PrefixLabel world)
  nonempty : labels ≠ []

/-- Structural Hoare/may-prefix observation of a canonical trie. -/
def PrefixTrie.Observes {world : Nat} {depth : Nat}
    (trie : PrefixTrie world depth)
    (word : PrefixWord world) : Prop :=
  trie.Path word.labels

/-- Pure native observation on the compiled/reified late-pi process. -/
def PrefixTrie.NativeObserves
    {world depth : Nat}
    (trie : PrefixTrie world depth)
    (word : PrefixWord world) : Prop :=
  ∃ target : Raw.Proc,
    NativePrefixPath
      (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
        trie.compile)
      (word.labels.map PrefixLabel.action)
      target

theorem nativeObserves_iff_observes
    {world depth : Nat}
    (trie : PrefixTrie world depth)
    (word : PrefixWord world) :
    trie.NativeObserves word ↔ trie.Observes word :=
  nativePrefixPath_compile_iff trie word.labels

/-- Semantic lower-power observation of an actual Agent. -/
def AgentObserves {world : Nat}
    (agent : Agent.obj world)
    (word : PrefixWord world) : Prop :=
  AgentPath agent word.labels

/-- Native-prefix equivalence of two canonical deterministic tries. -/
def PrefixOperationallyEquivalent
    {world leftDepth rightDepth : Nat}
    (left : PrefixTrie world leftDepth)
    (right : PrefixTrie world rightDepth) : Prop :=
  ∀ word : PrefixWord world,
    left.NativeObserves word ↔ right.NativeObserves word

/-- Membership adequacy at the actual recursive Agent carrier. -/
theorem actualAgent_prefix_adequacy
    {world depth : Nat}
    (trie : PrefixTrie world depth)
    (word : PrefixWord world) :
    AgentObserves trie.denote word ↔ trie.Observes word :=
  agentPath_denote_iff_path trie word.labels

/--
Actual-Agent membership is adequate for the independently defined genuine
strong late-pi path observation.
-/
theorem actualAgent_native_prefix_adequacy
    {world depth : Nat}
    (trie : PrefixTrie world depth)
    (word : PrefixWord world) :
    AgentObserves trie.denote word ↔
      trie.NativeObserves word := by
  rw [actualAgent_prefix_adequacy,
    nativeObserves_iff_observes]

/--
Full abstraction of the actual recursive Agent on the canonical
deterministic tau/free-output trie.
-/
theorem actualAgent_prefix_full_abstraction
    {world leftDepth rightDepth : Nat}
    (left : PrefixTrie world leftDepth)
    (right : PrefixTrie world rightDepth) :
    left.denote = right.denote ↔
      PrefixOperationallyEquivalent left right := by
  constructor
  · intro equal word
    rw [← actualAgent_native_prefix_adequacy,
      ← actualAgent_native_prefix_adequacy, equal]
  · intro equivalent
    apply PrefixTrie.denote_eq_of_path_equiv
    intro labels
    cases labels with
    | nil =>
        simp [PrefixTrie.Path]
    | cons label rest =>
        let word : PrefixWord world :=
          ⟨label :: rest, by simp⟩
        change
          left.Observes word ↔ right.Observes word
        rw [← nativeObserves_iff_observes,
          ← nativeObserves_iff_observes]
        exact equivalent word

/-! ## Constructive compact definability -/

/--
A compact prefix point is syntax-first data, not an arbitrary semantic value
paired with an assumed denotation equation.
-/
structure CompactPrefixPoint (world : Nat) where
  depth : Nat
  trie : PrefixTrie world depth

/-- Explicit supported source compiled from a compact prefix point. -/
def CompactPrefixPoint.compile {world : Nat}
    (point : CompactPrefixPoint world) :
    SupportedProc world 0 :=
  point.trie.compile point.depth

/-- Its actual recursive-Agent realization. -/
def CompactPrefixPoint.realize {world : Nat}
    (point : CompactPrefixPoint world) :
    Agent.obj world :=
  point.trie.denote

/--
Constructive definability: the compiler is a function and the equation is a
kernel theorem.  There is no existentially supplied semantic witness.
-/
@[simp]
theorem compactPrefix_compile_denote
    {world : Nat}
    (point : CompactPrefixPoint world) :
    supportedDenote.app world point.compile =
      point.realize :=
  rfl

/-- The compiled source has exactly the compact point's native observations. -/
theorem compactPrefix_native_adequacy
    {world : Nat}
    (point : CompactPrefixPoint world)
    (word : PrefixWord world) :
    AgentObserves point.realize word ↔
      ∃ target : Raw.Proc,
        NativePrefixPath
          (FMSOperationalSyntaxBridge.SupportedProc.reifyAtWorld
            point.compile)
          (word.labels.map PrefixLabel.action)
          target :=
  actualAgent_native_prefix_adequacy point.trie word

/-! ## Kernel no-go for non-canonical same-label branching -/

/--
Generic lower-power obstruction: the principal of a joined continuation is
not the union of the two continuation principals when the join is below
neither branch.
-/
theorem principal_merged_ne_split
    {α : Type*}
    [OmegaCompletePartialOrder α]
    (merged left right : α)
    (notLeft : ¬ merged ≤ left)
    (notRight : ¬ merged ≤ right) :
    principalRaw merged ≠
      principalRaw left ⊔ principalRaw right := by
  intro equal
  have joinedMember :
      WithOmegaScott.toOmegaScott merged ∈
        carrier (principalRaw merged) :=
    (mem_principalRaw_iff _ _).mpr le_rfl
  rw [equal] at joinedMember
  have split :
      WithOmegaScott.toOmegaScott merged ∈
          carrier (principalRaw left) ∨
        WithOmegaScott.toOmegaScott merged ∈
          carrier (principalRaw right) := by
    simpa [carrier] using joinedMember
  rcases split with inLeft | inRight
  · exact notLeft
      ((mem_principalRaw_iff _ _).mp inLeft)
  · exact notRight
      ((mem_principalRaw_iff _ _).mp inRight)

/-- Concrete equality-ordered two-point basis. -/
abbrev TwoPointCpo := EqualityOrder Bool

/-- One lower-power continuation over the two-point basis. -/
abbrev TwoPointContinuation :=
  OmegaScottPower TwoPointCpo

def leftContinuation : TwoPointContinuation :=
  principalRaw (show TwoPointCpo from false)

def rightContinuation : TwoPointContinuation :=
  principalRaw (show TwoPointCpo from true)

theorem leftContinuation_le_join :
    leftContinuation ≤
      leftContinuation ⊔ rightContinuation := by
  intro value member
  exact
    (show
      principalRaw (show TwoPointCpo from false) ≤
        leftContinuation ⊔ rightContinuation
      from le_sup_left) member

theorem rightContinuation_le_join :
    rightContinuation ≤
      leftContinuation ⊔ rightContinuation := by
  intro value member
  exact
    (show
      principalRaw (show TwoPointCpo from true) ≤
        leftContinuation ⊔ rightContinuation
      from le_sup_right) member

theorem joinedContinuation_not_le_left :
    ¬ leftContinuation ⊔ rightContinuation ≤
      leftContinuation := by
  intro ordered
  have rightInJoin :
      WithOmegaScott.toOmegaScott
            (show TwoPointCpo from true) ∈
        carrier
          (leftContinuation ⊔ rightContinuation) := by
    exact rightContinuation_le_join
      ((mem_principalRaw_iff _ _).mpr le_rfl)
  have rightInLeft := ordered rightInJoin
  have impossible :=
    (mem_principalRaw_iff
      (show TwoPointCpo from true)
      (show TwoPointCpo from false)).mp rightInLeft
  exact Bool.noConfusion impossible

theorem joinedContinuation_not_le_right :
    ¬ leftContinuation ⊔ rightContinuation ≤
      rightContinuation := by
  intro ordered
  have leftInJoin :
      WithOmegaScott.toOmegaScott
            (show TwoPointCpo from false) ∈
        carrier
          (leftContinuation ⊔ rightContinuation) := by
    exact leftContinuation_le_join
      ((mem_principalRaw_iff _ _).mpr le_rfl)
  have leftInRight := ordered leftInJoin
  have impossible :=
    (mem_principalRaw_iff
      (show TwoPointCpo from false)
      (show TwoPointCpo from true)).mp leftInRight
  exact Bool.noConfusion impossible

/--
Concrete same-head obstruction used to justify the deterministic-trie
boundary: merged and split continuations are distinct lower computations.
-/
theorem concrete_same_head_branching_no_go :
    principalRaw
        (leftContinuation ⊔ rightContinuation) ≠
      principalRaw leftContinuation ⊔
        principalRaw rightContinuation :=
  principal_merged_ne_split
    (leftContinuation ⊔ rightContinuation)
    leftContinuation rightContinuation
    joinedContinuation_not_le_left
    joinedContinuation_not_le_right

/-- May observation that forgets how an outer continuation was branched. -/
def TwoPointMay
    (computation :
      OmegaScottPower TwoPointContinuation)
    (observed : Bool) : Prop :=
  ∃ continuation : TwoPointContinuation,
    WithOmegaScott.toOmegaScott continuation ∈
      carrier computation ∧
    WithOmegaScott.toOmegaScott
        (show TwoPointCpo from observed) ∈
      carrier continuation

/--
Despite the denotational inequality above, both non-canonical lower-power
shapes expose the same base may observations.  This is a kernel counterexample
to separating these two shapes by `TwoPointMay`.  Applying it to a larger raw
syntax additionally requires a definability theorem showing that both shapes
occur as denotations; this theorem deliberately makes no such claim.
-/
theorem concrete_same_head_may_equivalent
    (observed : Bool) :
    TwoPointMay
        (principalRaw
          (leftContinuation ⊔ rightContinuation))
        observed ↔
      TwoPointMay
        (principalRaw leftContinuation ⊔
          principalRaw rightContinuation)
        observed := by
  cases observed with
  | false =>
      constructor <;> intro _
      · refine ⟨leftContinuation, ?_, ?_⟩
        · exact
            (show
              principalRaw leftContinuation ≤
                principalRaw leftContinuation ⊔
                  principalRaw rightContinuation
              from le_sup_left)
              ((mem_principalRaw_iff _ _).mpr le_rfl)
        · exact (mem_principalRaw_iff _ _).mpr le_rfl
      · refine ⟨leftContinuation, ?_, ?_⟩
        · exact
            (mem_principalRaw_iff _ _).mpr
              leftContinuation_le_join
        · exact (mem_principalRaw_iff _ _).mpr le_rfl
  | true =>
      constructor <;> intro _
      · refine ⟨rightContinuation, ?_, ?_⟩
        · exact
            (show
              principalRaw rightContinuation ≤
                principalRaw leftContinuation ⊔
                  principalRaw rightContinuation
              from le_sup_right)
              ((mem_principalRaw_iff _ _).mpr le_rfl)
        · exact (mem_principalRaw_iff _ _).mpr le_rfl
      · refine ⟨rightContinuation, ?_, ?_⟩
        · exact
            (mem_principalRaw_iff _ _).mpr
              rightContinuation_le_join
        · exact (mem_principalRaw_iff _ _).mpr le_rfl

/-! ## Guarded tau approximants and their actual omega-limit -/

/-- At the empty finite-name world, tau is the only trie label. -/
def tauOnlyActive : PrefixLabel 0 → Bool
  | .tau => true
  | .output channel _ => Fin.elim0 channel

def tauOnlyBranch {depth : Nat}
    (next : PrefixTrie 0 depth) :
    PrefixLabel 0 → PrefixTrie 0 depth
  | .tau => next
  | .output channel _ => Fin.elim0 channel

/-- Finite unfoldings of the guarded equation `X = τ.X`. -/
def guardedTauApprox : (depth : Nat) → PrefixTrie 0 depth
  | 0 => .dead
  | depth + 1 =>
      .node tauOnlyActive
        (tauOnlyBranch (guardedTauApprox depth))

theorem prefixLabelZero_eq_tau
    (label : PrefixLabel 0) :
    label = .tau := by
  cases label with
  | tau => rfl
  | output channel value =>
      exact Fin.elim0 channel

theorem prefixLabelZero_univ :
    (Finset.univ : Finset (PrefixLabel 0)).toList =
      [.tau] := by
  classical
  have allSingleton :
      (Finset.univ : Finset (PrefixLabel 0)) =
        {.tau} := by
    ext label
    simp [prefixLabelZero_eq_tau label]
  rw [allSingleton]
  simp

@[simp]
theorem guardedTauApprox_succ_denote
    (depth : Nat) :
    (guardedTauApprox (depth + 1)).denote =
      fixedTauAgent 0
        (guardedTauApprox depth).denote := by
  apply agentUnfold_injective 0
  rw [fixedTauAgent_unfold]
  change
    agentUnfold.app 0
        ((PrefixTrie.node tauOnlyActive
          (tauOnlyBranch (guardedTauApprox depth))).denote) =
      principalRaw
        (tauAction 0
          (guardedTauApprox depth).denote)
  rw [PrefixTrie.denote_node_unfold,
    prefixLabelZero_univ]
  simp [chooseLayer, tauOnlyActive, tauOnlyBranch,
    PrefixLabel.semanticAction]

theorem fixedInactive_le_agent
    {world : Nat} (agent : Agent.obj world) :
    fixedInactive world ≤ agent := by
  calc
    fixedInactive world =
        agentFold.app world
          (fixedBottomLayer world) := rfl
    _ ≤ agentFold.app world
          (agentUnfold.app world agent) := by
      apply (agentFold.app world).monotone
      intro value member
      change
        value ∈
          (∅ : Set
            (WithOmegaScott
              (ActionRepresentation Agent world)))
        at member
      exact member.elim
    _ = agent :=
      concreteActualAlgebraicCompactnessWitness.fixed.unfold_fold
        world agent

theorem guardedTauApprox_denote_mono
    (depth : Nat) :
    (guardedTauApprox depth).denote ≤
      (guardedTauApprox (depth + 1)).denote := by
  induction depth with
  | zero =>
      have inactive :
          (guardedTauApprox 0).denote =
            fixedInactive 0 := by
        simpa [guardedTauApprox, PrefixTrie.denote,
          PrefixTrie.compile] using
          supportedDenote_zero 0
      rw [inactive]
      exact fixedInactive_le_agent _
  | succ depth induction =>
      rw [guardedTauApprox_succ_denote,
        guardedTauApprox_succ_denote]
      exact (fixedTauContinuous 0).monotone induction

/-- The actual semantic chain of guarded finite unfoldings. -/
def guardedTauAgentChain : Chain (Agent.obj 0) where
  toFun depth := (guardedTauApprox depth).denote
  monotone' := by
    intro first second ordered
    induction ordered with
    | refl =>
        exact le_rfl
    | @step upper ordered induction =>
        exact le_trans induction
          (guardedTauApprox_denote_mono upper)

/-- Actual omega-CPO limit of the guarded tau unfoldings. -/
def guardedTauLimit : Agent.obj 0 :=
  ωSup guardedTauAgentChain

theorem guardedTauApprox_le_limit
    (depth : Nat) :
    (guardedTauApprox depth).denote ≤
      guardedTauLimit :=
  le_ωSup guardedTauAgentChain depth

/--
The omega-limit is a genuine solution of the guarded equation `X = τ.X`.
Both inequalities use the actual omega-continuity of `fixedTauContinuous`;
this is stronger than merely declaring the supremum of the approximants.
-/
theorem guardedTauLimit_fixed :
    fixedTauAgent 0 guardedTauLimit = guardedTauLimit := by
  unfold guardedTauLimit
  apply le_antisymm
  · change
      (fixedTauContinuous 0).toFun
          (ωSup guardedTauAgentChain) ≤
        ωSup guardedTauAgentChain
    rw [(fixedTauContinuous 0).map_ωSup'
      guardedTauAgentChain]
    apply ωSup_le
    intro depth
    change
      fixedTauAgent 0 (guardedTauApprox depth).denote ≤
        ωSup guardedTauAgentChain
    rw [← guardedTauApprox_succ_denote depth]
    exact le_ωSup guardedTauAgentChain (depth + 1)
  · apply ωSup_le
    intro depth
    cases depth with
    | zero =>
        change
          (guardedTauApprox 0).denote ≤
            fixedTauAgent 0 (ωSup guardedTauAgentChain)
        have inactive :
            (guardedTauApprox 0).denote =
              fixedInactive 0 := by
          simpa [guardedTauApprox, PrefixTrie.denote,
            PrefixTrie.compile] using
            supportedDenote_zero 0
        rw [inactive]
        exact fixedInactive_le_agent _
    | succ depth =>
        change
          (guardedTauApprox (depth + 1)).denote ≤
            fixedTauAgent 0 (ωSup guardedTauAgentChain)
        rw [guardedTauApprox_succ_denote]
        exact
          (fixedTauContinuous 0).monotone
            (le_ωSup guardedTauAgentChain depth)

theorem guardedTauApprox_path_iff_length
    (depth : Nat) (labels : List (PrefixLabel 0)) :
    (guardedTauApprox depth).Path labels ↔
      labels.length ≤ depth := by
  induction depth generalizing labels with
  | zero =>
      cases labels with
      | nil =>
          simp [guardedTauApprox, PrefixTrie.Path]
      | cons label rest =>
          cases label with
          | tau =>
              simp [guardedTauApprox, PrefixTrie.Path]
          | output channel value =>
              exact Fin.elim0 channel
  | succ depth induction =>
      cases labels with
      | nil =>
          simp [PrefixTrie.Path]
      | cons label rest =>
          cases label with
          | tau =>
              simpa [guardedTauApprox, PrefixTrie.Path,
                tauOnlyActive, tauOnlyBranch,
                Nat.succ_le_succ_iff] using
                induction rest
          | output channel value =>
              exact Fin.elim0 channel

/-- Every finite tau word appears at its exact length approximant. -/
theorem guardedTau_word_at_finite_stage
    (word : PrefixWord 0) :
    (guardedTauApprox word.labels.length).NativeObserves
      word := by
  rw [nativeObserves_iff_observes]
  exact
    (guardedTauApprox_path_iff_length
      word.labels.length word.labels).mpr le_rfl

/--
Finite-observation adequacy of the actual omega-limit.  The right side is
phrased only through genuine native paths of finite compiled approximants.
-/
theorem guardedTau_limit_finite_observation
    (word : PrefixWord 0) :
    AgentObserves guardedTauLimit word ↔
      ∃ depth,
        (guardedTauApprox depth).NativeObserves word := by
  constructor
  · intro _
    exact
      ⟨word.labels.length,
        guardedTau_word_at_finite_stage word⟩
  · rintro ⟨depth, native⟩
    have structural :
        (guardedTauApprox depth).Observes word :=
      (nativeObserves_iff_observes
        (guardedTauApprox depth) word).mp native
    have semantic :
        AgentObserves
          (guardedTauApprox depth).denote word :=
      (actualAgent_prefix_adequacy
        (guardedTauApprox depth) word).mpr structural
    exact
      semantic.mono
        (guardedTauApprox_le_limit depth)
        word.labels

/-- A concrete nonempty native observation used to exclude a vacuous limit. -/
def singletonTauWord : PrefixWord 0 :=
  ⟨[.tau], by simp⟩

theorem guardedTauLimit_observes_tau :
    AgentObserves guardedTauLimit singletonTauWord := by
  rw [guardedTau_limit_finite_observation]
  exact
    ⟨1, guardedTau_word_at_finite_stage singletonTauWord⟩

theorem fixedInactive_not_observes_tau :
    ¬ AgentObserves (fixedInactive 0) singletonTauWord := by
  intro observed
  change AgentPath (fixedInactive 0) [.tau] at observed
  simp only [AgentPath] at observed
  rcases observed with ⟨continuation, member, _⟩
  rw [fixedInactive_unfold] at member
  change
    WithOmegaScott.toOmegaScott
          (PrefixLabel.tau.semanticAction continuation) ∈
      (∅ : Set
        (WithOmegaScott
          (ActionRepresentation Agent 0)))
    at member
  exact member

/-- The guarded solution is not the inactive/bottom Agent. -/
theorem guardedTauLimit_ne_inactive :
    guardedTauLimit ≠ fixedInactive 0 := by
  intro collapsed
  apply fixedInactive_not_observes_tau
  rw [← collapsed]
  exact guardedTauLimit_observes_tau

end Cantilune.Pi.FMSActualAgentPrefixFullAbstraction
