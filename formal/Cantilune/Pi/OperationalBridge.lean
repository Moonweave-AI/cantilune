import Cantilune.Pi.Late

/-!
# Typed-kernel to standard late operational bridge

`Cantilune.Pi.Step` deliberately keeps the small executable kernel permissive:
its parallel-context and close rules do not carry every nominal freshness
premise required by the standard late LTS.  This module records exactly those
missing premises on a derivation and proves a non-circular bridge to
`Late.NativeStep`.

The target relation is independently defined in `Late.lean`; it is neither an
image of the typed relation nor a reflexive-transitive closure.  Consequently
the central theorem below preserves one strong transition.
-/

namespace Cantilune.Pi

namespace Proc

/--
If executable typed substitution succeeds, its erased result is the total
capture-avoiding raw substitution.  Success rules out the slow alpha-renaming
branch, so the equality is exact rather than merely up to alpha equivalence.
-/
theorem erase_of_substitute_eq_some
    {process target : Proc} {needle replacement : Name}
    (substitution : process.substitute needle replacement = some target) :
    target.erase =
      process.erase.substituteCaptureAvoiding needle replacement := by
  have safe : process.captureRisk needle replacement = false := by
    by_contra notSafe
    have risky : process.captureRisk needle replacement = true :=
      Bool.eq_true_of_not_eq_false notSafe
    simp [Proc.substitute, risky] at substitution
  have someEquality :
      some (process.substRaw needle replacement) = some target := by
    simpa [Proc.substitute, safe] using substitution
  have rawTarget : process.substRaw needle replacement = target :=
    Option.some.inj someEquality
  calc
    target.erase =
        (process.substRaw needle replacement).erase := by
          rw [rawTarget]
    _ = process.erase.substRaw needle replacement :=
      Proc.erase_substRaw process needle replacement
    _ = process.erase.substituteCaptureAvoiding needle replacement := by
      symm
      apply Raw.Proc.substituteCaptureAvoiding_eq_substRaw
      simpa [Proc.erase_captureRisk] using safe

end Proc

namespace Step

/--
The exact extra nominal premises needed to interpret a typed kernel
derivation as one standard strong late derivation.

There are no side conditions on prefixes, guards, choice, restriction, or
scope opening beyond those already present in `Step`.  Parallel propagation
requires freshness of bound action names in the untouched component.
Communication additionally requires the late input binder to be fresh in the
opposite derivative.  Closing a bound output also requires the extruded name
to be fresh in the receiving source.
-/
inductive StandardCompatible :
    {source : Proc} → {action : Action} → {target : Proc} →
      Step source action target → Prop
  | prefixTau {next : Proc} :
      StandardCompatible (Step.prefixTau (next := next))
  | prefixOutput {ch : Channel} {value : Name} {next : Proc} :
      StandardCompatible (Step.prefixOutput (ch := ch) (value := value) (next := next))
  | prefixInput {ch : Channel} {binder : Name} {next : Proc} :
      StandardCompatible (Step.prefixInput (ch := ch) (binder := binder) (next := next))
  | matchGuard
      {body target : Proc} {action : Action} {name : Name}
      {step : Step body action target}
      (compatible : StandardCompatible step) :
      StandardCompatible (Step.matchGuard (name := name) step)
  | mismatchGuard
      {body target : Proc} {action : Action} {left right : Name}
      {step : Step body action target}
      (distinct : left ≠ right)
      (compatible : StandardCompatible step) :
      StandardCompatible (Step.mismatchGuard distinct step)
  | choiceLeft
      {left right next : Proc} {action : Action}
      {step : Step left action next}
      (compatible : StandardCompatible step) :
      StandardCompatible (Step.choiceLeft (right := right) step)
  | choiceRight
      {left right next : Proc} {action : Action}
      {step : Step right action next}
      (compatible : StandardCompatible step) :
      StandardCompatible (Step.choiceRight (left := left) step)
  | parLeft
      {left right next : Proc} {action : Action}
      {step : Step left action next}
      (compatible : StandardCompatible step)
      (fresh :
        Disjoint
          (Raw.Action.boundNames (Action.erase action))
          (Raw.Proc.freeNames (Proc.erase right))) :
      StandardCompatible (Step.parLeft (right := right) step)
  | parRight
      {left right next : Proc} {action : Action}
      {step : Step right action next}
      (compatible : StandardCompatible step)
      (fresh :
        Disjoint
          (Raw.Action.boundNames (Action.erase action))
          (Raw.Proc.freeNames (Proc.erase left))) :
      StandardCompatible (Step.parRight (left := left) step)
  | syncLeft
      {left right left' right' right'' : Proc}
      {ch : Channel} {value binder : Name}
      {outputStep : Step left (.output ch value) left'}
      {inputStep : Step right (.input ch binder) right'}
      (substitution : right'.substitute binder value = some right'')
      (outputCompatible : StandardCompatible outputStep)
      (inputCompatible : StandardCompatible inputStep)
      (binderFresh : binder ∉ Raw.Proc.freeNames (Proc.erase left')) :
      StandardCompatible
        (Step.syncLeft outputStep inputStep substitution)
  | syncRight
      {left right left' left'' right' : Proc}
      {ch : Channel} {value binder : Name}
      {inputStep : Step left (.input ch binder) left'}
      {outputStep : Step right (.output ch value) right'}
      (substitution : left'.substitute binder value = some left'')
      (inputCompatible : StandardCompatible inputStep)
      (outputCompatible : StandardCompatible outputStep)
      (binderFresh : binder ∉ Raw.Proc.freeNames (Proc.erase right')) :
      StandardCompatible
        (Step.syncRight inputStep outputStep substitution)
  | restrict
      {binder : Name} {body next : Proc} {action : Action}
      {step : Step body action next}
      (fresh : binder ∉ action.names)
      (compatible : StandardCompatible step) :
      StandardCompatible (Step.restrict fresh step)
  | scopeOpen
      {fresh : Name} {ch : Channel} {next : Proc}
      (distinct : fresh ≠ ch.name) :
      StandardCompatible
        (Step.scopeOpen (ch := ch) (next := next) distinct)
  | scopeCloseLeft
      {left right left' right' right'' : Proc}
      {ch : Channel} {fresh binder : Name}
      {outputStep : Step left (.boundOutput ch fresh) left'}
      {inputStep : Step right (.input ch binder) right'}
      (substitution : right'.substitute binder fresh = some right'')
      (outputCompatible : StandardCompatible outputStep)
      (inputCompatible : StandardCompatible inputStep)
      (freshForReceiver : fresh ∉ Raw.Proc.freeNames (Proc.erase right))
      (binderFresh : binder ∉ Raw.Proc.freeNames (Proc.erase left')) :
      StandardCompatible
        (Step.scopeCloseLeft outputStep inputStep substitution)
  | scopeCloseRight
      {left right left' left'' right' : Proc}
      {ch : Channel} {fresh binder : Name}
      {inputStep : Step left (.input ch binder) left'}
      {outputStep : Step right (.boundOutput ch fresh) right'}
      (substitution : left'.substitute binder fresh = some left'')
      (inputCompatible : StandardCompatible inputStep)
      (outputCompatible : StandardCompatible outputStep)
      (freshForReceiver : fresh ∉ Raw.Proc.freeNames (Proc.erase left))
      (binderFresh : binder ∉ Raw.Proc.freeNames (Proc.erase right')) :
      StandardCompatible
        (Step.scopeCloseRight inputStep outputStep substitution)

/--
Every standard-compatible typed kernel derivation erases to one native strong
late derivation with the same label and exact erased endpoint.
-/
theorem erase_to_lateNative
    {source target : Proc} {action : Action}
    {step : Step source action target}
    (compatible : StandardCompatible step) :
    Late.NativeStep source.erase action.erase target.erase := by
  induction compatible with
  | prefixTau =>
      exact Late.NativeStep.prefixTau
  | prefixOutput =>
      exact Late.NativeStep.prefixOutput
  | prefixInput =>
      exact Late.NativeStep.prefixInput
  | matchGuard _ ih =>
      exact Late.NativeStep.matchGuard ih
  | mismatchGuard distinct _ ih =>
      exact Late.NativeStep.mismatchGuard distinct ih
  | choiceLeft _ ih =>
      exact Late.NativeStep.choiceLeft ih
  | choiceRight _ ih =>
      exact Late.NativeStep.choiceRight ih
  | parLeft _ fresh ih =>
      exact Late.NativeStep.parLeft fresh ih
  | parRight _ fresh ih =>
      exact Late.NativeStep.parRight fresh ih
  | syncLeft substitution _ _ binderFresh ihOutput ihInput =>
      change
        Late.NativeStep
          (.par _ _) .tau (.par _ (Proc.erase _))
      rw [Proc.erase_of_substitute_eq_some substitution]
      exact Late.NativeStep.syncLeft ihOutput ihInput binderFresh
  | syncRight substitution _ _ binderFresh ihInput ihOutput =>
      change
        Late.NativeStep
          (.par _ _) .tau (.par (Proc.erase _) _)
      rw [Proc.erase_of_substitute_eq_some substitution]
      exact Late.NativeStep.syncRight ihInput ihOutput binderFresh
  | restrict fresh _ ih =>
      apply Late.NativeStep.restrict
      · simpa [Action.erase_names] using fresh
      · exact ih
  | scopeOpen distinct =>
      apply Late.NativeStep.open
      · simpa using distinct
      · exact Late.NativeStep.prefixOutput
  | scopeCloseLeft substitution _ _ freshForReceiver binderFresh ihOutput ihInput =>
      change
        Late.NativeStep
          (.par _ _) .tau (.new _ (.par _ (Proc.erase _)))
      rw [Proc.erase_of_substitute_eq_some substitution]
      exact Late.NativeStep.closeLeft
        ihOutput ihInput freshForReceiver binderFresh
  | scopeCloseRight substitution _ _ freshForReceiver binderFresh ihInput ihOutput =>
      change
        Late.NativeStep
          (.par _ _) .tau (.new _ (.par (Proc.erase _) _))
      rw [Proc.erase_of_substitute_eq_some substitution]
      exact Late.NativeStep.closeRight
        ihInput ihOutput freshForReceiver binderFresh

/--
The corresponding theorem into the standard strong late relation modulo
alpha/structural congruence.  It is a single native step embedded in the
closure, not a weak transition.
-/
theorem erase_to_late
    {source target : Proc} {action : Action}
    {step : Step source action target}
    (compatible : StandardCompatible step) :
    Late.Step source.erase action.erase target.erase :=
  Late.Step.native (erase_to_lateNative compatible)

/--
The normative typed strong-late relation.

Unlike the older executable `Step`, membership itself contains every
freshness and capture-avoidance certificate required by the standard late
semantics.  Consequently clients cannot construct a legal typed late step
and defer `StandardCompatible` as an unrelated later assumption.
-/
def StandardNativeStep
    (source : Proc) (action : Action) (target : Proc) : Prop :=
  ∃ derivation : Step source action target,
    StandardCompatible derivation

namespace StandardNativeStep

/-- Package an executable derivation and its nominal legality certificate. -/
theorem ofCompatible
    {source target : Proc} {action : Action}
    {derivation : Step source action target}
    (compatible : StandardCompatible derivation) :
    StandardNativeStep source action target :=
  ⟨derivation, compatible⟩

/--
Every *legal* typed strong-late step erases to one native untyped standard
late step.  This theorem has no caller-supplied side condition beyond
membership in the normative relation and uses no structural or weak closure.
-/
theorem erase_operational
    {source target : Proc} {action : Action}
    (legal : StandardNativeStep source action target) :
    Late.NativeStep source.erase action.erase target.erase := by
  rcases legal with ⟨_derivation, compatible⟩
  exact erase_to_lateNative compatible

/-- The same native derivation embeds into the structural strong-late LTS. -/
theorem erase_structural
    {source target : Proc} {action : Action}
    (legal : StandardNativeStep source action target) :
    Late.Step source.erase action.erase target.erase :=
  Late.Step.native (erase_operational legal)

end StandardNativeStep

/--
Stable central theorem name: legal typed π transitions erase to native
standard late-π transitions at exactly one-step granularity.
-/
theorem standard_typed_pi_erasure_operational
    {source target : Proc} {action : Action}
    (legal : StandardNativeStep source action target) :
    Late.NativeStep source.erase action.erase target.erase :=
  StandardNativeStep.erase_operational legal

end Step

end Cantilune.Pi
