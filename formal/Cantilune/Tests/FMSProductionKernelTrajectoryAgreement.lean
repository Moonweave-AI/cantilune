import Cantilune.Feedback.FMSProductionKernelTrajectoryAgreement

/-!
Kernel surface for the common exact-FMS seam over two genuine production
Markov kernels.
-/

namespace Cantilune.Tests.FMSProductionKernelTrajectoryAgreement

open Cantilune.Feedback.FMSProductionKernelTrajectoryAgreement

#check CommonExactFMSSemanticSeam
#check leftDenotationPath
#check rightDenotationPath
#check CompleteCommonFMSProductionAgreement
#check left_consecutive_fms
#check right_consecutive_fms
#check complete_common_fms_production_agreement_almost_sure

#print axioms
  complete_common_fms_production_agreement_almost_sure

end Cantilune.Tests.FMSProductionKernelTrajectoryAgreement
