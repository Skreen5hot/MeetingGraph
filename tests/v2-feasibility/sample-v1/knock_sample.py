"""Knockouts for the variant J kit (plan §10.20). Each mutation must make its named self-test check fail;
a crash does not count as a kill. Run: python tests/v2-feasibility/sample-v1/knock_sample.py"""
import os, re, shutil, subprocess, sys, tempfile

D = os.path.dirname(os.path.abspath(__file__))
M = [
    # (name, file, old, new, the check that must fail)
    ('wrong projects not counted', 'check_sample.js', "else if (got === want) n.right++; else n.wrong++;", "else n.right++;", 's3'),
    ('one wrong project not allowed', 'check_sample.js', "if (n.wrong + n.guessS006 > 1) fails.push(`${n.wrong + n.guessS006} new items in a wrong project (at most 1)`);\n    if (n.notClear > 2)", "if (n.wrong + n.guessS006 > 0) fails.push(`${n.wrong + n.guessS006} new items in a wrong project (at most 1)`);\n    if (n.notClear > 2)", 's4'),
    ('null counted as wrong', 'check_sample.js', "if (got === null) n.notClear++; else", "if (got === null) n.wrong++; else", 's5'),
    ('new projects allowed on the seeded board', 'check_sample.js', "if (proposals.length) fails.push", "if (false) fails.push", 's6'),
    ('S006 guess not counted', 'check_sample.js', "if (got !== null) n.guessS006++; return;", "return;", 's7'),
    ('S007 missing not caught', 'check_sample.js', "if (s007 === undefined) fails.push", "if (false) fails.push", 's8'),
    ('thread items scored', 'check_sample.js', "if (p && p.toUpperCase() !== thread.get(it.thread)) n.threadMismatch++; return;", "if (p && p.toUpperCase() !== thread.get(it.thread)) n.threadMismatch++;", 's9'),
    ('missing effort not caught', 'check_sample.js', "for (const e of ['IPR', 'PDE', 'RDM']) if", "for (const e of []) if", 'e2'),
    ('duplicates not caught', 'check_sample.js', "if (eff.filter(x => x === e).length > 1)", "if (eff.filter(x => x === e).length > 2)", 'e3'),
    ('proposal quotes not checked', 'check_sample.js', "if (!['verified', 'near'].includes(p.src))", "if (false)", 'e4'),
    ('unknown refs not caught', 'check_sample.js', "if (n.unknownCode) fails.push", "if (false) fails.push", 'e5'),
    ('proposal effort ignored', 'check_sample.js', "got = pr ? (pr.effort || 'unmapped')", "got = pr ? want_any(pr)", 'e6'),
    ('extra proposals not caught', 'check_sample.js', "if (eff.filter(x => !x).length > 1)", "if (eff.filter(x => !x).length > 2)", 'e7'),
    ('effort by first word lost', 'check_sample.js', "if (m && m.index < at)", "if (m)", 'e8'),
    ('cut replies pass', 'check_sample.js', "if (c.cut) fails.push", "if (false) fails.push", 'c1'),
    ('request: project column dropped', 'variant-j.js', "[t.id, t.project, t.kind,", "[t.id, t.kind,", 'r3'),
    ('request: the project field dropped', 'variant-j.js', "[TOPIC, TOPIC + FIELD], ", "", 'r1'),
    ('request: the new-project rule dropped on an empty board', 'variant-j.js', r"['FIELDS for each item:\n', NEWP + 'FIELDS for each item:\n'],", "", 'r2'),
    ('request: an extra line slipped in', 'variant-j.js', "const PROJECTS_INTRO = 'PROJECTS,", r"const PROJECTS_INTRO = 'Be careful.\nPROJECTS,", 'r1'),
]

def run(tmp):
    p = subprocess.run(['node', os.path.join(tmp, 'check_sample.js'), '--self-test'], capture_output=True, text=True, cwd=tmp)
    return p.returncode, p.stdout + p.stderr

def main():
    root = os.path.abspath(os.path.join(D, '..', '..', '..'))
    killed = 0
    for name, f, old, new, check in M:
        tmp = tempfile.mkdtemp()
        try:
            # The kit sits three levels below the repo root and requires ../../../src/v2/modules: mirror that.
            kit = os.path.join(tmp, 'a', 'b', 'c'); os.makedirs(kit)
            shutil.copytree(os.path.join(root, 'src', 'v2', 'modules'), os.path.join(tmp, 'src', 'v2', 'modules'))
            for x in os.listdir(D):
                if x.endswith(('.js', '.json', '.txt', '.csv')): shutil.copy(os.path.join(D, x), kit)
            s = open(os.path.join(kit, f), encoding='utf-8').read()
            n = s.count(old)
            if n != 1: print(f'BAD MUTATION {name}: matches {n}'); continue
            if 'want_any' in new: new = new.replace('want_any(pr)', "(EFFORT[it.seg] || 'unmapped')")
            open(os.path.join(kit, f), 'w', encoding='utf-8', newline='\n').write(s.replace(old, new))
            code, out = run(kit)
            hit = re.search(r'^FAIL ' + re.escape(check) + r' ', out, re.M) is not None
            crash = 'Error' in out and 'FAIL' not in out
            if hit and not crash: killed += 1; print(f'killed   {name} ({check})')
            else: print(f'SURVIVED {name} ({check}){" [crash]" if crash else ""}\n{out}')
        finally:
            shutil.rmtree(tmp, ignore_errors=True)
    print(f'\n{killed} of {len(M)} killed')
    sys.exit(0 if killed == len(M) else 1)

if __name__ == '__main__':
    main()
