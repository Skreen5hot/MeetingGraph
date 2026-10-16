"""v2 feasibility kit (docs/mkg-v2-plan.md §5): builds the three requests for the mock seed meeting.
  A  request-A-current.txt   the built workbench's own request (dist/MeetingGraph.html, empty board), unchanged
  B  request-B-paste.txt     the slim request with the numbered meeting pasted in
  C  request-C-attach.txt    the slim request; the numbered meeting goes in as an attachment (meeting-2026-10-19.txt)
  D  request-D-lines.txt     as B, but the reply is one JSON object per line with an end line (B1 came back cut off)
  E  request-E-lines-attach.txt  as C, with D's reply format
  F  request-F-followup.txt  the follow-up meeting (2026-10-26) with the board's open threads; D's format plus ref, thread,
                             status and waitsOn (plan §6). `python3 make_kit.py --followup` builds only F.
All three use the workbench's own statement numbering, so S-numbers are identical across A, B and C.
Also writes golden-reply.json: the key items (key-items.json) as a slim reply, for check_reply.py --selftest and for
render_reports.py (the hand-made sample the PM sees before any run).
Run: python3 make_kit.py   (needs Playwright, like the browser tests)"""
import hashlib, json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
sys.path.insert(0, os.path.join(ROOT, 'tests', 'playwright'))
import wb

DATE, TIME, OFFSET, TITLE = '2026-10-19', '10:00', '-04:00', 'Harbor Point reopening kickoff'
TRANSCRIPT = open(os.path.join(HERE, 'mock-seed-meeting-2026-10-19.txt'), encoding='utf-8').read()
ATTACH = 'meeting-2026-10-19.txt'

SLIM = """CONTEXT TOKEN (copy it exactly into "context"): {token}

You read one meeting transcript and list what a project manager needs to know from it. Meetings ramble: most of what is said needs no item. Pick out what matters; do not account for every line.

{where}

OPEN THREADS (what the board already tracks from earlier meetings): {threads}

WHAT TO LIST, one item each:
- commitment: someone says they will do something, or accepts a request ("I'll", "yes, I'll take it", "I can do that"). "Maybe I could", "I could probably" and "someone should" are not commitments.
- decision: the group settles a choice ("let's do", "we're going with", "that's the decision"). Options discussed but not settled are not decisions.
- question: something left open that someone still has to answer or decide.
- risk: something that could delay or block the work.
- update: a fact about progress, or a change to plans, dates, money or scope.

FINAL STATE ONLY. Meetings change their mind. When something said early is changed later (a decision reversed, a date moved, an owner switched, something pending that came through), list only the final state, cite the statement where it was settled, and do not list the earlier version.

FIELDS for each item:
- "kind": commitment | decision | question | risk | update
- "topic": 2 to 5 words naming the subject; use the same topic for items about the same subject.
- "who": for a commitment, the person who will do it; otherwise the person who raised or settled it. Use the speaker name as written in the transcript ("Lindqvist, Tom"), or null.
- "what": one plain line a team member would understand without having been in the meeting.
- "due": the date or time exactly as said ("by Friday", "end of next week"), or null. Do not convert it.
- "importance": "high" for what a leader would want to know (decisions, deadlines, risks to the opening date or the budget, commitments other work depends on); otherwise "normal".
- "thread": the ID from OPEN THREADS that this item continues, or null.
- "seg": the one statement number where it is said most clearly (for a commitment, where the person agrees).
- "words": 3 to 10 words copied exactly from that statement, character for character. Do not paraphrase, shorten or fix them.

At most 40 items; fewer, clearer items are better. Leave out greetings, small talk, stories, technical difficulties and arranging this meeting itself.

{output}"""
OUT_B = """OUTPUT: one fenced json code block and nothing else:
{"context": "...", "lastSeg": "the number of the final statement in the meeting", "summary": "3 to 5 plain sentences: what the meeting was about and what came out of it", "items": [{"kind": "...", "topic": "...", "who": "...", "what": "...", "due": null, "importance": "normal", "thread": null, "seg": "S001", "words": "..."}]}
"""
# D and E (2026-10-15): B1 came back as one 5,757-character line, cut off mid-item. One entry per line survives a cut:
# the lines before it are complete, and the missing end line shows that the reply is incomplete.
OUT_D = """OUTPUT: one fenced code block and nothing else. Inside it, one JSON object per line, never more than one object on a line:
- The first line: {"context": "...", "lastSeg": "the number of the final statement in the meeting", "summary": "3 to 5 plain sentences: what the meeting was about and what came out of it"}
- Then one line per item, in meeting order (by "seg"): {"kind": "...", "topic": "...", "who": "...", "what": "...", "due": null, "importance": "normal", "thread": null, "seg": "S001", "words": "..."}
- The last line: {"end": <the number of item lines>}
"""
WHERE_B = 'THE MEETING is below, under === MEETING ===. Each statement has a number (S001, S002, ...), a time and a speaker.'
WHERE_C = ('THE MEETING is in the attached file ' + ATTACH + '. Read the whole file, from the first statement to the last, '
           'before you answer. Each statement has a number (S001, S002, ...), a time and a speaker.')


def main():
    def go(w):
        token, chat = w.prepare(TRANSCRIPT, date=DATE, time=TIME, offset=OFFSET, title=TITLE)
        assert not w.errors, w.errors
        return chat
    chat = wb.run(os.path.join(ROOT, 'dist', 'MeetingGraph.html'), go)
    meeting = '=== MEETING ===' + chat.split('=== MEETING ===', 1)[1]
    segs = re.findall(r'^(S\d{3}) \[', meeting, re.M)
    assert segs and segs[-1] == 'S%03d' % len(segs), 'statement numbering is not contiguous'
    token = 'MKG2|seed|20261019T140000Z|' + hashlib.sha256(meeting.encode('utf-8')).hexdigest()[:8]
    w = lambda name, text: open(os.path.join(HERE, name), 'w', encoding='utf-8', newline='\n').write(text)
    w('request-A-current.txt', chat)
    T = 'none (this is the first meeting)'
    w('request-B-paste.txt', SLIM.format(token=token, where=WHERE_B, threads=T, output=OUT_B) + '\n' + meeting)
    w('request-C-attach.txt', SLIM.format(token=token, where=WHERE_C, threads=T, output=OUT_B))
    w('request-D-lines.txt', SLIM.format(token=token, where=WHERE_B, threads=T, output=OUT_D) + '\n' + meeting)
    w('request-E-lines-attach.txt', SLIM.format(token=token, where=WHERE_C, threads=T, output=OUT_D))
    w(ATTACH, meeting)
    # The golden reply: one item per key, citing its first anchor, with the anchor as the exact words.
    import check_reply as cr
    K = cr.load_keys(cr.parse_segments(meeting))
    items = [{'kind': k['kinds'][0], 'topic': k['id'], 'who': cr.full_speaker(k['who']),
              'what': k['label'], 'due': k['due'], 'importance': k['importance'], 'thread': None,
              'seg': k['anchor_segs'][0], 'words': k['anchors'][0]} for k in K['keys']]
    golden = {'context': token, 'lastSeg': segs[-1],
              'summary': 'Kickoff for reopening the Harbor Point community center after its renovation. The opening is aimed at the week of January 11 but depends on the final fire inspection, which Tom is booking; the open house moved to Saturday, January 16. The main risks are the fire inspection backlog, a possible furniture delivery slip and the fiber internet install, which may come after front desk training. Signage was decided (tactile room signs, vinyl wayfinding) and is over budget; Ken is checking the contingency. No public date will be announced until the inspection is booked.',
              'items': items}
    w('golden-reply.json', json.dumps(golden, indent=1, ensure_ascii=False) + '\n')
    size = lambda name: len(open(os.path.join(HERE, name), encoding='utf-8').read())
    print('  '.join(f'{n} {size(f)} chars' for n, f in (('A', 'request-A-current.txt'), ('B', 'request-B-paste.txt'), ('C', 'request-C-attach.txt'),
          ('D', 'request-D-lines.txt'), ('E', 'request-E-lines-attach.txt'))), '; attachment', len(meeting), 'chars;', len(segs), 'statements;  token', token)
    followup()


# ---------------- The follow-up meeting (plan §6): threads, status and waits-on ----------------
F_DATE, F_TITLE = '2026-10-26', 'Harbor Point reopening weekly'
F_TRANSCRIPT = os.path.join(HERE, 'mock-followup-meeting-2026-10-26.txt')
F_BOARD = os.path.join(HERE, 'board-after-seed.json')

SLIM_F = """CONTEXT TOKEN (copy it exactly into "context"): {token}

You read one meeting transcript and list what a project manager needs to know from it. Meetings ramble: most of what is said needs no item. Pick out what matters; do not account for every line.

THE MEETING is below, under === MEETING ===. Each statement has a number (S001, S002, ...), a time and a speaker.

OPEN THREADS, under === OPEN THREADS ===, are what the board already tracks from earlier meetings: actions, open questions, risks and decisions, each with an ID. This meeting will report on some of them and add new things.

WHAT TO LIST, one item each:
- commitment: someone says they will do something, or accepts a request ("I'll", "yes, I'll take it", "I can do that"). "Maybe I could", "I could probably" and "someone should" are not commitments.
- decision: the group settles a choice ("let's do", "we're going with", "that's the decision"). Options discussed but not settled are not decisions.
- question: something left open that someone still has to answer or decide.
- risk: something that could delay or block the work.
- update: a fact about progress, or a change to plans, dates, money or scope.

FINAL STATE ONLY. Meetings change their mind. When something said early is changed later (a decision reversed, a date moved, an owner switched, something pending that came through), list only the final state, cite the statement where it was settled, and do not list the earlier version.

FIELDS for each item:
- "ref": N1, N2, N3 ... in order, so other items can point to it.
- "kind": commitment | decision | question | risk | update
- "topic": 2 to 5 words naming the subject; use the same topic for items about the same subject.
- "who": for a commitment, the person who will do it; otherwise the person who raised or settled it. Use the speaker name as written in the transcript ("Lindqvist, Tom"), or null.
- "what": one plain line a team member would understand without having been in the meeting.
- "due": the date or time exactly as said ("by Friday", "end of next week"), or null. Do not convert it.
- "importance": "high" for what a leader would want to know (decisions, deadlines, risks to the opening date or the budget, commitments other work depends on); otherwise "normal".
- "thread": the OPEN THREADS ID this item reports on or continues, or null when it is new work. Something that only sounds like an open thread (the same words, a different job) is new: null.
- "status": only for an item with a thread, and only when the meeting says so: "done" when someone says that action is finished, or that question is answered or settled; "blocked" when it cannot move until something else happens; "in_progress" when it is started but not finished. Otherwise null. Never "done" for something planned, partly done, drafted but held, or not discussed.
- "waitsOn": when a speaker says this cannot be done until something else is, the ref (N...) or thread ID of that other thing; otherwise null.
- "seg": the one statement number where it is said most clearly (for a commitment, where the person agrees).
- "words": 3 to 10 words copied exactly from that statement, character for character. Do not paraphrase, shorten or fix them.

Say nothing about open threads the meeting does not discuss. At most 60 items; fewer, clearer items are better. Leave out greetings, small talk, stories, technical difficulties and arranging this meeting itself.

OUTPUT: one fenced code block and nothing else. Inside it, one JSON object per line, never more than one object on a line:
- The first line: {{"context": "...", "lastSeg": "the number of the final statement in the meeting", "summary": "3 to 5 plain sentences: what the meeting was about and what came out of it"}}
- Then one line per item, in meeting order (by "seg"): {{"ref": "N1", "kind": "...", "topic": "...", "who": "...", "what": "...", "due": null, "importance": "normal", "thread": null, "status": null, "waitsOn": null, "seg": "S001", "words": "..."}}
- The last line: {{"end": <the number of item lines>}}

{threads}

"""


def threads_block():
    B = json.load(open(F_BOARD, encoding='utf-8'))
    rows = [' | '.join([t['id'], t['kind'], t['owner'] or '-', t['what'], t['due'] or '-', t['status']]) for t in B['threads']]
    return '=== OPEN THREADS ===\nID | kind | owner | what | due as said | status\n' + '\n'.join(rows)


def followup():
    def go(w):
        token, chat = w.prepare(open(F_TRANSCRIPT, encoding='utf-8').read(), date=F_DATE, time=TIME, offset=OFFSET, title=F_TITLE)
        assert not w.errors, w.errors
        return chat
    chat = wb.run(os.path.join(ROOT, 'dist', 'MeetingGraph.html'), go)
    meeting = '=== MEETING ===' + chat.split('=== MEETING ===', 1)[1]
    segs = re.findall(r'^(S\d{3}) \[', meeting, re.M)
    assert segs and segs[-1] == 'S%03d' % len(segs), 'statement numbering is not contiguous'
    tb = threads_block()
    token = 'MKG2|followup|20261026T140000Z|' + hashlib.sha256((tb + meeting).encode('utf-8')).hexdigest()[:8]
    w = lambda name, text: open(os.path.join(HERE, name), 'w', encoding='utf-8', newline='\n').write(text)
    w('meeting-2026-10-26.txt', meeting)
    w('request-F-followup.txt', SLIM_F.format(token=token, threads=tb) + meeting)
    # The golden follow-up reply: one item per key, with its expected thread, status and waits-on.
    import check_reply as cr
    K = cr.load_keys(cr.parse_segments(meeting), 'key-followup.json')
    ref = {k['id']: f'N{n + 1}' for n, k in enumerate(K['keys'])}
    first = lambda v: (v[0] if isinstance(v, list) else None)
    items = [{'ref': ref[k['id']], 'kind': k['kinds'][0], 'topic': k['id'], 'who': cr.full_speaker(k['who'].split('|')[0]),
              'what': k['label'], 'due': k['due'], 'importance': k['importance'], 'thread': first(k['thread']),
              'status': first(k['status']) if isinstance(k['status'], list) else None,
              'waitsOn': ref.get(k.get('waitsOn')), 'seg': k['anchor_segs'][0], 'words': k['anchors'][0]} for k in K['keys']]
    golden = {'context': token, 'lastSeg': segs[-1],
              'summary': 'Weekly reopening check-in. The fire inspection is booked for December 14, so the January 11 opening holds if it passes, and the announcement can go ahead. The mural stays, Event Rentals will supply the open house chairs, and the signage is covered after the contingency moved. Training moves to the main office because the hotspot failed; the fiber install is now December 21. The keycard list is blocked on HR.',
              'items': items}
    w('golden-followup.json', json.dumps(golden, indent=1, ensure_ascii=False) + '\n')
    print('F', len(open(os.path.join(HERE, 'request-F-followup.txt'), encoding='utf-8').read()), 'chars;', len(segs), 'statements;', len(K['keys']), 'keys;  token', token)


if __name__ == '__main__':
    if '--followup' in sys.argv: followup()
    else: main()
