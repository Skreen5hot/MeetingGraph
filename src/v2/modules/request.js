/* MeetingGraph v2 — the request (plan §10.6 step 2). The two texts are the tested requests, copied verbatim from
   tests/v2-feasibility/make_kit.py: SEED is request D (a project with no open threads, §5.10), FOLLOWUP is request F
   (§6.5). The page sends them with the §10.20 project edits below, and changes nothing else. */
(function (root) {
'use strict';
const SEED = "CONTEXT TOKEN (copy it exactly into \"context\"): @@TOKEN@@\n\nYou read one meeting transcript and list what a project manager needs to know from it. Meetings ramble: most of what is said needs no item. Pick out what matters; do not account for every line.\n\nTHE MEETING is below, under === MEETING ===. Each statement has a number (S001, S002, ...), a time and a speaker.\n\nOPEN THREADS (what the board already tracks from earlier meetings): none (this is the first meeting)\n\nWHAT TO LIST, one item each:\n- commitment: someone says they will do something, or accepts a request (\"I'll\", \"yes, I'll take it\", \"I can do that\"). \"Maybe I could\", \"I could probably\" and \"someone should\" are not commitments.\n- decision: the group settles a choice (\"let's do\", \"we're going with\", \"that's the decision\"). Options discussed but not settled are not decisions.\n- question: something left open that someone still has to answer or decide.\n- risk: something that could delay or block the work.\n- update: a fact about progress, or a change to plans, dates, money or scope.\n\nFINAL STATE ONLY. Meetings change their mind. When something said early is changed later (a decision reversed, a date moved, an owner switched, something pending that came through), list only the final state, cite the statement where it was settled, and do not list the earlier version.\n\nFIELDS for each item:\n- \"kind\": commitment | decision | question | risk | update\n- \"topic\": 2 to 5 words naming the subject; use the same topic for items about the same subject.\n- \"who\": for a commitment, the person who will do it; otherwise the person who raised or settled it. Use the speaker name as written in the transcript (\"Lindqvist, Tom\"), or null.\n- \"what\": one plain line a team member would understand without having been in the meeting.\n- \"due\": the date or time exactly as said (\"by Friday\", \"end of next week\"), or null. Do not convert it.\n- \"importance\": \"high\" for what a leader would want to know (decisions, deadlines, risks to the opening date or the budget, commitments other work depends on); otherwise \"normal\".\n- \"thread\": the ID from OPEN THREADS that this item continues, or null.\n- \"seg\": the one statement number where it is said most clearly (for a commitment, where the person agrees).\n- \"words\": 3 to 10 words copied exactly from that statement, character for character. Do not paraphrase, shorten or fix them.\n\nAt most 40 items; fewer, clearer items are better. Leave out greetings, small talk, stories, technical difficulties and arranging this meeting itself.\n\nOUTPUT: one fenced code block and nothing else. Inside it, one JSON object per line, never more than one object on a line:\n- The first line: {\"context\": \"...\", \"lastSeg\": \"the number of the final statement in the meeting\", \"summary\": \"3 to 5 plain sentences: what the meeting was about and what came out of it\"}\n- Then one line per item, in meeting order (by \"seg\"): {\"kind\": \"...\", \"topic\": \"...\", \"who\": \"...\", \"what\": \"...\", \"due\": null, \"importance\": \"normal\", \"thread\": null, \"seg\": \"S001\", \"words\": \"...\"}\n- The last line: {\"end\": <the number of item lines>}\n";
const FOLLOWUP = "CONTEXT TOKEN (copy it exactly into \"context\"): @@TOKEN@@\n\nYou read one meeting transcript and list what a project manager needs to know from it. Meetings ramble: most of what is said needs no item. Pick out what matters; do not account for every line.\n\nTHE MEETING is below, under === MEETING ===. Each statement has a number (S001, S002, ...), a time and a speaker.\n\nOPEN THREADS, under === OPEN THREADS ===, are what the board already tracks from earlier meetings: actions, open questions, risks and decisions, each with an ID. This meeting will report on some of them and add new things.\n\nWHAT TO LIST, one item each:\n- commitment: someone says they will do something, or accepts a request (\"I'll\", \"yes, I'll take it\", \"I can do that\"). \"Maybe I could\", \"I could probably\" and \"someone should\" are not commitments.\n- decision: the group settles a choice (\"let's do\", \"we're going with\", \"that's the decision\"). Options discussed but not settled are not decisions.\n- question: something left open that someone still has to answer or decide.\n- risk: something that could delay or block the work.\n- update: a fact about progress, or a change to plans, dates, money or scope.\n\nFINAL STATE ONLY. Meetings change their mind. When something said early is changed later (a decision reversed, a date moved, an owner switched, something pending that came through), list only the final state, cite the statement where it was settled, and do not list the earlier version.\n\nFIELDS for each item:\n- \"ref\": N1, N2, N3 ... in order, so other items can point to it.\n- \"kind\": commitment | decision | question | risk | update\n- \"topic\": 2 to 5 words naming the subject; use the same topic for items about the same subject.\n- \"who\": for a commitment, the person who will do it; otherwise the person who raised or settled it. Use the speaker name as written in the transcript (\"Lindqvist, Tom\"), or null.\n- \"what\": one plain line a team member would understand without having been in the meeting.\n- \"due\": the date or time exactly as said (\"by Friday\", \"end of next week\"), or null. Do not convert it.\n- \"importance\": \"high\" for what a leader would want to know (decisions, deadlines, risks to the opening date or the budget, commitments other work depends on); otherwise \"normal\".\n- \"thread\": the OPEN THREADS ID this item reports on or continues, or null when it is new work. Something that only sounds like an open thread (the same words, a different job) is new: null.\n- \"status\": only for an item with a thread, and only when the meeting says so: \"done\" when someone says that action is finished, or that question is answered or settled; \"blocked\" when it cannot move until something else happens; \"in_progress\" when it is started but not finished. Otherwise null. Never \"done\" for something planned, partly done, drafted but held, or not discussed.\n- \"waitsOn\": when a speaker says this cannot be done until something else is, the ref (N...) or thread ID of that other thing; otherwise null.\n- \"seg\": the one statement number where it is said most clearly (for a commitment, where the person agrees).\n- \"words\": 3 to 10 words copied exactly from that statement, character for character. Do not paraphrase, shorten or fix them.\n\nSay nothing about open threads the meeting does not discuss. At most 60 items; fewer, clearer items are better. Leave out greetings, small talk, stories, technical difficulties and arranging this meeting itself.\n\nOUTPUT: one fenced code block and nothing else. Inside it, one JSON object per line, never more than one object on a line:\n- The first line: {\"context\": \"...\", \"lastSeg\": \"the number of the final statement in the meeting\", \"summary\": \"3 to 5 plain sentences: what the meeting was about and what came out of it\"}\n- Then one line per item, in meeting order (by \"seg\"): {\"ref\": \"N1\", \"kind\": \"...\", \"topic\": \"...\", \"who\": \"...\", \"what\": \"...\", \"due\": null, \"importance\": \"normal\", \"thread\": null, \"status\": null, \"waitsOn\": null, \"seg\": \"S001\", \"words\": \"...\"}\n- The last line: {\"end\": <the number of item lines>}\n\n@@THREADS@@\n\n";

async function sha8(str, subtle) {
  const buf = await subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 8);
}

/* Projects, as v1 placed them (plan §10.20, variant J; ratified 2026-10-15). Nobody chooses a project at meeting-in:
   the request lists the board's projects, every open thread shows its project, and the chat gives each item a project
   on evidence (a listed code, a new project's ref J1..., or null when it is not clear), proposing a new project with a
   quote when the meeting discusses one the board doesn't have. Five lines are added to the tested texts and two are
   rewritten, each edit asserted to match once. tests/v2-feasibility/sample-v1/variant-j.js is the reviewed copy;
   v2test.js checks that this one writes the same bytes. */
function projectsBlock(projects) {
  return '=== PROJECTS ===\n' + (projects.length ? 'CODE | name\n' + projects.map(p => `${p.code} | ${p.name}`).join('\n') : 'none yet: the board has no projects');
}
// As request F's block, with each thread's project after its ID (v1's INDEX did the same).
function threadsBlock(threads) {
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
    if (out.split(o).length !== 2) throw new Error('the request text has changed; expected one ' + JSON.stringify(o.slice(0, 50)));
    out = out.replace(o, n);
  }
  return out;
}

// meeting: the MEETING block (transcript.meetingBlock); id: the meeting ID; threads: the open threads to list (each with
// its project); projects: every project on the board, [{ code, name }]. The token hashes what the chat sees:
// MKG2|seed|id|sha8(projects + meeting) or MKG2|followup|id|sha8(projects + threads + meeting).
async function buildRequest({ id, meeting, threads, projects }, subtle) {
  const pb = projectsBlock(projects || []);
  const common = [[TOPIC, TOPIC + FIELD], ['FIELDS for each item:\n', NEWP + 'FIELDS for each item:\n'],
    ['- Then one line per item, in meeting order', PLINE + '- Then one line per item, in meeting order'],
    [ENDL, ENDL.replace('item lines>}', 'item lines>}, not counting project lines')]];
  if (!threads || !threads.length) {
    const token = `MKG2|seed|${id}|${await sha8(pb + meeting, subtle)}`;
    const text = edit(SEED.replace('@@TOKEN@@', token) + '\n' + meeting, [
      ['OPEN THREADS (what the board already tracks from earlier meetings): none (this is the first meeting)\n',
       'OPEN THREADS (what the board already tracks from earlier meetings): none (this is the first meeting)\n\n' + PROJECTS_INTRO],
      ...common, ['"topic": "...", "who"', '"topic": "...", "project": "...", "who"'],
      ['=== MEETING ===\nMEETING:', pb + '\n\n=== MEETING ===\nMEETING:']]);
    return { token, kind: 'seed', text };
  }
  const tb = threadsBlock(threads);
  const token = `MKG2|followup|${id}|${await sha8(pb + tb + meeting, subtle)}`;
  const text = edit(FOLLOWUP.replace('@@TOKEN@@', token).replace('@@THREADS@@', pb + '\n\n' + tb) + meeting, [
    ['This meeting will report on some of them and add new things.\n', 'This meeting will report on some of them and add new things.\n\n' + PROJECTS_INTRO],
    ...common, ['"topic": "...", "who"', '"topic": "...", "project": "...", "who"']]);
  return { token, kind: 'followup', text };
}

const api = { buildRequest, threadsBlock, projectsBlock, SEED, FOLLOWUP };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_request = api;
})(this);
