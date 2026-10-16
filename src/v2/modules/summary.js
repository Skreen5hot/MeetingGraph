/* MeetingGraph v2 — the step-0 summary the PM can send without sharing the meeting (plan §10.8 step 0, B14).
   Counts only: no names, quotes, titles or dates. It doubles as the §5.6 diagnosis. */
(function (root) {
'use strict';
const KINDS = ['commitment', 'decision', 'question', 'risk', 'update'];
const SRC = ['verified', 'near', 'misplaced', 'not found'];
const fmt = n => Number(n).toLocaleString('en-US');

function countsSummary({ statements, requestChars, requestKind, openThreads, replyChars, checked, verdict, projects, proposed, added }) {
  const it = checked.items;
  const by = (k, v) => it.filter(x => x[k] === v).length;
  const lines = [
    'MeetingGraph v2 slice: summary (counts only, no meeting content)',
    `Request: ${requestKind === 'followup' ? `follow-up, ${openThreads} open threads listed` : 'first meeting (no open threads)'}`,
    `Statements: ${fmt(statements)} | request: ${fmt(requestChars)} characters | reply: ${fmt(replyChars)} characters`,
    `Reply complete: ${checked.cut ? 'no (' + checked.cut.replace(/\d+ items/, m => m) + ')' : 'yes'}${checked.note ? ' (end line miscounted; nothing missing)' : ''} | last statement named: ${checked.lastSegOk ? 'yes' : 'no'}`,
    `Items: ${it.length} (${KINDS.map(k => `${k} ${by('kind', k)}`).join(', ')})`,
    `Sources: ${SRC.map(s => `${s} ${by('src', s)}`).join(', ')}`,
    `Threads: ${it.filter(x => x.thread).length} items on open threads; ${it.filter(x => x.thread && x.status && !x.toCheck).length} status changes applied; ${it.filter(x => x.notes.some(n => /not in the request/.test(n))).length} unknown threads`,
    `Owners that are not a speaker label: ${it.filter(x => !x.whoIsSpeaker).length}`,
    `Items added from a statement by the PM: ${it.filter(x => x.added).length}`,
    `Projects covered: ${projects || 0}; new projects the chat proposed: ${proposed || 0}, added: ${added || 0}`,
    `New items: the chat placed ${it.filter(x => x.chatProject && !x.thread).length}, not clear ${it.filter(x => !x.chatProject && !x.thread && !x.added).length}; the PM moved ${it.filter(x => x.movedByPM).length}, placed ${it.filter(x => x.placedByPM).length}`,
    `Would the PM send the email: ${verdict || 'not answered'}`
  ];
  return lines.join('\n') + '\n';
}

const api = { countsSummary };
if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.MKG2_summary = api;
})(this);
