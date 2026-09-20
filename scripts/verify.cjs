const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),vm=require('node:vm'),assert=require('node:assert/strict'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);fs.mkdirSync('artifacts',{recursive:true});
const meta=JSON.parse(fs.readFileSync('baseline/snapshot.json','utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
assert.equal(sha('baseline/bank_exam_quiz.html'),meta.sha256);
assert.equal(sha(meta.originalPath),meta.sha256);
const context={window:{}};vm.runInNewContext(fs.readFileSync('docs/data.js','utf8'),context);const bank=JSON.parse(JSON.stringify(context.window.BANK_DATA));
const C=require('../core.js');const qs=C.validateQuestions(bank.questions);assert.equal(qs.length,151);
for(const q of qs){assert(C.checkAnswer(q,q.answer));assert(!C.checkAnswer(q,[]));assert(q.source.verifiedAt);}
for(const file of ['index.html','app.js','core.js','styles.css','data.js','sw.js','manifest.webmanifest','icon.svg','ATTRIBUTION.html'])assert.equal(sha(file),sha('docs/'+file));
for(const m of fs.readFileSync('docs/index.html','utf8').matchAll(/(?:href|src)="\.\/([^"#]+)"/g))assert(fs.existsSync('docs/'+m[1]),m[1]);
const run=cp.spawnSync(process.execPath,['--test','tests/core.test.cjs','tests/app-static.test.cjs'],{encoding:'utf8'});
fs.writeFileSync('artifacts/modified-tests.tap.txt',run.stdout+run.stderr);assert.equal(run.status,0,run.stdout+run.stderr);
const tests=run.stdout.match(/# tests (\d+)/)[1],pass=run.stdout.match(/# pass (\d+)/)[1],fail=run.stdout.match(/# fail (\d+)/)[1];
console.log(`MODIFIED QUESTIONS=${qs.length}; TESTS=${tests}; PASS=${pass}; FAIL=${fail}; ORIGINAL_HASH=UNCHANGED`);
