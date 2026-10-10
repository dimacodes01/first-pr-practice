# ScholarPath — notes for Claude

ScholarPath is a research companion web app built for **Dima Alkharraz** (English teacher and Master's student in AI; course: Al Ain University Advanced Research Methods 0106112).

**Read `docs/SCHOLARPATH_SPEC.md` first.** It is the full specification: every requirement, rule, decision and known limitation.

## Hard rules (from the owner)
- Never invent academic content (findings, numbers, references, DOIs, IDs). Use labelled placeholders.
- Never delete or move a word of an uploaded paper. A paragraph interrupted by a figure stays one block, and the figure goes after it.
- Figures and tables are not part of the Paper Reader's reading. They are shown as pictures and explained in Figure Lab.
- Label all example content. Put a Copy button on every generated output. Keep it working on phones, in light and dark mode. No login.
- Mark Claude-generated text as Claude's, and remind the user to check it against the paper.

## Code
- `index.html` is the whole app: CSS, markup and one script in an IIFE. Each tab has a `RENDER.<tab>()`. Events use `data-act` → `ACTIONS`, plus `input` / `change` handlers keyed on `data-*`.
- State lives in `localStorage['scholarpath.v1']` (`S`), and figure pictures in IndexedDB (`scholarpath` / `img`).
- `vendor/pdfjs/` holds pdf.js 3.11.174 (with a cdnjs fallback).
- Claude runs only on the published page, via `window.claude.use('sample')`. Every AI feature needs a manual fallback.
- Match the existing style: plain functions, template strings, `esc()` for every user value, CSS tokens on `:root`.

## Before committing
- Check the script compiles: extract the `<script>` from `index.html` and run `new Function(js)` in Node.
- Run the app in Chromium (Playwright; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Check every tab for page errors, at 1280px and 390px wide, light and dark.
- If PDF reading changed, re-run the word-preservation check (spec §7): every word of every paragraph must survive.

## Publishing
- Published page: https://claude.ai/artifact/RQWX4dnGb7W68zTghnoLvz
- Publish `index.html` with the supporting files `vendor/pdfjs/pdf.min.js` and `vendor/pdfjs/pdf.worker.min.js`, and the capabilities `{"sample": {"images": true}, "downloads": true}`.
- Work on branch `claude/scholarpath-research-app-jabga7`. Commit and push after each change, with an attribution footer.

## Owner's preferences
Clear, organised, practical and visually polished. Explain complex things in small steps. Consider UAE and Arabic-speaking learners. Be accurate and academically credible.
