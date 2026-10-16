"""Score replies for a real meeting without anyone seeing its content (plan §10.15).
The key is a plain list of the statement numbers where the meeting's important items are said (S048, S091, ...), written
by someone who was in the meeting. A reply's item counts for a key statement when it cites a statement within 2 of it
(one item per key statement). The output is counts and statement numbers only: never what an item says.
Keep real replies and keys in tests/real/local/ (git ignores it). Nothing from a real meeting goes into the repo.
Usage: python3 score_real.py key.txt reply1.txt [reply2.txt ...]     (key.txt: S-numbers, one or more per line; # starts a note)
       python3 score_real.py --selftest"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(HERE, '..', 'v2-feasibility'))
import check_reply as cr   # the kit's reader: the per-line format, cut replies, the end line

TOL = 2


def read_key(text):
    """The key's statement numbers, in order, without duplicates. Anything after # on a line is ignored."""
    segs = []
    for line in text.splitlines():
        for s in re.findall(r'\bS\d{3}\b', line.split('#', 1)[0]):
            if s not in segs: segs.append(s)
    return segs


def score(reply_text, key, tol=TOL):
    """Counts for one reply: items by kind, complete or cut, and which key statements it covers."""
    try: r = cr.extract(reply_text)
    except ValueError as e: return {'error': str(e)}
    items = [x for x in (r.get('items') or []) if isinstance(x, dict)]
    num = lambda s: int(s[1:]) if isinstance(s, str) and re.match(r'^S\d{3}$', s) else None
    segs = [num(x.get('seg')) for x in items]
    used, found = set(), {}
    for k in key:     # nearest unused item within the tolerance; one item per key statement
        cands = sorted((abs(n - num(k)), i) for i, n in enumerate(segs) if n is not None and i not in used and abs(n - num(k)) <= tol)
        if cands: used.add(cands[0][1]); found[k] = items[cands[0][1]].get('seg')
    kinds = {}
    for x in items: kinds[x.get('kind')] = kinds.get(x.get('kind'), 0) + 1
    return {'items': len(items), 'kinds': kinds, 'cut': r.get('_cut'), 'note': r.get('_note'), 'found': found,
            'missed': [k for k in key if k not in found], 'unkeyed': len(items) - len(used)}


def report(names, results, key):
    lines = [f'Key: {len(key)} important statements']
    for name, s in zip(names, results):
        if 'error' in s: lines.append(f'{name}: could not be read ({s["error"]})'); continue
        kinds = ', '.join(f'{k} {v}' for k, v in sorted(s['kinds'].items(), key=lambda kv: str(kv[0])))
        lines.append(f'{name}: {len(s["found"])}/{len(key)} key statements found | {s["items"]} items ({kinds}) | '
                     f'{s["unkeyed"]} items not on a key statement | ' + ('cut: ' + s['cut'] if s['cut'] else 'complete'))
        if s['missed']: lines.append(f'  missed: {", ".join(s["missed"])}')
    ok = [s for s in results if 'error' not in s]
    if len(ok) > 1:
        every = [k for k in key if all(k in s['found'] for s in ok)]
        none = [k for k in key if not any(k in s['found'] for s in ok)]
        lines.append(f'All runs: {len(every)}/{len(key)} found by every run; missed by every run: {", ".join(none) or "none"}')
    return '\n'.join(lines) + '\n'


def selftest():
    ok = []
    def check(name, cond, detail=''):
        ok.append(bool(cond)); print(('OK   ' if cond else 'FAIL ') + name + (f'  [{detail}]' if detail and not cond else ''))
    head = '{"context": "MKG2|seed|x|y", "lastSeg": "S120", "summary": "SECRET-SUMMARY"}'
    item = lambda seg, kind='commitment': '{"kind": "%s", "topic": "t", "who": "SECRET-NAME", "what": "SECRET-TEXT", "seg": "%s", "words": "SECRET-WORDS"}' % (kind, seg)
    reply = lambda *segs: '\n'.join([head] + [item(s) for s in segs] + ['{"end": %d}' % len(segs)])
    key = read_key('S010 # the inspection, also see S099\nS052, S100\nS010\n')
    check('the key reads statement numbers, ignores notes after #, and drops repeats', key == ['S010', 'S052', 'S100'], key)
    s = score(reply('S010', 'S050', 'S070'), key)
    check('an item within 2 statements of a key statement counts for it; the others are missed', s['found'] == {'S010': 'S010', 'S052': 'S050'} and s['missed'] == ['S100'], s)
    check('items on no key statement are counted, not matched', s['unkeyed'] == 1)
    check('with tolerance 0, only the exact statement counts', len(score(reply('S010', 'S050'), key, tol=0)['found']) == 1)
    s2 = score(reply('S010'), ['S010', 'S011'])
    check('one item counts for one key statement only', len(s2['found']) == 1, s2)
    s3 = score('\n'.join([head, item('S010'), item('S052')]), key)
    check('a reply without its end line is reported cut, and its items still count', s3['cut'] and len(s3['found']) == 2, s3)
    rep = report(['run1', 'run2'], [score(reply('S010', 'S052'), key), score(reply('S010', 'S100'), key)], key)
    check('two runs: found by every run, and missed by every run', 'All runs: 1/3 found by every run; missed by every run: none' in rep, rep)
    check('the report holds no content: no names, no text, no words, no summary', not re.search(r'SECRET', rep), rep)
    check('an unreadable reply is reported, not crashed on', 'could not be read' in report(['x'], [score('nothing', key)], key))
    print(f'{sum(ok)}/{len(ok)} score_real checks ' + ('ALL GREEN' if all(ok) else 'FAILED'))
    return all(ok)


if __name__ == '__main__':
    if '--selftest' in sys.argv: sys.exit(0 if selftest() else 1)
    if len(sys.argv) < 3: sys.exit(__doc__)
    key = read_key(open(sys.argv[1], encoding='utf-8').read())
    if not key: sys.exit('The key has no statement numbers (S001, S002, ...).')
    names = [os.path.basename(p) for p in sys.argv[2:]]
    print(report(names, [score(open(p, encoding='utf-8').read(), key) for p in sys.argv[2:]], key), end='')
