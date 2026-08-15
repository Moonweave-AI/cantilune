# RFC-0003：产品符合性 —— 证据、证书与发布门禁

| 字段                | 值                                                                                                                                           |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| 状态                | **草案**（pre-FCP）                                                                                                                          |
| 类型                | 架构 / 治理                                                                                                                                  |
| 风险                | 用于 control-plane 激活或产品发布时为 S4；起草阶段为 S2                                                                                      |
| 提案人 / 决策负责人 | Joker-of-Gotham（DRI）                                                                                                                       |
| 必需评审人          | 形式数学、进程语义、安全/威胁建模、QA-L5（均 **待定 / review-pending**；DRI interim 兼任，COI 见 `docs/governance/reviewer-assignments.md`） |
| 创建日期            | 2026-08-11                                                                                                                                   |
| 相关                | RFC-0001 §8、RFC-0002 §7.1、ADR-0009、ADR-0010、`@cantilune/conformance`                                                                     |

> **治理说明：** 本文件为 RFC-0003 的简体中文导读。**规范英文正文**以 [`docs/rfc/0003-product-conformance.md`](../0003-product-conformance.md) 为唯一权威来源。本 stub 不宣称 QA-L5 完成或生产发布权限。

---

## 摘要（导读）

`@cantilune/conformance` 是 Cantilune 的**产品证据验证与发布门禁**模块。它通过 **C0–C9 证书链**回答五个彼此独立的符合性问题，按 **profile 矩阵**选择验证等级，并输出可供 control-plane / 发布流程消费的**密封 `VerificationDecision`**。

**核心理论（Lean）与产品符合性（TS）分离：** 内核 `proved` 不等于产品 `verified`、人类 `reviewed` 或 `released`。

## 关键概念（与英文 RFC 对齐）

| 主题         | 要点                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------- |
| 五个问题     | 来源 / 重放 / 四投影 / 跨 epoch / 信任链                                                        |
| C0–C9        | 策略锚点 → 来源 → 清单 → 重放 → 工程准入 → 形式四投影 → 跨 epoch → Lean 证明 → 机器 → 人类+发布 |
| Profile      | `engineeringAdmission`（control-plane）vs `fourProjection` 等（产品发布）                       |
| Claim scope  | `generic` / `reference` / `product`（M2 默认禁止 product）                                      |
| 工程 vs 形式 | `EngineeringAdmissionEvidence` ≠ `FormalFourProjectionCertificate`                              |
| Eval handoff | 基准评测.harness 属 RFC-0001 §8 独立 ADR，非本 RFC 范围                                         |

## 当前状态

- 实现：M1–M2 原型
- 治理：RFC-0003 Draft；ADR-0009 / ADR-0010 Accepted（工程范围，外部评审 pending）
- QA-L5：`docs/qa/conformance-l5-review-checklist.md` — **review-pending**

## 下一步

完整条款、Stop-Ship 条件与 FCP 入口要求见英文正文 §6–§14。
