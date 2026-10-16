/* D-UX12 Phase 2: settling labels on the board (plan §16, amendments §16.9, ratified 2026-10-13).
 * Shared verbatim by the test harness and MeetingGraph.html, like ux11.js.
 *
 * A resolution is a reviewer's decision about one label on one target (a task, a project, the meeting, or a
 * reviewer-added person). It is saved in a board-resolutions package (an out-of-meeting update without a chat round):
 *   - the reviewer's note is attestation, never meeting evidence (A1): each record keeps the meeting basis
 *     (segment and quote), the resolver and time, and the note as separate parts;
 *   - board changes (owner, date, status, a new person) are ordinary ops citing the reviewer's statement, compiled
 *     through the same validator as any import;
 *   - nothing is overwritten (A2): a record names what it supersedes; two records of one label where neither
 *     supersedes the other are a conflict;
 *   - the label key is meeting ID + source segment ID + label kind + target (A7), with the quote as a fallback for
 *     labels without a segment.
 */
(function (root) {
'use strict';

const arr = x => Array.isArray(x) ? x : x == null ? [] : [x];
const norm = s => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const words = s => new Set(norm(s).split(' ').filter(w => w.length >= 3));
function jaccard(a, b) {
  const A = words(a), B = words(b); if (!A.size || !B.size) return 0;
  let n = 0; A.forEach(w => { if (B.has(w)) n++; });
  return n / (A.size + B.size - n);
}

// ---------- Label families and their actions (A5 wording) ----------
const FAMILY = {
  ambiguous_reference: 'reference',
  ownership: 'owner_missing', no_owner: 'owner_missing',
  possible_owner_change: 'owner_change', possible_status_change: 'status_change',
  possible_schedule_update: 'date', date_unclear: 'date', implied_change: 'date',
  person_unverified: 'verify',
  attendee_unmatched: 'attendee'
};
const ACTION = {
  match_person: { label: 'Match existing person', change: true, fields: ['party', 'alias'] },
  add_person: { label: 'Add person (full identity details)', change: true, fields: ['name', 'org', 'alias', 'verified'] },
  assign: { label: 'Assign owner', change: true, fields: ['task', 'party'] },
  keep_unassigned: { label: 'Keep unassigned', dismiss: true },
  confirm_owner: { label: 'Confirm owner assignment', change: true, fields: ['task', 'party'] },
  confirm_status: { label: 'Confirm status change', change: true, fields: ['task', 'status'] },
  set_date: { label: 'Set task date', change: true, fields: ['task', 'date'] },
  verify_person: { label: 'Verify identity', change: true },
  reject: { label: 'Reject change', dismiss: true },
  resolve_note: { label: 'Resolve with note' },
  not_needed: { label: 'Not needed', dismiss: true },
  defer: { label: 'Defer', defer: true },
  // §16.17: a dismissed open item can be reopened; the reopen supersedes the dismissal and keeps the item open.
  reopen: { label: 'Reopen' },
  attach: { label: 'Attach to task or project', place: true, change: true, fields: ['project', 'task'] },
  create_task: { label: 'Create task', change: true, fields: ['title', 'project', 'owner'] },
  task_note: { label: 'Add a note to a task', change: true, fields: ['task', 'text'] }
};
// §16.12: a decision is built from steps; dismissals stay one-step decisions without steps.
const STEPS = ['attach', 'match_person', 'add_person', 'assign', 'confirm_owner', 'set_date', 'confirm_status', 'task_note', 'create_task', 'verify_person'];
const STEP_SET = new Set(STEPS);
const SPECIFIC = {
  reference: ['match_person', 'add_person'],
  owner_missing: ['assign', 'keep_unassigned'],
  owner_change: ['confirm_owner', 'reject'],
  status_change: ['confirm_status', 'reject'],
  date: ['set_date', 'reject'],
  verify: ['verify_person'],
  attendee: ['match_person', 'add_person'],
  suggestion: ['create_task', 'task_note'],
  overdue: ['set_date', 'confirm_status'],
  conflict: ['set_date', 'assign'],
  open_question: ['create_task']
};
Object.assign(FAMILY, { suggestion: 'suggestion', overdue: 'overdue', conflict: 'conflict', open_question: 'open_question', unmatched: 'unmatched' });
// Every label offers its own actions, then Resolve with note, Not needed and Defer (§16.9 build order).
// §16.12: what the item is about decides. topic = { person } when the board read a name not on the board; without a
// topic (the harness), every starting action of the kind is listed.
function actionsFor(kind, topic) {
  let own = SPECIFIC[FAMILY[kind]] || [];
  if (kind === 'unmatched') own = !topic ? ['match_person', 'add_person', 'create_task'] : topic.person || topic.known ? ['match_person', 'add_person'] : ['create_task'];
  if (kind === 'ambiguous_reference' && topic && !topic.person && !topic.known) own = [];
  const tail = kind === 'person_unverified' ? ['defer'] : kind === 'attendee_unmatched' ? ['not_needed', 'defer'] : ['attach', 'resolve_note', 'not_needed', 'defer'];
  return [...own, ...tail.filter(a => !own.includes(a))];
}
// §16.15 (ratified 2026-10-14): each card has one primary action, Later (Defer) and More. Every primary that is a
// step opens the §16.12 builder with that step first; "answer" opens the Answer form (a Resolve-with-note record).
function primaryFor(kind, topic) {
  if (kind === 'ownership' || kind === 'no_owner' || kind === 'possible_owner_change') return 'assign';
  if (kind === 'possible_status_change') return 'confirm_status';
  if (kind === 'person_unverified') return 'verify_person';
  if (kind === 'attendee_unmatched') return 'match_person';
  if (kind === 'ambiguous_reference') return topic && !topic.person && !topic.known ? 'answer' : 'match_person';
  if (kind === 'unmatched') return topic && (topic.person || topic.known) ? 'match_person' : 'create_task';
  if (kind === 'suggestion' || kind === 'not_a_task_yet') return 'create_task';
  return 'answer';
}
function moreFor(kind, topic) {
  if (kind === 'person_unverified') return [];
  if (kind === 'attendee_unmatched') return ['not_needed'];
  const p = primaryFor(kind, topic);
  return ['create_task', 'attach', 'task_note', 'set_date', 'not_needed'].filter(a => a !== p);
}
function actionLabel(action, kind, topic) {
  if (action === 'answer') return 'Answer';
  if (action === 'defer') return 'Later';
  if (action === 'match_person') return 'Identify person';
  if (action === 'attach') return 'Link to task or project';
  if (action === 'set_date') return 'Set task date';
  if (action === 'add_person' && topic && topic.person) return `Add person: ${topic.person}`;
  if (action === 'confirm_status' && kind === 'overdue') return 'Confirm completed';
  if (action === 'set_date' && kind === 'overdue') return 'Set a new date';
  if (action === 'set_date' && kind === 'conflict') return 'Choose the date';
  if (action === 'assign' && kind === 'conflict') return 'Choose the owner';
  return ACTION[action] ? ACTION[action].label : action;
}
// Full names in a label's note (two or three capitalized words), for the board to check against its people.
const NOT_NAME = new Set(['operation', 'contract', 'project', 'team', 'agency', 'office', 'center', 'centre', 'department', 'partner', 'board',
  'meeting', 'weekly', 'el', 'los', 'las', 'san', 'santa', 'new', 'north', 'south', 'east', 'west', 'fort', 'the', 'not', 'no', 'confirm',
  'staging', 'transfer', 'register', 'index', 'september', 'october', 'november', 'december', 'january', 'february', 'march', 'april', 'may',
  'june', 'july', 'august', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday', 'technical', 'demonstration']);
function namesIn(note) {
  const out = [], re = /\b([A-Z][a-z'\u2019-]+(?: [A-Z][a-z'\u2019-]+){1,2})\b/g; let m;
  const t = String(note || '');
  while ((m = re.exec(t))) { const ws = m[1].split(' ');
    if (ws.some(w => NOT_NAME.has(w.toLowerCase())) || ws.some(w => w.length < 2)) continue;
    if (!out.includes(m[1])) out.push(m[1]); }
  return out;
}
// What the person sees the action do (A5: each action says it changes the board on a reviewer's decision).
function consequence(action) {
  switch (action) {
    case 'match_person': return 'Records the name used in the meeting as another name for that person, on your decision.';
    case 'add_person': return 'Adds the person to the board on your decision, marked as reviewer-added.';
    case 'assign': case 'confirm_owner': return 'Sets the task owner on the board on your decision (not the meeting\u2019s).';
    case 'confirm_status': return 'Sets the task status on the board on your decision (not the meeting\u2019s).';
    case 'set_date': return 'Sets the task date on the board on your decision (not the meeting\u2019s).';
    case 'verify_person': return 'Marks the person as verified, on your decision.';
    case 'create_task': return 'Creates the task on the board on your decision, citing your statement.';
    case 'task_note': return 'Adds your note to the task, where its owner sees it, on your decision.';
    case 'attach': return 'Moves the item to that task or project, on your decision. It stays open there for someone to settle.';
    case 'answer': return 'Records your answer. It changes no record unless you tick a change below.';
    case 'defer': return 'Keeps the item in Needs attention, marked deferred, with your note.';
    case 'resolve_note': return 'Settles the item with your note. The board does not change.';
    default: return 'Settles the item with your reason. The board does not change; the item stays in history.';
  }
}

// ---------- Keys and state ----------
function keyOf(meetingId, segs, kind, target, quote) {
  const seg = arr(segs)[0];
  return seg ? `${meetingId}|${seg}|${kind}|${target}` : `${meetingId}|q:${norm(quote).slice(0, 80)}|${kind}|${target}`;
}
function attendeeKey(a) {
  const id = a && a.email ? String(a.email).trim().toLowerCase() : 'n:' + norm(a && a.name);
  return `attendee|${id}|attendee_unmatched|${id}`;
}
function parseKey(key) {
  const [meeting, seg, kind, target] = String(key).split('|');
  return { meeting, seg: /^q:/.test(seg) ? null : seg, kind, target };
}
// A record's steps and outcome. Records from before §16.12 carry one action and its value.
function stepsOf(r) {
  if (r && Array.isArray(r.steps)) return r.steps;
  return r && STEP_SET.has(r.action) ? [{ type: r.action, ...(r.value || {}) }] : [];
}
function outcomeOf(r) {
  if (r && r.outcome) return r.outcome;
  return r && r.action === 'defer' ? 'defer' : r && r.action === 'attach' ? 'open' : 'settle';
}
// Group records by label; heads are records nothing supersedes. One head: settled (or deferred). More: conflict.
function stateOf(records) {
  const by = {};
  for (const r of arr(records)) if (r && r.label && r.label.key) (by[r.label.key] = by[r.label.key] || []).push(r);
  const out = {};
  for (const [k, rs] of Object.entries(by)) {
    rs.sort((a, b) => String(a.at).localeCompare(String(b.at)) || String(a.id).localeCompare(String(b.id)));
    const sup = new Set(rs.flatMap(r => arr(r.supersedes)));
    const heads = rs.filter(r => !sup.has(r.id));
    const current = heads.length === 1 ? heads[0] : null;
    out[k] = { key: k, all: rs, heads, current, conflict: heads.length > 1,
      status: heads.length > 1 ? 'conflict' : !current ? 'open' : outcomeOf(current) === 'defer' ? 'deferred' : outcomeOf(current) === 'open' ? 'placed' : 'resolved' };
  }
  return out;
}
// Attach resolution state to the board's label items. Exact key first (A7); for a label without a segment, a
// record of the same meeting, kind and target whose quote is similar (fallback for older packages). A label that
// matches nothing but resembles an orphaned record (same meeting and kind, same segment or same target) gets a hint.
function attach(items, records) {
  const RS = stateOf(records), used = new Set();
  for (const it of items) {
    let st = RS[it.key];
    if (!st && !arr(it.segs).length) {
      const k = Object.keys(RS).find(k => { const p = parseKey(k); return !p.seg && p.meeting === it.meetingId && p.kind === it.kind && p.target === it.target
        && jaccard(RS[k].all[0].label.quote, it.quote) >= 0.6; });
      if (k) st = RS[k];
    }
    if (st) { used.add(st.key); it.res = st; it.status = st.status; } else { it.res = null; it.status = 'open'; }
  }
  const live = new Set(items.map(i => i.key));
  for (const it of items) {
    if (it.res) continue;
    const k = Object.keys(RS).find(k => { if (used.has(k) || live.has(k)) return false; const p = parseKey(k);
      return p.meeting === it.meetingId && p.kind === it.kind && ((p.seg && p.seg === arr(it.segs)[0]) || p.target === it.target); });
    if (k && RS[k].current) it.hint = RS[k].current;
  }
  return RS;
}

// ---------- Identity controls (A4) ----------
const ROLE = new Set(['manager', 'lead', 'director', 'engineer', 'coordinator', 'officer', 'chief', 'team', 'staff', 'admin',
  'administrator', 'contractor', 'vendor', 'pm', 'poc', 'specialist', 'analyst', 'supervisor', 'rep', 'representative', 'owner',
  'tech', 'technician', 'support', 'office', 'unknown', 'someone', 'person']);
function checkPerson(v, people) {
  const name = String(v && v.name || '').trim().replace(/\s+/g, ' ');
  const toks = name.split(' ').filter(Boolean);
  if (!name) return 'Enter the person\u2019s full name.';
  if (toks.filter(t => t.replace(/[^A-Za-z\u00c0-\u024f]/g, '').length >= 2).length < 2)
    return 'A first name, partial name or role title alone can\u2019t create a person. Enter the full name (first and last).';
  if (toks.some(t => ROLE.has(t.toLowerCase().replace(/[^a-z]/g, ''))))
    return 'That reads as a role title. Enter the person\u2019s own full name.';
  const n = norm(name), fl = s => { const t = norm(s).split(' '); return t.length >= 2 ? t[0] + ' ' + t[t.length - 1] : null; };
  const em = String(v.email || '').trim().toLowerCase();
  for (const p of arr(people)) {
    const forms = [p.name, ...arr(p.aliases)].map(norm);
    if (forms.includes(n) || (fl(name) && fl(p.name) === fl(name)) || (em && arr(p.emails).map(x => String(x).toLowerCase()).includes(em)))
      return `${p.name} is already on the board. Use Match existing person instead.`;
  }
  if (!String(v.note || '').trim()) return 'Add a note explaining how you identified this person.';
  return null;
}
// The name the meeting used, read from the label's note ("Morgan is addressed directly…").
function refName(note) {
  const m = /^(?:[A-Z][a-z]+: )?([A-Z][a-z'\u2019-]+(?: [A-Z][a-z'\u2019-]+)?)\b(?= is| was| has|,| \()/.exec(String(note || '').trim());
  if (m) return m[1];
  const q = /[\u201c"]([A-Z][a-z'\u2019-]+(?: [A-Z][a-z'\u2019.-]*)?)[\u201d"]/.exec(String(note || ''));
  return q ? q[1] : '';
}

// ---------- Building the save ----------
const STATUS_WORD = { open: 'open', in_progress: 'in progress', blocked: 'blocked', completed: 'completed' };
function decisionText(a, ctx) {
  if (a.answer) {
    const st = arr(a.steps).map(x => decisionText({ action: x.type, value: x, refs: a.refs || {} }, ctx));
    return `Reviewer answer: ${a.answer.display}${st.length ? `; ${st.join('; ')}` : ''}${outcomeOf(a) === 'open' ? '; kept open (not confirmed yet)' : ''}`;
  }
  const steps = a.steps || null;
  if (steps && steps.length) {
    const txt = steps.map(st => decisionText({ action: st.type, value: st, refs: a.refs || {} }, ctx)).join('; ');
    const out = outcomeOf(a);
    return steps.length === 1 && out === 'settle' ? txt : `${txt}${out === 'open' ? '; kept open' : out === 'defer' ? '; deferred' : ''}`;
  }
  const v = a.value || {}, refs = a.refs || {};
  const tname = c => refs[c] ? `the new task \u201c${refs[c].title}\u201d` : `${c}${ctx.taskLabel && ctx.taskLabel(c) ? ` \u201c${ctx.taskLabel(c)}\u201d` : ''}`;
  const t = v.task ? tname(v.task) : '';
  const who = id => refs[id] ? refs[id].name : (ctx.partyName && ctx.partyName(id)) || id;
  switch (a.action) {
    case 'create_task': return `Reviewer-created task: \u201c${v.title}\u201d in ${(ctx.projectName && ctx.projectName(v.project)) || v.project}${v.owner ? `, owner ${who(v.owner)}` : ', no owner yet'}`;
    case 'task_note': return `Reviewer note on ${t}: \u201c${v.text}\u201d`;
    case 'assign': return `Reviewer-confirmed assignment: ${who(v.party)} owns ${t}`;
    case 'confirm_owner': return `Reviewer-confirmed assignment: ${who(v.party)} owns ${t}`;
    case 'confirm_status': return `Reviewer-confirmed status change: ${t} is ${STATUS_WORD[v.status] || v.status}`;
    case 'set_date': return `Reviewer-set task date: ${t} is due ${v.date}`;
    case 'add_person': return `Reviewer-added person: ${v.name}${v.org ? ` (${v.org})` : ''}${v.alias ? `; the meeting\u2019s \u201c${v.alias}\u201d refers to this person` : ''}${v.verified ? '' : '. Not yet verified'}`;
    case 'match_person': return `Reviewer-matched reference: the meeting\u2019s \u201c${v.alias}\u201d is ${who(v.party)}`;
    case 'verify_person': return `Reviewer-verified identity: ${who(v.party)}`;
    case 'attach': return `Reviewer placement: attached to ${t || (ctx.projectName && ctx.projectName(v.project)) || v.project}`;
    case 'keep_unassigned': return 'Reviewer decision: keep unassigned';
    case 'reject': return 'Reviewer decision: change rejected';
    case 'not_needed': return 'Reviewer decision: not needed';
    case 'reopen': return 'Reviewer decision: reopened';
    case 'defer': return 'Reviewer decision: deferred';
    default: return 'Reviewer resolution';
  }
}
function basisText(lb) {
  const where = `${lb.meetingTitle || 'meeting'}${lb.meetingDate ? `, ${lb.meetingDate}` : ''}`;
  if (arr(lb.quotes).length) return `${where}: ${arr(lb.quotes).map(q => `${q.seg}: \u201c${String(q.text || '').replace(/\s+/g, ' ')}\u201d`).join(' ')}`;
  if (!lb.quote && !lb.seg) return lb.meetingTitle ? `${lb.meetingTitle}${lb.meetingDate ? `, ${lb.meetingDate}` : ''}` : 'none recorded';
  return `${where}${lb.seg ? `, ${lb.seg}` : ''}: \u201c${String(lb.quote || '').replace(/\s+/g, ' ')}\u201d`;
}
// pending: [{ label:{key, meeting, meetingTitle, meetingDate, seg, kind, name, target, quote}, action, value, note, supersedes, seen }]
// ctx: { by, atText, at, partyName(id), taskLabel(code) }
// Returns the reviewer statements (segments), the reply-shaped ops for compile, and the resolution records.
function buildSave(pending, ctx) {
  const segments = [], ops = [], records = [], opMap = [];
  arr(pending).forEach((a, i) => {
    const sid = 'S' + String(i + 1).padStart(3, '0');
    const refs = {}; arr(a.steps).forEach((st, k) => { if (st.type === 'add_person') refs['@' + k] = { name: st.name }; if (st.type === 'create_task') refs['@' + k] = { title: st.title }; });
    const decision = decisionText({ ...a, refs }, ctx);
    const text = `${decision}. Resolved by: ${ctx.by}, ${ctx.atText}. Meeting basis: ${basisText(a.label)}. Resolution note: ${String(a.note || '').trim()}`;
    segments.push({ id: sid, text });
    const src = [{ seg: sid, quote: text }];
    const steps = a.steps ? a.steps.map(st => ({ ...st })) : STEP_SET.has(a.action) ? [{ type: a.action, ...(a.value || {}) }] : [];
    // A step can name a person or task created by an earlier step of the same decision ("@<step index>").
    const ref = x => { const m = /^@(\d+)$/.exec(String(x || '')); return m && steps[+m[1]] ? steps[+m[1]].ref : x; };
    const changes = [];
    steps.forEach((st, k) => {
      let op = null;
      if (st.type === 'add_person') { st.ref = `NEW-P${i + 1}-${k + 1}`; op = { op: 'NewParty', ref: st.ref, kind: 'person', name: st.name, src }; }
      else if (st.type === 'create_task') { st.ref = `NEW-T${i + 1}-${k + 1}`; op = { op: 'NewTasking', ref: st.ref, project: st.project, label: st.title, src };
        if (st.owner) op.assignee = ref(st.owner); }
      else if (st.type === 'assign' || st.type === 'confirm_owner') op = { op: 'Reassign', tasking: ref(st.task), to: ref(st.party), src };
      else if (st.type === 'confirm_status') op = { op: 'Status', tasking: ref(st.task), status: st.status, src };
      else if (st.type === 'set_date') op = { op: 'Deadline', tasking: ref(st.task), dueDate: st.date, src };
      else if (st.type === 'task_note') op = { op: 'ProgressNote', tasking: ref(st.task), text: `Reviewer note (${ctx.by}): ${st.text}`, src };
      if (op) { ops.push(op); opMap.push({ d: i, k, type: st.type }); changes.push(op.op); }
    });
    const action = a.answer ? 'resolve_note' : steps.length === 0 ? a.action : steps.length === 1 ? steps[0].type : 'decision';
    records.push({ n: i + 1, label: { ...a.label }, action, choice: a.answer ? 'Answer' : steps.length > 1 ? steps.map(st => ACTION[st.type].label).join(' \u00b7 ') : ACTION[action] ? ACTION[action].label : action,
      decision, steps: steps.length ? steps : undefined, outcome: outcomeOf({ action, outcome: a.outcome }),
      value: a.answer ? { answerType: a.answer.type, answer: a.answer.display, answerValue: a.answer.value } : steps.length ? { ...steps[0] } : { ...(a.value || {}) }, note: String(a.note || '').trim(), by: ctx.by, at: ctx.at, supersedes: arr(a.supersedes).slice(),
      statement: sid, change: changes.length ? changes.join(', ') : null, attestation: true });
  });
  return { segments, ops, records, opMap };
}
// Stale check at Save (A2): an action whose label gained or lost a head since it was taken.
function stale(pending, records) {
  const RS = stateOf(records), out = [];
  for (const a of arr(pending)) {
    const st = RS[a.label.key], now = st ? st.heads.map(r => r.id).sort() : [];
    const seen = arr(a.seen).slice().sort();
    if (now.join(',') !== seen.join(',')) out.push({ action: a, heads: st ? st.heads : [] });
  }
  return out;
}

// ---------- The fold: people metadata and aliases from live resolutions ----------
function addEmail(p, email) {
  const e = String(email || '').trim().toLowerCase();
  if (e && !arr(p.emails).includes(e)) p.emails = [...arr(p.emails), e];
}
function applyPeople(S, pkgs) {
  const recs = arr(pkgs).flatMap(p => arr(p.resolutions));
  if (!recs.length) return;
  const RS = stateOf(recs);
  const live = r => { const st = RS[r.label.key]; return st && st.heads.includes(r); };
  recs.slice().sort((a, b) => String(a.at).localeCompare(String(b.at))).forEach(r => stepsOf(r).forEach(v => {
    const type = v.type;
    if (type === 'add_person' && v.partyId && S.parties[v.partyId]) {
      const p = S.parties[v.partyId];
      p.org = v.org || p.org || null;
      p.reviewerAdded = { by: r.by, at: r.at, unverified: !v.verified, alias: v.alias || null, resolution: r.id };
      if (v.alias && !arr(p.aliases).some(x => norm(x) === norm(v.alias))) p.aliases = [...arr(p.aliases), v.alias];
      addEmail(p, v.email);
    }
    if (!live(r)) return;
    if (type === 'match_person' && v.party && S.parties[v.party] && v.alias) {
      const p = S.parties[v.party];
      if (!arr(p.aliases).some(x => norm(x) === norm(v.alias)) && norm(p.name) !== norm(v.alias)) p.aliases = [...arr(p.aliases), v.alias];
    }
    if (type === 'match_person' && v.party && S.parties[v.party]) addEmail(S.parties[v.party], v.email);
    if (type === 'verify_person' && v.party && S.parties[v.party] && S.parties[v.party].reviewerAdded)
      Object.assign(S.parties[v.party].reviewerAdded, { unverified: false, verifiedBy: r.by, verifiedAt: r.at });
  }));
}

const api = { primaryFor, moreFor, attendeeKey, STEPS, stepsOf, outcomeOf, actionLabel, namesIn, FAMILY, ACTION, actionsFor, consequence, keyOf, parseKey, stateOf, attach, checkPerson, refName, buildSave, stale, applyPeople, decisionText, basisText, jaccard };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGResolve = api;
})(typeof window !== 'undefined' ? window : globalThis);
