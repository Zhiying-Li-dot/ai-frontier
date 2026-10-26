import test from 'node:test';
import assert from 'node:assert/strict';
import { matchesTopic, withinWindow, uniqueMaterials, observe } from '../lib/observatory.ts';
const now = Date.parse('2026-10-26T12:00:00Z');
const item = (id, title = '', publishedAt = '2026-10-26T00:00:00Z') => ({ id, title, publishedAt, sourceUrl: `https://example.org/${id}` });
test('同源去重保留已核查项，arXiv版本与PDF入口合并', () => {
  const ready = {...item('ready'), sourceUrl: 'https://arxiv.org/abs/2610.12345v1'};
  const pending = {...item('pending'), sourceUrl: 'https://arxiv.org/pdf/2610.12345v2.pdf'};
  assert.deepEqual(uniqueMaterials([ready], [pending, item('other'), item('other')]).map(x => x.id), ['ready','other']);
});
test('主题允许多选且无匹配内容归入其他，避免单词片段误匹配', () => {
  assert.equal(matchesTopic(item('a','Agent prompt injection evaluation'), 'agents'), true);
  assert.equal(matchesTopic(item('a','Agent prompt injection evaluation'), 'security'), true);
  assert.equal(matchesTopic(item('a','Agent prompt injection evaluation'), 'evaluation'), true);
  assert.equal(matchesTopic(item('b','Unrelated notes'), 'other'), true);
  assert.equal(matchesTopic(item('c','Surreal imagery'), 'evaluation'), false);
  assert.equal(matchesTopic(item('d',''), 'all'), true);
  assert.equal(matchesTopic({...item('d'), tags:['多模态']}, 'multimodal'), true);
});
test('近期窗口排除未来及无效日期，包含起始边界', () => {
  assert.equal(withinWindow(item('x','','2026-10-23T12:00:00Z'),3,now), true);
  assert.equal(withinWindow(item('x','','2026-10-23T11:59:59Z'),3,now), false);
  assert.equal(withinWindow(item('x','','2026-10-27T00:00:00Z'),7,now), false);
  assert.equal(withinWindow(item('x','','invalid'),7,now), false);
  assert.equal(withinWindow(item('x','','invalid'),0,now), true);
});
test('七天统计按上海日期分桶，近期主题计数不混入旧档案', () => {
  const s = observe([item('old','Agent','2024-01-01')], [item('a','Agent','2026-10-25T16:00:00Z'), item('b','Agent','2026-10-25T15:59:59Z'), item('future','Agent','2026-10-27')], now);
  assert.equal(s.days.length,7);
  assert.deepEqual(s.days.slice(-2).map(d => [d.date,d.count]), [['2026-10-25',1],['2026-10-26',1]]);
  assert.equal(s.topics.find(t => t.id === 'agents').count,2);
  assert.equal(s.entries.length,4);
  assert.equal(observe([],[],now).days.every(d => d.count === 0),true);
});
