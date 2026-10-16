"""Builds the §16.16 feasibility request: the workbench's own request for the mock Oct 8 meeting, plus the OPEN ITEMS
block and rule. The open-item IDs are the board's existing stable identities (meeting + segment + label kind + target).
Run: python3 make_request.py   (reads _request_base.txt, writes request-open-items.txt and open-items.json)"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__))
base = open(os.path.join(HERE, '_request_base.txt'), encoding='utf-8').read()

# The 11 open items on the board after the Oct 1 board walk (Aaron's package), as direct questions (§16.16.2).
ITEMS = [
  ('20261001T140000Z|S039|ownership|AI-403', 'owner', 'AI-403', 'Who owns AI-403 "Verify staging-area load suitability for heavy equipment and file cases, identify an alternate staging area if needed, and confirm the appropriate location"?', 'One person who accepts it.'),
  ('20261001T140000Z|S013|ambiguous_reference|P2', 'who', 'P2', 'Who is "Morgan" (addressed directly about observers in the Oct 1 meeting)?', 'Their full name and organization, or the person in PEOPLE they are.'),
  ('20261001T140000Z|S048|ambiguous_reference|P2', 'who', 'P2', 'Who is "Priya", who was to be added to the invitation?', 'Their full name and organization, or the person in PEOPLE they are.'),
  ('20261001T140000Z|S050|open_question|P2', 'question', 'P2', 'Did James receive the invitation update?', 'Yes or no.'),
  ('20261001T140000Z|S007|open_question|AI-206', 'question', 'AI-206', 'Will the monitoring equipment be mounted on the temporary workstation stand, or placed on separate tables?', 'The decision.'),
  ('20261001T140000Z|S004|open_question|P2', 'question', 'P2', 'What is the final observer list?', 'The names, or who will provide them.'),
  ('20261001T140000Z|S038|open_question|P2', 'question', 'P2', 'Is connectivity confirmed, including the backup option?', 'Yes or no.'),
  ('20261001T140000Z|S014|open_question|AI-203', 'question', 'AI-203', 'What is the confirmed transfer period, with the year?', 'Start and end dates with the year.'),
  ('20261001T140000Z|S014|open_question|AI-207', 'question', 'AI-207', 'What is the confirmed transfer period, with the year?', 'Start and end dates with the year.'),
  ('20261001T140000Z|S014|implied_change|AI-203', 'dates', 'AI-203', 'Does the transfer schedule change the due date of AI-203 "Run a test transfer with a sample file" (now 2026-10-01)? If so, to what date?', 'One full date with the year, or "no change".'),
  ('20261001T140000Z|S014|implied_change|AI-207', 'dates', 'AI-207', 'Does the transfer schedule change the due date of AI-207 "Finalize transfer travel and arrival plan" (now none)? If so, to what date?', 'One full date with the year, or "no change".'),
]

RULE = """OPEN ITEMS RULE (answers to earlier open questions)
The board has open items from earlier meetings, listed under === OPEN ITEMS === with an ID, a question, and what is needed to answer it.
1. Only when THIS meeting explicitly addresses an item, add one entry to a top-level "answers" array in the Part B JSON object:
   {"item": "<the ID, copied character for character>", "seg": "S0xx", "quote": "<exact words from that segment, at most 25 words>", "answer": "<short plain answer>", "status": "answered|partial"}
   For a "Who is ...?" item answered with someone already in PEOPLE, add "match": "<that PEOPLE ID>". Never use "match" for any other item.
2. The S-number inside an ID refers to the EARLIER meeting. Copy the ID as text. Your "seg" and "quote" come from THIS meeting.
3. "answered" only when the meeting gives everything listed under Needed. If anything is uncertain, tentative ("probably", "still confirming") or missing, use "partial". If the item is not discussed, leave it out. Never answer from inference, from the INDEX, or from earlier meetings. Something that only sounds similar (another task, another place, another person) is not an answer.
4. Record the changes themselves as ordinary ops under the RULES above: an owner who accepts is a Reassign; a person newly identified by full name is a NewParty; new work is a NewTasking; a stated full due date is a Deadline. An answer does not replace an op, and an op does not need an answer.
5. A reviewer confirms every proposed closure; your answer only proposes it.
6. Do not add a flag for a question you answered, fully or partially: the open item already tracks it. Flags are for NEW questions only."""

block = ['=== OPEN ITEMS ===', 'ID | question | needed']
for k, kind, target, q, need in ITEMS: block.append(f'{k} | {q} | {need}')

i = base.index('=== MEETING ===')
j = base.index('=== INDEX ===')
out = base[:j] + RULE + '\n\n' + base[j:i] + '\n'.join(block) + '\n\n' + base[i:]
out = out.replace('  "selfReview": {"newVsExisting"', '  "answers": [{"item": "<ID from OPEN ITEMS, copied exactly>", "seg": "S0xx", "quote": "...", "answer": "...", "status": "answered|partial"}],\n  "selfReview": {"newVsExisting"', 1)
assert '"answers": [' in out
OUTNAME = os.environ.get('OUTNAME', 'request-open-items-v2.txt')
open(os.path.join(HERE, OUTNAME), 'w', encoding='utf-8').write(out)
json.dump([{'id': k, 'kind': kind, 'target': t, 'question': q, 'needed': n} for k, kind, t, q, n in ITEMS],
          open(os.path.join(HERE, 'open-items-v2.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(OUTNAME, len(out), 'chars;', len(ITEMS), 'open items')
