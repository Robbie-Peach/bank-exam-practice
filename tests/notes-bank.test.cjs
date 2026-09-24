'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const C=require('../core.js');
const root=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8').replace(/^\uFEFF/,''));

test('notes-derived pack is original, traceable, balanced and integrated with the built site',()=>{
  const notes=read('data/notes-questions.json');
  const legacy=['data/v1-questions.json','data/original-questions.json','data/open-questions.json','data/recalled-questions.json'].flatMap(read);
  assert.equal(legacy.length,156);
  assert(notes.length>=80,'notes pack should be a meaningful expansion, not isolated examples');
  assert(notes.filter(q=>q.subject==='law').length>=40);
  assert(notes.filter(q=>q.subject==='finance').length>=40);
  const all=C.validateQuestions([...legacy,...notes]);
  assert.equal(all.length,156+notes.length);
  for(const q of notes){
    assert.equal(q.source.kind,'original',q.id);
    assert.match(q.source.title,/原创/,q.id);
    assert(q.tags.includes('笔记原创'),q.id);
    assert.match(q.source.note,/笔记/,q.id);
    assert.match(q.source.note,/PDF第\d+页/,q.id);
    assert.equal(q.source.verifiedAt,'2026-09-24',q.id);
    const page=Number(q.source.note.match(/PDF第(\d+)页/)[1]);
    assert(page>=1&&page<=(q.subject==='law'?60:32),q.id);
    assert(C.checkAnswer(q,q.answer),q.id);
    assert(!C.checkAnswer(q,[]),q.id);
  }
  const ctx={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'docs/data.js'),'utf8'),ctx);
  const built=JSON.parse(JSON.stringify(ctx.window.BANK_DATA));
  assert.deepEqual(built.questions,all);
  assert.equal(C.buildQueue(all,{source:'notes_original'},{}).length,notes.length);
  assert.equal(new Set(notes.map(q=>q.chapter)).size>=12,true);
});
