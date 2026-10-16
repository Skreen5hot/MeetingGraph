"""D-UX11 user mode (ratified 2026-10-12): applies on top of the D-UX10 build that port_dux10.py produces.
Usage: python3 port_dux11.py <D-UX10 MeetingGraph.html> <out.html> <harness dir with ux11.js, dux11-trigger.js> <ux11-ui.js>
Every edit asserts its exact match count. The decision model (ux11.js) and the D-UX11h trigger (dux11-trigger.js) are
the harness modules embedded verbatim, like validator.js and repair.js in the D-UX10 port."""
import sys

SRC, OUT, MG, UI = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
s = open(SRC, encoding='utf-8').read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f'expected {count} match(es), found {n}: {old[:90]!r}'
    s = s.replace(old, new)


def module_body(path):
    t = open(path, encoding='utf-8').read()
    a = t.index("(function (root) {\n'use strict';\n") + len("(function (root) {\n'use strict';\n")
    b = t.index("\nconst api = ")
    return t[a:b]


# ---------- 1. Shared modules: decision model and D-UX11h trigger ----------
rep("\nfunction compile(llm, meeting, pkgs) {", """
/* =====================================================================
   D-UX11 (ratified 2026-10-12): user mode. UX11 is the harness's decision model (ux11.js) and UX11_TRIGGER its
   D-UX11h candidate-question trigger (dux11-trigger.js), embedded verbatim. They classify findings and propose
   questions; every choice is applied to the reply and compiled again, so nothing bypasses the gate.
   ===================================================================== */
const UX11_TRIGGER = (() => {
'use strict';
""" + module_body(MG + "/dux11-trigger.js") + """
return { candidates, isSchedule, RANGE_RE };
})();
const UX11 = (() => {
'use strict';
""" + module_body(MG + "/ux11.js") + """
return { classify, readiness, readinessUx11, defaults, mergeChoices, applyChoices, settle, labelsOf, consequences, reviewRecord, opIndexer, quoteFor, A_REASON, LABELS };
})();

function compile(llm, meeting, pkgs) {""")

# ---------- 2. Styles: user mode hides the machinery; Reviewer details hides the user panel ----------
rep("</style>", """/* D-UX11 user mode */
#view-prepare.um .um-hide,#view-prepare.um #seg-out .card,#view-prepare.um .rd-only,#view-prepare.um #prep-status,#view-prepare.um #import-meeting,#view-prepare.um #import-out.ux-decorated > :not(.um-only){display:none!important}
#view-prepare:not(.um) .um-only{display:none!important}
.ux-top{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap}
.rd-switch{display:inline-flex;gap:6px;align-items:center;font-size:13px;color:var(--muted);white-space:nowrap}
.um-next{border-left:4px solid var(--accent)}
.um-next .um-msg{margin:0 0 8px;font-size:15px;font-weight:560}
.um-result h3{margin:18px 0 6px}
.ux-list{list-style:none;margin:0;padding:0}
.ux-list>li{padding:10px 0;border-top:1px solid var(--line)}
.ux-keep{float:right;margin-left:12px;white-space:nowrap}
.ux-block{margin-top:6px;padding:6px 10px;border-radius:6px;background:var(--block-soft);color:var(--block)}
.ux-btns{display:inline-flex;flex-wrap:wrap;gap:6px;margin-left:4px}
.ux-done{margin-top:6px;color:var(--muted)}
.ux-dropped .ux-sent{text-decoration:line-through;color:var(--muted)}
.ux-q .ux-ans{display:flex;flex-wrap:wrap;gap:6px 18px;margin-top:6px}
.ux-why summary{cursor:pointer;color:var(--accent)}
.ux-needs{border-left:4px solid var(--block)}
.ux-needs h4{margin:14px 0 4px}
.ux-place{margin-top:6px;padding:6px 10px;border-radius:6px;background:var(--accent-soft,rgba(80,120,200,.08))}
.ux-labels{border-left:4px solid var(--accent)}
.ux-labels h4{margin:12px 0 4px}
.ux-over summary{cursor:pointer;font-weight:600;margin:8px 0}
.lbls{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.lbl summary{list-style:none;cursor:pointer}
.lbl summary::-webkit-details-marker{display:none}
.lbl-chip{display:inline-block;font-size:12px;padding:1px 8px;border-radius:999px;border:1px solid var(--accent);color:var(--accent)}
.lbl-body{margin:4px 0 6px;padding:6px 10px;border-left:3px solid var(--accent-soft);font-size:13px}
.lbl-body p{margin:0 0 4px}
.lbl-q{margin:4px 0;padding:0 0 0 8px;border-left:2px solid var(--line);font-style:italic}
.lbl-list{list-style:none;margin:0;padding:0}
.lbl-row{padding:8px 0;border-top:1px solid var(--line)}
.lbl-name{display:inline-block;font-size:12px;font-weight:600;padding:1px 8px;border-radius:999px;background:var(--accent-soft);margin-right:6px}
.lbl-src summary{cursor:pointer;font-size:12px;color:var(--accent)}
.sig.lbl{background:var(--accent-soft);color:var(--accent)}
</style>""")

# ---------- 3. Markup: the next-action bar, the Reviewer details switch, the plain lead ----------
rep("""    <h2>Process meeting</h2>
    <p class="lead">One flow, four steps:""",
    """    <div class="ux-top"><h2>Process meeting</h2><label class="rd-switch"><input type="checkbox" id="rd-toggle"> Reviewer details</label></div>
    <p class="lead um-only">Paste the transcript, send the request to the chat, paste its reply, then review the changes and update the board. Nothing is saved until you do.</p>
    <div class="card um-next um-only" id="um-next" role="status" aria-live="polite"></div>
    <p class="lead rd-only">One flow, four steps:""")
rep("""<button class="btn primary" id="do-segment" aria-label="Step 2: number the segments">""",
    """<button class="btn primary um-hide" id="do-segment" aria-label="Step 2: number the segments">""")
rep("""<button class="btn primary" id="do-validate" aria-label="Step 4: validate the pasted reply">Validate</button>
        <button class="btn" id="sample-output">Load sample extractor output</button>""",
    """<button class="btn primary um-hide" id="do-validate" aria-label="Step 4: validate the pasted reply">Validate</button>
        <button class="btn um-hide" id="sample-output">Load sample extractor output</button>""")
rep("""    <div class="card"><details><summary style="cursor:pointer;font-weight:650">Merge duplicate entries (advanced, rarely needed)</summary>""",
    """    <div class="card rd-only"><details><summary style="cursor:pointer;font-weight:650">Merge duplicate entries (advanced, rarely needed)</summary>""")

# ---------- 4. Hooks: validation builds the decision model; Accept goes through the shared wrapper ----------
rep("""  $("do-validate").addEventListener("click", () => {
    let llm;""", """  $("do-validate").addEventListener("click", () => {
    $("import-out").classList.remove("ux-decorated");
    let llm;""")
rep("""    state.compiled = comp;
    const cons = acceptConsequence(state.prepared);
    renderResults($("import-out"), comp, cons ? cons.label : "Accept and download package", async () => {""",
    """    state.compiled = comp;
    uxOnValidated(comp, llm);
    const cons = acceptConsequence(state.prepared);
    renderResults($("import-out"), comp, cons ? cons.label : "Accept and download package", uxAccept(async () => {""")
rep("""      showTab("board"); toast(`Accepted and downloaded. To revise this meeting, answer the chat's questions and paste its new reply \\u2014 the preparation is still loaded.`);
    });
  });""",
    """      showTab("board"); toast(`Accepted and downloaded. To revise this meeting, answer the chat's questions and paste its new reply \\u2014 the preparation is still loaded.`);
    }));
  });""")
# The coverage resolutions are recorded by finding text: after the choices are applied the findings are recomputed, so
# their positions can change. The review record (D-UX11) travels with the package.
rep("""        const sel = {}; document.querySelectorAll("[data-covres]").forEach(x => { sel[x.dataset.covres] = x.value; });""",
    """        const sel = {}; const origF = (((state.compiledOrig || state.compiled) || {}).coverage || {}).findings || [];
        document.querySelectorAll("[data-covres]").forEach(x => { const f0 = origF[+x.dataset.covres]; if (f0) sel[f0.text] = x.value; });""")
rep("""resolution:sel[String(i)] || "accepted" })) };
      }""",
    """resolution:sel[f.text] || "accepted" })) };
      }
      if (state.uxReview) pkg.review = state.uxReview;""")
rep("""    const rb = el.querySelector("#copy-repair");
    if (rb) rb.addEventListener("click", async () => {""",
    """    uxDecorate(el);
    const rb = el.querySelector("#copy-repair");
    if (rb) rb.addEventListener("click", async () => {""")
# Numbering, the sample transcript and the .docx reader all refresh the next-action bar (user mode).
rep("""    $("go-import").addEventListener("click", () => showTab("import"));
    renderPrepareStatus();
  });""",
    """    $("go-import").addEventListener("click", () => showTab("import"));
    renderPrepareStatus(); uxRenderNext();
  });""")
rep("""      : "Sample transcript loaded, in the Teams copy/paste format. Load the sample baseline too, then number the segments.");
    renderPrepareStatus();
  });""",
    """      : "Sample transcript loaded, in the Teams copy/paste format. Load the sample baseline too, then number the segments.");
    renderPrepareStatus(); uxAfterSample();
  });""")
rep("""      $("transcript").value = r.text; renderPrepareStatus();""",
    """      $("transcript").value = r.text; renderPrepareStatus(); setTimeout(uxAfterDocx, 0);""")
rep("""    el.className = `banner ${cls}`;
    el.textContent = msg;
  }""",
    """    el.className = `banner ${cls}`;
    el.textContent = msg;
    uxRenderNext();
  }""")
# D-UX11g: the Reviewer details setting is part of the workspace file kept in the team folder.
rep("""download(`mkg-workspace-${new Date().toISOString().slice(0, 10)}.json`, { mkgWorkspace:"0.1", tool:WB_VERSION, contract:MANIFEST, packages:state.packages });""",
    """download(`mkg-workspace-${new Date().toISOString().slice(0, 10)}.json`, { mkgWorkspace:"0.1", tool:WB_VERSION, contract:MANIFEST, settings:{ reviewerDetails:uxRD() }, packages:state.packages });""")
rep("""        const list = obj.mkgWorkspace ? (mirror = true, obj.packages) : [obj];""",
    """        if (obj.mkgWorkspace && obj.settings && typeof obj.settings.reviewerDetails === "boolean") uxSetRD(obj.settings.reviewerDetails);
        const list = obj.mkgWorkspace ? (mirror = true, obj.packages) : [obj];""")

# User mode: a reply the workbench can't route gets a plain message (the reviewer keeps the specific one).
rep("""    const fail = html => { $("import-out").innerHTML = `<div class="banner bad">${html}</div>`; };""",
    """    const fail = (html, plain) => { $("import-out").innerHTML = plain
      ? `<div class="banner bad"><span class="rd-only">${html}</span><span class="um-only">${plain}</span></div>`
      : `<div class="banner bad">${html}</div>`; };""")
rep("""then paste this reply again. (A revised reply after answering the chat's questions also lands here if the browser was reloaded in between \\u2014 preparations live only in this session. Re-run Steps 1\\u20132 with the same transcript, then paste once more.)`);""",
    """then paste this reply again. (A revised reply after answering the chat's questions also lands here if the browser was reloaded in between \\u2014 preparations live only in this session. Re-run Steps 1\\u20132 with the same transcript, then paste once more.)`,
            `This reply is for a different meeting (${id.slice(0, 4)}-${id.slice(4, 6)}-${id.slice(6, 8)}) than the one loaded here. Paste that meeting's transcript and date, send the request to the chat again, and paste its new reply. If you reloaded the page after sending the request, do the same with this transcript.`);""")
rep("""            : "This reply was extracted against a different register snapshot than the current preparation \\u2014 the register changed in between. Rebuild: Number segments \\u2192 Copy text for the chat \\u2192 a new chat, then paste that reply.");""",
    """            : "This reply was extracted against a different register snapshot than the current preparation \\u2014 the register changed in between. Rebuild: Number segments \\u2192 Copy text for the chat \\u2192 a new chat, then paste that reply.",
            "This reply was made from an older request: the board has changed since it was sent. Copy for the chat again, paste it into a new chat, and paste that reply here.");""")

# Aaron's ruling (2026-10-12): an unowned task the meeting asked for is created unowned, and the board records who asked.
# The workbench adds the note itself (no format change): a progress note "Requested by <name>" citing the asking quote.
rep("""  const basePkgs = pkgs.filter(p => p.meeting.id !== sameId);
  const S = foldPackages(basePkgs);
  const out = { rows:[], ops:[], flags:[], global:[], errors:0 };""",
    """  const basePkgs = pkgs.filter(p => p.meeting.id !== sameId);
  const S = foldPackages(basePkgs);
  llm = withRequesters(llm, meeting, S);
  const out = { rows:[], ops:[], flags:[], global:[], errors:0 };""")
rep("""
function compile(llm, meeting, pkgs) {""", """
function withRequesters(llm, meeting, S) {
  if (!llm || !Array.isArray(llm.ops) || !meeting || !Array.isArray(meeting.segments)) return llm;
  const ASK = /\\b(?:can you|could you|would you|please|make sure|we need to|need to|needs to|have to|must)\\b/i;
  const COND = /^\\s*(?:if|when|whenever|should|in case|as needed)\\b/i;
  const segById = new Map(meeting.segments.map(x => [x.id, x]));
  const nameOf = sg => (sg.speakerId && S.parties[sg.speakerId] && S.parties[sg.speakerId].name)
    || String(sg.speakerName || "").replace(/^([^,]+),\\s*(.+)$/, "$2 $1");
  const add = [];
  for (const o of llm.ops) {
    if (!o || o.op !== "NewTasking" || o.assignee || !o.ref) continue;
    if (llm.ops.some(x => x && x.op === "ProgressNote" && x.tasking === o.ref && /^Requested by /.test(x.text || ""))) continue;
    const src = (o.src || []).find(c => c && c.quote && ASK.test(c.quote) && !COND.test(c.quote) && segById.has(c.seg));
    const sg = src && segById.get(src.seg);
    if (!sg || !sg.speakerName || sg.speakerName === "Unknown") continue;
    add.push({ op:"ProgressNote", tasking:o.ref, text:`Requested by ${nameOf(sg)}: \\u201c${src.quote}\\u201d No one in the meeting took it on yet.`, src:[{ seg:src.seg, quote:src.quote }] });
  }
  return add.length ? { ...llm, ops:[...llm.ops, ...add] } : llm;
}

function compile(llm, meeting, pkgs) {""")

# ---------- 4b. D-UX12 (ratified 2026-10-12): labels on the board ----------
# Flags name the minted code instead of the reply's NEW-ref, so the board can attach a label to the task it is about.
rep("""    const about = [].concat(fl.about || []).filter(Boolean).map(String).join(", ") || null;""",
    """    const about = [].concat(fl.about || []).filter(Boolean).map(String).map(a => refs[a] && refs[a].code ? refs[a].code : a).join(", ") || null;""")
# A Needs attention view across projects, next to the reports.
rep("""          <button class="btn" id="email-report">Program email report</button>""",
    """          <button class="btn" id="attn-btn" data-project="__attn__">Needs attention</button>
          <button class="btn" id="email-report">Program email report</button>""")
rep("""    if (!state.project || !S.projects[state.project]) state.project = projects.length ? projects[0].code : null;""",
    """    if (!state.project || (!S.projects[state.project] && state.project !== "__attn__")) state.project = projects.length ? projects[0].code : null;
    const LB = boardLabels(S, cur);
    const nAttn = LB.all.length; if ($("attn-btn")) { $("attn-btn").textContent = `Needs attention (${nAttn})`; $("attn-btn").setAttribute("aria-current", String(state.project === "__attn__")); }""")
rep("""        <div class="signals"><span class="sig">${open} open</span>${blocked ? `<span class="sig block">${blocked} blocked</span>` : ""}<span class="sig ${d[0]}">${d[1]}</span></div>""",
    """        <div class="signals"><span class="sig">${open} open</span>${blocked ? `<span class="sig block">${blocked} blocked</span>` : ""}${(LB.byProject[p.code] || []).length ? `<span class="sig lbl">${(LB.byProject[p.code] || []).length} open item${(LB.byProject[p.code] || []).length === 1 ? "" : "s"}</span>` : ""}<span class="sig ${d[0]}">${d[1]}</span></div>""")
rep("""    renderPanel(S, asOfDate);
    state.lastFold = S;""",
    """    state.boardLabels = LB;
    if (state.project === "__attn__") renderAttention(S, LB); else renderPanel(S, asOfDate);
    state.lastFold = S;""")
rep("""  function renderPanel(S, asOfDate) {
    const P = S.projects[state.project];""",
    """  // D-UX12: every flag of the accepted meetings up to "State as of", placed where it belongs: on a task when it names one,
  // in a project's Open items when it names the project, otherwise with its meeting. Labels persist until Phase 2 adds
  // the actions that settle them; re-importing a meeting replaces its labels with its package.
  var BOARD_FLAG = Object.assign({ open_question:"Open question", suggestion:"Suggestion", ownership:"No owner yet", conflict:"Conflict",
    implied_change:"Possible date change", unmatched:"Not matched to the board", ambiguous_reference:"Unclear reference", overdue:"Overdue" }, UX11.LABELS);
  function boardLabels(S, cur) {
    const byCode = {}; Object.values(S.taskings).forEach(t => { if (!t.mergedInto) byCode[t.code] = t; });
    const out = { byTask:{}, byProject:{}, meeting:[], all:[] }, upTo = toMs(cur.meeting.meetingAt);
    for (const p of state.packages) {
      if (toMs(p.meeting.meetingAt) > upTo) continue;
      for (const f of p.flags || []) {
        const about = String(f.about || "").split(",").map(x => x.trim()).filter(Boolean);
        const segs = f.segs || (f.seg ? [f.seg] : []);
        const src = segs.map(id => (p.sources || []).find(x => x.id === id)).filter(Boolean);
        const item = { kind:f.kind, name:BOARD_FLAG[f.kind] || f.kind, note:String(f.note || "").replace(/^[^:]{2,40}: /, "").replace(/\\b(?:the )?INDEX\\b/g, "the board"), src, meeting:p.meeting, tasks:[], project:null };
        item.tasks = about.filter(a => byCode[a] && byCode[a].status !== "completed").map(a => byCode[a]);
        item.project = item.tasks.length ? item.tasks[0].project : about.find(a => S.projects[a]) || null;
        if (item.tasks.length) item.tasks.forEach(t => (out.byTask[t.code] = out.byTask[t.code] || []).push(item));
        else if (item.project) (out.byProject[item.project] = out.byProject[item.project] || []).push(item);
        else out.meeting.push(item);
        out.all.push(item);
      }
    }
    return out;
  }
  function lblSrc(it) {
    return `${it.src.length ? it.src.map(x => `<blockquote class="lbl-q">\\u201c${esc(x.text)}\\u201d<div class="sub">${esc(x.speakerName || "")}${x.t ? `, ${esc(x.t)}` : ""}</div></blockquote>`).join("") : ""}<div class="sub">${esc(it.meeting.title)}, ${fmtDate(it.meeting.meetingAt)}</div>`;
  }
  function lblChip(it) { return `<details class="lbl"><summary class="lbl-chip k-${esc(it.kind)}">${esc(it.name)}</summary><div class="lbl-body"><p>${esc(it.note)}</p>${lblSrc(it)}</div></details>`; }
  function lblRow(it, withTask) {
    return `<li class="lbl-row"><span class="lbl-name">${esc(it.name)}</span>${withTask && it.tasks.length ? ` ${it.tasks.map(t => entBtn(state.lastFoldTmp, t.iri)).join(" ")}` : ""}<div>${esc(it.note)}</div><details class="lbl-src"><summary>Source</summary>${lblSrc(it)}</details></li>`;
  }
  function renderAttention(S, LB) {
    state.lastFoldTmp = S;
    const groups = {}; LB.all.forEach(it => (groups[it.name] = groups[it.name] || []).push(it));
    $("panel").innerHTML = `<div class="panel-inner"><button class="back" id="back">All projects</button>
      <h2 class="title">Needs attention</h2><p class="desc">Everything the meetings left uncertain, with the words it came from. Each item stays labeled until someone settles it.</p>
      ${LB.all.length ? Object.entries(groups).map(([n, its]) => `<section class="snap"><h3>${esc(n)} <span class="n">${its.length}</span></h3><ul class="lbl-list">${its.map(it => lblRow(it, true).replace('<li class="lbl-row">', `<li class="lbl-row"><span class="sub">${esc(it.project ? ((S.projects[it.project] || {}).name || it.project) : "Meeting")}</span> `)).join("")}</ul></section>`).join("")
        : `<p class="empty">Nothing is labeled. Every recorded change was supported by the meetings.</p>`}</div>`;
  }

  function renderPanel(S, asOfDate) {
    const P = S.projects[state.project];
    state.lastFoldTmp = S; const LB = state.boardLabels || { byTask:{}, byProject:{}, meeting:[], all:[] };
    const projItems = LB.byProject[state.project] || [];""")
rep("""      ${P.sourceText ? `<details class="seednotes"><summary>Register notes at seeding</summary><p>${esc(P.sourceText)}</p></details>` : ""}""",
    """      ${P.sourceText ? `<details class="seednotes"><summary>Register notes at seeding</summary><p>${esc(P.sourceText)}</p></details>` : ""}
      ${projItems.length ? `<section class="snap openitems" id="open-items"><h3>Open items <span class="n">${projItems.length}</span></h3><p class="sub" style="margin:0 0 6px">What the meetings raised for this project but did not settle.</p><ul class="lbl-list">${projItems.map(it => lblRow(it, false)).join("")}</ul></section>` : ""}""")
rep("""      return `<li data-f="${flags}" data-s="${esc(`${t.code} ${t.label} ${partyName(S, k === "-" ? null : k)}`.toLowerCase())}">${entBtn(S, t.iri)}${pill(t.status)}${un.length""",
    """      return `<li data-f="${flags}" data-s="${esc(`${t.code} ${t.label} ${partyName(S, k === "-" ? null : k)}`.toLowerCase())}">${entBtn(S, t.iri)}${pill(t.status)}${(LB.byTask[t.code] || []).length ? `<div class="lbls">${(LB.byTask[t.code] || []).map(lblChip).join("")}</div>` : ""}${un.length""")

# The validator's D-UX12 checks (OP-CONFLICT, SUPPORT-MISSING) need each op's status, prerequisite and merge fields.
rep("""      assignee:o.assignee, to:o.to, from:o.from, dueDate:o.dueDate, duePhrase:o.duePhrase, about:o.about, src:srcOf(o) })),""",
    """      assignee:o.assignee, to:o.to, from:o.from, dueDate:o.dueDate, duePhrase:o.duePhrase, about:o.about, src:srcOf(o),
      status:o.status, prerequisite:o.prerequisite, duplicate:o.duplicate, survivor:o.survivor })),""")

# ---------- 4c. The meeting email (Aaron's review, 2026-10-13) ----------
def rep_between(start, end, new):
    """Replace everything from start up to (not including) end; both markers must be unique."""
    global s
    assert s.count(start) == 1 and s.count(end) == 1, (start[:60], s.count(start), end[:60], s.count(end))
    a = s.index(start); b = s.index(end)
    assert a < b
    s = s[:a] + new + s[b:]

# Executive summary: a short account, not every progress note pasted end to end.
rep_between("""  const parts = [`The ${pkg.meeting.title} on ${fmtLong(asOf)}${att}.`];""", """
function previousNarrative(pkgs, pkgId) {""", """  const parts = [`The ${pkg.meeting.title} on ${fmtLong(asOf)}${att}.`];
  const byP = {}; evs.forEach(e => { if (e.project) (byP[e.project] = byP[e.project] || []).push(e); });
  const T = e => S.taskings[e.op.f.tasking];
  const item = t => `\\u201c${t.label}\\u201d (${t.code})`;
  const list = xs => xs.length <= 2 ? xs.join(" and ") : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  for (const P of Object.keys(S.projects)) {
    const es = byP[P]; if (!es) continue;
    const ss = [];
    const mintedHere = new Set(es.filter(e => e.op.type === "NewTasking").map(e => e.op.f.tasking));
    const dec = es.filter(e => e.op.type === "Decision");
    if (dec.length) ss.push(`The team decided: ${dec.map(e => e.op.f.text.replace(/\\.$/, "")).join("; ")}.`);
    const doneAll = es.filter(e => e.op.type === "Status" && e.op.f.status === "completed" && T(e));
    // An item minted and completed in the same meeting is one story (2026-10-10 field fix).
    const doneOld = doneAll.filter(e => !mintedHere.has(e.op.f.tasking)), doneNew = doneAll.filter(e => mintedHere.has(e.op.f.tasking));
    if (doneOld.length) ss.push(`${list(doneOld.map(e => `${oN(T(e).assignee)} closed out ${item(T(e))}${e.op.prior === "blocked" ? " after it had been blocked" : ""}`))}.`);
    if (doneNew.length) ss.push(`${list(doneNew.map(e => `${item(T(e))} was recorded and completed within the meeting (${oN(T(e).assignee)})`))}.`);
    const unb = es.filter(e => e.op.type === "Status" && e.op.f.status === "open" && e.op.prior === "blocked" && T(e));
    if (unb.length) ss.push(`${list(unb.map(e => item(T(e))))} can now proceed.`);
    const blk = es.filter(e => e.op.type === "Status" && e.op.f.status === "blocked" && T(e));
    if (blk.length) ss.push(`${list(blk.map(e => item(T(e))))} ${blk.length === 1 ? "is" : "are"} now blocked.`);
    // Who took on what: reassignments and new work, grouped by person.
    const took = {};
    es.filter(e => e.op.type === "Reassign" && T(e)).forEach(e => (took[e.op.f.to] = took[e.op.f.to] || []).push(T(e)));
    const nw = es.filter(e => e.op.type === "NewTasking" && T(e) && T(e).status !== "completed").map(T);
    nw.filter(t => t.assignee).forEach(t => (took[t.assignee] = took[t.assignee] || []).push(t));
    // Existing work by name; new work by code (the New actions table lists it in full).
    for (const [who, ts] of Object.entries(took)) { const u = [...new Set(ts)], old = u.filter(t => !mintedHere.has(t.iri)), fresh = u.filter(t => mintedHere.has(t.iri));
      ss.push(`${oN(who)} took on ${list([...old.map(item), ...(fresh.length ? [`${fresh.length === 1 ? "one new action" : `${fresh.length} new actions`} (${fresh.map(t => t.code).join(", ")})`] : [])])}.`); }
    const un = nw.filter(t => !t.assignee);
    if (un.length) ss.push(`${list(un.map(item))} ${un.length === 1 ? "has" : "have"} no owner yet.`);
    const named = new Set(Object.values(took).flat().map(t => t.iri));
    const noted = [...new Set(es.filter(e => e.op.type === "ProgressNote" && T(e) && !mintedHere.has(e.op.f.tasking) && !named.has(e.op.f.tasking)).map(T))];
    if (noted.length) ss.push(`The meeting added notes to ${list(noted.map(item))}.`);
    if (!ss.length) { parts.push(`${pN(P)} was reviewed with no changes.`); continue; }
    parts.push(`On ${pN(P)}: ${ss.join(" ")}`);
  }
  // Still open: the meeting's own open questions and conflicts, named briefly (testers' review, 2026-10-13).
  const firstClause = n => { const w = String(n || "").split(/(?<=[.;])\\s/)[0].replace(/[.;]$/, "").split(/\\s+/); return w.length > 16 ? w.slice(0, 16).join(" ") + "…" : w.join(" "); };
  const openQs = (pkg.flags || []).filter(f => ["open_question", "conflict"].includes(f.kind) && f.about);
  if (openQs.length) parts.push(`Still open: ${openQs.map(f => firstClause(f.note).replace(/^./, c => c.toLowerCase())).join("; ")}.`);
  const onRows = (pkg.flags || []).filter(f => ["check_scope", "possible_schedule_update", "possible_update", "date_unclear", "possible_owner_change", "possible_status_change", "may_be_separate"].includes(f.kind)).length;
  if (onRows) parts.push(`${onRows} item${onRows === 1 ? " carries" : "s carry"} a point to confirm, shown with the action below.`);
  // Next up: due within two weeks, saying plainly when something is due today, overdue or blocked.
  const soon = Object.values(S.taskings).filter(t => t.status !== "completed" && !t.mergedInto && t.due && byP[t.project])
    .filter(t => daysBetween(asOf, t.due) <= 14)
    .sort((a, b) => String(a.due).localeCompare(String(b.due))).slice(0, 4);
  const when = t => { const n = daysBetween(asOf, t.due); return n < 0 ? `overdue since ${fmtDate(t.due)}` : n === 0 ? "due today" : `due ${fmtDate(t.due)}`; };
  const blockedOn = t => { if (t.status !== "blocked") return ""; const w = unmetPrereqs(S, t).map(x => S.taskings[x]).filter(Boolean);
    return w.length ? `, blocked on ${w.map(x => `${x.code} (${oN(x.assignee)})`).join(", ")}` : ", blocked"; };
  if (soon.length) parts.push(`Next up: ${soon.map(t => `${item(t)}, ${oN(t.assignee)}, ${when(t)}${blockedOn(t)}`).join("; ")}.`);
  return parts.join(" ");
}
""")

# Rows: no filler on a new item; an existing item with nothing recorded says so plainly.
rep("""    if (!parts.length) parts.push("Updated this meeting — open the item on the Board for the recorded change.");""",
    """    if (!parts.length && !isNew) parts.push("Referenced this meeting; no change recorded.");""")
# Open questions: names instead of codes, no internal references, meeting-level items last.
rep("""  const flags = (pkg.flags || []);
  const FLAG = { suggestion:"Suggestion", implied_change:"Implied change", conflict:"Conflict", unmatched:"Unmatched reference", ambiguous_reference:"Ambiguous reference", overdue:"Overdue item", ownership:"Ownership open", open_question:"Open question" };""",
    """  const FLAG = Object.assign({ suggestion:"Suggestion", implied_change:"Possible date change", conflict:"Conflict", unmatched:"Unmatched reference", ambiguous_reference:"Unclear reference", overdue:"Overdue item", ownership:"No owner yet", open_question:"Open question" }, UX11.LABELS);
  const aboutOf = f => { const xs = String(f.about || "").split(",").map(x => x.trim()).filter(Boolean);
    const ts = xs.map(x => S.codeIndex[x] && S.taskings[S.codeIndex[x]]).filter(Boolean);
    if (ts.length) return ts.map(t => `${t.code} ${t.label}`).join("; ");
    const ps = xs.filter(x => S.projects[x] && !(projects.length === 1 && projects[0] === x)).map(pName);
    return ps.join(", "); };
  const plainNote = n => String(n || "").replace(/^[A-Z][a-z ]{2,30}: (?=\\S)/, m => Object.values(UX11.LABELS).includes(m.slice(0, -2)) ? "" : m)
    .replace(/^Recorded by the reviewer as an open item: /, "").replace(/\\b(?:the )?INDEX\\b/g, "the register").replace(/\\bNEW-\\d+\\b/g, "a new item").replace(/\\bS\\d{3}\\b/g, "a statement");
  const stripLabel = n => String(n || "").replace(/^([A-Z][a-z ]{2,30}): (?=\\S)/, (m, k) => Object.values(UX11.LABELS).includes(k) ? "" : m);
  // A "No owner yet" label repeats the reply's own ownership question about the same item (older packages): one line.
  const ownAbout = new Set((pkg.flags || []).filter(f => f.kind === "ownership").map(f => String(f.about || "")));
  const rowCodes = new Set([...newRows, ...updRows].map(x => x.code));
  const onARow = f => ROWLBL[f.kind] && String(f.about || "").split(",").map(x => x.trim()).some(c => rowCodes.has(c));
  const adminFlags = (pkg.flags || []).filter(f => f.kind === "meeting_admin");
  const flags = [...(pkg.flags || [])].filter(f => !(f.kind === "no_owner" && ownAbout.has(String(f.about || "")))
    && !onARow(f) && f.kind !== "meeting_admin" && f.kind !== "no_owner" && !(!trace && f.kind === "possibly_missed")).sort((a, b) => (a.about ? 0 : 1) - (b.about ? 0 : 1) || (a.kind === "meeting_admin") - (b.kind === "meeting_admin"));
  const flagLine = f => { const a = aboutOf(f); return { kind:FLAG[f.kind] || f.kind, about:a || (f.about ? "" : "meeting"), note:stripLabel(trace ? f.note : plainNote(f.note)) }; };""")
rep("""    text:[...flags.map(f => `- ${FLAG[f.kind] || f.kind}${f.about ? ` (${f.about})` : ""}: ${f.note}`), ...(trace ? ["", "Reviewer flags: what the meeting raised but did not settle. Unlike the items above, these are not register changes."] : [])],
    html:flags.map(f => P(`<b>${esc(FLAG[f.kind] || f.kind)}${f.about ? ` (${esc(f.about)})` : ""}:</b> ${esc(f.note)}`)).join("") + (trace ? P(`<i>Reviewer flags: what the meeting raised but did not settle. Unlike the items above, these are not register changes.</i>`) : "") });""",
    """    text:[...flags.map(flagLine).map(f => `- ${f.kind}${f.about ? ` (${f.about})` : ""}: ${f.note}`), ...(trace ? ["", "Reviewer flags: what the meeting raised but did not settle. Unlike the items above, these are not register changes."] : [])],
    html:flags.map(flagLine).map(f => P(`<b>${esc(f.kind)}${f.about ? ` (${esc(f.about)})` : ""}:</b> ${esc(f.note)}`)).join("") + (trace ? P(`<i>Reviewer flags: what the meeting raised but did not settle. Unlike the items above, these are not register changes.</i>`) : "") });""")
# Conclusion: a count and where to look, not a repeat of the new-actions table.
rep("""  if (newOpen.length) conc.push(`Next steps include ${newOpen.map(t => { const dd = concDue(t);
    return `${t.code} ${t.label}${t.assignee ? ` (${oName(t.assignee)}${dd ? `, ${dd}` : ""})` : dd ? ` (${dd})` : ""}`; }).join("; ")}.`);""",
    """  if (newOpen.length) { const unown = newOpen.filter(t => !t.assignee);
    conc.push(`${newOpen.length} new action${newOpen.length === 1 ? "" : "s"} came out of this meeting${unown.length ? `; ${unown.map(t => t.code).join(", ")} still ${unown.length === 1 ? "needs" : "need"} an owner` : ""}.`); }""")
rep("""  conc.push("The project register has been updated to reflect the claims recorded above.");""",
    """  conc.push("The board has been updated with the accepted actions and task updates. Open questions and labeled scope items remain visible for follow-up.");""")
# Board: an item that names no project, from a meeting that covered one project, belongs to that project (meeting
# administration stays with the meeting).
rep("""        item.project = item.tasks.length ? item.tasks[0].project : about.find(a => S.projects[a]) || null;""",
    """        const pkgProjects = [...new Set((p.deltas || []).map(d => d.project).filter(Boolean))];
        item.project = item.tasks.length ? item.tasks[0].project : about.find(a => S.projects[a])
          || (!about.length && f.kind !== "meeting_admin" && pkgProjects.length === 1 ? pkgProjects[0] : null);""")

# ---------- 4d. Testers' review of the email (2026-10-13; Aaron's rulings) ----------
rep("""  const minted = new Set(order.filter(iri => byT[iri].some(o => o.type === "NewTasking")));
  const rowOf = iri => {""", """  const minted = new Set(order.filter(iri => byT[iri].some(o => o.type === "NewTasking")));
  // Labels print with the action they concern, so an incomplete item never reads as complete.
  const ROWLBL = { check_scope:"Scope to confirm", possible_schedule_update:"Possible schedule change", possible_update:"Possible update", date_unclear:"Date to confirm",
    possible_owner_change:"Possible owner change", possible_status_change:"Possible status change", may_be_separate:"May be separate work" };
  const rowLblNote = n => String(n || "").replace(/^[A-Z][a-z ]{2,30}: (?=\\S)/, "").replace(/^it leaves out/, "the action leaves out");
  const rowLbl = code => (pkg.flags || []).filter(f => ROWLBL[f.kind] && String(f.about || "").split(",").map(x => x.trim()).includes(code))
    .map(f => ` ${ROWLBL[f.kind]}: ${(trace ? rowLblNote(f.note) : rowLblNote(f.note).replace(/\\s*From the meeting:.*$/, "")).replace(/([^.?!”"])$/, "$1.")}`).join("");
  const rowOf = iri => {""")
rep("""      return { code:t.code, label:t.label, project:t.project, text:(head.concat(opParts(iri, t, true)).join(" ") + waiting(t) + evidence(iri)).trim() };
    }
    return { code:t.code, label:t.label, project:t.project, text:(opParts(iri, t, false).join(" ") + waiting(t) + evidence(iri)).trim() };""",
    """      return { code:t.code, label:t.label, project:t.project, text:(head.concat(opParts(iri, t, true)).join(" ") + waiting(t) + rowLbl(t.code) + evidence(iri)).trim() };
    }
    return { code:t.code, label:t.label, project:t.project, text:(opParts(iri, t, false).join(" ") + waiting(t) + rowLbl(t.code) + evidence(iri)).trim() };""")
# Meeting administration: its own short section, before the open questions.
rep("""  if (flags.length) secs.push({ title:"Risks, dependencies and open questions",""",
    """  const adminText = f => { const n = String(f.note || "").replace(/^Meeting administration: /, ""); return trace ? n : n.replace(/\\s*From the meeting:.*$/, "").replace(/\\.?$/, "."); };
  if (adminFlags.length) secs.push({ title:"Meeting administration", text:adminFlags.map(f => `- ${adminText(f)}`), html:adminFlags.map(f => P(esc(adminText(f)))).join("") });
  if (flags.length) secs.push({ title:"Risks, dependencies and open questions",""")
# The email opens on the recipient copy (Aaron, 2026-10-13, superseding the D-UX8 default); the reviewer copy is one tick away.
rep("""    let sum = buildMeetingSummary(S, state.packages, pkgId, { trace:true });""",
    """    let sum = buildMeetingSummary(S, state.packages, pkgId, { trace:false });""")
rep("""<input type="checkbox" id="msum-trace" checked> Include traceability detail""",
    """<input type="checkbox" id="msum-trace"> Include traceability detail""")

# ---------- 5. The user-mode screens (ux11-ui.js), inside the UI scope ----------
rep("""  /* ---------------- Out-of-meeting update (D-UX6""",
    open(UI, encoding='utf-8').read() + """
  /* ---------------- Out-of-meeting update (D-UX6""")

open(OUT, 'w', encoding='utf-8').write(s)
print('ported D-UX11:', OUT, len(s), 'chars')
