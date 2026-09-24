const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);fs.mkdirSync('artifacts',{recursive:true});
const meta=JSON.parse(fs.readFileSync('baseline/snapshot.json','utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha('baseline/bank_exam_quiz.html'),meta.sha256);
assert.equal(sha(meta.originalPath),meta.sha256);
const context={window:{}};vm.runInNewContext(fs.readFileSync('docs/data.js','utf8'),context);const bank=JSON.parse(JSON.stringify(context.window.BANK_DATA));
const C=require('../core.js');const qs=C.validateQuestions(bank.questions);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
const expected=C.validateQuestions(['data/v1-questions.json','data/original-questions.json','data/open-questions.json','data/recalled-questions.json','data/notes-questions.json'].flatMap(read));
assert.deepEqual(qs,expected);assert(qs.length>=236);
for(const q of qs){assert(C.checkAnswer(q,q.answer));assert(!C.checkAnswer(q,[]));assert(q.source.verifiedAt);}
for(const file of ['index.html','app.js','core.js','styles.css','data.js','sw.js','manifest.webmanifest','icon.svg','ATTRIBUTION.html'])assert.equal(sha(file),sha('docs/'+file));
for(const m of fs.readFileSync('docs/index.html','utf8').matchAll(/(?:href|src)="\.\/([^"#]+)"/g))assert(fs.existsSync('docs/'+m[1]),m[1]);
const run=cp.spawnSync(process.execPath,['--test','tests/core.test.cjs','tests/app-static.test.cjs','tests/recalled.test.cjs','tests/notes-bank.test.cjs'],{encoding:'utf8'});
fs.mkdirSync('artifacts/notes-20260924',{recursive:true});
fs.writeFileSync('artifacts/notes-20260924/modified-tests.tap.txt',run.stdout+run.stderr);assert.equal(run.status,0,run.stdout+run.stderr);
const tests=run.stdout.match(/# tests (\d+)/)[1],pass=run.stdout.match(/# pass (\d+)/)[1],fail=run.stdout.match(/# fail (\d+)/)[1];
console.log(`MODIFIED QUESTIONS=${qs.length}; TESTS=${tests}; PASS=${pass}; FAIL=${fail}; ORIGINAL_HASH=UNCHANGED`);
