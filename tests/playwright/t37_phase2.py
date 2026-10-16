"""D-UX12 Phase 2 acceptance tests (mkg-dux12-plan.md §16.7 criteria 1-11, 13-15; §16.9 amendments).
Board steps use real clicks and typing on visible controls. Run: python3 t37_phase2.py <MeetingGraph.html>
"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wb import WB, TRANSCRIPT
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
WBPATH = sys.argv[1]
AARON = os.path.join(HERE, 'aaron_pkg_2026-10-13.json')
OUT = os.path.join(HERE, '_t37_out'); os.makedirs(OUT, exist_ok=True)
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))

def new(pw):
    w = WB(WBPATH, pw, reviewer_details=False)
    # §16.16 switched the board actions off; these tests cover the §16.2-§16.15 code kept behind the fallback switch.
    w.js("() => window.MKG_setBoardActions && window.MKG_setBoardActions(true)")
    return w

def load(w, *files):
    for f in files:   # one file per selection: a multi-file selection mirrors the folder
        w.pg.set_input_files('#file-in', f); w.pg.wait_for_timeout(1200)

def board(w, project=None):
    w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(300)
    if project: w.pg.click(f'#projects [data-project="{project}"]')
    else: w.pg.click('#attn-btn')
    w.pg.wait_for_timeout(300)

def row(w, *texts, scope='#panel .lbl-row'):
    loc = w.pg.locator(scope)
    for t in texts: loc = loc.filter(has_text=t)
    return loc.first

def txt(w, sel):
    """Text of the first match, or '' when it is gone (a knockout can remove a form; the check must still run)."""
    return w.js("s => { const e = document.querySelector(s); return e ? e.innerText : ''; }", sel)

def cancel(w):
    w.js("() => { const b = document.querySelector('[data-res-cancel]'); if (b) b.click(); }"); w.pg.wait_for_timeout(80)

def btn(w, r, action):
    """§16.15: secondary actions sit under More ▾; open it when the button isn't visible."""
    b = r.locator(f'[data-res-act="{action}"]').first
    if b.count() and not b.is_visible():
        r.locator('details.res-more > summary').first.click(); w.pg.wait_for_timeout(80)
    return b

# §16.15 retired Reject and Keep unassigned as separate buttons: both are "Not needed" with a reason.
ALIAS = {'reject': 'not_needed', 'keep_unassigned': 'not_needed'}
def act(w, r, action, fields=None, note=''):
    """Visible clicks: the action button, the form's fields, the note, Add to changes. Returns the form's error, if any.
    Fields: data-f names; 'atype' picks the Answer type; 'a:<name>' fills an answer input; 'also:<kind>' ticks a change."""
    action = ALIAS.get(action, action); fields = dict(fields or {})
    if not r.locator('[data-res-act]').count() and r.locator('[data-res-undo]').count():   # already pending (only under a knockout)
        r.locator('[data-res-undo]').first.click(); w.pg.wait_for_timeout(200)
    if action == 'resolve_note':   # "Resolve with note" is now Answer (text); labels without Answer use Not needed
        if r.locator('[data-res-act="answer"]').count(): action = 'answer'; fields = {'a:text': note, **fields}
        else: action = 'not_needed'
    if action == 'add_person':      # Identify person → "+ Add a new person"
        btn(w, r, 'match_person').click(); w.pg.wait_for_timeout(100)
        r.locator('.res-f [data-f="party"]').first.select_option('__new__'); w.pg.wait_for_timeout(150)
    else:
        btn(w, r, action).click(); w.pg.wait_for_timeout(100)
    f = r.locator('.res-f').first
    if 'atype' in fields: f.locator('[data-res-atype]').select_option(fields.pop('atype')); w.pg.wait_for_timeout(120); f = r.locator('.res-f').first
    for k, v in fields.items():
        if k.startswith('also:'): f.locator(f'[data-also="{k[5:]}"]').check(); continue
        if k == 'keepopen': f.locator('[data-res-keepopen]').check(); continue
        x = (f.locator(f'[data-a="{k[2:]}"]') if k.startswith('a:') else f.locator(f'[data-f="{k}"]')).first
        tag = x.evaluate('e => e.tagName + ":" + (e.type || "")')
        if tag.startswith('SELECT'): x.select_option(v)
        elif tag.endswith('checkbox') or tag.endswith('radio'): x.check() if v else x.uncheck()
        else: x.fill(v)
    f.locator('[data-f=note]').fill(note)
    f.locator('[data-res-add]').click(); w.pg.wait_for_timeout(400)
    err = w.pg.locator('.res-f .res-err')
    return err.first.inner_text() if err.count() else ''

def save(w, name):
    n0 = len(w.downloads)
    w.pg.fill('#res-name', name); w.pg.click('#res-save'); w.pg.wait_for_timeout(1500)
    if len(w.downloads) == n0: return None, None
    d = w.downloads[-1]; path = os.path.join(OUT, d.suggested_filename); d.save_as(path)
    return json.load(open(path)), path

def attn_text(w, view='open'):
    board(w); w.pg.click(f'[data-attn-view="{view}"]'); w.pg.wait_for_timeout(300)
    return w.pg.inner_text('#panel')

def owner_of(w, code, project='P2'):
    board(w, project)
    w.js("c => { const b = [...document.querySelectorAll('#panel .ownergrp [data-ent]')].find(x => x.innerText.startsWith(c)); if (b) b.click(); }", code)
    w.pg.wait_for_timeout(300)
    t = w.pg.inner_text('#hist') if w.js("() => document.getElementById('hist').open") else ''
    w.js("() => document.getElementById('hist').open && document.getElementById('hist').close()")
    m = re.search(r'Owner\s*\n?\s*(.+)', t)
    return (m.group(1).strip() if m else ''), t

# ---------------- t37a: Aaron's Oct 1 package: actions, tray, Save, the record (criteria 1-5, 7, 9, 10, 13, 14) ----------------
def t37a(pw):
    w = new(pw); w.load_sample(); load(w, AARON)
    board(w)
    at = w.pg.inner_text('#panel')
    # Criterion 7: the old package's "No owner yet" (about NEW-2) attaches to AI-403.
    r = row(w, 'No owner yet', 'AI-403')
    check('t37.01 old meeting: "No owner yet" from the Oct 1 package (NEW-2) attaches to AI-403', r.count() == 1, at[:200])
    # Criterion 1: each label offers the actions for its kind, in Needs attention.
    acts = lambda r: r.locator('[data-res-act]').evaluate_all('xs => xs.map(x => x.textContent.trim())')
    # §16.15 (by design): one primary action, Later, and More ▾.
    check('t37.02 Unclear reference: Identify person, Later, and Not needed under More', acts(row(w, 'Unclear reference', 'Morgan'))[:2] == ['Identify person', 'Later'] and 'Not needed' in acts(row(w, 'Unclear reference', 'Morgan')))
    check('t37.03 No owner yet: Assign owner, Later, and Not needed under More', acts(r)[:2] == ['Assign owner', 'Later'] and 'Not needed' in acts(r))
    check('t37.04 a date label: Answer first (not a deadline change); Set task date only under More', acts(row(w, 'Possible date change', 'AI-203'))[:2] == ['Answer', 'Later'] and 'Set task date' in acts(row(w, 'Possible date change', 'AI-203')))
    check('t37.05 an open question: Answer, Later; More holds Create task, Link, Add a note, Set task date, Not needed', acts(row(w, 'Open question', 'AI-206')) == ['Answer', 'Later', 'Create task', 'Link to task or project', 'Add a note to a task', 'Set task date', 'Not needed'], str(acts(row(w, 'Open question', 'AI-206'))))
    # ...on the task (chip) and in the project's Open items too.
    board(w, 'P2')
    w.pg.locator('#panel .lbl-chip', has_text='No owner yet').first.click(); w.pg.wait_for_timeout(150)
    check('t37.06 the same actions are on the task’s label chip', w.pg.locator('#panel details.lbl[open] [data-res-act="assign"]').count() == 1)
    check('t37.07 ...and in the project’s Open items', row(w, 'Unclear reference', 'Morgan', scope='#open-items .lbl-row').locator('[data-res-act="match_person"]').count() == 1)
    # Criterion 13: identity safety.
    board(w)
    e1 = act(w, row(w, 'Unclear reference', 'Morgan'), 'add_person', {'name': 'Morgan', 'alias': 'Morgan'}, 'He runs the partner network.')
    check('t37.08 a first name alone cannot create a person', 'first name' in e1, e1)
    cancel(w)
    e2 = act(w, row(w, 'Unclear reference', 'Morgan'), 'add_person', {'name': 'Event Coordinator'}, 'The coordinator.')
    check('t37.09 a role title cannot create a person', 'role title' in e2, e2)
    cancel(w)
    e3 = act(w, row(w, 'Unclear reference', 'Morgan'), 'add_person', {'name': 'Sofia Alvarez'}, 'Same person.')
    check('t37.10 a person already on the board is refused (duplicate check)', 'already on the board' in e3, e3)
    cancel(w)
    e4 = act(w, row(w, 'Unclear reference', 'Morgan'), 'add_person', {'name': 'Morgan Reyes', 'org': 'Partner IT'}, '')
    check('t37.11 adding a person requires a note', 'note' in e4.lower(), e4)
    cancel(w)
    # Criterion 9: the real-meeting question. Morgan: Add person; Priya: Match existing person.
    e = act(w, row(w, 'Unclear reference', 'Morgan'), 'add_person', {'name': 'Morgan Reyes', 'org': 'Partner IT', 'alias': 'Morgan'}, 'Morgan Reyes leads the partner network team, per the attendee list.')
    e += act(w, row(w, 'Unclear reference', 'Priya'), 'match_person', {'party': 'brooks', 'alias': 'Priya'}, 'Dana Brooks goes by Priya on the partner side, confirmed with James.')
    # Criterion 4: a change the validator refuses is never queued. A person not on the board:
    r = row(w, 'No owner yet', 'AI-403'); r.locator('[data-res-act="assign"]').click(); w.pg.wait_for_timeout(100)
    w.js("() => { const s = document.querySelector('.res-f [data-f=party]'); const o = document.createElement('option'); o.value = 'ghost-person'; o.textContent = 'Ghost'; s.appendChild(o); }")
    r.locator('.res-f [data-f=party]').select_option('ghost-person'); r.locator('.res-f [data-f=note]').fill('Test refusal.'); r.locator('.res-f [data-res-add]').click(); w.pg.wait_for_timeout(300)
    e5 = txt(w, '.res-f .res-err')
    check('t37.12 a change the validator refuses shows a plain message and is not queued', "can't take this change" in e5 and 'Unknown new owner' in e5 and len(w.js("() => window.MKG_resPending()")) == 2, e5)
    cancel(w)
    e += act(w, row(w, 'No owner yet', 'AI-403'), 'assign', {'party': 'alvarez'}, 'Sofia confirmed by email on Oct 2 that she owns the staging check.')
    e += act(w, row(w, 'Possible date change', 'AI-203'), 'answer', {'atype': 'date', 'a:from': '2027-05-22', 'also:set_date': True}, 'The partner confirmed May 22, 2027 in writing.')
    e += act(w, row(w, 'Possible date change', 'AI-207'), 'reject', {}, 'Travel dates follow AI-203; no separate date change.')
    e += act(w, row(w, 'Open question', 'AI-206'), 'defer', {}, 'Waiting for the equipment documentation.')
    e += act(w, row(w, 'Open question', 'Connectivity'), 'not_needed', {}, 'Connectivity is routine; nothing to track.')
    check('t37.13 seven actions queued without errors', not e and len(w.js("() => window.MKG_resPending()")) == 7, e)
    # Criterion 2: nothing changes until Save; the tray shows, Undo works, leaving warns.
    tray = w.pg.inner_text('#res-tray')
    check('t37.14 the tray says how many changes are not saved, each with Undo', '7 changes not saved' in tray and w.pg.locator('#res-tray [data-res-undo-i]').count() == 7, tray[:200])
    own, _ = owner_of(w, 'AI-403')
    check('t37.15 nothing reaches the board before Save (AI-403 still unassigned)', own == 'Unassigned', own)
    check('t37.16 leaving with unsaved changes warns', w.js("() => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; }"))
    w.pg.locator('#res-tray li', has_text='Connectivity').locator('[data-res-undo-i]').click(); w.pg.wait_for_timeout(300)
    check('t37.17 Undo removes one change from the tray', '6 changes not saved' in w.pg.inner_text('#res-tray'))
    e += act(w, row(w, 'Open question', 'Connectivity'), 'not_needed', {}, 'Connectivity is routine; nothing to track.')
    pkg, path = save(w, '')
    check('t37.18 Save requires a name', pkg is None and 'name' in w.pg.inner_text('#res-msg').lower())
    pkg, path = save(w, 'Aaron Damiano')
    check('t37.19 Save writes one file', pkg is not None and os.path.basename(path).startswith('mkg-resolution-'), str(path))
    if not pkg: return w.close()
    rs = pkg.get('resolutions', [])
    check('t37.20 the file holds the name, the time, each action and its note', len(rs) == 7 and all(r['by'] == 'Aaron Damiano' and r['at'] and r['note'] and r['choice'] for r in rs))
    stm = {s['id']: s['text'] for s in pkg['sources']}
    ops = pkg['extension']['doc']['@graph']
    ch = [n for n in ops if n.get('@type') in ('Reassign', 'DueDate', 'Deadline', 'NewParty')]
    check('t37.21 ...and the board changes, each citing the reviewer’s statement (attestation), not the meeting', len(ch) == 3 and all(n['source'][0].split('/source/')[1] in stm for n in ch)
          and all(r.get('attestation') is True for r in rs), json.dumps([n['@type'] for n in ch]))
    a403 = next(r for r in rs if r['action'] == 'assign')
    st = stm[a403['statement']]
    check('t37.22 A1: the statement keeps the decision, the meeting basis, the resolver and the note as separate parts',
          st.startswith('Reviewer-confirmed assignment: Sofia Alvarez owns AI-403') and 'Resolved by: Aaron Damiano' in st and 'Meeting basis: Weekly board walk, 2026-10-01: S039: “' in st and 'S044: “' in st and st.endswith('Resolution note: Sofia confirmed by email on Oct 2 that she owns the staging check.'), st)
    check('t37.23 the record names its label by meeting, segment, kind and target (A7)', a403['label']['key'] == '20261001T140000Z|S039|ownership|AI-403', a403['label']['key'])
    check('t37.24 the tray empties after Save', len(w.js("() => window.MKG_resPending()")) == 0 and w.js("() => document.getElementById('res-tray').hidden"))
    # Criterion 5 and 10: resolved items leave the open views; they show in history and the Resolved filter.
    own, hist = owner_of(w, 'AI-403')
    check('t37.25 after Save the board has the change (AI-403 owned by Sofia Alvarez)', own == 'Sofia Alvarez', own)
    check('t37.26 the task history shows the reviewer decision with its three parts', 'Reviewer decisions' in hist and 'Meeting basis' in hist and 'Resolved by' in hist and 'Resolution note' in hist, hist[:300])
    board(w, 'P2')
    p2 = w.pg.inner_text('#panel')
    rowtxt = w.js("() => { const b = [...document.querySelectorAll('#panel .ownergrp [data-ent]')].find(x => x.innerText.startsWith('AI-403')); return b ? b.closest('li').innerText : ''; }")
    check('t37.27 A1 on the board: AI-403 carries a "Reviewer decision", not a meeting claim, and no "No owner yet" label', 'Reviewer decision' in rowtxt and 'No owner yet' not in rowtxt, rowtxt[:200])
    w.js("() => { const b = [...document.querySelectorAll('#panel .ownergrp [data-ent]')].find(x => x.innerText.startsWith('AI-403')); const c = b && b.closest('li').querySelector('.res-chip'); if (c) c.click(); }"); w.pg.wait_for_timeout(150)
    chip = txt(w, '#panel details.lbl[open]')
    check('t37.28 the decision shows meeting basis, resolver and time, and note separately (criterion 10)',
          'Reviewer-confirmed assignment: Sofia Alvarez' in chip and 'Meeting basis' in chip and 'Resolved by\tAaron Damiano' in chip.replace(' Aaron', '\tAaron') and 'Resolution note' in chip, chip[:300])
    oi = w.js("() => [...document.querySelectorAll('#open-items .lbl-row')].map(r => r.querySelector('.lbl-name').innerText + ': ' + r.children[1].innerText).join(' | ')") if w.pg.query_selector('#open-items') else ''
    check('t37.29 settled items leave the project’s Open items (Morgan, Priya, Connectivity)', 'Unclear reference' not in oi and 'Connectivity' not in oi, oi[:300])
    op = attn_text(w)
    check('t37.30 settled items leave Needs attention; the deferred one stays, marked deferred', 'Priya' not in op and 'Morgan is addressed' not in op and 'AI-403' not in op and 'Later (Aaron Damiano' in op and '(later)' in op, op[:400])
    check('t37.31 A4: a person added from a partial reference is listed to verify', 'Person to verify' in op and 'Morgan Reyes (Partner IT)' in op and 'Not yet verified' in op)
    rv = attn_text(w, 'resolved')
    check('t37.32 the Resolved filter shows what was settled, by whom, when, the choice and the note',
          all(x in rv for x in ['Resolved (6)', 'Reviewer-confirmed assignment: Sofia Alvarez', 'Reviewer-matched reference', 'Reviewer answer: May 22, 2027; Reviewer-set task date', 'Reviewer decision: not needed', 'Resolved by', 'Aaron Damiano']), rv[:300])
    check('t37.33 A6: a rejected or dismissed item keeps the meeting quote, the label type, the resolver, the time and the reason',
          'Possible date change' in rv and 'Travel dates follow AI-203' in rv and '“Connectivity should be fine' in rv and 'Connectivity is routine' in rv)
    # The verify step closes the A4 loop.
    board(w)
    e6 = act(w, row(w, 'Person to verify', 'Morgan Reyes'), 'verify_person', {}, 'Confirmed with Morgan Reyes by phone.')
    pkg2, _ = save(w, 'Aaron Damiano')
    op2 = attn_text(w)
    check('t37.34 verifying the person clears "Person to verify"', not e6 and pkg2 and 'Person to verify' not in op2, e6)
    # Criterion 3: loading the files on another machine reproduces the same board.
    snap = lambda w: (attn_text(w), attn_text(w, 'resolved'), owner_of(w, 'AI-403')[0], owner_of(w, 'AI-203')[1].split('Prerequisites')[0])
    a = snap(w)
    w.close()
    w2 = new(pw); w2.load_sample(); load(w2, AARON, path, os.path.join(OUT, pkg2['fileName']))
    b = snap(w2)
    check('t37.35 loading the saved files on another machine reproduces the same board', a == b, f'{[x == y for x, y in zip(a, b)]}')
    check('t37.36 the date decision is on AI-203 there too (May 22)', 'May 22' in b[3], b[3][:200])
    check('t37.37 no page errors', not w2.errors, '; '.join(w2.errors)[:200])
    w2.close()
    return path

# ---------------- t37b: conflict-safe save (criterion 11) ----------------
def t37b(pw):
    # A: Aaron says Priya is not needed and saves.
    A = new(pw); A.load_sample(); load(A, AARON); board(A)
    act(A, row(A, 'Unclear reference', 'Priya'), 'not_needed', {}, 'Priya is a partner contact, not tracked here.')
    fa, pa = save(A, 'Aaron Damiano'); A.close()
    # B started before A's file reached the folder: a pending match on the same label.
    B = new(pw); B.load_sample(); load(B, AARON); board(B)
    act(B, row(B, 'Unclear reference', 'Priya'), 'match_person', {'party': 'brooks', 'alias': 'Priya'}, 'Priya is Dana Brooks.')
    load(B, pa)   # A's file arrives
    n0 = len(B.downloads)
    B.pg.fill('#res-name', 'Lee Chen'); B.pg.click('#res-save'); B.pg.wait_for_timeout(800)
    msg = txt(B, '#res-msg')
    check('t37.40 Save stops when a newer decision on the same label was loaded, and shows it', len(B.downloads) == n0 and 'Someone else settled' in msg and 'Aaron Damiano' in msg and 'Nothing was saved' in msg, msg[:300])
    B.pg.locator('#res-msg textarea').fill('Priya is Dana Brooks.')
    B.pg.click('[data-res-stale-sup]'); B.pg.wait_for_timeout(200)
    check('t37.41 superseding requires a note naming the earlier resolver and date', 'must name the earlier resolver' in txt(B, '#res-msg'))
    B.pg.locator('#res-msg textarea').fill("Supersedes Aaron Damiano's decision of Oct 13: Priya is Dana Brooks; James confirmed the invitee.")
    B.pg.click('[data-res-stale-sup]'); B.pg.wait_for_timeout(300)
    fb, pb = save(B, 'Lee Chen')
    check('t37.42 the superseding decision is saved and names what it supersedes', fb and fb['resolutions'][0]['supersedes'] == [fa['resolutions'][0]['id']], json.dumps(fb and fb['resolutions'][0]['supersedes']))
    rv = attn_text(B, 'resolved')
    check('t37.43 nothing is deleted: the superseded decision stays in history', 'Earlier decisions (1)' in rv and 'Reviewer-matched reference' in rv, rv[:300])
    B.close()
    # C saved independently (never saw A): two decisions, neither supersedes the other.
    C = new(pw); C.load_sample(); load(C, AARON); board(C)
    C.pg.wait_for_timeout(1100)
    act(C, row(C, 'Unclear reference', 'Priya'), 'resolve_note', {}, 'Priya was a one-time guest.')
    fc, pc = save(C, 'Dana Brooks'); C.close()
    D = new(pw); D.load_sample(); load(D, AARON, pa, pc); op = attn_text(D)
    check('t37.44 two independent decisions on one label are "Conflicting resolutions", side by side', 'Priya' in op and '(conflicting resolutions)' in op and 'Aaron Damiano' in op and 'Dana Brooks' in op, op[:400])
    r = row(D, 'Unclear reference', 'Priya')
    e = act(D, r, 'not_needed', {}, 'Not tracked.')
    check('t37.45 resolving a conflict requires naming both earlier decisions', 'Name the earlier decision' in e, e)
    cancel(D)
    e = act(D, row(D, 'Unclear reference', 'Priya'), 'not_needed', {}, "Supersedes Aaron Damiano's decision of Oct 13 and Dana Brooks's decision of Oct 13: a one-time guest; not tracked.")
    fd, _ = save(D, 'Aaron Damiano')
    op = attn_text(D)
    check('t37.46 a decision superseding both ends the conflict', not e and fd and len(fd['resolutions'][0]['supersedes']) == 2 and 'Priya' not in op, e)
    # Two files saved in the same second on different machines share a package id: the second never replaces the first.
    fx = json.load(open(pc)); fx['resolutions'][0]['note'] = 'Edited copy.'; fx['meeting']['id'] = fa['meeting']['id']
    px = os.path.join(OUT, 'same-moment.json'); json.dump(fx, open(px, 'w'))
    load(D, px); tt = D.pg.inner_text('#toast')
    rv = attn_text(D, 'resolved')
    check('t37.48 a decisions file with the same id as one already loaded is refused, not swapped in', 'same moment' in tt and 'Edited copy.' not in rv, tt[:200])
    check('t37.47 no page errors', not D.errors, '; '.join(D.errors)[:200])
    D.close()

# ---------------- t37c: re-import (criteria 6, 15) ----------------
def t37c(pw):
    w = new(pw)
    w.load_sample(); w.pg.click('[data-tab="prepare"]')
    def prep():
        w.pg.fill('#transcript', TRANSCRIPT + ' '); w.pg.fill('#transcript', TRANSCRIPT); w.pg.fill('#m-date', '2026-10-01'); w.pg.select_option('#m-offset', '-04:00'); w.pg.wait_for_timeout(1600)
        return w.js("() => document.getElementById('chat-text').value.split('\\n')[0].split(': ').slice(1).join(': ').trim()")
    reply = json.load(open(os.path.join(HERE, 'enterprise_run_2026-10-13.json')))
    reply['context'] = prep(); w.pg.fill('#llm-in', json.dumps(reply)); w.pg.wait_for_timeout(900)
    w.pg.click('#um-result [data-ux-accept]'); w.pg.wait_for_timeout(1500)
    board(w)
    e = act(w, row(w, 'No owner yet', 'AI-403'), 'assign', {'party': 'alvarez'}, 'Sofia confirmed by email.')
    e += act(w, row(w, 'Open question', 'AI-206'), 'resolve_note', {}, 'Mounting decided: separate tables.')
    pkg, _ = save(w, 'Aaron Damiano')
    check('t37.50 two labels resolved and saved after the meeting was accepted', not e and pkg, e)
    # Re-import the same meeting: the ownership label unchanged, the AI-206 question now cites a different statement.
    w.pg.click('[data-tab="prepare"]')
    r2 = json.loads(json.dumps(reply)); r2['context'] = prep()
    for f in r2['flags']:
        if f['kind'] == 'open_question' and f['about'] == ['AI-206']: f['src'] = ['S009', 'S012']
    w.pg.fill('#llm-in', json.dumps(r2)); w.pg.wait_for_timeout(900)
    okb = w.js("() => { const b = document.querySelector('#um-result [data-ux-accept]'); return !!b && !b.disabled; }")
    w.pg.click('#um-result [data-ux-accept]'); w.pg.wait_for_timeout(1800)
    check('t37.51 a meeting re-imports after a later board-resolutions save', okb and 'Accepted' in (w.pg.inner_text('#toast') or '') or okb, w.pg.inner_text('#import-out')[:300])
    op = attn_text(w)
    rv = attn_text(w, 'resolved')
    check('t37.52 the unchanged label (same meeting, segment, kind, target) stays resolved', 'AI-403' not in op and 'Reviewer-confirmed assignment: Sofia Alvarez' in rv, op[:300])
    check('t37.53 the changed label reappears, with the earlier resolution shown', 'A similar item was resolved on' in op and 'Mounting decided: separate tables.' in op, op[:500])
    own, _ = owner_of(w, 'AI-403')
    check('t37.54 the board change the resolution made is not undone by the re-import', own == 'Sofia Alvarez', own)
    check('t37.55 no page errors', not w.errors, '; '.join(w.errors)[:200])
    w.close()

# ---------------- t37d: Aaron's question (2026-10-13): what is this item resolving? ----------------
def t37d(pw):
    pk = json.load(open(AARON))
    pk['flags'].append({'id': pk['flags'][-1]['id'][:-3] + '099', 'kind': 'ambiguous_reference', 'about': 'partner travel', 'seg': 'S048', 'segs': ['S048', 'S049', 'S050'],
                        'note': 'The text does not resolve whether the partner should book travel or identify who owns travel planning.'})
    fx = os.path.join(OUT, 'aaron_pkg_with_unnamed_reference.json'); json.dump(pk, open(fx, 'w'))
    src = {x['id']: x['text'] for x in pk['sources']}
    w = new(pw); w.load_sample(); load(w, fx); board(w)
    r = row(w, 'Unclear reference', 'book travel'); r.locator('details.lbl-ev > summary').click(); w.pg.wait_for_timeout(100); t = r.inner_text()
    check('t37.60 an item that names no project or task says where it came from', 'Meeting: Weekly board walk, Oct 1 — no project or task named' in t, t[:200])
    check('t37.61 every cited statement shows in full in the item', all(src[x] in t for x in ['S048', 'S049', 'S050']))
    acts = r.locator('[data-res-act]').evaluate_all('xs => xs.map(x => x.dataset.resAct)')
    check('t37.62 a reference label that names no one says so, and offers nothing to match', 'doesn’t name the unclear person' in t and 'match_person' not in acts and 'add_person' not in acts and 'attach' in acts, str(acts))
    check('t37.63 a reference label that names someone shows the name', 'Unclear name: Morgan' in row(w, 'Unclear reference', 'Morgan is addressed').inner_text())
    e = act(w, r, 'attach', {'task': 'AI-207'}, 'This is about the travel plan for the transfer.')
    pkg, _ = save(w, 'Aaron Damiano')
    rec = pkg and pkg['resolutions'][0]
    stm = pkg and next(x['text'] for x in pkg['sources'] if x['id'] == rec['statement'])
    check('t37.64 the decision records every cited statement in full as its meeting basis', bool(stm) and all(src[x] in stm for x in ['S048', 'S049', 'S050']) and len(rec['label']['quotes']) == 3, (stm or '')[:200])
    op = attn_text(w); r = row(w, 'Unclear reference', 'book travel'); t = r.inner_text()
    check('t37.65 attached, the item moves to that task and stays open there', 'Partner data exchange (linked by Aaron Damiano)' in t and 'AI-207' in t and 'Linked here by Aaron Damiano' in t and rec['action'] == 'attach', t[:300])
    board(w, 'P2')
    chips = w.js("() => { const b = [...document.querySelectorAll('#panel .ownergrp [data-ent]')].find(x => x.innerText.startsWith('AI-207')); return b ? b.closest('li').innerText : ''; }")
    check('t37.66 ...and shows on the task', 'Unclear reference' in chips, chips[:200])
    board(w)
    e += act(w, row(w, 'Unclear reference', 'book travel'), 'resolve_note', {}, 'James owns travel planning; the partner books its own travel.')
    pkg2, _ = save(w, 'Aaron Damiano')
    op = attn_text(w); rv = attn_text(w, 'resolved')
    check('t37.67 settling it after attaching replaces the attachment (no conflict, no naming needed)', not e and pkg2 and pkg2['resolutions'][0]['supersedes'] == [rec['id']] and 'book travel' not in op and 'James owns travel planning' in rv, e)
    check('t37.68 the meeting basis in the Resolved view shows every cited statement in full', all(src[x] in rv for x in ['S048', 'S049', 'S050']))
    check('t37.69 no page errors', not w.errors, '; '.join(w.errors)[:200])
    w.close()

# ---------------- t37e: §16.12 actions by topic, and one decision with several steps (Aaron's Paul Morrisseau item) ----------------
PAUL = 'Paul Morrisseau owns immediate shipment coordination for applicable sensors from TTOC to El Paso, but no stable Paul Morrisseau ID exists in the register and Contract 0.3.0 does not support NewParty.'
def t37e(pw):
    pk = json.load(open(AARON)); base = pk['flags'][-1]['id'][:-3]
    pk['flags'] += [{'id': base + '091', 'kind': 'unmatched', 'about': 'P2', 'seg': 'S039', 'segs': ['S039'], 'note': PAUL},
                    {'id': base + '092', 'kind': 'suggestion', 'about': 'AI-206', 'seg': 'S011', 'segs': ['S011'], 'note': 'Dana suggested asking for equipment documentation, but no one accepted ownership.'},
                    {'id': base + '093', 'kind': 'overdue', 'about': 'AI-203', 'seg': 'S014', 'segs': ['S014'], 'note': 'AI-203 is past its due date.'},
                    {'id': base + '094', 'kind': 'unmatched', 'about': 'P2', 'seg': 'S040', 'segs': ['S040'], 'note': 'The alternate staging area is not on the board as a task.'}]
    fx = os.path.join(OUT, 'aaron_pkg_paul.json'); json.dump(pk, open(fx, 'w'))
    w = new(pw); w.load_sample(); load(w, fx); board(w)
    acts = lambda r: r.locator('[data-res-act]').evaluate_all('xs => xs.map(x => x.textContent.trim())')
    r = row(w, 'Not matched to the board', 'Paul Morrisseau'); t = r.inner_text()
    check('t37.70 "Not matched to the board" naming a person: Identify person, with the name read from the label', acts(r)[0] == 'Identify person' and 'Not on the board: Paul Morrisseau' in t, str(acts(r)))
    check('t37.71 ...about a task instead, it offers Create task', 'Create task' in acts(row(w, 'Not matched to the board', 'alternate staging area')) and 'Add person' not in ' '.join(acts(row(w, 'Not matched to the board', 'alternate staging area'))))
    check('t37.72 a suggestion offers Create task and Add a note to a task', all(a in acts(row(w, 'Suggestion', 'equipment documentation')) for a in ['Create task', 'Add a note to a task']))
    check('t37.73 an overdue item: Answer first; Set task date under More', acts(row(w, 'Overdue', 'past its due date'))[0] == 'Answer' and 'Set task date' in acts(row(w, 'Overdue', 'past its due date')))
    # Paul: add the person, create the task he owns, leave a note on it. One decision, one note.
    r = row(w, 'Not matched to the board', 'Paul Morrisseau')
    r.locator('[data-res-act="match_person"]').click(); w.pg.wait_for_timeout(100)
    r.locator('.res-f [data-f="party"]').select_option('__new__'); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f')
    check('t37.74 the name is prefilled from the label', f.locator('[data-f="name"]').input_value() == 'Paul Morrisseau')
    f.locator('[data-f="org"]').fill('Partner logistics')
    f.locator('[data-res-addstep]').select_option('create_task'); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f')
    check('t37.136 Add a step works from Identify person: a second step appears (§16.15 crit. 8)', f.locator('.res-step').count() == 2, str(f.locator('.res-step').count()))
    f.locator('.res-step').nth(1).locator('[data-f="title"]').fill('Coordinate sensor shipment from TTOC to El Paso')
    f.locator('.res-step').nth(1).locator('[data-f="owner"]').select_option('@0')
    f.locator('[data-res-addstep]').select_option('task_note'); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f')
    f.locator('.res-step').nth(2).locator('[data-f="task"]').select_option('@1')
    f.locator('.res-step').nth(2).locator('[data-f="text"]').fill('Ship by Oct 20; Paul confirmed.')
    check('t37.75 later steps can name the person and task created by earlier ones', f.locator('.res-step').nth(1).locator('[data-f="owner"] option[value="@0"]').inner_text().startswith('Paul Morrisseau'))
    # A refused step refuses the whole decision, and the message names the step.
    f.locator('.res-step').nth(0).locator('[data-f="name"]').fill('Sofia Alvarez')
    f.locator('[data-f=note]').fill('Paul runs partner logistics; confirmed with James on Oct 12.')
    f.locator('[data-res-add]').click(); w.pg.wait_for_timeout(300)
    e = txt(w, '.res-f .res-err')
    check('t37.76 one refused step refuses the decision, naming the step', e.startswith('Step 1 (Add person') and 'already on the board' in e and len(w.js("() => window.MKG_resPending()")) == 0, e)
    f.locator('.res-step').nth(0).locator('[data-f="name"]').fill('Paul Morrisseau')
    f.locator('[data-res-add]').click(); w.pg.wait_for_timeout(400)
    tray = w.pg.inner_text('#res-tray')
    check('t37.77 the tray shows the decision as one line with its steps', '1 change not saved' in tray and 'Add person (full identity details) (Paul Morrisseau, Partner logistics)' in tray and 'Create task (“Coordinate sensor shipment from TTOC to El Paso”, owner Paul Morrisseau)' in tray and 'Add a note to a task (on the new task' in tray, tray[:400])
    # §16.15: Create task from More ▾ on an open question does not answer it; the question stays open.
    r = row(w, 'Open question', 'AI-206'); btn(w, r, 'create_task').click(); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f'); f.locator('[data-f="title"]').fill('Request equipment documentation from the partner')
    f.locator('[data-f=note]').fill('Logged as a task; the mounting question is still open.')
    f.locator('[data-res-add]').click(); w.pg.wait_for_timeout(400)
    pkg, _ = save(w, 'Aaron Damiano')
    recs = pkg['resolutions'] if pkg else []
    rp = next((x for x in recs if x['action'] == 'decision'), None)
    graph = pkg['extension']['doc']['@graph'] if pkg else []
    types = [n['@type'] for n in graph if 'sequence' in n]
    check('t37.78 one record holds the decision\u2019s steps, outcome and note', rp and [s_['type'] for s_ in rp['steps']] == ['add_person', 'create_task', 'task_note'] and rp['outcome'] == 'settle' and rp['note'].startswith('Paul runs'), json.dumps(rp)[:300] if rp else 'none')
    check('t37.79 each step\u2019s board change is in the package, citing the decision\u2019s statement', types[:3] == ['NewParty', 'NewTasking', 'ProgressNote'] and len({n['source'][0] for n in graph if n.get('@type') in ('NewParty', 'NewTasking', 'ProgressNote')} - {n['source'][0] for n in graph if n.get('@type') == 'NewTasking' and n.get('label', '').startswith('Request')}) == 1, str(types))
    code = rp and rp['steps'][1].get('code')
    check('t37.80 references are written out: the new task\u2019s code, and Paul\u2019s id as its owner and the note\u2019s task', bool(code) and rp['steps'][1]['owner'] == rp['steps'][0]['partyId'] and rp['steps'][2]['task'] == code, json.dumps(rp['steps'] if rp else None)[:300])
    own, hist = owner_of(w, code or 'AI-999')
    check('t37.81 on the board: the new task is owned by Paul (reviewer-added) and carries the note', own.startswith('Paul Morrisseau') and 'reviewer-added' in own and 'Ship by Oct 20' in hist, own)
    op = attn_text(w)
    check('t37.82 settled, Paul\u2019s item leaves Needs attention; the open question stays open after Create task', 'Paul Morrisseau owns' not in op and 'Determine whether monitoring equipment' in op and 'Still open after Create task' in op, op[:300])
    check('t37.83 the new task carries a "Reviewer decision" chip', 'Reviewer decision' in w.js("c => { const b = [...document.querySelectorAll('#panel .ownergrp [data-ent]')].find(x => x.innerText.startsWith(c)); return b ? b.closest('li').innerText : ''; }", code or 'x') if (board(w, 'P2') or True) else False)
    # "+ Add a new person" in an owner list inserts that step before it.
    board(w)
    r = row(w, 'Overdue', 'past its due date'); btn(w, r, 'set_date').click(); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f'); f.locator('[data-res-addstep]').select_option('assign'); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f'); f.locator('.res-step').nth(1).locator('[data-f="party"]').select_option('__new__'); w.pg.wait_for_timeout(200)
    f = r.locator('.res-f'); kinds = f.locator('.res-step').evaluate_all('xs => xs.map(x => x.dataset.step)')
    sel = f.locator('.res-step').nth(2).locator('[data-f="party"]').input_value()
    check('t37.84 "+ Add a new person" inserts an Add person step before the step that needs it, and selects that person', kinds == ['set_date', 'add_person', 'assign'] and sel == '@1', f'{kinds} {sel}')
    f.locator('.res-step').nth(1).locator('[data-res-rmstep]').click(); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f'); kinds = f.locator('.res-step').evaluate_all('xs => xs.map(x => x.dataset.step)')
    check('t37.85 removing a step clears references to it', kinds == ['set_date', 'assign'] and f.locator('.res-step').nth(1).locator('[data-f="party"]').input_value() == '', str(kinds))
    check('t37.86 no page errors', not w.errors, '; '.join(w.errors)[:200])
    w.close()

# ---------------- t37f: §16.13 Teams attendance as a continuous person record (MVP) ----------------
def att(*ps): return {'title': 'Weekly board walk', 'start': '', 'end': '', 'summary': {}, 'participants': [{'name': n, 'email': e, 'role': 'Attendee', 'join': '', 'leave': '', 'duration': d} for n, e, d in ps]}
def bare_meeting(pk, mid, at, attendance):
    return {'mkgPackage': pk['mkgPackage'], 'tool': pk['tool'], 'contract': pk['contract'], 'meeting': {'id': mid, 'meetingAt': at, 'title': 'Weekly board walk', 'kind': 'transcript'},
            'sources': [], 'deltas': [], 'extension': None, 'flags': [], 'acceptedAt': '2026-10-13T00:00:00Z', 'attendance': attendance}
def t37f(pw):
    pk = json.load(open(AARON))
    pk['attendance'] = att(('Alvarez, Sofia', 'sofia.alvarez@agency.example', '58m'), ('Reyes, Morgan', 'morgan.reyes@partner.example', '41m'),
                           ('D. Brooks', 'dana.brooks@agency.example', '55m'), ('Conference Room 4B', '', '60m'), ('Priya', '', '12m'))
    f1 = os.path.join(OUT, 'att_oct01.json'); json.dump(pk, open(f1, 'w'))
    f2 = os.path.join(OUT, 'att_oct08.json'); json.dump(bare_meeting(pk, '20261008T140000Z', '2026-10-08T10:00:00-04:00',
        att(('Reyes, Morgan', 'morgan.reyes@partner.example', '30m'), ('Conference Room 4B', '', '60m'), ('Alvarez, Sofia', 'sofia.alvarez@agency.example', '45m'))), open(f2, 'w'))
    f3 = os.path.join(OUT, 'att_oct09.json'); json.dump(bare_meeting(pk, '20261009T140000Z', '2026-10-09T10:00:00-04:00',
        att(('Dana B.', 'dana.brooks@agency.example', '20m'), ('Reyes, M.', 'morgan.reyes@partner.example', '25m'), ('Conference Room 4B', '', '60m'))), open(f3, 'w'))
    w = new(pw); w.load_sample(); load(w, f1, f2); op = attn_text(w)
    r = row(w, 'Person to add', 'Morgan Reyes')
    check('t37.90 an attendee not on the board appears once under People, with every meeting attended', r.count() == 1 and 'People' in r.inner_text() and 'Oct 1 (41m)' in r.inner_text() and 'Oct 8 (30m)' in r.inner_text() and op.count('Morgan Reyes (morgan.reyes@partner.example) attended') == 1, r.inner_text()[:300] if r.count() else op[:300])
    check('t37.91 an attendee matched by name raises nothing; the others are listed', 'Sofia Alvarez (sofia' not in op and row(w, 'Person to add', 'Conference Room 4B').count() == 1 and row(w, 'Person to add', 'Priya').count() == 1 and row(w, 'Person to add', 'D. Brooks').count() == 1)
    ref = row(w, 'Unclear reference', 'Morgan is addressed')
    acts = ref.locator('[data-res-act]').evaluate_all('xs => xs.map(x => x.textContent.trim())')
    check('t37.92 a first-name unclear reference names the attendee of that meeting', 'possibly Morgan Reyes (attended this meeting)' in ref.inner_text() and acts[0] == 'Identify person', ref.inner_text()[:300])
    e = act(w, row(w, 'Person to add', 'Priya'), 'add_person', {}, 'Joined for the invitation item.')
    check('t37.93 a first name from the report cannot create a person', 'first name' in e, e)
    cancel(w)
    r = row(w, 'Person to add', 'Morgan Reyes'); r.locator('[data-res-act="match_person"]').click(); w.pg.wait_for_timeout(100)
    r.locator('.res-f [data-f="party"]').select_option('__new__'); w.pg.wait_for_timeout(150)
    f = r.locator('.res-f')
    pre = (f.locator('[data-f="name"]').input_value(), f.locator('[data-f="email"]').input_value(), f.locator('[data-f="verified"]').is_checked())
    check('t37.94 Add person is prefilled from the report (full name, email) and not marked unverified', pre == ('Morgan Reyes', 'morgan.reyes@partner.example', True), str(pre))
    f.locator('[data-f="org"]').fill('Partner IT'); f.locator('[data-f=note]').fill('Partner network lead; on the Oct 1 and Oct 8 attendance reports.'); f.locator('[data-res-add]').click(); w.pg.wait_for_timeout(400)
    e = act(w, row(w, 'Person to add', 'D. Brooks'), 'match_person', {'party': 'brooks'}, 'Dana Brooks joins under her short display name.')
    e += act(w, row(w, 'Person to add', 'Conference Room 4B'), 'not_needed', {}, 'A room account, not a person.')
    pkg, pth = save(w, 'Aaron Damiano')
    recs = {r_['label']['target']: r_ for r_ in (pkg or {}).get('resolutions', [])}
    mr, dr = recs.get('morgan.reyes@partner.example'), recs.get('dana.brooks@agency.example')
    check('t37.95 the decisions are keyed by email, and record the report\u2019s name and email', not e and mr and dr and mr['steps'][0]['email'] == 'morgan.reyes@partner.example' and dr['steps'][0]['alias'] == 'D. Brooks' and dr['steps'][0]['email'] == 'dana.brooks@agency.example', e or json.dumps(list(recs)))
    op = attn_text(w)
    check('t37.96 settled attendees leave Needs attention; Morgan, from the report, is not "to verify"', 'Morgan Reyes (morgan' not in op and 'D. Brooks' not in op and 'Conference Room 4B' not in op and 'Person to verify' not in op and 'Priya' in op, op[:300])
    load(w, f3); op = attn_text(w)
    check('t37.97 the next report matches by email with no item (Dana B.; Reyes, M.), and the room is not raised again', 'Dana B.' not in op and 'Reyes, M.' not in op and 'Conference Room 4B' not in op, op[:300])
    rv = attn_text(w, 'resolved')
    check('t37.98 "Not needed" stays in history with its reason', 'A room account, not a person.' in rv)
    def page(w, pid):
        b = None
        for P in w.js("() => [...document.querySelectorAll('#projects [data-project]')].map(x => x.dataset.project)"):
            board(w, P); b = w.pg.locator(f'#panel [data-person="{pid}"]')
            if b.count(): break
        if not b or not b.count(): return ''
        b.first.click(); w.pg.wait_for_timeout(300); t = w.pg.inner_text('#hist'); w.pg.click('#close-hist'); return t
    pg = page(w, 'alvarez')
    check('t37.99 the person page lists meetings attended with time in the meeting, and tasks owned', 'Meetings attended' in pg and '2: first Oct 1, last Oct 8' in pg and '58m' in pg and '45m' in pg and 'Tasks owned' in pg, pg[:400])
    dp = page(w, 'brooks')
    check('t37.103 the person page follows a person by email across name forms (Oct 1 "D. Brooks", Oct 9 "Dana B.")', '2: first Oct 1, last Oct 9' in dp and 'dana.brooks@agency.example' in dp, dp[:300])
    w.pg.click('#export-ws'); w.pg.wait_for_timeout(500); ws = json.loads(w.last_download_text())
    same = all(json.dumps(next(x for x in ws['packages'] if x['meeting']['id'] == j['meeting']['id'])['attendance'], sort_keys=True) == json.dumps(j['attendance'], sort_keys=True) for j in [pk, json.load(open(f2)), json.load(open(f3))])
    check('t37.100 each meeting\u2019s attendance report is unchanged', same)
    w.close()
    w2 = new(pw); w2.load_sample(); load(w2, f1, f2, pth, f3)
    pg2 = page(w2, 'alvarez')
    check('t37.101 another machine loading the same files shows the same person page', pg2 == pg, pg2[:200])
    check('t37.102 no page errors', not w2.errors, '; '.join(w2.errors)[:200])
    w2.close()

# ---------------- t37g: Attach: a project limits the task list (Aaron's test, 2026-10-13) ----------------
def t37g(pw):
    w = new(pw); w.load_sample(); load(w, AARON); board(w)
    r = row(w, 'Unclear reference', 'Priya'); btn(w, r, 'attach').click(); w.pg.wait_for_timeout(150)
    f = lambda: r.locator('.res-step[data-step="attach"]')
    opts = lambda: f().locator('[data-f="task"] option').evaluate_all('xs => xs.filter(x => x.value).map(x => x.innerText)')
    projs = w.js("() => [...document.querySelectorAll('.res-step[data-step=attach] [data-f=project] option')].filter(x => x.value).map(x => [x.value, x.innerText])")
    pname = dict(projs)
    check('t37.110 with the item\u2019s project chosen, only that project\u2019s tasks are listed', f().locator('[data-f="project"]').input_value() == 'P2' and opts() and all(o.endswith(f'({pname["P2"]})') for o in opts()), str(opts())[:200])
    f().locator('[data-f="project"]').select_option(''); w.pg.wait_for_timeout(150)
    allo = opts(); others = [o for o in allo if not o.endswith(f'({pname["P2"]})')]
    check('t37.111 with "Any project", every task is listed, across projects', len(others) > 0 and len(allo) > len(others), str(len(allo)))
    other = f().locator('[data-f="task"] option').evaluate_all(f'xs => xs.filter(x => x.value && !x.innerText.endsWith("({pname["P2"]})")).map(x => x.value)')[0]
    f().locator('[data-f="task"]').select_option(other); w.pg.wait_for_timeout(150)
    pv, tv = f().locator('[data-f="project"]').input_value(), f().locator('[data-f="task"]').input_value()
    check('t37.112 picking a task with no project sets its project and keeps the task', pv not in ('', 'P2') and tv == other and all(o.endswith(f'({pname[pv]})') for o in opts()), f'{pv} {tv}')
    f().locator('[data-f="project"]').select_option('P2'); w.pg.wait_for_timeout(150)
    check('t37.113 changing the project clears a task from another project', f().locator('[data-f="task"]').input_value() == '' and all(o.endswith(f'({pname["P2"]})') for o in opts()))
    r.locator('.res-f [data-f=note]').fill('Priya belongs with the partner project generally.'); r.locator('.res-f [data-res-add]').click(); w.pg.wait_for_timeout(300)
    check('t37.114 the project alone, with no task, can be chosen', len(w.js("() => window.MKG_resPending()")) == 1 and w.js("() => window.MKG_resPending()[0].steps[0].project") == 'P2' and not w.js("() => window.MKG_resPending()[0].steps[0].task"))
    check('t37.115 no page errors', not w.errors, '; '.join(w.errors)[:200])
    w.close()

# ---------------- t37h: §16.15 resolution cards (ratified 2026-10-14), on the Oct 1 board walk ----------------
LEGACY = os.path.join(HERE, 'legacy_resolution_2026-10-13.json')   # saved by build 7d8def41 (one action per record)
def t37h(pw):
    w = new(pw); w.load_sample(); load(w, AARON); board(w)
    rows = w.js("""() => [...document.querySelectorAll('#panel .lbl-row')].map(r => { const acts = r.querySelector('.res-acts'), ev = r.querySelector('.lbl-ev');
      return { name: r.querySelector('.lbl-name').textContent, primary: acts && acts.querySelector('.btn.primary') ? acts.querySelector('.btn.primary').textContent : '',
        later: !!(acts && [...acts.querySelectorAll('[data-res-act=defer]')].length), more: !!r.querySelector('details.res-more'),
        order: !ev || !!(acts && (acts.compareDocumentPosition(ev) & Node.DOCUMENT_POSITION_FOLLOWING)), collapsed: !ev || !ev.open }; })""")
    check('t37.120 every card: primary action, Later and More above the evidence, with the evidence collapsed (crit. 1)',
          len(rows) == 11 and all(x['primary'] and x['later'] and x['more'] and x['order'] and x['collapsed'] for x in rows), json.dumps(rows)[:300])
    want = {'Open question': 'Answer', 'Unclear reference': 'Identify person', 'Possible date change': 'Answer', 'No owner yet': 'Assign owner'}
    check('t37.121 each label gets its primary action; the date labels get Answer (crit. 2)', all(want[x['name']] == x['primary'] for x in rows), json.dumps([(x['name'], x['primary']) for x in rows]))
    # Answer: text by default; the person switches the type (crit. 3).
    r = row(w, 'Open question', 'observer roster'); r.locator('[data-res-act="answer"]').click(); w.pg.wait_for_timeout(100)
    f = lambda: r.locator('.res-f')
    seen = {'default': (f().locator('[data-res-atype]').input_value(), f().locator('[data-a="text"]').count())}
    for t in ['date', 'person', 'choice', 'yesno']:
        f().locator('[data-res-atype]').select_option(t); w.pg.wait_for_timeout(100)
        seen[t] = f().locator('.res-aval [data-a]').evaluate_all('xs => xs.map(x => x.dataset.a + (x.type ? ":" + x.type : ""))')
    check('t37.122 Answer defaults to text; Date or range, Person, Choice and Yes/No give their inputs (crit. 3)',
          seen['default'] == ('text', 1) and seen['date'] == ['from:date', 'to:date', 'noyear:checkbox'] and seen['person'] == ['person:select-one']
          and seen['choice'].count('opt:text') == 4 and seen['choice'].count('pick:radio') == 4 and seen['yesno'] == ['yn:radio', 'yn:radio'], json.dumps(seen))
    r.locator('[data-res-cancel]').click()
    # The transfer window: a range with no year, kept open. Offered changes start unchecked and show the current value (crit. 4, 6, 7).
    r = row(w, 'Open question', 'AI-207')
    r.locator('[data-res-act="answer"]').click(); w.pg.wait_for_timeout(100)
    f().locator('[data-res-atype]').select_option('date'); w.pg.wait_for_timeout(100)
    also = f().locator('[data-also="set_date"]')
    check('t37.123 a change the answer could make is offered unchecked, with the current value (crit. 6)', also.count() == 1 and not also.is_checked() and '(now: none)' in f().locator('.res-also').inner_text())
    # A single full date can be ticked; kept open, the change is refused (crit. 7).
    f().locator('[data-a="from"]').fill('2026-05-18'); also.check(); f().locator('[data-res-keepopen]').check()
    f().locator('[data-f=note]').fill('Discussed in the Oct 1 board walk; the year was not stated.')
    f().locator('[data-res-add]').click(); w.pg.wait_for_timeout(200)
    e2 = txt(w, '.res-f .res-err')
    check('t37.135 a kept-open answer changes no record (crit. 7)', 'kept open doesn’t change records' in e2, e2)
    # Entering an end date (a range) unticks and greys out the due-date change, saying why (crit. 4; Aaron's test, 2026-10-14).
    f().locator('[data-a="to"]').fill('2026-05-22'); w.pg.wait_for_timeout(100)
    rng = (also.is_disabled(), also.is_checked(), f().locator('.res-also').inner_text())
    f().locator('[data-a="to"]').fill(''); w.pg.wait_for_timeout(100); f().locator('[data-a="noyear"]').check(); w.pg.wait_for_timeout(100)
    ny = (also.is_disabled(), f().locator('.res-also').inner_text())
    check('t37.124 a range or a date without a year is never offered as a deadline: the change greys out with its reason (crit. 4)',
          rng[0] and not rng[1] and 'Not available for a range.' in rng[2] and ny[0] and 'Not available without a year.' in ny[1], f'{rng} {ny}')
    f().locator('[data-a="to"]').fill('2026-05-22'); f().locator('[data-res-add]').click(); w.pg.wait_for_timeout(300)
    tray = w.pg.inner_text('#res-tray')
    check('t37.125 the answer goes in the tray: "May 18–22, year not known", kept open', 'Answer (“May 18–22, year not known” · kept open)' in tray, tray[:300])
    # Equipment: a choice, with the note on the task ticked. Invitations: yes, kept open. A note from More keeps a question open.
    e = act(w, row(w, 'Open question', 'AI-206'), 'answer', {'atype': 'choice', 'a:opt': 'On the temporary workstation'}, 'x')
    cancel(w)
    r = row(w, 'Open question', 'AI-206'); r.locator('[data-res-act="answer"]').click(); w.pg.wait_for_timeout(100)
    f().locator('[data-res-atype]').select_option('choice'); w.pg.wait_for_timeout(100)
    opts = f().locator('[data-a="opt"]'); opts.nth(0).fill('On the temporary workstation'); opts.nth(1).fill('On separate tables')
    f().locator('[data-a="pick"]').nth(1).check(); f().locator('[data-also="task_note"]').check()
    f().locator('[data-f=note]').fill('Dana confirmed separate tables on Oct 3.'); f().locator('[data-res-add]').click(); w.pg.wait_for_timeout(300)
    e = act(w, row(w, 'Open question', 'invitation'), 'answer', {'atype': 'yesno', 'a:yn': True, 'keepopen': True}, 'Sofia sent them; James has not confirmed receipt.')
    rr = row(w, 'Open question', 'invitation'); w.pg.wait_for_timeout(50)
    e += act(w, row(w, 'Open question', 'AI-203'), 'task_note', {'text': 'Transfer dates still being confirmed with the partner.'}, 'Logged for the owner; the question stays open.')
    pkg, _ = save(w, 'Aaron Damiano')
    recs = (pkg or {}).get('resolutions', [])
    by = {(x['label']['kind'], x['label']['target']): x for x in recs}
    tr, eq = by.get(('open_question', 'AI-207')), by.get(('open_question', 'AI-206'))
    check('t37.126 an answer is a "Resolve with note" record holding the answer; kept open is its outcome; nothing else changes (crit. 7, 9)',
          tr and tr['action'] == 'resolve_note' and tr['value']['answer'] == 'May 18–22, year not known' and tr['outcome'] == 'open' and not tr.get('steps') and tr['change'] is None, json.dumps(tr)[:300])
    check('t37.127 a choice answer, with its ticked note, is one record with one step', eq and eq['value']['answer'] == 'On separate tables (not: On the temporary workstation)' and [x['type'] for x in eq['steps']] == ['task_note'] and eq['outcome'] == 'settle', json.dumps(eq)[:300])
    op = attn_text(w)
    r = row(w, 'Open question', 'AI-207')
    check('t37.128 the kept-open answer shows on the card, and the item stays open (crit. 7)', 'Current answer (not confirmed yet): May 18–22, year not known' in r.inner_text(), r.inner_text()[:300])
    r = row(w, 'Open question', 'AI-203')
    check('t37.129 a note added from More leaves the question open (crit. 5)', r.count() == 1 and 'Still open after Add a note to a task' in r.inner_text())
    check('t37.130 the answered question leaves Needs attention; the yes/no kept open stays', row(w, 'Open question', 'AI-206').count() == 0 and 'Current answer (not confirmed yet): Yes' in row(w, 'Open question', 'invitation').inner_text())
    _, hist = owner_of(w, 'AI-207')
    _, h206 = owner_of(w, 'AI-206')
    check('t37.131 no deadline changed for the transfer; the equipment note is on AI-206', 'Due' not in hist.split('Prerequisites')[0].split('Reviewer decisions')[0] and 'Answer: On separate tables' in h206, hist[:200])
    # Aaron's test (2026-10-14): form controls were light text on a light field in dark mode. Both modes must read.
    def contrast(c1, c2):
        def lum(c):
            v = [int(x) / 255 for x in re.findall(r'\d+', c)[:3]]
            v = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in v]
            return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
        a, b = sorted([lum(c1), lum(c2)], reverse=True); return (a + 0.05) / (b + 0.05)
    ratios = {}
    for mode in ['light', 'dark']:
        w.pg.emulate_media(color_scheme=mode); w.pg.wait_for_timeout(150); board(w)
        r = row(w, 'Open question', 'observer roster'); r.locator('[data-res-act="answer"]').click(); w.pg.wait_for_timeout(100)
        st = w.js("() => [...document.querySelectorAll('.res-f select, .res-f textarea')].map(e => { const c = getComputedStyle(e); return [c.color, c.backgroundColor]; })")
        ratios[mode] = round(min(contrast(c, b) for c, b in st), 2); cancel(w)
    check('t37.137 the answer form\u2019s fields are readable in light and dark mode (contrast at least 4.5:1)', all(v >= 4.5 for v in ratios.values()), json.dumps(ratios))
    w.pg.emulate_media(color_scheme='light')
    check('t37.132 no page errors', not w.errors, '; '.join(w.errors)[:200])
    w.close()
    # Criterion 9: a save from an earlier build (one action per record) reads and displays unchanged.
    w = new(pw); w.load_sample(); load(w, AARON, LEGACY)
    own, _ = owner_of(w, 'AI-403'); rv = attn_text(w, 'resolved')
    check('t37.133 an earlier save displays unchanged (AI-403 owner, four decisions in Resolved)', own == 'Sofia Alvarez' and 'Resolved (4)' in rv and 'Reviewer-added person: Morgan Reyes' in rv and 'Reviewer-set task date' in rv, rv[:300])
    check('t37.134 no page errors', not w.errors, '; '.join(w.errors)[:200])
    w.close()

# T37_ONLY=<letters> runs only those sections (used by the knockouts to reach a named check). A section that crashes is
# reported as a failure and the run continues.
ONLY = os.environ.get('T37_ONLY', '')
with sync_playwright() as pw:
    for name, fn in [('a', t37a), ('b', t37b), ('c', t37c), ('d', t37d), ('e', t37e), ('f', t37f), ('g', t37g), ('h', t37h)]:
        if ONLY and name not in ONLY: continue
        try: fn(pw)
        except Exception as ex: check(f't37{name} section crashed', False, str(ex).splitlines()[0][:200])
fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed" + ('' if not fails else f" — {len(fails)} FAILED"))
sys.exit(1 if fails else 0)
