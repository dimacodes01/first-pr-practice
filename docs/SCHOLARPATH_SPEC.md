# ScholarPath — Project Specification

> The single source of truth for ScholarPath. It records **what the owner asked for, the rules she set, the decisions taken and why, how the app is built, and what is still open**, so the project can continue from here in any new session, without the original chat.

| | |
|---|---|
| **Owner** | Dima Alkharraz — English teacher (Grade 5, Al Nahdha Charter School, Abu Dhabi) and Master's student in Artificial Intelligence |
| **Course it serves** | Al Ain University — Advanced Research Methods (0106112) |
| **What it is** | A research companion for master's students and early researchers who read, critique and write academic papers |
| **Code** | `index.html` (single file, ~3,800 lines, vanilla JS, no build step) + `vendor/pdfjs/` |
| **Repository** | `dimacodes01/first-pr-practice`, branch `claude/scholarpath-research-app-jabga7` |
| **Published page** | https://claude.ai/artifact/RQWX4dnGb7W68zTghnoLvz (private to the owner until shared) |
| **First version (v1)** | https://claude.ai/artifact/5SBbxDnL3oV9XHyWgNwarW |
| **Built** | 9–10 October 2026, in one Claude Code conversation |

---

## 1. Non-negotiable rules (set by the owner)

These override everything else. Check every change against them.

1. **Never invent anything academic.** No made-up findings, statistics, references, DOIs, IDs or page numbers. Unknown values become clearly labelled placeholders. Claude prompts in the app say this explicitly.
2. **Never delete or move a word of the original paper.** When a PDF is read, every word of every paragraph must appear, in its own paragraph, in order.
3. **A paragraph is one block.** If a figure or table interrupts a paragraph (even mid-sentence), the paragraph is still read as one block and the figure is placed **after** the whole paragraph.
4. **Figures and tables are not part of the reading.** In the Paper Reader they are not simplified, translated, summarised or read aloud. A picture of each is shown where it sits, with a button to **Figure Lab**, where it is explained and critiqued.
5. **Distinguish the authors' words from the student's evaluation** ("The authors report…" vs "In my assessment…").
6. **Examples are always labelled** "Example" or "Demo", and illustrative content is never presented as a real paper.
7. **Every generated output has a Copy button.** Everything works on a phone. Light and dark mode. No login. Everything is saved in the browser.
8. **Claude's output is always marked** ("by Claude — check it") and the user is reminded to verify it against the paper.

---

## 2. Design system

- **Look:** clean, academic, modern. Ink-blue accent on a calm neutral background; generous spacing; simple line icons (inline SVG).
- **Fonts:** *Source Serif 4* for headings and reading text; *Inter* for the interface (Google Fonts).
- **Colour tokens** on `:root`: `--bg #f6f5f1`, `--surface #fff`, `--ink #1a2233`, `--accent #1f3a6b` (dark mode: `--bg #0e131d`, `--accent #90b0e8`). Dark mode follows the system, or the theme button (auto → light → dark); both `@media (prefers-color-scheme)` and `[data-theme]` are defined.
- **Chart colours** (validated for colour-blind readers in both modes, all pairs): light `#2a78d6 #eb6834 #1baf7a`, dark `#3987e5 #d95926 #199e70`, at most 3 series. Series also differ by hatch and marker shape so they work in black and white. Bars start at zero; never two y-axes.
- **Status colours:** ok = green, warning = amber, danger = red, figures = violet.
- **Phone:** 16px gutters, no horizontal scrolling, tabs scroll sideways, buttons ≥ 32px.

---

## 3. Architecture

| Concern | How |
|---|---|
| Structure | One `index.html`: CSS, then markup (header, tab bar, one `<section class="panel">` per tab), then one script in an IIFE. Each tab has `RENDER.<tab>()`; events use delegation via `data-act="…"` → `ACTIONS[...]`, plus `input` / `change` handlers keyed on `data-*` attributes. |
| Saved data | `localStorage['scholarpath.v1']` holds one state object `S` (ideas, papers, critiques, writing, reader, figlab, pres, ui, theme). Saved with a 250 ms debounce. Missing keys are filled from `seedState()` (forward compatible). |
| Pictures | Figure crops and page images are stored in **IndexedDB** (`scholarpath` → store `img`), because they are too big for localStorage. Keys: `<reviewId>:crop`, `<reviewId>:page`, `<paperId>:<figId>:crop`. Not included in the JSON backup. |
| PDFs | **pdf.js 3.11.174**, loaded from `vendor/pdfjs/` and falling back to cdnjs. Text is extracted in the browser; nothing is uploaded. |
| Claude (AI) | Only on the published claude.ai page: `window.claude.use('sample')`, using the **viewer's own Claude account** (consent is asked on the first call). In the plain file there is no AI; every AI feature has a manual alternative. |
| Downloads | On claude.ai: `window.claude.use('downloads')` (the viewer confirms each save). Elsewhere: a normal download link. |
| Published capabilities | `{"sample": {"images": true}, "downloads": true}`. Publish `index.html` with `vendor/pdfjs/pdf.min.js` and `vendor/pdfjs/pdf.worker.min.js` as supporting files. |
| Speech | The browser's `speechSynthesis` (free, offline). The app does **not** use browser pause and resume; it tracks its own position (see 4.3). |

---

## 4. How the app is organised: three parts

Since 12 October 2026 the app is presented as a **journey in three parts**, in the order the owner works (her request: *first writing a research paper and everything that helps, second building a critique, last the presentation*).

| Part | Steps (in order) | Tab used |
|---|---|---|
| **Start** | The journey at a glance: three part cards with every step and its progress | `start` |
| **1 · Write a paper** | 1.1 Writing path → 1.2 Find literature → 1.3 Ideas & reading list → 1.4 Figures & tables | `write`, `hub`, `ideas`, `figlab` (build mode) |
| **2 · Critique a paper** | 2.1 Read the paper → 2.2 Explain the figures → 2.3 Write the critique | `reader` (paragraphs), `figlab` (explain mode), `critique` |
| **3 · Present** | 3.1 Build the slides → 3.2 Prepare for questions | `present`, `reader` (questions view) |
| **My Progress** | Overview, backup and restore | `progress` |

- **Navigation:** a parts row (pills) and a numbered steps row (1.1 › 1.2 › …). Each page's eyebrow says "Part 1 · Write a paper — Step 1.2: Find literature". **Previous / Next** buttons at the bottom of every step lead through the whole journey (the end of part 1 leads to part 2, and so on). Each part remembers its last open step.
- **Addresses:** `#start`, `#writing/1` … `#writing/4`, `#critiquing/1` … `/3`, `#presenting/1` … `/2`, `#progress`. Old addresses (`#reader`, `#figlab`, `#critique`, …) still work and are rewritten.
- **Writing path → helpful tools:** each writing step links to the steps that help with it (e.g. *Find the gap* → Find literature, Read a key paper in simple English; *Results* → Build your figures).
- **Figure Lab** has no mode switch any more: step 1.4 opens build mode and step 2.2 opens explain mode, each with a link to the other.
- **Code:** `PARTS` defines parts and steps; `goStep(part, i)` opens a step; `showTab(tab)` (used throughout) finds the matching step with `stepFor`. `route()` reads the address. The header is sticky only at 720px and wider, and `--hdr` holds its height for sticky toolbars.

## 5. Features, by tab

(Sections 5.1–5.8 describe the tabs; see section 4 for where each appears in the journey.)

### 5.1 Resource Hub (step 1.2)
- Cards for IEEE Xplore, Google Scholar, Scopus, Web of Science, ACM DL, ScienceDirect, SpringerLink, arXiv, Semantic Scholar and ResearchGate, each with a one-line "best for".
- **Search builder:** database + keywords + optional "from year" → a search link (Copy / Open). Web of Science cannot take a link, so it opens the search page and copies the query. arXiv, ResearchGate and WoS ignore the year (the user is told).
- Search tips: Boolean operators, quotation marks, date filters, field search, snowballing, search log.

### 5.2 Idea Organizer (step 1.3)
- Idea cards: title, research question, keywords, tags, status (Idea / Exploring / Drafting / Done). Filter by status and tag.
- Reading list: title, authors, year, venue, link/DOI (a bare DOI becomes a doi.org link), one-line takeaway, linked idea.
- Example: one idea (Arabic-language fairness in GenAI tutors) and two real papers (*Gender Shades*, 2018; *Stochastic Parrots*, 2021).

### 5.3 Paper Reader (steps 2.1 and 3.2)
**Input:** upload a PDF, or paste text. Each paper keeps its own notes and chats. Title is taken from page 1 (largest font).

**PDF → paragraphs (the hardest part; follow rules 2–4).** `pdfPageLines` builds lines with positions, then `pdfToParagraphs`:
- removes running headers and footers (identical lines **at a page edge** on 2–3+ pages) and page numbers;
- finds figure and table captions (`findFiguresOnPage`: "Fig. 3.", "Figure 3:", "TABLE II", "Table 2."), computes each figure's area (`figRegion`), and leaves out the caption plus the figure's own labels and cells — **but never a line that looks like body text** (body font size with ≥ 3 words, or a short line right next to body text);
- breaks paragraphs on: more vertical space than the page's measured line spacing (×1.3), a first-line indent, or a short last line ending a sentence. Across a **new page, new column or figure**, a paragraph continues unless a real paragraph start is seen (indent, in indented papers; otherwise a short previous line plus a capital letter);
- treats a line as a heading only if it looks like one (capital or number, short, standing alone);
- keeps hyphens at line ends unless the joined word occurs elsewhere in the paper ("twelve-week" stays, "evalu-ation" → "evaluation");
- joins short fragments (< 25 words) to the paragraph they continue (no full stop, starts lower case, or a figure in between), otherwise to the next one;
- places each figure **after the paragraph** in which it was met, as a `kind:'figure'` item with a cropped picture;
- stops at "References".

**Each paragraph card:** ¶ number (figures are not numbered), page, section →
1. **Original text** (full);
2. **Simple version** — the same paragraph rewritten in clear English (B1–B2), keeping every point and number; written by Claude or by the user;
3. **Main idea** in 1–2 sentences;
4. key terms with plain meanings; Arabic translation (optional); memory hook; "Connects to" an earlier paragraph with a relation (supports / explains / example of / contrasts / follows from / result of / defines);
5. Listen buttons and **Ask Claude** chat.

**Figure cards:** picture + caption + "not part of the reading" + **Explain it in Figure Lab** (opens the figure there with its picture, the sentences that cite it and the abstract, and starts the analysis). Figure Lab has **Back to this figure in the Paper Reader**.

**Views:** Paragraphs · Idea flow (chain of main ideas and links, with figure markers; copyable reading notes) · Questions (three groups: *You ask the class*, *The professor may ask you* with answer tips and paragraph links, *Colleagues may ask you*). Without Claude, sensible starter questions are shown.

**Read aloud:**
- Choose any mix of **Original / Simple / Arabic translation**; a **Woman / Man** voice (common system voice names are recognised; if no voice of that kind exists, the pitch is adjusted and the user is told); speed 0.75–1.5×; exact English and Arabic voices.
- **Pause keeps the exact word; Continue resumes there** — also after leaving the tab, switching paper or reloading (a bookmark per paper in `S.reader.marks`). Back and forward move one sentence; Stop forgets the place; "From the start".
- Reads sentence by sentence and highlights the current sentence in the original text. Arabic text uses an Arabic voice. Figures are never read.

**Ask Claude:** a chat per paragraph and one for the whole paper. Suggested prompts include *Explain this more simply*, *Give me an everyday example* and *اشرح هذه الفقرة بالعربية*. Claude must answer from the paper and separate general knowledge from what the paper says. Answers stream, can be stopped, can be listened to and copied, and are saved.

**Arabic translation:** Claude translates each paragraph faithfully into Modern Standard Arabic (with the English technical term in brackets the first time), or the user pastes their own. Shown right-to-left.

**Use in Critique:** attaches the paper's text to the AAU critique for evidence search.

### 5.4 Critique Studio (step 2.3)
**Default template: the official AAU Advanced Research Methods (0106112) Paper Critique Form**, in the exact order of the form:
- **Page 2 – Paper Information:** student name and ID (entered by the user, never changed), topic ID, paper ID, presentation number (placeholders if missing — never invented), date, exact title, authors in order, venue, year, verified DOI, publication status, reading version.
- **Part A – Diagnostic (0%):** Work and Contribution 1–5, Originality and Novelty 1–5, Related-Work / Citation Relevance **1–3**, Quality of Presentation 1–5 — each with a justification.
- **Part B:** 1 Summary 15% / 200 words · 2 Research Problem & Objectives 10% / 150 · 3 Literature Review 10% / 200 · 4 Research Design & Methodology 10% / 250 · 5 Results & Discussion 10% / 200 · 6 Contribution & Practical Implications 10% / 150 · 7 Referencing — exactly 10 related papers, 5%, excluded from the word limit, each with a **Verified** box ("[verify]" when unticked) · 8 Student's Critical Evaluation **30% / 500 words combined** (8a Strengths ≈150, 8b Weaknesses ≈200, 8c Future Work ≈150).
- Each section shows: weight, limit, a "What to address" list (from the owner's instructions), a warning, a live word counter (red when over), a supporting-evidence field, and an "I have reviewed this" box.
- **Page 8 – Instructor Evaluation:** shown but locked; never filled by the app.
- **Final quality control:** 12 checks; the first four are automatic (all sections done, each limit, the 500-word total, 10 verified references).
- **Paper tools:** PDF upload with page-numbered evidence search; **Copy AI-assistant prompt** (all the form's rules + the paper text).
- **Export:** plain text in form order, and a **Word .docx** (built in the browser as a minimal OOXML zip).
- A **general 11-section template** (citation → verdict, with 1–5 ratings) is also available.
- Example: a full AAU critique of *Gender Shades* (Buolamwini & Gebru, 2018) using only facts known to be accurate. Its 10 references are real papers but were written from memory, so their **Verified boxes are deliberately unticked**.

### 5.5 Write Your Paper (step 1.1)
- Ten steps (topic → gap → question → literature review → methodology → results → discussion → conclusion → abstract → references), each with an explanation, a checklist and notes.
- IMRaD template, IEEE structure guide, an outline generated from the notes, and an 8-item self-review (clarity, originality, alignment, citations, formatting, limits, plagiarism, ethics/disclosure).

### 5.6 Figure Lab (steps 1.4 and 2.2)
**Explain a figure (critique):**
- **Analyse the figures in a paper:** upload a PDF → every figure and table is found by its caption, cropped, and linked to the sentences that cite it → Claude analyses each one (sees the crop and the full page) → a review is filled in. Without Claude, draft reviews are created.
- **Review fields:** figure number, caption, linked critique, type (10 types, each with reading steps and red flags), axes, main pattern, the claim it supports and whether fully, partially or not at all, **importance to the study, effect on its conclusions, relation to the research question**, strengths and weaknesses, a 10-item quality checklist (with N/A), and ratings (clarity, accuracy, relevance).
- **Figure explanation paragraph:** generated from the answers. Unticked checks become weaknesses once the checklist has been used. **Add to critique** appends it to the Results section (warns about the AAU word limit; no duplicates).

**Build a figure (own paper):**
- Nine goals, each with recommended figure types, what to avoid, tips and a mini preview.
- Chart builder (bar, grouped bar, line, scatter; up to 3 series) with a live preview → **SVG code**, **data table**, and **matplotlib code** for an IEEE single column (3.5 in, 8 pt, 600 dpi, legend above the plot).
- IEEE caption and alt-text builder. Panels on writing about figures and IEEE figure and table rules.

### 5.7 Presentation Builder (step 3.1)
- From any critique (general or AAU) or the paper outline → 8 slides (title, background, problem, method, key findings, critique, conclusion, Q&A) with speaker notes and timings for 5, 10 or 15 minutes.
- Key Findings adds one figure from Figure Lab per main result.
- Copyable outline.

### 5.8 My Progress
- Ideas, papers logged, critiques completed, **figures reviewed**, writing steps; bars by status; critique completion; writing path; Paper Reader progress.
- Backup and restore (JSON), remove or add examples, reset.

---

## 6. Example and demo content

| Where | Content | Real or illustrative |
|---|---|---|
| Ideas / reading list | 1 idea, *Gender Shades* (2018), *Stochastic Parrots* (2021) | Real papers |
| Critique Studio | AAU critique of *Gender Shades* | Real paper; references unverified on purpose |
| Paper Reader | "Demo: How students use AI feedback…" — 6 paragraphs with simple versions, Arabic, a demo Fig. 1 and questions | **Written for ScholarPath — not a real study** |
| Figure Lab | Example review "Fig. 3" and chart-builder data | Illustrative |

---

## 7. Known limitations

- **Scanned PDFs** (images of pages) have no text: use *Paste text*. OCR is not built in.
- **Paragraph detection** is heuristic. In papers that separate paragraphs with a blank space (not an indent), a figure placed exactly where a sentence ends with a short line is ambiguous, so the text stays as two blocks (no words lost).
- **Figure cropping** is automatic and can include a stray line; the full page is always sent to Claude as well. Captions must start with "Fig. N." / "Figure N:" / "TABLE N".
- **PDF page numbers** are the PDF's own pages, not the journal's printed numbers.
- **Voices** depend on the device. Some voices don't report word positions, so Continue then restarts at the sentence.
- **AI features** need the published claude.ai page and use the viewer's Claude account. They are not available in the plain file.
- **Pictures and data** are stored in the browser only. The JSON backup excludes the pictures.

---

## 8. How it was tested

Headless Chromium (Playwright) scripts, with stand-ins for Claude (`window.claude`) and the speech engine:
- every tab renders without errors, on desktop and phone, in light and dark mode, without horizontal scrolling;
- AI flows: summaries, questions, chat, translation and figure analysis, including unusual reply shapes;
- read-aloud: voice choice, pause/continue at the exact word, continue after reload, sentence skip;
- the Word export opens in python-docx; the matplotlib code runs and exports at 3.5 in / 600 dpi;
- **word preservation:** 20 generated two-column papers (indented and spaced paragraphs) with figures interrupting paragraphs (mid-sentence, between sentences, at column tops) and a table. Every word of every paragraph is compared with the original. Result: no word lost; every paragraph whole in indented papers.

The scripts lived in the session's scratch area. **Next step:** add them to `tests/` so they can be re-run.

---

## 9. Change log

| Date | Change |
|---|---|
| 2026-10-09 | v1: six tabs, light/dark, localStorage, examples |
| 2026-10-09 | AAU Paper Critique Form (0106112), PDF evidence search, AI prompt, Word export |
| 2026-10-09 | Paper Reader: paragraphs, main ideas, links, idea flow, presentation questions |
| 2026-10-09 | Figure Lab: explain and build modes, chart builder, captions |
| 2026-10-10 | Reader: full original text, read-aloud, Ask Claude chats |
| 2026-10-10 | Figure Lab: upload a paper → figures found, cropped and critiqued by Claude |
| 2026-10-10 | Read-aloud: woman/man voices, Arabic translation, pause and continue at the same word |
| 2026-10-10 | Reader: full simple-English version of each paragraph; fixed "Simple does nothing" |
| 2026-10-10 | Reader: figures and tables kept out of the reading, explained in Figure Lab |
| 2026-10-10 | Reader: whole paragraphs and every word kept around figures |
| 2026-10-12 | Reorganised as a journey: Start page, Part 1 Write → Part 2 Critique → Part 3 Present, Previous/Next, helpful-tool links in the writing path |

---

## 10. Ideas for next steps

- Merge the branch into `main` (pull request) so `main` holds the current app.
- Move the test scripts into `tests/` with a one-line run command.
- Split `index.html` into modules (one file per tab) once it grows further.
- OCR for scanned PDFs; detection of sub-section headings ("A. Participants").
- Include figure pictures in the backup (zip), and sync between devices.
- An Arabic interface option for the whole app.
