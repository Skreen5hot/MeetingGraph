"""D-UX11 user mode acceptance tests (user-mode plan §4, ratified 2026-10-12, amended the same day).
User-mode steps use real typing and visible clicks only; Reviewer details is the testers' view.
Run: python3 t35_dux11.py <MeetingGraph.html>
"""
import sys, os, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from wb import run, TRANSCRIPT

HERE = os.path.dirname(os.path.abspath(__file__))
WBPATH = sys.argv[1]
GOLD = json.load(open(os.path.join(HERE, 'golden_b.json')))
RUN2 = json.load(open(os.path.join(HERE, 'terra_dux10h_run2.json')))
FLAWED = json.load(open(os.path.join(HERE, 'flawed_difficult.json')))
ROUND1 = json.load(open(os.path.join(HERE, 'round1.json')))
TOKEN = GOLD['context']
I_NEW4 = next(i for i, o in enumerate(RUN2['ops']) if o.get('ref') == 'NEW-4')   # transcript dated from "today's"
I_NEW5 = next(i for i, o in enumerate(RUN2['ops']) if o.get('ref') == 'NEW-5')   # summaries without "materials"
BANNED = ['contract', '0.3.0', 'extension', 'NewTasking', 'ProgressNote', 'NEW-', 'coverage', 'disposition', 'Temporal Instant', 'Number segments', 'register snapshot', 'INDEX'] + \
    ['ADMIN-IN-PROJECT', 'CITE-RANGE', 'COMMITMENT-MISCLASSIFIED', 'CONDITIONAL-TASKING', 'CONTINGENCY-DROPPED', 'COV-', 'DECOMP-MERGED',
     'DELIVERABLE-DROPPED', 'DELIVERABLES-MERGED', 'DISP-', 'MATCH-', 'NEW-DUPLICATE', 'OVER-SPLIT', 'PARTY-IDENTITY', 'PROJ-',
     'QUOTE-TRUNCATED', 'REF-DANGLING', 'SELF-REVIEW', 'TASK-NO-ACCEPTANCE', 'TIME-UNGROUNDED', 'TIMING-MERGED']
results = []

def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))

def visible_text(w):
    return w.js("() => document.getElementById('view-prepare').innerText")

def jargon(text):
    hits = [b for b in BANNED if b in text] + re.findall(r'\bS\d{3}\b', text)
    return hits

def strip_times(o):
    if isinstance(o, dict): return {k: strip_times(v) for k, v in o.items() if k not in ('at', 'acceptedAt', 'exportedAt', 'createdAt', 'generatedAt', 'sha256', 'fileSha256')}
    if isinstance(o, list): return [strip_times(x) for x in o]
    return o

def user_prepare(w):
    """User mode, as a person does it: paste the transcript, set the date and time zone. Numbering runs on its own."""
    w.reviewer_details(False)
    w.load_sample()
    w.pg.click('[data-tab="prepare"]')
    w.pg.fill('#transcript', TRANSCRIPT)
    w.pg.fill('#m-date', '2026-10-01')
    w.pg.select_option('#m-offset', '-04:00')
    w.pg.wait_for_timeout(1500)

def user_paste(w, reply):
    w.pg.fill('#llm-in', json.dumps(reply)); w.pg.wait_for_timeout(900)

def user_decide(w, answers=None, drop=(), undate=()):
    for qid, v in (answers or {}).items(): w.pg.check(f'#um-result input[data-ux-q="{qid}"][value="{v}"]'); w.pg.wait_for_timeout(80)
    for i in drop: w.pg.uncheck(f'#um-result input[data-ux-keep="{i}"]'); w.pg.wait_for_timeout(80)   # Keep unticked
    for i in undate: w.pg.click(f'#um-result button[data-ux-undate="{i}"]'); w.pg.wait_for_timeout(80)

def user_accept(w):
    w.pg.click('#um-result [data-ux-accept]'); w.pg.wait_for_timeout(1500)
    return w.last_download_text()

def questions(w, panel='#um-result'):
    return w.js(f"() => [...document.querySelectorAll('{panel} .ux-q')].map(li => ({{ id: li.querySelector('input').dataset.uxQ, text: li.querySelector('.ux-qtext').innerText }}))")

CHOICES = dict(answers={'scope:AI-203': 'yes', 'scope:AI-207': 'defer'}, drop=(I_NEW5,), undate=(I_NEW4,))

# ---------------- t35a: the user path, plain language, the gate ----------------
def t35a(w):
    user_prepare(w)
    chat = w.js("() => document.getElementById('chat-text') ? document.getElementById('chat-text').value : ''")
    check('t35.1 user mode: the request is ready without clicking Number segments (it is not on screen)',
          TOKEN in chat and not w.pg.is_visible('#do-segment'), chat[:80])
    nxt = w.pg.inner_text('#um-next')
    check('t35.2 one next action: "Copy for the chat"', w.pg.inner_text('#um-primary') == 'Copy for the chat', nxt)
    w.pg.click('#um-primary'); w.pg.wait_for_timeout(200)
    check('t35.3 next action after copying: paste the reply', 'Paste the chat' in w.pg.inner_text('#um-next'), w.pg.inner_text('#um-next'))
    user_paste(w, GOLD)
    check('t35.4 validation runs on paste (Validate is not on screen); golden asks nothing and can be accepted',
          not w.pg.is_visible('#do-validate') and w.pg.is_visible('#um-result') and not questions(w)
          and w.js("() => !document.querySelector('#um-result [data-ux-accept]').disabled"))
    hits = jargon(visible_text(w))
    check('t35.5 no jargon in user mode (golden)', not hits, ', '.join(hits))
    user_paste(w, {'x': 1}); user_paste(w, RUN2)   # a fresh paste of a different reply
    qs = questions(w)
    q203 = next((q for q in qs if q['id'] == 'scope:AI-203'), None)
    check('t35.6 D-UX11h: run 2 asks whether the May 18-22 window updates AI-203, quoting the meeting',
          bool(q203) and 'May eighteenth through May twenty-second' in q203['text'] and 'Run a test transfer with a sample file' in q203['text'], json.dumps(qs)[:300])
    blocked = w.js("() => [...document.querySelectorAll('#um-result .ux-blocked')].length")
    acc_off = w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled")
    check('t35.7 class A: the transcript change (date from "today\'s") cannot be accepted as written; Update the board is disabled', blocked == 1 and acc_off, f'{blocked} blocked, disabled={acc_off}')
    hits = jargon(visible_text(w))
    check('t35.8 no jargon in user mode (run 2, with questions and blocked changes)', not hits, ', '.join(hits))
    user_decide(w, answers=CHOICES['answers'])
    check('t35.9 answering the questions alone is not enough while a change is blocked',
          w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled"))
    user_decide(w, drop=CHOICES['drop'], undate=CHOICES['undate'])
    check('t35.10 with the blocked changes resolved, Update the board is enabled',
          not w.js("() => document.querySelector('#um-result [data-ux-accept]').disabled"))
    after = w.pg.inner_text('#um-result')
    check('t35.11a before Accept, the screen says what the choices leave behind (the summaries promise)',
          'What your choices leave behind' in after and 'summaries' in after.split('What your choices leave behind')[1].lower(), after[-400:])
    check('t35.11 three kinds of item are visibly distinct (changes, questions, open items)',
          all(h in w.pg.inner_text('#um-result') for h in ['Changes to your board', 'Questions about this meeting', 'Open items']))
    check('t35.12 no page errors in the user path', not w.errors, '; '.join(w.errors)[:300])

# ---------------- t35b: same package in both views; Yes / No / Defer reproducible ----------------
PKGS = {}
def user_pkg(answer203, key):
    def go(w):
        user_prepare(w); user_paste(w, RUN2)
        user_decide(w, answers={**CHOICES['answers'], 'scope:AI-203': answer203}, drop=CHOICES['drop'], undate=CHOICES['undate'])
        PKGS[key] = user_accept(w)
        PKGS[key + ':errors'] = list(w.errors)
    run(WBPATH, go)

def reviewer_pkg(key):
    def go(w):
        w.reviewer_details(True); w.load_sample()
        w.pg.click('[data-tab="prepare"]')
        w.prepare(TRANSCRIPT); w.validate(RUN2)
        for qid, v in CHOICES['answers'].items(): w.pg.check(f'#ux-decisions input[data-ux-q="{qid}"][value="{v}"]'); w.pg.wait_for_timeout(80)
        for i in CHOICES['drop']: w.pg.uncheck(f'#import-out .revlist input[data-ux-keep="{i}"]'); w.pg.wait_for_timeout(80)
        for i in CHOICES['undate']: w.pg.click(f'#ux-decisions button[data-ux-undate="{i}"]'); w.pg.wait_for_timeout(80)
        w.pg.click('#import-out [data-accept]'); w.pg.wait_for_timeout(1500)
        PKGS[key] = w.last_download_text()
    run(WBPATH, go)

def t35b():
    user_pkg('yes', 'u-yes'); user_pkg('yes', 'u-yes2'); user_pkg('no', 'u-no'); user_pkg('defer', 'u-defer'); reviewer_pkg('r-yes')
    J = {k: json.loads(v) for k, v in PKGS.items() if not k.endswith(':errors') and v}
    check('t35.13 all five runs produced a package', len(J) == 5, ', '.join(J))
    if len(J) < 5: return
    same = strip_times(J['u-yes']) == strip_times(J['r-yes'])
    if not same:
        a, b = json.dumps(strip_times(J['u-yes']), sort_keys=True), json.dumps(strip_times(J['r-yes']), sort_keys=True)
        i = next((k for k in range(min(len(a), len(b))) if a[k] != b[k]), None); diff = f'first difference at {i}: {a[i-80:i+80]} || {b[i-80:i+80]}' if i is not None else 'length differs'
    else: diff = ''
    check('t35.14 same input + same choices: user mode and Reviewer details accept the same package (apart from timestamps)', same, diff)
    check('t35.15 Yes is reproducible: the same choices twice give the same package', strip_times(J['u-yes']) == strip_times(J['u-yes2']))
    y, n, d = PKGS['u-yes'], PKGS['u-no'], PKGS['u-defer']
    qrec = lambda j: next(q for q in j['review']['questions'] if q['id'] == 'scope:AI-203')
    check('t35.16 Yes: a reviewer-confirmed update on AI-203 citing the meeting statement; the decision is in the review record',
          'Reviewer confirmed that this meeting statement updates the task' in y and qrec(J['u-yes'])['answer'] == 'yes'
          and qrec(J['u-yes'])['reviewerConfirmed'] and qrec(J['u-yes'])['seg'] == 'S014')
    check('t35.17 No: no update; the statement stays as project-level planning context, recorded',
          'Reviewer confirmed that this meeting statement updates the task' not in n and 'project-level planning context' in n and qrec(J['u-no'])['answer'] == 'no')
    check('t35.18 Defer: no update and no added context; the question is recorded as deferred',
          'Reviewer confirmed that this meeting statement updates the task' not in d and 'project-level planning context' not in d and qrec(J['u-defer'])['answer'] == 'defer')
    ch = J['u-yes']['review']['changes']
    check('t35.19 the dropped and undated changes are recorded', ch['dropped'] == [I_NEW5 + 1] and ch['undated'] == [I_NEW4 + 1], json.dumps(ch))
    cons = J['u-yes']['review'].get('consequences', [])
    check('t35.19a the package records the summaries promise left uncarried by the reviewer\'s drop', any(c.get('code') == 'DELIVERABLE-DROPPED' for c in cons), json.dumps(cons)[:200])
    check('t35.20 no page errors in the package runs', not any(PKGS[k] for k in PKGS if k.endswith(':errors')))

# ---------------- t35c: the fix request; the Reviewer details setting ----------------
def t35c(w):
    user_prepare(w)
    w.pg.click('#um-primary'); w.pg.wait_for_timeout(200)
    user_paste(w, {**FLAWED, 'context': TOKEN})
    nxt = w.pg.inner_text('#um-next')
    check('t35.21 a reply that needs another pass: the next action is the fix request', 'one more pass (1 of 2)' in nxt and w.pg.inner_text('#um-primary') == 'Copy the fix request', nxt)
    w.pg.click('#um-primary'); w.pg.wait_for_timeout(200)
    check('t35.22 after copying the fix request: paste the corrected reply', 'corrected reply' in w.pg.inner_text('#um-next'), w.pg.inner_text('#um-next'))
    r1 = dict(ROUND1); r1['context'] = TOKEN
    user_paste(w, r1)
    check('t35.23 the corrected reply is validated on paste; the counter moves to 2 of 2', '(2 of 2)' in w.pg.inner_text('#um-next') or 'Review the changes' in w.pg.inner_text('#um-next'), w.pg.inner_text('#um-next'))
    w.pg.click('#rd-toggle'); w.pg.wait_for_timeout(200)
    on = w.js("() => !document.getElementById('view-prepare').classList.contains('um')")
    check('t35.24 the Reviewer details switch shows the full screen (repair card, coverage review)', on and w.pg.is_visible('#repair-card'))
    w.pg.click('#export-ws'); w.pg.wait_for_timeout(500)
    ws = json.loads(w.last_download_text())
    check('t35.25 the setting is part of the workspace file for the team folder', ws.get('settings', {}).get('reviewerDetails') is True, json.dumps(ws.get('settings')))
    w.pg.reload(); w.pg.wait_for_timeout(500)
    check('t35.26 the setting survives a reload', w.js("() => !document.getElementById('view-prepare').classList.contains('um')"))
    check('t35.27 no page errors', not w.errors, '; '.join(w.errors)[:300])

def run_user(fn):
    def go(w):
        return fn(w)
    run(WBPATH, go)

# ---------------- t35d: the same gate on every reply we hold (criterion 1), no jargon on any of them (criterion 4) ----------------
REPLIES = [('golden', GOLD), ('rejected', FLAWED), ('round0', 'round0.json'), ('round1', ROUND1), ('round2', 'round2.json'),
           ('round3', 'round3.json'), ('terra-run3', 'terra_run3_final.json'), ('dux10h-run2', RUN2),
           ('golden, older format without tables', {k: v for k, v in GOLD.items() if k not in ('segments', 'register')})]
def load_reply(r):
    j = json.load(open(os.path.join(HERE, r))) if isinstance(r, str) else json.loads(json.dumps(r))
    j['context'] = TOKEN; return j

def decide_all(w, panel):
    """The same mechanical choices in either view: drop every blocked change, Defer every question."""
    for _ in range(40):
        b = w.pg.query_selector(f'{panel} button[data-ux-drop]')
        if not b: break
        b.click(); w.pg.wait_for_timeout(60)
    for _ in range(40):
        q = w.js(f"() => {{ const r = [...document.querySelectorAll('{panel} input[data-ux-q][value=\"defer\"]')].find(x => ![...document.querySelectorAll('{panel} input[data-ux-q]')].some(y => y.dataset.uxQ === x.dataset.uxQ && y.checked)); return r ? r.dataset.uxQ : null; }}")
        if not q: break
        w.pg.check(f'{panel} input[data-ux-q="{q}"][value="defer"]'); w.pg.wait_for_timeout(60)

def view_pkg(reply, user):
    out = {}
    def go(w):
        if user:
            user_prepare(w); user_paste(w, reply)
            out['jargon'] = jargon(visible_text(w))
            decide_all(w, '#um-result')
            btn = w.pg.query_selector('#um-result [data-ux-accept]')
            out['blocked'] = not btn or btn.is_disabled()
            out['pkg'] = None if out['blocked'] else user_accept(w)
        else:
            w.reviewer_details(True); w.load_sample(); w.pg.click('[data-tab="prepare"]')
            w.prepare(TRANSCRIPT); w.validate(reply)
            decide_all(w, '#ux-decisions')
            btn = w.pg.query_selector('#import-out [data-accept]')
            out['blocked'] = not btn or btn.is_disabled()
            if not out['blocked']: w.pg.click('#import-out [data-accept]'); w.pg.wait_for_timeout(1500)
            out['pkg'] = None if out['blocked'] else w.last_download_text()
        out['errors'] = list(w.errors)
    run(WBPATH, go)
    return out

def t35d():
    for name, r in REPLIES:
        reply = load_reply(r)
        u, v = view_pkg(reply, True), view_pkg(reply, False)
        if u['blocked'] or v['blocked']:
            same = u['blocked'] == v['blocked']; what = f"user blocked={u['blocked']}, reviewer blocked={v['blocked']}"
        else:
            a, b = strip_times(json.loads(u['pkg'])), strip_times(json.loads(v['pkg']))
            same = a == b; what = 'accepted' if same else 'packages differ'
        check(f't35.28 {name}: same choices give the same result in both views ({what})', same, what)
        check(f't35.29 {name}: no jargon in user mode', not u['jargon'], ', '.join(u['jargon']))
        check(f't35.30 {name}: no page errors', not u['errors'] and not v['errors'], '; '.join(u['errors'] + v['errors'])[:300])

# ---------------- t35e: the testers' first D-UX11 reply (2026-10-12) ----------------
T1 = json.load(open(os.path.join(HERE, 'dux11_tester_run1.json')))   # made from an older request (older board)
def t35e(w):
    user_prepare(w); user_paste(w, T1)
    txt = w.pg.inner_text('#import-out')
    check('t35.31 a reply made from an older request: user mode says so plainly and names the next step',
          'older request' in txt and 'Copy for the chat' in txt and 'Number segments' not in txt and 'register' not in txt, txt[:200])
    check('t35.32 no jargon on the older-request message', not jargon(visible_text(w)), ', '.join(jargon(visible_text(w))))
    cur = dict(T1); cur['context'] = TOKEN
    user_paste(w, {'x': 1}); user_paste(w, cur)
    qs = questions(w)
    same = next((q['text'] for q in qs if 'may be the same work as' in q['text']), '')
    better = next((q['text'] for q in qs if 'fits' in q['text'] and 'better' in q['text']), '')
    check('t35.33 a possible duplicate names the task already on the board', 'Coordinate partner-site access and staging arrangements' in same, same)
    check('t35.34 an update that may belong elsewhere names both tasks', 'Send partner access point-of-contact details' in better
          and 'Provide James and Raj with a direct site-access contact' in better, better)
    res = w.pg.inner_text('#um-result')
    item = res[res.find('Provide the October 1 meeting transcript'):]; item = item[:item.find('Keep')]
    check('t35.35a "those materials" is not a missing deliverable: the transcript task is not blocked for it (Aaron, 2026-10-12)', '“materials”' not in item, item[:200])
    check('t35.36 no jargon (tester reply)', not jargon(visible_text(w)), ', '.join(jargon(visible_text(w))))
    d06 = json.load(open(os.path.join(HERE, 'mutations', 'D06.json'))); d06['context'] = TOKEN
    user_paste(w, {'x': 1}); user_paste(w, d06)
    res = w.pg.inner_text('#um-result')
    check('t35.35 a blocked change says what it leaves out (golden with the slide deck dropped)', 'leaves out “slide deck”' in res, res[:300])

# Aaron's ruling (2026-10-12): an unowned task the meeting asked for is created unowned, with who asked.
T2 = json.load(open(os.path.join(HERE, 'dux11_tester_run2.json')))
def t35f(w):
    user_prepare(w); cur = dict(T2); cur['context'] = TOKEN; user_paste(w, cur)
    res = w.pg.inner_text('#um-result')
    item = res[res.find('Inform the Partner agency about the weight'):]; item = item[:item.find('Keep')]
    check('t35.37 an unowned task the meeting asked for is not blocked', "Can't be accepted" not in item, item[:200])
    check('t35.38 the board records who asked for it', 'Inform the Partner agency about the weight of the equipment and file cases”: Requested by James Ortiz: “Please make sure the Partner agency knows the equipment and file cases are heavy.”' in res)

# Aaron (2026-10-12): what belongs to an existing task is added to it as a note, in either view, with the same result.
ATT = {}
def attach_pkg(user):
    def go(w):
        cur = dict(T1); cur['context'] = TOKEN
        if user:
            user_prepare(w); user_paste(w, cur); panel = '#um-result'
        else:
            w.reviewer_details(True); w.load_sample(); w.pg.click('[data-tab="prepare"]'); w.prepare(TRANSCRIPT); w.validate(cur); panel = '#ux-decisions'
        w.pg.check(f'{panel} input[data-ux-q="same:1"][value="attach:AI-205"]'); w.pg.wait_for_timeout(80)
        w.pg.check(f'{panel} input[data-ux-q="same:9"][value="move"]'); w.pg.wait_for_timeout(80)
        decide_all(w, panel)
        ATT['preview' if user else 'rpreview'] = w.pg.inner_text(panel)
        if user: ATT['u'] = user_accept(w)
        else: w.pg.click('#import-out [data-accept]'); w.pg.wait_for_timeout(1500); ATT['r'] = w.last_download_text()
        ATT['err'] = ATT.get('err', []) + list(w.errors)
    run(WBPATH, go)

def t35g():
    attach_pkg(True); attach_pkg(False)
    u = ATT.get('u') or ''
    check('t35.39 the duplicate question offers both existing tasks it may belong to', 'Add it to “Send partner access point-of-contact details” as a note' in ATT.get('preview', '')
          and 'Add it to “Coordinate partner-site access and staging arrangements” as a note' in ATT.get('preview', ''))
    check('t35.40 "Add it to … as a note": the package carries the work as a note on the existing task, not as new work',
          bool(u) and 'Also needed for this task: Provide James and Raj with a direct site-access contact' in u and 'AI-205' in u, (u or 'no package')[:200])
    check('t35.41 the same choices give the same package in Reviewer details', bool(u) and strip_times(json.loads(u)) == strip_times(json.loads(ATT.get('r') or '{}')))
    check('t35.42 no page errors', not ATT.get('err'), '; '.join(ATT.get('err', []))[:200])

# Aaron's third test (2026-10-12, meeting dated Oct 13): decisions first, and "slides" carries "slide deck".
T3 = json.load(open(os.path.join(HERE, 'dux11_tester_run3.json')))
def t35h(w):
    user_prepare(w); w.pg.fill('#m-date', '2026-10-13'); w.pg.wait_for_timeout(1500)
    cur = dict(T3); cur['context'] = w.js("() => (document.getElementById('chat-text').value.match(/MKG1\\|transcript\\|[^|]+\\|[0-9a-f]{8}/)||[''])[0]")
    user_paste(w, cur)
    needs = w.pg.inner_text('#ux-needs') if w.pg.query_selector('#um-result #ux-needs') else ''
    check('t35.43 everything that needs a decision is in one place at the top ("Needs your decision")',
          'Needs your decision (3)' in needs and 'Monday through Friday' in needs and w.js("() => document.querySelectorAll('#ux-needs button[data-ux-drop]').length") == 2, needs[:200])
    check('t35.44 the count under Update the board says what is left and where', 'Still to decide: 1 question and 2 changes' in w.pg.inner_text('#um-result'))
    res = w.pg.inner_text('#um-result'); item = res[res.find('including partner-site location slides'):][:300]
    check('t35.45 "slides" in the label carries the promised "slide deck"', "Can't be accepted" not in item.split('Keep')[0], item[:200])

run_user(t35a)
run_user(t35e)
run_user(t35h)
t35g()
run_user(t35f)
t35b()
run_user(t35c)
t35d()
fails = [r for r in results if not r[1]]
print(f"\n{len(results) - len(fails)}/{len(results)} passed" + ('' if not fails else f" — {len(fails)} FAILED"))
sys.exit(1 if fails else 0)
