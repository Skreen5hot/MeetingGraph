/* MeetingGraph validator. v0.2, 2026-10-11.
 * v0.1: D-UX9 flag vocabulary (coverage, binding, decomposition, matching, scope, timing).
 * v0.2: reads the real MKG reply format; adds checks for the Difficult-transcript tester findings.
 * Runs in Edge (or Node for self-test). No dependencies.
 */
(function (root) {
'use strict';

const arr = x => x == null ? [] : Array.isArray(x) ? x : [x];

/* ---------- Schema adapter ----------
 * Two input formats are accepted and mapped to one internal model:
 *  (1) MKG reply (production): ops[{op, ref, project, tasking, label|text, assignee, to, dueDate, duePhrase, src:[{seg,quote}]}],
 *      segments[{seg, dispositions:[{kind, about, note}]}], register[{id, coverage, segs, note}], flags[{kind, about, src, note}],
 *      coveredProjects, selfReview (proposed, D-UX10a)
 *  (2) legacy test schema from v0.1 (dispositions[], ops[{id, kind, ...}], registerCoverage[])
 * Internal model: dispositions[{seg, cls, unit, links, note}], ops[{id, kind, project, target, title, owner, to, timing, cites, src}],
 *  registerCoverage[{id, coverage, note, segs}], flags[{code, about, cites, note}], coveredProjects, selfReview, format
 */
const KIND = { NewTasking: 'CreateTask', Status: 'StatusChange' };
const CLS = {
  discussion_of_register_item: 'discussion', context_only: 'context', uncertain_requires_review: 'uncertain',
  administrative: 'administrative', commitment: 'commitment', status_update: 'status_update',
  decision: 'decision', open_question: 'open_question'
};
const ITEM_ID = /^(NEW|AI|BL|T)-/;

function isMKG(p) {
  return (Array.isArray(p.ops) && p.ops.some(o => o && o.op)) ||
    (Array.isArray(p.segments) && p.segments.some(s => s && s.dispositions)) || Array.isArray(p.register);
}
function adapt(raw) {
  const p = raw || {};
  if (isMKG(p)) {
    const ops = (p.ops || []).map((o, i) => {
      const src = arr(o.src).map(s => typeof s === 'string' ? { seg: s, quote: '' } : { seg: s.seg, quote: s.quote || '' });
      return {
        id: o.ref || `${o.op}:${o.tasking || arr(o.about)[0] || o.project || ''}#${i + 1}`,
        kind: KIND[o.op] || o.op,
        project: o.project || null,
        target: o.tasking || (o.op === 'Discussed' ? arr(o.about)[0] : null) || null,
        title: o.label || o.text || o.name || '',
        owner: o.op === 'NewTasking' ? (o.assignee == null ? null : o.assignee) : null,
        to: o.to == null ? null : o.to,
        timing: o.dueDate ? { phrase: o.duePhrase || '', resolved: o.dueDate } : null,
        status: o.op === 'Status' ? (o.status || null) : null,
        prerequisite: o.prerequisite || null, duplicate: o.duplicate || null, survivor: o.survivor || null,
        cites: src.map(s => s.seg).filter(Boolean),
        src,
        matchRationale: ''
      };
    });
    const dispositions = [];
    for (const s of p.segments || []) for (const d of arr(s.dispositions)) {
      const about = arr(d.about).filter(Boolean);
      dispositions.push({ seg: s.seg, cls: CLS[d.kind] || d.kind, unit: about.find(a => ITEM_ID.test(a)) || null, unitExplicit: false, links: about, note: d.note || '' });
    }
    return {
      format: 'mkg', contextToken: p.context || p.contextToken, dispositions, ops,
      registerCoverage: (p.register || []).map(r => ({ id: r.id, coverage: r.coverage, note: r.note || '', segs: arr(r.segs) })),
      coveredProjects: p.coveredProjects || [],
      flags: (p.flags || []).map(f => ({ code: f.kind, about: arr(f.about), cites: arr(f.src).concat(f.seg ? [f.seg] : []).map(s => typeof s === 'string' ? s : s.seg), note: f.note || '' })),
      selfReview: p.selfReview || null
    };
  }
  return {
    format: 'legacy', contextToken: p.contextToken,
    dispositions: (p.dispositions || []).map(d => ({ seg: d.seg, cls: d.cls, unit: d.unit || null, unitExplicit: !!d.unit, links: d.links || [], note: d.note || '' })),
    ops: (p.ops || []).map(o => ({
      id: o.id, kind: o.kind, project: o.project || null, target: o.target || null, title: o.title || '',
      owner: o.owner == null ? null : o.owner, to: o.to == null ? null : o.to, timing: o.timing || null,
      cites: o.cites || [], src: (o.cites || []).map(c => ({ seg: c, quote: '' })), matchRationale: o.matchRationale || ''
    })),
    registerCoverage: (p.registerCoverage || []).map(c => ({ id: c.id, coverage: c.coverage, note: c.note || '', segs: c.segs || [] })),
    coveredProjects: p.coveredProjects || [],
    flags: (p.flags || []).map(f => ({ code: f.code, about: arr(f.about), cites: f.cites || [], note: f.note || '' })),
    selfReview: p.selfReview || null
  };
}

/* ---------- Text matching: aliases, stop words, light stemming ---------- */
// The alias table and the lexicons below belong to the validator and grow with each review.
const ALIASES = [
  [/[’‘]/g, "'"],
  [/\bpoints?[\s-]+of[\s-]+contacts?\b/g, ' poc '],
  [/\bentry[\s-]+(?:routes?|gates?)\b/g, ' gate '],
  [/\bflows?[\s-]+of[\s-]+show\b/g, ' flowofshow '],
  [/\bflight[\s-]+plans?\b/g, ' flightplan '],
  [/\bfields?[\s-]+of[\s-]+view\b/g, ' fov ']
];
const DOMAIN = new Set(['poc', 'gate', 'flowofshow', 'flightplan', 'fov', 'vip']);
const STOP = new Set((
  'a an the and or of to for in on at by with from as is are be been being was were it its this that these those ' +
  'we you i he she they our your us them his her their will can could would should may might must do does did done ' +
  'have has had not no yes get got make made need needs want please just still now then there here what who whom when ' +
  'where how why all any some more most other also about over into after before up out if so than too very one two ' +
  'thing things go going keep let lets well okay ok thanks thank great good morning sure yep perfect provide send sent ' +
  'add take give start know think see look say said tell put set way week day once already maybe new them those our ' +
  'll ve re don isn worth use using right but'
).split(/\s+/));
const SUFFIX = ['ations', 'ation', 'ions', 'ion', 'ings', 'ing', 'ates', 'ate', 'als', 'al', 'ed', 'es', 's', 'e'];

function stem(w) {
  if (DOMAIN.has(w) || /\d/.test(w)) return w;
  for (const s of SUFFIX) if (w.endsWith(s) && w.length - s.length >= 4) return w.slice(0, -s.length);
  return w;
}
function tokens(text) {
  let t = ' ' + String(text || '').toLowerCase() + ' ';
  for (const [re, rep] of ALIASES) t = t.replace(re, rep);
  return new Set(t.split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !STOP.has(w)).map(stem));
}
function score(a, b) {
  const A = tokens(a), B = tokens(b);
  let s = 0;
  for (const w of A) if (B.has(w)) s += DOMAIN.has(w) ? 2 : 1;
  return s;
}
function validRationale(n) {
  return typeof n === 'string' && n.trim().length >= 20 && tokens(n).size >= 4;
}
const normq = s => String(s || '').replace(/[’‘]/g, "'").toLowerCase().replace(/\s+/g, ' ').trim();

// Lexicons for the Difficult-transcript checks
const CONT_RE = /\bif (?:it|that|this) (?:does not|doesn't|is not|isn't) work|\bif needed\b|\botherwise\b|\b(?:alternate|alternative|another|backup|fallback)\b[^.?!]{0,40}?\b(?:area|location|site|spot|option|route|plan|place)\b/i;
const ALT_RE = /\b(?:alternat\w*|another|fallback|backup|if needed|otherwise|relocat\w*)\b/i;
// 2026-10-11 Atlas regression: "notes" (plural only; the verb "note" is not a deliverable) joins the lexicon, so a
// deck and the session notes are two deliverables, as prompt rule 4 says, and splitting them is not OVER-SPLIT.
const DELIV_RE = /\b(transcripts?|summar(?:y|ies)|materials?|slide decks?|slides|decks?|minutes|recordings?|agendas?|documentation|artifacts?|notes)\b/gi;
const delivStem = w => w.toLowerCase().replace(/^(summar).*/, '$1').replace(/^(slide deck|slides|decks?)$/, 'deck').replace(/s$/, '');
const ADMIN_RE = /\b(invit\w*|calendar|meeting request|distribution list|email address|alternate email|recurring (?:call|meeting|coordination))\b/i;
const COMMIT_RE = /\b(?:I will|I'll|I am going to|I'm going to|I need to)\s+(?:\w+\s+){0,2}?(?:send|provide|get|coordinat\w*|check|verify|work through|follow up|forward|add|set up|share|confirm|make sure|reach out|start|distribute|update|draft|schedule|arrange|book|deliver)\b/i;
const ASK_RE = /\?|\b(?:can you|could you|would you|please|we need to|need to|needs to|should|must|make sure|have to)\b/i;
const TIME_RE = /\b(this morning|this afternoon|tonight|today|tomorrow|next week|this week|end of (?:the )?(?:day|week|month)|by (?:monday|tuesday|wednesday|thursday|friday)|on (?:monday|tuesday|wednesday|thursday|friday))\b/gi;
const COND_RE = /^\s*(?:if|when|whenever|should|in case|as needed)\b/i;
// A direct request for work. "Should" and a bare question are not: "the team should be prepared" is an expectation.
const REQUEST_RE = /\b(?:can you|could you|would you|please|make sure|we need to|need to|needs to|have to|must)\b/i;
// Hygiene (testers, 2026-10-12): a possessive time word names a document ("today's transcript"); it is not a delivery
// time. "Send the transcript today" still states timing. normq has already folded curly apostrophes to "'".
const POSS_TIME_RE = /\b(today|tonight|tomorrow|this (?:morning|afternoon|week)|next week)'s\b/gi;
const dePossess = s => String(s || '').replace(POSS_TIME_RE, ' ');
// Deliverable families (Oct 9 precedent): a word missing from one label can be carried by a sibling of its family.
// Aaron (2026-10-12): "those materials" / "these documents" refer back to deliverables already named; they are not a
// further deliverable. Only words not introduced by "those" or "these" count.
const delivWords = text => [...String(text || '').matchAll(DELIV_RE)].filter(m => !/\b(?:those|these)\s+$/i.test(String(text).slice(0, m.index))).map(m => m[0]);
const DELIV_FAMS = [['transcript', /\btranscripts?\b|\brecordings?\b|\bminutes\b/i], ['summaries/materials', /\bsummar(?:y|ies)\b|\bmaterials?\b|\bartifacts?\b/i], ['slide deck', /\bslides?\b|\bdecks?\b/i], ['notes', /\bnotes\b/i]];
const famsOf = t => DELIV_FAMS.filter(([, re]) => re.test(t)).map(([n]) => n);

const MUST_BIND = new Set(['commitment', 'status_update', 'decision', 'open_question']);
const ACTIONABLE = new Set(['commitment', 'request', 'decision', 'open_question']);
const WEAK = new Set(['greeting', 'context', 'other', 'administrative']);
const REL_DAYS = { 'today': 0, 'this morning': 0, 'this afternoon': 0, 'tonight': 0, 'tomorrow': 1 };
const POSSIBLE_MATCH_MIN = 2;

function addDays(iso, n) {
  const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function parseCite(c) {
  const m = /^S(\d+)\s*[-–]\s*S?(\d+)$/.exec(String(c).trim());
  if (!m) return { ids: [String(c).trim()], range: false, span: 1 };
  const a = +m[1], b = +m[2], w = m[1].length, ids = [];
  for (let i = a; i <= b; i++) ids.push('S' + String(i).padStart(w, '0'));
  return { ids, range: true, span: b - a + 1 };
}
const normParty = s => String(s || '').toLowerCase().replace(/[^a-z]/g, '');
const sameParty = (owner, speaker) => {
  const o = normParty(owner), sp = normParty(speaker);
  return !!o && (o === sp || (o.length >= 3 && sp.includes(o)));
};

/* ---------- Validator ----------
 * ctx = { meetingDate, segments:[{id,speaker,text}], register:{projects,tasks}, requireSelfReview? }
 */
function validate(rawPkg, ctx) {
  const pkg = adapt(rawPkg);
  const out = [];
  const add = (code, sev, ref, msg) => out.push({ code, sev, ref, msg });

  const segs = ctx.segments || [];
  const segById = new Map(segs.map(s => [s.id, s]));
  const segText = id => (segById.get(id) || {}).text || '';
  const sentsOf = id => String(segText(id)).split(/(?<=[.!?])\s+/);
  const tasks = (ctx.register && ctx.register.tasks) || [];
  const projects = (ctx.register && ctx.register.projects) || [];
  const taskById = new Map(tasks.map(t => [t.id, t]));
  const projById = new Map(projects.map(p => [p.id, p]));
  const taskText = id => { const t = taskById.get(id); return t ? `${t.title} ${t.description || ''}` : ''; };
  const ops = pkg.ops, disp = pkg.dispositions, cov = pkg.registerCoverage;
  // Words that appear in two or more register items cannot tell items apart (e.g. "transfer" in a transfer project).
  const df = new Map();
  for (const t of tasks) for (const w of tokens(`${t.title} ${t.description || ''}`)) df.set(w, (df.get(w) || 0) + 1);
  const dscore = (a, b) => { const A = tokens(a), B = tokens(b); let s = 0; for (const w of A) if (B.has(w) && (df.get(w) || 0) < 2) s += DOMAIN.has(w) ? 2 : 1; return s; };
  const opById = new Map(ops.map(o => [o.id, o]));
  // §16.16 (2026-10-14): a party introduced in this meeting is named by its ref (NEW-P1). A commitment by that person
  // is spoken under their name ("Reyes, Morgan"), so the ref is read as the new party's name, word for word.
  const newPartyName = id => { const np = ops.find(x => x.kind === 'NewParty' && x.id === id); return np ? np.title : null; };
  const nameWords = s => String(s || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length >= 2);
  const sameSpeaker = (owner, speaker) => {
    const nm = newPartyName(owner); if (!nm) return sameParty(owner, speaker);
    const sp = new Set(nameWords(speaker)), nw = nameWords(nm);
    return nw.length >= 2 ? nw.every(w => sp.has(w)) : sameParty(nm, speaker);
  };
  const dispsBySeg = new Map();
  for (const d of disp) { if (!dispsBySeg.has(d.seg)) dispsBySeg.set(d.seg, []); dispsBySeg.get(d.seg).push(d); }
  const projOf = o => o.target ? ((taskById.get(o.target) || {}).project || (opById.get(o.target) || {}).project || null) : o.project;
  const creates = ops.filter(o => o.kind === 'CreateTask');

  // Citations: ranges wider than 3 are flagged and do NOT bind segments.
  const opCites = new Map();
  for (const o of ops) {
    const ids = [];
    for (const c of o.cites) {
      const p = parseCite(c);
      if (p.range && p.span > 3) { add('CITE-RANGE', 'block', o.id, `${o.id} cites range ${c} (${p.span} segments); list segments explicitly`); continue; }
      ids.push(...p.ids);
    }
    opCites.set(o.id, [...new Set(ids)]);
  }
  // A segment can carry several dispositions (one sentence commits to two deliverables and raises a question).
  // For an op, count only the dispositions that name it or its target; if none do, all of the segment's dispositions.
  const citedDisp = o => opCites.get(o.id).flatMap(s => {
    const ds = dispsBySeg.get(s) || [];
    const mine = ds.filter(d => d.links.includes(o.id) || (o.target && d.links.includes(o.target)));
    return mine.length ? mine : ds;
  });
  // Evidence text for an op: its quotes when the reply gives them, else the cited segments.
  const evidence = o => {
    const q = (o.src || []).map(s => s.quote).filter(Boolean);
    return q.length ? q : opCites.get(o.id).map(segText);
  };
  const srcTexts = o => (o.src && o.src.some(s => s.quote))
    ? o.src.map(s => ({ seg: s.seg, text: s.quote || segText(s.seg) }))
    : opCites.get(o.id).map(s => ({ seg: s, text: segText(s) }));

  // Reference checks inside notes. For a disposition note, an op it names must cite that segment.
  const REF_RE = /\b(NEW-[A-Z0-9]+|OP-[A-Z0-9]+|AI-\d+|BL-\d+|T-\d+|S\d{2,4}|P\d+)\b/g;
  function danglingRefs(note, seg) {
    const bad = [];
    for (const id of (String(note).match(REF_RE) || [])) {
      if (/^(NEW|OP)-/.test(id)) {
        if (!opById.has(id)) bad.push(`${id} does not exist`);
        else if (seg && !opCites.get(id).includes(seg)) bad.push(`${id} does not cite ${seg}`);
      } else if (/^(AI|BL|T)-/.test(id)) { if (!taskById.has(id)) bad.push(`${id} not in register`); }
      else if (/^S\d/.test(id)) { if (!segById.has(id)) bad.push(`${id} not in transcript`); }
      else if (/^P\d/.test(id)) { if (!projById.has(id)) bad.push(`${id} not in register`); }
    }
    return bad;
  }
  function checkRationale(note, ref, seg) {
    if (!validRationale(note)) { add('COV-EMPTY-RATIONALE', 'block', ref, `rationale too thin: "${note}"`); return false; }
    const bad = danglingRefs(note, seg);
    if (bad.length) { add('REF-DANGLING', 'block', ref, bad.join('; ')); return false; }
    return true;
  }

  // Segment table completeness
  for (const s of segs) if (!dispsBySeg.has(s.id)) add('DISP-MISSING', 'block', s.id, `no disposition for ${s.id}`);
  for (const d of disp) if (!segById.has(d.seg)) add('REF-DANGLING', 'block', d.seg, `disposition for unknown segment ${d.seg}`);

  // Register coverage completeness (open items in the covered projects) and honesty
  const covered = pkg.coveredProjects;
  for (const t of tasks) {
    if (t.status === 'closed') continue;
    if (covered.length && !covered.includes(t.project)) continue;
    if (!cov.some(c => c.id === t.id)) add('COV-MISSING-ITEM', 'block', t.id, `${t.id} has no coverage row`);
  }
  for (const c of cov) {
    if (/^possible_match/.test(c.coverage || '')) {
      add('COV-UNRESOLVED', 'block', c.id, `${c.id} left as "${c.coverage}"; decide: update it, or mark it not_discussed with a reason`);
      const minted = creates.filter(o => opCites.get(o.id).some(s => c.segs.includes(s)));
      if (minted.length) add('COV-DEFERRED-NEW', 'block', c.id, `segments the reply ties to ${c.id} (${c.segs.join(', ')}) produced new tasking${minted.length > 1 ? 's' : ''} ${minted.map(o => o.id).join(', ')} instead of an update to ${c.id}`);
      continue;
    }
    if (c.coverage !== 'not_discussed') {
      const touched = ops.some(o => o.target === c.id) || pkg.flags.some(f => f.about.includes(c.id));
      if (!touched) add('COV-CLAIM-UNSUPPORTED', 'block', c.id, `${c.id} claimed "${c.coverage}" but no op or flag touches it (a citation alone is not an output)`);
      continue;
    }
    const linked = disp.some(d => d.links.includes(c.id)) || ops.some(o => o.target === c.id);
    if (linked) { add('COV-CONTRADICTION', 'block', c.id, `${c.id} marked not_discussed but a disposition or op links to it`); continue; }
    let best = 0, bestSeg = null;
    for (const s of segs) { const sc = score(s.text, taskText(c.id)); if (sc > best) { best = sc; bestSeg = s.id; } }
    if (best >= POSSIBLE_MATCH_MIN) {
      if (!c.note) add('COV-POSSIBLE-MATCH', 'block', c.id, `${c.id} marked not_discussed; ${bestSeg} overlaps it (score ${best}); link it or add a rationale`);
      else checkRationale(c.note, c.id, null);
    }
  }

  // Binding: every commitment/status/decision/question disposition is cited by an op or flag, or carries a rationale.
  const bound = new Set();
  for (const ids of opCites.values()) ids.forEach(s => bound.add(s));
  for (const f of pkg.flags) (f.cites || []).forEach(c => { const p = parseCite(c); if (p.span <= 3) p.ids.forEach(s => bound.add(s)); });
  for (const d of disp) {
    if (d.cls === 'uncertain') { if (!validRationale(d.note)) add('COV-EMPTY-RATIONALE', 'block', d.seg, `${d.seg} uncertain_requires_review needs its one-line note`); continue; }
    if (d.cls === 'discussion' && d.links.length && !d.links.some(l => taskById.has(l) || opById.has(l)))
      add('DISP-ABOUT-PROJECT', 'block', d.seg, `${d.seg} is "discussion of a register item" but names no item (about: ${d.links.join(', ')}); name the tasking it discusses`);
    if (!MUST_BIND.has(d.cls) || bound.has(d.seg)) continue;
    if (!d.note) { add('COV-UNBOUND-DISPOSITION', 'block', d.seg, `${d.seg} (${d.cls}) is cited by no op or flag and has no rationale`); continue; }
    checkRationale(d.note, d.seg, d.seg);
  }

  // A first-person commitment to act must be classified as a commitment (D-UX9 recall: the classification is a claim).
  for (const s of segs) {
    if (!COMMIT_RE.test(normq(s.text).replace(/\bi\b/g, 'I'))) continue;
    const ds = dispsBySeg.get(s.id) || [];
    if (ds.length && !ds.some(d => d.cls === 'commitment' || d.cls === 'uncertain'))
      add('COMMITMENT-MISCLASSIFIED', 'block', s.id, `${s.id} contains a first-person commitment ("${(normq(s.text).replace(/\bi\b/g, 'I').match(COMMIT_RE) || [''])[0]}") but is classified ${[...new Set(ds.map(d => d.cls))].join(' / ')}`);
  }

  // CreateTask must rest on acceptance. An owned task needs a commitment spoken by that owner.
  const failedAcceptance = new Set();
  for (const o of creates) {
    const ds = citedDisp(o);
    // Aaron's ruling (2026-10-12): work the meeting asked for becomes a task even when nobody took it on. The missing
    // owner is shown on the board ("No owner yet") for someone to settle later. So an unowned task stands on a quoted,
    // unconditional ask, however the chat classified the statement (it often says "uncertain" because of the owner).
    const asked = (o.src || []).some(s => s.quote && REQUEST_RE.test(s.quote) && !COND_RE.test(s.quote));
    const ok = o.owner
      ? ds.some(d => d.cls === 'commitment' && sameSpeaker(o.owner, (segById.get(d.seg) || {}).speaker))
      : ds.some(d => ACTIONABLE.has(d.cls)) || asked;
    if (!ok) { failedAcceptance.add(o.id); add('TASK-NO-ACCEPTANCE', 'block', o.id, `${o.id} cites no ${o.owner ? 'commitment by ' + o.owner : 'request, commitment, decision or question'}`); continue; }
    // An unowned tasking needs a quoted ask or commitment, not just a description of work under way.
    const quotes = (o.src || []).map(s => s.quote).filter(Boolean);
    if (!o.owner && quotes.length && !quotes.every(q => COND_RE.test(q)) && !quotes.some(q => ASK_RE.test(q) || COMMIT_RE.test(normq(q).replace(/\bi\b/g, 'I')))) {
      failedAcceptance.add(o.id); add('TASK-NO-ACCEPTANCE', 'block', o.id, `${o.id} is unowned and none of its quotes asks for anything or commits to anything; they describe work already under way`);
    }
  }
  // D-UX12 (ratified 2026-10-12) hard stop 5: contradictory changes in one reply. Mechanical, not a matter of wording.
  { const byT = new Map(); const push = (t, o) => { if (!t) return; if (!byT.has(t)) byT.set(t, []); byT.get(t).push(o); };
    for (const o of ops) push(o.kind === 'CreateTask' ? o.id : o.target, o);
    for (const [t, os] of byT) {
      const sts = [...new Set(os.filter(o => o.kind === 'StatusChange' && o.status).map(o => o.status))];
      if (sts.length > 1) add('OP-CONFLICT', 'block', os.find(o => o.kind === 'StatusChange').id, `${t} is given conflicting statuses in this reply: ${sts.join(' and ')}`);
      const owners = [...new Set([...os.filter(o => o.kind === 'CreateTask' && o.owner).map(o => o.owner), ...os.filter(o => o.kind === 'Reassign' && o.to).map(o => o.to)])];
      if (owners.length > 1) add('OP-CONFLICT', 'block', (os.find(o => o.kind === 'Reassign') || os[0]).id, `${t} is given two different owners in this reply: ${owners.join(' and ')}`);
      const dates = [...new Set([...os.filter(o => o.timing && o.timing.resolved).map(o => o.timing.resolved), ...os.filter(o => o.kind === 'Deadline' && o.timing && o.timing.resolved).map(o => o.timing.resolved)])];
      if (dates.length > 1) add('OP-CONFLICT', 'block', os[0].id, `${t} is given conflicting dates in this reply: ${dates.join(' and ')}`);
    }
    const made = new Set(creates.map(o => o.id));
    for (const o of ops) if (o.kind === 'SameAs' && (made.has(o.duplicate) || made.has(o.survivor)))
      add('OP-CONFLICT', 'block', o.id, `${made.has(o.duplicate) ? o.duplicate : o.survivor} is created and merged in the same reply`);
  }
  // D-UX12 §3: a change to a task's owner, status, date, prerequisite or decision needs direct evidence for that exact
  // change. Without it the change is demoted to a labeled note (the workbench does that); the finding names it.
  { const HEDGE = /\b(?:i think|i believe|probably|maybe|might|should be|hopefully|i guess|not sure)\b/i;
    const ST = { completed: /\b(?:done|completed?|finished|sent|delivered|closed|wrapped up|took care of)\b/i,
      in_progress: /\b(?:working on|started|in progress|underway|on it|began|begun|am doing|are doing)\b/i,
      blocked: /\b(?:blocked|waiting|can(?:no|')t|until|depends|stuck|holding)\b/i };
    const ACCEPT = /\b(?:yes|okay|ok|sure|absolutely|will do|i can|i will|i'll|i am on it|i'm on it|on it|i'?ll take|i will take)\b/i;
    const DATE = /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today|tonight|next week|end of|eod|eow)\b|\d/i;
    const MOVE = /\b(?:move[ds]?|moving|push(?:ed|ing)?|change[ds]?|shift(?:ed)?|now due|new date|instead|reschedul\w*|extend\w*|by)\b/i;
    const DEP = /\b(?:after|before|depends|dependent|waiting on|until|first|blocked by|prerequisite|once)\b/i;
    const DECIDE = /\b(?:decided|decision|agreed|we will go with|we'll go with|approved|settled|final(?:ized)?)\b/i;
    const quotes = o => o.src.map(x => normq(x.quote || segText(x.seg)));
    for (const o of ops) {
      let what = null;
      if (!o.cites.length || o.cites.some(id => !segById.has(id))) continue;   // unverifiable citations are CITE-RANGE's hard stop
      if (o.kind === 'Reassign' && o.to) {
        const ok = o.cites.some(id => { const sg = segById.get(id); return sg && sameSpeaker(o.to, sg.speaker) &&
          ((dispsBySeg.get(id) || []).some(d => d.cls === 'commitment') || COMMIT_RE.test(normq(sg.text).replace(/\bi\b/g, 'I')) || ACCEPT.test(normq(sg.text))); });
        if (!ok) what = `owner (to ${o.to}): no cited statement by ${o.to} takes it on`;
      } else if (o.kind === 'StatusChange' && ST[o.status]) {
        const qs = quotes(o);
        if (!qs.some(q => ST[o.status].test(q) && !HEDGE.test(q))) what = `status (${o.status}): no cited statement says so plainly`;
      } else if (o.kind === 'Deadline') {
        if (!quotes(o).some(q => DATE.test(q) && MOVE.test(q))) what = 'due date: no cited statement changes the date';
      } else if (o.kind === 'PrerequisiteAdd' || o.kind === 'PrerequisiteWithdraw') {
        if (!quotes(o).some(q => DEP.test(q))) what = 'prerequisite: no cited statement states the dependency';
      } else if (o.kind === 'Decision') {
        if (!o.cites.some(id => (dispsBySeg.get(id) || []).some(d => d.cls === 'decision')) && !quotes(o).some(q => DECIDE.test(q))) what = 'decision: no cited statement records a decision';
      }
      if (what) add('SUPPORT-MISSING', 'block', o.id, `${o.id} changes the ${what}`);
    }
  }
  // One tasking, one deadline: quotes carrying different timing phrases are different commitments.
  for (const o of creates) {
    const phrases = new Set((dePossess(normq((o.src || []).map(s => s.quote).join(' '))).match(TIME_RE) || []).map(p => p.toLowerCase()));
    if (phrases.size >= 2) add('TIMING-MERGED', 'block', o.id, `${o.id} merges commitments with different timing ("${[...phrases].join('", "')}"); give each its own tasking and due date`);
    // Deliverable families (tester precedent, Oct 9: transcript and summaries are different deliverables).
    const fams = [['transcript', /\btranscripts?\b|\brecordings?\b|\bminutes\b/i], ['summaries/materials', /\bsummar(?:y|ies)\b|\bmaterials?\b|\bartifacts?\b/i], ['slide deck', /\bslides?\b|\bdecks?\b/i], ['notes', /\bnotes\b/i]]
      .filter(([, re]) => re.test(o.title)).map(([n]) => n);
    if (fams.length >= 2) add('DELIVERABLES-MERGED', 'block', o.id, `${o.id} bundles separate deliverables (${fams.join(' + ')}) in one tasking; give each its own tasking`);
  }

  // One op, one actionable unit (merge check).
  for (const o of ops) {
    if (!['CreateTask', 'ProgressNote', 'OpenQuestion', 'StatusChange'].includes(o.kind)) continue;
    const units = new Set();
    for (const s of opCites.get(o.id)) {
      const ds = dispsBySeg.get(s) || [];
      const mine = ds.filter(d => d.links.includes(o.id) || (o.target && d.links.includes(o.target)));
      const act = (mine.length ? mine : ds).filter(d => ACTIONABLE.has(d.cls));
      if (!act.length) continue;
      // Units come from dispositions that name this op, or that state a unit explicitly.
      // Otherwise the segment counts once: its other dispositions belong to other ops.
      if (mine.length || act.every(d => d.unitExplicit)) act.forEach(d => units.add(d.unit || d.seg));
      else units.add(s);
    }
    if (units.size >= 2) add('DECOMP-MERGED', 'block', o.id, `${o.id} binds ${units.size} distinct units: ${[...units].join(', ')}`);
  }

  // Over-split: two new taskings answering one ask, with one owner and a shared subject.
  for (let i = 0; i < creates.length; i++) for (let j = i + 1; j < creates.length; j++) {
    const a = creates[i], b = creates[j];
    if ((a.owner || null) !== (b.owner || null)) continue;
    const ca = opCites.get(a.id), cb = opCites.get(b.id);
    const sameSrc = ca.length > 0 && ca.length === cb.length && ca.every(s => cb.includes(s));
    const sharedAsk = disp.some(d => ['open_question', 'request'].includes(d.cls) && d.links.includes(a.id) && d.links.includes(b.id));
    const da = new Set((a.title.match(DELIV_RE) || []).map(delivStem)), db = new Set((b.title.match(DELIV_RE) || []).map(delivStem));
    const distinctDeliverables = da.size && db.size && ![...da].some(w => db.has(w));
    if ((sameSrc || sharedAsk) && !distinctDeliverables && score(a.title, b.title) >= 1)
      add('OVER-SPLIT', 'block', `${a.id}+${b.id}`, `${a.id} and ${b.id} answer one ${sharedAsk ? 'request' : 'set of segments'} with one owner and a shared subject; one completion condition?`);
  }

  // Task matching for updates
  const active = tasks.filter(t => t.status !== 'closed');
  for (const o of ops) {
    if (!o.target || !['ProgressNote', 'Reassign', 'StatusChange'].includes(o.kind)) continue;
    let hit = null;
    for (const { seg, text } of srcTexts(o)) {
      const sa = dscore(text, taskText(o.target));
      for (const t of active) {
        if (t.id === o.target) continue;
        const sb = dscore(text, taskText(t.id));
        if (sb >= 2 && sb > sa && (!hit || sb - sa > hit.gap)) hit = { sid: seg, t: t.id, sa, sb, gap: sb - sa };
      }
    }
    // In the MKG format a match is justified by an ambiguous_reference flag that cites the segment and names either tasking.
    const justified = validRationale(o.matchRationale) || (hit && pkg.flags.some(f => /ambiguous_reference/.test(f.code) && f.cites.includes(hit.sid) &&
      (f.about.includes(o.target) || f.about.includes(hit.t)) && validRationale(f.note)));
    if (hit) add('MATCH-BETTER-TARGET', justified ? 'warn' : 'block', o.id, `${o.id} on ${o.target}: ${hit.sid} fits ${hit.t} better (${hit.sb} vs ${hit.sa})${justified ? '; an ambiguous_reference flag explains the choice' : ''}`);
    const combined = [o.title, ...opCites.get(o.id).map(segText)].join(' ');
    if (taskById.has(o.target) && score(combined, taskText(o.target)) === 0)
      add('MATCH-SCOPE-MISFIT', 'warn', o.id, `${o.id} shares no key term with ${o.target}`);
  }

  // New work that duplicates existing work (update-before-create). selfReview.newVsExisting can justify it.
  const sr = pkg.selfReview;
  const nve = new Map(((sr && sr.newVsExisting) || []).map(r => [r.ref, r]));
  for (const o of creates) {
    const ev = [o.title, ...((o.src || []).map(s => s.quote))].join(' ');
    let best = null;
    for (const t of active) {
      if (projOf(o) && t.project !== projOf(o)) continue;
      const s = dscore(ev, taskText(t.id));
      if (s >= 2 && (!best || s > best.s)) best = { t: t.id, s };
    }
    if (!best) continue;
    const row = nve.get(o.id);
    if (row && row.nearest && taskById.has(row.nearest) && validRationale(row.whyNew))
      add('NEW-DUPLICATE', 'warn', o.id, `${o.id} shares its subject with ${best.t}; selfReview names ${row.nearest} and justifies separate work`);
    else if (row && !row.nearest)
      add('NEW-DUPLICATE', 'block', o.id, `${o.id}: selfReview says no similar tasking exists, but ${best.t} shares its subject (score ${best.s})`);
    else
      add('NEW-DUPLICATE', 'block', o.id, `${o.id} shares its subject with ${best.t} (score ${best.s}); update ${best.t} instead, or justify in selfReview.newVsExisting`);
  }

  // Scope: contingencies, deliverables, truncated commitments
  for (const o of ops) {
    if (!['CreateTask', 'ProgressNote', 'OpenQuestion', 'StatusChange'].includes(o.kind)) continue;
    const contSegs = opCites.get(o.id).filter(s => CONT_RE.test(segText(s)));
    if (contSegs.length && !ALT_RE.test(o.title))
      add('CONTINGENCY-DROPPED', 'block', o.id, `${o.id} cites ${contSegs.join(', ')}, which states a fallback ("${(segText(contSegs[0]).match(CONT_RE) || [''])[0]}"), but its label/text drops it`);
    const quotes = (o.src || []).map(s => s.quote).filter(Boolean);
    if (quotes.length) {
      const words = new Map();
      for (const w of delivWords(quotes.join(' '))) if (!words.has(delivStem(w))) words.set(delivStem(w), w.toLowerCase());
      const t = o.title.toLowerCase();
      // The label may name a deliverable in another form ("slides" for "slide deck"): compare stems, not spellings.
      const tStems = new Set((o.title.match(DELIV_RE) || []).map(delivStem));
      const has = st => t.includes(st) || tStems.has(st);
      const missing = [...words.keys()].filter(w => !has(w));
      if (missing.length) add('DELIVERABLE-DROPPED', o.kind === 'CreateTask' ? 'block' : 'warn', o.id, `${o.id} quotes "${missing.map(w => words.get(w)).join('", "')}" but its label/text leaves ${missing.length > 1 ? 'them' : 'it'} out`);
      // Hygiene (testers, 2026-10-12): check the full sentence each quote comes from, not only the trimmed quote. A
      // deliverable the sentence promises must appear in some op that cites that sentence; when none carries it, the
      // finding goes to the citing op of the same deliverable family (summaries carry materials), else the first one.
      else {
        const inSent = (sent, quote) => normq(sent).includes(normq(quote).replace(/[.?!]+$/, ''));
        const extra = new Map();
        for (const sq of (o.src || []).filter(x => x.quote)) {
          const sent = sentsOf(sq.seg).find(x => inSent(x, sq.quote));
          if (!sent) continue;
          for (const w of delivWords(sent)) {
            const st = delivStem(w);
            if (has(st) || words.has(st) || extra.has(st)) continue;
            const citers = ops.filter(x => (x.src || []).some(y => y.quote && y.seg === sq.seg && inSent(sent, y.quote)));
            if (citers.some(x => x.title.toLowerCase().includes(st) || (x.title.match(DELIV_RE) || []).some(y => delivStem(y) === st))) continue;
            const fam = famsOf(w)[0];
            const owner = citers.find(x => fam && famsOf(x.title).includes(fam)) || citers[0];
            if (owner === o) extra.set(st, { w: w.toLowerCase(), sent });
          }
        }
        if (extra.size) { const first = [...extra.values()][0];
          add('DELIVERABLE-DROPPED', o.kind === 'CreateTask' ? 'block' : 'warn', o.id, `${o.id} cites "${first.sent.trim()}", which also promises "${[...extra.values()].map(x => x.w).join('", "')}", but no op that cites it names ${extra.size > 1 ? 'them' : 'it'}`); }
      }
    }
    if (quotes.length) {
      const siblings = ops.filter(x => x !== o && opCites.get(x.id).some(s => opCites.get(o.id).includes(s))).map(x => x.title).join(' ');
      const coveredTok = tokens([o.title, ...quotes, siblings].join(' '));
      const missing = new Set(); let full = null;
      for (const { seg, quote } of o.src) {
        if (!quote) continue;
        const q = normq(quote).replace(/[.?!]+$/, '');
        const raw = String(segText(seg)).split(/(?<=[.!?])\s+/).find(s => normq(s).includes(q));
        const sent = raw && normq(raw);
        if (!sent || q.length >= 0.8 * sent.length) continue;
        const before = missing.size;
        for (const w of tokens(sent.replace(q, ' '))) if (!coveredTok.has(w)) missing.add(w);
        if (missing.size > before && !full) full = `${seg}: "${raw}"`;
      }
      if (missing.size >= 3) add('QUOTE-TRUNCATED', 'warn', o.id, `${o.id} quotes only part of the committing sentence (${full}); the label/text leaves out part of what it commits to`);
    }
  }

  // Administrative work minted as project work; conditional instructions minted as tasks.
  for (const o of creates) {
    const ev = [o.title, ...((o.src || []).map(s => s.quote))].join(' ');
    const pid = projOf(o);
    if (ADMIN_RE.test(ev) && !tasks.some(t => t.project === pid && ADMIN_RE.test(taskText(t.id))))
      add('ADMIN-IN-PROJECT', 'block', o.id, `${o.id} is meeting/invitation administration filed under ${pid}, which has no administrative tasking; disposition it administrative instead`);
    const quotes = (o.src || []).map(s => s.quote).filter(Boolean);
    if (!o.owner && quotes.length && quotes.every(q => COND_RE.test(q)))
      add('CONDITIONAL-TASKING', 'block', o.id, `${o.id} turns a conditional instruction ("${quotes[0].slice(0, 60)}") into an unowned tasking; record it as an open question or a progress note`);
  }

  // Project scope. A covered project needs an op of its own that cites either
  //   (a) a segment overlapping the project's vocabulary (clean support), or
  //   (b) a substantive disposition - support by classification only, raises PROJ-LINK-ONLY for a human to confirm.
  const vocab = pid => {
    const p = projById.get(pid) || {};
    return [p.title, p.description, ...tasks.filter(t => t.project === pid).map(t => `${t.title} ${t.description || ''}`)].join(' ');
  };
  const SUBSTANTIVE = new Set([...MUST_BIND, 'request']);
  const unsupported = new Set();
  for (const pid of covered) {
    const v = vocab(pid);
    const mine = ops.filter(o => o.kind !== 'NewParty' && projOf(o) === pid);
    const lexical = mine.some(o => opCites.get(o.id).some(s => score(segText(s), v) >= 2));
    const linkOnly = !lexical && mine.some(o => citedDisp(o).some(d => SUBSTANTIVE.has(d.cls)));
    if (lexical) continue;
    if (linkOnly) { add('PROJ-LINK-ONLY', 'warn', pid, `${pid} supported only by classification, not by shared wording; confirm`); continue; }
    unsupported.add(pid); add('PROJ-UNSUPPORTED', 'block', pid, `${pid} in coveredProjects without a cited segment about its work`);
  }
  for (const o of ops) {
    if (o.kind === 'NewParty') continue;
    const pid = projOf(o);
    if (!pid) continue;
    if (unsupported.has(pid)) add('PROJ-ORPHAN-OP', 'block', o.id, `${o.id} targets unsupported project ${pid}`);
    else if (!covered.includes(pid)) add('PROJ-ORPHAN-OP', 'block', o.id, `${o.id} targets ${pid}, which is missing from coveredProjects`);
  }

  // New parties need identity evidence or a valid op of their own.
  for (const o of ops) {
    if (o.kind !== 'NewParty') continue;
    const name = o.title;
    const weak = citedDisp(o).every(d => WEAK.has(d.cls));
    const owns = ops.some(x => x !== o && (x.owner === name || x.to === name || x.owner === o.id || x.to === o.id) && !failedAcceptance.has(x.id));
    // §16.16: a passing answer to an open "Who is ...?" item is identity evidence for the person it names.
    const answered = arr(ctx.identityRefs).includes(o.id);
    if (weak && !owns && !answered) add('PARTY-IDENTITY', 'block', o.id, `${o.id} (${name}) rests only on greeting/context and owns no valid op`);
  }

  // Timing must be grounded in the evidence shown to the reviewer (the quotes when given, else the cited segments)
  // and resolved from the meeting date. Tester ruling, Oct 12: a dated task's quote must contain its timing phrase.
  for (const o of ops) {
    if (!o.timing || !o.timing.resolved) continue;
    const phrase = normq(o.timing.phrase);
    const quoted = (o.src || []).some(s => s.quote);
    const texts = evidence(o).map(normq);
    const timed = texts.map(dePossess);
    if (phrase && !timed.some(t => t.includes(phrase)) && texts.some(t => t.includes(phrase + "'s"))) { add('TIME-UNGROUNDED', 'block', o.id, `${o.id}: "${phrase}" appears only as "${phrase}'s ...", which names the document, not when it will be delivered; remove the due date unless the speaker says when it will be delivered, and then quote those words`); continue; }
    if (!phrase || !timed.some(t => t.includes(phrase))) { add('TIME-UNGROUNDED', 'block', o.id, `${o.id}: phrase "${phrase}" not in ${quoted ? 'its quotes; quote the words that carry the timing' : 'cited segments'}`); continue; }
    if (phrase in REL_DAYS && ctx.meetingDate && o.timing.resolved !== addDays(ctx.meetingDate, REL_DAYS[phrase]))
      add('TIME-UNGROUNDED', 'block', o.id, `${o.id}: "${phrase}" should resolve to ${addDays(ctx.meetingDate, REL_DAYS[phrase])}, got ${o.timing.resolved}`);
  }

  // Self-review (proposed D-UX10a): every new tasking names its nearest existing tasking and why it is new work.
  if (ctx.requireSelfReview) {
    if (!sr) add('SELF-REVIEW-MISSING', 'block', 'selfReview', 'no selfReview object; each NewTasking needs a newVsExisting row');
    else for (const o of creates) {
      const row = nve.get(o.id);
      if (!row) add('SELF-REVIEW-INCOMPLETE', 'block', o.id, `${o.id} has no selfReview.newVsExisting row`);
      else if (row.nearest && creates.some(x => x.id === row.nearest)) add('REF-DANGLING', 'block', o.id, `selfReview for ${o.id} names ${row.nearest}, a new tasking from this same reply; "nearest" must be an existing active INDEX tasking or null`);
      else if (row.nearest && !taskById.has(row.nearest)) add('REF-DANGLING', 'block', o.id, `selfReview names ${row.nearest}, which is not in the register`);
      else if (row.nearest && taskById.get(row.nearest).status === 'closed') add('REF-DANGLING', 'block', o.id, `selfReview for ${o.id} names ${row.nearest}, which is not active; "nearest" must be an existing active INDEX tasking or null`);
      else if (!validRationale(row.whyNew)) add('SELF-REVIEW-INCOMPLETE', 'block', o.id, `${o.id}: whyNew is missing or too thin`);
    }
  }

  return { flags: out, blocked: out.some(f => f.sev === 'block'), format: pkg.format };
}

const api = { adapt, validate, tokens, score, stem, validRationale, ALIASES, CONT_RE, ALT_RE, ADMIN_RE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGValidator = api;
})(typeof window !== 'undefined' ? window : globalThis);
