/* Layer A: gold package, positive controls, mutation fixtures, runner.
 * The transcript is a SYNTHETIC reconstruction of the Oct 9 meeting built from the review.
 * Segment IDs named in the review (S052-S058, S093, S112, S117) are kept; others are invented.
 * For R01, run the real Oct 9 package and transcript through the "Any package" tab instead.
 */
(function (root) {
'use strict';
const V = (typeof require !== 'undefined' && typeof module !== 'undefined') ? require('../../src/modules/validator.js') : root.MGValidator;
const clone = x => JSON.parse(JSON.stringify(x));

const REGISTER = {
  projects: [
    { id: 'P5', title: 'Counter-UAS modeling and simulation', description: 'Threat modeling and simulation scenarios' },
    { id: 'P6', title: 'Fort Bliss field demonstration', description: 'Plan and execute the Fort Bliss field demonstration' },
    { id: 'P7', title: 'BEMS energy management', description: 'Building energy management system integration' },
    { id: 'P11', title: 'Program administration and meetings', description: 'Recurring meetings, invitations and program artifacts' }
  ],
  tasks: [
    { id: 'AI-13', project: 'P5', title: 'Develop simulation scenarios for threat profiles', description: 'Model threat profiles for the counter-UAS simulation', owner: 'Kyle', status: 'active' },
    { id: 'AI-17', project: 'P6', title: 'Maintain travel roster for demonstration team', description: 'Track who travels and who must be on site', owner: 'Mark', status: 'active' },
    { id: 'AI-19', project: 'P6', title: 'Travel coordination with DoW', description: 'Coordinate vehicle access and arrival logistics with the DoW host', owner: 'Mark', status: 'active' },
    { id: 'AI-22', project: 'P7', title: 'BEMS meter data pipeline', description: 'Ingest BEMS meter data into the warehouse', owner: 'Kyle', status: 'active' },
    { id: 'AI-23', project: 'P7', title: 'BEMS dashboard prototype', description: 'Prototype the BEMS energy dashboard', owner: 'Kyle', status: 'active' },
    { id: 'AI-25', project: 'P7', title: 'BEMS vendor coordination', description: 'Coordinate with the BEMS vendor on meter install', owner: 'Kyle', status: 'active' },
    { id: 'AI-40', project: 'P11', title: 'Send recurring meeting invitations', description: 'Maintain recurring invites and attendee lists', owner: 'Mark', status: 'active' },
    { id: 'AI-55', project: 'P6', title: 'Provide point-of-contact details', description: 'Obtain the host point of contact for arrival day', owner: null, status: 'active' },
    { id: 'AI-58', project: 'P6', title: 'Sensor integration', description: 'Integrate sensor payload: mounting, wind limits, field of view, flight plan', owner: 'Raj', status: 'active' }
  ]
};
// Control-only register items (added by C2, C3, A19)
const AI90 = { id: 'AI-90', project: 'P6', title: 'Update range safety brief', description: 'Revise the range safety briefing slides', owner: 'Raj', status: 'active' };
const AI91 = { id: 'AI-91', project: 'P11', title: 'Clean up shared contact list', description: 'Remove stale entries from the team contact list', owner: 'Mark', status: 'active' };

const SEGMENTS = [
  ['S001', 'Mark', 'Good morning, Joel.'],
  ['S002', 'Mark', "Brian sends his regards; he's out today."],
  ['S003', 'Mark', "Kyle's on the line as well."],
  ['S010', 'Mark', "I'll send the Fort Bliss location and planning slide deck this morning."],
  ['S050', 'Mark', "I'll coordinate with the range office on vehicle access, parking, and setup for the trailer."],
  ['S052', 'Lena', 'Can you get us a direct point of contact for when we arrive?'],
  ['S053', 'Mark', 'Yes, I will get that POC for you.'],
  ['S054', 'Mark', "I'll send the contact details for the arrival team once I have them."],
  ['S055', 'Lena', 'Thanks.'],
  ['S057', 'Lena', 'Can you verify the designated entry route will accommodate the trailer?'],
  ['S058', 'Mark', "I'll verify that with the gate office."],
  ['S060', 'Lena', "We also need to confirm the parking pad surface works; if it's gravel we'll need an alternate location."],
  ['S070', 'Raj', 'Sensor mounting is set, but wind above 20 knots and the field of view are still constraints.'],
  ['S071', 'Raj', 'Can we fly before the flight plan is approved?'],
  ['S080', 'Mark', "The activity window is now November 2 through 6; we still don't know who has to travel or be on site."],
  ['S085', 'Lena', 'The visitor and VIP list is still fluid.'],
  ['S086', 'Lena', 'VIP coordination and maybe a day-by-day flow of show are still being worked.'],
  ['S090', 'Mark', 'OBG2 and the MCC can provide support for the demonstration.'],
  ['S091', 'Joel', 'We have generators on site and can support power if you need it.'],
  ['S093', 'Mark', 'We will start tracking all of these things.'],
  ['S095', 'Mark', "I'll distribute this meeting's transcript after the call."],
  ['S096', 'Mark', "And today I'll get you the Thursday meeting summaries and artifacts."],
  ['S110', 'Lena', "Let's keep this recurring invite going for the group."],
  ['S112', 'Mark', "I'll add Carter and Mandrick to the recurring invite."],
  ['S117', 'Mark', 'I already sent the updated recurring invitations on Friday.']
].map(([id, speaker, text]) => ({ id, speaker, text }));

const CTX = { meetingDate: '2026-10-09', segments: SEGMENTS, register: REGISTER };

const D = (seg, cls, unit, links, note) => ({ seg, cls, unit: unit || null, links: links || [], note: note || '' });

/* ---------- Gold package G0: the review's corrected minimum set ---------- */
const G0 = {
  contextToken: 'CTX-2026-10-09-FB',
  dispositions: [
    D('S001', 'greeting'), D('S002', 'context'), D('S003', 'context'),
    D('S010', 'commitment', 'U-deck'),
    D('S050', 'commitment', 'U-access', ['AI-19']),
    D('S052', 'request', 'U-poc', ['AI-55']), D('S053', 'commitment', 'U-poc', ['AI-55']), D('S054', 'commitment', 'U-poc', ['AI-55']),
    D('S055', 'other'),
    D('S057', 'open_question', 'U-gate'), D('S058', 'commitment', 'U-gate'),
    D('S060', 'open_question', 'U-park'),
    D('S070', 'status_update', 'U-sensor', ['AI-58']), D('S071', 'open_question', 'U-flight', ['AI-58']),
    D('S080', 'status_update', 'U-sched', ['AI-17']),
    D('S085', 'open_question', 'U-visitor'), D('S086', 'open_question', 'U-vip'),
    D('S090', 'context'), D('S091', 'context'),
    D('S093', 'commitment', 'U-track', [], 'General intent to keep tracking the items above; each already has its own task or open question in this package.'),
    D('S095', 'commitment', 'U-transcript'), D('S096', 'commitment', 'U-summaries'),
    D('S110', 'context'),
    D('S112', 'commitment', 'U-invadd', ['AI-40']), D('S117', 'status_update', 'U-invsent', ['AI-40'])
  ],
  ops: [
    { id: 'NEW-1', kind: 'CreateTask', project: 'P6', title: 'Send Fort Bliss location/planning slide deck', owner: 'Mark', timing: { phrase: 'this morning', resolved: '2026-10-09' }, cites: ['S010'] },
    { id: 'NEW-2', kind: 'CreateTask', project: 'P6', title: 'Distribute the current meeting transcript', owner: 'Mark', timing: null, cites: ['S095'] },
    { id: 'NEW-3', kind: 'CreateTask', project: 'P6', title: 'Distribute Thursday meeting summaries and related artifacts', owner: 'Mark', timing: { phrase: 'today', resolved: '2026-10-09' }, cites: ['S096'] },
    { id: 'NEW-4', kind: 'CreateTask', project: 'P6', title: 'Verify designated vehicle entry route/gate compatibility', owner: 'Mark', cites: ['S057', 'S058'] },
    { id: 'NEW-5', kind: 'CreateTask', project: 'P6', title: 'Verify parking-surface/location suitability; identify an alternate location if needed', owner: null, cites: ['S060'] },
    { id: 'OP-6', kind: 'ProgressNote', target: 'AI-19', title: 'Mark committed to coordinate vehicle access, parking and setup arrangements', cites: ['S050'] },
    { id: 'OP-7', kind: 'Reassign', target: 'AI-55', title: 'Reassign to Mark', to: 'Mark', cites: ['S052', 'S053'] },
    { id: 'OP-8', kind: 'ProgressNote', target: 'AI-55', title: 'Mark agreed to provide the direct arrival point of contact', cites: ['S052', 'S053', 'S054'] },
    { id: 'OP-9', kind: 'ProgressNote', target: 'AI-17', title: 'Activity window narrowed to Nov. 2-6; travel/on-site attendance expectations unresolved', cites: ['S080'] },
    { id: 'OP-10', kind: 'ProgressNote', target: 'AI-58', title: 'Mounting set; wind and field-of-view constraints; flight-plan dependency', cites: ['S070', 'S071'] },
    { id: 'OP-11', kind: 'OpenQuestion', project: 'P6', title: 'Visitor/VIP list remains fluid', cites: ['S085'] },
    { id: 'OP-12', kind: 'OpenQuestion', project: 'P6', title: 'VIP coordination and possible day-by-day flow of show under development', cites: ['S086'] },
    { id: 'OP-13', kind: 'ProgressNote', target: 'AI-40', title: 'Mark to add Carter and Mandrick to the recurring invite', cites: ['S112'] },
    { id: 'OP-14', kind: 'ProgressNote', target: 'AI-40', title: 'Mark reports updated recurring invitations sent Friday', cites: ['S117'] }
  ],
  registerCoverage: [
    { id: 'AI-13', coverage: 'not_discussed' }, { id: 'AI-17', coverage: 'discussed' }, { id: 'AI-19', coverage: 'discussed' },
    { id: 'AI-22', coverage: 'not_discussed' }, { id: 'AI-23', coverage: 'not_discussed' }, { id: 'AI-25', coverage: 'not_discussed' },
    { id: 'AI-40', coverage: 'discussed' }, { id: 'AI-55', coverage: 'discussed' }, { id: 'AI-58', coverage: 'discussed' }
  ],
  coveredProjects: ['P6', 'P11'],
  flags: []
};

/* ---------- helpers for mutations ---------- */
const op = (p, id) => p.ops.find(o => o.id === id);
const dp = (p, seg) => p.dispositions.find(d => d.seg === seg);
const cv = (p, id) => p.registerCoverage.find(c => c.id === id);
const dropOps = (p, ...ids) => { p.ops = p.ops.filter(o => !ids.includes(o.id)); };

/* ---------- Fixtures ----------
 * expectBlock: exact set of [code, ref] blocking flags. expectWarn: warnings that must be present (extras allowed).
 */
const FIXTURES = [
  // Positive controls
  { id: 'C1', group: 'control', title: 'Gold package as built', defect: '-', mutate: () => {}, expectBlock: [] },
  { id: 'C2', group: 'control', title: 'Honest not_discussed (AI-90, no overlap)', defect: '-',
    mutate: (p, c) => { c.register.tasks.push(clone(AI90)); p.registerCoverage.push({ id: 'AI-90', coverage: 'not_discussed' }); }, expectBlock: [] },
  { id: 'C3', group: 'control', title: 'Lexical decoy with rationale (AI-91 "contact list")', defect: '-',
    mutate: (p, c) => { c.register.tasks.push(clone(AI91)); p.registerCoverage.push({ id: 'AI-91', coverage: 'not_discussed', note: 'Contact-list cleanup is an internal chore; S054 concerns the host arrival POC, not the team list.' }); }, expectBlock: [] },
  { id: 'C4', group: 'control', title: 'Greeting to Joel with no NewParty', defect: '-', mutate: () => {}, expectBlock: [] },

  // Mutations mapped to the Oct 9 review
  { id: 'A01', title: 'AI-55 not_discussed while S053 links it', defect: 'AI-55 contradiction',
    mutate: p => { cv(p, 'AI-55').coverage = 'not_discussed'; }, expectBlock: [['COV-CONTRADICTION', 'AI-55']] },
  { id: 'A02', title: 'AI-55 not_discussed, links removed, paraphrase remains', defect: 'Paraphrase miss',
    mutate: p => {
      cv(p, 'AI-55').coverage = 'not_discussed'; dropOps(p, 'OP-7', 'OP-8');
      ['S052', 'S053', 'S054'].forEach(s => { dp(p, s).links = []; });
      dp(p, 'S053').note = 'Request for a contact person; no matching register task was found.';
      dp(p, 'S054').note = 'Follow-up on the contact request; no matching register task was found.';
    }, expectBlock: [['COV-POSSIBLE-MATCH', 'AI-55']] },
  { id: 'A03', title: 'AI-55 ops dropped; S053/S054 commitments unbound', defect: 'S053 unbound',
    mutate: p => { dropOps(p, 'OP-7', 'OP-8'); }, expectBlock: [['COV-UNBOUND-DISPOSITION', 'S053'], ['COV-UNBOUND-DISPOSITION', 'S054'], ['COV-CLAIM-UNSUPPORTED', 'AI-55']] },
  { id: 'A04', title: 'S093 rationale = "n/a"', defect: 'S093 unbound',
    mutate: p => { dp(p, 'S093').note = 'n/a'; }, expectBlock: [['COV-EMPTY-RATIONALE', 'S093']] },
  { id: 'A05', title: 'S112 rationale points at nonexistent NEW-9', defect: 'S112 unbound',
    mutate: p => { dropOps(p, 'OP-13'); dp(p, 'S112').note = 'Handled by the invitation action NEW-9 created in this package.'; },
    expectBlock: [['REF-DANGLING', 'S112']] },
  { id: 'A06', title: 'AI-55 ops cite range S040-S060', defect: 'Loose citation',
    mutate: p => { op(p, 'OP-7').cites = ['S040-S060']; op(p, 'OP-8').cites = ['S040-S060']; },
    expectBlock: [['CITE-RANGE', 'OP-7'], ['CITE-RANGE', 'OP-8'], ['COV-UNBOUND-DISPOSITION', 'S053'], ['COV-UNBOUND-DISPOSITION', 'S054']] },
  { id: 'A07', title: 'Generator capability becomes a task owned by Joel', defect: 'False generator task',
    mutate: p => { p.ops.push({ id: 'NEW-G', kind: 'CreateTask', project: 'P6', title: 'Provide onsite power capability', owner: 'Joel', cites: ['S091'] }); },
    expectBlock: [['TASK-NO-ACCEPTANCE', 'NEW-G']] },
  { id: 'A08', title: 'Transcript and Thursday summaries merged', defect: 'Documentation merge',
    mutate: p => { dropOps(p, 'NEW-2', 'NEW-3'); p.ops.push({ id: 'NEW-23', kind: 'CreateTask', project: 'P6', title: 'Distribute transcript and Thursday summaries/artifacts', owner: 'Mark', timing: { phrase: 'today', resolved: '2026-10-09' }, cites: ['S095', 'S096'] }); },
    expectBlock: [['DECOMP-MERGED', 'NEW-23'], ['DELIVERABLES-MERGED', 'NEW-23']] },
  { id: 'A09', title: 'Transcript action timed "today" without the phrase', defect: 'Ungrounded timing',
    mutate: p => { op(p, 'NEW-2').timing = { phrase: 'today', resolved: '2026-10-09' }; }, expectBlock: [['TIME-UNGROUNDED', 'NEW-2']] },
  { id: 'A09b', title: '"this morning" resolved to the wrong day', defect: 'Mis-resolved timing (added)',
    mutate: p => { op(p, 'NEW-1').timing.resolved = '2026-10-10'; }, expectBlock: [['TIME-UNGROUNDED', 'NEW-1']] },
  { id: 'A10', title: 'POC and gate folded into the AI-19 note', defect: 'POC/gate merge',
    mutate: p => { dropOps(p, 'OP-7', 'OP-8'); op(p, 'OP-6').cites = ['S050', 'S052', 'S053', 'S054', 'S057', 'S058']; },
    expectBlock: [['DECOMP-MERGED', 'OP-6'], ['MATCH-BETTER-TARGET', 'OP-6'], ['COV-CLAIM-UNSUPPORTED', 'AI-55']] },
  { id: 'A11a', title: 'Gate task dropped; AI-19 note cites the gate segments', defect: 'Gate has no action',
    mutate: p => { dropOps(p, 'NEW-4'); op(p, 'OP-6').cites = ['S050', 'S057', 'S058']; },
    expectBlock: [['DECOMP-MERGED', 'OP-6']] },
  { id: 'A11b', title: 'Gate task dropped; gate only in AI-19 note text', defect: 'Gate has no action',
    mutate: p => { dropOps(p, 'NEW-4'); op(p, 'OP-6').title += '; also confirm the entry route fits the vehicle'; },
    expectBlock: [['COV-UNBOUND-DISPOSITION', 'S057'], ['COV-UNBOUND-DISPOSITION', 'S058']] },
  { id: 'A12', title: 'Parking folded into one question with sensor and flight plan', defect: 'Parking merged, contingency lost',
    mutate: p => { dropOps(p, 'NEW-5', 'OP-10'); p.ops.push({ id: 'OQ-P', kind: 'OpenQuestion', project: 'P6', title: 'Parking pad, sensor mounting and flight-plan questions remain open', cites: ['S060', 'S070', 'S071'] }); },
    expectBlock: [['DECOMP-MERGED', 'OQ-P'], ['CONTINGENCY-DROPPED', 'OQ-P'], ['COV-CLAIM-UNSUPPORTED', 'AI-58']] },
  { id: 'A13', title: 'Visitor question moved onto AI-17', defect: 'Visitor on wrong task',
    mutate: p => { dropOps(p, 'OP-11'); p.ops.push({ id: 'OP-17V', kind: 'ProgressNote', target: 'AI-17', title: 'Visitor/VIP list remains fluid', cites: ['S085'] }); },
    expectBlock: [], expectWarn: [['MATCH-SCOPE-MISFIT', 'OP-17V']] },
  { id: 'A14', title: 'P5 added via AI-13 note on OBG2/MCC support', defect: 'P5 overreach',
    mutate: p => { p.coveredProjects.push('P5'); cv(p, 'AI-13').coverage = 'discussed'; p.ops.push({ id: 'OP-A14', kind: 'ProgressNote', target: 'AI-13', title: 'OBG2/MCC support available', cites: ['S090'] }); },
    expectBlock: [['PROJ-UNSUPPORTED', 'P5'], ['PROJ-ORPHAN-OP', 'OP-A14']] },
  { id: 'A15', title: 'P7 added via invitation discussion', defect: 'P7 overreach',
    mutate: p => {
      p.coveredProjects.push('P7');
      ['AI-22', 'AI-23', 'AI-25'].forEach((t, i) => { cv(p, t).coverage = 'discussed'; p.ops.push({ id: 'OP-A15' + 'abc'[i], kind: 'ProgressNote', target: t, title: 'Recurring invitation discussed', cites: ['S110'] }); });
    },
    expectBlock: [['PROJ-UNSUPPORTED', 'P7'], ['PROJ-ORPHAN-OP', 'OP-A15a'], ['PROJ-ORPHAN-OP', 'OP-A15b'], ['PROJ-ORPHAN-OP', 'OP-A15c'],
      ['MATCH-BETTER-TARGET', 'OP-A15a'], ['MATCH-BETTER-TARGET', 'OP-A15b'], ['MATCH-BETTER-TARGET', 'OP-A15c']] },
  { id: 'A16', title: 'NewParty Joel from a greeting', defect: 'Joel entity',
    mutate: p => { p.ops.push({ id: 'NEW-P1', kind: 'NewParty', title: 'Joel', cites: ['S001'] }); }, expectBlock: [['PARTY-IDENTITY', 'NEW-P1']] },
  { id: 'A17', title: 'Schedule note dropped from AI-17', defect: 'Schedule not attached',
    mutate: p => { dropOps(p, 'OP-9'); }, expectBlock: [['COV-UNBOUND-DISPOSITION', 'S080'], ['COV-CLAIM-UNSUPPORTED', 'AI-17']] },
  { id: 'A18', title: 'Invitation status dropped', defect: 'S117 unbound',
    mutate: p => { dropOps(p, 'OP-14'); }, expectBlock: [['COV-UNBOUND-DISPOSITION', 'S117']] },
  { id: 'A19', title: 'Lexical decoy without rationale', defect: 'Added: decoy needs a reason',
    mutate: (p, c) => { c.register.tasks.push(clone(AI91)); p.registerCoverage.push({ id: 'AI-91', coverage: 'not_discussed' }); },
    expectBlock: [['COV-POSSIBLE-MATCH', 'AI-91']] },
  { id: 'A20', title: 'AI-58 coverage row deleted', defect: 'Added: silent omission',
    mutate: p => { p.registerCoverage = p.registerCoverage.filter(c => c.id !== 'AI-58'); }, expectBlock: [['COV-MISSING-ITEM', 'AI-58']] },
  { id: 'A21', title: 'S093 rationale names a real op that does not cite it', defect: 'Added: borrowed citation',
    mutate: p => { dp(p, 'S093').note = 'This tracking intent is covered by the transcript action NEW-2 above.'; },
    expectBlock: [['REF-DANGLING', 'S093']] },
  { id: 'A22', title: 'S090 disposition deleted', defect: 'Added: segment table gap',
    mutate: p => { p.dispositions = p.dispositions.filter(d => d.seg !== 'S090'); }, expectBlock: [['DISP-MISSING', 'S090']] },

  // A99: reconstruction of the actual Oct 9 output, built from the review (stacking A01-A18 is impossible: they edit the same elements)
  { id: 'A99', group: 'stacked', title: 'Oct 9 output reconstruction', defect: 'All of the above, together',
    mutate: p => {
      p.ops.push({ id: 'NEW-P1', kind: 'NewParty', title: 'Joel', cites: ['S001'] });
      p.ops.push({ id: 'NEW-G', kind: 'CreateTask', project: 'P6', title: 'Provide onsite power capability', owner: 'Joel', cites: ['S091'] });
      dropOps(p, 'NEW-2', 'NEW-3', 'NEW-4', 'NEW-5', 'OP-7', 'OP-8', 'OP-9', 'OP-11', 'OP-12', 'OP-13', 'OP-14');
      p.ops.push({ id: 'NEW-23', kind: 'CreateTask', project: 'P6', title: 'Distribute transcript and Thursday summaries/artifacts', owner: 'Mark', timing: { phrase: 'today', resolved: '2026-10-09' }, cites: ['S095', 'S096'] });
      cv(p, 'AI-55').coverage = 'not_discussed';
      ['S052', 'S053', 'S054'].forEach(s => { dp(p, s).links = ['AI-19']; });
      Object.assign(op(p, 'OP-6'), { title: 'Coordinate access/arrival; direct POC and entry-route verification', cites: ['S050', 'S052', 'S057'] });
      p.ops.push({ id: 'OP-17V', kind: 'ProgressNote', target: 'AI-17', title: 'Visitor/VIP list fluid; VIP flow of show TBD', cites: ['S085', 'S086'] });
      p.ops.push({ id: 'OQ-P', kind: 'OpenQuestion', project: 'P6', title: 'Parking pad, sensor mounting and flight-plan questions', cites: ['S060', 'S070', 'S071'] });
      dp(p, 'S093').note = '';
      p.coveredProjects = ['P5', 'P6', 'P7', 'P11'];
      cv(p, 'AI-13').coverage = 'discussed';
      p.ops.push({ id: 'OP-A14', kind: 'ProgressNote', target: 'AI-13', title: 'OBG2/MCC support available', cites: ['S090'] });
      ['AI-22', 'AI-23', 'AI-25'].forEach((t, i) => { cv(p, t).coverage = 'discussed'; p.ops.push({ id: 'OP-A15' + 'abc'[i], kind: 'ProgressNote', target: t, title: 'Recurring invitation discussed', cites: ['S110'] }); });
    },
    expectBlock: [
      ['PARTY-IDENTITY', 'NEW-P1'], ['TASK-NO-ACCEPTANCE', 'NEW-G'],
      ['DECOMP-MERGED', 'NEW-23'], ['DELIVERABLES-MERGED', 'NEW-23'], ['DECOMP-MERGED', 'OP-6'], ['DECOMP-MERGED', 'OP-17V'], ['DECOMP-MERGED', 'OQ-P'], ['CONTINGENCY-DROPPED', 'OQ-P'],
      ['MATCH-BETTER-TARGET', 'OP-6'], ['MATCH-BETTER-TARGET', 'OP-A15a'], ['MATCH-BETTER-TARGET', 'OP-A15b'], ['MATCH-BETTER-TARGET', 'OP-A15c'],
      ['COV-POSSIBLE-MATCH', 'AI-55'],
      ['COV-UNBOUND-DISPOSITION', 'S053'], ['COV-UNBOUND-DISPOSITION', 'S054'], ['COV-UNBOUND-DISPOSITION', 'S058'],
      ['COV-UNBOUND-DISPOSITION', 'S080'], ['COV-UNBOUND-DISPOSITION', 'S093'], ['COV-UNBOUND-DISPOSITION', 'S112'], ['COV-UNBOUND-DISPOSITION', 'S117'],
      ['PROJ-UNSUPPORTED', 'P5'], ['PROJ-UNSUPPORTED', 'P7'], ['PROJ-UNSUPPORTED', 'P11'],
      ['PROJ-ORPHAN-OP', 'OP-A14'], ['PROJ-ORPHAN-OP', 'OP-A15a'], ['PROJ-ORPHAN-OP', 'OP-A15b'], ['PROJ-ORPHAN-OP', 'OP-A15c'],
      ['COV-CLAIM-UNSUPPORTED', 'AI-40']
    ],
    expectWarn: [['MATCH-SCOPE-MISFIT', 'OP-17V']] }
];

function runLayerA() {
  return FIXTURES.map(f => {
    const pkg = clone(G0), ctx = clone(CTX);
    f.mutate(pkg, ctx);
    const r = V.validate(pkg, ctx);
    const key = ([c, r]) => c + ' @ ' + r;
    const got = new Set(r.flags.filter(x => x.sev === 'block').map(x => key([x.code, x.ref])));
    const gotWarn = new Set(r.flags.filter(x => x.sev === 'warn').map(x => key([x.code, x.ref])));
    const exp = new Set((f.expectBlock || []).map(key));
    const missing = [...exp].filter(k => !got.has(k));
    const unexpected = [...got].filter(k => !exp.has(k));
    const missingWarn = (f.expectWarn || []).map(key).filter(k => !gotWarn.has(k));
    return { id: f.id, group: f.group || 'negative', title: f.title, defect: f.defect,
      expected: [...exp].concat((f.expectWarn || []).map(w => key(w) + ' (warn)')),
      pass: !missing.length && !unexpected.length && !missingWarn.length,
      missing: missing.concat(missingWarn.map(w => w + ' (warn)')), unexpected, flags: r.flags };
  });
}

const api = { REGISTER, SEGMENTS, CTX, G0, FIXTURES, runLayerA };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGLayerA = api;
})(typeof window !== 'undefined' ? window : globalThis);
