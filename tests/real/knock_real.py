"""Knockouts for score_real.py and make_variant.py: each mutation must make its named self-test check FAIL (a crash does
not count). Run: python3 knock_real.py"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
KNOCKS = [  # (name, script, old, new, the check that must fail)
    ('tolerance ignored', 'score_real.py', "abs(n - num(k)) <= tol)", "abs(n - num(k)) <= 0)", 'an item within 2 statements'),
    ('one item counts twice', 'score_real.py', "if n is not None and i not in used and", "if n is not None and", 'one item counts for one key statement'),
    ('notes after # read as statements', 'score_real.py', "line.split('#', 1)[0]", "line", 'the key reads statement numbers'),
    ('missed by every run not computed', 'score_real.py', "none = [k for k in key if not any(k in s['found'] for s in ok)]", "none = list(key)", 'two runs: found by every run'),
    ('a text that is not a request is changed anyway', 'make_variant.py', "if n != 1: raise ValueError", "if False: raise ValueError", 'a text that is not a request is refused'),
]
killed = 0
for name, script, old, new, check in KNOCKS:
    src = open(os.path.join(HERE, script), encoding='utf-8').read()
    if src.count(old) != 1: print(f'  BAD  {name}: expected 1 match, found {src.count(old)}'); continue
    tmp = os.path.join(HERE, '_knocked_' + script)
    open(tmp, 'w', encoding='utf-8', newline='\n').write(src.replace(old, new))
    try: p = subprocess.run([sys.executable, tmp, '--selftest'], capture_output=True, text=True, encoding='utf-8')
    finally: os.remove(tmp)
    crashed = 'checks ' not in p.stdout
    ok = not crashed and any(l.startswith('FAIL ' + check) for l in p.stdout.splitlines())
    killed += ok
    print(f'  {"KILLED" if ok else "CRASHED" if crashed else "SURVIVED"}  {name}  ->  {check}')
print(f'{killed} of {len(KNOCKS)} killed')
sys.exit(0 if killed == len(KNOCKS) else 1)
