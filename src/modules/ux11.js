/* D-UX11 user mode: the shared decision model (ratified 2026-10-12, user-mode plan §3, §7, §8).
 * Shared verbatim by the test harness and MeetingGraph.html, like validator.js and repair.js.
 *
 * classify(): turns a compiled reply into what a person decides:
 *   - changes:   one per proposed operation; class-A findings attach to the change they make unreliable
 *   - questions: class-B meeting-scope questions, including D-UX11h trigger questions
 *   - records:   class-C findings, kept for Reviewer details and the package
 *   - replyBlocked: the whole reply cannot be used (errors, missing tables)
 * applyChoices(): applies the person's choices to the reply itself, so the result passes the same gate (compile) in
 *   both views. Drops, date removals, reviewer-confirmed updates (D-UX11h option (a)) and reviewer-recorded open items
 *   are all edits of the reply; nothing bypasses validation.
 * readiness(): what still needs an answer before "Update the board".
 * reviewRecord(): the package's review metadata.
 */
(function (root) {
'use strict';
const arr = x => x == null ? [] : Array.isArray(x) ? x : [x];
const SEG_RE = /\bS\d{3}\b/g;

// §7 class A: the finding makes the change it names unreliable. Plain reasons, no codes.
// The words a DELIVERABLE-DROPPED finding says are left out, so the person sees what is lost, not a code.
function leftOut(code, msg) {
  if (code !== 'DELIVERABLE-DROPPED') return [];
  const m = /(?:also promises|quotes) ("[^"]*"(?:, "[^"]*")*)/.exec(String(msg || ''));
  return m ? [...m[1].matchAll(/"([^"]+)"/g)].map(x => x[1]) : [];
}

const A_REASON = {
  'CITE-RANGE': "its evidence can't be checked",
  'REF-DANGLING': "it refers to something that isn't on the board",
  'TIME-UNGROUNDED': "the meeting doesn't say when this is due",
  'TIMING-MERGED': 'it combines items with different deadlines into one task',
  'DELIVERABLES-MERGED': 'it combines separate deliverables into one task',
  'DECOMP-MERGED': 'it combines separate pieces of work into one task',
  'DELIVERABLE-DROPPED': 'it leaves out something the speaker promised',
  'CONTINGENCY-DROPPED': 'it leaves out the fallback the meeting stated',
  'TASK-NO-ACCEPTANCE': 'nobody in the meeting asked for this work or took it on as described',
  'PROJ-UNSUPPORTED': "it is filed under a project the meeting didn't cover",
  'PROJ-ORPHAN-OP': "it is filed under a project the meeting didn't cover",
  'PARTY-IDENTITY': 'it creates a person from a name alone',
  'ADMIN-IN-PROJECT': 'it records meeting administration as project work',
  'CONDITIONAL-TASKING': "it turns an \"if this happens\" instruction into a task",
  'SUPPORT-MISSING': "the meeting doesn't directly support this change",
  // Aaron, 2026-10-13 (testers' review): a note that cuts the speaker's sentence short is labeled, so an incomplete item
  // never looks complete. Formerly recorded only (class C).
  'QUOTE-TRUNCATED': "its note leaves out part of what was said"
};
// D-UX12 (ratified 2026-10-12): the only findings that stop an import.
const HARD_REASON = {
  'CITE-RANGE': "The chat's reply cites evidence the workbench can't check.",
  'REF-DANGLING': "The chat's reply points at something that isn't on the board.",
  'OP-CONFLICT': "The chat's reply contradicts itself"
};
// D-UX12 §4: findings that leave a change as written but label it "Check scope".
const SCOPE_BLOCKS = new Set(['QUOTE-TRUNCATED', 'DELIVERABLE-DROPPED', 'DELIVERABLES-MERGED', 'DECOMP-MERGED', 'CONTINGENCY-DROPPED', 'PROJ-UNSUPPORTED', 'PROJ-ORPHAN-OP']);
// D-UX12 §4 and §6: the labels the board shows.
const LABELS = {
  may_be_separate: 'May be separate work', no_owner: 'No owner yet', date_unclear: 'Date unclear', meeting_admin: 'Meeting administration',
  check_scope: 'Scope to confirm', possible_schedule_update: 'Possible schedule update', possible_update: 'Possible update',
  schedule_context: 'Schedule context', possible_owner_change: 'Possible owner change', possible_status_change: 'Possible status change',
  not_a_task_yet: 'Not a task yet', possibly_missed: 'Possibly missed'
};
// §7 class B families.
const SCOPE_CODES = new Set(['COV-UNRESOLVED', 'COV-POSSIBLE-MATCH', 'COV-CLAIM-UNSUPPORTED']);
const SAME_CODES = new Set(['NEW-DUPLICATE', 'COV-DEFERRED-NEW', 'MATCH-BETTER-TARGET']);
const UNREC_CODES = new Set(['COMMITMENT-MISCLASSIFIED', 'DISP-MISSING', 'COV-MISSING-ITEM']);
// §7 class C.
const C_CODES = new Set(['SELF-REVIEW-MISSING', 'SELF-REVIEW-INCOMPLETE', 'COV-EMPTY-RATIONALE', 'COV-CONTRADICTION',
  'DISP-ABOUT-PROJECT', 'MATCH-SCOPE-MISFIT', 'PROJ-LINK-ONLY']);

const ANSWERS = {
  scope: [{ value: 'place', label: 'Note it on the task as a possible update' }, { value: 'yes', label: 'Yes, it updates the task' }, { value: 'no', label: 'No, keep it as project-level context' }],
  same: [{ value: 'keep', label: 'Keep it' }, { value: 'drop', label: 'Drop it' }, { value: 'defer', label: 'Defer for review' }],
  split: [{ value: 'keep', label: 'Keep both' }, { value: 'first', label: 'Keep the first only' }, { value: 'defer', label: 'Defer for review' }],
  unrecorded: [{ value: 'record', label: 'Record it as an open item' }, { value: 'skip', label: 'Not needed' }, { value: 'defer', label: 'Defer for review' }],
  coverage: [{ value: 'accept', label: 'Accept it as it is' }, { value: 'defer', label: 'Defer: accept it now and check it against the meeting later' }],
  unclassified: [{ value: 'defer', label: 'Defer for review' }]
};

// Op index for a validator ref: a NEW-ref, or "Kind:target#n" (n counts the reply's ops from 1).
function opIndexer(llm) {
  const ops = arr(llm && llm.ops), byRef = new Map();
  ops.forEach((o, i) => { if (o && o.ref) byRef.set(String(o.ref), i); byRef.set(`${o && o.op}:${(o && (o.tasking || arr(o.about)[0] || o.project)) || ''}#${i + 1}`, i); });
  return ref => String(ref || '').split('+').map(r => byRef.has(r) ? byRef.get(r) : (/#(\d+)$/.test(r) ? +r.match(/#(\d+)$/)[1] - 1 : null)).filter(i => i != null && i >= 0 && i < ops.length);
}
const segsIn = s => [...new Set(String(s || '').match(SEG_RE) || [])];
const sentencesOf = text => String(text || '').split(/(?<=[.!?])\s+/).filter(Boolean);
const words = s => String(s).trim().split(/\s+/);
const STOP = new Set('with that this from into will would could should have has had been being they their them there what which when where about over under also still more most some each every than then here just only very send provide'.split(' '));
const keyWords = s => String(s || '').toLowerCase().split(/[^a-z]+/).filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/s$/, ''));
// The sentence a question shows and a reviewer-confirmed update quotes: the one sharing most words with the task
// label, a date-range sentence winning ties; without a label, the start of the segment. Cut to the prompt's 25-word
// quote limit as an exact prefix, so it is always a verbatim quote.
function quoteFor(segText, label, rangeRe) {
  const sents = sentencesOf(segText);
  const lab = new Set(keyWords(label));
  let best;
  if (!lab.size) best = String(segText || '').trim();
  else best = sents.map((s, i) => ({ s, i, k: new Set(keyWords(s).filter(w => lab.has(w))).size,
    r: rangeRe && rangeRe.test(s) ? 1 : 0 })).sort((a, b) => b.k - a.k || b.r - a.r || a.i - b.i)[0]?.s || '';
  const w = words(best);
  return (w.length > 25 ? w.slice(0, 25).join(' ') : best).replace(/[,;:]$/, '');
}

/**
 * comp: the workbench compile() result (rows, errors, flags, coverage.findings) — or, in the harness, a shim with the
 *   same fields. llm: the reply. ctx: { segments:[{id,t,speakerName,text}], tasks:[{code,label,project,status}],
 *   trigger:[{seg,task}] (D-UX11h candidates), rangeRe }.
 */
function classify(comp, llm, ctx) {
  const idx = opIndexer(llm), ops = arr(llm && llm.ops);
  const segById = new Map(arr(ctx.segments).map(s => [s.id, s]));
  const taskBy = new Map(arr(ctx.tasks).map(t => [t.code, t]));
  const stmt = id => { const s = segById.get(id); return s ? { seg: s.id, text: s.text, speaker: s.speakerName || '', time: s.t || '' } : null; };
  const model = { replyBlocked: false, replyReasons: [], hardStops: [], changes: [], questions: [], records: [], openItems: [] };
  if (comp.errors) { model.replyBlocked = true; model.replyReasons.push("The chat's reply has problems the workbench can't accept."); }
  for (const r of arr(comp.rows)) model.changes.push({ n: r.n, opIndex: r.n - 1, label: ((ops[r.n - 1] || {}).label || (ops[r.n - 1] || {}).text || ''),
    sentence: r.sentence || '', quote: r.ev && r.ev.quote || '',
    speaker: r.ev && r.ev.speaker || '', time: (stmt(r.ev && r.ev.seg) || {}).time || '', blocks: [] });
  const changeAt = i => model.changes.find(c => c.opIndex === i);
  for (const f of arr(comp.flags)) model.openItems.push({ kind: f.kind, note: f.note, about: f.about || null, statement: stmt(f.seg) });

  const qs = new Map();
  const ask = (id, q) => { if (!qs.has(id)) qs.set(id, { id, answers: ANSWERS[q.kind], ...q }); };
  const scope = (code, segId, why) => {
    const t = taskBy.get(code); if (!t) return false;
    const st = stmt(segId);
    if (!st) return false;
    ask(`scope:${code}`, { kind: 'scope', task: { code, label: t.label, project: t.project }, statement: st, opIndices: [], why,
      prompt: `The meeting said: “${quoteFor(st.text, t.label, ctx.rangeRe)}” Should this update “${t.label}”?` });
    return true;
  };
  const unrecorded = (segId, code, why) => {
    const st = segId ? stmt(segId) : null, t = code ? taskBy.get(code) : null;
    if (!st && !t) return false;
    ask(`rec:${segId || code}`, { kind: 'unrecorded', task: t ? { code, label: t.label, project: t.project } : null, statement: st, opIndices: [], why,
      prompt: st ? `The meeting said: “${quoteFor(st.text, t ? t.label : '', null)}” Nothing on the board records it.`
        : `The chat didn't say whether this meeting touched “${t.label}”. Nothing on the board records it.` });
    return true;
  };
  // D-UX11h trigger questions come first: they carry the statement that names the change.
  for (const c of arr(ctx.trigger)) scope(c.task, c.seg, 'schedule change not attached to the task');

  // Existing tasks the reply's own notes on a new task are said to fit better: also offered as places to attach it.
  const fitsBetter = new Map();
  for (const f of arr(comp.coverage && comp.coverage.findings)) {
    const m = /on (NEW-\d+): .* fits ([A-Z]+-\d+) better/.exec(String(f.msg || f.text || ''));
    if (m && taskBy.has(m[2])) fitsBetter.set(m[1], [...new Set([...(fitsBetter.get(m[1]) || []), m[2]])]);
  }
  for (const f of arr(comp.coverage && comp.coverage.findings)) {
    const code = f.code || null, text = String(f.text || '').replace(/<[^>]+>/g, '');
    const msg = String(f.msg || text);
    if (code && HARD_REASON[code] && !(code === 'REF-DANGLING' && /selfReview/.test(msg))) {
      model.replyBlocked = true; model.hardStops.push({ code, text: msg });
      model.replyReasons.push(code === 'OP-CONFLICT' ? `${HARD_REASON[code]}: ${msg.replace(/^[^ ]+ is given/, 'one item is given')}.` : HARD_REASON[code]);
      continue;
    }
    if (code && A_REASON[code]) {
      const isSelfReview = code === 'REF-DANGLING' && /selfReview/.test(msg);
      const onNote = code === 'DELIVERABLE-DROPPED' && !f.repair;
      let targets = idx(f.ref);
      if (!targets.length && (code === 'PROJ-UNSUPPORTED')) targets = ops.map((o, i) => [o, i]).filter(([o]) => o.project === f.ref || (taskBy.get(o.tasking) || {}).project === f.ref).map(([, i]) => i);
      if (!isSelfReview && !onNote && targets.length) {
        for (const i of targets) { const ch = changeAt(i); if (ch) ch.blocks.push({ code, msg, reason: leftOut(code, msg).length ? `it leaves out ${leftOut(code, msg).map(w => `\u201c${w}\u201d`).join(', ')}, which the speaker also promised` : A_REASON[code], remedy: code === 'TIME-UNGROUNDED' ? 'undate' : 'drop', left: leftOut(code, msg) }); }
        continue;
      }
      model.records.push({ code, text: msg }); continue;
    }
    // Amended 2026-10-12 (Aaron): a reply without coverage tables (older format) is a question, not a block.
    if (f.cat === 'tables_missing') {
      ask('coverage', { kind: 'coverage', task: null, statement: null, opIndices: [], why: f.cat,
        prompt: "The chat's reply doesn't say how it handled each part of the meeting, so the workbench can't tell whether it missed anything. Accept it as it is?" });
      model.records.push({ code: f.cat, text }); continue;
    }
    // Amended 2026-10-12 (Aaron): a call the chat already made and justified is recorded, not asked again.
    if ((code === 'NEW-DUPLICATE' || code === 'MATCH-BETTER-TARGET') && !f.repair) { model.records.push({ code, text: msg }); continue; }
    if (f.cat === 'unsupported_not_discussed' && f.lvl === 'info') { model.records.push({ code: f.cat, text }); continue; }
    if (code && SCOPE_CODES.has(code) || f.cat === 'possible_match' || f.cat === 'unsupported_not_discussed') {
      const t = (code && f.ref) || f.id; const segs = segsIn(text);
      const reg = arr(llm && llm.register).find(r => r && r.id === t); const rs = arr(reg && reg.segs);
      if (scope(t, segs[0] || rs[0], 'possible update left undecided') || unrecorded(null, t, 'possible update left undecided')) continue;
      model.records.push({ code: code || f.cat, text }); continue;
    }
    if (f.cat === 'discussed_no_output') {
      const m = /^([A-Z]+-\d+) is marked (\w+)/.exec(text);
      if (m && /is marked updated, but no operation touches it/.test(text)) { const reg = arr(llm && llm.register).find(r => r && r.id === m[1]);
        if (scope(m[1], arr(reg && reg.segs)[0], 'marked updated without an update') || unrecorded(null, m[1], 'marked updated without an update')) continue; }
      if (m && /nothing records it/.test(text)) { const reg = arr(llm && llm.register).find(r => r && r.id === m[1]);
        if (unrecorded(arr(reg && reg.segs)[0], m[1], 'discussed without a record')) continue; }
      model.records.push({ code: f.cat, text }); continue;
    }
    if (code && SAME_CODES.has(code)) {
      const targets = idx(code === 'COV-DEFERRED-NEW' ? (msg.match(/NEW-\d+/) || [''])[0] : f.ref);
      if (targets.length) { const i = targets[0], o = ops[i] || {};
        // Name the task already on the board, so the person can answer without the finding text.
        const other = (String(msg).match(/\b(?!NEW-)[A-Z]+-\d+\b/g) || []).map(c => taskBy.get(c)).find(Boolean) || null;
        const otherTxt = other ? `“${other.label}”` : 'something already on the board';
        const onLabel = (o.tasking && (taskBy.get(o.tasking) || {}).label) || ((ops.find(x => x && x.ref === o.tasking) || {}).label) || '';
        // Aaron (2026-10-12): what belongs to an existing task goes on that task as a note, instead of a yes/no fight
        // over whether it is a new task. "Add it to …" / "Move it to …" replace "Drop it" when the other task is known.
        const isMove = code === 'MATCH-BETTER-TARGET' && o.op === 'ProgressNote';
        const answers = !other ? undefined : isMove
          ? [{ value: 'keep', label: 'Keep it where it is' }, { value: 'move', label: `Move it to “${other.label}”` }, { value: 'defer', label: 'Defer for review' }]
          : o.op === 'NewTasking'
            ? [{ value: 'keep', label: 'Keep it as new work' },
               ...[...new Set([...(fitsBetter.get(o.ref) || []), other.code])].map(c => ({ value: `attach:${c}`, label: `Add it to “${taskBy.get(c).label}” as a note` })),
               { value: 'defer', label: 'Defer for review' }]
            : undefined;
        ask(`same:${i}`, { kind: 'same', task: other, statement: null, opIndices: [i], why: code, ...(answers ? { answers } : {}),
          prompt: code === 'MATCH-BETTER-TARGET'
            ? `The chat put this update on ${onLabel ? `“${onLabel}”` : 'a task'}, but the meeting statement it cites fits ${otherTxt} better: “${o.text || ''}” Keep it where the chat put it?`
            : `“${o.label || o.text || ''}” may be the same work as ${otherTxt}. Keep it as new work?` });
        continue; }
      model.records.push({ code, text: msg }); continue;
    }
    if (code === 'OVER-SPLIT') {
      const t = idx(f.ref);
      if (t.length === 2) { ask(`split:${t[0]}:${t[1]}`, { kind: 'split', task: null, statement: null, opIndices: t, why: code,
        prompt: `These may be one task: “${(ops[t[0]] || {}).label || ''}” and “${(ops[t[1]] || {}).label || ''}”.` }); continue; }
      model.records.push({ code, text: msg }); continue;
    }
    if (code && UNREC_CODES.has(code) || code === 'COV-UNBOUND-DISPOSITION') {
      if (code === 'COV-UNBOUND-DISPOSITION' && !/\((?:commitment|decision|status_update)\)/.test(msg)) { model.records.push({ code, text: msg }); continue; }
      const seg = /^S\d{3}$/.test(String(f.ref)) ? f.ref : null, task = /^[A-Z]+-\d+$/.test(String(f.ref)) ? f.ref : null;
      if (unrecorded(seg, task, code)) continue;
      model.records.push({ code, text: msg }); continue;
    }
    if (f.cat === 'unresolved_commitment' && f.lvl === 'warn') {
      const m = /^(S\d{3}) is classified (commitment|status_update|decision)\b/.exec(text);
      if (m && unrecorded(m[1], null, 'statement with no record')) continue;
      model.records.push({ code: f.cat, text }); continue;
    }
    if (f.cat === 'missing_disposition' && f.lvl === 'warn') {
      const m = /^([A-Z]+-\d+) .* is open in a covered project but has no coverage classification/.exec(text);
      if (m) { if (unrecorded(null, m[1], 'open item not reviewed')) continue; }
      else if (/^No disposition for/.test(text)) { let any = false; for (const s of segsIn(text)) any = unrecorded(s, null, 'statement not classified') || any; if (any) continue; }
      model.records.push({ code: f.cat, text }); continue;
    }
    if ((code && C_CODES.has(code)) || code === 'REF-DANGLING' || code === 'DELIVERABLE-DROPPED' || code === 'TIME-UNGROUNDED'
        || ['misbound', 'missing_disposition', 'unresolved_commitment', 'discussed_no_output'].includes(f.cat)) { model.records.push({ code: code || f.cat, text: msg }); continue; }
    // §3 D-UX11e: anything unclassified is class B until classified.
    ask(`unc:${qs.size}`, { kind: 'unclassified', task: null, statement: null, opIndices: [], why: code || f.cat,
      prompt: 'The workbench raised a check it has no plain-language form for yet. A reviewer should look at it in Reviewer details.' });
  }
  // A scope question about a task that also has an "unrecorded" question: the scope question carries it.
  for (const q of [...qs.values()]) if (q.kind === 'unrecorded' && q.task && qs.has(`scope:${q.task.code}`)) qs.delete(q.id);
  model.questions = [...qs.values()];
  return model;
}

function readiness(model, choices) {
  // D-UX12 (ratified 2026-10-12): every finding that is not a hard stop has a default, so only hard stops block.
  return { ok: !model.replyBlocked, missing: model.replyBlocked ? ['reply'] : [] };
}
// The D-UX11 rule (every block resolved, every question answered), kept for the record and the harness.
function readinessUx11(model, choices) {
  const missing = [];
  if (model.replyBlocked) missing.push('reply');
  const dropped = new Set(choices.drop || []), undated = new Set(choices.undate || []), ans = choices.answers || {};
  for (const c of model.changes) if (c.blocks.length && !dropped.has(c.opIndex)) {
    const needsDrop = c.blocks.some(b => b.remedy === 'drop');
    if (needsDrop || !undated.has(c.opIndex)) missing.push(`change:${c.n}`);
  }
  for (const q of model.questions) if (!ans[q.id]) missing.push(`question:${q.id}`);
  return { ok: !missing.length, missing };
}

// D-UX12 §3-§4: the default for every change a finding makes unreliable and every question. The person may override.
function defaultAnswer(q) {
  const vals = arr(q.answers).map(a => a.value);
  if (q.kind === 'scope') return 'place';
  if (q.kind === 'same') return vals.find(v => v.startsWith('attach:')) || 'keep';
  if (q.kind === 'split') return 'keep';
  if (q.kind === 'unrecorded') return 'record';
  if (q.kind === 'coverage') return 'accept';
  return 'defer';
}
function defaults(model, llm) {
  const ops = arr(llm && llm.ops), out = { drop: [], undate: [], answers: {}, place: {} };
  for (const c of model.changes) {
    if (!c.blocks.length) continue;
    const codes = new Set(c.blocks.map(b => b.code)), o = ops[c.opIndex] || {};
    let act = 'keep';
    if (codes.has('ADMIN-IN-PROJECT')) act = 'admin';
    else if (codes.has('CONDITIONAL-TASKING') || (codes.has('TASK-NO-ACCEPTANCE') && o.op === 'NewTasking' && !o.assignee)) act = 'notask';
    else if (codes.has('SUPPORT-MISSING')) act = 'demote';
    else if (codes.has('PARTY-IDENTITY') && o.op === 'NewParty') act = 'noparty';
    const acts = [act];
    if (act === 'keep' && codes.has('TASK-NO-ACCEPTANCE') && o.op === 'NewTasking' && o.assignee) acts.push('unown');
    if (act === 'keep' && (codes.has('TIME-UNGROUNDED') || codes.has('TIMING-MERGED'))) acts.push('undate');
    if (act === 'keep' && [...codes].some(x => SCOPE_BLOCKS.has(x))) acts.push('scope');
    out.place[c.opIndex] = { acts, reasons: [...new Set(c.blocks.map(b => b.reason))], msgs: c.blocks.map(b => b.msg || '') };
  }
  for (const q of model.questions) out.answers[q.id] = defaultAnswer(q);
  return out;
}
// The person's choices over the defaults: answers they gave win; drops and date removals add to the defaults.
function mergeChoices(def, user) {
  const u = user || {};
  return { drop: [...new Set([...arr(def.drop), ...arr(u.drop)])], undate: [...new Set([...arr(def.undate), ...arr(u.undate)])],
    answers: { ...(def.answers || {}), ...(u.answers || {}) }, place: { ...(def.place || {}) } };
}

// Apply the person's choices to the reply. Returns a new reply; the original is not modified.
function applyChoices(llm, model, choices, ctx) {
  const out = JSON.parse(JSON.stringify(llm || {}));
  const ops = arr(out.ops);
  const ans = choices.answers || {};
  const drop = new Set(choices.drop || []), undate = new Set(choices.undate || []);
  // D-UX12 labels: source-linked flags the board shows. Written after the drops, so none points at removed work.
  const labels = [];
  const segOf = new Map(arr(ctx && ctx.segments).map(x => [x.id, x]));
  const sentOf = c => { const t = (segOf.get(c.seg) || {}).text || ''; const q = String(c.quote || '').replace(/[.?!]+$/, '');
    return (sentencesOf(t).find(x => q && x.replace(/[’‘]/g, "'").includes(q.replace(/[’‘]/g, "'"))) || c.quote || '').trim(); };
  const from = (src, full) => { const qs = [...new Set(arr(src).filter(c => c && (c.quote || full)).map(c => full ? sentOf(c) : c.quote))].filter(Boolean);
    return qs.length ? ` From the meeting: ${qs.map(q => `\u201c${q}\u201d`).join(' ')}` : ''; };
  const segsOf = src => [...new Set(arr(src).map(c => typeof c === 'string' ? c : c && c.seg).filter(Boolean))];
  const nameOf = id => (ctx && typeof ctx.partyName === 'function' && ctx.partyName(id)) || id;
  const projOf = o => o.project || ((arr(ctx && ctx.tasks).find(t => t.code === o.tasking) || {}).project) || null;
  const label = (kind, about, src, note) => labels.push({ kind, about: arr(about).filter(Boolean), src: segsOf(src), note: `${LABELS[kind]}: ${note}` });
  for (const [k, pl] of Object.entries(choices.place || {})) {
    const i = +k, o = ops[i]; if (!o || drop.has(i)) continue;
    const acts = arr(pl.acts), why = arr(pl.reasons).join('; ');
    // The label carries the evidence of everything that goes with the removed task (its notes, its status), so those
    // statements stay accounted for.
    const withDeps = () => [...arr(o.src), ...ops.filter(x => x && o.ref && (x.tasking === o.ref || arr(x.about).includes(o.ref))).flatMap(x => arr(x.src))];
    if (acts.includes('admin')) { drop.add(i); label('meeting_admin', [], withDeps(), `${o.label || o.text || ''}.${from(o.src)}`); continue; }
    if (acts.includes('notask')) { drop.add(i); label('not_a_task_yet', [projOf(o)], withDeps(), `${o.label || o.text || ''} (${why}).${from(o.src)}`); continue; }
    if (acts.includes('demote')) {
      drop.add(i);
      if (o.op === 'Reassign') label('possible_owner_change', [o.tasking], o.src, `${nameOf(o.to)}, not yet confirmed by the meeting.${from(o.src)}`);
      else if (o.op === 'Status') label('possible_status_change', [o.tasking], o.src, `${o.status}, not yet confirmed by the meeting.${from(o.src)}`);
      else if (o.op === 'Deadline') label('possible_schedule_update', [o.tasking], o.src, `${o.dueDate || ''}${o.duePhrase ? ` (\u201c${o.duePhrase}\u201d)` : ''}, not yet confirmed by the meeting.${from(o.src)}`);
      else label('check_scope', [o.tasking || arr(o.about)[0] || o.project], o.src, `${({ PrerequisiteAdd: 'a new dependency', PrerequisiteWithdraw: 'a removed dependency', Decision: 'a decision' })[o.op] || 'a change'} was not applied: ${why}.${from(o.src)}`);
      continue;
    }
    if (acts.includes('noparty')) {
      drop.add(i);
      ops.forEach(x => { if (x && x.assignee === o.ref) { x.assignee = null; label('possible_owner_change', [x.ref], x.src, `${o.name || o.ref}, named in the meeting but not on the board.${from(o.src)}`); }
        if (x && x.op === 'Reassign' && x.to === o.ref) x.to = null; });
      continue;
    }
    if (acts.includes('unown')) { label('possible_owner_change', [o.ref || o.tasking], o.src, `${nameOf(o.assignee)}, who did not take it on in the meeting.${from(o.src)}`); o.assignee = null; }
    if (acts.includes('undate') && (o.dueDate || o.duePhrase)) {
      label('date_unclear', [o.ref || o.tasking], o.src, `${o.duePhrase ? `the meeting said \u201c${o.duePhrase}\u201d` : 'no date in the meeting'}; ${o.dueDate || 'the date'} was not set.`);
      undate.add(i);
    }
    if (acts.includes('scope')) {
      // A cut-short note names the words it left out.
      const cut = arr(pl.msgs).map(m => /\((S\d{3}): "(.*)"\)/.exec(m)).filter(Boolean).map(([, seg, sent]) => {
        const q = (arr(o.src).find(c => c && c.seg === seg) || {}).quote || '';
        // Truncation is usually at the end: report the words after the quote, else the words before it.
        const parts = q ? sent.replace(/[’‘]/g, "'").split(q.replace(/[’‘]/g, "'").replace(/[.?!]+$/, '')).map(x => x.replace(/^[\s,;.…]+|[\s,;]+$/g, '').trim()) : [];
        const rest = parts.length > 1 ? ([...parts].reverse().find(x => x.split(/\s+/).length >= 3) || '') : '';
        // Words the note already carries in its own phrasing are not missing.
        const kw = [...new Set(keyWords(rest))], have = new Set(keyWords(`${o.text || ''} ${o.label || ''}`));
        if (kw.length && kw.filter(w => have.has(w)).length / kw.length >= 0.6) return null;
        return rest ? `the note leaves out \u201c${rest}\u201d` : null; }).filter(Boolean);
      const whyNoCut = arr(pl.reasons).filter(x => x !== A_REASON['QUOTE-TRUNCATED']);
      if (whyNoCut.some(x => /leaves out \u201c|leaves out “/.test(x))) cut.length = 0;   // a dropped deliverable already says what is missing
      const onlyCut = !whyNoCut.length;
      if (!(onlyCut && !cut.length)) label('check_scope', [o.ref || o.tasking], o.src, `${([...whyNoCut, ...cut].join('; ') || why).replace(/([^.?!\u201d"])$/, '$1.')}${from(o.src, true)}`);
    }
  }
  for (const q of model.questions) {
    const a = ans[q.id];
    if (q.kind === 'same' && a === 'drop') q.opIndices.forEach(i => drop.add(i));
    if (q.kind === 'split' && a === 'first') drop.add(q.opIndices[1]);
    if (q.kind === 'same' && a === 'move' && q.task && ops[q.opIndices[0]]) ops[q.opIndices[0]].tasking = q.task.code;
  }
  // "Add it to … as a note": the new task becomes a note on the existing task, carrying its words and evidence; whatever
  // the reply attached to the new task (notes, flags, classifications) moves to the existing task.
  const retarget = new Map(), notes = [];
  for (const q of model.questions) {
    const i = q.opIndices[0], o = ops[i];
    const a = String(ans[q.id] || ''), code = a.startsWith('attach:') ? a.slice(7) : null;
    if (q.kind !== 'same' || !code || !o || !o.ref || drop.has(i)) continue;
    const qs = arr(o.src).filter(c => c && c.quote);
    notes.push({ op: 'ProgressNote', tasking: code,
      text: `Also needed for this task: ${o.label || ''}.${qs.length ? ' From the meeting: ' + qs.map(c => `\u201c${c.quote}\u201d`).join(' ') : ''}`,
      src: qs.map(c => ({ seg: c.seg, quote: c.quote })) });
    retarget.set(o.ref, code); drop.add(i);
    label('may_be_separate', [code], o.src, `\u201c${o.label || ''}\u201d was added to this task from the meeting.`);
    if (Array.isArray(out.register)) { const row = out.register.find(x => x && x.id === code), segs = qs.map(c => c.seg);
      if (row) { row.coverage = 'updated'; row.segs = [...new Set([...arr(row.segs), ...segs])]; delete row.note; }
      else out.register.push({ id: code, coverage: 'updated', segs: [...new Set(segs)] }); }
  }
  const move = x => retarget.get(x) || x;
  if (retarget.size) {
    ops.forEach(o => { if (o && retarget.has(o.tasking)) o.tasking = move(o.tasking); if (o && Array.isArray(o.about)) o.about = o.about.map(move); });
    if (Array.isArray(out.flags)) out.flags = out.flags.map(f => ({ ...f, about: Array.isArray(f.about) ? [...new Set(f.about.map(move))] : move(f.about) }));
    if (Array.isArray(out.segments)) out.segments = out.segments.map(e => ({ ...e, dispositions: arr(e.dispositions).map(d => ({ ...d, about: Array.isArray(d.about) ? [...new Set(d.about.map(move))] : move(d.about) })) }));
    if (out.selfReview && Array.isArray(out.selfReview.newVsExisting)) out.selfReview = { ...out.selfReview, newVsExisting: out.selfReview.newVsExisting.filter(r => !retarget.has(r.ref)) };
  }
  // A dropped new task takes the ops and references that depend on it with it.
  const goneRefs = new Set([...drop].map(i => ops[i] && ops[i].ref).filter(r => r && !retarget.has(r)));
  ops.forEach((o, i) => { if (o && (goneRefs.has(o.tasking) || arr(o.about).some(a => goneRefs.has(a)))) drop.add(i); });
  for (const i of undate) if (ops[i]) { delete ops[i].dueDate; delete ops[i].duePhrase; delete ops[i].dueTime; }
  out.ops = [...ops.filter((o, i) => !drop.has(i)), ...notes];
  if (goneRefs.size && Array.isArray(out.flags)) out.flags = out.flags.map(f => ({ ...f, about: arr(f.about).filter(a => !goneRefs.has(a)) }));
  if (goneRefs.size) {
    if (Array.isArray(out.segments)) out.segments = out.segments.map(e => ({ ...e, dispositions: arr(e.dispositions).map(d => ({ ...d, about: Array.isArray(d.about) ? d.about.filter(a => !goneRefs.has(a)) : (goneRefs.has(d.about) ? null : d.about) })) }));
    if (out.selfReview && Array.isArray(out.selfReview.newVsExisting)) out.selfReview = { ...out.selfReview, newVsExisting: out.selfReview.newVsExisting.filter(r => !goneRefs.has(r.ref)) };
  }
  // Tables and flags are touched only when a choice writes to them: a reply without tables stays without tables.
  const flagsOut = () => (out.flags = arr(out.flags)), registerOut = () => (out.register = arr(out.register)), segmentsOut = () => (out.segments = arr(out.segments));
  const segById = new Map(arr(ctx.segments).map(s => [s.id, s]));
  const llmOps = arr(llm && llm.ops);
  for (const q of model.questions) {
    const a = ans[q.id];
    if (q.kind === 'scope' && a === 'yes') {
      const s = segById.get(q.statement.seg); const quote = quoteFor(s.text, q.task.label, ctx.rangeRe);
      out.ops.push({ op: 'ProgressNote', tasking: q.task.code, text: `Reviewer confirmed that this meeting statement updates the task: “${quote}”`, src: [{ seg: s.id, quote }] });
      if (Array.isArray(out.register)) { const row = registerOut().find(r => r && r.id === q.task.code);
        if (row) { row.coverage = 'updated'; row.segs = [...new Set([...arr(row.segs), s.id])]; }
        else out.register.push({ id: q.task.code, coverage: 'updated', segs: [s.id] }); }
      if (Array.isArray(out.segments)) { const e = segmentsOut().find(x => x && x.seg === s.id);
        const disp = { kind: 'status_update', about: [q.task.code], note: 'Reviewer-confirmed update.' };
        if (e) e.dispositions = [...arr(e.dispositions), disp]; else out.segments.push({ seg: s.id, dispositions: [disp] }); }
    }
    if (q.kind === 'scope' && a === 'place') {
      const sched = /schedule/.test(q.why || '');
      label(sched ? 'possible_schedule_update' : 'possible_update', [q.task.code], [q.statement.seg], `the meeting said \u201c${quoteFor(q.statement.text, q.task.label, ctx.rangeRe)}\u201d`);
    }
    if (q.kind === 'scope' && a === 'no')
      label('schedule_context', [q.task.project || q.task.code], [q.statement.seg], `the meeting said \u201c${quoteFor(q.statement.text, q.task.label, ctx.rangeRe)}\u201d; kept at project level, not on \u201c${q.task.label}\u201d.`);
    // A bare acknowledgement ("Okay.") is not a missed item on its own.
    // Nor is a statement a kept note already carries in its own words (Aaron's test, 2026-10-13: "Connectivity should
    // be fine…" was summarized in the AI-206 note without being cited).
    const covered = st => { const kw = [...new Set(keyWords(st))]; if (kw.length < 3) return false;
      return out.ops.some(o => { const t = new Set(keyWords(`${o.text || ''} ${o.label || ''}`)); return kw.filter(w => t.has(w)).length / kw.length >= 0.5; }); };
    if (q.kind === 'unrecorded' && a === 'record' && !(q.statement && q.statement.text.trim().split(/\s+/).length < 4) && !(q.statement && covered(q.statement.text)))
      label('possibly_missed', q.task ? [q.task.code] : [arr(ctx.coveredProjects)[0]], q.statement ? [q.statement.seg] : [],
        q.statement ? `the meeting said \u201c${quoteFor(q.statement.text, q.task ? q.task.label : '', null)}\u201d and nothing records it.` : `the chat didn't record how the meeting affected \u201c${q.task.label}\u201d.`);
    if (q.kind === 'split' && a === 'keep') {
      const [x, y] = q.opIndices.map(i => llmOps[i] || {});
      if (x.ref && y.ref && out.ops.some(o => o.ref === x.ref) && out.ops.some(o => o.ref === y.ref))
        label('check_scope', [x.ref, y.ref], [...arr(x.src), ...arr(y.src)], `\u201c${x.label || ''}\u201d and \u201c${y.label || ''}\u201d may be one task.`);
    }
  }
  // Every new task without an owner is labeled, so the board shows the gap (D-UX12 §4).
  // …unless the reply already flagged the missing owner itself (Aaron's enterprise test, 2026-10-13: it showed twice).
  const ownFlagged = new Set(arr(out.flags).filter(f => f && f.kind === 'ownership').flatMap(f => arr(f.about)));
  for (const o of out.ops) if (o && o.op === 'NewTasking' && !o.assignee && o.ref && !ownFlagged.has(o.ref)) label('no_owner', [o.ref], o.src, `${o.label || ''}.`);
  // Labels on work that was removed are dropped; identical labels are written once.
  const live = new Set(out.ops.map(o => o && o.ref).filter(Boolean)), seen = new Set(arr(out.flags).map(f => `${f.kind}|${arr(f.about).join(',')}|${f.note}`));
  const keepLab = l => !l.about.some(a => /^NEW-/.test(a) && !live.has(a));
  for (const l of labels.filter(keepLab)) { const key = `${l.kind}|${l.about.join(',')}|${l.note}`; if (seen.has(key)) continue; seen.add(key); flagsOut().push(l); }
  return out;
}

// What the person's choices leave behind: class-A blocks and questions that appear only after the choices are applied
// (keyed by the change's own label, since op positions and minted codes shift when changes are dropped).
function consequences(before, after) {
  const key = (c, b) => `${c.label}|${b.code}`;
  const had = new Set(before.changes.flatMap(c => c.blocks.map(b => key(c, b))));
  const blocks = after.changes.flatMap(c => c.blocks.filter(b => !had.has(key(c, b))).map(b => ({ label: c.label, code: b.code,
    reason: b.left && b.left.length ? `the meeting also promised ${b.left.map(w => `\u201c${w}\u201d`).join(', ')}, and no change you kept carries ${b.left.length > 1 ? 'them' : 'it'}` : b.reason })));
  const asked = new Set(before.questions.map(q => q.id));
  const questions = after.questions.filter(q => !asked.has(q.id)).map(q => ({ id: q.id, prompt: q.prompt }));
  // A deliverable left uncarried because the person dropped the change that carried it is the person's decision; it is
  // recorded. Any other new block means the choices made a kept change unreliable, and Accept waits.
  return { recorded: [...blocks.filter(b => b.code === 'DELIVERABLE-DROPPED' || b.code === 'QUOTE-TRUNCATED'), ...questions], blocking: blocks.filter(b => b.code !== 'DELIVERABLE-DROPPED' && b.code !== 'QUOTE-TRUNCATED') };
}

// D-UX12: apply the defaults (and the person's overrides), then settle what that leaves. run(reply) compiles a reply and
// classifies it ({ comp, model }). Rounds stop when the defaults change nothing more (at most three).
function settle(llm, user, run, ctx) {
  const first = run(llm);
  if (first.model.replyBlocked) return { llm, comp: first.comp, model: first.model, base: first.model, choices: user || {}, rounds: 0 };
  const choices = mergeChoices(defaults(first.model, llm), user);
  let cur = applyChoices(llm, first.model, choices, ctx), res = run(cur), rounds = 1;
  while (rounds < 3 && !res.model.replyBlocked) {
    const next = applyChoices(cur, res.model, defaults(res.model, cur), ctx);
    if (JSON.stringify(next) === JSON.stringify(cur)) break;
    cur = next; res = run(cur); rounds++;
  }
  return { llm: cur, comp: res.comp, model: res.model, base: first.model, choices, rounds };
}
function labelsOf(reply) { return arr(reply && reply.flags).filter(f => f && LABELS[f.kind]); }

function reviewRecord(model, choices, by, at, after) {
  const ans = choices.answers || {};
  return {
    model: 'D-UX12',
    placements: Object.entries(choices.place || {}).map(([i, p]) => ({ op: +i + 1, acts: arr(p.acts), reasons: arr(p.reasons) })),
    consequences: after ? after.recorded : [],
    questions: model.questions.map(q => ({ id: q.id, kind: q.kind, task: q.task ? q.task.code : null, seg: q.statement ? q.statement.seg : null,
      prompt: q.prompt, answer: ans[q.id] || null, reviewerConfirmed: q.kind === 'scope' && ans[q.id] === 'yes', by: by || null, at })),
    changes: { dropped: [...(choices.drop || [])].sort((a, b) => a - b).map(i => i + 1), undated: [...(choices.undate || [])].sort((a, b) => a - b).map(i => i + 1) },
    recorded: model.records.map(r => ({ code: r.code, text: r.text }))
  };
}

const api = { classify, readiness, readinessUx11, defaults, mergeChoices, applyChoices, settle, labelsOf, consequences, reviewRecord, opIndexer, quoteFor, A_REASON, LABELS };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGUx11 = api;
})(typeof window !== 'undefined' ? window : globalThis);
