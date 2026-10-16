/* MeetingGraph v2 — reading and checking the chat's reply, item by item (plan §4.2, §10.6 step 3).
   Ported from tests/v2-feasibility/check_reply.py (the reading rules, not the scoring).
   Only two things stop the import: no readable reply, and the wrong context token. Everything else is per item:
   a source that can't be confirmed marks that item "to check"; an unknown thread makes it new work; a status without
   a thread is dropped. A cut reply keeps every complete line (§5.10's end-line rule). */
(function (root) {
'use strict';
const KINDS = ['commitment', 'decision', 'question', 'risk', 'update'];
const STATUSES = ['done', 'blocked', 'in_progress'];
const norm = s => String(s == null ? '' : s).replace(/[–—]/g, '-').replace(/[“”]/g, '"').replace(/[‘’`]/g, "'")
  .replace(/\s+/g, ' ').trim().toLowerCase();
// The source check compares words, in order: punctuation and case are ignored ("the 2nd. Is" and "the 2nd is" are the
// same words; found on the PM's first real meeting, 2026-10-15). Whole words only, so "is" never matches inside "island".
const words = s => ' ' + norm(s).replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim() + ' ';
const has = (text, w) => words(text).includes(w);
const segnum = s => parseInt(String(s).slice(1), 10);

// The one-entry-per-line reply: a header line, item lines, an end line. null if the text is not in that shape.
function extractLines(text) {
  const objs = []; let cut = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line.startsWith('{')) continue;
    try { objs.push(JSON.parse(line)); } catch (e) { cut = 'a line does not parse'; break; }
  }
  if (!objs.length || !('context' in objs[0]) || 'items' in objs[0] || 'ops' in objs[0]) return null;
  const items = objs.slice(1).filter(o => o && 'kind' in o);
  const end = objs.slice(1).find(o => o && 'end' in o);
  // §10.20: a project line proposes a new project; it is not an item, and the end line does not count it.
  const newProjects = objs.slice(1).filter(o => o && 'newProject' in o && !('kind' in o));
  const reply = Object.assign({}, objs[0], { items, newProjects });
  if (cut || !end) reply._cut = `the reply stopped after ${items.length} items (no end line)`;
  else if (typeof end.end !== 'number' || items.length < end.end) reply._cut = `the end line says ${end.end} items, ${items.length} arrived`;
  else if (items.length > end.end) reply._note = `the end line says ${end.end} items, ${items.length} arrived (a miscount; nothing is missing)`;
  return reply;
}

// The reply object, or { error } with a plain reason. A single JSON object cut inside its items keeps the complete ones.
function extract(text) {
  const lines = extractLines(text);
  if (lines) return lines;
  const m = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/.exec(text);
  const i = String(text).indexOf('{');
  const body = m ? m[1] : (i >= 0 ? String(text).slice(i) : '');
  if (!body) return { error: 'There is no reply to read: paste the chat\'s whole reply.' };
  // The first complete object (a copied chat page can hold several replies), found by matching braces outside strings.
  let depth = 0, inStr = false, esc = false, end = -1;
  for (let j = 0; j < body.length; j++) {
    const c = body[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true; else if (c === '{') depth++; else if (c === '}' && --depth === 0) { end = j; break; }
  }
  if (end > 0) { try { return JSON.parse(body.slice(0, end + 1)); } catch (e) { /* not JSON: fall through */ } }
  const k = body.indexOf('"items"'), cut = k >= 0 ? body.lastIndexOf('},') : -1;
  if (cut > k && k >= 0) {
    try { const r = JSON.parse(body.slice(0, cut + 1) + ']}'); r._cut = `the reply stopped after ${(r.items || []).length} items`; return r; } catch (e) { /* fall through */ }
  }
  return { error: 'The reply could not be read: it is not in the format the request asked for.' };
}

// verified | near | misplaced | not found, and the statement the words were found in.
function verify(seg, quote, byId, order) {
  const w = words(quote);
  if (!w.trim()) return { src: 'not found', seg };
  if (byId[seg] && has(byId[seg].text, w)) return { src: 'verified', seg };
  if (byId[seg]) {
    const n = segnum(seg);
    const near = order.filter(s => Math.abs(segnum(s.id) - n) <= 2 && has(s.text, w))
      .sort((a, b) => Math.abs(segnum(a.id) - n) - Math.abs(segnum(b.id) - n))[0];
    if (near) return { src: 'near', seg: near.id };
  }
  return { src: order.some(s => has(s.text, w)) ? 'misplaced' : 'not found', seg };
}

/* The new projects the chat proposes (§10.20), each with its quote checked like an item's. A line with no ref or no
   name is dropped with a note; a second line with the same ref is dropped. */
function readProposals(lines, byId, segments, notes) {
  const out = [];
  for (const x of lines || []) {
    const ref = String(x.newProject == null ? '' : x.newProject).trim().toUpperCase(), name = String(x.name || '').trim();
    if (!ref || !name) { notes.push('a project line with no ref or no name was dropped'); continue; }
    if (out.some(p => p.ref === ref)) { notes.push(`a second project line for ${ref} was dropped`); continue; }
    const v = verify(x.seg || null, x.words || '', byId, segments);
    out.push({ ref, name, citedSeg: x.seg || null, seg: v.seg, words: String(x.words || ''), src: v.src, toCheck: v.src === 'misplaced' || v.src === 'not found' });
  }
  return out;
}

/* text: the pasted reply; segments: the numbered statements; token: the request's context token;
   openIds: the thread IDs the request listed; projectCodes: the codes the request listed under PROJECTS (§10.20; with
   no projectCodes the reply's projects are ignored). Returns { stop } or the checked reply. */
function checkReply(text, { segments, token, openIds, projectCodes }) {
  const r = extract(text);
  if (r.error) return { stop: r.error };
  if (!Array.isArray(r.items)) return { stop: 'This reply is not in the format the request asked for. Make sure the request was copied from this page, then paste the chat\'s reply again.' };
  if (r.context !== token) return { stop: `This reply belongs to a different request (its context is ${JSON.stringify(r.context || null)}). Copy the request again from this page, send it to the chat, and paste that reply.` };
  const byId = {}; segments.forEach(s => { byId[s.id] = s; });
  const open = new Set(openIds || []);
  const refs = new Set(r.items.map(x => x && x.ref).filter(Boolean));
  const speakers = new Set(segments.map(s => s.speakerName));
  const replyNotes = [];
  const proposals = projectCodes ? readProposals(r.newProjects, byId, segments, replyNotes) : [];
  const items = r.items.map((x, i) => {
    const it = { n: i + 1, ref: x.ref || null, kind: x.kind, topic: x.topic || '', who: x.who || null, what: String(x.what || ''),
                 due: x.due || null, importance: x.importance === 'high' ? 'high' : 'normal', thread: x.thread || null,
                 status: x.status || null, waitsOn: x.waitsOn || null, seg: x.seg || null, words: x.words || '', notes: [] };
    if (!KINDS.includes(it.kind)) { it.notes.push(`kind ${JSON.stringify(x.kind)} is not one of the five; kept as an update`); it.kind = 'update'; }
    const v = verify(it.seg, it.words, byId, segments);
    if (v.seg !== it.seg) it.notes.push(`the words are in ${v.seg}, not ${it.seg}; corrected`);
    it.citedSeg = it.seg; it.seg = v.seg; it.src = v.src;
    it.toCheck = v.src === 'misplaced' || v.src === 'not found';
    if (it.thread && !open.has(it.thread)) { it.notes.push(`thread ${it.thread} was not in the request; treated as new work`); it.thread = null; }
    if (it.status && !STATUSES.includes(it.status)) { it.notes.push(`status ${JSON.stringify(it.status)} is not recognised; dropped`); it.status = null; }
    if (it.status && !it.thread) { it.notes.push('a status without a thread; dropped'); it.status = null; }
    if (it.waitsOn && !open.has(it.waitsOn) && !refs.has(it.waitsOn)) { it.notes.push(`waits on ${it.waitsOn}, which names nothing; dropped`); it.waitsOn = null; }
    it.whoIsSpeaker = !it.who || speakers.has(it.who);
    // The chat's project for the item (§10.20): a listed code, a proposed project's ref, or null ("not clear").
    // An item on a thread belongs to the thread's project, whatever the chat says.
    if (projectCodes) {
      const pc = x.project != null && String(x.project).trim() ? String(x.project).trim().toUpperCase() : null;
      const known = pc && projectCodes.includes(pc), proposed = pc && !known && proposals.some(p => p.ref === pc);
      if (pc && !known && !proposed) it.notes.push(`project ${JSON.stringify(x.project)} is neither listed nor proposed; not clear`);
      it.chatProject = known || proposed ? pc : null;
      if (!it.thread && known) it.project = pc;
      if (!it.thread && proposed) it.projectRef = pc;
    }
    return it;
  });
  const last = segments.length ? segments[segments.length - 1].id : null;
  return { reply: { context: r.context, summary: String(r.summary || ''), lastSeg: r.lastSeg || null },
           items, proposals, notes: replyNotes, cut: r._cut || null, note: r._note || null, lastSegOk: r.lastSeg === last, lastSeg: last };
}

/* "Add an item the chat missed" (plan §10.16, built 2026-10-15): the PM points at the statement where it was said and
   picks the kind, the owner and one line. The statement is the source, so the item is verified by construction; it is
   marked added, so the package and the counts show it came from the PM's reading, not the chat. New work only. */
function addItem(checked, segments, { seg, kind, who, what, due }) {
  let s = segments.find(x => x.id === seg);
  if (!s) return { error: `There is no statement ${seg || ''} in this meeting.` };
  if (!KINDS.includes(kind)) return { error: 'Pick what kind of item it is.' };
  if (!String(what || '').trim()) return { error: 'Write one line saying what it is.' };
  const it = { n: checked.items.length + 1, ref: null, kind, topic: '', who: who || null, what: String(what).trim(), due: due ? String(due).trim() : null,
               importance: 'normal', thread: null, status: null, waitsOn: null, seg, citedSeg: seg,
               words: s.text.split(/\s+/).slice(0, 10).join(' '), src: 'verified', toCheck: false, added: true,
               notes: ['added from the statement, not by the chat'], whoIsSpeaker: !who || segments.some(x => x.speakerName === who) };
  checked.items.push(it);
  return { item: it };
}
function removeAdded(checked, n) {
  const i = checked.items.findIndex(x => x.n === n && x.added);
  if (i < 0) return false;
  checked.items.splice(i, 1);
  checked.items.forEach((x, k) => { x.n = k + 1; });
  return true;
}

const api = { checkReply, extract, verify, norm, addItem, removeAdded };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_reply = api;
})(this);
