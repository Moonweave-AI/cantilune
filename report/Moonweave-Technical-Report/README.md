# Moonweave Technical Report

面向 Moonweave-AI 项目的模块化中英双语 LaTeX 技术报告系统。它不是一张“好看的封面”，
而是一套从文档控制、实验方法、评测、安全治理、局限到发布决策的证据链。

The package is self-contained: fonts, plot data, editable TikZ/PGFPlots sources,
references, build scripts, style guidance, and a compiled sample are included.

## Quick start / 快速开始

Requirements: XeLaTeX, BibTeX, `latexmk`, and a reasonably complete TeX Live
installation. No shell escape, Python plotting step, or system CJK font is required.

```bash
make
```

The PDF is written to:

```text
build/moonweave-technical-report.pdf
```

Run the full quality gate:

```bash
make qa
```

On Overleaf, upload the directory, set the compiler to **XeLaTeX**, and use
`main.tex` as the main document.

## Customize / 定制顺序

1. Edit `metadata.tex`.
2. Replace the content in `chapters/` while preserving the evidence categories
   applicable to the project.
3. Replace illustrative CSV files in `data/`.
4. Edit figures in `components/`; keep the source beside the report.
5. Read `docs/CUSTOMIZATION.md` and run `make qa`.

## Structure / 目录结构

```text
.
├── main.tex                     document assembly
├── moonweave-report.cls         reusable class and components
├── metadata.tex                 project-specific values
├── config/                      brand colors, fonts, strings, field schema
├── chapters/                    one concern per source file
├── components/                  cover, diagrams, charts, callout patterns
├── data/                        chart data
├── assets/                      bundled fonts and brand guidance
├── docs/                        design rationale and quality guides
├── examples/                    minimal starter
├── scripts/                     reproducible build and validation
└── build/                       compiled sample
```

## Design position / 设计立场

- Moonweave visual thesis: **cinematic moonlit research lab + editorial research
  magazine**.
- Dark lunar cover; quiet mist-white body.
- Editorial serif display, readable sans body, mono metadata.
- Low-chroma scientific colors; bright accents stay on the dark cover.
- No vertical table rules; no color-only status; no chart without a data/source note.
- A report is a versioned evidence asset, not an unowned narrative snapshot.

See `docs/ANALYSIS_NOTES.md` for the source-study matrix and
`docs/STYLE_GUIDE.md` for exact tokens.

## Licensing

Template source is MIT licensed. Bundled fonts retain their upstream licenses;
see `assets/fonts/LICENSES.md`. Official Moonweave trademarks and project marks
are not granted by the template license.

