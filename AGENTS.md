## Learned User Preferences

- 偏好简体中文回复（非双语）
- 偏好逐步协作设计，而非代理单独完成全部读写
- 图表与文档侧重 agent orchestration 工程语义，避免数学符号与 Lean 细节
- 每张 PlantUML 图范围要窄；首张图聚焦 CoordinationEvent 与 Actor（发起方）
- 类图中每个字段须在类体内 inline 注释（含义与作用），并附具体案例赋值；不要用外部 note 延伸成独立板块
- 要展示字段/类级关系，不只是包块之间的粗粒度关系
- 修布局时须保留分区框、图例、案例示例；状态/时序图用列式网格、分区配色、语义线型（主脊/Obs 回环/Event 重入），跨列边最小化；时序/状态图须通用化（多轮、多分支、占位符，避免具体案例名与固定 ID）
- 测试与生产分离：`src/` 零测试；每包 `tests/` 按 L2–L7 分层，不用仓库级 `qa/`
- 状态图须列齐类图全部字段及案例赋值；层级用 `\t` 缩进，同级块间空描述行（PlantUML 会剥空格）
- 同系列衍生图放在 `diagrams/01-core/`，短名后缀：`01a-class`、`01b-seq`、`01c-state`、`01d-fields`
- 工程设计阶段要脚踏实地的接口/命名/关系规范（core 同概念合并单文件，避免 kebab 拆分与 ids/kind 重叠），不是数学原理复述
- 代码目标为 LangChain/LangGraph 级可发布框架（非纯理论）；TS 为主；模块间隔离与 core 三柱 `nodes`·`coordination`·`structure`（组合代数原子）；Agent 运行时自行组合结构（非预画死图），静态 wiring 仅 derive 派生

## Learned Workspace Facts

- Cantilune 是 agent 编排项目；`diagrams/01-core/` 与 `00-naming-contract.md` 为当前工程设计载体
- 活跃图 01 四视图：`diagrams/01-core/` 下 01A 类图 · 01B 时序 · 01C 状态 · 01D 字段（`01a-class.puml` 等）；`02-core-domain.puml` 暂缓
- 图 01 核心：CollaborationSnapshot + CoordinationEvent + Actor 双视图（Registration 常驻世界、Ref 事件引用）+ 外部边界（ObservationEntry）
- Trigger ≠ CoordinationEvent；Actor 不直接 emit Event；外部输入经 ObservationEntry/Command → Runtime admission → Event
- CoordinationEvent 无 payload；任务正文在 WorkArtifact；Event 需 beforeRef/afterRef 供 replay
- `00-naming-contract.md` 为 diagrams 命名单一来源；形式化映射附录 A；锚点含技术报告第 3 章、`formal/Cantilune/Core/`、`docs/spec/zh-CN/formal-semantics.zh-CN.md`
- 本地 PlantUML 预览需 Java；无 JVM 时可用 PlantUML 在线服务器渲染
- PlantUML @startyaml 本地插件触发 UnsupportedOperationException；01D 改用类图语法专述字段，01A 展示关系全貌
- `@cantilune/core` 已落地于 `src/packages/core/`（三柱纯类型+纯函数）；pnpm monorepo 根 `src/packages/`；命名统一 `CoordinationChange`
- 单包测试：`tests/{types,unit,integration,contract,system,support}` 对应 L2–L7 金字塔；L1 在仓库根工具链；闭包与 OPEN 项见 `tests/DESIGN-CLOSURE.md`
- `ObservationEntry` 为单条外部观察；`auditTail` 为 Snapshot 上 append-only 有序列表（≠ Change）
- core 第二柱为组合代数原子（Port/Wire/Footprint/disjoint/trace）；局部并行不串台靠 footprint 不交判定
