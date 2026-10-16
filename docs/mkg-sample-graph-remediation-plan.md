# MeetingGraph — sample-graph remediation plan (D-UX10 proposal)

2026-10-11 · Difficult transcript, sample world P2 · status: **D-UX10a–g ratified and built 2026-10-11; D-UX10h ratified and built 2026-10-12 (build `c0a5abcf…`). Golden and tightened 17-row rubric agreed. Final D-UX10h feasibility test completed: failed. Terra-low did not meet the agreed 17/17, 3-of-3 standard after up to two repair rounds. Prompt-first extraction is not proven reliable for material existing-task classification and content completeness. Stop rule triggered (testers, 2026-10-12). Addenda at the end.**

## 1. Where this stands

| Claim | Status | Evidence |
| --- | --- | --- |
| Every tester finding has a test | Done | 17-row rubric (baseline B; R17 added Oct 12); on the rejected terra-low reply the harness agrees with the tester on 14 of 14 applicable rows |
| Golden and rubric agreed | Done | Golden and tightened 17-row rubric agreed with the testers (Oct 12); golden reply (baseline B): 17/17 rows clean, 0 findings |
| Each check catches its defect alone | Done | 15 single-defect mutations of the golden reply, 15 caught; cross-suite knockout: every repair-required check fails a test when switched off |
| Earlier work still holds | Done | Oct 9 fixtures 29/29, Layer B grader 12/12 |
| The repair loop works on a weaker model | Partly | Haiku, blind run: validator findings 7 → 4 → 3 → 1; rubric 11 → 10 → 11 → 12 of 16 |
| Terra-low produces a passing reply | **Failed feasibility test** | Final valid runs scored 16/17, 14/17 and 14/17. Zero of three met the agreed standard. |
| Route and staging classification | Improved | Separate route task and separate unassigned staging task appeared in all three valid runs. |
| AI-203 schedule-window update | Not reliable | Present in one of three valid runs; omitted in two of three after repair rounds. |
| Transcript timing | Not reliable | Incorrectly dated in all three valid runs. |
| Supporting materials retention | Not reliable | Retained in one of three valid runs; omitted in two. |

## 2. Why the back-and-forth keeps happening

1. **The model is not missing instructions.** The workbench prompt already states update-before-create, contingency-with-verification, one condition per label, completion against the tasking's wording and scope routing. The rejected reply breaks all of them. More rules will not close this, which matches the D-UX9 conclusion.
2. **The rules pull against each other.** Round 3's rule ("several completion conditions = several NewTaskings, never one broad task") is what produced this round's over-splitting (route verify + route guidance; one invitation tasking per person). Each round's fix has moved the failure rather than removed it.
3. **Warnings never went back to the model.** D-UX9 findings reach the reviewer and the testers, but nothing asks the model to correct them, so the testers end up doing the correcting by review round.
4. **There is no shared target.** The testers judge against an expected answer that exists only in their review, so the developer cannot check against it before sending.
5. **Weaker models fail in the opposite direction.** The blind Haiku run over-updated instead of over-creating. It folded new work into progress notes and filed "I will send … this morning" as administrative. The gate now covers both directions where the failure is mechanical.

## 3. Tester findings → checks

| Row | Tester finding | Mechanical check (repair-required unless noted) | Mutation |
| --- | --- | --- | --- |
| R01 | AI-203 not properly updated | COV-UNRESOLVED (possible match left undecided) | D01 |
| R02 | New tasks instead of updating existing work | COV-DEFERRED-NEW, NEW-DUPLICATE (justifiable only through selfReview) | D02, D11 |
| R03 | Coordination commitment under-scoped | QUOTE-TRUNCATED (advisory) + rubric scope check | — |
| R04 | Route check: one Sofia-owned tasking, neither split nor absorbed into AI-204/AI-206 (Oct 12 ruling) | OVER-SPLIT + rubric check for its own Sofia-owned tasking | D04 |
| R05 | Staging check: its own unassigned tasking with the alternate-area contingency (Oct 12 ruling) | CONTINGENCY-DROPPED + rubric check for its own unassigned tasking | D05 |
| R06 | Supporting materials dropped | DELIVERABLE-DROPPED | D06 |
| R07 | Invitation admin forced into P2 | ADMIN-IN-PROJECT | D07 |
| R08 | Receipt confirmation as task (tester: ok) | Regression guard | — |
| R09 | Conditional observer instruction as task | CONDITIONAL-TASKING; unowned task without a quoted ask (TASK-NO-ACCEPTANCE) | D08, D13 |
| R10 | Capability as task (tester: ok) | Regression guard | — |
| R11 | Unsupported projects (tester: ok) | Regression guard | — |
| R12 | Technical discussion not mapped | DISP-ABOUT-PROJECT, COV-UNBOUND-DISPOSITION | D09 |
| R13 | No self-review | SELF-REVIEW-MISSING / -INCOMPLETE | D10 |
| R14 | POC updates AI-205 (baseline B) | NEW-DUPLICATE, COV-POSSIBLE-MATCH | D03 |
| R15 | Travel updates AI-207 (baseline B) | Rubric only | — |
| R16 | Documentation deliverables merged (Oct 9 precedent) | TIMING-MERGED, DELIVERABLES-MERGED | D12, D14 |
| R17 | Current-meeting transcript task undated (Oct 12 ruling) | Rubric only ("today's transcript" passes the timing check) | D15 |

The weaker-model run added two checks that no tester row named but its failures demanded:
- COMMITMENT-MISCLASSIFIED: a first-person "I will send / verify / coordinate…" must be classified as a commitment.
- COV-CLAIM-UNSUPPORTED: D-UX9 parity; an item claimed updated must have an op or flag that touches it.

## 4. Decisions to ratify

- **D-UX10a — selfReview.newVsExisting (structural).** Each NewTasking names its nearest existing tasking (or null) and gives a one-sentence reason it is new work. The validator checks the claim against its own matcher: "nothing similar exists" next to a tasking that shares the subject is a finding. This answers the testers' self-review request with an auditable table, not a self-certificate.
- **D-UX10b — repair loop.** The workbench turns repair-required findings into a correction prompt the reviewer pastes into the same chat. The model stays the only author, and findings are not auto-rejections.
  - At most two rounds; whatever remains goes to the Coverage card as today.
  - The prompt is grouped by kind, ordered by the testers' priorities, and pruned of findings on ops another finding removes. For the rejected reply, 26 findings collapse to 10 items.
- **D-UX10c — replace, don't add: rule 4's decomposition sentence.** Replace it with the completion-condition test:
  - Split only when the parts can be completed independently.
  - A result that follows from a verification belongs to that verification.
  - A contingency stays in its verification's label.
  - Separate deliverables and separate deadlines are separate taskings.

  This is the only prompt-text change proposed.
- **D-UX10d — the new checks, and which are repair-required.**
  - Proposed advisory only: QUOTE-TRUNCATED, MATCH-SCOPE-MISFIT, PROJ-LINK-ONLY.
  - Proposed repair-required: everything else.
  - In the MKG format, an `ambiguous_reference` flag that cites the segment justifies a disputed task match. In the Haiku run the model correctly overrode a lexical mismatch this way: the observer point of contact is not AI-205.
- **D-UX10e — baseline B.** Add AI-204…AI-207 to the sample world as the testers proposed. This touches every existing test built on the sample baseline (for example T1a's INDEX expectations), so it needs its own regression pass.
- **D-UX10f — agree the golden reply with the testers before the next run. RESOLVED 2026-10-12.** The five questions are closed. Final rulings:
  1. Route suitability: a separate Sofia-owned task.
  2. Staging suitability: a separate unassigned task with the alternate-area contingency and an ownership flag.
  3. May 18–22 window: updates AI-203; the related travel and availability context updates AI-207.
  4. Current meeting transcript: undated.
  5. AI-204: keeps direct arrival, the intended staging area and the preparation/setup scope.
- **D-UX10g — model setting.** If the enterprise site offers a higher effort setting than terra-low, run the section 5 protocol on both.

## 5. What "fixed" will mean (proof protocol)

1. Port the v0.2 checks and the repair-prompt generator into MeetingGraph.html with the Difficult fixture; the full regression stays green. **Done 2026-10-11 (D-UX10).**
2. Update the prompt per D-UX10a/c, then rule 2 per D-UX10h; fix the repair-prompt order; add R17. **Done 2026-10-12 (build `c0a5abcf…`).**
3. **Final feasibility test. Completed 2026-10-12: failed (0 of 3; see the last addenda).** Run terra-low on the Difficult transcript against baseline B in three new fresh chats (no reuse of earlier chats), each with at most two repair rounds. Save every reply.
4. Pass means rubric 17/17 clean and zero repair-required findings in all three fresh terra-low runs. Each final reply must also show:
   - a separate route-verification task assigned to Sofia;
   - a separate unassigned staging-suitability task that includes the alternate-area contingency;
   - an AI-203 update for the narrowed transfer window and setup context;
   - an AI-207 update for travel and availability context;
   - an undated current-transcript task;
   - no P2 project tasking for invitation administration;
   - no material issue left to the reviewer because the extractor failed to make a required board change.

   Export the results to the team folder. Testers receive each reply together with the harness verdict, so they see what the developer saw.
5. **Stop rule.** If the AI-203, route or staging errors recur, stop. Add no further prompt exception, lexicon expansion, validator workaround or UI layer to compensate. Those classification decisions move to explicit reviewer choice under D-UX11.
6. ~~Repeat on the real Oct 9 transcript once its register is in the harness.~~ Not run as an automated feasibility test (testers, 2026-10-12): the Difficult fixture did not meet the standard.

## 6. Limits

- Three rubric rows are judgments a lexical gate cannot make: R01 (a not-discussed call made with a reason), R03 (setup scope) and R04 (a commitment reassigned onto a tasking with no shared words). They stayed open after every repair round. D-UX10f settled the target (rulings closed Oct 12); review still covers them.
- Thresholds are calibrated on two transcripts and the margins are thin. The alias table and lexicons will grow with each review, as in D-UX9.
- The feasibility run used Haiku and a reconstructed prompt, not terra-low and the production prompt.
- P2's title ("Partner data exchange") and the coverage value "updated" are now confirmed against the workbench.

---

## Addendum 2026-10-11 — D-UX10 RATIFIED and BUILT

**Reproduction first.** On the unmodified workbench, the sample baseline plus the Difficult transcript (Oct 1, 10:00 −04:00) gives context token `…|2c37e938`, identical to the testers' reply. Every result below is in the testers' own world. On that file the rejected reply drew "Checks passed", 5 unbound-segment warnings and 5 shared-subject warnings, and nothing on any of the testers' named defects.

**Built (port script `port_dux10.py`; every edit asserts its exact match count; 17 existing lines changed, 654 added):**
- **D-UX10c, prompt rule 4.** The decomposition sentence was replaced by the completion-condition test. The unowned-verification sentence is kept. This is the only rule-text change.
- **D-UX10c consequence, MATCH-02 retired.** It warned on any "verb and verb" label, which contradicts the new rule on cases like "verify the route and confirm which to use". DELIVERABLES-MERGED and TIMING-MERGED replace it.
- **D-UX10a, selfReview.**
  - `selfReview.newVsExisting` is in the output shape and STEP 4.
  - NEW-DUPLICATE accepts a row that names the nearest tasking and gives a reason.
  - MATCH-01 now defers to such a row: it becomes info and cites the reason.
- **D-UX10d, the new checks.** They run inside the D-UX9 Coverage review as findings with the existing per-finding resolutions. They are marked *repair* (warn) or advisory (info), and none blocks Accept.
  - They use the test harness's validator v0.2, embedded verbatim, so both tools run the same code.
  - Findings D-UX9 already reports in its own words are not repeated.
  - Checks judge against the register as it stood before the reply. Compile folds the reply's own taskings in first, and judging after that made NEW-1 a "duplicate" of AI-402, itself; a test caught this before delivery.
  - An undecided `possible_match_requires_review` is now warn and repair-required (COV-UNRESOLVED); its text is unchanged, with a sentence appended.
- **D-UX10b, the repair round card.**
  - It holds errors, repair findings and D-UX9 warnings, grouped by kind, in the testers' priority order, and pruned of findings on ops another finding removes. For the rejected reply that is 13 items.
  - The prompt asks for the complete reply, not just the fixed operations.
  - Round counter: at most two rounds per prepared meeting, and the limit survives re-validation.
- **D-UX10e, baseline B.** AI-204…AI-207 (P2, open, unassigned) are in the sample baseline. Minted codes are unchanged: the sample reply still mints AI-402.

**Tests (new; Playwright Chromium against the file itself): t29–t32, 48/48 pass.**
- t29: prompt, rules and baseline.
- t30: the reproduction; the rejected reply caught on every tester row; repair-prompt grouping and pruning; the two-round limit; the golden reply clean and accepted. The weaker-model rounds replay at 9 → 6 → 5 → 3 repair findings.
- t31: all 14 mutations caught inside the workbench.
- t32: the sample-world flow validates, accepts and mints AI-402, with no page errors.

The harness was rebuilt from the same shared modules: Oct 9 fixtures 29/29, Layer B grader 12/12, tester alignment 14/14, mutations 14/14.

**Golden reply revised before the run.** It now obeys rule 3 (1–3 sources per op, quotes of at most 25 words). AI-206's seven sources became two notes, and NEW-1's selfReview row names AI-204.

**Not yet run: the existing t1–t28 suite (not available in this session).** Expected changes, all intended:
- **Prompt assertions:** "emit each as its own NewTasking, never one broad task" and "one per LABEL" are gone; "names BOTH the verification and its contingency" is kept.
- **t26 MATCH-02 split warning:** retired.
- **t27/t28 (Atlas):**
  - The Atlas golden has no `selfReview`, so it will draw SELF-REVIEW-MISSING. Add selfReview rows to it for t27's clean path.
  - The possible-match finding is now warn, not info.
- **Sample-baseline tests (T1a and dashboards):** P2 has four more open items, and the sample INDEX fingerprint changes.

**Still open:** run t1–t28 and update the Atlas golden; send the golden reply and the five D-UX10f questions to the testers; then the terra-low protocol in section 5 (steps 3–5).

---

## Addendum 2026-10-11 (later) — the existing suite on the D-UX10 build

**Fixtures recovered.** The Atlas transcript, attendance file, flawed reply, `teams-header.docx` and the D-UX9 golden were rebuilt from the build record. The workspace was regenerated with `buildatlas.js`.
- Check: on the pre-D-UX10 file, every suite that uses these fixtures passes, 24 of 26 suites in all.
- corrdemo and msumtest need `mkg-workspace-correction-demo.json`, built from Aaron's own Oct 1 workspace. Aaron supplied it later the same day; both pass on the original and on the D-UX10 build.

**Result on the D-UX10 build: 27 of 27 suites green** (the 26 existing suites plus the new t34), run from a clean extraction of the test package.
- Playwright t30–t33 (renumbered from t29–t32 to avoid the existing t29): 48/48.
- Harness: Oct 9 fixtures 29/29, Layer B 12/12, tester alignment 14/14, golden clean, mutations 14/14.

**What the suite caught.** Each item is fixed, and each fix is pinned by a test that fails when the fix is reverted.
1. **Card order (t13).** The repair card sat above Reviewer questions, which broke the ratified reading order. It now sits directly above the Coverage card it resolves into.
2. **The gate contradicted its own repair text.**
   - COV-UNRESOLVED asks the model to mark an item `not_discussed` with a reason. The D-UX9 lexical not-discussed check ignored reasons, so the requested answer came back as a new warning.
   - The check now matches validator v0.2: with a valid reason it is info and quotes the reason; without one it stays warn.
   - The table-contradiction check is unchanged. The meeting email still lists such an item under "Possibly discussed — under review".
3. **The gate contradicted rule 4 in two places (Atlas golden).**
   - "Notes" was not in the deliverable lexicon, so splitting the slide deck from the session notes drew OVER-SPLIT. The lexicon now includes "notes" (plural only; the verb "note" is not a deliverable).
   - MATCH-01 compared a new tasking with siblings minted in the same reply, then told the model to "record it there" on a tasking it was creating. It now judges against existing work only. Exact duplicates within one reply are still caught.
4. **Empty repair rounds.** A reply with only advisory findings opened a repair round with an empty MUST FIX list. Advisories alone no longer open a round. The fix is in the shared `repair.js`, so the harness agrees.
5. **Wording (t23).** The repair card said errors block Accept even on replies that had none. It now says so only when there are errors.

Effect on the weaker-model replay: 9 → 6 → 5 → 3 becomes 8 → 5 → 4 → 2. The one fewer finding per round is the reasoned AI-203 not-discussed (item 2), which §6 already leaves to review (R01).

**By-design assertion changes (t21, t26, t27).**
- Prompt text: the completion-condition test replaces "never one broad task" and "one per LABEL".
- t26 now asserts that MATCH-02 is retired.
- t27 expects the golden's decided AI-7 and the advisory D-UX10 findings: 4 info, 0 warn, no repair round.

**Atlas golden revised for D-UX10: 11 → 13 ops, selfReview added.** Each change follows a rule:
- **AI-7** is decided: `not_discussed`, with a reason. This follows the testers' EX-14 (AI-7 untouched).
- **Parking (NEW-2)** quotes the ask itself ("Please make sure the host team confirms…"), because an unowned tasking must quote a request.
- **Deliverables are split:** the deck and the session notes become two taskings, and the transcript and the summaries become two taskings (rule 4; Oct 9 precedent). EX rows 05 and 06 now map to two ops each.
- **AI-8's working-approach note** keeps the speaker's "if needed".
- **selfReview** has seven rows. The confirm-receipt tasking names AI-9 and gives its reason.

**Known trade from D-UX10c.** With MATCH-02 retired, a merged label such as "provide the contact and verify the route" is no longer flagged mechanically unless its parts are lexicon deliverables or carry different timing. Rule 4 carries that case.

**Still open:**
- Send both goldens and the D-UX10f questions to the testers, adding the Atlas AI-7 decision and the deck/notes split.
- Then the terra-low protocol in §5 (steps 3–5).

## Addendum, 2026-10-12: tester rulings applied; timing evidence must be quoted

**Goldens.** The tester's rulings are in both goldens. Difficult: token `c72140f9`, NEW-3 label "Verify staging-area load suitability and identify an alternate staging area if needed", AI-203 note qualified ("Sofia's working understanding…"), AI-207 note and open question from S014 (travel and availability for personnel not working hands-on; the S015/S018 arrival plan is kept). Atlas: Reassign AI-6 `"from": null`, NEW-2 `"assignee": null`, flags cite with `src` only, NEW-4 cites S012 as two quotes ("This morning I will send the group" / "the notes from yesterday's coordination session") so the timing phrase is quoted without pulling the slide deck into the notes task.

**Validator change (TIME-UNGROUNDED).** The timing phrase was checked against the cited segment text, so a quote that left the phrase out still passed. It is now checked against the op's evidence: its quotes when the reply gives them, else the cited segments. Message: "phrase … not in its quotes; quote the words that carry the timing". No rubric row added (the tester's 16-row rubric is the pass standard).

**Tests.** Harness selftest: new check in the Difficult section (phrase cut from NEW-1's quote → exactly TIME-UNGROUNDED @ NEW-1; phrase kept in a short quote → clean). Playwright: t32.15, same case through the workbench. Knockout: both fail with the previous validator/build. Results on the new build: selftest ALL GREEN, jsdom 27/27, Playwright 49/49 (48 without the previous build as second argument; t31.0 needs it).

**Build for the three terra-low runs.** MeetingGraph.html sha256 `ae8c270578659bb1…` (replaces `888337ca…`; only the timing check changed). Chat text unchanged (`16f1f374…`).

## Addendum, 2026-10-12 (afternoon): testers' three terra-low runs, first replies

Three fresh chats on build `ae8c2705…`, token `c72140f9`. The testers sent each chat's **first reply only**; no repair rounds were run. The harness reproduces the workbench's must-fix counts exactly (3, 4, 7).

| Run | Rubric (harness) | Must-fix | Rows failed |
|---|---|---|---|
| 1 | 11/16 | 3 | R01, R03, R04, R05, R12 |
| 2 | 11/16 | 4 | R01, R03, R04, R06, R16 |
| 3 | 9/16 | 7 | R01, R03, R06, R07, R08, R12, R15 |

**Every run misses the same core judgments.** R01: AI-203 never gets the narrowed May 18–22 window. R03: the S023 note drops the setup/preparing scope. Route check: no run makes it a separate Sofia-owned task (runs 1–2 reassign AI-206; run 3 folds it into an AI-204 note). Staging check: no run makes it a separate unassigned task (all fold it into AI-204). These are the rows section 6 already named as beyond a lexical gate, and Aaron's own Oct 12 run kept missing them after two repair rounds.

**Rubric gap found.** R04 accepts the route check as a note or reassignment on AI-204, and R05 accepts the staging contingency inside any op citing S040. Both predate the Oct 12 rulings (route = its own task; staging = its own unassigned task), so the rubric would pass replies the testers ruled wrong. They must be tightened before any run is scored as a pass.

**Status:** protocol incomplete (repair rounds not run). As first replies, 0 of 3 pass.

## Addendum, 2026-10-12 (late afternoon): the three runs after two repair rounds

Same three chats, two repair rounds each, final replies scored.

**Rubric tightened first (harness only; the build is unchanged).** R04 now requires the route check to be its own Sofia-owned tasking; R05 requires the staging check to be its own unassigned tasking that keeps the alternate area. Both follow the Oct 12 rulings. Harness selftest stays ALL GREEN (golden clean, 14/14 mutations, rejected reply 14/14 rows agree).

| Run | Rubric, old rows | Rubric, tightened | Rows failed (tightened) |
|---|---|---|---|
| 1 | 13/16 | 12/16 | R01, R04, R05, R06 |
| 2 | 13/16 | 12/16 | R01, R04, R05, R06 |
| 3 | 13/16 | 12/16 | R01, R04, R05, R16 |

**Result: 0 of 3 pass.** Repairs fixed the generic faults (invitation admin, unconnected segments, merged deliverables in runs 1–2) and R03 (S023 setup scope, now clean in all three). They did not fix the three register-matching calls. AI-203 stays not_discussed in every run. The route check lands on AI-206 or AI-204. The staging check lands as a note on AI-204.

**Why those three persist.** Prompt rule 2 says a commitment whose subject matches an existing active tasking is an update, never new work. With baseline B's labels ("Coordinate partner-site access and staging arrangements", "Assess transfer-environment integration options"), the model follows rule 2. The rulings ask for the completion-condition test of rule 4 to win over rule 2's subject match; the prompt never says which rule wins. AI-203 is the reverse case: the model reads "test transfer with a sample file" as a different event from the real transfer.

**Further gaps found:**
- **Transcript timing:** all three runs date the transcript task "today", but the testers ruled it undated. No rubric row checks this.
- **Contradictory repair instructions (run 3):** OVER-SPLIT asks to merge NEW-2 and NEW-3 (both quote "I am putting those materials together…"), while DELIVERABLES-MERGED asks to split NEW-2. The repair prompt contradicts itself.

## Addendum, 2026-10-12 (evening): D-UX10h ratified and built

The testers ratified option 1 plus the repair-conflict fix and R17, kept every D-UX10 ruling, and set the protocol for one final three-run feasibility test.

**Built:**
- **Prompt, rule 2** (port step 12): the ratified "match by completion condition" text and its two examples sit right after rule 2's first sentence. The contrary sentence now reads "a new commitment with the same completion condition as an existing ACTIVE tasking … is an UPDATE" (was "whose subject matches"). Nothing else in the prompt changed. The chat text differs from the previous build only on the rule-2 line, and the token is still `c72140f9`, so both goldens stand unchanged.
- **Repair prompt dependency order** (`repair.js`, shared by the harness and the workbench): tier 1 classification, tier 2 decomposition, tier 3 labels, timing, evidence and scope. An op under an earlier-tier finding has its later-tier findings deferred to the next round. A concrete split (DELIVERABLES-MERGED, TIMING-MERGED, DECOMP-MERGED) suppresses an OVER-SPLIT merge on the same op.
- **R17** (rubric, baseline B): the transcript task carries no due date or phrase. Mutation D15 covers it; it is rubric-only, because "today's transcript" passes the timing check, so it stays out of the Playwright mutation index. Baseline B now has 17 rows.

**Tests:**
- Harness selftest ALL GREEN: golden clean on all 17 rows, mutations 15/15, rejected reply 14/14, and 0 of 21 repair prompts with a merge-and-split conflict (the tester runs included).
- jsdom 27/27; t29 F22 follows the new wording via `update_suite_dux10h.py`.
- Playwright 51/51, with new t30.7 (rule-2 text) and t32.16 (run 3's real reply, no conflict).
- Knockouts: each new check fails on the previous build or module.

**Build for the final feasibility test:** MeetingGraph.html sha256 `c0a5abcf…` (replaces `ae8c2705…`), chat text `418f2a4a…`; goldens unchanged (`05b3acfb…`, `88e606f1…`).

**Baseline before the test:** the three Oct 12 final replies score 12/17 each on the new rubric.

**Caveats:**
- The ratified examples mirror this fixture's labels, so a pass shows terra-low can follow the rule. It does not show the rule generalizes; the Atlas transcript and the real Oct 9 meeting are that check.
- "today's transcript" still satisfies the validator's timing check (only R17 catches it). Treating a possessive "today's" as a name rather than timing is a candidate validator change. The testers ruled it must not be made before the final run, because it would add a moving variable; R17 covers the requirement.

**Stop rule (ratified):** if the final test fails again on the same register-matching calls, stop expanding the prompt and move those classification decisions to explicit reviewer choice (D-UX11).

## Addendum, 2026-10-12 (evening): final feasibility test on the D-UX10h build

Three new fresh chats on build `c0a5abcf…`. Final replies scored on the 17-row rubric and the testers' checklist.

| Run | Token | Repair rounds | Rubric | Route task (Sofia) | Staging task (unassigned + alternate) | AI-203 window update | AI-207 travel | Transcript undated | No invitation tasks |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `c72140f9` | 0 (first reply clean in the workbench) | 16/17 | yes | yes | yes | yes | **no** (dated "today") | yes |
| 2 | `c72140f9` | 2, one item left | 14/17 | yes | yes | **no** (setup and readiness only, no May 18–22 narrowing) | yes | **no** | yes |
| 3 | `bf29491e` | 0 | 15/17 | yes | yes | **no** | yes | n/a (no transcript task) | yes |

**Run 3 does not count.** It was prepared with the meeting date set to Oct 12 instead of Oct 1, so its token is `bf29491e` and its dates resolve against the wrong day (it also raised an overdue flag on AI-203). It also classed all three documentation commitments (S019 information and deck, S033 transcript, S033 summaries) as administrative and made no tasks for them. The rubric caught only the materials part (R06). Rubric gap: no row requires the documentation commitments to exist as tasks.

**Result: the pass standard is not met (0 of 3; 0 of 2 valid runs).**

**What D-UX10h fixed:**
- **Route:** a separate Sofia-owned task in all three runs (it failed in every Oct 12 run before).
- **Staging:** a separate unassigned task with the alternate area in all three.
- **AI-203:** updated in all three; never "not discussed" again.
- **Run 1:** passed the workbench on its first reply.

**What still fails:**
- **R17 (transcript dated "today"):** both valid runs. No validator check raises it, so the repair loop never sees it. The possessive "today's" change was deferred before this run.
- **AI-203 content:** run 2 updates it with setup and readiness but omits the narrowed window (R01).
- **R06 (materials):** run 2 drops "materials" from the summaries label. DELIVERABLE-DROPPED was in the repair prompt and survived two rounds.

**Stop rule:** the route and staging errors did not recur, and AI-203 was never marked not discussed. Whether "AI-203 updated without the window" counts as the same AI-203 error is the testers' call.

**Run 3 redone (token `c72140f9`, two repair rounds):** 14/17. Route ✓, staging ✓, AI-207 ✓, no invitation tasks ✓. AI-203 updated with setup and readiness but not the narrowed window (R01 ✗). Transcript dated "today" (R17 ✗). Summaries label without "materials" (R06 ✗). One repair item remains: selfReview names the sibling NEW-3 as "nearest" (REF-DANGLING).

| Valid run | Rubric | Route | Staging | AI-203 window | Transcript undated | Materials kept |
|---|---|---|---|---|---|---|
| 1 | 16/17 | ✓ | ✓ | ✓ | ✗ | ✓ |
| 2 | 14/17 | ✓ | ✓ | ✗ | ✗ | ✗ |
| 3 (redone) | 14/17 | ✓ | ✓ | ✗ | ✗ | ✗ |

**Final result: 0 of 3 pass.**
- **The register-matching fix holds.** Route and staging are separate tasks in 3 of 3 runs (0 of 6 before D-UX10h), and AI-203 is never marked not discussed.
- **R17 fails 3 of 3.** In every run the transcript task borrows "today" from the summaries sentence or from "today's transcript". The workbench never raises it, so the repair loop cannot fix it.
- **Content completeness is inconsistent.** The AI-203 window is present in 1 of 3 runs; "materials" in 1 of 3. In run 3 the summaries task quotes only "get them out today", trimming "those materials" out of the quote. That avoids DELIVERABLE-DROPPED, which reads only the quote. QUOTE-TRUNCATED saw it but is advisory.
- **Stop rule:** route and staging did not recur. The original AI-203 error (not discussed) did not recur; the narrower omission (window missing) recurred in 2 of 3. Testers to rule whether that triggers the stop rule.

The three D-UX10h final replies are kept in `data/terra-low-2026-10-12/`; the harness's merge-and-split check stays at 0 conflicts with them included.


## Addendum, 2026-10-12 (evening): testers' ruling on the final test

**The final D-UX10 feasibility test failed. The stop rule is triggered.** AI-203's required schedule-window update was missing in 2 of 3 valid runs. The testers rule that this is the same material requirement as before ("not discussed" became "updated without the window"): the omission changes the board's factual project status.

| Item | Ruling |
|---|---|
| Further prompt changes | Not approved. Another exception would restart the same cycle. |
| Further terra-low retries | Not approved. The agreed 3-run, 2-repair-round protocol has failed. |
| Route/staging classification | Keep the D-UX10h prompt behavior; it stays in the regression baseline (3 of 3). |
| R17 transcript timing | Build as validator hygiene, not as a feasibility retry: "today's transcript" names the document; "send the transcript today" may set same-day timing when that wording is cited. |
| Supporting-materials check | Build as validator hygiene: compare deliverables against the full cited source sentence, not only the trimmed quote. |
| selfReview reference integrity | Build as validator hygiene: `newVsExisting.nearest` must be a pre-existing active INDEX task or null, never a sibling NEW-* from the same reply. |
| AI-203 window | Move to explicit reviewer choice (D-UX11). |
| Real Oct 9 extraction | Do not run as an automated feasibility test. |

**What the work has proven:**
- A prompt clarification can fix specific recurring classifications.
- The validator and repair loop expose and resolve many mechanical defects.
- The model consistently handles some distinct-action cases.

**What it has not proven:** that terra-low reliably produces complete and correctly scoped register updates from difficult meetings.

**Next path:**
1. Stop prompt expansion for this classification problem.
2. Keep the route and staging behavior.
3. Build the three hygiene checks as regression controls; they are not feasibility evidence.
4. Move recurring semantic task-scope decisions, starting with AI-203-style schedule updates, to explicit reviewer choice in the user/reviewer design (D-UX11).

## Addendum, 2026-10-12 (evening): validator hygiene built (regression controls, not feasibility evidence)

The three checks the testers approved are built. They do not reopen the feasibility test, and no terra-low runs follow from them.

- **Possessive timing.** "today's transcript" (likewise "tonight's", "tomorrow's", "this morning's", "this week's") names the document. A due date that rests only on such a word is TIME-UNGROUNDED, with a repair line telling the model to remove the date unless the speaker says when the item will be delivered. TIMING-MERGED ignores possessive time words too. "Send the transcript today" still counts, when that wording is quoted.
- **Whole-sentence deliverables.** DELIVERABLE-DROPPED now also reads the full sentence each quote comes from. A deliverable that sentence promises must appear in some op that cites the sentence. When none carries it, the finding goes to the citing op of the same family (summaries carry materials), else to the first citing op.
- **selfReview integrity.** `nearest` must be an existing active INDEX tasking or null. A sibling NEW-* from the same reply, or a closed tasking, is REF-DANGLING with its own message.

**Consequences:**
- **D12 and D15.** D12 (deck information merged with the transcript) now expects TIME-UNGROUNDED instead of TIMING-MERGED, because under the ruling "today's transcript" is not a second deadline; the merge is still the R16 rubric defect. D15 is now caught by the validator and joins the Playwright mutation index.
- **Atlas golden.** Its transcript task (NEW-5) now also quotes "to the distribution list today", the words that actually carry the timing. The content is unchanged.

**On the testers' real D-UX10h replies:**
- Runs 1 and 2: the transcript task's date is caught.
- Run 3: the summaries task's trimmed "materials" is caught, the finding lands on the summaries task (not the transcript), and the sibling "nearest" is caught.
- **Known gap, recorded:** run 3's transcript task borrows "today" from the summaries sentence ("get them out today"). The possessive rule does not cover that, and nothing else catches it mechanically.

**Tests:**
- Harness selftest ALL GREEN, with 6 new hygiene checks.
- jsdom 27/27; Playwright 52/52 (with the previous build as second argument).
- Knockouts: the four detection checks fail with the previous validator; D12 and D15 fail on the previous build; t27 and t34 fail when the Atlas golden lacks the timing quote.

**Builds:**
- New regression build MeetingGraph.html `f76c142c…`; the chat text is unchanged (`418f2a4a…`); Atlas golden `43ee4bbc…`.
- The final-test record (download page and `tester-files/`) stays at the build the testers ran: `c0a5abcf…`, with Atlas golden `88e606f1…`.

## Addendum, 2026-10-12 (night): D-UX11 approved with amendments

The testers approved D-UX11 for design and build, with amendments: three finding classes (A blocks the change, B is a meeting-scope question, C is recorded only); D-UX11h option (a), a direct reviewer-confirmed update citing the original segment; corrected decision and scope language; and new acceptance criteria. All of it is folded into `mkg-user-mode-plan.md`.

The three hygiene checks are confirmed as regression checks only. They do not establish model feasibility or reopen the D-UX10h result.

Before build, two items await ratification:
- the code-by-code class table (user-mode plan §7);
- the D-UX11h trigger rule (§8). Its harness prototype passes the four required cases: Difficult fires, Atlas stays quiet, already-attached stays quiet, unrelated stays quiet.

The D-UX10h feasibility result remains failed and closed.

## Addendum, 2026-10-12 (late): D-UX11 built

Aaron ratified the class table (user-mode plan §7) and the D-UX11h trigger (§8). User mode is built: MeetingGraph.html `3546c9e0…`. It opens in user mode; Reviewer details is a remembered setting and part of the workspace file.

**Two amendments, ratified by Aaron during build.** The first ratified gate failed 14 of the 27 existing suites. Two causes were design, not bugs:
- Replies with no coverage tables (older format) became blocked. Now they ask: "Accept it as it is?" (Accept / Defer).
- Calls the chat had already made and justified (non-repair NEW-DUPLICATE and MATCH-BETTER-TARGET; info-level `unsupported_not_discussed`) became questions. Now they are recorded only.

**Tests:**
- Harness selftest ALL GREEN.
- jsdom 27/27; 10 suites now accept through the gate (Defer as proposed).
- Playwright t30–t33 52/52.
- t35 (new) 62/62.
- Knockouts: same package across views, jargon scan, class A blocking, consequences preview.

**Open:** acceptance criterion 6, a first-time user outside the build team. The D-UX10h feasibility result stays failed and closed. The final-test record stays at `c0a5abcf…`.

## Addendum, 2026-10-12 (evening): unowned tasks (Aaron's ruling)

**Ruling.** Work the meeting asked for becomes a task even when nobody took it on. The task is created unowned; the board shows "No owner yet" for someone to settle later. It is not assigned to the person who asked: a request names who wants the work, not who does it, and a wrong owner makes the task look handled.

**Built (MeetingGraph.html `bd342c44…`):**
- The validator accepts an unowned task that quotes a direct, unconditional request ("please", "make sure", "can you", "need to", "have to", "must"), however the chat classified the statement. "Should" and a bare question do not count: "the team should be prepared for that" stays blocked (weaker-model rounds 0–1, NEW-2). Conditional instructions and descriptions of work under way still block.
- The workbench adds a progress note to each such task: "Requested by <name>: “<the request>” No one in the meeting took it on yet." No format change. The note carries the request word for word, so it raises no finding of its own.
- Tests: selftest ALL GREEN; jsdom 27/27; Playwright t30–t33 52/52; t35 64/64 (t35.37–38 new, both fail on the previous build).

## Addendum, 2026-10-12 (night): attach to existing work; "those materials" (Aaron's rulings)

**1. What belongs to an existing task goes on it as a note.** When a new task may be existing work, the question no longer forces keep-or-drop. Answers: Keep it as new work / **Add it to "<existing task>" as a note** (one option for each fitting task) / Defer. The workbench then removes the new task, adds a note on the existing task ("Also needed for this task: <label>. From the meeting: "<quotes>""), and moves the reply's other notes, flags and classifications for it to that task. A note the reply put on the wrong task gets **Move it to "<task>"**. Nothing is lost, and nothing has to be argued as a new task.

**Acceptance criteria:** the board format has no acceptance-criteria field, so these go in as notes. A separate field would be a format change, and other tools read the format.

**2. "Those materials" is not a deliverable.** In "I am putting those materials together now", the phrase refers back to the transcript and the summaries. A deliverable word after "those" or "these" no longer counts as missing. This reverses the testers' rubric row R06 and mutation D06: R06 now checks a named deliverable (the slide deck), and D06 drops the slide deck.

**Tests (MeetingGraph.html `1f712c2d…`):** selftest ALL GREEN, with 3 new attach checks. jsdom 27/27. Playwright t30–t33 52/52. t35 69/69: t35.39–42 are new and fail on the previous build.

## Addendum, 2026-10-12 (late night): Aaron's third test

- **"Slides" now counts as the promised "slide deck".** The deliverable check compares stems, not spellings, so a label saying "partner-site location slides" carries "slide deck". A label with no slides at all is still caught (D06).
- **Decisions first.** In user mode, every open question and every change that can't be accepted as written is listed first, under "Needs your decision (N)", with how to act on each. The other changes follow. The line under Update the board names what is left: "Still to decide: 1 question and 2 changes that can't be accepted as written."
- **On Aaron's third reply:** 3 decisions, down from 4: the travel-days question and the two invitation-administration changes.
- **Tests (MeetingGraph.html `1c16408b…`):** selftest ALL GREEN; jsdom 27/27; Playwright t30–t33 52/52; t35 72/72. t35.43–45 are new and fail on the previous build.

## Addendum, 2026-10-12 (late night): D-UX12 ratified and Phase 1 built

Aaron ratified D-UX12 (`claude/mkg-dux12-plan.md`): place, label, and move on. MeetingGraph blocks an import only for integrity failures and contradictory changes; everything else is placed with a visible, source-linked label, and unsupported owner, status, date, prerequisite and decision changes are demoted to labeled notes. Phase 1 is built: MeetingGraph.html `24e5b137…`, with board labels, project Open items and a Needs attention view. Build status and the choices made in build are in the plan's §12. Still open: the first-time-user session. The D-UX10h feasibility result stays failed and closed.
