"""§16.16 feasibility test: checks the "answers" in a chat reply to request-open-items.txt.
1. Validator rules (§16.16.4): the item ID is exact; the quote is in the cited segment of THIS meeting; the change fits
   the question (owner -> Reassign on the task citing the answer's segment; who-is -> NewParty with a full name citing
   it, or a match to PEOPLE). Failing answers are dropped. Passing answers are only PROPOSED closures (a reviewer ticks).
2. Scoring against the expected outcome for each item (scoring-sheet.md), per pass criteria 1-4 and 7.
Usage: python3 check_answers.py reply.txt [reply2.txt ...]      (a pasted chat reply, or just the JSON)
       python3 check_answers.py --selftest                      (seeded bad answers must be dropped: criterion 6)
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
# --v2: the revised request (one question per item; no duplicate flags; match only for who-is), testers' review package.
V2 = '--v2' in sys.argv
if V2: sys.argv.remove('--v2')
# --build: the request the built workbench writes (its questions come from the board's labels, not hand-written).
BUILD = '--build' in sys.argv
if BUILD: sys.argv.remove('--build'); V2 = True
REQ = open(os.path.join(HERE, 'request-open-items-build.txt' if BUILD else 'request-open-items-v2.txt' if V2 else 'request-open-items.txt'), encoding='utf-8').read()
ITEMS = {x['id']: x for x in json.load(open(os.path.join(HERE, 'open-items-build.json' if BUILD else 'open-items-v2.json' if V2 else 'open-items.json'), encoding='utf-8'))}
SEGS = dict(re.findall(r'^(S\d{3}) \[[^\]]*\] [^:]+: (.*)$', REQ.split('=== MEETING ===')[1], re.M))
PEOPLE = {m[0].strip(): m[1].strip() for m in re.findall(r'^([a-z][a-z0-9-]*) \| ([^|]+) \|', REQ.split('PEOPLE (ID | name | aliases)')[1].split('\n\n')[0], re.M)}
norm = lambda s: re.sub(r'\s+', ' ', re.sub(r'[‘’]', "'", re.sub(r'[“”]', '"', str(s or '')))).strip().lower()

def extract_json(text):
    m = re.search(r'```(?:json)?\s*(\{[\s\S]*?\})\s*```', text)
    body = m.group(1) if m else text[text.index('{'):text.rindex('}') + 1]
    return json.loads(body)

def srcsegs(op): return {(x.get('seg') if isinstance(x, dict) else x) for x in op.get('src', [])}

def validate(reply):
    """Returns (kept, dropped): proposed closures that pass the rules, and dropped answers with reasons."""
    ops = reply.get('ops', []) or []
    kept, dropped = [], []
    for a in reply.get('answers', []) or []:
        why = None; it = ITEMS.get(a.get('item'))
        if not it: why = 'the item ID is not one of the IDs sent (no fuzzy matching)'
        elif a.get('seg') not in SEGS: why = f'segment {a.get("seg")} is not in this meeting'
        elif not a.get('quote') or norm(a['quote']) not in norm(SEGS[a['seg']]): why = f'the quote is not in {a.get("seg")}'
        elif a.get('status') not in ('answered', 'partial'): why = 'status must be answered or partial'
        elif a['status'] == 'answered' and it['kind'] == 'owner':
            if not any(o.get('op') == 'Reassign' and o.get('tasking') == it['target'] and a['seg'] in srcsegs(o) for o in ops):
                why = f'an owner answer needs a Reassign on {it["target"]} citing {a["seg"]}'
        elif a['status'] == 'answered' and it['kind'] == 'who':
            full = [o for o in ops if o.get('op') == 'NewParty' and a['seg'] in srcsegs(o)
                    and len([t for t in re.split(r'\s+', o.get('name', '')) if len(re.sub(r'[^A-Za-z]', '', t)) >= 2]) >= 2]
            if not full and a.get('match') not in PEOPLE: why = 'a who-is answer needs a NewParty with a full name citing the answer, or a match to someone in PEOPLE'
        (dropped if why else kept).append({**a, **({'why': why} if why else {})})
    return kept, dropped

# The expected outcome for each item in the mock Oct 8 meeting (scoring-sheet.md).
CLEAR = {'20261001T140000Z|S039|ownership|AI-403': ('alvarez', {'S004', 'S005'}),
         '20261001T140000Z|S013|ambiguous_reference|P2': ('Morgan Reyes', {'S002', 'S003'}),
         '20261001T140000Z|S050|open_question|P2': (None, {'S009', 'S010'}),
         '20261001T140000Z|S007|open_question|AI-206': (None, {'S006', 'S007', 'S008'})}
AMBIG = {'20261001T140000Z|S014|open_question|AI-203', '20261001T140000Z|S014|open_question|AI-207',
         '20261001T140000Z|S014|implied_change|AI-203', '20261001T140000Z|S014|implied_change|AI-207'}
# In the build's request the invitations and mounting questions are the chat's multi-part notes; the meeting answers one
# part of each, so "partial" is the right answer and "answered" is an over-claim (the reviewer's tick still guards it).
MULTI = {'20261001T140000Z|S050|open_question|P2', '20261001T140000Z|S007|open_question|AI-206'}
if BUILD: CLEAR = {k: v for k, v in CLEAR.items() if k not in MULTI}
NONE = {'20261001T140000Z|S048|ambiguous_reference|P2', '20261001T140000Z|S004|open_question|P2', '20261001T140000Z|S038|open_question|P2'}

def score(reply):
    raw = reply.get('answers', []) or []; ops = reply.get('ops', []) or []
    kept, dropped = validate(reply)
    byk = {a['item']: a for a in kept}
    rep = {'clear_hits': [], 'clear_misses': [], 'false_links': [], 'ambiguous_bad': [], 'distractor': [], 'bad_ids': [], 'dropped': dropped, 'dup_flags': [], 'match_misuse': [], 'overclaim': []}
    # Criterion 8 (v2 rule 6): no new flag for a question answered here, fully or partially (the dates: S012/S013 on AI-203/AI-207).
    for f in reply.get('flags', []) or []:
        ab = set(f.get('about') or []) if isinstance(f.get('about'), list) else {f.get('about')}
        sg = {x.get('seg') if isinstance(x, dict) else x for x in (f.get('src') or [])}
        if f.get('kind') in ('implied_change', 'open_question', 'conflict') and ab & {'AI-203', 'AI-207'} and sg & {'S011', 'S012', 'S013'}:
            rep['dup_flags'].append(f"{f.get('kind')} {sorted(ab)} {sorted(sg)}")
    # Criterion 9 (v2 rule 1): "match" only on who-is items.
    for a in raw:
        if a.get('match') and ITEMS.get(a.get('item'), {}).get('kind') != 'who': rep['match_misuse'].append(a.get('item'))
    for k, (want, segs) in CLEAR.items():
        a = byk.get(k)
        # The invitations item accepts "partial" (scoring-sheet.md): only receipt was stated, not that updates were sent.
        ok = a and (a['status'] == 'answered' or (not V2 and a['status'] == 'partial' and k.endswith('S050|open_question|P2'))) and a['seg'] in segs
        if ok and k.endswith('AI-403'): ok = any(o.get('op') == 'Reassign' and o.get('tasking') == 'AI-403' and o.get('to') == want for o in ops)
        if ok and 'ambiguous_reference' in k: ok = any(o.get('op') == 'NewParty' and want.lower() in o.get('name', '').lower() for o in ops)
        rep['clear_hits' if ok else 'clear_misses'].append(k)
    if BUILD: rep['overclaim'] = [a['item'] for a in raw if a.get('item') in MULTI and a.get('status') == 'answered']
    for a in raw:   # criterion 2 is judged on what the chat proposed, before the validator
        if a.get('item') in NONE: rep['false_links'].append(f"{a['item']} ({a.get('status')}: {a.get('answer')})")
        if a.get('item') in AMBIG and a.get('status') == 'answered': rep['ambiguous_bad'].append(f"{a['item']} marked answered: {a.get('answer')}")
        if a.get('item', '').endswith('AI-403') and a.get('seg') in {'S014', 'S015', 'S016'}: rep['distractor'].append(f"AI-403 linked to the loading dock ({a.get('seg')})")
        if a.get('item') not in ITEMS: rep['bad_ids'].append(str(a.get('item')))
    if any(o.get('op') == 'Deadline' and o.get('tasking') in ('AI-203', 'AI-207') for o in ops): rep['ambiguous_bad'].append('a Deadline on AI-203/AI-207 from the unconfirmed dates')
    if any(o.get('op') == 'Reassign' and o.get('tasking') == 'AI-403' and o.get('to') != 'alvarez' for o in ops): rep['distractor'].append('AI-403 reassigned to someone other than Sofia')
    return rep

def report(name, reply):
    r = score(reply)
    print(f'\n== {name}')
    print(f'  answers proposed: {len(reply.get("answers", []) or [])}; passing the validator: {len(reply.get("answers", []) or []) - len(r["dropped"])}')
    print(f'  C1 clear answers linked correctly: {len(r["clear_hits"])}/{len(CLEAR)}' + (f'  missed: {r["clear_misses"]}' if r['clear_misses'] else ''))
    print(f'  C2 false links on unanswered items: {len(r["false_links"])}' + (f'  {r["false_links"]}' if r['false_links'] else ''))
    print(f'  C3 unconfirmed dates kept partial/open: {"yes" if not r["ambiguous_bad"] else "NO " + str(r["ambiguous_bad"])}')
    print(f'  C4 distractor kept off AI-403: {"yes" if not r["distractor"] else "NO " + str(r["distractor"])}')
    print(f'  C7 IDs copied exactly: {"yes" if not r["bad_ids"] else "NO " + str(r["bad_ids"])}')
    print(f'  C8 no duplicate flag for an answered question: {"yes" if not r["dup_flags"] else "NO " + str(r["dup_flags"])}')
    print(f'  C9 "match" only on who-is items: {"yes" if not r["match_misuse"] else "NO " + str(r["match_misuse"])}')
    if BUILD: print(f'  C10 multi-part questions kept partial: {"yes" if not r["overclaim"] else "NO (over-claimed answered) " + str(r["overclaim"])}')
    for d in r['dropped']: print(f'  dropped: {d.get("item")}: {d["why"]}')
    return r

def selftest():
    good = json.load(open(os.path.join(HERE, 'golden-reply.json'), encoding='utf-8'))
    r = score(good); ok = len(r['clear_hits']) == 4 and not (r['false_links'] or r['ambiguous_bad'] or r['distractor'] or r['bad_ids'] or r['dropped'])
    print(('PASS' if ok else 'FAIL') + ' golden reply scores 4/4 with no findings')
    def mutate(f):
        x = json.loads(json.dumps(good)); f(x); return x
    a403 = lambda x: next(a for a in x['answers'] if a['item'].endswith('AI-403'))
    amor = lambda x: next(a for a in x['answers'] if 'S013|ambiguous' in a['item'])
    seeds = [
      ('a mistyped ID', lambda x: a403(x).update(item='20261001T140000Z|S039|ownership|AI-0403')),
      ('an invented quote', lambda x: a403(x).update(quote='Sofia will own the staging check')),
      ('an owner answer without a Reassign', lambda x: x.update(ops=[o for o in x['ops'] if o['op'] != 'Reassign'])),
      ('a who-is answered with a first name only', lambda x: [o.update(name='Morgan') for o in x['ops'] if o['op'] == 'NewParty']),
      ('a quote from the earlier meeting’s segment number', lambda x: a403(x).update(seg='S039')),
    ]
    allok = ok
    for name, f in seeds:
        _, dropped = validate(mutate(f)); hit = len(dropped) == 1
        print(('PASS' if hit else 'FAIL') + f' seeded bad answer is dropped: {name}' + (f' ({dropped[0]["why"]})' if hit else '')); allok &= hit
    for name, f, key in [('a duplicate flag for the answered dates', lambda x: x['flags'].append({'kind': 'implied_change', 'about': ['AI-203'], 'src': ['S012'], 'note': 'n'}), 'dup_flags'),
                         ('"match" on an owner item', lambda x: a403(x).update(match='alvarez'), 'match_misuse'),
                         ('a false link on Priya', lambda x: x['answers'].append({'item': '20261001T140000Z|S048|ambiguous_reference|P2', 'seg': 'S010', 'quote': 'Raj got his as well', 'answer': 'Raj', 'status': 'partial'}), 'false_links'),
                         ('the dates marked answered', lambda x: [a.update(status='answered') for a in x['answers'] if '|S014|' in a['item']], 'ambiguous_bad'),
                         ('AI-403 linked to the loading dock', lambda x: a403(x).update(seg='S014', quote="I'll own checking the loading dock access"), 'distractor')]:
        hit = bool(score(mutate(f))[key]); print(('PASS' if hit else 'FAIL') + f' scoring catches {name}'); allok &= hit
    print('\nselftest: ' + ('all green' if allok else 'FAILURES')); return allok

if __name__ == '__main__':
    if sys.argv[1:] == ['--selftest']: sys.exit(0 if selftest() else 1)
    for p in sys.argv[1:]: report(os.path.basename(p), extract_json(open(p, encoding='utf-8').read()))
