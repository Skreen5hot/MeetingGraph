"""v2 feasibility test (docs/mkg-v2-plan.md §5, §6): checks and scores chat replies for the mock seed meeting and
the mock follow-up meeting (chosen by the reply's context token).
Per reply:
  1. Parse: one JSON object (fenced or bare) with the right context token. Nothing else blocks.
  2. Sources, item by item: the "words" must be in the cited statement (verified), or within 2 statements (near);
     otherwise the item is kept but marked misplaced / not found. One bad item never rejects the reply.
  3. Score against key-items.json: recall (all, high importance, per third of the meeting), traps (stale or
     invented commitments and decisions), and items that match no key (to judge by hand: noise or a missed key).
Replies to request A (the current contract) are converted: NewTasking -> commitment, Decision -> decision,
ProgressNote/Status/Deadline -> update, flags -> question/risk/update; their quotes are checked the same way.
Follow-up replies are also scored on threads: the right open thread, the right status, no false "done", and the
waits-on links (plan §6).
Usage: python3 check_reply.py runs/B1.txt [runs/F1.txt ...]     (a pasted chat reply, or just the JSON)
       python3 check_reply.py --selftest"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
MEETINGS = {'seed': ('meeting-2026-10-19.txt', 'key-items.json', ['request-A-current.txt', 'request-B-paste.txt']),
            'followup': ('meeting-2026-10-26.txt', 'key-followup.json', [None, 'request-F-followup.txt'])}
STATUSES = (None, 'done', 'blocked', 'in_progress')
KINDS = ('commitment', 'decision', 'question', 'risk', 'update')
SEGS_CACHE = {}

norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'[‘’`]', "'", re.sub(r'[“”]', '"', re.sub(r'[–—]', '-', str(s or ''))))).strip().lower()
bare = lambda s: re.sub(r"^[^\w']+|[^\w']+$", '', norm(s))   # the words without leading or trailing punctuation


def parse_segments(meeting):
    segs = {}
    for n, t, spk, text in re.findall(r'^(S\d{3}) \[(\d\d:\d\d:\d\d)\] ([^:]+): (.*)$', meeting, re.M):
        h, m, s = map(int, t.split(':'))
        segs[n] = {'sec': h * 3600 + m * 60 + s, 'speaker': spk.strip(), 'text': text}
    SEGS_CACHE.clear(); SEGS_CACHE.update(segs)
    return segs


def segnum(s): return int(s[1:])
def speaker_of(segs, n): return segs[n]['speaker']
def full_speaker(surname):
    for v in SEGS_CACHE.values():
        if v['speaker'].split(',')[0] == surname: return v['speaker']
    return surname


def load_keys(segs, name='key-items.json'):
    K = json.load(open(os.path.join(HERE, name), encoding='utf-8'))
    for group in ('keys', 'traps'):
        for k in K[group]:
            k['anchor_segs'] = []
            for a in k['anchors']:
                hits = [n for n, v in segs.items() if norm(a) in norm(v['text'])]
                assert len(hits) == 1, f'{k["id"]}: anchor {a!r} is in {len(hits)} statements'
                k['anchor_segs'].append(hits[0])
    return K


def extract_lines(text):
    """The one-entry-per-line reply (requests D and E): a header line, item lines, an end line. None if not that shape.
    Lines after a line that does not parse are lost; the reply is then marked cut, and the items before it are kept."""
    objs, cut = [], None
    for line in text.splitlines():
        line = line.strip()
        if not line.startswith('{'): continue
        try: objs.append(json.loads(line))
        except json.JSONDecodeError: cut = 'a line does not parse'; break
    if not objs or 'context' not in objs[0] or 'items' in objs[0] or 'ops' in objs[0]: return None
    items = [o for o in objs[1:] if 'kind' in o]
    end = next((o for o in objs[1:] if 'end' in o), None)
    reply = dict(objs[0], items=items)
    if cut or end is None: reply['_cut'] = f'the reply stopped after {len(items)} items (no end line)'
    # Amendment ratified by Aaron 2026-10-15 (plan §5.10): the end line shows a cut. Fewer items than it says is a cut;
    # more is a miscount, and the reply is complete.
    elif not isinstance(end.get('end'), int) or len(items) < end['end']: reply['_cut'] = f'the end line says {end.get("end")} items, {len(items)} arrived'
    elif len(items) > end['end']: reply['_note'] = f'the end line says {end["end"]} items, {len(items)} arrived (a miscount; nothing is missing)'
    return reply


def extract(text):
    """The reply's JSON object, or raises ValueError with a plain reason. A reply cut off inside its item list keeps
    the complete items before the cut, marked with '_cut' (v2: one bad part never loses the rest)."""
    lines = extract_lines(text)
    if lines: return lines
    # Copying a chat page drops the code fences and may hold several replies: read the first object only.
    m = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
    body = m.group(1) if m else (text[text.index('{'):] if '{' in text else '')
    if not body: raise ValueError('no JSON object in the reply')
    try: return json.JSONDecoder().raw_decode(body)[0]
    except json.JSONDecodeError as e:
        why = f'the JSON does not parse ({e.msg} at line {e.lineno})'
        k = body.find('"items"')
        cut = body.rfind('},', k) if k >= 0 else -1
        if cut < 0: raise ValueError(why)
        try: reply = json.loads(body[:cut + 1] + ']}')
        except json.JSONDecodeError: raise ValueError(why)
        reply['_cut'] = f'the reply stopped after {len(reply.get("items") or [])} items ({why})'
        return reply


def to_items(reply):
    """Slim replies as they are; current-contract replies (ops and flags) converted to the same shape."""
    if isinstance(reply.get('items'), list):
        return [dict(x, segs=[x.get('seg')]) for x in reply['items'] if isinstance(x, dict)], 'slim'
    out = []
    srcs = lambda o: [(s.get('seg'), s.get('quote')) if isinstance(s, dict) else (s, None) for s in (o.get('src') or [])]
    # A task created and completed in the same reply is the final state "done": keep the completion, not the commitment.
    done = {o.get('tasking') for o in reply.get('ops') or [] if o.get('op') == 'Status' and o.get('status') == 'completed'}
    for o in reply.get('ops') or []:
        if o.get('op') == 'NewTasking' and o.get('ref') in done: continue
        kind = {'NewTasking': 'commitment', 'Decision': 'decision', 'ProgressNote': 'update', 'Status': 'update', 'Deadline': 'update',
                'Reassign': 'commitment', 'DeliverableSpec': 'update', 'PrerequisiteAdd': 'risk'}.get(o.get('op'))
        if not kind or not srcs(o): continue
        s = srcs(o)
        out.append({'kind': kind, 'who': o.get('assignee') or o.get('to'), 'what': o.get('label') or o.get('text') or o.get('note') or o.get('op'),
                    'due': o.get('duePhrase'), 'importance': None, 'seg': s[0][0], 'words': s[0][1], 'segs': [x[0] for x in s], 'quotes': s})
    for f in reply.get('flags') or []:
        kind = {'implied_change': 'update', 'suggestion': 'update', 'conflict': 'risk', 'overdue': None}.get(f.get('kind'), 'question')
        if not kind: continue
        s = srcs(f)
        out.append({'kind': kind, 'who': None, 'what': f.get('note') or '', 'due': None, 'importance': None,
                    'seg': s[0][0] if s else None, 'words': None, 'segs': [x[0] for x in s], 'quotes': []})
    return out, 'current'


def verify(it, segs):
    """verified | near | misplaced | not found | no words (a current-contract flag carries no quote)."""
    quotes = it.get('quotes') if it.get('quotes') is not None else [(it.get('seg'), it.get('words'))]
    if not quotes or all(q is None for _, q in quotes): return 'no words', it.get('seg')
    worst = 'verified'
    order = ['verified', 'near', 'misplaced', 'not found']
    for seg, q in quotes:
        w = bare(q)
        if not w: st = 'not found'
        elif seg in segs and w in norm(segs[seg]['text']): st = 'verified'
        else:
            near = [n for n in segs if seg in segs and abs(segnum(n) - segnum(seg)) <= 2 and w in norm(segs[n]['text'])]
            st = 'near' if near else ('misplaced' if any(w in norm(v['text']) for v in segs.values()) else 'not found')
        worst = max(worst, st, key=order.index)
    return worst, it.get('seg')


def kw_hit(k, it): return any(re.search(p, norm(it.get('what')) + ' ' + norm(it.get('words')), re.I) for p in k['kw'])
def who_hit(surname_re, it): return bool(it.get('who')) and re.search(surname_re, str(it['who']), re.I)


def third(segs, n): return min(2, segs[n]['sec'] // 1200)


def score(text, segs, K, token):
    rep = {'parse': None, 'context': None, 'lastSeg': None, 'shape': None, 'n': 0, 'field_errors': [], 'sources': {},
           'not_found': [], 'found': {}, 'wrong_kind': [], 'missed': [], 'traps': [], 'unmatched': [], 'high_marked': None}
    try: reply = extract(text)
    except ValueError as e: rep['parse'] = str(e); return rep
    rep['parse'] = 'ok'
    rep['cut'] = reply.get('_cut')
    rep['note'] = reply.get('_note')
    rep['context'] = 'ok' if reply.get('context') == token else f'wrong context {reply.get("context")!r}'
    items, rep['shape'] = to_items(reply)
    rep['n'] = len(items)
    last = 'S%03d' % len(segs)
    FU = bool(K.get('followup'))
    BOARD = {t['id'] for t in K.get('board', [])}
    refs = {it.get('ref') for it in items if it.get('ref')}
    if rep['shape'] == 'slim':
        rep['lastSeg'] = 'ok' if reply.get('lastSeg') == last else f'{reply.get("lastSeg")!r}, the meeting ends at {last}'
        for i, it in enumerate(items):
            if it.get('kind') not in KINDS: rep['field_errors'].append(f'item {i + 1}: kind {it.get("kind")!r}')
            if it.get('seg') not in segs: rep['field_errors'].append(f'item {i + 1}: statement {it.get("seg")!r} is not in the meeting')
            if not FU and it.get('thread') not in (None, ''): rep['field_errors'].append(f'item {i + 1}: thread {it.get("thread")!r}, but no threads were sent')
            if FU and it.get('thread') not in BOARD and it.get('thread') is not None: rep['field_errors'].append(f'item {i + 1}: thread {it.get("thread")!r} is not an open thread')
            if FU and it.get('status') not in STATUSES: rep['field_errors'].append(f'item {i + 1}: status {it.get("status")!r}')
            if FU and it.get('status') and not it.get('thread'): rep['field_errors'].append(f'item {i + 1}: a status without a thread')
            if FU and it.get('waitsOn') and it['waitsOn'] not in BOARD and it['waitsOn'] not in refs: rep['field_errors'].append(f'item {i + 1}: waitsOn {it["waitsOn"]!r} names nothing')
            if it.get('importance') not in ('high', 'normal'): rep['field_errors'].append(f'item {i + 1}: importance {it.get("importance")!r}')
        cap = 60 if FU else 40
        if len(items) > cap: rep['field_errors'].append(f'{len(items)} items, more than {cap}')
    for it in items:
        it['_src'], _ = verify(it, segs)
        rep['sources'][it['_src']] = rep['sources'].get(it['_src'], 0) + 1
        if it['_src'] in ('not found', 'misplaced'): rep['not_found'].append(f'{it.get("seg")} {it["_src"]}: {it.get("words")!r}')
    # Recall: first by statement (an anchor itself, or within 2 of one with a matching subject), then by subject anywhere.
    used = set()
    def near(it, k, d): return any(s in segs and a in segs and abs(segnum(s) - segnum(a)) <= d for s in it['segs'] for a in k['anchor_segs'])
    def best(k, pool):
        ranked = sorted(pool, key=lambda i: (items[i]['kind'] not in k['kinds'], not near(items[i], k, 0)))
        return ranked[0] if ranked else None
    for k in K['keys']:
        free = [i for i in range(len(items)) if i not in used]
        i = best(k, [i for i in free if near(items[i], k, 0) and (kw_hit(k, items[i]) or items[i]['kind'] in k['kinds'])])
        if i is None: i = best(k, [i for i in free if near(items[i], k, 2) and kw_hit(k, items[i])])
        if i is None: i = best(k, [i for i in free if kw_hit(k, items[i]) and items[i]['kind'] in k['kinds']
                                   and (not items[i].get('who') or who_hit(k['who'], items[i]))])
        if i is None: rep['missed'].append(k); continue
        used.add(i); rep['found'][k['id']] = i
        if items[i]['kind'] not in k['kinds']: rep['wrong_kind'].append(f'{k["id"]} listed as {items[i]["kind"]}')
    for t in K['traps']:
        for i, it in enumerate(items):
            if it['kind'] not in t['kinds']: continue
            at = any(s in t['anchor_segs'] for s in it['segs'])
            txt = bool(t.get('text')) and re.search(t['text'], norm(it.get('what')), re.I)
            if t.get('link') and it.get('thread') not in t['link']: continue    # a link trap: the right words on the wrong thread
            if (at or txt) and (not t.get('who') or who_hit(t['who'], it) or at):
                rep['traps'].append({'id': t['id'], 'stale': t['stale'], 'link': bool(t.get('link')), 'label': t['label'], 'item': f'{it.get("seg")} {it["kind"]}: {it.get("what")}'})
                break
    rep['unmatched'] = [f'{it.get("seg")} {it["kind"]}: {it.get("what")}' for i, it in enumerate(items) if i not in used]
    if FU: threads_score(rep, items, K)
    if rep['shape'] == 'slim':
        hk = [k for k in K['keys'] if k['importance'] == 'high' and k['id'] in rep['found']]
        rep['high_marked'] = (sum(items[rep['found'][k['id']]].get('importance') == 'high' for k in hk), len(hk))
    rep['items'] = items
    rep['_keys'] = K
    rep['_segs'] = segs
    return rep


def threads_score(rep, items, K):
    """Follow-up only: the thread each found key's item names, its status, false closures and the waits-on links."""
    rep['links'], rep['statuses'], rep['false_closures'], rep['waits'] = [], [], [], []
    for k in K['keys']:
        if k['id'] not in rep['found']: continue
        it = items[rep['found'][k['id']]]
        rep['links'].append((k['id'], it.get('thread') in k['thread'], it.get('thread')))
        if isinstance(k['status'], list): rep['statuses'].append((k['id'], it.get('status') in k['status'], it.get('status')))
    # "done" on a thread that no key allows to be done: the board would show unfinished work as finished.
    done_ok = {th for k in K['keys'] if isinstance(k['status'], list) and 'done' in k['status'] for th in k['thread'] if th}
    what = {t['id']: t['what'] for t in K['board']}
    for it in items:
        if it.get('status') == 'done' and it.get('thread') not in done_ok:
            rep['false_closures'].append(f'{it.get("thread")} marked done ({what.get(it.get("thread"), "?")}) <- {it.get("seg")}: {it.get("what")}')
    for k in K['keys']:
        if not k.get('waitsOn'): continue
        target = rep['found'].get(k['waitsOn'])
        mine = rep['found'].get(k['id'])
        if target is None or mine is None: rep['waits'].append((k['id'], None, 'not scored: an item is missing')); continue
        cands = [items[mine]] + [x for x in items if x.get('thread') and x.get('thread') in k['thread']]
        ok = any(x.get('waitsOn') and x.get('waitsOn') == items[target].get('ref') for x in cands)
        rep['waits'].append((k['id'], ok, f'{k["id"]} waits on {k["waitsOn"]} ({items[target].get("ref")})'))


def criteria(rep):
    """The proposed pass criteria for one run (docs/mkg-v2-plan.md §5.4, §6.4). Returns [(name, ok, detail)]."""
    if rep['parse'] != 'ok': return [('1 one round: the reply parses with the right context', False, rep['parse'])]
    if rep['_keys'].get('followup'): return criteria_followup(rep)
    # Current-contract flags carry no quote by design; they are left out of the source share, and the report counts them.
    K, segs, n = rep['_keys'], rep['_segs'], max(rep['n'] - rep['sources'].get('no words', 0), 1)
    good = rep['sources'].get('verified', 0) + rep['sources'].get('near', 0)
    keys = K['keys']; high = [k for k in keys if k['importance'] == 'high']
    f = lambda ks: sum(k['id'] in rep['found'] for k in ks)
    thirds = [[k for k in keys if third(segs, k['anchor_segs'][0]) == t] for t in range(3)]
    stale = [t for t in rep['traps'] if t['stale']]
    out = [('1 one round: the reply is complete and has the right context', rep['context'] == 'ok' and not rep['cut'],
            rep['cut'] or rep['context']),
           ('2 sources: at least 90% of items verified or near', good / n >= 0.9, f'{good}/{n}'),
           ('3 high-importance recall at least 9 of 11', f(high) >= 9, f'{f(high)}/{len(high)}'),
           ('4 overall recall at least 21 of 29', f(keys) >= 21, f'{f(keys)}/{len(keys)}'),
           ('5 no stale item (a reversed decision, moved date, handed-over owner, or pending thing that came through)', not stale,
            '; '.join(t['id'] for t in stale) or 'none'),
           ('6 every third of the meeting at least 60% recall', all(f(t) / len(t) >= 0.6 for t in thirds),
            ' / '.join(f'{f(t)}/{len(t)}' for t in thirds))]
    if rep['shape'] == 'slim': out.append(('7 the reply names the meeting\'s last statement (it read to the end)', rep['lastSeg'] == 'ok', rep['lastSeg']))
    return out


def criteria_followup(rep):
    K, n = rep['_keys'], max(rep['n'], 1)
    good = rep['sources'].get('verified', 0) + rep['sources'].get('near', 0)
    keys = K['keys']; high = [k for k in keys if k['importance'] == 'high']
    f = lambda ks: sum(k['id'] in rep['found'] for k in ks)
    links_ok = sum(ok for _, ok, _ in rep['links']); st_ok = sum(ok for _, ok, _ in rep['statuses'])
    bad = [t['id'] for t in rep['traps'] if t['stale'] or t.get('link')] + [c.split(' ')[0] for c in rep['false_closures']]
    need = lambda share, total: -(-share * total // 100)    # the ceiling of share% of total
    return [('1 one round: the reply is complete and has the right context', rep['context'] == 'ok' and not rep['cut'], rep['cut'] or rep['context']),
            ('2 sources: at least 90% of items verified or near', good / n >= 0.9, f'{good}/{n}'),
            (f'3 high-importance recall at least {need(80, len(high))} of {len(high)}', f(high) >= need(80, len(high)), f'{f(high)}/{len(high)}'),
            (f'4 overall recall at least {need(70, len(keys))} of {len(keys)}', f(keys) >= need(70, len(keys)), f'{f(keys)}/{len(keys)}'),
            ('5 threads: at least 90% of found items on the right open thread (or new)', links_ok >= need(90, len(rep['links'])), f'{links_ok}/{len(rep["links"])}'),
            ('6 status: at least 80% of found status changes right', st_ok >= need(80, len(rep['statuses'])), f'{st_ok}/{len(rep["statuses"])}'),
            ('7 no false "done", no stale item, no item on a look-alike thread', not bad, '; '.join(bad) or 'none'),
            ('8 the reply names the meeting\'s last statement (it read to the end)', rep['lastSeg'] == 'ok', rep['lastSeg'])]


def report(name, rep):
    print(f'\n=== {name} ===')
    if rep['parse'] != 'ok':
        print('  FAIL 1 one round: ' + rep['parse']); return False
    if rep['cut']: print(f'  CUT OFF: {rep["cut"]}; the complete items are scored below')
    if rep.get('note'): print(f'  NOTE: {rep["note"]}')
    print(f'  {rep["n"]} items ({rep["shape"]} contract); sources: ' + ', '.join(f'{v} {k}' for k, v in rep['sources'].items()))
    for e in rep['field_errors']: print('  field: ' + e)
    for e in rep['not_found']: print('  source: ' + e)
    ok = True
    for c, good, d in criteria(rep):
        ok &= good; print(f'  {"PASS" if good else "FAIL"} {c}: {d}')
    for k in rep['missed']: print(f'  missed {k["id"]} ({k["importance"]}): {k["label"]}')
    for w in rep['wrong_kind']: print('  kind: ' + w)
    for t in rep['traps']: print(f'  trap {t["id"]}{" (stale)" if t["stale"] else ""}: {t["label"]}  <- {t["item"]}')
    if rep['high_marked']: print(f'  importance: {rep["high_marked"][0]} of {rep["high_marked"][1]} found high-importance keys marked high')
    for k, good, got in rep.get('links', []):
        if not good: print(f'  thread: {k} names {got!r}; the key allows {next(x for x in rep["_keys"]["keys"] if x["id"] == k)["thread"]}')
    for k, good, got in rep.get('statuses', []):
        if not good: print(f'  status: {k} says {got!r}; the key allows {next(x for x in rep["_keys"]["keys"] if x["id"] == k)["status"]}')
    for c in rep.get('false_closures', []): print('  false done: ' + c)
    for k, good, d in rep.get('waits', []): print(f'  waits-on (reported, not scored): {"right" if good else "missing" if good is False else "-"}: {d}')
    for u in rep['unmatched']: print('  unmatched (judge: noise, or a key we missed?): ' + u)
    return ok


def setup(meeting='seed'):
    """(segments, key, token of request A, token of the slim request) for the seed or the follow-up meeting."""
    mfile, kfile, reqs = MEETINGS[meeting]
    segs = parse_segments(open(os.path.join(HERE, mfile), encoding='utf-8').read())
    K = load_keys(segs, kfile)
    if K.get('followup'): K['board'] = json.load(open(os.path.join(HERE, 'board-after-seed.json'), encoding='utf-8'))['threads']
    tok = lambda r: r and re.match(r'CONTEXT TOKEN[^:]*: (\S+)', open(os.path.join(HERE, r), encoding='utf-8').read()).group(1)
    return (segs, K) + tuple(tok(r) for r in reqs)


def selftest():
    segs, K, tokA, tokB = setup()
    golden = json.load(open(os.path.join(HERE, 'golden-reply.json'), encoding='utf-8'))
    results = []
    def check(name, cond, detail=''):
        results.append(cond); print(f'  {"OK  " if cond else "FAIL"} {name}' + (f'  [{detail}]' if detail and not cond else ''))
    def run(reply, tok=tokB): return score(reply if isinstance(reply, str) else '```json\n' + json.dumps(reply) + '\n```', segs, K, tok)
    def mod(fn):
        g = json.loads(json.dumps(golden)); fn(g); return g
    print('check_reply selftest')
    r = run(golden)
    check('golden: every criterion passes', all(ok for _, ok, _ in criteria(r)), criteria(r))
    check('golden: 29 of 29 keys found, no wrong kind, no trap, nothing unmatched',
          len(r['found']) == 29 and not r['wrong_kind'] and not r['traps'] and not r['unmatched'], (len(r['found']), r['wrong_kind'], r['traps'], r['unmatched']))
    check('golden: all sources verified', r['sources'] == {'verified': 29}, r['sources'])
    check('golden in prose around a fence still parses', run('Here is the JSON:\n```json\n' + json.dumps(golden) + '\n```\nDone.')['parse'] == 'ok')
    r = run('Part B\nJSON\n Copy\n' + json.dumps(golden) + '\nPart C\n' + json.dumps({'context': 'later', 'items': []}))
    check('a copied chat page (no fences, a later second reply) reads the first reply', r['parse'] == 'ok' and r['n'] == 29, (r['parse'], r['n']))
    r = run(mod(lambda g: g['items'][0].update(words='I will phone the fire marshal')))
    check('paraphrased words: not found, and the item is kept (one bad item never rejects the reply)', r['sources'].get('not found') == 1 and r['n'] == 29, r['sources'])
    r = run(mod(lambda g: g['items'][0].update(seg='S%03d' % (segnum(g['items'][0]['seg']) + 1))))
    check('words in the next statement: near', r['sources'].get('near') == 1, r['sources'])
    r = run(mod(lambda g: g['items'][0].update(seg='S001')))
    check('words far from the cited statement: misplaced', r['sources'].get('misplaced') == 1, r['sources'])
    t2 = next(t for t in K['traps'] if t['id'] == 'T2')['anchor_segs'][0]
    r = run(mod(lambda g: g['items'].append({'kind': 'decision', 'who': 'Okafor, Grace', 'what': 'Use vinyl signage to stay under budget', 'importance': 'high', 'thread': None, 'seg': t2, 'words': 'go with the vinyl'})))
    check('the reversed vinyl decision is a stale trap (T2) and fails criterion 5', [t['id'] for t in r['traps']] == ['T2'] and not criteria(r)[4][1], r['traps'])
    r = run(mod(lambda g: g['items'].append({'kind': 'decision', 'who': 'Mensah, Abena', 'what': 'Open house on Saturday January 9', 'importance': 'high', 'thread': None, 'seg': 'S001', 'words': 'Hi everyone'})))
    check('an open house on January 9 is a stale trap (T3) wherever it is cited', [t['id'] for t in r['traps']] == ['T3'], r['traps'])
    r = run(mod(lambda g: g['items'].append({'kind': 'commitment', 'who': 'Lindqvist, Tom', 'what': 'Tom handles the keycard access list', 'importance': 'normal', 'thread': None, 'seg': 'S001', 'words': 'Hi everyone'})))
    check('Tom owning the keycard list is a stale trap (T4)', [t['id'] for t in r['traps']] == ['T4'], r['traps'])
    t5 = next(t for t in K['traps'] if t['id'] == 'T5')['anchor_segs'][0]
    r = run(mod(lambda g: g['items'].append({'kind': 'commitment', 'who': 'Haddad, Rana', 'what': 'Rana is the volunteer point person', 'importance': 'normal', 'thread': None, 'seg': t5, 'words': 'I guess that falls to me'})))
    check('Rana taking the volunteer role is a trap (T5, not stale) and passes criterion 5', [t['id'] for t in r['traps']] == ['T5'] and criteria(r)[4][1], r['traps'])
    r = run(mod(lambda g: g['items'].append({'kind': 'question', 'who': 'Lindqvist, Tom', 'what': 'Elevator certification still pending', 'importance': 'normal', 'thread': None, 'seg': 'S001', 'words': 'Hi everyone'})))
    check('the elevator as still pending is a stale trap (T6)', [t['id'] for t in r['traps']] == ['T6'], r['traps'])
    r = run(mod(lambda g: g['items'].append({'kind': 'commitment', 'who': 'Lindqvist, Tom', 'what': 'Forward the elevator certification to Grace for the project file', 'importance': 'normal', 'thread': None, 'seg': 'S351', 'words': "I'll forward it to you, Grace"})))
    check('forwarding the elevator certificate after it came through is not a trap (D2)', not r['traps'], r['traps'])
    r = run(mod(lambda g: g['items'].append({'kind': 'commitment', 'who': 'Lindqvist, Tom', 'what': 'Send Pete the existing keycard access names', 'importance': 'normal', 'thread': None, 'seg': 'S413', 'words': "I'll send those over"})))
    check('Tom sending Pete the keycard names is not a trap (D3)', not r['traps'], r['traps'])
    g2 = mod(lambda g: g.update(items=[x for x in g['items'] if x['topic'] != 'K02'] + [
        {'kind': 'question', 'who': 'Okafor, Grace', 'what': 'Decide whether the lobby mural stays', 'importance': 'normal', 'thread': None, 'seg': 'S290', 'words': "It's still open"}]))
    r = run(g2)
    check('a mural question that is "still open" does not count as the opening-target key (D1-D3)',
          r['items'][r['found']['K02']]['seg'] != 'S290' if 'K02' in r['found'] else True, r['found'].get('K02'))
    r = run(mod(lambda g: g['items'].append({'kind': 'risk', 'who': None, 'what': 'Parking lot repaving in spring', 'importance': 'normal', 'thread': None, 'seg': 'S001', 'words': 'Hi everyone'})))
    check('the parking lot (not this project) is a trap (T9)', [t['id'] for t in r['traps']] == ['T9'], r['traps'])
    r = run(mod(lambda g: g.update(items=[x for x in g['items'] if segs[x['seg']]['sec'] < 2400])))
    c = dict((n[:1], ok) for n, ok, _ in criteria(r))
    check('a reply that stops at 40 minutes fails recall by third (criterion 6) and overall recall (4)', not c['6'] and not c['4'], criteria(r))
    r = run(mod(lambda g: g.update(lastSeg='S200')))
    check('a wrong last statement fails criterion 7', not criteria(r)[6][1])
    r = run(json.dumps(golden)[:-400])
    check('a reply cut off in its items keeps the complete items and fails criterion 1',
          r['parse'] == 'ok' and 0 < r['n'] < 29 and (r['cut'] or '').startswith('the reply stopped after') and not criteria(r)[0][1], (r['parse'], r['n'], r['cut']))
    r = run(json.dumps(golden)[:300])
    check('a reply cut off before any item fails criterion 1 with a plain reason', r['parse'].startswith('the JSON does not parse') and not criteria(r)[0][1], r['parse'])
    head = {k: golden[k] for k in ('context', 'lastSeg', 'summary')}
    lines = [json.dumps(head)] + [json.dumps(x) for x in golden['items']]
    r = run('```\n' + '\n'.join(lines + [json.dumps({'end': 29})]) + '\n```')
    check('the one-entry-per-line reply (D, E) reads in full and passes every criterion', r['n'] == 29 and not r['cut'] and all(ok for _, ok, _ in criteria(r)), criteria(r))
    r = run('\n'.join(lines[:20]))
    check('a line reply without its end line keeps the complete lines and fails criterion 1',
          r['n'] == 19 and (r['cut'] or '').startswith('the reply stopped after 19') and not criteria(r)[0][1], (r['n'], r['cut']))
    r = run('\n'.join(lines[:20]) + '\n{"kind": "commitment", "who": "Sa')
    check('a line reply cut mid-line keeps the complete lines before it and fails criterion 1',
          r['n'] == 19 and bool(r['cut']) and not criteria(r)[0][1], (r['n'], r['cut']))
    r = run('\n'.join(lines + [json.dumps({'end': 30})]))
    check('an end line saying more items than arrived is a cut and fails criterion 1', bool(r['cut']) and not criteria(r)[0][1], r['cut'])
    r = run('\n'.join(lines + [json.dumps({'end': 28})]))
    check('an end line saying fewer items than arrived is a miscount: complete, and noted (D2)', not r['cut'] and bool(r['note']) and criteria(r)[0][1], (r['cut'], r['note']))
    r = run(mod(lambda g: g.update(context='MKG2|seed|x')))
    check('a wrong context token fails criterion 1', not criteria(r)[0][1])
    r = run(mod(lambda g: g['items'][0].update(thread='T1')))
    check('a thread on a seed meeting is a field error', any('thread' in e for e in r['field_errors']), r['field_errors'])
    k1 = K['keys'][0]['anchor_segs'][0]; k3 = next(k for k in K['keys'] if k['id'] == 'K03')['anchor_segs'][0]
    k9 = next(k for k in K['keys'] if k['id'] == 'K09')['anchor_segs'][0]; t6 = next(t for t in K['traps'] if t['id'] == 'T6')['anchor_segs'][0]
    curr = {'context': tokA, 'ops': [
        {'op': 'NewTasking', 'ref': 'NEW-1', 'label': 'Call the fire marshal to book the final inspection', 'assignee': 'NEW-P1', 'src': [{'seg': k1, 'quote': "I'll call the fire marshal's office this week"}]},
        {'op': 'Discussed', 'about': 'NEW-J1', 'src': [{'seg': 'S001', 'quote': 'x'}]}],
        'flags': [{'kind': 'open_question', 'about': ['NEW-J1'], 'src': [k3], 'note': 'Will the furniture delivery slip past December 7?'}]}
    curr['ops'] += [{'op': 'NewTasking', 'ref': 'NEW-7', 'label': 'Obtain elevator certification', 'assignee': 'NEW-P1', 'src': [{'seg': t6, 'quote': 'I put in for it last month'}]},
                    {'op': 'Status', 'tasking': 'NEW-7', 'status': 'completed', 'src': [{'seg': k9, 'quote': 'The elevator certification came through'}]}]
    r = run(curr, tokA)
    check('a current-contract reply converts: NewTasking -> commitment (quote verified), flag -> question, Discussed skipped',
          r['shape'] == 'current' and r['n'] == 3 and r['sources'] == {'verified': 2, 'no words': 1} and set(r['found']) == {'K01', 'K03', 'K09'}, (r['n'], r['sources'], r['found']))
    check('a task created and completed in one reply counts as done, not as a stale commitment', not r['traps'], r['traps'])
    selftest_followup(check)
    print(f'{sum(results)}/{len(results)} selftest checks ' + ('ALL GREEN' if all(results) else 'FAILED'))
    return all(results)


def selftest_followup(check):
    """The follow-up meeting (plan §6): threads, status, false closures, look-alikes, waits-on."""
    segs, K, _, tokF = setup('followup')
    golden = json.load(open(os.path.join(HERE, 'golden-followup.json'), encoding='utf-8'))
    byk = lambda g, kid: next(x for x in g['items'] if x['topic'] == kid)
    def run(reply): return score('```json\n' + json.dumps(reply) + '\n```', segs, K, tokF)
    def mod(fn):
        g = json.loads(json.dumps(golden)); fn(g); return g
    c = lambda r: {n[:1]: ok for n, ok, _ in criteria(r)}
    print('follow-up meeting')
    r = run(golden)
    check('follow-up golden: every criterion passes, 37 of 37 keys, both waits-on links right',
          all(c(r).values()) and len(r['found']) == 37 and all(ok for _, ok, _ in r['waits']), (criteria(r), r['waits']))
    head = {k: golden[k] for k in ('context', 'lastSeg', 'summary')}
    lines = '\n'.join([json.dumps(head)] + [json.dumps(x) for x in golden['items']] + [json.dumps({'end': 37})])
    r = score('```\n' + lines + '\n```', segs, K, tokF)
    check('follow-up golden in the one-entry-per-line format reads in full and passes', r['n'] == 37 and all(c(r).values()), criteria(r))
    r = run(mod(lambda g: byk(g, 'F23').update(status='done')))
    check('the half-done website marked done is a false closure (criterion 7)', not c(r)['7'] and any(x.startswith('AI-110') for x in r['false_closures']), r['false_closures'])
    r = run(mod(lambda g: g['items'].append({'ref': 'N99', 'kind': 'update', 'topic': 'x', 'who': 'Haddad, Rana', 'what': 'Pickup map sent', 'due': None, 'importance': 'normal',
                                              'thread': 'AI-113', 'status': 'done', 'waitsOn': None, 'seg': 'S001', 'words': 'Morning, everyone.'})))
    check('a "done" on a thread the meeting did not settle (AI-113) is a false closure', not c(r)['7'] and any(x.startswith('AI-113') for x in r['false_closures']), r['false_closures'])
    r = run(mod(lambda g: byk(g, 'F34').update(thread='AI-110')))
    check('the open house photographer filed on the website-photos thread is a look-alike (U4), and its link is wrong',
          not c(r)['7'] and 'U4' in [t['id'] for t in r['traps']] and ('F34', False, 'AI-110') in r['links'], (r['traps'], r['links']))
    r = run(mod(lambda g: byk(g, 'F32').update(what='The fiber install is now January 6')))
    check('the fiber date of January 6 (replaced by December 21) is a stale item (U2)', 'U2' in [t['id'] for t in r['traps']] and not c(r)['7'], r['traps'])
    r = run(mod(lambda g: byk(g, 'F07').update(what='Book Party Plus for the rental chairs')))
    check('Party Plus as the rental decision is a stale item (U1)', 'U1' in [t['id'] for t in r['traps']] and not c(r)['7'], r['traps'])
    r = run(mod(lambda g: byk(g, 'F25').update(who='Haddad, Rana', what='Rana is the volunteer point person for the open house')))
    check('Rana as the volunteer point person is a stale item (U3)', 'U3' in [t['id'] for t in r['traps']] and not c(r)['7'], r['traps'])
    r = run(mod(lambda g: byk(g, 'F26').update(status=None)))
    check('the keycard list without "blocked" is a wrong status, counted under criterion 6', ('F26', False, None) in r['statuses'], r['statuses'])
    r = run(mod(lambda g: [byk(g, k).update(status=None) for k in ('F01', 'F02', 'F04', 'F06')]))
    check('four of sixteen status changes missing fails criterion 6 (12 of 16 is under 80%)', not c(r)['6'], criteria(r))
    r = run(mod(lambda g: byk(g, 'F12').update(waitsOn=None)))
    check('a missing waits-on link is reported, and does not fail a criterion', ('F12', False) in [(k, ok) for k, ok, _ in r['waits']] and all(c(r).values()), r['waits'])
    r = run(mod(lambda g: [byk(g, k).update(thread=None) for k in ('F01', 'F04', 'F06', 'F09')]))
    check('four items not linked to their open thread fails criterion 5', not c(r)['5'], criteria(r))
    r = run(mod(lambda g: byk(g, 'F01').update(thread='AI-999')))
    check('a thread that is not on the board is a field error', any('AI-999' in e for e in r['field_errors']), r['field_errors'])
    r = run(mod(lambda g: byk(g, 'F34').update(status='done')))
    check('a status on new work (no thread) is a field error', any('status without a thread' in e for e in r['field_errors']), r['field_errors'])


if __name__ == '__main__':
    if '--selftest' in sys.argv: sys.exit(0 if selftest() else 1)
    allok = True
    for p in sys.argv[1:]:
        text = open(p, encoding='utf-8').read()
        segs, K, tokA, tokB = setup('followup' if 'MKG2|followup|' in text else 'seed')
        tok = tokA if '"ops"' in text and '"items"' not in text else tokB
        allok &= report(os.path.basename(p), score(text, segs, K, tok))
    sys.exit(0 if allok else 1)
