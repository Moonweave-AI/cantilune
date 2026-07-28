import Cantilune.Pi.LateIndependentExchange

namespace Cantilune.Tests.LateIndependentExchange

open Cantilune.Pi
open Cantilune.Pi.LateIndependentExchange

example :
    NativeTrace
        (.par exampleLeft exampleRight)
        [.output 0 1, .output 2 3]
        (.par .zero .zero) :=
  example_native_independent_diamond.1

example :
    replayClass
        (replaySquareOfParallel
          (leftStep := Late.NativeStep.prefixOutput)
          (rightStep := Late.NativeStep.prefixOutput)
          exampleParallelIndependent).firstRecord =
      replayClass
        (replaySquareOfParallel
          (leftStep := Late.NativeStep.prefixOutput)
          (rightStep := Late.NativeStep.prefixOutput)
          exampleParallelIndependent).secondRecord :=
  replay_square_class_agrees _

example :
    ¬ ActionIndependent
        (Raw.Action.output 7 8) (.input 7 9) :=
  output_input_same_channel_dependent 7 8 9

end Cantilune.Tests.LateIndependentExchange
