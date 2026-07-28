import Cantilune.Pi.OpenSMCContextualPartialTensor

/-!
# Total named-boundary obstruction and the native plug/hide kernel

This module separates two facts which must not be conflated.

First, the current `NamedInterface` representation cannot carry a total
occurrence-preserving tensor.  A tensor may reorder ports, but if it keeps
their concrete names then tensoring any nonempty interface with itself
duplicates one name.  The resulting port list cannot satisfy the defining
`Nodup` invariant.  Exact-name `PlugCertificate`s independently fail to be
total at a nonempty identity boundary.

Second, the operational ingredients needed *after* a valid freshening choice
are already present in standard late pi.  Free communication and bound-output
close are native one-step `tau` derivations, and a native step propagates
through any finite list of restrictions when the usual freshness condition
holds.  Thus parallel-plus-hiding has a genuine native operational kernel;
what is missing is a coherent, sort-preserving renaming of public boundary
occurrences and an equality/observation notion validating the category
coherences.

`SortedFreshBoundarySupply` records only that missing nominal allocation
primitive.  It does not assume a category, a tensor on morphisms, an SMC law,
or operational adequacy, and no instance is manufactured from it here.
-/

namespace Cantilune.Pi.OpenSMCTotalNamedBoundary

open Cantilune.Pi
open Cantilune.Pi.OpenSMCNominalAtomBoundary
open Cantilune.Pi.OpenSMCNamedComposition
open Cantilune.Pi.OpenSMCContextualPartialTensor

/-! ## No total occurrence-preserving object tensor -/

/--
A proposed total tensor which may reorder ports but may not rename or discard
their concrete occurrences.

The permutation premise is deliberately weaker than literal concatenation.
It therefore covers the existing concatenating tensor as well as any
presentation differing only by symmetry/associativity reordering.
-/
structure TotalOccurrenceTensor (Γ : TypeEnv) where
  tensor :
    NamedInterface Γ → NamedInterface Γ → NamedInterface Γ
  ports_perm :
    ∀ left right,
      (tensor left right).ports.Perm (left.ports ++ right.ports)

/--
No total occurrence-preserving tensor exists as soon as the object collection
contains one nonempty named interface.

This is an object-level no-go.  It does not rule out a tensor that first
chooses fresh, sort-preserving aliases and transports process syntax along
that renaming.
-/
theorem no_totalOccurrenceTensor_of_nonempty
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ)
    (nonempty : boundary.names.Nonempty) :
    ¬ Nonempty (TotalOccurrenceTensor Γ) := by
  rintro ⟨candidate⟩
  obtain ⟨name, nameMember⟩ := nonempty
  have nameMemberList :
      name ∈ boundary.ports.map Port.name := by
    simpa [NamedInterface.names] using nameMember
  have portsPermutation :=
    candidate.ports_perm boundary boundary
  have namesPermutation :
      List.Perm
        ((candidate.tensor boundary boundary).ports.map Port.name)
        (boundary.ports.map Port.name ++
          boundary.ports.map Port.name) := by
    simpa [List.map_append] using portsPermutation.map Port.name
  have duplicateFree :
      (boundary.ports.map Port.name ++
        boundary.ports.map Port.name).Nodup :=
    namesPermutation.nodup_iff.mp
      (candidate.tensor boundary boundary).names_nodup
  obtain ⟨_, _, separated⟩ := List.nodup_append.mp duplicateFree
  exact separated name nameMemberList name nameMemberList rfl

/-! ## Independent exact-name identity obstruction -/

/--
A candidate claiming that the current exact-name plug certificate is
available for every triple of interfaces.
-/
structure TotalExactNamePlug (Γ : TypeEnv) where
  certificate :
    ∀ input middle output : NamedInterface Γ,
      PlugCertificate input middle output

/--
Exact-name hiding cannot be total in the presence of a nonempty identity
boundary: the middle occurrence would be both hidden and externally public.
-/
theorem no_totalExactNamePlug_of_nonempty
    {Γ : TypeEnv}
    (boundary : NamedInterface Γ)
    (nonempty : boundary.names.Nonempty) :
    ¬ Nonempty (TotalExactNamePlug Γ) := by
  rintro ⟨candidate⟩
  exact
    no_left_identity_plug_of_nonempty nonempty
      (candidate.certificate
        boundary boundary (NamedInterface.empty Γ))

/-! ## The non-circular nominal primitive required by a repair -/

/--
A finite public-boundary renaming.

It records only the observable facts needed at the boundary: sorts are
preserved, target names are exactly the injective image of source names, and
the name map is injective on that finite support.  It does not postulate any
process transition theorem.
-/
structure BoundaryRenaming
    {Γ : TypeEnv}
    (source target : NamedInterface Γ) where
  nameMap : Name → Name
  sorts_eq : target.sorts = source.sorts
  names_eq : target.names = source.names.image nameMap
  injective_on :
    Set.InjOn nameMap (source.names : Set Name)
  sort_preserving_on :
    ∀ name, name ∈ source.names →
      Γ.sort (nameMap name) = Γ.sort name

/--
A fresh realization of one boundary shape outside a finite avoidance set.
-/
structure FreshenedBoundary
    {Γ : TypeEnv}
    (source : NamedInterface Γ)
    (avoid : Finset Name) where
  target : NamedInterface Γ
  boundaryMap : BoundaryRenaming source target
  fresh : Disjoint target.names avoid

/--
The precise allocation primitive needed before a renamed total object tensor
can even be formed in an arbitrary fixed type environment.

An inhabitant entails that every finite typed boundary can be copied outside
every finite avoidance set.  This is stronger than the current `TypeEnv`,
which contains no infinitude assumption for any sort.
-/
structure SortedFreshBoundarySupply (Γ : TypeEnv) where
  freshen :
    (avoid : Finset Name) →
      (source : NamedInterface Γ) →
        FreshenedBoundary source avoid

namespace SortedFreshBoundarySupply

/-- The fresh right-hand occurrence selected for a totalized object tensor. -/
def freshRight
    (supply : SortedFreshBoundarySupply Γ)
    (left right : NamedInterface Γ) :
    NamedInterface Γ :=
  (supply.freshen left.names right).target

theorem freshRight_sorts
    (supply : SortedFreshBoundarySupply Γ)
    (left right : NamedInterface Γ) :
    (supply.freshRight left right).sorts = right.sorts :=
  (supply.freshen left.names right).boundaryMap.sorts_eq

theorem freshRight_disjoint
    (supply : SortedFreshBoundarySupply Γ)
    (left right : NamedInterface Γ) :
    Disjoint left.names (supply.freshRight left right).names :=
  (supply.freshen left.names right).fresh.symm

/--
Under an explicit sorted fresh-name supply, object tensor is total after
freshening the right occurrence.
-/
theorem tensorCertificate
    (supply : SortedFreshBoundarySupply Γ)
    (left right : NamedInterface Γ) :
    TensorBoundaryCertificate left (supply.freshRight left right) where
  names_disjoint := supply.freshRight_disjoint left right

def tensorObject
    (supply : SortedFreshBoundarySupply Γ)
    (left right : NamedInterface Γ) :
    NamedInterface Γ :=
  NamedInterface.tensor left (supply.freshRight left right)
    (supply.tensorCertificate left right)

/--
The repaired object operation has the expected sort shape.  No associativity
or morphism tensor is claimed: those require coherent renaming transport,
which is intentionally absent from `SortedFreshBoundarySupply`.
-/
theorem tensorObject_sorts
    (supply : SortedFreshBoundarySupply Γ)
    (left right : NamedInterface Γ) :
    (supply.tensorObject left right).sorts =
      left.sorts ++ right.sorts := by
  calc
    (supply.tensorObject left right).sorts =
        left.sorts ++ (supply.freshRight left right).sorts :=
      NamedInterface.tensor_sorts _ _ _
    _ = left.sorts ++ right.sorts :=
      congrArg (fun sorts => left.sorts ++ sorts)
        (supply.freshRight_sorts left right)

end SortedFreshBoundarySupply

/-! ## A sorted fresh supply is a real additional assumption -/

/--
An environment with exactly one channel-sorted name.  Every other natural
number is data-sorted.
-/
def singletonChannelEnvironment : TypeEnv where
  sort name := if name = 0 then .channel else .data
  payload _ := .data

def singletonChannelPort : Port singletonChannelEnvironment where
  name := 0
  sort := .channel
  sort_eq := by simp [singletonChannelEnvironment]

def singletonChannelBoundary :
    NamedInterface singletonChannelEnvironment where
  ports := [singletonChannelPort]
  names_nodup := by simp [singletonChannelPort]

/-- A data-sorted port used to test pointwise sort preservation. -/
def singletonDataPort : Port singletonChannelEnvironment where
  name := 1
  sort := .data
  sort_eq := by simp [singletonChannelEnvironment]

/-- A mixed-sort boundary whose underlying name set is stable under swapping. -/
def mixedSortBoundary :
    NamedInterface singletonChannelEnvironment where
  ports := [singletonChannelPort, singletonDataPort]
  names_nodup := by
    simp [singletonChannelPort, singletonDataPort]

/-- Swap the channel name `0` and the data name `1`. -/
def swapZeroOne (name : Name) : Name :=
  if name = 0 then 1 else if name = 1 then 0 else name

/--
The strengthened boundary-renaming record rejects a permutation of the same
underlying name set when it maps a channel occurrence to a data name.

Without `BoundaryRenaming.sort_preserving_on`, this swap could satisfy
`sorts_eq`, `names_eq`, and finite-support injectivity with source and target
both equal to `mixedSortBoundary`.
-/
theorem no_sortChanging_selfBoundaryRenaming :
    ¬ ∃ mapping :
        BoundaryRenaming mixedSortBoundary mixedSortBoundary,
      mapping.nameMap = swapZeroOne := by
  rintro ⟨mapping, mapEq⟩
  have zeroMember : 0 ∈ mixedSortBoundary.names := by
    simp [mixedSortBoundary, NamedInterface.names,
      singletonChannelPort, singletonDataPort]
  have preservesZero :=
    mapping.sort_preserving_on 0 zeroMember
  rw [mapEq] at preservesZero
  simp [swapZeroOne, singletonChannelEnvironment] at preservesZero

/--
The existing `TypeEnv` interface does not imply an infinite sorted name
supply.  In the singleton-channel environment, refreshing the sole channel
outside `{0}` is impossible.
-/
theorem no_sortedFreshBoundarySupply_singletonChannel :
    ¬ Nonempty
      (SortedFreshBoundarySupply singletonChannelEnvironment) := by
  rintro ⟨supply⟩
  let refreshed :=
    supply.freshen ({0} : Finset Name) singletonChannelBoundary
  have sortsEq :
      refreshed.target.sorts = [.channel] := by
    simpa [singletonChannelBoundary, singletonChannelPort,
      NamedInterface.sorts, Port.forgetSort] using
      refreshed.boundaryMap.sorts_eq
  have targetPortsNonempty : refreshed.target.ports ≠ [] := by
    intro targetEmpty
    have targetSortsEmpty : refreshed.target.sorts = [] := by
      simp [NamedInterface.sorts, targetEmpty]
    rw [targetSortsEmpty] at sortsEq
    simp at sortsEq
  obtain ⟨port, portMember⟩ :=
    List.exists_mem_of_ne_nil
      refreshed.target.ports targetPortsNonempty
  have portSortMember :
      port.sort ∈ refreshed.target.sorts := by
    have mapped :
        Port.forgetSort port ∈
          refreshed.target.ports.map Port.forgetSort :=
      List.mem_map.mpr ⟨port, portMember, rfl⟩
    simpa [NamedInterface.sorts, Port.forgetSort] using mapped
  rw [sortsEq] at portSortMember
  have portSort : port.sort = .channel := by
    simpa using portSortMember
  have environmentSort :
      singletonChannelEnvironment.sort port.name = .channel :=
    port.sort_eq.trans portSort
  have portName : port.name = 0 := by
    simpa [singletonChannelEnvironment] using environmentSort
  have zeroInTarget : 0 ∈ refreshed.target.names := by
    simp only [NamedInterface.names, List.mem_toFinset, List.mem_map]
    exact ⟨port, portMember, portName⟩
  exact
    (Finset.disjoint_left.mp refreshed.fresh)
      zeroInTarget (by simp)

/-! ## Native restriction and plug/hide sufficiency -/

/-- Wrap a finite list of restrictions around a raw process. -/
def hideMany : List Name → Raw.Proc → Raw.Proc
  | [], process => process
  | binder :: rest, process => .new binder (hideMany rest process)

@[simp]
theorem hideMany_nil (process : Raw.Proc) :
    hideMany [] process = process :=
  rfl

@[simp]
theorem hideMany_cons
    (binder : Name) (rest : List Name) (process : Raw.Proc) :
    hideMany (binder :: rest) process =
      .new binder (hideMany rest process) :=
  rfl

/--
Any native late transition propagates through a finite hiding context when
every hidden binder is fresh for its action label.
-/
theorem hideMany_native
    (binders : List Name)
    (step : Late.NativeStep source action target)
    (fresh :
      ∀ binder, binder ∈ binders → binder ∉ action.names) :
    Late.NativeStep
      (hideMany binders source)
      action
      (hideMany binders target) := by
  induction binders with
  | nil =>
      simpa using step
  | cons binder rest inductionHypothesis =>
      apply Late.NativeStep.restrict
      · exact fresh binder (by simp)
      · apply inductionHypothesis
        intro inner innerMember
        exact fresh inner (by simp [innerMember])

/--
`tau` has no names, so every finite restriction program transports it
without an additional nominal premise.
-/
theorem hideMany_native_tau
    (binders : List Name)
    (step : Late.NativeStep source .tau target) :
    Late.NativeStep
      (hideMany binders source)
      .tau
      (hideMany binders target) :=
  hideMany_native binders step (by simp [Raw.Action.names])

/--
Free output/input plugging followed by arbitrary finite hiding is one native
late-pi `tau` step.  The derivative is the exact late substitution endpoint,
not a weak or reflexive closure.
-/
theorem plugHide_syncLeft_native
    (hidden : List Name)
    (outputStep :
      Late.NativeStep left (.output channel value) left')
    (inputStep :
      Late.NativeStep right (.input channel binder) right')
    (binderFresh : binder ∉ left'.freeNames) :
    Late.NativeStep
      (hideMany hidden (.par left right))
      .tau
      (hideMany hidden
        (.par left'
          (right'.substituteCaptureAvoiding binder value))) :=
  hideMany_native_tau hidden
    (Late.NativeStep.syncLeft outputStep inputStep binderFresh)

/-- Right/left mirror of `plugHide_syncLeft_native`. -/
theorem plugHide_syncRight_native
    (hidden : List Name)
    (inputStep :
      Late.NativeStep left (.input channel binder) left')
    (outputStep :
      Late.NativeStep right (.output channel value) right')
    (binderFresh : binder ∉ right'.freeNames) :
    Late.NativeStep
      (hideMany hidden (.par left right))
      .tau
      (hideMany hidden
        (.par
          (left'.substituteCaptureAvoiding binder value)
          right')) :=
  hideMany_native_tau hidden
    (Late.NativeStep.syncRight inputStep outputStep binderFresh)

/--
Bound output/input plugging (`open+close`) followed by arbitrary finite
hiding is likewise one native late-pi `tau` step, retaining the newly created
restriction at the exact endpoint.
-/
theorem plugHide_closeLeft_native
    (hidden : List Name)
    (outputStep :
      Late.NativeStep left (.boundOutput channel freshName) left')
    (inputStep :
      Late.NativeStep right (.input channel binder) right')
    (freshForReceiver : freshName ∉ right.freeNames)
    (binderFresh : binder ∉ left'.freeNames) :
    Late.NativeStep
      (hideMany hidden (.par left right))
      .tau
      (hideMany hidden
        (.new freshName
          (.par left'
            (right'.substituteCaptureAvoiding binder freshName)))) :=
  hideMany_native_tau hidden
    (Late.NativeStep.closeLeft
      outputStep inputStep freshForReceiver binderFresh)

/-- Right/left mirror of `plugHide_closeLeft_native`. -/
theorem plugHide_closeRight_native
    (hidden : List Name)
    (inputStep :
      Late.NativeStep left (.input channel binder) left')
    (outputStep :
      Late.NativeStep right (.boundOutput channel freshName) right')
    (freshForReceiver : freshName ∉ left.freeNames)
    (binderFresh : binder ∉ right'.freeNames) :
    Late.NativeStep
      (hideMany hidden (.par left right))
      .tau
      (hideMany hidden
        (.new freshName
          (.par
            (left'.substituteCaptureAvoiding binder freshName)
            right'))) :=
  hideMany_native_tau hidden
    (Late.NativeStep.closeRight
      inputStep outputStep freshForReceiver binderFresh)

end Cantilune.Pi.OpenSMCTotalNamedBoundary
