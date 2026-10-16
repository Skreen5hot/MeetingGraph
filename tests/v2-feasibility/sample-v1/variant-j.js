/* Variant J (plan §10.20, under test): projects as v1 handled them. Nobody chooses a project at meeting-in.
   The request lists the board's projects, and every open thread shows its project. The chat gives each item a project
   only on evidence (a listed code, a new project's ref J1..., or null when it is not clear), and it proposes a new
   project with a quote when the meeting discusses one the board doesn't have.
   Built from the tested texts (request.js SEED = D, FOLLOWUP = F) by exact edits, each asserted to match once.
   Used by make_requests.js and check_sample.js; if J passes, this moves into src/v2/modules/request.js. */
'use strict';
const Q = require('../../../src/v2/modules/request.js');

async function sha8(str, subtle) {
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

// One line per project: CODE | name. No projects yet: one line saying so.
function projectsBlock(projects) {
  return '=== PROJECTS ===\n' + (projects.length ? 'CODE | name\n' + projects.map(p => `${p.code} | ${p.name}`).join('\n') : 'none yet: the board has no projects');
}
// As request F's block, with the thread's project after its ID (v1's INDEX did the same).
function threadsBlockJ(threads) {
  const rows = threads.map(t => [t.id, t.project, t.kind, t.owner || '-', t.what, t.due || '-', t.status].join(' | '));
  return '=== OPEN THREADS ===\nID | project | kind | owner | what | due as said | status\n' + rows.join('\n');
}

const PROJECTS_INTRO = 'PROJECTS, under === PROJECTS ===, are the projects the board tracks. A meeting can cover one project or several, often without saying their names: place each item from what is said around it.\n';
const FIELD = '- "project": the project this item belongs to: a PROJECTS code, or the ref of a new project (J1, J2 ...). Give one only when the meeting names the project or the discussion around the item clearly establishes it. An item on an open thread belongs to that thread\'s project. If it is plausible but not certain, null: the project manager will choose.\n';
const NEWP = 'NEW PROJECTS. When the meeting discusses a project that is not in PROJECTS (an effort with its own goal, not a task or a topic inside one), add one project line for it. If it might be a listed project under another name, use the listed project, or null.\n\n';
const TOPIC = '- "topic": 2 to 5 words naming the subject; use the same topic for items about the same subject.\n';
const PLINE = '- Then one line per new project, if any: {"newProject": "J1", "name": "a short name", "seg": "S001", "words": "..."}, where "seg" and "words" are as for an item and show where the meeting discusses it.\n';
const ENDL = '- The last line: {"end": <the number of item lines>}\n';

function edit(text, pairs) {
  let out = text;
  for (const [o, n] of pairs) {
    if (out.split(o).length !== 2) throw new Error('variant J: the request text has changed; expected one ' + JSON.stringify(o.slice(0, 50)));
    out = out.replace(o, n);
  }
  return out;
}

/* The J request. threads: open threads with .project; projects: [{code, name}]. Same token scheme as v2, over the
   blocks the chat sees: MKG2|seed|id|sha8(projects + meeting) or MKG2|followup|id|sha8(projects + threads + meeting). */
async function buildRequestJ({ id, meeting, threads, projects }, subtle) {
  const pb = projectsBlock(projects);
  const common = [[TOPIC, TOPIC + FIELD], ['FIELDS for each item:\n', NEWP + 'FIELDS for each item:\n'],
    ['- Then one line per item, in meeting order', PLINE + '- Then one line per item, in meeting order'],
    [ENDL, ENDL.replace('item lines>}', 'item lines>}, not counting project lines')]];
  if (!threads || !threads.length) {
    const token = `MKG2|seed|${id}|${await sha8(pb + meeting, subtle)}`;
    let t = Q.SEED.replace('@@TOKEN@@', token) + '\n' + meeting;
    t = edit(t, [['OPEN THREADS (what the board already tracks from earlier meetings): none (this is the first meeting)\n',
                  'OPEN THREADS (what the board already tracks from earlier meetings): none (this is the first meeting)\n\n' + PROJECTS_INTRO],
                 ...common, ['"topic": "...", "who"', '"topic": "...", "project": "...", "who"'],
                 ['=== MEETING ===\nMEETING:', pb + '\n\n=== MEETING ===\nMEETING:']]);
    return { token, kind: 'seed', text: t };
  }
  const tb = threadsBlockJ(threads);
  const token = `MKG2|followup|${id}|${await sha8(pb + tb + meeting, subtle)}`;
  let t = Q.FOLLOWUP.replace('@@TOKEN@@', token).replace('@@THREADS@@', pb + '\n\n' + tb) + meeting;
  t = edit(t, [['This meeting will report on some of them and add new things.\n', 'This meeting will report on some of them and add new things.\n\n' + PROJECTS_INTRO],
               ...common, ['"topic": "...", "who"', '"topic": "...", "project": "...", "who"']]);
  return { token, kind: 'followup', text: t };
}

module.exports = { buildRequestJ, projectsBlock, threadsBlockJ };
