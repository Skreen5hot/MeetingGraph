/* Layer B: extraction tests on synthetic transcripts.
 * Paste each test's input into the extraction prompt on the enterprise LLM, paste the JSON output back, grade.
 * A test passes a run only when every assertion holds AND the validator raises no blocking flag.
 * A test passes overall at 3 of 3 runs.
 */
(function (root) {
'use strict';
const V = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('../../src/modules/validator.js') : root.MGValidator;

const MEETING_DATE = '2026-10-14';
const REGISTER = {
  projects: [
    { id: 'P1', title: 'Field demo', description: 'Plan the host-site field demonstration' },
    { id: 'P2', title: 'Sensor program', description: 'Sensor payload development' },
    { id: 'P3', title: 'Admin and meetings', description: 'Recurring meetings and invitations' }
  ],
  tasks: [
    { id: 'T-1', project: 'P1', title: 'Coordinate travel with host site', description: 'Vehicle access and arrival logistics with the host', owner: 'Lee', status: 'active' },
    { id: 'T-2', project: 'P1', title: 'Provide point-of-contact details for arrival', description: 'Obtain the host point of contact for arrival day', owner: null, status: 'active' },
    { id: 'T-3', project: 'P1', title: 'Maintain travel roster', description: 'Track who travels, who must be on site, and the activity window', owner: 'Lee', status: 'active' },
    { id: 'T-4', project: 'P2', title: 'Integrate sensor payload', description: 'Mounting, wind limits, field of view and flight plan for the P2 payload', owner: 'Kim', status: 'active' },
    { id: 'T-5', project: 'P3', title: 'Send recurring meeting invitations', description: 'Maintain recurring invites and the attendee list', owner: 'Lee', status: 'active' },
    { id: 'T-6', project: 'P3', title: 'Clean up shared contact list', description: 'Remove stale entries from the team contact list', owner: 'Ray', status: 'active' }
  ]
};

const segs = rows => rows.map(([id, speaker, text]) => ({ id, speaker, text }));

/* ---------- assertion helpers (run on the adapted package) ---------- */
const ops = A => A.ops;
const on = (A, t) => A.ops.filter(o => o.target === t);
const creates = A => A.ops.filter(o => o.kind === 'CreateTask');
const cites = (o, ...s) => s.every(x => (o.cites || []).includes(x));
const citesAny = (o, ...s) => s.some(x => (o.cites || []).includes(x));
const covOf = (A, id) => (A.registerCoverage.find(c => c.id === id) || {}).coverage;
const covNote = (A, id) => (A.registerCoverage.find(c => c.id === id) || {}).note || '';
const has = (s, re) => re.test(String(s || ''));
const projOf = (A, o) => o.target ? (REGISTER.tasks.find(t => t.id === o.target) || {}).project : o.project;
const noBlock = (r, code, ref) => !r.flags.some(f => f.sev === 'block' && f.code === code && (!ref || f.ref === ref));

const TESTS = [
  { id: 'B01', title: 'Paraphrased POC request matches the existing task',
    segments: segs([['S01', 'Ana', 'Can you get us someone we can call directly when we show up?'], ['S02', 'Lee', "Yep, I'll get you a name and number."], ['S03', 'Ana', 'Perfect.']]),
    asserts: [
      ['must', 'T-2 reassigned from null to Lee', A => on(A, 'T-2').some(o => o.kind === 'Reassign' && o.to === 'Lee')],
      ['must', 'T-2 ProgressNote cites S02', A => on(A, 'T-2').some(o => o.kind === 'ProgressNote' && cites(o, 'S02'))],
      ['must', 'T-2 coverage is not not_discussed', A => covOf(A, 'T-2') && covOf(A, 'T-2') !== 'not_discussed'],
      ['mustNot', 'no new task created for the POC', A => !creates(A).some(o => citesAny(o, 'S01', 'S02'))],
      ['mustNot', 'no T-1 op carries the POC segments', A => !on(A, 'T-1').some(o => citesAny(o, 'S01', 'S02'))]
    ] },
  { id: 'B02', title: 'Greeting alone does not create a party',
    segments: segs([['S01', 'Lee', 'Morning, Dana.'], ['S02', 'Lee', "Let's start with the roster."], ['S03', 'Lee', 'No changes to the travel roster this week.']]),
    asserts: [
      ['mustNot', 'no NewParty op', A => !ops(A).some(o => o.kind === 'NewParty')],
      ['mustNot', 'Dana owns nothing', A => !ops(A).some(o => o.owner === 'Dana' || o.to === 'Dana' || has(o.title, /dana/i))]
    ] },
  { id: 'B03', title: 'Stated capability is not an accepted task',
    segments: segs([['S01', 'Joel', "We've got two generators on site if you need power."], ['S02', 'Lee', 'Good to know.']]),
    asserts: [
      ['mustNot', 'no CreateTask', A => creates(A).length === 0],
      ['mustNot', 'Joel owns nothing', A => !ops(A).some(o => o.owner === 'Joel' || o.to === 'Joel')]
    ] },
  { id: 'B04', title: 'Compound commitment in one sentence splits into two tasks',
    segments: segs([['S01', 'Lee', "I'll send out this transcript, and today I'll get you Thursday's summaries."]]),
    asserts: [
      ['must', 'a transcript task owned by Lee', A => creates(A).some(o => has(o.title, /transcript/i) && !has(o.title, /summar/i) && o.owner === 'Lee')],
      ['must', 'a summaries task timed "today" -> meeting date', A => creates(A).some(o => has(o.title, /summar/i) && !has(o.title, /transcript/i) && o.timing && /today/i.test(o.timing.phrase || '') && o.timing.resolved === MEETING_DATE)],
      ['mustNot', 'transcript task carries no resolved date', A => !creates(A).some(o => has(o.title, /transcript/i) && !has(o.title, /summar/i) && o.timing && o.timing.resolved)],
      ['mustNot', 'no single task covers both', A => !creates(A).some(o => has(o.title, /transcript/i) && has(o.title, /summar/i))]
    ] },
  { id: 'B05', title: 'Verification with acceptance vs contingency without acceptance',
    segments: segs([['S01', 'Ana', 'Can you check that the gate fits the trailer?'], ['S02', 'Lee', 'Will do.'],
      ['S03', 'Ana', "And the pad - if it's gravel we need another spot."], ['S04', 'Lee', "Let's see what the range says."]]),
    asserts: [
      ['must', 'gate task owned by Lee citing S01 and S02', A => creates(A).some(o => has(o.title, /gate|entry/i) && o.owner === 'Lee' && cites(o, 'S01', 'S02'))],
      ['must', 'parking item unassigned, cites S03', A => ops(A).some(o => ['CreateTask', 'OpenQuestion'].includes(o.kind) && has(o.title, /pad|park|surface/i) && !o.owner && cites(o, 'S03'))],
      ['must', 'parking item keeps the alternate-location contingency', A => ops(A).some(o => has(o.title, /pad|park|surface/i) && has(o.title, /alternat|another|other (spot|location|site)|relocat/i))],
      ['mustNot', 'parking not owned by Lee', A => !ops(A).some(o => has(o.title, /pad|park|surface/i) && o.owner === 'Lee')],
      ['mustNot', 'gate and pad not in one op', A => !ops(A).some(o => citesAny(o, 'S01', 'S02') && citesAny(o, 'S03'))]
    ] },
  { id: 'B06', title: 'Attendee name does not pull in their project',
    segments: segs([['S01', 'Lee', "Kim's joining us today."], ['S02', 'Kim', 'Can we move the weekly invite to Tuesdays?'],
      ['S03', 'Lee', "Sure, I'll update it."], ['S04', 'Lee', 'I sent the invites Friday, by the way.']]),
    asserts: [
      ['must', 'T-5 op cites S03 or S04', A => on(A, 'T-5').some(o => citesAny(o, 'S03', 'S04'))],
      ['must', 'P3 in coveredProjects', A => A.coveredProjects.includes('P3')],
      ['mustNot', 'P2 not in coveredProjects', A => !A.coveredProjects.includes('P2')],
      ['mustNot', 'no op on T-4', A => on(A, 'T-4').length === 0]
    ] },
  { id: 'B07', title: 'Similar technical talk about another program stays out',
    segments: segs([['S01', 'Raj', 'On the Navy program they mounted their sensor on the mast and lost half the field of view.'], ['S02', 'Raj', "Worth remembering, but it's not ours."]]),
    asserts: [
      ['mustNot', 'no op on T-4', A => on(A, 'T-4').length === 0],
      ['mustNot', 'P2 not in coveredProjects', A => !A.coveredProjects.includes('P2')],
      ['must', 'T-4 not_discussed carries a rationale (it overlaps)', A => covOf(A, 'T-4') === 'not_discussed' && V.validRationale(covNote(A, 'T-4'))]
    ] },
  { id: 'B08', title: 'Schedule goes to the roster task; VIP list stays project-level',
    segments: segs([['S01', 'Lee', "The window is now November 2 through 6; we still don't know who travels."], ['S02', 'Ana', 'And the VIP list keeps changing.']]),
    asserts: [
      ['must', 'T-3 ProgressNote cites S01', A => on(A, 'T-3').some(o => o.kind === 'ProgressNote' && cites(o, 'S01'))],
      ['must', 'P1 OpenQuestion cites S02', A => ops(A).some(o => o.kind === 'OpenQuestion' && projOf(A, o) === 'P1' && cites(o, 'S02'))],
      ['mustNot', 'schedule not on T-1', A => !on(A, 'T-1').some(o => cites(o, 'S01'))],
      ['mustNot', 'VIP list not on T-3', A => !on(A, 'T-3').some(o => cites(o, 'S02'))]
    ] },
  { id: 'B09', title: 'Vague commitment is never silent',
    segments: segs([['S01', 'Lee', "We'll start tracking all of these."]]),
    asserts: [
      ['must', 'S01 bound by an op or a real rationale', (A, r) => noBlock(r, 'COV-UNBOUND-DISPOSITION', 'S01') && noBlock(r, 'COV-EMPTY-RATIONALE', 'S01') && noBlock(r, 'REF-DANGLING', 'S01')]
    ] },
  { id: 'B10', title: 'Invitation change is captured on the invitation task',
    segments: segs([['S01', 'Ana', 'Add Carter and Mandrick to the invite.'], ['S02', 'Lee', 'Done after this.']]),
    asserts: [
      ['must', 'T-5 op or a P3 task owned by Lee cites S02', A => ops(A).some(o => cites(o, 'S02') && (o.target === 'T-5' || (o.kind === 'CreateTask' && projOf(A, o) === 'P3' && o.owner === 'Lee')))],
      ['must', 'no unbound disposition', (A, r) => noBlock(r, 'COV-UNBOUND-DISPOSITION')]
    ] },
  { id: 'B11', title: 'Lexical neighbour is matched to the right task',
    segments: segs([['S01', 'Ana', 'Has anyone touched the contact list cleanup?'], ['S02', 'Ray', 'Not yet.']]),
    asserts: [
      ['must', 'T-6 coverage is discussed', A => covOf(A, 'T-6') === 'discussed'],
      ['mustNot', 'no T-2 op cites these segments', A => !on(A, 'T-2').some(o => citesAny(o, 'S01', 'S02'))]
    ] },
  { id: 'B12', title: 'Control: nothing actionable produces nothing',
    segments: segs([['S01', 'Lee', 'Cold one this morning.'], ['S02', 'Ana', 'Supposed to warm up by Thursday.']]),
    asserts: [
      ['must', 'zero ops', A => ops(A).length === 0],
      ['must', 'coveredProjects empty', A => A.coveredProjects.length === 0],
      ['must', 'every task not_discussed', A => REGISTER.tasks.every(t => covOf(A, t.id) === 'not_discussed')]
    ] }
];

/* ---------- Grader self-check: a correct answer must pass, the anticipated mistake must fail ---------- */
function mk(test, spec) {
  const covered = spec.cov || {};
  return {
    contextToken: 'TEST-' + test,
    dispositions: spec.disp.map(([seg, cls, unit, links, note]) => ({ seg, cls, unit: unit || null, links: links || [], note: note || '' })),
    ops: spec.ops || [],
    registerCoverage: REGISTER.tasks.map(t => ({ id: t.id, coverage: (covered[t.id] && covered[t.id][0]) || 'not_discussed', note: (covered[t.id] && covered[t.id][1]) || '' })),
    coveredProjects: spec.projects || [],
    flags: []
  };
}
const SAMPLES = {
  B01: {
    good: mk('B01', { disp: [['S01', 'request', 'U-poc', ['T-2']], ['S02', 'commitment', 'U-poc', ['T-2']], ['S03', 'other']],
      ops: [{ id: 'OP-1', kind: 'Reassign', target: 'T-2', title: 'Reassign to Lee', to: 'Lee', cites: ['S01', 'S02'] },
        { id: 'OP-2', kind: 'ProgressNote', target: 'T-2', title: 'Lee will get a direct contact name and number for arrival', cites: ['S01', 'S02'] }],
      cov: { 'T-2': ['discussed'] }, projects: ['P1'] }),
    bad: mk('B01', { disp: [['S01', 'request', 'U-poc'], ['S02', 'commitment', 'U-poc'], ['S03', 'other']],
      ops: [{ id: 'NEW-1', kind: 'CreateTask', project: 'P1', title: 'Provide arrival contact name and number', owner: 'Lee', cites: ['S01', 'S02'] }],
      projects: ['P1'] })
  },
  B02: {
    good: mk('B02', { disp: [['S01', 'greeting'], ['S02', 'context'], ['S03', 'status_update', 'U-r', ['T-3']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-3', title: 'No travel roster changes this week', cites: ['S03'] }],
      cov: { 'T-3': ['discussed'] }, projects: ['P1'] }),
    bad: mk('B02', { disp: [['S01', 'greeting'], ['S02', 'context'], ['S03', 'status_update', 'U-r', ['T-3']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-3', title: 'No travel roster changes this week', cites: ['S03'] },
        { id: 'NEW-P1', kind: 'NewParty', title: 'Dana', cites: ['S01'] }],
      cov: { 'T-3': ['discussed'] }, projects: ['P1'] })
  },
  B03: {
    good: mk('B03', { disp: [['S01', 'context'], ['S02', 'other']] }),
    bad: mk('B03', { disp: [['S01', 'context'], ['S02', 'other']],
      ops: [{ id: 'NEW-1', kind: 'CreateTask', project: 'P1', title: 'Provide onsite power', owner: 'Joel', cites: ['S01'] }], projects: ['P1'] })
  },
  B04: {
    good: mk('B04', { disp: [['S01', 'commitment', 'U-docs']],
      ops: [{ id: 'NEW-1', kind: 'CreateTask', project: 'P3', title: 'Distribute this meeting transcript', owner: 'Lee', timing: null, cites: ['S01'] },
        { id: 'NEW-2', kind: 'CreateTask', project: 'P3', title: "Send Thursday's meeting summaries", owner: 'Lee', timing: { phrase: 'today', resolved: MEETING_DATE }, cites: ['S01'] }],
      projects: ['P3'] }),
    bad: mk('B04', { disp: [['S01', 'commitment', 'U-docs']],
      ops: [{ id: 'NEW-1', kind: 'CreateTask', project: 'P3', title: "Send transcript and Thursday's summaries", owner: 'Lee', timing: { phrase: 'today', resolved: MEETING_DATE }, cites: ['S01'] }],
      projects: ['P3'] })
  },
  B05: {
    good: mk('B05', { disp: [['S01', 'request', 'U-gate'], ['S02', 'commitment', 'U-gate'], ['S03', 'open_question', 'U-pad'], ['S04', 'other']],
      ops: [{ id: 'NEW-1', kind: 'CreateTask', project: 'P1', title: 'Verify the gate fits the trailer', owner: 'Lee', cites: ['S01', 'S02'] },
        { id: 'NEW-2', kind: 'CreateTask', project: 'P1', title: 'Verify parking pad surface; find another spot if gravel', owner: null, cites: ['S03'] }],
      projects: ['P1'] }),
    bad: mk('B05', { disp: [['S01', 'request', 'U-gate'], ['S02', 'commitment', 'U-gate'], ['S03', 'open_question', 'U-pad'], ['S04', 'other']],
      ops: [{ id: 'NEW-1', kind: 'CreateTask', project: 'P1', title: 'Verify the gate fits the trailer', owner: 'Lee', cites: ['S01', 'S02'] },
        { id: 'NEW-2', kind: 'CreateTask', project: 'P1', title: 'Verify parking pad surface', owner: 'Lee', cites: ['S03', 'S04'] }],
      projects: ['P1'] })
  },
  B06: {
    good: mk('B06', { disp: [['S01', 'context'], ['S02', 'request', 'U-move', ['T-5']], ['S03', 'commitment', 'U-move', ['T-5']], ['S04', 'status_update', 'U-sent', ['T-5']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-5', title: 'Lee to move the weekly invite to Tuesdays', cites: ['S02', 'S03'] },
        { id: 'OP-2', kind: 'ProgressNote', target: 'T-5', title: 'Lee reports invites sent Friday', cites: ['S04'] }],
      cov: { 'T-5': ['discussed'] }, projects: ['P3'] }),
    bad: mk('B06', { disp: [['S01', 'context', null, ['T-4']], ['S02', 'request', 'U-move', ['T-5']], ['S03', 'commitment', 'U-move', ['T-5']], ['S04', 'status_update', 'U-sent', ['T-5']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-5', title: 'Lee to move the weekly invite to Tuesdays', cites: ['S02', 'S03'] },
        { id: 'OP-2', kind: 'ProgressNote', target: 'T-5', title: 'Lee reports invites sent Friday', cites: ['S04'] },
        { id: 'OP-3', kind: 'ProgressNote', target: 'T-4', title: 'Kim attended', cites: ['S01'] }],
      cov: { 'T-5': ['discussed'], 'T-4': ['discussed'] }, projects: ['P2', 'P3'] })
  },
  B07: {
    good: mk('B07', { disp: [['S01', 'context'], ['S02', 'other']],
      cov: { 'T-4': ['not_discussed', 'The Navy mast-mounting example is another program, not the P2 payload integration task.'] } }),
    bad: mk('B07', { disp: [['S01', 'status_update', 'U-mast', ['T-4']], ['S02', 'other']],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-4', title: 'Mast mounting cost half the field of view', cites: ['S01'] }],
      cov: { 'T-4': ['discussed'] }, projects: ['P2'] })
  },
  B08: {
    good: mk('B08', { disp: [['S01', 'status_update', 'U-win', ['T-3']], ['S02', 'open_question', 'U-vip']],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-3', title: 'Window narrowed to Nov 2-6; travelers not yet known', cites: ['S01'] },
        { id: 'OQ-1', kind: 'OpenQuestion', project: 'P1', title: 'VIP list keeps changing', cites: ['S02'] }],
      cov: { 'T-3': ['discussed'] }, projects: ['P1'] }),
    bad: mk('B08', { disp: [['S01', 'status_update', 'U-win', ['T-1']], ['S02', 'open_question', 'U-vip', ['T-3']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-1', title: 'Window narrowed to Nov 2-6', cites: ['S01'] },
        { id: 'OP-2', kind: 'ProgressNote', target: 'T-3', title: 'VIP list keeps changing', cites: ['S02'] }],
      cov: { 'T-1': ['discussed'], 'T-3': ['discussed'] }, projects: ['P1'] })
  },
  B09: {
    good: mk('B09', { disp: [['S01', 'commitment', 'U-track', [], 'General intent to track the open items; no specific deliverable or owner was stated.']] }),
    bad: mk('B09', { disp: [['S01', 'commitment', 'U-track']] })
  },
  B10: {
    good: mk('B10', { disp: [['S01', 'request', 'U-add', ['T-5']], ['S02', 'commitment', 'U-add', ['T-5']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-5', title: 'Lee to add Carter and Mandrick to the invite', cites: ['S01', 'S02'] }],
      cov: { 'T-5': ['discussed'] }, projects: ['P3'] }),
    bad: mk('B10', { disp: [['S01', 'request', 'U-add'], ['S02', 'commitment', 'U-add']] })
  },
  B11: {
    good: mk('B11', { disp: [['S01', 'open_question', 'U-cl', ['T-6']], ['S02', 'status_update', 'U-cl', ['T-6']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-6', title: 'No progress yet on the contact list cleanup', cites: ['S01', 'S02'] }],
      cov: { 'T-6': ['discussed'] }, projects: ['P3'] }),
    bad: mk('B11', { disp: [['S01', 'open_question', 'U-cl', ['T-2']], ['S02', 'status_update', 'U-cl', ['T-2']]],
      ops: [{ id: 'OP-1', kind: 'ProgressNote', target: 'T-2', title: 'Contact not yet obtained', cites: ['S01', 'S02'] }],
      cov: { 'T-2': ['discussed'] }, projects: ['P1'] })
  },
  B12: {
    good: mk('B12', { disp: [['S01', 'other'], ['S02', 'other']] }),
    bad: mk('B12', { disp: [['S01', 'other'], ['S02', 'other']],
      ops: [{ id: 'NEW-1', kind: 'CreateTask', project: 'P1', title: 'Check Thursday weather', owner: 'Ana', cites: ['S02'] }], projects: ['P1'] })
  }
};

function selfCheck() {
  return TESTS.map(t => {
    const g = grade(t.id, SAMPLES[t.id].good), b = grade(t.id, SAMPLES[t.id].bad);
    return { id: t.id, goodPasses: g.pass, badFails: !b.pass, ok: g.pass && !b.pass, good: g, bad: b };
  });
}

function inputText(test) {
  return [
    `MEETING DATE: ${MEETING_DATE}`,
    `CONTEXT TOKEN: TEST-${test.id}`,
    '',
    'TRANSCRIPT:',
    ...test.segments.map(s => `${s.id} [${s.speaker}]: ${s.text}`),
    '',
    'CURRENT REGISTER (JSON):',
    JSON.stringify(REGISTER, null, 2)
  ].join('\n');
}

function grade(testId, rawPkg) {
  const test = TESTS.find(t => t.id === testId);
  const ctx = { meetingDate: MEETING_DATE, segments: test.segments, register: REGISTER };
  const r = V.validate(rawPkg, ctx);
  const A = V.adapt(rawPkg);
  const results = test.asserts.map(([kind, text, fn]) => {
    let ok = false, err = null;
    try { ok = !!fn(A, r); } catch (e) { err = String(e.message || e); }
    return { kind, text, ok, err };
  });
  return { pass: results.every(x => x.ok) && !r.blocked, results, validator: r };
}

const api = { MEETING_DATE, REGISTER, TESTS, SAMPLES, inputText, grade, selfCheck };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGLayerB = api;
})(typeof window !== 'undefined' ? window : globalThis);
