'use strict';

// Executes the complete app/core scripts against a small DOM/event adapter.
// These are logic/security regression tests, not layout/browser/offline tests.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createDom } = require('./dom-stub.cjs');
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const core = fs.readFileSync(path.join(root, 'core.js'), 'utf8');
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const KEY = 'bank-quiz-v2-records', CUSTOM = 'bank-quiz-v2-custom', SESSION = 'bank-quiz-v2-session';

function question(id, overrides = {}) {
  return {
    id, subject: 'law', chapter: '基础知识', type: 'single', question: '回归测试题 ' + id,
    options: ['错误选项', '正确选项', '另外选项'], answer: [1], explanation: '答案解析 ' + id,
    source: { kind: 'original', title: '测试题', url: '', note: '不是真题', verifiedAt: '2026-09-20' },
    tags: [], difficulty: 1, ...overrides
  };
}
const questions = [
  question('single'),
  question('multiple', { subject: 'finance', chapter: '理财基础', type: 'multiple', answer: [0, 2] }),
  question('boolean', { type: 'boolean', options: ['正确', '错误'], answer: [1] })
];
function boot(options = {}) {
  const dom = createDom(html, options);
  dom.run(core);
  dom.run('window.BANK_DATA = ' + JSON.stringify({ version: 'test', questions, resources: [] }));
  dom.run(app);
  assert.equal(dom.errors.length, 0, dom.errors.map(e => e.stack || String(e)).join('\n'));
  assert.doesNotMatch(dom.get('question-card').textContent, /题库载入失败/);
  return dom;
}
const records = dom => JSON.parse(dom.storage.get(KEY) || '{"records":{}}').records;
const counts = (attempts, correct, lastCorrect, favorite = false) => ({ attempts, correct, wrong: attempts - correct, lastCorrect, favorite });

test('first visit with no custom questions does not announce corrupt local data', () => {
  const dom = boot();
  assert.doesNotMatch(dom.get('toast').textContent, /异常|失败/);
  assert.match(dom.get('queue-label').textContent, /第 1 \/ 3 题/);
  assert.equal(dom.get('total-bank').textContent, 3);
});

test('full app submit/next handlers distinguish single, incomplete multiple, and boolean answers', () => {
  const dom = boot();
  dom.get('submit-btn').click();
  assert.deepEqual(records(dom), {});
  assert.match(dom.get('toast').textContent, /请先选择/);
  dom.pick(1); dom.get('submit-btn').click();
  assert.deepEqual(records(dom).single, counts(1, 1, true));
  dom.get('submit-btn').click(); // No double-counting through an accidental second activation.
  assert.equal(records(dom).single.attempts, 1);
  dom.get('next-btn').click(); dom.pick(0); dom.get('submit-btn').click();
  assert.deepEqual(records(dom).multiple, counts(1, 0, false));
  assert.match(dom.get('explanation').innerHTML, /记住这个知识点/);
  dom.get('next-btn').click(); dom.pick(1); dom.get('submit-btn').click();
  assert.deepEqual(records(dom).boolean, counts(1, 1, true));
  assert.equal(dom.get('total-accuracy').textContent, '67%');
});

test('wrong-answer correction removes current wrong status, while favorites/history survive reload', () => {
  const dom = boot();
  dom.get('favorite-btn').click();
  assert.deepEqual(records(dom).single, counts(0, 0, null, true));
  dom.pick(0); dom.get('submit-btn').click();
  assert.equal(dom.get('nav-wrong').textContent, 1);
  dom.navigate('wrong'); dom.pick(1); dom.get('submit-btn').click();
  assert.deepEqual(records(dom).single, counts(2, 1, true, true));
  assert.equal(dom.get('nav-wrong').textContent, '');
  const refreshed = boot({ storage: dom.storage });
  assert.equal(refreshed.get('nav-favorite').textContent, 1);
  assert.equal(refreshed.get('nav-wrong').textContent, '');
  assert.match(refreshed.get('explanation').innerHTML, /回答正确/);
});

test('reload restores question position and previous submissions without counting them again', () => {
  const dom = boot();
  dom.pick(1); dom.get('submit-btn').click(); dom.get('next-btn').click();
  const refreshed = boot({ storage: dom.storage });
  assert.match(refreshed.get('queue-label').textContent, /第 2 \/ 3 题/);
  assert.deepEqual(records(refreshed).single, counts(1, 1, true));
  refreshed.get('previous-btn').click();
  assert.match(refreshed.get('explanation').innerHTML, /回答正确/);
  assert.equal(refreshed.get('submit-btn').hidden, true);
  assert.equal(records(refreshed).single.attempts, 1);
});

test('viewing statistics and returning to the active practice does not silently restart it', () => {
  const dom = boot();
  dom.pick(1); dom.get('submit-btn').click(); dom.get('next-btn').click();
  dom.navigate('stats'); dom.navigate('practice');
  assert.match(dom.get('queue-label').textContent, /第 2 \/ 3 题/);
  assert.equal(dom.get('session-score').textContent, '本轮 1 / 1 正确');
  dom.get('previous-btn').click();
  assert.match(dom.get('explanation').innerHTML, /回答正确/);
});

test('an unsubmitted multiple-answer draft survives a refresh without counting as an attempt', () => {
  const dom = boot();
  dom.pick(1); dom.get('submit-btn').click(); dom.get('next-btn').click();
  dom.pick(0); dom.pick(2);
  const refreshed = boot({ storage: dom.storage });
  assert.match(refreshed.get('queue-label').textContent, /第 2 \/ 3 题/);
  const selected = refreshed.document.querySelectorAll('[data-option]').filter(node => node.classList.contains('selected')).map(node => node.dataset.option);
  assert.deepEqual(selected, ['0', '2']);
  assert.equal(records(refreshed).multiple, undefined);
  refreshed.get('submit-btn').click();
  assert.deepEqual(records(refreshed).multiple, counts(1, 1, true));
});

test('exported progress with an empty custom bank can be imported on another device', async () => {
  const dom = boot(); dom.pick(1); dom.get('submit-btn').click();
  dom.get('export-progress').click();
  assert.equal(dom.downloads.length, 1);
  const exported = JSON.parse(await dom.blobUrls.get(dom.downloads[0].href).text());
  assert.equal(exported.version, 1); assert.deepEqual(exported.customQuestions, []);
  const otherDevice = boot();
  await otherDevice.importFile('import-progress', exported);
  assert.doesNotMatch(otherDevice.get('toast').textContent, /失败/);
  assert.deepEqual(records(otherDevice).single, counts(1, 1, true));
});

test('custom bank + progress export round-trips without publishing or discarding sources', async () => {
  const dom = boot();
  const custom = question('custom', { source: { kind: 'publication', title: '读者自行导入的练习', url: 'https://example.org/official', note: '第4页；个人持有', verifiedAt: '', year: '2026', location: '第4页' } });
  await dom.importFile('import-bank', [custom]);
  assert.match(dom.get('toast').textContent, /已导入 1 题/);
  assert.equal(JSON.parse(dom.storage.get(CUSTOM))[0].source.location, '第4页');
  dom.pick(1); dom.get('submit-btn').click(); // Publication priority puts custom question first.
  assert.deepEqual(records(dom).custom, counts(1, 1, true));
  dom.get('export-progress').click();
  const exported = JSON.parse(await dom.blobUrls.get(dom.downloads[0].href).text());
  const otherDevice = boot(); await otherDevice.importFile('import-progress', exported);
  assert.equal(otherDevice.get('total-bank').textContent, 4);
  assert.deepEqual(records(otherDevice).custom, counts(1, 1, true));
  assert.equal(JSON.parse(otherDevice.storage.get(CUSTOM))[0].source.year, '2026');
});

test('malformed import is transactional and preserves previous questions and attempts', async () => {
  const dom = boot(); dom.pick(0); dom.get('submit-btn').click();
  const before = new Map(dom.storage);
  await dom.importFile('import-bank', [question('single')]);
  assert.match(dom.get('toast').textContent, /导入失败/);
  assert.deepEqual(dom.storage, before);
  await dom.importFile('import-progress', { version: 1, customQuestions: [question('valid-new')], records: { single: { ...counts(1, 1, true), wrong: 20 } } });
  assert.match(dom.get('toast').textContent, /导入失败/);
  assert.deepEqual(dom.storage, before);
});

test('a failed persistent bank write never ends with an unqualified saved-success notification', async () => {
  const dom = boot({ failWrite: true });
  await dom.importFile('import-bank', [question('new-not-saved')]);
  assert.equal(dom.storage.has(CUSTOM), false);
  assert.match(dom.get('toast').textContent, /失败|未保存|未成功|临时|本次会话|关闭.*丢失/);
});

test('a failed persistent progress write is not presented as completed durable import', async () => {
  const dom = boot({ failWrite: true });
  await dom.importFile('import-progress', { version: 1, customQuestions: [], records: { single: counts(1, 1, true) } });
  assert.equal(dom.storage.has(KEY), false);
  assert.match(dom.get('toast').textContent, /失败|未保存|未成功|临时|本次会话|关闭.*丢失/);
});

test('untrusted imported question/source strings are escaped in every exercised HTML sink', async () => {
  const dom = boot();
  const payload = '<img src=x onerror="globalThis.pwned=1">';
  const custom = question('xss-test', {
    question: payload + '题干', chapter: payload + '章节', options: [payload + '甲', payload + '乙'],
    explanation: payload + '解释', source: { kind: 'publication', title: payload + '书名', url: 'https://example.org/?q=%22test', note: payload + '说明', verifiedAt: '' }
  });
  await dom.importFile('import-bank', [custom]);
  assert.match(dom.get('question-card').innerHTML, /&lt;img/);
  assert.doesNotMatch(dom.get('question-card').innerHTML, /<img\b/);
  assert.doesNotMatch(dom.get('chapter').innerHTML, /<img\b/);
  dom.pick(1); dom.get('submit-btn').click();
  assert.match(dom.get('explanation').innerHTML, /&lt;img/);
  assert.doesNotMatch(dom.get('explanation').innerHTML, /<img\b/);
  assert.match(dom.get('explanation').innerHTML, /rel="noopener noreferrer"/);
  assert.doesNotMatch(dom.get('chapter-stats').innerHTML, /<img\b/);
  const unsafe = question('unsafe-source'); unsafe.source.url = 'javascript:alert(1)';
  await dom.importFile('import-bank', [unsafe]);
  assert.match(dom.get('toast').textContent, /导入失败/);
});

test('Object.prototype-like imported IDs cannot corrupt the active bank or its next reload', async () => {
  for (const id of ['toString', 'valueOf', 'hasOwnProperty']) {
    const dom = boot();
    const incoming = question(id, { source: { kind: 'publication', title: '测试名称边界', url: '', note: '', verifiedAt: '' } });
    await dom.importFile('import-bank', [incoming]);
    const persisted = JSON.parse(dom.storage.get(CUSTOM) || '[]');
    // Either reject before writing, or accept and render correctly. Never leave
    // a seemingly rejected import that makes the saved bank unbootable.
    if (persisted.some(q => q.id === id)) assert.doesNotMatch(dom.get('toast').textContent, /导入失败/);
    const refreshed = boot({ storage: dom.storage });
    assert.doesNotMatch(refreshed.get('question-card').textContent, /题库载入失败/);
  }
});

test('the local attribution page is actually linked instead of rejected by external URL validation', () => {
  const dom = boot(); dom.navigate('library');
  assert.match(dom.get('resource-links').innerHTML, /href="(?:\.\/)?ATTRIBUTION\.html"/);
});

test('session restoration recomputes answer correctness and discards out-of-range selection', () => {
  const storage = new Map([[SESSION, JSON.stringify({ view: 'practice', idx: 0, ids: ['single', 'single', 'unknown'], results: { single: { selected: [99], correct: true } }, filters: {} })]]);
  const dom = boot({ storage });
  assert.equal(dom.get('explanation').hidden, true);
  assert.match(dom.get('queue-label').textContent, /第 1 \/ 1 题/);
  assert.deepEqual(records(dom), {});
  const validButWrong = new Map([[SESSION, JSON.stringify({ view: 'practice', ids: ['single'], idx: 0, results: { single: { selected: [0], correct: true } }, filters: {} })]]);
  const refreshed = boot({ storage: validButWrong });
  assert.match(refreshed.get('explanation').innerHTML, /记住这个知识点/);
  assert.deepEqual(records(refreshed), {});
});
