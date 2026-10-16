# For review: open items answered in meetings (MeetingGraph plan §16.16)

**Prepared for the testers, 2026-10-14.** Plain files, one per item; nothing zipped.

## What we are asking you to review

A change to the **request text and the reply format**. Open items that the board already shows are listed in the request, and the chat may link a meeting's answers to them. Nothing is built yet. Aaron approved the approach for feasibility testing. The test passed, and three findings from it are fixed in the revised request (v2). Your review comes before Aaron ratifies the build.

**Why.** Users asked for edit buttons on every board item, which would turn MeetingGraph into a hand-edited tracker. The product's purpose is the opposite: the board changes because a meeting said so, with the transcript as the evidence. So open items are answered in meetings. The board itself stays read-only: it shows the question, what is needed to answer it, and the evidence.

## The change in one page

1. **Open items with stable IDs.** The request lists each open item under `=== OPEN ITEMS ===`, with its ID, a direct question, and what is needed. The ID is the board's existing stable identity (meeting + segment + label kind + target), for example `20261001T140000Z|S039|ownership|AI-403`. No new ID scheme.
2. **A new rule (OPEN ITEMS RULE)** asks the chat to add an entry to a top-level `answers` array **only** when the meeting explicitly addresses an item. Each entry has:
   - `item`: the ID, copied exactly;
   - `seg` and `quote`: the answering words, from this meeting;
   - `answer`: a short plain answer;
   - `status`: `answered` or `partial`;
   - `match`: for who-is items only, the existing person.

   Uncertain or incomplete answers are `partial`, and items not discussed are left out. The changes themselves stay ordinary ops: an owner who accepts is a Reassign, a newly identified person is a NewParty, and so on.
3. **The validator checks each answer:**
   - the ID matches exactly (no fuzzy matching);
   - the quote is in the cited segment of this meeting;
   - the change fits the question: an owner answer needs a Reassign on that task citing the answer, and a who-is answer needs a NewParty with a full name, or a match.

   A failing answer is dropped, its item stays open, and the review says why. The rest of the reply is unaffected.
4. **A person confirms every closure.** A passing answer is only a *proposed* closure. In the import review it shows with a "Close this item" box, unchecked by default. An item closes only when the reviewer ticks the box. A `partial` answer is shown but never offered for closing. Closing an item and accepting the meeting's changes are separate: leaving the box unticked never removes an owner, person or task the meeting recorded.
5. **Replies without `answers` behave exactly as today.** We checked that the current workbench gives an identical result with and without the field.

## The feasibility test

The test used a mock follow-up meeting (`mock-meeting-2026-10-08.txt`, 33 statements) after the Oct 1 board walk, with 11 open items. The meeting:
- answers four items clearly;
- answers the transfer dates only tentatively;
- leaves three items unanswered;
- includes a distractor: an ownership statement about the loading dock that sounds like AI-403's staging area.

Aaron ran the request three times on gpt-5.6-terra-low. Results (`results-2026-10-14.md`):

| Criterion | Result |
|---|---|
| Clear answers linked to the right item, with a valid quote and the right change | 12/12 |
| Unanswered items proposed as answered | 0 in all runs |
| Unconfirmed dates | Partial or left out; no deadline set |
| Distractor kept off AI-403 | All runs |
| Replies valid in the workbench | All runs, 0 errors |
| IDs copied exactly | All |

The three runs proposed identical answer sets.

## Three findings, fixed in v2 (`request-open-items-v2.txt`)

| Finding (v1) | Fix in v2 | New check |
|---|---|---|
| The two-part invitations question ("sent, and received?") came back `partial` every time, because only receipt was stated. Partial answers can't close an item | **One thing per question.** "Did James receive the invitation update?" The observer, connectivity and transfer questions are simplified the same way | The invitations item must be `answered` |
| Two runs also raised a *new* flag for the dates they had answered partially. The build would show a duplicate item | **Rule 6:** "Do not add a flag for a question you answered, fully or partially." The build will also suppress such a duplicate | C8: no new flag about AI-203/AI-207 citing S011–S013 (the v1 runs 1 and 2 fail it, as expected) |
| Two runs put `match` on the owner question (harmless; ignored) | **Rule 1:** `match` only for "Who is …?" items | C9 (the v1 runs 1 and 2 fail it) |

## What we ask of you

1. **Review the rule and the format** (in `request-open-items-v2.txt`: the OPEN ITEMS RULE above the INDEX, the `=== OPEN ITEMS ===` block above the MEETING, and the `answers` line in the output shape). Is any wording ambiguous, or likely to invite answers from inference?
2. **Review the validator rules** (point 3 above, and `check_answers.py`, function `validate`). Are there failure modes they miss?
3. **Optional: run v2 three times** on gpt-5.6-terra-low, in new chats, pasting the whole of `request-open-items-v2.txt`. Score with `python3 check_answers.py --v2 run1.txt run2.txt run3.txt`. Pass means criteria 1–4 and 7 as in `scoring-sheet.md`, now with the invitations item required to be `answered`, plus C8 and C9 clean.
4. **Tell us what you would change** before the build. Accepting a reply with `answers` is the only change to the reply contract: an optional field that existing replies don't need.

## Files

| File | What it is |
|---|---|
| `testers-review-16.16.md` | This brief |
| `request-open-items-v2.txt` | The revised request (v2), ready to paste |
| `open-items-v2.json` | The 11 open items (IDs, questions, needed) |
| `mock-meeting-2026-10-08.txt` | The mock meeting transcript |
| `scoring-sheet.md` | Expected outcome per item, distractors, pass criteria (v1; v2 differences listed above) |
| `results-2026-10-14.md` | The v1 results and findings |
| `check_answers.py` | Validator rules and scoring (`--selftest`; `--v2` for the revised request) |
| `golden-reply.json` | A hand-written correct answer set, used by the self-test |
| `request-open-items.txt`, `open-items.json` | v1 (as tested), for comparison |
