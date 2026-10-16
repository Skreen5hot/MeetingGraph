# MeetingGraph — D-UX12: place, label, and move on

Status: **ratified 2026-10-12; Phase 1 built** (MeetingGraph.html `24e5b137…`). Build status in §12.
Builds on: D-UX11 user mode (`claude/mkg-user-mode-plan.md`) and the testers' review of the "place, label, and move on" proposal, with Aaron's two amendments: demote rather than stop, and phase the board work.

## 1. Standard (ratification statement)

MeetingGraph blocks an import only for verifiable integrity failures and internally contradictory board changes. For ordinary ambiguity, it places source-linked information in a reasonable default location, applies a visible uncertainty label, and lets later users move, promote, assign, date, split or dismiss the item. The board keeps the uncertainty visible and never presents unsupported owners, statuses, dates or decisions as settled facts.

The shift is from "the importer resolves every ambiguity" to "the board keeps the meeting evidence, makes uncertainty visible, and makes no unsupported high-impact change".

Why: three rounds of rule-tuning showed that meeting language stays ambiguous however the rules are tuned. The D-UX10h feasibility test showed the model can't make these scope calls reliably, and an importer often lacks the context to make them either. A gate that waits for those calls keeps the board empty without making it more accurate.

## 2. Hard stops (the only things that block an import)

| # | Condition | What happens |
|---|---|---|
| 1 | The reply is for the wrong meeting, comes from an older request, or its context doesn't match | Plain message; send the request to the chat again |
| 2 | A quote can't be found in the transcript (CITE-RANGE) | Back to the chat with the fix request |
| 3 | It points at a task, person or project that doesn't exist (REF-DANGLING on an op) | Back to the chat with the fix request |

*Corrected 2026-10-13 (testers' Phase 2 review, amendment 8):* PROJ-ORPHAN-OP was listed here in error. It means a change is filed under a project the meeting didn't cover. That is a project association, not a missing entity, so it is placed and labeled "Scope to confirm" (§4, §12). The build has always treated it that way.
| 4 | The reply is malformed or unreadable (hard errors) | Back to the chat with the fix request |
| 5 | **Contradictory changes in one reply** (new check, OP-CONFLICT): the same task marked complete and in progress; two different owners; conflicting dates; a task created and merged or removed in the same package; one statement cited for mutually inconsistent updates | Back to the chat with the fix request, naming the conflict |

These are mechanical: they can't be settled by judgment at import time, and they don't depend on how the meeting was phrased.

## 3. Demotion: unsupported high-impact changes (testers' stop #5, amended)

A change to an **existing** task's owner, status, due date, project, prerequisite or decision status needs direct transcript evidence for that exact change. Without it, the change is **not applied**. It becomes a source-linked note on the task, and the rest of the import goes through.

| Unsupported change | Becomes | Label |
|---|---|---|
| Owner (Reassign without a commitment by the new owner) | Note: "Possible owner: <name>" plus the quote | Possible owner change |
| Status (e.g. completed on "I think I have that done") | Note: "Possible status: <status>" plus the quote | Possible status change |
| Due date (Deadline without an explicit change of date) | Note with the phrase | Possible schedule update |
| Project, prerequisite, decision | Note with the quote | Check scope |

The same rule applies to a new task's owner: a new task whose owner didn't commit is created unowned, with "Possible owner: <name>" in its note.

Why demote rather than stop: stopping the whole import for one unsupported field sends the entire reply back for another chat round, which is the stall this plan removes. Demotion gives the same protection, because nothing unsupported is applied, without the stall.

## 4. Default placements (testers' amended table)

| Ambiguity | Default | Label | Phase 2 actions |
|---|---|---|---|
| Might be part of an existing task (NEW-DUPLICATE, COV-DEFERRED-NEW, MATCH-BETTER-TARGET) | Source-linked note on the likely existing task, when there is a plausible match; no new task | May be separate work | Keep on this task · create separate task · move · dismiss |
| Asked for, nobody accepted ownership | Unassigned task, **only when the request has a concrete completion condition**, with "Requested by …"; otherwise a project-level open item | No owner yet | Assign · keep unassigned · dismiss |
| Date unclear (TIME-UNGROUNDED, TIMING-MERGED) | No date set; the exact phrase kept in the source note | Date unclear | Set date · leave undated · dismiss |
| Invitation or calendar housekeeping (ADMIN-IN-PROJECT) | Meeting note, not project work, unless a matching administrative register item exists | Meeting administration | Keep in meeting notes · promote to project task · dismiss |
| Wording may omit a deliverable (DELIVERABLE-DROPPED, DELIVERABLES-MERGED, DECOMP-MERGED, OVER-SPLIT, CONTINGENCY-DROPPED) | Task as written, with the **full source sentence** in its note; the shortened label is not treated as the complete scope | Check scope | Edit scope · split · leave as written |
| Schedule or window that may affect an existing task (the D-UX11h trigger, COV-UNRESOLVED) | Source-linked planning note on the most plausible task when there is a reasonable match; otherwise at project level | Possible schedule update (task) · Schedule context (project) | Keep on task · move to project context · dismiss |

**Two placements added in drafting, for ratification:**

| Ambiguity | Default | Label |
|---|---|---|
| Conditional or unrequested work recorded as a task (CONDITIONAL-TASKING, TASK-NO-ACCEPTANCE with no quoted ask) | Not created; kept as a project-level open item with the quote | Not a task yet |
| A commitment or status the chat didn't record (COMMITMENT-MISCLASSIFIED, COV-UNBOUND-DISPOSITION, DISP-MISSING, COV-MISSING-ITEM) | Open item on the task or project it names, with the quote | Possibly missed |

Unchanged: PARTY-IDENTITY creates no person (the name stays in the note, as an unclear reference); the reply's own consistency notes (class C) stay in Reviewer details; a reply with no coverage tables is accepted and the fact recorded.

## 5. Import screen

- Update the board is enabled as soon as there is no hard stop. **No required decisions.**
- D-UX11h is no longer an import question: the statement is placed under "Possible schedule update" or "Schedule context".
- The decision box becomes **"What will be labeled"**: a count per label, with the items listed under it. Each item keeps its optional override (for example "Keep it as new work" or "Add it to …"). Overrides are optional and go through the same gate as before.
- The fix request stays available as an option ("Ask the chat to improve this"), not a requirement.
- Reviewer details, the same-gate rule (both views give the same package) and the review record are unchanged.

## 6. Board, Phase 1 (ships with D-UX12)

- Labels are stored as package flags with their own kinds (`may_be_separate`, `no_owner`, `date_unclear`, `meeting_admin`, `check_scope`, `possible_schedule_update`, `schedule_context`, `possible_owner_change`, `possible_status_change`, `not_a_task_yet`, `possibly_missed`). Each carries the item it is about, the source segments and the quote. Flags are already part of the package, so this should need no new field; to be confirmed in build.
- The board list shows each item's labels, not only its details.
- The source quote, speaker and meeting time are one click from the label.
- **Project open items get a place on the project board** (Aaron, 2026-10-12). Today, items that aren't tasks appear only in the meeting and program email reports; the board shows tasks only. In Phase 1:
  - Each project's panel gets an **Open items** section above its tasks. One row per item ("Not a task yet", "Schedule context", "Possibly missed", "No owner yet" when not a task, and the reply's own open questions), with the label, the note, and the meeting and date it came from. The source quote is one click away.
  - The project list shows a count per project ("3 open items"), so a project with unresolved items stands out without being opened.
  - **Meeting administration** stays with the meeting, not the project: in the meeting email report and the meeting's entry in "State as of". It is not project work.
- A **Needs attention** view lists every item that carries a label, grouped by label: task labels and project open items together.
- Labels persist across later imports of other meetings. Re-importing the same meeting replaces its labels, as packages do today.

## 7. Board, Phase 2 (after Phase 1 ships)

Phase 2 is specified in full in §16 (drafted 2026-10-13 with Aaron's three decisions; for ratification).

## 8. What stays

- The three hygiene checks, as regression controls (possessive time words, full-sentence deliverables, selfReview `nearest` must be an existing active task). They are not evidence of model feasibility.
- The D-UX11 user mode, Reviewer details, the next-action bar and the fix-request flow.
- The rulings from Oct 12: unowned asked-for work with "Requested by"; "those materials" refers back; "slides" carries "slide deck"; add-as-note.
- The D-UX10h feasibility result: failed and closed. D-UX12 does not reopen it. It changes what the board does with the uncertainty.

## 9. Acceptance criteria (D-UX12 Phase 1 is complete when all hold)

1. **No required decisions.** On every reply we hold (the golden, the rejected reply, the four repair rounds, terra-low run 3, the D-UX10h runs, Aaron's three D-UX11 runs), Update the board is enabled unless a hard stop applies.
2. **Hard stops hold.** One test per hard stop, including each OP-CONFLICT case, and each blocks with a plain message.
3. **Nothing unsupported is applied.** For each high-impact field in §3, an unsupported change is not applied and appears as a labeled note with its quote. An audit over the accepted packages finds no owner, status, date, project, prerequisite or decision change without direct evidence.
4. **Every placement is labeled and sourced.** Each default placement in §4 produces its label, the item it is about, and the quote. Tested by finding code, one mutation each.
5. **Visible on the board.** Task labels show in the board list. Every project-level item appears in its project's Open items section, and the project list shows the count. Meeting administration appears with the meeting, not the project. Needs attention lists exactly the labeled items. The quote is one click away from each.
6. **Same gate.** Both views still give the same package for the same input and overrides.
7. **Regression.** Selftest, jsdom, Playwright t30–t33 and t35 are green, with every by-design assertion change listed and justified.
8. **A first-time user** (carried over from D-UX11, still open) processes the Difficult transcript to Update the board without help.

## 10. Limits

- Some items will start in the wrong place. They are labeled, traceable to the exact words, and easy to move once Phase 2 ships. Until then, they are moved by a correction import.
- Labels need a reader. The Needs attention view is the mechanism. Who works it, and how often, is a team decision.
- This changes the testers' standard: their rubric and stop rule assumed the gate catches everything before import. Their review accepted the direction with amendments, which are folded in here. Aaron decides what goes back to them.

## 11. Sequencing

1. Ratify this plan (Aaron), including the two placements added in drafting (§4) and demotion (§3).
2. Validator: code-to-outcome mapping (stop, demote, place, record) and the OP-CONFLICT check.
3. Import screen (§5).
4. Board Phase 1 (§6).
5. Tests (§9), knockouts, new build hash.
6. Phase 2 plan, written after Phase 1 is in use.

## 12. Phase 1 build status (2026-10-12)

| # | Criterion | Status |
|---|---|---|
| 1 | No required decisions | Met. t36.28: eleven replies (the golden, the rejected reply, four repair rounds, terra-low run 3, D-UX10h run 2, the golden without tables, and Aaron's D-UX11 runs 1 and 2) are accepted with no decision, giving the same package in both views. t36.43: Aaron's run 3 is the same. |
| 2 | Hard stops hold | Met for contradictory owners (D18, t36.50) and a change to a task that doesn't exist (t36.51). Unverifiable quotes and a wrong or older request are covered by the existing tests (t35.31, CITE-RANGE in the selftest). |
| 3 | Nothing unsupported applied | Met. Demotion of an unsupported status (D16) and owner change (D17) in the selftest and t36.52–53. The audit finds no settled reply that keeps an unsupported owner, status, date, prerequisite or decision change. Knockout: with demotion disabled, the audit fails on D16 and D17. |
| 4 | Every placement labeled and sourced | Met for date unclear, schedule update, schedule context, meeting administration, not a task yet, possible owner and status change, no owner, check scope and may be separate work (selftest and t36). |
| 5 | Visible on the board | Met. t36.55–62: chips on tasks with the quote one click away; Open items above the tasks; a count in the project list; Needs attention grouped by label; meeting administration with the meeting, not the project. |
| 6 | Same gate | Met (t36.14, t36.28, t36.41). |
| 7 | Regression | Selftest ALL GREEN; jsdom 27/27; Playwright t30–t33 55/55 (D16–D18 added to the mutation index); t36 90/90. t36 is generated from t35 by `make_t36.py`, which lists every by-design change. t35 tests the D-UX11 gate and is kept for reference only. |
| 8 | First-time user | **Not yet run.** |

**Choices made in build (for the record):**
- PROJ-ORPHAN-OP is not a hard stop. It means "filed under a project the meeting didn't cover", which is a project association, not a missing entity, so it is labeled Check scope. §2 row 3 listed it in error.
- A scope question that isn't a schedule change (a possible match the chat left undecided) gets the label "Possible update", not "Possible schedule update".
- A bare acknowledgement ("Okay.") is not labeled "Possibly missed".
- When a task becomes a meeting note or "Not a task yet", its label carries the evidence of the notes that went with it, so those statements stay accounted for.
- Two new validator checks: OP-CONFLICT (hard stop) and SUPPORT-MISSING (demotion). The fix request covers both.
- The board has two attention views: the existing per-project "Needs attention" card (overdue, blocked, no owner) and the new Needs attention button (every label, all projects).

## 13. Email and board fixes after Aaron's Oct 13 test (MeetingGraph.html `ed0de696…`)

Aaron's test ran on the D-UX11 build. Its package and email exposed these problems, now fixed:
- **Executive summary.** It was every progress note pasted into one paragraph. Now it is a short account: who took on what (existing work by name, new work by number), what has no owner, which items got notes, the number of open questions, and Next up.
- **Next up.** It lists only the meeting's projects, and says plainly "due today", "overdue since …" or "blocked on BL-202 (Raj Patel)".
- **Recipient copy.**
  - Open questions name the task ("AI-206 Assess transfer-environment integration options"), not a bare code list.
  - New-item references, segment numbers and "INDEX" no longer appear.
  - Items that name no project are marked "(meeting)" and listed last.
- **Filler removed.** "Updated this meeting — open the item on the Board…" is gone from new actions. The conclusion gives counts instead of repeating the new-actions table.
- **Board.** An item that names no project, from a meeting that covered one project, goes in that project's Open items. Meeting administration still stays with the meeting.
- **No false "Possibly missed".** A statement that a kept note already carries in its own words ("Connectivity should be fine…") is no longer labeled.
- **Unchanged: the email still opens on the reviewer copy, with evidence references.** That was ratified under D-UX8; untick "Include traceability detail" for the recipient copy.
- **Tests.** t36 96/96, with t36.63–68 failing on the previous build; jsdom 27/27, with three email assertions changed by design (`update_suite_dux12.py`); t30–t33 55/55; selftest ALL GREEN.

## 14. Enterprise-machine run, 2026-10-13 (MeetingGraph.html `2865a70f…`)

Aaron ran the D-UX12 build with the enterprise model (`gpt-5.6-terra-low`) on the Difficult transcript.

**Result:** 14 changes, 8 labels, nothing to decide.
- **The model missed a deliverable.** It produced no task for yesterday's summaries; the transcript task is labeled Check scope, quoting the promise.
- **Invitation housekeeping became a meeting note.** Its "completed" status ("I think I have that done") was not applied.
- **The AI-203 window and the AI-207 travel days**, which the reply's own notes left out, became "Possible schedule update" labels.

**Fixed from his email:**
- In the reviewer copy, a label's name was printed twice ("Check scope (…): Check scope: …").
- "No owner yet" appeared twice when the reply had already flagged the missing owner; the label is now skipped in that case.
- "13 questions remain open" counted labels as questions; it now reads "12 items are open for follow-up".

**Left as is:** two "Possibly missed" items, the S018 arrival remark and the S038 connectivity remark. The first is mostly covered by the AI-207 note. The second is a real gap in this reply.

**Tests:** t36 100/100, with t36.69–72 new and two of them failing on the previous build; jsdom 27/27; t30–t33 55/55; selftest ALL GREEN.

## 15. Testers' review of the email (2026-10-13), Aaron's rulings (MeetingGraph.html `e2d2862c…`)

The testers judged the recipient email not ready: incomplete items read as complete, and audit language reached recipients. Aaron accepted the assessment and the pushback below, with three rulings:
1. **AI-405 "today" stays.** The date comes from "get them out today", and "those materials" means the transcript and the summaries (Aaron's ruling of Oct 12). The possessive rule applies to "today's transcript", not to that sentence.
2. **The email opens on the recipient copy.** This supersedes the D-UX8 default; the reviewer copy, with evidence numbers and the audit items, is one tick away.
3. **A note that cuts the speaker's sentence short is labeled** "Scope to confirm" and names the words left out ("the note leaves out 'and start preparing for the transfer period'"). QUOTE-TRUNCATED moves from record-only (class C) to a label. Words the note already carries in its own phrasing don't count as left out.

**Built:**
- **Points to confirm print in the action's own row:** AI-404 slide deck, AI-405 summaries, the AI-203 window, AI-204 "start preparing".
- **The label "Check scope" is now "Scope to confirm".**
- **The recipient copy shows no audit items:** no "Possibly missed", no "nothing records it", no evidence numbers, no "Reviewer flags".
- **Meeting administration is its own short section,** a neutral line without quotes.
- **The Executive Summary names what is still open,** taken from the meeting's own open questions and conflicts, and says how many items carry a point to confirm.
- **The conclusion uses the testers' wording.**

**Pushback, accepted:** the workbench does not rewrite the model's task titles or invent the missing summaries task. It shows the gap with the speaker's words on the item, and the fix request can ask the chat to correct it.

**Tests:** t36 107/107, with t36.73–79 new and failing on the previous build; jsdom 27/27, with the by-design updates in `update_suite_dux12.py`; t30–t33 55/55; selftest ALL GREEN.

## 16. Phase 2: settling labels on the board (ratified 2026-10-13 with the testers' amendments)

**Why now.** People are using MeetingGraph in real meetings and asked how to resolve an "Unclear reference" after the update. Phase 1 shows labels but offers no way to settle one. A label stays until its meeting is re-imported.

**Aaron's decisions (2026-10-13):**
1. **Straight onto the board, and the person must save.** A resolution needs no chat round: the person's own note is its evidence. Nothing changes until they press Save, which writes the record to the team folder.
2. **Anyone with access to the workspace JSON may resolve.** People with access to the SharePoint folder are authorized project managers. Each saved record carries the name of the person who made it.
3. **A resolution survives a re-import** when the new label matches it by meeting, kind, task and quoted statement (§16.5).

### 16.1 Actions by label

Every labeled item, whether on a task, in a project's Open items or in Needs attention, gets the actions for its kind. "Resolve with a note" and "Not needed" are available on every item.

| Label | Actions | What changes on the board |
|---|---|---|
| Unclear reference | **This is…** (pick a person on the board) · **Add as a new person** (name, organization) · Not needed | "Add" creates the person (NewParty). "This is…" records the alias on that person. The meeting's statement stays linked |
| No owner yet | **Assign** (pick a person) · **Leave unassigned** (with a reason) | Assign: owner set on the task (Reassign) |
| Possible owner change | **Confirm** (owner set) · **Reject** | Confirm: Reassign |
| Possible status change | **Confirm** (status set) · **Reject** | Confirm: Status |
| Possible schedule update · Possible date change · Date to confirm | **Set the date** (date, and the task when the label names several) · **Keep as context** | Set: due date on the task (Deadline) |
| Schedule context | **Move to a task** (pick the task) · **Keep at project level** | Move: the planning note goes on the task |
| May be separate work | **Keep on this task** · **Make it a separate task** (owner optional) · **Move to another task** | Separate: new task (NewTasking) with the note's words; Move: the note moves |
| Scope to confirm | **Edit the task's scope** (new title) · **Split** (second task's title, owner optional) · **Leave as written** | Edit: title change recorded as a scope note on the task (the contract has no rename yet; noted in §16.6). Split: new task |
| Not a task yet | **Make it a task** (title, owner optional) · Not needed | New task |
| Possibly missed | **Record it** (on a task or the project) · Not needed | A progress note or project note |
| Meeting administration | **Promote to a project task** · **Keep as a meeting note** | Promote: new task |
| The chat's own open questions, conflicts, suggestions | **Resolve with a note** · Not needed | None. The resolution is recorded |

**Rules:**
- Every action that changes a task (owner, status, date, new task, note) goes through the same validator as an import. The person's note is the evidence, like an out-of-meeting update today. A change the validator would stop (a person or task that doesn't exist, contradictory changes) is refused with a plain message.
- "Not needed" and "Keep…" ask for a short reason, one line.
- A label naming several tasks is resolved per task. The label clears when every task it names is settled.

### 16.2 Saving and the record

- Actions collect in a **pending tray** on the board ("3 changes not saved"), each with Undo. Nothing reaches the board until **Save**.
- Save requires the person's name (pre-filled from the last save on that machine). It writes **one dated file to the team folder**, as Accept does for a meeting: an out-of-meeting update package (reviewer attestation) built by the board without a chat round.
- **The file holds:**
  - the person's name and the save time;
  - each action (which label, which choice, the note);
  - the board changes it made, each citing the note as its statement.
- **Leaving with unsaved actions warns first.** Unsaved actions are not kept across reloads.
- Two people resolving the same label produce two records. The later save wins on the board; both stay in the history.

### 16.3 What a resolved item looks like

- It leaves the project's Open items, the task's label chips and Needs attention.
- It stays in the task's or project's **history** with who, when, the choice and the note, next to the meeting statement that raised it.
- Needs attention gains a **Resolved** filter showing what was settled, by whom, and when.
- The meeting email for a later meeting does not repeat a resolved item. The email for the original meeting is unchanged; it reports that meeting.

### 16.4 Old meetings

Labels in packages accepted before NEW-references were mapped to task numbers (before build `24e5b137`) can't find their task (for example, "No owner yet" listed under "Meeting"). The board will match such a label to its task by the meeting's own task: the new task that cites the same statement. If there is no match, the label stays under the meeting, where it can still be resolved with a note.

### 16.5 Re-imports

When a meeting is re-imported, its labels are rebuilt from the new reply. An earlier resolution applies to a new label that matches it on all four of:
- the meeting;
- the label's kind;
- the task it is about, or the project;
- the quoted statement (the same transcript segment).

A matching label stays resolved. A label that doesn't match reappears, with "a similar item was resolved on <date> by <name>" and that resolution's note. Board changes a resolution made (an owner, a date, a new person) are their own records and are not undone by a re-import.

### 16.6 Limits

- **Contract 0.3.0.** Owner changes and date-only deadlines already sit outside it, in the extension graph. Resolutions and dismissals join them. Tools that read only the 0.3.0 graph won't see them. Nothing changes for other teams.
- **No rename in the contract.** "Edit the task's scope" records the new scope as a note on the task and shows it as the task's current title on the board. The original title stays in the history.
- **The testers' standard moves again.** People now change the board without transcript evidence, with their name and note as the evidence. The out-of-meeting update set the precedent. Aaron decides what goes back to the testers.
- **Authorization is the folder.** The file cannot check who may resolve. Anyone with the workspace JSON can, and every record names them.

### 16.7 Acceptance criteria (Phase 2 is complete when all hold)

1. **Every label kind in §16.1 offers its actions** on the task, in Open items and in Needs attention. One test per kind.
2. **Nothing changes until Save.** Unsaved actions show in the tray, Undo works, and leaving warns.
3. **Save writes one file** with the name, the time, each action, its note, and the board changes. Loading that file on another machine reproduces the same board.
4. **Board changes from resolutions pass the validator.** A refused change shows a plain message and nothing is written.
5. **A resolved item leaves the open views and appears in the history and the Resolved filter**, with who, when, the choice and the note.
6. **Re-import:** a matching label stays resolved; a changed one reappears with the earlier resolution shown. Tested by re-importing a meeting with one label changed and one unchanged.
7. **Old meetings:** "No owner yet" from the Oct 1 package Aaron accepted on the D-UX11 build attaches to AI-403.
8. **Regression:** selftest, jsdom, Playwright t30–t33 and t36 stay green, with by-design changes listed.
9. **The real-meeting question is answered:** the "Morgan" and "Priya" unclear references in that package can be settled with "This is…" or "Add as a new person", and leave Needs attention.

### 16.8 Sequencing

1. Ratify §16 (Aaron).
2. The record format and Save, with the pending tray.
3. The actions, label kind by label kind, starting with Unclear reference, No owner yet and the date labels (the ones people asked about).
4. History, the Resolved filter, re-import matching and the old-meeting fix.
5. Tests (§16.7), knockouts, new build.

### 16.9 Amendments (testers' Phase 2 review, approved by Aaron 2026-10-13)

These take precedence over §16.1–16.8 where they differ.

**A1. A reviewer's note is attestation, not meeting evidence.** Every board change made by a resolution shows, and records, three parts:
- **Meeting basis:** the quoted statement that raised the label (segment and quote).
- **Resolved by:** the resolver's name and the date and time.
- **Resolution note:** the resolver's own words, required.

The change itself reads as a reviewer decision ("Reviewer-confirmed assignment: Sofia Alvarez"). Nothing suggests the transcript assigned an owner, date, status or scope that came from a later decision. In the record the note is "reviewer attestation", never "evidence".

**A2. Conflict-safe save (adapted to a file-based workbench; Aaron approved).** There is no server between machines, so two offline saves can't be prevented. No decision is ever silently overwritten:
- A resolution names the label it settles and, if it replaces one, the specific earlier resolution it **supersedes**.
- **At Save:** if the board has loaded a newer resolution of the same label since the person started, Save stops. It shows that resolution and offers Cancel, or **Supersede**, which requires a new note naming the earlier resolver and date.
- **At load:** two resolutions of one label where neither supersedes the other are a **conflict**. The item returns to Needs attention as "Conflicting resolutions", both decisions side by side, until someone supersedes one.
- Nothing is deleted. Superseded resolutions stay in history.

**A3. No silent rename.** "Edit the task's scope" becomes **"Add scope clarification"**. The original title stays. The clarification shows beneath it, marked as added by a reviewer, and history keeps both.

**A4. Identity controls for a new person.**
- "Add person" requires a full display name, the organization or component if known, and a note explaining the identification.
- It checks existing people and aliases for duplicates before saving.
- An identity inferred from a partial reference is marked "Reviewer-added, not yet verified" until someone verifies it.
- A first name, partial name or role title alone cannot create a person.

**A5. Explicit action wording.** Each action says it changes the board on a reviewer's decision.

| Label | Actions |
|---|---|
| Unclear reference | Match existing person · Add person (full identity details) · Not needed |
| No owner yet | Assign owner · Keep unassigned · Not needed |
| Possible owner change / status change / schedule or date | Confirm change (Confirm owner assignment, Confirm status change, Set task date) · Reject change · Defer |
| Schedule context | Attach to task · Keep at project level · Not needed |
| May be separate work | Keep linked note · Create separate task · Move to another task · Not needed |
| Scope to confirm | Add scope clarification · Create separate task · Leave as written |
| Not a task yet | Create task · Keep as open item · Not needed |
| Possibly missed | Record on task or project · Not needed |
| Meeting administration | Promote to project task · Keep as meeting note · Not needed |
| The chat's own questions and conflicts | Resolve with note · Not needed |

**Defer** keeps the item in Needs attention, marked deferred, with the resolver's note.

**A6. Dismissals stay auditable.** "Not needed", "Reject", "Keep…" and "Defer" each record the original quote, the label type, the resolver, the time and a required reason. The item leaves the attention views and remains in history.

**A7. Stable re-import match.** The match key is **meeting ID + source segment ID + label kind + target task or project**. Quote similarity is used only as a fallback for older packages without stable segment references. This replaces §16.5's quote-based key.

**A8. Hard-stop documentation.** Done: §2 now matches the build (PROJ-ORPHAN-OP is placed and labeled, not stopped).

**Added acceptance criteria (to §16.7):**

10. **Reviewer-attestation separation:** a reviewer-created board update visibly shows the meeting basis, the resolver and time, and the resolution note as separate parts.
11. **Conflict-safe save:** a stale pending resolution cannot overwrite a newer saved one (Save stops), and two independent resolutions of one label surface as "Conflicting resolutions".
12. **No silent rename:** a scope clarification never replaces the original task title.
13. **Identity safety:** adding a person requires full identifying information, a duplicate check and a note; a first name alone is refused.
14. **Resolution history:** rejected, deferred and not-needed actions remain auditable with source, resolver, time and reason.
15. **Stable re-import match:** matching uses meeting and segment identity, with quote text as a fallback only for older packages.
16. **One source of truth for stop behavior:** documentation and implementation agree about PROJ-ORPHAN-OP.

**Build order:** the record and Save, with the tray, supersede and conflicts. Then Unclear reference, No owner yet and the schedule/date labels; "Resolve with note", "Not needed" and "Defer" for every label; history, the Resolved filter, re-import matching and the old-meeting fix. The remaining label actions (attach, move, separate task, scope clarification, promote) come next.

### 16.10 Build status (2026-10-13, build `e7e0f963`)

**Built (first batch, per the §16.9 build order):**
- **The record and Save.** Actions collect in a tray at the bottom of the page ("N changes not saved"), each with Undo. Save asks for the resolver's name (remembered on that machine) and writes one file, `mkg-resolution-<date>-<time>.json`. It is an out-of-meeting update without a chat round: each action is a reviewer statement ("Reviewer-confirmed assignment: … Resolved by: … Meeting basis: … Resolution note: …"), and the board changes cite that statement. The changes go through the import validator; a refused change is never queued and shows a plain message ("The board can't take this change: Unknown new owner …"). Leaving with unsaved changes warns.
- **Supersede and conflicts (A2).** Save stops when a newer decision on the same label was loaded after the action was taken. It offers Cancel, or Supersede with a note naming the earlier resolver and date. At load, two decisions where neither supersedes the other show as "Conflicting resolutions" in Needs attention. A new decision there must name both. Nothing is deleted.
- **Unclear reference.** Match existing person (records the meeting's name as another name for that person), Add person (full name, organization, the name used in the meeting, a note; duplicate check; a first name or role title alone is refused). A person added from a partial reference is marked "reviewer-added, not yet verified" and listed under **Person to verify** until someone verifies them.
- **No owner yet:** Assign owner · Keep unassigned · Not needed. **Owner, status and date labels:** Confirm owner assignment / Confirm status change / Set task date · Reject change · Defer.
- **Resolve with note, Not needed and Defer on every label.** Deferred items stay in Needs attention, marked deferred, with the note.
- **What a resolved item looks like.** It leaves Open items, the task's chips and Needs attention. A task changed by a decision carries a "Reviewer decision" chip with the four parts: the decision, the meeting basis, the resolver and time, and the note (A1). The task history has a Reviewer decisions section, including dismissed and superseded ones (A6). Needs attention has Open and Resolved views.
- **Re-imports (A7).** A label is keyed by meeting, segment, kind and target (quote only when a label has no segment). A matching label stays resolved. A changed one reappears with "A similar item was resolved on … by …" and that note. Board changes made by resolutions survive the re-import.
- **Old meetings (§16.4).** A label naming a NEW-reference from an older package attaches to the meeting's own new task that cites the same statement ("No owner yet" from the Oct 1 package → AI-403).

**Not built yet (next batch):** Attach to task / Move to another task (Schedule context, May be separate work); Create separate task; **Add scope clarification (A3, criterion 12)**; Create task (Not a task yet); Promote to project task (Meeting administration); Record on task or project (Possibly missed). Until then those labels offer Resolve with note, Not needed and Defer. Criterion 1 holds for the built kinds only.

**By-design changes:**
- Needs attention lists a label naming several tasks once per task, so it can be settled per task (§16.1). Aaron's Oct 1 package: 9 items become 11.
- After Accept the board shows the latest state, no longer the board as of the accepted meeting. These are the same unless a later package exists, such as board resolutions after a re-imported meeting.
- A re-imported meeting is validated against the board as of that meeting. Board-resolutions files saved after it still apply on top.

**Fixed while building:**
- In user mode, pasting a revised reply after Accept did not validate on its own, because the reply box had been cleared by code. This affects the "answer the chat's questions and paste the new reply" flow.
- Two folds crashed when a later package changed a task from the meeting being re-imported. This had been latent with out-of-meeting updates too.
- Two decisions files saved in the same second on different machines would share an id, and the second would have replaced the first. The second is now refused with a message.

**Tests:**
- New: `restest.js` (resolution model, 38 checks) and Playwright `t37_phase2.py` (52 checks: criteria 1–11, 13–15).
- `knock_t37.py`: 8 knockouts, all killed. They switch off, in turn: the stale check, validator refusals, the old-meeting match, the identity checks, the resolved filter, conflict detection, the segment key, and the same-moment guard.
- Regression: selftest ALL GREEN; jsdom 27/27; t30–t33 55/55; t36 107/107.
- Criterion 16: `restest.js` r37–r38 check the code and §2 agree on PROJ-ORPHAN-OP.

**Open:** criterion 12 (scope clarification) and the remaining actions; the first-time-user session. Telling the testers about the standard shift (people change the board on their own attestation) is Aaron's call.

### 16.11 Readable items (Aaron, 2026-10-13, build `4e1240f9`)

**Why.** Aaron resolved a real "Unclear reference" and couldn't tell what it was about. The label came from a register seed batch, named no project or task, and its note was about who owns travel planning. The screen said only "Meeting", showed one cited statement cut off mid-sentence, and offered "Match existing person" with no name to match.

**Built:**
1. **Where it came from.** An item with no project or task reads "<source title>, <date> — no project or task named". Items from a meeting read "Meeting: <title>, <date> — …".
2. **Every cited statement in full,** in the item (no longer behind "Source") and in the decision's meeting basis. The record keeps all of them (`label.quotes`), and the package now keeps every decision's statement, including decisions that change nothing on the board.
3. **The unclear name.** An Unclear reference shows "Unclear name: <name>". When the label names no one, it says so and offers no Match or Add person.
4. **Attach to task or project** (brought forward from the next batch). Every label except "Person to verify" can be attached. The item moves to that task or project and stays open there, marked "Attached here by …". A later decision on it replaces the attachment without naming it. The same now holds after Defer, which before would have produced a conflict.

**Tests:**
- New: t37.60–69 (52 → 62 checks); `restest.js` r39–r43 (43 checks).
- Knockouts: 3 more, all killed (11 in total).
- t36.61 is changed by design to the new "Meeting: … no project or task named" wording. Regression is otherwise unchanged: t36 107/107, t30–t33 55/55, jsdom 27/27, selftest ALL GREEN.

## 16.12 Actions by topic, and decisions with several steps (Aaron, 2026-10-13; approved "yes proceed")

**Why.** A real item ("Not matched to the board: Paul Morrisseau owns immediate shipment coordination …") offered no way to add the person. The action table keyed actions to the label's kind, and "Not matched to the board" had no row. The item also needed several things at once: add Paul, give him the shipment task, and leave a note for the task's owner. The build allowed one action per item.

**Actions follow what the item is about.** The label's kind is the starting point and its words decide. Where the board's reading could be wrong, the person can change it.

| Label | Usually about | Starting actions |
|---|---|---|
| Not matched to the board | a person not on the board | Match existing person · Add person (with the owner option) |
| | a task or project not on the board | Create task (Attach covers "match an existing task") |
| Unclear reference | a person | Match existing person · Add person |
| No owner yet · Possible owner change | an owner | Assign owner; the person list includes "Add a new person" |
| Suggestion | work someone proposed | Create task · Add a note to a task |
| Overdue | a date | Set a new date · Confirm completed |
| Conflict | two dates or owners | Choose the date · Choose the owner |
| Open question | something to find out | Create task (someone must find out); the answer is Resolve with note |
| Date, status labels | as §16.9 | Set task date / Confirm status change · Reject change |
| Scope, separate work, Not a task yet, Meeting administration, Possibly missed | as §16.9 | built next |
| Every item | | Attach · Resolve with note · Not needed · Defer |

A full name in the label's note that isn't on the board is offered as the person ("Add person: Paul Morrisseau"). The name is prefilled and can be edited; A4's identity checks still apply.

**One decision per item, with as many steps as it needs.**
- **Steps:** Attach · Match existing person · Add person · Assign owner · Set date · Confirm status · Add a note to a task · Create task. Steps can refer to earlier ones: "Add Paul Morrisseau" → "Create task … owner: Paul Morrisseau" → "Note on the new task".
- **Outcome:** Settle (the item leaves Needs attention) · Keep open (it stays, placed and noted) · Defer.
- **One resolution note** for the decision: the reviewer's attestation, required. A "note on the task" is a separate, optional step: a progress note the task's owner sees on the board.
- **Validated together,** at "Add to changes" and again at Save. If one step is refused, nothing from that decision is queued, and the message names the step.
- **Saved as one record:** the label, the steps in order, the outcome and the note. Each step's board change cites the decision's statement. Supersede and conflict rules stay per item.
- Dismissals (Not needed, Reject, Keep unassigned, Resolve with note, Defer) stay one-step decisions.

**Build status (2026-10-13, build `8c8908b9`):**
- Built as above: actions by topic, a decision made of steps with references between them, the three outcomes, whole-decision validation that names the refused step, and one record per decision.
- "+ Add a new person" in an owner list inserts an Add person step before the step that needs it. Removing a step clears references to it.
- Paul's item, as tested: "Add person: Paul Morrisseau" → "Create task: Coordinate sensor shipment from TTOC to El Paso" (owner Paul) → "Note on the new task" → Settle. That is one line in the tray and one record, and the board shows the task owned by "Paul Morrisseau (reviewer-added, not yet verified)" with the note.
- A board decision that creates a task gets no "Requested by" note; that note is for meetings.

**Tests:**
- t37: 79/79 (t37.70–86 new; t37.02 now expects "Add person: Morgan").
- restest: 53/53.
- Knockouts: 14, all killed.
- Regression unchanged: t36 107/107, t30–t33 55/55, jsdom 27/27, selftest ALL GREEN.

**Still to build:** Add scope clarification (A3, criterion 12) as a step; Promote (Meeting administration) and Record on task or project (Possibly missed) as starting actions over the existing steps; the first-time-user session.

## 16.13 Teams attendance as a continuous person record: MVP (ratified 2026-10-13)

**Why.** Each meeting's Teams attendance report is stored with that meeting as a snapshot. The parser keeps name, email, role, join, leave and duration. But attendance never reaches the people on the board. An attendee who isn't on the board is shown as "(not in register)" when the list is opened, and that is all. Nobody is added, no name variant is learned, nothing follows a person across meetings, and the roster isn't used when a meeting refers to someone by a partial name.

**MVP scope:**
1. **Identity from attendance.** An attendee is matched to a person on the board by email first, then by name (the existing name forms: "Last, First", middle initials, other names). A match records the email on the person, so the next report matches on its own.
2. **"Person to add" items.** An attendee with no match becomes one item under People in Needs attention. It is keyed by the attendee, by email or by name when there is no email, not by meeting, so it appears once however many meetings they attend. It lists the meetings they attended. Actions:
   - **Match existing person:** records the report's name and email on that person.
   - **Add person:** the full name and email come from the report; organization if known; same identity checks (A4) and a required note. Someone on the attendance report was really there, so the person is not marked "not yet verified" on that ground.
   - **Not needed:** for example, a one-time guest or a room account. The reason is required, and the attendee is not raised again for later meetings.
   - **Defer.**
3. **The roster helps with partial names.** An "Unclear reference" to "Morgan" in a meeting where Morgan Reyes attended reads "Possibly Morgan Reyes (attended)". Match and Add person are prefilled from the report.
4. **A person page.** Click a person's name on the board to see:
   - name, other names, organization and email;
   - reviewer-added or verified;
   - meetings attended, with date, title and time in the meeting, read from every meeting's report;
   - first and last seen;
   - tasks owned, open and completed.
5. **History, not overwrite.** Each meeting's report stays as attached. The person page reads across all meetings, so a changing roster shows as who came when.

**Recording.** Matching, adding and dismissing attendees are board decisions (§16.2, §16.12): saved in the decisions file, with the resolver, time and note; supersede and conflict rules apply. Emails go on the person record in the extension graph, like other names. Contract 0.3.0 is unchanged.

**Privacy.** Email addresses are already in each meeting's file, from the report. The person page shows them. The meeting email does not.

**Not in the MVP:**
- expected versus actual attendance, and absence tracking ("missed the last three meetings");
- roles over time, and organization inferred from email domains;
- merging two person records that turn out to be one;
- renaming a person;
- the partner's observer roster (a separate, named list on the project);
- attendance for meetings accepted without a report.

**Aaron's decisions (2026-10-13):**
- (a) Email is the primary identity key, when the report has one.
- (b) "Not needed" on an attendee applies to all later meetings.
- (c) External attendees (partner staff) are offered as people like anyone else.

**Acceptance criteria:**
1. An attendee not on the board appears once under People, with every meeting they attended.
2. Match records the report's name and email, and the next report with that person matches with no item.
3. Add person creates the person with the report's full name and email; a first name alone is refused (A4).
4. Not needed stops the attendee being raised in later meetings, with the reason in history.
5. A partial-name unclear reference names the matching attendee from that meeting.
6. The person page lists meetings attended (with time in meeting) and tasks owned, the same on another machine loading the same files.
7. Each meeting's attendance report is unchanged by any of this.
8. Regression green.

**Build status (2026-10-13, build `e3ddbb4b`):**
- Built as specified. Attendees are matched by email first. A matched email or name variant is recorded on the person through the decision (match or add), so later reports match on their own. Each attendee becomes one "Person to add" item with all the meetings they attended; "Not needed" holds for later meetings. A first-name unclear reference names the attendee of that meeting ("possibly Morgan Reyes (attended this meeting)"), and its Add person is prefilled.
- Clicking a person's name (owner groups, attendee lists) opens the person page.
- Add person from a report is prefilled with the full name and email and is not marked "not yet verified". A first name alone is still refused.
- The attendee list and the attach-time status use the same identity rule ("not on the board" replaces "not in register").

**Tests:**
- t37: 93/93 (t37.90–103 new; t37.103 follows a person by email across name forms).
- restest: 57/57.
- Knockouts: 17 (email matching, the attendee key, the first-name hint).
- Regression: t36 107/107, t30–t33 55/55, jsdom 27/27 (including the attendance suites), selftest ALL GREEN.

### 16.14 Attach: the project limits the task list (Aaron's test, 2026-10-13, build `be1e7376`)

In the Attach step:
- When a project is chosen, the task list shows only that project's tasks, and "no particular task" means the project itself.
- "Any project (pick the task)" lists every task. Picking a task then sets its project.
- Changing the project clears a task from another project.

Tests: t37.110–115 (t37 99/99). Two more knockouts, 19 in all, every one killed. Regression unchanged: t36 107/107, t30–t33 55/55, jsdom 27/27.

## 16.15 Resolution cards: a focused UI/UX improvement (ratified 2026-10-14, with Aaron's five refinements)

**Goal.** A user can read an issue, choose the appropriate action, supply the missing information, and save without confusion. This changes the screen, not the model. It reuses the existing records, the §16.12 decision builder (steps and outcome), the validator, the tray, Save, supersede and conflict rules (A2) and re-import matching (A7). No new states, registries, schemas or abstractions.

**Replaces** the earlier §16.15 draft (a resolution framework), set aside by Aaron on 2026-10-14 as over-engineered.

### 16.15.1 The card

Each item in Needs attention, Open items and on a task's label chip is a card, in this order:
1. **The question:** the label name and its note in plain words; where it came from; the task(s) or project it concerns.
2. **One primary action** (§16.15.2), plus **Later** and **More ▾**.
3. **Meeting evidence (n statements)**, collapsed by default (§16.11 content, unchanged).

**Later** is today's Defer: it needs a reason, and the item stays in Needs attention marked "later".

**More ▾** holds today's other actions:
- **Create task**, **Link to task or project** (today's Attach), **Add a note to a task** and **Set task date**. These never resolve a question; the item stays open after them.
- **Not needed**: closes the item, with a reason. It also covers "this isn't really a question".

**Multi-step decisions stay** (§16.12). Every primary action opens the existing decision builder with its first step filled in. **Add a step** is still there, so one decision can add a person, create a task, assign the owner and add a note, then save together.

### 16.15.2 The primary action, by label

| Label | Primary action | First step in the builder |
|---|---|---|
| No owner yet · Possible owner change | **Assign owner** | Assign owner. Shows "AI-403 owner: Unassigned → Sofia Alvarez" before you add it |
| Unclear reference · Not matched to the board (a person) · Person to add | **Identify person** | Match existing person, with "+ Add a new person" (the existing A4 checks); attendance hints as now (§16.13) |
| Possible status change | **Confirm status** | Confirm status, with the current status shown |
| Not matched to the board (work) · Suggestion · Not a task yet | **Create task** | Create task. Here the missing thing *is* the task, so creating it resolves the item |
| Every other label, **including the date labels** (possible date change, date unclear, possible schedule update, overdue), open question, conflict, scope … | **Answer** | §16.15.3 |

Date labels get **Answer**, not "Set date". Answering a date question records the date; it does not change a task deadline (§16.15.3). A direct deadline change is still in More ▾ as **Set task date**.

### 16.15.3 Answer

- **The answer.** A text box by default. A small picker lets the person switch to **Date or range**, **Person**, **Choice** (type the options, then pick the chosen one) or **Yes/No**. The board does not guess the type.
- **The note.** A short note saying how you know, as A1 already requires.
- **Keep open.** One checkbox: "Keep this open (not confirmed yet)". This is the builder's existing "Keep open" outcome. An answer kept open is recorded and shown on the card ("Current answer: May 18–22, year not stated"), and it offers **no** record changes.
- **Reviewing changes.** When an answer bears on a record the card names, the form lists the possible change as an **unchecked** line, with the current and new value. Nothing changes unless the line is ticked. A ticked line becomes an ordinary §16.12 step, so it goes through the same validator and the tray.
  - A **single date** on a task: "Also set AI-203 due date: none → May 22". A date **range** is recorded as the answer only; no deadline change is offered.
  - A person on a task: "Also make Sofia Alvarez owner of AI-403".
  - Yes/No on a status label: "Also mark AI-205 completed".
  - Text: "Also add this as a note on AI-206".
- **Storage.** An answer is the existing "Resolve with note" record, with the answer (type and value) in its value. Ticked changes are its steps, and "keep open" is its outcome. These are existing fields; no new record kind.

### 16.15.4 Duplicate cards: deferred

No grouping in this phase. Items stay as today: one per label and task. Duplicate cards will be revisited after testing, with the actual cases in front of us.

### 16.15.5 The six pending decisions, settled the simplest safe way

- (a) Record changes start **unchecked**.
- (b) No separate "Confirmed" state; the note says how you know.
- (c) An answer kept open never changes a record.
- (d) No automatic reopening: a later meeting raises its own labels, as today.
- (e) Later needs a reason only, no date.
- (f) No grouping in this phase (§16.15.4).

### 16.15.6 Test set: the Oct 1 board walk (Aaron's package)

The board shows **eleven items**, as today. Expected use:

| Item(s) | Primary action | Expected use |
|---|---|---|
| Transfer schedule: open question on AI-203 and on AI-207; possible date change on AI-203 and on AI-207 | Answer | Date or range: May 18–22, with the year **not stated** in the meeting; "keep open". No deadline change is offered, since the answer is a range kept open. Each of the four items is answered in turn |
| Equipment mounting (AI-206) | Answer | Choice: "on the temporary workstation" / "on separate tables" (typed by the person). Tick "add as a note on AI-206" only if the decision is actually known |
| Observer roster (P2) | Answer | Later: "waiting on James's final list" |
| Invitations (P2) | Answer | Yes/No: sent, yes; "keep open" until James confirms receipt |
| Connectivity (P2) | Answer | More ▾ → Not needed: "a status, not a question" |
| Morgan | Identify person | Morgan Reyes, only if the attendance report or another source supports it; otherwise Later |
| Priya | Identify person | **No match without evidence.** Later ("ask James who was invited"), or Add a new person once her full name is known |
| Staging check (AI-403) | Assign owner | Sofia Alvarez, with the review line shown first |

Plus Aaron's two tests:
- **Paul Morrisseau:** Identify person → + Add a new person → Add a step: Create task (owner Paul) → Add a step: Add a note → Save. One decision.
- **Greg** (seed batch): Answer (text), or More ▾ → Link to the travel task. Linking keeps the item open.

### 16.15.7 Acceptance criteria

1. Every card shows the question, a primary action, Later and More ▾ above the evidence, with the evidence collapsed.
2. Each label in §16.15.2 gets its primary action. The date labels get Answer.
3. Answer defaults to text, and the person can switch to Date or range, Person, Choice or Yes/No.
4. A date answer never changes a task deadline unless the person ticks the offered change, and a range is never offered as a deadline.
5. Create task, Link, Add a note and Set task date leave an open question open. Create task resolves only "Not matched (work)", "Suggestion" and "Not a task yet".
6. An answer that bears on a record lists the change unchecked, with the current and new value, and changes nothing unless ticked.
7. "Keep open" records the answer, shows it on the card, and offers no record changes.
8. Multi-step decisions still work: Paul's decision (add person, create task with him as owner, note) saves as one record from the Identify person card.
9. Everything saved reads in the existing record format, and earlier saves display unchanged.
10. Regression green (selftest, restest, jsdom, t30–t33, t36, t37), with by-design changes listed, plus a knockout for each of rules 1–8.

**Then:** test with real users on the Oct 1 board and fix what actually trips them up. Duplicate cards, project key dates and structured questions from the chat wait until that testing shows the need.

### 16.15.8 Build status (2026-10-14, build `46742181`)

**Built as ratified.**
- Every card shows the question, then **one primary action**, **Later** and **More ▾**, then **Meeting evidence**, collapsed.
- Primary actions follow §16.15.2. Date labels get **Answer**. A reference with no name gets Answer; an unmatched item about work gets Create task.
- **Answer** defaults to text, and the person switches to Date or range, Person, Choice or Yes/No.
  - A date answer can say "the year isn't known".
  - A same-month range reads "May 18–22".
- Possible record changes are listed **unchecked**, with the current value:
  - date → due date, one full date only;
  - person → owner;
  - otherwise → a note on the task.
- **Keep this open** records the answer, which shows on the card as "Current answer (not confirmed yet): …", and refuses any ticked change.
- An answer is the existing "Resolve with note" record: the answer is in its value, ticked changes are its steps, and "keep open" is its outcome. Nothing new in the file format.
- **More ▾** actions (Create task, Link, Add a note, Set task date) open the §16.12 builder and keep the item open ("Still open after …"). The primary actions resolve it.
- **Add a step** is still there in every form, so Paul's decision (add the person, create the task he owns, add a note) is one decision from **Identify person**. "+ Add a new person" in Identify person switches the step to Add person.
- The current value shows next to an owner, status or date change ("AI-403 owner: Unassigned → **Sofia Alvarez**") and updates as you choose.

**Changes from Phase 2 (by design):**
- Reject change and Keep unassigned are now Not needed, with the reason.
- Attach is now **Link to task or project**, and a linked item reads "linked by".
- Defer is **Later**, and a deferred item reads "(later)".
- The evidence is one more click away.

**Fix made while building:**
- An answer's ticked step was overwriting the answer in the saved record.

**Tests:**
- t37: 116/116. The new t37.120–136 cover criteria 1–9 on the Oct 1 board and read a save from build 7d8def41 unchanged. Earlier checks were updated to the new cards, marked by design.
- restest: 62/62.
- t36: 107/107 (t36.58: the evidence is collapsed under the actions, by design).
- t30–t33: 55/55. jsdom: 27/27. selftest: ALL GREEN.
- Knockouts: 27, including one per §16.15 rule. A knockout counts only when its **named** check fails; a crash no longer counts. Under that stricter rule, six knockouts first "passed" because the test crashed before its check ran. The tests now read forms and messages in a way that survives a missing element, and all 27 fail on their named checks.

## 16.16 Open items answered in meetings (approved for feasibility testing 2026-10-14, with Aaron's two conditions; ratified for build 2026-10-14; built, see §16.16.8)

**Why.** Users liked the resolution cards (§16.15) and then asked for an edit button everywhere. That road leads to rebuilding Jira, which was never the point. MeetingGraph turns meetings into a reliable board. So open items should be **answered in meetings**, with the transcript as the evidence, and not edited on the board.

**Board-action work is paused (Aaron, 2026-10-14):**
- §16.15 stays as built in build `46742181`.
- The date-range and dark-mode fixes (unreleased build) are held.
- Nothing more is built on board actions until §16.16 is tested and ratified.
- Decisions already saved keep displaying.

### 16.16.1 The idea

1. **The board shows open items with no action buttons:** the question, what is needed to answer it, the records involved, and the evidence (collapsed).
2. **An "Open items" agenda** can be copied for the next meeting, so someone reads the questions aloud.
3. **The request to the chat lists the open items, each with its existing stable identity** as its ID: meeting ID + segment + label kind + target (A7), for example `20261001T140000Z|S039|ownership|AI-403`. No new ID scheme. A new rule says: when the meeting answers one, record the change as usual and link it to the item by that exact ID, citing the answering words.
4. **The validator checks every link:**
   - the quote is in this meeting;
   - the item exists;
   - the change fits the kind of question.
   Anything unclear leaves the item open.
5. **The import review shows each proposed answer as a proposed closure,** for example "Proposed answer to 'Who owns AI-403?': Sofia Alvarez, 'I'll take the staging check.'", with a **Close this item** box that starts **unchecked**. The validator can confirm that a quote exists and that a change of the right kind exists. It cannot confirm that the words really answer the question. So an item closes **only when the reviewer ticks the box** before Accept. Unticked, the item stays open and shows the proposed answer.
6. **A confirmed closure is recorded with the meeting package:** the item ID, the answer, the quote, and who confirmed it and when. The board marks the item answered in that meeting, and it leaves the open views but stays in history.

**Closing and changing are separate.** The meeting's own changes (an owner, a new person, a new task) are ordinary ops of that meeting, accepted or left out in the review as today. Confirming a closure only closes the item. Leaving it unticked never removes a change.

Answers that come outside a meeting use the existing out-of-meeting update (D-UX6). No board editor.

### 16.16.2 Writing the questions

Each open item reads as a direct question, followed by what is needed. The wording comes from the label kind where possible, and from the chat's note otherwise.

| Label | Question | Needed |
|---|---|---|
| No owner yet · Possible owner change | Who owns AI-403 "Verify staging-area load …"? | One person who accepts it |
| Unclear reference · Not matched (person) · Person to add | Who is "Morgan"? | Their full name and organization, or the person on the board they are |
| Not matched (work) · Suggestion · Not a task yet | Should "Request equipment documentation" be a task, and who owns it? | Yes or no; if yes, the owner |
| Date labels | What are the dates for …? | The date or range, with the year |
| Open question · Conflict · others | The chat's note, as one question | Taken from the note |

### 16.16.3 What the reply adds

Replies gain one optional list, `answers`. Each entry has:
- `item`: the open item's ID, copied exactly as listed;
- `seg` and `quote`: the words that answer it;
- `answer`: a short plain answer;
- `status`: `answered`, or `partial` (shown, never offered for closing);
- `match`: for "who is X?" answered with someone already on the board, that person.

The answer does not list which ops carry it, because the chat would have to count positions and could get that wrong. The validator finds the supporting change itself, by kind and target (§16.16.4).

The changes themselves are ordinary ops, cited and validated as today. A reply without `answers` behaves exactly as now.

### 16.16.4 Validator rules for answers

1. The item ID must **exactly** equal one of the IDs sent in the request. There is no fuzzy matching: a mistyped ID drops the answer.
2. The quote must be in the cited segment of this meeting.
3. The change must fit the question:

   | Question | Required change |
   |---|---|
   | Owner | A Reassign on that task, citing the same segment |
   | Who is X | A NewParty with a full name (A4), or a `match` to an existing person |
   | Should this be a task | A NewTasking, or an answer of "no" |
   | Dates | No change is required; a Deadline appears only if the meeting stated one full date for the task |

4. Failing any rule drops that answer, and the item stays open. The review says why. The rest of the reply is unaffected.
5. Passing the rules only makes an answer a **proposed** closure. The reviewer's tick closes it (§16.16.1, step 5).

### 16.16.5 Test before build

No build until this passes. The test uses the real enterprise model, run by Aaron in the chat, and the existing harness.

**Test kit (to prepare once the approach is approved):**
- **A mock follow-up meeting to the Oct 1 board walk** (about 40 statements) that:
  - answers four items clearly: AI-403's owner is Sofia; Morgan is Morgan Reyes, partner network lead; James received the invitations; mounting goes on separate tables;
  - answers one item ambiguously: "probably the 18th to the 22nd, we're still confirming the year";
  - leaves three unanswered: Priya, the observer roster, connectivity;
  - includes one distractor: someone else's ownership that sounds similar.
- **The request text** with the open-items block and the new rule, built from the current request.
- **A scoring sheet:** for each item, the expected outcome (answered with a given change, partial, or left open).

**Pass criteria (across 3 runs of the enterprise model):**
1. Every clear answer is linked to the right item, with a valid quote and the right change (at most 1 miss in 12).
2. **No unanswered item is ever marked answered.** Any false link fails the test.
3. The ambiguous date is `partial`, or left open, in every run.
4. The distractor is never linked to AI-403.
5. Replies stay otherwise valid: the existing validator passes, and the self-review and coverage tables are unchanged.
6. The harness validator catches seeded bad answers: a mistyped ID, an invented quote, an owner answer without a Reassign, and a "who is X" answered with a first name only.
7. Every ID in every reply is copied exactly. Any mistyped ID is a finding: it would drop that answer, which is safe but loses work.

**If it fails:** report which criterion failed and why, and decide with Aaron whether to reword the questions, change the rule, or drop the approach.

**Test kit prepared (2026-10-14):** `oi-test/`.
- `request-open-items.txt` is the workbench request for the mock Oct 8 meeting, plus the OPEN ITEMS block and rule. Its IDs are the A7 identities.
- `scoring-sheet.md` gives the expected outcome per item, the distractors and the pass criteria.
- `check_answers.py` applies the §16.16.4 rules and scores criteria 1–4 and 7.
- Its self-test (criterion 6) passes: five seeded bad answers are dropped, three scoring catches fire, and the golden reply scores 4/4.
- Criterion 5: the current workbench gives an identical result with and without an `answers` list.
- The mock meeting was edited once before use: a line about "the network drop and backup line" would have made the connectivity item arguably answered, so it now concerns badges.
- **Results (2026-10-14, 3 runs on gpt-5.6-terra-low): all pass criteria met** (`oi-test/results-2026-10-14.md`).
  - 12/12 clear answers linked correctly, 0 false links, no deadline from the unconfirmed dates, and the distractor was ignored.
  - All replies were valid in the workbench, and every ID was copied exactly.
  - The three runs proposed identical answer sets.
- **Findings, to address before build:**
  1. Ask one thing per question. The two-part invitations question came back partial every time.
  2. A partial answer must not also raise a new flag for the same question. Fix the rule text, with a build-side backstop that shows no duplicate item.
  3. `match` is only for who-is questions; tighten the rule text.
- **Testers' review package prepared (2026-10-14):** `oi-test/testers-review-16.16.md` and `request-open-items-v2.txt`, with all three findings fixed.
  - One thing per question: the invitations, observer, connectivity and transfer questions were simplified.
  - New rule 6: no flag for a question answered here.
  - Rule 1: `match` only for who-is items.
  - `check_answers.py --v2` adds C8 (duplicate flags) and C9 (`match` misuse). Both catch the v1 runs 1 and 2, as expected, and the self-tests are green.
- The package goes to the testers when Aaron sends it.
- **v2 results (2026-10-14, 3 runs; `oi-test/results-v2-2026-10-14.md`): pass criteria met again.**
  - 12/12 clear links, 0 false links, the dates partial with no Deadline, and the distractor ignored.
  - Every ID was exact, there were no page errors, and the invitations item is now `answered` in all runs.
  - C8 (duplicate date flag) is clean in 2 of 3 runs; C9 (`match` on the owner item) in 1 of 3. The rule wording doesn't hold the model to these. Both are harmless, so they are handled in the build (ignore `match` outside who-is items; suppress a flag that duplicates an answered item) and kept as diagnostics, not pass criteria.
  - **An existing workbench bug, found by this meeting:**
    - A task owned by a person introduced in the same meeting fails the acceptance check, because the owner ref `NEW-P1` is compared with the speaker's name.
    - Morgan's own commitment (NEW-2) is therefore flagged in all six runs.
    - When the chat also classifies the introduction as context (all three v2 runs), Morgan's NewParty is flagged PARTY-IDENTITY, and the default drops the person. That would undercut the "Who is Morgan?" answer.
    - Fix, proposed for the §16.16 build: resolve `NEW-P` refs to names before the speaker check, and count a passing who-is answer as identity evidence.

### 16.16.6 What changes if ratified and the test passes

- The board's open items lose their action buttons.
- The board gains an Open items agenda.
- The request text, the reply format and the validator gain answers. This is a contract change, so the testers review it first.
- The import review shows answers.
- The board marks items answered in a meeting.

The §16.2–§16.15 board-decision code stays in place, switched off, so saved decisions still read. A narrow fallback can be turned back on if real use shows a need.

### 16.16.7 Decisions for Aaron

- (a) Remove the action buttons now, or only after the test passes. Recommended: after.
- (b) ~~Item IDs~~ Settled by Aaron (2026-10-14): the existing stable identity (A7).
- (c) A `partial` answer stays open and shows the partial answer on the board. Recommended.
- (e) ~~Closing~~ Settled by Aaron (2026-10-14): only a reviewer's explicit tick in the import review closes an item.
- (d) The agenda lists all open items, or only items for the projects on the next meeting's agenda. Built with the recommended simplest default: all open items, plus a per-project copy.
- **Settled by Aaron (2026-10-14), after the v2 runs:**
  - Duplicate flags and stray `match` are handled by the build, not the prompt.
  - The `NEW-P` fix goes into the §16.16 build.
  - Proceed. (a) and (c) were built as recommended: the buttons are off now that the test has passed, and partial answers stay open and show on the board.

### 16.16.8 Build status (2026-10-14)

**What was built:**
- **`openitems.js`** (new shared module, embedded verbatim like `resolve.js`):
  - questions per label kind (§16.16.2) and the list of open items to send;
  - the request text, exactly as tested in v2;
  - the answer checks (§16.16.4): an exact ID; a quote in the cited segment of this meeting; an owner answer needs a Reassign citing it; a who-is answer needs a full-named NewParty citing it, or a match to someone on the board; a should-it-be-a-task answer needs a NewTasking, or "no"; a second answer to the same item is dropped;
  - `match` outside who-is items is ignored, not a reason to drop the answer;
  - flags that repeat an answered question are listed, and the board doesn't show them twice;
  - the people a who-is answer identifies are listed.
- **Request:**
  - The board's open items (as of just before the meeting, excluding the meeting itself) go to the chat with their A7 IDs.
  - With no open items, the request is unchanged.
  - For the mock Oct 8 meeting, the build's request equals the tested v2 request character for character, except the question wording in the OPEN ITEMS block (see the finding below).
- **Import review:**
  - An "Answers to open items" card appears in both views.
  - Each answered item has a **Close this item** box, unchecked by default. Partial answers are shown but never offered for closing.
  - Answers that fail a check are listed with the reason.
  - Closing needs the reviewer's name. Accept is refused without it.
- **Package:** `answers` records every passing answer, with `closed`, and for a closure `confirmedBy`, `confirmedAt` and `supersedes`.
- **Board:**
  - Open items show the question, what is needed, and any answer a meeting proposed: "Partly answered" or "Answered, not confirmed in the review". There are no action buttons.
  - A closed item moves to Resolved ("Answered in …", the meeting's words, "Closure confirmed by …"). It stays in the task's history and applies from that meeting on (the as-of view respects it).
  - "Copy open items as an agenda" is in Needs attention, and "Copy as agenda" in a project's Open items.
- **Validator (`validator.js`):**
  - **The `NEW-P` fix:** a task owned by a person introduced in the same meeting is checked against that person's name, word for word ("Morgan Reyes" matches the speaker "Reyes, Morgan"). PARTY-IDENTITY also counts ops owned by the ref.
  - A passing who-is answer is identity evidence for the person it names.
- **Fallback:** the §16.2–§16.15 actions are switched off, not removed (`MKG_setBoardActions(true)`). Saved decisions still display.
- The held date-range and dark-mode fixes are in this build. They sit in the action forms, which are now off.

**Tests:**
- `t38_openitems.py`: 41/41.
- `oitest.js` (module and validator units): 36/36.
- `knock_t38.py`: 21 knockouts, all killed (strict).
- `t36`: 107/107. `t37`: 117/117, run with the fallback switched on. `restest`: 62/62. Validator self-test: all green.

**Finding: generated questions are only as good as the chat's notes.**
- Owner, who-is and date questions come out direct ("Who owns AI-403 …?", "Who is "Morgan" …?").
- Open questions use the chat's note as it stands. The Oct 1 notes ask several things at once ("Confirm the actual transfer period, whether …, the calendar year, and which dates …").
- The v2 test used hand-written single questions, and the v1 finding was that a two-part question comes back partial. So with the build's own wording, the mounting and invitations items are expected to come back **partial** for the mock meeting, not answered. That is safe, but they won't close.
- `check_answers.py --build` scores against the build's request: 2 clear answers (AI-403, Morgan), and C10 checks that the multi-part items stay partial.
- **Proposed next step (needs Aaron's decision, and a test):** ask the chat, when it raises an open question, to write it as one direct question asking one thing, with a separate flag for each further question. That is a change to the extraction contract, so it is not built.
- **Confirmation run:** run `request-open-items-build.txt` three times on gpt-5.6-terra-low and score it with `check_answers.py --build`.

**Associated with (Aaron, 2026-10-14):**
- Each open item shows what it is about next to its question: the task (a button that opens the work item), or the project with "the meeting named no task", or the meeting when nothing was named.
- In Needs attention the task is no longer repeated above the question.
- On the board, "Needed" says "on the board" instead of the request's "in PEOPLE".
- **Tests:** t38.41–45, and K31–K33 (all killed). The result is t38 46/46 and 24 knockouts. t36 107/107 and t37 117/117 were re-run.

**Not covered:** "Person to verify" and "Person to add" (attendance) items have no meeting segment, so they are not sent to the chat. With the buttons off they can't be settled from the board. Turning the fallback back on for these two kinds alone is a small change, if Aaron wants it.


## 16.17 Dismissing open items with a note (proposed 2026-10-14; ratified by Aaron's "proceed", 2026-10-14, with the recommended answers to (a)–(c); built, see §16.17.1)

**Why.** One real meeting left 33 open items. The project manager says most are irrelevant and wants to dismiss them, with a note. This is a compromise with §16.16 (open items are answered in meetings, not edited on the board): **one** board action, dismiss, and nothing else.

**Proposal: reuse what is already built and tested.**
1. **"Not needed" comes back as the only board action.** It is the existing §16.9 dismissal (t37.98), switched on alone, not the whole fallback.
   - It needs a reason, and is recorded in the dismisser's name and time.
   - It is saved as a board-resolutions file through the tray and Save, as before.
   - The item leaves the open views and stays in Resolved and the task's history (A6).
2. **Dismiss several at once.** In Needs attention and a project's Open items, each item gets a select box. "Dismiss selected (n)" asks for one reason, which is recorded on each item (each still gets its own record).
3. **Dismissed items are not sent to the chat.** They are settled, so they drop out of the OPEN ITEMS block automatically.
4. **Reopen.** In Resolved, a dismissed item has "Reopen", with a reason. It is a superseding record, so nothing is erased (A2) and the item returns to the open views and the next request.
5. Nothing else returns: no answering, assigning or dating on the board. Those stay with meetings (§16.16).

**Decisions for Aaron:**
- (a) Bulk dismiss with one shared reason. Recommended: yes.
- (b) Reopen. Recommended: yes; without it, a mistaken dismissal is permanent.
- (c) Anyone may dismiss (the name is recorded, as with every board decision), or only a named role. Recommended: anyone, recorded; MeetingGraph has no roles.

**Worth watching:** 33 items, mostly irrelevant, suggests the chat over-flags. Dismissals record the label kind, so a simple count of dismissals per kind would show which rule produces noise and should be tightened at the source.

**Tests (when ratified):**
- one dismissal and a bulk dismissal, each with its reason on every item;
- a reason is required;
- dismissed items leave the open views and the next request;
- Reopen brings an item back with the record chain intact;
- the other actions stay off;
- knockouts for each.

### 16.17.1 Build status (2026-10-14)

**Built as proposed:** (a) bulk dismiss, yes; (b) Reopen, yes; (c) anyone may dismiss, with their name recorded.
- **Open items** (Needs attention, a project's Open items, the chips on tasks) offer one action, **Not needed**, plus a **Select** box.
  - "Dismiss selected (n)" sits next to "Copy … agenda". It asks for one reason, and each item gets its own record with that reason.
  - Everything waits in the tray until Save, which asks for the name, checks for stale decisions, and writes a board-resolutions file, as before.
- **Resolved** shows a dismissed item with **Reopen**, which needs a reason. The reopen is a new record (`action: "reopen"`, outcome open) that names and supersedes the dismissal. The item returns to the open items with "Reopened by …".
- **`resolve.js`** gained the `reopen` action.
- **Fix found by the tests: which open items go into a request.**
  - A request is built "as of just before the meeting". So a dismissal saved after that meeting's date (preparing Oct 8 on Oct 14) still left the item in the request.
  - Now the request lists the items raised before the meeting, in their state **now**. A dismissal or closure saved later keeps the item out, and the as-of board view is unchanged.
- **Tests:**
  - t38.46–59 (one item, bulk, reason required, tray and Save, records per item, leaving the open items, Resolved, no other actions, not sent to the chat, Reopen with its supersede chain, sent again after Reopen).
  - t38.32 and t38.39 updated: Not needed is the one action left on.
  - Knockouts K34–K39.
- **Result (build `35b3a2ec`):**
  - t38: 60/60; knockouts: 30 of 30 killed; `oitest` 36/36; `restest` 62/62; validator self-test ALL GREEN.
  - Regression: t36 107/107, t37 117/117, t30–t33 55/55, jsdom 27/27.
