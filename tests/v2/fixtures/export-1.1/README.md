# MeetingGraph export 1.1: conformance fixtures

Synthetic files for apps that read MeetingGraph's export, such as Dossier Studio. The format is defined in [`docs/mkg2-export-schema.md`](../../../../docs/mkg2-export-schema.md); these files show it on one small, complete story.

- **All content is invented.** The people, statements and emails are fictional, and no real meeting is in them.
- **They are generated, not hand-written.** `tests/v2/fixtures/make_export_fixtures.js` runs the meetings through MeetingGraph's own pipeline: reply check, review, project placement, Save, board decisions and the two exports.
- **They stay current.** Unit check `t54a` rebuilds them from the code and fails if the files here differ. After a change to the code, run `node tests/v2/fixtures/make_export_fixtures.js`.
- **The bytes are exact.** These files are kept with LF line endings, exactly as written.

## The files

| File | What it is |
|---|---|
| `full.json` | "Export workspace": the backup, with every package, including the superseded save and both saves of the conflict. Dossier Studio does not import this file; it is here so the shared files can be checked against it. |
| `shared-HP.json` | "Export for sharing": project HP only, 2026-10-10 to 2026-10-31. |
| `shared-HP-LB.json` | "Export for sharing": projects HP and LB, 2026-10-01 to 2026-10-31. |

## The story (two projects: HP, Harbor Point reopening; LB, Library build)

| Date | Package | What it exercises |
|---|---|---|
| 2026-10-01 | Spreadsheet start | `kind: seed`; people with emails; actions, a question, a risk, a decision; no statements. Dana Brooks owns "Order the opening banners" and never speaks in a meeting (see below). |
| 2026-10-05 | Meeting "Harbor Point weekly" | A new action (`HP-A-261005-01`) and a status update. It falls before `shared-HP.json`'s range, so its work appears there only in `derived`. |
| 2026-10-12 | Meeting "Joint project walk" (HP and LB), saved and then **re-saved** | See the table below. The re-save marks the decision important; the first save is `superseded`. |
| 2026-10-13 to 10-17 | Board decisions | `not_needed`, then `undo` on LB "Order the books"; `settled` on "Send the notice draft to legal"; `raise`, then `lower`, on the permit risk. |
| 2026-10-19 | Meeting "Harbor Point weekly", **saved twice** by Pat Morgan and Sam Lee, neither knowing of the other | A conflict: the first-saved (Pat's) is used, and Sam's is listed in `derived.packages.conflicts`. |
| 2026-10-22 | `close_project` LB | Its open items become `not_needed`, with `closedWithProject`. |
| 2026-11-01 | `reopen_project` LB | After both shared ranges, so a shared file still shows LB closed. |
| 2026-11-03 | Meeting | After both shared ranges, so it is in `full.json` only. |

**The items of 2026-10-12** (in the re-save `mkg2-meeting-HP-20261012T140000Z-20261012T183000250`):

| `n` | Case |
|---|---|
| 1 | An update that closes an action (`status: done`, `applied: true`). |
| 2 | An update on an LB action (`in_progress`). |
| 3 | `src: near`: the chat cited S002, and the words are in S003, so `seg` is S003 and `citedSeg` is S002. |
| 4 | A decision (D); `who` is who settled it, not an owner. |
| 5 | `src: not found`, `toCheck: true`: not evidence. The speaker label "Ruiz, Ana" was matched to Ana Ruiz in the review (an alias). |
| 6 | An update that settles the question "Which caterer does the opening?". |
| 7, 8 | Two questions; 8 is `mergedInto: 7`. |
| 9 and 13 | A commitment the chat attached to the permit **risk**: saved as new work (9, `relatedTo` the risk), with its status carried by a split-off update (13, `statusOf: 9`). |
| 10 | A commitment by the speaker "Front desk", answered "No owner" in the review: `person: null`, and listed in `derived.people.noOwner`. |
| 11 | `added: true`: typed in by the PM from S006; not the chat's, and not speech. |
| 12 | `byReview: true`: the reviewer closed "Get caterer quotes" because the caterer question was settled. |

The meeting also has an `attendance` report, which is never in a shared file. Its statement S005 is personal ("my kid has a cold") and is cited only by the to-check item 5, so the shared files leave it out.

## What the shared files show

- **No emails** (the spreadsheet start keeps its named people, without `email`), and **no `attendance`**.
- **Only cited statements.** In `shared-HP.json` the 2026-10-12 meeting keeps the statements its HP items cite. The LB statement S002 is gone, and so is S005, cited only by a to-check item.
- **The joint meeting's summary.** `reply.summary` is `null` in `shared-HP.json`, because the meeting also covered LB. It is kept in `shared-HP-LB.json`.
- **Work from before the range.** `shared-HP.json` starts on 2026-10-10, so the spreadsheet start and the 2026-10-05 meeting are not in it. Their items still appear in `derived.threads`, with history that points at packages outside the file.
- **The range ends on 2026-10-31.** In `shared-HP-LB.json`, LB is still closed, because the reopen of 2026-11-01 is after the range.
- **Only saves in use.** The superseded save and Sam's conflicting save are absent; `derived.packages.superseded` and `.conflicts` are empty, and every package is listed in `derived.packages.inUse` or `.boardDecisions`.
- **An owner who is not in the shared register** (Dossier Studio AT-I15). In `shared-HP.json`, the thread "Order the opening banners" keeps its owner, Dana Brooks, in `derived.threads`, but she is not in `derived.people`: the spreadsheet start that names her is before the range, and she never speaks in a shared meeting. In `shared-HP-LB.json` the spreadsheet start is shared, so she is in the register (`from: spreadsheet`), without her email.
- **Package IDs** end in millisecond stamps (`…-20261012T183000250`).
