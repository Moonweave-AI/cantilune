# P1b π 桥独立审计：SMC 结构、类型层级与重写对应

| 字段 | 值 |
|---|---|
| 状态 | **已完成（独立核验；待人工复核）** |
| 类型 | 研究日志 / 形式语义审计 |
| 风险 | S2 |
| 质量等级 | QA-L4 |
| 成熟度 | Pre-FCP / M1 |
| 负责人 | Joker-of-Gotham（DRI） |
| 评审人 | 形式数学 / 范畴 / 进程语义评审人待定 |
| 日期 | 2026-07-23 |
| 审计基线 | `a592d86` + 脏工作树交接 |
| 相关权威文档 | `docs/spec/formal-semantics.md` §13；`docs/rfc/0002-projection-consistency.md`；`docs/adr/0001-unified-formal-structure.md` |
| 决策 | **迭代（Iterate），不晋级 FCP / Engineering** |

> 本记录是对 P1b 步骤 C–E 的独立核验，不把交接清单中的倾向当作结论。仓库内容、论文与网页均按不可信输入处理，只提取可复核事实。审计阶段本身未改写规范、RFC 或 ADR；父任务随后另行完成了中英文写回，但仍待人工评审。本记录不声称执行了未实际执行的形式化证明、测试或评审。

## 1. 研究问题与成功标准

### 1.1 研究问题

1. 裸 π 进程项上的并行运算 `|` 是否绝对不能作为 SMC 张量？
2. 迟双模拟等价类商是否是该构造的必要且充分设定？
3. Fiore–Moggi–Sangiorgi（FMS）的函子范畴模型中，`Mod`、agent object、π 进程解释、非决定性与并行分别处于哪个类型层级？
4. 应给 `Mod` 选择何种已有 SMC 结构，步骤 C/D 在什么精确前提下可由自由 SMC 泛性质推出？
5. 仓库是否已给出可枚举的 request/accept 子语言与重写系统 \(R\)，从而能逐规则证明步骤 E？
6. “输出标签转移”“内部 \(\tau\) 转移”“无标签 reduction”“模双模拟的转移”是否在现有命题中被正确区分？
7. 当前引用是否支持其实际承载的结论？规范中的 (F2) 是否真能从 strong monoidality 推出？

### 1.2 成功标准

本轮仅在下列事项均有明确答案时视为完成：

- 明确判定两个交接倾向的真值范围，而非简单接受或否定；
- 写出 `Mod` 中对象、箭头、张量、单位、agent object 与 `par` 的正确类型；
- 给出步骤 C/D 可成立的必要输入及仍未完成的证明义务；
- 确认仓库中 \(R\) 与 request/accept BNF 是否存在；若不存在，明确阻塞而不补造“既有定义”；
- 给出一个足以开始证明、但明确标为“建议修订”而非仓库事实的最小子语言和两条规则；
- 区分前向保持、反向反射、一步锁步、宏步模拟与 quotient LTS；
- 对承重引用和 (F2) 给出可复核结论；
- 记录负面结果、局限和复现路径。

## 2. 方法、基线与原始来源

### 2.1 仓库核验

审计在提交 `a592d868f19556361cb52aa03772912af4e8bed4` 上进行；开始时工作树已有下列交接修改：

- `docs/spec/formal-semantics.md`
- `docs/spec/zh-CN/formal-semantics.zh-CN.md`
- `docs/rfc/0002-projection-consistency.md`
- `docs/rfc/zh-CN/0002-projection-consistency.zh-CN.md`

本轮逐段核对：

- spec §2、§4、§5.4、§8、§10.6–§10.10、§13；
- RFC-0002 §3、§4.2、§8、§11；
- ADR-0001 中 half-π (II) 的范围与状态。

### 2.2 原始论文与权威来源

直接核验或交叉核验的主要来源如下：

1. M. P. Fiore, E. Moggi, D. Sangiorgi, “A Fully Abstract Model for the π-calculus,” *Information and Computation* 179(1), 76–117 (2002), DOI: [10.1006/inco.2002.2968](https://doi.org/10.1006/inco.2002.2968)。本审计另直接查看作者公开的 [LICS 扩展摘要 PDF](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)，尤其是 π 语法、Table 1 LTS、函子范畴和 open/closed interpretation。
2. J. Meseguer, U. Montanari, “Petri Nets are Monoids,” *Information and Computation* 88(2), 105–155 (1990), DOI: [10.1016/0890-5401(90)90013-8](https://doi.org/10.1016/0890-5401(90)90013-8)。
3. R. Bruni, J. Meseguer, U. Montanari, V. Sassone, “Functorial Models for Petri Nets,” *Information and Computation* 170(2), 207–236 (2001), DOI: [10.1006/inco.2001.3050](https://doi.org/10.1006/inco.2001.3050)；[作者公开最终版](https://eprints.soton.ac.uk/264742/1/prenetsIandCOff.pdf)。
4. S. Lack, P. Sobociński, “Adhesive Categories,” FoSSaCS 2004, LNCS 2987, 273–288, DOI: [10.1007/978-3-540-24727-2_20](https://doi.org/10.1007/978-3-540-24727-2_20)。
5. R. Milner, J. Parrow, D. Walker, “A Calculus of Mobile Processes, II,” *Information and Computation* 100(1), 41–77 (1992), DOI: [10.1016/0890-5401(92)90009-5](https://doi.org/10.1016/0890-5401(92)90009-5)。

### 2.3 方法边界

- 没有运行代码、模拟器、定理证明器或模型检查器；仓库中也没有相关实现。
- 没有随机过程、数据集、模型权重、硬件或 random seed。
- 没有把“论文给出全抽象”推成“论文给出 DPO/逐步重写对应”。
- 没有把候选修订写回规范；本记录只说明为何需要修订及最小可证形状。

## 3. 总结性判定

| 审计项 | 判定 | 影响 |
|---|---|---|
| “裸进程并行不是 SMC 张量” | **绝对表述不成立；仅在把裸语法置于离散范畴并以语法等号作唯一等号时成立** | 不能从“结合律不是原始语法等式”推出任何可能的裸语法范畴构造都失败 |
| “迟双模拟商是必要设定” | **不必要** | 可用结构同余商、自由对称幺单 groupoid、显式 associator/unitor/braiding 或严格化 |
| “迟双模拟商足以完成步骤 C/D/E” | **不充分** | 等价类是 agent object 的元素，不自动给出 `Mod` 的对象/箭头、SMC 函子或重写范畴 |
| `Mod` 的正确既有 SMC | **逐点笛卡尔结构** | 不需要发明“以 π 并行为张量”的 `Mod` 新结构 |
| π 并行与自由半格 join 的关系 | **不同运算** | join 对应非决定性和；π 并行是 `par : A×A→A` |
| 步骤 C/D | **有条件可构造，当前未实例化、未证明** | 必须先给对象映射和每个生成元的自然变换 |
| 步骤 E | **当前不可证明，也不可逐规则反驳：命题域尚未定义** | request/accept 无 BNF，\(R\) 无具体规则 |
| “message-send 对应 output transition，因此是 reduction” | **错误** | 单独输出是可见标签转移；只有与输入同步才产生内部 \(\tau\) / reduction |
| “模双模拟满足原命题” | **不满足字面原命题；只能形成显式弱化后的 quotient theorem** | 必须修改目标关系并证明 quotient LTS 良定义 |
| (F2) “strong monoidal functor 自动提升 DPO” | **错误** | strong monoidality 不蕴含保存 pushout 或 pushout complement |
| P1b 决策 | **Iterate，不晋级** | 先补定义和逐规则证据，再进入人工形式评审 |

## 4. 两个交接倾向的独立判定

### 4.1 倾向一：“裸进程的 `|` 不是 SMC 张量”

该句只有补上设定后才正确：

> 若把裸进程项当作一个**离散范畴**，唯一态射是恒等态射，且对象等号就是未经任何结构同余的语法等号，那么 \((P|Q)|R\) 与 \(P|(Q|R)\) 不是同一对象，也不存在可充当 associator 的非恒等态射；此时直接以 `|` 作张量失败。

但由此不能得到绝对否定。至少还有以下标准选择：

1. 以裸项为对象，以结构同余或显式重排证明为可逆态射，形成自由对称幺单 groupoid；
2. 仅按结构同余（而非行为双模拟）取商；
3. 保留非严格 associator、unitors、braiding，再用 Mac Lane 严格化；
4. 选择能记录转移或证明项的范畴，而非离散语法集合。

一个定律是“原始公理”还是“由其他规则导出”与它能否成为 SMC 的 associator 没有直接逻辑关系；需要检查的是目标范畴中是否有合适的自然同构及其协调，而不是论文是否把结合律列为 primitive syntax equation。

**判定：** 原倾向作为绝对命题过强；作为“当前未定义的裸项离散范畴不工作”的局部诊断成立。

### 4.2 倾向二：“迟双模拟等价类是必要且充分的设定”

**不必要：** 上述 groupoid、结构同余商或严格化都可能避免行为商。

**不充分：**

- FMS 中进程行为类位于 agent object \(A\) 的阶段元素中；它们不是自动成为函子范畴 `Mod` 的对象或箭头。
- 把等价类做成离散范畴会丢失非平凡操作/转移；不能承载步骤 E。
- 把所有进程放进一个对象、同时令分类复合与张量都由 `|` 给出，会面临 Eckmann–Hilton 型坍缩和严重类型错配。
- 即使构造 transition category，也仍须证明路径复合、张量、interchange、并发上下文闭包及协调。
- FMS 明确指出 strong late bisimilarity \(\sim\) 不被 input prefix 保持；request/accept 中 `accept` 是输入前缀。开放、组合式解释需处理 late congruence \(\sim_c\)，不能笼统写“迟双模拟类”。

**判定：** 行为商可作为一种后续观察商，但不是目前桥的必然起点，也不能单独完成 C/D/E。

## 5. `Mod` 类型审计与步骤 C/D 的正确条件

### 5.1 FMS 模型中的类型层级

以 FMS 的约定，索引范畴 \(\mathbb I\) 的箭头是有限名字上下文之间的单射，语义沿单射扩展可见名字，因此相关函子范畴是协变的：

\[
\mathrm{Mod} = [\mathbb I,\mathbf{Set}]
\quad\text{或}\quad
[\mathbb I,\mathbf{Cpo}].
\]

在本审计开始时的脏工作树交接快照中，spec 同时出现 \([\mathbb I^{op},\mathbf{Set}]\) 与 \(\mathbf{Set}^{\mathbb I}\)；该 variance 当时必须统一后才能进行自然性证明。父任务写回后，当前规范已统一为协变形式。

关键类型是：

- \(A\in\mathrm{Mod}\)：agent object；
- \(N\in\mathrm{Mod}\)：name object；
- \(\mathrm{nil}:1\to A\)；
- \(\mathrm{par}:A\times A\to A\)；
- 对自由名字列表 \(V\)，open interpretation 的进程语义为
  \[
  \mathcal O\llbracket V\vdash P\rrbracket:N^{|V|}\to A;
  \]
- closed interpretation 在阶段 \(n=|V|\) 给出 \(A(n)\) 中的元素；只有 \(n=0\) 的真正无名字情形才等价于全局元素 \(1\to A\)。

因此“把一个源生成元映成进程项”并不是一个足以定义 \(E:C\to\mathrm{Mod}\) 的类型正确赋值。SMC 函子要把源对象送到 `Mod` 的对象，把源态射送到自然变换。

### 5.2 正确的既有 SMC 结构

`Mod` 已有逐点笛卡尔 SMC：

\[
(X\times Y)(n)=X(n)\times Y(n),\qquad
I_{\mathrm{Mod}}=1,
\]

箭头的张量也是自然变换的逐点乘积。无需把 π 的 `|` 重新定义成函子范畴张量。

π 并行是 agent object 上的内部运算。对同一名字环境中的两个进程：

\[
N^{|V|}
\xrightarrow{\langle\mathcal O\llbracket P\rrbracket,
\mathcal O\llbracket Q\rrbracket\rangle}
A\times A
\xrightarrow{\mathrm{par}}
A.
\]

自由半格 / 幂域 monad 的 join 表示**非决定性和**，不是 `par`。现有草图把 semilattice join 与 π parallel 混同，是实质性类型与语义错误。

### 5.3 步骤 C/D 可成立的充分输入

设 \(C\) 是类型化生成图上的自由 SMC。要使用自由 SMC 泛性质，至少必须先给出：

1. 每个源基础类型 \(t\) 的对象赋值
   \[
   E_0(t)\in\mathrm{Mod};
   \]
2. 对每个生成元
   \[
   g:t_1\otimes\cdots\otimes t_m
   \longrightarrow
   u_1\otimes\cdots\otimes u_n,
   \]
   给出类型正确的自然变换
   \[
   E_1(g):
   \prod_i E_0(t_i)
   \longrightarrow
   \prod_j E_0(u_j);
   \]
3. 证明这些赋值满足生成图的类型、任何额外关系和名字自然性；
4. 明确 π 进程观察如何通过 \(A\)、`par`、allocation 等内部运算从上述自然变换取得。

满足这些条件后，自由 SMC 泛性质才给出强对称幺单函子扩张，并在协调幺单自然同构意义下唯一。此时：

- tensorator 协调 \(E(f\otimes g)\) 与 \(E(f)\times E(g)\)；只有显式选择严格化/括号约定后才可写成字面等式；
- \(E(g\circ f)=E(g)\circ E(f)\) 是自然变换的分类复合；
- 不能把“\(\circ\) 映为 prefix”当作函子复合的定义；prefix 是 π agent algebra 中的另一种操作。

当前仓库没有 `C` 的 request/accept 生成元 BNF、对象赋值或上述自然变换，故步骤 C/D 仍是**有条件构造方案**，不是已完成证明。

## 6. 步骤 E：为何当前不可证明

### 6.1 仓库中没有可枚举的 \(R\)

仓库目前提供：

- spec §4.1：一般 DPO 规则形状 \(L\leftarrow K\to R\)；
- spec §8.2：把 \(R\) 的精确 schema 明列为开放问题，仅举 `node-advance / token-fire / channel-comm / compose`；
- 本轮交接快照中的旧 spec §13.4 曾以 `channel-create / message-send / compose` 称呼候选规则族；父任务写回后该段已被审计结论取代，这些名称不是当前规范定义。

不存在：

- request/accept 子语言的 BNF；
- sort/type judgments；
- 每条规则的 LHS、interface、RHS；
- match、新鲜性、capture avoidance 和 scope 条件；
- 一次源步骤究竟表示 request、accept、完成握手、分配、发送还是交付；
- `compose` 是静态结构、结构同余、上下文闭包还是实际执行步骤。

因此当前无法完成“逐规则证明”；也不能把缺定义误报成数学反例。准确状态是：**Step E ill-posed / blocked on specification**。

### 6.2 标准 π 规则揭示的确定性问题

FMS Table 1 中：

- prefix rule 使单独输出成为**可见 output-labelled transition**；
- free output 与 input 经 `com` 同步才得到内部 \(\tau\)；
- bound output 与 input 经 `close` 同步才得到内部 \(\tau\)；
- `open` 把受限名字的输出推出为 bound-output premise，本身不是完成握手；
- `par` 与 `res` 是把已有转移放入上下文的推理规则。

所以：

1. “message sent \(\mapsto\) output transition”不满足原命题所写的 π reduction；若源步骤表示交付，编码必须同时含发送方和接收方。
2. 单独的 \(\nu s.P\) 是名字限制/生成构造，不会仅因“分配完成”产生 reduction。
3. 对 restriction 同时包住发送方与接收方的项，可先在内部由 `com` 同步 free output/input，再由 `res` 提升该 \(\tau\)；若 restriction 只包发送方，则由 `open` 产生 bound output，再由 `close` 同步。新鲜性本身不强制选择哪条路径，作用域位置与结构同余策略才决定合法推导。
4. 重括号、交换或接线整理通常只是结构同余；若把它当成源 `compose` rewrite，目标可能只有零步等式，不是一步 reduction。
5. 若产品层 request/accept 实际包含 request 与 acknowledgement 两次通信，一个源宏步骤会对应两个 \(\tau\)，必须改成宏步模拟而非假称锁步。

### 6.3 建议的最小可证子语言

以下是**建议修订**，不是对当前仓库已有定义的转述。采用三类名字：

\[
a:\mathrm{Service},\qquad
s:\mathrm{Session},\qquad
v:\mathrm{Value},
\]

并要求新 session 名字 \(s\) 新鲜。足以承载证明的最小配置语法可取：

\[
\begin{aligned}
G ::= {}& 0 \mid G\mid G \mid (\nu s)G \\
       & \mid \operatorname{req}_a(s).G
       \mid \operatorname{acc}_a(x).G \\
       & \mid \operatorname{out}_s(v).G
       \mid \operatorname{in}_s(x).G .
\end{aligned}
\]

仅保留两个原子动态规则：

\[
\tag{HS}
(\nu s)(
  \operatorname{req}_a(s).P
  \mid
  \operatorname{acc}_a(x).Q)
\longrightarrow_{\mathrm{hs}}
(\nu s)(P\mid Q\{s/x\}),
\]

\[
\tag{MSG}
\operatorname{out}_s(v).P
\mid
\operatorname{in}_s(x).Q
\longrightarrow_{\mathrm{msg}}
P\mid Q\{v/x\}.
\]

规则可在并行、restriction 和结构同余上下文中闭包；这些闭包不另计业务步骤。`compose` 留在静态 SMC 或结构同余层，不进入此最小 \(R_{\mathrm{RA}}\)。

相应 raw π 编码采用：

\[
\begin{aligned}
\llbracket\operatorname{req}_a(s).P\rrbracket
  &= \bar a s.\llbracket P\rrbracket,\\
\llbracket\operatorname{acc}_a(x).Q\rrbracket
  &= a(x).\llbracket Q\rrbracket,\\
\llbracket\operatorname{out}_s(v).P\rrbracket
  &= \bar s v.\llbracket P\rrbracket,\\
\llbracket\operatorname{in}_s(x).Q\rrbracket
  &= s(x).\llbracket Q\rrbracket.
\end{aligned}
\]

对上面 restriction 包住双方的 (HS) 形状，其像由内部 `com` 前提再经 `res` 得到一个 \(\tau\)。若规定 scope extrusion 且 \(s\) 对接收方新鲜，可先同余改写为 restriction 只包发送方的形状，再由 `open` premise + `close` conclusion 得到同一目标。(MSG) 的像由 `com` 得到一个 \(\tau\)。这里的推理规则层级不是多个运行步骤。

### 6.4 必须证明的前向与反射义务

先从原生 π LTS 中独立定义 raw 可观察推导域 \(\mathcal D_\pi^{obs}\)，同时给出行政步策略，以及一个使所选可观察商 LTS 良定义且与代表元无关的目标状态同余 \(\equiv_\pi^{obs}\)；该域不得定义成前向像。再定义源事件与该域推导之间的关系 \(\operatorname{Lift}_\pi\)。对具体源事件 \(e=(\rho,m,\delta)\) 的前向合法性要求：

\[
g\xrightarrow{e}h
\implies
\exists P,d\in\mathcal D_\pi^{obs}.\;
d:\llbracket g\rrbracket\xrightarrow{\tau}_\pi P
\land
P\equiv_\pi^{obs}\llbracket h\rrbracket
\land
\operatorname{Lift}_\pi(e,d),
\qquad
\rho\in\{\mathrm{hs},\mathrm{msg}\}.
\]

上述前向式仍不足以支持“不捏造、不漏步”或“同一个 run”；还需要在独立定义的可观察推导域上证明反射：

\[
d\in\mathcal D_\pi^{obs},\quad
d:\llbracket g\rrbracket\xrightarrow{\tau}_\pi P
\implies
\exists e,h.\;
g\xrightarrow{e}h
\land
P\equiv_\pi^{obs}\llbracket h\rrbracket
\land
\operatorname{Lift}_\pi(e,d).
\]

反射证明还需：

- service/session 名字分区和新鲜性；
- 禁止编码引入源语言中不存在的意外同步；
- 明确节点内部 \(\tau\) 是否属于本投影；
- 若容许 administrative steps，给出其擦除或 stuttering 规则；
- 若一次源步对应多次 \(\tau\)，把结论明确改为
  \(\xRightarrow{\tau}\)，并放弃“字面同一步”的锁步主张。
- 记录 occurrence 可带标签 \((e,d)\)，擦除后为原生推导 \(d\)；若要从 raw \(d\) 唯一恢复 \(e\)，须另证单射/唯一性，本处不预设。

`res(com)`、`close` 与 `com` 的外部 action label 都是 \(\tau\)。若跨投影 trace 要区分握手与消息，必须另外保存 π 推导见证或源 rewrite ID；只看标准 π action trace 无法恢复是哪条源规则或采用了哪种推导形状。

### 6.5 “模双模拟”的正确陈述

双模拟关系的是状态/进程，不是 transition。可接受的 endpoint-up-to 形式是：

\[
\llbracket g\rrbracket
\xrightarrow{\tau}_\pi P
\quad\land\quad
P\sim\llbracket h\rrbracket.
\]

若要在商上陈述，必须先定义并证明 quotient LTS：

\[
[P]\xrightarrow{\alpha}_{/\sim}[Q]
\quad\Longleftrightarrow\quad
\text{存在适当代表元 }P',Q'
\text{ 使 }P'\xrightarrow{\alpha}_\pi Q'.
\]

然后才能写：

\[
[\llbracket g\rrbracket]
\xrightarrow{\tau}_{/\sim}
[\llbracket h\rrbracket].
\]

这是一条**修订后的商 LTS 定理**，不是原命题字面的
\(E(g)\to E(h)\)。它也不能把只有可见 output 的步骤变成 reduction，不能把没有转移的结构等式变成一步转移。

另需区分：

- closed whole-system 可考虑 strong late bisimilarity；
- 开放且在 input prefix 下组合的 request/accept 编码必须处理 late congruence / open interpretation；
- full abstraction 把语义等号与行为等价对应起来，不自动提供逐步 operational correspondence。

## 7. `E:C\to\mathrm{Mod}` 与 operational encoding 必须拆层

当前写法把三个层级混在同一个 \(E\) 中：

1. 自由 SMC \(C\) 的对象和态射；
2. `Mod` 中的函子对象和自然变换；
3. raw π 进程及其 LTS/reduction。

更清楚的桥应因子化为：

\[
C_{\mathrm{RA}}
\xrightarrow{E_{\mathrm{stat}}}
\mathcal D
\]

处理静态 SMC 解释。对每个枚举名字阶段 \(n\)，操作/指称桥至多可写成

\[
\mathrm{Conf}_{\mathrm{RA}}(n)
\xrightarrow{\llbracket-\rrbracket_{\mathrm{op}}}
\mathrm{Proc}_\pi(n)
\xrightarrow{q_n}
\mathrm{Proc}_\pi(n)/{\sim_n}
\xrightarrow{\mathrm{den}_n}
A(n).
\]

这里 \(A\) 是 `Mod` 的对象，不是 `Mod` 的子集或子范畴。若要给出整体表述，须先构造过程商类函子 \(Q\in\mathrm{Mod}\)，再给自然变换 \(\mathrm{den}:Q\to A\)；自然性与代表元无关性仍是证明义务。

- SMC 函子性在第一条或适当的过程语义范畴中证明；
- 步骤 E 的 raw operational correspondence 在第二条第一段证明；
- quotient 与 FMS full abstraction 是后续观察语义，不替代 raw π 合法性证明。

在未给出 `Conf`、`Proc`、状态/态射层级和重写装备前，
\(E(g)\to_\pi E(h)\) 不是一个类型完整的表达式。

## 8. 引文核验

### 8.1 FMS π 模型

**已核验支持：**

- \(\mathbb I\) 是有限名字上下文与单射的索引；
- 模型位于 `Set`/`Cpo` 上的函子范畴；
- agent object、名字对象、动态分配和非决定性 monad；
- π 的 LTS 包含 input/free output/bound output/\(\tau\)，以及 `com`、`close`、`open`、`par` 等规则；
- open interpretation 对应 congruence，closed interpretation 对应 bisimulation；
- 论文目标是全抽象，不是 cantilune 的 DPO rewrite lift。

**不支持：**

- 把 π parallel 等同于自由半格 join；
- 自动得到 \(C\to\mathrm{Mod}\) 的 SMC 函子；
- 自动得到每条 cantilune rewrite 对应一步 π reduction。

### 8.2 Meseguer–Montanari 与 pre-net

Meseguer–Montanari 1990 的书目信息和 Petri net 代数组合方向已核验。它不支持把“某特定构造中的 Eckmann–Hilton 现象”泛化成“任意交换幺单范畴中所有 \(\circ\) 与 \(\otimes\) 全局相等”。

Bruni–Meseguer–Montanari–Sassone 2001 已核验支持：

- collective-token 的严格对称幺单解释；
- 旧 individual-token 构造的 universality/functoriality 问题；
- pre-net 修复和 operational semantics adjunction；
- 左伴随带来的 colimit-preserving compositionality。

“pre-net / 自由 SSMC 因而保留有序边界与串并区分”可作为该构造的推论陈述，但不应写成无条件的所有范畴定理。

### 8.3 Lack–Sobociński 与 Gadducci–Montanari

Lack–Sobociński 支持 adhesive category / DPO 的基础，但不支持：

> 任意 strong monoidal functor 都保存 DPO 所需的 pushout 与 pushout complement。

“Gadducci–Montanari, functorial semantics of rewriting”这一精确引文没有核实到；不应继续作为 (F2) 的权威出处。精确题名 **“Functorial Semantics of Rewrite Theories”** 属于 José Meseguer，收于 LNCS 3393, 220–235 (2005)，DOI: [10.1007/978-3-540-31847-7_13](https://doi.org/10.1007/978-3-540-31847-7_13)。Gadducci–Montanari 实际存在的相关论文包括 **“Comparing Logics for Rewriting: Rewriting Logic, Action Calculi and Tile Logic”**，*Theoretical Computer Science* 285(2), 319–358 (2002)，DOI: [10.1016/S0304-3975(01)00362-0](https://doi.org/10.1016/S0304-3975(01)00362-0)。这些 tile/rewrite 工作也不等于当前所需的 DPO lift 定理；应删除误归属，逐条声明 functor 的保存条件并引用确实证明该条件的来源。

## 9. (F2) 的确定性反例

取笛卡尔 SMC \((\mathbf{Set},\times,1)\)，定义：

\[
F:\mathbf{Set}\to\mathbf{Set},
\qquad
F(X)=X^2=X\times X.
\]

它是 strong symmetric monoidal，因为：

\[
F(X\times Y)
=(X\times Y)^2
\cong
X^2\times Y^2
=F(X)\times F(Y),
\qquad
F(1)\cong1.
\]

考虑 pushout：

\[
1\longleftarrow\varnothing\longrightarrow1.
\]

其 pushout 是二元素集合 \(2\)。应用 \(F\) 后：

\[
F(1)=1,\qquad
F(\varnothing)=\varnothing,\qquad
F(2)=4.
\]

像 diagram
\(1\leftarrow\varnothing\to1\)
自身的 pushout 仍是 \(2\)，但原 pushout 的像是 \(4\)；比较映射
\(2\to4\)
不是同构。因此 \(F\) strong cartesian monoidal，却不保存该 pushout。

故：

\[
\text{strong monoidal}
\centernot\implies
\text{pushout-preserving}
\centernot\implies
\text{DPO-lifting}.
\]

要提升 DPO，必须额外要求并实际证明 functor 保存本规则所需的 pullback、沿 mono 的 pushout、pushout complement 等结构；可用合适的左伴随/adhesive functor 条件，或对有限规则逐条直接证明。不能用 strong monoidality 代替。

## 10. 负面结果记录

本轮保留以下负面结果，不能在后续摘要中删除：

1. “并行律不是 primitive，因此裸进程绝不可能成 SMC”被否定为过强推断。
2. “迟双模拟商是必要且充分设定”被否定。
3. 把自由半格 join 解释为 π parallel 被否定；join 对应非决定性和。
4. 当前“生成元映进程项、\(\circ\) 映 prefix”的 \(E\) 未通过类型检查。
5. request/accept 子语言和 \(R\) 不存在可复现定义，Step E 尚无可枚举证明义务。
6. 单独 output transition 不是内部 communication reduction。
7. 新鲜通道创建必须固定 restriction 位置与结构同余策略；双方同在 restriction 内可走 `res(com)`，scope extrusion 后可走 `open/close`，不能仅凭“新鲜”断言必须 `close`。
8. `compose` 若是结构整理，只能给零步/同余，不能冒充一步 π reduction。
9. 模双模拟只能支撑显式弱化后的 endpoint/quotient 命题，不能原样满足 RFC 的字面一步定理。
10. RFC 当前前向条件不足以推出“不捏造、不漏步”；缺反射方向。
11. (F2) 的一般表述被 \(X\mapsto X^2\) 反例推翻。
12. Gadducci–Montanari 的归属为误归属；精确题名属于 Meseguer (2005)。

## 11. 复现清单

- [x] 记录提交基线：`a592d868f19556361cb52aa03772912af4e8bed4`。
- [x] 记录审计开始时相关脏工作树文件。
- [x] 阅读 spec 中 \(C\)、\(R\)、LTS、rewriting functor 与 §13 全部相关定义。
- [x] 阅读 RFC-0002 的定理、P1b 范围、粒度开放问题和 tracking 状态。
- [x] 在全仓库检索 request/accept、handshake、channel-create、message-send、compose 与规则 schema；未发现额外 BNF/实现。
- [x] 核对 FMS 作者 PDF 中 π 语法、Table 1、late bisimulation/congruence、agent object 与 open/closed interpretation。
- [x] 核对 Meseguer–Montanari、Bruni et al.、Lack–Sobociński 的书目信息和支持边界。
- [x] 手工验证 \(F(X)=X^2\) strong cartesian monoidal 但不保给定 pushout。
- [x] 明确未运行测试、模拟、定理证明器、模型检查器或部署。
- [x] 明确最小 BNF/HS/MSG 是建议修订，不是仓库既有事实。
- [x] 父任务已将核验结论同步写回中英文 spec/RFC/ADR；写回仍待人工评审。
- [ ] 形式数学评审人独立复核本记录。
- [ ] 将经评审接受的最终定义（而非本轮候选见证）写回 spec/RFC/ADR。
- [ ] 对最终 \(C_{\mathrm{RA}},R_{\mathrm{RA}}\) 进行机器或逐推导证明。

## 12. 局限

1. 仓库没有最终 request/accept 协议语义；本记录选择“一次受限 fresh-session 握手”仅作为最小可证候选。若产品协议有 ack、拒绝、超时或并发竞争，规则和步数必须扩展。
2. 没有形式化 typed/sorted π；`Service/Session/Value` 只是建议的最小 sort 边界。
3. 没有证明 pointwise-cartesian 方案最终满足产品希望的“源 tensor 被观察为 π parallel”；可能需要额外的 algebra/lax-monoidal 层。
4. 没有构造 transition category，也没有证明 quotient LTS 对 late congruence 的代表元独立性。
5. 没有证明前向或反射定理；只是把可证明命题所需的定义与义务写清。
6. 本审计基于脏工作树交接快照；后续文档变化必须重新核对。
7. 引用核验只确认本文列出的支撑边界，不代表对论文所有定理做了完整复现。

## 13. 决策与最小合规路径

**Decision：Iterate；不晋级 FCP，不晋级 Engineering。**

当前没有安全 Stop-Ship，但存在形式正确性 gate：在下列事项完成并经独立形式评审前，不得把 P1b 标记为“已证”，不得声称 π 镜头与其他三投影锁步一致或可无漂移重放。

| 下一行动 | Owner | 评审 / 完成条件 | 权威写回位置 |
|---|---|---|---|
| 固定 `Service/Session/Value` sort、request/accept BNF 和配置语义 | DRI + 进程语义评审人 | 无 prose-only 构造；每个 binder/scope/freshness 条件可复现 | spec §13 |
| 明确定义 \(C_{\mathrm{RA}}\) 的对象、生成元和生成元类型 | DRI + 范畴评审人 | 可写出完整 \(E_0/E_1\) | spec §13 Step C |
| 使用逐点笛卡尔 `Mod`，区分 `par` 与 semilattice join | DRI + FMS 语义评审人 | 所有项类型正确、variance 一致 | spec §10.9 / §13 |
| 给出 \(R_{\mathrm{RA}}\) 的 L/K/R 与匹配条件 | DRI + rewriting 评审人 | 至少 HS/MSG 可枚举；`compose` 层级明确 | spec §4 / §13 Step E |
| 独立定义 raw 可观察推导域、状态同余、行政步策略与 \(\operatorname{Lift}_\pi\)，再逐规则证明 forward 与 exhaustiveness | 形式数学评审人 | 每条源规则按规则与 restriction 位置有真实 `res(com)`、`open` + `close` 或 `com` 推导；每条相关 raw 目标推导有来源；无循环定义 | spec §13 Step E |
| 决定 lockstep、宏步或 quotient theorem | DRI + RFC 评审人 | RFC §3、§4、§8 粒度陈述一致 | RFC-0002 |
| 定义对状态同余饱和的成功终态谓词并证明跨投影保持/反射 | DRI + 形式数学评审人 | normal form、成功终止与死锁不漂移 | RFC-0002 条款 (4) |
| 修正 (F2) 与引文 | 文档 Owner + rewriting 评审人 | 删除错误一般定理和未确认归属；写明 preservation hypotheses | spec §10.6 / §10.10 / §11 |
| 第二位形式数学评审人签字 | Reviewer TBD | 独立复核 C/D/E 与反例 | RFC-0002 FCP gate |

只有上述证据实际产生后，P1b 才可从 M1 / Pre-FCP 重新评估为可晋级状态。
