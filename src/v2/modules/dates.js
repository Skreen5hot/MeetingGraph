/* MeetingGraph v2 — due dates (plan §10.10, B7). The reply keeps a date as said; simple phrases are resolved here
   against the meeting date, and the resolved date shows next to the phrase, for the PM to correct in the review.
   Vague phrases ("early December", "next month") resolve to null: they stay as said and never count as overdue.
   Weeks run Monday to Sunday. A bare weekday is its next occurrence after the meeting; "next Friday" is the Friday of
   next week; "end of the week" is this week's Friday; "next week" and "end of next week" are next week's Friday. */
(function (root) {
'use strict';
const WD = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth', 'eleventh', 'twelfth',
  'thirteenth', 'fourteenth', 'fifteenth', 'sixteenth', 'seventeenth', 'eighteenth', 'nineteenth', 'twentieth'];
const ordinal = w => {
  const i = ORD.indexOf(w); if (i >= 0) return i + 1;
  let m = /^twenty[- ]?(\w+)$/.exec(w); if (m) { const j = ORD.indexOf(m[1]); return j >= 0 && j < 9 ? 21 + j : null; }
  m = /^thirty[- ]?first$/.exec(w); if (m) return 31;
  return w === 'thirtieth' ? 30 : null;
};
const day = s => new Date(s + 'T12:00:00Z');
const iso = d => d.toISOString().slice(0, 10);
const plus = (d, n) => new Date(d.getTime() + n * 86400000);
const valid = (y, m, d) => { const t = new Date(Date.UTC(y, m - 1, d, 12)); return t.getUTCMonth() === m - 1 && t.getUTCDate() === d ? t : null; };

// The resolved date (YYYY-MM-DD) of a phrase said in a meeting on meetingDate, or null when it doesn't resolve.
function resolveDue(phrase, meetingDate) {
  if (!phrase || !meetingDate) return null;
  const p = String(phrase).toLowerCase().replace(/[–—]/g, '-').replace(/[.,;!?]/g, ' ').replace(/\s+/g, ' ').trim();
  const base = day(meetingDate), dow = base.getUTCDay(), monday = plus(base, -((dow + 6) % 7));
  if (/\b(early|mid|late|beginning|around|sometime|roughly|approximately|asap|soon)\b/.test(p)) return null;
  if (/\b(today|tonight|end of (the )?day|eod)\b/.test(p)) return iso(base);
  if (/\btomorrow\b/.test(p)) return iso(plus(base, 1));
  if (/\b(end of )?next week\b/.test(p)) return iso(plus(monday, 11));
  if (/\b(end of (the |this )?week|this week)\b/.test(p)) { const f = plus(monday, 4); return iso(f < base ? plus(f, 7) : f); }
  if (/\bend of (the |this )?month\b/.test(p)) return iso(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0, 12)));
  let m = /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/.exec(p);
  if (m) { const t = valid(+m[1], +m[2], +m[3]); return t ? iso(t) : null; }
  // A month and a day, either way round: "November 6", "Nov 6th", "the 6th of November", "November sixth".
  const yearFor = (mo, d) => { let t = valid(base.getUTCFullYear(), mo, d); if (t && t < plus(base, -60)) t = valid(base.getUTCFullYear() + 1, mo, d); return t; };
  const mon = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*';
  const num = '(\\d{1,2})(?:st|nd|rd|th)?|([a-z]+(?:[- ][a-z]+)?)';
  m = new RegExp(`\\b${mon} (?:the )?(?:${num})\\b`).exec(p);
  if (m) { const d = m[2] ? +m[2] : ordinal(m[3]) || ordinal(m[3].split(/[- ]/)[0]); if (d) { const t = yearFor(MON[m[1]], d); if (t) return iso(t); } }
  m = new RegExp(`\\b(?:the )?(?:(\\d{1,2})(?:st|nd|rd|th)?|([a-z]+)) of ${mon}\\b`).exec(p);
  if (m) { const d = m[1] ? +m[1] : ordinal(m[2]); if (d) { const t = yearFor(MON[m[3]], d); if (t) return iso(t); } }
  m = /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(p);
  if (m) { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null; const t = y ? valid(y, +m[1], +m[2]) : yearFor(+m[1], +m[2]); return t ? iso(t) : null; }
  m = new RegExp(`\\b(next |this )?(${WD.join('|')})\\b`).exec(p);
  if (m) {
    const w = WD.indexOf(m[2]);
    if (m[1] === 'next ') return iso(plus(monday, 7 + (w + 6) % 7));
    if (m[1] === 'this ') { const t = plus(monday, (w + 6) % 7); return iso(t < base ? plus(t, 7) : t); }
    let k = (w - dow + 7) % 7; if (k === 0) k = 7;
    return iso(plus(base, k));
  }
  return null;
}

// Days late on asOf (YYYY-MM-DD), or 0: only a resolved date can be overdue.
const daysLate = (dueDate, asOf) => !dueDate || !asOf ? 0 : Math.max(0, Math.round((day(asOf) - day(dueDate)) / 86400000));

const api = { resolveDue, daysLate };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_dates = api;
})(this);
