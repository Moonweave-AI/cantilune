import Cantilune.Core.ExactPositionalDPOI
import Cantilune.Core.PositionalFiniteSliceObstruction
import Cantilune.Core.PositionalBoundaryDuplicateObstruction

/-!
# Exact positional DPOI category regression

The positive checks expose the categorical equivalence and mono transport.
The negative checks retain the two finite obstructions showing why the
equivalence cannot be widened to the unrestricted typed-presheaf slice.
-/

open Cantilune.Core
open Cantilune.Core.ExactPositionalDPOI
open Cantilune.Core.PositionalFiniteSliceObstruction
open Cantilune.Core.PositionalBoundaryDuplicateObstruction

#check exactEncodingFunctor
#check reconstructionIso
#check exact_positional_equivalence
#check exact_positional_equivalence_functor
#check mono_of_exactEncoding_mono
#check exactEncoding_mono_of_mono
#check exactEncoding_underlying

#check malformedTyped_not_in_essImage
#check encodingFunctor_not_essSurj_from_finite_witness
#check duplicateTyped_not_exactPositionalObject
#check duplicateTyped_not_in_essImage
