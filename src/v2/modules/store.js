/* MeetingGraph v2 — packages, IDs and the replay (plan §10.2, §10.3; B8, B12, B16).
   A meeting package holds the meeting, its numbered statements, the request's token and open threads, and the reply's
   items as checked. IDs are minted at Save and never change: PROJECT-KIND-YYMMDD[suffix]-NN, e.g. HP-A-261019-03.
   The board is the replay of every package nothing supersedes, in meeting order. */
(function (root) {
'use strict';
const LETTER = { commitment: 'A', question: 'Q', risk: 'R', decision: 'D' };
const THREAD_KIND = { A: 'action', Q: 'question', R: 'risk', D: 'decision' };
const pad2 = n => String(n).padStart(2, '0');

// The default project code: the initials of the name's words (2-4 letters), unique among the codes already used.
function defaultCode(name, used) {
  const words = String(name).toUpperCase().replace(/[^A-Z ]/g, ' ').split(/\s+/).filter(Boolean);
  let code = words.map(w => w[0]).join('').slice(0, 4);
  if (code.length < 2) code = (words[0] || 'PR').slice(0, 2);
  const taken = new Set(used || []);
  if (!taken.has(code)) return code;
  for (let i = 2; i <= 9; i++) { const c = code.slice(0, 3) + i; if (!taken.has(c)) return c; }
  return code;
}
const validCode = c => /^[A-Z][A-Z0-9]{1,3}$/.test(c);
const displayName = who => { if (!who) return null; const m = /^([^,]+),\s*(.+)$/.exec(who); return m ? `${m[2]} ${m[1]}` : who; };

// The day key: YYMMDD, plus a letter for a second (third...) meeting of the project saved for the same date.
// A meeting can cover several projects, so the key is per project (meeting.dayKeys); a re-save keeps its keys.
const dayKeyOf = (p, code) => p.meeting.dayKeys ? p.meeting.dayKeys[code] : (p.project && p.project.code === code ? p.meeting.dayKey : null);
function dayKeyFor(pkgs, project, meeting, prev) {
  if (prev && dayKeyOf(prev, project.code)) return dayKeyOf(prev, project.code);
  const base = meeting.date.slice(2).replace(/-/g, '');
  const others = pkgs.filter(p => p.kind === 'meeting' && p.meeting.date === meeting.date && p.meeting.id !== meeting.id);
  const used = new Set(others.map(p => dayKeyOf(p, project.code)).filter(Boolean));
  if (!used.has(base)) return base;
  for (const s of 'bcdefghijk') if (!used.has(base + s)) return base + s;
  return base + 'z';
}

/* Mint IDs for the items that start a thread: a commitment, question, risk or decision with no thread. A "to check"
   item gets its ID too, so confirming it later renumbers nothing.
   On a re-save (prev), an item keeps its old ID when it matches by kind and source statement; ties (one statement,
   two items of one kind) go by order within the reply. New items take the next free number; dropped IDs are never reused. */
function mint(items, project, dayKey, prev, dayKeys) {
  // maxNum is keyed CODE:LETTER. A package saved before multi-project meetings has { A: n, ... }: its project's.
  const maxNum = {}, oldCode = (prev && prev.project && prev.project.code) || (project && project.code);
  for (const [k, v] of Object.entries(prev ? prev.minted.maxNum : {})) maxNum[k.includes(':') ? k : `${oldCode}:${k}`] = v;
  // Every ID carries its project (B12), so an item that needs one must have a project (§10.20 J2: the review asks first).
  const codeOf = it => { const c = it.project || (project && project.code); if (!c) throw new Error('an item that needs an ID has no project'); return c; };
  const old = {};
  if (prev) for (const it of prev.items) if (it.id) { const k = it.id.split('-')[0] + '|' + (LETTER[it.kind] || it.id.split('-')[1]) + '|' + it.seg; (old[k] = old[k] || []).push(it.id); }
  const out = items.map(it => Object.assign({}, it));
  const fresh = [];
  for (const it of out) {
    const L = !it.thread && !it.mergedInto && LETTER[it.kind];   // an item "same as" another of this meeting is that item
    if (!L) { it.id = null; continue; }
    const k = codeOf(it) + '|' + L + '|' + it.seg;
    if (old[k] && old[k].length) it.id = old[k].shift(); else fresh.push([it, L]);
  }
  for (const it of out) if (it.id) { const [c, L, , n] = it.id.split('-'); const k = `${c}:${L}`; if (+n > (maxNum[k] || 0)) maxNum[k] = +n; }
  for (const [it, L] of fresh) {
    const c = codeOf(it), k = `${c}:${L}`;
    maxNum[k] = (maxNum[k] || 0) + 1;
    it.id = `${c}-${L}-${(dayKeys && dayKeys[c]) || dayKey}-${pad2(maxNum[k])}`;
  }
  return { items: out, maxNum };
}

/* A meeting package. checked: reply.checkReply's result (its items placed: placeItems); request: { token, kind, openIds };
   projects: the projects the meeting covered, in order (placeItems' covered); project: optional, put first (older callers
   and tests). One package per meeting, whatever projects it covers (§10.20). newProjects: the review's decisions on the
   chat's proposals, kept for the record. */
function meetingPackage({ pkgs, project, projects, meeting, statements, request, checked, savedBy, savedAt, newProjects, aliases, attendance }) {
  const prev = latestFor(pkgs, meeting.id);
  const covered = (project ? [project] : []).concat((projects || []).filter(x => !project || x.code !== project.code));
  const primary = covered[0] || null;
  const dayKeys = {};
  for (const c of covered) dayKeys[c.code] = dayKeyFor(pkgs, c, meeting, prev);
  const dayKey = primary ? dayKeys[primary.code] : meeting.date.slice(2).replace(/-/g, '');
  const { items, maxNum } = mint(checked.items, primary, dayKey, prev, dayKeys);
  const byRef = {}; items.forEach(it => { if (it.ref) byRef[it.ref] = it; });
  for (const it of items) {
    // B8: a "done" (or blocked, in progress) from the chat applies by default, but only when its source checks, unless
    // the PM confirms it; the PM can undo it in the review.
    it.applied = !!(it.thread && it.status && (!it.toCheck || it.statusConfirmed) && !it.statusUndone);
    // A waits-on to another item of this reply points at that item's ID (or its thread).
    if (it.waitsOn && byRef[it.waitsOn]) it.waitsOnId = byRef[it.waitsOn].id || byRef[it.waitsOn].thread || null;
    else it.waitsOnId = it.waitsOn || null;
  }
  const at = savedAt || new Date().toISOString();
  return {
    mkg2: '1.0', kind: 'meeting',
    id: `mkg2-meeting-${primary ? primary.code + '-' : ''}${meeting.id}-${at.replace(/[-:.]/g, '').slice(0, 15)}`,
    savedAt: at, savedBy: savedBy || null, supersedes: prev ? prev.id : null,
    project: primary ? { code: primary.code, name: primary.name } : null,
    projects: covered.map(c => ({ code: c.code, name: c.name })),
    meeting: Object.assign({}, meeting, { dayKey, dayKeys }),
    statements: statements.map(s => ({ id: s.id, t: s.t, speaker: s.speakerName, text: s.text })),
    request: { token: request.token, kind: request.kind, openIds: request.openIds || [] },
    reply: { summary: checked.reply.summary, lastSeg: checked.reply.lastSeg, lastSegOk: checked.lastSegOk, cut: checked.cut, note: checked.note },
    items, minted: { maxNum }, newProjects: newProjects || [], aliases: aliases || [],
    ...(attendance ? { attendance } : {})   // the optional Teams attendance report (UX B1); absent when none was given
  };
}

// Which packages count: drop the superseded; two left for one meeting is a conflict, and the first-saved is used (B16).
// A meeting is one package whatever projects it covers; a seed is one per set of projects and date.
function current(pkgs) {
  const ms = pkgs.filter(p => p && p.mkg2 && (p.kind === 'meeting' || p.kind === 'seed'));
  // A save chosen over a conflict (switchTo) supersedes both saves.
  const superseded = new Set(ms.flatMap(p => [p.supersedes].concat(p.alsoSupersedes || [])).filter(Boolean));
  const groups = {};
  const key = p => p.kind === 'meeting' ? 'm|' + p.meeting.id : 's|' + p.project.code + '|' + p.meeting.id;
  for (const p of ms) if (!superseded.has(p.id)) (groups[key(p)] = groups[key(p)] || []).push(p);
  const used = [], conflicts = [];
  for (const g of Object.values(groups)) {
    g.sort((a, b) => (a.savedAt < b.savedAt ? -1 : a.savedAt > b.savedAt ? 1 : a.id < b.id ? -1 : 1));
    used.push(g[0]);
    if (g.length > 1) conflicts.push({ meeting: g[0].meeting.id, project: g[0].project ? g[0].project.code : null, used: g[0].id, others: g.slice(1).map(p => p.id) });
  }
  used.sort((a, b) => (a.meeting.id < b.meeting.id ? -1 : a.meeting.id > b.meeting.id ? 1 : a.savedAt < b.savedAt ? -1 : 1));
  return { used, conflicts };
}
function latestFor(pkgs, meetingId) {
  const { used } = current(pkgs);
  return used.find(p => p.kind === 'meeting' && p.meeting.id === meetingId) || null;
}

/* The replay: threads, in meeting order, with the board decisions (B9) at the time they were saved. upTo: replay only
   what happened strictly before this meeting ID (for a request, and for the email's "not discussed").
   Returns { threads (Map), order, unlinked, conflicts, meetings, boardEvents }. Each thread keeps its status history
   (statusStack: Undo steps back one), when it was last mentioned or raised, and whether it is parked (B11). */
const PARK_AFTER = 3;
const timeKey = iso => String(iso).replace(/[-:]/g, '').replace(/\.\d+/, '').replace(/Z$/, '').slice(0, 15) + 'Z';   // as a meeting ID
function boardPkgs(pkgs) {
  const sup = new Set(pkgs.filter(p => p && p.mkg2).map(p => p.supersedes).filter(Boolean));
  return pkgs.filter(p => p && p.mkg2 && p.kind === 'board' && !sup.has(p.id));
}
const covers = (m, code) => (m.projects && m.projects.length ? m.projects : [m.project]).some(x => x && x.code === code);
function replay(pkgs, { upTo } = {}) {
  const { used, conflicts } = current(pkgs);
  const threads = new Map(), order = [], unlinked = [], meetings = [], boardEvents = [], closedProjects = new Map();
  // A board decision applies when it was saved, but never before the last meeting on the board when it was made (after):
  // a clock behind the meeting dates must not put a decision ahead of the items it is about.
  const bkey = p => (p.after && p.after > timeKey(p.savedAt) ? p.after : timeKey(p.savedAt));
  const events = used.map(p => ({ key: p.meeting.id, p })).concat(boardPkgs(pkgs).map(p => ({ key: bkey(p), p, board: true })));
  events.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : (a.board ? 1 : 0) - (b.board ? 1 : 0) || (a.board && b.board ? (a.p.savedAt < b.p.savedAt ? -1 : a.p.id < b.p.id ? -1 : 1) : 0)));
  for (const e of events) {
    if (upTo && e.key >= upTo) continue;
    const p = e.p;
    if (e.board) { if (p.project && /_project$/.test(p.action)) applyProject(p, e.key, threads, boardEvents, closedProjects); else applyBoard(p, e.key, threads, unlinked, boardEvents); continue; }
    meetings.push(p);
    for (const it of p.items) {
      if (it.id) {
        const seg1 = it.id.split('-')[1];
        const L = THREAD_KIND[seg1] ? seg1 : LETTER[it.kind];    // B12 IDs carry the kind; older test fixtures (AI-101) do not
        const status = L === 'D' ? 'decided' : (p.kind === 'seed' && it.status) ? it.status : 'open';
        const t = { id: it.id, kind: THREAD_KIND[L] || 'action', project: it.project || (p.project && p.project.code),
                    owner: it.person !== undefined ? it.person : displayName(it.who), what: it.what, due: it.due, dueDate: it.dueDate || null,
                    topic: it.topic || '', seg: it.seg || null, importance: it.importance === 'high' ? 'high' : 'normal', status, statusStack: [status], waitsOn: it.waitsOnId || null,
                    created: p.meeting.id, mentions: [p.meeting.id], lastTouch: p.meeting.id, raised: null, settledOutside: null,
                    history: [{ meeting: p.meeting.id, item: it.n, event: 'created' }], toCheck: !!it.toCheck };
        threads.set(it.id, t); order.push(it.id);
        const rel = it.relatedTo && threads.get(it.relatedTo);   // new work about an open item: a mention of that item
        if (rel) {
          t.relatedTo = rel.id;
          if (!rel.mentions.includes(p.meeting.id)) rel.mentions.push(p.meeting.id);
          rel.lastTouch = p.meeting.id; if (rel.raised && p.meeting.id > rel.raised.key) rel.raised = null;
          rel.history.push({ meeting: p.meeting.id, item: it.n, event: 'related', what: it.what, related: it.id });
        }
      } else if (it.thread) {
        const t = threads.get(it.thread);
        if (!t) { unlinked.push({ meeting: p.meeting.id, item: it.n, thread: it.thread, what: it.what }); continue; }
        if (!t.mentions.includes(p.meeting.id)) t.mentions.push(p.meeting.id);
        t.lastTouch = p.meeting.id;
        if (t.raised && p.meeting.id > t.raised.key) t.raised = null;   // the meeting it was raised for has discussed it
        t.history.push({ meeting: p.meeting.id, item: it.n, event: it.applied ? it.status : 'update', what: it.what, byReview: !!it.byReview });
        if (it.applied && t.kind !== 'decision') { t.status = it.status; t.statusStack.push(it.status); if (it.status !== 'done') t.settledOutside = null; }
        if (it.waitsOnId) t.waitsOn = it.waitsOnId;
      }
    }
  }
  // Parking (B11): an open thread that no meeting of its project has mentioned in its last 3 meetings leaves the request.
  for (const t of threads.values()) {
    t.quiet = 0; t.parked = false;
    if (t.kind === 'decision' || ['done', 'not_needed'].includes(t.status)) continue;
    const touch = t.raised && t.raised.key > t.lastTouch ? t.raised.key : t.lastTouch;
    t.quiet = meetings.filter(m => m.kind === 'meeting' && m.meeting.id > touch && covers(m, t.project)).length;
    t.parked = !t.raised && t.quiet >= PARK_AFTER;
  }
  return { threads, order, unlinked, conflicts, meetings, boardEvents, closedProjects };
}

/* Closing a project (Aaron, 2026-10-16, the PM's ask): a board decision with a note, recorded as the PM's. Every open
   action, question and risk of the project becomes Not needed, marked as closed with the project; decisions stay in effect.
   Reopening puts each of those items back to the status it had, and takes the project off the closed list. Nothing is
   deleted: the close and the reopen are both in each item's history. */
function applyProject(p, key, threads, boardEvents, closedProjects) {
  const code = p.project;
  if (p.action === 'close_project') {
    if (closedProjects.has(code)) return;
    const ids = [];
    for (const t of threads.values()) {
      if (t.project !== code || t.kind === 'decision' || isClosed(t)) continue;
      t.status = 'not_needed'; t.statusStack.push('not_needed'); t.closedWithProject = { by: p.savedBy, note: p.note, at: p.savedAt, board: p.id };
      t.history.push({ board: p.id, event: 'close_project', by: p.savedBy, note: p.note, at: p.savedAt });
      ids.push(t.id);
    }
    closedProjects.set(code, { by: p.savedBy, note: p.note, at: p.savedAt, key, board: p.id, ids });
  } else if (p.action === 'reopen_project') {
    const c = closedProjects.get(code); if (!c) return;
    for (const id of c.ids) {
      const t = threads.get(id);
      if (!t || !t.closedWithProject || t.closedWithProject.board !== c.board || t.status !== 'not_needed') continue;
      t.statusStack.pop(); t.status = t.statusStack[t.statusStack.length - 1]; t.closedWithProject = null;
      t.history.push({ board: p.id, event: 'reopen_project', by: p.savedBy, note: p.note, at: p.savedAt });
    }
    closedProjects.delete(code);
  } else return;
  boardEvents.push({ key, thread: null, project: code, action: p.action, by: p.savedBy, note: p.note, at: p.savedAt, what: null });
}

/* The four board decisions (B9, §10.9), each a board package with the PM's name and a note, recorded as the PM's decision
   and never as meeting evidence (A1). Undo steps a status back; Not needed and Settled outside a meeting set one;
   Raise puts the thread at the top of the next request (Lower takes it back). None creates a thread, edits what one
   says, changes an owner or sets a date. */
function applyBoard(p, key, threads, unlinked, boardEvents) {
  for (const id of p.threads || []) {
    const t = threads.get(id);
    if (!t) { unlinked.push({ board: p.id, thread: id, action: p.action }); continue; }
    if (p.action === 'undo') {
      if (t.statusStack.length < 2) continue;
      t.statusStack.pop(); t.status = t.statusStack[t.statusStack.length - 1];
      if (t.status !== 'done') t.settledOutside = null;
    } else if (p.action === 'not_needed' || p.action === 'settled') {
      t.status = p.action === 'settled' ? 'done' : 'not_needed'; t.statusStack.push(t.status);
      t.settledOutside = p.action === 'settled' ? { by: p.savedBy, note: p.note, at: p.savedAt } : null;
    } else if (p.action === 'raise') t.raised = { by: p.savedBy, note: p.note, at: p.savedAt, key };
    else if (p.action === 'lower') t.raised = null;
    else continue;
    t.history.push({ board: p.id, event: p.action, by: p.savedBy, note: p.note, at: p.savedAt });
    boardEvents.push({ key, thread: id, action: p.action, by: p.savedBy, note: p.note, at: p.savedAt, project: t.project, what: t.what });
  }
}
const DECISIONS = { undo: 'Restore the earlier status', not_needed: 'Mark as not needed', settled: 'Mark completed', raise: 'Bring back into discussion', lower: 'Stop bringing it back',
  close_project: 'Close the project', reopen_project: 'Reopen the project' };
const isClosed = t => ['done', 'not_needed'].includes(t.status);
// A board decision checked against the board: { pkg } or { error } in plain words.
function boardDecision({ board, action, ids, note, savedBy, savedAt }) {
  if (!DECISIONS[action]) return { error: 'That is not one of the board decisions.' };
  if (!ids || !ids.length) return { error: 'Choose the item this decision is about.' };
  if (!String(note || '').trim()) return { error: 'Add a note: it is kept with the decision.' };
  if (!String(savedBy || '').trim()) return { error: 'Add your name: it is recorded with the decision.' };
  const errors = [];
  for (const id of ids) {
    const t = board.threads.get(id);
    if (!t) errors.push(`${id} is not on the board.`);
    else if (t.kind === 'decision') errors.push(`${id} is a decision: the board does not change decisions.`);
    else if (board.closedProjects && board.closedProjects.has(t.project)) errors.push(`${id} is in a closed project: reopen the project to change its items.`);
    else if (action === 'undo' && t.statusStack.length < 2) errors.push(`${id} has no status change to undo.`);
    else if ((action === 'not_needed' || action === 'settled') && isClosed(t)) errors.push(`${id} is already ${t.status === 'done' ? 'done' : 'not needed'}.`);
    else if (action === 'raise' && (t.raised || isClosed(t))) errors.push(t.raised ? `${id} is already raised.` : `${id} is closed; undo it first.`);
    else if (action === 'lower' && !t.raised) errors.push(`${id} is not raised.`);
  }
  if (errors.length) return { error: errors.join(' ') };
  const at = savedAt || new Date().toISOString();
  return { pkg: { mkg2: '1.0', kind: 'board', id: `mkg2-board-${action}-${ids[0]}-${at.replace(/[-:.]/g, '').slice(0, 15)}`, savedAt: at,
                  savedBy: String(savedBy).trim(), supersedes: null, action, threads: ids.slice(), note: String(note).trim(),
                  after: board.meetings.length ? board.meetings[board.meetings.length - 1].meeting.id : null } };
}

// Closing or reopening a project (see applyProject): { pkg } or { error }.
function projectDecision({ board, action, project, note, savedBy, savedAt }) {
  if (action !== 'close_project' && action !== 'reopen_project') return { error: 'That is not a project decision.' };
  if (!String(note || '').trim()) return { error: 'Add a note: it is kept with the decision.' };
  if (!String(savedBy || '').trim()) return { error: 'Add your name: it is recorded with the decision.' };
  const known = [...board.threads.values()].some(t => t.project === project) || board.meetings.some(m => covers(m, project));
  if (!known) return { error: `${project} is not a project on the board.` };
  if (action === 'close_project' && board.closedProjects.has(project)) return { error: 'This project is already closed.' };
  if (action === 'reopen_project' && !board.closedProjects.has(project)) return { error: 'This project is not closed.' };
  const at = savedAt || new Date().toISOString();
  return { pkg: { mkg2: '1.0', kind: 'board', id: `mkg2-board-${action}-${project}-${at.replace(/[-:.]/g, '').slice(0, 15)}`, savedAt: at,
                  savedBy: String(savedBy).trim(), supersedes: null, action, project, threads: [], note: String(note).trim(),
                  after: board.meetings.length ? board.meetings[board.meetings.length - 1].meeting.id : null } };
}

/* Two saves of one meeting (B16): the board uses the first-saved; the PM can switch to the other. The switch is a new
   copy of the other save that supersedes both, so the choice is itself in the history (A2). */
function switchTo(pkgs, conflict, otherId, savedBy, savedAt) {
  const other = pkgs.find(p => p.id === otherId);
  if (!other || !conflict.others.includes(otherId)) return { error: 'That save is not part of this conflict.' };
  const at = savedAt || new Date().toISOString();
  return { pkg: Object.assign(JSON.parse(JSON.stringify(other)), { id: `${other.id}-chosen-${at.replace(/[-:.]/g, '').slice(0, 15)}`, savedAt: at, savedBy: savedBy || null,
    supersedes: conflict.used, alsoSupersedes: [otherId] }) };
}

// The open threads for a request: everything not done, not needed or parked; raised threads first (B9), then by kind
// (actions, questions, risks, decisions), then age.
const KIND_ORDER = { action: 0, question: 1, risk: 2, decision: 3 };
function openThreads(board, codes) {
  const want = new Set(codes);
  return board.order.map(id => board.threads.get(id))
    .filter(t => want.has(t.project) && !isClosed(t) && !t.parked && !(board.closedProjects && board.closedProjects.has(t.project)))
    .map((t, i) => [t, i]).sort((a, b) => ((b[0].raised ? 1 : 0) - (a[0].raised ? 1 : 0)) || (KIND_ORDER[a[0].kind] - KIND_ORDER[b[0].kind]) || (a[1] - b[1])).map(x => x[0]);
}

/* The review's projects (§10.20). items: the checked items, each new one with the chat's project (.project, a listed
   code), the ref of a proposed project (.projectRef), or neither ("not clear"), and the PM's choice if any (.pick: a
   code, 'J:<ref>', or '' for not clear). proposals: the chat's (and the PM's) new projects with the review's decision:
   action 'add' (with code and name), 'same' (sameAs: a listed code) or 'no'. known: the board's projects.
   Returns the items placed, the projects covered in order, the items that need a project before Save (J2: an ID carries
   its project), and any problem with a new project's code. An item on a thread takes the thread's project. */
/* What an item may continue (Aaron's real run, 2026-10-15). A commitment continues only an action, and a decision only a
   decision: a commitment the chat attached to a risk, question or decision is new work about it, and a decision attached
   to an action or question is a new decision about it. Either is minted as new (relatedTo: the item it was attached to);
   a status the chat gave still applies to that item, as an update. A decision is settled when it is made, so a status on
   a decision is never applied (it had dropped settled decisions from the next request). */
function fitThreads(items, board) {
  const out = [];
  let n = Math.max(0, ...items.map(x => x.n || 0));
  for (const it of items) {
    const t = it.thread && board && board.threads.get(it.thread);
    if (!t || it.mergedInto) { out.push(it); continue; }
    const o = Object.assign({}, it);
    if (t.kind === 'decision' && o.status) { o.notes = (o.notes || []).concat('a decision is settled when it is made: the status is not applied'); o.status = null; }
    const asNew = (o.kind === 'commitment' && t.kind !== 'action') || (o.kind === 'decision' && t.kind !== 'decision');
    if (!asNew) { out.push(o); continue; }
    out.push(Object.assign(o, { thread: null, status: null, relatedTo: t.id, project: o.project || t.project,
      notes: (o.notes || []).concat(`new ${o.kind === 'decision' ? 'decision' : 'action'} about ${t.id}`) }));
    if (it.status && t.kind !== 'decision') out.push({ n: ++n, ref: null, kind: 'update', topic: it.topic || '', who: it.who || null, person: it.person, what: it.what,
      due: null, dueDate: null, importance: it.importance || 'normal', thread: t.id, status: it.status, waitsOn: null, seg: it.seg, citedSeg: it.citedSeg || it.seg,
      words: it.words, src: it.src, toCheck: it.toCheck, statusUndone: it.statusUndone, statusConfirmed: it.statusConfirmed, notes: [`the status of ${t.id}, from item ${it.n}`],
      whoIsSpeaker: it.whoIsSpeaker !== false, statusOf: it.n });
  }
  return out;
}

function placeItems({ items, proposals, known, board }) {
  items = fitThreads(items, board);
  const errors = [], codes = new Set((known || []).map(p => p.code)), refCode = {}, added = [];
  for (const p of proposals || []) {
    refCode[p.ref] = null;
    if (p.action === 'add') {
      const code = String(p.code || '').trim().toUpperCase(), name = String(p.name || '').trim();
      if (!name) { errors.push(`The new project ${p.ref} needs a name.`); continue; }
      if (!validCode(code)) { errors.push(`The code for ${name} must be 2 to 4 letters or digits, starting with a letter.`); continue; }
      if (codes.has(code)) { errors.push(`The code ${code} is already used by another project.`); continue; }
      codes.add(code); refCode[p.ref] = code; added.push({ ref: p.ref, code, name });
    } else if (p.action === 'same' && (known || []).some(k => k.code === p.sameAs)) refCode[p.ref] = p.sameAs;
  }
  const out = items.map(it => {
    const o = Object.assign({}, it);
    delete o.pick;
    if (o.thread) return o;
    const chatV = o.project || (o.projectRef ? 'J:' + o.projectRef : '');
    const v = it.pick !== undefined ? it.pick : chatV;
    const code = v.startsWith('J:') ? refCode[v.slice(2)] || null : (codes.has(v) ? v : null);
    if (code) o.project = code; else delete o.project;
    o.movedByPM = it.pick !== undefined && chatV !== '' && it.pick !== chatV;
    o.placedByPM = it.pick !== undefined && chatV === '' && !!code;
    return o;
  });
  const need = out.filter(o => !o.thread && !o.mergedInto && LETTER[o.kind] && !o.project);
  const order = [], push = c => { if (c && !order.includes(c)) order.push(c); };
  for (const o of out) {
    if (o.thread) { if (!o.toCheck) { const t = board && board.threads.get(o.thread); push(t && t.project); } }
    else if (!o.mergedInto) push(o.project);
  }
  for (const a of added) push(a.code);
  const nameOf = c => ((known || []).find(k => k.code === c) || added.find(a => a.code === c) || {}).name || c;
  return { items: out, covered: order.map(c => ({ code: c, name: nameOf(c) })), need, errors, added, refCode };
}

/* §10.3: an earlier meeting imported after a later one. The later meeting's request never listed the earlier one's
   threads, so the same work can appear twice; nothing merges it automatically (B5). The later meetings of the same
   projects, for the page to name ("Same as…" in their "Review this meeting again" is the fix). */
function laterMeetings(pkgs, pkg) {
  const codes = new Set((pkg.projects || [pkg.project]).filter(Boolean).map(x => x.code));
  return current(pkgs).used.filter(p => p.kind === 'meeting' && p.id !== pkg.id && p.meeting.id > pkg.meeting.id &&
    (p.projects || [p.project]).some(x => x && codes.has(x.code)));
}

/* The IDs this save gives that a later meeting's request should have listed and didn't, per later meeting: open on the
   board just before that meeting, yet not in its request, so that meeting could not update or close them. On a first
   save of an earlier meeting that is its open items; on a re-save, only the new ones (Aaron's run, 2026-10-16: five
   recovered kickoff actions stayed open though the next meeting finished them). */
function unseenLater(pkgs, pkg) {
  const ids = new Set(pkg.items.filter(x => x.id && !x.statusOf).map(x => x.id));
  return laterMeetings(pkgs, pkg).map(m => {
    const listed = new Set((m.request && m.request.openIds) || []);
    const codes = (m.projects || [m.project]).filter(Boolean).map(x => x.code);
    const open = openThreads(replay(pkgs, { upTo: m.meeting.id }), codes).map(t => t.id);
    return { meeting: m.meeting, items: open.filter(id => ids.has(id) && !listed.has(id)) };
  }).filter(x => x.items.length);
}

function projectsOf(pkgs) {
  const m = new Map();
  for (const p of current(pkgs).used) for (const x of (p.projects || [p.project])) if (x && !m.has(x.code)) m.set(x.code, x.name);
  return [...m].map(([code, name]) => ({ code, name }));
}

const api = { defaultCode, validCode, displayName, meetingPackage, current, replay, openThreads, mint, dayKeyFor, projectsOf, placeItems,
  boardDecision, projectDecision, switchTo, laterMeetings, unseenLater, fitThreads, DECISIONS, PARK_AFTER, timeKey, LETTER };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_store = api;
})(this);
