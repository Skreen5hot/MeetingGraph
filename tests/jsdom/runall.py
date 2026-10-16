"""Run the MeetingGraph suite against a given product file without touching the suite sources.
Each suite is copied into run_<label>/ with its /mnt/user-data/outputs/ and /tmp/ paths pointed at that folder,
then run with node; a suite passes when no output line matches false|ERROR|FAIL|BAD (the suite's own sweep rule).
Usage: python3 runall.py <label> <MeetingGraph.html> [suite ...]
Env: SUITE=<dir with the suite .js files> (default: ./jsdom-suite), FIXTURES=<fixture dir> (default: ./fixtures)
"""
import os, re, shutil, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
label, product = sys.argv[1], os.path.abspath(sys.argv[2])
ORDER = ['smoke.js'] + [f't{i}test.js' for i in range(7, 30)] + ['t34test.js', 'corrdemo.js', 'msumtest.js']
suites = sys.argv[3:] or ORDER
run = os.path.join(HERE, 'run_' + label)
os.makedirs(run, exist_ok=True)
shutil.copy(product, os.path.join(run, 'MeetingGraph.html'))
fx = os.path.abspath(os.environ.get('FIXTURES', os.path.join(HERE, 'fixtures')))
SRC = os.path.abspath(os.environ.get('SUITE', os.path.join(HERE, 'jsdom-suite')))
if os.path.isdir(fx):
    for f in os.listdir(fx): shutil.copy(os.path.join(fx, f), os.path.join(run, f))
BAD = re.compile(r'false|ERROR|FAIL|BAD', re.I)
summary = []
for s in suites:
    src = os.path.join(SRC, s)
    if not os.path.exists(src): summary.append((s, 'missing', [])); continue
    code = open(src, encoding='utf-8').read().replace("'/tmp/", "'" + run + '/').replace('/mnt/user-data/outputs/', run + '/')  # /tmp first: run may itself live under /tmp
    dst = os.path.join(run, s); open(dst, 'w', encoding='utf-8').write(code)
    try:
        p = subprocess.run(['node', dst], cwd=run, capture_output=True, text=True, timeout=240)
        out = (p.stdout + p.stderr)
    except subprocess.TimeoutExpired:
        out = 'TIMEOUT'
    lines = [l for l in out.splitlines() if BAD.search(l) and 'navigation' not in l and 'Not implemented' not in l]
    missing = re.findall(r"ENOENT[^']*'([^']+)'", out)
    status = 'NO-FIXTURE' if missing else ('OK' if not lines else 'PROBLEMS')
    summary.append((s, status, missing[:1] if missing else lines[:6]))
    open(os.path.join(run, s + '.out'), 'w').write(out)
for s, st, detail in summary:
    print(f'{s:14} {st}' + ('' if st == 'OK' else '  ' + ' | '.join(d[:150] for d in detail)))
print(f"\n{label}: {sum(1 for x in summary if x[1]=='OK')} OK, {sum(1 for x in summary if x[1]=='PROBLEMS')} with problems, {sum(1 for x in summary if x[1]=='NO-FIXTURE')} missing fixtures")
