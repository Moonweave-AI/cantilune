# Customization / 定制指南

## Project identity

Edit only `metadata.tex` first. Do not duplicate metadata strings inside chapters.
The cover, running header, PDF metadata, and document-control page read from the
same commands.

## Colors

Change semantic aliases in `config/brand-colors.tex` only after a contrast and
grayscale check. Keep bright cover accents separate from body chart colors.

## Fonts

The source bundle is offline-capable. To replace fonts, keep:

- one body family that covers both the intended Latin and CJK repertoire;
- one display family;
- one monospaced family.

Update the upstream license and integrity record in `assets/fonts/LICENSES.md`.

## Chapters

Add or remove chapter `\input` lines in `main.tex`. Preserve labels used by
cross-references, or update all references. Run `make qa` after structural changes.

## Charts

Replace CSV values rather than typing numbers into TikZ code. If a column name
changes, update both the CSV and the component. The `moonweave axis` style centralizes
axis, grid, label, and legend behavior.

## Tables

- Use `booktabs`: top/mid/bottom rules, no vertical rules.
- Keep units in headers.
- Bold only the decision-relevant cell.
- Explain direction (`higher is better`, `↓`) and uncertainty in the caption.
- Split a table rather than reducing body text below 8.5 pt.

## Draft mode

Use:

```tex
\documentclass[draft]{moonweave-report}
```

This adds a visible draft badge to the running header. The status in `metadata.tex`
still controls the cover and document-control record.

