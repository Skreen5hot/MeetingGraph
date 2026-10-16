/* Writes the two variant J test requests from v1's sample (plan §10.20):
     request-J-seeded.txt  the sample board seeded as of 2026-09-24, then the Weekly board walk (placement)
     request-J-empty.txt   the same meeting on an empty board (the chat proposes the projects)
   Run: node tests/v2-feasibility/sample-v1/make_requests.js. Byte for byte the same on every run. */
'use strict';
const fs = require('fs'), path = require('path');
const subtle = require('crypto').webcrypto.subtle;
const D = __dirname, SRC = path.join(D, '../../../src/v2/modules');
const T = require(path.join(SRC, 'transcript.js')), S = require(path.join(SRC, 'store.js')), SD = require(path.join(SRC, 'seed.js'));
const J = require('./variant-j.js');

const KEY = JSON.parse(fs.readFileSync(path.join(D, 'key.json'), 'utf8'));
function sample() {
  const m = KEY.meeting;
  const segments = T.segmentTranscript(fs.readFileSync(path.join(D, 'weekly-board-walk.txt'), 'utf8'));
  const id = T.meetingId(m.date, m.time, m.offset);
  const seed = SD.readSeed(fs.readFileSync(path.join(D, 'sample-board.csv'), 'utf8'));
  const codes = {}, used = [];
  for (const p of seed.projects) { const c = S.defaultCode(p.name, used); used.push(c); codes[p.name] = c; }
  const pkg = SD.seedPackage({ seed, codes, asOf: '2026-09-24', savedBy: 'sample', savedAt: '2026-09-24T12:00:00.000Z' });
  const threads = S.openThreads(S.replay([pkg], { upTo: id }), Object.values(codes));
  return { segments, id, block: T.meetingBlock(m.date, m.title, segments), projects: S.projectsOf([pkg]), threads };
}
async function requests() {
  const s = sample();
  return { s,
    seeded: await J.buildRequestJ({ id: s.id, meeting: s.block, threads: s.threads, projects: s.projects }, subtle),
    empty: await J.buildRequestJ({ id: s.id, meeting: s.block, threads: [], projects: [] }, subtle) };
}
module.exports = { sample, requests };

if (require.main === module) requests().then(r => {
  fs.writeFileSync(path.join(D, 'request-J-seeded.txt'), r.seeded.text);
  fs.writeFileSync(path.join(D, 'request-J-empty.txt'), r.empty.text);
  console.log('seeded', r.seeded.token, r.seeded.text.length, 'chars;', 'empty', r.empty.token, r.empty.text.length, 'chars');
});
