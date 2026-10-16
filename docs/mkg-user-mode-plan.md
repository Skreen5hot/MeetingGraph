# MeetingGraph — user mode (D-UX11)

2026-10-12 · status: **approved for design and build, with amendments (testers, 2026-10-12).** The amendments are folded in below. One ratification step remains before code: the finding class table (section 7) and the D-UX11h trigger rule (section 8). The D-UX10h feasibility result stays failed and closed; nothing in this plan reopens it.

## 1. The problem

Aaron ran the Difficult transcript himself on Oct 12 (one run, two repair rounds) and could not tell what he was supposed to do. If the person who designed it is lost, an ordinary user will give up.

What that run asked of him:

- **About 20 actions before any result.** He entered the date, time and UTC offset, pasted the transcript, numbered the segments, copied a 28,000-character prompt to the chat, pasted the reply back and clicked Validate. Each of the two repair rounds then needed six more steps: open the repair prompt, copy, paste, copy, paste, validate.
- **27 items on the result screen, in three different forms:**
  - 6 reviewer questions, which can only be answered by going back to the chat.
  - 7 coverage findings, each with its own Resolution dropdown.
  - 14 proposed changes, several carrying storage notes such as "Date-only deadlines are unsupported in 0.3.0 (a Temporal Instant needs a clock time)".
- **The tool's own leftovers handed to him as decisions.** Several coverage findings were faults in the chat's reply that two repair rounds did not fix. He could not judge them without knowing the validator.

The workbench shows every part of the pipeline to every user. That serves testers and auditors. It does not serve someone who wants their board updated.

## 2. The principle

A user does three things and nothing else:

1. Give the workbench the meeting.
2. Move text between the workbench and the chat when asked, one button at a time.
3. Approve the changes to their board, and answer the meeting-scope questions only someone familiar with the meeting can answer.

Every check, every finding and the full record stay. Technical findings move out of the user's way into **Reviewer details**. Material ones stay in front of the user, as blocked changes or as questions (D-UX11e).

## 3. Decisions

| Decision | Status |
|---|---|
| D-UX11a two views of one gate | Approved |
| D-UX11b meeting metadata read automatically, segments numbered automatically | Approved |
| D-UX11c one primary next action | Approved |
| D-UX11d plain-language changes and questions | Approved with amendments (below) |
| D-UX11e three finding classes | Amended (below); class table to ratify (section 7) |
| D-UX11f no implementation jargon in user mode | Approved |
| D-UX11g Reviewer details as a workspace setting | Approved |
| D-UX11h reviewer choice for recurring semantic task-scope questions | Approved: option (a); trigger to ratify (section 8) |

- **D-UX11a — two views of one gate.** User mode is the default. Reviewer details is a switch that shows today's full screen. Both views use the same validator, repair loop, gate and package. For the same inputs and the same choices, including the same answers to scope questions, the accepted package is identical apart from timestamps. No check is relaxed in either view.

- **D-UX11b — the meeting goes in in one step.** Opening the Teams .docx reads the title, date and start time from its header (`parseTeamsHeader`). The UTC offset defaults to the browser's time zone for that date, which handles daylight saving. Numbering runs on its own once a transcript and a date are present. The workbench asks for a field only when it cannot fill it, and shows what it filled so the user can correct it.

- **D-UX11c — one next action at a time.** A single primary button changes as the work moves: **Copy for the chat** → **Paste the chat's reply** (validation runs on paste) → if fixes are needed, **Copy the fix request** → **Paste the corrected reply** → **Review changes**. User mode does not show the MUST FIX list; the fix request carries it to the chat. A line says where the user is ("The chat needs one more pass, 1 of 2").

- **D-UX11d — the result screen.** Three kinds of item, each visibly different, so a first-time user can tell them apart:
  - **Changes to your board.** One plain sentence each ("Sofia now owns *Coordinate partner-site access and staging arrangements*"). The speaker's words sit behind "Why?", shown with speaker and time, not a segment ID. Kept by default; any change can be dropped. A change with a class-A finding (section 7) is shown as **can't be accepted as written**: the user drops it, or sends one more fix request if a round remains.
  - **Questions about this meeting.** Source-and-scope questions (D-UX11h and class B). Each needs one answer before **Update the board** is enabled; **Defer** is always one of the answers.
  - **Open items.** The meeting's open questions and flags, kept on the board as open items. Nothing has to be answered here.
  - **Update the board.** One Accept.

  User mode asks for no technical validator decisions. It asks only source-and-scope questions that require someone familiar with the meeting to decide whether a material meeting statement updates a specific board item.

- **D-UX11e — three classes of finding (amended).** Not every unresolved chat defect is minor. Severity depends on whether the affected item would change the board.

  | Class | Finding type | User-mode treatment |
  |---|---|---|
  | A | Structural or evidence defect that makes a proposed board change unreliable | Blocks that change. It cannot be accepted as written: the user drops it, or sends a fix request if a round remains. The rest of the reply can still be accepted. |
  | B | Material semantic scope question that needs meeting knowledge | Shown as a question about this meeting (D-UX11h shape). |
  | C | Traceability or presentation issue that does not affect board content | Recorded in Reviewer details and kept with the package; the user may proceed. |

  Code-by-code assignment: section 7. A finding not in the table, or new, is class B until classified.

- **D-UX11h — reviewer choice for recurring semantic task-scope questions.** The model does not make the final call on recurring, material scope questions. The first kind is whether a meeting's schedule or window change updates an existing task:

  > The meeting described a May 18 to May 22 transfer period. Should this update "Run a test transfer with a sample file"?
  > - **Yes**, update the task
  > - **No**, retain as project-level planning context
  > - **Defer** for review

  - **Trigger.** The trigger creates a candidate question; it does not decide scope and does not claim the task should be updated. It makes sure the question is asked even when the extractor omitted or misfiled the update. Rule: *when a transcript segment states a material schedule, date-range, readiness, travel or operational-window change, and no proposed or accepted update cites that segment for a plausibly related active task, create a reviewer question identifying the candidate task and the source statement.* Prototype and evidence: section 8.
  - **Yes (option (a), chosen).** The workbench creates the source-grounded ProgressNote directly, for example "Reviewer confirmed that the May 18 to May 22 transfer period updates the task. The meeting described May 18 as the setup/configuration day." The op:
    - cites the original transcript segment(s), never a new chat statement;
    - records the reviewer's choice, identity if available and timestamp in the package's review metadata;
    - is labelled internally as reviewer-confirmed;
    - passes through the same gate, provenance, package and acceptance process as every other board change;
    - stays visible in Reviewer details.

    It does not go through the written-statement flow. The reviewer is deciding the scope of existing meeting evidence, not making a new factual assertion.
  - **No.** The statement stays as project-level planning context (an open question on the project), with a record that the reviewer declined to attach it to the candidate task.
  - **Defer.** No board update. The question stays open for later review and is kept with the package.
  - **Scope.** Route and staging stay with the extractor; they are regression-tested behavior (3 of 3 in the final D-UX10h runs). New question kinds join only when the record shows the extractor missing them repeatedly.

- **D-UX11f — plain language in user mode.** No technical finding codes, contract text, segment IDs, op names, NEW- refs or storage-layer caveats. Storage-format notes ("unsupported in 0.3.0") are facts about our format, not decisions for the user, so they appear only in Reviewer details. Names and times replace IDs.

- **D-UX11g — who sees Reviewer details.** A workspace setting, default off, kept in the team folder with the rest of the workspace. The switch is always visible, so nobody is locked out of the full record.

## 4. Acceptance criteria (D-UX11 is complete when all hold)

1. **Same gate.** The same input plus the same reviewer choices yields the same accepted package in user mode and in Reviewer details, apart from timestamps. Automated test on the Difficult golden, the rejected reply, the repair rounds and the D-UX10h tester replies.
2. **D-UX11h is reproducible.** Each of Yes, No and Defer produces a reproducible package result. A Yes update cites the original meeting source. The decision and its rationale are stored in reviewer metadata.
3. **The trigger is tested** on the Difficult fixture (where it must fire), the Atlas fixture, a negative case where the schedule statement is already correctly attached to an active task, and a negative case where the schedule change is unrelated to any active task. Section 8 has the prototype results.
4. **No jargon.** User mode shows no technical finding codes, contract text, segment IDs or storage-layer caveats. Automated scan for: `contract`, `0.3.0`, `extension`, `NewTasking`, `ProgressNote`, `NEW-`, `S0`, every finding code, `coverage`, `disposition`.
5. **Material defects are never logged as minor.** Every class-A finding blocks its change and every class-B finding becomes a question. An automated test feeds one example of each class-A and class-B code and checks the treatment.
6. **Three things a first-time user can tell apart:** "Approve these board changes", "Answer this meeting-scope question" and "The chat reply needs another correction". Someone outside the build team processes the Difficult transcript with only the on-screen text. Pass means they reach Accept, or a deliberate Defer, without asking for help.
7. **Fewer actions.** Opening the .docx through the first validation takes 5 actions, down from about 10. Each repair round takes 4, down from 6.

## 5. Limits

- **The chat round trip stays.** The enterprise model is chat-only in Edge, with no API, so the copy and paste between workbench and chat cannot be removed.
- **User mode does not improve extraction.** The route and staging classifications remain regression-tested extractor behavior. Recurring schedule-to-task scope decisions, which did not meet the terra-low feasibility standard, are surfaced to the reviewer under D-UX11h.
- **The hygiene checks are not feasibility evidence.** The three mechanical checks built on Oct 12 are regression checks that detect known output-quality defects. They do not establish model feasibility or reopen the D-UX10h test result.
- **Known gap, documented.** A task can borrow timing from another deliverable's sentence ("get them out today"). Timing interpretation is not broadened again until the intended semantics and test cases are defined.
- **Records still need a reader.** Class-C findings are kept for Reviewer details. Who reads that record, and how often, is a team decision outside this plan.

## 6. Sequencing

1. ~~Ratify or amend D-UX11a–g.~~ Done 2026-10-12 (amendments above).
2. ~~Final feasibility test.~~ Decided 2026-10-12: failed; stop rule triggered.
3. ~~Ratify the finding class table (section 7) and the trigger rule (section 8).~~ Done 2026-10-12, with two amendments during build (section 7).
4. ~~Build user mode against section 4.~~ Built 2026-10-12: MeetingGraph.html `1c16408b…`.
5. Full suite and new tests: done (status below). **The first-time-user session (criterion 6) is still to run.**
6. ~~New build hash.~~ `1c16408b…`. The testers keep Reviewer details on.

**Build status against section 4 (2026-10-12):**

| # | Criterion | Status |
|---|---|---|
| 1 | Same gate | Met. t35.14 (D-UX10h run 2 with Yes/Defer, drops and an undate) and t35.28 on nine replies: the golden, the rejected reply, the four repair rounds, terra-low run 3, run 2 and the golden in the older format without tables. Knockout confirmed. |
| 2 | D-UX11h reproducible | Met. t35.15–18: Yes cites S014 and is marked reviewer-confirmed; No records project-level context; Defer adds nothing; all three stored in `pkg.review`. |
| 3 | Trigger tested | Met (section 8). Still needs one unseen real meeting before general use. |
| 4 | No jargon | Met on all nine replies (t35.5, .8, .29). Knockout: the first wording of the no-tables question said "coverage" and the scan caught it. |
| 5 | Class A / B treatment | Met for every finding code the mutation set produces (selftest). Codes no mutation produces are classified by the table but not fed one by one. |
| 6 | First-time user | **Not yet run.** Needs someone outside the build team. |
| 7 | Fewer actions | Counted from the screens: open the .docx, set the date, Copy for the chat, paste the reply (validation runs on paste) — 4 workbench actions, plus the copy and paste in the chat. A repair round is Copy the fix request and paste the corrected reply — 2, plus the chat. Not yet measured in a person's session; t35 pastes the transcript instead of opening a .docx. |

**Added during build:** when the person's own choices leave something behind, the screen says so before Update the board ("What your choices leave behind") and the package records it. Example: dropping the summaries task in run 2 leaves "summaries" promised only in the transcript task's sentence. A new problem the person did not cause holds Update the board.

## 7. Finding class table (ratified 2026-10-12; two amendments during build, below)

**Class A — blocks the affected change.** It cannot be accepted as written; drop it, or send a fix request if a round remains.

| Code | Why it changes the board |
|---|---|
| CITE-RANGE | The evidence cannot be checked. |
| REF-DANGLING (on an op) | The change points at something that does not exist. |
| TIME-UNGROUNDED | The due date is not supported. Proposed remedy in user mode: accept the change **without the date** instead of dropping it. |
| TIMING-MERGED, DELIVERABLES-MERGED, DECOMP-MERGED | One task conflates separate deliverables or deadlines. |
| DELIVERABLE-DROPPED (on a new task) | A committed deliverable is missing from the task. |
| CONTINGENCY-DROPPED | The stated fallback is lost. |
| TASK-NO-ACCEPTANCE | Wrong or unsupported owner, or a task nobody asked for. |
| PROJ-UNSUPPORTED, PROJ-ORPHAN-OP | Wrong project association. |
| PARTY-IDENTITY | A person created from a name alone. |
| ADMIN-IN-PROJECT, CONDITIONAL-TASKING | Meeting administration or a conditional instruction recorded as project work. |
| Hard errors | The whole reply cannot be used: "The chat reply needs another correction." Missing tables (`tables_missing`) moved to class B by amendment 1. |

**Class B — question about this meeting.**

| Code | Question shape | Answers |
|---|---|---|
| D-UX11h trigger | "The meeting said … Should this update *task*?" | Yes (reviewer-confirmed update) / No / Defer |
| COV-UNRESOLVED, COV-POSSIBLE-MATCH, `possible_match`, `unsupported_not_discussed`, COV-CLAIM-UNSUPPORTED | "Does this discussion update *task*?" | Same as D-UX11h. **To ratify:** this extends option (a) authoring to the AI-203 family of findings. |
| NEW-DUPLICATE, COV-DEFERRED-NEW, MATCH-BETTER-TARGET | "Is *new task* the same work as *existing task*?" / "Does this note belong on *other task*?" | Keep / Drop / Defer (no new authoring) |
| OVER-SPLIT | "Are these one task?" | Keep both / Keep the first only / Defer |
| COMMITMENT-MISCLASSIFIED, COV-UNBOUND-DISPOSITION (commitment, decision or status), `discussed_no_output`, `unresolved_commitment` (warn), DISP-MISSING, COV-MISSING-ITEM | "The meeting said … Nothing on the board records it." | Record as an open item / Not needed / Defer |

**Class C — recorded in Reviewer details.**

| Code | Why it does not change the board |
|---|---|
| QUOTE-TRUNCATED | A dropped deliverable is caught separately as DELIVERABLE-DROPPED (class A). |
| SELF-REVIEW-MISSING, SELF-REVIEW-INCOMPLETE, REF-DANGLING (in selfReview) | Class C only when no duplicate finding exists for the same task. Otherwise the duplicate question (class B) carries it. |
| COV-EMPTY-RATIONALE, COV-CONTRADICTION, DISP-ABOUT-PROJECT, `misbound`, `missing_disposition` (info) | Consistency of the reply's own tables. |
| MATCH-SCOPE-MISFIT, PROJ-LINK-ONLY | Weak-signal advisories. |
| DELIVERABLE-DROPPED (on a note, warn) | A note, not a task. |
| Storage-format notes; "only one citation" | Facts about our format and evidence style. |
| The extractor's own `uncertain_requires_review` notes | Its material doubts already arrive as flags (open items). **To confirm.** |

**Amendments ratified during build (2026-10-12).** The first two came from the existing regression suite, which failed on the first ratified gate; the rest from Aaron's own test runs.

1. **A reply with no coverage tables asks; it does not block.** `tables_missing` is a class B question: "The chat's reply doesn't say how it handled each part of the meeting, so the workbench can't tell whether it missed anything. Accept it as it is?" Answers: Accept it as it is / Defer (accept now, check against the meeting later). Before D-UX11 such replies were accepted with a coverage finding; blocking them would have refused replies the workbench has always accepted.
2. **A call the chat already made and justified is recorded, not asked.** NEW-DUPLICATE and MATCH-BETTER-TARGET with no repair attached, and `unsupported_not_discussed` at info level, are class C. The chat's reasoning is kept in Reviewer details. Asking the person to re-decide a justified call is exactly the overload D-UX11 removes.

3. **Unowned tasks (Aaron, 2026-10-12).** Work the meeting asked for is created unowned, with a note naming who asked; it is not blocked as "nobody took it on". "Should" and bare questions are not requests. See the remediation plan addendum.

4. **Attach to existing work (Aaron, 2026-10-12).** A possible duplicate offers "Add it to <task> as a note" for each fitting task instead of "Drop it"; a misplaced note offers "Move it to <task>". See the remediation plan addendum.
5. **"Those materials" (Aaron, 2026-10-12).** A deliverable word after "those"/"these" refers back and is not a missing deliverable (R06/D06 revised).

## 8. D-UX11h trigger: prototype and evidence (ratified 2026-10-12)

`dux11-trigger.js` (now embedded in the build, verbatim, like the validator). It proposes questions and never touches the gate.

1. **Material change.** A date range ("May eighteenth through May twenty-second", "October 20 through October 30"), or a change word next to a date (changed, moved, narrowed, shifted, rescheduled, postponed, "now being described/expected as"). A dated mention alone ("ready on the eighteenth") is not a change.
2. **Plausibly related task.**
   - The statement shares a word with an active task's label.
   - The statement plus the discussion around it (one segment before, three after) shares enough to tell that task apart. Words are weighted by rarity among active labels ("transfer", in 3 of 6 Difficult labels, counts one third); at least one full weight is required.
3. **Not attached.** No update op on that task cites the segment. Flags do not count.

**Results (harness selftest, all OK):**

| Case | Result |
|---|---|
| Difficult golden: window attached to AI-203 and AI-207 (negative: already attached) | No question |
| 9 terra-low replies from Oct 12 (Difficult) | Asks about AI-203 exactly when no AI-203 update cites S014 (8 of 9 replies), and about AI-207 exactly when its update does not cite S014. 9/9 match. |
| Synthetic unrelated change ("The holiday luncheon moved from December third to December fifth") | No question |
| Atlas golden and Atlas flawed reply | No question. S003 (Oct 20–30 → Oct 20–24) is recognised as a change, but its only link is "travel", shared by three Atlas labels; the agreed Atlas golden keeps it as an open question. |

**Caveat.** The rule was adjusted twice on the Difficult data:
- The first version asked 7 questions on the golden.
- A second version hid AI-203 when AI-207 was attached.

So its Difficult results are not independent evidence. Atlas and the synthetic case were not used to tune it. Before the trigger is accepted for general use, run it on at least one more real meeting not seen during design. That is a test of the trigger, not a feasibility test of the extractor.
