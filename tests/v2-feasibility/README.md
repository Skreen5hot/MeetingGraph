# v2 feasibility kit: one chat round for a 60-minute seed meeting

Plan: `docs/mkg-v2-plan.md` §5. The meeting is fictional (the "Harbor Point reopening kickoff", 2026-10-19, 471 statements). No real content.

## Files

| File | What it is |
|---|---|
| `mock-seed-meeting-2026-10-19.txt` | The Teams transcript as the PM would have it |
| `meeting-2026-10-19.txt` | The same meeting, numbered by the workbench (S001–S471). Variant C's attachment |
| `request-A-current.txt` | Variant A: the built workbench's own request, on an empty board |
| `request-B-paste.txt` | Variant B: the slim request, with the meeting pasted in |
| `request-C-attach.txt` | Variant C: the slim request without the meeting (attach `meeting-2026-10-19.txt`) |
| `request-D-lines.txt` | Variant D: as B, but the reply is one JSON object per line, in meeting order, with an end line |
| `request-E-lines-attach.txt` | Variant E: as C, with D's reply format (attach `meeting-2026-10-19.txt`) |
| `mock-followup-meeting-2026-10-26.txt` | The follow-up meeting a week later (381 statements) |
| `board-after-seed.json` | The board after the seed meeting: the follow-up request's open threads |
| `request-F-followup.txt` | Variant F: the follow-up request (threads, status, waits-on; plan §6) |
| `key-followup.json`, `golden-followup.json` | The follow-up answer key and its golden reply |
| `key-items.json` | The answer key: 29 items (11 high importance) and 9 traps |
| `golden-reply.json` | The key as a slim reply (the self-test baseline) |
| `golden-reply.team-email.txt`, `golden-reply.leadership.txt` | The sample meeting email and leadership email, in the PM's own formats (plan §4.4, §5.3) |
| `check_reply.py` | Checks and scores replies (`--selftest`) |
| `knock_check.py` | Knockouts for the checker |
| `render_reports.py` | Drafts both emails, in the PM's formats, from any slim reply |
| `make_kit.py` | Rebuilds the requests and the golden reply from the transcript and the build |

## Running the test (Aaron)

Use a **fresh chat** for every run: 3 runs each of A, B and C. Save each complete reply, exactly as the chat gave it, as `runs/A1.txt` … `runs/C3.txt`.

- **A:** paste all of `request-A-current.txt`.
- **B:** paste all of `request-B-paste.txt`.
- **C:** attach `meeting-2026-10-19.txt`, then paste `request-C-attach.txt` as the message.
- **D:** paste all of `request-D-lines.txt`.
- **E:** attach `meeting-2026-10-19.txt`, then paste `request-E-lines-attach.txt` as the message.
- **F (the follow-up meeting):** paste all of `request-F-followup.txt`. Save as `runs/F1.txt` … `runs/F3.txt`.

B and C are superseded by D and E (plan §5.7): B1 came back as one long line, cut off.

For every run, note in `runs/notes.md`:
- whether the chat accepted the input (or said it was too long);
- whether the reply stopped before the end;
- roughly how long it took.

For **A only**, also paste the reply into the workbench and record whether **Update the board** is enabled, the finding codes, and the hard stops. Set up the workbench like this:
- start from an empty workspace;
- date 2026-10-19, start 10:00, UTC −04:00, title "Harbor Point reopening kickoff";
- paste `mock-seed-meeting-2026-10-19.txt`.

Its request must then match `request-A-current.txt`, with context token `MKG1|transcript|20261019T140000Z|f3a87ac6`.

Then:
```
python3 check_reply.py runs/*.txt
python3 render_reports.py runs/B2.txt      # the best slim run, for the PM
```

Each run prints PASS or FAIL for criteria 1–7, the missed keys, wrong kinds, trap hits, and **the items that match no key**. Judge each of those by hand: is it noise, or a real item the key lacks?

## Notes

- **Changing the request makes a new variant.** Rebuild it with `python3 make_kit.py` (it needs `archive/v1/MeetingGraph.html` and Playwright), then do 3 new runs.
- **The checker's self-test and knockouts** run in `python3 run_tests.py unit`.
- **Testers:** plain files only, one per item, never a zip. Nothing goes to them without Aaron.
