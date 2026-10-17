// Presentation Studio check (step 3.1) — run from the repository folder:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers NODE_PATH=$(npm root -g) node tests/presentation-check.js
// Two research topics (the AI example critique and a pasted education critique). Claude requests go through the
// copy-prompt bridge with prepared replies — including an invented figure and invented quotations, which must be rejected.
// The downloaded .pptx files are opened and inspected.
const {chromium} = require('playwright');
const {spawn, execSync} = require('child_process');
const path = require('path'), fs = require('fs'), os = require('os');

const ROOT = path.resolve(__dirname, '..'), PORT = 8785, BASE = `http://127.0.0.1:${PORT}/`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-pres-'));
const problems = [];
const fail = m => { problems.push(m); console.log('  FAIL ' + m); };
const ok = m => console.log('  ok   ' + m);
const check = (c, good, bad) => c ? ok(good) : fail(bad || good);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const unzip = (file, inner) => execSync(`unzip -p "${file}" "${inner}"`, {maxBuffer:64e6}).toString();
const slidesXml = file => execSync(`unzip -l "${file}"`).toString().match(/ppt\/slides\/slide\d+\.xml/g).sort((a, b) => +a.match(/\d+/)[0] - +b.match(/\d+/)[0]).map(n => unzip(file, n));

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd:ROOT, stdio:'ignore'});
  await sleep(800);
  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({viewport:{width:1440, height:1000}, acceptDownloads:true});
    await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
    const page = await ctx.newPage(), errs = [], alerts = [];
    page.on('pageerror', e => errs.push(String(e.message || e)));
    page.on('dialog', d => { alerts.push(d.message()); d.accept(); });
    const S = () => page.evaluate(() => JSON.parse(localStorage.getItem('scholarpath.v1')));
    const act = (a, data = {}) => page.evaluate(([a, d]) => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, d); b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }, [a, data]);
    const stage = async v => { await act('ps-stage', {v}); await page.waitForTimeout(300); };
    const bridge = async (reply, expect) => {
      await page.waitForSelector('#aiBridge[open]', {timeout:5000});
      const prompt = await page.$eval('#aiBridge pre', e => e.textContent);
      if (expect) check(expect.test(prompt), `the prompt ${expect}`, `the prompt does not match ${expect}`);
      await page.fill('#aib-reply', JSON.stringify(reply)); await page.click('#aiBridge button[type=submit]'); await page.waitForTimeout(500);
      return prompt;
    };
    const download = async (file) => { const dl = page.waitForEvent('download', {timeout:30000}); await act('pres-pptx'); const d = await dl; const f = path.join(TMP, file); await d.saveAs(f); return f; };

    // a paper with one extracted figure (a real PNG in IndexedDB), set up before the app starts
    await page.goto(BASE + 'about.html');
    await page.evaluate(async () => {
      const c = document.createElement('canvas'); c.width = 400; c.height = 300; const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, 400, 300); g.fillStyle = '#1565c0'; g.fillRect(40, 120, 80, 150); g.fillRect(160, 60, 80, 210); g.fillStyle = '#000'; g.font = '20px sans-serif'; g.fillText('Example bars', 120, 30);
      const blob = await new Promise(r => c.toBlob(r, 'image/png'));
      await new Promise((res, rej) => { const q = indexedDB.open('scholarpath', 1); q.onupgradeneeded = () => q.result.createObjectStore('img'); q.onsuccess = () => { const t = q.result.transaction('img', 'readwrite'); t.objectStore('img').put(blob, 'tp1:f1:crop'); t.oncomplete = res; t.onerror = rej; }; q.onerror = rej; });
    });
    await page.goto(BASE + 'index.html#presenting/1'); await page.waitForTimeout(600);
    await page.goto(BASE + 'about.html');
    await page.evaluate(() => { const S = JSON.parse(localStorage.getItem('scholarpath.v1'));
      S.reader.papers.push({id:'tp1', title:'Gender Shades test copy', name:'test.pdf', pages:[], seq:3, added:Date.now(), paras:[
        {id:'p1', kind:'text', section:'Results', page:5, text:'All three classifiers performed worst on darker-skinned females, with error rates of up to 34.7%.', idea:'', src:'', terms:[], mine:'', link:{to:'', rel:''}},
        {id:'f1', kind:'figure', label:'Fig. 2', figKind:'fig', section:'Results', page:5, caption:'Fig. 2. Classifier error rates by gender and skin type subgroup (illustrative test figure).', text:'Fig. 2. Classifier error rates by gender and skin type subgroup.', img:true, mentions:[], link:{to:'', rel:''}}]});
      localStorage.setItem('scholarpath.v1', JSON.stringify(S)); });
    await page.goto(BASE + 'index.html#presenting/1'); await page.waitForTimeout(600);

    console.log('The ten steps');
    const steps = await page.$$eval('.ps-steps button', b => b.map(x => x.textContent.replace(/\d+/, '').trim()));
    check(steps.join('|') === 'Documents|Customize|Three designs|Select & refine|Slide outline|Research figures|Generate|Preview & edit|Quality review|Export', 'all ten steps are shown in order', steps.join('|'));
    await stage('docs');
    check(await page.$('#presSrc') && await page.$('#psPaper'), 'step 1: the critique source and the paper (for figures and accuracy)');
    await page.selectOption('#psPaper', 'r:tp1'); await page.waitForTimeout(300);
    await stage('outline'); await act('pres-sections'); await page.waitForTimeout(400);
    check(((await S()).pres.outlines || {})['crit:ex-crit-aau'], 'an outline from the critique exists');

    console.log('Customize: settings change the output');
    await stage('custom');
    await page.selectOption('select[data-psd="count"]', '7'); await page.waitForTimeout(200);
    await page.check('input[name="ps-detail"][value="concise"]'); await page.waitForTimeout(200);
    await page.check('input[name="ps-lang"][value="ar"]'); await page.waitForTimeout(200);
    await stage('outline');
    await act('pres-ai'); const prompt1 = await bridge({title:'x', slides:[]}, /Exactly 7 slides/);
    check(/2–3 bullets per slide, each under 12 words/.test(prompt1), 'detail level “concise” changes the outline rules');
    check(/Modern Standard Arabic/.test(prompt1), 'the presentation language goes into the outline');
    await stage('custom'); await page.selectOption('select[data-psd="count"]', 'auto'); await page.check('input[name="ps-detail"][value="standard"]'); await page.check('input[name="ps-lang"][value="en"]'); await page.waitForTimeout(200);

    console.log('Three design proposals');
    await stage('designs');
    const cards = await page.$$('.ps-dcard'); check(cards.length === 3, 'three design proposals');
    const sigs = await page.$$eval('.ps-dcard', cs => cs.map(c => [...c.querySelectorAll('.ps-s')].map(s => [...s.querySelectorAll('.ps-e')].map(e => e.style.left.split('.')[0] + ',' + e.style.top.split('.')[0]).join(';')).join('||')));
    check(new Set(sigs).size === 3, 'the three designs have different compositions (element positions differ), not only colours');
    const fonts = await page.$$eval('.ps-dcard', cs => cs.map(c => [...new Set([...c.querySelectorAll('.ps-t')].map(e => getComputedStyle(e).fontFamily.split(',')[0]))].sort().join('+')));
    check(new Set(fonts).size === 3, `different typography: ${fonts.join(' / ')}`);
    check(await page.$$eval('.ps-dcard .ps-sw', s => s.length) === 3 && /AI & computing/.test(await page.textContent('#panel-present')), 'palettes and typography are shown; tuned to the topic (AI & computing)');
    await act('ps-style', {v:'elegant'}); await page.waitForTimeout(300);
    check((await S()).pres.ds.style === 'elegant' && /Academic Elegant — refine it/.test(await page.textContent('#panel-present')), 'choosing a design opens “Select & refine”');

    console.log('Refine: colours, fonts, theme');
    await page.selectOption('select[data-psd="fonts"]', 'cambria'); await page.waitForTimeout(200);
    await page.evaluate(() => { const i = document.querySelector('input[data-psd="accent"]'); i.value = '#f2f2f2'; i.dispatchEvent(new Event('change', {bubbles:true})); }); await page.waitForTimeout(300);
    check((await S()).pres.ds.theme === 'custom', 'picking a colour switches to custom colours');
    check(/hard to read with these colours/.test(await page.textContent('#panel-present')), 'an unreadable custom colour is caught by the measured contrast check');
    await act('ps-reset-colours'); await page.waitForTimeout(450);
    check((await S()).pres.ds.theme === 'auto', 'back to the design’s colours');

    console.log('Figure Intelligence and diagrams');
    await stage('figures');
    check(await page.$$eval('.ps-fig img[data-pskey]', i => i.length) === 1, 'the paper’s figure is listed with its thumbnail');
    check(/Fig\. 2/.test(await page.textContent('.ps-figs')) && /page 5/.test(await page.textContent('.ps-figs')), 'with its original number and page');
    await act('ps-fig-ai');
    await bridge({figures:[{id:'tp1:f1', include:true, slide:6, why:'Shows the subgroup error rates discussed on this slide.'}, {id:'made-up-figure', include:true, slide:2, why:'invented'}]}, /shown exactly as published/);
    let st = await S(), fi = st.pres.figs['crit:ex-crit-aau'].items;
    check(fi['tp1:f1'] && fi['tp1:f1'].inc && fi['tp1:f1'].slide === 6 && !fi['made-up-figure'], 'the real figure is recommended for slide 6; an invented figure is ignored');
    await act('ps-diag-ai');
    await bridge({diagrams:[{type:'framework', title:'What future research should do', slide:7, items:[
      {label:'Unconstrained images', detail:'Repeat the audit on real-world images', quote:'the audit should be repeated on unconstrained real-world images'},
      {label:'Benchmark design', detail:'Datasets that balance phenotypes', quote:'this sentence does not appear anywhere in the critique'},
      {label:'Report subgroups', detail:'Disaggregated reporting', quote:'disaggregated reporting'}]}]}, /ONLY from what the critique says/);
    st = await S(); const dg = st.pres.diags['crit:ex-crit-aau'].list;
    check(dg.length === 1 && dg[0].items.length === 2 && !dg[0].items.some(x => /Benchmark design/.test(x.label)), 'diagram points without the critique’s exact words are dropped');

    console.log('Generate and preview');
    await stage('generate'); await act('ps-gen'); await page.waitForTimeout(500);
    const kinds = await page.$$eval('.ps-preview .ps-pv', p => p.length);
    const deckN = (await S()).pres.outlines['crit:ex-crit-aau'].slides.length;
    check(kinds === deckN + 2, `preview: ${deckN} outline slides + 1 figure + 1 diagram`, `preview has ${kinds} slides`);
    await page.waitForTimeout(500);
    check(await page.$$eval('.ps-preview .ps-img.has img', i => i.length) === 1, 'the figure slide shows the original picture');
    check(/reproduced as published/.test(await page.textContent('.ps-preview')), 'with its caption and source');

    console.log('Quality review');
    await stage('outline'); await act('pres-add'); await page.waitForTimeout(300);
    const ta = await page.$('textarea[data-ps="bullets"]'); await ta.fill(['First point about sampling', 'Second point about the data', 'Third point about the method', 'Fourth point about validity', 'Fifth point about results', 'Sixth point about ethics', 'Seventh point about future work'].join('\n'));
    await ta.dispatchEvent('input'); await act('pres-done'); await page.waitForTimeout(400);
    await stage('quality');
    let q = await page.textContent('#panel-present');
    const score = +(await page.textContent('.ps-n'));
    check(score > 0 && score <= 100 && /points that could be checked/.test(q), `a score from checks: ${score}/100`);
    check(/Numbers on the slides are in the original paper/.test(q), 'with the paper added, numbers are checked against the paper');
    check(/Not run yet/.test(q), 'Claude’s check is “not verified” until it is run');
    await act('ps-check');
    const deck = (await S()).pres.outlines['crit:ex-crit-aau'].slides;
    const real = deck[2].bullets[0].split(' ').slice(0, 6).join(' ');
    await bridge({issues:[{slide:3, slideQuote:real, source:'critique', problem:'Test problem with real quotations', sourceQuote:'commercial'}, {slide:3, slideQuote:'words that are not on the slide', source:'critique', problem:'invented', sourceQuote:'commercial'}], missing:[]}, /academic accuracy/);
    q = await page.textContent('#panel-present');
    check(/Test problem with real quotations/.test(q) && !/invented/.test(q), 'only problems with real quotations are reported');
    check(/Claude’s check against the critique and the paper/.test(q), 'Claude’s check now counts');
    const splitBtn = await page.$('[data-act="ps-fix"][data-k^="split:"]');
    if (splitBtn){ const k = await splitBtn.getAttribute('data-k'), i = +k.split(':')[1], before = (await S()).pres.outlines['crit:ex-crit-aau'].slides[i];
      await splitBtn.click(); await page.waitForTimeout(200); check(await page.isVisible('#dlg[open]'), 'Improve My Presentation asks before changing anything'); await page.click('#dlgForm button[type=submit]'); await page.waitForTimeout(300);
      const after = (await S()).pres.outlines['crit:ex-crit-aau'].slides; check(JSON.stringify([...after[i].bullets, ...after[i + 1].bullets]) === JSON.stringify(before.bullets), 'splitting a crowded slide keeps every word');
    } else fail('the crowded slide was not offered for splitting');

    console.log('Export');
    await stage('export');
    check(/not connected to Canva/.test(await page.textContent('#panel-present')) && !(await page.$('[data-act*="canva"]')), 'Canva: an honest import workflow, no fake connection button');
    const f1 = await download('elegant.pptx'), x1 = slidesXml(f1);
    check(x1.length === kinds + (splitBtn ? 2 : 1), `the PowerPoint has every slide (${x1.length})`);
    check(x1.some(x => /<p:pic>/.test(x)), 'the figure is in the PowerPoint as the original picture');
    check(x1.some(x => /typeface="Cambria"/.test(x)), 'the chosen fonts (Cambria + Calibri) are used');
    check(/FAF7F0/i.test(x1[1]) && /1B2A4A|14213D/i.test(x1[0]), 'the chosen design’s colours are used');
    const notes = execSync(`unzip -l "${f1}"`).toString().match(/notesSlide\d+\.xml/g) || [];
    check(notes.length >= deckN, 'speaker notes are included');
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
    await act('ps-print'); await page.waitForTimeout(1200);
    check(await page.evaluate(() => window.__printed === 1 && document.querySelectorAll('#psPrint .ps-s').length), 'PDF: every slide is laid out on its own page for printing');

    console.log('A second topic and design: education, Creative Professional, dark, no notes');
    await stage('docs');
    await act('pres-paste'); await page.fill('#dlgForm textarea', 'Summary\nThe study followed 40 teachers using peer feedback in primary school classrooms.\n\nMethod\nThe researchers observed lessons and interviewed teachers about student learning.\n\nStrengths\nThe classroom observations give rich detail about learning.\n\nLimitations\nOnly one school took part, so the findings may not apply to other students.');
    await page.click('#dlgForm button[type=submit]'); await page.waitForTimeout(500);
    if (await page.$('#aiBridge[open]')) await bridge({title:'Peer feedback in primary classrooms', slides:[{title:'Peer feedback in primary classrooms', bullets:['A critique'], notes:'', seconds:60, source:'Summary'}, {title:'What the study did', bullets:['40 teachers used peer feedback', 'Lessons were observed', 'Teachers were interviewed'], notes:'', seconds:180, source:'Method'}, {title:'Strengths and limitations', bullets:['Strength: rich classroom detail', 'Weakness: only one school'], notes:'', seconds:300, source:'Limitations'}, {title:'Questions', bullets:['Thank you — questions?'], notes:'', seconds:60, source:''}]});
    await stage('custom'); await page.check('input[name="ps-theme"][value="dark"]'); await page.check('input[name="ps-notes"][value="false"]'); await page.waitForTimeout(200);
    await stage('designs');
    check(/Education/.test(await page.textContent('#panel-present')), 'the second critique is recognised as Education');
    await act('ps-style', {v:'creative'}); await page.waitForTimeout(300);
    const f2 = await download('creative.pptx'), x2 = slidesXml(f2);
    check(x2.some(x => /typeface="Trebuchet MS"/.test(x)), 'Creative Professional uses its own typography');
    check(/1C1917/i.test(x2[1]), 'the dark theme is used');
    const n2 = (execSync(`unzip -l "${f2}"`).toString().match(/ppt\/notesSlides\/notesSlide\d+\.xml/g) || []).map(n => unzip(f2, n)).join('');
    check(!/Time: about|From:/.test(n2), 'no speaker notes when they are switched off');
    check(x1.join('').length !== x2.join('').length && !x2.some(x => /typeface="Cambria"/.test(x)), 'the two topics and designs give genuinely different presentations');

    errs.length ? errs.forEach(e => fail('page error: ' + e)) : ok('no page errors');
    const bad = alerts.filter(a => !/Replace the current outline|Delete|Apply|Remove/.test(a)); bad.length ? bad.forEach(a => fail('unexpected alert: ' + a)) : ok('no unexpected alerts');
    await ctx.close();

    console.log('Layout');
    for (const scheme of ['light', 'dark']) for (const w of [1440, 1024, 390]){
      const c2 = await browser.newContext({viewport:{width:w, height:900}, colorScheme:scheme}); await c2.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
      const p2 = await c2.newPage(), e2 = []; p2.on('pageerror', e => e2.push(e.message));
      await p2.goto(BASE + 'index.html#presenting/1'); await p2.waitForTimeout(400); let worst = 0;
      for (const v of ['docs', 'custom', 'designs', 'refine', 'outline', 'figures', 'generate', 'preview', 'quality', 'export']){
        await p2.evaluate(v => { const b = document.createElement('button'); b.dataset.act = 'ps-stage'; b.dataset.v = v; document.body.appendChild(b); b.click(); b.remove(); }, v); await p2.waitForTimeout(150);
        worst = Math.max(worst, await p2.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)); }
      check(worst <= 1 && !e2.length, `${w}px ${scheme}: all ten steps fit without sideways scrolling`, `${w}px ${scheme}: overflow ${worst}, errors ${e2.join('; ')}`);
      await c2.close();
    }
  } finally { await browser.close(); server.kill(); }
  console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll presentation checks passed');
  process.exit(problems.length ? 1 : 0);
})();
