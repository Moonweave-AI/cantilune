# Moonweave report style guide / 技术报告视觉规范

## 1. Visual thesis / 视觉命题

**Cinematic Moonlit Research Lab + Editorial Research Magazine**

封面是“月夜实验室”：深月黑、靛蓝表面、青色丝线、淡紫光晕、薄荷节点。正文是“研究刊物”：
雾白纸张、海军墨色、低饱和图表、细线分隔和稳定留白。避免通用 SaaS 式紫蓝渐变、
满页卡片、荧光大段正文和装饰性网格滥用。

## 2. Color tokens / 配色令牌

### Body

| Token | Hex | Use |
|---|---:|---|
| `MWPaper` | `#FFFFFF` | page |
| `MWMist` | `#F7FCFF` | quiet surface |
| `MWPearl` | `#EBF2FE` | stronger surface |
| `MWInk` | `#070F2A` | body text, axes |
| `MWMuted` | `#424C69` | secondary text |
| `MWSoftText` | `#586280` | captions/metadata |
| `MWLine` | `#CAD5EA` | rules and grids |

### Scientific categorical palette

| Token | Hex | Character |
|---|---:|---|
| `MWCyan` | `#48798A` | cyan slate |
| `MWLilac` | `#766892` | moon lilac |
| `MWBlush` | `#9C667B` | dust blush |
| `MWMint` | `#5F806D` | quiet mint |
| `MWAmber` | `#9B7653` | muted amber |
| `MWSlate` | `#5F687C` | neutral slate |

The palette is Morandi-like in discipline—low chroma, relational, and sensitive
to light—not a claim that Morandi has one official list of hex values.

### Cover-only accents

`#66EEFF`, `#CCBBFF`, `#92F0AD`, and `#FFC3E7` are large-graphic accents on
`#05071A`. Do not use them for small text on light pages.

## 3. Typography / 字体

- Body / 正文: **LXGW Neo XiHei**, covering Latin and CJK in one stable family.
- Display / 标题: **LXGW Neo ZhiSong**, editorial serif/mincho.
- Metadata and code / 元数据与代码: **Liberation Mono**.
- Optional Latin-only: Noto Sans and Noto Serif.

The class uses 11 pt body text, 26 pt chapter titles, 1.075 line spacing, zero
paragraph indent, and restrained paragraph spacing. Avoid manual line breaks in
running prose.

## 4. Page architecture / 页面结构

- A4, 27 mm left / 23 mm right, 25 mm top/bottom.
- Chapter opening: small mono number, editorial title, thin rule.
- Running header: organization/project left; chapter right.
- Footer: version left; page/total right.
- Captions are left aligned and include a source note.

## 5. Components / 组件

Use:

- `MWAbstractBox` for the two abstracts only.
- `MWInsight`, `MWDecision`, and `MWRisk` for decision-relevant interpretation.
- `MWMetricGrid` + `MWMetricCard` for three to six headline metrics.
- `MWCodeBox` for short reproducible commands or typed interfaces.

Callout boxes are punctuation, not layout. A page full of boxes destroys hierarchy.

## 6. Accessibility / 可访问性

- Body and muted text exceed WCAG 2.2 AA contrast on the body surfaces.
- Accent colors are not used as small body text.
- Every categorical series adds marker, dash, pattern, direct label, or position.
- Decision words—Pass, Conditional, Fail—remain written as text.
- Provide prose interpretation for every decision-relevant figure.

