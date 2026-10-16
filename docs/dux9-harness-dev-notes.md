# D-UX9 test harness — developer notes (validator v0.1, 2026-10-11)

(Copied from the claude.ai Project doc `claude/dux9-harness-dev-notes.md`.)

Deliverable: `meetinggraph-dux9-harness.html`, a single offline page for Edge. It contains the validator, the Layer A fixtures and the Layer B tests and grader.

## Status
- Layer A: 29/29 pass. That is 4 controls clean and 25 negatives caught, each with exactly its expected flags.
- Knockout: all 16 checks were switched off in turn, and each one made at least one fixture fail.
- Layer B grader self-check: 12/12. Each correct sample answer passes and each anticipated wrong answer fails.
- Layer B live runs: not started. These need the enterprise model, 3 runs per test.
- R01 (real Oct 9 package): not run. It needs the real JSON, transcript and register, with `adapt()` mapped to the real field names.

## Deviations from the spec (for architect ratification)
1. **A11 expectation was wrong.** If the AI-19 note cites S057, then S057 is bound and UNBOUND cannot fire. I split it into two fixtures. A11a has the note cite the gate segments and raises DECOMP-MERGED. A11b mentions the gate only in the note text and raises UNBOUND for S057 and S058.
2. **A15** also raises MATCH-BETTER-TARGET, because the invitation segment fits AI-40. I added it to the expected set.
3. **A06**: wide ranges do not bind segments, so S053 and S054 also surface as unbound. This is intended.
4. **G0** merged the visitor and VIP items into one open question, which trips DECOMP-MERGED. I split them, matching the review's list.
5. **A99** cannot be built by stacking A01–A18, because those mutations edit the same elements. I built it as a reconstruction of the Oct 9 output instead.
6. **Why AI-55 was missed.** In the reconstruction, AI-55 is caught only by COV-POSSIBLE-MATCH, not by COV-CONTRADICTION. The extractor linked S052–S054 to AI-19, and the contradiction check can only see links the extractor makes. The lexical check with its alias table is therefore mandatory.
7. **PARTY-IDENTITY masking.** In A99, Joel owns the false generator task, and that ownership would legitimize him as a party. Fix: ownership counts only for ops that pass TASK-NO-ACCEPTANCE.
8. **PROJ-UNSUPPORTED** was purely lexical in the spec, which would block the correct B01 answer. The new rule has three tiers:
    - Lexical support passes.
    - Support from the extractor's classification alone raises the new PROJ-LINK-ONLY warning.
    - Support from greeting/context segments only is blocking.
9. **Schema requirement.** DECOMP-MERGED depends on a `unit` id on every disposition, so the prompt must require it. Without units, the validator treats each segment as its own unit.
10. **Added checks**: COV-MISSING-ITEM, DISP-MISSING and mis-resolved relative dates. Added fixtures: A09b and A19–A22.

## Defects the validator cannot see (Layer B or human review only)
The spec named only A13 here; the actual list is longer.
- B01: a paraphrase with no shared words with the task.
- B04: two commitments in one sentence.
- B07: the same technical words, but about a different program.
- A12: a dropped contingency clause.
- A13: scope fit, which is a warning only.

## Calibration caveat
The fixtures use a synthetic reconstruction of the Oct 9 transcript. Matching margins are thin, mostly a score of 2 against 1. R01 on the real package is the calibration test, and the alias table will need to grow from it.
