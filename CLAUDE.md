# ScholarPath — notes for Claude

ScholarPath is a research companion web app built for **Dima Alkharraz** (English teacher and Master's student in AI; course: Al Ain University Advanced Research Methods 0106112).

**Read `docs/SCHOLARPATH_SPEC.md` first.** It is the full specification: every requirement, rule, decision and known limitation.

## Hard rules (from the owner)
- Never invent academic content (findings, numbers, references, DOIs, IDs). Use labelled placeholders.
- Never delete or move a word of an uploaded paper. A paragraph interrupted by a figure stays one block, and the figure goes after it.
- Figures and tables are not part of the Paper Reader's reading. They are shown as pictures and explained in Figure Lab.
- Label all example content. Put a Copy button on every generated output. Keep it working on phones, in light and dark mode. No login.
- Mark Claude-generated text as Claude's, and remind the user to check it against the paper.
- Read aloud uses the device's own voices: label an accent or region only from the voice's language tag, never fake an accent, dialect or gender with pitch, and never change the written text — only the spoken copy (spec §5.3). Do not claim a voice was upgraded unless the app really uses it.
- Evidence mapping (step 2.4): a quotation is shown only if it is found word for word in the paper, and pages, sections and paragraphs come from the paper, never from Claude; otherwise "Source not verified" (spec §5.4b).
- Design (spec §2): use the CSS tokens on `:root` (the school-platform look the owner chose: dark-blue top bar, slate sidebar with a white tile for the current page, light blue-grey page, white cards, blue accent, pill buttons, underlined tabs, coloured icon tiles from `--c-*`), Nunito / IBM Plex Sans Arabic, Lucide icons via `icon()`. Keep the top bar dark blue. No emoji in the interface. Every text colour must pass WCAG AA in light and dark. No placeholder buttons that do nothing.
- Part 4 · Verify & defend: the original paper is the source of truth; never mark a check as done unless it was actually checked on the current document versions; never resolve a contradiction silently; never call the documents fully consistent before the complete comparison (spec §5.9). Professor questions (4.2) are generated from the actual documents only — no fixed question bank — and a question is "prepared" only after the student has answered it (spec §5.10).

## Code
- The app is a journey in four parts (Write a paper → Critique a paper → Present → Verify & defend), plus the Dashboard (`start` tab) and My Progress; see spec §4. The sidebar and breadcrumb are drawn by `renderTabs()`; the Research Reader is three panels (outline, document, study panel for the selected paragraph — `rdSelect`, `renderAssist`, `S.reader.sels`, `S.reader.as`) with the player in `ttsBarHTML()`. Step 2.4 (`evidence` tab) is spec §5.4b, step 4.1 (`verify` tab) §5.9 and step 4.2 (`defend` tab) §5.10; all three share one document set (`S.verify.sets`). `PARTS` lists the steps; `goStep` / `showTab` / `route` handle navigation.
- `index.html` is the whole app: CSS, markup and one script in an IIFE. Each tab has a `RENDER.<tab>()`. Events use `data-act` → `ACTIONS`, plus `input` / `change` handlers keyed on `data-*`.
- State lives in `localStorage['scholarpath.v1']` (`S`), and figure pictures in IndexedDB (`scholarpath` / `img`).
- `vendor/pdfjs/` holds pdf.js 3.11.174 (with a cdnjs fallback).
- Claude runs only on the published page, via `window.claude.use('sample')`. Every AI feature needs a manual fallback.
- Match the existing style: plain functions, template strings, `esc()` for every user value, CSS tokens on `:root`.

## Before committing
- Check the script compiles: extract the `<script>` from `index.html` and run `new Function(js)` in Node.
- Run the app in Chromium (Playwright; `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Check every tab for page errors, at 1440, 1280, 1024 and 390 px wide, light and dark, without horizontal scrolling. The reader's layout depends on the space next to the sidebar (container queries), so also check it with the sidebar collapsed.
- If PDF reading changed, re-run the word-preservation check (spec §8): every word of every paragraph must survive.

## Publishing
- Published page: https://claude.ai/artifact/RQWX4dnGb7W68zTghnoLvz
- Publish `index.html` with the supporting files `vendor/pdfjs/pdf.min.js` and `vendor/pdfjs/pdf.worker.min.js`, and the capabilities `{"sample": {"images": true}, "downloads": true}`.
- Work on branch `claude/scholarpath-research-app-jabga7`. Commit and push after each change, with an attribution footer.

## Owner's preferences
Clear, organised, practical and visually polished. Explain complex things in small steps. Consider UAE and Arabic-speaking learners. Be accurate and academically credible.
