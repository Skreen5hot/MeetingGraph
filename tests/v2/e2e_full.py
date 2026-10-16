"""Browser test of the full v2 page (plan §10.6-10.11): the review's choices, the board and its four decisions, people asked
once, related closures, review again, a conflict switched, and the leadership email. Headless Chromium, as e2e_slice.py.
Run: python3 tests/v2/e2e_full.py    (build first: python3 src/v2/build_v2.py)"""
import json, os, re, sys, tempfile, zipfile
from xml.sax.saxutils import escape
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIT = os.path.join(ROOT, 'tests', 'v2-feasibility')
PAGE = 'file:///' + os.path.join(ROOT, 'dist', 'MeetingGraph2.html').replace('\\', '/')
read = lambda f: open(os.path.join(KIT, f), encoding='utf-8').read()
TMP = tempfile.mkdtemp(prefix='mkg2-full-')
results = []


def check(name, cond, detail=''):
    results.append(bool(cond)); print(f'{"PASS" if cond else "FAIL"} {name}' + (f'  [{str(detail)[:400]}]' if detail and not cond else ''))


def docx(path, header, transcript):
    W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    paras = ''.join(f'<w:p><w:r><w:t xml:space="preserve">{escape(l)}</w:t></w:r></w:p>' for l in [header] + transcript.splitlines())
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
        z.writestr('word/document.xml', f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W}"><w:body>{paras}</w:body></w:document>')
    return path


SEED_DOCX = docx(os.path.join(TMP, 'seed.docx'), 'Harbor Point reopening kickoff-20261019_100000-Meeting Transcript', read('mock-seed-meeting-2026-10-19.txt'))
FU_DOCX = docx(os.path.join(TMP, 'followup.docx'), 'Harbor Point reopening weekly-20261026_100000-Meeting Transcript', read('mock-followup-meeting-2026-10-26.txt'))
FU_TEXT = read('mock-followup-meeting-2026-10-26.txt')
seg_text = {m.group(1): m.group(2) for m in re.finditer(r'^(S\d{3}) \[[^\]]*\] [^:]+: (.*)$', read('meeting-2026-10-26.txt'), re.M)}


def token(pg): return re.match(r'CONTEXT TOKEN[^:]*: (\S+)', pg.input_value('#request')).group(1)
def retoken(pg, text): return text.replace(re.search(r'"context"\s*:\s*"([^"]+)"', text).group(1), token(pg))
def tab(pg, name):
    """v1's screens: Board, Dashboard, Process meeting (prepare) and Workspace (seed) are tabs."""
    pg.click(f'[data-tab="{name}"]'); pg.wait_for_timeout(100)


def paste(pg, text): pg.fill('#reply', text); pg.click('#check-btn'); pg.wait_for_timeout(250)
def st(pg): return pg.evaluate('JSON.parse(JSON.stringify({ items: window.MKG2_state.checked.items }))')['items']
def change(pg, n, key, value):
    """Open the item's "Change…" box, as a person would, and set one choice."""
    sel = pg.locator(f'select[data-r="{key}"][data-n="{n}"]')
    sel.locator('xpath=ancestor::details[1]/summary').click()
    sel.select_option(value); pg.wait_for_timeout(150)


def thread(pg, tid):
    return pg.evaluate('id => { const t = window.MKG2_store.replay(window.MKG2_state.pkgs).threads.get(id); return t ? JSON.parse(JSON.stringify(t)) : null; }', tid)


def bulk(pg, v): pg.select_option('#bulk-proj', v); pg.click('#bulk-btn'); pg.wait_for_timeout(150)


def save(pg, name='Test PM'):
    pg.fill('#saved-by', name)
    with pg.expect_download() as d: pg.click('#save-btn')
    path = os.path.join(TMP, d.value.suggested_filename); d.value.save_as(path)
    return json.load(open(path, encoding='utf-8'))


def decide(pg, action, ids, note):
    """One item at a time, in its dialog (UX A8): open it, write the note, press the decision."""
    tab(pg, 'board'); out = None
    for i in ids:
        opendlg(pg, i)
        pg.fill('#d-note', note)
        with pg.expect_download() as d: pg.click(f'[data-dact="{action}"]')
        pg.wait_for_timeout(150)
        out = json.load(open(d.value.path(), encoding='utf-8'))
    return out


def opendlg(pg, tid):
    pg.evaluate('() => document.querySelectorAll("#panel details").forEach(d => d.open = true)')
    pg.locator(f'#panel [data-ent="{tid}"]').first.click(); pg.wait_for_timeout(150)


def label(pg, action):
    return pg.inner_text(f'[data-dact="{action}"]') if pg.locator(f'[data-dact="{action}"]').count() else None


def item(ref, kind, who, what, seg, words, thread=None, status=None, project='HP', due=None):
    return json.dumps({'ref': ref, 'kind': kind, 'topic': 't', 'project': project, 'who': who, 'what': what, 'due': due, 'importance': 'normal',
                       'thread': thread, 'status': status, 'waitsOn': None, 'seg': seg, 'words': words})


with sync_playwright() as pw:
    br = pw.chromium.launch()
    ctx = br.new_context(timezone_id='America/New_York', accept_downloads=True)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.goto(PAGE); pg.wait_for_timeout(300)
    check('f1 the page opens on v1\'s board, with its tabs and both email reports, the board empty', 'No meetings yet' in pg.inner_text('#panel') and
          [pg.inner_text(f'[data-tab="{t}"]') for t in ('board', 'dash', 'prepare', 'seed')] == ['Board', 'Dashboard', 'Process meeting', 'Workspace'] and
          pg.locator('#email-report').count() == 1 and pg.locator('#meeting-report').count() == 1)

    # ---------------- the seed meeting: D1, reviewed (acceptance 1) ----------------
    tab(pg, 'prepare'); pg.set_input_files('#docx', SEED_DOCX); pg.wait_for_timeout(400); pg.click('#number-btn'); pg.wait_for_timeout(400)
    paste(pg, retoken(pg, read('runs/D1.txt')))
    pg.click('#np-box summary'); pg.fill('#np-name', 'Harbor Point reopening'); pg.click('#np-adv summary'); pg.fill('#np-code', 'HP'); pg.click('#np-add'); pg.wait_for_timeout(150)
    bulk(pg, 'J:PM1')
    items = st(pg)
    calls = [x for x in items if x['kind'] == 'commitment' and re.search('fire marshal', x['what'], re.I)]
    check('f2 D1 has the two fire marshal calls', len(calls) == 2, [c['seg'] for c in calls])
    change(pg, calls[1]['n'], 'sameAs', str(calls[0]['n']))
    check('f3 "Same as…" marks the second call as the first', f'same as item {calls[0]["n"]}' in pg.inner_text('#results'))
    imp = next(x for x in items if x['kind'] == 'commitment' and x['importance'] == 'normal')
    change(pg, imp['n'], 'importance', 'high')
    change(pg, imp['n'], 'importance', 'normal')
    pkg1 = save(pg)
    fires = [x for x in pkg1['items'] if re.search('fire marshal', x['what'], re.I) and x['kind'] == 'commitment']
    check('f4 saved: one fire marshal action with an ID, the other merged into it; the email names it once (acceptance 1)',
          sum(1 for x in fires if x.get('id')) == 1 and any(x.get('mergedInto') == calls[0]['n'] for x in fires) and calls[1]['what'] not in pg.input_value('#email'))
    check('f5 a choice changed and changed back leaves no trace (only the merge is recorded)', [x['n'] for x in pkg1['items'] if x.get('edited')] == [calls[1]['n']])
    first = next(x for x in fires if x.get('id'))
    check('f6 the due date as said is resolved against the meeting date, and the owner is a person', first['due'] == 'this week' and first['dueDate'] == '2026-10-23' and first['person'] == 'Tom Lindqvist', first)
    ids = {x['what']: x['id'] for x in pkg1['items'] if x.get('id')}
    q_mural = next(i for w, i in ids.items() if re.search('mural', w, re.I) and '-Q-' in i)
    tom = next(i for w, i in ids.items() if re.search('architect', w, re.I))
    acts = [x['id'] for x in pkg1['items'] if x.get('id') and '-A-' in x['id'] and not re.search('mural|architect|fire marshal', x['what'], re.I)]

    # ---------------- the board: four decisions (acceptance 4) ----------------
    tab(pg, 'board'); pg.click('[data-project="HP"]'); pg.wait_for_timeout(150)
    b = pg.inner_text('#panel')
    check('f7 the project panel: last time we talked first, open questions and risks, decisions, open work by owner (with counts), the meeting log; no "changed at this meeting", agenda or tick boxes (UX A1-A8)',
          all(h in b for h in ('Last time we talked', 'Open questions and risks', 'Decisions in effect', 'Open work by owner', 'Meeting log')) and first['id'] in b and 'Tom Lindqvist' in b and
          b.find('Last time we talked') < b.find('Open work by owner') and 'Changed at this meeting' not in b and 'Agenda for the next meeting' not in b and
          'Raised for the next meeting' not in b and pg.locator('#panel input[type=checkbox][data-b]').count() == 0 and pg.locator('#panel [data-bact]').count() == 0 and
          pg.locator('#panel h4.owner .n').count() > 0, b[:600])
    check('f7c "Last time we talked" shows the saved summary of the latest meeting of this project, with its date and title (UX A2)',
          pkg1['reply']['summary'] and pkg1['reply']['summary'][:40] in pg.inner_text('#panel .lasttime') and pkg1['meeting']['title'] in pg.inner_text('#panel .lasttime'), pg.inner_text('#panel .lasttime'))
    pg.click(f'[data-ent="{first["id"]}"]'); pg.wait_for_timeout(150)
    h = pg.inner_text('#hist')
    check('f7b an item opens v1\'s history dialog: owner, status, the due date as said with its date, and the speaker\'s words', 'Tom Lindqvist' in h and '“this week” (Oct 23)' in h and 'S0' in h, h[:400])
    check('f7d the dialog\'s decision area is headed "Record a Board decision", the note above the actions, the history below (UX A9)',
          'Record a Board decision' in h and h.find('Record a Board decision') < h.find('History') and pg.locator('#hist .decide-box #d-note + .actions').count() == 1)
    pg.click('#close-hist')
    opendlg(pg, acts[0])
    check('f7e an action offers "Mark completed" and "Mark as not needed"; a non-parked item offers no "bring back"; nothing to restore yet (UX A10-A13)',
          label(pg, 'settled') == 'Mark completed' and label(pg, 'not_needed') == 'Mark as not needed' and label(pg, 'raise') is None and label(pg, 'undo') is None)
    pg.click('#close-hist')
    opendlg(pg, q_mural)
    check('f7f an open question offers "Mark resolved" (UX A12)', label(pg, 'settled') == 'Mark resolved')
    pg.click('#close-hist')
    p1 = decide(pg, 'settled', [acts[0]], 'Confirmed by email')
    check('f8 Settled outside a meeting: a board package with the name and note; the item is done and says so', p1['kind'] == 'board' and p1['savedBy'] == 'Test PM' and
          thread(pg, acts[0])['status'] == 'done' and thread(pg, acts[0])['settledOutside']['note'] == 'Confirmed by email', thread(pg, acts[0]))
    opendlg(pg, acts[0]); restore = label(pg, 'undo'); pg.click('#close-hist')
    decide(pg, 'undo', [acts[0]], 'Too early')
    check('f9 the restore names the status it restores ("Restore status: Open"), and does it (UX A11)', restore == 'Restore status: Open' and
          thread(pg, acts[0])['status'] == 'open' and not thread(pg, acts[0])['settledOutside'], restore)
    decide(pg, 'not_needed', [acts[1], acts[2]], 'Dropped from scope')
    # Raise is offered only for a parked item (UX A10); a raise saved by an earlier version still works.
    pg.evaluate('([id, note]) => { const r = window.MKG2_store.boardDecision({ board: window.MKG2_store.replay(window.MKG2_state.pkgs), action: "raise", ids: [id], note, savedBy: "Test PM" }); window.MKG2_state.pkgs.push(r.pkg); }', [acts[3], 'Need an update'])
    tab(pg, 'prepare'); tab(pg, 'board'); pg.click('[data-project="HP"]'); pg.wait_for_timeout(150)
    sec = pg.text_content('#panel .snap.closed') if pg.locator('#panel .snap.closed').count() else ''
    check('f10 Not needed, one item at a time, in its own collapsed section that separates Completed from Not needed (UX A6)', thread(pg, acts[1])['status'] == 'not_needed' and
          thread(pg, acts[2])['status'] == 'not_needed' and 'Completed' in sec and 'Not needed' in sec and pg.locator('#panel .snap.closed details').get_attribute('open') is None and
          pg.locator('#panel .ownerwork .snap.closed').count() == 0, sec)
    opendlg(pg, acts[4]); pg.fill('#d-note', ''); pg.click('[data-dact="settled"]'); pg.wait_for_timeout(100)
    check('f11 a decision with no note is refused, next to the buttons', 'Add a note' in pg.inner_text('#hist .decide-box #d-msg'))
    pg.click('#close-hist')
    dec = next(i for w, i in ids.items() if '-D-' in i) if any('-D-' in i for i in ids.values()) else None
    if dec: opendlg(pg, dec)
    check('f12 a decision has no Board decision area', dec is None or pg.locator('#hist .decide-box').count() == 0)
    if dec: pg.click('#close-hist')

    # ---------------- the follow-up: raised first, related closure, a person asked once ----------------
    tab(pg, 'prepare'); pg.set_input_files('#docx', FU_DOCX); pg.wait_for_timeout(400); pg.click('#number-btn'); pg.wait_for_timeout(400)
    req = pg.input_value('#request')
    rows = req.split('ID | project | kind | owner | what | due as said | status\n')[1].split('\n')
    check('f13 the raised item is the first open thread in the request; the not-needed ones are left out', rows[0].startswith(acts[3] + ' |') and acts[1] not in req and acts[2] not in req, rows[0])
    fake = '\n'.join([json.dumps({'context': token(pg), 'lastSeg': 'S381', 'summary': 's'}),
                      item('N1', 'decision', 'Okafor, Grace', 'The mural stays', 'S172', 'So that\'s decided. The mural stays', thread=q_mural, status='done'),
                      item('N2', 'commitment', 'Kowalski, Pete (Guest)', 'ZZ guest action', 'S146', "I'll send you the final room list by Wednesday"),
                      item('N3', 'update', 'Lindqvist, Tom', 'ZZ raised update', 'S146', "I'll send you the final room list by Wednesday", thread=acts[3]),
                      json.dumps({'end': 3})])
    paste(pg, fake)
    check('f14 settling the mural question offers Tom\'s architect action, unticked (AI-111, §10.4)', tom in pg.inner_text('#related-box') and not pg.is_checked(f'[data-rel="{tom}|1"]'))
    rb = pg.inner_text('#related-box')
    check('f14b each related action shows its ID, status and why, with "Leave open" chosen and "Also close this action" offered, as the reviewer decision (UX B3)',
          pg.is_checked(f'[data-rel-open="{tom}|1"]') and 'Also close this action' in rb and 'Leave open' in rb and 'your decision as the reviewer' in rb and
          'Suggested because' in rb and pg.locator(f'#related-box [data-ent="{tom}"]').count() == 1, rb)
    pg.check(f'[data-rel="{tom}|1"]'); pg.wait_for_timeout(100)
    check('f15 the new label is asked about, with the closest person suggested but not chosen (B10)', 'Kowalski, Pete (Guest)' in pg.inner_text('#people-box') and
          pg.input_value('[data-ans="Kowalski, Pete (Guest)"]') == 'new')
    pg.select_option('[data-ans="Kowalski, Pete (Guest)"]', 'same:Pete Kowalski'); pg.wait_for_timeout(100)
    keep = pg.inner_text('[data-undo="1"]')
    pg.click('[data-undo="1"]'); pg.wait_for_timeout(100)
    undone = 'not applied' in pg.inner_text('#results') and tom not in pg.inner_text('#related-box')
    again = pg.inner_text('[data-undo="1"]')
    check('f15b the chat closure is kept off with "Keep current status: Open", and put back with "Apply completion" (UX B4)', keep == 'Keep current status: Open' and again == 'Apply completion', [keep, again])
    pg.click('[data-undo="1"]'); pg.wait_for_timeout(100)
    pg.check(f'[data-rel="{tom}|1"]') if not pg.is_checked(f'[data-rel="{tom}|1"]') else None
    check('f16 the chat\'s closure has a one-click undo (and its related offer goes with it), and can be applied again (B8)', undone and tom in pg.inner_text('#related-box'))
    pkg2 = save(pg)
    b = pg.inner_text('#board')
    rel = [x for x in pkg2['items'] if x.get('byReview')]
    guest = next(x for x in pkg2['items'] if x['what'] == 'ZZ guest action')
    check('f17 saved: the question is settled, Tom\'s action closed as the reviewer\'s choice, the guest is Pete Kowalski, and the alias is kept',
          len(rel) == 1 and rel[0]['thread'] == tom and guest['person'] == 'Pete Kowalski' and {'label': 'Kowalski, Pete (Guest)', 'person': 'Pete Kowalski'} in pkg2['aliases'])
    check('f18 the item brought back is no longer flagged once the meeting discussed it', not thread(pg, acts[3]).get('raised'))
    em = pg.input_value('#email')
    check('f19 the meeting email lists the board decisions since the last meeting as the PM\'s', 'Decided outside a meeting since the last meeting' in em and 'marked as not needed by Test PM: Dropped from scope' in em)

    # a third meeting: the guest label is known now
    tab(pg, 'prepare'); pg.set_input_files('#docx', FU_DOCX); pg.wait_for_timeout(400); pg.fill('#m-date', '2026-11-02'); pg.click('#number-btn'); pg.wait_for_timeout(400)
    paste(pg, '\n'.join([json.dumps({'context': token(pg), 'lastSeg': 'S381', 'summary': 's'}),
                         item('N1', 'commitment', 'Kowalski, Pete (Guest)', 'ZZ guest again', 'S146', "I'll send you the final room list by Wednesday"), json.dumps({'end': 1})]))
    check('f20 asked once: the next meeting does not ask about the same label again (acceptance 7)', 'Kowalski, Pete (Guest)' not in pg.inner_text('#people-box') and 'Pete Kowalski' in pg.inner_text('#results'))

    # ---------------- the leadership email ----------------
    tab(pg, 'board'); pg.click('#email-report'); pg.wait_for_timeout(200)
    pg.fill('#l-since', '2026-10-19'); pg.fill('#l-asof', '2026-11-03'); pg.click('#lead-btn'); pg.wait_for_timeout(150)
    check('f20b the Program email report is v1\'s dialog: a formatted preview, copy formatted for email, copy plain text', pg.locator('#lead-preview table').count() == 1 and
          pg.locator('#copy-rich').count() == 1 and pg.locator('#copy-lead').count() == 1)
    le = pg.input_value('#lead')
    heads = ['Key developments:', 'Decisions', 'Management attention/risks', 'Near-term next steps', 'Project task status and accountable owners']
    pg.click('#close-hist')
    check('f21 the leadership email has the PM\'s sections in order', le.startswith('Subject: Project update, ') and '\nTeam,\n' in le and all(le.find('\n' + h + '\n') >= 0 for h in heads) and
          [le.find('\n' + h + '\n') for h in heads] == sorted(le.find('\n' + h + '\n') for h in heads))
    check('f22 it reports the closures and the overdue work from board facts', 'done: ' in le and 'overdue by' in le and first['id'] in le, le[:600])

    # ---------------- review this meeting again ----------------
    tab(pg, 'seed'); pg.click('#saved-box summary')
    with_btn = pg.locator(f'[data-again="{pkg2["id"]}"]')
    with_btn.click(); pg.wait_for_timeout(250)
    check('f23 "Review this meeting again" reopens the saved review, with its choices', 'again' in pg.inner_text('#reply-msg') and pg.is_checked(f'[data-rel="{tom}|1"]'))
    n2 = next(x['n'] for x in st(pg) if x['what'] == 'ZZ guest action')
    change(pg, n2, 'importance', 'high')
    pkg2b = save(pg)
    keep = lambda p: sorted(x['id'] for x in p['items'] if x.get('id'))
    check('f24 saved again: it supersedes the first save, and every ID is kept', pkg2b['supersedes'] == pkg2['id'] and keep(pkg2b) == keep(pkg2) and
          next(x for x in pkg2b['items'] if x['what'] == 'ZZ guest action')['importance'] == 'high')

    # ---------------- a conflict (B16) ----------------
    twin = dict(pkg1, id=pkg1['id'] + '-other', savedBy='Other PM', savedAt='2026-10-19T23:00:00.000Z', supersedes=None)
    tp = os.path.join(TMP, twin['id'] + '.json'); open(tp, 'w', encoding='utf-8').write(json.dumps(twin))
    pg.set_input_files('#load-files', tp); pg.wait_for_timeout(300)
    tab(pg, 'seed')
    check('f25 two saves of one meeting are shown as a conflict, with a switch', 'saved twice' in pg.inner_text('#conflicts') and pg.locator('[data-switch]').count() == 1)
    with pg.expect_download() as d: pg.click('[data-switch]')
    sw = json.load(open(d.value.path(), encoding='utf-8')); pg.wait_for_timeout(200)
    check('f26 switching makes a copy of the other save that supersedes both; the conflict is gone', sw['supersedes'] == pkg1['id'] and sw['alsoSupersedes'] == [twin['id']] and pg.locator('[data-switch]').count() == 0)
    # an earlier meeting loaded after a later one (§10.3): the page names the later meeting to check
    ctx2 = br.new_context(timezone_id='America/New_York', accept_downloads=True); pg2 = ctx2.new_page(); pg2.on('pageerror', lambda e: errors.append(str(e)))
    pg2.goto(PAGE); pg2.wait_for_timeout(300)
    p2f = os.path.join(TMP, pkg2b['id'] + '.json'); open(p2f, 'w', encoding='utf-8').write(json.dumps(pkg2b))
    p1f = os.path.join(TMP, 'early-' + pkg1['id'] + '.json'); open(p1f, 'w', encoding='utf-8').write(json.dumps(pkg1))
    pg2.set_input_files('#load-files', p2f); pg2.wait_for_timeout(200)
    no_warn = 'Same as' not in pg2.inner_text('#meeting-msg')
    pg2.set_input_files('#load-files', p1f); pg2.wait_for_timeout(200)
    check('f25b loading an earlier meeting after a later one names the later meeting, for "Same as…"; loading in order does not', no_warn and
          'Harbor Point reopening weekly (2026-10-26)' in pg2.inner_text('#meeting-msg'), pg2.inner_text('#meeting-msg'))
    # re-saving the earlier meeting (Aaron's run, 2026-10-16): only IDs the later meeting's request never listed are named
    # with the board's decisions too (two actions were marked not needed before the weekly): a closed item is never named
    for b in pg.evaluate('JSON.parse(JSON.stringify(window.MKG2_state.pkgs.filter(p => p.kind === "board")))'):
        bf = os.path.join(TMP, b['id'] + '.json'); open(bf, 'w', encoding='utf-8').write(json.dumps(b)); pg2.set_input_files('#load-files', bf); pg2.wait_for_timeout(100)
    tab(pg2, 'seed'); pg2.click('#saved-box summary'); pg2.locator(f'[data-again="{pkg1["id"]}"]').click(); pg2.wait_for_timeout(250)
    p1b = save(pg2)
    check('f25c re-saving an earlier meeting with nothing new names no later meeting', p1b['supersedes'] == pkg1['id'] and 'not in the request' not in pg2.inner_text('#save-msg'), pg2.inner_text('#save-msg'))
    tab(pg2, 'seed'); pg2.click('#saved-box summary') if not pg2.is_visible(f'[data-again="{p1b["id"]}"]') else None
    pg2.locator(f'[data-again="{p1b["id"]}"]').click(); pg2.wait_for_timeout(250)
    merged = next(x['n'] for x in st(pg2) if (x.get('r') or {}).get('sameAs'))
    change(pg2, merged, 'sameAs', '')
    pg2.wait_for_timeout(1100)   # a save's ID is to the second: a second save in the same second would share it
    p1c = save(pg2)
    new_ids = sorted(set(x['id'] for x in p1c['items'] if x.get('id')) - set(x['id'] for x in p1b['items'] if x.get('id')))
    sm = pg2.inner_text('#save-msg')
    check('f25d a re-save that adds an ID names it and the later meeting whose request did not list it, and says how to fix it',
          len(new_ids) == 1 and new_ids[0] in sm and 'not in the request of “Harbor Point reopening weekly” (2026-10-26)' in sm and 'through the chat again' in sm, [sm, errors])
    ctx2.close()
    # ---------------- the intervention dashboard (Aaron, 2026-10-16) ----------------
    tab(pg, 'dash'); pg.wait_for_timeout(150)
    d = pg.inner_text('#dash-inner')
    folded = pg.locator('#dash-inner details.iv-more')
    check('f28 the Dashboard asks what to ask, of whom: "Ask in the next meeting" grouped by person, Copy these questions, and the old tables folded below',
          'Ask in the next meeting' in d and 'Copy these questions' in d and pg.locator('#dash-inner .iv-who').count() > 0 and folded.count() == 3 and
          all(folded.nth(i).get_attribute('open') is None for i in range(3)) and 'Project overview' in d and 'Signals' not in d, d[:500])
    n_q = pg.evaluate('() => { const r = window.MKG2_state.iv; return r.followUp.length + r.escalate.length + r.people.length + r.projects.length; }')
    txt = pg.evaluate('() => window.MKG2_interventions.copyText(window.MKG2_state.iv, { asOf: "x", title: "y" })')
    check('f29 the copied text holds every question shown, by section and person', n_q > 0 and txt.count('\n- ') == n_q and 'Ask in the next meeting' in txt, txt[:300])
    pg.locator('#dash-inner .iv-row [data-ent]').first.click(); pg.wait_for_timeout(150)
    check('f30 a question\'s item opens its existing dialog, with its history', pg.is_visible('#hist') and 'History' in pg.inner_text('#hist'))
    pg.click('#close-hist')
    first_asof = pg.evaluate('() => document.querySelector("#asof option").value')
    tab(pg, 'board'); pg.select_option('#asof', first_asof); pg.wait_for_timeout(200); tab(pg, 'dash'); pg.wait_for_timeout(150)
    check('f31 an earlier "State as of" redraws the Dashboard for that meeting and its date', pg.evaluate('() => window.MKG2_state.ivFor.title') == pg.evaluate('() => document.querySelector("#asof option").textContent').split(' ', 2)[-1] and
          pg.evaluate('() => window.MKG2_state.ivFor.title') in pg.inner_text('#dash-inner'), pg.inner_text('#dash-inner')[:200])
    pg.evaluate('() => document.querySelectorAll("#dash-inner details.iv-more").forEach(d => d.open = true)')
    pg.locator('#dash-inner [data-dproj]').first.click(); pg.wait_for_timeout(150)
    check('f32 a project name on the Dashboard opens that project on the Board', pg.get_attribute('[data-tab="board"]', 'aria-selected') == 'true')
    # ---------------- closing and reopening a project (the PM's ask, 2026-10-16) ----------------
    tab(pg, 'board'); pg.select_option('#asof', pg.evaluate('() => [...document.querySelectorAll("#asof option")].pop().value')); pg.wait_for_timeout(200)
    pg.click('#projects [data-project="HP"]'); pg.wait_for_timeout(150)
    n_open = pg.evaluate('() => { const b = window.MKG2_store.replay(window.MKG2_state.pkgs); return [...b.threads.values()].filter(t => t.project === "HP" && t.kind !== "decision" && !["done", "not_needed"].includes(t.status)).length; }')
    check('f33 "Close project" sits next to the project name', pg.locator('#panel .title-row #close-proj').count() == 1)
    pg.click('#close-proj'); pg.wait_for_timeout(150)
    h = pg.inner_text('#hist')
    check('f34 closing asks for a note and says it closes the project and all its open items', 'This closes the project and all its open items' in h and f'{n_open} open item' in h, h[:300])
    pg.click('[data-pact="close_project"]'); pg.wait_for_timeout(100)
    check('f35 without a note, nothing is closed', 'Add a note' in pg.inner_text('#p-msg'))
    pg.fill('#p-note', 'Handed over to operations')
    with pg.expect_download() as d: pg.click('[data-pact="close_project"]')
    cpk = json.load(open(d.value.path(), encoding='utf-8')); pg.wait_for_timeout(200)
    still = pg.evaluate('() => { const b = window.MKG2_store.replay(window.MKG2_state.pkgs); return [...b.threads.values()].filter(t => t.project === "HP" && t.kind !== "decision" && !["done", "not_needed"].includes(t.status)).length; }')
    check('f36 closed: a board decision with the note; its open items are not needed; the project is listed under "Closed projects" with its banner',
          cpk['action'] == 'close_project' and cpk['project'] == 'HP' and cpk['note'] == 'Handed over to operations' and still == 0 and
          pg.locator('#projects details.closedp [data-project="HP"]').count() == 1 and 'This project was closed' in pg.inner_text('#panel') and pg.locator('#close-proj').count() == 0, [still])
    pg.click('[data-preopen="HP"]'); pg.wait_for_timeout(150); pg.fill('#p-note', 'Back in scope')
    with pg.expect_download() as d: pg.click('[data-pact="reopen_project"]')
    pg.wait_for_timeout(200)
    back = pg.evaluate('() => { const b = window.MKG2_store.replay(window.MKG2_state.pkgs); return [...b.threads.values()].filter(t => t.project === "HP" && t.kind !== "decision" && !["done", "not_needed"].includes(t.status)).length; }')
    check('f37 reopening puts its items back and lists the project again', back == n_open and pg.locator('#projects details.closedp').count() == 0 and pg.locator('#close-proj').count() == 1, [back, n_open])
    check('f27 no page errors', not errors, errors)
    br.close()

print(f'\n{sum(results)}/{len(results)} full-page browser checks ' + ('ALL GREEN' if all(results) else 'FAILED'))
sys.exit(0 if all(results) else 1)
