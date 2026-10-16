v1's built-in sample, for v2's multi-project tests
=================================================

All fictional, taken from src/base/MeetingGraph.orig.html ("Load sample baseline" and
"Load sample transcript"). Safe to share and to commit.

  sample-board.csv        v1's sample baseline as a v2 seed: 4 projects, 6 people, 15 actions,
                          2 decisions. Seed it with "Board as of" 2026-09-24; keep the default codes
                          (IPR, PDE, RDM, RRC).
  weekly-board-walk.txt   v1's sample meeting, 12 statements. Paste it as the transcript.
                          Title: Weekly board walk. Date: 2026-10-01. Start: 10:00. Offset: -04:00.
  key.json                what a good reply contains, and which project each item belongs to.

Why it fits: one meeting covers all four projects, and it never says a project's name.
Placement has to come from evidence ("the intake fields", "the partner exchange",
"their side", "for the dashboard"), as v1 did it. S007 is the hard one: new work for
Partner data exchange, placed by context only. S006 is a trap: a suggestion whose
project is not clear.

Empty-board case (v1 created projects from the meeting): paste the same transcript with
nothing seeded. A good reply proposes the projects the meeting establishes, each with a quote.

Variant J test (plan §10.20, stage 1)
-------------------------------------
  request-J-seeded.txt    the request with the sample board seeded (placement)
  request-J-empty.txt     the same meeting on an empty board (the chat proposes the projects)

  1. Open a new chat. Paste the whole of request-J-seeded.txt as one message. Answer nothing.
  2. Copy the chat's whole reply into runs/J-seeded-1.txt (here, in sample-v1/runs/).
  3. Repeat in two more new chats: J-seeded-2.txt, J-seeded-3.txt.
  4. The same three times with request-J-empty.txt: J-empty-1.txt ... J-empty-3.txt.
  Scoring (Claude runs it):  node check_sample.js seeded runs/J-seeded-*.txt
                             node check_sample.js empty  runs/J-empty-*.txt
  Pass: 3 of 3 on each board (the rules are in check_sample.js and §10.20).

  Rebuild the requests:  node make_requests.js   (the same bytes every time)
  Tests:                 node check_sample.js --self-test   (21/21)
                         python knock_sample.py              (19 of 19 killed)
