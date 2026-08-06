## Learned User Preferences

- 偏好简体中文回复（非双语）
- 偏好逐步协作设计，而非代理单独完成全部读写
- 图表与文档侧重 agent orchestration 工程语义，避免数学符号与 Lean 细节
- 每张 PlantUML 图范围要窄；首张图聚焦 CoordinationEvent 与 Actor（发起方）
- 类图中每个字段须在类体内 inline 注释（含义与作用），不要用外部 note 延伸成独立板块
- 要展示字段/类级关系，不只是包块之间的粗粒度关系
- 修布局时须保留分区框、图例、案例示例等结构元素
- 工程设计阶段要脚踏实地的接口/命名/关系规范，不是数学原理复述

## Learned Workspace Facts

- Cantilune 是 agent 编排项目；`diagrams/` 与 `00-naming-contract.md` 为当前工程设计载体
- 活跃图：`01-coordination-event-and-actor.puml`；`02-core-domain.puml` 暂缓
- 图 01 核心：CollaborationSnapshot + CoordinationEvent + Actor 双视图（Registration 常驻世界、Ref 事件引用）+ 外部边界（ObservationEntry）
- Trigger ≠ CoordinationEvent；Actor 不直接 emit Event；外部输入经 ObservationEntry/Command → Runtime admission → Event
- CoordinationEvent 无 payload；任务正文在 WorkArtifact；Event 需 beforeRef/afterRef 供 replay
- `00-naming-contract.md` 为 diagrams 命名单一来源；形式化映射在附录 A（Lean/数学）
- 形式化锚点：技术报告第 3 章、`formal/Cantilune/Core/`、`docs/spec/zh-CN/formal-semantics.zh-CN.md`
- 本地 PlantUML 预览需 Java；无 JVM 时可用 PlantUML 在线服务器渲染
- PlantUML YAML（@startyaml）在本环境触发 UnsupportedOperationException；图 01 使用类图语法
