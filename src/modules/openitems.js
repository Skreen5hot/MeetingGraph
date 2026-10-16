/* §16.16 Open items answered in meetings (ratified for build 2026-10-14).
 * Shared verbatim by the test harness and MeetingGraph.html, like resolve.js.
 *
 * The board's open items go into the request for the next meeting, each with its existing stable identity (A7:
 * meeting ID + segment + label kind + target) as its ID, a direct question and what is needed to answer it.
 * The chat may link a meeting's answers to them in an optional "answers" list. This module:
 *   - writes the questions and the request text (the OPEN ITEMS RULE and block, tested as request v2);
 *   - checks each answer (§16.16.4): exact ID, quote in the cited segment of this meeting, the change fits the
 *     question. A failing answer is dropped with a reason; a passing one is only a PROPOSED closure, which a reviewer
 *     confirms in the import review (Aaron's condition 1);
 *   - lists flags that repeat a question the meeting answered (shown once, as the open item), and the new people a
 *     "Who is ...?" answer identifies (identity evidence for the validator).
 * "match" outside a "Who is ...?" item is ignored (the build, not the prompt, handles it: Aaron, 2026-10-14).
 */
(function (root) {
'use strict';

const arr = x => Array.isArray(x) ? x : x == null ? [] : [x];
const normq = s => String(s == null ? '' : s).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
const srcSegs = o => new Set(arr(o && o.src).map(x => (x && typeof x === 'object' ? x.seg : x)).filter(Boolean));

// ---------- The question for each label kind (§16.16.2) ----------
const QKIND = {
  ambiguous_reference: 'who', ownership: 'owner', no_owner: 'owner', possible_owner_change: 'owner',
  possible_schedule_update: 'dates', date_unclear: 'dates', implied_change: 'dates',
  suggestion: 'task', possible_status_change: 'status'
};
const NEEDED = {
  who: 'Their full name and organization, or the person in PEOPLE they are.',
  owner: 'One person who accepts it.',
  task: 'Yes or no; if yes, the owner.',
  status: 'Yes or no, from someone who knows.'
};
const YESNO = /^(is|are|was|were|did|does|do|has|have|had|will|would|can|could|should|shall)\b/i;

function clean(note) {
  return String(note || '').replace(/^[^:]{2,40}: (?=[A-Z“"])/, '').replace(/\b(?:the )?INDEX\b/g, 'the board').replace(/\s+/g, ' ').trim();
}
const taskRef = t => t ? `${t.code} "${t.label}"` : '';

// it: { kind, note, rawNote, tasks:[{code,label,due}], target, refName, topic:{person}, meeting:{title, meetingAt} }
// ctx: { fmtDate(iso) } (optional)
function questionFor(it, ctx) {
  ctx = ctx || {};
  const t = arr(it.tasks)[0] || null, note = clean(it.rawNote || it.note);
  const when = it.meeting && it.meeting.meetingAt ? (ctx.fmtDate ? ctx.fmtDate(it.meeting.meetingAt) : String(it.meeting.meetingAt).slice(0, 10)) : '';
  const from = it.meeting && it.meeting.title ? ` (named in the ${it.meeting.title}${when ? `, ${when}` : ''})` : '';
  if (it.kind === 'person_unverified') return { qkind: 'verify', question: `Is this person identified correctly? ${note}`, needed: 'Confirmation from someone who knows them.' };
  if (it.kind === 'attendee_unmatched' && it.attendee) return { qkind: 'who', question: `Who is "${it.attendee.display}"${it.attendee.email ? ` (${it.attendee.email})` : ''}, who attended but is not on the board?`, needed: NEEDED.who.replace('in PEOPLE', 'on the board') };
  let qkind = QKIND[it.kind] || 'question';
  const person = (it.topic && it.topic.person) || it.refName || '';
  if (it.kind === 'unmatched') qkind = person ? 'who' : 'task';
  if (qkind === 'who' && !person) qkind = 'question';
  if ((qkind === 'owner' || qkind === 'dates' || qkind === 'status') && !t) qkind = 'question';
  switch (qkind) {
    case 'who': return { qkind, question: `Who is "${person}"${from}?`, needed: NEEDED.who };
    case 'owner': return { qkind, question: `Who owns ${taskRef(t)}?`, needed: NEEDED.owner };
    case 'status': return { qkind, question: `Is ${taskRef(t)} completed?`, needed: NEEDED.status };
    case 'task': {
      const what = (/[“"]([^”"]{4,120})[”"]/.exec(note) || [])[1];
      return { qkind, question: what ? `Should "${what}" be a task, and who owns it?` : `Should this be a task, and who owns it: ${note}`, needed: NEEDED.task };
    }
    case 'dates':
      if (it.kind === 'implied_change') return { qkind, question: `Does this change the due date of ${taskRef(t)} (now ${t.due || 'none'})? If so, to what date?`, needed: 'One full date with the year, or "no change".' };
      return { qkind, question: `What are the dates for ${taskRef(t)}?`, needed: 'The date or range, with the year.' };
  }
  // Open questions, conflicts and the rest: the chat's note, asked as it stands. One question per item is best
  // (finding 1); a note that asks several things needs every part answered, so a part answered stays partial.
  const rec = /^Recorded by the reviewer as an open item:\s*(.*)$/i.exec(String(it.rawNote || it.note || '').trim());
  if (rec) return { qkind, question: `Is this confirmed: ${rec[1].trim()}`, needed: 'Yes or no.' };
  const qs = note.match(/[^.?!]*\?/g);
  if (qs && qs.length) {
    const q = qs.map(x => x.trim()).join(' ');
    return { qkind, question: q, needed: qs.length > 1 ? 'An answer to each question; if any is missing, the answer is partial.' : YESNO.test(q) && !/\bor\b/i.test(q) ? 'Yes or no.' : 'The answer, as stated in the meeting.' };
  }
  const parts = (note.match(/,| and | whether /g) || []).length;
  return { qkind, question: note,
    needed: parts >= 2 ? 'Every point it asks about; if any is missing, the answer is partial.' : 'The answer, as stated in the meeting.' };
}

// The open items sent to the chat: board labels with a meeting segment (the A7 identity), one per key.
function listFor(items, ctx) {
  const seen = new Set(), out = [];
  for (const it of arr(items)) {
    if (!it || !it.key || seen.has(it.key)) continue;
    const parts = String(it.key).split('|');
    if (parts.length !== 4 || !/^\d{8}T\d{6}Z$/.test(parts[0]) || !/^S\d{3,}$/.test(parts[1])) continue;
    seen.add(it.key);
    out.push({ id: it.key, target: it.target, kind: it.kind, ...questionFor(it, ctx) });
  }
  return out;
}

// ---------- The request (tested as request v2, 2026-10-14) ----------
const RULE = `OPEN ITEMS RULE (answers to earlier open questions)
The board has open items from earlier meetings, listed under === OPEN ITEMS === with an ID, a question, and what is needed to answer it.
1. Only when THIS meeting explicitly addresses an item, add one entry to a top-level "answers" array in the Part B JSON object:
   {"item": "<the ID, copied character for character>", "seg": "S0xx", "quote": "<exact words from that segment, at most 25 words>", "answer": "<short plain answer>", "status": "answered|partial"}
   For a "Who is ...?" item answered with someone already in PEOPLE, add "match": "<that PEOPLE ID>". Never use "match" for any other item.
2. The S-number inside an ID refers to the EARLIER meeting. Copy the ID as text. Your "seg" and "quote" come from THIS meeting.
3. "answered" only when the meeting gives everything listed under Needed. If anything is uncertain, tentative ("probably", "still confirming") or missing, use "partial". If the item is not discussed, leave it out. Never answer from inference, from the INDEX, or from earlier meetings. Something that only sounds similar (another task, another place, another person) is not an answer.
4. Record the changes themselves as ordinary ops under the RULES above: an owner who accepts is a Reassign; a person newly identified by full name is a NewParty; new work is a NewTasking; a stated full due date is a Deadline. An answer does not replace an op, and an op does not need an answer.
5. A reviewer confirms every proposed closure; your answer only proposes it.
6. Do not add a flag for a question you answered, fully or partially: the open item already tracks it. Flags are for NEW questions only.`;
const SHAPE_ANCHOR = '  "selfReview": {"newVsExisting"';
const SHAPE_LINE = '  "answers": [{"item": "<ID from OPEN ITEMS, copied exactly>", "seg": "S0xx", "quote": "...", "answer": "...", "status": "answered|partial"}],\n';
const oneLine = s => String(s).replace(/\s*\|\s*/g, ' / ').replace(/\s+/g, ' ').trim();
function blockText(list) {
  return ['=== OPEN ITEMS ===', 'ID | question | needed', ...arr(list).map(x => `${x.id} | ${oneLine(x.question)} | ${oneLine(x.needed)}`)].join('\n');
}
// prompt: the extraction prompt; returns the prompt with the answers line in its output shape.
function promptWithAnswers(prompt) {
  const p = String(prompt);
  return p.includes(SHAPE_ANCHOR) ? p.replace(SHAPE_ANCHOR, SHAPE_LINE + SHAPE_ANCHOR) : p;
}
// The full request: prompt, rule, INDEX, OPEN ITEMS, MEETING (the order tested). No open items: unchanged.
function request(head, prompt, index, meetingText, list) {
  if (!arr(list).length) return `${head}${prompt}\n\n=== INDEX ===\n${index}\n\n=== MEETING ===\n${meetingText}`;
  return `${head}${promptWithAnswers(prompt)}\n\n${RULE}\n\n=== INDEX ===\n${index}\n\n${blockText(list)}\n\n=== MEETING ===\n${meetingText}`;
}

// ---------- Checking the answers (§16.16.4) ----------
// reply: the chat's JSON. ctx: { list (the open items sent), segments [{id,text}] of THIS meeting, people: Set or
// array of PEOPLE IDs on the board }.
function fullName(n) { return String(n || '').split(/\s+/).filter(t => t.replace(/[^A-Za-zÀ-ɏ]/g, '').length >= 2).length >= 2; }
function check(reply, ctx) {
  const items = new Map(arr(ctx.list).map(x => [x.id, x]));
  const segText = new Map(arr(ctx.segments).map(s => [s.id, s.text]));
  const people = new Set(arr(ctx.people instanceof Set ? [...ctx.people] : ctx.people));
  const ops = arr(reply && reply.ops);
  const kept = [], dropped = [], identity = new Set(), seenItem = new Set();
  for (const a0 of arr(reply && reply.answers)) {
    if (!a0 || typeof a0 !== 'object') continue;
    const a = { item: a0.item, seg: a0.seg, quote: a0.quote, answer: String(a0.answer || '').trim(), status: a0.status };
    const it = items.get(a.item);
    let why = null, support = null, matchIgnored = false;
    if (!it) why = 'its item ID is not one of the open items sent (IDs must match exactly)';
    else if (seenItem.has(a.item)) why = 'the reply answers this item more than once; the first answer is kept';
    else if (!segText.has(a.seg)) why = `segment ${a.seg || '(none)'} is not in this meeting`;
    else if (!a.quote || !normq(segText.get(a.seg)).includes(normq(a.quote))) why = `the quote is not in ${a.seg}`;
    else if (a.status !== 'answered' && a.status !== 'partial') why = 'its status must be "answered" or "partial"';
    else if (!a.answer) why = 'it gives no answer';
    if (!why && a0.match != null && a0.match !== '') {
      if (it.qkind === 'who') a.match = a0.match; else matchIgnored = true;
    }
    if (!why && a.status === 'answered') {
      if (it.qkind === 'owner') {
        support = ops.find(o => o && o.op === 'Reassign' && o.tasking === it.target && srcSegs(o).has(a.seg));
        if (!support) why = `an owner answer needs a Reassign on ${it.target} citing ${a.seg}`;
      } else if (it.qkind === 'who') {
        support = ops.find(o => o && o.op === 'NewParty' && srcSegs(o).has(a.seg) && fullName(o.name));
        if (support) identity.add(support.ref);
        else if (a.match && people.has(a.match)) support = { match: a.match };
        else why = a.match ? `"${a.match}" is not a person on the board, and no new person with a full name cites ${a.seg}` : `a "Who is" answer needs a new person with a full name citing ${a.seg}, or a match to someone on the board`;
      } else if (it.qkind === 'task') {
        support = ops.find(o => o && o.op === 'NewTasking' && srcSegs(o).has(a.seg));
        if (!support && !/^no\b/i.test(a.answer)) why = `a "Should this be a task" answer needs a new task citing ${a.seg}, or the answer "no"`;
      }
    }
    if (it) seenItem.add(a.item);
    const out = { ...a, ...(it ? { question: it.question, needed: it.needed, qkind: it.qkind, target: it.target } : {}),
      ...(support && support.ref ? { supportRef: support.ref } : {}), ...(matchIgnored ? { matchIgnored: true } : {}) };
    (why ? dropped : kept).push(why ? { ...out, why } : out);
  }
  return { kept, dropped, identity, dupFlags: dupFlags(reply, kept, items) };
}
// Flags that repeat a question this meeting answered (fully or partly): the open item already tracks it (rule 6).
const DUP_KINDS = new Set(['implied_change', 'open_question', 'conflict', 'date_unclear', 'possible_schedule_update', 'ownership', 'ambiguous_reference']);
function dupFlags(reply, kept, items) {
  const out = [];
  arr(reply && reply.flags).forEach((f, i) => {
    if (!f || !DUP_KINDS.has(f.kind)) return;
    const about = new Set(arr(f.about).flatMap(x => String(x).split(',')).map(x => x.trim()).filter(Boolean));
    const segs = new Set([...srcSegs(f), ...arr(f.segs), ...arr(f.seg)]);
    const hit = kept.find(a => segs.has(a.seg) && (about.has(a.target) || (!about.size && a.qkind === 'question')));
    if (hit) out.push({ index: i, item: hit.item });
  });
  return out;
}

const api = { questionFor, listFor, RULE, blockText, promptWithAnswers, request, check, dupFlags, fullName, QKIND };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGOpenItems = api;
})(typeof window !== 'undefined' ? window : globalThis);
