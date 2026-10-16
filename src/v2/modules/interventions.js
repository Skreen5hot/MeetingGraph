/* MeetingGraph v2 — the intervention dashboard (Aaron, 2026-10-16). What to ask, of whom, and why now: each open item
   the board already flags becomes one question from a fixed template (no LLM), with its evidence and how long it has
   held. Everything is computed from the saved records, as of the chosen meeting: dates are that meeting's date, and
   "how long" counts the project's meetings up to it. Nothing here records anything.
   Two sections: "Ask in the next meeting" (routine follow-up) and "Possible management intervention" (only where the
   records show something significant: a problem that has held for several meetings, or one others are waiting on).
   A repeated mention is a follow-up question, never a finding; a large number of actions is a capacity conversation. */
(function (root) {
'use strict';
const node = typeof module !== 'undefined' && module.exports;
const S = node ? require('./store.js') : root.MKG2_store;
const D = node ? require('./dates.js') : root.MKG2_dates;

const CLOSED = ['done', 'not_needed', 'decided'];
const isOpen = t => !CLOSED.includes(t.status);
const covers = (m, code) => (m.projects && m.projects.length ? m.projects : [m.project]).some(x => x && x.code === code);
const fmt = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const days = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 86400000);
const q = s => `“${s}”`;
// The thresholds, in one place.
const T = { stuckMentions: 2, questionMeetings: 2, quietDays: 14, capacityOpen: 6, capacityLate: 3, escalateMeetings: 3, chainMeetings: 2 };
// Strength: each item is shown once, under its strongest condition; the others stay in its detail.
const RANK = { waits_done: 90, blocked: 80, no_owner: 75, waited_on_late: 72, overdue: 70, question_open: 55, risk_no_action: 52, stuck: 50, vague_date: 40, parked: 35, to_check: 30 };

/* pkgs: every package; board: the board as of the chosen meeting (the page's boardAsOf().b); cur: that meeting's
   package; date: its date. Returns { since, followUp, escalate, people, projects }. */
function compute(pkgs, { board, cur, date }) {
  const used = S.current(pkgs).used;
  const upToCur = used.slice(0, used.indexOf(cur) + 1);
  // The board right after each meeting up to "as of" (the as-of board itself for the chosen meeting), cached.
  const snaps = new Map();
  const after = m => {
    if (m === cur) return board;
    if (!snaps.has(m.id)) { const nx = used[used.indexOf(m) + 1]; snaps.set(m.id, S.replay(pkgs, nx ? { upTo: nx.meeting.id } : {})); }
    return snaps.get(m.id);
  };
  const meetingsOf = code => upToCur.filter(m => m.kind === 'meeting' && covers(m, code));
  // How many of the project's meetings in a row, back from the latest one up to "as of", the condition has held.
  const held = (t, test) => {
    let n = 0;
    for (const m of meetingsOf(t.project).reverse()) {
      const x = after(m).threads.get(t.id);
      if (!x || !test(x, after(m), m === cur ? date : m.meeting.date)) break;
      n++;
    }
    return n;
  };
  const ts = board.order.map(id => board.threads.get(id)), open = ts.filter(isOpen);
  const late = (t, d) => t.kind === 'action' && isOpen(t) && D.daysLate(t.dueDate, d) > 0;
  const blocked = t => t.status === 'blocked';
  const dueW = t => t.due ? (t.dueDate ? `due ${fmt(t.dueDate)} (${q(t.due)})` : `due ${q(t.due)}`) : 'no due date';
  const meetingsSince = t => meetingsOf(t.project).filter(m => m.meeting.id > t.created).length;
  const lastDiscussed = t => { const m = meetingsOf(t.project).filter(m => t.mentions.includes(m.meeting.id)).pop(); return m ? `last discussed ${fmt(m.meeting.date)}` : 'not discussed in a meeting yet'; };
  const waitersOf = id => open.filter(x => x.waitsOn === id);

  const rows = [];
  for (const t of open) {
    if (t.kind === 'decision') continue;
    const rs = [];   // { code, question, ask, evidence }
    const owner = t.owner || null, askOwner = owner || 'the PM';
    const dep = t.waitsOn ? board.threads.get(t.waitsOn) : null;
    if (t.kind === 'action') {
      if (dep && !isOpen(dep)) rs.push({ code: 'waits_done', ask: askOwner, question: `${q(dep.what)} (${dep.id}), which ${q(t.what)} was waiting on, is ${dep.status === 'done' ? 'done' : 'marked not needed'}. Can it move now?`, evidence: `waiting on ${dep.id}, now ${dep.status === 'done' ? 'done' : 'not needed'}` });
      if (blocked(t)) rs.push({ code: 'blocked', ask: askOwner, question: `What would unblock ${q(t.what)}, and who owns that?`, evidence: 'blocked' + (dep ? `, waiting on ${dep.id}` : '') });
      const L = D.daysLate(t.dueDate, date);
      if (L > 0) rs.push({ code: 'overdue', ask: askOwner, question: `Is ${q(t.what)} still happening, and what is the new date?`, evidence: `${dueW(t)}, ${L} day${L === 1 ? '' : 's'} overdue as of ${fmt(date)}` });
      if (!owner) rs.push({ code: 'no_owner', ask: 'the PM', question: `Who owns ${q(t.what)}?`, evidence: 'no owner named' });
      if (t.importance === 'high' && t.due && !t.dueDate) rs.push({ code: 'vague_date', ask: askOwner, question: `What is the actual date for ${q(t.what)}? It was said as ${q(t.due)}.`, evidence: `important, ${dueW(t)}` });
    }
    // Others are waiting on this item while it is late or blocked: the question goes to its owner.
    const ws = waitersOf(t.id);
    if (ws.length && (late(t, date) || blocked(t))) rs.push({ code: 'waited_on_late', ask: askOwner,
      question: `${ws.map(w => `${w.owner || 'An unowned item'} (${w.id})`).join(', ')} ${ws.length === 1 ? 'is' : 'are'} waiting on ${q(t.what)}, which is ${blocked(t) ? 'blocked' : 'overdue'}. When will it be done?`,
      evidence: `${ws.length} item${ws.length === 1 ? '' : 's'} wait on it` });
    // Mentioned again without a change of status: a follow-up question, not a finding.
    const since = t.mentions.filter(id => id > t.created).length;
    if (t.kind !== 'question' && since >= T.stuckMentions && t.statusStack.length === 1) rs.push({ code: 'stuck', ask: askOwner,
      question: `${q(t.what)} has come up in ${since} meetings since it was raised, with no change of status recorded. Where does it stand, and is anything needed?`,
      evidence: `mentioned in ${since} later meetings; status ${t.status}` });
    if (t.kind === 'question' && meetingsSince(t) >= T.questionMeetings) rs.push({ code: 'question_open', ask: owner || 'the PM',
      question: `Who decides ${q(t.what)}, and by when?`, evidence: `open through ${meetingsSince(t)} meetings since it was raised` });
    // A risk with nothing on the board addressing it: no action made about it, none sharing its topic. Only then.
    if (t.kind === 'risk') {
      const topic = String(t.topic || '').trim().toLowerCase();
      const linked = ts.some(x => x.kind === 'action' && x.project === t.project && (x.relatedTo === t.id || (topic && String(x.topic || '').trim().toLowerCase() === topic)));
      if (!linked) rs.push({ code: 'risk_no_action', ask: owner || 'the PM', question: `Is anyone acting on the risk ${q(t.what)}? What is the mitigation, and who owns it?`, evidence: 'no action on the board is linked to it or shares its topic' });
    }
    if (t.parked) rs.push({ code: 'parked', ask: 'the PM', question: `${q(t.what)} hasn't come up in ${t.quiet} meetings. Is it still needed? Bring it back into discussion, or mark it not needed.`, evidence: `parked: not discussed in ${t.quiet} meetings` });
    if (t.toCheck) rs.push({ code: 'to_check', ask: 'the PM', question: `Check the source of ${q(t.what)}: its words were not found where the chat cited them.`, evidence: 'source to check' });
    if (!rs.length) continue;
    rs.sort((a, b) => RANK[b.code] - RANK[a.code]);
    const top = rs[0];
    // How long the strongest condition has held, in the project's meetings (as of each meeting's own date).
    const test = { overdue: (x, B, d) => late(x, d), blocked: x => blocked(x), no_owner: x => !x.owner,
      waited_on_late: (x, B, d) => (late(x, d) || blocked(x)) && B.order.some(id => { const w = B.threads.get(id); return w.waitsOn === x.id && isOpen(w); }) }[top.code];
    const age = test ? held(t, test) : null;
    // Possible management intervention: only where the records show something significant.
    let esc = null;
    if ((top.code === 'overdue' || top.code === 'blocked') && age >= T.escalateMeetings) esc = `${top.code === 'overdue' ? 'Overdue' : 'Blocked'} at each of the last ${age} meetings of the project.`;
    else if (top.code === 'waited_on_late' && age >= T.chainMeetings) esc = `Others have been waiting on it, while it was late or blocked, for ${age} meetings.`;
    else if (top.code === 'no_owner' && (t.importance === 'high' || ws.length)) esc = `No owner, and ${ws.length ? 'other work waits on it' : 'it is marked important'}.`;
    rows.push({ id: t.id, project: t.project, kind: t.kind, what: t.what, owner, ask: top.ask, code: top.code, question: top.question,
      evidence: [top.evidence, lastDiscussed(t)].concat(rs.slice(1).map(r => 'also: ' + r.evidence)), also: rs.slice(1).map(r => r.code),
      age, isNew: age === 1, escalation: esc, rank: RANK[top.code] });
  }

  // People: a capacity conversation, never a finding of overload.
  const people = [];
  const byOwner = {};
  for (const t of open) if (t.kind === 'action' && t.owner) (byOwner[t.owner] = byOwner[t.owner] || []).push(t);
  for (const [o, xs] of Object.entries(byOwner)) {
    const lt = xs.filter(t => late(t, date));
    if (xs.length >= T.capacityOpen || lt.length >= T.capacityLate) people.push({ person: o, ids: xs.map(t => t.id), open: xs.length, late: lt.length,
      question: `${xs.length} open actions are with you${lt.length ? ` (${lt.length} overdue)` : ''}. Is the load manageable, or should some move?` });
  }
  // Projects no meeting has discussed for a while, as of the chosen date.
  const projects = [];
  for (const p of S.projectsOf(pkgs)) {
    if (board.closedProjects && board.closedProjects.has(p.code)) continue;   // a closed project needs no meeting
    const ms = meetingsOf(p.code), last = ms[ms.length - 1];
    if (!last) { if (open.some(t => t.project === p.code)) projects.push({ code: p.code, name: p.name, question: `${p.name} has open items but no meeting yet. When does it first meet?`, evidence: 'not discussed in a meeting yet' }); continue; }
    const d = days(last.meeting.date, date);
    if (d > T.quietDays) projects.push({ code: p.code, name: p.name, question: `When does ${p.name} next meet?`, evidence: `last meeting ${fmt(last.meeting.date)}, ${d} days before ${fmt(date)}` });
  }

  rows.sort((a, b) => b.rank - a.rank || (b.age || 0) - (a.age || 0));
  return { since: sinceLast(pkgs, { board, cur, date, used }), followUp: rows.filter(r => !r.escalation), escalate: rows.filter(r => r.escalation), people, projects };
}

/* "Since the previous meeting": the board just before the chosen meeting against the board as of it. Counts with their
   IDs: completed (or marked not needed), new commitments, newly blocked, unblocked, newly overdue. */
function sinceLast(pkgs, { board, cur, date, used }) {
  const i = used.indexOf(cur), prev = used.slice(0, i).reverse().find(m => m.kind === 'meeting' || m.kind === 'seed');
  if (!prev || cur.kind !== 'meeting') return null;
  const before = S.replay(pkgs, { upTo: cur.meeting.id }), pd = prev.meeting.date;
  const ids = f => board.order.filter(id => f(board.threads.get(id), before.threads.get(id)));
  const lateAt = (t, d) => t && t.kind === 'action' && isOpen(t) && D.daysLate(t.dueDate, d) > 0;
  return { previous: { title: prev.meeting.title, date: pd },
    completed: ids((t, b) => b && isOpen(b) && ['done', 'not_needed'].includes(t.status)),
    newActions: ids((t, b) => !b && t.kind === 'action'),
    newDecisions: ids((t, b) => !b && t.kind === 'decision'),
    newlyBlocked: ids((t, b) => t.status === 'blocked' && (!b || b.status !== 'blocked')),
    unblocked: ids((t, b) => b && b.status === 'blocked' && t.status !== 'blocked'),
    newlyOverdue: ids((t, b) => lateAt(t, date) && !lateAt(b, pd)) };
}

/* "Copy these questions": the questions shown, grouped by section and person, each with its item and evidence, so they
   read outside the app. */
function copyText(r, { asOf, title, projectName }) {
  const out = [`Questions from MeetingGraph, as of ${asOf} (${title})`, ''];
  const group = (head, rows) => {
    if (!rows.length) return;
    out.push(head, '');
    const by = {}; rows.forEach(x => (by[x.ask] = by[x.ask] || []).push(x));
    for (const [who, xs] of Object.entries(by)) {
      out.push(`Ask ${who}:`);
      for (const x of xs) out.push(`- ${x.question} [${x.id}${projectName ? ', ' + projectName(x.project) : ''}; ${x.evidence[0]}]` + (x.escalation ? ` Why it may need intervention: ${x.escalation}` : ''));
      out.push('');
    }
  };
  group('Possible management intervention', r.escalate);
  group('Ask in the next meeting', r.followUp);
  if (r.people.length) { out.push('Capacity conversations', ''); for (const p of r.people) out.push(`- Ask ${p.person}: ${p.question} [${p.ids.join(', ')}]`); out.push(''); }
  if (r.projects.length) { out.push('Projects', ''); for (const p of r.projects) out.push(`- Ask the PM: ${p.question} [${p.evidence}]`); out.push(''); }
  if (out.length === 2) out.push('Nothing to ask: no open item needs a question.');
  return out.join('\n').replace(/\n+$/, '') + '\n';
}

const api = { compute, sinceLast, copyText, THRESHOLDS: T, RANK };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_interventions = api;
})(this);
