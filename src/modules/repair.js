/* Repair prompt for the D-UX10 repair loop (ratified 2026-10-11). Shared verbatim by the test harness and MeetingGraph.html.
 * Groups repair-required findings by kind, orders them by the testers' priorities, prunes findings on ops another finding removes.
 */
(function (root) {
'use strict';
const clsWord = m => ({ open_question: 'open question', status_update: 'status update', commitment: 'commitment', decision: 'decision' }[(/\((\w+)\)/.exec(m) || [])[1]] || 'substantive');
const list = xs => xs.length <= 2 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
const GROUP = {
  'COV-UNRESOLVED': fs => fs.map(f => `${f.ref} is left as a possible match. Decide it: if the cited discussion concerns ${f.ref}, record it as updates to ${f.ref} (ProgressNote, Reassign or Deadline on ${f.ref}) and mark it updated; if not, mark it not_discussed with a one-line reason.`),
  'COV-DEFERRED-NEW': fs => fs.map(f => `${f.msg[0].toUpperCase()}${f.msg.slice(1)}. Record that work as updates to ${f.ref} unless it is genuinely separate work with its own completion condition.`),
  'NEW-DUPLICATE': fs => fs.map(f => `${f.msg}. Prefer a ProgressNote, Reassign or Deadline on the existing tasking. Keep the new tasking only if it has its own completion condition, and then give it a selfReview.newVsExisting row that names the existing tasking and says why this is separate.`),
  'ADMIN-IN-PROJECT': fs => [`${list(fs.map(f => f.ref))} ${fs.length > 1 ? 'are' : 'is'} meeting or invitation administration, not project work. Remove ${fs.length > 1 ? 'these taskings' : 'this tasking'}, classify ${fs.length > 1 ? 'their' : 'its'} segments "administrative" with a short note, and add one "unmatched" flag with about: [] that summarises ${fs.length > 1 ? 'them' : 'it'}.`],
  // D-UX12 (ratified 2026-10-12).
  'OP-CONFLICT': fs => fs.map(f => `${f.msg}. Keep only the change the transcript states; remove the other.`),
  'SUPPORT-MISSING': fs => fs.map(f => `${f.msg}. Cite the statement that makes this exact change, or remove the op and record the point as an implied_change flag (dates, owners) or an open_question flag.`),
  'CONDITIONAL-TASKING': fs => [`${list(fs.map(f => f.ref))} turn${fs.length > 1 ? '' : 's'} a conditional instruction ("if X happens, do Y") into an unowned tasking. Remove ${fs.length > 1 ? 'them' : 'it'} and carry the instruction in the relevant open_question flag or ProgressNote.`],
  'OVER-SPLIT': fs => fs.map(f => `${f.ref.replace('+', ' and ')} come from one request by one owner. Merge them into one tasking whose label states the single completion condition, unless each can be completed on its own.`),
  'CONTINGENCY-DROPPED': fs => fs.map(f => `${f.msg}. Put the fallback into the label itself (for example "... and identify an alternate location if needed").`),
  'DELIVERABLE-DROPPED': fs => fs.map(f => `${f.msg}. Name every deliverable the speaker committed to in the label.`),
  'DISP-ABOUT-PROJECT': fs => [`Segments ${list(fs.map(f => f.ref))} are classified "discussion of a register item" but name only a project. For each, name the tasking it discusses (an existing tasking ID or a NEW- ref) and make sure an op or flag on that tasking cites it; if it discusses no tasking, reclassify it.`],
  'COV-UNBOUND-DISPOSITION': fs => [`Segments ${list(fs.map(f => `${f.ref} (${clsWord(f.msg)})`))} are cited by no op or flag. Cite each from the op or flag it belongs to, or add a one-line note to its disposition saying why no output is needed.`],
  'COV-MISSING-ITEM': fs => [`Register item${fs.length > 1 ? 's' : ''} ${list(fs.map(f => f.ref))} ${fs.length > 1 ? 'are' : 'is'} open in a covered project but ${fs.length > 1 ? 'have' : 'has'} no row in the register table. Add one row each (updated / discussed_no_register_change / not_discussed / possible_match_requires_review) with its supporting segments.`],
  'COV-CLAIM-UNSUPPORTED': fs => fs.map(f => `${f.msg}. Either add the op that updates ${f.ref} or correct its coverage value.`),
  'COV-POSSIBLE-MATCH': fs => fs.map(f => `${f.msg}.`),
  'COV-CONTRADICTION': fs => fs.map(f => `${f.msg}; make the register row and the segment table agree.`),
  'COMMITMENT-MISCLASSIFIED': fs => [`Segments ${list(fs.map(f => f.ref))} contain a first-person commitment ("I will ...", "I need to check ...") but are not classified as commitment. Classify each as commitment and record it: a NewTasking owned by the speaker, or a Reassign/Deadline on the existing tasking whose scope it fits. One sentence may hold several commitments; give each its own disposition.`],
  'TIMING-MERGED': fs => fs.map(f => `${f.msg}.`),
  'DELIVERABLES-MERGED': fs => fs.map(f => `${f.msg}. One sentence can carry several commitments; each deliverable is its own tasking.`),
  'TASK-NO-ACCEPTANCE': fs => fs.map(f => /commitment by/.test(f.msg)
    ? `${f.msg}. A tasking's owner must be the person who committed or accepted; otherwise leave it unassigned with an ownership flag.`
    : `${f.ref} rests on no request, commitment, decision or open question in the transcript. Remove it; if the point matters, record it as a suggestion or open_question flag instead.`),
  'SELF-REVIEW-MISSING': () => ['Add a selfReview object: newVsExisting with one row per NewTasking {ref, nearest (the closest existing tasking ID, or null), whyNew (one sentence)}.'],
  'SELF-REVIEW-INCOMPLETE': fs => [`${list(fs.map(f => f.ref))}: give each NewTasking a selfReview.newVsExisting row with nearest and a one-sentence whyNew.`]
};
const ORDER = ['OP-CONFLICT', 'COMMITMENT-MISCLASSIFIED', 'COV-UNRESOLVED', 'COV-DEFERRED-NEW', 'NEW-DUPLICATE', 'ADMIN-IN-PROJECT', 'CONDITIONAL-TASKING', 'OVER-SPLIT', 'TIMING-MERGED', 'DELIVERABLES-MERGED', 'CONTINGENCY-DROPPED', 'DELIVERABLE-DROPPED', 'DISP-ABOUT-PROJECT', 'COV-MISSING-ITEM', 'COV-CLAIM-UNSUPPORTED', 'COV-POSSIBLE-MATCH', 'COV-CONTRADICTION', 'COV-UNBOUND-DISPOSITION', 'TASK-NO-ACCEPTANCE', 'SUPPORT-MISSING', 'SELF-REVIEW-MISSING', 'SELF-REVIEW-INCOMPLETE'];
const REMOVERS = ['ADMIN-IN-PROJECT', 'CONDITIONAL-TASKING'];
const ADVISORY_IN_PROMPT = ['QUOTE-TRUNCATED', 'DELIVERABLE-DROPPED'];
// Dependency order (D-UX10h, ratified by the testers 2026-10-12). A repair prompt must never ask to merge a tasking
// and to split it in the same round. Resolve in tiers: (1) existing-vs-new classification, (2) decomposition of
// taskings that survive as new, (3) labels, timing, evidence and scope. A finding in an earlier tier that removes or
// converts an op defers every later-tier finding on that op to the next round.
const CLASSIFY = ['COMMITMENT-MISCLASSIFIED', 'COV-UNRESOLVED', 'COV-DEFERRED-NEW', 'NEW-DUPLICATE', 'ADMIN-IN-PROJECT', 'CONDITIONAL-TASKING', 'TASK-NO-ACCEPTANCE', 'MATCH-BETTER-TARGET'];
const DECOMPOSE = ['OVER-SPLIT', 'TIMING-MERGED', 'DELIVERABLES-MERGED', 'DECOMP-MERGED'];
const SPLITTERS = ['TIMING-MERGED', 'DELIVERABLES-MERGED', 'DECOMP-MERGED'];
const tier = c => CLASSIFY.includes(c) ? 1 : DECOMPOSE.includes(c) ? 2 : 3;
const refsOf = f => String(f.ref).split('+');
// Findings: {code, ref, msg}. Repair-required ones become MUST FIX lines; findings on an op that another finding removes are dropped.
function removedRefs(repairFs) { return new Set(repairFs.filter(f => REMOVERS.includes(f.code)).map(f => f.ref)); }
function keepFor(removed) { return f => REMOVERS.includes(f.code) || !refsOf(f).some(r => removed.has(r)); }
// Refs whose later-tier findings wait: ops under a classification finding, then ops under a surviving decomposition finding.
function deferral(repairFs) {
  const t1 = new Set(repairFs.filter(f => tier(f.code) === 1).flatMap(refsOf));
  const decomp = repairFs.filter(f => tier(f.code) === 2 && !refsOf(f).some(r => t1.has(r)));
  // Within decomposition, a concrete split (named deliverables or deadlines) beats OVER-SPLIT's shared-subject heuristic.
  const splitRefs = new Set(decomp.filter(f => SPLITTERS.includes(f.code)).flatMap(refsOf));
  const dropMerge = f => f.code === 'OVER-SPLIT' && refsOf(f).some(r => splitRefs.has(r));
  const t2 = new Set(decomp.filter(f => !dropMerge(f)).flatMap(refsOf));
  return f => tier(f.code) === 1 ? true
    : tier(f.code) === 2 ? !refsOf(f).some(r => t1.has(r)) && !dropMerge(f)
    : !refsOf(f).some(r => t1.has(r) || t2.has(r));
}
function repairLines(repairFs) {
  const kept = repairFs.filter(keepFor(removedRefs(repairFs))).filter(deferral(repairFs));
  const byCode = new Map();
  for (const f of kept) { if (!byCode.has(f.code)) byCode.set(f.code, []); byCode.get(f.code).push(f); }
  const rank = c => (ORDER.indexOf(c) < 0 ? 99 : ORDER.indexOf(c));
  const out = [];
  for (const c of [...byCode.keys()].sort((a, b) => rank(a) - rank(b))) for (const line of (GROUP[c] ? GROUP[c](byCode.get(c)) : byCode.get(c).map(f => f.msg))) out.push(line);
  return out;
}
function alsoLines(advisoryFs, repairFs) {
  return advisoryFs.filter(f => ADVISORY_IN_PROMPT.includes(f.code)).filter(keepFor(removedRefs(repairFs))).filter(deferral(repairFs))
    .map(f => `${f.msg}. Make the label or note cover everything that sentence commits to (quotes stay within 25 words; quote the part that carries the commitment).`);
}
const HEADER = [
  'The workbench checked your reply against the transcript and the register and found the problems below.',
  'Fix only these. Keep every other op, flag, disposition and register row as it is.',
  'Return the complete corrected reply in the same format: every operation again (not just the fixed ones), in one JSON block that includes context, segments, register and selfReview.'
];
function compose(must, also) {
  // Advisory findings alone are review aids for the person at Accept, not a reason for a repair round
  // (2026-10-11 Atlas regression: a clean golden drew an empty MUST FIX list).
  if (!must.length) return '';
  return [...HEADER, '', 'MUST FIX:', ...must.map((l, i) => `${i + 1}. ${l}`), ...(also.length ? ['', 'ALSO CHECK:', ...also.map(l => `- ${l}`)] : [])].join('\n');
}
// Harness entry point: a validator result.
function repairPrompt(result) {
  const rep = result.flags.filter(f => f.sev === 'block'), adv = result.flags.filter(f => f.sev === 'warn');
  return compose(repairLines(rep), alsoLines(adv, rep));
}


const api = { repairLines, alsoLines, compose, repairPrompt, ORDER };
if (typeof module !== 'undefined' && module.exports) module.exports = api;
root.MGRepair = api;
})(typeof window !== 'undefined' ? window : globalThis);
