// §16.16 unit checks: openitems.js (questions, request, answer rules, repeated flags) and the validator's NEW-P fix.
// Run: node oitest.js [oi-test dir]   (the dir holds request-open-items-v2.txt, open-items-v2.json and runs/v2)
const OI = require('../../src/modules/openitems.js'), V = require('../../src/modules/validator.js'), fs = require('fs'), path = require('path');
const D = process.argv[2] || path.join(__dirname, '..', 'playwright', 'oi');
let n = 0, failed = 0;
const ok = (id, cond, detail) => { n++; if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + id + (cond || !detail ? '' : `  [${detail}]`)); };

// ---------- Questions (§16.16.2) ----------
const T = { code: 'AI-403', label: 'Verify staging-area load', due: null };
const M = { title: 'Weekly board walk', meetingAt: '2026-10-01T10:00:00-04:00' };
const q = (it) => OI.questionFor({ meeting: M, tasks: [], ...it });
ok('o1 owner question', q({ kind: 'ownership', tasks: [T] }).question === 'Who owns AI-403 "Verify staging-area load"?' && q({ kind: 'ownership', tasks: [T] }).qkind === 'owner');
ok('o2 who-is question names the reference and the meeting', /^Who is "Morgan" \(named in the Weekly board walk, 2026-10-01\)\?$/.test(q({ kind: 'ambiguous_reference', refName: 'Morgan' }).question), q({ kind: 'ambiguous_reference', refName: 'Morgan' }).question);
ok('o3 who-is without a name falls back to the note', q({ kind: 'ambiguous_reference', note: 'Someone was mentioned.' }).qkind === 'question');
ok('o4 owner question without a task falls back to the note', q({ kind: 'ownership', note: 'No owner for the visit.' }).qkind === 'question');
ok('o5 implied change asks about the due date, with the current date', /^Does this change the due date of AI-403 "Verify staging-area load" \(now none\)\? If so, to what date\?$/.test(q({ kind: 'implied_change', tasks: [T] }).question));
ok('o6 a note with one yes/no question needs yes or no', q({ kind: 'open_question', note: 'Open question: Is connectivity confirmed?' }).needed === 'Yes or no.');
ok('o7 a note with two questions needs an answer to each', /each question/.test(q({ kind: 'open_question', note: 'Were they sent? Did James get his?' }).needed));
ok('o8 a reviewer-recorded item asks whether it is confirmed', q({ kind: 'open_question', rawNote: 'Recorded by the reviewer as an open item: “Connectivity should be fine.”' }).question === 'Is this confirmed: “Connectivity should be fine.”');
ok('o9 a multi-part instruction keeps every part and says partial if any is missing', /if any is missing, the answer is partial/.test(q({ kind: 'open_question', note: 'Confirm the list, the process, and the schedule.' }).needed));
ok('o10 unmatched person is a who-is question; unmatched work is a should-it-be-a-task question',
  q({ kind: 'unmatched', topic: { person: 'Paul Morrisseau' } }).qkind === 'who' && q({ kind: 'unmatched', note: 'Work "Request equipment documentation" not matched.', topic: {} }).question === 'Should "Request equipment documentation" be a task, and who owns it?');

// ---------- Which items are sent ----------
const items = [
  { key: '20261001T140000Z|S039|ownership|AI-403', kind: 'ownership', tasks: [T], target: 'AI-403', meeting: M },
  { key: '20261001T140000Z|S039|ownership|AI-403', kind: 'ownership', tasks: [T], target: 'AI-403', meeting: M },
  { key: '20261001T140000Z|q:something said|open_question|P2', kind: 'open_question', note: 'x?', tasks: [], meeting: M },
  { key: 'person|lee|person_unverified|lee', kind: 'person_unverified', note: 'Lee', tasks: [], meeting: M },
  { key: 'attendee|a@b.c|attendee_unmatched|a@b.c', kind: 'attendee_unmatched', attendee: { display: 'A B' }, tasks: [], meeting: M }];
const L = OI.listFor(items);
ok('o11 only items with a meeting segment (the A7 identity) are sent, once each', L.length === 1 && L[0].id === items[0].key, JSON.stringify(L.map(x => x.id)));

// ---------- The request ----------
const head = 'CONTEXT TOKEN: X\n\n', P = 'PROMPT\n  "selfReview": {"newVsExisting": []}\n}';
ok('o12 no open items: the request is unchanged', OI.request(head, P, 'IDX', 'MTG', []) === `${head}${P}\n\n=== INDEX ===\nIDX\n\n=== MEETING ===\nMTG`);
const R = OI.request(head, P, 'IDX', 'MTG', L);
ok('o13 with open items: answers line in the shape, rule before the INDEX, block between INDEX and MEETING',
  R.indexOf('"answers": [') < R.indexOf('"selfReview"') && R.indexOf('OPEN ITEMS RULE') < R.indexOf('=== INDEX ===') && R.indexOf('\n=== OPEN ITEMS ===\n') > R.indexOf('=== INDEX ===') && R.indexOf('\n=== OPEN ITEMS ===\n') < R.indexOf('=== MEETING ==='));
ok('o14 a "|" inside a question cannot break the block', OI.blockText([{ id: 'a|S001|k|t', question: 'x | y', needed: 'z' }]).split('\n')[2] === 'a|S001|k|t | x / y | z');

// ---------- The answers (§16.16.4) against the tested runs ----------
const req = fs.readFileSync(path.join(D, 'request-open-items-v2.txt'), 'utf8');
const segs = [...req.split('=== MEETING ===')[1].matchAll(/^(S\d{3}) \[[^\]]*\] [^:]+: (.*)$/gm)].map(m => ({ id: m[1], text: m[2] }));
const people = [...req.split('PEOPLE (ID | name | aliases)')[1].split('\n\n')[0].matchAll(/^([a-z][a-z0-9-]*) \| /gm)].map(m => m[1]);
const list = JSON.parse(fs.readFileSync(path.join(D, 'open-items-v2.json'), 'utf8')).map(x => ({ id: x.id, target: x.target, qkind: x.kind, question: x.question, needed: x.needed }));
const ext = t => { const m = /```(?:json)?\s*(\{[\s\S]*?\})\s*```/.exec(t); return JSON.parse(m ? m[1] : t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); };
const run = k => ext(fs.readFileSync(path.join(D, 'runs', 'v2', `run${k}.txt`), 'utf8'));
const ctx = { list, segments: segs, people };
const K403 = '20261001T140000Z|S039|ownership|AI-403', KMOR = '20261001T140000Z|S013|ambiguous_reference|P2';
for (const k of [1, 2, 3]) {
  const r = OI.check(run(k), ctx);
  ok(`o15.${k} run ${k}: every answer passes, the four clear answers are "answered"`, !r.dropped.length && r.kept.filter(a => a.status === 'answered').length === 4, JSON.stringify(r.dropped));
}
ok('o16 "match" on an owner item is ignored, not kept', (() => { const a = OI.check(run(1), ctx).kept.find(x => x.item === K403); return a.matchIgnored && !a.match; })());
ok('o17 the "Who is Morgan?" answer names its new person as identity evidence', [...OI.check(run(1), ctx).identity].join() === 'NEW-P1');
ok('o18 a flag repeating an answered question is listed (run 3 dates), and none in run 2', OI.check(run(3), ctx).dupFlags.length === 1 && !OI.check(run(2), ctx).dupFlags.length);
const seed = f => { const x = run(2); f(x); return OI.check(x, ctx); };
const a403 = x => x.answers.find(a => a.item === K403), amor = x => x.answers.find(a => a.item === KMOR);
ok('o19 mistyped ID dropped', seed(x => { a403(x).item = K403.replace('AI-403', 'AI-0403'); }).dropped.length === 1);
ok('o20 invented quote dropped', /quote is not in/.test((seed(x => { a403(x).quote = 'Sofia will own it'; }).dropped[0] || {}).why));
ok('o21 owner answer without its Reassign dropped', /needs a Reassign/.test((seed(x => { x.ops = x.ops.filter(o => o.op !== 'Reassign'); }).dropped[0] || {}).why));
ok('o22 Reassign citing another segment does not support it', /needs a Reassign/.test((seed(x => { x.ops.find(o => o.op === 'Reassign').src = [{ seg: 'S014', quote: 'q' }]; }).dropped[0] || {}).why));
ok('o23 who-is with a first name only dropped', seed(x => { x.ops.filter(o => o.op === 'NewParty').forEach(o => { o.name = 'Morgan'; }); }).dropped.some(d => d.item === KMOR));
ok('o24 who-is with a match to someone on the board passes', !seed(x => { x.ops = x.ops.filter(o => o.op !== 'NewParty'); amor(x).match = 'brooks'; }).dropped.length);
ok('o25 who-is with a match to someone not on the board dropped', /not a person on the board/.test((seed(x => { x.ops = x.ops.filter(o => o.op !== 'NewParty'); amor(x).match = 'nobody'; }).dropped[0] || {}).why));
ok('o26 earlier meeting’s segment number dropped', /not in this meeting/.test((seed(x => { a403(x).seg = 'S039'; }).dropped[0] || {}).why));
ok('o27 a status other than answered/partial dropped', seed(x => { a403(x).status = 'closed'; }).dropped.length === 1);
ok('o28 a second answer to the same item dropped; the first is kept', (() => { const r = seed(x => { x.answers.push({ ...a403(x), answer: 'Mei' }); }); return r.dropped.length === 1 && r.kept.find(a => a.item === K403).answer !== 'Mei'; })());
ok('o29 a partial answer needs no supporting change', !seed(x => { x.ops = x.ops.filter(o => o.op !== 'Reassign'); a403(x).status = 'partial'; }).dropped.length);
ok('o30 a "should this be a task" answer needs a new task or "no"', (() => {
  const l2 = [{ id: 'X|S001|suggestion|P2', target: 'P2', qkind: 'task', question: 'q', needed: 'n' }];
  const base = { ops: [], answers: [{ item: 'X|S001|suggestion|P2', seg: 'S004', quote: segs.find(s => s.id === 'S004').text.slice(0, 20), answer: 'Yes, Sofia', status: 'answered' }] };
  const no = JSON.parse(JSON.stringify(base)); no.answers[0].answer = 'No, not needed';
  return OI.check(base, { ...ctx, list: l2 }).dropped.length === 1 && OI.check(no, { ...ctx, list: l2 }).kept.length === 1; })());

// ---------- The validator: NEW-P owners and who-is identity ----------
const vctx = (extra) => ({ meetingDate: '2026-10-08', segments: [
  { id: 'S001', speaker: 'Reyes, Morgan', text: "Good morning. I'm Morgan Reyes. I lead the partner network team." },
  { id: 'S002', speaker: 'Reyes, Morgan', text: "I'll send the badge pickup location to James by Friday." }],
  register: { projects: [{ id: 'P2', title: 'Partner data exchange', description: 'badge pickup partner' }], tasks: [] }, ...extra });
const vp = () => ({ context: 'X', coveredProjects: ['P2'],
  ops: [{ op: 'NewParty', ref: 'NEW-P1', kind: 'person', name: 'Morgan Reyes', src: [{ seg: 'S001', quote: "I'm Morgan Reyes" }] },
        { op: 'NewTasking', ref: 'NEW-1', project: 'P2', label: 'Send James the badge pickup location', assignee: 'NEW-P1', src: [{ seg: 'S002', quote: "I'll send the badge pickup location to James" }] }],
  segments: [{ seg: 'S001', dispositions: [{ kind: 'context_only', about: ['P2'] }] }, { seg: 'S002', dispositions: [{ kind: 'commitment', about: ['NEW-1'] }] }],
  register: [], flags: [] });
const codes = (p, c) => V.validate(p, vctx(c)).flags.map(f => `${f.code}:${f.ref}`);
const c1 = codes(vp(), {});
ok('o31 validator: a commitment by a person introduced in this meeting is accepted for the task they own (NEW-P1 read as Morgan Reyes)', !c1.some(c => c.startsWith('TASK-NO-ACCEPTANCE')), c1.join(' '));
ok('o32 validator: that person owns a valid task, so is not flagged PARTY-IDENTITY', !c1.some(c => c.startsWith('PARTY-IDENTITY')), c1.join(' '));
const p2 = vp(); p2.ops[1].assignee = 'NEW-P2'; p2.ops.push({ op: 'NewParty', ref: 'NEW-P2', kind: 'person', name: 'Lee Park', src: [{ seg: 'S001', quote: 'Good morning' }] });
ok('o33 validator: a task owned by a different new person than the speaker still fails acceptance', codes(p2, {}).some(c => c === 'TASK-NO-ACCEPTANCE:NEW-1'), codes(p2, {}).join(' '));
const p3 = vp(); p3.ops = [p3.ops[0]];
ok('o34 validator: a new person on greeting alone is flagged, unless a passing "Who is" answer names them',
  codes(p3, {}).includes('PARTY-IDENTITY:NEW-P1') && !codes(p3, { identityRefs: ['NEW-P1'] }).includes('PARTY-IDENTITY:NEW-P1'));

console.log(`\n${n - failed}/${n} passed`);
process.exit(failed ? 1 : 0);
