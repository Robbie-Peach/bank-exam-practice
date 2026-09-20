/* 银行从业练习室：纯静态，无分析追踪，无服务器上传。 */
(function () {
  'use strict';
  const C = window.QuizCore, $ = id => document.getElementById(id);
  const KEY = 'bank-quiz-v2-records', CUSTOM = 'bank-quiz-v2-custom', SESSION = 'bank-quiz-v2-session';
  const kindNames = {official_past:'官方真题',recalled:'真题回忆版',publication:'出版物练习',open:'开放练习',original:'GPT 原创'};
  const typeNames = {single:'单选',multiple:'多选',boolean:'判断'};
  const subjects = {law:'法律法规',finance:'个人理财'};
  let storageOK = true, records = {}, custom = [], questions = [], queue = [], idx = 0, selected = [], results = {}, drafts = {}, view = 'practice', queueView = 'practice', toastTimer;
  const escape = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const displayText = s => String(s).replace(/\$\\%\$/g, '%').replace(/\\%/g, '%');
  const letters = a => a.map(i => String.fromCharCode(65+i)).join('、');
  function notice(message) { $('toast').textContent = message; $('toast').hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').hidden = true, 5500); }
  function read(key) { try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { storageOK=false; return null; } }
  function write(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { storageOK=false; $('save-status').textContent='保存失败，请导出进度'; notice('本机存储未成功，请到学习记录导出备份。'); return false; } }
  function save() { const ok=write(KEY, {version:1,records}); updateStats(); return ok; }
  function saveSession() { return write(SESSION, {bankVersion:window.BANK_DATA.version,view,queueView,idx,ids:queue.map(q=>q.id),results,drafts,filters:Object.fromEntries(['subject','chapter','type','source','order'].map(id=>[id,$(id).value])),unseen:$('unseen').checked}); }
  function combine(extra) { return C.validateQuestions([...(window.BANK_DATA.questions||[]),...extra]); }
  function validateCustom(raw) { return Array.isArray(raw) && raw.length===0 ? [] : C.validateQuestions(raw); }
  function link(url, label) { const safe=C.safeSourceUrl(url); return safe ? `<a href="${escape(safe)}" target="_blank" rel="noopener noreferrer">${escape(label)} ↗</a>` : ''; }
  function load() {
    try { custom = validateCustom(read(CUSTOM)||[]); } catch { custom=[]; notice('本机自定义题库格式异常，已保留原存储；可重新导入有效备份。'); }
    try { questions = combine(custom); } catch { custom=[]; questions=C.validateQuestions(window.BANK_DATA.questions); notice('自定义题库与内置题目冲突，暂时仅显示内置题。'); }
    try { records=C.validateBackup(read(KEY)||{version:1,records:{}},questions).records; } catch { records={}; notice('进度记录格式异常；原存储未删除，请先导出保留。'); }
    if(!storageOK) $('save-status').textContent='存储不可用，请使用导出备份';
    fillChapters(); renderLibrary(); updateStats();
    const session=read(SESSION), requestedRecalled=new URL(location.href).searchParams.get('source')==='recalled';
    if (session && session.filters && Array.isArray(session.ids)) {
      for(const id of ['subject','type','source','order']) if([...$(id).options].some(o=>o.value===session.filters[id])) $(id).value=session.filters[id];
      fillChapters(); if([...$('chapter').options].some(o=>o.value===session.filters.chapter)) $('chapter').value=session.filters.chapter;
      $('unseen').checked=session.unseen===true;
      view=['practice','wrong','favorite','stats','library'].includes(session.view)?session.view:'practice';
      const qmap=new Map(questions.map(q=>[q.id,q]));
      queueView=['practice','wrong','favorite'].includes(session.queueView)?session.queueView:(['practice','wrong','favorite'].includes(view)?view:'practice');
      const upgraded=session.bankVersion!==window.BANK_DATA.version;
      const switchToRecalled=requestedRecalled && ($('source').value!=='recalled'||queueView!=='practice');
      if(switchToRecalled) { recalledFilters(); view='practice';queueView='practice'; }
      else if(requestedRecalled) view='practice';
      queue=upgraded||switchToRecalled?C.buildQueue(questions,filterOptions(queueView),records):[...new Set(session.ids)].filter(id=>qmap.has(id)).map(id=>qmap.get(id));
      idx=upgraded||switchToRecalled?0:Number.isInteger(session.idx)?Math.max(0,Math.min(session.idx,queue.length-1)):0;
      if(session.results && typeof session.results==='object') for(const q of queue) {
        const r=session.results[q.id];
        if(r && Array.isArray(r.selected) && r.selected.length && new Set(r.selected).size===r.selected.length && r.selected.every(i=>Number.isInteger(i)&&i>=0&&i<q.options.length)) results[q.id]={selected:r.selected,correct:C.checkAnswer(q,r.selected)};
      }
      if(session.drafts&&typeof session.drafts==='object')for(const q of queue){const a=session.drafts[q.id];if(Array.isArray(a)&&a.length<=q.options.length&&new Set(a).size===a.length&&a.every(i=>Number.isInteger(i)&&i>=0&&i<q.options.length)&&(q.type==='multiple'||a.length<=1))drafts[q.id]=a;}
      setView(view,false); if(!queue.length) restart(); else { render();saveSession(); }
      if(upgraded&&storageOK) notice('题库已更新，本轮题目已刷新；历史作答、草稿与收藏已保留。');
    } else { if(requestedRecalled) recalledFilters();setView('practice'); }
    $('bank-version').textContent=`题库 ${window.BANK_DATA.version} · ${questions.length} 题`;
  }
  function fillChapters() {
    const previous=$('chapter').value, subject=$('subject').value;
    const chapters=[...new Set(questions.filter(q=>subject==='all'||q.subject===subject).map(q=>q.chapter))].sort((a,b)=>a.localeCompare(b,'zh'));
    $('chapter').innerHTML='<option value="all">全部章节</option>'+chapters.map(s=>`<option value="${escape(s)}">${escape(s)}</option>`).join('');
    if(chapters.includes(previous)) $('chapter').value=previous;
  }
  function recalledFilters(){for(const id of ['subject','chapter','type'])$(id).value='all';$('source').value='recalled';$('order').value='priority';$('unseen').checked=false;fillChapters();}
  function filterOptions(modeView=view){return {subject:$('subject').value,chapter:$('chapter').value,type:$('type').value,source:$('source').value,order:$('order').value,mode:modeView==='wrong'?'wrong':modeView==='favorite'?'favorite':$('unseen').checked?'unseen':'all',limit:0};}
  function restart(){queueView=['practice','wrong','favorite'].includes(view)?view:'practice';queue=C.buildQueue(questions,filterOptions(),records);idx=0;selected=[];results={};drafts={};render();saveSession();}
  function setView(next,reset=true){
    const previousView=view; view=next;
    document.querySelectorAll('[data-view]').forEach(el=>{const active=el.dataset.view===view;el.classList.toggle('active',active);if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    const practice=['practice','wrong','favorite'].includes(view);
    $('practice-panel').hidden=!practice;$('stats-panel').hidden=view!=='stats';$('library-panel').hidden=view!=='library';$('filter-toggle').hidden=!practice;
    const heads={practice:['PRACTICE / 练习','今天，从一道题开始'],wrong:['REVIEW / 错题','把不确定，变成确定'],favorite:['SAVED / 收藏','值得再看一遍的题'],stats:['PROGRESS / 记录','每一步，都算数'],library:['SOURCES / 题库','题目从哪里来']};
    $('page-eyebrow').textContent=heads[view][0];$('page-title').textContent=heads[view][1];
    if(reset&&practice) { if(queue.length && queueView===view) render(); else restart(); saveSession(); } else if(reset) { if(['practice','wrong','favorite'].includes(previousView)) saveSession(); }
    if(view==='stats') updateStats();
    if(view==='library') renderLibrary();
  }
  function render(){
    const q=queue[idx]; selected=q?(results[q.id]?[...results[q.id].selected]:[...(drafts[q.id]||[])]):[];
    $('previous-btn').disabled=idx===0||!q;
    $('favorite-btn').disabled=!q;
    $('next-btn').hidden=true;$('submit-btn').hidden=false;$('submit-btn').disabled=!q;
    $('explanation').hidden=true;
    const completed=Object.keys(results).length, correct=Object.values(results).filter(r=>r.correct).length;
    $('session-score').textContent=`本轮 ${correct} / ${completed} 正确`;
    $('queue-label').textContent=q?`${view==='wrong'?'错题复习':view==='favorite'?'收藏练习':'来源优先可在筛选中调整'} · 第 ${idx+1} / ${queue.length} 题`:'当前筛选 0 题';
    $('progress-fill').style.width=(queue.length?completed/queue.length*100:0)+'%';
    if(!q){
      const message=view==='wrong'?'这里还没有错题。可以先练习，或调整科目与来源筛选。':view==='favorite'?'遇到值得复习的题，点击「收藏」就会出现在这里。':'该筛选条件下暂无题目。已核验但尚未收录的真题与出版物入口，可在「题库与来源」查看。';
      $('question-card').innerHTML=`<div class="empty-state"><span class="empty-icon">▤</span><h3>当前没有可练习的题</h3><p>${message}</p><button id="clear-filter" class="quiet">返回全部练习</button></div>`;
      $('clear-filter').onclick=()=>{for(const id of ['subject','chapter','type','source'])$(id).value='all';$('unseen').checked=false;fillChapters();setView('practice');};
      $('favorite-btn').textContent='☆ 收藏';return;
    }
    const provenance=q.source.kind==='recalled'?`<div class="question-source"><b>${escape(q.source.title)}</b><span>${[q.source.year,q.source.location].filter(Boolean).map(escape).join(' · ')}</span><small>回忆整理，非官方公布试题。</small>${link(q.source.url,'核对回忆版原文')}</div>`:'';
    $('question-card').innerHTML=`<div class="question-meta"><span class="badge">${typeNames[q.type]}</span><span>${escape(subjects[q.subject])} / ${escape(q.chapter)}</span><span class="badge source">${kindNames[q.source.kind]}</span><span class="question-number">${String(idx+1).padStart(3,'0')}</span></div>${provenance}<h3 class="question-title">${escape(displayText(q.question))}</h3><p class="question-tip">${q.type==='multiple'?'选择所有正确选项，全部选对才计为正确。':'请选择一个答案。'}</p><div class="options" role="group" aria-label="答案选项">${q.options.map((o,i)=>`<button class="option" data-option="${i}" aria-pressed="false"><span class="option-letter">${String.fromCharCode(65+i)}</span><span>${escape(displayText(o))}</span><span class="option-mark"></span></button>`).join('')}</div>`;
    document.querySelectorAll('[data-option]').forEach(btn=>btn.onclick=()=>pick(Number(btn.dataset.option)));
    updateFavorite(q); updateOptions(); if(results[q.id]) showResult(q,results[q.id]);
  }
  function updateFavorite(q){const fav=!!records[q.id]?.favorite;$('favorite-btn').textContent=fav?'★ 已收藏':'☆ 收藏';$('favorite-btn').setAttribute('aria-pressed',String(fav));}
  function updateOptions(){document.querySelectorAll('[data-option]').forEach(btn=>{const chosen=selected.includes(Number(btn.dataset.option));btn.classList.toggle('selected',chosen);btn.setAttribute('aria-pressed',String(chosen));});}
  function pick(i){const q=queue[idx];if(!q||results[q.id])return;selected=q.type==='multiple'?(selected.includes(i)?selected.filter(n=>n!==i):[...selected,i]):[i];drafts[q.id]=[...selected];updateOptions();saveSession();}
  function submit(){
    const q=queue[idx];if(!q||results[q.id])return;if(!selected.length){notice('请先选择答案。');return;}
    const correct=C.checkAnswer(q,selected);records=C.recordAnswer(records,q.id,correct);results[q.id]={selected:[...selected],correct};save();saveSession();render();
  }
  function showResult(q,r){
    document.querySelectorAll('[data-option]').forEach(btn=>{const i=Number(btn.dataset.option);btn.disabled=true;btn.classList.remove('selected');if(q.answer.includes(i)){btn.classList.add('correct');btn.querySelector('.option-mark').textContent='正确答案';}else if(r.selected.includes(i)){btn.classList.add('incorrect');btn.querySelector('.option-mark').textContent='你的选择';}});
    $('submit-btn').hidden=true;$('next-btn').hidden=false;$('next-btn').textContent=idx===queue.length-1?'再练一轮 ↻':'下一题 →';
    $('explanation').hidden=false;$('explanation').classList.toggle('wrong',!r.correct);
    $('explanation').innerHTML=`<div class="answer-result">${r.correct?'✓ 回答正确':'↺ 记住这个知识点，下次再来'}</div><p>正确答案 <b>${letters(q.answer)}</b>　你的答案 <b>${letters(r.selected)}</b></p><p>${escape(displayText(q.explanation))}</p><div class="source-detail"><b>${escape(q.source.title)}</b><p>${escape(q.source.note||'')}</p>${link(q.source.url,q.source.kind==='original'?'考点依据（非题源）':'查看题目来源')}${q.source.evidenceUrl?link(q.source.evidenceUrl,'答案核验依据'):''}<span>核验 ${escape(q.source.verifiedAt||'待复核')}</span></div>`;
  }
  function next(){if(!queue.length)return;if(idx===queue.length-1){restart();notice('已开始新一轮。错题与未答题范围已重新计算。');}else{idx++;render();saveSession();}if(window.innerWidth<721)$('question-card').scrollIntoView({block:'start',behavior:'auto'});}
  function updateStats(){
    const s=C.summarize(questions,records);$('nav-wrong').textContent=s.wrong||'';$('nav-favorite').textContent=s.favorites||'';
    $('total-seen').textContent=s.seen;$('total-accuracy').textContent=s.attempts?Math.round(s.accuracy)+'%':'—';$('total-bank').textContent=s.total;
    $('mastery-ring').style.background=`conic-gradient(var(--teal) ${s.total?s.seen/s.total*360:0}deg, #dfe8eb 0deg)`;
    $('stats-grid').innerHTML=[[s.seen+'/'+s.total,'已练 / 总题数'],[s.attempts,'累计作答次数'],[s.attempts?Math.round(s.accuracy)+'%':'—','累计正确率']].map(([n,l])=>`<div class="stat"><b>${escape(n)}</b><span>${l}</span></div>`).join('');
    $('chapter-stats').innerHTML=s.chapters.map(c=>`<div class="chapter-row"><span>${escape(c.chapter)}<small>${subjects[c.subject]} · 已练 ${c.seen}/${c.total} 题</small></span><div class="mini-track"><i style="width:${c.accuracy}%"></i></div><b>${c.seen?Math.round(c.accuracy)+'%':'—'}</b></div>`).join('');
  }
  function renderLibrary(){
    const counts=Object.fromEntries(Object.keys(kindNames).map(k=>[k,questions.filter(q=>q.source.kind===k).length]));
    $('recalled-shortcut').textContent=`回忆版专项 · ${counts.recalled} 题 →`;
    $('recalled-shortcut').disabled=counts.recalled===0;
    $('bank-summary').textContent=`当前可练 ${questions.length} 题。内置 ${window.BANK_DATA.questions.length} 题，本机导入 ${custom.length} 题。`;
    $('source-counts').innerHTML=Object.entries(counts).map(([k,n])=>`<span>${kindNames[k]} <b>${n}</b></span>`).join('');
    const labels={recalled_past:'真题回忆版',official_textbook:'官方教材',publication:'出版物',official_outline:'官方大纲',open_benchmark:'开放题库'};
    $('resource-links').innerHTML=(window.BANK_DATA.resources||[]).map(r=>`<article class="resource"><span class="resource-type">${escape(r.category||labels[r.kind]||'资料')}</span>${link(r.url,r.title)}<p>${escape(r.note||r.description||'')}</p></article>`).join('')+`<article class="resource"><a href="./ATTRIBUTION.html" target="_blank" rel="noopener">题库来源、审校与许可说明 ↗</a></article>`;
    $('custom-count').textContent=`本机已导入 ${custom.length} 题。重复 ID 或完全相同题干将拒绝导入，原题库不变。`;
  }
  function download(name,value){const blob=new Blob([JSON.stringify(value,null,2)],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  async function readFile(input){const file=input.files[0];if(!file)return null;if(file.size>8*1024*1024)throw Error('文件超过 8 MB，请拆分后导入。');return JSON.parse(await file.text());}
  function bind(){
    document.querySelectorAll('[data-view]').forEach(btn=>btn.onclick=()=>setView(btn.dataset.view));
    $('recalled-shortcut').onclick=()=>{recalledFilters();setView('practice',false);restart();notice('已进入回忆版专项。每题可查看考次与原文来源。');};
    for(const id of ['subject','chapter','type','source','order','unseen']) $(id).onchange=()=>{if(id==='subject')fillChapters();restart();};
    $('filter-toggle').onclick=()=>{const open=$('filters').classList.toggle('open');$('filter-toggle').setAttribute('aria-expanded',String(open));};
    $('submit-btn').onclick=submit;$('next-btn').onclick=next;$('previous-btn').onclick=()=>{if(idx>0){idx--;render();saveSession();}};
    $('favorite-btn').onclick=()=>{const q=queue[idx];if(!q)return;const r=records[q.id]||{attempts:0,correct:0,wrong:0,lastCorrect:null,favorite:false};records={...records,[q.id]:{...r,favorite:!r.favorite}};save();updateFavorite(q);};
    $('export-progress').onclick=()=>{download('银行刷题进度-'+new Date().toISOString().slice(0,10)+'.json',{version:1,exportedAt:new Date().toISOString(),records,customQuestions:custom});notice('已导出进度；包含本机导入的题库。');};
    $('import-progress').onchange=async function(){try{const data=await readFile(this);if(!data)return;const extra=validateCustom(data.customQuestions||[]);const all=combine(extra),backup=C.validateBackup(data,all);if(!confirm(`将用备份替换本机进度和自定义题库（${extra.length} 题）。建议先导出当前进度。继续导入？`))return;custom=extra;questions=all;records=backup.records;const customSaved=write(CUSTOM,custom), progressSaved=save();fillChapters();renderLibrary();setView('stats');restart();notice(customSaved&&progressSaved?'进度已导入。':'进度仅载入当前会话，存储失败；请立即导出备份，刷新会丢失。');}catch(e){notice('导入失败：'+e.message);}finally{this.value='';}};
    $('import-bank').onchange=async function(){try{const data=await readFile(this);if(!data)return;const incoming=C.validateQuestions(Array.isArray(data)?data:data.questions);if(!incoming.length)throw Error('题库为空');const combined=combine([...custom,...incoming]);custom=[...custom,...incoming];questions=combined;const persisted=write(CUSTOM,custom);fillChapters();updateStats();renderLibrary();restart();notice(persisted?`已导入 ${incoming.length} 题，仅保存在本机。`:`已载入 ${incoming.length} 题，但存储失败，仅当前会话可用；请立即导出备份。`);}catch(e){notice('题库导入失败：'+e.message);}finally{this.value='';}};
    $('download-template').onclick=()=>download('题库格式示例.json',[{id:'my-question-001',subject:'finance',chapter:'货币时间价值',type:'single',question:'年利率为5%，100元按年复利一年后的本利和为多少元？',options:['100','105','110','115'],answer:[1],explanation:'100×(1+5%)=105元。',source:{kind:'original',title:'自编练习题示例',url:'https://www.china-cba.net/Index/show/catid/70/id/43162.html',note:'请替换为实际题目来源。出版物应填写书名、版次、页码；回忆版填写具体考次与发布方。',verifiedAt:'2026-09-20'},tags:['复利'],difficulty:1}]);
    document.addEventListener('keydown',e=>{if(e.target.matches('input,select,textarea,button,a')||!['practice','wrong','favorite'].includes(view))return;if(/^[1-6]$/.test(e.key)){const n=Number(e.key)-1;if(queue[idx]&&n<queue[idx].options.length)pick(n);}if(e.key==='Enter'){e.preventDefault();if(queue[idx]&&results[queue[idx].id])next();else submit();}});
  }
  try { bind();load(); } catch(e) { $('question-card').textContent='题库载入失败：'+e.message+'。请刷新页面；若仍出现，请保留进度备份后联系维护者。';console.error(e); }
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    let updateRequested=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(updateRequested)location.reload();});
    navigator.serviceWorker.register('./sw.js').then(async reg=>{
      const offerUpdate=()=>{if(reg.waiting){$('update-app').hidden=false;$('update-app').disabled=false;}};
      $('update-app').onclick=()=>{if(!reg.waiting)return;if(!saveSession()){notice('更新前请先到学习记录导出备份，本机存储未成功。');return;}updateRequested=true;$('update-app').disabled=true;$('update-app').textContent='正在更新…';reg.waiting.postMessage({type:'SKIP_WAITING'});};
      offerUpdate();
      reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(worker)worker.addEventListener('statechange',()=>{if(worker.state==='installed')offerUpdate();});});
      await navigator.serviceWorker.ready;$('offline-status').textContent='离线缓存已就绪。外部资料入口仍需联网。';offerUpdate();
    }).catch(()=>{$('offline-status').textContent='离线缓存未成功；请保持联网使用。';});
  }else $('offline-status').textContent='直接打开本地文件时不启用离线缓存；完整文件夹本身可离线使用。';
})();
