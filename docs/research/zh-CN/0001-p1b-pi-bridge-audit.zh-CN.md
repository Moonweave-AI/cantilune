---
title: "P1b Pi-Bridge Independent Audit"
status: "Complete (independent audit; human review pending)"
type: "Research Log / Formal-semantics audit"
risk: "S2"
qa: "QA-L4"
maturity: "Pre-FCP/M1"
owner: "Joker-of-Gotham (DRI)"
reviewer: "Formal math / category theory / process semantics reviewer TBD"
date: "2026-07-23"
baseline: "commit a592d86 (a592d868f19556361cb52aa03772912af4e8bed4) plus dirty handoff"
decision: "Iterate, not Promote"
---

# P1b π 桥独立审计

## 结论

`docs/spec/formal-semantics.md` 第 13 节中的 Step C/D 构造目前不是一个良类型的函子构造。阻塞点早于所宣称的 "Step C-prime: prove pentagon/triangle/hexagon"：

1. Fiore-Moggi-Sangiorgi 模型是一个函子范畴，其对象是函子，其箭射是自然变换；
2. 枚举 `n` 名上下文中的 π 进程指称 `A(n)` 的一个元素；只有零名情形才等价于一个全局元素 `1 -> A`，而一个开项指称一个射入 `A` 的态射；
3. π 并行组合是 agent object 上的一个内部运算，而不是整个模型范畴上的张量双函子；并且
4. 所提出的生成元映射没有指定从自由 SMC 出发的函子所需的对象映射或自然变换。

因此，两个交接的倾向判定如下：

- **"裸进程 `|` 不是 SMC 张量" 过强，作为一般性主张予以拒绝。** 它仅在以语法相等为相等关系的裸抽象语法离散范畴上成立。裸项也可以被保留为带有结构同构的对称幺半广群的对象，或仅按结构同余作商。定律是导出而非原始的这一事实，与它们能否提供一个 SMC 呈现无关。
- **"迟双模拟商是必要且充分的" 予以拒绝。** 它对于一个 SMC 呈现并非必要，也不足以定义定理所需的对象、箭射、范畴复合、张量双函子或重写结构。此外，强迟双模拟不被输入前缀保持，这与 `accept` 直接相关；开放组合语义需要迟同余（或一个明确受限的封闭系统定理）。

模型上存在一个正确的、源于grounded的对称幺半结构：**逐点笛卡尔**（pointwise cartesian）结构。在该结构下，一旦且仅一旦每个生成对象与生成箭射都被赋予一个类型正确的解释，一个有条件的 Step C/D 定理便立即从自由 SMC 泛性质得出。这并不把 SMC 张量本身等同于 π 并行；π 并行仍然是内部映射 `par : A x A -> A`。

Step E 目前也不可证。仓库既未定义 P1b 文法，也未定义具象重写规则 `R`（包括左边、接口、右边、匹配、新鲜性与粒度）。本日志给出了一个最小充分的 `hs`/`msg` 片段并陈述了前进与反射义务，但该片段是一个提议的修复，而非已被接受的项目定义。

**决策：迭代，而非晋级。** 在尝试相干性或逐规则证明之前，将 P1b 退回到目标与类型设计阶段（"C0"）。

## 分类与治理路由

| 字段                | 决策                                              | 理由                                                       |
| ------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| 工作对象            | 研究任务 / 形式语义审计                           | 对一个承重证明尝试的独立评审                               |
| 风险                | S2                                                | 无生产执行或敏感数据，但一个错误结果会使一个架构验收门失效 |
| 质量                | QA-L4                                             | 需要显式类型、反例、一手来源核查与独立形式数学评审         |
| 成熟度              | Pre-FCP/M1                                        | RFC-0002 明确仍处于四一致性证明接受之前                    |
| Owner / DRI         | Joker-of-Gotham                                   | 提供了交接元数据                                           |
| 要求的评审人        | 形式数学、范畴论与进程语义；待定                  | 当前日志是独立 agent 工作，非人工批准                      |
| 要求的权威写回      | 本研究日志，然后是评审后的 RFC-0002/spec/ADR 更正 | 聊天不是真理来源                                           |
| 安全/隐私/AI 评估门 | 未触发                                            | 无秘密、个人数据、模型训练、部署或物理动作                 |
| Stop-Ship           | 未发现安全 Stop-Ship                              | 但数学 FCP/ADR 验收门仍然阻塞                              |

## 研究问题与成功标准

### 问题

对于 half-pi (II) 的 request/accept 信道创建子语言，当前第 13 节的构造能否定义一个 SMC 函子

$$
E : C \longrightarrow \mathrm{Mod}
$$

它保持张量、复合、对称与单位，并且其对项目重写规则的像能否被证明是真正的 π 演算步骤？

### 成功标准

审计仅在以下各项全部存在且类型正确时，才将 Step C/D 计为成功：

1. `Mod` 的变方向与对象/箭射已被固定；
2. 在 `Mod` 的所有对象与箭射上提供了张量双函子、单位对象，以及相干的结合子/单位子/辫子；
3. `C` 的每个生成对象都被映射到 `Mod` 的一个对象；
4. 每个生成元 `g : U -> V` 都被映射到一个自然变换 `E(U) -> E(V)`；
5. 由此指派按自由 SMC 泛性质扩展；
6. 任何关于 `C` 张量成为 π `|` 的主张都在正确的范畴层级上表达；
7. 忠实性/反射被单独证明，而非从自由性推断；并且
8. 具象源重写规则与 π 转移推导建立单步前进保持与所要求的反射/无额外步骤性质。

任何类型条目的失败都是当前构造的失败，而非证明不存在任何可重新设计的桥。

## 范围与非目标

在范围内：

- `docs/spec/formal-semantics.md` 第 2、4、10、12 与 13 节；
- `docs/rfc/0002-projection-consistency.md`；
- FMS 函子范畴模型及其进程解释；
- 关于裸 `|` 与双模拟类的两个交接主张；
- 一个最小 P1b 操作文法与重写义务；
- 所宣称的 DPO 提升事实（F2）；以及
- 命名引用的文献身份与断言级支持。

不在范围内：

- 实现一个运行时或证明助手开发；
- 证明完全不受限的 half-pi (II) P1c 语言；
- 选择一个生产信道协议；
- 声称一次人工评审或批准；以及
- 在本审计中更改规范 spec/RFC/ADR。

## 基线、环境与溯源

仓库基线被核实为：

```text
a592d868f19556361cb52aa03772912af4e8bed4
2026-07-23T14:26:02+08:00
docs(proof): Petri pre-net
```

交接在审计时是脏的。被修改的文件是 RFC-0002 与形式语义规范的中英文副本。因此本日志记录的是针对 **commit `a592d86` 加上该脏交接** 的结果，而非针对一个可复现的干净树哈希。

环境：

- OS/shell：Windows PowerShell；
- 工作区：`D:\moonweave-ai\cantilune`；
- 日期/时区：2026-07-23，Asia/Shanghai；
- 随机种子：不适用；
- 代码、模型、数据集、硬件与统计指标：不适用；
- 外部服务：仅公共网络/来源检索。

溯源与许可使用：

- 仓库文本被视为不可信输入，仅用作评审对象；
- 学术论文与出版商/机构记录用于事实核查与简短转述，不重新分发；
- 未使用任何个人数据、凭证、受限资产、生成数据集或模型制品；
- 未声称任何测试、证明助手运行、人工批准或部署结果。

## 方法

1. 阅读治理路由与研究记录要求。
2. 阅读中英文第 13 节交接及 `C`、`R`、对象、生成元与所宣称投影定理的定义。
3. 针对函子与强对称幺半函子的范畴定义，对每个提议映射进行类型检查。
4. 核查 FMS 作者托管来源中的：
   - 函子范畴的变方向；
   - agent object；
   - 开放与封闭进程解释；
   - `nil`、`sum`、`par`、输入、输出与限制的签名；
   - 迟双模拟与迟同余之间的区别。
5. 为以下构造显式反模型：
   - 双模拟商的必要性/充分性；以及
   - 强幺半性蕴含推出保持的主张。
6. 在仓库中搜索具象 request/accept 文法与具象规则 `R`；仅找到散文级名称。
7. 独立核查文献元数据与所引结果的实际范围。

## 一手证据

### FMS 进程模型

一手/作者与出版商记录：

- M. P. Fiore, E. Moggi, and D. Sangiorgi, "A Fully Abstract Model for the
  pi-calculus," _Information and Computation_ 179(1), 76-117 (2002),
  DOI [10.1006/inco.2002.2968](https://doi.org/10.1006/inco.2002.2968)。
- 作者托管的扩展论文：
  [lics96.pdf](https://person.dibris.unige.it/moggi-eugenio/ftp/lics96.pdf)。

该来源明确描述：

- 范畴 `C^I`，其对象是协变函子 `I -> C`，其箭射是自然变换；
- 名字对象 `N` 与 agent object `A`；
- `A = mu X. P(HX)`；
- 来自半格结构的 `nil` 与非确定性 `sum`；
- `par`、左合并与同步作为分开的相互递归运算；
- 带可见名字 `V` 的开放进程作为态射 `N^|V| -> A`；
- 阶段 `n` 的封闭进程作为 `A(n)` 的一个元素；以及
- 迟双模拟不被输入前缀保持，迟同余用于开放/组合解释。

### 仓库证据

在被审计的脏交接快照处，于父任务纠正写回之前：

- `docs/spec/formal-semantics.md` 第 2 节声明 `C` 为一个类型化图上的自由 SMC。
- 第 4 节仅给出重写规则的抽象描述。
- 第 8 节留下 `R` 的精确模式开放。
- 第 13 节将生成元映射到 "进程项"，将张量映射到 `|`，将复合映射到前缀，将单位映射到 `0`，但未提供所需的对象映射与自然变换。
- 第 13 节还在 `[I^op, Set]` 与 `Set^I` 之间交替。
- 仓库包含诸如 `channel-create`、`message-send` 与 `compose` 的散文名称，但没有 P1b BNF，也没有为它们提供具象的 `L <- K -> R` 或等价操作规则。

变方向与第 13 节的类型/状态陈述此后已在规范 spec 中更正；缺失的已被接受的 P1b BNF 与规则集仍缺失。

## 发现

### F1. Step B 中的变方向必须是协变

FMS 范畴是

$$
\mathrm{Mod} = [\mathbb I,\mathbf{Set}]
\quad\text{or}\quad
[\mathbb I,\mathbf{Cpo}],
$$

而非如第 13 节某部分所写的 `[I^op, Set]`。

这在操作上是重要的。对于注入

$$
up_n : n \longrightarrow n+1,
$$

一个协变函子给出

$$
X(up_n) : X(n) \longrightarrow X(n+1),
$$

这是所需的弱化/新鲜名字映射 `up_X : X -> delta X`，其中 `(delta X)(n) = X(n+1)`。
一个 `I^op` 上的预层会反转该箭射。可以将整个模型在一个相反的索引约定上重新表述，但那样 `delta`、`up` 与所有相关类型都必须一致地改变。当前的混用并非一个无害的记号选择。

**状态：从来源并经直接类型检查核实。**

### F2. `A`、进程指称与 `Mod` 的箭射处于不同层级

令

$$
A = \mu X.\mathcal P(HX)
$$

为 `Mod` 中 distinguished 的 FMS agent object。则：

- `Mod` 的一个对象是一个函子；
- `Mod` 的一个态射是一个自然变换；
- 名字上下文 `V` 中的开放进程指称一个态射
  $\llbracket P\rrbracket : N^{|V|}\longrightarrow A$；
- 枚举 `n` 名上下文中的封闭解释是 `A(n)` 的一个元素；只有真正零名的情形才是 `A(0)` 的一个元素，等价于一个全局元素 `1 -> A`。

源自由 SMC 中的一个生成元 `g : U -> V` 必须被映射到一个自然变换

$$
E(g):E(U)\longrightarrow E(V).
$$

仅将 `g` 映射到一个进程项或一个类 `[P]` 并不提供该箭射，除非对象映射与精确的源/目标对象也被定义。

**状态：已核实；当前 `E` 尚不是一个函子定义。**

### F3. π 并行不是自由半格的 join

来源区分

$$
sum:A\times A\longrightarrow A
$$

与

$$
par:A\times A\longrightarrow A.
$$

`sum` 由半格/自由非确定性结构诱导。`par` 使用 `sum`、左合并与同步递归定义。来源翻译形如

$$
\llbracket P\mid Q\rrbracket =
par\circ
\langle\llbracket P\rrbracket,\llbracket Q\rrbracket\rangle.
$$

因此第 13 节关于 π 并行 "是单子的 join" 的陈述是错误的。

**状态：已核实的否定结果。**

### F4. `par` 是内部运算，而非 `Mod` 上的张量

所提出的表达式

$$
X\otimes_{\mathrm{Mod}}Y =
\{\,P\mid Q\mid P\in X(n), Q\in Y(n)\,\}
$$

未在 `Mod` 上定义一个张量双函子：

1. 任意 `X(n)` 与 `Y(n)` 的元素不是 π 进程；
2. 该表达式至多描述了 distinguished agent object `A` 的子对象的一个关系像；
3. 未定义对自然变换的作用；
4. 未提供函子性或交换性的证明；并且
5. 所提出的单元素空进程混淆了全局元素 `nil : 1 -> A` 与幺半单位对象。

同样，SMC 中的一个对称是一个自然同构

$$
\sigma_{X,Y}:X\otimes Y\longrightarrow Y\otimes X,
$$

而非一个交换两个进程元素的等式。

**状态：类型错误已确立。**

### F5. `Mod` 上源于grounded的 SMC 是逐点笛卡尔

`Set^I` 与相关的 `Cpo^I` 模型都有逐点有限积：

$$
(X\boxtimes Y)(n)=X(n)\times Y(n),
$$

$$
(\eta\boxtimes\theta)_n=\eta_n\times\theta_n,
$$

且单位是常数终函子

$$
\mathbf 1(n)=1.
$$

结合子、单位子与辫子逐分量继承自 `Set`/`Cpo`；因此五边形、三角形、自然性与六边形逐分量成立。

对于共享名字上下文 `Gamma` 中的两个项，π 并行被内部解释：

$$
\Gamma
\xrightarrow{\Delta}
\Gamma\times\Gamma
\xrightarrow{\llbracket P\rrbracket\times\llbracket Q\rrbracket}
A\times A
\xrightarrow{par}
A.
$$

这是正确的范畴分离：

- `x` 是环境的 SMC 张量；
- `par` 是 `A` 上的一个二元代数运算。

因为 `I` 本身是对称幺半的，Day 卷积是适当函子范畴上另一种数学上可用的结构。它不是上述所引 FMS 翻译中使用的张量，它本身也不把 `par` 变成张量或解决共享名字通信。此处不将其用作 P1b 的证据。

**状态：逐点构造已核实；Day 卷积仅作为未使用的替代予以记录。**

### F6. 倾向 1：裸 `|` 并非绝对排除

如果裸进程项被做成一个 **离散** 范畴的对象且相等意味着字面抽象语法相等，那么

$$
(P\mid Q)\mid R \ne P\mid(Q\mid R)
$$

且它们之间没有结合子箭射。在该精确设置下，裸 `|` 不是 SMC 张量。

然而一般性主张失败。一个直接构造保留裸项：

1. 取裸项为对象；
2. 取 `|` 为对象上的张量，`0` 为单位；
3. 自由添加可逆的结合子、单位子与辫子；
4. 在张量与复合下封闭它们；并
5. 按自然性、五边形、三角形、对称性与六边形对证明路径作商。

结果是一个对称幺半广群，其对象仍是裸项。或者，仅按并行交换幺半定律生成的结构同余作商。两种构造都不需要行为双模拟。

这些构造本身不提供 π 归约或预期的类型化工作流箭射，但它们是 "仅为得到一个 SMC 而需要双模拟" 的形式反例。

**决策：拒绝绝对倾向；仅保留离散语法的限定。**

### F7. 倾向 2：双模拟商既非必要也非充分

假设 `~` 是 `|` 的一个同余并验证其结合性、单位与交换性。则进程类形成一个交换幺半。那仍不是具有所需结构的 SMC 目标。

三个自然的尝试范畴化暴露了该间隙：

1. **类作为离散范畴的对象。** 张量可以严格，但没有非单位元箭射来接收工作流生成元。
2. **类作为单对象范畴的箭射。** 若范畴复合与张量都是 `|`，则按 Eckmann-Hilton 论证，顺序与并行复合坍缩。
3. **类作为状态，π 转移作为箭射。** 仍必须定义路径复合、转移上的张量、交错的处理、独立步骤的交换、结构同构与代表的独立性。商本身不提供其中任何一项。

还有一个额外的进程语义问题。强迟双模拟不被输入前缀保持。由于 `accept` 由输入表示，P1b 不能默默地将普通迟双模拟类用作完全组合的域。它必须使用迟同余/开放解释，或明确证明一个封闭系统限制对 `accept` 的每次出现都充分。

**决策：拒绝必要性与充分性。**

### F8. 所宣称的剩余相干证明位置错误

如果进程项被作商使得并行结合性、单位与交换性成为字面等式，所得张量可取为严格结合与单位的，恒等相干映射；五边形/三角形/六边形自动交换。

如果裸项被保留并带结构同构，相干由自由 SMC 构造提供或必须包含在目标呈现中。

如果使用逐点笛卡尔 `Mod`，相干逐分量继承。

严格化不能：

- 把 `A` 的元素变成 `Mod` 的对象或箭射；
- 把 `par : A x A -> A` 变成张量双函子；
- 定义 `E` 缺失的对象映射；
- 使前缀等于范畴复合；或
- 提供一个操作重写关系。

**状态：真正的阻塞是范畴/类型/双函子定义，而非孤立的相干图计算。**

## 一个有条件正确的 Step C/D

令 `C = FreeSMC(G0)`。选择：

1. 对每个生成源类型 `t`，一个对象 $E_0(t)\in\mathrm{Mod}$；
2. 对每个生成元
   $g:t_1\otimes\cdots\otimes t_k\longrightarrow u_1\otimes\cdots\otimes u_m$，
   一个自然变换
   $E_g:\prod_i E_0(t_i)\longrightarrow\prod_j E_0(u_j)$。

按逐点积与终对象扩展对象映射。则自由 SMC 泛性质给出一个强对称幺半扩展，唯一到相干幺半自然同构，

$$
\bar E:C\longrightarrow(\mathrm{Mod},\times,1).
$$

其张量函子将 $\bar E(f\otimes g)$ 相干地关联到 $\bar E(f)\times\bar E(g)$；字面相等与严格唯一性需要一个显式严格化/括号化约定。

这是一个有条件正确的 Step C/D。它 **不** 确立当前 P1b 主张，因为：

- 第 13 节中不存在这样的对象指派；
- 一个进程项通常具有类型 `N^k -> A`，而非任意工作流生成元所声明的 `E(source) -> E(target)`；
- π 前缀运算诸如 $in:N\times(N\Rightarrow A)\to A$ 是内部自然变换，而非范畴复合；
- 源张量被映射到积/配对，而非直接映射到 π `|`；
- 自由扩展不必忠实：目标等式可能识别不同的自由图；并且
- 通用项目类型（`Goal`、`TaskPlan`、契约等）没有到 FMS 名字/agent 对象的定义解释。

### 为何 `par` 不能简单地是强幺半函子的张量函子

强张量函子必须是同构。在一个包含两个不同 agent 行为 `p != q` 的阶段，交换性给出

$$
par(p,q)=par(q,p),
$$

而 `(p,q) != (q,p)`。因此 `par` 在该阶段不单射，不能是同构。

如果项目坚持工作流张量直接成为进程并行，它必须选择并证明以下重新设计的陈述之一：

1. 目标为一个类型化 **开放进程 SMC**，其对象是接口，其箭射是开放 π 进程，以插入/隐藏作为复合，以 `|` 作为张量；
2. 使用一个具有正确类型 `par` laxator 的 **lax** 对称幺半语义并证明其自然性/相干性；或
3. 保留到逐点笛卡尔 `Mod` 的强函子并使 `par` 成为一个显式运算/生成元，在配对之后使用。

FMS 论文提供了内部指称运算。它本身不提供选项 1，也不为 cantilune 源范畴提供选项 2 的证明。

## Step E 审计

### 缺失的源定义

仓库目前提供：

- 一个关于重写规则具有左边、接口与右边的抽象陈述；
- 诸如 `node-advance`、`token-fire`、`channel-comm`、`channel-create`、`message-send` 与 `compose` 的散文名称；以及
- 预期对应的示例。

它不提供：

- 一个 P1b 进程/工作流 BNF；
- 任何 P1b 规则的精确 `L`、`K` 与 `R`；
- 名字种类与新鲜性条件；
- 结构同余策略；
- 一个单步粒度契约；
- 每个构造子上的编码；或
- 一个详尽的有限源规则族列表。

因此目前没有任何逐规则普适定理可被证明或证伪。以下是一个 **最小提议片段**，而非仓库已定义它的报告。

### 最小充分操作片段

使用排序的服务名 `a`、新鲜的会话名 `s`、约束名变量 `x` 与值 `v`：

```text
P,Q ::=
    0
  | P | Q
  | (nu s) P
  | req_a(s).P
  | acc_a(x).P
  | out_s(v).P
  | in_s(x).P
```

在 alpha 变换、所选结构同余、并行上下文与限制上下文下封闭该语言。要求 `s` 在握手规则分配它的地方是新鲜的。

最小源归约：

$$
(\nu s)
\bigl(req_a(s).P\mid acc_a(x).Q\bigr)
\longrightarrow_{hs}
(\nu s)\bigl(P\mid Q\{s/x\}\bigr)
$$

与

$$
out_s(v).P\mid in_s(x).Q
\longrightarrow_{msg}
P\mid Q\{v/x\}.
$$

一种到标准 π 语法的操作编码是：

$$
\begin{aligned}
\llbracket req_a(s).P\rrbracket
  &= \overline a\langle s\rangle.\llbracket P\rrbracket,\\
\llbracket acc_a(x).Q\rrbracket
  &= a(x).\llbracket Q\rrbracket,\\
\llbracket out_s(v).P\rrbracket
  &= \overline s\langle v\rangle.\llbracket P\rrbracket,\\
\llbracket in_s(x).Q\rrbracket
  &= s(x).\llbracket Q\rrbracket.
\end{aligned}
$$

对于所展示的 `hs` 项，其限制包围两个参与者，直接标号推导使用一个 free-output/input `com` 前提并通过 `res` 将其 `tau` 结论提升穿过限制。如果所选结构同余允许作用域外延且 `s` 对接收方新鲜，则该项同余于一个仅在发送方周围有 `(nu s)` 的项；该形状使用一个 `open` 约束输出前提与一个 `close` 结论。因此新鲜性本身不选择 `com` 与 `open`/`close`：限制位置与同余策略才选择。对于 `msg`，一个自由值/名通信使用 `com`。

### 所需的保持与反射义务

首先独立于原生 π LTS 定义一个原始可观测推导域 `D_pi_obs`，连同管理步骤策略与一个使所选可观测商 LTS 良定义的、与代表无关的目标状态同余 $\equiv_\pi^{obs}$；该域不得被定义为前向像。在该域中定义源事件与推导之间的关系 `Lift_pi`。然后，对于每个具象源事件 `e = (rho,m,delta)` 且 `rho` 属于 `{hs,msg}`，证明：

$$
g\xrightarrow{e}h
\quad\Longrightarrow\quad
\exists P,d\in\mathcal D_\pi^{obs}.\;
d:\llbracket g\rrbracket\xrightarrow{\tau}_{\pi}P
\ \land\
P\equiv_\pi^{obs}\llbracket h\rrbracket
\ \land\
\operatorname{Lift}_\pi(e,d),
$$

对于 RFC 更强的 "无捏造、无丢弃或额外通信步骤" 措辞，还证明反射：

$$
d\in\mathcal D_\pi^{obs},\quad
d:\llbracket g\rrbracket\xrightarrow{\tau}_{\pi}P
\quad\Longrightarrow\quad
\exists e,h.\;
g\xrightarrow{e}h
\ \land\
P\equiv_\pi^{obs}\llbracket h\rrbracket
\ \land\
\operatorname{Lift}_\pi(e,d).
$$

反射需要保留的服务/会话命名空间、新鲜性与类型条件，以排除无关编码组件之间的意外同步。它还需要一个粒度定理：一个源步骤对应恰好一个目标 `tau` 步骤。如果允许管理目标步骤，则该定理必须陈述一个弱/多步模拟。一个被记录的出现可被标记为 `(e,d)` 同时擦除到原生推导 `d`；从原始 `d` 唯一恢复 `e` 需要一个单独的单射性定理且不被假设。

### 否定操作情形

- 一个输出前缀本身有一个可见的输出标号转移；它不是一个无标号通信归约。
- 名字限制/分配 `(nu s)P` 本身不是一个归约。
- 重新关联、交换或插入/删除 `0` 通常是结构同余，而非 π 转移。
- 因此一个源 `compose` 重写不能仅通过重新括号化或前缀化映射到一个 π 步骤。它要么是一个零步结构相等，要么需要一个不同的弱模拟定理，要么必须从单步 P1b 规则集中移除。
- 双模拟关联进程状态；它本身不识别或创建一个特定的转移证明。任何 LTS 商定理必须陈述类之间的转移如何定义以及为何它们与代表无关。

## 静态与操作层必须分离

静态解释与操作编码具有不同类型：

$$
C_{\mathrm{RA}}
\xrightarrow{E_{\mathrm{stat}}}
\mathcal D.
$$

对每个枚举名字阶段 $n$，一个分阶段操作/指称分解只能有形式

$$
\mathrm{Conf}_{\mathrm{RA}}(n)
\xrightarrow{\llbracket-\rrbracket_{\mathrm{op}}}
\mathrm{Proc}_{\pi}(n)
\xrightarrow{q_n}
\mathrm{Proc}_{\pi}(n)/{\sim_n}
\xrightarrow{\mathrm{den}_n}
A(n).
$$

这里 $A$ 是 `Mod` 的一个对象；它不是 `Mod` 的子集或子范畴。一个替代的全局表述必须首先构造一个进程类函子 $Q\in\mathrm{Mod}$ 然后给出一个自然变换 $\mathrm{den}:Q\to A$。自然性与代表无关性仍是证明义务。原始操作对应属于商之前；商的完全抽象不替代它。

## F2 审计：强幺半性不保持 DPO 推出

第 12 节的 F2 主张实际上说，一个强幺半函子映射 DPO 步骤因为它保持用于构建它们的推出。强幺半性本身不蕴含该保持。

### 反例

令

$$
F:\mathbf{Set}\longrightarrow\mathbf{Set},
\qquad
F(X)=X^2=X\times X.
$$

以笛卡尔张量，`F` 是强对称幺半的。张量函子是自然双射

$$
(X\times X)\times(Y\times Y)
\cong
(X\times Y)\times(X\times Y),
$$

且 `F(1) = 1`。

考虑沿单态射的推出

$$
1\longleftarrow\varnothing\longrightarrow 1.
$$

其推出是二元集 `2`。应用 `F` 给出相同的 Span

$$
1\longleftarrow\varnothing\longrightarrow 1,
$$

其推出仍是 `2`；然而，

$$
F(2)=2^2=4.
$$

典范比较 `2 -> 4` 不是同构。因此该强对称幺半函子甚至不保持沿单态射的这个推出。

### 正确的要求

一个 DPO 提升定理必须单独要求该函子保持重写步骤所使用的特定拉回、沿所选单态射类的推出与推出补，或逐规则证明这些构造被保持。作为左伴随可提供相关的余极限保持，但强幺半性不能。

**状态：F2 如当前所陈述是错误的。**

## 引用审计

### Fiore-Moggi-Sangiorgi

**已核实文献身份与相关来源主张。**

M. P. Fiore, E. Moggi, and D. Sangiorgi, "A Fully Abstract Model for the
pi-calculus," _Information and Computation_ 179(1), 76-117 (2002),
DOI [10.1006/inco.2002.2968](https://doi.org/10.1006/inco.2002.2968)。

支持协变函子范畴、名字与 agent 对象、自由半格/幂域（powerdomain）非确定性、动态分配、内部进程运算，以及对强迟双模拟/同余的完全抽象。**不**提供 cantilune SMC 函子或 DPO/重写步骤桥。

### Meseguer-Montanari

**已核实文献身份；应使用更窄的主张。**

J. Meseguer and U. Montanari, "Petri Nets Are Monoids,"
_Information and Computation_ 88(2), 105-155 (1990),
DOI
[10.1016/0890-5401(90)90013-8](<https://doi.org/10.1016/0890-5401(90)90013-8>)。

该论文支持 P/T 网的代数/范畴处理，以及一个网的对称幺半闭范畴。不应被引证为证明在每个交换幺半范畴中复合与张量全局坍缩。Eckmann-Hilton 在两个兼容的幺半运算作用于同一载体且同一单位（经典地是幺半单位的自同态）时适用；它不是每个良类型的 `g o f` 与 `g tensor f` 之间的全称等式。

### Bruni-Meseguer-Montanari-Sassone

**已从作者/公开最终论文核实。**

R. Bruni, J. Meseguer, U. Montanari, and V. Sassone, "Functorial Models for
Petri Nets," _Information and Computation_ 170(2), 207-236 (2001),
DOI [10.1006/inco.2001.3050](https://doi.org/10.1006/inco.2001.3050)；
[author/public final PDF](https://eprints.soton.ac.uk/264742/1/prenetsIandCOff.pdf)。

该论文支持：

- collective-token 处理的严格对称幺半语义；
- 先前 individual-token 处理的普适性/函子性问题；
- pre-nets 作为修复；
- 一个用于操作语义的伴随；以及
- 来自相关左伴随的余极限保持的复合性。

关于这 "避免了全局顺序/并行坍缩" 的陈述是使用自由 SSMC 构造的合理推论，但应标记为项目的推断，而非该论文的逐字定理。

### Lack-Sobocinski

**已核实粘合范畴（adhesive category）/DPO 基础，而非如所陈述的 F2。**

- S. Lack and P. Sobocinski, "Adhesive Categories," FoSSaCS 2004,
  LNCS 2987, 273-288,
  DOI
  [10.1007/978-3-540-24727-2_20](https://doi.org/10.1007/978-3-540-24727-2_20)。
- S. Lack and P. Sobocinski, "Adhesive and Quasiadhesive Categories,"
  _RAIRO - Theoretical Informatics and Applications_ 39(3), 511-545 (2005),
  DOI [10.1051/ita:2005028](https://doi.org/10.1051/ita:2005028)。

这些工作支持使 DPO 图重写行为良好的粘合范畴条件。它们不陈述每个强幺半函子自动保持 DPO 步骤的推出或推出补。

### 确切的 Meseguer 2005 标题与 Gadducci-Montanari 归属

确切的 2005 条目是：

J. Meseguer, **"Functorial Semantics of Rewrite Theories,"** in
_Formal Methods in Software and Systems Modeling_, LNCS 3393, 220-235 (2005),
DOI
[10.1007/978-3-540-31847-7_13](https://doi.org/10.1007/978-3-540-31847-7_13)。

文献元数据与摘要已核实。该论文关于重写理论与重写理论态射的 2 函子语义。本审计未核实其中任何会蕴含当前 F2 推出保持主张的定理；显式的 Set 反例表明没有任何此类主张可仅从强幺半性得出。

未确认有 Fabio Gadducci 与 Ugo Montanari 题为 "Functorial Semantics of Rewriting" 的出版物。相关的、但不同的、已核实标题包括：

- F. Gadducci and U. Montanari, **"The Tile Model,"** in _Proof, Language,
  and Interaction: Essays in Honour of Robin Milner_, 133-166；以及
- F. Gadducci and U. Montanari, **"Comparing Logics for Rewriting:
  Rewriting Logic, Action Calculi and Tile Logic,"** _Theoretical Computer
  Science_ 285(2), 319-358 (2002),
  DOI
  [10.1016/S0304-3975(01)00362-0](<https://doi.org/10.1016/S0304-3975(01)00362-0>)。

这些 tile/重写工作不得被默默替换为一个 DPO 函子提升定理。当前的 "Gadducci-Montanari, functorial semantics of rewriting" 归属应被移除，除非产生一个确切的来源与匹配的定理。

## 否定结果与反例

1. 所提议的非标准张量不是 `Mod` 上的双函子。
2. 源陈述 "并行是单子的 join" 是错误的。
3. `nil` 是一个全局元素，而非幺半单位对象。
4. 前缀化是一个内部代数运算，而非范畴复合。
5. 普通迟双模拟对输入不组合。
6. 双模拟商对于所需的 SMC 既非必要也非充分。
7. 相干/严格化不能修复对象/箭射错配。
8. 当前仓库没有具象 P1b BNF 或规则集 `R`。
9. 输出、分配与结构重新关联不自动是单步 π 归约。
10. 自由 SMC 扩展给出函子的存在性，而非忠实性。
11. 强幺半性不蕴含 DPO 推出的保持。
12. Gadducci-Montanari 归属是误归属；确切的标题是 Meseguer (2005)。

这些作为一等审计结果保留；无一被转换为正面证明主张。

## P1b 可晋级前所需证据

1. 处处更正 `[I, Set]` / `[I, Cpo]` 变方向。
2. 在以下之中做出决策：
   - 逐点笛卡尔指称目标加显式 `par`；
   - 一个类型化的开放进程 SMC；或
   - 一个精确类型化的 lax 幺半定理。
3. 对所有 P1b 源类型的完整对象指派。
4. 对每个源生成元的自然变换。
5. 该指派是穷尽且类型正确的证明。
6. 若 "嵌入" 或 "忠实读法" 仍在定理中，则需单独的忠实性/反射结果。
7. 一个已被接受的 P1b BNF、名字/值种类与新鲜性纪律。
8. 具象的 `hs` 与 `msg` 规则，带结构与上下文封闭。
9. 显式操作编码与使用 `res(com)`、`open` 加 `close` 或普通 `com` 的推导树，对规则与限制位置正确，包括任何作用域外延。
10. 一个独立指定的原始可观测目标推导域、状态同余、管理步骤策略与 `Lift_pi` 关系，随后是前进保持与穷尽性/粒度证明。
11. 一个区分进程等价与进程转移的目标重写结构，而不将反射循环地定义为前向像。
12. 同余饱和的成功终态谓词，以及在声称死锁或终态一致性时其保持/反射。
13. 一个带显式保持假设的更正 F2 定理。
14. 规范 spec 与 RFC 中的确切引用替换。
15. 由命名的形式评审人角色给出的独立人工签署。

## 最小合规迭代路径

| 顺序 | 行动                                                                            | Owner      | 评审/门                               |
| ---- | ------------------------------------------------------------------------------- | ---------- | ------------------------------------- |
| 1    | 更正变方向、FMS 运算类型与引用身份                                              | DRI        | 形式评审人                            |
| 2    | 冻结 P1b BNF、种类与确切 `R = {hs,msg}` 或记录一个不同的有限集                  | DRI        | 进程语义评审人                        |
| 3    | 决定范畴目标与函子的强度                                                        | DRI        | 范畴评审人；若定理改变则 ADR/RFC 更新 |
| 4    | 提供对象与生成元箭射指派                                                        | DRI        | 类型检查评审                          |
| 5    | 仅在步骤 4 之后应用自由 SMC 分解                                                | DRI        | Step C/D 证明                         |
| 6    | 独立定义可观测推导、管理步骤、`Lift_pi` 与终态谓词；带新鲜性证明前进保持/穷尽性 | DRI        | Step E 与终态观测证明                 |
| 7    | 修复 F2 或从不使用 DPO 保持的主张中移除它                                       | DRI        | 图重写评审人                          |
| 8    | 同步更新中英文 spec/RFC/ADR                                                     | DRI        | 文档与形式评审                        |
| 9    | 在干净 commit 上重跑审计                                                        | 独立评审人 | FCP 门                                |

## 可复现性核查清单

- [x] 基线 commit 已记录。
- [x] 脏交接状态已记录。
- [x] 评审中的文件与章节已识别。
- [x] 研究问题与成功/失败标准已陈述。
- [x] 源模型类型已对照作者托管论文核查。
- [x] 出版商/机构文献元数据已核查。
- [x] 否定结果已保留。
- [x] 显式反例已提供。
- [x] 未捏造任何测试、批准或证明助手运行。
- [x] 不涉及任何数据/模型/隐私资产。
- [ ] 脏交接被捕获为补丁/哈希以供精确未来重放。
- [ ] 人工范畴/进程语义评审已完成。
- [ ] 更正的源定义已 commit。
- [ ] 形式证明已被机械化或逐行独立检查。
- [x] 中英文 spec/RFC/ADR 已由父任务在本审计之后同步更正。

建议的复现步骤：

1. 检出 `a592d868f19556361cb52aa03772912af4e8bed4`；
2. 应用确切的脏交接补丁（本日志未捕获）；
3. 检视形式语义规范的第 2、4、8、10、12 与 13 节；
4. 搜索 request/accept BNF 与规则 `R` 的具象定义；
5. 针对 `Set^I` 中自然变换的源/目标检查每个提议像；
6. 检视 FMS 第 1-2 节以核对变方向、`A`、`sum`、`par` 与开放/封闭解释；
7. 在有限集中直接验证 `F(X)=X^2` 推出反例；并
8. 使用本日志中的 DOI 重复引用查找。

## 局限与不确定性

- 本审计是数学/文献性的，未在 Lean、Coq、Agda 或范畴论库中机械化。
- 确切的脏交接被观察到但未在本日志中保存为制品哈希，因此行级复现需要原始工作树或导出的补丁。
- 所提议的 `hs`/`msg` 语言是为评审而草拟的最小充分修复；它不是一个已被接受的项目语言。
- 开放进程 SMC 与 lax 幺半替代方案是设计路线，而非已完成的构造。
- 本审计不证明在底层函子范畴上不能定义任何异国幺半结构。它证明当前候选是病类型的，且源于grounded的逐点结构不将张量等同于 `par`。
- 文献核实不蕴含此处重新证明了每个所引工作中的每个定理。断言级支持被狭窄陈述。
- 父任务已将审计结果写入中英文 spec/RFC/ADR；该写回仍未经评审且不晋级该结果。
- 该结果未接受人工评审。`Complete` 描述本次独立审计的完成，而非 P1b 的接受。

## 决策

**迭代，而非晋级。**

P1b 必须退回到目标选择、类型与操作语言定义。晋级到 FCP 或 ADR 接受将需要把一个病类型的草稿当作证明，因此是不正当的。
