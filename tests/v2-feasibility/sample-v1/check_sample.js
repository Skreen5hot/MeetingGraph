/* Scores variant J replies on v1's sample meeting (plan §10.20). Reads replies with v2's own reply.js, so a reply
   that scores here also reads in the page.
     node check_sample.js seeded run1.txt [run2.txt ...]   the sample board seeded: placement
     node check_sample.js empty run1.txt [...]             an empty board: the chat proposes the projects
     node check_sample.js --self-test
   Pass rules are §10.20's, set before any run. */
'use strict';
const fs = require('fs'), path = require('path');
const R = require('../../../src/v2/modules/reply.js');
const { requests } = require('./make_requests.js');

// The effort each statement is about (key.json). S006 is the trap: its project is not clear.
const EFFORT = { S001: 'IPR', S002: 'IPR', S003: 'IPR', S004: 'PDE', S005: 'PDE', S006: null, S007: 'PDE',
                 S008: 'RDM', S009: 'RDM', S010: 'RDM', S011: 'RRC', S012: 'RDM' };
const CODES = ['IPR', 'PDE', 'RDM', 'RRC'];
// A proposed project's effort, from its name (or else its quote).
const WORDS = [['IPR', /intake|portal|prototype|field|form|filer|accessib/i], ['PDE', /partner|exchange|transfer|firewall|interconnect|security agreement/i],
               ['RDM', /dashboard|report|refresh|publish/i], ['RRC', /record|retention|clean ?up|shared drive/i]];
function effortOf(text) {
  let best = null, at = Infinity;
  for (const [c, re] of WORDS) { const m = re.exec(text || ''); if (m && m.index < at) { best = c; at = m.index; } }
  return best;
}

function rawLines(text) {
  const out = [];
  for (const raw of String(text).split(/\r?\n/)) { const l = raw.trim(); if (!l.startsWith('{')) continue; try { out.push(JSON.parse(l)); } catch (e) { break; } }
  return out;
}

// One reply: { ok, stop?, counts, fails[] }.
function score(mode, text, req, s) {
  const r = mode === 'seeded' ? req.seeded : req.empty;
  const openIds = mode === 'seeded' ? s.threads.map(t => t.id) : [];
  const c = R.checkReply(text, { segments: s.segments, token: r.token, openIds });
  if (c.stop) return { ok: false, stop: c.stop, fails: ['the reply does not read: ' + c.stop] };
  const byId = {}; s.segments.forEach(x => { byId[x.id] = x; });
  const lines = rawLines(text);
  const raw = lines.slice(1).filter(o => o && 'kind' in o);
  const proposals = lines.slice(1).filter(o => o && 'newProject' in o).map(p => {
    const v = R.verify(p.seg, p.words, byId, s.segments);
    return { ref: String(p.newProject), name: String(p.name || ''), src: v.src, seg: v.seg, effort: effortOf(p.name) || effortOf(p.words) };
  });
  const thread = new Map(s.threads.map(t => [t.id, t.project]));
  const n = { items: c.items.length, newItems: 0, right: 0, wrong: 0, notClear: 0, guessS006: 0, threadMismatch: 0, unknownCode: 0 };
  let s007;   // undefined: S007 is not listed as new work
  c.items.forEach((it, i) => {
    const p = raw[i] && raw[i].project != null && raw[i].project !== '' ? String(raw[i].project).trim() : null;
    if (it.thread) { if (p && p.toUpperCase() !== thread.get(it.thread)) n.threadMismatch++; return; }
    n.newItems++;
    let got;
    if (p === null) got = null;
    else if (mode === 'seeded' && CODES.includes(p.toUpperCase())) got = p.toUpperCase();
    else { const pr = proposals.find(x => x.ref.toUpperCase() === p.toUpperCase()); got = pr ? (pr.effort || 'unmapped') : (n.unknownCode++, 'unknown'); }
    const want = EFFORT[it.seg];
    if (it.seg === 'S007') s007 = got;
    if (want === null) { if (got !== null) n.guessS006++; return; }
    if (got === null) n.notClear++; else if (got === want) n.right++; else n.wrong++;
  });
  const fails = [];
  if (mode === 'seeded') {
    if (proposals.length) fails.push(`${proposals.length} new project${proposals.length > 1 ? 's' : ''} proposed; all four are listed`);
    if (n.wrong + n.guessS006 > 1) fails.push(`${n.wrong + n.guessS006} new items in a wrong project (at most 1)`);
    if (n.notClear > 2) fails.push(`${n.notClear} new items "not clear" (at most 2)`);
    if (s007 === undefined) fails.push('S007 (the security agreement) is not listed as new work');
    else if (s007 !== null && s007 !== 'PDE') fails.push(`S007 placed in ${s007}, not PDE`);
  } else {
    const eff = proposals.map(p => p.effort);
    for (const p of proposals) if (!['verified', 'near'].includes(p.src)) fails.push(`project ${p.ref} "${p.name}": its quote is ${p.src}`);
    for (const e of ['IPR', 'PDE', 'RDM']) if (!eff.includes(e)) fails.push(`no project proposed for ${e}`);
    for (const e of CODES) if (eff.filter(x => x === e).length > 1) fails.push(`${e} proposed ${eff.filter(x => x === e).length} times`);
    if (eff.filter(x => !x).length > 1) fails.push(`${eff.filter(x => !x).length} proposals match none of the four efforts (at most 1)`);
    if (n.wrong + n.guessS006 > 1) fails.push(`${n.wrong + n.guessS006} new items in a wrong project (at most 1)`);
    if (n.notClear > 3) fails.push(`${n.notClear} new items "not clear" (at most 3)`);
    if (n.unknownCode) fails.push(`${n.unknownCode} items name a project that is neither listed nor proposed`);
  }
  if (c.cut) fails.push('the reply was cut: ' + c.cut);
  return { ok: !fails.length, counts: n, proposals, s007, fails };
}

function report(mode, file, res) {
  const out = [`${path.basename(file)} (${mode}): ${res.ok ? 'PASS' : 'FAIL'}`];
  if (res.counts) {
    const n = res.counts;
    out.push(`  items ${n.items}; new ${n.newItems}: right project ${n.right}, wrong ${n.wrong}, not clear ${n.notClear}, guessed on S006 ${n.guessS006}; S007 -> ${res.s007 === undefined ? 'not new work' : res.s007}`);
    out.push(`  thread items whose project differs from the thread's (the page ignores it): ${n.threadMismatch}`);
    if (res.proposals.length) out.push('  new projects: ' + res.proposals.map(p => `${p.ref} "${p.name}" (${p.src}, ${p.effort || 'no effort'})`).join('; '));
  }
  for (const f of res.fails) out.push('  - ' + f);
  return out.join('\n');
}

/* ---------- self-test: synthetic replies with known answers ---------- */
async function selfTest() {
  const req = await requests(), s = req.s;
  let pass = 0, fail = 0;
  const ok = (name, cond) => { if (cond) pass++; else { fail++; console.log('FAIL ' + name); } };
  const head = tok => JSON.stringify({ context: tok, lastSeg: 'S012', summary: 'x' });
  const item = (seg, words, extra) => JSON.stringify(Object.assign({ ref: 'N1', kind: 'update', topic: 't', project: null, who: null, what: 'w', due: null,
    importance: 'normal', thread: null, status: null, waitsOn: null, seg, words }, extra));
  const reply = (tok, lines) => [head(tok), ...lines, JSON.stringify({ end: lines.filter(l => l.includes('"kind"')).length })].join('\n');
  const T = req.seeded.token, E = req.empty.token;
  const S7 = item('S007', "I'll own that, target end of October", { kind: 'commitment', project: 'PDE' });
  const S12 = item('S012', "we're going to publish nightly", { kind: 'decision', project: 'RDM' });
  const TH = item('S004', 'the firewall rule finally went in yesterday', { thread: 'PDE-A-260924-04', status: 'done', project: 'PDE' });
  const sc = (m, t) => { try { return score(m, t, req, s); } catch (e) { return { ok: null, fails: ['crash ' + e.message], counts: {} }; } };

  let r = sc('seeded', reply(T, [TH, S7, S12]));
  ok('s1 a good seeded reply passes', r.ok === true && r.counts.right === 2 && r.counts.newItems === 2);
  r = sc('seeded', reply('MKG2|followup|x|y', [S7]));
  ok('s2 the wrong token fails and says why', r.ok === false && /different request/.test(r.fails[0]));
  r = sc('seeded', reply(T, [S7.replace('"PDE"', '"RDM"'), S12.replace('"RDM"', '"IPR"')]));
  ok('s3 two wrong projects fail; S007 misplaced is named', r.ok === false && r.counts.wrong === 2 && r.fails.some(f => /S007 placed in RDM/.test(f)));
  r = sc('seeded', reply(T, [S7, S12.replace('"RDM"', '"IPR"')]));
  ok('s4 one wrong project is allowed', r.ok === true && r.counts.wrong === 1);
  r = sc('seeded', reply(T, [S7.replace('"PDE"', 'null'), S12.replace('"RDM"', 'null'), item('S011', 'still nothing from the records office', { kind: 'risk' })]));
  ok('s5 null is "not clear", not wrong; three fail the cap', r.ok === false && r.counts.notClear === 3 && r.counts.wrong === 0);
  r = sc('seeded', reply(T, [JSON.stringify({ newProject: 'J1', name: 'Security agreement', seg: 'S007', words: 'an interconnection security agreement signed' }), S7, S12]));
  ok('s6 a new project on the seeded board fails', r.ok === false && r.fails.some(f => /new project/.test(f)));
  r = sc('seeded', reply(T, [S12, item('S006', 'automate the monthly exports too', { kind: 'question', project: 'RDM' }), S7]));
  ok('s7 a code on the S006 trap counts as a guess', r.counts.guessS006 === 1 && r.ok === true);
  r = sc('seeded', reply(T, [S12]));
  ok('s8 S007 missing as new work fails', r.ok === false && r.fails.some(f => /S007 .*is not listed as new work/.test(f)));
  r = sc('seeded', reply(T, [S7, S12, item('S010', "Sure, I'll take it.", { thread: 'RDM-A-260924-02', project: 'IPR' })]));
  ok('s9 a thread item\'s project is counted apart and never scored', r.ok === true && r.counts.threadMismatch === 1 && r.counts.wrong === 0);

  const P = (ref, name, seg, words) => JSON.stringify({ newProject: ref, name, seg, words });
  const good = [P('J1', 'Intake portal', 'S001', 'Quick one on the intake fields'), P('J2', 'Partner exchange', 'S004', 'On the partner exchange'),
    P('J3', 'Reporting dashboard', 'S008', 'Dashboard update, three of the five'), P('J4', 'Records cleanup', 'S011', 'Records cleanup, still nothing')];
  const e7 = S7.replace('"PDE"', '"J2"'), e12 = S12.replace('"RDM"', '"J3"');
  r = sc('empty', reply(E, [...good, e7, e12]));
  ok('e1 a good empty-board reply passes', r.ok === true && r.proposals.length === 4 && r.counts.right === 2);
  r = sc('empty', reply(E, [good[0], good[1], e7, e12.replace('"J3"', 'null')]));
  ok('e2 no dashboard project fails', r.ok === false && r.fails.some(f => /no project proposed for RDM/.test(f)));
  r = sc('empty', reply(E, [...good, P('J5', 'Dashboard publishing', 'S012', 'publish nightly, to match the refresh'), e7, e12]));
  ok('e3 the same effort twice fails', r.ok === false && r.fails.some(f => /RDM proposed 2 times/.test(f)));
  r = sc('empty', reply(E, [good[0], P('J2', 'Partner exchange', 'S004', 'the partner exchange is live'), good[2], e7, e12]));
  ok('e4 a proposal whose quote is not in the meeting fails', r.ok === false && r.fails.some(f => /J2 .*not found/.test(f)));
  r = sc('empty', reply(E, [...good, e7.replace('"J2"', '"J9"'), e12]));
  ok('e5 a ref that names no proposal fails', r.ok === false && r.fails.some(f => /neither listed nor proposed/.test(f)));
  r = sc('empty', reply(E, [...good, e7.replace('"J2"', '"J1"'), e12.replace('"J3"', '"J4"')]));
  ok('e6 items in the wrong proposed projects fail', r.ok === false && r.counts.wrong === 2);
  r = sc('empty', reply(E, [...good, P('J5', 'Team offsite', 'S006', 'automate the monthly exports too'), P('J6', 'Lunch', 'S003', 'still on for the eighth'), e7, e12]));
  ok('e7 two proposals matching no effort fail', r.ok === false && r.fails.some(f => /match none/.test(f)));
  ok('e8 the effort of a name: "Partner data exchange" is PDE, "Records retention cleanup" is RRC, "Weekly reports" is RDM',
     effortOf('Partner data exchange') === 'PDE' && effortOf('Records retention cleanup') === 'RRC' && effortOf('Weekly reports') === 'RDM' && effortOf('Lunch') === null && effortOf('Dashboard records') === 'RDM');
  r = sc('seeded', [head(T), S7, S12].join('\n'));
  ok('c1 a cut reply (no end line) fails', r.ok === false && r.fails.some(f => /cut/.test(f)));
  // The requests: the tested text, plus the J additions and nothing else.
  const Q = require('../../../src/v2/modules/request.js');
  const bag = t => { const m = new Map(); for (const l of t.split('\n').filter(x => x.trim())) m.set(l, (m.get(l) || 0) + 1); return m; };
  const diff = (a, b) => { const out = []; for (const [l, k] of bag(a)) { const d = k - (bag(b).get(l) || 0); for (let i = 0; i < d; i++) out.push(l); } return out; };
  const instr = (t, cut) => t.split('\n').filter(l => !l.startsWith('CONTEXT TOKEN')).join('\n').split(cut)[0];
  const added = diff(instr(req.seeded.text, '=== PROJECTS ===\nCODE'), instr(Q.FOLLOWUP, '@@THREADS@@'));
  const removed = diff(instr(Q.FOLLOWUP, '@@THREADS@@'), instr(req.seeded.text, '=== PROJECTS ===\nCODE'));
  ok('r1 the follow-up request: F plus five J lines; only the template and the end line are rewritten',
     added.length === 6 && removed.length === 2 && removed.every(l => /^- Then one line per item|^- The last line/.test(l)) && added.some(l => /^- "project": /.test(l)) && added.some(l => /^NEW PROJECTS\./.test(l)));
  const addedE = diff(instr(req.empty.text, '\n=== PROJECTS ===\nnone'), instr(Q.SEED, '\n=== MEETING ===\nMEETING:'));
  ok('r2 the empty-board request: D plus the same five lines', addedE.length === 6 && /=== PROJECTS ===\nnone yet: the board has no projects\n\n=== MEETING ===/.test(req.empty.text));
  ok('r3 every open thread shows its project, and the projects are listed by code and name',
     req.seeded.text.includes('ID | project | kind | owner') && req.seeded.text.includes('IPR-A-260924-03 | IPR | action | Linh Nguyen') && req.seeded.text.includes('PDE | Partner data exchange'));
  console.log(`check_sample self-test: ${pass} passed, ${fail} failed`);
  return fail === 0;
}

if (require.main === module) {
  const [mode, ...files] = process.argv.slice(2);
  if (mode === '--self-test') selfTest().then(g => process.exit(g ? 0 : 1));
  else if (!['seeded', 'empty'].includes(mode) || !files.length) { console.log('usage: node check_sample.js seeded|empty reply.txt ... | --self-test'); process.exit(2); }
  else requests().then(req => {
    const res = files.map(f => score(mode, fs.readFileSync(f, 'utf8'), req, req.s));
    files.forEach((f, i) => console.log(report(mode, f, res[i])));
    const n = res.filter(x => x.ok).length;
    console.log(`\n${n} of ${res.length} runs pass. §10.20 needs 3 of 3 on each board.`);
  });
}
module.exports = { score, effortOf, selfTest };
