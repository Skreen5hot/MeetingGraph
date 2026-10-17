"""Knockouts for the page code that the module knockouts (knock_v2.py) don't reach: each mutates the built page,
runs e2e_full.py, and must make its named check FAIL (a crash is not a kill). The page is always restored.
Run: python3 tests/v2/knock_page.py   (about 5 minutes per knockout)"""
import os, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = os.path.join(ROOT, 'dist', 'MeetingGraph2.html')
E2E = os.path.join(ROOT, 'tests', 'v2', 'e2e_full.py')
K = [  # the name field in the decision dialogs (Aaron, 2026-10-17)
    ('no name field in the close dialog', "      ${nameField('p-by')}\n", "", 'f35b'),
    ('the dialog name is ignored', "$('p-note').value, $('p-by').value)", "$('p-note').value)", 'f36b'),
    ('the name is not remembered', "  rememberName(by);\n", "", 'f36b'),
    ('no name field in the item dialog', "      ${nameField('d-by')}\n", "", 'f11b'),
    ('the item dialog name is ignored', "da.textContent, $('d-by').value)", "da.textContent)", 'f11c'),
    # the export as a contract (§10.30)
    ('"Export workspace" writes the old file', "EX.workspace(state.pkgs)", "{ mkg2Workspace: '1.0', exportedAt: new Date().toISOString(), packages: state.pkgs }", 'f38 '),
    ('"Export for sharing" writes the full workspace', "download(`mkg2-share-${codes.join('-')}-${today()}.json`, r.file);", "download(`mkg2-share-${codes.join('-')}-${today()}.json`, EX.workspace(state.pkgs));", 'f39 '),
    ('an export for sharing is opened as a board', "      if (EX.isReduced(p)) { shared++; continue; }", "      if (false) { shared++; continue; }", 'f40 '),
]
orig = open(P, encoding='utf-8', newline='').read()
killed = 0
try:
    for name, o, n, chk in K:
        if orig.count(o) < 1: print('MISSING ', name); continue
        open(P, 'w', encoding='utf-8', newline='').write(orig.replace(o, n))
        out = subprocess.run([sys.executable, E2E], capture_output=True, text=True, encoding='utf-8', errors='replace').stdout
        k = f'FAIL {chk}' in out; killed += k
        print('KILLED  ' if k else 'SURVIVED', name, '->', chk)
finally:
    open(P, 'w', encoding='utf-8', newline='').write(orig)
print(f'{killed} of {len(K)} page knockouts killed')
sys.exit(0 if killed == len(K) else 1)
