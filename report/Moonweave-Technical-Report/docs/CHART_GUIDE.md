# Scientific chart guide / 科研图表规范

## Encoding order

1. Decide the analytical question.
2. Choose position/length before area or color.
3. Use color to group, not to rescue a weak chart.
4. Add a second encoding for categorical comparisons.
5. State data, metric, sample, uncertainty, and direction in the caption.

## Recommended forms

| Question | Form | Included example |
|---|---|---|
| Change over steps/time | line + interval band | `training-curves.tex` |
| Compare a few categories | grouped bar, common zero | `benchmark-bars.tex` |
| Show trade-off/frontier | labeled scatter | `pareto-scatter.tex` |
| Explain system topology | layered node-link diagram | `architecture-diagram.tex` |
| Prioritize residual risk | matrix + shaped markers | `risk-matrix.tex` |
| Show gated sequence | timeline with gate shapes | `release-timeline.tex` |

## Rules

- Do not use rainbow or red–green opposition as the sole encoding.
- Sequential data uses a lightness-ordered perceptual map.
- Diverging data has a meaningful center.
- Bars normally start at zero; if not, explain why.
- Show uncertainty where sampling or seed variation exists.
- Avoid 3D perspective, dual axes, decorative shadows, and dense legends.
- Prefer direct labels; otherwise keep legends close to the plot.
- Keep grid lines lighter than data.
- Every plot source remains editable and every dataset is versioned.

The examples use PGFPlots/TikZ so vectors, text, and source data remain in the
LaTeX project. External plots are acceptable when the generation script,
environment, and data revision are committed beside the export.

