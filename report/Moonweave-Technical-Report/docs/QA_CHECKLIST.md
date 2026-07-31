# Publication QA / 发布质量检查

## Automated

Run:

```bash
make qa
```

The validator checks:

- XeLaTeX/BibTeX build success;
- missing references/citations;
- missing glyphs;
- material overfull boxes;
- PDF page count;
- font embedding;
- extractable English and Chinese text.

## Visual

- [ ] Inspect the cover at full page and thumbnail scale.
- [ ] Inspect every chapter opening and page break.
- [ ] Inspect all tables for clipping, stranded headings, and tiny type.
- [ ] Inspect all plots for labels, ranges, uncertainty, legend proximity, and source note.
- [ ] Inspect all diagrams in grayscale.
- [ ] Confirm figures do not float beyond the section that interprets them.
- [ ] Confirm the final page and bibliography are intentional.
- [ ] Confirm PDF metadata, bookmarks, and link targets.

## Evidence

- [ ] Material claims link to a source revision.
- [ ] Metrics name baseline, direction, population, and uncertainty.
- [ ] Negative/null results are retained.
- [ ] Limitations and out-of-scope uses are explicit.
- [ ] Security/safety/privacy review is applicable and complete.
- [ ] Release decision, open risks, owners, and approvals are recorded.
- [ ] Rollback is rehearsed and independent from the model-mediated path.

