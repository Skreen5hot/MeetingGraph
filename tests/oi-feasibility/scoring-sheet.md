# §16.16 feasibility test: open items answered in a meeting

**What it tests.** Given the board's open items with their stable IDs, does the enterprise model link a meeting's answers to the right item, with the right quote, and leave everything else open?

**The setup.** The request (`request-open-items.txt`) is the workbench's own request for a mock follow-up meeting, plus an OPEN ITEMS block and rule.
- Board state: the sample baseline plus Aaron's Oct 1 board walk package, which leaves 11 open items.
- The mock meeting: the Oct 8 weekly board walk, 33 statements.
- The open-item IDs are the existing stable identities (meeting + segment + label kind + target). No new ID scheme.

## Expected outcome per item

| Item (ID) | Question | What the meeting says | Expected |
|---|---|---|---|
| `…\|S039\|ownership\|AI-403` | Who owns AI-403 (staging-area load check)? | S004 Dana asks Sofia; S005 "Yes, I'll take the staging-area load check" | **answered**, with a Reassign AI-403 → alvarez citing S005 (and S004) |
| `…\|S013\|ambiguous_reference\|P2` | Who is "Morgan"? | S002 "I'm Morgan Reyes. I lead the partner network team" | **answered**, with a NewParty "Morgan Reyes" citing S002 |
| `…\|S050\|open_question\|P2` | Were the invitations sent; did James receive his? | S010 "Yes, I got the invitation, and Raj got his as well." | **answered** (partial is also accepted) |
| `…\|S007\|open_question\|AI-206` | Stand or separate tables? | S007 "We've decided to keep the monitoring equipment on separate tables" | **answered** (a Decision op is expected but not required) |
| `…\|S014\|open_question\|AI-203` and `…\|AI-207` | The confirmed transfer period and year? | S012 "probably the eighteenth through the twenty-second, but we're still confirming the year" | **partial**, or left out. **Never answered** |
| `…\|S014\|implied_change\|AI-203` and `…\|AI-207` | Does the schedule change the due date? | The same, with no date stated | **partial**, or left out. **No Deadline op** |
| `…\|S048\|ambiguous_reference\|P2` | Who is "Priya"? | Not discussed | **left out** |
| `…\|S004\|open_question\|P2` | The final observer list? | Not discussed | **left out** |
| `…\|S038\|open_question\|P2` | Connectivity confirmed? | Not discussed. S020's "connection route" is a different item (AI-402) | **left out** |

**Distractors.** These must **not** be linked to AI-403:
- **S014–S016:** Mei will own "checking the loading dock access", and Dana confirms it is separate from the staging-area check.
- **S020–S022:** the connection route is done. That updates AI-402 and does not answer the connectivity question.

## Pass criteria (3 runs)

| # | Criterion | Pass if |
|---|---|---|
| 1 | Clear answers linked to the right item, with a valid quote and the right change | At least 11 of 12 across the 3 runs |
| 2 | No unanswered item is ever proposed as answered (judged on what the chat proposed, before the validator) | 0 false links in all runs |
| 3 | The unconfirmed dates stay partial or are left out, and there is no Deadline on AI-203 or AI-207 | Every run |
| 4 | The loading-dock distractor is never linked to AI-403, and AI-403 is not given to anyone but Sofia | Every run |
| 5 | The reply is otherwise valid in the workbench (it accepts an `answers` list without any change; checked) | Every run |
| 6 | The checker drops seeded bad answers: a mistyped ID, an invented quote, an owner answer without a Reassign, a first name only, an earlier meeting's segment number | `python3 check_answers.py --selftest` all green (done) |
| 7 | Every ID is copied exactly | Recorded as a finding if not; a bad ID drops the answer, which is safe but loses it |

**Reminder (Aaron's condition 1):** in the build, a passing answer is only a **proposed** closure. The reviewer's tick in the import review closes the item. This test measures how good the proposals are.

## How to run it

1. Open a **new chat** with gpt-5.6-terra-low and paste the whole of `request-open-items.txt`. Save the complete reply as `run1.txt`.
2. Repeat in two more new chats: `run2.txt`, `run3.txt`.
3. Send me the three replies. I will:
   - run `python3 check_answers.py run1.txt run2.txt run3.txt`;
   - validate each reply in the workbench (criterion 5);
   - report against the criteria above.

Files: `request-open-items.txt` (paste this), `mock-meeting-2026-10-08.txt` (the transcript it contains), `open-items.json`, `check_answers.py`, `golden-reply.json` (a hand-written correct answer set, used by the self-test), `make_request.py` and `_request_base.txt` (to rebuild the request).
