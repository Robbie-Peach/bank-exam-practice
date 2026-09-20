"""Reproducible local evidence; restores only a marked isolated test copy."""
from pathlib import Path
import difflib, hashlib, json, shutil, subprocess, sys

root = Path(__file__).resolve().parent.parent
out = root / 'artifacts/recalled'
before = root / 'baseline/before-recalled/docs'
target = out / 'rollback-copy'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
files = sorted(p.name for p in before.iterdir() if p.is_file())

def command(args):
    r = subprocess.run(args, cwd=root, capture_output=True, text=True, encoding='utf-8')
    if r.returncode:
        raise RuntimeError(f'{args}: exit {r.returncode}\n{r.stdout}{r.stderr}')
    return r

if len(sys.argv) > 1 and sys.argv[1] == '--restore':
    dest = Path(sys.argv[2]).resolve()
    assert dest == target.resolve(), 'Restore target must be the isolated artifact copy'
    assert (dest / '.rollback-test-copy').is_file(), 'Missing isolated-copy marker'
    for name in files:
        shutil.copy2(before / name, dest / name)
        assert sha(before / name) == sha(dest / name)
    r = command(['node', 'scripts/recalled-snapshot.cjs', str(dest), '151', '0', 'ROLLBACK'])
    print(r.stdout.strip())
    print(f'RESTORED_FILES={len(files)}; HASHES=MATCH_BASELINE; LIVE_MODIFIED_FILE=UNCHANGED')
    sys.exit(0)

out.mkdir(parents=True, exist_ok=True)
target.mkdir(parents=True, exist_ok=True)
(target / '.rollback-test-copy').write_text('isolated local rollback test\n', encoding='utf-8')
for name in files:
    shutil.copy2(root / 'docs' / name, target / name)
before_hashes = json.loads((before.parent / 'hashes.json').read_text(encoding='utf-8-sig'))
for h in before_hashes:
    assert sha(Path(h['Path'])).upper() == h['Hash']
modified_hash = sha(root / 'docs/data.js')
assert modified_hash != sha(before / 'data.js')

rollback = out / 'ROLLBACK.sh'
rollback.write_text('''#!/usr/bin/env bash
set -euo pipefail
HERE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$HERE/../.." && pwd)"
cd "$ROOT"
exec python "$ROOT/scripts/recalled-evidence.py" --restore "$HERE/rollback-copy"
''', encoding='utf-8', newline='\n')
bash = r'C:\Program Files\Git\bin\bash.exe'
command([bash, '--noprofile', '--norc', '-c', 'export PATH="/usr/bin:/bin:$PATH"; chmod +x artifacts/recalled/ROLLBACK.sh; test -x artifacts/recalled/ROLLBACK.sh'])
run_specs = [
 ('BASELINE', ['node','scripts/recalled-snapshot.cjs','baseline/before-recalled/docs','151','0','BASELINE']),
 ('MODIFIED', ['node','scripts/recalled-snapshot.cjs','docs','156','5','MODIFIED']),
 ('REGRESSION', ['node','scripts/verify.cjs']),
 ('ROLLBACK', [bash,'--noprofile','--norc','-c','export PATH="/usr/bin:/bin:$PATH"; ./artifacts/recalled/ROLLBACK.sh']),
]
sections = []
for label, args in run_specs:
    r = command(args)
    command_text = subprocess.list2cmdline(args)
    (out / (label + '.txt')).write_text(r.stdout + r.stderr, encoding='utf-8')
    sections.append(f'{label}\nCOMMAND: {command_text}\nWORKDIR: {root}\nINPUT: command arguments above; no stdin\nOUTPUT:\n{r.stdout.strip()}\nEXIT_STATUS={r.returncode}\n')
assert sha(root / 'docs/data.js') == modified_hash
diff = []
for name in files:
    old = (before / name).read_text(encoding='utf-8').splitlines(True)
    new = (root / 'docs' / name).read_text(encoding='utf-8').splitlines(True)
    diff.extend(difflib.unified_diff(old,new,fromfile='a/docs/'+name,tofile='b/docs/'+name))
(out / 'DIFF_FILE.patch').write_text(''.join(diff),encoding='utf-8')
report = f'''回忆版增补验收
BRANCH=codex/bank-quiz-pages
CHANGED_FIELDS=source.kind=recalled; source.year/location/publisher/url/evidenceUrl; bankVersion; ?source=recalled; SW SKIP_WAITING
QUESTIONS=151 -> 156; RECALLED=0 -> 5; LAW=2; FINANCE=3
MODIFIED_FILE={root / 'docs/data.js'}
DIFF_FILE={out / 'DIFF_FILE.patch'}
VERIFICATION={out / 'VERIFICATION.txt'}
ROLLBACK={rollback}
BASELINE_DATA_SHA256={sha(before / 'data.js')}
MODIFIED_DATA_SHA256={modified_hash}
BASELINE_HASHES=UNCHANGED
RESTORED_BEHAVIOR=151 questions; recalled=0; all 10 baseline asset hashes restored on isolated copy; original user HTML unchanged; live156 remains modified
''' + '\n'.join(sections)
(out / 'VERIFICATION.txt').write_text(report,encoding='utf-8')
for p in [root/'docs/data.js',out/'DIFF_FILE.patch',out/'VERIFICATION.txt',rollback]:
    assert len(p.read_bytes()) > 0
print('\n'.join(s.splitlines()[0] + ': EXIT_STATUS=0' for s in sections))
print('ARTIFACTS_REOPENED=4; ROLLBACK_EXECUTABLE=YES; BASELINE_HASHES=UNCHANGED; MODIFIED_RETAINED=YES')
