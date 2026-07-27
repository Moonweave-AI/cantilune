import Cantilune.Pi.P1bLinkedCoreResidual

/-!
# Linked endpoint normalization for the first P1b handshake

This module isolates the strongest endpoint theorem available before the
requesting structural orbit itself has been classified.  The public subject,
offered session, and payload occurrence are the fixed protocol names.  The
outer input binder and residual payload binder remain explicit, together with
the standard late freshness and capture-avoidance inequalities.

The four native communication presentations are covered:

* `syncLeft` and `syncRight`, with both restrictions already outside;
* `closeLeft` and `closeRight`, where `open`/`close` creates the session
  restriction.

Their exact endpoints normalize to `closedHandshakeResult.erase`.  The proof
uses only alpha conversion, parallel commutativity, restriction congruence
and permutation, scope extrusion, and removal/insertion of a genuinely fresh
restriction.  It does not assume that an endpoint is already structurally
canonical, and it does not classify arbitrary source-side `Late.Struct`
representatives.
-/

namespace Cantilune.Pi.P1bLinkedEndpointNormalization

open Cantilune.Pi.Protocols
open Cantilune.Pi.P1bRequestingNormalForm
open Cantilune.Pi.P1bLinkedCoreResidual

/--
The binder/subject/payload incidence retained by the linked requesting core.

`outerBinder` is consumed by the first communication. `residualBinder`
binds the payload received by the remaining input prefix.  The three
inequalities are sufficient for the exact standard-late communication and
for avoiding alpha-renaming during its substitution.
-/
structure LinkedIncidence where
  outerBinder : Name
  residualBinder : Name
  outerBinder_ne_session :
    outerBinder ≠ session
  outerBinder_ne_payload :
    outerBinder ≠ payload
  residualBinder_ne_session :
    residualBinder ≠ session

/-- The protocol's concrete binders inhabit the incidence interface. -/
def canonicalIncidence : LinkedIncidence where
  outerBinder := sessionBinder
  residualBinder := payloadBinder
  outerBinder_ne_session := by decide
  outerBinder_ne_payload := by decide
  residualBinder_ne_session := by decide

/-- The endpoint family is non-vacuous. -/
theorem linkedIncidence_nonempty : Nonempty LinkedIncidence :=
  ⟨canonicalIncidence⟩

/-- The fixed output continuation selected by a linked incidence. -/
def linkedOutput : Raw.Proc :=
  .send session payload .zero

/-- The residual input continuation, retaining its explicit payload binder. -/
def linkedInput (incidence : LinkedIncidence) : Raw.Proc :=
  .recv session incidence.residualBinder .zero

/-- Output-first exact endpoint of `syncLeft` or `closeLeft`. -/
def linkedPair (incidence : LinkedIncidence) : Raw.Proc :=
  .par linkedOutput (linkedInput incidence)

/-- Input-first exact endpoint of `syncRight` or `closeRight`. -/
def linkedCrossedPair (incidence : LinkedIncidence) : Raw.Proc :=
  .par (linkedInput incidence) linkedOutput

/-- Output-left/input-right source of the ordinary communication rule. -/
def syncLeftSource (incidence : LinkedIncidence) : Raw.Proc :=
  directCore
    publicName session incidence.outerBinder payload
    incidence.residualBinder

/-- Input-left/output-right source of the ordinary communication rule. -/
def syncRightSource (incidence : LinkedIncidence) : Raw.Proc :=
  crossedCore
    publicName session incidence.outerBinder payload
    incidence.residualBinder

/--
Output-left/input-right source whose session offer is opened before closing
against the public input.
-/
def closeLeftSource (incidence : LinkedIncidence) : Raw.Proc :=
  .par
    (.new session
      (outputThread publicName session payload))
    (inputThread
      publicName incidence.outerBinder incidence.residualBinder)

/-- The left/right mirror of `closeLeftSource`. -/
def closeRightSource (incidence : LinkedIncidence) : Raw.Proc :=
  .par
    (inputThread
      publicName incidence.outerBinder incidence.residualBinder)
    (.new session
      (outputThread publicName session payload))

namespace LinkedIncidence

/-- The explicit late-input freshness premise of all four communication rules. -/
theorem binderFresh (incidence : LinkedIncidence) :
    incidence.outerBinder ∉ linkedOutput.freeNames := by
  exact outputResidual_binderFresh
    session incidence.outerBinder payload
    incidence.outerBinder_ne_session
    incidence.outerBinder_ne_payload

/-- The exact non-renaming branch of capture-avoiding substitution. -/
theorem captureSafe (incidence : LinkedIncidence) :
    (Raw.Proc.recv
      incidence.outerBinder incidence.residualBinder .zero).captureRisk
      incidence.outerBinder session = false := by
  exact inputContinuation_captureSafe
    incidence.outerBinder session incidence.residualBinder
    incidence.residualBinder_ne_session

end LinkedIncidence

/-! ## Exact native endpoints -/

/-- `syncLeft` produces the linked output-first pair exactly. -/
theorem syncLeft_native
    (incidence : LinkedIncidence) :
    Late.NativeStep
      (syncLeftSource incidence)
      .tau
      (linkedPair incidence) := by
  simpa [syncLeftSource, linkedPair, linkedOutput, linkedInput,
    pairProcess] using
    (direct_native_tau
      publicName session incidence.outerBinder payload
      incidence.residualBinder
      incidence.binderFresh
      incidence.captureSafe)

/-- `syncRight` produces the linked input-first pair exactly. -/
theorem syncRight_native
    (incidence : LinkedIncidence) :
    Late.NativeStep
      (syncRightSource incidence)
      .tau
      (linkedCrossedPair incidence) := by
  simpa [syncRightSource, linkedCrossedPair, linkedOutput, linkedInput,
    crossedResidual] using
    (crossed_native_tau
      publicName session incidence.outerBinder payload
      incidence.residualBinder
      incidence.binderFresh
      incidence.captureSafe)

/--
The receiver source does not contain the offered session freely before the
first communication.  This is the `closeLeft`/`closeRight`
`freshForReceiver` premise.
-/
theorem session_fresh_for_inputThread
    (incidence : LinkedIncidence) :
    session ∉
      (inputThread
        publicName incidence.outerBinder
        incidence.residualBinder).freeNames := by
  simp [inputThread, Raw.Proc.freeNames, session, publicName]

/-- `open` followed by `closeLeft` creates the session restriction exactly. -/
theorem closeLeft_native
    (incidence : LinkedIncidence) :
    Late.NativeStep
      (closeLeftSource incidence)
      .tau
      (.new session (linkedPair incidence)) := by
  have opened :
      Late.NativeStep
        (.new session
          (outputThread publicName session payload))
        (.boundOutput publicName session)
        linkedOutput := by
    apply Late.NativeStep.open
    · decide
    · exact Late.NativeStep.prefixOutput
  have received :
      Late.NativeStep
        (inputThread
          publicName incidence.outerBinder incidence.residualBinder)
        (.input publicName incidence.outerBinder)
        (.recv incidence.outerBinder incidence.residualBinder .zero) :=
    Late.NativeStep.prefixInput
  have closed :=
    Late.NativeStep.closeLeft
      opened received
      (session_fresh_for_inputThread incidence)
      incidence.binderFresh
  rw [inputContinuation_substitution
    incidence.outerBinder session incidence.residualBinder
    incidence.captureSafe] at closed
  simpa [closeLeftSource, linkedPair, linkedOutput, linkedInput] using closed

/-- `open` followed by `closeRight` creates the crossed session pair exactly. -/
theorem closeRight_native
    (incidence : LinkedIncidence) :
    Late.NativeStep
      (closeRightSource incidence)
      .tau
      (.new session (linkedCrossedPair incidence)) := by
  have received :
      Late.NativeStep
        (inputThread
          publicName incidence.outerBinder incidence.residualBinder)
        (.input publicName incidence.outerBinder)
        (.recv incidence.outerBinder incidence.residualBinder .zero) :=
    Late.NativeStep.prefixInput
  have opened :
      Late.NativeStep
        (.new session
          (outputThread publicName session payload))
        (.boundOutput publicName session)
        linkedOutput := by
    apply Late.NativeStep.open
    · decide
    · exact Late.NativeStep.prefixOutput
  have closed :=
    Late.NativeStep.closeRight
      received opened
      (session_fresh_for_inputThread incidence)
      incidence.binderFresh
  rw [inputContinuation_substitution
    incidence.outerBinder session incidence.residualBinder
    incidence.captureSafe] at closed
  simpa [closeRightSource, linkedCrossedPair, linkedOutput, linkedInput] using
    closed

/-! ## Restriction congruence and permutation -/

/-- `wrapNews` composes over list append. -/
theorem wrapNews_append
    (left right : List Name) (process : Raw.Proc) :
    wrapNews (left ++ right) process =
      wrapNews left (wrapNews right process) := by
  induction left with
  | nil =>
      rfl
  | cons binder rest inductionHypothesis =>
      simp [wrapNews, inductionHypothesis]

/-- Structural congruence is preserved by every restriction in `wrapNews`. -/
theorem wrapNews_struct
    (binders : List Name)
    (relation : Late.Struct left right) :
    Late.Struct
      (wrapNews binders left)
      (wrapNews binders right) := by
  induction binders with
  | nil =>
      exact relation
  | cons binder rest inductionHypothesis =>
      simpa [wrapNews] using
        (Late.Struct.new inductionHypothesis)

/--
Any permutation of a finite restriction list is structurally congruent.
No `Nodup` premise is needed: swapping equal adjacent binders is reflexive,
while swapping distinct binders is exactly `Late.Struct.newComm`.
-/
theorem wrapNews_struct_of_perm
    {left right : List Name}
    (permutation : left.Perm right)
    (process : Raw.Proc) :
    Late.Struct
      (wrapNews left process)
      (wrapNews right process) := by
  induction permutation with
  | nil =>
      exact Late.Struct.refl process
  | cons binder permutation inductionHypothesis =>
      simpa [wrapNews] using
        (Late.Struct.new inductionHypothesis)
  | swap first second rest =>
      by_cases equal : first = second
      · subst second
        exact Late.Struct.refl _
      · simpa [wrapNews] using
          (Late.Struct.newComm
            (body := wrapNews rest process)
            (Ne.symm equal))
  | trans first second firstInduction secondInduction =>
      exact Late.Struct.trans firstInduction secondInduction

/--
A list of genuinely irrelevant restrictions can be removed without a
distinctness or no-duplicate assumption.  Freshness is stated against the
unwrapped process and is propagated inward by
`not_mem_freeNames_wrapNews`.
-/
theorem wrapNews_all_fresh_normalizes
    (binders : List Name)
    (process : Raw.Proc)
    (allFresh :
      ∀ binder, binder ∈ binders → binder ∉ process.freeNames) :
    Late.Struct (wrapNews binders process) process := by
  induction binders with
  | nil =>
      exact Late.Struct.refl process
  | cons binder rest inductionHypothesis =>
      have binderFreshBase :
          binder ∉ process.freeNames :=
        allFresh binder (by simp)
      have binderFreshWrapped :
          binder ∉ (wrapNews rest process).freeNames :=
        not_mem_freeNames_wrapNews rest binderFreshBase
      have restFresh :
          ∀ name, name ∈ rest → name ∉ process.freeNames := by
        intro name member
        exact allFresh name (by simp [member])
      exact Late.Struct.trans
        (wrapNews_bound_name_normalizes
          binder rest process binderFreshWrapped)
        (inductionHypothesis restFresh)

/-! ## Binder alpha-normalization -/

/-- The explicit residual input binder alpha-normalizes to `payloadBinder`. -/
theorem linkedInput_struct_canonical
    (incidence : LinkedIncidence) :
    Late.Struct
      (linkedInput incidence)
      (.recv session payloadBinder .zero) := by
  apply Late.Struct.alpha
  simpa [linkedInput, Raw.Proc.renameBound, Raw.Proc.substRaw] using
    (Late.Alpha.recvBinder
      (ch := session)
      (binder := incidence.residualBinder)
      (body := Raw.Proc.zero)
      (replacement := payloadBinder)
      (by simp [Raw.Proc.allNames]))

/-- The linked output-first pair alpha-normalizes to the canonical pair. -/
theorem linkedPair_struct_canonical
    (incidence : LinkedIncidence) :
    Late.Struct
      (linkedPair incidence)
      (pairProcess session payload payloadBinder) := by
  simpa [linkedPair, linkedOutput, linkedInput, pairProcess] using
    (Late.Struct.par
      (Late.Struct.refl linkedOutput)
      (linkedInput_struct_canonical incidence))

/-- Parallel commutativity normalizes the crossed pair before binder alpha. -/
theorem linkedCrossedPair_struct_linkedPair
    (incidence : LinkedIncidence) :
    Late.Struct
      (linkedCrossedPair incidence)
      (linkedPair incidence) := by
  simpa [linkedCrossedPair, linkedPair] using
    (Late.Struct.parComm :
      Late.Struct
        (.par (linkedInput incidence) linkedOutput)
        (.par linkedOutput (linkedInput incidence)))

/-- The canonical wrapped raw pair is definitionally the protocol endpoint. -/
theorem canonical_wrapped_pair_eq :
    wrapNews [publicName, session]
      (pairProcess session payload payloadBinder) =
      closedHandshakeResult.erase := by
  rfl

/-! ## Exact essential-restriction endpoint forms -/

/--
An output-first linked pair under any permutation of the public/session
restrictions normalizes to the fixed closed endpoint.
-/
theorem wrapped_linkedPair_struct_canonical
    (incidence : LinkedIncidence)
    {restrictions : List Name}
    (order :
      restrictions.Perm [publicName, session]) :
    Late.Struct
      (wrapNews restrictions (linkedPair incidence))
      closedHandshakeResult.erase := by
  have reordered :
      Late.Struct
        (wrapNews restrictions (linkedPair incidence))
        (wrapNews [publicName, session] (linkedPair incidence)) :=
    wrapNews_struct_of_perm order (linkedPair incidence)
  have renamed :
      Late.Struct
        (wrapNews [publicName, session] (linkedPair incidence))
        (wrapNews [publicName, session]
          (pairProcess session payload payloadBinder)) :=
    wrapNews_struct [publicName, session]
      (linkedPair_struct_canonical incidence)
  rw [canonical_wrapped_pair_eq] at renamed
  exact Late.Struct.trans reordered renamed

/-- The crossed pair has the same normalized endpoint. -/
theorem wrapped_linkedCrossedPair_struct_canonical
    (incidence : LinkedIncidence)
    {restrictions : List Name}
    (order :
      restrictions.Perm [publicName, session]) :
    Late.Struct
      (wrapNews restrictions (linkedCrossedPair incidence))
      closedHandshakeResult.erase := by
  exact Late.Struct.trans
    (wrapNews_struct restrictions
      (linkedCrossedPair_struct_linkedPair incidence))
    (wrapped_linkedPair_struct_canonical incidence order)

/--
For a `closeLeft` endpoint, the session restriction created by `close` is
appended after the pre-existing outer restrictions.  Its complete list must
be a permutation of exactly the public/session pair.
-/
theorem closeLeftEndpoint_struct_canonical
    (incidence : LinkedIncidence)
    (outer : List Name)
    (order :
      (outer ++ [session]).Perm [publicName, session]) :
    Late.Struct
      (wrapNews outer (.new session (linkedPair incidence)))
      closedHandshakeResult.erase := by
  simpa [wrapNews_append, wrapNews] using
    (wrapped_linkedPair_struct_canonical incidence order)

/-- The corresponding crossed close endpoint normalizes identically. -/
theorem closeRightEndpoint_struct_canonical
    (incidence : LinkedIncidence)
    (outer : List Name)
    (order :
      (outer ++ [session]).Perm [publicName, session]) :
    Late.Struct
      (wrapNews outer (.new session (linkedCrossedPair incidence)))
      closedHandshakeResult.erase := by
  simpa [wrapNews_append, wrapNews] using
    (wrapped_linkedCrossedPair_struct_canonical incidence order)

/-! ## Scope-extruded and fresh-restriction presentations -/

/--
Endpoint presentation with the now-unused public restriction localized on
the output residual, inside the session restriction.
-/
def publicOnOutputEndpoint
    (incidence : LinkedIncidence) : Raw.Proc :=
  .new session
    (.par
      (.new publicName linkedOutput)
      (linkedInput incidence))

/-- The mirror presentation with public localized on the input residual. -/
def publicOnInputEndpoint
    (incidence : LinkedIncidence) : Raw.Proc :=
  .new session
    (.par
      linkedOutput
      (.new publicName (linkedInput incidence)))

/-- The public name is absent from the output residual. -/
theorem public_fresh_linkedOutput :
    publicName ∉ linkedOutput.freeNames := by
  decide

/-- The public name is absent from every linked input residual. -/
theorem public_fresh_linkedInput
    (incidence : LinkedIncidence) :
    publicName ∉ (linkedInput incidence).freeNames := by
  simp [linkedInput, Raw.Proc.freeNames, publicName, session]

/--
Scope extrusion collects a public restriction localized on the output;
parallel commutativity restores output-first order, and `newComm` restores
the canonical public-outside-session nesting.
-/
theorem publicOnOutputEndpoint_struct_wrapped
    (incidence : LinkedIncidence) :
    Late.Struct
      (publicOnOutputEndpoint incidence)
      (wrapNews [publicName, session] (linkedPair incidence)) := by
  have collected :
      Late.Struct
        (.par
          (.new publicName linkedOutput)
          (linkedInput incidence))
        (.new publicName
          (.par linkedOutput (linkedInput incidence))) := by
    apply Late.Struct.trans Late.Struct.parComm
    apply Late.Struct.trans
      (Late.Struct.symm
        (Late.Struct.scopeExtrude
          (public_fresh_linkedInput incidence)))
    exact Late.Struct.new Late.Struct.parComm
  have underSession :
      Late.Struct
        (publicOnOutputEndpoint incidence)
        (.new session
          (.new publicName (linkedPair incidence))) := by
    simpa [publicOnOutputEndpoint, linkedPair] using
      (Late.Struct.new collected)
  have reordered :
      Late.Struct
        (.new session
          (.new publicName (linkedPair incidence)))
        (wrapNews [publicName, session] (linkedPair incidence)) := by
    simpa [wrapNews] using
      (Late.Struct.newComm
        (body := linkedPair incidence)
        (by decide : session ≠ publicName))
  exact Late.Struct.trans underSession reordered

/--
The input-localized public restriction is collected directly by the inverse
scope-extrusion law and then reordered with the session restriction.
-/
theorem publicOnInputEndpoint_struct_wrapped
    (incidence : LinkedIncidence) :
    Late.Struct
      (publicOnInputEndpoint incidence)
      (wrapNews [publicName, session] (linkedPair incidence)) := by
  have collected :
      Late.Struct
        (.par
          linkedOutput
          (.new publicName (linkedInput incidence)))
        (.new publicName
          (.par linkedOutput (linkedInput incidence))) :=
    Late.Struct.symm
      (Late.Struct.scopeExtrude public_fresh_linkedOutput)
  have underSession :
      Late.Struct
        (publicOnInputEndpoint incidence)
        (.new session
          (.new publicName (linkedPair incidence))) := by
    simpa [publicOnInputEndpoint, linkedPair] using
      (Late.Struct.new collected)
  have reordered :
      Late.Struct
        (.new session
          (.new publicName (linkedPair incidence)))
        (wrapNews [publicName, session] (linkedPair incidence)) := by
    simpa [wrapNews] using
      (Late.Struct.newComm
        (body := linkedPair incidence)
        (by decide : session ≠ publicName))
  exact Late.Struct.trans underSession reordered

/-- The output-localized public presentation normalizes to the fixed endpoint. -/
theorem publicOnOutputEndpoint_struct_canonical
    (incidence : LinkedIncidence) :
    Late.Struct
      (publicOnOutputEndpoint incidence)
      closedHandshakeResult.erase :=
  Late.Struct.trans
    (publicOnOutputEndpoint_struct_wrapped incidence)
    (wrapped_linkedPair_struct_canonical incidence
      (List.Perm.refl _))

/-- The input-localized public presentation normalizes to the fixed endpoint. -/
theorem publicOnInputEndpoint_struct_canonical
    (incidence : LinkedIncidence) :
    Late.Struct
      (publicOnInputEndpoint incidence)
      closedHandshakeResult.erase :=
  Late.Struct.trans
    (publicOnInputEndpoint_struct_wrapped incidence)
    (wrapped_linkedPair_struct_canonical incidence
      (List.Perm.refl _))

/--
Even a session-only endpoint is structurally equivalent to the canonical
closed endpoint: after binder alpha-normalization, the absent public
restriction can be inserted by symmetry of `new_fresh`.
-/
theorem sessionOnlyEndpoint_struct_canonical
    (incidence : LinkedIncidence) :
    Late.Struct
      (.new session (linkedPair incidence))
      closedHandshakeResult.erase := by
  have renamed :
      Late.Struct
        (.new session (linkedPair incidence))
        (.new session
          (pairProcess session payload payloadBinder)) :=
    Late.Struct.new (linkedPair_struct_canonical incidence)
  have publicFresh :
      publicName ∉
        (Raw.Proc.new session
          (pairProcess session payload payloadBinder)).freeNames := by
    simp [pairProcess, Raw.Proc.freeNames, publicName, session, payload]
  have inserted :
      Late.Struct
        (.new session
          (pairProcess session payload payloadBinder))
        closedHandshakeResult.erase := by
    rw [← canonical_wrapped_pair_eq]
    exact Late.Struct.symm
      (Late.Struct.new_fresh publicFresh)
  exact Late.Struct.trans renamed inserted

/-! ## The endpoint form and its normalization theorem -/

/--
Finite linked endpoint presentations admitted by this module.  The four
constructor-named cases are exact outcomes of the corresponding native rules.
The final three cases record the scope-extruded and fresh-public structural
presentations proved above.
-/
inductive LinkedEndpointForm
    (incidence : LinkedIncidence) : Raw.Proc → Prop where
  | syncLeft
      (restrictions : List Name)
      (order :
        restrictions.Perm [publicName, session]) :
      LinkedEndpointForm incidence
        (wrapNews restrictions (linkedPair incidence))
  | syncRight
      (restrictions : List Name)
      (order :
        restrictions.Perm [publicName, session]) :
      LinkedEndpointForm incidence
        (wrapNews restrictions (linkedCrossedPair incidence))
  | closeLeft
      (outer : List Name)
      (order :
        (outer ++ [session]).Perm [publicName, session]) :
      LinkedEndpointForm incidence
        (wrapNews outer (.new session (linkedPair incidence)))
  | closeRight
      (outer : List Name)
      (order :
        (outer ++ [session]).Perm [publicName, session]) :
      LinkedEndpointForm incidence
        (wrapNews outer (.new session (linkedCrossedPair incidence)))
  | publicOnOutput :
      LinkedEndpointForm incidence
        (publicOnOutputEndpoint incidence)
  | publicOnInput :
      LinkedEndpointForm incidence
        (publicOnInputEndpoint incidence)
  | sessionOnly :
      LinkedEndpointForm incidence
        (.new session (linkedPair incidence))

/--
Every explicitly linked endpoint form normalizes to
`closedHandshakeResult.erase`.  No target-side structural congruence is a
premise of this theorem.
-/
theorem LinkedEndpointForm.struct_canonical
    (form : LinkedEndpointForm incidence endpoint) :
    Late.Struct endpoint closedHandshakeResult.erase := by
  cases form with
  | syncLeft restrictions order =>
      exact wrapped_linkedPair_struct_canonical incidence order
  | syncRight restrictions order =>
      exact wrapped_linkedCrossedPair_struct_canonical incidence order
  | closeLeft outer order =>
      exact closeLeftEndpoint_struct_canonical incidence outer order
  | closeRight outer order =>
      exact closeRightEndpoint_struct_canonical incidence outer order
  | publicOnOutput =>
      exact publicOnOutputEndpoint_struct_canonical incidence
  | publicOnInput =>
      exact publicOnInputEndpoint_struct_canonical incidence
  | sessionOnly =>
      exact sessionOnlyEndpoint_struct_canonical incidence

/-! ## Native rule plus normalized endpoint, without weak closure -/

/-- `syncLeft` under an ordered restriction context, with exact endpoint. -/
theorem syncLeft_native_and_normalizes
    (incidence : LinkedIncidence)
    (restrictions : List Name)
    (order :
      restrictions.Perm [publicName, session]) :
    Late.NativeStep
        (wrapNews restrictions (syncLeftSource incidence))
        .tau
        (wrapNews restrictions (linkedPair incidence))
      ∧
    Late.Struct
        (wrapNews restrictions (linkedPair incidence))
        closedHandshakeResult.erase := by
  exact ⟨
    wrapNews_native_tau restrictions (syncLeft_native incidence),
    wrapped_linkedPair_struct_canonical incidence order
  ⟩

/-- `syncRight` under an ordered restriction context, with exact endpoint. -/
theorem syncRight_native_and_normalizes
    (incidence : LinkedIncidence)
    (restrictions : List Name)
    (order :
      restrictions.Perm [publicName, session]) :
    Late.NativeStep
        (wrapNews restrictions (syncRightSource incidence))
        .tau
        (wrapNews restrictions (linkedCrossedPair incidence))
      ∧
    Late.Struct
        (wrapNews restrictions (linkedCrossedPair incidence))
        closedHandshakeResult.erase := by
  exact ⟨
    wrapNews_native_tau restrictions (syncRight_native incidence),
    wrapped_linkedCrossedPair_struct_canonical incidence order
  ⟩

/--
`closeLeft` under an outer context whose created-session completion has the
canonical essential restriction multiset.
-/
theorem closeLeft_native_and_normalizes
    (incidence : LinkedIncidence)
    (outer : List Name)
    (order :
      (outer ++ [session]).Perm [publicName, session]) :
    Late.NativeStep
        (wrapNews outer (closeLeftSource incidence))
        .tau
        (wrapNews outer (.new session (linkedPair incidence)))
      ∧
    Late.Struct
        (wrapNews outer (.new session (linkedPair incidence)))
        closedHandshakeResult.erase := by
  exact ⟨
    wrapNews_native_tau outer (closeLeft_native incidence),
    closeLeftEndpoint_struct_canonical incidence outer order
  ⟩

/--
`closeRight` under an outer context whose created-session completion has the
canonical essential restriction multiset.
-/
theorem closeRight_native_and_normalizes
    (incidence : LinkedIncidence)
    (outer : List Name)
    (order :
      (outer ++ [session]).Perm [publicName, session]) :
    Late.NativeStep
        (wrapNews outer (closeRightSource incidence))
        .tau
        (wrapNews outer (.new session (linkedCrossedPair incidence)))
      ∧
    Late.Struct
        (wrapNews outer (.new session (linkedCrossedPair incidence)))
        closedHandshakeResult.erase := by
  exact ⟨
    wrapNews_native_tau outer (closeRight_native incidence),
    closeRightEndpoint_struct_canonical incidence outer order
  ⟩

end Cantilune.Pi.P1bLinkedEndpointNormalization
