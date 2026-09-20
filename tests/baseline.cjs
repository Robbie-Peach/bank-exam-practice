'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createDom } = require('./dom-stub.cjs');

const file = path.resolve(process.argv[2] || path.join(__dirname, '..', 'baseline', 'bank_exam_quiz.html'));
const html = fs.readFileSync(file, 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
assert.ok(scripts.length, 'Baseline must include the original executable script');

function boot(storage) {
  const dom = createDom(html, { storage });
  scripts.forEach(source => dom.run(source));
  assert.equal(dom.errors.length, 0);
  return dom;
}

const dom = boot();
assert.equal(dom.run('Q.length'), 36);
assert.equal(dom.run('list.length'), 36);

for (const type of ['单选', '多选', '判断']) {
  dom.run(`idx=list.findIndex(q=>q.t===${JSON.stringify(type)});render();list[idx].a.forEach(i=>pick(i));submitAnswer();`);
  assert.equal(dom.run('state.lastCorrect'), true, type + ' correct submission');
  assert.equal(dom.get('submit').disabled, true, type + ' submit disables');
  assert.ok(dom.get('explain').classList.contains('good'), type + ' explanation appears');
  assert.match(dom.get('explain').innerHTML, /回答正确/);
}
assert.equal(dom.run('state.total'), 3);
assert.equal(dom.run('state.correct'), 3);

// Exercise the original wrong-answer/favorite event functions and real JSON store.
dom.run("idx=list.findIndex(q=>q.t==='单选');render();pick(list[idx].o.findIndex((_,i)=>!list[idx].a.includes(i)));submitAnswer();");
const wrongId = dom.run('list[idx].id');
assert.equal(dom.run('state.lastCorrect'), false);
assert.equal(dom.run(`state.wrong.includes(${wrongId})`), true);
dom.run('jumpWrong();');
assert.equal(dom.run('list.length'), 1);
assert.equal(dom.run('list[0].id'), wrongId);
dom.run('toggleFav();');
assert.equal(dom.run(`state.fav.includes(${wrongId})`), true);
assert.equal(dom.get('fav').textContent, '★ 已收藏');
const restored = boot(dom.storage);
assert.equal(restored.run(`state.fav.includes(${wrongId})`), true);
assert.equal(restored.run(`state.wrong.includes(${wrongId})`), true);
dom.run('list[idx].a.forEach(i=>pick(i));submitAnswer();');
assert.equal(dom.run(`state.wrong.includes(${wrongId})`), false);
assert.equal(JSON.parse(dom.storage.get('bankQuizState')).wrong.length, 0);
dom.run('toggleFav();');
assert.equal(dom.run(`state.fav.includes(${wrongId})`), false);

console.log('BASELINE QUESTIONS=36; SINGLE=PASS; MULTIPLE=PASS; BOOLEAN=PASS');
console.log('BASELINE WRONG=PASS; FAVORITE=PASS; PERSISTENCE=PASS');
