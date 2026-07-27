import Cantilune.Core.PresheafComplementDPO
import Mathlib.CategoryTheory.Limits.Shapes.Pullback.Pasting

/-!
# Parallel independence and concurrency for typed-presheaf DPO rewriting

This file uses the standard, non-circular definition of parallel
independence: each left-hand-side match factors through the pushout
complement of the other derivation.  From those two factorisations it
constructs the pullback of the two contexts, both residual derivations, and
the canonical isomorphism between their final results.

No final object, residual derivation, or commuting-result witness is stored
in `ParallelIndependent`; all of it is derived from the two factorisations
and the DPO squares.
-/

namespace Cantilune.Core.DPOConcurrency

open CategoryTheory
open CategoryTheory.Limits

universe u v

/-! ## Two elementary pushout-reassociation lemmas -/

section Reassociation

variable {C : Type u} [Category.{v} C]

/--
Reassociate two pushouts which share a context `P`.

If `D = L ⨿[K] P`, `Q = R ⨿[J] P`, and
`H = R ⨿[J] D`, where the `J → D` leg is induced by `J → P`, then
`H = L ⨿[K] Q`.
-/
theorem reassociate_pushouts
    {K L P D J R Q H : C}
    {kL : K ⟶ L} {kP : K ⟶ P}
    {lD : L ⟶ D} {pD : P ⟶ D}
    {jR : J ⟶ R} {jP : J ⟶ P}
    {rQ : R ⟶ Q} {pQ : P ⟶ Q}
    {rH : R ⟶ H} {dH : D ⟶ H}
    (dSquare : IsPushout kL kP lD pD)
    (qSquare : IsPushout jR jP rQ pQ)
    (hSquare : IsPushout jR (jP ≫ pD) rH dH) :
    IsPushout
      kL
      (kP ≫ pQ)
      (lD ≫ dH)
      (qSquare.desc rH (pD ≫ dH)
        (by
          simpa only [Category.assoc] using hSquare.w)) := by
  let qH : Q ⟶ H :=
    qSquare.desc rH (pD ≫ dH)
      (by
        simpa only [Category.assoc] using hSquare.w)
  have qH_r : rQ ≫ qH = rH := by
    dsimp [qH]
    simp
  have qH_p : pQ ≫ qH = pD ≫ dH := by
    dsimp [qH]
    simp
  change IsPushout kL (kP ≫ pQ) (lD ≫ dH) qH
  apply IsPushout.mk'
  · calc
      kL ≫ lD ≫ dH = kP ≫ pD ≫ dH := dSquare.w_assoc dH
      _ = kP ≫ (pQ ≫ qH) := by rw [qH_p]
      _ = (kP ≫ pQ) ≫ qH := (Category.assoc _ _ _).symm
  · intro T f g hfL hfQ
    apply hSquare.hom_ext
    · simpa only [← Category.assoc, qH_r] using
        congrArg (fun z => rQ ≫ z) hfQ
    · apply dSquare.hom_ext
      · simpa only [Category.assoc] using hfL
      · simpa only [← Category.assoc, qH_p] using
          congrArg (fun z => pQ ≫ z) hfQ
  · intro T a b hab
    let dT : D ⟶ T := dSquare.desc a (pQ ≫ b) (by simpa using hab)
    have compat : jR ≫ rQ ≫ b = (jP ≫ pD) ≫ dT := by
      rw [Category.assoc, qSquare.w_assoc]
      dsimp [dT]
      simp
    let hT : H ⟶ T := hSquare.desc (rQ ≫ b) dT compat
    refine ⟨hT, ?_, ?_⟩
    · dsimp [hT, dT]
      simp
    · apply qSquare.hom_ext
      · dsimp [qH, hT]
        simp
      · dsimp [qH, hT, dT]
        simp

/--
The two possible iterated pushouts of `R₁ ← K₁ → P ← K₂ → R₂`
are interchangeable.  The theorem presents the first iteration as the
second outer pushout; uniqueness of pushouts then supplies the final
concurrency isomorphism.
-/
theorem exchange_pushouts
    {K₁ K₂ R₁ R₂ P C₁ C₂ F : C}
    {r₁ : K₁ ⟶ R₁} {k₁ : K₁ ⟶ P}
    {r₂ : K₂ ⟶ R₂} {k₂ : K₂ ⟶ P}
    {r₂C₁ : R₂ ⟶ C₁} {pC₁ : P ⟶ C₁}
    {r₁C₂ : R₁ ⟶ C₂} {pC₂ : P ⟶ C₂}
    {r₁F : R₁ ⟶ F} {c₁F : C₁ ⟶ F}
    (c₁Square : IsPushout r₂ k₂ r₂C₁ pC₁)
    (c₂Square : IsPushout r₁ k₁ r₁C₂ pC₂)
    (fSquare : IsPushout r₁ (k₁ ≫ pC₁) r₁F c₁F) :
    IsPushout
      r₂
      (k₂ ≫ pC₂)
      (r₂C₁ ≫ c₁F)
      (c₂Square.desc r₁F (pC₁ ≫ c₁F)
        (by simpa only [Category.assoc] using fSquare.w)) := by
  let c₂F : C₂ ⟶ F :=
    c₂Square.desc r₁F (pC₁ ≫ c₁F)
      (by simpa only [Category.assoc] using fSquare.w)
  have c₂F_r : r₁C₂ ≫ c₂F = r₁F := by
    dsimp [c₂F]
    simp
  have c₂F_p : pC₂ ≫ c₂F = pC₁ ≫ c₁F := by
    dsimp [c₂F]
    simp
  change IsPushout r₂ (k₂ ≫ pC₂) (r₂C₁ ≫ c₁F) c₂F
  apply IsPushout.mk'
  · calc
      r₂ ≫ r₂C₁ ≫ c₁F = k₂ ≫ pC₁ ≫ c₁F := c₁Square.w_assoc c₁F
      _ = k₂ ≫ (pC₂ ≫ c₂F) := by rw [c₂F_p]
      _ = (k₂ ≫ pC₂) ≫ c₂F := (Category.assoc _ _ _).symm
  · intro T f g hfR hfC
    apply fSquare.hom_ext
    · simpa only [← Category.assoc, c₂F_r] using
        congrArg (fun z => r₁C₂ ≫ z) hfC
    · apply c₁Square.hom_ext
      · simpa only [Category.assoc] using hfR
      · simpa only [← Category.assoc, c₂F_p] using
          congrArg (fun z => pC₂ ≫ z) hfC
  · intro T a b hab
    let c₁T : C₁ ⟶ T :=
      c₁Square.desc a (pC₂ ≫ b)
        (by simpa only [Category.assoc, c₂Square.w_assoc] using hab)
    have compat : r₁ ≫ r₁C₂ ≫ b = (k₁ ≫ pC₁) ≫ c₁T := by
      rw [Category.assoc, c₂Square.w_assoc]
      dsimp [c₁T]
      simp
    let fT : F ⟶ T := fSquare.desc (r₁C₂ ≫ b) c₁T compat
    refine ⟨fT, ?_, ?_⟩
    · dsimp [fT, c₁T]
      simp
    · apply c₂Square.hom_ext
      · dsimp [c₂F, fT]
        simp
      · dsimp [c₂F, fT, c₁T]
        simp

end Reassociation

/-! ## Standard parallel independence -/

variable {Shape : Type u} [Category.{v} Shape]
variable {typeGraph : AdhesiveDPOI.HypergraphPresheaf Shape}
variable
  {rule₁ rule₂ : AdhesiveDPOI.Rule typeGraph}
  {host : AdhesiveDPOI.TypedHypergraph typeGraph}
  {matching₁ : AdhesiveDPOI.Match rule₁ host}
  {matching₂ : AdhesiveDPOI.Match rule₂ host}

/--
Standard parallel independence for two direct DPO derivations from one host.
Each match must lie in the context retained by the other derivation.
-/
structure ParallelIndependent
    (first : AdhesiveDPOI.Derivation rule₁ matching₁)
    (second : AdhesiveDPOI.Derivation rule₂ matching₂) where
  firstThroughSecondContext : rule₁.left ⟶ second.complement
  secondThroughFirstContext : rule₂.left ⟶ first.complement
  first_factor :
    firstThroughSecondContext ≫ second.complementToHost = matching₁.arrow
  second_factor :
    secondThroughFirstContext ≫ first.complementToHost = matching₂.arrow

namespace ParallelIndependent

variable
  {first : AdhesiveDPOI.Derivation rule₁ matching₁}
  {second : AdhesiveDPOI.Derivation rule₂ matching₂}
  (independent : ParallelIndependent first second)

theorem first_context_mono :
    Mono first.complementToHost := by
  letI : Mono rule₁.leftLeg := rule₁.left_mono
  exact Adhesive.mono_of_isPushout_of_mono_left first.complementSquare

theorem second_context_mono :
    Mono second.complementToHost := by
  letI : Mono rule₂.leftLeg := rule₂.left_mono
  exact Adhesive.mono_of_isPushout_of_mono_left second.complementSquare

/-- The context retained by both direct derivations. -/
noncomputable abbrev JointContext
    (_independent : ParallelIndependent first second) :
    AdhesiveDPOI.TypedHypergraph typeGraph :=
  pullback first.complementToHost second.complementToHost

noncomputable abbrev jointToFirst :
    JointContext independent ⟶ first.complement :=
  pullback.fst first.complementToHost second.complementToHost

noncomputable abbrev jointToSecond :
    JointContext independent ⟶ second.complement :=
  pullback.snd first.complementToHost second.complementToHost

/-- The first rule interface embedded in the joint retained context. -/
noncomputable def firstInterfaceToJoint :
    rule₁.interface ⟶ JointContext independent :=
  pullback.lift
    first.interfaceToComplement
    (rule₁.leftLeg ≫ independent.firstThroughSecondContext)
    (by
      rw [Category.assoc, independent.first_factor]
      exact first.complementSquare.w.symm)

/-- The second rule interface embedded in the joint retained context. -/
noncomputable def secondInterfaceToJoint :
    rule₂.interface ⟶ JointContext independent :=
  pullback.lift
    (rule₂.leftLeg ≫ independent.secondThroughFirstContext)
    second.interfaceToComplement
    (by
      rw [Category.assoc, independent.second_factor]
      exact second.complementSquare.w)

@[reassoc (attr := simp)]
theorem firstInterfaceToJoint_first :
    independent.firstInterfaceToJoint ≫ independent.jointToFirst =
      first.interfaceToComplement := by
  exact pullback.lift_fst _ _ _

@[reassoc (attr := simp)]
theorem firstInterfaceToJoint_second :
    independent.firstInterfaceToJoint ≫ independent.jointToSecond =
      rule₁.leftLeg ≫ independent.firstThroughSecondContext := by
  exact pullback.lift_snd _ _ _

@[reassoc (attr := simp)]
theorem secondInterfaceToJoint_first :
    independent.secondInterfaceToJoint ≫ independent.jointToFirst =
      rule₂.leftLeg ≫ independent.secondThroughFirstContext := by
  exact pullback.lift_fst _ _ _

@[reassoc (attr := simp)]
theorem secondInterfaceToJoint_second :
    independent.secondInterfaceToJoint ≫ independent.jointToSecond =
      second.interfaceToComplement := by
  exact pullback.lift_snd _ _ _

/--
The first interface is exactly the inverse image, inside the joint context,
of the first derivation's interface in its own context.
-/
theorem first_interface_joint_pullback :
    IsPullback
      independent.firstInterfaceToJoint
      (𝟙 rule₁.interface)
      independent.jointToFirst
      first.interfaceToComplement := by
  letI : Mono second.complementToHost :=
    second_context_mono
  apply IsPullback.mk'
  · simp
  · intro T f g _ hId
    simpa using hId
  · intro T a b hab
    refine ⟨b, ?_, by simp⟩
    apply pullback.hom_ext
    · simpa only [Category.assoc, firstInterfaceToJoint_first] using hab.symm
    · rw [← cancel_mono second.complementToHost]
      calc
        (b ≫ independent.firstInterfaceToJoint ≫
              independent.jointToSecond) ≫ second.complementToHost =
            (b ≫ rule₁.leftLeg) ≫
              (independent.firstThroughSecondContext ≫
                second.complementToHost) := by
                  simp only [Category.assoc, firstInterfaceToJoint_second]
        _ = (b ≫ rule₁.leftLeg) ≫ matching₁.arrow := by
              rw [independent.first_factor]
        _ = (b ≫ first.interfaceToComplement) ≫
              first.complementToHost := by
                simpa only [Category.assoc] using
                  congrArg (fun z => b ≫ z) first.complementSquare.w
        _ = (a ≫ independent.jointToFirst) ≫
              first.complementToHost := by rw [hab]
        _ = (a ≫ independent.jointToSecond) ≫
              second.complementToHost := by
                simpa only [Category.assoc] using
                  congrArg (fun z => a ≫ z)
                    (pullback.condition :
                      independent.jointToFirst ≫ first.complementToHost =
                        independent.jointToSecond ≫ second.complementToHost)

/-- The first factorisation square is a pullback because the context leg is monic. -/
theorem first_factor_pullback :
    IsPullback
      independent.firstThroughSecondContext
      (𝟙 rule₁.left)
      second.complementToHost
      matching₁.arrow := by
  letI : Mono second.complementToHost :=
    second_context_mono
  apply IsPullback.of_vert_isIso_mono
  exact ⟨by simpa using independent.first_factor⟩

/--
Base-changing the first pushout-complement square along the second retained
context decomposes that context as
`second.complement = rule₁.left ⨿[rule₁.interface] JointContext`.
-/
theorem first_context_decomposition :
    IsPushout
      rule₁.leftLeg
      independent.firstInterfaceToJoint
      independent.firstThroughSecondContext
      independent.jointToSecond := by
  letI : Mono rule₁.leftLeg := rule₁.left_mono
  let hVK := Adhesive.van_kampen first.complementSquare
  apply
    (hVK
      (f' := rule₁.leftLeg)
      (g' := independent.firstInterfaceToJoint)
      (h' := independent.firstThroughSecondContext)
      (i' := independent.jointToSecond)
      (αW := 𝟙 rule₁.interface)
      (αX := 𝟙 rule₁.left)
      (αY := independent.jointToFirst)
      (αZ := second.complementToHost)
      (IsPullback.of_id_snd)
      independent.first_interface_joint_pullback
      ⟨by simpa using independent.first_factor⟩
      ⟨pullback.condition.symm⟩
      ⟨independent.firstInterfaceToJoint_second.symm⟩).2
  exact
    ⟨independent.first_factor_pullback,
      (IsPullback.of_hasPullback
        first.complementToHost second.complementToHost).flip⟩

/--
The second interface is exactly the inverse image, inside the joint
context, of the second derivation's interface in its own context.
-/
theorem second_interface_joint_pullback :
    IsPullback
      independent.secondInterfaceToJoint
      (𝟙 rule₂.interface)
      independent.jointToSecond
      second.interfaceToComplement := by
  letI : Mono first.complementToHost := first_context_mono
  apply IsPullback.mk'
  · simp
  · intro T f g _ hId
    simpa using hId
  · intro T a b hab
    refine ⟨b, ?_, by simp⟩
    apply pullback.hom_ext
    · rw [← cancel_mono first.complementToHost]
      calc
        (b ≫ independent.secondInterfaceToJoint ≫
              independent.jointToFirst) ≫ first.complementToHost =
            (b ≫ rule₂.leftLeg) ≫
              (independent.secondThroughFirstContext ≫
                first.complementToHost) := by
                  simp only [Category.assoc, secondInterfaceToJoint_first]
        _ = (b ≫ rule₂.leftLeg) ≫ matching₂.arrow := by
              rw [independent.second_factor]
        _ = (b ≫ second.interfaceToComplement) ≫
              second.complementToHost := by
                simpa only [Category.assoc] using
                  congrArg (fun z => b ≫ z) second.complementSquare.w
        _ = (a ≫ independent.jointToSecond) ≫
              second.complementToHost := by rw [hab]
        _ = (a ≫ independent.jointToFirst) ≫
              first.complementToHost := by
                simpa only [Category.assoc] using
                  congrArg (fun z => a ≫ z)
                    (pullback.condition :
                      independent.jointToFirst ≫ first.complementToHost =
                        independent.jointToSecond ≫ second.complementToHost).symm
    · simpa only [Category.assoc, secondInterfaceToJoint_second] using hab.symm

/-- The second factorisation square is a pullback because the context leg is monic. -/
theorem second_factor_pullback :
    IsPullback
      independent.secondThroughFirstContext
      (𝟙 rule₂.left)
      first.complementToHost
      matching₂.arrow := by
  letI : Mono first.complementToHost := first_context_mono
  apply IsPullback.of_vert_isIso_mono
  exact ⟨by simpa using independent.second_factor⟩

/--
Base-changing the second pushout-complement square along the first retained
context decomposes that context as
`first.complement = rule₂.left ⨿[rule₂.interface] JointContext`.
-/
theorem second_context_decomposition :
    IsPushout
      rule₂.leftLeg
      independent.secondInterfaceToJoint
      independent.secondThroughFirstContext
      independent.jointToFirst := by
  letI : Mono rule₂.leftLeg := rule₂.left_mono
  let hVK := Adhesive.van_kampen second.complementSquare
  apply
    (hVK
      (f' := rule₂.leftLeg)
      (g' := independent.secondInterfaceToJoint)
      (h' := independent.secondThroughFirstContext)
      (i' := independent.jointToFirst)
      (αW := 𝟙 rule₂.interface)
      (αX := 𝟙 rule₂.left)
      (αY := independent.jointToSecond)
      (αZ := first.complementToHost)
      (IsPullback.of_id_snd)
      independent.second_interface_joint_pullback
      ⟨by simpa using independent.second_factor⟩
      ⟨pullback.condition⟩
      ⟨independent.secondInterfaceToJoint_first.symm⟩).2
  exact
    ⟨independent.second_factor_pullback,
      IsPullback.of_hasPullback
        first.complementToHost second.complementToHost⟩

/-! ## Residual derivations -/

/--
Context for applying the first rule after the second:
`rule₂.right ⨿[rule₂.interface] JointContext`.
-/
noncomputable abbrev FirstResidualContext :
    AdhesiveDPOI.TypedHypergraph typeGraph :=
  pushout rule₂.rightLeg independent.secondInterfaceToJoint

noncomputable abbrev secondRightToFirstResidualContext :
    rule₂.right ⟶ independent.FirstResidualContext :=
  pushout.inl rule₂.rightLeg independent.secondInterfaceToJoint

noncomputable abbrev jointToFirstResidualContext :
    independent.JointContext ⟶ independent.FirstResidualContext :=
  pushout.inr rule₂.rightLeg independent.secondInterfaceToJoint

/-- The defining pushout square of the first residual context. -/
theorem first_residual_context_square :
    IsPushout
      rule₂.rightLeg
      independent.secondInterfaceToJoint
      independent.secondRightToFirstResidualContext
      independent.jointToFirstResidualContext :=
  IsPushout.of_hasPushout _ _

/-- The first residual context embeds canonically into the result of rule two. -/
noncomputable def firstResidualContextToSecondResult :
    independent.FirstResidualContext ⟶ second.result :=
  independent.first_residual_context_square.desc
    second.rightToResult
    (independent.jointToSecond ≫ second.complementToResult)
    (by
      calc
        rule₂.rightLeg ≫ second.rightToResult =
            second.interfaceToComplement ≫
              second.complementToResult := second.resultSquare.w
        _ = (independent.secondInterfaceToJoint ≫
              independent.jointToSecond) ≫
              second.complementToResult := by
                rw [independent.secondInterfaceToJoint_second]
        _ = independent.secondInterfaceToJoint ≫
              (independent.jointToSecond ≫
                second.complementToResult) := Category.assoc _ _ _)

@[reassoc (attr := simp)]
theorem secondRight_firstResidualContextToSecondResult :
    independent.secondRightToFirstResidualContext ≫
        independent.firstResidualContextToSecondResult =
      second.rightToResult := by
  exact independent.first_residual_context_square.inl_desc _ _ _

@[reassoc (attr := simp)]
theorem joint_firstResidualContextToSecondResult :
    independent.jointToFirstResidualContext ≫
        independent.firstResidualContextToSecondResult =
      independent.jointToSecond ≫ second.complementToResult := by
  exact independent.first_residual_context_square.inr_desc _ _ _

/-- The occurrence of the first left-hand side remaining after rule two. -/
noncomputable def firstResidualMatch :
    AdhesiveDPOI.Match rule₁ second.result where
  arrow :=
    independent.firstThroughSecondContext ≫ second.complementToResult
  mono := by
    letI : Mono matching₁.arrow := matching₁.mono
    letI : Mono independent.firstThroughSecondContext :=
      mono_of_mono_fac independent.first_factor
    letI : Mono rule₂.rightLeg := rule₂.right_mono
    letI : Mono second.complementToResult :=
      Adhesive.mono_of_isPushout_of_mono_left second.resultSquare
    infer_instance

/--
The residual first match has the canonical pushout complement obtained by
retaining the second rule's right-hand side and the joint context.
-/
theorem first_residual_complement_square :
    IsPushout
      rule₁.leftLeg
      (independent.firstInterfaceToJoint ≫
        independent.jointToFirstResidualContext)
      independent.firstResidualMatch.arrow
      independent.firstResidualContextToSecondResult := by
  have secondResult :
      IsPushout
        rule₂.rightLeg
        (independent.secondInterfaceToJoint ≫ independent.jointToSecond)
        second.rightToResult
        second.complementToResult := by
    simpa only [secondInterfaceToJoint_second] using second.resultSquare
  simpa [FirstResidualContext, secondRightToFirstResidualContext,
      jointToFirstResidualContext, firstResidualContextToSecondResult,
      firstResidualMatch] using
    (reassociate_pushouts
      independent.first_context_decomposition
      independent.first_residual_context_square
      secondResult)

/-- Final result of the sequential order “second, then first”. -/
noncomputable abbrev FirstAfterSecondResult :
    AdhesiveDPOI.TypedHypergraph typeGraph :=
  pushout
    rule₁.rightLeg
    (independent.firstInterfaceToJoint ≫
      independent.jointToFirstResidualContext)

/-- The residual derivation applying rule one after rule two. -/
noncomputable def firstAfterSecond :
    AdhesiveDPOI.Derivation rule₁ independent.firstResidualMatch where
  complement := independent.FirstResidualContext
  result := independent.FirstAfterSecondResult
  interfaceToComplement :=
    independent.firstInterfaceToJoint ≫
      independent.jointToFirstResidualContext
  complementToHost := independent.firstResidualContextToSecondResult
  rightToResult :=
    pushout.inl
      rule₁.rightLeg
      (independent.firstInterfaceToJoint ≫
        independent.jointToFirstResidualContext)
  complementToResult :=
    pushout.inr
      rule₁.rightLeg
      (independent.firstInterfaceToJoint ≫
        independent.jointToFirstResidualContext)
  complementSquare := independent.first_residual_complement_square
  resultSquare := IsPushout.of_hasPushout _ _

/--
Context for applying the second rule after the first:
`rule₁.right ⨿[rule₁.interface] JointContext`.
-/
noncomputable abbrev SecondResidualContext :
    AdhesiveDPOI.TypedHypergraph typeGraph :=
  pushout rule₁.rightLeg independent.firstInterfaceToJoint

noncomputable abbrev firstRightToSecondResidualContext :
    rule₁.right ⟶ independent.SecondResidualContext :=
  pushout.inl rule₁.rightLeg independent.firstInterfaceToJoint

noncomputable abbrev jointToSecondResidualContext :
    independent.JointContext ⟶ independent.SecondResidualContext :=
  pushout.inr rule₁.rightLeg independent.firstInterfaceToJoint

/-- The defining pushout square of the second residual context. -/
theorem second_residual_context_square :
    IsPushout
      rule₁.rightLeg
      independent.firstInterfaceToJoint
      independent.firstRightToSecondResidualContext
      independent.jointToSecondResidualContext :=
  IsPushout.of_hasPushout _ _

/-- The second residual context embeds canonically into the result of rule one. -/
noncomputable def secondResidualContextToFirstResult :
    independent.SecondResidualContext ⟶ first.result :=
  independent.second_residual_context_square.desc
    first.rightToResult
    (independent.jointToFirst ≫ first.complementToResult)
    (by
      calc
        rule₁.rightLeg ≫ first.rightToResult =
            first.interfaceToComplement ≫
              first.complementToResult := first.resultSquare.w
        _ = (independent.firstInterfaceToJoint ≫
              independent.jointToFirst) ≫
              first.complementToResult := by
                rw [independent.firstInterfaceToJoint_first]
        _ = independent.firstInterfaceToJoint ≫
              (independent.jointToFirst ≫
                first.complementToResult) := Category.assoc _ _ _)

@[reassoc (attr := simp)]
theorem firstRight_secondResidualContextToFirstResult :
    independent.firstRightToSecondResidualContext ≫
        independent.secondResidualContextToFirstResult =
      first.rightToResult := by
  exact independent.second_residual_context_square.inl_desc _ _ _

@[reassoc (attr := simp)]
theorem joint_secondResidualContextToFirstResult :
    independent.jointToSecondResidualContext ≫
        independent.secondResidualContextToFirstResult =
      independent.jointToFirst ≫ first.complementToResult := by
  exact independent.second_residual_context_square.inr_desc _ _ _

/-- The occurrence of the second left-hand side remaining after rule one. -/
noncomputable def secondResidualMatch :
    AdhesiveDPOI.Match rule₂ first.result where
  arrow :=
    independent.secondThroughFirstContext ≫ first.complementToResult
  mono := by
    letI : Mono matching₂.arrow := matching₂.mono
    letI : Mono independent.secondThroughFirstContext :=
      mono_of_mono_fac independent.second_factor
    letI : Mono rule₁.rightLeg := rule₁.right_mono
    letI : Mono first.complementToResult :=
      Adhesive.mono_of_isPushout_of_mono_left first.resultSquare
    infer_instance

/--
The residual second match has the canonical pushout complement obtained by
retaining the first rule's right-hand side and the joint context.
-/
theorem second_residual_complement_square :
    IsPushout
      rule₂.leftLeg
      (independent.secondInterfaceToJoint ≫
        independent.jointToSecondResidualContext)
      independent.secondResidualMatch.arrow
      independent.secondResidualContextToFirstResult := by
  have firstResult :
      IsPushout
        rule₁.rightLeg
        (independent.firstInterfaceToJoint ≫ independent.jointToFirst)
        first.rightToResult
        first.complementToResult := by
    simpa only [firstInterfaceToJoint_first] using first.resultSquare
  simpa [SecondResidualContext, firstRightToSecondResidualContext,
      jointToSecondResidualContext, secondResidualContextToFirstResult,
      secondResidualMatch] using
    (reassociate_pushouts
      independent.second_context_decomposition
      independent.second_residual_context_square
      firstResult)

/-- Final result of the sequential order “first, then second”. -/
noncomputable abbrev SecondAfterFirstResult :
    AdhesiveDPOI.TypedHypergraph typeGraph :=
  pushout
    rule₂.rightLeg
    (independent.secondInterfaceToJoint ≫
      independent.jointToSecondResidualContext)

/-- The residual derivation applying rule two after rule one. -/
noncomputable def secondAfterFirst :
    AdhesiveDPOI.Derivation rule₂ independent.secondResidualMatch where
  complement := independent.SecondResidualContext
  result := independent.SecondAfterFirstResult
  interfaceToComplement :=
    independent.secondInterfaceToJoint ≫
      independent.jointToSecondResidualContext
  complementToHost := independent.secondResidualContextToFirstResult
  rightToResult :=
    pushout.inl
      rule₂.rightLeg
      (independent.secondInterfaceToJoint ≫
        independent.jointToSecondResidualContext)
  complementToResult :=
    pushout.inr
      rule₂.rightLeg
      (independent.secondInterfaceToJoint ≫
        independent.jointToSecondResidualContext)
  complementSquare := independent.second_residual_complement_square
  resultSquare := IsPushout.of_hasPushout _ _

/-! ## Concurrency / local Church--Rosser theorem -/

/--
The second residual context maps to the “second, then first” final result by
the maps from `rule₁.right` and the joint context.
-/
noncomputable def secondResidualContextToFirstAfterSecondResult :
    independent.SecondResidualContext ⟶
      independent.firstAfterSecond.result :=
  independent.second_residual_context_square.desc
    independent.firstAfterSecond.rightToResult
    (independent.jointToFirstResidualContext ≫
      independent.firstAfterSecond.complementToResult)
    (by
      simpa only [firstAfterSecond, Category.assoc] using
        independent.firstAfterSecond.resultSquare.w)

/--
The final object produced in the order “second, then first” is also the
pushout which applies the residual second rule to its residual context.
This is the pushout-interchange core of DPO concurrency.
-/
theorem first_after_second_is_second_pushout :
    IsPushout
      rule₂.rightLeg
      (independent.secondInterfaceToJoint ≫
        independent.jointToSecondResidualContext)
      (independent.secondRightToFirstResidualContext ≫
        independent.firstAfterSecond.complementToResult)
      independent.secondResidualContextToFirstAfterSecondResult := by
  simpa [secondResidualContextToFirstAfterSecondResult] using
    (exchange_pushouts
      independent.first_residual_context_square
      independent.second_residual_context_square
      independent.firstAfterSecond.resultSquare)

/--
Standard DPO concurrency theorem: parallel-independent direct derivations
possess the two standard residual derivations, and their sequential results
are canonically isomorphic.
-/
noncomputable def concurrencyIso :
    independent.firstAfterSecond.result ≅
      independent.secondAfterFirst.result :=
  AdhesiveDPOI.resultIso
    independent.first_after_second_is_second_pushout
    independent.secondAfterFirst.resultSquare

/-- The concurrency isomorphism preserves the residual second right leg. -/
@[reassoc]
theorem concurrencyIso_secondRight :
    (independent.secondRightToFirstResidualContext ≫
        independent.firstAfterSecond.complementToResult) ≫
        independent.concurrencyIso.hom =
      independent.secondAfterFirst.rightToResult :=
  AdhesiveDPOI.resultIso_rightLeg
    independent.first_after_second_is_second_pushout
    independent.secondAfterFirst.resultSquare

/-- The concurrency isomorphism preserves the whole residual second context. -/
@[reassoc]
theorem concurrencyIso_secondContext :
    independent.secondResidualContextToFirstAfterSecondResult ≫
        independent.concurrencyIso.hom =
      independent.secondAfterFirst.complementToResult :=
  AdhesiveDPOI.resultIso_complementLeg
    independent.first_after_second_is_second_pushout
    independent.secondAfterFirst.resultSquare

/--
Both original rule right-hand sides therefore have the same image in the
two sequential results, modulo the canonical concurrency isomorphism.
-/
@[reassoc]
theorem concurrencyIso_firstRight :
    independent.firstAfterSecond.rightToResult ≫
        independent.concurrencyIso.hom =
      independent.firstRightToSecondResidualContext ≫
        independent.secondAfterFirst.complementToResult := by
  rw [← independent.second_residual_context_square.inl_desc_assoc
    independent.firstAfterSecond.rightToResult
    (independent.jointToFirstResidualContext ≫
      independent.firstAfterSecond.complementToResult)
    (by
      simpa only [firstAfterSecond, Category.assoc] using
        independent.firstAfterSecond.resultSquare.w)]
  simpa only [secondResidualContextToFirstAfterSecondResult,
      Category.assoc] using
    congrArg
      (fun z => independent.firstRightToSecondResidualContext ≫ z)
      independent.concurrencyIso_secondContext

/--
Bundled theorem statement for downstream users: the two derived residual
derivations close to an isomorphic diamond, and that isomorphism preserves
the images of both original rule right-hand sides.
-/
theorem parallel_independent_concurrency :
    ∃ e :
        independent.firstAfterSecond.result ≅
          independent.secondAfterFirst.result,
      (independent.secondRightToFirstResidualContext ≫
          independent.firstAfterSecond.complementToResult) ≫ e.hom =
        independent.secondAfterFirst.rightToResult ∧
      independent.firstAfterSecond.rightToResult ≫ e.hom =
        independent.firstRightToSecondResidualContext ≫
          independent.secondAfterFirst.complementToResult := by
  exact
    ⟨independent.concurrencyIso,
      independent.concurrencyIso_secondRight,
      independent.concurrencyIso_firstRight⟩

end ParallelIndependent

end Cantilune.Core.DPOConcurrency
