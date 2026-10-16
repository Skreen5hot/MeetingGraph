// D-UX12 Phase 2: unit checks for the resolution model (resolve.js). Run: node restest.js
const R = require('../../src/modules/resolve.js');
let n = 0, bad = 0;
const ok = (name, c, d) => { n++; if (!c) bad++; console.log((c ? 'PASS ' : 'FAIL ') + name + (!c && d ? `  [${d}]` : '')); };
const rec = (id, key, action, at, by, supersedes = [], extra = {}) => ({ id, label: { key, ...R.parseKey(key), quote: 'q' }, action, at, by, note: 'n', supersedes, choice: action, ...extra });
const K = '20261001T140000Z|S013|ambiguous_reference|P2';

// Keys (A7)
ok('r1 key is meeting + segment + kind + target', R.keyOf('M', ['S013', 'S014'], 'ownership', 'AI-403', 'whatever') === 'M|S013|ownership|AI-403');
ok('r2 without a segment the key falls back to the quote', /^M\|q:morgan is addressed/.test(R.keyOf('M', [], 'ambiguous_reference', 'P2', 'Morgan is addressed, directly')));
ok('r3 a changed quote does not change a segment key', R.keyOf('M', ['S1'], 'k', 'T', 'a') === R.keyOf('M', ['S1'], 'k', 'T', 'b'));

// State, supersede, conflict (A2)
let st = R.stateOf([rec('A', K, 'not_needed', '2026-10-13T10:00:00Z', 'Aaron')]);
ok('r4 one record settles the label', st[K].status === 'resolved' && st[K].current.id === 'A');
st = R.stateOf([rec('A', K, 'not_needed', '2026-10-13T10:00:00Z', 'Aaron'), rec('B', K, 'match_person', '2026-10-13T10:05:00Z', 'Dana', ['A'])]);
ok('r5 a superseding record becomes current; the earlier one stays in history', st[K].current.id === 'B' && st[K].all.length === 2);
st = R.stateOf([rec('A', K, 'not_needed', '2026-10-13T10:00:00Z', 'Aaron'), rec('C', K, 'resolve_note', '2026-10-13T10:01:00Z', 'Dana')]);
ok('r6 two records where neither supersedes the other are a conflict (no last-save-wins)', st[K].status === 'conflict' && st[K].current === null && st[K].heads.length === 2);
st = R.stateOf([rec('A', K, 'not_needed', '2026-10-13T10:00:00Z', 'Aaron'), rec('C', K, 'resolve_note', '2026-10-13T10:01:00Z', 'Dana'), rec('D', K, 'match_person', '2026-10-13T11:00:00Z', 'Lee', ['A', 'C'])]);
ok('r7 a record superseding both heads ends the conflict', st[K].status === 'resolved' && st[K].current.id === 'D');
st = R.stateOf([rec('A', K, 'defer', '2026-10-13T10:00:00Z', 'Aaron')]);
ok('r8 a deferral keeps the item open, marked deferred', st[K].status === 'deferred');

// Stale check at Save (A2)
const pend = [{ label: { key: K }, seen: [] }];
ok('r9 a pending action on an untouched label is not stale', R.stale(pend, []).length === 0);
ok('r10 a newer saved record of the same label makes the pending action stale', R.stale(pend, [rec('A', K, 'not_needed', 'x', 'Aaron')]).length === 1);
ok('r11 after superseding (seen updated) it is no longer stale', R.stale([{ label: { key: K }, seen: ['A'] }], [rec('A', K, 'not_needed', 'x', 'Aaron')]).length === 0);
// Knockout: a stale check that ignored the records would let the stale save through.
ok('r12 knockout: stale() really reads the saved records', R.stale(pend, [rec('Z', 'other|S1|k|T', 'not_needed', 'x', 'Aaron')]).length === 0);

// Re-import matching (A7) and the hint
const it = (key, segs, extra = {}) => ({ key, segs, meetingId: R.parseKey(key).meeting, kind: R.parseKey(key).kind, target: R.parseKey(key).target, quote: 'q', ...extra });
let items = [it(K, ['S013'])];
R.attach(items, [rec('A', K, 'not_needed', 'x', 'Aaron')]);
ok('r13 an unchanged label stays resolved after a re-import', items[0].status === 'resolved');
const K2 = '20261001T140000Z|S015|ambiguous_reference|P2';
items = [it(K2, ['S015'])];
R.attach(items, [rec('A', K, 'not_needed', '2026-10-13T10:00:00Z', 'Aaron')]);
ok('r14 a changed label reappears, with the earlier resolution as a hint', items[0].status === 'open' && items[0].hint && items[0].hint.id === 'A');
const KQ = R.keyOf('M', [], 'open_question', 'P2', 'Confirm the observer roster and the visitor process');
items = [it(R.keyOf('M', [], 'open_question', 'P2', 'Confirm the observer roster and visitor process'), [], { quote: 'Confirm the observer roster and visitor process' })];
R.attach(items, [{ ...rec('Q', KQ, 'not_needed', 'x', 'Aaron'), label: { key: KQ, ...R.parseKey(KQ), quote: 'Confirm the observer roster and the visitor process' } }]);
ok('r15 a label without a segment matches by quote similarity (older packages only)', items[0].status === 'resolved');
items = [it('M|S1|open_question|P2', ['S1'], { quote: 'Confirm the observer roster and visitor process' })];
R.attach(items, [{ ...rec('Q', KQ, 'not_needed', 'x', 'Aaron'), label: { key: KQ, ...R.parseKey(KQ), quote: 'Confirm the observer roster and the visitor process' } }]);
ok('r16 knockout: a label WITH a segment never matches by quote', items[0].status === 'open');

// Identity controls (A4)
const people = [{ name: 'Sofia Alvarez', aliases: ['Sofia'] }, { name: 'Dana Brooks', aliases: [] }];
ok('r17 a first name alone cannot create a person', /first name/.test(R.checkPerson({ name: 'Morgan', note: 'x' }, people)));
ok('r18 a role title cannot create a person', /role title/.test(R.checkPerson({ name: 'Event Coordinator', note: 'x' }, people)));
ok('r19 a duplicate of someone on the board is refused', /already on the board/.test(R.checkPerson({ name: 'sofia alvarez', note: 'x' }, people)));
ok('r20 the same first and last name with a middle initial is a duplicate', /already on the board/.test(R.checkPerson({ name: 'Dana Q Brooks', note: 'x' }, people)));
ok('r21 a note is required', /note/.test(R.checkPerson({ name: 'Morgan Reyes', note: '' }, people)));
ok('r22 a full name with a note is accepted', R.checkPerson({ name: 'Morgan Reyes', note: 'per attendee list' }, people) === null);
ok('r23 the name the meeting used is read from the label', R.refName('Morgan is addressed directly, but no Morgan appears') === 'Morgan' && R.refName('Priya is identified only by first name') === 'Priya');

// The save: attestation, not evidence (A1)
const save = R.buildSave([{ label: { key: K, meetingTitle: 'Weekly board walk', meetingDate: '2026-10-01', seg: 'S039', kind: 'ownership', target: 'AI-403', quote: 'Can someone verify the staging area?' },
  action: 'assign', value: { task: 'AI-403', party: 'alvarez' }, note: 'Sofia confirmed by email.', supersedes: [] }],
  { by: 'Aaron Damiano', at: '2026-10-13T15:00:00Z', atText: '2026-10-13 11:00', partyName: () => 'Sofia Alvarez', taskLabel: () => 'Verify staging' });
const t0 = save.segments[0].text;
ok('r24 the statement reads as a reviewer decision, with the meeting basis, the resolver and the note as separate parts',
  /^Reviewer-confirmed assignment: Sofia Alvarez owns AI-403/.test(t0) && /Resolved by: Aaron Damiano, 2026-10-13 11:00\./.test(t0) && /Meeting basis: Weekly board walk, 2026-10-01, S039: “Can someone verify/.test(t0) && /Resolution note: Sofia confirmed by email\.$/.test(t0), t0);
ok('r25 the board change cites the reviewer statement, never the meeting segment', save.ops.length === 1 && save.ops[0].op === 'Reassign' && save.ops[0].src[0].seg === 'S001');
ok('r26 the record keeps the label, the choice, the note, the resolver and time, and is marked attestation', save.records[0].attestation === true && save.records[0].label.seg === 'S039' && save.records[0].by === 'Aaron Damiano' && save.records[0].note === 'Sofia confirmed by email.');
const s2 = R.buildSave([{ label: { key: K }, action: 'not_needed', value: {}, note: 'Not part of this project.' }], { by: 'A', at: 'x', atText: 'x' });
ok('r27 a dismissal makes no board change but is recorded with its reason', s2.ops.length === 0 && s2.records[0].action === 'not_needed' && s2.records[0].note === 'Not part of this project.');

// The fold: aliases and reviewer-added people
const S = { parties: { brooks: { id: 'brooks', name: 'Dana Brooks', aliases: [] }, 'morgan-reyes': { id: 'morgan-reyes', name: 'Morgan Reyes', aliases: [] } } };
R.applyPeople(S, [{ resolutions: [rec('A', K2, 'match_person', '2026-10-13T10:00:00Z', 'Aaron', [], { value: { party: 'brooks', alias: 'Priya' } }),
  rec('B', K, 'add_person', '2026-10-13T10:00:00Z', 'Aaron', [], { value: { partyId: 'morgan-reyes', name: 'Morgan Reyes', org: 'Partner IT', alias: 'Morgan', verified: false } })] }]);
ok('r28 a match records the meeting’s name as another name for the person', S.parties.brooks.aliases.includes('Priya'));
ok('r29 a person added from a partial reference is marked reviewer-added, not yet verified', S.parties['morgan-reyes'].reviewerAdded.unverified === true && S.parties['morgan-reyes'].org === 'Partner IT');
const S3 = { parties: { brooks: { id: 'brooks', name: 'Dana Brooks', aliases: [] } } };
R.applyPeople(S3, [{ resolutions: [rec('A', K2, 'match_person', '2026-10-13T10:00:00Z', 'Aaron', [], { value: { party: 'brooks', alias: 'Priya' } }),
  rec('B', K2, 'not_needed', '2026-10-13T11:00:00Z', 'Dana', ['A'])] }]);
ok('r30 a superseded match no longer adds the alias', !S3.parties.brooks.aliases.includes('Priya'));

// Actions by label (A5)
ok('r31 Unclear reference: Match existing person, Add person, Not needed (plus Resolve with note, Defer)', ['match_person', 'add_person', 'not_needed'].every(a => R.actionsFor('ambiguous_reference').includes(a)));
ok('r32 No owner yet: Assign owner, Keep unassigned, Not needed', ['assign', 'keep_unassigned', 'not_needed'].every(a => R.actionsFor('no_owner').includes(a) && R.actionsFor('ownership').includes(a)));
ok('r33 date labels: Set task date, Reject change, Defer', ['possible_schedule_update', 'date_unclear', 'implied_change'].every(k => ['set_date', 'reject', 'defer'].every(a => R.actionsFor(k).includes(a))));
ok('r34 owner and status changes: Confirm, Reject, Defer', ['confirm_owner', 'reject', 'defer'].every(a => R.actionsFor('possible_owner_change').includes(a)) && ['confirm_status', 'reject', 'defer'].every(a => R.actionsFor('possible_status_change').includes(a)));
ok('r35 every other label: Resolve with note, Not needed, Defer', ['open_question', 'conflict', 'suggestion', 'check_scope', 'may_be_separate', 'not_a_task_yet', 'possibly_missed', 'meeting_admin', 'schedule_context', 'possible_update', 'unmatched'].every(k => ['resolve_note', 'not_needed', 'defer'].every(a => R.actionsFor(k).includes(a))));
ok('r36 each board-changing action says it is the reviewer’s decision', ['assign', 'confirm_owner', 'confirm_status', 'set_date', 'add_person', 'match_person'].every(a => /decision/.test(R.consequence(a))));

// Aaron's question (2026-10-13): attaching places an item without settling it; the basis carries every statement in full.
st = R.stateOf([rec('A', K, 'attach', '2026-10-13T10:00:00Z', 'Aaron', [], { value: { project: 'P2', task: 'AI-207' } })]);
ok('r39 an attached item is placed, not settled', st[K].status === 'placed');
st = R.stateOf([rec('A', K, 'attach', '2026-10-13T10:00:00Z', 'Aaron'), rec('B', K, 'resolve_note', '2026-10-13T11:00:00Z', 'Aaron', ['A'])]);
ok('r40 a decision after attaching replaces the attachment', st[K].status === 'resolved' && st[K].current.id === 'B');
const long = 'x'.repeat(400);
ok('r41 the meeting basis keeps every cited statement in full', R.basisText({ meetingTitle: 'M', meetingDate: 'd', quotes: [{ seg: 'S1', text: long }, { seg: 'S2', text: 'second' }] }).includes(long) && R.basisText({ meetingTitle: 'M', quotes: [{ seg: 'S1', text: 'a' }, { seg: 'S2', text: 'second' }] }).includes('S2: \u201csecond'));
ok('r42 every label but a person to verify can be attached', R.actionsFor('ambiguous_reference').includes('attach') && R.actionsFor('open_question').includes('attach') && !R.actionsFor('person_unverified').includes('attach'));
ok('r43 a quoted name in the note is read as the unclear name', R.refName('No one named \u201cGreg T.\u201d appears on the board') === 'Greg T.');

// §16.12: actions by topic; decisions with several steps.
ok('r44 a full name in the note is found; places and contract words are not', JSON.stringify(R.namesIn('Paul Morrisseau owns shipment from TTOC to El Paso for Operation Borderline Gauntlet; Contract 0.3.0 does not support NewParty.')) === '["Paul Morrisseau"]', JSON.stringify(R.namesIn('Paul Morrisseau owns shipment from TTOC to El Paso for Operation Borderline Gauntlet; Contract 0.3.0 does not support NewParty.')));
ok('r45 "Not matched to the board" about a person offers the person actions; about a task, Create task', R.actionsFor('unmatched', { person: 'Paul Morrisseau' }).slice(0, 2).join() === 'match_person,add_person' && R.actionsFor('unmatched', { person: '' })[0] === 'create_task');
ok('r46 Add person carries the name', R.actionLabel('add_person', 'unmatched', { person: 'Paul Morrisseau' }) === 'Add person: Paul Morrisseau');
ok('r47 suggestion, overdue, conflict and open question have their own starting actions', R.actionsFor('suggestion').includes('create_task') && R.actionsFor('suggestion').includes('task_note') && R.actionsFor('overdue').includes('confirm_status') && R.actionsFor('conflict').includes('assign') && R.actionsFor('open_question').includes('create_task'));
const dec = R.buildSave([{ label: { key: K }, outcome: 'settle', note: 'Paul runs logistics.', steps: [{ type: 'add_person', name: 'Paul Morrisseau', org: 'Partner' },
  { type: 'create_task', title: 'Coordinate sensor shipment', project: 'P2', owner: '@0' }, { type: 'task_note', task: '@1', text: 'Ship by Oct 20.' }] }],
  { by: 'Aaron', at: 'x', atText: 'x', partyName: id => id, projectName: c => c });
ok('r48 one decision makes one statement and one op per board-changing step, in order', dec.segments.length === 1 && dec.ops.map(o => o.op).join() === 'NewParty,NewTasking,ProgressNote' && dec.ops.every(o => o.src[0].seg === 'S001'));
ok('r49 steps refer to earlier steps by reference (new person as owner, new task for the note)', dec.ops[1].assignee === dec.ops[0].ref && dec.ops[2].tasking === dec.ops[1].ref);
ok('r50 the record keeps the steps, the outcome and the op map', dec.records[0].action === 'decision' && dec.records[0].steps.length === 3 && dec.records[0].outcome === 'settle' && dec.opMap.map(m => m.k).join() === '0,1,2');
ok('r51 the statement reads as the reviewer\u2019s decision, step by step', /^Reviewer-added person: Paul Morrisseau \(Partner\)\. Not yet verified; Reviewer-created task: “Coordinate sensor shipment” in P2, owner Paul Morrisseau; Reviewer note on the new task “Coordinate sensor shipment”/.test(dec.segments[0].text), dec.segments[0].text.slice(0, 200));
st = R.stateOf([{ id: 'A', label: { key: K }, at: 'x', steps: [{ type: 'create_task' }], outcome: 'open' }]);
ok('r52 a decision kept open leaves the item open (placed)', st[K].status === 'placed');
const S4 = { parties: { 'paul-morrisseau': { id: 'paul-morrisseau', name: 'Paul Morrisseau', aliases: [] } } };
R.applyPeople(S4, [{ resolutions: [{ id: 'A', label: { key: K }, at: 'x', by: 'Aaron', steps: [{ type: 'add_person', partyId: 'paul-morrisseau', org: 'Partner', verified: false }, { type: 'create_task' }] }] }]);
ok('r53 a person added in a multi-step decision is marked reviewer-added', S4.parties['paul-morrisseau'].reviewerAdded && S4.parties['paul-morrisseau'].reviewerAdded.unverified === true);

// §16.13: Teams attendance.
ok('r54 an attendee is keyed by email when the report has one, by name otherwise, never by meeting', R.attendeeKey({ name: 'Reyes, Morgan', email: 'Morgan.Reyes@Partner.example' }) === 'attendee|morgan.reyes@partner.example|attendee_unmatched|morgan.reyes@partner.example' && R.attendeeKey({ name: 'Conference Room 4B' }) === 'attendee|n:conference room 4b|attendee_unmatched|n:conference room 4b');
ok('r55 an attendee offers Match existing person, Add person, Not needed and Defer', R.actionsFor('attendee_unmatched').join() === 'match_person,add_person,not_needed,defer');
ok('r56 an email already on someone is a duplicate', /already on the board/.test(R.checkPerson({ name: 'Morgan Reyes', email: 'm@x.example', note: 'n' }, [{ name: 'M. Reyes', aliases: [], emails: ['m@x.example'] }])));
const S5 = { parties: { brooks: { id: 'brooks', name: 'Dana Brooks', aliases: [] } } };
R.applyPeople(S5, [{ resolutions: [{ id: 'A', label: { key: 'attendee|d@x|attendee_unmatched|d@x' }, at: 'x', by: 'A', steps: [{ type: 'match_person', party: 'brooks', alias: 'D. Brooks', email: 'D@x' }] }] }]);
ok('r57 a match records the report\u2019s name and email on the person', S5.parties.brooks.aliases.includes('D. Brooks') && S5.parties.brooks.emails.includes('d@x'));

// §16.15 resolution cards (ratified 2026-10-14).
const PR = { ownership: 'assign', no_owner: 'assign', possible_owner_change: 'assign', possible_status_change: 'confirm_status', suggestion: 'create_task', not_a_task_yet: 'create_task',
  open_question: 'answer', conflict: 'answer', implied_change: 'answer', date_unclear: 'answer', possible_schedule_update: 'answer', overdue: 'answer', check_scope: 'answer', person_unverified: 'verify_person', attendee_unmatched: 'match_person' };
ok('r58 each label has its primary action; the date labels get Answer', Object.entries(PR).every(([k, v]) => R.primaryFor(k, {}) === v), JSON.stringify(Object.keys(PR).map(k => [k, R.primaryFor(k, {})])));
ok('r59 a reference or unmatched person gets Identify person; without a name, Answer or Create task', R.primaryFor('ambiguous_reference', { person: 'Morgan' }) === 'match_person' && R.primaryFor('ambiguous_reference', { person: '' }) === 'answer'
  && R.primaryFor('unmatched', { person: 'Paul Morrisseau' }) === 'match_person' && R.primaryFor('unmatched', { person: '' }) === 'create_task');
ok('r60 More holds Create task, Link, Add a note, Set task date and Not needed, never the primary', R.moreFor('open_question', {}).join() === 'create_task,attach,task_note,set_date,not_needed' && !R.moreFor('suggestion', {}).includes('create_task'));
const an = R.buildSave([{ label: { key: K }, answer: { type: 'date', value: { from: '2026-05-18', to: '2026-05-22', yearKnown: false }, display: 'May 18–22, year not known' }, steps: [], outcome: 'open', note: 'Oct 1 board walk.' }],
  { by: 'Aaron', at: 'x', atText: 'x' });
ok('r61 an answer is a Resolve-with-note record holding the answer; kept open makes no change', an.records[0].action === 'resolve_note' && an.records[0].value.answer === 'May 18–22, year not known' && an.records[0].outcome === 'open' && an.ops.length === 0
  && /^Reviewer answer: May 18–22, year not known; kept open \(not confirmed yet\)\. Resolved by/.test(an.segments[0].text), an.segments[0].text.slice(0, 120));
const an2 = R.buildSave([{ label: { key: K }, answer: { type: 'text', value: 'Separate tables', display: 'Separate tables' }, steps: [{ type: 'task_note', task: 'AI-206', text: 'Answer: Separate tables' }], outcome: 'settle', note: 'n' }], { by: 'A', at: 'x', atText: 'x', taskLabel: () => '' });
ok('r62 a ticked change becomes a step of the answer, with its op; the record stays an answer', an2.records[0].action === 'resolve_note' && an2.ops.map(o => o.op).join() === 'ProgressNote' && an2.records[0].steps.length === 1 && R.stateOf(an2.records.map(x => ({ ...x, id: 'X' })))[K].status === 'resolved');

// A8 / criterion 16: PROJ-ORPHAN-OP is placed and labeled, not stopped, in code and in the plan.
const fs = require('fs'), src = fs.readFileSync(__dirname + '/../../src/modules/ux11.js', 'utf8');
const planPath = [__dirname + '/mkg-dux12-plan.md', __dirname + '/../mkg-dux12-plan.md', __dirname + '/../../docs/mkg-dux12-plan.md'].find(p => fs.existsSync(p));
const plan = planPath ? fs.readFileSync(planPath, 'utf8') : null;
const hard = src.slice(src.indexOf('const HARD_REASON'), src.indexOf('};', src.indexOf('const HARD_REASON')));
const scope = src.slice(src.indexOf('const SCOPE_BLOCKS'), src.indexOf(';', src.indexOf('const SCOPE_BLOCKS')));
ok('r37 PROJ-ORPHAN-OP is not a hard stop in the code, and is a scope label', !hard.includes('PROJ-ORPHAN-OP') && scope.includes('PROJ-ORPHAN-OP'));
if (plan) ok('r38 the plan says the same (§2 corrected)', /PROJ-ORPHAN-OP was listed here in error/.test(plan) && /PROJ-ORPHAN-OP is not a hard stop/.test(plan));
else console.log('SKIP r38 (put mkg-dux12-plan.md next to this file to check the plan text)');

console.log(`\n${n - bad}/${n} passed${bad ? ` — ${bad} FAILED` : ''}`);
process.exit(bad ? 1 : 0);
