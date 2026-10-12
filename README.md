# First PR Practice

This is a small practice repository for learning the GitHub pull request workflow:
create a branch, make a change, open a PR, and merge it.

## What this repo does

Nothing yet — it's a sandbox for practicing git and GitHub.

## Getting started

1. Clone the repo.
2. Make a change on a new branch.
3. Open a pull request and mege it.

## ScholarPath

**Full project specification: [`docs/SCHOLARPATH_SPEC.md`](docs/SCHOLARPATH_SPEC.md)** — requirements, rules, design, architecture, limitations and change log. Notes for Claude sessions: [`CLAUDE.md`](CLAUDE.md). Live page: https://claude.ai/artifact/RQWX4dnGb7W68zTghnoLvz

`index.html` is **ScholarPath**, a single-page research companion for master's students and early researchers.
Open the file in any modern browser. It needs no install, build step or login, and all work is saved in the browser's localStorage.

The app is organised as a journey in three parts: **1 · Write a paper** (writing path, find literature, ideas & reading list, figures & tables), **2 · Critique a paper** (read the paper, explain the figures, write the AAU critique) and **3 · Present** (build the slides, prepare for questions), plus a Start page and My Progress.

| Tab | What it does |
| --- | --- |
| Resource Hub | Cards for 10 academic databases, a search-link builder (keywords + optional start year), and search tips |
| Idea Organizer | Idea cards (title, research question, keywords, tags, status), status and tag filters, and a reading list linked to ideas |
| Paper Reader | Upload a PDF (or paste text): it is split into paragraphs by section and page. Figures and tables (with their captions and the text inside them) are kept out of the reading: a picture of each appears where it sits in the paper, with a button that opens it in Figure Lab for explanation and critique. For each paragraph: the main idea in simple words, key terms, your own memory hook and a link to an earlier idea. Each paragraph shows the full original text, then a simple version (the same paragraph rewritten in clear English), then its main idea; both — plus an optional Arabic translation (by Claude, or typed in) — can be read aloud with the browser's voices: choose original / simple / Arabic, a woman's or man's voice and the speed; pause anywhere and Continue from the same word (remembered across reloads), or skip back and forward a sentence; and an *Ask Claude* chat answers questions about a paragraph or the whole paper. Also an *Idea flow* view, and presentation questions (you ask the class / the professor may ask you / colleagues may ask you). On the published claude.ai page, Claude writes the summaries and paper-specific questions using the viewer's own account; elsewhere you write your own, with starter questions. |
| Paper Critique Studio | The official Al Ain University Advanced Research Methods (0106112) Paper Critique Form (paper information, Part A diagnostic ratings, Part B sections 1–8 with weights, word limits and live word counts, 10 related references with verification flags, reserved instructor section, and a 12-point quality-control check). Also: in-browser PDF text search with page numbers, a copyable AI-assistant prompt, copyable text and Word (.docx) export. A general 11-section template is also available. |
| Write Your Paper | 10-step writing path with explanations, checklists and notes, plus an IMRaD template, an IEEE structure guide, a generated outline and a self-review checklist |
| Figure Lab | **Analyse a paper's figures:** upload a PDF; every figure and table is found by its caption, cropped from the page and linked to the sentences that cite it, and (on the published page) Claude explains and critiques each one — strengths, weaknesses, importance to the study, effect on its conclusions and relation to the research question. **Explain a figure:** figure details linked to a critique, 10 figure types with how-to-read steps and red flags, guided questions, a 10-item quality checklist, 1–5 ratings, and a generated figure explanation that can be added to the critique's Results section. **Build a figure:** goal-based figure recommendations with previews, a live chart builder (bar, grouped bar, line, scatter) with SVG, table and IEEE-sized matplotlib code, an IEEE caption and alt-text builder, and figure-writing and IEEE rules panels. |
| Presentation Builder | Slide structure from a critique or paper outline, with speaker notes and timings for 5/10/15-minute talks |
| My Progress | Dashboard of counts and progress (including figures reviewed), plus backup/restore (JSON), remove examples and reset |

The app opens with one example idea, two example papers and an example AAU-form critique of *Gender Shades* (2018), all clearly labelled. You can remove them from **My Progress**.

`vendor/pdfjs/` holds pdf.js 3.11.174 (Apache-2.0, see its LICENSE) so PDFs can be read without a CDN (figure crops are kept in the browser's IndexedDB); the app falls back to cdnjs if the folder is missing.
