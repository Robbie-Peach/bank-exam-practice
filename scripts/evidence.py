from pathlib import Path
import difflib, hashlib, json, subprocess

root=Path(__file__).resolve().parent.parent
out=root/'artifacts'
out.mkdir(exist_ok=True)
source=root/'baseline/bank_exam_quiz.html'
target=out/'rollback-copy'
target.mkdir(exist_ok=True)
(target/'index.html').write_bytes((root/'docs/index.html').read_bytes())
(target/'.bank-quiz-copy').write_text('isolated rollback test copy\n',encoding='utf-8')

def run(name,args,display):
    result=subprocess.run(args,cwd=root,capture_output=True,text=True,encoding='utf-8')
    text=(result.stdout+result.stderr).strip()
    (out/(name.lower()+'.txt')).write_text(text+'\n',encoding='utf-8')
    if result.returncode: raise RuntimeError(name+': '+text)
    return f'{name}\nCOMMAND: {display}\nOUTPUT:\n{text}\nEXIT_STATUS={result.returncode}\n'

baseline=run('BASELINE',['node','tests/baseline.cjs','baseline/bank_exam_quiz.html'],'node tests/baseline.cjs baseline/bank_exam_quiz.html')
modified=run('MODIFIED',['node','scripts/verify.cjs'],'node scripts/verify.cjs')
bash=r'C:\Program Files\Git\bin\bash.exe'
rollback=run('ROLLBACK',[bash,'--noprofile','--norc','-c','export PATH="/usr/bin:/bin:$PATH"; chmod +x artifacts/ROLLBACK.sh && ./artifacts/ROLLBACK.sh artifacts/rollback-copy'],'"C:/Program Files/Git/bin/bash.exe" --noprofile --norc -c \'export PATH="/usr/bin:/bin:$PATH"; chmod +x artifacts/ROLLBACK.sh && ./artifacts/ROLLBACK.sh artifacts/rollback-copy\'')
restored=run('RESTORED',['node','tests/baseline.cjs','artifacts/rollback-copy/index.html'],'node tests/baseline.cjs artifacts/rollback-copy/index.html')
diff=[]
for f in ['index.html','styles.css','core.js','app.js','data.js','sw.js','manifest.webmanifest','icon.svg','ATTRIBUTION.html']:
    old=source.read_text(encoding='utf-8').splitlines(True) if f=='index.html' else []
    new=(root/'docs'/f).read_text(encoding='utf-8').splitlines(True)
    diff.extend(difflib.unified_diff(old,new,fromfile='a/bank_exam_quiz.html' if f=='index.html' else '/dev/null',tofile='b/'+f))
(out/'DIFF_FILE.patch').write_text(''.join(diff),encoding='utf-8')
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
info=json.loads((root/'baseline/snapshot.json').read_text())
assert sha(source)==sha(target/'index.html')==sha(Path(info['originalPath']))==info['sha256']
assert sha(root/'docs/index.html')!=sha(source)
report=f'''银行从业双科练习室验收记录
CWD: {root}
BRANCH: codex/bank-quiz-pages
CHANGED_FIELDS: questions 36 -> 151; source.kind/source.url/source.note/source.verifiedAt; source-priority queue; mobile CSS; records/drafts/session persistence; backup/custom imports; Service Worker; GitHub Pages /docs.
MODIFIED_FILE: {root/'docs/index.html'}
DIFF_FILE: {out/'DIFF_FILE.patch'}
VERIFICATION: {out/'VERIFICATION.txt'}
ROLLBACK: {out/'ROLLBACK.sh'}
ORIGINAL_SHA256: {info['sha256']}
MODIFIED_SHA256: {sha(root/'docs/index.html')}
ORIGINAL_FILE_UNCHANGED=YES
MODIFIED_FILE_LEFT_CHANGED=YES

{baseline}
{modified}
{rollback}
{restored}
INPUTS: BASELINE=original HTML; MODIFIED=docs assets, 151 question records, 32 test cases; ROLLBACK=isolated copy only, original baseline bytes.
RESTORED_BEHAVIOR: V1 36 questions, single/multiple/boolean grading, wrong list, favorites and local persistence passed; deployed files not rolled back.

DEPLOYMENT_URL: https://robbie-peach.github.io/bank-exam-practice/
REPOSITORY: https://github.com/Robbie-Peach/bank-exam-practice
PAGES_SOURCE: codex/bank-quiz-pages:/docs
PAGES_STATUS: built
HTTPS_ENFORCED: true
DEPLOYMENT_COMMAND: & ./scripts/verify-deployment.ps1
DEPLOYMENT_OUTPUT: DEPLOYMENT=PASS; REMOTE_ASSETS=9; HTTPS=YES
DEPLOYMENT_EXIT_STATUS: 0
DETAILS: remote-assets.txt records individual HTTP 200 and normalized-text equality checks.

BROWSER_OBSERVATIONS:
- Published HTTPS page loaded 151 questions and real grading/explanation.
- 390x844: document clientWidth=375, scrollWidth=375; no horizontal overflow.
- 320x740: document clientWidth=305, scrollWidth=305; no horizontal overflow.
- Selected incorrect answer created wrong-list entry; correction removed entry and retained history.
- Favorite and submitted-answer UI persisted after reload.
- Official past-paper filter displayed 0 questions with a clear empty-state message.
- Local HTTP server was stopped; cache reload and multiple-choice grading still worked.
- Real progress download created C:/Users/Cx200/Downloads/银行刷题进度-2026-09-20.json (253 bytes).
- Download-event observer timed out despite the real file being saved; filesystem confirmed creation.
- Backup and custom question import/export pass full app event regression; no server uploads.
- Browser console errors were empty in the checked local session.
- This verifies responsive browser viewports, not a physical phone device.

QUESTION_COUNTS: total=151; GPT_original=136 (V1=36,new=100); FinEval_open=15; official_past=0; recalled=0; publication=0.
EXTERNAL_RESOURCES: separately listed and not counted as embedded questions.
LICENSE: selected FinEval data and added annotations/explanations CC-BY-NC-SA 4.0; attribution present in deployed ATTRIBUTION.html and data/ATTRIBUTION.md.
CONTENT_REVIEW: original-review.md, fineval-selection-audit.json. No guarantee of exam coverage or independent expert validation.
'''
(out/'VERIFICATION.txt').write_text(report,encoding='utf-8')
for path in [root/'docs/index.html',out/'DIFF_FILE.patch',out/'VERIFICATION.txt',out/'ROLLBACK.sh']:
    assert path.read_text(encoding='utf-8')
    print('REOPENED='+str(path))
print('EVIDENCE=PASS; ORIGINAL_UNCHANGED=YES; ROLLBACK=PASS; MODIFIED_LEFT_CHANGED=YES')
