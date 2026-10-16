"""§16.16 Open items answered in meetings (ratified for build 2026-10-14). Applies on top of port_dux12.py's build.
Usage: python3 port_dux13.py <D-UX12 MeetingGraph.html> <out.html> <harness dir with openitems.js> <oi-ui.js>
Every edit asserts its exact match count. The open-items module (openitems.js) is embedded verbatim."""
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


# ---------- 1. The open-items model, embedded verbatim ----------
rep("""
function withRequesters(llm, meeting, S) {""", """
/* §16.16: OI is the harness's open-items model (openitems.js), embedded verbatim. */
const OI = (() => {
'use strict';
""" + module_body(MG + "/openitems.js") + """
return { questionFor, listFor, RULE, blockText, promptWithAnswers, request, check, dupFlags, fullName, QKIND };
})();

function withRequesters(llm, meeting, S) {""")

# ---------- 2. The request lists the board's open items (as of just before this meeting) ----------
rep("""    const full = `CONTEXT TOKEN (echo verbatim as "context" at the top of the JSON): ${token}\\nThis message must contain exactly one copy of this prompt, one INDEX, and one MEETING transcript. If any of them appears twice, that is a paste error: use only the first copy of each.\\n\\n${reExtraction ? reNote + "\\n\\n" : ""}${PROMPT}\\n\\n=== INDEX ===\\n${index}\\n\\n=== MEETING ===\\n${meetingText}`;""",
    """    state.prepared.openItems = oiOpenList(S, meetingAt, sameId);
    const full = OI.request(`CONTEXT TOKEN (echo verbatim as "context" at the top of the JSON): ${token}\\nThis message must contain exactly one copy of this prompt, one INDEX, and one MEETING transcript. If any of them appears twice, that is a paste error: use only the first copy of each.\\n\\n${reExtraction ? reNote + "\\n\\n" : ""}`, PROMPT, index, meetingText, state.prepared.openItems);""")

# ---------- 3. The validator: a passing "Who is ...?" answer is identity evidence for the new person it names ----------
rep("""    register:{ projects, tasks }, requireSelfReview:true };""",
    """    register:{ projects, tasks }, requireSelfReview:true,
    identityRefs:(meeting.openItems || []).length && Array.isArray(llm.answers) ? [...OI.check(llm, { list:meeting.openItems, segments:meeting.segments, people:Object.keys(S.parties) }).identity] : [] };""")

# ---------- 4. The import review: answers checked, shown as proposed closures; the package records them ----------
rep("""    uxOnValidated(comp, llm);""", """    oiOnValidated(llm);
    uxOnValidated(comp, llm);""")
rep("""      if (state.uxReview) pkg.review = state.uxReview;""", """      if (state.uxReview) pkg.review = state.uxReview;
      if (state.prepared.kind === "transcript") { const oa = oiPackageAnswers(); if (oa.error) { toast(oa.error); uxRefresh(); const ni = [...document.querySelectorAll(".oi-name")].find(x => x.offsetParent); if (ni) ni.focus(); return; } if (oa.answers) pkg.answers = oa.answers; }""")
rep("""  const key = p => JSON.stringify({ m:p.meeting, s:p.sources, d:p.deltas, e:p.extension, f:p.flags, n:p.narrative || null, a:p.attendance || null, r:p.resolutions || null });""",
    """  const key = p => JSON.stringify({ m:p.meeting, s:p.sources, d:p.deltas, e:p.extension, f:p.flags, n:p.narrative || null, a:p.attendance || null, r:p.resolutions || null, q:p.answers || null });""")
rep("""      ${uxLabelsHtml(st)}
      ${uxOverridesHtml(m, ch, "u")}""", """      ${oiReviewHtml("u")}
      ${uxLabelsHtml(st)}
      ${uxOverridesHtml(m, ch, "u")}""")
rep("""      ${uxOverridesHtml(m, ch, "r")}""", """      ${oiReviewHtml("r")}
      ${uxOverridesHtml(m, ch, "r")}""")
# The review UI code sits with the board code (same scope as resItems and uxRefresh).
rep("""  function renderPanel(S, asOfDate) {""", open(UI, encoding='utf-8').read() + """
  function renderPanel(S, asOfDate) {""")

# ---------- 5. The project's Open items section can be copied as an agenda ----------
rep("""<section class="snap openitems" id="open-items"><h3>Open items <span class="n">${projItems.length}</span></h3>""",
    """<section class="snap openitems" id="open-items"><h3>Open items <span class="n">${projItems.length}</span> <button class="btn" data-oi-agenda="${esc(P.code)}">Copy as agenda</button>${oiBulkHtml()}</h3><div class="oi-bulk-form"></div>""")

# ---------- 6. Styles ----------
rep(""".res-box{margin-top:6px}""", """.res-box{margin-top:6px}
.oi-q{margin:4px 0;padding:6px 8px;border-left:3px solid var(--accent, #2b6cb0);background:var(--due-soft);border-radius:4px;font-size:13px}
.oi-q .res-k{font-weight:600;margin-right:4px}
.oi-review .oi-ans{margin:8px 0;padding-bottom:6px;border-bottom:1px solid var(--line, #ddd)}
.oi-review .oi-qtext .res-k{font-weight:600;margin-right:4px}
.oi-namel{display:block;margin:8px 0}
.oi-assoc{margin-top:4px}
.oi-acts{display:flex;gap:10px;align-items:center;margin-top:4px}
.oi-sel{font-size:13px}
.oi-assoc .ent{font-size:13px}""")

open(OUT, 'w', encoding='utf-8').write(s)
print('ok', OUT, len(s))
