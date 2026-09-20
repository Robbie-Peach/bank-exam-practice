'use strict';
// Same integration smoke used for baseline, modified release and isolated rollback.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {createDom}=require('../tests/dom-stub.cjs');
const [dir,expected,recalled,label='SNAPSHOT']=process.argv.slice(2);
assert(dir&&expected!==undefined&&recalled!==undefined,'usage: node scripts/recalled-snapshot.cjs DIRECTORY TOTAL RECALLED LABEL');
const read=f=>fs.readFileSync(path.resolve(dir,f),'utf8');
const ctx={window:{}};vm.runInNewContext(read('data.js'),ctx);
const data=JSON.parse(JSON.stringify(ctx.window.BANK_DATA));
assert.equal(data.questions.length,Number(expected));
assert.equal(data.questions.filter(q=>q.source.kind==='recalled').length,Number(recalled));
const dom=createDom(read('index.html'));dom.run(read('core.js'));dom.run(read('data.js'));dom.run(read('app.js'));
assert.equal(dom.errors.length,0,dom.errors.map(String).join('\n'));
assert.equal(Number(dom.get('total-bank').textContent),Number(expected));
assert.doesNotMatch(dom.get('question-card').textContent,/题库载入失败/);
// Full app render, choose the first rendered correct answer through the DOM.
const session=JSON.parse(dom.storage.get('bank-quiz-v2-session'));
const q=data.questions.find(q=>q.id===session.ids[0]);
for(const n of q.answer)dom.pick(n);
dom.get('submit-btn').click();
const records=JSON.parse(dom.storage.get('bank-quiz-v2-records')).records;
assert.equal(records[q.id].correct,1);
// The regular suite covers persistence in depth; compare saved serialized evidence here.
assert.equal(records[q.id].attempts,1);
console.log(`${label} QUESTIONS=${expected}; RECALLED=${recalled}; APP_RENDER=PASS; ANSWER=PASS; SAVED_RECORD=PASS`);
