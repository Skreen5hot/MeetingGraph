# MeetingGraph 2 export format

Version `1.1` (plan §10.30, 2026-10-17; clarified in §10.31). This is the contract for apps that read MeetingGraph's files, such as Dossier Studio. MeetingGraph owns it; a change to it is a numbered plan change.

A unit test (`t53h` in `tests/v2/unit/v2test.js`) fails if a package MeetingGraph saves holds a field that is not in the tables below. The tables are therefore complete for everything MeetingGraph writes. Fields marked *optional* may be absent.

## 1. Reading rules

1. **The packages are the record.** Each saved meeting, spreadsheet start or board decision is one package (one JSON file in the team folder). `derived` is computed from them for convenience; if the two ever disagree, trust the packages.
2. **Keep unknown fields.** Later versions add fields. A reader must keep or ignore them, never reject the file.
3. **Nothing is overwritten.** A re-save is a new package that `supersedes` the earlier one; both files stay.
4. **Which saves count** (meetings and spreadsheet starts):
   - drop every package named by another package's `supersedes` or `alsoSupersedes`;
   - if two saves of one meeting remain (a *conflict*), the first-saved (`savedAt`, then `id`) is used, and the others are listed but ignored;
   - a meeting is identified by `meeting.id`, a spreadsheet start by its first project's code plus `meeting.id`.
5. **Board decisions** (`kind: "board"`) all count unless superseded. Each applies in time order at `max(savedAt, after)`: never before the last meeting that was on the board when it was made.
6. **The replay.** The board is the counted packages applied in order of `meeting.id` (a board decision by the time in rule 5), starting each item at its first package and applying later updates and decisions to it. `derived.threads` is the result.
7. **Evidence.** An item's source is the statement `seg` of the same package. Statement IDs (`S001` …) restart in every meeting, so a statement is identified by package `id` plus statement `id`.
8. **What is not meeting evidence (rule A1).** These are records of a person's decision, with their name, not things said in the meeting:
   - board packages;
   - items with `byReview: true` (a reviewer's closure);
   - items with `added: true` (typed in by the PM from a statement they chose);
   - a spreadsheet start's items, which have no statements.
9. **Not separate work:**
   - an item with `mergedInto` is the same as another item of its meeting;
   - an item with `statusOf` carries a status split off another item (see `relatedTo`).
10. **Sources to check.** An item with `toCheck: true` has words that were not found in the transcript. MeetingGraph leaves it out of emails; a reader should not treat it as evidence.
11. **How quoted words are found.** MeetingGraph compares *words in order*, not characters:
    - case and punctuation are ignored, and dashes, curly quotes and spaces are normalised;
    - whole words only (`is` never matches inside `island`).

    So `items[].words` is not always an exact character substring of the statement: `the 2nd is` is found in `the 2nd. Is`. To use MeetingGraph's check, trust `src` (`verified` or `near`, with `toCheck: false`), or apply the same rule.

## 2. Identifiers

- **Item ID:** `CODE-KIND-YYMMDD[b]-NN`, for example `HP-A-261019-03`.
  - `CODE` is the project's code (2–4 letters or digits).
  - `KIND` is `A` for an action (a commitment), `Q` for a question, `R` for a risk, `D` for a decision.
  - `YYMMDD` is the meeting's date. A letter (`b`, `c` …) follows it for a second meeting of the project on one day.
  - `NN` numbers the items of that project, kind and day.

  IDs are given when a meeting is saved and never change, and a dropped ID is never reused. Updates and notes get no ID.
- **Meeting ID:** the meeting's start in UTC, `YYYYMMDDTHHMMSSZ`. A spreadsheet start uses its "as of" date at `T000000Z`.
- **Package ID** ends in the save time, `STAMP`. The prefixes are:
  - `mkg2-meeting-[CODE-]MEETINGID-STAMP`;
  - `mkg2-seed-CODES-YYYYMMDD-STAMP`;
  - `mkg2-board-ACTION-ITEMID-STAMP` or `mkg2-board-ACTION-PROJECT-STAMP`;
  - a save chosen over a conflict is `OTHERID-chosen-STAMP`.

  Since 1.1, `STAMP` is the save time to the millisecond (`20261017T080312123`). Packages saved earlier stop at the second (`20261017T080312`), and those IDs stay valid.
- **People** are identified by name, as written in the people register (`derived.people`). Stable person IDs are not part of 1.1.

## 3. The workspace file

"Export workspace" writes the full file: the team folder's backup. "Export for sharing" writes a reduced file for another app (`reduced: true`); MeetingGraph refuses to open a reduced file.

<!-- fields:workspace -->
| Field | Meaning |
|---|---|
| `mkg2Workspace` | `"1.1"` (`"1.0"` files have no `derived`). |
| `exportedAt` | When the file was written (ISO time). |
| `packages` | The packages (sections 4–6). In a full file: every package, unchanged, including superseded saves. In a reduced file: reduced copies of the saves in use only. |
| `derived` | The board as replayed (section 7). |
| `reduced` | *Optional.* `true` in a file from "Export for sharing". |
| `scope` | *Reduced files only.* What was chosen: |
| `scope.projects` | the project codes; |
| `scope.from` | the first meeting date included (`YYYY-MM-DD`); |
| `scope.to` | the last meeting date included. A board decision is included by the date it was saved. |
<!-- /fields -->

**A reduced file differs from the full file as follows.** Each of its packages keeps its source's `id` and carries `reduced: true`: it is a view of that save, not a different save.
- Only the chosen projects' items are kept, with their `projects`, `minted` and `meeting.dayKeys` entries.
- Only the statements a kept item cites (`seg`) are kept, except for items still to check (`toCheck: true`), whose words were not found in the statement (§10.31). `citedSeg`, and the `seg` of a to-check item, may then name a statement that is not in the file.
- `reply.summary` is `null` when the meeting also covered projects that were not chosen.
- `attendance` is removed. `aliases` keep only the labels of kept statements and items.
- `request.openIds` and `newProjects` are cut down to the chosen projects.
- A spreadsheet start keeps only the people its kept items name, with no `email`.
- `derived` is computed from the whole workspace up to the end of the range, then cut down to the chosen projects:
  - meetings after `scope.to`, and board decisions saved after it, are left out (§10.31);
  - its threads can include work created before `scope.from`, whose packages and statements are not in the file;
  - `derived.packages.superseded` and `.conflicts` are always empty, because only the saves in use are shared, and every package in the file is listed in `derived.packages.inUse` or `.boardDecisions`;
  - `derived.people` covers only the shared packages, so a `threads[].owner` from before the range may have no entry: treat an owner as a display name.
- **Fixtures.** Synthetic full and shared files that exercise every rule are in `tests/v2/fixtures/export-1.1/`, with a README. A unit test rebuilds them from the code, so they always match it.

## 4. Meeting package (`kind: "meeting"`)

<!-- fields:meeting -->
| Field | Meaning |
|---|---|
| `mkg2` | Package format, `"1.0"`. |
| `kind` | `"meeting"`. |
| `id` | Package ID (section 2). |
| `savedAt` | When it was saved (ISO time). |
| `savedBy` | Who saved it (the name they typed). |
| `supersedes` | The package ID this save replaces, or `null`. |
| `alsoSupersedes` | *Optional.* A save chosen over a conflict also replaces these package IDs. |
| `reduced` | *Optional.* `true` in an export for sharing. |
| `project` | The first project the meeting covered, or `null`: |
| `project.code` | its code; |
| `project.name` | its name. |
| `projects` | Every project the meeting covered, in order: |
| `projects[].code` | its code; |
| `projects[].name` | its name. |
| `meeting` | The meeting: |
| `meeting.id` | Meeting ID (UTC start). |
| `meeting.date` | Its date, `YYYY-MM-DD`, local to the meeting. |
| `meeting.time` | Its start time, `HH:MM`, local. |
| `meeting.offset` | Its UTC offset, e.g. `-04:00`. |
| `meeting.title` | Its title. |
| `meeting.dayKey` | The first project's day key (`YYMMDD[b]`). |
| `meeting.dayKeys` | Each project's day key, `{ CODE: "YYMMDD[b]" }`. |
| `statements` | The numbered transcript: |
| `statements[].id` | Statement number, `S001` …, unique within this package only. |
| `statements[].t` | Time in the recording, `HH:MM:SS`, or `null`. |
| `statements[].speaker` | The speaker label as Teams wrote it (e.g. `Okafor, Grace`). The person it means is in the people register. |
| `statements[].text` | What was said, verbatim from the transcript. |
| `request` | The request sent to the chat: |
| `request.token` | Its context token (it ties the reply to the request). |
| `request.kind` | `seed` (no open items listed) or `followup`. |
| `request.openIds` | The item IDs it listed as open. Only these could be updated by this meeting. |
| `reply` | About the chat's reply: |
| `reply.summary` | The chat's summary of the whole meeting (3–5 sentences). Not edited by the review. `null` in a reduced package whose meeting covered other projects. |
| `reply.lastSeg` | The last statement the chat named. |
| `reply.lastSegOk` | Whether that was the meeting's real last statement. |
| `reply.cut` | Why the reply was cut off, or `null`. Only complete items were kept. |
| `reply.note` | A note about the reply (e.g. a miscounted end line), or `null`. |
| `items` | The items, as reviewed (below). |
| `minted` | Numbering state, for re-saves: |
| `minted.maxNum` | The highest number used per `CODE:KIND`. |
| `newProjects` | The review's decision on each new project the chat proposed or the PM added: |
| `newProjects[].ref` | The chat's ref (`J1` …) or the PM's (`PM1` …). |
| `newProjects[].name` | Its name. |
| `newProjects[].decision` | `add`, `same` (the same as a listed project) or `no`. |
| `newProjects[].action` | The same as `decision`, in packages written by test tools; the page writes `decision`. |
| `newProjects[].code` | The code it got, or `null`. |
| `newProjects[].seg` | The statement where the meeting discusses it, or `null` for the PM's. |
| `newProjects[].words` | The words quoted from it. |
| `newProjects[].src` | Whether those words were found (as `items[].src`). |
| `newProjects[].byPM` | `true` when the PM added it. |
| `aliases` | The review's answers about people: |
| `aliases[].label` | A label (a speaker label or a name the chat gave). |
| `aliases[].person` | The person it means, or `null` for "No owner". |
| `attendance` | *Optional.* The Teams attendance report, read locally. Never in a reduced file: |
| `attendance.title` | the meeting title in the report; |
| `attendance.start` | the start as the report wrote it; |
| `attendance.end` | the end as the report wrote it; |
| `attendance.duration` | the duration as the report wrote it; |
| `attendance.participants` | each participant: |
| `attendance.participants[].name` | their name in the report; |
| `attendance.participants[].person` | the person matched, or `null`; |
| `attendance.participants[].role` | their role (e.g. Organizer); |
| `attendance.participants[].join` | the first time they joined; |
| `attendance.participants[].leave` | the last time they left; |
| `attendance.participants[].duration` | their time in the meeting. |
| `items[].n` | Item number within the package (1, 2 …). Not an ID: use `id` or package `id` + `n`. |
| `items[].id` | Its ID, when the item starts new work (a commitment, question, risk or decision with no `thread`); otherwise `null`. |
| `items[].ref` | The chat's ref (`N1` …) in a follow-up meeting, or `null`. |
| `items[].kind` | `commitment`, `decision`, `question`, `risk` or `update`. A commitment's ID has kind `A` (action). |
| `items[].topic` | 2–5 words the chat gave for the subject. |
| `items[].who` | The chat's label. **For a commitment, who will do it; for anything else, who raised or settled it.** It is not necessarily the owner; use `person`. |
| `items[].person` | The person as the review resolved `who` (the owner, for a commitment), or `null`. |
| `items[].whoIsSpeaker` | Whether `who` was a speaker label of this meeting. |
| `items[].what` | One line saying what it is (the chat's wording, possibly edited in the review). |
| `items[].due` | The due date as said ("by Friday"), or `null`. |
| `items[].dueDate` | That date resolved (`YYYY-MM-DD`), or `null` for a vague one. |
| `items[].importance` | `high` or `normal`. |
| `items[].thread` | The ID of the open item this one reports on, or `null` for new work. |
| `items[].status` | For an item on a thread: `done`, `blocked` or `in_progress` as the meeting said, else `null`. |
| `items[].applied` | Whether that status counts on the board. False when the PM kept it off, or its source is to check and the PM didn't confirm it. |
| `items[].statusUndone` | The PM kept the status off. |
| `items[].statusConfirmed` | The PM confirmed a status whose source was to check. |
| `items[].waitsOn` | The chat's waits-on (a ref or an ID), or `null`. |
| `items[].waitsOnId` | The item ID it waits on, resolved, or `null`. |
| `items[].project` | The project code of new work (an item on a thread belongs to the thread's project). |
| `items[].chatProject` | The project the chat gave, or `null` ("not clear"). |
| `items[].projectRef` | The new project's ref the chat gave, if any. |
| `items[].movedByPM` | The PM moved it to another project than the chat's. |
| `items[].placedByPM` | The PM placed it where the chat said "not clear". |
| `items[].seg` | **The checked source statement**: where the quoted words were found. Use this one. |
| `items[].citedSeg` | The statement the chat cited. It differs from `seg` when the words were found nearby. |
| `items[].words` | 3–10 words quoted from the statement. |
| `items[].src` | `verified` (in the cited statement), `near` (within two statements), `misplaced` (elsewhere in the meeting) or `not found`, by the word rule in section 1, rule 11. |
| `items[].toCheck` | True for `misplaced` or `not found`: not evidence (rule 10). |
| `items[].notes` | How the item was adjusted when read or reviewed (plain-language notes). |
| `items[].edited` | *Optional.* What the PM changed: `thread`, `same as`, `owner`, `due`, `due date`, `importance`. |
| `items[].mergedInto` | *Optional.* The `n` of the item of this meeting it is the same as (rule 9). |
| `items[].relatedTo` | *Optional.* The open item this new work is about. Set when the chat attached a commitment or decision to an item it could not continue, or on a reviewer's closure. |
| `items[].statusOf` | *Optional.* The `n` of the item whose status this update carries (rule 9). |
| `items[].byReview` | *Optional.* A closure the reviewer chose, not the chat (rule 8). |
| `items[].added` | *Optional.* Added by the PM from a statement (rule 8). |
<!-- /fields -->

## 5. Spreadsheet start (`kind: "seed"`)

A board started from a CSV: projects, people and open work, with no transcript.

<!-- fields:seed -->
| Field | Meaning |
|---|---|
| `mkg2` | `"1.0"`. |
| `kind` | `"seed"`. |
| `id` | Package ID. |
| `savedAt` | When it was saved. |
| `savedBy` | Who saved it. |
| `supersedes` | The earlier spreadsheet start of the same projects it replaces, or `null`. |
| `reduced` | *Optional.* `true` in an export for sharing. |
| `project` | The first project: |
| `project.code` | its code; |
| `project.name` | its name; |
| `project.desc` | its description from the CSV. |
| `projects` | Every project in the CSV: |
| `projects[].code` | its code; |
| `projects[].name` | its name; |
| `projects[].desc` | its description. |
| `meeting` | A stand-in meeting dated "Board as of": |
| `meeting.id` | `YYYYMMDDT000000Z`; |
| `meeting.date` | the "as of" date; |
| `meeting.title` | `Board as of YYYY-MM-DD`; |
| `meeting.dayKey` | `YYMMDD`. |
| `people` | The people rows: |
| `people[].name` | their name; |
| `people[].email` | their email, or `null`. Never in a reduced file; |
| `people[].teams` | their Teams label, or `null`. |
| `items` | The work rows: |
| `items[].n` | Item number. |
| `items[].row` | The CSV row (header = row 1). |
| `items[].id` | Its ID. |
| `items[].kind` | `commitment`, `question`, `risk` or `decision`. |
| `items[].project` | Its project code. |
| `items[].who` | The owner as written (a person's Teams label when matched). |
| `items[].what` | The row's Title. |
| `items[].due` | The due date as written, or `null`. |
| `items[].dueDate` | That date as `YYYY-MM-DD` when it was one, else `null`. |
| `items[].decidedOn` | A decision's date, or `null`. |
| `items[].status` | `open`, `in_progress`, `blocked`, `done`, or `decided` for a decision. |
| `items[].notes` | The row's Notes (text). |
| `items[].waitsOnRow` | The row it waits on, or `null`. |
| `items[].waitsOnId` | The ID it waits on, or `null`. |
| `items[].seg` | Always `null`: no transcript. |
| `items[].src` | Always `seed`. |
| `items[].toCheck` | Always `false`. |
| `items[].thread` | Always `null`. |
| `minted` | Numbering state: |
| `minted.maxNum` | Always `{}`. |
<!-- /fields -->

## 6. Board decision (`kind: "board"`)

A decision made on the Board, outside a meeting, with a name and a note. It is never meeting evidence.

<!-- fields:board -->
| Field | Meaning |
|---|---|
| `mkg2` | `"1.0"`. |
| `kind` | `"board"`. |
| `id` | Package ID. |
| `savedAt` | When it was made. |
| `savedBy` | Who made it. |
| `supersedes` | Always `null` today. |
| `reduced` | *Optional.* `true` in an export for sharing. |
| `action` | The decision (below). |
| `threads` | The item IDs it applies to (one, from the item dialog). Empty for a project decision. |
| `project` | *Project decisions only.* The project code. |
| `note` | Why, in the person's words (required). |
| `after` | The last meeting ID on the board when it was made, or `null` (rule 5). |
<!-- /fields -->

**What each `action` does on replay.** Decisions (kind `D`) never take a board decision.

| `action` | Effect |
|---|---|
| `settled` | Marked completed (an action) or resolved (a question or risk): the status becomes `done`, with `settledOutside` set. |
| `not_needed` | The status becomes `not_needed`. |
| `undo` | Restores the earlier status (one step back in `statusStack`). |
| `raise` | "Bring back into discussion": a parked item is listed first in the next request. It clears when a later meeting mentions the item. |
| `lower` | Takes the raise back. |
| `close_project` | Closes `project`. Each open action, question and risk of the project becomes `not_needed`, with `closedWithProject` set; decisions stay in effect. The project leaves new requests. |
| `reopen_project` | Each item closed with the project goes back to the status it had; the project is listed again. |

## 7. `derived`: the board as replayed

<!-- fields:derived -->
| Field | Meaning |
|---|---|
| `computedFrom` | What it was computed from (plain words). |
| `asOf` | The last meeting or spreadsheet start included: |
| `asOf.meetingId` | its meeting ID; |
| `asOf.date` | its date; |
| `asOf.title` | its title. |
| `packages` | Which saves count (rules 4–5): |
| `packages.inUse` | the meeting and spreadsheet packages in use; |
| `packages.superseded` | those replaced by a later save; |
| `packages.conflicts` | meetings saved twice: |
| `packages.conflicts[].meeting` | the meeting ID; |
| `packages.conflicts[].project` | its first project; |
| `packages.conflicts[].used` | the save in use; |
| `packages.conflicts[].others` | the saves ignored; |
| `packages.boardDecisions` | the board packages that count. |
| `projects` | Every project: |
| `projects[].code` | its code; |
| `projects[].name` | its name. |
| `closedProjects` | Projects closed now: |
| `closedProjects[].code` | the code; |
| `closedProjects[].by` | who closed it; |
| `closedProjects[].note` | why; |
| `closedProjects[].at` | when (ISO time); |
| `closedProjects[].key` | when it applied on replay; |
| `closedProjects[].board` | the board package; |
| `closedProjects[].ids` | the items closed with it. |
| `threads` | Every item with an ID, in the order created: |
| `threads[].id` | its ID; |
| `threads[].kind` | `action`, `question`, `risk` or `decision`; |
| `threads[].project` | its project code; |
| `threads[].owner` | the owner (a person's name), or `null`; for a question, risk or decision, who raised or settled it; |
| `threads[].what` | what it is (from the item that created it); |
| `threads[].topic` | its topic; |
| `threads[].due` | the due date as said; |
| `threads[].dueDate` | that date resolved, or `null`; |
| `threads[].importance` | `high` or `normal`; |
| `threads[].seg` | the statement that created it (in the package of `created`); |
| `threads[].status` | now: `open`, `in_progress`, `blocked`, `done`, `not_needed`, or `decided` for a decision; |
| `threads[].statusStack` | every status it has had, oldest first; |
| `threads[].waitsOn` | the item ID it waits on, or `null`; |
| `threads[].relatedTo` | *optional:* the open item this work was about; |
| `threads[].created` | the meeting ID that created it; |
| `threads[].mentions` | the meeting IDs that mentioned it; |
| `threads[].lastTouch` | the last of them; |
| `threads[].quiet` | how many meetings of its project have not mentioned it since; |
| `threads[].parked` | `true` when that is 3 or more and it isn't raised: left out of requests; |
| `threads[].raised` | brought back into discussion, or `null`: |
| `threads[].raised.by` | by whom; |
| `threads[].raised.note` | why; |
| `threads[].raised.at` | when; |
| `threads[].raised.key` | when it applied on replay; |
| `threads[].settledOutside` | marked completed or resolved on the Board, or `null`: |
| `threads[].settledOutside.by` | by whom; |
| `threads[].settledOutside.note` | why; |
| `threads[].settledOutside.at` | when; |
| `threads[].closedWithProject` | closed with its project, or `null`/absent: |
| `threads[].closedWithProject.by` | by whom; |
| `threads[].closedWithProject.note` | why; |
| `threads[].closedWithProject.at` | when; |
| `threads[].closedWithProject.board` | the board package; |
| `threads[].toCheck` | the item that created it had a source to check; |
| `threads[].history` | what happened to it, in order. A meeting entry: |
| `threads[].history[].meeting` | the meeting ID; the item is in that meeting's save in use (`derived.packages.inUse`); |
| `threads[].history[].item` | the item `n` in that meeting's package; |
| `threads[].history[].event` | `created`, `update`, `done`, `blocked`, `in_progress` (an applied status), `related` (new work about it), or a board `action`; |
| `threads[].history[].what` | the item's line; |
| `threads[].history[].byReview` | a reviewer's closure (rule 8); |
| `threads[].history[].related` | for `related`, the new item's ID. A board entry instead has: |
| `threads[].history[].board` | the board package; |
| `threads[].history[].by` | who; |
| `threads[].history[].note` | why; |
| `threads[].history[].at` | when. |
| `unlinked` | Updates that point at an ID no save in use has (a re-save dropped it). A meeting entry: |
| `unlinked[].meeting` | the meeting ID; |
| `unlinked[].item` | the item `n`; |
| `unlinked[].thread` | the missing ID; |
| `unlinked[].what` | the item's line. A board entry instead has: |
| `unlinked[].board` | the board package; |
| `unlinked[].action` | its action. |
| `people` | The people register: |
| `people.people` | each person: |
| `people.people[].name` | their name (how MeetingGraph identifies them); |
| `people.people[].labels` | every label that means them: |
| `people.people[].labels[].label` | the label (a speaker label, a Teams name, or a name); |
| `people.people[].labels[].from` | where its meaning came from: `spreadsheet`, `speaker` (a meeting's speaker label, turned round: `Okafor, Grace` is Grace Okafor) or `review` (the PM's answer, which wins); |
| `people.noOwner` | labels the review answered "No owner": |
| `people.noOwner[].label` | the label; |
| `people.noOwner[].from` | always `review`. |
<!-- /fields -->

The register holds no email addresses. In a full file they are in the spreadsheet packages (`people[].email`).
