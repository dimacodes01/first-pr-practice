// Critique Study Studio check — run from the repository folder:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) node tests/studio-check.js
// Uses the made-up example documents in tests/fixtures. Every Claude request goes through the copy-prompt bridge
// and is answered with a prepared reply — including invented quotations, which must never be shown.
// A stand-in speech engine records what would be read aloud.
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..'), PORT = 8775, BASE = `http://127.0.0.1:${PORT}/`;
const problems = [];
const fail = m => { problems.push(m); console.log('  FAIL ' + m); };
const ok = m => console.log('  ok   ' + m);
const check = (cond, good, bad) => cond ? ok(good) : fail(bad || good);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const FAKE_SPEECH = () => {
  window.__spoken = [];
  class U { constructor(t){ this.text = t; this.lang = 'en-US'; } }
  window.SpeechSynthesisUtterance = U;
  const synth = {speaking:false, pending:false, paused:false, onvoiceschanged:null,
    getVoices:() => [{name:'Test English', lang:'en-US', localService:true, default:true, voiceURI:'t-en'}, {name:'Test Arabic', lang:'ar-SA', localService:true, voiceURI:'t-ar'}],
    speak(u){ window.__spoken.push(u.text); setTimeout(() => { u.onstart && u.onstart({}); setTimeout(() => u.onend && u.onend({}), 5); }, 5); },
    cancel(){}, pause(){}, resume(){}, addEventListener(){}, removeEventListener(){}};
  Object.defineProperty(window, 'speechSynthesis', {value:synth, configurable:true});
};

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd:ROOT, stdio:'ignore'});
  await sleep(800);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({viewport:{width:1280, height:900}});
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    await ctx.addInitScript(FAKE_SPEECH);
    const page = await ctx.newPage(), errs = [], alerts = [];
    page.on('pageerror', e => errs.push(String(e.message || e)));
    page.on('dialog', d => { if (d.type() === 'confirm') d.accept(); else { alerts.push(d.message()); d.dismiss(); } });
    const S = () => page.evaluate(() => JSON.parse(localStorage.getItem('scholarpath.v1')));
    const doc = async () => { const st = (await S()).studio; return st.docs.find(d => d.id === st.active) || st.docs[0]; };
    const bridge = async (reply, expect) => {
      await page.waitForSelector('#aiBridge[open]', {timeout:4000});
      const prompt = await page.$eval('#aiBridge pre', e => e.textContent);
      if (expect) check(expect.test(prompt), `the prompt ${expect}`, `the prompt does not match ${expect}`);
      await page.fill('#aib-reply', typeof reply === 'string' ? reply : '```json\n' + JSON.stringify(reply) + '\n```');
      await page.click('#aiBridge button[type=submit]'); await page.waitForTimeout(450);
      return prompt;
    };
    const click = async sel => { await page.click(sel); await page.waitForTimeout(250); };

    console.log('Two pathways');
    await page.goto(BASE + 'index.html#critiquing/3'); await page.waitForTimeout(500);
    check(await page.isVisible('#panel-critique .st-path'), 'step 2.3 offers “Create a Critique” and “Upload & Study My Critique”');
    const nCrit = (await S()).critiques.length;
    await click('#panel-critique [data-act="crit-new"][data-form="aau"]');
    check((await S()).critiques.length === nCrit + 1, 'the existing critique builder still works (a new AAU critique was created)');
    await click('#panel-critique [data-act="st-path"][data-v="studio"]');
    check(await page.isVisible('#panel-studio') && /Critique Study Studio/.test(await page.textContent('#panel-studio h1')), 'the second pathway opens the Critique Study Studio');
    check(await page.isVisible('#panel-studio .st-upload'), 'it starts with the upload card');

    console.log('Upload and structure');
    await page.setInputFiles('#stCritFile', path.join(ROOT, 'tests/fixtures/example-critique.docx')); await page.waitForTimeout(1200);
    let d = await doc();
    const heads = d.blocks.filter(b => b.kind === 'h').map(b => b.text);
    check(JSON.stringify(heads) === JSON.stringify(['Example critique — made up for testing ScholarPath', '1. Summary', '2. Methodology', '3. Recommendations']),
      'Word headings found: styled headings and a bold-only heading', 'headings: ' + JSON.stringify(heads));
    check(d.blocks.some(b => b.table && /Sampling \| Weak/.test(b.text)), 'the table is kept, row by row');
    const shownTexts = await page.$$eval('#stDoc .st-p', els => els.map(e => { const c = e.cloneNode(true); c.querySelectorAll('.st-no, .st-study-btn').forEach(x => x.remove()); return c.textContent; }));
    check(d.blocks.filter(b => b.kind === 'p').every((b, i) => shownTexts[i] === b.text), 'every paragraph is shown exactly as written (word for word)');
    check(await page.$$eval('#stNavList .st-row-main[data-act="st-nav"]', bs => bs.length) === 4, 'the Critique Navigator lists the critique’s own 4 sections');
    const set0 = (await S()).verify.sets.find(s => s.id === d.setId);
    check(set0 && set0.docs.critique && set0.docs.critique.units.length === 7, 'the critique is also a Part 4 document set (2.4 / 4.1 / 4.2 can use it)');
    check(await page.isVisible('.st-note-warn'), 'without the paper: “not independently verified” is stated');

    console.log('Analyze My Critique');
    await click('[data-act="st-analyze"]');
    const P1 = await bridge({topic:'How students use AI writing feedback', overview:'The critique says the study is useful but its small, non-random sample limits it.',
      sections:[{id:'b3', purpose:'Summarises the study', args:['Students used an AI assistant for four weeks']}, {id:'b6', purpose:'Evaluates the method', args:['The sampling limits generalisation', 'Drafts plus interviews is a strength']}],
      strengths:['mixed data'], limitations:['sampling'], recommendations:['larger random sample'], evaluation:['sampling is the main weakness'],
      claims:[{id:'b7', quote:'Only twenty students from one school took part'}, {id:'b7', quote:'this sentence is not in the critique at all'}],
      terms:[{term:'non-probability sampling', definition:'Choosing participants without random selection.', simple:'Not picked at random.', ar:'العينة غير الاحتمالية', context:'The 20 students came from one school.', example:''}],
      objectives:[{id:'b6', objective:'Explain why the sampling limits generalisability'}, {id:'b3', objective:'Summarise the study in two sentences'}],
      studyMore:[{area:'Generalisability', kind:'method', why:'Central to the main criticism', action:'Revise sampling types', id:'b7', priority:1}]}, /HEADING\] 2\. Methodology/);
    await bridge({highlights:[{id:'b7', quote:'non-probability sampling may limit the generalizability of the findings', type:'limit', meaning:'The sample was not random.', why:'Main criticism', question:'Why does random sampling matter here?'},
      {id:'b8', quote:'the combination of drafts and interviews is a strength', type:'strength', meaning:'Two kinds of data.', why:'Balance', question:'What does each source add?'},
      {id:'b8', quote:'an invented sentence that is not in the paragraph', type:'eval', meaning:'x', why:'x', question:'x'}]}, /at most 2 passages per paragraph/);
    d = await doc();
    check(d.an && d.an.claims.length === 1, 'claims: the invented quotation was dropped, the real one kept');
    check(d.hls.length === 2, 'highlights: 2 real passages kept, the invented one dropped');
    check(await page.$$eval('#stDoc mark.sth', m => m.length) === 2, 'the highlights are shown as marks inside the original words');
    const before = await page.$eval('#sp-b7', e => { const c = e.cloneNode(true); c.querySelectorAll('.st-no, .st-study-btn').forEach(x => x.remove()); return c.textContent; });
    check(before === d.blocks.find(b => b.id === 'b7').text, 'marking never changes the wording');
    await click('.st-hlmenu > summary');
    await page.uncheck('input[data-st="hl"][data-k="limit"]'); await page.waitForTimeout(200);
    check(await page.$$eval('#stDoc mark.sth-limit', m => m.length) === 0, 'a highlight colour can be turned off');
    await page.check('input[data-st="hl"][data-k="limit"]'); await page.waitForTimeout(200);
    await click('.st-hlmenu > summary');
    await click('#stDoc mark.sth-limit');
    if (process.env.SHOTS){ await page.evaluate(() => document.querySelector('.st-ws').scrollIntoView()); await page.screenshot({path:process.env.SHOTS + '/studio-analysed.png'}); }
    check(/Why does random sampling matter here\?/.test(await page.textContent('#stAssist')) && /Weaknesses or methodological concerns/.test(await page.textContent('#stAssist')), 'selecting a highlight shows its meaning, why it matters, its type and a professor question');

    console.log('Understand: explain, Arabic, sentence by sentence, key points');
    await click('#stAssist [data-act="st-hl-close"]');
    await click('#sp-b7');
    await click('#stAssist [data-act="st-explain"]');
    await bridge({simple:'You say the sample was too small and not random.', academic:'Non-probability sampling limits external validity.', why:'It is your main criticism.', connection:'It must be checked in the paper, which was not added.', remember:['Sample of 20', 'One school']}, /THE SECTION "2\. Methodology"/);
    const ex = await page.textContent('#stAssist');
    check(['A. Simple explanation', 'B. Detailed academic explanation', 'C. Why this section matters', 'D. Connection to the original research', 'E. What I should remember'].every(h => ex.includes(h)), 'Explain This Section gives A–E');
    await click('#stListen [data-act="st-lang"][data-v="ar"]');
    await click('#stAssist [data-act="st-explain"]');
    await bridge({simple:'تقول إن العينة صغيرة وغير عشوائية.', academic:'العينة غير الاحتمالية (non-probability sampling) تحدّ من التعميم.', why:'هذا نقدك الرئيسي.', connection:'يجب التحقق من ذلك في الورقة.', remember:['عشرون طالبًا']}, /Modern Standard Arabic/);
    check(await page.$eval('#stEx', e => e.getAttribute('dir') === 'rtl' && /العينة/.test(e.textContent)), 'F. the Arabic explanation is shown right-to-left');
    await click('#stListen [data-act="st-lang"][data-v="en"]');
    await click('#stAssist [data-act="st-sub"][data-v="sentences"]');
    await click('#stAssist [data-act="st-sents"]');
    const sp = await bridge({items:[{n:1, simple:'The sample was not random, so results may not apply to everyone.', terms:[{term:'generalizability', meaning:'how far results apply to others'}], reasoning:'Random samples represent a population.', connection:'Needs checking in the paper.', kind:'criticism'}, {n:2, simple:'Only 20 students from one school.', terms:[], reasoning:'A small sample.', connection:'', kind:'description'}]}, /\[s1\] The use of non-probability sampling/);
    check(await page.$$eval('#stAssist .st-orig', e => e.length) === 2 && /A criticism/.test(await page.textContent('#stAssist')), 'each original sentence is shown with its explanation and its type');
    await click('#stAssist [data-act="st-tab"][data-v="points"]');
    check(/non-probability sampling/.test(await page.textContent('#stAssist')) && /العينة غير الاحتمالية/.test(await page.textContent('#stAssist')), 'Key points: the section’s terms with their Arabic meaning');

    console.log('Analyze: evidence, critical thinking');
    await click('#stAssist [data-act="st-tab"][data-v="evidence"]');
    check(/Upload the original research paper to verify the evidence/.test(await page.textContent('#stAssist')), 'without the paper, evidence asks for the paper');
    await page.click('.st-docs-fold > summary').catch(() => {});
    await page.setInputFiles('#stPaperFile', path.join(ROOT, 'tests/fixtures/example-paper.txt')); await page.waitForTimeout(800);
    await click('#stAssist [data-act="st-tab"][data-v="evidence"]');
    check(!(await page.$('.st-note-warn')), 'after adding the paper the “not verified” warning goes');
    await click('#stAssist .st-claims [data-act="st-ev"]');
    await bridge({claims:[{id:'c1', type:'para', evidence:[{p:'P3', quote:'Participants were recruited through a convenience sample at one school'}, {p:'P3', quote:'an invented quotation that the paper never says'}], basis:[], explain:'Restates the method.', needs:''}]}, /ORIGINAL RESEARCH PAPER/);
    const evText = await page.textContent('#stAssist');
    check(/Supported by the paper/.test(evText) && /PDF p\. 2/.test(evText) && /convenience sample at one school/.test(evText), 'Where did this come from? shows the verified passage with its page from the paper');
    check(!/invented quotation/.test(evText), 'an invented quotation is never shown');
    d = await doc();
    check(d.an.objectives.filter(o => o.id === 'b6').every(o => (d.check[o.k] || {}).ev), 'the checklist records that evidence was reviewed for that section');
    check(d.an.objectives.filter(o => o.id === 'b6').every(o => !(d.check[o.k] || {}).und), '“Understood” is never ticked automatically');
    await click('#stAssist [data-act="st-tab"][data-v="questions"]');
    await click('#stAssist [data-act="st-sub"][data-v="challenge"]');
    await click('#stAssist [data-act="st-chal"]');
    await bridge({questions:[{q:'Could the researchers justify using one school?', why:'Tests the fairness of your criticism', hint:'Think about access and cost'}]}, /Challenge a master's student's OWN/);
    await page.fill('#stCA0', 'Yes, access was limited, but it still limits generalisation.');
    await click('#stAssist [data-act="st-chal-check"]');
    await bridge({verdict:'partly', accurate:'You name the limit.', missing:['mention of external validity'], improve:'Use the term external validity.', followup:'How would a random sample change things?'}, /Could the researchers justify/);
    check(/Partly there/.test(await page.textContent('#stAssist')), 'Challenge My Critique: the student’s answer gets feedback');

    console.log('Prepare: professor questions and practice');
    await click('#stAssist [data-act="st-sub"][data-v="professor"]');
    await click('#stAssist [data-act="st-qa"]');
    await bridge({questions:[{q:'Why is the sample a problem?', asks:'Whether you understand generalisability', answer:'Because twenty students from one school may not represent others.', oral:'The sample was small and not random.', evidence:{from:'critique', id:'b7', quote:'Only twenty students from one school took part'}, followups:['What sample would you use?']},
      {q:'What is good about the data?', asks:'Balance', answer:'Drafts and interviews together.', oral:'Two sources.', evidence:{from:'paper', id:'P3', quote:'a quotation the paper does not contain anywhere'}, followups:[]}]}, /professor will question/);
    const qa = await page.textContent('#stAssist');
    check(/Your critique · ¶4/.test(qa), 'a supporting quotation is shown with its real place when found word for word');
    check(/could not be found word for word/.test(qa), 'an unverifiable quotation is not shown');
    await click('#stAssist [data-act="st-tab"][data-v="practice"]');
    check(!(/Because twenty students from one school/.test(await page.textContent('#stAssist'))), 'practice keeps the suggested answer hidden');
    await page.fill('#stPA', 'Because it is small.');
    await click('#stAssist [data-act="st-prac-submit"]');
    await bridge({verdict:'weak', accurate:'It is small.', missing:['not random', 'one school'], improve:'Explain both size and selection.', followup:'Would a bigger sample from the same school help?'}, /THE STUDENT'S ANSWER: Because it is small\./);
    check(/Needs more work/.test(await page.textContent('#stAssist')) && !(/Because twenty students from one school/.test(await page.textContent('#stAssist'))), 'the answer is evaluated; the model answer still hidden');
    await click('#stAssist [data-act="st-prac-model"]');
    check(/Because twenty students from one school/.test(await page.textContent('#stAssist')), 'the suggested answer appears only on request');
    await click('#stAssist [data-act="st-prac-follow"]');
    check(/Would a bigger sample from the same school help\?/.test(await page.textContent('#stAssist .st-pq')), 'the follow-up question becomes the next question');
    d = await doc();
    check(d.an.objectives.filter(o => o.id === 'b6').every(o => (d.check[o.k] || {}).prac), 'the checklist records practice after real feedback');

    console.log('Study progress, key concepts, what to study more');
    check(await page.$$eval('.st-check tbody tr', r => r.length) === 2, 'the checklist has one row per learning objective from THIS critique');
    await page.check('.st-check input[data-f="und"]'); await page.waitForTimeout(200);
    check(/1<\/b> of 2 understood/.test(await page.innerHTML('#stCheckSum')), 'ticking “Understood” updates the progress');
    await click('[data-act="st-bottom"][data-v="more"]');
    check(/Top priority/.test(await page.textContent('#stBottom')) && /Revise sampling types/.test(await page.textContent('#stBottom')), 'What should I study more? lists prioritised actions');
    await click('[data-act="st-bottom"][data-v="concepts"]');
    check(/Choosing participants without random selection/.test(await page.textContent('#stBottom')), 'Key concepts lists the terms');

    console.log('Read & listen');
    await page.evaluate(() => { window.__spoken = []; });
    await click('#sp-b7');
    await click('#stListen [data-act="st-re"]');
    await page.waitForTimeout(1200);
    const spoken = await page.evaluate(() => window.__spoken.join(' | '));
    check(/non-probability sampling/.test(spoken) && /In simple words/.test(spoken), 'Read & explain reads the paragraph, then its simple explanation');
    check(await page.$('#stListen [data-act="st-re-next"]') !== null, 'then it waits, offering the next paragraph');

    console.log('Paste and remove');
    await click('[data-act="st-new"]');
    await click('[data-act="st-paste"]');
    await page.fill('#stPasteText', 'Summary\nThe paper studies feedback.\n\nLimitations\nThe sample is small and the period is short.');
    await page.click('#dlgForm button[type=submit]'); await page.waitForTimeout(400);
    d = await doc();
    check(d.blocks.filter(b => b.kind === 'h').length === 2 && d.blocks.filter(b => b.kind === 'p').length === 2, 'pasted text: headings and paragraphs found');
    check((await S()).studio.docs.length === 2, 'several critiques can be studied');
    await page.selectOption('#stDocSel', {index:1}); await page.waitForTimeout(300);

    console.log('The Critique Navigator');
    const shown = async () => page.$$eval('#stDoc .st-p', els => els.map(e => { const c = e.cloneNode(true); c.querySelectorAll('.st-no, .st-study-btn').forEach(x => x.remove()); return c.textContent; }));
    const navTitles = () => page.$$eval('#stNavList .st-rtitle', t => t.map(x => x.textContent.trim()));
    await click('#stNavList .st-row-main[data-act="st-nav"]:nth-of-type(1)');
    await click('#stAssist [data-act="st-status"][data-v="reviewed"]');
    check(/1 of \d+ sections? reviewed/.test(await page.textContent('#stNavHead')), 'marking a section “Reviewed” updates the navigator’s progress');
    d = await doc();
    check(Object.values(d.status || {}).includes('reviewed'), 'the study status is saved with the critique');
    await page.fill('#stFind', 'generalizability'); await page.waitForTimeout(500);
    check(/1 of 1/.test(await page.textContent('#stFindN')) && await page.evaluate(() => !!(CSS.highlights && CSS.highlights.get('st-find'))), 'search finds the words and marks them over the original text');
    check(/1 match/.test(await page.textContent('#stNavList')), 'the navigator shows where the matches are');
    await page.fill('#stFind', ''); await page.waitForTimeout(400);
    await click('[data-act="st-focus"]');
    check(!(await page.isVisible('#stNav')) && !(await page.isVisible('#stAssist')) && await page.isVisible('#stDoc'), 'Focus Mode shows only the critique');
    await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    check(await page.isVisible('#stNav') && await page.isVisible('#stAssist'), 'Esc leaves Focus Mode');

    console.log('Ten critique formats (made-up texts)');
    const P = (...xs) => xs.join('\n\n');
    const refs = Array.from({length:12}, (_, i) => `[${i + 1}] Author ${String.fromCharCode(65 + i)}. (20${10 + i}). Example reference title number ${i + 1}. Example Journal of Testing.`);
    const long = Array.from({length:120}, (_, i) => `Sentence ${i + 1} of a deliberately long paragraph that discusses the sampling decision and its effect on validity in some detail.`).join(' ');
    const FORMATS = [
      ['clear headings', P('Introduction\nThe study looks at peer feedback in writing classes.', 'Methodology\nThe authors surveyed students in two schools.', 'Findings\nStudents valued specific comments.', 'Conclusion\nThe critique finds the conclusions reasonable but limited.'),
        async () => { const t = await navTitles(); return JSON.stringify(t) === JSON.stringify(['Introduction', 'Methodology', 'Findings', 'Conclusion']); }, 'the four headings become the four navigator rows'],
      ['percentages', P('1. Summary of the paper\n10% | Maximum 150 words\nThe paper reports a four-week study of feedback.', '2. Methodology\n15% | Maximum 200 words\nThe design is a small case study.', '3. Critical evaluation (25%)\nThe sample limits the claims.'),
        async () => { const t = await navTitles(), m = await page.$$eval('#stNavList .st-rmeta', x => x.map(e => e.textContent)); return t.length === 3 && t.every(x => !/%|words/i.test(x)) && /Summary of the paper/.test(t[0]) && m.some(x => /10%.*Maximum 150 words/.test(x)); }, 'percentages are shown under the real titles, never as titles'],
      ['word limits', P('Summary (Maximum 150 words)\nThe study is described briefly.', 'Word limit: 200 words', 'The second part evaluates the method and its sampling in detail.', 'Recommendations — Max 100 words\nA larger random sample is recommended.'),
        async () => { const t = await navTitles(); return t.every(x => !/max|word limit|\bwords\b/i.test(x)) && t.includes('Summary') && t.includes('Recommendations') && /Suggested label/.test(await page.textContent('#stNavList')); }, 'word limits are secondary information; an untitled part gets a clearly marked suggested label'],
      ['many references', P('Summary\nA short summary of the critiqued paper.', 'References', ...refs),
        async () => /References — 12 sources/.test(await page.textContent('#stNavList')) && !(await navTitles()).some(x => /^\[\d+\]/.test(x)), 'the 12 references are one group: “References — 12 sources”'],
      ['nested sub-sections', P('1. Introduction\nWhy the study matters.', '2. Methods\nAn overview of the design.', '2.1 Sample\nTwenty students took part.', '2.2 Instruments\nA survey and interviews.', '3. Results\nThe main results.'),
        async () => { await click('[data-act="st-expand-all"]'); const top = await page.$$eval('#stNavList .st-ng-main > .st-list > .st-node > .st-row .st-rtitle', x => x.map(e => e.textContent));
          const kids = await page.$$eval('#stNavList .st-kids .st-rtitle', x => x.map(e => e.textContent)); await click('[data-act="st-collapse-all"]');
          return top.length === 3 && kids.includes('Sample') && kids.includes('Instruments') && !(await page.$('#stNavList .st-kids')); }, '2.1 and 2.2 sit under 2; Expand all and Collapse all work'],
      ['no headings', P('The authors used a survey with a convenience sample of twenty participants, so the method and the sampling limit the study.', 'The results show significant gains in accuracy, and the findings are clearly reported.', 'One limitation is the short period; a further weakness is the lack of a control group.'),
        async () => (await page.$$('#stDoc .st-sug')).length >= 2 && /Suggested label/.test(await page.textContent('#stNavList')) && (await doc()).blocks.every(b => b.kind === 'p'), 'without headings, parts get suggested labels — outside the text, which stays unchanged'],
      ['a table', P('Evaluation table', 'Criterion | Rating | Comment\nSampling | Weak | Twenty students\nData | Strong | Drafts and interviews'),
        async () => (await shown()).some(t => /Sampling \| Weak \| Twenty students/.test(t)), 'table rows are kept as written'],
      ['a long paragraph', P('Discussion', long),
        async () => (await shown())[0] === long, 'a 2,000-word paragraph is kept whole'],
      ['Arabic', P('الملخص\nتتناول هذه الدراسة استخدام التغذية الراجعة في الكتابة.', 'المنهجية\nاستخدم الباحثون استبانة ومقابلات مع عشرين طالبًا.'),
        async () => { const t = await navTitles(); const dir = await page.$eval('#stDoc .st-p', e => getComputedStyle(e).direction); return t[0] === 'الملخص' && dir === 'rtl'; }, 'Arabic headings are navigator titles and Arabic text reads right to left'],
      ['mixed English and Arabic', P('Summary — الملخص\nThe study examines feedback. وتوضح الدراسة أن الطلاب استفادوا من التعليقات.', 'Limitations\nThe sample is small (عينة صغيرة).'),
        async () => (await navTitles()).length === 2 && (await shown()).some(t => /وتوضح الدراسة/.test(t)), 'mixed English and Arabic is kept and navigable']];
    for (const [name, text, test, good] of FORMATS){
      await click('[data-act="st-new"]'); await click('[data-act="st-paste"]');
      await page.fill('#stPasteName', 'Format: ' + name); await page.fill('#stPasteText', text);
      await page.click('#dlgForm button[type=submit]'); await page.waitForTimeout(450);
      const dd = await doc(), sh = await shown();
      check(dd.blocks.filter(b => b.kind === 'p').every((b, i) => sh[i] === b.text), `${name}: every paragraph is shown word for word`);
      const nt = await navTitles();
      check(nt.length > 0 && nt.every(x => !/^\s*\d+\s*%|\|\s*max/i.test(x)), `${name}: no percentage or word limit is used as a title`, `${name}: titles ${JSON.stringify(nt)}`);
      check(await test(), `${name}: ${good}`, `${name}: ${good} — titles ${JSON.stringify(await navTitles())}`);
    }
    errs.length ? errs.forEach(e => fail('page error: ' + e)) : ok('no page errors');
    const unexpected = alerts.filter(a => !/mostly repeated/.test(a));
    unexpected.length ? unexpected.forEach(a => fail('unexpected alert: ' + a)) : ok('no unexpected alerts');
    const saved = await S();
    await ctx.close();

    console.log('Layout');
    for (const scheme of ['light', 'dark']) for (const w of [1440, 1280, 1024, 390]){
      const c2 = await browser.newContext({viewport:{width:w, height:860}, colorScheme:scheme});
      await c2.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
      await c2.addInitScript(st => { if (!sessionStorage.getItem('seeded')){ localStorage.setItem('scholarpath.v1', JSON.stringify(st)); sessionStorage.setItem('seeded', '1'); } }, saved);
      const p2 = await c2.newPage(), e2 = []; p2.on('pageerror', e => e2.push(e.message));
      await p2.goto(BASE + 'index.html#critiquing/3'); await p2.waitForTimeout(400);
      const studio = await p2.isVisible('#panel-studio');
      const o = await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      check(studio && o <= 1 && !e2.length, `${w}px ${scheme}: the studio fits without sideways scrolling`, `${w}px ${scheme}: studio ${studio}, overflow ${o}, errors ${e2.join('; ')}`);
      if (process.env.SHOTS){ await p2.evaluate(() => document.querySelector('.st-ws')?.scrollIntoView()); await p2.waitForTimeout(150); await p2.screenshot({path:`${process.env.SHOTS}/studio-${w}-${scheme}.png`}); }
      if (w === 390 || w === 1024){ const n = await p2.$$eval('#stDocSel option', o => o.length); let worst = 0;
        for (let i = 0; i < n; i++){ await p2.selectOption('#stDocSel', {index:i}); await p2.waitForTimeout(150);
          for (const pane of w === 390 ? ['nav', 'doc', 'study'] : ['doc']){ if (w === 390) await p2.click(`.st-panesw [data-v="${pane}"]`); worst = Math.max(worst, await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); } }
        check(worst <= 1 && !e2.length, `${w}px ${scheme}: all ${n} critique formats fit without sideways scrolling`, `${w}px ${scheme}: overflow ${worst}`);
        await p2.selectOption('#stDocSel', {index:n - 1}); await p2.waitForTimeout(150); }
      if (w === 390){ await p2.click('.st-panesw [data-v="study"]'); await p2.waitForTimeout(200);
        check(await p2.isVisible('#stAssist') && !(await p2.isVisible('.st-docpane')), '390px: the study assistant opens as its own pane');
        if (process.env.SHOTS) await p2.screenshot({path:`${process.env.SHOTS}/studio-390-${scheme}-study.png`}); }
      await c2.close();
    }
  } finally { await browser.close(); server.kill(); }
  console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll studio checks passed');
  process.exit(problems.length ? 1 : 0);
})();
