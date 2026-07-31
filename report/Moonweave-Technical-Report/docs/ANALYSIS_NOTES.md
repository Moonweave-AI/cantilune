# Design synthesis record / 设计综合记录

This file records the source study behind the template. It is a synthesis, not a
copy of any supplied report.

## Supplied technical reports

| Source file | Pages | Typographic/visual signal | Structural strength adopted |
|---|---:|---|---|
| `Opus-5(1).pdf` | 193 | Lora body, Poppins headings, wide margins, restrained monochrome with occasional bright charts | system-card clarity; executive summary; deep safety/capability appendices |
| `gpt-5-6(1).pdf` | 81 | Source Serif 4, OpenAI Sans, light-gray section numbers, muted blue/green/pink charts | model data/training → safety/robustness → prepared safeguards |
| `GLM_tech_report(1).pdf` | 40 | dense single-column academic layout, Times-like body, strong blue model accent | pretraining, post-training, agentic engineering, chip infrastructure, evaluation |
| `deepseek_tech_report(1).pdf` | 58 | A4, Palatino-like body, minimal black with soft-gold architecture figures | architecture, infrastructure, training, evaluation, limitations/future work |
| `k3_tech_report(1).pdf` | 47 | compact Times-like typography, running header, blue highlights, pastel architecture | architecture, training, infrastructure, evaluation, case studies, contributions |

### Synthesis decisions

- Use the legibility and restraint common to all five, not their brand identities.
- Keep one-column narrative flow; place dense detail in tables and appendices.
- Combine model-report rigor with governance fields absent from many academic papers.
- Preserve explicit limitations, contribution roles, evaluation details, and reproducibility.
- Avoid copying covers, figures, prose, or proprietary marks.

## Moonweave-AI repository inventory

Seven public repositories were discovered and reviewed on 2026-07-28:

1. `Moonweave-AI/virea`
2. `Moonweave-AI/cantilune`
3. `Moonweave-AI/moonweave-ai-agent-schema`
4. `Moonweave-AI/awesome-list`
5. `Moonweave-AI/governance`
6. `Moonweave-AI/axiolune`
7. `Moonweave-AI/moonweave-ai.github.io`

The website repository is the visual authority:

- visual thesis: **Cinematic Moonlit Research Lab + Editorial Research Magazine**;
- display serif, readable sans body, code-oriented mono metadata;
- dark lunar black/indigo/moon-milk/lilac/cyan/blush/mint;
- light mist/pearl/ink navy/soft lilac/cyan/pale rose;
- target WCAG 2.2 AA;
- explicit rejection of generic purple-blue SaaS gradients.

Project assets added supporting motifs:

- Cantilune: nested crescents/orbits, thin horizontal structure, colored nodes;
- Axiolune: braided cyan/lilac/mint loops with an ivory center;
- Agent schema: woven graph threads and ontology nodes.

The template abstracts those motifs into an original TikZ lunar-thread mark and
editable diagrams. Official binary logos and banners are not bundled.

The governance repository influenced the evidence model:

- documentation as a single source of truth;
- owner, status, version, review date/cycle;
- code/data/model/config/hardware/seed provenance;
- negative results and limitations;
- evaluation baselines, security tests, human review, and Pass/Conditional/Fail;
- release readiness, accepted risk, Go/No-Go/Conditional Go, and approvals;
- diagram source beside export; plot source beside data.

## Internet research applied

- Fontspec for OpenType and Unicode under XeLaTeX.
- Microtype for restrained protrusion/spacing.
- TikZ/PGFPlots for vector, source-controlled figures.
- Booktabs for publication-quality tables.
- WCAG 2.2 for text and non-text contrast.
- ColorBrewer and Fabio Crameri for perceptual/color-vision-aware mapping.
- MoMA's Morandi collection record as a primary visual reference; no invented
  “official Morandi hex palette.”

See `REFERENCES.md` for links.

