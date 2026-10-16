"""D-UX10 acceptance tests for MeetingGraph.html (ratified 2026-10-11).
t30 prompt and rules · t31 Difficult fixture (rejected, golden, weaker-model rounds, repair limit)
t32 single-defect mutations · t33 sample-world regression smoke.
Run: python3 t30_t33_dux10.py <MeetingGraph.html> [<original MeetingGraph.html for the reproduction check>]
"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wb import run, TRANSCRIPT, FLAWED

HERE = os.path.dirname(os.path.abspath(__file__))
WBPATH = sys.argv[1]
ORIG = sys.argv[2] if len(sys.argv) > 2 else None
GOLD = json.load(open(os.path.join(HERE, 'golden_b.json')))
MUTS = json.load(open(os.path.join(HERE, 'mutations', 'index.json')))
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))

def with_token(reply, token):
    r = json.loads(json.dumps(reply)); r['context'] = token; return r

def dux10(w):  # D-UX10 findings as code@ref, with repair marker
    return w.js("""() => [...document.querySelectorAll('#import-out li[data-code]')].map(li => ({ code: li.dataset.code, ref: li.dataset.ref, repair: !!li.querySelector('.rule'), text: li.innerText }))""")

def cov_warn_texts(w):  # D-UX9 warn findings (no code)
    return w.js("""() => { const h = [...document.querySelectorAll('#import-out h3')].find(x => /Coverage review/.test(x.innerText)); if (!h) return [];
        return [...h.parentElement.querySelectorAll('li:not([data-code]) .msg.warn')].map(m => m.innerText); }""")

def errors(w):
    return w.js("() => document.querySelectorAll('#import-out .msg.error').length")

def has(fs, code, ref=None):
    return any(f['code'] == code and (ref is None or f['ref'] == ref or ref in f['ref'].split('+')) for f in fs)

# ---------------- t30: prompt, rules, baseline B ----------------
def t30(w):
    w.load_sample()
    token, chat = w.prepare(TRANSCRIPT)
    check('t30.1 rule 4: completion-condition test present', 'judged by how the work gets done' in chat and 'is part of that verification' in chat)
    check('t30.2 rule 4: old decomposition sentence removed', 'never one broad task' not in chat and 'one per LABEL' not in chat)
    check('t30.3 rule 4: unowned-verification sentence kept', 'names BOTH the verification and its contingency' in chat)
    check('t30.4 selfReview in output shape and described', '"selfReview": {"newVsExisting"' in chat and '"selfReview.newVsExisting" has one row per NewTasking' in chat)
    idx = chat.split('=== INDEX ===')[1].split('=== MEETING ===')[0]
    check('t30.5 baseline B: AI-204..AI-207 open and unassigned in the INDEX', all(re.search(rf'{c}\b[^\n]*\bopen\b', idx) for c in ['AI-204', 'AI-205', 'AI-206', 'AI-207']))
    probe = {'context': token, 'ops': [{'op': 'NewTasking', 'ref': 'NEW-1', 'project': 'P2', 'label': 'Verify the identified route and confirm which one to use', 'assignee': 'alvarez',
              'src': [{'seg': 'S027', 'quote': 'I need to check that it is suitable for your transfer requirements.'}]}], 'flags': []}
    out = w.validate(probe)
    check('t30.6 MATCH-02 retired: "verify ... and confirm ..." draws no split warning', 'joins two deliverables' not in out, out[:200])
    r2 = next((l for l in chat.split('\n') if l.startswith('2. Match before you create.')), '')
    check('t30.7 rule 2 (D-UX10h): matches by completion condition, with both ratified examples, right after its first sentence',
          r2.startswith('2. Match before you create. Match by completion condition, not merely by subject.')
          and 'does not absorb "verify the route is suitable"' in r2 and '"Run a test transfer with a sample file" is updated by a changed transfer window' in r2
          and 'whose subject matches an existing ACTIVE tasking' not in r2 and 'with the same completion condition as an existing ACTIVE tasking' in r2, r2[:200])
    return token

# ---------------- t31: Difficult fixture ----------------
def t31(w):
    w.load_sample()
    token, _ = w.prepare(TRANSCRIPT)
    w.validate(with_token(FLAWED, token))
    fs = dux10(w); warn9 = cov_warn_texts(w)
    rows = {
        'R01 AI-203 left undecided': has(fs, 'COV-UNRESOLVED', 'AI-203'),
        'R02 new work instead of updates': has(fs, 'COV-DEFERRED-NEW', 'AI-203') and has(fs, 'NEW-DUPLICATE', 'NEW-2') and has(fs, 'NEW-DUPLICATE', 'NEW-3'),
        'R03 coordination under-scoped (advisory)': has(fs, 'QUOTE-TRUNCATED', 'NEW-2'),
        'R04 route split': has(fs, 'OVER-SPLIT', 'NEW-4'),
        'R05 contingency lost': has(fs, 'CONTINGENCY-DROPPED', 'NEW-6'),
        'R06 (Aaron, 2026-10-12) "those materials" is not a missing deliverable': not has(fs, 'DELIVERABLE-DROPPED', 'NEW-8'),
        'R07 invitation admin in P2': all(has(fs, 'ADMIN-IN-PROJECT', r) for r in ['NEW-9', 'NEW-10', 'NEW-11', 'NEW-12']),
        'R09 conditional observer task': has(fs, 'CONDITIONAL-TASKING', 'NEW-13'),
        'R12 technical discussion unmapped': has(fs, 'DISP-ABOUT-PROJECT', 'S036') and any('S035 is classified open_question' in t for t in warn9),
        'R13 no selfReview': has(fs, 'SELF-REVIEW-MISSING'),
    }
    for k, v in rows.items(): check('t31.1 rejected reply: ' + k, v)
    check('t31.2 rejected reply: no false NEW-DUPLICATE against its own new taskings', not any(f['code'] == 'NEW-DUPLICATE' and f['ref'] in ('NEW-7', 'NEW-9', 'NEW-10', 'NEW-13') for f in fs),
          ', '.join(f"{f['code']}@{f['ref']}" for f in fs if f['code'] == 'NEW-DUPLICATE'))
    card = w.js("() => !!document.getElementById('repair-card')")
    rp = w.js("() => document.getElementById('repair-text') ? document.getElementById('repair-text').value : ''")
    items = [l for l in rp.split('\n') if re.match(r'^\d+\. ', l)]
    check('t31.3 repair card shown for the rejected reply', card)
    check('t31.4 repair prompt: grouped admin item names all four invitation taskings', any('NEW-9, NEW-10, NEW-11 and NEW-12' in l for l in items))
    check('t31.5 repair prompt: findings on removed taskings pruned', not any('NEW-11 and NEW-12 come from one request' in l for l in items) and not any('NEW-11 cites no' in l for l in items))
    check('t31.6 repair prompt asks for the complete reply', 'every operation again (not just the fixed ones)' in rp)
    # round limit
    w.click('copy-repair'); w.pg.wait_for_timeout(200)
    b1 = w.js("() => document.getElementById('copy-repair').innerText")
    w.click('copy-repair'); w.pg.wait_for_timeout(200)
    b2 = w.js("() => [document.getElementById('copy-repair').innerText, document.getElementById('copy-repair').disabled]")
    check('t31.7 repair rounds: counter advances, stops after two', b1 == 'Copy repair prompt (round 2 of 2)' and b2 == ['Two repair rounds used', True], f'{b1} / {b2}')
    w.validate(with_token(FLAWED, token))
    b3 = w.js("() => [document.getElementById('copy-repair').innerText, document.getElementById('copy-repair').disabled]")
    check('t31.8 repair rounds: limit persists across re-validation of the same meeting', b3 == ['Two repair rounds used', True], str(b3))
    # golden
    w.validate(with_token(GOLD, token))
    gfs = dux10(w); g9 = cov_warn_texts(w)
    check('t31.9 golden: no errors', errors(w) == 0, str(errors(w)))
    check('t31.10 golden: no repair-required D-UX10 findings', not any(f['repair'] for f in gfs), ', '.join(f"{f['code']}@{f['ref']}" for f in gfs if f['repair']))
    check('t31.11 golden: no D-UX9 coverage warnings', not g9, ' | '.join(g9)[:300])
    check('t31.12 golden: no repair card', not w.js("() => !!document.getElementById('repair-card')"))
    mt = w.js("""() => [...document.querySelectorAll('#import-out .msg')].map(m => m.innerText).filter(t => /Shares its subject with/.test(t))""")
    check('t31.13 golden: MATCH-01 defers to the selfReview justification', all("selfReview names" in t for t in mt), ' | '.join(mt)[:300])
    # weaker-model rounds replay
    counts = []
    for r in ['round0', 'round1', 'round2', 'round3']:
        rep = json.load(open(os.path.join(HERE, r + '.json')))
        w.validate(with_token(rep, token))
        counts.append(sum(1 for f in dux10(w) if f['repair']) + len(cov_warn_texts(w)))
    check('t31.14 weaker-model rounds: repair findings fall round over round', counts[0] > counts[1] > counts[2] > counts[3], str(counts))
    print('      weaker-model repair findings by round:', counts)
    # accept golden
    w.validate(with_token(GOLD, token))
    w.js("() => document.querySelector('#import-out [data-accept]').click()"); w.pg.wait_for_timeout(1200)
    pkg = w.last_download_text()
    check('t31.15 golden accepts; package mints AI-402..AI-406 and keeps the review record', all(c in pkg for c in ['AI-402', 'AI-406']) and 'Verify the identified route' in pkg and '"coverage"' in pkg, pkg[:120])

# ---------------- t32: mutations through the workbench ----------------
D9 = {  # D-UX9 reports these in its own words
    'COV-UNBOUND-DISPOSITION': lambda ref, w9, fs: any(t.startswith(ref + ' is classified') and 'no operation or flag cites it' in t for t in w9),
    'COV-POSSIBLE-MATCH': lambda ref, w9, fs: any(t.startswith(ref) and 'marked not discussed' in t for t in w9),
    'COV-CONTRADICTION': lambda ref, w9, fs: any(t.startswith(ref) and 'tables contradict' in t for t in w9),
}
def t32(w):
    w.load_sample()
    token, _ = w.prepare(TRANSCRIPT)
    for m in MUTS:
        rep = json.load(open(os.path.join(HERE, 'mutations', m['id'] + '.json')))
        w.validate(with_token(rep, token))
        fs, w9 = dux10(w), cov_warn_texts(w)
        missing = []
        for code, ref in m['expect']:
            ok = D9[code](ref, w9, fs) if code in D9 else has(fs, code, ref if '+' not in ref else ref.split('+')[0])
            if not ok: missing.append(f'{code}@{ref}')
        card = w.js("() => !!document.getElementById('repair-card')")
        check(f"t32 {m['id']} {m['title']}", not missing and card, 'missing ' + ', '.join(missing) + ('' if card else ' / no repair card'))
    # t32.15 (tester ruling, Oct 12): a dated task's quote must carry its timing phrase; the segment alone is not enough.
    cut = json.loads(json.dumps(GOLD))
    n1 = next(o for o in cut['ops'] if o.get('ref') == 'NEW-1')
    assert re.search(r'this morning\.?$', n1['src'][0]['quote']), 'fixture drift: NEW-1 quote'
    n1['src'][0]['quote'] = re.sub(r'\s*this morning\.?$', '', n1['src'][0]['quote'])
    out = w.validate(with_token(cut, token))
    fs = dux10(w)
    hit = has(fs, 'TIME-UNGROUNDED', 'NEW-1') or ('NEW-1: phrase "this morning" not in its quotes' in out)
    blocked = errors(w) > 0 or w.js("() => !!document.getElementById('repair-card')")
    check('t32.15 timing phrase missing from the quote (present in the segment) is caught', hit and blocked, out[:240])
    # t32.16 (D-UX10h): terra-low run 3's final reply drew "merge NEW-2 and NEW-3" and "split NEW-2" in one repair prompt.
    run3 = json.load(open(os.path.join(HERE, 'terra_run3_final.json')))
    w.validate(with_token(run3, token))
    rp = w.js("() => document.getElementById('repair-text') ? document.getElementById('repair-text').value : ''")
    check('t32.16 repair prompt never asks to merge and split the same tasking (terra-low run 3)',
          'NEW-2 bundles separate deliverables' in rp and 'NEW-2 and NEW-3 come from one request' not in rp, rp[:300])

# ---------------- t33: sample-world regression smoke ----------------
SAMPLE_TRANSCRIPT_JS = "SAMPLE_TRANSCRIPT"
def t33(w):
    w.load_sample()
    st = w.js(f"() => {SAMPLE_TRANSCRIPT_JS}")
    token, chat = w.prepare(st)
    w.click('sample-output'); w.pg.wait_for_timeout(200)
    out = w.js("() => { const r = JSON.parse(document.getElementById('llm-in').value); return JSON.stringify(r); }")
    w.click('do-validate'); w.pg.wait_for_timeout(700)
    txt = w.js("() => document.getElementById('import-out').innerText")
    check('t33.1 sample reply validates with no errors', 'Checks passed' in txt and errors(w) == 0, txt[:160])
    w.answer_as_proposed()  # D-UX11: the sample reply has no coverage tables, so it asks first (amended 2026-10-12)
    w.js("() => document.querySelector('#import-out [data-accept]').click()"); w.pg.wait_for_timeout(1200)
    pkg = w.last_download_text()
    check('t33.2 sample reply accepts; package mints AI-402 for the new agreement tasking', 'AI-402' in pkg and 'interconnection security agreement' in pkg.lower(), pkg[:120])
    for tab in ['dashboard', 'board', 'workspace']:
        w.js(f"() => {{ const b = [...document.querySelectorAll('[data-tab]')].find(x => x.dataset.tab === '{tab}'); if (b) b.click(); }}"); w.pg.wait_for_timeout(300)
    check('t33.3 no page errors across the sample flow and tabs', not w.errors, '; '.join(w.errors)[:300])

def t_repro():
    def go(w):
        w.load_sample()
        token, _ = w.prepare(TRANSCRIPT)
        check("t31.0 reproduction: original workbench + sample baseline gives the testers' token", token == FLAWED['context'], token)
    run(ORIG, go)

if ORIG: t_repro()
run(WBPATH, t30)
run(WBPATH, t31)
run(WBPATH, t32)
run(WBPATH, t33)
fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed" + ('' if not fails else f" — {len(fails)} FAILED"))
sys.exit(1 if fails else 0)
