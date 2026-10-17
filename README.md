# MeetingGraph

MeetingGraph turns meeting transcripts into a project board that a project manager can trust. Each meeting's commitments, decisions, open questions and risks become items on the board. Every item carries its source: the statement where it was said, in the speaker's words.

**Open it:** https://skreen5hot.github.io/MeetingGraph/

The tool is one HTML page and needs no installation. It is built for Microsoft Edge and also runs in Chrome. After it loads, it works offline.

## How it works

MeetingGraph does not call an AI service. It writes a request, you paste it into your organisation's approved chat (it was tested with gpt-5.6-terra-low), and you paste the chat's reply back. The page then checks the reply line by line before anything reaches the board.

1. **Open the transcript.** On *Process meeting*, open the Teams transcript (`.docx`) or paste its text. The page reads the title, date and start time, and numbers each statement (S001, S002, …).
2. **Send the request.** Copy the request into a new chat as one message. The request includes the board's projects and its open items, so the chat can report on existing work as well as new work.
3. **Paste the reply and check it.** For every item, the page confirms that the quoted words appear in the statement the chat cited. Items whose words can't be found are marked *to check* and kept out of the email. A reply that was cut off keeps every complete item.
4. **Review.** Every choice starts with a sensible default; you change only what is wrong. You can:
   - change the project, owner, due date, importance or thread;
   - mark an item as the same as another one;
   - keep a status change off;
   - match a new name to someone already on the board;
   - add an item the chat missed.
5. **Save.** IDs are assigned when you save (for example `HP-A-261019-03`) and never change. The page downloads one file for the meeting: put it in the team folder.

## What you get

- **Board.** One page per project, with:
  - *Last time we talked…*;
  - what needs attention;
  - what is due in the next two weeks;
  - open questions and risks;
  - decisions in effect;
  - open work by owner;
  - completed and not-needed work;
  - the meeting log.

  Open any item to see its history and the words behind it. *State as of* shows the board as it stood at any earlier meeting.
- **Dashboard.** What to ask, of whom, and why now. Each question comes from fixed rules over the saved records: overdue, blocked, no owner, others waiting, an open question carried over, or a risk with no action. Escalation is suggested only when a problem has lasted several meetings. *Copy these questions* gives the list grouped by person.
- **Meeting email report.** A seven-section email for one meeting, ready to paste into Outlook.
- **Program email report.** The whole board across all projects, for leadership, available at any time.
- **Board decisions.** Outside a meeting, the PM can:
  - mark an item completed or not needed;
  - restore its earlier status;
  - bring a parked item back into discussion;
  - close or reopen a project.

  Each decision is recorded with the PM's name and a note, and is never presented as meeting evidence.

## Where the data lives

- **The team folder is the record.** Every save downloads a JSON file: a meeting, a board decision or a spreadsheet start. To restore the board on any machine, use *Open files*. *Export workspace* writes everything into one file.
- **Sharing with another app.** *Export for sharing* (Workspace tab) writes a reduced copy for apps such as Dossier Studio: the projects and dates you choose, only the statements their items cite, with no email addresses and no attendance. It is not a backup, and MeetingGraph won't open it. The file format is defined in [`docs/mkg2-export-schema.md`](docs/mkg2-export-schema.md).
- **The browser keeps a copy only for convenience.** Nothing is sent to a server: the page runs entirely in your browser.
- **Nothing is overwritten.** Saving a meeting again replaces the earlier save on the board, and both files stay in the history.
- **Starting out.** You can begin a board from a spreadsheet (*Workspace → Initial setup*) using [`templates/mkg2-seed-template.csv`](templates/mkg2-seed-template.csv); [`mkg2-seed-guide.txt`](templates/mkg2-seed-guide.txt) explains the columns. To try the tool, use *Load sample baseline* (fictional data).

## Repository layout

| Path | What it is |
|---|---|
| `dist/MeetingGraph2.html` | The product page, built. GitHub Pages publishes it as `index.html` on every push to `main`. |
| `src/v2/modules/` | The logic, in plain JavaScript (Node also runs it in tests): transcript, request, reply checking, the store and replay, dates, people, attendance, the Dashboard, the review, the emails, the spreadsheet start. |
| `src/v2/page/app.html` | The screens. `src/v2/build_v2.py` puts the modules into the page. |
| `templates/` | The spreadsheet template, an example and a guide. |
| `tests/v2/` | Unit tests, knockouts (mutations that each test must catch), and browser tests (Playwright). |
| `tests/v2-feasibility/`, `tests/real/` | The kits used to test the chat requests, with mock meetings only. |
| `docs/mkg2-export-schema.md` | The export format: the contract for other apps that read MeetingGraph's files. |
| `docs/mkg-v2-plan.md` | The design and every approved change (§10 is the build). |
| `archive/v1/` | MeetingGraph 1, archived. Its sources (`src/base`, `src/ports`, `src/modules`, `src/ui`, `build.py`) and tests are kept frozen. |

## Build and test

```
pip install -r requirements.txt
playwright install chromium
npm install

python3 src/v2/build_v2.py     # rebuild dist/MeetingGraph2.html
python3 run_tests.py v2        # v2: unit tests, knockouts, browser tests
```

`CLAUDE.md` lists the working rules, the expected test results and the open items.

## Privacy

This repository and the published page are public. Never commit real transcripts, replies, saved meeting files or names; the fixtures are mock data. Meeting files belong in the team folder only.
