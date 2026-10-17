/* MeetingGraph v2 — the workspace export as a contract for other apps (plan §10.30; the fields are defined in
   docs/mkg2-export-schema.md). "Export workspace" is the team folder's backup: every package, plus `derived`, the board as
   the Board replays it, for a reader that should not re-implement the replay. "Export for sharing" is a reduced view for
   another app (Dossier Studio): chosen projects and dates, only the statements the kept items cite, no email addresses and
   no attendance. A reduced file is marked `reduced: true` and MeetingGraph never opens it as a board.
   The packages are the record; `derived` is computed from them and never read back. */
(function (root) {
'use strict';
const node = typeof module !== 'undefined' && module.exports;
const S = node ? require('./store.js') : root.MKG2_store;
const PE = node ? require('./people.js') : root.MKG2_people;

const VERSION = '1.1';
const clone = x => JSON.parse(JSON.stringify(x));
const records = pkgs => pkgs.filter(p => p && p.mkg2 && (p.kind === 'meeting' || p.kind === 'seed'));
const boards = pkgs => { const sup = new Set(pkgs.filter(p => p && p.mkg2).map(p => p.supersedes).filter(Boolean)); return pkgs.filter(p => p && p.mkg2 && p.kind === 'board' && !sup.has(p.id)); };

/* The board as replayed from pkgs (opts.upTo: only what happened before that meeting ID), as plain JSON. keep: an optional
   test on a project code, to cut it down to the chosen projects. */
function derived(pkgs, opts) {
  const o = opts || {}, keep = o.keep || (() => true);
  const { used, conflicts } = S.current(pkgs);
  const b = S.replay(pkgs, o.upTo ? { upTo: o.upTo } : {});
  const inUse = used.filter(p => !o.upTo || p.meeting.id < o.upTo);
  const last = inUse[inUse.length - 1] || null;
  const usedIds = new Set(used.map(p => p.id)), other = new Set(conflicts.flatMap(c => c.others));
  const codeOfId = id => String(id).split('-')[0];
  return {
    computedFrom: o.computedFrom || 'every package in this file',
    asOf: last ? { meetingId: last.meeting.id, date: last.meeting.date, title: last.meeting.title } : null,
    packages: {
      inUse: inUse.map(p => p.id),
      superseded: records(pkgs).filter(p => !usedIds.has(p.id) && !other.has(p.id)).map(p => p.id),
      conflicts: clone(conflicts),
      boardDecisions: boards(pkgs).map(p => p.id)
    },
    projects: S.projectsOf(pkgs).filter(p => keep(p.code)),
    closedProjects: [...b.closedProjects].filter(([code]) => keep(code)).map(([code, c]) => Object.assign({ code }, clone(c))),
    threads: b.order.map(id => b.threads.get(id)).filter(t => keep(t.project)).map(clone),
    unlinked: clone(b.unlinked.filter(u => keep(codeOfId(u.thread)))),
    people: PE.register(pkgs)
  };
}

// "Export workspace": every package, unchanged, plus derived.
function workspace(pkgs, { exportedAt } = {}) {
  const ps = pkgs.filter(p => p && p.mkg2);
  return { mkg2Workspace: VERSION, exportedAt: exportedAt || new Date().toISOString(), packages: ps, derived: derived(ps) };
}

/* "Export for sharing": projects (codes), from and to (YYYY-MM-DD, inclusive, by meeting date; a board decision by the
   date it was saved). Returns { file } or { error }. Only the saves in use are shared; superseded saves stay home. */
function reduced(pkgs, { projects, from, to, exportedAt } = {}) {
  const codes = new Set(projects || []);
  if (!codes.size) return { error: 'Choose at least one project.' };
  if (!from || !to || from > to) return { error: 'Set a date range: From must be on or before To.' };
  const all = pkgs.filter(p => p && p.mkg2), full = S.replay(all), used = S.current(all).used;
  const inRange = d => d >= from && d <= to;
  const projOf = (p, it) => it.project || (it.thread && full.threads.get(it.thread) ? full.threads.get(it.thread).project : null) ||
    (it.id ? String(it.id).split('-')[0] : null) || (p.project && p.project.code) || null;
  const out = [];
  for (const p of used) {
    if (!inRange(p.meeting.date)) continue;
    const covered = (p.projects && p.projects.length ? p.projects : [p.project]).filter(Boolean);
    const items = p.items.filter(it => codes.has(projOf(p, it)));
    if (!items.length && !covered.some(c => codes.has(c.code))) continue;
    const q = clone(p);
    q.reduced = true;
    q.items = clone(items);
    q.projects = covered.filter(c => codes.has(c.code)).map(clone);
    q.project = q.projects[0] || null;
    if (q.minted && q.minted.maxNum) q.minted.maxNum = Object.fromEntries(Object.entries(q.minted.maxNum).filter(([k]) => !k.includes(':') || codes.has(k.split(':')[0])));
    if (q.meeting.dayKeys) q.meeting.dayKeys = Object.fromEntries(Object.entries(q.meeting.dayKeys).filter(([c]) => codes.has(c)));
    if (p.kind === 'meeting') {
      // Only statements that are evidence: an item still "to check" cites a statement its words were not found in (§10.31).
      const cited = new Set(items.filter(it => !it.toCheck).map(it => it.seg).filter(Boolean));
      q.statements = (p.statements || []).filter(s => cited.has(s.id)).map(clone);
      const speakers = new Set(q.statements.map(s => s.speaker)), whos = new Set(items.map(it => it.who).filter(Boolean));
      q.aliases = (p.aliases || []).filter(a => speakers.has(a.label) || whos.has(a.label)).map(clone);
      // The chat's summary is of the whole meeting: kept only when the meeting covered nothing but the chosen projects.
      q.reply = Object.assign({}, clone(p.reply || {}), { summary: covered.every(c => codes.has(c.code)) ? (p.reply || {}).summary || '' : null });
      q.request = Object.assign({}, clone(p.request || {}), { openIds: ((p.request || {}).openIds || []).filter(id => { const t = full.threads.get(id); return codes.has(t ? t.project : String(id).split('-')[0]); }) });
      q.newProjects = (p.newProjects || []).filter(x => x.code && codes.has(x.code)).map(clone);
      delete q.attendance;
    } else {   // a spreadsheet start: its people without emails, and only those the kept items name
      const named = new Set(items.map(it => it.who).filter(Boolean));
      q.people = (p.people || []).filter(x => named.has(x.name) || (x.teams && named.has(x.teams))).map(x => ({ name: x.name, teams: x.teams || null }));
    }
    out.push(q);
  }
  for (const p of boards(all)) {
    if (!inRange(String(p.savedAt).slice(0, 10))) continue;
    if (/_project$/.test(p.action)) { if (codes.has(p.project)) out.push(Object.assign(clone(p), { reduced: true })); continue; }
    const ts = (p.threads || []).filter(id => { const t = full.threads.get(id); return codes.has(t ? t.project : String(id).split('-')[0]); });
    if (ts.length) out.push(Object.assign(clone(p), { threads: ts, reduced: true }));
  }
  // derived: the board as of the end of the range, cut to the chosen projects: meetings after "to" are left out, and so
  // are board decisions saved after it (§10.31: they had counted until the next meeting). Its people are those the shared
  // packages name.
  const next = used.find(p => p.meeting.date > to);
  const d = derived(all.filter(p => p.kind !== 'board' || String(p.savedAt).slice(0, 10) <= to), { upTo: next ? next.meeting.id : null, keep: c => codes.has(c), computedFrom: 'the whole workspace, up to the end of the range, cut to the chosen projects' });
  const kept = new Set(out.map(p => p.id));
  d.packages = { inUse: d.packages.inUse.filter(id => kept.has(id)), superseded: [], conflicts: [], boardDecisions: d.packages.boardDecisions.filter(id => kept.has(id)) };
  d.people = PE.register(out);
  return { file: { mkg2Workspace: VERSION, reduced: true, exportedAt: exportedAt || new Date().toISOString(),
    scope: { projects: [...codes], from, to }, packages: out, derived: d } };
}

// A file (or a package) that is a reduced view: never loaded as a board.
const isReduced = x => !!(x && x.reduced === true);

const api = { VERSION, workspace, derived, reduced, isReduced };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_export = api;
})(this);
