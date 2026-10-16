// MeetingGraph v2 unit tests (plan §10.8 step 0 and §10.11): transcript, request, reply checks, IDs, replay, email, summary.
// Run: node tests/v2/unit/v2test.js     (MKG2_MODULES=<dir> runs them against another copy of the modules: knockouts)
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..', '..', '..');
const MOD = process.env.MKG2_MODULES || path.join(ROOT, 'src', 'v2', 'modules');
const KIT = path.join(ROOT, 'tests', 'v2-feasibility');
const T = require(path.join(MOD, 'transcript.js')), Q = require(path.join(MOD, 'request.js')), R = require(path.join(MOD, 'reply.js'));
const S = require(path.join(MOD, 'store.js')), E = require(path.join(MOD, 'email.js')), U = require(path.join(MOD, 'summary.js'));
const SD = require(path.join(MOD, 'seed.js'));
const DT = require(path.join(MOD, 'dates.js')), PE = require(path.join(MOD, 'people.js')), RV = require(path.join(MOD, 'review.js'));
const AT = require(path.join(MOD, 'attendance.js'));
// The reviewed copy of the §10.20 request (variant J). It edits the real modules' D and F texts, so a knockout in the
// modules' request.js makes the page's request differ from it.
const KJ = require(path.join(ROOT, 'tests', 'v2-feasibility', 'sample-v1', 'variant-j.js'));
// Lines added to and removed from a text, as multisets (blank lines ignored); the token line is left out.
const bag = t => { const m = new Map(); for (const l of t.split('\n').filter(x => x.trim() && !x.startsWith('CONTEXT TOKEN'))) m.set(l, (m.get(l) || 0) + 1); return m; };
const minus = (a, b) => { const out = [], B = bag(b); for (const [l, k] of bag(a)) for (let i = 0; i < k - (B.get(l) || 0); i++) out.push(l); return out; };
const csvLine = cells => cells.map(c => /[",;\n]/.test(String(c)) ? '"' + String(c).replace(/"/g, '""') + '"' : String(c)).join(',');
const subtle = globalThis.crypto.subtle;
const read = f => fs.readFileSync(path.join(KIT, f), 'utf8');
let n = 0, failed = 0;
const ok = (id, cond, detail) => { n++; if (!cond) failed++; console.log((cond ? 'PASS ' : 'FAIL ') + id + (cond || detail === undefined ? '' : `  [${typeof detail === 'string' ? detail : JSON.stringify(detail)}]`)); };
const safe = (id, fn) => { try { fn(); } catch (e) { ok(id, false, 'threw ' + e.message); } };

const SEED = { date: '2026-10-19', time: '10:00', offset: '-04:00', title: 'Harbor Point reopening kickoff' };
const FU = { date: '2026-10-26', time: '10:00', offset: '-04:00', title: 'Harbor Point reopening weekly' };
const PROJECT = { code: 'HP', name: 'Harbor Point reopening' };
const meetingOf = M => ({ id: T.meetingId(M.date, M.time, M.offset), date: M.date, time: M.time, offset: M.offset, title: M.title });
const segsSeed = T.segmentTranscript(read('mock-seed-meeting-2026-10-19.txt'));
const segsFu = T.segmentTranscript(read('mock-followup-meeting-2026-10-26.txt'));
const blockSeed = T.meetingBlock(SEED.date, SEED.title, segsSeed), blockFu = T.meetingBlock(FU.date, FU.title, segsFu);

// The board after the seed meeting (board-after-seed.json) as a package, with its fixture IDs (AI-101 ...).
function fixtureBoard() {
  const B = JSON.parse(read('board-after-seed.json')).threads;
  const KIND = { action: 'commitment', question: 'question', risk: 'risk', decision: 'decision' };
  const label = d => { const p = d.split(' '); return p.length > 1 ? `${p.slice(1).join(' ')}, ${p[0]}` : d; };
  return { mkg2: '1.0', kind: 'meeting', id: 'mkg2-meeting-HP-fixture', savedAt: '2026-10-19T16:00:00Z', savedBy: 'fixture', supersedes: null,
    project: PROJECT, meeting: Object.assign(meetingOf(SEED), { dayKey: '261019' }), statements: [], request: { token: 'fixture', kind: 'seed', openIds: [] },
    reply: {}, minted: { maxNum: { A: 15, Q: 3, R: 3, D: 5 } },
    items: B.map((t, i) => ({ n: i + 1, kind: KIND[t.kind], who: t.owner ? label(t.owner) : null, what: t.what, due: t.due, id: t.id, seg: 'S001', thread: null, status: null, toCheck: false })) };
}
const runText = f => fs.readFileSync(path.join(KIT, 'runs', f), 'utf8');
const tokenOf = f => /CONTEXT TOKEN[^:]*: (\S+)/.exec(read(f))[1];
const TOK_D = tokenOf('request-D-lines.txt'), TOK_F = tokenOf('request-F-followup.txt');
const EMPTY = { items: [], reply: { summary: '', lastSeg: null }, cut: null, note: null, lastSegOk: false };
// A checked reply, or an empty one when the check stops (so a knockout fails the named checks instead of crashing).
const checked = (text, o) => { const c = R.checkReply(text, o); return c.stop ? Object.assign({}, EMPTY, { stop: c.stop }) : c; };
async function section(name, fn) { try { await fn(); } catch (e) { ok(name + ' (section)', false, 'threw ' + e.message); } }

(async () => {
  // ---------- transcript ----------
  ok('t1 seed meeting numbered exactly as the workbench numbered it (meeting-2026-10-19.txt)', blockSeed === read('meeting-2026-10-19.txt'), `${segsSeed.length} statements`);
  ok('t2 follow-up meeting numbered exactly as the workbench numbered it (meeting-2026-10-26.txt)', blockFu === read('meeting-2026-10-26.txt'), `${segsFu.length} statements`);
  const h = T.parseTeamsHeader('Harbor Point reopening kickoff-20261019_100000-Meeting Transcript\n59m 50s\nOkafor, Grace   0:00:04\nHi');
  ok('t3 the Teams header gives the title, date and time', h && h.title === 'Harbor Point reopening kickoff' && h.date === '2026-10-19' && h.time === '10:00', h);
  ok('t4 the meeting ID is the UTC start', T.meetingId('2026-10-19', '10:00', '-04:00') === '20261019T140000Z');

  // ---------- request: the tested D and F, with the §10.20 project edits and nothing else ----------
  const reqSeed = await Q.buildRequest({ id: meetingOf(SEED).id, meeting: blockSeed, threads: [], projects: [] }, subtle);
  const kjSeed = await KJ.buildRequestJ({ id: meetingOf(SEED).id, meeting: blockSeed, threads: [], projects: [] }, subtle);
  const dAdd = minus(reqSeed.text, read('request-D-lines.txt')), dGone = minus(read('request-D-lines.txt'), reqSeed.text);
  ok('t5 a first meeting\'s request is request D plus the reviewed project edits (variant J), byte for byte', reqSeed.text === kjSeed.text && reqSeed.token === kjSeed.token && reqSeed.kind === 'seed' &&
     dAdd.length === 8 && dGone.length === 2 && dGone.every(l => /^- Then one line per item|^- The last line/.test(l)) && reqSeed.text.includes('=== PROJECTS ===\nnone yet: the board has no projects\n\n=== MEETING ==='), [dAdd.length, dGone.length]);
  const board0 = S.replay([fixtureBoard()]);
  const open0 = S.openThreads(board0, ['HP']);
  const reqFu = await Q.buildRequest({ id: meetingOf(FU).id, meeting: blockFu, threads: open0, projects: [PROJECT] }, subtle);
  const kjFu = await KJ.buildRequestJ({ id: meetingOf(FU).id, meeting: blockFu, threads: open0, projects: [PROJECT] }, subtle);
  ok('t6 a follow-up\'s request, from the replayed board, is request F plus the reviewed project edits, byte for byte', reqFu.text === kjFu.text && reqFu.token === kjFu.token && reqFu.kind === 'followup', `${open0.length} open threads`);
  ok('t6b every open thread shows its project, and the projects are listed by code and name', reqFu.text.includes('ID | project | kind | owner | what | due as said | status\nAI-101 | HP | action |') &&
     reqFu.text.includes('=== PROJECTS ===\nCODE | name\nHP | Harbor Point reopening\n\n=== OPEN THREADS ==='));

  // ---------- reply checks on the real runs ----------
  const chk = (f, segs, token, openIds) => R.checkReply(runText(f), { segments: segs, token, openIds });
  const SEGS_D = segsSeed, SEGS_F = segsFu;
  const want = { 'D1.txt': 36, 'D2.txt': 31, 'D3.txt': 34 };
  for (const [f, k] of Object.entries(want)) safe('t7 ' + f, () => { const c = chk(f, SEGS_D, TOK_D, []);
    ok(`t7 ${f}: ${k} items, every source verified, complete, last statement named`, !c.stop && c.items.length === k && c.items.every(x => x.src === 'verified') && !c.cut && c.lastSegOk, c.stop || [c.items.length, c.cut]); });
  safe('t7b', () => ok('t7b D2: the end line miscount is a note, not a cut (§5.10)', !!chk('D2.txt', SEGS_D, TOK_D, []).note));
  const openIds0 = JSON.parse(read('board-after-seed.json')).threads.map(t => t.id);
  const wantF = { 'F1.txt': 43, 'F2.txt': 43, 'F3.txt': 45 };
  for (const [f, k] of Object.entries(wantF)) safe('t8 ' + f, () => { const c = chk(f, SEGS_F, TOK_F, openIds0);
    ok(`t8 ${f}: ${k} items, every source verified, no unknown thread, statuses kept`, !c.stop && c.items.length === k && c.items.every(x => x.src === 'verified') && c.items.every(x => !x.notes.length) && c.items.some(x => x.status === 'done'), c.stop || c.items.filter(x => x.notes.length).map(x => x.notes)); });
  safe('t9', () => { const c = chk('B1.txt', SEGS_D, TOK_D, []); ok('t9 B1 (one long line, cut): the 18 complete items are kept, and the reply is marked cut', !c.stop && c.items.length === 18 && !!c.cut, c.stop || [c.items.length, c.cut]); });
  safe('t10', () => { const c = chk('A1.txt', SEGS_D, TOK_D, []); ok('t10 a reply to v1\'s request stops with a plain message', !!c.stop, c); });
  const d1 = runText('D1.txt');
  ok('t11 the wrong context token stops the import', !!R.checkReply(d1.replace(TOK_D, 'MKG2|seed|x|y'), { segments: segsSeed, token: TOK_D }).stop);
  ok('t11b an empty paste stops the import', !!R.checkReply('nothing here', { segments: segsSeed, token: TOK_D }).stop);
  const lines = d1.split('\n').filter(l => l.trim().startsWith('{'));
  const head = lines[0], body = lines.slice(1, -1), endl = lines[lines.length - 1];
  const one = o => R.checkReply([head, JSON.stringify(o), '{"end":1}'].join('\n'), { segments: segsSeed, token: TOK_D, openIds: ['AI-101'] }).items[0];
  const base = JSON.parse(body[1]);
  ok('t12a paraphrased words: "not found", kept, marked to check', (x => x.src === 'not found' && x.toCheck)(one(Object.assign({}, base, { words: 'I shall telephone the marshal' }))));
  ok('t12b the words in the next statement: "near", and the statement is corrected', (x => x.src === 'near' && x.seg === base.seg && x.citedSeg !== base.seg)(one(Object.assign({}, base, { seg: 'S' + String(+base.seg.slice(1) + 1).padStart(3, '0') }))));
  ok('t12c a thread the request did not list becomes new work', (x => x.thread === null && /not in the request/.test(x.notes.join()))(one(Object.assign({}, base, { thread: 'AI-999', status: 'done' }))));
  ok('t12d a status without a thread is dropped', (x => x.status === null)(one(Object.assign({}, base, { status: 'done' }))));
  ok('t12e a status that is not done, blocked or in_progress is dropped', (x => x.status === null)(one(Object.assign({}, base, { thread: 'AI-101', status: 'finished' }))));
  ok('t12f a waits-on that names nothing is dropped', (x => x.waitsOn === null)(one(Object.assign({}, base, { waitsOn: 'N77' }))));
  const vs = [{ id: 'S001', speakerName: 'A, B', text: 'We start Monday the 2nd. Is going to be busy, and the island is far.' }], vb = { S001: vs[0] };
  ok('t12h the words match across punctuation and case ("the 2nd. Is" = "the 2nd is"; found on a real meeting)', R.verify('S001', 'Monday the 2nd is going to be', vb, vs).src === 'verified');
  ok('t12i whole words only: "is" does not match inside "island"', R.verify('S001', 'the is far', vb, vs).src === 'not found' && R.verify('S001', 'and the isl', vb, vs).src === 'not found');
  ok('t12g an unknown kind is kept as an update, with a note', (x => x.kind === 'update' && x.notes.length)(one(Object.assign({}, base, { kind: 'task' }))));
  const cutc = R.checkReply([head, ...body.slice(0, 10)].join('\n'), { segments: segsSeed, token: TOK_D });
  ok('t13a no end line: the complete items are kept, and the reply is cut', cutc.items.length === 10 && /no end line/.test(cutc.cut), cutc.cut);
  ok('t13b an end line counting more items than arrived: cut', !!R.checkReply([head, ...body, '{"end":99}'].join('\n'), { segments: segsSeed, token: TOK_D }).cut);
  ok('t13c a line cut in the middle: the lines before it are kept', R.checkReply([head, ...body.slice(0, 5), body[5].slice(0, 30)].join('\n'), { segments: segsSeed, token: TOK_D }).items.length === 5);

  // ---------- packages and IDs (B12) ----------
  let cD1 = EMPTY, P1 = null, P1b = null, fx = null, cF2 = EMPTY, PF2 = null;
  await section('packages and IDs', async () => {
  cD1 = checked(d1, { segments: segsSeed, token: TOK_D, openIds: [] });
  P1 = S.meetingPackage({ pkgs: [], project: PROJECT, meeting: meetingOf(SEED), statements: segsSeed, request: { token: TOK_D, kind: 'seed', openIds: [] }, checked: cD1, savedBy: 'test', savedAt: '2026-10-19T15:00:00.000Z' });
  const ids = P1.items.filter(x => x.id).map(x => x.id);
  const mintable = cD1.items.filter(x => ['commitment', 'question', 'risk', 'decision'].includes(x.kind)).length;
  ok('t14 every new commitment, question, risk and decision gets an ID; updates do not', ids.length === mintable && P1.items.filter(x => x.kind === 'update').every(x => !x.id), [ids.length, mintable]);
  ok('t14b IDs carry the project, the kind and the date with the year, and are unique', ids.every(i => /^HP-[AQRD]-261019-\d{2}$/.test(i)) && new Set(ids).size === ids.length, ids.slice(0, 3));
  ok('t14c the package is mkg2 1.0, named mkg2-, and supersedes nothing', P1.mkg2 === '1.0' && P1.id.startsWith('mkg2-meeting-HP-20261019T140000Z-') && P1.supersedes === null);
  P1b = S.meetingPackage({ pkgs: [P1], project: PROJECT, meeting: meetingOf(SEED), statements: segsSeed, request: P1.request, checked: cD1, savedAt: '2026-10-19T16:00:00.000Z' });
  ok('t15a saved again: it supersedes the first save, and every ID is kept', P1b.supersedes === P1.id && JSON.stringify(P1b.items.map(x => x.id)) === JSON.stringify(P1.items.map(x => x.id)));
  const dropFirst = Object.assign({}, cD1, { items: cD1.items.filter(x => x.id !== undefined).filter((x, i) => i !== cD1.items.findIndex(y => y.kind === 'commitment')) });
  const added = Object.assign({}, cD1.items.find(y => y.kind === 'commitment'), { seg: 'S470', words: 'Bye.' , n: 99 });
  const P1c = S.meetingPackage({ pkgs: [P1, P1b], project: PROJECT, meeting: meetingOf(SEED), statements: segsSeed, request: P1.request, checked: Object.assign({}, dropFirst, { items: [...dropFirst.items, added] }), savedAt: '2026-10-19T17:00:00.000Z' });
  const firstA = P1.items.find(x => x.kind === 'commitment').id, maxA = Math.max(...P1.items.filter(x => /-A-/.test(x.id || '')).map(x => +x.id.slice(-2)));
  const newId = P1c.items[P1c.items.length - 1].id;
  ok('t15b a re-save keeps the kept items\' IDs, gives a new item the next number, and never reuses a dropped ID',
     P1c.supersedes === P1b.id && +newId.slice(-2) === maxA + 1 && !P1c.items.some(x => x.id === firstA) &&
     P1c.items.filter(x => x.id && x !== P1c.items[P1c.items.length - 1]).every(x => P1.items.some(y => y.id === x.id)), [newId, maxA]);
  const twin = { items: [{ n: 1, kind: 'commitment', seg: 'S010', thread: null }, { n: 2, kind: 'commitment', seg: 'S010', thread: null }] };
  const m1 = S.mint(twin.items, PROJECT, '261019', null), m2 = S.mint(twin.items, PROJECT, '261019', { items: m1.items, minted: { maxNum: m1.maxNum } });
  ok('t16 two items of one kind from one statement keep their IDs by order within the reply', m1.items[0].id !== m1.items[1].id && m2.items[0].id === m1.items[0].id && m2.items[1].id === m1.items[1].id);
  const other = Object.assign(meetingOf(SEED), { id: '20261019T180000Z', time: '14:00' });
  ok('t17a a second meeting of the project on the same day gets a letter (261019b)', S.dayKeyFor([P1], PROJECT, other, null) === '261019b');
  ok('t17b another project meeting the same day mints under its own code', S.mint([{ kind: 'commitment', seg: 'S001' }], { code: 'LB' }, '261019', null).items[0].id === 'LB-A-261019-01');
  ok('t17c the year is in the ID: the same date a year later does not collide', S.dayKeyFor([P1], PROJECT, Object.assign(meetingOf(SEED), { id: '20271019T140000Z', date: '2027-10-19' }), null) === '271019');
  ok('t18 the default project code is the initials, made unique', S.defaultCode('Harbor Point reopening', []) === 'HPR' && S.defaultCode('Harbor Point reopening', ['HPR']) === 'HPR2' && S.validCode('HP') && !S.validCode('h'));

  });

  // ---------- the replay (§10.3) ----------
  await section('replay', async () => {
  fx = fixtureBoard();
  cF2 = checked(runText('F2.txt'), { segments: segsFu, token: TOK_F, openIds: openIds0 });
  PF2 = S.meetingPackage({ pkgs: [fx], project: PROJECT, meeting: meetingOf(FU), statements: segsFu, request: { token: TOK_F, kind: 'followup', openIds: openIds0 }, checked: cF2, savedAt: '2026-10-26T15:00:00.000Z' });
  const b2 = S.replay([fx, PF2]);
  const doneIds = cF2.items.filter(x => x.thread && x.status === 'done').map(x => x.thread);
  ok('t19a the chat\'s sourced closures apply (B8): every thread F2 closed is done', doneIds.length > 0 && doneIds.every(id => b2.threads.get(id).status === 'done'), doneIds);
  ok('t19b no thread closes that F2 did not close', [...b2.threads.values()].filter(t => t.status === 'done').every(t => doneIds.includes(t.id)));
  ok('t19c the keycard list is blocked and the website in progress, as F2 says', b2.threads.get('AI-103').status === 'blocked' && b2.threads.get('AI-110').status === 'in_progress');
  const cF2x = JSON.parse(JSON.stringify(cF2)); const victim = cF2x.items.find(x => x.thread === 'AI-101' && x.status === 'done'); victim.toCheck = true; victim.src = 'not found';
  const PF2x = S.meetingPackage({ pkgs: [fx], project: PROJECT, meeting: meetingOf(FU), statements: segsFu, request: PF2.request, checked: cF2x, savedAt: '2026-10-26T15:00:00.000Z' });
  ok('t19d a "done" whose source is to check is not applied', S.replay([fx, PF2x]).threads.get('AI-101').status === 'open');
  const ref = cF2.items.find(x => x.waitsOn && /^N/.test(x.waitsOn));
  ok('t26 a waits-on to another item of the reply points at that item\'s minted ID', !!ref && (it => /^HP-A-261026-\d\d$/.test(it.waitsOnId))(PF2.items.find(x => x.n === ref.n)), ref && PF2.items.find(x => x.n === ref.n).waitsOnId);
  const PF2b = Object.assign({}, PF2, { id: PF2.id + 'b', savedAt: '2026-10-26T16:00:00.000Z', supersedes: PF2.id, items: PF2.items.map(x => Object.assign({}, x, { applied: false })) });
  ok('t20a a superseded package is not replayed', S.replay([fx, PF2, PF2b]).threads.get('AI-101').status === 'open');
  const PF2c = Object.assign({}, PF2b, { id: PF2.id + 'c', supersedes: null });
  const bc = S.replay([fx, PF2c, PF2]);
  ok('t20b two saves of one meeting, neither superseding: the first-saved is used, and the conflict is listed (B16)', bc.conflicts.length === 1 && bc.conflicts[0].used === PF2.id && bc.threads.get('AI-101').status === 'done');
  ok('t21 the replay goes by meeting time, not the order packages were loaded', S.replay([PF2, fx]).threads.get('AI-101').status === 'done');
  const fxDrop = Object.assign({}, fx, { id: 'mkg2-meeting-HP-fixture2', savedAt: '2026-10-20T09:00:00Z', supersedes: fx.id, items: fx.items.filter(x => x.id !== 'AI-101') });
  const bu = S.replay([fx, fxDrop, PF2]);
  ok('t22 a later meeting\'s item on an ID that a re-save dropped is listed as needing a new link, never lost', bu.unlinked.some(u => u.thread === 'AI-101'), bu.unlinked.map(u => u.thread));

  });

  // ---------- the meeting email ----------
  await section('email', async () => {
  const em1 = E.meetingEmail(P1, S.replay([P1], { upTo: P1.meeting.id }));
  const pos = E.SECTIONS.map(h => em1.indexOf(h + '\n'));
  ok('t23a the seed email has the PM\'s seven sections, in order', pos.every(p => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), pos);
  ok('t23b on a first meeting, sections 4 and 5 say so', /None: this is the first meeting, so the board had no existing items/.test(em1) && /5\. Existing open items not discussed\n\nNone: this is the first meeting\./.test(em1));
  const P1t = JSON.parse(JSON.stringify(P1)); P1t.items[0].toCheck = true; P1t.items[0].what = 'ZZ-UNCHECKED-ITEM';
  const em1t = E.meetingEmail(P1t, S.replay([P1t], { upTo: P1t.meeting.id }));
  ok('t23c an item to check appears only in the "to check" list after the email', em1t.indexOf('ZZ-UNCHECKED-ITEM') > em1t.indexOf('To check before sending'));
  const em2 = E.meetingEmail(PF2, S.replay([fx, PF2], { upTo: PF2.meeting.id }));
  const s4 = em2.split('4. Existing items updated')[1].split('5. Existing open items')[0];
  const s5 = em2.split('5. Existing open items not discussed')[1].split('6. Risks')[0];
  const mentioned = new Set(cF2.items.filter(x => x.thread).map(x => x.thread));
  const quiet = open0.filter(t => t.status !== 'decided' && !mentioned.has(t.id)).map(t => t.id);
  ok('t24a the follow-up email lists the updates to open threads in section 4, with their status', /Status: Done\./.test(s4) && [...mentioned].every(id => s4.includes(id)));
  ok('t24b section 5 lists exactly the open threads the meeting did not mention', quiet.every(id => s5.includes(id)) && [...mentioned].every(id => !s5.includes(id + ' ')), quiet);
  const sec2 = t => t.split('2. Executive Summary' + '\n' + '\n')[1].split('\n' + '\n' + '3. New actions')[0];
  const PF2n = JSON.parse(JSON.stringify(PF2)); PF2n.reply.summary = '';
  const em2n = E.meetingEmail(PF2n, S.replay([fx, PF2n], { upTo: PF2n.meeting.id }));
  const PF2u = JSON.parse(JSON.stringify(PF2));
  PF2u.items.push({ n: 999, ref: null, kind: 'update', who: null, what: 'ZZ the elevator is certified', thread: null, id: null, status: null, toCheck: false, seg: 'S001', words: 'w', notes: [] });
  const em2u = E.meetingEmail(PF2u, S.replay([fx, PF2u], { upTo: PF2u.meeting.id }));
  ok('t24d with the chat summary, the meeting\'s other updates (on no open item) are still in the email, under "Also reported"',
     sec2(em2u).includes('Also reported:') && sec2(em2u).includes('- ZZ the elevator is certified'), sec2(em2u).slice(-300));
  ok('t24c the executive summary is the chat\'s saved summary (the Board\'s "Last time we talked"); without one, the summary built from the items, naming what closed',
     !!PF2.reply.summary && sec2(em2).startsWith(PF2.reply.summary.trim()) && !/convened/.test(sec2(em2)) && /convened/.test(sec2(em2n)) && /Closed: /.test(sec2(em2n)), sec2(em2).slice(0, 200));

  });

  // ---------- "Add an item the chat missed" (§10.16) ----------
  await section('add an item', async () => {
  const c = checked(d1, { segments: segsSeed, token: TOK_D, openIds: [] });
  const before = c.items.length;
  ok('t27a adding needs a real statement, a kind and a line', !!R.addItem(c, segsSeed, { seg: 'S999', kind: 'commitment', what: 'x' }).error &&
     !!R.addItem(c, segsSeed, { seg: 'S100', kind: 'task', what: 'x' }).error && !!R.addItem(c, segsSeed, { seg: 'S100', kind: 'commitment', what: ' ' }).error && c.items.length === before);
  const a = R.addItem(c, segsSeed, { seg: 'S100', kind: 'commitment', who: segsSeed[99].speakerName, what: 'ZZ-ADDED-ITEM', due: 'by Friday' }).item;
  ok('t27b an added item is sourced to its statement, verified, and marked added', a && a.added && a.src === 'verified' && !a.toCheck && a.seg === 'S100' &&
     segsSeed[99].text.startsWith(a.words.split(' ')[0]) && c.items.length === before + 1);
  const P = S.meetingPackage({ pkgs: [], project: PROJECT, meeting: meetingOf(SEED), statements: segsSeed, request: { token: TOK_D, kind: 'seed', openIds: [] }, checked: c, savedAt: '2026-10-19T15:00:00.000Z' });
  const pa = P.items.find(x => x.what === 'ZZ-ADDED-ITEM');
  ok('t27c the added item gets an ID, stays marked added in the package, and is in the email', pa && /^HP-A-261019-\d\d$/.test(pa.id) && pa.added &&
     E.meetingEmail(P, S.replay([P], { upTo: P.meeting.id })).includes('ZZ-ADDED-ITEM'));
  ok('t27d the summary counts it, without naming it', /added from a statement by the PM: 1/.test(U.countsSummary({ statements: 1, requestChars: 1, requestKind: 'seed', openThreads: 0, replyChars: 1, checked: c })));
  ok('t27e an added item can be removed before saving; a chat item cannot', !R.removeAdded(c, 1) && R.removeAdded(c, a.n) && c.items.length === before && !c.items.some(x => x.added));
  });

  // ---------- starting a board from one CSV (§10.14) ----------
  await section('seed', async () => {
  ok('t28a the CSV reader: Excel BOM, quoted commas, "" inside quotes, CRLF', JSON.stringify(SD.parseCsv('\uFEFFType,Title\r\nRisk,"a, b ""c"" d"\r\n')) === JSON.stringify([['Type', 'Title'], ['Risk', 'a, b "c" d']]));
  ok('t28b a semicolon-separated file reads too', SD.parseCsv('Type;Title\nRisk;x').length === 2 && SD.parseCsv('Type;Title\nRisk;x')[1][1] === 'x');
  ok('t28c dates: 2026-11-06 and 11/6/2026 resolve; 2/30/2026 and "early December" are kept as said',
     SD.isoDate('2026-11-06') === '2026-11-06' && SD.isoDate('11/6/2026') === '2026-11-06' && SD.isoDate('2/30/2026') === null && SD.isoDate('early December') === null);
  const ex = SD.readSeed(fs.readFileSync(path.join(ROOT, 'templates', 'mkg2-seed-example.csv'), 'utf8'));
  const cnt = t => ex.items.filter(x => x.type === t).length;
  ok('t28d the example file: 1 project, 7 people, 9 actions, 2 questions, 2 risks, 2 decisions, no problems',
     ex.projects.length === 1 && ex.people.length === 7 && cnt('action') === 9 && cnt('question') === 2 && cnt('risk') === 2 && cnt('decision') === 2 && !ex.problems.length, ex.problems);
  ok('t28e a file with no Type column stops, with a plain message', !!SD.readSeed('Title,Owner\nx,y').stop);
  const H = 'Type,Project,Title,Owner,Email,Teams name,Due,Status,Waiting on,Notes';
  const rd = rows => SD.readSeed([H, ...rows].join('\n'));
  const r1 = rd(['Project,P one,,,,,,,,', 'Task,P one,x,,,,,,,', 'Action,,no project,,,,,,,', 'Action,P two,wrong project,,,,,,,', 'Person,,Ann Lee,,,"Lee, Ann",,,,',
                 'Action,P one,owned by a stranger,Bo Wu,,,,,,', 'Action,P one,odd status,Ann Lee,,,,Maybe,,', 'Action,P one,waits on nothing,,,,,,ghost,',
                 'Action,P one,twin,,,,,,,', 'Action,P one,twin,,,,,,,', 'Action,P one,waits on a twin,,,,,,twin,', 'Risk,P one,blocked risk,,,,,Blocked,,']);
  const has = (row, re) => r1.problems.some(x => x.row === row && re.test(x.msg));
  ok('t29a an unknown Type is skipped and shown', has(3, /not one of/) && !r1.items.some(x => x.title === 'x'));
  ok('t29b a row naming no project, or a project with no Project row, is skipped and shown', has(4, /names no project/) && has(5, /no Project row/) && r1.items.every(x => x.projectName === 'P one'));
  ok('t29c a person without an email is kept, and shown', has(6, /no email/) && r1.people.length === 1);
  ok('t29d an owner with no Person row is kept as written, and shown', has(7, /no Person row/) && r1.items.find(x => x.title === 'owned by a stranger').owner === 'Bo Wu');
  ok('t29e a status not recognised is Open, and shown; a risk cannot be blocked', has(8, /not recognised/) && r1.items.find(x => x.title === 'odd status').status === 'open' && has(13, /not recognised/));
  ok('t29f "Waiting on" a Title not in the file, or shared by two rows, is dropped and shown', has(9, /not a Title/) && has(12, /2 rows share/) && !r1.items.find(x => x.title === 'waits on a twin').waitsOnRow);
  const pkgSeed = SD.seedPackage({ seed: ex, codes: { 'Harbor Point reopening': 'HP' }, asOf: '2026-10-15', savedAt: '2026-10-15T12:00:00.000Z' });
  const sid = t => pkgSeed.items.find(x => x.what.startsWith(t));
  ok('t30a the seed mints IDs with the project, kind and seed date (B18)', pkgSeed.items.every(x => /^HP-[AQRD]-261015-\d\d$/.test(x.id)) && sid('Call the fire marshal').id === 'HP-A-261015-01' && sid('Tactile signs').id === 'HP-D-261015-01');
  ok('t30b "Waiting on" points at the other row\'s ID', sid('Run the RoomLoop training').waitsOnId === sid('Do a RoomLoop walk-through').id);
  const bs = S.replay([pkgSeed]);
  ok('t30c replayed, the statuses are as written: blocked, in progress, done, decided', bs.threads.get(sid('Set up the keycard').id).status === 'blocked' &&
     bs.threads.get(sid('Do a RoomLoop').id).status === 'in_progress' && bs.threads.get(sid('Order the outside sign').id).status === 'done' && bs.threads.get(sid('Tactile signs').id).status === 'decided');
  ok('t30d done rows are history: not listed as open work', S.openThreads(bs, ['HP']).length === 14 && !S.openThreads(bs, ['HP']).some(t => t.status === 'done'));
  ok('t30e the people and their emails are kept in the package', pkgSeed.people.length === 7 && pkgSeed.people[0].email === 'grace.okafor@example.org');
  // §10.14 acceptance 2: a CSV equivalent of the mock board feeds the mock follow-up exactly as tested (only the IDs differ).
  const B = JSON.parse(read('board-after-seed.json')).threads;
  const T2 = { action: 'Action', question: 'Question', risk: 'Risk', decision: 'Decision' };
  const owners = [...new Set(B.map(t => t.owner).filter(Boolean))];
  const label = d => { const q = d.split(' '); return `${q.slice(1).join(' ')}, ${q[0]}`; };
  const csv = [H, csvLine(['Project', 'Harbor Point reopening', '', '', '', '', '', '', '', ''])]
    .concat(owners.map(o => csvLine(['Person', '', o, '', o.toLowerCase().replace(' ', '.') + '@example.org', label(o), '', '', '', ''])))
    .concat(B.map(t => csvLine([T2[t.kind], 'Harbor Point reopening', t.what, t.owner || '', '', '', t.due || '', t.status === 'decided' ? '' : 'Open', '', '']))).join('\r\n');
  const eq = SD.readSeed(csv);
  const pe = SD.seedPackage({ seed: eq, codes: { 'Harbor Point reopening': 'HP' }, asOf: '2026-10-19', savedAt: '2026-10-19T12:00:00.000Z' });
  const openE = S.openThreads(S.replay([pe]), ['HP']);
  const reqE = await Q.buildRequest({ id: meetingOf(FU).id, meeting: blockFu, threads: openE, projects: S.projectsOf([pe]) }, subtle);
  let want = reqFu.text;
  B.forEach((t, i) => { want = want.split(t.id + ' |').join(openE[i].id + ' |'); });
  // A seed decision's Due column is the date it was decided, so a decision lists no due date (D-4 had "November 12").
  B.forEach((t, i) => { if (t.kind === 'decision' && t.due) want = want.split(`${openE[i].id} | HP | decision | ${t.owner} | ${t.what} | ${t.due} | decided`).join(`${openE[i].id} | HP | decision | ${t.owner} | ${t.what} | - | decided`); });
  const body = t => t.split('\n').slice(1).join('\n');
  ok('t31 a seeded copy of the mock board gives the same request as the board it copies, with only the IDs, the token and decision due dates differing (§10.14 acceptance 2)', !eq.problems.length && body(reqE.text) === body(want), eq.problems);
  ok('t31b no email reaches the request (B19)', !/@/.test(reqE.text));
  // Two projects: open threads of both; a new item moved to the second project mints under its code; the email covers both.
  const two = SD.readSeed([H, 'Project,Harbor Point reopening,,,,,,,,', 'Project,Library build,,,,,,,,', 'Action,Harbor Point reopening,HP thing,,,,,Open,,', 'Action,Library build,LB thing,,,,,Open,,'].join('\n'));
  const p2 = SD.seedPackage({ seed: two, codes: { 'Harbor Point reopening': 'HP', 'Library build': 'LB' }, asOf: '2026-10-19', savedAt: '2026-10-19T12:00:00.000Z' });
  const b2s = S.replay([p2]);
  ok('t32a a seed of two projects puts each row in its own project', b2s.threads.get('LB-A-261019-01').project === 'LB' && b2s.threads.get('HP-A-261019-01').project === 'HP');
  ok('t32b the open threads of every ticked project go into the request (B13)', S.openThreads(b2s, ['HP', 'LB']).length === 2 && S.openThreads(b2s, ['HP']).length === 1);
  const cm = checked(d1, { segments: segsSeed, token: TOK_D, openIds: [] });
  const moved = cm.items.find(x => x.kind === 'commitment'); moved.project = 'LB';
  const LB = { code: 'LB', name: 'Library build' };
  const pm = S.meetingPackage({ pkgs: [p2], project: PROJECT, projects: [PROJECT, LB], meeting: meetingOf(FU), statements: segsSeed, request: { token: TOK_D, kind: 'seed', openIds: [] }, checked: cm, savedAt: '2026-10-26T15:00:00.000Z' });
  const mv = pm.items.find(x => x.n === moved.n);
  ok('t32c a new item moved to another project mints under that project\'s code', /^LB-A-261026-01$/.test(mv.id) && pm.items.filter(x => /^HP-A-/.test(x.id || '')).length === cm.items.filter(x => x.kind === 'commitment').length - 1, mv.id);
  ok('t32d replayed, it lands in that project', S.replay([p2, pm]).threads.get(mv.id).project === 'LB');
  const em = E.meetingEmail(pm, S.replay([p2, pm], { upTo: pm.meeting.id }));
  const pmN = JSON.parse(JSON.stringify(pm)); pmN.reply.summary = '';
  const emN = E.meetingEmail(pmN, S.replay([p2, pmN], { upTo: pmN.meeting.id }));
  ok('t32e the email covers both projects and labels the moved action with its project and owner; without a chat summary, the built one says who took on what per project',
     /Projects covered: Harbor Point reopening, Library build/.test(em) && em.includes(`${mv.id} ${mv.what} (Library build)\tOwner: `) && /On Library build: /.test(emN));
  ok('t32f after a seed, the first meeting is not "first": the seeded items not mentioned are in section 5', /did not mention them/.test(em) && em.includes('HP-A-261019-01') && em.includes('LB-A-261019-01'));
  moved.movedByPM = true; cm.items.filter(x => !x.thread).slice(0, 3).forEach(x => { x.chatProject = 'HP'; });
  const sm2 = U.countsSummary({ statements: 1, requestChars: 1, requestKind: 'seed', openThreads: 0, replyChars: 1, checked: cm, projects: 2, proposed: 3, added: 1 });
  ok('t32g the summary counts the projects, the proposals and the placements, without naming them', /Projects covered: 2; new projects the chat proposed: 3, added: 1/.test(sm2) &&
     new RegExp(`New items: the chat placed 3, not clear ${cm.items.filter(x => !x.thread).length - 3}; the PM moved 1, placed 0`).test(sm2), sm2);
  // A package saved before this change ({ A: n }) keeps counting where it was.
  const oldPrev = { id: 'old', items: [{ id: 'HP-A-261019-05', kind: 'commitment', seg: 'S001' }], minted: { maxNum: { A: 5 } } };
  ok('t33 a re-save of a package from before multi-project meetings continues its numbering', S.mint([{ kind: 'commitment', seg: 'S002' }], PROJECT, '261019', oldPrev).items[0].id === 'HP-A-261019-06');
  const pSeed2 = SD.seedPackage({ seed: ex, codes: { 'Harbor Point reopening': 'HP' }, asOf: '2026-10-16', savedAt: '2026-10-16T12:00:00.000Z', prev: pkgSeed });
  ok('t34 a second seed of the same projects supersedes the first: only one board is replayed', pSeed2.supersedes === pkgSeed.id && S.replay([pkgSeed, pSeed2]).order.length === pkgSeed.items.length);
  });

  // ---------- projects as v1 placed them (§10.20, variant J) ----------
  await section('projects (J)', async () => {
  const tagged = ln => JSON.stringify(Object.assign(JSON.parse(lines[2]), ln));   // lines: D1's reply, from above
  const w2 = JSON.parse(lines[2]).words, s2 = JSON.parse(lines[2]).seg;
  const prop = (ref, name, seg, words) => JSON.stringify({ newProject: ref, name, seg, words });
  const cJ = checked([head, prop('j1', 'Library build', s2, w2), prop('J2', 'Ghost project', 'S001', 'words nobody said at all'), prop('', 'no ref', s2, w2), prop('J1', 'dup', s2, w2),
    tagged({ project: 'hp' }), tagged({ project: 'ZZ' }), tagged({ project: 'J1' }), tagged({ project: null }), tagged({ project: 'HP', thread: 'AI-101' }), '{"end":5}'].join('\n'),
    { segments: segsSeed, token: TOK_D, openIds: ['AI-101'], projectCodes: ['HP'] });
  const ci = cJ.items;
  ok('t36a a listed code places a new item (any case)', ci[0] && ci[0].project === 'HP' && ci[0].chatProject === 'HP');
  ok('t36b a code neither listed nor proposed is "not clear", with a note', ci[1] && ci[1].project === undefined && ci[1].chatProject === null && /neither listed nor proposed/.test(ci[1].notes.join()));
  ok('t36c a proposed project\'s ref is kept as the item\'s ref, not as a code', ci[2] && ci[2].projectRef === 'J1' && ci[2].project === undefined && ci[2].chatProject === 'J1');
  ok('t36d null is "not clear"', ci[3] && ci[3].project === undefined && ci[3].projectRef === undefined && ci[3].chatProject === null);
  ok('t36e an item on a thread takes no project from the chat (the thread\'s holds)', ci[4] && ci[4].thread === 'AI-101' && ci[4].project === undefined && ci[4].projectRef === undefined);
  const pr = cJ.proposals || [];
  ok('t36f a proposal is read, its ref upper-cased, and its quote checked like an item\'s', pr.length === 2 && pr[0].ref === 'J1' && pr[0].name === 'Library build' && pr[0].src === 'verified' && !pr[0].toCheck);
  ok('t36g a proposal whose quote is not in the meeting is marked to check', pr[1] && pr[1].ref === 'J2' && pr[1].src === 'not found' && pr[1].toCheck);
  ok('t36h a project line with no ref, and a second line for one ref, are dropped with a note', (cJ.notes || []).some(x => /no ref or no name/.test(x)) && (cJ.notes || []).some(x => /second project line for J1/.test(x)));
  ok('t36i project lines are not items: the end line counts items only, so the reply is complete', ci.length === 5 && !cJ.cut);
  ok('t36j without projectCodes, the reply\'s projects and proposals are ignored', (c => c.items[0].project === undefined && !c.proposals.length)(R.checkReply([head, prop('J1', 'x', s2, w2), tagged({ project: 'HP' }), '{"end":1}'].join('\n'), { segments: segsSeed, token: TOK_D })));

  // The review: placeItems.
  const known = [PROJECT], LBk = { code: 'LB', name: 'Library build' };
  const its = [{ n: 1, kind: 'commitment', project: 'HP' }, { n: 2, kind: 'commitment', projectRef: 'J1' }, { n: 3, kind: 'risk', projectRef: 'J2' },
               { n: 4, kind: 'question' }, { n: 5, kind: 'update' }, { n: 6, kind: 'update', thread: 'AI-101' }, { n: 7, kind: 'decision', projectRef: 'J3' }];
  const props = [{ ref: 'J1', name: 'Library build', action: 'add', code: 'lb' }, { ref: 'J2', name: 'Harbor', action: 'same', sameAs: 'HP' }, { ref: 'J3', name: 'Nope', action: 'no' }, { ref: 'J4', name: 'No items yet', action: 'add', code: 'NI' }];
  const pl = S.placeItems({ items: its, proposals: props, known, board: board0 });
  const at = n => pl.items.find(x => x.n === n);
  ok('t37a a listed code stays; an added proposal gives its new code; "same as" gives the listed code; "no" leaves it not clear',
     at(1).project === 'HP' && at(2).project === 'LB' && at(3).project === 'HP' && at(7).project === undefined && !pl.errors.length, pl.items.map(x => x.project));
  ok('t37b J2: only items that get an ID need a project (here the question and the turned-down decision); updates and thread items do not',
     pl.need.map(x => x.n).join() === '4,7', pl.need.map(x => x.n));
  ok('t37c the projects covered, in item order: each new item\'s project and each thread\'s; an added project is covered, even with no items yet',
     pl.covered.map(c => c.code).join() === 'HP,LB,NI' && pl.covered[1].name === 'Library build', pl.covered);
  const pk = S.placeItems({ items: [Object.assign({}, its[0], { pick: 'LB' }), Object.assign({}, its[3], { pick: 'HP' }), Object.assign({}, its[1], { pick: '' })], proposals: props, known: [PROJECT, LBk], board: board0 });
  ok('t37d the PM\'s choice wins: moving the chat\'s project counts as moved; placing a "not clear" item counts as placed, not moved',
     pk.items[0].project === 'LB' && pk.items[0].movedByPM && !pk.items[0].placedByPM && pk.items[1].project === 'HP' && pk.items[1].placedByPM && !pk.items[1].movedByPM &&
     pk.items[2].project === undefined && pk.items[2].movedByPM && pk.need.length === 1 && pk.items.every(x => x.pick === undefined));
  const bad = S.placeItems({ items: [], proposals: [{ ref: 'J1', name: 'A', action: 'add', code: 'HP' }, { ref: 'J2', name: 'B', action: 'add', code: 'x' }, { ref: 'J3', name: '', action: 'add', code: 'ZZ' }], known, board: board0 });
  ok('t37e a new project\'s code must be valid and unused, and it needs a name', bad.errors.length === 3 && /already used/.test(bad.errors[0]) && /2 to 4 letters/.test(bad.errors[1]) && /needs a name/.test(bad.errors[2]));
  ok('t37f a thread item adds its thread\'s project to the covered list', S.placeItems({ items: [{ n: 1, kind: 'update', thread: 'AI-101' }], proposals: [], known, board: board0 }).covered.map(c => c.code).join() === 'HP');

  // Packages with no main project: one per meeting, each item minted under its own project.
  const cm2 = checked(d1, { segments: segsSeed, token: TOK_D, openIds: [] });
  const ids = cm2.items.filter(x => ['commitment', 'question', 'risk', 'decision'].includes(x.kind));
  cm2.items.forEach((x, i) => { x.project = i % 2 ? 'LB' : 'HP'; });
  const pz = S.meetingPackage({ pkgs: [], projects: [LBk, PROJECT], meeting: meetingOf(SEED), statements: segsSeed, request: { token: TOK_D, kind: 'seed', openIds: [] }, checked: cm2,
    savedAt: '2026-10-19T15:00:00.000Z', newProjects: [{ ref: 'J1', name: 'Library build', action: 'add', code: 'LB' }] });
  ok('t37g with no main project, each item is minted under its own project, numbered per project', pz.items.filter(x => x.id).every(x => x.id.startsWith(x.project + '-')) &&
     pz.items.filter(x => /^LB-A-261019-01$/.test(x.id || '')).length === 1 && pz.items.filter(x => /^HP-A-261019-01$/.test(x.id || '')).length === 1 && ids.length === pz.items.filter(x => x.id).length);
  ok('t37h the package is named after its first project, lists the projects covered, and keeps the review\'s decisions on new projects',
     pz.id.startsWith('mkg2-meeting-LB-20261019T140000Z-') && pz.projects.map(p => p.code).join() === 'LB,HP' && pz.newProjects.length === 1 && S.projectsOf([pz]).some(p => p.code === 'LB'));
  const pz2 = S.meetingPackage({ pkgs: [pz], projects: [PROJECT, LBk], meeting: meetingOf(SEED), statements: segsSeed, request: pz.request, checked: cm2, savedAt: '2026-10-19T16:00:00.000Z' });
  ok('t37i saved again with the projects in another order: still one meeting, it supersedes, and every ID is kept',
     pz2.supersedes === pz.id && JSON.stringify(pz2.items.map(x => x.id)) === JSON.stringify(pz.items.map(x => x.id)) && S.current([pz, pz2]).used.length === 1);
  ok('t37m two saves of one meeting with their projects in another order, neither superseding, are one meeting saved twice (B16)',
     S.current([pz, Object.assign({}, pz2, { id: pz2.id + 'x', supersedes: null })]).conflicts.length === 1);
  let threw = null; try { S.mint([{ kind: 'commitment', seg: 'S001' }], null, '261019', null); } catch (e) { threw = e.message; }
  ok('t37j an item that needs an ID and has no project is never minted (J2, structurally)', /no project/.test(threw || ''));
  const lone = S.meetingPackage({ pkgs: [], projects: [], meeting: meetingOf(SEED), statements: [], request: { token: 'x', kind: 'seed', openIds: [] }, checked: { items: [{ n: 1, kind: 'update', seg: 'S001' }], reply: {}, cut: null, note: null, lastSegOk: true } });
  ok('t37k a meeting with no project at all (updates only) still saves, and its email says no project was named', lone.project === null && lone.id.startsWith('mkg2-meeting-20261019T140000Z-') &&
     /Projects covered: none named/.test(E.meetingEmail(lone, S.replay([], {}))));
  ok('t37l the day key is per project: a second meeting that day takes a letter only in a project the first one covered',
     S.dayKeyFor([pz], LBk, Object.assign(meetingOf(SEED), { id: '20261019T180000Z' }), null) === '261019b' && S.dayKeyFor([pz], { code: 'ZZ' }, Object.assign(meetingOf(SEED), { id: '20261019T180000Z' }), null) === '261019');
  });

  // ---------- the full build: dates, people, the review, the board, parking, the leadership email ----------
  await section('dates (B7)', async () => {
  const m = '2026-10-19';   // a Monday
  const r = p => DT.resolveDue(p, m);
  ok('t40a weekdays and weeks: "by Friday" this Friday; "Monday" the next one; "next Monday" next week\'s; "this week" and "next week" end on Friday',
     r('by Friday') === '2026-10-23' && r('Monday') === '2026-10-26' && r('next Monday') === '2026-10-26' && r('this week') === '2026-10-23' && r('end of next week') === '2026-10-30' && r('next week') === '2026-10-30');
  ok('t40b today, tomorrow, the end of the month', r('today') === '2026-10-19' && r('tomorrow') === '2026-10-20' && r('end of the month') === '2026-10-31');
  ok('t40c a month and a day, either way round, in digits or words; US numbers', r('November 6') === '2026-11-06' && r('by November sixth') === '2026-11-06' &&
     r('the 12th of November') === '2026-11-12' && r('11/6') === '2026-11-06' && r('12/1/2026') === '2026-12-01');
  ok('t40d vague phrases stay as said (no date): early December, the first two weeks of December, before our next meeting, December',
     [r('early December'), r('first two weeks of December'), r('before our next meeting'), r('December'), r('soon'), r(null), r('early next week'), r('around Friday')].every(x => x === null));
  ok('t40e a date in January said in October is next year\'s', r('January 16') === '2027-01-16');
  ok('t40g a weekday before a date does not win: "Monday, December fourteenth, at nine in the morning" is Dec 14 (Aaron\'s run)', DT.resolveDue('Monday, December fourteenth, at nine in the morning', '2026-10-26') === '2026-12-14' &&
     DT.resolveDue('November twenty-first', '2026-10-26') === '2026-11-21');
  ok('t40f overdue counts only resolved dates', DT.daysLate('2026-10-23', '2026-10-30') === 7 && DT.daysLate(null, '2026-10-30') === 0 && DT.daysLate('2026-11-01', '2026-10-30') === 0);
  });

  await section('people (B10)', async () => {
  const seedP = { mkg2: '1.0', kind: 'seed', id: 'mkg2-seed-HP-x', savedAt: '2026-10-01T00:00:00Z', supersedes: null, project: PROJECT, projects: [PROJECT],
    meeting: { id: '20261001T000000Z', date: '2026-10-01' }, people: [{ name: 'Peter Kowalski', teams: 'Kowalski, Pete', email: 'p@example.org' }], items: [] };
  const ppl = PE.peopleOf([seedP, P1]);
  ok('t41a the people list: a seed\'s people by name and Teams name, and each meeting\'s speakers', PE.resolve('Kowalski, Pete', ppl).name === 'Peter Kowalski' && PE.resolve('Peter Kowalski', ppl).known &&
     PE.resolve('Okafor, Grace', ppl).name === 'Grace Okafor' && !PE.resolve('Kowalski, Pete (Guest)', ppl).known);
  ok('t41b a new label is matched to the closest known person, as a suggestion (a shared surname counts most)', PE.suggest('Kowalski, Pete (Guest)', ppl) === 'Peter Kowalski' && PE.suggest('Zed Q', ppl) === null &&
     PE.suggest('Mensah', { byLabel: new Map(), names: ['Mensah Ken', 'Abena Mensah'] }) === 'Abena Mensah');
  const qs = PE.questions([{ who: 'Kowalski, Pete (Guest)' }, { who: 'Okafor, Grace' }, { who: 'New, Speaker' }, { who: 'the director' }], ['Kowalski, Pete (Guest)', 'New, Speaker'], ppl);
  ok('t41c asked: a new label with a look-alike, and a who that is no speaker; not asked: a known label, or a new speaker with no look-alike',
     qs.map(q => q.label).join('|') === 'Kowalski, Pete (Guest)|the director' && qs[0].suggestion === 'Peter Kowalski', qs);
  const rv = RV.applyReview([{ n: 1, kind: 'commitment', who: 'Kowalski, Pete (Guest)', notes: [] }, { n: 2, kind: 'commitment', who: 'the director', notes: [] }],
    { answers: { 'Kowalski, Pete (Guest)': { action: 'same', person: 'Pete Kowalski' }, 'the director': { action: 'none' } }, people: ppl, meetingDate: '2026-10-19' });
  ok('t41d the answers set the owner (the same person, or no owner) and are kept as aliases', rv.items[0].person === 'Pete Kowalski' && rv.items[1].who === null && rv.items[1].person === null &&
     rv.aliases.length === 2 && rv.aliases[0].person === 'Pete Kowalski');
  const withAlias = Object.assign({}, P1, { id: 'x-alias', meeting: Object.assign({}, P1.meeting, { id: '20261020T140000Z' }), aliases: rv.aliases });
  const ppl2 = PE.peopleOf([seedP, P1, withAlias]);
  ok('t41e asked once: in the next meeting the label is known, and is the person answered', PE.resolve('Kowalski, Pete (Guest)', ppl2).name === 'Pete Kowalski' &&
     PE.questions([{ who: 'Kowalski, Pete (Guest)' }, { who: 'the director' }], [], ppl2).length === 0);
  });

  let PD = null, bD = null;
  await section('review (§10.6 step 4)', async () => {
  const c = checked(d1, { segments: segsSeed, token: TOK_D, openIds: [] });
  const calls = c.items.filter(x => /fire marshal/i.test(x.what) && x.kind === 'commitment');
  ok('t42a D1 has the two fire marshal calls, 354 statements apart (§10.4)', calls.length === 2, calls.map(x => x.seg));
  calls[1].r = { sameAs: calls[0].n };
  const ppl = PE.peopleOf([]);
  const rv = RV.applyReview(c.items, { people: ppl, meetingDate: SEED.date });
  PD = S.meetingPackage({ pkgs: [], project: PROJECT, meeting: meetingOf(SEED), statements: segsSeed, request: { token: TOK_D, kind: 'seed', openIds: [] },
    checked: Object.assign({}, c, { items: rv.items }), savedAt: '2026-10-19T15:00:00.000Z', aliases: rv.aliases });
  const em = E.meetingEmail(PD, S.replay([PD], { upTo: PD.meeting.id }));
  ok('t42b "Same as…" another item of the meeting: one action, one ID, and the email shows one fire marshal call (acceptance 1)',
     PD.items.filter(x => /fire marshal/i.test(x.what) && x.id).length === 1 && PD.items.find(x => x.n === calls[1].n).mergedInto === calls[0].n &&
     !em.includes(calls[1].what) && em.includes(calls[0].what), calls.map(x => x.what));
  const plain = RV.applyReview(c.items.map(x => Object.assign({}, x, { r: undefined })), { people: ppl, meetingDate: SEED.date }).items;
  const changedBack = c.items.map(x => Object.assign({}, x, { r: { who: x.who, due: x.due, importance: x.importance, thread: x.thread } }));
  const undone = RV.applyReview(changedBack, { people: ppl, meetingDate: SEED.date }).items;
  ok('t42c every choice changed and then undone gives the same items (acceptance 1)', JSON.stringify(plain) === JSON.stringify(undone));
  const fire = PD.items.find(x => x.id && /fire marshal/i.test(x.what));
  ok('t42d each item\'s due date as said is resolved against the meeting date, and the owner is a person', fire.due === 'this week' && fire.dueDate === '2026-10-23' && fire.person === 'Tom Lindqvist');
  const ed = RV.applyReview([{ n: 1, kind: 'commitment', who: 'A, B', due: 'by Friday', importance: 'normal', thread: null, notes: [], r: { who: 'C, D', due: 'November 6', importance: 'high' } }],
    { people: ppl, meetingDate: SEED.date }).items[0];
  ok('t42e the owner, the due date and the importance can be corrected, and say so', ed.who === 'C, D' && ed.due === 'November 6' && ed.dueDate === '2026-11-06' && ed.importance === 'high' &&
     ed.edited.join() === 'owner,due,importance');
  const ed2 = RV.applyReview([{ n: 1, kind: 'commitment', who: null, due: 'early December', thread: null, notes: [], r: { dueDate: '2026-12-04' } }], { people: ppl, meetingDate: SEED.date }).items[0];
  ok('t42f a date the resolver left as said can be set by hand', ed2.dueDate === '2026-12-04' && ed2.edited.includes('due date'));
  bD = S.replay([PD]);
  });

  await section('chat closures in the review (B8)', async () => {
  const c = checked(runText('F2.txt'), { segments: segsFu, token: TOK_F, openIds: openIds0 });
  const close = c.items.find(x => x.thread === 'AI-101' && x.status === 'done');
  close.r = { undo: true };
  const tc = c.items.find(x => x.thread && x.status && x !== close); tc.toCheck = true; tc.r = { confirm: true };
  const rv = RV.applyReview(c.items, { people: PE.peopleOf([fx]), meetingDate: FU.date });
  const pk = S.meetingPackage({ pkgs: [fx], project: PROJECT, meeting: meetingOf(FU), statements: segsFu, request: { token: TOK_F, kind: 'followup', openIds: openIds0 },
    checked: Object.assign({}, c, { items: rv.items }), savedAt: '2026-10-26T15:00:00.000Z' });
  const b = S.replay([fx, pk]);
  ok('t43a a closure the PM undoes in the review is not applied', b.threads.get('AI-101').status === 'open' && pk.items.find(x => x.n === close.n).statusUndone);
  ok('t43b a status whose source is "to check" applies once the PM confirms it', b.threads.get(tc.thread).status === tc.status);
  const moved = Object.assign({}, c.items.find(x => x.thread === 'AI-103'), { r: { thread: null } });
  const mv = RV.applyReview([moved], { people: PE.peopleOf([]), meetingDate: FU.date }).items[0];
  ok('t43c an item moved to "new work" loses the thread and its status', mv.thread === null && mv.status === null && mv.edited.includes('thread'));
  const sameT = RV.applyReview([{ n: 1, kind: 'commitment', thread: null, status: null, notes: [], r: { sameAs: 'AI-110' } }], { people: PE.peopleOf([]), meetingDate: FU.date }).items[0];
  ok('t43d "Same as" an open thread makes the item an update to it', sameT.thread === 'AI-110' && !sameT.mergedInto);
  });

  await section('related closures (B2)', async () => {
  const q = [...bD.threads.values()].find(t => t.kind === 'question' && /mural/i.test(t.what));
  const tom = [...bD.threads.values()].find(t => t.kind === 'action' && /architect/i.test(t.what));
  const settle = [{ n: 1, kind: 'decision', thread: q.id, status: 'done', seg: 'S172', words: 'So that\'s decided. The mural stays', src: 'verified', toCheck: false, topic: 'lobby mural', notes: [] }];
  const sug = RV.relatedClosures(settle, bD);
  const grace = [...bD.threads.values()].find(t => t.kind === 'action' && /director/i.test(t.what) && /mural/i.test(t.what));
  ok('t44a when a question is settled, the open actions related to it are offered: Tom\'s architect action (AI-111, §10.4), and Grace\'s, far off but on the same topic',
     !!tom && !!grace && sug.some(x => x.thread === tom.id) && sug.some(x => x.thread === grace.id && x.why === 'the same topic') && sug.every(x => bD.threads.get(x.thread).kind === 'action'), sug.map(x => [x.thread, x.why]));
  ok('t44b nothing is offered for an unsourced or undone settlement', RV.relatedClosures([Object.assign({}, settle[0], { toCheck: true })], bD).length === 0 &&
     RV.relatedClosures([Object.assign({}, settle[0], { r: { undo: true } })], bD).length === 0);
  const rv = RV.applyReview(settle, { related: [{ thread: tom.id, from: 1 }], people: PE.peopleOf([]), meetingDate: FU.date });
  const extra = rv.items.find(x => x.thread === tom.id);
  ok('t44c a ticked related closure is the reviewer\'s choice, sourced to the statement that settled the question', extra && extra.byReview && extra.status === 'done' && extra.seg === 'S172' && extra.relatedTo === q.id);
  const pk = S.meetingPackage({ pkgs: [PD], project: PROJECT, meeting: meetingOf(FU), statements: segsFu, request: { token: 'x', kind: 'followup', openIds: [q.id, tom.id] },
    checked: { items: rv.items, reply: {}, cut: null, note: null, lastSegOk: true }, savedAt: '2026-10-26T15:00:00.000Z' });
  ok('t44d saved, it closes the action on the board', S.replay([PD, pk]).threads.get(tom.id).status === 'done');
  });

  await section('board decisions (B9)', async () => {
  const a = [...bD.threads.values()].find(t => t.kind === 'action'), a2 = [...bD.threads.values()].filter(t => t.kind === 'action')[1];
  const dec = [...bD.threads.values()].find(t => t.kind === 'decision');
  const mk = (action, ids, at, note) => S.boardDecision({ board: S.replay(pkgsNow), action, ids, note: note === undefined ? 'n' : note, savedBy: 'PM', savedAt: at });
  let pkgsNow = [PD];
  ok('t45a a decision needs a note, a name, and at least one item', !!mk('settled', [a.id], '2026-10-20T10:00:00Z', ' ').error && !!S.boardDecision({ board: bD, action: 'settled', ids: [a.id], note: 'x' }).error && !!mk('settled', [], '2026-10-20T10:00:00Z').error);
  ok('t45b the board never changes a decision, nor undoes what has no status change', /decision/.test(mk('not_needed', [dec.id], '2026-10-20T10:00:00Z').error || '') && /no status change/.test(mk('undo', [a.id], '2026-10-20T10:00:00Z').error || ''));
  const s1 = mk('settled', [a.id], '2026-10-20T10:00:00.000Z', 'Confirmed by email'); pkgsNow = [PD, s1.pkg];
  const b1 = S.replay(pkgsNow);
  ok('t45c Settled outside a meeting: done, with the PM\'s name and note, recorded as the PM\'s decision', b1.threads.get(a.id).status === 'done' && (b1.threads.get(a.id).settledOutside || {}).by === 'PM' &&
     b1.threads.get(a.id).history.slice(-1)[0].board === s1.pkg.id && s1.pkg.kind === 'board' && s1.pkg.id.startsWith('mkg2-board-'));
  const u1 = mk('undo', [a.id], '2026-10-20T11:00:00.000Z', 'Too early'); pkgsNow = [PD, s1.pkg, u1.pkg];
  const b2 = S.replay(pkgsNow);
  ok('t45d Undo steps back to the status before', b2.threads.get(a.id).status === 'open' && !b2.threads.get(a.id).settledOutside);
  const n1 = mk('not_needed', [a.id, a2.id], '2026-10-20T12:00:00.000Z', 'Dropped from scope'); pkgsNow.push(n1.pkg);
  const b3 = S.replay(pkgsNow);
  ok('t45e Not needed, on several at once; they leave the request', b3.threads.get(a.id).status === 'not_needed' && b3.threads.get(a2.id).status === 'not_needed' &&
     !S.openThreads(b3, ['HP']).some(t => t.id === a.id));
  const third = [...bD.threads.values()].filter(t => t.kind === 'action').pop();   // the last action: first only if raised
  const r1 = mk('raise', [third.id], '2026-10-20T13:00:00.000Z', 'Need an update'); pkgsNow.push(r1.pkg);
  const b4 = S.replay(pkgsNow);
  ok('t45f Raise for the next meeting puts the thread first in the next request', S.openThreads(b4, ['HP'])[0].id === third.id && (b4.threads.get(third.id).raised || {}).by === 'PM');
  const mention = { mkg2: '1.0', kind: 'meeting', id: 'm-next', savedAt: '2026-10-26T15:00:00Z', supersedes: null, project: PROJECT, projects: [PROJECT], meeting: { id: '20261026T140000Z', date: '2026-10-26', title: 'x' },
    statements: [], items: [{ n: 1, kind: 'update', thread: third.id, status: null, what: 'discussed' }] };
  ok('t45g the meeting it was raised for discusses it: it is no longer raised', !S.replay(pkgsNow.concat(mention)).threads.get(third.id).raised);
  const em = E.meetingEmail(mention, S.replay(pkgsNow, { upTo: mention.meeting.id }));
  ok('t45h the meeting email lists the decisions made outside the meeting as the PM\'s, never as meeting results', /Decided outside a meeting since the last meeting/.test(em) &&
     em.includes('marked completed by PM: Confirmed by email') && em.includes('marked as not needed by PM: Dropped from scope'));
  const ids = new Set(bD.order);
  ok('t45i nothing on the board creates a thread, changes an owner or sets a date', [...S.replay(pkgsNow).threads.values()].every(t => ids.has(t.id) && t.owner === bD.threads.get(t.id).owner && t.due === bD.threads.get(t.id).due));
  const early = S.boardDecision({ board: bD, action: 'settled', ids: [a.id], note: 'x', savedBy: 'PM', savedAt: '2026-10-01T09:00:00.000Z' }).pkg;
  ok('t45k a decision saved by a clock behind the meeting dates still applies after the meeting it is about', early.after === PD.meeting.id && S.replay([PD, early]).threads.get(a.id).status === 'done');
  ok('t45j a decision on an ID the board doesn\'t have is listed as needing a new link', S.replay([PD, Object.assign({}, s1.pkg, { id: 'b-ghost', threads: ['HP-A-999999-01'] })]).unlinked.some(u => u.thread === 'HP-A-999999-01'));
  });

  await section('parking (B11)', async () => {
  const meet = (day, items) => ({ mkg2: '1.0', kind: 'meeting', id: 'm' + day, savedAt: `2026-11-${day}T15:00:00Z`, supersedes: null, project: PROJECT, projects: [PROJECT],
    meeting: { id: `202611${day}T140000Z`, date: `2026-11-${day}`, title: 'w' }, statements: [], items });
  const a = [...bD.threads.values()].find(t => t.kind === 'action'), b = [...bD.threads.values()].filter(t => t.kind === 'action')[1];
  const ms = [meet('02', [{ n: 1, kind: 'update', thread: b.id, what: 'x' }]), meet('09', []), meet('16', [])];
  const bp = S.replay([PD, ...ms]);
  ok('t46a an open thread not mentioned in its project\'s last 3 meetings is parked, and leaves the request', bp.threads.get(a.id).parked && bp.threads.get(a.id).quiet === 3 && !S.openThreads(bp, ['HP']).some(t => t.id === a.id));
  ok('t46b a mention resets the count', !bp.threads.get(b.id).parked && bp.threads.get(b.id).quiet === 2);
  const other = Object.assign(meet('23', []), { project: { code: 'LB', name: 'L' }, projects: [{ code: 'LB', name: 'L' }] });
  ok('t46c another project\'s meetings do not count toward parking', S.replay([PD, ms[0], ms[1], other]).threads.get(b.id).quiet === 1);
  const rz = S.boardDecision({ board: bp, action: 'raise', ids: [a.id], note: 'back', savedBy: 'PM', savedAt: '2026-11-17T09:00:00.000Z' }).pkg;
  ok('t46d raising a parked thread brings it back to the request', !S.replay([PD, ...ms, rz]).threads.get(a.id).parked && S.openThreads(S.replay([PD, ...ms, rz]), ['HP'])[0].id === a.id);
  const later = ['23', '24', '25'].map(d => meet(d, []));
  ok('t46f a raised thread stays in the request until a meeting discusses it, however many meetings pass', !S.replay([PD, ...ms, rz, ...later]).threads.get(a.id).parked);
  const leP = E.leadershipEmail(bp, { since: '2026-11-01', asOf: '2026-11-17', projects: [PROJECT] });
  ok('t46g a parked thread shows in the leadership email under management attention', leP.split('Management attention/risks')[1].split('Near-term')[0].includes(`${a.id} “${a.what}”: not discussed in 3 meetings`));
  ok('t46h an earlier meeting imported after a later one is told which later meetings may hold the same work (§10.3)', S.laterMeetings([PD, ...ms], PD).length === 3 && S.laterMeetings([PD, ...ms], ms[2]).length === 0 &&
     S.laterMeetings([PD, Object.assign({}, ms[0], { project: { code: 'LB' }, projects: [{ code: 'LB' }] })], PD).length === 0);
  ok('t46e decisions are never parked', [...bp.threads.values()].filter(t => t.kind === 'decision').every(t => !t.parked));
  });

  await section('conflicts (B16)', async () => {
  const A = Object.assign({}, PD, { id: 'save-A', savedAt: '2026-10-19T15:00:00.000Z' }), B = Object.assign({}, PD, { id: 'save-B', savedAt: '2026-10-19T16:00:00.000Z', items: PD.items.slice(0, 3) });
  const cf = S.current([A, B]).conflicts[0];
  const sw = S.switchTo([A, B], cf, 'save-B', 'PM', '2026-10-20T09:00:00.000Z');
  const cur = S.current([A, B, sw.pkg]);
  ok('t47a switching to the other save: a new copy of it supersedes both; one save is used, and no conflict is left', cf.used === 'save-A' && sw.pkg.supersedes === 'save-A' &&
     cur.used.length === 1 && cur.used[0].id === sw.pkg.id && cur.conflicts.length === 0 && cur.used[0].items.length === 3);
  ok('t47b only a save in the conflict can be chosen', !!S.switchTo([A, B], cf, 'nope', 'PM').error && !!S.switchTo([A, B, fx], cf, fx.id, 'PM').error);
  });

  // ---------- the intervention dashboard (Aaron, 2026-10-16) ----------
  await section('interventions: what to ask, of whom, and why now', async () => {
  const IV = require(path.join(MOD, 'interventions.js'));
  const H = 'Type,Project,Title,Owner,Email,Teams name,Due,Status,Waiting on,Notes';
  const rowsCsv = [H, 'Project,Harbor Point reopening,,,,,,,,', 'Project,Library build,,,,,,,,',
    'Person,,Tom Lindqvist,,t@example.org,"Lindqvist, Tom",,,,', 'Person,,Pete Kowalski,,p@example.org,"Kowalski, Pete",,,,', 'Person,,Grace Okafor,,g@example.org,"Okafor, Grace",,,,',
    'Person,,Rana Haddad,,r@example.org,"Haddad, Rana",,,,', 'Person,,Ken Sato,,k@example.org,"Sato, Ken",,,,', 'Person,,Luis Delgado,,l@example.org,"Delgado, Luis",,,,',
    'Action,Harbor Point reopening,Book the inspection,Tom Lindqvist,,,2026-10-10,Open,,',
    'Action,Harbor Point reopening,Set up keycards,Pete Kowalski,,,,Blocked,Send the HR list,',
    'Action,Harbor Point reopening,Send the HR list,Grace Okafor,,,2026-10-01,Open,,',
    'Action,Harbor Point reopening,Unowned task,,,,,Open,,',
    'Action,Harbor Point reopening,Order the sign,Ken Sato,,,,Done,,',
    'Action,Harbor Point reopening,Hang the sign,Rana Haddad,,,,Open,Order the sign,',
    'Action,Harbor Point reopening,Check the hood,Luis Delgado,,,,Open,,',
    'Action,Harbor Point reopening,Get the quotes,Ken Sato,,,,Open,,',
    'Action,Harbor Point reopening,Paint the gym,Luis Delgado,,,,In progress,,',
    'Action,Harbor Point reopening,Print the flyer,Rana Haddad,,,2026-10-30,Open,,',
    ...[1, 2, 3, 4, 5].map(i => `Action,Harbor Point reopening,Tom task ${i},Tom Lindqvist,,,,Open,,`),
    'Question,Harbor Point reopening,Is the mural kept?,Grace Okafor,,,,Open,,',
    'Risk,Harbor Point reopening,The fiber may be late,Pete Kowalski,,,,Open,,',
    'Risk,Harbor Point reopening,The chairs may be late,Luis Delgado,,,,Open,,',
    'Action,Library build,Pick the architect,Grace Okafor,,,,Open,,'];
  const sd = SD.readSeed(rowsCsv.join('\n'));
  const seed = SD.seedPackage({ seed: sd, codes: { 'Harbor Point reopening': 'HP', 'Library build': 'LB' }, asOf: '2026-10-12', savedAt: '2026-10-12T12:00:00.000Z' });
  const idOf = w => seed.items.find(x => x.what === w).id;
  const [A1, A2, A3, A4, A6, A7, A8, A9, A10] = ['Book the inspection', 'Set up keycards', 'Send the HR list', 'Unowned task', 'Hang the sign', 'Check the hood', 'Get the quotes', 'Paint the gym', 'Print the flyer'].map(idOf);
  const Q1 = idOf('Is the mural kept?'), R1 = idOf('The fiber may be late'), R2 = idOf('The chairs may be late');
  const st = [{ id: 'S001', t: '00:00:01', speakerName: 'Okafor, Grace', text: 'w' }];
  let k = 0;
  const upd = (thread, status) => ({ n: ++k, ref: null, kind: 'update', who: null, what: 'about ' + thread, thread, status: status || null, seg: 'S001', words: 'w', src: 'verified', toCheck: false, notes: [], importance: 'normal', due: null, waitsOn: null });
  const pk = [seed];
  const meet = (date, items) => { k = 0; const its = items.map((x, i) => Object.assign(x, { n: i + 1 }));
    const m = S.meetingPackage({ pkgs: pk.slice(), projects: [{ code: 'HP', name: 'Harbor Point reopening' }], meeting: meetingOf({ date, time: '10:00', offset: '-04:00', title: 'Weekly ' + date }),
      statements: st, request: { token: 'x', kind: 'followup', openIds: [] }, checked: { items: its, reply: { summary: 's' }, cut: null, note: null, lastSegOk: true }, savedAt: date + 'T20:00:00.000Z' });
    pk.push(m); return m; };
  const mit = { n: 0, ref: null, kind: 'commitment', who: 'Delgado, Luis', person: 'Luis Delgado', what: 'Call the chair supplier', thread: null, status: null, seg: 'S001', words: 'w', src: 'verified', toCheck: false, notes: [], importance: 'normal', due: null, waitsOn: null, project: 'HP', relatedTo: R2 };
  const W1 = meet('2026-10-19', [upd(Q1), upd(A4), upd(A1), upd(A2), upd(A3), upd(A6), upd(R1), mit]);
  const W2 = meet('2026-10-26', [upd(Q1), upd(A4), upd(A7), upd(A1), upd(A2), upd(A3), upd(A6), upd(R1), upd(A8), upd(A9), upd(A10)]);
  const W3 = meet('2026-11-02', [upd(Q1), upd(A4), upd(A7), upd(A1), upd(A2), upd(A3), upd(A6), upd(R1), upd(A8, 'done'), upd(A9, 'blocked'), upd(A10),
    { n: 0, ref: null, kind: 'commitment', who: 'Okafor, Grace', person: 'Grace Okafor', what: 'Email HR', thread: null, status: null, seg: 'S001', words: 'w', src: 'verified', toCheck: false, notes: [], importance: 'normal', due: null, waitsOn: null, project: 'HP' }]);
  const at3 = S.replay(pk), r3 = IV.compute(pk, { board: at3, cur: W3, date: '2026-11-02' });
  const all3 = r3.followUp.concat(r3.escalate), has = (r, id) => r.followUp.concat(r.escalate).find(x => x.id === id);
  const row = (r, id) => has(r, id) || { also: [], evidence: [], question: '' };   // crash-safe under knockouts
  ok('t51a each item appears once, under its strongest condition, with its other reasons kept in its detail', new Set(all3.map(x => x.id)).size === all3.length &&
     row(r3, A3).code === 'waited_on_late' && row(r3, A3).also.includes('overdue') && row(r3, A3).evidence.some(e => /^also: .*overdue/.test(e)), row(r3, A3));
  ok('t51b blocked and "waiting on something now done" are distinct: the keycards are blocked (ask Pete), the sign is ready to move (ask Rana)',
     row(r3, A2).code === 'blocked' && row(r3, A2).ask === 'Pete Kowalski' && row(r3, A6).code === 'waits_done' && row(r3, A6).ask === 'Rana Haddad' && /Can it move now\?/.test(row(r3, A6).question));
  ok('t51c overdue uses the as-of date and asks the owner about it, with the date as said and the days late', row(r3, A1).code === 'overdue' && row(r3, A1).ask === 'Tom Lindqvist' &&
     /23 days overdue as of Nov 2/.test(row(r3, A1).evidence[0] || '') && /still happening, and what is the new date\?/.test(row(r3, A1).question), row(r3, A1).evidence);
  ok('t51d no owner: the PM is asked who owns it; routine, not an escalation, when nothing waits on it and it is not important', row(r3, A4).code === 'no_owner' && row(r3, A4).ask === 'the PM' && !row(r3, A4).escalation);
  ok('t51e mentioned again without a change of status is a follow-up question, never a finding', row(r3, A7).code === 'stuck' && /Where does it stand, and is anything needed\?/.test(row(r3, A7).question) &&
     !/progress|failing|not doing/i.test(row(r3, A7).question) && !row(r3, A7).escalation);
  ok('t51f an open question carried over two meetings asks who decides; a risk no action addresses asks for the mitigation, and one with an action about it is left alone',
     row(r3, Q1).code === 'question_open' && /Who decides/.test(row(r3, Q1).question) && row(r3, R1).code === 'risk_no_action' && !has(r3, R2));
  ok('t51g escalation is kept for the significant: overdue at each of the last 3 meetings, and others waiting on late work for 2; each says why',
     row(r3, A1).escalation && /last 3 meetings/.test(row(r3, A1).escalation || '') && row(r3, A3).escalation && r3.escalate.every(x => x.escalation) && r3.followUp.every(x => !x.escalation) &&
     r3.escalate.some(x => x.id === A1) && !r3.escalate.some(x => x.id === A7), r3.escalate.map(x => [x.id, x.code, x.age]));
  ok('t51h a capacity question for Tom (6 open actions), worded as a conversation, not a finding; he is not escalated for it', r3.people.some(p => p.person === 'Tom Lindqvist' && p.open === 6 &&
     /Is the load manageable/.test(p.question)) && !r3.escalate.some(x => x.code === 'capacity'));
  ok('t51i parked items ask the PM whether they are still needed; a project with open items and no meeting is named', all3.some(x => x.code === 'parked' && x.ask === 'the PM' && /still needed/.test(x.question)) &&
     r3.projects.some(p => p.code === 'LB' && /no meeting yet/.test(p.question)));
  ok('t51j since the previous meeting: completed, new actions, newly blocked and newly overdue, from the saved history', r3.since && r3.since.completed.includes(A8) &&
     r3.since.newActions.length === 1 && r3.since.newlyBlocked.includes(A9) && r3.since.newlyOverdue.includes(A10) && !r3.since.newlyOverdue.includes(A1), r3.since);
  ok('t51o "how long" judges each earlier meeting by its own date: the flyer, due Oct 30, is overdue new since the last meeting', row(r3, A10).code === 'overdue' && row(r3, A10).age === 1 && row(r3, A10).isNew, row(r3, A10));
  // An earlier "State as of": the board and the date are that meeting's.
  const at2 = S.replay(pk, { upTo: W3.meeting.id }), r2 = IV.compute(pk, { board: at2, cur: W2, date: '2026-10-26' });
  ok('t51k as of an earlier meeting: its date for overdue, its meetings for "how long"; nothing from later', /16 days overdue as of Oct 26/.test(row(r2, A1).evidence[0] || '') && row(r2, A1).age === 2 &&
     !row(r2, A1).escalation && (!has(r2, A9) || row(r2, A9).code !== 'blocked'), [row(r2, A1), row(r2, A9)]);
  const hd = at3.threads.get(A7); hd.importance = 'high'; hd.due = 'early December'; hd.dueDate = null;
  const rv = IV.compute(pk, { board: at3, cur: W3, date: '2026-11-02' });
  ok('t51l an important item with only a vague date is asked for a real date (kept as a further reason here)', row(rv, A7).also.includes('vague_date') && row(rv, A7).evidence.some(e => /early December/.test(e)));
  const txt = IV.copyText(r3, { asOf: 'Monday, Nov 2, 2026', title: 'Weekly 2026-11-02', projectName: c => ({ HP: 'Harbor Point reopening', LB: 'Library build' }[c]) });
  ok('t51m "Copy these questions": by section, then person, each with its ID, project and evidence, readable outside the app', txt.startsWith('Questions from MeetingGraph, as of Monday, Nov 2, 2026') &&
     txt.indexOf('Possible management intervention') < txt.indexOf('Ask in the next meeting') && /Ask Tom Lindqvist:\n- Is “Book the inspection” still happening/.test(txt) &&
     txt.includes(`[${A1}, Harbor Point reopening; due Oct 10`) && txt.includes('Why it may need intervention:') && txt.includes('Capacity conversations'), txt.slice(0, 600));
  const empty = IV.compute([seed], { board: S.replay([seed]), cur: seed, date: '2026-10-12' });
  ok('t51n a board started from a spreadsheet has no "since the previous meeting", and counts nothing as held over meetings, so nothing is escalated for it',
     empty.since === null && empty.followUp.concat(empty.escalate).every(x => !x.age) && !empty.escalate.some(x => /meetings/.test(x.escalation)));
  });

  // ---------- closing a project (the PM's ask, 2026-10-16) ----------
  await section('closing and reopening a project', async () => {
  const H = 'Type,Project,Title,Owner,Email,Teams name,Due,Status,Waiting on,Notes';
  const sd = SD.readSeed([H, 'Project,Harbor Point reopening,,,,,,,,', 'Project,Library build,,,,,,,,',
    'Action,Library build,Pick the architect,,,,,Open,,', 'Action,Library build,Order the books,,,,,In progress,,', 'Action,Library build,Old task,,,,,Done,,',
    'Question,Library build,Which site?,,,,,Open,,', 'Decision,Library build,Build on Fifth Street,,,,,,,', 'Action,Harbor Point reopening,Book the inspection,,,,,Open,,'].join('\n'));
  const ps = SD.seedPackage({ seed: sd, codes: { 'Harbor Point reopening': 'HP', 'Library build': 'LB' }, asOf: '2026-10-12', savedAt: '2026-10-12T12:00:00.000Z' });
  const id = w => ps.items.find(x => x.what === w).id;
  const b0 = S.replay([ps]);
  const cp = S.projectDecision({ board: b0, action: 'close_project', project: 'LB', note: 'Funding withdrawn', savedBy: 'PM', savedAt: '2026-10-13T09:00:00.000Z' });
  const b1 = S.replay([ps, cp.pkg || {}]);
  const st = (b, w) => (b.threads.get(id(w)) || {}).status;
  ok('t52a closing a project marks its open actions and questions not needed, as closed with it; done work and decisions stay as they were; other projects are untouched',
     !!cp.pkg && st(b1, 'Pick the architect') === 'not_needed' && st(b1, 'Order the books') === 'not_needed' && st(b1, 'Which site?') === 'not_needed' &&
     st(b1, 'Old task') === 'done' && st(b1, 'Build on Fifth Street') === 'decided' && st(b1, 'Book the inspection') === 'open' &&
     !!(b1.threads.get(id('Pick the architect')).closedWithProject || {}).note && b1.closedProjects.get('LB').note === 'Funding withdrawn', cp);
  ok('t52b a project close needs a note and a name, and cannot close a closed project or one the board does not have',
     !!S.projectDecision({ board: b0, action: 'close_project', project: 'LB', note: ' ', savedBy: 'PM' }).error && !!S.projectDecision({ board: b0, action: 'close_project', project: 'LB', note: 'x', savedBy: '' }).error &&
     !!S.projectDecision({ board: b1, action: 'close_project', project: 'LB', note: 'x', savedBy: 'PM' }).error && !!S.projectDecision({ board: b0, action: 'close_project', project: 'ZZ', note: 'x', savedBy: 'PM' }).error);
  ok('t52c its items leave the next request, and an item of a closed project takes no Board decision of its own',
     !S.openThreads(b1, ['LB', 'HP']).some(t => t.project === 'LB') && S.openThreads(b1, ['LB', 'HP']).length === 1 &&
     /closed project/.test(S.boardDecision({ board: b1, action: 'undo', ids: [id('Pick the architect')], note: 'x', savedBy: 'PM' }).error || ''));
  const rp = S.projectDecision({ board: b1, action: 'reopen_project', project: 'LB', note: 'Funding restored', savedBy: 'PM', savedAt: '2026-10-14T09:00:00.000Z' });
  const b2 = S.replay([ps, cp.pkg || {}, rp.pkg || {}]);
  ok('t52d reopening puts each item back to the status it had (open, in progress), keeps both decisions in its history, and lists the project again',
     !!rp.pkg && st(b2, 'Pick the architect') === 'open' && st(b2, 'Order the books') === 'in_progress' && st(b2, 'Which site?') === 'open' && st(b2, 'Old task') === 'done' &&
     !b2.closedProjects.has('LB') && b2.threads.get(id('Order the books')).history.filter(h => /_project$/.test(h.event || '')).length === 2 && S.openThreads(b2, ['LB']).length === 4);
  ok('t52e a reopen of a project that is not closed is refused', !!S.projectDecision({ board: b0, action: 'reopen_project', project: 'LB', note: 'x', savedBy: 'PM' }).error);
  const le = E.leadershipEmail(b1, { since: '2026-10-12', asOf: '2026-10-20', projects: [{ code: 'HP', name: 'Harbor Point reopening' }, { code: 'LB', name: 'Library build' }] });
  ok('t52f the Program report says the project was closed, by whom and why, and does not ask for its meeting; key developments record the close',
     /Library build: Closed .* by PM: Funding withdrawn/.test(le) && !/Library build: not discussed in any meeting yet/.test(le) && /Library build: project closed by PM, with its open items: Funding withdrawn/.test(le), le.slice(0, 600));
  // A project last discussed weeks ago would get "When does it next meet?"; once closed, it gets nothing.
  const lbm = S.meetingPackage({ pkgs: [ps], projects: [{ code: 'LB', name: 'Library build' }], meeting: meetingOf({ date: '2026-09-01', time: '10:00', offset: '-04:00', title: 'LB kickoff' }),
    statements: [{ id: 'S001', t: '00:00:01', speakerName: 'Okafor, Grace', text: 'w' }], request: { token: 'x', kind: 'followup', openIds: [] },
    checked: { items: [], reply: { summary: 's' }, cut: null, note: null, lastSegOk: true }, savedAt: '2026-09-01T20:00:00.000Z' });
  const IVm = require(path.join(MOD, 'interventions.js'));
  const bq = S.replay([ps, lbm]), quiet = IVm.compute([ps, lbm], { board: bq, cur: lbm, date: '2026-10-20' });
  const bc = S.replay([ps, lbm, cp.pkg || {}]), ivr = IVm.compute([ps, lbm, cp.pkg || {}], { board: bc, cur: lbm, date: '2026-10-20' });
  ok('t52g the Dashboard asks nothing about a closed project (open, it would be asked when it next meets)', quiet.projects.some(p => p.code === 'LB') &&
     !ivr.projects.some(p => p.code === 'LB') && !ivr.followUp.concat(ivr.escalate).some(x => x.project === 'LB'), [quiet.projects, ivr.projects]);
  });

  await section('leadership email (§4.4)', async () => {
  const b = S.replay([fx, PF2]);
  const le = E.leadershipEmail(b, { since: '2026-10-20', asOf: '2026-10-30', projects: [PROJECT] });
  const pos = E.LEAD_SECTIONS.map(h => le.indexOf('\n' + h + '\n'));
  ok('t48a the leadership email has the PM\'s sections, in order', le.startsWith('Team,\n') && pos.every(p => p >= 0) && pos.every((p, i) => i === 0 || p > pos[i - 1]), pos);
  ok('t48b key developments carry the closures of the period', /Harbor Point reopening: done: “.*” \(AI-101\)/.test(le));
  const mgmt = le.split('Management attention/risks')[1].split('Near-term next steps')[0];
  ok('t48c management attention: open risks, actions with no owner, and blocked work with what it waits on', b.threads.get('AI-103').status === 'blocked' && mgmt.includes('AI-103') && /is blocked/.test(mgmt));
  const table = le.split('Project task status and accountable owners')[1];
  ok('t48d the status table lists the open actions with status and owner, and no closed ones', table.includes('AI-103') && /Blocked/.test(table) && !table.includes('\tAI-101 '));
  const late = Object.assign({}, PD); const bl = S.replay([late]);
  const le2 = E.leadershipEmail(bl, { since: '2026-10-19', asOf: '2026-11-02', projects: [PROJECT] });
  ok('t48e overdue counts only resolved dates: "this week" on Oct 19 is overdue by Nov 2; "early December" is not', /fire marshal.*overdue by 10 days/.test(le2) && !/early December.*overdue/.test(le2));
  ok('t48f decisions of the period are listed; "None this week." when there are none', !/Decisions\n\nNone this week\./.test(le2) && /Decisions\n\nNone this week\./.test(E.leadershipEmail(bl, { since: '2026-12-01', asOf: '2026-12-02', projects: [PROJECT] })));
  const op = le.split('\nKey developments:')[0];
  ok('t48h the opening is one paragraph per project: its latest meeting summary, with the date, and the board facts (not a per-meeting account)',
     op.startsWith('Team,\n\nHarbor Point reopening: Last discussed Monday, Oct 26, 2026') && op.includes(PF2.reply.summary.trim()) && !/convened/.test(op) &&
     /Board: \d+ open actions?, \d+ overdue, [1-9]\d* blocked; [1-9]\d* closed this period\./.test(op), op.slice(0, 400));
  const opL = E.leadershipEmail(b, { since: '2026-11-01', asOf: '2026-11-30', projects: [PROJECT, { code: 'LB', name: 'Library build' }] }).split('\nKey developments:')[0];
  ok('t48i any time, every project: a project not discussed this period still shows its last summary, marked as before the period; one never discussed says so',
     opL.includes('Harbor Point reopening: Last discussed Monday, Oct 26, 2026') && opL.includes(', before this period') && opL.includes('Library build: Not discussed in a meeting yet.') &&
     /Harbor Point reopening: .*0 closed this period\./.test(opL), opL.slice(0, 500));
  const opE = E.leadershipEmail(b, { since: '2026-10-19', asOf: '2026-10-20', projects: [PROJECT] }).split('\nKey developments:')[0];
  ok('t48j a report "to" a date before the latest meeting uses the summary of the last meeting up to that date, not a later one',
     !opE.includes(PF2.reply.summary.trim()) && !opE.includes('Oct 26'), opE.slice(0, 300));
  ok('t48g a project with no meeting yet is named under management attention', /Library build: not discussed in any meeting yet/.test(E.leadershipEmail(bl, { since: '2026-10-19', asOf: '2026-10-20', projects: [PROJECT, { code: 'LB', name: 'Library build' }] })));
  });

  // ---------- what an item may continue (Aaron's real run of the mock meetings, 2026-10-15) ----------
  await section('items attached to the wrong kind of thread', async () => {
  const H = 'Type,Project,Title,Owner,Email,Teams name,Due,Status,Waiting on,Notes';
  const sd = SD.readSeed([H, 'Project,Harbor Point reopening,,,,,,,,', 'Action,Harbor Point reopening,Book the fire inspection,,,,,Open,,',
    'Question,Harbor Point reopening,Is the mural kept?,,,,,Open,,', 'Risk,Harbor Point reopening,The inspection could fail,,,,,Open,,',
    'Decision,Harbor Point reopening,Open house January 16,,,,,,,'].join('\n'));
  const ps = SD.seedPackage({ seed: sd, codes: { 'Harbor Point reopening': 'HP' }, asOf: '2026-10-15', savedAt: '2026-10-15T12:00:00.000Z' });
  const bS = S.replay([ps]);
  const id = k => [...bS.threads.values()].find(t => t.kind === k).id;
  const A = id('action'), Qn = id('question'), Rk = id('risk'), Dc = id('decision');
  const base = { importance: 'normal', due: null, waitsOn: null, src: 'verified', toCheck: false, notes: [], whoIsSpeaker: true, words: 'w' };
  const its = [Object.assign({ n: 1, kind: 'commitment', who: 'Lindqvist, Tom', what: 'Walk the building before the inspection', thread: Rk, status: null, seg: 'S053', due: 'the week before' }, base),
    Object.assign({ n: 2, kind: 'decision', who: 'Okafor, Grace', what: 'The mural stays', thread: Qn, status: 'done', seg: 'S172' }, base),
    Object.assign({ n: 3, kind: 'decision', who: 'Okafor, Grace', what: 'Open house January 16, restated', thread: Dc, status: 'done', seg: 'S041' }, base),
    Object.assign({ n: 4, kind: 'commitment', who: 'Lindqvist, Tom', what: 'Call the fire marshal', thread: A, status: 'done', seg: 'S036' }, base),
    Object.assign({ n: 5, kind: 'commitment', who: 'Mensah, Abena', what: 'Be the volunteer point person', thread: Qn, status: 'done', seg: 'S205' }, base)];
  const pl = S.placeItems({ items: its, proposals: [], known: [PROJECT], board: bS });
  const at = n => pl.items.find(x => x.n === n), statusOf = n => pl.items.find(x => x.statusOf === n);
  ok('t49a a commitment the chat attached to a risk is new work about it: no thread, related to the risk, in its project', at(1).thread === null && at(1).relatedTo === Rk && at(1).project === 'HP' && !pl.need.includes(at(1)));
  ok('t49b a decision that settles a question is a new decision, and the question\'s closure is kept as an update', at(2).thread === null && at(2).relatedTo === Qn &&
     statusOf(2) && statusOf(2).thread === Qn && statusOf(2).status === 'done' && statusOf(2).kind === 'update');
  ok('t49c a decision restated on a decision stays a mention, and its status is not applied', at(3).thread === Dc && at(3).status === null && /settled when it is made/.test(at(3).notes.join()));
  ok('t49d a commitment on an action continues it, status and all', at(4).thread === A && at(4).status === 'done' && !at(4).relatedTo);
  ok('t49e a commitment that answers a question is new work too, and the question still closes', at(5).thread === null && at(5).relatedTo === Qn && statusOf(5) && statusOf(5).status === 'done');
  const pk = S.meetingPackage({ pkgs: [ps], projects: pl.covered, meeting: meetingOf(FU), statements: segsFu, request: { token: 'x', kind: 'followup', openIds: [A, Qn, Rk, Dc] },
    checked: { items: pl.items, reply: {}, cut: null, note: null, lastSegOk: true }, savedAt: '2026-10-26T15:00:00.000Z' });
  const bP = S.replay([ps, pk]);
  const minted = n => pk.items.find(x => x.n === n).id;
  ok('t49f saved: the new action and the new decisions get IDs and are on the board, linked to what they were about', /^HP-A-261026-\d\d$/.test(minted(1) || '') && /^HP-D-261026-\d\d$/.test(minted(2) || '') &&
     /^HP-A-261026-\d\d$/.test(minted(5) || '') && bP.threads.get(minted(2)).relatedTo === Qn && bP.threads.get(minted(1)).owner === 'Tom Lindqvist');
  ok('t49g the decision stays decided and stays in the next request (it had dropped out); the question and the action close', bP.threads.get(Dc).status === 'decided' &&
     S.openThreads(bP, ['HP']).some(t => t.id === Dc) && bP.threads.get(Qn).status === 'done' && bP.threads.get(A).status === 'done');
  ok('t49h new work about a risk counts as a mention of the risk (for parking)', bP.threads.get(Rk).lastTouch === meetingOf(FU).id && bP.threads.get(Rk).history.some(h => h.event === 'related'));
  const em = E.meetingEmail(pk, S.replay([ps], { upTo: pk.meeting.id }));
  ok('t49i the email lists the mural decision under decisions, the new actions under new actions, and no status on the restated decision',
     em.includes('Decided: The mural stays') && em.includes(`${minted(1)} Walk the building`) && !/Open house January 16, restated Status:/.test(em));
  const old = JSON.parse(JSON.stringify(pk)); old.id = 'old-save'; old.items.find(x => x.n === 3).status = 'done'; old.items.find(x => x.n === 3).applied = true;
  const pkS = JSON.parse(JSON.stringify(pk)); pkS.reply.summary = 'The team met and settled the mural.';
  const emS = E.meetingEmail(pkS, S.replay([ps], { upTo: pkS.meeting.id }));
  ok('t49q with the chat\'s summary, the meeting\'s decisions are still listed, with their IDs, under it', emS.includes('The team met and settled the mural.') &&
     emS.includes('Decided in this meeting:') && emS.includes(`- ${minted(2)} The mural stays`) && emS.indexOf('Decided in this meeting:') < emS.indexOf('3. New actions'));
  ok('t49j a package saved before this fix, with a "done" applied to a decision, still leaves the decision decided', S.replay([ps, old]).threads.get(Dc).status === 'decided');

  // Review again (Aaron's run, 2026-10-16): a date the old reader got wrong is read again; a date the PM set is kept.
  const sv = JSON.parse(JSON.stringify(pk));
  sv.items.push({ n: 6, ref: 'N6', kind: 'update', who: 'Lindqvist, Tom', what: 'The inspection is booked', thread: A, status: null, seg: 'S036', words: 'w', src: 'verified', toCheck: false, notes: [],
    importance: 'high', due: 'Monday, December fourteenth, at nine in the morning', dueDate: '2026-11-02', id: null });
  sv.items.push({ n: 7, ref: 'N7', kind: 'update', who: 'Lindqvist, Tom', what: 'A date the PM set', thread: A, status: null, seg: 'S037', words: 'w', src: 'verified', toCheck: false, notes: [],
    importance: 'high', due: 'next Monday', dueDate: '2026-11-20', edited: ['due date'], id: null });
  const ro = RV.reopenItems(sv), roAt = n => ro.find(x => x.n === n) || { r: {}, notes: [] };
  const reSaved = RV.applyReview(ro, { meetingDate: '2026-10-26' }).items, rsAt = n => reSaved.find(x => x.n === n) || {};
  ok('t49k reopened, a saved date the PM never edited is read again (Nov 2 becomes Dec 14) and not marked as changed', roAt(6).r.dueDate === undefined &&
     rsAt(6).dueDate === '2026-12-14' && !rsAt(6).edited);
  ok('t49l reopened, a date the PM set stays, and stays marked as theirs', roAt(7).r.dueDate === '2026-11-20' && rsAt(7).dueDate === '2026-11-20' && (rsAt(7).edited || []).includes('due date'));
  ok('t49m reopened, new work about an open item comes back attached, with the status it carried', roAt(2).thread === Qn && roAt(2).status === 'done' && !roAt(2).relatedTo &&
     !ro.some(x => x.statusOf) && !(roAt(2).notes || []).some(t => /^new decision about/.test(t)));

  // A re-save that adds IDs a later meeting never saw (Aaron's run, 2026-10-16).
  const later = JSON.parse(JSON.stringify(pk)); later.id = 'later'; later.meeting = Object.assign({}, later.meeting, { id: '20261102T140000Z', date: '2026-11-02' });
  later.items = []; later.request = { token: 'y', kind: 'followup', openIds: [A, Qn, Rk, Dc, minted(1)] };
  const un = S.unseenLater([ps, pk, later], pk);
  ok('t49n a re-saved earlier meeting names the IDs a later meeting\'s request did not list, and only those', un.length === 1 && un[0].meeting.id === '20261102T140000Z' &&
     un[0].items.includes(minted(2)) && un[0].items.includes(minted(5)) && !un[0].items.includes(minted(1)) && !un[0].items.includes(A));
  later.request.openIds = later.request.openIds.concat(pk.items.filter(x => x.id).map(x => x.id));
  const nn = S.boardDecision({ board: S.replay([ps, pk]), action: 'not_needed', ids: [minted(5)], note: 'not needed', savedBy: 'PM', savedAt: '2026-10-27T12:00:00.000Z' }).pkg;
  const later2 = Object.assign({}, later, { request: { token: 'y', kind: 'followup', openIds: [A, Qn, Rk, Dc, minted(1)] } });
  const unC = nn ? S.unseenLater([ps, pk, nn, later2], pk) : [];
  ok('t49p an item closed before the later meeting is not named (a request never lists closed items); the open ones still are', !!nn && unC.length === 1 &&
     !unC[0].items.includes(minted(5)) && unC[0].items.includes(minted(2)));
  // The optional Teams attendance report (UX B1): a mock report, UTF-16 with a byte-order mark, as Teams downloads it.
  const REP = ['1. Summary', 'Meeting title\tHarbor Point weekly', 'Start time\t10/26/26, 10:00:03 AM', 'End time\t10/26/26, 10:59:50 AM', 'Meeting duration\t59m 47s', '',
    '2. Participants', 'Name\tFirst Join\tLast Leave\tIn-Meeting Duration\tEmail\tRole',
    'Okafor, Grace\t10/26/26, 10:00:03 AM\t10/26/26, 10:59:50 AM\t59m 47s\tgo@example.org\tOrganizer',
    'LINDQVIST, TOM\t10/26/26, 10:00:38 AM\t10/26/26, 10:59:20 AM\t58m 42s\ttl@example.org\tPresenter',
    'Zed Visitor\t10/26/26, 10:10:00 AM\t10/26/26, 10:20:00 AM\t10m\tzv@example.org\tAttendee', '', '3. In-Meeting Activities', 'Name\tJoin Time'].join('\r\n');
  const u16 = Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(REP, 'utf16le')]);
  const dec = AT.decode(u16.buffer.slice(u16.byteOffset, u16.byteOffset + u16.length)), att = AT.parse(dec.text || '');
  ok('t50a the attendance report reads locally: UTF-16, three sections, the participants and the meeting times', att.participants.length === 3 && att.title === 'Harbor Point weekly' &&
     att.duration === '59m 47s' && att.participants[0].name === 'Okafor, Grace' && att.participants[1].role === 'Presenter' && !att.warnings.length, att);
  const csv = AT.parse('2. Participants\nName,First Join,Last Leave,In-Meeting Duration\nOkafor, Grace,10/26/26, 10:00:03 AM,10/26/26, 10:59:50 AM,59m');
  ok('t50b a comma copy with an unquoted "Last, First" name and split times still reads as one person', csv.participants.length === 1 && csv.participants[0].name === 'Okafor, Grace' &&
     csv.participants[0].join === '10/26/26, 10:00:03 AM', csv);
  ok('t50c a file that is not an attendance report says so and gives nobody; an Excel workbook is named as one', AT.parse('hello\nworld').participants.length === 0 &&
     /Participants/.test(AT.parse('hello').warnings.join()) && AT.decode(new Uint8Array([0x50, 0x4B, 3, 4]).buffer).error === 'xlsx');
  const ppl = PE.peopleOf([ps, pk]), mt = AT.match(att, ppl, ['Okafor, Grace']);
  ok('t50d participants match the people register (as written, or by display name: LINDQVIST, TOM is Tom Lindqvist); an unknown one is kept, unmatched', mt[0].person === 'Grace Okafor' && mt[1].person === 'Tom Lindqvist' &&
     mt[2].person === null && mt[2].name === 'Zed Visitor', mt.map(x => x.person));
  const fp = AT.forPackage(att, ppl, []);
  ok('t50e what is saved keeps the names, roles and times, the person matched, and no email address', fp.participants.length === 3 && !JSON.stringify(fp).includes('example.org') &&
     fp.participants[0].person === 'Grace Okafor' && fp.start === '10/26/26, 10:00:03 AM');
  const withA = S.meetingPackage({ pkgs: [ps], projects: pl.covered, meeting: meetingOf(FU), statements: segsFu, request: { token: 'x', kind: 'followup', openIds: [A, Qn, Rk, Dc] },
    checked: { items: pl.items, reply: {}, cut: null, note: null, lastSegOk: true }, savedAt: '2026-10-26T15:00:00.000Z', attendance: fp });
  ok('t50f the meeting package keeps the attendance when given, and has no attendance field when not (old packages unchanged)', withA.attendance === fp && !('attendance' in pk));
  const emA = E.meetingEmail(withA, S.replay([ps], { upTo: withA.meeting.id })), em0 = E.meetingEmail(pk, S.replay([ps], { upTo: pk.meeting.id }));
  ok('t50g the meeting email lists the attendees (as matched people) in its overview; without a report it has no attendee line', emA.includes('Attendees (3): Grace Okafor, Tom Lindqvist, Zed Visitor') &&
     !em0.includes('Attendees') && emA.indexOf('Attendees') < emA.indexOf('2. Executive Summary'));
  ok('t49o nothing is named when the later meeting saw every ID, or when there is no later meeting', S.unseenLater([ps, pk, later], pk).length === 0 && S.unseenLater([ps, pk], pk).length === 0);
  });

  // ---------- the counts-only summary ----------
  await section('summary', async () => {
  const sm = U.countsSummary({ statements: segsFu.length, requestChars: reqFu.text.length, requestKind: 'followup', openThreads: open0.length, replyChars: runText('F2.txt').length, checked: cF2, verdict: 'yes' });
  const names = new Set(); segsFu.concat(segsSeed).forEach(s => s.speakerName.split(/[ ,]+/).filter(Boolean).forEach(w => names.add(w)));
  const titleWords = ['Harbor', 'Point', 'reopening', 'weekly', 'kickoff'];
  const leaked = [...names, ...titleWords].filter(w => new RegExp('\\b' + w + '\\b', 'i').test(sm));
  ok('t25a the summary holds no names and no title words (counts only)', leaked.length === 0, leaked);
  ok('t25b the summary has the counts', /Statements: 381/.test(sm) && /Items: 43/.test(sm) && /verified 43/.test(sm) && /Reply complete: yes/.test(sm), sm);
  const smOwner = U.countsSummary({ statements: 1, requestChars: 1, requestKind: 'seed', openThreads: 0, replyChars: 1, verdict: null,
    checked: { items: [{ kind: 'commitment', src: 'verified', whoIsSpeaker: false, who: 'Pete', notes: [] }], cut: null, note: null, lastSegOk: true } });
  ok('t25c an owner that is not a speaker label is counted, never named', /not a speaker label: 1/.test(smOwner) && !/Pete/.test(smOwner));
  });

  console.log(`\n${n - failed}/${n} v2 unit checks ` + (failed ? 'FAILED' : 'ALL GREEN'));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('CRASH ' + e.stack); process.exit(2); });
