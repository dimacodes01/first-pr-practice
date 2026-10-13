// ScholarPath website check — run from the repository folder:
//   PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers node tests/site-check.js
// It serves the folder on localhost (like GitHub Pages), opens every step at 1440, 1280, 1024 and 390 px in light and dark,
// and fails on page errors or sideways scrolling. Then it clicks through the copy-prompt bridge (the website's Claude features):
// a JSON reply wrapped in ```json, an invalid reply, Cancel stopping the whole run, and a plain-text Ask Claude answer.
// Outside requests (Google Fonts, CDNs) are blocked so the check is quick and works offline.
const {chromium} = require('playwright');
const {spawn} = require('child_process');
const path = require('path');

const ROOT = path.resolve(__dirname, '..'), PORT = 8765, BASE = `http://127.0.0.1:${PORT}/`;
const ROUTES = ['#start', '#writing/1', '#writing/2', '#writing/3', '#writing/4', '#critiquing/1', '#critiquing/2', '#critiquing/3', '#critiquing/4',
  '#presenting/1', '#presenting/2', '#verifying/1', '#verifying/2', '#progress'];
const WIDTHS = [1440, 1280, 1024, 390];
const problems = [];
const fail = m => { problems.push(m); console.log('  FAIL ' + m); };
const ok = m => console.log('  ok   ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function newPage(browser, width, scheme){
  const ctx = await browser.newContext({viewport:{width, height:900}, colorScheme:scheme});
  await ctx.route('**/*', r => r.request().url().startsWith(BASE) ? r.continue() : r.abort());
  const page = await ctx.newPage(), errs = [];
  page.on('pageerror', e => errs.push(String(e && e.message || e)));
  page.on('dialog', d => { errs.push('alert: ' + d.message()); d.dismiss().catch(() => {}); });
  return {ctx, page, errs};
}
const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

(async () => {
  const server = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], {cwd:ROOT, stdio:'ignore'});
  await sleep(800);
  const browser = await chromium.launch();
  try {
    console.log('Every step, every width, light and dark');
    for (const scheme of ['light', 'dark']) for (const w of WIDTHS){
      const {ctx, page, errs} = await newPage(browser, w, scheme);
      await page.goto(BASE + 'index.html'); await page.waitForTimeout(400);
      for (const r of ROUTES){
        await page.evaluate(h => { location.hash = h; }, r); await page.waitForTimeout(250);
        const o = await overflow(page);
        if (o > 1) fail(`${r} ${w}px ${scheme}: scrolls sideways by ${o}px`);
      }
      if (w === 1280){                                  // the reader again with the sidebar collapsed
        await page.evaluate(() => { location.hash = '#critiquing/1'; }); await page.waitForTimeout(250);
        const t = await page.$('#sideToggle'); if (t){ await t.click(); await page.waitForTimeout(250); const o = await overflow(page); if (o > 1) fail(`reader, sidebar collapsed, ${scheme}: scrolls sideways by ${o}px`); await t.click(); }
      }
      errs.length ? errs.forEach(e => fail(`${w}px ${scheme}: ${e}`)) : ok(`${w}px ${scheme}: ${ROUTES.length} steps, no errors`);
      await ctx.close();
    }

    console.log('Website pages');
    for (const [file, w] of [['about.html', 1280], ['about.html', 390], ['404.html', 390]]){
      const {ctx, page, errs} = await newPage(browser, w, 'light');
      const res = await page.goto(BASE + file);
      const o = await overflow(page);
      if (!res.ok()) fail(`${file}: HTTP ${res.status()}`); else if (o > 1) fail(`${file} ${w}px: scrolls sideways by ${o}px`); else if (errs.length) fail(`${file}: ${errs.join('; ')}`); else ok(`${file} at ${w}px`);
      await ctx.close();
    }
    for (const f of ['assets/icon.svg', 'assets/site.webmanifest', 'assets/icon-192.png', 'assets/social-preview.png', 'robots.txt', '.nojekyll',
      'vendor/pdfjs/pdf.min.js', 'vendor/pdfjs/pdf.worker.min.js', 'vendor/pptxgenjs/pptxgen.bundle.js']){
      const {ctx, page} = await newPage(browser, 800, 'light');
      const res = await page.request.get(BASE + f); res.ok() ? ok(`serves ${f}`) : fail(`${f}: HTTP ${res.status()}`);
      await ctx.close();
    }

    console.log('Copy-prompt bridge (Claude features on the website)');
    {
      const {ctx, page, errs} = await newPage(browser, 1280, 'light');
      await page.goto(BASE + 'index.html#critiquing/1'); await page.waitForTimeout(500);
      const ids = await page.evaluate(() => [...new Set([...document.querySelectorAll('[data-id^="p"]')].map(e => e.dataset.id))]);
      if (!ids.length) fail('no demo paragraphs found in the reader');
      const id = ids[0];
      const press = (act, data={}) => page.evaluate(([a, d]) => { const b = document.createElement('button'); b.dataset.act = a; Object.assign(b.dataset, d); b.hidden = true; document.body.appendChild(b); b.click(); b.remove(); }, [act, data]);

      // 1. JSON reply in a code fence → applied to the paragraph
      await press('rp-ar-one', {id});
      await page.waitForSelector('#aiBridge[open]', {timeout:3000}).then(() => ok('a Claude request opens the bridge window'), () => fail('the bridge window did not open'));
      const prompt = await page.$eval('#aiBridge pre', e => e.textContent);
      prompt.includes(`[${id}]`) && prompt.includes('Reply with the JSON only') ? ok('the prompt holds the paragraph and asks for JSON only') : fail('the prompt is missing the paragraph or the JSON instruction');
      await page.click('#aiBridge button[type=submit]');
      (await page.$eval('#aiBridge .aib-err', e => !e.hidden)) ? ok('an empty reply is refused with a message') : fail('an empty reply was accepted');
      await page.fill('#aib-reply', 'Here it is:\n```json\n[{"id":"zzz-not-a-paragraph","ar":"x"}\n```');
      await page.click('#aiBridge button[type=submit]');
      (await page.$('#aiBridge[open]')) ? ok('a broken reply keeps the window open with a hint') : fail('a broken reply closed the window');
      await page.fill('#aib-reply', '```json\n[{"id":"' + id + '","ar":"نص للاختبار فقط"}]\n```');
      await page.click('#aiBridge button[type=submit]'); await page.waitForTimeout(400);
      const stored = await page.evaluate(i => { const S = JSON.parse(localStorage.getItem('scholarpath.v1')); const pp = S.reader.papers.find(x => x.id === S.reader.active); return (pp.paras.find(x => x.id === i) || {}).ar; }, id);
      stored === 'نص للاختبار فقط' ? ok('the pasted reply was applied and saved') : fail(`the pasted reply was not applied (got ${JSON.stringify(stored)})`);

      // 2. Cancel stops the whole run: no second window (clear the demo's translations first so the run has several requests)
      await page.goto(BASE + 'about.html');            // leave the app first: it saves its state as it closes
      await page.evaluate(() => { const S = JSON.parse(localStorage.getItem('scholarpath.v1')), src = S.reader.papers.find(x => x.id === S.reader.active);
        const copy = JSON.parse(JSON.stringify(src)); copy.id = 'test-copy'; copy.title = 'Test copy (check script)'; delete copy.demo;
        copy.paras.forEach(x => { delete x.ar; delete x.arSrc; }); while (copy.paras.length < 14) copy.paras.push(...JSON.parse(JSON.stringify(copy.paras.filter(x => x.kind !== 'front' && x.kind !== 'figure' && x.kind !== 'caption'))).map((x, i) => ({...x, id:x.id + 'x' + copy.paras.length + i})));
        S.reader.papers.unshift(copy); S.reader.active = copy.id; localStorage.setItem('scholarpath.v1', JSON.stringify(S)); });
      await page.goto(BASE + 'index.html#critiquing/1'); await page.waitForTimeout(500);
      await press('rp-ar-all');
      await page.waitForSelector('#aiBridge[open]', {timeout:3000}).catch(() => {});
      if (await page.$('#aiBridge[open]')){
        await page.click('#aiBridge .dlg-foot [data-aib="cancel"]'); await page.waitForTimeout(700);
        (await page.$('#aiBridge[open]')) ? fail('after Cancel another request opened') : ok('Cancel on request 1 of a several-request run stops the whole run');
      } else ok('(every paragraph already translated — nothing to cancel)');

      // 3. Ask Claude: a plain-text answer (the "explain more deeply" question about one paragraph)
      await press('rp-deeper', {id});
      await page.waitForSelector('#aiBridge[open]', {timeout:3000}).then(() => ok('Ask Claude opens the bridge window'), () => fail('Ask Claude did not open the bridge'));
      if (await page.$('#aiBridge[open]')){
        const cp = await page.$eval('#aiBridge pre', e => e.textContent);
        cp.includes('The student now asks:') ? ok('the chat prompt carries the context and the question') : fail('the chat prompt is missing the question');
        await page.fill('#aib-reply', 'The main point is a test answer.');
        await page.click('#aiBridge button[type=submit]'); await page.waitForTimeout(500);
        const saved = await page.evaluate(i => JSON.stringify(JSON.parse(localStorage.getItem('scholarpath.v1')).reader.papers).includes('The main point is a test answer.'), id);
        saved ? ok('the chat answer is saved with the paragraph') : fail('the chat answer was not saved');
      }
      errs.length ? errs.forEach(e => fail('bridge: ' + e)) : ok('no page errors during the bridge checks');
      await ctx.close();
    }
  } finally { await browser.close(); server.kill(); }
  console.log(problems.length ? `\n${problems.length} problem(s)` : '\nAll checks passed');
  process.exit(problems.length ? 1 : 0);
})();
