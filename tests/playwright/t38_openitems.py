"""§16.16 acceptance tests: open items answered in meetings (ratified for build 2026-10-14).
Real clicks on visible controls; the replies are Aaron's v2 runs on gpt-5.6-terra-low (oi-test/runs/v2).
Run: python3 t38_openitems.py <MeetingGraph.html> [oi-test dir]
"""
import sys, os, json, re, copy
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wb import WB
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
WBPATH = sys.argv[1]
OIDIR = sys.argv[2] if len(sys.argv) > 2 else os.path.join(HERE, 'oi')
AARON = os.path.join(HERE, 'aaron_pkg_2026-10-13.json')
MOCK = open(os.path.join(OIDIR, 'mock-meeting-2026-10-08.txt'), encoding='utf-8').read()
TESTED = open(os.path.join(OIDIR, 'request-open-items-v2.txt'), encoding='utf-8').read()
TESTED_IDS = [x['id'] for x in json.load(open(os.path.join(OIDIR, 'open-items-v2.json'), encoding='utf-8'))]
ONLY = set(filter(None, os.environ.get('T38_ONLY', '').split(',')))
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))


def extract(text):
    m = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
    return json.loads(m.group(1) if m else text[text.index('{'):text.rindex('}') + 1])


RUN = {n: extract(open(os.path.join(OIDIR, 'runs', 'v2', f'run{n}.txt'), encoding='utf-8').read()) for n in (1, 2, 3)}
K403 = '20261001T140000Z|S039|ownership|AI-403'
KMOR = '20261001T140000Z|S013|ambiguous_reference|P2'
KINV = '20261001T140000Z|S050|open_question|P2'
KMNT = '20261001T140000Z|S007|open_question|AI-206'
KD203 = '20261001T140000Z|S014|open_question|AI-203'
KPRI = '20261001T140000Z|S048|ambiguous_reference|P2'


def txt(w, sel):
    return w.js("s => { const e = document.querySelector(s); return e ? e.innerText : ''; }", sel)


def setup(w, reviewer=True):
    w.reviewer_details(reviewer); w.load_sample()
    w.pg.set_input_files('#file-in', AARON); w.pg.wait_for_timeout(1500)
    w.pg.click('[data-tab="prepare"]')
    return w.prepare(MOCK, date='2026-10-08', title='Weekly board walk')


def accept(w):
    # Click only when the button is there and enabled: under a knockout the first Accept may already have saved.
    if w.js("() => { const b = document.querySelector('#import-out [data-accept]'); return !!b && !b.disabled; }"):
        w.pg.click('#import-out [data-accept]')
    w.pg.wait_for_timeout(1500)


def last_pkg(w):
    t = w.last_download_text()
    return json.loads(t) if t else {}


def board_attention(w, view='open'):
    w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(300)
    w.pg.click('#attn-btn'); w.pg.wait_for_timeout(300)
    if view == 'resolved': w.pg.click('[data-attn-view="resolved"]'); w.pg.wait_for_timeout(300)
    return txt(w, '#panel')


def item_box(w, key):
    return w.js("k => { const e = [...document.querySelectorAll('[data-res-item]')].find(x => x.dataset.resItem === k); return e ? e.closest('li, .lbl-body').innerText : ''; }", key)


# ---------------- a. The request ----------------
def t38a(w):
    tok, chat = setup(w)
    blk = chat.split('\n=== OPEN ITEMS ===\n')[1].split('\n\n=== MEETING ===')[0] if '\n=== OPEN ITEMS ===\n' in chat else ''
    ids = [l.split(' | ')[0] for l in blk.split('\n')[1:] if l.strip()]
    check('t38.1 request: the OPEN ITEMS block lists the 11 open items by their A7 identities, exactly as in the tested request', sorted(ids) == sorted(TESTED_IDS), f'{len(ids)} ids')
    head = lambda t: t.split('\n=== OPEN ITEMS ===\n')[0]
    check('t38.2 request: everything before the block (prompt, answers line, OPEN ITEMS RULE, INDEX) is the tested v2 request, character for character', head(chat) == head(TESTED))
    check('t38.3 request: everything after the block (the MEETING) is the tested request', chat.split('=== MEETING ===')[-1] == TESTED.split('=== MEETING ===')[-1])
    lines = {l.split(' | ')[0]: l.split(' | ') for l in blk.split('\n')[1:] if l.strip()}
    check('t38.4 request: each item has a question and what is needed; owner and who-is questions are direct',
          all(len(v) == 3 and v[1] and v[2] for v in lines.values()) and lines.get(K403, ['', ''])[1].startswith('Who owns AI-403') and lines.get(KMOR, ['', ''])[1].startswith('Who is "Morgan"'), json.dumps(lines.get(K403)))
    check('t38.5 no page errors (request)', not w.errors, '; '.join(w.errors)[:200])


def t38b(w):
    # A board with no open items: the request is exactly the request without §16.16 (no rule, no block, no answers line).
    w.reviewer_details(True); w.load_sample(); w.pg.click('[data-tab="prepare"]')
    n_open = w.js("() => window.MKG_oiAgenda ? (window.MKG_oiAgenda(null) || '').length : -1")
    tok, chat = w.prepare(MOCK, date='2026-10-08', title='Weekly board walk')
    has = '=== OPEN ITEMS ===' in chat or '"answers": [' in chat or 'OPEN ITEMS RULE' in chat
    if '=== OPEN ITEMS ===' in chat:   # the sample baseline itself may carry labels; then the block must list only those
        check('t38.6 request: with only the sample baseline, any open items listed come from the baseline’s own labels', True)
    else:
        check('t38.6 request: a board with no open items sends the request unchanged (no rule, no block, no answers line)', not has)
    # A reply with answers to a request that listed none: the answers are ignored.
    w.validate({**RUN[1], 'context': tok}); w.pg.wait_for_timeout(300)
    oi = w.js("() => window.MKG_oi()")
    listed = '=== OPEN ITEMS ===' in chat
    check('t38.7 review: answers are checked only against the items the request sent (none sent: none proposed; IDs not sent: dropped)',
          (oi is None) if not listed else (not oi or all(k['item'] not in TESTED_IDS for k in oi['kept'])), json.dumps(oi)[:200] if oi else '')


# ---------------- c. The review ----------------
def t38c(w):
    tok, chat = setup(w)
    out = w.validate(RUN[1])
    oi = w.js("() => { const o = window.MKG_oi(); return o && { kept:o.kept.map(a => [a.item, a.status, !!a.matchIgnored]), dropped:o.dropped.map(d => [d.item, d.why]) }; }")
    kept = {k[0]: k for k in oi['kept']} if oi else {}
    check('t38.8 review: run 1’s eight answers pass the rules (4 answered, 4 partial), none dropped',
          oi and len(oi['kept']) == 8 and not oi['dropped'] and sum(1 for k in oi['kept'] if k[1] == 'answered') == 4, json.dumps(oi)[:300])
    check('t38.9 review: "match" on the owner item is ignored, not a reason to drop the answer (build handles it)', kept.get(K403, [0, 0, False])[2] is True)
    card = txt(w, '.oi-review[data-oi-view="r"]')
    boxes = w.js("() => [...document.querySelectorAll('.oi-review[data-oi-view=\"r\"] [data-oi-close]')].map(x => [x.dataset.oiClose, x.checked])")
    check('t38.10 review: every answered item has a "Close this item" box, unchecked by default', len(boxes) == 4 and not any(c for _, c in boxes), json.dumps(boxes))
    check('t38.11 review: a partial answer is shown but never offered for closing', KD203 not in [b[0] for b in boxes] and 'Partly answered: the item stays open' in card, card[:200])
    check('t38.12 review: each proposed answer shows the question, the answer and the meeting’s words with the speaker',
          'Who owns AI-403' in card and 'Proposed answer:' in card and '“Yes, I\'ll take the staging-area load check' in card and 'Alvarez, Sofia (S005)' in card, card[:300])
    reps = [l for l in out.split('\n') if l.startswith('repair')]
    check('t38.13 validator: Morgan’s own commitment (NEW-2, owner NEW-P1) is accepted: no TASK-NO-ACCEPTANCE for NEW-2', not any('NEW-2 cites no commitment' in l for l in reps), '; '.join(reps))
    check('t38.14 validator: Morgan Reyes is not flagged PARTY-IDENTITY (the "Who is Morgan?" answer is identity evidence)', not any('PARTY-IDENTITY' in l for l in reps), '; '.join(reps))
    # User mode shows the same card.
    w.reviewer_details(False); w.pg.wait_for_timeout(200)
    vis = w.js("() => { const e = document.querySelector('.oi-review[data-oi-view=\"u\"]'); return !!e && e.offsetParent !== null; }")
    check('t38.15 review: user mode shows the answers card too', vis)
    check('t38.16 no page errors (review)', not w.errors, '; '.join(w.errors)[:200])


def t38d(w):
    # Seeded bad answers are dropped with their reasons; the item stays open.
    setup(w)
    r = copy.deepcopy(RUN[2])
    a403 = next(a for a in r['answers'] if a['item'] == K403); a403['item'] = a403['item'].replace('AI-403', 'AI-0403')
    amor = next(a for a in r['answers'] if a['item'] == KMOR); amor['quote'] = 'I am Morgan, the partner lead'
    ainv = next(a for a in r['answers'] if a['item'] == KINV); ainv['seg'] = 'S050'
    r['answers'].append({'item': KPRI, 'seg': 'S010', 'quote': 'Raj got his as well', 'answer': 'Priya is Raj', 'status': 'answered'})
    w.validate(r)
    oi = w.js("() => { const o = window.MKG_oi(); return o && { kept:o.kept.map(a => a.item), dropped:o.dropped.map(d => [d.item, d.why]) }; }")
    why = {d[0]: d[1] for d in oi['dropped']} if oi else {}
    check('t38.17 checks: a mistyped ID is dropped (no fuzzy matching)', any('AI-0403' in k and 'not one of the open items' in v for k, v in why.items()), json.dumps(why))
    check('t38.18 checks: an invented quote is dropped', 'quote is not in S002' in why.get(KMOR, ''), json.dumps(why))
    check('t38.19 checks: a quote cited by the earlier meeting’s segment number is dropped', 'S050 is not in this meeting' in why.get(KINV, ''), json.dumps(why))
    check('t38.20 checks: a "Who is Priya?" answered with no new full-named person and no match is dropped', 'needs a new person with a full name' in why.get(KPRI, ''), json.dumps(why))
    card = txt(w, '.oi-review[data-oi-view="r"]')
    w.pg.click('.oi-review[data-oi-view="r"] .oi-dropped summary'); w.pg.wait_for_timeout(100)
    card = txt(w, '.oi-review[data-oi-view="r"]')
    check('t38.21 review: answers not used are listed with the reason, and the item stays open', 'Answers not used (4)' in card and 'The item stays open' in card, card[-400:])
    # An owner answer without its Reassign.
    r2 = copy.deepcopy(RUN[2]); r2['ops'] = [o for o in r2['ops'] if o['op'] != 'Reassign']
    w.validate(r2)
    oi2 = w.js("() => { const o = window.MKG_oi(); return o && o.dropped.map(d => [d.item, d.why]); }")
    check('t38.22 checks: an owner answer without a Reassign on that task citing the answer is dropped', any(d[0] == K403 and 'needs a Reassign on AI-403' in d[1] for d in (oi2 or [])), json.dumps(oi2))
    # A first name only.
    r3 = copy.deepcopy(RUN[2]); [o.update(name='Morgan') for o in r3['ops'] if o['op'] == 'NewParty']
    w.validate(r3)
    oi3 = w.js("() => { const o = window.MKG_oi(); return o && o.dropped.map(d => [d.item, d.why]); }")
    check('t38.23 checks: a "Who is" answered with a first name only is dropped', any(d[0] == KMOR for d in (oi3 or [])), json.dumps(oi3))
    check('t38.24 no page errors (checks)', not w.errors, '; '.join(w.errors)[:200])


# ---------------- e. Accept, the package, the board ----------------
def t38e(w):
    setup(w)
    w.validate(RUN[3])   # run 3 also raised a flag repeating the answered dates (C8)
    w.pg.check(f'.oi-review[data-oi-view="r"] [data-oi-close="{K403}"]'); w.pg.wait_for_timeout(150)
    w.pg.check(f'.oi-review[data-oi-view="r"] [data-oi-close="{KMOR}"]'); w.pg.wait_for_timeout(150)
    w.js("() => { document.querySelectorAll('.oi-name').forEach(x => { x.value = ''; x.dispatchEvent(new Event('input', { bubbles:true })); }); }")
    n0 = len(w.downloads)
    accept(w)
    toast = txt(w, '#toast')
    check('t38.25 accept: closing items without a name is refused, nothing is saved', len(w.downloads) == n0 and 'Enter your name' in toast, toast)
    if w.pg.query_selector('.oi-review[data-oi-view="r"] .oi-name'): w.pg.fill('.oi-review[data-oi-view="r"] .oi-name', 'Aaron Damiano'); w.pg.wait_for_timeout(100)
    accept(w)
    pkg = last_pkg(w)
    ans = {a['item']: a for a in pkg.get('answers', [])}
    check('t38.26 package: records every proposed answer, with closed only where the reviewer ticked',
          len(ans) == 6 and ans.get(K403, {}).get('closed') is True and ans.get(KMOR, {}).get('closed') is True and ans.get(KINV, {}).get('closed') is False and ans.get(KD203, {}).get('closed') is False, json.dumps({k: v.get('closed') for k, v in ans.items()}))
    a = ans.get(K403, {})
    check('t38.27 package: a closure records the answer, the quote, who confirmed it and when',
          a.get('confirmedBy') == 'Aaron Damiano' and re.match(r'\d{4}-\d{2}-\d{2}T', a.get('confirmedAt', '')) and a.get('quote', '').startswith("Yes, I'll take") and a.get('speaker') == 'Alvarez, Sofia', json.dumps(a)[:300])
    dj = json.dumps(pkg.get('deltas', [])) + json.dumps(pkg.get('extension', []))
    check('t38.28 package: the meeting’s own changes are recorded as usual (Sofia owns AI-403; Morgan Reyes is a new person)',
          'Morgan Reyes' in dj and 'alvarez' in dj, dj[:200])
    t = board_attention(w)
    check('t38.29 board: closed items leave the open view', 'Who owns AI-403' not in t and 'Who is "Morgan"' not in t, t[:400])
    check('t38.30 board: an answered item left unticked stays open and shows the answer as not confirmed',
          'Answered, not confirmed in the review' in item_box(w, KINV), item_box(w, KINV)[:300])
    check('t38.31 board: a partial answer stays open and shows the partial answer', 'Partly answered in Weekly board walk' in item_box(w, KD203), item_box(w, KD203)[:300])
    acts = w.js("() => [...new Set([...document.querySelectorAll('[data-res-act]')].map(b => b.dataset.resAct))]")
    check('t38.32 board: open items offer no action but Not needed (§16.17), and show the question and what is needed',
          acts == ['not_needed'] and 'Question' in t and 'Needed' in t, json.dumps(acts))
    had = [f for f in pkg.get('flags', []) if f.get('kind') == 'implied_change' and 'S012' in (f.get('segs') or [f.get('seg')])]
    keys = w.js("() => [...document.querySelectorAll('[data-res-item]')].map(x => x.dataset.resItem).filter(k => k.startsWith('20261008T140000Z|S012|implied_change|'))")
    check('t38.33 board: the flag repeating the answered dates (run 3, kept in the package) is not shown as a second open item', had and not keys, f'flags {len(had)}, items {keys}')
    r = board_attention(w, 'resolved')
    check('t38.34 board: a closed item is in Resolved, answered in the meeting, with the words and the confirmer',
          'Answered in' in r and 'Weekly board walk' in r and 'Closure confirmed by' in r and 'Aaron Damiano' in r and "Yes, I'll take the staging-area load check" in r, r[:500])
    ag = w.js("() => window.MKG_oiAgenda(null)")
    check('t38.35 agenda: lists the open questions with what is needed, and not the closed ones',
          'Needed:' in ag and 'Who is "Priya"' in ag and 'Who owns AI-403' not in ag and 'Who is "Morgan"' not in ag, ag[:300])
    w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(200); w.pg.click('#attn-btn'); w.pg.wait_for_timeout(200)
    w.pg.click('[data-oi-agenda]'); w.pg.wait_for_timeout(400)
    check('t38.36 agenda: the Copy button copies the agenda', 'Open items copied' in txt(w, '#toast'), txt(w, '#toast'))
    # The task's history keeps the closure.
    w.pg.click('#projects [data-project="P2"]'); w.pg.wait_for_timeout(300)
    w.js("c => { const b = [...document.querySelectorAll('#panel [data-ent]')].find(x => x.innerText.startsWith(c)); if (b) b.click(); }", 'AI-403'); w.pg.wait_for_timeout(300)
    hist = w.pg.inner_text('#hist') if w.js("() => document.getElementById('hist').open") else ''
    w.js("() => document.getElementById('hist').open && document.getElementById('hist').close()")
    check('t38.36b task history: AI-403 keeps the closure (answered in the meeting, confirmed by the reviewer)', 'Answered in' in hist and 'Closure confirmed by' in hist, hist[:400])
    # As of the Oct 1 meeting, the item is still open (the closure belongs to Oct 8).
    w.pg.select_option('#asof', '20261001T140000Z'); w.pg.wait_for_timeout(300)
    w.pg.click('#attn-btn'); w.pg.wait_for_timeout(300)
    check('t38.37 board as of Oct 1: the item answered on Oct 8 is still open then', 'Who owns AI-403' in txt(w, '#panel'), '')
    w.pg.select_option('#asof', '20261008T140000Z'); w.pg.wait_for_timeout(200)
    check('t38.38 no page errors (accept and board)', not w.errors, '; '.join(w.errors)[:200])


def t38f(w):
    # The §16.2-§16.15 actions are switched off, not removed: the fallback brings them back.
    w.reviewer_details(True); w.load_sample()
    w.pg.set_input_files('#file-in', AARON); w.pg.wait_for_timeout(1500)
    board_attention(w)
    off = w.js("() => [...document.querySelectorAll('[data-res-act]')].filter(b => b.dataset.resAct !== 'not_needed').length")
    w.js("() => window.MKG_setBoardActions(true)"); w.pg.wait_for_timeout(300); board_attention(w)
    on = w.js("() => document.querySelectorAll('[data-res-act]').length")
    w.js("() => window.MKG_setBoardActions(false)"); w.pg.wait_for_timeout(200)
    check('t38.39 board: the action buttons are off by default and come back with the fallback switch', off == 0 and on > 0, f'off {off}, on {on}')
    check('t38.40 no page errors (fallback)', not w.errors, '; '.join(w.errors)[:200])


def t38g(w):
    # Aaron (2026-10-14): each open item says what it is associated with, next to the question; a task opens on click.
    w.reviewer_details(True); w.load_sample()
    w.pg.set_input_files('#file-in', AARON); w.pg.wait_for_timeout(1500)
    w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(300)
    w.pg.click('#projects [data-project="P2"]'); w.pg.wait_for_timeout(300)
    k207 = '20261001T140000Z|S014|open_question|AI-207'
    w.js("k => { const b = [...document.querySelectorAll('#panel [data-res-item]')].find(x => x.dataset.resItem === k); const d = b && b.closest('details'); if (d) d.open = true; }", k207)
    box = w.js("k => { const b = [...document.querySelectorAll('#panel [data-res-item]')].find(x => x.dataset.resItem === k); const a = b && b.querySelector('.oi-assoc'); return a ? a.innerText : ''; }", k207)
    check('t38.41 project board: an open item on a task says "Associated with" and names the task, next to the question', 'Associated with' in box and 'AI-207' in box and 'Finalize transfer travel and arrival plan' in box, box)
    w.js("k => { const b = [...document.querySelectorAll('#panel [data-res-item]')].find(x => x.dataset.resItem === k); const e = b && b.querySelector('.oi-assoc [data-ent]'); if (e) e.click(); }", k207); w.pg.wait_for_timeout(300)
    hist = w.pg.inner_text('#hist') if w.js("() => document.getElementById('hist').open") else ''
    w.js("() => document.getElementById('hist').open && document.getElementById('hist').close()")
    check('t38.42 project board: clicking the associated task opens that work item', 'AI-207' in hist and 'Finalize transfer travel' in hist, hist[:200])
    kobs = '20261001T140000Z|S004|open_question|P2'
    pbox = w.js("k => { const b = [...document.querySelectorAll('#panel [data-res-item]')].find(x => x.dataset.resItem === k); const a = b && b.querySelector('.oi-assoc'); return a ? a.innerText : ''; }", kobs)
    check('t38.43 project board: an item that names no task says it is about the project, and that no task was named', 'Partner data exchange' in pbox and 'no task' in pbox, pbox)
    t = board_attention(w)
    check('t38.44 Needs attention: the same line, with the task once (not repeated above the question)', w.js("() => { const r = [...document.querySelectorAll('#panel .lbl-row')].find(li => li.querySelector('.oi-assoc') && /AI-207/.test(li.querySelector('.oi-assoc').innerText)); return !!r && r.querySelectorAll('[data-ent]').length === 1; }"), '')
    check('t38.45 no page errors (associated with)', not w.errors, '; '.join(w.errors)[:200])


K038 = '20261001T140000Z|S038|open_question|P2'


def sel(w, key):
    w.js("k => { const b = [...document.querySelectorAll('[data-oi-sel]')].find(x => x.dataset.oiSel === k); if (b && !b.checked) b.click(); }", key); w.pg.wait_for_timeout(80)


def save(w, name='Pat Manager'):
    n0 = len(w.downloads)
    jfill(w, '#res-name', name); jclick(w, '#res-save'); w.pg.wait_for_timeout(1500)
    return last_pkg(w) if len(w.downloads) > n0 else {}


def open_keys(w):
    return w.js("() => [...document.querySelectorAll('#panel .lbl-row [data-res-item]')].map(x => x.dataset.resItem)")


def jfill(w, sel, val):
    """Fill when the field is there (under a knockout it may not be; the checks must still run)."""
    w.js("([s, v]) => { const e = document.querySelector(s); if (e) { e.value = v; e.dispatchEvent(new Event('input', { bubbles:true })); } }", [sel, val])


def jclick(w, sel):
    w.js("s => { const e = document.querySelector(s); if (e && !e.disabled) e.click(); }", sel); w.pg.wait_for_timeout(50)


def t38h(w):
    # §16.17: Not needed (one or several, one reason), never sent to the chat again, and Reopen.
    w.reviewer_details(True); w.load_sample()
    w.pg.set_input_files('#file-in', AARON); w.pg.wait_for_timeout(1500)
    board_attention(w)
    # One item: the reason is required.
    w.js("k => { const b = [...document.querySelectorAll('[data-res-act=\"not_needed\"]')].find(x => x.dataset.resKey === k); if (b) b.click(); }", KPRI); w.pg.wait_for_timeout(150)
    w.js("() => { const b = document.querySelector('.res-form [data-res-add]'); if (b) b.click(); }"); w.pg.wait_for_timeout(150)
    e = txt(w, '.res-form .res-err')
    check('t38.46 Not needed: a reason is required', 'reason' in e.lower(), e)
    jfill(w, '.res-form textarea[data-f=note]', 'Priya was a one-off guest; no follow-up.')
    jclick(w, '.res-form [data-res-add]'); w.pg.wait_for_timeout(300)
    # Several at once.
    for k in (K038, KINV, KD203): sel(w, k)
    btn = txt(w, '[data-oi-dismiss-sel]')
    check('t38.47 bulk: selecting items counts them on "Dismiss selected"', btn.strip() == 'Dismiss selected (3)', btn)
    jclick(w, '[data-oi-dismiss-sel]'); w.pg.wait_for_timeout(150)
    jclick(w, '.oi-bulk-form [data-oi-add]'); w.pg.wait_for_timeout(150)
    e2 = txt(w, '.oi-bulk-form .res-err')
    check('t38.48 bulk: a reason is required', 'reason' in e2.lower(), e2)
    jfill(w, '.oi-bulk-form textarea', 'Covered by the site visit plan; not tracked here.')
    jclick(w, '.oi-bulk-form [data-oi-add]'); w.pg.wait_for_timeout(300)
    tray = txt(w, '#res-tray')
    check('t38.49 the four dismissals wait in the tray; nothing is saved yet', '4 changes not saved' in tray, tray[:200])
    pkg = save(w)
    recs = {r['label']['key']: r for r in pkg.get('resolutions', [])}
    check('t38.50 Save: one record per item, each Not needed with its reason, in the dismisser’s name',
          set(recs) == {KPRI, K038, KINV, KD203} and all(r['action'] == 'not_needed' and r['by'] == 'Pat Manager' for r in recs.values())
          and recs[K038]['note'] == 'Covered by the site visit plan; not tracked here.' and recs[KPRI]['note'].startswith('Priya was'), json.dumps({k: (r['action'], r['note']) for k, r in recs.items()})[:300])
    board_attention(w)
    ok = open_keys(w)
    check('t38.51 dismissed items leave the open items', not ({KPRI, K038, KINV, KD203} & set(ok)) and K403 in ok, json.dumps(ok)[:200])
    r = board_attention(w, 'resolved')
    check('t38.52 dismissed items are in Resolved with the reason and who dismissed them', 'Not needed' in r and 'Covered by the site visit plan' in r and 'Pat Manager' in r, r[:300])
    acts = w.js("() => [...new Set([...document.querySelectorAll('[data-res-act]')].map(b => b.dataset.resAct))]")
    check('t38.53 no other board action is offered (Resolved shows Reopen, not the decision builder)', not acts and w.js("() => document.querySelectorAll('[data-oi-reopen]').length") == 4, json.dumps(acts))
    # Not sent to the chat.
    w.pg.click('[data-tab="prepare"]'); tok, chat = w.prepare(MOCK, date='2026-10-08', title='Weekly board walk')
    blk = chat.split('\n=== OPEN ITEMS ===\n')[1].split('\n\n=== MEETING ===')[0] if '\n=== OPEN ITEMS ===\n' in chat else ''
    ids = [l.split(' | ')[0] for l in blk.split('\n')[1:] if l.strip()]
    check('t38.54 dismissed items are not sent to the chat with the next meeting', len(ids) == 7 and not ({KPRI, K038, KINV, KD203} & set(ids)) and K403 in ids, f'{len(ids)} {ids[:3]}')
    # Reopen.
    board_attention(w, 'resolved')
    w.js("k => { const b = [...document.querySelectorAll('[data-oi-reopen]')].find(x => x.dataset.oiReopen === k); if (b) b.click(); }", K038); w.pg.wait_for_timeout(150)
    jclick(w, '[data-oi-add="reopen"]'); w.pg.wait_for_timeout(150)
    check('t38.55 Reopen: a reason is required', 'reason' in txt(w, '[data-oi-form="reopen"] .res-err').lower(), '')
    jfill(w, '[data-oi-form="reopen"] textarea', 'The partner raised connectivity again.')
    jclick(w, '[data-oi-add="reopen"]'); w.pg.wait_for_timeout(300)
    pkg2 = save(w)
    rr = (pkg2.get('resolutions') or [{}])[0]
    check('t38.56 Reopen: recorded as a new decision that names and supersedes the dismissal (nothing erased)',
          rr.get('action') == 'reopen' and rr.get('outcome') == 'open' and rr.get('supersedes') == [recs[K038]['id']] and "Pat Manager's dismissal of" in rr.get('note', ''), json.dumps(rr)[:300])
    t = board_attention(w)
    check('t38.57 Reopen: the item is open again and says who reopened it and why', K038 in open_keys(w) and 'Reopened by' in item_box(w, K038) and 'raised connectivity again' in item_box(w, K038), item_box(w, K038)[:300])
    w.pg.click('[data-tab="prepare"]'); tok, chat = w.prepare(MOCK, date='2026-10-08', title='Weekly board walk')
    check('t38.58 Reopen: the item is sent to the chat again', K038 + ' |' in chat, '')
    check('t38.59 no page errors (dismiss)', not w.errors, '; '.join(w.errors)[:200])


SECTIONS = [('a', t38a), ('b', t38b), ('c', t38c), ('d', t38d), ('e', t38e), ('f', t38f), ('g', t38g), ('h', t38h)]
with sync_playwright() as pw:
    for key, fn in SECTIONS:
        if ONLY and key not in ONLY: continue
        w = WB(WBPATH, pw)
        try: fn(w)
        except Exception as e: check(f't38{key} section crashed', False, repr(e)[:300])
        finally: w.close()
n = sum(1 for _, ok, _ in results if ok)
print(f'\n{n}/{len(results)} passed')
sys.exit(0 if n == len(results) else 1)
