# MeetingGraph v2: meeting memory from one chat round

Status, 2026-10-15:
- **Direction agreed** (Aaron, 2026-10-14).
- **Both feasibility tests pass:** the seed meeting (§5.10) and the follow-up meeting (§6.5).
- **The build plan (§10) is ratified:** B1–B16 as written, including B14a (Aaron, 2026-10-15).
- **Step 0 is built, with "Add an item", the CSV seed and multi-project meetings:** `dist/MeetingGraph2.html` `745f98dd` (§10.17, §10.18).
- **Still open:** the format fixtures (approval).

This is a new iteration, not a §16 section. v1 (`mkg-dux12-plan.md`) is frozen while v2 is tested (§7).

## 1. Why: the warrant from v1

**What happened.** A project manager ran their seed meeting through the v1 workbench. They could not get a reply accepted after two repair rounds. They also doubt the task model, and they want the system to "put it all together and surface what's relevant."

**Why v1 fails on real meetings.** These points come from the design and the record. The PM's actual finding codes are not yet known (§5.6).
1. **v1 was tuned on short transcripts.** The Difficult transcript has 52 statements and the mock board walk 33. A real meeting lasts 60 minutes. The v2 mock meeting has 471 statements and about 8,000 spoken words.
2. **The request grows with the meeting.** For the mock seed meeting, the v1 request is **76,207 characters** (the Difficult one is 27,573). The chat's input limit is unknown, so the paste itself may fail.
3. **The reply grows with the meeting.** v1 asks for a disposition for every statement, a coverage row for every register item, and a selfReview row for every new task, before the changes themselves. On a 60-minute meeting that means hundreds of entries in one JSON object, written by a low-effort model.
4. **One bad part blocks the whole reply.** A paraphrased quote (CITE-RANGE) or malformed JSON stops the whole reply. A repair asks for the whole object again, so it hits the same limits. Two repairs then fail by construction. The open §16.18 item is the same problem at a smaller scale.
5. **A seed meeting is the worst case.** With an empty register, v1's matching machinery has nothing to match against. The model has to build the whole board from a rambling hour in one pass.
6. **The record already said so.** The D-UX10h feasibility test failed 0 of 3 on the short transcript, and the stop rule fired. Later work moved the uncertainty to the reviewer, but it never made the request or reply smaller.

**What the PM needs.** They write team summary emails and leadership reports from the tool. The board serves the PM and the team in meetings.

## 2. Constraints

- Edge only, one offline HTML page, no servers. The team folder of JSON files is the source of truth.
- Extraction is done by gpt-5.6-terra-low through its chat UI only, with no API.
- **One chat round per meeting, two at most** (Aaron, 2026-10-14). Two rounds were painful for the PM.
- The chat accepts file attachments. It has an output cap of unknown size; the cap stopped replies on other projects but not on this one.
- Meetings run 60 minutes. Real transcripts never go into the repo.

## 3. Standard (ratification statement)

**Forgiveness built in** (Aaron, 2026-10-15): the system makes the PM's life easier.
- Nothing the PM does is final until they want it to be: every automatic step has a safe default and can be undone or changed later.
- Nothing blocks the PM on something the system could have handled.


MeetingGraph v2 turns each meeting into a short list of what matters (commitments, decisions, open questions, risks and updates), each tied to the statement that supports it. It assembles those items across meetings into threads, and writes the team email and the leadership report from them.

One chat round per meeting is the norm. The size of the reply depends on what happened in the meeting, not on how long it lasted. Each item is checked on its own:
- an item whose source can't be confirmed is kept, marked, and left out of reports until a person checks it;
- only an unreadable reply, or a reply for the wrong meeting, goes back to the chat.

## 4. Design

### 4.1 The request

**The contract is F's** (`tests/v2-feasibility/request-F-followup.txt`, §6.2, §10.1). A first meeting is F with no open threads, which is D (`request-D-lines.txt`). This section describes the first slim draft, B, as it was tested; B and C were superseded by D and E (§5.8). The instructions are about 3,000 characters; v1's are about 20,000.

- **Item kinds:** commitment, decision, question, risk, update. "Maybe I could" is not a commitment, and an option discussed is not a decision.
- **Final state only:** where the meeting changes its mind (a reversed decision, a moved date, a handed-over owner, something pending that came through), the item is the final state, cited where it was settled.
- **Fields:** kind, topic, who, what, due (as said, not converted), importance (high or normal), thread, seg, and words (3–10 exact words from that statement).
- **At most 40 items, plus:**
  - a 3–5 sentence summary;
  - `lastSeg`, the number of the meeting's final statement, as a cheap check that the model read to the end.
- **Open threads** from earlier meetings are listed in the request, one line each, so the model links new items to them in the same round. A seed meeting has none.
- **Variant C sends the meeting as an attachment** instead of pasting it (§5.2).

### 4.2 Checking, item by item

| Source check | Meaning | Treatment |
|---|---|---|
| verified | The words are in the cited statement | Used |
| near | The words are within 2 statements of the one cited | Used, with the statement corrected |
| misplaced | The words are elsewhere in the meeting | Kept, marked "to check", left out of reports |
| not found | The words are not in the meeting | Kept, marked "to check", left out of reports |

Only two things send the reply back: no JSON that parses, or the wrong context token. That is the second round, and it should be rare.

### 4.3 Threads

- **Each new item mints its own thread** (superseded: this first said "items that share a topic become a thread"). The topic only groups threads for display (§10.2, §10.4).
- **In later meetings**, the request lists the open threads and the model links each item to one or none. The person confirms or changes the links in the review before saving.
- **A thread shows:** its items in meeting order, what's still open, who committed to what, and what changed since the last meeting.
- **Tasks are one view of the threads** (the commitments), not the model everyone has to buy into.

### 4.4 Reports: the PM's formats stay

**v2 changes the import, not the email** (the PM, 2026-10-15). The team email keeps v1's seven sections and their wording rules (§13 and §15 of the v1 plan):
1. Meeting Overview
2. Executive Summary
3. New actions from this meeting
4. Existing items updated or referenced
5. Existing open items not discussed
6. Risks, dependencies and open questions
7. Conclusion

Each section is filled from the slim reply's items, locally, with no extra chat round:

| Section | Comes from |
|---|---|
| 2 Executive Summary | Built locally as in v1 §13: who took on what, what has no owner, decisions, what's still open, Next up |
| 3 New actions | Commitments with no thread; the board assigns their IDs on accept |
| 4 Existing items updated | Items linked to an existing thread (later meetings) |
| 5 Open items not discussed | Open threads with no item this meeting, computed locally |
| 6 Risks and open questions | Risks and questions |
| 7 Conclusion | Counts |

**Only checked items appear.** Items still to check are listed at the end for the PM and are not sent.

**The leadership email keeps the PM's own format too** (received 2026-10-15; the dates and action IDs as drafted are fine, per the PM). Its sections:
- the executive summary, then each project's new work;
- Key developments;
- Decisions;
- Management attention/risks;
- Near-term next steps;
- Project task status and accountable owners.

It is built from the **board**, across all projects, not from one meeting: overdue items, "waiting on", items with no accountable owner, projects not discussed yet, and the status table. So v2 keeps a **task register under the threads**: each action has an owner, a status, a due date and what it waits on. The model doesn't maintain the register. Its items update it, and the person confirms the updates in the review. The exception is a sourced "done" from the chat, which applies by default and can be undone with one click (B8, §10.6).

**Three gaps to close before build** (the follow-up meeting test, §6). **All three are closed:** status and waits-on by F (§6.5), dates by §10.10.
- **Status.** An item stating that work is done or blocked must update the action, so the reply needs a status on items linked to a thread.
- **Waiting on.** "Blocked on BL-202" needs a link from one action to another; the slim reply has none yet.
- **Dates.** The slim reply keeps due dates as said ("by Friday"), which the PM accepts. "Overdue by 7 days" still needs a calendar date: resolve simple phrases locally, and leave the rest as said and out of the overdue count.

`render_reports.py` drafts both emails from any slim reply. Its drafts from the golden reply (`golden-reply.team-email.txt`, `golden-reply.leadership.txt`) are the samples for the PM (§5.3).

### 4.5 What v2 keeps and drops

- **Keeps from v1:**
  - the paste-in / paste-back loop;
  - reading the Teams header and numbering statements;
  - the context token;
  - the team folder as source of truth;
  - checking sources against the transcript (now per item);
  - "place and label, don't block" (the D-UX12 standard, applied per item);
  - A1, a reviewer's note is never meeting evidence;
  - A2, nothing is overwritten.
- **Drops from v1:**
  - per-statement dispositions, register coverage and selfReview;
  - the op vocabulary (NewTasking, Reassign, Deadline…) in the reply: items update the register instead;
  - the model checking every register item for coverage;
  - the repair loop as a routine step;
  - the label and resolution machinery of §16, which is replaced by thread review.
- **What it gives up:** the provable correctness of a ledger. The bet is that threads with checked sources, plus a person confirming links, are enough for this team. The PM's doubt about the task model suggests they are. §5.3 tests that.

## 5. Feasibility test (test before build)

### 5.1 The kit (`tests/v2-feasibility/`, built 2026-10-14)

- **`mock-seed-meeting-2026-10-19.txt`.** A fictional 60-minute Teams transcript: the "Harbor Point reopening kickoff", 7 people, 471 statements. It includes:
  - rambling stories, side talk and audio problems;
  - a late joiner and an early leaver;
  - recaps that restate items, one of them wrong and then corrected;
  - a decision made after the goodbyes.
- **`key-items.json`.** 29 key items (11 of high importance) and 9 traps, each anchored to an exact phrase.
  - **Stale traps (5):** a reversed decision (vinyl signs for everything), a moved date (open house on the 9th), a handed-over owner (Tom's keycard list), something pending that came through (the elevator), and an installment hold that became unnecessary.
  - **Other traps (4):** a parked idea, "I guess that falls to me" (not a commitment), a declined offer, and the parking lot, which is not this project.
- **`make_kit.py`.** Builds the three requests from the same statement numbering, plus the golden reply.
- **`check_reply.py`.** Parses each reply, checks the sources, and scores it against the key. It converts current-contract replies so A, B and C are scored alike.
  - Self-test: 19/19.
  - Knockouts (`knock_check.py`): 10 of 10 killed.
  - Both run in `python3 run_tests.py unit`.
- **`render_reports.py`.** Drafts the team email, in the PM's format, from a reply.

### 5.2 Runs (Aaron, gpt-5.6-terra-low, a fresh chat for each)

| Variant | What goes into the chat | Runs |
|---|---|---|
| A, the current contract | `request-A-current.txt` (76,207 characters) | 3 |
| B, slim and pasted | `request-B-paste.txt` (60,672 characters) | 3 |
| C, slim and attached | `request-C-attach.txt` (3,039 characters) plus the attachment `meeting-2026-10-19.txt` | 3 |
| D, as B with one entry per line (§5.8) | `request-D-lines.txt` | 3 |
| E, as C with one entry per line (§5.8) | `request-E-lines-attach.txt` plus the attachment | 3 |

**As run:** A once (A1, §5.7), B once (B1, §5.8), D three times (§5.10). C and E were never run. The steps are in `tests/v2-feasibility/README.md`. A is the baseline: it shows whether v1 fails on a long meeting for the reasons in §1. C tests whether the chat reads a whole attachment or only parts it retrieves. Recall by third (criterion 6) and `lastSeg` (criterion 7) catch partial reading.

### 5.3 Desirability (the PM decides)

The email's format is the PM's and does not change (§4.4). The question is whether the import gets the content right.
1. **Now, before any run:** Aaron shows the PM the sample email made from the golden reply, in their format, and asks:
   - is this what they'd expect from that meeting;
   - what's missing;
   - what's noise.
2. **After the runs:** the same question on the email from the best run (B or C as planned; D as run), with its real flaws.

### 5.4 Pass criteria (per run; proposed thresholds, to ratify)

| # | Criterion | Pass if |
|---|---|---|
| 1 | One round: the reply parses and carries the right context token | Every run |
| 2 | Sources: items verified or near | At least 90% |
| 3 | High-importance recall | At least 9 of 11 |
| 4 | Overall recall | At least 21 of 29 |
| 5 | No stale item (reversed, moved, handed over, or come through) | 0 |
| 6 | Recall in each third of the meeting | At least 60% |
| 7 | `lastSeg` names the final statement (the slim variants: B–E as planned, D as run) | Every run |
| 8 | The PM would send the email from the best run (§5.3) | Yes |

**As planned: v2 passes when B or C meets criteria 1–7 in 3 of 3 runs and the PM says yes.** If only B passes, v2 is built on pasting. If only C passes, it is built on attachments.

**As applied:** D and E replaced B and C, which differ only in the reply format (§5.8). D met the criteria with these thresholds (§5.10), so they are applied as written. v2 is built on pasting; attachments (C, E) were never tested.

The checker's matching is heuristic. Each run prints the items that match no key, and Aaron reviews that list by hand: each one is noise, or a key item the checker missed.

### 5.5 Stop rule (set in advance)

- If no slim variant parses in one round in 3 of 3 runs, stop: the chat can't hold even the slim contract for a 60-minute meeting. (Written as "B or C"; D and E replaced them, §5.8.)
- If either variant parses but has stale items in 2 or more runs, stop for the same reason. That means the model can't keep track of final state, and no wording will fix it.
- If the PM wouldn't send the email from the best run, stop: the import is not getting the content right.
- Add no prompt exceptions to rescue a failing variant. A change to the request is a new variant and gets 3 new runs.

### 5.6 Diagnosis from the PM's run (no content needed)

Ask the PM for:
- the finding codes shown;
- the number of statements;
- the size of the request they pasted and of the reply;
- whether the chat accepted the paste;
- whether the reply stopped early.

This confirms or corrects §1 without anyone seeing the meeting.

### 5.7 First run: A1 (Aaron, 2026-10-15)

**The content is good.**
- The 76,207-character paste went through.
- The first reply has 20 tasks, 3 decisions and 7 flags.
- Scored against the key (`check_reply.py`): recall 25 of 29, high importance 9 of 11, every quote verbatim (23 of 23), no stale item.
- The model kept final state: the elevator task is created and completed, the open house is on the 16th, signage is the reversed decision, and the keycard list is Pete's.
- It resolved "by Friday" to 2026-10-23 and January 16 to 2027.

**The contract is what fails.**
- **The model shortcut the per-statement table.** It wrote 29 rows, 27 of them ranges ("S026-S035"), instead of 471.
- **The workbench refuses the reply:** 2 errors, 29 must-fix items and 64 coverage findings.
- **Half the must-fix items come from that one shortcut.** The owner, decision and person checks read the per-statement classifications, so all 15 owners fail ("cites no commitment by …"). With the ranges expanded to one row per statement, the must-fix count drops from 29 to 15, and the owner failures from 15 to 2.
- **The repair prompt is therefore wrong as well as impossible.** It asks the model to remove 15 correct owners and to write 471 rows.
- **The model says the full reply can't be done.** Asked for the full JSON, it replied: "The transcript is too large to regenerate as one mechanically compliant JSON object within a single response", and offered four partial sections. This matches the PM's experience: stuck after two repairs.

**The Part C questions also break A1.**
- Questions answered in the chat came back as partial replies, not the full JSON.
- Reviewer answers were filed as transcript evidence. The volunteer contact went to Tom, citing Rana's "Don't put me down yet."

v2 keeps answers out of the chat: the slim request asks no questions, and people settle items on the board.

**Consequence for the runs.** A1 already shows how A fails. A2 and A3 would only repeat it, so B1 is the next run.

### 5.8 B1 (Aaron, 2026-10-15): the content is right, the delivery fails

**What came back.**
- One 5,757-character line with no code block, stopping mid-item. Aaron tried B twice more in new chats, and both came back malformed.
- The complete part is good: 18 items, all 18 quotes verbatim, 16 key items found, no traps hit, and `lastSeg` = S471, so the model read to the end.
- The items are in topic order, so the cut fell mostly on the last third of the meeting (2 of 10 key items found there).

**Cause.** The model was not out of room: A1's first reply arrived complete at about 30,000 characters, inside a code block over many lines. What failed is delivering one very long line.

**The fix is structural (variants D and E):**
- one JSON object per line, in meeting order;
- an end line that gives the number of items.

A cut then loses only the lines after it. The missing end line shows the reply is incomplete, so a short "continue from S###" request can recover the rest.

**The checker now treats a cut reply the way v2 will.** It keeps the complete items and scores them, but criterion 1 fails, because a cut reply needs another round. D and E replace B and C, which change only in their reply format; the instructions are otherwise identical.

### 5.9 D1 (Aaron, 2026-10-15): first pass

**The reply is complete:** 38 lines, the end line agrees (36 items), 10,515 characters, one round, nothing answered in the chat.

**Criteria 1–7 all pass:**
- recall 28 of 29, high importance 10 of 11;
- 36 of 36 quotes verbatim;
- no trap hit;
- every third of the meeting covered (7/7, 11/12, 10/10);
- `lastSeg` right.

**The model kept every final state:**
- tactile room signs, vinyl only for wayfinding;
- the open house on January 16, not the 9th;
- the keycard list is Pete's;
- the elevator is cleared;
- the installment is due on delivery, with no hold;
- the volunteer contact is still open, and is not given to Rana.

**Read by hand, three weaknesses:**
1. **One miss:** the signage overrun figure ($23,500 against $18,000). Ken's contingency item mentions "the signage overage", but not the amount.
2. **Two duplicate actions.** The fire marshal call appears twice (S032 "this week", S386 "today"), and the keycard list twice (S104 the list, S467 the access levels). In the PM's email each becomes two action IDs.
3. **"high" is over-used:** 25 of 36 items, against 11 in the key. That would crowd the leadership email.

**Proposed handling (structural, for the build):**
- **Duplicates.** The review groups actions with the same owner and topic, and offers to merge them. Merging is the default when their statements are within the same discussion.
- **Importance.** The leadership email uses the PM's sections, not the model's "high" alone: decisions, risks, items with no owner and dated next steps. "high" only orders items within a section.

Neither handling changes the request. **Both are now superseded:** importance by Aaron's decision (§8.4), and duplicates by §10.4 (no automatic merging; a manual "Same as…").

**Still to run:** D2 and D3, to meet the 3-of-3 rule. E1 only if pasting is a burden for the PM: D shows the pasted meeting fits.

### 5.10 D2 and D3 (Aaron, 2026-10-15), and the PM's verdict

**Scores after the checker fixes below:**

| Run | 1 complete | 2 sources | 3 high recall | 4 recall | 5 stale | 6 thirds | 7 last statement |
|---|---|---|---|---|---|---|---|
| D1 | pass | 36/36 | 10/11 | 28/29 | none | 7/7, 11/12, 10/10 | pass |
| D2 | **fail as written:** the end line says 30, and 31 items arrived | 31/31 | 10/11 | 28/29 | none | 7/7, 11/12, 10/10 | pass |
| D3 | pass | 34/34 | 10/11 | 28/29 | none | 7/7, 11/12, 10/10 | pass |

- **All three runs miss the same item:** the signage overrun figure ($23,500 against $18,000). The model records "the signage overage" under Ken's contingency check, but never the amount.
- **The PM on the D1 emails:** "looks good" (criterion 8).

**Checker fixes made after reading the runs.** Each was a checker error against correct model output, and each now has a self-test (29/29; knockouts 13 of 13 killed).
1. **T6 (elevator) fired on a valid commitment.** D2's "Forward the elevator certification to Grace" (S351) comes after the certificate arrived. T6 now fires only when the elevator is treated as pending.
2. **T4 (keycards) fired on a valid commitment.** D3's "Send Pete the existing keycard access names" (S413) is Tom sending names, not owning the list. T4 now ignores sending names.
3. **K02 (the opening target) matched the mural question** through the keyword "open" ("still open"), in all three runs.
   - The keyword is now "opening".
   - Tom's two statements of the same dependency (S026 and S438) are now anchors, because the runs cite them.
   - Before this fix, the mural question took K02, the mural commitment took K06, and D2 showed K19 as missed.

Before the fixes, D2 and D3 failed criterion 5, and D2's recall read 27 of 29. After them, every run is at 28 of 29, and the right items match the right keys.

**Criterion 1 when the end line miscounts: amended, ratified by Aaron 2026-10-15.** D2's reply is complete: every line is there, and so is the end line. Only the count is wrong, 30 for 31 items. The end line exists to show a cut, so:
- at least as many item lines as the end line says: complete (a miscount is noted);
- fewer item lines than the end line says: cut;
- no end line: cut.

| | Criterion 1 for D2 | D overall |
|---|---|---|
| Rule as written | Fails | Meets 1–7 in 2 of 3 runs |
| Proposed amendment | Passes | Meets 1–7 in 3 of 3 runs; with the PM's yes, §5.4 passes |

This changes a scoring rule after seeing the results, so it was Aaron's call. He accepted it.

**Result: the seed-meeting test passes.** D meets criteria 1–7 in 3 of 3 runs, and the PM said yes (criterion 8). The follow-up meeting test (§6) comes next.

## 6. The follow-up meeting (kit built 2026-10-15; passed 3 of 3, §6.5)

### 6.1 What it tests

**Whether the import keeps the board up to date across meetings, in the same single round:**
- reporting on the open threads;
- closing only what was finished;
- recording what is blocked;
- linking work that waits on other work.

Those are what the PM's leadership email needs: status, "waiting on", no owner and overdue (§4.4).

### 6.2 The kit

- **`mock-followup-meeting-2026-10-26.txt`.** The weekly meeting a week after the seed: 381 statements, about 5,800 words, 60 minutes, with the usual side talk.
  - It is lighter than the seed meeting (471 statements, about 8,000 words), but has more to keep track of: 26 open threads.
- **`board-after-seed.json`.** The board as the PM would have accepted it from the seed meeting: 15 actions (AI-101 to AI-115), 3 open questions, 3 risks and 5 decisions. The request lists them as OPEN THREADS.
- **`request-F-followup.txt` (50,999 characters).** D's request and one-entry-per-line format, plus:
  - the open threads, one line each;
  - `ref` (N1, N2…), so items can point to each other;
  - `thread`: the open thread an item reports on, or null for new work;
  - `status`: done, blocked, in_progress or null. "Done" only when someone says it is finished; never for planned, partly done, drafted-but-held or undiscussed work;
  - `waitsOn`: what an item can't finish without, when a speaker says so;
  - at most 60 items, up from 40: this meeting has 37 key items.
- **`key-followup.json`.** 37 key items (10 of high importance) and 6 traps. Each key gives the right thread, the right status and, for two of them, what the item waits on.
  - **16 status changes:** 14 done, plus "in progress" (the half-done website) and "blocked" (keycards, waiting on HR).
  - **Not done, and must stay open:** the winter schedule (drafted, held), the website (half done), the training (moved, not done) and the pickup map (mentioned but not started).
  - **Final state within the meeting:** Party Plus chosen, then replaced by Event Rentals; the fiber date moved to January 6, then to December 21; the volunteer role moved from Rana to Abena.
  - **A look-alike:** the open house photographer is new work, not the website photos (AI-110).
  - **Waits-on:** the sign order waits on Tom's room list; the training waits on Pete's laptops.
  - **Parked ideas:** a signal booster, and cancelling part of the furniture order.
- **The checker** scores replies to both meetings, choosing by the context token.
  - Self-test 44/44, including 14 follow-up cases.
  - Knockouts 19 of 19 killed.
  - The seed scores are unchanged.

### 6.3 Runs (Aaron)

F1–F3: a fresh chat each, paste all of `request-F-followup.txt`, and save the reply as `runs/F1.txt` … `runs/F3.txt`. Nothing is answered in the chat.

### 6.4 Pass criteria (per run; proposed, to ratify)

| # | Criterion | Pass if |
|---|---|---|
| 1 | Complete, with the right context (the §5.10 end-line rule) | Every run |
| 2 | Sources: items verified or near | At least 90% |
| 3 | High-importance recall | At least 8 of 10 |
| 4 | Overall recall | At least 26 of 37 |
| 5 | Threads: found items on the right open thread, or correctly new | At least 90% |
| 6 | Status: found status changes right | At least 80% (13 of 16) |
| 7 | No false "done", no stale item, no item filed on a look-alike thread | 0 |
| 8 | `lastSeg` names the final statement | Every run |

**Why criterion 7 is zero:** a false "done" is the worst error for the PM. The board and the leadership email would show unfinished work as finished.

**Waits-on is reported, not scored.** Under forgiveness (§3), the PM can add a missing link in the review. A wrong link counts as a field error.

**The follow-up test passes when F meets 1–8 in 3 of 3 runs.**

**Stop rule:** false closures in 2 or more runs mean the model can't be trusted with status. Status would then come only from the PM's review, never from the chat. That is a design change, not a prompt fix.

### 6.5 F1–F3 (Aaron, 2026-10-15): the follow-up test passes

| | F1 | F2 | F3 |
|---|---|---|---|
| 1 complete, one round | pass | pass | pass |
| 2 sources | 43/43 | 43/43 | 45/45 |
| 3 high recall | 10/10 | 10/10 | 10/10 |
| 4 recall | 32/37 | 33/37 | 34/37 |
| 5 right thread, or new | 32/32 | 33/33 | 34/34 |
| 6 status | 13/13 | 14/14 | 15/15 |
| 7 false "done", stale, look-alike | none | none | none |
| 8 last statement | pass | pass | pass |

**F meets criteria 1–8 in 3 of 3 runs, so the follow-up test passes.** (F1 was first saved as `runs/F1.tex` and has since been renamed `runs/F1.txt`.)

**Closures, counted directly across all items:**
- Every run closed every settled thread except AI-111 (Tom's architect check), which each run folded into the mural decision (Q-2).
- Nothing was closed wrongly in any run.
- The three partial statuses were right in every run: the website in progress, the keycard list blocked, the winter schedule in progress.

**Waits-on:**
- The sign order waiting on Tom's room list: right in 3 of 3.
- The training waiting on Pete's laptops: right in 1 of 3.

**Questions.** The community-room naming question was caught in every run, as a question item. The chat asks the reviewer nothing; where questions go instead is §10.4.

**Scoring artifacts, not model misses:**
- The rental-quote closure (AI-107) sits on the rental decision's item, so F06 shows as missed in F1 and F2.
- In F1 the hearing-loop closure (AI-112) sits on a neighbouring item, so F16 shows as missed.

**Repeated real misses:**
- Grace's own "I'll review the press release by Wednesday" (F22);
- the sprinkler pressure test (F37);
- the architect check (F17).

**Unmatched items** are almost all real but small commitments: the hood certificate, weekly supplier calls, the photo notice at the door, the air filters. They are not noise.

## 7. What happens to v1

- **Frozen.** The build stays at the hand-off hash. No new §16 sections are built while v2 is tested.
- **v1's open items** (§16.18, open-question wording, the confirmation run, person items) are parked. If v2 passes, they are dropped with v1's register model. If v2 fails, they come back.
- **Reused if v2 is built:** Teams header parsing, statement numbering, the context token, the team-folder save, and the record principles A1 and A2.

## 8. Decisions for Aaron (feasibility phase; all settled)

1. **The standard (§3) and the pass criteria (§5.4, §6.4):** applied as written, with one amendment ratified by Aaron (the end-line rule, §5.10).
2. **Run A as a baseline:** done (A1, §5.7).
3. **Show the PM the sample email:** done. The PM said "looks good" (§5.10).
4. **Importance ("high"):** decided by Aaron, 2026-10-15. The leadership email does not include every "high" item, because the chat over-tags (25 of 36 in D1, where the key has 11). It picks items by board facts, as the PM's format does: decisions, risks, no owner, overdue, next steps. "high" only orders items within a section.
5. **v1's open items:** parked (§7). v1 for the PM in the meantime: §10.12.
6. **The leadership report format:** received 2026-10-15 (§4.4).

The build decisions are in §10.13.

## 9. Limits

- **One author.** The mock meeting, its key and the slim request were all written by the same author (Claude), which can bias the test toward the request. The PM's real meetings are the true test. Their diagnosis (§5.6) and their verdict on the email (§5.3) are the checks against that bias.
- **One scenario.** A pass shows feasibility on one kind of meeting, not all.
- **Heuristic scoring.** The unmatched list needs a person's judgment on every run.
- **Attachments are untested.** C and E were never run, so nothing here shows whether the chat reads a whole attached meeting. v2 is built on pasting.

## 10. Build plan (ratified by Aaron 2026-10-15: B1–B16 as written, including B14a)

### 10.1 What the feasibility tests established

- **Seed meeting:** D passes 3 of 3, and the PM approved the emails (§5.10).
- **Follow-up meeting:** F passes 3 of 3 (§6.5).
- **The contract is settled:** F's request and one-entry-per-line format (open threads, `ref`, `thread`, `status`, `waitsOn`). A first meeting is F with no open threads; D is that case, already tested.
- **The build changes neither request.** Any change to them is a new variant, tested first.
- **The basis is thin.** Six passing runs, on two mock meetings by one author (§9). §10.8 puts a real meeting before the build.

**The rule that runs through this plan.** Only what the evidence supports is applied by default. Heuristics appear only as unticked suggestions, which the PM can ignore at no cost.

### 10.2 The data model and packages

**Entities**
- **Project:** an ID and a name.
- **Person:** an ID, a display name, and the Teams speaker labels and spoken names seen for them (§10.5).
- **Meeting:** an ID (the UTC start, as in v1: `20261019T140000Z`), the project, the title, and its numbered statements. The statements stay in the package so every source can be shown. The team folder already holds the transcripts in v1.
- **Item:** one line of a reply, as kept after review: kind, what, who (a person or none), the due date as said (plus its resolved date), the source (statement, words, check result), the importance, and, for follow-ups, `thread`, `status` and `waitsOn`.
- **Thread:** what the board tracks. Four kinds:
  - **action**, from a commitment;
  - **question**;
  - **risk**;
  - **decision**, which is settled when created and is never "open".

  Updates are not threads. An update attaches to the thread it reports on, or is recorded only as a meeting note. Every thread has a status history (open, in progress, blocked, done, not needed), and each entry names the item or the PM's decision behind it.
- **How they relate.**
  - A new commitment, question, risk or decision (thread null) **mints one thread**. The `topic` string is for display grouping only; it is never identity (§10.4 shows why).
  - An item with a thread adds to that thread's history, and its status, if any, changes the thread's status.

**IDs (B12, amended after the second review).** The page mints IDs at Save, and they never change afterwards. So the format must be unique across projects and years before anything is minted.
- **Format:** project code, kind letter, the meeting date with the year, and a number: `HP-A-261019-03` (action), `HP-Q-261019-01`, `HP-R-…`, `HP-D-…`.
  - The first draft, `A-1019-03`, collided: two projects meeting on Oct 19 both minted `A-1019-01`, and so did meetings a year apart.
- **The project code** (2–4 letters) is set when the project is created. The default comes from the name's initials, and the code must be unique in the workspace. Two projects given the same code on two machines show as a conflict at load, and the PM renames one.
- **Two meetings of one project on one day:** the second gets a letter, `HP-A-261019b-01`.
- **When a meeting is saved again (§10.3):**
  - the items it keeps keep their IDs, matched by kind and source statement, with ties (one statement, two items of one kind) broken by their order within the reply;
  - new items take the next free numbers;
  - a dropped ID is never reused.
- The request and both emails use these IDs.

**Packages** (the team folder is the source of truth; the browser keeps a copy):
- **Files** start `mkg2-` (v1's start `mkg-`), so both can sit in the same folder.
- **Every package has:** `"mkg2": "1.0"`, its kind, its ID, `savedAt`, `savedBy`, and `supersedes` (the package it replaces, or null).
- **Meeting package:** the meeting, the request's context token and its open-thread list, the reply's items as checked, the PM's review choices, and the threads minted.
- **Board package:** one PM decision on the board (§10.6), with the PM's name and note.
- **The board is the replay of every package that nothing supersedes,** in meeting order (§10.3).

### 10.3 Re-import, corrections, ordering and conflicts

| Case | Rule |
|---|---|
| The same meeting saved again | The new package names the old one in `supersedes`. The old one stays in the history (A2). IDs follow §10.2. |
| A correction after Save | "Review this meeting again" reopens its review with the saved choices. Saving again supersedes the old package. Corrections stay tied to the meeting's evidence. |
| Meetings imported out of order | The replay goes by meeting time, not by the time a package was saved. A late-imported earlier meeting takes its place in time; where two meetings set the same thread's status, the later meeting wins. |
| A reply that names a thread unknown when it was made | Checked against the open-thread list stored with that meeting's request. Unknown means new work (§10.6, step 3). |
| Two people save the same meeting | Two packages for one meeting, and neither supersedes the other: a **conflict** (B16). The board uses the first-saved package (by `savedAt`, then package ID), marks the conflict, and shows both side by side. The PM can switch to the other, which then supersedes. Nothing blocks the board (§3). The alternative, using neither until the PM chooses, is safer but blocks; to ratify consciously. |
| Board decisions referring to a superseded meeting's IDs | They keep working for the IDs the new package keeps. Any whose ID was dropped is shown as needing a new link. |
| A later meeting's items reporting on an ID that a re-saved meeting dropped | The same rule, and the more common case after "Review this meeting again". The item is shown as needing a new link, both on the board and in that later meeting's "Review this meeting again". It is never silently orphaned. |
| An earlier meeting imported after a later one | The later meeting's request never listed the earlier meeting's threads, so the same work can appear twice: once from each meeting. With no merge suggestions (B5), nothing flags this automatically. The fix is "Same as…" in the later meeting's "Review this meeting again", and the page says so when an earlier meeting is imported late. |
| Two people make board decisions on the same thread | Both are kept. The later save applies, and the history shows both (as v1 §16.9). |

### 10.4 Duplicates and related actions: what the evidence allows

**Duplicates (B5, changed by the evidence).** I proposed merging same-owner, same-topic actions by default. The six runs don't support it:
- **The two real duplicates sit 354 and 363 statements apart.** The second copy is a restatement late in the meeting (D1's fire marshal call, and the keycard list in D1–D3). A "same discussion, within N statements" rule cannot catch them.
- **Same owner and same topic pairs up 14 items in all, of which only 4 are duplicates.** The other 10 are distinct work: Luis's hood certificate and his filters, Rana's booking and her quote for Ken.
- **No word-overlap threshold separates the two groups** (true pairs score 0.44 and 0.20; nine distinct pairs fall between them).
- A wrong merge loses work. A missed duplicate costs one extra line in an email.

**So:** no automatic merging and no merge suggestions. Each action in the review has "Same as…" (pick another action from this meeting or an open thread). The test is deterministic: the PM merges D1's two fire marshal calls, and the email shows one action.

**Related actions when a question is settled (B2).** When a meeting settles a question, the review offers to close the open actions related to it. "Related" means the same topic string as the question, or a source within 15 statements of the question's source. Either is enough, and both are heuristics, so the offer is **unticked**.

AI-111 is the case. The review was right to ask whether the key is wrong there:
- Tom finished AI-111 ("I did. The drawings show…", S169), and none of the three runs closed it: each folded it into the mural decision (Q-2).
- In this model AI-111 is related to Q-2 (both came from the seed meeting's mural discussion), so the review offers to close Tom's architect action too.
- The key stays as it is: AI-111 really was done in the meeting. But acceptance criterion 2 tests the offer, not the model.

### 10.5 People (B10): matched locally, no contract change

**The evidence:** in the six D and F runs, every one of 232 `who` values was a Teams speaker label exactly as written ("Kowalski, Pete"), because the request asks for that. The variants the review warns about ("Pete", "Pete Alvarez") didn't appear in the mock runs.
- Real Teams labels do vary: "(Guest)", phone numbers, external organizations.
- People named but not present (HR, the director) come back as `who` null, with the name in the text.

**So, matched locally:**
- The page keeps a people list built from the speaker labels of saved meetings.
- A `who` that matches a known label is that person.
- A new label, or a `who` that isn't a speaker label, is a review choice: "Kowalski, Pete (Guest)" → "Is this Pete Kowalski?" (match / new person / no owner), with the closest known person suggested.
- The PM's answer is stored as an alias, so it is asked once.

This needs no change to the request. The real-meeting step (§10.8, step 0) shows whether real labels hold up. If they don't, a people list in the request is the fallback, as a new variant with 3 runs.

### 10.6 The page

**1. Meeting in.**
- Open the Teams .docx. The title, date and time are read from its header, as in v1.
- Choose the project. The default is the project of the last meeting with that title.
- **Other projects discussed (B13):** tick any; the default is the previous meeting's ticks. Their open threads go into the request too.
- The statements are numbered automatically.

**2. One request.**
- "Copy for the chat" copies F's request with the open threads of the ticked projects.
- Threads that are done, not needed or parked are left out (§10.7).

**3. Reply in.** It is checked item by item, using `check_reply.py`'s rules ported to a JS module.
- **Sources:**
  - verified or near: used, with the statement corrected when near;
  - misplaced or not found: kept, marked "to check", left out of the emails until the PM confirms.
- **An unknown thread, or a status without a thread:** becomes new work with no status, shown.
- **Only two things stop the import:**
  - the wrong context token;
  - nothing readable.
- **A cut reply keeps every complete line.** "Ask the chat to continue" (B6) comes only after a test.

**4. Review.** One screen of plain sentences, every choice pre-set.
- **The order:**
  1. **closures from the chat**, first (B8);
  2. other updates to open threads;
  3. new actions;
  4. decisions;
  5. open questions;
  6. risks;
  7. "to check".
- **Closures from the chat (B8) apply by default**, each with a one-click undo, but only when the item's source is verified or near. A "done" whose source is "to check" is not applied until the PM confirms it.
  - This changes v1's ratified rule (§16.16, condition 1: every closure needs the reviewer's tick). The reason: F had no false "done" in 3 runs. The PM sees every closure first and can undo it.
  - The basis is thin (one author's mock meetings), and step 0 (§10.8) is the first check on a real meeting.
- **Unticked suggestions:** related closures (§10.4) and people matches (§10.5).
- **Per item:** "Same as…" (§10.4), change the thread (another open thread, or "new work"), change the owner, the date or the importance.
- **The speaker's words are one click away.**
- **Save** writes one meeting package (§10.2). "Review this meeting again" is available afterwards (§10.3).

**5. The board: read-only except four bounded decisions (B9).** See §10.9 for why this departs from the §16.16 pause, and the bounds.

**6. The emails, in the PM's formats** (§4.4), built locally from the board:
- the meeting email: his seven sections;
- the leadership email: his format, with items picked by board facts (§8.4);
- overdue counts only dates that resolve (§10.10);
- items still "to check" are listed for the PM and not sent.

### 10.7 Threads that are never discussed (B11)

A thread nobody discusses would stay in every request for ever.
- **Rule:** an open thread that no meeting has mentioned in its last 3 meetings of the project is **parked**. A mention in any meeting counts, including another project's meeting whose request listed the thread (B13), and resets the count. It leaves the request, but stays on the board in a "Parked" list and in the leadership email under "Management attention" ("not discussed in 3 meetings"), as v1 already reports "not discussed in any meeting yet".
- **It comes back** when the PM raises it for the next meeting (§10.9), or when a meeting mentions it anyway; the review can link an item to a parked thread.
- **The PM can also mark it "Not needed".**
- **The request's size is then bounded by active work.** The cap of 60 items per reply is unaffected.

### 10.8 Sequencing: a real meeting first

0. **The real-meeting slice (B14), before the rest of the build.**
   - **The page:**
     1. it opens a real .docx and numbers it;
     2. it writes F's request with no open threads (D's case);
     3. it takes the pasted reply and checks it item by item.
   - **On screen:** the items, the sources and the meeting email in his format.
   - **A content-free summary, counts only,** that the PM can send Aaron without sharing the meeting. It holds no names, quotes or titles:
     - statement count, request size and reply size;
     - whether the end line arrived and `lastSeg` is right;
     - the number of items by kind;
     - sources verified, near, misplaced and not found;
     - the **number** of `who` values that aren't speaker labels (never the values themselves);
     - the PM's own verdict: would he send the email?

     This is also §5.6's diagnosis.
   - **It saves `mkg2-` meeting packages** (§10.2), with the numbered statements, the reply as checked and the IDs minted (so B12 is settled first). The PM will run real meetings through the slice for weeks before the board exists (B15). Without saving, that work would be lost and the chats re-run. With it, the full build replays the packages, and "Review this meeting again" opens them.
   - **Follow-up meetings in the slice (B14a).** Recommended: from the second meeting on, the slice replays its own saved packages and lists their open threads in the request. That is step 1's replay module, with no board view and no board decisions. Follow-ups then link and close threads as in F, and the email's sections 4 and 5 are filled.
   - **The limit, if B14a is not taken:** every slice meeting is treated as a first meeting. Sections 4 and 5 of the email are empty for follow-ups, and work that continues from week to week appears as new threads each time, to be joined with "Same as…" when the full build replays them.
   - **If D holds on a real meeting,** build the rest. If not, the build is saved.
   - **It is small:** the docx reader, the numbering and the reply checks are the first modules of step 1 anyway.
   - **Built 2026-10-15:** `dist/MeetingGraph2.html` (sha256 `02e73314`), from `src/v2/` by `build.py`.
     - **Modules:** `transcript.js`, `request.js`, `reply.js`, `store.js`, `email.js`, `summary.js`.
     - **Tests:** `tests/v2/unit/v2test.js` 57/57; knockouts (`tests/v2/knock_v2.py`) 24 of 24 killed; browser (`tests/v2/e2e_slice.py`) 23/23.
     - **Fixed after the first real meeting (2026-10-15):** the source check compares words in order, ignoring punctuation and case. The chat had quoted "the 2nd. Is" as "the 2nd is", and the item was marked "to check". The check now matches whole words only. D1–D3 and F1–F3 still verify every source.
     - **The requests are the tested ones, byte for byte:** request D for the mock seed meeting, and request F for the follow-up on the mock board, both in the unit tests and through the page.
     - **The tested runs (D1–D3, F1–F3, B1, A1) read as in the kit.** F2's statuses land on the right threads.
     - **Limits of the slice, by design:**
       - **There is no review screen.** The chat's sourced closures apply at Save with no undo; saving the meeting again (after a new reply) replaces them.
       - **People are not matched (B10).** Owners show as speaker labels, turned round ("Tom Lindqvist").
       - **No parking, board view or board decisions.**
       - **The .docx reader is v1's,** tested here on a generated .docx rather than a real Teams export.
       - **The browser tests run in Chromium,** which Edge is built on; the page has not yet been opened in Edge itself.
1. **Modules, with Node tests and knockouts:**
   - the reply checks;
   - the request builder;
   - packages and the replay (§10.2–10.3);
   - people matching;
   - the date resolver;
   - related-closure suggestions;
   - parking.
2. **The page:** meeting in, request, reply, review, save, review again.
3. **The board:** the view and the four bounded decisions.
4. **The emails.**
5. **End-to-end tests** (§10.11), the first-time user session, and the first build hash.

### 10.9 Board decisions, and the §16.16 pause (B9)

**The tension.** On Oct 14 (§16.16), board actions were paused because users asked for "an edit button everywhere", which leads to rebuilding Jira. Work is to be settled in meetings, with the transcript as evidence. The forgiveness standard (§3) pulls the other way: the PM must not be stuck with a wrong board.

**The balance: correct and settle what meetings produced, never create or plan work outside one.** Corrections belong with the meeting's evidence, so most of them move into the review (§10.6 step 4, and "Review this meeting again" in §10.3). The board itself is read-only except for four decisions, each a small board package with the PM's name and a required note, recorded as the PM's decision and never as meeting evidence (A1):

| Board decision | Bound |
|---|---|
| **Undo** a closure or a status, including a chat closure the PM missed in the review | Only reverses a status a meeting or an earlier PM decision set |
| **Not needed** (one or several, with a reason) | As v1 §16.17. Only on existing threads |
| **Settled outside a meeting**, with a note | Only on existing threads. Shown in both emails as "settled by <name> outside a meeting", never as a meeting result |
| **Raise for the next meeting** | Puts the thread at the top of the next request's open threads and on an agenda the PM can copy. It is the board's answer to "I need to change this" |

**Not on the board:**
- creating actions, questions or risks;
- editing what an action says;
- assigning or reassigning owners;
- setting or moving dates.

Wrong owners and dates are corrected in the meeting's review, as corrections of what the import heard. New owners, new dates and new work come from the next meeting ("Raise for the next meeting").

**The price, stated so nobody is surprised:** an owner or date that changes outside a meeting (a hallway handover, an email) shows the old value on the board and in both emails until the next meeting records it. "Raise for the next meeting" puts it on that meeting's agenda.

**This reverses part of the §16.16 pause.** It does so because v2's board has to stay correct between meetings without a chat round, and it is bounded so that the board can never become the place where work is created or planned. To ratify (B9).

### 10.10 Dates (B7)

The reply keeps dates as said, which the PM accepts.
- **Simple phrases are resolved against the meeting date:** weekdays, "next week", "end of next week", month and day, "today".
- **Vague phrases stay as said** ("early December") and don't count as overdue.
- **The resolved date shows next to the phrase.** The PM corrects a wrong resolution in the review (§10.9: dates are corrected there, not on the board).

### 10.11 Acceptance criteria

1. **Seed, end to end:** D1's reply → review with defaults → save → the board → both emails.
   - Merging D1's two fire marshal calls with "Same as…" gives one action.
   - Every choice changed and then undone gives the same package.
2. **Follow-up, end to end:** F2's reply on the board from (1).
   - Every status lands on the right thread, and its closures are listed first, applied.
   - No thread closes that F2 did not close.
   - Tom's architect action (AI-111 on the mock board; its minted ID depends on D1's item order) is offered for closing, unticked.
   - The "not discussed" section is right.
3. **Re-import and conflicts:** one test per row of §10.3.
4. **Board decisions:** each of the four works, can be undone, and shows as the PM's decision in both emails. Nothing on the board creates a thread, changes an owner or sets a date.
5. **Stops:** only the wrong context token and an unreadable reply stop the import. A cut reply keeps its complete items.
6. **The emails' sections match the PM's formats.** The format references are the two emails the PM sent on 2026-10-15, from Aaron's run on the mock Oct 1 meeting: v1 output, mock content. They are to be saved as `tests/v2-feasibility/formats/pm-meeting-email.txt` and `pm-leadership-email.txt`, with Aaron's approval. The content comes from v2's mock meetings (D1 for Oct 19, F2 for Oct 26). The section headings and their order must match.
7. **People:** a new speaker label is asked once, and the answer is reused in the next meeting.
8. **Parking:** a thread not mentioned in 3 meetings leaves the request and shows under "Management attention".
9. **Every module has unit tests and knockouts.** A knockout must make its named check fail, not crash it.
10. **A first-time user:** the PM processes a real meeting unaided, and says whether he'd send the emails.

### 10.12 v1 in the meantime (B15)

v1 cannot take a 60-minute meeting, and the §16.18 fix wouldn't change that. In A1, 18 of the 20 tasks carry a must-fix item, most of them caused by the per-statement table rather than by the task itself (§5.7). Leaving out the changes that carry errors would leave out almost the whole meeting.
- **Recommended:** tell the PM plainly now that v1 is not for 60-minute meetings, and that the step-0 slice (§10.8) is what he uses next.
- The slice also gives him the meeting email for one meeting, which is the part he needs most.

### 10.13 Decisions (ratified 2026-10-15 as written; B4 waits on the PM's answer)

| # | Decision | Recommended |
|---|---|---|
| B1 | A new page beside v1, or a fifth port onto v1 | A new page |
| B2 | Related closures (AI-111) ticked or not | Not ticked (§10.4) |
| B3 | One main project per meeting | Yes, with other projects ticked at meeting-in (B13) |
| B4 | v1 boards in use: start fresh, or convert | Ask the PM how much v1 data there is; if little, start fresh |
| B5 | Duplicates | **Changed by the evidence:** manual "Same as…", with no automatic merging and no suggestions (§10.4) |
| B6 | "Ask the chat to continue" | Only after a test on gpt-5.6-terra-low |
| B7 | Simple date phrases resolved locally | Yes (§10.10) |
| B8 | Chat closures apply by default, listed first with one-click undo, only when sourced | Yes. This changes §16.16 condition 1 (§10.6 step 4) |
| B9 | Board decisions: four, bounded; partly reverses the §16.16 pause | Yes (§10.9) |
| B10 | People matched locally to speaker labels, the review asking once | Yes; a people list in the request is the fallback (§10.5) |
| B11 | Threads not mentioned in 3 meetings are parked | Yes, N = 3 (§10.7) |
| B12 | The ID format `HP-A-261019-03` (project, kind, date with year, number), minted at Save | Yes (§10.2; amended: the first draft collided across projects and years) |
| B13 | Open threads of every ticked project go into the request | Yes (§10.6 step 1) |
| B14 | The real-meeting slice before the rest of the build: a counts-only summary, and saving `mkg2-` packages | Yes (§10.8 step 0; amended after the second review) |
| B14a | The slice replays its own packages and lists open threads for follow-up meetings | Yes. Otherwise follow-ups are treated as first meetings (§10.8 step 0) |
| B15 | Tell the PM now that v1 is not for 60-minute meetings | Yes (§10.12) |
| B16 | A conflict between two saves of one meeting | Use the first-saved package, mark the conflict, and let the PM switch: nothing blocks (§10.3) |

### 10.14 Seeding a board from one CSV (ratified by Aaron 2026-10-15: "we will call the CSV seed template good"; built, §10.18)

**Why.** The PM is unhappy with his v1 board and wants a fresh seed. v1's seed template is three columns (ID, Effort, and a free-text "Description-Status-Blockers"), and the chat then extracts work items from it in batches of rows. So the template holds no structured owners, dates, statuses or blockers, and seeding needs several chat rounds. This settles B4 as "start fresh, seeded from a CSV".

**The template** (`templates/`, written 2026-10-15):
- `mkg2-seed-template.csv` is blank.
- `mkg2-seed-example.csv` is the mock Harbor Point board.
- `mkg2-seed-guide.txt` is one page for the PM.

One row per thing, in any order. The columns are Type, Project, Title, Owner, Email, Teams name, Due, Status, Waiting on and Notes (amended 2026-10-15: no ID column, and an Email column). The rows:
- **Project:** the name. Its code is set on the page at import, defaulting to the initials.
- **Person:** full name, work email, and the name as Teams shows it (for B10).
  - The email is the most reliable key: Teams names vary, and attendance reports list emails.
  - It is sensitive. It stays in the seed file, the package and the team folder, and is never sent to the chat: requests use speaker names only.
- **Action:** owner, due date, status, and what it waits on, named by the other row's Title.
- **Question, Risk:** with an owner and a status.
- **Decision:** with the date decided.

**No chat round.** Every fact has its own column, so nothing is extracted.

**The import** (B17), in the step-0 page:
1. "Start a board from a spreadsheet": open the CSV, set "Board as of" (default today), and check the rows.
2. The page shows what it found, by project, with any per-row problems.
3. Save writes one `mkg2-seed-…` package (kind `seed`, dated "Board as of"). From then on it is replayed like a meeting, so the next meeting's request lists its open items.

**Per-row rules (forgiveness).** Nothing stops the import except a file with no `Type` header.

| Row problem | Treatment |
|---|---|
| Unknown Type | Row skipped, shown |
| Project not named, or no Project row for it | Row skipped, shown |
| Owner with no Person row | Kept as written; asked once (as B10) |
| A due date that isn't a date | Kept as said, as the reply's due dates are (§10.10) |
| Status not recognised | Open, with a note |
| Waiting on a Title that isn't in the file, or that two rows share | Dropped, with a note |
| An owner matching two Person rows | Kept as written; asked once |
| A Person row without an email | Kept; matched by name and Teams name only |
| Done rows | Kept as history with status done; not listed as open work |

**IDs (B18, amended 2026-10-15: the seed has no IDs).** Every row's ID is minted at import as in B12, with the seed date (`HP-A-261015-01`).

**Seeding a project that already has saved meetings:** allowed, with a warning that the same work may then appear twice. "Same as…" in the review is the fix (§10.4).

**Acceptance criteria:**
1. **The example seeds the mock board.** `mkg2-seed-example.csv` gives 9 actions (1 done), 2 questions, 2 risks, 2 decisions and 7 people.
2. **A seeded board feeds the follow-up exactly as tested.** A CSV equivalent of `board-after-seed.json`, followed by the mock follow-up meeting, produces request F's text with only the thread IDs differing (the seed mints new ones). No email reaches the request.
3. **Every row rule above has a test,** plus tests for Excel's quirks: the UTF-8 BOM, quoted commas, US dates (11/6/2026), and semicolon-separated files.
4. **Every module has unit tests and knockouts.** A knockout must make its named check fail, not crash it.

**Decisions:**

| # | Decision | Recommended |
|---|---|---|
| B4 | v1 boards | Start fresh, seeded from the CSV (this section) |
| B17 | The CSV seed import in the step-0 page | Yes |
| B18 | No IDs in the seed: every ID is minted at import (B12); "Waiting on" names a row by its Title | Yes (amended) |
| B19 | An Email column for people: kept in the team folder, never sent to the chat | Yes |

### 10.15 The first real meeting (counts only; 2026-10-15)

**The meeting:** 30 minutes, 137 statements, a first meeting (no open threads), run through the step-0 page twice, in two fresh chats.

| | Run 1 | Run 2 |
|---|---|---|
| One round, reply complete, last statement named | yes | yes |
| Request / reply size | 29,591 characters / not recorded | 29,591 / 4,486 characters |
| Items | 17 | 14 (5 commitments, 1 decision, 2 questions, 3 risks, 3 updates) |
| Sources verified | 16 of 17 at first; 17 of 17 after the fix below | 14 of 14 |
| Owners that are not a speaker label | not recorded | 0 |

**Fixed after run 1:** the source check now compares words, ignoring punctuation and case (§10.8). The one "not found" item had quoted "the 2nd. Is" as "the 2nd is".

**Run 1 against run 2, by cited statement:**
- 10 statements cited by both runs;
- 7 by run 1 only: S048, S062, S068, S076, S083, S087, S108;
- 4 by run 2 only: S034, S070, S091, S093.

**Aaron's judgment of the 11 one-sided items:**
- **Same item, cited at another statement (5):** S062, S068, S087, S070, S093.
- **Minor (3):** S076, S083, S034.
- **Important, found by one run only (3):**
  - S048 and S108, missed by run 2;
  - S091, missed by run 1.

Where the runs disagreed on an item both found, run 2 was right both times: S028's kind, and S074's due date.

**The PM's verdict:** "The rest looks pretty good". But "Projects covered" is too vague: it comes from the one project name typed in at the start.

**Still to come from the PM:** how many important things neither run caught, and whether the meeting covered more than one project.

**What it shows:**
- **The mechanics hold on a real transcript:** one round, a complete reply, sources verified, owners as speaker labels (B10 holds on this data).
- **Recall varies between runs on important items: each run missed one or two that the other found.** On the mocks the important-item recall was stable (28 of 29 in each D run).
- **The suspect is the request's "fewer, clearer items are better".** It may tip a borderline item out.
- **"Projects covered" needs the PM's real project list,** which the CSV seed (§10.14) gives. The fix is then one of:
  - ticking projects at meeting-in (B13), with items movable in the review (B3);
  - variant H: the project list in the request, with a project per item. This is a request change, tested first.

**Variant G (test before build).** It drops "fewer, clearer items are better" and changes nothing else. The token is unchanged, so the page accepts the replies.
- **Tools:**
  - `tests/real/make_variant.py` builds G from the page's request;
  - `tests/real/score_real.py` scores replies against a key of important statement numbers, printing counts and statement numbers only;
  - `tests/real/README.txt` has the steps.
  - Real replies and keys stay in `tests/real/local/`, which git ignores.
  - Self-tests 9/9 and 5/5; knockouts 5 of 5 killed.
- **The mock versions,** for regression: `tests/v2-feasibility/request-G-lines.txt` (seed) and `request-G-followup.txt`.

**The G test, with its pass rule set in advance:**
1. **Three G runs on the real meeting,** scored against Aaron's key, with the two earlier runs scored as the baseline.
2. **G passes when every G run:**
   - finds at least as many key statements as the better of the two earlier runs;
   - has no item showing an earlier version of something the meeting later changed;
   - has no more than 26 items (about twice the earlier runs' 14 to 17: dropping the phrase must not flood the email).
3. **If G passes,** it replaces D's wording for first meetings: `request.js` changes, and the byte-equality tests then pin G.
   - Before G is used for follow-ups, three runs of `request-G-followup.txt` on the mock follow-up must keep F's result: no false "done", 3 of 3.
4. **If G fails,** D stays. The next options:
   - a second run merged with the first, which costs the PM's second chat round;
   - "Add an item from a statement" in the review (a forgiving fallback that stays sourced in the meeting).

**The G result (Aaron, 2026-10-15): G fails.**
- **What was run:** one G run (run 3) alongside the two earlier runs. Run 1 was the first run; run 2 the second fresh run, checked after the source-check fix; run 3 the same request with "; fewer, clearer items are better" deleted by hand.
- **The important items:**
  - S048 and S108 were found only by run 1. Run 3 (G) misses both, so G fails the pass rule above, which every run must meet. Further G runs can't change that.
  - S091 is now judged the same item cited elsewhere, so all three runs have it.
- **The other one-sided items** are the same items cited elsewhere (S062, S068, S076, S083, S087, S070, S093, S060), apart from one minor item (S034).
- **Disagreements:**
  - S028's kind: runs 2 and 3 were right.
  - S074's due date: run 1, on Aaron's second reading (his first reading said run 2).
- **Decision: D's wording stays.** Two important items are found by only one run in three, and removing the "fewer, clearer" phrase did not change that, so the phrase is not the cause.
- **Next, proposed for ratification:**
  - **"Add an item from a statement" in the review:** the PM picks the statement the chat missed and a kind and an owner. It stays sourced in the meeting and costs no chat round.
  - **What S048 and S108 are like** (kind, said clearly or implied, short remark or inside a tangent), without their content. That shows whether a request change is worth testing at all.

### 10.16 Variant I: aimed at what the runs dropped (proposed 2026-10-15)

**What S048 and S108 are like** (Aaron's description, no content):
- **S048:** a clear decision, a recommendation the group accepted, stated directly in a short logistics discussion.
- **S108:** a clear schedule update, stated directly in a short back-and-forth confirming trip timing.

Both are stated plainly. Both sit in short logistics exchanges, which the request's "leave out … small talk … and arranging this meeting itself" can sweep up. And S048's form (a recommendation, then agreement) doesn't match the decision cues the request gives ("let's do", "we're going with").

**Variant I makes two edits and nothing else** (`tests/real/make_variant.py I`; the mock version is `tests/v2-feasibility/request-I-lines.txt`):
1. **Decisions:** after the cue phrases, add "including a recommendation the group accepts ("that works", "let's go with that")".
2. **What to leave out:** add "but keep what affects the work: dates, travel and schedule changes or confirmations are updates".

**Test:** three fresh chats on the real meeting, each edited by hand. **I passes when every run:**
- has S048, S091 and S108;
- shows nothing outdated;
- has 26 items or fewer.

**If I passes:** before it replaces D's wording, three runs of `request-I-lines.txt` on the mock seed must still pass §5.4's criteria. The new "keep what affects the work" clause must not let stale or invented items in.

**If I fails:** no further wording changes. "Add an item from a statement" in the review is the answer to misses.

**Variant I result, with two more runs (Aaron, 2026-10-15): I fails, and the wording changes stop.**

| Run | Request | Items | S048 | S091 | S108 | Outdated |
|---|---|---|---|---|---|---|
| 1 | D | 17 | yes | yes | yes | no |
| 2 | D | 14 | no | yes | no | no |
| 3 | G | 14 | no | yes | no | no |
| 4 | G | 18 | no | yes | yes | no |
| 5 | I | 18 | no | yes | yes | no |

- **Run 5 (I) misses S048, so I fails its rule** (every run must have all three). §10.16 then says: no further wording changes.
- **Run 5 found an important item at S070 that no other run had.** To confirm: run 2's S070 item was judged "same", so run 5's is presumably a different item at that statement.
- **Across five runs:**
  - every run misses one to three important items, and which ones varies (S048 found 1 time in 5; S108 3 in 5; the S070 item 1 in 5);
  - S091 was found every time;
  - no run had an outdated item;
  - the other one-sided items were all the same item cited elsewhere, apart from one minor one (S101) found by runs 4 and 5.
- **Conclusion:** a single run of the request does not catch every important item in a real meeting, and wording does not change that. The fix must sit outside the wording.

**Options (proposed, for ratification):**
1. **"Add an item from a statement" in the review.** Small, sourced in the meeting, and needed anyway. Recommended, to build.
2. **A second look in the PM's second chat round.** The page sends a short follow-up: the reply's own list, and "what important items did you miss?" Only new items come back, so nothing has to be matched across runs. It is a request change: tested first, three runs on this meeting, with the same check.
3. **Two full runs merged.** Not recommended: about eight items per comparison were the same item cited at different statements, so merging falls on the PM.

### 10.17 "Add an item" built; the "second look" test (Aaron, 2026-10-15)

**"Add an item the chat missed": built** (Aaron: "Build").
- **What the page does:** after "Check the reply", the PM types the statement number where something was said. The page shows that statement, and the PM picks a kind and an owner, writes one line, and can add the due date as said.
- **How the item is recorded:** sourced to that statement (verified by construction), marked "added by you", given an ID at Save, and included in the email.
- **Before saving,** an added item can be removed; the chat's items cannot.
- **The counts-only summary** counts added items, never naming them.
- **New work only:** an added item cannot close or update an open thread.
- **Tests:** unit 62/62 (t27a–e); knockouts 27 of 27 killed; browser 28/28 (e8a–e). The page is `dist/MeetingGraph2.html` `02e73314`.

**The "second look" (a request change, tested before build).**
- **The idea:** after the first reply, in the same chat, a short follow-up asks the chat to reread the meeting and list only the important items its list does not have.
- **The message** is `tests/real/variants/second-look.txt`. It names the kinds the runs dropped: a recommendation the group accepts, and updates about dates, travel and schedules.
- **The page does not read the second reply yet.** For the test, Aaron reads it in the chat.

**The test (simple), three times, each in a new chat:**
1. Send the page's usual request, unchanged, and paste the reply into the page.
2. In the same chat, send the second-look message.
3. Record:
   - the first reply's items, and the second reply's new items;
   - whether S048, S091, S108 and the S070 item are in either reply;
   - how many new items only repeat one already in the first list;
   - whether anything is outdated.

**It passes when every test:**
- has all four important items between its two replies;
- has nothing outdated;
- has at most one repeat;
- adds at most 10 new items.

If it passes, the page gets a "Second look" step: it copies the message, and reads and adds the second reply's items, marked "second look". If it fails, "Add an item" is the answer to misses.

**The second-look result (Aaron, 2026-10-15): it fails, and the request tests stop.**
- **In both tests the second look returned 0 new items.** In one of them, Aaron marked three important items as missing from the first reply. The chat does not find its own misses when asked.
- **Testing by eye has reached its limit.** For what appear to be the same runs, the presence answers changed between two readings (S091 from yes to no; S048 from no to yes). Ticking items across 18-item lists is too noisy to compare request versions.
- **Decision: no more request variants.** D's wording stays.
- **Misses are handled by "Add an item" (§10.17), and measured in real use:** the counts-only summary's "Items added from a statement by the PM" counts them per meeting, at no extra cost.
- **Next:** the PM uses the page on his next few real meetings and sends the summary each time.

### 10.18 The CSV seed and multi-project meetings: built (2026-10-15)

**The facts behind it:**
- Aaron ratified the seed (§10.14: B4, B17, B18 as amended, B19).
- The PM's meetings often cover one project or many.
- Multi-project meetings follow the ratified B13 (tick other projects at meeting-in) and B3 (items movable in the review). The request does not change.

**Built:**
- **The seed** (`src/v2/modules/seed.js`).
  - "Start a board from a spreadsheet (CSV)": open the file, set "Board as of", check or edit the project codes, see each row's problem, save.
  - Save writes one `mkg2-seed-…` package, holding the people with their emails. The emails never reach a request.
  - A second seed of the same projects supersedes the first.
  - Every §10.14 row rule is implemented, plus Excel's quirks (BOM, quoted commas, US dates, semicolons).
- **Multi-project meetings:**
  - At meeting-in: a main project, and "Also discussed" ticks for the others, defaulting to the last meeting with the same title. The request lists the open items of every ticked project.
  - In the review: each new item gets a project picker, defaulting to the main project. It is minted under its own project's code (`LB-A-261026-01`).
  - The email lists every covered project, says who took on what per project, and labels moved actions.
  - The counts-only summary counts the projects and the moved items.
- **Compatible with packages saved before this change:** their numbering continues (t33).

**One behaviour to know.** A seed Decision's Due column is the date it was decided, so a seeded decision lists no due date. The §10.14 acceptance test therefore matches request F with only the IDs, the token and decision due dates differing (the mock board's D-4 had "November 12").

**Tests:**
- unit 89/89 (t28–t34);
- knockouts 38 of 38 killed;
- browser 37/37 (e23–e31: the example CSV seeded through the page, then a two-project meeting with an item moved to the second project);
- the page is `dist/MeetingGraph2.html` `745f98dd`.

**Next:** the PM fills the template for his real projects, seeds his board, and runs his next meetings, ticking the projects each one covers.

### 10.19 No ticking projects; the "test version" for projects (Aaron, 2026-10-15)

**Why.** The PM never had to say which projects a meeting covered in v1. v1's request listed every project, and the chat tagged each change and named the projects covered. v2 had left the projects out of the request, and §10.18 then asked the PM to tick them: that moved the chat's work onto him. Aaron's question ("why now?") stands corrected.

**Changed (amends B13):**
- **No ticks.** Every project's open items go into the request; the request format is unchanged, only longer. Parking (B11) bounds its growth.
- **"Main project"** is now only the default for new items the chat does not place.
- **"Projects covered"** in the email is worked out at save: the main project, each new item's project, and the project of every open item the meeting reported on.

**The test version (P), under test.** A tick-box on the page, "Test version: the chat says which project each item belongs to". It makes four exact edits to the tested request, each asserted:
1. a line introducing PROJECTS;
2. a `project` field;
3. `"project"` in the item template;
4. a `=== PROJECTS ===` block (code and name) before the meeting.

The token is unchanged. The page then:
- checks the chat's code against the known projects (an unknown code is dropped with a note, and the item goes to the main project);
- places each new item;
- keeps the picker for corrections;
- counts, in the summary, the items the chat placed and the items the PM moved.

**Tests:** unit 94/94 (t35a–e: both request texts change by exactly the four edits); knockouts 41 of 41 killed; browser 39/39. The page is `dist/MeetingGraph2.html` `3a7a5c8a`.

**The test (Aaron and the PM), with its pass rule set in advance:**
- **The meeting:** a real meeting that covered several projects, after the PM's projects are seeded.
- **The runs:** three runs with the box ticked. For each run, report the new items, and how many had to be moved to another project.
- **Pass:** at most one item moved per run, in 3 of 3 runs. Then P becomes the request for every meeting, and the tick-box goes.
- **Fail:** the chat places nothing, and new items go to the main project for the PM to move.

### 10.20 Projects as v1 placed them: variant J (ratified by Aaron 2026-10-15, "Approved proceed": as written, J2 as proposed; built 2026-10-15)

**Why.** §10.19 still got it wrong. v1's meeting form had no project field at all (date, start, offset, title). The chat worked the projects out from the meeting:
- **The request** listed every project (`PROJECTS (ID | name)`), and every open item carried its project.
- **Covered projects** were named "from the meeting title, explicit project references, matched taskings, and project-level discussion".
- **Each new item** was placed "only when the project is explicit or strongly established by the surrounding discussion"; when unsure, it was flagged for the reviewer.
- **A new project** was created "only when the meeting clearly establishes a new effort that is not in the INDEX", with a quote that was checked.

The test version P (§10.19) copied only the tagging. It kept the main project (so an empty board still needs a typed name, which is what the PM found vague in §10.15). It could not propose a project, and it put unsure items into the main project silently. v2's request also lists open threads by ID only: the project's name appears nowhere. **P is withdrawn: don't spend runs on it.**

**The contract change (J).** Five lines are added to the tested D and F texts, and two are rewritten; each edit is asserted to match once (`tests/v2-feasibility/sample-v1/variant-j.js`):
1. **PROJECTS intro:** "A meeting can cover one project or several, often without saying their names: place each item from what is said around it."
2. **NEW PROJECTS rule:** a project line for "a project that is not in PROJECTS (an effort with its own goal, not a task or a topic inside one)"; "if it might be a listed project under another name, use the listed project, or null."
3. **The `project` field:** a PROJECTS code, a new project's ref (`J1`), or null when "plausible but not certain: the project manager will choose". An item on an open thread belongs to that thread's project.
4. **A project line** after the header: `{"newProject": "J1", "name": "...", "seg": "S001", "words": "..."}`; its quote gets the same source check as an item.
5. **The blocks:** `=== PROJECTS ===` (`CODE | name`, or "none yet"), and the open threads gain a project column: `ID | project | kind | owner | what | due as said | status`.
6. **Rewritten:** `"project"` in the item template; the end line counts item lines, "not counting project lines".

The token keeps its form; its hash covers what the chat sees (projects, threads, meeting).

**What the page would do (built only after the test passes and this is ratified):**
- **Meeting in:** title, date, start, offset. No project field, no ticks, no tick-box.
- **Review:**
  - each proposed project shows its quote: accept it (its code defaults to the initials, editable), rename it, make it "same as" a listed project, or turn it down (its items become "not clear");
  - an item on a thread takes the thread's project; the chat's tag is ignored;
  - a new item takes the chat's project, and the picker corrects it;
  - an unknown code becomes "not clear", with a note.
- **Projects covered** is worked out from where the items landed (v1's own fallback when the chat named none).
- **The empty board:** the first meeting proposes the projects, so nothing has to be typed or seeded first.

**Decision J2 (Aaron):** what happens to a "not clear" item at Save. IDs carry the project code and never change (B12), so an action, question, risk or decision needs its project before it is minted.
- **Proposed:** Save asks for those items first ("2 items need a project"). Updates (no ID) can stay without a project. The pass rule below keeps "not clear" small.
- **The alternative:** a holding code (`NP-A-…`), with "moved" recorded later. This breaks "the ID never changes" in spirit, so I don't recommend it.

**The test (pass rules set before any run).**

*Stage 1: v1's sample (fictional; Aaron alone, no PM needed).* The kit is `tests/v2-feasibility/sample-v1/`: v1's sample board as a seed CSV, v1's sample meeting (12 statements, four projects, none named outright), the key, both requests, and the scorer `check_sample.js` (self-test 21/21, knockouts 19 of 19).
- `request-J-seeded.txt` (the board seeded): 3 fresh chats. **Each run passes when:**
  - no new project is proposed;
  - at most 1 new item is in a wrong project (a code on the S006 trap counts as wrong);
  - at most 2 are "not clear";
  - S007, the security agreement, is new work in PDE or "not clear".
- `request-J-empty.txt` (no board): 3 fresh chats. **Each run passes when:**
  - every proposed project's quote checks;
  - intake, partner exchange and dashboard are each proposed once (records is optional);
  - at most 1 proposal matches none of them;
  - at most 1 new item is in a wrong project, at most 3 are "not clear", and no item names a project that is neither listed nor proposed.
- **Pass:** 3 of 3 runs on each board.

*Stage 2: a real multi-project meeting (Aaron and the PM), only after stage 1 passes.* It needs J requests for real meetings, so the page's tick-box switches from P to J (a small build, to be ratified with stage 1's results). It uses 3 runs on a meeting that covered several of the PM's seeded projects. **Each run passes when:**
- at most 1 new item had to be moved;
- at most 2 were "not clear";
- at most 1 new project was proposed, with its quote checking.
- **Pass:** 3 of 3. Then J becomes the request for every meeting.

**Order of work.** The plan first said "test, then build". Aaron then said he has validated enough on his end ("You just need to make it"), so J was built at once. The stage 1 and 2 runs are optional now.

**Built (2026-10-15), `dist/MeetingGraph2.html` `969f5417`:**
- **The request** is J, always: `request.js` writes the same bytes and token as the reviewed `sample-v1/variant-j.js` (t5, t6). The P tick-box and `variantP` are gone.
- **Meeting in:** no project field.
- **The reply** (`reply.js`): project lines are read, and their quotes are checked like items' (they are not counted as items).
  - Each new item keeps the chat's code (`project`) or a proposal's ref (`projectRef`).
  - An unknown code is "not clear", with a note.
  - A thread item takes the thread's project.
- **The review** (`store.placeItems`, also run by Node):
  - **Each proposal:** add it (its code defaults to the initials), "same as" a listed project (the default when the name matches one), or not a project (the default when its quote doesn't check).
  - **Each new item** has a project picker. "Put every 'not clear' item in…" places them all at once, and "Add a project yourself" covers an empty board with nothing proposed.
  - The review judges codes against the board as it was when the request was written. The browser test found that, after Save, the meeting's own new project otherwise looked "already used".
- **Save:** J2. The page names the items that still need a project, and `mint` refuses an ID without one. The package:
  - is one per meeting (no main project), named after its first covered project;
  - lists the projects covered, in item order, and keeps the review's decisions on proposals (`newProjects`).
  - Day keys are per project.
- **The summary** counts the projects covered, the proposals (and how many were added), and the new items: placed by the chat, not clear, moved by the PM, placed by the PM.
- **Tests:**
  - unit 113/113 (t5–t6b, t36a–j, t37a–m);
  - knockouts 63 of 63 killed;
  - browser 47/47 (Aaron's recorded replies are given the page's token, with their content unchanged);
  - the kit's checker 21/21, knockouts 19 of 19.

**If it fails:** the request keeps J's project list and project column (the chat at least sees the names). New items go to "not clear", and the PM places them in the review.

### 10.21 The full v2: built (Aaron, 2026-10-15: "we need the FULL new V2 ... move forward")

The rest of §10.6–10.11 is built on top of the step-0 slice and §10.20. It is `dist/MeetingGraph2.html` `e1aa5900`.

**New modules** (plain JS, run by Node and pasted into the page):
- **`dates.js` (B7, §10.10):** resolves simple phrases against the meeting date:
  - weekdays, "this week", "next week", "end of next week", today, tomorrow and the end of the month;
  - a month and a day in digits or words, and US numbers;
  - January said in October means next year.

  Vague phrases (early, mid, late, around, soon, "December") stay as said, and only resolved dates count as overdue.
- **`people.js` (B10, §10.5):** builds the people list from the seed people (name and Teams name), each meeting's speaker labels and the review's answers.
  - It asks about a new label only when it has a look-alike, or is no speaker of the meeting.
  - The closest person is suggested (a shared surname counts most) but not chosen. The answer is kept as an alias, so each label is asked once.
- **`review.js` (§10.6 step 4):** applies the per-item review choices:
  - undo a chat closure; confirm a "to check" status (B8);
  - "Same as…" another item of the meeting (one item, one ID) or an open thread (B5);
  - thread, owner, due as said, date and importance, each recorded as a change.

  It also offers **related closures** (B2), unticked: the open actions with the settled question's topic, or created in the same meeting within 15 statements. A ticked one is saved as the reviewer's choice, sourced to the statement that settled the question.

**Changes to the existing modules:**
- **`store.js`:**
  - **The replay** applies board packages in time with the meetings. A decision is never placed before the last meeting on the board when it was made (`after`). Found in the browser test: a clock behind the meeting dates put a decision ahead of its item.
  - **Each thread keeps** its status history (Undo steps back one), the person who owns it, its topic and source statement, importance, the resolved date, and whether it is raised or parked.
  - **Parking (B11):** a thread is parked after 3 meetings of its project that don't mention it. It leaves the request. A mention or Raise brings it back; decisions are never parked.
  - **`boardDecision` (B9)** covers Settled outside a meeting, Not needed (one or several), Raise for the next meeting (and Lower), and Undo.
    - Each needs a name and a note, and none applies to a decision.
    - None creates a thread, changes an owner or sets a date.
  - **`switchTo` (B16):** a copy of the other save, superseding both.
  - **`laterMeetings` (§10.3):** finds the later meetings an earlier, late-imported meeting may duplicate.
- **`email.js`:**
  - The meeting email skips merged items, names owners as people, and lists the board decisions since the last meeting as the PM's ("settled by … outside a meeting").
  - **The leadership email** follows the PM's format, built from board facts over a chosen period:
    - new work, then key developments, including closures and decisions made outside a meeting;
    - decisions;
    - management attention: risks, no owner, overdue (resolved dates only), blocked and waiting on, parked, and projects not discussed yet;
    - next steps, then the status table.

    "high" only orders items within a section.

**The page:**
- **The review:**
  - Undo or Confirm on each chat status.
  - A "Change…" box on every item.
  - "People to check".
  - "Related actions to close?", unticked.
- **Saved meetings:** "Review this meeting again" reopens the saved choices; saving again supersedes and keeps every ID.
- **Conflicts:** each comes with "Use the save by … instead".
- **The board,** by project:
  - raised, open actions, questions, risks, parked, decisions, done and not needed;
  - owners, dates as said and resolved, overdue, waiting on, and outside settlements;
  - tick boxes and the four decisions, with a note;
  - the agenda of raised items;
  - the links that need repairing.
- **The leadership email,** with a From/To period.
- **The request** lists raised items first and says how many parked items it leaves out.
- **Loading or saving an earlier meeting after a later one** names the later meetings, for "Same as…".

**Tests:**
- unit 166/166 (t40–t48 new);
- knockouts 117 of 117 killed;
- browser: the slice 47/47, and the full page (`tests/v2/e2e_full.py`) 28/28. The full-page test covers acceptance 1 (the merge), 4 (board decisions), 7 (asked once), related closures, review again, the conflict switch and the late import.

**Still open:**
- **Acceptance 6:** the PM's two emails, to be saved as format fixtures with Aaron's approval.
- **Acceptance 10:** the first-time user session.
- **Acceptance 2** is tested on the D1 board with a follow-up that closes the minted question, because F2 itself answers the fixture board's IDs.

### 10.22 v1's screens over v2 (Aaron, 2026-10-15: "v1 screens with V2 underneath"; the board and the emails first)

**Why.** The PM expected v1's board and screens. I had read B1 ("a new page beside v1") as a new interface as well as new code, and I never showed a screen or asked. It was the same mistake the PM called out on the emails: change the import, not what he works in.

**Built:** `dist/MeetingGraph2.html` `d0452deb`, from `src/v2/page/app.html`. The slice page is retired.
- **v1's stylesheet, verbatim,** with v1's top bar (Board, Dashboard, Process meeting, Workspace; Open files, Export workspace, Load sample baseline, Clear) and its toast.
- **The Board tab, as v1:**
  - **The left column:** the mirrored-packages line and "State as of" (each saved meeting or spreadsheet board; the board after a save or load moves to the latest, as v1 on accept). Below them: Needs attention (n), Program email report, Meeting email report, and the projects with their description and signals (open, blocked, last discussed).
  - **The project panel:**
    - Needs attention (overdue, due today, blocked and waiting on, no owner, source to check, parked) and Changed at this meeting (v1's tags: New, Completed, Blocked, In progress, Progress, Decision, and "Your decision" for board decisions).
    - Due in the next two weeks, Raised for the next meeting, Open questions and risks, Decisions in effect.
    - Open work by owner, with v1's search, filters (All, Overdue, Blocked, Unassigned) and Compact.
    - Done and not needed, the agenda, and the meeting log.

    Dates are counted as of the chosen meeting, as in v1.
  - **The item dialog** is v1's facts and history, with the speaker's words for each meeting entry, and board decisions marked as the PM's.
- **The board decisions (B9)** sit where v1 had its board actions: a tick box on each item with one bar for several, and the same four on each item's dialog. Each needs a note and is offered only when it applies.
- **The emails are v1's dialogs:** a formatted preview, "Copy formatted for email" (HTML, for Outlook) and "Copy plain text".
  - **Program email report:** the leadership email over a From/To period, its summary now in the PM's words: each meeting convened, who took on what per project, what closed and what was decided.
  - **Meeting email report:** the seven sections, for the "State as of" meeting, also offered on each meeting in the log.
- **Process meeting** carries v2's request, reply and review in v1's step cards. Its element IDs are unchanged, so the review's tests carry over.
- **Workspace:** saved meetings (review again), conflicts, the spreadsheet seed, and a note on where out-of-meeting updates went (the board decisions).
- **Dashboard (second, kept simple):** signals per project, open and overdue by owner, blocked and waiting on, data health.
- **Load sample baseline** loads v1's fictional sample as a spreadsheet board. Seeded projects keep the CSV's Notes as their description.
- **Export workspace** writes one file of every package, which Open files reads back.

**Tests:**
- unit 167/167 (t48h new);
- knockouts 119 of 119 killed;
- browser: the slice 47/47, and the full page 30/30, which now drives v1's screens: the tabs, the project panel, the item dialog and both email dialogs.

### 10.23 Aaron's run of the mock meetings through the page: three fixes (2026-10-15, "proceed")

**The run:** the example CSV seeded as of Oct 15, then the Oct 19 kickoff (42 items) and the Oct 26 follow-up (56 items), both through gpt-5.6-terra-low with the §10.20 request. Both replies were complete, with every source verified and every item placed in its project. The follow-up's closures and statuses landed on the right items, and nothing unfinished was marked done.

**Found and fixed:**
1. **A status on a decision was applied.** The chat restated two seeded decisions with "done", which closed them and dropped them from the next request; on Oct 26 the chat then re-created one (`HPR-D-261026-01`). A decision is settled when it is made, so its status is now never applied: by `fitThreads` at review, and by the replay, which also covers packages already saved.
2. **Items attached to the wrong kind of item were lost.** Commitments the chat attached to a risk, question or decision were saved as updates: 12 in the run, including Ken's contingency answer, Tom's walk-through before the inspection and Abena's call to the neighborhood association. Decisions attached to an action or question were saved the same way: 4, including "the mural stays" and the training move. None of these had an ID or a place on the board or in the emails.
   - **Now (`store.fitThreads`, run by `placeItems`):** a commitment continues only an action, and a decision only a decision. Otherwise the item is minted as new work or a new decision, related to the item it was attached to (`relatedTo`, which counts as a mention for parking).
   - Any status it carried still applies to that item as an update (`statusOf`), so "the mural stays" both answers the question and is a decision in effect.
   - "Review this meeting again" reopens such items as the chat gave them, and saving splits them the same way again.
3. **The date resolver** read "Monday, December fourteenth, at nine in the morning" as Nov 2: the day word was missed because words followed it, and the weekday won. The resolver now also tries the first word on its own.

**Tests:**
- unit 178/178 (t40g, t49a–j new);
- knockouts 128 of 128 killed;
- browser 47/47 and 30/30.

### 10.24 Review again: dates, and items a later meeting never saw (Aaron's re-save, 2026-10-16; approved "Agree, proceed")

Aaron re-saved both mock meetings. The 12 actions and 4 decisions came back as planned. Two problems remained.

**A. A wrong saved date stayed.** On reopen, the page treated any saved date that differed from today's date reader as the PM's own. Nov 2 came from the old reader, so it was kept and marked "changed".
- **Fix:** a saved date is the PM's only when the save recorded the PM editing it (`edited` includes "due date"). Any other date is read again.
- The reopen now lives in `review.js` (`reopenItems`), so the Node tests reach it.

**B. A re-save can add items that a later meeting's request never listed.** That meeting could not update or close them: five recovered kickoff actions stayed open though the follow-up finished them.
- **Fix:** `unseenLater` names, for each later meeting, the IDs that were open on the board just before it and missing from its request. Closed items are never named, because a request never lists them.
- Save shows the warning, with the remedy: run that meeting through the chat again, or mark the finished items Settled and use "Same as…" for repeats.
- This replaces the earlier warning for an earlier meeting saved after a later one, which never named the items.

**For Aaron's data:** the Oct 26 save now marks the Nov 2 date as his edit. Set it to Dec 14 by hand in the review, or re-run Oct 26 through the chat. The re-run also clears the five open actions and the duplicate decision.

**Tests:**
- unit 184/184 (t49k–p new);
- knockouts 135 of 135 killed;
- browser 47/47 and 32/32 (f25c, f25d new).

### 10.25 UI/UX change request (Aaron, 2026-10-16; built the same day in his priority order)

Presentation and interaction only: the chat contract, the IDs, the evidence, the history and the file workflow are unchanged, and older files still load.

**Priority 1, the Board (A1–A13):**
- **A1:** one column.
- **A2:** "Last time we talked…" first. It shows the saved chat summary of the latest meeting of this project, up to "State as of", and labels it meeting-wide when that meeting covered several projects.
- **A3, A7:** "Changed at this meeting" and the agenda are removed.
- **A5:** owner headings with their counts.
- **A6:** "Done and not needed" is its own collapsed section, split into Completed and Not needed.
- **A8:** no tick boxes and no bulk bar: one item at a time, in its dialog.
- **A9:** a "Record a Board decision" box, with the note above the actions and the errors beside them.
- **A11:** "Restore status: X" names the status it restores, from the item's status history.
- **A12:** "Mark completed" for an action, "Mark resolved" for a question or risk.
- **A13:** "Mark as not needed".
- **A4, A10:** the raised section and the general Raise action are removed. A parked item offers "Bring back into discussion", which explains its effect. Raises saved earlier still replay and still reach the request.

**Priority 2, the review (B2–B5):**
- **B2:** one short result line ("N items read. Every new item has a project.") above "Check details". Errors that stop the save are shown in red, each with its fix, and they open the details. Warnings say saving is still allowed.
- **B3:** a project is added by its name. The code is made from the name and can be changed under an optional control.
- **B3:** each related closure shows its ID, its status, why it was suggested and a link to its history. It offers "Leave open" (the default) or "Also close this action", stated as the reviewer's decision.
- **B4, B5:** "Keep current status: X" and "Apply completion" / "Apply proposed status: Y". No control appears when there is nothing to apply: a decision, or a status the item already has.

**Priority 3 (B1): the optional Teams attendance report.**
- The page reads it locally with v1's reader, now `attendance.js`, and matches each participant to the people register. Unmatched names are listed; they never block.
- The meeting package keeps it under `attendance`, without email addresses. The field is absent when no report is given.
- The meeting email lists the attendees, and "Review this meeting again" brings the report back.

**Tests:**
- unit 191/191 (t50a–g new);
- knockouts 145 of 145 killed;
- browser 52/52 and 38/38 (the board, review and attendance checks new).
- Not checked in the browser: the meeting-wide label on "Last time we talked…".

### 10.26 The meeting email's executive summary is the chat's summary (Aaron, 2026-10-16)

Section 2 of the meeting email is now the chat's saved summary, the text the Board shows as "Last time we talked…". It replaces the long sentence built from the items.

Two short lists follow it, because no other section carries them:
- "Decided in this meeting:", each decision with its ID (and its project, when the meeting covered several);
- "Also reported:", the updates on no open item.

Nothing else is lost; the other sections carry the rest:
- new actions, with their owners and projects: section 3;
- closures and status changes: section 4;
- open questions and risks: section 6.

A package saved without a summary keeps the summary built from the items. The Program email report is unchanged.

**Tests:**
- unit 193/193 (t24c, t24d, t49q; t32e updated);
- knockouts 148 of 148.

### 10.27 The Program email report opens with every project, not with meetings (Aaron, 2026-10-16: "Agree, proceed")

The report can be made at any time and covers all projects. Its opening paragraph used to be a per-meeting account ("The Follow up on Oct 26 convened. On Harbor Point: …"). It is now one paragraph per project, which gives:
- the project's latest saved meeting summary up to the "To" date (the Board's "Last time we talked…"), with that meeting's date and title;
- "before this period" when that meeting is older than "From", and a note when the meeting covered several projects;
- the board's facts: open actions, overdue, blocked, and how many closed in the period (in meetings, or marked completed or not needed on the Board);
- "Not discussed in a meeting yet." for a project with no meeting.

The sections after it are unchanged: key developments, decisions, management attention, next steps and the status table.

**Tests:**
- unit 195/195 (t48h rewritten, t48i, t48j new);
- knockouts 152 of 152.

### 10.28 The Dashboard: what to ask, of whom, and why now (Aaron, 2026-10-16, with six refinements; built)

**What it does.** The Board tells the story; the Dashboard turns what the board already flags into questions. `interventions.js` computes them from the saved records with no LLM, and the page draws them.
- Each open item appears once, under its strongest condition. Its other reasons stay in its detail.
- Each row shows: the question (from a fixed template), who to ask, the item (which opens the existing dialog), the evidence, and how long the condition has held ("new since the last meeting" or "N meetings in a row").

**The conditions, strongest first:**
- what it waited on is now done;
- blocked;
- no owner;
- others are waiting on it while it is late or blocked;
- overdue;
- open question carried over 2 or more meetings;
- risk with no action linked to it or sharing its topic;
- mentioned in 2 or more later meetings with no change of status;
- important but with only a vague date;
- parked;
- source to check.

**Persons and projects:**
- capacity: 6 or more open actions, or 3 or more overdue;
- a project with no meeting for over 14 days, or open items and no meeting yet.

**The six refinements:**
1. **Questions, not findings.** A repeated mention asks "Where does it stand, and is anything needed?". A high action count asks "Is the load manageable?".
2. **"State as of" is respected.** Overdue uses the chosen meeting's date. "How long" walks the project's meetings up to it, judging each by its own date. "Since the previous meeting" compares the boards before and after that meeting.
3. **Each item once**, under its strongest condition, with its other reasons kept.
4. **"Possible management intervention" only for the significant**, and each row says why. That means: overdue or blocked at each of the last 3 project meetings; others waiting on late or blocked work for 2 meetings; or no owner on important work or work others wait on. Being unchanged alone never escalates.
5. **"Copy these questions"** copies the displayed questions as text, by section and then person, each with its ID, project and evidence. There is no editing, saving or agenda.
6. **Every question rests on records.** A condition the data can't support is not raised. A risk is flagged only when no action is linked to it or shares its topic.

**Layout:**
- "Since the previous meeting": completed or not needed, new actions, new decisions, newly blocked, unblocked, newly overdue, each opening its list.
- Then the intervention section, "Ask in the next meeting" (grouped by person), capacity conversations, and projects.
- Below, folded: Project overview (formerly "Signals"; project names open the project on the Board), Open and overdue by owner, Data health.

Nothing new is recorded. The graph, the chat request and the meeting workflow are unchanged.

**Tests:**
- unit 210/210 (t51a–o);
- knockouts 170 of 170;
- browser 52/52 and 43/43 (f28–f32).

**Found while testing:** a package ID goes down to the second. Two saves of the same meeting within one second share an ID, and the page skips the second as already loaded. The browser test now waits a second between saves. A person won't save twice in one second, but the ID could take milliseconds if Aaron wants the case closed.

### 10.29 Close project, Reset page, and the labels (Aaron, 2026-10-16, before UAT)

**Close project** (the PM's ask) is a button next to the project's name on its Board page.
- It needs a note. Its message says it closes the project and all its open items, with the count and an expandable list.
- It is saved as a board package (`action: close_project`, `project`, note, name). Older pages ignore it, so the files stay compatible.
- On replay, every open action, question and risk of the project becomes Not needed, marked as closed with the project. Done work and decisions stay as they were.
- A closed project is left out of a new request's project list and its open items, and out of the Dashboard. Its items take no Board decision of their own: their dialog says to reopen the project.
- **Where to see it:** on the Board under "Closed projects" (folded below the open ones). Opening it shows its board as it was, with a banner (who, when, the note) and a "Reopen project" button.
- **Reopen project** also needs a note. Each item goes back to the status it had, and both decisions stay in each item's history.
- The Program report says the project was closed, by whom and why. The meeting email lists the close among the decisions made outside a meeting.

**Reset page** sits at the top of Process meeting.
- It clears the transcript, the request, the reply, the review and the attendance. The saved meetings, the board and your name stay.
- It asks first when there is a review that hasn't been saved.

**Labels.** The request line, the email's wording of Board decisions, and one leftover error message now use the current names: Mark completed, Mark as not needed, Restore the earlier status, Bring back into discussion.

**Housekeeping.** CLAUDE.md is rewritten for the launched state: v2 is the product; the open items and the known limits are listed.

**Tests:**
- unit 217/217 (t52a–g);
- knockouts 180 of 180 (three older ones re-anchored);
- browser 53/53 and 48/48 (e24, f33–f37).


### 10.30 The export as a contract for other apps (Aaron, 2026-10-17: "I approve, write up the MeetingGraph side"; ratified "Ratified by me"; built 2026-10-17)

**Why.** Dossier Studio, a separate app, will read MeetingGraph's workspace export. Its spec v0.2 had to guess what the fields mean, and guessed several wrong (see the decision sent with spec v0.3). MeetingGraph owns the export format: these five changes make it a documented contract.
- Nothing here changes the chat request, the review, the board or the PM's screens. The only new control is one card on the Workspace tab.
- Dossier Studio depends only on the export format, never on MeetingGraph's code.

**1. The schema document** (`docs/mkg2-export-schema.md`, new).
- It defines every field of every package kind (meeting, seed, board, a switched save) and of the workspace file.
- **What each field means, where that isn't obvious:**
  - `who` is the chat's label: the owner for a commitment, otherwise whoever raised or settled the item. `person` is the owner as the review resolved it.
  - `seg` is the checked source statement. `citedSeg` is what the chat claimed. `src` and `toCheck` say whether the quoted words were found.
  - `byReview` items are the reviewer's closures; `added` items were typed by the PM. Neither is something a speaker said (A1).
  - `statusOf` items are a status split off another item; `mergedInto` items are duplicates. Neither is a separate piece of work.
  - `supersedes` and `alsoSupersedes` decide which saves count: drop the superseded ones; if two saves of one meeting remain, the first-saved is used.
- **The board decisions and what each does on replay:** settled, not_needed, undo, raise, lower, close_project and reopen_project.
- **How to read it:**
  - the packages are the record, and `derived` (2, below) is a convenience;
  - unknown fields must be kept, not rejected.
- **A unit test keeps the document honest.** It builds one package of every kind and fails if any field it holds is not in the document.

**2. A `derived` section in "Export workspace".** The file stays `mkg2Workspace` and goes from `1.0` to `1.1`.
- The `packages` are unchanged, and older pages still load the file.
- `derived` is the board as replayed from every package at export time:
  - `asOf`: the last meeting's ID and date;
  - `packages`: which saves are in use, which are superseded, and the conflicts;
  - `projects` and `closedProjects`: who closed each one, when, the note, and the items closed with it;
  - `threads`: each item's ID, kind, project, owner, what was said, due date (as said and resolved), status, status history, waits-on, related item, parked, raised, settled outside a meeting, closed with the project, "to check", and its history of meetings and decisions;
  - `unlinked`: items that point at an ID a re-saved meeting dropped.
- It is computed by the same replay the Board uses, so it can't disagree with the Board. A reader that finds it inconsistent with the packages should trust the packages.
- It holds no Dashboard questions and no email text: those are views, not records.

**3. The people register in the export** (in `derived`, as `people`).
- It holds each person's name and every label that means them, each marked with where it came from:
  - the spreadsheet (its name and Teams name);
  - a meeting's speaker label;
  - a review's answer.
- It also lists the labels answered "No owner".
- It holds no email addresses. The full export still has them inside the spreadsheet packages, because that file is the team folder's backup.
- **Stable person IDs are deferred.** People stay keyed by name until a need is shown, because adding IDs would touch the review and the saved files.

**4. "Export for sharing"** (a new card on the Workspace tab).
- You choose projects (ticked boxes) and a date range. The file it writes is a reduced copy for another app, not a backup:
  - the workspace file and each package in it are marked `reduced: true`;
  - only meetings, spreadsheet starts and board decisions of the chosen projects within the dates are kept;
  - in a meeting that covered other projects, only the chosen projects' items are kept. The chat's meeting summary is kept only if the meeting covered no other project.
  - **Only the statements the kept items cite are kept;** the rest of the transcript is left out.
  - No email addresses and no attendance (who joined and left, and when).
  - Open-thread lists, new-project records and `derived` are cut down to the chosen projects.
- Names stay: the speakers, the owners, and `savedBy` (needed to show whose decision a decision was).
- **MeetingGraph refuses to open a reduced file** ("This is an export for sharing, not a backup"). A partial copy must never mix with the real board.
- A reduced package keeps its source's ID and says so (`reduced: true`), so a reader can tell it is a view of that save, not a different save.

**5. Package IDs to the millisecond.**
- New IDs end in the save time to the millisecond (`…-20261017T080312123`). Today they stop at the second, so two saves of one meeting within one second share an ID: a known limit, which this removes.
- Older IDs stay valid and are never rewritten.
- This applies to meetings, spreadsheet starts, board and project decisions, and switched saves.

**Not in this change:**
- anything about personality or communication style (that is Dossier Studio's, under its own governance review);
- stable person IDs;
- JSON-LD;
- any change to what the chat is asked.

**Tests (each check with a knockout):**
- unit: the schema-coverage test; `derived` equal to the replay; the register's sources and its "No owner" labels; the reduced export (no emails, no attendance, only the chosen projects and dates, only cited statements, the summary kept or dropped correctly, `reduced` marks); millisecond IDs, and two saves in one second getting different IDs;
- browser:
  - "Export workspace" writes `1.1` with `derived`, and the page loads it back;
  - "Export for sharing" writes the reduced file;
  - "Open files" refuses that reduced file;
  - the 1.1-second wait in f25d is removed.

**After it is built:**
- CLAUDE.md drops the same-second ID limit from the known limits.
- The schema document is what Dossier Studio's spec v0.3 is written against.

**Built (2026-10-17):**
- `src/v2/modules/export.js` (new): the workspace file, `derived`, Export for sharing; `people.js`: the register; `store.js` and `seed.js`: millisecond IDs; the page: the card, the refusal, the 1.1 export.
- A reduced file includes only the saves in use; superseded saves stay in the backup.
- `docs/mkg2-export-schema.md` (new). Unit check t53h records every package the tests build and fails on any field the document does not define.
- Tests:
  - unit 225/225 (t53a–h);
  - knockouts 201 of 201 (21 new);
  - full page 57/57 (f38–f40, f38b; the f25d wait removed);
  - page knockouts 8 of 8 (3 new).

### 10.31 The export: a bug fix, clarifications and conformance fixtures (Aaron, 2026-10-17: "agree proceed", after the review of Dossier Studio spec v0.3.1)

**The bug (mine, from §10.30).** A shared file's `derived` board counted board decisions saved after the end of the range, up to the next meeting (or every later one, if there was none). Now board decisions saved after `scope.to` are left out, as the schema document said. Check t53i.

**One change found while building the fixtures.** A shared file no longer keeps the statements cited only by items still "to check".
- Those items' words were not found in the statement, so the statement is not evidence of anything.
- In the fixture it was a personal remark ("my kid has a cold").
- The item itself is still in the file, marked `toCheck`.

**The schema document, clarified** (behaviour unchanged):
- the source check compares words in order, ignoring case and punctuation, so `words` is not always an exact character substring (rule 11);
- in a shared file, `superseded` and `conflicts` are empty, every package is listed in `inUse` or `boardDecisions`, `derived` can hold work from before the range, and the people register covers only the shared packages;
- `history[].meeting` joins to that meeting's save in use.

**Conformance fixtures** (`tests/v2/fixtures/export-1.1/`, with a README for the Dossier Studio developer).
- Three synthetic files: `full.json`, `shared-HP.json` and `shared-HP-LB.json`.
- `make_export_fixtures.js` builds them through the real pipeline: a spreadsheet start, meetings checked and reviewed, a re-save, a conflict, all seven board decisions, verified, near and to-check items, PM-added, reviewer, merged and split items, a "No owner" answer, attendance, and two projects.
- t54a fails if the committed files differ from what the code builds. They are kept byte for byte (`.gitattributes`).

**Tests:**
- unit 231/231 (t53i, t54a–e);
- knockouts: 6 new;
- the browser suites unchanged.

**Sent with this to the Dossier Studio developer: five corrections to spec v0.3.1.**
1. Trust `src` rather than requiring an exact substring.
2. Replace the save-precedence logic with "every package is in `derived.packages.inUse` or `.boardDecisions`".
3. Drop the "diagnostic full fixture" import mode.
4. Reword AT-I08 to show `derived`.
5. Treat a thread owner missing from the register as a display name.
