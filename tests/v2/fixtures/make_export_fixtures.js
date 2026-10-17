// MeetingGraph v2 — the export 1.1 conformance fixtures (plan §10.31), for apps that read the export (Dossier Studio).
// Synthetic meetings, run through the real pipeline: the reply check, the review, project placement, Save, board
// decisions, and the two exports. Every name, statement and email is invented.
// Run: node tests/v2/fixtures/make_export_fixtures.js     (writes tests/v2/fixtures/export-1.1/*.json)
// v2test.js (t54a) rebuilds them in memory and fails if the committed files differ, so they always match the code.
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const MOD = process.env.MKG2_MODULES || path.join(ROOT, 'src', 'v2', 'modules');
const R = require(path.join(MOD, 'reply.js')), S = require(path.join(MOD, 'store.js')), SD = require(path.join(MOD, 'seed.js'));
const RV = require(path.join(MOD, 'review.js')), PE = require(path.join(MOD, 'people.js')), AT = require(path.join(MOD, 'attendance.js'));
const EX = require(path.join(MOD, 'export.js'));
const OUT = path.join(__dirname, 'export-1.1');
const PM = 'Pat Morgan';

const seg = (id, t, speakerName, text) => ({ id, t, speakerName, text });
const line = o => JSON.stringify(o);
function meeting({ pkgs, date, time, offset, title, segments, summary, items, review, savedBy, savedAt, attendance }) {
  const m = { id: new Date(`${date}T${time}:00${offset}`).toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z'), date, time, offset, title };
  const board = S.replay(pkgs, { upTo: m.id }), known = S.projectsOf(pkgs);
  const open = S.openThreads(board, known.map(p => p.code)).map(t => t.id);
  const token = `MKG2|followup|${m.id}|fixture`;
  const text = [line({ context: token, lastSeg: segments[segments.length - 1].id, summary })]
    .concat(items.map((x, i) => line(Object.assign({ ref: 'N' + (i + 1), topic: '', who: null, due: null, importance: 'normal', thread: null, status: null, waitsOn: null }, x))))
    .concat([line({ end: items.length })]).join('\n');
  const c = R.checkReply(text, { segments, token, openIds: open, projectCodes: known.map(p => p.code) });
  if (c.stop) throw new Error(c.stop);
  const rv = review || {};
  for (const a of rv.add || []) { const r = R.addItem(c, segments, a); if (r.error) throw new Error(r.error); r.item.pick = a.project; }
  for (const [n, r] of Object.entries(rv.r || {})) c.items.find(x => x.n === +n).r = r;
  const people = PE.peopleOf(pkgs);
  const ap = RV.applyReview(c.items, { answers: rv.answers || {}, related: rv.related || [], people, meetingDate: date });
  const pl = S.placeItems({ items: ap.items, proposals: [], known, board });
  if (pl.need.length || pl.errors.length) throw new Error('placement: ' + JSON.stringify([pl.need.map(x => x.n), pl.errors]));
  const att = attendance ? AT.forPackage(attendance, PE.peopleOf(pkgs), [...new Set(segments.map(s => s.speakerName))]) : null;
  return S.meetingPackage({ pkgs, projects: pl.covered, meeting: m, statements: segments, request: { token, kind: 'followup', openIds: open },
    checked: Object.assign({}, c, { items: pl.items }), savedBy, savedAt, newProjects: [], aliases: ap.aliases, attendance: att });
}
const decide = (pkgs, action, id, note, savedAt) => { const r = S.boardDecision({ board: S.replay(pkgs), action, ids: [id], note, savedBy: PM, savedAt }); if (r.error) throw new Error(r.error); return r.pkg; };
const decideP = (pkgs, action, project, note, savedAt) => { const r = S.projectDecision({ board: S.replay(pkgs), action, project, note, savedBy: PM, savedAt }); if (r.error) throw new Error(r.error); return r.pkg; };
const idOf = (pkgs, what) => { const t = [...S.replay(pkgs).threads.values()].find(x => x.what === what); if (!t) throw new Error('no item ' + what); return t.id; };

function build() {
  const pkgs = [];
  // 2026-10-01: the spreadsheet start (people with emails, a decision, two projects).
  const csv = ['Type,Project,Title,Owner,Email,Teams name,Due,Status,Waiting on,Notes',
    'Project,Harbor Point reopening,,,,,,,,Reopen the Harbor Point branch.', 'Project,Library build,,,,,,,,Build the new library annex.',
    'Person,,Grace Okafor,,grace.okafor@example.org,"Okafor, Grace",,,,', 'Person,,Tom Lindqvist,,tom.lindqvist@example.org,"Lindqvist, Tom",,,,',
    'Person,,Ana Ruiz,,ana.ruiz@example.org,,,,,', 'Person,,Dana Brooks,,dana.brooks@example.org,"Brooks, Dana",,,,',
    'Action,Harbor Point reopening,Book the fire inspection,Grace Okafor,,,,Open,,', 'Action,Harbor Point reopening,Get caterer quotes,Tom Lindqvist,,,,Open,,',
    // AT-I15: an owner who never speaks in a meeting. Before shared-HP.json's range, so not in its shared register.
    'Action,Harbor Point reopening,Order the opening banners,Dana Brooks,,,,Open,,',
    'Question,Harbor Point reopening,Which caterer does the opening?,Grace Okafor,,,,Open,,', 'Risk,Harbor Point reopening,The occupancy permit may slip,Grace Okafor,,,,Open,,',
    'Decision,Harbor Point reopening,Keep the case number format,,,,,,,', 'Action,Library build,Pick the architect,Tom Lindqvist,,,,Open,,',
    'Action,Library build,Order the books,Ana Ruiz,,,,Open,,'].join('\n');
  pkgs.push(SD.seedPackage({ seed: SD.readSeed(csv), codes: { 'Harbor Point reopening': 'HP', 'Library build': 'LB' }, asOf: '2026-10-01', savedBy: PM, savedAt: '2026-10-01T12:00:00.000Z' }));
  // 2026-10-05: a meeting before the shared range (its work shows in derived, its statements don't).
  pkgs.push(meeting({ pkgs, date: '2026-10-05', time: '10:00', offset: '-04:00', title: 'Harbor Point weekly', savedBy: PM, savedAt: '2026-10-05T15:00:00.000Z',
    summary: 'The team planned the reopening notice and started scheduling the fire inspection.',
    segments: [seg('S001', '00:00:05', 'Okafor, Grace', 'I will draft the reopening notice by Friday.'), seg('S002', '00:00:30', 'Lindqvist, Tom', 'How was everyone\'s weekend?'),
      seg('S003', '00:01:10', 'Okafor, Grace', 'The fire inspection is being scheduled now.')],
    items: [{ kind: 'commitment', project: 'HP', who: 'Okafor, Grace', what: 'Draft the reopening notice', due: 'by Friday', seg: 'S001', words: 'I will draft the reopening notice' },
      { kind: 'update', who: 'Okafor, Grace', what: 'The fire inspection is being scheduled', thread: idOf(pkgs, 'Book the fire inspection'), status: 'in_progress', seg: 'S003', words: 'fire inspection is being scheduled' }] }));
  // 2026-10-12: a two-project meeting, saved and then re-saved; every kind of item the review produces.
  const segs12 = [seg('S001', '00:00:10', 'Okafor, Grace', 'The fire inspection is booked for the 20th, so that one is done.'),
    seg('S002', '00:01:00', 'Lindqvist, Tom', 'For the library, the architect shortlist is ready.'), seg('S003', '00:02:00', 'Okafor, Grace', 'I can send the notice draft to legal tomorrow.'),
    seg('S004', '00:03:00', 'Lindqvist, Tom', 'Let\'s go with the north entrance for the reopening.'), seg('S005', '00:04:00', 'Ruiz, Ana', 'Sorry I\'m late, my kid has a cold this week.'),
    seg('S006', '00:05:00', 'Okafor, Grace', 'The caterer question is settled: Harbor Catering will do the opening.'),
    seg('S007', '00:06:00', 'Lindqvist, Tom', 'Do we need a second exit sign by the stairs?'), seg('S008', '00:07:00', 'Okafor, Grace', 'I\'ll chase the permit office on Monday.'),
    seg('S009', '00:08:00', 'Front desk', 'We can print the opening signs this week.')];
  const items12 = [
    { kind: 'update', who: 'Okafor, Grace', what: 'The fire inspection is booked', thread: idOf(pkgs, 'Book the fire inspection'), status: 'done', seg: 'S001', words: 'The fire inspection is booked' },
    { kind: 'update', who: 'Lindqvist, Tom', what: 'The architect shortlist is ready', thread: idOf(pkgs, 'Pick the architect'), status: 'in_progress', seg: 'S002', words: 'the architect shortlist is ready' },
    { kind: 'commitment', project: 'HP', who: 'Okafor, Grace', what: 'Send the notice draft to legal', due: 'tomorrow', seg: 'S002', words: 'send the notice draft to legal' },   // near: cited S002, found in S003
    { kind: 'decision', project: 'HP', who: 'Lindqvist, Tom', what: 'Use the north entrance for the reopening', seg: 'S004', words: 'go with the north entrance' },
    { kind: 'commitment', project: 'HP', who: 'Ruiz, Ana', what: 'Bring the cake', seg: 'S005', words: 'I will bring the cake' },   // not found: to check
    { kind: 'update', who: 'Okafor, Grace', what: 'Harbor Catering will do the opening', thread: idOf(pkgs, 'Which caterer does the opening?'), status: 'done', seg: 'S006', words: 'Harbor Catering will do the opening' },
    { kind: 'question', project: 'HP', who: 'Lindqvist, Tom', what: 'Is a second exit sign needed by the stairs?', seg: 'S007', words: 'a second exit sign by the stairs' },
    { kind: 'question', project: 'HP', who: 'Lindqvist, Tom', what: 'Second exit sign by the stairs', seg: 'S007', words: 'Do we need a second exit sign' },   // the same as item 7
    { kind: 'commitment', project: 'HP', who: 'Okafor, Grace', what: 'Chase the permit office', due: 'on Monday', thread: idOf(pkgs, 'The occupancy permit may slip'), status: 'in_progress', seg: 'S008', words: 'chase the permit office on Monday' },   // split: new action + status
    { kind: 'commitment', project: 'HP', who: 'Front desk', what: 'Print the opening signs', due: 'this week', seg: 'S009', words: 'print the opening signs this week' }];
  const review12 = { answers: { 'Ruiz, Ana': { action: 'same', person: 'Ana Ruiz' }, 'Front desk': { action: 'none' } }, r: { 8: { sameAs: 7 } },
    related: [{ thread: idOf(pkgs, 'Get caterer quotes'), from: 6 }],
    add: [{ seg: 'S006', kind: 'commitment', who: 'Okafor, Grace', what: 'Sign the catering contract', due: 'next week', project: 'HP' }] };
  const att = { title: 'Joint project walk', start: '10/12/26, 10:00:02 AM', end: '10/12/26, 10:41:10 AM', duration: '41m 8s', participants: [
    { name: 'Okafor, Grace', role: 'Organizer', join: '10/12/26, 10:00:02 AM', leave: '10/12/26, 10:41:10 AM', duration: '41m 8s' },
    { name: 'Lindqvist, Tom', role: 'Presenter', join: '10/12/26, 10:00:40 AM', leave: '10/12/26, 10:41:00 AM', duration: '40m 20s' },
    { name: 'Ruiz, Ana', role: 'Attendee', join: '10/12/26, 10:04:10 AM', leave: '10/12/26, 10:41:00 AM', duration: '36m 50s' },
    { name: 'Zed Visitor', role: 'Attendee', join: '10/12/26, 10:10:00 AM', leave: '10/12/26, 10:20:00 AM', duration: '10m 0s' }] };
  const m12 = { date: '2026-10-12', time: '10:00', offset: '-04:00', title: 'Joint project walk', segments: segs12, attendance: att,
    summary: 'The walk covered the Harbor Point reopening and the library: the inspection is booked, the caterer is chosen, the north entrance was agreed, and the architect shortlist is ready.' };
  pkgs.push(meeting(Object.assign({ pkgs, items: items12, review: review12, savedBy: PM, savedAt: '2026-10-12T16:00:00.000Z' }, m12)));
  // The re-save: the decision marked high.
  const rs = JSON.parse(JSON.stringify(review12)); rs.r[4] = { importance: 'high' };
  pkgs.push(meeting(Object.assign({ pkgs, items: items12, review: rs, savedBy: PM, savedAt: '2026-10-12T18:30:00.250Z' }, m12)));
  // Board decisions between meetings: every kind.
  pkgs.push(decide(pkgs, 'not_needed', idOf(pkgs, 'Order the books'), 'The library keeps its old stock', '2026-10-13T09:00:00.000Z'));
  pkgs.push(decide(pkgs, 'undo', idOf(pkgs, 'Order the books'), 'The books are needed after all', '2026-10-14T09:00:00.000Z'));
  pkgs.push(decide(pkgs, 'settled', idOf(pkgs, 'Send the notice draft to legal'), 'Sent by email on the 13th', '2026-10-15T09:00:00.000Z'));
  pkgs.push(decide(pkgs, 'raise', idOf(pkgs, 'The occupancy permit may slip'), 'Bring it to the next meeting', '2026-10-16T09:00:00.000Z'));
  pkgs.push(decide(pkgs, 'lower', idOf(pkgs, 'The occupancy permit may slip'), 'Covered by email instead', '2026-10-17T09:00:00.000Z'));
  // 2026-10-19: one meeting saved twice by different people, neither knowing of the other: a conflict.
  const m19 = { date: '2026-10-19', time: '10:00', offset: '-04:00', title: 'Harbor Point weekly',
    summary: 'The reopening notice is approved, and the second exit sign is not needed.',
    segments: [seg('S001', '00:00:05', 'Okafor, Grace', 'The reopening notice went out to legal and is approved.'), seg('S002', '00:00:40', 'Lindqvist, Tom', 'The exit sign is not needed, the code allows one.')] };
  const items19 = [{ kind: 'update', who: 'Okafor, Grace', what: 'The reopening notice is approved', thread: idOf(pkgs, 'Draft the reopening notice'), status: 'done', seg: 'S001', words: 'the reopening notice went out to legal' },
    { kind: 'update', who: 'Lindqvist, Tom', what: 'The second exit sign is not needed', thread: idOf(pkgs, 'Is a second exit sign needed by the stairs?'), status: 'done', seg: 'S002', words: 'The exit sign is not needed' }];
  const base19 = pkgs.slice();
  pkgs.push(meeting(Object.assign({ pkgs: base19, items: items19, savedBy: PM, savedAt: '2026-10-19T15:00:00.000Z' }, m19)));
  pkgs.push(meeting(Object.assign({ pkgs: base19, items: items19, review: { r: { 1: { undo: true } } }, savedBy: 'Sam Lee', savedAt: '2026-10-19T15:05:00.000Z' }, m19)));
  // The project decisions: the library closed in the range, reopened after it.
  pkgs.push(decideP(pkgs, 'close_project', 'LB', 'Library paused for the budget review', '2026-10-22T09:00:00.000Z'));
  pkgs.push(decideP(pkgs, 'reopen_project', 'LB', 'The budget is approved', '2026-11-01T09:00:00.000Z'));
  // 2026-11-03: a meeting after the shared range.
  pkgs.push(meeting({ pkgs, date: '2026-11-03', time: '10:00', offset: '-05:00', title: 'Harbor Point weekly', savedBy: PM, savedAt: '2026-11-03T16:00:00.000Z',
    summary: 'The occupancy permit came through.', segments: [seg('S001', '00:00:05', 'Okafor, Grace', 'The occupancy permit came through yesterday.')],
    items: [{ kind: 'update', who: 'Okafor, Grace', what: 'The occupancy permit came through', thread: idOf(pkgs, 'The occupancy permit may slip'), status: 'done', seg: 'S001', words: 'The occupancy permit came through' }] }));

  const exportedAt = '2026-11-04T12:00:00.000Z';
  const full = EX.workspace(pkgs, { exportedAt });
  const share = (projects, from) => { const r = EX.reduced(pkgs, { projects, from, to: '2026-10-31', exportedAt }); if (r.error) throw new Error(r.error); return r.file; };
  return { 'full.json': full, 'shared-HP.json': share(['HP'], '2026-10-10'), 'shared-HP-LB.json': share(['HP', 'LB'], '2026-10-01') };
}
const text = obj => JSON.stringify(obj, null, 1) + '\n';

if (require.main === module) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const [f, obj] of Object.entries(build())) { fs.writeFileSync(path.join(OUT, f), text(obj)); console.log('wrote', path.join('tests', 'v2', 'fixtures', 'export-1.1', f)); }
}
module.exports = { build, text, OUT };
