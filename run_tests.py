"""Run the MeetingGraph tests against archive/v1/MeetingGraph.html (v1) and dist/MeetingGraph2.html (v2) (build it first: python3 build.py).
Usage: python3 run_tests.py [unit] [v2] [t38] [playwright] [jsdom] [knock] [all]
  unit        node unit tests and checker self-tests (seconds)
  v2          v2: unit tests, their knockouts, and the step-0 slice in the browser (about a minute)
  t38         Playwright: §16.16/§16.17 acceptance tests (about 3 minutes)
  playwright  Playwright: t30–t33, t36, t37, t38 (about 25 minutes)
  jsdom       the 27 jsdom suites (about 5 minutes; needs `npm install`)
  knock       knockouts for t38 (about 20 minutes); t37's knockouts: tests/playwright/knock_t37.py (about 90 minutes)
Default: unit v2 t38. Expected results are in CLAUDE.md."""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.abspath(__file__))
WB = os.path.join(ROOT, 'archive', 'v1', 'MeetingGraph.html')
PW = os.path.join(ROOT, 'tests', 'playwright')
U = os.path.join(ROOT, 'tests', 'unit')
OI = os.path.join(ROOT, 'tests', 'oi-feasibility')
V2 = os.path.join(ROOT, 'tests', 'v2-feasibility')
want = set(sys.argv[1:]) or {'unit', 'v2', 't38'}
if 'all' in want: want = {'unit', 'v2', 'playwright', 'jsdom', 'knock'}
if 'playwright' in want: want.add('t38')
results = []
def run(name, cmd, cwd=ROOT):
    print(f'\n=== {name}', flush=True)
    r = subprocess.run(cmd, cwd=cwd); results.append((name, r.returncode == 0))
if 'unit' in want:
    run('validator self-test', ['node', os.path.join(U, 'selftest.js')])
    run('resolution model (restest)', ['node', os.path.join(U, 'restest.js')])
    run('open items (oitest)', ['node', os.path.join(U, 'oitest.js'), os.path.join(PW, 'oi')])
    run('feasibility checker self-test (v1)', [sys.executable, os.path.join(OI, 'check_answers.py'), '--selftest'])
    run('feasibility checker self-test (v2)', [sys.executable, os.path.join(OI, 'check_answers.py'), '--v2', '--selftest'])
    run('v2 kit: reply checker self-test', [sys.executable, os.path.join(V2, 'check_reply.py'), '--selftest'], V2)
    run('v2 kit: reply checker knockouts', [sys.executable, os.path.join(V2, 'knock_check.py')], V2)
    run('v2 kit: sample (variant J) checker self-test', ['node', os.path.join(V2, 'sample-v1', 'check_sample.js'), '--self-test'])
    run('v2 kit: sample (variant J) knockouts', [sys.executable, os.path.join(V2, 'sample-v1', 'knock_sample.py')])
if 'v2' in want:
    V2T = os.path.join(ROOT, 'tests', 'v2')
    run('v2 unit tests', ['node', os.path.join(V2T, 'unit', 'v2test.js')])
    run('v2 unit knockouts', [sys.executable, os.path.join(V2T, 'knock_v2.py')])
    run('v2 slice in the browser', [sys.executable, os.path.join(V2T, 'e2e_slice.py')])
    run('v2 full page in the browser', [sys.executable, os.path.join(V2T, 'e2e_full.py')])
    RT = os.path.join(ROOT, 'tests', 'real')
    run('real-meeting scorer self-test', [sys.executable, os.path.join(RT, 'score_real.py'), '--selftest'])
    run('request variant self-test', [sys.executable, os.path.join(RT, 'make_variant.py'), '--selftest'])
    run('real-meeting tools knockouts', [sys.executable, os.path.join(RT, 'knock_real.py')])
if 'playwright' in want:
    run('t30–t33', [sys.executable, os.path.join(PW, 't30_t33_dux10.py'), WB, os.path.join(ROOT, 'src', 'base', 'MeetingGraph.orig.html')], PW)
    run('t36', [sys.executable, os.path.join(PW, 't36_dux12.py'), WB], PW)
    run('t37', [sys.executable, os.path.join(PW, 't37_phase2.py'), WB], PW)
if 't38' in want:
    run('t38', [sys.executable, os.path.join(PW, 't38_openitems.py'), WB, os.path.join(PW, 'oi')], PW)
if 'jsdom' in want:
    run('jsdom suites', [sys.executable, os.path.join(ROOT, 'tests', 'jsdom', 'runall.py'), 'local', WB])
if 'knock' in want:
    run('t38 knockouts', [sys.executable, os.path.join(PW, 'knock_t38.py'), WB, ROOT], PW)
print('\n' + '\n'.join(f'{"PASS" if ok else "FAIL"}  {n}' for n, ok in results))
sys.exit(0 if all(ok for _, ok in results) else 1)
