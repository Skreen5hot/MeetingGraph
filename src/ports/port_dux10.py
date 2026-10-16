# -*- coding: utf-8 -*-
"""D-UX10 port into MeetingGraph.html (ratified 2026-10-11).
Every replacement asserts its exact match count; the file is written only if all pass.
Shared modules (validator.js, repair.js) are embedded verbatim from the test harness, so the
workbench and the harness run the same code.
"""
import re, sys
SRC, OUT, MG = sys.argv[1], sys.argv[2], sys.argv[3]
s = open(SRC, encoding='utf-8').read()

def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f"expected {count}, found {n}: {old[:90]!r}"
    s = s.replace(old, new)

def module_body(path):
    t = open(path, encoding='utf-8').read()
    a = t.index("(function (root) {\n'use strict';\n") + len("(function (root) {\n'use strict';\n")
    b = t.index("\nconst api = ")
    return t[a:b]

# ---------- 1. Prompt: rule 4 decomposition sentence replaced (D-UX10c) ----------
rep("""One stretch of discussion often yields several commitments with different completion conditions (coordinate with the contact; send their details; verify the entry point; confirm compatibility) \\u2014 emit each as its own NewTasking, never one broad task. One completion condition per tasking also means one per LABEL: never join two deliverables with "and" ("provide the contact and verify the route" is two taskings; "verify suitability and identify an alternate if needed" is one task with its contingency). """,
    """One tasking per completion condition, judged by how the work gets done: split only when the parts can be completed independently by different acts (coordinate with the contact; send their details; verify the entry point \\u2014 three taskings). A result that follows from a verification is part of that verification ("verify the route and confirm which one to use" is one tasking), and a contingency stays in its verification's label ("verify suitability and identify an alternate if needed"). Separate deliverables or separate deadlines are separate taskings even when one sentence promises them together (today's transcript; yesterday's summaries). """)

# ---------- 2. Prompt: selfReview.newVsExisting (D-UX10a) ----------
rep("""STEP 4. Emit exactly one JSON object in Part B of the three-part output below, with the tables included as "segments" and "register" and the "coveredProjects" array.""",
    """STEP 4. Emit exactly one JSON object in Part B of the three-part output below, with the tables included as "segments" and "register", the "coveredProjects" array, and "selfReview" (one newVsExisting row per NewTasking).""")
rep("""    {"id": "AI-203", "coverage": "updated|discussed_no_register_change|not_discussed|possible_match_requires_review", "segs": ["S004"], "note": "required for discussed_no_register_change and possible_match_requires_review"}
  ]
}
"segments" has one entry per transcript segment""",
    """    {"id": "AI-203", "coverage": "updated|discussed_no_register_change|not_discussed|possible_match_requires_review", "segs": ["S004"], "note": "required for discussed_no_register_change and possible_match_requires_review"}
  ],
  "selfReview": {"newVsExisting": [{"ref": "NEW-1", "nearest": "AI-203 or null", "whyNew": "one sentence: why this is new work rather than an update to the nearest existing tasking"}]}
}
"selfReview.newVsExisting" has one row per NewTasking: the closest ACTIVE register tasking (or null when none is close) and one sentence on why this is new work rather than an update to it (rule 2) \\u2014 the validator compares your nearest with its own match.
"segments" has one entry per transcript segment""")

# ---------- 3. Shared modules + workbench glue, before compile() ----------
glue = r"""
/* =====================================================================
   D-UX10 (ratified 2026-10-11): tester-aligned checks and the repair loop.
   DUX10 and DUX10_REPAIR are the test harness's validator v0.2 and repair module,
   embedded verbatim; dux10Findings adapts the workbench's data to them.
   ===================================================================== */
const DUX10 = (() => {
'use strict';
@@VALIDATOR@@
return { validate, adapt, validRationale };
})();
const DUX10_REPAIR = (() => {
'use strict';
@@REPAIR@@
return { repairLines, alsoLines, compose };
})();
// D-UX9 already reports these in its own words; D-UX10 does not repeat them.
const DUX10_DUP = new Set(["DISP-MISSING", "COV-MISSING-ITEM", "COV-UNBOUND-DISPOSITION", "COV-CLAIM-UNSUPPORTED", "COV-CONTRADICTION", "COV-POSSIBLE-MATCH", "CITE-RANGE", "COV-UNRESOLVED"]);
function dux10Findings({ norm, llm, meeting, S, segByT, openPre }) {
  const segTab = Array.isArray(llm.segments) ? llm.segments : null;
  if (!segTab) return []; // D-UX10 extends the coverage contract; a reply without tables already draws "tables_missing".
  const segOfT = t => { const sg = segByT[String(t).padStart(8, "0")]; return sg ? sg.id : null; };
  const srcOf = o => [].concat(o.src || []).map(it => typeof it === "string" ? { seg:it, quote:"" }
    : { seg:it.seg || it.segment || (it.t ? segOfT(it.t) : null), quote:it.quote || "" }).filter(x => x.seg);
  const pkg = {
    context:llm.context,
    ops:norm.filter(o => o.type).map(o => ({ op:o.type, ref:o.ref, tasking:o.tasking, project:o.project, label:o.label, text:o.text, name:o.name,
      assignee:o.assignee, to:o.to, from:o.from, dueDate:o.dueDate, duePhrase:o.duePhrase, about:o.about, src:srcOf(o) })),
    flags:[].concat(llm.flags || []), segments:segTab, register:Array.isArray(llm.register) ? llm.register : [],
    coveredProjects:[].concat(llm.coveredProjects || []), selfReview:llm.selfReview || null
  };
  // Judge against the register as it stood BEFORE this reply: compile has folded the reply's own ops into S by now.
  const minted = new Set(norm.filter(o => o.type === "NewTasking" && o.minted).map(o => o.minted.code));
  const openBefore = new Set((openPre || []).map(t => t.code));
  const tasks = Object.values(S.taskings).filter(t => !t.mergedInto && !minted.has(t.code)).map(t => ({ id:t.code, project:t.project, title:t.label, description:"",
    owner:null, status:openBefore.has(t.code) ? "open" : "closed" }));
  const projects = Object.values(S.projects).map(p => ({ id:p.code, title:p.name, description:p.description || "" }));
  const ctx = { meetingDate:meeting.date, segments:meeting.segments.map(x => ({ id:x.id, speaker:x.speakerId || x.speakerName, text:x.text })),
    register:{ projects, tasks }, requireSelfReview:true };
  const noted = new Set(segTab.filter(e => e && [].concat(Array.isArray(e.dispositions) ? e.dispositions : [e]).some(d => d && String(d.note || "").trim())).map(e => String(e.seg).trim()));
  return DUX10.validate(pkg, ctx).flags
    .filter(f => !DUX10_DUP.has(f.code))
    .filter(f => !(f.code === "REF-DANGLING" && /disposition for unknown segment/.test(f.msg)))
    .filter(f => !(f.code === "TIME-UNGROUNDED" && /not in cited segments/.test(f.msg)))
    .filter(f => !(f.code === "COV-EMPTY-RATIONALE" && /needs its one-line note/.test(f.msg) && !noted.has(f.ref)))
    .map(f => ({ code:f.code, ref:f.ref, msg:f.msg, repair:f.sev === "block" }));
}
// The repair prompt (D-UX10b): errors and repair-required findings, for the SAME chat; at most two rounds.
function buildRepairPrompt(comp) {
  const plain = h => String(h == null ? "" : h).replace(/<[^>]+>/g, "").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
  const must = [];
  for (const g of comp.global || []) if (g.lvl === "error") must.push(plain(g.text));
  for (const r of comp.rows || []) for (const m of r.msgs || []) if (m.lvl === "error") must.push(`Operation ${r.n} (${r.type}${r.target ? " " + plain(r.target) : ""}): ${plain(m.text)}`);
  const fs = (comp.coverage && comp.coverage.findings) || [];
  // D-UX9 warnings with a D-UX10 equivalent join the shared grouping, so a low-effort model gets one line per kind.
  const fromD9 = f => { const t = plain(f.text); let m;
    if (f.cat === "unresolved_commitment" && (m = /^(S\d+) is classified (\w+)/.exec(t))) return { code:"COV-UNBOUND-DISPOSITION", ref:m[1], msg:`${m[1]} (${m[2]}) is cited by no op or flag and has no rationale` };
    if (f.cat === "missing_disposition" && (m = /^([A-Z]+-\d+) .* is open in a covered project but has no coverage classification/.exec(t))) return { code:"COV-MISSING-ITEM", ref:m[1], msg:`${m[1]} has no coverage row` };
    return null; };
  const d9 = fs.filter(f => !f.code && f.lvl === "warn");
  const rep = [...fs.filter(f => f.code && f.repair).map(f => ({ code:f.code, ref:f.ref, msg:f.msg })), ...d9.map(fromD9).filter(Boolean)];
  const adv = fs.filter(f => f.code && !f.repair).map(f => ({ code:f.code, ref:f.ref, msg:f.msg }));
  must.push(...DUX10_REPAIR.repairLines(rep));
  for (const f of d9) if (!fromD9(f)) must.push(plain(f.text));
  return DUX10_REPAIR.compose(must, DUX10_REPAIR.alsoLines(adv, rep));
}

function compile(llm, meeting, pkgs) {"""
glue = glue.replace("@@VALIDATOR@@", module_body(MG + "/validator.js")).replace("@@REPAIR@@", module_body(MG + "/repair.js"))
rep("\nfunction compile(llm, meeting, pkgs) {", glue)

# ---------- 4. MATCH-02 retired by D-UX10c ----------
rep("""          // MATCH-02 (2026-10-10): a label joining two deliverables with "and" is two tasks
          // (a conditional contingency — "... if needed" — stays one task).
          if (o.label && !/ if /i.test(o.label)) {
            const RX_VERB = /\\b(send|provide|verify|confirm|coordinate|update|schedule|review|identify|distribute|draft|share|collect|notify|arrange|prepare)\\b/i;
            const halves = o.label.split(/\\band\\b/i);
            if (halves.length >= 2 && halves.filter(h => RX_VERB.test(h)).length >= 2)
              msgs.push(warn("This label joins two deliverables with “and” — two completion conditions means two taskings (rule 4). Split it unless the second part is a contingency of the first."));
          }
""", """          // MATCH-02 retired by D-UX10c (2026-10-11): "verb and verb" also caught one completion condition
          // ("verify the route and confirm which to use"). Bundled deliverables and mixed deadlines are now
          // DELIVERABLES-MERGED / TIMING-MERGED in the Coverage review.
""")

# ---------- 5. Coverage findings carry code/repair; COV-UNRESOLVED; D-UX10 findings ----------
rep("""    const F = (cat, lvl, text, id) => { if (seenF.has(text)) return; seenF.add(text); findings.push({ cat, lvl, text, ...(id ? { id } : {}) }); };""",
    """    const F = (cat, lvl, text, id, extra) => { if (seenF.has(text)) return; seenF.add(text); findings.push({ cat, lvl, text, ...(id ? { id } : {}), ...(extra || {}) }); };""")
rep("""          if (cov2 === "possible_match_requires_review") F("possible_match", "info", `Possible task match — review required: ${t.code} “${esc(t.label)}” (${segs.join(", ") || "no segments given"})${String(r.note || "").trim() ? `: ${esc(String(r.note).trim())}` : ""}.`, t.code);""",
    """          // D-UX10d: an undecided possible match is repair-required — the extractor decides it, not the reviewer.
          if (cov2 === "possible_match_requires_review") F("possible_match", "warn", `Possible task match — review required: ${t.code} “${esc(t.label)}” (${segs.join(", ") || "no segments given"})${String(r.note || "").trim() ? `: ${esc(String(r.note).trim())}` : ""}. Left undecided — the repair prompt asks the extractor to decide it (D-UX10).`, t.code,
            { code:"COV-UNRESOLVED", repair:true, ref:t.code, msg:`${t.code} left as "possible_match_requires_review"` });""")
rep("""      out.coverage = { present:true, findings, tables:{ segments:segTab, register:regTab } };""",
    """      // ---------- D-UX10 (ratified 2026-10-11): tester-aligned checks ----------
      // Repair-required findings (warn) feed the repair prompt; advisory ones (info) are review aids. Neither blocks Accept.
      try {
        for (const x of dux10Findings({ norm, llm, meeting, S, segByT, openPre }))
          F("dux10", x.repair ? "warn" : "info", `${x.code}: ${esc(x.msg)}`, x.ref, { code:x.code, repair:x.repair, ref:x.ref, msg:x.msg });
      } catch (e) { F("dux10", "info", `D-UX10 checks could not run: ${esc(e && e.message ? e.message : String(e))}`); }
      out.coverage = { present:true, findings, tables:{ segments:segTab, register:regTab } };""")

# ---------- 6. Package review record keeps the finding code ----------
rep("""findings:cv.findings.map((f, i) => ({ cat:f.cat, lvl:f.lvl, text:f.text, ...(f.id ? { id:f.id } : {}), resolution:sel[String(i)] || "accepted" })) };""",
    """findings:cv.findings.map((f, i) => ({ cat:f.cat, lvl:f.lvl, text:f.text, ...(f.id ? { id:f.id } : {}), ...(f.code ? { code:f.code, repair:!!f.repair } : {}), resolution:sel[String(i)] || "accepted" })) };""")

# ---------- 7. Results: repair card + repair badges ----------
# The repair card sits directly above the Coverage review card it resolves into, after the model's own
# Reviewer questions, so the ratified reading order (questions before operations, t13) is unchanged.
rep("""      ${comp.coverage && comp.coverage.findings.length ? `<div class="card"><h3>Coverage review (""",
    """      ${repairCardHtml(comp)}
      ${comp.coverage && comp.coverage.findings.length ? `<div class="card"><h3>Coverage review (""")
rep("""        <ul class="revlist">${comp.coverage.findings.map((f, i) => `<li>
          <div><span class="msg ${f.lvl === "warn" ? "warn" : "info"}">${f.text}</span></div>""",
    """        <ul class="revlist">${comp.coverage.findings.map((f, i) => `<li${f.code ? ` data-code="${esc(f.code)}" data-ref="${esc(f.ref || "")}"` : ""}>
          <div>${f.repair ? `<span class="rule">repair</span> ` : ""}<span class="msg ${f.lvl === "warn" ? "warn" : "info"}" style="display:inline">${f.text}</span></div>""")
rep("""    const acc = el.querySelector("[data-accept]");
    if (acc) acc.addEventListener("click", async () => { if (comp.errors) return; acc.disabled = true; await onAccept(); });
  }""", """    const acc = el.querySelector("[data-accept]");
    if (acc) acc.addEventListener("click", async () => { if (comp.errors) return; acc.disabled = true; await onAccept(); });
    const rb = el.querySelector("#copy-repair");
    if (rb) rb.addEventListener("click", async () => {
      const tok = state.prepared && state.prepared.token;
      if (!state.repair || state.repair.token !== tok) state.repair = { token:tok, n:0 };
      if (state.repair.n >= 2) return toast("Two repair rounds already used for this meeting. Resolve what remains on the Coverage review card.");
      const ta = el.querySelector("#repair-text");
      try { await navigator.clipboard.writeText(ta.value); } catch (e) { ta.select(); document.execCommand("copy"); }
      state.repair.n++;
      rb.textContent = state.repair.n >= 2 ? "Two repair rounds used" : `Copy repair prompt (round ${state.repair.n + 1} of 2)`; rb.disabled = state.repair.n >= 2;
      toast(`Repair prompt copied (round ${state.repair.n} of 2). Paste it into the same chat, then paste the complete corrected reply here and validate.`);
    });
  }

  // D-UX10b: the repair round card. Same chat, at most two rounds per prepared meeting.
  function repairCardHtml(comp) {
    if (!state.prepared || state.prepared.kind !== "transcript") return "";
    const txt = buildRepairPrompt(comp); if (!txt) return "";
    const used = state.repair && state.repair.token === state.prepared.token ? state.repair.n : 0;
    const n = (txt.match(/^\\d+\\. /mg) || []).length;
    return `<div class="card" id="repair-card"><h3>Repair round</h3>
      <p class="small" style="margin-top:0">${n} item${n === 1 ? "" : "s"} for the extractor to correct. Copy the repair prompt into the <strong>same chat</strong>, then paste its complete corrected reply here and validate again. At most two rounds per meeting; whatever remains after that is resolved on the Coverage review card. Coverage findings never block Accept${comp.errors ? "; errors do" : ""}.</p>
      <div class="actions"><button class="btn primary" id="copy-repair" ${used >= 2 ? "disabled" : ""}>${used >= 2 ? "Two repair rounds used" : `Copy repair prompt (round ${used + 1} of 2)`}</button></div>
      <details><summary class="small" style="cursor:pointer">Show the repair prompt</summary><textarea id="repair-text" rows="10" readonly>${esc(txt)}</textarea></details></div>`;
  }""")

# ---------- 8. Baseline B: the testers' four P2 taskings (D-UX10e) ----------
rep("""   ["BL-202","P2","Get the firewall rule approved","patel","open",null],""",
    """   ["BL-202","P2","Get the firewall rule approved","patel","open",null],
   ["AI-204","P2","Coordinate partner-site access and staging arrangements",null,"open",null],
   ["AI-205","P2","Send partner access point-of-contact details",null,"open",null],
   ["AI-206","P2","Assess transfer-environment integration options",null,"open",null],
   ["AI-207","P2","Finalize transfer travel and arrival plan",null,"open",null],""")

# ---------- 9. MATCH-01 defers to a selfReview row naming the same tasking with a reason (D-UX10a) ----------
rep("""                msgs.push(warn(`Shares its subject with ${c.code} “${esc(c.label)}” (${shared.join(", ")}). If this commitment advances that existing work, record it there (ProgressNote, Reassign or Deadline on ${c.code}) instead of a new task (rule 2); if it is a distinct completion condition, accept as is.`));
                break;""",
    """                const srRow = [].concat((llm.selfReview && llm.selfReview.newVsExisting) || []).find(x => x && x.ref === o.ref && String(x.nearest || "").trim().toUpperCase() === c.code);
                if (srRow && DUX10.validRationale(String(srRow.whyNew || ""))) msgs.push(info(`Shares its subject with ${c.code} “${esc(c.label)}” (${shared.join(", ")}); the reply's selfReview names ${c.code} and says why this is separate work: ${esc(String(srRow.whyNew).trim())}`));
                else msgs.push(warn(`Shares its subject with ${c.code} “${esc(c.label)}” (${shared.join(", ")}). If this commitment advances that existing work, record it there (ProgressNote, Reassign or Deadline on ${c.code}) instead of a new task (rule 2); if it is a distinct completion condition, accept as is.`));
                break;""")

# ---------- 10. D-UX10 parity: a reasoned not_discussed is a review aid, not a repair item ----------
# Validator v0.2 accepts "not_discussed" with a reason (COV-POSSIBLE-MATCH fires only without one), and the
# COV-UNRESOLVED repair text asks for exactly that. The D-UX9 lexical challenge, which the workbench runs in its
# place, now does the same: with a valid reason it is info and quotes the reason; without one it stays warn.
# The table-contradiction check above it is unchanged. The finding keeps its category, so the meeting email
# still lists the item under "Possibly discussed - under review".
rep("""            if (hits.length) F("unsupported_not_discussed", "warn", `${t.code} “${esc(t.label)}” is marked not discussed, but ${hits.join("; ")} share${hits.length === 1 ? "s" : ""} its subject — possible discussion match, review required.`, t.code);""",
    """            const ndWhy = String(r.note || "").trim();
            if (hits.length && DUX10.validRationale(ndWhy)) F("unsupported_not_discussed", "info", `${t.code} “${esc(t.label)}” is marked not discussed with a reason (“${esc(ndWhy)}”), although ${hits.join("; ")} share${hits.length === 1 ? "s" : ""} its subject — spot-check the reason.`, t.code);
            else if (hits.length) F("unsupported_not_discussed", "warn", `${t.code} “${esc(t.label)}” is marked not discussed, but ${hits.join("; ")} share${hits.length === 1 ? "s" : ""} its subject — possible discussion match, review required.`, t.code);""")

# ---------- 11. MATCH-01 judges new work against existing work only (D-UX10c) ----------
# Rule 2 asks for an update instead of a near-duplicate of EXISTING work. Two taskings minted by the same reply
# are siblings: rule 4 now splits separate deliverables even inside one sentence ("today's transcript"; "the
# summaries"), and OVER-SPLIT / DELIVERABLES-MERGED judge that relation. Comparing siblings here told the model to
# "record it there" on a tasking it was creating in the same reply (Atlas regression, 2026-10-11). The exact-label
# duplicate check above still covers siblings.
rep("""          // MATCH-01 (2026-10-10): partial subject overlap is a reviewer flag, never a silent mint.
          if (o.label && !dupHit) {
            const mine = sigTokens(o.label);
            for (const c of cands) {
              const theirs = sigTokens(c.label);""",
    """          // MATCH-01 (2026-10-10): partial subject overlap is a reviewer flag, never a silent mint.
          if (o.label && !dupHit) {
            const mine = sigTokens(o.label);
            for (const c of cands) {
              if (norm.some(x => x.type === "NewTasking" && x.minted && x.minted.code === c.code)) continue; // sibling minted by this reply (step 11)
              const theirs = sigTokens(c.label);""")

# ---------- 12. D-UX10h: rule 2 matches by completion condition (ratified by the testers, 2026-10-12) ----------
# After two repair rounds, three terra-low runs still filed the route check and the staging check under AI-204/AI-206
# and marked AI-203 not discussed. Rule 2 said a commitment "whose subject matches" an active tasking is an update;
# rule 4 says separate completion conditions are separate taskings; the prompt never said which wins. The testers
# ratified the text below, inserted after rule 2's first sentence, with its two examples, and asked that the
# contrary subject-match sentence stop implying that subject similarity alone decides.
RULE2_ADD = ('Match by completion condition, not merely by subject. Update an existing active tasking only when it already covers the same independently completable outcome. '
  'If a meeting commitment creates a distinct verification, deliverable, or required follow-up that can be completed separately from the existing tasking, create a separate NewTasking even when both concern the same subject. '
  'A broader coordination, staging, access, or integration task does not absorb a separate verification unless completing the broader task necessarily completes that verification. '
  "Conversely, when an existing active tasking is the meeting's named operational outcome, attach changes to that outcome, including its schedule, readiness, setup, travel, or execution context, even if the transcript uses broader or different wording. "
  'Do not mark it not discussed solely because the transcript does not repeat every word of the task label. '
  'Examples: "Coordinate site access and staging" does not absorb "verify the route is suitable" or "verify the staging area can support the load and identify an alternate if needed"; these are separate taskings. '
  '"Run a test transfer with a sample file" is updated by a changed transfer window, readiness conditions, setup day, or travel context for that transfer. ')
rep("2. Match before you create. Map every person, project and task mentioned to the INDEX,",
    "2. Match before you create. " + RULE2_ADD + "Map every person, project and task mentioned to the INDEX,")
rep("A new commitment whose subject matches an existing ACTIVE tasking \\u2014 open, open (unreported), in_progress, or blocked \\u2014 is an UPDATE to that tasking",
    "A new commitment with the same completion condition as an existing ACTIVE tasking \\u2014 open, open (unreported), in_progress, or blocked \\u2014 is an UPDATE to that tasking")

open(OUT, 'w', encoding='utf-8').write(s)
print('ported:', OUT, len(s), 'chars')
