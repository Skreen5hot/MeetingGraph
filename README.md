# MeetingGraph

Turns meeting transcripts into a reliable project board. Offline single-page workbench (`dist/MeetingGraph.html`); extraction runs on the enterprise chat model with a paste-in / paste-back loop.

## Setup
```
pip install -r requirements.txt
playwright install chromium
npm install
```

## Build
```
python3 build.py        # src/base + src/ports + src/modules + src/ui -> dist/MeetingGraph.html
```

## Test
```
python3 run_tests.py            # unit + t38 (a few minutes)
python3 run_tests.py all        # unit, Playwright t30–t38, jsdom, t38 knockouts (about an hour)
```
You can also name individual groups: `unit`, `t38`, `playwright`, `jsdom`, `knock`.

The expected results, working rules and open decisions are in `CLAUDE.md`. The design history and ratified sections are in `docs/mkg-dux12-plan.md`.
