"""Builds t36_dux12.py from t35_dux11.py: the D-UX11 checks carried over, with the D-UX12 changes by design (each exact-count)."""
import os
HERE = os.path.dirname(os.path.abspath(__file__))
s = open(os.path.join(HERE, 't35_dux11.py'), encoding='utf-8').read()

def r(a, b, c=1):
    global s
    assert s.count(a) == c, (a[:80], s.count(a))
    s = s.replace(a, b)

r('"""D-UX11 user mode acceptance tests (user-mode plan §4, ratified 2026-10-12, amended the same day).',
  '"""D-UX12 acceptance tests (mkg-dux12-plan.md §9, ratified 2026-10-12): place, label, and move on.\nBuilt from t35 (D-UX11) by make_t36.py; D-UX12 replaces the D-UX11 decision gate, and each changed check says so.')
r("Run: python3 t35_dux11.py <MeetingGraph.html>", "Run: python3 t36_dux12.py <MeetingGraph.html>")
r("""def user_decide(w, answers=None, drop=(), undate=()):
    for qid, v in (answers or {}).items(): w.pg.check(f'#um-result input[data-ux-q="{qid}"][value="{v}"]'); w.pg.wait_for_timeout(80)
    for i in drop: w.pg.uncheck(f'#um-result input[data-ux-keep="{i}"]'); w.pg.wait_for_timeout(80)   # Keep unticked
    for i in undate: w.pg.click(f'#um-result button[data-ux-undate="{i}"]'); w.pg.wait_for_timeout(80)""",
  """def open_overrides(w, panel='#um-result'):
    w.js(f"() => document.querySelectorAll('{panel} details.ux-over').forEach(d => d.open = true)")

def user_decide(w, answers=None, drop=(), undate=()):
    for qid, v in (answers or {}).items(): open_overrides(w); w.pg.check(f'#um-result input[data-ux-q="{qid}"][value="{v}"]'); w.pg.wait_for_timeout(80)
    for i in drop: w.pg.uncheck(f'#um-result input[data-ux-keep="{i}"]'); w.pg.wait_for_timeout(80)   # Keep unticked""")
r("""def questions(w, panel='#um-result'):
    return""", """def questions(w, panel='#um-result'):
    open_overrides(w, panel)
    return""")
r("CHOICES = dict(answers={'scope:AI-203': 'yes', 'scope:AI-207': 'defer'}, drop=(I_NEW5,), undate=(I_NEW4,))",
  "CHOICES = dict(answers={'scope:AI-203': 'yes', 'scope:AI-207': 'place'}, drop=(I_NEW5,), undate=())")
r("check('t35.6 D-UX11h: run 2 asks", "check('t36.6 D-UX11h, now an optional placement: run 2 offers")
r("""    blocked = w.js("() => [...document.querySelectorAll('#um-result .ux-blocked')].length")
    acc_off = w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled")
    check('t35.7 class A: the transcript change (date from "today\\'s") cannot be accepted as written; Update the board is disabled', blocked == 1 and acc_off, f'{blocked} blocked, disabled={acc_off}')""",
  """    acc_off = w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled")
    res = w.pg.inner_text('#um-result'); item = res[res.find('Provide today'):][:400]
    check('t36.7 D-UX12: nothing to decide; the transcript change goes in without its date, labeled, and Update the board is enabled',
          not acc_off and 'Goes in without the due date (Date unclear)' in item and 'Nothing needs deciding' in res, f'disabled={acc_off}; {item[:200]}')""")
r("""    user_decide(w, answers=CHOICES['answers'])
    check('t35.9 answering the questions alone is not enough while a change is blocked',
          w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled"))
    user_decide(w, drop=CHOICES['drop'], undate=CHOICES['undate'])
    check('t35.10 with the blocked changes resolved, Update the board is enabled',
          not w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled"))
    after = w.pg.inner_text('#um-result')
    check('t35.11a before Accept, the screen says what the choices leave behind (the summaries promise)',
          'What your choices leave behind' in after and 'summaries' in after.split('What your choices leave behind')[1].lower(), after[-400:])
    check('t35.11 three kinds of item are visibly distinct (changes, questions, open items)',
          all(h in w.pg.inner_text('#um-result') for h in ['Changes to your board', 'Questions about this meeting', 'Open items']))""",
  """    labs = w.pg.inner_text('#ux-labels') if w.pg.query_selector('#um-result #ux-labels') else ''
    check('t36.9 the labels are listed before Accept: "Date unclear" (transcript) and "Possible schedule update" (AI-203)',
          'Date unclear (' in labs and 'Possible schedule update (' in labs and 'May eighteenth through May twenty-second' in labs, labs[:300])
    user_decide(w, answers=CHOICES['answers'], drop=CHOICES['drop'])
    check('t36.10 overriding a placement and leaving a change out keep Update the board enabled',
          not w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled"))
    check('t36.11 three kinds of item are visibly distinct (labeled for follow-up, changes, open items)',
          all(h in w.pg.inner_text('#um-result') for h in ['Labeled for follow-up', 'Changes to your board', 'Open items']))""")
r("""        w.prepare(TRANSCRIPT); w.validate(RUN2)
        for qid, v in CHOICES['answers'].items(): w.pg.check(""", """        w.prepare(TRANSCRIPT); w.validate(RUN2)
        for qid, v in CHOICES['answers'].items(): open_overrides(w, '#ux-decisions'); w.pg.check(""")
r("""        for i in CHOICES['undate']: w.pg.click(f'#ux-decisions button[data-ux-undate="{i}"]'); w.pg.wait_for_timeout(80)
""", "")
r("user_pkg('no', 'u-no'); user_pkg('defer', 'u-defer');", "user_pkg('no', 'u-no'); user_pkg('place', 'u-defer');")
r("""    check('t35.17 No: no update; the statement stays as project-level planning context, recorded',
          'Reviewer confirmed that this meeting statement updates the task' not in n and 'project-level planning context' in n and qrec(J['u-no'])['answer'] == 'no')
    check('t35.18 Defer: no update and no added context; the question is recorded as deferred',
          'Reviewer confirmed that this meeting statement updates the task' not in d and 'project-level planning context' not in d and qrec(J['u-defer'])['answer'] == 'defer')
    ch = J['u-yes']['review']['changes']
    check('t35.19 the dropped and undated changes are recorded', ch['dropped'] == [I_NEW5 + 1] and ch['undated'] == [I_NEW4 + 1], json.dumps(ch))
    cons = J['u-yes']['review'].get('consequences', [])
    check('t35.19a the package records the summaries promise left uncarried by the reviewer\\'s drop', any(c.get('code') == 'DELIVERABLE-DROPPED' for c in cons), json.dumps(cons)[:200])""",
  """    fl = lambda j, kind, about: any(f.get('kind') == kind and about in str(f.get('about')) for f in j.get('flags', []))
    check('t36.17 No: no update; the statement is kept at project level ("Schedule context"), recorded',
          'Reviewer confirmed that this meeting statement updates the task' not in n and fl(J['u-no'], 'schedule_context', 'P2') and qrec(J['u-no'])['answer'] == 'no')
    check('t36.18 Default: no update; AI-203 carries a "Possible schedule update" label with the meeting words',
          'Reviewer confirmed that this meeting statement updates the task' not in d and fl(J['u-defer'], 'possible_schedule_update', 'AI-203') and qrec(J['u-defer'])['answer'] == 'place')
    rv = J['u-yes']['review']
    check('t36.19 the review record keeps the drop and the placement of the dated transcript task',
          rv['changes']['dropped'] == [I_NEW5 + 1] and any(p['op'] == I_NEW4 + 1 and 'undate' in p['acts'] for p in rv.get('placements', [])), json.dumps(rv.get('placements'))[:200])
    check('t36.19a the package carries the labels it put on the board', any(l['kind'] == 'date_unclear' for l in rv.get('labels', [])), json.dumps(rv.get('labels'))[:200])""")
r('''    """The same mechanical choices in either view: drop every blocked change, Defer every question."""''',
  '''    """D-UX12: no decisions at all. Every reply is accepted on its defaults (criterion 1)."""
    return''')
r("check(f't35.28 {name}: same choices give the same result in both views ({what})', same, what)",
  "check(f't36.28 {name}: no decisions needed, and both views accept the same package ({what})', same and not u['blocked'], what)")
r("""        w.pg.check(f'{panel} input[data-ux-q="same:1"][value="attach:AI-205"]'); w.pg.wait_for_timeout(80)
        w.pg.check(f'{panel} input[data-ux-q="same:9"][value="move"]'); w.pg.wait_for_timeout(80)""",
  """        open_overrides(w, panel); w.pg.check(f'{panel} input[data-ux-q="same:1"][value="attach:AI-205"]'); w.pg.wait_for_timeout(80)
        open_overrides(w, panel); w.pg.check(f'{panel} input[data-ux-q="same:9"][value="move"]'); w.pg.wait_for_timeout(80)""")
r("""        ATT['preview' if user else 'rpreview'] = w.pg.inner_text(panel)""", """        open_overrides(w, panel); ATT['preview' if user else 'rpreview'] = w.pg.inner_text(panel)""")
r("""    needs = w.pg.inner_text('#ux-needs') if w.pg.query_selector('#um-result #ux-needs') else ''
    check('t35.43 everything that needs a decision is in one place at the top ("Needs your decision")',
          'Needs your decision (3)' in needs and 'Monday through Friday' in needs and w.js("() => document.querySelectorAll('#ux-needs button[data-ux-drop]').length") == 2, needs[:200])
    check('t35.44 the count under Update the board says what is left and where', 'Still to decide: 1 question and 2 changes' in w.pg.inner_text('#um-result'))""",
  """    labs = w.pg.inner_text('#ux-labels') if w.pg.query_selector('#um-result #ux-labels') else ''
    check('t36.43 Aaron\\'s third reply needs no decision: the invitation tasks become meeting notes and the travel days a possible schedule update',
          'Meeting administration (2)' in labs and 'Possible schedule update (' in labs and 'Monday through Friday' in labs
          and not w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled"), labs[:300])
    check('t36.44 the line under Update the board says nothing needs deciding', 'Nothing needs deciding' in w.pg.inner_text('#um-result'))""")
r("""    check('t35.45 "slides" in the label carries the promised "slide deck"', "Can't be accepted" not in item.split('Keep')[0], item[:200])""",
  """    check('t35.45 "slides" in the label carries the promised "slide deck"', "Can't be accepted" not in item.split('Keep')[0], item[:200])
    BOARD['t3'] = user_accept(w)
    w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(400); w.pg.click('#attn-btn'); w.pg.wait_for_timeout(300)
    at = w.pg.inner_text('#panel')
    where = w.js("() => { const h = [...document.querySelectorAll('#panel section.snap')].find(x => /^Meeting administration/.test(x.querySelector('h3').textContent)); return h ? [...h.querySelectorAll('.lbl-row > .sub:first-child')].map(x => x.textContent) : []; }")
    # By design (Aaron, 2026-10-13): an item with no project says where it came from ("Meeting: <title>, <date> — no project or task named").
    check('t36.61 board: meeting administration stays with the meeting, not a project (Needs attention, "Meeting: … no project or task named")',
          len(where) == 2 and all(x.startswith('Meeting: ') and x.endswith('no project or task named') for x in where), json.dumps(where))
    w.pg.click('#projects [data-project="P2"]'); w.pg.wait_for_timeout(300)
    oi = w.pg.inner_text('#open-items') if w.pg.query_selector('#open-items') else ''
    check('t36.62 board: project open items do not include meeting administration', 'Meeting administration' not in oi, oi[:300])""")

# New for D-UX12: hard stops, demotion, and the board (plan §9 criteria 2, 3 and 5).
r("""           ('golden, older format without tables', {k: v for k, v in GOLD.items() if k not in ('segments', 'register')})]""",
  """           ('golden, older format without tables', {k: v for k, v in GOLD.items() if k not in ('segments', 'register')}),
           ('Aaron D-UX11 run 1', 'dux11_tester_run1.json'), ('Aaron D-UX11 run 2', 'dux11_tester_run2.json')]""")
r("""run_user(t35a)""", '''BOARD = {}
MUT = lambda i: json.load(open(os.path.join(HERE, 'mutations', f'D{i:02d}.json')))
def t36i(w):
    user_prepare(w)
    d18 = MUT(18); d18['context'] = TOKEN; user_paste(w, d18)
    res = w.pg.inner_text('#um-result'); nxt = w.pg.inner_text('#um-next')
    check('t36.50 hard stop: contradictory owners in one reply stop the import with a plain message, and the next action is the fix request',
          'contradicts itself' in res and not w.pg.query_selector('#um-result [data-ux-accept]') and 'fix request' in nxt.lower(), res[:200] + ' | ' + nxt)
    bad = dict(GOLD); bad['ops'] = GOLD['ops'] + [{'op': 'ProgressNote', 'tasking': 'AI-999', 'text': 'x', 'src': [{'seg': 'S014', 'quote': 'There seems to be some conflict in the dates'}]}]
    user_paste(w, {'x': 1}); user_paste(w, {**bad, 'context': TOKEN})
    res = w.pg.inner_text('#import-out')
    check('t36.51 hard stop: a change to a task that does not exist stops the import', not w.js("() => { const b = document.querySelector('#um-result [data-ux-accept]'); return !!b && !b.disabled; }"), res[:200])
    d16 = MUT(16); d16['context'] = TOKEN
    user_paste(w, {'x': 1}); user_paste(w, d16)
    res = w.pg.inner_text('#um-result')
    check('t36.52 demotion: an unsupported "completed" is not applied; the screen says it is noted as a possible change',
          'Not applied. It is noted on the task as a possible change' in res and 'Possible status change (' in w.pg.inner_text('#ux-labels'), res[:200])
    pkg = json.loads(user_accept(w) or '{}')
    st = [n for d in pkg.get('deltas', []) for n in (d.get('doc') or {}).get('@graph', []) if n.get('@type') == 'Status']
    check('t36.53 demotion: the package has no status change for it, and carries the label', not st and any(f.get('kind') == 'possible_status_change' for f in pkg.get('flags', [])), json.dumps(st)[:200])
    check('t36.54 no page errors', not w.errors, '; '.join(w.errors)[:200])

def t36j(w):
    user_prepare(w); user_paste(w, RUN2); BOARD['run2'] = user_accept(w)
    w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(400)
    w.pg.click('#projects [data-project="P2"]'); w.pg.wait_for_timeout(300)
    panel = w.pg.inner_text('#panel')
    check('t36.55 board: a task carries its label ("Date unclear" on the transcript task)',
          w.js("() => [...document.querySelectorAll('#panel .lbl-chip')].some(c => c.textContent === 'Date unclear')"), panel[:300])
    check('t36.56 board: the project list shows a count of open items', 'open item' in w.pg.inner_text('#projects'), w.pg.inner_text('#projects')[:200])
    oi = w.pg.inner_text('#open-items') if w.pg.query_selector('#open-items') else ''
    check('t36.57 board: the project has an Open items section above its tasks', bool(oi) and w.js("() => { const o = document.getElementById('open-items'), t = document.querySelector('#panel .ownerwork'); return !!o && !!t && (o.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; }"), oi[:200])
    # By design (§16.15, ratified 2026-10-14): the evidence is collapsed under the actions; opening it is the second click.
    w.js("() => { const d = document.querySelector('#panel details.lbl'); if (d) { d.open = true; const e = d.querySelector('details.lbl-ev'); if (e) e.open = true; } }")
    body = w.pg.inner_text('#panel .lbl-body') if w.pg.query_selector('#panel .lbl-body') else ''
    check('t36.58 board: the source quote, speaker and meeting are under the label (evidence collapsed below the actions)', '\\u201c' in body and 'Weekly board walk' in body, body[:200])
    w.pg.click('#attn-btn'); w.pg.wait_for_timeout(300)
    at = w.pg.inner_text('#panel')
    check('t36.59 board: Needs attention lists every labeled item, grouped by label', 'Needs attention' in at and 'Date unclear' in at and 'Possible schedule update' in at, at[:300])
    check('t36.60 no page errors', not w.errors, '; '.join(w.errors)[:200])

def t36k(w):
    # Aaron's accepted package from his Oct 13 test (made on the D-UX11 build): the email and the board.
    w.load_sample()
    w.pg.set_input_files('#file-in', os.path.join(HERE, 'aaron_pkg_2026-10-13.json')); w.pg.wait_for_timeout(1500)
    w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(300); w.pg.select_option('#asof', '20261001T140000Z'); w.pg.wait_for_timeout(300)
    w.pg.click('#projects [data-project="P2"]'); w.pg.wait_for_timeout(300)
    oi = w.pg.inner_text('#open-items') if w.pg.query_selector('#open-items') else ''
    check('t36.63 board: an item that names no project, from a one-project meeting, is in that project’s Open items', 'Connectivity should be fine' in oi, oi[:300])
    w.pg.click('#meeting-report'); w.pg.wait_for_timeout(500)
    if w.js("() => document.getElementById('msum-trace').checked"): w.pg.click('#msum-trace'); w.pg.wait_for_timeout(300)
    t = w.pg.inner_text('#msum-preview')
    ex = t[t.find('Executive Summary'):t.find('New actions')]
    check('t36.64 email: the executive summary is a short account (under 200 words), not every note pasted together', len(ex.split()) < 200 and 'Sofia Alvarez took on' in ex, f'{len(ex.split())} words')
    check('t36.65 email: next up says the sample-file test is due today and blocked on the firewall rule', 'due today, blocked on BL-202 (Raj Patel)' in ex, ex[-300:])
    leaks = [x for x in ['Evidence:', 'NEW-', 'INDEX', 'open the item on the Board', 'Next steps include'] if x in t] + re.findall(r'\\bS\\d{3}\\b', t)
    check('t36.66 email (recipient copy): no segment numbers, internal references or filler', not leaks, ', '.join(leaks))
    check('t36.67 email: open questions name the task, not a bare code', 'Open question (AI-206 Assess transfer-environment integration options)' in t, t[t.find('Risks'):][:300])
    check('t36.68 no page errors', not w.errors, '; '.join(w.errors)[:200])

def t36l(w):
    # Aaron's enterprise-machine reply (2026-10-13): the reviewer copy reads cleanly too.
    cur = json.load(open(os.path.join(HERE, 'enterprise_run_2026-10-13.json'))); cur['context'] = TOKEN
    user_prepare(w); user_paste(w, cur)
    check('t36.69 enterprise reply: nothing to decide, and the dropped summaries promise is labeled Check scope',
          not w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled") and 'leaves out “summaries”' in w.pg.inner_text('#ux-labels'))
    user_accept(w); w.pg.click('[data-tab="board"]'); w.pg.wait_for_timeout(300); w.pg.click('#meeting-report'); w.pg.wait_for_timeout(500)
    t = w.pg.inner_text('#msum-preview')
    dup = [x for x in ['Scope to confirm', 'Possibly missed', 'Possible schedule change'] if any(l.count(x) > 1 for l in t.splitlines())]
    check('t36.70 email: no label is printed twice on one line', not dup, ', '.join(dup))
    # Testers' review of the email (2026-10-13), with Aaron's rulings.
    row = lambda code: next((l for l in t.splitlines() if l.startswith(code + ' ')), '')
    check('t36.73 email opens on the recipient copy: no evidence numbers, no "Reviewer flags" line', 'Evidence:' not in t and 'Reviewer flags' not in t and not w.js("() => document.getElementById('msum-trace').checked"))
    check('t36.74 email: an incomplete action carries its point to confirm in its own row (AI-404 slide deck, AI-405 summaries)',
          'Scope to confirm: the action leaves out “slide deck”' in row('AI-404') and 'Scope to confirm: the action leaves out “summaries”' in row('AI-405'), row('AI-404')[:200])
    check('t36.75 email: AI-203 shows the May 18–22 window in its own row; AI-204 shows the dropped "start preparing" scope',
          'Possible schedule change' in row('AI-203') and 'May twenty-second' in row('AI-203') and 'start preparing for the transfer period' in row('AI-204'), row('AI-204')[-200:])
    check('t36.76 email (recipient copy): no audit language ("Possibly missed", "nothing records it")', 'Possibly missed' not in t and 'nothing records it' not in t)
    adm = t[t.find('Meeting administration'):t.find('Risks, dependencies')]
    check('t36.77 email: invitations are a short neutral line under Meeting administration, not a project risk', 'Send the recurring coordination invitation' in adm and 'From the meeting' not in adm
          and 'invitation' not in t[t.find('Risks, dependencies'):].lower(), adm[:200])
    check('t36.78 email: the conclusion does not overstate ("accepted actions and task updates")', 'The board has been updated with the accepted actions and task updates.' in t)
    w.pg.click('#msum-trace'); w.pg.wait_for_timeout(300); rv = w.pg.inner_text('#msum-preview')
    check('t36.79 reviewer copy (one tick): evidence numbers and the audit items are still there', 'Evidence:' in rv and 'Possibly missed' in rv)
    check('t36.71 email: "No owner yet" for the staging check appears once', t.count('No owner yet (AI-403') == 1, str(t.count('No owner yet (AI-403')))
    check('t36.72 no page errors', not w.errors, '; '.join(w.errors)[:200])

run_user(t36l)
run_user(t36k)
run_user(t36i)
run_user(t36j)
run_user(t35a)''')
open(os.path.join(HERE, 't36_dux12.py'), 'w', encoding='utf-8').write(s)
print('wrote t36_dux12.py')
