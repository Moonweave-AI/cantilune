# 成功谓词接口——包级终态分类

| 字段     | 值                                                                  |
| -------- | ------------------------------------------------------------------- |
| 状态     | **Draft**（参考实现已证明；独立评审待完成）                         |
| 类型     | 规范性规格（接口定义）                                              |
| 风险     | S2                                                                  |
| 负责人   | Joker-of-Gotham (DRI)                                               |
| 评审人   | 待定（架构评审人）                                                  |
| 创建日期 | 2026-07-27                                                          |
| 更新日期 | 2026-07-27                                                          |
| 相关     | `docs/spec/formal-semantics.md` §4.2, RFC-0002 clause (4), ADR-0001 |

---

## 1. 目的与范围

本规范定义**通用成功谓词接口**，允许每个执行包区分"良性卡住"（成功终止）与"恶性卡住"（死锁）。它对 `formal-semantics.md` §4.2 中引用的独立提供的成功谓词 $\mathcal{T}_{\mathrm{ok}}$ 进行形式化，并确保四投影一致性定理的条款 (4) 可以逐包实例化。

**本规范提供：**

- 一个通用 `SuccessPredicateInterface<Package>`，由每个包实现
- 用于定义成功终态的逐包定制点
- 与 $(C,R)$ 重写系统中停步状态的关系
- 可判定性要求与证明义务

**非目标：**

- 运行时策略（属于包定义）
- 各包的具体成功判据（每个包自定义）
- 动态策略更新（成功判据在每个包版本中是静态的）

## 2. 核心定义

### 2.1 终态分类

给定一个带状态同余 $\equiv_R$ 的重写系统 $(C,R)$，每个等价类 $[g]_{\equiv_R}$ 恰好落入以下三类之一：

| 分类         | 定义                 | 形式表达                                                     |
| ------------ | -------------------- | ------------------------------------------------------------ |
| **非终态**   | 可执行至少一个重写步 | $\exists e, h.\ g \xrightarrow{e} h$                         |
| **成功终止** | 卡住且满足成功谓词   | $\text{Stuck}([g]) \land \mathcal{T}_{\mathrm{ok}}([g])$     |
| **死锁**     | 卡住且不满足成功谓词 | $\text{Stuck}([g]) \land \neg\mathcal{T}_{\mathrm{ok}}([g])$ |

其中 $\text{Stuck}([g]) := \nexists e, h.\ g \xrightarrow{e} h$（该等价类没有出向具体事件）。

### 2.2 独立提供的成功谓词

摘自 `formal-semantics.md` §4.2：

> 令 $\equiv_R$ 为选定的重写状态等式/同余，并令 $\mathcal{T}_{\mathrm{ok}}$ 为对 $\equiv_R$ 饱和的、**独立提供的成功谓词**。

**所需的关键性质：**

1. **对同余饱和：** 若 $g \equiv_R g'$，则 $\mathcal{T}_{\mathrm{ok}}([g]) \iff \mathcal{T}_{\mathrm{ok}}([g'])$
2. **可判定性：** 对任意代表元 $g$，检查 $\mathcal{T}_{\mathrm{ok}}([g])$ 终止
3. **稳定性：** 该谓词在执行过程中不变（每个包版本中静态）

## 3. 通用接口定义

### 3.1 类型签名

```lean
structure SuccessPredicateInterface (Package : Type) where
  -- The package's state type (typically Config or a refinement)
  State : Type

  -- State congruence for the package's rewriting system
  stateCongruence : State → State → Prop
  stateCongruence_equiv : Equivalence stateCongruence

  -- The success predicate on equivalence classes
  isSuccessTerminal : State → Prop

  -- Proof obligations:
  congruence_saturated :
    ∀ g g', stateCongruence g g' →
    (isSuccessTerminal g ↔ isSuccessTerminal g')

  decidable_success :
    ∀ g, Decidable (isSuccessTerminal g)

  -- The predicate is only meaningful for stuck states
  stuck_only :
    ∀ g, isSuccessTerminal g → ¬∃ e h, g ⟶[e] h
```

### 3.2 包实例化模板

每个包必须提供：

```lean
def MyPackage.successPredicateInterface :
  SuccessPredicateInterface MyPackage where
  State := MyPackage.Config
  stateCongruence := MyPackage.configEquiv
  stateCongruence_equiv := MyPackage.configEquiv_is_equivalence
  isSuccessTerminal := MyPackage.isSuccess
  congruence_saturated := MyPackage.success_respects_equiv
  decidable_success := MyPackage.success_decidable
  stuck_only := MyPackage.success_implies_stuck
```

## 4. 逐包定制：定义 $T_{\mathrm{ok}}$

### 4.1 成功判据设计空间

每个包根据其领域定义何为"成功终止"：

| 包类型         | 示例成功判据             | 理由       |
| -------------- | ------------------------ | ---------- |
| **工作流编排** | 所有任务完成，无待处理边 | 工作已完成 |
| **Agent 对话** | 显式目标达成或优雅退出   | 有意结束   |
| **资源管理**   | 所有资源已释放，无泄漏   | 干净关闭   |
| **请求/响应**  | 响应已交付，连接已关闭   | 协议完成   |
| **事件处理**   | 事件队列为空，处理器空闲 | 静默状态   |

### 4.2 常见模式

**模式 1：显式成功标记**

```lean
def isSuccess (g : Config) : Prop :=
  g.controlState = ControlState.SUCCESS ∧
  g.pendingWork.isEmpty
```

**模式 2：结构性完成**

```lean
def isSuccess (g : Config) : Prop :=
  (∀ node ∈ g.nodes, node.status = NodeStatus.COMPLETED) ∧
  (∀ edge ∈ g.edges, edge.satisfied)
```

**模式 3：资源耗尽（肯定意义）**

```lean
def isSuccess (g : Config) : Prop :=
  g.activeAgents.isEmpty ∧
  g.pendingMessages.isEmpty ∧
  g.allocatedResources.isEmpty
```

**模式 4：目标满足**

```lean
def isSuccess (g : Config) : Prop :=
  ∃ goal ∈ g.declaredGoals,
    goal.satisfied ∧ goal.priority = Priority.PRIMARY
```

### 4.3 反模式（不可使用）

❌ **非确定性判据：**

```lean
-- BAD: depends on current time
def isSuccess (g : Config) : Prop :=
  getCurrentTime() > g.deadline
```

❌ **非同余饱和：**

```lean
-- BAD: depends on specific representative, not equivalence class
def isSuccess (g : Config) : Prop :=
  g.internalNodeId = 42  -- sensitive to graph isomorphism
```

❌ **不终止的检查：**

```lean
-- BAD: may not terminate
def isSuccess (g : Config) : Prop :=
  ∃ n : ℕ, iterateN g n = someFixedState
```

## 5. 与停步状态的关系

### 5.1 停步状态分类法

```text
                     All States
                         |
          ┌──────────────┴──────────────┐
          |                             |
    Non-terminal                    Terminal
   (can step)                        (stuck)
                                        |
                         ┌──────────────┴──────────────┐
                         |                             |
              Successful Termination               Deadlock
              T_ok([g]) = true               T_ok([g]) = false
```

### 5.2 按包类型的示例

**请求/接受协调：**

```lean
def RAPackage.isSuccess (g : Config) : Prop :=
  match g.protocolState with
  | ProtocolState.COMPLETE => true        -- handshake done
  | ProtocolState.ESTABLISHED => false    -- stuck waiting
  | ProtocolState.REQUESTING => false     -- stuck waiting
  | _ => false                            -- other deadlock
```

**资源受限工作流：**

```lean
def WorkflowPackage.isSuccess (g : Config) : Prop :=
  g.workQueue.isEmpty ∧
  (∀ r ∈ g.resources, r.released) ∧
  g.rank = 0  -- DAG projection has no more dependencies
```

**Agent 任务执行：**

```lean
def AgentPackage.isSuccess (g : Config) : Prop :=
  g.taskStatus = TaskStatus.DELIVERED ∧
  g.agentState = AgentState.IDLE ∧
  g.pendingFeedback.isEmpty
```

### 5.3 外部等待与死锁

一个关键区分：

| 状态                   | 卡住？ | 成功？ | 分类                 | 解释                 |
| ---------------------- | ------ | ------ | -------------------- | -------------------- |
| 等待人工批准           | 是     | 否     | **外部等待**（死锁） | 无外部输入无法继续   |
| 等待网络响应           | 是     | 否     | **外部等待**（死锁） | 无外部事件无法继续   |
| 工作完成，空闲         | 是     | 是     | **成功**             | 有意静默             |
| 工作未完成，无规则适用 | 是     | 否     | **真正死锁**         | 无法继续，工作未完成 |

**设计指导：** 如果一个停步状态需要外部干预才能继续，将其分类为死锁（而非成功），即使该等待是"预期的"。成功意味着包已达成其目标，而非仅仅到达一个稳定状态。

## 6. 与四投影定理条款(4)的一致性

### 6.1 条款 (4) 要求

摘自 RFC-0002 §3：

> **(4) 终态观测一致性：** $\mathcal{T}_{\mathrm{ok}}([g])$ 当且仅当 $\mathcal{T}_{i,\mathrm{ok}}([P_i(g)])$。与条款 (2)–(3) 一起，这在选定的可观察商 LTS 中保持正常形式、成功终止与死锁。

### 6.2 逐投影成功谓词

每个投影必须定义自己的成功谓词，且与源一致：

| 投影      | 成功谓词 $\mathcal{T}_{i,\mathrm{ok}}$     | 典型定义                   |
| --------- | ------------------------------------------ | -------------------------- |
| **DAG**   | $\mathcal{T}_{\mathrm{DAG},\mathrm{ok}}$   | 无待处理边，汇聚节点已满足 |
| **Petri** | $\mathcal{T}_{\mathrm{Petri},\mathrm{ok}}$ | 标记位于指定的成功库所     |
| **π**     | $\mathcal{T}_{\pi,\mathrm{ok}}$            | 进程结构等价于成功标记     |
| **态射**  | $\mathcal{T}_{\mathrm{Mor},\mathrm{ok}}$   | 与源同一（按构造）         |

### 6.3 一致性证明义务

对每个实现 `SuccessPredicateInterface` 的包，投影证书必须证明：

```lean
theorem terminal_consistency
  (pkg : SuccessPredicateInterface Package)
  (cert : ProjectionCertificate pkg) :
  ∀ g : pkg.State,
    pkg.isSuccessTerminal g ↔
    cert.target.isSuccessTerminal (cert.project g) := by
  -- Package must prove this for each projection
```

**各投影状态：**

- **态射：** 按构造（同一性视图）
- **DAG：** 参考夹具完整；生产包提供逐规则证明
- **Petri：** 参考夹具完整；生产包提供逐规则证明
- **π：** 参考夹具对受限关系完整；完整反射开放

## 7. 可判定性要求

### 7.1 计算内容

成功谓词必须是**可执行的**，而非仅是逻辑规范：

```lean
-- Good: computable
def isSuccess (g : Config) : Bool :=
  g.nodes.all (·.status == NodeStatus.COMPLETED)

instance : Decidable (isSuccess g) :=
  decidable_of_bool (isSuccess g) (by simp [isSuccess])

-- Bad: non-computable
noncomputable def isSuccess (g : Config) : Prop :=
  ∃ n : ℕ, Classical.choice ⟨iterateN g n, sorry⟩ = fixedPoint
```

### 7.2 复杂度界

虽非形式上必需，成功谓词应**高效可判定**：

- **推荐：** $O(|g|)$，其中 $|g|$ 为配置大小
- **可接受：** $O(|g|^2)$，用于复杂结构检查
- **应避免：** 指数或无界复杂度

### 7.3 证明策略

要证明可判定性，展示成功谓词可分解为可判定的原语：

```lean
theorem success_decidable (g : Config) :
  Decidable (isSuccessTerminal g) := by
  -- Decompose into decidable components
  have h1 : Decidable (g.workQueue.isEmpty) := inferInstance
  have h2 : Decidable (∀ r ∈ g.resources, r.released) := by
    apply Finset.decidableForallOfDecidableMemAndDecidablePred
  -- Combine via boolean operations
  exact And.decidable
```

## 8. 证明义务汇总

每个实现 `SuccessPredicateInterface` 的包必须证明：

| 义务                 | 形式陈述                                                                                  | 难度         |
| -------------------- | ----------------------------------------------------------------------------------------- | ------------ |
| **同余饱和**         | $g \equiv_R g' \to (\mathcal{T}_{\mathrm{ok}}([g]) \iff \mathcal{T}_{\mathrm{ok}}([g']))$ | 低–中        |
| **可判定性**         | `Decidable (isSuccessTerminal g)`                                                         | 低           |
| **仅停步**           | $\mathcal{T}_{\mathrm{ok}}([g]) \to \neg\exists e,h.\ g \xrightarrow{e} h$                | 中           |
| **投影一致性（×4）** | $\mathcal{T}_{\mathrm{ok}}([g]) \iff \mathcal{T}_{i,\mathrm{ok}}([P_i(g)])$ 逐投影        | 中–高        |
| **稳定性**           | 成功谓词在执行过程中不变                                                                  | 低（按构造） |

## 9. 参考实现：P1c admitted 操作

当前参考行为总结于
[理论交付](../THEORY-CLOSURE-DELIVERY-2026-07-27.md) 并受
[QA 证据](../qa/evidence/2026-07-28-cantilune-theory-source-59a1a688.md) 约束：

> 对于每个具体的 admitted 不匹配、重连或静默删除出现，一个可重放的业务转移到达一个被分类为恰好以下之一的状态：成功、外部等待、真正死锁，或一个显式有产出的外部保持的无限可观察迹。

### 9.1 P1c 终态分类

```lean
inductive P1cTerminalClass
  | success         -- Clean completion
  | externalWait    -- Blocked on external input (classified as deadlock)
  | genuineDeadlock -- Cannot proceed, work incomplete
  | productive      -- Infinite external hold trace (not stuck)

def P1cPackage.classifyTerminal (g : Config) : P1cTerminalClass :=
  match g.controlState with
  | ControlState.COMPLETE =>
      if g.pendingWork.isEmpty then
        P1cTerminalClass.success
      else
        P1cTerminalClass.genuineDeadlock
  | ControlState.WAITING_EXTERNAL =>
      P1cTerminalClass.externalWait
  | ControlState.HOLD_EXTERNAL =>
      P1cTerminalClass.productive  -- not stuck
  | _ => P1cTerminalClass.genuineDeadlock

def P1cPackage.isSuccess (g : Config) : Prop :=
  P1cPackage.classifyTerminal g = P1cTerminalClass.success
```

### 9.2 已证性质

摘自研究日志：

- **两两不相交：** 四类划分终态空间
- **同一端点：** 所有分类引用同一计算出的 `Config`、重放记录与四视图推导
- **外部处置：** 分类在图重写之后决定，而非期间

## 10. 与执行包的集成

### 10.1 ExecutionPackage 集成

```lean
structure ExecutionPackage (σ : Signature) where
  State : Type
  Event : Type

  -- ... native steps, replay, etc.

  -- Success predicate integration
  successPredicate : SuccessPredicateInterface Package

  -- Terminal states must respect the predicate
  terminal_classification :
    ∀ s : State, Stuck s →
      Xor (successPredicate.isSuccessTerminal s)
          (¬successPredicate.isSuccessTerminal s)
```

### 10.2 随机反馈集成

同一交付与证据记录了随机反馈边界：

> 几乎必然稳定命中在此同一事件路径概率空间上成立。

成功谓词定义了命中时间分析的**目标集**：

```lean
def hitSuccessTime (ω : SamplePath) : ℕ⊤ :=
  inf { n | pkg.isSuccessTerminal (ω n) }

theorem almost_sure_success_or_deadlock
  (fairScheduler : ExecutionPackage pkg) :
  ℙ[∃ n, Stuck (ω n)] = 1 →
  ℙ[∃ n, pkg.isSuccessTerminal (ω n) ∨
         ¬pkg.isSuccessTerminal (ω n)] = 1 := by
  -- Every stuck state is classified
```

## 11. 与操作语义的关系

### 11.1 正常形式与成功

**正常形式**（停步状态）是重写系统 $(C,R)$ 的性质：

- 定义为：$\nexists e, h.\ g \xrightarrow{e} h$
- 来源：重写规则 $R$
- 通用：所有包的同一定义

**成功**是包特定的解释：

- 定义为：$\mathcal{T}_{\mathrm{ok}}([g])$，其中 $g$ 停步
- 来源：包领域知识
- 包特定：每个包自定义

### 11.2 可观测性与迹语义

成功谓词支持**迹性质验证**：

```lean
-- Safety: "nothing bad happens"
def safetyProperty (trace : List Event) : Prop :=
  ∀ i, let g := executeTrace trace.take i in
    Stuck g → pkg.isSuccessTerminal g

-- Liveness: "something good eventually happens"
def livenessProperty (trace : List Event) : Prop :=
  ∃ i, let g := executeTrace trace.take i in
    pkg.isSuccessTerminal g
```

## 12. 包作者设计指南

### 12.1 定义成功谓词的检查清单

- [ ] 成功是**有意终止**，而非偶然静默
- [ ] 成功蕴含**目标达成**，而非仅稳定性
- [ ] 外部等待分类为**死锁**，而非成功
- [ ] 谓词**对同余饱和**（与代表元无关）
- [ ] 谓词**可判定**且复杂度合理
- [ ] 谓词**可测试**（可在单元测试中检查）
- [ ] 成功状态**停步**（无进一步重写可能）

### 12.2 测试策略

```lean
-- Unit test template
example : pkg.isSuccessTerminal successState := by
  unfold pkg.isSuccessTerminal
  -- Prove success criteria satisfied
  constructor <;> simp [successState]

example : ¬pkg.isSuccessTerminal deadlockState := by
  unfold pkg.isSuccessTerminal
  -- Prove success criteria not satisfied
  intro h; cases h <;> contradiction

example : Stuck successState := by
  intro ⟨e, h, step⟩
  -- Prove no step possible from success state
  cases step <;> contradiction
```

## 13. 开放问题与未来工作

1. **动态成功判据：** 如何处理成功判据随包版本演变的包？（可能：按签名 epoch 的版本谓词）
2. **组合式成功：** 组合包时成功谓词如何组合？（可能：合取或包特定的组合规则）
3. **部分成功：** 一个包能否"部分成功"？（当前答案：否，成功是布尔的；使用多个包或目标跟踪）
4. **成功见证：** 成功谓词是否应携带证据（例如哪个目标已满足）？（当前答案：否，成功是一元的；见证属于可观测层）

## 14. 参考文献

- `docs/spec/formal-semantics.md` §4.2（衍生性质，正常形式，终止，死锁）
- RFC-0002 §3（四投影一致性定理，条款 4）
- `docs/THEORY-CLOSURE-DELIVERY-2026-07-27.md`（当前终态与随机证明边界）
- ADR-0001（统一形式结构，成功谓词作为独立关注点）

## 15. 修订历史

| 日期       | 变更     | 作者            |
| ---------- | -------- | --------------- |
| 2026-07-27 | 初始草案 | Joker-of-Gotham |

---

**治理说明：** 本规范定义接口；各包提供实例。成功谓词定义是**包一致性工作**（FCP 后），而非核心理论 FCP 门禁。通用接口与参考见证（P1c）展示可满足性。
