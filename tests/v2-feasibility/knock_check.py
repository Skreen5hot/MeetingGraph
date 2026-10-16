"""Knockouts for check_reply.py: each mutation must make its named selftest check FAIL (a crash does not count).
Run: python3 knock_check.py"""
import os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, 'check_reply.py'), encoding='utf-8').read()
TMP = os.path.join(HERE, '_knocked_check_reply.py')

KNOCKS = [
    ('words are never checked', "elif seg in segs and w in norm(segs[seg]['text']): st = 'verified'", "elif True: st = 'verified'",
     'paraphrased words: not found'),
    ('no near window', "abs(segnum(n) - segnum(seg)) <= 2 and w in", "abs(segnum(n) - segnum(seg)) <= 0 and w in",
     'words in the next statement: near'),
    ('stale traps ignored', "stale = [t for t in rep['traps'] if t['stale']]", "stale = []",
     'the reversed vinyl decision is a stale trap'),
    ('trap text not read', "txt = bool(t.get('text')) and re.search", "txt = False and re.search",
     'an open house on January 9 is a stale trap'),
    ('trap owner not read', "(not t.get('who') or who_hit(t['who'], it) or at)", "(at)",
     'Tom owning the keycard list'),
    ('no recall by third', "all(f(t) / len(t) >= 0.6 for t in thirds)", "True",
     'a reply that stops at 40 minutes'),
    ('context not compared', "rep['context'] = 'ok' if reply.get('context') == token else", "rep['context'] = 'ok' if True else",
     'a wrong context token fails criterion 1'),
    ('last statement not compared', "rep['lastSeg'] = 'ok' if reply.get('lastSeg') == last else", "rep['lastSeg'] = 'ok' if True else",
     'a wrong last statement fails criterion 7'),
    ('threads not checked', "if not FU and it.get('thread') not in (None, ''):", "if False:",
     'a thread on a seed meeting is a field error'),
    ('completions not read', "if o.get('op') == 'NewTasking' and o.get('ref') in done: continue", "pass",
     'a task created and completed in one reply counts as done'),
    ('cut replies not marked', "rep['cut'] = reply.get('_cut')", "rep['cut'] = None",
     'a reply cut off in its items keeps the complete items'),
    ('end line not read', "end = next((o for o in objs[1:] if 'end' in o), None)", "end = {'end': len(items)}",
     'a line reply without its end line'),
    ('miscount treated as a cut', "elif not isinstance(end.get('end'), int) or len(items) < end['end']:", "elif len(items) != end.get('end'):",
     'an end line saying fewer items than arrived is a miscount'),
    ('thread links not scored', "rep['links'].append((k['id'], it.get('thread') in k['thread'], it.get('thread')))", "rep['links'].append((k['id'], True, it.get('thread')))",
     'four items not linked to their open thread'),
    ('statuses not scored', "rep['statuses'].append((k['id'], it.get('status') in k['status'], it.get('status')))", "rep['statuses'].append((k['id'], True, it.get('status')))",
     'four of sixteen status changes missing'),
    ('false closures not looked for', "if it.get('status') == 'done' and it.get('thread') not in done_ok:", "if False:",
     'the half-done website marked done is a false closure'),
    ('look-alike threads not checked', "if t.get('link') and it.get('thread') not in t['link']: continue", "if t.get('link'): continue",
     'the open house photographer filed on the website-photos thread'),
    ('waits-on not read', "ok = any(x.get('waitsOn') and x.get('waitsOn') == items[target].get('ref') for x in cands)", "ok = True",
     'a missing waits-on link is reported'),
    ('flags not converted', "for f in reply.get('flags') or []:", "for f in []:",
     'a current-contract reply converts'),
]

killed = 0
for name, old, new, check in KNOCKS:
    n = SRC.count(old)
    if n != 1: print(f'  BAD  {name}: expected 1 match, found {n}'); continue
    open(TMP, 'w', encoding='utf-8').write(SRC.replace(old, new))
    try:
        p = subprocess.run([sys.executable, TMP, '--selftest'], capture_output=True, text=True, encoding='utf-8')
    finally:
        os.remove(TMP)
    crashed = 'selftest checks' not in p.stdout
    hit = any(l.strip().startswith('FAIL') and check in l for l in p.stdout.splitlines())
    ok = hit and not crashed
    killed += ok
    print(f'  {"KILLED" if ok else "SURVIVED" if not crashed else "CRASHED"}  {name}  ->  {check}')
print(f'{killed} of {len(KNOCKS)} killed')
sys.exit(0 if killed == len(KNOCKS) else 1)
