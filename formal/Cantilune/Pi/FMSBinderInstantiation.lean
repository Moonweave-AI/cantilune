import Cantilune.Pi.FMSCanonicalHidingSyntax

/-!
# Capture-avoiding instantiation of locally nameless FMS binders

Input and restriction bodies in `SupportedProc` carry one additional bound
name.  This module removes a selected binder by substituting a scoped name,
shifting both the selected binder and the replacement correctly below nested
binders.  Two public specializations provide the known-name and genuinely
fresh continuations used by the FMS input action.
-/

namespace Cantilune.Pi.FMSBinderInstantiation

open Cantilune.Pi.FMSContext

namespace ScopedName

/--
Replace the distinguished last name of an extended finite world.

This is an arbitrary name map, rather than a morphism of the finite-injection
world category: choosing an existing `replacement` intentionally identifies
the fresh last name with that existing name.
-/
def instantiateLast
    (replacement : Fin source) :
    Fin (source + 1) → Fin source :=
  Fin.lastCases replacement id

@[simp]
theorem instantiateLast_last
    (replacement : Fin source) :
    instantiateLast replacement (Fin.last source) = replacement := by
  simp [instantiateLast]

@[simp]
theorem instantiateLast_castSucc
    (replacement : Fin source)
    (name : Fin source) :
    instantiateLast replacement name.castSucc = name := by
  simp [instantiateLast]

/-- Shift every existing bound name below a newly crossed binder. -/
def liftBound :
    ScopedName free bound → ScopedName free (bound + 1)
  | .free name => .free name
  | .bound index => .bound index.castSucc

/--
Remove `binder`, replacing it by `replacement`; all other bound indices are
transported through the canonical `succAbove` complement.
-/
def substituteBinder
    (binder : Fin (bound + 1))
    (replacement : ScopedName free bound) :
    ScopedName free (bound + 1) → ScopedName free bound
  | .free name => .free name
  | .bound index =>
      Fin.succAboveCases binder replacement
        (fun old => .bound old) index

@[simp]
theorem substituteBinder_selected
    (binder : Fin (bound + 1))
    (replacement : ScopedName free bound) :
    substituteBinder binder replacement (.bound binder) = replacement := by
  simp [substituteBinder]

@[simp]
theorem substituteBinder_other
    (binder : Fin (bound + 1))
    (replacement : ScopedName free bound)
    (old : Fin bound) :
    substituteBinder binder replacement (.bound (binder.succAbove old)) =
      .bound old := by
  simp [substituteBinder]

/--
Abstracting the distinguished last free name after instantiating `binder`
with that name restores the original scoped name.

The `succAbove` complement is essential here: below a nested binder the
selected outer binder is generally not the last bound index.
-/
theorem abstractLast_substituteBinder_renameFree
    (binder : Fin (bound + 1))
    (name : ScopedName free (bound + 1)) :
    FMSCanonicalHidingSyntax.ScopedName.abstractLast binder
        (substituteBinder binder (.free (Fin.last free))
          (ScopedName.renameFree Fin.castSucc name)) =
      name := by
  cases name with
  | free name =>
      simp [substituteBinder,
        FMSCanonicalHidingSyntax.ScopedName.abstractLast]
  | bound index =>
      induction index using binder.succAboveCases
      · simp [substituteBinder,
          FMSCanonicalHidingSyntax.ScopedName.abstractLast]
      · simp [substituteBinder,
          FMSCanonicalHidingSyntax.ScopedName.abstractLast]

end ScopedName

namespace SupportedProc

/-- Capture-avoiding removal of one selected binder throughout a process. -/
def substituteBinderWith
    (binder : Fin (bound + 1))
    (replacement : ScopedName free bound) :
    SupportedProc free (bound + 1) → SupportedProc free bound
  | .zero => .zero
  | .tau next =>
      .tau (substituteBinderWith binder replacement next)
  | .input channel body =>
      .input
        (ScopedName.substituteBinder binder replacement channel)
        (substituteBinderWith binder.castSucc
          (ScopedName.liftBound replacement) body)
  | .output channel value next =>
      .output
        (ScopedName.substituteBinder binder replacement channel)
        (ScopedName.substituteBinder binder replacement value)
        (substituteBinderWith binder replacement next)
  | .choice left right =>
      .choice
        (substituteBinderWith binder replacement left)
        (substituteBinderWith binder replacement right)
  | .parallel left right =>
      .parallel
        (substituteBinderWith binder replacement left)
        (substituteBinderWith binder replacement right)
  | .restrict body =>
      .restrict
        (substituteBinderWith binder.castSucc
          (ScopedName.liftBound replacement) body)
  | .matchEq left right next =>
      .matchEq
        (ScopedName.substituteBinder binder replacement left)
        (ScopedName.substituteBinder binder replacement right)
        (substituteBinderWith binder replacement next)
  | .matchNe left right next =>
      .matchNe
        (ScopedName.substituteBinder binder replacement left)
        (ScopedName.substituteBinder binder replacement right)
        (substituteBinderWith binder replacement next)

/-- Instantiate the sole outer binder with a known name in the same world. -/
def instantiateOuter
    (received : Fin world)
    (body : SupportedProc world 1) :
    SupportedProc world 0 :=
  substituteBinderWith (Fin.last 0) (.free received) body

/--
Interpret the sole outer binder as the genuinely fresh last name of the
extended world.
-/
def freshenOuter
    (body : SupportedProc world 1) :
    SupportedProc (world + 1) 0 :=
  substituteBinderWith (Fin.last 0) (.free (Fin.last world))
    (SupportedProc.renameFree Fin.castSucc body)

private def abstractionInstantiationRoundtripProperty {free : Nat} :
    {bound : Nat} → SupportedProc free bound → Prop
  | 0, _ => True
  | bound + 1, process =>
      ∀ binder : Fin (bound + 1),
        FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith binder
            (substituteBinderWith binder (.free (Fin.last free))
              (SupportedProc.renameFree Fin.castSucc process)) =
          process

private theorem abstractionInstantiationRoundtrip_all
    {bound : Nat}
    (process : SupportedProc free bound) :
    abstractionInstantiationRoundtripProperty process := by
  induction process with
  | @zero bound =>
      cases bound with
      | zero => trivial
      | succ bound =>
          intro binder
          simp [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith]
  | @tau bound next ih =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.tau.injEq]
          exact ih binder
  | @input bound channel body ih =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.input.injEq]
          constructor
          · exact ScopedName.abstractLast_substituteBinder_renameFree
              binder channel
          · exact ih binder.castSucc
  | @output bound channel value next ih =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.output.injEq]
          exact ⟨
            ScopedName.abstractLast_substituteBinder_renameFree
              binder channel,
            ScopedName.abstractLast_substituteBinder_renameFree
              binder value,
            ih binder⟩
  | @choice bound left right leftIH rightIH =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.choice.injEq]
          exact ⟨leftIH binder, rightIH binder⟩
  | @parallel bound left right leftIH rightIH =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.parallel.injEq]
          exact ⟨leftIH binder, rightIH binder⟩
  | @restrict bound body ih =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.restrict.injEq]
          exact ih binder.castSucc
  | @matchEq bound left right next ih =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.matchEq.injEq]
          exact ⟨
            ScopedName.abstractLast_substituteBinder_renameFree binder left,
            ScopedName.abstractLast_substituteBinder_renameFree binder right,
            ih binder⟩
  | @matchNe bound left right next ih =>
      cases bound with
      | zero => simp [abstractionInstantiationRoundtripProperty]
      | succ bound =>
          intro binder
          simp only [SupportedProc.renameFree, substituteBinderWith,
            FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith,
            SupportedProc.matchNe.injEq]
          exact ⟨
            ScopedName.abstractLast_substituteBinder_renameFree binder left,
            ScopedName.abstractLast_substituteBinder_renameFree binder right,
            ih binder⟩

/--
Abstracting the last fresh free name after substituting it for an arbitrary
selected binder restores the original process at every binder depth.
-/
theorem abstractLastWith_substituteBinderWith_renameFree
    (process : SupportedProc free (bound + 1))
    (binder : Fin (bound + 1)) :
    FMSCanonicalHidingSyntax.SupportedProc.abstractLastWith binder
        (substituteBinderWith binder (.free (Fin.last free))
          (SupportedProc.renameFree Fin.castSucc process)) =
      process :=
  abstractionInstantiationRoundtrip_all process binder

/--
Freshening the sole outer binder and then canonically hiding that last name
is exactly the original restriction, including below nested binders.
-/
theorem restrictLast_freshenOuter
    (body : SupportedProc world 1) :
    FMSCanonicalHidingSyntax.SupportedProc.restrictLast
        (freshenOuter body) =
      (.restrict body : SupportedProc world 0) := by
  simp only [
    FMSCanonicalHidingSyntax.SupportedProc.restrictLast,
    freshenOuter]
  exact congrArg SupportedProc.restrict
    (abstractLastWith_substituteBinderWith_renameFree
      body (Fin.last 0))

@[simp]
theorem instantiateOuter_bound_name
    (received : Fin world) :
    instantiateOuter received
        (.output (.bound (Fin.last 0)) (.bound (Fin.last 0)) .zero) =
      (.output (.free received) (.free received) .zero :
        SupportedProc world 0) := by
  simp [instantiateOuter, substituteBinderWith,
    ScopedName.substituteBinder]

@[simp]
theorem freshenOuter_bound_name :
    freshenOuter
        (.output (.bound (Fin.last 0)) (.bound (Fin.last 0)) .zero :
          SupportedProc world 1) =
      (.output (.free (Fin.last world)) (.free (Fin.last world)) .zero :
        SupportedProc (world + 1) 0) := by
  simp [freshenOuter, substituteBinderWith,
    ScopedName.substituteBinder, SupportedProc.renameFree]

end SupportedProc

end Cantilune.Pi.FMSBinderInstantiation
