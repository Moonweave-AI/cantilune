import Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport

/-!
# Regression tests for exact finite-world power transport

These checks exercise the dependent support equation, identity/composition,
the actual supported-world endofunctor and monad, and return/choice/flatten
compatibility with finite injections.
-/

noncomputable section

namespace Cantilune.Tests.FMSCpoOmegaScottWorldSupportTransport

open CategoryTheory
open OmegaCompletePartialOrder
open Cantilune.Pi.Worlds
open Cantilune.Pi.FMSModel
open Cantilune.Pi.FMSCpoOmegaScottPower
open Cantilune.Pi.FMSCpoOmegaScottPowerSupport
open Cantilune.Pi.NominalFiniteSupport
open Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport
open Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel

#check ReindexHom
#check powerSupport_mapRaw_reindex
#check powerReindex
#check SupportedWorldModel
#check powerFunctor
#check powerMonad
#check powerReindex_choice
#check powerReindex_principal
#check powerReindex_flatten
#check powerSupport_principal_reindex
#check powerSupport_choice_reindex
#check powerSupport_flatten_reindex
#check finiteSupportWorldModel
#check poweredFiniteSupportWorldModel

example
    {source target : World}
    (injection : Injection source target)
    (values :
      OmegaScottPower
        (finiteSupportObject source).Carrier) :
    (poweredFiniteSupportWorldModel.reindex injection)
        values =
      mapRaw
        (finiteSupportReindex injection).toContinuousHom
        values :=
  rfl

example
    {source target : World}
    (injection : Injection source target)
    (values :
      OmegaScottPower
        (finiteSupportObject source).Carrier) :
    (poweredFiniteSupportWorldModel.obj target).support
        (poweredFiniteSupportWorldModel.reindex
          injection values) =
      mapSupport injection
        ((poweredFiniteSupportWorldModel.obj source).support
          values) :=
  (poweredFiniteSupportWorldModel.reindex
    injection).support_map values

example
    {first second third : World}
    (left : Injection first second)
    (right : Injection second third)
    (values :
      OmegaScottPower
        (finiteSupportObject first).Carrier) :
    poweredFiniteSupportWorldModel.reindex
        (left.comp right) values =
      poweredFiniteSupportWorldModel.reindex right
        (poweredFiniteSupportWorldModel.reindex
          left values) :=
  poweredFiniteSupportWorldModel.reindex_comp
    left right values

example
    {source target : World}
    (injection : Injection source target)
    (left right :
      OmegaScottPower
        (finiteSupportObject source).Carrier) :
    poweredFiniteSupportWorldModel.reindex injection
        (choice (left, right)) =
      choice
        (poweredFiniteSupportWorldModel.reindex
            injection left,
          poweredFiniteSupportWorldModel.reindex
            injection right) :=
  powerReindex_choice
    (finiteSupportReindex injection) left right

example
    {source target : World}
    (injection : Injection source target)
    (family :
      OmegaScottPower
        (OmegaScottPower
          (finiteSupportObject source).Carrier)) :
    poweredFiniteSupportWorldModel.reindex injection
        (flattenRaw family) =
      flattenRaw
        ((powerModel poweredFiniteSupportWorldModel).reindex
          injection family) :=
  powerReindex_flatten
    (finiteSupportReindex injection) family

#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.powerSupport_mapRaw_reindex
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.powerFunctor
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.powerMonad
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.powerReindex_choice
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.powerReindex_flatten
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.powerSupport_choice_reindex
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.powerSupport_flatten_reindex
#print axioms
  Cantilune.Pi.FMSCpoOmegaScottWorldSupportTransport.SupportedWorldModel.poweredFiniteSupportWorldModel

end Cantilune.Tests.FMSCpoOmegaScottWorldSupportTransport
