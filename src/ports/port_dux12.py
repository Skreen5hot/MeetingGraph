"""D-UX12 Phase 2 (plan §16, amendments §16.9; ratified 2026-10-13): settling labels on the board.
Applies on top of the build port_dux11.py produces.
Usage: python3 port_dux12.py <D-UX11 MeetingGraph.html> <out.html> <harness dir with resolve.js> <res-ui.js>
Every edit asserts its exact match count. The resolution model (resolve.js) is embedded verbatim."""
import sys

SRC, OUT, MG, UI = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
s = open(SRC, encoding='utf-8').read()


def rep(old, new, count=1):
    global s
    n = s.count(old)
    assert n == count, f'expected {count} match(es), found {n}: {old[:90]!r}'
    s = s.replace(old, new)


def rep_between(start, end, new):
    global s
    assert s.count(start) == 1 and s.count(end) == 1, (start[:60], s.count(start), end[:60], s.count(end))
    a = s.index(start); b = s.index(end)
    assert a < b
    s = s[:a] + new + s[b:]


def module_body(path):
    t = open(path, encoding='utf-8').read()
    a = t.index("(function (root) {\n'use strict';\n") + len("(function (root) {\n'use strict';\n")
    b = t.index("\nconst api = ")
    return t[a:b]


# ---------- 1. The resolution model, embedded verbatim ----------
rep("""
function withRequesters(llm, meeting, S) {""", """
/* D-UX12 Phase 2: RES is the harness's resolution model (resolve.js), embedded verbatim. */
const RES = (() => {
'use strict';
""" + module_body(MG + "/resolve.js") + """
return { primaryFor, moreFor, attendeeKey, STEPS, stepsOf, outcomeOf, actionLabel, namesIn, FAMILY, ACTION, actionsFor, consequence, keyOf, parseKey, stateOf, attach, checkPerson, refName, buildSave, stale, applyPeople, decisionText, basisText, jaccard };
})();

function withRequesters(llm, meeting, S) {""")

# ---------- 2. The fold: aliases, reviewer-added people and verification come from live resolutions ----------
rep("""  for (const op of all) applyOp(S, op);
  return S;
}""", """  for (const op of all) applyOp(S, op);
  RES.applyPeople(S, pkgs.filter(p => toMs(p.meeting.meetingAt) <= uptoMs));
  return S;
}""")

# ---------- 3. Re-imports: a meeting re-imported after a later board-resolutions package is validated against the
# board as of that meeting (the resolutions apply after it, as before) ----------
rep("""  const basePkgs = pkgs.filter(p => p.meeting.id !== sameId);
  const S = foldPackages(basePkgs);
  llm = withRequesters(llm, meeting, S);""",
    """  const basePkgs = pkgs.filter(p => p.meeting.id !== sameId && !(p.meeting.resolutions && toMs(p.meeting.meetingAt) > toMs(meeting.meetingAt)));
  const S = foldPackages(basePkgs);
  llm = withRequesters(llm, meeting, S);""")

# A fold that leaves out the meeting being re-imported still holds the later board-resolutions package, whose changes
# name that meeting's tasks. Such a change has nothing to apply to in that fold and is skipped (it applies in the full fold).
for case in ['case "Status": { const t = tk(f.tasking);', 'case "Deadline": case "DueDate": { const t = tk(f.tasking);',
             'case "Reassign": { const t = tk(f.tasking);', 'case "ProgressNote": { const t = tk(f.tasking);', 'case "DeliverableSpec": { const t = tk(f.tasking);']:
    rep(case, case + ' if (!t) return;')

# After Accept the board shows the latest state: a re-imported meeting is followed by later board resolutions, which
# still apply (§16.5), so showing the board as of that meeting would look as if they were undone.
rep("""      state.asOf = pkg.meeting.id; state.compiled = null;""", """      state.asOf = null; state.compiled = null;""")

# Board-resolutions files are never versions of one another: two saved in the same second on different machines share a
# package id. The second is refused with a message instead of replacing the first (A2: nothing silently overwritten).
rep("""  const key = p => JSON.stringify({ m:p.meeting, s:p.sources, d:p.deltas, e:p.extension, f:p.flags, n:p.narrative || null, a:p.attendance || null });""",
    """  const key = p => JSON.stringify({ m:p.meeting, s:p.sources, d:p.deltas, e:p.extension, f:p.flags, n:p.narrative || null, a:p.attendance || null, r:p.resolutions || null });""")
rep("""        if (samePkgContent(existing, p)) { unchanged++; continue; }
        // A newer file""", """        if (samePkgContent(existing, p)) { unchanged++; continue; }
        if (existing.meeting.resolutions || p.meeting.resolutions) { bad.push(`${sourceName}: board decisions saved at the same moment as another file already loaded (${p.meeting.id}). Nothing was replaced. Ask whoever saved it to save those decisions again.`); continue; }
        // A newer file""")

# A board decision that creates a task is not a meeting request: no "Requested by" note (that is a meeting concept).
rep("""  if (!llm || !Array.isArray(llm.ops) || !meeting || !Array.isArray(meeting.segments)) return llm;""",
    """  if (!llm || !Array.isArray(llm.ops) || !meeting || !Array.isArray(meeting.segments) || meeting.kind !== "transcript") return llm;""")

# ---------- 4. Board: labels with their actions, the Resolved filter, reviewer decisions on tasks ----------
rep_between("""  function boardLabels(S, cur) {""", """  function renderPanel(S, asOfDate) {""", open(UI, encoding='utf-8').read() + "\n")
rep("""${(LB.byTask[t.code] || []).length ? `<div class="lbls">${(LB.byTask[t.code] || []).map(lblChip).join("")}</div>` : ""}""",
    """${(LB.byTask[t.code] || []).length || (LB.decisionsByTask[t.code] || []).length ? `<div class="lbls">${(LB.byTask[t.code] || []).map(lblChip).join("")}${(LB.decisionsByTask[t.code] || []).map(decisionChip).join("")}</div>` : ""}""")
rep("""    state.lastFoldTmp = S; const LB = state.boardLabels || { byTask:{}, byProject:{}, meeting:[], all:[] };""",
    """    state.lastFoldTmp = S; const LB = state.boardLabels || { byTask:{}, byProject:{}, meeting:[], all:[], resolved:[], byKey:{}, decisionsByTask:{} };""")
# The tray follows every board render (it is outside the board, so it survives re-renders).
rep("""    state.boardLabels = LB;
    if (state.project === "__attn__") renderAttention(S, LB); else renderPanel(S, asOfDate);
    state.lastFold = S;""",
    """    state.boardLabels = LB;
    state.lastFold = S;
    if (state.project === "__attn__") renderAttention(S, LB); else renderPanel(S, asOfDate);
    state.lastFold = S; resRender();""")
# Task history: the reviewer decisions (A1 parts; dismissed and superseded ones too, A6).
rep("""      <ul class="hist">${evs.map(e => { const d = describe(S, e);""",
    """      ${resHistHtml(t.code)}
      <ul class="hist">${evs.map(e => { const d = describe(S, e);""")
# A reviewer-added person is marked until verified (A4).
rep("""  const partyName = (S, id) => (S.parties[id] || {}).name || id || "Unassigned";""",
    """  const partyName = (S, id) => { const p = S.parties[id]; return p ? `${p.name}${p.reviewerAdded && p.reviewerAdded.unverified ? " (reviewer-added, not yet verified)" : ""}` : id || "Unassigned"; };""")

# Opening Needs attention shows the open items first.
rep("""    if (pb) { state.project = pb.dataset.project; $("board").classList.add("show-panel"); renderBoard(); $("panel").scrollTop = 0; return; }""",
    """    if (pb) { state.project = pb.dataset.project; if (state.project === "__attn__") state.attnView = "open"; $("board").classList.add("show-panel"); renderBoard(); $("panel").scrollTop = 0; return; }""")

# §16.13: a person's name opens their page; the attendance list uses the same identity rule (email first).
rep("""<div class="owner">${esc(partyName(S, k === "-" ? null : k))}</div>""",
    """<div class="owner">${k === "-" ? esc(partyName(S, null)) : `<button class="person-link" data-person="${esc(k)}">${esc(partyName(S, k))}</button>`}</div>""")
rep("""      const id = findParty(S, a.name);
      return `<tr><td>${esc(a.name)}${id ? "" : ` <span class="sub">(not in register)</span>`}</td>""",
    """      const id = attendeeParty(S, a);
      return `<tr><td>${id ? `<button class="person-link" data-person="${esc(id)}">${esc(a.name)}</button>` : `${esc(a.name)} <span class="sub">(not on the board)</span>`}</td>""")
rep("""    const unknown = att.participants.filter(p => !findParty(S, p.name)).map(p => p.name);""",
    """    const unknown = att.participants.filter(p => !attendeeParty(S, p)).map(p => p.name);""")

# ---------- 5. Styles ----------
rep("""/* D-UX11 user mode */""", """/* D-UX12 Phase 2: resolutions */
.res-box{margin-top:6px}
.res-acts{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.res-btn{font-size:13px;padding:4px 12px;line-height:1.4}
.res-f{margin-top:6px;padding:8px 10px;border:1px solid var(--line);border-radius:6px;background:var(--surface);display:flex;flex-direction:column;gap:6px;font-size:13px}
.res-f label{display:flex;flex-direction:column;gap:2px}
.res-f label.chk{flex-direction:row;gap:6px;align-items:flex-start}
:root{color-scheme:light dark}
.res-f input,.res-f select,.res-f textarea{font:inherit;max-width:100%}
.res-f input:not([type=checkbox]):not([type=radio]),.res-f select,.res-f textarea,#res-tray input{background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:4px;padding:3px 6px}
.res-f select option{background:var(--surface);color:var(--ink)}
.res-off{color:var(--muted)}
.res-why{font-style:italic}
.res-f label>select,.res-f label>input:not([type=checkbox]):not([type=radio]){align-self:flex-start;min-width:240px}
.res-what{font-weight:600}
.res-err{color:var(--block);min-height:0}
.res-err:empty{display:none}
.res-state{margin:4px 0;padding:4px 8px;border-radius:6px;background:var(--due-soft);font-size:13px}
.res-conflict{background:var(--block-soft)}
.res-line{margin:2px 0}
.res-pending{margin-top:4px;padding:4px 8px;border-radius:6px;background:var(--decide-soft);font-size:13px}
.res-parts{margin:6px 0;padding:6px 10px;border-left:3px solid var(--decide);font-size:13px;display:flex;flex-direction:column;gap:2px}
.res-k{display:inline-block;min-width:120px;font-weight:600;color:var(--muted)}
.res-chip{border-color:var(--decide);color:var(--decide)}
.res-name{margin:4px 0;font-size:13px}
.res-acts .btn.primary{font-weight:600;font-size:13.5px;padding:4px 14px;line-height:1.4}
.res-more{display:inline-block;position:relative}
.res-more>summary{list-style:none;display:inline-block;cursor:pointer}
.res-more>summary::-webkit-details-marker{display:none}
.res-more[open]>summary{background:var(--accent-soft)}
.res-more-list{position:absolute;left:0;top:calc(100% + 4px);z-index:5;display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:220px;padding:6px;background:var(--surface);border:1px solid var(--line);border-radius:8px;box-shadow:0 4px 14px rgba(0,0,0,.12)}
.res-more-list .res-btn{text-align:left}
.lbl-ev{margin-top:6px}
.lbl-ev>summary{cursor:pointer;font-size:12.5px;color:var(--accent)}
.res-row{display:flex;flex-wrap:wrap;gap:6px 14px}
.res-choices{display:flex;flex-direction:column;gap:4px}
.res-also{display:flex;flex-direction:column;gap:4px;padding:6px 8px;border-radius:6px;background:var(--due-soft)}
.res-now{font-size:13px}
.res-keeps{font-style:italic}
.res-answer{background:var(--accent-soft)}
.person-link{background:none;border:0;padding:0;font:inherit;color:inherit;cursor:pointer;text-decoration:underline dotted;text-underline-offset:3px}
.person-link:hover{color:var(--accent)}
.res-steps{margin:0;padding-left:18px;display:flex;flex-direction:column;gap:8px}
.res-step{display:flex;flex-direction:column;gap:4px;padding:6px 8px;border:1px dashed var(--line);border-radius:6px}
.res-step-h .sub{font-weight:400}
.res-out{border:0;padding:0;margin:0;display:flex;flex-wrap:wrap;gap:4px 14px}
.res-out legend{font-weight:600;padding:0}
.lbl-srcs{margin:4px 0}
.lbl-chip.st-deferred{border-style:dashed}
.lbl-chip.st-conflict{border-color:var(--block);color:var(--block)}
.res-tabs{display:flex;gap:6px;margin:8px 0 12px}
.res-tabs .on{background:var(--accent);color:#fff}
.res-hist{margin:0 0 10px}
.res-hrec.superseded{opacity:.75}
.res-tray{flex:none;order:99;background:var(--surface);border-top:3px solid var(--decide);padding:8px 16px;box-shadow:0 -2px 8px rgba(0,0,0,.08);max-height:40vh;overflow:auto}
.res-tray[hidden]{display:none}
.res-tray-top{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center}
.res-tray-list{margin:6px 0 0;padding-left:18px;font-size:13px}
.res-stale{margin-top:6px;padding:6px 10px;border-radius:6px;background:var(--block-soft);font-size:13px}
.res-stale textarea{width:100%}
/* D-UX11 user mode */""")

open(OUT, 'w', encoding='utf-8').write(s)
print('ported D-UX12 Phase 2:', OUT, len(s), 'chars')
