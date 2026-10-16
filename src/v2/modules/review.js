/* MeetingGraph v2 — the review (plan §10.6 step 4). Every choice is pre-set; the PM changes only what is wrong.
   Per item (it.r): undo a closure the chat applied, or confirm a status whose source is "to check" (B8); "Same as…"
   another new item of this meeting or an open thread (B5: manual, no suggestions); change the thread (another open
   thread, or new work); the owner, the due date as said and its resolved date (B7), the importance.
   Unticked suggestions: related closures when a question is settled (B2, §10.4) and people matches (B10, §10.5).
   applyReview turns the checked items and these choices into the items saved, plus the people answers to keep. */
(function (root) {
'use strict';
const node = typeof module !== 'undefined' && module.exports;
const S = node ? require('./store.js') : root.MKG2_store;
const D = node ? require('./dates.js') : root.MKG2_dates;
const P = node ? require('./people.js') : root.MKG2_people;

/* items: the checked items (each may carry .r, the PM's choices). answers: label -> { action: 'same'|'new'|'none',
   person }. related: the ticked related closures [{ thread, from }] (from: the item n that settled the question).
   people: peopleOf(pkgs). meetingDate: YYYY-MM-DD. Returns { items, aliases }. */
function applyReview(items, { answers, related, people, meetingDate }) {
  const ans = answers || {}, ppl = people || { byLabel: new Map(), names: [] };
  const out = items.map(it => {
    const o = Object.assign({}, it), r = it.r || {};
    delete o.r;
    o.edited = [];
    if (r.thread !== undefined && r.thread !== it.thread) {   // another open thread, or new work (null)
      o.thread = r.thread || null; o.status = null; o.edited.push('thread');
    }
    if (r.sameAs != null && r.sameAs !== '') {
      if (typeof r.sameAs === 'number') o.mergedInto = r.sameAs;   // the same as another item of this meeting: one item
      else { o.thread = r.sameAs; o.status = null; }               // the same as an open thread: an update to it
      o.edited.push('same as');
    }
    o.statusUndone = !!(o.status && r.undo);
    o.statusConfirmed = !!(o.status && o.toCheck && r.confirm);
    if (r.who !== undefined && r.who !== it.who) { o.who = r.who || null; o.edited.push('owner'); }
    if (r.due !== undefined && r.due !== it.due) { o.due = r.due || null; o.edited.push('due'); }
    o.dueDate = r.dueDate !== undefined ? (r.dueDate || null) : D.resolveDue(o.due, meetingDate);
    if (r.dueDate !== undefined) o.edited.push('due date');
    if (r.importance && r.importance !== it.importance) { o.importance = r.importance; o.edited.push('importance'); }
    // The owner as a person: the PM's answer for a new label, else the board's.
    if (o.who) {
      const a = ans[o.who];
      if (a && a.action === 'same') o.person = a.person;
      else if (a && a.action === 'none') { o.person = null; o.who = null; }
      else { const k = P.resolve(o.who, ppl); o.person = k.known ? k.name : S.displayName(P.clean(o.who) || o.who); }
    } else o.person = null;
    if (!o.edited.length) delete o.edited;
    return o;
  });
  // Related closures the PM ticked: each is recorded as the reviewer's choice, sourced to the statement that settled the
  // question (never as the chat's), and applies like a closure.
  let n = Math.max(0, ...out.map(x => x.n));
  for (const t of related || []) {
    const src = out.find(x => x.n === t.from); if (!src) continue;
    out.push({ n: ++n, ref: null, kind: 'update', topic: src.topic || '', who: null, person: null, what: `Closed with ${src.thread}, settled in this meeting`,
               due: null, dueDate: null, importance: 'normal', thread: t.thread, status: 'done', waitsOn: null, seg: src.seg, citedSeg: src.seg, words: src.words,
               src: src.src, toCheck: false, notes: [`closed by the reviewer: related to ${src.thread}, settled at ${src.seg}`], whoIsSpeaker: true, relatedTo: src.thread, byReview: true });
  }
  const aliases = Object.entries(ans).map(([label, a]) => ({ label, person: a.action === 'same' ? a.person : a.action === 'none' ? null : S.displayName(P.clean(label) || label) }));
  return { items: out, aliases };
}

/* Related closures (B2, §10.4), offered unticked: when an item of this meeting settles a question (a "done" on a question
   thread, sourced), the open actions related to it. Related: the same topic as the question, or created in the same
   meeting within 15 statements of the question's source. Either is enough; both are heuristics. */
function relatedClosures(items, board) {
  const segn = s => parseInt(String(s || '').slice(1), 10);
  const closing = new Set(items.filter(x => x.thread && x.status === 'done').map(x => x.thread));
  const out = [];
  for (const it of items) {
    if (!it.thread || it.status !== 'done' || it.toCheck || (it.r && it.r.undo)) continue;
    const q = board.threads.get(it.thread); if (!q || q.kind !== 'question') continue;
    const topic = String(q.topic || '').trim().toLowerCase();
    for (const id of board.order) {
      const a = board.threads.get(id);
      if (a.kind !== 'action' || a.project !== q.project || ['done', 'not_needed'].includes(a.status) || closing.has(a.id)) continue;
      const sameTopic = topic && String(a.topic || '').trim().toLowerCase() === topic;
      const near = a.created === q.created && a.seg && q.seg && Math.abs(segn(a.seg) - segn(q.seg)) <= 15;
      if (sameTopic || near) out.push({ question: q.id, from: it.n, thread: a.id, what: a.what, owner: a.owner, why: sameTopic ? 'the same topic' : 'raised within 15 statements of the question' });
    }
  }
  return out;
}

/* A saved meeting reopened for review (§10.3): its items as the chat gave them, with the saved choices as it.r.
   An item saved as new work about an open item reopens attached, with its status, so saving again splits it the same
   way. A saved date is the PM's only when the save recorded the PM editing it: any other date is resolved again, so a
   fix to the date reader reaches meetings saved before it (Aaron's run, 2026-10-16: Dec 14 had stayed Nov 2). */
const STRIP = ['id', 'applied', 'waitsOnId', 'statusUndone', 'statusConfirmed', 'mergedInto', 'edited', 'movedByPM', 'placedByPM', 'dueDate', 'person'];
function reopenItems(pkg) {
  const statusOf = n => pkg.items.find(x => x.statusOf === n);
  return pkg.items.filter(x => !x.byReview && !x.statusOf).map(x => {
    const o = Object.assign({}, x), r = {};
    if (x.statusUndone) r.undo = true; if (x.statusConfirmed) r.confirm = true; if (x.mergedInto) r.sameAs = x.mergedInto;
    if (x.relatedTo) {
      const st = statusOf(x.n);
      o.thread = x.relatedTo; o.status = st ? st.status : null; delete o.relatedTo;
      if (st && st.statusUndone) r.undo = true; if (st && st.statusConfirmed) r.confirm = true;
    }
    o.notes = (x.notes || []).filter(t => !/^new (action|decision) about |settled when it is made/.test(t));
    if ((x.edited || []).includes('due date')) r.dueDate = x.dueDate || null;
    STRIP.forEach(k => delete o[k]); o.r = r; return o;
  });
}

const api = { applyReview, relatedClosures, reopenItems };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_review = api;
})(this);
