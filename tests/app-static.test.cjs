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
  if(options.url) dom.context.location = { href:options.url, protocol:new URL(options.url).protocol, reload:options.reload || (()=>{}) };
  if(options.serviceWorker) dom.context.navigator.serviceWorker=options.serviceWorker;
  dom.run(core);
  dom.run('window.BANK_DATA = ' + JSON.stringify(options.bank || { version: 'test', questions, resources: [] }));
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
  const storage = new Map([[SESSION, JSON.stringify({ bankVersion:'test', view: 'practice', idx: 0, ids: ['single', 'single', 'unknown'], results: { single: { selected: [99], correct: true } }, filters: {} })]]);
  const dom = boot({ storage });
  assert.equal(dom.get('explanation').hidden, true);
  assert.match(dom.get('queue-label').textContent, /第 1 \/ 1 题/);
  assert.deepEqual(records(dom), {});
  const validButWrong = new Map([[SESSION, JSON.stringify({ bankVersion:'test', view: 'practice', ids: ['single'], idx: 0, results: { single: { selected: [0], correct: true } }, filters: {} })]]);
  const refreshed = boot({ storage: validButWrong });
  assert.match(refreshed.get('explanation').innerHTML, /记住这个知识点/);
  assert.deepEqual(records(refreshed), {});
});

const recalled = id => question(id, {
  source:{kind:'recalled',title:'公开发布方 · 回忆试题',url:'https://example.org/recalled',note:'回忆整理，非官方试卷',verifiedAt:'2026-09-20',year:'2024',location:'2024 年 10 月 · 文章第 3 题'}
});
const recalledBank = {version:'test-r2',questions:[...questions,recalled('recall-a'),recalled('recall-b')],resources:[]};

test('recalled shortcut uses live count and clears incompatible filters without losing history', () => {
  const empty = boot(); assert.equal(empty.get('recalled-shortcut').disabled,true);
  assert.match(empty.get('recalled-shortcut').textContent,/0 题/);
  const dom = boot({bank:recalledBank});
  dom.pick(1);dom.get('submit-btn').click();dom.get('favorite-btn').click();
  dom.get('subject').value='finance';dom.get('type').value='multiple';dom.get('unseen').checked=true;
  dom.get('recalled-shortcut').click();
  assert.match(dom.get('recalled-shortcut').textContent,/2 题/);
  assert.match(dom.get('queue-label').textContent,/第 1 \/ 2 题/);
  assert.equal(dom.get('source').value,'recalled');assert.equal(dom.get('subject').value,'all');
  assert.equal(dom.get('type').value,'all');assert.equal(dom.get('unseen').checked,false);
  assert.deepEqual(records(dom)['recall-a'],counts(1,1,true,true));
  assert.equal(dom.get('explanation').hidden,true);
  assert.match(dom.get('question-card').innerHTML,/公开发布方/);
  assert.match(dom.get('question-card').innerHTML,/文章第 3 题/);
  assert.match(dom.get('question-card').innerHTML,/非官方公布试题/);
  assert.match(dom.get('question-card').innerHTML,/href="https:\/\/example.org\/recalled"/);
});

test('recalled deep link is a real filtered session and reload retains position and draft', () => {
  const url='https://example.org/bank/?source=recalled';
  const dom=boot({bank:recalledBank,url});
  assert.match(dom.get('queue-label').textContent,/第 1 \/ 2 题/);
  dom.pick(1);dom.get('submit-btn').click();dom.get('next-btn').click();dom.pick(0);
  const refreshed=boot({bank:recalledBank,url,storage:dom.storage});
  assert.match(refreshed.get('queue-label').textContent,/第 2 \/ 2 题/);
  assert.equal(refreshed.document.querySelectorAll('[data-option]')[0].classList.contains('selected'),true);
  assert.equal(records(refreshed)['recall-b'],undefined);
  assert.deepEqual(records(refreshed)['recall-a'],counts(1,1,true));
  assert.equal(JSON.parse(refreshed.storage.get(SESSION)).bankVersion,'test-r2');
});

test('deep link switches an existing original-only session to recalled practice, preserving records', () => {
  const dom=boot({bank:recalledBank});
  dom.get('source').value='original';dom.get('source').onchange();
  dom.pick(1);dom.get('submit-btn').click();dom.navigate('stats');
  const refreshed=boot({bank:recalledBank,url:'https://example.org/?source=recalled',storage:dom.storage});
  assert.equal(refreshed.get('practice-panel').hidden,false);
  assert.equal(refreshed.get('source').value,'recalled');
  assert.match(refreshed.get('queue-label').textContent,/第 1 \/ 2 题/);
  assert.deepEqual(records(refreshed).single,counts(1,1,true));
});

test('a bank version upgrade incorporates newly added priority questions without erasing records or drafts', () => {
  for(const legacy of [false,true]) {
    const old=boot();old.get('favorite-btn').click();old.pick(1);old.get('submit-btn').click();old.get('next-btn').click();old.pick(0);
    if(legacy){const saved=JSON.parse(old.storage.get(SESSION));delete saved.bankVersion;old.storage.set(SESSION,JSON.stringify(saved));}
    const upgraded=boot({bank:recalledBank,storage:old.storage});
    assert.match(upgraded.get('queue-label').textContent,/第 1 \/ 5 题/);
    assert.match(upgraded.get('question-card').innerHTML,/回归测试题 recall-a/);
    assert.match(upgraded.get('toast').textContent,/题库已更新/);
    assert.deepEqual(records(upgraded).single,counts(1,1,true,true));
    const session=JSON.parse(upgraded.storage.get(SESSION));
    assert.equal(session.bankVersion,'test-r2');assert.deepEqual(session.drafts.multiple,[0]);
    assert.deepEqual(session.results.single,{selected:[1],correct:true});
    const refreshed=boot({bank:recalledBank,storage:upgraded.storage});
    assert.doesNotMatch(refreshed.get('toast').textContent,/题库已更新/);
  }
});

test('untrusted recalled provenance is escaped before an answer is submitted', async () => {
  const dom=boot(), q=recalled('xss-recalled');
  q.source.title='<img src=x onerror=alert(1)>';
  q.source.year='<svg onload=alert(1)>';
  q.source.location='<script>alert(1)</script>';
  await dom.importFile('import-bank',[q]);
  assert.match(dom.get('question-card').innerHTML,/&lt;img/);
  assert.match(dom.get('question-card').innerHTML,/&lt;svg/);
  assert.match(dom.get('question-card').innerHTML,/&lt;script/);
  assert.doesNotMatch(dom.get('question-card').innerHTML,/<(?:img|svg|script)\b/);
  assert.equal(dom.get('explanation').hidden,true);
});

test('waiting service worker offers explicit update and reloads only after a saved-session activation', async () => {
  const events={},messages=[];let reloads=0;
  const registration={waiting:{postMessage:value=>messages.push(value)},addEventListener(){}};
  const serviceWorker={controller:{},register:async()=>registration,ready:Promise.resolve(),addEventListener:(type,fn)=>events[type]=fn};
  const dom=boot({bank:recalledBank,url:'https://example.org/?source=recalled',serviceWorker,reload:()=>reloads++});
  await Promise.resolve();await Promise.resolve();
  assert.equal(dom.get('update-app').hidden,false);
  events.controllerchange();assert.equal(reloads,0);
  dom.pick(1);dom.get('update-app').click();
  assert.equal(messages.length,1);assert.equal(messages[0].type,'SKIP_WAITING');
  assert.deepEqual(JSON.parse(dom.storage.get(SESSION)).drafts['recall-a'],[1]);
  events.controllerchange();assert.equal(reloads,1);
});

test('service worker update does not reload when current session cannot be persisted', async () => {
  let messages=0;
  const registration={waiting:{postMessage:()=>messages++},addEventListener(){}};
  const serviceWorker={controller:{},register:async()=>registration,ready:Promise.resolve(),addEventListener(){}};
  const dom=boot({url:'https://example.org/',serviceWorker,failWrite:true});
  await Promise.resolve();await Promise.resolve();dom.get('update-app').click();
  assert.equal(messages,0);assert.match(dom.get('toast').textContent,/导出备份/);
});

test('first service worker install never offers an update without an existing controller', async () => {
  const events={};let reloads=0,messages=0;
  const registration={waiting:{postMessage:()=>messages++},addEventListener(){}};
  const serviceWorker={controller:null,register:async()=>registration,ready:Promise.resolve(),addEventListener:(type,fn)=>events[type]=fn};
  const dom=boot({url:'https://example.org/',serviceWorker,reload:()=>reloads++});
  await Promise.resolve();await Promise.resolve();
  assert.equal(dom.get('update-app').hidden,true);assert.equal(dom.get('update-app').disabled,true);
  dom.get('update-app').click();assert.equal(messages,0);
  registration.waiting=null;serviceWorker.controller={};events.controllerchange();
  assert.equal(dom.get('update-app').hidden,true);assert.equal(reloads,0);
});

test('an update activated by another tab removes the stale waiting-worker button', async () => {
  const events={};let reloads=0;
  const registration={waiting:{postMessage(){}},addEventListener(){}};
  const serviceWorker={controller:{},register:async()=>registration,ready:Promise.resolve(),addEventListener:(type,fn)=>events[type]=fn};
  const dom=boot({url:'https://example.org/',serviceWorker,reload:()=>reloads++});
  await Promise.resolve();await Promise.resolve();
  assert.equal(dom.get('update-app').hidden,false);
  registration.waiting=null;events.controllerchange();
  assert.equal(dom.get('update-app').hidden,true);assert.equal(dom.get('update-app').disabled,true);
  assert.equal(reloads,0);
});
