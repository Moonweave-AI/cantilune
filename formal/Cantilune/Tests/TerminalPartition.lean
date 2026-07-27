import Cantilune.Core.TerminalPartition

namespace Cantilune.Tests.TerminalPartition

open Cantilune.Core

example (lts : ObservableLTS) (state : lts.State) :
    lts.Normal state ↔
      (lts.SuccessfulTermination state ∨
        lts.ExternalWait state ∨ lts.Deadlocked state) ∧
      (¬(lts.SuccessfulTermination state ∧ lts.ExternalWait state)) ∧
      (¬(lts.SuccessfulTermination state ∧ lts.Deadlocked state)) ∧
      (¬(lts.ExternalWait state ∧ lts.Deadlocked state)) :=
  lts.terminal_exactly_one_iff_normal state

end Cantilune.Tests.TerminalPartition
