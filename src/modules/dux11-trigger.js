/* D-UX11h candidate-question trigger (prototype for ratification, 2026-10-12). Not part of the gate.
 * Testers' rule: when a transcript segment states a material schedule, date-range, readiness, travel or
 * operational-window change, and no proposed or accepted update cites that segment for a plausibly related active
 * task, create a reviewer question naming the candidate task and the source statement. The trigger never decides
 * scope; it only makes sure the question is asked when the extractor omitted or misfiled the update.
 *
 * Input: { segments: [{id, speaker, text}], tasks: [{id, title, status}], ops: [{kind|op, target|tasking, src|cites}] }
 * Output: [{ seg, task, statement, question }]
 */
(function (root) {
'use strict';
const MONTH = '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const ORD_WORD = '(?:(?:twenty|thirty)[- ])?(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth|thirteenth|fourteenth|fifteenth|sixteenth|seventeenth|eighteenth|nineteenth|twentieth|thirtieth)';
const DAY = `(?:\\d{1,2}(?:st|nd|rd|th)?|${ORD_WORD})`;
// A date range: "May eighteenth through May twenty-second", "October 20 through October 30", "May 18-22".
const RANGE_RE = new RegExp(`\\b${MONTH}\\s+${DAY}\\s*(?:through|thru|to|until|-|–)\\s*(?:${MONTH}\\s+)?${DAY}\\b`, 'i');
// A material change: a date range, or a change word next to a date. A dated mention alone ("ready on the eighteenth",
// "arrive on the seventeenth") is not a change; the extractor's own updates carry those.
const DAY_RE = new RegExp(`\\b(?:${MONTH}\\s+${DAY}|the\\s+${ORD_WORD})\\b`, 'i');
const CHANGE_RE = /\b(?:changed|moved|pushed|narrowed|shifted|rescheduled|postponed|delayed|brought forward|instead of|now (?:being )?(?:described|expected|planned|scheduled))\b/i;
const isSchedule = t => RANGE_RE.test(t) || (DAY_RE.test(t) && CHANGE_RE.test(t));

const STOP = new Set(('a an the and or of to for in on at by with from into onto this that these those is are was were be been being it its we our us you your they their them he she his her i me my ' +
  'will would can could may might must should need needs have has had do does did not no yes so if then than but as about over under up out just also still more most some any all each every ' +
  'what which who whom when where why how there here now today tomorrow yesterday morning week day days').split(' '));
const tokens = s => new Set(String(s || '').toLowerCase().replace(/[’']s\b/g, '').split(/[^a-z]+/)
  .filter(w => w.length > 3 && !STOP.has(w)).map(w => w.replace(/(?:ies)$/, 'y').replace(/(?<!s)s$/, '')));

function candidates({ segments, tasks, ops }) {
  const active = tasks.filter(t => !/^(closed|completed|done)$/i.test(t.status || ''));
  const target = o => o.target || o.tasking || o.about;
  const cites = o => (o.cites || (o.src || []).map(s => typeof s === 'string' ? s : s.seg));
  const isUpdate = o => ['ProgressNote', 'Reassign', 'StatusChange', 'Status', 'Deadline', 'PrerequisiteAdd', 'DeliverableSpec', 'Discussed'].includes(o.kind || o.op);
  // A word shared by many active task labels ("transfer" in a transfer project) says little; weight by rarity.
  const df = new Map();
  for (const t of active) for (const w of tokens(t.title)) df.set(w, (df.get(w) || 0) + 1);
  const out = [];
  segments.forEach((seg, i) => {
    if (!isSchedule(seg.text)) return;
    // The change statement and the discussion right around it (one segment before, three after).
    const ctxText = segments.slice(Math.max(0, i - 1), i + 4).map(x => x.text).join(' ');
    const st = tokens(ctxText), own = tokens(seg.text);
    // Related: the statement itself shares a word with the task label, and the discussion around it shares enough to
    // tell this task apart (score >= 1: one word no other active label uses, or several common ones).
    const related = active.map(t => { const tt = [...tokens(t.title)]; const shared = tt.filter(w => st.has(w));
      return { t, shared, own: tt.some(w => own.has(w)), score: shared.reduce((a, w) => a + 1 / df.get(w), 0) }; })
      .filter(r => r.own && r.score >= 1);
    const isAttached = r => ops.some(o => isUpdate(o) && target(o) === r.t.id && cites(o).includes(seg.id));
    for (const r of related) {
      if (isAttached(r)) continue;
      out.push({ seg: seg.id, task: r.t.id, shared: r.shared, score: Math.round(r.score * 100) / 100, statement: seg.text,
        question: `The meeting said: "${seg.text.trim()}" Should this update "${r.t.title}"?` });
    }
  });
  return out;
}

const api = { candidates, isSchedule, tokens, RANGE_RE };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGDux11Trigger = api;
})(typeof window !== 'undefined' ? window : globalThis);
