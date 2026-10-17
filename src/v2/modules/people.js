/* MeetingGraph v2 — people (plan §10.5, B10): matched locally to Teams speaker labels, with no change to the request.
   The people list is built from the saved packages: each seed's people (name and Teams name), each meeting's speaker
   labels, and the review's answers (aliases). A `who` that is a known label is that person. A new label, or a `who` that
   isn't a speaker label, is asked once in the review ("Is this Pete Kowalski?": the same person / a new person / no
   owner), with the closest known person suggested but not ticked; the answer is saved as an alias and reused. */
(function (root) {
'use strict';
const S = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.MKG2_store;
// "Kowalski, Pete (Guest)" and "+1 555 010 2233" are labels Teams writes; their name part is what matches.
const clean = l => String(l || '').replace(/\([^)]*\)/g, ' ').replace(/\+?\d[\d\s().-]{5,}\d/g, ' ').replace(/\s+/g, ' ').trim();
const tokens = l => clean(l).toLowerCase().split(/[\s,]+/).filter(t => t.length >= 2);

/* { byLabel: Map(label -> name, or null for "no owner"), names: [name...] } from the packages in use. */
function peopleOf(pkgs) {
  const byLabel = new Map(), names = [];
  const add = (label, name) => { if (!label) return; byLabel.set(label, name); if (name && !names.includes(name)) names.push(name); };
  const used = S.current(pkgs).used;
  for (const p of used) if (p.kind === 'seed') for (const x of p.people || []) { add(x.name, x.name); if (x.teams) add(x.teams, x.name); }
  for (const p of used) if (p.kind === 'meeting') for (const s of p.statements || []) if (!byLabel.has(s.speaker)) add(s.speaker, S.displayName(s.speaker));
  for (const p of used) if (p.kind === 'meeting') for (const a of p.aliases || []) add(a.label, a.person);
  return { byLabel, names };
}
// { known, name }: a label the board knows, and the person it is (null for "no owner").
const resolve = (label, people) => people.byLabel.has(label) ? { known: true, name: people.byLabel.get(label) } : { known: false, name: null };

// The closest known person: the most name words in common (a shared surname counts double). null if nothing is shared.
function suggest(label, people) {
  const t = tokens(label); if (!t.length) return null;
  let best = null, score = 0;
  for (const name of people.names) {
    const n = tokens(name), last = n[n.length - 1];
    const s = t.filter(x => n.includes(x)).length + (t.includes(last) ? 1 : 0);
    if (s > score) { best = name; score = s; }
  }
  return best;
}

/* The questions for the review: one per distinct `who` the board doesn't know, except a speaker of this meeting with no
   look-alike (a new person in their own meeting needs no question). Each with its suggestion. */
function questions(items, speakers, people) {
  const out = [], seen = new Set();
  for (const it of items) {
    const label = it.who; if (!label || seen.has(label)) continue; seen.add(label);
    if (resolve(label, people).known) continue;
    const sug = suggest(label, people);
    if (speakers.includes(label) && !sug) continue;
    out.push({ label, suggestion: sug, speaker: speakers.includes(label) });
  }
  return out;
}

/* The people register for the export (§10.30): each person with every label that means them, and where the label's
   meaning came from (the spreadsheet, a meeting's speaker label, or a review's answer, which wins as in peopleOf), and
   the labels answered "No owner". No email addresses. */
function register(pkgs) {
  const pp = peopleOf(pkgs), used = S.current(pkgs).used, from = new Map();
  for (const p of used) if (p.kind === 'meeting') for (const s of p.statements || []) if (!from.has(s.speaker)) from.set(s.speaker, 'speaker');
  for (const p of used) if (p.kind === 'seed') for (const x of p.people || []) { from.set(x.name, 'spreadsheet'); if (x.teams) from.set(x.teams, 'spreadsheet'); }
  for (const p of used) if (p.kind === 'meeting') for (const a of p.aliases || []) from.set(a.label, 'review');
  const labels = [...pp.byLabel].map(([label, person]) => ({ label, person, from: from.get(label) || 'speaker' }));
  return { people: pp.names.map(name => ({ name, labels: labels.filter(l => l.person === name).map(l => ({ label: l.label, from: l.from })) })),
           noOwner: labels.filter(l => l.person === null).map(l => ({ label: l.label, from: l.from })) };
}

const api = { peopleOf, resolve, suggest, questions, clean, register };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_people = api;
})(this);
