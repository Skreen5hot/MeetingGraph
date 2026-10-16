"""Knockouts for §16.16: each mutation must make its named check(s) fail (strict: a crash is not a kill).
Node mutations run oitest.js on a mutated copy of the module; page mutations run t38 sections on a mutated build.
Run: python3 knock_t38.py <MeetingGraph.html> <repo root> [KN=K01,K02]
(The repo root holds src/modules/openitems.js, src/modules/validator.js and tests/unit/oitest.js.)"""
import os, sys, re, shutil, subprocess, tempfile
WB, MG = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
HERE = os.path.dirname(os.path.abspath(__file__))
ONLY = set(filter(None, os.environ.get('KN', '').split(',')))

# (id, where, old, new, section or None, checks that must fail)
K = [
  ('K01', 'openitems.js', "else if (!a.quote || !normq(segText.get(a.seg)).includes(normq(a.quote))) why = `the quote is not in ${a.seg}`;", "", None, ['o20']),
  ('K02', 'openitems.js', "if (!support) why = `an owner answer needs a Reassign on ${it.target} citing ${a.seg}`;", "", None, ['o21', 'o22']),
  ('K03', 'openitems.js', "else if (!segText.has(a.seg)) why = `segment ${a.seg || '(none)'} is not in this meeting`;", "", None, ['o26']),
  ('K04', 'openitems.js', "if (it.qkind === 'who') a.match = a0.match; else matchIgnored = true;", "a.match = a0.match;", None, ['o16']),
  ('K05', 'openitems.js', "srcSegs(o).has(a.seg) && fullName(o.name));", "srcSegs(o).has(a.seg));", None, ['o23']),
  ('K06', 'openitems.js', "if (!it) why = 'its item ID is not one of the open items sent (IDs must match exactly)';", "if (!it) { why = null; continue; }", None, ['o19']),
  ('K07', 'openitems.js', "if (hit) out.push({ index: i, item: hit.item });", "", None, ['o18']),
  ('K08', 'openitems.js', "if (parts.length !== 4 || !/^\\d{8}T\\d{6}Z$/.test(parts[0]) || !/^S\\d{3,}$/.test(parts[1])) continue;", "", None, ['o11']),
  ('K09', 'validator.js', "const nm = newPartyName(owner); if (!nm) return sameParty(owner, speaker);", "return sameParty(owner, speaker);", None, ['o31']),
  ('K10', 'validator.js', "const answered = arr(ctx.identityRefs).includes(o.id);", "const answered = false;", None, ['o34']),
  ('K11', 'openitems.js', "if (seenItem.has(a.item)) why", "if (false) why", None, ['o28']),
  # Page mutations (the built workbench).
  ('K21', 'html', '<input type="checkbox" data-oi-close="${esc(a.item)}"${o.close.has(a.item) ? " checked" : ""}>', '<input type="checkbox" data-oi-close="${esc(a.item)}" checked>', 'c', ['t38.10']),
  ('K22', 'html', 'const closed = a.status === "answered" && o.close.has(a.item);', 'const closed = a.status === "answered";', 'e', ['t38.26', 't38.30']),
  ('K23', 'html', 'if (o.close.size && !nm) return { error:', 'if (false) return { error:', 'e', ['t38.25']),
  ('K24', 'html', 'if (repeats.has(fi)) continue;', '', 'e', ['t38.33']),
  ('K25', 'html', 'var RES_ACTIONS = false;', 'var RES_ACTIONS = true;', 'e', ['t38.32']),
  ('K26', 'html', '    state.prepared.openItems = oiOpenList(S, meetingAt, sameId);\n', '    state.prepared.openItems = [];\n', 'a', ['t38.1', 't38.2']),
  ('K27', 'html', '${a.status === "answered"\n        ? `<label class="chk">', '${a.status !== "zz"\n        ? `<label class="chk">', 'c', ['t38.11']),
  ('K28', 'html', 'RES.attach(items, [...pkState.flatMap(p => p.resolutions || []), ...oiRecords(pkState)]);', 'RES.attach(items, pkState.flatMap(p => p.resolutions || []));', 'e', ['t38.29', 't38.34']),
  ('K29', 'html', 'const pk = state.packages.filter(p => toMs(p.meeting.meetingAt) <= upTo && p.meeting.id !== cur.excludeId);', 'const pk = state.packages.filter(p => true);', 'e', ['t38.37']),
  ('K30', 'html', 'oiOnValidated(llm);\n', '', 'c', ['t38.8']),
  ('K31', 'html', '<div class="oi-assoc"><span class="res-k">Associated with</span> ${assoc}</div>', '', 'g', ['t38.41']),
  ('K32', 'html', 'const assoc = it.tasks.length ? it.tasks.map(t => entBtn(S, t.iri)).join(" ")', 'const assoc = it.tasks.length ? it.tasks.map(t => esc(t.code + " " + t.label)).join(" ")', 'g', ['t38.42']),
  ('K34', 'html', 'for (const it of its) {\n        const heads', 'for (const it of its.slice(0, 1)) {\n        const heads', 'h', ['t38.49', 't38.50']),
  ('K35', 'html', 'if (reason.length < 3) return err("Give a short reason.");', '', 'h', ['t38.48', 't38.55']),
  ('K36', 'html', 'const pkState = cur.excludeId ? state.packages.filter(p => p.meeting.id !== cur.excludeId) : pk;', 'const pkState = pk;', 'h', ['t38.54']),
  ('K37', 'html', 'note, supersedes:heads.map(r => r.id), seen:heads.map(r => r.id),', 'note, supersedes:[], seen:heads.map(r => r.id),', 'h', ['t38.56']),
  ('K38', 'html', 'var RES_DISMISS = true, oiSel = new Set();', 'var RES_DISMISS = false, oiSel = new Set();', 'h', ['t38.46', 't38.47']),
  ('K39', 'html', '${RES_ACTIONS ? `<details class="lbl-src res-change">', '${true ? `<details class="lbl-src res-change">', 'h', ['t38.53']),
  ('K33', 'html', '${withTask && RES_ACTIONS && it.tasks.length ?', '${withTask && it.tasks.length ?', 'g', ['t38.44']),
]

def run_node(dirpath):
    p = subprocess.run(['node', os.path.join(dirpath, 'tests', 'unit', 'oitest.js'), os.path.join(HERE, 'oi')], capture_output=True, text=True, timeout=120)
    return p.stdout + p.stderr

def run_page(path, section):
    env = {**os.environ, 'T38_ONLY': section}
    p = subprocess.run([sys.executable, os.path.join(HERE, 't38_openitems.py'), path, os.path.join(HERE, 'oi')], capture_output=True, text=True, timeout=900, env=env)
    return p.stdout + p.stderr

ok_all = True
for kid, where, old, new, section, names in K:
    if ONLY and kid not in ONLY: continue
    tmp = tempfile.mkdtemp()
    try:
        if where == 'html':
            src = open(WB, encoding='utf-8').read(); n = src.count(old)
            if n != 1: print(f'{kid} BAD MUTATION (found {n})'); ok_all = False; continue
            path = os.path.join(tmp, 'MeetingGraph.html'); open(path, 'w', encoding='utf-8').write(src.replace(old, new))
            out = run_page(path, section)
        else:
            os.makedirs(os.path.join(tmp, 'src', 'modules')); os.makedirs(os.path.join(tmp, 'tests', 'unit'))
            for f in ('openitems.js', 'validator.js'): shutil.copy(os.path.join(MG, 'src', 'modules', f), os.path.join(tmp, 'src', 'modules'))
            shutil.copy(os.path.join(MG, 'tests', 'unit', 'oitest.js'), os.path.join(tmp, 'tests', 'unit'))
            where = os.path.join('src', 'modules', where)
            src = open(os.path.join(tmp, where), encoding='utf-8').read(); n = src.count(old)
            if n != 1: print(f'{kid} BAD MUTATION (found {n})'); ok_all = False; continue
            open(os.path.join(tmp, where), 'w', encoding='utf-8').write(src.replace(old, new))
            out = run_node(tmp)
        failed = {re.match(r'FAIL (\S+)', l).group(1) for l in out.splitlines() if l.startswith('FAIL ')}
        crashed = 'section crashed' in out or 'Error' in out.split('\n')[0]
        hit = [x for x in names if x in failed or any(f.startswith(x + '.') for f in failed)]
        killed = len(hit) == len(names) and not crashed
        ok_all &= killed
        print(f'{kid} {"killed" if killed else "SURVIVED"}  expected {names}, failed {sorted(failed)[:8]}{" (crash)" if crashed else ""}')
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
print('\nall knockouts killed' if ok_all else '\nSOME KNOCKOUTS SURVIVED')
sys.exit(0 if ok_all else 1)
