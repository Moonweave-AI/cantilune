import Cantilune.Pi.FMSCpoUnseparatedSourceCore
import Cantilune.Pi.FMSCpoFinitePower
import Cantilune.Pi.LateGuardedReplicationDivergence
import Cantilune.Pi.FMSUnseparatedFiniteStrongNoGo
import Cantilune.Pi.FMSAllDomainDefinabilityNoGo

/-!
# Concrete finite operational full abstraction for the D1-A effect

This module gives a non-circular finite-process theorem.  Its source objects
are finite lists of nonempty late-pi action words.  A source object is
compiled to the actual raw pi syntax using prefix and binary choice.  Its
operational observation is generated only by `Late.NativeStep`.

The denotation is independently constructed in the concrete all-object
omega-Scott powerdomain: it is the finite union of principal computations of
the represented action words.  Thus the proof does not supply an arbitrary
denotation or an arbitrary observation relation.

The exact theorem is full abstraction for finite strong-trace observation on
this canonical finite-control fragment.  It is not a claim that strong trace
equivalence is late bisimilarity on the full pi calculus.  The last section
records why the D1-A nullary collapse cannot extend this equality theorem to
an observation which distinguishes inactive deadlock from guarded
divergence.
-/

noncomputable section

open scoped Classical

namespace Cantilune.Pi.FMSFiniteOperationalFullAbstraction

open Cantilune.Pi
open Cantilune.Pi.Late
open Cantilune.Pi.FMSCpoFinitePower
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoUnseparatedSourceCore
open OmegaCompletePartialOrder

/-! ## The actual recursive agent endpoint -/

/-- The already constructed continuous-natural solution of `A ≅ P(H A)`. -/
abbrev ConcreteRecursiveAgent :=
  concreteSourceAlignedUnseparatedCore
    |>.domainCompactness.fixed.agent

/--
The inactive element in the actual recursive agent is obtained by folding
the concrete D1-A bottom action computation.
-/
def concreteRecursiveInactive
    (world : FMSModel.World) :
    ConcreteRecursiveAgent.obj world :=
  (concreteSourceAlignedUnseparatedCore.foldIso.app world).hom
    (effectBottom
      (FMSCpoActionFunctor.actionCpo
        ConcreteRecursiveAgent world))

/-- Unfolding the actual inactive agent returns the actual bottom effect. -/
@[simp]
theorem concreteRecursiveInactive_unfold
    (world : FMSModel.World) :
    (concreteSourceAlignedUnseparatedCore.unfoldIso.app world).hom
        (concreteRecursiveInactive world) =
      effectBottom
        (FMSCpoActionFunctor.actionCpo
          ConcreteRecursiveAgent world) := by
  exact
    SourceAlignedUnseparatedCore.fold_unfold
      concreteSourceAlignedUnseparatedCore world _

/-! ## Canonical finite late-pi words -/

/--
A prefix label supported by the raw late LTS.

For bound output, `fresh` is accompanied by the exact side condition used by
the native `open` rule.
-/
inductive FiniteLabel where
  | tau
  | output (channel value : Name)
  | input (channel binder : Name)
  | boundOutput (channel fresh : Name) (distinct : fresh ≠ channel)
deriving DecidableEq

/-- The corresponding genuine late-pi action. -/
def FiniteLabel.action : FiniteLabel → Raw.Action
  | .tau => .tau
  | .output channel value => .output channel value
  | .input channel binder => .input channel binder
  | .boundOutput channel fresh _ => .boundOutput channel fresh

theorem FiniteLabel.action_injective :
    Function.Injective FiniteLabel.action := by
  intro left right equal
  cases left <;> cases right <;>
    simp only [FiniteLabel.action, Raw.Action.output.injEq,
      Raw.Action.input.injEq, Raw.Action.boundOutput.injEq] at equal
  all_goals simp_all

/-- Compile one supported label as a genuine raw prefix. -/
def FiniteLabel.prefix (label : FiniteLabel) (next : Raw.Proc) : Raw.Proc :=
  match label with
  | .tau => .tau next
  | .output channel value => .send channel value next
  | .input channel binder => .recv channel binder next
  | .boundOutput channel fresh _ =>
      .new fresh (.send channel fresh next)

/-- Every compiled prefix has the expected genuine strong native step. -/
theorem FiniteLabel.prefix_native
    (label : FiniteLabel) (next : Raw.Proc) :
    Late.NativeStep (label.prefix next) label.action next := by
  cases label with
  | tau =>
      exact Late.NativeStep.prefixTau
  | output channel value =>
      exact Late.NativeStep.prefixOutput
  | input channel binder =>
      exact Late.NativeStep.prefixInput
  | boundOutput channel fresh distinct =>
      exact Late.NativeStep.open distinct
        Late.NativeStep.prefixOutput

/-- A nonempty finite word of supported late actions. -/
structure Word where
  labels : List FiniteLabel
  nonempty : labels ≠ []

instance : DecidableEq Word := by
  intro left right
  cases left with
  | mk leftLabels leftNonempty =>
      cases right with
      | mk rightLabels rightNonempty =>
          exact decidable_of_iff
            (leftLabels = rightLabels) (by
              constructor
              · intro equal
                cases equal
                rfl
              · intro equal
                exact congrArg Word.labels equal)

@[ext]
theorem Word.ext
    {left right : Word}
    (equal : left.labels = right.labels) :
    left = right := by
  cases left
  cases right
  cases equal
  rfl

/-- Raw action sequence represented by a word. -/
def Word.actions (word : Word) : List Raw.Action :=
  word.labels.map FiniteLabel.action

theorem Word.actions_nonempty (word : Word) :
    word.actions ≠ [] := by
  simpa [Word.actions] using word.nonempty

theorem finiteLabel_map_injective :
    Function.Injective
      (List.map FiniteLabel.action) := by
  intro left right equal
  induction left generalizing right with
  | nil =>
      cases right with
      | nil => rfl
      | cons head tail => simp at equal
  | cons head tail induction =>
      cases right with
      | nil => simp at equal
      | cons rightHead rightTail =>
          simp only [List.map_cons, List.cons.injEq] at equal
          rcases equal with ⟨headEqual, tailEqual⟩
          have labelEqual :
              head = rightHead :=
            FiniteLabel.action_injective headEqual
          subst rightHead
          exact congrArg (List.cons head)
            (induction tailEqual)

theorem Word.actions_injective :
    Function.Injective Word.actions := by
  intro left right equal
  apply Word.ext
  exact finiteLabel_map_injective equal

/-- Compile a list of labels to a sequential raw process. -/
def compileLabels : List FiniteLabel → Raw.Proc
  | [] => .zero
  | label :: rest => label.prefix (compileLabels rest)

/-- Compile one nonempty word. -/
def compileWord (word : Word) : Raw.Proc :=
  compileLabels word.labels

/-! ## Native strong traces -/

/--
A complete finite strong trace.  The empty trace is accepted only by the
inactive process; every nonempty trace is built from actual native steps.
-/
inductive NativeTrace : Raw.Proc → List Raw.Action → Prop where
  | done : NativeTrace .zero []
  | step
      (head : Late.NativeStep source action target)
      (tail : NativeTrace target actions) :
      NativeTrace source (action :: actions)

theorem NativeTrace.zero_iff
    {actions : List Raw.Action} :
    NativeTrace .zero actions ↔ actions = [] := by
  constructor
  · intro trace
    cases trace with
    | done => rfl
    | step head tail => cases head
  · intro equal
    subst actions
    exact .done

/-- Inversion for every supported compiled prefix. -/
theorem FiniteLabel.prefix_native_iff
    (label : FiniteLabel) (next target : Raw.Proc)
    (action : Raw.Action) :
    Late.NativeStep (label.prefix next) action target ↔
      action = label.action ∧ target = next := by
  constructor
  · intro step
    cases label with
    | tau =>
        cases step
        exact ⟨rfl, rfl⟩
    | output channel value =>
        cases step
        exact ⟨rfl, rfl⟩
    | input channel binder =>
        cases step
        exact ⟨rfl, rfl⟩
    | boundOutput channel fresh distinct =>
        cases step with
        | restrict freshness inner =>
            cases inner
            simp [Raw.Action.names] at freshness
        | «open» openedDistinct inner =>
            cases inner
            exact ⟨rfl, rfl⟩
  · rintro ⟨equalAction, equalTarget⟩
    subst action
    subst target
    exact label.prefix_native next

/-- Trace inversion for one supported compiled prefix. -/
theorem nativeTrace_prefix_iff
    (label : FiniteLabel) (next : Raw.Proc)
    (actions : List Raw.Action) :
    NativeTrace (label.prefix next) actions ↔
      ∃ rest,
        actions = label.action :: rest ∧
          NativeTrace next rest := by
  cases label with
  | tau =>
      constructor
      · intro trace
        cases trace with
        | step head tail =>
            have inverted :=
              (FiniteLabel.prefix_native_iff
                .tau next _ _).mp head
            rcases inverted with ⟨rfl, rfl⟩
            exact ⟨_, rfl, tail⟩
      · rintro ⟨rest, rfl, tail⟩
        exact .step
          (FiniteLabel.prefix_native .tau next) tail
  | output channel value =>
      constructor
      · intro trace
        cases trace with
        | step head tail =>
            have inverted :=
              (FiniteLabel.prefix_native_iff
                (.output channel value) next _ _).mp head
            rcases inverted with ⟨rfl, rfl⟩
            exact ⟨_, rfl, tail⟩
      · rintro ⟨rest, rfl, tail⟩
        exact .step
          (FiniteLabel.prefix_native
            (.output channel value) next) tail
  | input channel binder =>
      constructor
      · intro trace
        cases trace with
        | step head tail =>
            have inverted :=
              (FiniteLabel.prefix_native_iff
                (.input channel binder) next _ _).mp head
            rcases inverted with ⟨rfl, rfl⟩
            exact ⟨_, rfl, tail⟩
      · rintro ⟨rest, rfl, tail⟩
        exact .step
          (FiniteLabel.prefix_native
            (.input channel binder) next) tail
  | boundOutput channel fresh distinct =>
      constructor
      · intro trace
        cases trace with
        | step head tail =>
            have inverted :=
              (FiniteLabel.prefix_native_iff
                (.boundOutput channel fresh distinct)
                next _ _).mp head
            rcases inverted with ⟨rfl, rfl⟩
            exact ⟨_, rfl, tail⟩
      · rintro ⟨rest, rfl, tail⟩
        exact .step
          (FiniteLabel.prefix_native
            (.boundOutput channel fresh distinct)
            next) tail

/-- A compiled sequential word has exactly its declared complete trace. -/
theorem nativeTrace_compileLabels_iff
    (labels : List FiniteLabel)
    (actions : List Raw.Action) :
    NativeTrace (compileLabels labels) actions ↔
      actions = labels.map FiniteLabel.action := by
  induction labels generalizing actions with
  | nil =>
      simpa [compileLabels] using
        (NativeTrace.zero_iff (actions := actions))
  | cons label rest induction =>
      constructor
      · intro trace
        obtain ⟨tailActions, rfl, tailTrace⟩ :=
          (nativeTrace_prefix_iff label
            (compileLabels rest) actions).mp trace
        have tailEqual := (induction _).mp tailTrace
        simp [tailEqual]
      · intro equal
        cases actions with
        | nil =>
            simp at equal
        | cons action actions =>
            simp only [List.map_cons, List.cons.injEq] at equal
            rcases equal with ⟨headEqual, tailEqual⟩
            subst action
            exact NativeTrace.step
              (FiniteLabel.prefix_native label
                (compileLabels rest))
              ((induction actions).mpr tailEqual)

@[simp]
theorem nativeTrace_compileWord_iff
    (source observed : Word) :
    NativeTrace (compileWord source) observed.actions ↔
      observed = source := by
  rw [compileWord, nativeTrace_compileLabels_iff]
  exact
    ⟨fun equal => Word.actions_injective equal,
      fun equal => congrArg Word.actions equal⟩

/-! ## Finite nondeterministic source processes -/

/--
A finite process is a finite list of nonempty branches.  Repetition and order
are semantically irrelevant, as proved below rather than imposed by the
definition.
-/
abbrev FiniteProcess := List Word

/-- Compile finite nondeterminism using the raw binary-choice constructor. -/
def compile : FiniteProcess → Raw.Proc
  | [] => .zero
  | word :: rest => .choice (compileWord word) (compile rest)

theorem nativeTrace_choice_iff
    {left right : Raw.Proc}
    {actions : List Raw.Action}
    (nonempty : actions ≠ []) :
    NativeTrace (.choice left right) actions ↔
      NativeTrace left actions ∨ NativeTrace right actions := by
  constructor
  · intro trace
    cases trace with
    | step head tail =>
        cases head with
        | choiceLeft first =>
            exact Or.inl (NativeTrace.step first tail)
        | choiceRight first =>
            exact Or.inr (NativeTrace.step first tail)
  · intro trace
    rcases trace with leftTrace | rightTrace
    · cases leftTrace with
      | done =>
          exact (nonempty rfl).elim
      | step head tail =>
          exact NativeTrace.step
            (Late.NativeStep.choiceLeft head) tail
    · cases rightTrace with
      | done =>
          exact (nonempty rfl).elim
      | step head tail =>
          exact NativeTrace.step
            (Late.NativeStep.choiceRight head) tail

/-- Native traces of the compiled finite choice are exactly its branches. -/
theorem nativeTrace_compile_iff
    (process : FiniteProcess) (observed : Word) :
    NativeTrace (compile process) observed.actions ↔
      observed ∈ process := by
  induction process with
  | nil =>
      rw [compile, NativeTrace.zero_iff]
      simp [Word.actions_nonempty]
  | cons word rest induction =>
      rw [compile,
        nativeTrace_choice_iff observed.actions_nonempty,
        nativeTrace_compileWord_iff,
        induction]
      simp

/-! ## Concrete D1-A powerdomain denotation -/

/-- Equality-ordered action words form an actual omega-CPO. -/
abbrev WordCPO : ωCPO :=
  ωCPO.of (EqualityOrder Word)

/-- The concrete all-object D1-A effect at the word carrier. -/
abbrev WordEffect :=
  Effect WordCPO

/-- Finite union of principals in the actual omega-Scott powerdomain. -/
def denote : FiniteProcess → WordEffect
  | [] => effectDeadlock WordCPO
  | word :: rest =>
      effectChoice WordCPO
        (principalRaw
          (show EqualityOrder Word from word))
        (denote rest)

/-- Direct membership observation on the concrete closed-set carrier. -/
def EffectObserves (computation : WordEffect) (word : Word) : Prop :=
  WithOmegaScott.toOmegaScott
      (show EqualityOrder Word from word) ∈
    carrier computation

@[simp]
theorem effectObserves_bottom_iff (word : Word) :
    EffectObserves (effectBottom WordCPO) word ↔ False := by
  constructor
  · intro member
    exact member
  · intro falseProof
    exact falseProof.elim

@[simp]
theorem effectObserves_principal_iff
    (source observed : Word) :
    EffectObserves
        (principalRaw
          (show EqualityOrder Word from source))
        observed ↔
      observed = source := by
  exact
    mem_principalRaw_iff
      (show EqualityOrder Word from observed)
      (show EqualityOrder Word from source)

@[simp]
theorem effectObserves_choice_iff
    (left right : WordEffect) (word : Word) :
    EffectObserves
        (effectChoice WordCPO left right) word ↔
      EffectObserves left word ∨ EffectObserves right word := by
  rfl

@[simp]
theorem effectObserves_denote_iff
    (process : FiniteProcess) (word : Word) :
    EffectObserves (denote process) word ↔
      word ∈ process := by
  induction process with
  | nil =>
      simpa [denote, effectDeadlock] using
        (effectObserves_bottom_iff word)
  | cons head tail induction =>
      rw [denote, effectObserves_choice_iff,
        effectObserves_principal_iff, induction]
      simp

/--
Finite-process adequacy: concrete effect membership is exactly the complete
strong native trace of the independently compiled raw process.
-/
theorem finite_adequacy
    (process : FiniteProcess) (word : Word) :
    EffectObserves (denote process) word ↔
      NativeTrace (compile process) word.actions := by
  rw [effectObserves_denote_iff, nativeTrace_compile_iff]

/-- Equality of concrete finite denotations is equality of finite languages. -/
theorem denote_eq_iff_toFinset_eq
    (left right : FiniteProcess) :
    denote left = denote right ↔
      left.toFinset = right.toFinset := by
  constructor
  · intro equal
    ext word
    rw [List.mem_toFinset, List.mem_toFinset]
    rw [← effectObserves_denote_iff,
      ← effectObserves_denote_iff, equal]
  · intro equal
    apply SetLike.ext
    intro lifted
    let word : Word :=
      WithOmegaScott.ofOmegaScott lifted
    have liftedEqual :
        WithOmegaScott.toOmegaScott
            (show EqualityOrder Word from word) =
          lifted :=
      WithOmegaScott.toOmegaScott_ofOmegaScott lifted
    constructor
    · intro member
      rw [← liftedEqual] at member
      have observedLeft :
          EffectObserves (denote left) word := by
        exact member
      have memberLeft : word ∈ left :=
        (effectObserves_denote_iff left word).mp
          observedLeft
      have memberRight : word ∈ right := by
        simpa only [List.mem_toFinset] using
          (Finset.ext_iff.mp equal word).mp
            (by simpa only [List.mem_toFinset] using memberLeft)
      have observedRight :
          EffectObserves (denote right) word :=
        (effectObserves_denote_iff right word).mpr
          memberRight
      change
        WithOmegaScott.toOmegaScott
            (show EqualityOrder Word from word) ∈
          carrier (denote right)
        at observedRight
      rw [liftedEqual] at observedRight
      exact observedRight
    · intro member
      rw [← liftedEqual] at member
      have observedRight :
          EffectObserves (denote right) word := by
        exact member
      have memberRight : word ∈ right :=
        (effectObserves_denote_iff right word).mp
          observedRight
      have memberLeft : word ∈ left := by
        simpa only [List.mem_toFinset] using
          (Finset.ext_iff.mp equal word).mpr
            (by simpa only [List.mem_toFinset] using memberRight)
      have observedLeft :
          EffectObserves (denote left) word :=
        (effectObserves_denote_iff left word).mpr
          memberLeft
      change
        WithOmegaScott.toOmegaScott
            (show EqualityOrder Word from word) ∈
          carrier (denote left)
        at observedLeft
      rw [liftedEqual] at observedLeft
      exact observedLeft

/--
The operational equivalence is defined solely through the actual native
transition system, not through denotational equality.
-/
def OperationallyEquivalent
    (left right : FiniteProcess) : Prop :=
  ∀ word : Word,
    NativeTrace (compile left) word.actions ↔
      NativeTrace (compile right) word.actions

theorem operationallyEquivalent_iff_toFinset_eq
    (left right : FiniteProcess) :
    OperationallyEquivalent left right ↔
      left.toFinset = right.toFinset := by
  constructor
  · intro equivalent
    ext word
    rw [List.mem_toFinset, List.mem_toFinset]
    rw [← nativeTrace_compile_iff,
      ← nativeTrace_compile_iff]
    exact equivalent word
  · intro equal word
    rw [nativeTrace_compile_iff,
      nativeTrace_compile_iff]
    simpa only [List.mem_toFinset] using
      (Finset.ext_iff.mp equal word)

/--
Concrete finite full abstraction for native strong-trace observation.
-/
theorem finite_complete_trace_full_abstraction
    (left right : FiniteProcess) :
    denote left = denote right ↔
      OperationallyEquivalent left right := by
  rw [denote_eq_iff_toFinset_eq,
    operationallyEquivalent_iff_toFinset_eq]

/-! ## Bottom/Hoare-compatible finite observation -/

/-- All nonempty prefixes of one label list, represented again as words. -/
def prefixWords : List FiniteLabel → List Word
  | [] => []
  | label :: rest =>
      ⟨[label], by simp⟩ ::
        (prefixWords rest).map fun word =>
          ⟨label :: word.labels, by simp⟩

/-- Membership in the executable prefix list is exactly list prefix. -/
theorem mem_prefixWords_iff
    (observed : Word) (source : List FiniteLabel) :
    observed ∈ prefixWords source ↔
      observed.labels <+: source := by
  induction source generalizing observed with
  | nil =>
      constructor
      · intro member
        simp [prefixWords] at member
      · intro prefixProof
        obtain ⟨suffix, appended⟩ := prefixProof
        have equal : observed.labels = [] :=
          (List.eq_nil_of_append_eq_nil appended).1
        exact (observed.nonempty equal).elim
  | cons label rest induction =>
      constructor
      · intro member
        simp only [prefixWords, List.mem_cons,
          List.mem_map] at member
        rcases member with equal | ⟨tailWord, tailMember, equal⟩
        · subst observed
          simp
        · subst observed
          simp only [List.cons_prefix_cons]
          exact
            ⟨True.intro,
              (induction tailWord).mp tailMember⟩
      · intro prefixProof
        rw [List.prefix_cons_iff] at prefixProof
        rcases prefixProof with empty | ⟨tail, equal, tailPrefix⟩
        · exact (observed.nonempty empty).elim
        · have tailCases : tail = [] ∨ tail ≠ [] :=
            eq_or_ne tail []
          simp only [prefixWords, List.mem_cons,
            List.mem_map]
          rcases tailCases with rfl | tailNonempty
          · left
            apply Word.ext
            simpa using equal
          · let tailWord : Word :=
              ⟨tail, tailNonempty⟩
            right
            refine ⟨tailWord, ?_, ?_⟩
            · exact (induction tailWord).mpr tailPrefix
            · apply Word.ext
              simpa [tailWord] using equal.symm

/-- Prefix reflection through the injective supported-label encoding. -/
theorem finiteLabel_map_prefix_iff
    (observed source : List FiniteLabel) :
    observed.map FiniteLabel.action <+:
        source.map FiniteLabel.action ↔
      observed <+: source := by
  constructor
  · intro prefixProof
    induction observed generalizing source with
    | nil =>
        exact List.nil_prefix
    | cons head tail induction =>
        cases source with
        | nil =>
            have impossible :=
              List.IsPrefix.length_le prefixProof
            simp at impossible
        | cons sourceHead sourceTail =>
            change
              (FiniteLabel.action head ::
                  tail.map FiniteLabel.action) <+:
                (FiniteLabel.action sourceHead ::
                  sourceTail.map FiniteLabel.action)
              at prefixProof
            rw [List.cons_prefix_cons] at prefixProof
            rw [List.cons_prefix_cons]
            exact
              ⟨FiniteLabel.action_injective prefixProof.1,
                induction sourceTail prefixProof.2⟩
  · exact fun prefixProof =>
      prefixProof.map FiniteLabel.action

/-- General complete-trace characterization for arbitrary action lists. -/
theorem nativeTrace_compile_general_iff
    (process : FiniteProcess)
    (actions : List Raw.Action)
    (nonempty : actions ≠ []) :
    NativeTrace (compile process) actions ↔
      ∃ word ∈ process, actions = word.actions := by
  induction process generalizing actions with
  | nil =>
      rw [compile, NativeTrace.zero_iff]
      simp [nonempty]
  | cons word rest induction =>
      rw [compile, nativeTrace_choice_iff nonempty]
      constructor
      · intro trace
        rcases trace with wordTrace | restTrace
        · refine ⟨word, by simp, ?_⟩
          exact
            (nativeTrace_compileLabels_iff
              word.labels actions).mp wordTrace
        · obtain ⟨branch, member, equal⟩ :=
            (induction actions nonempty).mp restTrace
          exact ⟨branch, by simp [member], equal⟩
      · rintro ⟨branch, member, equal⟩
        simp only [List.mem_cons] at member
        rcases member with branchEqual | member
        · subst branch
          left
          exact
            (nativeTrace_compileLabels_iff
              word.labels actions).mpr equal
        · right
          exact
            (induction actions nonempty).mpr
              ⟨branch, member, equal⟩

/--
An operational may-prefix observation: the observed word can be extended to
a complete strong native trace.  This definition mentions only compiled raw
syntax and `Late.NativeStep`.
-/
def OperationalMayPrefix
    (process : FiniteProcess) (observed : Word) : Prop :=
  ∃ remaining : List Raw.Action,
    NativeTrace (compile process)
      (observed.actions ++ remaining)

theorem operationalMayPrefix_iff
    (process : FiniteProcess) (observed : Word) :
    OperationalMayPrefix process observed ↔
      ∃ branch ∈ process,
        observed.labels <+: branch.labels := by
  constructor
  · rintro ⟨remaining, trace⟩
    have nonempty :
        observed.actions ++ remaining ≠ [] := by
      intro equal
      have : observed.actions = [] :=
        (List.eq_nil_of_append_eq_nil equal).1
      exact observed.actions_nonempty this
    obtain ⟨branch, member, equal⟩ :=
      (nativeTrace_compile_general_iff
        process (observed.actions ++ remaining)
        nonempty).mp trace
    refine ⟨branch, member, ?_⟩
    apply
      (finiteLabel_map_prefix_iff
        observed.labels branch.labels).mp
    exact ⟨remaining, equal⟩
  · rintro ⟨branch, member, prefixProof⟩
    have actionPrefix :
        observed.actions <+: branch.actions := by
      exact
        (finiteLabel_map_prefix_iff
          observed.labels branch.labels).mpr prefixProof
    obtain ⟨remaining, equal⟩ := actionPrefix
    refine ⟨remaining, ?_⟩
    exact
      (nativeTrace_compile_general_iff
        process (observed.actions ++ remaining)
        (by
          intro empty
          have : observed.actions = [] :=
            (List.eq_nil_of_append_eq_nil empty).1
          exact observed.actions_nonempty this)).mpr
        ⟨branch, member, equal⟩

/-- Finite prefix closure of all source branches. -/
def wordPrefixes : Word → List Word
  | ⟨labels, _⟩ => prefixWords labels

@[simp]
theorem mem_wordPrefixes_iff
    (observed source : Word) :
    observed ∈ wordPrefixes source ↔
      observed.labels <+: source.labels := by
  cases source
  exact mem_prefixWords_iff observed _

def hoareLanguage (process : FiniteProcess) : FiniteProcess :=
  List.flatMap wordPrefixes process

/-- The concrete lower/Hoare observation in the D1-A effect. -/
def hoareDenote (process : FiniteProcess) : WordEffect :=
  denote (hoareLanguage process)

@[simp]
theorem effectObserves_hoareDenote_iff
    (process : FiniteProcess) (observed : Word) :
    EffectObserves (hoareDenote process) observed ↔
      ∃ branch ∈ process,
        observed.labels <+: branch.labels := by
  rw [hoareDenote, effectObserves_denote_iff]
  simp only [hoareLanguage, List.mem_flatMap]
  constructor
  · rintro ⟨branch, member, observedMember⟩
    exact
      ⟨branch, member,
        (mem_wordPrefixes_iff observed branch).mp
          observedMember⟩
  · rintro ⟨branch, member, prefixProof⟩
    exact
      ⟨branch, member,
        (mem_wordPrefixes_iff observed branch).mpr
          prefixProof⟩

/--
Hoare adequacy: membership in the independently constructed lower
powerdomain observation is exactly native strong-prefix executability.
-/
theorem finite_hoare_adequacy
    (process : FiniteProcess) (observed : Word) :
    EffectObserves (hoareDenote process) observed ↔
      OperationalMayPrefix process observed := by
  rw [effectObserves_hoareDenote_iff,
    operationalMayPrefix_iff]

/-- Operational equivalence at the D1-A-compatible observation boundary. -/
def HoareOperationallyEquivalent
    (left right : FiniteProcess) : Prop :=
  ∀ observed : Word,
    OperationalMayPrefix left observed ↔
      OperationalMayPrefix right observed

/-- Concrete finite full abstraction at the lower/Hoare boundary. -/
theorem finite_hoare_full_abstraction
    (left right : FiniteProcess) :
    hoareDenote left = hoareDenote right ↔
      HoareOperationallyEquivalent left right := by
  rw [hoareDenote, hoareDenote,
    denote_eq_iff_toFinset_eq]
  constructor
  · intro equal observed
    rw [operationalMayPrefix_iff,
      operationalMayPrefix_iff]
    have memberIff :
        observed ∈ hoareLanguage left ↔
          observed ∈ hoareLanguage right := by
      simpa only [List.mem_toFinset] using
        (Finset.ext_iff.mp equal observed)
    simpa only [hoareLanguage, List.mem_flatMap,
      mem_wordPrefixes_iff] using memberIff
  · intro equivalent
    ext observed
    simpa only [List.mem_toFinset, hoareLanguage,
      List.mem_flatMap, mem_wordPrefixes_iff,
      ← operationalMayPrefix_iff] using
      equivalent observed

/-- Every finitely generated Hoare computation has a source definition. -/
theorem finite_hoare_definability
    (generators : Finset Word) :
    ∃ process : FiniteProcess,
      hoareDenote process =
        hoareDenote generators.toList := by
  exact ⟨generators.toList, rfl⟩

/--
The generic finite strong-bisimulation obstruction applies to every monotone
D1-A tau interpretation.  This prevents promotion of the Hoare theorem above
to constructor-sensitive strong bisimilarity.
-/
theorem d1a_cannot_be_strong_bisimulation_fully_abstract
    {Carrier : Type*}
    [SemilatticeSup Carrier] [OrderBot Carrier]
    (tau : Carrier → Carrier)
    (tauMonotone : Monotone tau) :
    ¬ FMSUnseparatedFiniteStrongNoGo.StrongFullAbstract tau :=
  FMSUnseparatedFiniteStrongNoGo.not_strongFullAbstract
    tau tauMonotone

/--
The requested all-object, all-element definability strengthening is
inconsistent by diagonalization.  Finite Hoare definability above is the
maximal positive theorem unaffected by this cardinal obstruction.
-/
theorem all_domain_definability_is_impossible :
    ¬ FMSAllDomainDefinabilityNoGo.AllOmegaCpoElementsDefinable :=
  FMSAllDomainDefinabilityNoGo.not_allOmegaCpoElementsDefinable

/-! ## Definability of every finitely generated element -/

/-- The finitely generated D1-A computation determined by a finite language. -/
def compactDenotation (language : Finset Word) : WordEffect :=
  denote language.toList

theorem compactDenotation_eq_denote_toList
    (language : Finset Word) :
    compactDenotation language =
      denote language.toList := by
  rfl

/--
Every finitely generated computation of the concrete effect is denoted by an
actual finite source process.
-/
theorem finite_definability
    (language : Finset Word) :
    ∃ process : FiniteProcess,
      denote process = compactDenotation language := by
  exact
    ⟨language.toList,
      (compactDenotation_eq_denote_toList language).symm⟩

/-! ## Exact D1-A nullary boundary -/

/-- The empty finite language denotes the unique D1-A bottom computation. -/
@[simp]
theorem denote_empty_eq_effectDivergence :
    denote ([] : FiniteProcess) =
      effectDivergence WordCPO := by
  rfl

/--
The effect-level collapse coexists with the native operational separation:
inactive zero is deadlocked while replicated tau has an actual infinite
native run.  Consequently the finite full-abstraction theorem above is
intentionally scoped to finite strong traces and does not identify these two
native classifications.
-/
theorem effect_collapse_and_native_separation
    (body : RecursiveProc) :
    denote ([] : FiniteProcess) =
        effectDivergence WordCPO ∧
      RecursiveLate.OperationalDeadlocked
        (.zero : RecursiveProc) ∧
      RecursiveLate.NativeDiverges (.repTau body) ∧
      ¬ RecursiveLate.OperationalDeadlocked (.repTau body) := by
  exact
    ⟨denote_empty_eq_effectDivergence,
      RecursiveLate.zero_operationalDeadlocked,
      RecursiveLate.replicatedTau_nativeDiverges body,
      RecursiveLate.replicatedTau_not_operationalDeadlocked body⟩

/--
No equality-valued observation through the D1-A nullary computation can
reflect a native predicate that separates inactive deadlock from replicated
divergence.
-/
theorem no_nullary_reflection_of_native_separation
    (body : RecursiveProc)
    (reflects :
      denote ([] : FiniteProcess) =
          effectDivergence WordCPO →
        (RecursiveLate.OperationalDeadlocked
            (.zero : RecursiveProc) ↔
          RecursiveLate.OperationalDeadlocked (.repTau body))) :
    False := by
  have classesEqual :=
    reflects denote_empty_eq_effectDivergence
  exact
    RecursiveLate.replicatedTau_not_operationalDeadlocked body
      (classesEqual.mp RecursiveLate.zero_operationalDeadlocked)

end Cantilune.Pi.FMSFiniteOperationalFullAbstraction
