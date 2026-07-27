import Cantilune.Pi.FMSContext

/-!
# Canonical locally nameless syntax for FMS hiding

The semantic FMS restriction map consumes an abstraction with one additional
name.  This file supplies the missing syntactic half: the last free name is
turned into the binder introduced by `SupportedProc.restrict`, including
the correct index shift below nested input and restriction binders.

The construction is total, capture avoiding by typing, natural under
renaming of the remaining free names, and has the exact support equation
required by the hiding interface.
-/

namespace Cantilune.Pi.FMSCanonicalHidingSyntax

open Cantilune.Pi.FMSContext

namespace ScopedName

/--
Extend a renaming while preserving the distinguished last free name.
-/
def extendFree
    (rename : Fin source → Fin target) :
    Fin (source + 1) → Fin (target + 1) :=
  Fin.lastCases (Fin.last target) (fun old => (rename old).castSucc)

@[simp]
theorem extendFree_last
    (rename : Fin source → Fin target) :
    extendFree rename (Fin.last source) = Fin.last target := by
  simp [extendFree]

@[simp]
theorem extendFree_castSucc
    (rename : Fin source → Fin target) (old : Fin source) :
    extendFree rename old.castSucc = (rename old).castSucc := by
  simp [extendFree]

/--
Turn the distinguished last free name into `binder`.  Existing bound names
are shifted because the target context has acquired one additional binder.
-/
def abstractLast
    (binder : Fin (bound + 1)) :
    ScopedName (free + 1) bound → ScopedName free (bound + 1)
  | .free name =>
      Fin.lastCases (.bound binder) (fun old => .free old) name
  | .bound index => .bound (binder.succAbove index)

@[simp]
theorem abstractLast_free_last
    (binder : Fin (bound + 1)) :
    abstractLast binder (.free (Fin.last free)) = .bound binder := by
  simp [abstractLast]

@[simp]
theorem abstractLast_free_castSucc
    (binder : Fin (bound + 1)) (old : Fin free) :
    abstractLast binder (.free old.castSucc) = .free old := by
  simp [abstractLast]

@[simp]
theorem abstractLast_bound
    (free : Nat) (binder : Fin (bound + 1)) (index : Fin bound) :
    abstractLast (free := free) binder (.bound index) =
      .bound (binder.succAbove index) := by
  rfl

/-- Abstraction commutes with renaming of every non-distinguished free name. -/
theorem abstractLast_renameFree
    (rename : Fin source → Fin target)
    (binder : Fin (bound + 1))
    (name : ScopedName (source + 1) bound) :
    abstractLast binder (name.renameFree (extendFree rename)) =
      (abstractLast binder name).renameFree rename := by
  cases name with
  | free name =>
      refine Fin.lastCases ?_ (fun old => ?_) name
      · simp
      · simp
  | bound index =>
      rfl

/-- Exact support of a name after abstracting the last free name. -/
theorem freeSupport_abstractLast
    (binder : Fin (bound + 1))
    (name : ScopedName (free + 1) bound) :
    (abstractLast binder name).freeSupport =
      Finset.univ.filter
        (fun old : Fin free => old.castSucc ∈ name.freeSupport) := by
  cases name with
  | free name =>
      refine Fin.lastCases ?_ (fun old => ?_) name
      · ext candidate
        simp [abstractLast, ScopedName.freeSupport]
      · ext candidate
        simp [abstractLast, ScopedName.freeSupport]
  | bound index =>
      ext candidate
      simp [abstractLast, ScopedName.freeSupport]

end ScopedName

namespace SupportedProc

/--
Capture-avoiding abstraction of the last free name throughout a process.

`binder` identifies the newly inserted binder at the current syntactic
depth.  When recursion crosses a binder, it is shifted with `castSucc` while
the newly crossed binder occupies the last position.
-/
def abstractLastWith
    (binder : Fin (bound + 1)) :
    SupportedProc (free + 1) bound → SupportedProc free (bound + 1)
  | .zero => .zero
  | .tau next => .tau (abstractLastWith binder next)
  | .input channel body =>
      .input (ScopedName.abstractLast binder channel)
        (abstractLastWith binder.castSucc body)
  | .output channel value next =>
      .output
        (ScopedName.abstractLast binder channel)
        (ScopedName.abstractLast binder value)
        (abstractLastWith binder next)
  | .choice left right =>
      .choice
        (abstractLastWith binder left)
        (abstractLastWith binder right)
  | .parallel left right =>
      .parallel
        (abstractLastWith binder left)
        (abstractLastWith binder right)
  | .restrict body =>
      .restrict (abstractLastWith binder.castSucc body)
  | .matchEq left right next =>
      .matchEq
        (ScopedName.abstractLast binder left)
        (ScopedName.abstractLast binder right)
        (abstractLastWith binder next)
  | .matchNe left right next =>
      .matchNe
        (ScopedName.abstractLast binder left)
        (ScopedName.abstractLast binder right)
        (abstractLastWith binder next)

/--
The genuine syntactic restriction of a process whose last free name is the
name being hidden.
-/
def restrictLast
    (process : SupportedProc (world + 1) 0) :
    SupportedProc world 0 :=
  .restrict (abstractLastWith (Fin.last 0) process)

/-- Abstraction is natural in all free names other than the hidden one. -/
theorem abstractLastWith_renameFree
    (rename : Fin source → Fin target)
    (binder : Fin (bound + 1))
    (process : SupportedProc (source + 1) bound) :
    abstractLastWith binder
        (SupportedProc.renameFree
          (ScopedName.extendFree rename) process) =
      SupportedProc.renameFree rename
        (abstractLastWith binder process) := by
  induction process with
  | zero =>
      rfl
  | tau next ih =>
      simp [abstractLastWith, SupportedProc.renameFree, ih]
  | input channel body ih =>
      simp [abstractLastWith, SupportedProc.renameFree,
        ScopedName.abstractLast_renameFree, ih]
  | output channel value next ih =>
      simp [abstractLastWith, SupportedProc.renameFree,
        ScopedName.abstractLast_renameFree, ih]
  | choice left right leftIH rightIH =>
      simp [abstractLastWith, SupportedProc.renameFree, leftIH, rightIH]
  | parallel left right leftIH rightIH =>
      simp [abstractLastWith, SupportedProc.renameFree, leftIH, rightIH]
  | restrict body ih =>
      simp [abstractLastWith, SupportedProc.renameFree, ih]
  | matchEq left right next ih =>
      simp [abstractLastWith, SupportedProc.renameFree,
        ScopedName.abstractLast_renameFree, ih]
  | matchNe left right next ih =>
      simp [abstractLastWith, SupportedProc.renameFree,
        ScopedName.abstractLast_renameFree, ih]

/-- Canonical hiding is natural under renaming of the remaining free names. -/
theorem restrictLast_renameFree
    (rename : Fin source → Fin target)
    (process : SupportedProc (source + 1) 0) :
    restrictLast
        (SupportedProc.renameFree
          (ScopedName.extendFree rename) process) =
      SupportedProc.renameFree rename (restrictLast process) := by
  simp [restrictLast, SupportedProc.renameFree,
    abstractLastWith_renameFree]

/-- Exact remaining free support after abstraction at an arbitrary depth. -/
theorem freeSupport_abstractLastWith
    (binder : Fin (bound + 1))
    (process : SupportedProc (free + 1) bound) :
    SupportedProc.freeSupport (abstractLastWith binder process) =
      Finset.univ.filter
        (fun old : Fin free =>
          old.castSucc ∈ SupportedProc.freeSupport process) := by
  induction process with
  | zero =>
      simp [abstractLastWith, SupportedProc.freeSupport]
  | tau next ih =>
      simpa [abstractLastWith, SupportedProc.freeSupport] using ih binder
  | input channel body ih =>
      ext old
      simp [abstractLastWith, SupportedProc.freeSupport,
        ScopedName.freeSupport_abstractLast, ih]
  | output channel value next ih =>
      ext old
      simp [abstractLastWith, SupportedProc.freeSupport,
        ScopedName.freeSupport_abstractLast, ih]
  | choice left right leftIH rightIH =>
      ext old
      simp [abstractLastWith, SupportedProc.freeSupport, leftIH, rightIH]
  | parallel left right leftIH rightIH =>
      ext old
      simp [abstractLastWith, SupportedProc.freeSupport, leftIH, rightIH]
  | restrict body ih =>
      simpa [abstractLastWith, SupportedProc.freeSupport] using
        ih binder.castSucc
  | matchEq left right next ih =>
      ext old
      simp [abstractLastWith, SupportedProc.freeSupport,
        ScopedName.freeSupport_abstractLast, ih]
  | matchNe left right next ih =>
      ext old
      simp [abstractLastWith, SupportedProc.freeSupport,
        ScopedName.freeSupport_abstractLast, ih]

/-- Exact support equation used by the FMS restriction/hiding interface. -/
theorem freeSupport_restrictLast
    (process : SupportedProc (world + 1) 0) :
    SupportedProc.freeSupport (restrictLast process) =
      Finset.univ.filter
        (fun old : Fin world =>
          old.castSucc ∈ SupportedProc.freeSupport process) := by
  simpa [restrictLast, SupportedProc.freeSupport] using
    freeSupport_abstractLastWith (Fin.last 0) process

end SupportedProc

end Cantilune.Pi.FMSCanonicalHidingSyntax
