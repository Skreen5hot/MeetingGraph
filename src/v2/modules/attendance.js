/* MeetingGraph v2 — the Teams attendance report (UX B1, optional). v1's reader, kept as it was: the report is a
   UTF-16 tab-separated CSV in three sections ("1. Summary", "2. Participants", "3. In-Meeting Activities"); a UTF-8 or
   comma-separated copy also reads. Read locally: no chat request. Each participant is matched to the people register
   where it can be; an unmatched name is listed and never blocks the meeting. */
(function (root) {
'use strict';
const node = typeof module !== 'undefined' && module.exports;
const S = node ? require('./store.js') : root.MKG2_store;

// An ArrayBuffer of the file: { text } or { error: 'xlsx' } for a real Excel workbook.
function decode(buf) {
  const b = new Uint8Array(buf);
  if (b.length > 1 && b[0] === 0x50 && b[1] === 0x4B) return { error: 'xlsx' };
  let enc = 'utf-8';
  if (b.length > 1 && b[0] === 0xFF && b[1] === 0xFE) enc = 'utf-16le';
  else if (b.length > 1 && b[0] === 0xFE && b[1] === 0xFF) enc = 'utf-16be';
  else { let nul = 0; for (let i = 0; i < Math.min(b.length, 400); i++) if (b[i] === 0) nul++; if (nul > 20) enc = 'utf-16le'; }
  try { return { text: new TextDecoder(enc).decode(buf) }; } catch (e) { return { text: new TextDecoder().decode(buf) }; }
}

// The report's text: { title, start, end, duration, participants: [{ name, role, join, leave, duration }], warnings }.
function parse(text) {
  const raw = String(text).replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const delim = raw.includes('\t') ? '\t' : ',';
  const datePart = c => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(c);
  const timePart = c => /^\d{1,2}:\d{2}(:\d{2})?\s*(AM|PM)?$/i.test(c);
  const dateTime = c => /^\d{1,2}\/\d{1,2}\/\d{2,4},?\s+\d{1,2}:\d{2}/.test(c || '');
  const splitLine = line => {   // quote-aware split on the delimiter
    const out = []; let f = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) { if (ch === '"') { if (line[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += ch; continue; }
      if (ch === '"' && f.trim() === '') { q = true; f = ''; continue; }
      if (ch === delim) { out.push(f); f = ''; continue; }
      f += ch;
    }
    out.push(f); return out.map(c => c.trim());
  };
  // A date cell then a time cell is one timestamp an unquoted comma split in two.
  const mergeDT = cells => { const out = [...cells]; for (let i = 0; i < out.length - 1; i++) if (datePart(out[i]) && timePart(out[i + 1])) out.splice(i, 2, out[i] + ', ' + out[i + 1]); return out; };
  const rows = raw.split('\n').map(l => mergeDT(splitLine(l)));
  const secIdx = re => rows.findIndex(r => re.test(r[0] || ''));
  const iSum = secIdx(/^1\.?\s*Summary/i), iPart = secIdx(/^2\.?\s*Participants/i), iAct = secIdx(/^3\.?\s*In-?Meeting Activities/i);
  const sum = {}, out = { title: null, start: null, end: null, duration: null, participants: [], warnings: [] };
  if (iSum >= 0) for (let k = iSum + 1; k < (iPart >= 0 ? iPart : rows.length); k++) { const r = rows[k]; if (r[0] && r.length > 1) sum[r[0]] = r.slice(1).filter(x => x).join(', '); }
  out.title = sum['Meeting title'] || sum.Title || null; out.start = sum['Start time'] || null; out.end = sum['End time'] || null; out.duration = sum['Meeting duration'] || null;
  if (iPart < 0) { out.warnings.push('No "2. Participants" section was found: is this a Teams attendance report?'); return out; }
  const stop = iAct >= 0 ? iAct : rows.length;
  let h = -1;
  for (let k = iPart + 1; k < stop; k++) { const low = rows[k].map(c => c.toLowerCase()); if (low.length >= 3 && low.some(c => c === 'name' || c === 'full name')) { h = k; break; } }
  if (h < 0) { out.warnings.push('The participants header row was not found.'); return out; }
  const low = rows[h].map(c => c.toLowerCase());
  const col = (...names) => { for (const n of names) { const i = low.findIndex(c => c && (c === n || c.startsWith(n) || (c.length >= 4 && n.startsWith(c)))); if (i >= 0) return i; } return -1; };
  const cn = col('name', 'full name'), cj = col('first join', 'join time', 'join'), cl = col('last leave', 'leave time', 'leave'), cd = col('in-meeting duration', 'duration'), cr = col('role');
  for (let k = h + 1; k < stop; k++) {
    let r = rows[k]; if (!r.some(x => x)) continue;
    // Unquoted "Last, First" names split into extra cells before the join time: merge until the join cell is a time.
    if (cn >= 0 && cj > cn) { let guard = 0; while (r.length > cj + 1 && !dateTime(r[cj]) && r.slice(cj + 1).some(dateTime) && guard++ < 4) { r = [...r]; r.splice(cn, 2, r[cn] + ', ' + r[cn + 1]); } }
    if (!r[cn]) continue;
    out.participants.push({ name: r[cn], role: cr >= 0 ? r[cr] || '' : '', join: cj >= 0 ? r[cj] || '' : '', leave: cl >= 0 ? r[cl] || '' : '', duration: cd >= 0 ? r[cd] || '' : '' });
  }
  if (!out.participants.length) out.warnings.push('The participants table is empty.');
  return out;
}

/* Each participant matched to the people register (people: peopleOf(pkgs); speakers: this meeting's speaker labels):
   the register's label as written, else the same display name ("Okafor, Grace" is Grace Okafor), else a speaker of this
   meeting. person is null when nothing matches. */
function match(att, people, speakers) {
  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const byName = new Map((people.names || []).map(n => [norm(n), n]));
  const spk = new Map((speakers || []).map(l => [norm(S.displayName(l)), S.displayName(l)]));
  return (att.participants || []).map(p => {
    const lab = people.byLabel && people.byLabel.get(p.name);
    const dn = norm(S.displayName(p.name));
    const person = lab || byName.get(dn) || byName.get(norm(p.name)) || spk.get(dn) || null;
    return Object.assign({}, p, { person });
  });
}

// What a saved meeting keeps (no email addresses): the report's times and each participant with the person matched.
function forPackage(att, people, speakers) {
  return { title: att.title || null, start: att.start || null, end: att.end || null, duration: att.duration || null,
    participants: match(att, people, speakers).map(p => ({ name: p.name, person: p.person, role: p.role, join: p.join, leave: p.leave, duration: p.duration })) };
}

const api = { decode, parse, match, forPackage };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_attendance = api;
})(this);
