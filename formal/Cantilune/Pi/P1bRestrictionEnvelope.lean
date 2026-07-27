import Cantilune.Pi.P1bRequestingNominalOrbit
import Cantilune.Pi.P1bLinkedEndpointNormalization

/-!
# Restriction envelopes for the P1b requesting orbit

The restriction list exposed by a structural normalizer is not literally
forced to contain exactly the public and session binders.  Structural
congruence may insert fresh or duplicate restrictions, and scope extrusion
may move the session restriction into the output thread.

This module proves the support-theoretic part of the envelope argument.  If
the unwrapped core has exactly two bound interface names and one surviving
payload name, then every restriction list producing just that payload
decomposes into:

* one occurrence of each essential binder; and
* a list of restrictions fresh for the essential envelope.

The complete list is structurally congruent to the two-binder envelope.  A
one-binder version covers the scope-extruded `open`/`close` presentation.

The final section gives a kernel-checked counterexample to the stronger
claim that every outer normal-form list contains both essential binders.  It
also records the correct exact `LinkedEndpointForm` target for that genuine
native `closeLeft` step.  No transition is transported across structural
congruence and no weak closure is used.
-/

namespace Cantilune.Pi.P1bRestrictionEnvelope

open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bRequestingFingerprint
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bLinkedCoreResidual
open Cantilune.Pi.P1bLinkedEndpointNormalization

/-- Free names of a restriction list are exactly the unbound free names. -/
theorem mem_freeNames_wrapNews_iff
    (name : Name) (binders : List Name) (process : Raw.Proc) :
    name ∈ (wrapNews binders process).freeNames ↔
      name ∉ binders ∧ name ∈ process.freeNames := by
  induction binders with
  | nil =>
      simp [wrapNews]
  | cons binder rest inductionHypothesis =>
      simp only [wrapNews, Raw.Proc.freeNames, Finset.mem_erase,
        List.mem_cons, not_or]
      rw [inductionHypothesis]
      aesop

/--
Data extracted from a restriction list whose core has two essential bound
interface names and one surviving free payload.
-/
structure PairEnvelopeDecomposition
    (binders : List Name)
    (core : Raw.Proc)
    (first second payloadName : Name) where
  garbage : List Name
  permutation :
    binders.Perm (garbage ++ [first, second])
  first_mem : first ∈ binders
  second_mem : second ∈ binders
  payload_not_mem : payloadName ∉ binders
  essential_freeNames :
    (wrapNews [first, second] core).freeNames = {payloadName}
  garbage_fresh :
    ∀ name, name ∈ garbage →
      name ∉ (wrapNews [first, second] core).freeNames
  normalized :
    Late.Struct
      (wrapNews binders core)
      (wrapNews [first, second] core)

/--
Support-complete two-binder restriction normalization.

No no-duplicate hypothesis is required.  Extra occurrences of either
essential binder become fresh after one occurrence of both has been moved to
the inside of the garbage list.
-/
def pairEnvelopeDecomposition
    (binders : List Name)
    (core : Raw.Proc)
    (first second payloadName : Name)
    (first_ne_second : first ≠ second)
    (first_ne_payload : first ≠ payloadName)
    (second_ne_payload : second ≠ payloadName)
    (coreSupport :
      core.freeNames = insert first (insert second {payloadName}))
    (wrappedSupport :
      (wrapNews binders core).freeNames = {payloadName}) :
    PairEnvelopeDecomposition
      binders core first second payloadName := by
  have payloadNotMem : payloadName ∉ binders := by
    have payloadFreeWrapped :
        payloadName ∈ (wrapNews binders core).freeNames :=
      by rw [wrappedSupport]; simp
    exact
      (mem_freeNames_wrapNews_iff
        payloadName binders core).1 payloadFreeWrapped |>.1
  have firstMem : first ∈ binders := by
    by_contra firstNotMem
    have firstFreeCore : first ∈ core.freeNames := by
      rw [coreSupport]
      simp
    have firstFreeWrapped :
        first ∈ (wrapNews binders core).freeNames :=
      (mem_freeNames_wrapNews_iff first binders core).2
        ⟨firstNotMem, firstFreeCore⟩
    rw [wrappedSupport] at firstFreeWrapped
    simp [first_ne_payload] at firstFreeWrapped
  have secondMem : second ∈ binders := by
    by_contra secondNotMem
    have secondFreeCore : second ∈ core.freeNames := by
      rw [coreSupport]
      simp
    have secondFreeWrapped :
        second ∈ (wrapNews binders core).freeNames :=
      (mem_freeNames_wrapNews_iff second binders core).2
        ⟨secondNotMem, secondFreeCore⟩
    rw [wrappedSupport] at secondFreeWrapped
    simp [second_ne_payload] at secondFreeWrapped
  let garbage := (binders.erase first).erase second
  have secondMemAfterFirst : second ∈ binders.erase first := by
    simp [secondMem, Ne.symm first_ne_second]
  have essentialPermutation :
      binders.Perm (first :: second :: garbage) := by
    exact
      (List.perm_cons_erase firstMem).trans
        ((List.perm_cons_erase secondMemAfterFirst).cons first)
  have permutation :
      binders.Perm (garbage ++ [first, second]) := by
    apply essentialPermutation.trans
    simpa [garbage] using
      (List.perm_append_comm :
        ([first, second] ++ garbage).Perm
          (garbage ++ [first, second]))
  have essentialFreeNames :
      (wrapNews [first, second] core).freeNames = {payloadName} := by
    ext name
    rw [mem_freeNames_wrapNews_iff]
    rw [coreSupport]
    simp only [List.mem_cons, List.not_mem_nil, or_false,
      Finset.mem_insert, Finset.mem_singleton]
    aesop
  have garbageSubset :
      ∀ name, name ∈ garbage → name ∈ binders := by
    intro name member
    exact List.mem_of_mem_erase
      (List.mem_of_mem_erase member)
  have garbageFresh :
      ∀ name, name ∈ garbage →
        name ∉ (wrapNews [first, second] core).freeNames := by
    intro name member nameFree
    rw [essentialFreeNames] at nameFree
    have nameEq : name = payloadName := by
      simpa using nameFree
    subst name
    exact payloadNotMem (garbageSubset payloadName member)
  have permuted :
      Late.Struct
        (wrapNews binders core)
        (wrapNews (garbage ++ [first, second]) core) :=
    wrapNews_struct_of_perm permutation core
  have garbageNormalizes :
      Late.Struct
        (wrapNews garbage (wrapNews [first, second] core))
        (wrapNews [first, second] core) :=
    wrapNews_all_fresh_normalizes
      garbage
      (wrapNews [first, second] core)
      garbageFresh
  have normalized :
      Late.Struct
        (wrapNews binders core)
        (wrapNews [first, second] core) := by
    apply Late.Struct.trans permuted
    simpa [wrapNews_append] using garbageNormalizes
  exact {
    garbage := garbage
    permutation := permutation
    first_mem := firstMem
    second_mem := secondMem
    payload_not_mem := payloadNotMem
    essential_freeNames := essentialFreeNames
    garbage_fresh := garbageFresh
    normalized := normalized
  }

/-- One-essential-binder analogue used after session scope extrusion. -/
structure SingleEnvelopeDecomposition
    (binders : List Name)
    (core : Raw.Proc)
    (essential payloadName : Name) where
  garbage : List Name
  permutation :
    binders.Perm (garbage ++ [essential])
  essential_mem : essential ∈ binders
  payload_not_mem : payloadName ∉ binders
  essential_freeNames :
    (wrapNews [essential] core).freeNames = {payloadName}
  garbage_fresh :
    ∀ name, name ∈ garbage →
      name ∉ (wrapNews [essential] core).freeNames
  normalized :
    Late.Struct
      (wrapNews binders core)
      (wrapNews [essential] core)

/--
Support-complete normalization when the second essential restriction is
already inside one communication thread.
-/
def singleEnvelopeDecomposition
    (binders : List Name)
    (core : Raw.Proc)
    (essential payloadName : Name)
    (essential_ne_payload : essential ≠ payloadName)
    (coreSupport :
      core.freeNames = insert essential {payloadName})
    (wrappedSupport :
      (wrapNews binders core).freeNames = {payloadName}) :
    SingleEnvelopeDecomposition
      binders core essential payloadName := by
  have payloadNotMem : payloadName ∉ binders := by
    have payloadFreeWrapped :
        payloadName ∈ (wrapNews binders core).freeNames :=
      by rw [wrappedSupport]; simp
    exact
      (mem_freeNames_wrapNews_iff
        payloadName binders core).1 payloadFreeWrapped |>.1
  have essentialMem : essential ∈ binders := by
    by_contra essentialNotMem
    have essentialFreeCore : essential ∈ core.freeNames := by
      rw [coreSupport]
      simp
    have essentialFreeWrapped :
        essential ∈ (wrapNews binders core).freeNames :=
      (mem_freeNames_wrapNews_iff essential binders core).2
        ⟨essentialNotMem, essentialFreeCore⟩
    rw [wrappedSupport] at essentialFreeWrapped
    simp [essential_ne_payload] at essentialFreeWrapped
  let garbage := binders.erase essential
  have essentialPermutation :
      binders.Perm (essential :: garbage) :=
    List.perm_cons_erase essentialMem
  have permutation :
      binders.Perm (garbage ++ [essential]) := by
    apply essentialPermutation.trans
    simpa [garbage] using
      (List.perm_append_comm :
        ([essential] ++ garbage).Perm
          (garbage ++ [essential]))
  have essentialFreeNames :
      (wrapNews [essential] core).freeNames = {payloadName} := by
    ext name
    rw [mem_freeNames_wrapNews_iff]
    rw [coreSupport]
    simp only [List.mem_cons, List.not_mem_nil, or_false,
      Finset.mem_insert, Finset.mem_singleton]
    aesop
  have garbageSubset :
      ∀ name, name ∈ garbage → name ∈ binders := by
    intro name member
    exact List.mem_of_mem_erase member
  have garbageFresh :
      ∀ name, name ∈ garbage →
        name ∉ (wrapNews [essential] core).freeNames := by
    intro name member nameFree
    rw [essentialFreeNames] at nameFree
    have nameEq : name = payloadName := by
      simpa using nameFree
    subst name
    exact payloadNotMem (garbageSubset payloadName member)
  have permuted :
      Late.Struct
        (wrapNews binders core)
        (wrapNews (garbage ++ [essential]) core) :=
    wrapNews_struct_of_perm permutation core
  have garbageNormalizes :
      Late.Struct
        (wrapNews garbage (wrapNews [essential] core))
        (wrapNews [essential] core) :=
    wrapNews_all_fresh_normalizes
      garbage
      (wrapNews [essential] core)
      garbageFresh
  have normalized :
      Late.Struct
        (wrapNews binders core)
        (wrapNews [essential] core) := by
    apply Late.Struct.trans permuted
    simpa [wrapNews_append] using garbageNormalizes
  exact {
    garbage := garbage
    permutation := permutation
    essential_mem := essentialMem
    payload_not_mem := payloadNotMem
    essential_freeNames := essentialFreeNames
    garbage_fresh := garbageFresh
    normalized := normalized
  }

/-! ## Concrete sync and close envelopes -/

/-- The direct linked source has precisely the three expected free names. -/
theorem syncLeftSource_freeNames
    (incidence : LinkedIncidence) :
    (syncLeftSource incidence).freeNames =
      insert publicName (insert session {payload}) := by
  ext name
  simp [syncLeftSource, P1bLinkedCoreResidual.directCore,
    P1bLinkedCoreResidual.outputThread,
    P1bLinkedCoreResidual.inputThread, Raw.Proc.freeNames]
  aesop

/-- The left/right mirror has the same three-name support. -/
theorem syncRightSource_freeNames
    (incidence : LinkedIncidence) :
    (syncRightSource incidence).freeNames =
      insert publicName (insert session {payload}) := by
  ext name
  simp [syncRightSource, P1bLinkedCoreResidual.crossedCore,
    P1bLinkedCoreResidual.outputThread,
    P1bLinkedCoreResidual.inputThread, Raw.Proc.freeNames]
  aesop

/--
The scope-extruded linked source has only the public name and payload free;
the session is already bound inside the output branch.
-/
theorem closeLeftSource_freeNames
    (incidence : LinkedIncidence) :
    (closeLeftSource incidence).freeNames =
      insert publicName {payload} := by
  ext name
  norm_num [closeLeftSource, P1bLinkedCoreResidual.outputThread,
    P1bLinkedCoreResidual.inputThread, Raw.Proc.freeNames,
    publicName, session, payload]
  aesop

/-- The mirrored scope-extruded source has the same two-name support. -/
theorem closeRightSource_freeNames
    (incidence : LinkedIncidence) :
    (closeRightSource incidence).freeNames =
      insert publicName {payload} := by
  ext name
  norm_num [closeRightSource, P1bLinkedCoreResidual.outputThread,
    P1bLinkedCoreResidual.inputThread, Raw.Proc.freeNames,
    publicName, session, payload]
  aesop

/--
An exact `syncLeft` core with arbitrary redundant restrictions and canonical
surviving support normalizes to the two essential restrictions.
-/
def syncLeft_restriction_envelope
    (incidence : LinkedIncidence)
    (binders : List Name)
    (wrappedSupport :
      (wrapNews binders (syncLeftSource incidence)).freeNames =
        {payload}) :
    PairEnvelopeDecomposition binders
      (syncLeftSource incidence) publicName session payload :=
  pairEnvelopeDecomposition
    binders (syncLeftSource incidence) publicName session payload
    (by decide) (by decide) (by decide)
    (syncLeftSource_freeNames incidence)
    wrappedSupport

/-- Mirrored exact-sync restriction envelope. -/
def syncRight_restriction_envelope
    (incidence : LinkedIncidence)
    (binders : List Name)
    (wrappedSupport :
      (wrapNews binders (syncRightSource incidence)).freeNames =
        {payload}) :
    PairEnvelopeDecomposition binders
      (syncRightSource incidence) publicName session payload :=
  pairEnvelopeDecomposition
    binders (syncRightSource incidence) publicName session payload
    (by decide) (by decide) (by decide)
    (syncRightSource_freeNames incidence)
    wrappedSupport

/--
An exact `closeLeft` core with arbitrary redundant outer restrictions and
canonical surviving support normalizes to the public restriction.  Its
session restriction remains inside the output branch.
-/
def closeLeft_restriction_envelope
    (incidence : LinkedIncidence)
    (binders : List Name)
    (wrappedSupport :
      (wrapNews binders (closeLeftSource incidence)).freeNames =
        {payload}) :
    SingleEnvelopeDecomposition binders
      (closeLeftSource incidence) publicName payload :=
  singleEnvelopeDecomposition
    binders (closeLeftSource incidence) publicName payload
    (by decide)
    (closeLeftSource_freeNames incidence)
    wrappedSupport

/-- Mirrored exact-close restriction envelope. -/
def closeRight_restriction_envelope
    (incidence : LinkedIncidence)
    (binders : List Name)
    (wrappedSupport :
      (wrapNews binders (closeRightSource incidence)).freeNames =
        {payload}) :
    SingleEnvelopeDecomposition binders
      (closeRightSource incidence) publicName payload :=
  singleEnvelopeDecomposition
    binders (closeRightSource incidence) publicName payload
    (by decide)
    (closeRightSource_freeNames incidence)
    wrappedSupport

/-! ## Exact boundary: the outer list need not contain the session -/

/-- Scope-extruded requesting representative with only the public binder outside. -/
def closeLeftRequesting : Raw.Proc :=
  wrapNews [publicName] (closeLeftSource canonicalIncidence)

/-- Exact endpoint of the genuine native close step above. -/
def closeLeftEstablished : Raw.Proc :=
  wrapNews [publicName]
    (.new session (linkedPair canonicalIncidence))

/--
The scope-extruded source is in the canonical requesting structural orbit.
This is a structural fact only; the native step below is proved directly at
`closeLeftRequesting`.
-/
theorem canonical_struct_closeLeftRequesting :
    Late.Struct canonicalRequesting closeLeftRequesting := by
  unfold canonicalRequesting closeLeftRequesting
  simp only [closedRestrictedHandshake, restrictedHandshake, request,
    accept, requestContinuation, acceptContinuation, publicChannel,
    sessionChannel, boundSessionChannel, Proc.erase, wrapNews,
    closeLeftSource, P1bLinkedCoreResidual.outputThread,
    P1bLinkedCoreResidual.inputThread, canonicalIncidence]
  apply Late.Struct.new
  apply Late.Struct.trans
    (Late.Struct.new Late.Struct.parComm)
  apply Late.Struct.trans
    (Late.Struct.scopeExtrude (by decide))
  exact Late.Struct.parComm

/-- The close presentation takes one genuine strong-late native step. -/
theorem closeLeftRequesting_native :
    Late.NativeStep closeLeftRequesting .tau closeLeftEstablished := by
  simpa [closeLeftRequesting, closeLeftEstablished] using
    wrapNews_native_tau [publicName]
      (closeLeft_native canonicalIncidence)

/-- The exact native endpoint is one admitted linked endpoint form. -/
theorem closeLeftEstablished_linkedEndpoint :
    LinkedEndpointForm canonicalIncidence closeLeftEstablished := by
  unfold closeLeftEstablished
  exact LinkedEndpointForm.closeLeft [publicName] (by decide)

/--
The outer restriction list `[publicName]` cannot decompose into garbage plus
both essential binders.  Thus the stronger outer-list-only statement is
false even for a structural representative with a genuine native P1b step.
-/
theorem closeLeft_outer_list_has_no_two_binder_decomposition :
    ¬ ∃ garbage : List Name,
      ([publicName] : List Name).Perm
        (garbage ++ [publicName, session]) := by
  rintro ⟨garbage, permutation⟩
  have lengths :
      1 = garbage.length + 2 := by
    simpa using permutation.length_eq
  omega

/--
Kernel-checked boundary package: source congruence, one native step, exact
linked target, and failure of the false two-outer-binder decomposition.
-/
theorem outer_two_binder_claim_is_false :
    Late.Struct canonicalRequesting closeLeftRequesting ∧
      Late.NativeStep closeLeftRequesting .tau closeLeftEstablished ∧
      LinkedEndpointForm canonicalIncidence closeLeftEstablished ∧
      ¬ ∃ garbage : List Name,
        ([publicName] : List Name).Perm
          (garbage ++ [publicName, session]) := by
  exact ⟨canonical_struct_closeLeftRequesting,
    closeLeftRequesting_native,
    closeLeftEstablished_linkedEndpoint,
    closeLeft_outer_list_has_no_two_binder_decomposition⟩

end Cantilune.Pi.P1bRestrictionEnvelope
