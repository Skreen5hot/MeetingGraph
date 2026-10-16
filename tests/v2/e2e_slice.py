"""Browser test of the v2 step-0 slice (dist/MeetingGraph2.html; plan §10.8 step 0), in headless Chromium.
A .docx is built from each mock transcript, with a Teams header line, and the page is driven as the PM would.
Run: python3 tests/v2/e2e_slice.py    (build first: python3 src/v2/build_v2.py)"""
import json, os, re, sys, tempfile, zipfile
from xml.sax.saxutils import escape
from playwright.sync_api import sync_playwright

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
KIT = os.path.join(ROOT, 'tests', 'v2-feasibility')
PAGE = 'file:///' + os.path.join(ROOT, 'dist', 'MeetingGraph2.html').replace('\\', '/')
read = lambda f: open(os.path.join(KIT, f), encoding='utf-8').read()
TMP = tempfile.mkdtemp(prefix='mkg2-e2e-')
results = []


def check(name, cond, detail=''):
    results.append(bool(cond)); print(f'{"PASS" if cond else "FAIL"} {name}' + (f'  [{str(detail)[:300]}]' if detail and not cond else ''))


def docx(path, header, transcript):
    """A minimal Word document: one paragraph per line, as a Teams transcript export reads."""
    W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
    paras = ''.join(f'<w:p><w:r><w:t xml:space="preserve">{escape(l)}</w:t></w:r></w:p>' for l in [header] + transcript.splitlines())
    with zipfile.ZipFile(path, 'w', zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
        z.writestr('word/document.xml', f'<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="{W}"><w:body>{paras}</w:body></w:document>')
    return path


def fixture_board():
    """The board after the seed meeting (board-after-seed.json) as a saved package, as the unit tests build it."""
    B = json.loads(read('board-after-seed.json'))['threads']
    kind = {'action': 'commitment', 'question': 'question', 'risk': 'risk', 'decision': 'decision'}
    label = lambda d: (lambda p: f'{" ".join(p[1:])}, {p[0]}' if len(p) > 1 else d)(d.split(' '))
    return {'mkg2': '1.0', 'kind': 'meeting', 'id': 'mkg2-meeting-HP-fixture', 'savedAt': '2026-10-19T16:00:00Z', 'savedBy': 'fixture', 'supersedes': None,
            'project': {'code': 'HP', 'name': 'Harbor Point reopening'},
            'meeting': {'id': '20261019T140000Z', 'date': '2026-10-19', 'time': '10:00', 'offset': '-04:00', 'title': 'Harbor Point reopening kickoff', 'dayKey': '261019'},
            'statements': [], 'request': {'token': 'fixture', 'kind': 'seed', 'openIds': []}, 'reply': {}, 'minted': {'maxNum': {'A': 15, 'Q': 3, 'R': 3, 'D': 5}},
            'items': [{'n': i + 1, 'kind': kind[t['kind']], 'who': label(t['owner']) if t['owner'] else None, 'what': t['what'], 'due': t['due'],
                       'id': t['id'], 'seg': 'S001', 'thread': None, 'status': None, 'toCheck': False} for i, t in enumerate(B)]}


SEED_DOCX = docx(os.path.join(TMP, 'seed.docx'), 'Harbor Point reopening kickoff-20261019_100000-Meeting Transcript', read('mock-seed-meeting-2026-10-19.txt'))
FU_DOCX = docx(os.path.join(TMP, 'followup.docx'), 'Harbor Point reopening weekly-20261026_100000-Meeting Transcript', read('mock-followup-meeting-2026-10-26.txt'))
FIX = os.path.join(TMP, 'mkg2-meeting-HP-fixture.json'); open(FIX, 'w', encoding='utf-8').write(json.dumps(fixture_board()))


def page_in(browser):
    ctx = browser.new_context(timezone_id='America/New_York', accept_downloads=True)
    pg = ctx.new_page(); errors = []
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    pg.goto(PAGE); pg.wait_for_timeout(300)
    pg.click('[data-tab="prepare"]')   # v1's screens: the meeting is processed in its own tab
    return ctx, pg, errors


def tab(pg, name):
    """v1's screens: Board, Dashboard, Process meeting (prepare) and Workspace (seed) are tabs."""
    pg.click(f'[data-tab="{name}"]'); pg.wait_for_timeout(100)


def paste_reply(pg, text):
    pg.fill('#reply', text); pg.click('#check-btn'); pg.wait_for_timeout(200)


def token(pg):
    return re.match(r'CONTEXT TOKEN[^:]*: (\S+)', pg.input_value('#request')).group(1)


def retoken(pg, text):
    # Aaron's recorded replies answer the tested D and F requests. The page now sends them with the §10.20 project edits,
    # so its token differs: give the recorded reply the page's token (its content is unchanged; its items name no project).
    old = re.search(r'"context"\s*:\s*"([^"]+)"', text).group(1)
    return text.replace(old, token(pg))


def bag(t):
    from collections import Counter
    return Counter(l for l in t.split('\n') if l.strip() and not l.startswith('CONTEXT TOKEN'))


def bulk(pg, value):
    pg.select_option('#bulk-proj', value); pg.click('#bulk-btn'); pg.wait_for_timeout(150)


def save(pg, name='Test PM'):
    pg.fill('#saved-by', name)
    with pg.expect_download() as d: pg.click('#save-btn')
    path = os.path.join(TMP, d.value.suggested_filename); d.value.save_as(path)
    return json.load(open(path, encoding='utf-8')), d.value.suggested_filename


with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---------------- the seed meeting, from a .docx ----------------
    ctx, pg, errors = page_in(br)
    tab(pg, 'prepare'); pg.set_input_files('#docx', SEED_DOCX); pg.wait_for_timeout(400)
    check('e1 the .docx opens, and the title, date, start and offset come from its header',
          pg.input_value('#m-title') == 'Harbor Point reopening kickoff' and pg.input_value('#m-date') == '2026-10-19' and pg.input_value('#m-time') == '10:00' and pg.input_value('#m-offset') == '-04:00',
          [pg.input_value(x) for x in ('#m-title', '#m-date', '#m-time', '#m-offset')])
    check('e2 nothing asks for a project at meeting-in (§10.20)', all(pg.locator(x).count() == 0 for x in ('#project', '#p-name', '#test-p', '#also')))
    pg.click('#number-btn'); pg.wait_for_timeout(400)
    rq = pg.input_value('#request')
    add, gone = bag(rq) - bag(read('request-D-lines.txt')), bag(read('request-D-lines.txt')) - bag(rq)
    check('e3 the request for a first meeting is request D with the project edits only (8 lines in, 2 rewritten), and says the board has no projects',
          sum(add.values()) == 8 and sum(gone.values()) == 2 and '=== PROJECTS ===\nnone yet: the board has no projects\n\n=== MEETING ===' in rq, [sum(add.values()), sum(gone.values())])
    check('e4 the page says how many statements, that it is a first meeting, and that the chat will propose the projects',
          '471 statements' in pg.inner_text('#request-line') and 'First meeting' in pg.inner_text('#request-line') and 'propose them' in pg.inner_text('#request-line'), pg.inner_text('#request-line'))
    paste_reply(pg, 'not a reply at all')
    check('e5 an unreadable reply stops with a plain message, and nothing can be saved', 'reply' in pg.inner_text('#reply-msg').lower() and not pg.is_visible('#s-save'), pg.inner_text('#reply-msg'))
    paste_reply(pg, read('runs/F2.txt'))
    check('e6 a reply to another request stops with a plain message', 'different request' in pg.inner_text('#reply-msg'), pg.inner_text('#reply-msg'))
    paste_reply(pg, retoken(pg, read('runs/D1.txt')))
    check('e7 D1 reads: 36 items, nothing to check', pg.inner_text('#reply-msg').startswith('36 items read.') and 'to check' not in pg.inner_text('#reply-msg'), pg.inner_text('#reply-msg'))
    check('e8 the review lists new actions, decisions, questions and risks', all(h in pg.inner_text('#results') for h in ('New actions', 'Decisions', 'Open questions', 'Risks')))
    pg.fill('#add-seg', 'S999'); pg.wait_for_timeout(100)
    check('e8a the add form shows when a statement number is not in the meeting', 'No statement' in pg.inner_text('#add-preview'))
    pg.fill('#add-seg', '100'); pg.wait_for_timeout(100)
    check('e8b typing a statement number shows that statement', pg.inner_text('#add-preview').startswith('S100 '), pg.inner_text('#add-preview'))
    pg.select_option('#add-kind', 'commitment'); pg.fill('#add-what', 'ZZ remove me'); pg.click('#add-btn'); pg.wait_for_timeout(150)
    pg.click('button[data-remove]'); pg.wait_for_timeout(150)
    check('e8c an added item can be removed before saving', 'ZZ remove me' not in pg.inner_text('#results') and pg.inner_text('#reply-msg').startswith('36 items read.'))
    pg.fill('#add-seg', 'S100'); pg.select_option('#add-kind', 'decision'); pg.fill('#add-what', 'ZZ added decision'); pg.click('#add-btn'); pg.wait_for_timeout(150)
    check('e8d an added item shows as added by you, and the count says so', 'added by you' in pg.inner_text('#results') and '1 added by you' in pg.inner_text('#reply-msg'))
    pg.fill('#saved-by', 'Test PM'); pg.click('#save-btn'); pg.wait_for_timeout(150)
    check('e8f J2: with items that have no project, Save says how many need one and saves nothing', 'need a project before saving' in pg.inner_text('#save-msg') and not pg.is_visible('#s-email'), pg.inner_text('#save-msg'))
    check('e8g the review says how many new items have no project yet', 'with no project yet' in pg.inner_text('#notclear-line'), pg.inner_text('#notclear-line'))
    check('e8g2 the check result says what must be fixed before saving, in red, with the details open (UX B2)', 'to fix before saving' in pg.inner_text('#reply-msg') and
          'bad' in (pg.get_attribute('#reply-msg', 'class') or '') and pg.get_attribute('#reply-details', 'open') is not None and 'Must be fixed before saving' in pg.inner_text('#reply-details') and
          "Project list" in pg.inner_text('#reply-details'), pg.inner_text('#reply-msg'))
    pg.click('#np-box summary'); pg.fill('#np-name', 'Harbor Point reopening'); pg.wait_for_timeout(100)
    check('e8h a project added by the PM gets a default code from its name', pg.input_value('#np-code') == 'HPR')
    pg.click('#np-adv summary'); pg.fill('#np-code', 'HP'); pg.click('#np-add'); pg.wait_for_timeout(150)
    bulk(pg, 'J:PM1')
    check('e8i2 once every item has a project, the result says so and the details close (UX B2)', 'Every new item has a project.' in pg.inner_text('#reply-msg') and
          'to fix' not in pg.inner_text('#reply-msg') and pg.get_attribute('#reply-details', 'open') is None, pg.inner_text('#reply-msg'))
    check('e8i every "not clear" item is put in it at once', 'Every new item has a project.' in pg.inner_text('#notclear-line') and not pg.is_visible('#bulk-box'), pg.inner_text('#notclear-line'))
    pkg, fname = save(pg)
    added = [i for i in pkg['items'] if i.get('added')]
    check('e8e the saved package holds the added item, with an ID, and the email has it', len(added) == 1 and re.match(r'^HP-D-261019-\d\d$', added[0]['id'] or '') and 'ZZ added decision' in pg.input_value('#email'), added)
    ids = [i['id'] for i in pkg['items'] if i.get('id')]
    check('e9 Save downloads one mkg2- package with B12 IDs', fname.startswith('mkg2-meeting-HP-20261019T140000Z-') and pkg['mkg2'] == '1.0' and ids and all(re.match(r'^HP-[AQRD]-261019-\d\d$', i) for i in ids), [fname, ids[:3]])
    check('e10 the package holds the numbered statements and the request token', len(pkg['statements']) == 471 and pkg['request']['token'].startswith('MKG2|seed|20261019T140000Z|'))
    check('e10b the package covers the project the PM added, and records that decision', [x['code'] for x in pkg['projects']] == ['HP'] and pkg['newProjects'][0]['byPM'] and pkg['newProjects'][0]['code'] == 'HP', [pkg['projects'], pkg['newProjects']])
    em = pg.input_value('#email')
    heads = ['1. Meeting Overview', '2. Executive Summary', '3. New actions from this meeting', '4. Existing items updated', '5. Existing open items not discussed', '6. Risks, dependencies and open questions', '7. Conclusion']
    check('e11 the meeting email has the PM\'s seven sections in order, with the minted IDs', all(em.find(h) >= 0 for h in heads) and [em.find(h) for h in heads] == sorted(em.find(h) for h in heads) and ids[0] in em)
    pg.select_option('#verdict', 'yes')
    sm = pg.input_value('#summary')
    names = {w for l in read('meeting-2026-10-19.txt').splitlines() if re.match(r'^S\d{3} ', l) for w in re.split(r'[ ,]+', l.split('] ', 1)[1].split(':')[0]) if w}
    leaked = [w for w in names | {'Harbor', 'reopening', 'kickoff'} if re.search(r'\b' + w + r'\b', sm)]
    check('e12 the summary is counts only (no names, no title) and records the verdict', not leaked and 'Would the PM send the email: yes' in sm and 'Statements: 471' in sm, leaked or sm)

    # ---------------- B14a: the next meeting carries the open threads of the saved one ----------------
    tab(pg, 'prepare'); pg.set_input_files('#docx', FU_DOCX); pg.wait_for_timeout(400)
    pg.click('#number-btn'); pg.wait_for_timeout(400)
    check('e13 the next meeting\'s request lists the saved project by code and name', '=== PROJECTS ===\nCODE | name\nHP | Harbor Point reopening\n' in pg.input_value('#request'))
    opened = sum(1 for i in pkg['items'] if i.get('id'))
    check('e14 the follow-up request lists the saved meeting\'s open items (B14a)', f'Follow-up: {opened} open items' in pg.inner_text('#request-line') and '=== OPEN THREADS ===' in pg.input_value('#request'), pg.inner_text('#request-line'))
    pg.reload(); pg.wait_for_timeout(500)
    check('e15 after a reload, the saved meeting is still there (the browser\'s copy)', '1 meeting saved' in pg.inner_text('#saved-line'), pg.inner_text('#saved-line'))
    check('e16 no page errors (seed)', not errors, errors)
    ctx.close()

    # ---------------- starting a board from the example CSV (§10.14), then a two-project meeting ----------------
    ctx, pg, errors = page_in(br)
    tab(pg, 'seed'); pg.set_input_files('#seed-file', os.path.join(ROOT, 'templates', 'mkg2-seed-example.csv')); pg.wait_for_timeout(300)
    check('e23 the example CSV reads: its counts, and every row reads', '1 project, 7 people, 9 actions, 2 questions, 2 risks, 2 decisions. Every row reads.' in pg.inner_text('#seed-line'), pg.inner_text('#seed-line'))
    check('e24 the project gets a default code from its name, which can be changed', pg.input_value('[data-seed-code="0"]') == 'HPR')
    pg.fill('[data-seed-code="0"]', 'HP'); pg.fill('#seed-asof', '2026-10-15')
    with pg.expect_download() as d: pg.click('#seed-save')
    sp = json.load(open(d.value.path(), encoding='utf-8'))
    check('e25 Save downloads one seed package with B18 IDs, and the people (with emails) are in it', sp['kind'] == 'seed' and d.value.suggested_filename.startswith('mkg2-seed-HP-20261015-')
          and all(re.match(r'^HP-[AQRD]-261015-\d\d$', i['id']) for i in sp['items']) and len(sp['people']) == 7)
    check('e26 the board is listed as started from a spreadsheet', '1 board started from a spreadsheet' in pg.inner_text('#saved-line'), pg.inner_text('#saved-line'))
    two = os.path.join(TMP, 'two.csv')
    open(two, 'w', encoding='utf-8').write('Type,Project,Title,Owner,Email,Teams name,Due,Status,Waiting on,Notes\nProject,Library build,,,,,,,,\nAction,Library build,Order the shelving,,,,,Open,,\n')
    tab(pg, 'seed'); pg.set_input_files('#seed-file', two); pg.wait_for_timeout(300)
    with pg.expect_download() as d: pg.click('#seed-save')
    tab(pg, 'prepare'); pg.set_input_files('#docx', FU_DOCX); pg.wait_for_timeout(400)
    check('e27 nothing asks which projects the meeting covered', pg.locator('#project').count() == 0 and pg.locator('#also').count() == 0)
    pg.click('#number-btn'); pg.wait_for_timeout(400)
    req = pg.input_value('#request')
    check('e28 the request lists both projects, the open items of both with their project, and no email',
          'Follow-up: 15 open items from 2 projects' in pg.inner_text('#request-line') and 'HP | Harbor Point reopening\nLB | Library build' in req and
          'HP-A-261015-01 | HP | action' in req and re.search(r'\nLB-A-\d{6}-01 \| LB \| action', req) and '@example.org' not in req, pg.inner_text('#request-line'))
    W = "I'll send you the final room list by Wednesday"
    it = lambda ref, proj, what: json.dumps({'ref': ref, 'kind': 'commitment', 'topic': 't', 'project': proj, 'who': 'Lindqvist, Tom', 'what': what, 'due': None, 'importance': 'normal', 'thread': None, 'status': None, 'waitsOn': None, 'seg': 'S146', 'words': W})
    fake = '\n'.join([json.dumps({'context': token(pg), 'lastSeg': 'S381', 'summary': 's'}),
                      json.dumps({'newProject': 'J1', 'name': 'Garden plaza', 'seg': 'S146', 'words': W}),
                      it('N1', 'LB', 'ZZ shelving'), it('N2', 'HP', 'ZZ second'), it('N3', 'J1', 'ZZ plaza'), it('N4', None, 'ZZ unclear'), it('N5', 'ZZ', 'ZZ unknown'),
                      json.dumps({'end': 5})])
    paste_reply(pg, fake)
    picks = [pg.locator('select[data-proj]').nth(i).input_value() for i in range(pg.locator('select[data-proj]').count())]
    check('e29 the chat\'s proposal is shown with its quote, to be added under a default code', 'Garden plaza' in pg.input_value('[data-prop-name="0"]') and pg.input_value('[data-prop-action="0"]') == 'add'
          and pg.input_value('[data-prop-code="0"]') == 'GP' and 'S146' in pg.inner_text('#proposals'))
    check('e29b each new item is placed as the chat said: a listed code, the new project, or not clear (an unknown code, with a note)',
          picks == ['LB', 'HP', 'J:J1', '', ''] and 'neither listed nor proposed' in pg.inner_text('#results'), picks)
    pg.locator('select[data-proj]').nth(1).select_option('LB'); pg.wait_for_timeout(100)
    pg.fill('#saved-by', 'Test PM'); pg.click('#save-btn'); pg.wait_for_timeout(150)
    check('e29c J2: the two "not clear" actions stop the save, named by statement', '2 items need a project' in pg.inner_text('#save-msg'), pg.inner_text('#save-msg'))
    pg.locator('select[data-proj]').nth(3).select_option('HP'); pg.wait_for_timeout(100)
    bulk(pg, 'LB')
    pkg3, _ = save(pg)
    it3 = {i['what']: i for i in pkg3['items']}
    check('e30 each item is minted under its own project, the new project included', it3['ZZ shelving']['id'].startswith('LB-A-261026-') and it3['ZZ second']['id'].startswith('LB-A-261026-')
          and it3['ZZ plaza']['id'] == 'GP-A-261026-01' and it3['ZZ unclear']['id'].startswith('HP-A-261026-') and it3['ZZ unknown']['id'].startswith('LB-A-261026-'), {k: v.get('id') for k, v in it3.items()})
    check('e30a the package covers the three projects, and the email says so', [x['code'] for x in pkg3['projects']] == ['LB', 'GP', 'HP']
          and 'Projects covered: Library build, Garden plaza, Harbor Point reopening' in pg.input_value('#email'), pkg3['projects'])
    pg.select_option('#verdict', 'yes'); sm3 = pg.input_value('#summary')
    check('e30b the summary counts the proposal and the placements, without naming them', 'Projects covered: 3; new projects the chat proposed: 1, added: 1' in sm3
          and 'New items: the chat placed 3, not clear 2; the PM moved 1, placed 2' in sm3 and 'Garden' not in sm3, sm3[-400:])
    check('e30c the new project is on the board now', 'Garden plaza (GP)' in pg.inner_text('#saved-line'), pg.inner_text('#saved-line'))
    check('e31 no page errors (seed and two projects)', not errors, errors)
    ctx.close()

    # ---------------- the follow-up, on the board after the seed meeting ----------------
    ctx, pg, errors = page_in(br)
    V1 = os.path.join(TMP, 'mkg-workspace-test.json'); open(V1, 'w', encoding='utf-8').write(json.dumps({'mkgWorkspace': '0.1', 'packages': []}))
    pg.set_input_files('#load-files', V1); pg.wait_for_timeout(300)
    check('e17a a MeetingGraph 1 workspace is recognised and explained, and nothing is loaded', 'MeetingGraph 1 file' in pg.inner_text('#meeting-msg') and 'No meetings loaded' in pg.inner_text('#saved-line'), pg.inner_text('#meeting-msg'))
    pg.set_input_files('#load-files', FIX); pg.wait_for_timeout(300)
    check('e17 a saved file loads from the team folder', '1 meeting saved' in pg.inner_text('#saved-line'), pg.inner_text('#saved-line'))
    tab(pg, 'prepare'); pg.set_input_files('#docx', FU_DOCX); pg.wait_for_timeout(400)
    pg.click('#number-btn'); pg.wait_for_timeout(400)
    rq = pg.input_value('#request')
    check('e18 the follow-up request, from the loaded board, lists the project and each open item with its project, then the meeting as tested',
          '=== PROJECTS ===\nCODE | name\nHP | Harbor Point reopening\n\n=== OPEN THREADS ===\nID | project |' in rq and 'AI-101 | HP | action' in rq and rq.endswith(read('meeting-2026-10-26.txt')), pg.inner_text('#request-line'))
    paste_reply(pg, retoken(pg, read('runs/F2.txt')))
    res = pg.inner_text('#results')
    check('e19 F2 reads, and its closures are listed first, applied', pg.inner_text('#reply-msg').startswith('43 items read.') and res.startswith('Closures from the chat (applied)'), res[:200])
    bulk(pg, 'HP')
    # the optional Teams attendance report (UX B1): a mock report, UTF-16 as Teams downloads it
    rep = '\r\n'.join(['1. Summary', 'Meeting title\tHarbor Point weekly', 'Start time\t10/26/26, 10:00:03 AM', 'Meeting duration\t59m', '', '2. Participants',
                        'Name\tFirst Join\tLast Leave\tIn-Meeting Duration\tEmail\tRole', 'Okafor, Grace\t10/26/26, 10:00:03 AM\t10/26/26, 10:59:50 AM\t59m\tgo@example.org\tOrganizer',
                        'Zed Visitor\t10/26/26, 10:10:00 AM\t10/26/26, 10:20:00 AM\t10m\tzv@example.org\tAttendee'])
    ap = os.path.join(TMP, 'attendance.csv'); open(ap, 'wb').write(b'\xff\xfe' + rep.encode('utf-16-le'))
    pg.click('#att-box summary'); pg.set_input_files('#att-file', ap); pg.wait_for_timeout(300)
    am = pg.inner_text('#att-msg')
    check('e19b the attendance report reads here: the count, who matched the people register, and who did not, without blocking (UX B1)',
          '2 participants' in am and 'Zed Visitor' in am and 'not in it yet' in am and pg.is_visible('#s-save'), am)
    pkg2, _ = save(pg)
    check('e19c the saved meeting keeps the attendance, without email addresses, and the email lists the attendees',
          len((pkg2.get('attendance') or {}).get('participants', [])) == 2 and 'example.org' not in json.dumps(pkg2.get('attendance')) and
          'Attendees (2): Grace Okafor, Zed Visitor' in pg.input_value('#email'), pkg2.get('attendance'))
    st = {i['thread']: i['status'] for i in pkg2['items'] if i.get('thread') and i.get('applied')}
    check('e20 the saved package applies F2\'s statuses to the right threads', st.get('AI-101') == 'done' and st.get('AI-103') == 'blocked' and st.get('AI-110') == 'in_progress', st)
    em2 = pg.input_value('#email')
    s4 = em2.split('4. Existing items updated')[1].split('5. Existing open items')[0]
    s5 = em2.split('5. Existing open items not discussed')[1].split('6. Risks')[0]
    check('e21 the follow-up email fills sections 4 (with statuses) and 5 (open items not mentioned)', 'Status: Done.' in s4 and 'AI-101' in s4 and 'did not mention them' in s5, s5[:200])
    tab(pg, 'seed'); pg.click('#saved-box summary'); pg.locator(f'[data-again="{pkg2["id"]}"]').click(); pg.wait_for_timeout(250)
    check('e19d reviewing the meeting again brings its attendance back', '2 participants' in pg.inner_text('#att-msg'), pg.inner_text('#att-msg'))
    # Reset page: clears the meeting being processed; the saved meetings stay
    tab(pg, 'prepare'); pg.once('dialog', lambda dg: dg.accept()); pg.click('#reset-page'); pg.wait_for_timeout(200)
    check('e24 "Reset page" clears the transcript, the request and the review, and keeps the saved meetings', pg.input_value('#transcript') == '' and
          not pg.is_visible('#s-request') and not pg.is_visible('#s-reply') and pg.inner_text('#results') == '' and 'reset' in pg.inner_text('#meeting-msg') and
          pg.evaluate('() => window.MKG2_state.pkgs.length') > 0)
    check('e22 no page errors (follow-up)', not errors, errors)
    ctx.close()
    br.close()

print(f'\n{sum(results)}/{len(results)} slice browser checks ' + ('ALL GREEN' if all(results) else 'FAILED'))
sys.exit(0 if all(results) else 1)
