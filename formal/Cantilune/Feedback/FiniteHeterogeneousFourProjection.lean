import Cantilune.Feedback.FiniteHeterogeneousMarkedKernel
import Cantilune.Theorems.FourProjectionFamily

/-!
# Event-level four-projection bridge for heterogeneous sampled trajectories

An arbitrary `EpochChain` contains arbitrary existentially packaged
`ExecutionPackage`s.  It therefore does not, by itself, determine any of the
four projection certificates.  This module makes the missing datum exact:
`ChainFourProjectionAssignment` supplies one four-projection certificate for
each fixed-signature epoch in the chain.

Once that assignment is present, no trajectory-level replay or projection
premise is needed.  Almost every path of the canonical marked kernel carries,
at every nonterminal phase:

* the unique sampled dependent `ChainStepMark`;
* either a replayable fixed-signature `DPOEvent` occurrence with four native
  target derivations, or a separately replayable signature admission;
* runtime execution-epoch alignment; and
* the exact trace index selected by the stochastic state.

`SourceFamilyAlignment` records the precise additional equality needed to
obtain the assignment from `FourProjectionFamilies`.  The equality cannot be
derived from a bare `EpochChain`: `SomeReplayEpoch.package` is an arbitrary
field, not definitionally the source package of any projection family.

The admission constructor intentionally retains `AdmissionReplays`; it is not
recast as a same-signature `DPOEvent`.  Constructing four *target admission*
derivations requires independent heterogeneous target-admission semantics.
It cannot be achieved by identifying the new state with
`Reindexing.mapState`: pure reindexing preserves the runtime version, whereas
an admission strictly advances it, as proved below.
-/

noncomputable section

namespace Cantilune.Feedback.FiniteHeterogeneousFourProjection

open Filter MeasureTheory ProbabilityTheory
open CategoryTheory
open Cantilune.Core
open Cantilune.Core.ExecutionEpochTrace
open Cantilune.Feedback.FiniteHeterogeneousTrajectory
open Cantilune.Feedback.FiniteHeterogeneousProbability
open Cantilune.Feedback.FiniteHeterogeneousMarkedKernel
open Cantilune.Theorems

variable {universes : ProjectionUniverses}
variable {first last : SomeReplayEpoch}

/--
An actually replayed admission cannot be identified with the pure
`ReindexableExecutionFamily.reindex` state map.  This is the event-level
reason the heterogeneous trajectory retains an admission constructor instead
of coercing it to an ordinary fixed-signature step.
-/
theorem pure_reindex_ne_replayed_admission_target
    (family : ReindexableExecutionFamily)
    {sourceSignature targetSignature : FinSignature}
    (admission :
      SignatureAdmissionEvent universes
        (source := sourceSignature) (target := targetSignature))
    (source : (family.package sourceSignature).lts.State)
    (target : (family.package targetSignature).lts.State)
    (replay :
      AdmissionReplays admission
        ((family.package sourceSignature).configOf source)
        ((family.package targetSignature).configOf target)) :
    (family.reindex admission.extension).mapState source ≠ target :=
  family.pure_reindex_ne_admission_target
    admission source target replay.1 replay.target_version

/--
One four-projection certificate for every fixed-signature epoch of a concrete
heterogeneous chain.

The recursive shape prevents a certificate for one package from being reused
at a differently typed epoch.
-/
inductive ChainFourProjectionAssignment :
    {first last : SomeReplayEpoch} →
      (chain : EpochChain universes first last) → Type 2
  | single {epoch : SomeReplayEpoch}
      (certificate : FourProjectionCertificate epoch.package.lts) :
      ChainFourProjectionAssignment (.single epoch)
  | cons {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      (head : FourProjectionCertificate first.package.lts)
      (tailAssignment : ChainFourProjectionAssignment tail) :
      ChainFourProjectionAssignment (.cons boundary tail)

/--
Alignment of the existential packages in an `EpochChain` with one shared
source execution family.

This is the minimal package-level premise needed to select
`FourProjectionFamilies.certificateAt` at every epoch.
-/
inductive SourceFamilyAlignment
    (source : ReindexableExecutionFamily) :
    {first last : SomeReplayEpoch} →
      (chain : EpochChain universes first last) → Type 2
  | single {epoch : SomeReplayEpoch}
      (package_eq :
        epoch.package = source.package epoch.signature) :
      SourceFamilyAlignment source (.single epoch)
  | cons {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      (head_package_eq :
        first.package = source.package first.signature)
      (tailAlignment : SourceFamilyAlignment source tail) :
      SourceFamilyAlignment source (.cons boundary tail)

namespace ChainFourProjectionAssignment

universe vₛ vₜ uₛ uₜ

variable
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {DagCategory PetriCategory PiCategory MorphismCategory : Type uₜ}
    [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]

private def certificateOfAlignedEpoch
    (families :
      FourProjectionFamilies
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory)
    (epoch : SomeReplayEpoch)
    (package_eq :
      epoch.package = families.source.package epoch.signature) :
    FourProjectionCertificate epoch.package.lts := by
  rw [package_eq]
  exact families.certificateAt epoch.signature

/--
Turn exact package alignment into a per-epoch assignment.  No projection
certificate is selected independently of the aligned `FourProjectionFamilies`.
-/
def ofFamilies
    (families :
      FourProjectionFamilies
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory) :
    {first last : SomeReplayEpoch} →
      {chain : EpochChain universes first last} →
      SourceFamilyAlignment families.source chain →
        ChainFourProjectionAssignment chain
  | _, _, _, .single package_eq =>
      .single (certificateOfAlignedEpoch families _ package_eq)
  | _, _, _, .cons head_package_eq tailAlignment =>
      .cons
        (certificateOfAlignedEpoch families _ head_package_eq)
        (ofFamilies families tailAlignment)

end ChainFourProjectionAssignment

/-- The four native target derivations of one fixed-signature business step. -/
structure FourNativeDerivations
    {epoch : SomeReplayEpoch}
    (certificate : FourProjectionCertificate epoch.package.lts)
    {source target : epoch.package.lts.State}
    {event : epoch.package.lts.Event}
    (native : epoch.package.lts.ObservableStep source event target) : Prop where
  dag :
    certificate.dagLTS.ObservableStep
      (certificate.dag.mapState source)
      (certificate.dag.mapEvent event)
      (certificate.dag.mapState target)
  petri :
    certificate.petriLTS.ObservableStep
      (certificate.petri.mapState source)
      (certificate.petri.mapEvent event)
      (certificate.petri.mapState target)
  pi :
    certificate.piLTS.ObservableStep
      (certificate.pi.mapState source)
      (certificate.pi.mapEvent event)
      (certificate.pi.mapState target)
  morphism :
    certificate.morphismLTS.ObservableStep
      (certificate.morphism.mapState source)
      (certificate.morphism.mapEvent event)
      (certificate.morphism.mapState target)

namespace FourNativeDerivations

/-- A projection certificate computes all four derivations from one native step. -/
theorem of_step
    {epoch : SomeReplayEpoch}
    (certificate : FourProjectionCertificate epoch.package.lts)
    {source target : epoch.package.lts.State}
    {event : epoch.package.lts.Event}
    (native : epoch.package.lts.ObservableStep source event target) :
    FourNativeDerivations certificate native where
  dag := certificate.dag.sound native
  petri := certificate.petri.sound native
  pi := certificate.pi.sound native
  morphism := certificate.morphism.sound native

end FourNativeDerivations

/--
Evidence determined by one native chain step.

Business constructors retain the exact fixed-signature `DPOOccurrence` and
four native target derivations.  The admission constructor instead retains
the heterogeneous `AdmissionOccurrence`.  The types make the two cases
disjoint.
-/
inductive ProjectedChainStep :
    {first last : SomeReplayEpoch} →
      {chain : EpochChain universes first last} →
      (assignment : ChainFourProjectionAssignment chain) →
      {source target : ChainState universes chain} →
      {event : ChainEvent universes chain} →
      (native : ChainStep universes chain source event target) → Prop
  | single {epoch : SomeReplayEpoch}
      {certificate : FourProjectionCertificate epoch.package.lts}
      {source target : epoch.package.lts.State}
      {event : epoch.package.lts.Event}
      {native : epoch.package.lts.ObservableStep source event target}
      (occurrence : DPOOccurrence epoch event)
      (projected : FourNativeDerivations certificate native) :
      ProjectedChainStep
        (chain := .single epoch)
        (.single certificate) (.single native)
  | head {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      {headCertificate : FourProjectionCertificate first.package.lts}
      {tailAssignment : ChainFourProjectionAssignment tail}
      {source target : first.package.lts.State}
      {event : first.package.lts.Event}
      {native : first.package.lts.ObservableStep source event target}
      (occurrence : DPOOccurrence first event)
      (projected : FourNativeDerivations headCertificate native) :
      ProjectedChainStep
        (chain := .cons boundary tail)
        (.cons (boundary := boundary) headCertificate tailAssignment)
        (.head (boundary := boundary) (tail := tail) native)
  | admission {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {tail : EpochChain universes middle last}
      {headCertificate : FourProjectionCertificate first.package.lts}
      {tailAssignment : ChainFourProjectionAssignment tail}
      (occurrence : AdmissionOccurrence boundary) :
      ProjectedChainStep
        (chain := .cons boundary tail)
        (.cons (boundary := boundary) headCertificate tailAssignment)
        (.admission (boundary := boundary) (tail := tail))
  | tail {first middle last : SomeReplayEpoch}
      {boundary : AdjacentAdmission universes first middle}
      {rest : EpochChain universes middle last}
      {headCertificate : FourProjectionCertificate first.package.lts}
      {tailAssignment : ChainFourProjectionAssignment rest}
      {source target : ChainState universes rest}
      {event : ChainEvent universes rest}
      {native : ChainStep universes rest source event target}
      (projected :
        ProjectedChainStep tailAssignment native) :
      ProjectedChainStep
        (chain := .cons boundary rest)
        (.cons (boundary := boundary) headCertificate tailAssignment)
        (.tail (boundary := boundary) native)

namespace ProjectedChainStep

set_option maxRecDepth 10000

/--
Construct the replay-discriminated four-projection evidence from the
assignment, native edge, and replay already carried by the sampled mark.
-/
theorem of_step_replay :
    {first last : SomeReplayEpoch} →
      {chain : EpochChain universes first last} →
      (assignment : ChainFourProjectionAssignment chain) →
      {source target : ChainState universes chain} →
      {event : ChainEvent universes chain} →
      (native : ChainStep universes chain source event target) →
      EventReplay universes event →
        ProjectedChainStep assignment native
  := by
  intro first last chain assignment source target event native replay
  cases replay with
  | single occurrence =>
      cases assignment with
      | single certificate =>
          cases native with
          | single native =>
              exact
                .single occurrence
                  (FourNativeDerivations.of_step certificate native)
  | head occurrence =>
      cases assignment with
      | cons headCertificate tailAssignment =>
          cases native with
          | head native =>
              exact
                .head occurrence
                  (FourNativeDerivations.of_step headCertificate native)
  | admission occurrence =>
      cases assignment with
      | cons headCertificate tailAssignment =>
          cases native with
          | admission =>
              exact .admission occurrence
  | tail replay =>
      cases assignment with
      | cons headCertificate tailAssignment =>
          cases native with
          | tail native =>
              exact
                .tail
                  (of_step_replay tailAssignment native replay)

end ProjectedChainStep

/--
The complete common evidence at one sampled nonterminal phase.

Only the sampled edge is stored independently.  Projection evidence is
derived from its mark, its native step, and its replay constructor.
-/
structure CompleteProjectedSampledEdge
    (chain : EpochChain universes first last)
    (assignment : ChainFourProjectionAssignment chain)
    (n : Nat) (before : n < eventCount chain)
    (source target : MarkedState chain) where
  sampled :
    SampledMarkedEdge chain n before source target
  projected :
    ProjectedChainStep assignment sampled.mark.step

namespace CompleteProjectedSampledEdge

/-- Build complete evidence from the one sampled marked edge. -/
def of_sampled
    {chain : EpochChain universes first last}
    (assignment : ChainFourProjectionAssignment chain)
    {n : Nat} {before : n < eventCount chain}
    {source target : MarkedState chain}
    (sampled : SampledMarkedEdge chain n before source target) :
    CompleteProjectedSampledEdge
      chain assignment n before source target where
  sampled := sampled
  projected :=
    ProjectedChainStep.of_step_replay
      assignment sampled.mark.step sampled.eventReplay

/-- Replay is recovered from the same sampled mark used for projection. -/
theorem eventReplay
    {chain : EpochChain universes first last}
    {assignment : ChainFourProjectionAssignment chain}
    {n : Nat} {before : n < eventCount chain}
    {source target : MarkedState chain}
    (common :
      CompleteProjectedSampledEdge
        chain assignment n before source target) :
    EventReplay universes common.sampled.mark.event :=
  common.sampled.eventReplay

/-- Execution-epoch alignment is recovered from that same sampled mark. -/
theorem executionEpochAligned
    {chain : EpochChain universes first last}
    {assignment : ChainFourProjectionAssignment chain}
    {n : Nat} {before : n < eventCount chain}
    {source target : MarkedState chain}
    (common :
      CompleteProjectedSampledEdge
        chain assignment n before source target) :
    ExecutionEpochAligned universes common.sampled.mark.event :=
  common.sampled.executionEpochAligned

/--
The stochastic source state uniquely fixes the sampled dependent mark.
Consequently replay discrimination and the projected native derivations
cannot be attached to a different event after sampling.
-/
theorem mark_unique
    {chain : EpochChain universes first last}
    {assignment : ChainFourProjectionAssignment chain}
    {n : Nat} {before : n < eventCount chain}
    {source target : MarkedState chain}
    (common :
      CompleteProjectedSampledEdge
        chain assignment n before source target)
    (candidate : ChainStepMark chain)
    (candidate_sampled : source.nextMark = some candidate) :
    candidate = common.sampled.mark :=
  Option.some.inj
    (candidate_sampled.symm.trans common.sampled.sampledMark)

/-- Two complete witnesses over the same sampled source use the same mark. -/
theorem witnesses_mark_eq
    {chain : EpochChain universes first last}
    {assignment : ChainFourProjectionAssignment chain}
    {n : Nat} {before : n < eventCount chain}
    {source target : MarkedState chain}
    (left right :
      CompleteProjectedSampledEdge
        chain assignment n before source target) :
    left.sampled.mark = right.sampled.mark :=
  left.mark_unique right.sampled.mark right.sampled.sampledMark |>.symm

end CompleteProjectedSampledEdge

/--
For every finite heterogeneous epoch chain and every aligned collection of
four projection certificates, almost every marked-kernel path has complete
event-level common evidence at every business/admission phase.

No replay, epoch, mark, or target derivation is supplied at trajectory level.
-/
theorem four_projection_common_trajectory_almost_sure
    (chain : EpochChain universes first last)
    (assignment : ChainFourProjectionAssignment chain) :
    ∀ᵐ path ∂
        (markedKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      ∀ (n : Nat) (before : n < eventCount chain),
        Nonempty
          (CompleteProjectedSampledEdge
            chain assignment n before (path n) (path (n + 1))) := by
  filter_upwards
    [sampled_marks_common_trajectory_almost_sure chain] with path sampled
  intro n before
  rcases sampled n before with ⟨edge⟩
  exact ⟨CompleteProjectedSampledEdge.of_sampled assignment edge⟩

universe vₛ vₜ uₛ uₜ

/--
Family-level form of the common-trajectory theorem.

`SourceFamilyAlignment` is the only supplied bridge: it identifies the
arbitrary existential packages stored by the chain with the shared source
family.  The per-epoch certificates are then computed by `ofFamilies`, and
all stochastic event evidence remains derived from the sampled mark.
-/
theorem four_projection_family_common_trajectory_almost_sure
    {SourceCategory : Type uₛ} [Category.{vₛ} SourceCategory]
    [MonoidalCategory SourceCategory] [SymmetricCategory SourceCategory]
    {DagCategory PetriCategory PiCategory MorphismCategory : Type uₜ}
    [Category.{vₜ} DagCategory]
    [MonoidalCategory DagCategory] [SymmetricCategory DagCategory]
    [Category.{vₜ} PetriCategory]
    [MonoidalCategory PetriCategory] [SymmetricCategory PetriCategory]
    [Category.{vₜ} PiCategory]
    [MonoidalCategory PiCategory] [SymmetricCategory PiCategory]
    [Category.{vₜ} MorphismCategory]
    [MonoidalCategory MorphismCategory] [SymmetricCategory MorphismCategory]
    (families :
      FourProjectionFamilies
        SourceCategory DagCategory PetriCategory PiCategory MorphismCategory)
    (chain : EpochChain universes first last)
    (alignment : SourceFamilyAlignment families.source chain) :
    ∀ᵐ path ∂
        (markedKernel chain).toMarkovExecutionKernel.trajectoryMeasure
          (initial chain),
      ∀ (n : Nat) (before : n < eventCount chain),
        Nonempty
          (CompleteProjectedSampledEdge
            chain
            (ChainFourProjectionAssignment.ofFamilies families alignment)
            n before (path n) (path (n + 1))) :=
  four_projection_common_trajectory_almost_sure chain
    (ChainFourProjectionAssignment.ofFamilies families alignment)

end Cantilune.Feedback.FiniteHeterogeneousFourProjection
