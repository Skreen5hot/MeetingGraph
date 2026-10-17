# MeetingGraph: working rules for Claude Code

MeetingGraph turns meeting transcripts into a reliable project board. **The product is v2: one offline HTML page, `dist/MeetingGraph2.html`, that runs in Edge** (v1, archived as `archive/v1/MeetingGraph.html`, is frozen). The live page is published by GitHub Pages from `main`. The extraction is done by an enterprise LLM, **gpt-5.6-terra-low**, used **only through its chat UI**: the page writes a request, a person pastes it into the chat and pastes the reply back, and the page checks it. There is no API.

The team folder of package files (JSON) is the source of truth; the browser mirrors it.

## How we work (Aaron is the ratifying architect)
- **Plan before build.** Changes are written up as a numbered section of `docs/mkg-v2-plan.md` (latest: §10.31, the export's bug fix, clarifications and conformance fixtures, built 2026-10-17) and approved by Aaron before they are built. When Aaron approves ("approved", "proceed"), build it: no extra chat-test gates.
- **Test before build** for anything that changes the chat contract (the request text or reply format): run it on gpt-5.6-terra-low first (Aaron runs it), score it, then build.
- **Keep v1's screens.** The PM expects v1's board, screens and email formats; v2 changes what is underneath. Screen changes come from the PM or Aaron.
- **Structural fixes** over patches or prompt nagging. If the model can't be held to a rule, the build handles it.
- **Every change gets tests and knockouts.** A knockout mutates the code and must make the named check fail; a crash does not count as a kill. Tests must stay crash-safe under knockouts.
- **Edits use exact-count replacements.** Each replacement asserts its match count, and the file is written only if all pass.
- Be concise; own errors plainly.
- **Never send anything to the testers without Aaron.** The testers' LLM can't open zips: give them plain files, one per item.
- Commit attribution: none required unless asked.

## Layout
- `src/v2/`: v2 (plan `docs/mkg-v2-plan.md` §10).
  - `modules/`: plain JS, also run by Node: transcript, request, reply, store (packages, IDs, the replay, board and project decisions), dates, people, attendance, export (the workspace file, `derived`, Export for sharing), interventions (the Dashboard), review, email (meeting and Program reports), summary, seed.
  - `page/app.html`: v1's screens and CSS over v2; edit it directly.
  - `build_v2.py`: puts the modules into the page.
- `dist/MeetingGraph2.html`: the v2 build (sha256 `1ac58f46…`, 2026-10-17, §10.20–§10.31).
- `docs/mkg2-export-schema.md`: the export format, a contract for other apps (Dossier Studio). Every field saved must be in it: unit check t53h fails otherwise. Changing it is a plan change.
- `tests/v2`:
  - `unit/v2test.js`
  - `knock_v2.py` (knockouts)
  - `e2e_slice.py` (Playwright, meeting to email)
  - `e2e_full.py` (Playwright: review, board decisions, people, review again, conflicts, reports, Dashboard, Close project, the exports)
  - `knock_page.py` (knockouts of page code, against `e2e_full.py`; about 5 minutes each)
  - `fixtures/export-1.1/`: the export's conformance fixtures for Dossier Studio, built by `fixtures/make_export_fixtures.js`. After any change to what is saved or exported, run it: unit check t54a fails until the files match the code.
- `tests/v2-feasibility`: the v2 kit (mock seed and follow-up meetings, requests, key, checker, the PM's sample emails). See its README.
- `tests/real`: tools for real meetings without their content (`score_real.py`, `make_variant.py`, `README.txt`). Real replies and keys go in `tests/real/local/` (git-ignored); never commit real meeting content.
- v1, frozen:
  - `src/base/MeetingGraph.orig.html` (never edit), `src/ports/`, `src/modules/`, `src/ui/`, `build.py`;
  - `archive/v1/MeetingGraph.html` (sha256 `35b3a2ec…`), archived 2026-10-16;
  - the tests in `tests/unit`, `tests/playwright`, `tests/jsdom`, `tests/oi-feasibility`;
  - its plan, `docs/mkg-dux12-plan.md`.

## Commands
- Deploy: every push to `main` publishes `dist/MeetingGraph2.html` (as `index.html`) and `templates/` to GitHub Pages (`.github/workflows/pages.yml`). The repo and the page are public: never commit meeting content.
- v2 build: `python3 src/v2/build_v2.py` (always LF, byte for byte on any OS).
- v1 build: `python3 build.py` writes both pages (v1 into `archive/v1/`). On Windows it writes v1 with CRLF line endings (sha `8549dfe4…`; stripped, `35b3a2ec…`), so don't run it to rebuild v2.
- Quick tests: `python3 run_tests.py` (unit, v2 and t38). v2 alone: `python3 run_tests.py v2`.
- Everything: `python3 run_tests.py all` (about 1 hour; t37's own knockouts are separate, about 90 minutes).
- Setup:
  - `pip install -r requirements.txt && playwright install chromium`
  - `npm install`

## Expected results (2026-10-17)
- v2:
  - unit 232/232;
  - knockouts 207 of 207 killed;
  - slice in the browser 53/53, full page 57/57;
  - page knockouts (`tests/v2/knock_page.py`) 8 of 8 killed;
  - kit checker self-test 44/44, knockouts 19 of 19;
  - sample (variant J) checker 21/21, knockouts 19 of 19.
- v1:
  - unit: validator self-test ALL GREEN; restest 62/62; oitest 36/36;
  - t38 60/60, its knockouts 30 of 30;
  - t36 107/107; t37 117/117; t30–t33 55/55;
  - jsdom 27 of 27.

## Product rules worth knowing before touching code
- **A1:** a reviewer's or PM's decision is never meeting evidence. It is recorded with their name and note, apart from the meeting basis.
- **A2:** nothing is overwritten; records supersede. A re-save supersedes the earlier save, and both files stay.
- **IDs** are `CODE-KIND-YYMMDD[b]-NN`, minted at Save and never changed. Package IDs end in the save time to the millisecond (since §10.30; older ones stop at the second).
- **The export is a contract** (`docs/mkg2-export-schema.md`): "Export workspace" is the backup (1.1, with `derived`); "Export for sharing" is a reduced view for another app (chosen projects and dates, only cited statements, no emails, no attendance), and the page refuses to open it.
- **Board decisions** are made one item at a time, in the item dialog, each with a note:
  - Mark completed / Mark resolved;
  - Mark as not needed;
  - Restore status: X;
  - Bring back into discussion (parked items only).
- **Close project** (and Reopen) is a board decision with a note.
  - Closing marks the project's open actions, questions and risks not needed, as closed with it; its decisions stay in effect.
  - A closed project is left out of new requests and the Dashboard, and listed under "Closed projects" on the Board.
  - Reopening restores each item's earlier status.
- **Every decision dialog asks for the name itself** (item and project dialogs), filled in from Process meeting or this machine; the name typed there is kept for the next save.
- **"State as of"** sets the date and history for everything: the Board, the Dashboard and the reports.
- **userEmail and real meeting content are sensitive.** Never put real transcripts or seeds into the repo or tests; the fixtures are mock or Aaron-approved.

## Open items
- **v1's harness fails on this Windows machine (2026-10-16), with v1 itself unchanged** (its page is still `35b3a2ec…`):
  - t30–t33 (6 checks: golden and date checks in t31 and t32, not yet diagnosed);
  - t36 (an element not found);
  - t37 (Python reads files with the Windows default encoding: "charmap can't decode");
  - t38's knockouts.

  `node_modules` was never installed here (`npm install`), so the jsdom suites can't load `fake-indexeddb`. The v2 suites all pass. Fix these before relying on v1's tests again.
- **UAT of v2 starts 2026-10-16.** Before it: one pass of the page in Edge itself (the tests run Chromium), and one real meeting end to end on the final build.
- **The PM's sign-off on two report changes:** the meeting email's executive summary is now the chat's summary (§10.26), and the Program report opens with one paragraph per project (§10.27).
- **Known limits to tell the PM:**
  - the chat's recall varies between runs; the review is where misses are caught;
  - the chat's summary isn't edited by the review;
  - v1 files can't be loaded (start v2 from the spreadsheet).
- **The first-time-user session** (acceptance 10) is still open; a one-page quick start would cover most of it.
- **v1's open items are parked:** §16.18 (leave out a bad change by default), open-question wording, the confirmation run, person items.
