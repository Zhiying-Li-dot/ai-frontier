import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { chromium } from 'playwright';
let browser, server, base, fixture;
before(async () => {
  const root = resolve('dist');
  fixture = JSON.parse(await readFile('dist/data/research.json','utf8'));
  fixture.pending = Array.from({length: 61}, (_, i) => ({
    id: `synthetic-${i}`, title: i === 60 ? 'Memory retrieval sample' : `Agent tool sample ${i}`,
    sourceName: '合成测试来源', category: 'capabilities', type: 'paper', status: 'awaiting-fulltext',
    publishedAt: fixture.updatedAt, sourceUrl: `https://arxiv.org/abs/2601.${String(i).padStart(5,'0')}`,
  }));
  server = createServer(async (req,res) => {
    try {
      const path = resolve(root, '.' + new URL(req.url,'http://localhost').pathname.replace(/\/$/,'/index.html'));
      if (!path.startsWith(root + sep)) { res.writeHead(403).end(); return; }
      res.setHeader('Content-Type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)] || 'application/octet-stream');
      res.end(await readFile(path));
    } catch { res.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0,'127.0.0.1',resolve));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({channel:process.env.FRONTIER_BROWSER_CHANNEL});
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });
async function pageFor(t, mobile = false) {
  const page = await browser.newPage({viewport: mobile ? {width:390,height:844} : {width:1440,height:1000}});
  page.setDefaultTimeout(4000);
  t.after(() => page.close());
  await page.route('**/data/research.json',route => route.fulfill({json:fixture}));
  await page.goto(base);
  return page;
}
test('观察台主题可筛选，候选能加载更多，搜索改变后重置且空结果有提示', async t => {
  const page = await pageFor(t);
  await page.getByRole('heading',{name:/前沿正在\s*发生什么？/}).waitFor();
  await page.getByRole('button',{name:'探索主题：Agent 与工具'}).click();
  assert.equal(await page.locator('.pending-entry').count(),20);
  await page.getByRole('button',{name:'加载更多线索'}).click();
  assert.equal(await page.locator('.pending-entry').count(),40);
  await page.getByLabel('搜索研究').fill('sample 1');
  await page.getByText('当前显示 11 / 11 条').waitFor();
  assert.equal(await page.locator('.pending-entry').count(),11);
  await page.getByLabel('搜索研究').fill('sample');
  await page.getByText('当前显示 20 / 60 条').waitFor();
  assert.equal(await page.locator('.pending-entry').count(),20);
  await page.getByLabel('搜索研究').fill('zz-no-match');
  await page.getByText('暂无符合当前筛选条件的新候选。').waitFor();
  await page.getByRole('button',{name:'重置筛选'}).click();
  assert.equal(await page.getByLabel('搜索研究').inputValue(),'');
  assert.equal(await page.locator('.pending-entry').count(),20);
});
test('手机主题入口支持键盘且页面不横向溢出', async t => {
  const page = await pageFor(t,true);
  const topic = page.getByRole('button',{name:'探索主题：记忆与知识'});
  await topic.focus(); await page.keyboard.press('Enter');
  await page.getByText('当前显示 1 / 1 条').waitFor();
  assert.equal(await topic.getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.pending-entry').count(),1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),true);
});
test('已核查研究直达链接仍可打开原文证据', async t => {
  const page = await pageFor(t);
  await page.goto(`${base}/?paper=arxiv-2610-28909-v1`);
  await page.locator('.reader-title').waitFor();
  assert.match(await page.locator('.reader-title').innerText(),/DiffResearch/);
  await page.getByRole('tab',{name:'原文证据',exact:true}).click();
  assert.ok(await page.locator('.evidence-card').count() >= 5);
});
