/* Difficult-transcript fixture (sample graph, P2). v0.2, 2026-10-11.
 * - The transcript, segmented exactly as the workbench does (S001-S052; every quote in the tester's reply is verbatim).
 * - Baseline A: the sample world's P2 as it stood for the tester's run. Baseline B: + AI-204..AI-207 (tester's proposal).
 * - FLAWED: the reply the testers rejected (gpt-5.6-terra-low), unmodified.
 * - GOLDEN_B: a reply that applies every tester correction against baseline B. Needs tester agreement before it is the target.
 * - RUBRIC: the tester's review, one row per finding, each with a detector. On FLAWED the harness must agree with the tester row by row.
 * - MUTATIONS: GOLDEN_B with one tester defect re-introduced; each must raise exactly its expected flags.
 * - repairPrompt(): findings -> a correction prompt to paste back into the same chat.
 */
(function (root) {
'use strict';
const NODE = typeof require !== 'undefined' && typeof module !== 'undefined';
const V = NODE ? require('../../src/modules/validator.js') : root.MGValidator;
const DATA = NODE ? (() => {
  const fs = require('fs'), path = require('path');
  return { transcript: fs.readFileSync(path.join(__dirname, 'data/transcript_difficult.txt'), 'utf8'),
           flawed: JSON.parse(fs.readFileSync(path.join(__dirname, 'data/flawed_difficult.json'), 'utf8')) };
})() : root.MGDifficultData;
const clone = x => JSON.parse(JSON.stringify(x));

/* ---------- Teams transcript -> segments (header line "Surname, First   h:mm:ss", then text) ---------- */
function parseTeams(text) {
  const segs = []; let cur = null;
  for (const line of String(text).split(/\r?\n/)) {
    const m = /^([A-Z][\w'’-]+,\s*[A-Z][\w'’-]+)\s+\d+:\d{2}:\d{2}\s*$/.exec(line.trim());
    if (m) { cur = { speaker: m[1], text: '' }; segs.push(cur); }
    else if (cur && line.trim()) cur.text += (cur.text ? ' ' : '') + line.trim();
  }
  segs.forEach((s, i) => { s.id = 'S' + String(i + 1).padStart(3, '0'); });
  return segs;
}
const SEGMENTS = parseTeams(DATA.transcript);
const MEETING_DATE = '2026-10-01';
const segTxt = id => (SEGMENTS.find(s => s.id === id) || {}).text || '';
// Quote helper: the fragment must be verbatim in the segment (curly apostrophes matched); returns the segment's own characters.
function q(seg, frag) {
  const t = segTxt(seg), nt = t.replace(/[’‘]/g, "'"), i = nt.indexOf(frag.replace(/[’‘]/g, "'"));
  if (i < 0) throw new Error(`quote not in ${seg}: ${frag}`);
  return { seg, quote: t.slice(i, i + frag.length) };
}

/* ---------- Register baselines (sample world, P2) ---------- */
const P2 = { id: 'P2', title: 'Partner data exchange', description: 'Data exchange with the partner agency' }; // title wording assumed
const BASE_A = { projects: [P2], tasks: [
  { id: 'AI-201', project: 'P2', title: 'Get the data sharing agreement signed', owner: 'alvarez', status: 'closed' },
  { id: 'AI-202', project: 'P2', title: 'Draft the file layout spec', owner: 'ortiz', status: 'closed' },
  { id: 'AI-203', project: 'P2', title: 'Run a test transfer with a sample file', owner: 'ortiz', status: 'blocked' },
  { id: 'BL-202', project: 'P2', title: 'Get the firewall rule approved', owner: 'patel', status: 'open' }
] };
const BASE_B = clone(BASE_A);
BASE_B.tasks.push(
  { id: 'AI-204', project: 'P2', title: 'Coordinate partner-site access and staging arrangements', owner: null, status: 'open' },
  { id: 'AI-205', project: 'P2', title: 'Send partner access point-of-contact details', owner: null, status: 'open' },
  { id: 'AI-206', project: 'P2', title: 'Assess transfer-environment integration options', owner: null, status: 'open' },
  { id: 'AI-207', project: 'P2', title: 'Finalize transfer travel and arrival plan', owner: null, status: 'open' });
const ctxFor = base => ({ meetingDate: MEETING_DATE, segments: SEGMENTS, register: base, requireSelfReview: true });
const CTX_A = ctxFor(BASE_A), CTX_B = ctxFor(BASE_B);

/* ---------- The rejected reply, unmodified ---------- */
const FLAWED = DATA.flawed;

/* ---------- GOLDEN_B: every tester correction applied, against baseline B ---------- */
const D = (seg, kind, about, note) => ({ kind, about: about === undefined ? null : about, ...(note ? { note } : {}) });
const DISP = {
  S001: [D('S001', 'administrative')], S002: [D('S002', 'administrative')], S003: [D('S003', 'administrative')],
  S004: [D('S004', 'open_question', ['P2'])],
  S005: [D('S005', 'context_only', ['AI-206'])], S006: [D('S006', 'context_only', ['AI-206'])],
  S007: [D('S007', 'open_question', ['AI-206'])], S008: [D('S008', 'open_question', ['AI-206'])], S009: [D('S009', 'open_question', ['AI-206'])],
  S010: [D('S010', 'context_only', ['AI-206'])],
  S011: [D('S011', 'uncertain_requires_review', ['AI-206'], 'Collective suggestion to ask for the equipment documentation; nobody accepted it.')],
  S012: [D('S012', 'open_question', ['AI-206'])],
  S013: [D('S013', 'open_question', ['P2'])],
  S014: [D('S014', 'status_update', ['AI-203', 'AI-207']), D('S014', 'open_question', ['AI-207'])],
  S015: [D('S015', 'status_update', ['AI-207'])],
  S016: [D('S016', 'open_question', ['AI-204'])],
  S017: [D('S017', 'status_update', ['AI-203'])],
  S018: [D('S018', 'status_update', ['AI-207'])],
  S019: [D('S019', 'commitment', ['NEW-1'])],
  S020: [D('S020', 'discussion_of_register_item', ['AI-204'])], S021: [D('S021', 'discussion_of_register_item', ['AI-204'])],
  S022: [D('S022', 'decision', ['AI-204'])], S023: [D('S023', 'commitment', ['AI-204'])],
  S024: [D('S024', 'discussion_of_register_item', ['AI-205'])], S025: [D('S025', 'commitment', ['AI-205'])],
  S026: [D('S026', 'open_question', ['NEW-2'])], S027: [D('S027', 'commitment', ['NEW-2'])],
  S028: [D('S028', 'context_only', ['NEW-2'])], S029: [D('S029', 'commitment', ['NEW-2'])],
  S030: [D('S030', 'status_update', ['P2'])], S031: [D('S031', 'status_update', ['P2'])],
  S032: [D('S032', 'uncertain_requires_review', ['P2'], 'The team should be ready for observer questions on the technical setup; no accepted follow-up.')],
  S033: [D('S033', 'administrative', null, 'Weekly continuation of this call.'), D('S033', 'commitment', ['NEW-4']), D('S033', 'commitment', ['NEW-5']), D('S033', 'open_question', ['P2'])],
  S034: [D('S034', 'discussion_of_register_item', ['AI-205', 'AI-204'])],
  S035: [D('S035', 'open_question', ['AI-206'])], S036: [D('S036', 'status_update', ['AI-206'])], S037: [D('S037', 'status_update', ['AI-206'])],
  S038: [D('S038', 'status_update', ['AI-206'])],
  S039: [D('S039', 'open_question', ['NEW-3'])], S040: [D('S040', 'open_question', ['NEW-3'])],
  S041: [D('S041', 'open_question', ['AI-206'], 'Answered at once in S042: no dedicated power, so the team brings its portable power unit.')], S042: [D('S042', 'status_update', ['AI-206'])], S043: [D('S043', 'status_update', ['AI-206'])],
  S044: [D('S044', 'uncertain_requires_review', ['P2'], 'Collective intent to track the items discussed; each item already has its own op or flag.')],
  S045: [D('S045', 'administrative', null, 'Recurring-invitation administration; no register item.')],
  S046: [D('S046', 'administrative', null, 'Recurring-invitation administration; no register item.')],
  S047: [D('S047', 'administrative', null, 'Acknowledges the invitation requests.')],
  S048: [D('S048', 'administrative', null, 'Invitation recipients.')],
  S049: [D('S049', 'administrative', null, 'Invitation recipients.')],
  S050: [D('S050', 'administrative', null, 'Invitation updates reported done; receipt unconfirmed.')],
  S051: [D('S051', 'administrative')], S052: [D('S052', 'administrative')]
};
const GOLDEN_B = {
  context: 'MKG1|transcript|20261001T140000Z|c72140f9',
  ops: [
    { op: 'NewTasking', ref: 'NEW-1', project: 'P2', label: "Send the group yesterday's discussion information and the partner-site slide deck with location details", assignee: 'alvarez', dueDate: '2026-10-01', duePhrase: 'this morning',
      src: [q('S019', "I will send everyone information from yesterday's discussion this morning."), q('S019', 'There will be a partner-site slide deck with location details.')] },
    { op: 'Reassign', tasking: 'AI-204', from: null, to: 'alvarez',
      src: [q('S023', 'I will start coordinating with the Partner agency so that when you arrive, you can go directly to the site, use the intended staging area')] },
    { op: 'ProgressNote', tasking: 'AI-204', text: 'Alvarez committed to coordinate with the Partner agency so the team can go directly to the site on arrival, use the intended staging area, and start preparing for the transfer period. Agreed approach: stage the files at the final location on arrival, then use another workspace while the technical team finishes setup.',
      src: [q('S021', 'Would you prefer to stage the files at the final location as soon as you arrive, then use another workspace'),
        q('S022', 'Yes. That is probably the best approach.'),
        q('S023', 'I will start coordinating with the Partner agency so that when you arrive, you can go directly to the site, use the intended staging area')] },
    { op: 'Reassign', tasking: 'AI-205', from: null, to: 'alvarez',
      src: [q('S024', 'can you get us a direct point of contact we can call if we have trouble getting into the site'), q('S025', 'Yes. Absolutely.')] },
    { op: 'ProgressNote', tasking: 'AI-205', text: 'Alvarez agreed to provide a direct point of contact before James and Raj leave, for trouble getting into the site or reaching the right staging area; the travelers named it, with the site arrangements, as their main need before arrival.',
      src: [q('S024', 'can you get us a direct point of contact we can call if we have trouble getting into the site'), q('S025', 'Yes. Absolutely.'),
        q('S034', 'The main thing for Raj and me is having a point of contact and knowing the site arrangements before we arrive.')] },
    { op: 'NewTasking', ref: 'NEW-2', project: 'P2', label: 'Verify the identified route is suitable for the transfer requirements and confirm which route the team should use', assignee: 'alvarez',
      src: [q('S026', 'We also need to know whether there is a specific connection route or entry process because of the file size and equipment we are bringing.'),
        q('S027', 'There is a route identified. I need to check that it is suitable for your transfer requirements.'),
        q('S029', 'I will work through that so you know which route to use.')] },
    { op: 'NewTasking', ref: 'NEW-3', project: 'P2', label: 'Verify staging-area load suitability and identify an alternate staging area if needed', assignee: null,
      src: [q('S039', 'Please make sure the Partner agency knows the equipment and file cases are heavy.'), q('S040', 'I think the intended area may be stable, but we need to verify it.'),
        q('S040', 'If it does not work, there is another staging area nearby.')] },
    { op: 'NewTasking', ref: 'NEW-4', project: 'P2', label: "Provide today's meeting transcript to this group", assignee: 'alvarez',
      src: [q('S033', "I will provide today's transcript to this group")] },
    { op: 'NewTasking', ref: 'NEW-5', project: 'P2', label: "Send yesterday's partner-session summaries and supporting materials", assignee: 'alvarez', dueDate: '2026-10-01', duePhrase: 'today',
      src: [q('S033', "you will also get the summaries from yesterday's partner session"), q('S033', 'I am putting those materials together now to get them out today.')] },
    { op: 'ProgressNote', tasking: 'AI-203', text: 'The transfer period was described as narrowed from May 18-28 to May 18-22. Sofia\'s working understanding was that May 18 would serve as the setup and configuration day rather than a required arrival day for every participant.',
      src: [q('S014', 'The transfer period that had been discussed as May eighteenth through May twenty-eighth is now being described as May eighteenth through May twenty-second.'),
        q('S017', 'I think the eighteenth is being treated as the setup and configuration day, not necessarily the day every participant has to arrive.')] },
    { op: 'ProgressNote', tasking: 'AI-207', text: 'James Ortiz and Raj plan to leave on the 14th and arrive on the 17th, ready for the setup day on the 18th. Current expectation: hands-on staff available Monday through Friday, traveling Sunday and Saturday. Travel and availability expectations for personnel not working hands-on remain under discussion.',
      src: [q('S014', 'The current expectation may be that people working directly on the transfer need to be available Monday through Friday, with travel Sunday and Saturday.'),
        q('S014', 'There is still discussion about what that means for people who are not working hands-on.'),
        q('S015', 'Raj and I are planning to leave on the fourteenth.'),
        q('S018', 'If we arrive on the seventeenth, we can get settled and be ready for the eighteenth.')] },
    { op: 'ProgressNote', tasking: 'AI-206', text: 'Working plan, not yet a decision: the temporary workstation hosts the transfer-support equipment and provides power, workspace and connectivity; transfer equipment connects directly to the support system.',
      src: [q('S035', 'Did the technical team decide exactly how the temporary workstation is going to support the transfer?'),
        q('S036', 'The workstation is there primarily to host the transfer-support equipment.'), q('S037', 'The transfer equipment will connect directly to the support system.')] },
    { op: 'ProgressNote', tasking: 'AI-206', text: 'No dedicated power on site, so the team brings a portable power unit expected to support the equipment; normal connectivity plus a backup option.',
      src: [q('S038', 'We will have our normal connection capability and a backup option.'),
        q('S042', 'There is no dedicated power. We are bringing the portable power unit.'), q('S043', 'We should be able to support the equipment with that.')] }
  ],
  flags: [
    { kind: 'open_question', about: ['P2'], src: ['S004', 'S013', 'S030', 'S031', 'S033'], note: 'Observer attendance is still changing. A partner-side point of contact is capturing observers with the event coordinator and a flexible day-by-day schedule is being developed; anyone who learns of additional observers sends their names to the event coordinator. Confirm the observer-management process.' },
    { kind: 'open_question', about: ['AI-206'], src: ['S007', 'S008', 'S009', 'S012'], note: 'Monitoring-equipment placement (workstation stand or ground-level tables) and its mounting method stay open until the final transfer plan is known; stability in wind or vibration is the concern.' },
    { kind: 'open_question', about: ['AI-207'], src: ['S014'], note: 'Clarify travel and availability expectations for personnel not working hands-on during the May 18-22 transfer period.' },
    { kind: 'suggestion', about: ['AI-204'], src: ['S016'], note: 'Have files staged and equipment connected before the 18th; no owner accepted this beyond the staging approach agreed in S022.' },
    { kind: 'ownership', about: ['NEW-3'], src: ['S040'], note: 'No one accepted the staging-area load verification; Brooks raised it.' },
    { kind: 'unmatched', about: [], src: ['S045', 'S046', 'S049', 'S050'], note: "Recurring-invitation updates (forward to James, Raj's alternate email, add Priya and Dana) are meeting administration with no register item; Alvarez reports them done, receipt unconfirmed." }
  ],
  coveredProjects: ['P2'],
  segments: SEGMENTS.map(s => ({ seg: s.id, dispositions: DISP[s.id].map(({ kind, about, note }) => ({ kind, about, ...(note ? { note } : {}) })) })),
  register: [
    { id: 'AI-203', coverage: 'updated', segs: ['S014', 'S017'] },
    { id: 'AI-204', coverage: 'updated', segs: ['S020', 'S021', 'S022', 'S023'] },
    { id: 'AI-205', coverage: 'updated', segs: ['S024', 'S025', 'S034'] },
    { id: 'AI-206', coverage: 'updated', segs: ['S035', 'S036', 'S037', 'S038', 'S042', 'S043'] },
    { id: 'AI-207', coverage: 'updated', segs: ['S014', 'S015', 'S018'] },
    { id: 'BL-202', coverage: 'not_discussed', segs: [] }
  ],
  selfReview: { newVsExisting: [
    { ref: 'NEW-1', nearest: 'AI-204', whyNew: "Sending yesterday's discussion information and the partner-site slide deck is a one-off documentation deliverable; AI-204 is the site access and staging coordination itself." },
    { ref: 'NEW-2', nearest: 'AI-204', whyNew: 'Route suitability is a separate verification Alvarez accepted, complete when the route is confirmed; AI-204 covers access and staging coordination.' },
    { ref: 'NEW-3', nearest: 'AI-204', whyNew: "Staging-area load suitability is an unowned verification with its own contingency; AI-204's coordination commitment did not accept it." },
    { ref: 'NEW-4', nearest: null, whyNew: "Sending today's meeting transcript is a documentation deliverable no register item covers." },
    { ref: 'NEW-5', nearest: null, whyNew: "Sending yesterday's partner-session summaries and supporting materials is a documentation deliverable no register item covers." }
  ] }
};

/* ---------- Tester rubric: one row per finding in the tester's review ----------
 * detect(A, r) returns evidence strings; empty = row clean. tester = the tester's verdict on FLAWED.
 */
const hasFlag = (r, code, ref) => r.flags.some(f => f.code === code && (ref == null || f.ref === ref || String(f.ref).split('+').includes(ref)));
const flagsOf = (r, ...codes) => r.flags.filter(f => codes.includes(f.code)).map(f => `${f.code} @ ${f.ref}`);
const opsCiting = (A, ...segs) => A.ops.filter(o => o.cites.some(s => segs.includes(s)));
const createsCiting = (A, ...segs) => opsCiting(A, ...segs).filter(o => o.kind === 'CreateTask');
const RUBRIC = [
  { id: 'R01', finding: 'Existing task AI-203 is not properly updated', tester: 'defect',
    detect: (A, r) => [...flagsOf(r, 'COV-UNRESOLVED').filter(x => /AI-203/.test(x)),
      ...(A.ops.some(o => o.target === 'AI-203' && o.cites.includes('S014')) ? [] : ['no update on AI-203 carries the narrowed transfer window (S014)'])] },
  { id: 'R02', finding: 'New tasks created instead of updating existing work', tester: 'defect',
    detect: (A, r) => [...flagsOf(r, 'COV-DEFERRED-NEW'), ...r.flags.filter(f => f.code === 'NEW-DUPLICATE' && f.sev === 'block').map(f => `NEW-DUPLICATE @ ${f.ref}`)] },
  { id: 'R03', finding: 'Broad coordination commitment (S023) under-scoped', tester: 'defect',
    detect: (A, r, ctx) => { const t = opsCiting(A, 'S023').map(o => o.title || ((ctx.register.tasks.find(x => x.id === o.target) || {}).title || '')).join(' ');
      return [...flagsOf(r, 'QUOTE-TRUNCATED').filter(x => opsCiting(A, 'S023').some(o => x.endsWith(o.id))),
        ...(/site|access/i.test(t) && /stag/i.test(t) && /prepar|setup|set up/i.test(t) ? [] : [`ops citing S023 drop part of "site access, staging, setup": "${t}"`])]; } },
  { id: 'R04', finding: 'Route verification split into two tasks (one completion condition)', tester: 'defect',
    detect: (A, r, ctx) => { const routeHome = A.ops.filter(o => o.cites.some(s => ['S026', 'S027', 'S029'].includes(s)) &&
        o.kind === 'CreateTask' && /alvarez/i.test(o.owner || '') && /route/i.test(o.title)); // tester ruling Oct 12: the route check is its own Sofia-owned tasking, not a note on AI-204 or AI-206
      return [...flagsOf(r, 'OVER-SPLIT'), ...(createsCiting(A, 'S026', 'S027', 'S029').length > 1 ? [`${createsCiting(A, 'S026', 'S027', 'S029').map(o => o.id).join(' + ')} for one route request`] : []),
        ...(routeHome.length ? [] : ['Alvarez\'s route check (S027, S029) is not its own Sofia-owned tasking (ruling Oct 12: keep it separate from AI-204)'])]; } },
  { id: 'R05', finding: 'Staging contingency (alternate area) lost', tester: 'defect',
    detect: (A, r) => [...flagsOf(r, 'CONTINGENCY-DROPPED'), // tester ruling Oct 12: an unassigned tasking that keeps the alternate-area contingency
      ...(opsCiting(A, 'S040').some(o => o.kind === 'CreateTask' && !o.owner && V.ALT_RE.test(o.title)) ? [] : ['the staging check (S040) is not its own unassigned tasking that keeps the alternate staging area'])] },
  // R06 retired (Aaron, 2026-10-12): in "I am putting those materials together now", "those materials" refers back to the
  // transcript and the summaries; it is not a third deliverable, so leaving the word out is not a defect.
  { id: 'R06', finding: 'Documentation commitment drops a named deliverable (the slide deck); "those materials" is not one', tester: 'n/a',
    detect: (A, r) => [...flagsOf(r, 'DELIVERABLE-DROPPED'), ...(opsCiting(A, 'S019').some(o => /slide deck/i.test(o.title)) ? [] : ['no op carries the slide deck from S019'])] },
  { id: 'R07', finding: 'Invitation administration forced into P2 as taskings', tester: 'defect',
    detect: (A, r) => [...flagsOf(r, 'ADMIN-IN-PROJECT'), ...createsCiting(A, 'S045', 'S046', 'S047', 'S048', 'S049', 'S050').map(o => `${o.id} is a P2 tasking`)].filter((x, i, a) => a.indexOf(x) === i) },
  { id: 'R08', finding: 'Recipient confirmation becomes a tasking', tester: 'ok',
    detect: A => A.ops.filter(o => o.kind === 'CreateTask' && /receipt|receive|confirm (?:the )?(?:invitation|delivery)/i.test(o.title)).map(o => `${o.id}: ${o.title}`) },
  { id: 'R09', finding: 'Conditional observer instruction minted as a task', tester: 'defect',
    detect: (A, r) => [...flagsOf(r, 'CONDITIONAL-TASKING'), ...A.ops.filter(o => o.kind === 'CreateTask' && /observer/i.test(o.title)).map(o => `${o.id}: ${o.title}`)].filter((x, i, a) => a.indexOf(x) === i) },
  { id: 'R10', finding: 'Technical capability (power, connectivity) treated as a task', tester: 'ok',
    detect: A => createsCiting(A, 'S038', 'S042', 'S043').concat(A.ops.filter(o => o.kind === 'CreateTask' && /power|generator|connectivity/i.test(o.title))).map(o => `${o.id}: ${o.title}`) },
  { id: 'R11', finding: 'Unsupported projects included', tester: 'ok',
    detect: (A, r) => [...A.coveredProjects.filter(p => p !== 'P2').map(p => `${p} in coveredProjects`), ...flagsOf(r, 'PROJ-UNSUPPORTED')] },
  { id: 'R12', finding: 'Technical discussion not mapped to register work', tester: 'defect',
    detect: (A, r, ctx) => [...r.flags.filter(f => ['DISP-ABOUT-PROJECT', 'COV-UNBOUND-DISPOSITION'].includes(f.code) && ['S035', 'S036', 'S037', 'S041'].includes(f.ref)).map(f => `${f.code} @ ${f.ref}`),
      ...(ctx.register.tasks.some(t => t.id === 'AI-206') && !A.ops.some(o => o.target === 'AI-206') ? ['no update on AI-206 from the working-plan discussion'] : [])] },
  { id: 'R13', finding: 'Self-review / completeness accountability absent', tester: 'defect',
    detect: (A, r) => flagsOf(r, 'SELF-REVIEW-MISSING', 'SELF-REVIEW-INCOMPLETE') },
  { id: 'R16', finding: 'Separate documentation deliverables merged into one task', tester: 'ok',
    detect: (A, r) => [...flagsOf(r, 'TIMING-MERGED', 'DELIVERABLES-MERGED'), ...A.ops.filter(o => o.kind === 'CreateTask' && /transcript/i.test(o.title) && /summar|material|deck|information/i.test(o.title)).map(o => `${o.id}: ${o.title}`)].filter((x, i, a) => a.indexOf(x) === i) },
  { id: 'R14', finding: 'POC commitment updates existing POC task AI-205', tester: 'n/a (baseline A has no POC task)', baseline: 'B',
    detect: A => [...(A.ops.some(o => o.target === 'AI-205' && o.kind === 'Reassign' && /alvarez/i.test(o.to || '')) ? [] : ['AI-205 not reassigned to Alvarez']),
      ...createsCiting(A, 'S024', 'S025').map(o => `${o.id} minted for the POC`)] },
  { id: 'R15', finding: 'Travel and arrival details update AI-207', tester: 'n/a (baseline A has no travel task)', baseline: 'B',
    detect: A => A.ops.some(o => o.target === 'AI-207' && o.cites.includes('S015')) ? [] : ['no update on AI-207 from the travel dates (S015)'] },
  // R17 (tester ruling Oct 12): "today's transcript" names the document; it is not timing evidence. This transcript never
  // says when the transcript will be distributed, so the transcript tasking carries no due date or due phrase. The
  // summaries/materials tasking may keep "today" ("to get them out today").
  { id: 'R17', finding: 'Current-meeting transcript task given a due date', tester: 'n/a (ruled Oct 12)', baseline: 'B',
    detect: A => A.ops.filter(o => o.kind === 'CreateTask' && /transcript/i.test(o.title) && o.timing && (o.timing.resolved || o.timing.phrase))
      .map(o => `${o.id} (${o.title}) is due ${o.timing.resolved || ''} "${o.timing.phrase || ''}"`) },
  // D-UX12 (ratified 2026-10-12): unsupported high-impact changes are demoted; contradictory changes are a hard stop.
  { id: 'R18', finding: 'Owner, status or date changed without direct evidence', tester: 'n/a (D-UX12)', baseline: 'B',
    detect: (A, r) => flagsOf(r, 'SUPPORT-MISSING') },
  { id: 'R19', finding: 'Contradictory changes in one reply', tester: 'n/a (D-UX12)', baseline: 'B',
    detect: (A, r) => flagsOf(r, 'OP-CONFLICT') }
];

function evaluate(raw, base) {
  const ctx = base === 'B' ? CTX_B : CTX_A;
  const r = V.validate(raw, ctx), A = V.adapt(raw);
  const rows = RUBRIC.filter(x => !x.baseline || x.baseline === base).map(x => {
    let ev; try { ev = x.detect(A, r, ctx); } catch (e) { ev = ['detector error: ' + e.message]; }
    return { id: x.id, finding: x.finding, tester: x.tester, defect: ev.length > 0, evidence: ev };
  });
  return { result: r, rows, clean: rows.every(x => !x.defect) && !r.blocked };
}

/* ---------- Single-defect mutations of GOLDEN_B ---------- */
const g = () => clone(GOLDEN_B);
const opBy = (p, pred) => p.ops.find(pred);
const dropOp = (p, pred) => { p.ops = p.ops.filter(o => !pred(o)); };
const segOf = (p, id) => p.segments.find(s => s.seg === id);
const MUTATIONS = [
  { id: 'D01', title: 'AI-203 left as possible match; no update', row: 'R01',
    mutate: p => { dropOp(p, o => o.tasking === 'AI-203'); Object.assign(p.register.find(r => r.id === 'AI-203'), { coverage: 'possible_match_requires_review', note: 'Unclear whether transfer timing updates the sample-file test.' });
      segOf(p, 'S017').dispositions = [{ kind: 'uncertain_requires_review', about: ['P2'], note: 'Setup-day timing; unclear which tasking it updates.' }]; },
    expect: [['COV-UNRESOLVED', 'AI-203']] },
  { id: 'D02', title: 'Coordination minted as new task instead of AI-204 update', row: 'R02',
    mutate: p => { dropOp(p, o => o.tasking === 'AI-204');
      p.ops.push({ op: 'NewTasking', ref: 'NEW-6', project: 'P2', label: 'Coordinate site access, staging area and setup with the Partner agency', assignee: 'alvarez', src: [q('S023', 'I will start coordinating with the Partner agency so that when you arrive, you can go directly to the site, use the intended staging area, and start preparing for the transfer period.')] });
      ['S020', 'S021', 'S022', 'S023'].forEach(s => segOf(p, s).dispositions.forEach(d => { d.about = ['NEW-6']; }));
      Object.assign(p.register.find(r => r.id === 'AI-204'), { coverage: 'not_discussed', segs: [] });
      p.selfReview.newVsExisting.push({ ref: 'NEW-6', nearest: null, whyNew: 'New coordination commitment made in this meeting by Alvarez.' }); },
    expect: [['NEW-DUPLICATE', 'NEW-6'], ['COV-CONTRADICTION', 'AI-204'], ['COV-UNBOUND-DISPOSITION', 'S022']] }, // S034 still links AI-204: hard contradiction
  { id: 'D03', title: 'POC minted as new task instead of AI-205 update', row: 'R14',
    mutate: p => { dropOp(p, o => o.tasking === 'AI-205');
      p.ops.push({ op: 'NewTasking', ref: 'NEW-6', project: 'P2', label: 'Provide a direct site point of contact', assignee: 'alvarez', src: [q('S024', 'can you get us a direct point of contact'), q('S025', 'Yes. Absolutely.')] });
      ['S024', 'S025'].forEach(s => segOf(p, s).dispositions.forEach(d => { d.about = ['NEW-6']; }));
      segOf(p, 'S034').dispositions[0].about = ['AI-204'];
      Object.assign(p.register.find(r => r.id === 'AI-205'), { coverage: 'not_discussed', segs: [] });
      p.selfReview.newVsExisting.push({ ref: 'NEW-6', nearest: null, whyNew: 'Alvarez accepted a new request for a direct site point of contact.' }); },
    expect: [['NEW-DUPLICATE', 'NEW-6'], ['COV-POSSIBLE-MATCH', 'AI-205']] },
  { id: 'D04', title: 'Route verification split into verify + guidance', row: 'R04',
    mutate: p => { const o = opBy(p, o => o.ref === 'NEW-2'); o.label = 'Verify route suitability'; o.src = [q('S027', 'There is a route identified. I need to check that it is suitable for your transfer requirements.')];
      p.ops.push({ op: 'NewTasking', ref: 'NEW-6', project: 'P2', label: 'Provide route guidance', assignee: 'alvarez', src: [q('S029', 'I will work through that so you know which route to use.')] });
      segOf(p, 'S026').dispositions[0].about = ['NEW-2', 'NEW-6']; segOf(p, 'S029').dispositions[0].about = ['NEW-6'];
      p.selfReview.newVsExisting.push({ ref: 'NEW-6', nearest: null, whyNew: 'Alvarez separately committed to tell the team which route to use.' }); },
    expect: [['OVER-SPLIT', 'NEW-2+NEW-6'], ['COV-UNBOUND-DISPOSITION', 'S026']] },
  { id: 'D05', title: 'Staging task drops the alternate-area contingency', row: 'R05',
    mutate: p => { opBy(p, o => o.ref === 'NEW-3').label = 'Verify staging-area load suitability'; },
    expect: [['CONTINGENCY-DROPPED', 'NEW-3']] },
  // D06 revised 2026-10-12: the old D06 (summaries task without "materials") is no longer a defect.
  { id: 'D06', title: 'Information task drops the partner-site slide deck', row: 'R06',
    mutate: p => { opBy(p, o => o.ref === 'NEW-1').label = "Send the group yesterday's discussion information"; },
    expect: [['DELIVERABLE-DROPPED', 'NEW-1']] },
  { id: 'D07', title: 'Invitation update minted as a P2 tasking', row: 'R07',
    mutate: p => { p.ops.push({ op: 'NewTasking', ref: 'NEW-6', project: 'P2', label: 'Forward the recurring coordination invitation to James', assignee: 'alvarez', src: [q('S045', 'Can you forward the recurring coordination invitation directly to James?'), q('S047', 'Okay.')] });
      segOf(p, 'S047').dispositions = [{ kind: 'commitment', about: ['NEW-6'] }];
      p.selfReview.newVsExisting.push({ ref: 'NEW-6', nearest: null, whyNew: 'Alvarez accepted the request to forward the recurring invitation to James.' }); },
    expect: [['ADMIN-IN-PROJECT', 'NEW-6']] },
  { id: 'D08', title: 'Conditional observer instruction minted as unowned task', row: 'R09',
    mutate: p => { p.ops.push({ op: 'NewTasking', ref: 'NEW-6', project: 'P2', label: 'Send additional observer names to the event coordinator', assignee: null, src: [q('S033', 'If additional observers appear, send their names to the event coordinator.')] });
      p.selfReview.newVsExisting.push({ ref: 'NEW-6', nearest: null, whyNew: 'Instruction to send any additional observer names to the event coordinator.' }); },
    expect: [['CONDITIONAL-TASKING', 'NEW-6']] },
  { id: 'D09', title: 'Working-plan discussion filed against P2, AI-206 not updated', row: 'R12',
    mutate: p => { dropOp(p, o => o.tasking === 'AI-206');
      ['S036', 'S037'].forEach(s => { segOf(p, s).dispositions = [{ kind: 'discussion_of_register_item', about: ['P2'] }]; });
      p.register.find(r => r.id === 'AI-206').coverage = 'not_discussed'; p.register.find(r => r.id === 'AI-206').segs = [];
      p.flags.find(f => f.about.includes('AI-206')).about = ['P2']; ['S005', 'S006', 'S007', 'S008', 'S009', 'S010', 'S011', 'S012', 'S035', 'S038', 'S041', 'S042', 'S043'].forEach(s => segOf(p, s).dispositions.forEach(d => { d.about = ['P2']; })); },
    expect: [['DISP-ABOUT-PROJECT', 'S036'], ['DISP-ABOUT-PROJECT', 'S037'], ['COV-UNBOUND-DISPOSITION', 'S035'], ['COV-UNBOUND-DISPOSITION', 'S038'], ['COV-UNBOUND-DISPOSITION', 'S042'], ['COV-UNBOUND-DISPOSITION', 'S043']] }, // S041 keeps its rationale note
  { id: 'D10', title: 'selfReview omitted', row: 'R13',
    mutate: p => { delete p.selfReview; }, expect: [['SELF-REVIEW-MISSING', 'selfReview']] },
  { id: 'D11', title: 'selfReview claims no similar task for a duplicate', row: 'R02',
    mutate: p => { const o = opBy(p, o => o.ref === 'NEW-3'); o.label = 'Verify the intended staging area and partner site arrangements for the heavy equipment, and identify an alternate staging area if needed';
      p.selfReview.newVsExisting.find(r => r.ref === 'NEW-3').nearest = null; },
    expect: [['NEW-DUPLICATE', 'NEW-3']] },
  // D12 (updated 2026-10-12, hygiene): "today's transcript" names the document, so the merged task's "today" is ungrounded
  // (TIME-UNGROUNDED), not a second deadline (TIMING-MERGED). The merge itself is still the R16 rubric defect.
  { id: 'D12', title: 'Slide-deck information merged with transcript, dated from "today\'s transcript"', row: 'R16',
    mutate: p => { dropOp(p, o => o.ref === 'NEW-1' || o.ref === 'NEW-4');
      p.ops.push({ op: 'NewTasking', ref: 'NEW-6', project: 'P2', label: "Send yesterday's discussion information and today's transcript to the group", assignee: 'alvarez', dueDate: '2026-10-01', duePhrase: 'today',
        src: [q('S019', "I will send everyone information from yesterday's discussion this morning."), q('S033', "I will provide today's transcript to this group")] });
      segOf(p, 'S019').dispositions[0].about = ['NEW-6']; segOf(p, 'S033').dispositions[1].about = ['NEW-6'];
      p.selfReview.newVsExisting = p.selfReview.newVsExisting.filter(r => !['NEW-1', 'NEW-4'].includes(r.ref)).concat([{ ref: 'NEW-6', nearest: null, whyNew: 'Sending the discussion information and the transcript is a documentation deliverable no register item covers.' }]); },
    expect: [['TIME-UNGROUNDED', 'NEW-6']] },
  { id: 'D13', title: "Others' work in progress minted as an unowned task", row: 'R09',
    mutate: p => { p.ops.push({ op: 'NewTasking', ref: 'NEW-6', project: 'P2', label: 'Set up the observer day-by-day schedule process', assignee: null,
        src: [q('S031', 'A separate process is being developed so that group can stay informed about the day-by-day flow of activity.'), q('S033', 'Our side is developing a flexible day-by-day schedule so observers can decide when to attend.')] });
      segOf(p, 'S031').dispositions[0].about = ['NEW-6']; segOf(p, 'S033').dispositions[3].about = ['NEW-6'];
      p.selfReview.newVsExisting.push({ ref: 'NEW-6', nearest: null, whyNew: 'Setting up the observer schedule process is not covered by any register item.' }); },
    expect: [['TASK-NO-ACCEPTANCE', 'NEW-6']] },
  { id: 'D14', title: 'Transcript and summaries bundled from one sentence', row: 'R16',
    mutate: p => { dropOp(p, o => o.ref === 'NEW-4'); const o = opBy(p, o => o.ref === 'NEW-5');
      o.label = "Send today's transcript and yesterday's partner-session summaries and supporting materials"; o.src.unshift(q('S033', "I will provide today's transcript to this group"));
      segOf(p, 'S033').dispositions[1].about = ['NEW-5']; p.selfReview.newVsExisting = p.selfReview.newVsExisting.filter(r => r.ref !== 'NEW-4'); },
    expect: [['DELIVERABLES-MERGED', 'NEW-5']] },
  // R17 (rubric) and, since the 2026-10-12 hygiene ruling, the validator: "today's transcript" names the document, so a
  // due date resting on it is TIME-UNGROUNDED and goes to the repair prompt.
  { id: 'D15', title: 'Transcript task dated from the words "today\'s transcript"', row: 'R17',
    mutate: p => { Object.assign(opBy(p, o => o.ref === 'NEW-4'), { dueDate: '2026-10-01', duePhrase: 'today' }); },
    expect: [['TIME-UNGROUNDED', 'NEW-4']] },
  { id: 'D16', title: 'Task marked completed on "I think I have that done"', row: 'R18',
    mutate: p => { p.ops.push({ op: 'Status', tasking: 'AI-205', status: 'completed', src: [q('S050', 'All right, I think I have that done.')] }); },
    expect: [['SUPPORT-MISSING', `Status:AI-205#${GOLDEN_B.ops.length + 1}`]] },
  { id: 'D17', title: 'Task handed to someone who did not take it on', row: 'R18',
    mutate: p => { p.ops.push({ op: 'Reassign', tasking: 'AI-206', from: null, to: 'patel', src: [q('S037', 'The transfer equipment will connect directly to the support system.')] }); },
    expect: [['SUPPORT-MISSING', `Reassign:AI-206#${GOLDEN_B.ops.length + 1}`]] },
  { id: 'D18', title: 'Two different owners for one task in the same reply', row: 'R19',
    mutate: p => { p.ops.push({ op: 'Reassign', tasking: 'AI-204', from: null, to: 'ortiz', src: [q('S023', 'I will start coordinating with the Partner agency')] }); },
    expect: [['OP-CONFLICT', 'Reassign:AI-204#2'], ['SUPPORT-MISSING', `Reassign:AI-204#${GOLDEN_B.ops.length + 1}`]] }
];
function runMutations() {
  return MUTATIONS.map(m => {
    const p = g(); m.mutate(p);
    const r = V.validate(p, CTX_B);
    const key = ([c, ref]) => `${c} @ ${ref}`;
    const got = new Set(r.flags.filter(f => f.sev === 'block').map(f => key([f.code, f.ref])));
    const exp = new Set(m.expect.map(key));
    const missing = [...exp].filter(k => !got.has(k)), unexpected = [...got].filter(k => !exp.has(k));
    const rowHit = evaluate(p, 'B').rows.find(x => x.id === m.row);
    return { id: m.id, title: m.title, row: m.row, expected: [...exp], pass: !missing.length && !unexpected.length && rowHit && rowHit.defect, missing, unexpected, rubricRowDetects: !!(rowHit && rowHit.defect), flags: r.flags };
  });
}

/* ---------- Repair prompt (shared module) ---------- */
const REPAIR = NODE ? require('../../src/modules/repair.js') : root.MGRepair;
const repairPrompt = result => REPAIR.repairPrompt(result);

const api = { SEGMENTS, MEETING_DATE, BASE_A, BASE_B, CTX_A, CTX_B, FLAWED, GOLDEN_B, RUBRIC, evaluate, MUTATIONS, runMutations, repairPrompt, parseTeams };
if (NODE && module.exports) module.exports = api;
root.MGDifficult = api;
})(typeof window !== 'undefined' ? window : globalThis);
