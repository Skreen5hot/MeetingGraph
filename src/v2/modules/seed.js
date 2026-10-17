/* MeetingGraph v2 — starting a board from one CSV (plan §10.14; B4, B17, B18, B19; ratified 2026-10-15).
   Columns: Type, Project, Title, Owner, Email, Teams name, Due, Status, Waiting on, Notes (any order, any case).
   One row per project, person, action, question, risk or decision. No IDs in the file: every ID is minted at import.
   Nothing stops the import except a file with no Type column; every other problem is per row (the §10.14 table). */
(function (root) {
'use strict';
const S = (typeof module !== 'undefined' && module.exports) ? require('./store.js') : root.MKG2_store;
const TYPES ={ project: 'project', person: 'person', action: 'action', question: 'question', risk: 'risk', decision: 'decision' };
const KIND = { action: 'commitment', question: 'question', risk: 'risk', decision: 'decision' };
const STATUS = { '': 'open', open: 'open', 'in progress': 'in_progress', in_progress: 'in_progress', blocked: 'blocked', done: 'done', closed: 'done', complete: 'done', completed: 'done' };
const key = s => String(s == null ? '' : s).trim().replace(/\s+/g, ' ').toLowerCase();

// CSV as Excel writes it: an optional BOM, commas or semicolons, quoted fields with "" for a quote, CRLF or LF.
function parseCsv(text) {
  let s = String(text).replace(/^﻿/, '');
  const first = s.split(/\r?\n/, 1)[0];
  const delim = (first.split(';').length > first.split(',').length) ? ';' : ',';
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; continue; }
    if (c === '"') q = true;
    else if (c === delim) { row.push(f); f = ''; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && s[i + 1] === '\n') i++; row.push(f); rows.push(row); row = []; f = ''; }
    else f += c;
  }
  if (f !== '' || row.length) { row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => String(x).trim() !== ''));
}

// A date as 2026-11-06, or Excel's US 11/6/2026: the ISO date; anything else is kept as said (null here).
function isoDate(s) {
  const t = String(s || '').trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (!m) { m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); if (m) m = [m[0], m[3], m[1], m[2]]; }
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/* The file, checked. Returns { stop } or { projects, people, items, problems }. Row numbers count the header as row 1,
   as Excel shows them. */
function readSeed(text) {
  const rows = parseCsv(text);
  if (!rows.length) return { stop: 'The file is empty.' };
  const head = rows[0].map(key);
  const col = n => head.indexOf(n);
  if (col('type') < 0) return { stop: 'This file has no "Type" column. Start from mkg2-seed-template.csv.' };
  const get = (r, n) => { const i = col(n); return i < 0 ? '' : String(r[i] == null ? '' : r[i]).trim(); };
  const projects = [], people = [], items = [], problems = [];
  const prob = (row, msg) => problems.push({ row, msg });
  rows.slice(1).forEach((r, i) => {
    const row = i + 2, type = TYPES[key(get(r, 'type'))];
    if (!type) return prob(row, `Type "${get(r, 'type')}" is not one of Project, Person, Action, Question, Risk, Decision; the row is skipped.`);
    if (type === 'project') {
      const name = get(r, 'project') || get(r, 'title');
      if (!name) return prob(row, 'A Project row with no project name; skipped.');
      if (projects.some(p => key(p.name) === key(name))) return prob(row, `The project "${name}" is listed twice; the second row is skipped.`);
      projects.push({ name, notes: get(r, 'notes') }); return;
    }
    if (type === 'person') {
      const name = get(r, 'title');
      if (!name) return prob(row, 'A Person row with no name in Title; skipped.');
      const email = get(r, 'email');
      if (!email) prob(row, `${name} has no email; kept, and matched by name and Teams name only.`);
      people.push({ name, email: email || null, teams: get(r, 'teams name') || null, notes: get(r, 'notes') }); return;
    }
    const title = get(r, 'title');
    if (!title) return prob(row, `A ${type} row with no Title; skipped.`);
    items.push({ row, type, kind: KIND[type], projectName: get(r, 'project'), title, owner: get(r, 'owner') || null, due: get(r, 'due') || null,
                 status: get(r, 'status'), waitingOn: get(r, 'waiting on') || null, notes: get(r, 'notes') });
  });
  const pk = new Map(projects.map(p => [key(p.name), p]));
  const kept = [];
  for (const it of items) {
    if (!it.projectName) { prob(it.row, `"${it.title}" names no project; skipped.`); continue; }
    const proj = pk.get(key(it.projectName));
    if (!proj) { prob(it.row, `"${it.title}" names the project "${it.projectName}", which has no Project row; skipped.`); continue; }
    it.projectName = proj ? proj.name : it.projectName;
    if (it.type === 'decision') { it.status = 'decided'; it.decidedOn = isoDate(it.due); it.due = null; }
    else {
      const st = STATUS[key(it.status)];
      if (!st || (st === 'in_progress' || st === 'blocked') && it.type !== 'action') {
        prob(it.row, `Status "${it.status}" is not recognised for a ${it.type}; it is Open.`); it.status = 'open';
      } else it.status = st;
      it.dueDate = isoDate(it.due);
    }
    if (it.owner) {
      const hit = people.filter(p => key(p.name) === key(it.owner) || (p.teams && key(p.teams) === key(it.owner)));
      if (hit.length === 1) { it.person = hit[0]; }
      else prob(it.row, hit.length ? `The owner "${it.owner}" matches ${hit.length} Person rows; kept as written.` : `The owner "${it.owner}" has no Person row; kept as written.`);
    }
    kept.push(it);
  }
  // "Waiting on" names another row by its Title, which must be unique in the file.
  for (const it of kept) {
    if (!it.waitingOn) continue;
    const hit = kept.filter(x => x !== it && key(x.title) === key(it.waitingOn));
    if (hit.length === 1) it.waitsOnRow = hit[0].row;
    else { prob(it.row, hit.length ? `"Waiting on" names a Title that ${hit.length} rows share; dropped.` : `"Waiting on" names "${it.waitingOn}", which is not a Title in the file; dropped.`); }
  }
  return { projects, people, items: kept, problems };
}

/* The seed package (kind "seed"), replayed like a meeting dated "Board as of". codes: project name -> code.
   IDs: CODE-KIND-YYMMDD-NN, the seed date, numbered per project and kind in the file's order (B12, B18). */
function seedPackage({ seed, codes, asOf, savedBy, savedAt, prev }) {
  const dk = asOf.slice(2).replace(/-/g, '');
  const n = {};
  const L = { commitment: 'A', question: 'Q', risk: 'R', decision: 'D' };
  const items = seed.items.map((it, i) => {
    const code = codes[it.projectName], k = code + L[it.kind];
    n[k] = (n[k] || 0) + 1;
    const p = it.person;
    return { n: i + 1, row: it.row, kind: it.kind, project: code, id: `${code}-${L[it.kind]}-${dk}-${String(n[k]).padStart(2, '0')}`,
             who: p ? (p.teams || p.name) : it.owner, what: it.title, due: it.due, dueDate: it.dueDate || null, decidedOn: it.decidedOn || null,
             status: it.status, notes: it.notes || '', waitsOnRow: it.waitsOnRow || null, seg: null, src: 'seed', toCheck: false, thread: null };
  });
  const byRow = new Map(items.map(it => [it.row, it.id]));
  for (const it of items) it.waitsOnId = it.waitsOnRow ? byRow.get(it.waitsOnRow) : null;
  const at = savedAt || new Date().toISOString();
  const projectList = seed.projects.map(p => ({ code: codes[p.name], name: p.name, desc: p.notes || '' }));   // desc: the board's project line, as v1
  return {
    mkg2: '1.0', kind: 'seed',
    id: `mkg2-seed-${projectList.map(p => p.code).join('-')}-${asOf.replace(/-/g, '')}-${S.stamp(at)}`,
    savedAt: at, savedBy: savedBy || null, supersedes: prev ? prev.id : null,   // a second seed of the same projects replaces the first
    project: projectList[0], projects: projectList,
    meeting: { id: asOf.replace(/-/g, '') + 'T000000Z', date: asOf, title: 'Board as of ' + asOf, dayKey: dk },
    people: seed.people.map(p => ({ name: p.name, email: p.email, teams: p.teams })),
    items, minted: { maxNum: {} }
  };
}

const api = { parseCsv, readSeed, seedPackage, isoDate };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_seed = api;
})(this);
