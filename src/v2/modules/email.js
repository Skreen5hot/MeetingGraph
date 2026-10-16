/* MeetingGraph v2 — the meeting email, in the PM's seven sections (plan §4.4; the format of
   tests/v2-feasibility/render_reports.py, which the PM approved). Built from one meeting package and the board before it.
   Only items whose source checks are used; "to check" items are listed at the end for the PM, never as content. */
(function (root) {
'use strict';
const S = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.MKG2_store;
const name = S.displayName;
const longDate = d => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
const timing = it => it.due ? `Timing: “${it.due}”.` : 'No due date stated.';
const STATUS = { done: 'Done', blocked: 'Blocked', in_progress: 'In progress', open: 'Open', decided: 'Decided', not_needed: 'Not needed' };
// The owner as a person (B10: the review's answer, or the board's), else the speaker label turned round.
const ownerOf = it => it.person !== undefined ? it.person : name(it.who);
// A board decision (B9) in words: always the PM's, never a meeting result.
const decisionWords = e => ({ settled: `marked completed by ${e.by}`, not_needed: `marked as not needed by ${e.by}`, undo: `earlier status restored by ${e.by}`,
  raise: `brought back into discussion by ${e.by}`, lower: `no longer brought back (${e.by})`,
  close_project: `project closed by ${e.by}, with its open items`, reopen_project: `project reopened by ${e.by}` }[e.action] + (e.note ? `: ${e.note}` : ''));

function meetingEmail(pkg, before) {
  const m = pkg.meeting;
  // The projects the meeting covered (B13): the main one first. A package from before multi-project meetings has one.
  const covered = pkg.projects && pkg.projects.length ? pkg.projects : (pkg.project ? [pkg.project] : []);
  const codes = new Set(covered.map(c => c.code));
  const pname = code => (covered.find(c => c.code === code) || {}).name || code;
  const projOf = it => it.project || (pkg.project && pkg.project.code);
  const ok = pkg.items.filter(it => !it.toCheck && !it.mergedInto), check = pkg.items.filter(it => it.toCheck && !it.mergedInto);
  const minted = k => ok.filter(it => it.id && it.kind === k);
  const actions = minted('commitment'), decisions = minted('decision'), questions = minted('question'), risks = minted('risk');
  const onThreads = ok.filter(it => it.thread);
  const notes = ok.filter(it => !it.id && !it.thread);
  const prior = before ? before.order.map(id => before.threads.get(id)).filter(t => codes.has(t.project)) : [];
  const first = !before || !before.meetings.some(p => (p.projects || [p.project]).some(x => codes.has(x.code)));

  const unowned = actions.filter(a => !ownerOf(a));
  // Who took on what, per project ("On Harbor Point reopening: Tom Lindqvist took on 2 new actions (...)").
  const took = covered.map(c => {
    const owners = {};
    for (const a of actions) if (ownerOf(a) && projOf(a) === c.code) (owners[ownerOf(a)] = owners[ownerOf(a)] || []).push(a.id);
    const t = Object.entries(owners).map(([p, ids]) => `${p} took on ${ids.length} new action${ids.length > 1 ? 's' : ''} (${ids.join(', ')})`).join('; ');
    return t ? `On ${c.name}: ${t}.` : '';
  }).filter(Boolean).join(' ');
  const closed = onThreads.filter(it => it.applied && it.status === 'done');
  const blocked = onThreads.filter(it => it.applied && it.status === 'blocked');
  const tw = id => { const t = before && before.threads.get(id); return t ? t.what : id; };
  const summary = [`The ${m.title} on ${longDate(m.date)} convened.` + (took ? ' ' + took : '')];
  if (unowned.length) summary.push(unowned.map(a => `“${a.what}” (${a.id}) has no owner yet.`).join(' '));
  if (closed.length) summary.push('Closed: ' + closed.map(it => `“${tw(it.thread)}” (${it.thread})`).join('; ') + '.');
  if (blocked.length) summary.push('Blocked: ' + blocked.map(it => `“${tw(it.thread)}” (${it.thread})`).join('; ') + '.');
  if (decisions.length) summary.push('Decided: ' + decisions.map(d => d.what).join('; ') + '.');
  if (notes.length) summary.push('Also reported: ' + notes.map(u => u.what).join('; ') + '.');
  if (questions.length) summary.push('Still open: ' + questions.map(q => q.what).join('; ') + '.');
  const nxt = actions.filter(a => a.importance === 'high');
  if (nxt.length) summary.push('Next up: ' + nxt.map(a => `“${a.what}” (${a.id}), ${ownerOf(a) || 'no owner'}` + (a.due ? `, “${a.due}”` : '')).join('; ') + '.');

  /* The executive summary (Aaron, 2026-10-16): the chat's saved summary of the meeting, the text the Board shows as
     "Last time we talked…", then the meeting's decisions and its other updates, which no other section lists. A package
     saved without a summary keeps the summary built from the items. */
  const chat = String((pkg.reply && pkg.reply.summary) || '').trim();
  const exec = chat ? [chat]
    .concat(decisions.length ? ['', 'Decided in this meeting:', ...decisions.map(d => `- ${d.id} ${d.what}${covered.length > 1 ? ` (${pname(projOf(d))})` : ''}`)] : [])
    .concat(notes.length ? ['', 'Also reported:', ...notes.map(u => `- ${u.what}`)] : [])
    : [summary.join(' ')];
  const out = ['1. Meeting Overview', '', `Meeting Name: ${m.title}`, '', `Date: ${longDate(m.date)}`, '', `Projects covered: ${covered.length ? covered.map(c => c.name).join(', ') : 'none named'}`, '',
    ...(pkg.attendance && pkg.attendance.participants.length ? [`Attendees (${pkg.attendance.participants.length}): ${pkg.attendance.participants.map(a => a.person || a.name).join(', ')}`, ''] : []),
    '2. Executive Summary', '', ...exec, '', '3. New actions from this meeting', '', 'Effort\tDetail'];
  for (const a of actions) out.push(`${a.id} ${a.what}${covered.length > 1 ? ` (${pname(projOf(a))})` : ''}\t${ownerOf(a) ? `Owner: ${ownerOf(a)}.` : 'Owner: none named — unassigned.'} Status: Open. ${timing(a)}`);
  if (!actions.length) out.push('None.');
  out.push('', '4. Existing items updated or referenced this meeting', '');
  // The board decisions since the previous meeting of these projects: the PM's, listed apart from the meeting's results.
  const lastKey = before ? before.meetings.filter(p => p.kind === 'meeting' && (p.projects || [p.project]).some(x => x && codes.has(x.code))).map(p => p.meeting.id).pop() || '' : '';
  const outside = before ? (before.boardEvents || []).filter(e => e.key >= lastKey && codes.has(e.project)) : [];
  if (onThreads.length) {
    out.push('Effort\tDetail');
    for (const it of onThreads) out.push(`${it.thread} ${tw(it.thread)}\t${it.what}` + (it.applied && !(before && before.threads.get(it.thread) && before.threads.get(it.thread).kind === 'decision') ? ` Status: ${STATUS[it.status]}.` : ''));
  } else if (!outside.length) out.push(first ? 'None: this is the first meeting, so the board had no existing items to update.' : 'None.');
  if (outside.length) {
    out.push('', 'Decided outside a meeting since the last meeting (the PM\'s decisions, not meeting results):');
    for (const e of outside) out.push(e.thread ? `${e.thread} ${e.what} — ${decisionWords(e)}` : `${pname(e.project)} — ${decisionWords(e)}`);
  }
  out.push('', '5. Existing open items not discussed', '');
  const mentioned = new Set(onThreads.map(it => it.thread));
  const quiet = prior.filter(t => !['done', 'not_needed', 'decided'].includes(t.status) && !mentioned.has(t.id));
  if (quiet.length) {
    out.push('These were open and this meeting did not mention them — no meeting-based status update is available.', '');
    for (const t of quiet) out.push(`${t.id} ${t.what} — ${t.owner || 'no owner'}, ${STATUS[t.status] || t.status}`);
  } else out.push(first ? 'None: this is the first meeting.' : 'None.');
  out.push('', '6. Risks, dependencies and open questions', '');
  for (const r of risks) out.push(`Risk (${r.id}): ${r.what}`, '');
  for (const it of onThreads.filter(x => x.kind === 'risk')) out.push(`Risk (${it.thread}): ${it.what}`, '');
  for (const q of questions) out.push(`Open question (${q.id}): ${q.what}`, '');
  for (const it of ok.filter(x => x.waitsOnId)) out.push(`Waiting on: ${it.id || it.thread} “${it.id ? it.what : tw(it.thread)}” waits on ${it.waitsOnId}.`, '');
  const nq = questions.length, nr = risks.length;
  out.push('7. Conclusion', '', `${actions.length} new action${actions.length === 1 ? '' : 's'} came out of this meeting` +
    (unowned.length ? `; ${unowned.length} still need${unowned.length === 1 ? 's' : ''} an owner` : '') +
    (closed.length ? `; ${closed.length} existing item${closed.length === 1 ? ' was' : 's were'} closed` : '') +
    `. The board has been updated with the accepted actions. ${nq} open question${nq === 1 ? '' : 's'} and ${nr} risk${nr === 1 ? '' : 's'} remain visible for follow-up.`);
  if (check.length) out.push('', '---', 'To check before sending (their source could not be confirmed in the transcript):',
    ...check.map(it => `- ${it.seg} ${it.kind}: ${it.what}`));
  return out.join('\n') + '\n';
}

/* The leadership email, in the PM's format (plan §4.4, §8.4), built from the board across all projects, not from one
   meeting. Items are picked by board facts, not by "high" (which only orders items within a section): decisions, risks,
   no accountable owner, overdue (resolved dates only, §10.10), blocked and waiting on, parked (B11), projects not
   discussed yet, and the status table. since/asOf: the period (YYYY-MM-DD); its meetings give the new work and the
   developments. projects: [{ code, name }] in order. Items still "to check" are listed for the PM and not sent. */
function leadershipEmail(board, { since, asOf, projects }) {
  const Dt = (typeof module !== 'undefined' && module.exports) ? require('./dates.js') : root.MKG2_dates;
  const ps = projects || [];
  const pn = code => (ps.find(p => p.code === code) || {}).name || code;
  const hiFirst = xs => xs.map((x, i) => [x, i]).sort((a, b) => ((b[0].importance === 'high') - (a[0].importance === 'high')) || a[1] - b[1]).map(x => x[0]);
  const inPeriod = board.meetings.filter(m => m.kind === 'meeting' && m.meeting.date >= since && m.meeting.date <= asOf);
  const items = inPeriod.flatMap(m => m.items.filter(it => !it.toCheck && !it.mergedInto).map(it => ({ it, m, code: it.project || (it.thread && board.threads.get(it.thread) ? board.threads.get(it.thread).project : (m.project && m.project.code)) })));
  const all = board.order.map(id => board.threads.get(id));
  const open = all.filter(t => !['done', 'not_needed', 'decided'].includes(t.status) && !t.toCheck);
  const who = t => t.owner || 'Unassigned';
  const th = id => board.threads.get(id) || { what: id };
  const per = code => items.filter(x => x.code === code);
  const newActs = code => per(code).filter(x => x.it.id && x.it.kind === 'commitment').map(x => board.threads.get(x.it.id)).filter(Boolean);
  const events = (board.boardEvents || []).filter(e => e.at.slice(0, 10) >= since && e.at.slice(0, 10) <= asOf);

  /* The opening, one paragraph per project (Aaron, 2026-10-16: the report covers every project at any time, not one
     meeting): the project's latest saved meeting summary up to asOf (the Board's "Last time we talked…"), whether that
     meeting is in the period, and the board's facts: open actions, overdue, blocked, and what closed in the period. */
  const covers = (m, code) => (m.projects && m.projects.length ? m.projects : [m.project]).some(x => x && x.code === code);
  const closedP = board.closedProjects || new Map();
  const paras = ps.map(p => {
    const cl = closedP.get(p.code);
    if (cl) return `${p.name}: Closed ${longDate(cl.at.slice(0, 10))} by ${cl.by}: ${cl.note}`;
    const last = board.meetings.filter(m => m.kind === 'meeting' && m.meeting.date <= asOf && covers(m, p.code)).pop();
    const sum = last && String((last.reply && last.reply.summary) || '').trim();
    const acts = open.filter(t => t.project === p.code && t.kind === 'action');
    const late = acts.filter(t => Dt.daysLate(t.dueDate, asOf) > 0).length, blk = acts.filter(t => t.status === 'blocked').length;
    const closedN = per(p.code).filter(x => x.it.thread && x.it.applied && x.it.status === 'done').length +
      events.filter(e => e.project === p.code && (e.action === 'settled' || e.action === 'not_needed')).length;
    const when = !last ? 'Not discussed in a meeting yet.'
      : `Last discussed ${longDate(last.meeting.date)} (${last.meeting.title})${last.meeting.date < since ? ', before this period' : ''}${(last.projects || []).length > 1 ? ', in a meeting that covered several projects' : ''}: ` +
        (sum || 'no summary was saved for that meeting.');
    const facts = `Board: ${acts.length} open action${acts.length === 1 ? '' : 's'}, ${late} overdue, ${blk} blocked; ${closedN} closed this period.`;
    return `${p.name}: ${when} ${facts}`;
  });
  const lead = ['Team,', '', ...(paras.length ? paras.flatMap(x => [x, '']) : ['No projects on the board yet.', ''])];
  for (const p of ps) { const acts = newActs(p.code); if (acts.length) lead.push(`${p.name}: ` + acts.map(a => `new work: “${a.what}” (${who(a)})`).join(', and ') + '.'); }
  lead.push('Key developments:', '');
  const dev = [];
  for (const p of ps) {
    for (const x of per(p.code)) {
      if (!x.it.id && !x.it.thread) dev.push(`${p.name}: ${x.it.what}`);
      else if (x.it.thread && x.it.applied) dev.push(`${p.name}: ${STATUS[x.it.status].toLowerCase()}: “${th(x.it.thread).what}” (${x.it.thread})` +
        (x.it.byReview ? `, closed by the reviewer with ${x.it.relatedTo}` : ''));
    }
    for (const a of newActs(p.code)) if (!a.owner) dev.push(`${p.name}: ${a.what}: no one in the meeting took it on yet.`);
    for (const e of events) if (e.project === p.code && (e.action === 'settled' || e.action === 'not_needed')) dev.push(`${p.name}: “${e.what}” (${e.thread}) ${decisionWords(e)}`);
    for (const e of events) if (e.project === p.code && /_project$/.test(e.action)) dev.push(`${p.name}: ${decisionWords(e)}`);
  }
  lead.push(...(dev.length ? dev : ['None this week.']));
  lead.push('', 'Decisions', '');
  const decs = ps.flatMap(p => hiFirst(per(p.code).filter(x => x.it.id && x.it.kind === 'decision').map(x => x.it)).map(d => `${p.name}: ${d.what}`));
  lead.push(...(decs.length ? decs : ['None this week.']));
  lead.push('', 'Management attention/risks', '');
  const att = [];
  for (const p of ps) {
    const mine = open.filter(t => t.project === p.code);
    for (const t of hiFirst(mine.filter(t => t.kind === 'risk'))) att.push(`${p.name}: ${t.what}`);
    for (const t of hiFirst(mine.filter(t => t.kind === 'action'))) {
      const late = Dt.daysLate(t.dueDate, asOf);
      if (late > 0) att.push(`${p.name}: ${t.id} “${t.what}” is overdue by ${late} day${late === 1 ? '' : 's'} (due “${t.due}”, ${t.dueDate}); ${who(t)}`);
      if (!t.owner) att.push(`${p.name}: ${t.id} “${t.what}” has no accountable owner`);
      if (t.status === 'blocked') att.push(`${p.name}: ${t.id} “${t.what}” is blocked` + (t.waitsOn ? `, waiting on ${t.waitsOn} “${th(t.waitsOn).what}”` : ''));
      else if (t.waitsOn) att.push(`${p.name}: ${t.id} “${t.what}” is waiting on ${t.waitsOn} “${th(t.waitsOn).what}”`);
    }
    for (const t of mine.filter(t => t.parked)) att.push(`${p.name}: ${t.id} “${t.what}”: not discussed in ${t.quiet} meetings`);
    if (!closedP.has(p.code) && !board.meetings.some(m => m.kind === 'meeting' && (m.projects || [m.project]).some(x => x && x.code === p.code))) att.push(`${p.name}: not discussed in any meeting yet`);
  }
  lead.push(...(att.length ? att : ['None.']));
  lead.push('', 'Near-term next steps', '');
  const next = [];
  for (const p of ps) {
    const acts = open.filter(t => t.project === p.code && t.kind === 'action' && !t.parked);
    const dated = acts.filter(t => t.dueDate && t.dueDate >= asOf).sort((a, b) => (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0));
    const asSaid = hiFirst(acts.filter(t => t.due && !t.dueDate));
    for (const t of dated.concat(asSaid)) next.push(`${p.name}: ${t.due}${t.dueDate ? ` (${t.dueDate})` : ''}: “${t.what}” (${who(t)})`);
    for (const t of newActs(p.code).filter(t => !t.due && !['done', 'not_needed'].includes(t.status))) next.push(`${p.name}: new: “${t.what}” (${who(t)})`);
  }
  lead.push(...(next.length ? next : ['None.']));
  lead.push('', 'Project task status and accountable owners', '', 'Project\tCurrent/Overdue work\tStatus\tOwner');
  for (const p of ps) for (const t of open.filter(t => t.project === p.code && t.kind === 'action')) {
    const late = Dt.daysLate(t.dueDate, asOf);
    lead.push(`${p.name}\t${t.id} ${t.what}\t${STATUS[t.status] || t.status}` + (t.due ? `, due “${t.due}”` : '') + (late ? `, overdue ${late} day${late === 1 ? '' : 's'}` : '') +
      (t.waitsOn ? `, waiting on ${t.waitsOn}` : '') + (t.parked ? ', parked' : '') + `\t${who(t)}`);
  }
  const check = all.filter(t => t.toCheck && !['done', 'not_needed'].includes(t.status));
  if (check.length) lead.push('', '---', 'To check before sending (their source could not be confirmed in the transcript):', ...check.map(t => `- ${t.id} ${t.kind}: ${t.what}`));
  return lead.join('\n') + '\n';
}
const LEAD_SECTIONS = ['Key developments:', 'Decisions', 'Management attention/risks', 'Near-term next steps', 'Project task status and accountable owners'];

const SECTIONS = ['1. Meeting Overview', '2. Executive Summary', '3. New actions from this meeting', '4. Existing items updated or referenced this meeting',
  '5. Existing open items not discussed', '6. Risks, dependencies and open questions', '7. Conclusion'];
const api = { meetingEmail, leadershipEmail, SECTIONS, LEAD_SECTIONS };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_email = api;
})(this);
