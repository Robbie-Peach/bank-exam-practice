'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.resolve(__dirname,'..'),C=require('../core.js');
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8').replace(/^\uFEFF/,''));
const rows=read('data/recalled-questions.json');
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(root,'docs/data.js'),'utf8'),context);
const data=JSON.parse(JSON.stringify(context.window.BANK_DATA));
test('release contains five recalled questions, not external advertised counts',()=>{
  assert.equal(data.version,'2026.09.20-r2');assert.equal(data.questions.length,156);
  assert.equal(rows.length,5);assert.equal(rows.filter(q=>q.subject==='law').length,2);
  assert.equal(rows.filter(q=>q.subject==='finance').length,3);
  assert.deepEqual(data.questions.filter(q=>q.source.kind==='recalled'),C.validateQuestions(rows));
  assert.equal(data.questions.filter(q=>q.source.kind==='open').length,15);
  assert.equal(data.questions.filter(q=>q.source.kind==='original').length,136);
  assert.equal(data.questions.filter(q=>['official_past','publication'].includes(q.source.kind)).length,0);
});
test('source priority starts with actual recalled questions and preserves all existing 151',()=>{
  const original=C.validateQuestions(['data/v1-questions.json','data/original-questions.json','data/open-questions.json'].flatMap(read));
  assert.deepEqual(data.questions.filter(q=>q.source.kind!=='recalled'),original);
  const queue=C.buildQueue(data.questions,{order:'priority'},{});
  assert.deepEqual(queue.slice(0,5).map(q=>q.id),rows.map(q=>q.id));
  const filtered=C.buildQueue(data.questions,{source:'recalled',order:'priority'},{});
  assert.equal(filtered.length,5);assert.equal(new Set(queue.map(q=>q.id)).size,156);
});
test('each short recall has one distinct article, original answer, exam location and independent evidence',()=>{
  assert.deepEqual(rows.map(q=>q.answer),[[0],[2],[2],[2],[2]]);
  assert.equal(new Set(rows.map(q=>q.source.url)).size,5);
  const segmenter=new Intl.Segmenter('zh',{granularity:'word'});
  for(const q of rows){
    const s=q.source;assert.equal(s.kind,'recalled');assert(s.publisher);assert(s.year);assert.match(s.location,/第\d题/);
    assert.equal(s.verifiedAt,'2026-09-20');assert(C.safeSourceUrl(s.url));assert(C.safeSourceUrl(s.evidenceUrl));assert.notEqual(s.url,s.evidenceUrl);
    assert.match(s.license,/未声明开放/);assert.match(s.adaptation,/解析/);assert.match(q.explanation,/本站独立编写/);
    const words=[...segmenter.segment([q.question,...q.options].join(' '))].filter(s=>s.isWordLike).length+1;
    assert(words<=25,`${q.id}: quoted question/options plus answer=${words}`);
    const ledger=data.resources.find(r=>r.url===s.url);assert.equal(ledger.embeddedCount,1);assert.equal(ledger.distribution,'selected_short_excerpt');
    assert(C.checkAnswer(q,q.answer));
    for(let i=0;i<q.options.length;i++)assert.equal(C.checkAnswer(q,[i]),i===q.answer[0]);
  }
});
test('historical context, original option text and caches are not silently relabeled',()=>{
  assert.match(rows.find(q=>q.id.includes('202211')).source.note,/2022年分类语境/);
  assert.equal(rows.find(q=>q.id.includes('202110')).options[3],'平衡性基金');
  assert.match(fs.readFileSync(path.join(root,'sw.js'),'utf8'),/SKIP_WAITING/);
  const attribution=fs.readFileSync(path.join(root,'ATTRIBUTION.html'),'utf8');
  assert.match(attribution,/目前共 156 道/);assert.match(attribution,/回忆版 5/);
  assert.doesNotMatch(attribution,/官方真题、回忆版、出版物练习题直接收录量均为 0/);
});
test('service worker installation bypasses stale HTTP asset caches instead of recaching old questions',async()=>{
  const handlers={},requests=[];let completed;
  class AssetRequest {constructor(url,options){this.url=url;this.cache=options.cache;}}
  const sandbox={Request:AssetRequest,self:{addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>({addAll:async rows=>requests.push(...rows)})}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),sandbox);
  handlers.install({waitUntil:p=>completed=p});await completed;
  assert.equal(requests.length,9);assert(requests.some(r=>r.url==='./data.js'));
  for(const r of requests)assert.equal(r.cache,'reload');
});
