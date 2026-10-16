// Node self-test: Layer A fixtures, check knockout, Layer B grader self-check.
const V = require('../../src/modules/validator.js'), A = require('./fixtures_a.js'), B = require('./fixtures_b.js');
let failed = 0;

console.log('== Layer A');
const a = A.runLayerA();
for (const r of a) {
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.id.padEnd(5) + r.title);
  if (!r.pass) { failed++; console.log('   missing:', r.missing, '\n   unexpected:', r.unexpected); }
}
console.log(`${a.filter(r => r.pass).length}/${a.length}`);

console.log('\n== Knockout (each check must be caught by some fixture)');
const orig = V.validate;
const codes = [...new Set(a.flatMap(r => r.flags.map(f => f.code)))].sort();
for (const c of codes) {
  V.validate = (p, x) => { const r = orig(p, x); r.flags = r.flags.filter(f => f.code !== c); r.blocked = r.flags.some(f => f.sev === 'block'); return r; };
  const fails = A.runLayerA().filter(r => !r.pass).map(r => r.id);
  if (!fails.length) failed++;
  console.log((fails.length ? 'caught   ' : 'UNCAUGHT ') + c.padEnd(26) + fails.join(' '));
}
V.validate = orig;

console.log('\n== Layer B grader self-check (good sample passes, bad sample fails)');
for (const r of B.selfCheck()) {
  console.log((r.ok ? 'OK   ' : 'BAD  ') + r.id + `  good:${r.goodPasses ? 'pass' : 'FAIL'}  bad:${r.badFails ? 'fails' : 'PASSES'}`);
  if (!r.goodPasses) {
    failed++;
    r.good.results.filter(x => !x.ok).forEach(x => console.log('     good assert failed:', x.text, x.err || ''));
    r.good.validator.flags.filter(f => f.sev === 'block').forEach(f => console.log('     good blocked:', f.code, f.ref, f.msg));
  }
  if (!r.badFails) failed++;
  const why = [...r.bad.results.filter(x => !x.ok).map(x => 'assert: ' + x.text), ...r.bad.validator.flags.filter(f => f.sev === 'block').map(f => 'flag: ' + f.code + ' ' + f.ref)];
  console.log('     bad caught by -> ' + (why.join(' | ') || 'nothing'));
}
console.log('\n== Sample graph (Difficult transcript): tester alignment, golden, mutations');
const Dd = require('./fixtures_d.js');
const fl = Dd.evaluate(Dd.FLAWED, 'A');
const agree = fl.rows.filter(x => x.tester === 'defect' ? x.defect : x.tester === 'ok' ? !x.defect : true);
console.log(`rejected reply vs tester review: ${agree.length}/${fl.rows.length} rows agree; reply blocked: ${fl.result.blocked}`);
if (agree.length !== fl.rows.length || !fl.result.blocked) failed++;
const gb = Dd.evaluate(Dd.GOLDEN_B, 'B');
console.log(`golden reply (baseline B): clean ${gb.clean}, ${gb.result.flags.length} flags`);
if (!gb.clean) failed++;
const ms = Dd.runMutations();
for (const m of ms) { if (!m.pass) { failed++; console.log('FAIL ' + m.id, m.missing, m.unexpected); } }
console.log(`mutations ${ms.filter(m => m.pass).length}/${ms.length}`);
// Timing evidence (tester ruling, Oct 12): a dated task's quote must carry its timing phrase, not just the segment.
{
  const VV = require('../../src/modules/validator.js');
  const blocks = p => VV.validate(p, Dd.CTX_B).flags.filter(f => f.sev === 'block').map(f => `${f.code} @ ${f.ref}`);
  const n1 = p => p.ops.find(o => o.ref === 'NEW-1');
  const cut = JSON.parse(JSON.stringify(Dd.GOLDEN_B));
  if (!/this morning/.test(n1(cut).src[0].quote)) throw new Error('fixture drift: NEW-1 first quote lost "this morning"');
  n1(cut).src[0].quote = n1(cut).src[0].quote.replace(/\s*this morning\.?$/, '');
  const keep = JSON.parse(JSON.stringify(Dd.GOLDEN_B));
  n1(keep).src[0].quote = 'this morning';
  const bc = blocks(cut), bk = blocks(keep);
  const ok1 = bc.length === 1 && bc[0] === 'TIME-UNGROUNDED @ NEW-1', ok2 = bk.length === 0;
  console.log(`timing phrase cut from the quote -> ${ok1 ? 'caught' : 'MISSED'} (${bc.join(', ') || 'no blocks'})`);
  console.log(`timing phrase kept in a short quote -> ${ok2 ? 'clean' : 'FALSE BLOCK'} (${bk.join(', ') || 'no blocks'})`);
  if (!ok1) failed++; if (!ok2) failed++;
}

// Repair-prompt dependency order (D-UX10h, Oct 12): never merge and split the same tasking in one prompt.
{
  const RR = require('../../src/modules/repair.js'), VV = require('../../src/modules/validator.js');
  const fsx = require('fs'), dir = __dirname + '/data/terra-low-2026-10-12/';
  const merges = p => new Set([...p.matchAll(/(NEW-\d+) and (NEW-\d+) come from one request/g)].flatMap(m => [m[1], m[2]]));
  const splits = p => new Set([...p.matchAll(/(NEW-\d+) bundles separate deliverables|(NEW-\d+) merges commitments with different timing|(NEW-\d+) binds \d+ distinct units/g)].map(m => m[1] || m[2] || m[3]));
  const conflict = p => [...merges(p)].filter(r => splits(p).has(r));
  const cases = [...Dd.runMutations().map(m => [m.id, { flags: m.flags }]),
    ...fsx.readdirSync(dir).sort().map(f => [f, VV.validate(JSON.parse(fsx.readFileSync(dir + f, 'utf8')), Dd.CTX_B)])];
  const bad = cases.filter(([, r]) => conflict(RR.repairPrompt(r)).length);
  console.log(`repair prompts with a merge-and-split conflict: ${bad.length} of ${cases.length}${bad.length ? ' -> ' + bad.map(c => c[0]).join(', ') : ''}`);
  if (bad.length) failed++;
  const p3 = RR.repairPrompt(VV.validate(JSON.parse(fsx.readFileSync(dir + 'final3.json', 'utf8')), Dd.CTX_B));
  const ok3 = /NEW-2 bundles separate deliverables/.test(p3) && !/NEW-2 and NEW-3 come from one request/.test(p3);
  console.log(`terra-low run 3 (final reply): split kept, merge dropped -> ${ok3 ? 'yes' : 'NO'}`);
  if (!ok3) failed++;
}

// Validator hygiene (testers, 2026-10-12), checked on the testers' real D-UX10h replies. Regression controls, not feasibility evidence.
{
  const VV = require('../../src/modules/validator.js'), fsx = require('fs'), dir = __dirname + '/data/terra-low-2026-10-12/';
  const run = f => VV.validate(JSON.parse(fsx.readFileSync(dir + f, 'utf8')), Dd.CTX_B).flags.filter(x => x.sev === 'block');
  const has = (fl, code, ref, re) => fl.some(x => x.code === code && x.ref === ref && (!re || re.test(x.msg)));
  const r1 = run('dux10h-final1.json'), r2 = run('dux10h-final2.json'), r3 = run('dux10h-final3.json');
  const checks = [
    ['possessive timing: run 1 transcript task dated from "today\'s transcript"', has(r1, 'TIME-UNGROUNDED', 'NEW-4', /names the document/)],
    ['possessive timing: run 2 transcript task dated from "today\'s transcript"', has(r2, 'TIME-UNGROUNDED', 'NEW-4', /names the document/)],
    ['whole sentence: "those materials" refers back to the transcript and summaries; run 3 is not flagged for it (Aaron, 2026-10-12)', !has(r3, 'DELIVERABLE-DROPPED', 'NEW-5', /"materials"/)],
    ['whole sentence: the finding goes to the summaries task, not the transcript task', !has(r3, 'DELIVERABLE-DROPPED', 'NEW-4')],
    ['selfReview: run 3 names its sibling NEW-3 as "nearest"', has(r3, 'REF-DANGLING', 'NEW-5', /new tasking from this same reply/)],
    ['golden reply stays clean', Dd.evaluate(Dd.GOLDEN_B, 'B').clean]
  ];
  for (const [name, ok] of checks) { console.log(`${ok ? 'OK  ' : 'FAIL'} hygiene: ${name}`); if (!ok) failed++; }
  // Known gap, recorded rather than hidden: run 3's transcript task borrows "today" from the summaries sentence
  // ("get them out today"), which the possessive rule does not cover.
  console.log(`note hygiene: run 3 transcript task with borrowed "today" flagged -> ${has(r3, 'TIME-UNGROUNDED', 'NEW-4') ? 'yes' : 'no (known gap)'}`);
}

// D-UX11h candidate-question trigger (prototype for ratification). It proposes reviewer questions; it never decides.
{
  console.log('\n== D-UX11h trigger (prototype)');
  const T = require('../../src/modules/dux11-trigger.js'), VV = require('../../src/modules/validator.js'), fsx = require('fs');
  const dsegs = Dd.CTX_B.segments.map(x => ({ id: x.id, text: x.text })), dtasks = Dd.CTX_B.register.tasks.map(t => ({ id: t.id, title: t.title, status: t.status }));
  const ask = (raw, segs = dsegs, tasks = dtasks) => T.candidates({ segments: segs, tasks, ops: VV.adapt(raw).ops }).map(q => `${q.seg}>${q.task}`).sort().join(' ');
  const dir = __dirname + '/data/terra-low-2026-10-12/', rd = f => JSON.parse(fsx.readFileSync(dir + f, 'utf8'));
  // Expectation for every tester reply: ask about AI-203 exactly when no AI-203 update cites S014, and likewise AI-207.
  const expectFor = raw => { const A = VV.adapt(raw); const has = t => A.ops.some(o => o.target === t && o.cites.includes('S014'));
    return [...(has('AI-203') ? [] : ['S014>AI-203']), ...(has('AI-207') ? [] : ['S014>AI-207'])].sort().join(' '); };
  const files = fsx.readdirSync(dir).sort();
  const bad = files.filter(f => ask(rd(f)) !== expectFor(rd(f)));
  const ok = [
    ['Difficult golden (window attached to AI-203 and AI-207): no question', ask(Dd.GOLDEN_B) === ''],
    [`tester replies: asks about AI-203/AI-207 exactly when that task lacks the S014 update (${files.length - bad.length}/${files.length})`, !bad.length],
    ['unrelated schedule change (synthetic S900): no question', ask(Dd.GOLDEN_B, dsegs.concat([{ id: 'S900', text: 'The holiday luncheon moved from December third to December fifth.' }])) === '']
  ];
  // Atlas: the Oct 20-30 -> Oct 20-24 change (S003) relates to no single task ("travel" is shared by three labels);
  // the agreed Atlas golden keeps it as an open question. The trigger stays quiet on the golden and the flawed reply.
  const A_ = __dirname + '/data/atlas/';
  const asegs = fsx.readFileSync(A_ + 'mkg-transcript-atlas-2026-10-09.txt', 'utf8').split('\n').map(l => /^\[\d\d:\d\d:\d\d\] [^:]+: (.*)$/.exec(l)).filter(Boolean).map((m, i) => ({ id: 'S' + String(i + 1).padStart(3, '0'), text: m[1] }));
  const atasks = JSON.parse(fsx.readFileSync(A_ + 'mkg-workspace-atlas.json', 'utf8')).packages[0].sources.filter(x => /^R\d+$/.test(x.id)).map((x, i) => ({ id: 'AI-' + (i + 1), title: x.text.split(' — ')[0], status: /completed|done/i.test(x.text) ? 'closed' : 'open' }));
  ok.push(['Atlas: S003 is recognised as a schedule change', T.isSchedule(asegs[2].text)]);
  for (const f of ['mkg-golden-reply-atlas.json', 'mkg-flawed-reply-atlas.json']) ok.push([`Atlas ${f}: no question`, ask(JSON.parse(fsx.readFileSync(A_ + f, 'utf8')), asegs, atasks) === '']);
  for (const [name, pass] of ok) { console.log(`${pass ? 'OK  ' : 'FAIL'} trigger: ${name}`); if (!pass) failed++; }
  if (bad.length) console.log('  mismatched:', bad.map(f => `${f}: got "${ask(rd(f))}" want "${expectFor(rd(f))}"`).join('; '));
}

// D-UX11 decision model (ux11.js, ratified 2026-10-12): classes per user-mode plan §7, choices applied to the reply.
{
  console.log('\n== D-UX11 decision model');
  const U = require('../../src/modules/ux11.js'), T = require('../../src/modules/dux11-trigger.js'), VV = require('../../src/modules/validator.js'), fsx = require('fs');
  const segments = Dd.CTX_B.segments.map((x, i) => ({ id: x.id, t: '00:' + String(i).padStart(2, '0') + ':00', speakerName: x.speaker, text: x.text }));
  const tasks = Dd.CTX_B.register.tasks.filter(t => t.status !== 'closed').map(t => ({ code: t.id, label: t.title, project: t.project, status: 'open' }));
  const shim = raw => { const r = VV.validate(raw, Dd.CTX_B);
    return { errors: 0, flags: (raw.flags || []).map(f => ({ kind: f.kind, note: f.note, seg: (f.src || [])[0] })),
      rows: (raw.ops || []).map((o, i) => ({ n: i + 1, sentence: o.label || o.text || '', ev: { quote: (o.src || [])[0] && o.src[0].quote, seg: (o.src || [])[0] && o.src[0].seg } })),
      coverage: { findings: r.flags.map(f => ({ code: f.code, ref: f.ref, msg: f.msg, repair: f.sev === 'block', text: `${f.code}: ${f.msg}`, lvl: f.sev === 'block' ? 'warn' : 'info' })) } }; };
  const ctxFor = raw => ({ segments, tasks, rangeRe: T.RANGE_RE, trigger: T.candidates({ segments: segments.map(x => ({ id: x.id, text: x.text })),
    tasks: tasks.map(t => ({ id: t.code, title: t.label, status: 'open' })), ops: VV.adapt(raw).ops }) });
  const model = raw => U.classify(shim(raw), raw, ctxFor(raw));
  const checks = [];
  const g = model(Dd.GOLDEN_B);
  checks.push(['golden: no question, no blocked change, ready with no choices', !g.questions.length && !g.changes.some(c => c.blocks.length) && U.readiness(g, {}).ok]);
  const f2 = JSON.parse(fsx.readFileSync(__dirname + '/data/terra-low-2026-10-12/dux10h-final2.json', 'utf8'));
  const m2 = model(f2), ix = U.opIndexer(f2);
  const q203 = m2.questions.find(q => q.id === 'scope:AI-203');
  checks.push(['run 2: asks whether the May 18-22 window updates AI-203, quoting it', !!q203 && q203.statement.seg === 'S014' && /May eighteenth through May twenty-second/.test(q203.prompt)]);
  const n4 = ix('NEW-4')[0], n5 = ix('NEW-5')[0];
  const b4 = m2.changes.find(c => c.opIndex === n4), b5 = m2.changes.find(c => c.opIndex === n5);
  checks.push(['run 2: transcript date blocks its change with a keep-without-the-date remedy', b4.blocks.some(b => b.code === 'TIME-UNGROUNDED' && b.remedy === 'undate')]);
  checks.push(['run 2: the summaries change is not blocked for leaving out "those materials" (Aaron, 2026-10-12)', !b5.blocks.some(b => b.code === 'DELIVERABLE-DROPPED')]);
  checks.push(['run 2: D-UX11 would wait for every block and question (kept for the record)', !U.readinessUx11(m2, {}).ok]);
  checks.push(['run 2: D-UX12 needs no decision (no hard stop), so Update the board is available with no choices', U.readiness(m2, {}).ok]);
  const choices = { undate: [n4], drop: [n5], answers: Object.fromEntries(m2.questions.map(q => [q.id, q.kind === 'scope' ? 'yes' : 'defer'])) };
  checks.push(['run 2: ready once answered', U.readiness(m2, choices).ok]);
  const out = U.applyChoices(f2, m2, choices, ctxFor(f2)), out2 = U.applyChoices(f2, m2, choices, ctxFor(f2));
  checks.push(['applying the same choices twice gives the same reply', JSON.stringify(out) === JSON.stringify(out2)]);
  const conf = out.ops.find(o => o.tasking === 'AI-203' && /^Reviewer confirmed/.test(o.text));
  const s14 = Dd.CTX_B.segments.find(x => x.id === 'S014').text.replace(/[’]/g, "'");
  checks.push(['Yes: a reviewer-confirmed update on AI-203 citing S014 verbatim', !!conf && conf.src[0].seg === 'S014' && s14.includes(conf.src[0].quote) && conf.src[0].quote.split(/\s+/).length <= 25]);
  const rv = VV.validate(out, Dd.CTX_B).flags.filter(f => f.sev === 'block');
  checks.push(['after the choices, the transcript date and the dropped change raise nothing', !rv.some(f => (f.code === 'TIME-UNGROUNDED' && f.ref === 'NEW-4') || f.ref === 'NEW-5')]);
  checks.push(['the reviewer-confirmed update itself raises no blocking finding', !rv.some(f => String(f.ref).startsWith('ProgressNote:AI-203#' + out.ops.length))]);
  checks.push(['rubric row R01 (AI-203 carries the window) is clean after Yes', !Dd.evaluate(out, 'B').rows.find(r => r.id === 'R01').defect]);
  const no = U.applyChoices(f2, m2, { ...choices, answers: { ...choices.answers, 'scope:AI-203': 'no' } }, ctxFor(f2));
  checks.push(['No: no update; an open question records the decision', !no.ops.some(o => o.tasking === 'AI-203' && /^Reviewer confirmed/.test(o.text)) && no.flags.some(f => f.kind === 'schedule_context' && /not on \u201cRun a test transfer/.test(f.note))]);
  const de = U.applyChoices(f2, m2, { ...choices, answers: { ...choices.answers, 'scope:AI-203': 'defer' } }, ctxFor(f2));
  checks.push(['Defer: no update and no added flag for AI-203', !de.ops.some(o => o.tasking === 'AI-203' && /^Reviewer confirmed/.test(o.text)) && !de.flags.some(f => /AI-203/.test(f.note || '') && /Reviewer/.test(f.note || ''))]);
  // §7 classes for every code the mutations raise.
  const A = new Set(Object.keys(U.A_REASON)), B = new Set(['COV-UNRESOLVED', 'COV-POSSIBLE-MATCH', 'NEW-DUPLICATE', 'COV-DEFERRED-NEW', 'MATCH-BETTER-TARGET', 'OVER-SPLIT', 'COMMITMENT-MISCLASSIFIED', 'COV-UNBOUND-DISPOSITION', 'DISP-MISSING', 'COV-MISSING-ITEM', 'COV-CLAIM-UNSUPPORTED']);
  const wrong = [];
  for (const mu of Dd.MUTATIONS) { const p = JSON.parse(JSON.stringify(Dd.GOLDEN_B)); mu.mutate(p); const m = model(p);
    for (const [code] of mu.expect) {
      const inA = m.changes.some(c => c.blocks.some(b => b.code === code)) || m.hardStops.some(h => h.code === code), inB = m.questions.length > 0, inC = m.records.some(r => r.code === code);
      if (A.has(code) && !inA) wrong.push(`${mu.id} ${code} not blocking`); if (B.has(code) && !inB) wrong.push(`${mu.id} ${code} no question`);
      if (!A.has(code) && !B.has(code) && !inC && !inA && !inB) wrong.push(`${mu.id} ${code} lost`); } }
  checks.push([`every mutation's finding lands in its ratified class${wrong.length ? ' -> ' + wrong.join('; ') : ''}`, !wrong.length]);
  // What the choices leave behind: dropping the summaries task leaves the summaries promise in the transcript task's
  // sentence uncarried. That is the person's decision, recorded; a different new block would hold Accept.
  const after = U.consequences(m2, model(out));
  checks.push(['dropping a change: the promise it carried is recorded as a consequence, not a block',
    after.recorded.some(r => r.code === 'DELIVERABLE-DROPPED' && /transcript/i.test(r.label)) && !after.blocking.length]);
  const fake = (code) => ({ changes: [{ label: 'X', blocks: code ? [{ code, reason: 'r' }] : [] }], questions: [] });
  checks.push(['a new block of any other kind, caused by the choices, holds Accept', U.consequences(fake(null), fake('TIME-UNGROUNDED')).blocking.length === 1]);
  { const ps = JSON.parse(JSON.stringify(Dd.GOLDEN_B)); ps.ops.find(o => o.ref === 'NEW-1').label = 'Send information from the previous partner discussion, including partner-site location slides';
    checks.push(['"slides" in the label carries the promised "slide deck" (Aaron\'s test, 2026-10-12)', !VV.validate(ps, Dd.CTX_B).flags.some(f => f.code === 'DELIVERABLE-DROPPED')]); }
  // D-UX12 (ratified 2026-10-12): place, label, and move on.
  { const run = reply => { const c = shim(reply); return { comp: c, model: U.classify(c, reply, ctxFor(reply)) }; };
    const mut = id => { const p = JSON.parse(JSON.stringify(Dd.GOLDEN_B)); Dd.MUTATIONS.find(x => x.id === id).mutate(p); return p; };
    const lab = (r, kind) => U.labelsOf(r.llm).filter(f => f.kind === kind);
    const g = U.settle(Dd.GOLDEN_B, {}, run, ctxFor(Dd.GOLDEN_B));
    checks.push(['D-UX12 golden: settles with no hard stop and no labels (its unowned staging check already carries the reply\'s own ownership flag)', !g.model.replyBlocked
      && !U.labelsOf(g.llm).length && (g.llm.flags || []).some(f => f.kind === 'ownership')]);
    { const p = JSON.parse(JSON.stringify(Dd.GOLDEN_B)); p.flags = p.flags.filter(f => f.kind !== 'ownership'); const r = U.settle(p, {}, run, ctxFor(p));
      checks.push(['D-UX12: without the reply\'s ownership flag, the unowned task is labeled "No owner yet"', lab(r, 'no_owner').length >= 1]); }
    const r2 = U.settle(f2, {}, run, ctxFor(f2));
    checks.push(['D-UX12 run 2: the transcript task keeps no date and is labeled "Date unclear"', !r2.model.replyBlocked
      && !r2.llm.ops.some(o => o.ref === 'NEW-4' && o.dueDate) && lab(r2, 'date_unclear').some(f => f.about.includes('NEW-4'))]);
    checks.push(['D-UX12 run 2: the AI-203 window is a "Possible schedule update" on AI-203, not an applied update',
      lab(r2, 'possible_schedule_update').some(f => f.about.includes('AI-203')) && !r2.llm.ops.some(o => o.tasking === 'AI-203' && /^Reviewer confirmed/.test(o.text || ''))]);
    const d16 = U.settle(mut('D16'), {}, run, ctxFor(mut('D16')));
    checks.push(['D-UX12 demotion: an unsupported "completed" is not applied; it is a "Possible status change"',
      !d16.llm.ops.some(o => o.op === 'Status' && o.tasking === 'AI-205') && lab(d16, 'possible_status_change').some(f => f.about.includes('AI-205'))]);
    const d17 = U.settle(mut('D17'), {}, run, ctxFor(mut('D17')));
    checks.push(['D-UX12 demotion: an unsupported owner change is not applied; it is a "Possible owner change"',
      !d17.llm.ops.some(o => o.op === 'Reassign' && o.tasking === 'AI-206') && lab(d17, 'possible_owner_change').some(f => f.about.includes('AI-206'))]);
    const d18 = U.settle(mut('D18'), {}, run, ctxFor(mut('D18')));
    checks.push(['D-UX12 hard stop: two owners for one task in one reply stops the import', d18.model.replyBlocked && d18.model.hardStops.some(h => h.code === 'OP-CONFLICT')]);
    const d07 = U.settle(mut('D07'), {}, run, ctxFor(mut('D07')));
    checks.push(['D-UX12: invitation housekeeping is a meeting note ("Meeting administration"), not a project task',
      !d07.llm.ops.some(o => o.ref === 'NEW-6') && lab(d07, 'meeting_admin').length === 1 && !d07.model.replyBlocked]);
    const d08 = U.settle(mut('D08'), {}, run, ctxFor(mut('D08')));
    checks.push(['D-UX12: a conditional instruction is "Not a task yet" at project level', lab(d08, 'not_a_task_yet').some(f => f.about.includes('P2')) && !d08.model.replyBlocked]);
    let noStop = 0; for (const m of Dd.MUTATIONS) { const p = mut(m.id), r = U.settle(p, {}, run, ctxFor(p)); if (!r.model.replyBlocked) noStop++;
      else if (!r.model.hardStops.length) checks.push([`D-UX12 ${m.id}: blocked without a hard stop`, false]); }
    // Criterion 3: nothing unsupported is applied. After settling, no reply keeps an unsupported owner, status, date,
    // prerequisite or decision change.
    { const replies = [['golden', Dd.GOLDEN_B], ['run 2', f2], ...Dd.MUTATIONS.map(m => [m.id, mut(m.id)])];
      const left = [];
      for (const [n, p] of replies) { const r = U.settle(p, {}, run, ctxFor(p)); if (r.model.replyBlocked) continue;
        const v = VV.validate(r.llm, Dd.CTX_B).flags.filter(f => f.code === 'SUPPORT-MISSING'); if (v.length) left.push(`${n}: ${v.map(f => f.ref).join(', ')}`); }
      checks.push([`D-UX12 audit: no settled reply keeps an unsupported owner, status, date, prerequisite or decision change${left.length ? ' -> ' + left.join('; ') : ''}`, !left.length]); }
    checks.push([`D-UX12: every mutation either settles or names its hard stop (${noStop} of ${Dd.MUTATIONS.length} settle)`, true]); }
  // Aaron (2026-10-12): a new task that belongs to an existing task can be added to it as a note.
  { const p2 = JSON.parse(JSON.stringify(Dd.GOLDEN_B)); Dd.MUTATIONS.find(x => x.id === 'D02').mutate(p2);
    const md = model(p2), qd = md.questions.find(q => q.kind === 'same' && q.answers.some(a => a.value === 'attach:AI-204'));
    checks.push(['duplicate question offers "Add it to <existing task> as a note"', !!qd]);
    if (qd) { const od = U.applyChoices(p2, md, { drop: [], undate: [], answers: { [qd.id]: 'attach:AI-204' } }, ctxFor(p2));
      const note = od.ops.find(o => o.op === 'ProgressNote' && o.tasking === 'AI-204' && /^Also needed for this task: /.test(o.text));
      const vd = VV.validate(od, Dd.CTX_B).flags.filter(f => f.sev === 'block');
      checks.push(['attach: the new task is gone, its words are a note on AI-204, nothing still points at it',
        !od.ops.some(o => o.ref === 'NEW-6') && !!note && !JSON.stringify(od).includes('"NEW-6"')]);
      checks.push(['attach: the note itself raises no blocking finding', !vd.some(f => String(f.ref).includes('AI-204') || String(f.ref).includes('NEW-6')), vd.map(f => f.code + '@' + f.ref).join(' ')]); } }
  const unk = U.classify({ errors: 0, rows: [], flags: [], coverage: { findings: [{ code: 'X-NEW-CHECK', ref: 'S001', msg: 'new', text: 'new' }] } }, { ops: [] }, { segments, tasks, trigger: [] });
  checks.push(['an unclassified finding becomes a question (class B by default)', unk.questions.length === 1 && unk.questions[0].kind === 'unclassified']);
  for (const [name, ok] of checks) { console.log(`${ok ? 'OK  ' : 'FAIL'} ux11: ${name}`); if (!ok) failed++; }
}

console.log('\n== Knockout across both suites');
const all = () => [...A.runLayerA().map(r => ({ id: r.id, pass: r.pass })), ...Dd.runMutations().map(r => ({ id: r.id, pass: r.pass })),
  { id: 'TESTER', pass: Dd.evaluate(Dd.FLAWED, 'A').rows.every(x => x.tester === 'defect' ? x.defect : x.tester === 'ok' ? !x.defect : true) }];
const codes2 = [...new Set([...A.runLayerA().flatMap(r => r.flags.map(f => f.code)), ...ms.flatMap(m => m.flags.map(f => f.code)), ...fl.result.flags.map(f => f.code)])].sort();
for (const c of codes2) {
  V.validate = (p, x) => { const r = orig(p, x); r.flags = r.flags.filter(f => f.code !== c); r.blocked = r.flags.some(f => f.sev === 'block'); return r; };
  const fails = all().filter(r => !r.pass).map(r => r.id);
  if (!fails.length && !['MATCH-SCOPE-MISFIT', 'PROJ-LINK-ONLY', 'QUOTE-TRUNCATED'].includes(c)) failed++;
  console.log((fails.length ? 'caught   ' : 'untested ') + c.padEnd(26) + fails.join(' '));
}
V.validate = orig;
console.log(failed ? `\n${failed} PROBLEM(S)` : '\nALL GREEN');
process.exit(failed ? 1 : 0);
